/*
 * NaviSuite · Ruoli condivisi
 *
 * Sorgente unica per il riconoscimento di amministratori, super user e bariste.
 * Prima di questo file ogni pagina/modulo ripeteva la stessa logica: una
 * divergenza (il mancato controllo su `cognome`) era la causa storica del bug
 * per cui Hiba non veniva riconosciuta e non vedeva il proprio turno.
 *
 * Espone `window.NaviRoles`. Va caricato come primo script interno, prima di
 * shared-menu.js e turni-shared.js. Quei due moduli mantengono comunque un
 * fallback interno identico, per le pagine che non lo caricano
 * (es. gestione_navi.html).
 */
(function () {
  'use strict';

  const ADMIN_IDS = ['91', '92'];
  const idOf = agent => String(agent?.id || '').trim();
  const idOrAgentIdOf = agent => String(agent?.id || agent?.agentId || '').trim();
  const roleOf = agent => String(agent?.role || '').toLowerCase();
  const qualificaOf = agent => String(agent?.qualifica || '').toLowerCase();

  // Amministratore "pieno": ID storici oppure ruolo esplicito `admin`.
  function isAdminAgent(agent) {
    return ADMIN_IDS.includes(idOf(agent)) || roleOf(agent) === 'admin';
  }

  // Come sopra, ma riconosce anche `role == 'super_user'`. Usato dai moduli che
  // concedono al super user le stesse funzioni admin (Ponte Radio, Centro Push).
  function isAdminOrSuperUser(agent) {
    return ADMIN_IDS.includes(idOrAgentIdOf(agent)) || ['admin', 'super_user'].includes(roleOf(agent));
  }

  // Barista in base al ruolo o alla qualifica registrata nell'anagrafica.
  function isBaristaAgent(agent) {
    return roleOf(agent) === 'barista' || qualificaOf(agent) === 'barista';
  }

  // Hiba: barista con vista completa. Riconosciuta dall'ID sintetico
  // `BARISTA_HIBA` oppure dal nome/agente/cognome uguale a "HIBA".
  function isHibaBarista(agent) {
    if (idOf(agent).toUpperCase() === 'BARISTA_HIBA') return true;
    const label = String(agent?.name || agent?.agente || agent?.cognome || '').trim().toUpperCase();
    return isBaristaAgent(agent) && label === 'HIBA';
  }

  // Residenza "Scali": un utente per ogni scalo (SCALO_DESENZANO, ...), che vede solo la pagina Scali del proprio scalo.
  const SCALI_RESIDENCE = 'Scali';
  const SCALI = ['Desenzano', 'Peschiera', 'Sirmione', 'Lazise', 'Bardolino', 'Garda', 'Torri', 'Portese', 'Salò',
    'Gardone', 'Maderno', 'Gargnano', 'Brenzone', 'Malcesine', 'Limone', 'Torbole', 'Riva'];
  const scaloId = nome => 'SCALO_' + nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const scaloAgents = () => SCALI.map(nome => ({ id: scaloId(nome), name: `SCALO ${nome.toLocaleUpperCase('it')}`, qualifica: 'scalo', residence: SCALI_RESIDENCE, role: 'scalo', scalo: nome }));
  const scaloOf = agent => SCALI.find(nome => scaloId(nome) === idOf(agent).toUpperCase()) || '';
  const isScaloAgent = agent => !!scaloOf(agent);

  // Accesso alle pagine scelto dagli admin (pagina Agenti): per ogni pagina i ruoli che la possono aprire
  // (gli admin sempre). Senza scelta valgono quelli di sempre: tutti tranne gli scali, che hanno solo Scali.
  // L'ultima scelta nota resta sul telefono, cosi' il controllo vale subito; poi si rilegge da Firebase.
  const PAGINE = [['oggi.html', 'Oggi'], ['naviturni.html', 'NaviTurni'], ['navidiaria.html', 'Distinta'], ['documenti.html', 'Documenti'],
    ['mio-turno.html', 'Il mio turno'], ['orario.html', 'Scali'], ['cambi_turno.html', 'Cambio turno'], ['quiz.html', 'Quiz'],
    ['impostazioni.html', 'Impostazioni'], ['verifica-busta.html', 'Verifica busta']];
  const RUOLI = [['agenti', 'Agenti'], ['uffici', 'Uffici'], ['scali', 'Scali'], ['bariste', 'Bariste']];
  const ruoloDi = agent => (isScaloAgent(agent) ? 'scali' : isBaristaAgent(agent) ? 'bariste'
    : String(agent?.residence || agent?.residenza || '').toLowerCase() === 'uffici' ? 'uffici' : 'agenti');
  // Verifica busta: di norma solo admin
  const predefiniti = file => (file === 'orario.html' ? ['agenti', 'uffici', 'scali', 'bariste'] : file === 'verifica-busta.html' ? [] : ['agenti', 'uffici', 'bariste']);
  const ACCESS_KEY = 'navisuite.pageAccess';
  const accesso = () => { try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || '{}') || {}; } catch { return {}; } };
  const sessione = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { return null; } };
  // ruoli che possono aprire la pagina ('admin' = la vecchia scelta "solo admin")
  const consentiti = (file, access = accesso()) => { const v = access[file]; return Array.isArray(v) ? v : v === 'admin' ? [] : predefiniti(file); };
  function puoAprire(file, agent = sessione(), access = accesso()) {
    file = String(file || 'index.html').toLowerCase();
    if (isAdminAgent(agent)) return true;
    if (PAGINE.some(([f]) => f === file)) return consentiti(file, access).includes(ruoloDi(agent));
    // le altre pagine (Home, cambio PIN, pagine admin con i loro controlli): agli scali solo Home e cambio PIN
    return !isScaloAgent(agent) || ['index.html', 'cambia-pin.html', ''].includes(file);
  }
  const pagineAperte = (agent = sessione(), access = accesso()) => PAGINE.map(([f]) => f).filter(f => puoAprire(f, agent, access));
  function applicaAccesso(access) {
    const agent = sessione();
    if (!agent?.id) return;
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const pin = file === 'navidiaria.html' && /[?&](open-)?pin=/.test(location.search); // cambio PIN: sempre
    if (!pin && !puoAprire(file, agent, access)) {
      const scalo = scaloOf(agent), prima = pagineAperte(agent, access)[0];
      location.replace(scalo && puoAprire('orario.html', agent, access) ? `orario.html?scalo=${encodeURIComponent(scalo)}` : scalo && prima ? prima : 'index.html?home=1');
      return;
    }
    // link alle pagine chiuse: nascosti nel menu e nella Home
    const chiuse = PAGINE.map(([f]) => f).filter(f => !puoAprire(f, agent, access));
    let style = document.getElementById('navi-page-access');
    if (!style) { style = document.createElement('style'); style.id = 'navi-page-access'; (document.head || document.documentElement).appendChild(style); }
    style.textContent = chiuse.map(f => `a[href^="${f}"]`).join(',') + (chiuse.length ? '{display:none!important}' : '');
  }
  try { applicaAccesso(accesso()); } catch { /* niente */ }
  window.addEventListener?.('load', async () => {
    try {
      const api = window.NaviAdminFirebase;
      if (!api?.getPageAccess) return;
      await api.ready;
      const access = await api.getPageAccess();
      localStorage.setItem(ACCESS_KEY, JSON.stringify(access || {}));
      applicaAccesso(access || {});
    } catch (error) { console.warn('Accesso pagine non aggiornato', error); }
  });

  window.NaviRoles = Object.freeze({
    PAGINE,
    RUOLI,
    ruoloDi,
    predefiniti,
    consentiti,
    puoAprire,
    pagineAperte,
    applicaAccesso,
    isScaloAgent,
    scaloOf,
    scaloAgents,
    SCALI_RESIDENCE,
    isAdminAgent,
    isAdminOrSuperUser,
    isBaristaAgent,
    isHibaBarista,
  });
})();
