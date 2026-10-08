// Orario di una giornata: corse di ogni turno con gli scali (orario-corse.js, numeri delle corse di
// course-info.js, traghetto Torri dagli orari di Maderno), periodi di validita' dell'O.d.S. 39/2026
// e "viaggi" della nave (corse consecutive dello stesso turno senza sosta lunga). Usato dalle pagine
// Il mio turno e Orario. Modulo puro: niente DOM.
(function (root) {
  'use strict';

  const minutes = t => { const [h, m] = String(t).replace(':', '.').split('.').map(Number); return h * 60 + m; };
  const hhmm = n => `${Math.floor(n / 60)}.${String(n % 60).padStart(2, '0')}`;

  // Turni con corse in orario nell'inverno 2026/27 (BIS e' a disposizione, senza corse).
  const TURNI = ['D1', 'D2', 'P1', 'P2', 'R1', 'R2', 'R3', 'M1', 'T1', 'T2', 'SR1', 'SR2'];

  // Periodi in cui vale l'orario (O.d.S. 39/2026): SR fino all'11/10 e dal 20/3, T1 tutto l'inverno
  // (non il 25/12), gli altri fino all'1/11 e dal 13/3.
  const PERIODI = {
    SR: [['2026-10-05', '2026-10-11'], ['2027-03-20', '2027-03-25']],
    T1: [['2026-10-05', '2027-03-25']],
    ALTRI: [['2026-10-05', '2026-11-01'], ['2027-03-13', '2027-03-25']]
  };
  // Turni fermati o ripresi dall'Ufficio Movimento fuori dal calendario dell'O.d.S.: {codice: {stato: 'ferma' | 'attiva', dal, al}}
  // (al vuoto = fino a nuovo ordine). Letti dalle righe dei turni nave con il campo "stagione" (vedi stagioneDaRighe).
  function stagioneDaRighe(rows) {
    const map = {};
    (Array.isArray(rows) ? rows : []).forEach(row => {
      if (!row?.stagione || row.attiva === false) return;
      const code = String(row.corsa || '').toUpperCase().replace(/\s+/g, '');
      if (!code) return;
      const dal = String(row.data || '').slice(0, 10);
      if (!map[code] || String(map[code].dal) <= dal) map[code] = { stato: row.stagione === 'attiva' ? 'attiva' : 'ferma', dal, al: String(row.stagione_al || '').slice(0, 10) };
    });
    root.NaviStagione = map;
    return map;
  }
  function inServizio(code, day) {
    const st = root.NaviStagione?.[code];
    if (st && day >= st.dal && (!st.al || day <= st.al)) return st.stato === 'attiva';
    if (code === 'T1' && day === '2026-12-25') return false;
    const periodi = /^SR/.test(code) ? PERIODI.SR : code === 'T1' ? PERIODI.T1 : PERIODI.ALTRI;
    return periodi.some(([from, to]) => day >= from && day <= to);
  }

  // Nell'orario una corsa riporta anche gli scali di passaggio della corsa che la precede (o la
  // segue) con gli stessi orari, es. c. 31 da Lazise 8.53 dopo la c. 30 Peschiera - Garda 9.25.
  // Ogni scalo resta nella corsa in cui la nave lo fa davvero.
  function senzaRipetizioni(corse) {
    for (let i = 1; i < corse.length; i += 1) {
      const a = corse[i - 1].scali, b = corse[i].scali;
      const key = s => `${s[0]}|${s[1]}`;
      const comuni = new Set(a.map(key).filter(k => b.some(s => key(s) === k)));
      if (!comuni.size) continue;
      if (comuni.has(key(b[0]))) {
        // la corsa successiva comincia da dove arriva la precedente
        const fine = a[a.length - 1];
        corse[i].scali = [fine, ...b.filter(s => !comuni.has(key(s)) && minutes(s[1]) > minutes(fine[1]))];
      } else {
        // la precedente finisce prima degli scali che fa gia' la successiva
        const resto = a.filter(s => !comuni.has(key(s)));
        if (resto.length >= 2) corse[i - 1].scali = resto;
      }
    }
    return corse;
  }

  // Ritardi dell'Ufficio Movimento per corsa: {numero: {minuti, oltre}} (oltre = piu' di 2 ore, contato
  // come 2 ore). La corsa in ritardo ha tutti gli orari spostati e il campo ritardo.
  // Il ritardo passa alle corse successive della stessa nave quanto la nave arriva dopo la loro partenza
  // (si recupera nelle soste): ritardo propagato = {minuti, oltre, propagato: true}.
  function conRitardi(corse, ritardi) {
    if (!ritardi || !Object.keys(ritardi).length) return corse;
    let arrivo = -Infinity, oltre = false;
    return corse.map(c => {
      const proprio = ritardi[c.numero];
      const partenza = minutes(c.scali[0][1]);
      const portato = Math.max(0, arrivo - partenza);
      const minuti = Math.max(proprio?.minuti || 0, portato);
      const r = !minuti ? null : proprio && proprio.minuti >= portato ? proprio : { minuti, oltre: oltre && portato >= 120, propagato: true };
      const out = r ? { ...c, ritardo: r, scali: c.scali.map(([s, t]) => [s, hhmm(minutes(t) + minuti)]) } : c;
      arrivo = minutes(out.scali[out.scali.length - 1][1]);
      oltre = !!r?.oltre;
      return out;
    });
  }
  const durata = n => (n < 60 ? `${n}'` : `${Math.floor(n / 60)}h${n % 60 ? ` ${String(n % 60).padStart(2, '0')}'` : ''}`);
  // "+15'", "+1h 05'", "oltre 2 ore"
  const testoRitardo = r => (!r ? '' : r.oltre ? 'oltre 2 ore' : `+${durata(r.minuti)}`);
  // Ritardi di tutti i turni dai turni nave del giorno (NaviServiziTerra.turniDelGiorno): {turno: {numero: r}}.
  const ritardiDelGiorno = turni => Object.fromEntries(Object.entries(turni || {}).filter(([, v]) => v?.ritardi).map(([code, v]) => [code, v.ritardi]));

  // Corse del turno con gli scali: [{numero, turno, scali: [[scalo, ora], ...]}] in ordine di orario.
  // ritardi (facoltativo): quelli del turno, {numero: {minuti, oltre}}.
  function corseDelTurno(code, day, ritardi) { return conRitardi(corseDaOrario(code, day), ritardi); }
  function corseDaOrario(code, day) {
    if (code === 'T1' || code === 'T2') {
      return (root.NaviServiziTerra?.DATA?.TRAGHETTO || []).filter(row => row[2] === code).map(([time, kind, , run]) => ({
        numero: run, turno: code,
        scali: kind === 'P' ? [['Maderno', time], ['Torri', hhmm(minutes(time) + 30)]] : [['Torri', hhmm(minutes(time) - 30)], ['Maderno', time]]
      })).sort((a, b) => minutes(a.scali[0][1]) - minutes(b.scali[0][1]));
    }
    const orario = root.NaviOrarioCorse || {};
    const trips = root.NaviCourseInfo?.info(code, day)?.trips || '';
    const numeri = [];
    trips.split('·').forEach(part => {
      const [a, b] = part.trim().split(/[–-]/).map(Number);
      if (!a) return;
      for (let n = a; n <= (b || a); n += 1) numeri.push(String(n));
    });
    const corse = numeri.filter(n => orario[n]).map(n => ({ numero: n, turno: code, scali: orario[n].map(s => [...s]) }))
      .sort((a, b) => minutes(a.scali[0][1]) - minutes(b.scali[0][1]));
    return senzaRipetizioni(corse);
  }

  // Tutte le corse in servizio nel giorno; ritardi: {turno: {numero: r}}.
  function corseDelGiorno(day, ritardi = {}) {
    return TURNI.filter(code => inServizio(code, day)).flatMap(code => corseDelTurno(code, day, ritardi[code]));
  }

  // Viaggi della nave: corse consecutive dello stesso turno unite quando la successiva parte dallo
  // scalo d'arrivo entro 15' (la nave prosegue). Scali [scalo, ora, corsa].
  function viaggiDelTurno(code, day, ritardi) { return viaggiDaCorse(code, corseDelTurno(code, day, ritardi)); }
  function viaggiDaCorse(code, corse) {
    const viaggi = [];
    corse.forEach(corsa => {
      const last = viaggi[viaggi.length - 1];
      const fine = last?.scali[last.scali.length - 1];
      const inizio = corsa.scali[0];
      if (fine && fine[0] === inizio[0] && minutes(inizio[1]) - minutes(fine[1]) <= 15) {
        last.corse.push(corsa.numero);
        last.scali.push(...corsa.scali.slice(fine[1] === inizio[1] ? 1 : 0).map(([s, t]) => [s, t, corsa.numero]));
      } else {
        viaggi.push({ turno: code, corse: [corsa.numero], scali: corsa.scali.map(([s, t]) => [s, t, corsa.numero]) });
      }
    });
    return viaggi;
  }
  const viaggiDelGiorno = (day, ritardi = {}) => TURNI.filter(code => inServizio(code, day)).flatMap(code => viaggiDelTurno(code, day, ritardi[code]));

  // BIS, il servizio di emergenza: l'Ufficio Movimento gli assegna degli incarichi del giorno
  // [{tipo: 'sostituzione' | 'aiuto', turno, dalla, alla}]: fa le corse del turno dalla corsa `dalla`
  // alla corsa `alla` compresa (vuota = fino a nuovo ordine), al posto della nave del turno
  // (sostituzione) o in piu' (aiuto, corse aggiuntive).
  function corseIncarico(incarico, day, ritardi = {}) {
    const corse = corseDelTurno(String(incarico?.turno || ''), day, ritardi[incarico?.turno]);
    const i = corse.findIndex(c => c.numero === String(incarico?.dalla || ''));
    if (i < 0) return [];
    const j = incarico.alla ? corse.findIndex(c => c.numero === String(incarico.alla)) : -1;
    return corse.slice(i, (j >= i ? j : corse.length - 1) + 1)
      .map(c => ({ ...c, turno: 'BIS', per: String(incarico.turno), tipo: incarico.tipo === 'aiuto' ? 'aiuto' : 'sostituzione' }));
  }
  // Corse del BIS nel giorno, in ordine di orario.
  const corseBis = (incarichi, day, ritardi) => (incarichi || []).flatMap(inc => corseIncarico(inc, day, ritardi))
    .sort((a, b) => minutes(a.scali[0][1]) - minutes(b.scali[0][1]));
  // Incarico di sostituzione che copre la corsa `numero` del turno (la fa il BIS), o null.
  const bisPerCorsa = (incarichi, turno, numero, day) => (incarichi || []).find(inc => inc?.tipo !== 'aiuto' && inc?.turno === turno &&
    corseIncarico(inc, day).some(c => c.numero === String(numero))) || null;
  // Viaggi del BIS in aiuto (corse aggiuntive): le sostituzioni restano nei viaggi del turno.
  const viaggiBis = (incarichi, day, ritardi) => viaggiDaCorse('BIS', corseBis((incarichi || []).filter(inc => inc?.tipo === 'aiuto'), day, ritardi));

  root.NaviOrarioGiorno = { TURNI, PERIODI, minutes, hhmm, inServizio, stagioneDaRighe, senzaRipetizioni, corseDelTurno, corseDelGiorno, viaggiDelTurno, viaggiDaCorse, viaggiDelGiorno,
    corseIncarico, corseBis, bisPerCorsa, viaggiBis, conRitardi, testoRitardo, ritardiDelGiorno };
})(typeof window !== 'undefined' ? window : globalThis);
