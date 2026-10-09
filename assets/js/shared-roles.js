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

  // Gli utenti scalo possono aprire solo la pagina Scali (orario.html) del proprio scalo; il login (index.html) li porta li'.
  try {
    const session = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
    const scalo = scaloOf(session);
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const pin = /[?&](open-)?pin=/.test(location.search);
    if (scalo && !(file === 'orario.html' || file === 'index.html' || (file === 'navidiaria.html' && pin))) {
      location.replace(`orario.html?scalo=${encodeURIComponent(scalo)}`);
    }
  } catch { /* sessione non leggibile */ }

  // Accesso alle pagine scelto dagli admin (pagina Agenti): 'admin' = solo amministratori. L'ultima scelta
  // nota resta sul telefono, cosi' il controllo vale subito; poi si rilegge da Firebase.
  const PAGINE = [['oggi.html', 'Oggi'], ['naviturni.html', 'NaviTurni'], ['navidiaria.html', 'Distinta'], ['documenti.html', 'Documenti'],
    ['mio-turno.html', 'Il mio turno'], ['orario.html', 'Scali'], ['cambi_turno.html', 'Cambio turno'], ['quiz.html', 'Quiz'],
    ['impostazioni.html', 'Impostazioni'], ['verifica-busta.html', 'Verifica busta']];
  const ACCESS_KEY = 'navisuite.pageAccess';
  const accesso = () => { try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || '{}') || {}; } catch { return {}; } };
  const sessione = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { return null; } };
  const puoAprire = (file, agent = sessione(), access = accesso()) => access[String(file).toLowerCase()] !== 'admin' || isAdminAgent(agent);
  function applicaAccesso(access) {
    const agent = sessione();
    if (!agent?.id) return;
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!puoAprire(file, agent, access)) { location.replace('index.html?home=1'); return; }
    // link a pagine riservate: nascosti nel menu e nella Home
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
    puoAprire,
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
