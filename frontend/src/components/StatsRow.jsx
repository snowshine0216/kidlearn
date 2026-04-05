export default function StatsRow({ t, count }) {
  return (
    <div className="stats-row flex justify-center">
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold"
        style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}
      >
        {count === 0
          ? <span style={{ color: 'var(--color-muted)' }}>{t.noCardsYet}</span>
          : t.cardCount(count)
        }
      </div>
    </div>
  );
}
