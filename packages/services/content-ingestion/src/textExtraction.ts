/**
 * Text extraction pipeline integration.
 *
 * Handles:
 * - Routing to correct Subject Module extraction pipeline
 * - Full extraction, partial extraction, and extraction failure
 * - Learner review and edit of extracted text before saving
 * - Display of partial regions that couldn't be processed
 *
 * Requirements: 1.1, 1.2, 1.6, 1.8, 1.10, 1.11
 */

import {
  SubjectModule,
  SubjectModuleRegistry,
  SubjectModuleNotFoundError,
  ExtractionOutput,
  Region,
} from '@chikumiku/service-core';

// --- Types ---

export type ExtractionStatus = 'full' | 'partial' | 'failed';

export interface ExtractionRequest {
  imageData: Uint8Array;
  subjectId: string;
}

export interface ExtractionResultSuccess {
  success: true;
  extractionId: string;
  status: ExtractionStatus;
  extractedText: string;
  confidence: number;
  partialRegions: Region[];
  suggestedActions?: string[];
}

export interface ExtractionResultFailure {
  success: false;
  error: string;
  suggestedActions: string[];
}

export type ExtractionResult = ExtractionResultSuccess | ExtractionResultFailure;

export interface EditableExtraction {
  extractionId: string;
  originalText: string;
  editedText: string;
  status: ExtractionStatus;
  partialRegions: Region[];
  isConfirmed: boolean;
}

// --- Extraction Pipeline ---

/**
 * Determines the extraction status based on confidence and partial regions.
 */
export function determineExtractionStatus(output: ExtractionOutput): ExtractionStatus {
  if (!output.extractedText || output.extractedText.trim().length === 0) {
    return 'failed';
  }

  if (output.partialRegions && output.partialRegions.length > 0) {
    return 'partial';
  }

  if (output.confidence < 0.5) {
    return 'partial';
  }

  return 'full';
}

/**
 * Generates suggested corrective actions based on extraction status.
 */
export function getSuggestedActions(status: ExtractionStatus): string[] {
  switch (status) {
    case 'failed':
      return [
        'Retake the photo with better lighting',
        'Ensure the page is flat and not curved',
        'Make sure the text is clearly visible and not blurry',
        'Try capturing a smaller section of the page',
      ];
    case 'partial':
      return [
        'You can manually complete the missing text in the highlighted regions',
        'Try retaking the photo of the unclear sections',
        'Ensure even lighting across the entire page',
      ];
    case 'full':
      return [];
  }
}

/**
 * Generates a unique extraction ID.
 */
function generateExtractionId(): string {
  return `ext_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Routes an image to the correct Subject Module extraction pipeline
 * and processes the result.
 */
export async function extractText(
  request: ExtractionRequest,
  registry: SubjectModuleRegistry
): Promise<ExtractionResult> {
  // Look up the subject module
  let module: SubjectModule;
  try {
    module = registry.getModule(request.subjectId);
  } catch (error) {
    if (error instanceof SubjectModuleNotFoundError) {
      return {
        success: false,
        error: `No extraction pipeline available for subject "${request.subjectId}". Please ensure the subject is properly configured.`,
        suggestedActions: ['Select a different subject', 'Contact support if this subject should be available'],
      };
    }
    throw error;
  }

  // Invoke the subject module's extraction pipeline
  let output: ExtractionOutput;
  try {
    output = await module.extractionPipeline.extract(request.imageData);
  } catch (error) {
    return {
      success: false,
      error: 'Text extraction failed due to a processing error. The image may be unreadable.',
      suggestedActions: getSuggestedActions('failed'),
    };
  }

  // Determine extraction status
  const status = determineExtractionStatus(output);

  if (status === 'failed') {
    return {
      success: false,
      error: 'Could not extract any text from the image.',
      suggestedActions: getSuggestedActions('failed'),
    };
  }

  const partialRegions: Region[] = (output.partialRegions || []).map((r) => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }));

  return {
    success: true,
    extractionId: generateExtractionId(),
    status,
    extractedText: output.extractedText,
    confidence: output.confidence,
    partialRegions,
    suggestedActions: getSuggestedActions(status),
  };
}

/**
 * Creates an editable extraction for learner review.
 * The learner can edit the extracted text before confirming/saving.
 */
export function createEditableExtraction(result: ExtractionResultSuccess): EditableExtraction {
  return {
    extractionId: result.extractionId,
    originalText: result.extractedText,
    editedText: result.extractedText,
    status: result.status,
    partialRegions: result.partialRegions,
    isConfirmed: false,
  };
}

/**
 * Updates the edited text in an editable extraction.
 */
export function updateEditedText(extraction: EditableExtraction, newText: string): EditableExtraction {
  return {
    ...extraction,
    editedText: newText,
  };
}

/**
 * Confirms the extraction, marking it ready for saving.
 */
export function confirmExtraction(extraction: EditableExtraction): EditableExtraction {
  return {
    ...extraction,
    isConfirmed: true,
  };
}

/**
 * Gets the final text to save (edited version if modified, original otherwise).
 */
export function getFinalText(extraction: EditableExtraction): string {
  return extraction.editedText;
}
