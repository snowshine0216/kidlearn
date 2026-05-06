import { useState, useEffect, useCallback } from 'react';
import { applyMasteryResult } from '../lib/quizLogic';

const DECK_KEY = 'starcards_deck';
const STREAK_KEY = 'starcards_streak';

/**
 * Forward-compatible card migration.
 * Adds schemaVersion + v2 field stubs so future migrations don't break old records.
 */
function migrateCard(card) {
  return {
    schemaVersion: 1,
    knewIt: null,        // boolean | null — set when child taps self-report
    reviewedAt: null,    // timestamp | null — set when self-report is tapped
    // v2 stubs (populated by quiz mode)
    mastery: null,
    reviewCount: null,
    lastReviewedAt: null,
    nextReviewAt: null,  // timestamp when card is due for spaced-repetition review
    needsPractice: false, // true when card was answered wrong in last quiz session
    quizHints: null,     // { [type]: QuizHint } — cached per quiz type
    ...card,             // existing fields override defaults
  };
}

function loadDeck() {
  try {
    const raw = localStorage.getItem(DECK_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(migrateCard);
  } catch {
    return [];
  }
}

function saveDeck(deck) {
  try {
    localStorage.setItem(DECK_KEY, JSON.stringify(deck));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      throw new Error('Deck is full — delete some cards to save more');
    }
    throw e;
  }
}

function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { count: 0, lastDate: null };
  } catch {
    return { count: 0, lastDate: null };
  }
}

/**
 * Update streak on any card interaction (card load counts as a study event).
 * Logic: same day = no change, yesterday = +1, older = reset to 1.
 */
function updateStreak() {
  // Use local date (not UTC) so Chinese users (UTC+8) see the correct day
  const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD in local TZ
  const streak = loadStreak();

  if (streak.lastDate === today) return streak;

  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv');
  const newStreak = {
    count: streak.lastDate === yesterday ? streak.count + 1 : 1,
    lastDate: today,
  };
  localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));
  return newStreak;
}

export function useDeck(showToast) {
  const [deck, setDeck] = useState(loadDeck);
  const [streak, setStreak] = useState(loadStreak);

  // Reload deck if another tab changes localStorage
  useEffect(() => {
    const handler = (e) => {
      if (e.key === DECK_KEY) setDeck(loadDeck());
      if (e.key === STREAK_KEY) setStreak(loadStreak());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addCard = useCallback(
    (card) => {
      if (deck.length >= 500) {
        showToast?.('Your deck has 500+ cards! Consider deleting some.');
        return false;
      }
      const newCard = migrateCard({
        ...card,
        id: crypto.randomUUID(),
        style: 'illustrated',
        savedAt: Date.now(),
      });
      const next = [newCard, ...deck];
      try {
        saveDeck(next);
        setDeck(next);
        return newCard;
      } catch (e) {
        showToast?.(e.message);
        return false;
      }
    },
    [deck, showToast]
  );

  const deleteCard = useCallback(
    (id) => {
      const next = deck.filter((c) => c.id !== id);
      saveDeck(next);
      setDeck(next);
    },
    [deck]
  );

  /**
   * Record self-report ("I know it" / "Not yet") on a card.
   */
  const reportCard = useCallback(
    (id, knewIt) => {
      const next = deck.map((c) =>
        c.id === id ? { ...c, knewIt, reviewedAt: Date.now() } : c
      );
      saveDeck(next);
      setDeck(next);
      const newStreak = updateStreak();
      setStreak(newStreak);
    },
    [deck]
  );

  /**
   * Bump streak — call when a card is reviewed.
   */
  const touchStreak = useCallback(() => {
    const newStreak = updateStreak();
    setStreak(newStreak);
  }, []);

  /**
   * Update mastery fields after a quiz answer.
   * Uses functional updater to avoid stale closure race conditions.
   */
  const updateCardMastery = useCallback((id, correct) => {
    setDeck((prev) => {
      const next = prev.map((c) => (c.id === id ? applyMasteryResult(c, correct) : c));
      saveDeck(next);
      return next;
    });
  }, []);

  /**
   * Patch arbitrary fields on a card (e.g. save back generated mnemonic or quizHints).
   * Uses functional updater to avoid stale closure race conditions.
   */
  const patchCard = useCallback((id, fields) => {
    setDeck((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...fields } : c));
      saveDeck(next);
      return next;
    });
  }, []);

  return { deck, streak, addCard, deleteCard, reportCard, touchStreak, updateCardMastery, patchCard };
}
