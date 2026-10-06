#!/usr/bin/env node
// Riepilogo della giornata nelle notifiche push (push-summary.js + course-info.js).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const CourseInfo=require('../assets/js/course-info.js');
const Summary=require('../assets/js/push-summary.js');

const base={residenze:{
  DESENZANO:[
    {id:'1',agente:'ROSSI M.',qualifica:'marinaio',turni:{'2026-10-03':'D2','2026-10-06':'D2','2026-10-07':'RIP'}},
    {id:'2',agente:'BIANCHI L.',qualifica:'capitano',turni:{'2026-10-03':'D2','2026-10-06':'D2'}},
    {id:'3',agente:'VERDI A.',qualifica:'motorista',turni:{'2026-10-03':'D1','2026-10-06':'D1'}}
  ]},
  turni_navi:[
    {data:'2026-10-03',corsa:'D2',nave:'TONALE',inserita_il:'2026-09-01T10:00:00Z'},
    {data:'2026-10-03',corsa:'D2',nave:'SOLFERINO',ormeggio_serale:'pont. 2',inserita_il:'2026-10-02T10:00:00Z'},
    {data:'2026-10-06',corsa:'D2',nave:'BALDO',rifornimento_mattina:'Sì',ormeggio_serale:'pont. 3',inserita_il:'2026-10-02T10:00:00Z'}
  ]};
const opts={courseInfo:CourseInfo};

// Orario estivo, senza rifornimento: la lettura piu' recente della nave vale.
let s=Summary.buildSummary(base,'1','2026-10-03',opts);
assert.equal(s.title,'NaviSuite · sab 3 ott · D2 · SOLFERINO');
assert.equal(s.body,['Presentarsi alle 07:20','Prima partenza 08:20 · corse 8–13 · fine 18:25','Ormeggio serale: pont. 2','Equipaggio: BIANCHI L., ROSSI M.'].join('\n'));
assert.equal(s.presentation,'07:20');

// Orario invernale con rifornimento: presentazione 30 minuti prima (07:50 -> 07:20).
s=Summary.buildSummary(base,'1','2026-10-06',opts);
assert.equal(s.title,'NaviSuite · mar 6 ott · D2 · BALDO');
assert.match(s.body,/^Presentarsi alle 07:20 · ⛽ rifornimento\nPrima partenza 08:50 · corse 20–27 · fine 19:00\n/);

// Nave non ancora assegnata.
s=Summary.buildSummary(base,'3','2026-10-06',opts);
assert.match(s.body,/Presentarsi alle 08:15/);
assert.match(s.body,/Nave non ancora assegnata/);

// Riposo.
s=Summary.buildSummary(base,'1','2026-10-07',opts);
assert.equal(s.body,'RIP');
console.log('riepilogo push ok');

// Turno effettivo dai dati grezzi: import, variazioni ODS (la piu' recente
// vince, la manuale sopra), dati nave aggiornati.
{
  const sandbox={window:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},console,fetch:()=>Promise.reject(new Error('offline')),setTimeout,clearTimeout,Date,Promise,document:{}};
  sandbox.window.window=sandbox.window;sandbox.window.localStorage=sandbox.localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('assets/js/shared-data.js','utf8'),sandbox);
  const shared=sandbox.window.NaviSharedData;
  const raw={residenze:{DESENZANO:[{id:'1',agente:'ROSSI M.',qualifica:'marinaio',turni:{'2026-10-03':'D3'}}]},turni_navi:[]};
  const data=Summary.effectiveData(raw,{
    odsVariations:[{data:'2026-10-03',id_agente:'1',turno_nuovo:'D1',ods:'ODS 38'},{data:'2026-10-03',id_agente:'1',turno_nuovo:'D2',ods:'ODS 39'}],
    manualVariations:[],
    turniNavi:[{data:'2026-10-03',corsa:'D2',nave:'SOLFERINO',inserita_il:'2026-10-02T10:00:00Z'}],
    agentProfiles:{}
  },shared);
  assert.equal(raw.residenze.DESENZANO[0].turni['2026-10-03'],'D3','i dati di partenza non cambiano');
  s=Summary.buildSummary(data,'1','2026-10-03',opts);
  assert.equal(s.title,'NaviSuite · sab 3 ott · D2 · SOLFERINO');
  const manual=Summary.effectiveData(raw,{odsVariations:[{data:'2026-10-03',id_agente:'1',turno_nuovo:'D2',ods:'ODS 39'}],manualVariations:[{data:'2026-10-03',id_agente:'1',turno_nuovo:'RIP',tipo:'MANUALE'}]},shared);
  assert.equal(Summary.buildSummary(manual,'1','2026-10-03',opts).body,'RIP');
}
console.log('turno effettivo ok');
