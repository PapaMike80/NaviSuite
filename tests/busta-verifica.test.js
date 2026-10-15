#!/usr/bin/env node
// Verifica busta paga: parser INAZ, totali della Distinta e confronto.
// ATTENZIONE: il repository e' pubblico. La busta qui sotto e' SINTETICA
// (stesso layout INAZ, azienda, voci e importi inventati): non inserire mai
// dati reali (buste, importi, IBAN, codici fiscali).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const parser = require('../assets/js/busta-parser.js');
const totalsModule = require('../assets/js/distinta-totals.js');
const compareModule = require('../assets/js/busta-compare.js');
const shiftCompetence = require('../assets/js/shift-competence.js');

// overtime-components.js scrive su window e contiene un IIFE per navidiaria:
// gli serve un DOM inerte (come in tests/overtime-components.test.js).
const overtimeContext = { window: {}, setTimeout: () => {}, document: { readyState: 'complete', body: { classList: { contains: () => false } }, querySelector: () => null, createElement: () => ({}), head: { appendChild: () => {} }, addEventListener: () => {} } };
overtimeContext.window.addEventListener = () => {};
vm.runInNewContext(read('assets/js/overtime-components.js'), overtimeContext);
const overtime = overtimeContext.window.NaviOvertimeComponents;

// --- parseAmount ---
assert.equal(parser.parseAmount('1.695,95'), 1695.95);
assert.equal(parser.parseAmount('1021,19-'), -1021.19);
assert.equal(parser.parseAmount('12'), 12);
assert.equal(parser.parseAmount('0,50'), 0.5);
assert.equal(parser.parseAmount('(es.30,99)'), null);
assert.equal(parser.parseAmount('2.02'), null, 'il punto non e\' un separatore decimale italiano');
assert.equal(parser.parseAmount('40%'), null);
assert.equal(parser.parseAmount('P.121'), null);

// --- Busta sintetica ---
const CHAR = 4.4; // larghezza media di un carattere (pt) per gli item finti
const item = (str, x, y) => ({ str, transform: [8, 0, 0, 8, x, y], width: str.length * CHAR });
const right = (str, xMax, y) => item(str, xMax - str.length * CHAR, y);
const COL = { quantity: 306, base: 390, figurative: 468, amount: 564 };
function voceRow(y, { flag = '', code, description, quantity, base, figurative, amount, split = false }) {
  const items = [];
  if (flag) items.push(item(flag, 36, y));
  items.push(item(code, 48, y));
  if (split) {
    const [first, second] = description;
    items.push(item(first, 82, y));
    items.push(item(second, 82 + (first.length + 1) * CHAR, y));
  } else items.push(item(description, 82, y));
  if (quantity) items.push(right(quantity, COL.quantity, y));
  if (base) items.push(right(base, COL.base, y));
  if (figurative) items.push(right(figurative, COL.figurative, y));
  if (amount) items.push(right(amount, COL.amount, y));
  return items;
}
const header = y => [item('Voce', 44, y), item('Descrizione', 82, y), right('Ore/Giorni/Num./%', 300, y), item('Base', 372, y), item('Figurativo', 426, y), item('Competenze Ritenute', 488, y)];
const page1 = [
  // Testata azienda/anagrafica: sopra "Voce", da ignorare (anche se sembra una voce).
  item('AZIENDA ESEMPIO S.P.A.', 40, 810),
  item('XYZ99 Via Inventata 1 00000 Nessunluogo', 48, 796),
  item('Periodo', 470, 770), item('09.26', 520, 760),
  item('Matricola 000000 ROSSI MARIO', 40, 740),
  item('12.34', 300, 560), // numero con forma MM.AA ma sotto y 600: non e' il periodo
  ...header(640),
  ...voceRow(620, { flag: 'A', code: '001', description: 'Retribuzione base', amount: '1.500,00' }),
  ...voceRow(606, { code: '334', description: 'Prest.straordinarie', quantity: '10,50', base: '15,00', amount: '157,50' }),
  ...voceRow(592, { code: '43X', description: 'Ind. imbarco', quantity: '20', base: '3,10', amount: '62,00' }),
  ...voceRow(578, { code: '47X', description: 'Ind. prest. domenicale', quantity: '4', base: '10,00', amount: '40,00' }),
  ...voceRow(564, { code: 'FC0', description: 'Maneggio denaro', quantity: '5', base: '2,00', amount: '10,00' }),
  ...voceRow(550, { code: 'FC1', description: 'Pernottazione nav. 40%', quantity: '2', base: '12,00', amount: '24,00' }),
  ...voceRow(536, { code: '594', description: 'Banca ore maturata', quantity: '3,00' }),
  ...voceRow(522, { code: '18X', description: ['Diarie 24%', '(es.30,99)'], split: true, quantity: '10', base: '7,44', amount: '74,40' }),
  ...voceRow(508, { code: '28Y', description: 'Diarie 24% (es.30,99)', quantity: '6', base: '7,44', amount: '44,64' }),
  ...voceRow(494, { code: '1TK', description: 'Ticket elettronico', figurative: '12' }),
  ...voceRow(480, { code: '013', description: 'Lavoro in FI-FN', quantity: '1', base: '20,00', amount: '20,00' }),
  ...voceRow(466, { flag: 'B', code: 'C01', description: 'Contributi IVS', quantity: '9,19', base: '1.500,00', amount: '137,85-' }),
  ...voceRow(452, { flag: 'C', code: 'IR1', description: 'IRPEF lorda', amount: '250,00-' }),
  ...voceRow(438, { code: 'FD0', description: 'Ind. rendimento 2.02 P.121', amount: '30,00' }),
  item('*** SEGUE ***', 260, 300),
  item('ZZZ Nota fuori tabella', 48, 280) // sotto "SEGUE": non e' una voce
];
const page2 = [
  item('AZIENDA ESEMPIO S.P.A.', 40, 810),
  ...header(640),
  ...voceRow(620, { code: '49X', description: 'Ind. prest. giornaliera', quantity: '3', base: '5,00', amount: '15,00' }),
  item('Totale Competenze', 300, 200), item('Totale Ritenute', 400, 200), item('Netto a pagare', 480, 200),
  right('1.977,54', 376, 188), right('387,85', 466, 188), right('1.589,69', 556, 188),
  item('I dati variabili si riferiscono al mese precedente (D.M. 9-07-08)', 40, 120)
];
const busta = parser.parseItems([{ items: page1 }, { items: page2 }]);
const byCode = code => busta.voci.find(voce => voce.code === code);

