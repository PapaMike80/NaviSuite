(() => {
  const originalRenderTable = window.renderTable;
  let selectedSwap = null;
  let cambioPinned = false;
  let cambioShowOtherResidences = false;

  function effectiveRawShift(agent, cal) {
    if (!agent || !cal) return 'rip';
    const dayIndex = (cal.col - 3) % 7;
    const weekly = (agent.turni_settimanali?.[cal.weekKey] || [])[dayIndex] || 'rip';
    return agent.variazioni_ods?.[cal.iso]?.turno_nuovo || weekly;
  }

  function cleanShift(agent, cal) {
    return ottieniTurnoPulito(effectiveRawShift(agent, cal));
  }

  function isRest(agent, cal) {
    return cleanShift(agent, cal) === '';
  }

  function sameGradeAndResidence(agent, row, location) {
    if (!agent || !location?.agent) return false;
    const myGrade = getGradeClass(location.agent.id, location.agent.agente, location.agent.qualifica);
    const colleagueGrade = getGradeClass(agent.id, agent.agente, agent.qualifica);
    const rowResidence = String(row.dataset.residence || currentResidence || '');
    const residenceAllowed = cambioShowOtherResidences || rowResidence === String(location.residence || '');
    return colleagueGrade === myGrade && residenceAllowed;
  }

  function normalizeResidenceName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function residenceDistanceOrder(homeResidence) {
    const home = normalizeResidenceName(homeResidence);
    const preferred = {
      desenzano: ['peschiera', 'maderno', 'riva'],
      maderno: ['riva', 'desenzano', 'peschiera'],
      peschiera: ['desenzano', 'riva', 'maderno'],
      riva: ['maderno', 'peschiera', 'desenzano']
    }[home] || [];
    const residences = Object.keys(globalData?.residenze || {}).filter(name => {
      const normalized = normalizeResidenceName(name);
      return normalized !== home && normalized !== 'bariste' && normalized !== 'uffici';
    });
    return residences.sort((a, b) => {
      const ai = preferred.indexOf(normalizeResidenceName(a));
      const bi = preferred.indexOf(normalizeResidenceName(b));
      const ar = ai < 0 ? 999 : ai;
      const br = bi < 0 ? 999 : bi;
      return ar - br || a.localeCompare(b, 'it');
    });
  }

  function appendOtherResidenceRows() {
    document.querySelectorAll('#tbody tr.cambio-altra-residenza').forEach(row => row.remove());
    trElements = trElements.filter(row => !row.classList.contains('cambio-altra-residenza'));
    if (!cambioShowOtherResidences) return;

    const location = getLoggedAgentLocation?.();
    const tbody = document.getElementById('tbody');
    if (!location?.agent || !tbody) return;
    const myGrade = getGradeClass(location.agent.id, location.agent.agente, location.agent.qualifica);
    const myId = String(location.agent.id || '');
    const fragment = document.createDocumentFragment();

    residenceDistanceOrder(location.residence).forEach(residence => {
      (globalData?.residenze?.[residence] || []).forEach((agent, index) => {
        const grade = getGradeClass(agent.id, agent.agente, agent.qualifica);
        const samePerson = myId && String(agent.id || '') === myId;
        if (grade !== myGrade || samePerson) return;
        const row = createRowDOM(agent, index, false, residence, true);
        row.classList.add('cambio-altra-residenza');
        row.dataset.residence = residence;
        const label = row.querySelector('.transfer-table-label');
        if (label) label.textContent = residence;
        fragment.appendChild(row);
        trElements.push(row);
      });
    });
    tbody.appendChild(fragment);
    applyCambioDateWindow();
  }

  function toggleOtherResidences() {
    if (isAnyBaristaProfile()) return;
    cambioShowOtherResidences = !cambioShowOtherResidences;
    appendOtherResidenceRows();
    applyPermanentPeerFilter();
    if (selectedCol != null) showCambioOptions(selectedCol, cambioPinned);
  }
  window.toggleOtherResidences = toggleOtherResidences;



  function applyCambioDateWindow() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dateCalendario.forEach(cal => {
      const date = new Date(`${cal.iso}T12:00:00`);
      date.setHours(0, 0, 0, 0);
      const past = date.getTime() < today.getTime();
      document.querySelector(`.date-header th[data-col="${cal.col}"]`)
        ?.classList.toggle('cambio-data-passata', past);
      document.querySelectorAll(`#tbody td[data-col="${cal.col}"]`).forEach(cell => {
        cell.classList.toggle('cambio-data-passata', past);
      });
    });
  }

  function applyPermanentPeerFilter() {
    const location = getLoggedAgentLocation?.();
    if (!location?.agent) return;
    trElements.forEach(row => {
      if (row.classList.contains('logged-agent-row')) {
        row.classList.remove('cambio-non-parigrado');
        return;
      }
      const agent = getAgentForTableRow(row);
      row.classList.toggle('cambio-non-parigrado', !sameGradeAndResidence(agent, row, location));
    });
  }

  function removeSharedCrewDecorations() {
    document.querySelectorAll('#tbody tr').forEach(row => {
      row.classList.remove('has-shared-crew','shared-crew-focus','hover-common-colleague');
    });
    document.querySelectorAll('#tbody td').forEach(cell => {
      cell.classList.remove('shared-crew-day','pinned-shared-crew-day','selected-shared-crew-day','hover-common-cell','departed-crew-day');
      cell.querySelector('.shared-crew-change-label')?.remove();
    });
    document.querySelectorAll('.date-header th').forEach(th => {
      th.classList.remove('hover-shared-date','pinned-agent-common-date');
    });
    document.querySelectorAll('.future-shared-dot').forEach(dot => dot.remove());
  }

  function ensurePanels() {
    const wrap = document.getElementById('matrix-scroll-wrap');
    if (!wrap) return {};
    let info = document.getElementById('cambio-info');
    if (!info) {
      info = document.createElement('div');
      info.id = 'cambio-info';
      wrap.parentNode.insertBefore(info, wrap);
    }
    let mail = document.getElementById('cambio-mail-box');
    if (!mail) {
      mail = document.createElement('section');
      mail.id = 'cambio-mail-box';
      mail.innerHTML = `
        <div class="cambio-mail-head">
          <strong>Riepilogo del cambio selezionato</strong>
        </div>
        <div class="cambio-mail-actions">
          <button type="button" id="cambio-request-sent">✓ Registra richiesta</button>
        </div>
        <div id="cambio-hours-summary" aria-live="polite"></div>
        <div id="cambio-mail-status" aria-live="polite"></div>`;
      wrap.parentNode.insertBefore(mail, wrap.nextSibling);
      mail.querySelector('#cambio-request-sent').addEventListener('click', saveCurrentChangeRequest);
    }
    return {info, mail};
  }


  let firebaseChangeRequests = [];

  function changeRequestCacheKey() {
    return `navisuite.changeRequests.v1.${String(loggedAgentProfile?.id || 'guest')}`;
  }

  function readCachedChangeRequests() {
    try {
      const value = JSON.parse(localStorage.getItem(changeRequestCacheKey()) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function cacheChangeRequests(requests) {
    try { localStorage.setItem(changeRequestCacheKey(), JSON.stringify(requests || [])); } catch (_) {}
  }

  function changeRequestPayload() {
    if (!selectedSwap || !loggedAgentProfile) return null;
    const {selectedCal, exchangeCal, me, colleague} = selectedSwap;
    const myFrom = displayShift(effectiveRawShift(me, selectedCal));
    const colleagueFrom = displayShift(effectiveRawShift(colleague, exchangeCal));
    const sameDay = selectedCal.iso === exchangeCal.iso;
    const changes = sameDay
      ? [{date:selectedCal.iso, from:myFrom, to:colleagueFrom}]
      : [
          {date:selectedCal.iso, from:myFrom, to:'RIP'},
          {date:exchangeCal.iso, from:'RIP', to:colleagueFrom}
        ];
    return {
      action:'save_change_request',
      agentId:String(loggedAgentProfile.id || ''),
      agentName:String(loggedAgentProfile.name || me.agente || ''),
      colleagueId:String(colleague.id || ''),
      colleagueName:String(colleague.agente || ''),
      sentAt:new Date().toISOString(),
      changes
    };
  }

  async function firebaseChangePost(payload) {
    const firebase = window.NaviFirebase || window.NaviAdminFirebase;
    if (firebase) {
      if (payload?.action === 'list_change_requests') {
        return {ok:true, requests:await firebase.listChangeRequests(payload.agentId)};
      }
      if (payload?.action === 'save_change_request') {
        return {ok:true, request:await firebase.saveChangeRequest(payload)};
      }
      if (payload?.action === 'delete_change_request') {
        await firebase.deleteChangeRequest(payload.requestId);
        return {ok:true};
      }
    }
    throw new Error('Firebase non disponibile');
  }

  async function deleteFirebaseChangeRequest(requestId) {
    const item = firebaseChangeRequests.find(entry => String(entry.id) === String(requestId));
    if (!item || !loggedAgentProfile?.id) return;
    const description = `${item.colleagueName || 'collega'} — ${plainPrettyChange(item)}`;
    if (!window.confirm(`Eliminare questa richiesta?\n\n${description}`)) return;
    try {
      await firebaseChangePost({action:'delete_change_request', agentId:String(loggedAgentProfile.id), requestId:String(requestId)});
      await loadFirebaseChangeRequests();
    } catch (error) {
      alert('Impossibile eliminare la richiesta: ' + error.message);
    }
  }

  function escapeChangeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function plainPrettyChange(item) {
    return (item.changes || []).map(c => `${c.date}: ${c.from} → ${c.to}`).join(' · ');
  }

  function requestWhatsappText(item) {
    const colleague = String(item.colleagueName || 'collega').trim();
    const lines = (item.changes || []).map(c => {
      const date = c.date ? new Date(`${c.date}T12:00:00`).toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '';
      return `${date}: ${c.from} → ${c.to}`;
    });
    return [`Ciao ${colleague}.`, 'Ti inoltro la richiesta di cambio turno:', ...lines, 'Fammi sapere se è tutto corretto.'].join('\n');
  }

  function formalChangeRequestText(item) {
    const agentName = String(item.agentName || loggedAgentProfile?.name || 'AGENTE').trim().toUpperCase();
    const colleagueName = String(item.colleagueName || 'COLLEGA').trim().toUpperCase();
    const schedule = (item.changes || []).flatMap(change => {
      const date = change.date
        ? new Date(`${change.date}T12:00:00`).toLocaleDateString('it-IT', {
            weekday:'long', day:'numeric', month:'long', year:'numeric'
          }).toUpperCase()
        : '';
      return [
        date,
        `${agentName}: ${String(change.to || 'RIP').toUpperCase()}`,
        `${colleagueName}: ${String(change.from || 'RIP').toUpperCase()}`
      ];
    });
    return [
      'Spett.le Direzione NLG.',
      'Uff. Movimento',
      'Desenzano',
      `In accordo con l'agente ${colleagueName}, chiedo un cambio sulla bozza del turno senza oneri per l'azienda.`,
      ...schedule,
      'Cordiali saluti'
    ].join('\n');
  }

  function ensureChangeSendModal() {
    let modal = document.getElementById('change-send-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'change-send-modal';
    modal.className = 'change-send-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML = `<div class="change-send-dialog">
      <div class="change-send-head"><h3>Invia richiesta</h3><button type="button" class="change-send-close" aria-label="Chiudi">×</button></div>
      <div id="change-send-summary" class="change-send-summary"></div>
      <div class="change-send-buttons"><button id="change-send-copy" class="change-send-copy" type="button">⧉ Copia testo</button><a id="change-send-mail" class="change-send-mail" href="#">✉ Invia Mail</a><a id="change-send-whatsapp" class="change-send-whatsapp" href="#" target="_blank" rel="noopener">WhatsApp</a></div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.classList.remove('open');
    modal.querySelector('.change-send-close').addEventListener('click', close);
    modal.querySelector('#change-send-copy').addEventListener('click', async event => {
      const text = modal.querySelector('#change-send-summary').textContent || '';
      try { await navigator.clipboard.writeText(text); }
      catch (_) { const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove(); }
      const button=event.currentTarget,old=button.textContent;button.textContent='✓ Testo copiato';setTimeout(()=>button.textContent=old,1600);
    });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return modal;
  }

  function openChangeSendPopup(requestId) {
    const item = firebaseChangeRequests.find(entry => String(entry.id) === String(requestId));
    if (!item) return;
    const modal = ensureChangeSendModal();
    const mailText = formalChangeRequestText(item);
    const whatsappText = mailText;
    const subject = `Richiesta cambio turno - ${item.agentName || ''} / ${item.colleagueName || ''}`;
    modal.querySelector('#change-send-summary').textContent = mailText;
    modal.querySelector('#change-send-mail').href = `mailto:infogarda@navigazionelaghi.it?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailText)}`;
    modal.querySelector('#change-send-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    modal.classList.add('open');
  }

  window.deleteFirebaseChangeRequest = deleteFirebaseChangeRequest;
  window.openChangeSendPopup = openChangeSendPopup;

  async function saveCurrentChangeRequest() {
    const payload = changeRequestPayload();
    const status = document.getElementById('cambio-mail-status');
    if (!payload) return;
    const button = document.getElementById('cambio-request-sent');
    button.disabled = true;
    if (status) status.textContent = 'Salvataggio della richiesta…';
    try {
      await firebaseChangePost(payload);
      if (status) status.textContent = '✓ Richiesta salvata nel registro condiviso.';
      await loadFirebaseChangeRequests();
    } catch (error) {
      if (status) status.textContent = '❌ ' + error.message;
    } finally { button.disabled = false; }
  }

  function ensureChangeRequestRegister() {
    let section = document.getElementById('change-request-register');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'change-request-register';
    section.innerHTML = '<h2>Richieste inviate</h2><div id="change-request-register-body">Caricamento…</div>';
    const mail = document.getElementById('cambio-mail-box');
    (mail?.parentNode || document.querySelector('main') || document.body).insertBefore(section, mail?.nextSibling || null);
    return section;
  }

  function prettyChange(item) {
    const me = String(item.agentName || loggedAgentProfile?.name || 'Tu').toUpperCase();
    const colleague = String(item.colleagueName || 'Collega').toUpperCase();
    return (item.changes || []).map(c => {
      const date = c.date
        ? new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'2-digit'})
            .format(new Date(`${c.date}T12:00:00`)).replace(/\./g,'')
        : 'Data';
      return `<div class="change-day-block"><span class="change-day-date">${escapeChangeHtml(date)}</span>` +
      `<span class="change-agent-line"><b>${me}</b> → ${escapeChangeHtml(c.to)}</span>` +
      `<span class="change-agent-line"><b>${colleague}</b> → ${escapeChangeHtml(c.from)}</span></div>`;
    }
    ).join('<hr class="change-day-separator">');
  }

  function renderCloudChangeRequests() {
    ensureChangeRequestRegister();
    const body = document.getElementById('change-request-register-body');
    window.NaviCambioRequests = [...firebaseChangeRequests];
    window.dispatchEvent(new CustomEvent('navisuite-change-requests-loaded', {detail:{requests:window.NaviCambioRequests}}));
    if (!firebaseChangeRequests.length) { body.innerHTML='<p class="change-empty">Nessuna richiesta registrata.</p>'; return; }
    body.innerHTML = `<div class="change-register-wrap"><table><thead><tr><th>Inviata</th><th>Cambio richiesto</th><th>Azioni</th></tr></thead><tbody>${firebaseChangeRequests.map(item => `<tr><td data-label="Inviata">${new Date(item.sentAt).toLocaleDateString('it-IT')}</td><td data-label="Cambio richiesto" class="change-summary-cell"><strong>${prettyChange(item)}</strong></td><td data-label="Azioni" class="change-actions-cell"><div class="change-actions"><button type="button" class="change-action-btn change-action-send" onclick="openChangeSendPopup('${escapeChangeHtml(item.id)}')">Invia</button><button type="button" class="change-action-btn change-action-delete" onclick="deleteFirebaseChangeRequest('${escapeChangeHtml(item.id)}')">Elimina</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function loadFirebaseChangeRequests() {
    if (!loggedAgentProfile?.id) return;
    ensureChangeRequestRegister();
    const cached = readCachedChangeRequests();
    if (cached.length) {
      firebaseChangeRequests = cached;
      renderCloudChangeRequests();
    } else {
      document.getElementById('change-request-register-body').textContent='Aggiornamento richieste…';
    }
    try {
      const data = await firebaseChangePost({action:'list_change_requests', agentId:String(loggedAgentProfile.id)});
      firebaseChangeRequests = Array.isArray(data.requests) ? data.requests : [];
      cacheChangeRequests(firebaseChangeRequests);
      renderCloudChangeRequests();
    } catch (error) {
      if (!cached.length) {
        document.getElementById('change-request-register-body').textContent='Registro non disponibile: '+error.message;
      }
    }
  }

  function clearCambioSearch() {
    selectedCol = null;
    selectedShiftValue = null;
    selectedSwap = null;
    cambioPinned = false;
    document.querySelectorAll('#tbody tr.cambio-hidden,#tbody tr.cambio-candidato').forEach(row => {
      row.classList.remove('cambio-hidden','cambio-candidato');
    });
    document.querySelectorAll('#tbody td.cambio-possibile').forEach(cell => {
      cell.classList.remove('cambio-possibile');
      delete cell.dataset.cambioAgentId;
      delete cell.dataset.cambioCol;
      delete cell.dataset.cambioDescription;
      cell.removeAttribute('title');
    });
    document.querySelectorAll('#tbody td.cambio-turno-selezionato').forEach(cell => cell.classList.remove('cambio-turno-selezionato'));
    document.querySelectorAll('.date-header th.cambio-data-selezionata,.date-header th.selected-day').forEach(th => {
      th.classList.remove('cambio-data-selezionata','selected-day');
    });
    document.querySelectorAll('#tbody td.col-selected').forEach(td => td.classList.remove('col-selected'));
    document.getElementById('tbody')?.classList.remove('has-selection');
    document.getElementById('cambio-info')?.classList.remove('open');
    document.getElementById('cambio-mail-box')?.classList.remove('open');
    document.getElementById('cambio-hours-summary')?.classList.remove('open');
    applyPermanentPeerFilter();
    removeSharedCrewDecorations();
  }
  window.clearCambioSearch = clearCambioSearch;

  function formatDate(iso) {
    const d = new Date(`${iso}T12:00:00`);
    const value = new Intl.DateTimeFormat('it-IT', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    }).format(d);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function displaySurname(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
  }

  function displayShift(value) {
    const cleaned = ottieniTurnoPulito(value);
    return cleaned ? cleaned.toUpperCase() : 'RIP';
  }

  function durationTextToMinutes(text) {
    const value = String(text || '').toLowerCase();
    const hours = Number.parseInt(value.match(/(\d+)\s*or/)?.[1] || '0', 10);
    const minutes = Number.parseInt(value.match(/(\d+)\s*min/)?.[1] || '0', 10);
    return (hours * 60) + minutes;
  }

  function shiftMinutes(agent, cal) {
    const raw = effectiveRawShift(agent, cal);
    const code = ottieniTurnoPulito(raw);
    if (!code) return {minutes:0, unknown:false, code:'RIP'};
    const upper = code.toUpperCase().replace(/\s+/g, '');
    // Riposi, ferie, permessi, malattia e altre assenze non producono ore lavorate.
    // Il congedo invece conta (8 ore, 7 il venerdi'): la durata arriva dalla tabella.
    if (/^(RIP|===|---|----|FP|F\.P\.|FER|FERIE|MAL|MALATTIA|PERM|PERMESSO|REC|RECUPERO|ASP|ASPETTATIVA)$/.test(upper)) {
      return {minutes:0, unknown:false, code:upper};
    }
    const duration = getShiftDuration(code, cal);
    return {
      minutes: durationTextToMinutes(duration),
      unknown: !duration,
      code: code.toUpperCase()
    };
  }

  function weeklyMinutes(agent, weekKey) {
    let minutes = 0;
    const unknown = new Set();
    dateCalendario.forEach(cal => {
      if (cal.weekKey !== weekKey) return;
      const item = shiftMinutes(agent, cal);
      minutes += item.minutes;
      if (item.unknown) unknown.add(item.code);
    });
    return {minutes, unknown:[...unknown]};
  }

  function formatMinutes(total) {
    const sign = total < 0 ? '-' : '';
    const absolute = Math.abs(Math.round(total));
    const hours = Math.floor(absolute / 60);
    const minutes = absolute % 60;
    if (!hours) return `${sign}${minutes} min`;
    if (!minutes) return `${sign}${hours} h`;
    return `${sign}${hours} h ${String(minutes).padStart(2, '0')} min`;
  }

  function formatDelta(total) {
    if (total > 0) return `+${formatMinutes(total)}`;
    if (total < 0) return formatMinutes(total);
    return '0 min';
  }

  function buildHoursComparison(me, colleague, selectedCal, exchangeCal) {
    const myCurrent = weeklyMinutes(me, selectedCal.weekKey);
    const colleagueCurrent = weeklyMinutes(colleague, selectedCal.weekKey);
    const mySelected = shiftMinutes(me, selectedCal).minutes;
    const colleagueExchange = shiftMinutes(colleague, exchangeCal).minutes;

    const myAfter = myCurrent.minutes - mySelected + colleagueExchange;
    const colleagueAfter = colleagueCurrent.minutes - colleagueExchange + mySelected;
    const unknown = [...new Set([...myCurrent.unknown, ...colleagueCurrent.unknown])];

    return {
      myCurrent:myCurrent.minutes, myAfter, myDelta:myAfter-myCurrent.minutes,
      colleagueCurrent:colleagueCurrent.minutes, colleagueAfter, colleagueDelta:colleagueAfter-colleagueCurrent.minutes,
      unknown
    };
  }

  function cambioShiftColor(shift) {
    const code = ottieniTurnoPulito(shift) || 'RIP';
    return shiftBorderColor[classify(code)] || '#94a3b8';
  }

  function cambioShiftBadge(shift) {
    const code = displayShift(shift);
    const visible = code === 'RIP' ? '===' : code;
    const color = cambioShiftColor(code);
    return `<span class="cambio-shift-badge" style="--cambio-shift-color:${color}">${visible}</span>`;
  }

  function shortCambioDate(cal) {
    const date = new Date(`${cal.iso}T12:00:00`);
    const value = new Intl.DateTimeFormat('it-IT', {
      weekday:'short', day:'numeric', month:'short'
    }).format(date);
    return value.replace(/\./g, '').toUpperCase();
  }

  function renderHoursSummary(me, colleague, selectedCal, exchangeCal) {
    const box = document.getElementById('cambio-hours-summary');
    if (!box) return;

    const myName = displaySurname(me.agente).toUpperCase();
    const colleagueName = displaySurname(colleague.agente).toUpperCase();

    const mySelectedRaw = effectiveRawShift(me, selectedCal);
    const myExchangeRaw = effectiveRawShift(me, exchangeCal);
    const colleagueSelectedRaw = effectiveRawShift(colleague, selectedCal);
    const colleagueExchangeRaw = effectiveRawShift(colleague, exchangeCal);

    const myGivenMinutes = shiftMinutes(me, selectedCal);
    const colleagueGivenMinutes = shiftMinutes(colleague, exchangeCal);

    const myDelta = colleagueGivenMinutes.minutes - myGivenMinutes.minutes;
    const colleagueDelta = myGivenMinutes.minutes - colleagueGivenMinutes.minutes;

    const deltaClass = value => value > 0 ? 'delta-plus' : value < 0 ? 'delta-minus' : 'delta-zero';

    const unknown = [...new Set([
      ...(myGivenMinutes.unknown ? [myGivenMinutes.code] : []),
      ...(colleagueGivenMinutes.unknown ? [colleagueGivenMinutes.code] : [])
    ])];

    const note = unknown.length
      ? `<div class="cambio-hours-note">Durata non disponibile per ${unknown.join(', ')}: la variazione potrebbe non essere completa.</div>`
      : `<div class="cambio-hours-note">La variazione indica le ore guadagnate o perse da ciascun agente.</div>`;

    box.innerHTML = `
      <div class="cambio-hours-title">Cambio turno e variazione ore</div>

      <div class="cambio-summary-table-wrap">
        <table class="cambio-summary-table">
          <thead>
            <tr>
              <th>Agente</th>
              <th>${shortCambioDate(selectedCal)}</th>
              <th>${shortCambioDate(exchangeCal)}</th>
              <th>Variazione</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">${myName}</th>
              <td>
                <div class="cambio-cell-shifts">
                  ${cambioShiftBadge(mySelectedRaw)}
                  <span class="cambio-cell-arrow">→</span>
                  ${cambioShiftBadge(colleagueSelectedRaw)}
                </div>
              </td>
              <td>
                <div class="cambio-cell-shifts">
                  ${cambioShiftBadge(myExchangeRaw)}
                  <span class="cambio-cell-arrow">→</span>
                  ${cambioShiftBadge(colleagueExchangeRaw)}
                </div>
              </td>
              <td>
                <span class="cambio-exchange-delta ${deltaClass(myDelta)}">${formatDelta(myDelta)}</span>
              </td>
            </tr>

            <tr>
              <th scope="row">${colleagueName}</th>
              <td>
                <div class="cambio-cell-shifts">
                  ${cambioShiftBadge(colleagueSelectedRaw)}
                  <span class="cambio-cell-arrow">→</span>
                  ${cambioShiftBadge(mySelectedRaw)}
                </div>
              </td>
              <td>
                <div class="cambio-cell-shifts">
                  ${cambioShiftBadge(colleagueExchangeRaw)}
                  <span class="cambio-cell-arrow">→</span>
                  ${cambioShiftBadge(myExchangeRaw)}
                </div>
              </td>
              <td>
                <span class="cambio-exchange-delta ${deltaClass(colleagueDelta)}">${formatDelta(colleagueDelta)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      ${note}`;
    box.classList.add('open');
  }

  function odsDate(iso) {
    return formatDate(iso).toUpperCase();
  }

  function cambioScheduleLines(me, colleague, selectedCal, exchangeCal) {
    const myName = displaySurname(me.agente).toUpperCase();
    const colleagueName = displaySurname(colleague.agente).toUpperCase();
    const myGivenShift = displayShift(effectiveRawShift(me, selectedCal));
    const colleagueGivenShift = displayShift(effectiveRawShift(colleague, exchangeCal));
    const visibleShift = shift => shift === 'RIP' ? '===' : shift;

    if (selectedCal.iso === exchangeCal.iso) {
      return [
        odsDate(selectedCal.iso),
        `${myName}: ${visibleShift(colleagueGivenShift)}`,
        `${colleagueName}: ${visibleShift(myGivenShift)}`
      ];
    }

    return [
      odsDate(exchangeCal.iso),
      `${myName}: ${visibleShift(colleagueGivenShift)}`,
      `${colleagueName}: ===`,
      odsDate(selectedCal.iso),
      `${myName}: ===`,
      `${colleagueName}: ${visibleShift(myGivenShift)}`
    ];
  }

  function makeMailText(me, colleague, selectedCal, exchangeCal) {
    const colleagueName = displaySurname(colleague.agente).toUpperCase();
    return [
      'Buongiorno.',
      `In accordo con l'agente ${colleagueName}, chiedo un cambio turno senza oneri per l'azienda.`,
      ...cambioScheduleLines(me, colleague, selectedCal, exchangeCal),
      'Cordiali saluti',
      displaySurname(me.agente).charAt(0).toUpperCase() + displaySurname(me.agente).slice(1).toLowerCase()
    ].join('\n');
  }

  function makeWhatsappText(me, colleague, selectedCal, exchangeCal) {
    const colleagueSurname = displaySurname(colleague.agente);
    const hours = buildHoursComparison(me, colleague, selectedCal, exchangeCal);
    return [
      `Ciao ${colleagueSurname.charAt(0).toUpperCase() + colleagueSurname.slice(1).toLowerCase()}. Ti chiedo questo cambio:`,
      ...cambioScheduleLines(me, colleague, selectedCal, exchangeCal),
      `Tu avresti una variazione di ${formatDelta(hours.colleagueDelta)}.`,
      'Fammi sapere se per te va bene.'
    ].join('\n');
  }

  function chooseCambioCell(cell) {
    const selectedCal = dateCalendario.find(item => item.col === Number(selectedCol));
    const exchangeCal = dateCalendario.find(item => item.col === Number(cell.dataset.cambioCol));
    const location = getLoggedAgentLocation();
    const colleagueRow = cell.closest('tr');
    const colleague = getAgentForTableRow(colleagueRow);
    if (!selectedCal || !exchangeCal || !location?.agent || !colleague) return;

    selectedSwap = {selectedCal, exchangeCal, me:location.agent, colleague};
    const {mail} = ensurePanels();
    renderHoursSummary(location.agent, colleague, selectedCal, exchangeCal);
    document.getElementById('cambio-mail-status').textContent = '';
    mail.classList.add('open');
    document.getElementById('cambio-request-sent')?.focus();
    mail.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  async function copyCambioWhatsapp() {
    const textarea = document.getElementById('cambio-whatsapp-text');
    const status = document.getElementById('cambio-mail-status');
    if (!textarea?.value) return;
    try {
      await navigator.clipboard.writeText(textarea.value);
      status.textContent = 'Messaggio WhatsApp copiato.';
    } catch (_) {
      textarea.select();
      document.execCommand('copy');
      status.textContent = 'Messaggio WhatsApp copiato.';
    }
  }

  async function copyCambioText() {
    const textarea = document.getElementById('cambio-mail-text');
    const status = document.getElementById('cambio-mail-status');
    if (!textarea?.value) return;
    try {
      await navigator.clipboard.writeText(textarea.value);
      status.textContent = 'Testo copiato negli appunti.';
    } catch (_) {
      textarea.select();
      document.execCommand('copy');
      status.textContent = 'Testo copiato negli appunti.';
    }
  }

  function clearCambioVisuals({keepMail=false} = {}) {
    document.querySelectorAll('#tbody tr.cambio-hidden,#tbody tr.cambio-candidato').forEach(row => row.classList.remove('cambio-hidden','cambio-candidato'));
    document.querySelectorAll('#tbody td.cambio-possibile').forEach(cell => {
      cell.classList.remove('cambio-possibile');
      delete cell.dataset.cambioAgentId;
      delete cell.dataset.cambioCol;
      cell.removeAttribute('title');
    });
    document.querySelectorAll('#tbody td.cambio-turno-selezionato').forEach(cell => cell.classList.remove('cambio-turno-selezionato'));
    document.querySelectorAll('.date-header th.cambio-data-selezionata,.date-header th.selected-day').forEach(th => th.classList.remove('cambio-data-selezionata','selected-day'));
    document.querySelectorAll('#tbody td.col-selected').forEach(td => td.classList.remove('col-selected'));
    if (!keepMail) {
      document.getElementById('cambio-mail-box')?.classList.remove('open');
      document.getElementById('cambio-hours-summary')?.classList.remove('open');
    }
    removeSharedCrewDecorations();
  }

  function showCambioOptions(col, lockRows = false) {
    const cal = dateCalendario.find(item => item.col === Number(col));
    const location = getLoggedAgentLocation();
    const me = location?.agent;
    const myRow = document.querySelector('#tbody tr.logged-agent-row');
    if (!cal || !me || !myRow) return false;

    const myRaw = effectiveRawShift(me, cal);
    const myShift = cleanShift(me, cal);
    clearCambioVisuals({keepMail:true});

    selectedCol = cal.col;
    selectedShiftValue = myRaw;

    let candidateAgents = 0;
    let selectableChanges = 0;
    let sameDayChanges = 0;
    let twoDayChanges = 0;

    document.querySelector(`.date-header th[data-col="${cal.col}"]`)
      ?.classList.add('selected-day','cambio-data-selezionata');

    myRow.querySelector(`td[data-col="${cal.col}"]`)
      ?.classList.add('col-selected','cambio-turno-selezionato');

    trElements.forEach(row => {
      if (row.classList.contains('logged-agent-row')) return;

      const agent = getAgentForTableRow(row);
      let rowHasSelectableChange = false;

      // Devono essere dello stesso grado e della residenza attualmente ammessa.
      if (sameGradeAndResidence(agent, row, location)) {
        const colleagueShiftToday = cleanShift(agent, cal);

        /*
         * CAMBIO NELLA STESSA GIORNATA
         * I due turni sono diversi. È valido anche lo scambio diretto
         * tra un turno lavorato e un riposo.
         * La bolla selezionabile è quella della data scelta.
         */
        if (colleagueShiftToday !== myShift) {
          const cell = row.querySelector(`td[data-col="${cal.col}"]`);
          if (cell?.querySelector('.cell-pill')) {
            cell.classList.add('cambio-possibile');
            cell.dataset.cambioAgentId = String(agent.id ?? '');
            cell.dataset.cambioCol = String(cal.col);
            cell.dataset.cambioDescription =
              `Cambio con ${agent.agente}: tu prenderesti ${displayShift(effectiveRawShift(agent, cal))}, ` +
              `${agent.agente} prenderebbe ${displayShift(myRaw)}`;
            cell.removeAttribute('title');

            rowHasSelectableChange = true;
            selectableChanges++;
            sameDayChanges++;
          }
        }

        /*
         * CAMBIO SU DUE GIORNATE
         * Il collega è libero nella mia giornata e ha un turno,
         * nella stessa settimana, in una giornata in cui io sono libero.
         */
        if (myShift && !colleagueShiftToday) {
          dateCalendario.forEach(otherCal => {
            if (otherCal.weekKey !== cal.weekKey || otherCal.col === cal.col) return;
            if (!isRest(me, otherCal) || isRest(agent, otherCal)) return;

            const cell = row.querySelector(`td[data-col="${otherCal.col}"]`);
            if (!cell?.querySelector('.cell-pill')) return;

            cell.classList.add('cambio-possibile');
            cell.dataset.cambioAgentId = String(agent.id ?? '');
            cell.dataset.cambioCol = String(otherCal.col);
            cell.dataset.cambioDescription =
              `Cambio con ${agent.agente}: tu prenderesti ${cleanShift(agent, otherCal)} ` +
              `il ${otherCal.labelEstesa}; ${agent.agente} prenderebbe ${myShift} ` +
              `il ${cal.labelEstesa}`;
            cell.removeAttribute('title');

            rowHasSelectableChange = true;
            selectableChanges++;
            twoDayChanges++;
          });
        }
      }

      /*
       * Questa è la logica di Trova Turno:
       * dopo la conferma si vede soltanto chi ha almeno una bolla gialla.
       * Chi è libero ma non ha un turno scambiabile viene nascosto.
       * Chi fa già la stessa corsa viene nascosto.
       */
      if (rowHasSelectableChange) {
        row.classList.add('cambio-candidato');
        candidateAgents++;
      } else if (lockRows) {
        row.classList.add('cambio-hidden');
      }
    });

    removeSharedCrewDecorations();

    const {info} = ensurePanels();
    const residenceButton = isAnyBaristaProfile() ? '' :
      `<button type="button" class="cambio-residence-toggle" onclick="toggleOtherResidences()">` +
      `${cambioShowOtherResidences ? 'Nascondi altre residenze' : 'Carica altre residenze'}` +
      `</button>`;

    if (lockRows) {
      if (candidateAgents > 0) {
        info.innerHTML =
          `<button type="button" onclick="clearCambioSearch()">Azzera</button>` +
          residenceButton +
          `<span>Puoi cambiare <strong>${displayShift(myRaw)}</strong> del ` +
          `<strong>${cal.labelEstesa}</strong> con <strong>${candidateAgents}</strong> agenti. ` +
          `Cambi nella stessa giornata: <strong>${sameDayChanges}</strong>; ` +
          `su due giornate: <strong>${twoDayChanges}</strong>. ` +
          `Sono visibili soltanto gli agenti con cui puoi fare cambio. ` +
          `Tocca una <strong>bolla gialla</strong>.</span>`;
      } else {
        info.innerHTML =
          `<button type="button" onclick="clearCambioSearch()">Azzera</button>` +
          residenceButton +
          `<span>Nessun agente disponibile per cambiare ` +
          `<strong>${displayShift(myRaw)}</strong> del <strong>${cal.labelEstesa}</strong>. ` +
          `Prova a caricare le altre residenze.</span>`;
      }
    } else {
      info.innerHTML =
        residenceButton +
        `<span>Per <strong>${displayShift(myRaw)}</strong> del <strong>${cal.labelEstesa}</strong> ` +
        `sono stati trovati <strong>${candidateAgents}</strong> agenti e ` +
        `<strong>${selectableChanges}</strong> cambi possibili. Conferma per mostrare solo loro.</span>`;
    }

    info.classList.add('open');
    return true;
  }

  function runCambioSearch(col) {
    cambioPinned = true;
    showCambioOptions(col, true);
  }
  window.runCambioSearch = runCambioSearch;

  window.selectDay = function(col) { runCambioSearch(col); };
  window.eseguiRicercaHeader = function(col) { runCambioSearch(col); };

  if (typeof originalRenderTable === 'function') {
    window.renderTable = function(...args) {
      const result = originalRenderTable.apply(this, args);
      setTimeout(() => {
        clearCambioSearch();
        appendOtherResidenceRows();
        applyPermanentPeerFilter();
        removeSharedCrewDecorations();
        applyCambioDateWindow();
      }, 0);
      return result;
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    const title = document.querySelector('.doc-title');
    if (title) title.textContent = 'NaviSuite Cambi';
    const subtitle = document.querySelector('.doc-subtitle');
    if (subtitle) subtitle.textContent = 'Passa o tocca una data per vedere i cambi possibili';

    document.getElementById('day-panel')?.remove();
    document.getElementById('crew-drawer')?.remove();
    document.getElementById('crew-drawer-toggle')?.remove();
    document.querySelectorAll('#coverage-board,.coverage-board,.coverage-section').forEach(el => el.remove());
    ensurePanels();
    ensureChangeRequestRegister();
    loadFirebaseChangeRequests();
    applyCambioDateWindow();

    const tableWrap = document.getElementById('matrix-scroll-wrap');
    let touchPreviewCol = null;

    tableWrap?.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || cambioPinned) return;
      const source = event.target.closest('.date-header th[data-col], #tbody tr.logged-agent-row td[data-col]');
      if (!source || event.target.closest('a,button')) return;
      showCambioOptions(Number(source.dataset.col), false);
    }, true);

    tableWrap?.addEventListener('click', event => {
      const possible = event.target.closest('td.cambio-possibile');
      if (possible) {
        event.preventDefault();
        event.stopImmediatePropagation();
        chooseCambioCell(possible);
        return;
      }
      const source = event.target.closest('.date-header th[data-col], #tbody tr.logged-agent-row td[data-col]');
      if (!source || event.target.closest('a,button')) return;
      const col = Number(source.dataset.col);
      event.preventDefault();
      event.stopImmediatePropagation();
      const touchLike = window.matchMedia('(hover: none)').matches;
      if (touchLike && touchPreviewCol !== col) {
        touchPreviewCol = col;
        cambioPinned = false;
        showCambioOptions(col, false);
      } else {
        touchPreviewCol = null;
        runCambioSearch(col);
      }
    }, true);

    const observer = new MutationObserver(() => {
      applyPermanentPeerFilter();
      removeSharedCrewDecorations();
      applyCambioDateWindow();
    });
    const tbody = document.getElementById('tbody');
    if (tbody) observer.observe(tbody, {childList:true, subtree:true});
  });
})();
