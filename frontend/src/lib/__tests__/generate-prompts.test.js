import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../../../../api/generate.js';

describe('flashcard generation prompt', () => {
  it('redirects inappropriate child inputs to a safe rainbow card', () => {
    expect(buildSystemPrompt()).toMatch(/not appropriate for a young child/i);
    expect(buildSystemPrompt()).toMatch(/word is "oops"/i);
    expect(buildSystemPrompt()).toMatch(/rainbow/i);
  });
});