assert.deepEqual(busta.period, { month: 9, year: 2026, label: '09.26' });
assert.equal(busta.voci.length, 15, 'voci di entrambe le pagine, niente testata');
assert.ok(!byCode('XYZ99'), 'testata azienda ignorata');
assert.ok(!byCode('ZZZ'), 'righe dopo *** SEGUE *** ignorate');
assert.deepEqual(
  { ...byCode('334'), y: undefined, page: undefined },
  { flag: '', code: '334', description: 'Prest.straordinarie', quantity: 10.5, base: 15, figurative: null, amount: 157.5, y: undefined, page: undefined }
);
assert.equal(byCode('001').flag, 'A');
assert.equal(byCode('001').amount, 1500);
assert.equal(byCode('C01').flag, 'B');
assert.equal(byCode('C01').amount, -137.85, 'ritenuta con il segno finale');
assert.equal(byCode('C01').base, 1500);
assert.equal(byCode('18X').description, 'Diarie 24% (es.30,99)', 'descrizione spezzata in piu\' item');
assert.equal(byCode('28Y').description, 'Diarie 24% (es.30,99)');
assert.equal(byCode('FD0').description, 'Ind. rendimento 2.02 P.121', 'numeri nella descrizione restano descrizione');
assert.equal(byCode('FD0').quantity, null);
assert.equal(byCode('1TK').figurative, 12);
assert.equal(byCode('1TK').quantity, null);
assert.equal(byCode('49X').page, 2);
assert.deepEqual(busta.totals, { competenze: 1977.54, ritenute: 387.85, netto: 1589.69 });
assert.equal(busta.check.sumCompetenze, 1977.54);
assert.equal(busta.check.sumRitenute, 387.85);
assert.equal(busta.check.completa, true);

// Buste INAZ vere (giugno-settembre 2026): la voce "900 Totale ritenute sociali" non chiude la tabella
// e non e' il Totale Ritenute; "NETTO" e "A PAGARE" stanno su due righe con l'importo a destra.
const page2Inaz = [
  item('AZIENDA ESEMPIO S.P.A.', 40, 810),
  ...header(640),
  ...voceRow(630, { code: '900', description: 'Totale ritenute sociali', base: '137,85' }),
  ...voceRow(620, { code: '49X', description: 'Ind. prest. giornaliera', quantity: '3', base: '5,00', amount: '15,00' }),
  item('Totale Ritenute', 400, 220), item('Totale Competenze', 480, 220),
  right('387,85', 466, 208), right('1.977,54', 556, 208),
  item('NETTO', 300, 200), item('A PAGARE', 304, 194), right('1.589,69', 556, 194)
];
const inaz = parser.parseItems([{ items: page1 }, { items: page2Inaz }]);
assert.ok(inaz.voci.some(voce => voce.code === '49X'), 'le voci dopo la 900 si leggono');
assert.deepEqual(inaz.totals, { competenze: 1977.54, ritenute: 387.85, netto: 1589.69 });
assert.equal(inaz.check.completa, true);

