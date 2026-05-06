import { describe, it, expect } from 'vitest';
import {
  shuffled,
  isDueCard,
  getDueCards,
  isReviewEligibleCard,
  getReviewEligibleCards,
  getReviewEligibleCardsForSubject,
  resolveQuizCount,
  selectQuizCards,
  buildQuestions,
  buildQuestion,
  pickWrongAnswers,
  buildFillBlankSentence,
  buildZhFillBlankSentence,
  buildHint,
  applyMasteryResult,
  computeNextReviewAt,
  computeSessionScore,
} from '../quizLogic';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const makeCard = (overrides = {}) => ({
  id: 'card-1',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  emoji: '🦋',
  subject: 'english',
  sentence: 'The <em>butterfly</em> flies high.',
  mnemonic: null,
  mascot_message: null,
  mastery: null,
  reviewCount: null,
  lastReviewedAt: null,
  nextReviewAt: null,
  needsPractice: false,
  ...overrides,
});

const makeZhCard = (overrides = {}) => ({
  id: 'zh-1',
  word: '苹果',
  chinese: '苹果',
  pinyin: 'píng guǒ',
  emoji: '🍎',
  subject: 'chinese',
  sentence: null,
  mnemonic: null,
  mascot_message: null,
  mastery: null,
  reviewCount: null,
  lastReviewedAt: null,
  ...overrides,
});

const makeDeck = (n = 10, subject = 'english') =>
  Array.from({ length: n }, (_, i) =>
    makeCard({ id: `card-${i}`, word: `word${i}`, subject })
  );

// ─── shuffled ───────────────────────────────────────────────────────────────

describe('shuffled', () => {
  it('returns an array with the same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffled(arr);
    expect(result).toHaveLength(arr.length);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffled(arr);
    expect(arr).toEqual(copy);
  });

  it('handles empty array', () => {
    expect(shuffled([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffled([42])).toEqual([42]);
  });
});

// ─── isDueCard ──────────────────────────────────────────────────────────────

describe('isDueCard', () => {
  it('returns true when nextReviewAt is null (never reviewed)', () => {
    expect(isDueCard({ nextReviewAt: null })).toBe(true);
  });
  it('returns true when nextReviewAt is in the past', () => {
    expect(isDueCard({ nextReviewAt: Date.now() - 1000 })).toBe(true);
  });
  it('returns false when nextReviewAt is in the future', () => {
    expect(isDueCard({ nextReviewAt: Date.now() + 100000 })).toBe(false);
  });
  it('returns false when nextReviewAt is undefined (test-helper artifact)', () => {
    expect(isDueCard({ nextReviewAt: undefined })).toBe(false);
  });
});

// ─── getDueCards ─────────────────────────────────────────────────────────────

describe('getDueCards', () => {
  it('includes cards with nextReviewAt: null (never reviewed)', () => {
    const card = { id: '1', nextReviewAt: null, savedAt: Date.now() };
    expect(getDueCards([card])).toHaveLength(1);
    expect(getDueCards([card])[0]).toBe(card);
  });
  it('excludes cards with future nextReviewAt', () => {
    const card = { id: '1', nextReviewAt: Date.now() + 100000, savedAt: Date.now() };
    expect(getDueCards([card])).toHaveLength(0);
  });
  it('orders newest savedAt first (different days)', () => {
    const NOW = Date.now();
    const older = { id: '1', nextReviewAt: null, savedAt: NOW - 2 * 86400000 }; // 2 days ago
    const newer = { id: '2', nextReviewAt: null, savedAt: NOW };                 // today
    const result = getDueCards([older, newer]);
    expect(result[0]).toBe(newer);
    expect(result[1]).toBe(older);
  });
  it('cards with same savedAt day are all returned (shuffled within group)', () => {
    const NOW = Date.now();
    const a = { id: '1', nextReviewAt: null, savedAt: NOW - 1000 }; // same day
    const b = { id: '2', nextReviewAt: null, savedAt: NOW - 2000 }; // same day
    const result = getDueCards([a, b]);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([a, b]));
  });
  it('cards with savedAt: undefined fall to epoch day 0 (shown last)', () => {
    const NOW = Date.now();
    const recentCard = { id: '1', nextReviewAt: null, savedAt: NOW };
    const noSavedAt  = { id: '2', nextReviewAt: null, savedAt: undefined };
    const result = getDueCards([noSavedAt, recentCard]);
    expect(result[0]).toBe(recentCard); // recent day comes first
    expect(result[1]).toBe(noSavedAt);  // epoch day 0 comes last
  });
  it('returns empty array for empty deck', () => {
    expect(getDueCards([])).toEqual([]);
  });
  it('returns single due card', () => {
    const card = { id: '1', nextReviewAt: null, savedAt: Date.now() };
    expect(getDueCards([card])).toEqual([card]);
  });
});

