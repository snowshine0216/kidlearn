import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlashCard from '../FlashCard';
import { getStrings } from '../../lib/i18n';

const t = getStrings('en');

// DOMPurify needs a real DOM — jsdom provides it
const mockCard = {
  id: 'test-id',
  emoji: '🦋',
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  sentence: 'The <em>butterfly</em> flew.',
  sentence_zh: '蝴蝶飞了。',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  color_theme: 'purple',
  subject: 'english',
  knewIt: null,
};

describe('FlashCard', () => {
  it('renders card content', () => {
    render(<FlashCard t={t} card={mockCard} isLoading={false} subject="english" />);
    // word appears both in .card-word and as <em> in sentence — use getAllByText
    expect(screen.getAllByText('butterfly').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('蝴蝶')).toBeTruthy();
    expect(screen.getByText('hú dié')).toBeTruthy();
  });

  it('shows shimmer skeleton when isLoading', () => {
    const { container } = render(<FlashCard t={t} card={null} isLoading={true} subject="english" />);
    expect(container.querySelector('.card-loading')).toBeTruthy();
  });

  it('shows empty state when no card and not loading', () => {
    render(<FlashCard t={t} card={null} isLoading={false} subject="english" />);
    expect(screen.getByText(/generate your first card/i)).toBeTruthy();
  });

  it('strips XSS from sentence via DOMPurify', () => {
    const xssCard = { ...mockCard, sentence: '<script>alert("xss")</script>Safe text' };
    render(<FlashCard t={t} card={xssCard} isLoading={false} subject="english" />);
    // script tag should be stripped — DOMPurify removes it
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows self-report buttons', () => {
    render(<FlashCard t={t} card={mockCard} isLoading={false} subject="english" />);
    expect(screen.getByLabelText(t.iKnowIt)).toBeTruthy();
    expect(screen.getByLabelText(t.notYet)).toBeTruthy();
  });

  it('shows 汉字 prominently for Chinese subject cards', () => {
    const chineseCard = { ...mockCard, subject: 'chinese' };
    const { container } = render(
      <FlashCard t={t} card={chineseCard} isLoading={false} subject="chinese" />
    );
    // 蝴蝶 should be in .card-chinese (large font), English word 'butterfly' should be in small text
    const chineseEl = container.querySelector('.card-chinese');
    expect(chineseEl).not.toBeNull();
    expect(chineseEl.textContent).toContain('蝴蝶');
    // English word appears, but NOT in .card-word (that class should be absent for Chinese subject)
    expect(container.querySelector('.card-word')).toBeNull();
  });
});
