'use strict';

import * as Engine from './cycleEngine.js';
import * as Store from './store.js';

const state = {
  view: 'today',
  dashboard: null,
  calendarMonth: currentMonthStr(),
  modalDate: null,
};

const METRIC_COLORS = { mood: '#1971c2', energy: '#f08c00', appetite: '#0aa2b0' };
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const PHASE_GUIDE_DATA = [
  { label: 'וסת', icon: '🩸', color: '#d6336c', energy: 'נמוכה', appetite: 'תיאבון לנוחות, יתכן חשק לפחמימות', mood: 'מופנמות, זמן לנוח ולהאט' },
  { label: 'פוליקולרי', icon: '🌱', color: '#0aa2b0', energy: 'עולה', appetite: 'תיאבון קליל, פתיחות לתזונה מגוונת', mood: 'אופטימיות, יצירתיות ומוטיבציה' },
  { label: 'ביוץ', icon: '☀️', color: '#d69e00', energy: 'שיא האנרגיה', appetite: 'תיאבון מאוזן', mood: 'ביטחון עצמי, חברותיות ותקשורת' },
  { label: 'לוטאלי', icon: '🌙', color: '#7048e8', energy: 'יורדת בהדרגה', appetite: 'עלייה בתיאבון ובחשקים', mood: 'רגישות, יתכן PMS לקראת הסוף' },
];

// ===== Local data service (replaces what used to be server API calls) =====

function getAllCycles() {
  return Engine.groupPeriodsIntoCycles(Store.getAllPeriodDates());
}

function getDashboard() {
  const cycles = getAllCycles();
  const today = Engine.todayStr();
  const info = Engine.getCycleInfo(today, cycles);
  return { today, todayIsPeriodDay: Store.isPeriodDay(today), todayLog: Store.getLog(today), ...info };
}

