# Changelog

All notable changes to StarCards will be documented in this file.

## [0.3.10.0] - 2026-05-09

### Added
- **Local SQLite storage** — `npm run dev` now persists flashcard decks and streak data in a local SQLite database (`data/starcards.sqlite`) instead of browser `localStorage`. The Vite dev server serves `/api/storage/*` routes backed by `better-sqlite3`. Vercel production has no storage route, so the frontend health-checks and automatically falls back to browser `localStorage` with a 500ms timeout.
- **One-time browser-to-SQLite migration** — on first local startup, any cards in browser `localStorage` are imported into SQLite with content-fingerprint deduplication (`subject + word + chinese + pinyin`). The import is idempotent and tracked per-browser with `starcards_sqlite_import_attempted_v1`.
- **Storage adapter boundary** — a clean adapter interface (`load`, `addCard`, `deleteCard`, `patchCard`, `updateCardMastery`, `reportCard`, `touchStreak`) decouples `useDeck` from the storage backend. SQLite adapter is selected when health check succeeds; localStorage adapter is the fallback.
- **Multi-tab convergence** — localStorage adapter listens to `storage` events for cross-tab sync; SQLite adapter refreshes state on window focus.

## [0.3.9.0] - 2026-05-09

### Added
- **Local quiz-hint API support** — `npm run dev` now serves `/api/quiz-hint`, so local quiz memory tips use the same serverless handler as production instead of falling through to a missing endpoint.
- **Project agent guidance** — repository-level agent instructions now document the local tooling and development expectations for future coding sessions.

### Fixed
- **Old skipped cards return to review** — cards hidden by the previous in-quiz skip behavior are migrated back into the quiz pool with `needsPractice: true`, while newly-disabled v2 cards remain respected.
- **Child-safe AI fallback restored** — flashcard generation and quiz hints once again redirect inappropriate child inputs toward safe rainbow/oops content, with regression tests covering production and local dev prompts.

## [0.3.8.0] - 2026-05-09

### Changed
- **Quiz lobby orders review-eligible cards first** — when a parent picks fewer cards than the full deck, the session now starts with the cards that need practice most (failed, never-reviewed, or overdue), instead of an arbitrary slice. Non-eligible cards fill the remainder so parents can always drill the full deck on low-due days.
- **In-quiz skip records a wrong answer** — the `跳过测验` button on the question screen now marks the current card wrong and advances, so the card resurfaces tomorrow via spaced repetition. It no longer permanently excludes the card from quiz sessions.
- **Skip button removed from the feedback screen** — the skip shortcut only appears on the unanswered question, not after the child has already responded.

## [0.3.7.0] - 2026-05-06

### Added
- **"All" quiz count option** — the quiz lobby now shows a fourth count button labelled "All" that starts a session with every eligible card for the chosen subject. Sessions with fewer than 5 eligible cards automatically switch to "All" so you can always review what needs practice, no matter how small the pool.

### Changed
- **Shared review eligibility pool** — the review badge on the home screen and the quiz session itself now use the same rule: never-reviewed cards, overdue scheduled cards, and cards marked as needing practice (`needsPractice: true` from a wrong answer). Low-mastery cards that aren't due no longer appear in review sessions.
- **Failed cards flagged for practice** — answering a quiz question incorrectly sets `needsPractice: true`; answering correctly clears it. Existing cards default to `needsPractice: false` on first load.
- **"Start quiz" requires at least one eligible card** — the Start button is disabled when there are zero eligible cards for the selected subject (previously required a minimum of 5).
- **"No cards need review" message** — the lobby message when there's nothing to review now reflects the actual eligibility rule instead of the old 5-card minimum.

### Fixed
- **Empty loading block under "Memory Tips"** — when a card already has a mnemonic or mascot message, the skeleton loading animation no longer appears alongside it. The fallback content shows immediately instead.
- **`mascot_message` now visible in quiz question view** — cards with a mascot message (but no mnemonic) now show that message in the self-report "wrong answer" memory panel, matching the feedback screen.
- **Blank screen guard** — if the eligible pool changes between lobby render and Start click, the quiz now safely stays on the lobby instead of entering a blank question screen.

## [0.3.6.0] - 2026-04-14

### Fixed
- **"Needs revise" now includes newly-added cards** — brand-new vocabulary cards (never reviewed) were being silently excluded from the "needs revise" quiz because the filter required a non-null timestamp. Cards with `nextReviewAt: null` now correctly appear as due for review.
- **"Needs revise" ordered newest-first** — cards in the due-only quiz now appear in newest-first order (by day added), with same-day cards shuffled relative to each other. Previously all cards were shuffled randomly.
- **Badge count matches quiz content** — the "N cards due for review" badge on the home screen now uses the same filter as the quiz itself, so the count is always accurate.

## [0.3.5.0] - 2026-04-13

