// NaviDiaria · Riepilogo dell'anno dell'agente: una riga per mese (mesi di competenza, come la Distinta) e tutte le
// competenze in colonna, con il totale. Sotto la Distinta mensile e il riquadro della trasformazione.
(() => {
  const B = window.NaviDiariaBackup;
  const grid = document.getElementById('monthlySheetGrid');
  if (!B?.tabellaAnno || !grid) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHIAVE = 'navidiaria.annoAperto';
  const aperti = new Set(); // mesi aperti (annidati)

  const box = document.createElement('details');
  box.className = 'diaria-anno';
  try { box.open = localStorage.getItem(CHIAVE) !== '0'; } catch { box.open = true; }
  box.addEventListener('toggle', () => { try { localStorage.setItem(CHIAVE, box.open ? '1' : '0'); } catch { /* niente */ } });
  (document.querySelector('.hero-convert') || grid).insertAdjacentElement('afterend', box);

  function render() {
    const list = (typeof entries !== 'undefined' ? entries : []).filter(e => e?.date);
    const anno = String(document.getElementById('monthFilter')?.value || new Date().toISOString()).slice(0, 4);
    const conv = window.NaviDiariaConversione?.mappa?.() || {};
    box.innerHTML = `<summary>Riepilogo dell'anno ${esc(anno)}</summary>` +
      '<p class="anno-nota">Tocca un mese per vedere i suoi giorni (colonna Giorni = turno; riga gialla = settimana, straordinario oltre 39 h). Mesi di competenza come nella Distinta; straordinari: ore oltre le 39 settimanali.</p>' +
      `<div class="anno-wrap">${B.tabellaAnno(list, conv, anno, aperti)}</div>`;
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
