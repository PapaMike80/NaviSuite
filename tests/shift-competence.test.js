#!/usr/bin/env node
// Tabella ore turni con decorrenza (es. turno 05/10/2026: meno corse e orari
// piu' corti a Desenzano/Riva/Peschiera). Vedi assets/js/shift-competence.js.
const assert = require('node:assert/strict');
const NaviShiftCompetence = require('../assets/js/shift-competence.js');
const fs = require('node:fs');

// Prima della decorrenza: valori di base invariati.
const d1Before = NaviShiftCompetence.shiftForCode('D1', '2026-10-04');
assert.equal(Math.round(d1Before.hours * 60), 13 * 60, 'D1 fino al 4/10 resta a 13 ore');

// Orario invernale (ODS 39/2026, tassazione pag. 18-19).
const minutesOf = (code, date) => Math.round(NaviShiftCompetence.shiftForCode(code, date).hours * 60);
const winter = { D1: [12, 5], D2: [11, 10], BIS: [12, 10], T1: [11, 30], T2: [11, 33], M1: [11, 25], R1: [12, 40], R2: [12, 0], R3: [9, 30], P1: [12, 20], P2: [11, 40], SR1: [11, 10], SR2: [11, 15], AgB: [8, 30], PonD: [8, 55], AgM: [9, 30], AgT: [9, 30], AgT1: [9, 30], AgT2: [9, 30] };
Object.entries(winter).forEach(([code, [h, m]]) => assert.equal(minutesOf(code, '2026-10-05'), h * 60 + m, `${code} dal 5/10/2026`));
assert.equal(NaviShiftCompetence.shiftForCode('R3', '2026-10-05').allowanceRate, 9, 'R3 diaria 9% d\'inverno');
assert.equal(NaviShiftCompetence.shiftForCode('SR1', '2026-10-05').allowanceRate, 9, 'SR1 diaria 9% d\'inverno');
assert.equal(NaviShiftCompetence.shiftForCode('R3', '2026-10-04').allowanceRate, 24, 'R3 al 24% fino al 4/10');
assert.equal(NaviShiftCompetence.shiftForCode('P2', '2026-10-05').allowanceRate, 24);
// Dal 2/11 solo traghetto: AgT 9h55; dal 13/3/2027 si torna a 9h30.
['AgT', 'AgT1', 'AgT2'].forEach(code => {
  assert.equal(minutesOf(code, '2026-11-02'), 9 * 60 + 55, `${code} dal 2/11`);
  assert.equal(minutesOf(code, '2027-03-13'), 9 * 60 + 30, `${code} dal 13/3/2027`);
});
assert.equal(minutesOf('D1', '2027-03-13'), 12 * 60 + 5, 'le corse riprendono con le ore invernali');
const agt1 = NaviShiftCompetence.shiftForCode('AgT1', '2026-10-05');
assert.equal(agt1.code, 'AgT1');
assert.equal(agt1.meal, true);
assert.equal(agt1.embark, false);
// Lavori e L.D.: da sempre 7 ore tutti i venerdi' (festivi compresi), 8 negli altri giorni.
assert.equal(minutesOf('LAV', '2026-10-09'), 7 * 60, 'venerdi\' 9/10/2026');
assert.equal(minutesOf('LD', '2026-10-09'), 7 * 60);
assert.equal(minutesOf('LAV', '2026-10-08'), 8 * 60, 'giovedi\'');
assert.equal(minutesOf('LAV', '2026-12-25'), 7 * 60, 'venerdi\' festivo (Natale 2026): 7 ore');
assert.equal(minutesOf('LD', '2027-01-01'), 7 * 60, 'Capodanno 2027 e\' venerdi\': 7 ore');
assert.equal(minutesOf('LAV', '2026-10-02'), 7 * 60, 'venerdi\' prima del 5/10: 7 ore');
assert.equal(minutesOf('LD', '2026-03-13'), 7 * 60, 'venerdi\' di marzo 2026: 7 ore');
assert.equal(minutesOf('LAV', '2026-10-01'), 8 * 60, 'giovedi\' prima del 5/10: 8 ore');

