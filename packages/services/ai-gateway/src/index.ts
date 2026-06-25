/**
 * @learnverse/service-ai-gateway
 *
 * AI Gateway service — mediates all external AI service calls.
 * Implements:
 * - Request Router: routes AI requests to the correct external service
 * - Cache Check: generate-once-store-permanently pattern via `ai_cache` table
 * - API Key Manager: secure key rotation and selection per service
 * - Retry Handler: 3 attempts with exponential backoff (1s, 2s, 4s)
 * - Circuit Breaker: opens after 5 consecutive failures, half-open after 30s
 * - Service Timeouts: OCR 30s, text gen 15s, embeddings 10s, TTS 60s
 *
 * Requirements: 2.7, 2.8
 */

import { createLogger, type Logger } from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

/** Supported AI service types */
export type AIServiceType =
  | 'ocr'
  | 'explanation'
  | 'summary'
  | 'revision'
  | 'tts'
  | 'translation'
  | 'embedding'
  | 'transcription'
  | 'text_generation';

/** Request to the AI Gateway */
export interface AIGatewayRequest {
  /** Deterministic cache key (e.g., "chapter:{id}:page:{n}:explanation") */
  cacheKey: string;
  /** The type of AI service to invoke */
  serviceType: AIServiceType;
  /** SHA-256 hash of the request payload for cache validation */
  requestHash: string;
  /** The payload to send to the external AI service */
  payload: Record<string, unknown>;
}

/** Response from the AI Gateway */
export interface AIGatewayResponse {
  /** Whether the result came from cache */
  cached: boolean;
  /** The AI service response data */
  data: Record<string, unknown>;
  /** S3 key for audio/binary assets (if applicable) */
  s3AssetKey?: string;
  /** CDN URL for audio/binary assets (if applicable) */
  cdnUrl?: string;
}

/** A cached entry stored in the `ai_cache` table */
export interface AICacheEntry {
  id: string;
  cacheKey: string;
  serviceType: AIServiceType;
  requestHash: string;
  responseJson: Record<string, unknown>;
  s3AssetKey?: string;
  createdAt: string;
}

/** Configuration for an external AI service */
export interface AIServiceConfig {
  /** Service name for logging */
  name: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** The function that calls the external service */
  invoke: (payload: Record<string, unknown>, apiKey: string) => Promise<AIServiceResult>;
}

/** Result from calling an external AI service */
export interface AIServiceResult {
  data: Record<string, unknown>;
  /** Optional S3 key if the service produces binary assets */
  s3AssetKey?: string;
}

/** API key entry */
export interface APIKeyEntry {
  service: string;
  key: string;
  isActive: boolean;
}

// ============================================================
// Service Timeout Configuration
// ============================================================

/** Timeout configuration per service type (milliseconds) */
export const SERVICE_TIMEOUTS: Record<AIServiceType, number> = {
  ocr: 30_000,
  explanation: 15_000,
  summary: 15_000,
  revision: 15_000,
  tts: 60_000,
  translation: 15_000,
  embedding: 10_000,
  transcription: 30_000,
  text_generation: 15_000,
};

// ============================================================
// Retry Handler
// ============================================================

/** Retry configuration */
export interface RetryConfig {
  /** Maximum number of attempts (including the first) */
  maxAttempts: number;
  /** Base delay in milliseconds (doubles each retry) */
  baseDelayMs: number;
}

/** Default retry configuration: 3 attempts, 1s/2s/4s backoff */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
};

/**
 * Calculates the delay for a given attempt using exponential backoff.
 * attempt is 0-indexed (0 = first retry after initial failure).
 *
 * Delays: attempt 0 → 1s, attempt 1 → 2s, attempt 2 → 4s
 */
export function calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Executes an async function with retry logic and exponential backoff.
 * On failure after all attempts, throws the last encountered error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  logger?: Logger,
  sleepFn: (ms: number) => Promise<void> = sleep
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts - 1) {
        const delay = calculateBackoffDelay(attempt, config.baseDelayMs);
        logger?.warn('retry_attempt', {
          attempt: attempt + 1,
          maxAttempts: config.maxAttempts,
          delayMs: delay,
          errorMessage: lastError.message,
        });
        await sleepFn(delay);
      }
    }
  }

  throw lastError!;
}

/** Default sleep utility */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Circuit Breaker
// ============================================================

/** Circuit breaker states */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds before transitioning from open to half-open */
  resetTimeoutMs: number;
}

/** Default circuit breaker: opens after 5 failures, half-open after 30s */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
};

