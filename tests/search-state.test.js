// בדיקות רגרסיה למכונת המצבים של החיפוש (P0).
// מריצים עם: node --test tests/
// הבדיקות מדמות DOM מינימלי ו-fetch, ובודקות את ההתנהגות שנשברה בייצור:
// תוצאות שנכנסו ל-DOM אבל נשארו מוסתרות מהמשתמש.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchController } from '../public/search-state.js';

function makeView() {
  return {
    candidatesVisible: false,
    candidatesHtml: '',
    status: '',
    searchDisabled: false,
    compareHtml: 'תוצאת השוואה ישנה',
    state: 'idle',
  };
}

// בקר חיפוש עם adapter לתצוגה — אותה לוגיקה שרצה בדפדפן
function setup(fetchImpl) {
  const view = makeView();
  const ctrl = createSearchController({
    fetchSearch: fetchImpl,
    view: {
      showCandidates: v => { view.candidatesVisible = v; },
      setCandidatesHtml: h => { view.candidatesHtml = h; },
      setStatus: s => { view.status = s; },
      setSearchDisabled: d => { view.searchDisabled = d; },
      clearCompare: () => { view.compareHtml = ''; },
      onState: s => { view.state = s; },
    },
  });
  return { ctrl, view };
}

const products = n => Array.from({ length: n }, (_, i) => ({ name: 'מוצר ' + i, id: 'id' + i }));
const models = n => Array.from({ length: n }, (_, i) => ({ name: 'דגם ' + i, modelId: 'm' + i }));

