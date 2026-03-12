const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { analyzeEmotion, analyzeEmotionStream } = require('../services/llmService');

const VALID_AMBIENCES = ['forest', 'ocean', 'mountain', 'desert', 'meadow', 'waterfall'];

// helper to shape the db row into what the frontend expects
function formatEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    ambience: row.ambience,
    text: row.text,
    emotion: row.emotion || null,
    keywords: row.keywords ? JSON.parse(row.keywords) : null,
    summary: row.summary || null,
    analyzedAt: row.analyzed_at || null,
    createdAt: row.created_at,
  };
}

// POST /api/journal
router.post('/', async (req, res) => {
  try {
    const { userId, ambience, text } = req.body;

    if (!userId || !ambience || !text) {
      return res.status(400).json({ error: 'userId, ambience, and text are all required' });
    }

    const trimmedText = text.trim();
    if (trimmedText.length < 5) {
      return res.status(400).json({ error: 'Entry is too short' });
    }

    const amb = ambience.toLowerCase();
    if (!VALID_AMBIENCES.includes(amb)) {
      return res.status(400).json({
        error: `ambience must be one of: ${VALID_AMBIENCES.join(', ')}`,
      });
    }

    const db = getDb();

    const result = db.prepare(`
      INSERT INTO journal_entries (user_id, ambience, text)
      VALUES (?, ?, ?)
    `).run(userId, amb, trimmedText);

    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, entry: formatEntry(entry) });
  } catch (err) {
    console.error('POST /journal error:', err.message);
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

// GET /api/journal/:userId
router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const ambienceFilter = req.query.ambience;

    const db = getDb();

    let sql = 'SELECT * FROM journal_entries WHERE user_id = ?';
    const params = [userId];

    if (ambienceFilter) {
      sql += ' AND ambience = ?';
      params.push(ambienceFilter.toLowerCase());
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const entries = db.prepare(sql).all(...params);
    const { count } = db.prepare(
      'SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?'
    ).get(userId);

    res.json({ entries: entries.map(formatEntry), total: count, limit, offset });
  } catch (err) {
    console.error('GET /journal/:userId error:', err.message);
    res.status(500).json({ error: 'Could not fetch entries' });
  }
});

// POST /api/journal/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { text, entryId } = req.body;

    if (!text || text.trim().length < 5) {
      return res.status(400).json({ error: 'text field is required' });
    }

    const result = await analyzeEmotion(text);

    // if they passed an entryId, write the analysis back to that entry
    if (entryId) {
      const db = getDb();
      db.prepare(`
        UPDATE journal_entries
        SET emotion = ?, keywords = ?, summary = ?, analyzed_at = datetime('now')
        WHERE id = ?
      `).run(result.emotion, JSON.stringify(result.keywords), result.summary, entryId);
    }

    res.json({
      emotion: result.emotion,
      keywords: result.keywords,
      summary: result.summary,
      fromCache: result.fromCache,
    });
  } catch (err) {
    console.error('POST /analyze error:', err.message);

    if (err.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: 'LLM not configured: ' + err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/journal/analyze/stream?text=...
// SSE endpoint for streaming analysis
router.get('/analyze/stream', async (req, res) => {
  const { text } = req.query;

  if (!text || text.trim().length < 5) {
    return res.status(400).json({ error: 'text query param required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    for await (const chunk of analyzeEmotionStream(text)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('streaming error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// GET /api/journal/insights/:userId
router.get('/insights/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDb();

    const { count: totalEntries } = db.prepare(
      'SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?'
    ).get(userId);

    if (totalEntries === 0) {
      return res.json({
        totalEntries: 0,
        topEmotion: null,
        mostUsedAmbience: null,
        recentKeywords: [],
        analyzedEntries: 0,
        emotionBreakdown: [],
        ambienceBreakdown: [],
        recentEntries: 0,
      });
    }

    const topEmotionRow = db.prepare(`
      SELECT emotion, COUNT(*) as count
      FROM journal_entries
      WHERE user_id = ? AND emotion IS NOT NULL
      GROUP BY emotion
      ORDER BY count DESC
      LIMIT 1
    `).get(userId);

    const topAmbienceRow = db.prepare(`
      SELECT ambience, COUNT(*) as count
      FROM journal_entries
      WHERE user_id = ?
      GROUP BY ambience
      ORDER BY count DESC
      LIMIT 1
    `).get(userId);

    const emotionBreakdown = db.prepare(`
      SELECT emotion, COUNT(*) as count
      FROM journal_entries
      WHERE user_id = ? AND emotion IS NOT NULL
      GROUP BY emotion
      ORDER BY count DESC
    `).all(userId);

    const ambienceBreakdown = db.prepare(`
      SELECT ambience, COUNT(*) as count
      FROM journal_entries
      WHERE user_id = ?
      GROUP BY ambience
      ORDER BY count DESC
    `).all(userId);

    // pull keywords from last 10 analyzed entries and count frequency
    const lastAnalyzed = db.prepare(`
      SELECT keywords FROM journal_entries
      WHERE user_id = ? AND keywords IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    const kwFreq = {};
    for (const row of lastAnalyzed) {
      try {
        JSON.parse(row.keywords).forEach(kw => {
          kwFreq[kw] = (kwFreq[kw] || 0) + 1;
        });
      } catch { /* skip bad rows */ }
    }

    const recentKeywords = Object.entries(kwFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([kw]) => kw);

    const { count: analyzedEntries } = db.prepare(
      'SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ? AND emotion IS NOT NULL'
    ).get(userId);

    const { count: recentEntries } = db.prepare(`
      SELECT COUNT(*) as count FROM journal_entries
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    `).get(userId);

    res.json({
      totalEntries,
      topEmotion: topEmotionRow?.emotion || null,
      mostUsedAmbience: topAmbienceRow?.ambience || null,
      recentKeywords,
      analyzedEntries,
      emotionBreakdown,
      ambienceBreakdown,
      recentEntries,
    });
  } catch (err) {
    console.error('GET /insights error:', err.message);
    res.status(500).json({ error: 'Could not load insights' });
  }
});

module.exports = router;