// Una riga persa: la lettura non e' completa e lo si dice.
const partial = parser.parseItems([{ items: page1 }, { items: page2.filter(entry => entry.str !== '49X') }]);
assert.equal(partial.check.completa, false);
assert.match(partial.check.message, /qualche riga potrebbe non essere stata letta/);
const noTotals = parser.parseItems([{ items: page1 }]);
assert.equal(noTotals.check.completa, false);
assert.equal(noTotals.check.totalsFound, false);
assert.match(noTotals.check.message, /Non trovo i totali/);
assert.equal(parser.parseItems([{ items: [item('Documento qualsiasi', 40, 700)] }]).check.headerFound, false);

// Totali sulla stessa riga dell'etichetta.
const inline = parser.findTotals(parser.groupRows([item('Totale Competenze', 300, 200), right('1.000,00', 420, 200), item('Totale Ritenute', 440, 200), right('10,00-', 564, 200)].flatMap(entry => parser.splitWords({ ...entry, x: entry.transform[4], y: entry.transform[5] }))));
assert.equal(inline.competenze, 1000);
assert.equal(inline.ritenute, 10);

// Senza intestazioni leggibili valgono le soglie misurate sulla busta reale.
assert.equal(parser.columnBounds(null).quantityMaxX, 308);
assert.equal(parser.columnBounds(null).baseMaxX, 392);
assert.equal(parser.columnBounds(null).figurativeMaxX, 470);

// --- previousMonth ---
assert.equal(parser.previousMonth('09.26'), '2026-08');
assert.equal(parser.previousMonth('01.27'), '2026-12');
assert.equal(parser.previousMonth({ month: 1, year: 2026 }), '2025-12');
assert.equal(parser.previousMonth(busta.period), '2026-08');
assert.equal(parser.previousMonth('boh'), '');

// --- Distinta: periodo di competenza ---
const august = totalsModule.competencePeriod('2026-08');
assert.equal(august.startIso, '2026-07-27');
assert.equal(august.endIso, '2026-08-30');
assert.equal(august.weeks.length, 5);
// Stesso risultato di competencePeriod() di app.js.
{
  const source = read('assets/js/app.js');
  const start = source.indexOf('function isoDateValue');
  const end = source.indexOf('function currentMonth', start);
  const appPeriod = new Function('window', `${source.slice(start, end)}; return competencePeriod;`)({});
  ['2026-01', '2026-02', '2026-03', '2026-08', '2026-11', '2027-05'].forEach(month => {
    const ours = totalsModule.competencePeriod(month), theirs = appPeriod(month);
    assert.equal(ours.startIso, theirs.startIso, month);
    assert.equal(ours.endIso, theirs.endIso, month);
    assert.equal(ours.weeks.length, theirs.weeks.length, month);
  });
}

// --- Tabella turni: stesse normalizzazioni di app.js ---
function memoryStorage(values = {}) { const map = new Map(Object.entries(values)); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)) }; }
{
  const source = read('assets/js/app.js');
  const version = /const COMPETENCE_VERSION='([^']+)'/.exec(source)[1];
  assert.equal(totalsModule.COMPETENCE_VERSION, version, 'COMPETENCE_VERSION allineata ad app.js');
  const start = source.indexOf('let SHIFTS=');
  const end = source.indexOf('const TURNS_URL', start);
  const appShifts = storage => new Function('localStorage', 'DEFAULT_SHIFTS', 'SHIFTS_STORAGE', 'COMPETENCE_VERSION', `${source.slice(start, end)}; return SHIFTS;`)(storage, shiftCompetence.DEFAULT_SHIFTS, 'navidiaria.shifts.v1', version);
  assert.deepEqual(totalsModule.loadShifts(memoryStorage(), shiftCompetence.DEFAULT_SHIFTS), appShifts(memoryStorage()));
  const custom = JSON.stringify([{ code: 'D1', hours: 12, allowance: true, allowanceRate: 25, meal: false }, { code: 'AgB', hours: 10, allowanceRate: 9, meal: false }]);
  const stored = { 'navidiaria.competenceVersion': version, 'navidiaria.shifts.v1': custom };
  assert.deepEqual(totalsModule.loadShifts(memoryStorage(stored), shiftCompetence.DEFAULT_SHIFTS), appShifts(memoryStorage(stored)));
  const stale = { 'navidiaria.competenceVersion': 'vecchia', 'navidiaria.shifts.v1': custom };
  assert.deepEqual(totalsModule.loadShifts(memoryStorage(stale), shiftCompetence.DEFAULT_SHIFTS), appShifts(memoryStorage(stale)));
}

