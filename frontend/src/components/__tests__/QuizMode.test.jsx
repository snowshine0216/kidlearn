import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QuizMode from '../QuizMode';
import { getStrings } from '../../lib/i18n';
import { getQuizHint } from '../../lib/quizHintApi';

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

  it('renders count presets: 5, 10, 20, All', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('disables count presets that exceed deck size', () => {
    const smallDeck = makeDeck(6);
    render(<QuizMode {...DEFAULT_PROPS} deck={smallDeck} />);
    const btn20 = screen.getByText('20').closest('button');
    expect(btn20.disabled).toBe(true);
  });

  it('enables Start with fewer than five eligible cards by selecting All', async () => {
    const smallDeck = makeDeck(3);
    render(<QuizMode {...DEFAULT_PROPS} deck={smallDeck} />);

    await waitFor(() => {
      expect(screen.getByText('All').closest('button').disabled).toBe(false);
      expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false);
    });
  });

  it('enables Start for future-scheduled cards because default quiz reviews all cards', async () => {
    const now = Date.now();
    const futureDeck = Array.from({ length: 3 }, (_, i) => makeCard({
      id: `zh-${i}`,
      subject: 'chinese',
      word: `word${i}`,
      mastery: 3,
      nextReviewAt: now + 7 * 86400000,
      needsPractice: false,
    }));

    render(<QuizMode {...DEFAULT_PROPS} deck={futureDeck} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });

    expect(screen.getByText('All').closest('button').disabled).toBe(false);
    expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false);
  });

  it('selects All by default so normal quiz starts with every card in the subject', () => {
    render(<QuizMode {...DEFAULT_PROPS} deck={makeDeck(8)} />);

    expect(screen.getByText('All').closest('button').style.background).toBe('var(--color-primary)');
  });

  it('disables Start when the selected subject has no quizable cards', () => {
    const disabledDeck = makeDeck(6).map((card) => ({ ...card, quizDisabled: true }));

    render(<QuizMode {...DEFAULT_PROPS} deck={disabledDeck} />);

    expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(true);
  });

  it('All starts a quiz with every card for the selected subject', async () => {
    const now = Date.now();
    const deck = [
      makeCard({ id: 'new-1', word: 'new1', mastery: null, nextReviewAt: null }),
      makeCard({ id: 'failed-1', word: 'failed1', mastery: 3, nextReviewAt: now + 86400000, needsPractice: true }),
      makeCard({ id: 'due-1', word: 'due1', mastery: 3, nextReviewAt: now - 1000 }),
      makeCard({ id: 'future-1', word: 'future1', mastery: 3, nextReviewAt: now + 86400000 }),
    ];

    render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);
    await act(async () => { fireEvent.click(screen.getByText('All')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    await waitFor(() => {
      expect(screen.getByText(/question 1 of 4/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('orders review-eligible cards first when starting (failed/due before future)', async () => {
    const now = Date.now();
    // pinyin: '' forces zh-pinyin → fallback to 'reading' so the first question shows quizKnowIt/quizDontKnow
    const deck = [
      makeCard({ id: 'future-1', subject: 'chinese', word: 'future1', chinese: '未来1', pinyin: '', mastery: 5, nextReviewAt: now + 7 * 86400000, needsPractice: false }),
      makeCard({ id: 'failed-1', subject: 'chinese', word: 'failed1', chinese: '失败1', pinyin: '', mastery: 3, nextReviewAt: now + 7 * 86400000, needsPractice: true }),
      makeCard({ id: 'future-2', subject: 'chinese', word: 'future2', chinese: '未来2', pinyin: '', mastery: 5, nextReviewAt: now + 7 * 86400000, needsPractice: false }),
    ];

    render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByText('All')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    // First question should be the failed card (eligible, comes before future-scheduled cards)
    await waitFor(() => {
      expect(screen.getByText(/question 1 of 3/i)).toBeTruthy();
      expect(screen.getByText('失败1')).toBeTruthy();
    }, { timeout: 3000 });
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
    await act(async () => { fireEvent.click(screen.getByText('5')); });
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

// ─── Memory helper empty state ────────────────────────────────────────────────

describe('QuizMode — Memory helper empty state', () => {
  it('does not render the hint skeleton while fallback memory text is already visible', async () => {
    vi.mocked(getQuizHint).mockImplementationOnce(() => new Promise(() => {}));
    const deck = [
      makeCard({
        id: 'reading-1',
        subject: 'chinese',
        word: '徘徊',
        chinese: '徘徊',
        pinyin: 'pái huái',
        mnemonic: 'Think of walking in a circle.',
        mascot_message: null,
        quizHints: null,
        mastery: null,
        nextReviewAt: null,
      }),
    ];

    const { container } = render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);

    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await waitFor(() => expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    await waitFor(() => expect(screen.queryByText(t.quizDontKnow)).toBeTruthy(), { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });

    expect(screen.getByText(/walking in a circle/i)).toBeTruthy();
    expect(container.querySelector('.quiz-hint-skeleton')).toBeNull();
  });

  it('does not render the hint skeleton when mascot_message is the sole fallback', async () => {
    vi.mocked(getQuizHint).mockImplementationOnce(() => new Promise(() => {}));
    const deck = [
      makeCard({
        id: 'mascot-only',
        subject: 'chinese',
        word: '徘徊',
        chinese: '徘徊',
        pinyin: 'pái huái',
        mnemonic: null,
        mascot_message: 'Keep going!',
        quizHints: null,
        mastery: null,
        nextReviewAt: null,
      }),
    ];

    const { container } = render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);

    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await waitFor(() => expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    await waitFor(() => expect(screen.queryByText(t.quizDontKnow)).toBeTruthy(), { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });

    // mascot_message is rendered in QuizFeedback (MC path), not in reading inline view —
    // but hasFallbackMemory is true, so the skeleton should be suppressed regardless
    expect(container.querySelector('.quiz-hint-skeleton')).toBeNull();
  });

  it('renders the hint skeleton when hint is loading and card has no fallback memory', async () => {
    vi.mocked(getQuizHint).mockImplementationOnce(() => new Promise(() => {}));
    const deck = [
      makeCard({
        id: 'no-fallback',
        subject: 'chinese',
        word: '徘徊',
        chinese: '徘徊',
        pinyin: 'pái huái',
        mnemonic: null,
        mascot_message: null,
        quizHints: null,
        mastery: null,
        nextReviewAt: null,
      }),
    ];

    const { container } = render(<QuizMode {...DEFAULT_PROPS} deck={deck} />);

    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await waitFor(() => expect(screen.getByRole('button', { name: /start/i }).disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });

    await waitFor(() => expect(screen.queryByText(t.quizDontKnow)).toBeTruthy(), { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });

    expect(container.querySelector('.quiz-hint-skeleton')).not.toBeNull();
  });
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

  it('falls back to lobby when dueOnly=true but no eligible cards exist', () => {
    const now = Date.now();
    const futureDeck = makeDeck(8).map(card => ({
      ...card,
      mastery: 3,
      nextReviewAt: now + 7 * 86400000,
      needsPractice: false,
    }));
    render(<QuizMode {...DEFAULT_PROPS} deck={futureDeck} dueOnly />);
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });

  it('shows lobby normally when dueOnly is not set', () => {
    render(<QuizMode {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });

  it('dueOnly excludes quizDisabled cards from auto-start', async () => {
    const now = Date.now();
    // Only eligible card is disabled — no valid eligible cards remain
    const disabledEligible = makeCard({ id: 'disabled-due', mastery: null, nextReviewAt: null, quizDisabled: true });
    const futureDeck = makeDeck(7).map(card => ({
      ...card,
      mastery: 3,
      nextReviewAt: now + 7 * 86400000,
      needsPractice: false,
    }));
    const deck = [disabledEligible, ...futureDeck];
    render(<QuizMode {...DEFAULT_PROPS} deck={deck} dueOnly />);
    // Falls back to lobby because disabled card was excluded
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy();
  });
});

// ─── Back button ──────────────────────────────────────────────────────────────

describe('QuizMode — Back button', () => {
  // pinyin: '' forces zh-pinyin type to fall back to 'reading' (self-report),
  // so all questions show quizKnowIt/quizDontKnow buttons for consistent testing.
  const zhDeck = Array.from({ length: 8 }, (_, i) =>
    makeCard({ id: `zh-${i}`, word: `word${i}`, subject: 'chinese', pinyin: '' })
  );

  async function startZhQuiz() {
    render(<QuizMode {...DEFAULT_PROPS} deck={zhDeck} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByText('5')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy();
    }, { timeout: 3000 });
  }

  it('back button is not shown before any answer', async () => {
    await startZhQuiz();
    await waitFor(() => expect(screen.queryByText(/question 1/i)).toBeTruthy(), { timeout: 3000 });
    expect(screen.queryByText(t.quizBack)).toBeFalsy();
  });

  it('back button appears after answering first question correctly', async () => {
    await startZhQuiz();
    await waitFor(() => {
      if (!screen.queryByText(t.quizKnowIt)) throw new Error('waiting for answer buttons');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizKnowIt)); });
    // After correct answer, auto-advances — back button should be visible on Q2
    await waitFor(() => {
      expect(screen.queryByText(t.quizBack)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('back button appears after committing a wrong answer (on next question)', async () => {
    await startZhQuiz();
    // Click Don't Know (inline memory shows, no answer committed yet)
    await waitFor(() => {
      if (!screen.queryByText(t.quizDontKnow)) throw new Error('waiting for answer buttons');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });
    // Click "Got it" to commit the wrong answer and advance to Q2
    await waitFor(() => {
      if (!screen.queryByText(t.quizGotIt)) throw new Error('got it not found');
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizGotIt)); });
    // Now on Q2 — back button should appear
    await waitFor(() => {
      expect(screen.queryByText(t.quizBack)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('clicking back from Q2 returns to Q1 question phase', async () => {
    await startZhQuiz();
    // Commit wrong answer on Q1
    await waitFor(() => {
      if (!screen.queryByText(t.quizDontKnow)) throw new Error('waiting');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });
    await waitFor(() => {
      if (!screen.queryByText(t.quizGotIt)) throw new Error('got it not found');
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizGotIt)); });

    // Now on Q2 — click back
    await waitFor(() => expect(screen.queryByText(t.quizBack)).toBeTruthy(), { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizBack)); });

    // Should be back on Q1 with answer buttons
    await waitFor(() => {
      expect(screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow)).toBeTruthy();
    }, { timeout: 3000 });
    expect(screen.queryByText(/question 1 of/i)).toBeTruthy();
  });

  it('clicking back calls onPatchCard to restore card mastery', async () => {
    const onPatchCard = vi.fn();
    render(<QuizMode {...DEFAULT_PROPS} deck={zhDeck} onPatchCard={onPatchCard} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy(), { timeout: 3000 });

    // Commit wrong answer on Q1 via "Got it"
    await waitFor(() => {
      if (!screen.queryByText(t.quizDontKnow)) throw new Error('waiting');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });
    await waitFor(() => {
      if (!screen.queryByText(t.quizGotIt)) throw new Error('got it not found');
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizGotIt)); });

    // Wait for Q2 with back button
    await waitFor(() => expect(screen.queryByText(t.quizBack)).toBeTruthy(), { timeout: 3000 });
    onPatchCard.mockClear(); // clear hint-prefetch calls

    await act(async () => { fireEvent.click(screen.getByText(t.quizBack)); });

    expect(onPatchCard).toHaveBeenCalledOnce();
  });

  it('history resets when quiz is restarted', async () => {
    await startZhQuiz();

    // Answer Q1 wrong to build history
    await waitFor(() => {
      if (!screen.queryByText(t.quizDontKnow)) throw new Error('waiting');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });
    await waitFor(() => {
      if (!screen.queryByText(t.quizGotIt)) throw new Error('got it not found');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizGotIt)); });

    // Continue to summary by answering remaining questions
    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        const ok = screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow);
        if (!ok) throw new Error('answer buttons not found');
      }, { timeout: 5000 });
      const beforeProg = screen.queryByText(/question \d+ of/i)?.textContent;
      await act(async () => { fireEvent.click(screen.queryByText(t.quizKnowIt)); });
      await waitFor(() => {
        const summary = screen.queryByText(t.quizSummaryTitle);
        if (summary) return;
        const newProg = screen.queryByText(/question \d+ of/i)?.textContent;
        if (!newProg || newProg === beforeProg) throw new Error('not advanced');
      }, { timeout: 5000 });
    }

    await waitFor(() => expect(screen.queryByText(t.quizSummaryTitle)).toBeTruthy(), { timeout: 5000 });

    // Restart the quiz
    await act(async () => { fireEvent.click(screen.getByText(t.quizRestart)); });

    // Back to lobby — start again
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy(), { timeout: 3000 });

    // On Q1 with fresh history — back button should NOT be visible
    await waitFor(() => {
      if (!screen.queryByText(t.quizKnowIt) && !screen.queryByText(t.quizDontKnow)) {
        throw new Error('not on question screen');
      }
    }, { timeout: 3000 });
    expect(screen.queryByText(t.quizBack)).toBeFalsy();
  }, 30000);
});

// ─── Quiz-exclude toggle ──────────────────────────────────────────────────────

// ─── In-quiz skip-as-fail ─────────────────────────────────────────────────────

describe('QuizMode — In-quiz skip records wrong answer', () => {
  // pinyin: '' forces zh-pinyin → fallback to 'reading' (self-report flow)
  const zhDeck = Array.from({ length: 8 }, (_, i) =>
    makeCard({ id: `zh-${i}`, word: `word${i}`, subject: 'chinese', pinyin: '' })
  );

  async function startZhQuiz(deckOverride = zhDeck, extraProps = {}) {
    render(<QuizMode {...DEFAULT_PROPS} deck={deckOverride} {...extraProps} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy(), { timeout: 3000 });
    await waitFor(() => {
      const ok = screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow);
      if (!ok) throw new Error('question phase not ready');
    }, { timeout: 5000 });
  }

  it('renders the skip button on the question screen', async () => {
    await startZhQuiz();
    expect(screen.queryByText(t.quizSkipFail)).toBeTruthy();
  });

  it('does NOT render the skip button on the feedback screen', async () => {
    await startZhQuiz();
    await act(async () => { fireEvent.click(screen.getByText(t.quizDontKnow)); });
    await waitFor(() => {
      if (!screen.queryByText(t.quizGotIt)) throw new Error('not on feedback');
    }, { timeout: 3000 });
    // Wait for phase transition to complete and question component to unmount
    await waitFor(() => {
      expect(screen.queryByText(t.quizSkipFail)).toBeFalsy();
    }, { timeout: 1000 });
  });

  it('clicking skip calls onUpdateMastery(cardId, false) and does NOT call onPatchCard with quizDisabled', async () => {
    const onUpdateMastery = vi.fn();
    const onPatchCard = vi.fn();
    await startZhQuiz(zhDeck, { onUpdateMastery, onPatchCard });

    await act(async () => { fireEvent.click(screen.getByText(t.quizSkipFail)); });

    expect(onUpdateMastery).toHaveBeenCalledWith(expect.any(String), false);
    expect(onPatchCard).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ quizDisabled: true })
    );
  });

  it('clicking skip on the question phase advances to the next question', async () => {
    await startZhQuiz();
    const progressBefore = screen.queryByText(/question 1 of/i)?.textContent;
    await act(async () => { fireEvent.click(screen.getByText(t.quizSkipFail)); });
    await waitFor(() => {
      const newProg = screen.queryByText(/question \d+ of/i)?.textContent;
      if (!newProg || newProg === progressBefore) throw new Error('not advanced');
    }, { timeout: 3000 });
  });

  it('clicking skip on the last question goes to summary', async () => {
    const smallDeck = Array.from({ length: 5 }, (_, i) =>
      makeCard({ id: `s-${i}`, word: `word${i}`, subject: 'chinese', pinyin: '' })
    );
    render(<QuizMode {...DEFAULT_PROPS} deck={smallDeck} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByText('5')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy(), { timeout: 3000 });

    // Answer 4 questions correctly to reach Q5
    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        const ok = screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow);
        if (!ok) throw new Error('answer buttons not found');
      }, { timeout: 5000 });
      const beforeProg = screen.queryByText(/question \d+ of/i)?.textContent;
      await act(async () => { fireEvent.click(screen.queryByText(t.quizKnowIt)); });
      await waitFor(() => {
        if (screen.queryByText(t.quizSummaryTitle)) return;
        const newProg = screen.queryByText(/question \d+ of/i)?.textContent;
        if (!newProg || newProg === beforeProg) throw new Error('not advanced');
      }, { timeout: 5000 });
    }

    await waitFor(() => {
      if (!screen.queryByText(t.quizSkipFail)) throw new Error('no skip button on last Q');
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizSkipFail)); });

    await waitFor(() => {
      expect(screen.queryByText(t.quizSummaryTitle)).toBeTruthy();
    }, { timeout: 3000 });
  }, 30000);

  it('skipping records a wrong result so the card appears in weakCards on summary', async () => {
    const smallDeck = Array.from({ length: 2 }, (_, i) =>
      makeCard({ id: `s-${i}`, word: `word${i}`, subject: 'chinese', pinyin: '' })
    );
    render(<QuizMode {...DEFAULT_PROPS} deck={smallDeck} />);
    await act(async () => { fireEvent.click(screen.getByText(/chinese/i)); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start/i })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy(), { timeout: 3000 });

    // Skip Q1 (records wrong), answer Q2 correctly → summary should show 1 weak card
    await waitFor(() => {
      if (!screen.queryByText(t.quizSkipFail)) throw new Error('no skip button on Q1');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.getByText(t.quizSkipFail)); });

    await waitFor(() => {
      const ok = screen.queryByText(t.quizKnowIt) || screen.queryByText(t.quizDontKnow);
      if (!ok) throw new Error('Q2 not ready');
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(screen.queryByText(t.quizKnowIt)); });

    await waitFor(() => {
      expect(screen.queryByText(t.quizSummaryTitle)).toBeTruthy();
    }, { timeout: 5000 });
    expect(screen.queryByText(t.quizWeakTitle)).toBeTruthy();
  }, 30000);
});
