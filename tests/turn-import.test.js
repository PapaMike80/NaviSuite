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

// ---- naviturni: agente spostato, prima e dopo la decorrenza ---------------
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
  const makeAdapt=todayIso=>new Function('window','settimaneInfo','BARISTA_PRIVATE_SHIFT','normalizeOdsShift','localIsoToday',
    `${fn};return adattaFormatoNaviturni;`)(win,adaptInfo,'__PRIVATE__',value=>String(value).toLowerCase(),()=>todayIso);
  const days=['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'];
  const mover=()=>({id:'3',agente:'B X.',turni:Object.fromEntries(days.map(iso=>[iso,'R1'])),residenzaPrecedente:'DESENZANO',residenzaNuova:'MADERNO',residenzaDal:'2026-10-05'});
  // Il record base e' gia' nella residenza giusta secondo moveAgentToResidence
  // (shared-data.js), che gira PRIMA di adattaFormatoNaviturni: fino alla
  // decorrenza sta in DESENZANO, da quel giorno in poi in MADERNO.
  const dataset=todayIso=>{
    const home=todayIso<'2026-10-05'?'DESENZANO':'MADERNO';
    return {date:days.map(iso=>({iso})),residenze:{
      MADERNO:[{id:'1',agente:'A X.',turni:{}},{id:'2',agente:'C X.',turni:{}},...(home==='MADERNO'?[mover()]:[])],
      DESENZANO:home==='DESENZANO'?[mover()]:[]}};
  };

  // Prima della decorrenza: turni veri in DESENZANO (la sua vera residenza),
  // etichetta "A MADERNO" dal giorno del trasferimento; anteprima in MADERNO
  // etichettata "A DESENZANO" fino ad allora, poi i turni veri.
  const before=makeAdapt('2026-10-01')(dataset('2026-10-01'));
  const weekOf=agent=>Object.values(agent.turni_settimanali)[0];
  const desBefore=before.residenze.DESENZANO.find(agent=>agent.id==='3'),madBefore=before.residenze.MADERNO.find(agent=>agent.id==='3');
  assert.ok(desBefore&&madBefore,'prima della decorrenza compare in entrambe le residenze');
  assert.deepEqual(weekOf(desBefore),['r1',...Array(6).fill('A MADERNO')]);
  assert.deepEqual(weekOf(madBefore),['A DESENZANO',...Array(6).fill('r1')]);
  assert.deepEqual(before.residenze.MADERNO.map(agent=>agent.id),['1','3','2']);
  assert.equal(madBefore.residenzaDal,'2026-10-05');
  // La riga fissata in alto (mia / collega) porta sempre tutti i turni veri.
  assert.deepEqual(Object.values(desBefore.turni_settimanali_completi)[0],Array(7).fill('r1'));
  assert.deepEqual(Object.values(madBefore.turni_settimanali_completi)[0],Array(7).fill('r1'));
  assert.equal(before.residenze.MADERNO.find(agent=>agent.id==='1').turni_settimanali_completi,undefined);

  // Alla decorrenza (e dopo): sparisce del tutto da DESENZANO, in MADERNO e'
  // una riga normale con i turni veri, senza etichette ne' dati "completi".
  ['2026-10-05','2026-10-10'].forEach(todayIso=>{
    const after=makeAdapt(todayIso)(dataset(todayIso));
    assert.equal(after.residenze.DESENZANO.find(agent=>agent.id==='3'),undefined,`scomparso da Desenzano il ${todayIso}`);
    const mad=after.residenze.MADERNO.find(agent=>agent.id==='3');
    assert.ok(mad,`presente a Maderno il ${todayIso}`);
    assert.deepEqual(weekOf(mad),Array(7).fill('r1'));
    assert.equal(mad.turni_settimanali_completi,undefined);
  });

  // Variazione ODS su un giorno etichettato "A MADERNO": solo nei dati completi.
  const hdr=src.indexOf('function applyOdsVariations(');
  let e=src.indexOf('{',src.indexOf(')',hdr)),dd=0;
  for(;e<src.length;e++){if(src[e]==='{')dd++;if(src[e]==='}'&&--dd===0)break}
  const fnOds=src.slice(hdr,e+1),normFn=src.slice(src.indexOf('function normalizeOdsAgentName('));
  const nameFn=normFn.slice(0,normFn.indexOf('\n    }')+6);
  const isElsewhereSrc=src.slice(src.indexOf('const isElsewhereShift'),src.indexOf('const isElsewhereShift')+src.slice(src.indexOf('const isElsewhereShift')).indexOf(';')+1);
  const ods=new Function('settimaneInfo','BARISTA_PRIVATE_SHIFT','normalizeOdsShift',`${isElsewhereSrc};${nameFn};${fnOds};return applyOdsVariations;`);
  const apply=ods(adaptInfo,'__PRIVATE__',value=>String(value).toLowerCase());
  const done=apply({...before,variazioni_ods:[{data:'2026-10-07',id_agente:'3',agente:'B X.',turno_nuovo:'T2',ods:'ODS 1'}]});
  const d2=done.residenze.DESENZANO.find(agent=>agent.id==='3'),m2=done.residenze.MADERNO.find(agent=>agent.id==='3');
  assert.equal(Object.values(m2.turni_settimanali)[0][3],'t2');
  assert.equal(Object.values(d2.turni_settimanali)[0][3],'A MADERNO');
  assert.equal(d2.variazioni_ods,undefined);
  assert.equal(d2.variazioni_ods_completi['2026-10-07'].turno_nuovo,'t2');
  assert.equal(Object.values(d2.turni_settimanali_completi)[0][3],'t2');
}
console.log('naviturni residence ok');


