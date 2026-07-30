// הבנת שאילתות חיפוש — כדי שגם שם לא מדויק ימצא את המוצר.
// מטפל ב: תקלדות, מקלדת בשפה הלא נכונה, שמות מותג בעברית/אנגלית,
// כינויים מסחריים (Mi Band מול Smart Band), וריבוי ניסוחים.

// ---------- 1. תיקון פריסת מקלדת ----------
// אנגלית שהוקלדה כשהמקלדת בעברית (ולהפך) — תקלה נפוצה מאוד.
const EN_TO_HE = {
  q: '/', w: "'", e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ',
  a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך', ';': 'ף',
  z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ', ',': 'ת', '.': 'ץ', '/': '.',
};
const HE_TO_EN = Object.fromEntries(Object.entries(EN_TO_HE).map(([e, h]) => [h, e]));

const isHebrew = s => /[֐-׿]/.test(s);
const isLatin = s => /[a-zA-Z]/.test(s);

// טקסט לטיני ללא תנועות הוא כמעט תמיד עברית שהוקלדה בפריסה שגויה
const looksLikeGibberishLatin = s =>
  s.split(/\s+/).filter(w => w.length >= 3).some(w => !/[aeiou]/i.test(w));

// מוודא שהתרגום אכן הפיק טקסט בעל משמעות ולא רצף אותיות אקראי.
// בלי זה, מילה עברית תקינה כמו "שיאומי" הייתה מתורגמת ל-"ahtunh" ומוצעת כחיפוש.
function looksMeaningful(text) {
  const lower = text.toLowerCase();
  for (const term of SYNONYMS.keys()) {
    if (term.length >= 3 && lower.includes(term)) return true;
  }
  return false;
}

export function fixKeyboardLayout(q) {
  const s = String(q || '');
  const out = [];
  // אנגלית → עברית (למשל "tcyhj" שהתכוון ל"אבטיח")
  if (isLatin(s) && !isHebrew(s)) {
    const he = s.toLowerCase().split('').map(c => EN_TO_HE[c] ?? c).join('');
    if (isHebrew(he) && (looksLikeGibberishLatin(s) || looksMeaningful(he))) out.push(he);
  }
  // עברית → אנגלית (למשל "ןפרםמק" שהתכוון ל-iphone)
  if (isHebrew(s) && !isLatin(s)) {
    const en = s.split('').map(c => HE_TO_EN[c] ?? c).join('');
    if (/[a-z]{3,}/.test(en) && looksMeaningful(en)) out.push(en);
  }
  return out;
}

// ---------- 2. מילון מותגים וכינויים ----------
// כל קבוצה = מונחים שמתייחסים לאותו דבר. החיפוש ינסה את כולם.
const SYNONYM_GROUPS = [
  // מותגים — עברית ↔ אנגלית
  ['xiaomi', 'שיאומי', 'שאומי', 'קסיאומי'],
  ['apple', 'אפל'], ['iphone', 'אייפון', 'איפון'], ['ipad', 'אייפד'],
  ['airpods', 'אירפודס', 'איירפודס'], ['macbook', 'מקבוק'],
  ['samsung', 'סמסונג'], ['galaxy', 'גלקסי'],
  ['lg', 'אל ג׳י', 'אלג׳י'], ['sony', 'סוני'], ['philips', 'פיליפס'],
  ['bosch', 'בוש'], ['siemens', 'סימנס'], ['electra', 'אלקטרה'],
  ['tadiran', 'תדיראן'], ['hisense', 'היסנס'], ['toshiba', 'טושיבה'],
  ['whirlpool', 'וירפול'], ['beko', 'בקו'], ['candy', 'קנדי'],
  ['dyson', 'דייסון'], ['braun', 'בראון'], ['oral-b', 'אורל בי', 'oralb'],
  ['huawei', 'huwaei', 'וואווי'], ['lenovo', 'לנובו'], ['asus', 'אסוס'],
  ['acer', 'אייסר'], ['dell', 'דל'], ['hp', 'אייץ׳ פי'],
  ['jbl', 'ג׳יי בי אל'], ['bose', 'בוס'], ['anker', 'אנקר'],
  ['garmin', 'גרמין'], ['fitbit', 'פיטביט'], ['gopro', 'גופרו'],
  ['nintendo', 'נינטנדו'], ['playstation', 'פלייסטיישן', 'ps5'],
  ['xbox', 'אקסבוקס'], ['nespresso', 'נספרסו'], ['delonghi', 'דלונגי'],
  ['tefal', 'טפאל'], ['moulinex', 'מולינקס'], ['kitchenaid', 'קיטצ׳נאייד'],

  // כינויי קווי מוצר — כאן נופלים רוב החיפושים
  ['mi band', 'smart band', 'redmi band', 'צמיד כושר'],
  ['mi watch', 'smart watch', 'watch', 'שעון חכם'],
  ['redmi', 'רדמי'], ['poco', 'פוקו'], ['galaxy watch', 'שעון סמסונג'],
  ['galaxy buds', 'אוזניות סמסונג'],
  ['robot vacuum', 'שואב רובוטי', 'שואב אבק רובוטי'],
  ['air fryer', 'אייר פריירר', 'סיר טיגון', 'טוסטר אויר'],
  ['soundbar', 'סאונדבר', 'מקרן קול'],

  // קטגוריות נפוצות — עברית ↔ אנגלית
  ['tv', 'טלוויזיה', 'טלויזיה'], ['refrigerator', 'מקרר', 'fridge'],
  ['washing machine', 'מכונת כביסה'], ['dryer', 'מייבש'],
  ['dishwasher', 'מדיח', 'מדיח כלים'], ['oven', 'תנור'],
  ['microwave', 'מיקרוגל'], ['vacuum', 'שואב אבק'],
  ['laptop', 'מחשב נייד'], ['headphones', 'אוזניות'],
  ['speaker', 'רמקול'], ['monitor', 'מסך'], ['printer', 'מדפסת'],
  ['air conditioner', 'מזגן'], ['heater', 'תנור חימום', 'מפזר חום'],
  ['kettle', 'קומקום'], ['blender', 'בלנדר'], ['mixer', 'מיקסר'],
  ['coffee machine', 'מכונת קפה'], ['stroller', 'עגלת תינוק'],
  ['scooter', 'קורקינט'], ['shaver', 'מכונת גילוח'],
  ['epilator', 'מסיר שיער'], ['hair dryer', 'מייבש שיער', 'פן'],
];

