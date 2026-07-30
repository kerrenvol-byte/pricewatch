// מנהרת Cloudflare — קישור ציבורי מכל מקום (מחליף את Tailscale Funnel שנחסם ע"י הספק)
// הכתובת מתחלפת בכל הפעלה מחדש — לכן נשמרת בהגדרות ונשלחת למייל בכל שינוי.
import { spawn, execSync } from 'node:child_process';
import { getSetting, setSetting } from './db.js';
import { sendEmail } from './notify.js';

const CLOUDFLARED = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const PERMANENT_URL = 'https://wolfprices.com'; // מנהרה בשם — כתובת קבועה לנצח
let currentUrl = null;
let stopped = false;

// אם מנהרה כבר רצה (מהפעלה קודמת של השרת) — משתמשים בה ולא מחליפים כתובת
function tunnelAlreadyRunning() {
  try {
    return execSync('tasklist /FI "IMAGENAME eq cloudflared.exe" /NH', { encoding: 'utf8' }).includes('cloudflared.exe');
  } catch { return false; }
}

export function startTunnel() {
  // כתובת קבועה דרך הדומיין wolfprices.com — נשמרת תמיד
  currentUrl = process.env.PRICEWATCH_PUBLIC_URL || PERMANENT_URL;
  setSetting('public_url', currentUrl);

  // בענן הפלטפורמה מטפלת בחשיפה לאינטרנט — אין צורך במנהרה מקומית
  if (process.env.PRICEWATCH_MODE === 'hosted' && process.env.PORT) {
    console.log('[tunnel] רץ בענן — הפלטפורמה מספקת את הכתובת:', currentUrl);
    return;
  }

  if (tunnelAlreadyRunning()) {
    console.log('[tunnel] מנהרה קבועה פעילה:', PERMANENT_URL);
    return;
  }
  const run = () => {
    if (stopped) return;
    let proc;
    try {
      // מנהרה בשם עם קובץ תצורה קבוע — תמיד אותה כתובת
      proc = spawn(CLOUDFLARED, ['tunnel', 'run', 'pricewatch'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true, // המנהרה שורדת גם אם השרת מופעל מחדש
      });
      proc.unref();
    } catch (e) {
      console.error('[tunnel] הפעלה נכשלה:', e.message);
      return;
    }

    const onData = buf => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(buf));
      if (m && m[0] !== currentUrl) {
        currentUrl = m[0];
        const prev = getSetting('public_url');
        setSetting('public_url', currentUrl);
        console.log('[tunnel] קישור ציבורי:', currentUrl);
        if (prev !== currentUrl && getSetting('email_user') && getSetting('email_app_password')) {
          sendEmail('🔗 הקישור של PriceWatch התעדכן',
            `<p>הקישור לגישה מכל מקום:</p>
             <p style="font-size:18px"><a href="${currentUrl}">${currentUrl}</a></p>
             <p>קוד הכניסה נשאר אותו קוד. אם שמרת אייקון במסך הבית — כדאי להוסיף מחדש עם הקישור הזה.</p>`
          ).catch(e => console.error('[tunnel] מייל נכשל:', e.message));
        }
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData); // cloudflared כותב את הלוג ל-stderr

    proc.on('exit', code => {
      if (stopped) return;
      console.error(`[tunnel] נסגר (${code}) — הפעלה מחדש בעוד 10 שניות`);
      setTimeout(run, 10000);
    });
  };
  run();
}
