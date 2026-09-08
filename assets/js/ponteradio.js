(function () {
  'use strict';

  const API_ROOT = '/api/navisuite-v2/ponteradio';
  const VAPID_PUBLIC_KEY = 'BBuuE6ITF9JZ2ADHsgAbt4Vfc74bNsST6dbixZEtcWa8QppgWhrmtQdH46GkMtG12FFuC6bxl5MpxPCrRYKDgL0';
  const VAPID_VERSION = 2;
  const DB_NAME = 'navisuite-ponteradio';
  const STORE_NAME = 'messages';
  const MAX_HISTORY = 500;
  const DEVICE_KEY = 'navisuite.ponteradio.device';
  const $ = id => document.getElementById(id);
  let volatileDeviceId = '';

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null');
    } catch (_) {
      return null;
    }
  }

  const profile = readProfile();
  const legacyId = String(profile?.id || profile?.agentId || '').trim();
  const displayName = String(profile?.name || profile?.agente || profile?.cognome || legacyId).trim();
  let currentMessages = [];
  let recipientsList = [];
  let recipientNames = new Map();
  let currentAgentId = '';
  let canBroadcast = false;
  let selectedRecipient = null;
  let activeRecipientIndex = -1;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function randomId(prefix) {
    const value = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return prefix + value;
  }

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('it-IT')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function recipientLabel(row) {
    const name = String(row?.name || row?.legacy_id || row?.id || '').trim();
    return row?.id && String(row.id) === currentAgentId ? name + ' (Tu)' : name;
  }

  function matchesRecipient(row, query) {
    const needle = normalizeSearch(query);
    if (!needle) return true;
    const name = normalizeSearch(row?.name || row?.legacy_id || row?.id || '');
    return name.startsWith(needle) || name.split(' ').some(part => part.startsWith(needle));
  }

  function openHistoryDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('time', 'time');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Storico locale non disponibile.'));
    });
  }

  async function historyTransaction(mode, callback) {
    const db = await openHistoryDb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error('Errore nello storico locale.'));
        transaction.onabort = () => reject(transaction.error || new Error('Operazione locale annullata.'));
        result = callback(store);
      });
    } finally {
      db.close();
    }
  }

  async function readHistory() {
    const rows = await historyTransaction('readonly', store => {
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    });
    return (await rows).sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))).slice(-MAX_HISTORY);
  }

  async function addHistory(message) {
    const row = {
      id: String(message.id || randomId('local-')),
      direction: message.direction === 'in' ? 'in' : 'out',
      peerId: String(message.peerId || ''),
      peer: String(message.peer || 'Agente'),
      body: String(message.body || '').slice(0, 500),
      time: String(message.time || new Date().toISOString()),
    };
    await historyTransaction('readwrite', store => store.put(row));
    const all = await readHistory();
    if (all.length >= MAX_HISTORY) {
      const keep = new Set(all.slice(-MAX_HISTORY).map(item => item.id));
      await historyTransaction('readwrite', store => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (!keep.has(cursor.value.id)) cursor.delete();
          cursor.continue();
        };
      });
    }
    await renderHistory();
  }

  async function clearHistory() {
    await historyTransaction('readwrite', store => store.clear());
    await renderHistory();
  }

  async function migrateLegacyHistory() {
    const oldKey = 'navisuite.ponteradio.history.' + legacyId;
    let rows = [];
    try { rows = JSON.parse(localStorage.getItem(oldKey) || '[]'); } catch (_) {}
    if (!Array.isArray(rows) || !rows.length) return;
    for (const row of rows.slice(-MAX_HISTORY)) {
      await addHistory({ ...row, id: row.id || randomId('legacy-') });
    }
    localStorage.removeItem(oldKey);
  }

  async function renderHistory() {
    const target = $('radio-history');
    if (!target) return;
    try {
      currentMessages = (await readHistory()).reverse();
      target.innerHTML = currentMessages.length
        ? currentMessages.map(message => `
          <article class="message ${message.direction === 'out' ? 'out' : 'in'}" role="button" tabindex="0"
            data-message-id="${escapeHtml(message.id)}" title="Riprendi questa conversazione">
            <div class="meta">
              <strong>${escapeHtml(message.direction === 'out' ? 'A ' + message.peer : 'Da ' + message.peer)}</strong>
              <span>${escapeHtml(new Date(message.time).toLocaleString('it-IT', { dateStyle:'short', timeStyle:'short' }))}</span>
            </div>
            <div class="body">${escapeHtml(message.body)}</div>
          </article>`).join('')
        : '<div class="empty">Nessun messaggio salvato su questo dispositivo.</div>';
    } catch (_) {
      target.innerHTML = '<div class="empty">Storico locale non disponibile.</div>';
    }
  }

  function resumeConversation(card) {
    const message = currentMessages.find(item => item.id === card?.dataset?.messageId);
    if (!message) return;
    const peerId = String(message.peerId || '');
    if (peerId) chooseRecipientById(peerId);
    else if (message.peer) $('radio-agent-search').value = String(message.peer);
    $('radio-body').value = '';
    $('radio-body').placeholder = 'Continua la conversazione con ' + String(message.peer || 'questo agente') + '…';
    $('radio-status').textContent = '↩ Conversazione ripresa con ' + String(message.peer || 'destinatario') + '.';
    $('radio-body').focus();
    $('radio-body').scrollIntoView({ behavior:'smooth', block:'center' });
  }

  async function ensurePocketBaseAuth() {
    if (!window.NaviV2PB) throw new Error('Collegamento PocketBase non disponibile.');
    const currentUser = NaviV2PB.user();
    if (NaviV2PB.token() && String(currentUser?.login_id || '') === legacyId && await NaviV2PB.refresh()) {
      currentAgentId = String(NaviV2PB.agent()?.id || '');
      return;
    }
    NaviV2PB.logout();
    const passwordHash = String(localStorage.getItem('navidiaria.pin.' + legacyId) || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(passwordHash)) {
      const missing = new Error('Riaccedi a NaviSuite su questo dispositivo per attivare Ponte Radio.');
      missing.code = 'no-credential';
      throw missing;
    }
    try {
      await NaviV2PB.loginWithPasswordHash(legacyId, passwordHash);
    } catch (error) {
      if (error && (error.status === 400 || error.status === 403 || error.status === 404)) {
        const pending = new Error('Ponte Radio non e\u2019 ancora attivo per il tuo profilo. Comunica all\u2019amministratore il codice agente ' + legacyId + '.');
        pending.code = 'not-provisioned';
        pending.detail = error;
        throw pending;
      }
      throw error;
    }
    currentAgentId = String(NaviV2PB.agent()?.id || '');
  }

  function urlBase64ToUint8Array(value) {
    const pad = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  // Una subscription creata con una chiave VAPID diversa (es. periodo beta)
  // non e' recapitabile dal worker attuale: va ricreata, non riusata.
  function serverKeyMatches(subscription) {
    try {
      const existing = subscription && subscription.options && subscription.options.applicationServerKey;
      if (!existing) return true;
      const want = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const have = new Uint8Array(existing);
      if (have.length !== want.length) return false;
      for (let i = 0; i < want.length; i += 1) if (have[i] !== want[i]) return false;
      return true;
    } catch (_) {
      return true;
    }
  }

  async function activePushSubscription(registration, forceRecreate) {
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && (forceRecreate || !serverKeyMatches(subscription))) {
      try { await subscription.unsubscribe(); } catch (_) {}
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return subscription;
  }

  function deviceId() {
    let id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (_) {}
    if (!id && volatileDeviceId) return volatileDeviceId;
    if (!id) {
      id = randomId('device-');
      volatileDeviceId = id;
      try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
    }
    return id;
  }

  function deviceLabel() {
    if (/iPhone/i.test(navigator.userAgent)) return 'iPhone';
    if (/iPad/i.test(navigator.userAgent)) return 'iPad';
    if (/Android/i.test(navigator.userAgent)) return 'Android';
    return 'Browser';
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  async function serviceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker non disponibile.');
    const registration = await navigator.serviceWorker.register('sw.js?ponteradio=2', { scope:'./', updateViaCache:'none' });
    registration.update().catch(() => {});
    return navigator.serviceWorker.ready;
  }

  async function saveSubscription(subscription) {
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Subscription Web Push incompleta.');
    const result = await NaviV2PB.request(API_ROOT + '/subscription', {
      method:'POST',
      body:{
        device_id:deviceId(),
        device_label:deviceLabel(),
        endpoint:String(json.endpoint),
        p256dh:String(json.keys.p256dh),
        auth_key:String(json.keys.auth),
        enabled:true,
        vapid_version:VAPID_VERSION,
        preferences:{ ponte_radio:true },
      },
    });
    if (!result || !result.id) throw new Error('Il server non ha confermato la registrazione del dispositivo.');
    return result;
  }

  function pushStatus(heading, text, showEnable, showRepair) {
    const title = $('radio-push-title');
    const copy = $('radio-push-copy');
    const enable = $('radio-enable');
    const repair = $('radio-repair');
    if (title) title.textContent = heading;
    if (copy) copy.textContent = text;
    if (enable) enable.hidden = !showEnable;
    if (repair) repair.hidden = !showRepair;
  }

  async function syncPushSubscription(requestPermission, forceRecreate) {
    if (!('Notification' in window) || !('PushManager' in window)) {
      pushStatus('Notifiche non supportate', 'Questo browser non supporta Web Push.', false, false);
      return false;
    }
    if (isIos() && !isStandalone()) {
      pushStatus('Installa NaviSuite su iPhone', 'Apri NaviSuite dalla schermata Home per ricevere le notifiche.', false, false);
      return false;
    }

    let permission = Notification.permission;
    if (requestPermission && permission !== 'granted') permission = await Notification.requestPermission();
    if (permission === 'denied') {
      pushStatus('Notifiche bloccate', 'Riattivale dalle impostazioni del browser, poi tocca 🔄 Ripara.', false, true);
      return false;
    }
    if (permission !== 'granted') {
      pushStatus('Notifiche non ancora attive', 'Attivale per ricevere i messaggi anche con NaviSuite chiusa.', true, false);
      return false;
    }

    pushStatus('Registrazione dispositivo…', 'Un momento.', false, false);
    try {
      await ensurePocketBaseAuth();
      const registration = await serviceWorkerRegistration();
      const subscription = await activePushSubscription(registration, forceRecreate === true);
      await saveSubscription(subscription);
    } catch (error) {
      console.warn('[PonteRadio] registrazione notifiche non riuscita:', error && error.code, error && error.message);
      if (error && error.code === 'no-credential') {
        pushStatus('Riaccedi a NaviSuite', error.message, false, false);
      } else if (error && error.code === 'not-provisioned') {
        pushStatus('Ponte Radio non ancora attivo', error.message, false, false);
      } else {
        pushStatus('Errore registrazione notifiche', (error && error.message ? error.message + ' ' : '') + 'Tocca 🔄 Ripara per riprovare.', false, true);
      }
      return false;
    }
    pushStatus('✅ Notifiche attive', 'Questo dispositivo può ricevere i messaggi di Ponte Radio.', false, true);
    console.info('[PonteRadio] dispositivo registrato per', legacyId);
    return true;
  }

  async function repairNotifications() {
    const button = $('radio-repair');
    if (button) button.disabled = true;
    try { await syncPushSubscription(true, true); }
    finally { if (button) button.disabled = false; }
  }

  async function loadRecipients() {
    const response = await NaviV2PB.request(API_ROOT + '/recipients');
    const rows = Array.isArray(response.recipients) ? response.recipients : [];
    canBroadcast = response.canBroadcast === true;
    currentAgentId = String(NaviV2PB.agent()?.id || currentAgentId || '');
    recipientsList = rows.map(row => ({
      id:String(row.id || ''),
      legacy_id:String(row.legacy_id || ''),
      name:String(row.name || row.legacy_id || row.id || ''),
    })).filter(row => row.id);
    recipientNames = new Map(rows.map(row => [String(row.id), String(row.name || row.legacy_id || row.id)]));
    selectedRecipient = null;
    $('radio-agent').value = '';
    $('radio-agent-search').value = '';
    $('radio-agent-search').placeholder = recipientsList.length ? 'Inizia a scrivere il cognome…' : 'Nessun destinatario disponibile';
    renderRecipientResults('');
  }

  function resultRows(query) {
    const rows = recipientsList.filter(row => matchesRecipient(row, query)).slice(0, 12);
    if (canBroadcast && (!query || normalizeSearch('tutti gli agenti').startsWith(normalizeSearch(query)) || normalizeSearch('broadcast').startsWith(normalizeSearch(query)))) {
      rows.unshift({ id:'*', name:'📣 Tutti gli agenti', legacy_id:'broadcast', broadcast:true });
    }
    return rows;
  }

  function renderRecipientResults(query) {
    const box = $('radio-agent-results');
    if (!box) return;
    const rows = resultRows(query);
    activeRecipientIndex = rows.length ? Math.min(Math.max(activeRecipientIndex, 0), rows.length - 1) : -1;
    box.hidden = false;
    box.innerHTML = rows.length
      ? rows.map((row, index) => `
        <button class="recipient-option ${index === activeRecipientIndex ? 'active' : ''}" type="button" role="option"
          data-recipient-id="${escapeHtml(row.id)}" aria-selected="${index === activeRecipientIndex ? 'true' : 'false'}">
          ${escapeHtml(recipientLabel(row))}
          <small>${escapeHtml(row.broadcast ? 'Invio a tutti gli agenti' : 'ID ' + (row.legacy_id || row.id))}</small>
        </button>`).join('')
      : '<div class="recipient-option" role="option" aria-disabled="true">Nessun agente trovato.</div>';
  }

  function hideRecipientResults() {
    const box = $('radio-agent-results');
    if (box) box.hidden = true;
  }

  function chooseRecipient(row) {
    if (!row?.id) return;
    selectedRecipient = row;
    $('radio-agent').value = String(row.id);
    $('radio-agent-search').value = recipientLabel(row);
    hideRecipientResults();
  }

  function chooseRecipientById(id) {
    const target = String(id || '');
    const row = target === '*'
      ? { id:'*', name:'📣 Tutti gli agenti', legacy_id:'broadcast', broadcast:true }
      : recipientsList.find(item => item.id === target);
    if (row) chooseRecipient(row);
  }

  function selectedPeerName(target) {
    if (selectedRecipient && String(selectedRecipient.id) === String(target)) return recipientLabel(selectedRecipient);
    if (target === '*') return '📣 Tutti gli agenti';
    const row = recipientsList.find(item => item.id === String(target));
    return row ? recipientLabel(row) : recipientNames.get(target) || target;
  }

  async function sendMessage() {
    const target = $('radio-agent').value;
    const body = $('radio-body').value.trim();
    const peer = selectedPeerName(target);
    if (!target) { $('radio-status').textContent = 'Scegli un destinatario.'; return; }
    if (target === '*' && !canBroadcast) { $('radio-status').textContent = 'L’invio a tutti è riservato agli admin.'; return; }
    if (!body) { $('radio-status').textContent = 'Scrivi il messaggio.'; return; }

    const button = $('radio-send');
    button.disabled = true;
    $('radio-status').textContent = 'Invio a PocketBase…';
    try {
      const queued = await NaviV2PB.request(API_ROOT + '/send', {
        method:'POST',
        body:{ target_agent:target === '*' ? '' : target, broadcast:target === '*', body },
      });
      await addHistory({
        id:'out-' + String(queued.id || randomId('message-')),
        direction:'out',
        peerId:target === '*' ? '' : target,
        peer,
        body,
        time:new Date().toISOString(),
      });
      $('radio-body').value = '';
      $('radio-status').textContent = '✅ Messaggio consegnato al servizio di invio.';
    } catch (error) {
      if (error?.status === 401) {
        try {
          await ensurePocketBaseAuth();
          $('radio-status').textContent = 'Sessione aggiornata: premi di nuovo Invia.';
        } catch (authError) {
          $('radio-status').textContent = '❌ ' + (authError?.message || 'Accesso PocketBase non riuscito.');
        }
      } else {
        $('radio-status').textContent = '❌ ' + (error?.message || 'Invio non riuscito.');
      }
    } finally {
      button.disabled = false;
    }
  }

  async function init() {
    if (!profile || !legacyId) {
      $('radio-app').innerHTML = '<section class="radio-card access-lock"><h1>📻 Ponte Radio</h1><p>Accedi a NaviSuite per usare Ponte Radio.</p><a class="radio-home" href="index.html">Torna alla Home</a></section>';
      return;
    }

    await renderHistory();
    await migrateLegacyHistory();

    // Le notifiche si registrano per conto proprio: non devono dipendere dal
    // caricamento dell'elenco destinatari.
    syncPushSubscription(false).catch(error => {
      console.warn('[PonteRadio] sync notifiche:', error && error.message);
    });

    $('radio-status').textContent = 'Collegamento a PocketBase…';
    try {
      await ensurePocketBaseAuth();
      await loadRecipients();
      $('radio-status').textContent = displayName ? 'Pronto, ' + displayName + '.' : 'Ponte Radio pronto.';
    } catch (error) {
      const code = error && error.code;
      $('radio-agent-search').placeholder = 'Destinatari non disponibili';
      $('radio-agent-search').disabled = true;
      $('radio-send').disabled = true;
      if (code === 'no-credential') {
        $('radio-status').innerHTML = '⚠️ Riaccedi a NaviSuite su questo dispositivo. <a class="radio-home" href="index.html">Accedi</a>';
      } else if (code === 'not-provisioned') {
        $('radio-status').textContent = '⚠️ ' + error.message;
      } else {
        $('radio-status').textContent = '❌ ' + (error && error.message ? error.message : 'Accesso PocketBase non riuscito.');
      }
    }
  }

  $('radio-agent-search').addEventListener('input', event => {
    selectedRecipient = null;
    $('radio-agent').value = '';
    activeRecipientIndex = 0;
    renderRecipientResults(event.target.value);
  });
  $('radio-agent-search').addEventListener('focus', event => {
    activeRecipientIndex = 0;
    renderRecipientResults(event.target.value);
  });
  $('radio-agent-search').addEventListener('keydown', event => {
    const rows = resultRows($('radio-agent-search').value);
    if (event.key === 'Escape') { hideRecipientResults(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!rows.length) return;
      activeRecipientIndex = event.key === 'ArrowDown'
        ? (activeRecipientIndex + 1 + rows.length) % rows.length
        : (activeRecipientIndex - 1 + rows.length) % rows.length;
      renderRecipientResults($('radio-agent-search').value);
      return;
    }
    if (event.key === 'Enter' && rows.length && !selectedRecipient) {
      event.preventDefault();
      chooseRecipient(rows[Math.max(activeRecipientIndex, 0)]);
    }
  });
  $('radio-agent-results').addEventListener('mousedown', event => {
    const option = event.target.closest('[data-recipient-id]');
    if (!option) return;
    event.preventDefault();
    chooseRecipientById(option.dataset.recipientId);
    $('radio-body').focus();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.recipient-picker')) hideRecipientResults();
  });
  $('radio-send').addEventListener('click', sendMessage);
  $('radio-enable').addEventListener('click', async () => {
    $('radio-enable').disabled = true;
    try { await syncPushSubscription(true); }
    finally { $('radio-enable').disabled = false; }
  });
  $('radio-repair')?.addEventListener('click', repairNotifications);
  $('radio-history').addEventListener('click', event => {
    const card = event.target.closest('[data-message-id]');
    if (card) resumeConversation(card);
  });
  $('radio-history').addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-message-id]');
    if (card) { event.preventDefault(); resumeConversation(card); }
  });
  $('radio-clear').addEventListener('click', () => {
    if (confirm('Cancellare lo storico Ponte Radio salvato su questo dispositivo?')) {
      clearHistory().catch(() => {});
    }
  });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'ponteradio:message') renderHistory();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderHistory();
  });

  init();
})();
