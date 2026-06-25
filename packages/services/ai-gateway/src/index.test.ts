import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIGateway,
  AIGatewayRequest,
  AIServiceConfig,
  AIServiceResult,
  AIServiceType,
  APIKeyManager,
  APIKeyNotFoundError,
  CacheStore,
  AICacheEntry,
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  AIGatewayError,
  withRetry,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  SERVICE_TIMEOUTS,
} from './index';

// ============================================================
// Test Helpers
// ============================================================

function createMockCacheStore(existingEntries: AICacheEntry[] = []): CacheStore {
  const store = new Map<string, AICacheEntry>();
  for (const entry of existingEntries) {
    store.set(entry.cacheKey, entry);
  }

  return {
    get: vi.fn(async (cacheKey: string) => store.get(cacheKey) || null),
    set: vi.fn(async (entry) => {
      const full: AICacheEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...entry,
      };
      store.set(entry.cacheKey, full);
      return full;
    }),
  };
}

function createMockServiceConfig(
  name: string,
  timeoutMs: number,
  result?: AIServiceResult
): AIServiceConfig {
  return {
    name,
    timeoutMs,
    invoke: vi.fn(async () => result || { data: { text: 'generated content' } }),
  };
}

function createTestRequest(overrides: Partial<AIGatewayRequest> = {}): AIGatewayRequest {
  return {
    cacheKey: 'chapter:abc123:page:1:explanation',
    serviceType: 'explanation',
    requestHash: 'sha256_hash_abc',
    payload: { chapterId: 'abc123', pageNumber: 1 },
    ...overrides,
  };
}

// ============================================================
// Service Timeouts
// ============================================================

describe('SERVICE_TIMEOUTS', () => {
  it('should configure OCR timeout to 30 seconds', () => {
    expect(SERVICE_TIMEOUTS.ocr).toBe(30_000);
  });

  it('should configure text generation timeout to 15 seconds', () => {
    expect(SERVICE_TIMEOUTS.text_generation).toBe(15_000);
    expect(SERVICE_TIMEOUTS.explanation).toBe(15_000);
    expect(SERVICE_TIMEOUTS.summary).toBe(15_000);
    expect(SERVICE_TIMEOUTS.revision).toBe(15_000);
    expect(SERVICE_TIMEOUTS.translation).toBe(15_000);
  });

  it('should configure embeddings timeout to 10 seconds', () => {
    expect(SERVICE_TIMEOUTS.embedding).toBe(10_000);
  });

  it('should configure TTS timeout to 60 seconds', () => {
    expect(SERVICE_TIMEOUTS.tts).toBe(60_000);
  });
});

// ============================================================
// Retry Handler
// ============================================================

describe('calculateBackoffDelay', () => {
  it('should return 1s for first retry (attempt 0)', () => {
    expect(calculateBackoffDelay(0, 1000)).toBe(1000);
  });

  it('should return 2s for second retry (attempt 1)', () => {
    expect(calculateBackoffDelay(1, 1000)).toBe(2000);
  });

  it('should return 4s for third retry (attempt 2)', () => {
    expect(calculateBackoffDelay(2, 1000)).toBe(4000);
  });
});

describe('withRetry', () => {
  const noopSleep = async () => {};

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, DEFAULT_RETRY_CONFIG, undefined, noopSleep);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, DEFAULT_RETRY_CONFIG, undefined, noopSleep);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry up to maxAttempts and throw last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(withRetry(fn, DEFAULT_RETRY_CONFIG, undefined, noopSleep)).rejects.toThrow(
      'persistent failure'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should succeed on the third and final attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('finally');

    const result = await withRetry(fn, DEFAULT_RETRY_CONFIG, undefined, noopSleep);
    expect(result).toBe('finally');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ============================================================
// Circuit Breaker
// ============================================================

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);
  });

  it('should start in closed state', () => {
    expect(breaker.getState()).toBe('closed');
  });

  it('should remain closed after fewer failures than threshold', async () => {
    for (let i = 0; i < 4; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(4);
  });

  it('should open after 5 consecutive failures', async () => {
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe('open');
    expect(breaker.getFailureCount()).toBe(5);
  });

  it('should throw CircuitOpenError when circuit is open', async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }

    await expect(breaker.execute(() => Promise.resolve('test'))).rejects.toThrow(CircuitOpenError);
  });

  it('should reset failure count on success', async () => {
    // Accumulate some failures
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }
    expect(breaker.getFailureCount()).toBe(3);

    // Success resets
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getFailureCount()).toBe(0);
    expect(breaker.getState()).toBe('closed');
  });

  it('should transition to half-open after reset timeout', async () => {
    const shortBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10 });

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await shortBreaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }
    expect(shortBreaker.getState()).toBe('open');

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(shortBreaker.getState()).toBe('half-open');
  });

  it('should close on success in half-open state', async () => {
    const shortBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10 });

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await shortBreaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }

    // Wait for half-open
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(shortBreaker.getState()).toBe('half-open');

    // Success in half-open should close
    await shortBreaker.execute(() => Promise.resolve('ok'));
    expect(shortBreaker.getState()).toBe('closed');
    expect(shortBreaker.getFailureCount()).toBe(0);
  });

  it('should reopen on failure in half-open state', async () => {
    const shortBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10 });

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      try {
        await shortBreaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }

    // Wait for half-open
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(shortBreaker.getState()).toBe('half-open');

    // Failure in half-open should reopen
    try {
      await shortBreaker.execute(() => Promise.reject(new Error('still broken')));
    } catch {
      // expected
    }
    expect(shortBreaker.getState()).toBe('open');
  });

  it('should reset to initial state', () => {
    breaker.reset();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(0);
  });
});

