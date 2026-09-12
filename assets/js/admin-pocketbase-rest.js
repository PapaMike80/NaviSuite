(function () {
  'use strict';
  // Controparte PocketBase di admin-firebase-rest.js / firebase-data.js: solo la
  // superficie usata da firebase-auth.js e (via window.NaviAdminPB) dalle pagine
  // che gia' controllano il dataSource. La password (pinHash) di PocketBase non
  // e' MAI leggibile via API (per design): l'autenticazione vera avviene
  // chiamando auth-with-password, non confrontando hash lato client.
  const DEFAULT_BASE = 'https://truenas-scale.tail805e51.ts.net';
  const TOKEN_KEY = 'navisuite.pb.token';
  const base = () => { try { return (localStorage.getItem('navisuite.pbBase') || DEFAULT_BASE).replace(/\/$/, ''); } catch (_) { return DEFAULT_BASE; } };
  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } };
  const setToken = v => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch (_) {} };
  const esc = v => String(v ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  // Timeout esplicito: senza, una richiesta che resta "appesa" (Tailscale lento,
  // PocketBase irraggiungibile da questa rete, ecc.) blocca a tempo indefinito
  // chi aspetta la risposta invece di fallire con un errore gestibile.
  const REQUEST_TIMEOUT_MS = 10000;

  async function req(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { Accept: 'application/json' };
    if (auth && getToken()) headers.Authorization = getToken();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${base()}${path}`, { method, headers, cache: 'no-store', signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`PocketBase non raggiungibile (timeout dopo ${REQUEST_TIMEOUT_MS / 1000}s) su ${base()}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data?.message || `PocketBase ${res.status}`); err.status = res.status; err.data = data; throw err; }
    return data;
  }
  async function list(collection, { filter = '', fields = '', perPage = 200, sort = '', expand = '' } = {}) {
    const params = new URLSearchParams({ page: '1', perPage: String(perPage) });
    if (filter) params.set('filter', filter);
    if (fields) params.set('fields', fields);
    if (sort) params.set('sort', sort);
    if (expand) params.set('expand', expand);
    return (await req(`/api/collections/${encodeURIComponent(collection)}/records?${params}`)).items || [];
  }
  const findOne = async (collection, filter, fields = '') => (await list(collection, { filter, fields, perPage: 1 }))[0] || null;
  const create = (collection, body) => req(`/api/collections/${encodeURIComponent(collection)}/records`, { method: 'POST', body });
  const patch = (collection, id, body) => req(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  const remove = (collection, id) => req(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method: 'DELETE' });

  // Login vero: chiama auth-with-password (login_id + pinHash-come-password).
  // Lancia se l'utente non esiste o il PIN e' sbagliato: il chiamante non deve
  // ripetere il confronto lato client (qui non e' nemmeno possibile).
  async function authWithHash(loginId, pinHash) {
    const auth = await req('/api/collections/users/auth-with-password', { method: 'POST', auth: false, body: { identity: String(loginId), password: pinHash } });
    setToken(auth.token);
    return auth;
  }

  // Non restituisce mai pinHash (PocketBase non lo espone): solo esistenza/stato.
  async function getUserAuth(agentId) {
    const u = await findOne('users', `login_id = "${esc(agentId)}"`, 'id,must_change_pin,attivo').catch(() => null);
    if (!u) return null;
    return { exists: true, mustChangePin: Boolean(u.must_change_pin), attivo: u.attivo !== false };
  }

  async function saveUserAuth(agentId, pinHash, options = {}) {
    const id = String(agentId || '').trim();
    if (!id || !/^[a-f0-9]{64}$/i.test(String(pinHash || ''))) throw new Error('Credenziali non valide');
    const existing = await findOne('users', `login_id = "${esc(id)}"`, 'id');
    const body = { password: pinHash, passwordConfirm: pinHash };
    if ('mustChangePin' in options) body.must_change_pin = Boolean(options.mustChangePin);
    if (existing) return patch('users', existing.id, body);
    return create('users', {
      login_id: id, role: 'agente', attivo: true, verified: true, emailVisibility: false,
      email: `agent-${id.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-')}@navisuite.invalid`,
      ...body,
    });
  }

  // PocketBase richiede sempre una password valorizzata: non possiamo "cancellare"
  // il PIN come su Firebase. Marchiamo must_change_pin cosi' l'utente ne sceglie
  // uno nuovo al prossimo accesso (col PIN attuale ancora valido nel frattempo).
  async function resetUserAuth(agentId) {
    const u = await findOne('users', `login_id = "${esc(agentId)}"`, 'id');
    if (!u) return true;
    await patch('users', u.id, { must_change_pin: true });
    return true;
  }

  async function deleteRegisteredUser(agentId) {
    const u = await findOne('users', `login_id = "${esc(agentId)}"`, 'id');
    if (u) await remove('users', u.id);
    return true;
  }

  async function listRegisteredUsers() {
    const rows = await list('users', { fields: 'id,login_id,role,nome_visualizzato,must_change_pin,attivo', perPage: 500 });
    return rows.map(u => ({ id: u.login_id, role: u.role, name: u.nome_visualizzato, mustChangePin: Boolean(u.must_change_pin), active: u.attivo !== false }));
  }

  async function saveAgentProfile(agentId, values = {}) {
    const a = await findOne('agenti', `legacy_id = "${esc(agentId)}"`, 'id');
    if (!a) throw new Error('Agente non presente su PocketBase.');
    const body = {};
    if ('role' in values) body.ruolo = values.role;
    if ('name' in values) body.nome_completo = values.name;
    if ('qualifica' in values) body.grado = values.qualifica;
    if ('residence' in values) body.residenza = values.residence;
    await patch('agenti', a.id, body);
    return { agentId };
  }

  async function getWeekStatuses() {
    const rows = await list('stati_settimana', { fields: 'data_inizio,stato', perPage: 500 });
    return rows.map(r => ({ start: String(r.data_inizio || '').slice(0, 10), state: r.stato }));
  }

  async function saveWeekStatuses(statuses = []) {
    const wanted = (Array.isArray(statuses) ? statuses : []).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(String(s?.start || '').slice(0, 10)));
    for (const s of wanted) {
      const day = String(s.start).slice(0, 10);
      const state = String(s.state || 'ufficiale').toLowerCase();
      const existing = await findOne('stati_settimana', `data_inizio = "${day} 00:00:00.000Z"`, 'id,stato');
      if (existing) { if (existing.stato !== state) await patch('stati_settimana', existing.id, { stato: state }); }
      else await create('stati_settimana', { data_inizio: `${day} 00:00:00.000Z`, stato: state });
    }
    return wanted;
  }

  // ---------------------------------------------------------------------------
  // Cambi turno: cambi_turno.html chiama listChangeRequests/saveChangeRequest/
  // deleteChangeRequest con la stessa forma di firebase-data.js. `changes[]` di
  // Firebase e' multi (fino a 2 righe per uno scambio su giorni diversi): qui il
  // record PB tiene solo il primo elemento nei campi piatti e l'intero payload
  // originale in legacy_payload, cosi' la ricostruzione e' fedele in entrambi i
  // sensi (righe migrate E righe create da qui in poi).
  // ---------------------------------------------------------------------------
  const resolveAgente = legacyId => findOne('agenti', `legacy_id = "${esc(legacyId)}"`, 'id,legacy_id,nome_completo');

  function changeRequestFromRecord(r) {
    const payload = r.legacy_payload && typeof r.legacy_payload === 'object' && Object.keys(r.legacy_payload).length ? r.legacy_payload : null;
    if (payload && payload.id) return { ...payload, id: r.id };
    const date = String(r.data_richiedente || '').slice(0, 10);
    return {
      id: r.id,
      agentId: r.expand?.richiedente?.legacy_id || '',
      agentName: r.expand?.richiedente?.nome_completo || '',
      colleagueId: r.expand?.collega?.legacy_id || '',
      colleagueName: r.expand?.collega?.nome_completo || '',
      sentAt: r.inviata_il || r.created || '',
      changes: [{ date, from: r.turno_richiedente || '', to: r.turno_collega || '' }],
    };
  }

  async function listChangeRequests(agentId) {
    const id = String(agentId || '');
    const agente = id ? await resolveAgente(id) : null;
    let filter = 'stato != "cancelled"';
    if (agente) filter += ` && (richiedente = "${esc(agente.id)}" || collega = "${esc(agente.id)}")`;
    const rows = await list('cambi_turno', { filter, sort: '-inviata_il', expand: 'richiedente,collega', perPage: 500 });
    return rows.map(changeRequestFromRecord);
  }

  async function saveChangeRequest(payload = {}) {
    const richiedente = await resolveAgente(payload.agentId);
    if (!richiedente) throw new Error('Agente richiedente non trovato su PocketBase.');
    const collega = payload.colleagueId ? await resolveAgente(payload.colleagueId) : null;
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    const c0 = changes[0] || {};
    const legacyId = `REQ_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sentAt = payload.sentAt || new Date().toISOString();
    const legacyPayload = { id: legacyId, agentId: String(payload.agentId || ''), agentName: String(payload.agentName || ''), colleagueId: String(payload.colleagueId || ''), colleagueName: String(payload.colleagueName || ''), sentAt, changes };
    const rec = await create('cambi_turno', {
      legacy_id: legacyId, richiedente: richiedente.id, collega: collega ? collega.id : '',
      data_richiedente: c0.date ? `${c0.date} 00:00:00.000Z` : '', turno_richiedente: String(c0.from || ''), turno_collega: String(c0.to || ''),
      stato: 'pending', inviata_il: sentAt, legacy_payload: legacyPayload,
    });
    return changeRequestFromRecord({ ...rec, legacy_payload: legacyPayload });
  }

  // Il delete rule di PocketBase e' admin-only (come il fallback gia' previsto
  // in admin-firebase-rest.js quando manca il permesso su Firebase): qui non
  // proviamo nemmeno la DELETE diretta, annulliamo sempre con uno stato dedicato.
  async function deleteChangeRequest(requestId) {
    await patch('cambi_turno', String(requestId), { stato: 'cancelled', annullata_il: new Date().toISOString() });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Diaria ("distinta"): Firebase teneva un blob {entries:[...]} per agente;
  // PocketBase ha una riga per (agente, data). Qui dentro traduciamo nei due
  // sensi usando la stessa mappatura di firebase-pocketbase-sync/entities.js,
  // cosi' le righe gia' migrate e quelle scritte da qui restano coerenti. Il
  // calcolo (ore, straordinari) resta lato client: qui e' solo I/O.
  // ---------------------------------------------------------------------------
  const DIARIA_PCT = new Set(['0', '9', '12', '24', '40', '50']);

  function diariaRowFromEntry(agenteId, en) {
    const nn = x => Math.max(0, Math.round(Number(x) || 0));
    const ot = en.overtimeComponents || {};
    const rate = String(en.allowanceRate ?? '');
    const date = String(en.date || '').slice(0, 10);
    return {
      agente: agenteId, data: `${date} 00:00:00.000Z`, servizio: String(en.shift || ''),
      straordinario_ritardo_minuti: nn(en.delay), straordinario_cambio_minuti: nn(ot.cambi), straordinario_sentine_minuti: nn(ot.sentine),
      banca_ore_minuti: nn(en.bank), diaria_percentuale: DIARIA_PCT.has(rate) ? rate : '0',
      indennita_imbarco: !!en.embark, ticket_dovuto: !!en.mealUsed, ticket_usato: !!en.mealUsed,
      secondo_ticket: !!en.secondMeal, maneggio_denaro: !!en.cashHandling,
      trasferta_minuti: en.travel ? nn(en.travelMinutes) : 0, presenza: en.shift !== 'Riposo' && en.shift !== 'Assenza',
      rifornimento: !!en.refuel, parametro_139: !!en.param139,
      override_manuale: !!(en.manualModified || en.manualOverride),
      note: String(en.note || '').slice(0, 2000), legacy_payload: en,
    };
  }

  function diariaEntryFromRow(r) {
    if (r.legacy_payload && typeof r.legacy_payload === 'object' && Object.keys(r.legacy_payload).length) return r.legacy_payload;
    // Riga senza payload originale (creata da qui in poi): ricostruzione dai campi piatti.
    return {
      date: String(r.data || '').slice(0, 10), shift: r.servizio || '',
      delay: r.straordinario_ritardo_minuti || 0,
      overtimeComponents: { cambi: r.straordinario_cambio_minuti || 0, sentine: r.straordinario_sentine_minuti || 0 },
      bank: r.banca_ore_minuti || 0, allowanceRate: r.diaria_percentuale || '0',
      embark: !!r.indennita_imbarco, mealUsed: !!r.ticket_usato, secondMeal: !!r.secondo_ticket,
      cashHandling: !!r.maneggio_denaro, travel: Number(r.trasferta_minuti || 0) > 0, travelMinutes: r.trasferta_minuti || 0,
      refuel: !!r.rifornimento, param139: !!r.parametro_139, manualModified: !!r.override_manuale, note: r.note || '',
    };
  }

  async function loadDiaria(agentId) {
    const id = String(agentId || '').trim();
    if (!id) throw new Error('Agente non valido');
    const agente = await resolveAgente(id);
    if (!agente) return { agentId: id, entries: [], updatedAt: '', updatedBy: '', version: 1, entryCount: 0, checksum: '' };
    const rows = await list('diaria', { filter: `agente = "${esc(agente.id)}"`, sort: 'data', perPage: 2000 });
    const diariaEntries = rows.map(diariaEntryFromRow);
    return { agentId: id, entries: diariaEntries, updatedAt: '', updatedBy: '', version: 1, entryCount: diariaEntries.length, checksum: '' };
  }

  async function loadAllDiaria() {
    const agenti = await list('agenti', { fields: 'id,legacy_id', perPage: 2000 });
    const byId = new Map(agenti.map(a => [a.id, a.legacy_id]));
    const rows = await list('diaria', { sort: 'agente,data', perPage: 5000 });
    const byAgent = new Map();
    for (const r of rows) {
      const legacyId = byId.get(r.agente);
      if (!legacyId) continue;
      if (!byAgent.has(legacyId)) byAgent.set(legacyId, []);
      byAgent.get(legacyId).push(diariaEntryFromRow(r));
    }
    return [...byAgent.entries()].map(([agentId, diariaEntries]) => ({ agentId, entries: diariaEntries }));
  }

  // Stessa protezione anti-perdita-dati di admin-firebase-rest.js: se l'array in
  // arrivo ha MENO voci di quelle gia' salvate, unisce per data invece di
  // sostituire (evita di cancellare mesi interi per un bug/crash del client).
  async function saveDiaria(agentId, diariaEntries = []) {
    const id = String(agentId || '').trim();
    if (!id) throw new Error('Agente non valido');
    const agente = await resolveAgente(id);
    if (!agente) throw new Error('Agente non trovato su PocketBase.');
    const normalized = Array.isArray(diariaEntries) ? diariaEntries.filter(Boolean) : [];
    const existing = await list('diaria', { filter: `agente = "${esc(agente.id)}"`, sort: 'data', perPage: 2000 });
    // Protezione minima: un archivio del tutto vuoto quando prima c'erano righe
    // e' quasi certamente un bug/crash del client (es. entries non ancora
    // caricate), non una scelta deliberata — li' blocchiamo. L'eliminazione
    // di UNA giornata (bottone "Elimina" del popup) arriva qui con
    // `normalized` ancora pieno delle altre: e' una riconciliazione normale,
    // la riga rimossa va cancellata per davvero su PocketBase, non
    // "recuperata" al giro successivo (era il bug della versione precedente).
    if (existing.length && !normalized.length) throw new Error('Protezione attiva: non posso sostituire una diaria esistente con un archivio vuoto.');
    const byDayExisting = new Map(existing.map(r => [String(r.data || '').slice(0, 10), r]));
    const wantedDays = new Set();
    for (const en of normalized) {
      const day = String(en.date || '').slice(0, 10);
      if (!day) continue;
      wantedDays.add(day);
      const row = diariaRowFromEntry(agente.id, en);
      const current = byDayExisting.get(day);
      if (current) await patch('diaria', current.id, row); else await create('diaria', row);
    }
    for (const [day, row] of byDayExisting) {
      if (!wantedDays.has(day)) await remove('diaria', row.id);
    }
    return { agentId: id, entries: normalized, entryCount: normalized.length, checksum: '', version: 1, updatedAt: new Date().toISOString() };
  }

  window.NaviAdminPB = {
    ready: Promise.resolve(),
    authWithHash, getUserAuth, saveUserAuth, resetUserAuth, deleteRegisteredUser,
    listRegisteredUsers, saveAgentProfile, getWeekStatuses, saveWeekStatuses,
    listChangeRequests, saveChangeRequest, deleteChangeRequest,
    loadDiaria, loadAllDiaria, saveDiaria,
    list, findOne, create, patch, remove, req, provider: 'PocketBase',
  };
})();
