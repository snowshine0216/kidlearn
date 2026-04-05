import { describe, it, expect } from 'vitest';
import {
  shuffled,
  selectQuizCards,
  buildQuestions,
  buildQuestion,
  pickWrongAnswers,
  buildFillBlankSentence,
  buildHint,
  applyMasteryResult,
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
    const nullMastery = makeCard({ id: 'null-1', mastery: null });
    const highMastery = makeCard({ id: 'high-1', mastery: 5 });
    const deck = [highMastery, nullMastery];
    const result = selectQuizCards(deck, 'english', 1);
    expect(result[0].id).toBe('null-1');
  });

  it('prefers cards with low mastery (< 3) over high mastery', () => {
    const low = makeCard({ id: 'low-1', mastery: 1 });
    const high = makeCard({ id: 'high-1', mastery: 4 });
    const deck = [high, low];
    const result = selectQuizCards(deck, 'english', 1);
    expect(result[0].id).toBe('low-1');
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

  it('returns empty array if no cards match subject', () => {
    const deck = makeDeck(5, 'english');
    const result = selectQuizCards(deck, 'chinese', 5);
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
});

// ─── applyMasteryResult ──────────────────────────────────────────────────────

describe('applyMasteryResult', () => {
  it('increments mastery by 1 on correct answer', () => {
    const card = makeCard({ mastery: 2, reviewCount: 3 });
    const result = applyMasteryResult(card, true);
    expect(result.mastery).toBe(3);
  });

  it('does not change mastery on wrong answer', () => {
    const card = makeCard({ mastery: 2, reviewCount: 3 });
    const result = applyMasteryResult(card, false);
    expect(result.mastery).toBe(2);
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

  it('handles null mastery → result.mastery stays 0 on wrong', () => {
    const card = makeCard({ mastery: null });
    const result = applyMasteryResult(card, false);
    expect(result.mastery).toBe(0);
    expect(typeof result.mastery).toBe('number');
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
