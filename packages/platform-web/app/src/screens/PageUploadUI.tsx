/**
 * PageUploadUI — Camera capture, file picker, and drag-and-drop page upload interface.
 *
 * "Take Photo" (camera capture JPEG) and "Upload Images" (file picker: JPEG, PNG, HEIC).
 * Web: drag-and-drop drop zone in addition to file picker.
 * Validates ≤10MB per image; max 50 pages per chapter.
 * Thumbnail grid with numbered pages, total count ("4 of 50 max"), delete button per page.
 * "Done — Extract Text" button to upload and trigger OCR.
 * "Supported: JPEG, PNG, HEIC • Max 10MB per image" notice.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
 */

import React, { useState, useCallback, useRef } from 'react';

// ============================================================
// Types & Interfaces
// ============================================================

export interface PageImage {
  id: string;
  file: File;
  thumbnailUrl: string;
  pageNumber: number;
}

export interface PageUploadUIProps {
  /** Chapter ID we are uploading pages for */
  chapterId: string;
  /** Existing page count for this chapter (for enforcing 50-page max) */
  existingPageCount?: number;
  /** Upload all pages and trigger OCR (Req 8.9) */
  onExtractText: (chapterId: string, files: File[]) => Promise<void>;
  /** Navigate back */
  onBack?: () => void;
}

// ============================================================
// Constants & Design Tokens
// ============================================================

const COLORS = {
  primary: '#E94F9B',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  white: '#FFFFFF',
  error: '#E74C3C',
  errorBg: '#FDF2F2',
  green: '#27AE60',
  muted: '#6B7280',
  dropActive: '#EDE7F6',
} as const;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE_MB = 10;
const MAX_PAGES_PER_CHAPTER = 50;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const ACCEPTED_EXTENSIONS = '.jpeg,.jpg,.png,.heic,.heif';

// ============================================================
// Validation Helpers (exported for property tests)
// ============================================================

/**
 * Validates that a file does not exceed the max file size (10 MB).
 * Returns an error string if invalid, null if valid.
 */
export function validateFileSize(fileSizeBytes: number): string | null {
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return `File exceeds the ${MAX_FILE_SIZE_MB}MB size limit`;
  }
  return null;
}

/**
 * Validates that the page count does not exceed the max pages per chapter (50).
 * Returns an error string if invalid, null if valid.
 */
export function validatePageCount(
  currentCount: number,
  addingCount: number
): string | null {
  if (currentCount + addingCount > MAX_PAGES_PER_CHAPTER) {
    return `Maximum ${MAX_PAGES_PER_CHAPTER} pages per chapter reached`;
  }
  return null;
}

// ============================================================
// Styles
// ============================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: COLORS.background,
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  } as React.CSSProperties,

  backButton: {
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '20px',
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    cursor: 'pointer',
  } as React.CSSProperties,

  heading: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: 0,
  } as React.CSSProperties,

  // Upload actions row (Req 8.1)
  actionsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  actionButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  actionButtonDisabled: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    cursor: 'not-allowed',
    opacity: 0.5,
  } as React.CSSProperties,

  // Drop zone (Req 8.10)
  dropZone: (isDragOver: boolean, isDisabled: boolean): React.CSSProperties => ({
    border: `2px dashed ${isDragOver ? COLORS.primary : COLORS.border}`,
    borderRadius: '16px',
    backgroundColor: isDragOver ? COLORS.dropActive : COLORS.white,
    padding: '32px',
    textAlign: 'center' as const,
    marginBottom: '20px',
    transition: 'all 0.2s ease',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  }),

  dropZoneText: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.dark,
    margin: '0 0 6px 0',
  } as React.CSSProperties,

  dropZoneSubtext: {
    fontSize: '12px',
    color: COLORS.muted,
    margin: 0,
  } as React.CSSProperties,

  // Notice (Req 8.11)
  notice: {
    fontSize: '12px',
    color: COLORS.muted,
    margin: '0 0 20px 0',
    fontStyle: 'italic' as const,
  } as React.CSSProperties,

  // Error messages (Req 8.5, 8.6)
  errorMessage: {
    fontSize: '12px',
    color: COLORS.error,
    backgroundColor: COLORS.errorBg,
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '16px',
  } as React.CSSProperties,

  // Page count display (Req 8.7)
  pageCount: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: '16px',
  } as React.CSSProperties,

  // Thumbnail grid (Req 8.7)
  thumbnailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  } as React.CSSProperties,

  thumbnailCard: {
    position: 'relative' as const,
    borderRadius: '10px',
    overflow: 'hidden',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.white,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  } as React.CSSProperties,

  thumbnailImage: {
    width: '100%',
    height: '100px',
    objectFit: 'cover' as const,
    display: 'block',
  } as React.CSSProperties,

  thumbnailFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
  } as React.CSSProperties,

  thumbnailNumber: {
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.dark,
  } as React.CSSProperties,

  // Delete button (Req 8.8)
  deleteButton: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: COLORS.error,
    color: COLORS.white,
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  } as React.CSSProperties,

  // Extract text button (Req 8.9)
  extractButton: (disabled: boolean): React.CSSProperties => ({
    padding: '12px 28px',
    fontSize: '14px',
    fontWeight: 700,
    border: 'none',
    borderRadius: '22px',
    backgroundColor: COLORS.green,
    color: COLORS.white,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
  }),

  // Max limit reached message (Req 8.6)
  limitMessage: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.error,
    marginBottom: '16px',
  } as React.CSSProperties,
} as const;