### Added
- **Back button in quiz** — after answering a question, a "← Back" button appears so you can undo your last answer and try again; the card's mastery is restored to its pre-answer state, and the history clears when you restart the quiz
- **Quiz-exclude toggle** — each card in quiz mode (and in the card deck view) now has a "Skip in Quiz" button; excluded cards are hidden from all future quiz sessions until re-enabled with "Include in Quiz"

## [0.3.4.0] - 2026-04-13

### Added
- **Delete cards from the side panel** — every word chip in the recent-cards list now has a × button; clicking it removes the card from your deck immediately, and if you were viewing that card it clears the flashcard area

### Fixed
- **Error guard on card save** — if the AI returns an incomplete response (missing emoji, word, sentence, or color theme), the app now shows a clear error instead of silently saving a broken card

## [0.3.3.0] - 2026-04-09

### Added
- **Chinese fill-in-the-blank (填空题)** — Chinese-subject quizzes now include a round where a sentence in Chinese appears with the target character blanked out; the child picks the correct character from three choices
- **Chinese pinyin choice (选择拼音题)** — Chinese-subject quizzes now include a round where the Chinese character is shown and the child picks the correct pinyin from three choices
- Both new types fall back gracefully to the existing self-report reading round if a card lacks the required data (`sentence_zh` or `pinyin`)

### Fixed
- **Self-report questions auto-advance** — clicking "I know it" (会！我会读 🗣️ or 我说出来啦！✅) now skips the feedback page and advances to the next question automatically after a brief praise animation, matching the behavior for wrong self-report answers
- **"Listen → Choose" prompt removed** — the instruction text "听一听，选出正确的英文单词" no longer appears above the card; the card plays the Chinese audio automatically so the prompt is unnecessary

## [0.3.2.0] - 2026-04-09

### Added
- **Clickable "due for review" chip** — tapping the "🔔 N cards due for review" chip on the home screen now immediately launches a quiz of only those due cards, skipping the lobby; mixed english/chinese due cards are both included

## [0.3.1.0] - 2026-04-07

### Fixed
- **Quiz TTS — "Listen → Choose" speaks Chinese, not English** — the `chinese-meaning` quiz type now speaks the Chinese word (`zh`) when the question loads, so the child hears the meaning they are learning rather than hearing the answer
- **Correct MCQ answer stays on question page** — answering a multiple-choice question correctly no longer navigates away immediately; a celebration overlay appears on the same page with a Next button and auto-advances after 3 seconds

## [0.3.0.0] - 2026-04-06

### Added
- **Retry missed cards** — quiz summary now shows a "Review Missed Cards" button when any answers were wrong; clicking it immediately re-drills only the failed cards without going back to the lobby
- **New quiz type: "Listen → Choose" (chinese-meaning)** — English-subject quizzes now include a round where the child hears the English word spoken aloud, sees the Chinese characters and pinyin, and picks the correct English word from three choices
- **Inline memory tips on "Don't Know"** — when a child taps "Don't Know" in a self-report quiz round, the card reveal and AI memory tips (encouragement, example sentence, pronunciation guide) now appear together on the same page, instead of flashing the card briefly and auto-advancing; a "Got it" button lets the child advance when ready
- **Memory tip audio** — the 🔊 button in the inline memory tips view speaks the mnemonic or encouragement text, not the full flashcard audio sequence

### Changed
- **Hint text larger** — the hint/pinyin text shown when tapping the hint button is now 18px (was 14px) for easier reading on smaller screens

### Fixed
- **Hint fetch after close** — card patch updates are now guarded by a mounted-ref check, preventing state writes to a parent deck after the quiz overlay is closed mid-session

## [0.2.3.0] - 2026-04-06

### Fixed
- **Quiz hints now display in Chinese** — all hint fields (encouragement, extra sentence, pronunciation guide, mnemonic) now appear in Simplified Chinese (简体中文) as intended. Previously they were generated in English
- **English-subject audio order** — flashcard audio now plays: English word → Chinese characters → Chinese pinyin. Previously the Chinese characters step was missing
- **Chinese-subject audio order** — flashcard audio now plays: Chinese characters → full pinyin → syllable-by-syllable → English word. Previously the English word was never spoken

## [0.2.2.0] - 2026-04-06

### Added
- **Countdown timer opt-in** — quiz lobby now has a toggle (default Off) to enable per-question countdown; when On, four intervals are available: 30s, 1 min, 2 min, 5 min

### Changed
- **Timer behaviour on timeout** — time expiry now plays a bell sound and shows "Time's up!" without revealing or speaking the answer; previously the timer spoke the word and repeated up to 3 rounds
- **Single-round countdown** — removed the 3-round system; each question gets exactly one countdown interval when enabled

### Fixed
- Pre-existing `StatsRow` test failure where emoji+text split across DOM nodes caused an exact-match failure

## [0.2.1.0] - 2026-04-06

### Changed
- Cards now **auto-save** on generation — the 保存 (Save) button has been removed. Every generated card is immediately added to your deck with no extra tap required
- Removed the 我会了 / 还不会 self-report buttons from the flashcard view, reducing UI clutter
- Left sidebar now shows **Chinese characters** (汉字) for Chinese-subject cards instead of the English word

