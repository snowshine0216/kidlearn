/**
 * StarCards card generation — calls /api/generate (Vercel serverless → MiniMax).
 * No API key needed here; key lives in MINIMAX_API_KEY server-side env var.
 *
 * For local dev: use `vercel dev` instead of `npm run dev`.
 * The /api/* routes only run under Vercel's runtime.
 */

// Rate gate: prevent double-clicks / accidental rapid calls
let lastCallTime = 0;

/**
 * Sanitize user input before sending to the API.
 * Strips injection chars, enforces 50-char limit, preserves CJK.
 */
export function sanitizeInput(word) {
  return word.slice(0, 50).replace(/[`'"\\<>\n\[\]]/g, '').trim();
}

/**
 * Map HTTP error status codes to actionable user messages (shown in the UI).
 */
function friendlyError(status) {
  if (status === 401) return 'API key invalid — check server environment variables';
  if (status === 429) return '请求太频繁，稍等一下再试 / Too many requests — wait a moment';
  if (status >= 500) return 'AI 服务暂时不可用，请重试 / AI service unavailable — try again';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return '没有网络连接 / No internet connection';
  return null;
}

/**
 * Generate a flashcard. Returns the card JSON object or throws an Error.
 *
 * @param {string} word      - User-entered word/concept
 * @param {string} subject   - 'english' | 'chinese' | 'math'
 */
export async function generateCard(word, subject) {
  const now = Date.now();
  if (now - lastCallTime < 1000) return null; // 1-second cooldown
  lastCallTime = now;

  const sanitizedWord = sanitizeInput(word);
  if (!sanitizedWord) throw new Error('请先输入词语 / Please enter a word first');

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word: sanitizedWord, subject }),
  });

  if (!response.ok) {
    const specific = friendlyError(response.status);
    let serverMsg = '';
    try {
      const body = await response.json();
      serverMsg = body.error ?? '';
    } catch {}
    throw new Error(specific ?? serverMsg ?? '糟糕！再试一次 🌟 / Oops! Try again 🌟');
  }

  return response.json();
}
