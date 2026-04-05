import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../../../../api/quiz-hint.js';

describe('buildSystemPrompt', () => {
  it('instructs the AI to write in Simplified Chinese', () => {
    expect(buildSystemPrompt()).toContain('简体中文');
  });

  it('does not positively instruct the AI to write in English', () => {
    // Must not tell the AI to use English as the output language
    expect(buildSystemPrompt()).not.toMatch(/write.*in English|respond.*in English|all.*in English/i);
  });
});

describe('buildUserPrompt', () => {
  const base = { word: 'butterfly', chinese: '蝴蝶', pinyin: 'hú dié', subject: 'english', type: 'pronunciation', needsMnemonic: false };

  it('instructs the AI to write hints in Simplified Chinese', () => {
    expect(buildUserPrompt(base)).toContain('简体中文');
  });

  it('includes the word via sentinel tags', () => {
    const prompt = buildUserPrompt(base);
    expect(prompt).toContain('[WORD_START]butterfly[WORD_END]');
  });

  it('omits mnemonic field when needsMnemonic is false', () => {
    const prompt = buildUserPrompt({ ...base, needsMnemonic: false });
    expect(prompt).not.toContain('"mnemonic"');
  });

  it('includes mnemonic field when needsMnemonic is true', () => {
    const prompt = buildUserPrompt({ ...base, needsMnemonic: true });
    expect(prompt).toContain('"mnemonic"');
  });
});
