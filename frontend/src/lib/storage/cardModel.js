import { applyMasteryResult } from '../quizLogic';

export const DECK_KEY = 'starcards_deck';
export const STREAK_KEY = 'starcards_streak';
export const SQLITE_IMPORT_ATTEMPTED_KEY = 'starcards_sqlite_import_attempted_v1';
export const DEFAULT_STREAK = { count: 0, lastDate: null };
export const MAX_DECK_SIZE = 500;

export function migrateCard(card) {
  return {
    schemaVersion: 1,
    knewIt: null,
    reviewedAt: null,
    mastery: null,
    reviewCount: null,
    lastReviewedAt: null,
    nextReviewAt: null,
    needsPractice: false,
    quizHints: null,
    ...card,
  };
}

export function createSavedCard(card, { id, now } = {}) {
  const resolvedId = id ?? crypto.randomUUID();
  const resolvedNow = now ?? Date.now();

  return migrateCard({
    ...card,
    id: resolvedId,
    style: 'illustrated',
    savedAt: resolvedNow,
  });
}

const normalizePart = (value, { lower = false } = {}) => {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return lower ? normalized.toLocaleLowerCase() : normalized;
};

export function cardContentFingerprint(card) {
  return [
    normalizePart(card.subject, { lower: true }),
    normalizePart(card.word, { lower: true }),
    normalizePart(card.chinese),
    normalizePart(card.pinyin, { lower: true }),
  ].join('|');
}

export function parseDeckJson(raw) {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(migrateCard) : [];
  } catch {
    return [];
  }
}

export function parseStreakJson(raw) {
  try {
    if (!raw) return DEFAULT_STREAK;
    const parsed = JSON.parse(raw);
    return {
      count: Number.isFinite(parsed.count) ? parsed.count : DEFAULT_STREAK.count,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : DEFAULT_STREAK.lastDate,
    };
  } catch {
    return DEFAULT_STREAK;
  }
}

export function nextDeckWithPatchedCard(deck, id, fields) {
  return deck.map((card) => (card.id === id ? migrateCard({ ...card, ...fields }) : card));
}

export function nextDeckWithMastery(deck, id, correct) {
  return deck.map((card) => (card.id === id ? migrateCard(applyMasteryResult(card, correct)) : card));
}

export function nextDeckWithReport(deck, id, knewIt, now = Date.now()) {
  return deck.map((card) => (
    card.id === id
      ? migrateCard({ ...card, knewIt, reviewedAt: now })
      : card
  ));
}

const localDate = (time) => new Date(time).toLocaleDateString('sv');

export function nextStreak(streak, now = Date.now()) {
  const today = localDate(now);
  if (streak.lastDate === today) return streak;

  const yesterday = localDate(now - 86400000);
  return {
    count: streak.lastDate === yesterday ? streak.count + 1 : 1,
    lastDate: today,
  };
}
