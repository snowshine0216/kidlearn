# TODOS

## API & Security

**Title:** Server-side rate limiting for `/api/generate` and `/api/speak`
**Priority:** P1
**Description:** Both endpoints have no rate limiting. A bot could drain the MiniMax API key. Mitigated for now by MiniMax spend cap + Vercel's default request limits. Add IP-based rate limiting (e.g., Vercel KV + sliding window) before sharing the URL publicly.

**Title:** Unbounded audio cache in `speech.js`
**Priority:** P2
**Description:** `audioCache` Map in speech.js grows indefinitely during a session. On a low-RAM tablet after 50+ cards, could cause memory pressure. Add LRU eviction with max ~20 entries.

**Title:** `speakCard` setTimeout not cancelled on fast card changes
**Priority:** P2
**Description:** If user generates a new card within 1.4s, the previous card's pinyin audio plays over the new card. Fix: return a cancel function from `speakCard` and call it from the FlashCard `useEffect` cleanup.

## v2 Features (Deferred from v1)

**Title:** Quiz mode
**Priority:** P3
**Description:** Multiple-choice quiz with confetti on correct answer. Requires mastery tracking fields (`mastery`, `reviewCount`, `lastReviewedAt`) and `QuizMode.jsx` component.

**Title:** Mastery tracking + spaced repetition
**Priority:** P3
**Description:** Build on `knewIt`/`reviewedAt` fields from v1. Add spaced repetition logic in `useDeck.js`. Show mastery stars on FlashCard and "Mastered / Need Review" stats in StatsRow.

**Title:** "Start Full Quiz" + sort-by-mastery in DeckView
**Priority:** P3
**Description:** After quiz mode exists, add quiz entry point and mastery sort to DeckView.

**Title:** Style selector (Illustrated / Story / Song)
**Priority:** P4
**Description:** Currently always generates Illustrated style. Add selector and implement Story/Song prompt variants in `api/generate.js`.

**Title:** Multi-device sync
**Priority:** P4
**Description:** localStorage is single-device. Move to cloud persistence (e.g., Vercel KV, Supabase) for cross-device access. Required for families with multiple devices.

## Completed

**Title:** StarCards v1 — MiniMax-powered bilingual flashcard app
**Completed:** v0.1.0.0 (2026-04-05)

**Title:** QA: Chinese card layout fix (汉字 prominent)
**Completed:** v0.1.0.0 (2026-04-05)

**Title:** QA: DeckView focus trap via aria-modal + inert
**Completed:** v0.1.0.0 (2026-04-05)

**Title:** Security: Remove committed .env, add subject/color_theme validation
**Completed:** v0.1.0.0 (2026-04-05)
