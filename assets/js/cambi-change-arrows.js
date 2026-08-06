(() => {
  const style = document.createElement('style');
  style.textContent = `
    #tbody td.change-request-arrow{position:relative!important}
    #tbody td.change-request-arrow::after{
      content:'⇄';position:absolute;top:0;left:50%;z-index:24;
      transform:translateX(-50%);padding:0 2px;border-radius:4px;
      background:#17222b;color:#ef4444;font-size:13px;line-height:12px;
      font-weight:1000;text-shadow:none;pointer-events:none
    }
    #tbody td.change-request-arrow.change-request-confirmed::after{color:#22c55e}
    #tbody tr.logged-agent-row td.change-request-arrow{position:sticky!important}
    .cambi-change-tooltip{position:fixed;z-index:99999;display:grid;gap:4px;max-width:340px;
      padding:10px 12px;border:1px solid #f59e0b;border-radius:10px;background:#10222c;
      color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.45);font-size:12px;line-height:1.45}
    .cambi-change-tooltip strong{color:#fde68a}.cambi-change-tooltip.confirmed{border-color:#22c55e}
    .cambi-change-tooltip.confirmed strong{color:#86efac}
    .cambi-possible-tooltip{position:fixed;z-index:99999;display:grid;gap:4px;max-width:340px;
      padding:10px 12px;border:1px solid #facc15;border-radius:10px;background:#10222c;
      color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.45);font-size:12px;line-height:1.45;
      pointer-events:none}.cambi-possible-tooltip strong{color:#fde047}
  `;
  document.head.appendChild(style);

  let requests = [];
  let updates = { odsVariations:[], manualVariations:[], approvedChangeRequests:[], dismissedOdsApprovals:[] };
  let lastLoad = 0;

  const norm = value => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const shift = value => {
    const clean = norm(value).replace(/\./g, '');
    return !clean || /^={3,}$/.test(clean) || clean === 'RIPOSO' || clean === 'RIP' ? 'RIP' : clean;
  };
  const profile = () => {
    try {
      return window.TurniShared?.readLoggedAgentProfile?.() ||
        (typeof loggedAgentProfile !== 'undefined' ? loggedAgentProfile : null) ||
        JSON.parse(localStorage.getItem('naviturni_logged_agent') || 'null');
    } catch (_) { return null; }
  };
  const rows = () => [...document.querySelectorAll('#tbody tr')];
  const findRow = (id, name) => rows().find(row => String(row.dataset.agentId || '') === String(id || '')) ||
    rows().find(row => norm(row.dataset.agentName) === norm(name));
  const belongsTo = (variation, id, name) => String(variation?.id_agente || '') === String(id || '') ||
    norm(variation?.agente) === norm(name);

  function requestIsConfirmed(request) {
    const direct = (updates.approvedChangeRequests || []).some(item =>
      item?.attiva !== false && String(item?.requestId || item?.id || '') === String(request?.id || ''));
    if (direct) return true;

    const dismissed = (updates.dismissedOdsApprovals || []).some(item =>
      String(item?.requestId || '') === String(request?.id || ''));
    if (dismissed) return false;

    const changes = Array.isArray(request?.changes) ? request.changes : [];
    const odsRows = (updates.odsVariations || []).filter(item =>
      item?.attiva !== false && norm(item?.tipo || 'ODS') !== 'MANUALE');
    if (!changes.length || !odsRows.length) return false;
    return changes.every(change =>
      odsRows.some(row => String(row.data || '') === String(change.date || '') &&
        belongsTo(row, request.agentId, request.agentName) && shift(row.turno_nuovo) === shift(change.to)) &&
      odsRows.some(row => String(row.data || '') === String(change.date || '') &&
        belongsTo(row, request.colleagueId, request.colleagueName) && shift(row.turno_nuovo) === shift(change.from))
    );
  }

  function detailFor(request, change) {
    return `${request.agentName || 'Agente'}: ${shift(change.from)} → ${shift(change.to)} · ` +
      `${request.colleagueName || 'Collega'}: ${shift(change.to)} → ${shift(change.from)}`;
  }

  function apply() {
    document.querySelectorAll('#tbody td.change-request-arrow').forEach(cell => {
      cell.classList.remove('change-request-arrow', 'change-request-confirmed');
      delete cell.dataset.changeRequestDetail;
      if ('changeRequestPreviousTitle' in cell.dataset) {
        if (cell.dataset.changeRequestPreviousTitle) cell.setAttribute('title', cell.dataset.changeRequestPreviousTitle);
        else cell.removeAttribute('title');
        delete cell.dataset.changeRequestPreviousTitle;
      }
    });
    requests.forEach(request => {
      const agentRow = findRow(request.agentId, request.agentName);
      const colleagueRow = findRow(request.colleagueId, request.colleagueName);
      const confirmed = requestIsConfirmed(request);
      (request.changes || []).forEach(change => {
        const calendar = (typeof dateCalendario !== 'undefined' ? dateCalendario : [])
          .find(item => item.iso === change.date);
        if (!calendar) return;
        [agentRow, colleagueRow].forEach(row => {
          const cell = row?.querySelector(`td[data-col="${calendar.col}"]`);
          if (!cell) return;
          if (cell.hasAttribute('title') && !cell.dataset.changeRequestPreviousTitle) {
            cell.dataset.changeRequestPreviousTitle = cell.getAttribute('title') || '';
          }
          cell.removeAttribute('title');
          cell.classList.add('change-request-arrow');
          cell.classList.toggle('change-request-confirmed', confirmed);
          cell.dataset.changeRequestDetail = detailFor(request, change);
        });
      });
    });
  }

  async function load() {
    const user = profile();
    const firebase = window.NaviAdminFirebase;
    if (!user?.id || !firebase?.listChangeRequests) return;
    try {
      const [loadedRequests, loadedUpdates] = await Promise.all([
        firebase.listChangeRequests(String(user.id)),
        firebase.getAdminUpdates ? firebase.getAdminUpdates() : Promise.resolve(updates)
      ]);
      requests = Array.isArray(loadedRequests) ? loadedRequests : [];
      updates = loadedUpdates || updates;
      lastLoad = Date.now();
      apply();
    } catch (error) {
      console.warn('Frecce cambio non disponibili', error);
    }
  }

  async function acceptPageRequests(event) {
    const shared = event?.detail?.requests || window.NaviCambioRequests;
    requests = Array.isArray(shared) ? shared : [];
    try {
      if (window.NaviAdminFirebase?.getAdminUpdates) {
        updates = await window.NaviAdminFirebase.getAdminUpdates() || updates;
      }
    } catch (error) {
      console.warn('Conferme dei cambi non disponibili', error);
    }
    lastLoad = Date.now();
    apply();
  }

  function showTooltip(cell) {
    document.querySelector('.cambi-change-tooltip')?.remove();
    if (!cell) return;
    const confirmed = cell.classList.contains('change-request-confirmed');
    const box = document.createElement('div');
    box.className = `cambi-change-tooltip${confirmed ? ' confirmed' : ''}`;
    const heading = document.createElement('strong');
    heading.textContent = confirmed ? 'Cambio confermato' : 'Richiesta di cambio';
    const detail = document.createElement('span');
    detail.textContent = cell.dataset.changeRequestDetail || '';
    box.append(heading, detail);
    document.body.appendChild(box);
    const rect = cell.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(rect.left, innerWidth - box.offsetWidth - 8)) + 'px';
    box.style.top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - box.offsetHeight - 8)) + 'px';
  }

  function showPossibleTooltip(cell) {
    document.querySelector('.cambi-possible-tooltip')?.remove();
    if (!cell?.dataset.cambioDescription) return;
    cell.removeAttribute('title');
    const box = document.createElement('div');
    box.className = 'cambi-possible-tooltip';
    const heading = document.createElement('strong');
    heading.textContent = 'Cambio possibile';
    const detail = document.createElement('span');
    detail.textContent = cell.dataset.cambioDescription;
    box.append(heading, detail);
    document.body.appendChild(box);
    const rect = cell.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(rect.left, innerWidth - box.offsetWidth - 8)) + 'px';
    box.style.top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - box.offsetHeight - 8)) + 'px';
  }

  document.addEventListener('mouseover', event => {
    const cell = event.target.closest?.('#tbody td.change-request-arrow');
    if (!cell || cell.contains(event.relatedTarget)) return;
    showTooltip(cell);
  }, true);
  document.addEventListener('mouseout', event => {
    const cell = event.target.closest?.('#tbody td.change-request-arrow');
    if (!cell || cell.contains(event.relatedTarget)) return;
    document.querySelector('.cambi-change-tooltip')?.remove();
  }, true);
  document.addEventListener('click', event => {
    const cell = event.target.closest?.('#tbody td.change-request-arrow');
    if (cell) showTooltip(cell);
  }, true);
  document.addEventListener('mouseover', event => {
    const cell = event.target.closest?.('#tbody td.cambio-possibile');
    if (!cell || cell.contains(event.relatedTarget)) return;
    showPossibleTooltip(cell);
  }, true);
  document.addEventListener('mouseout', event => {
    const cell = event.target.closest?.('#tbody td.cambio-possibile');
    if (!cell || cell.contains(event.relatedTarget)) return;
    document.querySelector('.cambi-possible-tooltip')?.remove();
  }, true);

  window.addEventListener('navisuite-change-requests-loaded', acceptPageRequests);

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.NaviCambioRequests ? acceptPageRequests() : load(), 900);
    const body = document.getElementById('tbody');
    if (body) new MutationObserver(() => setTimeout(apply, 0)).observe(body, { childList:true, subtree:true });
  });
  window.addEventListener('focus', () => {
    if (Date.now() - lastLoad > 60000) load();
  });
})();
