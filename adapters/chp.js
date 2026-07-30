// CHP (chp.co.il) — נתוני חוק שקיפות המחירים: כל רשתות המזון והפארם בישראל
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'he-IL,he;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`CHP HTTP ${res.status}`);
  return res.text();
}

// חיפוש מוצרים לפי טקסט חופשי או ברקוד — מחזיר רשימת מוצרים אפשריים
export async function searchProducts(term) {
  const url = `https://chp.co.il/autocompletion/product_extended?term=${encodeURIComponent(term)}`;
  const txt = await fetchText(url);
  let arr;
  try { arr = JSON.parse(txt); } catch { return []; }
  // רשומת "next" היא סמן דפדוף של CHP, לא מוצר
  return arr.filter(it => it && typeof it.value === 'string' && it.id && it.id !== 'next').map(it => {
    const barcodeMatch = /ברקוד:\s*([0-9]+)/.exec(it.parts?.manufacturer_and_barcode || '');
    return {
      source: 'chp',
      id: it.id,                       // "<shuk>_<barcode>" — משמש להשוואה
      name: it.value,
      manufacturer: (it.parts?.manufacturer_and_barcode || '').replace(/,?\s*ברקוד:.*$/, '').replace(/^יצרן\/מותג:\s*/, ''),
      barcode: barcodeMatch ? barcodeMatch[1] : (it.id?.split('_')[1] || ''),
      image: it.parts?.small_image ? `data:image/png;base64,${it.parts.small_image}` : null,
    };
  });
}

function parsePrice(txt) {
  const m = /([0-9]+(?:\.[0-9]+)?)/.exec((txt || '').replace(/,/g, ''));
  return m ? parseFloat(m[1]) : null;
}

// פענוח עיר/כתובת למזהי CHP (עם מטמון) — בלעדיהם לא חוזרות חנויות פיזיות
const addrCache = new Map();
async function resolveAddress(city) {
  if (addrCache.has(city)) return addrCache.get(city);
  let resolved = { address: city, cityId: '', streetId: '' };
  try {
    const txt = await fetchText(`https://chp.co.il/autocompletion/shopping_address?term=${encodeURIComponent(city)}`);
    const arr = JSON.parse(txt);
    if (Array.isArray(arr) && arr.length && arr[0].id) {
      const [cityId, streetId] = String(arr[0].id).split('_');
      resolved = { address: arr[0].value, cityId: cityId || '', streetId: streetId || '' };
    }
  } catch { /* נופל חזרה לטקסט חופשי */ }
  addrCache.set(city, resolved);
  return resolved;
}

// השוואת מחירים לברקוד/מזהה מוצר בעיר נתונה
export async function comparePrices(productIdOrBarcode, city) {
  const loc = await resolveAddress(city);
  const url = `https://chp.co.il/main_page/compare_results?shopping_address=${encodeURIComponent(loc.address)}&shopping_address_city_id=${encodeURIComponent(loc.cityId)}&shopping_address_street_id=${encodeURIComponent(loc.streetId)}&product_barcode=${encodeURIComponent(productIdOrBarcode)}&from=0&num_results=30`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  const productName = $('#displayed_product_name_and_contents').attr('value') || '';
  const offers = [];

  $('table').each((_, table) => {
    const headers = $(table).find('th').map((_, th) => $(th).text().trim()).get();
    if (!headers.includes('מחיר')) return;
    const isOnline = headers.includes('אתר אינטרנט');

    $(table).find('tbody tr').each((_, tr) => {
      const $tr = $(tr);
      if ($tr.hasClass('display_when_narrow') || $tr.find('td[colspan]').length) return;
      const tds = $tr.find('td');
      if (tds.length < 4) return;

      const chain = $(tds[0]).text().trim();
      const store = $(tds[1]).text().trim();
      let address = '', saleTd, priceTd;
      if (tds.length >= 5) {
        address = $(tds[2]).text().trim();
        saleTd = $(tds[3]); priceTd = $(tds[4]);
      } else {
        saleTd = $(tds[2]); priceTd = $(tds[3]);
      }
      const price = parsePrice(priceTd.text());
      if (price == null || !chain) return;

      const saleBtn = saleTd.find('button');
      const saleDesc = saleBtn.length
        ? cheerio.load(saleBtn.attr('data-discount-desc') || '').text().trim()
        : '';
      // מחיר מבצע אם קיים בתיאור המבצע
      let salePrice = null;
      if (saleDesc) {
        const sp = /([0-9]+(?:\.[0-9]+)?)\s*ש"?ח/.exec(saleDesc);
        if (sp) salePrice = parseFloat(sp[1]);
      }

      const link = isOnline ? ($tr.find('a').attr('href') || '') : '';
      offers.push({
        chain, store, address,
        price: (salePrice != null && salePrice < price) ? salePrice : price,
        regular_price: price,
        sale_desc: saleDesc,
        url: link,
        is_online: isOnline ? 1 : 0,
      });
    });
  });

  offers.sort((a, b) => a.price - b.price);
  return { productName, offers };
}
