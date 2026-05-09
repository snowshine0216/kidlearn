import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load ALL env vars from .env.local (including non-VITE_ prefixed ones)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), devApiPlugin(env)],
    build: { outDir: 'dist' },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.js'],
    },
  };
});

// ─── Dev API middleware ───────────────────────────────────────────────────────
// Intercepts /api/generate and /api/speak during `npm run dev`.
// In production (Vercel) the real serverless functions in /api/*.js handle these.
function devApiPlugin(env) {
  const MINIMAX_TEXT_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
  const MINIMAX_TTS_URL  = 'https://api.minimax.chat/v1/t2a_v2';

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
      req.on('error', reject);
    });
  }

  function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  }

  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {

      // POST /api/generate → MiniMax text generation
      server.middlewares.use('/api/generate', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        const apiKey = env.MINIMAX_API_KEY;
        if (!apiKey) return json(res, 500, { error: 'MINIMAX_API_KEY not set in .env.local' });

        const { word, subject } = await readBody(req);
        if (!word || !subject) return json(res, 400, { error: 'word and subject are required' });

        const systemPrompt = `You are a friendly, creative teacher helping a 6.5-year-old child learn vocabulary.
Generate flashcard content that is simple, visually imaginative, encouraging, and bilingual (English + Chinese).
The word is in [WORD_START]...[WORD_END] tags. Keep mnemonic to 1–2 sentences.
Always respond with valid JSON only. No markdown, no preamble.`;

        const userPrompt = `Generate a flashcard for: [WORD_START]${word}[WORD_END]
Subject: ${subject}
Respond ONLY with this JSON:
{"emoji":"🦋","word":"butterfly","chinese":"蝴蝶","pinyin":"hú dié","sentence":"The <em>butterfly</em> flew.","sentence_zh":"蝴蝶飞了。","mnemonic":"Butter + fly!","mascot_message":"Wow! 🎉","color_theme":"purple"}
color_theme: purple|coral|green|amber|blue|pink. Use "coral" for Chinese, "green" for math.`;

        try {
          const mmRes = await fetch(MINIMAX_TEXT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'MiniMax-M2.5',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt },
              ],
              max_tokens: 1000,
              temperature: 0.7,
            }),
          });

          console.log('[dev-api] MiniMax status:', mmRes.status);
          if (!mmRes.ok) {
            const err = await mmRes.text();
            console.error('[dev-api] MiniMax text error:', mmRes.status, err);
            return json(res, 502, { error: `MiniMax ${mmRes.status}: ${err.slice(0, 200)}` });
          }

          const data  = await mmRes.json();
          // Check MiniMax base_resp for application-level errors (status 200 but failed)
          if (data.base_resp?.status_code !== 0) {
            const msg = data.base_resp?.status_msg ?? 'MiniMax error';
            console.error('[dev-api] MiniMax app error:', msg);
            return json(res, 502, { error: msg });
          }

          const text = data.choices?.[0]?.message?.content ?? '';

          // Extract first JSON object — handles ```json blocks, leading/trailing text
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const clean = jsonMatch ? jsonMatch[0] : '';

          let card;
          try { card = JSON.parse(clean); }
          catch (e) {
            console.error('[dev-api] JSON parse failed. raw text:', text);
            // Return first 300 chars of raw response so user can see what came back
            return json(res, 502, { error: `Parse failed. Raw: ${text.slice(0, 300)}` });
          }

          const required = ['emoji', 'word', 'sentence', 'color_theme'];
          if (!required.every((f) => typeof card[f] === 'string'))
            return json(res, 502, { error: 'AI returned incomplete card' });

          return json(res, 200, card);
        } catch (e) {
          console.error('[dev-api] generate error:', e);
          return json(res, 500, { error: e.message });
        }
      });

      // POST /api/speak → MiniMax TTS
      server.middlewares.use('/api/speak', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        const apiKey = env.MINIMAX_API_KEY;
        if (!apiKey) return json(res, 500, { error: 'MINIMAX_API_KEY not set in .env.local' });

        const { text, lang = 'zh' } = await readBody(req);
        if (!text) return json(res, 400, { error: 'text is required' });

        const voiceId = lang === 'zh' ? 'female-tianmei' : 'Stella';

        try {
          const ttsRes = await fetch(MINIMAX_TTS_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'speech-02-turbo',
              text,
              voice_setting: { voice_id: voiceId, speed: 0.8, vol: 1.0, pitch: 0 },
              audio_setting: { audio_sample_rate: 32000, bitrate: 128000, format: 'mp3' },
            }),
          });

          if (!ttsRes.ok) {
            const err = await ttsRes.text();
            console.error('[dev-api] MiniMax TTS error:', ttsRes.status, err);
            return json(res, 502, { error: `TTS error ${ttsRes.status}` });
          }

          const data  = await ttsRes.json();
          const audio = data.data?.audio;
          if (!audio) return json(res, 502, { error: 'TTS returned no audio' });

          return json(res, 200, { audio });
        } catch (e) {
          console.error('[dev-api] speak error:', e);
          return json(res, 500, { error: e.message });
        }
      });
    },
  };
}