// ─── review eligibility ─────────────────────────────────────────────────────

describe('review eligibility', () => {
  const NOW = 1_700_000_000_000;

  it('treats never-reviewed cards as review-eligible', () => {
    const card = makeCard({ mastery: null, nextReviewAt: NOW + 10 * 86400000 });
    expect(isReviewEligibleCard(card, NOW)).toBe(true);
  });

  it('treats overdue cards as review-eligible', () => {
    const card = makeCard({ mastery: 2, nextReviewAt: NOW - 1000 });
    expect(isReviewEligibleCard(card, NOW)).toBe(true);
  });

  it('treats failed cards as review-eligible even when scheduled in the future', () => {
    const card = makeCard({ mastery: 2, nextReviewAt: NOW + 10 * 86400000, needsPractice: true });
    expect(isReviewEligibleCard(card, NOW)).toBe(true);
  });

  it('does not treat low mastery alone as review-eligible', () => {
    const card = makeCard({ mastery: 1, nextReviewAt: NOW + 10 * 86400000, needsPractice: false });
    expect(isReviewEligibleCard(card, NOW)).toBe(false);
  });

  it('excludes quiz-disabled cards from review eligibility', () => {
    const card = makeCard({ mastery: null, nextReviewAt: null, quizDisabled: true });
    expect(isReviewEligibleCard(card, NOW)).toBe(false);
  });

  it('returns review-eligible cards and excludes disabled cards', () => {
    const due = makeCard({ id: 'due', mastery: 2, nextReviewAt: NOW - 1000 });
    const future = makeCard({ id: 'future', mastery: 2, nextReviewAt: NOW + 1000 });
    const failed = makeCard({ id: 'failed', mastery: 2, nextReviewAt: NOW + 1000, needsPractice: true });
    const disabled = makeCard({ id: 'disabled', mastery: null, quizDisabled: true });

    const result = getReviewEligibleCards([future, disabled, failed, due], NOW);
    const ids = result.map(c => c.id);

    expect(ids).toEqual(expect.arrayContaining(['due', 'failed']));
    expect(ids).not.toContain('future');
    expect(ids).not.toContain('disabled');
  });

  it('filters review-eligible cards by subject', () => {
    const english = makeCard({ id: 'en', subject: 'english', mastery: null });
    const chinese = makeZhCard({ id: 'zh', subject: 'chinese', mastery: null, nextReviewAt: null });

    const result = getReviewEligibleCardsForSubject([english, chinese], 'chinese', NOW);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('zh');
  });

  it('resolves all count to the available count', () => {
    expect(resolveQuizCount('all', 7)).toBe(7);
  });

  it('caps numeric count at the available count', () => {
    expect(resolveQuizCount(20, 7)).toBe(7);
  });
});

// ─── selectQuizCards ────────────────────────────────────────────────────────

