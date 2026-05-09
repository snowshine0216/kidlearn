# Quiz Skip-as-Fail Design

Date: 2026-05-09
Project: StarCards / KidLearn frontend

## Goal

Two coupled fixes to quiz mode behavior:

1. The in-quiz `跳过测验` button stops permanently disabling a card. Clicking it now records a wrong answer for the current question and advances, so the card resurfaces tomorrow through the existing spaced-repetition schedule.
2. The 开始测验 lobby and start flow stop showing the full subject deck. Both use the existing review-eligible selector so the count and the started session match the rest of the app.

The eligibility logic itself (`needsPractice === true` OR never-reviewed OR `nextReviewAt <= now / null`) is correct and stays unchanged.

## Current Problem

### Skip button leaks into permanent disable

`QuizQuestion` and `QuizFeedback` render a small `跳过测验` button at the bottom right (`frontend/src/components/QuizMode.jsx:518-526` and `:641-649`). Both wire to `handleExcludeCard` (`:891`), which sets `quizDisabled: true` and advances. Three consequences:

- The card never resurfaces, even when the parent meant "skip just this round".
- No result is recorded, so the session score and weak-cards retry list miss the skipped question.
- The bottom button is also rendered on the feedback page, after the child has already answered, so it doubles as a permanent-exclude shortcut at exactly the moment the answer is being reflected on.

### Lobby ignores review eligibility

`QuizLobby` reads `availableCount` from `getQuizCardsForSubject(deck, subject)` (`:39`), which filters on `quizDisabled !== true` only. `handleStart` then calls `selectPracticeCards` (`:810`), which uses the same helper. The result: the lobby shows the entire enabled deck and starts a quiz against all of it, even when only a handful of cards are review-eligible.

`isReviewEligibleCard`, `getReviewEligibleCardsForSubject`, and `selectQuizCards` already exist with the correct logic. They are simply not wired to the lobby and start flow.

## Product Rules

### Skip Button Behavior

`跳过测验` on `QuizQuestion`:

- Records the current question as wrong in the session results.
- Calls `onUpdateMastery(cardId, false)`. `applyMasteryResult` sets `nextReviewAt` ~1 day from now and `needsPractice: true`.
- Advances to the next question, or to summary if last.
- Does not set `quizDisabled`.

`跳过测验` is removed from `QuizFeedback`. After the child has answered, the next/back controls are sufficient.

The DeckView "Skip in Quiz / Include in Quiz" toggle is unchanged. That remains the parent-facing way to permanently exclude a card.

### Lobby Eligibility

`QuizLobby` `availableCount` is the count of review-eligible cards for the selected subject, frozen at lobby mount via `useRef(Date.now())` so re-renders do not change the count mid-session.

`handleStart` selects from the same review-eligible pool with `selectQuizCards(deck, subject, count, nowRef.current)`.

The numeric count buttons (5/10/20) remain disabled when `availableCount < option`. `全部` is enabled when `availableCount > 0`.

If `availableCount === 0` for the selected subject, the start button is disabled and the existing `quizNeedCards` empty-state message is shown. There is no fallback to "review all enabled cards".

`selectPracticeCards` becomes unused and is removed.

## Architecture

All scheduling logic stays in `frontend/src/lib/quizLogic.js` as pure functions. `selectQuizCards` and `getReviewEligibleCardsForSubject` are reused as-is.

`handleSkipAndFail` replaces `handleExcludeCard` in `frontend/src/components/QuizMode.jsx`. It mirrors the existing `handleSkipFeedback` shape:

```js
function handleSkipAndFail() {
  const q = questions[currentIdx];
  setHistory(prev => [...prev, captureSnapshot(q)]);
  onUpdateMastery(q.card.id, false);
  setResults(prev => [...prev, { cardId: q.card.id, card: q.card, type: q.type, correct: false }]);
  if (isLast) setPhase('summary');
  else { setCurrentIdx(i => i + 1); setPhase('question'); }
}
```

The prop on `QuizQuestion` is renamed from `onToggleQuizDisabled` to `onSkipAndFail` (matching the new semantics). The `isQuizDisabled` prop on `QuizQuestion` is removed — the button label is now constant (`t.quizDisable`, "跳过测验"), no toggle state.

`QuizFeedback` no longer receives the prop and no longer renders the bottom-right toggle row at all.

`QuizLobby` adds `const nowRef = useRef(Date.now())` and uses `getReviewEligibleCardsForSubject(deck, subject, nowRef.current)` for `availableCount`. `handleStart` uses `selectQuizCards(deck, subject, count, nowRef.current)`.

## Data Flow

1. Child clicks `跳过测验` on `QuizQuestion`.
2. `handleSkipAndFail` snapshots history, calls `onUpdateMastery(id, false)`, appends `{ cardId, card, type, correct: false }` to `results`.
3. `useDeck.updateCardMastery` runs `applyMasteryResult` → `nextReviewAt = now + 86400000`, `needsPractice = true`, `lastReviewedAt = now`.
4. The card is no longer due "today" by `nextReviewAt`, but `needsPractice = true` keeps it review-eligible until the child answers it correctly.
5. `selectQuizCards` orders failed cards first, so the card surfaces in the next quiz session.

## Testing Plan

Follow red-green-refactor.

`frontend/src/lib/__tests__/quizLogic.test.js`:

- `selectPracticeCards` is removed; no remaining references in the repo (grep guard or import-resolution test).

`frontend/src/components/__tests__/QuizMode.test.jsx`:

- Lobby `availableCount` reflects the review-eligible count for the selected subject, not the full enabled deck.
- Lobby start button is disabled when no eligible cards exist for the selected subject.
- `handleStart` selects from review-eligible cards only (a future-scheduled card is not chosen even when count is `'all'`).
- `跳过测验` on `QuizQuestion` records a wrong result, advances to the next question, and does NOT call `onPatchCard` with `quizDisabled: true`.
- After clicking `跳过测验`, the card's `nextReviewAt` is approximately 1 day from `now`.
- `跳过测验` is not rendered on `QuizFeedback`.

## Out Of Scope

- One-time localStorage data fix for cards wrongly disabled by the old skip button. See `2026-05-09-quizdisabled-localstorage-migration-design.md`.
- Backend SQLite layer. Tracked in a separate brainstorm.
- Eligibility logic itself (`isReviewEligibleCard`).
- DeckView's permanent `quizDisabled` toggle behavior.
- Renaming the `quizDisable` / `quizEnable` i18n keys.

## Risks

- `now` is frozen at lobby mount via `useRef`. If a user opens the lobby just before midnight and starts the quiz several minutes later, the eligibility snapshot still uses the pre-midnight `now`. Acceptable for this app: the quiz session ends within minutes, and any drift is at most a single day.
- Removing `跳过测验` from `QuizFeedback` means parents who used that screen as a permanent-exclude shortcut lose the affordance. They retain the same control via DeckView, which is the intended location.
