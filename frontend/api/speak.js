/**
 * Vercel serverless function — MiniMax TTS proxy.
 * Returns base64-encoded MP3 audio for a given text + language.
 *
 * POST /api/speak
 * Body: { text: string, lang: 'zh' | 'en' }
 * Returns: { audio: string }  — base64 MP3
 */

const MINIMAX_TTS_URL = 'https://api.minimax.chat/v1/t2a_v2';

// MiniMax voice IDs — sweet/warm female voices suitable for children
const VOICES = {
  zh: 'female-tianmei',  // 甜美 — sweet, warm, great for Chinese children's content
  en: 'Stella',          // Friendly English female
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MINIMAX_API_KEY not configured on server' });
  }

  const { text, lang = 'zh' } = req.body ?? {};
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (typeof text !== 'string' || text.length > 200) {
    return res.status(400).json({ error: 'text must be a string under 200 characters' });
  }

  const voiceId = VOICES[lang] ?? VOICES.zh;

  try {
    const response = await fetch(MINIMAX_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'speech-02-turbo',
        text,
        voice_setting: {
          voice_id: voiceId,
          speed: 0.8,    // slightly slower for children
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          audio_sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('MiniMax TTS error:', response.status, errText);
      return res.status(502).json({ error: `TTS service error: ${response.status}` });
    }

    const data = await response.json();
    const audio = data.data?.audio;

    if (!audio) {
      return res.status(502).json({ error: 'TTS returned no audio' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ audio });
  } catch (err) {
    console.error('speak handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