describe('selectQuizCards', () => {
  it('returns at most count cards', () => {
    const deck = makeDeck(10);
    const result = selectQuizCards(deck, 'english', 5);
    expect(result).toHaveLength(5);
  });

  it('filters by subject', () => {
    const deck = [
      ...makeDeck(5, 'english'),
      ...Array.from({ length: 3 }, (_, i) =>
        makeZhCard({ id: `zh-${i}` })
      ),
    ];
    const result = selectQuizCards(deck, 'chinese', 3);
    expect(result.every(c => c.subject === 'chinese')).toBe(true);
  });

  it('prefers cards with null mastery', () => {
    const now = Date.now();
    const nullMastery = makeCard({ id: 'null-1', mastery: null, nextReviewAt: null });
    const highMastery = makeCard({ id: 'high-1', mastery: 5, nextReviewAt: now + 86400000 });
    const deck = [highMastery, nullMastery];
    const result = selectQuizCards(deck, 'english', 1, now);
    expect(result[0].id).toBe('null-1');
  });

  it('does not include low-mastery cards before their next review time', () => {
    const now = Date.now();
    const lowMasteryFuture = makeCard({ id: 'low-future', mastery: 1, nextReviewAt: now + 86400000 });
    const due = makeCard({ id: 'due', mastery: 3, nextReviewAt: now - 1000 });
    const result = selectQuizCards([lowMasteryFuture, due], 'english', 10, now);
    expect(result.map(c => c.id)).toEqual(['due']);
  });

  it('returns no duplicate cards', () => {
    const deck = makeDeck(5);
    const result = selectQuizCards(deck, 'english', 5);
    const ids = result.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns all available cards if count exceeds deck size', () => {
    const deck = makeDeck(3);
    const result = selectQuizCards(deck, 'english', 10);
    expect(result).toHaveLength(3);
  });

  it('selects only review-eligible cards', () => {
    const now = Date.now();
    const due = makeCard({ id: 'due', mastery: 2, nextReviewAt: now - 1000 });
    const failed = makeCard({ id: 'failed', mastery: 3, nextReviewAt: now + 86400000, needsPractice: true });
    const future = makeCard({ id: 'future', mastery: 3, nextReviewAt: now + 86400000, needsPractice: false });
    const result = selectQuizCards([future, failed, due], 'english', 10, now);
    const ids = result.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['due', 'failed']));
    expect(ids).not.toContain('future');
  });

  it('returns all eligible cards when count is all', () => {
    const now = Date.now();
    const deck = [
      makeCard({ id: 'new-1', mastery: null, nextReviewAt: null }),
      makeCard({ id: 'due-1', mastery: 2, nextReviewAt: now - 1000 }),
      makeCard({ id: 'future-1', mastery: 3, nextReviewAt: now + 86400000 }),
    ];
    const result = selectQuizCards(deck, 'english', 'all', now);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.id)).toEqual(expect.arrayContaining(['new-1', 'due-1']));
  });

  it('returns empty array if no cards match subject', () => {
    const deck = makeDeck(5, 'english');
    const result = selectQuizCards(deck, 'chinese', 5);
    expect(result).toHaveLength(0);
  });

  it('excludes cards with quizDisabled: true', () => {
    const disabled = makeCard({ id: 'disabled', quizDisabled: true });
    const enabled = makeCard({ id: 'enabled', quizDisabled: false });
    const deck = [disabled, enabled];
    const result = selectQuizCards(deck, 'english', 5);
    expect(result.every(c => c.id !== 'disabled')).toBe(true);
    expect(result.some(c => c.id === 'enabled')).toBe(true);
  });

  it('includes cards with quizDisabled: false', () => {
    const deck = [makeCard({ id: 'c1', quizDisabled: false })];
    const result = selectQuizCards(deck, 'english', 5);
    expect(result).toHaveLength(1);
  });

  it('includes cards with quizDisabled: undefined (backward compat)', () => {
    const deck = [makeCard({ id: 'c1' })]; // quizDisabled not set
    const result = selectQuizCards(deck, 'english', 5);
    expect(result).toHaveLength(1);
  });

  it('returns empty array when all matching cards are quizDisabled', () => {
    const deck = [
      makeCard({ id: 'c1', quizDisabled: true }),
      makeCard({ id: 'c2', quizDisabled: true }),
    ];
    const result = selectQuizCards(deck, 'english', 5);
    expect(result).toHaveLength(0);
  });
});

// ─── pickWrongAnswers ────────────────────────────────────────────────────────

describe('pickWrongAnswers', () => {
  it('returns exactly n wrong answers', () => {
    const correct = makeCard({ id: 'correct' });
    const deck = makeDeck(10);
    const wrongs = pickWrongAnswers(correct, deck, 2);
    expect(wrongs).toHaveLength(2);
  });

  it('does not include the correct card', () => {
    const correct = makeCard({ id: 'correct' });
    const deck = [correct, ...makeDeck(5).map((c, i) => ({ ...c, id: `other-${i}` }))];
    const wrongs = pickWrongAnswers(correct, deck, 3);
    expect(wrongs.every(c => c.id !== 'correct')).toBe(true);
  });

  it('returns all available distractors if deck is smaller than n', () => {
    const correct = makeCard({ id: 'correct' });
    const deck = [correct, makeCard({ id: 'other-1' })];
    const wrongs = pickWrongAnswers(correct, deck, 3);
    expect(wrongs).toHaveLength(1);
  });

  it('prefers same-subject distractors', () => {
    const correct = makeCard({ id: 'correct', subject: 'english' });
    const sameSubject = Array.from({ length: 3 }, (_, i) =>
      makeCard({ id: `en-${i}`, subject: 'english' })
    );
    const diffSubject = Array.from({ length: 5 }, (_, i) =>
      makeZhCard({ id: `zh-${i}` })
    );
    const deck = [correct, ...sameSubject, ...diffSubject];
    const wrongs = pickWrongAnswers(correct, deck, 3);
    expect(wrongs.every(c => c.subject === 'english')).toBe(true);
  });
});

