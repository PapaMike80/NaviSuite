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
      corse = Object.entries(root.NaviOrarioCorseEstate || {}).map(([numero, scali]) => ({ numero, sr: SR_ESTATE.has(numero), scali }));
      corse.push(...TRAGHETTO_ESTATE.map(([numero, t, da, a]) => ({ numero: String(numero), sr: false, traghetto: true, scali: [[da, t], [a, hhmm(minuti(t) + 30)]] })));
    } else {
      const O = root.NaviOrarioGiorno;
      if (s.fonte === 'inverno') corse = O.corseDelGiorno(day).filter(c => !/^T/.test(c.turno)).map(c => ({ numero: c.numero, sr: /^SR/.test(c.turno), scali: c.scali }));
      (root.NaviServiziTerra?.DATA?.TRAGHETTO || []).filter(r => O.inServizio(r[2], day)).forEach(([t, k, , numero]) => {
        corse.push({ numero, sr: false, traghetto: true, scali: k === 'P' ? [['Maderno', t], ['Torri', hhmm(minuti(t) + 30)]] : [['Torri', hhmm(minuti(t) - 30)], ['Maderno', t]] });
      });
    }
    return corse.map(c => {
      const i = c.scali.findIndex(x => x[0] === scalo);
      if (i < 0 || i === c.scali.length - 1) return null;
      return { ora: c.scali[i][1], numero: c.numero, sr: c.sr, traghetto: !!c.traghetto, dest: c.scali.slice(i + 1) };
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
    if (s.fonte === 'estate') corse = Object.entries(root.NaviOrarioCorseEstate || {}).map(([numero, scali]) => ({ numero, sr: SR_ESTATE.has(numero), scali }));
    else corse = root.NaviOrarioGiorno.corseDelGiorno(day).filter(c => !/^T/.test(c.turno)).map(c => ({ numero: c.numero, sr: /^SR/.test(c.turno), scali: c.scali }));
    const fatte = [['Desenzano – Peschiera – Riva', c => Number(c.numero) % 2 === 0], ['Riva – Peschiera – Desenzano', c => Number(c.numero) % 2 === 1]].map(([titolo, verso]) => {
      const lista = corse.filter(verso).sort((a, b) => minuti(a.scali[0][1]) - minuti(b.scali[0][1]));
      // righe nell'ordine dell'orario ufficiale (scali senza corse tolti)
      const usati = new Set(lista.flatMap(c => c.scali.map(x => x[0])));
      const scaliTab = (titolo.startsWith('Desenzano') ? RIGHE_ANDATA : RIGHE_RITORNO).filter(n => usati.has(n));
      return { titolo, corse: lista.map(c => ({ numero: c.numero, sr: c.sr, ore: Object.fromEntries(c.scali.map(([n, t]) => [n, t])) })), scali: scaliTab };
    }).filter(t => t.corse.length);
    return fatte;
  }
  // Traghetto Maderno - Torri della stagione: [{numero, da, a, parte, arriva}]
  function traghetto(day) {
    const s = stagioneDel(day);
    if (!s) return [];
    const righe = s.fonte === 'estate'
      ? TRAGHETTO_ESTATE.map(([numero, t, da, a]) => ({ numero: String(numero), da, a, parte: t, arriva: hhmm(minuti(t) + 30) }))
      : (root.NaviServiziTerra?.DATA?.TRAGHETTO || []).filter(r => root.NaviOrarioGiorno.inServizio(r[2], day)).map(([t, k, , numero]) => k === 'P'
        ? { numero, da: 'Maderno', a: 'Torri', parte: t, arriva: hhmm(minuti(t) + 30) } : { numero, da: 'Torri', a: 'Maderno', parte: hhmm(minuti(t) - 30), arriva: t });
    return righe.sort((a, b) => minuti(a.parte) - minuti(b.parte));
  }
  root.NaviOrariStagioni = { STAGIONI, stagioneDel, partenze, scali, tabelle, traghetto, minuti };
})(typeof window !== 'undefined' ? window : globalThis);
