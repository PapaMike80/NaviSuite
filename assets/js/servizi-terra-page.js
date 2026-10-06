// Pagina "Servizi a terra": mostra l'A4 della residenza dell'agente (Desenzano o Maderno),
// con i pulsantini di NaviTurni per passare all'altra residenza. Desenzano e' settimanale
// (ormeggi serali dai turni nave degli O.d.S.), Maderno no.
(function () {
  'use strict';

  const T = window.NaviServiziTerra;
  const RESIDENZE = [{ code: 'D', name: 'DESENZANO', title: 'Desenzano' }, { code: 'M', name: 'MADERNO', title: 'Maderno' }];
  const CACHE_KEY = 'navisuite.serviziTerra.turniNavi';
  const $ = id => document.getElementById(id);

  const parseIso = value => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (value, days) => { const d = parseIso(value); d.setDate(d.getDate() + days); return iso(d); };
  const short = value => { const d = parseIso(value); return `${d.getDate()}/${d.getMonth() + 1}`; };

  // Residenza dell'agente collegato; per chi non e' di Desenzano o Maderno si apre Desenzano.
  function ownResidence() {
    let agent = null;
    try { agent = JSON.parse(localStorage.getItem('naviturni_logged_agent') || localStorage.getItem('navidiaria.activeAgent') || 'null'); } catch { agent = null; }
    const value = String(agent?.residence || agent?.residenza || '').trim().toUpperCase();
    return RESIDENZE.some(item => item.name === value) ? value : 'DESENZANO';
  }

  function initialResidence() {
    const asked = String(new URLSearchParams(location.search).get('res') || '').trim().toUpperCase();
    return RESIDENZE.some(item => item.name === asked) ? asked : ownResidence();
  }

  function readCache() {
    try { const rows = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return Array.isArray(rows) ? rows : null; } catch { return null; }
  }

  const state = { residence: initialResidence(), monday: T.defaultMonday(), turniNavi: readCache() || [], loaded: false };

  function renderButtons() {
    $('terra-residences').innerHTML = RESIDENZE.map(item => {
      const active = item.name === state.residence;
      return `<button type="button" class="quick-residence-btn${active ? ' active' : ''}" data-res="${item.name}" ` +
        `aria-label="Visualizza ${item.name}" aria-pressed="${active}" title="${item.title}">${item.code}</button>`;
    }).join('');
  }

  function render() {
    const info = RESIDENZE.find(item => item.name === state.residence);
    const desenzano = state.residence === 'DESENZANO';
    renderButtons();
    $('terra-title').textContent = info.title;
    $('terra-week').hidden = !desenzano;
    $('terra-week-label').textContent = `${short(state.monday)} – ${short(addDays(state.monday, 6))}`;
    $('terra-context').textContent = desenzano
      ? `Pontile e AgB · navi e ormeggi serali della settimana ${short(state.monday)} – ${short(addDays(state.monday, 6))}`
      : 'AgM e AgT1 · navi di linea e traghetto Torri';
    const frame = $('terra-sheet');
    frame.onload = () => {
      // Altezza del riquadro = fondo del foglio (gia' rimpicciolito sul telefono).
      try {
        const sheets = [...frame.contentDocument.querySelectorAll('.sheet')];
        const bottom = Math.max(...sheets.map(sheet => sheet.getBoundingClientRect().bottom));
        frame.style.height = `${Math.ceil(bottom) + 8}px`;
      } catch { /* altezza predefinita */ }
    };
    frame.srcdoc = T.buildResidenceHtml(state.residence, state.turniNavi, state.monday, { printButton: false });
    const url = new URL(location.href);
    url.searchParams.set('res', state.residence.toLowerCase());
    history.replaceState(null, '', url);
  }

  function notice(text) {
    $('terra-notice').hidden = !text;
    $('terra-notice').textContent = text || '';
  }

  async function loadTurniNavi() {
    const provider = window.NaviAdminFirebase;
    try {
      if (!provider) throw new Error('Firebase non disponibile');
      await provider.ready;
      const rows = provider.getTurniNavi ? await provider.getTurniNavi() : (await provider.getAdminUpdates()).turniNavi;
      state.turniNavi = Array.isArray(rows) ? rows : [];
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(state.turniNavi)); } catch { /* spazio pieno: niente copia locale */ }
      notice('');
    } catch (error) {
      notice(readCache()
        ? `Ormeggi serali dall'ultima copia salvata sul dispositivo (${error.message}).`
        : `Non riesco a leggere gli ormeggi serali degli O.d.S. (${error.message}).`);
    }
    state.loaded = true;
    if (state.residence === 'DESENZANO') render();
  }

  $('terra-residences').addEventListener('click', event => {
    const button = event.target.closest('[data-res]');
    if (!button || button.dataset.res === state.residence) return;
    state.residence = button.dataset.res;
    render();
  });
  $('terra-prev').addEventListener('click', () => { state.monday = addDays(state.monday, -7); render(); });
  $('terra-next').addEventListener('click', () => { state.monday = addDays(state.monday, 7); render(); });
  $('terra-print').addEventListener('click', () => {
    const frame = $('terra-sheet');
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.print(); }
  });

  render();
  loadTurniNavi();
})();