// ─── buildFillBlankSentence ──────────────────────────────────────────────────

describe('buildFillBlankSentence', () => {
  it('replaces first <em>word</em> with ___', () => {
    const card = makeCard({ sentence: 'The <em>butterfly</em> flies high.' });
    expect(buildFillBlankSentence(card)).toBe('The ___ flies high.');
  });

  it('only replaces the first <em> tag, strips the rest as text', () => {
    const card = makeCard({
      sentence: 'The <em>butterfly</em> and the <em>bee</em> dance.',
    });
    const result = buildFillBlankSentence(card);
    expect(result).toBe('The ___ and the bee dance.');
  });

  it('returns sentence unchanged if no <em> tag present', () => {
    const card = makeCard({ sentence: 'No em tag here.' });
    expect(buildFillBlankSentence(card)).toBe('No em tag here.');
  });

  it('handles null sentence gracefully', () => {
    const card = makeCard({ sentence: null });
    expect(buildFillBlankSentence(card)).toBe('');
  });
});

// ─── buildZhFillBlankSentence ────────────────────────────────────────────────

describe('buildZhFillBlankSentence', () => {
  it('replaces card.chinese in sentence_zh with ___', () => {
    const card = makeZhCard({ chinese: '苹果', sentence_zh: '我喜欢吃苹果。' });
    expect(buildZhFillBlankSentence(card)).toBe('我喜欢吃___。');
  });

  it('returns empty string if sentence_zh is null', () => {
    const card = makeZhCard({ chinese: '苹果', sentence_zh: null });
    expect(buildZhFillBlankSentence(card)).toBe('');
  });

  it('returns empty string if sentence_zh is empty string', () => {
    const card = makeZhCard({ chinese: '苹果', sentence_zh: '' });
    expect(buildZhFillBlankSentence(card)).toBe('');
  });

  it('returns empty string if card.chinese is null', () => {
    const card = makeZhCard({ chinese: null, sentence_zh: '我喜欢吃苹果。' });
    expect(buildZhFillBlankSentence(card)).toBe('');
  });

  it('replaces only the first occurrence when duplicated', () => {
    const card = makeZhCard({ chinese: '苹果', sentence_zh: '苹果是苹果。' });
    expect(buildZhFillBlankSentence(card)).toBe('___是苹果。');
  });

  it('does not mutate the input card', () => {
    const card = makeZhCard({ chinese: '苹果', sentence_zh: '我喜欢吃苹果。' });
    buildZhFillBlankSentence(card);
    expect(card.sentence_zh).toBe('我喜欢吃苹果。');
  });
});

// ─── buildQuestion ──────────────────────────────────────────────────────────

