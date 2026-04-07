/**
 * Tests for two quiz mode fixes:
 * 1. chinese-meaning should speak Chinese (zh), not the English word
 * 2. Correct MCQ answer shows inline celebration overlay with Next button + 3s auto-advance
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QuizMode from '../QuizMode';
import { getStrings } from '../../lib/i18n';

// ─── Module mocks (hoisted) ───────────────────────────────────────────────────

vi.mock('../../lib/quizHintApi', () => ({
  getQuizHint: vi.fn().mockResolvedValue({
    encouragement: 'Keep going!',
    extraSentence: 'Practice makes perfect.',
    pronunciationGuide: 'fuh-VRITE',
  }),
}));

vi.mock('../../lib/speech', () => ({
  speak: vi.fn().mockResolvedValue(undefined),
  speakCardFull: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/quizLogic', async () => {
  const actual = await vi.importActual('../../lib/quizLogic');
  return {
    ...actual,
    buildQuestions: vi.fn(),
    selectQuizCards: vi.fn(),
  };
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { speak } from '../../lib/speech';
import { buildQuestions, selectQuizCards } from '../../lib/quizLogic';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const t = getStrings('en');

const CORRECT_CARD = {
  id: 'correct-card',
  word: 'favorite',
  chinese: '最喜欢',
  pinyin: 'zuì xǐ huan',
  emoji: '⭐',
  subject: 'english',
  sentence: 'My <em>favorite</em> color is blue.',
  mnemonic: null,
  mascot_message: null,
  mastery: null,
  reviewCount: null,
  lastReviewedAt: null,
  quizHints: null,
};

const WRONG_CARD_1 = { ...CORRECT_CARD, id: 'wrong-1', word: 'happy', chinese: '开心' };
const WRONG_CARD_2 = { ...CORRECT_CARD, id: 'wrong-2', word: 'sad', chinese: '难过' };
const NEXT_CARD = { ...CORRECT_CARD, id: 'next-card', word: 'blue', chinese: '蓝色' };

const DECK = [CORRECT_CARD, WRONG_CARD_1, WRONG_CARD_2, NEXT_CARD,
  ...Array.from({ length: 4 }, (_, i) => ({ ...CORRECT_CARD, id: `extra-${i}`, word: `word${i}` }))
];

const CHINESE_MEANING_Q = {
  card: CORRECT_CARD,
  type: 'chinese-meaning',
  hint: 'favorite',
  choices: [CORRECT_CARD, WRONG_CARD_1, WRONG_CARD_2],
  sentenceWithBlank: null,
};

// A second question so isLast=false on Q1
const FILL_BLANK_Q2 = {
  card: NEXT_CARD,
  type: 'fill-blank',
  hint: 'blue',
  choices: [NEXT_CARD, WRONG_CARD_1, WRONG_CARD_2],
  sentenceWithBlank: 'My ___ color is nice.',
};

const DEFAULT_PROPS = {
  t,
  lang: 'en',
  deck: DECK,
  onClose: vi.fn(),
  onUpdateMastery: vi.fn(),
  onPatchCard: vi.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function startQuiz(props = DEFAULT_PROPS) {
  render(<QuizMode {...props} />);
  const startBtn = screen.getByRole('button', { name: /start/i });
  await act(async () => { fireEvent.click(startBtn); });
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /start/i })).toBeFalsy();
  }, { timeout: 3000 });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  // Default: one chinese-meaning question (isLast=true)
  vi.mocked(selectQuizCards).mockReturnValue([CORRECT_CARD]);
  vi.mocked(buildQuestions).mockReturnValue([CHINESE_MEANING_Q]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Fix 1: TTS — chinese-meaning speaks Chinese (zh) ─────────────────────────

describe('QuizMode — chinese-meaning TTS fix', () => {
  it('speaks Chinese (zh) when chinese-meaning question is shown', async () => {
    await startQuiz();
    await waitFor(() => {
      expect(vi.mocked(speak)).toHaveBeenCalledWith('最喜欢', 'zh');
    }, { timeout: 3000 });
  });

  it('does NOT speak English word when chinese-meaning question is shown', async () => {
    await startQuiz();

    await waitFor(() => {
      // question prompt should be visible
      expect(screen.queryByText(t.quizPrompt.chineseMeaning)).toBeTruthy();
    }, { timeout: 3000 });

    // speak should not have been called with English for this type
    expect(vi.mocked(speak)).not.toHaveBeenCalledWith('favorite', 'en');
  });
});

// ─── Fix 2: Correct MCQ — inline celebration overlay ─────────────────────────

describe('QuizMode — Correct MCQ answer celebration overlay', () => {
  it('shows celebration banner on the question page after correct MCQ answer', async () => {
    await startQuiz();

    // Click the correct answer (its button text is the English word for chinese-meaning)
    await waitFor(() => {
      expect(screen.queryByText('favorite')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => { fireEvent.click(screen.getByText('favorite')); });

    await waitFor(() => {
      expect(screen.queryByText(t.quizCorrectBanner)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows a Next/Finish button in the celebration overlay after correct MCQ', async () => {
    vi.mocked(selectQuizCards).mockReturnValue([CORRECT_CARD, NEXT_CARD]);
    vi.mocked(buildQuestions).mockReturnValue([CHINESE_MEANING_Q, FILL_BLANK_Q2]);

    await startQuiz();

    await waitFor(() => { expect(screen.queryByText('favorite')).toBeTruthy(); }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText('favorite')); });

    await waitFor(() => {
      // isLast=false on Q1, so button shows quizNext
      expect(screen.queryByText(t.quizNext)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('clicking Next in celebration immediately advances to next question', async () => {
    vi.mocked(selectQuizCards).mockReturnValue([CORRECT_CARD, NEXT_CARD]);
    vi.mocked(buildQuestions).mockReturnValue([CHINESE_MEANING_Q, FILL_BLANK_Q2]);

    await startQuiz();

    await waitFor(() => { expect(screen.queryByText('favorite')).toBeTruthy(); }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText('favorite')); });

    await waitFor(() => { expect(screen.queryByText(t.quizNext)).toBeTruthy(); }, { timeout: 3000 });

    // Click Next — should advance to Q2
    await act(async () => { fireEvent.click(screen.getByText(t.quizNext)); });

    await waitFor(() => {
      // Q2 is fill-blank for NEXT_CARD — celebration should be gone, new question shown
      expect(screen.queryByText(t.quizCorrectBanner)).toBeFalsy();
    }, { timeout: 3000 });
  });

  it('auto-advances to summary after 3 seconds on correct MCQ answer (last question)', async () => {
    // Single question: isLast=true
    vi.mocked(selectQuizCards).mockReturnValue([CORRECT_CARD]);
    vi.mocked(buildQuestions).mockReturnValue([CHINESE_MEANING_Q]);

    await startQuiz();

    await waitFor(() => { expect(screen.queryByText('favorite')).toBeTruthy(); }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByText('favorite')); });

    // Celebration appears
    await waitFor(() => {
      expect(screen.queryByText(t.quizCorrectBanner)).toBeTruthy();
    }, { timeout: 3000 });

    // After 3 seconds the 3s timer fires → handleAnswer → setPhase('summary')
    await waitFor(() => {
      expect(screen.queryByText(t.quizSummaryTitle)).toBeTruthy();
    }, { timeout: 5000 });
  }, 15000);
});
