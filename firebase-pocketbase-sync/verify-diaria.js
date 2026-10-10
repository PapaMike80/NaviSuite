'use strict';

// Confronto: PocketBase diaria  vs  Firebase private/adminUpdates/diaria/<agentId>.entries.
// SOLA LETTURA: nessuna scrittura/cancellazione. Per ogni agente elenca le
// giornate solo su PocketBase o con campi diversi da Firebase, e dice se in
// firebase_sync_runs ci sono giri recenti dell'entita' diaria.
//
//   node verify-diaria.js            # riepilogo + max 25 righe per sezione
//   node verify-diaria.js --full     # elenca tutto

const fs = require('fs');
const path = require('path');

(() => {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2].trim();
  }
})();

const FB_DB = process.env.FIREBASE_DB_URL.replace(/\/$/, '');
const FB_KEY = process.env.FIREBASE_API_KEY;
const PB = process.env.PB_URL.replace(/\/$/, '');
const FULL = process.argv.includes('--full');
const RUNS = 10;

const isoDay = v => (String(v || '').match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
const PCT = new Set(['0', '9', '12', '24', '40', '50']);
const nn = x => Math.max(0, Math.round(Number(x) || 0));

// Stessa mappatura di entities.js diaria(), limitata ai campi che il sync
// confronta (reconcileBy) piu' qualche campo in piu' per completezza.
function expected(en) {
  const ot = en.overtimeComponents || {};
  const rate = String(en.allowanceRate ?? '');
  return {
    servizio: String(en.shift || ''),
    straordinario_ritardo_minuti: nn(en.delay),
    straordinario_cambio_minuti: nn(ot.cambi),
    straordinario_sentine_minuti: nn(ot.sentine),
    banca_ore_minuti: nn(en.bank),
    diaria_percentuale: PCT.has(rate) ? rate : '0',
    indennita_imbarco: !!en.embark,
    ticket_dovuto: !!en.mealUsed,
    maneggio_denaro: !!en.cashHandling,
    override_manuale: !!(en.manualModified || en.manualOverride),
  };
}
const FIELDS = Object.keys(expected({}));

async function fbAuth() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}',
  });
  const d = await r.json();
  if (!d.idToken) throw new Error('Firebase auth fallita');
  return d.idToken;
}

async function pbAuth() {
  if (process.env.PB_SUPERUSER_TOKEN && !process.env.PB_SUPERUSER_PASSWORD) return process.env.PB_SUPERUSER_TOKEN;
  const r = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD }),
  });
  const d = await r.json();
  if (!d.token) throw new Error('PocketBase auth fallita: ' + (d.message || ''));
  return d.token;
}

