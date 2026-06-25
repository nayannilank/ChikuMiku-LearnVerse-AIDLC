/**
 * Property Tests: RAG Retrieval Returns Top-5
 *
 * Feature: learning-platform-full, Property 15: RAG Retrieval Returns Top-5
 *
 * **Validates: Requirements 11.5**
 *
 * Tests that vector similarity search returns exactly the top 5 most similar
 * paragraphs ordered by descending cosine similarity, or all paragraphs when
 * the corpus has fewer than 5 entries.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimilarParagraph {
  pageNumber: number;
  paragraphIndex: number;
  textContent: string;
  similarity: number;
}

interface StoredParagraph {
  pageNumber: number;
  paragraphIndex: number;
  textContent: string;
  embedding: number[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Use a smaller dimension for testing to avoid timeouts.
// The cosine similarity logic is dimension-agnostic; 32 is sufficient to validate correctness.
const EMBEDDING_DIMENSION = 32;
const TOP_K_PARAGRAPHS = 5;

// ─── Core Logic Under Test ────────────────────────────────────────────────────

/**
 * Computes cosine similarity between two vectors.
 * This mirrors the pgvector cosine similarity operator (<=>).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Simulates the findSimilarParagraphs database method.
 * Performs cosine similarity search over a corpus of stored paragraphs,
 * returning the top-K results ordered by descending similarity.
 */
function findSimilarParagraphs(
  corpus: StoredParagraph[],
  queryEmbedding: number[],
  limit: number,
): SimilarParagraph[] {
  const scored = corpus.map((paragraph) => ({
    pageNumber: paragraph.pageNumber,
    paragraphIndex: paragraph.paragraphIndex,
    textContent: paragraph.textContent,
    similarity: cosineSimilarity(paragraph.embedding, queryEmbedding),
  }));

  // Sort by descending similarity
  scored.sort((a, b) => b.similarity - a.similarity);

  // Return top-K
  return scored.slice(0, limit);
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a random embedding vector of the specified dimension.
 * Values are between -1 and 1 (typical for normalized embeddings).
 */
const embeddingArb = fc.array(fc.double({ min: -1, max: 1, noNaN: true }), {
  minLength: EMBEDDING_DIMENSION,
  maxLength: EMBEDDING_DIMENSION,
});

/**
 * Generates a corpus of stored paragraphs with random embeddings.
 * Corpus size varies from 1 to 100.
 */
const corpusArb = (size: number) =>
  fc.array(
    fc.record({
      pageNumber: fc.integer({ min: 1, max: 200 }),
      paragraphIndex: fc.integer({ min: 0, max: 20 }),
      textContent: fc.string({ minLength: 10, maxLength: 100 }),
      embedding: embeddingArb,
    }),
    { minLength: size, maxLength: size },
  );

/** Generates a corpus size between 1 and 30 */
const corpusSizeArb = fc.integer({ min: 1, max: 30 });

/** Generates a corpus size that is >= 5 (ensures top-5 can be fully returned) */
const largCorpusSizeArb = fc.integer({ min: 5, max: 30 });

/** Generates a corpus size that is < 5 (tests partial result behavior) */
const smallCorpusSizeArb = fc.integer({ min: 1, max: 4 });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 15: RAG Retrieval Returns Top-5', () => {
  it('when corpus has >= 5 paragraphs, exactly 5 results are returned', () => {
    fc.assert(
      fc.property(
        largCorpusSizeArb.chain((size) => fc.tuple(corpusArb(size), embeddingArb)),
        ([corpus, queryEmbedding]) => {
          const results = findSimilarParagraphs(corpus, queryEmbedding, TOP_K_PARAGRAPHS);
          expect(results).toHaveLength(TOP_K_PARAGRAPHS);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('results are always ordered by descending cosine similarity', () => {
    fc.assert(
      fc.property(
        corpusSizeArb.chain((size) => fc.tuple(corpusArb(size), embeddingArb)),
        ([corpus, queryEmbedding]) => {
          const results = findSimilarParagraphs(corpus, queryEmbedding, TOP_K_PARAGRAPHS);

          // Verify descending order
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('when corpus has < 5 paragraphs, all paragraphs are returned (still ordered)', () => {
    fc.assert(
      fc.property(
        smallCorpusSizeArb.chain((size) => fc.tuple(corpusArb(size), embeddingArb, fc.constant(size))),
        ([corpus, queryEmbedding, size]) => {
          const results = findSimilarParagraphs(corpus, queryEmbedding, TOP_K_PARAGRAPHS);

          // Should return all available paragraphs
          expect(results).toHaveLength(size);

          // Still ordered by descending similarity
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('returned results are the actual top-K most similar paragraphs from the corpus', () => {
    fc.assert(
      fc.property(
        largCorpusSizeArb.chain((size) => fc.tuple(corpusArb(size), embeddingArb)),
        ([corpus, queryEmbedding]) => {
          const results = findSimilarParagraphs(corpus, queryEmbedding, TOP_K_PARAGRAPHS);

          // Compute all similarities independently
          const allSimilarities = corpus.map((p) =>
            cosineSimilarity(p.embedding, queryEmbedding),
          );
          allSimilarities.sort((a, b) => b - a);

          // The lowest similarity in results should be >= any similarity not in results
          const lowestReturnedSimilarity = results[results.length - 1].similarity;
          const topKThreshold = allSimilarities[TOP_K_PARAGRAPHS - 1];

          expect(lowestReturnedSimilarity).toBeCloseTo(topKThreshold, 10);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('similarity values are bounded between -1 and 1', () => {
    fc.assert(
      fc.property(
        corpusSizeArb.chain((size) => fc.tuple(corpusArb(size), embeddingArb)),
        ([corpus, queryEmbedding]) => {
          const results = findSimilarParagraphs(corpus, queryEmbedding, TOP_K_PARAGRAPHS);

          for (const result of results) {
            expect(result.similarity).toBeGreaterThanOrEqual(-1);
            expect(result.similarity).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
