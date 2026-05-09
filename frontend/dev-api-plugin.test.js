// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import createConfig from './vite.config.js';

describe('vite dev API plugin', () => {
  it('registers /api/quiz-hint during local dev', () => {
    const use = vi.fn();
    const config = createConfig({ mode: 'test' });
    const devApiPlugin = config.plugins.find((plugin) => plugin?.name === 'dev-api');

    devApiPlugin.configureServer({ middlewares: { use } });

    const registeredPaths = use.mock.calls.map(([path]) => path);
    expect(registeredPaths).toContain('/api/quiz-hint');
  });
});