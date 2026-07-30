import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// בענן מסד הנתונים יושב על דיסק קבוע (volume) כדי לשרוד פריסות מחדש;
// בהרצה מקומית — בתיקיית הפרויקט, בדיוק כמו קודם.
const DATA_DIR = process.env.PRICEWATCH_DATA_DIR || __dirname;
export const db = new DatabaseSync(path.join(DATA_DIR, 'pricewatch.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,              -- 'grocery' | 'zap' | 'general'
  name TEXT NOT NULL,
  barcode TEXT,                    -- grocery barcode or zap model id
  query TEXT,                      -- free-text query used for general search
  image TEXT,                      -- base64 thumbnail (optional)
  interval_minutes INTEGER DEFAULT 1440,
  notify_mode TEXT DEFAULT 'drop', -- 'drop' | 'change' | 'off'
  target_price REAL,               -- optional: notify when min price <= target
  created_at TEXT DEFAULT (datetime('now','localtime')),
  last_scan_at TEXT,
  last_min_price REAL,
  last_min_store TEXT
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ts TEXT DEFAULT (datetime('now','localtime')),
  min_price REAL,
  min_store TEXT,
  offers_count INTEGER
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  chain TEXT,
  store TEXT,
  address TEXT,
  price REAL,
  sale_desc TEXT,
  url TEXT,
  is_online INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  ts TEXT DEFAULT (datetime('now','localtime')),
  channel TEXT,
  message TEXT,
  ok INTEGER
);
`);

// מיגרציה: דגל הצלחת הסריקה האחרונה (1=הצליחה, 0=נכשלה) — כדי לא להציג "ללא שינוי" על כשל
try {
  const cols = db.prepare('PRAGMA table_info(products)').all();
  if (!cols.some(c => c.name === 'last_scan_ok')) {
    db.exec('ALTER TABLE products ADD COLUMN last_scan_ok INTEGER DEFAULT 1');
  }
} catch (e) {
  console.error('[db] migration last_scan_ok:', e.message);
}

export function getSetting(key, def = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : def;
}

export function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value ?? ''));
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
