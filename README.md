# StarCards ✦ 星卡

AI flashcard generator for young children (age 5–8) learning English, Chinese & Math.
Powered by MiniMax AI. Interface is bilingual (Chinese default, EN toggle).

## Requirements

- Node 18+ — check with `node --version`
- A [MiniMax API key](https://platform.minimax.io) (free tier available)

---

## Local Development

```bash
git clone <this-repo>
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local — add your MINIMAX_API_KEY and set VITE_MINIMAX_API_KEY_HINT=true
npm run dev
# → http://localhost:5173
```

### Getting a MiniMax API key

1. Go to [platform.minimax.io](https://platform.minimax.io) and sign up
2. Navigate to **API Keys** and create a new key
3. Copy the key into `.env.local` as `MINIMAX_API_KEY=sk-...`
4. Also set `VITE_MINIMAX_API_KEY_HINT=true` in `.env.local` to hide the setup banner

Your `.env.local` should look like:

```
MINIMAX_API_KEY=sk-your-key-here
VITE_MINIMAX_API_KEY_HINT=true
```

> The API key is **never sent to the browser**. It lives server-side only — in the Vite dev middleware during local dev, and in Vercel serverless functions in production.

### Spending control

Set a monthly budget in your MiniMax account under **Billing → Spend Limit**.
Each card costs roughly ¥0.01–0.02 — a family app will stay well under ¥5/month.

---

## Deploy to Vercel

### First deploy

1. Push this repo to GitHub (the whole repo, not just `frontend/`)
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import the GitHub repository
4. Vercel will auto-detect the config from `vercel.json` — **do not change** the root/output settings
5. Before clicking **Deploy**, go to **Environment Variables** and add:
   - `MINIMAX_API_KEY` → your MiniMax API key
   - `VITE_MINIMAX_API_KEY_HINT` → `true`
6. Click **Deploy**

The app will be live at `https://your-project.vercel.app`.

### Re-deploying after code changes

```bash
git add .
git commit -m "your message"
git push
# Vercel auto-deploys on every push to main
```

### Adding the API key after deploy

If you forgot to add the key during first deploy:

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add `MINIMAX_API_KEY` (type: **Secret**) and `VITE_MINIMAX_API_KEY_HINT` (type: **Plain text**, value: `true`)
3. Go to **Deployments** → click the latest deployment → **Redeploy** (to pick up the new vars)

### How `vercel.json` works

```json
{
  "rootDirectory": "frontend",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

This tells Vercel that the actual app lives in `frontend/`. The serverless functions in `frontend/api/` are automatically deployed as Vercel Functions — they handle `/api/generate` and `/api/speak` server-side.

---

## Before You Share the URL

The API key stays server-side and is **not** exposed in the browser. It is safe to share the Vercel URL with family.
If you ever rotate the key, update it in **Vercel → Settings → Environment Variables** and redeploy.

---

## Tech Stack

- React + Vite, Tailwind CSS v3, DOMPurify, Vitest
- MiniMax API (`MiniMax-M2.5` model for text generation)
- Web Speech API (browser built-in, used as TTS fallback)
- Vercel serverless functions for API proxy

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "API 密钥未配置" banner shows | Add `VITE_MINIMAX_API_KEY_HINT=true` to `.env.local` |
| Generate button does nothing | Check `.env.local` has `MINIMAX_API_KEY` set |
| Vercel deploy fails "No framework detected" | Make sure `vercel.json` is committed at the repo root |
| Cards stopped generating | MiniMax model may have changed — update `model` in `vite.config.js` and `api/generate.js` |
| Fonts look different | Bunny Fonts CDN may be down; app falls back to system fonts automatically |
| Audio (听一听) not working | Web Speech API support varies by browser; works best in Chrome/Safari |

---

## Adding a New Subject (e.g., Science)

1. `InputPanel.jsx` — add to `SUBJECTS` array with emoji and id
2. `index.css` — add subject color variables following the existing pattern
3. `api/generate.js` + `vite.config.js` — update the AI prompt template
4. `DeckView.jsx` — add filter button to `FILTER_IDS`