// ============================================================
// API Key Manager
// ============================================================

describe('APIKeyManager', () => {
  let manager: APIKeyManager;

  beforeEach(() => {
    manager = new APIKeyManager();
  });

  it('should add and retrieve a key', () => {
    manager.addKey('openai', 'sk-test-123');
    expect(manager.getKey('openai')).toBe('sk-test-123');
  });

  it('should throw when no key is configured for service', () => {
    expect(() => manager.getKey('unknown_service')).toThrow(APIKeyNotFoundError);
  });

  it('should support multiple keys per service', () => {
    manager.addKey('openai', 'sk-key-1');
    manager.addKey('openai', 'sk-key-2');
    // Should return first active key
    expect(manager.getKey('openai')).toBe('sk-key-1');
    expect(manager.getActiveKeyCount('openai')).toBe(2);
  });

  it('should deactivate a key and return next active one', () => {
    manager.addKey('openai', 'sk-key-1');
    manager.addKey('openai', 'sk-key-2');
    manager.deactivateKey('openai', 'sk-key-1');
    expect(manager.getKey('openai')).toBe('sk-key-2');
    expect(manager.getActiveKeyCount('openai')).toBe(1);
  });

  it('should throw when all keys are deactivated', () => {
    manager.addKey('openai', 'sk-key-1');
    manager.deactivateKey('openai', 'sk-key-1');
    expect(() => manager.getKey('openai')).toThrow(APIKeyNotFoundError);
  });

  it('should check if service has active keys', () => {
    expect(manager.hasActiveKey('openai')).toBe(false);
    manager.addKey('openai', 'sk-key-1');
    expect(manager.hasActiveKey('openai')).toBe(true);
  });
});

// ============================================================
// AI Gateway (Integration)
// ============================================================

