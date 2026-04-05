# Changelog

All notable changes to StarCards will be documented in this file.

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
