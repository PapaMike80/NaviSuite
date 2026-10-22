// Pagina Agenti · sezione "Accesso alle pagine": per ogni pagina i ruoli che la possono aprire (gli admin sempre) e la sezione
// del menu in cui sta (si sposta trascinando). Salva in private/adminUpdates/pageAccess {pagina: [ruoli], sezioni: {pagina: sezione}};
// il controllo vale su ogni pagina (shared-roles.js).
(() => {
  const list = document.getElementById('page-access-list');
  const R = window.NaviRoles;
  if (!list || !R?.PAGINE) return;
  const status = document.getElementById('page-access-status');
  const count = document.getElementById('page-access-count');
  let access = {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uguali = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  // Stessi icone e colori del menu (assets/js/shared-menu.js)
  const VOCI = { 'mio-turno.html': ['⚑', '#2dd4bf'], 'orario.html': ['⚓', '#38bdf8'], 'naviturni.html': ['▦', '#2dd4bf'], 'oggi.html': ['☀', '#facc15'], 'navidiaria.html': ['≈', '#fb923c'],
    'orari.html': ['🕒', '#fbbf24'], 'cambi_turno.html': ['⇄', '#a78bfa'], 'documenti.html': ['▤', '#f59e0b'], 'controllo_cassa.html': ['$', '#27a9b6'], 'backup-dati.html': ['⤓', '#67d7e6'],
    'impostazioni.html': ['⚙', '#94a3b8'], 'quiz.html': ['✎', '#f472b6'], 'comitive.html': ['⛴', '#67d7e6'], 'verifica-busta.html': ['✔', '#4ade80'],
    'agenti.html': ['♙', '#fb7185'], 'movimento.html': ['⚓', '#38bdf8'], 'collegamenti.html': ['⇆', '#f59e0b'] };
  const SOTTOTITOLI = { 'navidiaria.html': 'Ore, ritardi e competenze', 'mio-turno.html': 'Nave, corse e colleghi', 'naviturni.html': 'Turni di tutti gli agenti', 'oggi.html': 'Navi ed equipaggi del giorno', 'orario.html': 'Navi allo scalo, pontili, ritardi' };
  const ORDINE = ['navidiaria.html', 'mio-turno.html', 'naviturni.html', 'oggi.html', 'orario.html'];
  if (!document.getElementById('pa-style')) {
    const style = document.createElement('style');
    style.id = 'pa-style';
    style.textContent = '#page-access-list{display:block}.pa-titolo{margin:18px 2px 8px;color:#9fb8c2;font:800 11px Manrope,system-ui,sans-serif;letter-spacing:.14em}' +
      '.pa-guida{margin:0 0 4px;color:#9fb8c2;font-size:12px}' +
      '.pa-grid{display:grid;gap:9px;min-height:64px;padding:4px;border:1px dashed transparent;border-radius:18px}' +
      '.pa-grid[data-sez=principali]{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}' +
      '.pa-grid:not([data-sez=principali]){grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}' +
      '.pa-grid:empty::before{content:"Trascina qui una pagina";display:grid;place-items:center;grid-column:1/-1;min-height:56px;color:#6f8d96;font-size:12px}' +
      '.pa-grid.pa-over{border-color:#2dd4bf;background:rgba(45,212,191,.07)}' +
      '.pa-tile{position:relative;display:flex;flex-direction:column;gap:8px;padding:13px 12px;border:1px solid #285560;border-radius:16px;background:rgba(255,255,255,.025);color:#e8f7f7;min-width:0}' +
      '.pa-tile.diversa{border-color:#f59e0b;background:rgba(245,158,11,.08)}.pa-tile.pa-dragging{opacity:.35}' +
      '.pa-ghost{box-shadow:0 14px 34px rgba(0,0,0,.45);background:#0d2a35;transform:rotate(1.5deg)}' +
      '.pa-head{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}' +
      '.pa-head>span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);font-size:19px;flex:none}' +
      '.pa-head b{display:block;font:800 17px/1.15 Manrope,system-ui,sans-serif}.pa-head small{display:block;margin-top:3px;color:#9fb8c2;font:600 12.5px/1.3 "DM Sans",system-ui,sans-serif}' +
      '.pa-grid:not([data-sez=principali]) .pa-tile{align-items:center;text-align:center;padding:10px 6px}' +
      '.pa-grid:not([data-sez=principali]) .pa-head{align-items:center}.pa-grid:not([data-sez=principali]) .pa-head>span{width:32px;height:32px;font-size:16px;border-radius:10px}' +
      '.pa-grid:not([data-sez=principali]) .pa-head b{font-size:12.5px}' +
      '.pa-grid[data-sez=principali] .pa-tile.pa-wide{grid-column:1/-1;flex-direction:column}' +
      '.pa-grip{position:absolute;top:6px;right:6px;width:30px;height:30px;border:0;border-radius:9px;background:transparent;color:#7fa3ad;font-size:17px;cursor:grab;touch-action:none}.pa-grip:hover{background:rgba(255,255,255,.07)}' +
      '.pa-tile .page-access-roles{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-start}' +
      '.pa-grid:not([data-sez=principali]) .page-access-roles{justify-content:center}' +
      '.pa-tile .pa-role{padding:3px 7px;font-size:10.5px}' +
      'html.navisuite-light .pa-tile{background:#fff;border-color:#bdd8dc;color:#17323a}html.navisuite-light .pa-titolo,html.navisuite-light .pa-guida,html.navisuite-light .pa-head small{color:#547078}';
    document.head.append(style);
  }
  const sezioneDi = file => R.sezioneDi(file, access);
  function tessera([file, nome], sezione) {
    const ruoli = R.consentiti(file, access), spostata = sezione !== R.sezionePredefinita(file);
    const diversa = !uguali(ruoli, R.predefiniti(file)) || spostata, [icona, colore] = VOCI[file] || ['•', '#94a3b8'];
    const principale = sezione === 'principali';
    return { diversa, html: `<div class="pa-tile${diversa ? ' diversa' : ''}${principale && file === 'navidiaria.html' ? ' pa-wide' : ''}" data-file="${esc(file)}" style="--c:${colore}" title="${diversa ? 'Diversa dal normale' : ''}">` +
      `<div class="pa-head"><span>${esc(icona)}</span><div><b>${esc(nome)}</b>${principale && SOTTOTITOLI[file] ? `<small>${SOTTOTITOLI[file]}</small>` : ''}</div></div><div class="page-access-roles">` +
      R.RUOLI.map(([ruolo, etichetta]) => `<label class="pa-role${ruoli.includes(ruolo) ? ' on' : ''}"><input type="checkbox" data-page="${esc(file)}" data-ruolo="${ruolo}"${ruoli.includes(ruolo) ? ' checked' : ''}>${esc(etichetta)}</label>`).join('') +
      '</div></div>' };
  }
  function render() {
    let cambiate = 0;
    const sezioni = R.SEZIONI.map(([chiave, titolo]) => {
      const t = R.PAGINE.filter(([f]) => sezioneDi(f) === chiave).sort((x, y) => (R.ordineDi(x[0], access) - R.ordineDi(y[0], access)) || ((ORDINE.indexOf(x[0]) + 99) % 99 - (ORDINE.indexOf(y[0]) + 99) % 99)).map(p => tessera(p, chiave));
      cambiate += t.filter(x => x.diversa).length;
      return `<p class="pa-titolo">${titolo}</p><div class="pa-grid" data-sez="${chiave}">${t.map(x => x.html).join('')}</div>`;
    });
    list.innerHTML = '<p class="pa-guida">Le spunte dicono chi può aprire ogni pagina (gli admin sempre). Per spostare le pagine tra le sezioni: dal menu, tenendo premuta un\'icona (solo admin).</p>' + sezioni.join('');
    count.textContent = String(cambiate);
  }
  async function salva(prima) {
    render();
    status.textContent = 'Salvataggio…';
    try {
      access = await window.NaviAdminFirebase.savePageAccess(access);
      localStorage.setItem('navisuite.pageAccess', JSON.stringify(access));
      status.textContent = 'Salvato: vale per tutti dal prossimo caricamento della pagina.';
    } catch (error) {
      access = prima; render();
      status.textContent = `Non salvato: ${error.message}`;
    }
  }
  list.addEventListener('change', async event => {
    const box = event.target.closest('[data-ruolo]');
    if (!box) return;
    const file = box.dataset.page;
    const ruoli = [...list.querySelectorAll(`[data-page="${file}"][data-ruolo]`)].filter(x => x.checked).map(x => x.dataset.ruolo);
    const prima = { ...access };
    const { updatedAt, ...resto } = access;
    access = { ...resto, [file]: ruoli };
    if (uguali(ruoli, R.predefiniti(file))) delete access[file]; // come di default: niente da salvare
    await salva(prima);
  });

  (async () => {
    try {
      await window.NaviAdminFirebase.ready;
      access = await window.NaviAdminFirebase.getPageAccess() || {};
    } catch (error) { status.textContent = `Accessi non letti: ${error.message}`; }
    render();
  })();
})();
