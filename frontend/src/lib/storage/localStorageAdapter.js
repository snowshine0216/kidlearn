import {
  DECK_KEY,
  MAX_DECK_SIZE,
  STREAK_KEY,
  createSavedCard,
  nextDeckWithMastery,
  nextDeckWithPatchedCard,
  nextDeckWithReport,
  nextStreak,
  parseDeckJson,
  parseStreakJson,
} from './cardModel';

const saveJson = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
    return null;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      return new Error('Deck is full — delete some cards to save more');
    }
    return error;
  }
};

const loadDeck = (storage) => parseDeckJson(storage.getItem(DECK_KEY));
const loadStreak = (storage) => parseStreakJson(storage.getItem(STREAK_KEY));

const saveDeck = (storage, deck) => saveJson(storage, DECK_KEY, deck);
const saveStreak = (storage, streak) => saveJson(storage, STREAK_KEY, streak);

export function createLocalStorageAdapter({
  storage = localStorage,
  idFactory = () => crypto.randomUUID(),
  now = () => Date.now(),
} = {}) {
  const load = async () => ({
    deck: loadDeck(storage),
    streak: loadStreak(storage),
  });

  const addCard = async (card, currentDeck) => {
    if (currentDeck.length >= MAX_DECK_SIZE) {
      return { error: 'Your deck has 500+ cards! Consider deleting some.' };
    }

    const savedCard = createSavedCard(card, { id: idFactory(), now: now() });
    const deck = [savedCard, ...currentDeck];
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck, card: savedCard };
  };

  const deleteCard = async (id, currentDeck) => {
    const deck = currentDeck.filter((card) => card.id !== id);
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck };
  };

  const patchCard = async (id, fields, currentDeck) => {
    const deck = nextDeckWithPatchedCard(currentDeck, id, fields);
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck };
  };

  const updateCardMastery = async (id, correct, currentDeck) => {
    const deck = nextDeckWithMastery(currentDeck, id, correct);
    const error = saveDeck(storage, deck);
    if (error) return { error: error.message };
    return { deck };
  };

  const reportCard = async (id, knewIt, currentDeck) => {
    const deck = nextDeckWithReport(currentDeck, id, knewIt, now());
    const streak = nextStreak(loadStreak(storage), now());
    const deckError = saveDeck(storage, deck);
    if (deckError) return { error: deckError.message };
    const streakError = saveStreak(storage, streak);
    if (streakError) return { error: streakError.message };
    return { deck, streak };
  };

  const touchStreak = async () => {
    const streak = nextStreak(loadStreak(storage), now());
    const error = saveStreak(storage, streak);
    if (error) return { error: error.message };
    return { streak };
  };

  return {
    kind: 'localStorage',
    load,
    refresh: load,
    addCard,
    deleteCard,
    patchCard,
    updateCardMastery,
    reportCard,
    touchStreak,
  };
}
