require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const journalRoutes = require('./routes/journal');
const { getDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// basic rate limiting - tighter on the analyze endpoint since each call costs money
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down a bit.' },
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many analysis requests. Please wait a moment.' },
});

app.use(globalLimiter);
app.use('/api/journal/analyze', llmLimiter);

app.use('/api/journal', journalRoutes);

app.get('/api/health', (req, res) => {
  const db = getDb();
  const { count } = db.prepare('SELECT COUNT(*) as count FROM journal_entries').get();
  res.json({
    status: 'ok',
    entries: count,
    ts: new Date().toISOString(),
  });
});

// catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'something went wrong' });
});

// init DB before starting
getDb();

app.listen(PORT, () => {
  console.log(`server running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('warning: ANTHROPIC_API_KEY not set, analyze endpoint will fail');
  }
});

module.exports = app;
