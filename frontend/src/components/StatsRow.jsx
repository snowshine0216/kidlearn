export default function StatsRow({ t, count, dueCount = 0, onDueClick }) {
  const dueLabel = t.dueForReview(dueCount);
  const DueChip = onDueClick ? 'button' : 'div';
  return (
    <div className="stats-row flex justify-center gap-2 flex-wrap">
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold"
        style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}
      >
        {count === 0
          ? <span style={{ color: 'var(--color-muted)' }}>{t.noCardsYet}</span>
          : t.cardCount(count)
        }
      </div>
      {dueLabel && (
        <DueChip
          type={onDueClick ? 'button' : undefined}
          onClick={onDueClick}
          aria-label={onDueClick ? dueLabel : undefined}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-2xl text-sm font-semibold"
          style={{
            backgroundColor: 'var(--color-coral-light)',
            color: 'var(--color-coral)',
            cursor: onDueClick ? 'pointer' : undefined,
            border: onDueClick ? 'none' : undefined,
          }}
        >
          <span aria-hidden="true">🔔</span> {dueLabel}
        </DueChip>
      )}
    </div>
  );
}
