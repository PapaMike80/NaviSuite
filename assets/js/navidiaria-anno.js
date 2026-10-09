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
      return c.giorni ? `<tr><td class="fisso">${esc(nome)}</td>${B.COMPETENZE.map(col => `<td${col[0] === 'straordinari' ? ' class="forte"' : ''}>${esc(valore(c, col))}</td>`).join('')}</tr>`
        : `<tr class="vuoto"><td class="fisso">${esc(nome)}</td><td colspan="${B.COMPETENZE.length}">—</td></tr>`;
    }).join('');
    const tot = B.competenze(list, conv, anno, sett);
    box.innerHTML = `<summary>Riepilogo dell'anno ${esc(anno)}</summary>` +
      '<p class="anno-nota">Mesi di competenza come nella Distinta. Straordinari: ore oltre le 39 settimanali.</p>' +
      `<div class="anno-wrap"><table><thead><tr><th class="fisso">Mese</th>${B.COMPETENZE.map(([, t]) => `<th>${esc(t)}</th>`).join('')}</tr></thead>` +
      `<tbody>${righe}<tr class="tot"><td class="fisso">Totale ${esc(anno)}</td>${B.COMPETENZE.map(col => `<td${col[0] === 'straordinari' ? ' class="forte"' : ''}>${esc(valore(tot, col))}</td>`).join('')}</tr></tbody></table></div>`;
  }
  window.NaviDiariaAnno = { render };
  document.addEventListener('navidiaria:render', () => setTimeout(render, 0));
  render();
})();
