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
    const { container } = render(<CardActions t={t} card={null} onSave={vi.fn()} isSaved={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Save and Hear buttons when card is present', () => {
    render(<CardActions t={t} card={mockCard} onSave={vi.fn()} isSaved={false} />);
    expect(screen.getByLabelText(t.saveToDeck)).toBeTruthy();
    expect(screen.getByLabelText(t.hearIt)).toBeTruthy();
  });

  it('Save button shows saveToDeck label when not saved', () => {
    render(<CardActions t={t} card={mockCard} onSave={vi.fn()} isSaved={false} />);
    expect(screen.getByLabelText(t.saveToDeck)).toBeTruthy();
  });

  it('Save button shows saved label and is disabled when isSaved=true', () => {
    render(<CardActions t={t} card={mockCard} onSave={vi.fn()} isSaved={true} />);
    const btn = screen.getByLabelText(t.saved);
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('clicking Save calls onSave with the card', () => {
    const onSave = vi.fn(() => true);
    render(<CardActions t={t} card={mockCard} onSave={onSave} isSaved={false} />);
    fireEvent.click(screen.getByLabelText(t.saveToDeck));
    expect(onSave).toHaveBeenCalledWith(mockCard);
  });

  it('clicking Save does NOT call onSave when already saved', () => {
    const onSave = vi.fn();
    render(<CardActions t={t} card={mockCard} onSave={onSave} isSaved={true} />);
    fireEvent.click(screen.getByLabelText(t.saved));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clicking Hear calls speak with word and "en"', () => {
    render(<CardActions t={t} card={mockCard} onSave={vi.fn()} isSaved={false} />);
    fireEvent.click(screen.getByLabelText(t.hearIt));
    expect(speak).toHaveBeenCalledWith('butterfly', 'en');
  });

  it('Print button has hidden md:flex class (hidden on mobile)', () => {
    const { container } = render(
      <CardActions t={t} card={mockCard} onSave={vi.fn()} isSaved={false} />
    );
    const printBtn = container.querySelector(`[aria-label="${t.print}"]`);
    expect(printBtn).not.toBeNull();
    expect(printBtn.className).toContain('hidden');
    expect(printBtn.className).toContain('md:flex');
  });
});
