# Review Quiz Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make quiz review selection use one shared pool of never-reviewed, overdue, and failed words; add an `All` quiz count; and remove the empty memory-helper loading block when no hint is available.

**Architecture:** Keep all review scheduling decisions in pure helpers inside `frontend/src/lib/quizLogic.js`. React components should consume those helpers for counts and selection, while `useDeck.js` remains the persistence boundary that migrates cards and stores mastery updates.

**Tech Stack:** React 18, Vite, Vitest, Testing Library, Tailwind CSS.

---

## File Structure

- Modify `frontend/src/lib/quizLogic.js`: add shared review-eligibility helpers, make `selectQuizCards` select only eligible cards, and set or clear `needsPractice` in `applyMasteryResult`.
- Modify `frontend/src/lib/__tests__/quizLogic.test.js`: add pure tests for eligibility, count resolution, selection, and failed-state mastery updates.
- Modify `frontend/src/hooks/useDeck.js`: add `needsPractice: false` to migrated cards.
- Modify `frontend/src/hooks/__tests__/useDeck.test.js`: verify newly added and migrated cards expose `needsPractice`.
- Modify `frontend/src/App.jsx`: use the shared review-eligible selector for the main-page review count.
- Modify `frontend/src/components/QuizMode.jsx`: add `All`, enable small review sessions, use shared review selection in manual and due-only quiz starts, and suppress empty memory-helper blocks.
- Modify `frontend/src/components/__tests__/QuizMode.test.jsx`: cover `All`, small eligible sessions, no-eligible disabled state, and memory helper skeleton behavior.
- Modify `frontend/src/components/__tests__/App.test.jsx`: cover main-page review badge behavior for a failed future-scheduled card.
- Modify `frontend/src/lib/i18n.js`: add localized `All` labels and update the no-reviewable-card message.
- Modify `frontend/src/lib/__tests__/i18n.test.js`: verify the new labels exist in both languages.

## Task 1: Pure Review Eligibility And Mastery State

**Files:**
- Modify: `frontend/src/lib/quizLogic.js`
- Modify: `frontend/src/lib/__tests__/quizLogic.test.js`

- [ ] **Step 1: Write failing tests for shared review eligibility and failed-state updates**

In `frontend/src/lib/__tests__/quizLogic.test.js`, extend the import list:

```js
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
```

In the `makeCard` fixture, add the two review fields:

```js
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
```

Add this block after the existing `getDueCards` tests:

```js
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
```

In the existing `selectQuizCards` describe block, add these tests:

```js
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
```

Also replace the old low-mastery priority test with this review-pool rule:

```js
  it('does not include low-mastery cards before their next review time', () => {
    const now = Date.now();
    const lowMasteryFuture = makeCard({ id: 'low-future', mastery: 1, nextReviewAt: now + 86400000 });
    const due = makeCard({ id: 'due', mastery: 3, nextReviewAt: now - 1000 });
    const result = selectQuizCards([lowMasteryFuture, due], 'english', 10, now);
    expect(result.map(c => c.id)).toEqual(['due']);
  });
```

In the old null-mastery priority test, make the high-mastery card explicitly future-scheduled:

```js
  it('prefers cards with null mastery', () => {
    const now = Date.now();
    const nullMastery = makeCard({ id: 'null-1', mastery: null, nextReviewAt: null });
    const highMastery = makeCard({ id: 'high-1', mastery: 5, nextReviewAt: now + 86400000 });
    const deck = [highMastery, nullMastery];
    const result = selectQuizCards(deck, 'english', 1, now);
    expect(result[0].id).toBe('null-1');
  });
```

In the existing `applyMasteryResult` describe block, add:

```js
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
```

- [ ] **Step 2: Run the pure test file and verify the new tests fail**

Run:

```bash
cd frontend
npm run test -- src/lib/__tests__/quizLogic.test.js
```

Expected: FAIL because `isReviewEligibleCard`, `getReviewEligibleCards`, `getReviewEligibleCardsForSubject`, and `resolveQuizCount` are not exported yet, and `applyMasteryResult` does not update `needsPractice`.

- [ ] **Step 3: Implement the pure review helpers and failed-state mastery update**

