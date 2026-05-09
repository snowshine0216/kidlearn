# Local SQLite Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make learning data use local SQLite by default when the local storage API is available, while preserving Vercel browser `localStorage` fallback.

**Architecture:** Add a storage adapter boundary under `frontend/src/lib/storage/`. Local dev serves `/api/storage/*` from the Vite dev middleware using SQLite; Vercel has no storage route, so the frontend health check falls back to the existing `localStorage` behavior. `useDeck` becomes the React state boundary over the selected adapter.

**Tech Stack:** React 18, Vite dev middleware, Vitest, `better-sqlite3`, browser `localStorage`, existing Vercel root API functions for AI proxying.

---

## Scope Check

This plan covers one subsystem: learning-data persistence. It does not add hosted production storage, authentication, profiles, or live sync. The spec is narrow enough for one implementation plan.

## File Structure

Create:

- `frontend/src/lib/storage/cardModel.js` — pure card/streak migration and immutable deck helpers.
- `frontend/src/lib/storage/__tests__/cardModel.test.js` — pure model tests.
- `frontend/src/lib/storage/localStorageAdapter.js` — browser fallback adapter.
- `frontend/src/lib/storage/__tests__/localStorageAdapter.test.js` — fallback adapter behavior.
- `frontend/src/lib/storage/sqliteClient.js` — browser HTTP client for `/api/storage/*`.
- `frontend/src/lib/storage/storageAdapter.js` — backend selector and migration coordinator.
- `frontend/src/lib/storage/__tests__/storageAdapter.test.js` — health check, fallback, migration tests.
- `frontend/server/storage/sqliteRepository.js` — server-side SQLite schema and repository.
- `frontend/server/storage/__tests__/sqliteRepository.test.js` — temp database repository tests.
- `frontend/server/storage/storageRoutes.js` — Vite middleware router for local `/api/storage/*`.
- `frontend/server/storage/__tests__/storageRoutes.test.js` — route-level tests using mock requests/responses.

Modify:

- `.gitignore` — ignore local SQLite files.
- `frontend/package.json` and lockfile — add `better-sqlite3`.
- `frontend/vite.config.js` — register the local storage router in dev mode.
- `frontend/dev-api-plugin.test.js` — assert `/api/storage` is registered.
- `frontend/src/hooks/useDeck.js` — use selected storage adapter instead of direct browser storage.
- `frontend/src/hooks/__tests__/useDeck.test.js` — mock adapter-driven behavior.
- `README.md` — document local SQLite and Vercel fallback.

Implementation note: do not create root `api/storage/*` Vercel functions. In production, `/api/storage/health` should be absent or unavailable so the frontend falls back to browser `localStorage`.

---

### Task 1: Add SQLite Dependency And Local DB Ignore Rules

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `.gitignore`
- Modify: `frontend/dev-api-plugin.test.js`

- [ ] **Step 1: Write the failing dev plugin registration test**

Add this assertion to `frontend/dev-api-plugin.test.js` inside the existing test:

```js
expect(registeredPaths).toContain('/api/storage');
```

The test should become:

```js
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import createConfig from './vite.config.js';

describe('vite dev API plugin', () => {
  it('registers local dev API routes', () => {
    const use = vi.fn();
    const config = createConfig({ mode: 'test' });
    const devApiPlugin = config.plugins.find((plugin) => plugin?.name === 'dev-api');

    devApiPlugin.configureServer({ middlewares: { use } });

    const registeredPaths = use.mock.calls.map(([path]) => path);
    expect(registeredPaths).toContain('/api/quiz-hint');
    expect(registeredPaths).toContain('/api/storage');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- dev-api-plugin.test.js
```

Expected: FAIL because `/api/storage` is not registered yet.

- [ ] **Step 3: Add dependency and ignore rules**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm install better-sqlite3
```

Append these lines to root `.gitignore`:

```gitignore
data/
*.sqlite
*.sqlite-shm
*.sqlite-wal
```

- [ ] **Step 4: Register a temporary storage middleware**

In `frontend/vite.config.js`, inside `configureServer(server)`, add this registration before the existing `/api/generate` middleware:

```js
server.middlewares.use('/api/storage', (_req, res) => {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ available: false, backend: 'sqlite' }));
});
```

This is temporary. Task 6 replaces it with the real storage router.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- dev-api-plugin.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .gitignore frontend/package.json frontend/package-lock.json frontend/dev-api-plugin.test.js frontend/vite.config.js
git commit -m "chore: prepare local sqlite storage"
```

---

### Task 2: Extract Pure Card And Streak Model Helpers

**Files:**
- Create: `frontend/src/lib/storage/cardModel.js`
- Create: `frontend/src/lib/storage/__tests__/cardModel.test.js`

- [ ] **Step 1: Write failing pure model tests**

Create `frontend/src/lib/storage/__tests__/cardModel.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage/__tests__/cardModel.test.js
```

Expected: FAIL because `cardModel.js` does not exist.

- [ ] **Step 3: Implement pure model helpers**

Create `frontend/src/lib/storage/cardModel.js`:

```js
import { applyMasteryResult } from '../quizLogic';

export const DECK_KEY = 'starcards_deck';
export const STREAK_KEY = 'starcards_streak';
export const SQLITE_IMPORT_ATTEMPTED_KEY = 'starcards_sqlite_import_attempted_v1';
export const DEFAULT_STREAK = { count: 0, lastDate: null };
export const MAX_DECK_SIZE = 500;

export function migrateCard(card) {
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

export function createSavedCard(card, { id, now } = {}) {
  const resolvedId = id ?? crypto.randomUUID();
  const resolvedNow = now ?? Date.now();

  return migrateCard({
    ...card,
    id: resolvedId,
    style: 'illustrated',
    savedAt: resolvedNow,
  });
}

const normalizePart = (value, { lower = false } = {}) => {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return lower ? normalized.toLocaleLowerCase() : normalized;
};

export function cardContentFingerprint(card) {
  return [
    normalizePart(card.subject, { lower: true }),
    normalizePart(card.word, { lower: true }),
    normalizePart(card.chinese),
    normalizePart(card.pinyin, { lower: true }),
  ].join('|');
}

export function parseDeckJson(raw) {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(migrateCard) : [];
  } catch {
    return [];
  }
}

export function parseStreakJson(raw) {
  try {
    if (!raw) return DEFAULT_STREAK;
    const parsed = JSON.parse(raw);
    return {
      count: Number.isFinite(parsed.count) ? parsed.count : DEFAULT_STREAK.count,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : DEFAULT_STREAK.lastDate,
    };
  } catch {
    return DEFAULT_STREAK;
  }
}

export function nextDeckWithPatchedCard(deck, id, fields) {
  return deck.map((card) => (card.id === id ? migrateCard({ ...card, ...fields }) : card));
}

export function nextDeckWithMastery(deck, id, correct) {
  return deck.map((card) => (card.id === id ? migrateCard(applyMasteryResult(card, correct)) : card));
}

export function nextDeckWithReport(deck, id, knewIt, now = Date.now()) {
  return deck.map((card) => (
    card.id === id
      ? migrateCard({ ...card, knewIt, reviewedAt: now })
      : card
  ));
}

const localDate = (time) => new Date(time).toLocaleDateString('sv');

export function nextStreak(streak, now = Date.now()) {
  const today = localDate(now);
  if (streak.lastDate === today) return streak;

  const yesterday = localDate(now - 86400000);
  return {
    count: streak.lastDate === yesterday ? streak.count + 1 : 1,
    lastDate: today,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage/__tests__/cardModel.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/storage/cardModel.js frontend/src/lib/storage/__tests__/cardModel.test.js
git commit -m "feat: add storage card model"
```

