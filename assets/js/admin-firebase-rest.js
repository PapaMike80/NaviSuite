(function () {
  const API_KEY = "AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE";
  const DATABASE_URL = "https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app";
  const AUTH_KEY = "navisuite.adminFirebaseAuth.v1";

  function readAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
    catch (_) { return null; }
  }

  function saveAuth(value) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(value));
    return value;
  }

  async function signUp() {
    const response = await fetch(
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
    const response = await fetch(
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
    if (!response.ok) return signUp();
    return saveAuth({
      uid:data.user_id,
      idToken:data.id_token,
      refreshToken:data.refresh_token,
      expiresAt:Date.now() + Number(data.expires_in || 3600) * 1000
    });
  }

  async function ensureAuth() {
    const auth = readAuth();
    if (auth?.idToken && auth?.uid && Number(auth.expiresAt || 0) > Date.now() + 60000) return auth;
    if (auth?.refreshToken) return refreshAuth(auth);
    return signUp();
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

  async function recordUserAccess(profile = {}) {
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
      lastAccess:now
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
    const item = { id, pinHash:String(pinHash).toLowerCase(), mustChangePin:Boolean(options.mustChangePin), updatedAt:new Date().toISOString() };
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
    await databaseRequest(`private/adminUpdates/agentProfiles/${safeUserKey(id)}`, { method:"PUT", body:JSON.stringify(item) });
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

  async function loadDiaria(agentId) {
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    const result = await databaseRequest(`private/adminUpdates/diaria/${safeUserKey(id)}`);
    const value = result.data || {};
    return {
      agentId:id,
      entries:Array.isArray(value.entries) ? value.entries.filter(Boolean) : [],
      updatedAt:String(value.updatedAt || ""),
      updatedBy:String(value.updatedBy || "")
    };
  }

  async function saveDiaria(agentId, entries = []) {
    const auth = await ensureAuth();
    const id = String(agentId || "").trim();
    if (!id) throw new Error("Agente non valido");
    const item = {
      agentId:id,
      entries:Array.isArray(entries) ? entries.filter(Boolean) : [],
      updatedAt:new Date().toISOString(),
      updatedBy:auth.uid
    };
    await databaseRequest(`private/adminUpdates/diaria/${safeUserKey(id)}`, {
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
    getAnnouncements,
    saveAnnouncements,
    getDraftPeriod,
    saveDraftPeriod,
    resetDraftPeriod,
    getAdminDocuments,
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
    deleteAgentProfile,
    touchUserPresence,
    listUserPresence,
    getQuizCorrections,
    saveQuizCorrections,
    loadDiaria,
    saveDiaria,
    provider:"Firebase REST"
  };
})();
