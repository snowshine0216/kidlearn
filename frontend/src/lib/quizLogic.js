/**
 * Pure quiz logic — no React, no I/O, no side effects.
 * All functions are deterministic and return new values (no mutation).
 */

// ─── shuffled ────────────────────────────────────────────────────────────────

/** Returns a new shuffled copy of arr (Fisher-Yates). */
export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const orderNewestBySavedDay = (cards) => {
  const dayBucket = c => Math.floor((c.savedAt || 0) / 86400000);
  const grouped = cards.reduce((acc, c) => {
    const key = dayBucket(c);
    return { ...acc, [key]: [...(acc[key] ?? []), c] };
  }, {});

  return Object.keys(grouped)
    .sort((a, b) => Number(b) - Number(a))
    .flatMap(key => shuffled(grouped[key]));
};

// ─── isDueCard ────────────────────────────────────────────────────────────────

/**
 * Returns true if a card needs review: overdue OR never reviewed.
 * Uses strict === null: production cards (migrateCard) set nextReviewAt: null explicitly.
 * nextReviewAt: undefined is a test-helper artifact — treated as not-due.
 * Invariant: all card creation paths (addCard → migrateCard) must set nextReviewAt: null.
 */
export function isDueCard(card, now = Date.now()) {
  return card.nextReviewAt === null || card.nextReviewAt <= now;
}

// ─── getDueCards ──────────────────────────────────────────────────────────────

/**
 * Returns cards needing review, newest-first (by savedAt desc).
 * Cards added on the same day are shuffled relative to each other.
 * Cards with savedAt: undefined fall to epoch day 0 (shown last) — intentional fallback.
 */
export function getDueCards(deck, now = Date.now()) {
  const due = deck.filter(c => isDueCard(c, now));
  return orderNewestBySavedDay(due);
}

// ─── review eligibility ──────────────────────────────────────────────────────

const isQuizEnabledCard = (card) => card.quizDisabled !== true;

const isNeverReviewed = (card) =>
  card.mastery === null || card.mastery === undefined || card.nextReviewAt === null;

const isFailedPractice = (card) => card.needsPractice === true;

/**
 * Returns true when a card should appear in review experiences.
 * Combines never-reviewed cards, overdue scheduled cards, and failed cards.
 */
export function isReviewEligibleCard(card, now = Date.now()) {
  if (!isQuizEnabledCard(card)) return false;
  return isFailedPractice(card) || isNeverReviewed(card) || isDueCard(card, now);
}

export function getQuizCards(deck) {
  return orderNewestBySavedDay(deck.filter(isQuizEnabledCard));
}

export function getQuizCardsForSubject(deck, subject) {
  return getQuizCards(deck).filter(c => c.subject === subject);
}

/**
 * Returns review-eligible cards, newest-first by savedAt day.
 * Cards added on the same day are shuffled relative to each other.
 */
export function getReviewEligibleCards(deck, now = Date.now()) {
  const eligible = deck.filter(c => isReviewEligibleCard(c, now));
  return orderNewestBySavedDay(eligible);
}

export function getReviewEligibleCardsForSubject(deck, subject, now = Date.now()) {
  return getReviewEligibleCards(deck, now).filter(c => c.subject === subject);
}

export function resolveQuizCount(count, availableCount) {
  const safeAvailable = Math.max(0, availableCount ?? 0);
  if (count === 'all') return safeAvailable;
  const numeric = Number(count);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(numeric, safeAvailable);
}

export function selectPracticeCards(deck, subject, count, now = Date.now()) {
  const allEnabled = getQuizCardsForSubject(deck, subject);
  const eligibleOrdered = selectQuizCards(deck, subject, 'all', now);
  const eligibleIds = new Set(eligibleOrdered.map(c => c.id));
  const rest = allEnabled.filter(c => !eligibleIds.has(c.id));
  const ordered = [...eligibleOrdered, ...rest];
  const requested = resolveQuizCount(count, ordered.length);
  return ordered.slice(0, requested);
}

