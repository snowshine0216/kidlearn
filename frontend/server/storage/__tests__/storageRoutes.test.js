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
