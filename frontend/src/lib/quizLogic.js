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

// ─── selectQuizCards ─────────────────────────────────────────────────────────

/**
 * Selects up to `count` cards for a quiz session.
 * Priority: mastery === null > mastery < 3 > mastery >= 3.
 */
export function selectQuizCards(deck, subject, count) {
  const filtered = deck.filter(c => c.subject === subject);

  const priority0 = filtered.filter(c => c.mastery === null || c.mastery === undefined);
  const priority1 = filtered.filter(c => c.mastery !== null && c.mastery !== undefined && c.mastery < 3);
  const priority2 = filtered.filter(c => c.mastery !== null && c.mastery !== undefined && c.mastery >= 3);

  const ordered = [...shuffled(priority0), ...shuffled(priority1), ...shuffled(priority2)];
  return ordered.slice(0, count);
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

  const choices =
    resolvedType === 'fill-blank' || resolvedType === 'word-meaning'
      ? shuffled([card, ...pickWrongAnswers(card, deck, 2)])
      : null;

  return {
    card,
    type: resolvedType,
    hint: buildHint(card, resolvedType),
    choices,
    correctId: card.id,
    sentenceWithBlank:
      resolvedType === 'fill-blank' ? buildFillBlankSentence(card) : null,
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

// ─── applyMasteryResult ──────────────────────────────────────────────────────

/**
 * Returns a new card with updated mastery fields. Does not mutate input.
 * - Correct: mastery +1 (capped at 5)
 * - Wrong: mastery unchanged
 * - Always: reviewCount +1, lastReviewedAt = Date.now()
 */
export function applyMasteryResult(card, correct) {
  const currentMastery = card.mastery ?? 0;
  const currentReviewCount = card.reviewCount ?? 0;

  const newMastery = correct
    ? Math.min(5, currentMastery + 1)
    : currentMastery;

  return {
    ...card,
    mastery: newMastery,
    reviewCount: currentReviewCount + 1,
    lastReviewedAt: Date.now(),
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

  const weakCards = results
    .filter(r => !r.correct && r.card)
    .map(r => r.card);

  return { correct, total, stars, weakCards };
}
