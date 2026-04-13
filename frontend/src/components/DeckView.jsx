import { useState } from 'react';
import { getTheme } from '../lib/colorThemes';

const FILTER_IDS = ['all', 'english', 'chinese', 'math'];

export default function DeckView({ t, deck, onDelete, onClose, onStartQuiz, onToggleQuizDisabled }) {
  const [filter, setFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = filter === 'all' ? deck : deck.filter((c) => c.subject === filter);

  const filterLabel = (id) =>
    id === 'all' ? t.filterAll : (t.filterLabels[id] ?? id);

  function handleExport() {
    const json = JSON.stringify(deck, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starcards-deck-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }} role="dialog" aria-modal="true" aria-label={t.deckTitle(deck.length)}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--color-border)' }}
      >
        <h2 className="text-xl font-bold" style={{ fontFamily: '"Baloo 2", cursive', color: 'var(--color-primary-dark)' }}>
          {t.deckTitle(deck.length)}
        </h2>
        <div className="flex items-center gap-2">
          {deck.length >= 5 && onStartQuiz && (
            <button
              onClick={() => { onClose(); onStartQuiz(); }}
              className="px-3 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'var(--color-warm-light)', color: 'var(--color-warm)' }}
            >
              {t.startQuiz}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold hover:opacity-75"
            style={{ backgroundColor: 'var(--color-bg)' }}
            aria-label={t.close}
          >
            {t.close}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {deck.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span style={{ fontSize: 64 }} role="img" aria-label="panda">🐼</span>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-muted)' }}>{t.deckEmpty}</p>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' }}
            >
              {t.generateFirst}
            </button>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {FILTER_IDS.map((id) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className="subject-tab px-4 rounded-2xl text-sm font-bold whitespace-nowrap flex-shrink-0 transition-colors"
                  style={
                    filter === id
                      ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                      : { backgroundColor: 'white', color: 'var(--color-muted)' }
                  }
                  aria-pressed={filter === id}
                >
                  {filterLabel(id)}
                </button>
              ))}
            </div>

            {/* Empty filter */}
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-base font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>
                  {t.filterEmpty(filterLabel(filter))}
                </p>
                <button
                  onClick={() => setFilter('all')}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}
                >
                  {t.clearFilter}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {filtered.map((card) => {
                  const theme = getTheme(card.color_theme);
                  return (
                    <div
                      key={card.id}
                      className="relative rounded-2xl p-4 flex flex-col gap-2"
                      style={{ backgroundColor: theme.bg, boxShadow: '0 2px 8px rgba(127,119,221,0.08)', minHeight: 120 }}
                    >
                      {confirmDelete === card.id ? (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={() => { onDelete(card.id); setConfirmDelete(null); }}
                            className="text-xs px-2 py-1 rounded-lg font-bold text-white"
                            style={{ backgroundColor: 'var(--color-coral)' }}
                          >
                            {t.confirmDelete}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs px-2 py-1 rounded-lg font-bold"
                            style={{ backgroundColor: 'white' }}
                          >
                            {t.cancelDelete}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(card.id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-50 hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
                          aria-label={`${t.confirmDelete} ${card.word}`}
                        >
                          ✕
                        </button>
                      )}

                      <div className="text-2xl" role="img" aria-hidden="true">{card.emoji}</div>
                      <div className="font-bold text-sm truncate" style={{ color: theme.accent }}>{card.word}</div>
                      {card.chinese && (
                        <div className="text-xs cjk-font truncate" style={{ color: 'var(--color-text)' }}>{card.chinese}</div>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: theme.accent }}
                        >
                          {card.subject === 'english' ? 'EN' : card.subject === 'chinese' ? 'ZH' : 'MATH'}
                        </span>
                        {onToggleQuizDisabled && (
                          <button
                            onClick={() => onToggleQuizDisabled(card.id, card.quizDisabled ?? false)}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: 'var(--color-muted)' }}
                          >
                            {card.quizDisabled ? t.quizEnable : t.quizDisable}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-center pb-8">
              <button
                onClick={handleExport}
                className="px-5 py-2 rounded-2xl text-sm font-bold hover:opacity-80"
                style={{ backgroundColor: 'white', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
              >
                {t.exportDeck}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
