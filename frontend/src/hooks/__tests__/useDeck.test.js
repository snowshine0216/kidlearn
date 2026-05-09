import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDeck } from '../useDeck';

vi.mock('../../lib/storage/storageAdapter', () => ({
  createStorageAdapter: vi.fn(),
}));

import { createStorageAdapter } from '../../lib/storage/storageAdapter';

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

const makeAdapter = () => {
  let deck = [];
  let streak = { count: 0, lastDate: null };

  return {
    kind: 'localStorage',
    load: vi.fn(async () => ({ deck, streak })),
    refresh: vi.fn(async () => ({ deck, streak })),
    addCard: vi.fn(async (card) => {
      const saved = { ...card, id: 'card-1', savedAt: 1000 };
      deck = [saved, ...deck];
      return { deck, card: saved };
    }),
    deleteCard: vi.fn(async (id) => {
      deck = deck.filter((card) => card.id !== id);
      return { deck };
    }),
    reportCard: vi.fn(async (id, knewIt) => {
      deck = deck.map((card) => (card.id === id ? { ...card, knewIt, reviewedAt: 1000 } : card));
      streak = { count: 1, lastDate: '2026-05-09' };
      return { deck, streak };
    }),
    touchStreak: vi.fn(async () => {
      streak = { count: 1, lastDate: '2026-05-09' };
      return { streak };
    }),
    updateCardMastery: vi.fn(async (id, correct) => {
      deck = deck.map((card) => (card.id === id ? { ...card, needsPractice: !correct } : card));
      return { deck };
    }),
    patchCard: vi.fn(async (id, fields) => {
      deck = deck.map((card) => (card.id === id ? { ...card, ...fields } : card));
      return { deck };
    }),
  };
};

describe('useDeck', () => {
  let adapter;

  beforeEach(() => {
    adapter = makeAdapter();
    createStorageAdapter.mockResolvedValue(adapter);
  });

  it('loads deck and streak from selected adapter', async () => {
    const { result } = renderHook(() => useDeck());

    await waitFor(() => expect(result.current.storageReady).toBe(true));

    expect(result.current.deck).toEqual([]);
    expect(result.current.streak).toEqual({ count: 0, lastDate: null });
    expect(adapter.load).toHaveBeenCalled();
  });

  it('addCard persists through adapter and returns saved card', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    let saved;
    await act(async () => { saved = await result.current.addCard(mockCard); });

    expect(saved.id).toBe('card-1');
    expect(result.current.deck).toHaveLength(1);
  });

  it('deleteCard updates state from adapter response', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));
    await act(async () => { await result.current.addCard(mockCard); });

    await act(async () => { await result.current.deleteCard('card-1'); });

    expect(result.current.deck).toEqual([]);
  });

  it('patchCard merges fields through adapter', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));
    await act(async () => { await result.current.addCard(mockCard); });

    await act(async () => { await result.current.patchCard('card-1', { quizDisabled: true }); });

    expect(result.current.deck[0].quizDisabled).toBe(true);
  });

  it('updateCardMastery updates deck through adapter', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));
    await act(async () => { await result.current.addCard(mockCard); });

    await act(async () => { await result.current.updateCardMastery('card-1', false); });

    expect(result.current.deck[0].needsPractice).toBe(true);
  });

  it('touchStreak updates streak through adapter', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    await act(async () => { await result.current.touchStreak(); });

    expect(result.current.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });

  it('shows toast and keeps state when adapter write fails', async () => {
    const showToast = vi.fn();
    adapter.addCard.mockResolvedValueOnce({ error: 'database locked' });
    const { result } = renderHook(() => useDeck(showToast));
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    let saved;
    await act(async () => { saved = await result.current.addCard(mockCard); });

    expect(saved).toBe(false);
    expect(result.current.deck).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('database locked');
  });
});
