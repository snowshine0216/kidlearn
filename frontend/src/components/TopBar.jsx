export default function TopBar({ t, streak, onShowDeck, onLangToggle, onStartQuiz, canStartQuiz }) {
  return (
    <header
      className="top-bar flex items-center justify-between px-5 py-3"
      style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 1px 8px rgba(127, 119, 221, 0.06)',
      }}
    >
      <div
        className="text-xl font-bold"
        style={{ fontFamily: '"Baloo 2", cursive', color: 'var(--color-primary-dark)' }}
      >
        {t.appName}
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={onLangToggle}
          className="px-3 py-1 rounded-full text-xs font-bold transition-colors"
          style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}
          aria-label="Switch language"
        >
          {t.langToggle}
        </button>

        {/* Streak badge */}
        {streak && streak.count > 0 && (
          <div
            className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold"
            style={{ backgroundColor: 'var(--color-warm-light)', color: 'var(--color-warm)' }}
            aria-label={t.streakBadge(streak.count)}
          >
            {t.streakBadge(streak.count)}
          </div>
        )}

        {/* Quiz button */}
        {canStartQuiz && (
          <button
            onClick={onStartQuiz}
            className="px-3 py-1 rounded-full text-xs font-bold transition-colors"
            style={{ backgroundColor: 'var(--color-warm-light)', color: 'var(--color-warm)' }}
            aria-label={t.startQuiz}
          >
            🎯
          </button>
        )}

        {/* Deck button */}
        <button
          onClick={onShowDeck}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-opacity hover:opacity-75"
          style={{ backgroundColor: 'var(--color-primary-light)' }}
          aria-label={t.viewDeck}
        >
          🐼
        </button>
      </div>
    </header>
  );
}
