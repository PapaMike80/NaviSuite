const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

['assets/js/movimento-corse.js', 'assets/js/movimento-core.js', 'assets/js/movimento.js', 'assets/js/movimento-agenti.js', 'assets/js/admin-firebase-rest.js']
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
['corse', 'navi', 'agenti'].forEach(tab => assert.ok(html.includes(`data-tab="${tab}"`) && html.includes(`data-panel="${tab}"`), tab));
assert.ok(html.indexOf('id="mov-day-input"') < html.indexOf('data-panel="corse"'), 'selettore giornata sopra i tab');
['shared-data.js', 'turni-giorno.js', 'servizi-terra-a4.js', 'orario-giorno.js', 'course-info.js', 'movimento-core.js', 'movimento.js', 'movimento-corse.js', 'movimento-agenti.js']
  .forEach(script => assert.ok(html.includes(script), script));
assert.ok(html.indexOf('movimento-corse.js') > html.indexOf('orario-giorno.js'));
const page = fs.readFileSync('assets/js/movimento-corse.js', 'utf8');
assert.match(fs.readFileSync('assets/js/movimento-core.js', 'utf8'), /isAdminAgent\(profile\)/);
['data-act="suspend"', 'data-act="confirm-suspend"', 'data-act="resume"', 'data-act="restore"', 'data-act="open"', 'data-act="add"', 'data-act="remove"', 'data-act="undo"']
  .forEach(act => assert.ok(page.includes(act), act));
assert.match(fs.readFileSync('assets/js/shared-menu.js', 'utf8'), /page==='movimento'\)&&!isAdminAgent\(sessionAgent\)/);
const css = fs.readFileSync('assets/css/movimento.css', 'utf8');
assert.strictEqual((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);

// Le altre pagine: ormeggio del mattino del Movimento e corse sospese
assert.match(fs.readFileSync('assets/js/orario-page.js', 'utf8'), /nave\.ormeggioMattino \|\| g\.ieri\[code\]\?\.ormeggio/);
assert.match(fs.readFileSync('assets/js/mio-turno.js', 'utf8'), /oggi\.ormeggioMattino \|\| ieri\.ormeggio/);
assert.match(fs.readFileSync('assets/js/orario-page.js', 'utf8'), /filter\(v => !navi\[v\.turno\]\?\.sospesa\)/);
// BIS: incarichi del giorno (al posto della nave di un turno, o in aiuto con corse aggiuntive)
const O = globalThis.NaviOrarioGiorno;
const incarichi = [{ tipo: 'sostituzione', turno: 'D1', dalla: '16', alla: '' }, { tipo: 'aiuto', turno: 'P2', dalla: '32', alla: '33' }];
assert.deepStrictEqual(O.corseIncarico(incarichi[0], day).map(c => c.numero), ['16', '17', '18', '19'], 'fino a nuovo ordine');
assert.deepStrictEqual(O.corseIncarico({ ...incarichi[0], alla: '17' }, day).map(c => c.numero), ['16', '17'], 'la nave riprende dalla 18');
assert.deepStrictEqual(O.corseBis(incarichi, day).map(c => `${c.numero}/${c.per}/${c.tipo}`),
  ['16/D1/sostituzione', '32/P2/aiuto', '33/P2/aiuto', '17/D1/sostituzione', '18/D1/sostituzione', '19/D1/sostituzione']);
assert.strictEqual(O.bisPerCorsa(incarichi, 'D1', '15', day), null);
assert.strictEqual(O.bisPerCorsa(incarichi, 'D1', '17', day).dalla, '16');
assert.strictEqual(O.bisPerCorsa(incarichi, 'P2', '32', day), null, 'in aiuto la P2 fa comunque la sua corsa');
assert.deepStrictEqual(O.viaggiBis(incarichi, day).map(v => [v.turno, v.corse]), [['BIS', ['32', '33']]]);
const bisRow = { data: day, corsa: 'BIS', nave: 'BRESCIA', fonte: 'movimento', attiva: true, incarichi };
assert.deepStrictEqual(T.turniDelGiorno([bisRow], day).BIS.incarichi, incarichi);
// Notifiche: le corse al posto della nave hanno nave e comandante del BIS; quelle in aiuto sono arrivi in piu'
const dataBis = { residenze: { DESENZANO: [{ id: '4', agente: 'NERI', turni: { [day]: 'POND' } }, { id: '7', agente: 'MORO', qualifica: 'capitano', turni: { [day]: 'BIS' } }] },
  turni_navi: [bisRow, { data: day, corsa: 'D1', nave: 'S. MARCO', ods: 'ODS 39/2026' }] };
const lista = A.notifiche(dataBis, '4', day);
assert.strictEqual(lista.find(n => n.run === '17').title, 'D1 · BIS BRESCIA arriva alle 16.55');
assert.match(lista.find(n => n.run === '17').body, /Comandante MORO/);
assert.strictEqual(lista.find(n => n.run === '15').title, 'D1 S. MARCO arriva alle 9.55');
assert.ok(lista.some(n => n.code === 'BIS' && n.run === '33' && /in aiuto alla P2/.test(n.body)));
assert.ok(lista.some(n => n.code === 'P2' && n.run === '33'));
assert.match(rest, /incarichi:\(Array\.isArray\(values\.incarichi\)/);
['data-act="bis-add"', 'data-act="bis-riprende"', 'data-act="bis-del"', 'data-act="bis-form"'].forEach(act => assert.ok(page.includes(act), act));
// Ritardi per corsa: orari spostati; il ritardo passa alle corse dopo quanto la nave arriva tardi
const conRit = rit => O.corseDelTurno('D1', day, rit).map(c => `${c.numero} ${c.scali[0][1]} ${O.testoRitardo(c.ritardo)}${c.ritardo?.propagato ? '*' : ''}`.trim());
assert.deepStrictEqual(conRit({ 14: { minuti: 25 } }), ["14 9.40 +25'", "15 10.00 +25'*", "16 10.20 +15'*", '17 14.00', '18 17.05', '19 18.35']);
assert.deepStrictEqual(conRit({ 16: { minuti: 120, oltre: true } }).slice(2, 4), ['16 12.05 oltre 2 ore', "17 15.00 +1h*"]);
assert.strictEqual(O.testoRitardo({ minuti: 65 }), "+1h 05'");
const ritRow = { data: day, corsa: 'D1', fonte: 'movimento', attiva: true, nave: 'S. MARCO', ritardi: [{ corsa: '15', minuti: 20 }, { corsa: '17', minuti: 120, oltre: true }] };
assert.deepStrictEqual(T.turniDelGiorno([ritRow], day).D1.ritardi, { 15: { minuti: 20, oltre: false }, 17: { minuti: 120, oltre: true } });
assert.deepStrictEqual(O.ritardiDelGiorno(T.turniDelGiorno([ritRow], day)), { D1: { 15: { minuti: 20, oltre: false }, 17: { minuti: 120, oltre: true } } });
// notifica spostata con l'arrivo, nuovo tag con il ritardo
const conRitardo = A.notifiche({ ...data, turni_navi: [ritRow] }, '4', day);
const n15 = conRitardo.find(n => n.run === '15');
assert.strictEqual(n15.title, "D1 S. MARCO arriva alle 10.15 (+20')");
assert.strictEqual(n15.quando, '10.05');
assert.match(n15.tag, /-15-r20$/);
assert.match(rest, /ritardi:\(Array\.isArray\(values\.ritardi\)/);
assert.ok(page.includes('data-act="ritardo"'));
console.log('movimento ok');
