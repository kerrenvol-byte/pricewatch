// חיפוש ישיר בחנויות שלא מופיעות (או מופיעות חלקית) בזאפ:
// KSP, מחסני חשמל, אלם, עולם הקולנוע והחשמל, איבורי
import * as cheerio from 'cheerio';
import { newPage } from './zap.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchText(url, accept = 'text/html') {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL,he;q=0.9', 'Accept': accept },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const parseNum = t => {
  const m = /([\d,]+(?:\.\d+)?)/.exec(String(t || ''));
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
};

// ---------- קבוצת אלקטרה (מחסני חשמל + שקם אלקטריק) — API ישיר של מנוע החיפוש (FastSimon) ----------
const ELECTRA_UUID = 'b655c070-2db6-4709-933f-df029bd118a8';
async function fastSimon(q, storeId, storeName) {
  const url = `https://api.fastsimon.com/full_text_search?request_source=v-next&src=v-next&UUID=${ELECTRA_UUID}&uuid=${ELECTRA_UUID}&q=${encodeURIComponent(q)}&page_num=1&products_per_page=40&sort_by=relevency&store_id=${storeId}`;
  const txt = await fetchText(url, 'application/json');
  const data = JSON.parse(txt);
  return (data.items || []).map(it => ({
    store: storeName,
    name: String(it.l || '').trim(),
    price: parseNum(it.p),
    url: it.u || '',
  })).filter(o => o.name && o.price);
}
const searchPayngo = q => fastSimon(q, 1, 'מחסני חשמל');
const searchShekem = q => fastSimon(q, 2, 'שקם אלקטריק');

// ---------- LastPrice ----------
async function searchLastprice(q) {
  const html = await fetchText(`https://www.lastprice.co.il/category.asp?q=${encodeURIComponent(q)}`);
  const $ = cheerio.load(html);
  const out = [];
  $('a.prodLink').each((_, a) => {
    const href = $(a).attr('href') || '';
    const labelId = ($(a).attr('aria-labelledby') || '').trim();
    let name = labelId ? $('#' + labelId).text().trim().replace(/\s+/g, ' ') : '';
    if (!name) {
      try { name = decodeURIComponent((href.split('/').pop() || '')).replace(/[-~*/_]+/g, ' ').trim(); } catch { /* */ }
    }
    let el = $(a).parent(), price = null;
    for (let i = 0; i < 6 && el.length; i++, el = el.parent()) {
      const p = el.find('.lprice').first();
      if (p.length) { price = parseNum(p.text()); break; }
    }
    if (name && price && price > 1) out.push({ store: 'LastPrice', name, price, url: href });
  });
  return out.slice(0, 40);
}

// ---------- ACE ----------
async function searchAce(q) {
  const html = await fetchText(`https://www.ace.co.il/catalogsearch/result/?q=${encodeURIComponent(q)}`);
  const $ = cheerio.load(html);
  const out = [];
  $('.product-item-info').each((_, el) => {
    const a = $(el).find('a[href]').first();
    const name = ($(el).find('.product-item-name, .product-item-link').first().text().trim()
      || $(el).find('img[alt]').first().attr('alt') || '').trim().replace(/\s+/g, ' ');
    const price = parseNum($(el).find('.priceNum').first().text())
      ?? parseNum($(el).find('[data-price-type="finalPrice"]').first().text());
    if (name && price && price > 1) out.push({ store: 'ACE', name, price, url: a.attr('href') || '' });
  });
  return out.slice(0, 40);
}

// ---------- עולם הקולנוע והחשמל (WooCommerce; לעיתים חוסם HTTP — נופל לדפדפן) ----------
function parseCWC(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('ul.products li.product').each((_, el) => {
    const name = $(el).find('.woocommerce-loop-product__title').first().text().trim();
    const link = $(el).find('a[href*="/product/"], a').first().attr('href') || '';
    const priceEl = $(el).find('.price ins .amount').first().length
      ? $(el).find('.price ins .amount').first()
      : $(el).find('.price .amount').first();
    const price = parseNum(priceEl.text().replace(/[^\d.,]/g, ''));
    if (name && price) out.push({ store: 'עולם הקולנוע והחשמל', name, price, url: link });
  });
  return out;
}

