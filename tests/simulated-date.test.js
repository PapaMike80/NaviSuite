const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

test('simulated-date logic and admin check', () => {
  // Mock localStorage
  const storage = new Map();
  const localStorageMock = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  };

  const sandbox = {
    localStorage: localStorageMock,
    window: {},
    console,
    Date,
    CustomEvent: function (type, init) { this.type = type; this.detail = init?.detail; },
    document: {
      readyState: 'complete',
      getElementById: () => null,
      createElement: () => ({ setAttribute: () => {}, querySelector: () => null, style: {} }),
      body: { appendChild: () => {} },
      addEventListener: () => {}
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const code = fs.readFileSync('assets/js/simulated-date.js', 'utf8');
  vm.runInNewContext(code, sandbox);

  const NaviDate = sandbox.NaviDate;
  assert.ok(NaviDate, 'NaviDate should be exported');

  // Test 1: Senza login admin, non permette set o get
  localStorageMock.setItem('navidiaria.activeAgent', JSON.stringify({ id: '10', role: 'agente' }));
  assert.strictEqual(NaviDate.isAdmin(), false, 'Agente normale non è admin');
  assert.strictEqual(NaviDate.getSimulatedDate(), null, 'Non admin non legge data simulata');
  assert.strictEqual(NaviDate.setSimulatedDate('2026-08-15'), false, 'Non admin non può impostare data');

  // Test 2: Con login admin (es. id 91)
  localStorageMock.setItem('navidiaria.activeAgent', JSON.stringify({ id: '91', name: 'ADMIN', role: 'admin' }));
  assert.strictEqual(NaviDate.isAdmin(), true, 'ID 91 è admin');

  // Test 3: Data reale di default
  const realIso = NaviDate.realTodayIso();
  assert.match(realIso, /^\d{4}-\d{2}-\d{2}$/, 'Data reale è formato ISO');
  assert.strictEqual(NaviDate.isSimulated(), false, 'Inizialmente nessuna simulazione');
  assert.strictEqual(NaviDate.todayIso(), realIso, 'todayIso restituisce data reale');

  // Test 4: Imposta data simulata per admin
  const ok = NaviDate.setSimulatedDate('2026-08-15');
  assert.strictEqual(ok, true, 'Admin può impostare data simulata');
  assert.strictEqual(NaviDate.isSimulated(), true, 'Simulazione attiva');
  assert.strictEqual(NaviDate.getSimulatedDate(), '2026-08-15', 'Legge data simulata corretta');
  assert.strictEqual(NaviDate.todayIso(), '2026-08-15', 'todayIso restituisce la data simulata');

  // Test 5: Pulizia cache giornaliere
  localStorageMock.setItem('navisuite.oggi.snapshot.v1', 'snapshot-test');
  localStorageMock.setItem('turno_finali_data', 'turni-test');
  NaviDate.clearDailyCaches();
  assert.strictEqual(localStorageMock.getItem('navisuite.oggi.snapshot.v1'), null, 'Snapshot oggi rimosso');
  assert.strictEqual(localStorageMock.getItem('turno_finali_data'), null, 'Turno finali rimosso');

  // Test 6: Ripristino data reale
  NaviDate.clearSimulatedDate();
  assert.strictEqual(NaviDate.isSimulated(), false, 'Simulazione spenta dopo clear');
  assert.strictEqual(NaviDate.getSimulatedDate(), null, 'getSimulatedDate è null');
  assert.strictEqual(NaviDate.todayIso(), realIso, 'todayIso torna a data reale');
});

test('impostazioni.html contains simulated date controls', () => {
  const html = fs.readFileSync('impostazioni.html', 'utf8');
  assert.ok(html.includes('id="simulated-date-setting"'), 'impostazioni.html ha la sezione simulated-date-setting');
  assert.ok(html.includes('id="sim-date-input"'), 'impostazioni.html ha input per data');
  assert.ok(html.includes('id="sim-date-save-btn"'), 'impostazioni.html ha pulsante salvataggio');
  assert.ok(html.includes('id="sim-date-reset-btn"'), 'impostazioni.html ha pulsante ripristino');
  assert.ok(html.includes('simulated-date.js'), 'impostazioni.html carica simulated-date.js');
});
