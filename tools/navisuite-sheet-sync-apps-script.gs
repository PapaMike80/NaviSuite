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
 * sincronizzaOra() forza una pubblicazione manuale; estendiFoglio() aggiunge
 * le date che NaviSuite ha gia' (es. un nuovo turno da PDF) ma il foglio no.
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

function alModificaFoglio() {
  sync_(false);
  // Il colore dei turni non deve mai bloccare la sincronizzazione.
  try { coloraTurni(); } catch (error) { Logger.log('coloraTurni: ' + error); }
}
function controlloPeriodico() {
  sync_(false);
  // Il trigger ogni 5 minuti tiene nascoste anche le giornate appena passate.
  try { nascondiGiorniPassati(); } catch (error) { Logger.log('nascondiGiorniPassati: ' + error); }
}
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

// ---- Giornate passate ------------------------------------------------------
// Nasconde le colonne delle date piu' vecchie di GIORNI_PASSATI_VISIBILI
// giorni (restano nel foglio e continuano a essere sincronizzate) e mostra
// l'ultima settimana passata e tutte le date da oggi in avanti.
// mostraTutteLeDate() le rende di nuovo visibili tutte.

const GIORNI_PASSATI_VISIBILI = 7;

function nascondiGiorniPassati() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheets().find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  if (!sheet) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const firstVisible = Utilities.formatDate(new Date(Date.now() - GIORNI_PASSATI_VISIBILI * 86400000), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const dates = header.map((value, index) => ({ iso: isoDate_(value), column: index + 1 })).filter(item => item.iso);
  const past = dates.filter(item => item.iso < firstVisible);
  const upcoming = dates.filter(item => item.iso >= firstVisible);
  if (past.length) sheet.hideColumns(past[0].column, past[past.length - 1].column - past[0].column + 1);
  if (upcoming.length) sheet.showColumns(upcoming[0].column, upcoming[upcoming.length - 1].column - upcoming[0].column + 1);
  // Anche il cambio di giorno sposta il bordo colorato sulla nuova colonna.
  evidenziaOggi_(sheet, header, dates.map(item => item.column - 1));
  return { nascoste: past.length, visibili: upcoming.length };
}

function mostraTutteLeDate() {
  const sheet = SpreadsheetApp.getActive().getSheets()
    .find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  if (!sheet) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  sheet.showColumns(1, sheet.getLastColumn());
}

// ---- Estensione del foglio con i turni gia' su NaviSuite -------------------
// Aggiunge in fondo al foglio le date che NaviSuite conosce ma il foglio non
// ha ancora (es. un nuovo turno caricato da PDF), riempiendole con i turni
// attuali di ogni agente. Gli agenti presenti su NaviSuite ma non nel foglio
// (es. neo assunti) vengono aggiunti come nuove righe. Eseguire a mano.

