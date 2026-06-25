/**
 * Comprehension Handlers Barrel Export
 *
 * Note: Several handlers export identically-named utility functions
 * (buildCacheKey, computeRequestHash, parseAiResponse) with different
 * signatures. We re-export each handler's factory function and types explicitly
 * to avoid ambiguity. Import directly from individual handler modules when
 * you need their specific utility functions.
 */

export { createGetExplanationHandler } from './getExplanation';
export type {
  ExplanationAIGatewayClient,
  ExplanationDbClient,
  GetExplanationSuccessResponse,
  GetExplanationErrorResponse,
} from './getExplanation';

export {
  createGenerateAudioHandler,
  buildTtsCacheKey,
  computeTtsRequestHash,
} from './generateAudio';
export type {
  TtsAiGatewayClient,
  TtsGatewayResponse,
  AudioDbClient,
  GenerateAudioRequest,
  GenerateAudioSuccessResponse,
  GenerateAudioErrorResponse,
} from './generateAudio';

export { createGenerateRevisionQuestionsHandler } from './generateRevisionQuestions';
export { createGenerateSummaryHandler } from './generateSummary';
export { createGetRevisionQuestionsHandler } from './getRevisionQuestions';
export { createGetSummaryHandler } from './getSummary';

export { createTranslateHandler, buildTranslationCacheKey } from './translate';
export type {
  TranslationAiGatewayClient,
  TranslationDbClient,
  TranslationLanguage,
  ChapterTranslation,
  TranslateSuccessResponse,
  TranslateErrorResponse,
} from './translate';

export { createGetHintHandler, buildEmbeddingCacheKey as buildHintEmbeddingCacheKey, buildHintCacheKey } from './getHint';
export type {
  HintAIGatewayClient,
  HintDbClient,
  HintRequest,
  GetHintSuccessResponse,
  GetHintErrorResponse,
  ReferencedSection as HintReferencedSection,
  SimilarParagraph as HintSimilarParagraph,
} from './getHint';

export { createEvaluateHandler, buildEvaluateCacheKey, buildEmbeddingCacheKey as buildEvaluateEmbeddingCacheKey } from './evaluate';
export type {
  EvaluateAIGatewayClient,
  EvaluateDbClient,
  EvaluateRequest,
  EvaluateSuccessResponse,
  EvaluateErrorResponse,
  ReferencedSection as EvaluateReferencedSection,
  SimilarParagraph as EvaluateSimilarParagraph,
} from './evaluate';
