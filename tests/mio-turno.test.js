const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

['assets/js/mio-turno.js', 'assets/js/turni-giorno.js', 'assets/js/orario-corse.js']
  .forEach(file => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }));

// Orario delle corse estratto dall'O.d.S. 39/2026 (tools/stampe/orario_corse.py).
require('../assets/js/orario-corse.js');
const orario = globalThis.NaviOrarioCorse;
assert.deepStrictEqual(orario['14'], [['Desenzano', '9.15'], ['Sirmione', '9.35']]);
assert.deepStrictEqual(orario['7'][0], ['Riva', '8.45']);
assert.deepStrictEqual(orario['7'][orario['7'].length - 1], ['Desenzano', '13.30']);
assert.deepStrictEqual(orario['16'].map(s => s[0]), ['Desenzano', 'Sirmione', 'Lazise', 'Bardolino', 'Garda', 'Portese', 'Salò', 'Gardone', 'Maderno']);
// tutte le corse dei turni invernali hanno l'orario (tranne il traghetto, ricavato da Maderno)
const info = require('../assets/js/course-info.js');
Object.entries(info.COURSE_TRIPS_WINTER).filter(([code]) => !/^T[12]$/.test(code)).forEach(([code, trips]) => {
  trips.split('·').forEach(part => {
    const [a, b] = part.trim().split('–').map(Number);
    for (let n = a; n <= (b || a); n += 1) assert.ok(orario[n], `corsa ${n} del turno ${code} senza orario`);
  });
});

// Turno dell'agente con le variazioni ODS ed equipaggio della nave.
require('../assets/js/turni-giorno.js');
const G = globalThis.NaviTurniGiorno;
const day = '2026-10-06';
const data = {
  residenze: {
    DESENZANO: [
      { id: '1', agente: 'ROSSI', qualifica: 'marinaio', turni: { [day]: 'D1' } },
      { id: '2', agente: 'BETTINI', qualifica: 'capo timoniere', turni: { [day]: 'CD1C' } },
      { id: '3', agente: 'VERDI', qualifica: 'motorista', turni: { [day]: 'AGB' } }
    ],
    MADERNO: [{ id: '4', agente: 'BLU', qualifica: 'capitano', turni: { [day]: 'RIP' } }]
  },
  variazioni_ods: [{ data: day, id_agente: '4', turno_nuovo: 'AGT1' }]
};
assert.strictEqual(G.turnoAgente(data, { id: '1' }, day).turno, 'D1');
assert.strictEqual(G.naveCode(G.turnoAgente(data, { id: '2' }, day).turno), 'D1');
assert.strictEqual(G.terraCode(G.turnoAgente(data, { id: '4' }, day).turno), 'AgT'); // variazione ODS
assert.strictEqual(G.terraResidenza('AgT'), 'MADERNO');
const crew = G.equipaggi(data, day);
assert.deepStrictEqual(crew.navi.D1.map(m => m.name), ['BETTINI', 'ROSSI']);
assert.strictEqual(G.comandante(crew.navi.D1), 'BETTINI');
assert.deepStrictEqual(crew.terra, { AgB: ['VERDI'], AgT: ['BLU'] });

// Turno modificato in NaviDiaria (o da NaviTurni): vince su turno base e variazione ODS.
G.setModifiche(new Map([[`1|${day}`, 'T2'], [`4|${day}`, 'D2']]));
assert.strictEqual(G.turnoAgente(data, { id: '1' }, day).turno, 'T2');
assert.strictEqual(G.turnoAgente(data, { id: '4' }, day).turno, 'D2');
assert.deepStrictEqual(G.equipaggi(data, day).navi.T2.map(m => m.name), ['ROSSI']);
G.setModifiche(new Map());
assert.strictEqual(G.turnoAgente(data, { id: '1' }, day).turno, 'D1');

