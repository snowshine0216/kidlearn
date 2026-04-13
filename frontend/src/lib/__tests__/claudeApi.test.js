import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// generateCard tests use dynamic import so each test gets a fresh module
// (lastCallTime is module-level state; resetting the module resets it to 0)
describe('generateCard', () => {
  let generateCard;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('../claudeApi.js');
    generateCard = mod.generateCard;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws error for empty input after sanitization', async () => {
    await expect(generateCard('', 'english')).rejects.toThrow(/enter a word/i);
  });

  it('throws error for whitespace-only input', async () => {
    await expect(generateCard('   ', 'english')).rejects.toThrow(/enter a word/i);
  });

  it('returns parsed card on 200', async () => {
    const card = { word: 'butterfly', emoji: '🦋', color_theme: 'purple', sentence: 'The butterfly flew over the colorful flowers.' };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => card });
    const result = await generateCard('butterfly', 'english');
    expect(result).toEqual(card);
  });

  it('sends sanitized word to /api/generate', async () => {
    const validCard = { word: 'butterfly', emoji: '🦋', color_theme: 'purple', sentence: 'A sentence.' };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validCard });
    await generateCard('  butterfly  ', 'english');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.word).toBe('butterfly');
    expect(body.subject).toBe('english');
  });

  it('returns null within 1-second cooldown', async () => {
    const validCard = { word: 'butterfly', emoji: '🦋', color_theme: 'purple', sentence: 'A sentence.' };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => validCard });
    await generateCard('butterfly', 'english'); // sets lastCallTime
    const result = await generateCard('rose', 'english'); // within 1s
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws friendly 401 message', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 401, json: async () => ({}),
    });
    await expect(generateCard('butterfly', 'english')).rejects.toThrow(/API key invalid/i);
  });

  it('throws friendly 429 message', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 429, json: async () => ({}),
    });
    await expect(generateCard('butterfly', 'english')).rejects.toThrow(/too many requests/i);
  });

  it('throws friendly 500+ message', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({}),
    });
    await expect(generateCard('butterfly', 'english')).rejects.toThrow(/unavailable/i);
  });

  it('uses server error message as fallback for unrecognized status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: 'bad word' }),
    });
    await expect(generateCard('butterfly', 'english')).rejects.toThrow('bad word');
  });

  it('throws if response is missing required fields', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ word: 'test', emoji: '🧪' }), // missing sentence + color_theme
    });
    await expect(generateCard('test', 'english')).rejects.toThrow('AI returned incomplete card');
  });
});
