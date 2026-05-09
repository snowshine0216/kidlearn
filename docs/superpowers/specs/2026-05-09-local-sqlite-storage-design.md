# Local SQLite Storage Design

Date: 2026-05-09
Project: StarCards / KidLearn

## Goal

Move learning data from direct browser `localStorage` access to a storage abstraction that prefers local SQLite when available, while preserving Vercel compatibility.

The app should use SQLite by default in local dev or self-hosted Node environments. Vercel remains stateless, so production falls back to the existing browser `localStorage` behavior.

## Current State

The deck and streak are currently owned by `frontend/src/hooks/useDeck.js`.

Current browser storage keys:

- `starcards_deck`
- `starcards_streak`
- `starcards_lang`

The language preference should stay browser-local. The SQLite migration covers only learning data:

- generated cards
- review and mastery fields
- quiz disabled state
- quiz hint cache
- streak state

Vercel serverless functions cannot safely persist a SQLite database file. SQLite is suitable for local dev and self-hosted environments only.

## Product Rules

### Backend Selection

On startup, the frontend checks whether the SQLite storage API is available.

- If SQLite is available, use SQLite as the source of truth for learning data.
- If SQLite is unavailable, times out, or reports unsupported, use browser `localStorage`.
- Falling back to `localStorage` is the expected production behavior on Vercel.

After the app selects SQLite for a session, later write failures should not silently switch to `localStorage`. Silent switching would fork the child's learning data. Instead, the app should show a toast and keep the previous UI state.

### Local SQLite Scope

Local SQLite stores one shared family deck and one shared streak for everyone using the same local app/server.

There are no per-browser profiles in this design. Multiple browsers pointed at the same local server should eventually see the same deck.

### Existing Browser Data Migration

When SQLite is available, the app should perform a one-time automatic import from the old browser `localStorage` deck.

Migration rules:

- Import existing `starcards_deck` cards into SQLite.
- Dedupe by content fingerprint, not UUID.
- Existing SQLite content wins when a fingerprint already exists.
- Imported cards with duplicate fingerprints are skipped.
- The import is idempotent and can be retried safely.
- Keep the old `localStorage` deck in place so Vercel fallback still has data.
- Record import-attempt state per browser, not globally in SQLite, so each browser can import its own old local deck once.

The content fingerprint is derived from normalized card content:

- `subject`
- `word`
- `chinese`
- `pinyin`

Normalization should trim whitespace and use stable casing where appropriate.

### Language Preference

Language remains in browser `localStorage` through `starcards_lang`.

This avoids one browser's language toggle changing every other browser using the shared local SQLite deck.

## Architecture

Introduce a storage adapter boundary. React should no longer read or write learning data directly through `localStorage`.

Recommended modules:

### `frontend/src/lib/storage/cardModel.js`

Pure model helpers:

- migrate old card shapes to the current schema
- create new saved-card records
- normalize card fields for fingerprinting
- compute content fingerprints
- apply immutable card patches

This module must contain no I/O.

### `frontend/src/lib/storage/localStorageAdapter.js`

Fallback adapter that preserves the existing Vercel-compatible behavior.

It owns reads and writes for:

- deck
- streak

It should expose the same interface as the SQLite adapter.

### `frontend/src/lib/storage/sqliteClient.js`

Browser-side client for SQLite storage API routes.

It should know HTTP paths and response shapes, but not SQL. It sends requests to the local API and returns plain data.

### `frontend/src/lib/storage/storageAdapter.js`

Adapter selector and facade.

Responsibilities:

- call the SQLite health endpoint with a short timeout
- select SQLite when available
- select `localStorage` when unavailable
- run one-time browser deck import when SQLite is selected
- track browser import attempt state in browser `localStorage`
- expose one storage interface to `useDeck`

### `frontend/src/hooks/useDeck.js`

The hook remains the React state boundary for deck/streak UI state.

It should call the selected storage adapter for persistence and update React state from successful adapter results.

### SQLite API Routes

The server-side API owns:

- SQLite connection setup
- schema creation
- schema migrations
- CRUD operations
- import/dedupe logic
- streak persistence

The exact route layout can be chosen during implementation, but it should keep storage routes grouped under `/api/storage/*`.

## SQLite Data Model

### `cards`

Stores one row per flashcard.

Required columns:

- `id`
- `content_fingerprint`
- `schema_version`
- generated card content fields
- review/mastery fields
- quiz hint cache
- `created_at`
- `updated_at`

