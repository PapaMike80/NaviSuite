/*
 * NaviSuite · Movimento — tab Agenti: elenco per residenza (richiudibile), grado e anzianita' con il turno del giorno scelto.
 * Il grado e' un pallino colorato come nelle Corse; il turno e' una pastiglia che apre le destinazioni raggruppate
 * (assenze, a terra, altre corse): variazione manuale del Movimento, come l'equipaggio delle Corse.
 */
(() => {
  'use strict';

  const NM = window.NaviMovimento;
  const view = document.getElementById('agenti-view');
  if (!NM || !view) return;
  const { G } = NM;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const ui = { res:'', q:'', aperto:'', aperte:new Set(), sovr:false, modifica:'' };
  const titolo = text => String(text).charAt(0) + String(text).slice(1).toLowerCase();
  // Pallino del grado (sigla e colore come nelle Corse).
  const ICONE = { Capitano: ['Cap', '#facc15'], 'Capo timoniere': ['CT', '#fb923c'], Timoniere: ['Tim', '#22c55e'], Motorista: ['Mot', '#a855f7'],
    'Aiuto motorista': ['AM', '#3b82f6'], Marinaio: ['Mar', '#e8f3f6'] };
  const NOMI = { RIP: 'Riposo', MAL: 'Malattia', CON: 'Congedo', FERIE: 'Ferie', 'F.P.': 'F.P.', LD: 'L.D.', LAV: 'Lavori', TERRA: 'Terra' };
  const nomeTurno = t => NOMI[t] || t || '—';

  // Anzianita' del prospetto dei turni (posizione, 1 = la piu' anziana); chi non c'e' va in fondo.
  const anz = r => window.NaviSharedData?.seniorityRank?.(r.agent.agente) ?? Number.POSITIVE_INFINITY;
  const anzTesto = r => (Number.isFinite(anz(r)) ? String(anz(r) + 1) : '—');
  const stesso = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

  // Destinazioni: come nel menu dello sbarco delle Corse, piu' i servizi a terra e il turno attuale se insolito.
  function destinazioni(rows, r) {
    const navi = NM.turniCodici(NM.state.day);
    const terra = [...new Set(Object.values(G.SIGLE_TERRA))];
    const corse = [...new Set([...navi, ...NM.TUTTI_I_TURNI])];
    // stesse pastiglie colorate del turno del giorno
    const chip = v => `<button type="button" class="chip ag-dest-chip${stesso(v, r.turno) ? ' on' : ''}" data-code="${esc(v)}" data-act="turno-scegli" data-id="${esc(r.agent.id)}" data-v="${esc(v)}">${esc(nomeTurno(v))}${ui.sovr && corse.includes(v) ? '*' : ''}</button>`;
    const gruppo = (titoloGruppo, lista) => (lista.length ? `<p>${titoloGruppo}</p><div class="pop-chips">${lista.map(chip).join('')}</div>` : '');
    const sovrToggle = `<button type="button" class="ag-sovr${ui.sovr ? ' on' : ''}" data-act="sovr-toggle" title="Sulla corsa scelta come sovrannumero (turno con asterisco, es. D1*): non conta nel minimo della nave">${ui.sovr ? '☑' : '☐'} In sovrannumero (*)</button>`;
    // in sovrannumero solo le corse; altrimenti assenze, a terra (con TERRA) e corse. Niente codici "altri".
    if (ui.sovr) return `<div class="pop-dest ag-dest">${sovrToggle}${gruppo('Su una corsa · sovrannumero (*)', corse)}</div>`;
    return `<div class="pop-dest ag-dest">${sovrToggle}${gruppo('Assenze', ['RIP', 'MAL', 'CON', 'FERIE', 'F.P.'])}${gruppo('A terra', ['LD', 'LAV', ...terra, 'TERRA'])}` +
      `${gruppo('Su una corsa', corse)}</div>`;
  }

  // Pastiglie per scegliere un altro turno al posto di quello richiesto dall'agente.
  function destinazioniRichiesta(r) {
    const navi = NM.turniCodici(r.day);
    const terra = [...new Set(Object.values(G.SIGLE_TERRA))];
    const chip = v => `<button type="button" class="chip ag-dest-chip" data-code="${esc(v)}" data-act="rich-scegli" data-k="${esc(`${r.agent.id}|${r.day}`)}" data-v="${esc(v)}">${esc(nomeTurno(v))}</button>`;
    const gruppo = (t, lista) => `<p>${t}</p><div class="pop-chips">${lista.map(chip).join('')}</div>`;
    return `<div class="pop-dest ag-dest">${gruppo('Assenze', ['RIP', 'MAL', 'CON', 'FERIE', 'F.P.'])}${gruppo('A terra', ['LD', 'LAV', ...terra, 'TERRA'])}${gruppo('Su una corsa', [...new Set([...navi, ...NM.TUTTI_I_TURNI])])}</div>`;
  }

  function render() {
    const day = NM.state.day;
    if (!NM.state.schedule) { view.innerHTML = '<p class="empty">Caricamento turni…</p>'; return; }
    // cambiato = turno diverso da quello previsto per un cambio del Movimento
    // cambiato = il turno di oggi e' diverso da quello previsto; origine: decisione del Movimento (v) o cambio fatto dall'agente nella Distinta
    const rows = NM.agenti(day).map(r => {
      const v = NM.variazioneMovimento(day, r.agent.id);
      const previsto = NM.turnoPrevisto(r.agent, day);
      const cambiato = !stesso(r.turno, previsto);
      const manuale = G.modificaManuale?.(r.agent.id, day);
      return { ...r, grado:G.gradoOf(r.agent), v, previsto, cambiato, dist: cambiato && !v && manuale !== undefined };
    });
    const residenze = [...new Set(rows.map(r => r.residenza))].sort((a, b) => a.localeCompare(b, 'it'));
    const q = G.norm(ui.q);
    const visibili = rows.filter(r => !q || G.norm(r.agent.agente).includes(q));
    document.getElementById('agenti-count').textContent = String(visibili.length);
    // richieste di cambio turno fatte dagli agenti dalla Distinta, da approvare
    const dmy = d => d.split('-').reverse().join('/');
    const rich = NM.richieste();
    const chiave = r => `${r.agent.id}|${r.day}`;
    const richieste = rich.length ? `<section class="ag-richieste"><h3>Richieste di cambio turno <span class="count">${rich.length}</span></h3>` +
      rich.map(r => { const [sigla, colore] = ICONE[G.gradoOf(r.agent)[0]] || ['?', '#94a3b8']; const k = chiave(r); return `<div class="ag-rich"><span class="ag-icona" style="--g:${colore}">${sigla}</span>` +
        `<span class="ag-rich-testo"><b style="color:${colore}">${esc(r.agent.agente)}</b> · ${esc(dmy(r.day))}<small>dalla Distinta: <s>${esc(nomeTurno(r.deciso || r.previsto))}</s> → <b>${esc(nomeTurno(r.turno))}</b>${r.deciso ? ' · il Movimento aveva deciso ' + esc(nomeTurno(r.deciso)) : ''}</small></span>` +
        `<span class="ag-rich-azioni"><button type="button" class="btn primary" data-act="rich-approva" data-k="${esc(k)}">✓ Approva</button>` +
        `<button type="button" class="btn ghost" data-act="rich-modifica" data-k="${esc(k)}">Modifica…</button>` +
        `<button type="button" class="btn danger" data-act="rich-rifiuta" data-k="${esc(k)}" title="Resta il turno previsto: ${esc(nomeTurno(r.previsto))}">✗ Rifiuta</button></span>` +
        `${ui.modifica === k ? destinazioniRichiesta(r) : ''}</div>`; }).join('') + '</section>' : '';
    const filtro = `<div class="toolbar">
        <div class="agenti-res" title="Apre o chiude le residenze"><button type="button" class="nave-chip${residenze.length && residenze.every(r => ui.aperte.has(r)) ? ' on' : ''}" data-res="">Tutte</button>${residenze.map(r => `<button type="button" class="nave-chip${ui.aperte.has(r) ? ' on' : ''}" data-res="${esc(r)}">${esc(titolo(r))}</button>`).join('')}</div>
        <label>Cerca<input id="agenti-q" type="search" value="${esc(ui.q)}" placeholder="Nome agente" autocomplete="off"></label></div>`;
    const gruppi = residenze.map(res => {
      // in alto chi ha avuto un cambio turno, poi per grado (capitano e capo timoniere pari grado) e anzianita' del prospetto
      const lista = visibili.filter(r => r.residenza === res).sort((a, b) => (b.cambiato - a.cambiato) || a.grado[2] - b.grado[2] || anz(a) - anz(b) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it'));
      if (!lista.length) return '';
      const modificati = lista.filter(r => r.cambiato).length;
      // le residenze partono chiuse; i pulsanti in alto e la testata le aprono o chiudono; cercando un nome restano aperte
      const chiusa = !ui.aperte.has(res) && !q;
      const testata = `<button type="button" class="ag-res-head${chiusa ? ' chiusa' : ''}" data-act="res-toggle" data-res-nome="${esc(res)}" aria-expanded="${!chiusa}">` +
        `<span class="ag-freccia">${chiusa ? '▸' : '▾'}</span><span class="ag-res-nome">${esc(titolo(res))}</span><span class="count">${lista.length}</span>` +
        `${modificati ? `<span class="ag-modificato" title="Turni cambiati dal Movimento in questa residenza">modificato${modificati > 1 ? ` · ${modificati}` : ''}</span>` : ''}</button>`;
      if (chiusa) return testata;
      const righe = lista.map(r => {
        const { v, cambiato, dist, previsto } = r;
        const [sigla, colore] = ICONE[r.grado[0]] || ['?', '#94a3b8'];
        const aperto = ui.aperto === String(r.agent.id);
        return `<li class="${cambiato ? 'cambiato' : ''}${aperto ? ' aperto' : ''}"><div class="ag-riga">` +
          `<span class="ag-nome" style="color:${r.grado[1]}">${esc(r.agent.agente)}</span>` +
          `<span class="ag-icona" style="--g:${colore}" title="${esc(r.grado[0] || r.agent.qualifica || '')}">${sigla}</span>` +
          `<span class="ag-anz" title="Anzianità nel prospetto dei turni">${anzTesto(r)}</span>` +
          `<span class="ag-turno"><button type="button" class="chip ag-turno-btn" data-code="${esc(r.turno || '—')}" data-act="turno-apri" data-id="${esc(r.agent.id)}" aria-expanded="${aperto}" aria-label="Turno di ${esc(r.agent.agente)}">${esc(nomeTurno(r.turno))} ▾</button>` +
          `${dist ? `<span class="ag-dist" title="Turno cambiato dall'agente dalla sua Distinta (previsto: ${esc(nomeTurno(previsto) )})">Distinta</span>` : ''}${cambiato ? `<button type="button" class="btn ghost" data-undo="${esc(r.agent.id)}" title="Torna al turno previsto (${esc(nomeTurno(previsto))})">↺ ${esc(nomeTurno(previsto))}</button>` : ''}</span></div>` +
          `${aperto ? destinazioni(rows, r) : ''}</li>`;
      }).join('');
      return `${testata}<div class="ag-intest"><span>Agente</span><span>Grado</span><span title="Posizione nel prospetto dei turni">Anz.</span><span>Turno del giorno</span></div><ul class="ag-list">${righe}</ul>`;
    }).join('');
    view.innerHTML = filtro + richieste + (gruppi || '<p class="empty">Nessun agente.</p>');
  }

  view.addEventListener('click', event => {
    const res = event.target.closest('[data-res]');
    if (res) {
      // i pulsanti in alto aprono o chiudono la residenza (Tutte: tutte insieme), non filtrano l'elenco
      const nome = res.dataset.res;
      const tutte = [...new Set(NM.agenti(NM.state.day).map(r => r.residenza))];
      if (!nome) ui.aperte = tutte.every(r => ui.aperte.has(r)) ? new Set() : new Set(tutte);
      else if (ui.aperte.has(nome)) ui.aperte.delete(nome); else ui.aperte.add(nome);
      ui.aperto = '';
      render(); return;
    }
    const toggle = event.target.closest('[data-act="res-toggle"]');
    if (toggle) {
      const nome = toggle.dataset.resNome;
      if (ui.aperte.has(nome)) ui.aperte.delete(nome); else ui.aperte.add(nome);
      ui.aperto = '';
      render();
      return;
    }
    const azione = event.target.closest('[data-act^="rich-"]');
    if (azione) {
      const [id, day] = String(azione.dataset.k).split('|');
      const r = NM.richieste().find(x => String(x.agent.id) === id && x.day === day);
      if (!r) return;
      if (azione.dataset.act === 'rich-modifica') { ui.modifica = ui.modifica === azione.dataset.k ? '' : azione.dataset.k; render(); return; }
      ui.modifica = '';
      NM.decidiRichiesta(r, azione.dataset.act === 'rich-approva' ? 'approva' : azione.dataset.act === 'rich-rifiuta' ? 'rifiuta' : azione.dataset.v);
      return;
    }
    const undo = event.target.closest('[data-undo]');
    if (undo) {
      // torna al turno previsto, anche sopra a un cambio fatto dall'agente nella Distinta
      const riga = NM.agenti(NM.state.day).find(a => String(a.agent.id) === String(undo.dataset.undo));
      const previsto = riga ? NM.turnoPrevisto(riga.agent, NM.state.day) : '';
      NM.variazione(undo.dataset.undo, previsto || '', `${riga?.agent.agente || ''}: torna il turno previsto${previsto ? ` (${nomeTurno(previsto)})` : ''}.`);
      return;
    }
    const apri = event.target.closest('[data-act="turno-apri"]');
    if (apri) { ui.aperto = ui.aperto === apri.dataset.id ? '' : apri.dataset.id; render(); return; }
    if (event.target.closest('[data-act="sovr-toggle"]')) { ui.sovr = !ui.sovr; render(); return; }
    const scegli = event.target.closest('[data-act="turno-scegli"]');
    if (scegli) {
      const riga = NM.agenti(NM.state.day).find(a => String(a.agent.id) === String(scegli.dataset.id));
      ui.aperto = '';
      const v = scegli.dataset.v;
      // sulle corse si puo' scegliere il sovrannumero: turno con asterisco (D1*), fuori dal minimo della nave
      const comeSovr = ui.sovr && [...NM.turniCodici(NM.state.day), ...NM.TUTTI_I_TURNI].includes(v);
      ui.sovr = false;
      NM.variazione(scegli.dataset.id, comeSovr ? `${v}*` : v, `${riga?.agent.agente || ''}: turno ${nomeTurno(v)}${comeSovr ? ' in sovrannumero (' + v + '*)' : ''}.`, comeSovr ? { aggiunto: true, sovrannumero: true } : {});
    }
  });
  view.addEventListener('input', event => {
    if (event.target.id !== 'agenti-q') return;
    ui.q = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const el = document.getElementById('agenti-q');
    el.focus(); el.setSelectionRange(pos, pos);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.aperto) { ui.aperto = ''; if (NM.state.tab === 'agenti') render(); } });

  NM.vista('agenti', render, { onDay: () => { ui.aperto = ''; ui.sovr = false; } });
})();