async function pbList(tok, collection, query) {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${PB}/api/collections/${collection}/records?page=${page}&perPage=500&${query}`;
    const res = await (await fetch(url, { headers: { Authorization: tok } })).json();
    if (res.status && res.message) throw new Error(`${collection}: ${res.message}`);
    out.push(...(res.items || []));
    if (page >= Number(res.totalPages || 1)) break;
  }
  return out;
}

(async () => {
  const fbTok = await fbAuth();
  const all = (await (await fetch(`${FB_DB}/private/adminUpdates/diaria.json?auth=${fbTok}`)).json()) || {};

  // --- Firebase: "agente\tdata" -> campi attesi ---
  const fb = new Map();
  for (const [agentId, blob] of Object.entries(all)) {
    const id = String(blob?.agentId || agentId);
    for (const en of blob?.entries || []) {
      const day = isoDay(en?.date);
      if (day) fb.set(`${id}\t${day}`, expected(en));
    }
  }
  console.log('Firebase: giornate diaria =', fb.size, `(agenti: ${Object.keys(all).length})`);

  // --- PocketBase: diaria con legacy_id dell'agente ---
  const pbTok = await pbAuth();
  const rows = await pbList(pbTok, 'diaria', `fields=data,${FIELDS.join(',')},expand.agente.legacy_id&expand=agente`);
  const pb = new Map();
  let noAgent = 0;
  for (const r of rows) {
    const id = r.expand?.agente?.legacy_id;
    if (!id) { noAgent++; continue; }
    pb.set(`${id}\t${isoDay(r.data)}`, r);
  }
  console.log('PocketBase: diaria =', pb.size, noAgent ? `(+${noAgent} senza relazione agente)` : '');

  // --- diff ---
  const onlyFb = [];
  const onlyPb = [];
  const mismatch = []; // [key, [{campo, fb, pb}]]
  let equal = 0;
  for (const [k, exp] of fb) {
    const row = pb.get(k);
    if (!row) { onlyFb.push(k); continue; }
    const diffs = FIELDS
      .filter(f => String(row[f] ?? '') !== String(exp[f] ?? ''))
      .map(f => ({ campo: f, fb: exp[f], pb: row[f] }));
    if (diffs.length) mismatch.push([k, diffs]); else equal++;
  }
  for (const k of pb.keys()) if (!fb.has(k)) onlyPb.push(k);

  console.log('\n=== RISULTATO ===');
  console.log('  uguali            ', equal);
  console.log('  campi diversi     ', mismatch.length);
  console.log('  solo su PocketBase', onlyPb.length);
  console.log('  solo su Firebase  ', onlyFb.length, '(informativo)');

  // Raggruppa per agente: richiesta = solo-PB e diverse.
  const byAgent = new Map();
  const bucket = id => {
    if (!byAgent.has(id)) byAgent.set(id, { onlyPb: [], diff: [] });
    return byAgent.get(id);
  };
  for (const k of onlyPb) { const [id, d] = k.split('\t'); bucket(id).onlyPb.push(d); }
  for (const [k, diffs] of mismatch) { const [id, d] = k.split('\t'); bucket(id).diff.push([d, diffs]); }

  const limit = FULL ? Infinity : 25;
  let printed = 0;
  for (const [id, g] of [...byAgent].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    console.log(`\n--- agente legacy_id=${id}  (solo PB: ${g.onlyPb.length}, diverse: ${g.diff.length}) ---`);
    for (const d of g.onlyPb.sort()) {
      if (printed++ >= limit) break;
      console.log(`  ${d}  SOLO PB  servizio=${pb.get(`${id}\t${d}`).servizio}`);
    }
    for (const [d, diffs] of g.diff.sort((a, b) => a[0].localeCompare(b[0]))) {
      if (printed++ >= limit) break;
      console.log(`  ${d}  DIVERSA  ` + diffs.map(x => `${x.campo}: FB=${JSON.stringify(x.fb)} PB=${JSON.stringify(x.pb)}`).join('; '));
    }
  }
  if (!FULL && printed > limit) console.log(`\n(output troncato a ${limit} righe, usa --full)`);

  // --- firebase_sync_runs: giri recenti con entita' diaria ---
  console.log('\n=== firebase_sync_runs (ultimi ' + RUNS + ') ===');
  try {
    const res = await (await fetch(
      `${PB}/api/collections/firebase_sync_runs/records?page=1&perPage=${RUNS}&sort=-imported_at`,
      { headers: { Authorization: pbTok } })).json();
    if (res.status && res.message) throw new Error(res.message);
    const runs = res.items || [];
    if (!runs.length) console.log('  nessun giro registrato');
    let withDiaria = 0;
    for (const r of runs) {
      const s = r.summary?.diaria;
      if (s) withDiaria++;
      console.log(`  ${r.imported_at}  stato=${r.stato}  diaria=${s ? JSON.stringify(s) : '(assente)'}`);
    }
    console.log(`  -> ${withDiaria}/${runs.length} giri recenti contengono l'entita' diaria`);
  } catch (e) {
    console.log('  non leggibile:', e.message);
  }

  const clean = !mismatch.length && !onlyPb.length;
  console.log('\n' + (clean ? 'OK: nessuna giornata solo-PB o divergente.' : 'DIVERGENZE presenti.'));
  process.exit(clean ? 0 : 1);
})().catch(e => { console.error('ERRORE:', e.message); process.exit(2); });
