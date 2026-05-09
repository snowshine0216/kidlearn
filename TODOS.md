# TODOS

## API & Security

**Title:** Server-side rate limiting for `/api/generate` and `/api/speak`
**Priority:** P1
**Description:** Both endpoints have no rate limiting. A bot could drain the MiniMax API key. Mitigated for now by MiniMax spend cap + Vercel's default request limits. Add IP-based rate limiting (e.g., Vercel KV + sliding window) before sharing the URL publicly. (Note: `/api/quiz-hint` added in-memory sliding window rate limiting in v0.2.0.0 — apply same pattern to generate and speak.)

**Title:** Unbounded audio cache in `speech.js`
**Priority:** P2
**Description:** `audioCache` Map in speech.js grows indefinitely during a session. On a low-RAM tablet after 50+ cards, could cause memory pressure. Add LRU eviction with max ~20 entries.

**Title:** `speakCard` setTimeout not cancelled on fast card changes
**Priority:** P2
**Description:** If user generates a new card within 1.4s, the previous card's pinyin audio plays over the new card. Fix: return a cancel function from `speakCard` and call it from the FlashCard `useEffect` cleanup.

## Quiz / Spaced Repetition

## Code Quality

**Title:** Fix `useDeck.deleteCard` stale closure
**Priority:** P3
**Description:** `deleteCard` closes over the `deck` snapshot from `useCallback` instead of using a functional updater (`setDeck(prev => prev.filter(...))`). Rapid consecutive deletes (e.g., two taps in the same render cycle) could silently no-op the second delete. `updateCardMastery` and `patchCard` in the same hook already use the correct functional updater pattern — `deleteCard` should match. One-line fix + one test for rapid delete behavior.

## v2 Features (Deferred from v1)

**Title:** Mastery tracking + spaced repetition
**Priority:** P3
**Description:** Build on `knewIt`/`reviewedAt` fields from v1. Add spaced repetition logic in `useDeck.js`. Show mastery stars on FlashCard and "Mastered / Need Review" stats in StatsRow. (Note: mastery fields now populated by quiz mode as of v0.2.0.0; spaced repetition algorithm and StatsRow display still pending.)

**Title:** Style selector (Illustrated / Story / Song)

**Title:** Style selector (Illustrated / Story / Song)
**Priority:** P4
**Description:** Currently always generates Illustrated style. Add selector and implement Story/Song prompt variants in `api/generate.js`.

**Title:** Multi-device sync
**Priority:** P4
**Description:** localStorage is single-device. Move to cloud persistence (e.g., Vercel KV, Supabase) for cross-device access. Required for families with multiple devices.

## Completed

**Title:** Migrate `quizDisabled: true` cards set by the old skip button
**Completed:** v0.3.9.0 (2026-05-09)

**Title:** Bigger hint text + retry missed cards in quiz
**Completed:** v0.3.0.0 (2026-04-06)

**Title:** Fix quiz hints to display in Simplified Chinese (简体中文)
**Completed:** v0.2.3.0 (2026-04-06)

**Title:** Fix TTS audio order — English cards: word → Chinese → pinyin; Chinese cards: Chinese → pinyin → syllables → English
**Completed:** v0.2.3.0 (2026-04-06)

**Title:** Countdown timer (opt-in, configurable intervals: 30s / 1 min / 2 min / 5 min); timeout plays bell + "Time's up!" without revealing answer; removed 3-round system
**Completed:** v0.2.1.0 (2026-04-06)

**Title:** Quiz mode
**Completed:** v0.2.0.0 (2026-04-05)

**Title:** "Start Full Quiz" + quiz entry point in DeckView and TopBar
**Completed:** v0.2.0.0 (2026-04-05)

**Title:** StarCards v1 — MiniMax-powered bilingual flashcard app
**Completed:** v0.1.0.0 (2026-04-05)

**Title:** QA: Chinese card layout fix (汉字 prominent)
**Completed:** v0.1.0.0 (2026-04-05)

**Title:** QA: DeckView focus trap via aria-modal + inert
**Completed:** v0.1.0.0 (2026-04-05)

**Title:** Security: Remove committed .env, add subject/color_theme validation
**Completed:** v0.1.0.0 (2026-04-05)