// --- Distinta sintetica di agosto 2026 ---
const calc = totalsModule.create({ overtime, shiftCompetence, storage: memoryStorage() });
const day = (date, shift, extra = {}) => ({ id: `t-${date}`, date, shift, ...extra });
const entries = [
  // Settimana 27/07-02/08: 5 x D1 (13h) = 65h -> 26h di straordinario.
  day('2026-07-27', 'D1', { mealUsed: true, embark: true }),
  day('2026-07-28', 'D1', { mealUsed: false, embark: true }),
  day('2026-07-29', 'D1', { mealUsed: true, ticketPresence: false, embark: true }),
  day('2026-07-30', 'D1', { mealUsed: false, ticketPresence: true, embark: true, cashHandling: true }),
  day('2026-07-31', 'Riposo'),
  day('2026-08-02', 'D1', { mealUsed: true, allowanceRate: 24, bank: 30 }), // domenica
  // Settimana 03/08-09/08: 3 giorni, 39h esatte -> nessuno straordinario.
  day('2026-08-03', 'D1', { mealUsed: true, allowanceRate: 24, overnight40: true }),
  day('2026-08-04', 'D1', { mealUsed: true, allowanceRate: 9 }),
  day('2026-08-05', 'MALATTIA'),
  day('2026-08-06', 'D1', { mealUsed: true, allowanceRate: 24, bank: -15 }),
  // Settimana 10/08-16/08: ore manuali e Ferragosto (festivita' fissa).
  day('2026-08-10', 'D1', { workedMinutes: 900, overtimeMeta: { workedMode: 'manual' }, overtimeComponents: { ordinario: 10, cambi: 0, sentine: 0 } }),
  day('2026-08-15', 'D2', { holidayWorked: undefined }),
  day('2026-08-16', 'RIP'),
  // Fuori periodo: 31/08 appartiene alla competenza di settembre.
  day('2026-08-31', 'D1', { mealUsed: true })
];
const result = calc.compute(entries, '2026-08');
assert.equal(result.period.startIso, '2026-07-27');
assert.equal(result.period.weeks.length, 5);
assert.equal(result.entryCount, 13);
const t = result.totals;
assert.equal(t.workedDays, 10);
assert.equal(result.period.weeks[0].workedMinutes, 5 * 13 * 60);
assert.equal(result.period.weeks[0].overtimeMinutes, 26 * 60, 'oltre 39h: 65h - 39h');
assert.equal(result.period.weeks[1].overtimeMinutes, 0, '39h esatte: niente straordinario');
assert.equal(result.period.weeks[2].workedMinutes, 900 + Math.round(shiftCompetence.shiftForCode('D2', '2026-08-15').hours * 60), 'ore manuali');
assert.equal(t.overtimeMinutes, 26 * 60);
assert.equal(t.sundayShift, 1);
assert.equal(t.holiday, 1, 'Ferragosto');
assert.equal(t.bankMinutes, 15);
assert.equal(t.embark, 4);
assert.equal(t.cashHandling, 1);
assert.equal(t.overnight40, 1);
assert.equal(t.allowance24, 3);
assert.equal(t.allowance9, 1);
// Ticket: ticketPresence vince su mealUsed.
assert.equal(t.ticketDue, 10);
assert.equal(t.ticketUsed, 6);
assert.equal(t.ticketCredit, 4);

