// Pagina Agenti · sezione "Accesso alle pagine": per ogni pagina "Tutti" o "Solo admin".
// Salva in private/adminUpdates/pageAccess; il controllo vale su ogni pagina (shared-roles.js).
(() => {
  const list = document.getElementById('page-access-list');
  const R = window.NaviRoles;
  if (!list || !R?.PAGINE) return;
  const status = document.getElementById('page-access-status');
  const count = document.getElementById('page-access-count');
  let access = {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function render() {
    list.innerHTML = R.PAGINE.map(([file, nome]) => {
      const admin = access[file] === 'admin';
      return `<label class="page-access-row${admin ? ' admin' : ''}"><strong>${esc(nome)}</strong>` +
        `<select data-page="${esc(file)}" aria-label="Chi può aprire ${esc(nome)}"><option value="tutti"${admin ? '' : ' selected'}>Tutti</option><option value="admin"${admin ? ' selected' : ''}>Solo admin</option></select></label>`;
    }).join('');
    count.textContent = String(R.PAGINE.filter(([file]) => access[file] === 'admin').length);
  }
  list.addEventListener('change', async event => {
    const select = event.target.closest('[data-page]');
    if (!select) return;
    const prima = { ...access };
    access = { ...access, [select.dataset.page]: select.value };
    if (select.value !== 'admin') delete access[select.dataset.page];
    render();
    status.textContent = 'Salvataggio…';
    try {
      const { updatedAt, ...pulito } = access;
      access = await window.NaviAdminFirebase.savePageAccess(pulito);
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
