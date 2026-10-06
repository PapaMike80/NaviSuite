// Pagina "Servizi a terra": la giornata a terra della residenza dell'agente (Desenzano o Maderno),
// con i pulsantini di NaviTurni per passare all'altra residenza. Pagina web, non il foglio A4:
// servizi a terra, navi in ordine di orario (passate in grigio, prossima evidenziata), ormeggi serali
// della settimana (Desenzano) o traghetto Torri (Maderno) e note. Il foglio A4 resta in "Stampa A4".
(function () {
  'use strict';

  const T = window.NaviServiziTerra;
  const D = T.DATA;
  const RESIDENZE = [{ code: 'D', name: 'DESENZANO', title: 'Desenzano' }, { code: 'M', name: 'MADERNO', title: 'Maderno' }];
  // Periodi in cui vale l'orario (O.d.S. 39/2026) e ultimo giorno delle corse SR (segnate con *).
  const PERIODI = [['2026-10-05', '2026-11-01'], ['2027-03-13', '2027-03-25']];
  const FINE_SR = '2026-10-11';
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const CACHE_KEY = 'navisuite.serviziTerra.turniNavi';
  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const short = value => { const d = parseIso(value); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const chip = code => `<span class="chip" data-code="${esc(code)}">${esc(code)}</span>`;

  // Residenza dell'agente collegato; per chi non e' di Desenzano o Maderno si apre Desenzano.
  function ownResidence() {
    let agent = null;
    try { agent = JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { agent = null; }
    const value = String(agent?.residence || agent?.residenza || '').trim().toUpperCase();
    return RESIDENZE.some(item => item.name === value) ? value : 'DESENZANO';
  }

  function initialResidence() {
    const asked = String(new URLSearchParams(location.search).get('res') || '').trim().toUpperCase();
    return RESIDENZE.some(item => item.name === asked) ? asked : ownResidence();
  }

  function readCache() {
    try { const rows = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return Array.isArray(rows) ? rows : null; } catch { return null; }
  }

  const state = { residence: initialResidence(), monday: T.defaultMonday(), turniNavi: readCache() || [] };

  // Ora attuale in minuti, solo se oggi vale l'orario; altrimenti null (niente passate/prossima).
  function nowInfo() {
    const now = new Date();
    const today = iso(now);
    const active = PERIODI.some(([from, to]) => today >= from && today <= to);
    return { today, minutes: active ? now.getHours() * 60 + now.getMinutes() : null, srOff: today > FINE_SR };
  }

  function renderButtons() {
    $('terra-residences').innerHTML = RESIDENZE.map(item => {
      const active = item.name === state.residence;
      return `<button type="button" class="quick-residence-btn${active ? ' active' : ''}" data-res="${item.name}" ` +
        `aria-label="Visualizza ${item.name}" aria-pressed="${active}" title="${item.title}">${item.code}</button>`;
    }).join('');
  }

  function serviziCard(now) {
    const items = D.SERVIZI[state.residence].map(([code, morning, afternoon, note]) => {
      let status = '';
      if (now.minutes != null) {
        const [a, b] = morning.split(' – ').map(T.minutes), [c, d] = afternoon.split(' – ').map(T.minutes);
        if ((now.minutes >= a && now.minutes < b) || (now.minutes >= c && now.minutes < d)) status = 'IN SERVIZIO ORA';
        else if (now.minutes >= b && now.minutes < c) status = `PAUSA · RIPRENDE ALLE ${afternoon.split(' – ')[0]}`;
      }
      return `<div class="servizio${status.startsWith('IN') ? ' now' : ''}">${chip(code)}<span class="ore">${morning}<br>${afternoon}</span>` +
        `<small>${esc(note)}</small>${status ? `<span class="stato">${status}</span>` : ''}</div>`;
    }).join('');
    return card('Servizi a terra', '', `<div class="servizi">${items}</div>`);
  }

  function naviCard(now) {
    const desenzano = state.residence === 'DESENZANO';
    const bolgette = D.BOLGETTE[state.residence];
    const split = desenzano ? '14.30' : '14.00';
    const ships = T.naviDelGiorno(state.turniNavi, now.today);
    const turni = T.turniDelGiorno(state.turniNavi, now.today);
    // Arrivo serale: l'ultimo movimento del turno e' un arrivo, la nave resta qui per la notte.
    const navi = D.NAVI[state.residence];
    const lastIndex = {};
    navi.forEach(([, , code], i) => { lastIndex[code] = i; });
    let nextFound = false;
    const rows = navi.map(([time, kind, code, run, where], index) => {
      const ormeggio = kind === 'A' && lastIndex[code] === index ? turni[code]?.ormeggio : '';
      const off = now.srOff && where.includes('*');
      let cls = time === split ? ' split' : '';
      if (off) cls += ' past';
      else if (now.minutes != null) {
        if (T.minutes(time) < now.minutes) cls += ' past';
        else if (!nextFound) { cls += ' next'; nextFound = true; }
      }
      const label = D.KIND[kind];
      return `<div class="nave${cls}"><span class="ora">${time}</span>` +
        `<span class="tipo ${kind}">${label}<small>${run ? `corsa ${esc(run)}` : '–'}</small></span>${chip(code)}` +
        `<span class="dove"><span>${esc(where)}${ships[code] ? `<small class="ship">${esc(ships[code])}</small>` : ''}</span>` +
        `${bolgette[run] ? `<b class="bolgetta">${esc(bolgette[run])}</b>` : ''}` +
        `${ormeggio ? `<b class="ormeggio" title="Ormeggio serale">⚓ ${esc(ormeggio.toUpperCase())}</b>` : ''}</span></div>`;
    }).join('');
    const legend = desenzano
      ? 'In grigio le navi già passate, evidenziata la prossima. Nave di oggi dagli O.d.S.'
      : `SCALO = nave in transito a Maderno · * corsa SR solo fino all'11 ottobre 2026${now.srOff ? ' (ora non più effettuata)' : ''} · nave di oggi dagli O.d.S.`;
    return card(desenzano ? 'Navi a Desenzano' : 'Navi di linea a Maderno', 'in ordine di orario',
      `<div class="navi-list">${rows}</div><p class="legend">${esc(legend)}</p>`);
  }

  function ormeggiCard(now) {
    const week = T.ormeggiSettimana(state.turniNavi, state.monday);
    const rows = week.days.map(date => {
      const day = iso(date), data = week.data[day];
      const head = `<span class="day">${GIORNI[date.getDay()]}<small>${short(day)}</small>${day === now.today ? '<b>OGGI</b>' : ''}</span>`;
      if (!data) return `<div class="giorno${day === now.today ? ' today' : ''}">${head}<span class="next-ods">nel prossimo O.d.S.</span></div>`;
      const groups = week.groups.map(group => {
        const v = data[group];
        if (!v) return `<span class="orm none">${chip(group)}<span class="pont">–</span></span>`;
        return `<span class="orm">${chip(group)}<span class="pont">${esc(v.pontile || '–')}${v.rif ? '<span class="r">R</span>' : ''}</span>` +
          `<span class="ship">${esc(v.nave)}</span></span>`;
      }).join('');
      return `<div class="giorno${day === now.today ? ' today' : ''}">${head}<span class="groups" style="--n:${week.groups.length}">${groups}</span></div>`;
    }).join('');
    const nav = `<div class="week-nav"><button type="button" data-week="-7" aria-label="Settimana precedente">‹</button>` +
      `<span>${short(state.monday)} – ${short(addDays(state.monday, 6))}</span>` +
      `<button type="button" data-week="7" aria-label="Settimana successiva">›</button></div>`;
    const source = week.ods.length ? `pontile della sera · R = rifornimento · O.d.S. ${week.ods.join(', ')}` : 'pontile della sera · R = rifornimento';
    return card('Ormeggi serali', nav, `<div class="ormeggi">${rows}</div><p class="legend">${esc(source)}</p>`);
  }

  function traghettoCard(now) {
    const ships = T.naviDelGiorno(state.turniNavi, now.today);
    const ferry = code => {
      let nextFound = false;
      const time = value => value ? `<span class="t">${value[0]}<small>c. ${esc(value[1])}</small></span>` : '';
      const rows = T.ferryRows(code).map(row => {
        if (row.kind === 'pausa-torri') return `<div class="ferry-row torri">pausa a Torri ${row.arr} – ${row.dep}</div>`;
        let cls = '';
        const last = (row.dep || row.arr)[0];
        if (now.minutes != null) {
          if (T.minutes(last) < now.minutes) cls = ' past';
          else if (!nextFound) { cls = ' next'; nextFound = true; }
        }
        let sosta = '';
        if (row.arr && row.dep) {
          const min = T.minutes(row.dep[0]) - T.minutes(row.arr[0]);
          sosta = `<span class="sosta${min >= 45 ? ' lunch' : ''}">${min >= 45 ? 'pausa ' : ''}${min}'</span>`;
        } else sosta = '<span class="sosta"></span>';
        const arr = row.kind === 'prima' ? '<span class="muted">1ª partenza</span>' : time(row.arr);
        const dep = row.kind === 'ultima' ? '<span class="muted" style="text-align:right">fine servizio</span>' : time(row.dep);
        return `<div class="ferry-row${cls}">${arr}${sosta}${dep}</div>`;
      }).join('');
      return `<div class="ferry"><h3>${chip(code)} ${ships[code] ? `<span class="ferry-ship">${esc(ships[code])}</span>` : 'Traghetto'}</h3><div class="ferry-head"><span>ARRIVO</span><span>SOSTA</span><span>PARTENZA</span></div>${rows}</div>`;
    };
    return card('Traghetto Maderno – Torri', 'arrivo da Torri · sosta · partenza per Torri', `<div class="ferries">${ferry('T1')}${ferry('T2')}</div>`);
  }

  function noteCard() {
    const items = [];
    if (state.residence === 'DESENZANO') {
      items.push(`<li class="rif"><b>${esc(D.RIFORNIMENTI.titolo)}</b>${D.RIFORNIMENTI.righe.map(esc).join('<br>')}</li>`);
    }
    D.NOTE[state.residence].forEach(([bold, text]) => items.push(`<li${bold ? ' class="bold"' : ''}>${esc(text)}</li>`));
    return card('Note', '', `<ul class="note-list">${items.join('')}</ul><p class="validita">${esc(D.VALIDITA)}</p>`);
  }

  function card(title, extra, body) {
    const side = extra && extra.startsWith('<') ? extra : extra ? `<small>${esc(extra)}</small>` : '';
    return `<section class="terra-card"><div class="terra-card-head"><h2>${esc(title)}</h2>${side}</div><div class="terra-card-body">${body}</div></section>`;
  }

  function render() {
    const info = RESIDENZE.find(item => item.name === state.residence);
    const desenzano = state.residence === 'DESENZANO';
    const now = nowInfo();
    renderButtons();
    $('terra-title').textContent = info.title;
    $('terra-context').textContent = desenzano ? 'Pontile e AgB · navi, ormeggi serali e rifornimenti' : 'AgM e AgT1 · navi di linea e traghetto Torri';
    const clock = new Date();
    $('terra-clock').textContent = now.minutes != null
      ? `${GIORNI[clock.getDay()]} ${short(now.today)} · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}`
      : 'Orario in vigore dal 5/10 all\'1/11/2026 e dal 13 al 25/3/2027';
    const left = [serviziCard(now), naviCard(now)];
    const right = [desenzano ? ormeggiCard(now) : traghettoCard(now), noteCard()];
    $('terra-content').innerHTML = `<div class="terra-col">${left.join('')}</div><div class="terra-col">${right.join('')}</div>`;
    const url = new URL(location.href);
    url.searchParams.set('res', state.residence.toLowerCase());
    history.replaceState(null, '', url);
  }

  function notice(text) {
    $('terra-notice').hidden = !text;
    $('terra-notice').textContent = text || '';
  }

  async function loadTurniNavi() {
    const provider = window.NaviAdminFirebase;
    try {
      if (!provider) throw new Error('Firebase non disponibile');
      await provider.ready;
      const rows = provider.getTurniNavi ? await provider.getTurniNavi() : (await provider.getAdminUpdates()).turniNavi;
      state.turniNavi = Array.isArray(rows) ? rows : [];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(state.turniNavi)); } catch { /* spazio pieno: niente copia locale */ }
      notice('');
    } catch (error) {
      notice(readCache()
        ? `Ormeggi serali dall'ultima copia salvata sul dispositivo (${error.message}).`
        : `Non riesco a leggere gli ormeggi serali degli O.d.S. (${error.message}).`);
    }
    render();
  }

  $('terra-residences').addEventListener('click', event => {
    const button = event.target.closest('[data-res]');
    if (!button || button.dataset.res === state.residence) return;
    state.residence = button.dataset.res;
    render();
  });
  $('terra-content').addEventListener('click', event => {
    const button = event.target.closest('[data-week]');
    if (!button) return;
    state.monday = addDays(state.monday, Number(button.dataset.week));
    render();
  });
  $('terra-print').addEventListener('click', () => {
    try { T.openResidence(state.residence, state.turniNavi, state.monday); } catch (error) { notice(error.message); }
  });

  render();
  loadTurniNavi();
  // Navi passate e prossima: aggiornate ogni minuto.
  setInterval(render, 60000);
})();