function estendiFoglio() {
  const sheet = SpreadsheetApp.getActive().getSheets()
    .find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  if (!sheet) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  const lastColumn = sheet.getLastColumn();
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const headerDisplay = headerRange.getDisplayValues()[0];
  const headerValues = headerRange.getValues()[0];
  const normalized = headerDisplay.map(normalizeHeader_);
  const uidIndex = normalized.indexOf('AGENTUID');
  const nameIndex = normalized.indexOf('AGENTE');
  const residenceIndex = normalized.indexOf('RESIDENZA');
  const dateIndexes = headerDisplay.map((value, index) => isoDate_(value) ? index : -1).filter(index => index >= 0);
  if (nameIndex < 0 || !dateIndexes.length) throw new Error('Servono le colonne agente e almeno una data');
  const lastDateIndex = dateIndexes[dateIndexes.length - 1];
  const lastIso = dateIndexes.map(index => isoDate_(headerDisplay[index])).sort().pop();

  const shiftsByAgent = naviSuiteShifts_();
  const newDates = [];
  Object.keys(shiftsByAgent).forEach(key => Object.keys(shiftsByAgent[key].turni).forEach(iso => {
    if (iso > lastIso && newDates.indexOf(iso) < 0) newDates.push(iso);
  }));
  newDates.sort();
  if (!newDates.length) {
    Logger.log('Il foglio arriva gia\' all\'ultima data di NaviSuite (' + lastIso + ').');
    return { aggiunte: 0 };
  }

  // Righe agente: quelle del foglio piu' gli agenti mancanti.
  const lastRow = sheet.getLastRow();
  const matrix = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues() : [];
  const rowKeys = matrix.map(row => {
    const name = String(row[nameIndex] || '').trim();
    return (uidIndex >= 0 && String(row[uidIndex] || '').trim()) || stableAgentUid_(name);
  });
  const byName = {};
  Object.keys(shiftsByAgent).forEach(key => { byName[normalizeHeader_(shiftsByAgent[key].agente)] = key; });
  const resolve = (key, name) => shiftsByAgent[key] ? key : byName[normalizeHeader_(name)];
  const used = {};
  matrix.forEach((row, index) => {
    const key = resolve(rowKeys[index], row[nameIndex]);
    if (key) used[key] = true;
  });
  const missing = Object.keys(shiftsByAgent).filter(key => !used[key] &&
    newDates.some(iso => shiftsByAgent[key].turni[iso]));

  // Nuove colonne subito dopo l'ultima data, con lo stesso formato.
  sheet.insertColumnsAfter(lastDateIndex + 1, newDates.length);
  const firstNew = lastDateIndex + 2;
  const sample = headerValues[lastDateIndex];
  const headerCells = newDates.map(iso => {
    if (sample instanceof Date) return new Date(iso + 'T12:00:00');
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(headerDisplay[lastDateIndex]).trim())) return iso;
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  });
  const totalRows = Math.max(lastRow, 1) + missing.length;
  sheet.getRange(1, lastDateIndex + 1, totalRows, 1)
    .copyFormatToRange(sheet, firstNew, firstNew + newDates.length - 1, 1, totalRows);
  if (sample instanceof Date) sheet.getRange(1, firstNew, 1, newDates.length).setNumberFormat(sheet.getRange(1, lastDateIndex + 1).getNumberFormat());
  sheet.getRange(1, firstNew, 1, newDates.length).setValues([headerCells]);

  const valuesFor = key => newDates.map(iso => sheetShift_(key && shiftsByAgent[key].turni[iso]));
  if (matrix.length) {
    sheet.getRange(2, firstNew, matrix.length, newDates.length)
      .setValues(matrix.map((row, index) => valuesFor(resolve(rowKeys[index], row[nameIndex]))));
  }
  if (missing.length) {
    const width = sheet.getLastColumn();
    const rows = missing.map(key => {
      const row = new Array(width).fill('');
      if (uidIndex >= 0) row[uidIndex] = key;
      row[nameIndex] = shiftsByAgent[key].agente;
      if (residenceIndex >= 0) row[residenceIndex] = shiftsByAgent[key].residenza;
      valuesFor(key).forEach((value, offset) => { row[firstNew - 1 + offset] = value; });
      return row;
    });
    sheet.getRange(lastRow + 1, 1, rows.length, width).setValues(rows);
  }

  // Il controllo dei codici turno (convalida dati sulle celle) viene esteso
  // alle nuove colonne e alle nuove righe copiandolo dall'ultima data e
  // dall'ultima riga gia' presenti.
  if (lastRow > 1) {
    const paste = SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION;
    sheet.getRange(2, lastDateIndex + 1, lastRow - 1, 1)
      .copyTo(sheet.getRange(2, firstNew, lastRow - 1, newDates.length), paste, false);
    if (missing.length) {
      const firstDate = dateIndexes[0] + 1;
      const width = firstNew + newDates.length - firstDate;
      sheet.getRange(lastRow, firstDate, 1, width)
        .copyTo(sheet.getRange(lastRow + 1, firstDate, missing.length, width), paste, false);
    }
  }

  // Le modifiche fatte da script non fanno scattare i trigger: si pubblica
  // e si ricolora qui.
  try { coloraGradi(); } catch (error) { Logger.log('coloraGradi: ' + error); coloraTurni(); }
  try { nascondiGiorniPassati(); } catch (error) { Logger.log('nascondiGiorniPassati: ' + error); }
  const result = { aggiunte: newDates.length, dal: newDates[0], al: newDates[newDates.length - 1], nuoviAgenti: missing.length, sync: sync_(true) };
  Logger.log(JSON.stringify(result));
  return result;
}

