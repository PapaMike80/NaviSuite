const assert = require('assert');
global.window = {};
require('../assets/js/course-info.js');
window.NaviCourseInfo = global.NaviCourseInfo;
require('../assets/js/collegamenti-dati.js');
global.localStorage = { getItem: () => null, setItem: () => {} };
require('../assets/js/collegamenti.js');
const C = window.NaviCollegamenti;
// 15/10/2026 giovedi': orario invernale
assert.strictEqual(C.stagioneDel('2026-10-15'), 'invernale');
assert.strictEqual(C.stagioneDel('2027-07-01'), 'estivo');
assert.ok(C.festivo(new Date('2026-11-01T12:00:00')));
// Riva -> Maderno entro le 7:10: LN027 delle 05:40
r = C.cerca('Riva', 'Maderno', '2026-10-15', 7 * 60 + 10);
assert.strictEqual(r.validi[0].parte, 5 * 60 + 40);
assert.strictEqual(r.validi[0].arriva, 6 * 60 + 37);
// Maderno -> Desenzano con cambio a Salo'
r = C.cerca('Maderno', 'Desenzano', '2026-10-15', 20 * 60);
assert.ok(r.validi.length && r.validi[0].tratte.length === 2);
const t = C.leggiTabella('giorni;FER;FEST\nA;06:50;\nB;07:32;08:00');
assert.deepStrictEqual(t.giorni, ['FER', 'FEST']);
assert.strictEqual(t.fermate[0].orari[1], null);
const fs = require('fs');
const menu = fs.readFileSync('assets/js/shared-menu.js', 'utf8');
assert.match(menu, /\['collegamenti\.html','⇆','Collegamenti'\]\]:\[\]/);
assert.match(menu, /page==='collegamenti'\|\|page==='movimento'\)&&!isAdminAgent/);
console.log('collegamenti ok');
// LN007 (porto) + RL202 a Salo': Maderno alle 07:08
r = C.cerca('Desenzano', 'Maderno', '2026-10-15', 7 * 60 + 10);
assert.strictEqual(r.validi[0].arriva, 7 * 60 + 8);
assert.deepStrictEqual(r.validi[0].tratte.map(t => t.sale.linea.id), ['ln007-a', 'rl202-a']);
// sabato la LN007 di scuola vale, la domenica no
assert.strictEqual(C.cerca('Desenzano', 'Maderno', '2026-10-18', 7 * 60 + 10).validi.length, 0);
// dati salvati vecchi: le linee di base si aggiornano, quelle a mano restano
const vecchi = { versione: 1, stagioni: { invernale: { nome: 'Invernale', dal: '2026-10-12', linee: [{ id: 'mia', nome: 'Mia', tipo: 'bus', testo: '' }] } } };
const nuovi = C.aggiorna(vecchi);
assert.ok(nuovi.stagioni.invernale.linee.some(l => l.id === 'mia') && nuovi.stagioni.invernale.linee.some(l => l.id === 'rl202-a'));
console.log('collegamenti 2 ok');

// Test cercaTurno Maderno -> Desenzano (PonD 09:30 - 19:50)
const tTurno = C.cercaTurno({ casa: 'Maderno', turnoResidenza: 'Desenzano', iso: '2026-10-28', inizio: '09:30', fine: '19:50' });
assert.ok(tTurno && tTurno.fattibile);
assert.strictEqual(C.ora(tTurno.andata.parte), '07:37');
assert.strictEqual(C.ora(tTurno.andata.arriva), '08:59');
assert.strictEqual(C.ora(tTurno.ritorno.parte), '20:00');
assert.strictEqual(C.ora(tTurno.ritorno.arriva), '21:28');
assert.strictEqual(tTurno.competenze.trasferta, true);
assert.strictEqual(tTurno.competenze.diariaRate, 50);
assert.strictEqual(tTurno.competenze.pernottoPrima, false);
assert.strictEqual(tTurno.competenze.pernottoSera, false);
assert.strictEqual(tTurno.competenze.secondoTicket, true); // rientro 21:28 > 20:45

// Test competenze trasferta con pernotto la sera prima (inizio ore 05:00)
const tPrima = C.cercaTurno({ casa: 'Maderno', turnoResidenza: 'Desenzano', iso: '2026-10-28', inizio: '05:00', fine: '13:00' });
assert.strictEqual(tPrima.mancaAndata, true);
assert.strictEqual(tPrima.competenze.pernottoPrima, true);
assert.strictEqual(tPrima.competenze.pernottoSera, false);
assert.strictEqual(tPrima.competenze.secondoTicket, false);

// Test competenze trasferta con pernotto la sera del turno (fine ore 23:30, no rientro)
const tSera = C.cercaTurno({ casa: 'Maderno', turnoResidenza: 'Desenzano', iso: '2026-10-28', inizio: '09:30', fine: '23:30' });
assert.strictEqual(tSera.mancaRitorno, true);
assert.strictEqual(tSera.competenze.pernottoSera, true);
assert.strictEqual(tSera.competenze.secondoTicket, true);

