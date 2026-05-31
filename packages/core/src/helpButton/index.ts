/**
 * Help Button Package
 *
 * Exports core interfaces, types, and utilities for the help button
 * and help viewer feature.
 */

export type {
  HelpButtonConfig,
  HelpButtonState,
  HelpViewerConfig,
  HelpViewerState,
  AppStateSnapshot,
  LoadResult,
  UserGuideCacheEntry,
} from './types';

export { HelpViewerStateManager } from './stateManager';
export type { StateManagerDependencies } from './stateManager';

export { HelpButton } from './helpButton';
export type { HelpButtonDependencies } from './helpButton';

export { HelpViewer } from './helpViewer';
export type { HelpViewerDependencies } from './helpViewer';

export { UserGuideSourceImpl } from './userGuideSource';
export type { UserGuideCache as UserGuideCacheInterface, UserGuideSourceOptions, Platform, AssetLoader } from './userGuideSource';

export { UserGuideCache } from './userGuideCache';
export type { IUserGuideCache } from './userGuideCache';

export { HelpButtonIntegration } from './helpButtonIntegration';
export type { HelpButtonIntegrationConfig } from './helpButtonIntegration';
