#!/usr/bin/env node
// Cambio di residenza impostato dalla pagina Agenti (profilo Firebase).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loadShared(store={}){
  const localStorage={getItem:key=>key in store?store[key]:null,setItem:(key,value)=>{store[key]=String(value)},removeItem:key=>{delete store[key]}};
  const sandbox={window:{},localStorage,console,fetch:()=>Promise.reject(new Error('offline')),setTimeout,clearTimeout,Date,Promise,document:{}};
  sandbox.window.window=sandbox.window;sandbox.window.localStorage=localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('assets/js/shared-data.js','utf8'),sandbox);
  return sandbox.window.NaviSharedData;
}
const shared=loadShared();
const fresh=()=>({residenze:{
  DESENZANO:[{id:'91',agente:'ROSSI M.',turni:{}},{id:'92',agente:'BIANCHI L.',turni:{}}],
  MADERNO:[{id:'50',agente:'VERDI A.',turni:{}}],
  RIVA:[{id:'21',agente:'NERI O.',turni:{}}]
}});
const names=list=>list.map(agent=>agent.agente);
const profiles={
  a:{id:'91',name:'ROSSI M.',residenzaPrecedente:'DESENZANO',residenzaNuova:'MADERNO',residenzaDal:'2026-10-05'},
  b:{id:'21',name:'NERI O.',residenzaPrecedente:'RIVA',residenzaNuova:'MADERNO',residenzaDal:'2026-10-19'},
  c:{id:'92',qualifica:'marinaio'}
};

// Prima della decorrenza resta nella residenza di partenza, con i dati del cambio.
let data=shared.applyProfileResidenceMoves(fresh(),profiles,{today:'2026-10-02'});
assert.deepEqual(names(data.residenze.DESENZANO),['ROSSI M.','BIANCHI L.']);
const rossi=data.residenze.DESENZANO[0];
assert.equal(rossi.residenzaNuova,'MADERNO');
assert.equal(rossi.residenzaDal,'2026-10-05');
assert.equal(rossi.residenzaPrecedente,'DESENZANO');

// Dal giorno della decorrenza e' nella nuova residenza.
data=shared.applyProfileResidenceMoves(fresh(),profiles,{today:'2026-10-05'});
assert.deepEqual(names(data.residenze.DESENZANO),['BIANCHI L.']);
assert.ok(names(data.residenze.MADERNO).includes('ROSSI M.'));
assert.deepEqual(names(data.residenze.RIVA),['NERI O.']);
data=shared.applyProfileResidenceMoves(fresh(),profiles,{today:'2026-10-19'});
assert.deepEqual(data.residenze.RIVA,[]);
assert.ok(names(data.residenze.MADERNO).includes('NERI O.'));

// Idempotente: con i dati gia' spostati (es. il foglio aggiornato) non cambia nulla.
const moved=shared.applyProfileResidenceMoves(fresh(),profiles,{today:'2026-10-05'});
const again=shared.applyProfileResidenceMoves(moved,profiles,{today:'2026-10-05'});
assert.equal(again.residenze.MADERNO.filter(agent=>agent.agente==='ROSSI M.').length,1);

// Il cambio della pagina Agenti vale piu' di quello letto dal turno.
const imported=fresh();
Object.assign(imported.residenze.RIVA[0],{residenzaPrecedente:'RIVA',residenzaNuova:'MADERNO',residenzaDal:'2026-10-05'});
data=shared.applyProfileResidenceMoves(imported,profiles,{today:'2026-10-12'});
assert.deepEqual(names(data.residenze.RIVA),['NERI O.']);
assert.equal(data.residenze.RIVA[0].residenzaDal,'2026-10-19');
console.log('cambio residenza da Agenti ok');

