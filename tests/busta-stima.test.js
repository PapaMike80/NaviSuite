const assert = require('assert');
const { stima } = require('../assets/js/busta-compare.js');

const ref = { totals: { competenze: 3000, ritenute: 900, netto: 2100 }, voci: [{ code: '334', quantity: 10, base: 20, amount: 200 }, { code: '43X', quantity: 20, base: 10, amount: 200 }] };
const s = stima(ref, { overtimeMinutes: 20 * 60, bankMinutes: 0, calendar: { embark: 10 } });
// fisso 2600 + straordinari 400 + imbarco 100 = 3100, ritenute 30%
assert.strictEqual(s.fisso, 2600);
assert.strictEqual(s.lordo, 3100);
assert.strictEqual(s.ritenute, 930);
assert.strictEqual(s.netto, 2170);
assert.strictEqual(stima({ totals: {}, voci: [] }, {}), null);
console.log('stima busta ok');
