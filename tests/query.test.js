// בדיקות למנוע הבנת השאילתות — שמות לא מדויקים חייבים למצוא את המוצר.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fixKeyboardLayout, expandQuery, similarityScore, tokensSimilar, normalizeQuery,
} from '../adapters/query.js';

describe('תיקון פריסת מקלדת', () => {
  test('עברית שהוקלדה במקלדת אנגלית', () => {
    // "אבטיח" בפריסה עברית מוקלד כ-tcyhj במקלדת אנגלית
    const out = fixKeyboardLayout('tcyhj');
    assert.ok(out.includes('אבטיח'), `התקבל: ${out.join(',')}`);
  });

  test('משפט שלם שהוקלד בפריסה שגויה', () => {
    const out = fixKeyboardLayout('CKH KDKUK');   // "בלי לגלול"
    assert.ok(out[0].includes('בלי'), `התקבל: ${out[0]}`);
  });

  test('אנגלית שהוקלדה במקלדת עברית', () => {
    // "iphone" בפריסה אנגלית מוקלד כ-ןפיםמק כשהמקלדת בעברית
    const out = fixKeyboardLayout('ןפיםמק');
    assert.ok(out.some(s => s.includes('iphone')), `התקבל: ${out.join(',')}`);
  });

  test('מילה עברית תקינה לא מתורגמת לג׳יבריש', () => {
    assert.deepEqual(fixKeyboardLayout('שיאומי'), []);
    assert.deepEqual(fixKeyboardLayout('מקרר'), []);
  });

  test('מילה אנגלית תקינה לא מתורגמת', () => {
    assert.deepEqual(fixKeyboardLayout('iphone'), []);
    assert.deepEqual(fixKeyboardLayout('samsung galaxy'), []);
  });
});

describe('הרחבת שאילתה', () => {
  test('מותג בעברית מתרחב לאנגלית', () => {
    const v = expandQuery('שיאומי band 10').map(s => s.toLowerCase());
    assert.ok(v.some(s => s.includes('xiaomi')), `וריאציות: ${v.join(' | ')}`);
  });

  test('Mi Band מתרחב ל-Smart Band (המקרה שנכשל בייצור)', () => {
    const v = expandQuery('xiaomi mi band 10').map(s => s.toLowerCase());
    assert.ok(v.some(s => s.includes('smart band')), `וריאציות: ${v.join(' | ')}`);
  });

  test('אייפון מתרחב ל-iPhone', () => {
    const v = expandQuery('אייפון 16').map(s => s.toLowerCase());
    assert.ok(v.some(s => s.includes('iphone')), `וריאציות: ${v.join(' | ')}`);
  });

  test('קטגוריה בעברית מתרחבת לאנגלית', () => {
    const v = expandQuery('מקרר סמסונג').map(s => s.toLowerCase());
    assert.ok(v.some(s => s.includes('samsung')), `וריאציות: ${v.join(' | ')}`);
  });

  test('השאילתה המקורית תמיד ראשונה', () => {
    assert.equal(expandQuery('iPhone 16')[0], 'iPhone 16');
  });

  test('שאילתה ריקה מחזירה רשימה ריקה', () => {
    assert.deepEqual(expandQuery('   '), []);
  });

  test('מספר הווריאציות מוגבל', () => {
    assert.ok(expandQuery('xiaomi mi band 10', { max: 4 }).length <= 4);
  });
});

describe('סובלנות לתקלדות', () => {
  test('תקלדה במילה ארוכה מזוהה', () => {
    assert.ok(tokensSimilar('xiaomi', 'xiomi'));
    assert.ok(tokensSimilar('samsung', 'samsng'));
  });

  test('מילים שונות באמת לא מותאמות', () => {
    assert.ok(!tokensSimilar('sony', 'samsung'));
    assert.ok(!tokensSimilar('apple', 'anker'));
  });

  test('מילים קצרות דורשות התאמה מדויקת', () => {
    assert.ok(!tokensSimilar('a1', 'a2'));
    assert.ok(!tokensSimilar('pro', 'pra'));
  });

  test('band אינו bank — אחרת מטען נייד יוצג כצמיד כושר', () => {
    assert.ok(!tokensSimilar('band', 'bank'));
    assert.ok(!tokensSimilar('mini', 'midi'));
  });

  test('דמיון: מטען נייד לא מדורג גבוה מול צמיד כושר', () => {
    const band = similarityScore('xiaomi smart band 10', 'צמיד כושר Xiaomi Smart Band 10');
    const bank = similarityScore('xiaomi smart band 10', 'מטען נייד Xiaomi Mi Power Bank 10,000mAh');
    assert.ok(band > bank, `צמיד ${band} חייב לגבור על מטען ${bank}`);
  });
});

describe('ציון דמיון', () => {
  test('שם חנות ארוך עדיין מזוהה', () => {
    const s = similarityScore('Xiaomi Smart Band 10',
      'צמיד כושר חכם Xiaomi Smart Band 10 - צבע Glacier Silver שנה אחריות');
    assert.ok(s >= 0.9, `ציון: ${s}`);
  });

  test('תקלדה בשם עדיין מזוהה', () => {
    const s = similarityScore('xiomi smart band 10', 'Xiaomi Smart Band 10');
    assert.ok(s >= 0.75, `ציון: ${s}`);
  });

  test('מוצר אחר מקבל ציון נמוך', () => {
    const s = similarityScore('Xiaomi Smart Band 10', 'מקרר Samsung RT48 470 ליטר');
    assert.ok(s < 0.4, `ציון: ${s}`);
  });

  test('מילות רעש של החנות לא פוגעות בציון', () => {
    const s = similarityScore('iPhone 16 128GB',
      'סמארטפון Apple iPhone 16 128GB שנה אחריות ע"י היבואן הרשמי');
    assert.ok(s >= 0.9, `ציון: ${s}`);
  });
});

describe('נרמול', () => {
  test('גרשיים ורווחים כפולים מנוקים', () => {
    assert.equal(normalizeQuery('  iPhone   16״  '), 'iPhone 16');
  });
});
