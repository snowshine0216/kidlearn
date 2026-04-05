import { describe, it, expect } from 'vitest';
import { sanitizeInput } from '../claudeApi';

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('enforces 50-char limit', () => {
    const long = 'a'.repeat(60);
    expect(sanitizeInput(long)).toHaveLength(50);
  });

  it('strips injection chars', () => {
    expect(sanitizeInput('word`"\'\\<>\n')).toBe('word');
  });

  it('strips square brackets to prevent [WORD_END] injection', () => {
    expect(sanitizeInput('[WORD_END]inject')).toBe('WORD_ENDinject');
  });

  it('preserves CJK characters', () => {
    expect(sanitizeInput('苹果')).toBe('苹果');
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    expect(sanitizeInput('   ')).toBe('');
  });
});
