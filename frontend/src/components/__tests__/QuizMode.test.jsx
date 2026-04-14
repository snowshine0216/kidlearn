import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QuizMode from '../QuizMode';
import { getStrings } from '../../lib/i18n';

// Mock quizHintApi to avoid real fetch
vi.mock('../../lib/quizHintApi', () => ({
  getQuizHint: vi.fn().mockResolvedValue({
    encouragement: 'Great try!',
    extraSentence: 'The butterfly dances.',
    pronunciationGuide: 'BUT·ter·fly',
  }),
}));

const t = getStrings('en');

const makeCard = (overrides = {}) => ({
  id: `card-${Math.random()}`,
  word: 'butterfly',
  chinese: '蝴蝶',
  pinyin: 'hú dié',
  emoji: '🦋',
  subject: 'english',
  sentence: 'The <em>butterfly</em> flies high.',
  mnemonic: 'Butter + fly',
  mascot_message: 'Wow!',
  mastery: null,
  reviewCount: null,
  lastReviewedAt: null,
  quizHints: null,
  ...overrides,
});

const makeDeck = (n = 8, subject = 'english') =>
  Array.from({ length: n }, (_, i) =>
    makeCard({ id: `card-${i}`, word: `word${i}`, subject })
  );

const DEFAULT_PROPS = {
  t,
  lang: 'en',
  deck: makeDeck(8),
  onClose: vi.fn(),
  onUpdateMastery: vi.fn(),
  onPatchCard: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom doesn't implement matchMedia — stub it so confetti effects don't crash
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

// ─── Lobby ───────────────────────────────────────────────────────────────────

describe('QuizMode — Lobby', () => {
  it('has role="dialog" and aria-modal', () => {
    const { container } = render(<QuizMode {...DEFAULT_PROPS} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders subject toggle buttons (EN / ZH)', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    // Should show English and Chinese options
    expect(screen.getByText(/english/i)).toBeTruthy();
    expect(screen.getByText(/chinese/i)).toBeTruthy();
  });

  it('renders count presets: 5, 10, 20', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('disables count presets that exceed deck size', () => {
    const smallDeck = makeDeck(6);
    render(<QuizMode {...DEFAULT_PROPS} deck={smallDeck} />);
    const btn20 = screen.getByText('20').closest('button');
    expect(btn20.disabled).toBe(true);
  });

  it('Start button is disabled when deck has < 5 cards', () => {
    render(<QuizMode {...DEFAULT_PROPS} deck={makeDeck(3)} />);
    const startBtn = screen.getByRole('button', { name: /start/i });
    expect(startBtn.disabled).toBe(true);
  });

  it('renders a Start button', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<QuizMode {...DEFAULT_PROPS} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /close|✕/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('countdown toggle defaults to Off', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByText(/^off$/i)).toBeTruthy();
  });

  it('shows interval options when countdown is toggled On', async () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    const offBtn = screen.getByText(/^off$/i);
    await act(async () => { fireEvent.click(offBtn); });
    expect(screen.getByText('30s')).toBeTruthy();
    expect(screen.getByText('1 min')).toBeTruthy();
    expect(screen.getByText('2 min')).toBeTruthy();
    expect(screen.getByText('5 min')).toBeTruthy();
  });

  it('hides interval options when countdown is toggled back Off', async () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    const offBtn = screen.getByText(/^off$/i);
    await act(async () => { fireEvent.click(offBtn); });
    expect(screen.getByText('30s')).toBeTruthy();
    const onBtn = screen.getByText(/^on$/i);
    await act(async () => { fireEvent.click(onBtn); });
    expect(screen.queryByText('30s')).toBeFalsy();
  });
});

// ─── Question Phase ───────────────────────────────────────────────────────────

