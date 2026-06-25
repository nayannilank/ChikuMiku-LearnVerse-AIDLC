/**
 * Unit tests for ExerciseAssistant — calculateScore helper.
 *
 * Validates: Requirements 11.10 (completion summary: correct/total)
 */

import { describe, it, expect } from 'vitest';
import { calculateScore } from './ExerciseAssistant';

describe('ExerciseAssistant - calculateScore', () => {
  it('returns 0/0 for an empty map', () => {
    const states = new Map();
    expect(calculateScore(states)).toEqual({ correct: 0, total: 0 });
  });

  it('returns 0/0 for exercises not yet submitted', () => {
    const states = new Map([
      ['ex1', {
        answer: 'hello',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: null,
        evaluationLoading: false,
        attemptCount: 0,
        submitted: false,
      }],
    ]);
    expect(calculateScore(states)).toEqual({ correct: 0, total: 0 });
  });

  it('counts correct answers', () => {
    const states = new Map([
      ['ex1', {
        answer: 'a',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: true, score: 1, feedback: 'Good', referencedSection: undefined },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
      ['ex2', {
        answer: 'b',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: true, score: 1, feedback: 'Correct', referencedSection: undefined },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
    ]);
    expect(calculateScore(states)).toEqual({ correct: 2, total: 2 });
  });

  it('counts incorrect answers separately from correct', () => {
    const states = new Map([
      ['ex1', {
        answer: 'a',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: true, score: 1, feedback: 'Good', referencedSection: undefined },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
      ['ex2', {
        answer: 'wrong',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: false, score: 0, feedback: 'Wrong', referencedSection: 'Chapter 1' },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
      ['ex3', {
        answer: 'c',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: true, score: 1, feedback: 'Correct', referencedSection: undefined },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
    ]);
    expect(calculateScore(states)).toEqual({ correct: 2, total: 3 });
  });

  it('only counts submitted exercises with evaluations', () => {
    const states = new Map([
      ['ex1', {
        answer: 'a',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: true, score: 1, feedback: 'Good', referencedSection: undefined },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
      ['ex2', {
        answer: '',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: null,
        evaluationLoading: false,
        attemptCount: 0,
        submitted: false,
      }],
      ['ex3', {
        answer: 'x',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: null,
        evaluationLoading: true,
        attemptCount: 0,
        submitted: true, // submitted but no evaluation yet
      }],
    ]);
    expect(calculateScore(states)).toEqual({ correct: 1, total: 1 });
  });

  it('handles all-incorrect scenario', () => {
    const states = new Map([
      ['ex1', {
        answer: 'wrong1',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: false, score: 0, feedback: 'Nope', referencedSection: 'Section A' },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
      ['ex2', {
        answer: 'wrong2',
        selectedOption: null,
        hint: null,
        hintLoading: false,
        evaluation: { isCorrect: false, score: 0, feedback: 'Nope', referencedSection: 'Section B' },
        evaluationLoading: false,
        attemptCount: 1,
        submitted: true,
      }],
    ]);
    expect(calculateScore(states)).toEqual({ correct: 0, total: 2 });
  });
});
