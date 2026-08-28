#!/usr/bin/env node
/* Regression: an ODS may continue its personnel variations on a scanned page.
 * This test runs the production parseOdsPdf function extracted from
 * aggiornamenti.html, so a change to the real parser is what it verifies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'aggiornamenti.html'), 'utf8');
const between = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const parserSource = `${between('    function linesFromItems', '    function rowsFromDelimited')}${between('    function parseOdsPdf', '    function odsDateRange')}`;
const csvSource = `${between('    const isoDate=', '    const italianDate=')}${between('    function rowsFromDelimited', '    function parseOdsPdf')}${between('    function parseCsvMatrix', '    function googleSheetCsvUrl')}`;
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
const italianDate = value => {
  const months = {GENNAIO:1,FEBBRAIO:2,MARZO:3,APRILE:4,MAGGIO:5,GIUGNO:6,LUGLIO:7,AGOSTO:8,SETTEMBRE:9,OTTOBRE:10,NOVEMBRE:11,DICEMBRE:12};
  const match = String(value || '').toUpperCase().match(/(\d{1,2})\s+(GENNAIO|FEBBRAIO|MARZO|APRILE|MAGGIO|GIUGNO|LUGLIO|AGOSTO|SETTEMBRE|OTTOBRE|NOVEMBRE|DICEMBRE)\s+(20\d{2})/);
  return match ? `${match[3]}-${String(months[match[2]]).padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
};
const known = new Map();
const resolveAgent = name => {
  const key = normalize(name);
  if (!known.has(key)) known.set(key, {id:known.size + 1, agente:name.trim().toUpperCase()});
  return known.get(key);
};
const parseOdsPdf = new Function('normalize', 'italianDate', 'resolveAgent', 'baseShift', `${parserSource}; return parseOdsPdf;`)(normalize, italianDate, resolveAgent, () => 'D1');
const page = (text, number) => text.trim().split(/\n/).map((line, index) => ({text:line.trim(), x:0, y:1000 - index * 20, page:number}));

const variations = parseOdsPdf([
  page(`
    VARIAZIONI TURNI DA UFFICIO
    VENERDI' 28 AGOSTO 2026
    DOLCERA: PonD
    SABATO 29 AGOSTO 2026
    GASPARINI: P2
  `, 2),
  // This is deliberately a separate page and includes the OCR-tolerant TURN!
  // spelling plus === between valid lines.
  page(`
    VARIAZIONI TURN! VOLONTARI – su richiesta degli Agenti
    VENERDI' 28 AGOSTO 2026
    HARRABI: P2
    REGA: ===
    SERVINO: R3
    SABATO 29 AGOSTO 2026
    HARRABI: ===
    REGA: P3
  `, 3),
], '33/2026');

assert.equal(variations.length, 7, 'must parse office and voluntary rows, including ===');
assert.deepEqual(variations.filter(row => row.tipo === 'ODS VOLONTARIO').map(row => `${row.data}|${row.agente}|${row.turno_nuovo}`), [
  '2026-08-28|HARRABI|P2',
  '2026-08-28|REGA|RIP',
  '2026-08-28|SERVINO|R3',
  '2026-08-29|HARRABI|RIP',
  '2026-08-29|REGA|P3',
]);
assert.equal(variations.filter(row => row.tipo === 'ODS UFFICIO').length, 2);

const rowsFromDelimited = new Function('normalize', `${csvSource}; return rowsFromDelimited;`)(normalize);
const csvRows = rowsFromDelimited(`Tipo_Variazione,Data,Dipendente,Turno_Assegnato
Ufficio,2026-08-28,DOLCERA,PonD
Volontario,2026-08-28,HARRABI,P2
Volontario,2026-08-28,REGA,rip`, 'ods');
assert.deepEqual(csvRows, [
  {data:'2026-08-28',agente:'DOLCERA',id_agente:'',turno_originale:'',turno_nuovo:'POND',tipo:'Ufficio',note:''},
  {data:'2026-08-28',agente:'HARRABI',id_agente:'',turno_originale:'',turno_nuovo:'P2',tipo:'Volontario',note:''},
  {data:'2026-08-28',agente:'REGA',id_agente:'',turno_originale:'',turno_nuovo:'RIP',tipo:'Volontario',note:''},
]);
console.log('ODS voluntary variations regression test passed');
