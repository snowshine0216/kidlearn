// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import createConfig from './vite.config.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function jsonRequest(body) {
  const payload = JSON.stringify(body);

  return {
    method: 'POST',
    on: (event, handler) => {
      if (event === 'data') handler(payload);
      if (event === 'end') handler();
      return this;
    },
  };
}

function jsonResponse() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
}

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

  it('keeps the local /api/generate prompt child-safe', async () => {
    vi.stubEnv('MINIMAX_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        base_resp: { status_code: 0 },
        choices: [{
          message: {
            content: JSON.stringify({
              emoji: '🦋',
              word: 'butterfly',
              sentence: 'The butterfly flew.',
              color_theme: 'purple',
            }),
          },
        }],
      }),
    }));
    const use = vi.fn();
    const config = createConfig({ mode: 'test' });
    const devApiPlugin = config.plugins.find((plugin) => plugin?.name === 'dev-api');
    devApiPlugin.configureServer({ middlewares: { use } });
    const generateHandler = use.mock.calls.find(([path]) => path === '/api/generate')[1];

    await generateHandler(
      jsonRequest({ word: 'butterfly', subject: 'english' }),
      jsonResponse(),
      vi.fn()
    );

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.messages[0].content).toMatch(/not appropriate for a young child/i);
    expect(requestBody.messages[0].content).toMatch(/rainbow/i);
  });
});