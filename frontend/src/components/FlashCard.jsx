import { useEffect } from 'react';
import DOMPurify from 'dompurify';
import { getTheme } from '../lib/colorThemes';
import { speakCardFull } from '../lib/speech';

function safe(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['em'], ALLOWED_ATTR: [] });
}

const SUBJECT_BADGES = {
  english: { label: 'EN',   bg: 'var(--color-blue-light)',   color: 'var(--color-blue)' },
  chinese: { label: 'ZH',   bg: 'var(--color-coral-light)',  color: 'var(--color-coral)' },
  math:    { label: 'MATH', bg: 'var(--color-accent-light)', color: 'var(--color-accent)' },
};

export default function FlashCard({ t, card, isLoading, subject, onReport }) {
  useEffect(() => {
    if (card && !isLoading) {
      speakCardFull(card);
    }
  }, [card?.id]);

  if (isLoading) {
    return <div className="card-loading w-full" aria-label="Loading..." />;
  }

  if (!card) {
    return (
      <div
        className="flashcard flex items-center justify-center min-h-[360px] rounded-3xl border-2 border-dashed text-center p-8"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p className="text-lg" style={{ color: 'var(--color-muted)' }}>
          {t.emptyState}
        </p>
      </div>
    );
  }

  const theme = getTheme(card.color_theme);
  const badge = SUBJECT_BADGES[subject] ?? SUBJECT_BADGES.english;

  return (
    <div
      className="flashcard card-enter relative rounded-3xl p-6 overflow-hidden"
      style={{ backgroundColor: theme.bg, boxShadow: '0 4px 24px rgba(127, 119, 221, 0.10)' }}
    >
      {/* Decorative circles — pointer-events-none prevents touch interception over buttons */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 pointer-events-none" style={{ backgroundColor: theme.accent }} />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-15 pointer-events-none" style={{ backgroundColor: theme.accent }} />

      {/* Subject tag */}
      <div className="relative flex mb-4">
        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </div>

      {/* Emoji */}
      <div className="relative text-center mb-4">
        <span className="card-emoji" role="img" aria-label={card.word}>{card.emoji}</span>
      </div>

      {/* Word + Chinese + Pinyin
          Chinese subject: show 汉字 big → pinyin → English small
          English/Math:    show English big → 汉字 → pinyin */}
      <div className="relative text-center mb-4 space-y-1">
        {subject === 'chinese' && card.chinese ? (
          <>
            <div className="card-chinese font-bold" style={{ color: theme.accent }}>{card.chinese}</div>
            {card.pinyin && (
              <div className="card-pinyin" style={{ color: 'var(--color-muted)' }}>{card.pinyin}</div>
            )}
            <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-muted)' }}>{card.word}</div>
          </>
        ) : (
          <>
            <div className="card-word" style={{ color: theme.accent }}>{card.word}</div>
            {card.chinese && (
              <div className="card-chinese font-semibold" style={{ color: 'var(--color-text)' }}>{card.chinese}</div>
            )}
            {card.pinyin && (
              <div className="card-pinyin" style={{ color: 'var(--color-muted)' }}>{card.pinyin}</div>
            )}
          </>
        )}
      </div>

      {/* Sentence */}
      {card.sentence && (
        <div className="relative rounded-2xl p-3 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}>
          <p className="card-sentence" dangerouslySetInnerHTML={{ __html: safe(card.sentence) }} />
          {card.sentence_zh && (
            <p className="card-sentence card-chinese mt-1 text-sm" dangerouslySetInnerHTML={{ __html: safe(card.sentence_zh) }} />
          )}
        </div>
      )}

      {/* Mnemonic */}
      {card.mnemonic && (
        <div className="relative rounded-2xl p-3 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}>
          <p className="card-mnemonic" style={{ color: 'var(--color-muted)' }}>💡 {card.mnemonic}</p>
        </div>
      )}

      {/* Self-report buttons */}
      <div className="relative flex gap-3 justify-center mt-2">
        <button
          onClick={() => onReport?.(card.id, true)}
          className="card-action-btn flex-1 rounded-2xl font-bold text-sm transition-colors"
          style={{
            backgroundColor: card.knewIt === true ? 'var(--color-accent)' : 'rgba(255,255,255,0.7)',
            color: card.knewIt === true ? 'white' : 'var(--color-accent)',
            border: '2px solid var(--color-accent)',
          }}
          aria-label={t.iKnowIt}
        >
          {t.iKnowIt}
        </button>
        <button
          onClick={() => onReport?.(card.id, false)}
          className="card-action-btn flex-1 rounded-2xl font-bold text-sm transition-colors"
          style={{
            backgroundColor: card.knewIt === false ? 'var(--color-coral)' : 'rgba(255,255,255,0.7)',
            color: card.knewIt === false ? 'white' : 'var(--color-coral)',
            border: '2px solid var(--color-coral)',
          }}
          aria-label={t.notYet}
        >
          {t.notYet}
        </button>
      </div>
    </div>
  );
}