// Congedo: come Lavori e L.D. (8 ore, 7 tutti i venerdi', da sempre).
assert.equal(minutesOf('CON', '2026-10-05'), 8 * 60, 'congedo lunedi\'');
assert.equal(minutesOf('CON', '2026-10-08'), 8 * 60, 'congedo giovedi\'');
assert.equal(minutesOf('CON', '2026-10-09'), 7 * 60, 'congedo venerdi\'');
assert.equal(minutesOf('CON', '2026-12-25'), 7 * 60, 'congedo venerdi\' festivo');
assert.equal(minutesOf('CON', '2026-10-01'), 8 * 60, 'congedo anche prima del 5/10: 8 ore');
assert.equal(minutesOf('CON', '2026-03-10'), 8 * 60, 'congedo nel passato: 8 ore');
assert.equal(minutesOf('CON', '2026-03-13'), 7 * 60, 'congedo venerdi\' nel passato: 7 ore');
const conShift = NaviShiftCompetence.shiftForCode('CON', '2026-10-05');
assert.equal(conShift.meal, false, 'niente buono pasto in congedo');
assert.equal(conShift.allowance, false, 'niente diaria in congedo');
assert.equal(conShift.embark, false);

// Le varianti scritte nel foglio turni trovano la riga giusta.
[['TERRA', 'LAV'], ['LAV.', 'LAV'], ['L.D.', 'LD'], ['LD', 'LD'], ['CONG', 'CON'], ['CONG.', 'CON'], ['CON;', 'CON'], ['con', 'CON']].forEach(([raw, code]) => {
  assert.equal(NaviShiftCompetence.canonicalCode(raw), code, raw);
  assert.equal(NaviShiftCompetence.shiftForCode(raw, '2026-10-09').code, code, `${raw} -> ${code}`);
  assert.equal(minutesOf(raw, '2026-10-09'), 7 * 60, `${raw} il venerdi' vale 7 ore`);
});
// Servizi speciali (S.S. / SS): riconosciuto da canonicalCode, 8h 30' di base, meal ed imbarco true.
['S.S.', 'S.S', 'SS', 'ss', 's.s.'].forEach(raw => {
  assert.equal(NaviShiftCompetence.canonicalCode(raw), 'S.S.', raw);
  const sc = NaviShiftCompetence.shiftForCode(raw, '2026-10-19');
  assert.equal(sc.code, 'S.S.');
  assert.equal(Math.round(sc.hours * 60), 8 * 60 + 30, 'S.S. vale 8h 30');
  assert.equal(sc.meal, true, 'S.S. prevede ticket di base');
  assert.equal(sc.embark, true, 'S.S. prevede imbarco');
});

assert.equal(NaviShiftCompetence.canonicalCode('D1'), 'D1', 'gli altri codici restano invariati');

// Un valore personalizzato dall'utente (localStorage SHIFTS) resta la base:
// solo "hours" viene sovrascritto dal set datato, il resto (es. meal) resta.
const customBase = NaviShiftCompetence.DEFAULT_SHIFTS.map(s => s.code === 'D2' ? { ...s, meal: false, note: 'custom' } : s);
const d2Custom = NaviShiftCompetence.shiftForCode('D2', '2026-09-01', customBase);
assert.equal(d2Custom.meal, false, 'la personalizzazione dell\'utente resta valida prima della decorrenza');
// Anche con la tabella personalizzata (senza la regola del venerdi') LAV vale 7 ore il venerdi'.
assert.equal(Math.round(NaviShiftCompetence.shiftForCode('LAV', '2026-09-04', customBase).hours * 60), 7 * 60);
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

const naviturniPage = fs.readFileSync('assets/js/naviturni-page.js', 'utf8');
assert.match(naviturniPage, /canonicalCode/, 'NaviTurni riconosce TERRA, L.D. e CONG');
const cambiPage = fs.readFileSync('assets/js/cambi-turno-page.js', 'utf8');
assert.match(cambiPage, /canonicalCode/, 'Cambi turno riconosce TERRA, L.D. e CONG');
const cambiLogic = fs.readFileSync('assets/js/cambi-turno-logic.js', 'utf8');
assert.doesNotMatch(cambiLogic, /\|CONG\|CON;\|/, 'nei cambi turno il congedo non vale piu\' 0 ore');