/**
 * Circuit Breaker implementation.
 *
 * - Closed: requests pass through normally
 * - Open: requests fail immediately (after 5 consecutive failures)
 * - Half-Open: one test request is allowed through after 30s cooldown
 *   - If it succeeds → circuit closes
 *   - If it fails → circuit reopens
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;
  private logger?: Logger;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /** Returns the current circuit state */
  getState(): CircuitState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        this.logger?.info('circuit_breaker_half_open', {
          elapsedMs: elapsed,
          resetTimeoutMs: this.config.resetTimeoutMs,
        });
      }
    }
    return this.state;
  }

  /** Returns the number of consecutive failures */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Executes a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open and cooldown has not elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'open') {
      throw new CircuitOpenError(
        `Circuit breaker is open. ${this.config.failureThreshold} consecutive failures detected. ` +
          `Retry after ${this.config.resetTimeoutMs}ms cooldown.`
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Records a successful call — resets failure count, closes circuit */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.logger?.info('circuit_breaker_closed', { previousState: 'half-open' });
    }
    this.failureCount = 0;
    this.state = 'closed';
  }

  /** Records a failed call — increments failure count, may open circuit */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Half-open test request failed → reopen
      this.state = 'open';
      this.logger?.warn('circuit_breaker_reopened', {
        failureCount: this.failureCount,
      });
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.logger?.warn('circuit_breaker_opened', {
        failureCount: this.failureCount,
        failureThreshold: this.config.failureThreshold,
      });
    }
  }

  /** Resets the circuit breaker to initial state */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

/** Error thrown when the circuit breaker is open */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ============================================================
// API Key Manager
// ============================================================

/**
 * Manages API keys for external AI services.
 * Supports multiple keys per service for rotation and failover.
 */
export class APIKeyManager {
  private keys: Map<string, APIKeyEntry[]> = new Map();

  /** Registers an API key for a service */
  addKey(service: string, key: string): void {
    const entries = this.keys.get(service) || [];
    entries.push({ service, key, isActive: true });
    this.keys.set(service, entries);
  }

  /** Gets an active API key for the specified service */
  getKey(service: string): string {
    const entries = this.keys.get(service);
    if (!entries || entries.length === 0) {
      throw new APIKeyNotFoundError(`No API key configured for service: ${service}`);
    }

    const activeEntry = entries.find((e) => e.isActive);
    if (!activeEntry) {
      throw new APIKeyNotFoundError(`No active API key available for service: ${service}`);
    }

    return activeEntry.key;
  }

  /** Deactivates a specific key (e.g., after quota exhaustion) */
  deactivateKey(service: string, key: string): void {
    const entries = this.keys.get(service);
    if (entries) {
      const entry = entries.find((e) => e.key === key);
      if (entry) {
        entry.isActive = false;
      }
    }
  }

  /** Checks if a service has any active keys */
  hasActiveKey(service: string): boolean {
    const entries = this.keys.get(service);
    return !!entries && entries.some((e) => e.isActive);
  }

  /** Returns the count of active keys for a service */
  getActiveKeyCount(service: string): number {
    const entries = this.keys.get(service);
    if (!entries) return 0;
    return entries.filter((e) => e.isActive).length;
  }
}

/** Error thrown when no API key is available */
export class APIKeyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIKeyNotFoundError';
  }
}

// ============================================================
// Cache Store Interface
// ============================================================

/**
 * Interface for the AI cache store (PostgreSQL `ai_cache` table).
 * Implementations handle actual database operations.
 */
export interface CacheStore {
  /** Looks up a cached response by cache key */
  get(cacheKey: string): Promise<AICacheEntry | null>;
  /** Stores an AI response in the cache */
  set(entry: Omit<AICacheEntry, 'id' | 'createdAt'>): Promise<AICacheEntry>;
}

// ============================================================
// AI Gateway (Request Router)
// ============================================================

/** Configuration for the AI Gateway */
export interface AIGatewayConfig {
  cacheStore: CacheStore;
  apiKeyManager: APIKeyManager;
  serviceRegistry: Map<AIServiceType, AIServiceConfig>;
  retryConfig?: RetryConfig;
  circuitBreakerConfig?: CircuitBreakerConfig;
  logger?: Logger;
}

/**
 * AI Gateway — the primary entry point for all AI service calls.
 *
 * Implements the generate-once-store-permanently pattern:
 * 1. Check cache (PostgreSQL `ai_cache` table) using the deterministic cache key
 * 2. On cache hit → return stored result immediately
 * 3. On cache miss → invoke external service with retry + circuit breaker
 * 4. Store response in cache → return
 */
export class AIGateway {
  private cacheStore: CacheStore;
  private apiKeyManager: APIKeyManager;
  private serviceRegistry: Map<AIServiceType, AIServiceConfig>;
  private retryConfig: RetryConfig;
  private circuitBreakers: Map<AIServiceType, CircuitBreaker> = new Map();
  private logger: Logger;

  constructor(config: AIGatewayConfig) {
    this.cacheStore = config.cacheStore;
    this.apiKeyManager = config.apiKeyManager;
    this.serviceRegistry = config.serviceRegistry;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    this.logger = config.logger || createLogger({});

    // Initialize a circuit breaker per service type
    const cbConfig = config.circuitBreakerConfig || DEFAULT_CIRCUIT_BREAKER_CONFIG;
    for (const serviceType of this.serviceRegistry.keys()) {
      this.circuitBreakers.set(serviceType, new CircuitBreaker(cbConfig, this.logger));
    }
  }