// ---- naviturni: agenti che hanno terminato il servizio vengono nascosti ----
// (finche' non si carica/mostra il passato, dove riappaiono se avevano turni veri)
{
  const html=fs.readFileSync('naviturni.html','utf8');
  const scripts=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const src=scripts.find(text=>text.includes('function hasFinishedService'));
  function grabFn(name){
    const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('missing '+name);
    let j=src.indexOf('{',src.indexOf(')',i)),d=0;
    for(;j<src.length;j++){if(src[j]==='{')d++;if(src[j]==='}'&&--d===0)break}
    return src.slice(i,j+1);
  }
  const fns=['isRiposoShift','ottieniTurnoPulito','hasFinishedService'].map(grabFn).join('\n');
  const settimaneInfo=[
    {key:'w1',dateIso:['2020-01-01','2020-01-02']},
    {key:'w2',dateIso:['2099-01-01','2099-01-02']}
  ];
  const hasFinishedService=new Function('settimaneInfo',`${fns};return hasFinishedService;`)(settimaneInfo);
  const finished={turni_settimanali:{w1:['T1','R1'],w2:['CON','rip']}};
  const stillWorking={turni_settimanali:{w1:['CON','CON'],w2:['CON','T1']}};
  // Da oggi (floor 2099, "futuro" nel test) in poi: solo CON/RIP -> nascosto.
  // (buildRow riempie sempre ogni settimana, anche senza dati importati, con
  // "rip": un agente senza alcun turno vero da oggi in poi risulta comunque
  // terminato, ed e' corretto nasconderlo.)
  assert.equal(hasFinishedService(finished,'2099-01-01'),true,'terminato: solo CON/RIP da oggi in poi');
  assert.equal(hasFinishedService(stillWorking,'2099-01-01'),false,'ha ancora un turno vero in futuro');
  // Con il passato caricato (floor vuoto): i turni veri del 2020 lo fanno ricomparire.
  assert.equal(hasFinishedService(finished,''),false,'con il passato visibile riappare: aveva turni veri prima');
  assert.equal(hasFinishedService(stillWorking,''),false);
}
console.log('finished-service hide ok');

// ---- naviturni: nascondere i terminati non deve sfalsare gli indici -------
// (bug reale: se currentAgentsList viene filtrato, findLoggedAgentIndex - che
// cerca in globalData.residenze non filtrato - punta alla riga sbagliata e
// mostra un altro agente al posto del proprio, solo quando qualcuno prima in
// ordine di anzianita' e' nascosto).
{
  const html=fs.readFileSync('naviturni.html','utf8');
  const scripts=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const src=scripts.find(text=>text.includes('function hasFinishedService'));
  assert.doesNotMatch(src,/currentAgentsList\s*=\s*\([^)]*\)\.filter\(agent => !hasFinishedService/,
    'currentAgentsList non deve essere filtrato: sfalserebbe gli indici usati da getLoggedAgentLocation');
  assert.doesNotMatch(src,/currentAgentsList\s*=\s*currentAgentsList\.filter\(agent => !hasFinishedService/,
    'currentAgentsList non deve essere filtrato: sfalserebbe gli indici usati da getLoggedAgentLocation');
  assert.match(src,/if \(hasFinishedService\(agent\)\) return;\s*\n\s*restIndexes\.push\(index\);/,
    'il nascondere deve avvenire solo scegliendo quali righe disegnare (restIndexes), non rimuovendo elementi dall\'array');
}
console.log('finished-service index alignment ok');

// ---- naviturni: giorni "altrove" consecutivi in un'unica cella (colspan) --
{
  const html=fs.readFileSync('naviturni.html','utf8');
  const scripts=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const src=scripts.find(text=>text.includes('function elsewhereSpanLength'));
  function grabFn(name){
    const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('missing '+name);
    let j=src.indexOf('{',src.indexOf(')',i)),d=0;
    for(;j<src.length;j++){if(src[j]==='{')d++;if(src[j]==='}'&&--d===0)break}
    return src.slice(i,j+1);
  }
  const fns=['isRiposoShift','ottieniTurnoPulito','elsewhereSpanLength'].map(grabFn).join('\n');
  const dateCalendario=['2026-10-05','2026-10-06','2026-10-07','2026-10-08'].map(iso=>({iso}));
  const shifts={'2026-10-05':'A MADERNO','2026-10-06':'A MADERNO','2026-10-07':'A MADERNO','2026-10-08':'T1'};
  const isElsewhereShift=v=>v==='__PRIVATE__'||/^A [A-ZÀ-Ý' ]+$/.test(String(v||''));
  const getAgentShiftOnDate=(agent,iso)=>shifts[iso];
  const elsewhereSpanLength=new Function('dateCalendario','BARISTA_PRIVATE_SHIFT','isElsewhereShift','getAgentShiftOnDate',
    `${fns};return elsewhereSpanLength;`)(dateCalendario,'__PRIVATE__',isElsewhereShift,getAgentShiftOnDate);
  assert.equal(elsewhereSpanLength(null,'A MADERNO',0),3,'i 3 giorni consecutivi uguali si uniscono');
  assert.equal(elsewhereSpanLength(null,'A MADERNO',2),1,'l\'ultimo giorno della serie non si unisce col successivo diverso (T1)');
  assert.equal(elsewhereSpanLength(null,'T1',3),1,'un turno vero non si unisce mai');
  assert.equal(elsewhereSpanLength(null,'__PRIVATE__',0),1,'la sentinella bariste resta un pallino per giorno, non si unisce');
  // Il merge in tabella deve avvenire solo fuori dalla modalita' modifica.
  assert.match(src,/const span = isEditMode \? 1 : elsewhereSpanLength\(/);
}
console.log('elsewhere span merge ok');
