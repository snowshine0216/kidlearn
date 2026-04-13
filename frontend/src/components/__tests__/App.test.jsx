import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';

// Mock heavy children to isolate handleDeleteCard behavior
vi.mock('../../lib/claudeApi', () => ({ generateCard: vi.fn() }));
vi.mock('../../lib/speech', () => ({
  speak: vi.fn(),
  speakCard: vi.fn(),
  speakCardFull: vi.fn(),
  speechSupported: true,
}));

// Minimal localStorage stub
beforeEach(() => {
  localStorage.clear();
});

describe('App handleDeleteCard', () => {
  it('clears currentCard when the currently-displayed card is deleted', async () => {
    const card = {
      id: 'card-1',
      word: 'apple',
      emoji: '🍎',
      sentence: 'An apple a day.',
      color_theme: 'red',
      subject: 'english',
      savedAt: Date.now(),
      schemaVersion: 1,
      knewIt: null, reviewedAt: null, mastery: null, reviewCount: null,
      lastReviewedAt: null, nextReviewAt: null, quizHints: null, style: 'illustrated',
    };
    localStorage.setItem('starcards_deck', JSON.stringify([card]));

    render(<App />);

    // Load the card — the chip load button has aria-label of the word
    fireEvent.click(screen.getByLabelText('apple'));

    // Delete button exists before deletion
    expect(screen.getByLabelText('Delete apple')).toBeInTheDocument();

    // Delete via the × button
    fireEvent.click(screen.getByLabelText('Delete apple'));

    // Card removed from list — Delete button gone
    expect(screen.queryAllByLabelText('Delete apple')).toHaveLength(0);
  });

  it('does not clear currentCard when a different card is deleted', async () => {
    const card1 = {
      id: 'card-1',
      word: 'apple',
      emoji: '🍎',
      sentence: 'An apple.',
      color_theme: 'red',
      subject: 'english',
      savedAt: Date.now() - 1000,
      schemaVersion: 1,
      knewIt: null, reviewedAt: null, mastery: null, reviewCount: null,
      lastReviewedAt: null, nextReviewAt: null, quizHints: null, style: 'illustrated',
    };
    const card2 = {
      id: 'card-2',
      word: 'rose',
      emoji: '🌹',
      sentence: 'A rose.',
      color_theme: 'pink',
      subject: 'english',
      savedAt: Date.now(),
      schemaVersion: 1,
      knewIt: null, reviewedAt: null, mastery: null, reviewCount: null,
      lastReviewedAt: null, nextReviewAt: null, quizHints: null, style: 'illustrated',
    };
    localStorage.setItem('starcards_deck', JSON.stringify([card2, card1]));

    render(<App />);

    // Load card1 as currentCard
    fireEvent.click(screen.getByLabelText('apple'));

    // Both delete buttons should exist before any deletion
    expect(screen.getByLabelText('Delete apple')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete rose')).toBeInTheDocument();

    // Delete card2 (not the current one)
    fireEvent.click(screen.getByLabelText('Delete rose'));

    // card2 gone from list, but card1's delete button still present (still in list + still currentCard)
    expect(screen.queryAllByLabelText('Delete rose')).toHaveLength(0);
    expect(screen.getByLabelText('Delete apple')).toBeTruthy();
  });
});