// ============================================================
// Utility
// ============================================================

let nextId = 0;
function generateId(): string {
  return `page_${Date.now()}_${nextId++}`;
}

function isAcceptedFileType(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  // Fallback for HEIC which may not have a proper MIME type
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'heic' || ext === 'heif' || ext === 'jpeg' || ext === 'jpg' || ext === 'png';
}

// ============================================================
// Main Component
// ============================================================

export const PageUploadUI: React.FC<PageUploadUIProps> = ({
  chapterId,
  existingPageCount = 0,
  onExtractText,
  onBack,
}) => {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const totalPageCount = existingPageCount + pages.length;
  const isAtLimit = totalPageCount >= MAX_PAGES_PER_CHAPTER;

  // === File Processing ===

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const newErrors: string[] = [];
      const newPages: PageImage[] = [];

      for (const file of files) {
        // Check file type
        if (!isAcceptedFileType(file)) {
          newErrors.push(`"${file.name}" is not a supported format (JPEG, PNG, HEIC only)`);
          continue;
        }

        // Validate file size (Req 8.4, 8.5)
        const sizeError = validateFileSize(file.size);
        if (sizeError) {
          newErrors.push(`"${file.name}" — ${sizeError}`);
          continue;
        }

        // Validate page count (Req 8.6)
        const countError = validatePageCount(
          existingPageCount + pages.length + newPages.length,
          1
        );
        if (countError) {
          newErrors.push(countError);
          break; // Stop processing more files
        }

        const thumbnailUrl = URL.createObjectURL(file);
        const pageNumber = existingPageCount + pages.length + newPages.length + 1;
        newPages.push({
          id: generateId(),
          file,
          thumbnailUrl,
          pageNumber,
        });
      }

      if (newErrors.length > 0) {
        setErrors(newErrors);
      } else {
        setErrors([]);
      }

      if (newPages.length > 0) {
        setPages((prev) => [...prev, ...newPages]);
      }
    },
    [existingPageCount, pages.length]
  );

  // === Event Handlers ===

  // Camera capture (Req 8.2)
  const handleTakePhoto = useCallback(() => {
    if (isAtLimit) return;
    cameraInputRef.current?.click();
  }, [isAtLimit]);

  // File picker (Req 8.3)
  const handleUploadImages = useCallback(() => {
    if (isAtLimit) return;
    fileInputRef.current?.click();
  }, [isAtLimit]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      // Reset input value so the same files can be selected again
      e.target.value = '';
    },
    [processFiles]
  );

  // Drag-and-drop (Req 8.10)
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAtLimit) {
        setIsDragOver(true);
      }
    },
    [isAtLimit]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isAtLimit) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [isAtLimit, processFiles]
  );

  // Delete a page (Req 8.8)
  const handleDeletePage = useCallback((pageId: string) => {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== pageId);
      // Renumber pages
      return filtered.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
      }));
    });
    setErrors([]);
  }, []);

  // Done — Extract Text (Req 8.9)
  const handleExtractText = useCallback(async () => {
    if (pages.length === 0 || isExtracting) return;

    setIsExtracting(true);
    setErrors([]);

    try {
      const files = pages.map((p) => p.file);
      await onExtractText(chapterId, files);
    } catch {
      setErrors(['Failed to upload pages. Please try again.']);
    } finally {
      setIsExtracting(false);
    }
  }, [pages, isExtracting, chapterId, onExtractText]);

  // Click on drop zone triggers file picker
  const handleDropZoneClick = useCallback(() => {
    if (!isAtLimit) {
      fileInputRef.current?.click();
    }
  }, [isAtLimit]);

  // === Render ===

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {onBack && (
          <button
            type="button"
            style={styles.backButton}
            onClick={onBack}
            aria-label="Go back"
          >
            ← Back
          </button>
        )}
        <h1 style={styles.heading}>Upload Pages</h1>
      </div>

      {/* Upload action buttons (Req 8.1) */}
      <div style={styles.actionsRow}>
        <button
          type="button"
          style={isAtLimit ? styles.actionButtonDisabled : styles.actionButton}
          onClick={handleTakePhoto}
          disabled={isAtLimit}
          aria-label="Take Photo"
        >
          📷 Take Photo
        </button>
        <button
          type="button"
          style={isAtLimit ? styles.actionButtonDisabled : styles.actionButton}
          onClick={handleUploadImages}
          disabled={isAtLimit}
          aria-label="Upload Images"
        >
          🖼️ Upload Images
        </button>
      </div>

      {/* Drag-and-drop zone (Req 8.10) */}
      <div
        style={styles.dropZone(isDragOver, isAtLimit)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for uploading images"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDropZoneClick();
          }
        }}
      >
        <p style={styles.dropZoneText}>
          {isDragOver ? 'Drop images here' : 'Drag & drop images here'}
        </p>
        <p style={styles.dropZoneSubtext}>or click to browse files</p>
      </div>

      {/* Supported formats notice (Req 8.11) */}
      <p style={styles.notice}>
        Supported: JPEG, PNG, HEIC • Max 10MB per image
      </p>

      {/* Error messages (Req 8.5, 8.6) */}
      {errors.length > 0 && (
        <div role="alert" aria-live="assertive">
          {errors.map((error, idx) => (
            <p key={idx} style={styles.errorMessage}>
              {error}
            </p>
          ))}
        </div>
      )}

      {/* Max limit reached message (Req 8.6) */}
      {isAtLimit && (
        <p style={styles.limitMessage} role="alert">
          Maximum {MAX_PAGES_PER_CHAPTER} pages per chapter reached. Remove pages to add more.
        </p>
      )}

      {/* Page count (Req 8.7) */}
      {pages.length > 0 && (
        <p style={styles.pageCount}>
          {pages.length} of {MAX_PAGES_PER_CHAPTER} max
        </p>
      )}

      {/* Thumbnail grid (Req 8.7, 8.8) */}
      {pages.length > 0 && (
        <div style={styles.thumbnailGrid} role="list" aria-label="Uploaded pages">
          {pages.map((page) => (
            <div
              key={page.id}
              style={styles.thumbnailCard}
              role="listitem"
              aria-label={`Page ${page.pageNumber}`}
            >
              <img
                src={page.thumbnailUrl}
                alt={`Page ${page.pageNumber}`}
                style={styles.thumbnailImage}
              />
              <div style={styles.thumbnailFooter}>
                <span style={styles.thumbnailNumber}>Page {page.pageNumber}</span>
                <button
                  type="button"
                  style={styles.deleteButton}
                  onClick={() => handleDeletePage(page.id)}
                  aria-label={`Delete page ${page.pageNumber}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done — Extract Text button (Req 8.9) */}
      <button
        type="button"
        style={styles.extractButton(pages.length === 0 || isExtracting)}
        onClick={handleExtractText}
        disabled={pages.length === 0 || isExtracting}
        aria-busy={isExtracting}
        aria-label="Done — Extract Text"
      >
        {isExtracting ? 'Uploading...' : 'Done — Extract Text'}
      </button>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  );
};

export default PageUploadUI;
