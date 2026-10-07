// Pagina "Orario": orario interattivo del giorno (O.d.S. 39/2026) in tre viste.
// - Lago: mappa schematica del Garda con le navi in servizio nella posizione dell'ora scelta
//   (adesso o con il cursore del tempo); toccando una nave: turno, nave, comandante, equipaggio,
//   dove sta andando e i prossimi scali.
// - Da -> A: viaggi diretti o con un cambio fra due scali, con turno e nave del giorno.
// - Scalo: tabellone di partenze e arrivi di uno scalo; toccando una riga, tutti gli scali.
// Corse e scali da orario-giorno.js; navi, equipaggi e turni modificati come in Il mio turno.
(function () {
  'use strict';

  const O = window.NaviOrarioGiorno;
  const G = window.NaviTurniGiorno;
  const T = window.NaviServiziTerra;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const { minutes, hhmm } = O;
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const chip = code => `<span class="chip" data-code="${esc(code)}">${esc(code)}</span>`;

  // Scali nell'ordine dell'orario ufficiale (Desenzano - Riva) e posizione sulla mappa schematica.
  const SCALI = [
    ['Desenzano', 30, 134], ['Peschiera', 74, 128], ['Sirmione', 48, 122], ['Lazise', 72, 112], ['Bardolino', 68, 100],
    ['Garda', 62, 86], ['Torri', 60, 74], ['Portese', 19, 96], ['Salò', 20, 86], ['Gardone', 24, 78],
    ['Maderno', 27, 70], ['Gargnano', 33, 50], ['Brenzone', 61, 54], ['Malcesine', 61, 36], ['Limone', 38, 24],
    ['Torbole', 60, 4], ['Riva', 50, 2]
  ];
  const POS = Object.fromEntries(SCALI.map(([nome, x, y]) => [nome, [x, y]]));
  const LAGO = '46,0 56,0 64,6 62,20 63,40 63,60 63,78 66,90 71,104 75,118 77,131 68,139 56,134 50,125 46,125 44,133 34,139 24,135 17,122 16,104 17,90 21,80 25,68 30,54 35,40 37,24 42,10';
  const COLORI = { D1: '#5b8cff', R1: '#5b8cff', P1: '#5b8cff', T1: '#5b8cff', D2: '#46c98a', R2: '#46c98a', P2: '#46c98a', T2: '#46c98a', R3: '#f59a52', M1: '#f59a52', SR1: '#a78bfa', SR2: '#a78bfa', BIS: '#67d7e6' };

  function profile() {
    try { return JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; }
  }
  const SCALO_RESIDENZA = { DESENZANO: 'Desenzano', MADERNO: 'Maderno', RIVA: 'Riva', PESCHIERA: 'Peschiera' };
  const mioScalo = () => SCALO_RESIDENZA[String(profile()?.residence || '').toUpperCase()] || 'Desenzano';

  const params = new URLSearchParams(location.search);
  const scaloValido = value => (POS[value] ? value : '');
  const state = {
    day: /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') && params.get('day') !== iso(new Date()) ? params.get('day') : '',
    view: ['lago', 'viaggio', 'scalo'].includes(params.get('vista')) ? params.get('vista') : 'lago',
    from: scaloValido(params.get('da')) || mioScalo(), to: scaloValido(params.get('a')) || '',
    scalo: scaloValido(params.get('scalo')) || mioScalo(),
    time: null, playing: null, selected: '', open: '', showPast: false,
    schedule: null, firebaseNavi: []
  };
  if (!state.to) state.to = state.from === 'Desenzano' ? 'Sirmione' : 'Desenzano';
  const today = () => state.day || iso(new Date());
  const realToday = () => today() === iso(new Date());
  const nowMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
  // Ora mostrata: quella del cursore, altrimenti adesso (o le 9.00 per gli altri giorni).
  const shownTime = () => state.time ?? (realToday() ? nowMinutes() : 9 * 60);

  // Dati del giorno: viaggi, navi assegnate ed equipaggi.
  function giornata() {
    const day = today();
    const turniNavi = [...(state.schedule?.turni_navi || []), ...state.firebaseNavi];
    return {
      day,
      viaggi: O.viaggiDelGiorno(day),
      navi: T.turniDelGiorno(turniNavi, day),
      crews: state.schedule ? G.equipaggi(state.schedule, day).navi : {}
    };
  }
  const naveDi = (g, code) => g.navi[code]?.nave || '';
  const naveInfo = (g, code) => [naveDi(g, code), G.comandante(g.crews[code])].filter(Boolean).join(' · ');

  // ---------------- Lago ----------------
  // Punti del turno nel giorno: [{scalo, t, corsa}] in ordine di tempo.
  function puntiDelTurno(viaggi, code) {
    return viaggi.filter(v => v.turno === code).flatMap(v => v.scali.map(([scalo, ora, corsa]) => ({ scalo, t: minutes(ora), corsa })))
      .sort((a, b) => a.t - b.t);
  }
  // Dove si trova il turno all'ora t.
  function posizione(punti, t) {
    if (!punti.length) return null;
    const first = punti[0], last = punti[punti.length - 1];
    if (t < first.t) return { stato: 'prima', scalo: first.scalo, xy: POS[first.scalo], prossimo: first };
    if (t >= last.t) return { stato: 'fine', scalo: last.scalo, xy: POS[last.scalo], ultimo: last };
    let i = 0;
    while (i < punti.length - 1 && punti[i + 1].t <= t) i += 1;
    const a = punti[i], b = punti[i + 1];
    if (a.scalo === b.scalo) return { stato: 'fermo', scalo: a.scalo, xy: POS[a.scalo], fino: b, i };
    const f = (t - a.t) / Math.max(1, b.t - a.t);
    const [ax, ay] = POS[a.scalo], [bx, by] = POS[b.scalo];
    return { stato: 'naviga', da: a, a: b, xy: [ax + (bx - ax) * f, ay + (by - ay) * f], i: i + 1 };
  }
  function statoTesto(p) {
    if (!p) return '';
    if (p.stato === 'prima') return `Ormeggiata a ${p.scalo} · prima partenza ${hhmm(p.prossimo.t)}`;
    if (p.stato === 'fine') return `Fine servizio a ${p.scalo} (${hhmm(p.ultimo.t)})`;
    if (p.stato === 'fermo') return `A ${p.scalo} · riparte alle ${hhmm(p.fino.t)}`;
    return `Da ${p.da.scalo} (${hhmm(p.da.t)}) verso ${p.a.scalo} (${hhmm(p.a.t)}) · corsa ${p.a.corsa}`;
  }

  // Mappa, elenco e dettaglio all'ora t (il cursore aggiorna solo queste parti).
  function lagoParti() {
    const g = giornata();
    const t = shownTime();
    const turni = [...new Set(g.viaggi.map(v => v.turno))];
    const navi = turni.map(code => ({ code, punti: puntiDelTurno(g.viaggi, code) }))
      .map(item => ({ ...item, pos: posizione(item.punti, t) })).filter(item => item.pos);
    // Navi vicine (stesso scalo o quasi): affiancate per non sovrapporsi.
    const posti = [];
    const marker = navi.map(item => {
      let [x, y] = item.pos.xy;
      while (posti.some(([px, py]) => Math.hypot(px - x, py - y) < 6.6)) x += 7.2;
      posti.push([x, y]);
      const dx = 0;
      const ferma = item.pos.stato === 'prima' || item.pos.stato === 'fine';
      const sel = item.code === state.selected;
      return `<g class="or-ship${ferma ? ' moored' : ''}${sel ? ' selected' : ''}" data-ship="${item.code}" transform="translate(${(x + dx).toFixed(2)} ${y.toFixed(2)})" tabindex="0" role="button" aria-label="${esc(item.code)}: ${esc(statoTesto(item.pos))}">` +
        `<circle r="${sel ? 4.6 : 3.8}" fill="${COLORI[item.code] || '#94a3b8'}"/><text y="1.1">${esc(item.code)}</text></g>`;
    }).join('');
    const scali = SCALI.map(([nome, x, y]) => {
      const right = x > 50;
      return `<g class="or-port" data-port="${esc(nome)}"><circle cx="${x}" cy="${y}" r="1.3"/>` +
        `<text x="${right ? x + 2.6 : x - 2.6}" y="${y + 1}" text-anchor="${right ? 'start' : 'end'}">${esc(nome)}</text></g>`;
    }).join('');
    const svg = `<svg class="or-map" viewBox="-14 -6 128 150" role="img" aria-label="Mappa schematica del lago con le navi">` +
      `<polygon class="or-lake" points="${LAGO}"/>${scali}${marker}</svg>`;
    const ordinate = navi.slice().sort((a, b) => O.TURNI.indexOf(a.code) - O.TURNI.indexOf(b.code));
    const lista = ordinate.map(item => `<button type="button" class="or-ship-row${item.code === state.selected ? ' active' : ''}" data-ship="${item.code}">` +
      `${chip(item.code)}<span><b>${esc(naveInfo(g, item.code) || 'nave non indicata')}</b><small>${esc(statoTesto(item.pos))}</small></span></button>`).join('');
    const dettaglio = state.selected ? dettaglioNave(g, state.selected, t) : '';
    const side = (dettaglio || '') + card('Navi', `${navi.length} in servizio · tocca una nave`, `<div class="or-ship-list">${lista || '<p class="legend">Nessuna nave in servizio in questo giorno.</p>'}</div>`);
    return { t, svg, side };
  }

  function controlliTempo(t) {
    const min = 7 * 60, max = 20 * 60 + 30;
    const live = state.time == null && realToday();
    return `<button type="button" class="or-play" data-play aria-label="${state.playing ? 'Ferma' : 'Fai scorrere il tempo'}">${state.playing ? '❚❚' : '▶'}</button>` +
      `<input type="range" id="or-slider" min="${min}" max="${max}" step="1" value="${Math.min(max, Math.max(min, t))}" aria-label="Ora">` +
      `<b class="or-clock" id="or-clock">${hhmm(t)}</b>${live ? '<span class="or-live">ADESSO</span>' : `<button type="button" class="terra-day-today" data-now>${realToday() ? 'Adesso' : '9.00'}</button>`}`;
  }

  function renderLago() {
    const { t, svg, side } = lagoParti();
    $('orario-content').innerHTML = `<div class="terra-grid or-lago"><div class="terra-col">` +
      card('Lago', 'posizione delle navi all\'ora scelta', `<div class="or-time" id="or-time">${controlliTempo(t)}</div><div id="or-map-wrap">${svg}</div>`) +
      `</div><div class="terra-col" id="or-side">${side}</div></div>`;
  }
  // Durante il trascinamento del cursore: solo mappa, elenco e ora (il cursore resta).
  function aggiornaLago() {
    const { t, svg, side } = lagoParti();
    $('or-map-wrap').innerHTML = svg;
    $('or-side').innerHTML = side;
    $('or-clock').textContent = hhmm(t);
    const live = document.querySelector('#or-time .or-live');
    if (live && state.time != null) live.outerHTML = `<button type="button" class="terra-day-today" data-now>${realToday() ? 'Adesso' : '9.00'}</button>`;
  }

  function dettaglioNave(g, code, t) {
    const punti = puntiDelTurno(g.viaggi, code);
    const pos = posizione(punti, t);
    if (!pos) return '';
    const from = pos.stato === 'naviga' ? pos.i : pos.stato === 'fermo' ? pos.i + 1 : pos.stato === 'prima' ? 0 : punti.length;
    const prossimi = punti.slice(from, from + 6).map(p => `<li><span>${hhmm(p.t)}</span>${esc(p.scalo)}<small>c. ${esc(p.corsa)}</small></li>`).join('');
    const crew = g.crews[code] || [];
    const equipaggio = crew.length ? `<ul class="mt-crew">${crew.map(m => `<li style="color:${m.grado[1]}"><b>${esc(m.name)}</b><small>${esc(m.grado[0] || '')}</small></li>`).join('')}</ul>` : '';
    return card(`${code} ${naveDi(g, code)}`.trim(), G.comandante(crew) || '',
      `<p class="or-status">${esc(statoTesto(pos))}</p>${prossimi ? `<p class="or-sub">Prossimi scali</p><ol class="mt-scali or-next">${prossimi}</ol>` : ''}${equipaggio}`, 'or-detail');
  }

  // ---------------- Da -> A ----------------
  function soluzioni(g, from, to) {
    const out = [];
    const legs = [];
    // la corsa di una tratta e' quella con cui la nave lascia lo scalo (lo scalo successivo)
    g.viaggi.forEach(v => v.scali.forEach(([scalo, ora], i) => {
      v.scali.slice(i + 1).forEach(([scalo2, ora2]) => legs.push({ v, from: scalo, dep: minutes(ora), to: scalo2, arr: minutes(ora2), corsa: v.scali[i + 1][2] }));
    }));
    // dirette: dallo scalo di partenza al primo passaggio dallo scalo d'arrivo
    legs.filter(l => l.from === from && l.to === to).forEach(l => out.push({ dep: l.dep, arr: l.arr, legs: [l] }));
    // un cambio
    legs.filter(l => l.from === from && l.to !== to).forEach(a => {
      legs.filter(b => b.from === a.to && b.to === to && b.v !== a.v && b.dep >= a.arr + 3 && b.dep <= a.arr + 150)
        .forEach(b => out.push({ dep: a.dep, arr: b.arr, legs: [a, b] }));
    });
    // per ogni partenza la soluzione che arriva prima; tolte quelle superate (parti dopo e arrivi prima)
    const best = new Map();
    out.forEach(s => {
      const key = s.dep;
      const cur = best.get(key);
      if (!cur || s.arr < cur.arr || (s.arr === cur.arr && s.legs.length < cur.legs.length)) best.set(key, s);
    });
    const list = [...best.values()].sort((a, b) => a.dep - b.dep);
    return list.filter(s => !list.some(o => o !== s && o.dep >= s.dep && o.arr < s.arr) &&
      !list.some(o => o !== s && o.dep > s.dep && o.arr <= s.arr));
  }

  function renderViaggio() {
    const g = giornata();
    const opzioni = sel => SCALI.map(([nome]) => `<option${nome === sel ? ' selected' : ''}>${esc(nome)}</option>`).join('');
    const form = `<div class="or-route"><label><span>Da</span><select id="or-from">${opzioni(state.from)}</select></label>` +
      `<button type="button" class="or-swap" data-swap aria-label="Inverti">⇅</button>` +
      `<label><span>A</span><select id="or-to">${opzioni(state.to)}</select></label></div>`;
    const tutte = state.from === state.to ? [] : soluzioni(g, state.from, state.to);
    const ora = realToday() ? nowMinutes() : -1;
    const passate = tutte.filter(s => s.dep < ora);
    const visibili = state.showPast ? tutte : tutte.filter(s => s.dep >= ora);
    const toggle = passate.length ? `<button type="button" class="past-toggle" data-past>${state.showPast ? '▴ Nascondi i viaggi già partiti' : `▾ Mostra i viaggi già partiti (${passate.length})`}</button>` : '';
    const righe = visibili.map((s, i) => {
      const durata = s.arr - s.dep;
      const tratte = s.legs.map(l => `<div class="or-leg">${chip(l.v.turno)}<span><b>${hhmm(l.dep)} ${esc(l.from)} → ${hhmm(l.arr)} ${esc(l.to)}</b>` +
        `<small>corsa ${esc(l.corsa)}${naveInfo(g, l.v.turno) ? ` · ${esc(naveInfo(g, l.v.turno))}` : ''}</small></span></div>`).join('<div class="or-change">cambio</div>');
      return `<div class="or-trip${i === 0 && realToday() && !state.showPast ? ' next' : ''}${s.dep < ora ? ' past' : ''}"><div class="or-trip-head"><b>${hhmm(s.dep)} → ${hhmm(s.arr)}</b>` +
        `<span>${durata >= 60 ? `${Math.floor(durata / 60)}h${String(durata % 60).padStart(2, '0')}` : `${durata}min`} · ${s.legs.length === 1 ? 'diretta' : `1 cambio a ${esc(s.legs[0].to)}`}</span></div>${tratte}</div>`;
    }).join('');
    const vuoto = state.from === state.to ? 'Scegli due scali diversi.' : tutte.length ? 'Nessun altro viaggio oggi.' : 'Nessun collegamento in questo giorno.';
    $('orario-content').innerHTML = `<div class="or-single">${card('Da scalo a scalo', 'dirette e con un cambio', form + toggle + (righe || `<p class="legend">${vuoto}</p>`))}</div>`;
  }

  // ---------------- Scalo ----------------
  // Inizio e fine di una corsa nel viaggio. Lo scalo in cui la corsa precedente arriva e questa
  // riparte alla stessa ora compare una volta sola (con la corsa precedente): e' l'inizio.
  function inizioCorsa(v, numero) {
    const j = v.scali.findIndex(s => s[2] === numero);
    if (j < 0) return '';
    const prev = v.scali[j - 1];
    return prev && prev[0] !== v.scali[j][0] ? prev[0] : v.scali[j][0];
  }
  const fineCorsa = (v, numero) => v.scali.filter(s => s[2] === numero).pop()?.[0] || '';

  function eventiScalo(g, scalo) {
    const out = [];
    g.viaggi.forEach(v => v.scali.forEach(([nome, ora, corsa], i) => {
      if (nome !== scalo) return;
      const prev = v.scali[i - 1], next = v.scali[i + 1];
      let kind = 'S';
      if (!prev || prev[0] === nome) kind = next ? 'P' : 'A';
      else if (!next || next[0] === nome) kind = 'A';
      // in partenza o di passaggio vale la corsa con cui la nave riparte; da/per sono inizio e fine della corsa
      const numero = kind === 'A' ? corsa : (next?.[2] || corsa);
      const origine = inizioCorsa(v, kind === 'A' ? corsa : numero);
      const destinazione = fineCorsa(v, numero);
      out.push({ v, ora, t: minutes(ora), corsa: numero, kind, dove: kind === 'A' ? `da ${origine}` : kind === 'P' ? `per ${destinazione}` : `${origine} › ${destinazione}`, key: `${v.turno}|${numero}|${ora}` });
    }));
    return out.sort((a, b) => a.t - b.t || a.v.turno.localeCompare(b.v.turno));
  }

  function renderScalo() {
    const g = giornata();
    const select = `<label class="or-station"><span>Scalo</span><select id="or-scalo">${SCALI.map(([nome]) => `<option${nome === state.scalo ? ' selected' : ''}>${esc(nome)}</option>`).join('')}</select></label>`;
    const eventi = eventiScalo(g, state.scalo);
    const ora = realToday() ? nowMinutes() : -1;
    let nextFound = false;
    eventi.forEach(e => { e.stato = e.t < ora ? 'past' : !nextFound && ora >= 0 ? (nextFound = true, 'next') : ''; });
    const pastIdx = eventi.map((e, i) => e.stato === 'past' ? i : -1).filter(i => i >= 0);
    const lastPast = pastIdx[pastIdx.length - 1];
    const hidden = Math.max(0, pastIdx.length - 1);
    const toggle = hidden ? `<button type="button" class="past-toggle" data-past>${state.showPast ? '▴ Nascondi le navi già passate' : `▾ Mostra le navi già passate (${hidden})`}</button>` : '';
    const KIND = { P: 'PARTENZA', A: 'ARRIVO', S: 'SCALO' };
    const righe = eventi.map((e, i) => {
      if (e.stato === 'past' && i !== lastPast && !state.showPast) return '';
      const aperto = state.open === e.key;
      const info = naveInfo(g, e.v.turno);
      const scali = aperto ? `<ol class="mt-scali or-stops">${e.v.scali.map(([nome, orario, corsa]) =>
        `<li class="${nome === state.scalo && orario === e.ora ? 'coming' : ''}"><span>${esc(orario)}</span>${esc(nome)}<small>c. ${esc(corsa)}</small></li>`).join('')}</ol>` : '';
      return `<div class="or-board-item${aperto ? ' open' : ''}"><div class="nave${/^T[12]$/.test(e.v.turno) ? ' ferry' : ''}${e.stato === 'past' ? ' past' : ''}${e.stato === 'next' ? ' next' : ''}" data-open="${esc(e.key)}" tabindex="0" role="button" aria-expanded="${aperto}">` +
        `<span class="ora">${esc(e.ora)}</span><span class="tipo ${e.kind}">${KIND[e.kind]}<small>corsa ${esc(e.corsa)}</small></span>${chip(e.v.turno)}` +
        `<span class="dove"><span class="ship-line"><span class="ship-name">${esc(e.dove)}</span>${info ? `<span class="cte">${esc(info)}</span>` : ''}</span></span></div>${scali}</div>`;
    }).join('');
    $('orario-content').innerHTML = `<div class="or-single">${card(`Tabellone ${state.scalo}`, `${eventi.length} passaggi`, select + toggle +
      (righe ? `<div class="navi-list">${righe}</div>` : '<p class="legend">Nessuna nave in questo scalo nel giorno scelto.</p>'))}</div>`;
  }

  // ---------------- Pagina ----------------
  function card(title, side, body, cls = '') {
    return `<section class="terra-card ${cls}"><div class="terra-card-head"><h2>${esc(title)}</h2>${side ? `<small>${esc(side)}</small>` : ''}</div><div class="terra-card-body">${body}</div></section>`;
  }

  function render() {
    const day = today(), shown = parseIso(day), clock = new Date();
    $('orario-day-label').textContent = `${GIORNI[shown.getDay()]} ${shown.getDate()} ${MESI[shown.getMonth()]}` +
      (realToday() ? ` · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}` : '');
    $('orario-day-input').value = day;
    $('orario-day-today').hidden = realToday();
    document.querySelectorAll('#orario-tabs [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    const attivi = O.TURNI.filter(code => O.inServizio(code, day));
    const notice = !attivi.length ? 'Nessuna corsa in orario in questo giorno.' :
      !attivi.includes('D1') ? 'In questo periodo è attivo solo il traghetto Maderno – Torri.' : '';
    $('orario-notice').hidden = !notice;
    $('orario-notice').textContent = notice;
    if (state.view === 'lago') renderLago();
    else if (state.view === 'viaggio') renderViaggio();
    else renderScalo();
    const url = new URL(location.href);
    url.search = '';
    if (state.day) url.searchParams.set('day', state.day);
    url.searchParams.set('vista', state.view);
    if (state.view === 'viaggio') { url.searchParams.set('da', state.from); url.searchParams.set('a', state.to); }
    if (state.view === 'scalo') url.searchParams.set('scalo', state.scalo);
    history.replaceState(null, '', url);
  }

  function stopPlay() { if (state.playing) { clearInterval(state.playing); state.playing = null; } }
  const goToDay = day => { state.day = day === iso(new Date()) ? '' : day; state.time = null; state.showPast = false; state.open = ''; stopPlay(); render(); };
  $('orario-day-prev').addEventListener('click', () => goToDay(addDays(today(), -1)));
  $('orario-day-next').addEventListener('click', () => goToDay(addDays(today(), 1)));
  $('orario-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  $('orario-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });
  $('orario-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    state.view = button.dataset.view; state.showPast = false; stopPlay(); render();
  });

  const content = $('orario-content');
  content.addEventListener('input', event => {
    if (event.target.id === 'or-slider') {
      stopPlay();
      state.time = Number(event.target.value);
      aggiornaLago();
    }
  });
  content.addEventListener('change', event => {
    if (event.target.id === 'or-from') state.from = event.target.value;
    else if (event.target.id === 'or-to') state.to = event.target.value;
    else if (event.target.id === 'or-scalo') { state.scalo = event.target.value; state.open = ''; }
    else return;
    state.showPast = false;
    render();
  });
  content.addEventListener('click', event => {
    const ship = event.target.closest('[data-ship]');
    if (ship) { state.selected = state.selected === ship.dataset.ship ? '' : ship.dataset.ship; render(); return; }
    if (event.target.closest('[data-now]')) { stopPlay(); state.time = realToday() ? null : 9 * 60; render(); return; }
    if (event.target.closest('[data-play]')) {
      if (state.playing) { stopPlay(); render(); return; }
      state.time = shownTime();
      state.playing = setInterval(() => {
        state.time = state.time >= 20 * 60 + 30 ? 7 * 60 : state.time + 2;
        aggiornaLago();
        if ($('or-slider')) $('or-slider').value = state.time;
      }, 120);
      render();
      return;
    }
    if (event.target.closest('[data-swap]')) { [state.from, state.to] = [state.to, state.from]; render(); return; }
    if (event.target.closest('[data-past]')) { state.showPast = !state.showPast; render(); return; }
    const row = event.target.closest('[data-open]');
    if (row) { state.open = state.open === row.dataset.open ? '' : row.dataset.open; render(); }
  });
  content.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-ship],[data-open]');
    if (!target) return;
    event.preventDefault();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  render();
  window.NaviSharedData?.loadCacheFirst?.(data => { state.schedule = data || { residenze: {} }; render(); })
    .catch(error => console.warn('Orario: turni non disponibili', error));
  (async () => {
    try {
      const provider = window.NaviAdminFirebase;
      await provider.ready;
      state.firebaseNavi = await provider.getTurniNavi();
      render();
    } catch (error) { console.warn('Orario: navi non disponibili', error); }
  })();
  G.caricaModifiche(profile()).then(() => { if (state.schedule) render(); });
  // Adesso: posizioni e tabellone aggiornati ogni minuto (non mentre si usa il cursore).
  setInterval(() => { if (state.time == null && !state.playing && !document.activeElement?.matches?.('select')) render(); }, 60000);
})();
