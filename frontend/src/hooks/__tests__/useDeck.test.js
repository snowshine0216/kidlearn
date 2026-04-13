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

  it('addCard returns the saved card object with an id', () => {
    const { result } = renderHook(() => useDeck());
    let saved;
    act(() => { saved = result.current.addCard(mockCard); });
    expect(saved).toBeTruthy();
    expect(typeof saved.id).toBe('string');
    expect(saved.word).toBe('butterfly');
    expect(saved.id).toBe(result.current.deck[0].id);
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

  it('updateCardMastery updates mastery on the correct card and persists', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.addCard(mockCard); });
    const id = result.current.deck[0].id;
    act(() => { result.current.updateCardMastery(id, true); });
    const updated = result.current.deck[0];
    expect(updated.mastery).toBe(1);
    expect(updated.reviewCount).toBe(1);
    expect(updated.lastReviewedAt).not.toBeNull();
    const stored = JSON.parse(localStorage.getItem('starcards_deck'));
    expect(stored[0].mastery).toBe(1);
  });

  it('updateCardMastery leaves other cards unchanged', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.addCard(mockCard); });
    act(() => { result.current.addCard({ ...mockCard, word: 'cat' }); });
    const [id1] = result.current.deck.map((c) => c.id);
    act(() => { result.current.updateCardMastery(id1, false); });
    const unchanged = result.current.deck.find((c) => c.id !== id1);
    expect(unchanged.mastery).toBeNull();
  });

  it('patchCard merges fields onto the correct card and persists', () => {
    const { result } = renderHook(() => useDeck());
    act(() => { result.current.addCard(mockCard); });
    const id = result.current.deck[0].id;
    act(() => { result.current.patchCard(id, { mnemonic: 'updated mnemonic', quizHints: { pronunciation: { encouragement: 'Good!' } } }); });
    const updated = result.current.deck[0];
    expect(updated.mnemonic).toBe('updated mnemonic');
    expect(updated.quizHints.pronunciation.encouragement).toBe('Good!');
    expect(updated.word).toBe('butterfly'); // existing fields preserved
    const stored = JSON.parse(localStorage.getItem('starcards_deck'));
    expect(stored[0].mnemonic).toBe('updated mnemonic');
  });
});
