'use strict';
// NaviSuite · avvisi a telefono bloccato: arrivo delle navi (chi e' a terra) e prossimo scalo (chi e' a bordo),
// 10 minuti prima. Ogni minuto calcola gli avvisi con gli stessi file dell'app (scaricati da GitHub Pages) e li
// mette nella coda private/adminUpdates/pushQueue: li spedisce il push-worker gia' attivo su TrueNAS.
// Nessuna chiave VAPID qui: serve solo l'accesso a Firebase (lo stesso anonimo dell'app).
const vm = require('vm');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SITE = (process.env.NAVISUITE_URL || 'https://papamike80.github.io/NaviSuite').replace(/\/$/, '');
const DB = (process.env.FIREBASE_DB || 'https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app').replace(/\/$/, '');
const API_KEY = process.env.FIREBASE_API_KEY || '';
const DRY_RUN = /^(1|true|si|yes)$/i.test(process.env.DRY_RUN || '');
const SCRIPTS = ['assets/js/shared-roles.js', 'assets/js/shared-data.js', 'assets/js/course-info.js', 'assets/js/orario-corse.js',
  'assets/js/servizi-terra-a4.js', 'assets/js/turni-giorno.js', 'assets/js/orario-giorno.js', 'assets/js/push-summary.js', 'assets/js/push-arrivi.js',
  'assets/js/shift-competence.js', 'assets/js/diaria-backup.js'];
const log = (...a) => console.log(new Date().toISOString(), '[arrivi]', ...a);

// --- Firebase (accesso anonimo come l'app) ---
let token = '', tokenExp = 0, apiKey = API_KEY;
async function auth() {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
  const j = await r.json();
  if (!j.idToken) throw new Error('Accesso Firebase non riuscito: ' + JSON.stringify(j.error || j));
  token = j.idToken; tokenExp = Date.now() + 50 * 60 * 1000;
  return token;
}
async function fb(p, options = {}) {
  const r = await fetch(`${DB}/${p}.json?auth=${await auth()}`, options);
  if (!r.ok) throw new Error(`Firebase ${p}: HTTP ${r.status}`);
  return r.json();
}

// --- codice dell'app (ricaricato ogni 30 minuti, cosi' segue gli aggiornamenti) ---
let ctx = null, ctxAt = 0;
async function source(file) {
  if (process.env.NAVISUITE_DIR) return fs.readFileSync(path.join(process.env.NAVISUITE_DIR, file), 'utf8');
  const r = await fetch(`${SITE}/${file}?t=${Date.now()}`);
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  return r.text();
}
async function app() {
  if (ctx && Date.now() - ctxAt < 30 * 60 * 1000) return ctx;
  const store = new Map();
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval: () => 0, fetch, URL, URLSearchParams, TextEncoder,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { pathname: '/worker', search: '', href: 'https://worker/' },
    document: { addEventListener() {}, querySelector: () => null, getElementById: () => null, createElement: () => ({ style: {} }) },
    addEventListener() {}, dispatchEvent() {}, CustomEvent: class {}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const file of SCRIPTS) vm.runInContext(await source(file), sandbox, { filename: file });
  if (!apiKey) apiKey = ((await source('assets/js/admin-firebase-rest.js')).match(/AIza[0-9A-Za-z_-]{35}/) || [])[0] || '';
  ctx = sandbox; ctxAt = Date.now();
  log('codice dell\'app caricato');
  return ctx;
}