`content_fingerprint` should have a unique index.

Fields that are naturally structured, such as `quizHints`, may be stored as JSON text. SQL should not need to query inside those fields for this scope.

### `streak`

Stores one shared streak row.

Columns:

- `id`
- `count`
- `last_date`
- `updated_at`

The design uses a single row rather than per-profile streaks.

### `meta`

Stores storage metadata.

Columns:

- `key`
- `value`
- `updated_at`

Use cases:

- schema version
- database schema migration markers
- future storage feature flags

## Data Flow

### Startup In Local SQLite Mode

1. Load language from browser `localStorage`.
2. Check `/api/storage/health`.
3. Select the SQLite adapter if the health check succeeds.
4. Read old browser cards from `starcards_deck`.
5. If browser cards exist and this browser has not attempted SQLite import, send them to SQLite import.
6. SQLite inserts only new content fingerprints.
7. Mark this browser's SQLite import as attempted after the import request completes.
8. Load deck and streak from SQLite.
9. Use SQLite for all learning-data writes for the rest of the session.

### Startup On Vercel

1. Load language from browser `localStorage`.
2. Check `/api/storage/health`.
3. Health check fails or reports unavailable.
4. Select the `localStorage` adapter.
5. Continue with current production behavior.

### Writes

For add, delete, patch, mastery update, and streak update:

1. React calls the adapter.
2. The adapter persists the change.
3. The adapter returns the updated deck or streak.
4. React updates state from the returned value.

If the selected SQLite adapter cannot complete the write, the UI should show a toast and keep the previous state.

### Multi-Tab Behavior

The current `storage` event works only for `localStorage` mode.

In SQLite mode:

- the current tab updates immediately from API responses after writes
- other tabs can refresh deck/streak on window focus
- WebSockets or live subscriptions are out of scope

## Error Handling

SQLite unavailable during startup:

- select `localStorage`
- do not block the app
- do not show an error by default

SQLite write failure after SQLite was selected:

- keep previous state
- show a toast
- do not switch to `localStorage`

Migration failure:

- keep SQLite selected if regular load works
- show a non-blocking toast if useful
- allow retry on a future startup

Corrupt browser `localStorage` data:

- ignore invalid browser deck JSON
- do not block SQLite loading
- preserve current fallback behavior

Duplicate import content:

- skip duplicate fingerprint
- preserve existing SQLite row and review progress

## Testing Plan

Follow red-green-refactor.

### Pure Model Tests

Test `cardModel` helpers:

- migrating old card shapes
- defaulting missing review fields
- computing deterministic fingerprints
- normalizing whitespace
- deduping cards that differ only by UUID
- keeping distinct cards when subject or content differs

### Adapter Contract Tests

Run the same behavior expectations against both adapters where practical:

- load empty deck
- add card
- delete card
- patch card
- update mastery
- touch streak
- preserve immutable updates
- return updated state after successful persistence

### Storage Selection Tests

Test the adapter selector:

- chooses SQLite when health succeeds
- chooses `localStorage` when health fails
- chooses `localStorage` when health times out
- imports old browser cards once when SQLite is selected
- does not import duplicate content twice
- keeps language preference outside the storage adapter

### SQLite Repository Tests

Use a temporary SQLite database file or an in-memory database:

- creates schema
- lists an empty deck
- inserts cards
- enforces unique content fingerprints
- deletes cards
- patches cards
- updates mastery fields
- stores quiz hint JSON
- updates the single shared streak row

### React Hook Tests

Update `useDeck` tests to mock the storage adapter instead of mocking browser `localStorage` directly.

Keep the same user-visible behavior:

- starts with an empty deck
- adds cards
- rejects 500+ cards if that limit remains
- deletes cards
- patches cards
- updates mastery
- touches streak
- reports persistence failures through toast

### Manual Verification

Local SQLite:

- start local dev with SQLite API available
- import an existing browser deck automatically
- refresh and confirm cards persist from SQLite
- open a second browser window and confirm the shared deck appears after focus/refresh
- generate a card and confirm it appears in SQLite

Vercel compatibility:

- simulate an unavailable storage health endpoint
- confirm the app falls back to `localStorage`
- confirm existing production deck behavior still works

## Out Of Scope

- Hosted production database
- Authentication
- Per-child or per-browser profiles
- Cloud sync
- Replacing `starcards_lang`
- Live multi-tab subscriptions
- Data export redesign
- Quiz scheduling changes
