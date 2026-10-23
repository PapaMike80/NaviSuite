// Battaglia sul Garda: sfida del giorno su un tabellone a forma di lago (costa di orario-lago.js divisa in caselle d'acqua).
// I bersagli sono i battelli in corsa, nel punto in cui li mette l'orario a un'ora a caso della giornata (diversa a ogni partita) (in navigazione sulla
// rotta, oppure all'ormeggio davanti allo scalo): uguale per tutti i colleghi. Ogni battello e' una casella sola; si hanno
// 10 siluri in acqua (chi colpisce ritira; ogni siluro in acqua dice a quante caselle e' il battello piu' vicino) e un sonar
// da usare una volta (il raggio fa un giro e accende i battelli mentre ci passa sopra): in classifica va davanti chi ne affonda di piu', a parita' chi usa meno siluri. Si gioca quante volte si vuole: in classifica resta il miglior risultato del giorno.
(function (root) {
  'use strict';
  const MAPPA = root.NaviLagoMappa;
  const C = 3.4; // lato della casella in unita' della mappa
  const COLPI = 10; // siluri a disposizione (si contano quelli finiti in acqua)
  const GIRO_MS = 4000; // durata del giro del sonar
  const FLOTTA = [['Zanardelli', 4], ['Italia', 3], ['Brescia', 3], ['Agone', 2], ['Catullo', 2]];
  const COSTA = MAPPA.costa.slice(1, -1).split(' L').map(p => p.split(' ').map(Number));
  const LARGO = 76, ALTO = 140, COL = Math.ceil(LARGO / C), RIG = Math.ceil(ALTO / C);
  function inAcqua([x, y]) {
    let dentro = false;
    for (let i = 0, j = COSTA.length - 1; i < COSTA.length; j = i, i += 1) {
      const [xi, yi] = COSTA[i], [xj, yj] = COSTA[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }
  // Caselle d'acqua: indice = riga*COL+colonna
  const ACQUA = new Set();
  for (let r = 0; r < RIG; r++) for (let c = 0; c < COL; c++) if (inAcqua([c * C + C / 2, r * C + C / 2])) ACQUA.add(r * COL + c);
  // gli scali (pontile e boa d'attracco) non sono caselle di gioco: li' non si spara e non ci sono battelli
  const SCALI_CELLE = new Set(Object.values(MAPPA.scali).flatMap(s => [s.porto, s.boa]).map(([x, y]) => Math.floor(y / C) * COL + Math.floor(x / C)));
  SCALI_CELLE.forEach(i => ACQUA.delete(i));
  const cellaDi = ([x, y]) => Math.floor(y / C) * COL + Math.floor(x / C);
  const centro = i => [(i % COL) * C + C / 2, Math.floor(i / COL) * C + C / 2];
  const passi = [1, -1, COL, -COL];
  const vicini = i => passi.map(p => i + p).filter(j => ACQUA.has(j) && (Math.abs(p(i) - p(j)) <= 1));
  function p(i) { return i % COL; } // colonna, per non passare da un bordo all'altro
  const intorno = i => { const out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const j = i + dr * COL + dc; if (ACQUA.has(j) && Math.abs(p(j) - p(i)) <= 1) out.push(j); } return out; };

  // Nave dritta di len caselle d'acqua partendo da i nella direzione passo (o null)
  function linea(i, passo, len) {
    const celle = [i];
    for (let k = 1; k < len; k++) { const j = celle[k - 1] + passo; if (!ACQUA.has(j) || Math.abs(p(j) - p(celle[k - 1])) > 1) return null; celle.push(j); }
    return celle;
  }
  const libera = (celle, occupate) => celle.every(x => intorno(x).every(y => !occupate.has(y)));

  function piazzaCasuale(rnd = Math.random) {
    const acqua = [...ACQUA];
    for (let tentativo = 0; tentativo < 200; tentativo++) {
      const occupate = new Set(), navi = [];
      const ok = FLOTTA.every(([nome, len]) => {
        for (let k = 0; k < 400; k++) {
          const celle = linea(acqua[Math.floor(rnd() * acqua.length)], rnd() < 0.5 ? 1 : COL, len);
          if (!celle || !libera(celle, occupate)) continue;
          celle.forEach(x => occupate.add(x));
          navi.push({ nome, len, celle, colpi: new Set() });
          return true;
        }
        return false;
      });
      if (ok) return navi;
    }
    throw new Error('Flotta non piazzata');
  }

  // ---- Orario: dove sono le navi all'ora t (stesso calcolo della mappa di Scali) ----
  const POS = Object.fromEntries(Object.entries(MAPPA.scali).map(([n, s]) => [n, s.boa]));
  const minuti = ora => { const [h, m] = String(ora).split(/[.:]/).map(Number); return h * 60 + (m || 0); };
  function rotta(a, b) { const via = MAPPA.rotte[`${a}|${b}`] || (MAPPA.rotte[`${b}|${a}`] || []).slice().reverse(); return [POS[a], ...via, POS[b]]; }
  function lungoRotta(punti, f) {
    const tratti = punti.slice(1).map((q, i) => Math.hypot(q[0] - punti[i][0], q[1] - punti[i][1]));
    let resto = f * tratti.reduce((s, l) => s + l, 0);
    for (let i = 0; i < tratti.length; i++) {
      if (resto <= tratti[i] || i === tratti.length - 1) {
        const k = tratti[i] ? Math.min(1, resto / tratti[i]) : 0;
        return { xy: [punti[i][0] + (punti[i + 1][0] - punti[i][0]) * k, punti[i][1] + (punti[i + 1][1] - punti[i][1]) * k], verso: [punti[i + 1][0] - punti[i][0], punti[i + 1][1] - punti[i][1]] };
      }
      resto -= tratti[i];
    }
    return { xy: punti[punti.length - 1], verso: [0, 1] };
  }
  // Tutti i battelli del giorno all'ora t: in navigazione sulla rotta, altrimenti fermi davanti allo scalo
  // (prima della partenza, tra due corse o a fine servizio). [{ turno, da, a, xy, verso, fermo }]
  function posizioni(corse, t) {
    const perTurno = {};
    corse.forEach(c => c.scali.forEach(([scalo, ora]) => { if (POS[scalo]) (perTurno[c.turno] ||= []).push({ scalo, t: minuti(ora) }); }));
    return Object.keys(perTurno).sort().map(turno => {
      const punti = perTurno[turno].sort((x, y) => x.t - y.t);
      let i = 0; while (i < punti.length - 1 && punti[i + 1].t <= t) i++;
      const a = punti[i], b = punti[i + 1];
      if (b && t >= a.t && a.scalo !== b.scalo) return { turno, da: a.scalo, a: b.scalo, ...lungoRotta(rotta(a.scalo, b.scalo), (t - a.t) / Math.max(1, b.t - a.t)) };
      const qui = t < punti[0].t ? punti[0] : a, altro = punti.find(q => q.scalo !== qui.scalo);
      const [x, y] = POS[qui.scalo], verso = altro ? [POS[altro.scalo][0] - x, POS[altro.scalo][1] - y] : [38 - x, 0];
      return { turno, da: qui.scalo, a: qui.scalo, xy: [x, y], verso, fermo: true };
    });
  }
  const inNavigazione = (corse, t) => posizioni(corse, t).filter(n => !n.fermo);
  // Navi nemiche dalle corse: 2 caselle (3 per le motonavi delle linee lunghe), sulla rotta, senza toccarsi
  function piazzaOrario(navigazione) {
    const occupate = new Set(), navi = [];
    navigazione.forEach(n => {
      const len = 1; // ogni battello e' una casella
      const [vx, vy] = n.verso, passo = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 1 : -1) : (vy > 0 ? COL : -COL);
      let base = cellaDi(n.xy);
      if (!ACQUA.has(base)) base = [...ACQUA].sort((x, y) => Math.hypot(...centro(x).map((v, k) => v - n.xy[k])) - Math.hypot(...centro(y).map((v, k) => v - n.xy[k])))[0];
      const basi = [...ACQUA].sort((x, y) => Math.hypot(...centro(x).map((v, k) => v - centro(base)[k])) - Math.hypot(...centro(y).map((v, k) => v - centro(base)[k]))).slice(0, 40);
      for (const b0 of basi) for (const l of [len]) {
        const prove = [linea(b0, passo, l), linea(b0, -passo, l), ...passi.map(q => linea(b0, q, l))].filter(Boolean);
        const celle = prove.find(c => libera(c, occupate));
        if (celle) { celle.forEach(x => occupate.add(x)); navi.push({ nome: n.turno, tratta: n.fermo ? `ferma a ${n.da}` : `${n.da}→${n.a}`, len: celle.length, celle, colpi: new Set() }); return; }
      }
    });
    return navi;
  }

  function spara(navi, colpi, i) {
    if (colpi.has(i) || !ACQUA.has(i)) return null;
    colpi.add(i);
    const nave = navi.find(n => n.celle.includes(i));
    if (!nave) return { esito: 'acqua' };
    nave.colpi.add(i);
    return { esito: nave.colpi.size === nave.len ? 'affondata' : 'colpita', nave };
  }
  const finita = navi => navi.every(n => n.colpi.size === n.len);
  function mossaComputer(navi, colpi, rnd = Math.random) {
    const bloccate = new Set(navi.filter(n => n.colpi.size === n.len).flatMap(n => n.celle.flatMap(intorno)));
    const ok = i => !colpi.has(i) && !bloccate.has(i);
    const aperti = [...colpi].filter(i => navi.some(n => n.colpi.has(i) && n.colpi.size < n.len)).sort((a, b) => a - b);
    if (aperti.length) {
      let cand;
      if (aperti.length > 1) {
        const primo = aperti[0], ultimo = aperti[aperti.length - 1], passo = (aperti[1] - primo) % COL === 0 ? COL : 1;
        cand = [[primo - passo, primo], [ultimo + passo, ultimo]].filter(([j, da]) => ACQUA.has(j) && Math.abs(p(j) - p(da)) <= 1).map(([j]) => j);
      }
      else cand = vicini(aperti[0]);
      cand = cand.filter(ok);
      if (cand.length) return cand[Math.floor(rnd() * cand.length)];
    }
    let pool = [...ACQUA].filter(i => ok(i) && (p(i) + Math.floor(i / COL)) % 2 === 0);
    if (!pool.length) pool = [...ACQUA].filter(ok);
    if (!pool.length) pool = [...ACQUA].filter(i => !colpi.has(i));
    return pool[Math.floor(rnd() * pool.length)];
  }

  // Rotta di tutta la giornata di un turno: gli scali in ordine di orario, uniti dalle rotte in acqua della mappa
  function rottaGiornata(corse, turno) {
    const scali = corse.filter(c => c.turno === turno).flatMap(c => c.scali.map(([scalo, ora]) => ({ scalo, t: minuti(ora) })))
      .filter(x => POS[x.scalo]).sort((a, b) => a.t - b.t).map(x => x.scalo).filter((x, i, a) => x !== a[i - 1]);
    return scali.slice(1).flatMap((b, i) => { const tratto = rotta(scali[i], b); return i ? tratto.slice(1) : tratto; });
  }
  root.NaviBattagliaGarda = { rottaGiornata, C, COL, RIG, ACQUA, SCALI_CELLE, piazzaCasuale, piazzaOrario, posizioni, inNavigazione, spara, finita, mossaComputer };
  if (typeof document === 'undefined' || !document.getElementById('bg-lago')) return;

  // ---- Pagina ----
  const $ = id => document.getElementById(id);
  const O = root.NaviOrarioGiorno;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const oggi = iso(new Date());
  const profilo = (() => { try { return JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; } })();
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomeCella = i => { const [x, y] = centro(i); return `davanti a ${Object.entries(POS).sort((a, b) => Math.hypot(a[1][0] - x, a[1][1] - y) - Math.hypot(b[1][0] - x, b[1][1] - y))[0][0]}`; };
  let g, classifica = {};

  function nuova() {
    let corse = [];
    try { corse = (O?.corseDelGiorno?.(oggi) || []).filter(c => !/^T[12]$/.test(c.turno)); } catch { corse = []; } // senza traghetti: troppo facili
    // ogni partita un'ora a caso della giornata con almeno due navi in corsa (bersagli: solo le navi in corsa)
    const ore = [];
    for (let m = 5 * 60; m < 24 * 60; m += 5) if (posizioni(corse, m).filter(n => !n.fermo).length >= 2) ore.push(m);
    const t = ore.length ? ore[Math.floor(Math.random() * ore.length)] : 0, aCaso = true;
    const navi = ore.length ? piazzaOrario(posizioni(corse, t).filter(n => !n.fermo)) : [];
    const chiuso = navi.length < 2;
    // rotta della giornata di ogni nave: si disegna quando la nave viene affondata
    navi.forEach(n => { n.rotta = rottaGiornata(corse, n.nome); });
    g = { navi: chiuso ? [] : navi, chiuso, aCaso, ora: t, sonarUsato: false, giro: false, colpi: new Set(), dist: {}, ultimo: null, log: chiuso ? `Adesso ${navi.length ? 'c\'è una sola nave' : 'non ci sono navi'} in navigazione: si gioca quando almeno due navi stanno facendo una corsa.` : 'Tocca una casella d\'acqua per sparare (non sugli scali).', colore: 'var(--teal)' };
    render();
  }

  const NS = 'http://www.w3.org/2000/svg';
  const acqua = () => [...g.colpi].filter(i => !g.navi.some(n => n.celle.includes(i))).length;
  // Schermo sonar con i colori di NaviSuite: acqua blu notte, costa e cerchi azzurri, raggio verde acqua che gira;
  // siluro in acqua = «ping» grande quanto la distanza dal battello piu' vicino, con il numero; affondato = punto rosa che pulsa.
  // Con il sonar il raggio fa un giro solo e ogni battello si accende quando il raggio ci passa sopra.
  const distanza = (i, navi) => Math.min(...navi.filter(n => n.colpi.size < n.len).flatMap(n => n.celle).map(j => Math.max(Math.abs(p(i) - p(j)), Math.abs(Math.floor(i / COL) - Math.floor(j / COL)))));
  const COLORE_DIST = d => d <= 1 ? '#fb7185' : d === 2 ? '#fb923c' : d === 3 ? '#fbbf24' : d <= 5 ? '#a3e635' : '#67d7e6';
  // il raggio gira con un'animazione SVG su tutto il riquadro della mappa, sotto il lago semitrasparente
  const CX = 38, CY = 76, FERMO = !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function lago(svg, navi, colpi, mostraNavi, ultimo) {
    let h = `<defs><clipPath id="bg-clip"><path d="${MAPPA.costa}"/></clipPath>
      <linearGradient id="bg-raggio" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2dd4bf" stop-opacity="0"/><stop offset="1" stop-color="#2dd4bf" stop-opacity=".38"/></linearGradient></defs>
      <g pointer-events="none">
        ${[18, 36, 54, 72, 90].map(r => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#1f4250" stroke-width=".3"/>`).join('')}
        <line x1="${CX}" y1="0" x2="${CX}" y2="${ALTO}" stroke="#1f4250" stroke-width=".25"/><line x1="0" y1="${CY}" x2="${LARGO}" y2="${CY}" stroke="#1f4250" stroke-width=".25"/>
        <g><path d="M${CX} ${CY} L${CX + 95} ${CY - 26} A98 98 0 0 1 ${CX + 95} ${CY + 26} Z" fill="url(#bg-raggio)"/>${FERMO ? '' : `<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="360 ${CX} ${CY}" dur="4s" repeatCount="indefinite"/>`}</g>
      </g>
      <path d="${MAPPA.costa}" fill="#0b2a38" fill-opacity=".72" stroke="#67d7e6" stroke-width=".45"/>`;
    let sopra = '';
    ACQUA.forEach(i => {
      const x = p(i) * C, y = Math.floor(i / COL) * C, cx = x + C / 2, cy = y + C / 2, nave = navi.find(n => n.celle.includes(i)), colpita = colpi.has(i);
      h += `<rect data-i="${i}" x="${x}" y="${y}" width="${C}" height="${C}" fill="transparent"/><circle cx="${cx}" cy="${cy}" r=".28" fill="#2a5566" pointer-events="none"/>`;
      if (colpita && !nave) {
        const d = g.dist[i], col = Number.isFinite(d) ? COLORE_DIST(d) : '#67d7e6';
        if (Number.isFinite(d)) sopra += `<circle cx="${cx}" cy="${cy}" r="${Math.min(d, 6) * C * .55 + .8}" fill="none" stroke="${col}" stroke-width=".25" opacity=".55" pointer-events="none"/>`;
        sopra += `<text x="${cx}" y="${cy + .95}" font-size="2.7" text-anchor="middle" fill="${col}" font-weight="900" pointer-events="none">${Number.isFinite(d) ? d : '•'}</text>`;
      }
      if (colpita && nave) sopra += `<circle cx="${cx}" cy="${cy}" r="1.25" fill="#fb7185" pointer-events="none"/><circle class="sonar-pulsa" cx="${cx}" cy="${cy}" r="1.25" fill="none" stroke="#fb7185" stroke-width=".35" pointer-events="none"/>`;
      else if (mostraNavi && nave) sopra += `<circle cx="${cx}" cy="${cy}" r="1.1" fill="#2dd4bf" pointer-events="none"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="none" stroke="#2dd4bf" stroke-width=".3" pointer-events="none"/>`;
      if (i === ultimo) sopra += `<rect x="${x + .2}" y="${y + .2}" width="${C - .4}" height="${C - .4}" rx=".7" fill="none" stroke="#eaf2f4" stroke-width=".35" pointer-events="none"/>`;
    });
    // giro del sonar: ogni battello a galla si accende quando il raggio ci passa sopra
    if (g.giro) navi.filter(n => n.colpi.size < n.len).forEach(n => n.celle.forEach(i => {
      // il raggio non si ferma: il giro parte dall'angolo in cui si trovava quando si e' premuto Sonar
      const cx = p(i) * C + C / 2, cy = Math.floor(i / COL) * C + C / 2, gradi = (Math.atan2(cy - CY, cx - CX) * 180 / Math.PI + 360) % 360;
      const ritardo = ((gradi - g.giroDa + 360) % 360) / 360 * GIRO_MS - (performance.now() - g.giroT0);
      sopra += `<circle class="sonar-blip" style="animation-delay:${Math.round(ritardo)}ms" cx="${cx}" cy="${cy}" r="1.3" fill="#2dd4bf" pointer-events="none"/>`;
    }));
    // navi affondate: tutta la rotta della giornata con la sigla della corsa
    navi.filter(n => n.colpi.size === n.len && n.rotta?.length > 1).forEach((n, k) => {
      const col = ['#fb7185', '#fbbf24', '#a78bfa', '#2dd4bf', '#fb923c', '#a3e635', '#67d7e6', '#f472b6'][navi.indexOf(n) % 8];
      h += `<polyline points="${n.rotta.map(q => q.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width=".55" stroke-linejoin="round" stroke-dasharray="1.6 .8" opacity=".9" pointer-events="none"/>`;
      const i = n.celle[0], cx = p(i) * C + C / 2, cy = Math.floor(i / COL) * C + C / 2;
      const w = n.nome.length * 1.9 + 1.4, lx = cx + 1.6 + w > LARGO ? cx - 1.6 - w : cx + 1.6; // vicino al bordo: etichetta a sinistra
      sopra += `<g pointer-events="none"><rect x="${lx}" y="${cy - 2.1}" width="${w}" height="3.2" rx=".8" fill="${col}"/><text x="${lx + .7}" y="${cy + .4}" font-size="2.4" font-weight="900" fill="#06231f">${n.nome}</text></g>`;
    });
    h += sopra;
    Object.entries(MAPPA.scali).forEach(([n, s]) => {
      // il nome va dalla parte della costa; se uscirebbe dal tabellone, dall'altra parte del pontile
      const [x, y] = s.porto, largo = n.length * 1.45;
      let est = s.lato === 'e';
      if (est && x + 1.3 + largo > LARGO) est = false; else if (!est && x - 1.3 - largo < 0) est = true;
      h += `<circle cx="${x}" cy="${y}" r=".7" fill="#67d7e6" pointer-events="none"/><text x="${est ? x + 1.3 : x - 1.3}" y="${y + .9}" font-size="2.5" fill="#9fb8c2" font-weight="700" text-anchor="${est ? 'start' : 'end'}" pointer-events="none">${n}</text>`;
    });
    svg.innerHTML = h;
  }

  function renderClassifica() {
    const righe = Object.entries(classifica).map(([id, r]) => ({ id, ...r })).filter(r => Number(r.colpi) > 0).sort((a, b) => (b.affondate || 0) - (a.affondate || 0) || a.colpi - b.colpi || a.t - b.t);
    const mio = String(profilo?.id || '').replace(/[.#$\[\]\/]/g, '_');
    $('bg-classifica').innerHTML = righe.length
      ? righe.slice(0, 20).map((r, k) => `<div class="${r.id === mio ? 'io' : ''}"><span><b>${k + 1}</b> ${esc(r.nome || r.id)}</span><span>${r.affondate || 0} 🎯 · ${r.colpi} colpi</span></div>`).join('')
      : '<p>Ancora nessuno ha giocato la sfida di oggi.</p>';
  }

  function render() {
    const affondate = g.navi.filter(n => n.colpi.size === n.len).length, fine = finePartita();
    $('bg-info').innerHTML = g.chiuso ? `Oggi non ci sono navi in corsa: nessuna sfida.` : `${g.navi.length} battelli in navigazione alle <b>${hhmm(g.ora)}</b> (ora a caso, cambia a ogni partita)`;
    $('bg-punti').innerHTML = `🚀 Siluri <b>${COLPI - acqua()}</b>/${COLPI} · Affondati <b>${affondate}</b>/${g.navi.length}`;
    const t = $('bg-turno');
    t.textContent = g.chiuso ? 'Navi ferme' : fine ? (finita(g.navi) ? 'Tutti affondati!' : 'Colpi finiti') : 'Sfida del giorno';
    t.className = `turno${fine ? ' fine' : ''}`;
    lago($('bg-lago'), g.navi, g.colpi, fine, g.ultimo);
    $('bg-sonar').disabled = g.sonarUsato || !!fine; $('bg-sonar').style.opacity = g.sonarUsato || fine ? .4 : 1;
    $('bg-lago').classList.toggle('attesa', !!fine);
    $('bg-flotta').innerHTML = g.navi.map(n => {
      const nome = `<i>${n.nome}</i> ${n.colpi.size === n.len ? n.tratta : ''}`;
      return n.colpi.size === n.len ? `<div><s>${nome}</s><span>✕</span></div>` : `<div><span>${nome}</span><span></span></div>`;
    }).join('');
    $('bg-log').innerHTML = g.log; $('bg-log').style.setProperty('--c', g.colore);
    renderClassifica();
  }

  async function caricaClassifica() {
    const mio = String(profilo?.id || '').replace(/[.#$\[\]\/]/g, '_');
    try {
      await window.NaviAdminFirebase?.ready;
      const letta = await window.NaviAdminFirebase?.getClassificaGarda?.(oggi) || {};
      if (classifica[mio] && !letta[mio]) letta[mio] = classifica[mio]; // il mio appena salvato
      classifica = letta;
    } catch { /* resta quella che c'era */ }
    if (g) render();
  }
  async function salvaRisultato() {
    if (!profilo?.id) return;
    // si gioca quante volte si vuole: in classifica resta il miglior risultato di oggi (piu' battelli, poi meno colpi)
    const chiave = String(profilo.id).replace(/[.#$\[\]\/]/g, '_'), prima = classifica[chiave];
    const r = { affondate: g.navi.filter(x => x.colpi.size === x.len).length, colpi: g.colpi.size, nome: profilo.name || profilo.agente || profilo.id, t: Date.now() };
    if (prima && ((prima.affondate || 0) > r.affondate || ((prima.affondate || 0) === r.affondate && prima.colpi <= r.colpi))) { g.log += ' · in classifica resta il tuo record di oggi'; render(); return; }
    if (prima) g.log += ' · 🏅 nuovo record di oggi!';
    classifica[chiave] = r;
    try { await window.NaviAdminFirebase?.saveRisultatoGarda?.(oggi, profilo.id, r); } catch (error) { console.warn('Risultato non salvato', error); }
    caricaClassifica();
  }

  const finePartita = () => g.chiuso || (!!g.navi.length && (finita(g.navi) || acqua() >= COLPI));
  $('bg-lago').addEventListener('click', e => {
    const el = e.target.closest('[data-i]');
    if (!el || finePartita() || g.giro) return;
    const i = Number(el.dataset.i);
    const r = spara(g.navi, g.colpi, i);
    if (!r) return;
    g.ultimo = i;
    const nome = r.nave ? `la ${r.nave.nome} (${r.nave.tratta})` : '';
    if (r.esito === 'acqua') g.dist[i] = distanza(i, g.navi);
    const caldo = d => d <= 1 ? '🔥 vicinissimo!' : d === 2 ? 'molto vicino' : d === 3 ? 'vicino' : d <= 5 ? 'tiepido' : 'freddo';
    g.log = r.esito === 'acqua' ? `${nomeCella(i)}: acqua · il battello più vicino è a <b>${g.dist[i]} ${g.dist[i] === 1 ? 'casella' : 'caselle'}</b> (${caldo(g.dist[i])})` : r.esito === 'colpita' ? `${nomeCella(i)}: <b>colpita!</b>` : `💥 <b>Affondata ${nome}!</b>`;
    g.colore = r.esito === 'acqua' ? 'var(--cyan)' : r.esito === 'colpita' ? 'var(--amber)' : 'var(--rose)';
    if (finePartita()) {
      const n = g.navi.filter(x => x.colpi.size === x.len).length;
      g.log = finita(g.navi) ? `🏆 Hai affondato tutta la flotta Navigarda (${n} battelli) in <b>${g.colpi.size} siluri</b>!` : `Siluri finiti: hai affondato <b>${n} ${n === 1 ? 'battello' : 'battelli'} su ${g.navi.length}</b>.`;
      g.colore = 'var(--green)';
      salvaRisultato();
    }
    render();
  });
  // Sonar: una volta per partita il raggio fa un giro e accende i battelli mentre ci passa sopra
  $('bg-sonar').addEventListener('click', () => {
    if (g.sonarUsato || finePartita() || g.giro) return;
    // angolo del raggio adesso (l'animazione SVG gira di 360 gradi ogni 4 secondi dall'inizio della pagina)
    let t = 0; try { t = $('bg-lago').getCurrentTime() * 1000; } catch { t = 0; }
    g.sonarUsato = true; g.giro = true; g.giroDa = (t % 4000) / 4000 * 360; g.giroT0 = performance.now();
    g.log = '📡 Sonar in funzione: guarda dove si accendono i battelli…'; g.colore = 'var(--teal)';
    render();
    setTimeout(() => { g.giro = false; g.log = '📡 Giro del sonar finito: ora i siluri.'; render(); }, GIRO_MS + 700);
  });
  $('bg-nuova').addEventListener('click', () => { if (!g.colpi.size || finePartita() || confirm('Ricominciare? Questa partita non verrà salvata.')) nuova(); });
  $('bg-lago').setAttribute('viewBox', `0 0 ${LARGO} ${ALTO}`);
  nuova();
  caricaClassifica();
  setInterval(() => { if (document.visibilityState === 'visible') caricaClassifica(); }, 60000);
})(typeof window !== 'undefined' ? window : globalThis);
