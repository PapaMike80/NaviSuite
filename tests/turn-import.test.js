#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Turn=require('../assets/js/turn-import-helpers.js');

// ---- helper del PDF -------------------------------------------------------
assert.equal(Turn.sectionResidence('RIVA'),'RIVA');
assert.equal(Turn.sectionResidence('Residenza di  Maderno'),'MADERNO');
assert.equal(Turn.sectionResidence('45 ROSSI M.'),'');
assert.deepEqual(Turn.parseRowPrefix('78 BLEIL L.'),{number:78,name:'BLEIL L.'});
assert.deepEqual(Turn.parseRowPrefix('23 OMEZZOLLI O.'),{number:23,name:'OMEZZOLLI O.'});
assert.equal(Turn.parseRowPrefix('Settimana dal 05-10'),null);
assert.ok(Turn.sameAgent('MORETTO C.A.','MORETTO A.C.'));
assert.ok(!Turn.sameAgent('ROSSI M.','ROSSI A.'));
assert.ok(Turn.isTransferMarker('A MADERNO')&&!Turn.isTransferMarker('AGM'));
assert.deepEqual(Turn.mergeCells([['A MADERNO','R1','RIP'],['RIP','A RIVA','T1']]),['RIP','R1','T1']);

const start='2026-10-05';
assert.deepEqual(Turn.planResidenceMove({residence:'DESENZANO'},'MADERNO',start),
  {residenzaNuova:'MADERNO',residenzaPrecedente:'DESENZANO',residenzaDal:start,sposta:true});
assert.equal(Turn.planResidenceMove({residence:'RIVA'},'RIVA',start),null);
assert.equal(Turn.planResidenceMove({residence:'RIVA',nuovo:true},'MADERNO',start),null);
// Agente gia' spostato da una bozza con la stessa decorrenza: il turno ufficiale
// riparte dalla residenza di origine e conserva lo spostamento.
assert.equal(Turn.planResidenceMove({residence:'MADERNO',residenzaPrecedente:'DESENZANO',residenzaDal:start},'MADERNO',start).residenzaPrecedente,'DESENZANO');

// ---- applyScheduleImports -------------------------------------------------
const source=fs.readFileSync('assets/js/shared-data.js','utf8');
const sandbox={window:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},console,fetch:()=>Promise.reject(new Error('offline')),setTimeout,clearTimeout,Date,Promise};
sandbox.window.window=sandbox.window;sandbox.window.localStorage=sandbox.localStorage;
vm.createContext(sandbox);
vm.runInContext(source,Object.assign(sandbox,{document:{}}));
const shared=sandbox.window.NaviSharedData;
assert.equal(typeof shared.applyScheduleImports,'function');

const dates=['2026-10-05','2026-10-06','2026-10-07'];
const fresh=()=>({
  date:dates.map(iso=>({iso})),
  residenze:{
    RIVA:[{id:'1',agente:'SISTO S.',turni:{}}],
    MADERNO:[{id:'2',agente:'FERRARO V.',turni:{}}],
    DESENZANO:[{id:'3',agente:'PEDRONI M.',turni:{}},{id:'4',agente:'TIBILETTI F.',turni:{}}],
    PESCHIERA:[]
  }
});
const batch=rows=>[{id:'T1',tipo:'turno',inizio:dates[0],fine:dates[2],dates,attiva:true,importedAt:'2026-09-21T10:00:00Z',rows}];
const names=(data,res)=>data.residenze[res].map(agent=>agent.agente);
const rows=[
  {id_agente:'3',agente:'PEDRONI M.',residenza:'MADERNO',turni:['Lav;','Con/','L.D;'],residenzaPrecedente:'DESENZANO',residenzaNuova:'MADERNO',residenzaDal:dates[0],sposta:true},
  {id_agente:'NEW_BLEIL_L',agente:'BLEIL L.',residenza:'DESENZANO',nuovo:true,qualifica:'marinaio',turni:['AgB','RIP','AgB']}
];

// Prima della decorrenza l'agente resta nella residenza di origine.
let data=fresh();shared.applyScheduleImports(data,batch(rows),{today:'2026-09-21'});
assert.ok(names(data,'DESENZANO').includes('PEDRONI M.'));
assert.ok(!names(data,'MADERNO').includes('PEDRONI M.'));
const pedroni=data.residenze.DESENZANO.find(agent=>agent.agente==='PEDRONI M.');
assert.equal(pedroni.residenzaPrecedente,'DESENZANO');
assert.equal(pedroni.residenzaNuova,'MADERNO');
assert.equal(pedroni.residenzaDal,dates[0]);
assert.deepEqual(dates.map(iso=>pedroni.turni[iso]),['TERRA','CON','L.D.']);

// Dalla decorrenza passa alla residenza nuova.
data=fresh();shared.applyScheduleImports(data,batch(rows),{today:'2026-10-05'});
assert.ok(names(data,'MADERNO').includes('PEDRONI M.'));
assert.ok(!names(data,'DESENZANO').includes('PEDRONI M.'));

// Idempotenza: rieseguire l'import non duplica l'agente.
shared.applyScheduleImports(data,batch(rows),{today:'2026-10-05'});
const count=Object.values(data.residenze).flat().filter(agent=>agent.agente==='PEDRONI M.').length;
assert.equal(count,1);

// Nuovo agente creato una sola volta, nella residenza del PDF, con qualifica.
const bleil=Object.values(data.residenze).flat().filter(agent=>agent.agente==='BLEIL L.');
assert.equal(bleil.length,1);
assert.equal(bleil[0].qualifica,'marinaio');
assert.ok(names(data,'DESENZANO').includes('BLEIL L.'));
assert.deepEqual(dates.map(iso=>bleil[0].turni[iso]),['AGB','RIP','AGB']);

