// Pagina "Servizi a terra": la giornata a terra della residenza dell'agente (Desenzano o Maderno),
// con i pulsantini di NaviTurni per passare all'altra residenza. Pagina web, non il foglio A4:
// navi in ordine di orario (le gia' partite nascoste tranne l'ultima, prossima evidenziata, ormeggio
// del mattino con il rifornimento e della sera; a Maderno anche il traghetto Torri), servizi a
// terra con l'agente di turno e note. Il foglio A4 resta in "Stampa A4".
(function () {
  'use strict';

  const T = window.NaviServiziTerra;
  const D = T.DATA;
  const RESIDENZE = [{ code: 'D', name: 'DESENZANO', title: 'Desenzano' }, { code: 'M', name: 'MADERNO', title: 'Maderno' }];
  // Periodi in cui vale l'orario (O.d.S. 39/2026) e ultimo giorno delle corse SR (segnate con *).
  const PERIODI = [['2026-10-05', '2026-11-01'], ['2027-03-13', '2027-03-25']];
  const FINE_SR = '2026-10-11';
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const CACHE_KEY = 'navisuite.serviziTerra.turniNavi';
  // Incorporata in Il mio turno (window.NaviServiziTerraEmbed = true): la pagina che la ospita
  // ha solo #terra-content e decide residenza e giorno con NaviServiziTerraPage.show().
  // Gli elementi che mancano (pulsanti, giorni, titolo) diventano elementi fuori pagina.
  const EMBED = !!window.NaviServiziTerraEmbed;
  const offPage = {};
  const $ = id => document.getElementById(id) || (offPage[id] = offPage[id] || document.createElement('div'));

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
    firebaseNavi: readCache() || [], schedule: null, showPast: false, pontili: {}, day: '' };
  // Giorno passato da Il mio turno (?day=AAAA-MM-GG): si apre su quel giorno.
  {
    const asked = new URLSearchParams(location.search).get('day');
    if (/^\d{4}-\d{2}-\d{2}$/.test(asked || '') && asked !== iso(new Date())) state.day = asked;
  }
  try { state.pontili = JSON.parse(localStorage.getItem('navisuite.serviziTerra.pontili') || '{}') || {}; } catch { state.pontili = {}; }

  // Turni, equipaggi e comandante: assets/js/turni-giorno.js (in comune con Il mio turno).
  const { TERRA_RESIDENZA, norm, equipaggi, comandante } = window.NaviTurniGiorno;
  const agentiATerra = (data, day) => equipaggi(data, day).terra;

  // Ora attuale in minuti, solo se oggi vale l'orario; altrimenti null (niente passate/prossima).
  // Giorno mostrato (si scorre come nella pagina Oggi). Navi passate e prossima solo per oggi.
  function nowInfo() {
    const now = new Date();
    const realToday = iso(now);
    const day = state.day || realToday;
    const inService = PERIODI.some(([from, to]) => day >= from && day <= to);
    return {
      today: day,
      isToday: day === realToday,
      inService,
      minutes: inService && day === realToday ? now.getHours() * 60 + now.getMinutes() : null,
      srOff: day > FINE_SR
    };
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

  // ---- Pontile di ogni corsa (Desenzano) ----
  const PONTILI = ['1', '2', '3', '4', '5', '6'];
  const PONTILI_CACHE = 'navisuite.serviziTerra.pontili';
  const { courseKey, pontLabel } = T;
  // Valore del giorno: scelta di oggi, poi l'O.d.S., poi l'ultima scelta dei giorni prima.
  const pontileFor = (key, day, odsMooring) => T.pontileFor(state.pontili[key], day, odsMooring);
  function pontileSelect(key, day, odsMooring, when, follow = '') {
    const { value, source } = pontileFor(key, day, odsMooring);
    const options = ['', ...PONTILI];
    if (value && !options.includes(value)) options.push(value);
    const ods = pontLabel(odsMooring);
    if (ods && !options.includes(ods)) options.push(ods);
    const title = `Pontile${when ? ` ${when}` : ''}${source === 'ods' ? ' (dall\'O.d.S.)' : source === 'ieri' ? ' (come il giorno prima)' : ''}`;
    return `<label class="pontile-sel${value ? '' : ' empty'}${source === 'ods' ? ' ods' : ''}" title="${esc(title)}">⚓` +
      `<select data-pontile="${esc(key)}"${follow ? ` data-follow="${esc(follow)}"` : ''} aria-label="${esc(title)}">${options.map(option =>
        `<option value="${esc(option)}"${option === value ? ' selected' : ''}>${option ? esc(option) : '–'}</option>`).join('')}</select></label>`;
  }
  // Salva il pontile di una o piu' corse (un arrivo e la partenza che lo segue).
  async function savePontile(keys, value) {
    const day = nowInfo().today; // il giorno mostrato
    keys.forEach(key => { (state.pontili[key] = state.pontili[key] || {})[day] = value || '-'; });
    try { localStorage.setItem(PONTILI_CACHE, JSON.stringify(state.pontili)); } catch { /* niente copia locale */ }
    render();
    try {
      const provider = window.NaviAdminFirebase;
      if (!provider?.savePontileCorsa) throw new Error('Firebase non disponibile');
      await provider.ready;
      for (const key of keys) await provider.savePontileCorsa('DESENZANO', key, day, value || '-');
    } catch (error) {
      notice(`Pontile salvato solo su questo dispositivo (${error.message}).`);
    }
  }
  async function loadPontili() {
    try {
      const provider = window.NaviAdminFirebase;
      if (!provider?.getPontiliCorse) return;
      await provider.ready;
      state.pontili = await provider.getPontiliCorse('DESENZANO');
      try { localStorage.setItem(PONTILI_CACHE, JSON.stringify(state.pontili)); } catch { /* niente copia locale */ }
      if (!document.activeElement?.matches?.('select[data-pontile]')) render();
    } catch (error) {
      console.warn('Servizi a terra: pontili non disponibili', error);
    }
  }

  function naviCard(now) {
    const desenzano = state.residence === 'DESENZANO';
    const bolgette = D.BOLGETTE[state.residence];
    const split = desenzano ? '14.30' : '14.00';
    const turni = T.turniDelGiorno(state.turniNavi, now.today);
    const ieri = T.turniDelGiorno(state.turniNavi, addDays(now.today, -1));
    const crews = state.schedule ? equipaggi(state.schedule, now.today).navi : {};
    state.crews = crews;
    // BIS (Ufficio Movimento): corse fatte al posto della nave del turno e corse in aiuto (in piu').
    const OG = window.NaviOrarioGiorno;
    const incarichi = turni.BIS?.incarichi || [];
    const aiuti = OG ? incarichi.filter(inc => inc.tipo === 'aiuto').flatMap(inc => {
      const numeri = new Set(OG.corseIncarico(inc, now.today).map(c => c.numero));
      return D.NAVI_CON_TRAGHETTO[state.residence].filter(row => row[2] === inc.turno && numeri.has(String(row[3])))
        .map(row => [row[0], row[1], 'BIS', row[3], `${row[4]} · in aiuto alla ${inc.turno}`, row[5]]);
    }) : [];
    const navi = [...D.NAVI_CON_TRAGHETTO[state.residence], ...aiuti].sort((a, b) => T.minutes(a[0]) - T.minutes(b[0]));
    const firstIndex = {}, lastIndex = {};
    navi.forEach(([, , code], i) => { if (!(code in firstIndex)) firstIndex[code] = i; lastIndex[code] = i; });
    let nextFound = false;
    const items = navi.map(([time, kind, code, run, where, arrival], index) => {
      // Mattino: prima partenza del turno, la nave e' ormeggiata dalla sera prima (eventuale rifornimento).
      const morning = kind === 'P' && firstIndex[code] === index;
      // Sera: l'ultimo movimento del turno e' un arrivo, la nave resta qui per la notte.
      const evening = kind === 'A' && lastIndex[code] === index;
      // R (rifornimento) e B (bolgetta) a sinistra, il pontile sempre ultimo a destra.
      const badges = [];
      if (morning && turni[code]?.rif) badges.push('<b class="rifornimento" title="Rifornimento prima della corsa" aria-label="Rifornimento">R</b>');
      if (bolgette[run] && code !== 'BIS') {
        const label = bolgette[run].replace('BOLGETTA · ', 'Bolgetta: ').toLowerCase().replace(/^b/, 'B');
        badges.push(`<b class="bolgetta" title="${esc(label)}" aria-label="${esc(label)}">B</b>`);
      }
      const odsMooring = morning ? (turni[code]?.ormeggioMattino || ieri[code]?.ormeggio) : evening ? turni[code]?.ormeggio : '';
      if (desenzano) {
        // Desenzano: selettore del pontile su ogni corsa (proposto dall'O.d.S. o dal giorno prima).
        // Un arrivo seguito da una partenza della stessa nave: la nave riparte dallo stesso pontile.
        const after = kind === 'A' ? navi.slice(index + 1).find(row => row[2] === code) : null;
        const follow = after && after[1] === 'P' ? courseKey(after[0], after[2], after[3]) : '';
        badges.push(pontileSelect(courseKey(time, code, run), now.today, odsMooring, morning ? 'del mattino' : evening ? 'serale' : '', follow));
      } else if (odsMooring) {
        // Maderno: solo l'ormeggio del mattino e della sera dagli O.d.S.
        badges.push(`<b class="ormeggio" title="Ormeggio ${morning ? 'del mattino (dalla sera prima)' : 'serale'}">⚓ ${esc(pontLabel(odsMooring))}</b>`);
      }
      let state_ = '';
      if (now.srOff && where.includes('*')) state_ = 'off';
      else if (now.minutes != null) {
        if (T.minutes(time) < now.minutes) state_ = 'past';
        else if (!nextFound) { state_ = 'next'; nextFound = true; }
      }
      // corsa fatta dal BIS al posto della nave del turno: nave ed equipaggio del BIS
      const sostituita = OG && run && code !== 'BIS' ? OG.bisPerCorsa(incarichi, code, run, now.today) : null;
      const crewCode = sostituita ? 'BIS' : code;
      const ship = turni[crewCode]?.nave;
      const captain = comandante(crews[crewCode]);
      const bis = sostituita ? `<b class="bis" title="Al posto della nave del ${esc(code)}">BIS</b>` : '';
      // Corse sospese dall'Ufficio Movimento (lago mosso, guasto...)
      const sospesa = turni[code]?.sospesa ? `<b class="sospesa" title="${esc(turni[code].motivo || 'Corse sospese dal Movimento')}">SOSPESA</b>` : '';
      const info = [sospesa, bis, ship ? `<span class="ship-name">${esc(ship)}</span>` : '', captain ? `<span class="cte">${esc(captain)}</span>` : ''].filter(Boolean).join('');
      const html = `<span class="ora">${arrival ? `<small class="arr" title="Arrivo da Torri">arr. ${arrival}</small>` : ''}${time}</span>` +
        `<span class="tipo ${kind}">${D.KIND[kind]}<small>${run ? `corsa ${esc(run)}` : '–'}</small></span>${chip(code)}` +
        `<span class="dove"><span class="ship-line">${info || '<span class="muted">nave non indicata</span>'}</span>` +
        `${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}</span>`;
      return { html, state: state_, split: time === split, code, crewCode, ship, where, ferry: /^T[12]$/.test(code), sospesa: !!sospesa };
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
      const cls = `nave${item.sospesa ? ' sospesa' : ''}${item.ferry ? ' ferry' : ''}${item.split ? ' split' : ''}${isPast ? ' past' : ''}${item.state === 'next' ? ' next' : ''}`;
      return `<div class="${cls}" tabindex="0" data-crew="${esc(item.crewCode)}" data-ship="${esc(item.ship || '')}" data-where="${esc(item.where)}">${item.html}</div>`;
    }).join('');
    const toggle = hidden ? `<button type="button" class="past-toggle" data-past aria-expanded="${state.showPast}">` +
      `${state.showPast ? '▴ Nascondi le navi già partite' : `▾ Mostra le navi già partite (${hidden})`}</button>` : '';
    const legend = desenzano
      ? '⚓ pontile di ogni corsa: proposto dall\'O.d.S. (mattino e sera) o dalla scelta del giorno prima, si può cambiare · R = rifornimento · B = bolgetta · nave di oggi dagli O.d.S.'
      : `SCALO = nave in transito a Maderno · T1/T2 = traghetto Torri · * corsa SR solo fino all'11 ottobre 2026${now.srOff ? ' (ora non più effettuata)' : ''} · ⚓ ormeggio · R = rifornimento · B = bolgetta · nave di oggi dagli O.d.S.`;
    return card(desenzano ? 'Navi a Desenzano' : 'Navi e traghetto a Maderno', 'in ordine di orario',
      `${toggle}<div class="navi-list">${rows}</div><p class="legend">${esc(legend)}</p>`);
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
    const clock = new Date(), shown = parseIso(now.today);
    $('terra-day-label').textContent = `${GIORNI[shown.getDay()]} ${shown.getDate()} ${MESI[shown.getMonth()]}` +
      (now.isToday ? ` · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}` : '');
    $('terra-day-input').value = now.today;
    $('terra-day-today').hidden = now.isToday;
    state.dayMessage = now.inService ? '' : 'Orario non in vigore in questo giorno: in vigore dal 5/10 all\'1/11/2026 e dal 13 al 25/3/2027.';
    showNotice();
    // Prima l'orario delle navi, poi i servizi a terra con l'agente di turno.
    const left = [naviCard(now)];
    const right = [serviziCard(now), noteCard()];
    $('terra-content').innerHTML = `<div class="terra-col">${left.join('')}</div><div class="terra-col">${right.join('')}</div>`;
    if (EMBED) return;
    const url = new URL(location.href);
    url.searchParams.set('res', state.residence.toLowerCase());
    if (state.day) url.searchParams.set('day', state.day); else url.searchParams.delete('day');
    history.replaceState(null, '', url);
  }

  // Avvisi: giorno fuori orario e problemi di connessione, uno sotto l'altro.
  function showNotice() {
    const text = [state.dayMessage, state.errorMessage].filter(Boolean).join(' · ');
    $('terra-notice').hidden = !text;
    $('terra-notice').textContent = text;
  }
  function notice(text) {
    state.errorMessage = text || '';
    showNotice();
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
  $('terra-content').addEventListener('change', event => {
    const select = event.target.closest('select[data-pontile]');
    if (select) savePontile([select.dataset.pontile, select.dataset.follow].filter(Boolean), select.value);
  });
  $('terra-content').addEventListener('click', event => {
    if (!event.target.closest('[data-past]')) return;
    state.showPast = !state.showPast;
    render();
  });
  // Scorrimento dei giorni come nella pagina Oggi: frecce, calendario e ritorno a oggi.
  const goToDay = day => { state.day = day === iso(new Date()) ? '' : day; state.showPast = false; render(); };
  $('terra-day-prev').addEventListener('click', () => goToDay(addDays(nowInfo().today, -1)));
  $('terra-day-next').addEventListener('click', () => goToDay(addDays(nowInfo().today, 1)));
  $('terra-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  $('terra-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });
  $('terra-print').addEventListener('click', () => {
    // A4 della settimana del giorno mostrato (oggi: settimana proposta come in Aggiornamenti).
    const day = nowInfo();
    const shown = parseIso(day.today);
    const monday = day.isToday ? state.monday : addDays(day.today, -((shown.getDay() + 6) % 7));
    try { T.openResidence(state.residence, state.turniNavi, monday); } catch (error) { notice(error.message); }
  });

  // Popup dell'equipaggio come in NaviTurni: passando col mouse su una corsa, con il tasto Tab
  // o toccandola sul telefono. Nomi colorati per grado, il proprio in grassetto.
  function hideCrew() { document.querySelector('.crew-hover-tooltip')?.remove(); }
  function showCrew(row, x, y) {
    hideCrew();
    const code = row.dataset.crew, crew = state.crews?.[code] || [];
    let me = '';
    try { me = norm(JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null')?.name); } catch { me = ''; }
    const box = document.createElement('div');
    box.className = 'crew-hover-tooltip';
    box.setAttribute('role', 'tooltip');
    const head = `<div class="crew-hover-head">${esc(code)}${row.dataset.ship ? ` · ${esc(row.dataset.ship)}` : ''}</div>` +
      (row.dataset.where ? `<div class="crew-hover-where">${esc(row.dataset.where)}</div>` : '');
    box.innerHTML = head + (crew.length
      ? crew.map(member => `<div class="crew-hover-name${norm(member.name) === me ? ' is-logged' : ''}" style="color:${member.grado[1]}">` +
        `${esc(member.name)}${member.grado[0] ? `<small>${esc(member.grado[0])}</small>` : ''}</div>`).join('')
      : `<div class="crew-hover-name muted">${state.schedule ? 'Equipaggio non disponibile' : 'Caricamento equipaggio…'}</div>`);
    document.body.appendChild(box);
    const gap = 12, rect = box.getBoundingClientRect();
    let left = x + gap, top = y + gap;
    if (left + rect.width > innerWidth - 8) left = x - rect.width - gap;
    if (top + rect.height > innerHeight - 8) top = y - rect.height - gap;
    box.style.left = `${Math.max(8, left)}px`;
    box.style.top = `${Math.max(8, top)}px`;
  }
  // Il selettore del pontile non apre il popup dell'equipaggio.
  const crewRow = target => target?.closest?.('.pontile-sel') ? null : target?.closest?.('#terra-content .nave[data-crew]');
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

  // Per Il mio turno: mostra la residenza e il giorno indicati.
  window.NaviServiziTerraPage = {
    show({ residence, day } = {}) {
      if (residence && RESIDENZE.some(item => item.name === residence)) state.residence = residence;
      state.day = day && day !== iso(new Date()) ? day : '';
      state.showPast = false;
      render();
    }
  };

  render();
  loadTurniNavi();
  loadSchedule();
  loadPontili();
  // Turni modificati in NaviDiaria/NaviTurni (agenti di turno ed equipaggi). Incorporata in Il mio
  // turno le carica gia' la pagina che la ospita.
  if (!EMBED) {
    const profilo = () => { try { return JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; } };
    const aggiornaModifiche = () => window.NaviTurniGiorno.caricaModifiche(profilo()).then(() => { if (state.schedule) render(); });
    aggiornaModifiche();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) aggiornaModifiche(); });
    setInterval(aggiornaModifiche, 300000);
  }
  // Navi passate e prossima: aggiornate ogni minuto.
  // (non mentre si sta scegliendo un pontile, per non chiudere il selettore)
  // I pontili scelti dai colleghi arrivano con la rilettura da Firebase ogni minuto.
  setInterval(() => {
    if (document.activeElement?.matches?.('select[data-pontile]')) return;
    if (state.residence === 'DESENZANO') loadPontili(); else render();
  }, 60000);
})();
