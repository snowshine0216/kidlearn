import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECK_KEY, STREAK_KEY } from '../cardModel';
import { createLocalStorageAdapter } from '../localStorageAdapter';

const makeStorage = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store = { ...store, [key]: String(value) }; }),
    removeItem: vi.fn((key) => {
      const { [key]: _removed, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => { store = {}; }),
  };
};

const baseCard = {
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The <em>butterfly</em> flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
};

describe('createLocalStorageAdapter', () => {
  let storage;
  let adapter;

  beforeEach(() => {
    storage = makeStorage();
    adapter = createLocalStorageAdapter({
      storage,
      idFactory: () => 'card-1',
      now: () => new Date('2026-05-09T10:00:00+08:00').getTime(),
    });
  });

  it('loads empty deck and default streak', async () => {
    await expect(adapter.load()).resolves.toEqual({
      deck: [],
      streak: { count: 0, lastDate: null },
    });
  });

  it('adds a card and persists deck json', async () => {
    const result = await adapter.addCard(baseCard, []);

    expect(result.card.id).toBe('card-1');
    expect(result.deck).toHaveLength(1);
    expect(JSON.parse(storage.getItem(DECK_KEY))).toHaveLength(1);
  });

  it('rejects deck overflow with the existing user-facing error', async () => {
    const fullDeck = Array.from({ length: 500 }, (_, index) => ({ ...baseCard, id: `card-${index}` }));

    await expect(adapter.addCard(baseCard, fullDeck)).resolves.toEqual({
      error: 'Your deck has 500+ cards! Consider deleting some.',
    });
  });

  it('deletes a card and persists the next deck', async () => {
    const deck = [{ ...baseCard, id: 'card-1' }];

    const result = await adapter.deleteCard('card-1', deck);

    expect(result.deck).toEqual([]);
    expect(JSON.parse(storage.getItem(DECK_KEY))).toEqual([]);
  });

  it('patches a card and preserves existing fields', async () => {
    const deck = [{ ...baseCard, id: 'card-1' }];

    const result = await adapter.patchCard('card-1', { quizDisabled: true }, deck);

    expect(result.deck[0].quizDisabled).toBe(true);
    expect(result.deck[0].word).toBe('butterfly');
  });

  it('updates mastery fields', async () => {
    const deck = [{ ...baseCard, id: 'card-1', mastery: null, reviewCount: null, nextReviewAt: null }];

    const result = await adapter.updateCardMastery('card-1', false, deck);

    expect(result.deck[0].needsPractice).toBe(true);
    expect(result.deck[0].reviewCount).toBe(1);
  });

  it('updates report fields and streak', async () => {
    const deck = [{ ...baseCard, id: 'card-1' }];

    const result = await adapter.reportCard('card-1', true, deck);

    expect(result.deck[0].knewIt).toBe(true);
    expect(result.deck[0].reviewedAt).not.toBeNull();
    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
    expect(JSON.parse(storage.getItem(STREAK_KEY))).toEqual({ count: 1, lastDate: '2026-05-09' });
  });

  it('touches streak without changing deck', async () => {
    const result = await adapter.touchStreak();

    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });
});
