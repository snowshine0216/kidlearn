import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeck } from '../useDeck';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockCard = {
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The butterfly flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
};

describe('useDeck', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('starts with empty deck', () => {
    const { result } = renderHook(() => useDeck());
    expect(result.current.deck).toHaveLength(0);
  });

  it('addCard persists to localStorage', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.addCard(mockCard); });
    expect(result.current.deck).toHaveLength(1);
    const stored = JSON.parse(localStorage.getItem('starcards_deck'));
    expect(stored).toHaveLength(1);
    expect(stored[0].word).toBe('butterfly');
  });

  it('deleteCard removes card', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.addCard(mockCard); });
    const id = result.current.deck[0].id;
    act(() => { result.current.deleteCard(id); });
    expect(result.current.deck).toHaveLength(0);
  });

  it('returns empty array on JSON.parse failure', () => {
    localStorageMock.setItem('starcards_deck', 'not-valid-json{{{');
    const { result } = renderHook(() => useDeck());
    expect(result.current.deck).toEqual([]);
  });

  it('QuotaExceededError calls showToast', () => {
    const showToast = vi.fn();
    const origSet = localStorageMock.setItem;
    localStorageMock.setItem = (key) => {
      if (key === 'starcards_deck') {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
    };
    const { result } = renderHook(() => useDeck(showToast));
    act(() => { result.current.addCard(mockCard); });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('full'));
    localStorageMock.setItem = origSet;
  });

  it('addCard rejects at 500-card limit', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useDeck(showToast));
    // Pre-fill 500 cards directly in localStorage
    const cards = Array.from({ length: 500 }, (_, i) => ({
      ...mockCard, id: `card-${i}`, schemaVersion: 1, savedAt: Date.now(),
    }));
    localStorageMock.setItem('starcards_deck', JSON.stringify(cards));
    // Re-render so hook sees the 500 cards
    const { result: result2 } = renderHook(() => useDeck(showToast));
    let success;
    act(() => { success = result2.current.addCard(mockCard); });
    expect(success).toBe(false);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('500'));
  });

  it('reportCard updates knewIt and reviewedAt on the card', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.addCard(mockCard); });
    const id = result.current.deck[0].id;
    act(() => { result.current.reportCard(id, true); });
    expect(result.current.deck[0].knewIt).toBe(true);
    expect(result.current.deck[0].reviewedAt).not.toBeNull();
  });

  it('touchStreak increments streak on first call (new day)', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.touchStreak(); });
    expect(result.current.streak.count).toBeGreaterThanOrEqual(1);
    expect(result.current.streak.lastDate).not.toBeNull();
  });

  it('touchStreak does not double-count same day', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.touchStreak(); });
    const countAfterFirst = result.current.streak.count;
    act(() => { result.current.touchStreak(); });
    expect(result.current.streak.count).toBe(countAfterFirst);
  });
});
