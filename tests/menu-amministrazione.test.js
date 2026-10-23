// Una pagina spostata dagli admin nella sezione Amministrazione non la vedono ne' la aprono gli utenti normali.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const codice = fs.readFileSync('assets/js/shared-roles.js', 'utf8');
function ruoli(agente, access) {
  const store = { 'navisuite.pageAccess': JSON.stringify(access), 'navidiaria.activeAgent': JSON.stringify(agente) };
  const ctx = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { pathname: '/index.html', search: '', replace() {} }, document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} },
    addEventListener() {}, dispatchEvent() {}, CustomEvent: function () {}, console, setTimeout() {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  return ctx.NaviRoles;
}
const access = { sezioni: { 'battaglia-garda.html': 'amministrazione' } };
const agente = ruoli({ id: '50', name: 'ROSSI M.' }, access);
assert.strictEqual(agente.puoAprire('battaglia-garda.html'), false, 'utente normale: pagina in Amministrazione chiusa');
assert.strictEqual(agente.puoAprire('mio-turno.html'), true, 'le altre pagine restano aperte');
const admin = ruoli({ id: '92', name: 'PEDRONI M.', role: 'admin' }, access);
assert.strictEqual(admin.puoAprire('battaglia-garda.html'), true, 'admin: la apre sempre');
const libera = ruoli({ id: '50', name: 'ROSSI M.' }, {});
assert.strictEqual(libera.puoAprire('battaglia-garda.html'), true, 'senza spostamento resta per tutti');
console.log('menu-amministrazione: ok');
