import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getQuizHint } from '../quizHintApi';

const VALID_PARAMS = {
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  subject: 'english',
  type: 'fill-blank',
  hasMnemonic: false,
};

const VALID_RESPONSE = {
  encouragement: 'Great try! Butterfly has "butter" in it 🧈',
  extraSentence: 'The butterfly dances in the garden.',
  pronunciationGuide: 'BUT · ter · fly 🦋',
  mnemonic: 'Imagine a stick of butter flying with wings!',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status, body) {
  global.fetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ─── Success cases ───────────────────────────────────────────────────────────

describe('getQuizHint — success', () => {
  it('calls /api/quiz-hint with the correct body shape', async () => {
    mockFetch(200, VALID_RESPONSE);
    await getQuizHint(VALID_PARAMS);

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/quiz-hint');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.word).toBe('butterfly');
    expect(body.chinese).toBe('蝴蝶');
    expect(body.pinyin).toBe('hú dié');
    expect(body.subject).toBe('english');
    expect(body.type).toBe('fill-blank');
    expect(body.hasMnemonic).toBe(false);
  });

  it('returns all parsed fields on success', async () => {
    mockFetch(200, VALID_RESPONSE);
    const result = await getQuizHint(VALID_PARAMS);
    expect(result.encouragement).toBe(VALID_RESPONSE.encouragement);
    expect(result.extraSentence).toBe(VALID_RESPONSE.extraSentence);
    expect(result.pronunciationGuide).toBe(VALID_RESPONSE.pronunciationGuide);
    expect(result.mnemonic).toBe(VALID_RESPONSE.mnemonic);
  });

  it('returns result without mnemonic field when hasMnemonic is true', async () => {
    const responseWithoutMnemonic = {
      encouragement: 'Good try!',
      extraSentence: 'The butterfly is beautiful.',
      pronunciationGuide: 'BUT · ter · fly',
    };
    mockFetch(200, responseWithoutMnemonic);
    const result = await getQuizHint({ ...VALID_PARAMS, hasMnemonic: true });
    expect(result.mnemonic).toBeUndefined();
    expect(result.encouragement).toBeDefined();
  });

  it('valid JSON response missing encouragement field → returns null, no crash', async () => {
    mockFetch(200, { extraSentence: 'test', pronunciationGuide: 'test' });
    const result = await getQuizHint(VALID_PARAMS);
    expect(result).toBeNull();
  });
});

// ─── Error cases ─────────────────────────────────────────────────────────────

describe('getQuizHint — errors', () => {
  it('returns null on 429 (rate limit)', async () => {
    mockFetch(429, { error: 'Too many requests' });
    const result = await getQuizHint(VALID_PARAMS);
    expect(result).toBeNull();
  });

  it('returns null on 500 server error', async () => {
    mockFetch(500, { error: 'Internal server error' });
    const result = await getQuizHint(VALID_PARAMS);
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const result = await getQuizHint(VALID_PARAMS);
    expect(result).toBeNull();
  });

  it('returns null on AbortError (timeout)', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    global.fetch.mockRejectedValue(abortError);
    const result = await getQuizHint(VALID_PARAMS);
    expect(result).toBeNull();
  });
});
