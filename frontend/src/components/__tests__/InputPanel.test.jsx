import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputPanel from '../InputPanel';
import { getStrings } from '../../lib/i18n';

vi.mock('../../lib/claudeApi', () => ({
  generateCard: vi.fn(),
}));

import { generateCard } from '../../lib/claudeApi';

const t = getStrings('en');

const mockCard = {
  word: 'butterfly',
  emoji: '🦋',
  color_theme: 'purple',
};

describe('InputPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 3 subject tabs', () => {
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    expect(screen.getByLabelText(t.subjects.english)).toBeTruthy();
    expect(screen.getByLabelText(t.subjects.chinese)).toBeTruthy();
    expect(screen.getByLabelText(t.subjects.math)).toBeTruthy();
  });

  it('Generate button is disabled when input is empty', () => {
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    const btn = screen.getByLabelText(t.generate);
    expect(btn.disabled).toBe(true);
  });

  it('Generate button is enabled after typing a word', async () => {
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    const input = screen.getByLabelText(t.placeholders.english);
    await userEvent.type(input, 'butterfly');
    expect(screen.getByLabelText(t.generate).disabled).toBe(false);
  });

  it('clicking Generate calls generateCard with word and subject', async () => {
    generateCard.mockResolvedValueOnce(mockCard);
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    const input = screen.getByLabelText(t.placeholders.english);
    await userEvent.type(input, 'butterfly');
    fireEvent.click(screen.getByLabelText(t.generate));
    await waitFor(() => expect(generateCard).toHaveBeenCalledWith('butterfly', 'english'));
  });

  it('pressing Enter triggers generateCard', async () => {
    generateCard.mockResolvedValueOnce(mockCard);
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    const input = screen.getByLabelText(t.placeholders.english);
    await userEvent.type(input, 'butterfly{Enter}');
    await waitFor(() => expect(generateCard).toHaveBeenCalledWith('butterfly', 'english'));
  });

  it('calls onCardGenerated with card+subject on success', async () => {
    generateCard.mockResolvedValueOnce(mockCard);
    const onCardGenerated = vi.fn();
    render(<InputPanel t={t} onCardGenerated={onCardGenerated} onLoading={vi.fn()} />);
    const input = screen.getByLabelText(t.placeholders.english);
    await userEvent.type(input, 'butterfly');
    fireEvent.click(screen.getByLabelText(t.generate));
    await waitFor(() =>
      expect(onCardGenerated).toHaveBeenCalledWith({ ...mockCard, subject: 'english' })
    );
  });

  it('shows error message when generateCard throws', async () => {
    generateCard.mockRejectedValueOnce(new Error('API failed'));
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    const input = screen.getByLabelText(t.placeholders.english);
    await userEvent.type(input, 'butterfly');
    fireEvent.click(screen.getByLabelText(t.generate));
    await waitFor(() => expect(screen.getByText('API failed')).toBeTruthy());
  });

  it('clicking Chinese tab switches subject placeholder', async () => {
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(t.subjects.chinese));
    expect(screen.getByLabelText(t.placeholders.chinese)).toBeTruthy();
  });

  it('switching subject clears the word input', async () => {
    render(<InputPanel t={t} onCardGenerated={vi.fn()} onLoading={vi.fn()} />);
    const input = screen.getByLabelText(t.placeholders.english);
    await userEvent.type(input, 'hello');
    fireEvent.click(screen.getByLabelText(t.subjects.chinese));
    // After switch, the chinese placeholder input should be empty
    const chineseInput = screen.getByLabelText(t.placeholders.chinese);
    expect(chineseInput.value).toBe('');
  });
});
