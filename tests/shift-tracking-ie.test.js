const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

// 1. Verifica categorizzazione "IE" come servizio a terra
require('../assets/js/turni-giorno.js');
const G = globalThis.NaviTurniGiorno;

assert.strictEqual(G.SIGLE_TERRA.IE, 'IE', 'IE deve essere in SIGLE_TERRA');
assert.strictEqual(G.terraCode('IE'), 'IE', 'terraCode("IE") deve restituire "IE"');
assert.strictEqual(G.terraCode('ie'), 'IE', 'terraCode("ie") case-insensitive deve restituire "IE"');
assert.strictEqual(G.terraResidenza('IE'), 'PESCHIERA', 'terraResidenza("IE") deve restituire PESCHIERA');
assert.strictEqual(G.naveCode('IE'), '', 'IE non deve essere categorizzato come turno nave/bordo');

// Verifica in movimento-corse.js
const movJs = fs.readFileSync('assets/js/movimento-corse.js', 'utf8');
assert.match(movJs, /\['IE',\s*'PESCHIERA'\]/, 'movimento-corse.js deve contenere ["IE", "PESCHIERA"] in SERVIZI_TERRA');

// Verifica in distinta-totals.js
const distintaJs = fs.readFileSync('assets/js/distinta-totals.js', 'utf8');
assert.match(distintaJs, /'IE'/, 'distinta-totals.js deve includere IE in GROUND_SHIFTS');

// Verifica in day-popup.js
const popupJs = fs.readFileSync('assets/js/day-popup.js', 'utf8');
assert.match(popupJs, /IE/, 'day-popup.js deve includere IE nei servizi a terra');

// Verifica in navidistinta-app.js e app.js
const navidistintaJs = fs.readFileSync('assets/js/navidistinta-app.js', 'utf8');
assert.match(navidistintaJs, /'IE'/, 'navidistinta-app.js deve includere IE in GROUND_SHIFTS');

const appJs = fs.readFileSync('assets/js/app.js', 'utf8');
assert.match(appJs, /'IE'/, 'app.js deve includere IE in GROUND_SHIFTS');

// Verifica in naviturni-page.js e cambi-turno-page.js
const naviturniJs = fs.readFileSync('assets/js/naviturni-page.js', 'utf8');
assert.match(naviturniJs, /PESCHIERA:\s*\[.*"IE".*\]/, 'naviturni-page.js deve includere IE a Peschiera');

const cambiJs = fs.readFileSync('assets/js/cambi-turno-page.js', 'utf8');
assert.match(cambiJs, /PESCHIERA:\s*\[.*"IE".*\]/, 'cambi-turno-page.js deve includere IE a Peschiera');

// 2. Verifica struttura dati e logica tracciamento/ripristino
// Test factory creaTurno
const baseShiftData = { turno: 'D1', residenza: 'DESENZANO', qualifica: 'marinaio' };
const shift = G.creaTurno(baseShiftData);

assert.strictEqual(shift.isModified, false, 'isModified iniziale deve essere false');
assert.strictEqual(shift.modifiedBy, null, 'modifiedBy iniziale deve essere null');
assert.deepStrictEqual(shift.originalShift, baseShiftData, 'originalShift deve contenere la copia backup iniziale');

// updateShift con ODs
shift.updateShift({ turno: 'IE' }, 'ODs');
assert.strictEqual(shift.turno, 'IE', 'turno deve essere aggiornato a IE');
assert.strictEqual(shift.isModified, true, 'isModified deve essere true dopo updateShift');
assert.strictEqual(shift.modifiedBy, 'ODs', 'modifiedBy deve essere ODs');
assert.strictEqual(shift.originalShift.turno, 'D1', 'originalShift non deve essere sovrascritto');

// restoreOriginalShift
shift.restoreOriginalShift();
assert.strictEqual(shift.turno, 'D1', 'turno deve essere ripristinato a D1');
assert.strictEqual(shift.isModified, false, 'isModified deve essere false dopo restoreOriginalShift');
assert.strictEqual(shift.modifiedBy, null, 'modifiedBy deve essere null dopo restoreOriginalShift');

// updateShift con Movimento
shift.updateShift({ turno: 'T1' }, 'Movimento');
assert.strictEqual(shift.turno, 'T1');
assert.strictEqual(shift.isModified, true);
assert.strictEqual(shift.modifiedBy, 'Movimento');

