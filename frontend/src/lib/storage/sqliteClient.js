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
