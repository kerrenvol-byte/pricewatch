// PriceWatch — לוגיקת ממשק
import { createSearchController } from './search-state.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const INTERVALS = [
  [60, 'כל שעה'], [180, 'כל 3 שעות'], [360, 'כל 6 שעות'],
  [720, 'כל 12 שעות'], [1440, 'כל יום'], [10080, 'כל שבוע'], [0, 'ללא סריקה אוטומטית'],
];

function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => t.style.display = 'none', ms);
}

async function api(url, opts = {}) {
  if (opts.body && typeof opts.body === 'object') {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
  return data;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPrice = p => '₪' + Number(p).toLocaleString('he-IL', { maximumFractionDigits: 2 });

// ---------- טאבים ----------
$$('nav button').forEach(btn => btn.addEventListener('click', () => {
  $$('nav button').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
    b.tabIndex = -1;
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  btn.tabIndex = 0;
  $$('main > section').forEach(s => { s.hidden = true; });
  const panel = $('#tab-' + btn.dataset.tab);
  panel.hidden = false;
  if (btn.dataset.tab === 'tracked') loadTracked();
  if (btn.dataset.tab === 'settings') loadSettings();
}));

// ניווט במקלדת בין הטאבים (חיצים), לפי תבנית ARIA tablist
$('nav').addEventListener('keydown', e => {
  const tabs = [...$$('nav button')];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  let next = null;
  if (e.key === 'ArrowLeft') next = tabs[(i + 1) % tabs.length];        // RTL: שמאל = הבא
  else if (e.key === 'ArrowRight') next = tabs[(i - 1 + tabs.length) % tabs.length];
  else if (e.key === 'Home') next = tabs[0];
  else if (e.key === 'End') next = tabs[tabs.length - 1];
  if (next) { e.preventDefault(); next.focus(); next.click(); }
});

// ---------- חיפוש ----------
let lastCandidate = null;

function showCandidates(visible) {
  const box = $('#candidates');
  box.hidden = !visible;
  box.style.display = visible ? '' : 'none';
  box.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setStatusCard(html, tone = '') {
  $('#searchStatus').innerHTML = html
    ? `<div class="card"${tone ? ` style="color:var(--${tone})"` : ''}>${html}</div>`
    : '';
}

// מכונת המצבים משותפת עם הבדיקות (public/search-state.js)
const searchView = createSearchController({
  fetchSearch: q => api('/api/search?q=' + encodeURIComponent(q)),
  view: {
    showCandidates,
    setCandidatesHtml: html => { $('#candidates').innerHTML = html; },
    setSearchDisabled: d => {
      $('#btnSearch').disabled = d;
      $('#btnSearch').textContent = d ? 'מחפש…' : 'חיפוש';
    },
    clearCompare: () => {
      compareSeq++;                       // מבטל טעינת השוואה שרצה ברקע
      $('#compareResults').innerHTML = '';
    },
    renderResults: (results, q) => buildCandidatesHtml(results, q),
    setStatus: msg => {
      if (!msg) return setStatusCard('');
      if (searchView.state === 'loading') {
        return setStatusCard(`<span class="spinner"></span> מחפש "${esc(searchView.lastQuery)}" במאגר המזון/פארם ובחנויות האלקטרוניקה… (עד ~20 שניות)`);
      }
      if (searchView.state === 'empty') {
        return setStatusCard(`לא נמצאו תוצאות ל"${esc(searchView.lastQuery)}".<br>
          <span class="hint">נסי ניסוח אחר, שם מותג, או הקלדת ברקוד מדויק (13 ספרות).</span>`);
      }
      if (searchView.state === 'error') {
        setStatusCard(`${esc(msg)}
          <div style="margin-top:10px"><button class="btn small" type="button" id="btnRetrySearch">נסי שוב</button></div>`, 'red');
        $('#btnRetrySearch')?.addEventListener('click', () => doSearch());
        return;
      }
      // הודעות ה'partial' כבר מכילות HTML בטוח שנבנה על ידינו (ניסוח חלופי / מקור שנכשל)
      setStatusCard(msg);
    },
    onState: state => {
      // אחרי רינדור התוצאות צריך לחבר את מאזיני הלחיצה
      if (state === 'success' || state === 'partial') bindCandidateClicks();
    },
  },
});

$('#btnSearch').addEventListener('click', () => doSearch());
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

function doSearch() {
  return searchView.search($('#q').value);
}

function buildCandidatesHtml(results, q) {
  const groceries = results.grocery || [];
  const zaps = results.zap || [];
  let html = '';

  if (groceries.length) {
    html += `<h2 class="section-title">🛒 מזון ופארם (${groceries.length} מוצרים)</h2>`;
    html += groceries.map((c, i) => `
      <div class="candidate" data-kind="grocery" data-i="${i}">
        ${c.image ? `<img src="${c.image}" alt="">` : '<div class="candicon" aria-hidden="true">🛒</div>'}
        <div class="meta">
          <div class="name" id="cand-g-${i}">${esc(c.name)}</div>
          <div class="sub">${esc(c.manufacturer)} · ברקוד ${esc(c.barcode)}</div>
        </div>
        <button class="btn small secondary" type="button" aria-label="השוואת מחירים עבור ${esc(c.name)}">💰 השווה מחיר</button>
      </div>`).join('');
  }
  if (zaps.length) {
    html += `<h2 class="section-title">💻 אלקטרוניקה, סלולר וחשמל (${zaps.length} דגמים)</h2>`;
    html += zaps.map((c, i) => `
      <div class="candidate" data-kind="zap" data-i="${i}">
        <div class="candicon zap" aria-hidden="true">💻</div>
        <div class="meta">
          <div class="name" id="cand-z-${i}">${esc(c.name)}</div>
          <div class="sub">זאפ · דגם ${esc(c.modelId)}</div>
        </div>
        ${c.fromPrice ? `<div class="from">החל מ-${fmtPrice(c.fromPrice)}</div>` : ''}
        <button class="btn small secondary" type="button" aria-label="השוואת מחירים עבור ${esc(c.name)}">💰 השווה מחיר</button>
      </div>`).join('');
  }
  return html;
}

function bindCandidateClicks() {
  const box = $('#candidates');
  const { grocery = [], zap = [] } = searchView.results;
  box.querySelectorAll('.candidate').forEach(el => {
    const open = () => {
      const kind = el.dataset.kind;
      const c = kind === 'grocery' ? grocery[el.dataset.i] : zap[el.dataset.i];
      if (c) compare(kind, c);
    };
    el.addEventListener('click', open);
    el.querySelector('.btn')?.addEventListener('click', ev => { ev.stopPropagation(); open(); });
  });
}

let compareSeq = 0;
let lastStoresInfo = { searched: [], failed: [] };
async function compare(kind, c) {
  lastCandidate = { kind, ...c };
  const seq = ++compareSeq;
  $('#compareResults').innerHTML = `<div class="card"><span class="spinner"></span> טוען מחירים עבור ${esc(c.name)}…</div>`;
  try {
    const id = kind === 'grocery' ? c.id : c.modelId;
    const r = await api(`/api/compare/${kind}?id=${encodeURIComponent(id)}`);
    if (seq !== compareSeq) return;
    renderCompare(kind, c, r, kind === 'zap' ? 'loading' : 'done');
    // ההשוואה מוצגת למעלה במקום הרשימה — בלי צורך לגלול
    showCandidates(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // אלקטרוניקה: החנויות הישירות נטענות ברקע ומצטרפות לטבלה
    if (kind === 'zap') {
      try {
        const s = await api('/api/compare/stores?name=' + encodeURIComponent(r.name || c.name || ''));
        if (seq !== compareSeq) return;
        lastStoresInfo = { searched: s.searched || [], failed: s.failed || [] };
        if (s.offers?.length) {
          r.offers = [...(r.offers || []), ...s.offers].sort((a, b) => a.price - b.price);
          renderCompare(kind, c, r, 'added:' + s.offers.length);
        } else {
          renderCompare(kind, c, r, 'none');
        }
      } catch {
        if (seq === compareSeq) renderCompare(kind, c, r, 'failed');
      }
    }
  } catch (e) {
    if (seq === compareSeq) $('#compareResults').innerHTML = `<div class="card" style="color:var(--red)">שגיאה: ${esc(e.message)}</div>`;
  }
}

function offersTable(offers, captionText = 'מחירים ממוינים מהזול ליקר') {
  if (!offers?.length) return '<div class="empty">לא נמצאו מחירים למוצר הזה כרגע</div>';
  // מיון מספרי מפורש — לא הסתמכות על סדר מהשרת ולא השוואת מחרוזות
  const sorted = [...offers]
    .map(o => ({ ...o, price: Number(o.price) }))
    .filter(o => Number.isFinite(o.price))
    .sort((a, b) => a.price - b.price);
  if (!sorted.length) return '<div class="empty">לא נמצאו מחירים למוצר הזה כרגע</div>';
  const best = sorted[0].price;
  return `<div class="table-wrap"><table class="prices">
    <caption class="sr-only">${esc(captionText)} — ${sorted.length} תוצאות</caption>
    <thead>
      <tr>
        <th scope="col">דירוג</th>
        <th scope="col">רשת / חנות</th>
        <th scope="col">סניף / כתובת</th>
        <th scope="col">סוג</th>
        <th scope="col">מחיר</th>
      </tr>
    </thead>
    <tbody>
    ${sorted.map((o, i) => `
      <tr class="${i === 0 ? 'best' : ''}">
        <td data-label="דירוג">${i === 0 ? '<span class="badge best">הכי זול</span>' : (i + 1)}</td>
        <td data-label="רשת / חנות"><b>${esc(o.chain)}</b>${o.store && o.store !== o.chain ? '<br><small>' + esc(o.store) + '</small>' : ''}</td>
        <td data-label="סניף / כתובת" class="addr-cell">${esc(o.address || '')}${o.sale_desc ? ` <span class="badge sale" title="${esc(o.sale_desc)}">מבצע</span>` : ''}</td>
        <td data-label="סוג">${o.is_online ? '<span class="badge online">אונליין</span>' : '<span class="badge store">סניף</span>'}</td>
        <td data-label="מחיר" class="price-val" style="${o.price === best ? 'color:var(--green)' : ''}">${fmtPrice(o.price)}${o.url ? ` <a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer" aria-label="מעבר לחנות ${esc(o.chain)}">🔗</a>` : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function renderCompare(kind, c, r, storesState = 'done') {
  const offers = r.offers || [];
  const name = r.productName || r.name || c.name;
  const ALL_STORES = 'KSP, מחסני חשמל, שקם אלקטריק, באג, גוד פארם, LastPrice, ACE, עולם הקולנוע, איבורי ואלם';
  const okList = lastStoresInfo.searched.join(', ');
  const failList = lastStoresInfo.failed.join(', ');
  // חנות שנכשלה מדווחת בנפרד — לעולם לא נאמר "לא נמצא אצלה" על חנות שלא הגיבה
  const failNote = failList
    ? `<div class="hint" style="margin-top:4px;color:#b45309">⚠️ לא הצלחנו לבדוק כרגע: ${esc(failList)} — ייתכן שהמוצר קיים שם. כדאי לנסות שוב מאוחר יותר.</div>`
    : '';

  let storesLine = '';
  if (storesState === 'loading') {
    storesLine = `<div class="hint" style="margin-top:4px"><span class="spinner"></span> בודק גם ב-${ALL_STORES}… (עד חצי דקה, הטבלה תתעדכן לבד)</div>`;
  } else if (storesState === 'failed') {
    storesLine = `<div class="hint" style="margin-top:4px;color:#b45309">⚠️ בדיקת החנויות הישירות נכשלה הפעם — מוצגות תוצאות זאפ בלבד. נסי שוב בעוד רגע.</div>`;
  } else if (storesState === 'none') {
    storesLine = `<div class="hint" style="margin-top:4px">✓ נבדקו: ${esc(okList || ALL_STORES)} — הדגם המדויק לא נמצא אצלן כרגע</div>${failNote}`;
  } else if (String(storesState).startsWith('added:')) {
    storesLine = `<div class="hint" style="margin-top:4px;color:#15803d">✓ נוספו ${storesState.slice(6)} מחירים מהחנויות הישירות (נבדקו: ${esc(okList)})</div>${failNote}`;
  }
  $('#compareResults').innerHTML = `
    <button class="btn small secondary" id="btnBackToResults" style="margin-bottom:10px">→ חזרה לתוצאות החיפוש</button>
    <div class="card">
      <div class="product-head">
        ${c.image ? `<img src="${c.image}">` : ''}
        <div class="grow">
          <div class="pname">${esc(name)}</div>
          <div class="pmeta">${offers.length} מחירים נמצאו${r.city ? ' · אזור: ' + esc(r.city) : ''} · ממוין מהזול ליקר</div>
          ${storesLine}
        </div>
        <button class="btn" type="button" id="btnTrack" aria-expanded="false" aria-controls="trackForm">📌 שמירה למעקב</button>
      </div>
      <div id="trackForm" hidden style="background:var(--accent-soft);border-radius:10px;padding:14px">
        <div class="controls">
          <label for="trackInterval">סריקה אוטומטית:</label>
          <select id="trackInterval">${INTERVALS.map(([v, l]) => `<option value="${v}" ${v === 1440 ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label for="trackNotify">התראה כאשר:</label>
          <select id="trackNotify">
            <option value="drop" selected>המחיר יורד</option>
            <option value="change">כל שינוי מחיר</option>
            <option value="off">ללא התראות</option>
          </select>
          <label for="trackTarget">או מתחת ל-:</label>
          <input type="number" id="trackTarget" placeholder="₪ יעד" step="0.1" inputmode="decimal">
          <button class="btn small" type="button" id="btnTrackConfirm">✓ התחלת מעקב</button>
        </div>
      </div>
      ${offersTable(offers)}
    </div>`;

  $('#btnBackToResults').addEventListener('click', () => {
    compareSeq++; // מבטל טעינת חנויות שעדיין רצה ברקע
    $('#compareResults').innerHTML = '';
    // חוזרים לרשימה רק אם באמת יש תוצאות להציג
    const hasResults = (searchView.results.grocery?.length || 0) + (searchView.results.zap?.length || 0) > 0;
    showCandidates(hasResults);
    $('#q').focus();
  });
  $('#btnTrack').addEventListener('click', ev => {
    const f = $('#trackForm');
    f.hidden = !f.hidden;
    ev.currentTarget.setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden) $('#trackInterval').focus();
  });
  $('#btnTrackConfirm').addEventListener('click', async () => {
    try {
      await api('/api/products', { method: 'POST', body: {
        kind,
        name,
        barcode: kind === 'grocery' ? c.id : c.modelId,
        query: $('#q').value.trim(),
        image: c.image || null,
        interval_minutes: parseInt($('#trackInterval').value, 10),
        notify_mode: $('#trackNotify').value,
        target_price: $('#trackTarget').value ? parseFloat($('#trackTarget').value) : null,
      }});
      toast('✅ המוצר נשמר למעקב! הסריקה הראשונה רצה עכשיו');
      refreshTrackedCount();
      $('#trackForm').style.display = 'none';
    } catch (e) { toast('⚠️ ' + e.message); }
  });
}

// ---------- חיפוש בתמונה ----------
// זיהוי ברקוד מתמונה בדפדפן עצמו — חינם, בלי מפתח API
async function detectBarcodeLocally(file) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    const bmp = await createImageBitmap(file);
    const codes = await detector.detect(bmp);
    return codes.length ? codes[0].rawValue : null;
  } catch { return null; }
}

// כפתור אמיתי שמפעיל את קלט הקובץ — נגיש עם Tab, Enter ו-Space כברירת מחדל
$('#btnImgSearch').addEventListener('click', () => $('#imgInput').click());

$('#imgInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  $('#searchStatus').innerHTML = `<div class="card"><span class="spinner"></span> מזהה את המוצר בתמונה…</div>`;
  try {
    // שלב 1: ברקוד בתמונה? מזוהה מקומית ומחפש במדויק
    const barcode = await detectBarcodeLocally(file);
    if (barcode) {
      toast(`✅ זוהה ברקוד: ${barcode}`);
      $('#q').value = barcode;
      doSearch();
      e.target.value = '';
      return;
    }
    // שלב 2: זיהוי חכם דרך Claude — רק אם הוגדר מפתח API
    const b64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result.split(',')[1]);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    const r = await api('/api/identify-image', { method: 'POST', body: { image: b64, mediaType: file.type || 'image/jpeg' } });
    const q = r.barcode || r.name || r.name_en;
    if (!q) throw new Error('לא זוהה מוצר בתמונה');
    toast(`זוהה: ${r.name || r.name_en}${r.barcode ? ' (ברקוד ' + r.barcode + ')' : ''}`);
    $('#q').value = q;
    doSearch();
  } catch (err) {
    const noKey = /מפתח/.test(err.message);
    $('#searchStatus').innerHTML = `<div class="card" style="color:var(--red)">⚠️ ${noKey
      ? 'לא נמצא ברקוד בתמונה. טיפ: צלמי את <b>הברקוד</b> של המוצר מקרוב — זה עובד בלי שום הגדרה. לזיהוי מוצר לפי מראה (בלי ברקוד) צריך מפתח API בהגדרות.'
      : esc(err.message)}</div>`;
  }
  e.target.value = '';
});

// ---------- מוצרים במעקב ----------
async function refreshTrackedCount() {
  try {
    const products = await api('/api/products');
    $('#trackedCount').textContent = products.length ? `(${products.length})` : '';
  } catch {}
}

function sparkline(history, productName = '') {
  if (!history || history.length < 2) return '';
  const prices = history.map(h => h.min_price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W = 500, H = 40;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * W},${H - 4 - ((p - min) / range) * (H - 8)}`).join(' ');
  const desc = `גרף מחירים${productName ? ' עבור ' + productName : ''}: ${prices.length} סריקות, הנמוך ${fmtPrice(min)}, הגבוה ${fmtPrice(max)}`;
  return `<svg class="sparkline" viewBox="0 0 ${W} ${H + 6}" preserveAspectRatio="none" role="img" aria-label="${esc(desc)}">
    <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2.5"/>
  </svg>`;
}

async function loadTracked() {
  const box = $('#trackedList');
  box.innerHTML = `<div class="card"><span class="spinner"></span> טוען מוצרים במעקב…</div>`;
  let products;
  try {
    products = await api('/api/products');
  } catch (e) {
    box.innerHTML = `<div class="card" style="color:var(--red)">⚠️ טעינת המוצרים נכשלה. ${esc(e.message)}
      <div style="margin-top:10px"><button class="btn small" type="button" id="btnRetryTracked">נסי שוב</button></div></div>`;
    $('#btnRetryTracked')?.addEventListener('click', loadTracked);
    return;
  }
  $('#trackedCount').textContent = products.length ? `(${products.length})` : '';
  if (!products.length) {
    box.innerHTML = `<div class="card empty">אין עדיין מוצרים במעקב.<br>חפשי מוצר בטאב החיפוש ולחצי "שמירה למעקב" 📌</div>`;
    return;
  }
  box.innerHTML = products.map(p => {
    const h = p.history || [];
    const trend = h.length >= 2 ? h[h.length - 1].min_price - h[h.length - 2].min_price : 0;
    const nm = esc(p.name);           // לשימוש בתוך aria-label
    const scanFailed = p.last_scan_ok === 0;
    let statusLine;
    if (!p.last_scan_at) statusLine = 'טרם נסרק';
    else if (scanFailed) statusLine = `<b class="trend-up">⚠️ הסריקה האחרונה נכשלה — מוצג המחיר האחרון שנמצא</b>`;
    else if (trend !== 0) statusLine = `<b class="${trend > 0 ? 'trend-up' : 'trend-down'}">${trend > 0 ? '▲' : '▼'} ${fmtPrice(Math.abs(trend))} מהסריקה הקודמת</b>`;
    else statusLine = 'ללא שינוי';

    return `
    <div class="card product-card" data-id="${p.id}">
      <div class="product-head">
        ${p.image ? `<img src="${p.image}" alt="">` : ''}
        <div class="grow">
          <h2 class="pname" id="prod-${p.id}-name">${p.kind === 'grocery' ? '🛒' : '💻'} ${nm}</h2>
          <div class="pmeta">
            סריקה אחרונה: ${p.last_scan_at ? esc(p.last_scan_at) : '—'} · ${statusLine}
          </div>
        </div>
        <div class="bigprice">
          ${p.last_min_price != null ? fmtPrice(p.last_min_price) : '—'}
          <span class="at">${esc(p.last_min_store || '')}</span>
        </div>
      </div>
      ${sparkline(h, p.name)}
      <div class="controls">
        <label class="sr-only" for="int-${p.id}">תדירות סריקה עבור ${nm}</label>
        <select class="cInterval" id="int-${p.id}">${INTERVALS.map(([v, l]) => `<option value="${v}" ${v === p.interval_minutes ? 'selected' : ''}>${l}</option>`).join('')}</select>

        <label class="sr-only" for="notify-${p.id}">סוג התראה עבור ${nm}</label>
        <select class="cNotify" id="notify-${p.id}">
          <option value="drop" ${p.notify_mode === 'drop' ? 'selected' : ''}>התראה בירידת מחיר</option>
          <option value="change" ${p.notify_mode === 'change' ? 'selected' : ''}>התראה בכל שינוי</option>
          <option value="off" ${p.notify_mode === 'off' ? 'selected' : ''}>ללא התראות</option>
        </select>

        <label class="sr-only" for="target-${p.id}">מחיר יעד עבור ${nm}</label>
        <input type="number" class="cTarget" id="target-${p.id}" placeholder="₪ יעד" step="0.1" inputmode="decimal" value="${p.target_price ?? ''}">

        <button class="btn small secondary cScan" type="button" aria-label="סריקה עכשיו עבור ${nm}" title="סריקה עכשיו">🔄 סריקה עכשיו</button>
        <button class="btn small secondary cOffers" type="button" aria-expanded="false" aria-label="הצגת כל המחירים עבור ${nm}" title="כל המחירים">📋 כל המחירים</button>
        <button class="btn small danger cDel" type="button" aria-label="מחיקת ${nm} מהמעקב" title="מחיקת ${nm} מהמעקב">🗑️ הסרה</button>
      </div>
      <div class="offersBox" role="region" aria-label="מחירים עבור ${nm}"></div>
    </div>`;
  }).join('');

  box.querySelectorAll('.product-card').forEach(card => {
    const id = card.dataset.id;
    const save = async () => {
      try {
        await api(`/api/products/${id}`, { method: 'PATCH', body: {
          interval_minutes: parseInt(card.querySelector('.cInterval').value, 10),
          notify_mode: card.querySelector('.cNotify').value,
          target_price: card.querySelector('.cTarget').value ? parseFloat(card.querySelector('.cTarget').value) : null,
        }});
        toast('✅ עודכן');
      } catch (e) { toast('⚠️ ' + e.message); }
    };
    card.querySelector('.cInterval').addEventListener('change', save);
    card.querySelector('.cNotify').addEventListener('change', save);
    card.querySelector('.cTarget').addEventListener('change', save);
    card.querySelector('.cScan').addEventListener('click', async ev => {
      ev.target.disabled = true; ev.target.textContent = 'סורק…';
      try { await api(`/api/products/${id}/scan`, { method: 'POST' }); toast('✅ הסריקה הושלמה'); loadTracked(); }
      catch (e) { toast('⚠️ ' + e.message); ev.target.disabled = false; ev.target.textContent = '🔄 סריקה עכשיו'; }
    });
    card.querySelector('.cOffers').addEventListener('click', async ev => {
      const btn = ev.currentTarget;
      const boxEl = card.querySelector('.offersBox');
      if (boxEl.innerHTML) {
        boxEl.innerHTML = '';
        btn.setAttribute('aria-expanded', 'false');
        return;
      }
      btn.setAttribute('aria-expanded', 'true');
      boxEl.innerHTML = '<span class="spinner"></span> טוען מחירים…';
      try {
        const r = await api(`/api/products/${id}/offers`);
        boxEl.innerHTML = (r.ts ? `<div class="hint">נכון ל-${esc(r.ts)}</div>` : '') + offersTable(r.offers);
      } catch (e) {
        boxEl.innerHTML = `<div class="hint" style="color:var(--red)">⚠️ טעינת המחירים נכשלה. ${esc(e.message)}</div>`;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    const productName = card.querySelector('.pname')?.textContent.trim() || 'המוצר';
    card.querySelector('.cDel').addEventListener('click', async () => {
      if (!confirm(`להסיר את ${productName} מהמעקב? היסטוריית המחירים שלו תימחק.`)) return;
      try {
        await api(`/api/products/${id}`, { method: 'DELETE' });
        toast('הוסר מהמעקב');
        loadTracked();
      } catch (e) { toast('⚠️ ' + e.message); }
    });
  });
}

// ---------- הגדרות ----------
// שדות רגילים (ערכם נטען ומוצג) מול שדות סוד (לעולם לא נטענים מהשרת)
const PLAIN_FIELDS = ['city', 'email_user', 'email_to', 'whatsapp_phone'];
const SECRET_FIELDS = ['email_app_password', 'whatsapp_apikey', 'anthropic_api_key'];

async function loadSettings() {
  api('/api/hostinfo').then(h => {
    const rows = [];
    if (h.public_url) {
      rows.push(`🌍 הכתובת שלך: <b dir="ltr" style="font-size:16px;color:var(--accent)">${esc(h.public_url)}</b>`);
    }
    // הוראות רשת מקומית מוצגות רק בהרצה מקומית מפורשת, לא באתר הציבורי
    if (h.mode === 'local' && Array.isArray(h.addresses) && h.addresses.length) {
      rows.push('🏠 ברשת הביתית: ' + h.addresses.map(a => `<b dir="ltr" style="font-size:15px;color:var(--accent)">${esc(a)}</b>`).join(' או '));
    }
    $('#phoneAccess').innerHTML = rows.join('<br>') || 'הכתובת תוצג כאן ברגע שהחיבור יעלה';
    const localBox = $('#localAccessHelp');
    if (localBox) localBox.hidden = h.mode !== 'local';
  }).catch(() => {});

  const s = await api('/api/settings');
  for (const f of PLAIN_FIELDS) {
    const el = $('#s_' + f);
    if (el) el.value = s[f] || '';
  }
  // שדות סוד: נשארים ריקים; רק מציינים אם כבר מוגדר
  for (const f of SECRET_FIELDS) {
    const el = $('#s_' + f);
    if (!el) continue;
    el.value = '';
    const configured = !!(s.configured && s.configured[f]);
    el.placeholder = configured ? '••••• שמור — השאירי ריק כדי לא לשנות' : 'לא הוגדר';
    const badge = document.getElementById('status_' + f);
    if (badge) badge.textContent = configured ? '✓ מוגדר' : '';
  }
  if (!$('#s_city').value) $('#s_city').value = 'תל אביב';
}

$('#btnSaveSettings').addEventListener('click', async ev => {
  const body = {};
  for (const f of PLAIN_FIELDS) {
    const el = $('#s_' + f);
    if (el) body[f] = el.value.trim();
  }
  // עדכון חלקי: סוד נשלח רק אם המשתמשת הקלידה ערך חדש
  for (const f of SECRET_FIELDS) {
    const el = $('#s_' + f);
    if (el && el.value.trim()) body[f] = el.value.trim();
  }
  ev.currentTarget.disabled = true;
  try {
    await api('/api/settings', { method: 'POST', body });
    toast('✅ ההגדרות נשמרו');
    loadSettings(); // מנקה את שדות הסוד חזרה למצב "שמור"
  } catch (e) { toast('⚠️ ' + e.message); }
  ev.currentTarget.disabled = false;
});

// שינוי קוד הכניסה — דורש את הקוד הנוכחי והקלדה כפולה של החדש
$('#btnChangePin')?.addEventListener('click', async ev => {
  const current = $('#s_pin_current').value.trim();
  const next = $('#s_pin_new').value.trim();
  const confirmPin = $('#s_pin_confirm').value.trim();
  if (!current || !next || !confirmPin) return toast('⚠️ יש למלא את שלושת השדות');
  if (next !== confirmPin) return toast('⚠️ הקוד החדש ואימותו אינם זהים');
  if (next.length < 6) return toast('⚠️ הקוד החדש חייב להיות באורך 6 תווים לפחות');
  if (!confirm('שינוי הקוד ינתק מיד את כל המכשירים המחוברים, כולל המכשיר הזה.\nלהמשיך?')) return;

  ev.currentTarget.disabled = true;
  try {
    await api('/api/change-pin', { method: 'POST', body: { current, next } });
    toast('✅ הקוד שונה. מתנתק…', 5000);
    setTimeout(() => { location.href = '/login.html'; }, 1500);
  } catch (e) {
    toast('⚠️ ' + e.message, 5000);
    ev.currentTarget.disabled = false;
  }
});

// כפתורי הצגה/הסתרה לשדות סוד
document.querySelectorAll('.toggle-secret').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-pressed', String(!showing));
    btn.textContent = showing ? '👁️' : '🙈';
    btn.setAttribute('aria-label', showing ? 'הצגת הערך' : 'הסתרת הערך');
  });
});

$('#btnTestEmail').addEventListener('click', async ev => {
  ev.target.disabled = true;
  try {
    const body = { email_user: $('#s_email_user').value.trim(), email_to: $('#s_email_to').value.trim() };
    const pw = $('#s_email_app_password').value.trim();
    if (pw) body.email_app_password = pw;   // רק אם הוקלד ערך חדש
    await api('/api/settings', { method: 'POST', body });
    await api('/api/test-email', { method: 'POST' });
    toast('✅ מייל בדיקה נשלח! בדקי את תיבת הדואר');
    loadSettings();
  } catch (e) { toast('⚠️ ' + e.message, 6000); }
  ev.target.disabled = false;
});

$('#btnTestWa').addEventListener('click', async ev => {
  ev.target.disabled = true;
  try {
    const body = { whatsapp_phone: $('#s_whatsapp_phone').value.trim() };
    const key = $('#s_whatsapp_apikey').value.trim();
    if (key) body.whatsapp_apikey = key;
    await api('/api/settings', { method: 'POST', body });
    await api('/api/test-whatsapp', { method: 'POST' });
    toast('✅ הודעת בדיקה נשלחה לווטסאפ!');
    loadSettings();
  } catch (e) { toast('⚠️ ' + e.message, 6000); }
  ev.target.disabled = false;
});

refreshTrackedCount();