function getCalendarData(month) {
  const cycles = getAllCycles();
  const stats = Engine.computeCycleStats(cycles);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const periodDates = new Set(Store.getAllPeriodDates());
  const logDates = new Set(Store.getAllLogs().map((l) => l.date));
  const today = Engine.todayStr();

  const predictedPeriodDates = new Set();
  const fertileDates = new Set();
  if (stats.hasData) {
    const info = Engine.getCycleInfo(today, cycles);
    for (let i = 0; i < stats.avgPeriodLength; i++) {
      predictedPeriodDates.add(Engine.addDays(info.predictedNextPeriod, i));
    }
    let d = info.fertileWindow.start;
    while (d <= info.fertileWindow.end) {
      fertileDates.add(d);
      d = Engine.addDays(d, 1);
    }
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const ctx = Engine.getCycleContextForDate(dateStr, cycles, stats);
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
  return { month, days };
}

function getHistoryData() {
  const cycles = getAllCycles();
  const stats = Engine.computeCycleStats(cycles);
  const cycleLengthSeries = stats.cycleLengths.map((length, i) => ({
    length,
    fromDate: cycles[i].start,
    toDate: cycles[i + 1].start,
  }));
  return { cycles: [...cycles].reverse(), stats, cycleLengthSeries };
}

function getPatternsData() {
  const cycles = getAllCycles();
  const stats = Engine.computeCycleStats(cycles);
  const patterns = Engine.computePersonalPatterns(Store.getAllLogs(), cycles, stats);
  return { patterns, avgCycleLength: stats.avgCycleLength, hasEnoughData: stats.totalCyclesLogged >= 2 };
}

function getLogsData(days = 30) {
  const start = Engine.addDays(Engine.todayStr(), -(days - 1));
  return { logs: Store.getAllLogs().filter((l) => l.date >= start) };
}

function importHealthExport(xmlText) {
  const recordRe = /<Record\b[^>]*\btype="HKCategoryTypeIdentifierMenstrualFlow"[^>]*\/>/g;
  const dateRe = /\bstartDate="(\d{4}-\d{2}-\d{2})/;
  const existing = new Set(Store.getAllPeriodDates());
  let match;
  let found = 0;
  let imported = 0;
  while ((match = recordRe.exec(xmlText))) {
    found++;
    const dateMatch = dateRe.exec(match[0]);
    if (!dateMatch) continue;
    if (!existing.has(dateMatch[1])) {
      Store.setPeriodDay(dateMatch[1], true, 'medium');
      existing.add(dateMatch[1]);
      imported++;
    }
  }
  return { found, imported };
}

// ===== Helpers =====

function todayStr() {
  return Engine.todayStr();
}
function currentMonthStr() {
  return todayStr().slice(0, 7);
}
function formatHebrewDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ב${MONTH_NAMES[m - 1]}`;
}
function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

// ===== Navigation =====

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'calendar') loadCalendar();
  if (view === 'insights') loadInsights();
  if (view === 'history') loadHistory();
}

// ===== Feedback pickers (shared between today card & calendar day modal) =====

function initPickers(root = document) {
  root.querySelectorAll('.picker').forEach((picker) => {
    if (picker.dataset.initialized) return;
    picker.dataset.initialized = '1';
    const icons = picker.dataset.icons.split(',');
    const metric = picker.dataset.metric;
    const color = METRIC_COLORS[metric];
    icons.forEach((icon, i) => {
      const val = i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-btn';
      btn.textContent = icon;
      btn.style.setProperty('--picker-color', color);
      btn.dataset.value = String(val);
      btn.addEventListener('click', () => onPickerClick(picker, metric, val));
      picker.appendChild(btn);
    });
  });
}

function renderPickers(pickerEls, log) {
  pickerEls.forEach((picker) => {
    const metric = picker.dataset.metric;
    const val = log ? log[metric] : null;
    picker.querySelectorAll('.picker-btn').forEach((btn) => {
      btn.classList.toggle('selected', Number(btn.dataset.value) === val);
    });
  });
}

function onPickerClick(picker, metric, val) {
  const current = picker.querySelector('.picker-btn.selected');
  const isModal = !!picker.closest('#dayModal');
  const date = isModal ? state.modalDate : todayStr();
  const alreadySelected = current && Number(current.dataset.value) === val;
  const newVal = alreadySelected ? null : val;

  picker.querySelectorAll('.picker-btn').forEach((btn) => {
    btn.classList.toggle('selected', Number(btn.dataset.value) === newVal);
  });

  Store.setLog(date, { [metric]: newVal });
  showToast('נשמר ✓');

  if (!isModal && state.dashboard) {
    state.dashboard.todayLog = { ...(state.dashboard.todayLog || { date }), [metric]: newVal };
  }
}

// ===== Today =====

function loadDashboard() {
  const data = getDashboard();
  state.dashboard = data;
  renderToday(data);
}

function renderToday(data) {
  const onboarding = document.getElementById('onboarding');
  const content = document.getElementById('todayContent');

  if (!data.hasData) {
    onboarding.classList.remove('hidden');
    content.classList.add('hidden');
    document.getElementById('onboardingDate').value = data.today;
    return;
  }
  onboarding.classList.add('hidden');
  content.classList.remove('hidden');

  const { boundaries, stats, cycleDay, phaseInfo, guidance, predictedNextPeriod, daysUntilNextPeriod, isLate } = data;
  const total = stats.avgCycleLength;

  document.getElementById('ringDay').textContent = cycleDay;
  document.getElementById('ringTotal').textContent = `מתוך כ-${total} ימים`;
  const phaseEl = document.getElementById('ringPhase');
  phaseEl.textContent = `${phaseInfo.icon} ${phaseInfo.label}`;
  phaseEl.style.background = phaseInfo.color + '22';
  phaseEl.style.color = phaseInfo.color;

  const ring = document.getElementById('cycleRing');
  const p1 = (boundaries.menstrual.end / total) * 100;
  const p2 = (boundaries.follicular ? boundaries.follicular.end : boundaries.menstrual.end) / total * 100;
  const p3 = (boundaries.ovulatory.end / total) * 100;
  ring.style.setProperty('--p1', p1 + '%');
  ring.style.setProperty('--p2', p2 + '%');
  ring.style.setProperty('--p3', p3 + '%');

  const oldMarker = ring.querySelector('.ring-marker');
  if (oldMarker) oldMarker.remove();
  const marker = document.createElement('div');
  marker.className = 'ring-marker';
  const clampedDay = Math.min(cycleDay, total);
  marker.style.setProperty('--marker-deg', (clampedDay / total) * 360 + 'deg');
  marker.style.setProperty('--marker-color', phaseInfo.color);
  ring.appendChild(marker);

  const predEl = document.getElementById('predictionText');
  if (isLate) {
    predEl.innerHTML = `הווסת מאחרת ב-<strong>${cycleDay - total}</strong> ימים מהצפי`;
  } else if (daysUntilNextPeriod <= 0) {
    predEl.innerHTML = `הווסת הבאה צפויה <strong>היום</strong>`;
  } else {
    predEl.innerHTML = `הווסת הבאה צפויה בעוד <strong>${daysUntilNextPeriod}</strong> ימים · ${formatHebrewDate(predictedNextPeriod)}`;
  }

  const periodBtn = document.getElementById('periodToggle');
  periodBtn.classList.toggle('active', data.todayIsPeriodDay);
  document.getElementById('periodToggleLabel').textContent = data.todayIsPeriodDay ? 'היום יום וסת ✓' : 'היום יום וסת?';

  document.getElementById('guidancePhaseTitle').textContent = `שלב ה${phaseInfo.label} ${phaseInfo.icon}`;
  document.getElementById('guidanceEnergy').textContent = guidance.energy;
  document.getElementById('guidanceAppetite').textContent = guidance.appetite;
  document.getElementById('guidanceMood').textContent = guidance.mood;
  const tipsEl = document.getElementById('guidanceTips');
  tipsEl.innerHTML = '';
  guidance.tips.forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    tipsEl.appendChild(li);
  });

  renderPickers(document.querySelectorAll('#todayContent .picker'), data.todayLog);
  document.getElementById('noteInput').value = (data.todayLog && data.todayLog.note) || '';
}

// ===== Calendar =====

function loadCalendar() {
  renderCalendar(getCalendarData(state.calendarMonth));
}

function renderCalendar(data) {
  const [y, m] = data.month.split('-').map(Number);
  document.getElementById('monthLabel').textContent = `${MONTH_NAMES[m - 1]} ${y}`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const firstDay = new Date(y, m - 1, 1).getDay();
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    grid.appendChild(empty);
  }

  data.days.forEach((day) => {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (day.isToday) cell.classList.add('today');
    if (day.isPeriod) cell.classList.add('period');
    if (day.isPredictedPeriod && !day.isPeriod) cell.classList.add('predicted');
    if (day.isFertile) cell.classList.add('fertile');
    if (day.hasLog) cell.classList.add('has-log');
    cell.textContent = String(Number(day.date.slice(-2)));
    cell.addEventListener('click', () => openDayModal(day.date));
    grid.appendChild(cell);
  });
}

function shiftMonth(delta) {
  let [y, m] = state.calendarMonth.split('-').map(Number);
  m += delta;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  state.calendarMonth = `${y}-${String(m).padStart(2, '0')}`;
  loadCalendar();
}

function openDayModal(date) {
  state.modalDate = date;
  document.getElementById('dayModalDate').textContent = formatHebrewDate(date);
  const log = { ...Store.getLog(date), isPeriod: Store.isPeriodDay(date) };
  const btn = document.getElementById('dayModalPeriodToggle');
  btn.classList.toggle('active', log.isPeriod);
  document.getElementById('dayModalPeriodLabel').textContent = log.isPeriod ? 'יום וסת ✓' : 'יום וסת';
  renderPickers(document.querySelectorAll('#dayModal .picker'), log);
  document.getElementById('dayModal').classList.remove('hidden');
}

function closeDayModal() {
  document.getElementById('dayModal').classList.add('hidden');
  const wasToday = state.modalDate === todayStr();
  state.modalDate = null;
  loadCalendar();
  if (wasToday) loadDashboard();
}

// ===== Insights =====

let trendChartInstance, patternsChartInstance, lengthChartInstance;

function metricDataset(label, data, color) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 4,
    pointBackgroundColor: color,
    tension: 0.3,
    spanGaps: true,
  };
}

function baseChartOptions(min, max) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min,
        max,
        ticks: { stepSize: 1, color: '#8a7480', font: { family: 'Rubik', size: 11 } },
        grid: { color: '#f5dde6' },
      },
      x: {
        ticks: { color: '#8a7480', font: { family: 'Rubik', size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { position: 'top', labels: { color: '#2b1e26', font: { family: 'Rubik', weight: '600', size: 12 }, usePointStyle: true, boxWidth: 8 } },
      tooltip: { titleFont: { family: 'Rubik' }, bodyFont: { family: 'Rubik' } },
    },
  };
}

function loadInsights() {
  renderPhaseGuide();
  if (typeof Chart === 'undefined') return; // אין אינטרנט כרגע — שאר האפליקציה ממשיכה לעבוד
  renderTrendChart(getLogsData(30));
  renderPatternsChart(getPatternsData());
  renderLengthChart(getHistoryData());
}

function renderTrendChart(data) {
  const ctx = document.getElementById('trendChart');
  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.logs.map((l) => formatShortDate(l.date)),
      datasets: [
        metricDataset('מצב רוח', data.logs.map((l) => l.mood), METRIC_COLORS.mood),
        metricDataset('אנרגיה', data.logs.map((l) => l.energy), METRIC_COLORS.energy),
        metricDataset('תיאבון', data.logs.map((l) => l.appetite), METRIC_COLORS.appetite),
      ],
    },
    options: baseChartOptions(1, 5),
  });
}

function renderPatternsChart(data) {
  const wrap = document.getElementById('patternsChartWrap');
  const empty = document.getElementById('patternsEmpty');
  if (!data.hasEnoughData || !data.patterns.length) {
    wrap.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  empty.classList.add('hidden');
  const ctx = document.getElementById('patternsChart');
  if (patternsChartInstance) patternsChartInstance.destroy();
  patternsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.patterns.map((p) => p.cycleDay),
      datasets: [
        metricDataset('מצב רוח', data.patterns.map((p) => p.mood), METRIC_COLORS.mood),
        metricDataset('אנרגיה', data.patterns.map((p) => p.energy), METRIC_COLORS.energy),
        metricDataset('תיאבון', data.patterns.map((p) => p.appetite), METRIC_COLORS.appetite),
      ],
    },
    options: baseChartOptions(1, 5),
  });
}

function renderLengthChart(data) {
  const ctx = document.getElementById('lengthChart');
  if (lengthChartInstance) lengthChartInstance.destroy();
  const series = data.cycleLengthSeries || [];
  lengthChartInstance = new Chart(ctx, {
    data: {
      labels: series.map((s) => formatShortDate(s.fromDate)),
      datasets: [
        { type: 'bar', label: 'אורך מחזור', data: series.map((s) => s.length), backgroundColor: '#e8487a', borderRadius: 8, maxBarThickness: 28 },
        { type: 'line', label: 'ממוצע', data: series.map(() => data.stats.avgCycleLength), borderColor: '#8a7480', borderDash: [6, 4], pointRadius: 0, borderWidth: 2 },
      ],
    },
    options: baseChartOptions(undefined, undefined),
  });
}

function renderPhaseGuide() {
  const el = document.getElementById('phaseGuide');
  if (el.dataset.rendered) return;
  el.dataset.rendered = '1';
  el.innerHTML = '';
  PHASE_GUIDE_DATA.forEach((p) => {
    const div = document.createElement('div');
    div.className = 'phase-guide-item';
    div.style.setProperty('--pg-color', p.color);
    div.innerHTML = `<div class="pg-title">${p.icon} ${p.label}</div><div class="pg-desc">⚡ ${p.energy} · 🍽️ ${p.appetite} · 💭 ${p.mood}</div>`;
    el.appendChild(div);
  });
}

// ===== History =====

function loadHistory() {
  renderHistory(getHistoryData());
}

function renderHistory(data) {
  const s = data.stats;
  const rangeText = s.cycleLengths.length ? `${Math.min(...s.cycleLengths)}–${Math.max(...s.cycleLengths)}` : '–';
  document.getElementById('statsCard').innerHTML = `
    <div class="stat-item"><div class="stat-value">${s.avgCycleLength}</div><div class="stat-label">אורך מחזור ממוצע</div></div>
    <div class="stat-item"><div class="stat-value">${s.avgPeriodLength}</div><div class="stat-label">אורך וסת ממוצע</div></div>
    <div class="stat-item"><div class="stat-value">${s.totalCyclesLogged}</div><div class="stat-label">מחזורים שתועדו</div></div>
    <div class="stat-item"><div class="stat-value">${rangeText}</div><div class="stat-label">טווח אורך מחזור</div></div>
  `;

  const list = document.getElementById('cyclesList');
  list.innerHTML = '';
  if (!data.cycles.length) {
    list.innerHTML = '<p class="muted small">עדיין לא תועדו מחזורים.</p>';
    return;
  }
  data.cycles.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'cycle-row';
    row.innerHTML = `<span class="cycle-row-dates">${formatHebrewDate(c.start)}</span><span class="cycle-row-length">${c.length} ימי וסת</span>`;
    list.appendChild(row);
  });
}

// ===== Apple Health export import =====

async function handleHealthFile(file) {
  const statusEl = document.getElementById('importStatus');
  statusEl.classList.remove('hidden');

  if (file.name.toLowerCase().endsWith('.zip')) {
    statusEl.textContent = 'זהו קובץ zip — יש לחלץ אותו קודם ולבחור את export.xml שבפנים';
    return;
  }

  statusEl.textContent = 'קוראת ומייבאת...';
  try {
    const text = await file.text();
    const result = importHealthExport(text);
    if (result.found === 0) {
      statusEl.textContent = 'לא נמצאו רשומות וסת בקובץ הזה';
    } else {
      statusEl.textContent = `נמצאו ${result.found} רשומות, יובאו ${result.imported} ימים חדשים 🎉`;
      showToast('הייבוא הושלם');
    }
    loadDashboard();
    if (state.view === 'history') loadHistory();
  } catch (err) {
    statusEl.textContent = 'שגיאה בייבוא הקובץ. ודאי שבחרת את קובץ export.xml.';
  }
}

// ===== Backup / restore (הנתונים נשמרים רק על המכשיר הזה — חשוב לגבות מדי פעם) =====

function downloadBackup() {
  const data = Store.exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cyclesync-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('הגיבוי הורד ✓');
}

async function restoreBackup(file) {
  const statusEl = document.getElementById('backupStatus');
  statusEl.classList.remove('hidden');
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.periodDays || !data.dailyLogs) throw new Error('invalid backup file');
    Store.importAllData(data);
    statusEl.textContent = 'השחזור הושלם 🎉';
    showToast('הנתונים שוחזרו');
    loadDashboard();
    if (state.view === 'history') loadHistory();
  } catch (err) {
    statusEl.textContent = 'קובץ הגיבוי לא תקין';
  }
}

// ===== Init =====

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topbarDate').textContent = formatHebrewDate(todayStr());
  initPickers();

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('periodToggle').addEventListener('click', () => {
    const willBeActive = !state.dashboard.todayIsPeriodDay;
    Store.setPeriodDay(todayStr(), willBeActive);
    showToast(willBeActive ? 'סומן כיום וסת 🩸' : 'הוסר סימון יום וסת');
    loadDashboard();
  });

  document.getElementById('noteToggle').addEventListener('click', () => {
    document.getElementById('noteInput').classList.toggle('hidden');
  });
  let noteDebounce;
  document.getElementById('noteInput').addEventListener('input', (e) => {
    clearTimeout(noteDebounce);
    const value = e.target.value;
    noteDebounce = setTimeout(() => Store.setLog(todayStr(), { note: value }), 500);
  });

  document.getElementById('onboardingStart').addEventListener('click', () => {
    const date = document.getElementById('onboardingDate').value;
    if (!date) return showToast('בחרי תאריך');
    Store.setPeriodDay(date, true);
    showToast('התחלנו לעקוב 🌸');
    loadDashboard();
  });
  document.getElementById('onboardingImport').addEventListener('click', () => {
    switchView('history');
    setTimeout(() => document.getElementById('healthFileInput').click(), 150);
  });

  document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));

  document.getElementById('dayModalClose').addEventListener('click', closeDayModal);
  document.getElementById('dayModal').addEventListener('click', (e) => {
    if (e.target.id === 'dayModal') closeDayModal();
  });
  document.getElementById('dayModalPeriodToggle').addEventListener('click', () => {
    const btn = document.getElementById('dayModalPeriodToggle');
    const willBeActive = !btn.classList.contains('active');
    Store.setPeriodDay(state.modalDate, willBeActive);
    btn.classList.toggle('active', willBeActive);
    document.getElementById('dayModalPeriodLabel').textContent = willBeActive ? 'יום וסת ✓' : 'יום וסת';
  });

  document.getElementById('healthImportBtn').addEventListener('click', () => {
    document.getElementById('healthFileInput').click();
  });
  document.getElementById('healthFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleHealthFile(file);
  });

  document.getElementById('downloadBackupBtn').addEventListener('click', downloadBackup);
  document.getElementById('restoreBackupBtn').addEventListener('click', () => {
    document.getElementById('restoreFileInput').click();
  });
  document.getElementById('restoreFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) restoreBackup(file);
  });

  loadDashboard();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
