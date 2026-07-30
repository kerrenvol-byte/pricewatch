// שליחת התראות: מייל (Gmail) + ווטסאפ (CallMeBot)
import nodemailer from 'nodemailer';
import { db, getSetting } from './db.js';

export async function sendEmail(subject, html) {
  const user = getSetting('email_user').trim();
  // גוגל מציג את סיסמת האפליקציה עם רווחים — מסירים אותם אוטומטית
  const pass = getSetting('email_app_password').replace(/\s+/g, '');
  const to = getSetting('email_to') || user;
  if (!user || !pass) throw new Error('לא הוגדרו פרטי מייל בהגדרות');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"PriceWatch 🏷️" <${user}>`,
    to,
    subject,
    html: `<div dir="rtl" style="font-family:Segoe UI,Arial,sans-serif;font-size:15px">${html}</div>`,
  });
}

export async function sendWhatsApp(message) {
  const phone = getSetting('whatsapp_phone');   // בפורמט בינלאומי, למשל 972501234567
  const apikey = getSetting('whatsapp_apikey'); // מתקבל מ-CallMeBot בהגדרה חד-פעמית
  if (!phone || !apikey) throw new Error('לא הוגדרו פרטי ווטסאפ בהגדרות');
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`CallMeBot HTTP ${res.status}`);
}

function logNotification(productId, channel, message, ok) {
  db.prepare('INSERT INTO notifications (product_id, channel, message, ok) VALUES (?, ?, ?, ?)')
    .run(productId, channel, message, ok ? 1 : 0);
}

// שולח התראה בכל הערוצים שהוגדרו; מחזיר סטטוס לכל ערוץ
export async function notifyPriceDrop(product, oldPrice, newPrice, store) {
  const title = `📉 ירידת מחיר: ${product.name}`;
  const drop = oldPrice != null ? ` (היה ₪${oldPrice})` : '';
  const text = `המחיר הנמוך ביותר עכשיו: ₪${newPrice} ב-${store}${drop}`;
  const results = {};

  if (getSetting('email_user') && getSetting('email_app_password')) {
    try {
      await sendEmail(title, `<h3>${product.name}</h3><p>${text}</p><p><a href="http://localhost:${getSetting('port', '3777')}">פתיחת PriceWatch</a></p>`);
      results.email = true;
    } catch (e) { results.email = e.message; }
    logNotification(product.id, 'email', text, results.email === true);
  }

  if (getSetting('whatsapp_phone') && getSetting('whatsapp_apikey')) {
    try {
      await sendWhatsApp(`${title}\n${text}`);
      results.whatsapp = true;
    } catch (e) { results.whatsapp = e.message; }
    logNotification(product.id, 'whatsapp', text, results.whatsapp === true);
  }

  return results;
}
