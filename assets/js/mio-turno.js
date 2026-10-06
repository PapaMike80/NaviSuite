// Pagina "Il mio turno": la giornata dell'agente collegato. Su una nave: nave, presentazione,
// ormeggio del mattino (dalla sera prima) e della sera, rifornimento, equipaggio e corse con tutti
// gli scali. A terra: la pagina Servizi a terra. Si scorre per giorni come la pagina Oggi.
(function () {
  'use strict';

  const G = window.NaviTurniGiorno;
  const T = window.NaviServiziTerra;
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

  const state = { day: '', schedule: null, firebaseNavi: [], redirected: false };
  {
    const asked = new URLSearchParams(location.search).get('day');
    if (/^\d{4}-\d{2}-\d{2}$/.test(asked || '') && asked !== iso(new Date())) state.day = asked;
  }
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
    $('turno-context').textContent = [G.comandante(crew) ? `Comandante ${G.comandante(crew)}` : '', info.trips ? `corse ${info.trips}` : ''].filter(Boolean).join(' · ');

    const giornata = `<div class="mt-facts">` +
      `<div class="mt-fact"><span>Presentazione</span><b>${esc(ora(info.presentation))}</b>${oggi.rif ? '<small>con rifornimento</small>' : ''}</div>` +
      `<div class="mt-fact"><span>Prima partenza</span><b>${esc(ora(info.firstDeparture || corse[0]?.scali[0][1]))}</b></div>` +
      `<div class="mt-fact"><span>Ultimo arrivo</span><b>${esc(ora(info.lastArrival))}</b></div>` +
      `</div>` +
      `<div class="mt-moorings">` +
      `<div class="mt-mooring"><span>Ormeggio del mattino</span><b>${ieri.ormeggio ? `⚓ ${esc(pontLabel(ieri.ormeggio))}` : '–'}</b>${oggi.rif ? '<b class="rifornimento" title="Rifornimento prima delle corse">R</b>' : ''}<small>dalla sera prima</small></div>` +
      `<div class="mt-mooring"><span>Ormeggio della sera</span><b>${oggi.ormeggio ? `⚓ ${esc(pontLabel(oggi.ormeggio))}` : '–'}</b><small>dall'O.d.S.</small></div>` +
      `</div>`;

    const equipaggio = crew.length
      ? `<ul class="mt-crew">${crew.map(member => `<li class="${member.id && member.id === String(me?.id || '') ? 'me' : ''}" style="color:${member.grado[1]}">` +
        `<b>${esc(member.name)}</b><small>${esc(member.grado[0] || '')}</small></li>`).join('')}</ul>`
      : `<p class="legend">${state.schedule ? 'Equipaggio non disponibile.' : 'Caricamento equipaggio…'}</p>`;

    let nextFound = false;
    const listaCorse = code === 'BIS'
      ? `<p class="mt-bis">A disposizione dell'Ufficio Movimento: pronti a muovere alle 8.30 verso Garda, rientro alle 18.40.</p>`
      : corse.length ? corse.map(corsa => {
        const first = corsa.scali[0], last = corsa.scali[corsa.scali.length - 1];
        let cls = '';
        if (realToday) {
          if (minutes(last[1]) < nowMin) cls = ' past';
          else if (!nextFound) { cls = ' next'; nextFound = true; }
        }
        return `<div class="mt-corsa${cls}"><div class="mt-corsa-head"><span>Corsa ${esc(corsa.numero)}</span>` +
          `<b>${esc(first[0])} ${esc(first[1])} → ${esc(last[0])} ${esc(last[1])}</b></div>` +
          `<ol class="mt-scali">${corsa.scali.map(([scalo, ora]) => `<li><span>${esc(ora)}</span>${esc(scalo)}</li>`).join('')}</ol></div>`;
      }).join('') : '<p class="legend">Orario delle corse non disponibile per questo turno.</p>';

    const left = card('Giornata', oggi.nave ? `nave ${oggi.nave}` : '', giornata) + card('Equipaggio', `${crew.length} in turno`, equipaggio);
    const right = card(code === 'BIS' ? 'Servizio' : 'Corse e scali', corse.length ? `${corse.length} corse` : '', listaCorse, 'mt-corse-card');
    $('turno-content').innerHTML = `<div class="terra-col">${left}</div><div class="terra-col">${right}</div>`;
  }

  function renderAltro(turno, day) {
    const label = turno ? String(turno).toUpperCase() : '';
    const riposo = !label || /^(RIP|RIPOSO|CON|F\.?P\.?|MALATTIA|L\.?D\.?)$/.test(label);
    $('turno-title').textContent = riposo ? (label && label !== 'RIP' && label !== 'RIPOSO' ? label : 'Riposo') : label;
    $('turno-context').textContent = riposo ? 'Nessuna corsa in questo giorno' : 'Turno senza corse in orario';
    $('turno-content').innerHTML = `<div class="terra-col">${card(riposo ? 'Buon riposo' : 'Turno', '', `<p class="mt-bis">${riposo ? 'In questo giorno non sei in servizio a bordo.' : `Il turno ${esc(label)} non ha corse in orario.`}</p>`)}</div>`;
  }

  function renderTerra(code, residenza, day) {
    $('turno-title').innerHTML = `${chip(code)} A terra`;
    $('turno-context').textContent = residenza === 'MADERNO' ? 'Maderno' : 'Desenzano';
    const link = `servizi-terra.html?res=${encodeURIComponent(residenza.toLowerCase())}${day !== iso(new Date()) ? `&day=${day}` : ''}`;
    $('turno-content').innerHTML = `<div class="terra-col">${card('Servizio a terra', '', `<p class="mt-bis">Sei in servizio a terra (${esc(code)}).</p><a class="terra-print mt-link" href="${link}">Apri Servizi a terra →</a>`)}</div>`;
    return link;
  }

  function render() {
    const day = today(), shown = parseIso(day), realToday = day === iso(new Date());
    const clock = new Date();
    $('terra-day-label').textContent = `${GIORNI[shown.getDay()]} ${shown.getDate()} ${MESI[shown.getMonth()]}` +
      (realToday ? ` · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}` : '');
    $('terra-day-input').value = day;
    $('terra-day-today').hidden = realToday;
    if (!state.schedule) { $('turno-content').innerHTML = ''; return; }
    const me = profile();
    const found = G.turnoAgente(state.schedule, me, day);
    if (!found) { notice('Non trovo il tuo turno nei dati di NaviTurni.'); renderAltro('', day); return; }
    const nave = G.naveCode(found.turno), terra = G.terraCode(found.turno);
    notice(nave && !inServizio(nave, day) ? `Il turno ${nave} non è in servizio in questo giorno secondo l'orario in vigore.` : '');
    if (nave) renderNave(nave, day, me);
    else if (terra) {
      const link = renderTerra(terra, G.terraResidenza(terra) || String(found.residenza).toUpperCase(), day);
      // All'apertura, a terra: direttamente la pagina Servizi a terra.
      if (!state.redirected && !state.moved) { state.redirected = true; location.replace(link); }
    } else renderAltro(found.turno, day);
    const url = new URL(location.href);
    if (state.day) url.searchParams.set('day', state.day); else url.searchParams.delete('day');
    history.replaceState(null, '', url);
  }

  function notice(text) {
    $('terra-notice').hidden = !text;
    $('terra-notice').textContent = text || '';
  }

  const goToDay = day => { state.day = day === iso(new Date()) ? '' : day; state.moved = true; render(); };
  $('terra-day-prev').addEventListener('click', () => goToDay(addDays(today(), -1)));
  $('terra-day-next').addEventListener('click', () => goToDay(addDays(today(), 1)));
  $('terra-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  $('terra-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });

  render();
  window.NaviSharedData?.loadCacheFirst?.(data => { state.schedule = data || { residenze: {} }; render(); })
    .catch(error => { console.warn('Il mio turno: dati non disponibili', error); if (!state.schedule) { notice('Non riesco a caricare i turni.'); } });
  (async () => {
    try {
      const provider = window.NaviAdminFirebase;
      await provider.ready;
      state.firebaseNavi = await provider.getTurniNavi();
      if (state.schedule) render();
    } catch (error) { console.warn('Il mio turno: turni nave non disponibili', error); }
  })();
  setInterval(() => { if (state.schedule) render(); }, 60000);
})();
