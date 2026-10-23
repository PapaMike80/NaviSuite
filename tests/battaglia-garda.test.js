// Battaglia sul Garda: navi nell'acqua del lago, posizioni dall'orario, computer che finisce la partita.
const assert = require('assert');
require('../assets/js/orario-lago.js');
require('../assets/js/battaglia-garda.js');
const B = globalThis.NaviBattagliaGarda;
B.SCALI_CELLE.forEach(i => assert.ok(!B.ACQUA.has(i), 'sugli scali non si spara'));
assert.ok(B.ACQUA.size > 200, `poche caselle d'acqua: ${B.ACQUA.size}`);
for (let k = 0; k < 100; k++) {
  const navi = B.piazzaCasuale();
  assert.strictEqual(navi.length, 5);
  navi.forEach(n => n.celle.forEach(c => assert.ok(B.ACQUA.has(c), 'nave sulla terra')));
  assert.strictEqual(new Set(navi.flatMap(n => n.celle)).size, 14);
}
// orario finto: due corse in viaggio alle 10:30
const corse = [
  { turno: 'D1', scali: [['Desenzano', '10.00'], ['Sirmione', '11.00']] },
  { turno: 'R3', scali: [['Gargnano', '10.10'], ['Malcesine', '10.50']] },
  { turno: 'M1', scali: [['Maderno', '11.00'], ['Torri', '11.30']] },
];
const nav = B.inNavigazione(corse, 10 * 60 + 30);
assert.deepStrictEqual(nav.map(n => n.turno).sort(), ['D1', 'R3'], 'solo le navi in viaggio');
const tutte = B.posizioni(corse, 10 * 60 + 30);
assert.strictEqual(tutte.length, 3, 'anche le navi ferme');
assert.ok(tutte.find(n => n.turno === 'M1').fermo);
const tutteNavi = B.piazzaOrario(tutte);
assert.strictEqual(tutteNavi.length, 3);
tutteNavi.forEach(n => assert.strictEqual(n.celle.length, 1, 'ogni battello e una casella'));
assert.strictEqual(tutteNavi.find(n => n.nome === 'M1').tratta, 'ferma a Maderno');
assert.deepStrictEqual(B.piazzaOrario(B.posizioni(corse, 660)).map(n => n.celle), B.piazzaOrario(B.posizioni(corse, 660)).map(n => n.celle), 'uguale per tutti');
const navi = B.piazzaOrario(nav);
assert.strictEqual(navi.length, 2);
navi.forEach(n => n.celle.forEach(c => assert.ok(B.ACQUA.has(c))));
assert.strictEqual(navi.find(n => n.nome === 'D1').tratta, 'Desenzano→Sirmione');
let mosse = 0;
for (let k = 0; k < 40; k++) {
  const f = B.piazzaCasuale(), colpi = new Set();
  while (!B.finita(f)) { const i = B.mossaComputer(f, colpi); assert.ok(B.ACQUA.has(i) && !colpi.has(i)); B.spara(f, colpi, i); mosse++; }
}
const r = B.rottaGiornata([{ turno: 'D1', scali: [['Desenzano', '10.00'], ['Sirmione', '10.20']] }, { turno: 'D1', scali: [['Sirmione', '10.30'], ['Garda', '11.30']] }], 'D1');
assert.ok(r.length >= 3, 'rotta della giornata con tutti gli scali');
console.log(`battaglia-garda: ok (${B.ACQUA.size} caselle d'acqua, computer ${Math.round(mosse / 40)} mosse in media)`);
