(function () {
  const API_KEY = "AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE";
  const DATABASE_URL = "https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app";
  const AUTH_KEY = "navisuite.adminFirebaseAuth.v1";
  let volatileAuth = null;

  function readAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null") || volatileAuth; }
    catch (_) { return volatileAuth; }
  }

  function saveAuth(value) {
    volatileAuth = value;
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(value)); }
    catch (error) { console.warn("Token Firebase mantenuto solo per questa sessione", error); }
    return value;
  }

  async function authRequest(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, { ...options, signal:controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Autenticazione Firebase non risponde");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function signUp() {
    const response = await authRequest(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(API_KEY)}`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({returnSecureToken:true})
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Autenticazione Firebase non riuscita");
    return saveAuth({
      uid:data.localId,
      idToken:data.idToken,
      refreshToken:data.refreshToken,
      expiresAt:Date.now() + Number(data.expiresIn || 3600) * 1000
    });
  }

  async function refreshAuth(auth) {
    try {
    const response = await authRequest(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(API_KEY)}`,
      {
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({
          grant_type:"refresh_token",
          refresh_token:auth.refreshToken
        })
      }
    );
    const data = await response.json();
    if (!response.ok) { localStorage.removeItem(AUTH_KEY); return signUp(); }
    return saveAuth({
      uid:data.user_id,
      idToken:data.id_token,
      refreshToken:data.refresh_token,
      expiresAt:Date.now() + Number(data.expires_in || 3600) * 1000
    });
    } catch (error) {
      // Un token locale vecchio non deve poter bloccare l'intera applicazione.
      localStorage.removeItem(AUTH_KEY);
      return signUp();
    }
  }

  // Più componenti della stessa pagina possono richiedere Firebase insieme.
  // Condividiamo una sola autenticazione in corso, evitando di creare account
  // anonimi multipli sullo stesso dispositivo.
  let pendingAuth = null;
  async function ensureAuth() {
    const auth = readAuth();
    if (auth?.idToken && auth?.uid && Number(auth.expiresAt || 0) > Date.now() + 60000) return auth;
    if (pendingAuth) return pendingAuth;
    pendingAuth = (async()=>{
      const latest = readAuth();
      if (latest?.idToken && latest?.uid && Number(latest.expiresAt || 0) > Date.now() + 60000) return latest;
      return latest?.refreshToken ? refreshAuth(latest) : signUp();
    })();
    try { return await pendingAuth; }
    finally { pendingAuth = null; }
  }

  async function databaseRequest(path, options = {}) {
    const auth = await ensureAuth();
    const url = `${DATABASE_URL}/${String(path).replace(/^\/+/, "")}.json?auth=${encodeURIComponent(auth.idToken)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        ...options,
        signal:controller.signal,
        headers:{"Content-Type":"application/json", ...(options.headers || {})}
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || `Firebase HTTP ${response.status}`;
        throw new Error(message === "Permission denied" ? "Permesso negato dalle regole Firebase" : message);
      }
      return { data, auth };
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Firebase non risponde entro 15 secondi");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const ready = ensureAuth().then(auth => ({ uid:auth.uid }));

  function normalizeChangeRequest(id, value) {
    return { ...(value || {}), id:String(value?.id || id) };
  }

  async function listChangeRequests(agentId) {
    const [result, deletedResult] = await Promise.all([
      databaseRequest("private/changeRequests"),
      databaseRequest("private/adminUpdates/deletedChangeRequests")
    ]);
    const target = String(agentId || "");
    const deleted = new Set(Object.entries(deletedResult.data || {}).flatMap(([id, value]) => [String(id), String(value?.requestId || "")]).filter(Boolean));
    return Object.entries(result.data || {})
      .map(([id, value]) => normalizeChangeRequest(id, value))
      .filter(item => !deleted.has(String(item.id)))
      .filter(item => !target || String(item.agentId || "") === target || String(item.colleagueId || "") === target)
      .sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")));
  }

  async function saveChangeRequest(payload = {}) {
    const auth = await ensureAuth();
    const id = `REQ_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const item = {
      ...payload,
      action:undefined,
      id,
      ownerUid:auth.uid,
      sentAt:payload.sentAt || new Date().toISOString()
    };
    Object.keys(item).forEach(key => item[key] === undefined && delete item[key]);
    await databaseRequest(`private/changeRequests/${id}`, {
      method:"PUT",
      body:JSON.stringify(item)
    });
    return normalizeChangeRequest(id, item);
  }

  async function deleteChangeRequest(requestId) {
    const id = String(requestId);
    try {
      await databaseRequest(`private/changeRequests/${encodeURIComponent(id)}`, { method:"DELETE" });
    } catch (error) {
      if (!/permesso|permission/i.test(String(error?.message || ""))) throw error;
      const safeId = id.replace(/[.#$\[\]/]/g, "_");
      await databaseRequest(`private/adminUpdates/deletedChangeRequests/${safeId}`, {
        method:"PUT",
        body:JSON.stringify({requestId:id,deletedAt:new Date().toISOString()})
      });
    }
    return true;
  }

  async function getAdminUpdates() {
    const [owner, updated, ods, manual, baristas, approvals, dismissedOds, scheduleImports, turniNavi] = await Promise.all([
      databaseRequest("private/adminUpdates/ownerUid"),
      databaseRequest("private/adminUpdates/updatedAt"),
      databaseRequest("private/adminUpdates/odsVariations"),
      databaseRequest("private/adminUpdates/manualVariations"),
      databaseRequest("private/adminUpdates/baristas"),
      databaseRequest("private/adminUpdates/approvedChangeRequests"),
      databaseRequest("private/adminUpdates/dismissedOdsApprovals"),
      databaseRequest("private/adminUpdates/scheduleImports"),
      databaseRequest("private/adminUpdates/turniNavi")
    ]);
    const asArray = input => Array.isArray(input) ? input.filter(Boolean) : Object.values(input || {});
    return {
      ownerUid:String(owner.data || ""),
      currentUid:owner.auth.uid,
      updatedAt:String(updated.data || ""),
      odsVariations:asArray(ods.data),
      manualVariations:asArray(manual.data),
      baristas:asArray(baristas.data),
      approvedChangeRequests:asArray(approvals.data),
      dismissedOdsApprovals:asArray(dismissedOds.data)
      ,scheduleImports:asArray(scheduleImports.data)
      ,turniNavi:asArray(turniNavi.data)
      ,agentProfiles:(await databaseRequest("private/adminUpdates/agentProfiles")).data || {}
    };
  }

  // Solo i turni nave (nave, ormeggio serale, rifornimento) degli O.d.S.: per la pagina Servizi a terra.
  async function getTurniNavi() {
    const result = await databaseRequest("private/adminUpdates/turniNavi");
    return Array.isArray(result.data) ? result.data.filter(Boolean) : Object.values(result.data || {});
  }

  // Ufficio Movimento (pagina movimento.html): nave, ormeggi, rifornimento e corse sospese di un turno
  // nave in un giorno. La riga del Movimento (fonte "movimento") sostituisce quelle degli O.d.S. dello
  // stesso giorno e turno, che restano salvate ma non attive (sostituita_da_movimento) e tornano
  // attive con il ripristino. Ogni salvataggio rilegge i turni nave e riscrive solo quel nodo.
  const corsaDi = row => String(row?.corsa || "").toUpperCase().replace(/\s+/g, "").replace(/^BIS2$/, "BIS");
  const stessoTurnoNave = (row, day, corsa) => String(row?.data || "").slice(0, 10) === day && corsaDi(row) === corsa;
  async function writeTurniNavi(rows) {
    await databaseRequest("private/adminUpdates/turniNavi", { method:"PUT", body:JSON.stringify(rows) });
    await databaseRequest("private/adminUpdates/updatedAt", { method:"PUT", body:JSON.stringify(new Date().toISOString()) });
    return rows;
  }
  async function saveTurnoNaveMovimento(day, corsa, values = {}, updatedBy = "") {
    const code = String(corsa || "").toUpperCase();
    const rows = (await getTurniNavi()).map(row => (stessoTurnoNave(row, day, code) && row.fonte !== "movimento" && row.attiva !== false)
      ? { ...row, attiva:false, sostituita_da_movimento:true } : row)
      .filter(row => !(stessoTurnoNave(row, day, code) && row.fonte === "movimento"));
    const row = {
      data:day, corsa:code,
      nave:String(values.nave || "").trim(),
      ormeggio_mattino:String(values.ormeggio_mattino || "").trim(),
      ormeggio_serale:String(values.ormeggio_serale || "").trim(),
      rifornimento_mattina:values.rifornimento_mattina ? "Sì" : "",
      sospesa:values.sospesa === true,
      sospesa_motivo:values.sospesa ? String(values.sospesa_motivo || "").trim() : "",
      sospesa_il:values.sospesa ? String(values.sospesa_il || new Date().toISOString()) : "",
      // corse sospese una per una (numeri di corsa), senza sospendere tutto il turno
      corse_sospese:(Array.isArray(values.corse_sospese) ? values.corse_sospese : []).map(x => (x && typeof x === "object"
        ? { corsa:String(x.corsa || ""), da:String(x.da || ""), scalo:String(x.scalo || "") } : { corsa:String(x), da:"", scalo:"" })).filter(x => x.corsa),
      // ritardi per corsa (a scatti di 5 minuti fino a 2 ore, oppure oltre 2 ore)
      ritardi:(Array.isArray(values.ritardi) ? values.ritardi : []).filter(r => r && r.corsa && (Number(r.minuti) > 0 || r.oltre)).map(r => ({
        corsa:String(r.corsa), minuti:r.oltre ? 120 : Math.min(120, Number(r.minuti)), oltre:r.oltre === true
      })),
      // BIS: incarichi del giorno (sostituisce un turno nave o fa corse in aiuto)
      incarichi:(Array.isArray(values.incarichi) ? values.incarichi : []).filter(inc => inc && inc.turno && inc.dalla).map(inc => ({
        tipo:inc.tipo === "aiuto" ? "aiuto" : "sostituzione", turno:String(inc.turno).toUpperCase(),
        dalla:String(inc.dalla), alla:String(inc.alla || ""), nota:String(inc.nota || "")
      })),
      ods:"MOVIMENTO", fonte:"movimento", attiva:true,
      inserita_il:new Date().toISOString(), modificata_da:String(updatedBy || "")
    };
    return writeTurniNavi([...rows, row]);
  }
  // Turno fermato o ripreso fuori dal calendario dell'O.d.S. (pagina Movimento): una riga per turno con il campo "stagione"
  // ("ferma" | "attiva"), valida dal giorno `dal` al giorno `al` (vuoto = fino a nuovo ordine).
  async function saveStagioneTurno(code, stato, dal, al = "", updatedBy = "") {
    const turno = String(code || "").toUpperCase();
    const rows = (await getTurniNavi()).filter(row => !(row?.stagione && corsaDi(row) === turno));
    rows.push({
      data:String(dal), corsa:turno, nave:"", stagione:stato === "attiva" ? "attiva" : "ferma", stagione_al:String(al || ""),
      ods:"MOVIMENTO", fonte:"movimento", attiva:true, inserita_il:new Date().toISOString(), modificata_da:String(updatedBy || "")
    });
    return writeTurniNavi(rows);
  }
  async function togliStagioneTurno(code) {
    const turno = String(code || "").toUpperCase();
    return writeTurniNavi((await getTurniNavi()).filter(row => !(row?.stagione && corsaDi(row) === turno)));
  }
  async function ripristinaTurnoNave(day, corsa) {
    const code = String(corsa || "").toUpperCase();
    const rows = (await getTurniNavi())
      .filter(row => !(stessoTurnoNave(row, day, code) && row.fonte === "movimento"))
      .map(row => {
        if (!stessoTurnoNave(row, day, code) || !row.sostituita_da_movimento) return row;
        const { sostituita_da_movimento, ...rest } = row;
        return { ...rest, attiva:true };
      });
    return writeTurniNavi(rows);
  }
  // Approvazione dei cambi turno fatti dagli agenti dalla propria Distinta (pagina Movimento): una voce per agente e giorno
  // {turno, approvata_da, approvata_il}; il cambio resta "in attesa" finche' non c'e' una voce con lo stesso turno.
  const chiaveApprovazione = (agentId, day) => `${String(agentId).replace(/[.#$\[\]/]/g, "-")}_${day}`;
  async function getApprovazioniTurni() {
    const result = await databaseRequest("private/adminUpdates/approvazioniTurni");
    return result.data && typeof result.data === "object" ? result.data : {};
  }
  async function saveApprovazioneTurno(agentId, day, turno, approvataDa = "", stato = "approvata") {
    // turno = quello chiesto dall'agente; stato = approvata | rifiutata | modificata (la richiesta e' chiusa in ogni caso)
    const item = { agentId:String(agentId), data:day, turno:String(turno || "").toUpperCase(), stato, approvata_da:String(approvataDa), approvata_il:new Date().toISOString() };
    await databaseRequest(`private/adminUpdates/approvazioniTurni/${chiaveApprovazione(agentId, day)}`, { method:"PUT", body:JSON.stringify(item) });
    return item;
  }
  // Equipaggio: le modifiche del Movimento sono variazioni manuali dei turni (ods "MOVIMENTO"), una
  // per agente e giorno; turnoNuovo vuoto annulla la variazione.
  async function saveVariazioneMovimento(day, agent = {}, turnoNuovo = "", turnoOriginale = "", note = "", extra = {}) {
    const result = await databaseRequest("private/adminUpdates/manualVariations");
    const id = String(agent.id || "");
    const rows = (Array.isArray(result.data) ? result.data.filter(Boolean) : Object.values(result.data || {}))
      .filter(item => !(String(item?.data || "").slice(0, 10) === day && String(item?.id_agente || "") === id && item?.ods === "MOVIMENTO"));
    if (turnoNuovo) rows.push({
      attiva:true, data:day, id_agente:id, agente:String(agent.agente || agent.name || ""),
      turno_originale:String(turnoOriginale || "").toUpperCase(), turno_nuovo:String(turnoNuovo).toUpperCase(),
      ods:"MOVIMENTO", tipo:"MANUALE", note:String(note || "Ufficio Movimento"), inserita_il:new Date().toISOString(),
      // membro aggiunto dal "+" della corsa: in piu' del minimo, eventualmente sovrannumero
      ...(extra.aggiunto ? { aggiunto:true } : {}), ...(extra.sovrannumero ? { sovrannumero:true } : {}),
      // cambio dell'agente (dalla Distinta) che questa decisione del Movimento sovrascrive (vuoto = nessuno)
      ...(extra.sovrascrive !== undefined ? { sovrascrive:String(extra.sovrascrive || "") } : {})
    });
    await databaseRequest("private/adminUpdates/manualVariations", { method:"PUT", body:JSON.stringify(rows) });
    await databaseRequest("private/adminUpdates/updatedAt", { method:"PUT", body:JSON.stringify(new Date().toISOString()) });
    return rows;
  }

  // Pontile scelto per ogni corsa nella pagina Servizi a terra:
  // private/adminUpdates/pontiliCorse/{residenza}/{corsa}/{data} = "1".."6" oppure "-" (nessuno).
  const pontileKey = value => String(value || "").replace(/[.#$\[\]/]/g, "-");
  async function getPontiliCorse(residence) {
    const result = await databaseRequest(`private/adminUpdates/pontiliCorse/${pontileKey(residence)}`);
    return result.data && typeof result.data === "object" ? result.data : {};
  }

  async function savePontileCorsa(residence, course, date, value) {
    await databaseRequest(`private/adminUpdates/pontiliCorse/${pontileKey(residence)}/${pontileKey(course)}/${pontileKey(date)}`, {
      method:"PUT",
      body:JSON.stringify(String(value || "-"))
    });
    return true;
  }

  async function getBaristaUpdates() {
    const result = await databaseRequest("private/adminUpdates/baristas");
    return Array.isArray(result.data) ? result.data.filter(Boolean) : Object.values(result.data || {});
  }

  async function saveBaristaUpdates(baristas = []) {
    const rows = Array.isArray(baristas) ? baristas : [];
    await databaseRequest("private/adminUpdates/baristas", {
      method:"PUT",
      body:JSON.stringify(rows)
    });
    return { baristas:rows, updatedAt:new Date().toISOString() };
  }

  async function saveAdminUpdates(payload = {}) {
    const auth = await ensureAuth();
    const item = {
      ownerUid:auth.uid,
      updatedAt:new Date().toISOString(),
      odsVariations:Array.isArray(payload.odsVariations) ? payload.odsVariations : [],
      manualVariations:Array.isArray(payload.manualVariations) ? payload.manualVariations : [],
      baristas:Array.isArray(payload.baristas) ? payload.baristas : [],
      approvedChangeRequests:Array.isArray(payload.approvedChangeRequests) ? payload.approvedChangeRequests : [],
      dismissedOdsApprovals:Array.isArray(payload.dismissedOdsApprovals) ? payload.dismissedOdsApprovals : []
      ,scheduleImports:Array.isArray(payload.scheduleImports) ? payload.scheduleImports : []
      ,turniNavi:Array.isArray(payload.turniNavi) ? payload.turniNavi : []
    };
    await databaseRequest("private/adminUpdates", {
      method:"PATCH",
      body:JSON.stringify(item)
    });
    return { ...item, currentUid:auth.uid };
  }

  // Richiesta di allineamento del Foglio Google al turno caricato: la scrive
  // la pagina Aggiornamenti (solo admin), la esegue lo script del foglio
  // (controlloPeriodico, ogni 5 minuti) che poi scrive "result".
  async function getSheetSync() {
    const result = await databaseRequest("private/adminUpdates/sheetSync");
    const value = result.data && typeof result.data === "object" ? result.data : {};
    return { request:value.request || null, result:value.result || null };
  }

  async function requestSheetSync(agent = {}) {
    const auth = await ensureAuth();
    const request = {
      id:`SYNC_${Date.now()}`,
      requestedAt:new Date().toISOString(),
      requestedBy:String(agent.name || agent.agente || agent.id || ""),
      ownerUid:auth.uid
    };
    await databaseRequest("private/adminUpdates/sheetSync/request", { method:"PUT", body:JSON.stringify(request) });
    return request;
  }

  async function getShipConfigurations() {
    let direct = {};
    try {
      const result = await databaseRequest("private/adminUpdates/shipConfigurations");
      direct = result.data && typeof result.data === "object" ? result.data : {};
    } catch (error) {}
    const directConfiguration = direct.configurations || (Object.keys(direct).length ? direct : null);
    if (directConfiguration && Object.keys(directConfiguration).length) {
      return { configurations:directConfiguration, updatedAt:String(direct.updatedAt || "") };
    }
    const result = await databaseRequest("private/adminUpdates");
    const value = result.data && typeof result.data === "object" ? result.data : {};
    return { configurations:value.gestioneNaviConfig || {}, updatedAt:String(value.updatedAt || "") };
  }

  async function saveShipConfigurations(configurations = {}) {
    const auth = await ensureAuth();
    const item = {
      configurations:configurations && typeof configurations === "object" ? configurations : {},
      updatedAt:new Date().toISOString(),
      updatedBy:auth.uid
    };
    try {
      await databaseRequest("private/adminUpdates/shipConfigurations", {
        method:"PUT",
        body:JSON.stringify(item)
      });
    } catch (error) {
      // Compatibilità con le regole Firebase già in uso da NaviBeta: il nodo
      // principale adminUpdates è autorizzato per gli amministratori, mentre
      // un nuovo sotto-percorso può non esserlo ancora.
      await databaseRequest("private/adminUpdates", {
        method:"PATCH",
        body:JSON.stringify({ ownerUid:auth.uid, updatedAt:item.updatedAt, gestioneNaviConfig:item.configurations })
      });
    }
    return item;
  }

  // Anagrafica navi dell'ufficio movimento: equipaggio minimo per nave, con
  // periodi di validita' (es. estate/inverno). Nodo dedicato, separato dal
  // vecchio shipConfigurations di Gestione navi.
  async function getFleet() {
    const result = await databaseRequest("private/adminUpdates/movimentoFlotta");
    const value = result.data && typeof result.data === "object" ? result.data : {};
    return {
      navi:value.navi && typeof value.navi === "object" ? value.navi : {},
      updatedAt:String(value.updatedAt || ""),
      updatedBy:String(value.updatedBy || "")
    };
  }

  async function saveFleet(navi = {}, updatedByName = "") {
    const auth = await ensureAuth();
    const item = {
      navi:navi && typeof navi === "object" ? navi : {},
      updatedAt:new Date().toISOString(),
      updatedBy:String(updatedByName || auth.uid)
    };
    await databaseRequest("private/adminUpdates/movimentoFlotta", { method:"PUT", body:JSON.stringify(item) });
    return item;
  }

  async function getAnnouncements() {
    const result = await databaseRequest("private/adminUpdates/announcements");
    return result.data && typeof result.data === "object" ? result.data : {};
  }

  async function saveAnnouncements(announcements = {}) {
    await ensureAuth();
    await databaseRequest("private/adminUpdates/announcements", {
      method:"PUT",
      body:JSON.stringify(announcements && typeof announcements === "object" ? announcements : {})
    });
    return announcements;
  }

  async function getDraftPeriod() {
    const result = await databaseRequest("private/adminUpdates/draftPeriod");
    const value = result.data || {};
    return {
      start:String(value.start || "2026-08-10"),
      end:String(value.end || "2026-09-06"),
      updatedAt:String(value.updatedAt || "")
    };
  }

  async function saveDraftPeriod(period = {}) {
    const auth = await ensureAuth();
    const start = String(period.start || "").slice(0, 10);
    const end = String(period.end || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new Error("Date del periodo bozza non valide");
    }
    if (start > end) throw new Error("La data iniziale non può essere successiva alla data finale");
    const item = {start, end, updatedAt:new Date().toISOString(), ownerUid:auth.uid};
    await databaseRequest("private/adminUpdates/draftPeriod", {method:"PUT", body:JSON.stringify(item)});
    return item;
  }

  async function resetDraftPeriod() {
    await databaseRequest("private/adminUpdates/draftPeriod", { method:"DELETE" });
    return true;
  }

  // Impostazioni notifiche globali (lette anche dai dispositivi degli agenti,
  // es. connection-webpush.js). Chiave assente => avvisi attivi (comportamento
  // storico).
  async function getPushSettings() {
    const result = await databaseRequest("private/adminUpdates/pushSettings");
    const value = result.data && typeof result.data === "object" ? result.data : {};
    return { agentConnectionAlerts:value.agentConnectionAlerts !== false };
  }

  async function savePushSettings(patch = {}) {
    const auth = await ensureAuth();
    const current = await getPushSettings();
    const item = {
      ...current,
      ...(typeof patch.agentConnectionAlerts === "boolean" ? { agentConnectionAlerts:patch.agentConnectionAlerts } : {}),
      updatedAt:new Date().toISOString(),
      ownerUid:auth.uid
    };
    await databaseRequest("private/adminUpdates/pushSettings", { method:"PUT", body:JSON.stringify(item) });
    return { agentConnectionAlerts:item.agentConnectionAlerts };
  }

  // Rimuove dalla coda push gli avvisi "agente collegato" ancora in attesa.
  // Il worker invia tutto cio' che trova in pushQueue senza guardare il flag,
  // quindi quando l'amministratore spegne l'interruttore va svuotato l'arretrato
  // (accodato anche da NaviBeta o da client con cache vecchia).
  async function clearPendingConnectionAlerts() {
    const result = await databaseRequest("private/adminUpdates/pushQueue");
    const keys = Object.entries(result.data || {})
      .filter(([, value]) => value && (value.kind === "agent-connection" || value.source === "navisuite-connection"))
      .map(([key]) => key);
    await Promise.all(keys.map(key =>
      databaseRequest(`private/adminUpdates/pushQueue/${encodeURIComponent(key)}`, { method:"DELETE" })
    ));
    return keys.length;
  }

  async function getAdminDocuments() {
    const result = await databaseRequest("private/adminUpdates/documentsMeta");
    return Object.entries(result.data || {}).map(([id, value]) => ({ ...(value || {}), id:String(value?.id || id) }));
  }

  async function getAdminDocumentFile(documentId) {
    const result = await databaseRequest(`private/adminUpdates/documentsFiles/${encodeURIComponent(String(documentId))}`);
    return String(result.data?.dataUrl || "");
  }

  async function saveAdminDocument(metadata, dataUrl) {
    const auth = await ensureAuth();
    const id = String(metadata?.id || `DOC_${Date.now()}`).replace(/[.#$\[\]/]/g, "_");
    await databaseRequest("private/adminUpdates", {
      method:"PATCH",
      body:JSON.stringify({
        ownerUid:auth.uid,
        updatedAt:new Date().toISOString(),
        [`documentsMeta/${id}`]:{...metadata,id,ownerUid:auth.uid,uploadedAt:new Date().toISOString()},
        [`documentsFiles/${id}`]:{dataUrl:String(dataUrl||"")}
      })
    });
    return id;
  }

  async function deleteAdminDocument(documentId) {
    const id = String(documentId).replace(/[.#$\[\]/]/g, "_");
    await databaseRequest("private/adminUpdates", {
      method:"PATCH",
      body:JSON.stringify({
        [`documentsMeta/${id}`]:null,
        [`documentsFiles/${id}`]:null
      })
    });
    return true;
  }

  function safeUserKey(agentId) {
    return String(agentId || "").trim().replace(/[.#$\[\]\/]/g, "_");
  }

  function currentPageLabel() {
    const filename = String(location?.pathname || "").split("/").pop().toLowerCase();
    const labels = {
      "": "Home",
      "index.html": "Home",
      "naviturni.html": "Turni",
      "cambi_turno.html": "Cambio turno",
      "navidiaria.html": "Diaria",
      "documenti.html": "Documenti",
      "segnalazioni.html": "Segnalazioni",
      "impostazioni.html": "Impostazioni",
      "aggiornamenti.html": "Aggiornamenti",
      "agenti.html": "Agenti",
      "gestione_navi.html": "Gestione navi",
      "orario.html": "Orario",
      "orari-tabella.html": "Tabelle orari",
      "quiz.html": "Quiz"
    };
    return labels[filename] || (filename ? filename.replace(/\.html$/i, "") : "Home");
  }

  async function recordUserAccess(profile = {}, activity = {}) {
    const id = String(profile.id || profile.agentId || "").trim();
    if (!id) return null;
    const key = safeUserKey(id);
    const now = new Date().toISOString();
    let previous = null;
    try { previous = (await databaseRequest(`private/adminUpdates/userRegistry/${key}`)).data; }
    catch (_) { previous = null; }
    const item = {
      id,
      name:String(profile.name || profile.agente || profile.cognome || previous?.name || id).trim(),
      residence:String(profile.residence || profile.residenza || previous?.residence || "").trim(),
      qualifica:String(profile.qualifica || previous?.qualifica || "").trim(),
      role:String(profile.role || previous?.role || "").trim(),
      registeredAt:String(previous?.registeredAt || now),
      lastAccess:now,
      // Conserviamo esclusivamente l'ultima pagina aperta, non lo storico di navigazione.
      lastPage:String(activity.page || currentPageLabel() || previous?.lastPage || "").trim()
    };
    await databaseRequest(`private/adminUpdates/userRegistry/${key}`, {
      method:"PUT",
      body:JSON.stringify(item)
    });
    return item;
  }

  async function listRegisteredUsers() {
    const result = await databaseRequest("private/adminUpdates/userRegistry");
    return Object.values(result.data || {}).filter(Boolean);
  }

  async function deleteRegisteredUser(agentId) {
    await databaseRequest(`private/adminUpdates/userRegistry/${safeUserKey(agentId)}`, { method:"DELETE" });
    return true;
  }

  async function getUserAuth(agentId) {
    const result = await databaseRequest(`private/adminUpdates/userAuth/${safeUserKey(agentId)}`);
    return result.data || null;
  }

  async function saveUserAuth(agentId, pinHash, options = {}) {
    const id = String(agentId || "").trim();
    if (!id || !/^[a-f0-9]{64}$/i.test(String(pinHash || ""))) throw new Error("Credenziali non valide");
    const initialPin = String(options.initialPin || "");
    const item = {
      id,
      pinHash:String(pinHash).toLowerCase(),
      mustChangePin:Boolean(options.mustChangePin),
      ...(Boolean(options.mustChangePin) && /^\d{4}$/.test(initialPin) ? { initialPin } : {}),
      updatedAt:new Date().toISOString()
    };
    await databaseRequest(`private/adminUpdates/userAuth/${safeUserKey(id)}`, { method:"PUT", body:JSON.stringify(item) });
    return item;
  }

  async function resetUserAuth(agentId) {
    await databaseRequest(`private/adminUpdates/userAuth/${safeUserKey(agentId)}`, { method:"DELETE" });
    return true;
  }

  async function getWeekStatuses() {
    const result = await databaseRequest("private/adminUpdates/weekStatuses");
    return Object.values(result.data || {}).filter(Boolean);
  }

  async function saveWeekStatuses(statuses = []) {
    const values = {};
    (Array.isArray(statuses) ? statuses : []).forEach(item => {
      const start = String(item?.start || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) values[start] = { start, state:String(item.state || "ufficiale").toLowerCase() };
    });
    await databaseRequest("private/adminUpdates/weekStatuses", { method:"PUT", body:JSON.stringify(values) });
    return Object.values(values);
  }

  async function getAgentAdminData() {
    const result = await databaseRequest("private/adminUpdates");
    const value = result.data || {};
    return {
      users:Object.values(value.userRegistry || {}).filter(Boolean),
      profiles:value.agentProfiles || {},
      auth:value.userAuth || {},
      legacyUsersImportedAt:String(value.legacyUsersImportedAt || "")
    };
  }

  async function importLegacyUsers(users = []) {
    const current = await getAgentAdminData();
    const byId = new Map(current.users.map(user => [String(user.id), user]));
    const patch = { legacyUsersImportedAt:new Date().toISOString() };
    (users || []).forEach(user => {
      const id = String(user?.id || "").trim();
      if (!id) return;
      const previous = byId.get(id) || {};
      const latest = String(previous.lastAccess || user.lastAccess || "");
      patch[`userRegistry/${safeUserKey(id)}`] = {
        ...previous,
        id,
        name:String(user.name || previous.name || id),
        registeredAt:String(previous.registeredAt || user.registeredAt || new Date().toISOString()),
        lastAccess:String(latest || previous.lastAccess || user.lastAccess || ""),
        lastPage:String(previous.lastPage || user.lastPage || ""),
        importedFromApps:true
      };
    });
    await databaseRequest("private/adminUpdates", { method:"PATCH", body:JSON.stringify(patch) });
    return getAgentAdminData();
  }

  async function saveAgentProfile(agentId, values = {}) {
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    const item = {
      id,
      name: String(values.name || values.agente || "").trim(),
      residence: String(values.residence || "").trim(),
      role: String(values.role || "").trim().toLowerCase(),
      qualifica: String(values.qualifica || "").trim().toLowerCase(),
      updatedAt: new Date().toISOString()
    };
    // PATCH: un eventuale cambio di residenza salvato sullo stesso profilo resta.
    await databaseRequest(`private/adminUpdates/agentProfiles/${safeUserKey(id)}`, { method:"PATCH", body:JSON.stringify(item) });
    return item;
  }

  // Cambio di residenza dalla data indicata (vuoto = annulla il cambio).
  async function saveAgentResidenceMove(agentId, values = {}) {
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    const after = String(values.residenzaNuova || "").trim().toUpperCase();
    const dal = String(values.residenzaDal || "").slice(0, 10);
    if (after && !/^\d{4}-\d{2}-\d{2}$/.test(dal)) throw new Error("Data di decorrenza non valida");
    const item = after
      ? { id, name:String(values.name || "").trim(), residenzaPrecedente:String(values.residenzaPrecedente || "").trim().toUpperCase(), residenzaNuova:after, residenzaDal:dal, residenzaAggiornata:new Date().toISOString() }
      : { id, residenzaPrecedente:null, residenzaNuova:null, residenzaDal:null, residenzaAggiornata:new Date().toISOString() };
    await databaseRequest(`private/adminUpdates/agentProfiles/${safeUserKey(id)}`, { method:"PATCH", body:JSON.stringify(item) });
    return item;
  }

  async function deleteAgentProfile(agentId) {
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    await databaseRequest(`private/adminUpdates/agentProfiles/${safeUserKey(id)}`, { method:"DELETE" });
    return { id };
  }

  async function touchUserPresence(profile = {}) {
    const auth = await ensureAuth();
    const id = String(profile.id || profile.agentId || "").trim();
    if (!id) return null;
    const item = { id, name:String(profile.name || profile.agente || profile.cognome || id), uid:auth.uid, lastSeen:new Date().toISOString() };
    await databaseRequest(`private/adminUpdates/userPresence/${safeUserKey(id)}/${safeUserKey(auth.uid)}`, { method:"PUT", body:JSON.stringify(item) });
    return item;
  }

  async function listUserPresence(maxAgeMs = 120000) {
    const result = await databaseRequest("private/adminUpdates/userPresence");
    const limit = Date.now() - Number(maxAgeMs || 120000);
    const latest = new Map();
    Object.values(result.data || {}).forEach(devices => Object.values(devices || {}).forEach(item => {
      if (!item?.id || Date.parse(item.lastSeen || "") < limit) return;
      const previous = latest.get(String(item.id));
      if (!previous || String(item.lastSeen) > String(previous.lastSeen)) latest.set(String(item.id), item);
    }));
    return [...latest.values()].sort((a,b)=>String(b.lastSeen||"").localeCompare(String(a.lastSeen||"")));
  }

  async function getQuizCorrections() {
    const result = await databaseRequest("private/adminUpdates/quizCorrections");
    const payload = result.data || {};
    return {
      answers: payload.answers && typeof payload.answers === "object" ? payload.answers : {},
      updatedAt: payload.updatedAt || "",
      updatedBy: payload.updatedBy || ""
    };
  }

  async function saveQuizCorrections(answers = {}, updatedBy = "") {
    const auth = await ensureAuth();
    const cleanAnswers = {};
    Object.entries(answers || {}).forEach(([key, value]) => {
      const answer = Number(value);
      if (/^\d+_\d+$/.test(String(key)) && Number.isInteger(answer) && answer >= 0 && answer <= 9) {
        cleanAnswers[String(key)] = answer;
      }
    });
    const item = {
      answers: cleanAnswers,
      updatedAt: new Date().toISOString(),
      updatedBy: String(updatedBy || "").trim(),
      ownerUid: auth.uid
    };
    await databaseRequest("private/adminUpdates/quizCorrections", {
      method:"PUT",
      body:JSON.stringify(item)
    });
    return item;
  }

  function safeFeedbackText(value, limit = 1500) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
  }

  function normalizeFeedbackTicket(id, value) {
    return { ...(value || {}), id:String(value?.id || id) };
  }

  async function listFeedbackTickets(agentId = "") {
    const result = await databaseRequest("private/adminUpdates/feedbackTickets");
    const target = String(agentId || "").trim();
    return Object.entries(result.data || {})
      .map(([id, value]) => normalizeFeedbackTicket(id, value))
      .filter(item => !target || String(item.authorId || "") === target)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  async function saveFeedbackTicket(payload = {}) {
    const auth = await ensureAuth();
    const title = safeFeedbackText(payload.title, 100);
    const description = safeFeedbackText(payload.description, 1500);
    if (!title) throw new Error("Inserisci un titolo per la segnalazione");
    if (!description) throw new Error("Descrivi brevemente il problema o l’idea");
    const id = `TKT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const item = {
      id,
      authorId:safeFeedbackText(payload.authorId, 80),
      authorName:safeFeedbackText(payload.authorName, 100),
      category:["bug", "miglioria", "altro"].includes(String(payload.category)) ? String(payload.category) : "altro",
      area:safeFeedbackText(payload.area, 60) || "Generale",
      title,
      description,
      status:"nuovo",
      createdAt:now,
      updatedAt:now,
      ownerUid:auth.uid
    };
    if (!item.authorId) throw new Error("Utente non riconosciuto: accedi di nuovo.");
    await databaseRequest(`private/adminUpdates/feedbackTickets/${id}`, { method:"PUT", body:JSON.stringify(item) });
    return item;
  }

  async function updateFeedbackTicket(ticketId, values = {}) {
    const id = String(ticketId || "").trim();
    if (!id) throw new Error("Segnalazione non valida");
    const status = String(values.status || "").toLowerCase();
    const patch = { updatedAt:new Date().toISOString() };
    if (["nuovo", "verifica", "risolto"].includes(status)) patch.status = status;
    if (typeof values.adminNote !== "undefined") patch.adminNote = safeFeedbackText(values.adminNote, 800);
    await databaseRequest(`private/adminUpdates/feedbackTickets/${encodeURIComponent(id)}`, { method:"PATCH", body:JSON.stringify(patch) });
    return { id, ...patch };
  }

  async function deleteFeedbackTicket(ticketId) {
    const id = String(ticketId || "").trim();
    if (!id) throw new Error("Segnalazione non valida");
    await databaseRequest(`private/adminUpdates/feedbackTickets/${encodeURIComponent(id)}`, { method:"DELETE" });
    return true;
  }

  async function loadDiaria(agentId) {
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    const result = await databaseRequest(`private/adminUpdates/diaria/${safeUserKey(id)}`);
    const value = result.data || {};
    return {
      agentId:id,
      entries:Array.isArray(value.entries) ? value.entries.filter(Boolean) : [],
      updatedAt:String(value.updatedAt || ""),
      updatedBy:String(value.updatedBy || ""),
      version:Number(value.version || 1),
      entryCount:Number(value.entryCount || (Array.isArray(value.entries) ? value.entries.filter(Boolean).length : 0)),
      checksum:String(value.checksum || "")
    };
  }

  // Accesso alle pagine: {pagina: 'tutti' | 'admin'} (sezione della pagina Agenti)
  async function getPageAccess() {
    const result = await databaseRequest("private/adminUpdates/pageAccess");
    return result.data || {};
  }
  async function savePageAccess(access = {}) {
    await ensureAuth();
    const item = { ...access, updatedAt:new Date().toISOString() };
    await databaseRequest("private/adminUpdates/pageAccess", { method:"PUT", body:JSON.stringify(item) });
    return item;
  }

  // Straordinari trasformati in banca ore, per mese: {map: {'2026-10': minuti}, updatedAt}
  async function getDiariaConversioni(agentId) {
    const result = await databaseRequest(`private/adminUpdates/diariaConversioni/${safeUserKey(agentId)}`);
    return result.data || null;
  }
  async function saveDiariaConversioni(agentId, value = {}) {
    await ensureAuth();
    const item = { map:value.map || {}, updatedAt:String(value.updatedAt || new Date().toISOString()) };
    await databaseRequest(`private/adminUpdates/diariaConversioni/${safeUserKey(agentId)}`, { method:"PUT", body:JSON.stringify(item) });
    return item;
  }

  async function loadAllDiaria() {
    const result = await databaseRequest("private/adminUpdates/diaria");
    const value = result.data && typeof result.data === "object" ? result.data : {};
    return Object.entries(value).map(([key, record]) => ({
      ...(record && typeof record === "object" ? record : {}),
      agentId:String(record?.agentId || key),
      entries:Array.isArray(record?.entries) ? record.entries.filter(Boolean) : []
    }));
  }

  function diariaChecksum(entries) {
    const source = JSON.stringify(entries || []);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return `d${(hash >>> 0).toString(36)}`;
  }

  function mergeDiariaEntries(existingEntries, incomingEntries) {
    const byDay = new Map();
    (existingEntries || []).forEach(entry => byDay.set(entry.date || entry.id, entry));
    (incomingEntries || []).forEach(entry => byDay.set(entry.date || entry.id, entry));
    return [...byDay.values()].sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")));
  }

  async function keepDiariaBackup(id, current, reason) {
    const oldEntries = Array.isArray(current?.entries) ? current.entries.filter(Boolean) : [];
    if (!oldEntries.length) return;
    const savedAt = new Date().toISOString();
    const backupKey = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const backupPath = `private/adminUpdates/diariaBackups/${safeUserKey(id)}/${backupKey}`;
    await databaseRequest(backupPath, { method:"PUT", body:JSON.stringify({
      agentId:id, entries:oldEntries, entryCount:oldEntries.length, checksum:diariaChecksum(oldEntries),
      savedAt, sourceUpdatedAt:String(current.updatedAt || ""), sourceVersion:Number(current.version || 1), reason
    }) });
    const backups = (await databaseRequest(`private/adminUpdates/diariaBackups/${safeUserKey(id)}`)).data || {};
    const oldKeys = Object.entries(backups).sort((a,b) => String(a[1]?.savedAt || "").localeCompare(String(b[1]?.savedAt || ""))).slice(0, -35).map(([key]) => key);
    await Promise.all(oldKeys.map(key => databaseRequest(`private/adminUpdates/diariaBackups/${safeUserKey(id)}/${key}`, { method:"DELETE" })));
  }

  async function saveDiaria(agentId, entries = []) {
    const auth = await ensureAuth();
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    let normalizedEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    const path = `private/adminUpdates/diaria/${safeUserKey(id)}`;
    const current = (await databaseRequest(path)).data || {};
    const currentEntries = Array.isArray(current.entries) ? current.entries.filter(Boolean) : [];
    if (currentEntries.length && normalizedEntries.length < currentEntries.length) {
      normalizedEntries = mergeDiariaEntries(currentEntries, normalizedEntries);
    }
    const incomingChecksum = diariaChecksum(normalizedEntries);
    const currentChecksum = String(current.checksum || diariaChecksum(currentEntries));
    if (currentEntries.length && !normalizedEntries.length) {
      throw new Error("Protezione attiva: non posso sostituire una diaria esistente con un archivio vuoto.");
    }
    if (currentEntries.length && currentChecksum !== incomingChecksum) await keepDiariaBackup(id, current, "prima del nuovo salvataggio");
    const item = {
      agentId:id,
      entries:normalizedEntries,
      entryCount:normalizedEntries.length,
      checksum:incomingChecksum,
      version:Number(current.version || 0) + 1,
      updatedAt:new Date().toISOString(),
      updatedBy:auth.uid
    };
    await databaseRequest(path, {
      method:"PUT",
      body:JSON.stringify(item)
    });
    return item;
  }

  window.NaviAdminFirebase = {
    ready,
    listChangeRequests,
    saveChangeRequest,
    deleteChangeRequest,
    getAdminUpdates,
    saveAdminUpdates,
    getSheetSync,
    requestSheetSync,
    getShipConfigurations,
    saveShipConfigurations,
    getFleet,
    saveFleet,
    getBaristaUpdates,
    saveBaristaUpdates,
    getAnnouncements,
    saveAnnouncements,
    getDraftPeriod,
    saveDraftPeriod,
    resetDraftPeriod,
    getPushSettings,
    savePushSettings,
    clearPendingConnectionAlerts,
    getAdminDocuments,
    getTurniNavi,
    saveTurnoNaveMovimento,
    ripristinaTurnoNave,
    saveVariazioneMovimento,
    getApprovazioniTurni,
    saveApprovazioneTurno,
    saveStagioneTurno,
    togliStagioneTurno,
    getPontiliCorse,
    savePontileCorsa,
    getAdminDocumentFile,
    saveAdminDocument,
    deleteAdminDocument,
    recordUserAccess,
    listRegisteredUsers,
    deleteRegisteredUser,
    getUserAuth,
    saveUserAuth,
    resetUserAuth,
    getWeekStatuses,
    saveWeekStatuses,
    getAgentAdminData,
    importLegacyUsers,
    saveAgentProfile,
    saveAgentResidenceMove,
    deleteAgentProfile,
    touchUserPresence,
    listUserPresence,
    getQuizCorrections,
    saveQuizCorrections,
    listFeedbackTickets,
    saveFeedbackTicket,
    updateFeedbackTicket,
    deleteFeedbackTicket,
    loadDiaria,
    loadAllDiaria,
    saveDiaria,
    getDiariaConversioni,
    getPageAccess,
    savePageAccess,
    saveDiariaConversioni,
    provider:"Firebase REST"
  };
})();
