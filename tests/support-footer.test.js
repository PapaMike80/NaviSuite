const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');

const menu=fs.readFileSync('assets/js/shared-menu.js','utf8');
assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/shared-menu.js'],{stdio:'pipe'}));
assert.match(menu,/const NAVISUITE_KOFI_URL='https:\/\/ko-fi\.com\/papamike80';/);
assert.match(menu,/href="\s*'\+NAVISUITE_KOFI_URL\+'"/);
assert.match(menu,/id='navisuite-support-footer'/);
assert.match(menu,/target="_blank" rel="noopener noreferrer"/);
assert.match(menu,/aria-label="Offrimi un caffè e sostieni NaviSuite tramite Ko-fi"/);
assert.match(menu,/☕ Offrimi un caffè · 1 €/);
assert.doesNotMatch(menu,/paypal/i);
assert.match(menu,/min-height:44px/);
assert.doesNotMatch(menu,/\.navisuite-support-footer\{[^}]*position:\s*(?:fixed|sticky)/);

const settings=fs.readFileSync('impostazioni.html','utf8');
assert.match(settings,/<a href="https:\/\/ko-fi\.com\/papamike80" target="_blank" rel="noopener noreferrer" aria-label="Offrimi un caffè e sostieni NaviSuite tramite Ko-fi">/);
assert.doesNotMatch(settings,/paypal/i);

for(const file of ['index.html','naviturni.html','cambi_turno.html','navidiaria.html','documenti.html','agenti.html','impostazioni.html','aggiornamenti.html','quiz.html','cambia-pin.html','movimento.html','mio-turno.html','orario.html']){
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/assets\/js\/shared-menu\.js\?v=1\.80/,'shared footer cache version missing in '+file);
}

console.log('Support footer regression test passed');