describe('buildQuestion', () => {
  it('chinese-meaning: creates choices array (multiple choice)', () => {
    const card = makeCard({ id: 'c1', chinese: '蝴蝶', pinyin: 'hú dié' });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'chinese-meaning');
    expect(q.type).toBe('chinese-meaning');
    expect(Array.isArray(q.choices)).toBe(true);
    expect(q.choices.length).toBe(3);
    expect(q.choices.some(c => c.id === card.id)).toBe(true);
  });

  it('chinese-meaning: sentenceWithBlank is null', () => {
    const card = makeCard({ id: 'c1' });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'chinese-meaning');
    expect(q.sentenceWithBlank).toBeNull();
  });

  it('fill-blank: creates choices array', () => {
    const card = makeCard({ id: 'c1', sentence: 'The <em>butterfly</em> flies.' });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'fill-blank');
    expect(q.type).toBe('fill-blank');
    expect(Array.isArray(q.choices)).toBe(true);
  });

  it('pronunciation: choices is null', () => {
    const card = makeCard({ id: 'c1' });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'pronunciation');
    expect(q.choices).toBeNull();
  });

  it('zh-fill-blank: resolves correctly when sentence_zh contains card.chinese', () => {
    const card = makeZhCard({ id: 'zh-1', chinese: '苹果', sentence_zh: '我喜欢吃苹果。' });
    const deck = Array.from({ length: 5 }, (_, i) =>
      makeZhCard({ id: `zh-${i + 2}`, chinese: `字${i}`, pinyin: `pīn${i}` })
    );
    const q = buildQuestion(card, deck, 'zh-fill-blank');
    expect(q.type).toBe('zh-fill-blank');
    expect(Array.isArray(q.choices)).toBe(true);
    expect(q.choices.length).toBe(3);
    expect(q.sentenceWithBlank).toBe('我喜欢吃___。');
  });

  it('zh-fill-blank: falls back to reading when sentence_zh is null', () => {
    const card = makeZhCard({ id: 'zh-1', chinese: '苹果', sentence_zh: null });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'zh-fill-blank');
    expect(q.type).toBe('reading');
    expect(q.choices).toBeNull();
  });

  it('zh-fill-blank: falls back to reading when sentence_zh does not contain card.chinese', () => {
    const card = makeZhCard({ id: 'zh-1', chinese: '苹果', sentence_zh: '我喜欢香蕉。' });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'zh-fill-blank');
    expect(q.type).toBe('reading');
    expect(q.choices).toBeNull();
  });

  it('zh-pinyin: resolves correctly when card.pinyin exists', () => {
    const card = makeZhCard({ id: 'zh-1', chinese: '苹果', pinyin: 'píng guǒ' });
    const deck = Array.from({ length: 5 }, (_, i) =>
      makeZhCard({ id: `zh-${i + 2}`, pinyin: `pīn${i}` })
    );
    const q = buildQuestion(card, deck, 'zh-pinyin');
    expect(q.type).toBe('zh-pinyin');
    expect(Array.isArray(q.choices)).toBe(true);
    expect(q.choices.length).toBe(3);
    expect(q.sentenceWithBlank).toBeNull();
  });

  it('zh-pinyin: falls back to reading when pinyin is null', () => {
    const card = makeZhCard({ id: 'zh-1', pinyin: null });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'zh-pinyin');
    expect(q.type).toBe('reading');
    expect(q.choices).toBeNull();
  });

  it('zh-pinyin: falls back to reading when pinyin is empty string', () => {
    const card = makeZhCard({ id: 'zh-1', pinyin: '' });
    const deck = makeDeck(5);
    const q = buildQuestion(card, deck, 'zh-pinyin');
    expect(q.type).toBe('reading');
    expect(q.choices).toBeNull();
  });

  it('zh-pinyin: distractor choices all have non-empty pinyin', () => {
    const card = makeZhCard({ id: 'zh-1', chinese: '苹果', pinyin: 'píng guǒ' });
    // Deck has some cards with pinyin and some without
    const deck = [
      ...Array.from({ length: 4 }, (_, i) => makeZhCard({ id: `zh-${i + 2}`, pinyin: `pīn${i}` })),
      makeZhCard({ id: 'zh-no-pin', pinyin: null }),
    ];
    const q = buildQuestion(card, deck, 'zh-pinyin');
    expect(q.type).toBe('zh-pinyin');
    expect(q.choices.every(c => c.pinyin?.trim())).toBe(true);
  });
});

// ─── buildHint ──────────────────────────────────────────────────────────────

