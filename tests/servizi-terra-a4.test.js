const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

execFileSync(process.execPath, ['--check', 'assets/js/servizi-terra-a4.js'], { stdio: 'pipe' });
const html = fs.readFileSync('aggiornamenti.html', 'utf8');
assert.match(html, /assets\/js\/servizi-terra-a4\.js\?v=5/);
assert.match(html, /saveServiziTerraDocuments\(state\.turniNavi/); // ODS salvato: Documenti aggiornati
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
assert.match(page, /BOLGETTA · ARRIVA/);

// Maderno: navi di linea + traghetto, con le bolgette sulla R1.
const maderno = T.buildMadernoHtml();
assert.match(maderno, /<h1>MADERNO<\/h1>/);
assert.match(maderno, /BOLGETTA · PARTE/);
assert.match(maderno, /BOLGETTA · RIENTRA/);
assert.strictEqual((maderno.match(/class="time"/g) || []).length, 12);
assert.match(maderno, /pausa a Torri 13\.20 – 14\.20/);
const t1 = JSON.parse(JSON.stringify(T.ferryRows('T1')));
assert.deepStrictEqual(t1[0], { arr: null, dep: ['8.10', '201'], kind: 'prima' });
assert.deepStrictEqual(t1[t1.length - 1], { arr: ['18.30', '214'], dep: null, kind: 'ultima' });
assert.ok(!t1.some(row => row.kind === 'pausa-torri'));
assert.strictEqual(T.buildResidenceHtml('maderno', [], '2026-10-05'), maderno);
assert.doesNotMatch(T.buildResidenceHtml('MADERNO', [], '2026-10-05', { printButton: false }), /print-actions"><button/);

// Stampa unica con i due fogli e documenti per la pagina Documenti (uno per residenza, id fissi).
const all = T.buildAllHtml(rows, '2026-10-05');
assert.strictEqual((all.match(/<div class="sheet /g) || []).length, 2);
const docs = T.documents(rows, '2026-10-05');
assert.deepStrictEqual([...docs.map(doc => doc.metadata.id)], ['SERVIZI_TERRA_DESENZANO', 'SERVIZI_TERRA_MADERNO']);
assert.strictEqual(docs[0].metadata.settimana, '5/10 – 11/10');
assert.strictEqual(docs[0].metadata.fine, '2026-10-11');
assert.strictEqual(docs[1].metadata.inizio, '');
assert.ok(docs.every(doc => doc.metadata.tipo === 'servizi_terra' && doc.metadata.mimeType === 'text/html'));
assert.strictEqual(decodeURIComponent(docs[1].dataUrl.replace('data:text/html;charset=utf-8,', '')), maderno);

// Pagina Servizi a terra: pulsantini delle residenze come NaviTurni, nel menu e in Documenti.
const terraPage = fs.readFileSync('servizi-terra.html', 'utf8');
assert.match(terraPage, /class="servizi-terra-page"/);
assert.match(fs.readFileSync('assets/css/servizi-terra.css', 'utf8'), /quick-residence-btn\[data-res="MADERNO"\]/);
assert.match(terraPage, /servizi-terra-a4\.js\?v=5/);
assert.match(terraPage, /servizi-terra-page\.js\?v=3/);
assert.doesNotMatch(terraPage, /<iframe/); // pagina web, non il foglio A4
// Dati condivisi tra pagina web e foglio A4.
assert.deepStrictEqual([...T.DATA.SERVIZI.MADERNO.map(s => s[0])], ['AgM', 'AgT1']);
assert.strictEqual(T.DATA.NAVI.DESENZANO.length, 22);
assert.strictEqual(T.DATA.BOLGETTE.MADERNO[8], 'BOLGETTA · RIENTRA');
const week = T.ormeggiSettimana(rows, '2026-10-05');
assert.deepStrictEqual([...week.groups], ['D1']);
assert.strictEqual(week.days.length, 7);
execFileSync(process.execPath, ['--check', 'assets/js/servizi-terra-page.js'], { stdio: 'pipe' });
const menu = fs.readFileSync('assets/js/shared-menu.js', 'utf8');
assert.match(menu, /\['servizi-terra\.html','⛴','Servizi a terra'/);
assert.match(menu, /servizi-terra-page'\)\?'terra'/);
const documenti = fs.readFileSync('assets/js/documenti.js', 'utf8');
assert.match(documenti, /folders: \['turni', 'ods', 'stampe'\]/);
const documentiHtml = fs.readFileSync('documenti.html', 'utf8');
assert.match(documentiHtml, /id="terraGrid"/);
// Servizi a terra dopo gli ODS; sezioni chiuse all'apertura.
assert.ok(documentiHtml.indexOf('id="terra-docs"') > documentiHtml.indexOf('id="odsGrid"'));
assert.match(documenti, /SECTIONS = \[\['turni-docs', 'turniGrid'\], \['ods-docs', 'odsGrid'\], \['terra-docs', 'terraGrid'\]\]/);
assert.match(documenti, /setSectionOpen\(headingId, false\)/);
const titleFromFilename = new Function(`${documenti.match(/function titleFromFilename[\s\S]*?\n}\n/)[0]}; return titleFromFilename;`)();
assert.strictEqual(titleFromFilename('O.d.S. n. 39-2026 INVERNO.pdf', 'ods', 39), 'Ordine di servizio n. 39 — Inverno');
assert.strictEqual(titleFromFilename('O.d.S. n. 38-2026.pdf', 'ods', 38), 'Ordine di servizio n. 38');
// Nave di ogni turno nel giorno (tutti i turni, non solo quelli di Desenzano).
const ships = T.naviDelGiorno([...rows, { data: '2026-10-09', corsa: 'P2', nave: 'BALDO (B)', ods: 'ODS 39/2026' },
  { data: '2026-10-09', corsa: 'CAR/SR2', nave: 'MINCIO', ods: 'ODS 39/2026' }], '2026-10-09');
assert.deepStrictEqual(JSON.parse(JSON.stringify(ships)), { D1: 'AGONE', BIS: "D'ANNUNZIO", T1: 'BRESCIA', P2: 'BALDO', CAR: 'MINCIO', SR2: 'MINCIO' });
console.log('servizi-terra-a4 ok');
