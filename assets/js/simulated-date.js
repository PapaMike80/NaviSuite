// Gestione Data Simulata (test di fine stagione per amministratori).
// Permette agli admin di impostare una data di lavoro specifica su questo dispositivo
// per testare turni, orari, equipaggi e funzionalità dell'app anche a fine stagione.
(function (root) {
  'use strict';

  const STORAGE_KEY = 'navisuite.simulatedDate';

  function getLoggedProfile() {
    try {
      return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
    } catch (_) {
      return null;
    }
  }

  function isAdmin() {
    const p = getLoggedProfile();
    if (!p) return false;
    if (root.NaviRoles?.isAdminAgent) return root.NaviRoles.isAdminAgent(p);
    const id = String(p.id || p.agentId || '').trim();
    const name = String(p.name || p.agente || p.cognome || '');
    return ['91', '92', 'AG_PEDRONI_M', 'AG_STUMPO_D'].includes(id) ||
      /\bPEDRONI\b/i.test(name) ||
      String(p.role || '').toLowerCase() === 'admin' ||
      String(p.role || '').toLowerCase() === 'superuser' ||
      String(p.role || '').toLowerCase() === 'super_user';
  }

  function getRawSimulatedDate() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    } catch (_) {}
    return null;
  }

  function getSimulatedDate() {
    if (!isAdmin()) return null;
    return getRawSimulatedDate();
  }

  function setSimulatedDate(iso) {
    if (!isAdmin()) return false;
    try {
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        localStorage.setItem(STORAGE_KEY, iso);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      try {
        window.dispatchEvent(new CustomEvent('navisuite:simulated-date-changed', { detail: { date: iso || null } }));
      } catch (_) {}
      renderIndicator();
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearSimulatedDate() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      try {
        window.dispatchEvent(new CustomEvent('navisuite:simulated-date-changed', { detail: { date: null } }));
      } catch (_) {}
      renderIndicator();
      return true;
    } catch (_) {
      return false;
    }
  }

  function realTodayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function todayIso() {
    return getSimulatedDate() || realTodayIso();
  }

  function isSimulated() {
    return !!getSimulatedDate();
  }

  // Pulisce cache locali dipendenti dalla giornata
  function clearDailyCaches() {
    try { localStorage.removeItem('navisuite.oggi.snapshot.v1'); } catch (_) {}
    try { localStorage.removeItem('turno_finali_data'); } catch (_) {}
    try { localStorage.removeItem('navi.sharedData.v1'); } catch (_) {}
    try { localStorage.removeItem('navi.sharedDataTime.v1'); } catch (_) {}
  }

  // Carica i dati completi per la data impostata
  async function loadDataForDate(iso) {
    if (iso) setSimulatedDate(iso);
    clearDailyCaches();
    if (root.NaviSharedData) {
      try { root.NaviSharedData.clear(); } catch (_) {}
      try {
        if (root.NaviSharedData.loadCompleto) {
          return await root.NaviSharedData.loadCompleto();
        } else if (root.NaviSharedData.load) {
          return await root.NaviSharedData.load('', { force: true, completo: true });
        }
      } catch (err) {
        console.warn('NaviDate: errore caricamento dati per data simulata', err);
      }
    }
    return null;
  }

  // Banner flottante discreto visibile solo per admin quando è attiva una data simulata
  function renderIndicator() {
    if (typeof document === 'undefined') return;
    const sim = getSimulatedDate();
    const existing = document.getElementById('navi-simulated-date-banner');
    if (!sim) {
      if (existing) existing.remove();
      return;
    }

    const itDate = sim.split('-').reverse().join('/');
    if (existing) {
      const dateEl = existing.querySelector('.sim-banner-date');
      if (dateEl) dateEl.textContent = itDate;
      return;
    }

    const banner = document.createElement('aside');
    banner.id = 'navi-simulated-date-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-label', 'Modalità test data simulata');
    banner.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:99999;display:flex;align-items:center;gap:10px;padding:9px 14px;background:#18150c;border:1px solid #f59e0b;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.5);font-family:system-ui,sans-serif;font-size:12px;color:#fef3c7;backdrop-filter:blur(8px);';
    banner.innerHTML = '<span style="font-size:15px;line-height:1">🧪</span>' +
      '<span>Data test: <strong class="sim-banner-date" style="color:#fbbf24;font-family:monospace;font-size:13px">' + itDate + '</strong></span>' +
      '<button type="button" id="sim-banner-change-btn" style="border:1px solid #f59e0b;border-radius:7px;padding:4px 8px;background:rgba(245,158,11,0.18);color:#fef3c7;font-weight:800;font-size:11px;cursor:pointer" title="Cambia data">Cambia</button>' +
      '<button type="button" id="sim-banner-reset-btn" style="border:0;border-radius:7px;padding:4px 9px;background:#f59e0b;color:#18150c;font-weight:800;font-size:11px;cursor:pointer" title="Torna a oggi">Oggi reale</button>';

    document.body.appendChild(banner);
    banner.querySelector('#sim-banner-change-btn')?.addEventListener('click', () => {
      location.href = 'impostazioni.html#simulated-date-setting';
    });
    banner.querySelector('#sim-banner-reset-btn')?.addEventListener('click', async () => {
      clearSimulatedDate();
      clearDailyCaches();
      if (root.NaviSharedData) {
        try { root.NaviSharedData.clear(); } catch (_) {}
      }
      location.reload();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderIndicator);
    } else {
      renderIndicator();
    }
  }

  const NaviDate = {
    STORAGE_KEY,
    isAdmin,
    getSimulatedDate,
    setSimulatedDate,
    clearSimulatedDate,
    realTodayIso,
    todayIso,
    isSimulated,
    clearDailyCaches,
    loadDataForDate,
    renderIndicator
  };

  root.NaviDate = NaviDate;
})(typeof window !== 'undefined' ? window : globalThis);
