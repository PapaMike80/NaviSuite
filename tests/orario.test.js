const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

['assets/js/orario-giorno.js', 'assets/js/orario-page.js']
  .forEach(file => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }));

globalThis.window = globalThis;
globalThis.NaviCourseInfo = require('../assets/js/course-info.js');
require('../assets/js/orario-corse.js');
require('../assets/js/servizi-terra-a4.js');
require('../assets/js/orario-giorno.js');
const O = globalThis.NaviOrarioGiorno;

// Turni in servizio secondo l'O.d.S. 39/2026.
assert.ok(O.inServizio('SR1', '2026-10-11'));
assert.ok(!O.inServizio('SR1', '2026-10-12'));
assert.ok(!O.inServizio('D1', '2026-11-10'));
assert.ok(O.inServizio('T1', '2026-11-10'));
assert.ok(!O.inServizio('T1', '2026-12-25'));
assert.deepStrictEqual([...new Set(O.corseDelGiorno('2026-11-10').map(c => c.turno))], ['T1']);

// Corse del turno senza scali ripetuti e viaggi della nave (corse che proseguono unite).
const p2 = O.corseDelTurno('P2', '2026-10-06');
assert.deepStrictEqual(p2.find(c => c.numero === '31').scali[0], ['Garda', '9.25']);
const viaggi = O.viaggiDelTurno('P2', '2026-10-06');
assert.deepStrictEqual(viaggi.map(v => v.corse.join('+')), ['30+31+32+33+34', '35+36+37+38+39']);
assert.deepStrictEqual(viaggi[0].scali.slice(0, 4).map(s => s[0]), ['Peschiera', 'Lazise', 'Bardolino', 'Garda']);
const t1 = O.corseDelTurno('T1', '2026-10-06');
assert.deepStrictEqual(t1[0], { numero: '201', turno: 'T1', scali: [['Maderno', '8.10'], ['Torri', '8.40']] });

// Pagina Orario: tre viste, menu, Home e Impostazioni; Il mio turno usa lo stesso modulo.
const page = fs.readFileSync('orario.html', 'utf8');
['orario-giorno.js', 'orario-corse.js', 'turni-giorno.js', 'orario-page.js'].forEach(script => assert.ok(page.includes(script), script));
['data-view="lago"', 'data-view="viaggio"', 'data-view="scalo"'].forEach(tab => assert.ok(page.includes(tab), tab));
const js = fs.readFileSync('assets/js/orario-page.js', 'utf8');
assert.match(js, /function posizione\(punti, t\)/);
assert.match(js, /function soluzioni\(g, from, to\)/);
assert.match(js, /function eventiScalo\(g, scalo\)/);
assert.match(fs.readFileSync('assets/js/shared-menu.js', 'utf8'), /\['orario\.html','◷','Orario'\]/);
assert.match(fs.readFileSync('index.html', 'utf8'), /href="orario\.html"/);
assert.match(fs.readFileSync('impostazioni.html', 'utf8'), /data-start-page="orario\.html"/);
assert.match(fs.readFileSync('assets/js/portal.js', 'utf8'), /'orario\.html'/);
assert.match(fs.readFileSync('mio-turno.html', 'utf8'), /orario-giorno\.js/);
assert.match(fs.readFileSync('assets/js/mio-turno.js', 'utf8'), /window\.NaviOrarioGiorno/);
const css = fs.readFileSync('assets/css/orario.css', 'utf8');
assert.strictEqual((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
console.log('orario ok');