shift.restoreOriginalShift();
assert.strictEqual(shift.turno, 'D1');
assert.strictEqual(shift.isModified, false);
assert.strictEqual(shift.modifiedBy, null);

// updateShift con Utente
shift.updateShift('RIP', 'Utente');
assert.strictEqual(shift.turno, 'RIP');
assert.strictEqual(shift.isModified, true);
assert.strictEqual(shift.modifiedBy, 'Utente');

shift.restoreOriginalShift();
assert.strictEqual(shift.turno, 'D1');
assert.strictEqual(shift.isModified, false);
assert.strictEqual(shift.modifiedBy, null);

// Test turnoAgente con tracciamento variazioni
const day = '2026-10-06';
const scheduleData = {
  residenze: {
    PESCHIERA: [
      { id: '10', agente: 'ROSSI', qualifica: 'marinaio', turni: { [day]: 'IE' } }
    ],
    DESENZANO: [
      { id: '20', agente: 'BIANCHI', qualifica: 'capitano', turni: { [day]: 'D1' } }
    ]
  },
  variazioni_ods: [
    { data: day, id_agente: '20', turno_nuovo: 'D2' }
  ]
};

// Turno base non modificato
const tRossi = G.turnoAgente(scheduleData, { id: '10' }, day);
assert.strictEqual(tRossi.turno, 'IE');
assert.strictEqual(tRossi.isModified, false);
assert.strictEqual(tRossi.modifiedBy, null);
assert.strictEqual(tRossi.originalShift.turno, 'IE');

// Turno con variazione ODS
const tBianchi = G.turnoAgente(scheduleData, { id: '20' }, day);
assert.strictEqual(tBianchi.turno, 'D2');
assert.strictEqual(tBianchi.isModified, true);
assert.strictEqual(tBianchi.modifiedBy, 'ODs');
assert.strictEqual(tBianchi.originalShift.turno, 'D1');

// Ripristino del turno modificato da ODS
tBianchi.restoreOriginalShift();
assert.strictEqual(tBianchi.turno, 'D1');
assert.strictEqual(tBianchi.isModified, false);
assert.strictEqual(tBianchi.modifiedBy, null);

// Turno modificato dall'utente (modifiche manuali / diaria)
G.setModifiche(new Map([[`10|${day}`, 'P1']]));
const tRossiMod = G.turnoAgente(scheduleData, { id: '10' }, day);
assert.strictEqual(tRossiMod.turno, 'P1');
assert.strictEqual(tRossiMod.isModified, true);
assert.strictEqual(tRossiMod.modifiedBy, 'Utente');
assert.strictEqual(tRossiMod.originalShift.turno, 'IE');

tRossiMod.restoreOriginalShift();
assert.strictEqual(tRossiMod.turno, 'IE');
assert.strictEqual(tRossiMod.isModified, false);
assert.strictEqual(tRossiMod.modifiedBy, null);

G.setModifiche(new Map());

// 3. Verifica elementi UI in mio-turno.html
const html = fs.readFileSync('mio-turno.html', 'utf8');
assert.match(html, /id="turno-modified-bar"/, 'mio-turno.html deve avere id="turno-modified-bar"');
assert.match(html, /id="turno-modified-badge"/, 'mio-turno.html deve avere id="turno-modified-badge"');
assert.match(html, /id="turno-restore-btn"/, 'mio-turno.html deve avere id="turno-restore-btn"');
assert.match(html, /Ripristina turno originale/, 'mio-turno.html deve avere pulsante "Ripristina turno originale"');

// Verifica integrazione in mio-turno.js
const mioTurnoJs = fs.readFileSync('assets/js/mio-turno.js', 'utf8');
assert.match(mioTurnoJs, /updateShift/, 'mio-turno.js deve definire updateShift');
assert.match(mioTurnoJs, /restoreOriginalShift/, 'mio-turno.js deve definire restoreOriginalShift');
assert.match(mioTurnoJs, /Modificato da:/, 'mio-turno.js deve mostrare "Modificato da: "');
assert.match(mioTurnoJs, /originalShift/, 'mio-turno.js deve gestire originalShift nello stato');
assert.match(mioTurnoJs, /isModified/, 'mio-turno.js deve gestire isModified nello stato');
assert.match(mioTurnoJs, /modifiedBy/, 'mio-turno.js deve gestire modifiedBy nello stato');

console.log('shift-tracking-ie ok');
