#!/usr/bin/env node
// Sincronizzazione della Distinta: per ogni giornata vince la modifica piu' recente (modificatoIl),
// cosi' un telefono rimasto indietro non cancella le modifiche fatte dal PC.
const assert = require('node:assert/strict');
const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets/js/app.js'), 'utf8');
const merge = new Function(`${src.match(/function mergeByDayTime[^\n]*\n/)[0]}; return mergeByDayTime;`)();
const pc = { date: '2026-08-15', shift: 'D1', workedMinutes: 595, modificatoIl: 200 };
const telefonoVecchio = { date: '2026-08-15', shift: 'D1', workedMinutes: 565 };
const telefonoNuovo = { date: '2026-08-16', shift: 'RIP', modificatoIl: 300 };
assert.deepEqual(merge([telefonoVecchio, telefonoNuovo], [pc]), [pc, telefonoNuovo], 'il PC vince sul 15, il telefono porta il 16');
assert.deepEqual(merge([{ date: 'x', a: 1 }], [{ date: 'x', a: 2 }]), [{ date: 'x', a: 2 }], 'senza ora vince Firebase');
assert.deepEqual(merge([{ date: 'x', a: 1, modificatoIl: 5 }], [{ date: 'x', a: 2, modificatoIl: 4 }]), [{ date: 'x', a: 1, modificatoIl: 5 }]);
console.log('Diaria sync merge test passed');
