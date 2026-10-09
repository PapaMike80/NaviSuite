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
  // il mese aperto: settimane con i giorni, ore e straordinario oltre 39 h
  function annidato(ws) {
    const righe = ws.map(w => w.giorni.map(e => {
      const d = new Date(`${e.date}T12:00:00`), on = lavoro(e), c = B.causali(e), str = c.ritardo + c.cambio + c.sentine;
      return `<tr class="${on ? '' : 'rip'}"><td>${GIORNI[d.getDay()]} ${fmt(e.date)}</td><td>${esc(e.shift || '')}</td><td>${on ? ore(B.lavorate(e)) : ''}</td>` +
        `<td>${on && str ? ore(str) : ''}</td><td>${ore(e.bank)}</td><td>${on && (e.ticketPresence ?? e.mealUsed) ? 'sì' : ''}</td>` +
        `<td>${on && e.allowanceRate != null ? `${e.allowanceRate}%` : ''}</td><td>${esc(e.note || '')}</td></tr>`;
    }).join('') + `<tr class="sett"><td colspan="2">Settimana ${fmt(w.dal)} – ${fmt(w.al)}</td><td>${ore(w.lavorate)}</td>` +
      `<td colspan="5">${w.straordinario ? `straordinario <b>${ore(w.straordinario)}</b> (oltre 39 h)` : 'nessuno straordinario'}</td></tr>`).join('');
    return `<table class="giorni"><thead><tr><th>Giorno</th><th>Turno</th><th>Lavorate</th><th>Straord. giorno</th><th>Banca</th><th>Ticket</th><th>Diaria</th><th>Note</th></tr></thead><tbody>${righe}</tbody></table>`;
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
        (aperti.has(mese) ? `<tr class="annidato"><td colspan="${B.COMPETENZE.length + 1}"><div class="annidato-box">${annidato(ws)}</div></td></tr>` : '')
        : `<tr class="vuoto"><td class="fisso">${esc(nome)}</td><td colspan="${B.COMPETENZE.length}">—</td></tr>`;
    }).join('');
    const tot = B.competenze(list, conv, anno, sett);
    box.innerHTML = `<summary>Riepilogo dell'anno ${esc(anno)}</summary>` +
      '<p class="anno-nota">Tocca un mese per vedere i suoi giorni. Mesi di competenza come nella Distinta; straordinari: ore oltre le 39 settimanali.</p>' +
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
