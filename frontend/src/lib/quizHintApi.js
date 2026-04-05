/**
 * Frontend wrapper for the /api/quiz-hint serverless function.
 *
 * QuizHint shape:
 *   { encouragement: string, extraSentence: string, pronunciationGuide: string, mnemonic?: string }
 *
 * Returns null on any error (graceful degradation — Memory Helper falls back to card fields).
 */

/**
 * Fetch a quiz hint for a missed card.
 *
 * @param {Object} params
 * @param {string} params.word
 * @param {string} [params.chinese]
 * @param {string} [params.pinyin]
 * @param {string} params.subject   - 'english' | 'chinese' | 'math'
 * @param {string} params.type      - 'pronunciation' | 'fill-blank' | 'word-meaning' | 'reading'
 * @param {boolean} params.hasMnemonic
 * @returns {Promise<QuizHint | null>}
 */
export async function getQuizHint({ word, chinese, pinyin, subject, type, hasMnemonic }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('/api/quiz-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, chinese, pinyin, subject, type, hasMnemonic }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Validate required fields
    const required = ['encouragement', 'extraSentence', 'pronunciationGuide'];
    if (!required.every((f) => typeof data[f] === 'string')) {
      return null;
    }

    const result = {
      encouragement: data.encouragement,
      extraSentence: data.extraSentence,
      pronunciationGuide: data.pronunciationGuide,
    };
    if (!hasMnemonic && typeof data.mnemonic === 'string') {
      result.mnemonic = data.mnemonic;
    }

    return result;
  } catch {
    // Network failure, AbortError (timeout), or JSON parse error — all silently null
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
