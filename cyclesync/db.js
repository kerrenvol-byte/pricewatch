import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CYCLESYNC_DATA_DIR || __dirname;
export const db = new DatabaseSync(path.join(DATA_DIR, 'cyclesync.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS period_days (
  date TEXT PRIMARY KEY,              -- 'YYYY-MM-DD'
  flow TEXT DEFAULT 'medium',         -- 'spotting' | 'light' | 'medium' | 'heavy'
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS daily_logs (
  date TEXT PRIMARY KEY,              -- 'YYYY-MM-DD'
  mood INTEGER,                       -- 1-5
  energy INTEGER,                     -- 1-5
  appetite INTEGER,                   -- 1-5
  note TEXT,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}
