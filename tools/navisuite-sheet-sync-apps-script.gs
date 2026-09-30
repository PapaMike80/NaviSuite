/**
 * NaviSuite · Sincronizzazione automatica Foglio Google → Firebase
 *
 * Da incollare nell'editor Apps Script DEL FOGLIO dei turni
 * (Estensioni → Apps Script). Ad ogni modifica il foglio viene riletto e
 * pubblicato in private/adminUpdates/scheduleImports come importazione
 * "google_sheet": e' lo stesso formato del pulsante "Applica" di
 * aggiornamenti.html, quindi NaviSuite lo applica senza altre modifiche.
 *
 * Installazione: dall'editor Apps Script selezionare installaTrigger,
 * premere Esegui e autorizzare. Da quel momento ogni modifica al foglio
 * arriva su NaviSuite in pochi secondi (basta riaprire/aggiornare la pagina).
 * sincronizzaOra() forza una pubblicazione manuale.
 */
const SHEET_SYNC = Object.freeze({
  databaseUrl: 'https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app',
  // Web API key gia' pubblica nel frontend (assets/js/admin-firebase-rest.js).
  apiKey: 'AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE',
  authProperty: 'NAVISUITE_SHEET_SYNC_AUTH_V1',
  importId: 'SHEET_LIVE',
  importsPath: 'private/adminUpdates/scheduleImports'
});

// ---- Trigger -------------------------------------------------------------

function installaTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (['alModificaFoglio', 'controlloPeriodico'].includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  });
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('alModificaFoglio').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('alModificaFoglio').forSpreadsheet(ss).onChange().create();
  // Rete di sicurezza: se una pagina admin riscrive scheduleImports con una
  // copia vecchia, entro 5 minuti il foglio viene ripubblicato.
  ScriptApp.newTrigger('controlloPeriodico').timeBased().everyMinutes(5).create();
  sincronizzaOra();
}

function alModificaFoglio() { sync_(false); }
function controlloPeriodico() { sync_(false); }
function sincronizzaOra() { const result = sync_(true); Logger.log(JSON.stringify(result)); return result; }

// ---- Sincronizzazione ----------------------------------------------------

function sync_(force) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { skipped: 'lock' };
  try {
    const batch = batchFromSheet_();
    const imports = asArray_(firebase_('GET', SHEET_SYNC.importsPath));
    const current = imports.find(item => item && item.id === SHEET_SYNC.importId && item.attiva !== false);
    if (!force && current && current.sheetHash === batch.sheetHash) return { unchanged: true };

    const now = new Date().toISOString();
    const next = imports
      .filter(item => item && item.id !== SHEET_SYNC.importId)
      .map(item => item.source === 'google_sheet' && item.attiva !== false
        ? Object.assign({}, item, { attiva: false, replacedAt: now })
        : item)
      .concat(Object.assign(batch, { importedAt: now }));
    firebase_('PUT', SHEET_SYNC.importsPath, next);
    return { updated: true, agenti: batch.rows.length, giornate: batch.dates.length };
  } finally {
    lock.releaseLock();
  }
}