In `frontend/src/lib/quizLogic.js`, keep the existing `isDueCard` and `getDueCards` exports for compatibility. Add these helpers after `getDueCards`:

```js
const isNeverReviewed = (card) =>
  card.mastery === null || card.mastery === undefined || card.nextReviewAt === null;

const isFailedPractice = (card) => card.needsPractice === true;

/**
 * Returns true when a card should appear in review experiences.
 * This combines never-reviewed cards, overdue scheduled cards, and failed cards.
 */
export function isReviewEligibleCard(card, now = Date.now()) {
  if (card.quizDisabled) return false;
  return isFailedPractice(card) || isNeverReviewed(card) || isDueCard(card, now);
}

/**
 * Returns review-eligible cards, newest-first by saved day.
 */
export function getReviewEligibleCards(deck, now = Date.now()) {
  const eligible = deck.filter(c => isReviewEligibleCard(c, now));
  const dayBucket = c => Math.floor((c.savedAt || 0) / 86400000);
  const grouped = eligible.reduce((acc, c) => {
    const key = dayBucket(c);
    return { ...acc, [key]: [...(acc[key] ?? []), c] };
  }, {});

  return Object.keys(grouped)
    .sort((a, b) => Number(b) - Number(a))
    .flatMap(key => shuffled(grouped[key]));
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
```

Replace the existing `selectQuizCards` function with:

```js
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
```

In `applyMasteryResult`, add `needsPractice: !correct` to the returned object:

```js
  return {
    ...card,
    mastery: newMastery,
    reviewCount: currentReviewCount + 1,
    lastReviewedAt: Date.now(),
    nextReviewAt: computeNextReviewAt(card.mastery, correct),
    needsPractice: !correct,
  };
```

- [ ] **Step 4: Run the pure test file and verify it passes**

Run:

```bash
cd frontend
npm run test -- src/lib/__tests__/quizLogic.test.js
```

Expected: PASS for `quizLogic.test.js`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add frontend/src/lib/quizLogic.js frontend/src/lib/__tests__/quizLogic.test.js
git commit -m "fix: add shared review eligibility logic"
```

Expected: commit succeeds with only the pure logic and tests staged.

## Task 2: Persist `needsPractice` And Use Shared Review Count

**Files:**
- Modify: `frontend/src/hooks/useDeck.js`
- Modify: `frontend/src/hooks/__tests__/useDeck.test.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/__tests__/App.test.jsx`

- [ ] **Step 1: Write failing persistence and main-page count tests**

In `frontend/src/hooks/__tests__/useDeck.test.js`, add this test inside `describe('useDeck', ...)` after `addCard returns the saved card object with an id`:

```js
  it('migrates cards with needsPractice defaulting to false', () => {
    const storedCard = { ...mockCard, id: 'stored-1', savedAt: Date.now(), schemaVersion: 1 };
    localStorageMock.setItem('starcards_deck', JSON.stringify([storedCard]));

    const { result } = renderHook(() => useDeck());

    expect(result.current.deck[0].needsPractice).toBe(false);
  });
```

In the existing `addCard persists to localStorage` test, add:

```js
    expect(stored[0].needsPractice).toBe(false);
