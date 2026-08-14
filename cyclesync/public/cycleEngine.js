// לוגיקת המחזור: קיבוץ ימי וסת למחזורים, חישוב ממוצעים, שלב נוכחי וחיזויים.
// כל התאריכים בפורמט מחרוזת 'YYYY-MM-DD'. חשבון הימים נעשה על רכיבי התאריך
// (לא על אובייקט Date מקומי) כדי להימנע מבאגים סביב שינויי שעון קיץ.

const MS_PER_DAY = 86400000;
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

export const PHASES = {
  menstrual: { key: 'menstrual', label: 'וסת', color: '#d6336c', icon: '🩸' },
  follicular: { key: 'follicular', label: 'פוליקולרי', color: '#0aa2b0', icon: '🌱' },
  ovulatory: { key: 'ovulatory', label: 'ביוץ', color: '#d69e00', icon: '☀️' },
  luteal: { key: 'luteal', label: 'לוטאלי', color: '#7048e8', icon: '🌙' },
};

export const PHASE_GUIDANCE = {
  menstrual: {
    energy: 'נמוכה',
    appetite: 'תיאבון לנוחות, יתכן חשק לפחמימות',
    mood: 'מופנמות, זמן לנוח ולהאט',
    tips: ['מנוחה ושינה איכותית', 'תנועה עדינה כמו הליכה או יוגה', 'ברזל ומגנזיום בתזונה'],
  },
  follicular: {
    energy: 'עולה',
    appetite: 'תיאבון קליל, פתיחות לתזונה מגוונת',
    mood: 'אופטימיות, יצירתיות ומוטיבציה',
    tips: ['זמן טוב להתחלות חדשות ותכנון', 'אימונים נמרצים יותר', 'חלבון רזה לתמיכה באנרגיה'],
  },
  ovulatory: {
    energy: 'שיא האנרגיה',
    appetite: 'תיאבון מאוזן',
    mood: 'ביטחון עצמי, חברותיות ותקשורת',
    tips: ['זמן טוב לפגישות ואירועים חברתיים', 'אימוני עצימות גבוהה', 'שתייה מרובה'],
  },
  luteal: {
    energy: 'יורדת בהדרגה',
    appetite: 'עלייה בתיאבון ובחשקים',
    mood: 'רגישות, יתכן PMS לקראת הסוף השלב',
    tips: ['האטה הדרגתית באימונים', 'זמן טוב לסידור ענייני רקע', 'ויטמין B6 ומגנזיום עשויים לסייע בתסמיני PMS'],
  },
};

function toDayNum(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

function toDateStr(dayNum) {
  return new Date(dayNum * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  return toDateStr(toDayNum(dateStr) + days);
}

export function diffDays(a, b) {
  return toDayNum(a) - toDayNum(b);
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function groupPeriodsIntoCycles(periodDates) {
  if (periodDates.length === 0) return [];
  const sorted = [...new Set(periodDates)].sort();
  const groups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i], sorted[i - 1]) === 1) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);
  return groups.map((g) => ({ start: g[0], end: g[g.length - 1], length: g.length }));
}

function average(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
}

export function computeCycleStats(cycles) {
  if (cycles.length === 0) {
    return {
      hasData: false,
      lastPeriodStart: null,
      avgCycleLength: DEFAULT_CYCLE_LENGTH,
      avgPeriodLength: DEFAULT_PERIOD_LENGTH,
      cycleLengths: [],
      periodLengths: [],
      totalCyclesLogged: 0,
    };
  }

  const cycleLengths = [];
  for (let i = 1; i < cycles.length; i++) {
    cycleLengths.push(diffDays(cycles[i].start, cycles[i - 1].start));
  }
  const periodLengths = cycles.map((c) => c.length);

  return {
    hasData: true,
    lastPeriodStart: cycles[cycles.length - 1].start,
    avgCycleLength: average(cycleLengths.slice(-6)) ?? DEFAULT_CYCLE_LENGTH,
    avgPeriodLength: average(periodLengths.slice(-6)) ?? DEFAULT_PERIOD_LENGTH,
    cycleLengths,
    periodLengths,
    totalCyclesLogged: cycles.length,
  };
}