### Added
- **Sentence audio icon** — a 🔊 button appears in the sentence example box. Tapping it reads the English sentence aloud, then the Chinese translation after a short pause

## [0.2.0.0] - 2026-04-05

### Added
- **Quiz Mode** — children can now test themselves on saved cards with a full 4-phase flow: lobby → question → feedback → summary
- **English question types** — pronunciation (self-report + 🔊 audio), fill-in-the-blank (multiple choice from card sentence), word-to-meaning (pick Chinese from 3 options)
- **Chinese reading mode** — show the hanzi, child self-reports whether they can read it, hear pronunciation on "not sure"
- **Memory Helper** — wrong answers trigger a personalized AI hint (encouragement, example sentence, pronunciation guide) via new `/api/quiz-hint` endpoint; cached per card/type so it only fetches once
- **Quiz lobby** — subject toggle (English/Chinese), question count presets (5/10/20) disabled when deck is too small, loading state during hint prefetch
- **Quiz summary** — star rating (0–3 stars), score message, weak card list, Try Again / Back to Deck
- **Mastery tracking** — each answer updates `mastery`, `reviewCount`, `lastReviewedAt` on the card; future quizzes prioritize low-mastery cards
- **Canvas confetti** — correct answers and perfect scores trigger confetti (respects `prefers-reduced-motion`)
- **🎯 quiz button** in TopBar and DeckView header — appears when deck has 5+ cards of the selected subject
- **Rate limiting** on `/api/quiz-hint` — 30 requests/min per IP, sliding window
- **3 new tests** for `updateCardMastery` and `patchCard` hooks in `useDeck`

### Changed
- `useDeck` — added `updateCardMastery(id, correct)` and `patchCard(id, fields)` using functional updater pattern (no stale closure risk)
- `App.jsx` — `inert` guard extended to cover quiz modal alongside deck view

## [0.1.1.0] - 2026-04-05

### Added
- **Full test coverage** for all previously untested source files: `i18n.js`, `speech.js`, `claudeApi.js` (generateCard), `CardActions`, `StatsRow`, `TopBar`, `MascotMessage`, `InputPanel`, `DeckView` — 99 tests across 12 test files
- Tests cover happy paths, error states, edge cases (localStorage throws, network fallback, cooldown enforcement, filter/delete interactions, export, streak badge display)

## [0.1.0.0] - 2026-04-05

### Added
- **StarCards v1** — AI flashcard generator for children ages 5–8 learning English, Chinese, and Math
- MiniMax AI integration (`MiniMax-M2.5`) via Vercel serverless functions (`/api/generate`, `/api/speak`) — API key stays server-side
- Bilingual UI (Chinese default, English toggle) with full i18n coverage across all components
- FlashCard component with subject-aware layout: Chinese subject shows 汉字 prominently with pinyin → English below; English/Math shows English word prominently → Chinese translation below
- Self-report buttons ("I know it ✓" / "Not yet ✗") on each card — writes `knewIt` + `reviewedAt` to localStorage
- Daily streak tracking (🔥 N天连续 badge in TopBar) using local date for correct UTC+8 display
- Deck view (full-screen overlay) with subject filter (All / EN / ZH / MATH), delete confirmation, and JSON export
- Recent words chips in InputPanel showing word + subject badge + date
- CSS animations: `slideUp` on new card, `pulse-green` on save, `shimmer` skeleton while loading
- Bunny Fonts (Baloo 2 + Nunito) — privacy-friendly, no Google tracking; system font fallback
- Web Speech API TTS with MiniMax TTS fallback for supported browsers
- DOMPurify XSS protection on LLM-generated sentence content
- Prompt injection protection: `[WORD_START]`/`[WORD_END]` delimiters + sanitizeInput strips injection chars including `[]`
- Server-side subject allowlist and color_theme enum validation in `/api/generate`
- 500-card deck soft limit with toast notification
- `inert` attribute + `aria-modal` focus trap when DeckView overlay is open
- `vercel.json` deployment config at repo root — one-click Vercel deploy
- Complete README with MiniMax key setup, Vercel deploy guide, and troubleshooting table

### Fixed
- Chinese cards now show 汉字 at large size (card-chinese class) with English word secondary (QA fix)
- DeckView Chinese text no longer inherits large font-size from card-chinese — uses `.cjk-font` utility class in thumbnails
- Toast clearTimeout on rapid successive calls — prevents second toast from being wiped by first timer
- `loadLang`/`saveLang` wrapped in try/catch — prevents crash in Safari private mode
- CardActions `saved` state derived from prop instead of stale `useState` — correctly reflects cross-tab deck changes

### Security
- `frontend/.env` removed from git tracking; `.env` added to `.gitignore`
- Subject parameter validated against allowlist before prompt interpolation
- `[]` characters stripped from user input to prevent `[WORD_END]` prompt injection
- TTS endpoint enforces 200-character max on text parameter
