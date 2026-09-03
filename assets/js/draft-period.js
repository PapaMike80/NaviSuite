(() => {
  const CACHE_KEY = 'navisuite.draftPeriod.v1';
  const DEFAULT_PERIOD = {start:'2026-08-10', end:'2026-09-06'};
  let current = readCache();

  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  function normalize(value) {
    const start = validDate(value?.start) ? String(value.start) : DEFAULT_PERIOD.start;
    const end = validDate(value?.end) ? String(value.end) : DEFAULT_PERIOD.end;
    return start <= end ? {start, end, updatedAt:String(value?.updatedAt || '')} : {...DEFAULT_PERIOD};
  }

  function readCache() {
    try { return normalize(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')); }
    catch (_) { return {...DEFAULT_PERIOD}; }
  }

  function store(value, notify = true) {
    current = normalize(value);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(current)); } catch (_) {}
    if (notify) window.dispatchEvent(new CustomEvent('navisuite-draft-period-updated', {detail:{...current}}));
    return {...current};
  }

  function contains(iso) {
    const date = String(iso || '').slice(0, 10);
    return validDate(date) && date >= current.start && date <= current.end;
  }

  async function refresh() {
    if (!window.NaviAdminFirebase?.getDraftPeriod) return {...current};
    try { return store(await window.NaviAdminFirebase.getDraftPeriod()); }
    catch (error) {
      console.warn('Periodo bozza Firebase non disponibile; uso la copia locale.', error);
      return {...current};
    }
  }

  async function save(value) {
    if (!window.NaviAdminFirebase?.saveDraftPeriod) throw new Error('Firebase non disponibile');
    return store(await window.NaviAdminFirebase.saveDraftPeriod(normalize(value)));
  }

  async function reset() {
    if (!window.NaviAdminFirebase?.resetDraftPeriod) throw new Error('Firebase non disponibile');
    await window.NaviAdminFirebase.resetDraftPeriod();
    localStorage.removeItem(CACHE_KEY);
    current = {...DEFAULT_PERIOD};
    window.dispatchEvent(new CustomEvent('navisuite-draft-period-updated', {detail:{...current}}));
    return true;
  }

  window.NaviDraftPeriod = {get:() => ({...current}), contains, refresh, save, reset, defaults:{...DEFAULT_PERIOD}};
  window.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 150));

  // Le Impostazioni caricano qui anche il modulo Calendario personale, così
  // la funzione resta confinata alla pagina senza appesantire il resto di NaviSuite.
  if (document.body?.classList.contains('impostazioni-page')) {
    const script = document.createElement('script');
    script.src = 'assets/js/calendar-settings.js?v=1';
    script.defer = true;
    document.head.appendChild(script);
  }
})();