describe('buildHint', () => {
  it('pronunciation: returns mnemonic preview + first letter', () => {
    const card = makeCard({ mnemonic: 'Imagine butter flying', word: 'butterfly' });
    const hint = buildHint(card, 'pronunciation');
    expect(hint).toContain('b');
    expect(hint).toContain('Imagine butter flying');
  });

  it('pronunciation: works without mnemonic', () => {
    const card = makeCard({ mnemonic: null, word: 'butterfly' });
    const hint = buildHint(card, 'pronunciation');
    expect(typeof hint).toBe('string');
    expect(hint).toContain('b');
  });

  it('fill-blank: returns emoji hint', () => {
    const card = makeCard({ emoji: '🦋', word: 'butterfly' });
    const hint = buildHint(card, 'fill-blank');
    expect(hint).toContain('🦋');
  });

  it('word-meaning: returns pinyin of correct answer', () => {
    const card = makeCard({ pinyin: 'hú dié' });
    const hint = buildHint(card, 'word-meaning');
    expect(hint).toContain('hú dié');
  });

  it('reading: returns pinyin', () => {
    const card = makeZhCard({ pinyin: 'píng guǒ' });
    const hint = buildHint(card, 'reading');
    expect(hint).toContain('píng guǒ');
  });

  it('chinese-meaning: returns pinyin of the card', () => {
    const card = makeCard({ pinyin: 'hú dié' });
    const hint = buildHint(card, 'chinese-meaning');
    expect(typeof hint).toBe('string');
    expect(hint).toContain('hú dié');
  });

  it('chinese-meaning: returns empty string when no pinyin', () => {
    const card = makeCard({ pinyin: null });
    const hint = buildHint(card, 'chinese-meaning');
    expect(hint).toBe('');
  });

  it('zh-fill-blank: returns pinyin as hint', () => {
    const card = makeZhCard({ pinyin: 'píng guǒ' });
    expect(buildHint(card, 'zh-fill-blank')).toBe('píng guǒ');
  });

  it('zh-fill-blank: returns empty string when pinyin is null', () => {
    const card = makeZhCard({ pinyin: null });
    expect(buildHint(card, 'zh-fill-blank')).toBe('');
  });

  it('zh-pinyin: returns English word as hint', () => {
    const card = makeZhCard({ word: 'apple' });
    expect(buildHint(card, 'zh-pinyin')).toBe('apple');
  });

  it('zh-pinyin: returns empty string when word is null', () => {
    const card = makeZhCard({ word: null });
    expect(buildHint(card, 'zh-pinyin')).toBe('');
  });
});

// ─── applyMasteryResult ──────────────────────────────────────────────────────

describe('applyMasteryResult', () => {
  it('increments mastery by 1 on correct answer', () => {
    const card = makeCard({ mastery: 2, reviewCount: 3 });
    const result = applyMasteryResult(card, true);
    expect(result.mastery).toBe(3);
  });

  it('decrements mastery by 1 on wrong answer', () => {
    const card = makeCard({ mastery: 2, reviewCount: 3 });
    const result = applyMasteryResult(card, false);
    expect(result.mastery).toBe(1);
  });

  it('caps mastery at 5', () => {
    const card = makeCard({ mastery: 5, reviewCount: 10 });
    const result = applyMasteryResult(card, true);
    expect(result.mastery).toBe(5);
  });

  it('always increments reviewCount regardless of correct/wrong', () => {
    const card = makeCard({ reviewCount: 3 });
    expect(applyMasteryResult(card, true).reviewCount).toBe(4);
    expect(applyMasteryResult(card, false).reviewCount).toBe(4);
  });

  it('sets lastReviewedAt to a number (timestamp)', () => {
    const card = makeCard({ lastReviewedAt: null });
    const result = applyMasteryResult(card, true);
    expect(typeof result.lastReviewedAt).toBe('number');
    expect(result.lastReviewedAt).toBeGreaterThan(0);
  });

  it('does not mutate the original card', () => {
    const card = makeCard({ mastery: 2, reviewCount: 3 });
    applyMasteryResult(card, true);
    expect(card.mastery).toBe(2);
    expect(card.reviewCount).toBe(3);
  });

  it('handles null mastery → result.mastery is number 1 on correct', () => {
    const card = makeCard({ mastery: null });
    const result = applyMasteryResult(card, true);
    expect(result.mastery).toBe(1);
    expect(typeof result.mastery).toBe('number');
  });

  it('handles null mastery → result.mastery stays 0 on wrong (clamped)', () => {
    const card = makeCard({ mastery: null });
    const result = applyMasteryResult(card, false);
    expect(result.mastery).toBe(0);
    expect(typeof result.mastery).toBe('number');
  });

  it('sets nextReviewAt to a future timestamp on correct', () => {
    const now = Date.now();
    const card = makeCard({ mastery: 1 });
    const result = applyMasteryResult(card, true);
    expect(typeof result.nextReviewAt).toBe('number');
    expect(result.nextReviewAt).toBeGreaterThan(now);
  });

  it('sets nextReviewAt to a future timestamp on wrong', () => {
    const now = Date.now();
    const card = makeCard({ mastery: 3 });
    const result = applyMasteryResult(card, false);
    expect(typeof result.nextReviewAt).toBe('number');
    expect(result.nextReviewAt).toBeGreaterThan(now);
  });

  it('does not mutate nextReviewAt on original card', () => {
    const card = makeCard({ mastery: 2, nextReviewAt: null });
    applyMasteryResult(card, true);
    expect(card.nextReviewAt).toBeNull();
  });

  it('sets needsPractice on wrong answer', () => {
    const card = makeCard({ mastery: 2, needsPractice: false });
    const result = applyMasteryResult(card, false);
    expect(result.needsPractice).toBe(true);
  });

  it('clears needsPractice on correct answer', () => {
    const card = makeCard({ mastery: 2, needsPractice: true });
    const result = applyMasteryResult(card, true);
    expect(result.needsPractice).toBe(false);
  });

  it('handles null reviewCount → result.reviewCount is 1', () => {
    const card = makeCard({ reviewCount: null });
    const result = applyMasteryResult(card, true);
    expect(result.reviewCount).toBe(1);
  });
});