// Test salvataggio competenze nella distinta (PonD a Desenzano da Maderno)
const entries = [];
const comp = tTurno.competenze;
const day = '2026-10-28';
let entry = { id: 'naviturni-' + day, date: day, shift: 'PonD', mealUsed: true, ticketPresence: true };
entry.travel = true;
entry.allowanceRate = comp.diariaRate;
if (comp.secondoTicket) entry.secondMeal = 1;
if (comp.pernottoSera) entry.overnight40 = true;
entries.push(entry);

assert.strictEqual(entry.allowanceRate, 50);
assert.strictEqual(entry.travel, true);
assert.strictEqual(entry.secondMeal, 1);
assert.strictEqual(entry.overnight40, undefined);

// Se pernotto la sera prima (tPrima), la giornata prima riceve overnight40
const ieriIso = '2026-10-27';
let entryIeri = { id: 'naviturni-' + ieriIso, date: ieriIso, shift: 'Riposo' };
if (tPrima.competenze.pernottoPrima) entryIeri.overnight40 = true;
assert.strictEqual(entryIeri.overnight40, true);

// Test collegamenti ferroviari Desenzano <-> Peschiera
const tTrenoDP = C.cerca('Desenzano', 'Peschiera', '2026-10-29', 8 * 60 + 30);
assert.ok(tTrenoDP.validi.length > 0);
assert.strictEqual(C.ora(tTrenoDP.validi[0].parte), '07:49');
assert.strictEqual(C.ora(tTrenoDP.validi[0].arriva), '07:58');
assert.strictEqual(tTrenoDP.validi[0].tratte[0].sale.linea.id, 'treno-dp');

const tTrenoPD = C.cerca('Peschiera', 'Desenzano', '2026-10-29', 8 * 60 + 30);
assert.ok(tTrenoPD.validi.length > 0);
assert.strictEqual(C.ora(tTrenoPD.validi[0].parte), '07:57');
assert.strictEqual(C.ora(tTrenoPD.validi[0].arriva), '08:06');
assert.strictEqual(tTrenoPD.validi[0].tratte[0].sale.linea.id, 'treno-pd');

// Test turno a Peschiera con residenza Desenzano (P1: 08:45 - 21:30)
const tTurnoPeschiera = C.cercaTurno({ casa: 'Desenzano', turnoResidenza: 'Peschiera', iso: '2026-10-29', inizio: '08:45', fine: '21:30' });
assert.ok(tTurnoPeschiera && tTurnoPeschiera.fattibile);
assert.strictEqual(C.ora(tTurnoPeschiera.andata.parte), '07:49');
assert.strictEqual(C.ora(tTurnoPeschiera.andata.arriva), '07:58');
assert.strictEqual(C.ora(tTurnoPeschiera.ritorno.parte), '21:57');
assert.strictEqual(C.ora(tTurnoPeschiera.ritorno.arriva), '22:06');
assert.strictEqual(tTurnoPeschiera.competenze.trasferta, true);
assert.strictEqual(tTurnoPeschiera.competenze.diariaRate, 50);
assert.strictEqual(tTurnoPeschiera.competenze.secondoTicket, true); // rientro 22:06 > 20:45
assert.strictEqual(tTurnoPeschiera.competenze.pernottoPrima, false);
assert.strictEqual(tTurnoPeschiera.competenze.pernottoSera, false);

// Test regola trasferta (30 min prima terra, 1h30 prima corsa)
const infoR1 = C.orariTurno('R1', '2026-10-28');
assert.strictEqual(infoR1.tipo, 'corsa');
assert.strictEqual(infoR1.inizio, '08:45');
assert.strictEqual(infoR1.arrivoRichiesto, '07:15'); // 1h 30m prima di 08:45
assert.strictEqual(infoR1.sede, 'Riva');

const infoPonD = C.orariTurno('PonD', '2026-10-28');
assert.strictEqual(infoPonD.tipo, 'terra');
assert.strictEqual(infoPonD.inizio, '09:30');
assert.strictEqual(infoPonD.arrivoRichiesto, '09:00'); // 30 min prima di 09:30
assert.strictEqual(infoPonD.sede, 'Desenzano');

// Calcolo competenze R1 per agente di Maderno: arrivo alle 07:15 non coperto da bus (primo alle 07:31) -> pernotto sera prima
const tR1 = C.calcolaCompetenzeTurno({ casa: 'Maderno', shift: 'R1', iso: '2026-10-28' });
assert.ok(tR1 && tR1.isTrasferta);
assert.strictEqual(tR1.competenze.pernottoPrima, true);

console.log('collegamenti treno desenzano-peschiera ok');
console.log('collegamenti turno ok');