const navidiariaHtml = fs.readFileSync('navidiaria.html', 'utf8');
assert.match(navidiariaHtml, /assets\/js\/shift-competence\.js/);
const navidistintaHtml = fs.readFileSync('navidistinta.html', 'utf8');
assert.match(navidistintaHtml, /location\.replace\('navidiaria\.html'/, 'una sola Distinta: navidistinta rimanda a navidiaria');

// Malattia: canonicalCode e shiftForCode riconoscono MAL / MALATTIA / Malattia e assegnano le ore configurate
['MAL', 'MAL.', 'MALATTIA', 'mal', 'malattia', 'Malattia'].forEach(raw => {
  assert.equal(NaviShiftCompetence.canonicalCode(raw), 'Malattia', `${raw} -> Malattia`);
});
const customWithMalattia = NaviShiftCompetence.DEFAULT_SHIFTS.map(s => s.code === 'Malattia' ? { ...s, hours: 8 } : s);
['MAL', 'MALATTIA', 'Malattia'].forEach(raw => {
  const mal = NaviShiftCompetence.shiftForCode(raw, '2026-08-05', customWithMalattia);
  assert.equal(mal.code, 'Malattia');
  assert.equal(Math.round(mal.hours * 60), 8 * 60, `${raw} con 8h configurate deve restituire 480 minuti`);
});

const NaviDistintaTotals = require('../assets/js/distinta-totals.js');
const calcWithMalattia = NaviDistintaTotals.create({ shifts: customWithMalattia, shiftCompetence: NaviShiftCompetence });
const malEntry = { date: '2026-08-05', shift: 'MALATTIA' };
assert.equal(calcWithMalattia.isWorking(malEntry), true, 'Malattia con ore configurate deve risultare lavorata');
assert.equal(calcWithMalattia.serviceMinutes(malEntry), 480, '480 min di servizio');
assert.equal(calcWithMalattia.workedMinutes(malEntry), 480, '480 min lavorati');
const malTotals = calcWithMalattia.summarize([[malEntry]]);
assert.equal(malTotals.serviceMinutes, 480);
assert.equal(malTotals.workedMinutes, 480);
assert.equal(malTotals.ticketDue, 0, 'nessun ticket per malattia');
assert.equal(malTotals.embark, 0, 'nessun imbarco per malattia');
assert.equal(malTotals.allowance24, 0, 'nessuna diaria per malattia');
assert.equal(malTotals.holiday, 0, 'nessuna festivita lavorata per malattia');
assert.equal(malTotals.sundayShift, 0, 'nessuna domenica lavorata per malattia');

// Logica B: Le ore di malattia coprono il debito orario fino a 39h, ma lo straordinario settimanale scatta solo sulle ore effettivamente lavorate oltre 39h
// Esempio 1: 4 giorni Malattia (32h) + 1 giorno servizio 10h (600 min) -> Totale 42h, Straordinario = 0h
const week1 = [
  { date: '2026-08-03', shift: 'MALATTIA' }, // 8h = 480
  { date: '2026-08-04', shift: 'MALATTIA' }, // 8h = 480
  { date: '2026-08-05', shift: 'MALATTIA' }, // 8h = 480
  { date: '2026-08-06', shift: 'MALATTIA' }, // 8h = 480
  { date: '2026-08-07', shift: 'LAV', serviceMinutes: 600, workedMinutes: 600 } // 10h = 600
];
const totWeek1 = calcWithMalattia.summarize([week1]);
assert.equal(totWeek1.workedMinutes, 4 * 480 + 600, '42 ore complessive');
assert.equal(totWeek1.overtimeMinutes, 0, '0 straordinario: 10h effettive non superano 39h');

// Esempio 4: 4 x D1 (13h = 52h lavorate) + 1 x Malattia (8h) -> Totale 60h, Straordinario = 13h (52h - 39h)
const week2 = [
  { date: '2026-08-10', shift: 'D1' }, // 13h
  { date: '2026-08-11', shift: 'D1' }, // 13h
  { date: '2026-08-12', shift: 'D1' }, // 13h
  { date: '2026-08-13', shift: 'D1' }, // 13h
  { date: '2026-08-14', shift: 'MALATTIA' } // 8h
];
const totWeek2 = calcWithMalattia.summarize([week2]);
assert.equal(totWeek2.workedMinutes, 4 * 13 * 60 + 480, '60 ore complessive');
assert.equal(totWeek2.overtimeMinutes, 13 * 60, '13 ore straordinario: 52h lavorate - 39h');

console.log('shift competence (decorrenza ore turni) ok');
