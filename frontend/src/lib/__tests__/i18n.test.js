import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStrings, loadLang, saveLang, DEFAULT_LANG, LANG_KEY } from '../i18n.js';

describe('getStrings', () => {
  it('returns English strings for "en"', () => {
    const t = getStrings('en');
    expect(t.appName).toBe('✦ StarCards');
    expect(t.generate).toBe('✨ Generate Card');
  });

  it('returns Chinese strings for "zh"', () => {
    const t = getStrings('zh');
    expect(t.appName).toBe('✦ 星卡');
    expect(t.generate).toBe('✨ 生成闪卡');
  });

  it('falls back to DEFAULT_LANG for unknown lang', () => {
    expect(getStrings('xx')).toEqual(getStrings(DEFAULT_LANG));
  });

  it('falls back to DEFAULT_LANG for undefined', () => {
    expect(getStrings(undefined)).toEqual(getStrings(DEFAULT_LANG));
  });

  it('streakBadge is a function returning a string', () => {
    const t = getStrings('en');
    expect(t.streakBadge(5)).toBe('🔥 5-day streak');
  });

  it('cardCount is a function returning a string', () => {
    const t = getStrings('en');
    expect(t.cardCount(1)).toBe('⭐ 1 card saved');
    expect(t.cardCount(3)).toBe('⭐ 3 cards saved');
  });
});

describe('loadLang', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns stored value when present', () => {
    localStorage.setItem(LANG_KEY, 'en');
    expect(loadLang()).toBe('en');
  });

  it('returns DEFAULT_LANG when key is absent', () => {
    expect(loadLang()).toBe(DEFAULT_LANG);
  });

  it('returns DEFAULT_LANG when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadLang()).toBe(DEFAULT_LANG);
    spy.mockRestore();
  });
});

describe('quiz strings — chinese-meaning type', () => {
  it('zh: quizPrompt.chineseMeaning exists and is a string', () => {
    const t = getStrings('zh');
    expect(typeof t.quizPrompt.chineseMeaning).toBe('string');
    expect(t.quizPrompt.chineseMeaning.length).toBeGreaterThan(0);
  });

  it('en: quizPrompt.chineseMeaning exists and is a string', () => {
    const t = getStrings('en');
    expect(typeof t.quizPrompt.chineseMeaning).toBe('string');
    expect(t.quizPrompt.chineseMeaning.length).toBeGreaterThan(0);
  });

  it('zh: quizModeLabels.chineseMeaning exists', () => {
    const t = getStrings('zh');
    expect(typeof t.quizModeLabels.chineseMeaning).toBe('string');
  });

  it('en: quizModeLabels.chineseMeaning exists', () => {
    const t = getStrings('en');
    expect(typeof t.quizModeLabels.chineseMeaning).toBe('string');
  });
});

describe('saveLang', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes the lang to localStorage', () => {
    saveLang('en');
    expect(localStorage.getItem(LANG_KEY)).toBe('en');
  });

  it('silently ignores when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => saveLang('en')).not.toThrow();
    spy.mockRestore();
  });
});

describe('quiz count all label', () => {
  it('zh: quizCountAll exists', () => {
    const t = getStrings('zh');
    expect(t.quizCountAll).toBe('全部');
  });

  it('en: quizCountAll exists', () => {
    const t = getStrings('en');
    expect(t.quizCountAll).toBe('All');
  });
});