// Fogli di stile chiusi correttamente (una parentesi mancante nascondeva gli stili su PC).
['assets/css/mio-turno.css', 'assets/css/servizi-terra.css'].forEach(file => {
  const css = fs.readFileSync(file, 'utf8');
  assert.strictEqual((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, `parentesi non bilanciate in ${file}`);
});

// Pagina, menu, Home e Impostazioni.
const page = fs.readFileSync('mio-turno.html', 'utf8');
['turni-giorno.js', 'orario-corse.js', 'course-info.js', 'servizi-terra-a4.js', 'shared-data.js', 'mio-turno.js']
  .forEach(script => assert.match(page, new RegExp(script.replace('.', '\\.'))));
assert.match(page, /class="servizi-terra-page mio-turno-page"/);
const menu = fs.readFileSync('assets/js/shared-menu.js', 'utf8');
assert.match(menu, /\['mio-turno\.html','⚑','Il mio turno'\]/);
assert.match(menu, /mio-turno-page'\)\?'mioturno'/);
assert.match(fs.readFileSync('index.html', 'utf8'), /href="mio-turno\.html"/);
assert.match(fs.readFileSync('impostazioni.html', 'utf8'), /data-start-page="mio-turno\.html"/);
assert.match(fs.readFileSync('assets/js/portal.js', 'utf8'), /'mio-turno\.html'/);
const js = fs.readFileSync('assets/js/mio-turno.js', 'utf8');
assert.match(js, /NaviOrarioPage\?\.show\(\{ modo: 'terra', scalo: residenza === 'MADERNO' \? 'Maderno' : 'Desenzano', day, turno: code, inizio: servizio \? servizio\[1\]\.split\(' – '\)\[0\] : '' \}\)/); // a terra: la pagina Scali del mio scalo
assert.match(js, /NaviOrarioPage\?\.show\(\{ modo: 'nave', turno: nave, day \}\)/); // in linea: la mappa con la mia corsa
assert.ok(!/location\.replace/.test(js) && /params\.get\('auto'\) === '1'/.test(js)); // Automatica: resta su Il mio turno anche a terra
assert.match(page, /window\.NaviOrarioEmbed = true/);
assert.match(page, /id="orario-content"/);
const ordine = name => page.indexOf(`<script src="assets/js/${name}`);
assert.ok(ordine('orario-lago.js') > 0 && ordine('orario-lago.js') < ordine('orario-page.js') && ordine('orario-page.js') < ordine('mio-turno.js'));
assert.match(page, /id="turno-test"/); // prova con un altro turno
assert.match(js, /shiftForCode\(/); // ore del servizio
assert.doesNotMatch(js, /Buono pasto|`Diaria |'Imbarco'/); // competenze tolte dalla pagina
assert.match(js, /7: \{ Riva: 'carica', Maderno: 'carica', Desenzano: 'consegna' \}/); // B della bolgetta sugli scali
assert.doesNotMatch(js, /giornataCard/);
assert.match(js, /past-toggle/);
assert.match(js, /G\.caricaModifiche\(profile\(\)\)/); // turni modificati in Diaria/Turni // corse gia' fatte nascoste
assert.match(js, /class="navi-list"/); // corse e scali come l'orario di Servizi a terra
assert.match(js, /i !== lastPast && !state\.showPast/); // scali gia' fatti nascosti tranne l'ultimo
const scaliJs = fs.readFileSync('assets/js/orario-page.js', 'utf8');
assert.match(scaliJs, /window\.NaviOrarioPage = \{/);
assert.match(scaliJs, /if \(EMBED && !state\.embed\) return;/);
assert.match(js, /const admin = !!window\.NaviRoles\?\.isAdminAgent\?\.\(profile\(\)\);/); // «Prova turno» solo per gli admin
assert.match(js, /if \(!admin\) document\.querySelector\('\.mt-test'\)\?\.remove\(\);/);

// Le sezioni mantengono lo stato nei render, senza una dipendenza inversa dalla mappa.
const listeners = {};
const map = { dataset: { mtSection: 'mappa' }, open: false, isConnected: true };
const elements = Object.fromEntries(['turno-content', 'turno-after', 'turno-scali'].map(id => [id, {
  addEventListener(type, handler, capture) {
    assert.strictEqual(type, 'toggle');
    assert.strictEqual(capture, true); // toggle non propaga in bubbling
    listeners[id] = handler;
  }
}]));
elements['turno-map'] = map;
const context = {
  window: { NaviOrarioGiorno: {} },
  document: { getElementById: id => elements[id], querySelector: () => null },
  localStorage: { getItem: () => null },
  location: { search: '' },
  URLSearchParams
};
// Esegue l'inizializzazione e gli handler reali, prima della logica dei dati del turno.
vm.runInNewContext(js.slice(0, js.indexOf('  // Bolgette')) +
  'window.testSections = { state, card }; })();', context);
const { state: sectionState, card: sectionCard } = context.window.testSections;
const states = () => [sectionState.sections.turno, sectionState.sections.corse, sectionState.sections.mappa];
const corse = { dataset: { mtSection: 'corse' }, open: false, isConnected: true };
const turno = { dataset: { mtSection: 'turno' }, open: true, isConnected: true };
const toggle = (element, open, parent) => {
  element.open = open;
  listeners[parent]({ target: element });
};
assert.deepStrictEqual(states(), [true, false, false]);
assert.match(sectionCard('Il mio turno', '', ''), /data-mt-section="turno" open/);
assert.doesNotMatch(sectionCard('Corse e scali', '', '', '', 'corse'), / open/);
assert.match(page, /<details class="terra-card" id="turno-map" data-mt-section="mappa">/);
assert.match(js, /\$\('turno-map'\)\.open = state\.sections\.mappa;/);

toggle(map, true, 'turno-scali');
assert.deepStrictEqual(states(), [true, false, true]);
toggle(map, false, 'turno-scali');
assert.deepStrictEqual(states(), [true, false, false]);
toggle(turno, false, 'turno-after');
// Aprire Corse e scali non apre la mappa: ogni sezione si apre e si chiude da sola.
toggle(corse, true, 'turno-content');
assert.deepStrictEqual(states(), [false, true, false]);
assert.strictEqual(map.open, false);
toggle(map, true, 'turno-scali');
assert.deepStrictEqual(states(), [false, true, true]);
// Un evento iniziale da un render di corse gia' aperte non cambia la mappa.
listeners['turno-content']({ target: corse });
assert.deepStrictEqual(states(), [false, true, true]);
toggle(map, false, 'turno-scali');
assert.deepStrictEqual(states(), [false, true, false]);
assert.match(sectionCard('Corse e scali', '', '', '', 'corse'), /data-mt-section="corse" open/);
assert.doesNotMatch(sectionCard('Il mio turno', '', ''), / open/);
toggle(corse, false, 'turno-content');
assert.deepStrictEqual(states(), [false, false, false]);
toggle(map, true, 'turno-scali');
toggle(corse, true, 'turno-content');
toggle(corse, false, 'turno-content');
assert.deepStrictEqual(states(), [false, false, true]); // chiudere corse non chiude mappa
toggle(turno, true, 'turno-after');
assert.deepStrictEqual(states(), [true, false, true]);
toggle(map, false, 'turno-scali');
listeners['turno-content']({ target: { ...corse, open: true, isConnected: false } });
listeners['turno-scali']({ target: { dataset: {}, open: true, isConnected: true } });
assert.deepStrictEqual(states(), [true, false, false]);

// Verifica collegamenti mezzi pubblici per agente fuori residenza (es. Maderno -> Desenzano PonD)
if (typeof window === 'undefined') global.window = globalThis;
if (typeof localStorage === 'undefined') global.localStorage = { getItem: () => null, setItem: () => {} };
require('../assets/js/collegamenti-dati.js');
require('../assets/js/collegamenti.js');
const C_test = globalThis.NaviCollegamenti;
assert.ok(C_test && typeof C_test.cercaTurno === 'function');
const rTurno = C_test.cercaTurno({ casa: 'Maderno', turnoResidenza: 'Desenzano', iso: '2026-10-28', inizio: '9.30', fine: '19.50' });
assert.ok(rTurno.fattibile);
assert.strictEqual(C_test.ora(rTurno.andata.parte), '07:37');
assert.strictEqual(C_test.ora(rTurno.andata.arriva), '08:59');
assert.strictEqual(C_test.ora(rTurno.ritorno.parte), '20:00');
assert.strictEqual(C_test.ora(rTurno.ritorno.arriva), '21:28');

console.log('mio-turno ok');
