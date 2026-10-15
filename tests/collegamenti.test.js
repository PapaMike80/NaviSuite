const assert = require('assert');
global.window = {};
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