---

### Task 3: Implement Browser LocalStorage Adapter

**Files:**
- Create: `frontend/src/lib/storage/localStorageAdapter.js`
- Create: `frontend/src/lib/storage/__tests__/localStorageAdapter.test.js`

- [ ] **Step 1: Write failing localStorage adapter tests**

Create `frontend/src/lib/storage/__tests__/localStorageAdapter.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECK_KEY, STREAK_KEY } from '../cardModel';
import { createLocalStorageAdapter } from '../localStorageAdapter';

const makeStorage = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store = { ...store, [key]: String(value) }; }),
    removeItem: vi.fn((key) => {
      const { [key]: _removed, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => { store = {}; }),
  };
};

const baseCard = {
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The <em>butterfly</em> flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
};

describe('createLocalStorageAdapter', () => {
  let storage;
  let adapter;

  beforeEach(() => {
    storage = makeStorage();
    adapter = createLocalStorageAdapter({
      storage,
      idFactory: () => 'card-1',
      now: () => new Date('2026-05-09T10:00:00+08:00').getTime(),
    });
  });

  it('loads empty deck and default streak', async () => {
    await expect(adapter.load()).resolves.toEqual({
      deck: [],
      streak: { count: 0, lastDate: null },
    });
  });

  it('adds a card and persists deck json', async () => {
    const result = await adapter.addCard(baseCard, []);

    expect(result.card.id).toBe('card-1');
    expect(result.deck).toHaveLength(1);
    expect(JSON.parse(storage.getItem(DECK_KEY))).toHaveLength(1);
  });

  it('rejects deck overflow with the existing user-facing error', async () => {
    const fullDeck = Array.from({ length: 500 }, (_, index) => ({ ...baseCard, id: `card-${index}` }));

    await expect(adapter.addCard(baseCard, fullDeck)).resolves.toEqual({
      error: 'Your deck has 500+ cards! Consider deleting some.',
    });
  });

  it('deletes a card and persists the next deck', async () => {
    const deck = [{ ...baseCard, id: 'card-1' }];

    const result = await adapter.deleteCard('card-1', deck);

    expect(result.deck).toEqual([]);
    expect(JSON.parse(storage.getItem(DECK_KEY))).toEqual([]);
  });

  it('patches a card and preserves existing fields', async () => {
    const deck = [{ ...baseCard, id: 'card-1' }];

    const result = await adapter.patchCard('card-1', { quizDisabled: true }, deck);

    expect(result.deck[0].quizDisabled).toBe(true);
    expect(result.deck[0].word).toBe('butterfly');
  });

  it('updates mastery fields', async () => {
    const deck = [{ ...baseCard, id: 'card-1', mastery: null, reviewCount: null, nextReviewAt: null }];

    const result = await adapter.updateCardMastery('card-1', false, deck);

    expect(result.deck[0].needsPractice).toBe(true);
    expect(result.deck[0].reviewCount).toBe(1);
  });

  it('updates report fields and streak', async () => {
    const deck = [{ ...baseCard, id: 'card-1' }];

    const result = await adapter.reportCard('card-1', true, deck);

    expect(result.deck[0].knewIt).toBe(true);
    expect(result.deck[0].reviewedAt).not.toBeNull();
    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
    expect(JSON.parse(storage.getItem(STREAK_KEY))).toEqual({ count: 1, lastDate: '2026-05-09' });
  });

  it('touches streak without changing deck', async () => {
    const result = await adapter.touchStreak();

    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage/__tests__/localStorageAdapter.test.js
```

Expected: FAIL because `localStorageAdapter.js` does not exist.

- [ ] **Step 3: Implement localStorage adapter**

Create `frontend/src/lib/storage/localStorageAdapter.js`:

```js
import {
  DECK_KEY,
  MAX_DECK_SIZE,
  STREAK_KEY,
  createSavedCard,
  nextDeckWithMastery,
  nextDeckWithPatchedCard,
  nextDeckWithReport,
  nextStreak,
  parseDeckJson,
  parseStreakJson,
} from './cardModel';

const saveJson = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
    return null;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      return new Error('Deck is full — delete some cards to save more');
    }
    return error;
  }
};

const loadDeck = (storage) => parseDeckJson(storage.getItem(DECK_KEY));
const loadStreak = (storage) => parseStreakJson(storage.getItem(STREAK_KEY));

const saveDeck = (storage, deck) => saveJson(storage, DECK_KEY, deck);
const saveStreak = (storage, streak) => saveJson(storage, STREAK_KEY, streak);

export function createLocalStorageAdapter({
  storage = localStorage,
  idFactory = () => crypto.randomUUID(),
  now = () => Date.now(),
} = {}) {
  const load = async () => ({
    deck: loadDeck(storage),
    streak: loadStreak(storage),
  });

  const addCard = async (card, currentDeck) => {
    if (currentDeck.length >= MAX_DECK_SIZE) {
      return { error: 'Your deck has 500+ cards! Consider deleting some.' };
    }

    const savedCard = createSavedCard(card, { id: idFactory(), now: now() });
    const deck = [savedCard, ...currentDeck];
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck, card: savedCard };
  };

  const deleteCard = async (id, currentDeck) => {
    const deck = currentDeck.filter((card) => card.id !== id);
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck };
  };

  const patchCard = async (id, fields, currentDeck) => {
    const deck = nextDeckWithPatchedCard(currentDeck, id, fields);
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck };
  };

  const updateCardMastery = async (id, correct, currentDeck) => {
    const deck = nextDeckWithMastery(currentDeck, id, correct);
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck };
  };

  const reportCard = async (id, knewIt, currentDeck) => {
    const deck = nextDeckWithReport(currentDeck, id, knewIt, now());
    const streak = nextStreak(loadStreak(storage), now());
    const deckError = saveDeck(storage, deck);
    if (deckError) return { error: deckError.message };
    const streakError = saveStreak(storage, streak);
    if (streakError) return { error: streakError.message };
    return { deck, streak };
  };

  const touchStreak = async () => {
    const streak = nextStreak(loadStreak(storage), now());
    const error = saveStreak(storage, streak);
    if (error) return { error: error.message };
    return { streak };
  };

  return {
    kind: 'localStorage',
    load,
    refresh: load,
    addCard,
    deleteCard,
    patchCard,
    updateCardMastery,
    reportCard,
    touchStreak,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage/__tests__/localStorageAdapter.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/storage/localStorageAdapter.js frontend/src/lib/storage/__tests__/localStorageAdapter.test.js
git commit -m "feat: add local storage adapter"
```

