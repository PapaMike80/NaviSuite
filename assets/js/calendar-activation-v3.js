(() => {
  'use strict';

  if (!document.body?.classList.contains('impostazioni-page')) return;
  if (window.NaviCalendarActivationV3Loaded) return;
  window.NaviCalendarActivationV3Loaded = true;

  const CONFIG_URL = 'assets/calendar-config.json';
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
    } catch (_) { return null; }
  })();
  if (!profile?.id) return;

  const tokenKey = `navisuite.calendarToken.${profile.id}`;
  const pinHash = String(localStorage.getItem(`navidiaria.pin.${profile.id}`) || '').toLowerCase();
  const hasProof = /^[a-f0-9]{64}$/.test(pinHash);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalizeBase = value => String(value || '').trim().replace(/\/+$/, '');
  const feedUrl = (base, token) => base && token ? `${base}?token=${encodeURIComponent(token)}` : '';

  function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  async function loadBase() {
    try {
      const response = await fetch(`${CONFIG_URL}?v=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) return '';
      const config = await response.json();
      return normalizeBase(config.feedBase || window.NAVISUITE_CALENDAR_FEED_URL || '');
    } catch (_) { return ''; }
  }

  async function postOpaque(base, payload) {
    if (!base) throw new Error('Servizio di sincronizzazione non configurato.');
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(base, {
      method:'POST',
      mode:'no-cors',
      cache:'no-store',
      credentials:'omit',
      redirect:'follow',
      body
    });
    // Apps Script può completare la scrittura qualche istante dopo il redirect HTTP.
    await sleep(900);
  }

  function ui() {
    const section = document.getElementById('calendario-personale');
    if (!section) return null;
    return {
      section,
      status:section.querySelector('#calendar-status'),
      activate:section.querySelector('#calendar-activate'),
      apple:section.querySelector('#calendar-apple'),
      google:section.querySelector('#calendar-google'),
      regenerate:section.querySelector('#calendar-regenerate'),
      feedBox:section.querySelector('#calendar-feed-box'),
      feedInput:section.querySelector('#calendar-feed-url')
    };
  }

  function renderReady(base, token, message) {
    const controls = ui();
    if (!controls) return;
    const url = feedUrl(base, token);
    controls.apple.disabled = !url;
    controls.google.disabled = !url;
    controls.regenerate.hidden = !url;
    controls.feedBox.hidden = !url;
    controls.feedInput.value = url;
    controls.activate.hidden = Boolean(url);
    if (url) {
      controls.status.className = 'calendar-status';
      controls.status.textContent = message || 'Sincronizzazione attiva. iPhone e Google leggeranno gli aggiornamenti dal link personale.';
    }
  }

  function setError(message) {
    const controls = ui();
    if (!controls?.status) return;
    controls.status.className = 'calendar-status error';
    controls.status.textContent = message;
  }

  async function activateCalendar(button) {
    if (!hasProof) {
      const controls = ui();
      if (controls?.status) {
        controls.status.className = 'calendar-status warn';
        controls.status.textContent = 'Accedi di nuovo a NaviSuite prima di attivare il calendario.';
      }
      return;
    }
    const base = await loadBase();
    if (!base) return setError('Servizio di sincronizzazione non configurato.');
    button.disabled = true;
    const controls = ui();
    if (controls?.status) {
      controls.status.className = 'calendar-status';
      controls.status.textContent = 'Attivazione del calendario personale…';
    }
    try {
      const token = randomToken();
      await postOpaque(base, {action:'register', agentId:profile.id, token, proof:pinHash, requestId:`v3-${Date.now()}`});
      localStorage.setItem(tokenKey, token);
      renderReady(base, token, 'Link personale creato. Ora puoi aggiungerlo a iPhone o Google Calendar.');
    } catch (error) {
      localStorage.removeItem(tokenKey);
      setError(error?.message || 'Attivazione non riuscita.');
    } finally {
      button.disabled = false;
    }
  }

  async function regenerateCalendar(button) {
    if (!hasProof) return setError('Accedi di nuovo a NaviSuite prima di rigenerare il calendario.');
    const oldToken = String(localStorage.getItem(tokenKey) || '');
    if (!oldToken) return;
    if (!confirm('Rigenerare il link calendario? Il link attuale smetterà di funzionare.')) return;
    const base = await loadBase();
    if (!base) return setError('Servizio di sincronizzazione non configurato.');
    button.disabled = true;
    const controls = ui();
    if (controls?.status) {
      controls.status.className = 'calendar-status';
      controls.status.textContent = 'Rigenerazione del link…';
    }
    try {
      await postOpaque(base, {action:'revoke', agentId:profile.id, token:oldToken, proof:pinHash, requestId:`v3-r-${Date.now()}`});
      const token = randomToken();
      await postOpaque(base, {action:'register', agentId:profile.id, token, proof:pinHash, requestId:`v3-a-${Date.now()}`});
      localStorage.setItem(tokenKey, token);
      renderReady(base, token, 'Nuovo link calendario creato.');
    } catch (error) {
      setError(error?.message || 'Rigenerazione non riuscita.');
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('click', async event => {
    const target = event.target.closest?.('#calendar-activate,#calendar-regenerate,#calendar-apple,#calendar-google');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (target.id === 'calendar-activate') return activateCalendar(target);
    if (target.id === 'calendar-regenerate') return regenerateCalendar(target);

    const base = await loadBase();
    const token = String(localStorage.getItem(tokenKey) || '');
    const url = feedUrl(base, token);
    if (!url) return setError('Prima attiva la sincronizzazione del calendario.');
    if (target.id === 'calendar-apple') {
      location.href = url.replace(/^https?:\/\//i, 'webcal://');
      return;
    }
    window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`, '_blank', 'noopener');
  }, true);

  async function restore() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (ui()) break;
      await sleep(100);
    }
    const token = String(localStorage.getItem(tokenKey) || '');
    if (!token) return;
    const base = await loadBase();
    if (base) renderReady(base, token);
  }

  restore();
})();
