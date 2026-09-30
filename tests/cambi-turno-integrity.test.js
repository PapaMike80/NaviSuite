#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {readPage}=require('./read-page');
const {execFileSync}=require('node:child_process');

const html=readPage('cambi_turno.html');

assert.ok(html.startsWith('<!DOCTYPE html>'), 'cambi_turno.html deve iniziare con il doctype');
assert.doesNotMatch(html,/Warning:\s*truncated output/i);
assert.doesNotMatch(html,/original token count/i);
assert.doesNotMatch(html,/Total output lines/i);
assert.doesNotMatch(html,/^\[main\s+[0-9a-f]+\]/m);

const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match=>match[1])
  .filter(script=>script.trim());
for(const [index,script] of inlineScripts.entries()){
  assert.doesNotThrow(()=>new Function(script), `script inline ${index + 1} non valido`);
}

assert.match(html,/async function caricaDatiFirebase/);
assert.match(html,/processJSONData\(datiJson\)/);
assert.match(html,/async function loadFirebaseChangeRequests/);
assert.match(html,/loadFirebaseChangeRequests\(\)/);
assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/cambi-change-arrows.js'],{stdio:'pipe'}));
assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/turni-shared.js'],{stdio:'pipe'}));

console.log('Cambi turno integrity test passed');