// Turni di ogni agente come li vede NaviSuite: calendario base piu' le
// importazioni attive (turni PDF e foglio) in ordine di caricamento, come
// applyScheduleImports() in assets/js/shared-data.js.
function naviSuiteShifts_() {
  const agents = {};
  const ensure = (key, name, residence) => {
    if (!agents[key]) agents[key] = { agente: String(name || '').trim(), residenza: String(residence || '').toUpperCase(), turni: {} };
    return agents[key];
  };
  const schedule = firebase_('GET', 'public/schedule') || {};
  Object.keys(schedule.residenze || {}).forEach(residence => {
    asArray_(schedule.residenze[residence]).forEach(agent => {
      const key = String(agent.agent_uid || stableAgentUid_(agent.agente));
      if (!key) return;
      const entry = ensure(key, agent.agente, residence);
      Object.keys(agent.turni || {}).forEach(iso => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) entry.turni[iso] = agent.turni[iso];
      });
    });
  });
  asArray_(firebase_('GET', SHEET_SYNC.importsPath))
    .filter(batch => batch.attiva !== false)
    .sort((a, b) => String(a.importedAt || '').localeCompare(String(b.importedAt || '')))
    .forEach(batch => {
      const dates = asArray_(batch.dates);
      asArray_(batch.rows).forEach(row => {
        const key = String(row.agent_uid || stableAgentUid_(row.agente));
        if (!key) return;
        const entry = ensure(key, row.agente, row.residenzaNuova || row.residenza);
        if (row.residenzaNuova) entry.residenza = String(row.residenzaNuova).toUpperCase();
        const shifts = row.turni || [];
        dates.forEach((iso, index) => { entry.turni[iso] = shifts[index]; });
      });
    });
  return agents;
}

function sheetShift_(value) {
  if (value == null || value === '') return '';
  const shift = normalizeShift_(value);
  return shift === 'TERRA' ? 'LAV' : shift;
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
  if (response.getResponseCode() >= 300 || !data.idToken) {
    const reason = (data.error && data.error.message) || response.getContentText().slice(0, 200);
    throw new Error('Autenticazione Firebase non riuscita (HTTP ' + response.getResponseCode() + '): ' + reason +
      '. Controllare che SHEET_SYNC.apiKey sia identica a quella di assets/js/admin-firebase-rest.js.');
  }
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
  if (!turni) throw new Error('Nessun foglio con la colonna agent_uid in A1');

  const header = turni.getRange(1, 1, 1, turni.getLastColumn()).getDisplayValues()[0].map(normalizeHeader_);
  const nameIndex = header.indexOf('AGENTE');
  const infoColumns = Math.max(nameIndex, header.indexOf('RESIDENZA'), header.indexOf('AGENTUID')) + 1;
  const lastRow = turni.getLastRow();
  if (nameIndex < 0 || lastRow < 2) return;
  const tints = gradeTintsByRow_(turni, true);
  const backgrounds = tints.map(tint => new Array(infoColumns).fill(tint));
  const fonts = tints.map(tint => new Array(infoColumns).fill(tint ? '#111827' : null));
  const range = turni.getRange(2, 1, lastRow - 1, infoColumns);
  range.setBackgrounds(backgrounds);
  range.setFontColors(fonts);
  turni.getRange(2, nameIndex + 1, lastRow - 1, 1).setFontWeight('bold');
  // Lo stesso sfondo del grado va anche sotto i turni della riga.
  coloraTurni();
}

