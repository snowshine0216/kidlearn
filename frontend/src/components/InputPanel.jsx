import { useState, useRef } from 'react';
import { generateCard } from '../lib/claudeApi';

const SUBJECT_IDS = ['english', 'chinese', 'math'];

const SUBJECT_STYLES = {
  english: { activeBg: 'var(--color-blue-light)', activeColor: 'var(--color-blue)' },
  chinese: { activeBg: 'var(--color-coral-light)', activeColor: '#4A1B0C' },
  math:    { activeBg: 'var(--color-accent-light)', activeColor: '#085041' },
};

export default function InputPanel({ t, onCardGenerated, onLoading, recentCards, onLoadRecent, onDeleteCard }) {
  const [subject, setSubject] = useState('english'); // default: English (user decision)
  const [word, setWord] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef(null);

  async function handleGenerate() {
    if (!word.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    onLoading?.(true);
    try {
      const card = await generateCard(word.trim(), subject);
      if (card) onCardGenerated?.({ ...card, subject });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      onLoading?.(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleGenerate();
  }

  const subjectStyle = SUBJECT_STYLES[subject];

  return (
    <div
      className={`input-panel relative bg-white rounded-3xl flex flex-col transition-all duration-300 ${
        collapsed ? 'input-panel-collapsed' : 'w-80'
      }`}
      style={{ boxShadow: '0 4px 24px rgba(127, 119, 221, 0.08)', flexShrink: 0 }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold shadow"
        style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
        aria-label={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      <div className="panel-content flex-1 flex flex-col gap-4 p-5 transition-opacity duration-300 min-h-0">
        {/* Subject selector */}
        <div>
          <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>
            {t.subjectLabel}
          </p>
          <div className="flex gap-2">
            {SUBJECT_IDS.map((id) => {
              const style = SUBJECT_STYLES[id];
              return (
                <button
                  key={id}
                  onClick={() => { setSubject(id); setWord(''); inputRef.current?.focus(); }}
                  className="subject-tab flex-1 rounded-2xl text-sm font-bold transition-colors"
                  style={
                    subject === id
                      ? { backgroundColor: style.activeBg, color: style.activeColor }
                      : { backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }
                  }
                  aria-pressed={subject === id}
                  aria-label={t.subjects[id]}
                >
                  {t.subjects[id]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Word input */}
        <div>
          <input
            ref={inputRef}
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholders[subject]}
            maxLength={50}
            className="w-full px-4 py-3 rounded-2xl text-base outline-none transition-shadow"
            style={{ border: '2px solid var(--color-border)', fontFamily: 'inherit' }}
            aria-label={t.placeholders[subject]}
          />
          <p className="text-xs mt-1 px-1" style={{ color: 'var(--color-muted)' }}>
            {t.inputHint}
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--color-coral-light)', color: 'var(--color-coral)' }}>
            {error}
          </p>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!word.trim() || isLoading}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-opacity disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            boxShadow: '0 4px 12px rgba(127, 119, 221, 0.30)',
          }}
          aria-label={t.generate}
        >
          {isLoading ? t.generating : t.generate}
        </button>

        {/* Recent words */}
        {recentCards && recentCards.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>
              {t.recentLabel}
            </p>
            <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
              {recentCards.map((c) => (
                <div
                  key={c.id}
                  className="recent-chip flex items-center gap-1 rounded-xl"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <button
                    onClick={() => onLoadRecent?.(c)}
                    className="flex-1 text-left px-3 py-2 text-sm font-semibold hover:opacity-80 transition-opacity min-w-0"
                    aria-label={c.word}
                  >
                    <span className="font-bold">{c.subject === 'chinese' && c.chinese ? c.chinese : c.word}</span>{' '}
                    <span
                      className="text-xs rounded-full px-2 py-0.5 font-bold"
                      style={{
                        backgroundColor: SUBJECT_STYLES[c.subject]?.activeBg ?? 'var(--color-bg)',
                        color: SUBJECT_STYLES[c.subject]?.activeColor ?? 'var(--color-muted)',
                      }}
                    >
                      {c.subject === 'english' ? 'EN' : c.subject === 'chinese' ? 'ZH' : 'MATH'}
                    </span>{' '}
                    <span style={{ color: 'var(--color-muted)' }}>
                      • {new Date(c.savedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </button>
                  {onDeleteCard && (
                    <button
                      onClick={() => onDeleteCard(c.id)}
                      className="px-2 py-1 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 text-sm"
                      style={{ color: 'var(--color-muted)' }}
                      aria-label={`Delete ${c.subject === 'chinese' && c.chinese ? c.chinese : c.word}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
