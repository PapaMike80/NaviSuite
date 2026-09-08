const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const html = fs.readFileSync('ponteradio.html', 'utf8');
const js = fs.readFileSync('assets/js/ponteradio.js', 'utf8');
const pb = fs.readFileSync('v2/assets/pb.js', 'utf8');
const hook = fs.readFileSync('pocketbase/pb_hooks/ponte_radio.pb.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const worker = fs.readFileSync('ponteradio-worker/worker.js', 'utf8');

for (const file of [
  'assets/js/ponteradio.js',
  'v2/assets/pb.js',
  'pocketbase/pb_hooks/ponte_radio.pb.js',
  'ponteradio-worker/worker.js',
  'sw.js',
]) {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', file], { stdio:'pipe' }), file + ' must parse');
}

assert.match(html, /v2\/assets\/pb\.js\?v=20260908-storage-fallback/);
assert.match(html, /assets\/js\/ponteradio\.js\?v=20260909-push-repair/);
assert.match(html, /id="radio-agent-search"/);
assert.match(html, /id="radio-repair"/);
assert.match(html, /Inizia a scrivere il cognome/);
assert.doesNotMatch(html, /admin-firebase-rest\.js|push-notifications-v3\.js|NaviPush/);

// Registrazione notifiche robusta: credenziale mancante vs profilo non
// provisionato, ricreazione subscription con chiave VAPID diversa, conferma
// dal server, pulsante Ripara.
assert.match(js, /missing\.code = 'no-credential'/);
assert.match(js, /pending\.code = 'not-provisioned'/);
assert.match(js, /function serverKeyMatches/);
assert.match(js, /async function activePushSubscription/);
assert.match(js, /Il server non ha confermato la registrazione/);
assert.match(js, /async function repairNotifications/);
assert.match(js, /\$\('radio-repair'\)\?\.addEventListener\('click', repairNotifications\)/);
assert.match(worker, /async function syncUsers/);
assert.match(worker, /worker\/sync-users/);

assert.match(js, /const API_ROOT = '\/api\/navisuite-v2\/ponteradio'/);
assert.match(js, /function matchesRecipient/);
assert.match(js, /name\.startsWith\(needle\) \|\| name\.split\(' '\)\.some\(part => part\.startsWith\(needle\)\)/);
assert.match(js, /recipientLabel\(row\)/);
assert.match(js, /name \+ ' \(Tu\)'/);
assert.match(js, /NaviV2PB\.request\(API_ROOT \+ '\/send'/);
assert.match(js, /indexedDB\.open\(DB_NAME, 1\)/);
assert.doesNotMatch(js, /NaviPush|listSubscriptions|queuePush|selectedOptions/);

assert.match(pb, /https:\/\/truenas-scale\.tail805e51\.ts\.net/);
assert.match(pb, /memoryStore/);
assert.match(pb, /try \{ localStorage\.setItem\(key, text\); \} catch \(_\) \{\}/);
assert.doesNotMatch(pb, /INSERISCI|GENERA_UN_SECRET|PRIVATE_KEY/);

assert.match(hook, /routerAdd\("GET", "\/api\/navisuite-v2\/ponteradio\/recipients"/);
assert.match(hook, /if \(!agent\) continue;/);
assert.doesNotMatch(hook, /agent\.id === me\.id/);
assert.match(hook, /routerAdd\("GET", "\/api\/navisuite-v2\/ponteradio\/worker\/jobs"/);
assert.match(hook, /worker\/sync-users"/);
assert.match(hook, /passwordConfirm/);
assert.match(hook, /worker\/result"/);

assert.match(sw, /saveIncomingPonteRadio/);
assert.match(sw, /\.\/v2\/assets\/pb\.js/);

console.log('Ponte Radio PocketBase production test passed');
