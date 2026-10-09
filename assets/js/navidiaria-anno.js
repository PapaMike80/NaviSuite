// NaviDiaria · Riepilogo dell'anno dell'agente: una riga per mese (mesi di competenza, come la Distinta) e tutte le
// competenze in colonna, con il totale. Sotto la Distinta mensile e il riquadro della trasformazione.
(() => {
  const B = window.NaviDiariaBackup;
  const grid = document.getElementById('monthlySheetGrid');
  if (!B?.competenze || !grid) return;
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ore = m => { const n = Math.round(Number(m) || 0), a = Math.abs(n); return n ? `${n < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}` : ''; };
  const valore = (c, [k, , tipo]) => (tipo === 'h' ? ore(c[k]) : (c[k] || ''));
  const CHIAVE = 'navidiaria.annoAperto';
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const aperti = new Set(); // mesi aperti (annidati)
  const fmt = iso => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
  const lavoro = e => !!String(e?.shift || '').trim() && !['RIP', 'RIPOSO', 'MALATTIA'].includes(String(e.shift).toUpperCase());
  // il mese aperto: giorni e settimane nelle STESSE colonne del mese (Giorni = turno)
  function annidato(ws, conv, mese) {
    const cella = (k, v) => `<td${k === 'straordinari' ? ' class="forte"' : ''}>${v}</td>`;
    return ws.map(w => w.giorni.map(e => {
      const d = new Date(`${e.date}T12:00:00`), on = lavoro(e), c = B.causali(e);
      const g = on ? B.competenze([e], {}, e.date, [{ giorni: [e], lavorate: 0, straordinario: 0 }]) : {};
      const td = B.COMPETENZE.map(col => {
        const k = col[0];
        if (k === 'giorni') return `<td>${esc(e.shift || '')}</td>`;
        if (!on) return k === 'banca' ? cella(k, ore(e.bank)) : '<td></td>';
        if (k === 'lavorate') return cella(k, ore(B.lavorate(e)));
        if (k === 'straordinari') return cella(k, ore(c.ritardo + c.cambio + c.sentine));
        const v = valore(g, col);
        return cella(k, esc(col[2] === 'h' ? v : (v ? '✓' : '')));
      }).join('');
      return `<tr class="giorno${on ? '' : ' rip'}"${e.note ? ` title="${esc(e.note)}"` : ''}><td class="fisso">${GIORNI[d.getDay()]} ${fmt(e.date)}</td>${td}</tr>`;
    }).join('') + `<tr class="sett"><td class="fisso">Sett. ${fmt(w.dal)} – ${fmt(w.al)}</td>${B.COMPETENZE.map(([k]) =>
      k === 'lavorate' ? cella(k, ore(w.lavorate)) : k === 'straordinari' ? cella(k, w.straordinario ? `<b>${ore(w.straordinario)}</b>` : '0:00') : '<td></td>').join('')}</tr>`).join('');
  }

  const box = document.createElement('details');
  box.className = 'diaria-anno';
  try { box.open = localStorage.getItem(CHIAVE) !== '0'; } catch { box.open = true; }
  box.addEventListener('toggle', () => { try { localStorage.setItem(CHIAVE, box.open ? '1' : '0'); } catch { /* niente */ } });
  (document.querySelector('.hero-convert') || grid).insertAdjacentElement('afterend', box);

  function render() {
    const list = (typeof entries !== 'undefined' ? entries : []).filter(e => e?.date);
    const anno = String(document.getElementById('monthFilter')?.value || new Date().toISOString()).slice(0, 4);
    const conv = window.NaviDiariaConversione?.mappa?.() || {};
    const sett = B.settimaneDi(list, anno);
    const righe = MESI.map((nome, i) => {
      const mese = `${anno}-${String(i + 1).padStart(2, '0')}`, ws = sett.filter(w => w.al.startsWith(mese));
      const c = B.competenze(list, conv, mese, ws);
      if (!c.giorni) aperti.delete(mese);
      return c.giorni ? `<tr class="mese${aperti.has(mese) ? ' aperto' : ''}" data-mese="${mese}" title="Tocca per vedere i giorni"><td class="fisso">${aperti.has(mese) ? '▾' : '▸'} ${esc(nome)}</td>${B.COMPETENZE.map(col => `<td${col[0] === 'straordinari' ? ' class="forte"' : ''}>${esc(valore(c, col))}</td>`).join('')}</tr>` +
        (aperti.has(mese) ? annidato(ws, conv, mese) : '')
        : `<tr class="vuoto"><td class="fisso">${esc(nome)}</td><td colspan="${B.COMPETENZE.length}">—</td></tr>`;
    }).join('');
    const tot = B.competenze(list, conv, anno, sett);
    box.innerHTML = `<summary>Riepilogo dell'anno ${esc(anno)}</summary>` +
      '<p class="anno-nota">Tocca un mese per vedere i suoi giorni (colonna Giorni = turno; riga gialla = settimana, straordinario oltre 39 h). Mesi di competenza come nella Distinta; straordinari: ore oltre le 39 settimanali.</p>' +
      `<div class="anno-wrap"><table><thead><tr><th class="fisso">Mese</th>${B.COMPETENZE.map(([, t]) => `<th>${esc(t)}</th>`).join('')}</tr></thead>` +
      `<tbody>${righe}<tr class="tot"><td class="fisso">Totale ${esc(anno)}</td>${B.COMPETENZE.map(col => `<td${col[0] === 'straordinari' ? ' class="forte"' : ''}>${esc(valore(tot, col))}</td>`).join('')}</tr></tbody></table></div>`;
  }
  box.addEventListener('click', event => {
    const r = event.target.closest('tr.mese[data-mese]');
    if (!r) return;
    if (aperti.has(r.dataset.mese)) aperti.delete(r.dataset.mese); else aperti.add(r.dataset.mese);
    render();
  });
  window.NaviDiariaAnno = { render };
  document.addEventListener('navidiaria:render', () => setTimeout(render, 0));
  render();
})();
