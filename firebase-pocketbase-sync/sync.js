'use strict';

// Mirror incrementale Firebase RTDB -> PocketBase per NaviSuite.
// Firebase resta la sorgente autoritativa: questo processo copia in sola
// scrittura verso PocketBase (upsert idempotente per chiave stabile) e tiene
// traccia di cosa ha gia' visto in firebase_sync_state / firebase_sync_runs.
//
// Gira sul TrueNAS, a fianco di ponteradio-worker (PocketBase non e' pubblico).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ENTITIES: ENTITY_MAP } = require('./entities');

// .env accanto a sync.js (facoltativo, non nel repo). Nessuna dipendenza.
(() => {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
})();

const cfg = {
  fbDbUrl: reqEnv('FIREBASE_DB_URL').replace(/\/$/, ''),
  fbApiKey: reqEnv('FIREBASE_API_KEY'),
  pbUrl: reqEnv('PB_URL').replace(/\/$/, ''),
  // In produzione: email + password (il token si rinnova da solo).
  // Per un test/backfill una-tantum si puo' passare PB_SUPERUSER_TOKEN.
  pbEmail: process.env.PB_SUPERUSER_EMAIL || '',
  pbPassword: process.env.PB_SUPERUSER_PASSWORD || '',
  pbToken: process.env.PB_SUPERUSER_TOKEN || '',
  intervalMs: Math.max(60000, Number(process.env.SYNC_INTERVAL_MS || 900000)),
  once: /^(1|true|yes)$/i.test(String(process.env.SYNC_ONCE || '')),
  only: String(process.env.ENTITIES || '').split(',').map(s => s.trim()).filter(Boolean),
};

function reqEnv(key) {
  const value = process.env[key];
  if (!value) { console.error(`[sync] variabile d'ambiente mancante: ${key}`); process.exit(1); }
  return value;
}

const log = (...a) => console.log(new Date().toISOString(), '[sync]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

// ---------------------------------------------------------------------------
// Firebase: sign-in anonimo (idToken ~1h) + lettura REST.
// ---------------------------------------------------------------------------
let fbToken = null;
let fbTokenExp = 0;

async function fbAuth() {
  if (fbToken && Date.now() < fbTokenExp - 60000) return fbToken;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.fbApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) throw new Error(`Firebase auth ${res.status}: ${data.error?.message || 'no idToken'}`);
  fbToken = data.idToken;
  fbTokenExp = Date.now() + Number(data.expiresIn || 3600) * 1000;
  return fbToken;
}

async function fbGet(path) {
  const token = await fbAuth();
  const clean = String(path).replace(/^\/+|\/+$/g, '');
  const res = await fetch(`${cfg.fbDbUrl}/${clean}.json?auth=${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Firebase GET ${clean} -> ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// PocketBase: auth superuser + REST.
// ---------------------------------------------------------------------------
let pbToken = null;
let pbTokenAt = 0;

async function pbAuth() {
  if (pbToken && Date.now() - pbTokenAt < 30 * 60 * 1000) return pbToken;
  if (cfg.pbToken && !(cfg.pbEmail && cfg.pbPassword)) {
    pbToken = cfg.pbToken;
    pbTokenAt = Date.now();
    return pbToken;
  }
  if (!cfg.pbEmail || !cfg.pbPassword) {
    console.error('[sync] serve PB_SUPERUSER_EMAIL + PB_SUPERUSER_PASSWORD (o PB_SUPERUSER_TOKEN)');
    process.exit(1);
  }
  const res = await fetch(`${cfg.pbUrl}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: cfg.pbEmail, password: cfg.pbPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(`PocketBase auth ${res.status}: ${data.message || 'no token'}`);
  pbToken = data.token;
  pbTokenAt = Date.now();
  return pbToken;
}

async function pb(method, path, body) {
  const token = await pbAuth();
  const res = await fetch(`${cfg.pbUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`PocketBase ${method} ${path} -> ${res.status}: ${data.message || ''}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const filt = value => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');

async function pbListAll(collection, { filter = '', sort = '', fields = '' } = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ page: String(page), perPage: '500', skipTotal: 'false' });
    if (filter) params.set('filter', filter);
    if (sort) params.set('sort', sort);
    if (fields) params.set('fields', fields);
    const res = await pb('GET', `/api/collections/${encodeURIComponent(collection)}/records?${params}`);
    out.push(...(res.items || []));
    if (page >= Number(res.totalPages || 1)) break;
  }
  return out;
}

async function pbFindBy(collection, filter, fields = '') {
  const params = new URLSearchParams({ page: '1', perPage: '1', filter });
  if (fields) params.set('fields', fields);
  const res = await pb('GET', `/api/collections/${encodeURIComponent(collection)}/records?${params}`);
  return (res.items || [])[0] || null;
}

const pbFindByLegacy = (collection, legacyId, fields = '') =>
  pbFindBy(collection, `legacy_id = "${filt(legacyId)}"`, fields);

