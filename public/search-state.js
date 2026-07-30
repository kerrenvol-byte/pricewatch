// מכונת המצבים של החיפוש — מודול משותף לדפדפן ולבדיקות.
// כל שינוי נראות של אזור התוצאות עובר דרך כאן בלבד, כדי שלא יישאר
// state מוסתר משיטוט קודם (זו הייתה תקלת ה-P0 בייצור).
//
// מצבים: idle | loading | success | partial | empty | error

// בריחת HTML — ההודעות מוזרקות כ-HTML ולכן כל ערך שמקורו במשתמש חייב לעבור כאן
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createSearchController({ fetchSearch, view }) {
  const ctrl = {
    state: 'idle',
    seq: 0,
    lastQuery: '',
    results: { grocery: [], zap: [] },
    search,
  };

  function apply(state, data = {}) {
    ctrl.state = state;

    if (state === 'loading') {
      view.showCandidates(false);
      view.setCandidatesHtml('');
      view.clearCompare();
      view.setStatus(data.message || 'loading');
      view.setSearchDisabled(true);
    } else if (state === 'success' || state === 'partial') {
      view.setSearchDisabled(false);
      view.setCandidatesHtml(data.html ?? '');
      view.showCandidates(true);              // תמיד מציגים כשיש תוצאות
      view.setStatus(state === 'partial' ? (data.message || 'partial') : '');
    } else {
      view.setSearchDisabled(false);
      view.showCandidates(false);
      view.setCandidatesHtml('');
      view.setStatus(data.message || (state === 'empty' ? 'לא נמצאו תוצאות' : ''));
    }

    // אחרון — כדי שמאזינים שנרשמים כאן יפעלו על ה-DOM שכבר עודכן
    view.onState?.(state, data);
  }

  async function search(q) {
    const query = String(q || '').trim();
    if (!query) return;
    // שליחה כפולה של אותה שאילתה בזמן טעינה — מתעלמים.
    // שאילתה *אחרת* בזמן טעינה — מותרת, והיא גוברת על הקודמת (seq).
    if (ctrl.state === 'loading' && query === ctrl.lastQuery) return;

    const seq = ++ctrl.seq;
    ctrl.lastQuery = query;
    apply('loading', { message: `מחפש "${query}"…` });

    let r;
    try {
      r = await fetchSearch(query);
    } catch (e) {
      if (seq !== ctrl.seq) return;            // חיפוש חדש כבר רץ
      apply('error', { message: `⚠️ החיפוש נכשל. ${e?.message || ''}`.trim() });
      return;
    }
    if (seq !== ctrl.seq) return;              // תשובה איטית מחיפוש קודם — מתעלמים

    const grocery = Array.isArray(r?.grocery) ? r.grocery : [];
    const zap = Array.isArray(r?.zap) ? r.zap : [];
    ctrl.results = { grocery, zap };

    const failed = [];
    if (!Array.isArray(r?.grocery) && r?.grocery?.error) failed.push('מזון ופארם');
    if (!Array.isArray(r?.zap) && r?.zap?.error) failed.push('אלקטרוניקה');

    ctrl.usedQuery = r?.usedQuery || null;   // ניסוח חלופי שהמערכת מצאה לבד

    const total = grocery.length + zap.length;
    if (total > 0) {
      const notes = [];
      if (ctrl.usedQuery) {
        notes.push(`🔍 לא נמצאו תוצאות ל"${escapeHtml(query)}" — מוצגות תוצאות עבור "${escapeHtml(ctrl.usedQuery)}"`);
      }
      if (failed.length) {
        notes.push(`⚠️ חלק מהמקורות לא הגיבו (${escapeHtml(failed.join(', '))}) — מוצגות התוצאות שנמצאו`);
      }
      apply(failed.length || ctrl.usedQuery ? 'partial' : 'success', {
        html: view.renderResults ? view.renderResults(ctrl.results, query) : '',
        message: notes.join('<br>'),
      });
    } else if (failed.length >= 2) {
      apply('error', { message: '⚠️ שני מקורות המידע לא הגיבו. נסי שוב בעוד רגע.' });
    } else {
      apply('empty', { message: `לא נמצאו תוצאות ל"${query}"` });
    }
  }

  return ctrl;
}