// sposta:false (deselezionato in anteprima) non muove nessuno.
data=fresh();
shared.applyScheduleImports(data,batch(rows.map(row=>({...row,sposta:false}))),{today:'2026-10-05'});
assert.ok(names(data,'DESENZANO').includes('PEDRONI M.'));

// Dopo lo spostamento le righe Desenzano restano ordinate per anzianita' (BLEIL prima di SQUARZONI).
data=fresh();data.residenze.DESENZANO.push({id:'9',agente:'SQUARZONI P.',turni:{}});
shared.applyScheduleImports(data,batch(rows),{today:'2026-10-05'});
const order=names(data,'DESENZANO');
assert.ok(order.indexOf('BLEIL L.')<order.indexOf('SQUARZONI P.'),order.join(','));

// ---- integrazione nelle pagine -------------------------------------------
const agg=fs.readFileSync('aggiornamenti.html','utf8');
assert.match(agg,/assets\/js\/turn-import-helpers\.js/);
assert.match(agg,/data-field="sposta"/);
assert.match(agg,/planResidenceMove/);
const turni=fs.readFileSync('naviturni.html','utf8');
assert.match(turni,/residenzaDal/);
console.log('turn-import ok');

// ---- naviturni: agente spostato visibile in entrambe le residenze -----------
{
  const html=fs.readFileSync('naviturni.html','utf8');
  const scripts=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const src=scripts.find(text=>text.includes('function adattaFormatoNaviturni'));
  const start=src.indexOf('function adattaFormatoNaviturni(');
  let end=src.indexOf('{',src.indexOf(')',start)),depth=0;
  for(;end<src.length;end++){if(src[end]==='{')depth++;if(src[end]==='}'&&--depth===0)break}
  const fn=src.slice(start,end+1);
  const win={NaviSharedData:{seniorityRank:name=>({'A':1,'B':2,'C':3}[String(name).split(' ')[0]]||99)}};
  const adaptInfo=[];
  const adapt=new Function('window','settimaneInfo','BARISTA_PRIVATE_SHIFT','normalizeOdsShift',`${fn};return adattaFormatoNaviturni;`)(win,adaptInfo,'__PRIVATE__',value=>String(value).toLowerCase());
  const days=['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'];
  const mover={id:'3',agente:'B X.',turni:Object.fromEntries(days.map(iso=>[iso,'R1'])),residenzaPrecedente:'DESENZANO',residenzaNuova:'MADERNO',residenzaDal:'2026-10-05'};
  const out=adapt({date:days.map(iso=>({iso})),residenze:{
    MADERNO:[{id:'1',agente:'A X.',turni:{}},{id:'2',agente:'C X.',turni:{}}],
    DESENZANO:[mover]}});
  const weekOf=agent=>Object.values(agent.turni_settimanali)[0];
  const des=out.residenze.DESENZANO.find(agent=>agent.id==='3'),mad=out.residenze.MADERNO.find(agent=>agent.id==='3');
  assert.ok(des&&mad);
  assert.deepEqual(weekOf(des),['r1',...Array(6).fill('__PRIVATE__')]);
  assert.deepEqual(weekOf(mad),['__PRIVATE__',...Array(6).fill('r1')]);
  assert.deepEqual(out.residenze.MADERNO.map(agent=>agent.id),['1','3','2']);
  assert.equal(mad.residenzaDal,'2026-10-05');
  // La riga fissata in alto (mia / collega) porta sempre tutti i turni.
  assert.deepEqual(Object.values(des.turni_settimanali_completi)[0],Array(7).fill('r1'));
  assert.deepEqual(Object.values(mad.turni_settimanali_completi)[0],Array(7).fill('r1'));
  assert.equal(out.residenze.MADERNO.find(agent=>agent.id==='1').turni_settimanali_completi,undefined);

  // Variazione ODS su un giorno nascosto: solo nei dati completi.
  const hdr=src.indexOf('function applyOdsVariations(');
  let e=src.indexOf('{',src.indexOf(')',hdr)),dd=0;
  for(;e<src.length;e++){if(src[e]==='{')dd++;if(src[e]==='}'&&--dd===0)break}
  const fnOds=src.slice(hdr,e+1),normFn=src.slice(src.indexOf('function normalizeOdsAgentName('));
  const nameFn=normFn.slice(0,normFn.indexOf('\n    }')+6);
  const ods=new Function('settimaneInfo','BARISTA_PRIVATE_SHIFT','normalizeOdsShift',`${nameFn};${fnOds};return applyOdsVariations;`);
  const apply=ods(adaptInfo,'__PRIVATE__',value=>String(value).toLowerCase());
  const done=apply({...out,variazioni_ods:[{data:'2026-10-07',id_agente:'3',agente:'B X.',turno_nuovo:'T2',ods:'ODS 1'}]});
  const d2=done.residenze.DESENZANO.find(agent=>agent.id==='3'),m2=done.residenze.MADERNO.find(agent=>agent.id==='3');
  assert.equal(Object.values(m2.turni_settimanali)[0][3],'t2');
  assert.equal(Object.values(d2.turni_settimanali)[0][3],'__PRIVATE__');
  assert.equal(d2.variazioni_ods,undefined);
  assert.equal(d2.variazioni_ods_completi['2026-10-07'].turno_nuovo,'t2');
  assert.equal(Object.values(d2.turni_settimanali_completi)[0][3],'t2');
}
console.log('naviturni residence ok');
