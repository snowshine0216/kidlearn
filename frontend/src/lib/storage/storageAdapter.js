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

  const cards = parseRawCards(storage.getItem(DECK_KEY));
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
