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
