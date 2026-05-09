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
