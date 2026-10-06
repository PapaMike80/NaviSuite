#!/usr/bin/env node
// Lettura della tabella "TURNO NAVI" degli allegati ODS (aggiornamenti.html).
const assert=require('node:assert/strict');
const {readPage}=require('./read-page');

const html=readPage('aggiornamenti.html');
const grab=name=>{const i=html.indexOf('    function '+name+'(');assert.ok(i>=0,name);const j=html.indexOf('\n    function ',i+10),k=html.indexOf('\n    async function ',i+10);return html.slice(i,k>0&&k<j?k:j);};
const src=['odsDateRange','parseOdsNaviPdf','datesBetween','groupedPdfLines','pageDayCenters'].map(grab).join('\n');
const parse=new Function('pages',src+'\nreturn parseOdsNaviPdf(pages,"39");');

// Tabella sintetica con la stessa disposizione dell'allegato all'ODS 39:
// nomi allineati a destra nella colonna, "Rifornimento" sopra il nome,
// ormeggio sotto, righe CAR/SR2, CAP e S.S., nota lunga in fondo.
const items=[];
const add=(text,center,y,width=text.length*5)=>items.push({text,x:center-width/2,y,width,height:8,page:1});
add('TURNO NAVI DAL 2 OTTOBRE AL 4 OTTOBRE 2026 – ALLEGATO ALL\'ODS',200,780,300);
const days=["VENERDI'",'SABATO','DOMENICA'],centers=[121,179,235];
days.forEach((d,i)=>add(d,centers[i],690));
const row=(label,y,cells)=>{add(label,62,y,8);cells.forEach((cell,i)=>{if(!cell)return;const [ship,mooring,refuel]=cell;if(refuel)add('Rifornimento',centers[i],y+9.3);if(ship)add(ship,centers[i],y);if(mooring)add(mooring,centers[i],y-9);});};
row('R4',360,[['PELER','pont. 3'],['PELER','pont. 3'],['TRENTO','Pont. 1']]);
row('CAR/SR2',334,[['VERGA','Pont. 2'],['VERGA','Pont. 2'],['VERGA','Pont. 2']]);
row('P1',306,[['VERONA'],['ANDROMEDA'],['VERONA']]);
row('P2',279,[['ANDER',null,true],['VERONA'],['ANDROMEDA',null,true]]);
row('CAP',224,[['VIRGILIO',null,true],['VIRGILIO',null,true],['VIRGILIO',null,true]]);
row('SR1',197,[['GOETHE',null,true],['GOETHE',null,true],['GOETHE',null,true]]);
row('S.S.',170,[['ZANARDELLI',null,true],['TONALE','pont. 3'],null]);
add("Sotto il nome della nave è segnato l'ormeggio serale.",134,152,190);
add('D1',62,420,8);add('VERONA + AGONE',centers[0],420,60);

const rows=parse([items]);
const get=(data,corsa)=>rows.find(r=>r.data===data&&r.corsa===corsa);
assert.equal(get('2026-10-03','P1').nave,'ANDROMEDA');
assert.equal(get('2026-10-03','P2').nave,'VERONA');
assert.equal(get('2026-10-03','P2').rifornimento_mattina,'');
assert.equal(get('2026-10-04','P2').rifornimento_mattina,'Sì');
assert.equal(get('2026-10-02','P1').ormeggio_serale,'','la riga CAR/SR2 non deve finire nella P1');
// CAR/SR2 vale per entrambe le corse.
assert.equal(get('2026-10-02','CAR').nave,'VERGA');
assert.equal(get('2026-10-02','SR2').ormeggio_serale,'Pont. 2');
// La riga CAP non deve finire nella SR1.
assert.equal(get('2026-10-02','CAP').nave,'VIRGILIO');
assert.equal(get('2026-10-02','SR1').nave,'GOETHE');
assert.equal(get('2026-10-02','S.S.').nave,'ZANARDELLI');
assert.equal(get('2026-10-02','S.S.').ormeggio_serale,'','la nota sotto la tabella non e\' un ormeggio');
assert.equal(get('2026-10-03','S.S.').ormeggio_serale,'pont. 3');
assert.equal(get('2026-10-02','D1').nave,'VERONA + AGONE');
console.log('tabella navi ODS ok');
