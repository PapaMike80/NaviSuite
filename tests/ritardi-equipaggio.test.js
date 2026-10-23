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
  ctx.NaviOvertimeComponents = { isWorkedManual: e => e.overtimeMeta?.workedMode === 'manual', changes: () => 0, sentine: () => 0, setWorked: (e, v) => { e.workedMinutes = v; } };
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
  return { e: ctx.entries[0], segna: async min => { ctx.entries[0].rit = min; ctx.entries[0].modificatoIl = Date.now(); await ctx.saveEntriesToFirebase(); await ctx.NaviRitardiEquipaggio.pubblica(); }, salva: async () => { await ctx.saveEntriesToFirebase(); await ctx.NaviRitardiEquipaggio.pubblica(); }, ricevi: (risposta = true) => { ctx.risposta = risposta; return ctx.NaviRitardiEquipaggio.ricevi(); } };
}

const pausa = () => new Promise(r => setTimeout(r, 3));
(async () => {
  const db = {};
  const tizio = agente('TIZIO', db), caio = agente('CAIO', db), sempronio = agente('SEMPRONIO', db);
  // il primo
  await tizio.segna(20);
  await caio.ricevi(); await sempronio.ricevi(false);
  assert.strictEqual(caio.e.rit, 20, 'Caio registra i 20 minuti di Tizio');
  assert.strictEqual(sempronio.e.rit, undefined, 'Sempronio annulla');
  await sempronio.ricevi(true);
  assert.strictEqual(sempronio.e.rit, undefined, 'dopo Annulla non ricompare');
  // il secondo: Caio modifica, passa a tutti
  await pausa(); await caio.segna(10);
  await tizio.ricevi(); await sempronio.ricevi();
  assert.deepStrictEqual([tizio.e.rit, sempronio.e.rit], [10, 10], 'la modifica di Caio passa a tutti');
  // chi registra non lo rimanda indietro
  await tizio.salva(); await caio.ricevi(false);
  assert.strictEqual(caio.e.rit, 10);
  // cancellazione dal terzo
  await pausa(); await sempronio.segna(0);
  await tizio.ricevi(true); await caio.ricevi(false);
  assert.deepStrictEqual([tizio.e.rit, caio.e.rit, sempronio.e.rit], [0, 10, 0], 'cancellato: chi registra lo toglie, chi annulla lo tiene');
  // chi arriva dopo vede l'ultima modifica
  const mevio = agente('MEVIO', db); await mevio.ricevi();
  assert.strictEqual(mevio.e.rit, undefined, 'ultima modifica = 0: niente da registrare');
  await pausa(); await tizio.segna(45);
  await mevio.ricevi();
  assert.strictEqual(mevio.e.rit, 45, 'chi arriva dopo riceve l ultima modifica');
  // Giornate passate o future: niente invio
  const db4 = {}, x1 = agente('X1', db4);
  x1.e.date = '2020-01-01'; await x1.segna(30);
  assert.deepStrictEqual(db4, {}, 'un ritardo non di oggi non parte');
  // Ore lavorate a mano: con il ritardo cancellato tornano al servizio
  const db5 = {}, y1 = agente('Y1', db5), y2 = agente('Y2', db5);
  y2.e.workedMinutes = 900; y2.e.overtimeMeta = { workedMode: 'manual' };
  await y1.segna(90); await y2.ricevi();
  assert.strictEqual(y2.e.workedMinutes, 480 + 90);
  await pausa(); await y1.segna(0); await y2.ricevi();
  assert.deepStrictEqual([y2.e.rit, y2.e.workedMinutes], [0, 480], 'cancellato: ore lavorate tornano al servizio');
  console.log('ritardi-equipaggio: ok');
})().catch(e => { console.error(e); process.exit(1); });
