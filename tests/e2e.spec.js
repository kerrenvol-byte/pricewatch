// בדיקות E2E (Playwright) — מריצים עם:
//   $env:TEST_ACCESS_CODE="..."; npx playwright test tests/e2e.spec.js
// דגשים:
//  * קוד הכניסה מגיע ממשתנה סביבה בלבד, לעולם לא מהקוד.
//  * לא נשלחים מיילים/וואטסאפ אמיתיים ולא נמחקים מוצרים בייצור.
//  * לא מקבעים מספרי תוצאות או מחירים — הנתונים משתנים.
import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3777';
const CODE = process.env.TEST_ACCESS_CODE;

test.skip(!CODE, 'חסר TEST_ACCESS_CODE');
test.describe.configure({ mode: 'serial' });

async function login(page) {
  await page.goto(`${BASE}/login.html`);
  await page.fill('#pin', CODE);
  await page.click('#go');
  await page.waitForURL(u => !u.pathname.includes('login'), { timeout: 15000 });
}

test.describe('כניסה', () => {
  test('קוד תקין מוביל למסך הראשי, והקוד לא מופיע ב-URL', async ({ page }) => {
    await login(page);
    await expect(page.locator('nav button[data-tab="search"]')).toBeVisible();
    expect(page.url()).not.toContain(CODE);
    expect(page.url()).not.toMatch(/pin=|code=|token=/i);
  });

  test('קוד שגוי מציג הודעה ואינו חושף פרטים', async ({ page }) => {
    await page.goto(`${BASE}/login.html`);
    await page.fill('#pin', 'wrong-code-for-test');
    await page.click('#go');
    const err = page.locator('#err');
    await expect(err).toBeVisible();
    const text = await err.textContent();
    expect(text).not.toContain(CODE);
    expect(text).not.toMatch(/length|אורך/i);
  });
});

test.describe('חיפוש מזון', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('חיפוש קוטג׳ מציג לפחות תוצאה אחת', async ({ page }) => {
    await page.fill('#q', 'קוטג');
    await page.click('#btnSearch');
    await expect(page.locator('#candidates .candidate').first()).toBeVisible({ timeout: 45000 });
    await expect(page.locator('#candidates')).toBeVisible();
  });

  test('ברקוד מדויק פותח טבלת מחירים ממוינת מספרית', async ({ page }) => {
    await page.fill('#q', '7290004127329');
    await page.click('#btnSearch');
    await expect(page.locator('#candidates .candidate').first()).toBeVisible({ timeout: 45000 });
    await page.locator('#candidates .candidate').first().click();
    await expect(page.locator('#compareResults table.prices')).toBeVisible({ timeout: 45000 });

    const prices = await page.locator('#compareResults tbody .price-val').allTextContents();
    expect(prices.length).toBeGreaterThan(0);
    const nums = prices.map(t => parseFloat(t.replace(/[^\d.]/g, '')));
    const sorted = [...nums].sort((a, b) => a - b);
    expect(nums).toEqual(sorted);           // מיון מספרי, לא מחרוזתי
  });
});

test.describe('חיפוש אלקטרוניקה (רגרסיית P0)', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('תוצאות אלקטרוניקה גלויות — גם אחרי צפייה בהשוואה קודמת', async ({ page }) => {
    // שלב 1: חיפוש מזון ופתיחת השוואה — זה מה שהסתיר את אזור התוצאות בבאג המקורי
    await page.fill('#q', 'קוטג');
    await page.click('#btnSearch');
    await expect(page.locator('#candidates .candidate').first()).toBeVisible({ timeout: 45000 });
    await page.locator('#candidates .candidate').first().click();
    await expect(page.locator('#compareResults table.prices')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('#candidates')).toBeHidden();

    // שלב 2: חיפוש אלקטרוניקה — חייב להיות גלוי, לא רק ב-DOM
    await page.fill('#q', 'iPhone 16');
    await page.click('#btnSearch');
    await expect(page.locator('#candidates .candidate').first()).toBeVisible({ timeout: 60000 });

    const box = page.locator('#candidates');
    await expect(box).toBeVisible();
    expect(await box.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(0);
    expect(await box.evaluate(el => getComputedStyle(el).display)).not.toBe('none');
    await expect(page.locator('#candidates .name', { hasText: /iPhone 16 128GB/i }).first()).toBeVisible();
  });

  test('פתיחת השוואה לדגם אלקטרוניקה מציגה מחירים או הודעה — לעולם לא מסך ריק', async ({ page }) => {
    await page.fill('#q', 'iPhone 16');
    await page.click('#btnSearch');
    await expect(page.locator('#candidates .candidate').first()).toBeVisible({ timeout: 60000 });
    await page.locator('#candidates .candidate').first().click();

    // ממתינים למצב סופי (טבלה / "אין מחירים" / שגיאה) ולא רק לתוכן כלשהו —
    // הספינר מופיע מיד ולכן not.toBeEmpty לבדו אינו מספיק.
    await page.waitForFunction(() => {
      const box = document.querySelector('#compareResults');
      if (!box) return false;
      return !!box.querySelector('table.prices') ||
             !!box.querySelector('.empty') ||
             /שגיאה|נכשל/.test(box.innerText);
    }, null, { timeout: 90000 });

    const hasTable = await page.locator('#compareResults table.prices').count();
    const hasMessage = await page.locator('#compareResults .empty').count();
    const hasError = /שגיאה|נכשל/.test(await page.locator('#compareResults').innerText());
    expect(hasTable + hasMessage + (hasError ? 1 : 0)).toBeGreaterThan(0);
  });

  test('חיפוש ללא תוצאות מציג empty state ברור', async ({ page }) => {
    await page.fill('#q', 'זזזקקקשטויות123');
    await page.click('#btnSearch');
    await expect(page.locator('#searchStatus')).toContainText('לא נמצאו תוצאות', { timeout: 60000 });
    await expect(page.locator('#candidates')).toBeHidden();
  });
});

