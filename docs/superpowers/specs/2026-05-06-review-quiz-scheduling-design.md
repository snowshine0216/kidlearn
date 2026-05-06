# Review Quiz Scheduling Design

Date: 2026-05-06
Project: StarCards / KidLearn frontend

## Goal

Fix quiz review selection so the main page review badge and quiz mode use the same review pool:

- never-reviewed words
- overdue words by the spaced-repetition schedule
- words the child failed in the most recent quiz attempt

Also add an `All` question-count option to quiz mode and remove the empty grey skeleton box under `记忆小贴士` when no hint is loading or available.

## Current Problem

The app already stores spaced-repetition fields on cards:

- `mastery`
- `reviewCount`
- `lastReviewedAt`
- `nextReviewAt`

The main page review count uses due-card logic, but manual quiz selection currently also fills sessions with non-due learning and mastered cards. That means a word can appear again immediately after the child answered it correctly, even though its `nextReviewAt` is in the future.

Failed words also need a separate immediate-practice signal. A wrong answer should remain visible in the review pool until the child answers that same word correctly later.

## Product Rules

### Review Eligibility

A card is review-eligible when all of these are true:

- It is not `quizDisabled`.
- It matches the requested subject when subject filtering is applied.
- At least one of these review conditions is true:
  - `mastery` is `null` or missing, meaning never reviewed.
  - `nextReviewAt` is `null`, meaning never scheduled for review.
  - `nextReviewAt <= now`, meaning overdue.
  - `needsPractice === true`, meaning the most recent quiz result for this card was wrong.

Cards are not review-eligible only because `mastery < 3`. Low mastery affects future intervals and prioritization, but should not override `nextReviewAt`.

### Failed Word Clearing

When a child answers a card incorrectly:

- Persist `needsPractice: true`.
- Update mastery and review metadata as today.
- Keep the card review-eligible immediately.

When a child later answers that card correctly:

- Persist `needsPractice: false`.
- Update mastery and `nextReviewAt` using the existing interval curve.
- Remove the card from the review pool until it becomes overdue again.

One correct pass is enough to clear the failed state.

### Quiz Count Options

Quiz lobby count options become:

- `5`
- `10`
- `20`
- `All`

`All` means every review-eligible card for the selected subject. Numeric options select up to that many eligible cards.

Numeric options should be visually disabled when the selected subject has fewer eligible cards than that number. `All` should be enabled whenever the selected subject has at least one eligible card.

The Start button should be enabled when at least one review-eligible card exists for the selected subject, even if fewer than five exist. If the current numeric selection becomes invalid after subject or deck changes, the lobby should select `All` so a small valid review session can still start. If no cards are eligible, the quiz should not start for that subject.

### Main Page Review Count

The main page `XX words need review` count must use the same review-eligible selector as quiz mode. Counts and quiz contents should not diverge.

### Memory Helper Skeleton

The loading skeleton under `记忆小贴士` should render only while the hint request for that card and quiz type is actively loading.

If no hint is loading and no AI hint exists:

- Do not render the grey/purple skeleton box.
- Do not reserve empty vertical space.
- Show existing fallback content such as mnemonic or mascot text when available.

If a hint request fails or returns no useful text, the UI should settle into the no-hint state instead of leaving a placeholder block.

## Architecture

Keep scheduling logic in `frontend/src/lib/quizLogic.js` as pure functions.

Add or adjust pure helpers for:

- checking whether a card is review-eligible
- selecting review-eligible cards by subject
- resolving a requested quiz count, including `all`
- applying mastery updates while setting or clearing `needsPractice`

React components should consume those helpers and handle only display, local state, and event boundaries.

Recommended helper shape:

```js
isReviewEligibleCard(card, now)
getReviewEligibleCards(deck, now)
getReviewEligibleCardsForSubject(deck, subject, now)
resolveQuizCount(count, availableCount)
selectQuizCards(deck, subject, count, now)
```

`count` may be a number or `'all'`. Existing callers using numeric counts should continue to work.

## Data Flow

1. A quiz answer calls the mastery update boundary.
2. The boundary calls pure quiz logic to produce an updated card.
3. Wrong answers set `needsPractice: true`.
4. Correct answers set `needsPractice: false` and schedule `nextReviewAt`.
5. Main page and quiz mode both read from the same review-eligible selector.

## Testing Plan

Follow red-green-refactor.

Unit tests in `frontend/src/lib/__tests__/quizLogic.test.js`:

- never-reviewed cards are review-eligible
- overdue cards are review-eligible
- future-scheduled cards are not review-eligible
- failed cards with `needsPractice: true` are review-eligible even when `nextReviewAt` is future
- correct answers clear `needsPractice`
- wrong answers set `needsPractice`
- low mastery alone does not make a card review-eligible
- `selectQuizCards(..., 'all')` returns every eligible card for the subject
- numeric selection returns at most the requested number of eligible cards

Component tests in `frontend/src/components/__tests__/QuizMode.test.jsx`:

- lobby renders `5`, `10`, `20`, and `All`
- `All` starts a quiz with every eligible card for the selected subject
- quiz can start with fewer than five eligible cards
- lobby selects a valid count when the current numeric count exceeds the eligible card count
- cards answered correctly do not appear in an immediate second review session
- failed cards remain eligible until answered correctly
- empty memory-helper state does not render the skeleton block

Integration-facing tests in existing App or StatsRow tests:

- the main page review badge uses the shared eligible-card count
- disabled cards are excluded from both count and quiz

## Out Of Scope

- Changing the spacing interval table
- Adding a visible review calendar
- Reworking quiz modes or question generation
- Migrating historical cards beyond adding a default `needsPractice: false`
- Redesigning the quiz page layout beyond the specific skeleton fix
