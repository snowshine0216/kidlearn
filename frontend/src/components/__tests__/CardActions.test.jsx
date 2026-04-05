import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardActions from '../CardActions';
import { getStrings } from '../../lib/i18n';

vi.mock('../../lib/speech', () => ({
  speak: vi.fn(),
  speechSupported: true,
}));

import { speak } from '../../lib/speech';

const t = getStrings('en');

const mockCard = {
  id: 'card-1',
  word: 'butterfly',
  pinyin: 'hú dié',
  chinese: '蝴蝶',
  emoji: '🦋',
  color_theme: 'purple',
  subject: 'english',
};

describe('CardActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when card is null', () => {
    const { container } = render(<CardActions t={t} card={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Hear button when card is present', () => {
    render(<CardActions t={t} card={mockCard} />);
    expect(screen.getByLabelText(t.hearIt)).toBeTruthy();
  });

  it('does not render a save button (cards are auto-saved on generation)', () => {
    const { container } = render(<CardActions t={t} card={mockCard} />);
    expect(container.querySelector(`[aria-label="${t.saveToDeck}"]`)).toBeNull();
    expect(container.querySelector(`[aria-label="${t.saved}"]`)).toBeNull();
  });

  it('clicking Hear calls speak with word and "en"', () => {
    render(<CardActions t={t} card={mockCard} />);
    fireEvent.click(screen.getByLabelText(t.hearIt));
    expect(speak).toHaveBeenCalledWith('butterfly', 'en');
  });

  it('Print button has hidden md:flex class (hidden on mobile)', () => {
    const { container } = render(<CardActions t={t} card={mockCard} />);
    const printBtn = container.querySelector(`[aria-label="${t.print}"]`);
    expect(printBtn).not.toBeNull();
    expect(printBtn.className).toContain('hidden');
    expect(printBtn.className).toContain('md:flex');
  });
});
