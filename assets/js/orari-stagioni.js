// Orari per stagione (pagina Orari): ogni stagione ha i suoi periodi, il suo O.d.S. e le sue corse.
// - Estate: O.d.S. 16/2026 (orario-corse-estate.js), tutte le corse giornaliere.
// - Autunno e Primavera: O.d.S. 39/2026 (orario-corse.js); turni e SR valgono come in orario-giorno.js.
// - Inverno: solo il traghetto Maderno - Torri (T1).
// Il traghetto non e' nelle tabelle dell'orario: qui per l'estate (pag. 23), per gli altri periodi da servizi-terra-a4.js.
(function (root) {
  'use strict';
  const minuti = t => { const [h, m] = String(t).replace(':', '.').split('.').map(Number); return h * 60 + m; };
  const hhmm = n => `${Math.floor(n / 60)}.${String(n % 60).padStart(2, '0')}`;

  // Traghetto estivo Maderno - Torri: [corsa, partenza, arrivo, da, a]
  const TRAGHETTO_ESTATE = [
    ...[[201, '8.00'], [231, '8.35'], [203, '9.10'], [233, '9.45'], [205, '10.25'], [235, '11.05'], [207, '11.45'], [237, '12.25'], [209, '14.00'],
      [239, '14.40'], [211, '15.20'], [241, '16.00'], [213, '16.40'], [243, '17.20'], [215, '18.00'], [245, '18.40'], [217, '19.15']].map(([c, t]) => [c, t, 'Maderno', 'Torri']),
    ...[[202, '8.35'], [232, '9.10'], [204, '9.45'], [234, '10.25'], [206, '11.05'], [236, '11.45'], [208, '12.25'], [238, '14.00'], [210, '14.40'],
      [240, '15.20'], [212, '16.00'], [242, '16.40'], [214, '17.20'], [244, '18.00'], [216, '18.40'], [246, '19.15'], [218, '19.50']].map(([c, t]) => [c, t, 'Torri', 'Maderno'])
  ];
  // Corse con supplemento (SR, aliscafo e catamarani) dalla riga "Note" dell'orario estivo
  const SR_ESTATE = new Set(['110', '111', '112', '113', '114', '151', '155', '156', '160', '161', '162', '163']);

  // Colori dei turni come nella pagina Oggi
  const COLORI = { D1: '#58d8c5', D2: '#44b8f1', D3: '#b78cff', D4: '#f1a960', BIS: '#f1ce62', T1: '#75d992', T2: '#b0df64', M1: '#48c7ba', R1: '#e988b2', R2: '#efac73',
    R3: '#d782ef', R4: '#e67e7e', CAR: '#80b5ff', P1: '#80b5ff', P2: '#82d8ea', P3: '#71cdae', CAP: '#b8a2ff', SR1: '#e6cc75', SR2: '#f0b36b' };
  // turno di una corsa estiva dall'elenco dell'O.d.S. 16/2026 (course-info.js, COURSE_TRIPS)
  let turnoEstate = null;
  function turnoDiEstate(numero) {
    if (!turnoEstate) {
      turnoEstate = {};
      Object.entries(root.NaviCourseInfo?.COURSE_TRIPS || {}).forEach(([code, trips]) => String(trips).split('·').forEach(part => {
        const [a, b] = part.trim().split(/[–-]/).map(Number);
        for (let n = a; n && n <= (b || a); n += 1) turnoEstate[String(n)] = code;
      }));
    }
    return turnoEstate[String(numero)] || '';
  }
  const STAGIONI = [
    { id: 'primavera', nome: 'Primavera', icona: '🌱', colore: '#52c879', periodi: [['2027-03-13', '2027-03-25']], ods: 'O.d.S. 39/2026', fonte: 'inverno',
      nota: 'Stesso orario dell’autunno; le corse SR tornano dal 20 marzo.' },
    { id: 'estate', nome: 'Estate', icona: '☀️', colore: '#fbbf24', periodi: [['2026-05-16', '2026-10-04']], ods: 'O.d.S. 16/2026', fonte: 'estate',
      nota: 'Tutte le corse sono giornaliere.' },
    { id: 'autunno', nome: 'Autunno', icona: '🍂', colore: '#fb923c', periodi: [['2026-10-05', '2026-11-01']], ods: 'O.d.S. 39/2026', fonte: 'inverno',
      nota: 'Le corse SR sono giornaliere fino all’11 ottobre.' },
    { id: 'inverno', nome: 'Inverno', icona: '❄️', colore: '#67d7e6', periodi: [['2026-11-02', '2027-03-12']], ods: 'O.d.S. 39/2026', fonte: 'traghetto',
      nota: 'In linea solo il traghetto Maderno – Torri (non il 25 dicembre).' }
  ];
  const stagioneDel = day => STAGIONI.find(s => s.periodi.some(([a, b]) => day >= a && day <= b)) || null;

  // Partenze dallo scalo nel giorno: [{ora, numero, sr, dest: [[scalo, ora], ...]}]
  function partenze(scalo, day) {
    const s = stagioneDel(day);
    if (!s) return [];
    let corse = [];
    if (s.fonte === 'estate') {
      corse = Object.entries(root.NaviOrarioCorseEstate || {}).map(([numero, scali]) => ({ numero, turno: turnoDiEstate(numero), sr: SR_ESTATE.has(numero), scali }));
      corse.push(...TRAGHETTO_ESTATE.map(([numero, t, da, a]) => ({ numero: String(numero), turno: turnoDiEstate(numero), sr: false, traghetto: true, scali: [[da, t], [a, hhmm(minuti(t) + 30)]] })));
    } else {
      const O = root.NaviOrarioGiorno;
      if (s.fonte === 'inverno') corse = O.corseDelGiorno(day).filter(c => !/^T/.test(c.turno)).map(c => ({ numero: c.numero, turno: c.turno, sr: /^SR/.test(c.turno), scali: c.scali }));
      (root.NaviServiziTerra?.DATA?.TRAGHETTO || []).filter(r => O.inServizio(r[2], day)).forEach(([t, k, turno, numero]) => {
        corse.push({ numero, turno, sr: false, traghetto: true, scali: k === 'P' ? [['Maderno', t], ['Torri', hhmm(minuti(t) + 30)]] : [['Torri', hhmm(minuti(t) - 30)], ['Maderno', t]] });
      });
    }
    return corse.map(c => {
      const i = c.scali.findIndex(x => x[0] === scalo);
      if (i < 0 || i === c.scali.length - 1) return null;
      return { ora: c.scali[i][1], numero: c.numero, turno: c.turno || '', colore: COLORI[c.turno] || '#9fb8c2', sr: c.sr, traghetto: !!c.traghetto, dest: c.scali.slice(i + 1) };
    }).filter(Boolean).sort((a, b) => minuti(a.ora) - minuti(b.ora));
  }
  // Scali dell'orario della stagione, da Desenzano a Riva
  const ORDINE = ['Desenzano', 'Padenghe', 'Moniga', 'Manerba', 'San Felice', 'Portese', 'Salò', 'Gardone', 'Maderno', 'Bogliaco', 'Gargnano', 'Tignale', 'Limone',
    'Riva', 'Torbole', 'Malcesine', 'Cassone', 'Assenza', 'Castelletto', 'Brenzone', 'Torri', 'Punta San Vigilio', 'Garda', 'Bardolino', 'Cisano', 'Lazise', 'Peschiera', 'Sirmione', 'Campione'];
  function scali(day) {
    const s = stagioneDel(day);
    const set = new Set();
    if (s?.fonte === 'estate') Object.values(root.NaviOrarioCorseEstate || {}).forEach(c => c.forEach(x => set.add(x[0])));
    else Object.values(root.NaviOrarioCorse || {}).forEach(c => c.forEach(x => set.add(x[0])));
    set.add('Maderno'); set.add('Torri');
    return [...set].sort((a, b) => (ORDINE.indexOf(a) + 99) % 99 - (ORDINE.indexOf(b) + 99) % 99 || a.localeCompare(b, 'it'));
  }
  // Orario ufficiale della stagione come nell'O.d.S.: due tabelle (verso Riva: corse pari; verso Desenzano/Peschiera:
  // dispari) con una colonna per corsa e una riga per scalo. Corse del giorno scelto (SR solo nei giorni in cui ci sono).
  const RIGHE_ANDATA = ['Desenzano', 'Peschiera', 'Sirmione', 'Padenghe', 'Moniga', 'Lazise', 'Manerba', 'Cisano', 'Bardolino', 'Garda', 'Torri',
    'Portese', 'Salò', 'Gardone', 'Maderno', 'Bogliaco', 'Gargnano', 'Tignale', 'Castelletto', 'Brenzone', 'Assenza', 'Campione', 'Malcesine', 'Limone', 'Torbole', 'Riva'];
  const RIGHE_RITORNO = ['Riva', 'Torbole', 'Limone', 'Malcesine', 'Assenza', 'Brenzone', 'Castelletto', 'Campione', 'Tignale', 'Gargnano', 'Bogliaco', 'Maderno',
    'Gardone', 'Salò', 'Portese', 'Torri', 'Garda', 'Bardolino', 'Cisano', 'Manerba', 'Lazise', 'Moniga', 'Padenghe', 'Sirmione', 'Peschiera', 'Desenzano'];
  function tabelle(day) {
    const s = stagioneDel(day);
    if (!s || s.fonte === 'traghetto') return [];
    let corse;
    if (s.fonte === 'estate') corse = Object.entries(root.NaviOrarioCorseEstate || {}).map(([numero, scali]) => ({ numero, turno: turnoDiEstate(numero), sr: SR_ESTATE.has(numero), scali }));
    else corse = root.NaviOrarioGiorno.corseDelGiorno(day).filter(c => !/^T/.test(c.turno)).map(c => ({ numero: c.numero, turno: c.turno, sr: /^SR/.test(c.turno), scali: c.scali }));
    const fatte = [['Desenzano – Peschiera – Riva', c => Number(c.numero) % 2 === 0], ['Riva – Peschiera – Desenzano', c => Number(c.numero) % 2 === 1]].map(([titolo, verso]) => {
      const lista = corse.filter(verso).sort((a, b) => minuti(a.scali[0][1]) - minuti(b.scali[0][1]));
      // righe nell'ordine dell'orario ufficiale (scali senza corse tolti)
      const usati = new Set(lista.flatMap(c => c.scali.map(x => x[0])));
      const scaliTab = (titolo.startsWith('Desenzano') ? RIGHE_ANDATA : RIGHE_RITORNO).filter(n => usati.has(n));
      return { titolo, corse: lista.map(c => ({ numero: c.numero, turno: c.turno, colore: COLORI[c.turno] || '#9fb8c2', sr: c.sr, ore: Object.fromEntries(c.scali.map(([n, t]) => [n, t])) })), scali: scaliTab };
    }).filter(t => t.corse.length);
    return fatte;
  }
  // Traghetto Maderno - Torri della stagione: [{numero, da, a, parte, arriva}]
  function traghetto(day) {
    const s = stagioneDel(day);
    if (!s) return [];
    const righe = s.fonte === 'estate'
      ? TRAGHETTO_ESTATE.map(([numero, t, da, a]) => ({ numero: String(numero), turno: turnoDiEstate(numero), da, a, parte: t, arriva: hhmm(minuti(t) + 30) }))
      : (root.NaviServiziTerra?.DATA?.TRAGHETTO || []).filter(r => root.NaviOrarioGiorno.inServizio(r[2], day)).map(r => [r, ...r]).map(([r, t, k, , numero]) => k === 'P'
        ? { numero, turno: r[2], da: 'Maderno', a: 'Torri', parte: t, arriva: hhmm(minuti(t) + 30) } : { numero, turno: r[2], da: 'Torri', a: 'Maderno', parte: hhmm(minuti(t) - 30), arriva: t });
    return righe.sort((a, b) => minuti(a.parte) - minuti(b.parte));
  }
  // Tutte le corse del giorno (linea e traghetto) con turno e scali: [{numero, turno, sr, punti: [[scalo, ora], ...]}]
  function corseTutte(day) {
    const out = [];
    tabelle(day).forEach(t => t.corse.forEach(c => out.push({ numero: String(c.numero), turno: c.turno || '', sr: c.sr, punti: t.scali.filter(n => c.ore[n]).map(n => [n, c.ore[n]]) })));
    traghetto(day).forEach(r => out.push({ numero: String(r.numero), turno: r.turno || '', sr: false, punti: [[r.da, r.parte], [r.a, r.arriva]] }));
    return out;
  }
  // Coincidenze del giorno: allo stesso scalo la corsa a arriva e la b riparte entro max minuti
  // (non per tornare allo scalo da cui arriva a, non con la stessa nave). Usate dall'orario grafico (Orari) e da Il mio turno.
  const cacheCoinc = {};
  function coincidenze(day, max = 20) {
    const k = `${day}|${max}`;
    if (cacheCoinc[k]) return cacheCoinc[k];
    const corse = corseTutte(day), out = [];
    corse.forEach(a => a.punti.forEach(([sc, ta], pa) => {
      if (pa === 0) return;
      const da = a.punti[pa - 1][0], arr = minuti(ta);
      corse.forEach(b => {
        if (b.numero === a.numero || (a.turno && a.turno === b.turno)) return; // stessa nave: non e' un cambio
        const pb = b.punti.findIndex(p => p[0] === sc);
        if (pb < 0 || pb === b.punti.length - 1) return;
        const dop = minuti(b.punti[pb][1]) - arr;
        if (dop < 0 || dop > max || b.punti[pb + 1][0] === da) return;
        out.push({ a: a.numero, b: b.numero, turnoA: a.turno, turnoB: b.turno, srA: a.sr, srB: b.sr, scalo: sc, arriva: ta, parte: b.punti[pb][1], attesa: dop,
          da: a.punti[0][0], verso: b.punti[b.punti.length - 1][0] });
      });
    }));
    return (cacheCoinc[k] = out);
  }
  root.NaviOrariStagioni = { STAGIONI, COLORI, corseTutte, coincidenze, RIGHE_ANDATA, stagioneDel, partenze, scali, tabelle, traghetto, minuti };
})(typeof window !== 'undefined' ? window : globalThis);
