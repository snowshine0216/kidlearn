import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_STREAK } from '../lib/storage/cardModel';
import { createStorageAdapter } from '../lib/storage/storageAdapter';

const applyResult = ({ result, setDeck, setStreak, showToast }) => {
  if (!result) return false;
  if (result.error) {
    showToast?.(result.error);
    return false;
  }
  if (result.deck) setDeck(result.deck);
  if (result.streak) setStreak(result.streak);
  return true;
};

export function useDeck(showToast) {
  const adapterRef = useRef(null);
  const [deck, setDeck] = useState([]);
  const [streak, setStreak] = useState(DEFAULT_STREAK);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const adapter = await createStorageAdapter();
      const state = await adapter.load();
      if (!active) return;
      adapterRef.current = adapter;
      setDeck(state.deck);
      setStreak(state.streak);
      setStorageReady(true);
    };

    load().catch((error) => {
      if (!active) return;
      showToast?.(error.message);
      setStorageReady(true);
    });

    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    const onStorage = (event) => {
      if (!adapterRef.current || adapterRef.current.kind !== 'localStorage') return;
      if (event.key !== 'starcards_deck' && event.key !== 'starcards_streak') return;
      adapterRef.current.refresh().then((state) => {
        setDeck(state.deck);
        setStreak(state.streak);
      });
    };

    const onFocus = () => {
      if (!adapterRef.current || adapterRef.current.kind !== 'sqlite') return;
      adapterRef.current.refresh().then((state) => {
        setDeck(state.deck);
        setStreak(state.streak);
      }).catch(() => {});
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const withAdapter = useCallback(
    async (operation) => {
      if (!adapterRef.current) {
        showToast?.('Storage is still loading');
        return false;
      }
      const result = await operation(adapterRef.current);
      return applyResult({ result, setDeck, setStreak, showToast });
    },
    [showToast]
  );

  const addCard = useCallback(
    async (card) => {
      if (!adapterRef.current) {
        showToast?.('Storage is still loading');
        return false;
      }
      const result = await adapterRef.current.addCard(card, deck);
      const ok = applyResult({ result, setDeck, setStreak, showToast });
      return ok ? result.card : false;
    },
    [deck, showToast]
  );

  const deleteCard = useCallback(
    (id) => withAdapter((adapter) => adapter.deleteCard(id, deck)),
    [deck, withAdapter]
  );

  const reportCard = useCallback(
    (id, knewIt) => withAdapter((adapter) => adapter.reportCard(id, knewIt, deck)),
    [deck, withAdapter]
  );

  const touchStreak = useCallback(
    () => withAdapter((adapter) => adapter.touchStreak()),
    [withAdapter]
  );

  const updateCardMastery = useCallback(
    (id, correct) => withAdapter((adapter) => adapter.updateCardMastery(id, correct, deck)),
    [deck, withAdapter]
  );

  const patchCard = useCallback(
    (id, fields) => withAdapter((adapter) => adapter.patchCard(id, fields, deck)),
    [deck, withAdapter]
  );

  return {
    deck,
    streak,
    storageReady,
    addCard,
    deleteCard,
    reportCard,
    touchStreak,
    updateCardMastery,
    patchCard,
  };
}
