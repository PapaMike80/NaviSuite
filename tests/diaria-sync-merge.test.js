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

// Maneggio denaro cambiato dalla tabella mensile: resta "a mano", l'allineamento ai turni non lo ricalcola.
const monthly = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets/js/navidiaria-monthly.js'), 'utf8');
assert.match(monthly, /if\(row\.field==='cashHandling'\)entry\.cashHandlingManual=true/);
// PocketBase e' l'archivio principale della Distinta, Firebase il backup.
assert.match(src, /const DiariaStore=/);
assert.ok(!/NaviAdminFirebase\.(load|save)Diaria\(String\(activeAgent/.test(src), 'la Distinta passa da DiariaStore');
console.log('Diaria manual flags test passed');
// Allineamento ai turni: le giornate passate gia' presenti non vengono piu' modificate.
assert.match(src, /if\(existing&&date<todayIso\(\)\)return;/);
console.log('Diaria past days frozen test passed');
