/**
 * RevisionEngine - Generates revision questions, scores answers, and tracks
 * revision session performance.
 *
 * Implements Task 8.1 from the spec.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3
 */

import { randomUUID } from 'crypto';
import { ContentStore } from './contentStore';

// --- Interfaces ---

/** A revision session tracking questions, answers, and status */
export interface RevisionSession {
  id: string;
  learnerId: string;
  chapterId: string;
  questions: RevisionQuestion[];
  answers: RevisionAnswer[];
  status: 'active' | 'completed';
  startedAt: Date;
  completedAt: Date | null;
}

/** A generated revision question */
export interface RevisionQuestion {
  id: string;
  text: string;
  category: 'recall' | 'understanding' | 'application';
  expectedAnswer: string;
}

/** A submitted and scored answer */
export interface RevisionAnswer {
  questionId: string;
  answerText: string;
  score: number;
  feedback: string;
  submittedAt: Date;
}

/** Summary of a revision session's performance */
export interface RevisionSummary {
  sessionId: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  percentageScore: number;
  timeTakenMs: number;
  weakAreas: string[];
  perQuestionResults: { questionId: string; score: number; category: string }[];
}

/** Marker returned when a session is already completed */
export interface SessionCompletedError {
  error: 'SESSION_COMPLETED';
  message: string;
}

// --- Store ---

const revisionStore = new Map<string, RevisionSession>();

/**
 * Clear the revision store for test isolation.
 */
export function clearRevisionStore(): void {
  revisionStore.clear();
}

// --- Shared ContentStore instance ---

let contentStoreInstance: ContentStore | null = null;

/**
 * Set the ContentStore instance used by the RevisionEngine.
 * Must be called before starting sessions.
 */
export function setContentStore(store: ContentStore): void {
  contentStoreInstance = store;
}

/**
 * Get or create the default ContentStore instance.
 */
function getContentStore(): ContentStore {
  if (!contentStoreInstance) {
    contentStoreInstance = new ContentStore();
  }
  return contentStoreInstance;
}

// --- Question Generation ---

/** Question templates organized by category */
const QUESTION_TEMPLATES: Record<
  'recall' | 'understanding' | 'application',
  Array<{ prefix: string; suffix: string }>
> = {
  recall: [
    { prefix: 'What is ', suffix: '?' },
    { prefix: 'Define ', suffix: '.' },
    { prefix: 'List the key points about ', suffix: '.' },
    { prefix: 'Name the main concepts related to ', suffix: '.' },
    { prefix: 'What are the facts about ', suffix: '?' },
    { prefix: 'Recall the details of ', suffix: '.' },
    { prefix: 'State the definition of ', suffix: '.' },
  ],
  understanding: [
    { prefix: 'Explain why ', suffix: ' is important.' },
    { prefix: 'Describe how ', suffix: ' works.' },
    { prefix: 'Compare and contrast ', suffix: '.' },
    { prefix: 'Summarize the concept of ', suffix: '.' },
    { prefix: 'What is the significance of ', suffix: '?' },
    { prefix: 'How does ', suffix: ' relate to the topic?' },
    { prefix: 'In your own words, explain ', suffix: '.' },
  ],
  application: [
    { prefix: 'Give an example of how ', suffix: ' can be applied.' },
    { prefix: 'How would you use ', suffix: ' in practice?' },
    { prefix: 'Solve the following problem related to ', suffix: '.' },
    { prefix: 'Apply the concept of ', suffix: ' to a real scenario.' },
    { prefix: 'Demonstrate your understanding of ', suffix: ' with an example.' },
    { prefix: 'What would happen if ', suffix: ' were changed?' },
    { prefix: 'Design a solution using ', suffix: '.' },
  ],
};

/**
 * Extract keywords/concepts from chapter text for question generation.
 * Uses a deterministic approach based on text content.
 */
function extractConcepts(text: string): string[] {
  // Split text into sentences, then extract meaningful phrases
  const sentences = text
    .replace(/[.!?]+/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  // Extract noun phrases and key terms (simple heuristic: words >4 chars)
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((w) => w.length > 4);

  // Deduplicate and create concepts from unique meaningful words
  const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];

  // Create phrases from consecutive words for richer concepts
  const concepts: string[] = [];
  for (let i = 0; i < sentences.length && concepts.length < 30; i++) {
    const sentence = sentences[i];
    if (sentence.length > 10 && sentence.length < 100) {
      concepts.push(sentence);
    }
  }

  // Add individual words as fallback concepts
  for (const word of uniqueWords.slice(0, 20)) {
    if (!concepts.some((c) => c.toLowerCase().includes(word))) {
      concepts.push(word);
    }
  }

  return concepts;
}

