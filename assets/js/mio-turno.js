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
    ['Peschiera', ['P1', 'P2', 'SR1', 'SR2', 'IE', 'S.S.']],
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
  const state = { comitive: [], day: '', schedule: null, firebaseNavi: [], showPast: false, test: admin ? String(params.get('turno') || '') : '', sections: { turno: true, corse: false, mappa: false, collegamenti: true }, originalShift: null, currentShift: null, isModified: false, modifiedBy: null };
  if (!admin) document.querySelector('.mt-test')?.remove();
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') && params.get('day') !== iso(new Date())) state.day = params.get('day');
  const today = () => state.day || iso(new Date());

  function card(title, side, body, cls = '', section = 'turno') {
    return `<details class="terra-card ${cls}" data-mt-section="${section}"${state.sections[section] ? ' open' : ''}><summary class="terra-card-head"><h2>${esc(title)}</h2>${side ? `<small>${esc(side)}</small>` : ''}</summary><div class="terra-card-body">${body}</div></details>`;
  }

  function sectionToggle(event) {
    const section = event.target.dataset?.mtSection;
    if (!event.target.isConnected || !Object.hasOwn(state.sections, section)) return;
    // ogni sezione (anche la Mappa) si apre e si chiude da sola, toccandone il titolo
    state.sections[section] = event.target.open;
  }
  ['turno-content', 'turno-after', 'turno-scali'].forEach(id => $(id).addEventListener('toggle', sectionToggle, true));

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
    // niente riquadro «Modificato da / Ripristina turno originale»: il cambio turno si vede nella striscia dei giorni
    const head = `<div class="mt-turno">${chip(code === 'RIP' ? 'Riposo' : code)}` +
      `${nave ? `<b class="mt-nave">${esc(nave)}</b>` : ''}${orario}` +
      `${lavoro ? `<span class="mt-ore">${oreMinuti(comp.hours)}</span>` : ''}</div>`;
    // con l'equipaggio la riga del turno non serve (e' gia' nell'intestazione); senza (riposo) resta la pastiglia
    return crewHtml ? card('Equipaggio', '', crewHtml) : card('Il mio turno', '', head);
  }

  function prossimoServizio(day) {
    try {
      const me = profile();
      for (let k = 1; k <= 21 && state.schedule; k++) {
        const d = addDays(day, k);
        let x = String(G.turnoAgente(state.schedule, me, d)?.turno || '').trim(); x = lavoroDi(x) || x;
        if (x && !RIPOSO.test(x)) return `Prossimo servizio: ${GIORNI[parseIso(d).getDay()].slice(0, 3).toLowerCase()} ${parseIso(d).getDate()} · ${x}`;
      }
    } catch (_) { /* dati non pronti */ }
    return 'Nessun servizio in questo giorno';
  }
  // Intestazione: ore del servizio e, oggi, quanto manca all'inizio o alla fine della giornata.
  // Prova dell'ora (solo admin): uno slider sotto il servizio porta avanti o indietro l'ora della giornata
  let oraProva = null, ultimoServizio = null;
  function sliderOra() {
    if (!admin || $('turno-ora-prova')) return;
    const box = document.createElement('label');
    box.id = 'turno-ora-prova'; box.className = 'mt-ora-prova';
    box.innerHTML = '<span>Prova ora</span><input type="range" min="0" max="1439" step="5" aria-label="Prova un\'altra ora della giornata"><b>adesso</b><button type="button">Adesso</button>';
    $('turno-servizio').after(box);
    const input = box.querySelector('input'), testo = box.querySelector('b');
    const now = new Date(); input.value = now.getHours() * 60 + now.getMinutes();
    const aggiorna = () => { testo.textContent = oraProva == null ? 'adesso' : `${String(Math.floor(oraProva / 60)).padStart(2, '0')}:${String(oraProva % 60).padStart(2, '0')}`; if (ultimoServizio) servizioHeader(...ultimoServizio); };
    input.addEventListener('input', () => { oraProva = Number(input.value); aggiorna(); });
    box.querySelector('button').addEventListener('click', () => { oraProva = null; const d = new Date(); input.value = d.getHours() * 60 + d.getMinutes(); aggiorna(); });
  }
  function servizioHeader(inizio, fine, day, code = '') {
    ultimoServizio = [inizio, fine, day, code];
    sliderOra();
    const el = $('turno-servizio');
    if (!el) return;
    el.hidden = false; el.classList.remove('vuoto');
    // senza orari la riga resta (altezza fissa) e mostra il prossimo giorno di servizio
    if (!inizio || !fine) { el.classList.add('vuoto'); el.textContent = prossimoServizio(day); return; }
    const durata = m => `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}'` : ''}`;
    let resto = '', fase = '';
    if (day === iso(new Date())) {
      const now = new Date(), n = oraProva ?? now.getHours() * 60 + now.getMinutes();
      const a = minutes(ora(inizio)), b = minutes(ora(fine));
      resto = n < a ? `inizia tra ${durata(a - n)}` : n < b ? `fine tra ${durata(b - n)}` : 'giornata finita';
      // durante il servizio: rosso nel primo terzo, giallo nel secondo, verde nell'ultimo
      if (n >= a && n < b) { const f = (n - a) / Math.max(1, b - a); fase = f < 1 / 3 ? ' inizio' : f < 2 / 3 ? ' meta' : ' fine'; }
    }
    // durata: le ore del turno (senza le pause), altrimenti da inizio a fine
    const ore = Number(C?.shiftForCode(code, day)?.hours) || 0;
    const tot = ore > 0 ? durata(Math.round(ore * 60)) : durata(minutes(ora(fine)) - minutes(ora(inizio)));
    el.innerHTML = `Servizio <b>${esc(ora(inizio))} – ${esc(ora(fine))}</b> <span class="mt-durata">(${esc(tot)})</span>${resto ? `<span class="mt-resto${fase}">${esc(resto)}</span>` : ''}`;
    el.hidden = false;
  }

  // Coincidenze ai fini tariffari dell'O.d.S. (orari-stagioni.js, coincidenze-ufficiali.js): solo quelle elencate,
  // con gli scali di provenienza per cui valgono. Dentro Alto lago e Basso lago non ci sono coincidenze.
  function coincidenzeRiga(row, day) {
    const S = window.NaviOrariStagioni;
    if (!S?.coincidenze) return '';
    let tutte; try { tutte = S.coincidenze(day); } catch (_) { return ''; }
    const run = String(row.run), turno = t => t ? `<b class="mt-co-tu" style="background:${S.COLORI[t] || '#9fb8c2'}">${esc(t)}</b>` : '';
    const via = row.kind !== 'P' ? tutte.filter(k => k.a === run && k.scalo === row.nome) : [];
    const dentro = row.kind !== 'A' ? tutte.filter(k => k.b === run && k.scalo === row.nome) : [];
    // cambi possibili che non sono coincidenze dell'O.d.S.: biglietto per ogni nave
    let cp = []; try { cp = S.cambi ? S.cambi(day) : []; } catch (_) { cp = []; }
    const ufficiale = k => tutte.some(c => c.a === k.a && c.b === k.b && c.scalo === k.scalo);
    const cvia = row.kind !== 'P' ? cp.filter(k => k.a === run && k.scalo === row.nome && !ufficiale(k)) : [];
    const cdentro = row.kind !== 'A' ? cp.filter(k => k.b === run && k.scalo === row.nome && !ufficiale(k)) : [];
    if (!via.length && !dentro.length && !cvia.length && !cdentro.length) return '';
    const fmt = t => esc(String(t).replace('.', ':'));
    return `<span class="mt-coinc">${via.map(k => `<span title="Coincidenza ai fini tariffari (O.d.S.)">🔗 → ${turno(k.turnoB)}c. ${esc(k.b)}${k.srB ? ' SR' : ''} ${fmt(k.parte)} per ${esc(k.verso)}<small>solo per chi viene da ${esc(k.da)}</small></span>`).join('')}` +
      `${dentro.map(k => `<span title="Coincidenza ai fini tariffari (O.d.S.)">🔗 ← ${turno(k.turnoA)}c. ${esc(k.a)}${k.srA ? ' SR' : ''}${k.arriva ? ` arr. ${fmt(k.arriva)}` : ''}: passeggeri da ${esc(k.da)}</span>`).join('')}` +
      `${cvia.map(k => `<span class="cp" title="Cambio possibile, non e' una coincidenza: biglietto per ogni nave">⇄ cambio → ${turno(k.turnoB)}c. ${esc(k.b)}${k.srB ? ' SR' : ''} ${fmt(k.parte)} per ${esc(k.verso)}<small>non è una coincidenza: biglietto per ogni nave</small></span>`).join('')}` +
      `${cdentro.map(k => `<span class="cp" title="Cambio possibile, non e' una coincidenza: biglietto per ogni nave">⇄ cambio ← ${turno(k.turnoA)}c. ${esc(k.a)}${k.srA ? ' SR' : ''} arr. ${fmt(k.arriva)} da ${esc(k.da)}<small>non è una coincidenza: biglietto per ogni nave</small></span>`).join('')}</span>`;
  }
  // Comitive (pagina Comitive, archivio PocketBase): sulla riga dello scalo dove salgono e dove scendono
  const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 4);
  // per ogni riga: comitive che salgono e che scendono a quello scalo con quella corsa
  function comitiveRighe(rows, day, code) {
    const NC = window.NaviComitive, out = rows.map(() => ({ salgono: [], scendono: [] }));
    if (!NC || !state.comitive.length) return out;
    [...new Set(rows.map(r => r.run))].forEach(run => {
      const corsa = rows.filter(r => r.run === run);
      NC.diCorsa(state.comitive, day, run, code).forEach(c => {
        const sale = corsa.find(r => NC.stessoScalo(r.nome, c.sale)) || corsa[0];
        const scende = corsa.slice(corsa.indexOf(sale) + 1).find(r => NC.stessoScalo(r.nome, c.scende));
        out[rows.indexOf(sale)].salgono.push(c);
        if (scende) out[rows.indexOf(scende)].scendono.push(c);
      });
    });
    return out;
  }
  // da dove arrivano (sopra «scendono») e dove vanno (sotto «salgono»): scali diversi separati da virgola
  const luoghi = (nomi, pre) => { const u = [...new Set(nomi.filter(Boolean))]; return u.length ? `<small class="com-luogo">${pre} ${esc(u.join(', '))}</small>` : ''; };
  const paxDi = list => list.reduce((n, c) => n + (parseInt(c.pax, 10) || 0), 0);

  // Riquadro rosa «Comitive sulle tue corse»: sempre in vista, sparisce quando sono tutte salite e scese
  function riquadroComitive(rows, com, day, code) {
    const oggi = iso(new Date()), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const passata = r => day < oggi || (day === oggi && minutes(r.orario) < nowMin);
    // una comitiva sparisce 30 minuti dopo il passaggio allo scalo (gli orari delle corse includono gia' il ritardo)
    const transitata = r => day < oggi || (day === oggi && minutes(r.orario) + 30 < nowMin);
    const voci = [];
    rows.forEach((r, i) => { if (transitata(r)) return; com[i].scendono.forEach(c => voci.push({ c, r, i, su: false })); com[i].salgono.forEach(c => voci.push({ c, r, i, su: true })); });
    if (!voci.length) return '';
    const pax = paxDi([...new Map(voci.map(v => [v.c.chiave, v.c])).values()]), clienti = new Set(voci.map(v => v.c.chiave)).size;
    return `<details class="or-com"${state.comAperto ? ' open' : ''}><summary><span>👥 Comitive sulle tue corse</span><b class="cnt">${clienti} · ${pax} pax</b></summary>` +
      voci.map(v => `<div class="or-com-r${passata(v.r) ? ' past' : ''}" data-com-riga="${v.i}"><span class="o">${esc(v.r.orario)}${window.NaviComitive.bolle.corsa(v.r.run, v.r.per || code)}</span><span><span class="ss ${v.su ? 'su' : 'giu'}">${v.su ? 'SALGONO' : 'SCENDONO'}</span><b>${esc(v.c.cliente)}</b><span class="d">${v.su ? `${esc(v.r.nome)} → ${esc(v.c.scende || '')}` : `a ${esc(v.r.nome)}`}</span></span><span class="dx">${window.NaviComitive.bolle.pax(v.c)}${v.su ? window.NaviComitive.bolle.pag(v.c.pagamento) : ''}</span></div>`).join('') + '</details>';
  }
  function residenzaAgente(me, found, schedule) {
    const direct = me?.residence || me?.residenza || found?.residenza;
    if (direct) return direct;
    if (schedule?.residenze && me?.id) {
      for (const [res, list] of Object.entries(schedule.residenze)) {
        if ((list || []).some(a => String(a.id || '') === String(me.id))) return res;
      }
    }
    try {
      const turni = Object.values(found?.agent?.turni || {});
      const count = { Maderno: 0, Desenzano: 0, Riva: 0, Peschiera: 0 };
      turni.forEach(t => {
        const u = String(t || '').toUpperCase();
        if (/^(T[12]|M1|AGM|AGT[12]?|PONM)$/.test(u)) count.Maderno++;
        else if (/^(D[1-4]|AGB|POND)$/.test(u)) count.Desenzano++;
        else if (/^R[1-4]$/.test(u)) count.Riva++;
        else if (/^(P[1-3]|SR[12]|S\.?S\.?|IE)$/.test(u)) count.Peschiera++;
      });
      const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 0) return top[0];
    } catch (_) {}
    return '';
  }
  function badgeHeaderMezzi(ct) {
    if (!ct || ct.stessaResidenza) return '';
    const C = window.NaviCollegamenti;
    const oraA = ct.andata ? C.ora(ct.andata.parte) : '';
    const oraR = ct.ritorno ? C.ora(ct.ritorno.parte) : '';
    const haPernotto = ct.competenze?.pernottoPrima || ct.competenze?.pernottoSera;
    const ha2Ticket = ct.competenze?.secondoTicket;

    let testo = '', cls = 'mt-head-mezzo';
    if (oraA && oraR) {
      testo = '🚌 ' + oraA + ' · rientro ' + oraR + (ha2Ticket ? ' · 2° ticket' : '');
    } else if (oraA) {
      testo = '🚌 ' + oraA + ' · 🏨 pernotto' + (ha2Ticket ? ' · 2° ticket' : '');
      cls += ' warn';
    } else if (oraR) {
      testo = '🏨 pernotto prima · rientro ' + oraR + (ha2Ticket ? ' · 2° ticket' : '');
      cls += ' warn';
    } else {
      testo = '🏨 pernotto · ⚠ no mezzi';
      cls += ' warn';
    }
    const tooltip = 'Trasferta: Diaria 50%' + (haPernotto ? ', Pernotto 40%' : '') + (ha2Ticket ? ', 2° Ticket' : '') + ' (tocca per dettagli)';
    return '<span class="' + cls + '" role="button" tabindex="0" title="' + esc(tooltip) + '">' + esc(testo) + '</span>';
  }
  function impostaContesto(testoBase, ct) {
    const el = $('turno-context');
    if (!el) return;
    const badge = badgeHeaderMezzi(ct);
    const base = String(testoBase || '').trim();
    el.innerHTML = `${esc(base)}${badge ? (base ? ' · ' : '') + badge : ''}`;
  }
  function residenzaDiNave(code) {
    const c = String(code || '').trim().toUpperCase();
    if (/^D[1-4]$/.test(c) || /^BIS$/.test(c)) return 'Desenzano';
    if (/^(T[12]|M1)$/.test(c)) return 'Maderno';
    if (/^R[1-4]$/.test(c)) return 'Riva';
    if (/^(P[1-3]|SR[12]|S\.?S\.?)$/.test(c)) return 'Peschiera';
    return '';
  }

  function cardCollegamenti(day, turnoCode, sedeTurno, casaAgente, inizio, fine) {
    const C = window.NaviCollegamenti;
    if (!C?.cercaTurno) return '';
    const casa = C.normalizzaResidenza(casaAgente);
    const sede = C.normalizzaResidenza(sedeTurno);
    if (!casa || !sede || casa === sede) return '';
    const inizioClean = String(inizio || '').split(/[-–]/)[0].trim();
    const fineClean = String(fine || '').split(/[-–]/).pop().trim();
    const ct = C.cercaTurno({ casa, turnoResidenza: sede, iso: day, inizio: inizioClean, fine: fineClean });
    if (!ct || ct.stessaResidenza) return '';
    const badge = ct.fattibile
      ? 'Fattibile coi mezzi'
      : 'Serve auto o pernotto';
    let htmlAndata = '';
    if (ct.andata) {
      htmlAndata = '<div class="mt-col-sezione"><div class="mt-col-titolo">▲ Andata: <b>' + esc(ct.casa) + ' → ' + esc(ct.lavoro) + '</b> <small>(inizio turno ore ' + esc(ora(inizioClean)) + ')</small></div>' +
        C.disegnaViaggio(ct.andata, ct.inizio, 'arrivo') + '</div>';
    } else if (ct.inizio != null) {
      htmlAndata = '<div class="mt-col-sezione"><div class="mt-col-titolo">▲ Andata: <b>' + esc(ct.casa) + ' → ' + esc(ct.lavoro) + '</b> <small>(inizio turno ore ' + esc(ora(inizioClean)) + ')</small></div>' +
        '<p class="col-no">✕ Nessun mezzo pubblico arriva a ' + esc(ct.lavoro) + ' entro le ' + esc(ora(inizioClean)) + ': serve pernotto la sera prima (40%).</p>' +
        (ct.andataPrimoDopo ? '<p class="col-info">Primo arrivo possibile:</p>' + C.disegnaViaggio(ct.andataPrimoDopo, ct.inizio, 'arrivo') : '') + '</div>';
    }
    let htmlRitorno = '';
    if (ct.ritorno) {
      htmlRitorno = '<div class="mt-col-sezione" style="margin-top:10px"><div class="mt-col-titolo">▼ Rientro: <b>' + esc(ct.lavoro) + ' → ' + esc(ct.casa) + '</b> <small>(fine turno ore ' + esc(ora(fineClean)) + ')</small></div>' +
        C.disegnaViaggio(ct.ritorno, ct.fine, 'ritorno') + '</div>';
    } else if (ct.fine != null) {
      htmlRitorno = '<div class="mt-col-sezione" style="margin-top:10px"><div class="mt-col-titolo">▼ Rientro: <b>' + esc(ct.lavoro) + ' → ' + esc(ct.casa) + '</b> <small>(fine turno ore ' + esc(ora(fineClean)) + ')</small></div>' +
        '<p class="col-no">✕ Nessun mezzo pubblico parte da ' + esc(ct.lavoro) + ' dopo le ' + esc(ora(fineClean)) + ': serve pernotto la sera del turno (40%).</p></div>';
    }

    // Sezione Competenze Trasferta (Diaria 50%, Pernotto 40%, 2° Ticket dopo 20:45 o con pernotto)
    const comp = ct.competenze || {};
    let chipsHtml = '<span class="mt-comp-chip ok" title="Trasferta fuori residenza: diaria al 50%">💰 Diaria 50%</span>';
    if (comp.pernottoPrima) {
      chipsHtml += '<span class="mt-comp-chip warn" title="Manca mezzo di andata: pernotto la sera prima del turno">🏨 Pernotto 40% (sera prima)</span>';
    }
    if (comp.pernottoSera) {
      chipsHtml += '<span class="mt-comp-chip warn" title="Manca mezzo di rientro: pernotto la sera del turno">🏨 Pernotto 40% (sera turno)</span>';
    }
    if (comp.secondoTicket) {
      const causaleTicket = comp.pernottoSera ? 'pernotto fuori' : ('rientro ore ' + C.ora(comp.rientroMin) + ' > 20:45');
      chipsHtml += '<span class="mt-comp-chip ok" title="Secondo ticket pasto spettante: ' + causaleTicket + '">🍽️ 2° Ticket (' + causaleTicket + ')</span>';
    }
    if (!comp.pernottoPrima && !comp.pernottoSera) {
      chipsHtml += '<span class="mt-comp-chip ghost" title="Orari coperti da mezzi pubblici: nessun pernotto necessario">🏨 Pernotto: no</span>';
    }

    // Controllo se le competenze sono gia' salvate nella distinta per questo giorno
    const me = profile();
    const entriesKey = 'navidiaria.entries.v1.' + (me?.id || 'guest');
    let giaRegistrato = false;
    try {
      const arr = JSON.parse(localStorage.getItem(entriesKey) || '[]');
      const ent = arr.find(e => e.date === day);
      if (ent) {
        const okDiaria = Number(ent.allowanceRate) === 50;
        const okTicket = !comp.secondoTicket || Number(ent.secondMeal) > 0;
        const okPernotto = !comp.pernottoSera || Boolean(ent.overnight40);
        giaRegistrato = okDiaria && okTicket && okPernotto;
      }
    } catch (_) {}

    const actionHtml = '<div class="mt-comp-action">' +
      '<button type="button" class="mt-comp-btn' + (giaRegistrato ? ' ok' : '') + '" id="btn-riporta-distinta" ' +
        'data-day="' + esc(day) + '" data-shift="' + esc(turnoCode || '') + '" ' +
        'data-casa="' + esc(casa) + '" data-sede="' + esc(sede) + '" ' +
        'data-inizio="' + esc(inizioClean) + '" data-fine="' + esc(fineClean) + '">' +
        (giaRegistrato ? '✓ Riportato nella Distinta' : '📋 Riporta nella Distinta') +
      '</button>' +
      '<div id="mt-comp-feedback" class="mt-comp-feedback" style="display:' + (giaRegistrato ? 'flex' : 'none') + '">' +
        '<span class="mt-fb-ok">✓ Competenze salvate nella Distinta</span> ' +
        '<a href="navidiaria.html?editDate=' + encodeURIComponent(day) + '" class="mt-fb-link">Apri in Distinta ↗</a>' +
      '</div>' +
    '</div>';

    const htmlCompetenze = '<div class="mt-col-competenze">' +
      '<div class="mt-col-titolo">💼 Competenze trasferta</div>' +
      '<div class="mt-comp-chips">' + chipsHtml + '</div>' +
      actionHtml +
    '</div>';

    const note = '<div class="mt-col-foot" style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px dashed #1f4250">' +
      '<small style="color:#9fb8c2">Residenza: <b>' + esc(ct.casa) + '</b> · Sede turno: <b>' + esc(ct.lavoro) + '</b></small>' +
      '<a href="collegamenti.html" style="color:#2dd4bf;font-size:11.5px;font-weight:700;text-decoration:none">Collegamenti completi ↗</a></div>';

    return card('Mezzi pubblici · ' + ct.casa + ' ⇄ ' + ct.lavoro, badge, htmlAndata + htmlRitorno + htmlCompetenze + note, 'mt-collegamenti-card ' + (ct.fattibile ? 'mt-col-ok' : 'mt-col-warn'), 'collegamenti');
  }
  function renderNave(code, day, me, found) {
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
    const com = comitiveRighe(rows, day, code);
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
        const paxSu = paxDi(com[i].salgono), paxGiu = paxDi(com[i].scendono);
        const cls = `nave${paxSu || paxGiu ? ' hc' : ''}${/^T[12]$/.test(code) ? ' ferry' : ''}${row.stato === 'past' ? ' past' : ''}${row.stato === 'next' ? ' next' : ''}`;
        const sep = row.sep ? `<div class="mt-sep" role="separator" aria-label="Corsa ${esc(row.sep)}"><span>${esc(row.sep)}</span></div>` : '';
        return `${sep}<div class="${cls}"${paxSu || paxGiu ? ` data-com-go="${i}"` : ''}><span class="ora">${esc(row.orario)}${row.rit ? `<small class="rit" title="Ritardo">${esc(testoRitardo(row.rit))}</small>` : ''}</span>` +
          `<span class="tipo ${row.kind}">${KIND[row.kind]}<small>corsa ${esc(row.run)}</small></span>${chip(row.per || code)}` +
          `<span class="dove"><span class="ship-line"><span class="ship-name">${esc(row.nome)}</span></span>` +
          `${badges.length ? `<span class="badges">${badges.join('')}</span>` : ''}${paxSu || paxGiu ? `<span class="com-bolle" data-com-go="${i}" role="button" tabindex="0" title="Vedi la comitiva">${paxGiu ? `<span class="com-g">${luoghi(com[i].scendono.map(c => c.sale), 'da')}<b class="com-tag giu">👥 ${paxGiu} scendono</b></span>` : ''}${paxSu ? `<span class="com-g"><b class="com-tag">👥 ${paxSu} salgono</b>${luoghi(com[i].salgono.map(c => c.scende), 'per')}</span>` : ''}</span>` : ''}${coincidenzeRiga(row, day)}</span></div>`;
      }).join('')}</div>` : '<p class="legend">Orario delle corse non disponibile per questo turno.</p>';
    // regola delle coincidenze sotto la lista, se ce ne sono
    const regola = listaCorse.includes('mt-coinc') ? '<p class="mt-regola">↪ Coincidenze solo tra Alto e Basso lago (O.d.S., punti 4–5): dentro l’Alto o il Basso lago si fa un biglietto per ogni nave.</p>' : '';

    servizioHeader(info.presentation, info.lastArrival, day, code);
    const left = turnoCard(code, day, { inizio: info.presentation, fine: info.lastArrival, crewHtml: equipaggio, nave: oggi.nave || '' });
    const right = card(code === 'BIS' && !rows.length ? 'Servizio' : 'Corse e scali', corse.length ? `${corse.length} corse` : '', listaCorse + regola, 'mt-corse-card', 'corse');
    const sedeNave = residenzaDiNave(code);
    const casa = residenzaAgente(me, found, state.schedule) || (sedeNave === 'Maderno' ? 'Desenzano' : 'Maderno');
    let coll = '', ct = null;
    try {
      ct = window.NaviCollegamenti?.cercaTurno?.({ casa, turnoResidenza: sedeNave, iso: day, inizio: info.presentation, fine: info.lastArrival });
      coll = cardCollegamenti(day, code, sedeNave, casa, info.presentation, info.lastArrival);
    } catch (e) {
      console.warn('Collegamenti nave non calcolati', e);
    }
    const baseContext = [G.comandante(crew), info.trips ? `corse ${info.trips}` : ''].filter(Boolean).join(' · ');
    impostaContesto(baseContext, ct);
    // Prima corse e scali, poi la mappa del lago (sezione Scali), poi la scheda Turno.
    $('turno-content').innerHTML = `<div class="terra-col">${riquadroComitive(rows, com, day, code)}${right}</div>`;
    $('turno-after').innerHTML = `<div class="terra-col">${coll}${left}</div>`;
  }

  function renderTerra(code, residenza, day, me, found) {
    $('turno-title').innerHTML = `${chip(code)} A terra`;
    const servizio = (T.DATA.SERVIZI[residenza] || []).find(row => row[0] === code);
    const inizioClean = servizio ? String(servizio[1] || '').split(/[-–]/)[0].trim() : '';
    const fineClean = servizio ? String(servizio[2] || servizio[1] || '').split(/[-–]/).pop().trim() : '';
    // A terra: la pagina Scali del mio scalo (mappa, navi allo scalo con pontili, ormeggi, agenti), poi la scheda Turno.
    $('turno-content').innerHTML = '';
    if (servizio) servizioHeader(inizioClean, fineClean, day, code);
    const sedeTerra = residenza === 'MADERNO' ? 'Maderno' : 'Desenzano';
    const casa = residenzaAgente(me, found, state.schedule) || (sedeTerra === 'Maderno' ? 'Desenzano' : 'Maderno');
    let coll = '', ct = null;
    try {
      ct = window.NaviCollegamenti?.cercaTurno?.({ casa, turnoResidenza: sedeTerra, iso: day, inizio: inizioClean, fine: fineClean });
      coll = cardCollegamenti(day, code, sedeTerra, casa, inizioClean, fineClean);
    } catch (e) {
      console.warn('Collegamenti terra non calcolati', e);
    }
    impostaContesto(sedeTerra, ct);
    $('turno-after').innerHTML = `<div class="terra-col">${coll}${turnoCard(code, day, servizio ? { inizio: inizioClean, fine: fineClean } : {})}</div>`;
    $('turno-scali').hidden = false;
    window.NaviOrarioPage?.show({ modo: 'terra', scalo: residenza === 'MADERNO' ? 'Maderno' : 'Desenzano', day, turno: code, inizio: servizio ? servizio[1].split(' – ')[0] : '' });
  }

  // Lavori e L.D.: orario dell'O.d.S. 39/2026 («ORARIO LAVORI/L.D.»), per residenza; il venerdi' feriale finisce prima
  const ORARIO_LAVORI = {
    DESENZANO: { mattina: ['8.00', '12.30'], pomeriggio: ['14.00', '17.30'], venerdi: '16.30' },
    MADERNO: { mattina: ['8.00', '12.30'], pomeriggio: ['14.00', '17.30'], venerdi: '16.30' },
    PESCHIERA: { mattina: ['7.30', '12.00'], pomeriggio: ['13.30', '17.00'], venerdi: '16.00' },
    RIVA: { mattina: ['7.30', '12.00'], pomeriggio: ['13.30', '17.00'], venerdi: '16.00' }
  };
  const lavoroDi = turno => { const t = String(turno || '').trim().toUpperCase(); return /^(TERRA|LAV[.;]?)$/.test(t) ? 'LAV' : /^L\.?D[.;]?$/.test(t) ? 'L.D.' : ''; };
  function orarioLavori(residenza, day) {
    const o = ORARIO_LAVORI[String(residenza || '').toUpperCase()] || ORARIO_LAVORI.DESENZANO;
    const venerdi = parseIso(day).getDay() === 5 && !window.NaviDistintaTotals?.isHoliday?.(parseIso(day));
    return { mattina: o.mattina, pomeriggio: [o.pomeriggio[0], venerdi ? o.venerdi : o.pomeriggio[1]] };
  }
  function renderAltro(turno, day, residenza = '') {
    const lav = lavoroDi(turno);
    if (lav) {
      const o = orarioLavori(residenza, day), dove = String(residenza || '').toLowerCase().replace(/^./, c => c.toUpperCase());
      $('turno-title').textContent = lav === 'LAV' ? 'LAV · Lavori' : 'L.D.';
      $('turno-context').textContent = `${dove ? `${dove} · ` : ''}${o.mattina.join('–')} e ${o.pomeriggio.join('–')} (O.d.S. 39/2026)`;
      servizioHeader(o.mattina[0], o.pomeriggio[1], day, 'LAV');
      $('turno-content').innerHTML = `<div class="terra-col">${turnoCard('LAV', day, { inizio: o.mattina[0], fine: o.pomeriggio[1] })}</div>`;
      return;
    }
    const label = turno ? String(turno).toUpperCase() : '';
    // Nessun turno per il giorno nella copia salvata: non e' un riposo. Se i dati si stanno aggiornando
    // si dice che si sta caricando; se aggiornati, che il turno non c'e' ancora.
    if (!label && !state.test) {
      $('turno-title').textContent = state.fresco === 'offline' ? 'Turno non disponibile' : state.fresco ? 'Turno non pubblicato' : 'Carico il turno…';
      $('turno-context').textContent = state.fresco === 'offline' ? 'Non è nella copia salvata: serve la rete' : state.fresco ? (localStorage.getItem('navisuite.erroreAggiornamenti') ? `Aggiornamento non riuscito (${localStorage.getItem('navisuite.erroreAggiornamenti')})` : 'Per questo giorno non c\'è ancora un turno') : 'Aggiornamento dei dati in corso';
      $('turno-content').innerHTML = '';
      return;
    }
    const riposo = !label || /^(R|RIP|RIPOSO|CON|F\.?P\.?|MALATTIA)$/.test(label);
    $('turno-title').textContent = riposo ? (label && !['R', 'RIP', 'RIPOSO'].includes(label) ? label : 'Riposo') : label;
    $('turno-context').textContent = riposo ? 'Nessuna corsa in questo giorno' : 'Turno senza corse in orario';
    $('turno-content').innerHTML = `<div class="terra-col">${turnoCard(riposo ? 'RIP' : label, day)}</div>`;
  }

  function renderTestSelect(myShift) {
    const select = $('turno-test');
    if (!select) return;
    const mine = myShift ? `Il mio turno (${lavoroDi(myShift) || myShift})` : "Il mio turno";
    select.innerHTML = `<option value="">${esc(mine)}</option>` + TURNI_PROVA.map(([group, codes]) =>
      `<optgroup label="${esc(group)}">${codes.map(code => `<option value="${code}"${code === state.test ? ' selected' : ''}>${code === 'RIP' ? 'Riposo' : code}</option>`).join('')}</optgroup>`).join('');
    select.closest('.mt-test').classList.toggle('active', !!state.test);
  }

  function updateShift(newData, source) {
    if (state.originalShift === null || state.originalShift === undefined) {
      const day = today();
      const me = profile();
      const current = state.schedule ? G.turnoAgente(state.schedule, me, day) : null;
      state.originalShift = current ? JSON.parse(JSON.stringify(current)) : { turno: state.test || '' };
    }
    const shiftData = typeof newData === 'string' ? { turno: newData } : (newData && typeof newData === 'object' ? { ...newData } : {});
    state.currentShift = { ...(state.currentShift || {}), ...shiftData };
    if (state.currentShift.turno) {
      state.test = state.currentShift.turno;
    }
    state.isModified = true;
    state.modifiedBy = source || null;
    if (typeof state.currentShift.updateShift === 'function') {
      state.currentShift.updateShift(newData, source);
    }
    render();
  }

  function restoreOriginalShift() {
    if (state.originalShift !== null && state.originalShift !== undefined) {
      const orig = typeof state.originalShift === 'string' ? { turno: state.originalShift } : JSON.parse(JSON.stringify(state.originalShift));
      state.currentShift = orig;
      state.test = orig.turno || '';
    } else {
      state.currentShift = null;
      state.test = '';
    }
    state.isModified = false;
    state.modifiedBy = null;
    if (state.currentShift && typeof state.currentShift.restoreOriginalShift === 'function') {
      state.currentShift.restoreOriginalShift();
    }
    render();
  }

  // Striscia dei giorni: due settimane prima e dopo oggi, con il mio turno; il giorno scelto al centro
  const RIPOSO = /^(R|RIP|RIPOSO|RF|CON|F|FE|FERIE|M|MAL|MALATTIA|=+|-+|LIBERO)?$/i;
  let giorniBloccati = false, giorniTimer = 0;
  function renderGiorni(day, me) {
    const box = $('turno-giorni');
    if (!box) return;
    const oggi = iso(new Date());
    const giorni = Array.from({ length: 29 }, (_, k) => addDays(oggi, k - 14));
    if (!giorni.includes(day)) giorni.push(day), giorni.sort();
    // la striscia si ricostruisce solo quando cambiano i giorni o i turni: cambiando giorno le tessere restano e scorrono
    // turno di ogni giorno (con i cambi turno); per il giorno mostrato vale il turno modificato, se c'e'
    const turni = giorni.map(d => {
      let t = ''; try { t = state.schedule ? String(G.turnoAgente(state.schedule, me, d)?.turno || '').trim() : ''; } catch (_) { t = ''; }
      if (d === day && state.isModified && state.currentShift?.turno) t = String(state.currentShift.turno).trim();
      return lavoroDi(t) || t;
    });
    // la striscia si ricostruisce quando cambiano i giorni o i turni (anche un cambio turno arrivato dopo):
    // cambiando solo giorno le tessere restano e scorrono
    const variazioniGiorno = new Set(
      (state.schedule?.variazioni_ods || [])
        .filter(v => v?.attiva !== false && (String(v?.id_agente) === String(me?.id) || norm(v?.agente) === norm(me?.agente || me?.name)))
        .map(v => String(v.data).slice(0, 10))
    );
    const chiave = `${oggi}|${me?.id || ''}|${giorni[0]}|${giorni.length}|${turni.join(',')}|${[...variazioniGiorno].sort().join(';')}`;
    if (box.dataset.chiave !== chiave) {
      box.dataset.chiave = chiave;
      box.innerHTML = giorni.map((d, k) => {
        const t = turni[k];
        const rip = RIPOSO.test(t), c = G.coloreTurno(t);
        const hasDisp = variazioniGiorno.has(d);
        // settimane separate: prima di ogni lunedi' uno spazio con il numero della settimana; domenica in rosso
        const wd = parseIso(d).getDay(), sett = wd === 1 ? `<span class="mt-sett" aria-hidden="true"><em>sett. ${settimanaIso(d)}</em></span>` : '';
        return `${sett}<button type="button" class="mt-g${d === oggi ? ' oggi' : ''}${wd === 0 ? ' dom' : ''}${d === giornoPaga(d) ? ' paga' : ''}${hasDisp ? ' has-disp' : ''}" data-giorno="${d}"${hasDisp ? ' title="Variazione da disposizione Ufficio Movimento"' : ''}>${d === oggi ? '<i class="mt-oggi">oggi</i>' : ''}<small>${GIORNI[parseIso(d).getDay()].slice(0, 3)}</small><b>${parseIso(d).getDate()}</b>` +
          `<span class="t${rip ? ' rip' : ''}" style="--c:${c};color:${G.testoSu(c)}">${rip ? (t ? 'rip' : '—') : esc(t)}</span></button>`;
      }).join('');
    }
    box.querySelectorAll('.mt-g').forEach(g => g.classList.toggle('on', g.dataset.giorno === day));
    const sel = box.querySelector('.mt-g.on');
    if (sel) {
      giorniBloccati = true;
      box.scrollTo({ left: sel.offsetLeft - (box.clientWidth - sel.offsetWidth) / 2, behavior: box.dataset.pronto ? 'smooth' : 'auto' });
      box.dataset.pronto = '1';
      clearTimeout(giorniTimer); giorniTimer = setTimeout(() => { giorniBloccati = false; }, 900);
    }
    scalaGiorni();
  }
  // giorno di paga del mese: il 27; se cade di sabato si anticipa al 26, di domenica si posticipa al lunedi' 28
  function giornoPaga(d) {
    const x = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, 27), wd = x.getDay();
    if (wd === 6) x.setDate(26); else if (wd === 0) x.setDate(28);
    return iso(x);
  }
  // numero della settimana (ISO, da lunedi')
  function settimanaIso(d) {
    const x = parseIso(d); x.setDate(x.getDate() + 3 - (x.getDay() + 6) % 7);
    const g4 = new Date(x.getFullYear(), 0, 4);
    return 1 + Math.round(((x - g4) / 864e5 - 3 + (g4.getDay() + 6) % 7) / 7);
  }
  // le tessere crescono e si accendono man mano che passano al centro della striscia
  let scalaRaf = 0;
  function scalaGiorni() {
    cancelAnimationFrame(scalaRaf);
    scalaRaf = requestAnimationFrame(() => {
      const box = $('turno-giorni'); if (!box) return;
      const centro = box.scrollLeft + box.clientWidth / 2;
      box.querySelectorAll('.mt-g').forEach(g => {
        const k = Math.min(Math.abs(g.offsetLeft + g.offsetWidth / 2 - centro) / (g.offsetWidth + 4), 3);
        g.style.setProperty('--s', (1 - Math.min(k, 1) * .08).toFixed(3));
        g.style.setProperty('--o', Math.max(g.classList.contains('oggi') ? .9 : .5, 1 - k * .17).toFixed(2));
      });
    });
  }
  function render() {
    const day = today(), shown = parseIso(day), realToday = day === iso(new Date());
    const clock = new Date();
    $('turno-day-label').textContent = `${GIORNI[shown.getDay()]} ${shown.getDate()} ${MESI[shown.getMonth()]}` +
      (realToday ? ` · ore ${clock.getHours()}.${String(clock.getMinutes()).padStart(2, '0')}` : '');
    $('turno-day-input').value = day;
    // Distinta: apre la giornata mostrata (come da Turni)
    $('turno-day-today').hidden = false;
    $('turno-day-today').classList.toggle('on', realToday);
    $('turno-scali').hidden = true;
    if ($('orario-scalo')) { $('orario-scalo').innerHTML = ''; $('orario-scalo').hidden = true; }
    $('turno-map').open = state.sections.mappa;
    $('turno-after').innerHTML = '';
    servizioHeader('', '', day);
    const me = profile();
    const found = state.schedule ? G.turnoAgente(state.schedule, me, day) : null;
    // si rilegge anche quando il turno del giorno cambia (cambi turno ricaricati dalla Distinta o da NaviTurni)
    if (state._dayLoaded !== day || String(found?.turno ?? '') !== String(state.currentShift?.turno ?? '') || Boolean(found?.isModified) !== state.isModified) {
      state._dayLoaded = day;
      if (found) {
        state.originalShift = found.originalShift ? JSON.parse(JSON.stringify(found.originalShift)) : { ...found };
        state.currentShift = found;
        state.isModified = Boolean(found.isModified);
        state.modifiedBy = found.modifiedBy || null;
      } else {
        state.originalShift = null;
        state.currentShift = null;
        state.isModified = false;
        state.modifiedBy = null;
      }
    }
    const modBar = $('turno-modified-bar');
    const modBadge = $('turno-modified-badge');
    const modByEl = $('turno-modified-by');
    const restoreBtn = $('turno-restore-btn');
    if (modBar) modBar.hidden = !state.isModified;
    if (modBadge) {
      modBadge.hidden = !state.isModified;
      if (modByEl) modByEl.textContent = state.modifiedBy || '';
      else modBadge.textContent = state.isModified ? `Modificato da: ${state.modifiedBy}` : '';
    }
    if (restoreBtn) {
      restoreBtn.hidden = !state.isModified;
      restoreBtn.disabled = !state.isModified;
    }
    // striscia dei giorni dopo aver letto il turno del giorno (cosi' vede anche il cambio turno)
    renderGiorni(day, me);
    renderTestSelect(found ? (G.naveCode(found.turno) || G.terraCode(found.turno) || found.turno) : '');
    if (!state.schedule && !state.test && !state.currentShift) { $('turno-content').innerHTML = ''; return; }
    const turno = (state.isModified && state.currentShift?.turno) ? state.currentShift.turno : (state.test || found?.turno || '');
    const nave = G.naveCode(turno), terra = G.terraCode(turno);
    // Prima pagina "Automatica": sempre Il mio turno, anche a terra (AgB, PonD, AgM, AgT...). Scali e' per gli scali.
    if (params.get('auto') === '1') params.delete('auto');
    const messages = [];
    if (state.test) messages.push(`Prova con il turno ${state.test === 'RIP' ? 'Riposo' : state.test}: i tuoi dati non cambiano.`);
    else if (!found) messages.push('Non trovo il tuo turno nei dati di NaviTurni.');
    if (nave && !inServizio(nave, day)) messages.push(`Il turno ${nave} non è in servizio in questo giorno secondo l'orario in vigore.`);
    // Le corse sospese dall'Ufficio Movimento non hanno un avviso in alto: restano segnate «SOSPESA» nell'elenco delle corse
    notice(messages.join(' · '));
    const dispEl = $('turno-disposizione');
    const vInfo = found?.variazioneInfo;
    if (dispEl) {
      if (vInfo && (vInfo.note || vInfo.ods || vInfo.protocollo)) {
        dispEl.hidden = false;
        dispEl.innerHTML = `
          <div class="mt-disp-header">
            <span class="mt-disp-badge"><span class="mt-disp-badge-icon">📋</span> Variazione ${esc(vInfo.ods || 'Ufficio Movimento')}${vInfo.protocollo ? ` (${esc(vInfo.protocollo)})` : ''}</span>
            ${vInfo.docId ? `<button type="button" class="mt-disp-open-pdf" data-doc-id="${esc(vInfo.docId)}">📄 Vedi PDF Disposizione</button>` : ''}
          </div>
          ${vInfo.note ? `<div class="mt-disp-note">${esc(vInfo.note)}</div>` : ''}
          <div class="mt-disp-meta">
            Turno assegnato: <strong>${esc(turno)}</strong>
            ${found.originalShift?.turno && found.originalShift.turno !== turno ? `<span>(turno originale: <s>${esc(found.originalShift.turno)}</s>)</span>` : ''}
          </div>`;
      } else {
        dispEl.hidden = true;
        dispEl.innerHTML = '';
      }
    }
    if (!nave && !terra) window.NaviOrarioPage?.hide();
    if (nave) {
      renderNave(nave, day, me, found);
      // In linea: la mappa del lago con la mia corsa (sotto corse, scali e turno)
      $('turno-scali').hidden = false;
      window.NaviOrarioPage?.show({ modo: 'nave', turno: nave, day });
    }
    else if (terra) renderTerra(terra, G.terraResidenza(terra) || String(found?.residenza || 'DESENZANO').toUpperCase(), day, me, found);
    else renderAltro(turno, day, String(found?.residenza || '').toUpperCase());
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

  // cambio giorno: il turno esce dal lato opposto e quello nuovo entra scorrendo, con le righe una dopo l'altra
  let cambioTimer = 0;
  const goToDay = day => {
    const prima = today();
    if (day === prima) return;
    const verso = day > prima ? 'sx' : 'dx', els = ['turno-content', 'turno-scali', 'turno-after'].map($).filter(el => el && !el.hidden);
    clearTimeout(cambioTimer);
    els.forEach(el => { el.classList.remove('mt-entra-sx', 'mt-entra-dx', 'mt-esce-sx', 'mt-esce-dx'); void el.offsetWidth; el.classList.add(`mt-esce-${verso}`); });
    const strip = $('turno-giorni');
    // la striscia parte subito, il turno cambia a meta' animazione
    if (strip) { strip.querySelectorAll('.mt-g').forEach(g => g.classList.toggle('on', g.dataset.giorno === day)); const sel = strip.querySelector('.mt-g.on'); if (sel) { giorniBloccati = true; strip.scrollTo({ left: sel.offsetLeft - (strip.clientWidth - sel.offsetWidth) / 2, behavior: 'smooth' }); } }
    cambioTimer = setTimeout(() => {
      state.day = day === iso(new Date()) ? '' : day; state.showPast = false; render();
      els.forEach(el => {
        el.classList.remove('mt-esce-sx', 'mt-esce-dx'); void el.offsetWidth; el.classList.add(`mt-entra-${verso}`);
        [...el.children].slice(0, 10).forEach((c, i) => c.style.setProperty('--i', i));
      });
      // finita l'entrata si toglie la classe, cosi' gli aggiornamenti successivi non rifanno l'animazione
      cambioTimer = setTimeout(() => els.forEach(el => el.classList.remove('mt-entra-sx', 'mt-entra-dx')), 900);
    }, 150);
  };
  // striscia dei giorni: tocco su un giorno, oppure scorrimento (si sceglie il giorno al centro)
  $('turno-giorni')?.addEventListener('click', event => { const g = event.target.closest('[data-giorno]'); if (g) goToDay(g.dataset.giorno); });
  $('turno-giorni')?.addEventListener('scroll', () => {
    scalaGiorni();
    if (giorniBloccati) return;
    clearTimeout(giorniTimer);
    giorniTimer = setTimeout(() => {
      const box = $('turno-giorni'), centro = box.scrollLeft + box.clientWidth / 2;
      let scelto = null, dist = 1e9;
      box.querySelectorAll('.mt-g').forEach(g => { const d = Math.abs(g.offsetLeft + g.offsetWidth / 2 - centro); if (d < dist) { dist = d; scelto = g; } });
      if (scelto && scelto.dataset.giorno !== today()) goToDay(scelto.dataset.giorno);
    }, 140);
  }, { passive: true });
  $('turno-giorni')?.addEventListener('scrollend', () => { setTimeout(() => { giorniBloccati = false; }, 60); });
  // scorrimento col dito in qualunque punto della pagina: a sinistra il giorno dopo, a destra il giorno prima
  // (non sulla striscia dei giorni, che scorre da sola, ne' sui comandi come il cursore del tempo della mappa)
  let tocco = null;
  const pagina = $('mio-turno') || document.body;
  pagina.addEventListener('touchstart', e => { const t = e.touches[0]; tocco = e.touches.length === 1 && !e.target.closest('#turno-giorni,input,select,textarea,.graf-wrap,.or-time') ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
  pagina.addEventListener('touchend', e => {
    if (!tocco) return; const t = e.changedTouches[0], dx = t.clientX - tocco.x, dy = t.clientY - tocco.y; tocco = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) goToDay(addDays(today(), dx < 0 ? 1 : -1));
  }, { passive: true });
  // tocco sul turno (titolo): apre la giornata mostrata nella Distinta, con il popup di modifica
  const apriDistinta = () => { location.href = `navidiaria.html?editDate=${encodeURIComponent(today())}`; };
    $('turno-context')?.addEventListener('click', e => {
    if (e.target.closest('.mt-head-mezzo')) {
      const cardEl = document.querySelector('.mt-collegamenti-card');
      if (cardEl) { cardEl.open = true; cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  });
  $('turno-title').addEventListener('click', apriDistinta);
  function riportaInDistinta(day, shiftCode, ct) {
    const me = profile();
    const id = me?.id || 'guest';
    const entriesKey = 'navidiaria.entries.v1.' + id;
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(entriesKey) || '[]');
    } catch (_) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];

    const comp = ct?.competenze || {};
    let entry = list.find(e => e.date === day);
    const now = Date.now();

    if (!entry) {
      entry = {
        id: 'naviturni-' + day,
        date: day,
        shift: shiftCode || 'PonD',
        delay: 0,
        bank: 0,
        rf: false,
        embark: false,
        cashHandling: false,
        mealUsed: true,
        ticketPresence: true,
        note: '',
        imported: true
      };
      list.push(entry);
    }

    entry.travel = true;
    entry.allowanceRate = comp.diariaRate || 50;
    if (comp.secondoTicket) {
      entry.secondMeal = 1;
    }
    if (comp.pernottoSera) {
      entry.overnight40 = true;
    }
    entry.manualOverride = true;
    entry.manualModified = true;
    entry.modificatoIl = now;

    let pernottoPrimaInfo = '';
    if (comp.pernottoPrima) {
      const dt = new Date(day + 'T12:00:00');
      dt.setDate(dt.getDate() - 1);
      const ieriIso = dt.toISOString().slice(0, 10);
      let entryIeri = list.find(e => e.date === ieriIso);
      if (entryIeri) {
        entryIeri.overnight40 = true;
        entryIeri.manualOverride = true;
        entryIeri.modificatoIl = now;
      } else {
        list.push({
          id: 'naviturni-' + ieriIso,
          date: ieriIso,
          shift: 'Riposo',
          overnight40: true,
          manualOverride: true,
          modificatoIl: now,
          imported: false
        });
      }
      pernottoPrimaInfo = ' · Pernotto 40% sera prima (' + ieriIso + ')';
    }

    list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    localStorage.setItem(entriesKey, JSON.stringify(list));
    localStorage.setItem('navidiaria.cloudDirty.' + id, '1');

    if (window.NaviAdminFirebase?.saveDiaria) {
      window.NaviAdminFirebase.saveDiaria(String(id), list).catch(err => {
        console.warn('Sync Firebase distinta non riuscito:', err);
      });
    }

    window.dispatchEvent(new CustomEvent('navisuite-distinta-updated', { detail: { date: day, entries: list } }));

    const btn = document.getElementById('btn-riporta-distinta');
    if (btn) {
      btn.classList.add('ok');
      btn.innerHTML = '✓ Riportato nella Distinta';
    }
    const fb = document.getElementById('mt-comp-feedback');
    if (fb) {
      let dettagli = ['Diaria 50%'];
      if (comp.pernottoSera) dettagli.push('Pernotto 40%');
      if (comp.secondoTicket) dettagli.push('2° Ticket');
      fb.innerHTML = '<span class="mt-fb-ok">✓ Salvato in Distinta: ' + dettagli.join(', ') + pernottoPrimaInfo + '</span> ' +
        '<a href="navidiaria.html?editDate=' + encodeURIComponent(day) + '" class="mt-fb-link">Apri in Distinta ↗</a>';
      fb.style.display = 'flex';
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('#btn-riporta-distinta');
    if (!btn) return;
    const day = btn.dataset.day;
    const shift = btn.dataset.shift;
    const casa = btn.dataset.casa;
    const sede = btn.dataset.sede;
    const inizio = btn.dataset.inizio;
    const fine = btn.dataset.fine;
    const C = window.NaviCollegamenti;
    const ct = C?.cercaTurno?.({ casa, turnoResidenza: sede, iso: day, inizio, fine });
    riportaInDistinta(day, shift, ct);
  });


  document.addEventListener('click', async event => {
    const btn = event.target.closest('[data-doc-id]');
    if (!btn) return;
    const docId = btn.dataset.docId;
    if (!docId) return;
    const originalText = btn.innerHTML;
    try {
      btn.textContent = 'Caricamento PDF…';
      btn.disabled = true;
      const fileData = await window.NaviAdminFirebase?.getAdminDocumentFile?.(docId);
      if (fileData) {
        if (fileData.startsWith('data:application/pdf') || fileData.startsWith('data:image')) {
          const byteCharacters = atob(fileData.split(',')[1] || '');
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const fileUrl = URL.createObjectURL(blob);
          window.open(fileUrl, '_blank');
        } else {
          window.open(fileData, '_blank');
        }
      } else {
        alert('Documento PDF non trovato nell\'archivio.');
      }
    } catch (err) {
      alert('Errore apertura PDF: ' + err.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
  $('turno-title').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apriDistinta(); } });
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

  $('turno-restore-btn')?.addEventListener('click', () => {
    if (state.isModified) restoreOriginalShift();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-act="restore-original"]')) {
      if (state.isModified) restoreOriginalShift();
    }
  });

  window.updateShift = updateShift;
  window.restoreOriginalShift = restoreOriginalShift;
  window.NaviMioTurno = {
    state,
    updateShift,
    restoreOriginalShift,
    render
  };

  render();
  // tocco su uno scalo con comitiva: si apre il riquadro comitive sulla comitiva di quello scalo
  document.addEventListener('click', e => {
    const go = e.target.closest('#turno-content [data-com-go]');
    if (!go) return;
    const box = document.querySelector('#turno-content .or-com');
    if (!box) return;
    state.comAperto = true; box.open = true;
    box.querySelectorAll('.or-com-r.sel').forEach(x => x.classList.remove('sel'));
    const riga = box.querySelector(`[data-com-riga="${go.dataset.comGo}"]`) || box;
    riga.classList.add('sel');
    riga.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.addEventListener('toggle', e => { if (e.target.classList?.contains('or-com')) state.comAperto = e.target.open; }, true);
  // comitive dall'archivio (o dall'O.d.S. se non raggiungibile): poi si ridisegna
  window.NaviComitive?.carica().then(r => { state.comitive = r.lista; if (r.lista.length) render(); }).catch(() => {});
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
  // tornando con «Indietro» la pagina puo' essere ripresa dalla memoria del browser: ricarico i cambi
  window.addEventListener('pageshow', event => { if (event.persisted) aggiornaModifiche(); });
  window.addEventListener('storage', event => { if (String(event.key || '').startsWith('navidiaria.entries.v1.')) aggiornaModifiche(); });
  setInterval(() => { if (state.schedule) aggiornaModifiche(); }, 60000);
})();
