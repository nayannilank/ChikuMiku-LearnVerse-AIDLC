/**
 * Property Test: Generate-Once Cache Consistency
 *
 * Property 14: For any AI-generated content request (chapter explanation, TTS audio,
 * revision questions, summary, translation, reference pronunciation), the first request
 * SHALL generate and store the result; all subsequent requests for the same content SHALL
 * return the stored result without invoking the external AI service again.
 *
 * **Validates: Requirements 10.1, 10.4, 10.10, 10.11, 10.12, 10.13, 10.16, 12.3, 20.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AIGateway,
  AIGatewayRequest,
  AIServiceConfig,
  AIServiceResult,
  AIServiceType,
  AICacheEntry,
  APIKeyManager,
  CacheStore,
} from '../index';

// ============================================================
// Mock Implementations
// ============================================================

/**
 * In-memory CacheStore that tracks get/set calls for verification.
 */
class MockCacheStore implements CacheStore {
  private store: Map<string, AICacheEntry> = new Map();
  public getCalls: string[] = [];
  public setCalls: Array<Omit<AICacheEntry, 'id' | 'createdAt'>> = [];

  async get(cacheKey: string): Promise<AICacheEntry | null> {
    this.getCalls.push(cacheKey);
    return this.store.get(cacheKey) ?? null;
  }