// Per ogni riga dati del foglio turni, lo sfondo chiaro del grado
// dell'agente (null se il grado non e' noto). Con strict=false un foglio
// gradi mancante non e' un errore: si ottengono solo righe senza sfondo.
function gradeTintsByRow_(turni, strict) {
  const lastRow = turni.getLastRow();
  if (lastRow < 2) return [];
  const header = turni.getRange(1, 1, 1, turni.getLastColumn()).getDisplayValues()[0].map(normalizeHeader_);
  const nameIndex = header.indexOf('AGENTE');
  const gradi = SpreadsheetApp.getActive().getSheets().find(s => normalizeHeader_(s.getName()).indexOf('GRADI') >= 0);
  if (!gradi || nameIndex < 0) {
    if (strict && !gradi) throw new Error('Nessun foglio "Anzianita e gradi"');
    return new Array(lastRow - 1).fill(null);
  }

  const gradeMatrix = gradi.getDataRange().getDisplayValues();
  const gradeHeader = gradeMatrix.shift().map(normalizeHeader_);
  const agentCol = gradeHeader.indexOf('AGENTE');
  const gradeCol = gradeHeader.indexOf('GRADO');
  if (agentCol < 0 || gradeCol < 0) {
    if (strict) throw new Error('Nel foglio gradi servono le colonne Agente e Grado');
    return new Array(lastRow - 1).fill(null);
  }
  const gradeByAgent = {};
  gradeMatrix.forEach(row => { gradeByAgent[normalizeHeader_(row[agentCol])] = gradeKey_(row[gradeCol]); });

  return turni.getRange(2, nameIndex + 1, lastRow - 1, 1).getDisplayValues().map(([name]) => {
    const color = GRADE_COLORS[gradeByAgent[normalizeHeader_(name)]];
    return color ? mixWithWhite_(color, 0.7) : null;
  });
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
// Stessi colori delle pillole turno di NaviTurni (classify() in naviturni.html
// e variabili --d1, --d2... in assets/css/navi-shared.css), per tutte le
// residenze: il turno N di ogni residenza ha il colore di D<N>. Colora il
// testo delle colonne data (lo sfondo e' quello del grado dell'agente) del foglio turni; si aggiorna da solo a ogni modifica oppure
// eseguendo coloraTurni() a mano.

const SHIFT_COLORS = Object.freeze({
  D1: '#3b6bcc',
  D2: '#2d9e6b',
  D3: '#e07b3a',
  D4: '#c45cba',
  DT: '#e6d44a',
  BIS: '#5ec4d4',
  POND: '#f08080',
  AGB: '#60a5fa',
  CONG: '#a78bfa',
  FP: '#94a3b8',
  RF: '#84cc16',
  RIP: '#6b7280',
  OTHER: '#94a3b8'
});

// Turno (gia' ripulito da trasferta "C..C" e "*") → chiave colore.
const SHIFT_COLOR_KEYS = Object.freeze({
  // Desenzano
  D1: 'D1', D2: 'D2', D3: 'D3', D4: 'D4', BIS: 'BIS', DT: 'DT', AGB: 'AGB', POND: 'POND',
  // Maderno
  T1: 'D1', T2: 'D2', M1: 'D3', AGT: 'DT', AGM: 'AGB', PONM: 'POND',
  // Riva
  R1: 'D1', R2: 'D2', R3: 'D3', R4: 'D4', CAR: 'BIS',
  // Peschiera
  P1: 'D1', P2: 'D2', P3: 'D3', P4: 'D4', CAP: 'BIS', SR1: 'BIS'
});

function coloraTurni() {
  const sheet = SpreadsheetApp.getActive().getSheets()
    .find(s => normalizeHeader_(s.getRange(1, 1).getDisplayValue()) === 'AGENTUID');
  if (!sheet) throw new Error('Nessun foglio con la colonna agent_uid in A1');
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return;
  const header = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const dateIndexes = header.map((value, index) => isoDate_(value) ? index : -1).filter(index => index >= 0);
  if (!dateIndexes.length) return;

  // Le colonne data sono contigue: si colora il blocco dalla prima all'ultima.
  const first = dateIndexes[0];
  const width = dateIndexes[dateIndexes.length - 1] - first + 1;
  const range = sheet.getRange(2, first + 1, lastRow - 1, width);
  const values = range.getDisplayValues();
  // Testo nel colore del turno, sfondo nel colore del grado dell'agente
  // (lo stesso delle colonne agente/residenza).
  const tints = gradeTintsByRow_(sheet, false);
  const backgrounds = [];
  const fonts = [];
  const weights = [];
  values.forEach((row, rowIndex) => {
    backgrounds.push(new Array(row.length).fill(tints[rowIndex] || null));
    const rowFonts = [];
    const rowWeights = [];
    row.forEach((value, offset) => {
      const color = dateIndexes.indexOf(first + offset) >= 0 ? shiftColor_(value) : null;
      rowFonts.push(color ? mixWithBlack_(color, 0.25) : null);
      rowWeights.push(color ? 'bold' : 'normal');
    });
    fonts.push(rowFonts);
    weights.push(rowWeights);
  });
  range.setBackgrounds(backgrounds);
  range.setFontColors(fonts);
  range.setFontWeights(weights);
  bordiSettimane_(sheet, header, dateIndexes);
  evidenziaOggi_(sheet, header, dateIndexes);
}

// Bordo colorato tutto attorno alla colonna di oggi. Quando cambia il giorno
// la colonna evidenziata in precedenza torna normale (con il suo eventuale
// bordo di inizio settimana).
const TODAY_BORDER_COLOR = '#dc2626';
const TODAY_PROPERTY = 'NAVISUITE_SHEET_TODAY_COLUMN';

function evidenziaOggi_(sheet, header, dateIndexes) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const rows = sheet.getLastRow();
  const columnOf = iso => {
    const index = dateIndexes.find(item => isoDate_(header[item]) === iso);
    return index === undefined ? null : sheet.getRange(1, index + 1, rows, 1);
  };
  const previous = props.getProperty(TODAY_PROPERTY);
  if (previous && previous !== today) {
    const old = columnOf(previous);
    if (old) {
      old.setBorder(false, false, false, false, null, null);
      bordiSettimane_(sheet, header, dateIndexes);
    }
  }
  const column = columnOf(today);
  if (!column) return;
  column.setBorder(true, true, true, true, null, null, TODAY_BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID_THICK);
  props.setProperty(TODAY_PROPERTY, today);
}

