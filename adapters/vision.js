// זיהוי מוצר מתמונה באמצעות Claude API (אופציונלי — דורש מפתח בהגדרות)
import { getSetting } from '../db.js';

export async function identifyProduct(imageBase64, mediaType) {
  const apiKey = getSetting('anthropic_api_key');
  if (!apiKey) throw new Error('לא הוגדר מפתח Anthropic API בהגדרות');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'זהי את המוצר בתמונה. החזירי JSON בלבד בפורמט: {"name":"שם המוצר בעברית כפי שמופיע בחנויות בישראל","name_en":"שם באנגלית","barcode":"הברקוד אם נראה בתמונה, אחרת ריק","category":"grocery או electronics"}. אם יש ברקוד גלוי בתמונה — קראי אותו בעדיפות עליונה.' },
        ],
      }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) throw new Error('לא הצלחתי לזהות את המוצר מהתמונה');
  return JSON.parse(m[0]);
}