function batchFromSheet_() {
  const ss = SpreadsheetApp.getActive();
  // Il foglio turni e' quello con "agent_uid" in A1 (gli altri fogli, es.
  // anzianita' o riepiloghi, vengono ignorati).
  const sheet = ss.getSheets().find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  if (!sheet) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  const matrix = sheet.getDataRange().getDisplayValues();
  const header = matrix.shift().map(value => String(value || '').trim());
  const normalized = header.map(normalizeHeader_);
  const uidIndex = normalized.indexOf('AGENTUID');
  const nameIndex = normalized.indexOf('AGENTE');
  const residenceIndex = normalized.indexOf('RESIDENZA');
  const dateColumns = header.map((value, index) => ({ date: isoDate_(value), index })).filter(item => item.date);
  if (nameIndex < 0 || !dateColumns.length) throw new Error('Servono le colonne agent_uid, agente, residenza e almeno una data');

  const rows = [];
  matrix.forEach(values => {
    const name = String(values[nameIndex] || '').trim();
    const uid = String((uidIndex >= 0 && values[uidIndex]) || '').trim() || stableAgentUid_(name);
    if (!name && !uid) return;
    rows.push({
      id_agente: '',
      agent_uid: uid,
      agente: name,
      residenza: residenceIndex >= 0 ? String(values[residenceIndex] || '').trim().toUpperCase() : '',
      turni: dateColumns.map(column => normalizeShift_(values[column.index]))
    });
  });
  if (!rows.length) throw new Error('Il foglio non contiene righe turno');

  const dates = dateColumns.map(item => item.date);
  const payload = JSON.stringify({ dates, rows });
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8);
  return {
    id: SHEET_SYNC.importId,
    tipo: 'turno',
    filename: 'Foglio Google (sincronizzazione automatica)',
    dates,
    rows,
    inizio: dates[0],
    fine: dates[dates.length - 1],
    source: 'google_sheet',
    sheetUrl: ss.getUrl(),
    sheetHash: Utilities.base64Encode(digest),
    identityVersion: 2,
    attiva: true
  };
}

// ---- Normalizzazione (stesse regole di aggiornamenti.html) -----------------

function normalizeHeader_(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function isoDate_(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!m) return '';
  const year = m[3].length === 2 ? '20' + m[3] : m[3];
  return year + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
}

function normalizeShift_(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase().replace(/[\u2010\u2011\u2013\u2014]/g, '-');
  if (!raw || /^(?:RIP(?:\.|-*)?|RIPOSO|-{2,}|={2,})$/.test(raw)) return 'RIP';
  if (/^(?:CONG?\.?|CON[;/]|CONC\.?|C\.)$/.test(raw)) return 'CON';
  if (/^LAV[.;]?$/.test(raw)) return 'LAV';
  if (/^L\.?D[.;]?$/.test(raw)) return 'L.D.';
  if (/^F\.?P\.?-*$/.test(raw)) return 'F.P.';
  return raw.replace(/\.{2,}$/g, '.').replace(/-+$/g, '');
}

function stableAgentUid_(value) {
  const key = String(value || '').trim().toUpperCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return key ? 'AG_' + key : '';
}

// ---- Firebase REST (utente anonimo, come il frontend) ----------------------

function asArray_(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value && typeof value === 'object' ? Object.keys(value).map(key => value[key]).filter(Boolean) : [];
}

function firebase_(method, path, body) {
  const auth = firebaseAuth_();
  const url = SHEET_SYNC.databaseUrl + '/' + path + '.json?auth=' + encodeURIComponent(auth.idToken);
  const options = { method: method.toLowerCase(), muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined) options.payload = JSON.stringify(body);
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Firebase HTTP ' + code + ': ' + response.getContentText().slice(0, 200));
  const text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function firebaseAuth_() {
  const props = PropertiesService.getScriptProperties();
  let auth = null;
  try { auth = JSON.parse(props.getProperty(SHEET_SYNC.authProperty) || 'null'); } catch (_) {}
  if (auth && auth.idToken && Number(auth.expiresAt || 0) > Date.now() + 120000) return auth;
  if (auth && auth.refreshToken) {
    const response = UrlFetchApp.fetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(SHEET_SYNC.apiKey), {
      method: 'post', muteHttpExceptions: true, contentType: 'application/x-www-form-urlencoded',
      payload: { grant_type: 'refresh_token', refresh_token: auth.refreshToken }
    });
    const data = JSON.parse(response.getContentText() || '{}');
    if (response.getResponseCode() < 300 && data.id_token) {
      auth = { idToken: data.id_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
      props.setProperty(SHEET_SYNC.authProperty, JSON.stringify(auth));
      return auth;
    }
  }
  const response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + encodeURIComponent(SHEET_SYNC.apiKey), {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json', payload: JSON.stringify({ returnSecureToken: true })
  });
  const data = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() >= 300 || !data.idToken) throw new Error('Autenticazione Firebase non riuscita');
  auth = { idToken: data.idToken, refreshToken: data.refreshToken, expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 };
  props.setProperty(SHEET_SYNC.authProperty, JSON.stringify(auth));
  return auth;
}