describe('P0 — מצבי חיפוש', () => {
  test('תרחיש 1: מזון 10 תוצאות, אלקטרוניקה 0 — מוצג', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: products(10), zap: [] }));
    await ctrl.search('קוטג');
    assert.equal(view.state, 'success');
    assert.equal(view.candidatesVisible, true, 'אזור התוצאות חייב להיות גלוי');
    assert.equal(ctrl.results.grocery.length, 10);
  });

  test('תרחיש 2 (רגרסיה מרכזית): מזון 0, אלקטרוניקה 15 — חייב להיות גלוי', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: [], zap: models(15) }));
    await ctrl.search('iPhone 16');
    assert.equal(view.state, 'success');
    assert.equal(view.candidatesVisible, true, 'התקלה המקורית: 15 דגמים ב-DOM אך display:none');
    assert.equal(ctrl.results.zap.length, 15);
    assert.equal(view.status, '', 'אין להשאיר הודעת טעינה תקועה');
  });

  test('תרחיש 2b: תוצאות אלקטרוניקה גלויות גם אחרי צפייה בהשוואה קודמת', async () => {
    // זהו בדיוק רצף התקלה בייצור: חיפוש → פתיחת השוואה (מסתירה) → חיפוש חדש
    const { ctrl, view } = setup(async () => ({ grocery: [], zap: models(15) }));
    view.candidatesVisible = false; // מצב שנשאר אחרי פתיחת השוואה
    await ctrl.search('iPhone 16');
    assert.equal(view.candidatesVisible, true, 'חיפוש חדש חייב לאפס מצב תצוגה מוסתר');
  });

  test('תרחיש 3: שני המקורות ריקים — empty state ברור', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: [], zap: [] }));
    await ctrl.search('שטויותבמיץ');
    assert.equal(view.state, 'empty');
    assert.equal(view.candidatesVisible, false);
    assert.match(view.status, /לא נמצאו תוצאות/);
  });

  test('תרחיש 4: מזון נכשל, אלקטרוניקה מצליחה — תוצאות חלקיות מוצגות', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: { error: 'CHP timeout' }, zap: models(5) }));
    await ctrl.search('iPhone');
    assert.equal(view.state, 'partial');
    assert.equal(view.candidatesVisible, true, 'כשל במקור אחד לא מוחק תוצאות מהשני');
    assert.equal(ctrl.results.zap.length, 5);
  });

  test('תרחיש 5: אלקטרוניקה נכשלה, מזון מצליח — תוצאות חלקיות מוצגות', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: products(7), zap: { error: 'zap blocked' } }));
    await ctrl.search('קוטג');
    assert.equal(view.state, 'partial');
    assert.equal(view.candidatesVisible, true);
    assert.equal(ctrl.results.grocery.length, 7);
  });

  test('תרחיש 6: שני המקורות נכשלים — מצב שגיאה, לא מסך ריק ושקט', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: { error: 'a' }, zap: { error: 'b' } }));
    await ctrl.search('משהו');
    assert.equal(view.state, 'error');
    assert.notEqual(view.status, '', 'חייבת להופיע הודעת שגיאה');
  });

  test('תרחיש 6b: כשל רשת מלא — מצב שגיאה', async () => {
    const { ctrl, view } = setup(async () => { throw new Error('network down'); });
    await ctrl.search('משהו');
    assert.equal(view.state, 'error');
    assert.match(view.status, /נכשל/);
  });

  test('תרחיש 7: חיפוש שני לפני שהראשון הסתיים — התוצאה האיטית לא דורסת', async () => {
    let resolveSlow;
    const calls = [];
    const { ctrl, view } = setup(q => {
      calls.push(q);
      if (calls.length === 1) return new Promise(r => { resolveSlow = () => r({ grocery: products(3), zap: [] }); });
      return Promise.resolve({ grocery: [], zap: models(15) });
    });

    const first = ctrl.search('חיפוש איטי');
    const second = ctrl.search('iPhone 16');   // מתחיל לפני שהראשון נגמר
    await second;
    resolveSlow();                              // התשובה האיטית חוזרת מאוחר
    await first;

    assert.equal(ctrl.results.zap.length, 15, 'התוצאה האחרונה היא הקובעת');
    assert.equal(ctrl.results.grocery.length, 0, 'תשובה איטית מחיפוש קודם לא נכנסה');
    assert.equal(view.candidatesVisible, true);
  });

  test('תרחיש 8: לחיצה כפולה מהירה אינה יוצרת state לא עקבי', async () => {
    let calls = 0;
    const { ctrl, view } = setup(async () => { calls++; return { grocery: [], zap: models(4) }; });
    const a = ctrl.search('iPhone');
    const b = ctrl.search('iPhone');   // לחיצה שנייה בזמן טעינה — נדחית
    await Promise.all([a, b]);
    assert.equal(calls, 1, 'רק בקשה אחת נשלחת');
    assert.equal(view.state, 'success');
    assert.equal(view.searchDisabled, false, 'הכפתור חוזר להיות פעיל בסיום');
  });

  test('חיפוש חדש מנקה תוצאות השוואה ישנות', async () => {
    const { ctrl, view } = setup(async () => ({ grocery: products(2), zap: [] }));
    assert.notEqual(view.compareHtml, '');
    await ctrl.search('קוטג');
    assert.equal(view.compareHtml, '', 'תוצאת השוואה ישנה נמחקת');
  });

  test('שאילתה זדונית עוברת בריחת HTML בהודעות', async () => {
    const { ctrl, view } = setup(async () => ({
      grocery: products(2), zap: [], usedQuery: '<img src=x onerror=alert(1)>',
    }));
    await ctrl.search('<script>alert(1)</script>');
    // המאפיין הקובע: אף תו < או > מהמשתמש לא נשאר כתו פעיל, ולכן לא נוצרת תגית
    assert.ok(!/<\s*(script|img|svg|iframe)/i.test(view.status), 'לא נוצרת תגית HTML מהקלט');
    assert.ok(!view.status.includes('<script>'), 'תגיות מהמשתמש לא נכנסות כ-HTML');
    assert.ok(view.status.includes('&lt;'), 'התווים הוחלפו בישויות HTML');
  });

  test('ניסוח חלופי מדווח למשתמשת', async () => {
    const { ctrl, view } = setup(async () => ({
      grocery: [], zap: models(5), usedQuery: 'xiaomi smart band 10',
    }));
    await ctrl.search('xiaomi mi band 10');
    assert.equal(view.candidatesVisible, true);
    assert.match(view.status, /smart band 10/i, 'מוצג הניסוח שבו נמצאו התוצאות');
  });

  test('onState נקרא אחרי עדכון ה-DOM (כדי שחיבור מאזינים יעבוד)', async () => {
    // רגרסיה: אם onState רץ לפני setCandidatesHtml, חיבור הלחיצות לכרטיסים נכשל
    // והמשתמש לא יכול לפתוח השוואת מחירים.
    const order = [];
    const view = makeView();
    const ctrl = createSearchController({
      fetchSearch: async () => ({ grocery: [], zap: models(3) }),
      view: {
        showCandidates: v => { view.candidatesVisible = v; order.push('show:' + v); },
        setCandidatesHtml: h => { view.candidatesHtml = h; order.push('html'); },
        setStatus: () => {},
        setSearchDisabled: () => {},
        clearCompare: () => {},
        renderResults: () => '<div class="candidate"></div>',
        onState: s => { if (s === 'success') order.push('onState'); },
      },
    });
    await ctrl.search('iPhone');
    assert.ok(order.indexOf('html') < order.indexOf('onState'),
      'ה-HTML חייב להיכתב לפני onState');
    assert.ok(order.indexOf('show:true') < order.indexOf('onState'),
      'התצוגה חייבת להיפתח לפני onState');
    assert.equal(view.candidatesHtml, '<div class="candidate"></div>');
  });

  test('בזמן טעינה הכפתור מושבת והודעת מצב מוצגת', async () => {
    let seenDuringLoad = null;
    const { ctrl, view } = setup(async () => {
      seenDuringLoad = { disabled: view.searchDisabled, status: view.status, state: view.state };
      return { grocery: products(1), zap: [] };
    });
    await ctrl.search('קוטג');
    assert.equal(seenDuringLoad.state, 'loading');
    assert.equal(seenDuringLoad.disabled, true);
    assert.notEqual(seenDuringLoad.status, '');
  });
});
