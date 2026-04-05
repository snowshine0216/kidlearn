export default function MascotMessage({ message }) {
  if (!message) return null;

  return (
    <div
      className="mascot-msg flex items-start gap-3 rounded-2xl py-3 px-4"
      style={{ backgroundColor: 'var(--color-warm-light)', border: '1px solid var(--color-warm)' }}
    >
      <span style={{ fontSize: 28 }} role="img" aria-label="panda mascot">🐼</span>
      <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--color-text)' }}>
        {message}
      </p>
    </div>
  );
}
