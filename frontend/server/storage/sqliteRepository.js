import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_STREAK,
  cardContentFingerprint,
  createSavedCard,
  migrateCard,
  nextDeckWithMastery,
  nextDeckWithPatchedCard,
  nextDeckWithReport,
  nextStreak,
} from '../../src/lib/storage/cardModel.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const defaultDbPath = path.join(repoRoot, 'data', 'starcards.sqlite');

const boolToDb = (value) => (value === undefined || value === null ? null : value ? 1 : 0);
const boolFromDb = (value) => (value === null || value === undefined ? value : value === 1);
const jsonToDb = (value) => (value === undefined || value === null ? null : JSON.stringify(value));
const jsonFromDb = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const rowToCard = (row) => migrateCard({
  id: row.id,
  schemaVersion: row.schema_version,
  emoji: row.emoji,
  word: row.word,
  chinese: row.chinese,
  pinyin: row.pinyin,
  sentence: row.sentence,
  sentence_zh: row.sentence_zh,
  mnemonic: row.mnemonic,
  mascot_message: row.mascot_message,
  color_theme: row.color_theme,
  subject: row.subject,
  style: row.style,
  savedAt: row.saved_at,
  knewIt: boolFromDb(row.knew_it),
  reviewedAt: row.reviewed_at,
  mastery: row.mastery,
  reviewCount: row.review_count,
  lastReviewedAt: row.last_reviewed_at,
  nextReviewAt: row.next_review_at,
  needsPractice: row.needs_practice === 1,
  quizDisabled: boolFromDb(row.quiz_disabled),
  quizHints: jsonFromDb(row.quiz_hints_json),
});

const cardToParams = (card, now) => ({
  id: card.id,
  content_fingerprint: cardContentFingerprint(card),
  schema_version: card.schemaVersion ?? 1,
  emoji: card.emoji ?? null,
  word: card.word ?? null,
  chinese: card.chinese ?? null,
  pinyin: card.pinyin ?? null,
  sentence: card.sentence ?? null,
  sentence_zh: card.sentence_zh ?? null,
  mnemonic: card.mnemonic ?? null,
  mascot_message: card.mascot_message ?? null,
  color_theme: card.color_theme ?? null,
  subject: card.subject ?? null,
  style: card.style ?? null,
  saved_at: card.savedAt ?? now,
  knew_it: boolToDb(card.knewIt),
  reviewed_at: card.reviewedAt ?? null,
  mastery: card.mastery ?? null,
  review_count: card.reviewCount ?? null,
  last_reviewed_at: card.lastReviewedAt ?? null,
  next_review_at: card.nextReviewAt ?? null,
  needs_practice: card.needsPractice ? 1 : 0,
  quiz_disabled: boolToDb(card.quizDisabled),
  quiz_hints_json: jsonToDb(card.quizHints),
  updated_at: now,
});

