import { describe, expect, it, vi } from 'vitest';
import { createSqliteAdapter, createSqliteClient } from '../sqliteClient';

const ok = (body, status = 200) => ({
  ok: true,
  status,
  json: async () => body,
});

const err = (body, status = 500) => ({
  ok: false,
  status,
  json: async () => body,
});

const errNoJson = (status = 500) => ({
  ok: false,
  status,
  json: async () => { throw new Error('not json'); },
});

describe('createSqliteClient', () => {
  describe('jsonRequest error branches', () => {
    it('returns parsed body on success', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: {} }));
      const client = createSqliteClient({ fetchImpl });

      const result = await client.health();

      expect(result).toEqual({ deck: [], streak: {} });
    });

    it('throws with body.error message when response is not ok', async () => {
      const fetchImpl = vi.fn(async () => err({ error: 'not found' }, 404));
      const client = createSqliteClient({ fetchImpl });

      await expect(client.health()).rejects.toThrow('not found');
    });

    it('throws with status message when response is not ok and json has no error field', async () => {
      const fetchImpl = vi.fn(async () => errNoJson(503));
      const client = createSqliteClient({ fetchImpl });

      await expect(client.health()).rejects.toThrow('Storage request failed: 503');
    });
  });

  describe('CRUD methods', () => {
    it('load calls GET /api/storage/state', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: { count: 0, lastDate: null } }));
      const client = createSqliteClient({ fetchImpl });

      const result = await client.load();

      expect(fetchImpl).toHaveBeenCalledWith('/api/storage/state', expect.objectContaining({}));
      expect(result).toEqual({ deck: [], streak: { count: 0, lastDate: null } });
    });

    it('addCard sends card to POST /api/storage/cards', async () => {
      const card = { word: 'cat', subject: 'english' };
      const fetchImpl = vi.fn(async () => ok({ deck: [card], streak: {}, card }));
      const client = createSqliteClient({ fetchImpl });

      const result = await client.addCard(card);

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/cards',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ card }) }),
      );
      expect(result.card).toEqual(card);
    });

    it('deleteCard sends DELETE with encoded id', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: {} }));
      const client = createSqliteClient({ fetchImpl });

      await client.deleteCard('card with spaces');

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/cards/card%20with%20spaces',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('patchCard sends PATCH with encoded id and fields', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: {} }));
      const client = createSqliteClient({ fetchImpl });

      await client.patchCard('card-1', { quizDisabled: true });

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/cards/card-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ fields: { quizDisabled: true } }) }),
      );
    });

    it('updateCardMastery sends correct field', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: {} }));
      const client = createSqliteClient({ fetchImpl });

      await client.updateCardMastery('card-1', true);

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/cards/card-1/mastery',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ correct: true }) }),
      );
    });

    it('reportCard sends knewIt field', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: {} }));
      const client = createSqliteClient({ fetchImpl });

      await client.reportCard('card-1', false);

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/cards/card-1/report',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ knewIt: false }) }),
      );
    });

    it('touchStreak sends POST to /api/storage/streak/touch', async () => {
      const fetchImpl = vi.fn(async () => ok({ deck: [], streak: { count: 1, lastDate: '2026-05-09' } }));
      const client = createSqliteClient({ fetchImpl });

      const result = await client.touchStreak();

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/streak/touch',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.streak.count).toBe(1);
    });

    it('importCards sends cards array', async () => {
      const cards = [{ id: 'old-1', word: 'cat', subject: 'english' }];
      const fetchImpl = vi.fn(async () => ok({ imported: 1, skipped: 0 }));
      const client = createSqliteClient({ fetchImpl });

      const result = await client.importCards(cards);

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/storage/import',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ cards }) }),
      );
      expect(result).toEqual({ imported: 1, skipped: 0 });
    });
  });
});

describe('createSqliteAdapter', () => {
  const makeClient = (overrides = {}) => ({
    load: vi.fn(async () => ({ deck: [], streak: {} })),
    addCard: vi.fn(async () => ({ deck: [], streak: {}, card: {} })),
    deleteCard: vi.fn(async () => ({ deck: [], streak: {} })),
    patchCard: vi.fn(async () => ({ deck: [], streak: {} })),
    updateCardMastery: vi.fn(async () => ({ deck: [], streak: {} })),
    reportCard: vi.fn(async () => ({ deck: [], streak: {} })),
    touchStreak: vi.fn(async () => ({ deck: [], streak: {} })),
    ...overrides,
  });

  it('has kind sqlite', () => {
    const adapter = createSqliteAdapter(makeClient());
    expect(adapter.kind).toBe('sqlite');
  });

  it('load delegates to client.load', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.load();

    expect(client.load).toHaveBeenCalled();
  });

  it('refresh delegates to client.load', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.refresh();

    expect(client.load).toHaveBeenCalled();
  });

  it('addCard delegates to client.addCard', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);
    const card = { word: 'cat', subject: 'english' };

    await adapter.addCard(card);

    expect(client.addCard).toHaveBeenCalledWith(card);
  });

  it('deleteCard delegates to client.deleteCard', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.deleteCard('card-1');

    expect(client.deleteCard).toHaveBeenCalledWith('card-1');
  });

  it('patchCard delegates to client.patchCard', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.patchCard('card-1', { quizDisabled: true });

    expect(client.patchCard).toHaveBeenCalledWith('card-1', { quizDisabled: true });
  });

  it('updateCardMastery delegates to client.updateCardMastery', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.updateCardMastery('card-1', true);

    expect(client.updateCardMastery).toHaveBeenCalledWith('card-1', true);
  });

  it('reportCard delegates to client.reportCard', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.reportCard('card-1', false);

    expect(client.reportCard).toHaveBeenCalledWith('card-1', false);
  });

  it('touchStreak delegates to client.touchStreak', async () => {
    const client = makeClient();
    const adapter = createSqliteAdapter(client);

    await adapter.touchStreak();

    expect(client.touchStreak).toHaveBeenCalled();
  });
});
