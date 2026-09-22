#!/usr/bin/env node
// Tabella ore turni con decorrenza (es. turno 05/10/2026: meno corse e orari
// piu' corti a Desenzano/Riva/Peschiera). Vedi assets/js/shift-competence.js.
const assert = require('node:assert/strict');
const NaviShiftCompetence = require('../assets/js/shift-competence.js');
const fs = require('node:fs');

// Prima della decorrenza: valori di base invariati.
const d1Before = NaviShiftCompetence.shiftForCode('D1', '2026-10-04');
assert.equal(Math.round(d1Before.hours * 60), 13 * 60, 'D1 fino al 4/10 resta a 13 ore');

// Dalla decorrenza: il set datato si applica (oggi come segnaposto, stessi
// valori — il meccanismo va verificato indipendentemente dai numeri reali,
// che arriveranno con l'ODS).
const d1After = NaviShiftCompetence.shiftForCode('D1', '2026-10-05');
assert.ok(d1After, 'D1 risolto anche dopo la decorrenza');
const overrideEntry = NaviShiftCompetence.COMPETENCE_SETS.find(set => set.from === '2026-10-05').shifts.find(s => s.code === 'D1');
assert.ok(overrideEntry, 'D1 e\' fra i codici con un set datato dal 05/10/2026');

// Maderno (T1) non ha un set datato: stesso valore prima e dopo, per ora.
const madernoSet = NaviShiftCompetence.COMPETENCE_SETS.find(set => set.from === '2026-10-05');
assert.ok(!madernoSet.shifts.some(s => s.code === 'T1'), 'Maderno (T1) non e\' ancora fra le residenze con orari cambiati');
assert.equal(
  NaviShiftCompetence.shiftForCode('T1', '2026-09-01').hours,
  NaviShiftCompetence.shiftForCode('T1', '2026-12-01').hours,
  'T1 ha lo stesso valore prima e dopo la decorrenza'
);

// Un valore personalizzato dall'utente (localStorage SHIFTS) resta la base:
// solo "hours" viene sovrascritto dal set datato, il resto (es. meal) resta.
const customBase = NaviShiftCompetence.DEFAULT_SHIFTS.map(s => s.code === 'D2' ? { ...s, meal: false, note: 'custom' } : s);
const d2Custom = NaviShiftCompetence.shiftForCode('D2', '2026-09-01', customBase);
assert.equal(d2Custom.meal, false, 'la personalizzazione dell\'utente resta valida prima della decorrenza');
const d2CustomAfter = NaviShiftCompetence.shiftForCode('D2', '2026-10-06', customBase);
assert.equal(d2CustomAfter.meal, false, 'la personalizzazione non legata alle ore sopravvive anche dopo la decorrenza');
assert.equal(d2CustomAfter.note, 'custom', 'i campi non sovrascritti dal set datato restano quelli personalizzati');

// Nessuna data: usa oggi (non deve lanciare eccezioni).
assert.ok(NaviShiftCompetence.shiftForCode('D1'));

// ---- integrazione nei consumatori -----------------------------------------
const app = fs.readFileSync('assets/js/app.js', 'utf8');
assert.match(app, /window\.NaviShiftCompetence\.DEFAULT_SHIFTS/, 'app.js usa la tabella condivisa');
assert.match(app, /function shiftFor\(code,dateIso\)/, 'shiftFor accetta la data');
assert.match(app, /shiftFor\(shift,date\)/, 'la sincronizzazione da NaviTurni passa la data della giornata');
assert.match(app, /SHIFTS\.find\(s=>s\.code===card\.dataset\.shift\)/, 'il salvataggio delle competenze admin scrive ancora dentro SHIFTS, non in una copia');
assert.doesNotMatch(app, /const shift=shiftFor\(card\.dataset\.shift\)/, 'il pannello admin non deve mutare l\'oggetto restituito da shiftFor (e\' una copia, non salverebbe piu\' nulla)');

const navidistinta = fs.readFileSync('assets/js/navidistinta-app.js', 'utf8');
assert.match(navidistinta, /window\.NaviShiftCompetence\.DEFAULT_SHIFTS/);
assert.match(navidistinta, /SHIFTS\.find\(s=>s\.code===card\.dataset\.shift\)/);

const dayPopup = fs.readFileSync('assets/js/day-popup.js', 'utf8');
assert.doesNotMatch(dayPopup, /opts\.shiftFor\(e\.shift\)/, 'day-popup deve passare la data della giornata a shiftFor');
assert.doesNotMatch(dayPopup, /opts\.shiftFor\(draft\.shift\)/);

const navidiariaHtml = fs.readFileSync('navidiaria.html', 'utf8');
assert.match(navidiariaHtml, /assets\/js\/shift-competence\.js/);
const navidistintaHtml = fs.readFileSync('navidistinta.html', 'utf8');
assert.match(navidistintaHtml, /assets\/js\/shift-competence\.js/);

console.log('shift competence (decorrenza ore turni) ok');