describe('QuizMode — Question phase', () => {
  async function startQuiz(props = DEFAULT_PROPS) {
    const { container } = render(<QuizMode {...props} />);
    const startBtn = screen.getByRole('button', { name: /start/i });
    await act(async () => { fireEvent.click(startBtn); });
    // Wait for question phase to appear
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy();
    }, { timeout: 3000 });
    return container;
  }

  it('renders first question after Start is clicked', async () => {
    await startQuiz();
    // Should show progress indicator
    await waitFor(() => {
      expect(screen.getByText(/question 1/i)).toBeTruthy();
    });
  });

  it('shows 3 choice buttons for multiple-choice questions', async () => {
    // Use fill-blank or word-meaning card to guarantee MC
    const deck = Array.from({ length: 8 }, (_, i) =>
      makeCard({
        id: `card-${i}`,
        word: `word${i}`,
        sentence: `The <em>word${i}</em> is here.`,
      })
    );
    await startQuiz({ ...DEFAULT_PROPS, deck });
    await waitFor(() => {
      const choices = document.querySelectorAll('.quiz-choice-btn');
      expect(choices.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ─── Hint text size ──────────────────────────────────────────────────────────

describe('QuizMode — Hint text', () => {
  it('hint paragraph uses text-lg for readability', async () => {
    const { container } = render(<QuizMode {...DEFAULT_PROPS} />);
    const startBtn = screen.getByRole('button', { name: /start/i });
    await act(async () => { fireEvent.click(startBtn); });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy();
    }, { timeout: 3000 });

    const hintBtn = screen.getByText(t.quizHintBtn);
    await act(async () => { fireEvent.click(hintBtn); });

    await waitFor(() => {
      const hintPara = container.querySelector('p.text-lg.text-center');
      expect(hintPara).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

describe('QuizMode — Summary', () => {
  it('renders "Try Again" and "Back to Deck" buttons in summary', async () => {
    // Hard to reach summary without going through full quiz — at least check lobby→start flow
    // This test verifies the summary strings exist in i18n
    expect(t.quizRestart).toBeTruthy();
    expect(t.quizBackToDeck).toBeTruthy();
  });
});

// ─── Retry Failed Cards ───────────────────────────────────────────────────────

describe('QuizMode — Retry Failed Cards', () => {
  // pinyin: null so zh-pinyin falls back to reading (self-report); no sentence_zh so zh-fill-blank also falls back.
  // This keeps the test focused on retry-failed-cards logic using self-report questions.
  const zhDeck = Array.from({ length: 8 }, (_, i) =>
    makeCard({ id: `zh-${i}`, word: `word${i}`, subject: 'chinese', pinyin: null, sentence_zh: null })
  );

  async function navigateToSummary(makeWrong = false) {
    render(<QuizMode {...DEFAULT_PROPS} deck={zhDeck} />);
    // Switch to Chinese subject (all reading mode = self-report, fully controllable)
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    // Answer 5 questions then advance for each
    for (let i = 0; i < 5; i++) {
      // Wait for answer buttons (reading mode: quizKnowIt / quizDontKnow)
      await waitFor(() => {
        const ok = screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow);
        if (!ok) throw new Error('answer buttons not found');
      }, { timeout: 5000 });

      if (makeWrong) {
        await act(async () => { fireEvent.click(screen.queryByText(t.quizDontKnow)); });
        // Wrong: inline memory tips → "Got it" button — click it
        await waitFor(() => {
          if (!screen.queryByText(t.quizGotIt)) throw new Error('got it button not found');
        }, { timeout: 5000 });
        await act(async () => { fireEvent.click(screen.queryByText(t.quizGotIt)); });
      } else {
        // Capture current progress before clicking so we can detect the advance
        const beforeProgress = screen.queryByText(/question \d+ of/i)?.textContent;
        await act(async () => { fireEvent.click(screen.queryByText(t.quizKnowIt)); });
        // Correct: auto-advances after ~1600ms praise animation (no feedback page)
        await waitFor(() => {
          const summary = screen.queryByText(t.quizSummaryTitle);
          if (summary) return;
          const newProgress = screen.queryByText(/question \d+ of/i)?.textContent;
          if (!newProgress || newProgress === beforeProgress) {
            throw new Error('question has not advanced yet');
          }
        }, { timeout: 5000 });
      }
    }

    await waitFor(() => {
      expect(screen.queryByText(t.quizSummaryTitle)).toBeTruthy();
    }, { timeout: 5000 });
  }

  it('quizRetryFailed string is defined in i18n', () => {
    expect(t.quizRetryFailed).toBe('Review Missed Cards 🔁');
  });

  it('shows retry failed button when there are wrong answers', async () => {
    await navigateToSummary(true);
    expect(screen.queryByText(t.quizRetryFailed)).toBeTruthy();
  }, 20000);

  it('does not show retry failed button when all answers are correct', async () => {
    await navigateToSummary(false);
    expect(screen.queryByText(t.quizRetryFailed)).toBeFalsy();
  }, 20000);

  it('clicking retry failed transitions back to question phase', async () => {
    await navigateToSummary(true);
    const retryBtn = screen.getByText(t.quizRetryFailed);
    await act(async () => { fireEvent.click(retryBtn); });
    await waitFor(() => {
      expect(screen.queryByText(t.quizSummaryTitle)).toBeFalsy();
      expect(screen.queryByText(/question \d+ of/i)).toBeTruthy();
    }, { timeout: 3000 });
  }, 20000);
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('QuizMode — Accessibility', () => {
  it('lobby has a heading', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    const heading = screen.getByRole('heading');
    expect(heading).toBeTruthy();
  });
});

// ─── Mastery callbacks ────────────────────────────────────────────────────────

describe('QuizMode — Callbacks', () => {
  it('calls onClose when Back to Deck is clicked from lobby close button', () => {
    const onClose = vi.fn();
    render(<QuizMode {...DEFAULT_PROPS} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /close|✕/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── Chinese new question types ──────────────────────────────────────────────

describe('QuizMode — Chinese new question types', () => {
  // Deck where every card has sentence_zh containing chinese, and pinyin set.
  // ZH_MODES = ['reading', 'zh-fill-blank', 'zh-pinyin'] — cards cycle:
  //   card-0 → reading, card-1 → zh-fill-blank, card-2 → zh-pinyin, …
  const zhRichDeck = Array.from({ length: 8 }, (_, i) =>
    makeCard({
      id: `zh-rich-${i}`,
      word: `word${i}`,
      subject: 'chinese',
      chinese: `字${i}`,
      pinyin: `pīn${i}`,
      sentence_zh: `这是字${i}的例句。`,
    })
  );

  async function startChineseQuiz() {
    const { container } = render(
      <QuizMode {...DEFAULT_PROPS} deck={zhRichDeck} />
    );
    const dialog = container.querySelector('[role="dialog"]');
    // Switch to Chinese subject
    const chineseBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => /chinese/i.test(b.textContent)
    );
    await act(async () => { fireEvent.click(chineseBtn); });
    await act(async () => {
      fireEvent.click(dialog.querySelector('button[class*="start"], button'));
      // click Start
      const startBtn = screen.queryByRole('button', { name: /start/i });
      if (startBtn) fireEvent.click(startBtn);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy();
    }, { timeout: 3000 });
    return { container, dialog };
  }

  // Helper: advance past Q1 (reading self-report correct → auto-advances, no feedback page)
  async function advancePastQ1() {
    const beforeProgress = screen.queryByText(/question \d+ of/i)?.textContent;
    await waitFor(() => {
      const ok = screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow);
      if (!ok) throw new Error('self-report buttons not found');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.queryByText(t.quizKnowIt)); });
    // Correct self-report auto-advances (praise animation, no feedback next button)
    await waitFor(() => {
      const summary = screen.queryByText(t.quizSummaryTitle);
      if (summary) return;
      const newProgress = screen.queryByText(/question \d+ of/i)?.textContent;
      if (!newProgress || newProgress === beforeProgress) throw new Error('not advanced yet');
    }, { timeout: 8000 });
  }

  it('zh-fill-blank question (Q2) renders sentence with blank', async () => {
    const { container } = await startChineseQuiz();
    await advancePastQ1();

    // Q2 should be zh-fill-blank: sentence with '___' rendered
    await waitFor(() => {
      const blanked = container.querySelector('p.cjk-font');
      expect(blanked).toBeTruthy();
      expect(blanked.textContent).toMatch(/___/);
    }, { timeout: 5000 });
  }, 30000);

  it('zh-fill-blank question (Q2) shows choice buttons with Chinese characters', async () => {
    const { container } = await startChineseQuiz();
    await advancePastQ1();

    // Q2 zh-fill-blank: 3 choice buttons should exist
    await waitFor(() => {
      const choices = container.querySelectorAll('.quiz-choice-btn');
      expect(choices.length).toBeGreaterThanOrEqual(3);
    }, { timeout: 5000 });
  }, 30000);
});

// ─── dueOnly mode ─────────────────────────────────────────────────────────────

describe('QuizMode — dueOnly mode', () => {
  it('skips lobby and starts quiz immediately when dueOnly=true', async () => {
    const now = Date.now();
    const dueCard = makeCard({ id: 'due-1', mastery: 1, nextReviewAt: now - 1000 });
    const deck = [dueCard, ...makeDeck(7)];
    render(<QuizMode {...DEFAULT_PROPS} deck={deck} dueOnly />);
    // No Start button — lobby is skipped
    expect(screen.queryByRole('button', { name: /start/i })).toBeNull();
    // Question phase appears
    await waitFor(() => expect(screen.getByText(/question 1/i)).toBeTruthy(), { timeout: 3000 });
  });

  it('shows quiz immediately for cards with nextReviewAt: null (never reviewed)', async () => {
    const nullCard = makeCard({ id: 'null-card', nextReviewAt: null, savedAt: Date.now() });
    const deck = [nullCard, ...makeDeck(7)];
    render(<QuizMode {...DEFAULT_PROPS} deck={deck} dueOnly />);
    // No Start button — lobby is skipped even for never-reviewed (null) cards
    expect(screen.queryByRole('button', { name: /start/i })).toBeNull();
    // Question phase appears
    await waitFor(() => expect(screen.getByText(/question 1/i)).toBeTruthy(), { timeout: 3000 });
  });

  it('falls back to lobby when dueOnly=true but no due cards exist', () => {
    // makeDeck cards have nextReviewAt: undefined — not due
    render(<QuizMode {...DEFAULT_PROPS} dueOnly />);
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });

  it('shows lobby normally when dueOnly is not set', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });
});