async function pbCreate(collection, data) {
  return pb('POST', `/api/collections/${encodeURIComponent(collection)}/records`, data);
}
async function pbUpdate(collection, id, data) {
  return pb('PATCH', `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, data);
}
async function pbDelete(collection, id) {
  return pb('DELETE', `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`);
}

// Upsert generico: `match` individua l'eventuale record esistente, `desired` e'
// il payload voluto. Ritorna 'created' | 'updated' | 'unchanged'.
async function upsert(collection, { match, desired, compareKeys }) {
  const existing = typeof match === 'function' ? await match() : match;
  if (!existing) {
    await pbCreate(collection, desired);
    return 'created';
  }
  const keys = compareKeys || Object.keys(desired);
  const changed = keys.some(k => JSON.stringify(existing[k] ?? null) !== JSON.stringify(desired[k] ?? null));
  if (!changed) return 'unchanged';
  await pbUpdate(collection, existing.id, desired);
  return 'updated';
}

// ---------------------------------------------------------------------------
// Bookkeeping: firebase_sync_runs + firebase_sync_state.
// ---------------------------------------------------------------------------
async function startRun() {
  const snapshotId = `sync-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const rec = await pbCreate('firebase_sync_runs', {
    snapshot_id: snapshotId,
    source_mode: 'delta_export',
    stato: 'importato',
    imported_at: new Date().toISOString(),
    records_seen: 0, records_created: 0, records_updated: 0, records_unchanged: 0, records_deleted: 0,
    summary: {},
  }).catch(err => { log('firebase_sync_runs non scrivibile:', err.message); return null; });
  return rec;
}

async function finishRun(rec, totals, summary, ok) {
  if (!rec) return;
  await pbUpdate('firebase_sync_runs', rec.id, {
    stato: ok ? 'importato' : 'parziale',
    records_seen: totals.seen, records_created: totals.created,
    records_updated: totals.updated, records_unchanged: totals.unchanged, records_deleted: totals.deleted,
    summary,
  }).catch(err => log('finishRun:', err.message));
}

async function markState(entityType, entityKey, contentHash, sourcePath) {
  const now = new Date().toISOString();
  const existing = await pbFindBy('firebase_sync_state',
    `entity_type = "${filt(entityType)}" && entity_key = "${filt(entityKey)}"`).catch(() => null);
  const body = {
    entity_type: entityType, entity_key: entityKey, content_hash: contentHash,
    source_path: sourcePath || '', last_seen_at: now, last_imported_at: now, deleted_in_source: false,
  };
  try {
    if (existing) {
      if (existing.content_hash === contentHash) {
        await pbUpdate('firebase_sync_state', existing.id, { last_seen_at: now });
        return false; // invariato
      }
      await pbUpdate('firebase_sync_state', existing.id, body);
    } else {
      await pbCreate('firebase_sync_state', { ...body, first_seen_at: now });
    }
  } catch (err) {
    log('firebase_sync_state non scrivibile:', err.message);
  }
  return true; // cambiato
}

// ---------------------------------------------------------------------------
// Giro di sync.
// ---------------------------------------------------------------------------
async function runOnce() {
  const names = cfg.only.length ? cfg.only : Object.keys(ENTITY_MAP);
  log('avvio giro:', names.join(', '));
  const run = await startRun();
  const totals = { seen: 0, created: 0, updated: 0, unchanged: 0, deleted: 0 };
  const summary = {};
  let ok = true;

  const ctx = {
    fbGet, pb, pbListAll, pbFindBy, pbFindByLegacy, pbCreate, pbUpdate, pbDelete,
    upsert, markState, hash, filt, log,
  };

  for (const name of names) {
    const fn = ENTITY_MAP[name];
    if (!fn) { log(`entita' sconosciuta, salto: ${name}`); continue; }
    try {
      const stats = await fn(ctx) || {};
      for (const k of Object.keys(totals)) totals[k] += Number(stats[k] || 0);
      summary[name] = stats;
      log(`  ${name}:`, JSON.stringify(stats));
    } catch (err) {
      ok = false;
      summary[name] = { error: err.message };
      log(`  ${name} ERRORE:`, err.message);
    }
  }

  await finishRun(run, totals, summary, ok);
  log('giro completato:', JSON.stringify(totals), ok ? 'OK' : 'CON ERRORI');
  return ok;
}

// ---------------------------------------------------------------------------
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

(async () => {
  log(`avvio. Firebase=${cfg.fbDbUrl} PocketBase=${cfg.pbUrl} intervallo=${cfg.intervalMs}ms once=${cfg.once}`);
  do {
    try { await runOnce(); }
    catch (err) { log('giro fallito:', err.message); }
    if (cfg.once || stopping) break;
    for (let waited = 0; waited < cfg.intervalMs && !stopping; waited += 1000) await sleep(1000);
  } while (!stopping);
  log('uscita.');
})();
