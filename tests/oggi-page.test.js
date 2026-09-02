const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

execFileSync(process.execPath, ['--check', 'assets/js/oggi.js'], { stdio: 'pipe' });
const html = fs.readFileSync('oggi.html', 'utf8');
const source = fs.readFileSync('assets/js/oggi.js', 'utf8');
assert.match(html, /class="turni-page oggi-page"/);
assert.match(html, /assets\/js\/shared-data\.js/);
assert.match(html, /assets\/js\/oggi\.js\?v=5/);
assert.match(source, /turni_navi/);
assert.match(source, /variazioni_ods/);
assert.match(source, /residenze/);
assert.match(source, /Capo timoniere/);
assert.match(source, /todayIso/);

const nodes = new Map();
const document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { id, textContent:'', innerHTML:'', hidden:false, classList:{ add(){}, remove(){} }, addEventListener(){} });
    return nodes.get(id);
  },
  querySelector() { return { classList:{ toggle(){} } }; },
  createElement() { return { textContent:'', get innerHTML(){ return this.textContent; } }; }
};
const sample = { residenze:{ DESENZANO:[
  { id:'1', agente:'Rossi', qualifica:'capitano', turni:{ '2026-09-02':'D1' } },
  { id:'2', agente:'Bianchi', qualifica:'motorista', turni:{ '2026-09-02':'D1' } }
], PESCHIERA:[
  { id:'3', agente:'Verdi', qualifica:'capo timoniere', turni:{ '2026-09-02':'CD1C' } }
] }, turni_navi:[{ data:'2026-09-02', corsa:'D1', nave:'Agone' }], variazioni_ods:[] };
const context = { window:{ NaviSharedData:{ load:async()=>sample } }, document, localStorage:{ getItem(){ return 'null'; } }, console, Date, Intl, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(source, context);
const cards = context.window.NaviOggi.buildCourses(sample, '2026-09-02');
assert.equal(cards.length, 1);
assert.equal(cards[0].course, 'D1');
assert.equal(cards[0].ship, 'Agone');
assert.deepEqual(cards[0].crew.map(a => a.agente), ['Rossi', 'Verdi', 'Bianchi']);
assert.match(source, /CD1C/);
assert.match(source, /aria-expanded/);
console.log('Oggi page checks passed');
