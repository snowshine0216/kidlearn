import { useState, useEffect, useCallback, useRef } from 'react';
import { buildQuestions, selectQuizCards, computeSessionScore, applyMasteryResult } from '../lib/quizLogic';
import { getQuizHint } from '../lib/quizHintApi';
import { speakCard, speak } from '../lib/speech';
import { getTheme } from '../lib/colorThemes';

const EN_MODES = ['pronunciation', 'fill-blank', 'word-meaning'];
const ZH_MODES = ['reading'];
const COUNT_OPTIONS = [5, 10, 20];
const PREFETCH_EAGER = 5;

// ─── QuizLobby ───────────────────────────────────────────────────────────────

function QuizLobby({ t, deck, onStart, onClose }) {
  const [subject, setSubject] = useState('english');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);

  const subjectDeck = deck.filter(c => c.subject === subject);
  const canStart = subjectDeck.length >= 5;

  async function handleStart() {
    setLoading(true);
    await onStart({ subject, count });
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-sm mx-auto">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary-dark)' }}>
        {t.startQuiz}
      </h2>

      {/* Subject toggle */}
      <div className="flex gap-3 w-full">
        {['english', 'chinese'].map(s => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className="flex-1 py-3 rounded-2xl font-bold text-lg transition-all"
            style={{
              background: subject === s ? 'var(--color-primary)' : 'var(--color-primary-light)',
              color: subject === s ? 'white' : 'var(--color-primary-dark)',
              border: '2px solid transparent',
            }}
          >
            {t.subjects[s]}
          </button>
        ))}
      </div>

      {/* Count presets */}
      <div className="w-full">
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>
          {t.quizCountLabel}
        </p>
        <div className="flex gap-3">
          {COUNT_OPTIONS.map(n => {
            const tooFew = subjectDeck.length < n;
            return (
              <button
                key={n}
                disabled={tooFew}
                onClick={() => setCount(n)}
                className="flex-1 py-3 rounded-xl font-bold text-xl transition-all"
                style={{
                  background: count === n && !tooFew ? 'var(--color-primary)' : 'var(--color-primary-light)',
                  color: count === n && !tooFew ? 'white' : tooFew ? '#bbb' : 'var(--color-primary-dark)',
                  cursor: tooFew ? 'not-allowed' : 'pointer',
                  opacity: tooFew ? 0.5 : 1,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {!canStart && (
        <p className="text-sm text-center" style={{ color: 'var(--color-coral)' }}>
          {t.quizNeedCards}
        </p>
      )}

      <button
        onClick={handleStart}
        disabled={!canStart || loading}
        className="w-full py-4 rounded-2xl font-bold text-xl"
        style={{
          background: canStart ? 'var(--color-primary)' : '#ddd',
          color: canStart ? 'white' : '#999',
          cursor: canStart ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? t.quizStartLoading : t.quizStart}
      </button>

    </div>
  );
}

// ─── QuizProgress ─────────────────────────────────────────────────────────────

function QuizProgress({ current, total, t }) {
  return (
    <p className="text-center text-sm font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>
      {t.quizProgress(current + 1, total)}
    </p>
  );
}

// ─── QuizQuestion ─────────────────────────────────────────────────────────────

function QuizQuestion({ question, t, lang, onAnswer, hintLoading }) {
  const { card, type, hint, choices, sentenceWithBlank } = question;
  const [showHint, setShowHint] = useState(false);
  const [chosen, setChosen] = useState(null);
  const theme = getTheme(card.color_theme ?? 'purple');

  function handleChoice(c) {
    if (chosen) return;
    const correct = c.id === card.id;
    setChosen(c.id);
    setTimeout(() => onAnswer(correct, c.id), 600);
  }

  function handleSelfReport(correct) {
    onAnswer(correct, card.id);
  }

  // Pronunciation: tap 🔊 to hear
  useEffect(() => {
    if (type === 'pronunciation') speakCard(card.word, card.pinyin);
  }, [card.id, type]);

  const isSelfReport = type === 'pronunciation' || type === 'reading';

  return (
    <div className="quiz-fade-in flex flex-col gap-4 p-4 max-w-sm mx-auto w-full">
      {/* Prompt */}
      <p className="text-lg font-bold text-center" style={{ color: 'var(--color-primary-dark)' }}>
        {t.quizPrompt[type === 'fill-blank' ? 'fillBlank' : type === 'word-meaning' ? 'wordMeaning' : type]}
      </p>

      {/* Card display */}
      <div
        className="rounded-3xl p-6 text-center"
        style={{ background: theme.bg }}
      >
        <div className="card-emoji">{card.emoji}</div>
        {type === 'fill-blank' ? (
          <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text)' }}>
            {sentenceWithBlank}
          </p>
        ) : type === 'word-meaning' ? (
          <p className="card-word mt-2" style={{ color: theme.accent }}>{card.word}</p>
        ) : type === 'reading' ? (
          <p className="card-word mt-2 cjk-font" style={{ color: theme.accent }}>{card.chinese}</p>
        ) : (
          /* pronunciation */
          <p className="card-word mt-2" style={{ color: theme.accent }}>{card.word}</p>
        )}
      </div>

      {/* Hint toggle */}
      <button
        onClick={() => setShowHint(h => !h)}
        aria-expanded={showHint}
        className="text-sm font-semibold self-center"
        style={{ color: 'var(--color-accent)' }}
      >
        {t.quizHintBtn}
      </button>
      {showHint && (
        <p className="text-sm text-center px-4 py-2 rounded-xl" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
          {hintLoading ? '...' : hint}
        </p>
      )}

      {/* Choices or self-report */}
      {isSelfReport ? (
        <div className="flex flex-col gap-3">
          {type === 'pronunciation' && (
            <button
              onClick={() => speakCard(card.word, card.pinyin)}
              className="self-center text-2xl"
              aria-label="Play pronunciation"
            >🔊</button>
          )}
          {type === 'reading' && (
            <button
              onClick={() => speak(card.chinese, 'zh')}
              className="self-center text-2xl"
              aria-label="Play pronunciation"
            >🔊</button>
          )}
          <button
            onClick={() => handleSelfReport(true)}
            className="quiz-choice-btn"
            style={{ border: '3px solid var(--color-accent)' }}
          >
            {type === 'pronunciation' ? t.quizSaidIt : t.quizKnowIt}
          </button>
          <button
            onClick={() => handleSelfReport(false)}
            className="quiz-choice-btn"
            style={{ border: '3px solid #e0e0e0' }}
          >
            {type === 'pronunciation' ? t.quizSkip : t.quizDontKnow}
          </button>
        </div>
      ) : (
        <div role="radiogroup" className="flex flex-col gap-3">
          {(choices ?? []).map(c => {
            const isChosen = chosen === c.id;
            const isCorrect = c.id === card.id;
            const cls = 'quiz-choice-btn' + (isChosen ? (isCorrect ? ' correct' : ' wrong shake') : '');
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={isChosen}
                onClick={() => handleChoice(c)}
                className={cls}
              >
                {type === 'fill-blank' ? c.word : (
                  <span>
                    <span className="cjk-font" style={{ fontSize: 28 }}>{c.chinese}</span>
                    <span className="block text-sm" style={{ fontSize: 14 }}>{c.pinyin}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── QuizFeedback ─────────────────────────────────────────────────────────────

function QuizFeedback({ question, correct, t, lang, hintLoading, onNext, isLast }) {
  const { card } = question;
  const [showMemory, setShowMemory] = useState(!correct);
  const hint = card.quizHints?.[question.type] ?? null;

  const mascotCorrect = t.quizMascotCorrect;
  const mascotWrong = t.quizMascotWrong;
  const mascotEmpathy = t.quizMascotEmpathy;

  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  useEffect(() => {
    if (correct && typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        window.confetti?.({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    }
  }, [correct]);

  return (
    <div className="quiz-fade-in flex flex-col gap-4 p-4 max-w-sm mx-auto w-full">
      {correct ? (
        <>
          <p className="text-2xl font-bold text-center" style={{ color: 'var(--color-accent)' }}>
            {t.quizCorrectBanner}
          </p>
          <p className="text-center text-lg mascot-bounce">{randomPick(mascotCorrect)}</p>
        </>
      ) : (
        <>
          {/* Empathy first */}
          <p className="text-center text-lg">{randomPick(mascotEmpathy)}</p>
          <p className="text-center font-semibold" style={{ color: 'var(--color-coral)' }}>
            {t.quizWrongBanner(card.word)}
          </p>

          {/* Memory helper */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-warm-light)' }}>
            <p className="font-bold mb-2">{t.quizMemoryHelper}</p>
            {card.mnemonic && (
              <p className="text-sm mb-2">{card.mnemonic}</p>
            )}
            {hintLoading ? (
              <div className="quiz-hint-skeleton" />
            ) : hint ? (
              <>
                <p className="text-sm mb-1">{hint.encouragement}</p>
                <p className="text-sm italic mb-1">{hint.extraSentence}</p>
                <p className="text-sm font-mono">{hint.pronunciationGuide}</p>
              </>
            ) : null}
            {card.mascot_message && (
              <p className="text-sm mt-2" style={{ color: 'var(--color-muted)' }}>{card.mascot_message}</p>
            )}
            {lang === 'zh' || question.type === 'reading' ? (
              <button
                onClick={() => speak(card.chinese, 'zh')}
                className="mt-2 text-xl"
                aria-label="Play pronunciation"
              >🔊</button>
            ) : null}
          </div>
        </>
      )}

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl font-bold text-xl mt-2"
        style={{ background: 'var(--color-primary)', color: 'white' }}
      >
        {isLast ? t.quizFinish : (correct ? t.quizNext : t.quizGotIt)}
      </button>
    </div>
  );
}

// ─── QuizSummary ──────────────────────────────────────────────────────────────

function QuizSummary({ results, t, onRestart, onClose }) {
  const score = computeSessionScore(results);
  const isPerfect = score.correct === score.total && score.total > 0;

  useEffect(() => {
    if (isPerfect && typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        window.confetti?.({ particleCount: 150, spread: 100, origin: { y: 0.4 } });
      }
    }
  }, [isPerfect]);

  return (
    <div className="quiz-fade-in flex flex-col items-center gap-5 p-6 max-w-sm mx-auto">
      <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--color-primary-dark)' }}>
        {t.quizSummaryTitle}
      </h2>
      <p className="text-xl">{t.quizStars(score.stars)}</p>
      <p className="text-lg">{t.quizScoreMsg(score.correct, score.total)}</p>

      {score.stars === 0 && score.total > 0 && (
        <p className="text-center" style={{ color: 'var(--color-coral)' }}>{t.quizScoreLow}</p>
      )}
      {score.stars === 1 && <p>{t.quizScoreMid}</p>}
      {score.stars === 2 && <p>{t.quizScoreHigh}</p>}
      {score.stars === 3 && <p>{t.quizScorePerfect}</p>}

      {score.weakCards.length > 0 && (
        <div className="w-full">
          <p className="font-semibold mb-2">{t.quizWeakTitle}</p>
          <div className="flex flex-col gap-2">
            {score.weakCards.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="font-bold">{c.word}</span>
                {c.chinese && <span className="cjk-font text-sm">{c.chinese}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onRestart}
        className="w-full py-4 rounded-2xl font-bold text-xl"
        style={{ background: 'var(--color-primary)', color: 'white' }}
      >
        {t.quizRestart}
      </button>
      <button
        onClick={onClose}
        className="text-sm"
        style={{ color: 'var(--color-muted)' }}
      >
        {t.quizBackToDeck}
      </button>
    </div>
  );
}

// ─── QuizMode (root) ──────────────────────────────────────────────────────────

export default function QuizMode({ t, lang, deck, onClose, onUpdateMastery, onPatchCard }) {
  const [phase, setPhase] = useState('lobby');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [lastCorrect, setLastCorrect] = useState(null);
  const [hintLoadingSet, setHintLoadingSet] = useState(new Set());

  const currentQuestion = questions[currentIdx] ?? null;
  const isLast = currentIdx === questions.length - 1;

  async function handleStart({ subject, count }) {
    const modes = subject === 'english' ? EN_MODES : ZH_MODES;
    const selected = selectQuizCards(deck, subject, count);
    const built = buildQuestions(selected, deck, modes);
    setQuestions(built);
    setCurrentIdx(0);
    setResults([]);
    setLastCorrect(null);

    // Track which cards still need hints
    const cardIds = new Set(built.map(q => q.card.id));
    setHintLoadingSet(new Set(cardIds));
    setPhase('question');

    // Prefetch hints: first PREFETCH_EAGER eager, rest in background
    const eager = built.slice(0, PREFETCH_EAGER);
    const rest = built.slice(PREFETCH_EAGER);

    async function fetchHintForQuestion(q) {
      const { card, type } = q;
      const existing = card.quizHints?.[type];
      if (existing) {
        setHintLoadingSet(prev => { const s = new Set(prev); s.delete(card.id); return s; });
        return;
      }
      const hint = await getQuizHint({
        word: card.word,
        chinese: card.chinese,
        pinyin: card.pinyin,
        subject: card.subject,
        type,
        hasMnemonic: !!card.mnemonic,
      });
      if (hint) {
        const newHints = { ...(card.quizHints ?? {}), [type]: hint };
        onPatchCard(card.id, { quizHints: newHints });
        if (hint.mnemonic && !card.mnemonic) {
          onPatchCard(card.id, { mnemonic: hint.mnemonic });
        }
      }
      setHintLoadingSet(prev => { const s = new Set(prev); s.delete(card.id); return s; });
    }

    await Promise.allSettled(eager.map(fetchHintForQuestion));
    // Background fetch for remaining questions (don't await)
    Promise.allSettled(rest.map(fetchHintForQuestion));
  }

  function handleAnswer(correct, _chosenId) {
    const q = questions[currentIdx];
    onUpdateMastery(q.card.id, correct);
    setLastCorrect(correct);
    setResults(prev => [...prev, { cardId: q.card.id, card: q.card, type: q.type, correct }]);
    setPhase('feedback');
  }

  function handleNext() {
    if (isLast) {
      setPhase('summary');
    } else {
      setCurrentIdx(i => i + 1);
      setPhase('question');
    }
  }

  function handleRestart() {
    setPhase('lobby');
    setQuestions([]);
    setResults([]);
    setCurrentIdx(0);
    setLastCorrect(null);
    setHintLoadingSet(new Set());
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-bg)' }}
      role="dialog"
      aria-modal="true"
      aria-label={t.startQuiz}
    >
      {/* Close button (always visible) */}
      {phase !== 'summary' && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl z-10"
          aria-label="Close quiz"
          style={{ color: 'var(--color-muted)' }}
        >
          {t.close}
        </button>
      )}

      <div className="pt-12 pb-24 min-h-screen flex flex-col">
        {phase === 'lobby' && (
          <QuizLobby t={t} deck={deck} onStart={handleStart} onClose={onClose} />
        )}

        {phase === 'question' && currentQuestion && (
          <>
            <QuizProgress current={currentIdx} total={questions.length} t={t} />
            <QuizQuestion
              key={currentIdx}
              question={currentQuestion}
              t={t}
              lang={lang}
              onAnswer={handleAnswer}
              hintLoading={hintLoadingSet.has(currentQuestion.card.id)}
            />
          </>
        )}

        {phase === 'feedback' && currentQuestion && (
          <QuizFeedback
            key={`feedback-${currentIdx}`}
            question={currentQuestion}
            correct={lastCorrect}
            t={t}
            lang={lang}
            hintLoading={hintLoadingSet.has(currentQuestion.card.id)}
            onNext={handleNext}
            isLast={isLast}
          />
        )}

        {phase === 'summary' && (
          <QuizSummary
            results={results}
            t={t}
            onRestart={handleRestart}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