  /**
   * Processes an AI request through the gateway.
   *
   * Flow:
   * 1. Validate request
   * 2. Check cache (generate-once-store-permanently)
   * 3. On miss: route to external service with retry + circuit breaker
   * 4. Store response in cache
   * 5. Return result
   */
  async process(request: AIGatewayRequest): Promise<AIGatewayResponse> {
    const startTime = Date.now();

    // Validate the request
    this.validateRequest(request);

    // Step 1: Check cache
    const cached = await this.cacheStore.get(request.cacheKey);
    if (cached) {
      this.logger.info('cache_hit', {
        cacheKey: request.cacheKey,
        serviceType: request.serviceType,
        durationMs: Date.now() - startTime,
      });
      return {
        cached: true,
        data: cached.responseJson,
        s3AssetKey: cached.s3AssetKey,
      };
    }

    // Step 2: Get service config
    const serviceConfig = this.serviceRegistry.get(request.serviceType);
    if (!serviceConfig) {
      throw new AIGatewayError(`Unsupported service type: ${request.serviceType}`);
    }

    // Step 3: Get API key
    const serviceKey = this.resolveServiceKeyName(request.serviceType);
    const apiKey = this.apiKeyManager.getKey(serviceKey);

    // Step 4: Invoke external service with circuit breaker + retry
    const circuitBreaker = this.circuitBreakers.get(request.serviceType);
    if (!circuitBreaker) {
      throw new AIGatewayError(`No circuit breaker for service type: ${request.serviceType}`);
    }

    let result: AIServiceResult;
    try {
      result = await circuitBreaker.execute(() =>
        withRetry(
          () => this.invokeWithTimeout(serviceConfig, request.payload, apiKey),
          this.retryConfig,
          this.logger
        )
      );
    } catch (error) {
      this.logger.error('ai_service_call_failed', error, {
        cacheKey: request.cacheKey,
        serviceType: request.serviceType,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }

    // Step 5: Store in cache (generate-once-store-permanently)
    const cacheEntry = await this.cacheStore.set({
      cacheKey: request.cacheKey,
      serviceType: request.serviceType,
      requestHash: request.requestHash,
      responseJson: result.data,
      s3AssetKey: result.s3AssetKey,
    });

    this.logger.info('cache_miss_stored', {
      cacheKey: request.cacheKey,
      serviceType: request.serviceType,
      durationMs: Date.now() - startTime,
      s3AssetKey: result.s3AssetKey,
    });

    return {
      cached: false,
      data: result.data,
      s3AssetKey: cacheEntry.s3AssetKey,
    };
  }

  /** Returns the circuit breaker for a service type (for monitoring) */
  getCircuitBreaker(serviceType: AIServiceType): CircuitBreaker | undefined {
    return this.circuitBreakers.get(serviceType);
  }

  /** Validates an incoming AI request */
  private validateRequest(request: AIGatewayRequest): void {
    if (!request.cacheKey || request.cacheKey.trim().length === 0) {
      throw new AIGatewayError('cacheKey is required');
    }
    if (!request.serviceType) {
      throw new AIGatewayError('serviceType is required');
    }
    if (!request.requestHash || request.requestHash.trim().length === 0) {
      throw new AIGatewayError('requestHash is required');
    }
    if (!request.payload || typeof request.payload !== 'object') {
      throw new AIGatewayError('payload must be a non-null object');
    }
  }

  /**
   * Invokes an external AI service with the configured timeout.
   * Throws TimeoutError if the call exceeds the service-specific timeout.
   */
  private async invokeWithTimeout(
    serviceConfig: AIServiceConfig,
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<AIServiceResult> {
    return new Promise<AIServiceResult>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(
            new TimeoutError(
              `AI service "${serviceConfig.name}" timed out after ${serviceConfig.timeoutMs}ms`
            )
          );
        }
      }, serviceConfig.timeoutMs);

      serviceConfig
        .invoke(payload, apiKey)
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        });
    });
  }

  /**
   * Maps a service type to the API key service name.
   * Multiple service types may share the same external provider key.
   */
  private resolveServiceKeyName(serviceType: AIServiceType): string {
    switch (serviceType) {
      case 'ocr':
        return 'google_vision';
      case 'tts':
        return 'google_tts';
      case 'embedding':
        return 'openai';
      case 'transcription':
        return 'openai';
      case 'explanation':
      case 'summary':
      case 'revision':
      case 'translation':
      case 'text_generation':
        return 'openai';
      default:
        return serviceType;
    }
  }
}

/** General AI Gateway error */
export class AIGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIGatewayError';
  }
}

/** Timeout error for AI service calls */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
