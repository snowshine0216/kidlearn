import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '../TopBar';
import { getStrings } from '../../lib/i18n';

const t = getStrings('en');

describe('TopBar', () => {
  it('renders app name', () => {
    render(<TopBar t={t} streak={{ count: 0 }} onShowDeck={vi.fn()} onLangToggle={vi.fn()} />);
    expect(screen.getByText(t.appName)).toBeTruthy();
  });

  it('renders language toggle button', () => {
    render(<TopBar t={t} streak={{ count: 0 }} onShowDeck={vi.fn()} onLangToggle={vi.fn()} />);
    expect(screen.getByText(t.langToggle)).toBeTruthy();
  });

  it('calls onLangToggle when lang button is clicked', () => {
    const onLangToggle = vi.fn();
    render(<TopBar t={t} streak={{ count: 0 }} onShowDeck={vi.fn()} onLangToggle={onLangToggle} />);
    fireEvent.click(screen.getByText(t.langToggle));
    expect(onLangToggle).toHaveBeenCalledTimes(1);
  });

  it('renders streak badge when streak count > 0', () => {
    render(<TopBar t={t} streak={{ count: 3 }} onShowDeck={vi.fn()} onLangToggle={vi.fn()} />);
    expect(screen.getByText(t.streakBadge(3))).toBeTruthy();
  });

  it('does not render streak badge when streak count is 0', () => {
    render(<TopBar t={t} streak={{ count: 0 }} onShowDeck={vi.fn()} onLangToggle={vi.fn()} />);
    expect(screen.queryByText(t.streakBadge(0))).toBeNull();
  });

  it('does not render streak badge when streak is null', () => {
    render(<TopBar t={t} streak={null} onShowDeck={vi.fn()} onLangToggle={vi.fn()} />);
    // No streak element — just check it doesn't crash
    expect(screen.getByText(t.appName)).toBeTruthy();
  });

  it('calls onShowDeck when deck button is clicked', () => {
    const onShowDeck = vi.fn();
    render(<TopBar t={t} streak={{ count: 0 }} onShowDeck={onShowDeck} onLangToggle={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(t.viewDeck));
    expect(onShowDeck).toHaveBeenCalledTimes(1);
  });
});
