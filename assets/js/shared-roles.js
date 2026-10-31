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

  const ADMIN_IDS = ['91', '92', 'AG_PEDRONI_M', 'AG_STUMPO_D'];
  const idOf = agent => String(agent?.id || '').trim();
  const idOrAgentIdOf = agent => String(agent?.id || agent?.agentId || '').trim();
  const roleOf = agent => String(agent?.role || '').toLowerCase();
  const qualificaOf = agent => String(agent?.qualifica || '').toLowerCase();

  // Amministratore "pieno": ID storici oppure ruolo esplicito `admin`.
  function isAdminAgent(agent) {
    if (!agent) return false;
    const id = idOrAgentIdOf(agent);
    const name = String(agent.name || agent.agente || agent.cognome || '');
    return ADMIN_IDS.includes(id) || roleOf(agent) === 'admin' || /\bPEDRONI\b/i.test(name);
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
    ['mio-turno.html', 'Il mio turno'], ['orario.html', 'Scali'], ['orari.html', 'Orari'], ['cambi_turno.html', 'Cambio turno'], ['quiz.html', 'Concorsi'],
    ['impostazioni.html', 'Impostazioni'], ['verifica-busta.html', 'Verifica busta'], ['comitive.html', 'Comitive'], ['agenti.html', 'Agenti'], ['movimento.html', 'Movimento'], ['collegamenti.html', 'Collegamenti'], ['backup-dati.html', 'Backup e fonti'], ['controllo_cassa.html', 'Controllo cassa']];
  const RUOLI = [['agenti', 'Agenti'], ['uffici', 'Uffici'], ['scali', 'Scali'], ['bariste', 'Bariste']];
  const ruoloDi = agent => (isScaloAgent(agent) ? 'scali' : isBaristaAgent(agent) ? 'bariste'
    : String(agent?.residence || agent?.residenza || '').toLowerCase() === 'uffici' ? 'uffici' : 'agenti');
  // Verifica busta: di norma solo admin
  const predefiniti = file => (['orario.html', 'orari.html'].includes(file) ? ['agenti', 'uffici', 'scali', 'bariste'] : ['verifica-busta.html', 'comitive.html', 'agenti.html', 'movimento.html', 'collegamenti.html'].includes(file) ? [] : ['agenti', 'uffici', 'bariste']);
  const ACCESS_KEY = 'navisuite.pageAccess';
  const accesso = () => { try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || '{}') || {}; } catch { return {}; } };
  const sessione = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { return null; } };
  // ruoli che possono aprire la pagina ('admin' = la vecchia scelta "solo admin")
  const consentiti = (file, access = accesso()) => { const v = access[file]; return Array.isArray(v) ? v : v === 'admin' ? [] : predefiniti(file); };
  // Sezioni del menu e della Home: di default come sempre, ma gli admin possono spostare le pagine (pagina Agenti > Accesso alle pagine)
  const SEZIONI = [['principali', 'PRINCIPALI'], ['altre', 'UTENTI'], ['amministrazione', 'AMMINISTRAZIONE']];
  const SEZIONE_PREDEFINITA = { 'mio-turno.html': 'principali', 'orario.html': 'principali', 'naviturni.html': 'principali', 'oggi.html': 'principali', 'navidiaria.html': 'principali',
    'quiz.html': 'altre', 'comitive.html': 'amministrazione', 'verifica-busta.html': 'amministrazione', 'agenti.html': 'amministrazione', 'aggiornamenti.html': 'amministrazione',
    'movimento.html': 'amministrazione', 'collegamenti.html': 'amministrazione' };
  const sezionePredefinita = file => SEZIONE_PREDEFINITA[String(file || '').toLowerCase().split('?')[0]] || 'altre';
  // Disposizione del menu. Gli admin la decidono per tutti (sezioni + ordine, salvati insieme all'accesso); ogni agente puo' poi
  // spostare le sue icone: la scelta resta sul suo telefono e vale finche' un admin non preme "Imposta per tutti" (menuEpoch).
  // NaviBeta e' in sola lettura: la prova dell'admin resta solo sul dispositivo (non si scrive su Firebase).
  const LOCALE_KEY = 'navisuite.menuLocale', PERSONALE_PREFIX = 'navisuite.menuPersonale.';
  const leggiJson = chiave => { try { return JSON.parse(localStorage.getItem(chiave) || 'null'); } catch { return null; } };
  const personale = (agent = sessione(), access = accesso()) => {
    const p = leggiJson(PERSONALE_PREFIX + idOf(agent));
    return p && Number(p.epoch || 0) === Number(access?.menuEpoch || 0) ? p : null;
  };
  const disposizioneGlobale = (access = accesso()) => ({ sezioni: access?.sezioni || {}, ordine: Array.isArray(access?.ordine) ? access.ordine : [] });
  const disposizione = (access = accesso(), agent = sessione()) => {
    if (isAdminAgent(agent)) { if (window.__naviBetaReadOnly) { const l = leggiJson(LOCALE_KEY); if (l) return l; } return disposizioneGlobale(access); }
    const g = disposizioneGlobale(access), p = personale(agent, access);
    return p ? { sezioni: { ...g.sezioni, ...(p.sezioni || {}) }, ordine: Array.isArray(p.ordine) && p.ordine.length ? p.ordine : g.ordine } : g;
  };
  const ordineDi = (file, access = accesso()) => { const i = disposizione(access).ordine.indexOf(String(file || '').toLowerCase().split('?')[0]); return i < 0 ? 1e6 : i; };
  const scegliSezione = (map, file) => { const scelta = map?.[file]; return SEZIONI.some(([k]) => k === scelta) ? scelta : sezionePredefinita(file); };
  const sezioneDi = (file, access = accesso()) => scegliSezione(disposizione(access).sezioni, String(file || '').toLowerCase().split('?')[0]);
  const haScelteMie = (agent = sessione()) => !!personale(agent) || (isAdminAgent(agent) && !!window.__naviBetaReadOnly && !!leggiJson(LOCALE_KEY));
  const azzeraMie = (agent = sessione()) => { try { localStorage.removeItem(PERSONALE_PREFIX + idOf(agent)); localStorage.removeItem(LOCALE_KEY); } catch { /* niente */ } };
  // Salva dopo uno spostamento nel menu. ordine = elenco delle pagine, sezioni = pagina -> sezione.
  async function salvaMenu({ ordine, sezioni }) {
    const agent = sessione(), access = accesso(), g = disposizioneGlobale(access);
    if (!isAdminAgent(agent)) { // agente: scelta personale, solo sul suo telefono
      const diff = Object.fromEntries(Object.entries(sezioni).filter(([f, sez]) => sez !== scegliSezione(g.sezioni, f)));
      localStorage.setItem(PERSONALE_PREFIX + idOf(agent), JSON.stringify({ ordine, sezioni: diff, epoch: Number(access.menuEpoch || 0) }));
      return { personale: true };
    }
    const rimasta = Object.fromEntries(Object.entries(sezioni).filter(([f, sez]) => sez !== sezionePredefinita(f)));
    if (window.__naviBetaReadOnly) { localStorage.setItem(LOCALE_KEY, JSON.stringify({ ordine, sezioni: rimasta })); return { locale: true }; }
    const api = window.NaviAdminFirebase;
    await api.ready;
    const remoto = (await api.getPageAccess()) || {};
    const sezioniFinali = { ...(remoto.sezioni || {}) };
    Object.keys(sezioni).forEach(f => { delete sezioniFinali[f]; });
    Object.assign(sezioniFinali, rimasta);
    const finale = { ...remoto, ordine, sezioni: sezioniFinali };
    // una pagina spostata in Amministrazione la aprono solo gli admin; se ne esce torna all'accesso di prima
    PAGINE.forEach(([f]) => {
      if (!(f in sezioni)) return;
      const era = scegliSezione(remoto.sezioni, f), ora = sezioni[f];
      if (ora === 'amministrazione' && era !== 'amministrazione') { if (predefiniti(f).length) finale[f] = []; else delete finale[f]; }
      else if (era === 'amministrazione' && ora !== 'amministrazione' && (finale[f] === 'admin' || (Array.isArray(finale[f]) && !finale[f].length))) delete finale[f];
    });
    const salvato = await api.savePageAccess(finale);
    localStorage.setItem(ACCESS_KEY, JSON.stringify(salvato));
    return { locale: false };
  }
  // "Imposta per tutti": le scelte personali degli agenti non valgono piu' (nuovo menuEpoch)
  async function impostaPerTutti() {
    if (window.__naviBetaReadOnly) return { locale: true };
    const api = window.NaviAdminFirebase;
    await api.ready;
    const remoto = (await api.getPageAccess()) || {};
    const salvato = await api.savePageAccess({ ...remoto, menuEpoch: Date.now() });
    localStorage.setItem(ACCESS_KEY, JSON.stringify(salvato));
    return { locale: false };
  }
  // Pagina messa dagli admin nella sezione Amministrazione (disposizione per tutti, non le scelte personali)
  const inAmministrazione = (file, access = accesso()) => scegliSezione(disposizioneGlobale(access).sezioni, file) === 'amministrazione';
  function puoAprire(file, agent = sessione(), access = accesso()) {
    file = String(file || 'index.html').toLowerCase();
    if (isAdminAgent(agent)) return true;
    if (PAGINE.some(([f]) => f === file)) return consentiti(file, access).includes(ruoloDi(agent));
    // le pagine senza scelta d'accesso (giochi, pagine nuove...) spostate in Amministrazione: solo admin
    if (inAmministrazione(file, access)) return false;
    // le altre pagine (Home, cambio PIN, pagine admin con i loro controlli): agli scali solo Home e cambio PIN
    return !isScaloAgent(agent) || ['index.html', 'cambia-pin.html', ''].includes(file);
  }
  const pagineAperte = (agent = sessione(), access = accesso()) => PAGINE.map(([f]) => f).filter(f => puoAprire(f, agent, access));
  // aspetta = true: la copia sul telefono puo' essere vecchia, quindi prima di mandar via si rilegge Firebase
  let rimanda = false;
  function applicaAccesso(access, aspetta = false) {
    const agent = sessione();
    if (!agent?.id) return;
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const pin = file === 'navidiaria.html' && /[?&](open-)?pin=/.test(location.search); // cambio PIN: sempre
    if (!pin && !puoAprire(file, agent, access)) {
      if (aspetta) { rimanda = true; return; }
      const scalo = scaloOf(agent), prima = pagineAperte(agent, access)[0];
      location.replace(scalo && puoAprire('orario.html', agent, access) ? `orario.html?scalo=${encodeURIComponent(scalo)}` : scalo && prima ? prima : 'index.html?home=1');
      return;
    }
    // link alle pagine chiuse: nascosti nel menu e nella Home
    const altre = [...Object.keys(disposizioneGlobale(access).sezioni), ...Object.keys(SEZIONE_PREDEFINITA)].filter(f => !PAGINE.some(([p]) => p === f));
    const chiuse = [...new Set([...PAGINE.map(([f]) => f), ...altre])].filter(f => !puoAprire(f, agent, access));
    let style = document.getElementById('navi-page-access');
    if (!style) { style = document.createElement('style'); style.id = 'navi-page-access'; (document.head || document.documentElement).appendChild(style); }
    style.textContent = chiuse.map(f => `a[href^="${f}"]`).join(',') + (chiuse.length ? '{display:none!important}' : '');
    try { window.dispatchEvent(new CustomEvent('navi-page-access', { detail: { chiuse } })); } catch { /* niente */ }
  }
  // Prima pagina imposta dagli admin: a ogni nuovo reset (ts) si cancellano le scelte personali del telefono e
  // vale la pagina scelta, se il ruolo la puo' aprire (altrimenti la predefinita). Gli scali aprono sempre il loro scalo.
  const RESET_KEY = 'navisuite.startPageReset', FORZATA_KEY = 'navisuite.startPageForzata';
  function applicaPaginaIniziale(dato = (() => { try { return JSON.parse(localStorage.getItem(FORZATA_KEY) || 'null'); } catch { return null; } })()) {
    if (!dato?.ts) return;
    try {
      if (localStorage.getItem(RESET_KEY) === dato.ts) return;
      Object.keys(localStorage).filter(k => k.startsWith('navisuite.startPage.')).forEach(k => localStorage.removeItem(k));
      const agent = sessione(), pagina = dato.pagina === 'auto' || dato.pagina === 'index' ? dato.pagina : `${dato.pagina}.html`;
      const file = pagina === 'index' ? 'index.html' : pagina;
      if (agent?.id && (file === 'auto' || puoAprire(file, agent))) localStorage.setItem(`navisuite.startPage.${agent.id}`, file);
      localStorage.setItem(RESET_KEY, dato.ts);
    } catch { /* niente */ }
  }
  try { applicaAccesso(accesso(), true); applicaPaginaIniziale(); } catch { /* niente */ }
  window.addEventListener?.('load', async () => {
    try {
      const api = window.NaviAdminFirebase;
      if (!api?.getPageAccess) { if (rimanda) applicaAccesso(accesso()); return; }
      await api.ready;
      const access = await api.getPageAccess();
      localStorage.setItem(ACCESS_KEY, JSON.stringify(access || {}));
      applicaAccesso(access || {});
      if (api.getPaginaIniziale) {
        const dato = await api.getPaginaIniziale();
        if (dato?.ts) { localStorage.setItem(FORZATA_KEY, JSON.stringify(dato)); applicaPaginaIniziale(dato); }
      }
    } catch (error) { console.warn('Accesso pagine non aggiornato', error); if (rimanda) applicaAccesso(accesso()); }
  });

  window.NaviRoles = Object.freeze({
    PAGINE,
    RUOLI,
    ruoloDi,
    predefiniti,
    consentiti,
    SEZIONI,
    sezioneDi,
    ordineDi,
    salvaMenu,
    impostaPerTutti,
    haScelteMie,
    azzeraMie,
    sezionePredefinita,
    puoAprire,
    pagineAperte,
    applicaAccesso,
    applicaPaginaIniziale,
    isScaloAgent,
    scaloOf,
    scaloAgents,
    SCALI_RESIDENCE,
    isAdminAgent,
    isAdminOrSuperUser,
    isBaristaAgent,
    isHibaBarista,
  });

  // Data simulata fallback per retrocompatibilità se simulated-date.js non è caricato prima
  if (!window.NaviDate) {
    window.NaviDate = {
      getSimulatedDate: function () {
        try {
          const p = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
          if (!isAdminAgent(p)) return null;
          const v = localStorage.getItem('navisuite.simulatedDate');
          return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
        } catch (_) { return null; }
      },
      todayIso: function () {
        const s = window.NaviDate?.getSimulatedDate?.();
        if (s) return s;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      },
      isSimulated: function () {
        return !!window.NaviDate?.getSimulatedDate?.();
      }
    };
  }
})();
