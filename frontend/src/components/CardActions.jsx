import { useState } from 'react';
import { speak, speechSupported } from '../lib/speech';

export default function CardActions({ t, card, onSave, isSaved }) {
  const [pulseGreen, setPulseGreen] = useState(false);

  if (!card) return null;

  // Derive saved from prop (not local state) so cross-tab deck changes are reflected
  const saved = isSaved ?? false;

  function handleSave() {
    if (saved) return;
    const success = onSave?.(card);
    if (success !== false) {
      setPulseGreen(true);
      setTimeout(() => setPulseGreen(false), 600);
    }
  }

  function handleHear() {
    speak(card.word, 'en');
    setTimeout(() => { if (card.pinyin) speak(card.pinyin, 'zh'); }, 1400);
  }

  return (
    <div className="card-actions card-actions-row flex gap-3 px-4 pb-3 pt-1">
      <button
        onClick={handleSave}
        disabled={saved}
        className={`card-action-btn flex-1 rounded-2xl font-bold text-sm text-white transition-all ${pulseGreen ? 'pulse-green' : ''}`}
        style={{
          background: saved
            ? 'var(--color-accent)'
            : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
          opacity: saved ? 0.8 : 1,
        }}
        aria-label={saved ? t.saved : t.saveToDeck}
      >
        {saved ? t.saved : t.saveToDeck}
      </button>

      <button
        onClick={handleHear}
        className="card-action-btn px-4 rounded-2xl font-bold text-sm transition-colors"
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
