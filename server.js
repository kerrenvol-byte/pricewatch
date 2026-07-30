import express from 'express';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, getAllSettings } from './db.js';
import * as chp from './adapters/chp.js';
import * as zap from './adapters/zap.js';
import { identifyProduct } from './adapters/vision.js';
import { searchAllStores, matchesModel, cleanQuery } from './adapters/stores.js';
import { expandQuery, normalizeQuery, similarityScore } from './adapters/query.js';
import { scanProduct, startScheduler, fullGroceryOffers } from './scheduler.js';
import { startTunnel } from './tunnel.js';
import { sendEmail, sendWhatsApp } from './notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// רשת ביטחון: דחייה לא-מטופלת (למשל בסריקה) — רק נרשמת; שגיאה קשה — יציאה נקייה
// כדי שהשומר (run-forever.bat) יפעיל שרת בריא במקום להשאיר תהליך זומבי
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err?.stack || err));
process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err?.stack || err);
  process.exit(1);
});

const app = express();
app.use(express.json({ limit: '15mb' }));

// ---------- הגנת קוד כניסה (לשיתוף משפחתי) ----------
// קוד הכניסה נשמר במסד הנתונים. אם עדיין לא נקבע — נלקח ממשתנה סביבה,
// ואם גם הוא חסר, נוצר קוד אקראי ומודפס פעם אחת ללוג.
// אין קוד ברירת מחדל קבוע בקוד המקור.
function initialPin() {
  if (process.env.PRICEWATCH_DEFAULT_PIN) return process.env.PRICEWATCH_DEFAULT_PIN;
  const generated = crypto.randomBytes(4).toString('hex').toUpperCase();
  console.log(`\n*** קוד הכניסה הראשוני שנוצר: ${generated} — יש לשנותו במסך ההגדרות ***\n`);
  return generated;
}
// מצב פריסה: hosted (ציבורי) או local. משפיע על הצגת הוראות רשת מקומית בלבד.
const DEPLOY_MODE = process.env.PRICEWATCH_MODE === 'local' ? 'local' : 'hosted';

function getAccessPin() {
  let pin = getSetting('access_pin');
  if (!pin) {
    pin = initialPin();
    setSetting('access_pin', pin);   // נשמר פעם אחת, כדי שלא ישתנה בהפעלה הבאה
  }
  return pin;
}

// session_epoch מאפשר ביטול מיידי של כל ה-sessions הקיימים בעת שינוי קוד
function getAuthToken() {
  let secret = getSetting('auth_secret');
  if (!secret) {
    secret = crypto.randomBytes(16).toString('hex');
    setSetting('auth_secret', secret);
  }
  const epoch = getSetting('session_epoch') || '0';
  return crypto.createHash('sha256').update(getAccessPin() + '|' + secret + '|' + epoch).digest('hex');
}

// השוואה עמידה ל-timing attacks
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// הגבלת קצב לניסיונות כניסה: חלון נע לפי IP, עם השהיה הדרגתית
const loginAttempts = new Map(); // ip -> { count, first, blockedUntil }
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

function loginGuard(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) return { allowed: true };
  if (rec.blockedUntil && rec.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((rec.blockedUntil - now) / 1000) };
  }
  if (now - rec.first > LOGIN_WINDOW_MS) { loginAttempts.delete(ip); return { allowed: true }; }
  return { allowed: true };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - rec.first > LOGIN_WINDOW_MS) { rec.count = 0; rec.first = now; }
  rec.count++;
  if (rec.count >= LOGIN_MAX_ATTEMPTS) {
    // השהיה הדרגתית: 1 דקה, 2, 4… עד תקרה של 15 דקות
    const over = rec.count - LOGIN_MAX_ATTEMPTS;
    rec.blockedUntil = now + Math.min(15 * 60_000, 60_000 * Math.pow(2, over));
  }
  loginAttempts.set(ip, rec);
}

// ניקוי תקופתי כדי שהמפה לא תגדל ללא הגבלה
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (now - rec.first > LOGIN_WINDOW_MS && (!rec.blockedUntil || rec.blockedUntil < now)) loginAttempts.delete(ip);
  }
}, 5 * 60_000).unref?.();

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').filter(Boolean).map(c => {
      const i = c.indexOf('=');
      return [c.slice(0, i).trim(), c.slice(i + 1).trim()];
    })
  );
}

app.use((req, res, next) => {
  const open = ['/login.html', '/api/login', '/manifest.json', '/icon.svg'];
  if (open.includes(req.path)) return next();
  if (parseCookies(req).pw_auth === getAuthToken()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'נדרש קוד כניסה — רענני את הדף' });
  return res.redirect('/login.html');
});

function authCookie() {
  const secure = DEPLOY_MODE === 'hosted' ? '; Secure' : '';
  return `pw_auth=${getAuthToken()}; Path=/; Max-Age=${180 * 24 * 3600}; HttpOnly; SameSite=Lax${secure}`;
}

