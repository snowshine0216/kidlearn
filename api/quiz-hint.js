/**
 * Vercel serverless function — quiz hint generation proxy.
 * Keeps the API key server-side; handles CORS for the Vite frontend.
 *
 * POST /api/quiz-hint
 * Body: { word, chinese, pinyin, subject, type, hasMnemonic }
 * Returns: { encouragement, extraSentence, pronunciationGuide, mnemonic? }
 */

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

export function buildSystemPrompt() {
  return `You are a warm, encouraging bilingual tutor helping a child aged 5–8 learn vocabulary.
When a child gets an answer wrong, you provide a short, supportive hint to help them remember.
Keep all language simple — the child is young!
Always write ALL hint text in Simplified Chinese (简体中文). Do not use English in any hint field.
If the word seems inappropriate for a child, respond about a "rainbow" instead.
Always respond with valid JSON only. No markdown, no preamble, no explanation.`;
}

export function buildUserPrompt({ word, chinese, pinyin, subject, type, needsMnemonic }) {
  const mnemonicField = needsMnemonic
    ? `"mnemonic": "用1-2句话，用图像或谐音帮助记忆",`
    : '';
  return `A child missed this word in a quiz.
Word: [WORD_START]${word}[WORD_END]
Chinese: [ZH_START]${chinese ?? ''}[ZH_END]
Pinyin: [PY_START]${pinyin ?? ''}[PY_END]
Subject: ${subject}
Quiz type: ${type}

Give a short, friendly hint in Simplified Chinese (简体中文) to help them remember.
Respond ONLY with this JSON:
{
  "encouragement": "用1-2句话，把词语和有趣的事物联系起来",
  "extraSentence": "用这个词造一个简单的句子",
  "pronunciationGuide": "把发音分解成音节（例：蝴·蝶 🦋）"${needsMnemonic ? ',' : ''}
  ${mnemonicField}
}
用5-8岁孩子能理解的简体中文写所有内容。`;
}

const VALID_SUBJECTS = ['english', 'chinese', 'math'];
const VALID_QUIZ_TYPES = ['pronunciation', 'fill-blank', 'word-meaning', 'reading'];

// Simple in-memory rate limiter: 30 requests per IP per 60-second window.
// Stored at module level so it persists across requests in the same warm instance.
// Not distributed — effective for casual abuse, not a hard guarantee.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const ipWindows = new Map(); // ip -> { count, windowStart }

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipWindows.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    ipWindows.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) return true;
  return false;
}

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

  // Rate limiting — use X-Forwarded-For (Vercel sets this), fall back to socket address
  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { word, chinese, pinyin, subject, type, hasMnemonic } = req.body ?? {};

  // Input validation
  if (!word || typeof word !== 'string' || word.trim().length === 0 || word.length > 50) {
    return res.status(400).json({ error: 'word is required and must be a non-empty string (max 50 chars)' });
  }
  if (chinese !== undefined && chinese !== null && (typeof chinese !== 'string' || chinese.length > 100)) {
    return res.status(400).json({ error: 'chinese must be a string (max 100 chars)' });
  }
  if (pinyin !== undefined && pinyin !== null && (typeof pinyin !== 'string' || pinyin.length > 100)) {
    return res.status(400).json({ error: 'pinyin must be a string (max 100 chars)' });
  }
  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return res.status(400).json({ error: `subject must be one of: ${VALID_SUBJECTS.join(', ')}` });
  }
  if (!type || !VALID_QUIZ_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_QUIZ_TYPES.join(', ')}` });
  }
  if (typeof hasMnemonic !== 'boolean') {
    return res.status(400).json({ error: 'hasMnemonic must be a boolean' });
  }

  const needsMnemonic = !hasMnemonic;
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ word, chinese, pinyin, subject, type, needsMnemonic });

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('MiniMax error:', response.status, errText);
      return res.status(502).json({ error: `AI service error: ${response.status}` });
    }

    const data = await response.json();
    if (data.base_resp?.status_code !== 0) {
      const msg = data.base_resp?.status_msg ?? 'MiniMax error';
      console.error('MiniMax app error:', msg);
      return res.status(502).json({ error: msg });
    }

    const text = data.choices?.[0]?.message?.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const clean = jsonMatch ? jsonMatch[0] : '';

    let hint;
    try {
      hint = JSON.parse(clean);
    } catch {
      console.error('AI returned invalid JSON. raw text:', text);
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    const required = ['encouragement', 'extraSentence', 'pronunciationGuide'];
    if (!required.every((f) => typeof hint[f] === 'string')) {
      return res.status(502).json({ error: 'AI returned incomplete hint' });
    }

    const result = {
      encouragement: hint.encouragement,
      extraSentence: hint.extraSentence,
      pronunciationGuide: hint.pronunciationGuide,
    };
    if (needsMnemonic && typeof hint.mnemonic === 'string') {
      result.mnemonic = hint.mnemonic;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(result);
  } catch (err) {
    console.error('quiz-hint handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
