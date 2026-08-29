#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');

const popup=fs.readFileSync('assets/js/day-popup.js','utf8');
const turni=fs.readFileSync('naviturni.html','utf8');
const diaria=fs.readFileSync('navidiaria.html','utf8');

assert.match(popup,/data-overtime-ordinary/);
assert.match(popup,/data-bubble-field="change"/);
assert.match(popup,/data-bubble-field="sentine"/);
assert.match(popup,/data-bubble-save/);
assert.ok(!popup.includes("onSave:value=>{overtime.setChanges(draft,value,service(draft));draft.changeDecision=value>0?'confirmed':'rejected';return save()}"));
assert.ok(turni.indexOf('assets/js/overtime-components.js')<turni.indexOf('assets/js/day-popup.js'));
assert.match(diaria,/assets\/js\/day-popup\.js\?v=12/);

console.log('Shared day popup regression test passed');