// ─── buildQuestions ──────────────────────────────────────────────────────────

describe('buildQuestions', () => {
  it('returns empty array when modes is empty', () => {
    const cards = makeDeck(5);
    const result = buildQuestions(cards, cards, []);
    expect(result).toEqual([]);
  });

  it('returns one question per card', () => {
    const cards = makeDeck(5);
    const result = buildQuestions(cards, cards, ['pronunciation', 'word-meaning']);
    expect(result).toHaveLength(5);
  });

  it('assigns modes in round-robin fashion', () => {
    const cards = makeDeck(4);
    const modes = ['pronunciation', 'word-meaning'];
    const result = buildQuestions(cards, cards, modes);
    const types = result.map(q => q.type);
    expect(types[0]).toBe('pronunciation');
    expect(types[1]).toBe('word-meaning');
    expect(types[2]).toBe('pronunciation');
    expect(types[3]).toBe('word-meaning');
  });

  it('each question has required fields', () => {
    const cards = makeDeck(3);
    const result = buildQuestions(cards, cards, ['pronunciation']);
    result.forEach(q => {
      expect(q).toHaveProperty('card');
      expect(q).toHaveProperty('type');
      expect(q).toHaveProperty('hint');
    });
  });

  it('distributes chinese-meaning in round-robin with other modes', () => {
    const cards = makeDeck(4);
    const modes = ['pronunciation', 'chinese-meaning'];
    const result = buildQuestions(cards, cards, modes);
    const types = result.map(q => q.type);
    expect(types[0]).toBe('pronunciation');
    expect(types[1]).toBe('chinese-meaning');
    expect(types[2]).toBe('pronunciation');
    expect(types[3]).toBe('chinese-meaning');
  });
});

// ─── computeNextReviewAt ─────────────────────────────────────────────────────

describe('computeNextReviewAt', () => {
  const DAY = 86400000;
  const fixedNow = 1000000000000;

  it('returns 1 day from now for null mastery + wrong (new mastery 0)', () => {
    const result = computeNextReviewAt(null, false, fixedNow);
    expect(result).toBe(fixedNow + 1 * DAY);
  });

  it('returns 1 day from now for null mastery + correct (new mastery 1)', () => {
    const result = computeNextReviewAt(null, true, fixedNow);
    expect(result).toBe(fixedNow + 1 * DAY);
  });

  it('returns 3 days for mastery 1 + correct (new mastery 2)', () => {
    const result = computeNextReviewAt(1, true, fixedNow);
    expect(result).toBe(fixedNow + 3 * DAY);
  });

  it('returns 7 days for mastery 2 + correct (new mastery 3)', () => {
    const result = computeNextReviewAt(2, true, fixedNow);
    expect(result).toBe(fixedNow + 7 * DAY);
  });

  it('returns 14 days for mastery 3 + correct (new mastery 4)', () => {
    const result = computeNextReviewAt(3, true, fixedNow);
    expect(result).toBe(fixedNow + 14 * DAY);
  });

  it('returns 30 days for mastery 4 + correct (new mastery 5)', () => {
    const result = computeNextReviewAt(4, true, fixedNow);
    expect(result).toBe(fixedNow + 30 * DAY);
  });

  it('caps mastery at 5 (30 days) on correct', () => {
    const result = computeNextReviewAt(5, true, fixedNow);
    expect(result).toBe(fixedNow + 30 * DAY);
  });

  it('decrements mastery on wrong: mastery 3 wrong → new mastery 2 → 3 days', () => {
    const result = computeNextReviewAt(3, false, fixedNow);
    expect(result).toBe(fixedNow + 3 * DAY);
  });

  it('clamps mastery decrement at 0: mastery 0 wrong → still 1 day', () => {
    const result = computeNextReviewAt(0, false, fixedNow);
    expect(result).toBe(fixedNow + 1 * DAY);
  });

  it('uses Date.now() when now is not provided (result is in the future)', () => {
    const before = Date.now();
    const result = computeNextReviewAt(0, true);
    expect(result).toBeGreaterThanOrEqual(before + 86400000);
  });
});