// Ore lavorate: manuale esplicito, componenti strutturate, record legacy.
assert.equal(calc.baseWorkedMinutes({ shift: 'D1', date: '2026-08-10', workedMinutes: 480, overtimeMeta: { workedMode: 'manual' }, overtimeComponents: { ordinario: 30, cambi: 0, sentine: 0 } }), 480);
assert.equal(calc.baseWorkedMinutes({ shift: 'D1', date: '2026-08-10', workedMinutes: 480, overtimeComponents: { ordinario: 30, cambi: 60, sentine: 0 } }), 13 * 60 + 90, 'strutturato non manuale: servizio + componenti');
assert.equal(calc.baseWorkedMinutes({ shift: 'D1', date: '2026-08-10', workedMinutes: 700 }), 700, 'legacy con ore salvate');
assert.equal(calc.workedMinutes({ shift: 'D1', date: '2026-08-10', delay: 20, changeMinutes: 120 }), 13 * 60 + 20 + 120, 'legacy: cambio sommato');

// Festivita': Pasquetta 2026 = 6 aprile; holidayWorked esplicito vince.
assert.equal(totalsModule.easterMondayKey(2026), '04-06');
assert.equal(totalsModule.isHoliday(new Date(2026, 3, 6, 12)), true);
const april = calc.compute([day('2026-04-06', 'D1'), day('2026-04-07', 'D1'), day('2026-04-25', 'D1', { holidayWorked: false }), day('2026-04-12', 'D1', { holidayWorked: true })], '2026-04');
assert.equal(april.totals.holiday, 2);
assert.equal(april.totals.sundayShift, 1, '12/04/2026 e\' domenica');

