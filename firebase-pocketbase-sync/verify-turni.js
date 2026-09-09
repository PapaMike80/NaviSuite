'use strict';

// Confronto: PocketBase turni_effective  vs  Firebase effectiveSchedule.
// Nessuna scrittura. Stampa quante coppie (agente, data) combaciano, quante
// divergono e un campione delle differenze.
//
//   node verify-turni.js            # riepilogo
//   node verify-turni.js --full     # elenca TUTTE le differenze

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

const isoDay = v => (String(v || '').match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
// Stessa normalizzazione di shared-data.js normalizedImportedShift().
const norm = v => {
  const raw = String(v ?? '').trim().toUpperCase().replace(/[‐‑–—]/g, '-');
  if (!raw || /^(?:RIP(?:\.|-*)?|RIPOSO|-{2,}|={2,})$/.test(raw)) return 'RIP';
  if (/^(?:CONG?\.?|CON;|CONC\.?|C\.)$/.test(raw)) return 'CON';
  if (/^(?:LAV\.?|TERRA)$/.test(raw)) return 'TERRA';
  if (/^F\.?P\.?-*$/.test(raw)) return 'F.P.';
  return raw.replace(/\.{2,}$/g, '.').replace(/-+$/g, '');
};

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

(async () => {
  const fbTok = await fbAuth();
  const es = await (await fetch(`${FB_DB}/private/adminUpdates/effectiveSchedule.json?auth=${fbTok}`)).json();
  console.log('Firebase effectiveSchedule.meta.updatedAt =', es.meta?.updatedAt);

  // --- Firebase: mappa "id\tdata" -> servizio ---
  const fb = new Map();
  const nameById = new Map();
  for (const list of Object.values(es.data?.residenze || {})) {
    for (const ag of list || []) {
      const id = String(ag.id || '');
      if (!id) continue;
      nameById.set(id, String(ag.agente || '').trim().toUpperCase());
      for (const [date, srv] of Object.entries(ag.turni || {})) fb.set(`${id}\t${isoDay(date)}`, norm(srv));
    }
  }
  // Le bariste hanno il turno nell'array bariste[], non nella mappa turni.
  const baristeByName = new Map(); // "NOME\tdata" -> corsa
  for (const b of es.data?.bariste || []) {
    if (!b || b.attiva === false) continue;
    const n = String(b.barista || b.agente || b.nome || '').trim().toUpperCase();
    if (n) baristeByName.set(`${n}\t${isoDay(b.data)}`, norm(b.corsa));
  }
  for (const [id, name] of nameById) {
    if (!id.startsWith('BARISTA_')) continue;
    for (const [key, corsa] of baristeByName) {
      const [bn, date] = key.split('\t');
      if (bn === name || bn === id.replace('BARISTA_', '')) fb.set(`${id}\t${date}`, corsa);
    }
  }
  console.log('Firebase: coppie (agente, data) =', fb.size, `(di cui ${baristeByName.size} turni bariste da bariste[])`);

  // --- PocketBase: turni_effective con legacy_id dell'agente ---
  const pbTok = await pbAuth();
  const pb = new Map();
  let missingAgentRel = 0;
  for (let page = 1; ; page++) {
    const url = `${PB}/api/collections/turni_effective/records?page=${page}&perPage=500`
      + `&fields=data,servizio,expand.agente.legacy_id&expand=agente`;
    const res = await (await fetch(url, { headers: { Authorization: pbTok } })).json();
    for (const r of res.items || []) {
      const id = r.expand?.agente?.legacy_id;
      if (!id) { missingAgentRel++; continue; }
      pb.set(`${id}\t${isoDay(r.data)}`, norm(r.servizio));
    }
    if (page >= Number(res.totalPages || 1)) break;
  }
  console.log('PocketBase: turni_effective =', pb.size, missingAgentRel ? `(+${missingAgentRel} senza relazione agente)` : '');

  // --- diff ---
  const onlyFb = [], onlyPb = [], mismatch = [];
  for (const [k, v] of fb) {
    if (!pb.has(k)) onlyFb.push(k);
    else if (pb.get(k) !== v) mismatch.push([k, v, pb.get(k)]);
  }
  for (const k of pb.keys()) if (!fb.has(k)) onlyPb.push(k);

  const equal = fb.size - onlyFb.length - mismatch.length;
  console.log('\n=== RISULTATO ===');
  console.log('  uguali            ', equal);
  console.log('  valore diverso    ', mismatch.length);
  console.log('  solo su Firebase  ', onlyFb.length);
  console.log('  solo su PocketBase', onlyPb.length);

  const show = FULL ? Infinity : 25;
  if (mismatch.length) {
    console.log(`\n--- valore diverso (${Math.min(show, mismatch.length)}/${mismatch.length}) [agente  data  FB -> PB] ---`);
    for (const [k, a, b] of mismatch.slice(0, show)) console.log(`  ${k.replace('\t', '  ')}   ${a} -> ${b}`);
  }
  if (onlyFb.length) {
    console.log(`\n--- solo su Firebase (${Math.min(show, onlyFb.length)}/${onlyFb.length}) ---`);
    for (const k of onlyFb.slice(0, show)) console.log(`  ${k.replace('\t', '  ')}   = ${fb.get(k)}`);
  }
  if (onlyPb.length) {
    console.log(`\n--- solo su PocketBase (${Math.min(show, onlyPb.length)}/${onlyPb.length}) ---`);
    for (const k of onlyPb.slice(0, show)) console.log(`  ${k.replace('\t', '  ')}   = ${pb.get(k)}`);
  }

  const clean = !mismatch.length && !onlyFb.length && !onlyPb.length;
  console.log('\n' + (clean ? 'OK: PocketBase e Firebase hanno gli stessi turni.'
    : 'DIVERGENZE (atteso: PB e\' fermo al freeze, Firebase e\' avanzato).'));
  process.exit(clean ? 0 : 1);
})().catch(e => { console.error('ERRORE:', e.message); process.exit(2); });