/**
 * Generate a deterministic number of questions (5-20) based on chapter content.
 * Distributes questions across recall, understanding, and application categories.
 */
function generateQuestions(chapterId: string, text: string): RevisionQuestion[] {
  const concepts = extractConcepts(text);

  if (concepts.length < 3) {
    // Not enough content for meaningful questions
    return [];
  }

  // Determine question count: at least 5, at most 20, proportional to content
  const questionCount = Math.max(5, Math.min(20, Math.floor(concepts.length * 0.6)));

  // Distribute across categories: roughly equal with at least 1 per category
  const categories: Array<'recall' | 'understanding' | 'application'> = [];
  const perCategory = Math.floor(questionCount / 3);
  const remainder = questionCount % 3;

  for (let i = 0; i < perCategory + (remainder > 0 ? 1 : 0); i++) {
    categories.push('recall');
  }
  for (let i = 0; i < perCategory + (remainder > 1 ? 1 : 0); i++) {
    categories.push('understanding');
  }
  for (let i = 0; i < perCategory; i++) {
    categories.push('application');
  }

  const questions: RevisionQuestion[] = [];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const concept = concepts[i % concepts.length];
    const templates = QUESTION_TEMPLATES[category];
    const template = templates[i % templates.length];

    questions.push({
      id: randomUUID(),
      text: `${template.prefix}${concept}${template.suffix}`,
      category,
      expectedAnswer: concept,
    });
  }

  return questions;
}

// --- Core Functions ---

/**
 * Start a new revision session for a learner on a chapter.
 * Generates 5-20 questions distributed across recall/understanding/application.
 *
 * Returns null if the chapter doesn't exist or has insufficient content.
 */
export function startRevisionSession(
  learnerId: string,
  chapterId: string
): RevisionSession | null {
  const store = getContentStore();
  const chapter = store.getChapter(chapterId);

  // If no chapter exists, insufficient content
  if (!chapter) {
    return null;
  }

  // Check if chapter has enough content for question generation
  const text = chapter.extractedText || '';
  if (text.trim().length < 20) {
    return null;
  }

  const questions = generateQuestions(chapterId, text);

  // If we couldn't generate enough questions, return null
  if (questions.length < 5) {
    return null;
  }

  const session: RevisionSession = {
    id: randomUUID(),
    learnerId,
    chapterId,
    questions,
    answers: [],
    status: 'active',
    startedAt: new Date(),
    completedAt: null,
  };

  revisionStore.set(session.id, session);
  return session;
}

/**
 * Submit an answer for a question in a revision session.
 *
 * Returns the scored answer, or null if the session doesn't exist.
 * Returns a SessionCompletedError if the session is already completed.
 */
export function submitAnswer(
  sessionId: string,
  questionId: string,
  answer: string
): RevisionAnswer | null | SessionCompletedError {
  const session = revisionStore.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.status === 'completed') {
    return {
      error: 'SESSION_COMPLETED',
      message: 'Session already completed',
    };
  }

  // Find the question
  const question = session.questions.find((q) => q.id === questionId);
  if (!question) {
    return null;
  }

  // Check if this question was already answered
  const alreadyAnswered = session.answers.find((a) => a.questionId === questionId);
  if (alreadyAnswered) {
    return alreadyAnswered;
  }

  // Score the answer using keyword matching / string similarity
  const score = scoreAnswer(answer, question.expectedAnswer);
  const feedback = generateFeedback(score, question, answer);

  const revisionAnswer: RevisionAnswer = {
    questionId,
    answerText: answer,
    score,
    feedback,
    submittedAt: new Date(),
  };

  session.answers.push(revisionAnswer);

  // Auto-complete session when all questions are answered
  if (session.answers.length >= session.questions.length) {
    session.status = 'completed';
    session.completedAt = new Date();
  }

  return revisionAnswer;
}

/**
 * Get the performance summary for a revision session.
 *
 * Returns null if the session doesn't exist.
 */