// ---- Colori dei gradi ------------------------------------------------------
// Stessi colori di NaviTurni (gradeInfo in naviturni.html). Colora le colonne
// agent_uid/agente/residenza del foglio turni leggendo il grado dal foglio
// "Anzianita e gradi" (colonne Agente e Grado). Eseguire coloraGradi() a mano
// dopo aver cambiato i gradi; non influisce sulla sincronizzazione.

const GRADE_COLORS = Object.freeze({
  CAPITANO: '#facc15',
  CAPO_TIMONIERE: '#fb923c',
  TIMONIERE: '#22c55e',
  AIUTO_MOTORISTA: '#3b82f6',
  MOTORISTA: '#a855f7',
  MARINAIO: '#9ca3af',
  OPERAIO: '#14b8a6',
  BARISTA: '#f472b6'
});

function coloraGradi() {
  const ss = SpreadsheetApp.getActive();
  const turni = ss.getSheets().find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  const gradi = ss.getSheets().find(s => normalizeHeader_(s.getName()).indexOf('GRADI') >= 0);
  if (!turni) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  if (!gradi) throw new Error('Nessun foglio "Anzianita e gradi"');

  const gradeMatrix = gradi.getDataRange().getDisplayValues();
  const gradeHeader = gradeMatrix.shift().map(normalizeHeader_);
  const agentCol = gradeHeader.indexOf('AGENTE');
  const gradeCol = gradeHeader.indexOf('GRADO');
  if (agentCol < 0 || gradeCol < 0) throw new Error('Nel foglio gradi servono le colonne Agente e Grado');
  const gradeByAgent = {};
  gradeMatrix.forEach(row => { gradeByAgent[normalizeHeader_(row[agentCol])] = gradeKey_(row[gradeCol]); });

  const header = turni.getRange(1, 1, 1, turni.getLastColumn()).getDisplayValues()[0].map(normalizeHeader_);
  const nameIndex = header.indexOf('AGENTE');
  const infoColumns = Math.max(nameIndex, header.indexOf('RESIDENZA'), header.indexOf('AGENTUID')) + 1;
  const lastRow = turni.getLastRow();
  if (nameIndex < 0 || lastRow < 2) return;
  const names = turni.getRange(2, nameIndex + 1, lastRow - 1, 1).getDisplayValues();
  const backgrounds = [];
  const fonts = [];
  names.forEach(([name]) => {
    const color = GRADE_COLORS[gradeByAgent[normalizeHeader_(name)]] || null;
    const tint = color ? mixWithWhite_(color, 0.7) : null;
    backgrounds.push(new Array(infoColumns).fill(tint));
    fonts.push(new Array(infoColumns).fill(color ? '#111827' : null));
  });
  const range = turni.getRange(2, 1, lastRow - 1, infoColumns);
  range.setBackgrounds(backgrounds);
  range.setFontColors(fonts);
  turni.getRange(2, nameIndex + 1, lastRow - 1, 1).setFontWeight('bold');
}

function gradeKey_(value) {
  const raw = String(value || '').toUpperCase();
  if (raw.indexOf('CAPITANO') >= 0) return 'CAPITANO';
  if (raw.indexOf('CAPO') >= 0 && raw.indexOf('TIMON') >= 0) return 'CAPO_TIMONIERE';
  if (raw.indexOf('AIUTO') >= 0 && raw.indexOf('MOTOR') >= 0) return 'AIUTO_MOTORISTA';
  if (raw.indexOf('MOTORISTA') >= 0) return 'MOTORISTA';
  if (raw.indexOf('TIMONIERE') >= 0) return 'TIMONIERE';
  if (raw.indexOf('OPERAIO') >= 0) return 'OPERAIO';
  if (raw.indexOf('BARIST') >= 0) return 'BARISTA';
  if (raw.indexOf('MARINAIO') >= 0) return 'MARINAIO';
  return '';
}

