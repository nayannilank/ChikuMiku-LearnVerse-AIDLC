/**
 * Unit tests for Dashboard utility functions and component logic.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8, 6.9
 */

import { describe, it, expect } from 'vitest';
import { truncateName, formatDate } from './Dashboard';

describe('Dashboard - truncateName', () => {
  it('returns names shorter than 30 chars unchanged', () => {
    expect(truncateName('Nayan')).toBe('Nayan');
    expect(truncateName('A'.repeat(30))).toBe('A'.repeat(30));
  });

  it('truncates names longer than 30 chars to exactly 30', () => {
    const longName = 'A'.repeat(50);
    const result = truncateName(longName);
    expect(result.length).toBe(30);
    expect(result).toBe('A'.repeat(30));
  });

  it('handles empty string', () => {
    expect(truncateName('')).toBe('');
  });

  it('handles exactly 30 characters', () => {
    const name = 'Abcdefghijklmnopqrstuvwxyz1234';
    expect(name.length).toBe(30);
    expect(truncateName(name)).toBe(name);
  });

  it('handles 31 characters (one over limit)', () => {
    const name = 'Abcdefghijklmnopqrstuvwxyz12345';
    expect(name.length).toBe(31);
    expect(truncateName(name).length).toBe(30);
    expect(truncateName(name)).toBe('Abcdefghijklmnopqrstuvwxyz1234');
  });
});

describe('Dashboard - formatDate', () => {
  it('formats a known date correctly as "Day, DD Month"', () => {
    // Monday, 15 January 2024
    const date = new Date(2024, 0, 15);
    expect(formatDate(date)).toBe('Monday, 15 January');
  });

  it('formats single-digit day without leading zero', () => {
    // Wednesday, 3 July 2024
    const date = new Date(2024, 6, 3);
    expect(formatDate(date)).toBe('Wednesday, 3 July');
  });

  it('formats last day of month', () => {
    // Saturday, 31 December 2022
    const date = new Date(2022, 11, 31);
    expect(formatDate(date)).toBe('Saturday, 31 December');
  });

  it('formats first day of year', () => {
    // Sunday, 1 January 2023
    const date = new Date(2023, 0, 1);
    expect(formatDate(date)).toBe('Sunday, 1 January');
  });

  it('formats February date', () => {
    // Tuesday, 28 February 2023
    const date = new Date(2023, 1, 28);
    expect(formatDate(date)).toBe('Tuesday, 28 February');
  });

  it('includes all parts: day name, numeric day, month name', () => {
    const date = new Date(2024, 5, 20); // Thursday, 20 June 2024
    const result = formatDate(date);
    expect(result).toMatch(/^[A-Z][a-z]+, \d{1,2} [A-Z][a-z]+$/);
  });
});
