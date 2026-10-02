#!/usr/bin/env node
// Turno caricato in NaviSuite -> codici del foglio Google
// (turnoSheetCodes_ in tools/navisuite-sheet-sync-apps-script.gs).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('tools/navisuite-sheet-sync-apps-script.gs', 'utf8');
const { turnoSheetCodes_ } = new Function(`${source}; return { turnoSheetCodes_ };`)();

const base = ['D1', 'D2', 'BIS', 'T1', 'T2', 'M1', 'AGT1', 'R1', 'R2', 'R3', 'P1', 'P2', 'SR2'];
const plain = ['RIP', 'CON', 'LAV', 'F.P.', 'L.D.', 'CORSO', '#', 'MAL'];
const valid = {};
plain.forEach(code => { valid[code] = true; });
base.forEach(code => ['', '*'].forEach(star => { valid[code + star] = true; valid['C' + code + 'C' + star] = true; }));

const codes = values => turnoSheetCodes_(values, valid).map(item => item.code);

// Valori come li salva l'importazione di Aggiornamenti (normalizeImportedShift).
assert.deepEqual(codes(['CM1', 'CON']), ['CM1C', 'CON'], 'andata + congedo ("c.")');
assert.deepEqual(codes(['CM1', 'M1', 'CON', 'M1']), ['CM1C', 'CM1C', 'CON', 'M1'], 'i giorni della trasferta sono tutti CxxC, poi si torna normali');
assert.deepEqual(codes(['CP1C', 'P1']), ['CP1C', 'P1'], 'trasferta in giornata: il giorno dopo non e\' trasferta');
assert.deepEqual(codes(['D1C']), ['CD1C'], 'rientro "D1c"');
assert.deepEqual(codes(['T2*', 'RIP', 'Riposo', 'Malattia', 'L.D.', 'LAV']), ['T2*', 'RIP', 'RIP', 'MAL', 'L.D.', 'LAV']);
assert.deepEqual(codes(['L.D/']), ['L.D.'], '"l.d/" e\' L.D.');
assert.deepEqual(codes(['AgT1']), ['AGT1']);
assert.deepEqual(codes(['', 'D1']), ['', 'D1'], 'cella vuota nel turno: il foglio non si tocca');
// Casi non chiari: non vengono scritti e finiscono in "da verificare".
['C', 'CRIP', 'C.RIP.', 'C.C.', 'CF.P.', 'L.D/C', 'A RIVA'].forEach(value => {
  const [decoded] = turnoSheetCodes_([value], valid);
  assert.equal(decoded.code, null, value);
  assert.equal(decoded.raw, value);
});

console.log('Sheet turno align test passed');
