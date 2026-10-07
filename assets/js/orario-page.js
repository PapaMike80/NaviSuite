// Pagina "Orario": orario interattivo del giorno (O.d.S. 39/2026) in tre viste.
// - Lago: mappa del Garda (orario-lago.js) con le navi in servizio nella posizione dell'ora scelta
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

  // Scali nell'ordine dell'orario ufficiale (Desenzano - Riva). Mappa: costa, pontili, boe davanti
  // ai pontili (dove sta la nave) e rotte in acqua fra due scali (orario-lago.js).
  const SCALI = ['Desenzano', 'Peschiera', 'Sirmione', 'Lazise', 'Bardolino', 'Garda', 'Torri', 'Portese', 'Salò',
    'Gardone', 'Maderno', 'Gargnano', 'Brenzone', 'Malcesine', 'Limone', 'Torbole', 'Riva'];
  const MAPPA = window.NaviLagoMappa;
  const POS = Object.fromEntries(SCALI.map(nome => [nome, MAPPA.scali[nome].boa]));
  const COSTA = MAPPA.costa.slice(1, -1).split(' L').map(p => p.split(' ').map(Number));
  function inAcqua([x, y]) {
    let dentro = false;
    for (let i = 0, j = COSTA.length - 1; i < COSTA.length; j = i, i += 1) {
      const [xi, yi] = COSTA[i], [xj, yj] = COSTA[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }
  // Rotta fra due scali: boa di partenza, punti in acqua, boa d'arrivo.
  function rotta(a, b) {
    const via = MAPPA.rotte[`${a}|${b}`] || (MAPPA.rotte[`${b}|${a}`] || []).slice().reverse();
    return [POS[a], ...via, POS[b]];
  }
  // Punto a frazione f della rotta (per lunghezza); con parte=true la rotta fin li'.
  function lungoRotta(punti, f, parte = false) {
    const tratti = punti.slice(1).map((p, i) => Math.hypot(p[0] - punti[i][0], p[1] - punti[i][1]));
    let resto = f * tratti.reduce((s, l) => s + l, 0);
    for (let i = 0; i < tratti.length; i += 1) {
      if (resto <= tratti[i] || i === tratti.length - 1) {
        const k = tratti[i] ? Math.min(1, resto / tratti[i]) : 0;
        const xy = [punti[i][0] + (punti[i + 1][0] - punti[i][0]) * k, punti[i][1] + (punti[i + 1][1] - punti[i][1]) * k];
        return parte ? [...punti.slice(0, i + 1), xy] : xy;
      }
      resto -= tratti[i];
    }
    return parte ? punti : punti[punti.length - 1];
  }
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
    time: null, playing: null, selected: '', open: '', showPast: false, gps: null, fromScelto: false, scaloScelto: !!params.get('scalo'),
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
    const navi = T.turniDelGiorno(turniNavi, day);
    // BIS dall'Ufficio Movimento: corse in aiuto (viaggi in piu') e corse al posto di un'altra nave
    const incarichi = navi.BIS?.incarichi || [];
    // ritardi del Movimento: orari spostati (anche delle corse dopo, se la nave arriva tardi)
    const ritardi = O.ritardiDelGiorno(navi);
    const bisAttivo = O.inServizio('BIS', day) && !navi.BIS?.sospesa;
    const bis = bisAttivo ? O.viaggiBis(incarichi, day, ritardi) : [];
    const ritardo = {};
    [...O.corseDelGiorno(day, ritardi), ...(bisAttivo ? O.corseBis(incarichi.filter(inc => inc.tipo === 'aiuto'), day, ritardi) : [])]
      .forEach(c => { if (c.ritardo) ritardo[`${c.turno}|${c.numero}`] = c.ritardo; });
    return {
      day, incarichi, ritardo,
      // le corse sospese dall'Ufficio Movimento non ci sono (ne' sul lago, ne' nei viaggi, ne' allo scalo)
      viaggi: [...O.viaggiDelGiorno(day, ritardi).filter(v => !navi[v.turno]?.sospesa), ...bis],
      navi,
      crews: state.schedule ? G.equipaggi(state.schedule, day).navi : {}
    };
  }
  const naveDi = (g, code) => g.navi[code]?.nave || '';
  // Chi fa la corsa: il turno o il BIS al posto della sua nave.
  const chi = (g, code, corsa) => (code !== 'BIS' && corsa && O.bisPerCorsa(g.incarichi, code, corsa, g.day) ? 'BIS' : code);
  const naveInfo = (g, code, corsa = '') => {
    const c = chi(g, code, corsa);
    return [c !== code ? 'BIS' : '', naveDi(g, c), G.comandante(g.crews[c])].filter(Boolean).join(' · ');
  };
  // Ritardo della corsa (Movimento): "+15'" in arancio.
  const ritardoDi = (g, turno, corsa) => g.ritardo?.[`${turno}|${corsa}`] || null;
  const badgeRitardo = (g, turno, corsa) => { const r = ritardoDi(g, turno, corsa); return r ? `<b class="or-rit" title="Ritardo">${esc(O.testoRitardo(r))}</b>` : ''; };
  const corsaPos = pos => pos?.a?.corsa || pos?.fino?.corsa || pos?.prossimo?.corsa || pos?.ultimo?.corsa || '';

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
    return { stato: 'naviga', da: a, a: b, xy: lungoRotta(rotta(a.scalo, b.scalo), f), i: i + 1 };
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
    // Navi vicine (stesso scalo o quasi): affiancate in acqua, prima verso il largo.
    const posti = [];
    const marker = navi.map(item => {
      const [x0, y0] = item.pos.xy;
      const scalo = MAPPA.scali[item.pos.scalo || ''];
      const largo = scalo ? Math.atan2(scalo.boa[1] - scalo.porto[1], scalo.boa[0] - scalo.porto[0]) : 0;
      const libero = ([x, y]) => !posti.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 5.6);
      const candidati = [[x0, y0]];
      [5.8, 11.6, 17.4].forEach(r => {
        for (let k = 0; k < 12; k += 1) {
          const ang = largo + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 6;
          candidati.push([x0 + Math.cos(ang) * r, y0 + Math.sin(ang) * r]);
        }
      });
      const [x, y] = candidati.find(c => libero(c) && inAcqua(c)) || candidati.find(libero) || [x0, y0];
      posti.push([x, y]);
      const ferma = item.pos.stato === 'prima' || item.pos.stato === 'fine';
      const sel = item.code === state.selected;
      return `<g class="or-ship${ferma ? ' moored' : ''}${sel ? ' selected' : ''}" data-ship="${item.code}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" tabindex="0" role="button" aria-label="${esc(item.code)}: ${esc(statoTesto(item.pos))}">` +
        `<circle r="${sel ? 3.6 : 3}" fill="${COLORI[item.code] || '#94a3b8'}"/><text y="0.9">${esc(item.code)}</text></g>`;
    }).join('');
    // Rotta del giorno della nave scelta (tratteggiata) e tratto gia' fatto (pieno).
    const scelta = navi.find(item => item.code === state.selected);
    let percorso = '';
    if (scelta) {
      const linea = punti => punti.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
      const tutto = [], fatto = [];
      scelta.punti.forEach((p, k) => {
        if (!k || p.scalo === scelta.punti[k - 1].scalo) return;
        const r = rotta(scelta.punti[k - 1].scalo, p.scalo);
        tutto.push(linea(r));
        if (p.t <= t) fatto.push(linea(r));
      });
      if (scelta.pos.stato === 'naviga') {
        const r = rotta(scelta.pos.da.scalo, scelta.pos.a.scalo);
        const f = (t - scelta.pos.da.t) / Math.max(1, scelta.pos.a.t - scelta.pos.da.t);
        fatto.push(linea(lungoRotta(r, Math.min(1, f), true)));
      }
      const colore = COLORI[scelta.code] || '#94a3b8';
      percorso = `<g class="or-path" style="--c:${colore}"><path class="todo" d="${tutto.join('')}"/><path class="done" d="${fatto.join('')}"/></g>`;
    }
    const porti = SCALI.map(nome => {
      const { porto: [x, y], lato } = MAPPA.scali[nome];
      const dy = lato[1] === '+' ? 1.6 : lato[1] === '-' ? -1.6 : 0;
      const [tx, ty, anchor] = lato[0] === 'o' ? [x - 2.4, y + 1 + dy, 'end'] : lato[0] === 'e' ? [x + 2.4, y + 1 + dy, 'start'] : lato[0] === 's' ? [x, y + 4.4, 'middle'] : [x, y - 2.6, 'middle'];
      // toccando un pontile la sezione "Allo scalo" passa a quello scalo
      return `<g class="or-port${nome === state.scalo ? ' selected' : ''}" data-port="${esc(nome)}" role="button" tabindex="0" aria-label="Navi allo scalo di ${esc(nome)}"><circle cx="${x}" cy="${y}" r="${nome === state.scalo ? 1.7 : 1.25}"/>` +
        `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(nome)}</text></g>`;
    }).join('');
    const km5 = 5 * MAPPA.km;
    const decoro = `<g class="or-north" transform="translate(4 8)"><path d="M0 -6 L2.4 1.5 L0 0 L-2.4 1.5Z"/><text y="6.2">N</text></g>` +
      `<g class="or-scale" transform="translate(-8 141)"><path d="M0 0 H${km5.toFixed(1)}"/><path d="M0 -1.2 V1.2 M${(km5 / 2).toFixed(1)} -0.8 V0.8 M${km5.toFixed(1)} -1.2 V1.2"/>` +
      `<text x="${(km5 / 2).toFixed(1)}" y="-2.2">5 km</text></g>`;
    const svg = `<svg class="or-map" viewBox="-12 -3 102 148" role="img" aria-label="Mappa del Lago di Garda con le navi">` +
      `<defs><linearGradient id="or-water" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#1d6f8c"/><stop offset="1" stop-color="#1a8aa3"/></linearGradient></defs>` +
      `${decoro}<path class="or-shore" d="${MAPPA.costa}"/><path class="or-lake" d="${MAPPA.costa}"/>${percorso}${porti}${marker}</svg>`;
    const ordinate = navi.slice().sort((a, b) => O.TURNI.indexOf(a.code) - O.TURNI.indexOf(b.code));
    const lista = ordinate.map(item => `<button type="button" class="or-ship-row${item.code === state.selected ? ' active' : ''}" data-ship="${item.code}">` +
      `${chip(item.code)}<span><b>${esc(naveInfo(g, item.code, corsaPos(item.pos)) || 'nave non indicata')}</b><small>${esc(statoTesto(item.pos))}${ritardoDi(g, item.code, corsaPos(item.pos)) ? ` · ritardo ${esc(O.testoRitardo(ritardoDi(g, item.code, corsaPos(item.pos))))}` : ''}</small></span></button>`).join('');
    const dettaglio = state.selected ? dettaglioNave(g, state.selected, t) : '';
    const side = (dettaglio || '') + alloScalo(g, t) + card('Navi', `${navi.length} in servizio · tocca una nave`, `<div class="or-ship-list">${lista || '<p class="legend">Nessuna nave in servizio in questo giorno.</p>'}</div>`);
    return { t, svg, side };
  }

  // Sezione "Allo scalo": le prossime navi che partono, passano o arrivano allo scalo (dall'ora scelta).
  // Quanto manca: "in arrivo · tra 8 min" se la nave sta gia' navigando verso lo scalo, altrimenti
  // "tra 25 min" per le navi entro un'ora (dall'ora mostrata).
  function quantoManca(g, e, t) {
    const min = e.t - t;
    if (min < 0 || min > 60) return null;
    const pos = posizione(puntiDelTurno(g.viaggi, e.v.turno), t);
    const arriva = pos?.stato === 'naviga' && pos.a.scalo === e.v.scali.find(s => s[1] === e.ora)?.[0] && pos.a.t === e.t;
    const testo = min === 0 ? 'adesso' : min === 60 ? 'tra 1 ora' : `tra ${min} min`;
    return { arriva, testo: arriva ? `in arrivo · ${testo}` : testo };
  }
  const badgeManca = m => (m ? `<em class="or-manca${m.arriva ? ' arriva' : ''}">${esc(m.testo)}</em>` : '');

  function alloScalo(g, t) {
    const KIND = { P: 'parte', A: 'arriva', S: 'passa' };
    const eventi = eventiScalo(g, state.scalo);
    const dopo = eventi.filter(e => e.t >= t);
    const prima = eventi.filter(e => e.t < t).slice(-1);
    const righe = [...prima, ...dopo.slice(0, 6)].map(e => {
      const info = naveInfo(g, e.v.turno, e.corsa);
      const manca = e.t >= t ? quantoManca(g, e, t) : null;
      // toccando la riga si apre la scheda della corsa (come dall'elenco Navi)
      return `<li class="${e.t < t ? 'past' : e === dopo[0] ? 'next' : ''}${manca?.arriva ? ' arriva' : ''}${e.v.turno === state.selected ? ' active' : ''}" data-ship="${esc(e.v.turno)}" data-from="scalo" tabindex="0" role="button" aria-label="Apri la corsa ${esc(e.corsa)} del ${esc(e.v.turno)}"><span class="or-at-ora">${esc(e.ora)}${badgeRitardo(g, e.v.turno, e.corsa)}</span>${chip(e.v.turno)}` +
        `<span><b>${KIND[e.kind]} · ${esc(e.dove)}${badgeManca(manca)}</b><small>corsa ${esc(e.corsa)}${info ? ` · ${esc(info)}` : ''}</small></span></li>`;
    }).join('');
    const vuoto = eventi.length ? 'Nessun\'altra nave in questo giorno.' : 'Nessuna nave in questo scalo nel giorno scelto.';
    return card(`Allo scalo`, dopo.length ? `${dopo.length} navi da qui in poi` : '', `${selectScalo('or-scalo-lago')}${gpsHint(state.scalo)}` +
      `${righe ? `<ol class="or-at">${righe}</ol>` : ''}${dopo.length ? '' : `<p class="legend">${vuoto}</p>`}` +
      `<button type="button" class="past-toggle" data-goto="scalo">Tabellone completo di ${esc(state.scalo)} ›</button>`, 'or-at-card');
  }

  function controlliTempo(t) {
    const min = 7 * 60, max = 20 * 60 + 30;
    const live = state.time == null && realToday();
    return `<button type="button" class="or-play" data-play aria-label="${state.playing ? 'Ferma' : 'Fai scorrere il tempo'}">${state.playing ? '❚❚' : '▶'}</button>` +
      `<input type="range" id="or-slider" min="${min}" max="${max}" step="1" value="${Math.min(max, Math.max(min, t))}" aria-label="Ora">` +
      `<b class="or-clock" id="or-clock">${hhmm(t)}</b>${live ? '<span class="or-live">ADESSO</span>' : `<button type="button" class="terra-day-today" data-now>${realToday() ? 'Adesso' : '9.00'}</button>`}`;
  }

  function renderLago() {
    posizioneGps();
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
    const c = chi(g, code, corsaPos(pos));
    const crew = g.crews[c] || [];
    const equipaggio = crew.length ? `<ul class="mt-crew">${crew.map(m => `<li style="color:${m.grado[1]}"><b>${esc(m.name)}</b><small>${esc(m.grado[0] || '')}</small></li>`).join('')}</ul>` : '';
    return card(`${code}${c !== code ? ' · BIS' : ''} ${naveDi(g, c)}`.trim(), G.comandante(crew) || '',
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

  // Partenza dalla posizione del telefono: lo scalo piu' vicino entro 3 km (una volta, finche' non
  // si sceglie a mano un altro scalo di partenza).
  function scaloVicino(lat, lon) {
    const km = ([a, b]) => {
      const r = Math.PI / 180, dLat = (a - lat) * r, dLon = (b - lon) * r;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(a * r) * Math.sin(dLon / 2) ** 2;
      return 12742 * Math.asin(Math.sqrt(h));
    };
    return SCALI.map(nome => ({ nome, km: km(MAPPA.scali[nome].geo) })).sort((a, b) => a.km - b.km)[0];
  }
  // Una sola lettura della posizione: vale per la partenza di Da -> A e per lo scalo (tabellone e
  // sezione "Allo scalo" del Lago), finche' non li si sceglie a mano.
  function posizioneGps() {
    if (state.gps || !navigator.geolocation) return;
    state.gps = { attesa: true };
    navigator.geolocation.getCurrentPosition(pos => {
      const vicino = scaloVicino(pos.coords.latitude, pos.coords.longitude);
      state.gps = vicino;
      if (vicino.km > 3) return;
      if (!state.fromScelto) {
        if (state.to === vicino.nome) state.to = state.from !== vicino.nome ? state.from : vicino.nome === 'Desenzano' ? 'Sirmione' : 'Desenzano';
        state.from = vicino.nome;
      }
      if (!state.scaloScelto) { state.scalo = vicino.nome; state.open = ''; }
      render();
    }, () => { state.gps = { errore: true }; }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60000 });
  }
  const partenzaDaGps = posizioneGps;
  // "📍 Sei a 120 m da Maderno" quando lo scalo scelto e' quello vicino
  const gpsHint = scalo => (state.gps?.nome && state.gps.km <= 3 && scalo === state.gps.nome
    ? `<p class="or-gps">📍 Sei a ${state.gps.km < 1 ? `${Math.round(state.gps.km * 1000)} m` : `${state.gps.km.toFixed(1).replace('.', ',')} km`} da ${esc(state.gps.nome)}</p>` : '');

  function renderViaggio() {
    partenzaDaGps();
    const g = giornata();
    const opzioni = sel => SCALI.map(nome => `<option${nome === sel ? ' selected' : ''}>${esc(nome)}</option>`).join('');
    const form = `<div class="or-route"><label><span>Da</span><select id="or-from">${opzioni(state.from)}</select></label>` +
      `<button type="button" class="or-swap" data-swap aria-label="Inverti">⇅</button>` +
      `<label><span>A</span><select id="or-to">${opzioni(state.to)}</select></label></div>` +
      gpsHint(state.from);
    const tutte = state.from === state.to ? [] : soluzioni(g, state.from, state.to);
    const ora = realToday() ? nowMinutes() : -1;
    const passate = tutte.filter(s => s.dep < ora);
    const visibili = state.showPast ? tutte : tutte.filter(s => s.dep >= ora);
    const toggle = passate.length ? `<button type="button" class="past-toggle" data-past>${state.showPast ? '▴ Nascondi i viaggi già partiti' : `▾ Mostra i viaggi già partiti (${passate.length})`}</button>` : '';
    const righe = visibili.map((s, i) => {
      const durata = s.arr - s.dep;
      const tratte = s.legs.map(l => `<div class="or-leg">${chip(l.v.turno)}<span><b>${hhmm(l.dep)} ${esc(l.from)} → ${hhmm(l.arr)} ${esc(l.to)}</b>` +
        `<small>corsa ${esc(l.corsa)}${badgeRitardo(g, l.v.turno, l.corsa)}${naveInfo(g, l.v.turno, l.corsa) ? ` · ${esc(naveInfo(g, l.v.turno, l.corsa))}` : ''}</small></span></div>`).join('<div class="or-change">cambio</div>');
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

  const selectScalo = id => `<label class="or-station"><span>Scalo</span><select id="${id}" data-scalo>${SCALI.map(nome => `<option${nome === state.scalo ? ' selected' : ''}>${esc(nome)}</option>`).join('')}</select></label>`;
  function renderScalo() {
    posizioneGps();
    const g = giornata();
    const select = selectScalo('or-scalo') + gpsHint(state.scalo);
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
      const info = naveInfo(g, e.v.turno, e.corsa);
      const scali = aperto ? `<ol class="mt-scali or-stops">${e.v.scali.map(([nome, orario, corsa]) =>
        `<li class="${nome === state.scalo && orario === e.ora ? 'coming' : ''}"><span>${esc(orario)}</span>${esc(nome)}<small>c. ${esc(corsa)}</small></li>`).join('')}</ol>` : '';
      return `<div class="or-board-item${aperto ? ' open' : ''}"><div class="nave${/^T[12]$/.test(e.v.turno) ? ' ferry' : ''}${e.stato === 'past' ? ' past' : ''}${e.stato === 'next' ? ' next' : ''}" data-open="${esc(e.key)}" tabindex="0" role="button" aria-expanded="${aperto}">` +
        `<span class="ora">${esc(e.ora)}${badgeRitardo(g, e.v.turno, e.corsa)}</span><span class="tipo ${e.kind}">${KIND[e.kind]}<small>corsa ${esc(e.corsa)}</small></span>${chip(e.v.turno)}` +
        `<span class="dove"><span class="ship-line"><span class="ship-name">${esc(e.dove)}</span>${ora >= 0 ? badgeManca(quantoManca(g, e, ora)) : ''}${info ? `<span class="cte">${esc(info)}</span>` : ''}</span></span></div>${scali}</div>`;
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
    const navi = giornata().navi;
    const sospese = attivi.filter(code => navi[code]?.sospesa).map(code => `${code}${navi[code].motivo ? ` (${navi[code].motivo})` : ''}`);
    const notice = [!attivi.length ? 'Nessuna corsa in orario in questo giorno.' :
      !attivi.includes('D1') ? 'In questo periodo è attivo solo il traghetto Maderno – Torri.' : '',
    sospese.length ? `⚠ Corse sospese dall'Ufficio Movimento: ${sospese.join(', ')}.` : ''].filter(Boolean).join(' · ');
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
    if (event.target.id === 'or-from') { state.from = event.target.value; state.fromScelto = true; }
    else if (event.target.id === 'or-to') state.to = event.target.value;
    else if (event.target.matches('[data-scalo]')) { state.scalo = event.target.value; state.open = ''; state.scaloScelto = true; }
    else return;
    state.showPast = false;
    render();
  });
  content.addEventListener('click', event => {
    const port = event.target.closest('[data-port]');
    if (port) {
      state.scalo = port.dataset.port; state.scaloScelto = true; state.open = '';
      render();
      if (matchMedia('(max-width: 900px)').matches) document.querySelector('.or-at-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const vai = event.target.closest('[data-goto]');
    if (vai) { state.view = vai.dataset.goto; state.showPast = false; stopPlay(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // intestazione della scheda della corsa: la richiude
    if (event.target.closest('.or-detail .terra-card-head')) { state.selected = ''; render(); return; }
    const ship = event.target.closest('[data-ship]');
    if (ship) {
      // da «Allo scalo» apre sempre la corsa; dalla mappa e dall'elenco apre o chiude
      const fromScalo = ship.dataset.from === 'scalo';
      state.selected = !fromScalo && state.selected === ship.dataset.ship ? '' : ship.dataset.ship;
      render();
      if (fromScalo && matchMedia('(max-width: 900px)').matches) document.querySelector('.or-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
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
    if (event.target.closest('[data-swap]')) { [state.from, state.to] = [state.to, state.from]; state.fromScelto = true; render(); return; }
    if (event.target.closest('[data-past]')) { state.showPast = !state.showPast; render(); return; }
    const row = event.target.closest('[data-open]');
    if (row) { state.open = state.open === row.dataset.open ? '' : row.dataset.open; render(); }
  });
  content.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-ship],[data-open],[data-port],.or-detail .terra-card-head');
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
