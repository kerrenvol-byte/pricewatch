// שכבת שמירה מקומית בטלפון/בדפדפן (localStorage) — בלי שרת, בלי מחשב שצריך להיות דלוק.
// כל הנתונים נשארים על המכשיר שבו נפתחה האפליקציה.

const KEYS = { periods: 'cyclesync:periodDays', logs: 'cyclesync:dailyLogs' };

function loadPeriods() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.periods)) || [];
  } catch {
    return [];
  }
}
function savePeriods(arr) {
  localStorage.setItem(KEYS.periods, JSON.stringify(arr));
}
function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.logs)) || {};
  } catch {
    return {};
  }
}
function saveLogs(obj) {
  localStorage.setItem(KEYS.logs, JSON.stringify(obj));
}

export function getAllPeriodDates() {
  return loadPeriods()
    .map((p) => p.date)
    .sort();
}

export function isPeriodDay(date) {
  return loadPeriods().some((p) => p.date === date);
}

export function setPeriodDay(date, active, flow = 'medium') {
  const periods = loadPeriods();
  const idx = periods.findIndex((p) => p.date === date);
  if (active) {
    if (idx >= 0) periods[idx].flow = flow;
    else periods.push({ date, flow });
  } else if (idx >= 0) {
    periods.splice(idx, 1);
  }
  savePeriods(periods);
}

export function getAllLogs() {
  const logs = loadLogs();
  return Object.keys(logs)
    .sort()
    .map((date) => ({ date, ...logs[date] }));
}

export function getLog(date) {
  const logs = loadLogs();
  return logs[date] ? { date, ...logs[date] } : { date, mood: null, energy: null, appetite: null, note: null };
}

export function setLog(date, fields) {
  const logs = loadLogs();
  const existing = logs[date] || { mood: null, energy: null, appetite: null, note: null };
  const next = { ...existing };
  for (const key of ['mood', 'energy', 'appetite', 'note']) {
    if (fields[key] !== undefined) next[key] = fields[key];
  }
  logs[date] = next;
  saveLogs(logs);
  return { date, ...next };
}

export function exportAllData() {
  return { periodDays: loadPeriods(), dailyLogs: loadLogs(), exportedAt: new Date().toISOString() };
}

export function importAllData(data) {
  if (data.periodDays) savePeriods(data.periodDays);
  if (data.dailyLogs) saveLogs(data.dailyLogs);
}
