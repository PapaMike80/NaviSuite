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
  const TABS = ['corse', 'navi', 'agenti'];

  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { profile = null; }
  if (!profile || !window.NaviRoles?.isAdminAgent(profile) || !$('mov-tabs')) return;
  const autore = String(profile.name || profile.agente || profile.id || '');

  const state = { day: iso(new Date()), tab: 'corse', schedule: null, turniNavi: [], fleet: {}, fleetMeta: { updatedAt: '', updatedBy: '' }, oggi: {}, busy: false };
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
  const turniCodici = day => [...O.TURNI.slice(0, 2), 'BIS', ...O.TURNI.slice(2)].filter(code => O.inServizio(code, day));
  const turniFermi = day => TUTTI_I_TURNI.filter(code => !turniCodici(day).includes(code));

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
    const d = parseIso(state.day);
    $('mov-day-label').textContent = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
    $('mov-day-input').value = state.day;
    $('mov-day-today').hidden = state.day === iso(new Date());
    viste[state.tab]?.render();
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
    try {
      const rows = await window.NaviAdminFirebase.saveVariazioneMovimento(state.day, item.agent, turnoNuovo, originale, `Movimento (${autore})`, extra);
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
      if (fleet) { state.fleet = fleet.navi || {}; state.fleetMeta = { updatedAt: fleet.updatedAt, updatedBy: fleet.updatedBy }; }
      Object.values(viste).forEach(v => v.onData?.());
      if (!state.busy && !editing()) render();
    } catch (error) {
      setStatus(`Turni nave non aggiornati: ${error.message}`, 'bad');
    }
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
  $('mov-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });
  $('mov-tabs').addEventListener('click', event => { const btn = event.target.closest('[data-tab]'); if (btn) showTab(btn.dataset.tab); });

  window.NaviMovimento = { state, profile, autore, O, G, T, iso, parseIso, addDays, setStatus, righeNavi, turniCodici, turniFermi, TUTTI_I_TURNI, agenti, nomiNave, stessaNave, modificaOds,
    variazioneMovimento, salva, ripristina, variazione, notify, vista, editing };

  // Le viste si registrano dopo questo script: il primo disegno parte a pagina caricata.
  const avvia = () => {
    let saved = 'corse';
    try { saved = localStorage.getItem('navisuite.movimento.tab') || 'corse'; } catch { /* nessuna memoria */ }
    setStatus('Caricamento turni e navi…');
    showTab(saved);
    carica();
    aggiorna();
    // Le modifiche dei colleghi: turni nave ogni minuto, turni degli agenti ogni 5 minuti.
    setInterval(aggiorna, 60000);
    setInterval(carica, 5 * 60000);
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
