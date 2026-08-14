import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting } from './db.js';
import {
  groupPeriodsIntoCycles,
  computeCycleStats,
  getCycleInfo,
  getCycleContextForDate,
  getPhaseBoundaries,
  computePersonalPatterns,
  todayStr,
  addDays,
} from './cycleEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || getSetting('port', 3778));

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function getAllPeriodDates() {
  return db.prepare('SELECT date FROM period_days ORDER BY date ASC').all().map((r) => r.date);
}
function getAllCycles() {
  return groupPeriodsIntoCycles(getAllPeriodDates());
}
function getAllLogs() {
  return db.prepare('SELECT date, mood, energy, appetite, note FROM daily_logs ORDER BY date ASC').all();
}
const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

app.get('/api/dashboard', (req, res) => {
  const cycles = getAllCycles();
  const today = todayStr();
  const info = getCycleInfo(today, cycles);
  const todayLog = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(today) || null;
  const todayIsPeriodDay = !!db.prepare('SELECT 1 FROM period_days WHERE date = ?').get(today);
  res.json({ today, todayIsPeriodDay, todayLog, ...info });
});

app.get('/api/calendar', (req, res) => {
  const month = req.query.month;
  if (!/^\d{4}-\d{2}$/.test(month || '')) return res.status(400).json({ error: 'invalid month' });

  const cycles = getAllCycles();
  const stats = computeCycleStats(cycles);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const periodDates = new Set(getAllPeriodDates());
  const logDates = new Set(db.prepare('SELECT date FROM daily_logs').all().map((r) => r.date));
  const today = todayStr();

  const predictedPeriodDates = new Set();
  const fertileDates = new Set();
  if (stats.hasData) {
    const info = getCycleInfo(today, cycles);
    for (let i = 0; i < stats.avgPeriodLength; i++) {
      predictedPeriodDates.add(addDays(info.predictedNextPeriod, i));
    }
    let d = info.fertileWindow.start;
    while (d <= info.fertileWindow.end) {
      fertileDates.add(d);
      d = addDays(d, 1);
    }
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const ctx = getCycleContextForDate(dateStr, cycles, stats);
    days.push({
      date: dateStr,
      isPeriod: periodDates.has(dateStr),
      hasLog: logDates.has(dateStr),
      isToday: dateStr === today,
      isPredictedPeriod: predictedPeriodDates.has(dateStr),
      isFertile: fertileDates.has(dateStr),
      cycleDay: ctx?.cycleDay ?? null,
      phase: ctx?.phase ?? null,
    });
  }

  res.json({ month, days });
});

app.get('/api/history', (req, res) => {
  const cycles = getAllCycles();
  const stats = computeCycleStats(cycles);
  const cycleLengthSeries = stats.cycleLengths.map((length, i) => ({
    length,
    fromDate: cycles[i].start,
    toDate: cycles[i + 1].start,
  }));
  res.json({ cycles: [...cycles].reverse(), stats, cycleLengthSeries });
});

app.get('/api/logs', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 180);
  const start = addDays(todayStr(), -(days - 1));
  const logs = db
    .prepare('SELECT date, mood, energy, appetite, note FROM daily_logs WHERE date >= ? ORDER BY date ASC')
    .all(start);
  res.json({ start, end: todayStr(), logs });
});

app.get('/api/patterns', (req, res) => {
  const cycles = getAllCycles();
  const stats = computeCycleStats(cycles);
  const patterns = computePersonalPatterns(getAllLogs(), cycles, stats);
  const boundaries = getPhaseBoundaries(stats.avgCycleLength, stats.avgPeriodLength);
  res.json({ patterns, boundaries, avgCycleLength: stats.avgCycleLength, hasEnoughData: stats.totalCyclesLogged >= 2 });
});

app.get('/api/log/:date', (req, res) => {
  const { date } = req.params;
  if (!isDateStr(date)) return res.status(400).json({ error: 'invalid date' });
  const log = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date) || {
    date,
    mood: null,
    energy: null,
    appetite: null,
    note: null,
  };
  const isPeriod = !!db.prepare('SELECT 1 FROM period_days WHERE date = ?').get(date);
  res.json({ ...log, isPeriod });
});

app.post('/api/period-day', (req, res) => {
  const { date, active, flow } = req.body || {};
  if (!isDateStr(date)) return res.status(400).json({ error: 'invalid date' });
  if (active) {
    db.prepare(
      'INSERT INTO period_days (date, flow) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET flow = excluded.flow'
    ).run(date, flow || 'medium');
  } else {
    db.prepare('DELETE FROM period_days WHERE date = ?').run(date);
  }
  res.json({ ok: true });
});

app.post('/api/log', (req, res) => {
  const { date, mood, energy, appetite, note } = req.body || {};
  if (!isDateStr(date)) return res.status(400).json({ error: 'invalid date' });
  const existing = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date);
  const next = {
    mood: mood !== undefined ? mood : existing?.mood ?? null,
    energy: energy !== undefined ? energy : existing?.energy ?? null,
    appetite: appetite !== undefined ? appetite : existing?.appetite ?? null,
    note: note !== undefined ? note : existing?.note ?? null,
  };
  db.prepare(
    `INSERT INTO daily_logs (date, mood, energy, appetite, note, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(date) DO UPDATE SET mood=excluded.mood, energy=excluded.energy,
       appetite=excluded.appetite, note=excluded.note, updated_at=excluded.updated_at`
  ).run(date, next.mood, next.energy, next.appetite, next.note);
  res.json({ ok: true, log: { date, ...next } });
});

// יבוא חד-פעמי מקובץ ה-export.xml שאפליקציית הבריאות של אפל מייצאת (Health app -> Export All Health Data).
// אין API חי ל-HealthKit מחוץ לאפליקציה טבעית, אבל הקובץ המיוצא נגיש וניתן לניתוח כטקסט.
app.post('/api/import/health-export', express.text({ type: '*/*', limit: '300mb' }), (req, res) => {
  const xml = req.body;
  if (!xml || typeof xml !== 'string') return res.status(400).json({ error: 'no file content' });

  const recordRe = /<Record\b[^>]*\btype="HKCategoryTypeIdentifierMenstrualFlow"[^>]*\/>/g;
  const dateRe = /\bstartDate="(\d{4}-\d{2}-\d{2})/;
  const insert = db.prepare('INSERT OR IGNORE INTO period_days (date, flow) VALUES (?, ?)');

  let match;
  let found = 0;
  let imported = 0;
  db.exec('BEGIN');
  try {
    while ((match = recordRe.exec(xml))) {
      found++;
      const dateMatch = dateRe.exec(match[0]);
      if (!dateMatch) continue;
      if (insert.run(dateMatch[1], 'medium').changes > 0) imported++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'import failed', detail: e.message });
  }

  res.json({ ok: true, found, imported });
});

app.listen(PORT, () => {
  console.log(`CycleSync רץ על http://localhost:${PORT}`);
});
