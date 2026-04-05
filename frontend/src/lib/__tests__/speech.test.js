import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Each test gets a fresh module instance so audioCache is empty (no cross-test pollution).
let speak;
let speakCard;
let speakCardFull;

beforeEach(async () => {
  vi.resetModules();

  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('Audio', vi.fn(() => ({ play: vi.fn().mockResolvedValue(undefined) })));
  vi.stubGlobal('speechSynthesis', { speak: vi.fn() });
  // jsdom doesn't provide SpeechSynthesisUtterance — stub it
  vi.stubGlobal('SpeechSynthesisUtterance', vi.fn(() => ({ lang: '', rate: 0 })));

  const mod = await import('../speech.js');
  speak = mod.speak;
  speakCard = mod.speakCard;
  speakCardFull = mod.speakCardFull;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('speak', () => {
  it('returns early without fetching when text is empty', async () => {
    await speak('', 'zh');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches /api/speak and plays Audio on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audio: 'base64audio' }),
    });

    await speak('苹果', 'zh');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/speak',
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.Audio).toHaveBeenCalledWith('data:audio/mp3;base64,base64audio');
  });

  it('caches audio so second call skips fetch', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ audio: 'cached-audio' }),
    });

    await speak('hello-cache', 'en');
    await speak('hello-cache', 'en');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to SpeechSynthesis when fetch throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));

    await speak('fallback-network', 'zh');

    expect(global.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('falls back to SpeechSynthesis when response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });

    await speak('fallback-error', 'zh');

    expect(global.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('does not call SpeechSynthesis when audio plays successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audio: 'some-audio' }),
    });

    await speak('success-audio', 'zh');

    expect(global.speechSynthesis.speak).not.toHaveBeenCalled();
  });
});

describe('speakCard', () => {
  it('calls speak with word and "en" immediately', async () => {
    global.fetch.mockResolvedValue({ ok: false });

    await speakCard('butterfly', 'hú dié');

    const enCall = global.fetch.mock.calls.find((c) => {
      const body = JSON.parse(c[1].body);
      return body.lang === 'en';
    });
    expect(enCall).toBeTruthy();
    expect(JSON.parse(enCall[1].body).text).toBe('butterfly');
  });

  it('registers a 1400ms timeout for pinyin and fires speak', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    await speakCard('butterfly', 'hú dié');

    // setTimeout should have been called once for the pinyin delay
    const [callback, delay] = setTimeoutSpy.mock.calls[0];
    expect(delay).toBe(1400);

    // Invoke the callback directly to trigger speak(pinyin, 'zh')
    callback();

    const zhCall = global.fetch.mock.calls.find((c) => {
      const body = JSON.parse(c[1].body);
      return body.lang === 'zh';
    });
    expect(zhCall).toBeTruthy();
    expect(JSON.parse(zhCall[1].body).text).toBe('hú dié');

    setTimeoutSpy.mockRestore();
  });

  it('skips pinyin speak when pinyin is empty', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    await speakCard('butterfly', '');

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});

