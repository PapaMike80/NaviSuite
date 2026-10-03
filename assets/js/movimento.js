/*
 * NaviSuite · Movimento — anagrafica navi ed equipaggio minimo.
 *
 * L'equipaggio minimo appartiene alla NAVE, non alla corsa: la stessa corsa
 * puo' essere fatta da navi diverse (es. D2 con la Tonale da 5 o con la
 * Solferino da 3). Ogni nave ha uno o piu' PERIODI di validita' (es. estate /
 * orario invernale), ciascuno con il numero di persone richieste per ruolo.
 *
 * Dati: Firebase private/adminUpdates/movimentoFlotta (NaviAdminFirebase.getFleet
 * / saveFleet). Pagina riservata agli admin (gate anche in shared-menu.js).
 */
(() => {
  'use strict';

  // ===== CONFIG ===========================================================
  // Ruoli a bordo, nell'ordine in cui compaiono nelle colonne. `key` e' il nome
  // salvato su Firebase: non cambiarlo dopo il primo salvataggio.
  // Per aggiungere o togliere un ruolo basta modificare questa lista.
  const RUOLI = [
    { key:'capitano', label:'Capitano' },
    { key:'capo_timoniere', label:'Capo timoniere' },
    { key:'timoniere', label:'Timoniere' },
    { key:'motorista', label:'Motorista' },
    { key:'aiuto_motorista', label:'Aiuto motorista' },
    { key:'marinaio', label:'Marinaio' }
  ];
  const MAX_PER_RUOLO = 9;

  // Gerarchia dei gradi: l'ordine di RUOLI e' dal piu' alto al piu' basso. Il
  // grado indicato per un posto e' il MINIMO richiesto: un grado superiore puo'
  // coprirlo (un Capitano puo' fare il Capo timoniere), uno inferiore no.
  // Verra' usata nell'assegnazione degli agenti ai posti.

  // Nessun battello viaggia con meno di 3 persone.
  const MIN_EQUIPAGGIO = 3;
  // Sopra questa STAZZA LORDA (tonnellate) il comando deve essere un Capitano.
  // Non e' il dislocamento delle schede tecniche della flotta: la stazza va
  // inserita a mano per nave, dal certificato.
  const SOGLIA_CAPITANO_TON = 350;

  // Equipaggi minimi ricavati dai turni estivi 2026 (giu-set), confrontando le
  // navi in turni_navi con chi era in servizio sulla corsa. Servono solo a
  // precaricare il modulo (pulsante «Carica proposta dai turni»): nulla viene
  // salvato finche' non si preme Salva. Stazza non nota: da inserire a mano.
  const EQ3 = { capo_timoniere:1, motorista:1, marinaio:1 };
  const EQ4 = { capo_timoniere:1, motorista:1, marinaio:2 };
  // Aliscafi: sempre un Capitano al comando.
  const EQ4_ALISCAFO = { capitano:1, motorista:1, marinaio:2 };
  const EQ5A = { capitano:1, timoniere:1, motorista:1, marinaio:2 };
  const EQ5B = { capitano:1, timoniere:1, motorista:1, aiuto_motorista:1, marinaio:1 };
  const PROPOSTA_NAVI = [
    ['Mantova', EQ3], ['Catullo', EQ3], ['Solferino', EQ3], ["D'Annunzio", EQ3], ['S. Marco', EQ3], ['Virgilio', EQ3],
    ['S. Martino', EQ3, 'come la Solferino (stessa serie); l\'equipaggio a 5 nei turni segue la corsa R3'], ['S. Martino (A)', EQ3, 'come la Solferino (stessa serie)'],
    ['Parini', EQ3, 'provvisorio: pochi giorni nei turni'], ['Freccia D.G.', EQ3, 'provvisorio: pochi giorni nei turni'],
    ['Agone', EQ4], ['Peler', EQ4], ['Trento', EQ4], ['Ander', EQ4],
    ['Riviere', EQ4_ALISCAFO, 'aliscafo: sempre Capitano'], ['Goethe', EQ4_ALISCAFO, 'aliscafo: sempre Capitano'],
    ['Galilei', EQ4_ALISCAFO, 'aliscafo: sempre Capitano; pochi giorni nei turni'],
    ['Adamello', EQ5A], ['Andromeda', EQ5A], ['Baldo', EQ5A], ['Brescia', EQ5A], ['Italia', EQ5A], ['Mincio', EQ5A],
    ['S. Vigilio', EQ5A],
    ['Brennero', EQ5B], ['Tonale', EQ5B]
    // Verona non inclusa: nei turni compare solo 5 giorni, con equipaggi incoerenti.
  ];
  // ========================================================================

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { profile = null; }
  // Il gate vero e' in shared-menu.js; questo evita di caricare dati senza ruolo.
  if (!profile || !window.NaviRoles?.isAdminAgent(profile)) { location.replace('index.html'); return; }

  const state = { navi:{}, loadedAt:'', dirty:false };

  function setStatus(text, kind = '') { const el = $('status'); el.textContent = text; el.className = `status ${kind}`.trim(); }
  function setDirty(value) { state.dirty = value; $('save-fleet').disabled = !value; }

  function emptyEquipaggio() { return Object.fromEntries(RUOLI.map(r => [r.key, 0])); }
  function newPeriod(dal = '', from = null) {
    return { dal, equipaggio:{ ...emptyEquipaggio(), ...(from?.equipaggio || {}) }, nota:'' };
  }
  const totale = period => RUOLI.reduce((sum, r) => sum + (Number(period.equipaggio[r.key]) || 0), 0);
  const sortPeriods = ship => ship.periodi.sort((a, b) => String(a.dal).localeCompare(String(b.dal)));

  // Periodo in vigore alla data: l'ultimo con `dal` <= data (dal vuoto = da sempre).
  function currentPeriod(ship, iso) {
    let found = null;
    sortPeriods(ship).forEach(p => { if (String(p.dal) <= iso) found = p; });
    return found;
  }

  function normalizeFleet(raw) {
    const out = {};
    Object.entries(raw || {}).forEach(([id, ship]) => {
      const list = Array.isArray(ship?.periodi) ? ship.periodi : Object.values(ship?.periodi || {});
      const periodi = list.filter(Boolean).map(p => ({
        dal:String(p.dal || ''),
        equipaggio:{ ...emptyEquipaggio(), ...Object.fromEntries(RUOLI.map(r => [r.key, Number(p.equipaggio?.[r.key]) || 0])) },
        nota:String(p.nota || '')
      }));
      out[id] = { nome:String(ship?.nome || id), attiva:ship?.attiva !== false, stazza:Number(ship?.stazza) || 0, periodi:periodi.length ? periodi : [newPeriod()] };
      sortPeriods(out[id]);
    });
    return out;
  }

  function slug(name) {
    const base = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nave';
    let id = base, n = 2;
    while (state.navi[id]) id = `${base}-${n++}`;
    return id;
  }
  const nameTaken = (name, exceptId = '') => Object.entries(state.navi).some(([id, s]) => id !== exceptId && s.nome.trim().toLowerCase() === name.trim().toLowerCase());

  // ---- Render --------------------------------------------------------------

  function render() {
    const ref = $('ref-date').value || todayIso();
    const ids = Object.keys(state.navi).sort((a, b) => state.navi[a].nome.localeCompare(state.navi[b].nome, 'it'));
    $('fleet-count').textContent = String(ids.length);
    $('fleet-empty').classList.toggle('hidden', ids.length > 0);
    $('fleet-table').classList.toggle('hidden', ids.length === 0);
    const head = `<thead><tr><th>Nave</th><th>Valido dal</th>${RUOLI.map(r => `<th>${esc(r.label)}</th>`).join('')}<th>Totale</th><th>Nota</th><th></th></tr></thead>`;
    const body = ids.map(id => {
      const ship = state.navi[id];
      const current = currentPeriod(ship, ref);
      const rows = ship.periodi.map((p, i) => {
        const dupDate = ship.periodi.filter(q => q.dal === p.dal).length > 1;
        return `<tr class="${p === current ? 'current' : ''}">
          ${i === 0 ? `<td class="ship-name" rowspan="${ship.periodi.length + 1}"><input data-ship="${esc(id)}" data-f="nome" value="${esc(ship.nome)}" aria-label="Nome nave"><label class="stazza">Stazza (t)<input type="number" min="0" step="1" inputmode="numeric" data-ship="${esc(id)}" data-f="stazza" value="${ship.stazza || ''}" placeholder="—"></label>${ship.stazza > SOGLIA_CAPITANO_TON ? '<span class="badge">Richiede Capitano</span>' : ''}<small>${current ? '' : '<span class="badge">Nessun periodo in vigore</span>'}</small></td>` : ''}
          <td><input type="date" data-ship="${esc(id)}" data-p="${i}" data-f="dal" value="${esc(p.dal)}" class="${dupDate ? 'invalid' : ''}" title="Vuoto = da sempre" aria-label="Valido dal"></td>
          ${RUOLI.map(r => `<td><input type="number" min="0" max="${MAX_PER_RUOLO}" step="1" inputmode="numeric" data-ship="${esc(id)}" data-p="${i}" data-r="${r.key}" value="${p.equipaggio[r.key]}" aria-label="${esc(r.label)}"></td>`).join('')}
          <td class="total" data-total="${esc(id)}-${i}">${totale(p)}</td>
          <td><input class="note" data-ship="${esc(id)}" data-p="${i}" data-f="nota" value="${esc(p.nota)}" placeholder="Es. orario invernale" aria-label="Nota"></td>
          <td>${ship.periodi.length > 1 ? `<button class="btn danger" type="button" data-act="del-period" data-ship="${esc(id)}" data-p="${i}" title="Elimina periodo">✕</button>` : ''}</td>
        </tr>`;
      }).join('');
      const actions = `<tr class="actions"><td colspan="${RUOLI.length + 5}">
        <button class="btn" type="button" data-act="add-period" data-ship="${esc(id)}">+ Nuovo periodo</button>
        <button class="btn ghost" type="button" data-act="toggle-ship" data-ship="${esc(id)}">${ship.attiva ? 'Disattiva nave' : 'Riattiva nave'}</button>
        <button class="btn danger" type="button" data-act="del-ship" data-ship="${esc(id)}">Elimina nave</button>
      </td></tr>`;
      return `<tbody class="ship${ship.attiva ? '' : ' inactive'}">${rows}${actions}</tbody>`;
    }).join('');
    $('fleet-table').innerHTML = head + body;
  }

  // ---- Azioni --------------------------------------------------------------

  function addShip(name, equipaggio = null, nota = '') {
    const clean = String(name || '').trim();
    if (!clean) { setStatus('Scrivi il nome della nave.', 'bad'); return false; }
    if (nameTaken(clean)) { setStatus(`La nave «${clean}» esiste già.`, 'bad'); return false; }
    state.navi[slug(clean)] = { nome:clean, attiva:true, stazza:0, periodi:[{ ...newPeriod('', equipaggio ? { equipaggio } : null), nota }] };
    return true;
  }

  function onClick(event) {
    const btn = event.target.closest('button[data-act]');
    if (!btn) return;
    const ship = state.navi[btn.dataset.ship];
    if (!ship) return;
    const act = btn.dataset.act;
    if (act === 'add-period') {
      let dal = $('ref-date').value || todayIso();
      while (ship.periodi.some(p => p.dal === dal)) { const d = new Date(`${dal}T12:00:00`); d.setDate(d.getDate() + 1); dal = d.toISOString().slice(0, 10); }
      ship.periodi.push(newPeriod(dal, currentPeriod(ship, dal) || ship.periodi[ship.periodi.length - 1]));
      sortPeriods(ship);
    } else if (act === 'del-period') {
      if (!confirm('Eliminare questo periodo?')) return;
      ship.periodi.splice(Number(btn.dataset.p), 1);
    } else if (act === 'toggle-ship') {
      ship.attiva = !ship.attiva;
    } else if (act === 'del-ship') {
      if (!confirm(`Eliminare la nave «${ship.nome}» e tutti i suoi periodi?`)) return;
      delete state.navi[btn.dataset.ship];
    }
    setDirty(true);
    render();
  }

  function onInput(event) {
    const el = event.target;
    const ship = state.navi[el.dataset.ship];
    if (!ship) return;
    if (el.dataset.r) {
      const p = ship.periodi[Number(el.dataset.p)];
      const value = Math.max(0, Math.min(MAX_PER_RUOLO, Math.floor(Number(el.value) || 0)));
      p.equipaggio[el.dataset.r] = value;
      const cell = document.querySelector(`[data-total="${CSS.escape(`${el.dataset.ship}-${el.dataset.p}`)}"]`);
      if (cell) cell.textContent = String(totale(p));
    } else if (el.dataset.f === 'nome') {
      ship.nome = el.value;
    } else if (el.dataset.f === 'nota') {
      ship.periodi[Number(el.dataset.p)].nota = el.value;
    } else if (el.dataset.f === 'stazza') {
      ship.stazza = Math.max(0, Math.floor(Number(el.value) || 0));
    } else {
      return; // la data si gestisce su `change`, per non riordinare mentre si digita
    }
    setDirty(true);
  }

  function onChange(event) {
    const el = event.target;
    const ship = state.navi[el.dataset.ship];
    if (!ship) return;
    if (el.dataset.f === 'dal') {
      ship.periodi[Number(el.dataset.p)].dal = el.value;
      sortPeriods(ship);
      setDirty(true);
      render();
    } else if (el.dataset.f === 'stazza') {
      render();
    } else if (el.dataset.r) {
      el.value = ship.periodi[Number(el.dataset.p)].equipaggio[el.dataset.r]; // riporta il valore ripulito
    }
  }

  function validate() {
    const names = new Set();
    for (const [id, ship] of Object.entries(state.navi)) {
      const name = ship.nome.trim();
      if (!name) return 'Una nave non ha il nome.';
      if (names.has(name.toLowerCase())) return `Nome nave duplicato: «${name}».`;
      names.add(name.toLowerCase());
      const dates = ship.periodi.map(p => p.dal);
      if (new Set(dates).size !== dates.length) return `«${name}»: due periodi con la stessa data di inizio.`;
      if (ship.attiva && ship.periodi.some(p => totale(p) < MIN_EQUIPAGGIO)) return `«${name}»: l'equipaggio minimo non può essere sotto le ${MIN_EQUIPAGGIO} persone.`;
      if (ship.attiva && ship.stazza > SOGLIA_CAPITANO_TON && ship.periodi.some(p => !(p.equipaggio.capitano >= 1))) return `«${name}»: sopra le ${SOGLIA_CAPITANO_TON} t serve almeno un Capitano.`;
    }
    return '';
  }

  function serialize() {
    return Object.fromEntries(Object.entries(state.navi).map(([id, ship]) => [id, {
      nome:ship.nome.trim(),
      attiva:ship.attiva,
      stazza:ship.stazza || 0,
      periodi:sortPeriods(ship).map(p => ({ dal:p.dal, equipaggio:Object.fromEntries(RUOLI.map(r => [r.key, p.equipaggio[r.key]])), nota:p.nota.trim() }))
    }]));
  }

  async function save() {
    const problem = validate();
    if (problem) { setStatus(problem, 'bad'); return; }
    $('save-fleet').disabled = true;
    try {
      // Evita di sovrascrivere in silenzio le modifiche di un altro admin.
      const remote = await window.NaviAdminFirebase.getFleet();
      if (remote.updatedAt && remote.updatedAt !== state.loadedAt &&
        !confirm(`L'anagrafica è stata modificata da ${remote.updatedBy || 'un altro admin'} dopo il tuo caricamento. Sovrascrivere comunque?`)) {
        setStatus('Salvataggio annullato: ricarica la pagina per vedere le modifiche più recenti.', 'bad');
        $('save-fleet').disabled = false;
        return;
      }
      const saved = await window.NaviAdminFirebase.saveFleet(serialize(), profile.name || profile.agente || profile.cognome || profile.id);
      state.loadedAt = saved.updatedAt;
      setDirty(false);
      setStatus(`Salvato alle ${new Date(saved.updatedAt).toLocaleTimeString('it-IT')}.`, 'ok');
    } catch (error) {
      setStatus(`Salvataggio non riuscito: ${error.message}`, 'bad');
      $('save-fleet').disabled = false;
    }
  }

  // Nomi nave gia' presenti nelle assegnazioni nave/corsa (turniNavi), da
  // aggiungere all'anagrafica. Le righe che sono in realta' codici turno si scartano.
  async function importNames() {
    try {
      const updates = await window.NaviAdminFirebase.getAdminUpdates();
      const notShip = /\b(?:RIP|D[1-4]|BIS2?|P[1-3]|M1|R[1-4]|T[12]|CAR1?|CAP1?|SR[12])\b/i;
      const found = new Map();
      (updates.turniNavi || []).forEach(row => {
        const name = String(row?.nave || '').trim();
        if (name && !notShip.test(name) && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), name);
      });
      const added = [...found.values()].filter(name => !nameTaken(name)).map(name => addShip(name)).filter(Boolean).length;
      if (added) { setDirty(true); render(); }
      setStatus(added ? `Aggiunte ${added} navi dalle assegnazioni esistenti: ora indica l'equipaggio minimo di ciascuna.` : 'Nessuna nave nuova nelle assegnazioni esistenti.', added ? 'ok' : '');
    } catch (error) {
      setStatus(`Importazione non riuscita: ${error.message}`, 'bad');
    }
  }

  function loadProposal() {
    const added = PROPOSTA_NAVI.filter(([name, eq, nota]) => !nameTaken(name) && addShip(name, eq, nota || 'ricavato dai turni estate 2026')).length;
    if (added) { setDirty(true); render(); }
    setStatus(added ? `Precaricate ${added} navi dalla proposta: controlla, inserisci le stazze e premi Salva.` : 'Tutte le navi della proposta sono già in anagrafica.', added ? 'ok' : '');
  }

  async function init() {
    $('ref-date').value = todayIso();
    $('ref-date').addEventListener('change', render);
    $('add-ship').addEventListener('click', () => { if (addShip($('new-ship-name').value)) { $('new-ship-name').value = ''; setDirty(true); setStatus('Nave aggiunta: indica l\'equipaggio minimo e salva.'); render(); } });
    $('new-ship-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('add-ship').click(); });
    $('import-ships').addEventListener('click', importNames);
    $('load-proposal').addEventListener('click', loadProposal);
    $('save-fleet').addEventListener('click', save);
    const table = $('fleet-table');
    table.addEventListener('click', onClick);
    table.addEventListener('input', onInput);
    table.addEventListener('change', onChange);
    window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
    try {
      await window.NaviAdminFirebase.ready;
      const fleet = await window.NaviAdminFirebase.getFleet();
      state.navi = normalizeFleet(fleet.navi);
      state.loadedAt = fleet.updatedAt;
      setStatus(fleet.updatedAt ? `Anagrafica caricata · ultimo salvataggio ${new Date(fleet.updatedAt).toLocaleString('it-IT')}${fleet.updatedBy ? ` da ${fleet.updatedBy}` : ''}.` : 'Anagrafica vuota: aggiungi le navi.', 'ok');
    } catch (error) {
      setStatus(`Impossibile leggere l'anagrafica: ${error.message}`, 'bad');
    }
    render();
  }

  init();
})();
