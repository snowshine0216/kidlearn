/**
 * Audio playback for StarCards.
 *
 * Primary: MiniMax TTS via /api/speak (high-quality Chinese pronunciation).
 * Fallback: Browser Web Speech API (used if /api/speak is unreachable or during local dev).
 */

let audioCache = new Map(); // simple in-memory cache: text+lang → base64

/**
 * Play audio via MiniMax TTS (serverless proxy).
 * Falls back to Web Speech API on error.
 */
export async function speak(text, lang = 'zh') {
  if (!text) return;

  const cacheKey = `${lang}:${text}`;
  let audioBase64 = audioCache.get(cacheKey);

  if (!audioBase64) {
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      });
      if (res.ok) {
        const { audio } = await res.json();
        audioBase64 = audio;
        audioCache.set(cacheKey, audio);
      }
    } catch {
      // Network error or local dev without vercel dev — fall through to Web Speech
    }
  }

  if (audioBase64) {
    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    return audio.play().catch(() => {
      // Autoplay blocked (browser policy) — silently ignore
    });
  }

  // Web Speech API fallback
  webSpeechSpeak(text, lang === 'zh' ? 'zh-CN' : 'en-US');
}

/**
 * Speak the word (English) then the pinyin (Chinese) with a brief pause.
 * Handles autoplay policy gracefully.
 */
export async function speakCard(word, pinyin) {
  await speak(word, 'en');
  if (pinyin) {
    setTimeout(() => speak(pinyin, 'zh'), 1400);
  }
}

function webSpeechSpeak(text, bcp47) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47;
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

export const speechSupported = true; // MiniMax TTS always available when deployed