async function searchCWC(q) {
  const url = `https://www.cwc.co.il/?s=${encodeURIComponent(q)}&post_type=product`;
  try {
    return parseCWC(await fetchText(url));
  } catch { /* נופל לדפדפן */ }
  const { ctx, page } = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(2500);
    return parseCWC(await page.content());
  } finally { await ctx.close().catch(() => {}); }
}

// ---------- איבורי ----------
async function searchIvory(q) {
  const html = await fetchText(`https://www.ivory.co.il/catalog.php?act=cat&q=${encodeURIComponent(q)}`);
  const $ = cheerio.load(html);
  const out = [];
  $('.product-box-view').each((_, el) => {
    const name = $(el).find('.title_product_catalog').first().text().trim().replace(/\s+/g, ' ');
    const link = $(el).find('a[href]').first().attr('href') || '';
    const price = parseNum($(el).find('[class*="price"]').first().text() || $(el).text());
    if (name && price && price > 1) {
      out.push({ store: 'איבורי מחשבים', name, price, url: link.startsWith('http') ? link : 'https://www.ivory.co.il/' + link.replace(/^\//, '') });
    }
  });
  return out;
}

// ---------- KSP (דרך דפדפן — עמוד קטגוריית חיפוש) ----------
async function searchKSP(q) {
  const { ctx, page } = await newPage();
  try {
    await page.goto(`https://ksp.co.il/web/cat/?search=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForSelector('a[href*="/web/item/"]', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(2500);
    return await page.evaluate(() => {
      const out = []; const seen = new Set();
      for (const a of document.querySelectorAll('a[href*="/web/item/"]')) {
        const name = (a.getAttribute('title') || a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!name || name.length < 8 || seen.has(a.href)) continue;
        let root = a;
        for (let i = 0; i < 7 && root.parentElement; i++) {
          root = root.parentElement;
          if (/₪/.test(root.textContent || '')) break;
        }
        const pm = /([\d,]{2,10}(?:\.\d+)?)\s*₪|₪\s*([\d,]{2,10}(?:\.\d+)?)/.exec(root.textContent || '');
        if (!pm) continue;
        seen.add(a.href);
        out.push({ store: 'KSP', name, price: parseFloat((pm[1] || pm[2]).replace(/,/g, '')), url: a.href });
        if (out.length >= 40) break;
      }
      return out;
    });
  } finally { await ctx.close().catch(() => {}); }
}

// ---------- אלם (דרך דפדפן) ----------
async function searchALM(q) {
  const { ctx, page } = await newPage();
  try {
    await page.goto(`https://www.alm.co.il/search.html?query=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForSelector('[class*="item-root"]', { timeout: 8000 }).catch(() => {});
    // התוכן נטען בעצלנות — גוללים בהדרגה עד שהכרטיסים מתמלאים
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(900);
      const filled = await page.evaluate(() =>
        [...document.querySelectorAll('[class*="item-root"]')].filter(c => (c.textContent || '').trim().length > 10).length
      );
      if (filled >= 4) break;
    }
    await page.waitForTimeout(1500);
    return await page.evaluate(() => {
      const out = []; const seen = new Set();
      for (const card of document.querySelectorAll('[class*="item-root"]')) {
        const a = card.querySelector('a[aria-label][href], a[href]');
        if (!a || seen.has(a.href)) continue;
        const name = (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ');
        const pm = /₪\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*₪/.exec(card.textContent || '');
        if (!name || name.length < 8 || !pm) continue;
        seen.add(a.href);
        out.push({ store: 'אלם (ALM)', name, price: parseFloat((pm[1] || pm[2]).replace(/,/g, '')), url: a.href });
        if (out.length >= 40) break;
      }
      return out;
    });
  } finally { await ctx.close().catch(() => {}); }
}

// ---------- באג (bug.co.il) — נתונים מובנים בכרטיס המוצר ----------
async function searchBug(q) {
  const html = await fetchText(`https://www.bug.co.il/search?q=${encodeURIComponent(q)}`);
  const $ = cheerio.load(html);
  const out = [];
  $('.product-cube').each((_, el) => {
    const name = ($(el).attr('data-fullname') || $(el).attr('data-fullName') || '').trim();
    const price = parseNum($(el).find('.price').first().text());
    const href = $(el).find('a.product-preview-image, a[href]').first().attr('href') || '';
    if (name && price && price > 1) {
      out.push({
        store: 'באג',
        name,
        price,
        url: href.startsWith('http') ? href : 'https://www.bug.co.il' + href,
      });
    }
  });
  return out.slice(0, 40);
}

// ---------- גוד פארם (WooCommerce, דרך דפדפן) ----------
function parseWoo(html, storeName, origin) {
  const $ = cheerio.load(html);
  const out = [];
  $('li.product').each((_, el) => {
    const name = $(el).find('.woocommerce-loop-product__title, h2').first().text().trim().replace(/\s+/g, ' ');
    const priceEl = $(el).find('.price ins .amount').first().length
      ? $(el).find('.price ins .amount').first()
      : $(el).find('.price .amount, .price').first();
    const price = parseNum(priceEl.text().replace(/[^\d.,]/g, ''));
    const href = $(el).find('a.woocommerce-LoopProduct-link, a[href]').first().attr('href') || '';
    if (name && price && price > 1) {
      out.push({ store: storeName, name, price, url: href.startsWith('http') ? href : origin + href });
    }
  });
  return out.slice(0, 40);
}

async function searchGoodPharm(q) {
  const url = `https://goodpharm.co.il/?s=${encodeURIComponent(q)}&post_type=product`;
  try {
    const r = parseWoo(await fetchText(url), 'גוד פארם', 'https://goodpharm.co.il');
    if (r.length) return r;
  } catch { /* נופל לדפדפן */ }
  const { ctx, page } = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForSelector('li.product', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return parseWoo(await page.content(), 'גוד פארם', 'https://goodpharm.co.il');
  } finally { await ctx.close().catch(() => {}); }
}

// ---------- אופיס דיפו (WooCommerce; חוסם HTTP לפעמים — נופל לדפדפן) ----------
async function searchOfficeDepot(q) {
  const url = `https://www.officedepot.co.il/catalogsearch/result/?q=${encodeURIComponent(q)}`;
  try {
    const r = parseWoo(await fetchText(url), 'אופיס דיפו', 'https://www.officedepot.co.il');
    if (r.length) return r;
  } catch { /* 403 — נופל לדפדפן */ }
  const { ctx, page } = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForSelector('li.product', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return parseWoo(await page.content(), 'אופיס דיפו', 'https://www.officedepot.co.il');
  } finally { await ctx.close().catch(() => {}); }
}

const ADAPTERS = [
  { key: 'ksp', fn: searchKSP },
  { key: 'officedepot', fn: searchOfficeDepot },
  { key: 'payngo', fn: searchPayngo },
  { key: 'shekem', fn: searchShekem },
  { key: 'bug', fn: searchBug },
  { key: 'goodpharm', fn: searchGoodPharm },
  { key: 'lastprice', fn: searchLastprice },
  { key: 'ace', fn: searchAce },
  { key: 'cwc', fn: searchCWC },
  { key: 'ivory', fn: searchIvory },
  { key: 'alm', fn: searchALM },
];

// שמות תצוגה לחנויות — לשימוש בהודעות למשתמש
export const STORE_LABELS = {
  ksp: 'KSP', payngo: 'מחסני חשמל', shekem: 'שקם אלקטריק', bug: 'באג',
  goodpharm: 'גוד פארם', lastprice: 'LastPrice', ace: 'ACE', officedepot: 'אופיס דיפו',
  cwc: 'עולם הקולנוע', ivory: 'איבורי', alm: 'אלם',
};

// חיפוש בכל החנויות במקביל.
// מחזיר גם אילו חנויות נבדקו בהצלחה ואילו נכשלו — כדי שלא נציג כשל כ"אין מלאי".
export async function searchAllStores(query) {
  const results = await Promise.allSettled(ADAPTERS.map(a => a.fn(query)));
  const offers = [];
  const errors = {};
  const searched = [];
  results.forEach((r, i) => {
    const label = STORE_LABELS[ADAPTERS[i].key] || ADAPTERS[i].key;
    if (r.status === 'fulfilled') {
      offers.push(...r.value);
      searched.push(label);
    } else {
      errors[label] = r.reason?.message || 'שגיאה';
      console.error(`[stores] ${label} נכשלה:`, (r.reason?.message || '').split('\n')[0].slice(0, 120));
    }
  });
  return { offers, errors, searched };
}

// נרמול שם לצורך התאמה: אותיות קטנות, איחוד קיבולת ("128 gb" -> "128gb"), פירוק לאסימונים
function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/(\d+)\s*(gb|tb|mm|inch|״|")/g, '$1$2')
    .replace(/[^a-z0-9א-ת]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// האם הצעה מחנות מתאימה לדגם המבוקש?
// כל האסימונים המספריים של הדגם חייבים להופיע כאסימונים שלמים (כדי ש"16" לא יתפוס "16e"),
// ולפחות מחצית מהמילים הלועזיות (שם המותג/סדרה) חייבות להופיע.
export function matchesModel(referenceName, offerName) {
  const refT = tokens(referenceName);
  const offSet = new Set(tokens(offerName));
  const numeric = refT.filter(t => /\d/.test(t));
  const words = [...new Set(refT.filter(t => !/\d/.test(t) && /^[a-z]+$/.test(t) && t.length >= 3))];
  if (!numeric.length && !words.length) return false;

  // דחיית אביזרים נלווים: "מגן מסך ל-iPhone 16" אינו iPhone 16.
  // נדחה רק אם מילת האביזר אינה מופיעה גם בשם הדגם המבוקש.
  const ACCESSORY_WORDS = [
    'כיסוי', 'מגן', 'נרתיק', 'רצועה', 'רצועות', 'מסנן', 'פילטר', 'מטען', 'כבל',
    'סוללה', 'מעמד', 'סטנד', 'ערכת', 'ערכה', 'שקית', 'שקיות', 'ראש', 'ראשי',
    'מברשת', 'חלקי', 'חלף', 'אביזר', 'אביזרים', 'תואם', 'עבור',
    'case', 'cover', 'protector', 'filter', 'charger', 'cable', 'strap', 'stand', 'mount',
  ];
  const refRaw = String(referenceName).toLowerCase();
  const offRaw = String(offerName).toLowerCase();
  const isAccessory = ACCESSORY_WORDS.some(w => offRaw.includes(w) && !refRaw.includes(w));
  if (isAccessory) return false;
  // אסימון מספרי קצר (16, 470, 128gb) חייב זהות מלאה (כדי ש"16" לא יתפוס "16e");
  // קוד דגם ארוך (RT48CB6626) מתאים גם עם סיומת גרסה/צבע (RT48CB6626WH)
  const numTokenOk = rt => {
    if (offSet.has(rt)) return true;
    if (rt.length >= 6 && /[a-z]/.test(rt)) {
      for (const ot of offSet) {
        if (ot.length >= 6 && (ot.startsWith(rt) || rt.startsWith(ot))) return true;
      }
    }
    return false;
  };
  const numOk = numeric.every(numTokenOk);
  const wordHits = words.filter(t => offSet.has(t)).length;
  // דוחים גרסה משודרגת/שונה: אם בהצעה יש כינוי דגם (pro/plus/max...) שלא קיים בדגם המבוקש
  const QUALIFIERS = ['pro', 'plus', 'max', 'mini', 'ultra', 'se', 'fe', 'lite', 'air'];
  const refSet = new Set(refT);
  const qualifierMismatch = QUALIFIERS.some(t => offSet.has(t) && !refSet.has(t));
  return numOk && !qualifierMismatch && (words.length === 0 || wordHits >= Math.ceil(words.length / 2));
}

// שם חיפוש נקי לחנויות מתוך שם דגם של זאפ (האסימונים הלטיניים/מספריים).
// נפח אחסון (256GB וכו') מושמט מהשאילתה — מנועי החיפוש של החנויות מדרגים גרוע
// שאילתות ארוכות, ואת הנפח המדויק אוכף ממילא המסנן matchesModel.
export function cleanQuery(modelName) {
  const t = String(modelName || '').match(/[A-Za-z0-9][A-Za-z0-9+./-]*/g) || [];
  const seen = new Set();
  const out = [];
  for (const x of t) {
    const k = x.toLowerCase();
    if (seen.has(k) || /^\d+(gb|tb)$/i.test(x)) continue;
    seen.add(k);
    out.push(x);
  }
  return out.join(' ').trim() || modelName;
}