```

In `frontend/src/components/__tests__/App.test.jsx`, add this test after the existing two tests:

```js
describe('App review badge', () => {
  it('counts failed future-scheduled cards as needing review', () => {
    const card = {
      id: 'failed-1',
      word: 'pace',
      emoji: '🚶',
      sentence: 'I pace back and forth.',
      color_theme: 'orange',
      subject: 'english',
      savedAt: Date.now(),
      schemaVersion: 1,
      knewIt: null,
      reviewedAt: null,
      mastery: 3,
      reviewCount: 2,
      lastReviewedAt: Date.now() - 1000,
      nextReviewAt: Date.now() + 7 * 86400000,
      needsPractice: true,
      quizHints: null,
      style: 'illustrated',
    };
    localStorage.setItem('starcards_deck', JSON.stringify([card]));

    render(<App />);

    expect(screen.getByText(/1 张需要复习/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
cd frontend
npm run test -- src/hooks/__tests__/useDeck.test.js src/components/__tests__/App.test.jsx
```

Expected: FAIL because `needsPractice` is not migrated and `App.jsx` still counts only `getDueCards`.

- [ ] **Step 3: Add the migration field and shared count**

In `frontend/src/hooks/useDeck.js`, add `needsPractice: false` to `migrateCard` with the v2 fields:

```js
function migrateCard(card) {
  return {
    schemaVersion: 1,
    knewIt: null,
    reviewedAt: null,
    mastery: null,
    reviewCount: null,
    lastReviewedAt: null,
    nextReviewAt: null,
    needsPractice: false,
    quizHints: null,
    ...card,
  };
}
```

In `frontend/src/App.jsx`, replace the import:

```js
import { getReviewEligibleCards } from './lib/quizLogic';
```

Replace the due-count line with:

```js
  const dueCount = getReviewEligibleCards(deck).length;
```

- [ ] **Step 4: Run targeted tests and verify they pass**

Run:

```bash
cd frontend
npm run test -- src/hooks/__tests__/useDeck.test.js src/components/__tests__/App.test.jsx
```

Expected: PASS for both files.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add frontend/src/hooks/useDeck.js frontend/src/hooks/__tests__/useDeck.test.js frontend/src/App.jsx frontend/src/components/__tests__/App.test.jsx
git commit -m "fix: use shared review eligibility count"
```

Expected: commit succeeds with persistence and main-page count changes staged.

## Task 3: Add `All` Quiz Count And Small Review Sessions

**Files:**
- Modify: `frontend/src/lib/i18n.js`
- Modify: `frontend/src/lib/__tests__/i18n.test.js`
- Modify: `frontend/src/components/QuizMode.jsx`
- Modify: `frontend/src/components/__tests__/QuizMode.test.jsx`

- [ ] **Step 1: Write failing i18n and quiz lobby tests**

In `frontend/src/lib/__tests__/i18n.test.js`, add:

```js
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
```

In `frontend/src/components/__tests__/QuizMode.test.jsx`, import `getQuizHint` so later tests can control the existing mock:

```js
import { getQuizHint } from '../../lib/quizHintApi';
```

Replace the lobby count preset test with:

```js
  it('renders count presets: 5, 10, 20, All', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
  });
```

Replace `Start button is disabled when deck has < 5 cards` with:

```js
  it('enables Start with fewer than five eligible cards by selecting All', async () => {
    const smallDeck = makeDeck(3);
    render(<QuizMode {...DEFAULT_PROPS} deck={smallDeck} />);

    await waitFor(() => {
      expect(screen.getByText('All').closest('button').disabled).toBe(false);
      expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false);
    });
  });

  it('disables Start when the selected subject has no eligible cards', () => {
    const now = Date.now();
    const futureDeck = makeDeck(6).map((card) => ({
      ...card,
      mastery: 3,
      nextReviewAt: now + 7 * 86400000,
      needsPractice: false,
    }));

    render(<QuizMode {...DEFAULT_PROPS} deck={futureDeck} />);

    expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(true);
  });
```

Add this test to the lobby describe block:

```js
  it('All starts a quiz with every eligible card for the selected subject', async () => {
    const now = Date.now();
    const deck = [
      makeCard({ id: 'new-1', word: 'new1', mastery: null, nextReviewAt: null }),
      makeCard({ id: 'failed-1', word: 'failed1', mastery: 3, nextReviewAt: now + 86400000, needsPractice: true }),
      makeCard({ id: 'due-1', word: 'due1', mastery: 3, nextReviewAt: now - 1000 }),
      makeCard({ id: 'future-1', word: 'future1', mastery: 3, nextReviewAt: now + 86400000 }),
    ];

    render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);
    await act(async () => { fireEvent.click(screen.getByText('All')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    await waitFor(() => {
      expect(screen.getByText(/question 1 of 3/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
cd frontend
npm run test -- src/lib/__tests__/i18n.test.js src/components/__tests__/QuizMode.test.jsx
```

Expected: FAIL because `quizCountAll` is missing and `QuizMode` does not support `All` or small eligible sessions yet.

- [ ] **Step 3: Add i18n strings and update quiz lobby selection**

In `frontend/src/lib/i18n.js`, add these fields in both language objects near `quizCountLabel`:

```js
    quizCountAll: '全部',
    quizNeedCards: '没有需要复习的卡片',
```

```js
    quizCountAll: 'All',
    quizNeedCards: 'No cards need review right now',
```

Keep only one `quizNeedCards` field per language object.

In `frontend/src/components/QuizMode.jsx`, update the imports:

```js
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildQuestion,
  buildQuestions,
  selectQuizCards,
  computeSessionScore,
  applyMasteryResult,
  shuffled,
  getReviewEligibleCards,
  getReviewEligibleCardsForSubject,
} from '../lib/quizLogic';
```

Replace `COUNT_OPTIONS` with:

```js
const COUNT_OPTIONS = [5, 10, 20, 'all'];
```

Inside `QuizLobby`, replace the subject deck and start logic setup with:

```js
  const subjectDeck = getReviewEligibleCardsForSubject(deck, subject);
  const availableCount = subjectDeck.length;
  const canStart = availableCount > 0;

  useEffect(() => {
    if (availableCount === 0) return;
    if (count !== 'all' && count > availableCount) {
      setCount('all');
    }
  }, [availableCount, count]);
```

Replace the count button map with:

```jsx
          {COUNT_OPTIONS.map(option => {
            const isAll = option === 'all';
            const disabled = isAll ? availableCount === 0 : availableCount < option;
            const selected = count === option && !disabled;
            const label = isAll ? t.quizCountAll : option;
            return (
              <button
                key={option}
                disabled={disabled}
                onClick={() => setCount(option)}
                className="flex-1 py-3 rounded-xl font-bold text-xl transition-all"
                style={{
                  background: selected ? 'var(--color-primary)' : 'var(--color-primary-light)',
                  color: selected ? 'white' : disabled ? '#bbb' : 'var(--color-primary-dark)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {label}
              </button>
            );
          })}
```

In the due-only auto-start effect, replace the due-card line:

```js
    const dueCards = getReviewEligibleCards(deck, now);
```

Leave the empty fallback line as:

```js
    if (dueCards.length === 0) return;
```

`handleStart` already passes `count` into `selectQuizCards`; after Task 1, that supports both numbers and `'all'`.

- [ ] **Step 4: Run targeted tests and verify they pass**

Run:

```bash
cd frontend
npm run test -- src/lib/__tests__/i18n.test.js src/components/__tests__/QuizMode.test.jsx
```

Expected: PASS for i18n and QuizMode tests.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add frontend/src/lib/i18n.js frontend/src/lib/__tests__/i18n.test.js frontend/src/components/QuizMode.jsx frontend/src/components/__tests__/QuizMode.test.jsx
git commit -m "feat: add all review quiz count"
```

Expected: commit succeeds with quiz lobby and i18n changes staged.

## Task 4: Remove Empty Memory Helper Skeleton

**Files:**
- Modify: `frontend/src/components/QuizMode.jsx`
- Modify: `frontend/src/components/__tests__/QuizMode.test.jsx`

- [ ] **Step 1: Write failing memory-helper skeleton test**

In `frontend/src/components/__tests__/QuizMode.test.jsx`, add this test near the hint text tests:

```js
describe('QuizMode — Memory helper empty state', () => {
  it('does not render the hint skeleton while fallback memory text is already visible', async () => {
    vi.mocked(getQuizHint).mockImplementationOnce(() => new Promise(() => {}));
    const deck = [
      makeCard({
        id: 'reading-1',
        subject: 'chinese',
        word: '徘徊',
        chinese: '徘徊',
        pinyin: 'pái huái',
        mnemonic: 'Think of walking in a circle.',
        mascot_message: null,
        quizHints: null,
        mastery: null,
        nextReviewAt: null,
      }),
    ];

    const { container } = render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);

    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await waitFor(() => expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    await waitFor(() => expect(screen.queryByText(t.quizDontKnow)).toBeTruthy(), { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });

    expect(screen.getByText(/walking in a circle/i)).toBeTruthy();
    expect(container.querySelector('.quiz-hint-skeleton')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the QuizMode test file and verify the new test fails if the skeleton remains**

Run:

```bash
cd frontend
npm run test -- src/components/__tests__/QuizMode.test.jsx
```

Expected: FAIL because the current memory-helper UI shows `.quiz-hint-skeleton` while a hint request is still loading, even when mnemonic fallback text is already visible.

- [ ] **Step 3: Add a hint-content predicate and render hint UI only when useful**

In `frontend/src/components/QuizMode.jsx`, add this helper near the constants:

```js
function hasHintContent(hint) {
  if (!hint) return false;
  return [hint.encouragement, hint.extraSentence, hint.pronunciationGuide]
    .some(value => String(value ?? '').trim().length > 0);
}

function hasMemoryFallback(card) {
  return [card.mnemonic, card.mascot_message]
    .some(value => String(value ?? '').trim().length > 0);
}
```

In `QuizQuestion`, after `const memoryHint = card.quizHints?.[type] ?? null;`, add:

```js
  const hasMemoryHint = hasHintContent(memoryHint);
  const hasFallbackMemory = hasMemoryFallback(card);
```

In the inline AI memory tips block, replace the hint rendering section with:

```jsx
        {hintLoading && !hasFallbackMemory ? (
          <div className="quiz-hint-skeleton" />
        ) : hasMemoryHint ? (
          <>
            <p className="text-sm mb-1">{memoryHint.encouragement}</p>
            <p className="text-sm italic mb-1">{memoryHint.extraSentence}</p>
            <p className="text-sm font-mono">{memoryHint.pronunciationGuide}</p>
          </>
        ) : null}
```

In `QuizFeedback`, after `const hint = card.quizHints?.[question.type] ?? null;`, add:

```js
  const hasMemoryHint = hasHintContent(hint);
  const hasFallbackMemory = hasMemoryFallback(card);
```

In the feedback memory helper block, replace the hint rendering section with:

```jsx
            {hintLoading && !hasFallbackMemory ? (
              <div className="quiz-hint-skeleton" />
            ) : hasMemoryHint ? (
              <>
                <p className="text-sm mb-1">{hint.encouragement}</p>
                <p className="text-sm italic mb-1">{hint.extraSentence}</p>
                <p className="text-sm font-mono">{hint.pronunciationGuide}</p>
              </>
            ) : null}
```

Keep the speaker button logic unchanged, but it should continue to no-op when there is no mnemonic or encouragement text.

- [ ] **Step 4: Run the QuizMode test file and verify it passes**

Run:

```bash
cd frontend
npm run test -- src/components/__tests__/QuizMode.test.jsx
```

Expected: PASS for `QuizMode.test.jsx`.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add frontend/src/components/QuizMode.jsx frontend/src/components/__tests__/QuizMode.test.jsx
git commit -m "fix: hide empty memory helper skeleton"
```

Expected: commit succeeds with the memory-helper UI fix staged.

## Task 5: Full Verification And Cleanup

**Files:**
- Review: all modified files from Tasks 1-4

- [ ] **Step 1: Run the full test suite**

Run:

```bash
cd frontend
npm run test
```

Expected: PASS for the full Vitest suite.

- [ ] **Step 2: Run a production build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS and Vite writes the production bundle to `frontend/dist`.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff HEAD~4..HEAD -- frontend/src/lib/quizLogic.js frontend/src/hooks/useDeck.js frontend/src/App.jsx frontend/src/components/QuizMode.jsx frontend/src/lib/i18n.js
```

Expected: diff shows only review scheduling, quiz lobby, memory-helper, migration, and i18n changes.

- [ ] **Step 4: Optional browser smoke test**

Run:

```bash
cd frontend
npm run dev
```

Expected: Vite prints a local URL such as `http://localhost:5173/`.

Manual smoke checks:

- A failed future-scheduled card increments the main review badge.
- Starting quiz manually shows only review-eligible cards.
- `All` starts every eligible card for the selected subject.
- A correctly answered failed card disappears from an immediate second review session.
- The memory helper does not show an empty grey/purple block after an empty hint response.

- [ ] **Step 5: Commit any verification-only cleanup**

If verification required small test or text fixes, run:

```bash
git add frontend/src
git commit -m "test: cover review quiz scheduling"
```

Expected: commit is needed only if Step 1-4 produced additional tracked edits.
