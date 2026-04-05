# Changelog

All notable changes to StarCards will be documented in this file.

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
