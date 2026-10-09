// Pagina Agenti · sezione "Accesso alle pagine": per ogni pagina i ruoli che la possono aprire (gli admin sempre).
// Salva in private/adminUpdates/pageAccess {pagina: [ruoli]}; il controllo vale su ogni pagina (shared-roles.js).
(() => {
  const list = document.getElementById('page-access-list');
  const R = window.NaviRoles;
  if (!list || !R?.PAGINE) return;
  const status = document.getElementById('page-access-status');
  const count = document.getElementById('page-access-count');
  let access = {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uguali = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  function render() {
    let cambiate = 0;
    list.innerHTML = R.PAGINE.map(([file, nome]) => {
      const ruoli = R.consentiti(file, access), diversa = !uguali(ruoli, R.predefiniti(file));
      if (diversa) cambiate += 1;
      return `<div class="page-access-row${diversa ? ' admin' : ''}"><strong>${esc(nome)}</strong><div class="page-access-roles">` +
        '<label class="pa-role on fixed" title="Gli admin vedono sempre tutte le pagine"><input type="checkbox" checked disabled>Admin</label>' +
        R.RUOLI.map(([ruolo, etichetta]) => `<label class="pa-role${ruoli.includes(ruolo) ? ' on' : ''}"><input type="checkbox" data-page="${esc(file)}" data-ruolo="${ruolo}"${ruoli.includes(ruolo) ? ' checked' : ''}>${esc(etichetta)}</label>`).join('') +
        '</div></div>';
    }).join('');
    count.textContent = String(cambiate);
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
  });
  (async () => {
    try {
      await window.NaviAdminFirebase.ready;
      access = await window.NaviAdminFirebase.getPageAccess() || {};
    } catch (error) { status.textContent = `Accessi non letti: ${error.message}`; }
    render();
  })();
})();
