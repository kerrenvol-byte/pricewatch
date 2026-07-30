// מתזמן סריקות אוטומטיות — כל מוצר לפי המרווח שהוגדר לו
import { db, getSetting } from './db.js';
import * as chp from './adapters/chp.js';
import * as zap from './adapters/zap.js';
import { searchAllStores, matchesModel, cleanQuery } from './adapters/stores.js';
import { superPharmOffer } from './adapters/superpharm.js';
import { notifyPriceDrop } from './notify.js';

// הצעות מזון/פארם מלאות: CHP (כל הרשתות) + סופר-פארם אונליין (חסרה ב-CHP)
export async function fullGroceryOffers(idOrBarcode, city) {
  const r = await chp.comparePrices(idOrBarcode, city);
  const barcode = String(idOrBarcode).includes('_') ? String(idOrBarcode).split('_').pop() : String(idOrBarcode);
  try {
    const sp = await superPharmOffer(barcode, r.productName);
    if (sp) {
      r.offers.push(sp);
      r.offers.sort((a, b) => a.price - b.price);
    }
  } catch (e) {
    console.error('[superpharm]', e.message);
  }
  return r;
}

// הצעות אלקטרוניקה מלאות: זאפ (עשרות חנויות) + חנויות ישירות (KSP, מחסני חשמל ועוד)
export async function fullElectronicsOffers(modelId, referenceName) {
  const [zapRes, storesRes] = await Promise.allSettled([
    zap.modelOffers(modelId),
    referenceName ? searchAllStores(cleanQuery(referenceName)) : Promise.resolve({ offers: [] }),
  ]);
  const offers = [];
  let name = referenceName || '';
  if (zapRes.status === 'fulfilled') {
    name = zapRes.value.name || name;
    offers.push(...zapRes.value.offers);
  }
  let storeMatches = 0;
  const addStoreOffers = (list, ref) => {
    for (const o of list) {
      if (!matchesModel(ref, o.name)) continue;
      offers.push({ chain: o.store, store: o.name, address: '', price: o.price, sale_desc: '', url: o.url, is_online: 1 });
      storeMatches++;
    }
  };
  if (storesRes.status === 'fulfilled') {
    addStoreOffers(storesRes.value.offers, referenceName || name);
  }
  // רשת ביטחון: רק כשלא היה שם ייחוס בכלל (למשל מוצרים ישנים) — מנסים עם השם מעמוד זאפ
  if (!storeMatches && !referenceName && name) {
    try {
      const retry = await searchAllStores(cleanQuery(name));
      addStoreOffers(retry.offers, name);
    } catch { /* לא קריטי */ }
  }
  if (!offers.length && zapRes.status === 'rejected') throw new Error(zapRes.reason?.message || 'שגיאת זאפ');
  offers.sort((a, b) => a.price - b.price);
  return { name, offers };
}

// מבצע סריקה אחת למוצר, שומר תוצאות, ומחזיר את ההצעות
export async function scanProduct(product) {
  let offers = [];
  let scanError = null;

  try {
    if (product.kind === 'grocery') {
      const city = getSetting('city', 'תל אביב');
      const r = await fullGroceryOffers(product.barcode, city);
      offers = r.offers;
    } else if (product.kind === 'zap') {
      const r = await fullElectronicsOffers(product.barcode, product.name); // barcode = zap modelId
      offers = r.offers;
    }
  } catch (e) {
    scanError = e.message;
    console.error(`[scan] ${product.name}: ${e.message}`);
  }

  if (scanError) {
    // מסמנים כשל כדי שהממשק יציג "הסריקה נכשלה" ולא "ללא שינוי",
    // ומשמרים את התוצאה התקינה האחרונה.
    try {
      db.prepare('UPDATE products SET last_scan_ok = 0 WHERE id = ?').run(product.id);
    } catch { /* עמודה ישנה — לא קריטי */ }
    throw new Error(scanError);
  }

  const min = offers.length ? offers[0] : null;
  const scanRes = db.prepare(
    'INSERT INTO scans (product_id, min_price, min_store, offers_count) VALUES (?, ?, ?, ?)'
  ).run(product.id, min?.price ?? null, min ? `${min.chain}${min.store && min.store !== min.chain ? ' - ' + min.store : ''}` : null, offers.length);

  const insOffer = db.prepare(
    'INSERT INTO offers (scan_id, chain, store, address, price, sale_desc, url, is_online) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const o of offers) {
    insOffer.run(scanRes.lastInsertRowid, o.chain, o.store, o.address || '', o.price, o.sale_desc || '', o.url || '', o.is_online ? 1 : 0);
  }

  // בדיקת התראה
  const prevMin = product.last_min_price;
  if (min) {
    const mode = product.notify_mode || 'drop';
    let shouldNotify = false;
    if (mode !== 'off' && prevMin != null) {
      if (mode === 'drop' && min.price < prevMin - 0.001) shouldNotify = true;
      if (mode === 'change' && Math.abs(min.price - prevMin) > 0.001) shouldNotify = true;
    }
    if (product.target_price != null && min.price <= product.target_price && (prevMin == null || prevMin > product.target_price)) {
      shouldNotify = true;
    }
    if (shouldNotify) {
      await notifyPriceDrop(product, prevMin, min.price, `${min.chain}${min.store && min.store !== min.chain ? ' - ' + min.store : ''}`).catch(() => {});
    }
  }

  db.prepare('UPDATE products SET last_scan_at = datetime(\'now\',\'localtime\'), last_min_price = ?, last_min_store = ?, last_scan_ok = 1 WHERE id = ?')
    .run(min?.price ?? product.last_min_price, min ? `${min.chain}${min.store && min.store !== min.chain ? ' - ' + min.store : ''}` : product.last_min_store, product.id);

  return offers;
}

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const due = db.prepare(`
      SELECT * FROM products
      WHERE interval_minutes > 0
        AND (last_scan_at IS NULL
             OR (julianday('now','localtime') - julianday(last_scan_at)) * 24 * 60 >= interval_minutes - 0.5)
    `).all();
    for (const p of due) {
      try {
        await scanProduct(p);
        console.log(`[scheduler] נסרק: ${p.name}`);
      } catch (e) {
        console.error(`[scheduler] שגיאה בסריקת ${p.name}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 4000)); // עדינות כלפי האתרים
    }
  } finally {
    running = false;
  }
}

export function startScheduler() {
  setInterval(tick, 60 * 1000); // בדיקה כל דקה מי "הגיע זמנו"
  setTimeout(tick, 10 * 1000);  // סריקה ראשונה 10 שניות אחרי עליית השרת
  console.log('[scheduler] מתזמן הסריקות פעיל');
}
