import {
  DECK_KEY,
  SQLITE_IMPORT_ATTEMPTED_KEY,
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

const parseRawCards = (raw) => {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// The import flag is set only on success, so if importCards throws the flag
// is never written and the migration retries on the next page load — intentional.
const importOldBrowserDeck = async ({ client, storage }) => {
  if (storage.getItem(SQLITE_IMPORT_ATTEMPTED_KEY) === 'true') return;

  const raw = storage.getItem(DECK_KEY);
  const cards = parseRawCards(raw);
  if (cards.length === 0) {
    // Only mark as migrated when the deck is provably empty (no data, or a valid
    // empty JSON array). If localStorage has data that failed to parse (corrupted
    // write, disk-full truncation), skip — allow retry next session to avoid
    // permanently orphaning the user's cards.
    if (!raw) {
      storage.setItem(SQLITE_IMPORT_ATTEMPTED_KEY, 'true');
    } else {
      try {
        if (Array.isArray(JSON.parse(raw))) storage.setItem(SQLITE_IMPORT_ATTEMPTED_KEY, 'true');
      } catch { /* corrupted JSON — do not mark as attempted */ }
    }
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
