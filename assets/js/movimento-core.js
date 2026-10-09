/*
 * NaviSuite · Movimento — parte comune ai tre tab (Corse, Navi, Agenti; solo admin, gate anche in
 * shared-menu.js): giorno scelto, dati (turni degli agenti, turni nave, anagrafica navi), salvataggi
 * su Firebase e cambio di tab. Le viste (movimento-corse.js, movimento.js, movimento-agenti.js) si
 * registrano con NaviMovimento.vista(tab, render) e si ridisegnano quando i dati o il giorno cambiano.
 */
(() => {
  'use strict';

  const O = window.NaviOrarioGiorno;
  const G = window.NaviTurniGiorno;
  const T = window.NaviServiziTerra;
  const $ = id => document.getElementById(id);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const TABS = ['corse', 'navi', 'agenti', 'richieste'];

  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { profile = null; }
  if (!profile || !window.NaviRoles?.isAdminAgent(profile) || !$('mov-tabs')) return;
  const autore = String(profile.name || profile.agente || profile.id || '');

  const state = { approvazioni: {}, day: iso(new Date()), tab: 'corse', schedule: null, turniNavi: [], fleet: {}, fleetMeta: { updatedAt: '', updatedBy: '' }, oggi: {}, busy: false };
  const viste = {};

  function setStatus(text, kind = '') { const el = $('mov-status'); el.textContent = text; el.className = `mov-status ${kind}`.trim(); }

  // Turni nave: quelli del Movimento e degli O.d.S. appena letti vincono sulla copia dei turni condivisi.
  function righeNavi() {
    const key = row => `${row?.data || ''}|${String(row?.corsa || '').toUpperCase()}|${String(row?.nave || '').trim().toUpperCase()}`;
    const fresh = new Set(state.turniNavi.map(key));
    const base = (state.schedule?.turni_navi || []).filter(row => row?.fonte !== 'movimento' && !fresh.has(key(row)));
    return [...base, ...state.turniNavi];
  }
  // Turni nave in servizio nel giorno / fermi (D3, D4... nell'orario invernale).
  const TUTTI_I_TURNI = ['D1', 'D2', 'D3', 'D4', 'P1', 'P2', 'P3', 'R1', 'R2', 'R3', 'R4', 'M1', 'T1', 'T2', 'SR1', 'SR2'];
  // I turni dell'orario in vigore, piu' quelli ripresi dal Movimento (es. D3 o D4 estivi); fermi: tutti gli altri, anche quelli dell'orario estivo.
  const turniCodici = day => {
    const riprese = Object.keys(window.NaviStagione || {}).filter(code => !O.TURNI.includes(code) && code !== 'BIS' && O.inServizio(code, day));
    return [...O.TURNI.slice(0, 2), 'BIS', ...O.TURNI.slice(2), ...riprese].filter(code => O.inServizio(code, day));
  };
  const turniFermi = day => [...new Set([...TUTTI_I_TURNI, ...Object.keys(window.NaviCourseInfo?.COURSE_TRIPS || {}), ...Object.keys(window.NaviStagione || {})])]
    .filter(code => code !== 'BIS' && !turniCodici(day).includes(code));

  // Variazione del Movimento di un agente nel giorno (per "annulla").
  const variazioneMovimento = (day, id) => (state.schedule?.variazioni_ods || [])
    .filter(item => item?.ods === 'MOVIMENTO' && String(item.data).slice(0, 10) === day && String(item.id_agente) === String(id)).pop() || null;

  function agenti(day) {
    const seen = new Set(), out = [];
    Object.entries(state.schedule?.residenze || {}).forEach(([residenza, list]) => (list || []).forEach(agent => {
      const id = String(agent?.id || '');
      if (!id || seen.has(id) || window.NaviRoles?.isBaristaAgent?.(agent)) return;
      seen.add(id);
      out.push({ agent, residenza, turno: String(G.turnoAgente(state.schedule, { id }, day)?.turno || '').trim().toUpperCase() });
    }));
    return out.sort((a, b) => String(a.agent.agente).localeCompare(String(b.agent.agente), 'it'));
  }

  // Nomi nave puliti: tolti i suffissi degli O.d.S. ((A), (B), ©), "SAN" -> "S.", e un nome doppio
  // ("PARINI + D'ANNUNZIO") diventa due navi.
  const nomiNave = raw => String(raw || '').split('+').map(part => part.replace(/\s*(\([A-Za-z]\)|©)/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^SAN\s+/i, 'S. ').replace(/^S\s+(?=\S)/i, 'S. ').replace(/[’`]/g, "'")).filter(Boolean);
  const stessaNave = (a, b) => nomiNave(a).some(x => nomiNave(b).some(y => x.toUpperCase() === y.toUpperCase()));

  // ---------------- Viste e giorno ----------------
  function render() {
    O.stagioneDaRighe(righeNavi());
    const d = parseIso(state.day);
    $('mov-day-label').textContent = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
    $('mov-day-input').value = state.day;
    // "Oggi" sempre visibile; acceso quando si guarda il giorno corrente
    $('mov-day-today').classList.toggle('on', state.day === iso(new Date()));
    viste[state.tab]?.render();
    aggiornaBadge();
  }
  const notify = render;
  function vista(tab, renderFn, extra = {}) { viste[tab] = { render: renderFn, ...extra }; }

  function goToDay(day) {
    state.day = day;
    Object.values(viste).forEach(v => v.onDay?.());
    render();
  }
  function showTab(tab) {
    if (!TABS.includes(tab)) tab = 'corse';
    state.tab = tab;
    try { localStorage.setItem('navisuite.movimento.tab', tab); } catch { /* memoria del tab non disponibile */ }
    document.querySelectorAll('[data-tab]').forEach(btn => { const on = btn.dataset.tab === tab; btn.classList.toggle('on', on); btn.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
    render();
  }

  // Non ridisegna mentre si scrive in un campo (per non perdere il testo).
  const editing = () => document.activeElement?.closest?.('.mov-panel') && document.activeElement.matches('input, select');

  // Ferma o riprende un turno (fuori dal calendario dell'O.d.S.): stato 'ferma' | 'attiva' | '' (toglie la scelta)
  async function salvaStagione(code, stato, dal, al, messaggio) {
    if (state.busy) return false;
    state.busy = true;
    setStatus('Salvataggio…');
    let ok = false;
    try {
      state.turniNavi = stato ? await window.NaviAdminFirebase.saveStagioneTurno(code, stato, dal, al, autore) : await window.NaviAdminFirebase.togliStagioneTurno(code);
      setStatus(messaggio, 'ok');
      ok = true;
    } catch (error) {
      setStatus(`Non salvato: ${error.message}`, 'bad');
    } finally { state.busy = false; notify(); }
    return ok;
  }

  // ---------------- Salvataggi ----------------
  const ritardiLista = map => Object.entries(map || {}).map(([corsa, x]) => ({ corsa, minuti: x.minuti, oltre: !!x.oltre }));

  // Riga dell'O.d.S. del turno nel giorno (anche quella sostituita dal Movimento), come sarebbe senza modifiche.
  function baseOds(code, day) {
    // anche le righe O.d.S. lette da Firebase: quelle sostituite dal Movimento restano li', disattivate
    const rows = [...(state.schedule?.turni_navi || []), ...state.turniNavi].filter(row => row?.fonte !== 'movimento')
      .map(row => (row.sostituita_da_movimento ? { ...row, attiva: true, sostituita_da_movimento: undefined } : row));
    return T.turniDelGiorno(rows, day)[code] || {};
  }
  // I valori da salvare coincidono con l'O.d.S.: nessuna modifica del Movimento da tenere.
  function ugualeAllOds(values, base) {
    const n = v => String(v || '').trim().toUpperCase();
    const nave = v => nomiNave(v).map(x => x.toUpperCase()).join('+');
    return nave(values.nave) === nave(base.nave) && n(values.ormeggio_mattino) === n(base.ormeggioMattino) && n(values.ormeggio_serale) === n(base.ormeggio) &&
      !!values.rifornimento_mattina === !!base.rif && !values.sospesa && !(values.corse_sospese || []).length && !(values.ritardi || []).length && !(values.incarichi || []).length;
  }

  // La nave, gli ormeggi o il rifornimento del Movimento sono diversi dall'O.d.S.? (ritardi e sospensioni non contano)
  function modificaOds(code, day, r) {
    const base = baseOds(code, day);
    const n = v => String(v || '').trim().toUpperCase();
    const nave = v => nomiNave(v).map(x => x.toUpperCase()).join('+');
    return nave(r.nave) !== nave(base.nave) || n(r.ormeggioMattino) !== n(base.ormeggioMattino) || n(r.ormeggio) !== n(base.ormeggio) || !!r.rif !== !!base.rif;
  }

  async function salva(code, patch, messaggio) {
    if (state.busy) return false;
    state.busy = true;
    setStatus('Salvataggio…');
    const r = T.turniDelGiorno(righeNavi(), state.day)[code] || {};
    const values = {
      nave: r.nave || '', ormeggio_mattino: r.ormeggioMattino || '', ormeggio_serale: r.ormeggio || '', rifornimento_mattina: !!r.rif,
      sospesa: !!r.sospesa, sospesa_motivo: r.motivo || '', incarichi: r.incarichi || [], ritardi: ritardiLista(r.ritardi), corse_sospese: r.corseSospeseRaw || [], ...patch
    };
    let ok = false;
    try {
      if (r.movimento && ugualeAllOds(values, baseOds(code, state.day))) {
        // tornato com'era nell'O.d.S.: toglie la riga del Movimento (e con lei la scritta "modificato dal Movimento")
        state.turniNavi = await window.NaviAdminFirebase.ripristinaTurnoNave(state.day, code);
        setStatus(`${messaggio} Tornata come nell'O.d.S.`, 'ok');
        ok = true;
        return ok;
      }
      state.turniNavi = await window.NaviAdminFirebase.saveTurnoNaveMovimento(state.day, code, values, autore);
      setStatus(messaggio, 'ok');
      ok = true;
    } catch (error) {
      setStatus(`Non salvato: ${error.message}`, 'bad');
    } finally { state.busy = false; notify(); }
    return ok;
  }

  async function ripristina(code) {
    if (state.busy) return;
    state.busy = true;
    setStatus('Ripristino…');
    try {
      const incarichi = code === 'BIS' ? (state.oggi.BIS?.incarichi || []) : [];
      const ritardi = ritardiLista(state.oggi[code]?.ritardi);
      state.turniNavi = await window.NaviAdminFirebase.ripristinaTurnoNave(state.day, code);
      // torna la nave dell'O.d.S., ma restano i ritardi e gli incarichi del BIS del giorno
      if (incarichi.length || ritardi.length) {
        const r = T.turniDelGiorno(righeNavi(), state.day)[code] || {};
        state.turniNavi = await window.NaviAdminFirebase.saveTurnoNaveMovimento(state.day, code,
          { nave: r.nave || '', ormeggio_serale: r.ormeggio || '', rifornimento_mattina: !!r.rif, incarichi, ritardi }, autore);
      }
      setStatus(`${code}: nave e ormeggi dell'O.d.S. ripristinati.`, 'ok');
    } catch (error) {
      setStatus(`Non ripristinato: ${error.message}`, 'bad');
    } finally { state.busy = false; notify(); }
  }

  // Variazione di turno di un agente (turnoNuovo vuoto = annulla quella del Movimento).
  async function variazione(id, turnoNuovo, messaggio, extra = {}) {
    if (state.busy) return;
    const item = agenti(state.day).find(a => String(a.agent.id) === String(id));
    if (!item) return;
    state.busy = true;
    setStatus('Salvataggio turno…');
    const prima = variazioneMovimento(state.day, id);
    const originale = prima?.turno_originale || item.turno;
    // rimesso sul turno previsto: non resta nessuna variazione
    // se coincide con quello previsto non serve una variazione, tranne quando l'agente ha un cambio suo nella Distinta da sovrascrivere:
    // li' la decisione deve restare, altrimenti ricompare il cambio dell'agente
    const cambioAgente = G.modificaManuale?.(id, state.day);
    if (turnoNuovo && String(turnoNuovo).trim().toUpperCase() === String(originale || '').trim().toUpperCase() &&
      (cambioAgente === undefined || String(cambioAgente).trim().toUpperCase() === String(turnoNuovo).trim().toUpperCase())) turnoNuovo = '';
    try {
      // la decisione sovrascrive il cambio che l'agente si e' fatto nella Distinta in quel giorno, se c'e'
      const rows = await window.NaviAdminFirebase.saveVariazioneMovimento(state.day, item.agent, turnoNuovo, originale, `Movimento (${autore})`, { sovrascrive: G.modificaManuale?.(id, state.day) ?? '', ...extra });
      // aggiorna subito i turni in pagina: tolte le variazioni del Movimento del giorno, aggiunte quelle salvate
      const day = state.day;
      state.schedule.variazioni_ods = [...(state.schedule.variazioni_ods || []).filter(v => !(v?.ods === 'MOVIMENTO' && String(v.data).slice(0, 10) === day)),
        ...rows.filter(v => v?.ods === 'MOVIMENTO' && String(v.data).slice(0, 10) === day)];
      setStatus(messaggio, 'ok');
    } catch (error) {
      setStatus(`Turno non salvato: ${error.message}`, 'bad');
    } finally { state.busy = false; notify(); }
  }

  // ---------------- Dati ----------------
  async function aggiorna() {
    const provider = window.NaviAdminFirebase;
    try {
      await provider?.ready;
      const [rows, fleet] = await Promise.all([provider.getTurniNavi(), provider.getFleet().catch(() => null)]);
      state.turniNavi = rows;
      try { state.approvazioni = await provider.getApprovazioniTurni(); } catch { /* nodo non ancora creato */ }
      if (fleet) { state.fleet = fleet.navi || {}; state.fleetMeta = { updatedAt: fleet.updatedAt, updatedBy: fleet.updatedBy }; }
      Object.values(viste).forEach(v => v.onData?.());
      if (!state.busy && !editing()) render();
    } catch (error) {
      setStatus(`Turni nave non aggiornati: ${error.message}`, 'bad');
    }
  }
  // Turni cambiati a mano dagli agenti dalla propria Distinta (come in Il mio turno, Scali e NaviTurni)
  function caricaModifiche() {
    return G.caricaModifiche(profile).then(() => { if (state.schedule && !state.busy && !editing()) render(); }).catch(() => {});
  }
  function carica() {
    window.NaviSharedData?.loadCacheFirst?.((data, meta) => {
      state.schedule = data;
      if (!meta?.stale) setStatus('');
      if (!state.busy && !editing()) render();
    })?.catch?.(error => setStatus(`Turni non disponibili: ${error.message}`, 'bad'));
  }

  $('mov-day-prev').addEventListener('click', () => goToDay(addDays(state.day, -1)));
  $('mov-day-next').addEventListener('click', () => goToDay(addDays(state.day, 1)));
  $('mov-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  // cliccando sulla data si apre il calendario
  $('mov-day-input').addEventListener('click', event => { try { event.target.showPicker?.(); } catch { /* il browser lo apre da solo */ } });
  $('mov-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });
  // "Vedi": apre il tab Cambi richiesti e segna le richieste come viste
  $('mov-avviso')?.addEventListener('click', event => {
    if (!event.target.closest('[data-vai]')) return;
    segnaViste();
    showTab('richieste');
  });
  $('mov-tabs').addEventListener('click', event => { const btn = event.target.closest('[data-tab]'); if (btn) showTab(btn.dataset.tab); });

  // Cambi turno fatti dagli agenti dalla propria Distinta da approvare (da oggi in poi): turno diverso da quello previsto,
  // senza una decisione del Movimento per quel giorno e senza un'approvazione dello stesso turno.
  const norm = value => String(value || '').trim().toUpperCase();
  function turnoPrevisto(agent, day) {
    const ods = (state.schedule?.variazioni_ods || []).filter(v => v?.ods !== 'MOVIMENTO' && String(v.data).slice(0, 10) === day && String(v.id_agente) === String(agent.id)).pop();
    return String(ods ? (ods.turno_nuovo ?? ods.turno ?? '') : (agent.turni?.[day] ?? '')).trim();
  }
  // Una richiesta e' un cambio fatto dall'agente nella Distinta (da oggi in poi) con un turno diverso da quello previsto e da quello
  // che il Movimento ha eventualmente gia' deciso, e non ancora chiusa dal Movimento (approvata, rifiutata o modificata): anche
  // dopo una decisione del Movimento, un nuovo cambio dell'agente e' una nuova richiesta.
  // conApprovate: aggiunge anche le richieste gia' approvate (approvata: true), per mostrarle nel tab Cambi richiesti con il ripristino.
  function richieste({ conApprovate = false } = {}) {
    const oggi = iso(new Date());
    const agentiMap = new Map();
    Object.entries(state.schedule?.residenze || {}).forEach(([residenza, list]) => (list || []).forEach(agent => { if (agent?.id) agentiMap.set(String(agent.id), { agent, residenza }); }));
    const chiave = (id, day) => `${String(id).replace(/[.#$\[\]/]/g, '-')}_${day}`;
    return G.modificheManuali().filter(m => m.day >= oggi && agentiMap.has(String(m.id))).map(m => {
      const { agent, residenza } = agentiMap.get(String(m.id));
      const previsto = turnoPrevisto(agent, m.day);
      const chiusa = state.approvazioni?.[chiave(m.id, m.day)];
      const deciso = variazioneMovimento(m.day, m.id);
      // chiusa: approvata/rifiutata/modificata dal Movimento, oppure gia' sovrascritta da una sua decisione
      const sovrascritta = !!deciso && norm(deciso.sovrascrive ?? '') === norm(m.turno);
      return { agent, residenza, day: m.day, turno: m.turno, previsto, da: m.da || '', deciso: deciso ? String(deciso.turno_nuovo || '') : '',
        chiusa: (!!chiusa && norm(chiusa.turno) === norm(m.turno)) || sovrascritta,
        approvata: !sovrascritta && !!chiusa && norm(chiusa.turno) === norm(m.turno) && (chiusa.stato || 'approvata') === 'approvata' };
    })
      // un cambio dell'agente e' una richiesta se e' diverso dal turno previsto e da quello che il Movimento ha gia' deciso
      .filter(r => (!r.chiusa || (conApprovate && r.approvata)) && norm(r.turno) !== norm(r.previsto) && !(r.deciso && norm(r.deciso) === norm(r.turno)))
      .sort((a, b) => a.day.localeCompare(b.day) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it'));
  }
  // Quali richieste il Movimento ha gia' visto aprendo "Vedi": l'avviso rosso conta solo le nuove. Non toccare una richiesta vuol dire
  // accettarla: il cambio dell'agente resta com'e'.
  const CHIAVE_VISTE = 'navisuite.movimento.richiesteViste';
  const chiaveRichiesta = r => `${r.agent.id}|${r.day}|${norm(r.turno)}`;
  const visteSalvate = () => { try { return new Set(JSON.parse(localStorage.getItem(CHIAVE_VISTE) || '[]')); } catch { return new Set(); } };
  const richiesteNuove = () => { const v = visteSalvate(); return richieste().filter(r => !v.has(chiaveRichiesta(r))); };
  function segnaViste() {
    try { localStorage.setItem(CHIAVE_VISTE, JSON.stringify([...new Set([...visteSalvate(), ...richieste().map(chiaveRichiesta)])].slice(-300))); } catch { /* memoria non disponibile */ }
  }
  // Decisione del Movimento su una richiesta di cambio turno: 'approva' (il turno dell'agente resta: si toglie l'eventuale
  // decisione del Movimento che lo copriva), 'rifiuta' (torna il turno previsto) oppure un altro turno scelto dal Movimento.
  // Rifiuto e altro turno sono variazioni del Movimento, che vincono sul cambio fatto dall'agente nella Distinta. In ogni caso la
  // richiesta si chiude: un nuovo cambio dell'agente sara' una nuova richiesta.
  async function decidiRichiesta(r, scelta) {
    if (state.busy) return;
    state.busy = true;
    setStatus('Salvataggio…');
    const dmy = r.day.split('-').reverse().join('/');
    const chiave = `${String(r.agent.id).replace(/[.#$\[\]/]/g, '-')}_${r.day}`;
    const aggiorna = rows => {
      state.schedule.variazioni_ods = [...(state.schedule.variazioni_ods || []).filter(v => !(v?.ods === 'MOVIMENTO' && String(v.data).slice(0, 10) === r.day && String(v.id_agente) === String(r.agent.id))),
        ...rows.filter(v => v?.ods === 'MOVIMENTO' && String(v.data).slice(0, 10) === r.day && String(v.id_agente) === String(r.agent.id))];
    };
    try {
      const provider = window.NaviAdminFirebase;
      let esito = 'approvata';
      if (scelta === 'approva') {
        // il Movimento aveva deciso altro: quella decisione cade, vale il turno scelto dall'agente
        if (variazioneMovimento(r.day, r.agent.id)) aggiorna(await provider.saveVariazioneMovimento(r.day, r.agent, '', r.turno, `Movimento (${autore})`));
        setStatus(`${r.agent.agente}: cambio turno del ${dmy} approvato (${r.turno}).`, 'ok');
      } else {
        const nuovo = scelta === 'rifiuta' ? (r.previsto || r.da || 'RIP') : scelta;
        esito = scelta === 'rifiuta' ? 'rifiutata' : 'modificata';
        aggiorna(await provider.saveVariazioneMovimento(r.day, r.agent, nuovo, r.turno, `Movimento (${autore}): richiesta di cambio turno ${esito}`, { sovrascrive: r.turno }));
        setStatus(`${r.agent.agente}: richiesta del ${dmy} ${scelta === 'rifiuta' ? `rifiutata, resta ${nuovo}` : `cambiata in ${nuovo}`}.`, 'ok');
      }
      const item = await provider.saveApprovazioneTurno(r.agent.id, r.day, r.turno, autore, esito);
      state.approvazioni = { ...state.approvazioni, [chiave]: item };
    } catch (error) {
      setStatus(`Non salvato: ${error.message}`, 'bad');
    } finally { state.busy = false; notify(); }
  }
  // Numero di richieste sul tab Agenti
  function aggiornaBadge() {
    const nuove = state.schedule ? richiesteNuove().length : 0;
    // tab Corse: pallino rosso col numero di agenti che mancano agli equipaggi del giorno scelto
    const btnCorse = document.querySelector('[data-tab="corse"]');
    if (btnCorse) {
      const mancano = state.schedule ? (window.NaviMovimento?.mancantiGiorno?.(state.day) || 0) : 0;
      btnCorse.innerHTML = 'Corse' + (mancano ? ` <span class="tab-badge rosso" title="Agenti che mancano agli equipaggi: ${mancano}">${mancano}</span>` : '');
    }
    const btn = document.querySelector('[data-tab="agenti"]');
    if (btn) {
      // rosso = richieste di cambio da approvare (restano finche' non le decidi); arancione = turni modificati nel giorno scelto
      const tutte = state.schedule ? richieste() : [];
      const conRichiesta = new Set(tutte.filter(r => r.day === state.day).map(r => String(r.agent.id)));
      const modificati = state.schedule ? agenti(state.day).filter(a => norm(a.turno) !== norm(turnoPrevisto(a.agent, state.day)) && !conRichiesta.has(String(a.agent.id))).length : 0;
      btn.innerHTML = 'Agenti' + (conRichiesta.size ? ` <span class="tab-badge rosso" title="Richieste di cambio turno in questo giorno: ${conRichiesta.size}">${conRichiesta.size}</span>` : '') +
        (modificati ? ` <span class="tab-badge arancio" title="Turni modificati in questo giorno: ${modificati}">${modificati}</span>` : '');
    }
    // tab Cambi richiesti: tutte le richieste ancora da decidere, di qualunque giorno
    const btnRich = document.querySelector('[data-tab="richieste"]');
    if (btnRich) {
      const tutte = state.schedule ? richieste() : [];
      btnRich.innerHTML = 'Cambi richiesti' + (tutte.length ? ` <span class="tab-badge rosso" title="Richieste di cambio turno da approvare: ${tutte.length}">${tutte.length}</span>` : '');
    }
    const n = nuove;
    // avviso ben visibile in ogni tab: gli agenti si sono cambiati il turno dalla Distinta e il Movimento deve decidere
    const avviso = $('mov-avviso');
    if (avviso) {
      avviso.hidden = !n;
      if (n) {
        const nomi = [...new Set(richiesteNuove().map(r => String(r.agent.agente || '').split(' ')[0]))].slice(0, 3).join(', ');
        avviso.innerHTML = `<span>🔔 <b>${n} ${n === 1 ? 'richiesta' : 'richieste'} di cambio turno</b> da approvare${nomi ? ` · ${nomi}` : ''}</span><button type="button" class="btn primary" data-vai="richieste">Vedi</button>`;
      }
    }
  }

  window.NaviMovimento = { state, profile, autore, O, G, T, iso, parseIso, addDays, setStatus, righeNavi, turniCodici, turniFermi, TUTTI_I_TURNI, agenti, nomiNave, stessaNave, modificaOds,
    variazioneMovimento, richieste, richiesteNuove, turnoPrevisto, decidiRichiesta, goToDay, showTab, salva, ripristina, variazione, salvaStagione, notify, vista, editing };

  // Le viste si registrano dopo questo script: il primo disegno parte a pagina caricata.
  const avvia = () => {
    let saved = 'corse';
    try { saved = localStorage.getItem('navisuite.movimento.tab') || 'corse'; } catch { /* nessuna memoria */ }
    setStatus('Caricamento turni e navi…');
    showTab(saved);
    carica();
    caricaModifiche();
    aggiorna();
    // Le modifiche dei colleghi: turni nave ogni minuto, turni degli agenti ogni 5 minuti.
    setInterval(aggiorna, 60000);
    setInterval(carica, 5 * 60000);
    setInterval(caricaModifiche, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) caricaModifiche(); });
    window.addEventListener('focus', caricaModifiche);
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
