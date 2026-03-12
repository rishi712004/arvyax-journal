const Database = require('better-sqlite3');
const path = require('path');

// keep the db file in the backend root
const DB_PATH = path.join(__dirname, '..', 'journal.db');

let db = null;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);

  // WAL is significantly faster for concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  setupTables();
  return db;
}

function setupTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      ambience    TEXT NOT NULL,
      text        TEXT NOT NULL,
      emotion     TEXT,
      keywords    TEXT,
      summary     TEXT,
      analyzed_at TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user    ON journal_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_entries_emotion ON journal_entries(emotion);
    CREATE INDEX IF NOT EXISTS idx_entries_created ON journal_entries(created_at);

    -- caches LLM results so we don't pay for the same text twice
    CREATE TABLE IF NOT EXISTS analysis_cache (
      text_hash  TEXT PRIMARY KEY,
      emotion    TEXT NOT NULL,
      keywords   TEXT NOT NULL,
      summary    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('db ready');
}

module.exports = { getDb };