test.describe('מוצרים במעקב', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('הכרטיסים נטענים ולכל בקרה יש שם נגיש ייחודי', async ({ page }) => {
    await page.click('nav button[data-tab="tracked"]');
    await page.waitForTimeout(2500);
    const cards = await page.locator('.product-card').count();
    test.skip(cards === 0, 'אין מוצרים במעקב בסביבה הזו');

    const names = await page.locator('#trackedList select, #trackedList input, #trackedList button')
      .evaluateAll(els => els.map(el => {
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        const l = el.id && document.querySelector(`label[for="${el.id}"]`);
        return l ? l.textContent.trim() : el.textContent.trim();
      }));
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);            // כולם ייחודיים
    for (const n of names) {
      expect(n.replace(/[\p{Emoji}\s]/gu, '').length).toBeGreaterThan(0); // לא אימוג'י בלבד
    }
  });

  test('"כל המחירים" נפתח בלי לשנות נתונים', async ({ page }) => {
    await page.click('nav button[data-tab="tracked"]');
    await page.waitForTimeout(2500);
    const btn = page.locator('.cOffers').first();
    test.skip(await btn.count() === 0, 'אין מוצרים במעקב');
    await btn.click();
    await expect(page.locator('.offersBox').first()).not.toBeEmpty({ timeout: 30000 });
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    // אין לחיצה על מחיקה בסביבת ייצור — לפי הוראות העבודה
  });
});

test.describe('הגדרות — אבטחה ופרטיות', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('כל שדות הסוד מוסתרים וריקים', async ({ page }) => {
    await page.click('nav button[data-tab="settings"]');
    await page.waitForTimeout(2000);
    for (const id of ['s_pin_current', 's_pin_new', 's_pin_confirm', 's_email_app_password', 's_whatsapp_apikey', 's_anthropic_api_key']) {
      await expect(page.locator(`#${id}`)).toHaveAttribute('type', 'password');
      await expect(page.locator(`#${id}`)).toHaveValue('');
    }
  });

  test('כפתור הצגה/הסתרה מעדכן aria-pressed', async ({ page }) => {
    await page.click('nav button[data-tab="settings"]');
    await page.waitForTimeout(2000);
    const toggle = page.locator('.toggle-secret[data-target="s_anthropic_api_key"]');
    const input = page.locator('#s_anthropic_api_key');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveAttribute('type', 'text');
    await toggle.click();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('ה-API אינו מחזיר ערכי סוד', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/settings`);
    const body = await res.json();
    for (const k of ['access_pin', 'auth_secret', 'email_app_password', 'whatsapp_apikey', 'anthropic_api_key']) {
      expect(body[k]).toBeUndefined();
    }
    expect(JSON.stringify(body)).not.toContain(CODE);
    expect(typeof body.configured).toBe('object');
  });

  test('בייצור אין הוראות LAN או כתובת רשת פנימית', async ({ page }) => {
    await page.click('nav button[data-tab="settings"]');
    await page.waitForTimeout(2000);
    const info = await (await page.request.get(`${BASE}/api/hostinfo`)).json();
    test.skip(info.mode !== 'hosted', 'רלוונטי רק לפריסה ציבורית');
    const text = await page.locator('#tab-settings').innerText();
    expect(text).not.toMatch(/192\.168\./);
    expect(text).not.toMatch(/\.bat/i);
    expect(text).not.toMatch(/Administrator/i);
  });
});

test.describe('Responsive', () => {
  const sizes = [
    { name: 'mobile-320', width: 320, height: 700 },
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1280', width: 1280, height: 800 },
  ];

  for (const size of sizes) {
    test(`${size.name}: אין overflow אופקי וכל כפתורי הניווט גלויים`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await login(page);

      for (const tab of ['search', 'tracked', 'settings']) {
        await page.click(`nav button[data-tab="${tab}"]`);
        await page.waitForTimeout(1500);

        const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(docOverflow, `overflow אופקי במסך ${tab}`).toBe(false);

        const navOverflow = await page.evaluate(() => {
          const n = document.querySelector('nav');
          return n.scrollWidth > n.clientWidth;
        });
        expect(navOverflow, `גלילה אופקית בניווט במסך ${tab}`).toBe(false);

        const navVisible = await page.evaluate(() =>
          [...document.querySelectorAll('nav button')].every(b => {
            const r = b.getBoundingClientRect();
            return r.left >= -0.5 && r.right <= window.innerWidth + 0.5 && r.height >= 44;
          }));
        expect(navVisible, `כפתור ניווט חתוך או קטן מדי במסך ${tab}`).toBe(true);
      }
    });
  }
});
