/*
 * NaviSuite · Movimento — tab Agenti: elenco per residenza e grado con il turno del giorno scelto,
 * modificabile con un menu di tutti i turni (variazione manuale del Movimento, come l'equipaggio delle Corse).
 */
(() => {
  'use strict';

  const NM = window.NaviMovimento;
  const view = document.getElementById('agenti-view');
  if (!NM || !view) return;
  const { G } = NM;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const ASSENZE = [['RIP', 'Riposo'], ['MAL', 'Malattia'], ['CON', 'Congedo'], ['FERIE', 'Ferie']];
  const ui = { res:'', q:'' };
  const titolo = text => String(text).charAt(0) + String(text).slice(1).toLowerCase();

  // Tutti i turni scegliibili: navi in servizio, servizi a terra, assenze, piu' quelli che compaiono nei dati del giorno.
  function opzioni(rows, corrente) {
    const navi = [...new Set([...NM.turniCodici(NM.state.day), ...NM.TUTTI_I_TURNI])];
    const terra = Object.keys(G.SIGLE_TERRA);
    const noti = new Set([...navi, ...terra, ...ASSENZE.map(a => a[0])]);
    const altri = [...new Set(rows.map(r => r.turno).filter(t => t && !noti.has(t)))].sort();
    if (corrente && !noti.has(corrente) && !altri.includes(corrente)) altri.push(corrente);
    const o = list => list.map(t => `<option value="${esc(t)}"${t === corrente ? ' selected' : ''}>${esc(t)}</option>`).join('');
    return `<option value=""${corrente ? '' : ' selected'}>—</option>` +
      `<optgroup label="Navi">${o(navi)}</optgroup><optgroup label="A terra">${o(terra)}</optgroup>` +
      `<optgroup label="Riposo e assenze">${ASSENZE.map(([c, l]) => `<option value="${c}"${c === corrente ? ' selected' : ''}>${l} (${c})</option>`).join('')}</optgroup>` +
      (altri.length ? `<optgroup label="Altri">${o(altri)}</optgroup>` : '');
  }

  // Anzianita' del prospetto dei turni (posizione, 1 = la piu' anziana); chi non c'e' va in fondo.
  const anz = r => window.NaviSharedData?.seniorityRank?.(r.agent.agente) ?? Number.POSITIVE_INFINITY;
  const anzTesto = r => (Number.isFinite(anz(r)) ? String(anz(r) + 1) : '—');
  const stesso = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

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
      // per grado (capitano e capo timoniere pari grado, come in NaviTurni) e dentro il grado per anzianita' del prospetto
      // in alto chi ha avuto un cambio turno, poi sempre per grado e anzianita'
      const lista = visibili.filter(r => r.residenza === res).sort((a, b) => (b.cambiato - a.cambiato) || a.grado[2] - b.grado[2] || anz(a) - anz(b) || String(a.agent.agente).localeCompare(String(b.agent.agente), 'it'));
      if (!lista.length) return '';
      const righe = lista.map(r => {
        const { v, cambiato } = r;
        return `<li${cambiato ? ' class="cambiato"' : ''}><span class="ag-nome" style="color:${r.grado[1]}">${esc(r.agent.agente)}</span><span class="ag-grado" style="color:${r.grado[1]}">${esc(r.grado[0] || r.agent.qualifica || '')}</span><span class="ag-anz" title="Anzianità nel prospetto dei turni">${anzTesto(r)}</span>` +
          `<span class="ag-turno"><select data-id="${esc(r.agent.id)}" aria-label="Turno di ${esc(r.agent.agente)}">${opzioni(rows, r.turno)}</select>` +
          `${cambiato ? `<button type="button" class="btn ghost" data-undo="${esc(r.agent.id)}" title="Torna al turno previsto (era ${esc(v.turno_originale || '—')})">↺ ${esc(v.turno_originale || '—')}</button>` : ''}</span></li>`;
      }).join('');
      return `<h3 class="ag-res">${esc(titolo(res))} <span class="count">${lista.length}</span></h3><div class="ag-intest"><span>Agente</span><span>Grado</span><span title="Posizione nel prospetto dei turni">Anz.</span><span>Turno del giorno</span></div><ul class="ag-list">${righe}</ul>`;
    }).join('');
    view.innerHTML = filtro + (gruppi || '<p class="empty">Nessun agente.</p>');
  }

  view.addEventListener('click', event => {
    const res = event.target.closest('[data-res]');
    if (res) { ui.res = res.dataset.res; render(); return; }
    const undo = event.target.closest('[data-undo]');
    if (undo) NM.variazione(undo.dataset.undo, '', 'Variazione del turno annullata.');
  });
  view.addEventListener('input', event => {
    if (event.target.id !== 'agenti-q') return;
    ui.q = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const el = document.getElementById('agenti-q');
    el.focus(); el.setSelectionRange(pos, pos);
  });
  view.addEventListener('change', event => {
    const el = event.target;
    if (!el.matches('select[data-id]')) return;
    const nome = el.getAttribute('aria-label').replace(/^Turno di /, '');
    if (!el.value) { NM.variazione(el.dataset.id, '', `${nome}: variazione annullata.`); return; }
    NM.variazione(el.dataset.id, el.value, `${nome}: turno ${el.value}.`);
  });

  NM.vista('agenti', render);
})();
