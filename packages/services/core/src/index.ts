/**
 * @learnverse/service-core
 *
 * Core data models, types, and shared utilities for the LearnVerse LearnVerse platform.
 */

export * from './types';
export * from './validation';
export * from './subjectModule';
export * from './enrollment';
export * from './learningSession';
export {
  validateContentName,
  type ContentNameValidationResponse,
  type Textbook,
  type Chapter as TextbookChapter,
  type Page as TextbookPage,
} from './textbook';
// Note: Chapter and Page from ./textbook are also exported as TextbookChapter
// and TextbookPage to avoid naming conflicts with the legacy Chapter/Page in ./types.
// For direct usage: import { Chapter, Page } from '@learnverse/service-core/src/textbook'
export * from './pageManagement';
