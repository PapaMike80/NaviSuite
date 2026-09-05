const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

execFileSync(process.execPath, ['--check', 'assets/js/oggi.js'], { stdio: 'pipe' });
const html = fs.readFileSync('oggi.html', 'utf8');
const source = fs.readFileSync('assets/js/oggi.js', 'utf8');
assert.match(html, /class="turni-page oggi-page"/);
assert.match(html, /assets\/js\/shared-data\.js/);
assert.match(html, /assets\/js\/oggi\.js\?v=10/);
assert.match(html, /\.oggi-grid\[hidden\]/);
assert.match(source, /turni_navi/);
assert.match(source, /variazioni_ods/);
assert.match(source, /residenze/);
assert.match(source, /Capo timoniere/);
assert.match(source, /todayIso/);
assert.match(source, /MONTH_LABELS=.*'SETT'/);
assert.match(source, /oggi-residence-date/);
assert.match(source, /index===0/);
assert.match(source, /querySelectorAll\('\.oggi-card'\)/);
assert.match(source, /class="oggi-residence is-open"/);
assert.match(source, /class="oggi-card is-open"/);
assert.match(source, /aria-expanded="true"/);
assert.match(source, /ormeggio_serale/);
assert.match(source, /Ormeggio serale/);
assert.match(source, /OGGI_CACHE_KEY/);
assert.match(source, /readSnapshot/);
assert.match(source, /writeSnapshot/);
assert.match(source, /controllo aggiornamenti/);
assert.doesNotMatch(source, /class="oggi-grid" hidden/);
assert.match(source, /PESCHIERA:\['P1','P2','P3','SR1','CAP'\]/);

const nodes = new Map();
const document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { id, textContent:'', innerHTML:'', hidden:false, classList:{ add(){}, remove(){}, toggle(){} }, addEventListener(){} });
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
] }, turni_navi:[{ data:'2026-09-02', corsa:'D1', nave:'Baldo', ormeggio_serale:'Pontile 2' }], variazioni_ods:[] };
const context = { window:{ NaviSharedData:{ load:async()=>sample } }, document, localStorage:{ getItem(){ return 'null'; } }, console, Date, Intl, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(source, context);
const cards = context.window.NaviOggi.buildCourses(sample, '2026-09-02');
assert.equal(cards.length, 1);
assert.equal(cards[0].course, 'D1');
assert.equal(cards[0].ship, 'Baldo');
assert.equal(cards[0].mooring, 'Pontile 2');
assert.deepEqual(cards[0].crew.map(a => a.agente), ['Rossi', 'Verdi', 'Bianchi']);
assert.match(source, /CD1C/);
assert.match(source, /WEEKDAY_LABELS/);

const orderSample = {
  residenze:{ DESENZANO:[], PESCHIERA:[], MADERNO:[], RIVA:[] },
  turni_navi:[
    { data:'2026-09-02', corsa:'BIS', nave:'Agone' },
    { data:'2026-09-02', corsa:'D1', nave:'Agone' },
    { data:'2026-09-02', corsa:'CAP', nave:'Agone' },
    { data:'2026-09-02', corsa:'P1', nave:'Agone' },
    { data:'2026-09-02', corsa:'SR1', nave:'Agone' },
    { data:'2026-09-02', corsa:'CAR', nave:'Agone' },
    { data:'2026-09-02', corsa:'R1', nave:'Agone' }
  ],
  variazioni_ods:[]
};
const ordered = context.window.NaviOggi.buildCourses(orderSample, '2026-09-02');
assert.deepEqual(ordered.filter(card => card.residence === 'DESENZANO').map(card => card.course), ['D1','BIS']);
assert.deepEqual(ordered.filter(card => card.residence === 'PESCHIERA').map(card => card.course), ['P1','SR1','CAP']);
assert.deepEqual(ordered.filter(card => card.residence === 'RIVA').map(card => card.course), ['R1','CAR']);
console.log('Oggi page checks passed');
