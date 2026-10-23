// Ritardi dell'equipaggio: il primo ritardo segnato su una corsa passa ai colleghi; le correzioni restano di chi le fa.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const codice = fs.readFileSync('assets/js/ritardi-equipaggio.js', 'utf8');
const oggi = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

function agente(id, db, adm) {
  const ctx = {
    entries: [{ date: oggi, shift: 'R3', serviceMinutes: 480 }],
    activeAgent: { id, name: id },
    isAdmin: () => !!adm,
    persist() {}, writeEntriesLocal() {}, markCloudDirty() {},
    async saveEntriesToFirebase() {},
    navigator: { onLine: true }, document: { visibilityState: 'hidden', addEventListener() {}, dispatchEvent() {} },
    CustomEvent: function () {}, setTimeout() {}, setInterval() {}, console, Date, Math, Number, String, Object, JSON,
    addEventListener() {},
  };
  ctx.window = ctx;
  ctx.NaviDiariaOvertime = {
    ordinary: e => e.rit || 0,
    setOrdinary: (e, v) => { e.rit = v; },
  };
  ctx.NaviAdminFirebase = {
    ready: Promise.resolve(),
    async getRitardiEquipaggio() { return JSON.parse(JSON.stringify(db)); },
    async saveRitardoEquipaggio(g, t, a, v) { ((db[g] ||= {})[t] ||= {})[a] = v; },
  };
  vm.createContext(ctx);
  ctx.NaviRitardiEquipaggio = { chiedi: async () => ctx.risposta !== false };
  vm.runInContext(codice, ctx);
  return { e: ctx.entries[0], segna: async min => { ctx.entries[0].rit = min; ctx.entries[0].modificatoIl = Date.now(); await ctx.saveEntriesToFirebase(); await ctx.NaviRitardiEquipaggio.pubblica(); }, ricevi: (risposta = true) => { ctx.risposta = risposta; return ctx.NaviRitardiEquipaggio.ricevi(); } };
}

(async () => {
  const db = {};
  const tizio = agente('TIZIO', db), caio = agente('CAIO', db), sempronio = agente('SEMPRONIO', db);
  await tizio.segna(20);
  await caio.ricevi(); await sempronio.ricevi();
  assert.strictEqual(caio.e.rit, 20, 'Caio riceve i 20 minuti di Tizio');
  assert.strictEqual(sempronio.e.rit, 20, 'Sempronio riceve i 20 minuti di Tizio');
  await caio.segna(10);
  await sempronio.ricevi(); await tizio.ricevi();
  assert.strictEqual(caio.e.rit, 10, 'la correzione di Caio resta sua');
  assert.strictEqual(tizio.e.rit, 20, 'Tizio non riceve la correzione di Caio');
  assert.strictEqual(sempronio.e.rit, 20, 'Sempronio non riceve la correzione di Caio');
  await tizio.segna(10);
  const nuovo = agente('MEVIO', db); await nuovo.ricevi();
  assert.strictEqual(nuovo.e.rit, 20, 'la correzione di Tizio non cambia quello dei colleghi');
  assert.strictEqual(sempronio.e.rit, 20);
  // Admin: il suo ritardo passa sempre, anche a chi l'ha gia' ricevuto o corretto, e a ogni sua modifica
  const capo = agente('ADMIN', db, true);
  await capo.segna(35);
  await caio.ricevi(); await tizio.ricevi(); await sempronio.ricevi();
  assert.deepStrictEqual([caio.e.rit, tizio.e.rit, sempronio.e.rit], [35, 35, 35], 'il ritardo dell admin passa a tutti');
  await caio.segna(5);
  await capo.segna(40);
  await caio.ricevi(); await tizio.ricevi();
  assert.deepStrictEqual([caio.e.rit, tizio.e.rit], [40, 40], 'ogni modifica dell admin passa di nuovo');
  await caio.segna(15); await caio.ricevi();
  assert.strictEqual(caio.e.rit, 15, 'senza nuove modifiche dell admin la correzione di Caio resta');
  // Annulla: il ritardo non entra e il popup non ricompare
  const db2 = {}, a1 = agente('A1', db2), a2 = agente('A2', db2);
  await a1.segna(30);
  await a2.ricevi(false);
  assert.strictEqual(a2.e.rit, undefined, 'Annulla non registra');
  await a2.ricevi(true);
  assert.strictEqual(a2.e.rit, undefined, 'dopo Annulla non viene riproposto');
  console.log('ritardi-equipaggio: ok');
})().catch(e => { console.error(e); process.exit(1); });