---

### Task 4: Add SQLite Client And Storage Selector

**Files:**
- Create: `frontend/src/lib/storage/sqliteClient.js`
- Create: `frontend/src/lib/storage/storageAdapter.js`
- Create: `frontend/src/lib/storage/__tests__/storageAdapter.test.js`

- [ ] **Step 1: Write failing storage selector tests**

Create `frontend/src/lib/storage/__tests__/storageAdapter.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';
import { DECK_KEY, SQLITE_IMPORT_ATTEMPTED_KEY } from '../cardModel';
import { createStorageAdapter } from '../storageAdapter';

const makeStorage = (initial = {}) => {
  let store = { ...initial };
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store = { ...store, [key]: String(value) }; }),
    removeItem: vi.fn((key) => {
      const { [key]: _removed, ...rest } = store;
      store = rest;
    }),
  };
};

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe('createStorageAdapter', () => {
  it('chooses sqlite when health succeeds', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === '/api/storage/health') return jsonResponse({ available: true });
      if (url === '/api/storage/import') return jsonResponse({ imported: 0, skipped: 0 });
      throw new Error(`unexpected url ${url}`);
    });

    const adapter = await createStorageAdapter({ fetchImpl, storage: makeStorage() });

    expect(adapter.kind).toBe('sqlite');
  });

  it('chooses localStorage when health fails', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ available: false }, false, 503));

    const adapter = await createStorageAdapter({ fetchImpl, storage: makeStorage() });

    expect(adapter.kind).toBe('localStorage');
  });

  it('chooses localStorage when health check times out', async () => {
    const fetchImpl = vi.fn(() => new Promise(() => {}));

    const adapter = await createStorageAdapter({
      fetchImpl,
      storage: makeStorage(),
      healthTimeoutMs: 1,
    });

    expect(adapter.kind).toBe('localStorage');
  });

  it('imports existing browser deck once when sqlite is selected', async () => {
    const cards = [{ id: 'old-1', word: 'cat', subject: 'english' }];
    const storage = makeStorage({ [DECK_KEY]: JSON.stringify(cards) });
    const fetchImpl = vi.fn(async (url, options) => {
      if (url === '/api/storage/health') return jsonResponse({ available: true });
      if (url === '/api/storage/import') {
        expect(JSON.parse(options.body)).toEqual({ cards });
        return jsonResponse({ imported: 1, skipped: 0 });
      }
      throw new Error(`unexpected url ${url}`);
    });

    await createStorageAdapter({ fetchImpl, storage });

    expect(storage.setItem).toHaveBeenCalledWith(SQLITE_IMPORT_ATTEMPTED_KEY, 'true');
  });

  it('does not import when this browser already attempted import', async () => {
    const storage = makeStorage({
      [DECK_KEY]: JSON.stringify([{ id: 'old-1', word: 'cat', subject: 'english' }]),
      [SQLITE_IMPORT_ATTEMPTED_KEY]: 'true',
    });
    const fetchImpl = vi.fn(async (url) => {
      if (url === '/api/storage/health') return jsonResponse({ available: true });
      throw new Error(`unexpected url ${url}`);
    });

    await createStorageAdapter({ fetchImpl, storage });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage/__tests__/storageAdapter.test.js
```

Expected: FAIL because `storageAdapter.js` and `sqliteClient.js` do not exist.

- [ ] **Step 3: Implement SQLite HTTP client**

Create `frontend/src/lib/storage/sqliteClient.js`:

```js
const jsonRequest = async (fetchImpl, url, options = {}) => {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Storage request failed: ${response.status}`);
  }
  return body;
};

export function createSqliteClient({ fetchImpl = fetch } = {}) {
  const post = (url, body) => jsonRequest(fetchImpl, url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const patch = (url, body) => jsonRequest(fetchImpl, url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  const del = (url) => jsonRequest(fetchImpl, url, { method: 'DELETE' });

  return {
    health: () => jsonRequest(fetchImpl, '/api/storage/health'),
    load: () => jsonRequest(fetchImpl, '/api/storage/state'),
    importCards: (cards) => post('/api/storage/import', { cards }),
    addCard: (card) => post('/api/storage/cards', { card }),
    deleteCard: (id) => del(`/api/storage/cards/${encodeURIComponent(id)}`),
    patchCard: (id, fields) => patch(`/api/storage/cards/${encodeURIComponent(id)}`, { fields }),
    updateCardMastery: (id, correct) => post(`/api/storage/cards/${encodeURIComponent(id)}/mastery`, { correct }),
    reportCard: (id, knewIt) => post(`/api/storage/cards/${encodeURIComponent(id)}/report`, { knewIt }),
    touchStreak: () => post('/api/storage/streak/touch', {}),
  };
}

export function createSqliteAdapter(client) {
  return {
    kind: 'sqlite',
    load: client.load,
    refresh: client.load,
    addCard: async (card) => client.addCard(card),
    deleteCard: async (id) => client.deleteCard(id),
    patchCard: async (id, fields) => client.patchCard(id, fields),
    updateCardMastery: async (id, correct) => client.updateCardMastery(id, correct),
    reportCard: async (id, knewIt) => client.reportCard(id, knewIt),
    touchStreak: async () => client.touchStreak(),
  };
}
```

- [ ] **Step 4: Implement storage selector**

Create `frontend/src/lib/storage/storageAdapter.js`:

```js
import {
  DECK_KEY,
  SQLITE_IMPORT_ATTEMPTED_KEY,
  parseDeckJson,
} from './cardModel';
import { createLocalStorageAdapter } from './localStorageAdapter';
import { createSqliteAdapter, createSqliteClient } from './sqliteClient';

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Storage health check timed out')), timeoutMs);
  promise
    .then(resolve)
    .catch(reject)
    .finally(() => clearTimeout(timer));
});

