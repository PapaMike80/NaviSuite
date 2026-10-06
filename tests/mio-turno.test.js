const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

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
assert.match(js, /location\.replace\(link\)/); // a terra: Servizi a terra
console.log('mio-turno ok');
