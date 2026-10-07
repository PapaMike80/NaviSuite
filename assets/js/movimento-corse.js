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

  const O = window.NaviOrarioGiorno;
  const G = window.NaviTurniGiorno;
  const T = window.NaviServiziTerra;
  const C = window.NaviCourseInfo;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const clock = value => String(value || '').replace(':', '.').replace(/^0(\d)/, '$1');

  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch { profile = null; }
  if (!profile || !window.NaviRoles?.isAdminAgent(profile) || !$('mov-list')) return;
  const autore = String(profile.name || profile.agente || profile.id || '');

  // Causali per togliere un agente dall'equipaggio (oppure lo si sposta su un altro turno).
  const CAUSALI = [['MAL', 'Malattia'], ['RIP', 'Riposo'], ['CON', 'Congedo'], ['FERIE', 'Ferie']];
  const PONTILI = ['pontile 1', 'pontile 2', 'pontile 3', 'pontile 4', 'pontile 5', 'pontile 6'];
  // Ruolo dell'anagrafica navi per grado dell'equipaggio (turni-giorno.js).
  const RUOLO = { Comandante: 'capitano', 'Capo timoniere': 'capo_timoniere', Timoniere: 'timoniere', Motorista: 'motorista', 'Aiuto motorista': 'aiuto_motorista', Marinaio: 'marinaio' };
  const RUOLI = [['capitano', 'capitano', 'capitani'], ['capo_timoniere', 'capo timoniere', 'capi timonieri'], ['timoniere', 'timoniere', 'timonieri'],
    ['motorista', 'motorista', 'motoristi'], ['aiuto_motorista', 'aiuto motorista', 'aiuto motoristi'], ['marinaio', 'marinaio', 'marinai']];

  const state = { day: iso(new Date()), schedule: null, turniNavi: [], fleet: {}, open: '', suspending: '', busy: false, loaded: false, oggi: {}, bisForm: null };

  function setStatus(text, kind = '') { const el = $('mov-status'); el.textContent = text; el.className = `mov-status ${kind}`.trim(); }

  // Turni nave: quelli del Movimento e degli O.d.S. appena letti vincono sulla copia dei turni condivisi.
  function righeNavi() {
    const key = row => `${row?.data || ''}|${String(row?.corsa || '').toUpperCase()}|${String(row?.nave || '').trim().toUpperCase()}`;
    const fresh = new Set(state.turniNavi.map(key));
    const base = (state.schedule?.turni_navi || []).filter(row => row?.fonte !== 'movimento' && !fresh.has(key(row)));
    return [...base, ...state.turniNavi];
  }
  const turniCodici = day => [...O.TURNI.slice(0, 2), 'BIS', ...O.TURNI.slice(2)].filter(code => O.inServizio(code, day));

  // Variazione del Movimento di un agente nel giorno (per "annulla").
  const variazioneMovimento = (day, id) => (state.schedule?.variazioni_ods || [])
    .filter(item => item?.ods === 'MOVIMENTO' && String(item.data).slice(0, 10) === day && String(item.id_agente) === String(id)).pop() || null;

  function agenti(day) {
    const seen = new Set(), out = [];
    Object.entries(state.schedule?.residenze || {}).forEach(([residenza, list]) => (list || []).forEach(agent => {
      const id = String(agent?.id || '');
      if (!id || seen.has(id) || window.NaviRoles?.isBaristaAgent?.(agent)) return;
      seen.add(id);
      out.push({ agent, residenza, turno: String(G.turnoAgente(state.schedule, { id }, day)?.turno || '').trim().toUpperCase() });
    }));
    return out.sort((a, b) => String(a.agent.agente).localeCompare(String(b.agent.agente), 'it'));
  }

  // Equipaggio minimo della nave nel giorno (anagrafica navi) e ruoli che mancano.
  function minimo(nave, day, crew) {
    const norm = value => String(value || '').trim().toUpperCase();
    const ship = Object.values(state.fleet).find(item => norm(item?.nome) === norm(nave));
    if (!ship) return null;
    const periodi = (Array.isArray(ship.periodi) ? ship.periodi : Object.values(ship.periodi || {})).filter(Boolean)
      .sort((a, b) => String(a.dal || '').localeCompare(String(b.dal || '')));
    const periodo = periodi.filter(p => String(p.dal || '') <= day).pop();
    if (!periodo) return null;
    const presenti = {};
    crew.forEach(member => { const ruolo = RUOLO[member.grado[0]]; if (ruolo) presenti[ruolo] = (presenti[ruolo] || 0) + 1; });
    // a bordo il capo timoniere fa da capitano, se il capitano manca
    const servono = key => Number(periodo.equipaggio?.[key]) || 0;
    while ((presenti.capitano || 0) < servono('capitano') && (presenti.capo_timoniere || 0) > servono('capo_timoniere')) {
      presenti.capitano = (presenti.capitano || 0) + 1;
      presenti.capo_timoniere -= 1;
    }
    const richiesti = RUOLI.filter(([key]) => Number(periodo.equipaggio?.[key]) > 0)
      .map(([key, uno, piu]) => ({ key, n: Number(periodo.equipaggio[key]), label: Number(periodo.equipaggio[key]) === 1 ? uno : piu, presenti: presenti[key] || 0 }));
    const totale = richiesti.reduce((s, r) => s + r.n, 0);
    return { nome: ship.nome, richiesti, totale, mancano: richiesti.filter(r => r.presenti < r.n) };
  }

  // ---------------- Render ----------------
  function render() {
    const day = state.day;
    const d = parseIso(day);
    $('mov-day-label').textContent = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
    $('mov-day-input').value = day;
    $('mov-day-today').hidden = day === iso(new Date());
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
      ...righe.map(row => String(row?.nave || '').replace(/\s*(\([A-Z]\)|©)/g, '').trim())].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    const datalists = `<datalist id="mov-navi">${navi.map(n => `<option value="${esc(n)}">`).join('')}</datalist>` +
      `<datalist id="mov-ormeggi">${PONTILI.map(p => `<option value="${p}">`).join('')}</datalist>`;
    const cards = codes.map(code => card(code, day, oggi[code] || {}, ieri[code] || {}, crews[code] || [], tutti)).join('');
    $('mov-list').innerHTML = datalists + (cards || '<p class="empty">Nessun turno nave in servizio in questo giorno.</p>');
  }

  function card(code, day, r, ieri, crew, tutti) {
    const info = C?.info?.(code, day) || {};
    const orari = info.firstDeparture ? `${clock(info.firstDeparture)} → ${clock(info.lastArrival)}` : '';
    const corse = info.trips ? `corse ${esc(info.trips)}` : code === 'BIS' ? 'a disposizione' : '';
    const comandante = G.comandante(crew);
    const min = minimo(r.nave, day, crew);
    const avviso = min && (min.mancano.length || crew.length < min.totale);
    const open = state.open === code;
    const field = (f, label, value, extra = '') => `<label class="mov-field mov-${f}"><span>${label}</span><input data-code="${code}" data-f="${f}" value="${esc(value)}" ${extra} autocomplete="off"></label>`;
    let azioni;
    if (r.sospesa) {
      azioni = `<span class="mov-sospesa" title="${esc(r.motivo)}">SOSPESA${r.motivo ? ` · ${esc(r.motivo)}` : ''}</span><button class="btn primary" type="button" data-act="resume" data-code="${code}">Ripristina corse</button>`;
    } else if (state.suspending === code) {
      azioni = `<input class="mov-motivo" id="mov-motivo" placeholder="Motivo (es. lago mosso)" autocomplete="off"><button class="btn danger" type="button" data-act="confirm-suspend" data-code="${code}">Sospendi tutte le corse</button><button class="btn ghost" type="button" data-act="cancel-suspend">Annulla</button>`;
    } else {
      azioni = `<button class="btn danger" type="button" data-act="suspend" data-code="${code}">Sospendi corse</button>`;
    }
    if (r.movimento) azioni += `<button class="btn ghost" type="button" data-act="restore" data-code="${code}" title="Torna a nave e ormeggi dell'O.d.S. e toglie la sospensione (ritardi${code === 'BIS' ? ' e incarichi del BIS' : ''} restano)">↺ O.d.S.</button>`;
    if (code !== 'BIS' && O.inServizio('BIS', day)) azioni += `<button class="btn ghost" type="button" data-act="bis-form" data-code="${code}" title="Il BIS sostituisce questa nave o fa corse in aiuto">⇄ BIS</button>`;
    const bis = code === 'BIS' ? [] : (state.oggi.BIS?.incarichi || []).filter(inc => inc.turno === code);
    const bisBadge = bis.map(inc => `<span class="mov-bis-badge">BIS ${inc.tipo === 'aiuto' ? 'in aiuto' : 'al posto della nave'} · ${incaricoCorse(inc)}</span>`).join('');
    return `<article class="mov-turno${r.sospesa ? ' sospesa' : ''}${open ? ' open' : ''}" data-turno="${code}">
      <div class="mov-row">
        <div class="mov-id"><span class="chip" data-code="${code}">${code}</span><div><b>${orari}</b><small>${corse}${r.movimento ? ' · <em>modificato dal Movimento</em>' : ''}</small>${bisBadge}</div></div>
        ${field('nave', 'Nave', r.nave || '', 'list="mov-navi" placeholder="Nave"')}
        ${field('ormeggio_mattino', 'Ormeggio mattino', r.ormeggioMattino || '', `list="mov-ormeggi" placeholder="${esc(ieri.ormeggio ? `${ieri.ormeggio} (sera prima)` : '—')}"`)}
        ${field('ormeggio_serale', 'Ormeggio sera', r.ormeggio || '', 'list="mov-ormeggi" placeholder="—"')}
        <label class="mov-rif" title="Rifornimento la mattina"><input type="checkbox" data-code="${code}" data-f="rif"${r.rif ? ' checked' : ''}> R</label>
        <button class="mov-crew-btn${avviso ? ' warn' : ''}" type="button" data-act="open" data-code="${code}" aria-expanded="${open}">
          👥 ${crew.length}${comandante ? ` · ${esc(comandante)}` : ''}${avviso ? ' ⚠' : ''}${r.ritardi ? ` · ⏱ ${Object.keys(r.ritardi).length}` : ''} <span>${open ? '▴' : '▾'}</span></button>
        <div class="mov-actions">${azioni}</div>
      </div>
      ${code === 'BIS' ? bisPanel(day, r) : ''}
      ${open ? ritardiPanel(code, day, r) + equipaggio(code, day, r, crew, tutti, min) : ''}
    </article>`;
  }

  // Ritardi: per ogni corsa del turno in orario, +5' ... +2h a scatti di 5 minuti, oltre 2 ore. Il
  // ritardo passa da solo alle corse successive se la nave arriva dopo la loro partenza.
  const RITARDI = [...Array.from({ length: 24 }, (_, i) => String((i + 1) * 5)), 'oltre'];
  const ritardoValore = r => (!r ? '' : r.oltre ? 'oltre' : String(r.minuti));
  function ritardiPanel(code, day, r) {
    const corse = O.corseDelTurno(code, day);
    if (!corse.length) return '';
    const effettive = O.corseDelTurno(code, day, r.ritardi);
    const righe = corse.map((c, i) => {
      const proprio = r.ritardi?.[c.numero];
      const eff = effettive[i];
      const opzioni = `<option value="">in orario</option>${RITARDI.map(v => `<option value="${v}"${v === ritardoValore(proprio) ? ' selected' : ''}>${v === 'oltre' ? 'oltre 2 ore' : O.testoRitardo({ minuti: Number(v) })}</option>`).join('')}`;
      const nota = eff.ritardo?.propagato ? `<small class="mov-rit-prop">${esc(O.testoRitardo(eff.ritardo))} dalla corsa prima · parte ${esc(eff.scali[0][1])}</small>`
        : proprio ? `<small class="mov-rit-prop">parte ${esc(eff.scali[0][1])}, arriva ${esc(eff.scali[eff.scali.length - 1][1])}</small>` : '';
      return `<li class="${proprio || eff.ritardo ? 'late' : ''}"><span><b>c. ${esc(c.numero)}</b> · ${esc(c.scali[0][1])} ${esc(c.scali[0][0])} → ${esc(c.scali[c.scali.length - 1][1])} ${esc(c.scali[c.scali.length - 1][0])}</span>` +
        `<select data-act="ritardo" data-code="${code}" data-corsa="${esc(c.numero)}" aria-label="Ritardo della corsa ${esc(c.numero)}">${opzioni}</select>${nota}</li>`;
    }).join('');
    return `<div class="mov-ritardi"><p class="mov-bis-title">⏱ Ritardi delle corse</p><ul>${righe}</ul></div>`;
  }
  const ritardiLista = map => Object.entries(map || {}).map(([corsa, r]) => ({ corsa, minuti: r.minuti, oltre: !!r.oltre }));

  function equipaggio(code, day, r, crew, tutti, min) {
    const altri = [...O.TURNI, 'BIS'].filter(c => c !== code);
    const membri = crew.map(member => {
      const v = variazioneMovimento(day, member.id);
      const opzioni = `<option value="">Togli…</option>${CAUSALI.map(([c, l]) => `<option value="${c}">${l} (${c})</option>`).join('')}` +
        `<optgroup label="Sposta su">${altri.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>`;
      return `<li><b style="color:${member.grado[1]}">${esc(member.name)}</b><small>${esc(member.grado[0] || '')}${v ? ` · aggiunto dal Movimento (era ${esc(v.turno_originale || '—')})` : ''}</small>` +
        `<span class="mov-crew-act">${v ? `<button class="btn ghost" type="button" data-act="undo" data-id="${esc(member.id)}">Annulla</button>` : ''}` +
        `<select data-act="remove" data-code="${code}" data-id="${esc(member.id)}" aria-label="Togli ${esc(member.name)}">${opzioni}</select></span></li>`;
    }).join('');
    // Tolti dal Movimento da questa corsa (per annullare)
    const tolti = (state.schedule?.variazioni_ods || []).filter(item => item?.ods === 'MOVIMENTO' && String(item.data).slice(0, 10) === day &&
      String(item.turno_originale || '').toUpperCase() === code && String(item.turno_nuovo || '').toUpperCase() !== code)
      .filter((item, i, list) => list.findLastIndex(x => String(x.id_agente) === String(item.id_agente)) === i)
      .map(item => `<li class="tolto"><b>${esc(item.agente)}</b><small>tolto · ${esc(item.turno_nuovo)}</small><span class="mov-crew-act"><button class="btn ghost" type="button" data-act="undo" data-id="${esc(item.id_agente)}">Annulla</button></span></li>`).join('');
    const ids = new Set(crew.map(m => String(m.id)));
    const liberi = tutti.filter(a => !ids.has(String(a.agent.id)));
    const libero = a => !a.turno || /^(RIP|RIPOSO|===|--+|TERRA|LAV\.?|DISP)$/i.test(a.turno) || G.terraCode(a.turno);
    const opzione = a => `<option value="${esc(a.agent.id)}">${esc(a.agent.agente)} · ${esc(a.turno || '—')}${a.agent.qualifica ? ` · ${esc(a.agent.qualifica)}` : ''}</option>`;
    const aggiungi = `<select data-act="add" data-code="${code}" aria-label="Aggiungi all'equipaggio"><option value="">+ Aggiungi agente…</option>` +
      `<optgroup label="Riposo o a terra">${liberi.filter(libero).map(opzione).join('')}</optgroup>` +
      `<optgroup label="Su altre corse">${liberi.filter(a => !libero(a) && (G.naveCode(a.turno) || !/^(MAL|CON|FERIE|F\.?P\.?)$/i.test(a.turno))).map(opzione).join('')}</optgroup>` +
      `<optgroup label="Malattia, congedo, ferie">${liberi.filter(a => /^(MAL|CON|CONG|FERIE|F\.?P\.?)$/i.test(a.turno)).map(opzione).join('')}</optgroup></select>`;
    let minimoTxt = '';
    if (min) {
      const req = min.richiesti.map(x => `${x.n} ${x.label}`).join(' · ');
      const manca = min.mancano.map(x => `${x.n - x.presenti} ${x.n - x.presenti === 1 ? RUOLI.find(y => y[0] === x.key)[1] : RUOLI.find(y => y[0] === x.key)[2]}`).join(', ');
      minimoTxt = `<p class="mov-min${min.mancano.length || crew.length < min.totale ? ' warn' : ''}">Equipaggio minimo ${esc(min.nome)}: ${esc(req)}${manca ? ` — ⚠ manca ${esc(manca)}` : crew.length < min.totale ? ` — ⚠ servono ${min.totale} persone` : ' — completo'}</p>`;
    } else if (r.nave) {
      minimoTxt = `<p class="mov-min">Equipaggio minimo di ${esc(r.nave)} non indicato nell'anagrafica navi.</p>`;
    }
    return `<div class="mov-crew">${minimoTxt}<ul>${membri || '<li class="vuoto">Nessun agente su questo turno.</li>'}${tolti}</ul>${aggiungi}</div>`;
  }

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
    const f = state.bisForm || {};
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

  // ---------------- Salvataggi ----------------
  async function salva(code, patch, messaggio) {
    if (state.busy) return;
    state.busy = true;
    setStatus('Salvataggio…');
    const r = T.turniDelGiorno(righeNavi(), state.day)[code] || {};
    const values = {
      nave: r.nave || '', ormeggio_mattino: r.ormeggioMattino || '', ormeggio_serale: r.ormeggio || '', rifornimento_mattina: !!r.rif,
      sospesa: !!r.sospesa, sospesa_motivo: r.motivo || '', incarichi: r.incarichi || [], ritardi: ritardiLista(r.ritardi), ...patch
    };
    try {
      state.turniNavi = await window.NaviAdminFirebase.saveTurnoNaveMovimento(state.day, code, values, autore);
      setStatus(messaggio, 'ok');
    } catch (error) {
      setStatus(`Non salvato: ${error.message}`, 'bad');
    } finally { state.busy = false; render(); }
  }

  async function ripristina(code) {
    if (state.busy) return;
    state.busy = true;
    setStatus('Ripristino…');
    try {
      const incarichi = code === 'BIS' ? (state.oggi.BIS?.incarichi || []) : [];
      const ritardi = ritardiLista(state.oggi[code]?.ritardi);
      state.turniNavi = await window.NaviAdminFirebase.ripristinaTurnoNave(state.day, code);
      // torna la nave dell'O.d.S., ma restano i ritardi e gli incarichi del BIS del giorno
      if (incarichi.length || ritardi.length) {
        const r = T.turniDelGiorno(righeNavi(), state.day)[code] || {};
        state.turniNavi = await window.NaviAdminFirebase.saveTurnoNaveMovimento(state.day, code,
          { nave: r.nave || '', ormeggio_serale: r.ormeggio || '', rifornimento_mattina: !!r.rif, incarichi, ritardi }, autore);
      }
      setStatus(`${code}: nave e ormeggi dell'O.d.S. ripristinati.`, 'ok');
    } catch (error) {
      setStatus(`Non ripristinato: ${error.message}`, 'bad');
    } finally { state.busy = false; render(); }
  }

  // Variazione di turno di un agente (turnoNuovo vuoto = annulla quella del Movimento).
  async function variazione(id, turnoNuovo, messaggio) {
    if (state.busy) return;
    const item = agenti(state.day).find(a => String(a.agent.id) === String(id));
    if (!item) return;
    state.busy = true;
    setStatus('Salvataggio equipaggio…');
    const prima = variazioneMovimento(state.day, id);
    const originale = prima?.turno_originale || item.turno;
    try {
      const rows = await window.NaviAdminFirebase.saveVariazioneMovimento(state.day, item.agent, turnoNuovo, originale, `Movimento (${autore})`);
      // aggiorna subito i turni in pagina: tolte le variazioni del Movimento del giorno, aggiunte quelle salvate
      const day = state.day;
      state.schedule.variazioni_ods = [...(state.schedule.variazioni_ods || []).filter(v => !(v?.ods === 'MOVIMENTO' && String(v.data).slice(0, 10) === day)),
        ...rows.filter(v => v?.ods === 'MOVIMENTO' && String(v.data).slice(0, 10) === day)];
      setStatus(messaggio, 'ok');
    } catch (error) {
      setStatus(`Equipaggio non salvato: ${error.message}`, 'bad');
    } finally { state.busy = false; render(); }
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
      state.bisForm = { ...(state.bisForm || {}), turno: state.bisForm?.turno || el.closest('.mov-bis-form').querySelector('[data-bis=turno]').value, [el.dataset.bis]: el.value };
      if (el.dataset.bis === 'turno') { state.bisForm.dalla = ''; state.bisForm.alla = ''; }
      if (el.dataset.bis === 'tipo' || el.dataset.bis === 'dalla') state.bisForm.alla = '';
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
    if (el.dataset.act === 'remove' && el.value) {
      const nome = el.closest('li')?.querySelector('b')?.textContent || '';
      variazione(el.dataset.id, el.value, `${nome} tolto da ${code} (${el.value}).`);
    } else if (el.dataset.act === 'add' && el.value) {
      const nome = el.selectedOptions[0]?.textContent.split(' · ')[0] || '';
      variazione(el.value, code, `${nome} aggiunto a ${code}.`);
    }
  });
  list.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input[data-f]')) event.target.blur();
    if (event.key === 'Enter' && event.target.id === 'mov-motivo') list.querySelector('[data-act="confirm-suspend"]')?.click();
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const code = button.dataset.code;
    const act = button.dataset.act;
    if (act === 'open') { state.open = state.open === code ? '' : code; render(); }
    else if (act === 'suspend') { state.suspending = code; render(); $('mov-motivo')?.focus(); }
    else if (act === 'cancel-suspend') { state.suspending = ''; render(); }
    else if (act === 'confirm-suspend') {
      const motivo = $('mov-motivo')?.value.trim() || '';
      state.suspending = '';
      salva(code, { sospesa: true, sospesa_motivo: motivo, sospesa_il: new Date().toISOString() }, `${code}: tutte le corse sospese${motivo ? ` (${motivo})` : ''}.`);
    } else if (act === 'resume') salva(code, { sospesa: false, sospesa_motivo: '' }, `${code}: corse ripristinate.`);
    else if (act === 'restore') ripristina(code);
    else if (act === 'undo') variazione(button.dataset.id, '', 'Variazione dell\'equipaggio annullata.');
    else if (act === 'bis-form') {
      state.bisForm = { tipo: 'sostituzione', turno: code };
      render();
      $('mov-bis')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (act === 'bis-add') {
      const form = button.closest('.mov-bis-form');
      const value = name => form.querySelector(`[data-bis=${name}]`).value;
      const inc = { tipo: value('tipo'), turno: value('turno'), dalla: value('dalla'), alla: value('alla') };
      if (!inc.turno || !inc.dalla) return;
      // una sola sostituzione per turno: la nuova prende il posto della precedente
      const incarichi = (state.oggi.BIS?.incarichi || []).filter(x => !(inc.tipo === 'sostituzione' && x.tipo !== 'aiuto' && x.turno === inc.turno));
      state.bisForm = null;
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

  const goToDay = day => { state.day = day; state.open = ''; state.suspending = ''; render(); };
  $('mov-day-prev').addEventListener('click', () => goToDay(addDays(state.day, -1)));
  $('mov-day-next').addEventListener('click', () => goToDay(addDays(state.day, 1)));
  $('mov-day-today').addEventListener('click', () => goToDay(iso(new Date())));
  $('mov-day-input').addEventListener('change', event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) goToDay(event.target.value); });

  // ---------------- Dati ----------------
  // Non ridisegna mentre si scrive in un campo (per non perdere il testo).
  const editing = () => document.activeElement?.closest?.('#mov-list') && document.activeElement.matches('input, select');
  async function aggiorna() {
    const provider = window.NaviAdminFirebase;
    try {
      await provider?.ready;
      const [rows, fleet] = await Promise.all([provider.getTurniNavi(), provider.getFleet().catch(() => ({ navi: state.fleet }))]);
      state.turniNavi = rows;
      state.fleet = fleet.navi || {};
      if (!state.busy && !editing()) render();
    } catch (error) {
      setStatus(`Turni nave non aggiornati: ${error.message}`, 'bad');
    }
  }
  function carica() {
    window.NaviSharedData?.loadCacheFirst?.((data, meta) => {
      state.schedule = data;
      if (!meta?.stale) setStatus('');
      if (!state.busy && !editing()) render();
    })?.catch?.(error => setStatus(`Turni non disponibili: ${error.message}`, 'bad'));
  }
  setStatus('Caricamento turni e navi…');
  render();
  carica();
  aggiorna();
  // Le modifiche dei colleghi: turni nave ogni minuto, turni degli agenti ogni 5 minuti.
  setInterval(aggiorna, 60000);
  setInterval(carica, 5 * 60000);
})();
