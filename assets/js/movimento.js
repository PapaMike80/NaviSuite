/*
 * NaviSuite · Movimento — tab Navi: anagrafica navi, equipaggio minimo e assegnazione alle corse.
 *
 * L'equipaggio minimo appartiene alla NAVE, non alla corsa: la stessa corsa puo' essere fatta da
 * navi diverse. Ogni nave ha uno o piu' PERIODI di validita' (es. estate / orario invernale) con il
 * numero di persone richieste per grado. Nella pagina ogni posto e' un cerchio col suo grado; sul
 * database resta il conteggio per ruolo (usato dall'avviso "manca…" nelle Corse).
 *
 * Dati: Firebase private/adminUpdates/movimentoFlotta (NaviAdminFirebase.getFleet / saveFleet).
 */
(() => {
  'use strict';

  // Gradi a bordo, nell'ordine in cui compaiono. `key` e' il nome salvato su Firebase: non cambiarlo.
  const RUOLI = [
    { key:'capitano', label:'Capitano', sigla:'Cap', colore:'#facc15' },
    { key:'capo_timoniere', label:'Capo timoniere', sigla:'CT', colore:'#fb923c' },
    { key:'timoniere', label:'Timoniere', sigla:'Tim', colore:'#22c55e' },
    { key:'motorista', label:'Motorista', sigla:'Mot', colore:'#a855f7' },
    { key:'aiuto_motorista', label:'Aiuto motorista', sigla:'AM', colore:'#3b82f6' },
    { key:'marinaio', label:'Marinaio', sigla:'Mar', colore:'#e8f3f6' }
  ];
  const MAX_PER_RUOLO = 9;
  const MAX_POSTI = 12;

  const NM = window.NaviMovimento;
  const view = document.getElementById('navi-view');
  if (!NM || !view) return;
  const { O, T } = NM;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const norm = value => String(value || '').trim().toUpperCase();

  const ui = { navi:{}, sel:'', circle:-1, dirty:false, loadedAt:'', synced:false };

  const emptyEquipaggio = () => Object.fromEntries(RUOLI.map(r => [r.key, 0]));
  const newPeriod = (dal = '', from = null) => ({ dal, equipaggio:{ ...emptyEquipaggio(), ...(from?.equipaggio || {}) }, nota:'' });
  const totale = period => RUOLI.reduce((sum, r) => sum + (Number(period.equipaggio[r.key]) || 0), 0);
  const sortPeriods = ship => ship.periodi.sort((a, b) => String(a.dal).localeCompare(String(b.dal)));
  // Periodo in vigore alla data: l'ultimo con `dal` <= data (dal vuoto = da sempre).
  function currentPeriod(ship, day) {
    let found = null;
    sortPeriods(ship).forEach(p => { if (String(p.dal) <= day) found = p; });
    return found;
  }
  // Posti dell'equipaggio come lista di ruoli, nell'ordine dei gradi; e viceversa.
  const posti = period => RUOLI.flatMap(r => Array(Number(period.equipaggio[r.key]) || 0).fill(r.key));
  function impostaPosti(period, lista) {
    period.equipaggio = emptyEquipaggio();
    lista.forEach(key => { period.equipaggio[key] += 1; });
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
      out[id] = { nome:String(ship?.nome || id), attiva:ship?.attiva !== false, periodi:periodi.length ? periodi : [newPeriod()] };
      sortPeriods(out[id]);
    });
    return out;
  }

  function slug(name) {
    const base = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nave';
    let id = base, n = 2;
    while (ui.navi[id]) id = `${base}-${n++}`;
    return id;
  }
  const nameTaken = (name, exceptId = '') => Object.entries(ui.navi).some(([id, s]) => id !== exceptId && s.nome.trim().toLowerCase() === name.trim().toLowerCase());
  const setDirty = value => { ui.dirty = value; const b = document.getElementById('save-fleet'); if (b) b.disabled = !value; };

  // ---- Render --------------------------------------------------------------
  function render() {
    const day = NM.state.day;
    const ids = Object.keys(ui.navi).sort((a, b) => (ui.navi[b].attiva - ui.navi[a].attiva) || ui.navi[a].nome.localeCompare(ui.navi[b].nome, 'it'));
    if (!ui.navi[ui.sel]) ui.sel = '';
    document.getElementById('fleet-count').textContent = String(ids.filter(id => ui.navi[id].attiva).length);
    const chips = ids.map(id => {
      const ship = ui.navi[id];
      const p = currentPeriod(ship, day);
      return `<button type="button" class="nave-chip${id === ui.sel ? ' on' : ''}${ship.attiva ? '' : ' off'}" data-act="sel" data-ship="${esc(id)}">${esc(ship.nome)}<small>${p ? totale(p) : '?'}</small></button>`;
    }).join('');
    const toolbar = `<div class="toolbar">
        <label>Nuova nave<input id="new-ship-name" type="text" placeholder="Es. Solferino" autocomplete="off"></label>
        <button id="add-ship" class="btn" type="button" data-act="add-ship">+ Aggiungi nave</button>
        <button id="import-ships" class="btn ghost" type="button" data-act="import" title="Legge i nomi già usati nelle assegnazioni nave/corsa">Importa nomi dai turni</button>
        <span class="spacer"></span>
        <button id="save-fleet" class="btn primary" type="button" data-act="save"${ui.dirty ? '' : ' disabled'}>Salva</button>
      </div>`;
    view.innerHTML = `${toolbar}<div class="nave-list">${chips || '<p class="empty">Nessuna nave in anagrafica. Aggiungi la prima con «Nuova nave».</p>'}</div>${ui.sel ? dettaglio(ui.sel, day) : (chips ? '<p class="empty">Seleziona una nave.</p>' : '')}`;
  }

  function dettaglio(id, day) {
    const ship = ui.navi[id];
    const p = currentPeriod(ship, day) || ship.periodi[0];
    const idx = ship.periodi.indexOf(p);
    const inVigore = p === currentPeriod(ship, day);
    const lista = posti(p);
    const cerchi = lista.map((key, i) => {
      const r = RUOLI.find(x => x.key === key);
      return `<button type="button" class="posto${i === ui.circle ? ' on' : ''}" style="--g:${r.colore}" data-act="posto" data-i="${i}" title="${esc(r.label)}">${r.sigla}</button>`;
    }).join('');
    const palette = ui.circle >= 0 && ui.circle < lista.length
      ? `<div class="gradi"><span>Grado del posto ${ui.circle + 1}:</span>${RUOLI.map(r => `<button type="button" class="grado${lista[ui.circle] === r.key ? ' on' : ''}" style="--g:${r.colore}" data-act="grado" data-r="${r.key}">${esc(r.label)}</button>`).join('')}</div>` : '';
    // assegnazione alla corsa del giorno
    const oggi = T.turniDelGiorno(NM.righeNavi(), day);
    const codici = NM.turniCodici(day);
    const attuale = codici.find(c => norm(oggi[c]?.nave).replace(/\s*(\([A-Z]\)|©)/g, '') === norm(ship.nome)) || '';
    const opzioni = `<option value="">— nessuna —</option>${codici.map(c => `<option value="${c}"${c === attuale ? ' selected' : ''}>${c}${oggi[c]?.nave && c !== attuale ? ` (ora: ${esc(oggi[c].nave)})` : ''}</option>`).join('')}`;
    const periodi = ship.periodi.length > 1 ? `<small class="periodi">Periodi: ${ship.periodi.map(q => `${q === p ? '<b>' : ''}${q.dal ? 'dal ' + esc(q.dal.split('-').reverse().join('/')) : 'da sempre'}${q === p ? '</b>' : ''}`).join(' · ')}</small>` : '';
    return `<div class="nave-det${ship.attiva ? '' : ' off'}">
      <div class="nave-head"><input data-f="nome" value="${esc(ship.nome)}" aria-label="Nome nave">${inVigore ? '' : '<span class="badge">Nessun periodo in vigore nel giorno</span>'}</div>
      <div class="nave-blocco">
        <h3>Equipaggio minimo</h3>
        <div class="nave-n"><label>Persone<input type="number" min="0" max="${MAX_POSTI}" step="1" inputmode="numeric" data-f="n" value="${lista.length}"></label>
          <div class="posti">${cerchi || '<small>Indica quante persone servono.</small>'}</div></div>
        ${palette}
        <div class="nave-periodo"><label>Valido dal<input type="date" data-f="dal" value="${esc(p.dal)}" title="Vuoto = da sempre"></label>
          <label>Nota<input class="note" data-f="nota" value="${esc(p.nota)}" placeholder="Es. orario invernale"></label>${periodi}
          <button class="btn" type="button" data-act="add-period">+ Nuovo periodo dal ${esc(day.split('-').reverse().join('/'))}</button>
          ${ship.periodi.length > 1 ? '<button class="btn danger" type="button" data-act="del-period">Elimina periodo</button>' : ''}</div>
      </div>
      <div class="nave-blocco">
        <h3>Assegna a una corsa · ${esc(day.split('-').reverse().join('/'))}</h3>
        <label class="nave-assegna">Corsa<select data-f="assegna"${ship.attiva ? '' : ' disabled'}>${opzioni}</select></label>
        <small>${attuale ? `Oggi fa la corsa ${attuale}.` : 'Oggi non è assegnata a nessuna corsa.'} L'assegnazione si salva subito e vale solo per questo giorno.</small>
      </div>
      <div class="nave-azioni">
        <button class="btn ghost" type="button" data-act="toggle-ship">${ship.attiva ? 'Disattiva nave' : 'Riattiva nave'}</button>
        <button class="btn danger" type="button" data-act="del-ship">Elimina nave</button>
      </div>
    </div>`;
  }

  // ---- Azioni --------------------------------------------------------------
  function addShip(name) {
    const clean = String(name || '').trim();
    if (!clean) { NM.setStatus('Scrivi il nome della nave.', 'bad'); return false; }
    if (nameTaken(clean)) { NM.setStatus(`La nave «${clean}» esiste già.`, 'bad'); return false; }
    const id = slug(clean);
    ui.navi[id] = { nome:clean, attiva:true, periodi:[newPeriod()] };
    ui.sel = id;
    return true;
  }
  const periodoCorrente = () => { const ship = ui.navi[ui.sel]; return ship && (currentPeriod(ship, NM.state.day) || ship.periodi[0]); };

  async function assegna(ship, code) {
    const day = NM.state.day;
    const oggi = T.turniDelGiorno(NM.righeNavi(), day);
    const nomeNave = ship.nome.trim();
    const attuale = NM.turniCodici(day).find(c => norm(oggi[c]?.nave).replace(/\s*(\([A-Z]\)|©)/g, '') === norm(nomeNave));
    if (attuale && attuale !== code && !(await NM.salva(attuale, { nave:'' }, `${nomeNave} tolta dalla ${attuale}.`))) return;
    if (code) {
      const prima = oggi[code]?.nave;
      await NM.salva(code, { nave:nomeNave }, `${nomeNave} assegnata alla ${code}${prima && norm(prima) !== norm(nomeNave) ? ` al posto di ${prima}` : ''}.`);
    }
  }

  function onClick(event) {
    const btn = event.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const ship = ui.navi[ui.sel];
    if (act === 'sel') { ui.sel = btn.dataset.ship; ui.circle = -1; render(); return; }
    if (act === 'save') { save(); return; }
    if (act === 'import') { importNames(); return; }
    if (act === 'add-ship') {
      const input = document.getElementById('new-ship-name');
      if (addShip(input.value)) { setDirty(true); NM.setStatus('Nave aggiunta: indica l\'equipaggio minimo e salva.'); render(); }
      return;
    }
    if (!ship) return;
    const p = periodoCorrente();
    if (act === 'posto') { ui.circle = ui.circle === Number(btn.dataset.i) ? -1 : Number(btn.dataset.i); render(); return; }
    if (act === 'grado') {
      const lista = posti(p);
      if (ui.circle < 0 || ui.circle >= lista.length) return;
      lista[ui.circle] = btn.dataset.r;
      impostaPosti(p, lista);
      ui.circle = -1;
    } else if (act === 'add-period') {
      let dal = NM.state.day;
      if (ship.periodi.some(q => q.dal === dal)) { NM.setStatus('Esiste già un periodo con questa data di inizio.', 'bad'); return; }
      ship.periodi.push(newPeriod(dal, p));
      sortPeriods(ship);
    } else if (act === 'del-period') {
      if (!confirm('Eliminare questo periodo?')) return;
      ship.periodi.splice(ship.periodi.indexOf(p), 1);
    } else if (act === 'toggle-ship') {
      ship.attiva = !ship.attiva;
    } else if (act === 'del-ship') {
      if (!confirm(`Eliminare la nave «${ship.nome}» e tutti i suoi periodi?`)) return;
      delete ui.navi[ui.sel];
      ui.sel = '';
    } else return;
    setDirty(true);
    render();
  }

  function onInput(event) {
    const el = event.target;
    const ship = ui.navi[ui.sel];
    if (!ship) return;
    const p = periodoCorrente();
    if (el.dataset.f === 'nome') ship.nome = el.value;
    else if (el.dataset.f === 'nota') p.nota = el.value;
    else if (el.dataset.f === 'n') {
      const n = Math.max(0, Math.min(MAX_POSTI, Math.floor(Number(el.value) || 0)));
      const lista = posti(p);
      while (lista.length < n) lista.push('marinaio');
      lista.length = n;
      impostaPosti(p, lista);
      ui.circle = -1;
      const box = view.querySelector('.posti');
      if (box) box.innerHTML = lista.map((key, i) => { const r = RUOLI.find(x => x.key === key); return `<button type="button" class="posto" style="--g:${r.colore}" data-act="posto" data-i="${i}" title="${esc(r.label)}">${r.sigla}</button>`; }).join('') || '<small>Indica quante persone servono.</small>';
      view.querySelector('.gradi')?.remove();
    } else return;
    setDirty(true);
  }

  function onChange(event) {
    const el = event.target;
    const ship = ui.navi[ui.sel];
    if (!ship) return;
    if (el.dataset.f === 'dal') {
      const p = periodoCorrente();
      if (ship.periodi.some(q => q !== p && q.dal === el.value)) { NM.setStatus('Esiste già un periodo con questa data di inizio.', 'bad'); render(); return; }
      p.dal = el.value;
      sortPeriods(ship);
      setDirty(true);
      render();
    } else if (el.dataset.f === 'n') {
      render();
    } else if (el.dataset.f === 'nome') {
      render();
    } else if (el.dataset.f === 'assegna') {
      assegna(ship, el.value);
    }
  }

  function validate() {
    const names = new Set();
    for (const ship of Object.values(ui.navi)) {
      const name = ship.nome.trim();
      if (!name) return 'Una nave non ha il nome.';
      if (names.has(name.toLowerCase())) return `Nome nave duplicato: «${name}».`;
      names.add(name.toLowerCase());
      const dates = ship.periodi.map(p => p.dal);
      if (new Set(dates).size !== dates.length) return `«${name}»: due periodi con la stessa data di inizio.`;
      if (ship.attiva && ship.periodi.some(p => totale(p) < 1)) return `«${name}»: un periodo ha equipaggio minimo zero.`;
    }
    return '';
  }

  function serialize() {
    return Object.fromEntries(Object.entries(ui.navi).map(([id, ship]) => [id, {
      nome:ship.nome.trim(),
      attiva:ship.attiva,
      periodi:sortPeriods(ship).map(p => ({ dal:p.dal, equipaggio:Object.fromEntries(RUOLI.map(r => [r.key, p.equipaggio[r.key]])), nota:p.nota.trim() }))
    }]));
  }

  async function save() {
    const problem = validate();
    if (problem) { NM.setStatus(problem, 'bad'); return; }
    const btn = document.getElementById('save-fleet');
    if (btn) btn.disabled = true;
    try {
      // Evita di sovrascrivere in silenzio le modifiche di un altro admin.
      const remote = await window.NaviAdminFirebase.getFleet();
      if (remote.updatedAt && remote.updatedAt !== ui.loadedAt &&
        !confirm(`L'anagrafica è stata modificata da ${remote.updatedBy || 'un altro admin'} dopo il tuo caricamento. Sovrascrivere comunque?`)) {
        NM.setStatus('Salvataggio annullato: ricarica la pagina per vedere le modifiche più recenti.', 'bad');
        if (btn) btn.disabled = false;
        return;
      }
      const saved = await window.NaviAdminFirebase.saveFleet(serialize(), NM.profile.name || NM.profile.agente || NM.profile.cognome || NM.profile.id);
      ui.loadedAt = saved.updatedAt;
      NM.state.fleet = saved.navi;
      NM.state.fleetMeta = { updatedAt: saved.updatedAt, updatedBy: saved.updatedBy };
      setDirty(false);
      NM.setStatus(`Navi salvate alle ${new Date(saved.updatedAt).toLocaleTimeString('it-IT')}.`, 'ok');
    } catch (error) {
      NM.setStatus(`Salvataggio non riuscito: ${error.message}`, 'bad');
      if (btn) btn.disabled = false;
    }
  }

  // Nomi nave gia' presenti nelle assegnazioni nave/corsa (turniNavi). Le righe che sono codici turno si scartano.
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
      NM.setStatus(added ? `Aggiunte ${added} navi dalle assegnazioni esistenti: ora indica l'equipaggio minimo di ciascuna.` : 'Nessuna nave nuova nelle assegnazioni esistenti.', added ? 'ok' : '');
    } catch (error) {
      NM.setStatus(`Importazione non riuscita: ${error.message}`, 'bad');
    }
  }

  view.addEventListener('click', onClick);
  view.addEventListener('input', onInput);
  view.addEventListener('change', onChange);
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'new-ship-name') document.getElementById('add-ship').click(); });
  window.addEventListener('beforeunload', e => { if (ui.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Copia modificabile dell'anagrafica: si aggiorna dal server solo se non ci sono modifiche in corso.
  function onData() {
    if (ui.dirty) return;
    ui.navi = normalizeFleet(NM.state.fleet);
    ui.loadedAt = NM.state.fleetMeta.updatedAt;
    if (!ui.synced) { ui.synced = true; NM.setStatus(ui.loadedAt ? `Navi caricate · ultimo salvataggio ${new Date(ui.loadedAt).toLocaleString('it-IT')}${NM.state.fleetMeta.updatedBy ? ` da ${NM.state.fleetMeta.updatedBy}` : ''}.` : 'Anagrafica vuota: aggiungi le navi.', 'ok'); }
  }
  NM.vista('navi', render, { onData, onDay: () => { ui.circle = -1; } });
})();
