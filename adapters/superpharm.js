// סופר-פארם אונליין — לא מופיעה בנתוני CHP, מתחברים ישירות לאתר שלהם.
// חיפוש לפי שם המוצר + אימות ברקוד מדויק (data-favorite-id = ברקוד) => התאמה ודאית.
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL,he;q=0.9' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Super-Pharm HTTP ${res.status}`);
  return res.text();
}

// מחפש את המוצר לפי שם ומחזיר הצעה רק אם הברקוד תואם בדיוק
export async function superPharmOffer(barcode, productName) {
  if (!barcode || !productName) return null;
  // שם החיפוש: החלק שלפני הפסיק (בלי גודל/אריזה) עובד הכי טוב
  const q = String(productName).split(',')[0].trim();
  if (q.length < 3) return null;

  const html = await fetchText(`https://shop.super-pharm.co.il/search?text=${encodeURIComponent(q)}`);
  const $ = cheerio.load(html);
  let offer = null;

  $('.item-box').each((_, el) => {
    if (offer) return;
    const bc = ($(el).find('[data-favorite-id]').attr('data-favorite-id') || '').trim();
    if (bc !== String(barcode)) return;
    const name = ($(el).attr('data-name') || '').trim();
    const brand = ($(el).attr('data-brand') || '').trim();
    const price = parseFloat($(el).attr('data-price')) || null;
    const disc = parseFloat($(el).attr('data-discountprice')) || null;
    const href = $(el).find('a[href]').first().attr('href') || '';
    const url = href.startsWith('http') ? href : 'https://shop.super-pharm.co.il' + href;
    const finalPrice = (disc && price && disc < price) ? disc : price;
    if (!finalPrice) return;
    offer = {
      chain: 'סופר-פארם אונליין',
      store: [brand, name].filter(Boolean).join(' '),
      address: '',
      price: finalPrice,
      regular_price: price,
      sale_desc: (disc && price && disc < price) ? `מבצע אונליין (במקום ₪${price})` : '',
      url,
      is_online: 1,
    };
  });
  return offer;
}