app.post('/api/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const guard = loginGuard(ip);
  if (!guard.allowed) {
    res.setHeader('Retry-After', String(guard.retryAfter));
    return res.status(429).json({ error: 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות.' });
  }
  const pin = String(req.body?.pin || '').trim();
  if (pin && safeEqual(pin, getAccessPin())) {
    loginAttempts.delete(ip);
    res.setHeader('Set-Cookie', authCookie());
    return res.json({ ok: true });
  }
  recordLoginFailure(ip);
  // הודעה גנרית — לא חושפת אם הקוד קיים, אורכו וכו'
  res.status(401).json({ error: 'קוד שגוי' });
});

// שינוי קוד הכניסה: דורש את הקוד הנוכחי, ומבטל את כל ה-sessions
app.post('/api/change-pin', (req, res) => {
  const current = String(req.body?.current || '').trim();
  const next = String(req.body?.next || '').trim();
  if (!safeEqual(current, getAccessPin())) {
    return res.status(403).json({ error: 'הקוד הנוכחי שגוי' });
  }
  if (next.length < 6) {
    return res.status(400).json({ error: 'הקוד החדש חייב להיות באורך 6 תווים לפחות' });
  }
  setSetting('access_pin', next);
  // ניתוק כל המכשירים: הגדלת ה-epoch משנה את הטוקן של כולם
  setSetting('session_epoch', String(Date.now()));
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

// הודעות שגיאה ידידותיות ללקוח; הפרטים הטכניים נשארים בלוג עם מזהה בקשה
const SAFE_ERROR_RE = /^[֐-׿\s'"״׳().,:!?\-–—0-9a-zA-Z]{0,160}$/;
const wrap = fn => (req, res) => fn(req, res).catch(e => {
  const reqId = crypto.randomBytes(4).toString('hex');
  console.error(`[${reqId}] ${req.method} ${req.path}:`, e?.stack || e);
  // מעבירים רק הודעות עבריות קצרות שנוצרו על ידינו; כל השאר נחסם
  const msg = typeof e?.message === 'string' && /[֐-׿]/.test(e.message) && SAFE_ERROR_RE.test(e.message)
    ? e.message
    : 'שגיאה זמנית. נסי שוב בעוד רגע.';
  res.status(500).json({ error: msg, requestId: reqId });
});

// ---------- חיפוש ----------

// דירוג רלוונטיות: כמה מאסימוני החיפוש מופיעים בשם המוצר (עם סובלנות לתקלדות)
function relevanceScore(query, ...haystacks) {
  return similarityScore(query, haystacks.join(' '));
}

// סבב חיפוש יחיד מול שני המקורות
async function runSearchRound(q, isBarcode) {
  const [grocery, zapModels] = await Promise.all([
    chp.searchProducts(q).catch(e => ({ error: e.message })),
    isBarcode ? Promise.resolve([]) : zap.searchModels(q).catch(e => ({ error: e.message })),
  ]);

  // סינון תוצאות לא קשורות, עם סובלנות לתקלדות (similarityScore)
  let g = Array.isArray(grocery) ? grocery : null;
  if (g && !isBarcode) {
    const minScore = q.split(/\s+/).length >= 3 ? 0.6 : 0.85;
    g = g.map(c => ({ ...c, _s: relevanceScore(q, c.name, c.manufacturer) }))
         .filter(c => c._s >= minScore)
         .sort((a, b) => b._s - a._s);
  }
  let z = Array.isArray(zapModels) ? zapModels : null;
  if (z) {
    z = z.map(c => ({ ...c, _s: relevanceScore(q, c.name) }))
         .filter(c => c._s >= 0.5)
         .sort((a, b) => b._s - a._s);
  }
  return { g, z, groceryErr: grocery?.error, zapErr: zapModels?.error };
}

// חיפוש טקסט/ברקוד.
// אם הניסוח שהוקלד לא מניב תוצאות, המערכת מנסה לבד וריאציות:
// תיקון פריסת מקלדת, שם המותג בשפה השנייה, וכינויים מסחריים (Mi Band ↔ Smart Band).
app.get('/api/search', wrap(async (req, res) => {
  const raw = normalizeQuery(req.query.q || '');
  if (!raw) return res.json({ grocery: [], zap: [] });
  const isBarcode = /^[0-9]{7,14}$/.test(raw);

  const variants = isBarcode ? [raw] : expandQuery(raw, { max: 4 });
  let best = null;
  let usedQuery = raw;

  for (const variant of variants) {
    const r = await runSearchRound(variant, isBarcode);
    const count = (r.g?.length || 0) + (r.z?.length || 0);
    if (count > 0) { best = r; usedQuery = variant; break; }
    if (!best) best = r;                    // שומרים את הראשון למקרה שכולם ריקים
  }

  res.json({
    grocery: best.g ?? { error: best.groceryErr },
    zap: best.z ?? { error: best.zapErr },
    // אם נעשה שימוש בניסוח אחר — הממשק יידע להסביר זאת למשתמשת
    query: raw,
    usedQuery: usedQuery !== raw ? usedQuery : undefined,
  });
}));

// השוואת מחירים למוצר מזון/פארם (CHP + סופר-פארם אונליין)
app.get('/api/compare/grocery', wrap(async (req, res) => {
  const city = getSetting('city', 'תל אביב');
  const r = await fullGroceryOffers(req.query.id, city);
  res.json({ ...r, city });
}));

// השוואת מחירים לדגם זאפ — מהיר, מוחזר מיד לממשק
app.get('/api/compare/zap', wrap(async (req, res) => {
  const r = await zap.modelOffers(req.query.id);
  res.json(r);
}));

// חנויות ישירות — נטענות ברקע ומצטרפות לטבלה.
// חשוב: חנות שנכשלה מדווחת בנפרד ולעולם לא כ"המוצר לא נמצא אצלה".
app.get('/api/compare/stores', wrap(async (req, res) => {
  const name = req.query.name || '';
  if (!name) return res.json({ offers: [], searched: [], failed: [] });

  // מנסים את השם כפי שהוא, ואם החנויות לא מכירות אותו — וריאציות (Mi Band ↔ Smart Band וכו')
  let offers = [], errors = {}, searched = [];
  for (const variant of expandQuery(name, { max: 3 })) {
    const r = await searchAllStores(cleanQuery(variant));
    offers = r.offers; errors = r.errors; searched = r.searched;
    if (offers.some(o => matchesModel(name, o.name))) break;
  }
  let out = offers
    .filter(o => matchesModel(name, o.name))
    .map(o => ({ chain: o.store, store: o.name, address: '', price: o.price, sale_desc: '', url: o.url, is_online: 1 }));
  out.sort((a, b) => a.price - b.price);
  // סינון חריגים: מחיר נמוך קיצונית מהחציון הוא כמעט תמיד אביזר שחמק מהמסנן
  if (out.length >= 4) {
    const median = out[Math.floor(out.length / 2)].price;
    out = out.filter(o => o.price >= median * 0.4);
  }
  res.json({
    offers: out,
    searched,                          // חנויות שנבדקו בהצלחה
    failed: Object.keys(errors || {}), // חנויות שלא הגיבו — לא "אין מלאי"
  });
}));

// זיהוי מוצר מתמונה
app.post('/api/identify-image', wrap(async (req, res) => {
  const { image, mediaType } = req.body;
  const result = await identifyProduct(image, mediaType || 'image/jpeg');
  res.json(result);
}));

// ---------- מוצרים במעקב ----------

app.get('/api/products', wrap(async (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  for (const p of products) {
    p.history = db.prepare(
      'SELECT ts, min_price, min_store, offers_count FROM scans WHERE product_id = ? AND min_price IS NOT NULL ORDER BY ts DESC LIMIT 30'
    ).all(p.id).reverse();
  }
  res.json(products);
}));

app.post('/api/products', wrap(async (req, res) => {
  const { kind, name, barcode, query, image, interval_minutes, notify_mode, target_price } = req.body;
  if (!kind || !name || !barcode) return res.status(400).json({ error: 'חסרים פרטים' });
  const exists = db.prepare('SELECT id FROM products WHERE kind = ? AND barcode = ?').get(kind, barcode);
  if (exists) return res.status(409).json({ error: 'המוצר כבר במעקב' });
  const r = db.prepare(
    'INSERT INTO products (kind, name, barcode, query, image, interval_minutes, notify_mode, target_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(kind, name, barcode, query || '', image || null, interval_minutes || 1440, notify_mode || 'drop', target_price ?? null);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid);
  // סריקה ראשונה מיידית ברקע
  scanProduct(product).catch(e => console.error('first scan:', e.message));
  res.json(product);
}));

app.patch('/api/products/:id', wrap(async (req, res) => {
  const { interval_minutes, notify_mode, target_price, name } = req.body;
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'לא נמצא' });
  db.prepare('UPDATE products SET interval_minutes = ?, notify_mode = ?, target_price = ?, name = ? WHERE id = ?')
    .run(interval_minutes ?? p.interval_minutes, notify_mode ?? p.notify_mode,
         target_price === undefined ? p.target_price : target_price, name ?? p.name, p.id);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id));
}));

app.delete('/api/products/:id', wrap(async (req, res) => {
  db.prepare('DELETE FROM offers WHERE scan_id IN (SELECT id FROM scans WHERE product_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM scans WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// סריקה ידנית עכשיו
app.post('/api/products/:id/scan', wrap(async (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'לא נמצא' });
  const offers = await scanProduct(p);
  res.json({ ok: true, offers });
}));

// ההצעות מהסריקה האחרונה של מוצר
app.get('/api/products/:id/offers', wrap(async (req, res) => {
  const scan = db.prepare('SELECT * FROM scans WHERE product_id = ? ORDER BY ts DESC LIMIT 1').get(req.params.id);
  if (!scan) return res.json({ offers: [] });
  const offers = db.prepare('SELECT * FROM offers WHERE scan_id = ? ORDER BY price ASC').all(scan.id);
  res.json({ ts: scan.ts, offers });
}));

// כתובת הגישה מהנייד — מוצג בהגדרות.
// כתובות רשת פנימיות נחשפות רק בהרצה מקומית מפורשת (PRICEWATCH_MODE=local).
app.get('/api/hostinfo', wrap(async (req, res) => {
  const out = { mode: DEPLOY_MODE, public_url: getSetting('public_url', ''), addresses: [] };
  if (DEPLOY_MODE === 'local') {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // מדלגים על כתובות פנימיות ועל ממשקי VPN (100.x — CGNAT)
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('100.')) {
          out.addresses.push(`http://${net.address}:${PORT}`);
        }
      }
    }
  }
  res.json(out);
}));

