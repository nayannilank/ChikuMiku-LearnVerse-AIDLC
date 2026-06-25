/**
 * Upload Pages Handler
 *
 * POST /chapters/:id/pages
 *
 * Receives page images (as base64-encoded data) and uploads them to S3.
 * Inserts corresponding `chapter_pages` records in the database with
 * OCR status set to 'pending'.
 *
 * S3 key pattern: chapters/{chapterId}/pages/{pageNumber}_{uuid}.{ext}
 *
 * Requirements: 9.1, 9.2, 9.9, 9.10
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PageImage {
  /** Base64-encoded image data */
  data: string;
  /** File format: jpeg, png, or heic */
  format: 'jpeg' | 'png' | 'heic';
  /** Page number (1-based) */
  pageNumber: number;
}

export interface UploadPagesRequestBody {
  pages: PageImage[];
}

export interface ChapterPageRecord {
  id: string;
  chapterId: string;
  pageNumber: number;
  s3ImageKey: string;
  extractedText: string | null;
  wordCount: number;
  isExercisePage: boolean;
  ocrStatus: OcrStatus;
  createdAt: string;
}

export interface UploadPagesSuccessResponse {
  success: true;
  chapterId: string;
  uploadedPages: ChapterPageRecord[];
  totalPages: number;
}

export interface UploadPagesErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

// ============================================================
// External Dependencies (Injected for testability)
// ============================================================

export interface S3Client {
  upload(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ key: string }>;
}

export interface PagesDbClient {
  getExistingPageCount(chapterId: string): Promise<number>;
  insertPages(pages: ChapterPageRecord[]): Promise<void>;
  chapterExists(chapterId: string): Promise<boolean>;
}

export interface UuidGenerator {
  generate(): string;
}

// ============================================================
// Constants
// ============================================================

const MAX_PAGES_PER_CHAPTER = 50;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const SUPPORTED_FORMATS = ['jpeg', 'png', 'heic'] as const;

const CONTENT_TYPE_MAP: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

// ============================================================
// Helpers
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function isValidFormat(format: string): format is typeof SUPPORTED_FORMATS[number] {
  return SUPPORTED_FORMATS.includes(format as typeof SUPPORTED_FORMATS[number]);
}

/**
 * Generates the S3 key for a chapter page image.
 * Pattern: chapters/{chapterId}/pages/{pageNumber}_{uuid}.{ext}
 */
export function generateS3Key(
  chapterId: string,
  pageNumber: number,
  uuid: string,
  format: string,
): string {
  return `chapters/${chapterId}/pages/${pageNumber}_${uuid}.${format}`;
}

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates an uploadPages Lambda handler with injected dependencies.
 */
export function createUploadPagesHandler(
  s3Client: S3Client,
  dbClient: PagesDbClient,
  uuidGenerator: UuidGenerator,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract chapter ID from path
      const chapterId = event.pathParameters?.id;

      if (!chapterId || !isValidUUID(chapterId)) {
        return errorResponse(400, 'INVALID_PARAMETER', 'Missing or invalid chapter ID');
      }

      // Verify chapter exists
      const exists = await dbClient.chapterExists(chapterId);
      if (!exists) {
        return errorResponse(404, 'CHAPTER_NOT_FOUND', `Chapter ${chapterId} not found`);
      }

      // Parse request body
      if (!event.body) {
        return errorResponse(400, 'INVALID_REQUEST', 'Request body is required');
      }

      let body: UploadPagesRequestBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON');
      }

      // Validate pages array
      if (!body.pages || !Array.isArray(body.pages) || body.pages.length === 0) {
        return errorResponse(400, 'INVALID_REQUEST', 'At least one page image is required');
      }

      // Check page limit
      const existingCount = await dbClient.getExistingPageCount(chapterId);
      const totalAfterUpload = existingCount + body.pages.length;

      if (totalAfterUpload > MAX_PAGES_PER_CHAPTER) {
        const remaining = MAX_PAGES_PER_CHAPTER - existingCount;
        return errorResponse(
          400,
          'PAGE_LIMIT_EXCEEDED',
          `Cannot upload ${body.pages.length} pages. Chapter already has ${existingCount} pages. Maximum is ${MAX_PAGES_PER_CHAPTER} (${remaining} remaining).`,
        );
      }

      // Validate each page
      for (const page of body.pages) {
        if (!page.data || typeof page.data !== 'string') {
          return errorResponse(400, 'INVALID_PAGE_DATA', `Page ${page.pageNumber}: image data is required`);
        }

        if (!isValidFormat(page.format)) {
          return errorResponse(
            400,
            'INVALID_FORMAT',
            `Page ${page.pageNumber}: unsupported format "${page.format}". Accepted: JPEG, PNG, HEIC`,
          );
        }

        // Check base64-decoded size
        const estimatedSize = Math.ceil((page.data.length * 3) / 4);
        if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
          return errorResponse(
            400,
            'FILE_TOO_LARGE',
            `Page ${page.pageNumber}: file exceeds the 10 MB size limit`,
          );
        }

        if (page.pageNumber < 1 || !Number.isInteger(page.pageNumber)) {
          return errorResponse(400, 'INVALID_PAGE_NUMBER', `Invalid page number: ${page.pageNumber}`);
        }
      }

      // Upload each page to S3 and create records
      const uploadedPages: ChapterPageRecord[] = [];

      for (const page of body.pages) {
        const uuid = uuidGenerator.generate();
        const s3Key = generateS3Key(chapterId, page.pageNumber, uuid, page.format);
        const imageBuffer = Buffer.from(page.data, 'base64');

        await s3Client.upload({
          key: s3Key,
          body: imageBuffer,
          contentType: CONTENT_TYPE_MAP[page.format],
        });

        const record: ChapterPageRecord = {
          id: uuid,
          chapterId,
          pageNumber: page.pageNumber,
          s3ImageKey: s3Key,
          extractedText: null,
          wordCount: 0,
          isExercisePage: false,
          ocrStatus: 'pending',
          createdAt: new Date().toISOString(),
        };

        uploadedPages.push(record);
      }

      // Insert records into database
      await dbClient.insertPages(uploadedPages);

      const response: UploadPagesSuccessResponse = {
        success: true,
        chapterId,
        uploadedPages,
        totalPages: existingCount + uploadedPages.length,
      };

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify(response),
      };
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred while uploading pages');
    }
  };
}

// ============================================================
// Response Helpers
// ============================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
): APIGatewayProxyResult {
  const body: UploadPagesErrorResponse = { success: false, errorCode, message };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
