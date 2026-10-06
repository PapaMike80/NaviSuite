const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

execFileSync(process.execPath, ['--check', 'assets/js/servizi-terra-a4.js'], { stdio: 'pipe' });
const html = fs.readFileSync('aggiornamenti.html', 'utf8');
assert.match(html, /assets\/js\/servizi-terra-a4\.js\?v=1/);
assert.match(html, /id="generate-servizi-terra"/);
assert.match(html, /id="servizi-terra-week"/);

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('assets/js/servizi-terra-a4.js', 'utf8'), context);
const T = context.window.NaviServiziTerra;

// Settimana in corso dal lunedi' al giovedi', la successiva da venerdi' (esce l'O.d.S.).
assert.strictEqual(T.defaultMonday(new Date(2026, 9, 5)), '2026-10-05');
assert.strictEqual(T.defaultMonday(new Date(2026, 9, 8)), '2026-10-05');
assert.strictEqual(T.defaultMonday(new Date(2026, 9, 9)), '2026-10-12');
assert.strictEqual(T.defaultMonday(new Date(2026, 9, 11)), '2026-10-12');

const rows = [
  { data: '2026-10-09', corsa: 'D1', nave: 'S. MARCO', ormeggio_serale: 'pont. 2', rifornimento_mattina: 'Sì', ods: 'ODS 39/2026' },
  { data: '2026-10-09', corsa: 'D1', nave: 'AGONE', ormeggio_serale: 'pont. 5', ods: 'ODS 40/2026' },
  { data: '2026-10-09', corsa: 'BIS', nave: "D'ANNUNZIO (B)", ormeggio_serale: '', ods: 'ODS 39/2026' },
  { data: '2026-10-09', corsa: 'T1', nave: 'BRESCIA', ormeggio_serale: 'porto esterno', ods: 'ODS 39/2026' },
  { data: '2026-10-10', corsa: 'D2', nave: 'BALDO', ormeggio_serale: 'pont. 3', ods: 'ODS 40/2026', attiva: false }
];
const index = T.indexTurniNavi(rows);
// Vince l'O.d.S. piu' recente; solo i gruppi di Desenzano; righe disattivate ignorate.
assert.deepStrictEqual(JSON.parse(JSON.stringify(index)), {
  '2026-10-09': {
    D1: { nave: 'AGONE', pontile: '5', rif: false, ods: '40' },
    BIS: { nave: "D'ANNUNZIO", pontile: '', rif: false, ods: '39' }
  }
});
// Le righe appena lette (non ancora salvate) vincono su quelle salvate.
const pending = T.indexTurniNavi([...rows, { ...rows[0], _pending: true }]);
assert.strictEqual(pending['2026-10-09'].D1.nave, 'S. MARCO');
assert.strictEqual(pending['2026-10-09'].D1.rif, true);

const page = T.buildHtml(rows.slice(0, 1), '2026-10-05');
assert.match(page, /ORMEGGI SERALI 5\/10 – 11\/10/);
assert.match(page, /<span class="pont">2<\/span><span class="rif">R<\/span>/);
assert.match(page, /nel prossimo<br>O\.d\.S\./);
assert.strictEqual((page.match(/class="time"/g) || []).length, 22);
console.log('servizi-terra-a4 ok');