const schema = `
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  content_fingerprint TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  emoji TEXT,
  word TEXT,
  chinese TEXT,
  pinyin TEXT,
  sentence TEXT,
  sentence_zh TEXT,
  mnemonic TEXT,
  mascot_message TEXT,
  color_theme TEXT,
  subject TEXT,
  style TEXT,
  saved_at INTEGER,
  knew_it INTEGER,
  reviewed_at INTEGER,
  mastery INTEGER,
  review_count INTEGER,
  last_reviewed_at INTEGER,
  next_review_at INTEGER,
  needs_practice INTEGER NOT NULL DEFAULT 0,
  quiz_disabled INTEGER,
  quiz_hints_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS streak (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  last_date TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export function createSqliteRepository({
  dbPath = defaultDbPath,
  idFactory = () => crypto.randomUUID(),
  now = () => Date.now(),
} = {}) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  db.prepare('INSERT OR REPLACE INTO meta (key, value, updated_at) VALUES (?, ?, ?)').run('schema_version', '1', now());

  const listDeck = () => db
    .prepare('SELECT * FROM cards ORDER BY saved_at DESC, created_at DESC')
    .all()
    .map(rowToCard);

  const loadStreak = () => {
    const row = db.prepare('SELECT count, last_date FROM streak WHERE id = ?').get('shared');
    return row ? { count: row.count, lastDate: row.last_date } : DEFAULT_STREAK;
  };

  const saveStreak = (streak) => {
    db.prepare(`
      INSERT INTO streak (id, count, last_date, updated_at)
      VALUES ('shared', @count, @lastDate, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        count = excluded.count,
        last_date = excluded.last_date,
        updated_at = excluded.updated_at
    `).run({ count: streak.count, lastDate: streak.lastDate, updatedAt: now() });
    return streak;
  };

  const insertCard = db.prepare(`
    INSERT OR IGNORE INTO cards (
      id, content_fingerprint, schema_version, emoji, word, chinese, pinyin,
      sentence, sentence_zh, mnemonic, mascot_message, color_theme, subject,
      style, saved_at, knew_it, reviewed_at, mastery, review_count,
      last_reviewed_at, next_review_at, needs_practice, quiz_disabled,
      quiz_hints_json, updated_at
    ) VALUES (
      @id, @content_fingerprint, @schema_version, @emoji, @word, @chinese, @pinyin,
      @sentence, @sentence_zh, @mnemonic, @mascot_message, @color_theme, @subject,
      @style, @saved_at, @knew_it, @reviewed_at, @mastery, @review_count,
      @last_reviewed_at, @next_review_at, @needs_practice, @quiz_disabled,
      @quiz_hints_json, @updated_at
    )
  `);

  const replaceCard = db.prepare(`
    UPDATE cards SET
      content_fingerprint = @content_fingerprint,
      schema_version = @schema_version,
      emoji = @emoji,
      word = @word,
      chinese = @chinese,
      pinyin = @pinyin,
      sentence = @sentence,
      sentence_zh = @sentence_zh,
      mnemonic = @mnemonic,
      mascot_message = @mascot_message,
      color_theme = @color_theme,
      subject = @subject,
      style = @style,
      saved_at = @saved_at,
      knew_it = @knew_it,
      reviewed_at = @reviewed_at,
      mastery = @mastery,
      review_count = @review_count,
      last_reviewed_at = @last_reviewed_at,
      next_review_at = @next_review_at,
      needs_practice = @needs_practice,
      quiz_disabled = @quiz_disabled,
      quiz_hints_json = @quiz_hints_json,
      updated_at = @updated_at
    WHERE id = @id
  `);

  const load = () => ({ deck: listDeck(), streak: loadStreak() });

  const addCard = (card) => {
    const savedCard = createSavedCard(card, { id: idFactory(), now: now() });
    insertCard.run(cardToParams(savedCard, now()));
    return { ...load(), card: savedCard };
  };

  const importCards = (cards) => {
    const insertMany = db.transaction((inputCards) => inputCards.reduce((acc, card) => {
      const migrated = migrateCard(card);
      const result = insertCard.run(cardToParams(migrated, now()));
      return {
        imported: acc.imported + result.changes,
        skipped: acc.skipped + (result.changes === 0 ? 1 : 0),
      };
    }, { imported: 0, skipped: 0 }));

    return insertMany(cards);
  };

  const deleteCard = (id) => {
    db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    return load();
  };

  const updateOneCard = (id, updater) => db.transaction(() => {
    const current = listDeck().find((card) => card.id === id);
    if (!current) return load();
    const nextCard = updater(current);
    replaceCard.run(cardToParams(nextCard, now()));
    return load();
  })();

  const patchCard = (id, fields) => updateOneCard(id, (card) => (
    nextDeckWithPatchedCard([card], id, fields)[0]
  ));

  const updateCardMastery = (id, correct) => updateOneCard(id, (card) => (
    nextDeckWithMastery([card], id, correct)[0]
  ));

  const reportCard = (id, knewIt) => {
    const result = updateOneCard(id, (card) => nextDeckWithReport([card], id, knewIt, now())[0]);
    const streak = saveStreak(nextStreak(loadStreak(), now()));
    return { ...result, streak };
  };

  const touchStreak = () => {
    const streak = saveStreak(nextStreak(loadStreak(), now()));
    return { deck: listDeck(), streak };
  };

  return {
    load,
    addCard,
    importCards,
    deleteCard,
    patchCard,
    updateCardMastery,
    reportCard,
    touchStreak,
    close: () => db.close(),
  };
}
