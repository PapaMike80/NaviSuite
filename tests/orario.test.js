const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

['assets/js/orario-giorno.js', 'assets/js/orario-lago.js', 'assets/js/orario-page.js']
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

// Mappa del lago: ogni scalo ha pontile e boa in acqua; le rotte di tutte le corse restano in acqua
// (es. Garda - Torri gira attorno a Punta San Vigilio).
require('../assets/js/orario-lago.js');
const M = globalThis.NaviLagoMappa;
const costa = M.costa.slice(1, -1).split(' L').map(p => p.split(' ').map(Number));
const inAcqua = ([x, y]) => {
  let dentro = false;
  for (let i = 0, j = costa.length - 1; i < costa.length; j = i, i += 1) {
    const [xi, yi] = costa[i], [xj, yj] = costa[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
assert.strictEqual(Object.keys(M.scali).length, 17);
Object.entries(M.scali).forEach(([nome, s]) => assert.ok(inAcqua(s.boa), `boa ${nome}`));
assert.ok(M.km > 2 && M.km < 3.5, 'scala');
assert.ok((M.rotte['Garda|Torri'] || M.rotte['Torri|Garda'])?.length, 'Garda - Torri attorno a San Vigilio');
const rotta = (a, b) => [M.scali[a].boa, ...(M.rotte[`${a}|${b}`] || (M.rotte[`${b}|${a}`] || []).slice().reverse()), M.scali[b].boa];
const coppie = new Set();
['2026-10-06', '2026-12-10', '2027-03-21'].forEach(day => O.viaggiDelGiorno(day).forEach(v => v.scali.forEach((s, i) => {
  if (i && v.scali[i - 1][0] !== s[0]) coppie.add(`${v.scali[i - 1][0]}|${s[0]}`);
})));
assert.ok(coppie.size > 20);
coppie.forEach(coppia => {
  const r = rotta(...coppia.split('|'));
  r.slice(1).forEach(([x, y], i) => {
    for (let k = 0; k <= 20; k += 1) {
      const p = [r[i][0] + (x - r[i][0]) * k / 20, r[i][1] + (y - r[i][1]) * k / 20];
      assert.ok(inAcqua(p), `${coppia} passa sulla terra`);
    }
  });
});
assert.ok(page.indexOf('orario-lago.js') > 0 && page.indexOf('orario-lago.js') < page.indexOf('orario-page.js'));
// Scalo dal GPS (Da -> A, tabellone e sezione "Allo scalo" del Lago), sempre modificabile
assert.match(js, /function posizioneGps\(\)/);
assert.match(js, /if \(!state\.scaloScelto\) \{ state\.scalo = vicino\.nome/);
assert.match(js, /function alloScalo\(g, t\)/);
assert.match(js, /data-goto="scalo"/);
assert.match(js, /const port = event\.target\.closest\('\[data-port\]'\)/);
assert.match(js, /data-from="scalo"/);
assert.match(js, /closest\('\.or-detail \.terra-card-head'\)\) \{ state\.selected = ''/);
assert.match(js, /function quantoManca\(g, e, t\)/);
assert.match(js, /in arrivo · \$\{testo\}/);
assert.match(js, /or-next-nome/);
console.log('orario ok');
