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

/**
 * Speak a card in the correct pedagogical order based on subject.
 *
 * Chinese cards (e.g. 苹果 / píng guǒ / apple):
 *   1. 汉字 whole: 苹果
 *   2. 900 ms → full pinyin: píng guǒ
 *   3. 700 ms → each syllable individually: píng … guǒ (650 ms apart)
 *   4. after last syllable + 200 ms → English word: apple
 *   (if no pinyin: 汉字, then English at 1200 ms)
 *
 * English/Math cards (e.g. butterfly / 蝴蝶 / hú dié):
 *   1. English word: butterfly
 *   2. 1400 ms → Chinese characters: 蝴蝶
 *   3. 3200 ms → full pinyin: hú dié
 *   (if no chinese: English word, then pinyin at 1400 ms)
 */
export async function speakCardFull(card) {
  if (card.subject === 'chinese' && card.chinese) {
    await speak(card.chinese, 'zh');
    if (card.pinyin) {
      const syllables = card.pinyin.trim().split(/\s+/).filter(Boolean);
      let offset = 900;
      setTimeout(() => speak(card.pinyin, 'zh'), offset);   // whole pinyin
      offset += 700;
      syllables.forEach(syl => {
        setTimeout(() => speak(syl, 'zh'), offset);          // each syllable
        offset += 650;
      });
      // after last syllable (offset is 650ms past its start), add English
      if (card.word) setTimeout(() => speak(card.word, 'en'), offset + 200);
    } else {
      if (card.word) setTimeout(() => speak(card.word, 'en'), 1200);
    }
  } else {
    await speak(card.word, 'en');
    if (card.chinese) {
      setTimeout(() => speak(card.chinese, 'zh'), 1400);
      if (card.pinyin) setTimeout(() => speak(card.pinyin, 'zh'), 3200);
    } else if (card.pinyin) {
      setTimeout(() => speak(card.pinyin, 'zh'), 1400);
    }
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
