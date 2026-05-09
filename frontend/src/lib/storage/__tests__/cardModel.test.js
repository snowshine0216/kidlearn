import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STREAK,
  cardContentFingerprint,
  createSavedCard,
  migrateCard,
  nextDeckWithMastery,
  nextDeckWithPatchedCard,
  nextStreak,
  parseDeckJson,
  parseStreakJson,
} from '../cardModel';

const baseCard = {
  emoji: '🦋',
  word: ' Butterfly ',
  chinese: ' 蝴蝶 ',
  pinyin: ' hú dié ',
  sentence: 'The <em>butterfly</em> flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: ' English ',
};

describe('cardModel', () => {
  it('migrates old cards with review defaults', () => {
    const migrated = migrateCard({ word: 'cat', subject: 'english' });

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.knewIt).toBeNull();
    expect(migrated.reviewedAt).toBeNull();
    expect(migrated.mastery).toBeNull();
    expect(migrated.reviewCount).toBeNull();
    expect(migrated.lastReviewedAt).toBeNull();
    expect(migrated.nextReviewAt).toBeNull();
    expect(migrated.needsPractice).toBe(false);
    expect(migrated.quizHints).toBeNull();
  });

  it('preserves existing review fields during migration', () => {
    const migrated = migrateCard({
      word: 'cat',
      subject: 'english',
      mastery: 3,
      needsPractice: true,
      nextReviewAt: 123,
    });

    expect(migrated.mastery).toBe(3);
    expect(migrated.needsPractice).toBe(true);
    expect(migrated.nextReviewAt).toBe(123);
  });

  it('creates a saved card with deterministic injected id and time', () => {
    const saved = createSavedCard(baseCard, { id: 'card-1', now: 1000 });

    expect(saved.id).toBe('card-1');
    expect(saved.savedAt).toBe(1000);
    expect(saved.style).toBe('illustrated');
    expect(saved.word).toBe(' Butterfly ');
  });

  it('computes fingerprint from normalized content instead of uuid', () => {
    const a = cardContentFingerprint({ ...baseCard, id: 'a' });
    const b = cardContentFingerprint({ ...baseCard, id: 'b', word: 'butterfly', subject: 'english' });

    expect(a).toBe(b);
    expect(a).toBe('english|butterfly|蝴蝶|hú dié');
  });

  it('keeps distinct fingerprints for distinct subjects', () => {
    const english = cardContentFingerprint({ ...baseCard, subject: 'english' });
    const chinese = cardContentFingerprint({ ...baseCard, subject: 'chinese' });

    expect(english).not.toBe(chinese);
  });

  it('patches a card immutably', () => {
    const deck = [createSavedCard(baseCard, { id: 'card-1', now: 1000 })];
    const next = nextDeckWithPatchedCard(deck, 'card-1', { quizDisabled: true });

    expect(next).not.toBe(deck);
    expect(next[0]).not.toBe(deck[0]);
    expect(next[0].quizDisabled).toBe(true);
    expect(deck[0].quizDisabled).toBeUndefined();
  });

  it('updates mastery on one card immutably', () => {
    const deck = [
      createSavedCard(baseCard, { id: 'card-1', now: 1000 }),
      createSavedCard({ ...baseCard, word: 'cat' }, { id: 'card-2', now: 1000 }),
    ];
    const next = nextDeckWithMastery(deck, 'card-1', false);

    expect(next[0].needsPractice).toBe(true);
    expect(next[0].reviewCount).toBe(1);
    expect(next[1]).toBe(deck[1]);
  });

  it('parses invalid deck json as an empty deck', () => {
    expect(parseDeckJson('not-json')).toEqual([]);
  });

  it('parses missing streak as default streak', () => {
    expect(parseStreakJson(null)).toEqual(DEFAULT_STREAK);
  });

  it('computes next streak for same day, yesterday, and stale dates', () => {
    const now = new Date('2026-05-09T10:00:00+08:00').getTime();

    expect(nextStreak({ count: 2, lastDate: '2026-05-09' }, now)).toEqual({ count: 2, lastDate: '2026-05-09' });
    expect(nextStreak({ count: 2, lastDate: '2026-05-08' }, now)).toEqual({ count: 3, lastDate: '2026-05-09' });
    expect(nextStreak({ count: 2, lastDate: '2026-05-01' }, now)).toEqual({ count: 1, lastDate: '2026-05-09' });
  });
});
