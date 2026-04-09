import { useState, useEffect, useCallback, useRef } from 'react';
import { buildQuestions, selectQuizCards, computeSessionScore, applyMasteryResult } from '../lib/quizLogic';
import { getQuizHint } from '../lib/quizHintApi';
import { speakCardFull, speak } from '../lib/speech';
import { getTheme } from '../lib/colorThemes';

const EN_MODES = ['pronunciation', 'fill-blank', 'word-meaning', 'chinese-meaning'];
const ZH_MODES = ['reading', 'zh-fill-blank', 'zh-pinyin'];
const COUNT_OPTIONS = [5, 10, 20];
const COUNTDOWN_OPTIONS = [
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '1 min' },
  { seconds: 120, label: '2 min' },
  { seconds: 300, label: '5 min' },
];
const PREFETCH_EAGER = 5;

// ─── QuizLobby ───────────────────────────────────────────────────────────────

function QuizLobby({ t, deck, onStart, onClose }) {
  const [subject, setSubject] = useState('english');
  const [count, setCount] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownInterval, setCountdownInterval] = useState(30);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  const subjectDeck = deck.filter(c => c.subject === subject);
  const canStart = subjectDeck.length >= 5;

  async function handleStart() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    await onStart({ subject, count, showCountdown, countdownInterval });
    inFlightRef.current = false;
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

      {/* Countdown toggle */}
      <div className="w-full">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
            {t.quizShowCountdown}
          </p>
          <button
            onClick={() => setShowCountdown(v => !v)}
            className="px-3 py-1 rounded-xl font-bold text-sm"
            style={{
              background: showCountdown ? 'var(--color-primary)' : 'var(--color-primary-light)',
              color: showCountdown ? 'white' : 'var(--color-primary-dark)',
            }}
          >
            {showCountdown ? t.quizCountdownOn : t.quizCountdownOff}
          </button>
        </div>
        {showCountdown && (
          <div className="flex gap-2 mt-2">
            {COUNTDOWN_OPTIONS.map(({ seconds, label }) => (
              <button
                key={seconds}
                onClick={() => setCountdownInterval(seconds)}
                className="flex-1 py-2 rounded-xl font-bold text-sm"
                style={{
                  background: countdownInterval === seconds ? 'var(--color-primary)' : 'var(--color-primary-light)',
                  color: countdownInterval === seconds ? 'white' : 'var(--color-primary-dark)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
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

function QuizQuestion({ question, t, lang, onAnswer, hintLoading, settings, onSkipFeedback }) {
  const { card, type, hint, choices, sentenceWithBlank } = question;
  const memoryHint = card.quizHints?.[type] ?? null;
  const { showCountdown = false, countdownInterval = 30 } = settings ?? {};
  const [showHint, setShowHint] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [timeLeft, setTimeLeft] = useState(countdownInterval);
  const [showReminder, setShowReminder] = useState(false);
  // null = unanswered; true = 我会了 clicked; false = 还不会 clicked
  const [selfReportPending, setSelfReportPending] = useState(null);
  const theme = getTheme(card.color_theme ?? 'purple');

  function playBell() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
      // Close context when audio ends; fallback timeout handles suspended contexts
      osc.onended = () => ctx.close().catch(() => {});
      setTimeout(() => ctx.close().catch(() => {}), 1000);
    } catch (e) { /* ignore */ }
  }

  const timerExpiredRef = useRef(false);

  // Tick: pure state decrement, no side effects in updater
  useEffect(() => {
    if (!showCountdown) return;
    timerExpiredRef.current = false;
    const id = setInterval(() => setTimeLeft(prev => (prev > 1 ? prev - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [card.id, showCountdown]);

  // Expiry: fires once when timeLeft hits 0, skipped if already answered
  useEffect(() => {
    if (!showCountdown || timeLeft > 0 || timerExpiredRef.current) return;
    if (chosen || selfReportPending !== null) return;
    timerExpiredRef.current = true;
    playBell();
    setShowReminder(true);
    const advanceTimer = setTimeout(() => onAnswer(false, card.id), 1500);
    return () => clearTimeout(advanceTimer);
  }, [timeLeft, showCountdown, chosen, selfReportPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // chinese-meaning: auto-speak the English word when the question is shown
  useEffect(() => {
    if (type === 'chinese-meaning' && card.word) {
      speak(card.word, 'en');
    }
  }, [card.id, type]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChoice(c) {
    if (chosen) return;
    const correct = c.id === card.id;
    setChosen(c.id);
    setTimeout(() => onAnswer(correct, c.id), 600);
  }

  // Self-report: show inline animation, speak audio.
  // Correct: auto-advance after praise animation.
  // Wrong: stay on page showing card + memory tips; user clicks "Got it" to advance.
  function handleSelfReport(correct) {
    if (selfReportPending !== null) return;
    setSelfReportPending(correct);
    speakCardFull(card);
    if (correct) {
      setTimeout(() => onAnswer(correct, card.id), 1600);
    }
  }

  const isSelfReport = type === 'pronunciation' || type === 'reading';

  // ── Card display area: normal | praise overlay | memory overlay ──────────
  const cardDisplay = selfReportPending === true ? (
    /* Correct — celebration burst */
    <div
      className="quiz-praise-pop rounded-3xl p-6 text-center flex flex-col items-center gap-3"
      style={{ background: 'var(--color-accent-light)' }}
    >
      <div className="relative inline-block">
        <span className="text-6xl">{card.emoji}</span>
        <span className="absolute -top-4 -right-2 text-2xl quiz-star-1">⭐</span>
        <span className="absolute -top-6 left-1 text-xl quiz-star-2">✨</span>
        <span className="absolute -top-3 -left-5 text-2xl quiz-star-3">🌟</span>
      </div>
      <p className="text-3xl font-bold" style={{ color: 'var(--color-accent)' }}>
        {t.quizSelfPraise}
      </p>
    </div>
  ) : selfReportPending === false ? (
    /* Wrong — card reveal + full memory tips inline */
    <div
      className="quiz-memory-reveal rounded-3xl p-5 text-center"
      style={{ background: theme.bg }}
    >
      <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-muted)' }}>
        {t.quizRememberIt}
      </p>
      {card.chinese && (
        <p className="cjk-font font-bold" style={{ fontSize: 52, color: theme.accent, lineHeight: 1.2 }}>
          {card.chinese}
        </p>
      )}
      {card.pinyin && (
        <p className="card-pinyin mt-1" style={{ color: 'var(--color-muted)' }}>{card.pinyin}</p>
      )}
      <p className="font-bold mt-1 card-word" style={{ color: theme.accent }}>{card.word}</p>
      {card.mnemonic && (
        <p className="text-sm mt-3 px-3 py-2 rounded-xl" style={{ background: 'var(--color-warm-light)', color: 'var(--color-text)' }}>
          💡 {card.mnemonic}
        </p>
      )}

      {/* AI memory tips */}
      <div className="rounded-xl p-3 mt-3 text-left" style={{ background: 'var(--color-warm-light)' }}>
        <p className="font-bold text-sm mb-2">{t.quizMemoryHelper}</p>
        {hintLoading ? (
          <div className="quiz-hint-skeleton" />
        ) : memoryHint ? (
          <>
            <p className="text-sm mb-1">{memoryHint.encouragement}</p>
            <p className="text-sm italic mb-1">{memoryHint.extraSentence}</p>
            <p className="text-sm font-mono">{memoryHint.pronunciationGuide}</p>
          </>
        ) : null}
        {/* 🔊 speaks the memory tip text, not the full card audio */}
        <button
          onClick={() => {
            const text = card.mnemonic || memoryHint?.encouragement;
            if (text) speak(text, 'zh');
          }}
          className="mt-2 text-xl"
          aria-label="Speak memory tip"
        >🔊</button>
      </div>

      {/* Got it — records wrong answer and advances directly, skipping feedback */}
      <button
        onClick={onSkipFeedback}
        className="w-full mt-4 py-3 rounded-2xl font-bold text-lg"
        style={{ background: 'var(--color-primary)', color: 'white' }}
      >
        {t.quizGotIt}
      </button>
    </div>
  ) : (
    /* Normal card display */
    <div className="rounded-3xl p-6 text-center" style={{ background: theme.bg }}>
      <div className="card-emoji">{card.emoji}</div>
      {type === 'fill-blank' ? (
        <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text)' }}>
          {sentenceWithBlank}
        </p>
      ) : type === 'word-meaning' ? (
        <p className="card-word mt-2" style={{ color: theme.accent }}>{card.word}</p>
      ) : type === 'reading' ? (
        <p className="card-word mt-2 cjk-font" style={{ color: theme.accent }}>{card.chinese}</p>
      ) : type === 'chinese-meaning' ? (
        <>
          <p className="cjk-font font-bold mt-2" style={{ fontSize: 52, color: theme.accent, lineHeight: 1.2 }}>
            {card.chinese}
          </p>
          {card.pinyin && (
            <p className="card-pinyin mt-1" style={{ color: 'var(--color-muted)' }}>{card.pinyin}</p>
          )}
        </>
      ) : type === 'zh-fill-blank' ? (
        <p className="text-2xl font-bold mt-2 cjk-font" style={{ color: 'var(--color-text)' }}>
          {sentenceWithBlank}
        </p>
      ) : type === 'zh-pinyin' ? (
        <p className="card-word mt-2 cjk-font" style={{ color: theme.accent }}>{card.chinese}</p>
      ) : (
        /* pronunciation — silent; child tries to say it first */
        <p className="card-word mt-2" style={{ color: theme.accent }}>{card.word}</p>
      )}
    </div>
  );

  return (
    <div className="quiz-fade-in flex flex-col gap-4 p-4 max-w-sm mx-auto w-full">
      {/* Prompt */}
      <p className="text-lg font-bold text-center" style={{ color: 'var(--color-primary-dark)' }}>
        {t.quizPrompt[
          type === 'fill-blank' ? 'fillBlank'
          : type === 'word-meaning' ? 'wordMeaning'
          : type === 'chinese-meaning' ? 'chineseMeaning'
          : type === 'zh-fill-blank' ? 'zhFillBlank'
          : type === 'zh-pinyin' ? 'zhPinyin'
          : type
        ]}
      </p>

      {cardDisplay}

      {/* Countdown — only shown when enabled and no animation playing */}
      {showCountdown && selfReportPending === null && (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
          {showReminder ? (
            <span style={{ color: 'var(--color-coral)' }}>{t.quizTimeUp}</span>
          ) : (
            <span>⏱️ {timeLeft}s</span>
          )}
        </div>
      )}

      {/* Hint toggle */}
      {selfReportPending === null && (
        <>
          <button
            onClick={() => setShowHint(h => !h)}
            aria-expanded={showHint}
            className="text-sm font-semibold self-center"
            style={{ color: 'var(--color-accent)' }}
          >
            {t.quizHintBtn}
          </button>
          {showHint && (
            <p className="text-lg text-center px-4 py-2 rounded-xl" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
              {hintLoading ? '...' : hint}
            </p>
          )}
        </>
      )}

      {/* Choices or self-report */}
      {isSelfReport ? (
        <div className="flex flex-col gap-3">
          {/* 🔊 button for reading mode — on-demand only */}
          {type === 'reading' && selfReportPending === null && (
            <button
              onClick={() => speak(card.chinese, 'zh')}
              className="self-center text-2xl"
              aria-label="Play pronunciation"
            >🔊</button>
          )}
          {/* pronunciation: NO 🔊 before answering — silence lets child try first */}
          <button
            onClick={() => handleSelfReport(true)}
            disabled={selfReportPending !== null}
            className="quiz-choice-btn"
            style={{
              border: '3px solid var(--color-accent)',
              background: selfReportPending === true ? 'var(--color-accent)' : undefined,
              color: selfReportPending === true ? 'white' : undefined,
              transition: 'all 0.25s ease',
            }}
          >
            {type === 'pronunciation' ? t.quizSaidIt : t.quizKnowIt}
          </button>
          <button
            onClick={() => handleSelfReport(false)}
            disabled={selfReportPending !== null}
            className="quiz-choice-btn"
            style={{
              border: `3px solid ${selfReportPending === false ? 'var(--color-coral)' : '#e0e0e0'}`,
              background: selfReportPending === false ? 'var(--color-coral-light)' : undefined,
              transition: 'all 0.25s ease',
            }}
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
                {type === 'fill-blank' || type === 'chinese-meaning'
                  ? c.word
                  : type === 'zh-fill-blank'
                  ? <span className="cjk-font" style={{ fontSize: 24 }}>{c.chinese}</span>
                  : type === 'zh-pinyin'
                  ? c.pinyin
                  : (
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
  const mascotEmpathy = t.quizMascotEmpathy;

  // Stable random picks — computed once on mount so re-renders don't flash different text
  const [picked] = useState(() => ({
    correct: mascotCorrect[Math.floor(Math.random() * mascotCorrect.length)],
    empathy: mascotEmpathy[Math.floor(Math.random() * mascotEmpathy.length)],
  }));

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
          <p className="text-center text-lg mascot-bounce">{picked.correct}</p>
        </>
      ) : (
        <>
          {/* Empathy first */}
          <p className="text-center text-lg">{picked.empathy}</p>
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
            {lang === 'zh' || question.type === 'reading' || question.type === 'pronunciation' ? (
              <button
                onClick={() => speakCardFull(card)}
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

function QuizSummary({ results, t, onRestart, onRetryFailed, onClose }) {
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
      {score.weakCards.length > 0 && (
        <button
          onClick={() => onRetryFailed(score.weakCards)}
          className="w-full py-4 rounded-2xl font-bold text-xl"
          style={{ background: 'var(--color-coral)', color: 'white' }}
        >
          {t.quizRetryFailed}
        </button>
      )}
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
  const [quizSettings, setQuizSettings] = useState({ showCountdown: false, countdownInterval: 30 });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const currentQuestion = questions[currentIdx] ?? null;
  const isLast = currentIdx === questions.length - 1;

  async function handleStart({ subject, count, showCountdown, countdownInterval }) {
    setQuizSettings({ showCountdown, countdownInterval });
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
        // Merge all patch fields into a single call to avoid race between two setDeck updates
        const patch = { quizHints: newHints };
        if (hint.mnemonic && !card.mnemonic) patch.mnemonic = hint.mnemonic;
        if (mountedRef.current) onPatchCard(card.id, patch);
        // Update frozen questions array so QuizFeedback sees new hints without re-selecting from deck
        if (mountedRef.current) {
          setQuestions(prev => prev.map(q =>
            q.card.id === card.id ? { ...q, card: { ...q.card, ...patch, quizHints: newHints } } : q
          ));
        }
      }
      if (mountedRef.current) {
        setHintLoadingSet(prev => { const s = new Set(prev); s.delete(card.id); return s; });
      }
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

  function handleSkipFeedback() {
    const q = questions[currentIdx];
    onUpdateMastery(q.card.id, false);
    setResults(prev => [...prev, { cardId: q.card.id, card: q.card, type: q.type, correct: false }]);
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

  async function handleRetryFailed(weakCards) {
    const subject = weakCards[0]?.subject ?? 'chinese';
    const modes = subject === 'english' ? EN_MODES : ZH_MODES;
    const built = buildQuestions(weakCards, deck, modes);

    setQuestions(built);
    setCurrentIdx(0);
    setResults([]);
    setLastCorrect(null);
    setQuizSettings({ showCountdown: false, countdownInterval: 30 });
    setHintLoadingSet(new Set(built.map(q => q.card.id)));
    setPhase('question');

    async function fetchHintForQuestion(q) {
      const { card, type } = q;
      if (card.quizHints?.[type]) {
        setHintLoadingSet(prev => { const s = new Set(prev); s.delete(card.id); return s; });
        return;
      }
      const hint = await getQuizHint({ word: card.word, chinese: card.chinese, pinyin: card.pinyin, subject: card.subject, type, hasMnemonic: !!card.mnemonic });
      if (hint) {
        const newHints = { ...(card.quizHints ?? {}), [type]: hint };
        const patch = { quizHints: newHints };
        if (hint.mnemonic && !card.mnemonic) patch.mnemonic = hint.mnemonic;
        if (mountedRef.current) onPatchCard(card.id, patch);
        if (mountedRef.current) {
          setQuestions(prev => prev.map(q => q.card.id === card.id ? { ...q, card: { ...q.card, ...patch, quizHints: newHints } } : q));
        }
      }
      if (mountedRef.current) {
        setHintLoadingSet(prev => { const s = new Set(prev); s.delete(card.id); return s; });
      }
    }

    const eager = built.slice(0, PREFETCH_EAGER);
    const rest = built.slice(PREFETCH_EAGER);
    await Promise.allSettled(eager.map(fetchHintForQuestion));
    Promise.allSettled(rest.map(fetchHintForQuestion));
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
              settings={quizSettings}
              onSkipFeedback={handleSkipFeedback}
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
            onRetryFailed={handleRetryFailed}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