export function getSessionSummary(sessionId: string): RevisionSummary | null {
  const session = revisionStore.get(sessionId);

  if (!session) {
    return null;
  }

  const totalQuestions = session.questions.length;
  const answeredQuestions = session.answers.length;
  const correctAnswers = session.answers.filter((a) => a.score >= 60).length;

  // Calculate percentage score: average of all answer scores relative to total questions
  const totalScore = session.answers.reduce((sum, a) => sum + a.score, 0);
  const percentageScore =
    totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0;

  // Calculate time taken
  const endTime = session.completedAt || new Date();
  const timeTakenMs = endTime.getTime() - session.startedAt.getTime();

  // Identify weak areas: categories where average score < 60
  const categoryScores = new Map<string, { total: number; count: number }>();
  for (const answer of session.answers) {
    const question = session.questions.find((q) => q.id === answer.questionId);
    if (question) {
      const existing = categoryScores.get(question.category) || { total: 0, count: 0 };
      existing.total += answer.score;
      existing.count += 1;
      categoryScores.set(question.category, existing);
    }
  }

  const weakAreas: string[] = [];
  for (const [category, { total, count }] of categoryScores) {
    if (count > 0 && total / count < 60) {
      weakAreas.push(category);
    }
  }

  // Per-question results
  const perQuestionResults = session.answers.map((a) => {
    const question = session.questions.find((q) => q.id === a.questionId);
    return {
      questionId: a.questionId,
      score: a.score,
      category: question?.category || 'unknown',
    };
  });

  return {
    sessionId,
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    percentageScore,
    timeTakenMs,
    weakAreas,
    perQuestionResults,
  };
}

// --- Scoring Helpers ---

/**
 * Score an answer against the expected answer using keyword matching
 * and string similarity. Returns a score from 0-100.
 */
function scoreAnswer(userAnswer: string, expectedAnswer: string): number {
  if (!userAnswer || userAnswer.trim().length === 0) {
    return 0;
  }

  const normalizedUser = userAnswer.toLowerCase().trim();
  const normalizedExpected = expectedAnswer.toLowerCase().trim();

  // Exact match
  if (normalizedUser === normalizedExpected) {
    return 100;
  }

  // Check if the answer contains the expected answer
  if (normalizedUser.includes(normalizedExpected)) {
    return 90;
  }

  // Check if the expected answer contains the user's answer
  if (normalizedExpected.includes(normalizedUser)) {
    return 70;
  }

  // Keyword matching: split expected into words and check how many appear in answer
  const expectedWords = normalizedExpected
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const userWords = normalizedUser.split(/\s+/).filter((w) => w.length > 2);

  if (expectedWords.length === 0) {
    return userWords.length > 0 ? 50 : 0;
  }

  const matchedWords = expectedWords.filter(
    (word) =>
      userWords.some((uw) => uw.includes(word) || word.includes(uw))
  );

  const keywordScore = Math.round((matchedWords.length / expectedWords.length) * 80);

  // Calculate simple character-level similarity as a secondary measure
  const similarity = calculateSimilarity(normalizedUser, normalizedExpected);
  const similarityScore = Math.round(similarity * 60);

  // Return the better of keyword or similarity score
  return Math.min(100, Math.max(keywordScore, similarityScore));
}

/**
 * Calculate a simple similarity ratio between two strings (0-1).
 * Uses longest common subsequence approach (simplified).
 */
function calculateSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  let matches = 0;

  // Count character bigrams in common
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.slice(i, i + 2));
  }

  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.slice(i, i + 2))) {
      matches++;
    }
  }

  const totalBigrams = Math.max(a.length - 1, b.length - 1);
  return totalBigrams > 0 ? matches / totalBigrams : 0;
}

/**
 * Generate helpful feedback based on the score and question.
 */
function generateFeedback(
  score: number,
  question: RevisionQuestion,
  _userAnswer: string
): string {
  if (score >= 90) {
    return 'Excellent! Your answer demonstrates a strong understanding of the concept.';
  }
  if (score >= 70) {
    return 'Good job! Your answer covers most of the key points. Consider including more detail.';
  }
  if (score >= 50) {
    return `Partial answer. The expected response should cover: ${question.expectedAnswer}. Try to be more specific.`;
  }
  if (score >= 30) {
    return `You're on the right track, but your answer needs more detail. Review the concept: ${question.expectedAnswer}.`;
  }
  return `This needs more work. The key concept is: ${question.expectedAnswer}. Please review this topic.`;
}