// ─── selectQuizCards ─────────────────────────────────────────────────────────

/**
 * Selects up to `count` review-eligible cards for a quiz session.
 * Priority:
 *   1. Failed cards (needsPractice === true)
 *   2. Never reviewed cards
 *   3. Overdue cards
 */
export function selectQuizCards(deck, subject, count, now = Date.now()) {
  const eligible = getReviewEligibleCardsForSubject(deck, subject, now);
  const requested = resolveQuizCount(count, eligible.length);

  const failed = eligible.filter(c => isFailedPractice(c));
  const neverReviewed = eligible.filter(c => !isFailedPractice(c) && isNeverReviewed(c));
  const overdue = eligible.filter(c => !isFailedPractice(c) && !isNeverReviewed(c) && isDueCard(c, now));

  const ordered = [
    ...shuffled(failed),
    ...shuffled(neverReviewed),
    ...shuffled(overdue),
  ];

  return ordered.slice(0, requested);
}

// ─── pickWrongAnswers ────────────────────────────────────────────────────────

/**
 * Returns n wrong-answer distractors for a correct card.
 * Prefers same-subject cards; excludes the correct card.
 */
export function pickWrongAnswers(correct, deck, n = 2) {
  const others = deck.filter(c => c.id !== correct.id);

  const sameSubject = others.filter(c => c.subject === correct.subject);
  const diffSubject = others.filter(c => c.subject !== correct.subject);

  const pool = sameSubject.length >= n
    ? shuffled(sameSubject)
    : [...shuffled(sameSubject), ...shuffled(diffSubject)];

  return pool.slice(0, n);
}

// ─── buildFillBlankSentence ──────────────────────────────────────────────────

/**
 * Replaces the FIRST <em>...</em> in card.sentence with ___.
 * Strips remaining <em> tags (renders their text content).
 * Returns '' if card.sentence is null/undefined.
 */
export function buildFillBlankSentence(card) {
  const sentence = card.sentence ?? '';
  if (!sentence) return '';

  let replaced = false;
  return sentence.replace(/<em>(.*?)<\/em>/g, (_, inner) => {
    if (!replaced) {
      replaced = true;
      return '___';
    }
    return inner;
  });
}

// ─── buildZhFillBlankSentence ────────────────────────────────────────────────

/**
 * Replaces the FIRST occurrence of card.chinese in card.sentence_zh with ___.
 * Returns '' if sentence_zh or card.chinese is null/undefined.
 */
export function buildZhFillBlankSentence(card) {
  const sentence = card.sentence_zh ?? '';
  if (!sentence || !card.chinese) return '';
  return sentence.replace(card.chinese, '___');
}

// ─── buildHint ───────────────────────────────────────────────────────────────

/**
 * Returns a hint string for a given card and quiz type.
 */
export function buildHint(card, type) {
  switch (type) {
    case 'pronunciation': {
      const firstLetter = (card.word ?? '')[0] ?? '';
      const mnemonicPart = card.mnemonic ? ` — ${card.mnemonic}` : '';
      return `Starts with "${firstLetter}"${mnemonicPart}`;
    }
    case 'fill-blank':
      return `${card.emoji ?? ''}`;
    case 'word-meaning':
      return card.pinyin ?? '';
    case 'reading':
      return card.pinyin ?? '';
    case 'chinese-meaning':
      return card.pinyin ?? '';
    case 'zh-fill-blank':
      return card.pinyin ?? '';
    case 'zh-pinyin':
      return card.word ?? '';
    default:
      return '';
  }
}

// ─── buildQuestion ───────────────────────────────────────────────────────────

/**
 * Builds a single question object for a card + type.
 * Falls back to 'word-meaning' if fill-blank has no <em> tag.
 */
