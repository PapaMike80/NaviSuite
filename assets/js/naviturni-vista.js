// NaviTurni nello stile NaviSuite: sopra la tabella di naviturni-page.js (con il suo scorrimento, i giorni passati nascosti,
// la mia riga fissata, i cambi di residenza e chi ha terminato) un riquadro con il turno scelto e «Con chi navighi».
// La tabella cambia solo grafica (naviturni-vista.css): toccando una bolla si carica qui l'equipaggio di quel turno.
(function () {
  'use strict';
  const G = window.NaviTurniGiorno, C = window.NaviShiftCompetence;
  const box = document.getElementById('nt-vista');
  // la testata della pagina diventa quella del turno scelto (al posto di «NaviSuite Turni»)
  const header = document.querySelector('body>header.page-header');
  const testata = document.createElement('div'); testata.id = 'nt-testata';
  if (header) { header.querySelector('.turni-header-copy')?.setAttribute('hidden', ''); header.prepend(testata); }
  // durante il caricamento la testata ha già la sua altezza: quando arrivano i dati non si sposta nulla
  testata.innerHTML = `<p class="terra-label">NAVITURNI</p><h1 class="terra-title nt-titolo">Caricamento…</h1><p class="terra-context nt-contesto">&nbsp;</p><div class="nt-eq-nomi"></div>`;
  if (!G || !box) return;
  document.body.classList.add('nt-stile');
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'], MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const SIGLA = { Capitano: 'Cap', 'Capo timoniere': 'CT', Motorista: 'Mot', 'Aiuto motorista': 'AM', Timoniere: 'Tim', Marinaio: 'Mar', Applicato: 'App' };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const settimana = s => { const d = parse(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const g = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - g) / 864e5 - 3 + ((g.getDay() + 6) % 7)) / 7); };
  const RIPOSO = /^(R|RIP\.?|RIPOSO|-{1,}|—|=+)$/i;
  const profilo = () => { try { return JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { return null; } };
  const oggi = iso(new Date());
  let schedule = null, scelta = null;
  const cache = new Map();

  const tuttiAgenti = () => Object.entries(schedule?.residenze || {}).flatMap(([res, list]) => (list || []).filter(a => a && !window.NaviRoles?.isBaristaAgent?.(a)).map(a => ({ a, res })));
  function turno(agent, day) {
    const k = `${agent.id || agent.agente}|${day}`;
    if (!cache.has(k)) { let t = ''; try { t = String(G.turnoAgente(schedule, { id: agent.id, name: agent.agente }, day)?.turno || '').trim(); } catch { t = ''; } if (/^TERRA/i.test(t)) { let r = ''; try { r = String(getAgentShiftOnDate(agent, day) || '').trim(); } catch { r = ''; } t = r && !/^TERRA/i.test(r) ? r : 'LAV'; } cache.set(k, t); }
    return cache.get(k);
  }
  const io = () => { const p = profilo(); return p ? tuttiAgenti().find(({ a }) => String(a.id) === String(p.id)) : null; };
  const grado = agent => G.gradoOf(agent);
  const giornoLungo = day => { const d = parse(day); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };

  // Riquadro in alto: il turno scelto (di default il mio di oggi) e chi c'e' a bordo
  // Testata come il Mio turno: etichetta, codice + nave, giorno e ore, poi l'equipaggio in bolle (due righe).
  // Righe ad altezza fissa: cambiando corsa o servizio la tabella sotto non si sposta.
  // ore del servizio, anche per i codici a terra scritti in modo diverso (AGM/AgM, L.D./LD...)
  const pulito = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const oreTurno = (code, day) => { try { const s = (C?.shiftsFor?.(day) || []).find(x => pulito(x.code) === pulito(code)); return Number(s?.hours) || 0; } catch { return 0; } };
  // Lavori e L.D.: stesso orario del Mio turno (O.d.S. 39/2026), per residenza; il venerdì feriale finisce prima
  const ORARIO_LAVORI = {
    DESENZANO: { mattina: ['8.00', '12.30'], pomeriggio: ['14.00', '17.30'], venerdi: '16.30' },
    MADERNO: { mattina: ['8.00', '12.30'], pomeriggio: ['14.00', '17.30'], venerdi: '16.30' },
    PESCHIERA: { mattina: ['7.30', '12.00'], pomeriggio: ['13.30', '17.00'], venerdi: '16.00' },
    RIVA: { mattina: ['7.30', '12.00'], pomeriggio: ['13.30', '17.00'], venerdi: '16.00' }
  };
  const lavoro = c => /^(LAV[.;]?|L\.?D[.;]?)$/i.test(String(c || '').trim());
  function orarioLavori(res, day) {
    const o = ORARIO_LAVORI[String(res || '').toUpperCase()] || ORARIO_LAVORI.DESENZANO;
    const venerdi = parse(day).getDay() === 5 && !window.NaviDistintaTotals?.isHoliday?.(parse(day));
    return [o.mattina[0], venerdi ? o.venerdi : o.pomeriggio[1]];
  }
  // inizio e fine del servizio come nel Mio turno: presentazione e ultimo arrivo per le navi,
  // orario dell'O.d.S. per i servizi a terra (AgB, AgM, AgT, PonD) e per LAV / L.D.
  const ora = v => String(v || '').replace(':', '.').replace(/^0(\d)/, '$1');
  function orarioServizio(code, nave, res, day, riga) {
    if (lavoro(code)) return orarioLavori(res, day);
    if (nave) { const i = window.NaviCourseInfo?.info?.(nave, day, { refuel: !!riga?.rif }) || {}; return [i.presentation, i.lastArrival]; }
    const T = window.NaviServiziTerra?.DATA?.SERVIZI || {};
    const r = Object.values(T).flat().find(x => pulito(x[0]) === pulito(code));
    return r ? [r[1].split(' – ')[0], r[2].split(' – ')[1]] : [];
  }
  function scheda() {
    const mio = io();
    const day = scelta?.day || oggi, code = scelta?.code || (mio ? turno(mio.a, oggi) : '');
    const giorno = giornoLungo(day).replace(/ (\S{3})\S*$/, ' $1');
    const testa = (titolo, contesto, nomi) => `<p class="terra-label">NAVITURNI</p><h1 class="terra-title nt-titolo">${titolo}</h1><p class="terra-context nt-contesto">${contesto}</p><div class="nt-eq-nomi">${nomi}</div>`;
    const vars = G.variazioniTurno ? G.variazioniTurno(schedule, code, day, []) : [];
    const varHtml = G.formattaPastiglieVariazioni ? G.formattaPastiglieVariazioni(vars, 'nt') : '';
    if (!code || RIPOSO.test(code)) return testa('Riposo', `${giorno} · tocca un turno per vedere l'equipaggio`, varHtml);
    const nave = G.naveCode(code), ore = oreTurno(nave || code, day);
    const riga = (schedule?.turni_navi || []).filter(r => String(r?.data || '').slice(0, 10) === day && G.naveCode(r?.corsa) === nave && r?.attiva !== false).pop();
    const durata = ore ? `${Math.floor(ore)} h${Math.round((ore % 1) * 60) ? ` ${String(Math.round((ore % 1) * 60)).padStart(2, '0')}'` : ''}` : '';
    let crew = [];
    try { const eq = G.equipaggi(schedule, day); crew = nave ? (eq.navi[nave] || []) : (eq.terra[G.terraCode(code)] || []).map(name => ({ name, grado: ['', '#94a3b8', 9] })); } catch { crew = []; }
    const ord = m => { const i = ORDINE_GRADI.indexOf(m.grado[0]); return i < 0 ? 99 : i; };
    crew = crew.slice().sort((x, y) => ord(x) - ord(y) || anzianita({ agente: x.name }) - anzianita({ agente: y.name }) || x.name.localeCompare(y.name, 'it'));
    const nomi = crew.map(m => `<span style="--g:${m.grado[1]}" title="${esc(m.grado[0] === 'Applicato' ? 'Bigliettaio' : m.grado[0] || '')}">${esc(m.name)}</span>`).join('');
    const crewVars = G.variazioniTurno ? G.variazioniTurno(schedule, code, day, crew) : [];
    const crewVarHtml = G.formattaPastiglieVariazioni ? G.formattaPastiglieVariazioni(crewVars, 'nt') : '';
    const chip = `<span class="chip" style="--c:${G.coloreTurno(code)}">${esc(code)}</span>`;
    const res = scelta?.res || mio?.res || (typeof currentResidence !== 'undefined' ? currentResidence : '');
    const [inizio, fine] = orarioServizio(code, nave, res, day, riga);
    const quando = inizio && fine ? `${ora(inizio)} – ${ora(fine)}${durata ? ` (${durata})` : ''}` : durata;
    return testa(`${chip} ${esc(riga?.nave || (nave ? 'Nave non indicata' : ''))}`, [giorno, quando].filter(Boolean).join(' · '), `${nomi}${crewVarHtml}`);
  }


  // ordine dell'equipaggio: per grado (l'applicato sopra il marinaio) e poi per anzianita'
  const ORDINE_GRADI = ['Capitano', 'Capo timoniere', 'Motorista', 'Timoniere', 'Aiuto motorista', 'Applicato', 'Marinaio'];
  const anzianita = a => { const r = Number(window.NaviSharedData?.seniorityRank?.(a.agente)); return Number.isFinite(r) ? r : 1e9; };
  const disegnaScheda = () => { (header ? testata : box).innerHTML = scheda(); altezze(); };
  addEventListener('resize', () => altezze());
  // le righe fisse si incollano sempre alla misura vera di testata, mese e date, anche mentre la tabella si ridisegna
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => altezze()); if (header) ro.observe(header); new MutationObserver(() => { document.querySelectorAll('.month-header,.date-header').forEach(el => { if (!el.dataset.ntOss) { el.dataset.ntOss = '1'; ro.observe(el); } }); }).observe(document.getElementById('turni-operativi') || document.body, { childList: true, subtree: true }); }

  // Tocco su una bolla della tabella: l'equipaggio di quel turno in quel giorno (date e turni dalla tabella stessa)
  document.addEventListener('click', e => {
    const td = e.target.closest('#tbody td[data-col]');
    if (!td || typeof dateCalendario === 'undefined') return;
    const cal = dateCalendario.find(c => c.col === Number(td.dataset.col));
    let agente = null; try { agente = getAgentForTableRow(td.closest('tr')); } catch { agente = null; }
    if (!cal || !agente) return;
    // il codice è quello scritto nella bolla (LAV, L.D., AgB...): ottieniTurnoPulito raggruppa i servizi a terra in «TERRA»
    let code = (td.querySelector('.cell-pill')?.textContent || td.textContent || '').trim();
    if (!code) { try { code = String(getAgentShiftOnDate(agente, cal.iso) || '').trim(); } catch { code = ''; } }
    if (!code || RIPOSO.test(code)) return;
    e.stopPropagation(); e.preventDefault();
    scelta = { day: cal.iso, code, res: typeof currentResidence !== 'undefined' ? currentResidence : '' };
    segnaScelta();
    colonneAltrove();
    disegnaScheda();
    // la testata resta sempre ferma in alto: niente da scorrere
  }, true);
  // la vecchia scheda equipaggio della tabella si apriva al rilascio del dito: non le arriva piu' nulla
  ['pointerdown', 'pointerup'].forEach(t => document.addEventListener(t, e => { if (e.target.closest('#tbody td[data-col], .date-header th[data-col]')) e.stopPropagation(); }, true));
  // toccando una data (o la mia bolla in quella data) si sceglie quella colonna con il mio turno; niente vecchia scheda del giorno
  document.addEventListener('click', e => {
    const th = e.target.closest('.date-header th[data-col]'); if (!th) return;
    e.stopPropagation(); e.preventDefault();
    if (typeof dateCalendario === 'undefined') return;
    const cal = dateCalendario.find(c => c.col === Number(th.dataset.col)); const mio = io(); if (!cal) return;
    // il mio turno come scritto nella mia bolla della data (stessa fonte della tabella, anche in bozza)
    const code = (th.querySelector('.nt-mt:not(.rip)')?.textContent || '').trim() || (mio ? turno(mio.a, cal.iso) : '');
    scelta = { day: cal.iso, code: code && !RIPOSO.test(code) ? code : '', res: mio?.res || '' };
    disegnaScheda(); segnaScelta(); colonneAltrove();
  }, true);

  // Oggi in evidenza nella tabella (che si ridisegna da sola: si rimette il segno ogni volta)
  // altezze vere di mese e date: la mia riga si incolla subito sotto, senza spazi
  const r0 = () => document.documentElement.style;
  function altezze() {
    const m = document.querySelector('.month-header')?.offsetHeight || 0, d = document.querySelector('.date-header')?.offsetHeight || 0;
    const t = header?.offsetHeight || 0;
    if (r0().getPropertyValue('--nt-testa') !== `${t}px`) r0().setProperty('--nt-testa', `${t}px`);
    if (!d) return;
    const r = document.documentElement.style;
    if (r.getPropertyValue('--nt-mia') !== `${m + d}px` || r.getPropertyValue('--nt-mese') !== `${m}px`) { r.setProperty('--nt-mese', `${m}px`); r.setProperty('--nt-mia', `${m + d}px`); }
  }
  // scritte sempre dentro la bolla: i codici lunghi (CONG, AGM*, CP1C...) rimpiccioliscono finché ci stanno
  function adatta() {
    document.querySelectorAll('#tbody .cell-pill:not(.c-rip)').forEach(b => {
      const t = b.textContent.trim();
      if (b.dataset.fit === t || !b.offsetWidth) return;
      b.dataset.fit = t; b.style.fontSize = ''; b.style.letterSpacing = '';
      if (t.length < 3) return;
      let f = parseFloat(getComputedStyle(b).fontSize) || 10.5;
      while (b.scrollWidth > b.clientWidth + 0.5 && f > 6.5) { f -= 0.5; b.style.fontSize = `${f}px`; b.style.letterSpacing = '-.04em'; }
    });
    // anche i nomi: su una riga, i più lunghi un po' più piccoli
    document.querySelectorAll('#tbody td.td-name').forEach(td => {
      const t = td.textContent.trim();
      if (td.dataset.fit === t || !td.offsetWidth) return;
      td.dataset.fit = t; td.style.removeProperty('font-size');
      let f = parseFloat(getComputedStyle(td).fontSize) || 13.5;
      while (td.scrollWidth > td.clientWidth + 0.5 && f > 10) { f -= 0.5; td.style.setProperty('font-size', `${f}px`, 'important'); }
    });
  }
  // giorno di paga (come nel Mio turno): il 27; di sabato si anticipa al 26, di domenica si posticipa al lunedì 28
  function giornoPaga(day) {
    const d = parse(day); const p = new Date(d.getFullYear(), d.getMonth(), 27, 12);
    if (p.getDay() === 6) p.setDate(26); else if (p.getDay() === 0) p.setDate(28);
    return iso(p);
  }
  // Riga delle date come la striscia del Mio turno: in ogni tessera la bolla del mio turno di quel giorno,
  // al posto delle residenze il mio nome (la mia riga separata non serve più)
  function mieiTurni() {
    const mio = io(); if (!mio) return;
    const primo = document.querySelector('.date-header th:not([data-col])');
    // le bolle delle residenze restano, il mio nome sotto (in linea con le bolle dei turni)
    if (primo && !primo.querySelector('.nt-mionome')) { primo.classList.add('nt-primo'); primo.insertAdjacentHTML('beforeend', `<span class="nt-mionome">${esc(mio.a.agente)}</span>`); }
    document.querySelectorAll('.date-header th[data-col]').forEach(th => {
      const c = dateCalendario.find(x => x.col === Number(th.dataset.col)); if (!c) return;
      th.classList.toggle('nt-bozza', !!th.querySelector('.week-draft-label:not(.is-empty)'));
      // il turno è quello scritto nella mia riga della tabella (anche nelle settimane in bozza), altrimenti dai dati
      const cella = document.querySelector(`#tbody tr.logged-agent-row td[data-col="${c.col}"]`);
      const scritto = (cella?.querySelector('.cell-pill')?.textContent || cella?.textContent || '').trim();
      const t = scritto || turno(mio.a, c.iso), rip = !t || RIPOSO.test(t) || /^[—-]+$/.test(t);
      const testo = rip ? '—' : t;
      let b = th.querySelector('.nt-mt');
      if (b && b.dataset.t === testo) return;
      if (!b) { b = document.createElement('span'); b.className = 'nt-mt'; th.appendChild(b); }
      b.dataset.t = testo; b.textContent = testo; b.classList.toggle('rip', rip);
      b.style.setProperty('--c', rip ? 'transparent' : G.coloreTurno(t));
    });
    document.body.classList.add('nt-mia-in-date');
    // il mio nome esattamente in linea con le bolle dei miei turni (stesso centro verticale)
    const nome = primo?.querySelector('.nt-mionome'), bolla = [...document.querySelectorAll('.date-header th[data-col] .nt-mt')].find(b => b.offsetWidth);
    if (nome && bolla) {
      const attuale = parseFloat(nome.style.getPropertyValue('--sposta')) || 0;
      const nr = nome.getBoundingClientRect(), br = bolla.getBoundingClientRect();
      const d = Math.round((br.top + br.height / 2) - (nr.top + nr.height / 2)) + attuale;
      if (d !== attuale) nome.style.setProperty('--sposta', `${d}px`);
    }
  }
  // colonna del giorno toccato: tessera e celle evidenziate tutte insieme (dorata se è il giorno di paga)
  function segnaScelta() {
    const cal = scelta && typeof dateCalendario !== 'undefined' ? dateCalendario.find(c => c.iso === scelta.day) : null;
    document.querySelectorAll('.nt-selcol').forEach(x => { if (!cal || Number(x.dataset.col) !== cal.col) x.classList.remove('nt-selcol', 'nt-oro', 'nt-rosso'); });
    // si accendono (bagliore esterno che pulsa) tutte le bolle della stessa corsa in quel giorno, la mia compresa
    document.querySelectorAll('.nt-pulsa').forEach(x => x.classList.remove('nt-pulsa'));
    if (cal && scelta?.code) {
      const chiave = c => { const t = String(c || '').trim().toUpperCase(); return G.naveCode(t) || t; }, k = chiave(scelta.code);
      document.querySelectorAll(`#tbody td[data-col="${cal.col}"] .cell-pill, .date-header th[data-col="${cal.col}"] .nt-mt`).forEach(b => { if (chiave(b.textContent) === k) b.classList.add('nt-pulsa'); });
    }
    if (!cal) return;
    const oro = cal.iso === giornoPaga(cal.iso);
    const rosso = !oro && parse(cal.iso).getDay() === 0;
    document.querySelectorAll(`.date-header th[data-col="${cal.col}"], #tbody td[data-col="${cal.col}"]:not(.elsewhere-span)`).forEach(x => { x.classList.add('nt-selcol'); x.classList.toggle('nt-oro', oro); x.classList.toggle('nt-rosso', rosso); });
  }
  // Colonne di oggi (tratteggiata) e del giorno scelto (piena; dorata nel giorno di paga, rossa la domenica):
  // un'unica cornice sopra tutta la tabella, allineata alla tessera della data, senza salti tra le righe
  // e anche sulle righe «A residenza».
  const cornici = {};
  function cornice(nome, th) {
    const tbody = document.getElementById('tbody'), table = tbody?.closest('table'), host = table?.parentElement;
    let el = cornici[nome];
    if (!th || !host || !th.offsetWidth) { el?.remove(); delete cornici[nome]; return; }
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (!el || el.parentElement !== host) { el?.remove(); el = cornici[nome] = document.createElement('div'); el.className = `nt-cornice nt-cornice-${nome}`; host.appendChild(el); }
    const h = host.getBoundingClientRect(), t = th.getBoundingClientRect(), b = tbody.getBoundingClientRect();
    el.style.setProperty('--w', `${t.width}px`);
    el.classList.toggle('nt-oro', th.classList.contains('nt-oro')); el.classList.toggle('nt-rosso', th.classList.contains('nt-rosso'));
    Object.assign(el.style, { left: `${t.left - h.left - host.clientLeft + host.scrollLeft}px`, width: `${t.width}px`, top: `${b.top - h.top - host.clientTop + host.scrollTop - 6}px`, height: `${b.height + 6}px` });
  }
  function colonneAltrove() {
    const oggiTh = document.querySelector('.date-header th.nt-oggi'), selTh = document.querySelector('.date-header th.nt-selcol');
    cornice('sel', selTh);
    cornice('oggi', selTh && selTh === oggiTh ? null : oggiTh);
  }
  addEventListener('resize', () => colonneAltrove());
  function segnaOggi() {
    altezze();
    adatta();
    if (typeof dateCalendario === 'undefined') return;
    // domeniche e giorno di paga, per le tessere della riga delle date
    document.querySelectorAll('.date-header th[data-col]:not([data-nt])').forEach(th => {
      const c = dateCalendario.find(x => x.col === Number(th.dataset.col)); if (!c) return;
      th.dataset.nt = '1';
      if (parse(c.iso).getDay() === 0) th.classList.add('nt-dom');
      if (c.iso === giornoPaga(c.iso)) th.classList.add('nt-paga');
    });
    mieiTurni();
    segnaScelta();
    const cal = dateCalendario.find(c => c.iso === oggi); if (!cal) return;
    document.querySelectorAll(`.date-header th[data-col="${cal.col}"]:not(.nt-oggi), #tbody td[data-col="${cal.col}"]:not(.nt-oggi)`).forEach(x => x.classList.add('nt-oggi'));
    colonneAltrove();
  }
  new MutationObserver(() => segnaOggi()).observe(document.getElementById('turni-operativi') || document.body, { childList: true, subtree: true });

  // all'apertura e cambiando residenza la tabella parte dal primo agente (in cima), senza slittare in giù
  const inCima = () => [0, 120, 400].forEach(t => setTimeout(() => window.scrollTo({ top: 0, left: window.scrollX, behavior: 'auto' }), t));
  if (typeof window.selectResidence === 'function') { const orig = window.selectResidence; window.selectResidence = function (...a) { const r = orig.apply(this, a); inCima(); return r; }; }
  let primaVolta = true;
  // Passato «a strappo»: con la tabella ferma su oggi (inizio) bisogna tirarla con decisione verso destra;
  // superata la soglia compaiono altri 30 giorni passati, e così via a ogni nuovo strappo.
  const PASSO = 30, SOGLIA = 150;
  let giorniPassati = 0, storicoMio = false;
  const scorritori = () => [document.scrollingElement, document.body, document.getElementById('matrix-scroll-wrap')].filter(Boolean);
  const xScroll = () => Math.max(...scorritori().map(e => e.scrollLeft || 0));
  const spostaX = d => scorritori().forEach(e => { if (e.scrollWidth > e.clientWidth + 1) e.scrollLeft += d; });
  const tira = document.createElement('div'); tira.id = 'nt-tira'; document.body.appendChild(tira);
  function mostraPassato() {
    if (typeof dateCalendario === 'undefined' || typeof refreshCurrentResidenceData !== 'function') return;
    const prima = document.querySelector('#tbody tr td[data-col]:not([style*="none"])');
    const x0 = prima ? prima.getBoundingClientRect().left : 0;
    giorniPassati += PASSO;
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - giorniPassati);
    try { if (typeof caricaStorico === 'function') caricaStorico(); } catch { /* niente */ }
    // anche l'equipaggio dei giorni passati: i dati completi (lo storico) servono pure alla testata
    if (!storicoMio && schedule?.__leggeroDal && window.NaviSharedData?.loadCompleto) { storicoMio = true; window.NaviSharedData.loadCompleto({ onLocale: d => { if (d && !d.__leggeroDal) carica(d); } }).then(d => { if (d && !d.__leggeroDal) carica(d); }).catch(() => { storicoMio = false; }); }
    automaticPastFromTime = d.getTime();
    refreshCurrentResidenceData(); renderTable(); hidePastColumns();
    // la colonna che si vedeva prima resta ferma sotto il dito: i giorni nuovi sono a sinistra
    const col = prima?.dataset.col;
    const allinea = () => { const c = col && document.querySelector(`.date-header th[data-col="${col}"]`); if (c) spostaX(c.getBoundingClientRect().left - x0); segnaOggi(); };
    requestAnimationFrame(allinea); [120, 350, 700].forEach(t => setTimeout(allinea, t));
  }
  let x0 = null, y0 = 0, tirando = false;
  document.addEventListener('touchstart', e => {
    if (!e.target.closest('#matrix-scroll-wrap') || xScroll() > 2) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tirando = false;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (x0 === null) return;
    const dx = e.touches[0].clientX - x0, dy = Math.abs(e.touches[0].clientY - y0);
    if (!tirando && (dx < 12 || dy > dx)) { if (dx < -6 || dy > 20) x0 = null; return; }
    tirando = true;
    const f = Math.min(1, dx / SOGLIA);
    tira.style.opacity = String(Math.min(1, f * 1.4)); tira.style.setProperty('--f', f);
    tira.textContent = f >= 1 ? `↻ Lascia per altri ${PASSO} giorni` : `‹ Tira per ${PASSO} giorni passati`;
    tira.classList.toggle('pronto', f >= 1);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (x0 === null) return;
    const pronto = tira.classList.contains('pronto');
    x0 = null; tirando = false; tira.style.opacity = '0'; tira.classList.remove('pronto');
    if (pronto) mostraPassato();
  });
  // col mouse: rotella/trackpad verso sinistra oltre l'inizio, con decisione
  let accumulo = 0, tAccumulo = 0;
  document.addEventListener('wheel', e => {
    if (!e.target.closest('#matrix-scroll-wrap') || xScroll() > 2 || e.deltaX >= 0) return;
    const ora = Date.now(); if (ora - tAccumulo > 400) accumulo = 0; tAccumulo = ora;
    accumulo -= e.deltaX; if (accumulo > SOGLIA * 4) { accumulo = 0; mostraPassato(); }
  }, { passive: true });

  function carica(data) { schedule = data || { residenze: {} }; cache.clear(); disegnaScheda(); segnaOggi(); if (primaVolta) { primaVolta = false; inCima(); } }
  window.NaviSharedData?.loadCacheFirst?.(data => carica(data))?.catch?.(() => {});
  G.caricaModifiche?.(profilo())?.then?.(() => { if (schedule) { cache.clear(); disegnaScheda(); } })?.catch?.(() => {});
  // Clic su pastiglia variazione: apre eventuale documento allegato
  document.addEventListener('click', async e => {
    const chip = e.target.closest('.nt-var-chip');
    if (!chip) return;
    if (chip.dataset.docId) {
      try {
        const fileData = await window.NaviAdminFirebase?.getAdminDocumentFile?.(chip.dataset.docId);
        if (fileData) {
          const url = fileData.dataUrl || fileData.url || (fileData.base64 ? `data:application/pdf;base64,${fileData.base64}` : '');
          if (url) { window.open(url, '_blank'); return; }
        }
      } catch (_) {}
    }
    if (chip.dataset.odsDoc) {
      const fileName = typeof odsPdfFiles !== 'undefined' ? odsPdfFiles[chip.dataset.odsDoc] : null;
      if (fileName) window.open(`ods/${encodeURIComponent(fileName)}`, '_blank');
      else window.open('documenti.html#ods-docs', '_blank');
    }
  });

})();