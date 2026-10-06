// Pagina "Il mio turno": la giornata dell'agente collegato. Scheda Turno con ore del servizio,
// inizio e fine ed equipaggio. Su una nave: corse con
// gli scali (le gia' fatte nascoste), ormeggio del mattino con la R del rifornimento sulla prima
// corsa e della sera sull'ultima, B sugli scali della bolgetta. A terra: Servizi a terra
// incorporata. Si scorre per giorni come Oggi; "Prova turno" mostra un altro turno (solo prova).
(function () {
  'use strict';

  const G = window.NaviTurniGiorno;
  const T = window.NaviServiziTerra;
  const C = window.NaviShiftCompetence;
  const ORARIO = window.NaviOrarioCorse || {};
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const minutes = t => { const [h, m] = String(t).replace(':', '.').split('.').map(Number); return h * 60 + m; };
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const chip = code => `<span class="chip" data-code="${esc(code)}">${esc(code)}</span>`;
  const pontLabel = value => String(value || '').replace(/^pontile\s+/i, '');
  const ora = value => String(value || '–').replace(':', '.').replace(/^0(\d)/, '$1');
  const oreMinuti = hours => { const total = Math.round((Number(hours) || 0) * 60); return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`; };

  // Turni selezionabili per le prove.
  const TURNI_PROVA = [
    ['Desenzano', ['D1', 'D2', 'BIS', 'AgB', 'PonD']],
    ['Maderno', ['T1', 'T2', 'M1', 'AgM', 'AgT']],
    ['Riva', ['R1', 'R2', 'R3']],
    ['Peschiera', ['P1', 'P2', 'SR1', 'SR2']],
    ['Altro', ['RIP']]
  ];

  // Periodi in cui vale l'orario (O.d.S. 39/2026): SR fino all'11/10 e dal 20/3, T1 tutto l'inverno.
  const PERIODI = {
    SR: [['2026-10-05', '2026-10-11'], ['2027-03-20', '2027-03-25']],
    T1: [['2026-10-05', '2027-03-25']],
    ALTRI: [['2026-10-05', '2026-11-01'], ['2027-03-13', '2027-03-25']]
  };
  function inServizio(code, day) {
    if (code === 'T1' && day === '2026-12-25') return false;
    const periodi = /^SR/.test(code) ? PERIODI.SR : code === 'T1' ? PERIODI.T1 : PERIODI.ALTRI;
    return periodi.some(([from, to]) => day >= from && day <= to);
  }

  function profile() {
    try { return JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; }
  }

  const params = new URLSearchParams(location.search);
  const state = { day: '', schedule: null, firebaseNavi: [], showPast: false, test: String(params.get('turno') || '') };
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') && params.get('day') !== iso(new Date())) state.day = params.get('day');
  const today = () => state.day || iso(new Date());

  // Corse del turno con gli scali: dalla tabella dell'orario o, per il traghetto, da Maderno (+/- 30').
  function corseDelTurno(code, day) {
    if (code === 'T1' || code === 'T2') {
      const hhmm = n => `${Math.floor(n / 60)}.${String(n % 60).padStart(2, '0')}`;
      return (T.DATA.TRAGHETTO || []).filter(row => row[2] === code).map(([time, kind, , run]) => ({
        numero: run,
        scali: kind === 'P' ? [['Maderno', time], ['Torri', hhmm(minutes(time) + 30)]] : [['Torri', hhmm(minutes(time) - 30)], ['Maderno', time]]
      })).sort((a, b) => minutes(a.scali[0][1]) - minutes(b.scali[0][1]));
    }
    const trips = window.NaviCourseInfo?.info(code, day)?.trips || '';
    const numeri = [];
    trips.split('·').forEach(part => {
      const [a, b] = part.trim().split(/[–-]/).map(Number);
      if (!a) return;
      for (let n = a; n <= (b || a); n += 1) numeri.push(String(n));
    });
    const corse = numeri.filter(n => ORARIO[n]).map(n => ({ numero: n, scali: ORARIO[n].map(s => [...s]) }))
      .sort((a, b) => minutes(a.scali[0][1]) - minutes(b.scali[0][1]));
    return senzaRipetizioni(corse);
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

  function card(title, side, body, cls = '') {
    return `<section class="terra-card ${cls}"><div class="terra-card-head"><h2>${esc(title)}</h2>${side ? `<small>${esc(side)}</small>` : ''}</div><div class="terra-card-body">${body}</div></section>`;
  }

  // Bolgette (O.d.S. 39/2026): scali in cui la corsa carica o consegna la bolgetta.
  // Maderno e Riva <-> Direzione con la R1 (c. 7 e 8); Cantiere Peschiera con le c. 30-31 e 38-39.
  const BOLGETTE = {
    7: { Riva: 'carica', Maderno: 'carica', Desenzano: 'consegna' },
    8: { Desenzano: 'carica', Maderno: 'consegna', Riva: 'consegna' },
    30: { Peschiera: 'carica' }, 31: { Desenzano: 'consegna' },
    38: { Desenzano: 'carica' }, 39: { Peschiera: 'consegna' }
  };

  // Scheda Turno: ore del servizio, inizio e fine e sotto l'equipaggio.
  function turnoCard(code, day, { inizio = '', fine = '', crewHtml = '' } = {}) {
    const comp = C?.shiftForCode(code === 'RIP' ? 'Riposo' : code, day) || {};
    const lavoro = code !== 'RIP' && Number(comp.hours) > 0;
    const head = `<div class="mt-turno">${chip(code === 'RIP' ? 'Riposo' : code)}` +
      `${lavoro ? `<b class="mt-ore">${oreMinuti(comp.hours)}</b>` : ''}` +
      `${inizio ? `<span>Inizio <b>${esc(ora(inizio))}</b></span>` : ''}${fine ? `<span>Fine <b>${esc(ora(fine))}</b></span>` : ''}</div>`;
    return card('Turno', '', head + crewHtml);
  }

  function renderNave(code, day, me) {
    const turniNavi = [...(state.schedule?.turni_navi || []), ...state.firebaseNavi];
    const oggi = T.turniDelGiorno(turniNavi, day)[code] || {};
    const ieri = T.turniDelGiorno(turniNavi, addDays(day, -1))[code] || {};
    const crew = G.equipaggi(state.schedule, day).navi[code] || [];
    const info = window.NaviCourseInfo?.info(code, day, { refuel: !!oggi.rif }) || {};
    const corse = corseDelTurno(code, day);
    const realToday = day === iso(new Date());
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();

    $('turno-title').innerHTML = `${chip(code)} ${esc(oggi.nave || 'Nave non indicata')}`;
    $('turno-context').textContent = [G.comandante(crew), info.trips ? `corse ${info.trips}` : ''].filter(Boolean).join(' · ');


    const equipaggio = crew.length
      ? `<ul class="mt-crew">${crew.map(member => `<li class="${member.id && member.id === String(me?.id || '') ? 'me' : ''}" style="color:${member.grado[1]}">` +
        `<b>${esc(member.name)}</b><small>${esc(member.grado[0] || '')}</small></li>`).join('')}</ul>`
      : `<p class="legend">${state.schedule ? 'Equipaggio non disponibile.' : 'Caricamento equipaggio…'}</p>`;

    // Corse e scali come l'orario di Servizi a terra: una riga per scalo. Il cambio di corsa nello
    // stesso scalo e alla stessa ora e' una riga sola (corsa 30 › 31).
    const rows = [];
    corse.forEach((corsa, ci) => corsa.scali.forEach(([nome, orario], j) => {
      const prev = rows[rows.length - 1];
      const bolgetta = (BOLGETTE[corsa.numero] || {})[nome];
      if (j === 0 && prev && prev.nome === nome && prev.orario === orario) {
        prev.kind = 'S'; prev.run = `${prev.run} › ${corsa.numero}`; prev.bolgetta = prev.bolgetta || bolgetta;
        return;
      }
      const last = j === corsa.scali.length - 1;
      rows.push({ nome, orario, run: corsa.numero, bolgetta, kind: j === 0 ? 'P' : last ? 'A' : 'S', split: j === 0 && ci > 0 });
    }));
    if (rows.length) rows[rows.length - 1].kind = 'A';
    let nextFound = false;
    rows.forEach(row => {
      row.stato = '';
      if (!realToday) return;
      if (minutes(row.orario) < nowMin) row.stato = 'past';
      else if (!nextFound) { row.stato = 'next'; nextFound = true; }
    });
    const pastIdx = rows.map((row, i) => row.stato === 'past' ? i : -1).filter(i => i >= 0);
    const lastPast = pastIdx[pastIdx.length - 1];
    const hidden = Math.max(0, pastIdx.length - 1);
    const toggle = hidden ? `<button type="button" class="past-toggle" data-past aria-expanded="${state.showPast}">` +
      `${state.showPast ? '▴ Nascondi gli scali già fatti' : `▾ Mostra gli scali già fatti (${hidden})`}</button>` : '';
    const KIND = { P: 'PARTENZA', A: 'ARRIVO', S: 'SCALO' };
    const listaCorse = code === 'BIS'
      ? `<p class="mt-bis">A disposizione dell'Ufficio Movimento: pronti a muovere alle 8.30 verso Garda, rientro alle 18.40.</p>`
      : rows.length ? toggle + `<div class="navi-list">${rows.map((row, i) => {
        if (row.stato === 'past' && i !== lastPast && !state.showPast) return '';
        const badges = [];
        if (i === 0) { if (oggi.rif) badges.push('<b class="rifornimento" title="Rifornimento prima delle corse">R</b>'); if (ieri.ormeggio) badges.push(`<b class="ormeggio" title="Ormeggio del mattino (dalla sera prima)">⚓ ${esc(pontLabel(ieri.ormeggio))}</b>`); }
        if (row.bolgetta) badges.push(`<b class="bolgetta" title="Bolgetta: ${row.bolgetta}">B</b>`);
        if (i === rows.length - 1 && oggi.ormeggio) badges.push(`<b class="ormeggio" title="Ormeggio della sera">⚓ ${esc(pontLabel(oggi.ormeggio))}</b>`);
        const cls = `nave${/^T[12]$/.test(code) ? ' ferry' : ''}${row.split ? ' split' : ''}${row.stato === 'past' ? ' past' : ''}${row.stato === 'next' ? ' next' : ''}`;
        return `<div class="${cls}"><span class="ora">${esc(row.orario)}</span>` +
          `<span class="tipo ${row.kind}">${KIND[row.kind]}<small>corsa ${esc(row.run)}</small></span>${chip(code)}` +
          `<span class="dove"><span class="ship-line"><span class="ship-name">${esc(row.nome)}</span></span>` +
          `${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}</span></div>`;
      }).join('')}</div>` : '<p class="legend">Orario delle corse non disponibile per questo turno.</p>';

    const left = turnoCard(code, day, { inizio: info.presentation, fine: info.lastArrival, crewHtml: equipaggio });
    const right = card(code === 'BIS' ? 'Servizio' : 'Corse e scali', corse.length ? `${corse.length} corse` : '', listaCorse, 'mt-corse-card');
    $('turno-content').innerHTML = `<div class="terra-col">${left}</div><div class="terra-col">${right}</div>`;
  }

  function renderTerra(code, residenza, day) {
    $('turno-title').innerHTML = `${chip(code)} A terra`;
    $('turno-context').textContent = residenza === 'MADERNO' ? 'Maderno' : 'Desenzano';
    const servizio = (T.DATA.SERVIZI[residenza] || []).find(row => row[0] === code);
    $('turno-content').innerHTML = `<div class="terra-col">${turnoCard(code, day, servizio ? { inizio: servizio[1].split(' – ')[0], fine: servizio[2].split(' – ')[1] } : {})}</div>`;
    $('turno-terra').hidden = false;
    window.NaviServiziTerraPage?.show({ residence: residenza, day });
  }

  function renderAltro(turno, day) {
    const label = turno ? String(turno).toUpperCase() : '';
    const riposo = !label || /^(RIP|RIPOSO|CON|F\.?P\.?|MALATTIA|L\.?D\.?)$/.test(label);
    $('turno-title').textContent = riposo ? (label && label !== 'RIP' && label !== 'RIPOSO' ? label : 'Riposo') : label;
    $('turno-context').textContent = riposo ? 'Nessuna corsa in questo giorno' : 'Turno senza corse in orario';
    $('turno-content').innerHTML = `<div class="terra-col">${turnoCard(riposo ? 'RIP' : label, day)}</div>`;
  }

  function renderTestSelect(myShift) {
    const select = $('turno-test');
    const mine = myShift ? `Il mio turno (${myShift})` : 'Il mio turno';
    select.innerHTML = `<option value="">${esc(mine)}</option>` + TURNI_PROVA.map(([group, codes]) =>
      `<optgroup label="${esc(group)}">${codes.map(code => `<option value="${code}"${code === state.test ? ' selected' : ''}>${code === 'RIP' ? 'Riposo' : code}</option>`).join('')}</optgroup>`).join('');
    select.closest('.mt-test').classList.toggle('active', !!state.test);
  }

  function render() {
    const day = today(), shown = parseIso(day), realToday = day === iso(new Date());
    const clock = new Date();
    $('turno-day-label').textContent = `${GIORNI[shown.getDay()]} ${shown.getDate()} ${MESI[shown.getMonth()]}` +
      (realToday ? ` · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}` : '');
    $('turno-day-input').value = day;
    $('turno-day-today').hidden = realToday;
    $('turno-terra').hidden = true;
    const me = profile();
    const found = state.schedule ? G.turnoAgente(state.schedule, me, day) : null;
    renderTestSelect(found ? (G.naveCode(found.turno) || G.terraCode(found.turno) || found.turno) : '');
    if (!state.schedule && !state.test) { $('turno-content').innerHTML = ''; return; }
    const turno = state.test || found?.turno || '';
    const nave = G.naveCode(turno), terra = G.terraCode(turno);
    const messages = [];
    if (state.test) messages.push(`Prova con il turno ${state.test === 'RIP' ? 'Riposo' : state.test}: i tuoi dati non cambiano.`);
    else if (!found) messages.push('Non trovo il tuo turno nei dati di NaviTurni.');
    if (nave && !inServizio(nave, day)) messages.push(`Il turno ${nave} non è in servizio in questo giorno secondo l'orario in vigore.`);
    notice(messages.join(' · '));
    if (nave) renderNave(nave, day, me);
    else if (terra) renderTerra(terra, G.terraResidenza(terra) || String(found?.residenza || 'DESENZANO').toUpperCase(), day);
    else renderAltro(turno, day);
    const url = new URL(location.href);
    if (state.day) url.searchParams.set('day', state.day); else url.searchParams.delete('day');
    if (state.test) url.searchParams.set('turno', state.test); else url.searchParams.delete('turno');
    history.replaceState(null, '', url);
  }

  function notice(text) {
    $('turno-notice').hidden = !text;
    $('turno-notice').textContent = text || '';
  }

  const goToDay = day => { state.day = day === iso(new Date()) ? '' : day; state.showPast = false; render(); };
  $('turno-day-prev').addEventListener('click', () => goToDay(addDays(today(), -1)));
  $('turno-day-next').addEventListener('click', () => goToDay(addDays(today(), 1)));
  $('turno-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  $('turno-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });
  $('turno-test').addEventListener('change', event => { state.test = event.target.value; state.showPast = false; render(); });
  $('turno-content').addEventListener('click', event => {
    if (!event.target.closest('[data-past]')) return;
    state.showPast = !state.showPast;
    render();
  });

  render();
  window.NaviSharedData?.loadCacheFirst?.(data => { state.schedule = data || { residenze: {} }; render(); })
    .catch(error => { console.warn('Il mio turno: dati non disponibili', error); if (!state.schedule) notice('Non riesco a caricare i turni.'); });
  (async () => {
    try {
      const provider = window.NaviAdminFirebase;
      await provider.ready;
      state.firebaseNavi = await provider.getTurniNavi();
      if (state.schedule) render();
    } catch (error) { console.warn('Il mio turno: turni nave non disponibili', error); }
  })();
  setInterval(() => { if (state.schedule && $('turno-terra').hidden) render(); }, 60000);
})();
