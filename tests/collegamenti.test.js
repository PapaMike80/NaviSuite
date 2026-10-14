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
// Desenzano -> Maderno entro le 7:10: nessun bus
let r = C.cerca('Desenzano', 'Maderno', '2026-10-15', 7 * 60 + 10);
assert.strictEqual(r.validi.length, 0);
assert.ok(r.primoDopo && r.primoDopo.arriva > 7 * 60 + 10);
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
