const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

test('variazioni pastiglie (ODS, Movimento, Collega)', () => {
  const context = { window: {}, console };
  context.globalThis = context;
  context.window = context;

  const codeTurni = fs.readFileSync('assets/js/turni-giorno.js', 'utf8');
  vm.runInNewContext(codeTurni, context);

  const G = context.NaviTurniGiorno;
  assert.ok(G.variazioniTurno, 'variazioniTurno function exists');
  assert.ok(G.formattaPastiglieVariazioni, 'formattaPastiglieVariazioni function exists');

  const schedule = {
    residenze: {
      DESENZANO: [
        { id: '1', agente: 'GIACCI GL.', qualifica: 'Capo timoniere', turni: { '2026-10-30': 'D2' } },
        { id: '2', agente: 'BERGAMINI D.', qualifica: 'Motorista', turni: { '2026-10-30': 'RIP' } },
        { id: '31', agente: 'TANZI E.', qualifica: 'Marinaio', turni: { '2026-10-30': 'CON' } },
        { id: '4', agente: 'TURRINI M.', qualifica: 'Marinaio', turni: { '2026-10-30': 'D1' } }
      ]
    },
    variazioni_ods: [
      { data: '2026-10-30', id_agente: '31', agente: 'TANZI E.', turno_originale: 'CON', turno_nuovo: 'D1', ods: 'MOVIMENTO', note: 'Movimento (PEDRONI M.)' },
      { data: '2026-10-30', id_agente: '2', agente: 'BERGAMINI D.', turno_originale: 'RIP', turno_nuovo: 'D1', ods: 'ODS 39/2026' },
      { data: '2026-10-30', id_agente: '1', agente: 'GIACCI GL.', turno_originale: 'D2', turno_nuovo: 'D1', tipo: 'MANUALE', requestId: 'REQ_1', collega: 'ROSSI M.' }
    ]
  };

  const crew = [
    { id: '1', name: 'GIACCI GL.', grado: ['Capo timoniere', '#fb923c', 1] },
    { id: '2', name: 'BERGAMINI D.', grado: ['Motorista', '#a855f7', 2] },
    { id: '31', name: 'TANZI E.', grado: ['Marinaio', '#ffffff', 5] },
    { id: '4', name: 'TURRINI M.', grado: ['Marinaio', '#ffffff', 5] }
  ];

  const vars = G.variazioniTurno(schedule, 'D1', '2026-10-30', crew);
  assert.equal(vars.length, 3, 'Should find 3 variations');

  const colle = vars.find(v => v.tipo === 'collega');
  assert.ok(colle, 'Collega variation exists');
  assert.equal(colle.agentName, 'GIACCI GL.');
  assert.equal(colle.originalShift, 'D2');

  const ods = vars.find(v => v.tipo === 'ods');
  assert.ok(ods, 'ODS variation exists');
  assert.equal(ods.agentName, 'BERGAMINI D.');
  assert.equal(ods.originalShift, 'RIP');

  const mov = vars.find(v => v.tipo === 'movimento');
  assert.ok(mov, 'Movimento variation exists');
  assert.equal(mov.agentName, 'TANZI E.');
  assert.equal(mov.originalShift, 'CON');
  assert.equal(mov.author, 'PEDRONI M.');

  const htmlNt = G.formattaPastiglieVariazioni(vars, 'nt');
  assert.ok(htmlNt.includes('nt-var-chip nt-var-movimento'), 'Has Movimento chip');
  assert.ok(htmlNt.includes('Movimento (PEDRONI M.): TANZI E. (da CON)'), 'Has proper Movimento text');
  assert.ok(htmlNt.includes('nt-var-chip nt-var-ods'), 'Has ODS chip');
  assert.ok(htmlNt.includes('ODS 39/2026: BERGAMINI D. (da RIP)'), 'Has proper ODS text');
  assert.ok(htmlNt.includes('nt-var-chip nt-var-collega'), 'Has Collega chip');
  assert.ok(htmlNt.includes('Collega (ROSSI M.): GIACCI GL. (da D2)'), 'Has proper Collega text');

  const htmlMt = G.formattaPastiglieVariazioni(vars, 'mt');
  assert.ok(htmlMt.includes('mt-var-chip mt-var-movimento'), 'Has MT Movimento chip');
});
