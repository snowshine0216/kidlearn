import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