// --- Parita' con navidiaria-monthly.js (summarizedTotal + correzione di sw.js) ---
{
  const monthly = read('assets/js/navidiaria-monthly.js');
  const sw = read('sw.js');
  const fix = /text = text\.replace\(\s*("function baseWorkedMinutes[^\n]*"),\s*\n\s*("function baseWorkedMinutes[^\n]*")\s*\);/.exec(sw);
  assert.ok(fix, 'correzione di baseWorkedMinutes in sw.js');
  const [from, to] = [JSON.parse(fix[1]), JSON.parse(fix[2])];
  assert.ok(monthly.includes(from), 'la correzione di sw.js si applica ancora a navidiaria-monthly.js');
  const start = monthly.indexOf('const monthFmt');
  const end = monthly.indexOf('function weeklyTotal', start);
  const body = monthly.slice(start, end).replace(from, to);
  const document = { getElementById: () => ({ value: '2026-08' }) };
  const factory = new Function('window', 'document', 'entries', 'shiftFor', `${body}; return {summarizedTotal, competencePeriod, entriesInWeek};`);
  const original = factory({ NaviOvertimeComponents: overtime }, document, entries, calc.shiftFor);
  const period = original.competencePeriod();
  const groups = period.weeks.map(week => original.entriesInWeek(week.end));
  const clock = v => { const m = Math.max(0, Math.round(Number(v) || 0)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const signedClock = v => { const n = Math.round(Number(v) || 0); return (n < 0 ? '-' : '') + clock(Math.abs(n)); };
  const expected = {
    hours: t.workedMinutes ? clock(t.workedMinutes) : '',
    overtime: t.overtimeMinutes ? clock(t.overtimeMinutes) : '',
    bank: t.bankMinutes ? signedClock(t.bankMinutes) : '',
    ticket: t.ticketDue ? String(t.ticketDue - t.ticketUsed) : '',
    allowance9: t.allowance9 || '', allowance24: t.allowance24 || '', allowance50: t.allowance50 || '',
    overnight40: t.overnight40 || '', holiday: t.holiday || '', sundayShift: t.sundayShift || '',
    'second-ticket': t.secondMeal || '', embark: t.embark || '', cashHandling: t.cashHandling || '',
    hydrofoil: t.hydrofoil || '', rf: t.rf || ''
  };
  Object.entries(expected).forEach(([key, value]) => assert.equal(original.summarizedTotal({ key }, groups), value, `riga ${key}`));
}

// Riporto (colonna RIP): i giorni di luglio nella prima settimana di agosto contano per lo straordinario
// settimanale ma non per le giornate, gia' pagate con la busta precedente.
{
  const all = result.totals, mese = result.totals.calendar;
  assert.equal(all.embark, 4 + (all.embark - 4), 'le settimane comprendono i giorni di luglio');
  assert.ok(all.embark > mese.embark, 'imbarco di luglio fuori dal mese');
  assert.equal(mese.embark, 0);
  assert.equal(mese.workedDays, all.workedDays - 4 + 1, 'fuori i 4 giorni di luglio, dentro il 31 agosto dopo l\'ultima domenica');
  const cmp = compareModule.compare({ voci: [{ code: '43X', description: 'Ind. imbarco', quantity: 0, base: 2, figurative: null, amount: 0 }] }, all);
  assert.equal(cmp.rows.find(r => r.id === 'embark').status, 'ok', 'imbarco: 0 in busta = 0 nel mese, il riporto non conta');
}

// Giorni dopo l'ultima domenica: lo straordinario giornaliero si liquida nel mese (luglio 2026: lunedi' 27 con 3:45).
{
  const luglio = calc.compute([day('2026-07-27', 'D1', { overtimeComponents: { ordinario: 225, cambi: 0, sentine: 0 }, allowanceRate: 24 }), day('2026-07-20', 'D1', { allowanceRate: 24 })], '2026-07');
  assert.equal(luglio.totals.overtimeTailMinutes, 225);
  assert.equal(luglio.totals.overtimeMinutes, 225);
  assert.equal(luglio.totals.calendar.allowance24, 2, 'il 27 luglio conta a luglio');
}

// --- Confronto busta <-> Distinta ---
const compareTotals = { ...t, calendar: undefined, overtimeMinutes: 10 * 60 + 30, embark: 20, sundayShift: 5, cashHandling: 3, cashHandlingGround: 5, holiday: 1, holidayMinutes: 60, secondMeal: 0, missedRestMinutes: 0, cashEmbarkServiceMinutes: 0, overtime139Minutes: 0, overtimeMixedWeeks: 0, overnight40: 2, bankMinutes: 181, allowance24: 16, ticketCredit: 10 };
const outcome = compareModule.compare(busta, compareTotals);
const row = id => outcome.rows.find(entry => entry.id === id);
assert.equal(row('overtime').status, 'ok');
assert.equal(row('bank').status, 'ok', 'banca ore entro ~1 minuto (3,00 h vs 3h01)');
assert.equal(row('allowance24').busta, 16, '18X + 28Y sommate');
assert.equal(row('allowance24').status, 'ok');
assert.equal(row('sunday').status, 'diff');
assert.equal(row('sunday').diff, 1);
assert.equal(row('sunday').euro, 10);
assert.equal(row('sunday').euroText, 'In busta mancano circa 10,00 €');
assert.equal(row('ticket').status, 'check', '1TK va solo verificato');
assert.equal(row('ticket').busta, 12, 'dato figurativo');
assert.equal(row('ticket').euro, null);
assert.equal(outcome.rows[0].status, 'diff', 'prima le differenze');
assert.deepEqual(outcome.rows.map(entry => entry.status), [...outcome.rows.map(entry => entry.status)].sort((a, b) => ({ diff: 0, check: 1, ok: 2 }[a] - { diff: 0, check: 1, ok: 2 }[b])));
assert.deepEqual(outcome.summary, { ok: 8, diff: 1, check: 1, notCompared: 1 });
assert.deepEqual(outcome.notCompared.map(voce => voce.code).sort(), ['FD0']);
assert.equal(row('holiday').busta, 1, '013 lavoro in FI-FN = festivita\'');
assert.equal(row('dailyDM').status, 'ok', '49X = giorni con maneggio denaro');
// Riepilogo piatto Match/Mismatch
const flat = compareModule.confronta(compareTotals, busta.voci);
assert.equal(flat.find(r => r.codici === '47X').stato, 'Mismatch');
assert.equal(flat.find(r => r.codici === '47X').differenza, 1);
assert.equal(flat.find(r => r.codici === '43X').stato, 'Match');
assert.ok(outcome.notCompared.every(voce => voce.reason === 'La Distinta non ha una riga equivalente.'));
// Straordinario in piu' in busta: importo negativo.
const overpaid = compareModule.compare(busta, { ...compareTotals, overtimeMinutes: 9 * 60 });
assert.equal(overpaid.rows.find(entry => entry.id === 'overtime').euro, -22.5);
assert.equal(overpaid.rows.find(entry => entry.id === 'overtime').euroText, 'In busta ci sono circa 22,50 € in più');
// Tolleranza del 10%: 10 h in Distinta contro 10,5 h in busta (4,8%) e' coerente, con una nota.
const tollerata = compareModule.compare(busta, { ...compareTotals, overtimeMinutes: 10 * 60 }).rows.find(entry => entry.id === 'overtime');
assert.equal(tollerata.status, 'ok');
assert.match(tollerata.notes.join(' '), /tolleranza del 10%/);
// Voce assente in busta ma presente nella Distinta, e viceversa; assente in entrambe: nessuna riga.
const noEmbark = compareModule.compare({ voci: busta.voci.filter(voce => voce.code !== '43X') }, compareTotals);
assert.equal(noEmbark.rows.find(entry => entry.id === 'embark').missing, 'busta');
assert.equal(noEmbark.rows.find(entry => entry.id === 'embark').status, 'diff');
assert.match(noEmbark.rows.find(entry => entry.id === 'embark').notes.join(' '), /assente in busta/);
const noCash = compareModule.compare(busta, { ...compareTotals, cashHandlingGround: 0 });
assert.equal(noCash.rows.find(entry => entry.id === 'cash').missing, 'distinta');
const neither = compareModule.compare({ voci: busta.voci.filter(voce => voce.code !== 'FC0') }, { ...compareTotals, cashHandlingGround: 0 });
assert.equal(neither.rows.find(entry => entry.id === 'cash'), undefined);

// --- Maneggio denaro: parametro 139 da imbarcato, FC0 a terra ---
assert.equal(t.cashHandlingGround, 0, 'il 30/07 il maneggio e\' da imbarcato');
assert.equal(t.cashHandlingEmbark, 1);
assert.equal(t.cashEmbarkServiceMinutes, 13 * 60, 'ore del turno, senza straordinario');
assert.equal(t.overtime139Minutes, 0, 'settimana mista: non si sa quale parte e\' a 139');
assert.equal(t.overtimeMixedWeeks, 1);
{
  const cashWeek = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'].map(date => day(date, 'D1', { cashHandling: true, embark: true }));
  const ground = day('2026-08-18', 'LAV', { cashHandling: true, embark: false });
  const week = calc.compute([...cashWeek, ground], '2026-08').totals;
  assert.equal(week.overtime139Minutes, 13 * 60, 'settimana tutta con maneggio da imbarcato: straordinario a 139');
  assert.equal(week.overtimeMixedWeeks, 0);
  assert.equal(week.cashEmbarkServiceMinutes, 4 * 13 * 60);
  assert.equal(week.cashHandlingGround, 1);
  assert.equal(calc.compute(cashWeek, '2026-08').period.weeks[2].cash139Days, 4);
}
{
  const extra = [
    { code: '01Y', description: 'D.P.lav.str. Qu.139B', quantity: 13, base: 1.5, figurative: null, amount: 19.5 },
    { code: '55Y', description: 'D.P. Ore diff.paga 139B', quantity: 52, base: 0.5, figurative: null, amount: 26 },
    { code: '56Y', description: 'Ore diff.paga altra', quantity: 3, base: 1, figurative: null, amount: 3 }
  ];
  const totals139 = { ...compareTotals, overtime139Minutes: 12 * 60, cashEmbarkServiceMinutes: 52 * 60 };
  const with139 = compareModule.compare({ voci: [...busta.voci, ...extra] }, totals139);
  const find = id => with139.rows.find(entry => entry.id === id);
  // 01Y (parametro 139) e 334 (parametro 121) sono ore diverse: si sommano.
  assert.equal(find('overtime').busta, 23.5, '01Y + 334');
  assert.equal(find('overtime').status, 'diff');
  assert.match(find('overtime').notes.join(' '), /10,5 h a parametro 121 \(334\) \+ 13 h a parametro 139 \(01Y\)/);
  assert.equal(compareModule.compare({ voci: [...busta.voci, ...extra] }, { ...totals139, overtimeMinutes: 23.5 * 60 }).rows.find(entry => entry.id === 'overtime').status, 'ok');
  assert.equal(find('cashEmbark').busta, 52, 'solo le ore differenza paga a 139');
  assert.equal(find('cashEmbark').status, 'ok');
  assert.deepEqual(with139.notCompared.map(voce => voce.code).sort(), ['56Y', 'FD0']);
}

// Diarie in busta = diarie 24% + trasferte 50% (luglio 2026: 15 + 1 = 16 in busta di agosto).
assert.equal(compareModule.compare(busta, { ...compareTotals, allowance24: 15, travel50: 1 }).rows.find(r => r.id === 'allowance24').distinta, 16);

// --- Coerenza interna ---
const coherence = outcome.coherence;
assert.ok(coherence.length >= 8);
assert.ok(coherence.every(entry => entry.ok), 'busta sintetica coerente');
assert.ok(!coherence.some(entry => entry.code === 'C01'), 'contributi esclusi');
const wrong = compareModule.coherence([{ code: 'X01', description: 'Voce errata', quantity: 3, base: 10, amount: 34 }, { code: 'X02', description: 'Voce entro tolleranza', quantity: 3, base: 3.333, amount: 10 }, { code: 'IR2', description: 'IRPEF', quantity: 1, base: 1, amount: -99 }]);
assert.equal(wrong.length, 2);
assert.equal(wrong[0].ok, false);
assert.equal(wrong[0].difference, 4, 'oltre il 10%');
assert.equal(wrong[1].ok, true);

// --- La pagina carica tutti gli script, nell'ordine giusto ---
{
  const html = read('verifica-busta.html');
  const scripts = [...html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/g)].map(match => match[1]);
  scripts.forEach(src => assert.ok(fs.existsSync(path.join(root, src)), `script mancante: ${src}`));
  const order = ['assets/js/admin-firebase-rest.js', 'assets/js/overtime-components.js', 'assets/js/shift-competence.js', 'vendor/pdfjs/pdf.min.js', 'assets/js/busta-parser.js', 'assets/js/distinta-totals.js', 'assets/js/busta-compare.js', 'assets/js/verifica-busta.js'];
  order.forEach(src => assert.ok(scripts.includes(src), `manca ${src}`));
  for (let index = 1; index < order.length; index += 1) assert.ok(scripts.indexOf(order[index - 1]) < scripts.indexOf(order[index]), `${order[index - 1]} prima di ${order[index]}`);
  assert.match(read('navidiaria.html'), /<button id="monthlyVerifyPayslip" class="monthly-today-button"[^>]*verifica-busta\.html[^>]*>Verifica busta<\/button>/);
  const sw = read('sw.js');
  ['./verifica-busta.html', './assets/js/busta-parser.js', './assets/js/distinta-totals.js', './assets/js/busta-compare.js', './assets/js/verifica-busta.js'].forEach(asset => assert.ok(sw.includes(`'${asset}'`), `sw.js: ${asset}`));
}

console.log('Busta verifica test passed');

// 55Y + 56Y: il valore e' la differenza paga netta (139 - 121), non il solo importo della 55Y.
{
  const voci = [
    { code: '55Y', description: 'D.P. Ore diff.paga 139B', quantity: 144.3333, base: 9.2202, figurative: null, amount: 1330.78 },
    { code: '56Y', description: 'Tratt.ore diff.paga', quantity: 144.3333, base: 8.34262, figurative: null, amount: -1204.12 }
  ];
  const r = compareModule.compare({ voci }, { cashEmbarkServiceMinutes: 128.08 * 60 }).rows.find(row => row.id === 'cashEmbark');
  assert.equal(r.importo, 126.66);
  assert.equal(r.importoDistinta, 112.4);
  assert.equal(r.euro, -14.26);
}

// 55Y: ore lavorate (con ritardi e straordinari) dei giorni con cassa a bordo, non solo le ore del turno.
{
  const giorno = calc.compute([day('2026-08-04', 'D1', { cashHandling: true, embark: true, overtimeComponents: { ordinario: 60, cambi: 0, sentine: 0 } })], '2026-08');
  assert.equal(giorno.totals.calendar.cashEmbarkServiceMinutes, 13 * 60 + 60);
}

// Tolleranza a scelta: 20 h contro 21 h passa al 10% e al 5%, non allo 0%.
{
  const voci = [{ code: '334', description: 'Prest.straordinarie', quantity: 21, base: 15, figurative: null, amount: 315 }];
  const stato = toll => compareModule.compare({ voci }, { overtimeMinutes: 1200 }, { tolleranza: toll }).rows.find(r => r.id === 'overtime').status;
  assert.equal(stato(0.10), 'ok');
  assert.equal(stato(0.05), 'ok');
  assert.equal(stato(0), 'diff');
}

// Differenze trascurabili (sotto 1 ora o sotto 1 euro) sono coerenti anche con tolleranza zero.
{
  const voci = [{ code: '334', description: 'Prest.straordinarie', quantity: 61.25, base: 11.56, figurative: null, amount: 708.21 },
    { code: '49X', description: 'Ind. prest. giornaliera', quantity: 15, base: 0.52, figurative: null, amount: 7.8 }];
  const rows = compareModule.compare({ voci }, { overtimeMinutes: 61.17 * 60, cashHandling: 16 }, { tolleranza: 0 }).rows;
  assert.equal(rows.find(r => r.id === 'overtime').status, 'ok', '5 minuti');
  assert.match(rows.find(r => r.id === 'overtime').notes.join(' '), /trascurabile/);
  assert.equal(rows.find(r => r.id === 'dailyDM').status, 'ok', '1 giorno = 0,52 euro');
}