// ─── selectQuizCards (overdue priority) ──────────────────────────────────────

describe('selectQuizCards — overdue priority', () => {
  it('surfaces overdue card before learning card', () => {
    const overdueCard = makeCard({ id: 'overdue', mastery: 2, nextReviewAt: Date.now() - 1000 });
    const learningCard = makeCard({ id: 'learning', mastery: 1, nextReviewAt: Date.now() + 99999999 });
    // No null-mastery cards
    const deck = [learningCard, overdueCard];
    const result = selectQuizCards(deck, 'english', 1);
    expect(result[0].id).toBe('overdue');
  });

  it('still prefers null-mastery cards over overdue cards', () => {
    const neverSeen = makeCard({ id: 'never', mastery: null });
    const overdueCard = makeCard({ id: 'overdue', mastery: 3, nextReviewAt: Date.now() - 1000 });
    const deck = [overdueCard, neverSeen];
    const result = selectQuizCards(deck, 'english', 1);
    expect(result[0].id).toBe('never');
  });

  it('surfaces overdue before non-overdue learning cards', () => {
    const overdue = makeCard({ id: 'overdue', mastery: 1, nextReviewAt: Date.now() - 1000 });
    const learning = makeCard({ id: 'learning', mastery: 2, nextReviewAt: Date.now() + 99999999 });
    const deck = [learning, overdue];
    const result = selectQuizCards(deck, 'english', 2);
    expect(result[0].id).toBe('overdue');
  });
});

// ─── computeSessionScore ─────────────────────────────────────────────────────

describe('computeSessionScore', () => {
  it('handles empty results → zero values', () => {
    const score = computeSessionScore([]);
    expect(score).toEqual({ correct: 0, total: 0, stars: 0, weakCards: [] });
  });

  it('counts correct answers', () => {
    const results = [
      { cardId: '1', correct: true },
      { cardId: '2', correct: false },
      { cardId: '3', correct: true },
    ];
    const score = computeSessionScore(results);
    expect(score.correct).toBe(2);
    expect(score.total).toBe(3);
  });

  it('returns weakCards for incorrect answers', () => {
    const card1 = makeCard({ id: 'c1' });
    const card2 = makeCard({ id: 'c2' });
    const results = [
      { cardId: 'c1', card: card1, correct: false },
      { cardId: 'c2', card: card2, correct: true },
    ];
    const score = computeSessionScore(results);
    expect(score.weakCards).toHaveLength(1);
    expect(score.weakCards[0].id).toBe('c1');
  });

  it('assigns 3 stars for perfect score', () => {
    const results = [
      { cardId: '1', correct: true },
      { cardId: '2', correct: true },
      { cardId: '3', correct: true },
    ];
    expect(computeSessionScore(results).stars).toBe(3);
  });

  it('assigns 2 stars for >= 70% score', () => {
    const results = [
      { cardId: '1', correct: true },
      { cardId: '2', correct: true },
      { cardId: '3', correct: true },
      { cardId: '4', correct: false },
    ];
    // 75% → 2 stars
    expect(computeSessionScore(results).stars).toBe(2);
  });

  it('assigns 1 star for >= 40% score', () => {
    const results = [
      { cardId: '1', correct: true },
      { cardId: '2', correct: false },
      { cardId: '3', correct: false },
    ];
    // 33% → 1 star... let's do 2/4
    const results2 = [
      { cardId: '1', correct: true },
      { cardId: '2', correct: true },
      { cardId: '3', correct: false },
      { cardId: '4', correct: false },
      { cardId: '5', correct: false },
    ];
    // 40% → 1 star
    expect(computeSessionScore(results2).stars).toBe(1);
  });

  it('assigns 0 stars for all wrong', () => {
    const results = [
      { cardId: '1', correct: false },
      { cardId: '2', correct: false },
    ];
    expect(computeSessionScore(results).stars).toBe(0);
  });
});
