// בדיקות אבטחה ל-API מול שרת חי.
// דורש שרת רץ + קוד כניסה במשתנה סביבה — לעולם לא בקוד:
//   PowerShell:  $env:TEST_ACCESS_CODE="..."; node --test "tests/*.test.js"
// אם המשתנה חסר — הבדיקות מדולגות (ולא נכשלות), כדי שהרצה מקומית לא תישבר.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3777';
const CODE = process.env.TEST_ACCESS_CODE;
const skip = CODE ? false : 'חסר TEST_ACCESS_CODE — בדיקות ה-API מדולגות';

let cookie = '';

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: CODE }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  cookie = setCookie.split(';')[0];
  return res;
}

const authed = (path, opts = {}) =>
  fetch(BASE + path, { ...opts, headers: { ...(opts.headers || {}), cookie } });

describe('אבטחת API', { skip }, () => {
  before(async () => { await login(); });

  test('כניסה עם קוד תקין מחזירה עוגייה HttpOnly', async () => {
    const res = await login();
    assert.equal(res.status, 200);
    const sc = res.headers.get('set-cookie') || '';
    assert.match(sc, /HttpOnly/i, 'העוגייה חייבת להיות HttpOnly');
    assert.match(sc, /SameSite/i);
  });

  test('קוד שגוי נדחה בלי לחשוף פרטים', async () => {
    const res = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'definitely-wrong-code-xyz' }),
    });
    assert.ok(res.status === 401 || res.status === 429);
    const body = await res.json();
    const text = JSON.stringify(body);
    assert.ok(!text.includes(CODE), 'התשובה לא תכיל את הקוד האמיתי');
    assert.ok(!/length|אורך|expected/i.test(text), 'אין לרמוז על מבנה הקוד');
  });

  test('גישה ל-API ללא עוגייה נדחית ב-401', async () => {
    const res = await fetch(`${BASE}/api/products`);
    assert.equal(res.status, 401);
  });

  test('‏/api/settings לא מחזיר אף ערך סוד', async () => {
    const res = await authed('/api/settings');
    assert.equal(res.status, 200);
    const s = await res.json();
    const raw = JSON.stringify(s);

    for (const k of ['access_pin', 'auth_secret', 'session_epoch', 'email_app_password', 'whatsapp_apikey', 'anthropic_api_key']) {
      assert.equal(s[k], undefined, `השדה ${k} לא אמור לחזור ללקוח`);
    }
    assert.ok(!raw.includes(CODE), 'קוד הכניסה לא נמצא בתשובה');
    assert.ok(s.configured && typeof s.configured === 'object', 'צריך להחזיר דגלי configured');
    for (const v of Object.values(s.configured)) {
      assert.equal(typeof v, 'boolean', 'configured מכיל בוליאנים בלבד');
    }
  });

  test('שמירת הגדרות בלי סוד חדש אינה מוחקת סוד קיים', async () => {
    const before = await (await authed('/api/settings')).json();
    const res = await authed('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: before.city || 'תל אביב' }), // בלי שדות סוד כלל
    });
    assert.equal(res.status, 200);
    const after = await (await authed('/api/settings')).json();
    assert.deepEqual(after.configured, before.configured, 'דגלי הסודות לא השתנו');
  });

  test('ערך מסכה (••••) לא נשמר כסוד חדש', async () => {
    const before = await (await authed('/api/settings')).json();
    await authed('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: '••••••••' }),
    });
    const after = await (await authed('/api/settings')).json();
    assert.equal(after.configured.anthropic_api_key, before.configured.anthropic_api_key,
      'מסכה לא משנה את הסוד השמור');
  });

  test('‏access_pin אינו ניתן לשינוי דרך /api/settings', async () => {
    const res = await authed('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_pin: 'hacked-pin-123456' }),
    });
    assert.equal(res.status, 200);
    // הקוד המקורי עדיין עובד — כלומר לא שונה
    const check = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: CODE }),
    });
    assert.equal(check.status, 200, 'הקוד המקורי חייב להמשיך לעבוד');
  });

  test('שינוי קוד עם קוד נוכחי שגוי נדחה', async () => {
    const res = await authed('/api/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: 'wrong-current', next: 'brand-new-code-999' }),
    });
    assert.equal(res.status, 403);
  });

  test('קוד QR מכיל רק כתובת — לא קוד כניסה', async () => {
    const res = await authed('/api/qr');
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.ok(!svg.includes(CODE), 'ה-QR לא מקודד את קוד הכניסה');
    assert.ok(!/pin=|code=|token=/i.test(svg), 'אין פרמטרי אימות ב-QR');
  });

  test('‏hostinfo לא חושף כתובות רשת פנימיות במצב hosted', async () => {
    const res = await authed('/api/hostinfo');
    const info = await res.json();
    assert.ok(['hosted', 'local'].includes(info.mode));
    if (info.mode === 'hosted') {
      assert.deepEqual(info.addresses, [], 'במצב ציבורי אין לחשוף כתובות פנימיות');
      assert.ok(!JSON.stringify(info).includes('192.168.'), 'אין כתובת רשת פרטית');
    }
  });

  test('חיפוש מחזיר מבנה עקבי לשני המקורות', async () => {
    const res = await authed('/api/search?q=' + encodeURIComponent('קוטג'));
    assert.equal(res.status, 200);
    const r = await res.json();
    assert.ok('grocery' in r && 'zap' in r);
    const ok = v => Array.isArray(v) || (v && typeof v.error === 'string');
    assert.ok(ok(r.grocery), 'grocery הוא מערך או אובייקט שגיאה');
    assert.ok(ok(r.zap), 'zap הוא מערך או אובייקט שגיאה');
  });

  test('חיפוש חנויות מדווח אילו נבדקו ואילו נכשלו (כשל ≠ "אין מלאי")', async () => {
    const res = await authed('/api/compare/stores?name=' + encodeURIComponent('Xiaomi Smart Band 10'));
    assert.equal(res.status, 200);
    const d = await res.json();
    assert.ok(Array.isArray(d.searched), 'חייב לדווח אילו חנויות נבדקו');
    assert.ok(Array.isArray(d.failed), 'חייב לדווח אילו חנויות נכשלו');
    assert.ok(d.searched.length + d.failed.length > 0, 'לפחות חנות אחת נוסתה');
    // חנות לא יכולה להיות גם "נבדקה" וגם "נכשלה"
    for (const f of d.failed) assert.ok(!d.searched.includes(f), `${f} מופיעה גם כהצלחה וגם ככשל`);
  });

  test('מוצר נפוץ נמצא בכמה חנויות (רגרסיית Mi Band 10)', async () => {
    // התקלה: שדרוג Playwright שבר את דפדפן הרקע, וכל החנויות מבוססות-הדפדפן
    // (KSP ועוד) החזירו כשל שהוצג למשתמשת כ"המוצר לא נמצא".
    const res = await authed('/api/compare/stores?name=' + encodeURIComponent('Xiaomi Smart Band 10'));
    const d = await res.json();
    assert.equal(d.failed.length, 0, `חנויות שנכשלו: ${d.failed.join(', ')} — סימן לתקלה טכנית, לא לחוסר מלאי`);
    assert.ok(d.offers.length > 0, 'מוצר נפוץ חייב להימצא בלפחות חנות אחת');
    const chains = new Set(d.offers.map(o => o.chain));
    assert.ok(chains.size >= 2, `נמצא רק ב-${chains.size} חנויות: ${[...chains].join(', ')}`);
  });

  test('מחירי מוצר מוחזרים ממוינים מספרית מהזול ליקר', async () => {
    const search = await (await authed('/api/search?q=7290004127329')).json();
    const first = Array.isArray(search.grocery) ? search.grocery[0] : null;
    if (!first) return; // המוצר לא נמצא כרגע — אין מה לבדוק
    const cmp = await (await authed('/api/compare/grocery?id=' + encodeURIComponent(first.id))).json();
    const prices = (cmp.offers || []).map(o => Number(o.price));
    for (let i = 1; i < prices.length; i++) {
      assert.ok(prices[i] >= prices[i - 1], `מיון שגוי: ${prices[i - 1]} לפני ${prices[i]}`);
    }
  });
});
