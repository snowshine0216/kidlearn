// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../sqliteRepository';

const baseCard = {
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The <em>butterfly</em> flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
};

describe('createSqliteRepository', () => {
  let dir;
  let repo;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'starcards-test-'));
    repo = createSqliteRepository({
      dbPath: path.join(dir, 'test.sqlite'),
      idFactory: () => 'card-1',
      now: () => new Date('2026-05-09T10:00:00+08:00').getTime(),
    });
  });

  afterEach(() => {
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts with an empty deck and default streak', () => {
    expect(repo.load()).toEqual({ deck: [], streak: { count: 0, lastDate: null } });
  });

  it('adds and lists cards', () => {
    const result = repo.addCard(baseCard);

    expect(result.card.id).toBe('card-1');
    expect(result.deck).toHaveLength(1);
    expect(repo.load().deck[0].word).toBe('butterfly');
  });

  it('imports cards with content fingerprint dedupe', () => {
    const importResult = repo.importCards([
      { ...baseCard, id: 'old-a' },
      { ...baseCard, id: 'old-b', word: ' Butterfly ' },
    ]);

    expect(importResult).toEqual({ imported: 1, skipped: 1 });
    expect(repo.load().deck).toHaveLength(1);
    expect(repo.load().deck[0].id).toBe('old-a');
  });

  it('deletes cards', () => {
    repo.addCard(baseCard);

    const result = repo.deleteCard('card-1');

    expect(result.deck).toEqual([]);
  });

  it('patches card fields', () => {
    repo.addCard(baseCard);

    const result = repo.patchCard('card-1', { quizDisabled: true, quizHints: { reading: { encouragement: '好棒' } } });

    expect(result.deck[0].quizDisabled).toBe(true);
    expect(result.deck[0].quizHints.reading.encouragement).toBe('好棒');
  });

  it('updates mastery', () => {
    repo.addCard(baseCard);

    const result = repo.updateCardMastery('card-1', false);

    expect(result.deck[0].needsPractice).toBe(true);
    expect(result.deck[0].reviewCount).toBe(1);
  });

  it('updates report fields and streak', () => {
    repo.addCard(baseCard);

    const result = repo.reportCard('card-1', true);

    expect(result.deck[0].knewIt).toBe(true);
    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });

  it('touches the shared streak row', () => {
    const result = repo.touchStreak();

    expect(result.streak).toEqual({ count: 1, lastDate: '2026-05-09' });
  });
});