describe('speakCardFull', () => {
  // Helper: invoke all registered setTimeout callbacks immediately
  function flushTimers(setTimeoutSpy) {
    setTimeoutSpy.mock.calls.forEach(([cb]) => cb());
  }

  it('English card: speaks word in en, schedules Chinese at 1400ms, pinyin at 3200ms', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'english', word: 'butterfly', chinese: '蝴蝶', pinyin: 'hú dié' };
    await speakCardFull(card);

    // Immediate fetch: English word
    const enCall = global.fetch.mock.calls.find(c => JSON.parse(c[1].body).lang === 'en');
    expect(enCall).toBeTruthy();
    expect(JSON.parse(enCall[1].body).text).toBe('butterfly');

    // setTimeout delays
    const delays = setTimeoutSpy.mock.calls.map(([, d]) => d);
    expect(delays).toContain(1400);
    expect(delays).toContain(3200);

    // Fire callbacks and check Chinese + pinyin are fetched
    flushTimers(setTimeoutSpy);
    const zhCalls = global.fetch.mock.calls.filter(c => JSON.parse(c[1].body).lang === 'zh');
    const texts = zhCalls.map(c => JSON.parse(c[1].body).text);
    expect(texts).toContain('蝴蝶');
    expect(texts).toContain('hú dié');

    setTimeoutSpy.mockRestore();
  });

  it('English card (no chinese, has pinyin): schedules pinyin at 1400ms only', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'english', word: 'butterfly', chinese: null, pinyin: 'hú dié' };
    await speakCardFull(card);

    const delays = setTimeoutSpy.mock.calls.map(([, d]) => d);
    expect(delays).toContain(1400);
    expect(delays).not.toContain(3200);

    flushTimers(setTimeoutSpy);
    const zhCalls = global.fetch.mock.calls.filter(c => JSON.parse(c[1].body).lang === 'zh');
    expect(zhCalls).toHaveLength(1);
    expect(JSON.parse(zhCalls[0][1].body).text).toBe('hú dié');

    setTimeoutSpy.mockRestore();
  });

  it('English card (no chinese, no pinyin): no setTimeout calls', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'english', word: 'butterfly', chinese: null, pinyin: null };
    await speakCardFull(card);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('Chinese card (2-syllable pinyin + word): correct schedule including English at end', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'chinese', chinese: '苹果', word: 'apple', pinyin: 'píng guǒ' };
    await speakCardFull(card);

    // Immediate fetch: Chinese characters
    const zhImmediate = global.fetch.mock.calls.find(c => JSON.parse(c[1].body).lang === 'zh');
    expect(zhImmediate).toBeTruthy();
    expect(JSON.parse(zhImmediate[1].body).text).toBe('苹果');

    // Expected setTimeout delays:
    // 900: full pinyin, 1600: syl 0, 2250: syl 1, 3100: English (offset=2900+200)
    const delays = setTimeoutSpy.mock.calls.map(([, d]) => d);
    expect(delays).toContain(900);   // full pinyin
    expect(delays).toContain(1600);  // syllable 0
    expect(delays).toContain(2250);  // syllable 1
    expect(delays).toContain(3100);  // English word

    // Fire callbacks and verify English is fetched
    flushTimers(setTimeoutSpy);
    const enCalls = global.fetch.mock.calls.filter(c => JSON.parse(c[1].body).lang === 'en');
    expect(enCalls).toHaveLength(1);
    expect(JSON.parse(enCalls[0][1].body).text).toBe('apple');

    setTimeoutSpy.mockRestore();
  });

  it('Chinese card (has pinyin, no word): no English setTimeout', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'chinese', chinese: '苹果', word: null, pinyin: 'píng guǒ' };
    await speakCardFull(card);

    flushTimers(setTimeoutSpy);
    const enCalls = global.fetch.mock.calls.filter(c => JSON.parse(c[1].body).lang === 'en');
    expect(enCalls).toHaveLength(0);

    setTimeoutSpy.mockRestore();
  });

  it('Chinese card (no pinyin, has word): English scheduled at 1200ms', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'chinese', chinese: '苹果', word: 'apple', pinyin: null };
    await speakCardFull(card);

    const delays = setTimeoutSpy.mock.calls.map(([, d]) => d);
    expect(delays).toContain(1200);

    flushTimers(setTimeoutSpy);
    const enCalls = global.fetch.mock.calls.filter(c => JSON.parse(c[1].body).lang === 'en');
    expect(enCalls).toHaveLength(1);
    expect(JSON.parse(enCalls[0][1].body).text).toBe('apple');

    setTimeoutSpy.mockRestore();
  });

  it('Chinese card (no pinyin, no word): no setTimeout calls', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    global.fetch.mockResolvedValue({ ok: false });

    const card = { subject: 'chinese', chinese: '苹果', word: null, pinyin: null };
    await speakCardFull(card);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
