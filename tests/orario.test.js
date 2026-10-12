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
['data-view="lago"', 'data-view="viaggio"'].forEach(tab => assert.ok(page.includes(tab), tab));
assert.ok(!page.includes('data-view="scalo"'), 'tab Scalo tolto');
assert.match(page, /<h1 class="terra-title" id="orario-title">Scali<\/h1>/);
const js = fs.readFileSync('assets/js/orario-page.js', 'utf8');
assert.match(js, /function posizione\(punti, t\)/);
assert.match(js, /function soluzioni\(g, from, to\)/);
assert.match(js, /function eventiScalo\(g, scalo(, conSospese = false)?\)/);
assert.match(fs.readFileSync('assets/js/shared-menu.js', 'utf8'), /\['orario\.html','⚓','Scali'\]/);
assert.ok(!fs.readFileSync('assets/js/shared-menu.js', 'utf8').includes("'servizi-terra.html'"), 'Servizi a terra tolto dal menu');
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
assert.match(js, /function alloScalo\(g, t, aperte = \[\], navi = \[\]\)/);
assert.match(js, /function naviAlloScalo\(g, t\)/);
assert.match(js, /data-giornata=/); // tutta la giornata della nave nella scheda
assert.ok(!js.includes('data-goto'), 'niente Tabellone completo');
assert.match(js, /Navi in linea oggi/);
assert.match(js, /const port = event\.target\.closest\('\[data-port\]'\)/);
assert.match(js, /data-from="scalo"/);
assert.match(js, /state\.chiuse\.add\(code\)/);
assert.match(js, /function quantoManca\(g, e, t\)/);
assert.match(js, /in arrivo · \$\{testo\}/);
assert.match(js, /or-next-nome/);
assert.match(js, /const DOPO_PARTENZA = 10;/);
// Allo scalo come Servizi a terra: pontili (Desenzano), R, B, ormeggi, arrivo, agenti in fondo; niente sezione Navi
assert.match(js, /function righeScalo\(g\)/);
assert.match(js, /savePontileCorsa\('DESENZANO', key, day/);
assert.match(js, /class="arr" title="Arrivo">arr\./);
assert.match(js, /Agenti di servizio/);
assert.ok(!/card\('Navi'/.test(js), 'sezione Navi tolta');
// Prima pagina Automatica: sempre Il mio turno, anche a terra (solo all'apertura, non da Home); Scali solo per gli scali
const portal = fs.readFileSync('assets/js/portal.js', 'utf8');
assert.match(portal, /location\.href=preferred==='auto'\?'mio-turno\.html\?auto=1':preferred/);
assert.match(portal, /homeRichiesta=new URLSearchParams\(location\.search\)\.has\('home'\)/);
assert.match(portal, /navisuite\.startDone/);
assert.doesNotMatch(fs.readFileSync('assets/js/mio-turno.js', 'utf8'), /location\.replace\(`orario\.html\?scalo=/);
assert.match(fs.readFileSync('impostazioni.html', 'utf8'), /data-start-page="auto"/);
assert.match(js, /manca = ferma \? `riparte \$\{traMin\(min\)\}`/);
assert.match(js, /while \(resto\[fine \+ 1\]\?\.scalo === state\.scalo\) fine \+= 1;/); // sosta: arrivo e ripartenza, poi lo scalo dopo
assert.match(js, /riga\(dopo, fine \+ 1\)/); // scalo dopo il mio, con quanto manca

// GPS autoselezione dello scalo di partenza "Da"
assert.match(js, /!state\.fromScelto && !state\.fromGpsFatto/);
assert.match(js, /state\.fromGpsFatto = true;/);
assert.match(js, /fromGpsFatto: false/);

const SCALI_LIST = ['Desenzano', 'Peschiera', 'Sirmione', 'Lazise', 'Bardolino', 'Garda', 'Torri', 'Portese', 'Salò',
  'Gardone', 'Maderno', 'Gargnano', 'Brenzone', 'Malcesine', 'Limone', 'Torbole', 'Riva'];
function trovaScaloVicino(lat, lon) {
  const km = ([a, b]) => {
    const r = Math.PI / 180, dLat = (a - lat) * r, dLon = (b - lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(a * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  return SCALI_LIST.map(nome => ({ nome, km: km(M.scali[nome].geo) })).sort((a, b) => a.km - b.km)[0];
}

// 1. GPS vicino a Desenzano -> "Da" = Desenzano
assert.strictEqual(trovaScaloVicino(45.47, 10.54).nome, 'Desenzano');

// 2. GPS vicino a Maderno -> "Da" = Maderno
assert.strictEqual(trovaScaloVicino(45.64, 10.60).nome, 'Maderno');

// 3. GPS vicino a Riva -> "Da" = Riva
assert.strictEqual(trovaScaloVicino(45.88, 10.84).nome, 'Riva');

// Workflow GPS su state:
function creaSimulazione(daIniziale = 'Desenzano', fromScelto = false) {
  const s = { from: daIniziale, to: daIniziale === 'Desenzano' ? 'Sirmione' : 'Desenzano', fromScelto, fromGpsFatto: false, gps: null, scaloScelto: false, scalo: daIniziale };
  let renderChiamato = 0;
  const render = () => { renderChiamato += 1; };
  const onGpsPos = pos => {
    const vicino = trovaScaloVicino(pos.coords.latitude, pos.coords.longitude);
    s.gps = vicino;
    if (!s.fromScelto && !s.fromGpsFatto) {
      if (s.to === vicino.nome) s.to = s.from !== vicino.nome ? s.from : vicino.nome === 'Desenzano' ? 'Sirmione' : 'Desenzano';
      s.from = vicino.nome;
      s.fromGpsFatto = true;
    }
    if (vicino.km > 3) { render(); return; }
    if (!s.scaloScelto) { s.scalo = vicino.nome; }
    render();
  };
  return { s, onGpsPos, getRenderCount: () => renderChiamato };
}

// Autoselezione con GPS disponibile
const simMaderno = creaSimulazione('Desenzano');
simMaderno.onGpsPos({ coords: { latitude: 45.64, longitude: 10.60 } });
assert.strictEqual(simMaderno.s.from, 'Maderno', 'GPS vicino a Maderno imposta Da = Maderno');
assert.ok(simMaderno.getRenderCount() > 0, 'Ricerca e mappa aggiornate subito');

// Autoselezione con GPS vicino a Riva
const simRiva = creaSimulazione('Desenzano');
simRiva.onGpsPos({ coords: { latitude: 45.88, longitude: 10.84 } });
assert.strictEqual(simRiva.s.from, 'Riva', 'GPS vicino a Riva imposta Da = Riva');

// Dopo aver scelto manualmente un altro scalo, il GPS non deve più modificarlo
simMaderno.s.from = 'Torri';
simMaderno.s.fromScelto = true;
simMaderno.onGpsPos({ coords: { latitude: 45.47, longitude: 10.54 } });
assert.strictEqual(simMaderno.s.from, 'Torri', 'Scelta manuale non sovrascritta dal GPS');

// Se l’utente modifica manualmente Da prima che arrivi la posizione GPS
const simManuale = creaSimulazione('Desenzano');
simManuale.s.from = 'Garda';
simManuale.s.fromScelto = true;
simManuale.onGpsPos({ coords: { latitude: 45.88, longitude: 10.84 } });
assert.strictEqual(simManuale.s.from, 'Garda', 'Scelta manuale precedente non sovrascritta dal GPS');

// Autoselezione avviene una sola volta
const simUnaVolta = creaSimulazione('Desenzano');
simUnaVolta.onGpsPos({ coords: { latitude: 45.64, longitude: 10.60 } });
assert.strictEqual(simUnaVolta.s.from, 'Maderno');
simUnaVolta.onGpsPos({ coords: { latitude: 45.88, longitude: 10.84 } });
assert.strictEqual(simUnaVolta.s.from, 'Maderno', 'Non modifica continuamente Da ad aggiornamenti GPS');

// Se il GPS non è disponibile, mantenere il comportamento attuale
const simNoGps = creaSimulazione('Desenzano');
assert.strictEqual(simNoGps.s.from, 'Desenzano', 'Senza GPS resta invariato');

console.log('orario ok');
