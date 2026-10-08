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

  const ui = { res:'', q:'', aperto:'', aperte:new Set() };
  const titolo = text => String(text).charAt(0) + String(text).slice(1).toLowerCase();
  // Pallino del grado (sigla e colore come nelle Corse).
  const ICONE = { Comandante: ['Cap', '#facc15'], 'Capo timoniere': ['CT', '#fb923c'], Timoniere: ['Tim', '#22c55e'], Motorista: ['Mot', '#a855f7'],
    'Aiuto motorista': ['AM', '#3b82f6'], Marinaio: ['Mar', '#e8f3f6'] };
  const NOMI = { RIP: 'Riposo', MAL: 'Malattia', CON: 'Congedo', FERIE: 'Ferie', 'F.P.': 'F.P.', LD: 'L.D.', LAV: 'Lavori' };
  const nomeTurno = t => NOMI[t] || t || '—';

  // Anzianita' del prospetto dei turni (posizione, 1 = la piu' anziana); chi non c'e' va in fondo.
  const anz = r => window.NaviSharedData?.seniorityRank?.(r.agent.agente) ?? Number.POSITIVE_INFINITY;
  const anzTesto = r => (Number.isFinite(anz(r)) ? String(anz(r) + 1) : '—');
  const stesso = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

  // Destinazioni: come nel menu dello sbarco delle Corse, piu' i servizi a terra e il turno attuale se insolito.
  function destinazioni(rows, r) {
    const navi = NM.turniCodici(NM.state.day);
    const terra = [...new Set(Object.values(G.SIGLE_TERRA))];
    const noti = new Set([...Object.keys(NOMI), ...navi, ...terra, ...NM.TUTTI_I_TURNI]);
    const altri = [...new Set([...rows.map(x => x.turno), r.turno].filter(t => t && !noti.has(t)))].sort();
    const chip = v => `<button type="button" class="pop-chip${stesso(v, r.turno) ? ' on' : ''}" data-act="turno-scegli" data-id="${esc(r.agent.id)}" data-v="${esc(v)}">${esc(nomeTurno(v))}</button>`;
    const gruppo = (titoloGruppo, lista) => (lista.length ? `<p>${titoloGruppo}</p><div class="pop-chips">${lista.map(chip).join('')}</div>` : '');
    return `<div class="pop-dest ag-dest">${gruppo('Assenze', ['RIP', 'MAL', 'CON', 'FERIE', 'F.P.'])}${gruppo('A terra', ['LD', 'LAV', ...terra])}` +
      `${gruppo('Su una corsa', [...new Set([...navi, ...NM.TUTTI_I_TURNI])])}${gruppo('Altri', altri)}</div>`;
  }

  function render() {
    const day = NM.state.day;
    if (!NM.state.schedule) { view.innerHTML = '<p class="empty">Caricamento turni…</p>'; return; }
    // cambiato = turno diverso da quello previsto per un cambio del Movimento
    const rows = NM.agenti(day).map(r => { const v = NM.variazioneMovimento(day, r.agent.id); return { ...r, grado:G.gradoOf(r.agent), v, cambiato: !!v && !stesso(v.turno_originale, r.turno) }; });
    const residenze = [...new Set(rows.map(r => r.residenza))].sort((a, b) => a.localeCompare(b, 'it'));
    if (ui.res && !residenze.includes(ui.res)) ui.res = '';
    const q = G.norm(ui.q);
    const visibili = rows.filter(r => (!ui.res || r.residenza === ui.res) && (!q || G.norm(r.agent.agente).includes(q)));
    document.getElementById('agenti-count').textContent = String(visibili.length);
    const filtro = `<div class="toolbar">
        <div class="agenti-res"><button type="button" class="nave-chip${ui.res ? '' : ' on'}" data-res="">Tutte</button>${residenze.map(r => `<button type="button" class="nave-chip${ui.res === r ? ' on' : ''}" data-res="${esc(r)}">${esc(titolo(r))}</button>`).join('')}</div>
        <label>Cerca<input id="agenti-q" type="search" value="${esc(ui.q)}" placeholder="Nome agente" autocomplete="off"></label></div>`;
    const gruppi = (ui.res ? [ui.res] : residenze).map(res => {
      // in alto chi ha avuto un cambio turno, poi per grado (capitano e capo timoniere pari grado) e anzianita' del prospetto
      const lista = visibili.filter(r => r.residenza === res).sort((a, b) => (b.cambiato - a.cambiato) || a.grado[2] - b.grado[2] || anz(a) - anz(b) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it'));
      if (!lista.length) return '';
      const modificati = lista.filter(r => r.cambiato).length;
      // con "Tutte" le residenze partono chiuse; scegliendone una si apre; cercando un nome restano aperte
      const chiusa = !ui.aperte.has(res) && !q;
      const testata = `<button type="button" class="ag-res-head${chiusa ? ' chiusa' : ''}" data-act="res-toggle" data-res-nome="${esc(res)}" aria-expanded="${!chiusa}">` +
        `<span class="ag-freccia">${chiusa ? '▸' : '▾'}</span><span class="ag-res-nome">${esc(titolo(res))}</span><span class="count">${lista.length}</span>` +
        `${modificati ? `<span class="ag-modificato" title="Turni cambiati dal Movimento in questa residenza">modificato${modificati > 1 ? ` · ${modificati}` : ''}</span>` : ''}</button>`;
      if (chiusa) return testata;
      const righe = lista.map(r => {
        const { v, cambiato } = r;
        const [sigla, colore] = ICONE[r.grado[0]] || ['?', '#94a3b8'];
        const aperto = ui.aperto === String(r.agent.id);
        return `<li class="${cambiato ? 'cambiato' : ''}${aperto ? ' aperto' : ''}"><div class="ag-riga">` +
          `<span class="ag-nome" style="color:${r.grado[1]}">${esc(r.agent.agente)}</span>` +
          `<span class="ag-icona" style="--g:${colore}" title="${esc(r.grado[0] || r.agent.qualifica || '')}">${sigla}</span>` +
          `<span class="ag-anz" title="Anzianità nel prospetto dei turni">${anzTesto(r)}</span>` +
          `<span class="ag-turno"><button type="button" class="chip ag-turno-btn" data-code="${esc(r.turno || '—')}" data-act="turno-apri" data-id="${esc(r.agent.id)}" aria-expanded="${aperto}" aria-label="Turno di ${esc(r.agent.agente)}">${esc(nomeTurno(r.turno))} ▾</button>` +
          `${cambiato ? `<button type="button" class="btn ghost" data-undo="${esc(r.agent.id)}" title="Torna al turno previsto (era ${esc(v.turno_originale || '—')})">↺ ${esc(nomeTurno(String(v.turno_originale || '').toUpperCase()))}</button>` : ''}</span></div>` +
          `${aperto ? destinazioni(rows, r) : ''}</li>`;
      }).join('');
      return `${testata}<div class="ag-intest"><span>Agente</span><span>Grado</span><span title="Posizione nel prospetto dei turni">Anz.</span><span>Turno del giorno</span></div><ul class="ag-list">${righe}</ul>`;
    }).join('');
    view.innerHTML = filtro + (gruppi || '<p class="empty">Nessun agente.</p>');
  }

  view.addEventListener('click', event => {
    const res = event.target.closest('[data-res]');
    if (res) {
      ui.res = res.dataset.res; ui.aperto = '';
      // "Tutte": tutte chiuse; una residenza scelta: aperta
      ui.aperte = new Set(ui.res ? [ui.res] : []);
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
    const undo = event.target.closest('[data-undo]');
    if (undo) { NM.variazione(undo.dataset.undo, '', 'Variazione del turno annullata.'); return; }
    const apri = event.target.closest('[data-act="turno-apri"]');
    if (apri) { ui.aperto = ui.aperto === apri.dataset.id ? '' : apri.dataset.id; render(); return; }
    const scegli = event.target.closest('[data-act="turno-scegli"]');
    if (scegli) {
      const riga = NM.agenti(NM.state.day).find(a => String(a.agent.id) === String(scegli.dataset.id));
      ui.aperto = '';
      NM.variazione(scegli.dataset.id, scegli.dataset.v, `${riga?.agent.agente || ''}: turno ${nomeTurno(scegli.dataset.v)}.`);
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

  NM.vista('agenti', render, { onDay: () => { ui.aperto = ''; } });
})();
