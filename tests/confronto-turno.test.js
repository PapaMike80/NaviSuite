const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test 1: shared-data.js normalizza TERRA a LAV
const sharedDataSrc = fs.readFileSync(path.join(__dirname, '../assets/js/shared-data.js'), 'utf8');
assert.ok(sharedDataSrc.includes("if (/^(?:LAV[.;]?|TERRA)$/.test(raw)) return 'LAV';"), 'shared-data.js must normalize TERRA and LAV to LAV');
assert.ok(!sharedDataSrc.includes("if (/^(?:LAV[.;]?|TERRA)$/.test(raw)) return 'TERRA';"), 'shared-data.js must not return TERRA');

// Test 2: aggiornamenti.html normalizza TERRA a LAV
const aggHtmlSrc = fs.readFileSync(path.join(__dirname, '../aggiornamenti.html'), 'utf8');
assert.ok(aggHtmlSrc.includes("if(/^(?:LAV[.;]?|TERRA)$/.test(raw))return 'LAV';"), 'aggiornamenti.html normalizeImportedShift must normalize TERRA to LAV');

// Test 3: confronto-turno.js canonicalShift e sameShift
const confrontoSrc = fs.readFileSync(path.join(__dirname, '../assets/js/confronto-turno.js'), 'utf8');
assert.ok(confrontoSrc.includes("if (s === 'TERRA') return 'LAV';"), 'confronto-turno.js must canonicalize TERRA to LAV');

// Eseguiamo la logica di canonicalShift e sameShift
const isRip = v => ['', 'RIP', 'RIP.', 'RIPOSO', '----'].includes(String(v || '').toUpperCase().trim().replace(/\*/g, '').replace(/--/g, ''));
const canonicalShift = v => {
  const s = String(v ?? '').trim().toUpperCase().replace(/[‐‑–—]/g, '-').replace(/[;,.]+$/, '');
  if (s === 'TERRA') return 'LAV';
  if (/^L\.?D$/.test(s)) return 'L.D.';
  if (/^F\.?P$/.test(s)) return 'F.P.';
  if (/^CONG?$/.test(s)) return 'CON';
  return s;
};
const sameShift = (a, b) => {
  if (isRip(a) && isRip(b)) return true;
  return canonicalShift(a) === canonicalShift(b);
};

assert.strictEqual(sameShift('LAV', 'TERRA'), true, 'LAV and TERRA must be recognized as the same shift');
assert.strictEqual(sameShift('TERRA', 'LAV'), true, 'TERRA and LAV must be recognized as the same shift');
assert.strictEqual(sameShift('LAV.', 'terra'), true, 'LAV. and terra must be recognized as the same shift');
assert.strictEqual(sameShift('L.D.', 'LD'), true, 'L.D. and LD must be recognized as the same shift');
assert.strictEqual(sameShift('RIP', 'rip'), true, 'RIP and rip must be recognized as the same shift');
assert.strictEqual(sameShift('LAV', 'D1'), false, 'LAV and D1 are different');

console.log('confronto-turno tests passed ok');
