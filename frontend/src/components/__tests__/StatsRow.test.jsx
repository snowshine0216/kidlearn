import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatsRow from '../StatsRow';
import { getStrings } from '../../lib/i18n';

const t = getStrings('en');

describe('StatsRow', () => {
  it('renders noCardsYet message when count is 0', () => {
    render(<StatsRow t={t} count={0} />);
    expect(screen.getByText(t.noCardsYet)).toBeTruthy();
  });

  it('renders cardCount string when count is 1', () => {
    render(<StatsRow t={t} count={1} />);
    expect(screen.getByText(t.cardCount(1))).toBeTruthy();
  });

  it('renders cardCount string when count is 5', () => {
    render(<StatsRow t={t} count={5} />);
    expect(screen.getByText(t.cardCount(5))).toBeTruthy();
  });

  it('does not show noCardsYet when count > 0', () => {
    render(<StatsRow t={t} count={2} />);
    expect(screen.queryByText(t.noCardsYet)).toBeNull();
  });

  it('shows dueForReview badge when dueCount > 0', () => {
    render(<StatsRow t={t} count={5} dueCount={3} />);
    expect(screen.getByText(t.dueForReview(3), { exact: false })).toBeTruthy();
  });

  it('does not show dueForReview badge when dueCount is 0', () => {
    render(<StatsRow t={t} count={5} dueCount={0} />);
    expect(screen.queryByText(t.dueForReview(3))).toBeNull();
  });

  it('does not show dueForReview badge when dueCount is undefined', () => {
    render(<StatsRow t={t} count={5} />);
    // dueForReview(0) returns '' so nothing rendered
    expect(screen.queryByText(/due for review/i)).toBeNull();
  });

  it('calls onDueClick when due chip is clicked', () => {
    const onDueClick = vi.fn();
    render(<StatsRow t={t} count={10} dueCount={3} onDueClick={onDueClick} />);
    fireEvent.click(screen.getByRole('button', { name: /3/i }));
    expect(onDueClick).toHaveBeenCalledOnce();
  });

  it('due chip has no button role when onDueClick is not provided', () => {
    render(<StatsRow t={t} count={10} dueCount={3} />);
    expect(screen.queryByRole('button', { name: /3/i })).toBeNull();
  });
});
