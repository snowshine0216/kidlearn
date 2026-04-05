import { speak } from '../lib/speech';

export default function CardActions({ t, card }) {
  if (!card) return null;

  function handleHear() {
    speak(card.word, 'en');
    setTimeout(() => { if (card.pinyin) speak(card.pinyin, 'zh'); }, 1400);
  }

  return (
    <div className="card-actions card-actions-row flex gap-3 px-4 pb-3 pt-1">
      <button
        onClick={handleHear}
        className="card-action-btn flex-1 rounded-2xl font-bold text-sm transition-colors"
        style={{ backgroundColor: 'var(--color-warm-light)', color: 'var(--color-warm)' }}
        aria-label={t.hearIt}
      >
        {t.hearIt}
      </button>

      <button
        onClick={() => window.print()}
        className="card-action-btn px-4 rounded-2xl font-bold text-sm transition-colors hidden md:flex items-center"
        style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}
        aria-label={t.print}
      >
        {t.print}
      </button>
    </div>
  );
}