// קוד QR — מכיל אך ורק את כתובת האתר. לעולם לא קוד כניסה ולא טוקן.
app.get('/api/qr', wrap(async (req, res) => {
  const url = getSetting('public_url') || `http://localhost:${PORT}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 220 });
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
}));

// ---------- הגדרות ----------

// שדות שלעולם לא נשלחים ללקוח — רק דגל "מוגדר/לא מוגדר"
const SECRET_KEYS = ['access_pin', 'auth_secret', 'session_epoch', 'email_app_password', 'whatsapp_apikey', 'anthropic_api_key'];
// שדות שמותר לעדכן דרך /api/settings (access_pin עובר רק דרך /api/change-pin)
const WRITABLE_KEYS = ['city', 'email_user', 'email_to', 'whatsapp_phone', 'email_app_password', 'whatsapp_apikey', 'anthropic_api_key'];

app.get('/api/settings', wrap(async (req, res) => {
  const all = getAllSettings();
  const safe = {};
  for (const [k, v] of Object.entries(all)) {
    if (!SECRET_KEYS.includes(k)) safe[k] = v;
  }
  // דגלים בלבד — אף ערך סוד לא עוזב את השרת
  safe.configured = {
    email_app_password: !!all.email_app_password,
    whatsapp_apikey: !!all.whatsapp_apikey,
    anthropic_api_key: !!all.anthropic_api_key,
  };
  safe.mode = DEPLOY_MODE;
  res.json(safe);
}));

app.post('/api/settings', wrap(async (req, res) => {
  const body = req.body || {};
  for (const k of WRITABLE_KEYS) {
    if (!(k in body)) continue;                       // עדכון חלקי: מה שלא נשלח — לא נוגעים בו
    const v = body[k];
    if (typeof v !== 'string') continue;
    const isSecret = SECRET_KEYS.includes(k);
    if (isSecret) {
      const trimmed = v.trim();
      if (!trimmed) continue;                         // ריק = "אל תשני את הסוד הקיים"
      if (/^[•*]+$/.test(trimmed)) continue;          // ערך מסכה לא נשמר כסוד חדש
      setSetting(k, trimmed);
    } else {
      setSetting(k, v.trim());
    }
  }
  res.json({ ok: true });
}));

app.post('/api/test-email', wrap(async (req, res) => {
  await sendEmail('בדיקת PriceWatch ✅', '<p>אם קיבלת את המייל הזה — ההתראות במייל עובדות מצוין!</p>');
  res.json({ ok: true });
}));

app.post('/api/test-whatsapp', wrap(async (req, res) => {
  await sendWhatsApp('בדיקת PriceWatch ✅ — ההתראות בווטסאפ עובדות!');
  res.json({ ok: true });
}));

// ---------- הפעלה ----------

// בענן הפורט מוכתב ע"י הפלטפורמה (PORT); מקומית — 3777 כברירת מחדל
const PORT = parseInt(process.env.PORT || getSetting('port', '3777'), 10);
const listener = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PriceWatch פועל: http://localhost:${PORT}`);
  // כתובות גישה מהנייד (באותה רשת WiFi)
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`גישה מהנייד (באותו WiFi): http://${net.address}:${PORT}`);
      }
    }
  }
  startScheduler();
  startTunnel();
});
// אם הפורט תפוס (שרת אחר כבר רץ) — יוצאים בשקט במקום להישאר תהליך מיותם
listener.on('error', err => {
  console.error('[listen]', err.code || err.message);
  process.exit(err.code === 'EADDRINUSE' ? 0 : 1);
});