// מפה: מונח → כל המונחים המקבילים לו
const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    SYNONYMS.set(term, group.filter(t => t !== term));
  }
}

// ---------- 3. תיקון תקלדות ----------
export function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;   // קיצור דרך
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// סובלנות לתקלדה לפי אורך המילה.
// מילים קצרות דורשות התאמה מדויקת — אחרת "band" היה מותאם ל-"bank"
// ומטען נייד (Power Bank) היה מדורג כצמיד כושר (Smart Band).
export function tokensSimilar(a, b) {
  if (a === b) return true;
  const len = Math.max(a.length, b.length);
  if (len < 5) return false;                 // עד 4 תווים — התאמה מדויקת בלבד
  const tolerance = len >= 8 ? 2 : 1;
  return editDistance(a, b) <= tolerance;
}

// ---------- 4. הרחבת שאילתה ----------
export function normalizeQuery(q) {
  return String(q || '')
    .replace(/[‎‏‪-‮]/g, '')  // תווי כיווניות
    .replace(/["'׳״`]/g, '')                       // גרשיים
    .replace(/\s+/g, ' ')
    .trim();
}

// מחזיר רשימת וריאציות לחיפוש, מהסביר ביותר לפחות סביר.
// המערכת תנסה אותן בזו אחר זו עד שיימצאו תוצאות.
export function expandQuery(raw, { max = 6 } = {}) {
  const base = normalizeQuery(raw);
  if (!base) return [];
  const variants = [base];
  const push = v => {
    const n = normalizeQuery(v);
    if (n && n.toLowerCase() !== base.toLowerCase() && !variants.some(x => x.toLowerCase() === n.toLowerCase())) {
      variants.push(n);
    }
  };

  // א. מקלדת בשפה הלא נכונה
  for (const fixed of fixKeyboardLayout(base)) push(fixed);

  // ב. החלפת מונחים נרדפים (ביטויים ארוכים קודם, כדי ש"mi band" ייתפס לפני "band")
  const lower = base.toLowerCase();
  const terms = [...SYNONYMS.keys()].sort((a, b) => b.length - a.length);
  for (const term of terms) {
    if (!lower.includes(term)) continue;
    for (const alt of SYNONYMS.get(term)) {
      push(lower.replace(term, alt));
    }
  }

  // ג. הסרת מילת המותג — לפעמים החנות לא כוללת אותה בשם
  const words = base.split(' ');
  if (words.length >= 3) push(words.slice(1).join(' '));

  // ד. שלד מספרי: מותג + מספר דגם בלבד (למשל "Xiaomi 10")
  const nums = base.match(/\b[\w-]*\d[\w-]*\b/g);
  if (nums && words.length > 2) push([words[0], ...nums].join(' '));

  return variants.slice(0, max);
}

// ---------- 5. התאמה גמישה בין שם מבוקש לשם בחנות ----------
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'של', 'עם', 'את', 'אחריות', 'יבואן', 'רשמי',
  'שנה', 'שנתיים', 'חדש', 'כולל', 'דגם', 'צבע', 'ב', 'ל', 'מ',
]);

export function meaningfulTokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/(\d+)\s*(gb|tb|mm|inch|״|")/g, '$1$2')
    .replace(/[^a-z0-9֐-׿]+/g, ' ')
    .split(/\s+/)
    .filter(t => t && t.length >= 2 && !STOP_WORDS.has(t));
}

// ציון התאמה 0..1 בין שם מבוקש לשם מוצר בחנות, עם סובלנות לתקלדות
export function similarityScore(query, candidate) {
  const q = meaningfulTokens(query);
  const c = meaningfulTokens(candidate);
  if (!q.length || !c.length) return 0;
  let hits = 0;
  for (const qt of q) {
    if (c.some(ct => ct === qt || tokensSimilar(qt, ct))) hits++;
    else if (SYNONYMS.has(qt) && SYNONYMS.get(qt).some(alt =>
      alt.split(' ').every(w => c.some(ct => ct === w || tokensSimilar(w, ct))))) hits++;
  }
  return hits / q.length;
}