describe('AIGateway', () => {
  let cacheStore: CacheStore;
  let apiKeyManager: APIKeyManager;
  let serviceRegistry: Map<AIServiceType, AIServiceConfig>;
  let gateway: AIGateway;

  beforeEach(() => {
    cacheStore = createMockCacheStore();
    apiKeyManager = new APIKeyManager();
    apiKeyManager.addKey('openai', 'sk-test-key');
    apiKeyManager.addKey('google_vision', 'gv-test-key');
    apiKeyManager.addKey('google_tts', 'gtts-test-key');

    serviceRegistry = new Map<AIServiceType, AIServiceConfig>();
    serviceRegistry.set(
      'explanation',
      createMockServiceConfig('GPT-5 Mini', SERVICE_TIMEOUTS.explanation)
    );
    serviceRegistry.set('ocr', createMockServiceConfig('Google Vision OCR', SERVICE_TIMEOUTS.ocr));
    serviceRegistry.set('tts', createMockServiceConfig('Google TTS', SERVICE_TIMEOUTS.tts));
    serviceRegistry.set(
      'embedding',
      createMockServiceConfig('OpenAI Embeddings', SERVICE_TIMEOUTS.embedding)
    );

    gateway = new AIGateway({
      cacheStore,
      apiKeyManager,
      serviceRegistry,
      retryConfig: { maxAttempts: 3, baseDelayMs: 1 }, // fast retries for tests
    });
  });

  describe('Cache hit', () => {
    it('should return cached result when cache key exists', async () => {
      const cachedEntry: AICacheEntry = {
        id: 'entry-1',
        cacheKey: 'chapter:abc:page:1:explanation',
        serviceType: 'explanation',
        requestHash: 'hash123',
        responseJson: { explanation: 'cached explanation' },
        createdAt: '2024-01-01T00:00:00Z',
      };

      cacheStore = createMockCacheStore([cachedEntry]);
      gateway = new AIGateway({ cacheStore, apiKeyManager, serviceRegistry });

      const result = await gateway.process(
        createTestRequest({ cacheKey: 'chapter:abc:page:1:explanation' })
      );

      expect(result.cached).toBe(true);
      expect(result.data).toEqual({ explanation: 'cached explanation' });
    });

    it('should not call external service on cache hit', async () => {
      const cachedEntry: AICacheEntry = {
        id: 'entry-1',
        cacheKey: 'chapter:abc:page:1:explanation',
        serviceType: 'explanation',
        requestHash: 'hash123',
        responseJson: { text: 'cached' },
        createdAt: '2024-01-01T00:00:00Z',
      };

      cacheStore = createMockCacheStore([cachedEntry]);
      const invokeService = vi.fn();
      serviceRegistry.set('explanation', {
        name: 'GPT-5 Mini',
        timeoutMs: 15_000,
        invoke: invokeService,
      });
      gateway = new AIGateway({ cacheStore, apiKeyManager, serviceRegistry });

      await gateway.process(createTestRequest({ cacheKey: 'chapter:abc:page:1:explanation' }));
      expect(invokeService).not.toHaveBeenCalled();
    });
  });

  describe('Cache miss', () => {
    it('should call external service and store result on cache miss', async () => {
      const request = createTestRequest();
      const result = await gateway.process(request);

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ text: 'generated content' });
      expect(cacheStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: request.cacheKey,
          serviceType: request.serviceType,
          requestHash: request.requestHash,
        })
      );
    });

    it('should pass API key to the service invoke function', async () => {
      const invoke = vi.fn().mockResolvedValue({ data: { text: 'ok' } });
      serviceRegistry.set('explanation', { name: 'GPT-5 Mini', timeoutMs: 15_000, invoke });
      gateway = new AIGateway({
        cacheStore,
        apiKeyManager,
        serviceRegistry,
        retryConfig: { maxAttempts: 1, baseDelayMs: 1 },
      });

      await gateway.process(createTestRequest());
      expect(invoke).toHaveBeenCalledWith(expect.any(Object), 'sk-test-key');
    });
  });

  describe('Request validation', () => {
    it('should reject request with empty cacheKey', async () => {
      await expect(gateway.process(createTestRequest({ cacheKey: '' }))).rejects.toThrow(
        AIGatewayError
      );
    });

    it('should reject request with missing serviceType', async () => {
      await expect(
        gateway.process(createTestRequest({ serviceType: '' as AIServiceType }))
      ).rejects.toThrow(AIGatewayError);
    });

    it('should reject request with empty requestHash', async () => {
      await expect(gateway.process(createTestRequest({ requestHash: '' }))).rejects.toThrow(
        AIGatewayError
      );
    });

    it('should reject request with null payload', async () => {
      await expect(
        gateway.process(createTestRequest({ payload: null as unknown as Record<string, unknown> }))
      ).rejects.toThrow(AIGatewayError);
    });
  });

  describe('Timeout handling', () => {
    it('should throw TimeoutError if service exceeds configured timeout', async () => {
      const slowInvoke = vi.fn(
        () => new Promise<AIServiceResult>((resolve) => setTimeout(() => resolve({ data: {} }), 200))
      );
      serviceRegistry.set('explanation', { name: 'Slow Service', timeoutMs: 50, invoke: slowInvoke });
      gateway = new AIGateway({
        cacheStore,
        apiKeyManager,
        serviceRegistry,
        retryConfig: { maxAttempts: 1, baseDelayMs: 1 },
      });

      await expect(gateway.process(createTestRequest())).rejects.toThrow(TimeoutError);
    });
  });

  describe('Service routing', () => {
    it('should route OCR requests to google_vision key', async () => {
      const invoke = vi.fn().mockResolvedValue({ data: { text: 'ocr result' } });
      serviceRegistry.set('ocr', { name: 'Google Vision OCR', timeoutMs: 30_000, invoke });
      gateway = new AIGateway({
        cacheStore,
        apiKeyManager,
        serviceRegistry,
        retryConfig: { maxAttempts: 1, baseDelayMs: 1 },
      });

      await gateway.process(createTestRequest({ serviceType: 'ocr' }));
      expect(invoke).toHaveBeenCalledWith(expect.any(Object), 'gv-test-key');
    });

    it('should route TTS requests to google_tts key', async () => {
      const invoke = vi.fn().mockResolvedValue({ data: { audioUrl: 'test.mp3' }, s3AssetKey: 'audio/test.mp3' });
      serviceRegistry.set('tts', { name: 'Google TTS', timeoutMs: 60_000, invoke });
      gateway = new AIGateway({
        cacheStore,
        apiKeyManager,
        serviceRegistry,
        retryConfig: { maxAttempts: 1, baseDelayMs: 1 },
      });

      const result = await gateway.process(createTestRequest({ serviceType: 'tts' }));
      expect(invoke).toHaveBeenCalledWith(expect.any(Object), 'gtts-test-key');
      expect(result.s3AssetKey).toBe('audio/test.mp3');
    });

    it('should throw for unsupported service type', async () => {
      await expect(
        gateway.process(createTestRequest({ serviceType: 'unsupported' as AIServiceType }))
      ).rejects.toThrow('Unsupported service type');
    });
  });

  describe('Circuit breaker integration', () => {
    it('should provide access to circuit breaker for monitoring', () => {
      const cb = gateway.getCircuitBreaker('explanation');
      expect(cb).toBeDefined();
      expect(cb!.getState()).toBe('closed');
    });
  });
});
