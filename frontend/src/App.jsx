import { useState, useCallback, useRef } from 'react';
import { getReviewEligibleCards } from './lib/quizLogic';
import { useDeck } from './hooks/useDeck';
import { loadLang, saveLang, getStrings } from './lib/i18n';
import TopBar from './components/TopBar';
import InputPanel from './components/InputPanel';
import FlashCard from './components/FlashCard';
import MascotMessage from './components/MascotMessage';
import CardActions from './components/CardActions';
import StatsRow from './components/StatsRow';
import DeckView from './components/DeckView';
import QuizMode from './components/QuizMode';

export default function App() {
  const [lang, setLang] = useState(loadLang);
  const t = getStrings(lang);

  const [currentCard, setCurrentCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubject, setCurrentSubject] = useState('english'); // default: English
  const [showDeck, setShowDeck] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizDueOnly, setQuizDueOnly] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const { deck, streak, addCard, deleteCard, touchStreak, updateCardMastery, patchCard, storageReady } = useDeck(showToast);

  const dueCount = getReviewEligibleCards(deck).length;

  function handleLangToggle() {
    const next = lang === 'zh' ? 'en' : 'zh';
    saveLang(next);
    setLang(next);
  }

  async function handleCardGenerated(card) {
    const savedCard = await addCard(card);
    if (savedCard) {
      setCurrentCard(savedCard);
      setCurrentSubject(savedCard.subject ?? card.subject);
    }
    setIsLoading(false);
    touchStreak();
  }

  function handleDeleteCard(id) {
    if (currentCard?.id === id) setCurrentCard(null);
    deleteCard(id);
  }

  function handleLoadRecent(card) {
    setCurrentCard(card);
    setCurrentSubject(card.subject);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* API key missing banner — only shows during local dev without vercel dev */}
      {import.meta.env.DEV && !import.meta.env.VITE_MINIMAX_API_KEY_HINT && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-sm text-yellow-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            {t.apiKeyMissing}{' '}
            <a
              href="https://platform.minimax.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              {t.getKey}
            </a>
            {' '}<span className="opacity-60">(use <code>vercel dev</code> locally)</span>
          </span>
        </div>
      )}

      {/* inert disables keyboard/pointer interaction on background when DeckView or QuizMode is open */}
      <div {...((showDeck || showQuiz) ? { inert: '' } : {})}>
        <TopBar
          t={t}
          streak={streak}
          onShowDeck={() => setShowDeck(true)}
          onLangToggle={handleLangToggle}
          onStartQuiz={() => setShowQuiz(true)}
          canStartQuiz={deck.length >= 5}
        />

        <main className="flex flex-1 gap-4 p-4 md:p-6 flex-col md:flex-row">
          <InputPanel
            t={t}
            onCardGenerated={handleCardGenerated}
            onLoading={setIsLoading}
            recentCards={deck}
            onLoadRecent={handleLoadRecent}
            onDeleteCard={handleDeleteCard}
            storageReady={storageReady}
          />

          <div className="flex flex-col gap-4 flex-1 min-w-0 pb-24 md:pb-0">
            <FlashCard
              key={currentCard?.id ?? 'empty'}
              t={t}
              card={currentCard}
              isLoading={isLoading}
              subject={currentSubject}
            />

            {currentCard && !isLoading && (
              <>
                <MascotMessage message={currentCard.mascot_message} />
                <CardActions
                  t={t}
                  card={currentCard}
                />
              </>
            )}

            <StatsRow
              t={t}
              count={deck.length}
              dueCount={dueCount}
              onDueClick={dueCount > 0 ? () => { setQuizDueOnly(true); setShowQuiz(true); } : undefined}
            />
          </div>
        </main>

        {/* Mobile FAB */}
        <button
          className="fab-add md:hidden w-14 h-14 rounded-full flex items-center justify-center text-2xl text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t.inputHint}
        >
          ✏️
        </button>
      </div>

      {showDeck && (
        <DeckView
          t={t}
          deck={deck}
          onDelete={deleteCard}
          onClose={() => setShowDeck(false)}
          onStartQuiz={() => setShowQuiz(true)}
          onToggleQuizDisabled={(id, currentValue) => patchCard(id, { quizDisabled: !currentValue })}
        />
      )}

      {showQuiz && (
        <QuizMode
          t={t}
          lang={lang}
          deck={deck}
          dueOnly={quizDueOnly}
          onClose={() => { setShowQuiz(false); setQuizDueOnly(false); }}
          onUpdateMastery={(id, correct) => { updateCardMastery(id, correct); touchStreak(); }}
          onPatchCard={patchCard}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-xl shadow-lg z-50 text-sm font-semibold">
          {toast}
        </div>
      )}
    </div>
  );
}
