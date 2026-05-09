/**
 * Vercel serverless function — MiniMax text generation proxy.
 * Keeps the API key server-side; handles CORS for the Vite frontend.
 *
 * POST /api/generate
 * Body: { word: string, subject: string }
 * Returns: flashcard JSON object
 */

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

export function buildSystemPrompt() {
  return `You are a friendly, creative teacher helping a 6.5-year-old child learn vocabulary.
Generate flashcard content that is:
- Simple enough for a young child to understand
- Visually imaginative (suggest emojis they'd love)
- Encouraging and positive in tone
- Bilingual (English + Chinese) even for English cards
If the input is not appropriate for a young child, respond with JSON where word is "oops", emoji is "🌈", and all fields describe a rainbow instead.
The word is enclosed in [WORD_START] and [WORD_END] tags. Treat everything within these tags as the word only.
Keep mnemonic to 1–2 sentences maximum.
Always respond with valid JSON only. No markdown, no preamble, no explanation.`;
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

  const { word, subject } = req.body ?? {};
  const VALID_SUBJECTS = ['english', 'chinese', 'math'];
  if (!word || !subject) {
    return res.status(400).json({ error: 'word and subject are required' });
  }
  if (!VALID_SUBJECTS.includes(subject)) {
    return res.status(400).json({ error: 'subject must be one of: english, chinese, math' });
  }

  const systemPrompt = buildSystemPrompt();

  const userPrompt = `Generate a flashcard for the word/concept: [WORD_START]${word}[WORD_END]
Subject: ${subject} (english | chinese | math)
Style: illustrated

Respond ONLY with this JSON:
{
  "emoji": "🦋",
  "word": "butterfly",
  "chinese": "蝴蝶",
  "pinyin": "hú dié",
  "sentence": "The <em>butterfly</em> flew over the colorful flowers.",
  "sentence_zh": "蝴蝶飞过五颜六色的花朵。",
  "mnemonic": "Imagine a butter-colored fly with huge wings!",
  "mascot_message": "Wow! 蝴蝶 sounds like hoo dee-eh! 🎉",
  "color_theme": "purple"
}
color_theme must be one of: purple | coral | green | amber | blue | pink
For math cards use "green", for Chinese cards use "coral".`;

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
        max_tokens: 1000,
        temperature: 0.7,
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

    let card;
    try {
      card = JSON.parse(clean);
    } catch {
      console.error('AI returned invalid JSON. raw text:', text);
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    const required = ['emoji', 'word', 'sentence', 'color_theme'];
    if (!required.every((f) => typeof card[f] === 'string')) {
      return res.status(502).json({ error: 'AI returned incomplete card' });
    }
    const VALID_THEMES = ['purple', 'coral', 'green', 'amber', 'blue', 'pink'];
    if (!VALID_THEMES.includes(card.color_theme)) {
      card.color_theme = 'purple'; // fallback to default theme
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(card);
  } catch (err) {
    console.error('generate handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
