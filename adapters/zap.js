// Zap (zap.co.il) — השוואת מחירי אלקטרוניקה, סלולר, חשמל וצרכנות
// זאפ חוסם קריאות HTTP פשוטות, לכן משתמשים בדפדפן סמוי (Playwright/Chromium)
import { chromium } from 'playwright';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--lang=he-IL'],
    }).catch(err => { browserPromise = null; throw err; });
  }
  return browserPromise;
}

export async function newPage() {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    locale: 'he-IL',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });
  const page = await ctx.newPage();
  // חסימת משאבים כבדים להאצה
  await page.route('**/*', route => {
    const t = route.request().resourceType();
    if (['image', 'media', 'font'].includes(t)) return route.abort();
    return route.continue();
  });
  return { ctx, page };
}

// חיפוש בזאפ: מחזיר רשימת דגמים (עם מחיר "החל מ") או הצעות ישירות
export async function searchModels(query) {
  const { ctx, page } = await newPage();
  try {
    await page.goto(`https://www.zap.co.il/search.aspx?keyword=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 45000,
    });
    await page.waitForTimeout(2500);

    const results = await page.evaluate(() => {
      // לכל דגם יש כמה קישורים (שם, "למפרט טכני", תמונה...) — אוספים את השם הטוב ביותר מכולם
      const bad = /חוות דעת|השוואת דגמים|לקריאת|למפרט|מפרט טכני|תמונות|מבצע|צפו ב/;
      const clean = s => String(s || '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/[‎‏‪-‮]/g, '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const byId = new Map();
      for (const a of document.querySelectorAll('a[href*="model.aspx?modelid="], a[href*="compmodels.aspx"], a[href*="/model/"]')) {
        const m = /modelid=(\d+)/.exec(a.href) || /\/model\/(\d+)/.exec(a.href);
        if (!m) continue;
        const id = m[1];
        const card = a.closest('[class*="Model"], [class*="model"], [class*="Card"], [class*="card"], [class*="product"]') || a.parentElement;
        const candidates = [a.getAttribute('title'), a.textContent];
        if (card) {
          const t = card.querySelector('[class*="itle"], [class*="ame"], h2, h3, .prodTitle');
          if (t) candidates.push(t.textContent);
          const img = card.querySelector('img[alt]');
          if (img) candidates.push(img.alt);
        }
        const best = candidates.map(clean).filter(s => s.length >= 8 && !bad.test(s)).sort((x, y) => y.length - x.length)[0] || '';
        let price = null;
        if (card) {
          const pm = /([\d,]+(?:\.\d+)?)\s*₪|₪\s*([\d,]+(?:\.\d+)?)/.exec(card.textContent);
          if (pm) price = parseFloat((pm[1] || pm[2]).replace(/,/g, ''));
        }
        const prev = byId.get(id);
        if (!prev) byId.set(id, { modelId: id, name: best, fromPrice: price });
        else {
          if (best.length > prev.name.length) prev.name = best;
          if (prev.fromPrice == null && price != null) prev.fromPrice = price;
        }
      }
      return [...byId.values()].filter(r => r.name).slice(0, 15);
    });

    // אם החיפוש נחת ישירות על עמוד דגם
    if (!results.length && /model\.aspx\?modelid=(\d+)/.test(page.url())) {
      const modelId = /modelid=(\d+)/.exec(page.url())[1];
      const name = (await page.title()).replace(/\s*-\s*zap.*$/i, '').trim();
      results.push({ modelId, name, fromPrice: null });
    }
    return results;
  } finally {
    await ctx.close().catch(() => {});
  }
}

// שליפת כל הצעות המחיר לדגם ספציפי
export async function modelOffers(modelId) {
  const { ctx, page } = await newPage();
  try {
    await page.goto(`https://www.zap.co.il/model.aspx?modelid=${encodeURIComponent(modelId)}`, {
      waitUntil: 'domcontentloaded', timeout: 45000,
    });
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      const clean = s => (s || '').trim().replace(/\s+/g, ' ');
      const name = clean(document.querySelector('h1')?.textContent) || document.title;
      const offers = [];
      // שורות הצעות: אלמנטים שמכילים שם חנות + מחיר
      const rows = document.querySelectorAll('[class*="ompare"] [class*="row"], [class*="PriceItem"], [class*="StoreRow"], [class*="store-row"], .compare-item-row, [data-site-name]');
      const pool = rows.length ? rows : document.querySelectorAll('div, tr');
      const seen = new Set();
      for (const el of pool) {
        const txt = el.textContent || '';
        const pm = /([\d,]{2,10}(?:\.\d+)?)\s*₪/.exec(txt);
        if (!pm) continue;
        const price = parseFloat(pm[1].replace(/,/g, ''));
        if (!price || price < 1) continue;
        // שם חנות
        let store = el.getAttribute?.('data-site-name') || '';
        if (!store) {
          const img = el.querySelector?.('img[alt]');
          if (img && img.alt && img.alt.length > 1 && !/₪/.test(img.alt)) store = img.alt;
        }
        if (!store) {
          const sEl = el.querySelector?.('[class*="tore"], [class*="ite-name"], [class*="hop"]');
          if (sEl) store = clean(sEl.textContent);
        }
        if (!store || store.length > 60) continue;
        // סינון אלמנטים שאינם שמות חנויות
        if (/^bullet$/i.test(store) || /רכישה בבית העסק|אחריות|משלוח|תשלומים/.test(store)) continue;
        // קישור לחנות
        let url = '';
        const a = el.querySelector?.('a[href*="fs.aspx"], a[href*="/fs/"], a[href*="redirect"]') || el.querySelector?.('a[href]');
        if (a) url = a.href;
        const key = store + '|' + price;
        if (seen.has(key)) continue;
        seen.add(key);
        offers.push({ chain: clean(store), store: clean(store), address: '', price, sale_desc: '', url, is_online: 1 });
        if (offers.length >= 60) break;
      }
      return { name, offers };
    });

    // סינון "מוצרים דומים" שזאפ שותל בעמוד: הצעה זולה קיצונית מחציון החנויות היא מוצר אחר
    if (data.offers.length >= 4) {
      const sorted = [...data.offers].sort((a, b) => a.price - b.price);
      const median = sorted[Math.floor(sorted.length / 2)].price;
      data.offers = data.offers.filter(o => o.price >= median * 0.4);
    }
    data.offers.sort((a, b) => a.price - b.price);
    return data;
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close().catch(() => {});
    browserPromise = null;
  }
}
