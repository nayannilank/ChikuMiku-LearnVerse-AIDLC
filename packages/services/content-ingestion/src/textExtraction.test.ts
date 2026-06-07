import { describe, it, expect } from 'vitest';
import {
  determineExtractionStatus,
  getSuggestedActions,
  extractText,
  createEditableExtraction,
  updateEditedText,
  confirmExtraction,
  getFinalText,
  ExtractionResultSuccess,
} from './textExtraction';
import {
  SubjectModuleRegistry,
  SubjectModule,
  ExtractionOutput,
} from '@learnverse/service-core';

function createMockModule(extractResult: ExtractionOutput | Error): SubjectModule {
  return {
    subjectId: 'kannada',
    name: 'Kannada',
    contentTypes: ['language-script'],
    extractionPipeline: {
      pipelineId: 'kannada-ocr',
      supportedContentTypes: ['language-script'],
      extract: async () => {
        if (extractResult instanceof Error) {
          throw extractResult;
        }
        return extractResult;
      },
    },
    questionGenerationStrategy: {
      strategyId: 'kannada-questions',
      supportedQuestionTypes: ['short-answer'],
      generateQuestions: async () => [],
    },
    renderingConfig: {
      displayName: 'Kannada',
      isLanguageSubject: true,
    },
  };
}

describe('textExtraction', () => {
  describe('determineExtractionStatus', () => {
    it('returns "full" for complete extraction with high confidence', () => {
      const output: ExtractionOutput = {
        extractedText: 'Hello world',
        confidence: 0.95,
      };
      expect(determineExtractionStatus(output)).toBe('full');
    });

    it('returns "partial" when partial regions exist', () => {
      const output: ExtractionOutput = {
        extractedText: 'Hello',
        confidence: 0.8,
        partialRegions: [{ x: 0, y: 0, width: 100, height: 50 }],
      };
      expect(determineExtractionStatus(output)).toBe('partial');
    });

    it('returns "partial" for low confidence', () => {
      const output: ExtractionOutput = {
        extractedText: 'Hello',
        confidence: 0.3,
      };
      expect(determineExtractionStatus(output)).toBe('partial');
    });

    it('returns "failed" for empty text', () => {
      const output: ExtractionOutput = {
        extractedText: '',
        confidence: 0,
      };
      expect(determineExtractionStatus(output)).toBe('failed');
    });

    it('returns "failed" for whitespace-only text', () => {
      const output: ExtractionOutput = {
        extractedText: '   \n  ',
        confidence: 0.5,
      };
      expect(determineExtractionStatus(output)).toBe('failed');
    });
  });

  describe('getSuggestedActions', () => {
    it('returns corrective actions for failed extraction', () => {
      const actions = getSuggestedActions('failed');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.includes('lighting'))).toBe(true);
    });

    it('returns actions for partial extraction', () => {
      const actions = getSuggestedActions('partial');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.includes('manually'))).toBe(true);
    });

    it('returns empty array for full extraction', () => {
      const actions = getSuggestedActions('full');
      expect(actions).toHaveLength(0);
    });
  });

  describe('extractText', () => {
    it('succeeds with full extraction', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(
        createMockModule({
          extractedText: 'ಕನ್ನಡ ಪಠ್ಯ',
          confidence: 0.95,
        })
      );

      const result = await extractText(
        { imageData: new Uint8Array(100), subjectId: 'kannada' },
        registry
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe('full');
        expect(result.extractedText).toBe('ಕನ್ನಡ ಪಠ್ಯ');
        expect(result.confidence).toBe(0.95);
        expect(result.partialRegions).toHaveLength(0);
      }
    });

    it('succeeds with partial extraction', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(
        createMockModule({
          extractedText: 'Partial text',
          confidence: 0.7,
          partialRegions: [{ x: 10, y: 20, width: 100, height: 50 }],
        })
      );

      const result = await extractText(
        { imageData: new Uint8Array(100), subjectId: 'kannada' },
        registry
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe('partial');
        expect(result.partialRegions).toHaveLength(1);
        expect(result.suggestedActions!.length).toBeGreaterThan(0);
      }
    });

    it('fails when extraction produces no text', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(
        createMockModule({
          extractedText: '',
          confidence: 0,
        })
      );

      const result = await extractText(
        { imageData: new Uint8Array(100), subjectId: 'kannada' },
        registry
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Could not extract');
        expect(result.suggestedActions.length).toBeGreaterThan(0);
      }
    });

    it('fails when extraction pipeline throws', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(createMockModule(new Error('OCR service unavailable')));

      const result = await extractText(
        { imageData: new Uint8Array(100), subjectId: 'kannada' },
        registry
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('processing error');
      }
    });

    it('fails when subject module is not found', async () => {
      const registry = new SubjectModuleRegistry();

      const result = await extractText(
        { imageData: new Uint8Array(100), subjectId: 'unknown-subject' },
        registry
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('unknown-subject');
      }
    });
  });

  describe('editable extraction workflow', () => {
    const mockResult: ExtractionResultSuccess = {
      success: true,
      extractionId: 'ext_123',
      status: 'partial',
      extractedText: 'Original text',
      confidence: 0.8,
      partialRegions: [{ x: 0, y: 0, width: 50, height: 50 }],
      suggestedActions: ['Fix manually'],
    };

    it('creates an editable extraction from a result', () => {
      const editable = createEditableExtraction(mockResult);
      expect(editable.extractionId).toBe('ext_123');
      expect(editable.originalText).toBe('Original text');
      expect(editable.editedText).toBe('Original text');
      expect(editable.isConfirmed).toBe(false);
    });

    it('allows updating the edited text', () => {
      const editable = createEditableExtraction(mockResult);
      const updated = updateEditedText(editable, 'Corrected text');
      expect(updated.editedText).toBe('Corrected text');
      expect(updated.originalText).toBe('Original text');
    });

    it('confirms the extraction', () => {
      const editable = createEditableExtraction(mockResult);
      const confirmed = confirmExtraction(editable);
      expect(confirmed.isConfirmed).toBe(true);
    });

    it('returns edited text as final text', () => {
      const editable = createEditableExtraction(mockResult);
      const updated = updateEditedText(editable, 'My corrected version');
      expect(getFinalText(updated)).toBe('My corrected version');
    });

    it('returns original text as final text when not edited', () => {
      const editable = createEditableExtraction(mockResult);
      expect(getFinalText(editable)).toBe('Original text');
    });
  });
});