// --- dati: turni (public/schedule) + aggiornamenti, come l'app ---
let dati = null, datiAt = 0;
async function data(w) {
  if (dati && Date.now() - datiAt < 2 * 60 * 1000) return dati;
  const base = await fb('public/schedule');
  const names = ['scheduleImports', 'agentProfiles', 'odsVariations', 'manualVariations', 'turniNavi', 'pontiliCorse', 'pushSubscriptions'];
  const parts = await Promise.all(names.map(n => fb(`private/adminUpdates/${n}`).catch(() => null)));
  const u = Object.fromEntries(names.map((n, i) => [n, parts[i]]));
  const asArray = v => Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {}).filter(Boolean);
  // gli aggiornamenti sono salvati come {items: [...]} o come lista
  const items = v => asArray(v?.items ?? v?.rows ?? v);
  const updates = { scheduleImports: items(u.scheduleImports), agentProfiles: u.agentProfiles || {}, odsVariations: items(u.odsVariations),
    manualVariations: items(u.manualVariations), turniNavi: items(u.turniNavi) };
  const effective = w.NaviPushSummary.effectiveData(base, updates, w.NaviSharedData);
  dati = { effective, pontili: u.pontiliCorse?.DESENZANO || {}, subs: u.pushSubscriptions || {} };
  datiAt = Date.now();
  return dati;
}

const romeDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
const romeMinutes = () => { const [h, m] = new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false }).split(':').map(Number); return h * 60 + m; };
const safe = v => String(v).replace(/[.#$\[\]\/]/g, '_');

async function giro() {
  const w = await app();
  const { effective, pontili, subs } = await data(w);
  const oggi = romeDay(), ora = romeMinutes();
  let messi = 0;
  for (const [agentKey, devices] of Object.entries(subs)) {
    for (const sub of Object.values(devices || {})) {
      if (!sub || sub.enabled === false || sub.preferences?.arrivals === false) continue;
      const agentId = String(sub.agentId || agentKey);
      let lista = [];
      try { lista = w.NaviPushArrivi.notifiche(effective, agentId, oggi, { pontili, agentName: sub.agentName || '' }); }
      catch (e) { log('errore calcolo', agentId, e.message); continue; }
      for (const n of w.NaviPushArrivi.dovute(lista, ora)) {
        const id = safe(`ARR_${agentId}_${sub.deviceId}_${n.tag}`).slice(0, 700);
        if (await fb(`private/adminUpdates/pushQueue/${id}`)) continue; // gia' messo (anche dopo un riavvio)
        const item = { id, status: 'pending', kind: n.scalo ? 'prossimo-scalo' : 'arrivo', requestedByAgentId: 'system', requestedByName: 'NaviSuite arrivi',
          targetAgentId: agentId, targetDeviceId: String(sub.deviceId || ''), title: n.title, body: n.body, url: n.url,
          meta: { automatic: true, date: oggi, code: n.code, run: String(n.run || ''), tag: n.tag }, createdAt: new Date().toISOString() };
        if (DRY_RUN) log('[prova]', agentId, '→', n.title, '|', n.body.replace(/\n/g, ' / '));
        else await fb(`private/adminUpdates/pushQueue/${id}`, { method: 'PUT', body: JSON.stringify(item) });
        messi++;
      }
    }
  }
  if (messi) log(`${messi} avvisi in coda`);
  await widget(w, effective, pontili, oggi, ora);
}

// Widget (Scriptable su iPhone): per ogni agente i prossimi eventi di oggi (fino a 15) (arrivo della nave a terra, prossimo
// scalo a bordo) in private/adminUpdates/widget/<agente>. Si scrive solo quando cambia.
const widgetScritti = new Map();
async function widget(w, effective, pontili, oggi, ora) {
  const G = w.NaviTurniGiorno;
  const agenti = new Map();
  Object.entries(effective.residenze || {}).forEach(([res, list]) => {
    if (/^(uffici|bariste)$/i.test(res)) return;
    (list || []).forEach(a => { if (a?.id && !agenti.has(String(a.id))) agenti.set(String(a.id), a); });
  });
  let scritti = 0;
  for (const [id, a] of agenti) {
    let lista = [], turno = '';
    try {
      turno = G.turnoAgente(effective, { id, name: a.agente || '' }, oggi)?.turno || '';
      lista = w.NaviPushArrivi.notifiche(effective, id, oggi, { pontili, agentName: a.agente || '' });
    } catch (e) { continue; }
    const m = t => { const [h, mi] = String(t).split('.').map(Number); return h * 60 + mi; };
    const prossimi = lista.filter(n => m(n.time) >= ora - 1).slice(0, 15)
      .map(n => ({ ora: n.time, titolo: n.title, testo: n.body, codice: n.code, scalo: n.scalo || '', pontile: n.pontile || '' }));
    const valore = { data: oggi, turno, nome: a.agente || '', prossimi };
    const chiave = JSON.stringify(valore);
    if (widgetScritti.get(id) === chiave) continue;
    if (!DRY_RUN) await fb(`private/adminUpdates/widget/${safe(id)}`, { method: 'PUT', body: JSON.stringify({ ...valore, aggiornato: new Date().toISOString() }) });
    widgetScritti.set(id, chiave);
    scritti++;
  }
  if (scritti) log(`widget aggiornati: ${scritti}`);
  // Elenco nomi -> numero, per scrivere nel widget il cognome invece del numero: "PEDRONI M" e "PEDRONI" (se unico).
  const norm = v => String(v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nomi = {};
  for (const [id, a] of agenti) {
    const pieno = norm(a.agente), cognome = pieno.split(' ')[0];
    if (pieno) nomi[pieno.replace(/ /g, '_')] = id;
    if (cognome) nomi[cognome] = nomi[cognome] && nomi[cognome] !== id ? 'PIU' : id;
  }
  const chiaveNomi = JSON.stringify(nomi);
  if (widgetScritti.get('__nomi') !== chiaveNomi) {
    if (!DRY_RUN) await fb('private/adminUpdates/widgetNomi', { method: 'PUT', body: chiaveNomi });
    widgetScritti.set('__nomi', chiaveNomi);
  }
}

// Backup notturno: ogni giorno dopo le 2 una copia completa in BACKUP_DIR (JSON per ripristinare + CSV delle distinte),
// tenendo gli ultimi BACKUP_GIORNI giorni.
const BACKUP_DIR = process.env.BACKUP_DIR || '/backup';
const BACKUP_GIORNI = Math.max(1, Number(process.env.BACKUP_GIORNI || 60));
async function backupNotturno(w, forza = false) {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const oggi = romeDay();
  if (!forza && (romeMinutes() < 120 || fs.existsSync(path.join(BACKUP_DIR, `NaviSuite-backup-${oggi}.json`)))) return;
  const chiavi = ['diaria', 'diariaConversioni', 'agentProfiles', 'pageAccess', 'scheduleImports', 'odsVariations', 'manualVariations',
    'turniNavi', 'approvazioniTurni', 'userRegistry', 'userAuth', 'baristas', 'pontiliCorse'];
  const parti = await Promise.all(chiavi.map(k => fb(`private/adminUpdates/${k}`).catch(() => null)));
  const adminUpdates = Object.fromEntries(chiavi.map((k, i) => [k, parti[i]]));
  const schedule = await fb('public/schedule').catch(() => null);
  const json = JSON.stringify({ tipo: 'navisuite-backup-centrale', versione: 1, creato: new Date().toISOString(), adminUpdates, schedule });
  fs.writeFileSync(path.join(BACKUP_DIR, `NaviSuite-backup-${oggi}.json`), json);
  const nomi = new Map();
  Object.values(schedule?.residenze || {}).forEach(l => (l || []).forEach(a => { if (a?.id) nomi.set(String(a.id), a.agente || ''); if (a?.agent_uid) nomi.set(String(a.agent_uid), a.agente || ''); }));
  Object.values(adminUpdates.userRegistry || {}).forEach(u => u?.id && u.name && !nomi.has(String(u.id)) && nomi.set(String(u.id), u.name));
  Object.values(adminUpdates.agentProfiles || {}).forEach(p => p?.id && p.name && !nomi.has(String(p.id)) && nomi.set(String(p.id), p.name));
  const agenti = Object.entries(adminUpdates.diaria || {}).map(([id, r]) => ({ id: String(r?.agentId || id), nome: nomi.get(String(r?.agentId || id)) || String(r?.agentId || id).replace(/^AG_/, '').replace(/_([A-Z])$/, ' $1.').replace(/_/g, ' '),
    entries: Array.isArray(r?.entries) ? r.entries.filter(Boolean) : [], conversioni: adminUpdates.diariaConversioni?.[id]?.map || {} }))
    .filter(a => a.entries.length).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  fs.writeFileSync(path.join(BACKUP_DIR, `NaviSuite-backup-${oggi}-distinte.csv`), w.NaviDiariaBackup.csv(agenti));
  // i piu' vecchi di BACKUP_GIORNI giorni
  const limite = new Date(Date.now() - BACKUP_GIORNI * 864e5).toISOString().slice(0, 10);
  fs.readdirSync(BACKUP_DIR).filter(f => /^NaviSuite-backup-\d{4}-\d{2}-\d{2}/.test(f) && f.slice(17, 27) < limite).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  log(`backup salvato: ${agenti.length} distinte, ${(json.length / 1048576).toFixed(1)} MB`);
  try { backupCodice(oggi); } catch (e) { log('copia del codice non riuscita:', e.message); }
}

// Copia del codice dell'app (repository GitHub con tutta la storia) in BACKUP_DIR/codice: NaviSuite.git si aggiorna
// ogni notte, e un .zip del sito pronto da pubblicare (ultimi 14 giorni). Se GitHub sparisse l'app resta qui.
const REPO = process.env.REPO_URL || 'https://github.com/PapaMike80/NaviSuite.git';
function backupCodice(oggi) {
  const dir = path.join(BACKUP_DIR, 'codice'), mirror = path.join(dir, 'NaviSuite.git');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(mirror)) execFileSync('git', ['--git-dir', mirror, 'remote', 'update', '--prune'], { stdio: 'ignore', timeout: 300000 });
  else execFileSync('git', ['clone', '--mirror', REPO, mirror], { stdio: 'ignore', timeout: 600000 });
  execFileSync('git', ['--git-dir', mirror, 'archive', '--format=zip', '-o', path.join(dir, `NaviSuite-sito-${oggi}.zip`), 'main'], { timeout: 300000 });
  const limite = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  fs.readdirSync(dir).filter(f => /^NaviSuite-sito-\d{4}-\d{2}-\d{2}\.zip$/.test(f) && f.slice(15, 25) < limite).forEach(f => fs.unlinkSync(path.join(dir, f)));
  log('copia del codice aggiornata');
}

async function main() {
  log(`avvio${DRY_RUN ? ' (prova: non mette niente in coda)' : ''} · sito ${SITE}`);
  if (process.argv.includes('--backup')) {
    // backup subito: node worker.js --backup
    const w = await app(); fs.mkdirSync(BACKUP_DIR, { recursive: true });
    await backupNotturno(w, true); return;
  }
  if (process.argv.includes('--elenco')) {
    // stampa gli avvisi di oggi per un agente: node worker.js --elenco <id>
    const w = await app(); const { effective, pontili } = await data(w);
    const id = process.argv[process.argv.indexOf('--elenco') + 1];
    for (const n of w.NaviPushArrivi.notifiche(effective, id, romeDay(), { pontili })) console.log(n.quando, '·', n.title, '|', n.body.replace(/\n/g, ' / '));
    return;
  }
  for (;;) {
    try { await giro(); } catch (e) { log('errore:', e.message); }
    try { await backupNotturno(await app()); } catch (e) { log('backup non riuscito:', e.message); }
    await new Promise(r => setTimeout(r, 60 * 1000 - (Date.now() % (60 * 1000)) + 2000));
  }
}
main();
