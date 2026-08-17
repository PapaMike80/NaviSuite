(function () {
  const DATA_KEY = 'navi.sharedData.v1';
  const TIME_KEY = 'navi.sharedDataTime.v1';
  const DIRECTORY_KEY = 'navi.agentDirectory.v2';
  const MAX_AGE = 10 * 60 * 1000;
  const FIREBASE_SCHEDULE_URL = 'https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app/public/schedule.json';
  let pending = null;
  let lastSource = 'local';

  function requestUrl(url) {
    const local = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    return local && /^https:\/\//i.test(url)
      ? `/__navi_proxy?url=${encodeURIComponent(url)}`
      : url;
  }

  function normalizeAgentName(value) {
    return String(value || '').trim().toLocaleUpperCase('it').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  function stableAgentUid(value) {
    const normalized = normalizeAgentName(value).replace(/\s+/g, '_');
    return normalized ? `AG_${normalized}` : '';
  }

  // Sequenza letta dal turno ufficiale 27/07-09/08. Il numero stampato nel
  // PDF è stato usato soltanto per trascrivere questa lista: a runtime
  // l'abbinamento avviene esclusivamente tramite il nominativo normalizzato,
  // così un futuro cambio di numero non modifica l'anzianità.
  const PDF_SENIORITY_NAMES = `CANDOLFO N.|RONCAGALLI M.|CASTELLARI M.|RASPOLINI F.|GARIANO A.|CINGARLINI N.|MESSINA G.|STEFANI D.|BERNARDELLI M.|VALENTI M.|GAVIOLI D.|LORENZINI F.|DAL BOSCO G.|MAROGNA S.|BARZOI A.|FERRARI M.|KARPATI L.|SERVINO S.|COLO' J.|PINCELLI A.|OMEZZOLLI O.|GAROFALO A.|GUADAGNOLO O.|PERINI N.|TAMBURINI A.|MAFFEI K.|POLETTINI T.|AMATO M.|MIORELLI A.|GUARISE R.|MESSINA GNI.|BERNARDELLI S.|FACCOLI A.|DEFANT M.|RIGOBELLO M.|BOCCOLA G.|CARLETTI A.|SCARMIGLIATI M.|TONONI R.|FERTONANI GL.|SISTO S.|GENOCCHIO PC.|MEMINI I.|FERRARO V.|ALGERI A.|TONELLI D.|RAMBALDINI M.|ZANINI GL.|VINCIATI C.|GONZALEZ E.|FORESTI A.|TOSINI GL.|DA FORNO F.|BOTTURI D.|CENTONZA P.F.|FERRARI P.|BUCCHIERI N.|MORETTO A.C.|STRINGHINI G.|MODENA L.|LUGOBONI A.|VERTUA F.|AMADORI D.|CIVETTINI G.|TIBILETTI F.|BITTURINI D.|GASPARINI F.|BURDO A.|GRUMELLI M.|BETTINI M.|GIACCI GL.|AVANZINI A.|GHIZZI E.|ZENEGAGLIA D.|COSTAMAGNA S.|PROSPERO L.|SCANNAPIECO A.|CEFARIELLO G.|SQUARZONI P.|LA BELLA V.|CAMPOSTRINI E.|CHIMINELLI M.|BARBIERI G.|TANZI E.|VALOTTI G.|MONACO S.|PEROTTI F.|CAMPAGNARO R.|FRANZONI F.|DOLCERA L.|PEDRONI M.|STUMPO D.|BARTOLI F.|LONARDI N.|SCALA L.|BUTTURINI C.|GARDANI R.|BERSANELLI S.|SCARMIGLIATI A.|CACEFFO M.|SPILLER M.|BERGAMINI D.|PAIOLA D.|VERITA' M.|PITTIGLIANI F.|VALLE M.|PUSINELLI L.|CASTELLINI F.|LAVELLI D.|LUGO G.|PEGORARI C.|MOSCATELLI A.|CENZON A.|PEROTTI D.|SAMBERO A.|BERTAJOLA D.|BERTUZZO F.|CHIGNOLA M.|TAMIOZZO M.|GOLA M.|FONTANA A.|FORTE D.|SCHIPPERS E.|CALANCHI N.|HARRABI S.|RIGHETTI M.|POLLONI G.|REGA F.|TURRINI M.|BITTURINI N.|VULTAGGIO F.|NIZI M.|MARCOLINI A.|PEGORARI L.|CHIMINI M.|BUTTITTA A.|MOSELE M.|MENEGHETTI G.|PERINELLI A.|GHIDINELLI F.|MEDA M.|DALLA BONA M.|MALVONE S.|PRADELLA P.|MOSELE S.|BIGNOTTI F.|CUPOLILLO M.`.split('|');
  const PDF_SENIORITY_RANK = new Map(
    PDF_SENIORITY_NAMES.map((name, index) => [normalizeAgentName(name), index])
  );

  function pdfSeniorityRank(agent) {
    return PDF_SENIORITY_RANK.get(normalizeAgentName(agent?.agente)) ?? Number.POSITIVE_INFINITY;
  }

  function normalizeScheduleAgents(data) {
    const seen = new Map();
    Object.entries(data?.residenze || {}).forEach(([residence, list]) => {
      const unique = [];
      (list || []).forEach(agent => {
        const uid = String(agent.agent_uid || stableAgentUid(agent.agente));
        if (!uid) return;
        agent.agent_uid = uid;
        const existing = seen.get(uid);
        if (existing) {
          existing.turni = { ...(existing.turni || {}), ...(agent.turni || {}) };
          existing.turni_settimanali = { ...(existing.turni_settimanali || {}), ...(agent.turni_settimanali || {}) };
          if (!existing.qualifica && agent.qualifica) existing.qualifica = agent.qualifica;
          if (!existing.role && agent.role) existing.role = agent.role;
          return;
        }
        seen.set(uid, agent);
        unique.push(agent);
      });
      // Ordine ufficiale del PDF legato al nominativo, mai al numero agente.
      // sort() è stabile: i nuovi nominativi non ancora presenti nel PDF
      // conservano il loro ordine originale in fondo alla residenza.
      data.residenze[residence] = unique.sort((a, b) =>
        pdfSeniorityRank(a) - pdfSeniorityRank(b)
      );
    });
    return data;
  }

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function directoryFrom(data) {
    normalizeScheduleAgents(data);
    const byId = new Map();
    Object.entries(data?.residenze || {}).forEach(([residence, list]) => {
      (list || []).forEach(agent => {
        const qualifica = String(agent.qualifica || 'marinaio').trim();
        const item = {
          id:String(agent.id || ''),
          agent_uid:String(agent.agent_uid || stableAgentUid(agent.agente)),
          name:String(agent.agente || '').trim(),
          qualifica,
          residence,
          role:String(agent.role || '').trim().toLowerCase() || (qualifica.toLowerCase() === 'barista' ? 'barista' : '')
        };
        if (item.agent_uid && item.name) byId.set(item.agent_uid, item);
      });
    });

    const baristas = Array.isArray(data?.bariste) ? data.bariste : (Array.isArray(data?.barista) ? data.barista : []);
    baristas.forEach(record => {
      const name = String(record.barista || record.agente || record.nome || '').trim();
      if (!name) return;
      const generated = `BARISTA_${name.toLocaleUpperCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      const id = String(record.id || generated);
      const agent_uid = stableAgentUid(name);
      if (!byId.has(agent_uid)) byId.set(agent_uid, { id, agent_uid, name, qualifica:'barista', residence:'BARISTE', role:'barista' });
    });

    const profileOverrides = data?.agentProfileOverrides || {};
    byId.forEach(agent => {
      const override = profileOverrides[agent.id] || Object.values(profileOverrides).find(item => String(item?.id) === String(agent.id));
      if (!override) return;
      if (override.qualifica) agent.qualifica = override.qualifica;
      if (override.role !== undefined) agent.role = override.role;
    });

    Object.values(profileOverrides).forEach(override => {
      if (!override || !String(override?.residence || "").trim()) return;
      const id = String(override.id || "").trim();
      const name = String(override.name || "").trim();
      if (!id || !name) return;
      const uid = stableAgentUid(name);
      if (byId.has(uid)) return;
      const qualifica = String(override.qualifica || "").trim().toLowerCase();
      byId.set(uid, {
        id,
        agent_uid: uid,
        name,
        qualifica,
        residence: String(override.residence).trim(),
        role: String(override.role || "").trim().toLowerCase()
      });
    });

    return [...byId.values()].sort((a, b) => {
      const baristaA = String(a.role || a.qualifica || '').toLowerCase() === 'barista' ? 1 : 0;
      const baristaB = String(b.role || b.qualifica || '').toLowerCase() === 'barista' ? 1 : 0;
      return baristaA - baristaB || a.name.localeCompare(b.name, 'it');
    });
  }

  function save(data) {
    normalizeScheduleAgents(data);
    normalizeScheduleShifts(data);
    injectProfileAgents(data);
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    localStorage.setItem(TIME_KEY, String(Date.now()));
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify(directoryFrom(data)));
    return data;
  }

  function replaceByKey(base, additions, keyOf) {
    const map = new Map();
    (base || []).forEach(item => map.set(keyOf(item), item));
    (additions || []).forEach(item => map.set(keyOf(item), item));
    return [...map.values()];
  }

  function normalizedImportedShift(value) {
    const raw = String(value ?? '').trim().toUpperCase().replace(/[‐‑–—]/g, '-');
    if (!raw || /^(?:RIP(?:\.|-*)?|RIPOSO|-{2,}|={2,})$/.test(raw)) return 'RIP';
    if (/^(?:CONG?\.?|CON;|CONC\.?|C\.)$/.test(raw)) return 'CON';
    if (/^(?:LAV\.?|TERRA)$/.test(raw)) return 'TERRA';
    if (/^F\.?P\.?-*$/.test(raw)) return 'F.P.';
    return raw.replace(/\.{2,}$/g, '.').replace(/-+$/g, '');
  }

  function normalizeScheduleShifts(data) {
    Object.values(data?.residenze || {}).forEach(list => (list || []).forEach(agent => {
      Object.keys(agent.turni || {}).forEach(iso => { agent.turni[iso] = normalizedImportedShift(agent.turni[iso]); });
      Object.values(agent.turni_settimanali || {}).forEach(week => {
        if (Array.isArray(week)) week.forEach((shift,index) => { week[index] = normalizedImportedShift(shift); });
      });
    }));
    return data;
  }

  const UFFICI_RESIDENCE = "Uffici";
  const UFFICI_OFFICES = ["movimento", "amministrazione", "personale", "controllo", "direzione"];

  // Residenza fittizia "Uffici": gli agenti vengono creati dalla pagina di
  // gestione agenti e salvati tra i profili amministrativi; qui vengono
  // iniettati come residenza vera e propria così che NaviTurni, il login e
  // l'anagrafica li trattino come tutti gli altri.
  function injectUfficiResidence(data) {
    if (!data || typeof data !== "object") return data;
    const profiles = Object.values(data.agentProfileOverrides || {})
      .filter(item => item && String(item.id || "").trim() &&
        String(item.residence || "").trim().toLowerCase() === "uffici");
    if (!profiles.length) {
      if (data.residenze) delete data.residenze[UFFICI_RESIDENCE];
      return data;
    }
    const rows = profiles.map(item => {
      const qualifica = String(item.qualifica || "").trim().toLowerCase();
      return {
        agente: String(item.name || item.id || "").trim(),
        id: String(item.id).trim(),
        qualifica: UFFICI_OFFICES.includes(qualifica) ? qualifica : String(item.qualifica || "").trim().toLowerCase(),
        role: String(item.role || "").trim().toLowerCase(),
        turni: {},
        turni_settimanali: {}
      };
    }).filter(item => item.agente)
      .sort((a, b) => a.agente.localeCompare(b.agente, "it"));
    data.residenze = data.residenze || {};
    data.residenze[UFFICI_RESIDENCE] = rows;
    return data;
  }

  // Iniezione estesa: oltre alla residenza "Uffici", gli agenti creati dalla
  // pagina di gestione vengono aggiunti alla propria residenza se non sono
  // già presenti nel turno ufficiale (confronto per id o nominativo).
  function injectProfileAgents(data) {
    if (!data || typeof data !== "object") return data;
    injectUfficiResidence(data);
    const extras = Object.values(data.agentProfileOverrides || {})
      .filter(item => item && String(item.id || "").trim() &&
        String(item.residence || "").trim() &&
        String(item.residence || "").trim().toLowerCase() !== "uffici");
    if (!extras.length) return data;
    data.residenze = data.residenze || {};
    extras.forEach(item => {
      const residence = String(item.residence).trim();
      const name = String(item.name || item.id || "").trim();
      const id = String(item.id).trim();
      const qualifica = String(item.qualifica || "").trim().toLowerCase();
      if (!name || !residence) return;
      const list = data.residenze[residence] = data.residenze[residence] || [];
      const exists = list.some(agent =>
        String(agent.id || "") === id ||
        String(agent.agente || "").trim().toLocaleUpperCase("it") === name.toLocaleUpperCase("it")
      );
      if (exists) return;
      list.push({
        agente: name,
        id,
        qualifica,
        role: String(item.role || "").trim().toLowerCase(),
        turni: {},
        turni_settimanali: {}
      });
    });
    return data;
  }

  function importedDate(iso, state) {
    const date = new Date(`${iso}T12:00:00`);
    const days = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
    const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
    return {
      iso,
      label:`${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`,
      giorno:days[date.getDay()],
      numero:date.getDate(),
      mese:date.getMonth() + 1,
      anno:date.getFullYear(),
      stato:state === 'bozza' ? 'bozza' : 'ufficiale'
    };
  }

  function applyScheduleImports(data, imports) {
    normalizeScheduleAgents(data);
    const active = (imports || []).filter(item => item && item.attiva !== false)
      .sort((a,b) => String(a.importedAt || '').localeCompare(String(b.importedAt || '')));
    if (!active.length) return data;
    const dateMap = new Map((data.date || []).map(item => [item.iso, item]));
    const agents = Object.values(data.residenze || {}).flat();
    const legacyDesenzanoJune2026 = {
      65:'TIBILETTI F.',66:'BITTURINI D.',67:'GASPARINI F.',68:'BURDO A.',69:'BETTINI M.',70:'GRUMELLI M.',71:'GIACCI GL.',72:'AVANZINI A.',73:'GHIZZI E.',74:'ZENEGAGLIA D.',75:'COSTAMAGNA S.',76:'PROSPERO L.',77:'SCANNAPIECO A.',78:'CEFARIELLO G.',79:'SQUARZONI P.',80:'LA BELLA V.',81:'CAMPOSTRINI E.',82:'CHIMINELLI M.',83:'BARBIERI G.',84:'TANZI E.',85:'VALOTTI G.',86:'MONACO S.',87:'PEROTTI F.',88:'CAMPAGNARO R.',89:'FRANZONI F.',90:'DOLCERA L.',91:'PEDRONI M.',92:'STUMPO D.',93:'BARTOLI F.',94:'LONARDI N.',95:'SCALA L.',96:'BUTTURINI C.',97:'GARDANI R.',98:'BERSANELLI S.',99:'SCARMIGLIATI A.',100:'CACEFFO M.',101:'SPILLER M.',102:'BERGAMINI D.',103:'PAIOLA D.'
    };
    active.forEach(batch => {
      (batch.dates || []).forEach(iso => dateMap.set(iso, importedDate(iso, batch.tipo)));
      (batch.rows || []).forEach(row => {
        const legacyBatch = !row.agent_uid && String(batch.inizio || '') === '2026-06-22' && String(batch.fine || '') === '2026-07-26';
        const legacyName = legacyBatch ? legacyDesenzanoJune2026[Number(row.id_agente)] : '';
        const wantedUid = String(row.agent_uid || stableAgentUid(legacyName || row.agente));
        const target = agents.find(agent => String(agent.agent_uid || stableAgentUid(agent.agente)) === wantedUid) ||
          (!wantedUid ? agents.find(agent => String(agent.id || '') === String(row.id_agente || '')) : null);
        if (!target) return;
        if (!target.turni) target.turni = {};
        (batch.dates || []).forEach((iso, index) => {
          target.turni[iso] = normalizedImportedShift(row.turni?.[index]);
        });
      });
    });
    data.date = [...dateMap.values()].sort((a,b) => a.iso.localeCompare(b.iso));
    data.scheduleImports = active;
    return data;
  }

  async function mergeAdminUpdates(data) {
    const provider = window.NaviFirebase?.getAdminUpdates
      ? window.NaviFirebase
      : window.NaviAdminFirebase;
    if (!data || !provider?.getAdminUpdates) return data;
    try {
      await provider.ready;
      const updates = await provider.getAdminUpdates();
      applyScheduleImports(data, updates.scheduleImports);
      const profileOverrides = updates.agentProfiles || {};
      data.agentProfileOverrides = profileOverrides;
      Object.values(data.residenze || {}).forEach(list => (list || []).forEach(agent => {
        const override = profileOverrides[String(agent.id)] || Object.values(profileOverrides).find(item => String(item?.id) === String(agent.id));
        if (!override) return;
        if (override.qualifica) {
          if (!agent.schedule_qualifica) agent.schedule_qualifica = String(agent.qualifica || '').trim().toLowerCase();
          agent.qualifica = override.qualifica;
          agent.regraded = String(override.qualifica).trim().toLowerCase() !== agent.schedule_qualifica;
        }
        if (override.role !== undefined) agent.role = override.role;
      }));
      const ods = [...(updates.odsVariations || []), ...(updates.manualVariations || [])];
      data.variazioni_ods = replaceByKey(
        data.variazioni_ods || [],
        ods,
        item => `${item?.data || ''}|${item?.id_agente || item?.agente || ''}|${item?.tipo || ''}|${item?.ods || ''}`
      ).sort((a, b) => {
        const priority = item => String(item?.tipo || '').toUpperCase() === 'MANUALE'
          ? (item?.requestId ? -1 : 1000000)
          : Number.parseInt(String(item?.ods || '').match(/\d+/)?.[0] || '0', 10);
        return priority(a) - priority(b);
      });
      data.bariste = replaceByKey(
        data.bariste || [],
        updates.baristas || [],
        item => `${item?.data || ''}|${item?.corsa || ''}|${String(item?.barista || item?.agente || item?.nome || '').trim().toLocaleUpperCase('it')}`
      );
      data.turni_navi = replaceByKey(
        data.turni_navi || [],
        updates.turniNavi || [],
        item => `${item?.data || ''}|${item?.corsa || ''}|${String(item?.nave || '').trim().toLocaleUpperCase('it')}`
      );
      data.dismissedOdsApprovals = Array.isArray(updates.dismissedOdsApprovals) ? updates.dismissedOdsApprovals : [];
    } catch (error) {
      console.warn('Aggiornamenti amministrativi Firebase non disponibili.', error);
    }
    return data;
  }

  function cached(allowStale = false) {
    const data = read(DATA_KEY);
    const age = Date.now() - Number(localStorage.getItem(TIME_KEY) || 0);
    return data && (allowStale || age < MAX_AGE) ? normalizeScheduleAgents(normalizeScheduleShifts(data)) : null;
  }

  async function fetchJson(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const target = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const response = await fetch(requestUrl(target), {
        cache:'no-store',
        signal:controller.signal
      });
      if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Dati non validi');
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function load(_url, { force = false } = {}) {
    const base = await loadBase(_url, { force });
    return mergeAdminUpdates(base).then(data => {
      lastSource = 'firebase';
      return save(data);
    });
  }

  async function loadBase(_url, { force = false } = {}) {
    if (!force) {
      const data = cached();
      if (data) {
        lastSource = 'local';
        return data;
      }
    }
    if (pending) return pending;
    pending = fetchJson(FIREBASE_SCHEDULE_URL, 8000)
      .then(data => {
        lastSource = 'firebase';
        return save(data);
      })
      .catch(error => {
        const fallback = cached(true);
        if (fallback) { lastSource = 'local'; return fallback; }
        throw error;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  function directory() {
    return read(DIRECTORY_KEY) || directoryFrom(cached(true));
  }

  function clear() {
    localStorage.removeItem(DATA_KEY);
    localStorage.removeItem(TIME_KEY);
    localStorage.removeItem(DIRECTORY_KEY);
    localStorage.removeItem('navi.agentDirectory.v1');
  }

  window.NaviSharedData = {
    load,
    loadBase,
    directory,
    clear,
    isFresh:() => !!cached(),
    source:() => lastSource,
    provider:() => lastSource === 'firebase' ? 'NaviSuite Database' : 'Memoria locale',
    seniorityRank:name => pdfSeniorityRank({ agente: name })
  };
})();
