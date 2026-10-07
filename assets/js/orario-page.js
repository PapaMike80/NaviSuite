// Pagina "Scali" (orario.html): orario interattivo del giorno (O.d.S. 39/2026) in due viste.
// - Lago: mappa del Garda (orario-lago.js) con le navi nella posizione dell'ora scelta (adesso o con il
//   cursore del tempo) e la sezione «Allo scalo» (ex Servizi a terra): navi che partono, passano o
//   arrivano allo scalo con pontili, ormeggi, rifornimenti e bolgette, navi in linea oggi, note e agenti
//   di servizio; schede delle corse con quanto manca, aperte da sole per le navi al mio scalo.
// - Da -> A: viaggi diretti o con un cambio fra due scali, con turno e nave del giorno.
// Corse e scali da orario-giorno.js; navi, equipaggi e turni modificati come in Il mio turno.
(function () {
  'use strict';

  const O = window.NaviOrarioGiorno;
  const G = window.NaviTurniGiorno;
  const T = window.NaviServiziTerra;
  const $ = id => document.getElementById(id);
  // Incorporata in Il mio turno (window.NaviOrarioEmbed): niente intestazione, giorni, tab, GPS e URL;
  // la mostra NaviOrarioPage.show({ modo: 'terra' | 'nave', scalo, turno, day }).
  const EMBED = window.NaviOrarioEmbed === true;
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
    view: params.get('vista') === 'viaggio' ? 'viaggio' : 'lago',
    from: scaloValido(params.get('da')) || mioScalo(), to: scaloValido(params.get('a')) || '',
    scalo: scaloValido(params.get('scalo')) || mioScalo(),
    time: null, playing: null, selected: '', open: '', showPast: false, gps: null, fromScelto: false, auto: true, chiuse: new Set(), dettagli: new Set(), giornate: new Set(), scaloScelto: !!params.get('scalo'),
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
    // corse come da orario (senza ritardi): chiavi dei pontili condivise con Servizi a terra
    const programmate = {};
    [...O.corseDelGiorno(day), ...(bisAttivo ? O.corseBis(incarichi.filter(inc => inc.tipo === 'aiuto'), day) : [])]
      .forEach(c => { programmate[`${c.turno}|${c.numero}`] = c.scali; });
    return {
      day, incarichi, ritardo, programmate, bisAttivo,
      ieri: T.turniDelGiorno(turniNavi, addDays(day, -1)),
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
    // Schede aperte: la nave scelta a mano piu' quelle aperte da sole per il mio scalo (le navi in
    // arrivo o ferme li', altrimenti la prossima che ci passa). Quando una nave riparte la sua scheda si
    // chiude; una scheda chiusa a mano resta chiusa finche' non cambio scalo.
    const mia = state.embed?.modo === 'nave' ? state.embed.turno : '';
    const aperte = mia ? [mia] : [...new Set([state.selected, ...naviAlloScalo(g, t).filter(code => !state.chiuse.has(code))].filter(Boolean))];
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
      const sel = aperte.includes(item.code);
      return `<g class="or-ship${ferma ? ' moored' : ''}${sel ? ' selected' : ''}${mia && !sel ? ' dim' : ''}" data-ship="${item.code}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" tabindex="0" role="button" aria-label="${esc(item.code)}: ${esc(statoTesto(item.pos))}">` +
        `<circle r="${sel ? 3.6 : 3}" fill="${COLORI[item.code] || '#94a3b8'}"/><text y="0.9">${esc(item.code)}</text></g>`;
    }).join('');
    // Rotta del giorno della nave scelta (tratteggiata) e tratto gia' fatto (pieno).
    // Rotta del giorno delle navi con la scheda aperta (tratteggiata) e tratto gia' fatto (pieno).
    const linea = punti => punti.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    const percorso = navi.filter(item => aperte.includes(item.code)).map(scelta => {
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
      return `<g class="or-path" style="--c:${colore}"><path class="todo" d="${tutto.join('')}"/><path class="done" d="${fatto.join('')}"/></g>`;
    }).join('');
    const porti = SCALI.map(nome => {
      const { porto: [x, y], lato } = MAPPA.scali[nome];
      const dy = lato[1] === '+' ? 1.6 : lato[1] === '-' ? -1.6 : 0;
      const [tx, ty, anchor] = lato[0] === 'o' ? [x - 2.4, y + 1 + dy, 'end'] : lato[0] === 'e' ? [x + 2.4, y + 1 + dy, 'start'] : lato[0] === 's' ? [x, y + 4.4, 'middle'] : [x, y - 2.6, 'middle'];
      // toccando un pontile la sezione "Allo scalo" passa a quello scalo
      const qui = nome === state.scalo && !mia; // in Il mio turno (corsa di linea) nessuno scalo scelto
      return `<g class="or-port${qui ? ' selected' : ''}" data-port="${esc(nome)}" role="button" tabindex="0" aria-label="Navi allo scalo di ${esc(nome)}"><circle cx="${x}" cy="${y}" r="${qui ? 1.7 : 1.25}"/>` +
        `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(nome)}</text></g>`;
    }).join('');
    const km5 = 5 * MAPPA.km;
    const decoro = `<g class="or-north" transform="translate(4 8)"><path d="M0 -6 L2.4 1.5 L0 0 L-2.4 1.5Z"/><text y="6.2">N</text></g>` +
      `<g class="or-scale" transform="translate(-8 141)"><path d="M0 0 H${km5.toFixed(1)}"/><path d="M0 -1.2 V1.2 M${(km5 / 2).toFixed(1)} -0.8 V0.8 M${km5.toFixed(1)} -1.2 V1.2"/>` +
      `<text x="${(km5 / 2).toFixed(1)}" y="-2.2">5 km</text></g>`;
    const svg = `<svg class="or-map" viewBox="-12 -3 102 148" role="img" aria-label="Mappa del Lago di Garda con le navi">` +
      `<defs><linearGradient id="or-water" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#1d6f8c"/><stop offset="1" stop-color="#1a8aa3"/></linearGradient></defs>` +
      `${decoro}<path class="or-shore" d="${MAPPA.costa}"/><path class="or-lake" d="${MAPPA.costa}"/>${percorso}${porti}${marker}</svg>`;
    const dettaglio = aperte.map(code => dettaglioNave(g, code, t)).join('');
    const side = (dettaglio || '') + alloScalo(g, t, aperte, navi);
    return { t, svg, side };
  }

  // Sezione "Allo scalo": le prossime navi che partono, passano o arrivano allo scalo (dall'ora scelta).
  const traMin = min => (min === 0 ? 'adesso' : min < 60 ? `tra ${min} min` : `tra ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`);
  // Quanto manca: "in arrivo · tra 8 min" se la nave sta gia' navigando verso lo scalo, altrimenti
  // "tra 25 min" per le navi entro un'ora (dall'ora mostrata).
  function quantoManca(g, e, t) {
    const min = e.t - t;
    if (min < 0 || min > 60) return null;
    const pos = posizione(puntiDelTurno(g.viaggi, e.v.turno), t);
    const arriva = pos?.stato === 'naviga' && pos.a.scalo === e.v.scali.find(s => s[1] === e.ora)?.[0] && pos.a.t === e.t;
    const testo = traMin(min);
    return { arriva, testo: arriva ? `in arrivo · ${testo}` : testo };
  }
  const badgeManca = m => (m ? `<em class="or-manca${m.arriva ? ' arriva' : ''}">${esc(m.testo)}</em>` : '');

  // Navi per cui aprire la scheda da sole: in arrivo (navigano verso lo scalo), ferme allo scalo o
  // partite (o arrivate a fine servizio) da meno di 10 minuti; se nessuna, la prossima che ci passa.
  const DOPO_PARTENZA = 10;
  function naviAlloScalo(g, t) {
    if (!state.auto) return [];
    const recenti = new Set(eventiScalo(g, state.scalo).filter(e => e.t <= t && t < e.t + DOPO_PARTENZA).map(e => e.v.turno));
    const qui = [...new Set(g.viaggi.map(v => v.turno))].map(code => ({ code, pos: posizione(puntiDelTurno(g.viaggi, code), t) }))
      .filter(({ code, pos }) => (pos?.stato === 'naviga' && pos.a.scalo === state.scalo) || (pos?.stato === 'fermo' && pos.scalo === state.scalo) || recenti.has(code))
      .sort((a, b) => (a.pos?.a?.t ?? 0) - (b.pos?.a?.t ?? 0)).map(x => x.code);
    if (qui.length) return qui;
    const prossima = eventiScalo(g, state.scalo).find(e => e.t >= t);
    return prossima ? [prossima.v.turno] : [];
  }

  // ---------------- Allo scalo (come Servizi a terra) ----------------
  // Tutte le navi che partono, passano o arrivano allo scalo, con orario di arrivo, ormeggi del mattino
  // e della sera, R (rifornimento), B (bolgetta) e, a Desenzano, il pontile di ogni corsa (condiviso con
  // Servizi a terra); in fondo gli agenti di servizio. Passate nascoste tranne l'ultima.
  const RESIDENZA_SCALO = { Desenzano: 'DESENZANO', Maderno: 'MADERNO' };
  const D = T.DATA;
  const PONTILI = ['1', '2', '3', '4', '5', '6'];
  const PONTILI_CACHE = 'navisuite.serviziTerra.pontili';
  state.pontili = (() => { try { return JSON.parse(localStorage.getItem(PONTILI_CACHE) || '{}') || {}; } catch { return {}; } })();
  async function caricaPontili() {
    try {
      const provider = window.NaviAdminFirebase;
      if (!provider?.getPontiliCorse) return;
      await provider.ready;
      state.pontili = await provider.getPontiliCorse('DESENZANO');
      try { localStorage.setItem(PONTILI_CACHE, JSON.stringify(state.pontili)); } catch { /* niente copia locale */ }
      if (!document.activeElement?.matches?.('select')) render();
    } catch (error) { console.warn('Orario: pontili non disponibili', error); }
  }
  // Pontile di una corsa (e della partenza che la segue): tutti lo vedono.
  async function salvaPontile(keys, value) {
    const day = today();
    keys.forEach(key => { (state.pontili[key] = state.pontili[key] || {})[day] = value || '-'; });
    try { localStorage.setItem(PONTILI_CACHE, JSON.stringify(state.pontili)); } catch { /* niente copia locale */ }
    render();
    try {
      const provider = window.NaviAdminFirebase;
      if (!provider?.savePontileCorsa) throw new Error('Firebase non disponibile');
      await provider.ready;
      for (const key of keys) await provider.savePontileCorsa('DESENZANO', key, day, value || '-');
    } catch (error) {
      $('orario-notice').hidden = false;
      $('orario-notice').textContent = `Pontile salvato solo su questo dispositivo (${error.message}).`;
    }
  }
  function pontileSelect(keys, day, odsMooring, when) {
    const { value, source } = T.pontileFor(state.pontili[keys[0]], day, odsMooring);
    const options = ['', ...PONTILI];
    if (value && !options.includes(value)) options.push(value);
    const title = `Pontile${when ? ` ${when}` : ''}${source === 'ods' ? ' (dall\'O.d.S.)' : source === 'ieri' ? ' (come il giorno prima)' : ''}`;
    return `<label class="pontile-sel${value ? '' : ' empty'}${source === 'ods' ? ' ods' : ''}" title="${esc(title)}">⚓` +
      `<select data-pontile="${esc(keys.join(' '))}" aria-label="${esc(title)}">${options.map(option =>
        `<option value="${esc(option)}"${option === value ? ' selected' : ''}>${option ? esc(option) : '–'}</option>`).join('')}</select></label>`;
  }
  // Orario di una corsa allo scalo come da orario (senza ritardi), per la chiave del pontile.
  function orarioProgrammato(g, turno, corsa, scalo, ultimo) {
    const scali = (g.programmate[`${turno}|${corsa}`] || []).filter(([nome]) => nome === scalo);
    return (ultimo ? scali[scali.length - 1] : scali[0])?.[1] || '';
  }

  function agentiDiServizio(res, t) {
    const terra = state.schedule ? G.equipaggi(state.schedule, today()).terra : null;
    const who = code => {
      if (!terra) return '<span class="agenti muted">Caricamento agenti…</span>';
      const list = terra[code] || [];
      return list.length ? `<span class="agenti">👤 ${list.map(esc).join(', ')}</span>` : '<span class="agenti muted">Nessun agente di turno</span>';
    };
    const ora = realToday() || state.time != null ? t : null;
    const noti = D.SERVIZI[res].map(([code]) => code);
    const altri = terra ? (G.TERRA_RESIDENZA[res] || []).filter(code => !noti.includes(code) && terra[code]?.length)
      .map(code => `<div class="servizio">${chip(code)}<span class="ore"></span>${who(code)}</div>`).join('') : '';
    return `<div class="servizi or-servizi">${D.SERVIZI[res].map(([code, mattina, pomeriggio, nota]) => {
      let stato = '';
      if (ora != null) {
        const [a, b] = mattina.split(' – ').map(minutes), [c, d] = pomeriggio.split(' – ').map(minutes);
        if ((ora >= a && ora < b) || (ora >= c && ora < d)) stato = 'IN SERVIZIO ORA';
        else if (ora >= b && ora < c) stato = `PAUSA · RIPRENDE ALLE ${pomeriggio.split(' – ')[0]}`;
      }
      return `<div class="servizio${stato.startsWith('IN') ? ' now' : ''}">${chip(code)}<span class="ore">${mattina}<br>${pomeriggio}</span>` +
        `${who(code)}<small>${esc(nota)}</small>${stato ? `<span class="stato">${stato}</span>` : ''}</div>`;
    }).join('')}${altri}</div>`;
  }

  // Righe dello scalo: arrivo e ripartenza della stessa nave (sosta breve) in una riga sola.
  function righeScalo(g) {
    const eventi = eventiScalo(g, state.scalo);
    const usati = new Set();
    const righe = [];
    eventi.forEach(e => {
      if (usati.has(e)) return;
      if (e.kind === 'A') {
        const riparte = eventi.find(x => x.v === e.v && x.i === e.i + 1 && x.kind === 'P');
        if (riparte) { usati.add(riparte); righe.push({ ...riparte, arr: e }); return; }
      }
      righe.push(e);
    });
    // BIS a disposizione a Desenzano (pronto alle 8.30, rientro alle 18.40), oltre agli incarichi
    if (state.scalo === 'Desenzano' && g.bisAttivo) {
      D.NAVI.DESENZANO.filter(row => row[2] === 'BIS' && !row[3]).forEach(([ora, kind, , , dove]) =>
        righe.push({ v: { turno: 'BIS', scali: [] }, ora, t: minutes(ora), corsa: '', kind, dove, propria: true }));
    }
    return righe.sort((a, b) => a.t - b.t || a.v.turno.localeCompare(b.v.turno));
  }

  // Navi in linea oggi (chiuso come le note): turno, nave, comandante e dove si trova; si apre la scheda.
  function naviInLinea(g, navi, t) {
    const ordinate = navi.slice().sort((a, b) => [...O.TURNI, 'BIS'].indexOf(a.code) - [...O.TURNI, 'BIS'].indexOf(b.code));
    const righe = ordinate.map(item => {
      const r = ritardoDi(g, item.code, corsaPos(item.pos));
      return `<button type="button" class="or-ship-row" data-ship="${item.code}">${chip(item.code)}<span><b>${esc(naveInfo(g, item.code, corsaPos(item.pos)) || 'nave non indicata')}</b>` +
        `<small>${esc(statoTesto(item.pos))}${r ? ` · ritardo ${esc(O.testoRitardo(r))}` : ''}</small></span></button>`;
    }).join('');
    return `<details class="or-note" data-dettaglio="navi"${state.dettagli.has('navi') ? ' open' : ''}><summary>Navi in linea oggi (${navi.length})</summary>` +
      `<div class="or-ship-list">${righe || '<p class="legend">Nessuna nave in servizio in questo giorno.</p>'}</div></details>`;
  }

  function alloScalo(g, t, aperte = [], navi = []) {
    const KIND = { P: 'PARTENZA', A: 'ARRIVO', S: 'SCALO' };
    const res = RESIDENZA_SCALO[state.scalo] || '';
    const desenzano = state.scalo === 'Desenzano';
    const bolgette = res ? D.BOLGETTE[res] || {} : {};
    const righe = righeScalo(g);
    const day = today();
    // prima e ultima uscita di ogni nave nel giorno: ormeggio del mattino (R) e della sera
    const primo = {}, ultimo = {};
    g.viaggi.forEach(v => { const p = puntiDelTurno(g.viaggi, v.turno); primo[v.turno] = p[0]; ultimo[v.turno] = p[p.length - 1]; });
    const pastIdx = righe.map((r, i) => (r.t < t ? i : -1)).filter(i => i >= 0);
    const lastPast = pastIdx[pastIdx.length - 1];
    const nascoste = Math.max(0, pastIdx.length - 1);
    const prossima = righe.findIndex(r => r.t >= t);
    const html = righe.map((r, i) => {
      if (r.t < t && i !== lastPast && !state.showPastLago) return '';
      const code = r.v.turno;
      // BIS a disposizione: esce la mattina (8.30) e rientra la sera (18.40) da Desenzano
      const mattino = r.propria ? r.kind === 'P' : r.kind === 'P' && !r.arr && primo[code]?.scalo === state.scalo && primo[code]?.t === r.t;
      const sera = r.propria ? r.kind === 'A' : r.kind === 'A' && ultimo[code]?.scalo === state.scalo && ultimo[code]?.t === r.t;
      const nave = g.navi[code] || {};
      const badges = [];
      if (mattino && nave.rif) badges.push('<b class="rifornimento" title="Rifornimento prima della corsa" aria-label="Rifornimento">R</b>');
      const bolgetta = r.corsa && (bolgette[r.corsa] || (r.arr && bolgette[r.arr.corsa]));
      if (bolgetta) {
        const label = bolgetta.replace('BOLGETTA · ', 'Bolgetta: ').toLowerCase().replace(/^b/, 'B');
        badges.push(`<b class="bolgetta" title="${esc(label)}" aria-label="${esc(label)}">B</b>`);
      }
      const odsMooring = mattino ? (nave.ormeggioMattino || g.ieri[code]?.ormeggio) : sera ? nave.ormeggio : '';
      if (desenzano) {
        // pontile di ogni corsa, come in Servizi a terra (l'arrivo vale anche per la ripartenza)
        const key = (ev, ultimo) => T.courseKey(orarioProgrammato(g, code, ev.corsa, state.scalo, ultimo) || ev.ora, code, ev.corsa);
        const keys = r.arr ? [key(r.arr, true), key(r, false)] : [key(r, r.kind === 'A')];
        badges.push(pontileSelect(keys, day, odsMooring, mattino ? 'del mattino' : sera ? 'serale' : ''));
      } else if (odsMooring) {
        badges.push(`<b class="ormeggio" title="Ormeggio ${mattino ? 'del mattino' : 'serale'}">⚓ ${esc(T.pontLabel(odsMooring))}</b>`);
      }
      // quanto manca: all'arrivo finche' la nave non e' arrivata, poi alla partenza
      const verso = r.arr && t < r.arr.t ? r.arr : r;
      const mancaRaw = r.propria ? null : (verso.t >= t ? quantoManca(g, verso, t) : null);
      const manca = mancaRaw && verso === r && r.arr ? { ...mancaRaw, testo: mancaRaw.testo.replace('in arrivo · ', 'parte ') } : mancaRaw;
      const info = r.propria ? [naveDi(g, 'BIS'), G.comandante(g.crews.BIS)].filter(Boolean).join(' · ') : naveInfo(g, code, r.corsa);
      const cls = `nave${/^T[12]$/.test(code) ? ' ferry' : ''}${r.t < t ? ' past' : ''}${i === prossima ? ' next' : ''}${manca?.arriva ? ' arriva' : ''}${aperte.includes(code) ? ' active' : ''}`;
      const arrivo = r.arr ? `<small class="arr" title="Arrivo">arr. ${esc(r.arr.ora)}</small>` : '';
      return `<div class="${cls}"${r.propria ? '' : ` data-ship="${esc(code)}" data-from="scalo" tabindex="0" role="button" aria-label="Apri la corsa ${esc(r.corsa)} del ${esc(code)}"`}>` +
        `<span class="ora">${arrivo}${esc(r.ora)}${badgeRitardo(g, code, r.corsa)}</span>` +
        `<span class="tipo ${r.kind}">${KIND[r.kind]}<small>${r.corsa ? `corsa ${esc(r.corsa)}` : '–'}</small></span>${chip(code)}` +
        `<span class="dove"><span class="ship-line"><span class="ship-name">${esc(r.dove)}</span>${badgeManca(manca)}${info ? `<span class="cte">${esc(info)}</span>` : ''}</span>` +
        `${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}</span></div>`;
    }).join('');
    const toggle = nascoste ? `<button type="button" class="past-toggle" data-past-lago>${state.showPastLago ? '▴ Nascondi le navi già passate' : `▾ Mostra le navi già passate (${nascoste})`}</button>` : '';
    const vuoto = righe.length ? '' : '<p class="legend">Nessuna nave in questo scalo nel giorno scelto.</p>';
    const legenda = desenzano
      ? '⚓ pontile di ogni corsa: proposto dall\'O.d.S. (mattino e sera) o dalla scelta del giorno prima, si può cambiare (lo vedono tutti) · R = rifornimento · B = bolgetta'
      : '⚓ ormeggio del mattino e della sera · R = rifornimento · B = bolgetta · arr. = arrivo della nave che poi riparte';
    const note = res ? `<details class="or-note" data-dettaglio="note"${state.dettagli.has('note') ? ' open' : ''}><summary>Note di Servizi a terra</summary><ul class="note-list">${res === 'DESENZANO' ? `<li class="rif"><b>${esc(D.RIFORNIMENTI.titolo)}</b>${D.RIFORNIMENTI.righe.map(esc).join('<br>')}</li>` : ''}` +
      `${D.NOTE[res].map(([bold, text]) => `<li${bold ? ' class="bold"' : ''}>${esc(text)}</li>`).join('')}</ul><p class="validita">${esc(D.VALIDITA)}</p></details>` : '';
    return card('Allo scalo', righe.length ? `${righe.length} passaggi` : '', `${selectScalo('or-scalo-lago')}${gpsHint(state.scalo)}` +
      `${toggle}${html ? `<div class="navi-list">${html}</div>` : ''}${vuoto}<p class="legend">${esc(legenda)}</p>` +
      `${naviInLinea(g, navi, t)}${note}` +
      // agenti di servizio in fondo a tutto
      `${res ? `<p class="or-sub or-agenti-title">Agenti di servizio</p>${agentiDiServizio(res, t)}` : ''}`, 'or-at-card');
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
    if (state.embed?.modo === 'nave') {
      // Il mio turno, corsa di linea: solo la mappa con la mia nave, la sua rotta e il tratto fatto
      $('orario-content').innerHTML = card('Lago', 'la mia corsa all\'ora scelta', `<div class="or-time" id="or-time">${controlliTempo(t)}</div><div id="or-map-wrap">${svg}</div>`, 'or-mia');
      return;
    }
    $('orario-content').innerHTML = `<div class="terra-grid or-lago"><div class="terra-col">` +
      card('Lago', 'posizione delle navi all\'ora scelta', `<div class="or-time" id="or-time">${controlliTempo(t)}</div><div id="or-map-wrap">${svg}</div>`) +
      `</div><div class="terra-col" id="or-side">${side}</div></div>`;
  }
  // Durante il trascinamento del cursore: solo mappa, elenco e ora (il cursore resta).
  function aggiornaLago() {
    const { t, svg, side } = lagoParti();
    $('or-map-wrap').innerHTML = svg;
    if ($('or-side')) $('or-side').innerHTML = side;
    $('or-clock').textContent = hhmm(t);
    const live = document.querySelector('#or-time .or-live');
    if (live && state.time != null) live.outerHTML = `<button type="button" class="terra-day-today" data-now>${realToday() ? 'Adesso' : '9.00'}</button>`;
  }

  function dettaglioNave(g, code, t) {
    const punti = puntiDelTurno(g.viaggi, code);
    const pos = posizione(punti, t);
    if (!pos) return '';
    const from = pos.stato === 'naviga' ? pos.i : pos.stato === 'fermo' ? pos.i + 1 : pos.stato === 'prima' ? 0 : punti.length;
    const riga = (p, k, cls = '', conManca = true) => {
      // quanto manca (entro 2 ore); il primo scalo, se la nave naviga, e' "in arrivo"
      const min = p.t - t;
      const arriva = k === 0 && pos.stato === 'naviga';
      const manca = conManca && cls !== 'prec' && min >= 0 && min <= 120 ? badgeManca({ arriva, testo: arriva ? `in arrivo · ${traMin(min)}` : traMin(min) }) : '';
      return `<li class="${p.scalo === state.scalo ? 'qui' : ''} ${cls}"><span>${hhmm(p.t)}</span><span class="or-next-nome">${esc(p.scalo)}${manca}</span><small>c. ${esc(p.corsa)}</small></li>`;
    };
    // Se la nave passa dal mio scalo: solo il mio scalo (orario e quanto manca), con lo scalo precedente
    // in trasparenza; la freccia mostra tutti i prossimi scali.
    const resto = punti.slice(from);
    const iQui = resto.findIndex(p => p.scalo === state.scalo);
    // partita dal mio scalo da meno di 10 minuti: il mio scalo in trasparenza e il prossimo
    // (se e' ancora ferma al mio scalo non e' partita: l'ultimo punto li' e' l'arrivo)
    const ferma = pos.stato === 'fermo' && pos.scalo === state.scalo;
    const partita = ferma ? null : punti.slice(0, from).reverse().find(p => p.scalo === state.scalo && t - p.t <= DOPO_PARTENZA) || null;
    // Compatta: lo scalo gia' fatto in trasparenza e il prossimo (il mio scalo, se la nave ci passa, con lo
    // scalo dopo il mio);
    // con la freccia l'intera giornata della nave, gli scali gia' fatti in trasparenza.
    const giornata = state.giornate.has(code);
    const soloQui = iQui >= 0 || partita;
    const prec = iQui > 0 ? resto[iQui - 1] : punti[from - 1];
    // Al mio scalo: arrivo e (se la nave fa sosta) ripartenza, poi lo scalo successivo; quanto manca solo
    // sulle righe del mio scalo
    function alMioScalo() {
      let fine = iQui;
      while (resto[fine + 1]?.scalo === state.scalo) fine += 1;
      const dopo = resto[fine + 1];
      return resto.slice(iQui, fine + 1).map((p, j) => riga(p, iQui + j)).join('') + (dopo ? riga(dopo, fine + 1, '', false) : '');
    }
    const prossimi = giornata ? punti.map((p, k) => riga(p, k - from, p.t < t || k < from ? 'prec' : '')).join('')
      : partita ? riga(partita, -1, 'prec') + (resto[0] ? riga(resto[0], 0, '', false) : '')
        : iQui >= 0 ? (prec ? riga(prec, -1, 'prec') : '') + alMioScalo()
          : (punti[from - 1] ? riga(punti[from - 1], -1, 'prec') : '') + (resto[0] ? riga(resto[0], 0) : '');
    const freccia = punti.length > 2 ? `<button type="button" class="past-toggle" data-giornata="${esc(code)}">${giornata ? '▴ Meno scali' : `▾ Tutta la giornata (${punti.length} scali)`}</button>` : '';
    const c = chi(g, code, corsaPos(pos));
    const crew = g.crews[c] || [];
    const equipaggio = crew.length ? `<ul class="mt-crew">${crew.map(m => `<li style="color:${m.grado[1]}"><b>${esc(m.name)}</b><small>${esc(m.grado[0] || '')}</small></li>`).join('')}</ul>` : '';
    // Nell'intestazione quanto manca al mio scalo: "in arrivo tra 13 min", "riparte tra 8 min", "partita 3 min fa"
    let manca = '';
    if (partita) manca = `partita ${t - partita.t ? `${t - partita.t} min fa` : 'adesso'}`;
    else if (iQui >= 0 && resto[iQui].t - t <= 120) {
      const min = resto[iQui].t - t;
      manca = ferma ? `riparte ${traMin(min)}`
        : iQui === 0 && pos.stato === 'naviga' ? `in arrivo ${traMin(min)}` : `a ${state.scalo} ${traMin(min)}`;
    }
    return card(`${code}${c !== code ? ' · BIS' : ''} ${naveDi(g, c)}${manca ? ` · ${manca}` : ''}`.trim(), G.comandante(crew) || '',
      `<p class="or-status">${esc(statoTesto(pos))}</p>${prossimi ? `<p class="or-sub">${giornata ? 'Giornata della nave' : soloQui ? (partita ? `Partita da ${esc(state.scalo)} alle ${hhmm(partita.t)}` : `A ${esc(state.scalo)}`) : 'Prossimo scalo'}</p><ol class="mt-scali or-next">${prossimi}</ol>` : ''}${freccia}${equipaggio}`, 'or-detail', `data-detail="${esc(code)}"`);
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
    if (EMBED || state.gps || !navigator.geolocation) return;
    state.gps = { attesa: true };
    navigator.geolocation.getCurrentPosition(pos => {
      const vicino = scaloVicino(pos.coords.latitude, pos.coords.longitude);
      state.gps = vicino;
      if (vicino.km > 3) return;
      if (!state.fromScelto) {
        if (state.to === vicino.nome) state.to = state.from !== vicino.nome ? state.from : vicino.nome === 'Desenzano' ? 'Sirmione' : 'Desenzano';
        state.from = vicino.nome;
      }
      if (!state.scaloScelto) { state.scalo = vicino.nome; state.open = ''; nuovoScalo(); }
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
      out.push({ v, i, ora, t: minutes(ora), corsa: numero, kind, dove: kind === 'A' ? `da ${origine}` : kind === 'P' ? `per ${destinazione}` : `${origine} › ${destinazione}`, key: `${v.turno}|${numero}|${ora}` });
    }));
    return out.sort((a, b) => a.t - b.t || a.v.turno.localeCompare(b.v.turno));
  }

  // Cambiando scalo torna la scheda automatica della prossima nave che ci passa.
  function nuovoScalo() { state.auto = true; state.chiuse = new Set(); }
  const selectScalo = id => `<label class="or-station"><span>Scalo</span><select id="${id}" data-scalo>${SCALI.map(nome => `<option${nome === state.scalo ? ' selected' : ''}>${esc(nome)}</option>`).join('')}</select></label>`;
  // ---------------- Pagina ----------------
  function card(title, side, body, cls = '', attrs = '') {
    return `<section class="terra-card ${cls}" ${attrs}><div class="terra-card-head"><h2>${esc(title)}</h2>${side ? `<small>${esc(side)}</small>` : ''}</div><div class="terra-card-body">${body}</div></section>`;
  }

  function render() {
    if (EMBED && !state.embed) return;
    const day = today(), shown = parseIso(day), clock = new Date();
    if (!EMBED) {
      $('orario-day-label').textContent = `${GIORNI[shown.getDay()]} ${shown.getDate()} ${MESI[shown.getMonth()]}` +
        (realToday() ? ` · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}` : '');
      $('orario-day-input').value = day;
      $('orario-day-today').hidden = realToday();
      document.querySelectorAll('#orario-tabs [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    }
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
    if (EMBED) return;

    const url = new URL(location.href);
    url.search = '';
    if (state.day) url.searchParams.set('day', state.day);
    url.searchParams.set('vista', state.view);
    if (state.view === 'viaggio') { url.searchParams.set('da', state.from); url.searchParams.set('a', state.to); }
    if (state.scaloScelto) url.searchParams.set('scalo', state.scalo);
    history.replaceState(null, '', url);
  }

  function stopPlay() { if (state.playing) { clearInterval(state.playing); state.playing = null; } }
  const goToDay = day => { state.day = day === iso(new Date()) ? '' : day; state.time = null; state.showPast = false; state.open = ''; stopPlay(); render(); };
  if (!EMBED) $('orario-day-prev').addEventListener('click', () => goToDay(addDays(today(), -1)));
  if (!EMBED) $('orario-day-next').addEventListener('click', () => goToDay(addDays(today(), 1)));
  if (!EMBED) $('orario-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  if (!EMBED) $('orario-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });
  $('orario-tabs')?.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    state.view = button.dataset.view; state.showPast = false; stopPlay(); render();
  });

  const content = $('orario-content');
  // riquadri richiudibili (navi in linea, note): restano come li ho lasciati quando la pagina si ridisegna
  content.addEventListener('toggle', event => {
    const key = event.target?.dataset?.dettaglio;
    if (key) { if (event.target.open) state.dettagli.add(key); else state.dettagli.delete(key); }
  }, true);
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
    else if (event.target.matches('[data-pontile]')) { salvaPontile(event.target.dataset.pontile.split(' '), event.target.value); return; }
    else if (event.target.matches('[data-scalo]')) { state.scalo = event.target.value; state.open = ''; state.scaloScelto = true; nuovoScalo(); }
    else return;
    state.showPast = false;
    render();
  });
  content.addEventListener('click', event => {
    const port = event.target.closest('[data-port]');
    if (port) {
      state.scalo = port.dataset.port; state.scaloScelto = true; state.open = ''; nuovoScalo();
      render();
      if (matchMedia('(max-width: 900px)').matches) document.querySelector('.or-at-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (event.target.closest('.pontile-sel')) return;
    if (event.target.closest('[data-past-lago]')) { state.showPastLago = !state.showPastLago; render(); return; }
    // intestazione della scheda della corsa: la richiude
    const chiudi = event.target.closest('.or-detail .terra-card-head');
    if (chiudi) {
      const code = chiudi.closest('[data-detail]')?.dataset.detail || '';
      if (state.selected === code) state.selected = '';
      state.chiuse.add(code);
      render();
      return;
    }
    const giornata = event.target.closest('[data-giornata]');
    if (giornata) { const code = giornata.dataset.giornata; if (state.giornate.has(code)) state.giornate.delete(code); else state.giornate.add(code); render(); return; }
    const ship = event.target.closest('[data-ship]');
    if (ship && state.embed?.modo === 'nave') return;
    if (ship) {
      // da «Allo scalo» apre sempre la corsa; dalla mappa e dall'elenco apre o chiude
      const fromScalo = ship.dataset.from === 'scalo';
      const code = ship.dataset.ship;
      if (!fromScalo && document.querySelector(`.or-detail[data-detail="${code}"]`)) {
        // gia' aperta: dalla mappa e dall'elenco la richiude
        if (state.selected === code) state.selected = '';
        state.chiuse.add(code);
      } else {
        state.selected = code;
        state.chiuse.delete(code);
      }
      render();
      if (fromScalo && matchMedia('(max-width: 900px)').matches) document.querySelector(`.or-detail[data-detail="${ship.dataset.ship}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  if (EMBED) {
    window.NaviOrarioPage = {
      show({ modo = 'terra', scalo = 'Desenzano', turno = '', day = '' } = {}) {
        const giorno = day && day !== iso(new Date()) ? day : '';
        const cambia = !state.embed || state.embed.modo !== modo || state.embed.turno !== turno || state.day !== giorno || (modo === 'terra' && state.scalo !== scalo && !state.scaloScelto);
        // mentre si sceglie un pontile o si usa il cursore non si ridisegna
        if (!cambia && (document.activeElement?.closest?.('#orario-content select') || state.playing)) return;
        state.embed = { modo, turno };
        state.view = 'lago';
        if (cambia) {
          state.day = giorno; state.time = null; stopPlay();
          state.scalo = SCALI.includes(scalo) ? scalo : 'Desenzano';
          state.selected = ''; state.chiuse = new Set(); state.auto = modo === 'terra';
        }
        render();
      },
      hide() { state.embed = null; stopPlay(); $('orario-content').innerHTML = ''; $('orario-notice').hidden = true; }
    };
  }
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
  // pontili di Desenzano scelti dai colleghi (Servizi a terra e qui): riletti ogni minuto
  caricaPontili();
  setInterval(caricaPontili, 60000);
  // Adesso: posizioni e tabellone aggiornati ogni minuto (non mentre si usa il cursore).
  setInterval(() => { if (state.time == null && !state.playing && !document.activeElement?.matches?.('select')) render(); }, 60000);
})();
