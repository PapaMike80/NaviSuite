// Avvisi degli arrivi con l'app aperta (pagine Servizi a terra, Il mio turno e Orario): nelle
// giornate a terra mostra la notifica 10 minuti prima di ogni nave in arrivo, con pontile e
// comandante (push-arrivi.js). Serve il permesso notifiche (Impostazioni > Notifiche) e la voce
// "Arrivi delle navi" attiva. Con l'app chiusa le stesse notifiche le manda il push-worker: hanno lo
// stesso tag, quindi non arrivano doppie.
(function () {
  'use strict';

  const A = window.NaviPushArrivi;
  if (!A || !('Notification' in window)) return;
  const SENT_KEY = 'navisuite.arrivi.inviate.v1';
  const PONTILI_CACHE = 'navisuite.serviziTerra.pontili';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const profile = () => readJson('naviturni_logged_agent', null) || readJson('navidiaria.activeAgent', null);
  const attivi = id => readJson(`navisuite.push.preferences.${id}`, {})?.arrivals !== false;

  const state = { schedule: null, turniNavi: [], pontili: readJson(PONTILI_CACHE, {}) || {} };

  async function mostra(item) {
    const options = { body: item.body, tag: item.tag, renotify: true, icon: 'assets/images/icona_192.png', badge: 'assets/images/icona_192.png', data: { url: item.url, kind: 'arrivo' } };
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.('./');
      if (reg?.showNotification) return await reg.showNotification(item.title, options);
    } catch { /* senza service worker: notifica della pagina */ }
    const notification = new Notification(item.title, options);
    notification.onclick = () => { window.focus(); location.href = item.url; };
  }

  function controlla() {
    const p = profile();
    if (!p?.id || !state.schedule || Notification.permission !== 'granted' || !attivi(p.id)) return;
    const now = new Date();
    const day = iso(now);
    const data = { ...state.schedule, turni_navi: [...(state.schedule.turni_navi || []), ...state.turniNavi] };
    let lista = [];
    try { lista = A.notifiche(data, p.id, day, { pontili: state.pontili, agentName: p.name }); } catch (error) { console.warn('Avvisi arrivi:', error); return; }
    const sent = readJson(SENT_KEY, {}) || {};
    Object.keys(sent).forEach(tag => { if (!tag.includes(`-${day}-`)) delete sent[tag]; });
    A.dovute(lista, now.getHours() * 60 + now.getMinutes()).filter(item => !sent[item.tag]).forEach(item => {
      sent[item.tag] = Date.now();
      mostra(item).catch(error => console.warn('Avviso arrivo non mostrato:', error));
    });
    try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch { /* niente memoria: al massimo un doppione */ }
  }

  async function aggiorna() {
    const provider = window.NaviAdminFirebase;
    try { state.turniNavi = await provider?.getTurniNavi?.() || state.turniNavi; } catch { /* restano quelli di prima */ }
    try { state.pontili = await provider?.getPontiliCorse?.('DESENZANO') || state.pontili; } catch { state.pontili = readJson(PONTILI_CACHE, {}) || state.pontili; }
    controlla();
  }

  function avvia() {
    window.NaviSharedData?.loadCacheFirst?.(data => { state.schedule = data; controlla(); })?.catch?.(() => {});
    aggiorna();
    setInterval(controlla, 30000);
    setInterval(aggiorna, 5 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) aggiorna(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia, { once: true });
  else avvia();
})();