function mixWithWhite_(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channel = shift => Math.round(((n >> shift) & 255) * (1 - amount) + 255 * amount);
  return '#' + [16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('');
}

// ---- Colori dei turni ------------------------------------------------------
// Formattazione condizionale sulle celle turno: i colori seguono il valore,
// quindi si aggiornano da soli quando un turno viene modificato. Gruppi e
// colori come in NaviTurni (D1=R1=P1=T1, D2=R2=P2=T2, D3=R3=P3=M1, ...).
// Riconosce anche trasferte (C...C) e istruttore (*), es. CDTC, CPODC, D2*.
// Eseguire coloraTurni() una volta (o dopo aver aggiunto colonne/righe).

const SHIFT_COLOR_RULES = [
  { codes: 'D1|R1|P1|T1', color: '#2563eb' },
  { codes: 'D2|R2|P2|T2', color: '#059669' },
  { codes: 'D3|R3|P3|M1', color: '#ea580c' },
  { codes: 'D4|R4|P4', color: '#c026d3' },
  { codes: 'BIS', color: '#0891b2' },
  { codes: 'DT', color: '#a16207' },
  { codes: 'POND?|POD|PONM', color: '#dc2626' },
  { codes: 'AG[BMT]\\d?', color: '#0369a1' },
  { codes: 'CAR\\d?|CAP\\d?', color: '#db2777' },
  { codes: 'SR1', color: '#7c3aed' },
  { codes: 'LAV\\.?|TERRA|L\\.?D\\.?|F\\.?P\\.?|CON[G.;]?|S\\.S\\.|PROVE|#', color: '#64748b', plain: true }
];
const SHIFT_RULE_MARKER = 'N("navisuite-turni")';

function coloraTurni() {
  const sheet = SpreadsheetApp.getActive().getSheets()
    .find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  if (!sheet) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const firstDate = header.findIndex(value => isoDate_(value)) + 1;
  if (firstDate < 1 || sheet.getLastRow() < 2) return;
  const range = sheet.getRange(2, firstDate, sheet.getMaxRows() - 1, sheet.getLastColumn() - firstDate + 1);
  const cell = range.getCell(1, 1).getA1Notation();

  const rules = SHIFT_COLOR_RULES.map(item => {
    const regex = '^C?(?:' + item.codes + ')C?\\*?$';
    const builder = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=REGEXMATCH(UPPER(TRIM(' + cell + ')),"' + regex + '")+' + SHIFT_RULE_MARKER)
      .setFontColor(item.color)
      .setRanges([range]);
    if (!item.plain) builder.setBackground(mixWithWhite_(item.color, 0.82)).setBold(true);
    return builder.build();
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=REGEXMATCH(UPPER(TRIM(' + cell + ')),"^(RIP\\.?|RIPOSO|-+)$")+' + SHIFT_RULE_MARKER)
    .setFontColor('#b6bcc6')
    .setRanges([range])
    .build());

  // Sostituisce solo le regole create da questo script, lascia le altre.
  const others = sheet.getConditionalFormatRules().filter(rule => {
    const condition = rule.getBooleanCondition();
    const values = condition ? condition.getCriteriaValues() : [];
    return !values.some(value => String(value).indexOf(SHIFT_RULE_MARKER) >= 0);
  });
  sheet.setConditionalFormatRules(others.concat(rules));
  range.setHorizontalAlignment('center');
}

function coloraTutto() {
  coloraGradi();
  coloraTurni();
}