// Bordo spesso a sinistra di ogni lunedi' (e ai due estremi delle date), su
// tutta l'altezza della tabella, cosi' le settimane si leggono a colpo d'occhio.
function bordiSettimane_(sheet, header, dateIndexes) {
  const rows = sheet.getLastRow();
  const thick = SpreadsheetApp.BorderStyle.SOLID_THICK;
  const color = '#111827';
  dateIndexes.forEach((index, position) => {
    const iso = isoDate_(header[index]);
    const monday = new Date(iso + 'T12:00:00Z').getUTCDay() === 1;
    const column = sheet.getRange(1, index + 1, rows, 1);
    if (position === 0 || monday) column.setBorder(null, true, null, null, null, null, color, thick);
    if (position === dateIndexes.length - 1) column.setBorder(null, null, null, true, null, null, color, thick);
  });
}

// Scurisce un po' i colori di NaviTurni (pensati per lo sfondo scuro) cosi'
// restano leggibili come testo sugli sfondi chiari del foglio.
function mixWithBlack_(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channel = shift => Math.round(((n >> shift) & 255) * (1 - amount));
  return '#' + [16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('');
}

function shiftColor_(value) {
  if (!String(value == null ? '' : value).trim()) return null;
  const shift = normalizeShift_(value);
  if (shift === 'RIP') return SHIFT_COLORS.RIP;
  if (shift === 'CON' || /^CONG/.test(shift)) return SHIFT_COLORS.CONG;
  if (shift === 'F.P.' || shift === 'CORSO') return SHIFT_COLORS.FP;
  if (shift === 'RF') return SHIFT_COLORS.RF;
  const clean = shift.replace(/\*/g, '');
  const match = clean.match(/^C?(D[1-4]|BIS|DT|AGB|PO(?:ND?|D)|T[12]|M1|AGT|AGM|PONM|R[1-4]|CAR|P[1-4]|CAP|SR1)C?$/);
  if (!match) return SHIFT_COLORS.OTHER;
  // "CPODC"/"CPONC" sono forme abbreviate di "CPONDC" (pontile Desenzano).
  const key = match[1].replace(/^PO[ND]$/, 'POND');
  return SHIFT_COLORS[SHIFT_COLOR_KEYS[key]] || SHIFT_COLORS.OTHER;
}
