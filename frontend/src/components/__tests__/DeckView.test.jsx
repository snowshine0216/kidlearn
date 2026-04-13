import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeckView from '../DeckView';
import { getStrings } from '../../lib/i18n';

const t = getStrings('en');

// jsdom doesn't implement createObjectURL — stub it
beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
  global.URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  delete global.URL.createObjectURL;
  delete global.URL.revokeObjectURL;
});

afterEach(() => {
  vi.clearAllMocks();
});

const makeCard = (overrides = {}) => ({
  id: `card-${Math.random()}`,
  word: 'butterfly',
  chinese: '蝴蝶',
  emoji: '🦋',
  color_theme: 'purple',
  subject: 'english',
  savedAt: Date.now(),
  ...overrides,
});

describe('DeckView — empty state', () => {
  it('renders empty state message when deck is empty', () => {
    render(<DeckView t={t} deck={[]} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(t.deckEmpty)).toBeTruthy();
  });

  it('close button in empty state calls onClose', () => {
    const onClose = vi.fn();
    render(<DeckView t={t} deck={[]} onDelete={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(t.close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DeckView — with cards', () => {
  const englishCard = makeCard({ id: 'en-1', word: 'butterfly', subject: 'english' });
  const chineseCard = makeCard({ id: 'zh-1', word: '苹果', chinese: '苹果', subject: 'chinese' });
  const mathCard = makeCard({ id: 'math-1', word: 'count', chinese: '', subject: 'math' });
  const deck = [englishCard, chineseCard, mathCard];

  it('renders card count in header', () => {
    render(<DeckView t={t} deck={deck} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(t.deckTitle(3))).toBeTruthy();
  });

  it('renders all cards when filter is "all"', () => {
    render(<DeckView t={t} deck={deck} onDelete={vi.fn()} onClose={vi.fn()} />);
    // 3 delete buttons = 3 cards rendered
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete /i });
    expect(deleteButtons).toHaveLength(3);
    expect(screen.getByText('butterfly')).toBeTruthy();
    expect(screen.getByText('count')).toBeTruthy();
    // '苹果' is both word and chinese on that card, so use getAllByText
    expect(screen.getAllByText('苹果').length).toBeGreaterThanOrEqual(1);
  });

  it('filters to English cards only', () => {
    render(<DeckView t={t} deck={deck} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(t.filterLabels.english));
    expect(screen.getByText('butterfly')).toBeTruthy();
    expect(screen.queryByText('count')).toBeNull();
  });

  it('shows filterEmpty message when active filter has no matches', () => {
    const englishOnly = [englishCard];
    render(<DeckView t={t} deck={englishOnly} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(t.filterLabels.chinese));
    expect(screen.getByText(t.filterEmpty(t.filterLabels.chinese))).toBeTruthy();
  });

  it('clicking ✕ on a card reveals confirm/cancel buttons', () => {
    render(<DeckView t={t} deck={[englishCard]} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(`${t.confirmDelete} ${englishCard.word}`));
    expect(screen.getByText(t.confirmDelete)).toBeTruthy();
    expect(screen.getByText(t.cancelDelete)).toBeTruthy();
  });

  it('confirming delete calls onDelete with card id', () => {
    const onDelete = vi.fn();
    render(<DeckView t={t} deck={[englishCard]} onDelete={onDelete} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(`${t.confirmDelete} ${englishCard.word}`));
    fireEvent.click(screen.getByText(t.confirmDelete));
    expect(onDelete).toHaveBeenCalledWith(englishCard.id);
  });

  it('cancelling delete hides confirm row', () => {
    render(<DeckView t={t} deck={[englishCard]} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(`${t.confirmDelete} ${englishCard.word}`));
    fireEvent.click(screen.getByText(t.cancelDelete));
    // confirm button disappears; the ✕ delete trigger reappears
    expect(screen.queryByText(t.cancelDelete)).toBeNull();
    expect(screen.getByLabelText(`${t.confirmDelete} ${englishCard.word}`)).toBeTruthy();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<DeckView t={t} deck={deck} onDelete={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(t.close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('export button triggers URL.createObjectURL', () => {
    render(<DeckView t={t} deck={deck} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(t.exportDeck));
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });
});

describe('DeckView — quiz-disable toggle', () => {
  const card = makeCard({ id: 'en-1', word: 'butterfly', subject: 'english', quizDisabled: false });
  const disabledCard = makeCard({ id: 'en-2', word: 'bee', subject: 'english', quizDisabled: true });

  it('shows quiz-disable button for each card when onToggleQuizDisabled is provided', () => {
    render(<DeckView t={t} deck={[card]} onDelete={vi.fn()} onClose={vi.fn()} onToggleQuizDisabled={vi.fn()} />);
    expect(screen.getByText(t.quizDisable)).toBeTruthy();
  });

  it('shows quizEnable label when card is already disabled', () => {
    render(<DeckView t={t} deck={[disabledCard]} onDelete={vi.fn()} onClose={vi.fn()} onToggleQuizDisabled={vi.fn()} />);
    expect(screen.getByText(t.quizEnable)).toBeTruthy();
  });

  it('clicking the toggle calls onToggleQuizDisabled with card id and current value', () => {
    const onToggle = vi.fn();
    render(<DeckView t={t} deck={[card]} onDelete={vi.fn()} onClose={vi.fn()} onToggleQuizDisabled={onToggle} />);
    fireEvent.click(screen.getByText(t.quizDisable));
    expect(onToggle).toHaveBeenCalledWith(card.id, false);
  });

  it('does not render toggle button when onToggleQuizDisabled is not provided', () => {
    render(<DeckView t={t} deck={[card]} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(t.quizDisable)).toBeNull();
    expect(screen.queryByText(t.quizEnable)).toBeNull();
  });
});
