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
  const RUOLO = { Capitano: 'capitano', 'Capo timoniere': 'capo_timoniere', Timoniere: 'timoniere', Motorista: 'motorista', 'Aiuto motorista': 'aiuto_motorista', Marinaio: 'marinaio' };
  const RUOLI = [['capitano', 'capitano', 'capitani'], ['capo_timoniere', 'capo timoniere', 'capi timonieri'], ['timoniere', 'timoniere', 'timonieri'],
    ['motorista', 'motorista', 'motoristi'], ['aiuto_motorista', 'aiuto motorista', 'aiuto motoristi'], ['marinaio', 'marinaio', 'marinai']];

  const state = NM.state;
  const ui = { open: '', suspending: '', fermando: '', bisForm: null, sbarco: 'RIP', menu: null, sovr: false, q: '', sospCorsa: null, destAperto: false, togliDest: 'RIP' };

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
  const RUOLO_INFO = { capitano: ['Cap', '#facc15', 'Capitano'], capo_timoniere: ['CT', '#fb923c', 'Capo timoniere'], timoniere: ['Tim', '#22c55e', 'Timoniere'],
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
    // i sovrannumero non occupano posti: restano in fondo all'equipaggio con l'asterisco
    const normali = crew.filter(m => !isSovr(m));
    const aggiunti = normali.filter(m => variazione(m)?.aggiunto).map(m => RUOLO[m.grado[0]] || 'marinaio');
    const slot = periodo ? [...RUOLI.flatMap(([key]) => Array(Math.max(0, Number(periodo.equipaggio?.[key]) || 0)).fill(key)), ...aggiunti] : normali.map(m => RUOLO[m.grado[0]] || 'marinaio');
    const liberi = [...normali];
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
    liberi.forEach(m => out.push({ ruolo: RUOLO[m.grado[0]] || 'marinaio', membro: m, adattato: false, extra: true, sovr: false }));
    crew.filter(isSovr).forEach(m => out.push({ ruolo: RUOLO[m.grado[0]] || 'marinaio', membro: m, adattato: false, extra: true, sovr: true }));
    // in ordine gerarchico del grado di chi c'e' (anche se a bordo copre un posto piu' basso); i posti vuoti secondo il loro grado;
    // i sovrannumero restano in fondo
    const RANGO = { capitano: 0, capo_timoniere: 1, motorista: 2, timoniere: 3, aiuto_motorista: 4, marinaio: 5 };
    const rango = x => RANGO[x.membro ? (RUOLO[x.membro.grado[0]] || 'marinaio') : x.ruolo] ?? 9;
    const base = out.filter(x => !x.sovr).map((x, i) => [x, i]).sort((a, b) => rango(a[0]) - rango(b[0]) || a[1] - b[1]).map(a => a[0]);
    return [...base, ...out.filter(x => x.sovr)];
  }
  function pallini(code, lista) {
    return lista.map((x, i) => {
      const [sigla, colore, nomeRuolo] = RUOLO_INFO[x.ruolo] || RUOLO_INFO.marinaio;
      const nome = x.membro ? `<span class="slot-nome" style="color:${x.membro.grado[1]}">${esc(cognome(x.membro.name))}</span>` : '<span class="slot-nome vuoto">vuoto</span>';
      const titolo = `${nomeRuolo}${x.membro ? `: ${x.membro.name}${x.adattato ? ` (fa da ${nomeRuolo.toLowerCase()})` : ''}${x.sovr ? ' (sovrannumero)' : ''}` : ': posto scoperto'} — tocca per cambiare`;
      const aperto = ui.menu?.code === code && ui.menu.i === i;
      return `<button type="button" class="slot${x.membro ? '' : ' manca'}${x.adattato ? ' adattato' : ''}${x.extra ? ' extra' : ''}${x.sovr ? ' sovr' : ''}${aperto ? ' aperto' : ''}" style="--g:${colore}" data-act="slot" data-code="${code}" data-i="${i}" title="${esc(titolo)}">` +
        `<span class="slot-pallino">${sigla}${x.sovr ? '*' : ''}</span>${nome}</button>`;
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
    const lettera = G.terraResidenza?.(code) || (code[0] === 'D' ? 'DESENZANO' : /^[MT]/.test(code) ? 'MADERNO' : '');
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
    // ordine gerarchico (comandanti, capi timonieri, motoristi, timonieri, aiuto motoristi, marinai); dentro ogni grado per
    // residenza (prima quella della corsa) e poi per disponibilita'
    const GERARCHIA = ['capitano', 'capo_timoniere', 'motorista', 'timoniere', 'aiuto_motorista', 'marinaio'];
    const ruoloDi = a => RUOLO[G.gradoOf(a.agent)[0]] || 'marinaio';
    const gruppi = GERARCHIA.filter(ruolo => candidati.some(a => ruoloDi(a) === ruolo)).map(ruolo => {
      const dentro = candidati.filter(a => ruoloDi(a) === ruolo);
      const [, colore, nomeGrado] = RUOLO_INFO[ruolo];
      return `<p class="pop-tier" style="--g:${colore}">${esc(nomeGrado)}</p>` + residenze.filter(r => dentro.some(a => a.residenza === r)).map(r => `<p class="pop-res sub" style="--g:${colore}">${esc(titoloRes(r))} · ${dentro.filter(a => a.residenza === r).length}${r === casa ? ' · residenza della corsa' : ''}</p>` +
        dentro.filter(a => a.residenza === r).sort((a, b) => perDisponibilita(a, b) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it')).map(riga).join('')).join('');
    }).join('');
    return `<div class="slot-pop" id="slot-pop" role="dialog" aria-label="Aggiungi all'equipaggio">
      <div class="pop-head"><span class="pop-pallino" style="--g:#2dd4bf">+</span><div><b>Aggiungi all'equipaggio</b><small>${esc(code)} · ${crew.length} a bordo</small></div><button type="button" class="pop-x" data-act="menu-close" aria-label="Chiudi">✕</button></div>
      <input id="pop-q" class="pop-q" type="search" placeholder="Cerca per nome…" autocomplete="off" value="${esc(ui.q)}" aria-label="Cerca un collega">
      <p class="pop-res">Come</p><div class="pop-chips"><button type="button" class="pop-chip${ui.sovr ? '' : ' on'}" data-act="tipo" data-v="eq">Membro dell'equipaggio</button><button type="button" class="pop-chip${ui.sovr ? ' on' : ''}" data-act="tipo" data-v="sovr">Sovrannumero (${esc(code)}*)</button></div>
      ${gruppi || '<p class="pop-vuoto">Nessun agente da aggiungere.</p>'}</div>`;
  }
  function popoverPosto(code, crew, tutti, x) {
    const ids = new Set(crew.map(m => String(m.id)));
    const candidati = tutti.filter(a => !ids.has(String(a.agent.id)) && puoCoprire(RUOLO[G.gradoOf(a.agent)[0]], x.ruolo));
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
      const colore = RUOLO_INFO[ruolo]?.[1] || '#e8f3f6';
      return titolo + res.map(r => `<p class="pop-res sub" style="--g:${colore}">${esc(titoloRes(r))} · ${dentro.filter(a => a.residenza === r).length}${r === casa ? ' · residenza della corsa' : ''}</p>` +
        dentro.filter(a => a.residenza === r).sort((a, b) => perDisponibilita(a, b) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it')).map(riga).join('')).join('');
    }).join('');
    // dove va chi sbarca: di solito riposo; si cambia dal valore nella bolla (assenze, a terra, altre corse)
    const NOMI = { RIP: 'Riposo', MAL: 'Malattia', CON: 'Congedo', FERIE: 'Ferie', 'F.P.': 'F.P.', LD: 'L.D.', LAV: 'Lavori' };
    const nomeDest = v => NOMI[v] || `sulla ${v}`;
    const per = ui.destAperto;
    const attuale = per === 'togli' ? ui.togliDest : ui.sbarco;
    // stessa griglia di pastiglie colorate del turno del giorno nel tab Agenti
    const chip = v => `<button type="button" class="chip ag-dest-chip${attuale === v ? ' on' : ''}" data-code="${esc(v)}" data-act="dest-scegli" data-per="${per}" data-v="${esc(v)}">${esc(NOMI[v] ? NOMI[v] : v)}</button>`;
    const terraSigle = [...new Set(Object.values(G.SIGLE_TERRA))];
    const corseDest = [...new Set([...O.TURNI, 'BIS', ...NM.TUTTI_I_TURNI])].filter(cd => cd !== code);
    const destinazioni = per ? `<div class="pop-dest">
      <p>${per === 'togli' ? `${esc(x.membro?.name || '')} se lo togli va in` : 'Chi viene sostituito va in'}</p>
      <p>Assenze</p><div class="pop-chips">${['RIP', 'MAL', 'CON', 'FERIE', 'F.P.'].map(chip).join('')}</div>
      <p>A terra</p><div class="pop-chips">${['LD', 'LAV', ...terraSigle, 'TERRA'].map(chip).join('')}</div>
      <p>Su una corsa</p><div class="pop-chips">${corseDest.map(chip).join('')}</div></div>` : '';
    // due bolle: "Sostituito va in …" (di solito riposo) e "Toglilo" (subito, in riposo o dove scegli accanto)
    const bolle = x.membro ? `<div class="pop-bolle">` +
      `<span class="pop-bolla b-sost" title="Dove va ${esc(x.membro.name)} quando scegli un sostituto"><span>↪ Sostituito va in</span><button type="button" class="pop-val${per === 'sost' ? ' on' : ''}" data-act="dest-apri" data-per="sost">${esc(nomeDest(ui.sbarco))} ▾</button></span>` +
      `<span class="pop-bolla b-togli"><button type="button" class="pop-togli" data-act="togli-subito" data-code="${code}" title="Toglie ${esc(x.membro.name)} senza metterne un altro">✕ Toglilo</button><button type="button" class="pop-val${per === 'togli' ? ' on' : ''}" data-act="dest-apri" data-per="togli" title="Dove va se lo togli">${esc(nomeDest(ui.togliDest))} ▾</button></span></div>${destinazioni}` : '';
    // sovrannumero: bolla per segnarlo o toglierlo (un sovrannumero tolto conta nell'organico e puo' coprire un posto scoperto)
    const sovrBtn = (m, v, testo, titolo) => `<button type="button" class="pop-bolla b-sovr" data-act="sovr-set" data-code="${code}" data-id="${esc(m.id)}" data-v="${v ? 1 : 0}" title="${esc(titolo)}">${testo}</button>`;
    // membro: tondo giallo con l'asterisco accanto al nome del ruolo (toglie o mette il sovrannumero); posto scoperto: un tondo per ogni sovrannumero che lo puo' coprire
    const tondo = (m, v, titolo) => `<button type="button" class="sovr-tondo${v ? '' : ' on'}" style="--g:${(RUOLO_INFO[RUOLO[m.grado[0]]] || RUOLO_INFO.marinaio)[1]}" data-act="sovr-set" data-code="${code}" data-id="${esc(m.id)}" data-v="${v ? 1 : 0}" title="${esc(titolo)}" aria-label="${esc(titolo)}">*</button>`;
    let sovrBolle = '', sovrTondo = '';
    if (x.membro) sovrTondo = tondo(x.membro, !x.sovr, x.sovr ? `${x.membro.name} e' in sovrannumero: clicca per toglierlo (entra nell'organico)` : `Metti ${x.membro.name} in sovrannumero (non conta nel minimo)`);
    else posti(state.oggi[code]?.nave, state.day, crew).filter(p => p.sovr && p.membro && puoCoprire(p.ruolo, x.ruolo))
      .forEach(p => { sovrBolle += `<span class="sovr-usa">${esc(cognome(p.membro.name))} e' a bordo in sovrannumero ${tondo(p.membro, false, `Usa ${p.membro.name} su questo posto: toglie il sovrannumero`)}</span>`; });
    if (sovrBolle) sovrBolle = `<div class="pop-bolle">${sovrBolle}</div>`;
    return `<div class="slot-pop" id="slot-pop" role="dialog" aria-label="Cambia ${esc(nomeRuolo)}">
      <div class="pop-head"><span class="pop-pallino" style="--g:${colore}">${sigla}</span><div><b style="color:${colore}">${esc(nomeRuolo)}</b>${sovrTondo}<small>${x.membro ? `ora ${esc(x.membro.name)}` : 'posto scoperto'}</small></div><button type="button" class="pop-x" data-act="menu-close" aria-label="Chiudi">✕</button></div>
      ${bolle}${sovrBolle}
      <input id="pop-q" class="pop-q" type="search" placeholder="Cerca per nome…" autocomplete="off" value="${esc(ui.q)}" aria-label="Cerca un collega">
      ${gruppi || (x.extra ? '' : '<p class="pop-vuoto">Nessun agente disponibile per questo grado.</p>')}</div>`;
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
    const crew = equipaggioDi(code);
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

  // ---------------- Servizi a terra ----------------
  // Agenti di servizio a terra del giorno: AgB e PonD (Desenzano), AgM e AgT (Maderno), con gli stessi pallini dell'equipaggio.
  const SERVIZI_TERRA = [['AgB', 'DESENZANO'], ['PonD', 'DESENZANO'], ['AgM', 'MADERNO'], ['AgT', 'MADERNO']];
  const membriTerra = (code, tutti) => tutti.filter(a => G.terraCode(a.turno) === code)
    .map(a => ({ id: String(a.agent.id), name: String(a.agent.agente || ''), grado: G.gradoOf(a.agent) }))
    .sort((a, b) => a.grado[2] - b.grado[2] || a.name.localeCompare(b.name, 'it'));
  // Equipaggio di un turno nave o di un servizio a terra.
  const equipaggioDi = code => (SERVIZI_TERRA.some(([cd]) => cd === code) ? membriTerra(code, agenti(state.day)) : G.equipaggi(state.schedule, state.day).navi[code] || []);
  // Una carta per residenza (Desenzano: AgB e PonD; Maderno: AgM e AgT): per ogni servizio la pastiglia, gli orari e sotto
  // gli agenti, con i sovrannumero (turno con asterisco, es. AGB*) in fondo tratteggiati.
  function cardTerraResidenza(res, day, terraCrews) {
    const servizi = SERVIZI_TERRA.filter(([, r]) => r === res).map(([code]) => {
      const orari = (T.DATA?.SERVIZI?.[res] || []).find(x => x[0] === code);
      const crew = terraCrews[code];
      return `<div class="terra-serv"><div class="terra-top"><span class="chip" data-code="${code}">${code}</span>` +
        `<small>${orari ? `${esc(orari[1])} / ${esc(orari[2])} · ${esc(orari[3])}` : 'servizio a terra'}${crew.length ? '' : ' · nessun agente di turno'}</small></div>` +
        `<div class="terra-slots">${pallini(code, posti(null, day, crew))}</div></div>`;
    }).join('');
    return `<article class="mov-turno terra" data-res="${res}"><div class="mov-head" role="group" aria-label="Servizi a terra ${esc(titoloRes(res))}">` +
      `<span class="terra-res">${esc(titoloRes(res))}</span><div class="terra-servizi">${servizi}</div></div></article>`;
  }

  // ---------------- Render ----------------
  // Agenti che mancano ai minimi delle navi in servizio nel giorno (per il pallino rosso sul tab Corse)
  NM.mancantiGiorno = day => {
    const oggi = T.turniDelGiorno(righeNavi(), day);
    const crews = G.equipaggi(state.schedule, day).navi;
    return turniCodici(day).reduce((t, code) => t + (minimo((oggi[code] || {}).nave, day, crews[code] || [])?.mancano.reduce((u, x) => u + x.n - x.presenti, 0) || 0), 0);
  };

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
    // le corse con l'equipaggio incompleto vanno in alto (a parita' resta l'ordine dei turni)
    const mancanti = code => minimo((oggi[code] || {}).nave, day, crews[code] || [])?.mancano.reduce((t, x) => t + x.n - x.presenti, 0) || 0;
    const cards = codes.map((code, i) => ({ code, i, m: mancanti(code) })).sort((x, y) => (y.m > 0) - (x.m > 0) || x.i - y.i)
      .map(x => card(x.code, day, oggi[x.code] || {}, ieri[x.code] || {}, crews[x.code] || [], tutti)).join('');
    const terraCrews = Object.fromEntries(SERVIZI_TERRA.map(([cd]) => [cd, membriTerra(cd, tutti)]));
    const terra = `<h3 class="mov-sez">Servizi a terra</h3>` + [...new Set(SERVIZI_TERRA.map(x => x[1]))].map(res => cardTerraResidenza(res, day, terraCrews)).join('');
    const dmy = d => (d ? d.split('-').reverse().join('/') : '');
    const ferme = turniFermi(day).map(code => {
      // corse dell'orario estivo (O.d.S. 16/2026) o invernale di questo turno
      const est = C?.COURSE_TRIPS?.[code], inv = C?.COURSE_TRIPS_WINTER?.[code], ore = C?.COURSE_TIMES?.[code];
      const st = window.NaviStagione?.[code];
      const info = [inv ? `inverno corse ${inv}` : '', est ? `estate corse ${est}${ore ? ` · ${clock(ore[0])} → ${clock(ore[1])}` : ''}` : ''].filter(Boolean).join(' · ');
      const stato = st?.stato === 'ferma' ? `ferma dal ${dmy(st.dal)}${st.al ? ` al ${dmy(st.al)}` : ' fino a nuovo ordine'}` : 'fuori orario in questo periodo';
      return `<article class="mov-turno ferma" data-turno="${code}"><div class="mov-head"><span class="chip" data-code="${code}">${code}</span><div class="mov-sum"><b>Corsa ferma</b><small>${esc(stato)}${info ? ` · ${esc(info)}` : ''}</small></div>` +
        `<button type="button" class="btn primary" data-act="stagione-riprendi" data-code="${code}" title="Rimette in servizio il turno ${code} da questo giorno">▶ Ripristina corsa</button></div></article>`;
    }).join('');
    $('mov-list').innerHTML = datalists + (cards || '<p class="empty">Nessun turno nave in servizio in questo giorno.</p>') + terra + ferme;
    if (ui.menu) {
      const c = ui.menu.code, crew = crews[c] || terraCrews[c] || [];
      const attivo = codes.includes(c) || !!terraCrews[c];
      const x = attivo ? posti(oggi[c]?.nave, day, crew)[ui.menu.i] : null;
      if (ui.menu.i === -1 && attivo) { $('mov-list').insertAdjacentHTML('beforeend', popoverAggiunta(c, crew, tutti)); filtraPopover(); posizionaPopover(); $('pop-q')?.focus(); }
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
    // cosa manca, per la scritta rossa "Equipaggio sotto il minimo"
    const manca = avviso ? min.mancano.map(x => { const n = x.n - x.presenti; const r = RUOLI.find(y => y[0] === x.key); return `${n} ${n === 1 ? r[1] : r[2]}`; }).join(', ') : '';
    const open = ui.open === code;
    let azioni;
    if (r.sospesa) {
      azioni = `<span class="mov-sospesa" title="${esc(r.motivo)}">SOSPESA${r.motivo ? ` · ${esc(r.motivo)}` : ''}</span><button class="btn primary" type="button" data-act="resume" data-code="${code}">Ripristina corse</button>`;
    } else if (ui.suspending === code) {
      azioni = `<input class="mov-motivo" id="mov-motivo" placeholder="Motivo (es. lago mosso)" autocomplete="off"><button class="btn danger" type="button" data-act="confirm-suspend" data-code="${code}">Sospendi tutte le corse</button><button class="btn ghost" type="button" data-act="cancel-suspend">Annulla</button>`;
    } else {
      azioni = `<button class="btn danger" type="button" data-act="suspend" data-code="${code}">Sospendi corse</button>`;
    }
    if (code !== 'BIS') azioni += ui.fermando === code ? '' : `<button class="btn ghost" type="button" data-act="stagione-chiedi" data-code="${code}" title="Ferma il turno ${code} per un periodo (es. fuori stagione)">⏹ Ferma corsa</button>`;
    if (r.movimento) azioni += `<button class="btn ghost" type="button" data-act="restore" data-code="${code}" title="Torna a nave e ormeggi dell'O.d.S. e toglie la sospensione (ritardi${code === 'BIS' ? ' e incarichi del BIS' : ''} restano)">↺ O.d.S.</button>`;
    if (cambiCorsa(code, day).length) azioni += `<button class="btn ghost" type="button" data-act="crew-reset" data-code="${code}" title="Ripristina i turni previsti: annulla i cambi d'equipaggio del Movimento su questa corsa">↺ Ripristina equipaggio</button>`;
    const bis = code === 'BIS' ? [] : (state.oggi.BIS?.incarichi || []).filter(inc => inc.turno === code);
    const bisBadge = bis.map(inc => `<span class="mov-bis-badge">BIS ${inc.tipo === 'aiuto' ? 'in aiuto' : 'al posto della nave'} · ${incaricoCorse(inc)}</span>`).join('');
    const attive = Object.values(state.fleet).filter(x => x?.attiva !== false).map(x => String(x.nome || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'it'));
    const usate = Object.fromEntries(Object.entries(state.oggi).filter(([c, v]) => c !== code && v?.nave).flatMap(([c, v]) => nomiNave(v.nave).map(n => [n.toUpperCase(), c])));
    const nomi = r.nave && !attive.some(n => stessaNave(n, r.nave)) ? [...nomiNave(r.nave), ...attive] : attive;
    const ordinate = [...nomi.filter(n => !usate[n.toUpperCase()]), ...nomi.filter(n => usate[n.toUpperCase()])];
    const nave = `<select class="mov-nave-tag${r.nave ? '' : ' vuota'}" data-code="${code}" data-f="nave" aria-label="Nave della ${code}"><option value=""${r.nave ? '' : ' selected'}>nave da assegnare</option>${ordinate.map(n => `<option value="${esc(n)}"${stessaNave(n, r.nave) ? ' selected' : ''}>${esc(n)}${usate[n.toUpperCase()] ? ` (ora ${usate[n.toUpperCase()]})` : ''}</option>`).join('')}</select>`;
    const stato = r.sospesa ? '<span class="mov-sospesa">SOSPESA</span>' : '';
    return `<article class="mov-turno${r.sospesa ? ' sospesa' : ''}${open ? ' open' : ''}${avviso ? ' sotto-minimo' : ''}" data-turno="${code}">
      <div class="mov-head" role="button" tabindex="0" data-act="open" data-code="${code}" aria-expanded="${open}">
        <span class="chip" data-code="${code}">${code}</span>
        <span class="mov-sum"><b>${orari || 'a disposizione'}</b><small>${corse}${r.movimento && modificaOds(code, day, r) ? ' · <em>modificato dal Movimento</em>' : ''}${r.ritardi ? ` · <em class="mov-rit">⏱ ${ritardiTesto(r.ritardi)}</em>` : ''}${r.corseSospese?.length ? ` · ⏸ ${r.corseSospese.length} sospese` : ''}</small>${avviso ? `<small class="mov-sotto">⚠ Equipaggio sotto il minimo · manca ${esc(manca)}</small>` : ''}${bisBadge}</span>
        ${nave}${stato}
        <span class="mov-slots">${r.nave || crew.length ? pallini(code, posti(r.nave, day, crew)) : ''}</span>
        <span class="mov-chev">${open ? '▴' : '▾'}</span>
      </div>
      ${open ? `<div class="mov-azioni">${azioni}</div>` : ''}
      ${open && ui.fermando === code ? `<div class="mov-ferma"><b>Ferma la ${code}</b><label>Dal<input type="date" id="ferma-dal" value="${day}"></label><label>Fino al<input type="date" id="ferma-al" value=""><small>vuoto = fino a nuovo ordine</small></label><button class="btn danger" type="button" data-act="stagione-ferma-ok" data-code="${code}">⏹ Ferma</button><button class="btn ghost" type="button" data-act="stagione-annulla">Annulla</button></div>` : ''}
      ${code === 'BIS' && open ? bisPanel(day, r) : ''}
      ${open ? ritardiPanel(code, day, r) + bolle(code, r, ieri) : ''}
    </article>`;
  }

  // Ritardi: per ogni corsa del turno in orario, +5' ... +2h a scatti di 5 minuti, oltre 2 ore. Il
  // ritardo passa da solo alle corse successive se la nave arriva dopo la loro partenza.
  const RITARDI = [...Array.from({ length: 24 }, (_, i) => String((i + 1) * 5)), 'oltre'];
  const ritardoValore = r => (!r || r.soloScali || r.inOrario ? '' : r.oltre ? 'oltre' : String(r.minuti));
  // "c. 14 +1h" per i primi ritardi del turno, poi "+N".
  function ritardiTesto(map) {
    const voci = Object.entries(map).flatMap(([corsa, x]) => [...(x.soloScali ? [] : [`c. ${corsa} ${O.testoRitardo(x)}`]),
      ...Object.entries(x.scali || {}).map(([s, y]) => `c. ${corsa} ${s} ${O.testoRitardo(y)}`)]);
    return voci.slice(0, 3).join(', ') + (voci.length > 3 ? ` +${voci.length - 3}` : '');
  }
  // Sospensione di una corsa gia' in viaggio: vale dallo scalo in cui la nave si trova adesso (oggi); se non e'
  // ancora partita (o e' un altro giorno) vale per tutta la corsa.
  function daSospensione(c) {
    if (state.day !== iso(new Date())) return { da: '', scalo: '' };
    const adesso = new Date().getHours() * 60 + new Date().getMinutes();
    const t = i => O.minutes(c.scali[i][1]);
    if (adesso <= t(0) || adesso >= t(c.scali.length - 1)) return { da: '', scalo: '' };
    let i = 0;
    c.scali.forEach((_, k) => { if (t(k) <= adesso) i = k; });
    return { da: c.scali[i][1], scalo: c.scali[i][0] };
  }
  const sospRaw = code => state.oggi[code]?.corseSospeseRaw || [];
  // Domanda sotto la corsa: sospenderla (e volendo darla al BIS al posto della nave) oppure chiamare il BIS.
  // Corsa in orario: "Chiama il BIS" = BIS in aiuto (corse in piu'); corsa sospesa o dentro "Sospendi corsa": BIS al posto della nave.
  function domandaCorsa(code, c, i, corse, successive, bisDisp) {
    const n = esc(c.numero);
    const modo = ui.sospCorsa.modo;
    const resto = corse.length - i;
    const bottone = (act, quali, testo, classe, tipo = '') => `<button type="button" class="btn ${classe}" data-act="${act}" data-code="${code}" data-corsa="${n}" data-quali="${quali}"${tipo ? ` data-tipo="${tipo}"` : ''}>${testo}</button>`;
    const gruppoBis = (tipo, etichetta) => `${etichetta ? `<span class="rit-oppure">${etichetta}</span>` : ''}` +
      bottone('corsa-bis', 'una', `BIS solo sulla ${n}`, 'primary', tipo) + (resto > 1 ? bottone('corsa-bis', 'succ', `BIS sulla ${n} e le ${resto - 1} successive`, 'primary', tipo) : '');
    if (bisDisp && modo === 'aiuto') return `<div class="rit-chiedi"><b>Chiamare il BIS in aiuto…</b>${gruppoBis('aiuto', '')}<button type="button" class="btn ghost" data-act="corsa-annulla">Annulla</button></div>`;
    if (bisDisp && modo === 'bis') return `<div class="rit-chiedi"><b>Chiamare il BIS al posto della nave…</b>${gruppoBis('sostituzione', '')}<button type="button" class="btn ghost" data-act="corsa-annulla">Annulla</button></div>`;
    return `<div class="rit-chiedi"><b>Sospendere…</b>` + bottone('corsa-sospendi', 'una', `solo la corsa ${n}`, 'danger') +
      (successive > 1 ? bottone('corsa-sospendi', 'succ', `la ${n} e le ${successive - 1} successive`, 'danger') : '') +
      (bisDisp ? gruppoBis('sostituzione', 'Oppure il BIS al posto della nave:') : '') +
      '<button type="button" class="btn ghost" data-act="corsa-annulla">Annulla</button></div>';
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
      const ultEff = eff.scali[eff.scali.length - 1];
      const nota = eff.ritardo ? `<span class="rit-nuovo">⏱ <b>${esc(eff.scali[0][1])}</b> ${esc(eff.scali[0][0])} → <b>${esc(ultEff[1])}</b> ${esc(ultEff[0])}</span>${eff.ritardo.propagato ? ' <em>(ritardo dalla corsa prima)</em>' : ''}` : '';
      const ultimo = c.scali[c.scali.length - 1];
      const sospesa = (r.corseSospese || []).includes(String(c.numero));
      const sospDa = (r.corseSospeseRaw || []).find(x => x.corsa === String(c.numero));
      const bisDisp = code !== 'BIS' && O.inServizio('BIS', day);
      const chiede = ui.sospCorsa?.code === code && ui.sospCorsa.corsa === String(c.numero);
      const successive = corse.slice(i).filter(x => !(r.corseSospese || []).includes(String(x.numero))).length;
      const inAiuto = code !== 'BIS' && (state.oggi.BIS?.incarichi || []).some(x => x.tipo === 'aiuto' && x.turno === code && O.corseIncarico(x, day).some(cc => cc.numero === String(c.numero)));
      const perBis = code !== 'BIS' ? O.bisPerCorsa(state.oggi.BIS?.incarichi, code, c.numero, day) : null;
      const azione = perBis ? `<button type="button" class="btn ghost rit-sosp" data-act="corsa-bis-togli" data-code="${code}" data-corsa="${esc(c.numero)}" title="Toglie la corsa al BIS: la rifa la nave della ${code}">↺ Ripristina alla ${code}</button>`
        : chiede ? domandaCorsa(code, c, i, corse, successive, bisDisp)
        : sospesa ? `<button type="button" class="btn ghost rit-sosp" data-act="corsa-riprendi" data-code="${code}" data-corsa="${esc(c.numero)}">↺ Ripristina corsa</button>` + (bisDisp ? `<button type="button" class="btn primary rit-sosp" data-act="corsa-chiedi" data-code="${code}" data-corsa="${esc(c.numero)}" data-modo="bis">Chiama il BIS</button>` : '')
        : `<button type="button" class="btn danger rit-sosp" data-act="corsa-chiedi" data-code="${code}" data-corsa="${esc(c.numero)}" data-modo="sosp">Sospendi corsa</button>` +
          (bisDisp ? (inAiuto ? `<button type="button" class="btn ghost rit-sosp" data-act="corsa-bis-togli" data-tipo="aiuto" data-code="${code}" data-corsa="${esc(c.numero)}">↺ Togli il BIS in aiuto</button>`
          : `<button type="button" class="btn primary rit-sosp" data-act="corsa-chiedi" data-code="${code}" data-corsa="${esc(c.numero)}" data-modo="aiuto">Chiama il BIS in aiuto</button>`) : '');
      return `<div class="rit-tile ${sospesa ? 'sosp' : livelloRitardo(eff.ritardo)}${eff.ritardo?.propagato && !sospesa ? ' prop' : ''}${perBis || inAiuto ? ' bis' : ''}">
        <div class="rit-top"><b>c. ${esc(c.numero)}</b><span class="rit-badge">${sospesa ? (sospDa?.scalo ? `SOSPESA da ${esc(sospDa.scalo)}` : 'SOSPESA') : eff.ritardo ? esc(O.testoRitardo(eff.ritardo)) : 'in orario'}</span>${perBis ? '<span class="rit-bis-tag" title="La fa il BIS al posto della nave">BIS</span>' : ''}${inAiuto ? '<span class="rit-bis-tag aiuto" title="Il BIS fa la corsa in aiuto alla nave">BIS in aiuto</span>' : ''}</div>
        <div class="rit-rotta"><span>${esc(c.scali[0][1])}</span> ${esc(c.scali[0][0])} <i>→</i> <span>${esc(ultimo[1])}</span> ${esc(ultimo[0])}</div>
        ${azione ? `<div class="rit-act">${azione}</div>` : ''}
        ${sospesa ? '' : `<select data-act="ritardo" data-code="${code}" data-corsa="${esc(c.numero)}" aria-label="Ritardo della corsa ${esc(c.numero)}">${opzioni}</select>`}
        ${nota && !sospesa ? `<div class="rit-nota">${nota}</div>` : ''}</div>`;
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
    else if (act === 'slot') { const i = Number(button.dataset.i); ui.q = ''; ui.destAperto = false; ui.menu = ui.menu?.code === code && ui.menu.i === i ? null : { code, i }; render(); }
    else if (act === 'menu-close') { ui.menu = null; ui.q = ''; render(); }
    else if (act === 'pick') cambiaPosto(code, button.dataset.id, 'pick');
    else if (act === 'togli-subito') cambiaPosto(code, ui.togliDest, 'out');
    else if (act === 'dest-apri') { ui.destAperto = ui.destAperto === button.dataset.per ? false : button.dataset.per; render(); }
    else if (act === 'dest-scegli') {
      // Toglilo: scegliendo il turno la persona viene tolta subito e va li'; Sostituito va in: si ricorda la scelta
      if (button.dataset.per === 'togli') { ui.togliDest = 'RIP'; ui.destAperto = false; cambiaPosto(ui.menu.code, button.dataset.v, 'out'); return; }
      ui.sbarco = button.dataset.v; ui.destAperto = false; render();
    }
    else if (act === 'tipo') { ui.sovr = button.dataset.v === 'sovr'; render(); }
    else if (act === 'aggiungi') {
      const sovr = ui.sovr;
      ui.menu = null; ui.sovr = false;
      const nome = agenti(state.day).find(a => String(a.agent.id) === String(button.dataset.id))?.agent.agente || '';
      variazione(button.dataset.id, sovr ? `${code}*` : code, `${nome} aggiunto alla ${code}${sovr ? ' in sovrannumero (' + code + '*)' : ''}.`, { aggiunto: true, sovrannumero: sovr });
    }
    else if (act === 'sovr-set') {
      const sovr = button.dataset.v === '1';
      const m = equipaggioDi(code).find(y => String(y.id) === String(button.dataset.id));
      ui.menu = null;
      variazione(button.dataset.id, sovr ? `${code}*` : code, `${m?.name || ''}: ${sovr ? 'in sovrannumero' : 'sovrannumero tolto, ora in organico'} sulla ${code}.`, { sovrannumero: sovr });
    }
    else if (act === 'crew-reset') ripristinaEquipaggio(code);
    else if (act === 'corsa-bis-togli') {
      // la corsa torna alla nave: l'incarico del BIS si spezza o si accorcia attorno ad essa
      const corsa = button.dataset.corsa;
      const tipoTogli = button.dataset.tipo === 'aiuto' ? 'aiuto' : 'sostituzione';
      const tutte = O.corseDelTurno(code, state.day).map(x => String(x.numero));
      const incarichi = (state.oggi.BIS?.incarichi || []).flatMap(inc => {
        if ((inc.tipo === 'aiuto') !== (tipoTogli === 'aiuto') || inc.turno !== code) return [inc];
        const ns = O.corseIncarico(inc, state.day).map(x => String(x.numero));
        if (!ns.includes(corsa)) return [inc];
        const aperto = !inc.alla && ns[ns.length - 1] === tutte[tutte.length - 1];
        const resto = tutte.filter(n => ns.includes(n) && n !== corsa);
        const gruppi = [];
        resto.forEach(n => { const l = gruppi[gruppi.length - 1]; if (l && tutte.indexOf(n) === tutte.indexOf(l[l.length - 1]) + 1) l.push(n); else gruppi.push([n]); });
        return gruppi.map((g, i) => ({ ...inc, dalla: g[0], alla: aperto && i === gruppi.length - 1 ? '' : g[g.length - 1] }));
      });
      salva('BIS', { incarichi }, tipoTogli === 'aiuto' ? `${code}: tolto il BIS in aiuto dalla corsa ${corsa}.` : `${code}: la corsa ${corsa} torna alla nave.`);
    }
    else if (act === 'corsa-riprendi') {
      const corsa = button.dataset.corsa;
      const lista = sospRaw(code).filter(x => x.corsa !== corsa);
      salva(code, { corse_sospese: lista }, `${code}: corsa ${corsa} ripristinata.`);
    }
    else if (act === 'stagione-chiedi') { ui.fermando = code; render(); }
    else if (act === 'stagione-annulla') { ui.fermando = ''; render(); }
    else if (act === 'stagione-ferma-ok') {
      const dal = $('ferma-dal')?.value || state.day, al = $('ferma-al')?.value || '';
      ui.fermando = '';
      NM.salvaStagione(code, 'ferma', dal, al, `${code}: corse ferme dal ${dal.split('-').reverse().join('/')}${al ? ` al ${al.split('-').reverse().join('/')}` : ' fino a nuovo ordine'}.`);
    }
    else if (act === 'stagione-riprendi') NM.salvaStagione(code, 'attiva', state.day, '', `${code}: corse riprese dal ${state.day.split('-').reverse().join('/')}.`);
    else if (act === 'corsa-chiedi') { ui.sospCorsa = { code, corsa: button.dataset.corsa, modo: button.dataset.modo }; render(); }
    else if (act === 'corsa-annulla') { ui.sospCorsa = null; render(); }
    else if (act === 'corsa-sospendi') {
      const corsa = button.dataset.corsa;
      const gia = sospRaw(code);
      const corseTurno = O.corseDelTurno(code, state.day);
      const tutte = corseTurno.map(x => String(x.numero));
      const nuove = (button.dataset.quali === 'succ' ? tutte.slice(tutte.indexOf(corsa)) : [corsa]).filter(n => !gia.some(x => x.corsa === n));
      const aggiunte = nuove.map(n => ({ corsa: n, ...daSospensione(corseTurno.find(x => String(x.numero) === n)) }));
      ui.sospCorsa = null;
      salva(code, { corse_sospese: [...gia, ...aggiunte] }, nuove.length > 1 ? `${code}: sospese le corse ${nuove[0]}–${nuove[nuove.length - 1]}.` : `${code}: sospesa la corsa ${corsa}.`);
    }
    else if (act === 'corsa-bis') {
      // il BIS fa le corse al posto della nave (non sospese) o in aiuto (corse in piu')
      const corsa = button.dataset.corsa;
      const gia = sospRaw(code);
      const tutte = O.corseDelTurno(code, state.day).map(x => String(x.numero));
      const nuove = button.dataset.quali === 'succ' ? tutte.slice(tutte.indexOf(corsa)) : [corsa];
      const aiuto = button.dataset.tipo === 'aiuto';
      const incarichi = [...(state.oggi.BIS?.incarichi || [])].filter(x => aiuto || !(x.tipo !== 'aiuto' && x.turno === code && O.corseIncarico(x, state.day).some(cc => nuove.includes(cc.numero))));
      incarichi.push({ tipo: aiuto ? 'aiuto' : 'sostituzione', turno: code, dalla: corsa, alla: aiuto || nuove[nuove.length - 1] !== tutte[tutte.length - 1] ? nuove[nuove.length - 1] : '' });
      ui.sospCorsa = null;
      const msg = aiuto ? `Il BIS aiuta la ${code}: ${nuove.length > 1 ? `corse ${nuove[0]}–${nuove[nuove.length - 1]}` : `corsa ${corsa}`}.`
        : `Il BIS fa ${nuove.length > 1 ? `le corse ${nuove[0]}–${nuove[nuove.length - 1]}` : `la corsa ${corsa}`} della ${code}.`;
      (async () => {
        if (!(await salva('BIS', { incarichi }, msg))) return;
        const restano = aiuto ? gia : gia.filter(x => !nuove.includes(x.corsa));
        if (restano.length !== gia.length) await salva(code, { corse_sospese: restano }, msg);
      })();
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
  NM.vista('corse', render, { onDay: () => { ui.open = ''; ui.suspending = ''; ui.bisForm = null; ui.menu = null; ui.sospCorsa = null; ui.fermando = ''; } });
})();
