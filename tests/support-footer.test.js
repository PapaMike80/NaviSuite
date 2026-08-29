const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');

const menu=fs.readFileSync('assets/js/shared-menu.js','utf8');
assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','assets/js/shared-menu.js'],{stdio:'pipe'}));
assert.match(menu,/const NAVISUITE_PAYPAL_URL='https:\/\/www\.paypal\.com\/pool\/9sbGlr5lE9\?sr=wccr';/);
assert.match(menu,/id='navisuite-support-footer'/);
assert.match(menu,/target="_blank" rel="noopener noreferrer"/);
assert.match(menu,/aria-label="Offrimi un caffè e sostieni NaviSuite tramite PayPal"/);
assert.match(menu,/min-height:44px/);
assert.doesNotMatch(menu,/\.navisuite-support-footer\{[^}]*position:\s*(?:fixed|sticky)/);

for(const file of ['index.html','naviturni.html','cambi_turno.html','navidiaria.html','documenti.html','segnalazioni.html','agenti.html','impostazioni.html','aggiornamenti.html','Orario.html','orari-tabella.html','gestione_navi.html','quiz.html','cambia-pin.html','accademia_ufficio_movimento.html']){
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/assets\/js\/shared-menu\.js\?v=1\.46/,'shared footer cache version missing in '+file);
}

console.log('Support footer regression test passed');
