// Pagina "Servizi a terra": la giornata a terra della residenza dell'agente (Desenzano o Maderno),
// con i pulsantini di NaviTurni per passare all'altra residenza. Pagina web, non il foglio A4:
// navi in ordine di orario (le gia' partite nascoste tranne l'ultima, prossima evidenziata, ormeggio
// del mattino con il rifornimento e della sera), servizi a terra con l'agente di turno, traghetto
// Torri (Maderno) e note. Il foglio A4 resta in "Stampa A4".
(function () {
  'use strict';

  const T = window.NaviServiziTerra;
  const D = T.DATA;
  const RESIDENZE = [{ code: 'D', name: 'DESENZANO', title: 'Desenzano' }, { code: 'M', name: 'MADERNO', title: 'Maderno' }];
  // Periodi in cui vale l'orario (O.d.S. 39/2026) e ultimo giorno delle corse SR (segnate con *).
  const PERIODI = [['2026-10-05', '2026-11-01'], ['2027-03-13', '2027-03-25']];
  const FINE_SR = '2026-10-11';
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const CACHE_KEY = 'navisuite.serviziTerra.turniNavi';
  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const short = value => { const d = parseIso(value); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const chip = code => `<span class="chip" data-code="${esc(code)}">${esc(code)}</span>`;

  // Residenza dell'agente collegato; per chi non e' di Desenzano o Maderno si apre Desenzano.
  function ownResidence() {
    let agent = null;
    try { agent = JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { agent = null; }
    const value = String(agent?.residence || agent?.residenza || '').trim().toUpperCase();
    return RESIDENZE.some(item => item.name === value) ? value : 'DESENZANO';
  }

  function initialResidence() {
    const asked = String(new URLSearchParams(location.search).get('res') || '').trim().toUpperCase();
    return RESIDENZE.some(item => item.name === asked) ? asked : ownResidence();
  }

  function readCache() {
    try { const rows = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return Array.isArray(rows) ? rows : null; } catch { return null; }
  }

  const state = { residence: initialResidence(), monday: T.defaultMonday(), turniNavi: readCache() || [],
    firebaseNavi: readCache() || [], schedule: null, showPast: false };

  // Turni a terra negli orari degli agenti (AGB, POND, AGT...) e sigla del servizio.
  // AGT e AGT1 sono lo stesso servizio: AgT.
  const SIGLE_TERRA = { AGB: 'AgB', POND: 'PonD', DT: 'DT', AGM: 'AgM', AGT: 'AgT', AGT1: 'AgT', AGT2: 'AgT2', PONM: 'PonM' };
  const TERRA_RESIDENZA = { DESENZANO: ['AgB', 'PonD', 'DT'], MADERNO: ['AgM', 'AgT', 'AgT2', 'PonM'] };
  const norm = value => String(value || '').trim().toLocaleUpperCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  function terraCode(value) {
    const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = raw.match(/^C?(AGB|POND|DT|AGM|AGT[12]?|PONM)C?$/)?.[1];
    return code ? SIGLE_TERRA[code] : '';
  }

  // Turno nave di un agente (D1, P2, M1, T1, R1, SR1...): come in Oggi, CxxC (trasferta) vale xx.
  function naveCode(value) {
    const raw = String(value || '').trim().toUpperCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, '');
    const code = raw.match(/^C?(D[1-4]|BIS|T[12]|M1|R[1-4]|P[1-3]|SR[12])C?$/)?.[1];
    return code || '';
  }
  // Grado per ordinare e colorare l'equipaggio, come nel popup di NaviTurni.
  const GRADI = [
    [/capitano|comandante/i, 'Comandante', '#facc15', 1],
    [/capo\s*timoniere|capotimoniere/i, 'Capo timoniere', '#fb923c', 1],
    [/aiuto\s*motorista|aiutomotorista/i, 'Aiuto motorista', '#3b82f6', 4],
    [/motorista/i, 'Motorista', '#a855f7', 2],
    [/timoniere/i, 'Timoniere', '#22c55e', 3],
    [/marinaio/i, 'Marinaio', '#ffffff', 5]
  ];
  // Comandante della nave: il capitano/comandante o, se manca, il capo timoniere (a bordo fa da capitano).
  const comandante = crew => (crew || []).find(member => member.grado[0] === 'Comandante')?.name ||
    (crew || []).find(member => member.grado[0] === 'Capo timoniere')?.name || '';
  const gradoOf = agent => GRADI.find(([pattern]) => pattern.test(String(agent?.qualifica || agent?.grado || '')))?.slice(1) || ['', '#e8f3f6', 9];

  // Turni del giorno: {terra: {AgB: ['ROSSI']}, navi: {D1: [agente, ...]}}. Le variazioni ODS vincono sul turno.
  function equipaggi(data, day) {
    const variations = new Map();
    (data?.variazioni_ods || []).forEach(item => {
      if (String(item?.data || '').slice(0, 10) !== day) return;
      const shift = item?.turno_nuovo ?? item?.turno;
      if (shift === undefined) return;
      if (item?.id_agente) variations.set(`id:${item.id_agente}`, shift);
      if (item?.agente) variations.set(`name:${norm(item.agente)}`, shift);
    });
    const terra = {}, navi = {}, seen = new Set();
    Object.values(data?.residenze || {}).forEach(list => (list || []).forEach(agent => {
      const key = String(agent?.id || norm(agent?.agente));
      if (!key || seen.has(key) || window.NaviRoles?.isBaristaAgent?.(agent)) return;
      seen.add(key);
      const variation = variations.get(`id:${agent?.id}`) ?? variations.get(`name:${norm(agent?.agente)}`);
      const shift = variation !== undefined ? variation : agent?.turni?.[day];
      const name = String(agent.agente || agent.name || '').trim();
      const ground = terraCode(shift);
      if (ground) (terra[ground] = terra[ground] || []).push(name);
      const ship = naveCode(shift);
      if (ship) (navi[ship] = navi[ship] || []).push({ name, grado: gradoOf(agent) });
    }));
    Object.values(terra).forEach(list => list.sort((a, b) => a.localeCompare(b, 'it')));
    Object.values(navi).forEach(list => list.sort((a, b) => a.grado[2] - b.grado[2] || a.name.localeCompare(b.name, 'it')));
    return { terra, navi };
  }
  const agentiATerra = (data, day) => equipaggi(data, day).terra;

  // Ora attuale in minuti, solo se oggi vale l'orario; altrimenti null (niente passate/prossima).
  function nowInfo() {
    const now = new Date();
    const today = iso(now);
    const active = PERIODI.some(([from, to]) => today >= from && today <= to);
    return { today, minutes: active ? now.getHours() * 60 + now.getMinutes() : null, srOff: today > FINE_SR };
  }

  function renderButtons() {
    $('terra-residences').innerHTML = RESIDENZE.map(item => {
      const active = item.name === state.residence;
      return `<button type="button" class="quick-residence-btn${active ? ' active' : ''}" data-res="${item.name}" ` +
        `aria-label="Visualizza ${item.name}" aria-pressed="${active}" title="${item.title}">${item.code}</button>`;
    }).join('');
  }

  function serviziCard(now) {
    const agents = state.schedule ? agentiATerra(state.schedule, now.today) : null;
    const who = code => {
      if (!agents) return '<span class="agenti muted">Caricamento agenti…</span>';
      const list = agents[code] || [];
      return list.length ? `<span class="agenti">👤 ${list.map(esc).join(', ')}</span>` : '<span class="agenti muted">Nessun agente di turno</span>';
    };
    const known = D.SERVIZI[state.residence].map(([code]) => code);
    // Altri turni a terra della residenza presenti oggi negli orari (es. AgT2, DT).
    const extra = agents ? TERRA_RESIDENZA[state.residence].filter(code => !known.includes(code) && agents[code]?.length)
      .map(code => `<div class="servizio">${chip(code)}<span class="ore"></span>${who(code)}</div>`).join('') : '';
    const items = D.SERVIZI[state.residence].map(([code, morning, afternoon, note]) => {
      let status = '';
      if (now.minutes != null) {
        const [a, b] = morning.split(' – ').map(T.minutes), [c, d] = afternoon.split(' – ').map(T.minutes);
        if ((now.minutes >= a && now.minutes < b) || (now.minutes >= c && now.minutes < d)) status = 'IN SERVIZIO ORA';
        else if (now.minutes >= b && now.minutes < c) status = `PAUSA · RIPRENDE ALLE ${afternoon.split(' – ')[0]}`;
      }
      return `<div class="servizio${status.startsWith('IN') ? ' now' : ''}">${chip(code)}<span class="ore">${morning}<br>${afternoon}</span>` +
        `${who(code)}<small>${esc(note)}</small>${status ? `<span class="stato">${status}</span>` : ''}</div>`;
    }).join('') + extra;
    return card('Servizi a terra', 'agente di turno oggi', `<div class="servizi">${items}</div>`);
  }

  function naviCard(now) {
    const desenzano = state.residence === 'DESENZANO';
    const bolgette = D.BOLGETTE[state.residence];
    const split = desenzano ? '14.30' : '14.00';
    const turni = T.turniDelGiorno(state.turniNavi, now.today);
    const ieri = T.turniDelGiorno(state.turniNavi, addDays(now.today, -1));
    const crews = state.schedule ? equipaggi(state.schedule, now.today).navi : {};
    state.crews = crews;
    const navi = D.NAVI[state.residence];
    const firstIndex = {}, lastIndex = {};
    navi.forEach(([, , code], i) => { if (!(code in firstIndex)) firstIndex[code] = i; lastIndex[code] = i; });
    let nextFound = false;
    const items = navi.map(([time, kind, code, run, where], index) => {
      // Mattino: prima partenza del turno, la nave e' ormeggiata dalla sera prima (eventuale rifornimento).
      const morning = kind === 'P' && firstIndex[code] === index;
      // Sera: l'ultimo movimento del turno e' un arrivo, la nave resta qui per la notte.
      const evening = kind === 'A' && lastIndex[code] === index;
      const badges = [];
      if (morning && ieri[code]?.ormeggio) badges.push(`<b class="ormeggio" title="Ormeggio del mattino (dalla sera prima)">⚓ ${esc(ieri[code].ormeggio.toUpperCase())}</b>`);
      if (morning && turni[code]?.rif) badges.push('<b class="rifornimento" title="Rifornimento prima della corsa">⛽ RIFORNIMENTO</b>');
      if (evening && turni[code]?.ormeggio) badges.push(`<b class="ormeggio" title="Ormeggio serale">⚓ ${esc(turni[code].ormeggio.toUpperCase())}</b>`);
      if (bolgette[run]) badges.push(`<b class="bolgetta">${esc(bolgette[run])}</b>`);
      let state_ = '';
      if (now.srOff && where.includes('*')) state_ = 'off';
      else if (now.minutes != null) {
        if (T.minutes(time) < now.minutes) state_ = 'past';
        else if (!nextFound) { state_ = 'next'; nextFound = true; }
      }
      const ship = turni[code]?.nave;
      const captain = comandante(crews[code]);
      const info = [ship, captain ? `Cte.\u00a0${captain}` : ''].filter(Boolean).join(' · ');
      const html = `<span class="ora">${time}</span>` +
        `<span class="tipo ${kind}">${D.KIND[kind]}<small>${run ? `corsa ${esc(run)}` : '–'}</small></span>${chip(code)}` +
        `<span class="dove"><span>${esc(where)}${info ? `<small class="ship">${esc(info)}</small>` : ''}</span>` +
        `${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}</span>`;
      return { html, state: state_, split: time === split, code, ship };
    });
    // Navi gia' partite: nascoste tranne l'ultima (spenta); la freccia le mostra tutte.
    const pastIdx = items.map((item, i) => item.state === 'past' ? i : -1).filter(i => i >= 0);
    const lastPast = pastIdx[pastIdx.length - 1];
    const hidden = pastIdx.filter(i => i !== lastPast).length;
    const rows = items.map((item, i) => {
      const isPast = item.state === 'past' || item.state === 'off';
      const hide = !state.showPast && item.state === 'past' && i !== lastPast;
      const hideOff = !state.showPast && item.state === 'off' && lastPast != null && i < lastPast;
      if (hide || hideOff) return '';
      const cls = `nave${item.split ? ' split' : ''}${isPast ? ' past' : ''}${item.state === 'next' ? ' next' : ''}`;
      return `<div class="${cls}" tabindex="0" data-crew="${esc(item.code)}" data-ship="${esc(item.ship || '')}">${item.html}</div>`;
    }).join('');
    const toggle = hidden ? `<button type="button" class="past-toggle" data-past aria-expanded="${state.showPast}">` +
      `${state.showPast ? '▴ Nascondi le navi già partite' : `▾ Mostra le navi già partite (${hidden})`}</button>` : '';
    const legend = desenzano
      ? '⚓ ormeggio del mattino (dalla sera prima) e della sera · ⛽ rifornimento · nave di oggi dagli O.d.S.'
      : `SCALO = nave in transito a Maderno · * corsa SR solo fino all'11 ottobre 2026${now.srOff ? ' (ora non più effettuata)' : ''} · ⚓ ormeggio · nave di oggi dagli O.d.S.`;
    return card(desenzano ? 'Navi a Desenzano' : 'Navi di linea a Maderno', 'in ordine di orario',
      `${toggle}<div class="navi-list">${rows}</div><p class="legend">${esc(legend)}</p>`);
  }

  function traghettoCard(now) {
    const ships = T.naviDelGiorno(state.turniNavi, now.today);
    const ferry = code => {
      let nextFound = false;
      const time = value => value ? `<span class="t">${value[0]}<small>c. ${esc(value[1])}</small></span>` : '';
      const rows = T.ferryRows(code).map(row => {
        if (row.kind === 'pausa-torri') return `<div class="ferry-row torri">pausa a Torri ${row.arr} – ${row.dep}</div>`;
        let cls = '';
        const last = (row.dep || row.arr)[0];
        if (now.minutes != null) {
          if (T.minutes(last) < now.minutes) cls = ' past';
          else if (!nextFound) { cls = ' next'; nextFound = true; }
        }
        let sosta = '';
        if (row.arr && row.dep) {
          const min = T.minutes(row.dep[0]) - T.minutes(row.arr[0]);
          sosta = `<span class="sosta${min >= 45 ? ' lunch' : ''}">${min >= 45 ? 'pausa ' : ''}${min}'</span>`;
        } else sosta = '<span class="sosta"></span>';
        const arr = row.kind === 'prima' ? '<span class="muted">1ª partenza</span>' : time(row.arr);
        const dep = row.kind === 'ultima' ? '<span class="muted" style="text-align:right">fine servizio</span>' : time(row.dep);
        return `<div class="ferry-row${cls}">${arr}${sosta}${dep}</div>`;
      }).join('');
      const captain = comandante(state.crews?.[code]);
      return `<div class="ferry"><h3>${chip(code)} ${ships[code] ? `<span class="ferry-ship">${esc(ships[code])}</span>` : 'Traghetto'}` +
        `${captain ? `<small class="ferry-cte">Cte. ${esc(captain)}</small>` : ''}</h3><div class="ferry-head"><span>ARRIVO</span><span>SOSTA</span><span>PARTENZA</span></div>${rows}</div>`;
    };
    return card('Traghetto Maderno – Torri', 'arrivo da Torri · sosta · partenza per Torri', `<div class="ferries">${ferry('T1')}${ferry('T2')}</div>`);
  }

  function noteCard() {
    const items = [];
    if (state.residence === 'DESENZANO') {
      items.push(`<li class="rif"><b>${esc(D.RIFORNIMENTI.titolo)}</b>${D.RIFORNIMENTI.righe.map(esc).join('<br>')}</li>`);
    }
    D.NOTE[state.residence].forEach(([bold, text]) => items.push(`<li${bold ? ' class="bold"' : ''}>${esc(text)}</li>`));
    return card('Note', '', `<ul class="note-list">${items.join('')}</ul><p class="validita">${esc(D.VALIDITA)}</p>`);
  }

  function card(title, extra, body) {
    const side = extra && extra.startsWith('<') ? extra : extra ? `<small>${esc(extra)}</small>` : '';
    return `<section class="terra-card"><div class="terra-card-head"><h2>${esc(title)}</h2>${side}</div><div class="terra-card-body">${body}</div></section>`;
  }

  function render() {
    const info = RESIDENZE.find(item => item.name === state.residence);
    const desenzano = state.residence === 'DESENZANO';
    const now = nowInfo();
    renderButtons();
    hideCrew();
    $('terra-title').textContent = info.title;
    $('terra-context').textContent = desenzano ? 'Pontile e AgB · navi, ormeggi e rifornimenti' : 'AgM e AgT · navi di linea e traghetto Torri';
    const clock = new Date();
    $('terra-clock').textContent = now.minutes != null
      ? `${GIORNI[clock.getDay()]} ${short(now.today)} · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}`
      : 'Orario in vigore dal 5/10 all\'1/11/2026 e dal 13 al 25/3/2027';
    // Prima l'orario delle navi, poi i servizi a terra con l'agente di turno.
    const left = [naviCard(now)];
    const right = [serviziCard(now), ...(desenzano ? [] : [traghettoCard(now)]), noteCard()];
    $('terra-content').innerHTML = `<div class="terra-col">${left.join('')}</div><div class="terra-col">${right.join('')}</div>`;
    const url = new URL(location.href);
    url.searchParams.set('res', state.residence.toLowerCase());
    history.replaceState(null, '', url);
  }

  function notice(text) {
    $('terra-notice').hidden = !text;
    $('terra-notice').textContent = text || '';
  }

  // Turni nave: quelli dei dati condivisi (come in Oggi) piu' quelli letti da Firebase.
  function mergeTurniNavi() {
    const rows = [...(state.schedule?.turni_navi || []), ...state.firebaseNavi];
    if (rows.length) state.turniNavi = rows;
  }

  async function loadTurniNavi() {
    const provider = window.NaviAdminFirebase;
    try {
      if (!provider) throw new Error('Firebase non disponibile');
      await provider.ready;
      const rows = provider.getTurniNavi ? await provider.getTurniNavi() : (await provider.getAdminUpdates()).turniNavi;
      state.firebaseNavi = Array.isArray(rows) ? rows : [];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(state.firebaseNavi)); } catch { /* spazio pieno: niente copia locale */ }
      notice('');
    } catch (error) {
      notice(readCache()
        ? `Navi e ormeggi dall'ultima copia salvata sul dispositivo (${error.message}).`
        : `Non riesco a leggere navi e ormeggi degli O.d.S. (${error.message}).`);
    }
    mergeTurniNavi();
    render();
  }

  // Turni degli agenti (per l'agente di turno a terra): stessi dati di NaviTurni e Oggi.
  function loadSchedule() {
    const shared = window.NaviSharedData;
    if (!shared?.loadCacheFirst) { state.schedule = { residenze: {} }; render(); return; }
    shared.loadCacheFirst(data => {
      state.schedule = data || { residenze: {} };
      mergeTurniNavi();
      render();
    }).catch(error => {
      console.warn('Servizi a terra: turni degli agenti non disponibili', error);
      if (!state.schedule) { state.schedule = { residenze: {} }; render(); }
    });
  }

  $('terra-residences').addEventListener('click', event => {
    const button = event.target.closest('[data-res]');
    if (!button || button.dataset.res === state.residence) return;
    state.residence = button.dataset.res;
    state.showPast = false;
    render();
  });
  $('terra-content').addEventListener('click', event => {
    if (!event.target.closest('[data-past]')) return;
    state.showPast = !state.showPast;
    render();
  });
  $('terra-print').addEventListener('click', () => {
    try { T.openResidence(state.residence, state.turniNavi, state.monday); } catch (error) { notice(error.message); }
  });

  // Popup dell'equipaggio come in NaviTurni: passando col mouse su una corsa, con il tasto Tab
  // o toccandola sul telefono. Nomi colorati per grado, il proprio in grassetto.
  function hideCrew() { document.querySelector('.crew-hover-tooltip')?.remove(); }
  function showCrew(row, x, y) {
    hideCrew();
    const code = row.dataset.crew, crew = state.crews?.[code] || [];
    const cte = comandante(crew);
    let me = '';
    try { me = norm(JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null')?.name); } catch { me = ''; }
    const box = document.createElement('div');
    box.className = 'crew-hover-tooltip';
    box.setAttribute('role', 'tooltip');
    const head = `<div class="crew-hover-head">${esc(code)}${row.dataset.ship ? ` · ${esc(row.dataset.ship)}` : ''}</div>`;
    box.innerHTML = head + (crew.length
      ? crew.map(member => `<div class="crew-hover-name${norm(member.name) === me ? ' is-logged' : ''}" style="color:${member.grado[1]}">` +
        `${esc(member.name)}${member.grado[0] ? `<small>${esc(member.grado[0])}${member.grado[0] === 'Capo timoniere' && member.name === cte ? ' · Cte.' : ''}</small>` : ''}</div>`).join('')
      : `<div class="crew-hover-name muted">${state.schedule ? 'Equipaggio non disponibile' : 'Caricamento equipaggio…'}</div>`);
    document.body.appendChild(box);
    const gap = 12, rect = box.getBoundingClientRect();
    let left = x + gap, top = y + gap;
    if (left + rect.width > innerWidth - 8) left = x - rect.width - gap;
    if (top + rect.height > innerHeight - 8) top = y - rect.height - gap;
    box.style.left = `${Math.max(8, left)}px`;
    box.style.top = `${Math.max(8, top)}px`;
  }
  const crewRow = target => target?.closest?.('#terra-content .nave[data-crew]');
  const hoverable = window.matchMedia?.('(hover: hover)')?.matches;
  document.addEventListener('mouseover', event => {
    const row = crewRow(event.target);
    if (!hoverable || !row || row.contains(event.relatedTarget)) return;
    showCrew(row, event.clientX, event.clientY);
  });
  document.addEventListener('mouseout', event => {
    const row = crewRow(event.target);
    if (!hoverable || !row || row.contains(event.relatedTarget)) return;
    hideCrew();
  });
  document.addEventListener('focusin', event => {
    const row = crewRow(event.target);
    if (!row) return;
    const rect = row.getBoundingClientRect();
    showCrew(row, rect.left + 40, rect.bottom - 6);
  });
  document.addEventListener('focusout', event => { if (crewRow(event.target)) hideCrew(); });
  document.addEventListener('click', event => {
    const row = crewRow(event.target);
    if (!row) { hideCrew(); return; }
    if (hoverable) return;
    const open = document.querySelector('.crew-hover-tooltip');
    if (open && open.dataset.for === row.dataset.crew + row.querySelector('.ora')?.textContent) { hideCrew(); return; }
    showCrew(row, event.clientX, event.clientY);
    const box = document.querySelector('.crew-hover-tooltip');
    if (box) box.dataset.for = row.dataset.crew + row.querySelector('.ora')?.textContent;
  });
  window.addEventListener('scroll', hideCrew, { passive: true });

  render();
  loadTurniNavi();
  loadSchedule();
  // Navi passate e prossima: aggiornate ogni minuto.
  setInterval(render, 60000);
})();