  async set(entry: Omit<AICacheEntry, 'id' | 'createdAt'>): Promise<AICacheEntry> {
    this.setCalls.push(entry);
    const fullEntry: AICacheEntry = {
      ...entry,
      id: `cache-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    };
    this.store.set(entry.cacheKey, fullEntry);
    return fullEntry;
  }

  reset(): void {
    this.store.clear();
    this.getCalls = [];
    this.setCalls = [];
  }
}

/**
 * Mock AI service that tracks invocation count per call.
 */
class MockAIService {
  public invocationCount = 0;

  createConfig(serviceType: AIServiceType): AIServiceConfig {
    return {
      name: `mock-${serviceType}`,
      timeoutMs: 5000,
      invoke: async (payload: Record<string, unknown>, _apiKey: string): Promise<AIServiceResult> => {
        this.invocationCount++;
        return {
          data: {
            generated: true,
            content: `AI response for ${payload['cacheKey'] || 'request'}`,
            timestamp: Date.now(),
          },
          s3AssetKey: payload['needsAsset'] ? `assets/${Date.now()}.mp3` : undefined,
        };
      },
    };
  }

  reset(): void {
    this.invocationCount = 0;
  }
}

// ============================================================
// Arbitraries (Generators)
// ============================================================

/** Generates a valid chapter ID (UUID-like) */
const chapterIdArb = fc.uuid();

/** Generates a valid page number (1-50) */
const pageNumberArb = fc.integer({ min: 1, max: 50 });

/** Generates a valid AI service type */
const serviceTypeArb: fc.Arbitrary<AIServiceType> = fc.constantFrom(
  'explanation',
  'summary',
  'revision',
  'tts',
  'translation',
  'text_generation',
);

/** Generates a deterministic cache key from chapter/page/service */
function makeCacheKey(chapterId: string, pageNumber: number, serviceType: string): string {
  return `chapter:${chapterId}:page:${pageNumber}:${serviceType}`;
}

/** Generates a valid request hash (SHA-256-like hex string) */
const requestHashArb = fc.hexaString({ minLength: 64, maxLength: 64 });

/** Generates an AIGatewayRequest */
const gatewayRequestArb: fc.Arbitrary<AIGatewayRequest> = fc
  .tuple(chapterIdArb, pageNumberArb, serviceTypeArb, requestHashArb)
  .map(([chapterId, pageNumber, serviceType, requestHash]) => ({
    cacheKey: makeCacheKey(chapterId, pageNumber, serviceType),
    serviceType,
    requestHash,
    payload: { chapterId, pageNumber, cacheKey: makeCacheKey(chapterId, pageNumber, serviceType) },
  }));

// ============================================================
// Test Helpers
// ============================================================

function createGateway(
  cacheStore: MockCacheStore,
  mockService: MockAIService,
): AIGateway {
  const apiKeyManager = new APIKeyManager();
  apiKeyManager.addKey('openai', 'test-key-openai');
  apiKeyManager.addKey('google_tts', 'test-key-google-tts');

  const serviceRegistry = new Map<AIServiceType, AIServiceConfig>();
  const allTypes: AIServiceType[] = [
    'ocr', 'explanation', 'summary', 'revision',
    'tts', 'translation', 'embedding', 'transcription', 'text_generation',
  ];
  for (const type of allTypes) {
    serviceRegistry.set(type, mockService.createConfig(type));
  }

  return new AIGateway({
    cacheStore,
    apiKeyManager,
    serviceRegistry,
    retryConfig: { maxAttempts: 1, baseDelayMs: 0 },
  });
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 14: Generate-Once Cache Consistency', () => {
  it('first request calls AI service and returns cached=false', async () => {
    await fc.assert(
      fc.asyncProperty(gatewayRequestArb, async (request) => {
        const cacheStore = new MockCacheStore();
        const mockService = new MockAIService();
        const gateway = createGateway(cacheStore, mockService);

        const response = await gateway.process(request);

        // First request should NOT be from cache
        expect(response.cached).toBe(false);
        // AI service should have been called exactly once
        expect(mockService.invocationCount).toBe(1);
        // Response should contain generated data
        expect(response.data).toBeDefined();
        expect(response.data['generated']).toBe(true);
        // Cache should have been populated (one set call)
        expect(cacheStore.setCalls.length).toBe(1);
        expect(cacheStore.setCalls[0].cacheKey).toBe(request.cacheKey);
      }),
      { numRuns: 100 },
    );
  });

  it('subsequent requests with same cache key return cached=true without calling AI service', async () => {
    await fc.assert(
      fc.asyncProperty(gatewayRequestArb, async (request) => {
        const cacheStore = new MockCacheStore();
        const mockService = new MockAIService();
        const gateway = createGateway(cacheStore, mockService);

        // First call — populates cache
        const firstResponse = await gateway.process(request);
        expect(firstResponse.cached).toBe(false);
        expect(mockService.invocationCount).toBe(1);

        // Second call — should come from cache
        const secondResponse = await gateway.process(request);
        expect(secondResponse.cached).toBe(true);
        // AI service should NOT have been called again
        expect(mockService.invocationCount).toBe(1);
        // Cached response data should match the first response
        expect(secondResponse.data).toEqual(firstResponse.data);

        // Third call — still from cache
        const thirdResponse = await gateway.process(request);
        expect(thirdResponse.cached).toBe(true);
        expect(mockService.invocationCount).toBe(1);
        expect(thirdResponse.data).toEqual(firstResponse.data);
      }),
      { numRuns: 100 },
    );
  });

  it('different cache keys result in separate AI service calls', async () => {
    // Generate 2-5 distinct requests with unique cache keys
    const distinctRequestsArb = fc
      .uniqueArray(
        fc.tuple(chapterIdArb, pageNumberArb, serviceTypeArb, requestHashArb),
        {
          minLength: 2,
          maxLength: 5,
          comparator: (a, b) =>
            makeCacheKey(a[0], a[1], a[2]) === makeCacheKey(b[0], b[1], b[2]),
        },
      )
      .map((tuples) =>
        tuples.map(([chapterId, pageNumber, serviceType, requestHash]) => ({
          cacheKey: makeCacheKey(chapterId, pageNumber, serviceType),
          serviceType,
          requestHash,
          payload: { chapterId, pageNumber, cacheKey: makeCacheKey(chapterId, pageNumber, serviceType) },
        })),
      );

    await fc.assert(
      fc.asyncProperty(distinctRequestsArb, async (requests) => {
        const cacheStore = new MockCacheStore();
        const mockService = new MockAIService();
        const gateway = createGateway(cacheStore, mockService);

        // Process all distinct requests — each should call AI exactly once
        for (const request of requests) {
          const response = await gateway.process(request);
          expect(response.cached).toBe(false);
        }

        // Total AI calls should equal number of distinct requests
        expect(mockService.invocationCount).toBe(requests.length);
        // Each request should have been cached
        expect(cacheStore.setCalls.length).toBe(requests.length);

        // Now re-process all — all should come from cache
        mockService.reset();
        for (const request of requests) {
          const response = await gateway.process(request);
          expect(response.cached).toBe(true);
        }
        // No additional AI calls on re-process
        expect(mockService.invocationCount).toBe(0);
      }),
      { numRuns: 50 },
    );
  });

  it('cached response preserves s3AssetKey when present', async () => {
    const requestWithAssetArb = fc
      .tuple(chapterIdArb, pageNumberArb, requestHashArb)
      .map(([chapterId, pageNumber, requestHash]) => ({
        cacheKey: makeCacheKey(chapterId, pageNumber, 'tts'),
        serviceType: 'tts' as AIServiceType,
        requestHash,
        payload: { chapterId, pageNumber, needsAsset: true, cacheKey: makeCacheKey(chapterId, pageNumber, 'tts') },
      }));

    await fc.assert(
      fc.asyncProperty(requestWithAssetArb, async (request) => {
        const cacheStore = new MockCacheStore();
        const mockService = new MockAIService();
        const gateway = createGateway(cacheStore, mockService);

        // First call — generates asset
        const firstResponse = await gateway.process(request);
        expect(firstResponse.cached).toBe(false);
        expect(firstResponse.s3AssetKey).toBeDefined();

        // Second call — returns cached with same s3AssetKey
        const secondResponse = await gateway.process(request);
        expect(secondResponse.cached).toBe(true);
        expect(secondResponse.s3AssetKey).toBe(firstResponse.s3AssetKey);
      }),
      { numRuns: 50 },
    );
  });
});
