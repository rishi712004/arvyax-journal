const crypto = require('crypto');
const { getDb } = require('../db/database');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function hashText(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

async function analyzeEmotion(text) {
  const db = getDb();
  const hash = hashText(text);

  const cached = db.prepare('SELECT * FROM analysis_cache WHERE text_hash = ?').get(hash);
  if (cached) {
    console.log('cache hit, skipping LLM call');
    return {
      emotion: cached.emotion,
      keywords: JSON.parse(cached.keywords),
      summary: cached.summary,
      fromCache: true,
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing from .env');
  }

  const prompt = `You are analyzing a wellness journal entry. Return ONLY a JSON object, no markdown formatting.

Entry: "${text}"

JSON format:
{
  "emotion": "single word emotion (e.g. calm, anxious, grateful, sad, hopeful)",
  "keywords": ["3 to 5 key words or phrases from the entry"],
  "summary": "one sentence describing the user's emotional state"
}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API returned ${res.status}: ${errText}`);
  }

  const data = await res.json();
  let raw = data.choices[0].message.content.trim();

  raw = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();

  const parsed = JSON.parse(raw);

  if (!parsed.emotion || !parsed.keywords || !parsed.summary) {
    throw new Error('LLM returned unexpected structure');
  }

  db.prepare(`
    INSERT OR REPLACE INTO analysis_cache (text_hash, emotion, keywords, summary)
    VALUES (?, ?, ?, ?)
  `).run(hash, parsed.emotion, JSON.stringify(parsed.keywords), parsed.summary);

  return { ...parsed, fromCache: false };
}

async function* analyzeEmotionStream(text) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is missing');

  const prompt = `Read this wellness journal entry and give a warm, supportive reflection:

"${text}"

Talk about the emotions you notice, the themes present, and offer a brief encouraging observation. Keep it conversational, like a thoughtful friend reading it.`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const chunk = line.slice(6);
      if (chunk === '[DONE]') return;

      try {
        const evt = JSON.parse(chunk);
        const text = evt.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // skip malformed lines
      }
    }
  }
}

module.exports = { analyzeEmotion, analyzeEmotionStream };
