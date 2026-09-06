(() => {
  'use strict';

  if (!document.body?.classList.contains('impostazioni-page')) return;
  if (window.NaviCalendarSettingsLoaded) return;
  window.NaviCalendarSettingsLoaded = true;

  const CONFIG_URL = 'assets/calendar-config.json';
  const SHARED_DATA_SRC = 'assets/js/shared-data.js?v=118';
  const NON_WORKING = /^(?:RIP|RIPOSO|CON|CONG|CONGEDO|FERIE|MAL|MALATTIA|F\.P\.|FP|===|--+)$/i;
  const ROLE_RULES = [
    [/capitano|comandante/i, 'Capitano', 10],
    [/capo\s*timoniere|capotimoniere/i, 'Capo timoniere', 20],
    [/aiuto\s*motorista|aiutomotorista/i, 'Aiuto motorista', 40],
    [/motorista/i, 'Motorista', 30],
    [/timoniere/i, 'Timoniere', 50],
    [/marinaio/i, 'Marinaio', 60],
    [/barista/i, 'Barista', 70]
  ];

  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
    } catch (_) { return null; }
  })();
  if (!profile?.id) return;

  const norm = value => String(value || '').trim().toLocaleUpperCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  const rawShift = value => String(value ?? '').trim().toUpperCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, '');
  const values = value => Array.isArray(value) ? value.filter(Boolean) : value && typeof value === 'object' ? Object.values(value).filter(Boolean) : [];
  const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

  const displayShift = value => {
    const raw = rawShift(value);
    if (!raw || /^(?:RIP|RIPOSO|===|--+)$/.test(raw)) return 'RIP';
    if (/^(?:CON|CONG\.?|CONGEDO)$/.test(raw)) return 'CON';
    if (/^(?:LAV\.?|TERRA)$/.test(raw)) return 'TERRA';
    if (/^F\.?P\.?$/.test(raw)) return 'F.P.';
    return raw;
  };

  const courseShift = value => {
    const raw = rawShift(value);
    const direct = raw.match(/^C?(D[1-4]|BIS|T[12]|M1|R[1-4]|CAR\d*|P[1-3]|CAP\d*|SR1)C?$/)?.[1];
    if (!direct) return '';
    const code = direct.replace(/\d+$/, '');
    return code === 'CAR' || code === 'CAP' ? code : direct;
  };

  const roleMeta = agent => {
    const source = String(agent?.qualifica || agent?.grado || agent?.role || '').trim();
    const match = ROLE_RULES.find(([re]) => re.test(source));
    return match ? {label:match[1], rank:match[2]} : {label:source || 'Equipaggio', rank:99};
  };

  const refuelLabel = ship => {
    const value = ship?.rifornimento_mattina ?? ship?.rifornimento ?? ship?.rifornimentoMattina ?? '';
    if (value === true) return 'Sì';
    if (value === false || value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text) return '';
    if (/^(?:1|true|si|sì|yes)$/i.test(text)) return 'Sì';
    if (/^(?:0|false|no)$/i.test(text)) return '';
    return text;
  };

  const addDays = (iso, days) => {
    const [y,m,d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
  };
  const icsDate = iso => iso.replace(/-/g, '');
  const icsEscape = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const foldIcs = line => {
    const chunks = [];
    let rest = String(line);
    while (rest.length > 72) { chunks.push(rest.slice(0, 72)); rest = rest.slice(72); }
    chunks.push(rest);
    return chunks.join('\r\n ');
  };

  function injectStyle() {
    if (document.getElementById('navisuite-calendar-settings-style')) return;
    const style = document.createElement('style');
    style.id = 'navisuite-calendar-settings-style';
    style.textContent = `
      #calendario-personale .calendar-platforms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}
      #calendario-personale .calendar-platform{padding:14px;border:1px solid #294b56;border-radius:12px;background:#0b2029}
      #calendario-personale .calendar-platform strong{display:block;margin-bottom:5px;color:#e8f3f4;font-size:14px}
      #calendario-personale .calendar-platform span{display:block;color:#91aab2;font-size:12px;line-height:1.45}
      #calendario-personale .calendar-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}
      #calendario-personale .calendar-actions .btn{min-height:42px}
      #calendario-personale .calendar-actions .calendar-apple{border-color:#6ce9d5;background:#123f3d;color:#cafff6}
      #calendario-personale .calendar-actions .calendar-google{border-color:#5a88c7;background:#172f4a;color:#d9eaff}
      #calendario-personale .calendar-actions .calendar-download{border-color:#64748b;background:#17222b;color:#e2e8f0}
      #calendario-personale .calendar-actions .calendar-danger{border-color:#80424a;background:#351e24;color:#ff9ba4}
      #calendario-personale button[disabled]{opacity:.45;cursor:not-allowed}
      #calendario-personale .calendar-status{min-height:22px;margin-top:13px;color:#63dfca;font-size:13px;font-weight:700}
      #calendario-personale .calendar-status.warn{color:#facc15}
      #calendario-personale .calendar-status.error{color:#fda4af}
      #calendario-personale .calendar-feed-box{margin-top:13px;padding:12px 14px;border:1px solid #294b56;border-radius:10px;background:#0b2029}
      #calendario-personale .calendar-feed-box small{display:block;margin-bottom:7px;color:#91aab2;font-weight:800}
      #calendario-personale .calendar-feed-box input{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #31535e;border-radius:9px;background:#071b23;color:#9fded6;font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
      #calendario-personale .calendar-feed-box[hidden]{display:none!important}
      @media(max-width:700px){#calendario-personale .calendar-platforms{grid-template-columns:1fr}#calendario-personale .calendar-actions{display:grid;grid-template-columns:1fr}#calendario-personale .calendar-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function createSection() {
    let section = document.getElementById('calendario-personale');
    if (section) return section;
    const target = document.getElementById('gestione-utenti');
    const parent = document.querySelector('main');
    if (!parent) return null;
    section = document.createElement('section');
    section.className = 'section settings-foldable';
    section.id = 'calendario-personale';
    section.dataset.collapsed = 'true';
    section.dataset.accordionReady = 'true';
    section.innerHTML = `
      <div class="section-head" tabindex="0" role="button" aria-expanded="false">
        <div><h2>Calendario personale</h2><p>Porta i tuoi turni NaviSuite nel calendario del telefono, con i dettagli della giornata.</p></div>
        <span class="badge">Personale</span><span class="settings-chevron" aria-hidden="true">⌄</span>
      </div>
      <div class="calendar-platforms">
        <div class="calendar-platform"><strong> iPhone / iCloud</strong><span>Abbonamento al calendario personale: gli aggiornamenti dei turni arrivano senza reimportare il file.</span></div>
        <div class="calendar-platform"><strong>Google Calendar</strong><span>Usa lo stesso feed personale su Google Calendar e sui dispositivi Android.</span></div>
      </div>
      <div class="calendar-actions">
        <button class="btn primary" type="button" id="calendar-activate">Attiva sincronizzazione</button>
        <button class="btn calendar-apple" type="button" id="calendar-apple" disabled> Aggiungi su iPhone</button>
        <button class="btn calendar-google" type="button" id="calendar-google" disabled>G Aggiungi su Google</button>
        <button class="btn calendar-download" type="button" id="calendar-download">↓ Scarica .ics</button>
        <button class="btn calendar-danger" type="button" id="calendar-regenerate" hidden>Rigenera link</button>
      </div>
      <div class="calendar-feed-box" id="calendar-feed-box" hidden><small>Link personale del calendario · tocca per copiare</small><input id="calendar-feed-url" readonly></div>
      <p class="calendar-help"><strong>Contenuto:</strong> servizio, nave, ormeggio serale, rifornimento ed equipaggio. <strong>Privacy:</strong> il link sincronizzato usa un token casuale e non contiene il tuo PIN. Rigenerandolo, il link precedente viene revocato.</p>
      <div class="calendar-status" id="calendar-status" aria-live="polite">Preparazione calendario…</div>
    `;
    if (target) parent.insertBefore(section, target); else parent.appendChild(section);
    const head = section.querySelector(':scope > .section-head');
    const toggle = () => {
      const collapsed = section.dataset.collapsed === 'true';
      section.dataset.collapsed = String(!collapsed);
      head.setAttribute('aria-expanded', String(collapsed));
    };
    head.addEventListener('click', event => { if (!event.target.closest('button,a,input,select,textarea')) toggle(); });
    head.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
    return section;
  }

  function loadScript(src) {
    if (window.NaviSharedData) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => String(script.src || '').includes('shared-data.js'));
      if (existing) {
        const started = Date.now();
        const wait = () => {
          if (window.NaviSharedData) return resolve();
          if (Date.now() - started > 8000) return reject(new Error('Modulo turni non disponibile'));
          setTimeout(wait, 50);
        };
        wait();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Modulo turni non disponibile'));
      document.head.appendChild(script);
    });
  }

  async function loadConfig() {
    try {
      const response = await fetch(`${CONFIG_URL}?v=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) return {};
      return await response.json();
    } catch (_) { return {}; }
  }

  function flattenAgents(data) {
    const result = [];
    const seen = new Set();
    Object.entries(data?.residenze || {}).forEach(([residence, list]) => values(list).forEach(agent => {
      const key = String(agent?.agent_uid || agent?.id || norm(agent?.agente));
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({...agent, __residence:residence});
    }));
    return result;
  }

  function findAgent(data) {
    const agents = flattenAgents(data);
    const byId = agents.find(agent => String(agent?.id || '') === String(profile.id));
    if (byId) return byId;
    const wanted = norm(profile.name || profile.agente || profile.cognome);
    return agents.find(agent => norm(agent?.agente || agent?.name) === wanted) || null;
  }

  function buildVariationMap(data) {
    const map = new Map();
    values(data?.variazioni_ods).forEach(item => {
      if (item?.attiva === false) return;
      const iso = String(item?.data || item?.date || '').slice(0,10);
      if (!isoDate(iso)) return;
      const shift = item?.turno_nuovo ?? item?.turno ?? item?.dopo;
      if (shift === undefined || shift === null) return;
      const keys = [];
      if (item?.id_agente || item?.agentId) keys.push(`id:${String(item.id_agente || item.agentId)}`);
      if (item?.agente || item?.nome) keys.push(`name:${norm(item.agente || item.nome)}`);
      keys.forEach(key => {
        if (!map.has(key)) map.set(key, new Map());
        map.get(key).set(iso, shift);
      });
    });
    return map;
  }

  function effectiveShift(agent, iso, variationMap) {
    const id = String(agent?.id || agent?.agent_uid || '');
    const byId = variationMap.get(`id:${id}`);
    const byName = variationMap.get(`name:${norm(agent?.agente || agent?.name)}`);
    const changed = byId?.get(iso) ?? byName?.get(iso);
    return displayShift(changed !== undefined ? changed : agent?.turni?.[iso]);
  }

  function isWorkingShift(shift) {
    const value = displayShift(shift);
    return Boolean(value) && !NON_WORKING.test(value);
  }

  function shipInfoFor(data, iso, shift) {
    const course = courseShift(shift);
    if (!course) return null;
    return values(data?.turni_navi)
      .filter(item => item?.attiva !== false && String(item?.data || '').slice(0,10) === iso)
      .find(item => courseShift(item?.corsa || item?.turno) === course) || null;
  }

  function crewFor(data, iso, shift, variationMap) {
    const course = courseShift(shift);
    if (!course) return [];
    return flattenAgents(data)
      .filter(agent => courseShift(effectiveShift(agent, iso, variationMap)) === course)
      .map(agent => ({agent, meta:roleMeta(agent)}))
      .sort((a,b) => a.meta.rank - b.meta.rank || String(a.agent?.agente || a.agent?.name || '').localeCompare(String(b.agent?.agente || b.agent?.name || ''), 'it'))
      .map(({agent, meta}) => `${String(agent?.agente || agent?.name || '').trim()} (${meta.label})`)
      .filter(Boolean);
  }

  function eventDescription(data, iso, shift, variationMap) {
    const ship = shipInfoFor(data, iso, shift);
    const crew = crewFor(data, iso, shift, variationMap);
    const lines = [`Servizio: ${shift}`];
    const vessel = String(ship?.nave || ship?.nome_nave || '').trim();
    if (vessel) lines.push(`Nave: ${vessel}`);
    const berth = String(ship?.ormeggio_serale || ship?.ormeggio || ship?.ormeggioSera || '').trim();
    if (berth) lines.push(`Ormeggio serale: ${berth}`);
    const refuel = refuelLabel(ship);
    if (refuel) lines.push(`Rifornimento: ${refuel}`);
    if (crew.length) lines.push('', 'Equipaggio:', ...crew.map(name => `• ${name}`));
    lines.push('', 'Generato da NaviSuite');
    return lines.join('\n');
  }

  function buildEvents(data) {
    const agent = findAgent(data);
    if (!agent) throw new Error('Non trovo il tuo profilo nel turno pubblicato.');
    const variationMap = buildVariationMap(data);
    const dates = new Set([
      ...values(data?.date).map(item => isoDate(item?.iso)).filter(Boolean),
      ...Object.keys(agent.turni || {}).filter(isoDate)
    ]);
    return [...dates].sort().flatMap(iso => {
      const shift = effectiveShift(agent, iso, variationMap);
      if (!isWorkingShift(shift)) return [];
      const ship = shipInfoFor(data, iso, shift);
      const vessel = String(ship?.nave || ship?.nome_nave || '').trim();
      return [{iso, shift, vessel, description:eventDescription(data, iso, shift, variationMap)}];
    });
  }

  function buildIcs(data) {
    const events = buildEvents(data);
    const agentId = String(profile.id).replace(/[^A-Za-z0-9_-]/g, '_');
    const calendarName = `NaviSuite - ${String(profile.name || profile.cognome || 'Turni').trim()}`;
    const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/, 'Z');
    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NaviSuite//Calendario personale//IT','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      `X-WR-CALNAME:${icsEscape(calendarName)}`,'X-WR-TIMEZONE:Europe/Rome','REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H'
    ];
    events.forEach(event => {
      const summary = `NaviSuite · ${event.shift}${event.vessel ? ` · ${event.vessel}` : ''}`;
      lines.push('BEGIN:VEVENT',`UID:${agentId}-${event.iso}@navisuite`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${icsDate(event.iso)}`,`DTEND;VALUE=DATE:${icsDate(addDays(event.iso, 1))}`,`SUMMARY:${icsEscape(summary)}`,`DESCRIPTION:${icsEscape(event.description)}`,'STATUS:CONFIRMED','TRANSP:TRANSPARENT','END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(foldIcs).join('\r\n') + '\r\n';
  }

  async function loadCalendarData() {
    await loadScript(SHARED_DATA_SRC);
    return window.NaviSharedData.load('', {force:true});
  }

  async function downloadIcs(status) {
    status.className = 'calendar-status';
    status.textContent = 'Aggiorno i turni e preparo il calendario…';
    try {
      const data = await loadCalendarData();
      const ics = buildIcs(data);
      const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const cleanName = String(profile.name || profile.cognome || profile.id).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
      anchor.href = url;
      anchor.download = `NaviSuite_${cleanName || profile.id}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = 'Calendario .ics aggiornato e pronto per l’importazione.';
    } catch (error) {
      console.error('Esportazione calendario non riuscita', error);
      status.className = 'calendar-status error';
      status.textContent = error.message || 'Non riesco a creare il calendario.';
    }
  }

  function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
  }

  const normalizeFeedBase = value => String(value || '').trim().replace(/\/+$/, '');
  const feedUrl = (base, token) => base && token ? `${base}?token=${encodeURIComponent(token)}` : '';

  function submitBackend(base, valuesToSend) {
    return new Promise((resolve, reject) => {
      if (!base) return reject(new Error('Servizio di sincronizzazione non configurato.'));
      const requestId = `req-${Date.now()}-${randomToken().slice(0,16)}`;
      const frameName = `navi-calendar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.hidden = true;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = base;
      form.target = frameName;
      form.hidden = true;
      const payload = {...valuesToSend, requestId};
      Object.entries(payload).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value ?? '');
        form.appendChild(input);
      });

      let settled = false;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        form.remove();
        iframe.remove();
      };
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (error) reject(error); else resolve(result);
      };
      const onMessage = event => {
        const data = event?.data;
        if (!data || data.source !== 'navisuite-calendar' || data.requestId !== requestId) return;
        if (data.ok) finish(null, data);
        else finish(new Error(data.error || 'Operazione calendario non riuscita.'));
      };
      window.addEventListener('message', onMessage);
      const timer = setTimeout(() => finish(new Error('Il servizio calendario non ha risposto. Riprova.')), 12000);
      document.body.append(iframe, form);
      try { form.submit(); }
      catch (error) { finish(error); }
    });
  }

  const openApple = url => { location.href = url.replace(/^https?:\/\//i, 'webcal://'); };
  const openGoogle = url => { window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`, '_blank', 'noopener'); };

  async function init() {
    injectStyle();
    const section = createSection();
    if (!section) return;
    const status = section.querySelector('#calendar-status');
    const activate = section.querySelector('#calendar-activate');
    const apple = section.querySelector('#calendar-apple');
    const google = section.querySelector('#calendar-google');
    const download = section.querySelector('#calendar-download');
    const regenerate = section.querySelector('#calendar-regenerate');
    const feedBox = section.querySelector('#calendar-feed-box');
    const feedInput = section.querySelector('#calendar-feed-url');
    const config = await loadConfig();
    const base = normalizeFeedBase(config.feedBase || window.NAVISUITE_CALENDAR_FEED_URL || '');
    const tokenKey = `navisuite.calendarToken.${profile.id}`;
    let token = String(localStorage.getItem(tokenKey) || '');
    const pinHash = String(localStorage.getItem(`navidiaria.pin.${profile.id}`) || '').toLowerCase();
    const hasProof = /^[a-f0-9]{64}$/.test(pinHash);

    const render = () => {
      const url = feedUrl(base, token);
      const ready = Boolean(base && token);
      apple.disabled = !ready;
      google.disabled = !ready;
      regenerate.hidden = !ready;
      feedBox.hidden = !ready;
      feedInput.value = url;
      activate.hidden = ready || !base;
      if (ready) {
        status.className = 'calendar-status';
        status.textContent = 'Sincronizzazione attiva. iPhone e Google leggeranno gli aggiornamenti dal link personale.';
      } else if (!base) {
        status.className = 'calendar-status warn';
        status.textContent = 'Il file .ics è già disponibile. La sincronizzazione automatica iPhone/Google richiede ancora il collegamento del feed NaviSuite.';
      } else if (!hasProof) {
        status.className = 'calendar-status warn';
        status.textContent = 'Per attivare la sincronizzazione esci e accedi di nuovo a NaviSuite, poi torna qui.';
      } else {
        status.className = 'calendar-status';
        status.textContent = 'Puoi attivare il tuo link personale per iPhone e Google Calendar.';
      }
    };

    download.addEventListener('click', () => downloadIcs(status));
    apple.addEventListener('click', () => { const url = feedUrl(base, token); if (url) openApple(url); });
    google.addEventListener('click', () => { const url = feedUrl(base, token); if (url) openGoogle(url); });
    feedInput.addEventListener('click', () => {
      feedInput.select();
      navigator.clipboard?.writeText(feedInput.value).then(() => { status.textContent = 'Link calendario copiato.'; }).catch(() => {});
    });

    activate.addEventListener('click', async () => {
      if (!base) return;
      if (!hasProof) {
        status.className = 'calendar-status warn';
        status.textContent = 'Accedi di nuovo a NaviSuite prima di attivare il calendario.';
        return;
      }
      activate.disabled = true;
      status.className = 'calendar-status';
      status.textContent = 'Attivazione del calendario personale…';
      try {
        const nextToken = randomToken();
        await submitBackend(base, {action:'register', agentId:profile.id, token:nextToken, proof:pinHash});
        token = nextToken;
        localStorage.setItem(tokenKey, token);
        render();
      } catch (error) {
        token = '';
        localStorage.removeItem(tokenKey);
        status.className = 'calendar-status error';
        status.textContent = error.message || 'Attivazione non riuscita.';
      } finally { activate.disabled = false; }
    });

    regenerate.addEventListener('click', async () => {
      if (!base || !hasProof || !token) return;
      if (!confirm('Rigenerare il link calendario? Il link attuale smetterà di funzionare.')) return;
      regenerate.disabled = true;
      status.className = 'calendar-status';
      status.textContent = 'Rigenerazione del link…';
      try {
        const oldToken = token;
        await submitBackend(base, {action:'revoke', agentId:profile.id, token:oldToken, proof:pinHash});
        const nextToken = randomToken();
        await submitBackend(base, {action:'register', agentId:profile.id, token:nextToken, proof:pinHash});
        token = nextToken;
        localStorage.setItem(tokenKey, token);
        render();
        status.textContent = 'Nuovo link calendario attivato.';
      } catch (error) {
        status.className = 'calendar-status error';
        status.textContent = error.message || 'Rigenerazione non riuscita.';
      } finally { regenerate.disabled = false; }
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);
})();
