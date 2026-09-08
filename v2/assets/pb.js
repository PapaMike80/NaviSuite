(() => {
  const BASE_URL = 'https://truenas-scale.tail805e51.ts.net';
  const TOKEN_KEY = 'navisuite.v2.pb.token';
  const USER_KEY = 'navisuite.v2.pb.user';
  const AGENT_KEY = 'navisuite.v2.agent';
  const memoryStore = new Map();

  const getItem = key => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? memoryStore.get(key) || '' : stored;
    } catch (_) {
      return memoryStore.get(key) || '';
    }
  };
  const setItem = (key, value) => {
    const text = String(value);
    memoryStore.set(key, text);
    try { localStorage.setItem(key, text); } catch (_) {}
  };
  const removeItem = key => {
    memoryStore.delete(key);
    try { localStorage.removeItem(key); } catch (_) {}
  };
  const read = key => { try { return JSON.parse(getItem(key) || 'null'); } catch { return null; } };
  const token = () => String(getItem(TOKEN_KEY) || '');
  const user = () => read(USER_KEY);
  const agent = () => read(AGENT_KEY);
  const saveAuth = auth => {
    if (!auth?.token || !auth?.record) return;
    setItem(TOKEN_KEY, auth.token);
    setItem(USER_KEY, JSON.stringify(auth.record));
  };
  const clear = () => {
    removeItem(TOKEN_KEY);
    removeItem(USER_KEY);
    removeItem(AGENT_KEY);
  };
  const escapeFilter = value => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { Accept: 'application/json' };
    if (auth && token()) headers.Authorization = token();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${BASE_URL}${path}`, { method, headers, cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(payload?.message || `Errore PocketBase ${response.status}`); error.status = response.status; error.payload = payload; throw error; }
    return payload;
  }

  async function hashPin(pin) {
    if (!crypto?.subtle) throw new Error('Web Crypto non disponibile: apri NaviSuite V2 in HTTPS.');
    const bytes = new TextEncoder().encode(`NaviDiaria:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  async function loginWithPassword(loginId, password) {
    const auth = await request('/api/collections/users/auth-with-password', { method: 'POST', auth: false, body: { identity: String(loginId), password } });
    saveAuth(auth);
    const mine = await findOne('agenti', `legacy_id = "${escapeFilter(loginId)}"`, 'id,legacy_id,nome_completo,residenza,grado,ruolo,attivo,permessi_speciali');
    if (!mine) { clear(); throw new Error('Profilo agente PocketBase non trovato.'); }
    setItem(AGENT_KEY, JSON.stringify(mine));
    return { user: auth.record, agent: mine };
  }

  async function login(loginId, pin) {
    return loginWithPassword(loginId, await hashPin(pin));
  }

  async function loginWithPasswordHash(loginId, passwordHash) {
    const password = String(passwordHash || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Credenziale locale non disponibile. Accedi nuovamente a NaviSuite.');
    return loginWithPassword(loginId, password);
  }

  async function refresh() {
    if (!token()) return false;
    try { const auth = await request('/api/collections/users/auth-refresh', { method: 'POST' }); saveAuth(auth); return true; }
    catch { clear(); return false; }
  }

  async function list(collection, { page = 1, perPage = 500, filter = '', sort = '', fields = '', auth = true } = {}) {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (filter) params.set('filter', filter); if (sort) params.set('sort', sort); if (fields) params.set('fields', fields);
    return request(`/api/collections/${encodeURIComponent(collection)}/records?${params}`, { auth });
  }
  async function listAll(collection, options = {}) { const out=[]; for(let page=1;;page++){const result=await list(collection,{...options,page,perPage:Math.min(500,options.perPage||500)});out.push(...(result.items||[]));if(page>=Number(result.totalPages||1))break;} return out; }
  async function findOne(collection, filter, fields = '') { const result=await list(collection,{perPage:1,filter,fields}); return result.items?.[0]||null; }
  async function create(collection, body) { return request(`/api/collections/${encodeURIComponent(collection)}/records`, { method:'POST', body }); }
  async function update(collection, id, body) { return request(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method:'PATCH', body }); }
  async function remove(collection, id) { return request(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method:'DELETE' }); }

  async function loginDirectory() { return listAll('login_directory',{auth:false,filter:'attivo = true',sort:'nome_visualizzato',fields:'login_id,nome_visualizzato,residenza,attivo'}); }
  async function requireSession() {
    if (!token()) { location.replace('index.html'); return false; }
    if (!agent()) {
      const current=user(); if(!current?.login_id||!(await refresh())){location.replace('index.html');return false;}
      const mine=await findOne('agenti',`legacy_id = "${escapeFilter(user().login_id)}"`,'id,legacy_id,nome_completo,residenza,grado,ruolo,attivo,permessi_speciali');
      if(!mine){clear();location.replace('index.html');return false;} setItem(AGENT_KEY,JSON.stringify(mine));
    }
    return true;
  }

  window.NaviV2PB={url:BASE_URL,request,list,listAll,findOne,create,update,remove,loginDirectory,login,loginWithPasswordHash,refresh,requireSession,logout:clear,token,user,agent,escapeFilter};
})();
