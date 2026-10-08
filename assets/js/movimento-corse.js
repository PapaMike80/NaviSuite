/*
 * NaviSuite · Movimento — corse del giorno (solo admin, gate anche in shared-menu.js).
 *
 * L'Ufficio Movimento assegna giorno per giorno, oltre agli O.d.S.: per ogni turno nave (D1, P2,
 * M1, T1...) nave, ormeggio del mattino e della sera, rifornimento ed equipaggio, e puo' sospendere
 * tutte le corse del turno (lago mosso, guasto...) e poi ripristinarle.
 * - Nave, ormeggi, rifornimento e sospensione: riga del Movimento nei turni nave
 *   (NaviAdminFirebase.saveTurnoNaveMovimento / ripristinaTurnoNave), che vince sugli O.d.S.
 * - Equipaggio: variazioni manuali dei turni degli agenti (saveVariazioneMovimento), le stesse che
 *   leggono NaviTurni, Oggi, Il mio turno e Servizi a terra.
 * - Equipaggio minimo della nave: dall'anagrafica navi qui sotto (movimento.js).
 */
(() => {
  'use strict';

  const NM = window.NaviMovimento;
  if (!NM || !document.getElementById('mov-list')) return;
  const { O, G, T, iso, parseIso, addDays, setStatus, righeNavi, turniCodici, turniFermi, agenti, nomiNave, stessaNave, modificaOds, variazioneMovimento, salva, ripristina, variazione } = NM;
  const C = window.NaviCourseInfo;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = value => String(value || '').replace(':', '.').replace(/^0(\d)/, '$1');
  const autore = NM.autore;

  // Causali per togliere un agente dall'equipaggio (oppure lo si sposta su un altro turno).
  const CAUSALI = [['MAL', 'Malattia'], ['RIP', 'Riposo'], ['CON', 'Congedo'], ['FERIE', 'Ferie']];
  const PONTILI = ['pontile 1', 'pontile 2', 'pontile 3', 'pontile 4', 'pontile 5', 'pontile 6'];
  // Ruolo dell'anagrafica navi per grado dell'equipaggio (turni-giorno.js).
  const RUOLO = { Comandante: 'capitano', 'Capo timoniere': 'capo_timoniere', Timoniere: 'timoniere', Motorista: 'motorista', 'Aiuto motorista': 'aiuto_motorista', Marinaio: 'marinaio' };
  const RUOLI = [['capitano', 'capitano', 'capitani'], ['capo_timoniere', 'capo timoniere', 'capi timonieri'], ['timoniere', 'timoniere', 'timonieri'],
    ['motorista', 'motorista', 'motoristi'], ['aiuto_motorista', 'aiuto motorista', 'aiuto motoristi'], ['marinaio', 'marinaio', 'marinai']];

  const state = NM.state;
  const ui = { open: '', suspending: '', bisForm: null, sbarco: 'RIP', menu: null, sovr: false, q: '', sospCorsa: null, sospBis: false };

  // Equipaggio minimo della nave nel giorno (anagrafica navi) e ruoli che mancano.
  function minimo(nave, day, crew) {
    const ship = Object.values(state.fleet).find(item => stessaNave(item?.nome, nave));
    if (!ship) return null;
    const periodi = (Array.isArray(ship.periodi) ? ship.periodi : Object.values(ship.periodi || {})).filter(Boolean)
      .sort((a, b) => String(a.dal || '').localeCompare(String(b.dal || '')));
    const periodo = periodi.filter(p => String(p.dal || '') <= day).pop();
    if (!periodo) return null;
    // ogni posto e' coperto da chi ha quel grado o uno superiore (non il contrario)
    const presenti = {};
    posti(nave, day, crew).forEach(x => { if (x.membro && !x.extra) presenti[x.ruolo] = (presenti[x.ruolo] || 0) + 1; });
    const richiesti = RUOLI.filter(([key]) => Number(periodo.equipaggio?.[key]) > 0)
      .map(([key, uno, piu]) => ({ key, n: Number(periodo.equipaggio[key]), label: Number(periodo.equipaggio[key]) === 1 ? uno : piu, presenti: presenti[key] || 0 }));
    const totale = richiesti.reduce((s, r) => s + r.n, 0);
    return { nome: ship.nome, richiesti, totale, mancano: richiesti.filter(r => r.presenti < r.n) };
  }

  // ---------------- Pallini dell'equipaggio ----------------
  // Un pallino per ogni posto dell'equipaggio minimo della nave, col colore del grado, e sotto il nome di chi
  // ci sta. Ogni agente va sul posto del suo grado; chi resta riempie i posti scoperti (es. un marinaio al
  // posto di un timoniere); chi avanza e' in piu' rispetto al minimo.
  const RUOLO_INFO = { capitano: ['Cap', '#facc15', 'Comandante'], capo_timoniere: ['CT', '#fb923c', 'Capo timoniere'], timoniere: ['Tim', '#22c55e', 'Timoniere'],
    motorista: ['Mot', '#a855f7', 'Motorista'], aiuto_motorista: ['AM', '#3b82f6', 'Aiuto motorista'], marinaio: ['Mar', '#e8f3f6', 'Marinaio'] };
  const cognome = name => { const w = String(name || '').trim().split(/\s+/)[0] || ''; return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
  function periodoNave(nave, day) {
    const ship = Object.values(state.fleet).find(item => stessaNave(item?.nome, nave));
    if (!ship) return null;
    const periodi = (Array.isArray(ship.periodi) ? ship.periodi : Object.values(ship.periodi || {})).filter(Boolean)
      .sort((a, b) => String(a.dal || '').localeCompare(String(b.dal || '')));
    return periodi.filter(p => String(p.dal || '') <= day).pop() || null;
  }
  // Posti che ciascun grado puo' coprire oltre al proprio: ponte (capitano > capo timoniere > timoniere > marinaio)
  // e macchina (motorista > aiuto motorista > marinaio).
  const COPRE = { capitano: ['capo_timoniere', 'timoniere', 'marinaio'], capo_timoniere: ['timoniere', 'marinaio'], timoniere: ['marinaio'],
    motorista: ['aiuto_motorista', 'marinaio'], aiuto_motorista: ['marinaio'] };
  // Sovrannumero: aggiunto con il "+" e segnato sul turno con l'asterisco (D1*).
  const sovrannumero = v => !!v && (v.sovrannumero === true || String(v.turno_nuovo || '').trim().endsWith('*'));
  function posti(nave, day, crew) {
    const periodo = periodoNave(nave, day);
    const variazione = m => variazioneMovimento(day, m.id);
    // sovrannumero: variazione col "+" o turno scritto con l'asterisco (D1*) gia' nei turni
    const turni = new Map(agenti(day).map(a => [String(a.agent.id), a.turno]));
    const isSovr = m => sovrannumero(variazione(m)) || String(turni.get(String(m.id)) || '').trim().endsWith('*');
    const aggiunti = crew.filter(m => variazione(m)?.aggiunto && !isSovr(m)).map(m => RUOLO[m.grado[0]] || 'marinaio');
    const slot = periodo ? [...RUOLI.flatMap(([key]) => Array(Math.max(0, Number(periodo.equipaggio?.[key]) || 0)).fill(key)), ...aggiunti] : crew.map(m => RUOLO[m.grado[0]] || 'marinaio');
    const liberi = [...crew];
    const out = slot.map(ruolo => ({ ruolo, membro: null, adattato: false }));
    const prendi = (cond, adattato) => out.forEach(x => {
      if (x.membro) return;
      const i = liberi.findIndex(m => cond(x, m));
      if (i >= 0) { x.membro = liberi.splice(i, 1)[0]; x.adattato = adattato; }
    });
    prendi((x, m) => RUOLO[m.grado[0]] === x.ruolo, false);
    // un grado superiore copre un posto inferiore (non il contrario): sceglie il meno alto tra chi puo'
    out.forEach(x => {
      if (x.membro) return;
      const adatti = liberi.filter(m => COPRE[RUOLO[m.grado[0]]]?.includes(x.ruolo)).sort((a, b) => b.grado[2] - a.grado[2]);
      if (adatti.length) { x.membro = adatti[0]; x.adattato = true; liberi.splice(liberi.indexOf(adatti[0]), 1); }
    });
    liberi.forEach(m => out.push({ ruolo: RUOLO[m.grado[0]] || 'marinaio', membro: m, adattato: false, extra: true, sovr: isSovr(m) }));
    return out;
  }
  function pallini(code, lista) {
    return lista.map((x, i) => {
      const [sigla, colore, nomeRuolo] = RUOLO_INFO[x.ruolo] || RUOLO_INFO.marinaio;
      const nome = x.membro ? `<span class="slot-nome" style="color:${x.membro.grado[1]}">${esc(cognome(x.membro.name))}</span>` : '<span class="slot-nome vuoto">vuoto</span>';
      const titolo = `${nomeRuolo}${x.membro ? `: ${x.membro.name}${x.adattato ? ` (fa da ${nomeRuolo.toLowerCase()})` : ''}${x.sovr ? ' (sovrannumero)' : ''}` : ': posto scoperto'} — tocca per cambiare`;
      const aperto = ui.menu?.code === code && ui.menu.i === i;
      return `<button type="button" class="slot${x.membro ? '' : ' manca'}${x.adattato ? ' adattato' : ''}${x.extra ? ' extra' : ''}${x.sovr ? ' sovr' : ''}${aperto ? ' aperto' : ''}" style="--g:${colore}" data-act="slot" data-code="${code}" data-i="${i}" title="${esc(titolo)}">` +
        `<span class="slot-pallino">${sigla}</span>${nome}</button>`;
    }).join('') + piu(code);
  }
  // Bolla "+" a destra dei pallini: aggiunge un membro all'equipaggio (anche sovrannumero).
  const piu = code => `<button type="button" class="slot piu${ui.menu?.code === code && ui.menu.i === -1 ? ' aperto' : ''}" style="--g:#2dd4bf" data-act="slot" data-code="${code}" data-i="-1" title="Aggiungi un membro all'equipaggio">` +
    '<span class="slot-pallino">+</span><span class="slot-nome">aggiungi</span></button>';
  // Residenza della corsa: quella della maggior parte dell'equipaggio, altrimenti dalla lettera del turno.
  function residenzaCorsa(code, crew, tutti) {
    const conta = {};
    crew.forEach(m => { const r = tutti.find(a => String(a.agent.id) === String(m.id))?.residenza; if (r) conta[r] = (conta[r] || 0) + 1; });
    const top = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) return top;
    const lettera = code[0] === 'D' ? 'DESENZANO' : /^[MT]/.test(code) ? 'MADERNO' : '';
    return Object.keys(state.schedule?.residenze || {}).find(r => r.toUpperCase() === lettera) || '';
  }
  const titoloRes = text => String(text).charAt(0).toUpperCase() + String(text).slice(1).toLowerCase();
  // Disponibilita' per la sostituzione: prima chi e' libero (L.D. e Lavori/TERRA, i primi a essere imbarcati), poi chi
  // riposa, poi chi fa un servizio a terra, poi gli altri (ferie, altre corse...); il congedo, che e' un
  // riposo concordato, e' in fondo; ancora sotto chi non e' chiamabile (#, malattia, aspettativa).
  function disponibilita(turno) {
    const t = String(turno || '').trim().toUpperCase();
    // # = non chiamabile (malattia o aspettativa), come la malattia scritta per esteso: in fondo a tutti
    if (t.includes('#') || /^MAL/.test(t)) return 5;
    // qualunque scrittura del congedo: CON, CONG., CON; CON/ CON* e simili (cio' che segue CON e' un simbolo)
    if (/^(?:CON|C\.(?!\w))/.test(t)) return 4;
    if (/^(?:L\.?D[.;]?|LAV[.;]?|LAVORI|TERRA|DISP)$/.test(t)) return 0;
    if (!t || /^(?:RIP(?:\.|-*)?|RIPOSO|-{2,}|={2,})$/.test(t)) return 1;
    if (G.terraCode(t) || /^PONTILE/.test(t)) return 2;
    return 3;
  }
  const perDisponibilita = (a, b) => disponibilita(a.turno) - disponibilita(b.turno);

  // Menu del posto: gli agenti che lo possono coprire (stesso grado o superiore, mai inferiore), prima quelli della
  // residenza della corsa; in fondo si toglie chi c'e' (riposo, malattia, congedo, ferie).
  const puoCoprire = (ruoloAgente, ruoloPosto) => ruoloAgente === ruoloPosto || !!COPRE[ruoloAgente]?.includes(ruoloPosto);
  // Menu del posto: gli agenti che lo possono coprire, per residenza (prima quella della corsa), ciascuno col colore
  // del suo grado; poi dove va chi sbarca e il pulsante per toglierlo senza sostituto.
  function popoverAggiunta(code, crew, tutti) {
    const ids = new Set(crew.map(m => String(m.id)));
    const candidati = tutti.filter(a => !ids.has(String(a.agent.id)));
    const casa = residenzaCorsa(code, crew, tutti);
    const residenze = [...new Set(candidati.map(a => a.residenza))].sort((a, b) => (b === casa) - (a === casa) || a.localeCompare(b, 'it'));
    const riga = a => { const g = G.gradoOf(a.agent); return `<button type="button" class="pop-agente" data-act="aggiungi" data-code="${code}" data-id="${esc(a.agent.id)}"><span class="pa-nome" style="color:${g[1]}">${esc(a.agent.agente)}</span><small>${esc(g[0] || '')}</small><span class="chip" data-code="${esc(a.turno || '—')}">${esc(a.turno || '—')}</span></button>`; };
    const gruppi = residenze.map(r => `<p class="pop-res">${esc(titoloRes(r))}${r === casa ? ' · residenza della corsa' : ''}</p>` + candidati.filter(a => a.residenza === r)
      .sort((a, b) => perDisponibilita(a, b) || G.gradoOf(a.agent)[2] - G.gradoOf(b.agent)[2] || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it')).map(riga).join('')).join('');
    return `<div class="slot-pop" id="slot-pop" role="dialog" aria-label="Aggiungi all'equipaggio">
      <div class="pop-head"><span class="pop-pallino" style="--g:#2dd4bf">+</span><div><b>Aggiungi all'equipaggio</b><small>${esc(code)} · ${crew.length} a bordo</small></div><button type="button" class="pop-x" data-act="menu-close" aria-label="Chiudi">✕</button></div>
      <input id="pop-q" class="pop-q" type="search" placeholder="Cerca per nome…" autocomplete="off" value="${esc(ui.q)}" aria-label="Cerca un collega">
      <p class="pop-res">Come</p><div class="pop-chips"><button type="button" class="pop-chip${ui.sovr ? '' : ' on'}" data-act="tipo" data-v="eq">Membro dell'equipaggio</button><button type="button" class="pop-chip${ui.sovr ? ' on' : ''}" data-act="tipo" data-v="sovr">Sovrannumero (${esc(code)}*)</button></div>
      ${gruppi || '<p class="pop-vuoto">Nessun agente da aggiungere.</p>'}</div>`;
  }
  function popoverPosto(code, crew, tutti, x) {
    const ids = new Set(crew.map(m => String(m.id)));
    const candidati = x.extra ? [] : tutti.filter(a => !ids.has(String(a.agent.id)) && puoCoprire(RUOLO[G.gradoOf(a.agent)[0]], x.ruolo));
    const casa = residenzaCorsa(code, crew, tutti);
    const residenze = [...new Set(candidati.map(a => a.residenza))].sort((a, b) => (b === casa) - (a === casa) || a.localeCompare(b, 'it'));
    const [sigla, colore, nomeRuolo] = RUOLO_INFO[x.ruolo] || RUOLO_INFO.marinaio;
    const riga = a => { const g = G.gradoOf(a.agent); return `<button type="button" class="pop-agente" data-act="pick" data-code="${code}" data-id="${esc(a.agent.id)}"><span class="pa-nome" style="color:${g[1]}">${esc(a.agent.agente)}</span><small>${esc(g[0] || '')}</small><span class="chip" data-code="${esc(a.turno || '—')}">${esc(a.turno || '—')}</span></button>`; };
    // prima i pari grado di tutte le residenze, poi i gradi superiori in salita; ogni blocco diviso per residenza
    const LIVELLO = { marinaio: 1, aiuto_motorista: 2, timoniere: 3, motorista: 3, capo_timoniere: 4, capitano: 5 };
    const ruoli = [...new Set(candidati.map(a => RUOLO[G.gradoOf(a.agent)[0]]))].sort((a, b) => (b === x.ruolo) - (a === x.ruolo) || LIVELLO[a] - LIVELLO[b]);
    const gruppi = ruoli.map(ruolo => {
      const nomeGrado = RUOLO_INFO[ruolo]?.[2] || ruolo;
      const titolo = `<p class="pop-tier" style="--g:${RUOLO_INFO[ruolo]?.[1] || '#e8f3f6'}">${ruolo === x.ruolo ? `Pari grado · ${esc(nomeGrado)}` : `Grado superiore · ${esc(nomeGrado)}`}</p>`;
      const dentro = candidati.filter(a => RUOLO[G.gradoOf(a.agent)[0]] === ruolo);
      const res = residenze.filter(r => dentro.some(a => a.residenza === r));
      return titolo + res.map(r => `<p class="pop-res">${esc(titoloRes(r))}${r === casa ? ' · residenza della corsa' : ''}</p>` +
        dentro.filter(a => a.residenza === r).sort((a, b) => perDisponibilita(a, b) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it')).map(riga).join('')).join('');
    }).join('');
    const dest = [...CAUSALI.map(([c, l]) => [c, c, l]), ...[...O.TURNI, 'BIS'].filter(c => c !== code).map(c => [c, c, `sulla ${c}`])];
    const chips = (act, scelto) => dest.map(([v, l, t]) => `<button type="button" class="pop-chip${scelto === v ? ' on' : ''}" data-act="${act}" data-code="${code}" data-v="${v}" title="${esc(t)}">${l}</button>`).join('');
    const sbarco = x.membro && candidati.length ? `<p class="pop-res">Se lo sostituisci, ${esc(x.membro.name)} va in</p><div class="pop-chips">${chips('sbarco', ui.sbarco)}</div>` : '';
    const fuori = x.membro ? `<p class="pop-res">Oppure toglilo senza sostituto</p><div class="pop-chips">${chips('out', '')}</div>` : '';
    return `<div class="slot-pop" id="slot-pop" role="dialog" aria-label="Cambia ${esc(nomeRuolo)}">
      <div class="pop-head"><span class="pop-pallino" style="--g:${colore}">${sigla}</span><div><b style="color:${colore}">${esc(nomeRuolo)}</b><small>${x.membro ? `ora ${esc(x.membro.name)}` : 'posto scoperto'}</small></div><button type="button" class="pop-x" data-act="menu-close" aria-label="Chiudi">✕</button></div>
      <input id="pop-q" class="pop-q" type="search" placeholder="Cerca per nome…" autocomplete="off" value="${esc(ui.q)}" aria-label="Cerca un collega">
      ${gruppi || (x.extra ? '' : '<p class="pop-vuoto">Nessun agente disponibile per questo grado.</p>')}${sbarco}${fuori}</div>`;
  }
  // Filtra l'elenco mentre si scrive: nasconde gli agenti che non corrispondono e le intestazioni rimaste vuote.
  function filtraPopover() {
    const pop = $('slot-pop');
    if (!pop) return;
    const q = G.norm(ui.q);
    const figli = [...pop.children];
    figli.forEach(el => { if (el.classList.contains('pop-agente')) el.hidden = !!q && !G.norm(el.textContent).includes(q); });
    const vuota = (da, ferma) => { const righe = []; for (let el = figli[da + 1]; el && !ferma(el); el = el.nextElementSibling) if (el.classList.contains('pop-agente')) righe.push(el); return righe.length > 0 && righe.every(r => r.hidden); };
    figli.forEach((el, i) => {
      if (el.classList.contains('pop-tier')) el.hidden = vuota(i, e => e.classList.contains('pop-tier') || e.classList.contains('pop-chips'));
      else if (el.classList.contains('pop-res')) el.hidden = vuota(i, e => e.classList.contains('pop-tier') || e.classList.contains('pop-res') || e.classList.contains('pop-chips'));
    });
    const nessuno = q && !figli.some(el => el.classList.contains('pop-agente') && !el.hidden);
    pop.querySelector('.pop-nessuno')?.remove();
    if (nessuno && figli.some(el => el.classList.contains('pop-agente'))) pop.querySelector('.pop-q').insertAdjacentHTML('afterend', '<p class="pop-vuoto pop-nessuno">Nessun collega con questo nome.</p>');
  }
  function posizionaPopover() {
    const pop = $('slot-pop'), lista = $('mov-list');
    const slot = ui.menu && lista.querySelector(`.slot[data-code="${ui.menu.code}"][data-i="${ui.menu.i}"]`);
    if (!pop || !slot) return;
    const l = lista.getBoundingClientRect(), r = slot.getBoundingClientRect();
    const left = Math.max(0, Math.min(l.width - pop.offsetWidth, r.left - l.left + r.width / 2 - pop.offsetWidth / 2));
    pop.style.left = `${left}px`;
    pop.style.top = `${r.bottom - l.top + 6}px`;
  }
  // Mette l'agente sul posto (chi c'era sbarca dove indicato) o toglie chi c'e'.
  async function cambiaPosto(code, valore, tipo) {
    const crew = G.equipaggi(state.schedule, state.day).navi[code] || [];
    const vecchio = posti(state.oggi[code]?.nave, state.day, crew)[ui.menu?.i]?.membro;
    ui.menu = null;
    if (tipo === 'out') { if (vecchio) await variazione(vecchio.id, valore, `${vecchio.name} tolto da ${code} (${valore}).`); return; }
    if (vecchio) await variazione(vecchio.id, ui.sbarco, `${vecchio.name} tolto da ${code} (${ui.sbarco}).`);
    const nome = agenti(state.day).find(a => String(a.agent.id) === String(valore))?.agent.agente || '';
    await variazione(valore, code, `${nome} messo sulla ${code}${vecchio ? ` al posto di ${vecchio.name}` : ''}.`);
  }

  // Cambi d'equipaggio fatti dal Movimento che toccano la corsa (arrivi o sbarchi): agenti da ripristinare.
  function cambiCorsa(code, day) {
    const ids = new Map();
    (state.schedule?.variazioni_ods || []).forEach(v => {
      if (v?.ods !== 'MOVIMENTO' || String(v.data).slice(0, 10) !== day) return;
      if (String(v.turno_nuovo || '').toUpperCase().replace(/\*$/, '') === code || String(v.turno_originale || '').toUpperCase() === code) ids.set(String(v.id_agente), v.agente);
    });
    return [...ids.entries()].map(([id, nome]) => ({ id, nome }));
  }
  // Ripristina i turni previsti: toglie le variazioni del Movimento degli agenti coinvolti, una alla volta.
  async function ripristinaEquipaggio(code) {
    const cambi = cambiCorsa(code, state.day);
    if (!cambi.length) return;
    if (!confirm(`Ripristinare i turni previsti per ${cambi.map(c => c.nome).join(', ')}?`)) return;
    for (const c of cambi) await variazione(c.id, '', `${c.nome}: turno ripristinato.`);
    setStatus(`${code}: equipaggio ripristinato (${cambi.length} ${cambi.length === 1 ? 'cambio annullato' : 'cambi annullati'}).`, 'ok');
  }

  // ---------------- Render ----------------
  function render() {
    const day = state.day;
    if (!state.schedule) { $('mov-list').innerHTML = '<p class="empty">Caricamento turni…</p>'; return; }
    const codes = turniCodici(day);
    $('mov-count').textContent = String(codes.length);
    const righe = righeNavi();
    const oggi = T.turniDelGiorno(righe, day);
    state.oggi = oggi;
    const ieri = T.turniDelGiorno(righe, addDays(day, -1));
    const crews = G.equipaggi(state.schedule, day).navi;
    const tutti = agenti(day);
    const navi = [...new Set([...Object.values(state.fleet).filter(s => s?.attiva !== false).map(s => String(s.nome || '').trim()),
      ...righe.flatMap(row => nomiNave(row?.nave))].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    const datalists = `<datalist id="mov-navi">${navi.map(n => `<option value="${esc(n)}">`).join('')}</datalist>` +
      `<datalist id="mov-ormeggi">${PONTILI.map(p => `<option value="${p}">`).join('')}</datalist>`;
    const cards = codes.map(code => card(code, day, oggi[code] || {}, ieri[code] || {}, crews[code] || [], tutti)).join('');
    const ferme = turniFermi(day).map(code => {
      const info = C?.info?.(code, day);
      return `<article class="mov-turno ferma"><div class="mov-head"><span class="chip" data-code="${code}">${code}</span><div class="mov-sum"><b>Corsa ferma</b><small>${info?.trips ? `corse ${esc(info.trips)}` : 'non in servizio in questo periodo'}</small></div></div></article>`;
    }).join('');
    $('mov-list').innerHTML = datalists + (cards || '<p class="empty">Nessun turno nave in servizio in questo giorno.</p>') + ferme;
    if (ui.menu) {
      const c = ui.menu.code, crew = crews[c] || [];
      const x = codes.includes(c) ? posti(oggi[c]?.nave, day, crew)[ui.menu.i] : null;
      if (ui.menu.i === -1 && codes.includes(c)) { $('mov-list').insertAdjacentHTML('beforeend', popoverAggiunta(c, crew, tutti)); filtraPopover(); posizionaPopover(); $('pop-q')?.focus(); }
      else if (x) { $('mov-list').insertAdjacentHTML('beforeend', popoverPosto(c, crew, tutti, x)); filtraPopover(); posizionaPopover(); $('pop-q')?.focus(); } else ui.menu = null;
    }
  }

  function card(code, day, r, ieri, crew, tutti) {
    const info = C?.info?.(code, day) || {};
    const orari = info.firstDeparture ? `${clock(info.firstDeparture)} → ${clock(info.lastArrival)}` : '';
    const corse = info.trips ? `corse ${esc(info.trips)}` : code === 'BIS' ? 'a disposizione' : '';
    const comandante = G.comandante(crew);
    const min = minimo(r.nave, day, crew);
    const avviso = min && min.mancano.length > 0;
    const open = ui.open === code;
    let azioni;
    if (r.sospesa) {
      azioni = `<span class="mov-sospesa" title="${esc(r.motivo)}">SOSPESA${r.motivo ? ` · ${esc(r.motivo)}` : ''}</span><button class="btn primary" type="button" data-act="resume" data-code="${code}">Ripristina corse</button>`;
    } else if (ui.suspending === code) {
      azioni = `<input class="mov-motivo" id="mov-motivo" placeholder="Motivo (es. lago mosso)" autocomplete="off"><button class="btn danger" type="button" data-act="confirm-suspend" data-code="${code}">Sospendi tutte le corse</button><button class="btn ghost" type="button" data-act="cancel-suspend">Annulla</button>`;
    } else {
      azioni = `<button class="btn danger" type="button" data-act="suspend" data-code="${code}">Sospendi corse</button>`;
    }
    if (r.movimento) azioni += `<button class="btn ghost" type="button" data-act="restore" data-code="${code}" title="Torna a nave e ormeggi dell'O.d.S. e toglie la sospensione (ritardi${code === 'BIS' ? ' e incarichi del BIS' : ''} restano)">↺ O.d.S.</button>`;
    if (code !== 'BIS' && O.inServizio('BIS', day)) azioni += `<button class="btn ghost" type="button" data-act="bis-form" data-code="${code}" title="Il BIS sostituisce questa nave o fa corse in aiuto">⇄ BIS</button>`;
    if (cambiCorsa(code, day).length) azioni += `<button class="btn ghost" type="button" data-act="crew-reset" data-code="${code}" title="Ripristina i turni previsti: annulla i cambi d'equipaggio del Movimento su questa corsa">↺ Ripristina equipaggio</button>`;
    const bis = code === 'BIS' ? [] : (state.oggi.BIS?.incarichi || []).filter(inc => inc.turno === code);
    const bisBadge = bis.map(inc => `<span class="mov-bis-badge">BIS ${inc.tipo === 'aiuto' ? 'in aiuto' : 'al posto della nave'} · ${incaricoCorse(inc)}</span>`).join('');
    const attive = Object.values(state.fleet).filter(x => x?.attiva !== false).map(x => String(x.nome || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'it'));
    const usate = Object.fromEntries(Object.entries(state.oggi).filter(([c, v]) => c !== code && v?.nave).flatMap(([c, v]) => nomiNave(v.nave).map(n => [n.toUpperCase(), c])));
    const nomi = r.nave && !attive.some(n => stessaNave(n, r.nave)) ? [...nomiNave(r.nave), ...attive] : attive;
    const ordinate = [...nomi.filter(n => !usate[n.toUpperCase()]), ...nomi.filter(n => usate[n.toUpperCase()])];
    const nave = `<select class="mov-nave-tag${r.nave ? '' : ' vuota'}" data-code="${code}" data-f="nave" aria-label="Nave della ${code}"><option value=""${r.nave ? '' : ' selected'}>nave da assegnare</option>${ordinate.map(n => `<option value="${esc(n)}"${stessaNave(n, r.nave) ? ' selected' : ''}>${esc(n)}${usate[n.toUpperCase()] ? ` (ora ${usate[n.toUpperCase()]})` : ''}</option>`).join('')}</select>`;
    const stato = r.sospesa ? '<span class="mov-sospesa">SOSPESA</span>' : '';
    return `<article class="mov-turno${r.sospesa ? ' sospesa' : ''}${open ? ' open' : ''}" data-turno="${code}">
      <div class="mov-head" role="button" tabindex="0" data-act="open" data-code="${code}" aria-expanded="${open}">
        <span class="chip" data-code="${code}">${code}</span>
        <span class="mov-sum"><b>${orari || 'a disposizione'}</b><small>${corse}${r.movimento && modificaOds(code, day, r) ? ' · <em>modificato dal Movimento</em>' : ''}${r.ritardi ? ` · <em class="mov-rit">⏱ ${ritardiTesto(r.ritardi)}</em>` : ''}${r.corseSospese?.length ? ` · ⏸ ${r.corseSospese.length} sospese` : ''}</small>${bisBadge}</span>
        ${nave}${stato}
        <span class="mov-slots">${r.nave || crew.length ? pallini(code, posti(r.nave, day, crew)) : ''}${avviso ? '<span class="mov-warn" title="Equipaggio sotto il minimo">⚠</span>' : ''}</span>
        <span class="mov-chev">${open ? '▴' : '▾'}</span>
      </div>
      ${open ? `<div class="mov-azioni">${azioni}</div>` : ''}
      ${code === 'BIS' && open ? bisPanel(day, r) : ''}
      ${open ? ritardiPanel(code, day, r) + bolle(code, r, ieri) : ''}
    </article>`;
  }

  // Ritardi: per ogni corsa del turno in orario, +5' ... +2h a scatti di 5 minuti, oltre 2 ore. Il
  // ritardo passa da solo alle corse successive se la nave arriva dopo la loro partenza.
  const RITARDI = [...Array.from({ length: 24 }, (_, i) => String((i + 1) * 5)), 'oltre'];
  const ritardoValore = r => (!r ? '' : r.oltre ? 'oltre' : String(r.minuti));
  // "c. 14 +1h" per i primi ritardi del turno, poi "+N".
  function ritardiTesto(map) {
    const voci = Object.entries(map).map(([corsa, x]) => `c. ${corsa} ${O.testoRitardo(x)}`);
    return voci.slice(0, 3).join(', ') + (voci.length > 3 ? ` +${voci.length - 3}` : '');
  }
  // Colore del ritardo: verde in orario, giallo fino a 15', arancio fino a 45', rosso oltre; viola oltre 2 ore.
  const livelloRitardo = rit => (!rit ? 'ok' : rit.oltre ? 'max' : rit.minuti <= 15 ? 'l1' : rit.minuti <= 45 ? 'l2' : 'l3');
  function ritardiPanel(code, day, r) {
    const corse = O.corseDelTurno(code, day);
    if (!corse.length) return '';
    const effettive = O.corseDelTurno(code, day, r.ritardi);
    const inRitardo = effettive.filter(c => c.ritardo && !(r.corseSospese || []).includes(String(c.numero))).length;
    const tessere = corse.map((c, i) => {
      const proprio = r.ritardi?.[c.numero];
      const eff = effettive[i];
      const opzioni = `<option value="">in orario</option>${RITARDI.map(v => `<option value="${v}"${v === ritardoValore(proprio) ? ' selected' : ''}>${v === 'oltre' ? 'oltre 2 ore' : O.testoRitardo({ minuti: Number(v) })}</option>`).join('')}`;
      const nota = eff.ritardo?.propagato ? `dalla corsa prima · parte ${esc(eff.scali[0][1])}` : proprio ? `parte ${esc(eff.scali[0][1])}, arriva ${esc(eff.scali[eff.scali.length - 1][1])}` : '';
      const ultimo = c.scali[c.scali.length - 1];
      const sospesa = (r.corseSospese || []).includes(String(c.numero));
      const bisDisp = code !== 'BIS' && O.inServizio('BIS', day);
      const perBis = code !== 'BIS' ? O.bisPerCorsa(state.oggi.BIS?.incarichi, code, c.numero, day) : null;
      const chiede = ui.sospCorsa?.code === code && ui.sospCorsa.corsa === String(c.numero);
      const successive = corse.slice(i).filter(x => !(r.corseSospese || []).includes(String(x.numero))).length;
      const azione = sospesa ? `<button type="button" class="btn ghost rit-sosp" data-act="corsa-riprendi" data-code="${code}" data-corsa="${esc(c.numero)}">↺ Ripristina corsa</button>`
        : chiede ? `<div class="rit-chiedi"><b>${ui.sospBis && bisDisp ? 'Assegnare al BIS…' : 'Sospendere…'}</b>` +
          `${bisDisp ? `<label class="rit-bis"><input type="checkbox" data-sosp-bis${ui.sospBis ? ' checked' : ''}> Assegna al BIS (la fa il BIS, non viene sospesa)</label>` : ''}` +
          `<button type="button" class="btn danger" data-act="corsa-sospendi" data-code="${code}" data-corsa="${esc(c.numero)}" data-quali="una">${ui.sospBis && bisDisp ? 'BIS solo sulla' : 'solo la'} corsa ${esc(c.numero)}</button>` +
          `${successive > 1 || (ui.sospBis && bisDisp && corse.length - i > 1) ? `<button type="button" class="btn danger" data-act="corsa-sospendi" data-code="${code}" data-corsa="${esc(c.numero)}" data-quali="succ">${ui.sospBis && bisDisp ? 'BIS sulla' : 'la'} ${esc(c.numero)} e le ${(ui.sospBis && bisDisp ? corse.length - i : successive) - 1} successive</button>` : ''}` +
          `<button type="button" class="btn ghost" data-act="corsa-annulla">Annulla</button></div>`
        : `<button type="button" class="btn danger rit-sosp" data-act="corsa-chiedi" data-code="${code}" data-corsa="${esc(c.numero)}">Sospendi corsa</button>`;
      return `<div class="rit-tile ${sospesa ? 'sosp' : livelloRitardo(eff.ritardo)}${eff.ritardo?.propagato && !sospesa ? ' prop' : ''}${perBis ? ' bis' : ''}">
        <div class="rit-top"><b>c. ${esc(c.numero)}</b><span class="rit-badge">${sospesa ? 'SOSPESA' : eff.ritardo ? esc(O.testoRitardo(eff.ritardo)) : 'in orario'}</span>${perBis ? '<span class="rit-bis-tag" title="La fa il BIS al posto della nave">BIS</span>' : ''}${azione.includes('rit-chiedi') ? '' : azione}</div>
        <div class="rit-rotta"><span>${esc(c.scali[0][1])}</span> ${esc(c.scali[0][0])} <i>→</i> <span>${esc(ultimo[1])}</span> ${esc(ultimo[0])}</div>
        ${chiede ? azione : ''}
        ${sospesa ? '' : `<select data-act="ritardo" data-code="${code}" data-corsa="${esc(c.numero)}" aria-label="Ritardo della corsa ${esc(c.numero)}">${opzioni}</select>`}
        ${nota && !sospesa ? `<small>${nota}</small>` : ''}</div>`;
    }).join('');
    return `<div class="mov-ritardi"><p class="mov-bis-title">⏱ Ritardi delle corse${inRitardo ? ` <span class="rit-tot">${inRitardo} in ritardo</span>` : ''}${(r.corseSospese || []).length ? ` <span class="rit-tot sosp">${r.corseSospese.length} sospese</span>` : ''}</p><div class="rit-grid">${tessere}</div></div>`;
  }
  // Ormeggi e rifornimento come bolle colorate, in fondo al dettaglio della corsa.
  function bolle(code, r, ieri) {
    const ph = ieri.ormeggio ? `${ieri.ormeggio} (sera prima)` : '—';
    return `<div class="mov-bolle">
      <label class="bolla b-mattina"><span>⚓ Ormeggio mattino</span><input data-code="${code}" data-f="ormeggio_mattino" value="${esc(r.ormeggioMattino || '')}" list="mov-ormeggi" placeholder="${esc(ph)}" autocomplete="off"></label>
      <label class="bolla b-sera"><span>🌙 Ormeggio sera</span><input data-code="${code}" data-f="ormeggio_serale" value="${esc(r.ormeggio || '')}" list="mov-ormeggi" placeholder="—" autocomplete="off"></label>
      <label class="bolla b-rif${r.rif ? ' on' : ''}" title="Rifornimento la mattina"><input type="checkbox" data-code="${code}" data-f="rif"${r.rif ? ' checked' : ''}><span>⛽ Rifornimento ${r.rif ? 'previsto' : 'mattina'}</span></label>
    </div>`;
  }
  const ritardiLista = map => Object.entries(map || {}).map(([corsa, r]) => ({ corsa, minuti: r.minuti, oltre: !!r.oltre }));

  // ---------------- BIS ----------------
  // Il BIS (servizio di emergenza) sostituisce la nave di un turno dalla corsa scelta fino a nuovo
  // ordine (o fino a una corsa), oppure fa corse in aiuto a un altro turno (corse aggiuntive).
  const etichettaCorsa = c => `c. ${c.numero} · ${c.scali[0][1]} ${c.scali[0][0]} → ${c.scali[c.scali.length - 1][0]}`;
  function incaricoCorse(inc) {
    const corse = O.corseIncarico(inc, state.day);
    if (!corse.length) return `corsa ${esc(inc.dalla)}`;
    const da = corse[0].numero, a = corse[corse.length - 1].numero;
    return `${da === a ? `corsa ${esc(da)}` : `corse ${esc(da)}–${esc(a)}`}${inc.tipo !== 'aiuto' && !inc.alla ? ' · fino a nuovo ordine' : ''}`;
  }
  // Prima corsa del turno non ancora partita (oggi), altrimenti la prima.
  function prossimaCorsa(turno, day) {
    const corse = O.corseDelTurno(turno, day);
    const now = new Date();
    if (day !== iso(now)) return corse[0]?.numero || '';
    const ora = now.getHours() * 60 + now.getMinutes();
    return (corse.find(c => O.minutes(c.scali[0][1]) >= ora) || corse[corse.length - 1])?.numero || '';
  }
  function bisPanel(day, r) {
    const incarichi = r.incarichi || [];
    const lista = incarichi.map((inc, i) => {
      const corse = O.corseDelTurno(inc.turno, day);
      const nave = state.oggi[inc.turno]?.nave;
      const titolo = inc.tipo === 'aiuto' ? `In aiuto alla ${esc(inc.turno)}` : `Al posto della ${esc(inc.turno)}${nave ? ` (${esc(nave)})` : ''}`;
      const k = corse.findIndex(c => c.numero === String(inc.dalla));
      const riprende = inc.tipo !== 'aiuto' && !inc.alla && k >= 0 && k < corse.length - 1
        ? `<select data-act="bis-riprende" data-i="${i}" aria-label="La nave riprende dalla corsa"><option value="">La nave riprende dalla corsa…</option>${corse.slice(k + 1).map(c => `<option value="${esc(c.numero)}">${esc(etichettaCorsa(c))}</option>`).join('')}</select>` : '';
      const riapri = inc.tipo !== 'aiuto' && inc.alla ? `<button class="btn ghost" type="button" data-act="bis-riapri" data-i="${i}" title="Il BIS continua fino a nuovo ordine">Fino a nuovo ordine</button>` : '';
      return `<li><span class="chip" data-code="${esc(inc.turno)}">${esc(inc.turno)}</span><div><b>${titolo}</b><small>${incaricoCorse(inc)}${inc.alla && inc.tipo !== 'aiuto' ? ` · la nave riprende dopo la corsa ${esc(inc.alla)}` : ''}</small></div>` +
        `<span class="mov-crew-act">${riprende}${riapri}<button class="btn danger" type="button" data-act="bis-del" data-i="${i}">Togli</button></span></li>`;
    }).join('');
    const f = ui.bisForm || {};
    const turni = turniCodici(day).filter(c => c !== 'BIS');
    const turno = turni.includes(f.turno) ? f.turno : turni[0] || '';
    const corse = turno ? O.corseDelTurno(turno, day) : [];
    const dalla = corse.some(c => c.numero === f.dalla) ? f.dalla : prossimaCorsa(turno, day);
    const tipo = f.tipo === 'aiuto' ? 'aiuto' : 'sostituzione';
    const k = corse.findIndex(c => c.numero === dalla);
    const alla = corse.slice(k).some(c => c.numero === f.alla) ? f.alla : tipo === 'aiuto' ? dalla : '';
    const opt = (list, sel) => list.map(c => `<option value="${esc(c.numero)}"${c.numero === sel ? ' selected' : ''}>${esc(etichettaCorsa(c))}</option>`).join('');
    const form = turno ? `<div class="mov-bis-form">
        <label><span>Il BIS</span><select data-bis="tipo"><option value="sostituzione"${tipo === 'sostituzione' ? ' selected' : ''}>sostituisce la nave del turno</option><option value="aiuto"${tipo === 'aiuto' ? ' selected' : ''}>fa corse in aiuto al turno</option></select></label>
        <label><span>Turno</span><select data-bis="turno">${turni.map(c => `<option${c === turno ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
        <label><span>Dalla corsa</span><select data-bis="dalla">${opt(corse, dalla)}</select></label>
        <label><span>Fino alla corsa</span><select data-bis="alla">${tipo === 'sostituzione' ? `<option value=""${alla ? '' : ' selected'}>fino a nuovo ordine</option>` : ''}${opt(corse.slice(Math.max(0, k)), alla)}</select></label>
        <button class="btn primary" type="button" data-act="bis-add">Assegna al BIS</button>
      </div>` : '<p class="mov-min">Nessun turno nave in servizio da affiancare.</p>';
    // Il BIS non puo' fare due corse insieme: avviso se gli incarichi si sovrappongono negli orari
    const corseBis = O.corseBis(incarichi, day);
    const fine = c => O.minutes(c.scali[c.scali.length - 1][1]);
    const sovrapposte = corseBis.slice(1).map((c, i) => [corseBis[i], c]).filter(([prima, c]) => O.minutes(c.scali[0][1]) < fine(prima))
      .map(([prima, c]) => `corsa ${c.numero} (${c.per}) e corsa ${prima.numero} (${prima.per})`);
    const avviso = sovrapposte.length ? `<p class="mov-min warn">⚠ Incarichi sovrapposti negli orari: ${esc(sovrapposte.join(', '))}.</p>` : '';
    return `<div class="mov-bis" id="mov-bis"><p class="mov-bis-title">Incarichi del BIS · servizio di emergenza</p>${lista ? `<ul>${lista}</ul>` : '<p class="mov-min">Nessun incarico: il BIS è a disposizione.</p>'}${avviso}${form}</div>`;
  }
  function salvaIncarichi(incarichi, messaggio) {
    return salva('BIS', { incarichi }, messaggio);
  }

  // ---------------- Eventi ----------------
  const list = $('mov-list');
  list.addEventListener('change', event => {
    const el = event.target;
    const code = el.dataset.code;
    if (el.matches('[data-sosp-bis]')) { ui.sospBis = el.checked; render(); return; }
    if (el.dataset.f === 'rif') { salva(code, { rifornimento_mattina: el.checked }, `${code}: rifornimento ${el.checked ? 'previsto' : 'tolto'}.`); return; }
    if (el.dataset.f) {
      const value = el.value.trim();
      const nomi = { nave: 'nave', ormeggio_mattino: 'ormeggio del mattino', ormeggio_serale: 'ormeggio della sera' };
      salva(code, { [el.dataset.f]: value }, `${code}: ${nomi[el.dataset.f]} ${value || 'tolto'}.`);
      return;
    }
    if (el.dataset.act === 'ritardo') {
      const r = state.oggi[code] || {};
      const ritardi = ritardiLista(r.ritardi).filter(x => x.corsa !== el.dataset.corsa);
      if (el.value) ritardi.push({ corsa: el.dataset.corsa, minuti: el.value === 'oltre' ? 120 : Number(el.value), oltre: el.value === 'oltre' });
      salva(code, { ritardi }, el.value ? `${code} corsa ${el.dataset.corsa}: ritardo ${O.testoRitardo({ minuti: Number(el.value), oltre: el.value === 'oltre' })}.` : `${code} corsa ${el.dataset.corsa}: in orario.`);
      return;
    }
    if (el.dataset.bis) {
      ui.bisForm = { ...(ui.bisForm || {}), turno: ui.bisForm?.turno || el.closest('.mov-bis-form').querySelector('[data-bis=turno]').value, [el.dataset.bis]: el.value };
      if (el.dataset.bis === 'turno') { ui.bisForm.dalla = ''; ui.bisForm.alla = ''; }
      if (el.dataset.bis === 'tipo' || el.dataset.bis === 'dalla') ui.bisForm.alla = '';
      render();
      return;
    }
    if (el.dataset.act === 'bis-riprende' && el.value) {
      const incarichi = [...(state.oggi.BIS?.incarichi || [])];
      const inc = incarichi[Number(el.dataset.i)];
      const corse = O.corseDelTurno(inc.turno, state.day);
      const k = corse.findIndex(c => c.numero === el.value);
      if (k <= 0 || corse[k - 1].numero === undefined) return;
      incarichi[Number(el.dataset.i)] = { ...inc, alla: corse[k - 1].numero };
      salvaIncarichi(incarichi, `${inc.turno}: la nave riprende dalla corsa ${el.value}; il BIS fa fino alla corsa ${corse[k - 1].numero}.`);
      return;
    }
  });
  list.addEventListener('input', event => { if (event.target.id === 'pop-q') { ui.q = event.target.value; filtraPopover(); posizionaPopover(); } });
  list.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.id === 'pop-q') { const visibili = [...document.querySelectorAll('#slot-pop .pop-agente')].filter(el => !el.hidden); if (visibili.length === 1) visibili[0].click(); return; }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList?.contains('mov-head')) { event.preventDefault(); event.target.click(); return; }
    if (event.key === 'Enter' && event.target.matches('input[data-f]')) event.target.blur();
    if (event.key === 'Enter' && event.target.id === 'mov-motivo') list.querySelector('[data-act="confirm-suspend"]')?.click();
  });
  list.addEventListener('click', event => {
    if (event.target.closest('select')) return;
    if (event.target.closest('.slot-pop') && !event.target.closest('button[data-act]')) return;
    const button = event.target.closest('button[data-act], .mov-head[data-act]');
    if (!button) return;
    const code = button.dataset.code;
    const act = button.dataset.act;
    if (act === 'open') { ui.open = ui.open === code ? '' : code; ui.menu = null; render(); }
    else if (act === 'slot') { const i = Number(button.dataset.i); ui.q = ''; ui.menu = ui.menu?.code === code && ui.menu.i === i ? null : { code, i }; render(); }
    else if (act === 'menu-close') { ui.menu = null; ui.q = ''; render(); }
    else if (act === 'pick') cambiaPosto(code, button.dataset.id, 'pick');
    else if (act === 'tipo') { ui.sovr = button.dataset.v === 'sovr'; render(); }
    else if (act === 'aggiungi') {
      const sovr = ui.sovr;
      ui.menu = null; ui.sovr = false;
      const nome = agenti(state.day).find(a => String(a.agent.id) === String(button.dataset.id))?.agent.agente || '';
      variazione(button.dataset.id, sovr ? `${code}*` : code, `${nome} aggiunto alla ${code}${sovr ? ' in sovrannumero (' + code + '*)' : ''}.`, { aggiunto: true, sovrannumero: sovr });
    }
    else if (act === 'out') cambiaPosto(code, button.dataset.v, 'out');
    else if (act === 'sbarco') { ui.sbarco = button.dataset.v; render(); }
    else if (act === 'crew-reset') ripristinaEquipaggio(code);
    else if (act === 'corsa-chiedi') { ui.sospCorsa = { code, corsa: button.dataset.corsa }; render(); }
    else if (act === 'corsa-annulla') { ui.sospCorsa = null; ui.sospBis = false; render(); }
    else if (act === 'corsa-sospendi' || act === 'corsa-riprendi') {
      const corsa = button.dataset.corsa;
      const gia = state.oggi[code]?.corseSospese || [];
      const tutte = O.corseDelTurno(code, state.day).map(x => String(x.numero));
      if (act === 'corsa-sospendi' && ui.sospBis && O.inServizio('BIS', state.day) && code !== 'BIS') {
        // al BIS: fa le corse al posto della nave (come in "⇄ BIS"), non sono sospese
        const nuove = button.dataset.quali === 'succ' ? tutte.slice(tutte.indexOf(corsa)) : [corsa];
        const incarichi = [...(state.oggi.BIS?.incarichi || [])].filter(x => !(x.tipo !== 'aiuto' && x.turno === code && nuove.some(n => O.corseIncarico(x, state.day).some(cc => cc.numero === n))));
        incarichi.push({ tipo: 'sostituzione', turno: code, dalla: corsa, alla: button.dataset.quali === 'succ' ? '' : corsa });
        ui.sospCorsa = null; ui.sospBis = false;
        const msg = button.dataset.quali === 'succ' ? `Il BIS fa la ${code} dalla corsa ${corsa} fino a nuovo ordine.` : `Il BIS fa la corsa ${corsa} della ${code}.`;
        (async () => {
          if (!(await salva('BIS', { incarichi }, msg))) return;
          const restano = gia.filter(n => !nuove.includes(n));
          if (restano.length !== gia.length) await salva(code, { corse_sospese: restano }, msg);
        })();
        return;
      }
      let lista, msg;
      if (act === 'corsa-riprendi') { lista = gia.filter(n => n !== corsa); msg = `${code}: corsa ${corsa} ripristinata.`; }
      else {
        const nuove = button.dataset.quali === 'succ' ? tutte.slice(tutte.indexOf(corsa)) : [corsa];
        lista = [...new Set([...gia, ...nuove])];
        msg = nuove.length > 1 ? `${code}: sospese le corse ${nuove[0]}–${nuove[nuove.length - 1]}.` : `${code}: sospesa la corsa ${corsa}.`;
      }
      ui.sospCorsa = null;
      salva(code, { corse_sospese: lista }, msg);
    }
    else if (act === 'suspend') { ui.suspending = code; render(); $('mov-motivo')?.focus(); }
    else if (act === 'cancel-suspend') { ui.suspending = ''; render(); }
    else if (act === 'confirm-suspend') {
      const motivo = $('mov-motivo')?.value.trim() || '';
      ui.suspending = '';
      salva(code, { sospesa: true, sospesa_motivo: motivo, sospesa_il: new Date().toISOString() }, `${code}: tutte le corse sospese${motivo ? ` (${motivo})` : ''}.`);
    } else if (act === 'resume') salva(code, { sospesa: false, sospesa_motivo: '' }, `${code}: corse ripristinate.`);
    else if (act === 'restore') ripristina(code);
    else if (act === 'bis-form') {
      ui.bisForm = { tipo: 'sostituzione', turno: code };
      render();
      $('mov-bis')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (act === 'bis-add') {
      const form = button.closest('.mov-bis-form');
      const value = name => form.querySelector(`[data-bis=${name}]`).value;
      const inc = { tipo: value('tipo'), turno: value('turno'), dalla: value('dalla'), alla: value('alla') };
      if (!inc.turno || !inc.dalla) return;
      // una sola sostituzione per turno: la nuova prende il posto della precedente
      const incarichi = (state.oggi.BIS?.incarichi || []).filter(x => !(inc.tipo === 'sostituzione' && x.tipo !== 'aiuto' && x.turno === inc.turno));
      ui.bisForm = null;
      const nave = state.oggi[inc.turno]?.nave;
      salvaIncarichi([...incarichi, inc], inc.tipo === 'aiuto'
        ? `BIS in aiuto alla ${inc.turno}: ${incaricoCorse(inc)}.`
        : `Il BIS sostituisce ${nave || 'la nave'} sulla ${inc.turno}: ${incaricoCorse(inc)}.`);
    } else if (act === 'bis-del') {
      const incarichi = [...(state.oggi.BIS?.incarichi || [])];
      const [tolto] = incarichi.splice(Number(button.dataset.i), 1);
      salvaIncarichi(incarichi, `Incarico del BIS sulla ${tolto?.turno || ''} tolto.`);
    } else if (act === 'bis-riapri') {
      const incarichi = [...(state.oggi.BIS?.incarichi || [])];
      const i = Number(button.dataset.i);
      incarichi[i] = { ...incarichi[i], alla: '' };
      salvaIncarichi(incarichi, `Il BIS continua sulla ${incarichi[i].turno} fino a nuovo ordine.`);
    }
  });

  // Il menu si chiude toccando fuori o con Esc.
  document.addEventListener('click', event => { if (ui.menu && !event.target.closest('.slot-pop, .slot')) { ui.menu = null; render(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.menu) { ui.menu = null; render(); } });
  window.addEventListener('resize', posizionaPopover);
  NM.vista('corse', render, { onDay: () => { ui.open = ''; ui.suspending = ''; ui.bisForm = null; ui.menu = null; ui.sospCorsa = null; } });
})();
