const assert = require('node:assert');
const fs = require('node:fs');

// Notifiche degli arrivi per chi lavora a terra (push-arrivi.js), con gli stessi moduli che scarica
// il push-worker.
globalThis.window = globalThis;
globalThis.NaviCourseInfo = require('../assets/js/course-info.js');
['orario-corse', 'servizi-terra-a4', 'turni-giorno', 'orario-giorno'].forEach(file => require(`../assets/js/${file}.js`));
const A = require('../assets/js/push-arrivi.js');

const T = '2026-10-06';
const data = {
  residenze: {
    DESENZANO: [{ id: '4', agente: 'NERI', turni: { [T]: 'POND' } }, { id: '3', agente: 'VERDI', turni: { [T]: 'AGB' } },
      { id: '1', agente: 'ROSSI', qualifica: 'capitano', turni: { [T]: 'P2' } }, { id: '5', agente: 'BETTINI', qualifica: 'capo timoniere', turni: { [T]: 'D1' } }],
    MADERNO: [{ id: '8', agente: 'BLU', turni: { [T]: 'AGM' } }, { id: '9', agente: 'ROSA', turni: { [T]: 'AGT1' } },
      { id: '10', agente: 'VIOLA', qualifica: 'capitano', turni: { [T]: 'M1' } }]
  },
  turni_navi: [{ data: T, corsa: 'D1', nave: 'S. MARCO', ormeggio_serale: 'pont. 4' }, { data: T, corsa: 'P2', nave: 'CATULLO' },
    { data: T, corsa: 'M1', nave: 'MANTOVA', ormeggio_serale: 'pont. 1' }]
};
// pontili scelti in Servizi a terra: la P2 delle 11.20 il giorno prima (riproposto), la M1 oggi
const pontili = { '11-20_P2_33': { '2026-10-05': '2' }, '12-15_M1_91': { [T]: '3' } };

// PonD (9.30-13.35 / 15.00-19.50): arrivi a Desenzano 10' prima, con pontile e comandante
const pond = A.notifiche(data, '4', T, { pontili });
const m1 = pond.find(n => n.code === 'M1');
assert.strictEqual(m1.quando, '12.05');
assert.strictEqual(m1.title, 'M1 MANTOVA arriva alle 12.15');
assert.strictEqual(m1.body, '⚓ Pontile 3 · da Maderno · corsa 91\nComandante VIOLA');
assert.strictEqual(pond.find(n => n.run === '33').pontile, '2', 'pontile del giorno prima');
assert.strictEqual(pond.find(n => n.run === '19').pontile, '4', 'ormeggio serale dall\'O.d.S.');
assert.match(pond.find(n => n.run === '15').body, /Comandante BETTINI/, 'capo timoniere');
assert.ok(pond.every(n => A.ANTICIPO === 10 && n.tag.startsWith(`navisuite-arrivo-${T}-`)));
// AgB fino alle 17.30: niente arrivi della sera; nessuna partenza
const agb = A.notifiche(data, '3', T, { pontili });
assert.ok(agb.length && agb.every(n => n.time !== '19.40' && n.time !== '12.15'));
// AgM: arrivi e scali delle navi di linea a Maderno; AgT: traghetto da Torri
const agm = A.notifiche(data, '8', T);
assert.ok(agm.some(n => n.title === 'R1 fa scalo alle 11.03'));
assert.strictEqual(agm.find(n => n.time === '19.25').pontile, '1');
const agt = A.notifiche(data, '9', T);
assert.ok(agt.length && agt.every(n => /^T[12]$/.test(n.code) && n.body.includes('da Torri')));
// SR solo fino all'11/10
assert.ok(!A.notifiche({ ...data, residenze: { MADERNO: [{ id: '8', agente: 'BLU', turni: { '2026-10-20': 'AGM' } }] } }, '8', '2026-10-20').some(n => /^SR/.test(n.code)));
// a bordo nessuna notifica di arrivo
assert.deepStrictEqual(A.notifiche(data, '1', T), []);
// da mandare adesso: dall'ora di avviso per 5 minuti
assert.deepStrictEqual(A.dovute(pond, 12 * 60 + 7).map(n => n.code), ['M1']);
assert.deepStrictEqual(A.dovute(pond, 12 * 60 + 11), []);

// Preferenza "Arrivi delle navi" (attiva di default), interruttore in Impostazioni e pagine con gli avvisi
assert.match(fs.readFileSync('assets/js/push-notifications-v3.js', 'utf8'), /arrivals:true/);
const center = fs.readFileSync('assets/js/push-center.js', 'utf8');
assert.match(center, /id="push-pref-arrivals"/);
assert.match(center, /arrivals:\$\('push-pref-arrivals'\)\.checked/);
['mio-turno.html', 'orario.html'].forEach(page => {
  const html = fs.readFileSync(page, 'utf8');
  assert.ok(html.indexOf('push-arrivi.js') > html.indexOf('turni-giorno.js') && html.indexOf('arrivi-avvisi.js') > html.indexOf('push-arrivi.js'), page);
  assert.ok(html.includes('orario-giorno.js'), page);
});

// Da -> A: partenza dallo scalo piu' vicino (GPS) con le coordinate dei pontili
require('../assets/js/orario-lago.js');
Object.entries(globalThis.NaviLagoMappa.scali).forEach(([nome, s]) => assert.ok(s.geo[0] > 45.4 && s.geo[0] < 45.9 && s.geo[1] > 10.5 && s.geo[1] < 10.9, nome));
const page = fs.readFileSync('assets/js/orario-page.js', 'utf8');
assert.match(page, /navigator\.geolocation\.getCurrentPosition/);
assert.match(page, /vicino\.km > 3/);
console.log('push arrivi ok');
