# quizDisabled localStorage Migration Design

Date: 2026-05-09
Project: StarCards / KidLearn frontend

## Goal

One-time data fix for cards that were wrongly set to `quizDisabled: true` by the old in-quiz `跳过测验` button. After this migration runs, those cards are restored to the review pool with `needsPractice: true` so they resurface for review.

This migration is bundled with the skip-button behavior fix (`2026-05-09-quiz-skip-as-fail-design.md`) but specified separately because it is data-only, runs once per card, and can be reasoned about independently of the UI change.

## Current Problem

Until today, the `跳过测验` button in quiz mode set `quizDisabled: true` on the card. The user reports clicking it many times yesterday on cards they meant to revisit. Those cards are now hidden from quizzes until manually re-enabled in DeckView.

There is no field that distinguishes "disabled because of the buggy skip button" from "disabled because the parent intentionally excluded the card via DeckView". The user has accepted that all currently-disabled cards will be restored, and any DeckView exclusions that were intentional can be re-applied manually after the migration.

The data lives in browser localStorage under the key `starcards_deck` (`frontend/src/hooks/useDeck.js:4`). There is no backend database in this app.

## Product Rules

On next app load, every card with `schemaVersion < 2` AND `quizDisabled === true` is updated to:

- `quizDisabled: false`
- `needsPractice: true`
- `schemaVersion: 2`

Cards with `schemaVersion < 2` and `quizDisabled !== true` are bumped to `schemaVersion: 2` only — no other field changes.

Cards already at `schemaVersion: 2` are not touched. Subsequent loads do not re-clear `quizDisabled` flags set legitimately via DeckView after the migration ran.

The migration is idempotent. Running `migrateCard` repeatedly on the same input produces the same output.

## Architecture

The migration runs inline in `migrateCard` (`frontend/src/hooks/useDeck.js:11`). `loadDeck` already maps every card through `migrateCard`, so no new callsite is required.

Recommended shape:

```js
function migrateCard(card) {
  const base = {
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

  if ((base.schemaVersion ?? 1) < 2) {
    return {
      ...base,
      schemaVersion: 2,
      ...(base.quizDisabled === true ? { quizDisabled: false, needsPractice: true } : {}),
    };
  }

  return base;
}
```

Pure, deterministic, no I/O.

The migration result is persisted to localStorage on the next save event (any `addCard`, `deleteCard`, `updateCardMastery`, `patchCard` call). If the user opens the app and never interacts, localStorage stays at v1 — but `migrateCard` runs every load, so the in-memory deck is always v2-shaped. A lazy persist is acceptable for this app.

## Data Flow

1. User opens the app after the change deploys.
2. `useDeck` calls `loadDeck` → reads `localStorage[starcards_deck]` → `JSON.parse` → `.map(migrateCard)`.
3. For each card, `migrateCard` bumps `schemaVersion` to `2` and clears the wrongly-set `quizDisabled` flag (when present).
4. `setDeck(migrated)` triggers a render.
5. The next time the user touches the deck (add card, answer quiz, etc.), `saveDeck` writes the v2 form back to localStorage.
6. From this point forward, `quizDisabled: true` only originates from the DeckView toggle.

## Testing Plan

Follow red-green-refactor. Pure-function tests are sufficient.

`frontend/src/hooks/__tests__/useDeck.test.js`:

- v1 card with `quizDisabled: true` migrates to `quizDisabled: false`, `needsPractice: true`, `schemaVersion: 2`.
- v1 card with `quizDisabled: false` migrates to `schemaVersion: 2` only; other fields unchanged.
- v1 card with `quizDisabled` undefined migrates to `schemaVersion: 2` only.
- v2 card with `quizDisabled: true` is unchanged. Post-migration DeckView toggles must be respected.
- Mastery, review, and hint fields on existing v1 cards are preserved across migration (regression guard for `...card` ordering).
- A card without a `schemaVersion` field at all (treated as v1) migrates correctly.

## Out Of Scope

- Skip-button behavior change. See `2026-05-09-quiz-skip-as-fail-design.md`.
- Eager persistence to localStorage on load. Lazy save on next deck change is sufficient.
- Backend persistence layer. Tracked in a separate brainstorm.
- Visualization or undo for the migration. The user has accepted the side effect of restoring all DeckView-disabled cards.
- Reset of any other field (mastery, nextReviewAt, etc.) for migrated cards.

## Risks

- A card the user intentionally hid via DeckView before this change ships will reappear in the review pool. The user accepted this trade-off (Option X). Any cards still meant to be hidden can be re-disabled via DeckView.
- Two open tabs racing on first load both run the migration; the first to save wins. Acceptable — both arrive at the same v2 result.
- If a future schema bump (v3) is needed, the `< 2` check in `migrateCard` should be widened or a chained migration pattern adopted. Out of scope here.
