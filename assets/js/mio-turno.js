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
  const oreMinuti = hours => { const total = Math.round((Number(hours) || 0) * 60); return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}min`; };

  // Turni selezionabili per le prove.
  const TURNI_PROVA = [
    ['Desenzano', ['D1', 'D2', 'BIS', 'AgB', 'PonD']],
    ['Maderno', ['T1', 'T2', 'M1', 'AgM', 'AgT']],
    ['Riva', ['R1', 'R2', 'R3']],
    ['Peschiera', ['P1', 'P2', 'SR1', 'SR2']],
    ['Altro', ['RIP']]
  ];

  // Corse dei turni, scali e periodi dell'orario: assets/js/orario-giorno.js (in comune con Orario).
  const { inServizio, corseDelTurno, corseBis, bisPerCorsa, corseIncarico, ritardiDelGiorno, testoRitardo } = window.NaviOrarioGiorno;

  function profile() {
    try { return JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; }
  }

  const params = new URLSearchParams(location.search);
  // «Prova turno» (provare la pagina con un altro turno) solo per gli admin
  const admin = !!window.NaviRoles?.isAdminAgent?.(profile());
  const state = { day: '', schedule: null, firebaseNavi: [], showPast: false, test: admin ? String(params.get('turno') || '') : '' };
  if (!admin) document.querySelector('.mt-test')?.remove();
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') && params.get('day') !== iso(new Date())) state.day = params.get('day');
  const today = () => state.day || iso(new Date());

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
  function turnoCard(code, day, { inizio = '', fine = '', crewHtml = '', nave = '' } = {}) {
    const comp = C?.shiftForCode(code === 'RIP' ? 'Riposo' : code, day) || {};
    const lavoro = code !== 'RIP' && Number(comp.hours) > 0;
    const orario = inizio && fine ? `<span class="mt-orario">${esc(ora(inizio))} → ${esc(ora(fine))}</span>` : '';
    const head = `<div class="mt-turno">${chip(code === 'RIP' ? 'Riposo' : code)}` +
      `${nave ? `<b class="mt-nave">${esc(nave)}</b>` : ''}${orario}` +
      `${lavoro ? `<span class="mt-ore">${oreMinuti(comp.hours)}</span>` : ''}</div>`;
    return card('Turno', '', head + crewHtml);
  }

  // Intestazione: ore del servizio e, oggi, quanto manca all'inizio o alla fine della giornata.
  function servizioHeader(inizio, fine, day, code = '') {
    const el = $('turno-servizio');
    if (!el) return;
    if (!inizio || !fine) { el.hidden = true; el.textContent = ''; return; }
    const durata = m => `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}'` : ''}`;
    let resto = '';
    if (day === iso(new Date())) {
      const now = new Date(), n = now.getHours() * 60 + now.getMinutes();
      const a = minutes(ora(inizio)), b = minutes(ora(fine));
      resto = n < a ? `inizia tra ${durata(a - n)}` : n < b ? `fine tra ${durata(b - n)}` : 'giornata finita';
    }
    // durata: le ore del turno (senza le pause), altrimenti da inizio a fine
    const ore = Number(C?.shiftForCode(code, day)?.hours) || 0;
    const tot = ore > 0 ? durata(Math.round(ore * 60)) : durata(minutes(ora(fine)) - minutes(ora(inizio)));
    el.innerHTML = `Servizio <b>${esc(ora(inizio))} – ${esc(ora(fine))}</b> <span class="mt-durata">(${esc(tot)})</span>${resto ? ` · <span class="mt-resto">${esc(resto)}</span>` : ''}`;
    el.hidden = false;
  }

  function renderNave(code, day, me) {
    const turniNavi = [...(state.schedule?.turni_navi || []), ...state.firebaseNavi];
    const oggi = T.turniDelGiorno(turniNavi, day)[code] || {};
    const ieri = T.turniDelGiorno(turniNavi, addDays(day, -1))[code] || {};
    const crew = G.equipaggi(state.schedule, day).navi[code] || [];
    const info = window.NaviCourseInfo?.info(code, day, { refuel: !!oggi.rif }) || {};
    // BIS: le corse assegnate dall'Ufficio Movimento (al posto di un'altra nave o in aiuto); gli altri
    // turni: le proprie, segnando quelle che fa il BIS al posto della nave.
    const incarichi = T.turniDelGiorno(turniNavi, day).BIS?.incarichi || [];
    // ritardi del Movimento: orari spostati (anche delle corse dopo, se la nave arriva tardi)
    const ritardi = ritardiDelGiorno(T.turniDelGiorno(turniNavi, day));
    const corse = code === 'BIS' ? corseBis(incarichi, day, ritardi) : corseDelTurno(code, day, ritardi[code]);
    const naveBis = T.turniDelGiorno(turniNavi, day).BIS?.nave || '';
    const sostituzione = code !== 'BIS' ? incarichi.find(inc => inc.tipo !== 'aiuto' && inc.turno === code) : null;
    const corseSostituite = sostituzione ? corseIncarico(sostituzione, day) : [];
    const realToday = day === iso(new Date());
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();

    $('turno-title').innerHTML = `${chip(code)} ${esc(oggi.nave || 'Nave non indicata')}`;
    $('turno-context').textContent = [G.comandante(crew), info.trips ? `corse ${info.trips}` : ''].filter(Boolean).join(' · ');


    const equipaggio = crew.length
      ? `<ul class="mt-crew">${crew.map(member => `<li class="${member.id && member.id === String(me?.id || '') ? 'me' : ''}" style="color:${member.grado[1]}">` +
        `<b>${esc(member.name)}</b><small>${esc(member.grado[0] || '')}</small></li>`).join('')}</ul>`
      : `<p class="legend">${state.schedule ? 'Equipaggio non disponibile.' : 'Caricamento equipaggio…'}</p>`;

    // Corse e scali come l'orario di Servizi a terra: una riga per scalo. Prima di ogni corsa (anche
    // la prima) una linea con il suo numero; se la corsa riparte subito dallo scalo d'arrivo della
    // precedente, lo scalo compare due volte: arrivo della corsa prima, linea, partenza della nuova.
    const rows = [];
    corse.forEach((corsa, ci) => corsa.scali.forEach(([nome, orario], j) => {
      const bolgetta = (BOLGETTE[corsa.numero] || {})[nome];
      const last = j === corsa.scali.length - 1;
      const sep = j === 0 ? corsa.numero : '';
      rows.push({ nome, orario, run: corsa.numero, bolgetta, kind: j === 0 ? 'P' : last ? 'A' : 'S', sep, rit: j === 0 ? corsa.ritardo : null,
        per: corsa.per || '', aiuto: corsa.tipo === 'aiuto', bis: code !== 'BIS' && !!bisPerCorsa(incarichi, code, corsa.numero, day) });
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
    const avvisoBis = code === 'BIS'
      ? `<p class="mt-bis">${incarichi.length ? 'Corse assegnate dall\'Ufficio Movimento' : 'A disposizione dell\'Ufficio Movimento: pronti a muovere alle 8.30 verso Garda, rientro alle 18.40.'}</p>`
      : sostituzione && corseSostituite.length
        ? `<p class="mt-bis">Le corse ${esc(corseSostituite[0].numero)}${corseSostituite.length > 1 ? `–${esc(corseSostituite[corseSostituite.length - 1].numero)}` : ''} le fa il BIS${naveBis ? ` (${esc(naveBis)})` : ''} al posto della nave${sostituzione.alla ? '' : ', fino a nuovo ordine'}.</p>` : '';
    const listaCorse = code === 'BIS' && !rows.length ? avvisoBis
      : rows.length ? avvisoBis + toggle + `<div class="navi-list">${rows.map((row, i) => {
        if (row.stato === 'past' && i !== lastPast && !state.showPast) return '';
        const badges = [];
        if (i === 0) { if (oggi.rif) badges.push('<b class="rifornimento" title="Rifornimento prima delle corse">R</b>'); const mattino = oggi.ormeggioMattino || ieri.ormeggio; if (mattino) badges.push(`<b class="ormeggio" title="Ormeggio del mattino${oggi.ormeggioMattino ? '' : ' (dalla sera prima)'}">⚓ ${esc(pontLabel(mattino))}</b>`); }
        if (row.bis) badges.push('<b class="bis" title="Corsa fatta dal BIS al posto della nave">BIS</b>');
        if (row.per) badges.push(`<b class="bis" title="${row.aiuto ? 'In aiuto' : 'Al posto della nave'} del ${esc(row.per)}">${row.aiuto ? 'aiuto' : 'al posto'} ${esc(row.per)}</b>`);
        if (row.bolgetta) badges.push(`<b class="bolgetta" title="Bolgetta: ${row.bolgetta}">B</b>`);
        if (i === rows.length - 1 && oggi.ormeggio) badges.push(`<b class="ormeggio" title="Ormeggio della sera">⚓ ${esc(pontLabel(oggi.ormeggio))}</b>`);
        const cls = `nave${/^T[12]$/.test(code) ? ' ferry' : ''}${row.stato === 'past' ? ' past' : ''}${row.stato === 'next' ? ' next' : ''}`;
        const sep = row.sep ? `<div class="mt-sep" role="separator" aria-label="Corsa ${esc(row.sep)}"><span>${esc(row.sep)}</span></div>` : '';
        return `${sep}<div class="${cls}"><span class="ora">${esc(row.orario)}${row.rit ? `<small class="rit" title="Ritardo">${esc(testoRitardo(row.rit))}</small>` : ''}</span>` +
          `<span class="tipo ${row.kind}">${KIND[row.kind]}<small>corsa ${esc(row.run)}</small></span>${chip(row.per || code)}` +
          `<span class="dove"><span class="ship-line"><span class="ship-name">${esc(row.nome)}</span></span>` +
          `${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}</span></div>`;
      }).join('')}</div>` : '<p class="legend">Orario delle corse non disponibile per questo turno.</p>';

    servizioHeader(info.presentation, info.lastArrival, day, code);
    const left = turnoCard(code, day, { inizio: info.presentation, fine: info.lastArrival, crewHtml: equipaggio, nave: oggi.nave || '' });
    const right = card(code === 'BIS' && !rows.length ? 'Servizio' : 'Corse e scali', corse.length ? `${corse.length} corse` : '', listaCorse, 'mt-corse-card');
    // Prima corse e scali, poi la mappa del lago (sezione Scali), poi la scheda Turno.
    $('turno-content').innerHTML = `<div class="terra-col">${right}</div>`;
    $('turno-after').innerHTML = `<div class="terra-col">${left}</div>`;
  }

  function renderTerra(code, residenza, day) {
    $('turno-title').innerHTML = `${chip(code)} A terra`;
    $('turno-context').textContent = residenza === 'MADERNO' ? 'Maderno' : 'Desenzano';
    const servizio = (T.DATA.SERVIZI[residenza] || []).find(row => row[0] === code);
    // A terra: la pagina Scali del mio scalo (mappa, navi allo scalo con pontili, ormeggi, agenti), poi la scheda Turno.
    $('turno-content').innerHTML = '';
    if (servizio) servizioHeader(servizio[1].split(' – ')[0], servizio[2].split(' – ')[1], day, code);
    $('turno-after').innerHTML = `<div class="terra-col">${turnoCard(code, day, servizio ? { inizio: servizio[1].split(' – ')[0], fine: servizio[2].split(' – ')[1] } : {})}</div>`;
    $('turno-scali').hidden = false;
    window.NaviOrarioPage?.show({ modo: 'terra', scalo: residenza === 'MADERNO' ? 'Maderno' : 'Desenzano', day, turno: code, inizio: servizio ? servizio[1].split(' – ')[0] : '' });
  }

  function renderAltro(turno, day) {
    const label = turno ? String(turno).toUpperCase() : '';
    // Nessun turno per il giorno nella copia salvata: non e' un riposo. Se i dati si stanno aggiornando
    // si dice che si sta caricando; se aggiornati, che il turno non c'e' ancora.
    if (!label && !state.test) {
      $('turno-title').textContent = state.fresco === 'offline' ? 'Turno non disponibile' : state.fresco ? 'Turno non pubblicato' : 'Carico il turno…';
      $('turno-context').textContent = state.fresco === 'offline' ? 'Non è nella copia salvata: serve la rete' : state.fresco ? 'Per questo giorno non c\'è ancora un turno' : 'Aggiornamento dei dati in corso';
      $('turno-content').innerHTML = '';
      return;
    }
    const riposo = !label || /^(RIP|RIPOSO|CON|F\.?P\.?|MALATTIA|L\.?D\.?)$/.test(label);
    $('turno-title').textContent = riposo ? (label && label !== 'RIP' && label !== 'RIPOSO' ? label : 'Riposo') : label;
    $('turno-context').textContent = riposo ? 'Nessuna corsa in questo giorno' : 'Turno senza corse in orario';
    $('turno-content').innerHTML = `<div class="terra-col">${turnoCard(riposo ? 'RIP' : label, day)}</div>`;
  }

  function renderTestSelect(myShift) {
    const select = $('turno-test');
    if (!select) return;
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
    // Distinta: apre la giornata mostrata (come da Turni)
    if ($('turno-distinta')) $('turno-distinta').href = `navidiaria.html?editDate=${encodeURIComponent(day)}`;
    $('turno-day-today').hidden = false;
    $('turno-day-today').classList.toggle('on', realToday);
    $('turno-scali').hidden = true;
    $('turno-after').innerHTML = '';
    servizioHeader('', '', day);
    const me = profile();
    const found = state.schedule ? G.turnoAgente(state.schedule, me, day) : null;
    renderTestSelect(found ? (G.naveCode(found.turno) || G.terraCode(found.turno) || found.turno) : '');
    if (!state.schedule && !state.test) { $('turno-content').innerHTML = ''; return; }
    const turno = state.test || found?.turno || '';
    const nave = G.naveCode(turno), terra = G.terraCode(turno);
    // Prima pagina "Automatica": sempre Il mio turno, anche a terra (AgB, PonD, AgM, AgT...). Scali e' per gli scali.
    if (params.get('auto') === '1') params.delete('auto');
    const messages = [];
    if (state.test) messages.push(`Prova con il turno ${state.test === 'RIP' ? 'Riposo' : state.test}: i tuoi dati non cambiano.`);
    else if (!found) messages.push('Non trovo il tuo turno nei dati di NaviTurni.');
    if (nave && !inServizio(nave, day)) messages.push(`Il turno ${nave} non è in servizio in questo giorno secondo l'orario in vigore.`);
    // Corse sospese dall'Ufficio Movimento (pagina Movimento)
    const sospesa = nave && state.schedule ? T.turniDelGiorno([...(state.schedule.turni_navi || []), ...state.firebaseNavi], day)[nave] : null;
    if (!sospesa?.sospesa && sospesa?.corseSospese?.length) messages.push(`⚠ ${nave}: ${sospesa.corseSospese.length === 1 ? 'corsa' : 'corse'} ${sospesa.corseSospese.join(', ')} sospesa dall'Ufficio Movimento.`);
    if (sospesa?.sospesa) messages.push(`⚠ Corse del ${nave} sospese dall'Ufficio Movimento${sospesa.motivo ? `: ${sospesa.motivo}` : ''}.`);
    notice(messages.join(' · '));
    if (!nave && !terra) window.NaviOrarioPage?.hide();
    if (nave) {
      renderNave(nave, day, me);
      // In linea: la mappa del lago con la mia corsa (sotto corse, scali e turno)
      $('turno-scali').hidden = false;
      window.NaviOrarioPage?.show({ modo: 'nave', turno: nave, day });
    }
    else if (terra) renderTerra(terra, G.terraResidenza(terra) || String(found?.residenza || 'DESENZANO').toUpperCase(), day);
    else renderAltro(turno, day);
    const url = new URL(location.href);
    url.searchParams.delete('auto');
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
  $('turno-test')?.addEventListener('change', event => { state.test = event.target.value; state.showPast = false; render(); });
  $('turno-content').addEventListener('click', event => {
    if (!event.target.closest('[data-past]')) return;
    state.showPast = !state.showPast;
    render();
  });

  render();
  window.NaviSharedData?.loadCacheFirst?.((data, meta) => { state.schedule = data || { residenze: {} }; state.fresco = !meta?.stale; render(); })
    .then(fresh => { if (!fresh && state.schedule) { state.fresco = 'offline'; render(); } })
    .catch(error => { console.warn('Il mio turno: dati non disponibili', error); if (!state.schedule) notice('Non riesco a caricare i turni.'); });
  (async () => {
    try {
      const provider = window.NaviAdminFirebase;
      // subito la copia salvata (anche senza rete), poi quella aggiornata
      const salvati = provider?.turniNaviSalvati?.();
      if (salvati && !state.firebaseNavi.length) { state.firebaseNavi = salvati; if (state.schedule) render(); }
      await provider.ready;
      state.firebaseNavi = await provider.getTurniNavi();
      if (state.schedule) render();
    } catch (error) { console.warn('Il mio turno: turni nave non disponibili', error); }
  })();
  // Turni modificati in NaviDiaria/NaviTurni: all'apertura, ogni minuto e quando si torna sulla pagina.
  const aggiornaModifiche = () => G.caricaModifiche(profile()).then(() => { if (state.schedule) render(); });
  aggiornaModifiche();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) aggiornaModifiche(); });
  window.addEventListener('storage', event => { if (String(event.key || '').startsWith('navidiaria.entries.v1.')) aggiornaModifiche(); });
  setInterval(() => { if (state.schedule) aggiornaModifiche(); }, 60000);
})();
