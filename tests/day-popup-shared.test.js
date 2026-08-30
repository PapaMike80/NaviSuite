#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');

const popup=fs.readFileSync('assets/js/day-popup.js','utf8');
const turni=fs.readFileSync('naviturni.html','utf8');
const diaria=fs.readFileSync('navidiaria.html','utf8');
const monthly=fs.readFileSync('assets/js/navidiaria-monthly.js','utf8');
const app=fs.readFileSync('assets/js/app.js','utf8');

assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/day-popup.js'],{stdio:'pipe'}));
assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/navidiaria-monthly.js'],{stdio:'pipe'}));
assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/app.js'],{stdio:'pipe'}));
assert.ok(popup.trimStart().startsWith('(function(){'));
assert.doesNotMatch(popup,/^\[main\s+[0-9a-f]+\]/m);

assert.match(popup,/data-overtime-ordinary/);
assert.match(popup,/data-overtime-change/);
assert.match(popup,/data-overtime-sentine/);
assert.match(popup,/data-bubble-save/);
assert.match(popup,/initialSnapshot=snapshot\(draft\)/);
assert.match(popup,/await save\(\);dismiss\(\);render\(\)/);
assert.match(popup,/weekly-edit-close'\)\.onclick=\(\)=>form\.requestSubmit\(\)/);
assert.match(popup,/if\(!draft\|\|snapshot\(draft\)===initialSnapshot\)\{finalizeClose\(\);return true\}/);
assert.doesNotMatch(popup,/draft\.bank=0;draft\.overnight40=false/);
assert.match(monthly,/await window\.NaviDiariaRuntime\?\.saveNow\?\.\(\)/);
assert.match(app,/saveNow:saveEntriesNow/);
assert.ok(!popup.includes("onSave:value=>{overtime.setChanges(draft,value,service(draft));draft.changeDecision=value>0?'confirmed':'rejected';return save()}"));
assert.ok(turni.indexOf('assets/js/overtime-components.js')<turni.indexOf('assets/js/day-popup.js'));
assert.ok(diaria.indexOf('assets/js/overtime-components.js')<diaria.indexOf('assets/js/day-popup.js'));
assert.match(turni,/assets\/js\/day-popup\.js\?v=15/);
assert.match(diaria,/assets\/js\/day-popup\.js\?v=15/);

console.log('Shared day popup regression test passed');
