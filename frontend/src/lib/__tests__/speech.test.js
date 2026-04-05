import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Each test gets a fresh module instance so audioCache is empty (no cross-test pollution).
let speak;
let speakCard;

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
