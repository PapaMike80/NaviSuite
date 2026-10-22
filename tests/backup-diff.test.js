const assert = require('assert');
const { confronta, applica } = require('../assets/js/backup-diff.js');

const attuali = [
  { date: '2026-06-03', shift: 'D1', delay: 0, overtimeComponents: { ordinario: 0, cambi: 0, sentine: 0 } },
  { date: '2026-06-04', shift: 'D3', delay: 60, overtimeComponents: { ordinario: 60, cambi: 0, sentine: 0 }, note: 'a' },
  { date: '2026-06-05', shift: 'Riposo' }
];
const fonte = [
  { date: '2026-06-03', shift: 'D1', overtimeComponents: { ordinario: 300, cambi: 0, sentine: 0 }, allowanceRate: 24 },
  { date: '2026-06-04', shift: 'D3', delay: 60, overtimeComponents: { ordinario: 60, cambi: 0, sentine: 0 }, note: 'a' },
  { date: '2026-06-06', shift: 'D2' }
];
const { righe, uguali } = confronta(attuali, fonte);
assert.strictEqual(uguali, 1);
assert.deepStrictEqual(righe.map(r => [r.date, r.stato]), [['2026-06-03', 'diverso'], ['2026-06-06', 'nuovo']]);
assert.deepStrictEqual(righe[0].campi.map(c => c.key), ['straordinario', 'allowanceRate']);
assert.strictEqual(righe[0].campi[0].testoDopo, '5:00');

const { entries, applicati } = applica(attuali, righe, new Set(['2026-06-06']));
assert.strictEqual(applicati, 1);
assert.strictEqual(entries.length, 4);
assert.strictEqual(entries.find(e => e.date === '2026-06-03').allowanceRate, undefined);
console.log('Backup diff test passed');