const importOldBrowserDeck = async ({ client, storage }) => {
  if (storage.getItem(SQLITE_IMPORT_ATTEMPTED_KEY) === 'true') return;

  const cards = parseDeckJson(storage.getItem(DECK_KEY));
  if (cards.length === 0) {
    storage.setItem(SQLITE_IMPORT_ATTEMPTED_KEY, 'true');
    return;
  }

  await client.importCards(cards);
  storage.setItem(SQLITE_IMPORT_ATTEMPTED_KEY, 'true');
};

export async function createStorageAdapter({
  fetchImpl = fetch,
  storage = localStorage,
  idFactory,
  now,
  healthTimeoutMs = 500,
} = {}) {
  const localStorageAdapter = createLocalStorageAdapter({ storage, idFactory, now });
  const client = createSqliteClient({ fetchImpl });

  try {
    const health = await withTimeout(client.health(), healthTimeoutMs);
    if (health.available !== true) return localStorageAdapter;
    await importOldBrowserDeck({ client, storage });
    return createSqliteAdapter(client);
  } catch {
    return localStorageAdapter;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage/__tests__/storageAdapter.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/storage/sqliteClient.js frontend/src/lib/storage/storageAdapter.js frontend/src/lib/storage/__tests__/storageAdapter.test.js
git commit -m "feat: select sqlite or local storage"
```

---

### Task 5: Implement SQLite Repository

**Files:**
- Create: `frontend/server/storage/sqliteRepository.js`
- Create: `frontend/server/storage/__tests__/sqliteRepository.test.js`

- [ ] **Step 1: Write failing repository tests**

Create `frontend/server/storage/__tests__/sqliteRepository.test.js`:

```js
// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../sqliteRepository';

const baseCard = {
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The <em>butterfly</em> flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
};

describe('createSqliteRepository', () => {
  let dir;
  let repo;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'starcards-test-'));
    repo = createSqliteRepository({
      dbPath: path.join(dir, 'test.sqlite'),
      idFactory: () => 'card-1',
      now: () => new Date('2026-05-09T10:00:00+08:00').getTime(),
    });
  });

  afterEach(() => {
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts with an empty deck and default streak', () => {
    expect(repo.load()).toEqual({ deck: [], streak: { count: 0, lastDate: null } });
  });

  it('adds and lists cards', () => {
    const result = repo.addCard(baseCard);

    expect(result.card.id).toBe('card-1');
    expect(result.deck).toHaveLength(1);
    expect(repo.load().deck[0].word).toBe('butterfly');
  });

  it('imports cards with content fingerprint dedupe', () => {
    const importResult = repo.importCards([
      { ...baseCard, id: 'old-a' },
      { ...baseCard, id: 'old-b', word: ' Butterfly ' },
    ]);

    expect(importResult).toEqual({ imported: 1, skipped: 1 });
    expect(repo.load().deck).toHaveLength(1);
    expect(repo.load().deck[0].id).toBe('old-a');
  });

  it('deletes cards', () => {
    repo.addCard(baseCard);

    const result = repo.deleteCard('card-1');

    expect(result.deck).toEqual([]);
  });

  it('patches card fields', () => {
    repo.addCard(baseCard);

    const result = repo.patchCard('card-1', { quizDisabled: true, quizHints: { reading: { encouragement: '好棒' } } });

    expect(result.deck[0].quizDisabled).toBe(true);
    expect(result.deck[0].quizHints.reading.encouragement).toBe('好棒');
  });

  it('updates mastery', () => {
    repo.addCard(baseCard);

    const result = repo.updateCardMastery('card-1', false);

    expect(result.deck[0].needsPractice).toBe(true);
    expect(result.deck[0].reviewCount).toBe(1);
  });

  it('updates report fields and streak', () => {
    repo.addCard(baseCard);

    const result = repo.reportCard('card-1', true);

    expect(result.deck[0].knewIt).toBe(true);
    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });

  it('touches the shared streak row', () => {
    const result = repo.touchStreak();

    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- server/storage/__tests__/sqliteRepository.test.js
```

Expected: FAIL because `sqliteRepository.js` does not exist.

- [ ] **Step 3: Implement SQLite repository**

Create `frontend/server/storage/sqliteRepository.js`:

```js
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_STREAK,
  cardContentFingerprint,
  createSavedCard,
  migrateCard,
  nextDeckWithMastery,
  nextDeckWithPatchedCard,
  nextDeckWithReport,
  nextStreak,
} from '../../src/lib/storage/cardModel.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const defaultDbPath = path.join(repoRoot, 'data', 'starcards.sqlite');

const boolToDb = (value) => (value === undefined || value === null ? null : value ? 1 : 0);
const boolFromDb = (value) => (value === null || value === undefined ? value : value === 1);
const jsonToDb = (value) => (value === undefined || value === null ? null : JSON.stringify(value));
const jsonFromDb = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const rowToCard = (row) => migrateCard({
  id: row.id,
  schemaVersion: row.schema_version,
  emoji: row.emoji,
  word: row.word,
  chinese: row.chinese,
  pinyin: row.pinyin,
  sentence: row.sentence,
  sentence_zh: row.sentence_zh,
  mnemonic: row.mnemonic,
  mascot_message: row.mascot_message,
  color_theme: row.color_theme,
  subject: row.subject,
  style: row.style,
  savedAt: row.saved_at,
  knewIt: boolFromDb(row.knew_it),
  reviewedAt: row.reviewed_at,
  mastery: row.mastery,
  reviewCount: row.review_count,
  lastReviewedAt: row.last_reviewed_at,
  nextReviewAt: row.next_review_at,
  needsPractice: row.needs_practice === 1,
  quizDisabled: boolFromDb(row.quiz_disabled),
  quizHints: jsonFromDb(row.quiz_hints_json),
});

const cardToParams = (card, now) => ({
  id: card.id,
  content_fingerprint: cardContentFingerprint(card),
  schema_version: card.schemaVersion ?? 1,
  emoji: card.emoji ?? null,
  word: card.word ?? null,
  chinese: card.chinese ?? null,
  pinyin: card.pinyin ?? null,
  sentence: card.sentence ?? null,
  sentence_zh: card.sentence_zh ?? null,
  mnemonic: card.mnemonic ?? null,
  mascot_message: card.mascot_message ?? null,
  color_theme: card.color_theme ?? null,
  subject: card.subject ?? null,
  style: card.style ?? null,
  saved_at: card.savedAt ?? now,
  knew_it: boolToDb(card.knewIt),
  reviewed_at: card.reviewedAt ?? null,
  mastery: card.mastery ?? null,
  review_count: card.reviewCount ?? null,
  last_reviewed_at: card.lastReviewedAt ?? null,
  next_review_at: card.nextReviewAt ?? null,
  needs_practice: card.needsPractice ? 1 : 0,
  quiz_disabled: boolToDb(card.quizDisabled),
  quiz_hints_json: jsonToDb(card.quizHints),
  updated_at: now,
});

const schema = `
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  content_fingerprint TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  emoji TEXT,
  word TEXT,
  chinese TEXT,
  pinyin TEXT,
  sentence TEXT,
  sentence_zh TEXT,
  mnemonic TEXT,
  mascot_message TEXT,
  color_theme TEXT,
  subject TEXT,
  style TEXT,
  saved_at INTEGER,
  knew_it INTEGER,
  reviewed_at INTEGER,
  mastery INTEGER,
  review_count INTEGER,
  last_reviewed_at INTEGER,
  next_review_at INTEGER,
  needs_practice INTEGER NOT NULL DEFAULT 0,
  quiz_disabled INTEGER,
  quiz_hints_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS streak (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  last_date TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export function createSqliteRepository({
  dbPath = defaultDbPath,
  idFactory = () => crypto.randomUUID(),
  now = () => Date.now(),
} = {}) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  db.prepare('INSERT OR REPLACE INTO meta (key, value, updated_at) VALUES (?, ?, ?)').run('schema_version', '1', now());

  const listDeck = () => db
    .prepare('SELECT * FROM cards ORDER BY saved_at DESC, created_at DESC')
    .all()
    .map(rowToCard);

  const loadStreak = () => {
    const row = db.prepare('SELECT count, last_date FROM streak WHERE id = ?').get('shared');
    return row ? { count: row.count, lastDate: row.last_date } : DEFAULT_STREAK;
  };

  const saveStreak = (streak) => {
    db.prepare(`
      INSERT INTO streak (id, count, last_date, updated_at)
      VALUES ('shared', @count, @lastDate, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        count = excluded.count,
        last_date = excluded.last_date,
        updated_at = excluded.updated_at
    `).run({ count: streak.count, lastDate: streak.lastDate, updatedAt: now() });
    return streak;
  };

  const insertCard = db.prepare(`
    INSERT INTO cards (
      id, content_fingerprint, schema_version, emoji, word, chinese, pinyin,
      sentence, sentence_zh, mnemonic, mascot_message, color_theme, subject,
      style, saved_at, knew_it, reviewed_at, mastery, review_count,
      last_reviewed_at, next_review_at, needs_practice, quiz_disabled,
      quiz_hints_json, updated_at
    ) VALUES (
      @id, @content_fingerprint, @schema_version, @emoji, @word, @chinese, @pinyin,
      @sentence, @sentence_zh, @mnemonic, @mascot_message, @color_theme, @subject,
      @style, @saved_at, @knew_it, @reviewed_at, @mastery, @review_count,
      @last_reviewed_at, @next_review_at, @needs_practice, @quiz_disabled,
      @quiz_hints_json, @updated_at
    )
  `);

  const replaceCard = db.prepare(`
    UPDATE cards SET
      content_fingerprint = @content_fingerprint,
      schema_version = @schema_version,
      emoji = @emoji,
      word = @word,
      chinese = @chinese,
      pinyin = @pinyin,
      sentence = @sentence,
      sentence_zh = @sentence_zh,
      mnemonic = @mnemonic,
      mascot_message = @mascot_message,
      color_theme = @color_theme,
      subject = @subject,
      style = @style,
      saved_at = @saved_at,
      knew_it = @knew_it,
      reviewed_at = @reviewed_at,
      mastery = @mastery,
      review_count = @review_count,
      last_reviewed_at = @last_reviewed_at,
      next_review_at = @next_review_at,
      needs_practice = @needs_practice,
      quiz_disabled = @quiz_disabled,
      quiz_hints_json = @quiz_hints_json,
      updated_at = @updated_at
    WHERE id = @id
  `);

  const load = () => ({ deck: listDeck(), streak: loadStreak() });

  const addCard = (card) => {
    const savedCard = createSavedCard(card, { id: idFactory(), now: now() });
    insertCard.run(cardToParams(savedCard, now()));
    return { ...load(), card: savedCard };
  };

  const importCards = (cards) => {
    const insertMany = db.transaction((inputCards) => inputCards.reduce((acc, card) => {
      const migrated = migrateCard(card);
      const result = insertCard.run(cardToParams(migrated, now()));
      return {
        imported: acc.imported + result.changes,
        skipped: acc.skipped + (result.changes === 0 ? 1 : 0),
      };
    }, { imported: 0, skipped: 0 }));

    return insertMany(cards);
  };

  const deleteCard = (id) => {
    db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    return load();
  };

  const updateOneCard = (id, updater) => {
    const current = listDeck().find((card) => card.id === id);
    if (!current) return load();
    const nextCard = updater(current);
    replaceCard.run(cardToParams(nextCard, now()));
    return load();
  };

  const patchCard = (id, fields) => updateOneCard(id, (card) => (
    nextDeckWithPatchedCard([card], id, fields)[0]
  ));

  const updateCardMastery = (id, correct) => updateOneCard(id, (card) => (
    nextDeckWithMastery([card], id, correct)[0]
  ));

  const reportCard = (id, knewIt) => {
    const result = updateOneCard(id, (card) => nextDeckWithReport([card], id, knewIt, now())[0]);
    const streak = saveStreak(nextStreak(loadStreak(), now()));
    return { ...result, streak };
  };

  const touchStreak = () => {
    const streak = saveStreak(nextStreak(loadStreak(), now()));
    return { deck: listDeck(), streak };
  };

  return {
    load,
    addCard,
    importCards,
    deleteCard,
    patchCard,
    updateCardMastery,
    reportCard,
    touchStreak,
    close: () => db.close(),
  };
}
```

- [ ] **Step 4: Fix import dedupe insert mode**

In `frontend/server/storage/sqliteRepository.js`, change the `insertCard` SQL from `INSERT INTO cards` to `INSERT OR IGNORE INTO cards`.

The first line of the statement should be:

```sql
    INSERT OR IGNORE INTO cards (
```

This makes import idempotent and also avoids hard failure when adding duplicate content. The UI will receive an unchanged deck for duplicate content.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- server/storage/__tests__/sqliteRepository.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/server/storage/sqliteRepository.js frontend/server/storage/__tests__/sqliteRepository.test.js
git commit -m "feat: add sqlite storage repository"
```

---

### Task 6: Add Local Storage API Routes To Vite Dev Server

**Files:**
- Create: `frontend/server/storage/storageRoutes.js`
- Create: `frontend/server/storage/__tests__/storageRoutes.test.js`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/dev-api-plugin.test.js`

- [ ] **Step 1: Write failing storage route tests**

Create `frontend/server/storage/__tests__/storageRoutes.test.js`:

```js
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createStorageRouter } from '../storageRoutes';

const makeReq = ({ method = 'GET', url = '/health', body } = {}) => ({
  method,
  url,
  on(event, handler) {
    if (event === 'data' && body !== undefined) handler(Buffer.from(JSON.stringify(body)));
    if (event === 'end') handler();
  },
});

const makeRes = () => {
  const headers = {};
  return {
    statusCode: 200,
    body: '',
    setHeader: vi.fn((key, value) => { headers[key] = value; }),
    end: vi.fn(function end(value = '') { this.body = value; }),
    json() {
      return JSON.parse(this.body);
    },
  };
};

const makeRepo = () => ({
  load: vi.fn(() => ({ deck: [], streak: { count: 0, lastDate: null } })),
  importCards: vi.fn(() => ({ imported: 1, skipped: 0 })),
  addCard: vi.fn(() => ({ deck: [{ id: 'card-1' }], streak: { count: 0, lastDate: null }, card: { id: 'card-1' } })),
  deleteCard: vi.fn(() => ({ deck: [], streak: { count: 0, lastDate: null } })),
  patchCard: vi.fn(() => ({ deck: [{ id: 'card-1', quizDisabled: true }], streak: { count: 0, lastDate: null } })),
  updateCardMastery: vi.fn(() => ({ deck: [{ id: 'card-1', needsPractice: true }], streak: { count: 0, lastDate: null } })),
  reportCard: vi.fn(() => ({ deck: [{ id: 'card-1', knewIt: true }], streak: { count: 1, lastDate: '2026-05-09' } })),
  touchStreak: vi.fn(() => ({ deck: [], streak: { count: 1, lastDate: '2026-05-09' } })),
});

const call = async (router, req) => {
  const res = makeRes();
  const next = vi.fn();
  await router(req, res, next);
  return { res, next };
};

describe('createStorageRouter', () => {
  it('returns healthy sqlite status', async () => {
    const router = createStorageRouter({ repoFactory: makeRepo });

    const { res } = await call(router, makeReq({ url: '/health' }));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ available: true, backend: 'sqlite' });
  });

  it('returns state', async () => {
    const router = createStorageRouter({ repoFactory: makeRepo });

    const { res } = await call(router, makeReq({ url: '/state' }));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deck: [], streak: { count: 0, lastDate: null } });
  });

  it('imports cards', async () => {
    const repo = makeRepo();
    const router = createStorageRouter({ repoFactory: () => repo });

    const { res } = await call(router, makeReq({ method: 'POST', url: '/import', body: { cards: [{ id: 'old-1' }] } }));

    expect(res.statusCode).toBe(200);
    expect(repo.importCards).toHaveBeenCalledWith([{ id: 'old-1' }]);
    expect(res.json()).toEqual({ imported: 1, skipped: 0 });
  });

  it('patches a card', async () => {
    const repo = makeRepo();
    const router = createStorageRouter({ repoFactory: () => repo });

    const { res } = await call(router, makeReq({ method: 'PATCH', url: '/cards/card-1', body: { fields: { quizDisabled: true } } }));

    expect(res.statusCode).toBe(200);
    expect(repo.patchCard).toHaveBeenCalledWith('card-1', { quizDisabled: true });
  });

  it('passes unknown routes to next middleware', async () => {
    const router = createStorageRouter({ repoFactory: makeRepo });

    const { next } = await call(router, makeReq({ method: 'GET', url: '/unknown' }));

    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- server/storage/__tests__/storageRoutes.test.js
```

Expected: FAIL because `storageRoutes.js` does not exist.

- [ ] **Step 3: Implement storage router**

Create `frontend/server/storage/storageRoutes.js`:

```js
import { createSqliteRepository } from './sqliteRepository.js';

const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    try {
      resolve(data ? JSON.parse(data) : {});
    } catch {
      resolve({});
    }
  });
  req.on('error', reject);
});

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const routePath = (req) => {
  const url = new URL(req.url, 'http://localhost');
  return url.pathname;
};

const cardIdFromPath = (pathname, suffix = '') => {
  const match = pathname.match(new RegExp(`^/cards/([^/]+)${suffix}$`));
  return match ? decodeURIComponent(match[1]) : null;
};

export function createStorageRouter({ repoFactory = createSqliteRepository } = {}) {
  let repo;
  const getRepo = () => {
    repo = repo ?? repoFactory();
    return repo;
  };

  return async function storageRouter(req, res, next) {
    const pathname = routePath(req);

    try {
      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { available: true, backend: 'sqlite' });
      }

      if (req.method === 'GET' && pathname === '/state') {
        return sendJson(res, 200, getRepo().load());
      }

      if (req.method === 'POST' && pathname === '/import') {
        const { cards } = await readBody(req);
        return sendJson(res, 200, getRepo().importCards(Array.isArray(cards) ? cards : []));
      }

      if (req.method === 'POST' && pathname === '/cards') {
        const { card } = await readBody(req);
        return sendJson(res, 200, getRepo().addCard(card ?? {}));
      }

      const cardId = cardIdFromPath(pathname);
      if (req.method === 'DELETE' && cardId) {
        return sendJson(res, 200, getRepo().deleteCard(cardId));
      }

      if (req.method === 'PATCH' && cardId) {
        const { fields } = await readBody(req);
        return sendJson(res, 200, getRepo().patchCard(cardId, fields ?? {}));
      }

      const masteryId = cardIdFromPath(pathname, '/mastery');
      if (req.method === 'POST' && masteryId) {
        const { correct } = await readBody(req);
        return sendJson(res, 200, getRepo().updateCardMastery(masteryId, correct === true));
      }

      const reportId = cardIdFromPath(pathname, '/report');
      if (req.method === 'POST' && reportId) {
        const { knewIt } = await readBody(req);
        return sendJson(res, 200, getRepo().reportCard(reportId, knewIt === true));
      }

      if (req.method === 'POST' && pathname === '/streak/touch') {
        return sendJson(res, 200, getRepo().touchStreak());
      }

      return next();
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  };
}
```

- [ ] **Step 4: Replace temporary Vite middleware with real router**

At the top of `frontend/vite.config.js`, add:

```js
import { createStorageRouter } from './server/storage/storageRoutes.js';
```

Inside `configureServer(server)`, replace the temporary `/api/storage` middleware from Task 1 with:

```js
server.middlewares.use('/api/storage', createStorageRouter());
```

- [ ] **Step 5: Run route and plugin tests**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- server/storage/__tests__/storageRoutes.test.js dev-api-plugin.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/server/storage/storageRoutes.js frontend/server/storage/__tests__/storageRoutes.test.js frontend/vite.config.js frontend/dev-api-plugin.test.js
git commit -m "feat: serve local sqlite storage api"
```

---

### Task 7: Integrate Storage Adapter Into `useDeck`

**Files:**
- Modify: `frontend/src/hooks/useDeck.js`
- Modify: `frontend/src/hooks/__tests__/useDeck.test.js`

- [ ] **Step 1: Rewrite hook tests around adapter behavior**

Replace `frontend/src/hooks/__tests__/useDeck.test.js` with adapter-mocked tests:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDeck } from '../useDeck';

vi.mock('../../lib/storage/storageAdapter', () => ({
  createStorageAdapter: vi.fn(),
}));

import { createStorageAdapter } from '../../lib/storage/storageAdapter';

const mockCard = {
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The butterfly flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
};

const makeAdapter = () => {
  let deck = [];
  let streak = { count: 0, lastDate: null };

  return {
    kind: 'localStorage',
    load: vi.fn(async () => ({ deck, streak })),
    refresh: vi.fn(async () => ({ deck, streak })),
    addCard: vi.fn(async (card) => {
      const saved = { ...card, id: 'card-1', savedAt: 1000 };
      deck = [saved, ...deck];
      return { deck, card: saved };
    }),
    deleteCard: vi.fn(async (id) => {
      deck = deck.filter((card) => card.id !== id);
      return { deck };
    }),
    reportCard: vi.fn(async (id, knewIt) => {
      deck = deck.map((card) => (card.id === id ? { ...card, knewIt, reviewedAt: 1000 } : card));
      streak = { count: 1, lastDate: '2026-05-09' };
      return { deck, streak };
    }),
    touchStreak: vi.fn(async () => {
      streak = { count: 1, lastDate: '2026-05-09' };
      return { streak };
    }),
    updateCardMastery: vi.fn(async (id, correct) => {
      deck = deck.map((card) => (card.id === id ? { ...card, needsPractice: !correct } : card));
      return { deck };
    }),
    patchCard: vi.fn(async (id, fields) => {
      deck = deck.map((card) => (card.id === id ? { ...card, ...fields } : card));
      return { deck };
    }),
  };
};

describe('useDeck', () => {
  let adapter;

  beforeEach(() => {
    adapter = makeAdapter();
    createStorageAdapter.mockResolvedValue(adapter);
  });

  it('loads deck and streak from selected adapter', async () => {
    const { result } = renderHook(() => useDeck());

    await waitFor(() => expect(result.current.storageReady).toBe(true));

    expect(result.current.deck).toEqual([]);
    expect(result.current.streak).toEqual({ count: 0, lastDate: null });
    expect(adapter.load).toHaveBeenCalled();
  });

  it('addCard persists through adapter and returns saved card', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    let saved;
    await act(async () => { saved = await result.current.addCard(mockCard); });

    expect(saved.id).toBe('card-1');
    expect(result.current.deck).toHaveLength(1);
  });

  it('deleteCard updates state from adapter response', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));
    await act(async () => { await result.current.addCard(mockCard); });

    await act(async () => { await result.current.deleteCard('card-1'); });

    expect(result.current.deck).toEqual([]);
  });

  it('patchCard merges fields through adapter', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));
    await act(async () => { await result.current.addCard(mockCard); });

    await act(async () => { await result.current.patchCard('card-1', { quizDisabled: true }); });

    expect(result.current.deck[0].quizDisabled).toBe(true);
  });

  it('updateCardMastery updates deck through adapter', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));
    await act(async () => { await result.current.addCard(mockCard); });

    await act(async () => { await result.current.updateCardMastery('card-1', false); });

    expect(result.current.deck[0].needsPractice).toBe(true);
  });

  it('touchStreak updates streak through adapter', async () => {
    const { result } = renderHook(() => useDeck());
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    await act(async () => { await result.current.touchStreak(); });

    expect(result.current.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });

  it('shows toast and keeps state when adapter write fails', async () => {
    const showToast = vi.fn();
    adapter.addCard.mockResolvedValueOnce({ error: 'database locked' });
    const { result } = renderHook(() => useDeck(showToast));
    await waitFor(() => expect(result.current.storageReady).toBe(true));

    let saved;
    await act(async () => { saved = await result.current.addCard(mockCard); });

    expect(saved).toBe(false);
    expect(result.current.deck).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('database locked');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/hooks/__tests__/useDeck.test.js
```

Expected: FAIL because `useDeck` still uses direct `localStorage`.

- [ ] **Step 3: Replace `useDeck` with adapter-backed hook**

Replace `frontend/src/hooks/useDeck.js` with:

```js
import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_STREAK } from '../lib/storage/cardModel';
import { createStorageAdapter } from '../lib/storage/storageAdapter';

const applyResult = ({ result, setDeck, setStreak, showToast }) => {
  if (!result) return false;
  if (result.error) {
    showToast?.(result.error);
    return false;
  }
  if (result.deck) setDeck(result.deck);
  if (result.streak) setStreak(result.streak);
  return true;
};

export function useDeck(showToast) {
  const adapterRef = useRef(null);
  const [deck, setDeck] = useState([]);
  const [streak, setStreak] = useState(DEFAULT_STREAK);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const adapter = await createStorageAdapter();
      const state = await adapter.load();
      if (!active) return;
      adapterRef.current = adapter;
      setDeck(state.deck);
      setStreak(state.streak);
      setStorageReady(true);
    };

    load().catch((error) => {
      if (!active) return;
      showToast?.(error.message);
      setStorageReady(true);
    });

    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    const onStorage = (event) => {
      if (!adapterRef.current || adapterRef.current.kind !== 'localStorage') return;
      if (event.key !== 'starcards_deck' && event.key !== 'starcards_streak') return;
      adapterRef.current.refresh().then((state) => {
        setDeck(state.deck);
        setStreak(state.streak);
      });
    };

    const onFocus = () => {
      if (!adapterRef.current || adapterRef.current.kind !== 'sqlite') return;
      adapterRef.current.refresh().then((state) => {
        setDeck(state.deck);
        setStreak(state.streak);
      }).catch(() => {});
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const withAdapter = useCallback(
    async (operation) => {
      if (!adapterRef.current) {
        showToast?.('Storage is still loading');
        return false;
      }
      const result = await operation(adapterRef.current);
      return applyResult({ result, setDeck, setStreak, showToast });
    },
    [showToast]
  );

  const addCard = useCallback(
    async (card) => {
      if (!adapterRef.current) {
        showToast?.('Storage is still loading');
        return false;
      }
      const result = await adapterRef.current.addCard(card, deck);
      const ok = applyResult({ result, setDeck, setStreak, showToast });
      return ok ? result.card : false;
    },
    [deck, showToast]
  );

  const deleteCard = useCallback(
    (id) => withAdapter((adapter) => adapter.deleteCard(id, deck)),
    [deck, withAdapter]
  );

  const reportCard = useCallback(
    (id, knewIt) => withAdapter((adapter) => adapter.reportCard(id, knewIt, deck)),
    [deck, withAdapter]
  );

  const touchStreak = useCallback(
    () => withAdapter((adapter) => adapter.touchStreak()),
    [withAdapter]
  );

  const updateCardMastery = useCallback(
    (id, correct) => withAdapter((adapter) => adapter.updateCardMastery(id, correct, deck)),
    [deck, withAdapter]
  );

  const patchCard = useCallback(
    (id, fields) => withAdapter((adapter) => adapter.patchCard(id, fields, deck)),
    [deck, withAdapter]
  );

  return {
    deck,
    streak,
    storageReady,
    addCard,
    deleteCard,
    reportCard,
    touchStreak,
    updateCardMastery,
    patchCard,
  };
}
```

- [ ] **Step 4: Update `App.jsx` if async return handling causes warnings**

`handleCardGenerated` currently calls `addCard(card)` synchronously. Change it to async:

```js
async function handleCardGenerated(card) {
  const savedCard = await addCard(card);
  if (savedCard) {
    setCurrentCard(savedCard);
    setCurrentSubject(savedCard.subject ?? card.subject);
  }
  setIsLoading(false);
  touchStreak();
}
```

No other component needs to await delete/patch/mastery calls because their UI state updates through the hook.

- [ ] **Step 5: Run hook tests**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/hooks/__tests__/useDeck.test.js
```

Expected: PASS.

- [ ] **Step 6: Run component tests that touch card generation and quiz state**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/components/__tests__/App.test.jsx src/components/__tests__/QuizMode.test.jsx
```

Expected: PASS. If failures show synchronous assumptions around `addCard`, update the test to wait for the generated card after `handleCardGenerated` resolves.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useDeck.js frontend/src/hooks/__tests__/useDeck.test.js frontend/src/App.jsx
git commit -m "feat: use storage adapter for deck state"
```

---

### Task 8: Verify Fallback, Migration, And Full Test Suite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add README storage section**

In `README.md`, after “Local Development”, add:

```md
### Local Storage Mode

During local development, StarCards uses a local SQLite database when the Vite dev storage API is available. The database file is created at `data/starcards.sqlite` and is ignored by git.

On first local startup, the app imports any existing browser `starcards_deck` data into SQLite. Duplicate cards are skipped by normalized content fingerprint (`subject + word + chinese + pinyin`). The old browser deck remains in `localStorage` so Vercel deployments can keep using browser storage.

Vercel is stateless and does not persist local SQLite files. In production, `/api/storage/health` is unavailable, so the app falls back to browser `localStorage`.
```

- [ ] **Step 2: Run focused storage tests**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test -- src/lib/storage server/storage src/hooks/__tests__/useDeck.test.js dev-api-plugin.test.js
```

Expected: PASS.

- [ ] **Step 3: Run full frontend test suite**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run test
```

Expected: PASS.

- [ ] **Step 4: Build frontend**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run build
```

Expected: PASS and `frontend/dist` generated.

- [ ] **Step 5: Manual local SQLite check**

Run:

```bash
source ~/.nvm/nvm.sh && cd frontend && npm run dev
```

In another terminal:

```bash
curl -s http://localhost:5173/api/storage/health
```

Expected response:

```json
{"available":true,"backend":"sqlite"}
```

Open `http://localhost:5173`, generate a card, refresh the page, and confirm the card remains. Confirm `data/starcards.sqlite` exists and is not tracked by git:

```bash
git status --short data frontend/data
```

Expected: no tracked SQLite files are listed.

- [ ] **Step 6: Manual Vercel fallback simulation**

Temporarily stop the Vite dev server or change the health URL in browser devtools by blocking `/api/storage/health`. Refresh the app and confirm cards still load from browser `localStorage`.

Do not commit any temporary browser or devtools changes.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: document local sqlite storage"
```

---

## Self-Review Checklist

- Spec coverage:
  - SQLite preferred by health check: Task 4 and Task 6.
  - Vercel fallback to `localStorage`: Task 4 and Task 8.
  - Shared local deck and streak: Task 5.
  - One-time browser import with content fingerprint dedupe: Task 2, Task 4, Task 5.
  - Language remains browser-local: no task changes `i18n.js`; Task 4 tests storage selector only for learning data.
  - Write failures keep previous UI state: Task 7.
  - Multi-tab convergence by focus refresh: Task 7.
  - Tests and manual checks: Task 8.

- Placeholder scan:
  - No task uses placeholder markers.
  - Every code-changing task includes concrete files and code snippets.

- Type consistency:
  - Adapter methods use `{ deck }`, `{ streak }`, `{ deck, card }`, or `{ error }`.
  - SQLite client and repository route names match `/api/storage/*`.
  - Import-attempt key is `starcards_sqlite_import_attempted_v1` everywhere.