export function buildQuestion(card, deck, type) {
  let resolvedType = type;

  if (type === 'fill-blank') {
    const hasFillBlank = card.sentence && /<em>.*?<\/em>/.test(card.sentence);
    if (!hasFillBlank) resolvedType = 'word-meaning';
  }

  if (type === 'zh-fill-blank') {
    const hasZhSentence = card.sentence_zh && card.chinese &&
      card.sentence_zh.includes(card.chinese);
    if (!hasZhSentence) resolvedType = 'reading';
  }

  if (type === 'zh-pinyin') {
    if (!card.pinyin?.trim()) resolvedType = 'reading';
  }

  // For zh-pinyin, distractors must have pinyin set so buttons are never empty
  const choicePool = resolvedType === 'zh-pinyin'
    ? deck.filter(c => c.pinyin?.trim())
    : deck;

  const choices =
    resolvedType === 'fill-blank' || resolvedType === 'word-meaning' ||
    resolvedType === 'chinese-meaning' || resolvedType === 'zh-fill-blank' ||
    resolvedType === 'zh-pinyin'
      ? shuffled([card, ...pickWrongAnswers(card, choicePool, 2)])
      : null;

  return {
    card,
    type: resolvedType,
    hint: buildHint(card, resolvedType),
    choices,
    correctId: card.id,
    sentenceWithBlank:
      resolvedType === 'fill-blank' ? buildFillBlankSentence(card) :
      resolvedType === 'zh-fill-blank' ? buildZhFillBlankSentence(card) : null,
  };
}

// ─── buildQuestions ──────────────────────────────────────────────────────────

/**
 * Builds an array of questions for a quiz session.
 * Assigns modes in round-robin. Returns [] if modes is empty.
 */
export function buildQuestions(cards, deck, modes) {
  if (!modes || modes.length === 0) return [];

  return cards.map((card, i) => {
    const type = modes[i % modes.length];
    return buildQuestion(card, deck, type);
  });
}

// ─── computeNextReviewAt ─────────────────────────────────────────────────────

/**
 * Returns the timestamp when a card should next be reviewed.
 * Intervals (days) indexed by new mastery level: [1, 1, 3, 7, 14, 30].
 * Injectable `now` for deterministic testing.
 */
const REVIEW_INTERVALS_DAYS = [1, 1, 3, 7, 14, 30];

export function computeNextReviewAt(mastery, correct, now = Date.now()) {
  const current = mastery ?? 0;
  const next = correct ? Math.min(5, current + 1) : Math.max(0, current - 1);
  return now + REVIEW_INTERVALS_DAYS[next] * 86400000;
}

// ─── applyMasteryResult ──────────────────────────────────────────────────────

/**
 * Returns a new card with updated mastery fields. Does not mutate input.
 * - Correct: mastery +1 (capped at 5)
 * - Wrong: mastery -1 (clamped to 0) — surfaces card sooner for re-review
 * - Always: reviewCount +1, lastReviewedAt = Date.now(), nextReviewAt computed
 */
export function applyMasteryResult(card, correct) {
  const currentMastery = card.mastery ?? 0;
  const currentReviewCount = card.reviewCount ?? 0;

  const newMastery = correct
    ? Math.min(5, currentMastery + 1)
    : Math.max(0, currentMastery - 1);

  return {
    ...card,
    mastery: newMastery,
    reviewCount: currentReviewCount + 1,
    lastReviewedAt: Date.now(),
    nextReviewAt: computeNextReviewAt(card.mastery, correct),
    needsPractice: !correct,
  };
}

// ─── computeSessionScore ─────────────────────────────────────────────────────

/**
 * Computes score summary from session results.
 * results: Array<{ cardId, card, correct }>
 * Returns: { correct, total, stars, weakCards }
 */
export function computeSessionScore(results) {
  if (!results || results.length === 0) {
    return { correct: 0, total: 0, stars: 0, weakCards: [] };
  }

  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const ratio = correct / total;

  let stars = 0;
  if (ratio === 1) stars = 3;
  else if (ratio >= 0.7) stars = 2;
  else if (ratio >= 0.4) stars = 1;

  const seen = new Set();
  const weakCards = results
    .filter(r => !r.correct && r.card)
    .map(r => r.card)
    .filter(c => !seen.has(c.id) && seen.add(c.id));

  return { correct, total, stars, weakCards };
}