export function getPhaseBoundaries(avgCycleLength, avgPeriodLength) {
  const periodEnd = avgPeriodLength;
  let ovulationDay = avgCycleLength - 14;
  if (ovulationDay < periodEnd + 1) ovulationDay = periodEnd + 1;

  const ovulatoryStart = Math.max(periodEnd + 1, ovulationDay - 2);
  const ovulatoryEnd = Math.min(avgCycleLength, ovulationDay + 1);
  const follicularStart = periodEnd + 1;
  const follicularEnd = ovulatoryStart - 1;
  const lutealStart = ovulatoryEnd + 1;
  const lutealEnd = avgCycleLength;

  return {
    menstrual: { start: 1, end: periodEnd },
    follicular: follicularEnd >= follicularStart ? { start: follicularStart, end: follicularEnd } : null,
    ovulatory: { start: ovulatoryStart, end: ovulatoryEnd },
    luteal: lutealEnd >= lutealStart ? { start: lutealStart, end: lutealEnd } : null,
    ovulationDay,
  };
}

export function getPhaseForCycleDay(cycleDay, boundaries) {
  if (cycleDay <= boundaries.menstrual.end) return 'menstrual';
  if (boundaries.follicular && cycleDay <= boundaries.follicular.end) return 'follicular';
  if (cycleDay <= boundaries.ovulatory.end) return 'ovulatory';
  return 'luteal';
}

export function getCycleContextForDate(dateStr, cycles, stats) {
  if (!cycles.length) return null;
  let start = null;
  for (const c of cycles) {
    if (c.start <= dateStr) start = c.start;
    else break;
  }
  if (!start) return null;
  const boundaries = getPhaseBoundaries(stats.avgCycleLength, stats.avgPeriodLength);
  const cycleDay = diffDays(dateStr, start) + 1;
  return { cycleDay, phase: getPhaseForCycleDay(cycleDay, boundaries), cycleStart: start };
}

export function getCycleInfo(todayDateStr, cycles) {
  const stats = computeCycleStats(cycles);
  if (!stats.hasData) return { hasData: false, stats };

  const boundaries = getPhaseBoundaries(stats.avgCycleLength, stats.avgPeriodLength);
  const cycleDay = diffDays(todayDateStr, stats.lastPeriodStart) + 1;
  const phase = getPhaseForCycleDay(cycleDay, boundaries);
  const predictedNextPeriod = addDays(stats.lastPeriodStart, stats.avgCycleLength);
  const daysUntilNextPeriod = diffDays(predictedNextPeriod, todayDateStr);

  const fertileWindow = {
    start: addDays(stats.lastPeriodStart, boundaries.ovulatory.start - 1),
    end: addDays(stats.lastPeriodStart, boundaries.ovulatory.end - 1),
  };

  return {
    hasData: true,
    stats,
    boundaries,
    cycleDay,
    phase,
    phaseInfo: PHASES[phase],
    guidance: PHASE_GUIDANCE[phase],
    predictedNextPeriod,
    daysUntilNextPeriod,
    isLate: cycleDay > stats.avgCycleLength,
    fertileWindow,
  };
}

export function computePersonalPatterns(logs, cycles, stats) {
  if (!cycles.length) return [];
  const byCycleDay = {};
  const maxDay = stats.avgCycleLength + 7;

  for (const log of logs) {
    const ctx = getCycleContextForDate(log.date, cycles, stats);
    if (!ctx || ctx.cycleDay < 1 || ctx.cycleDay > maxDay) continue;
    const bucket = (byCycleDay[ctx.cycleDay] ??= { mood: [], energy: [], appetite: [] });
    if (log.mood != null) bucket.mood.push(log.mood);
    if (log.energy != null) bucket.energy.push(log.energy);
    if (log.appetite != null) bucket.appetite.push(log.appetite);
  }

  const avg1 = (arr) => (arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null);

  return Object.keys(byCycleDay)
    .map(Number)
    .sort((a, b) => a - b)
    .map((cycleDay) => ({
      cycleDay,
      mood: avg1(byCycleDay[cycleDay].mood),
      energy: avg1(byCycleDay[cycleDay].energy),
      appetite: avg1(byCycleDay[cycleDay].appetite),
    }));
}
