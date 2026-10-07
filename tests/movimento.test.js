const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

['assets/js/movimento-corse.js', 'assets/js/admin-firebase-rest.js']
  .forEach(file => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }));

globalThis.window = globalThis;
globalThis.NaviCourseInfo = require('../assets/js/course-info.js');
['orario-corse', 'servizi-terra-a4', 'turni-giorno', 'orario-giorno'].forEach(file => require(`../assets/js/${file}.js`));
const A = require('../assets/js/push-arrivi.js');
const T = globalThis.NaviServiziTerra;

// La riga dell'Ufficio Movimento vince sull'O.d.S. (anche piu' recente) e porta ormeggio del mattino
// e sospensione; le righe O.d.S. sostituite restano salvate ma non attive.
const day = '2026-10-07';
const ods = { data: day, corsa: 'D1', nave: 'AGONE', ormeggio_serale: 'pont. 3', ods: 'ODS 40/2026', inserita_il: '2026-10-09' };
const mov = { data: day, corsa: 'D1', nave: 'S. MARCO', ormeggio_mattino: 'pontile 5', ormeggio_serale: 'pontile 4', rifornimento_mattina: 'Sì',
  sospesa: true, sospesa_motivo: 'lago mosso', ods: 'MOVIMENTO', fonte: 'movimento', attiva: true, inserita_il: '2026-10-07T08:00:00Z' };
assert.deepStrictEqual(T.turniDelGiorno([mov, ods], day).D1,
  { nave: 'S. MARCO', ormeggio: 'pontile 4', rif: true, ormeggioMattino: 'pontile 5', sospesa: true, motivo: 'lago mosso', movimento: true });
assert.strictEqual(T.turniDelGiorno([{ ...ods, attiva: false, sostituita_da_movimento: true }], day).D1, undefined);
assert.strictEqual(T.turniDelGiorno([ods], day).D1.nave, 'AGONE');
// sospesa senza nave: c'e' comunque
assert.strictEqual(T.turniDelGiorno([{ data: day, corsa: 'P2', fonte: 'movimento', sospesa: true }], day).P2.sospesa, true);

// Corse sospese: niente notifiche degli arrivi
const data = { residenze: { DESENZANO: [{ id: '4', agente: 'NERI', turni: { [day]: 'POND' } }] }, turni_navi: [] };
assert.ok(A.notifiche(data, '4', day).some(n => n.code === 'D1'));
assert.ok(!A.notifiche({ ...data, turni_navi: [mov] }, '4', day).some(n => n.code === 'D1'));

// Firebase: salvataggi mirati dell'Ufficio Movimento
const rest = fs.readFileSync('assets/js/admin-firebase-rest.js', 'utf8');
['saveTurnoNaveMovimento', 'ripristinaTurnoNave', 'saveVariazioneMovimento'].forEach(name => assert.match(rest, new RegExp(`\\n    ${name},`), name));
assert.match(rest, /sostituita_da_movimento:true/);
assert.match(rest, /ods:"MOVIMENTO", tipo:"MANUALE"/);

// Pagina Movimento: solo admin, corse del giorno sopra l'anagrafica navi, script e stili
const html = fs.readFileSync('movimento.html', 'utf8');
assert.ok(html.indexOf('id="mov-corse"') < html.indexOf('id="fleet-table"'));
['shared-data.js', 'turni-giorno.js', 'servizi-terra-a4.js', 'orario-giorno.js', 'course-info.js', 'movimento.js', 'movimento-corse.js']
  .forEach(script => assert.ok(html.includes(script), script));
assert.ok(html.indexOf('movimento-corse.js') > html.indexOf('orario-giorno.js'));
const page = fs.readFileSync('assets/js/movimento-corse.js', 'utf8');
assert.match(page, /isAdminAgent\(profile\)/);
['data-act="suspend"', 'data-act="confirm-suspend"', 'data-act="resume"', 'data-act="restore"', 'data-act="open"', 'data-act="add"', 'data-act="remove"', 'data-act="undo"']
  .forEach(act => assert.ok(page.includes(act), act));
assert.match(fs.readFileSync('assets/js/shared-menu.js', 'utf8'), /page==='movimento'\)&&!isAdminAgent\(sessionAgent\)/);
const css = fs.readFileSync('assets/css/movimento.css', 'utf8');
assert.strictEqual((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);

// Le altre pagine: ormeggio del mattino del Movimento e corse sospese
assert.match(fs.readFileSync('assets/js/servizi-terra-page.js', 'utf8'), /turni\[code\]\?\.ormeggioMattino \|\| ieri\[code\]\?\.ormeggio/);
assert.match(fs.readFileSync('assets/js/mio-turno.js', 'utf8'), /oggi\.ormeggioMattino \|\| ieri\.ormeggio/);
assert.match(fs.readFileSync('assets/js/orario-page.js', 'utf8'), /filter\(v => !navi\[v\.turno\]\?\.sospesa\)/);
console.log('movimento ok');
