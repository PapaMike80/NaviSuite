// Turni di una giornata dai dati condivisi (come NaviTurni e Oggi): turno di ogni agente con le
// variazioni ODS, equipaggi delle navi ordinati per grado, agenti a terra e comandante.
// Usato dalle pagine Servizi a terra e Il mio turno. Modulo puro: niente DOM.
(function (root) {
  'use strict';

  // Turni a terra negli orari degli agenti (AGB, POND, AGT...) e sigla del servizio.
  // AGT e AGT1 sono lo stesso servizio: AgT.
  const SIGLE_TERRA = { AGB: 'AgB', POND: 'PonD', DT: 'DT', AGM: 'AgM', AGT: 'AgT', AGT1: 'AgT', AGT2: 'AgT2', PONM: 'PonM', IE: 'IE' };
  const TERRA_RESIDENZA = { DESENZANO: ['AgB', 'PonD', 'DT'], MADERNO: ['AgM', 'AgT', 'AgT2', 'PonM'], PESCHIERA: ['IE'] };
  const norm = value => String(value || '').trim().toLocaleUpperCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  function terraCode(value) {
    const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = raw.match(/^C?(AGB|POND|DT|AGM|AGT[12]?|PONM|IE)C?$/)?.[1];
    return code ? SIGLE_TERRA[code] : '';
  }
  // Residenza di un servizio a terra (AgB -> DESENZANO).
  const terraResidenza = code => Object.keys(TERRA_RESIDENZA).find(res => TERRA_RESIDENZA[res].includes(code)) || '';

  // Turno nave di un agente (D1, P2, M1, T1, R1, SR1...): come in Oggi, CxxC (trasferta) vale xx, D1* (sovrannumero) vale D1.
  function naveCode(value) {
    const raw = String(value || '').trim().toUpperCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, '');
    const code = raw.match(/^C?(D[1-4]|BIS|T[12]|M1|R[1-4]|P[1-3]|SR[12]|S\.?S\.?)C?\*?$/)?.[1];
    if (/^S\.?S\.?$/.test(code)) return 'S.S.';
    return code || '';
  }
  // Grado per ordinare e colorare l'equipaggio, come nel popup di NaviTurni.
  const GRADI = [
    [/capitano|comandante/i, 'Capitano', '#facc15', 1],
    [/capo\s*tim|capotim/i, 'Capo timoniere', '#fb923c', 1],
    [/aiuto\s*motorista|aiutomotorista/i, 'Aiuto motorista', '#3b82f6', 4],
    [/motorista/i, 'Motorista', '#a855f7', 2],
    [/timoniere/i, 'Timoniere', '#22c55e', 3],
    [/marinaio/i, 'Marinaio', '#ffffff', 5],
    [/applicato/i, 'Applicato', '#a3e635', 6]
  ];
  const gradoOf = agent => GRADI.find(([pattern]) => pattern.test(String(agent?.qualifica || agent?.grado || '')))?.slice(1) || ['', '#e8f3f6', 9];
  // Comandante della nave: il capitano/comandante o, se manca, il capo timoniere (a bordo fa da capitano).
  const comandante = crew => (crew || []).find(member => member.grado[0] === 'Capitano')?.name ||
    (crew || []).find(member => member.grado[0] === 'Capo timoniere')?.name || '';

  function variazioni(data, day) {
    const map = new Map();
    // decisioni dell'Ufficio Movimento: valgono anche sul cambio che l'agente si e' fatto nella Distinta
    map.movimento = new Map();
    (data?.variazioni_ods || []).forEach(item => {
      if (String(item?.data || '').slice(0, 10) !== day) return;
      const shift = item?.turno_nuovo ?? item?.turno;
      if (shift === undefined) return;
      if (item?.ods === 'MOVIMENTO' || item?.tipo === 'DISPOSIZIONE' || item?.docId || item?.protocollo || String(item?.tipo || '').toUpperCase() === 'MANUALE') {
        const decisione = { shift, sovrascrive: item.sovrascrive, item };
        if (item?.id_agente) map.movimento.set(`id:${item.id_agente}`, decisione);
        if (item?.agente) map.movimento.set(`name:${norm(item.agente)}`, decisione);
      }
      if (item?.id_agente) map.set(`id:${item.id_agente}`, shift);
      if (item?.agente) map.set(`name:${norm(item.agente)}`, shift);
    });
    return map;
  }
  // Turni modificati a mano in NaviDiaria (anche da NaviTurni, che apre la Distinta): vincono
  // su variazioni ODS e turno base, come in NaviTurni. Chiave "idAgente|data".
  let modifiche = new Map();
  function aggiungiModifiche(map, agentId, entries) {
    (entries || []).forEach(entry => {
      if (!entry?.date || !entry?.shift || entry.manualOverride !== true || entry.manualModified !== true) return;
      map.set(`${String(agentId)}|${String(entry.date).slice(0, 10)}`, String(entry.shift));
      // il turno da cui l'agente e' partito (per mostrare "da ... a ..." nelle richieste del Movimento)
      if (entry.manualFrom) (map.da = map.da || new Map()).set(`${String(agentId)}|${String(entry.date).slice(0, 10)}`, String(entry.manualFrom));
    });
  }
  // Le modifiche di tutti da Firebase piu' le proprie salvate sul dispositivo (non ancora sincronizzate).
  async function caricaModifiche(profile) {
    const map = new Map();
    try {
      const provider = root.NaviAdminFirebase;
      if (provider?.loadAllDiaria) {
        await provider.ready;
        (await provider.loadAllDiaria()).forEach(record => aggiungiModifiche(map, record.agentId, record.entries));
      }
    } catch (error) { console.warn('Turni: modifiche NaviDiaria non disponibili', error); }
    try {
      const id = String(profile?.id || '');
      if (id && root.localStorage) {
        const proprie = JSON.parse(root.localStorage.getItem(`navidiaria.entries.v1.${id}`) || '[]');
        // le proprie giornate sul dispositivo valgono piu' della copia online (che puo' essere indietro):
        // una giornata riportata al turno originale toglie la modifica, anche se online c'e' ancora
        (proprie || []).forEach(entry => { if (entry?.date && !(entry.manualOverride === true && entry.manualModified === true)) { const k = `${id}|${String(entry.date).slice(0, 10)}`; map.delete(k); map.da?.delete(k); } });
        aggiungiModifiche(map, id, proprie);
      }
    } catch { /* copia locale non leggibile */ }
    modifiche = map;
    return map;
  }
  // Turno modificato a mano dall'agente nella propria Distinta (NaviDiaria) in un giorno, se c'e'.
  const modificaManuale = (agentId, day) => modifiche.get(`${String(agentId)}|${day}`);
  // Tutti i cambi fatti a mano dagli agenti: [{id, day, turno}]
  const modificheManuali = () => [...modifiche.entries()].map(([key, turno]) => { const [id, day] = key.split('|'); return { id, day, turno, da: modifiche.da?.get(key) || '' }; });
  const setModifiche = map => { modifiche = map instanceof Map ? map : new Map(); };

  const turnoDi = (agent, day, map) => {
    const decisione = map.movimento?.get(`id:${agent?.id}`) ?? map.movimento?.get(`name:${norm(agent?.agente)}`);
    const manual = modifiche.get(`${String(agent?.id || '')}|${day}`);
    // la decisione del Movimento vince sul cambio dell'agente che ha sovrascritto; un cambio diverso, fatto dopo, vale subito
    if (decisione && (manual === undefined || String(manual).trim().toUpperCase() === String(decisione.sovrascrive ?? '').trim().toUpperCase())) return decisione.shift;
    if (manual) return manual;
    const variation = map.get(`id:${agent?.id}`) ?? map.get(`name:${norm(agent?.agente)}`) ?? agent?.variazioni_ods?.[day]?.turno_nuovo;
    return variation !== undefined ? variation : agent?.turni?.[day];
  };

  // Turni del giorno: {terra: {AgB: ['ROSSI']}, navi: {D1: [{id, name, grado}, ...]}}. Le variazioni ODS vincono.
  function equipaggi(data, day) {
    const map = variazioni(data, day);
    const terra = {}, navi = {}, seen = new Set();
    Object.values(data?.residenze || {}).forEach(list => (list || []).forEach(agent => {
      const key = String(agent?.id || norm(agent?.agente));
      if (!key || seen.has(key) || root.NaviRoles?.isBaristaAgent?.(agent)) return;
      seen.add(key);
      const shift = turnoDi(agent, day, map);
      const name = String(agent.agente || agent.name || '').trim();
      const ground = terraCode(shift);
      if (ground) (terra[ground] = terra[ground] || []).push(name);
      const ship = naveCode(shift);
      if (ship) (navi[ship] = navi[ship] || []).push({ id: String(agent?.id || ''), name, grado: gradoOf(agent) });
    }));
    Object.values(terra).forEach(list => list.sort((a, b) => a.localeCompare(b, 'it')));
    Object.values(navi).forEach(list => list.sort((a, b) => a.grado[2] - b.grado[2] || a.name.localeCompare(b.name, 'it')));
    return { terra, navi };
  }

  function creaTurno(baseData) {
    const originalShift = baseData && typeof baseData === 'object'
      ? JSON.parse(JSON.stringify(baseData))
      : { turno: baseData };
    const shift = {
      ...(typeof baseData === 'object' && baseData !== null ? baseData : { turno: baseData }),
      originalShift,
      isModified: false,
      modifiedBy: null
    };
    shift.updateShift = function (newData, source) {
      if (newData && typeof newData === 'object') {
        Object.assign(shift, newData);
      } else {
        shift.turno = newData;
      }
      shift.isModified = true;
      shift.modifiedBy = source ?? null;
      return shift;
    };
    shift.restoreOriginalShift = function () {
      if (shift.originalShift && typeof shift.originalShift === 'object') {
        Object.assign(shift, JSON.parse(JSON.stringify(shift.originalShift)));
      } else {
        shift.turno = shift.originalShift;
      }
      shift.isModified = false;
      shift.modifiedBy = null;
      return shift;
    };
    return shift;
  }

  // Turno di un agente (profilo di sessione: id e nome) in un giorno: {agent, residenza, turno}.
  function turnoAgente(data, profile, day) {
    const id = String(profile?.id || ''), name = norm(profile?.name || profile?.agente || profile?.cognome);
    for (const [residenza, list] of Object.entries(data?.residenze || {})) {
      const agent = (list || []).find(item => (id && String(item?.id || '') === id) || (!id && norm(item?.agente) === name));
      if (agent) {
        const vMap = variazioni(data, day);
        const decisione = vMap.movimento?.get(`id:${agent?.id}`) ?? vMap.movimento?.get(`name:${norm(agent?.agente)}`);
        const manual = modifiche.get(`${String(agent?.id || '')}|${day}`);
        const variation = vMap.get(`id:${agent?.id}`) ?? vMap.get(`name:${norm(agent?.agente)}`) ?? agent?.variazioni_ods?.[day]?.turno_nuovo;
        const original = agent?.turni?.[day] !== undefined ? String(agent.turni[day]).trim() : '';

        let currentTurno = original;
        let isModified = false;
        let modifiedBy = null;
        let variazioneInfo = null;

        if (decisione && (manual === undefined || String(manual).trim().toUpperCase() === String(decisione.sovrascrive ?? '').trim().toUpperCase())) {
          currentTurno = String(decisione.shift ?? '').trim();
          isModified = true;
          modifiedBy = decisione.item?.ods || 'Movimento';
          variazioneInfo = decisione.item || null;
        } else if (manual !== undefined) {
          currentTurno = String(manual).trim();
          isModified = true;
          modifiedBy = 'Utente';
        } else if (variation !== undefined) {
          currentTurno = String(variation).trim();
          isModified = true;
          modifiedBy = 'ODs';
          variazioneInfo = (data?.variazioni_ods || []).find(v => String(v?.data || '').slice(0, 10) === day && (String(v?.id_agente) === String(agent?.id) || norm(v?.agente) === norm(agent?.agente))) || null;
        }

        const originalShiftBackup = {
          agent,
          residenza,
          turno: original
        };

        const shiftObj = {
          agent,
          residenza,
          turno: currentTurno,
          originalShift: originalShiftBackup,
          isModified,
          modifiedBy,
          variazioneInfo
        };

        shiftObj.updateShift = function(newData, source) {
          if (newData && typeof newData === 'object') {
            if (newData.turno !== undefined) shiftObj.turno = newData.turno;
            Object.assign(shiftObj, newData);
          } else {
            shiftObj.turno = String(newData ?? '');
          }
          shiftObj.isModified = true;
          shiftObj.modifiedBy = source ?? null;
          return shiftObj;
        };

        shiftObj.restoreOriginalShift = function() {
          if (shiftObj.originalShift && typeof shiftObj.originalShift === 'object') {
            Object.assign(shiftObj, JSON.parse(JSON.stringify(shiftObj.originalShift)));
          } else {
            shiftObj.turno = String(shiftObj.originalShift ?? '');
          }
          shiftObj.isModified = false;
          shiftObj.modifiedBy = null;
          return shiftObj;
        };

        return shiftObj;
      }
    }
    return null;
  }

  // Colori dei turni come in NaviTurni (naviturni-page.js: classify + shiftBorderColor)
  const COLORI_NAVITURNI = { d1: '#3b6bcc', d2: '#2d9e6b', d3: '#e07b3a', d4: '#c45cba', dt: '#e6d44a', bis: '#5ec4d4', pond: '#f08080', rip: '#6b7280', cong: '#a78bfa', agb: '#60a5fa', fp: '#94a3b8', rf: '#84cc16', lav: '#c49a6c', agm: '#f472b6', agt: '#818cf8', ss: '#0ea5e9', other: '#94a3b8' };
  function coloreTurno(code) {
    const raw = String(code || '').toUpperCase().trim().replace(/\*/g, '');
    const u = raw.length > 2 && /^C.+C$/.test(raw) ? raw.slice(1, -1) : raw;
    if (!u || /^(R|RIP|RIPOSO)$/.test(u)) return COLORI_NAVITURNI.rip;
    const k = /^(D1|R1|P1|T1)/.test(u) ? 'd1' : /^(D2|R2|P2|T2)/.test(u) ? 'd2' : /^(D3|R3|P3|M1)/.test(u) ? 'd3' : /^(D4|R4|P4)/.test(u) ? 'd4'
      : /^DT/.test(u) ? 'dt' : /^BIS/.test(u) ? 'bis' : /^POND/.test(u) ? 'pond' : /^AGB/.test(u) ? 'agb' : /^CON/.test(u) ? 'cong' : /^(FP|F\.P\.|CORSO)$/.test(u) ? 'fp' : u === 'RF' ? 'rf' : /^(LAV|TERRA)/.test(u) ? 'lav' : /^AGM/.test(u) ? 'agm' : /^AGT/.test(u) ? 'agt' : /^S\.?S\.?/.test(u) ? 'ss' : 'other';
    return COLORI_NAVITURNI[k];
  }
  // testo chiaro sui colori scuri, scuro su quelli chiari
  const testoSu = hex => { const n = parseInt(String(hex).slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? '#06231f' : '#ffffff'; };

    // Variazioni (ODS, Movimento, Collega) per una corsa/servizio o per l'equipaggio in un giorno.
  function variazioniTurno(data, code, day, crew, options) {
    crew = crew || []; options = options || {};
    if (!data || !day) return [];
    const cleanCode = (naveCode(code) || terraCode(code) || String(code || "")).trim().toUpperCase();
    const dayStr = String(day || "").slice(0, 10);
    const results = [];
    const seen = new Set();

    const activeData = data || (typeof globalData !== "undefined" ? globalData : null) || (typeof schedule !== "undefined" ? schedule : null);
    const allAgents = Object.values(activeData?.residenze || {}).flat().filter(Boolean);
    const normStr = s => norm(s);

    const findAgent = (id, name) => {
      const idStr = String(id || "").trim();
      const n = normStr(name);
      return allAgents.find(a => (idStr && String(a.id || "").trim() === idStr) || (n && (normStr(a.agente || a.name) === n || normStr(a.agente || a.name).startsWith(n + " ") || n.startsWith(normStr(a.agente || a.name) + " "))));
    };

    const rawVods = (Array.isArray(activeData?.variazioni_ods) && activeData.variazioni_ods.length)
      ? activeData.variazioni_ods
      : ((typeof globalData !== "undefined" && Array.isArray(globalData?.variazioni_ods)) ? globalData.variazioni_ods : []);
    const vodsList = rawVods.filter(v => v && v.attiva !== false && String(v.data || "").slice(0, 10) === dayStr);

    // 1. Se fornito un turno esplicito dell'utente corrente (es. found da mio-turno.js)
    if (options.currentUserShift?.isModified) {
      const cur = options.currentUserShift;
      const vInfo = cur.variazioneInfo || {};
      const agentObj = cur.agent || {};
      const agentName = agentObj.agente || agentObj.name || options.currentUserName || "Tu";
      const orig = String(cur.originalShift?.turno || vInfo.turno_originale || "").trim();
      const nw = String(cur.turno || vInfo.turno_nuovo || cleanCode).trim();
      const key = "user:" + String(agentObj.id || agentName) + ":" + orig + ":" + nw;
      if (!seen.has(key)) {
        seen.add(key);
        const isCollega = Boolean(vInfo.requestId || vInfo.collega || vInfo.colleagueName || /collega/i.test(String(cur.modifiedBy || "")) || /utente/i.test(String(cur.modifiedBy || "")));
        const isMov = !isCollega && (vInfo.ods === "MOVIMENTO" || vInfo.tipo === "DISPOSIZIONE" || vInfo.tipo === "MANUALE" ||
          vInfo.protocollo || vInfo.docId || /movimento/i.test(String(vInfo.note || "")) || /movimento/i.test(String(cur.modifiedBy || "")));
        let tipo = isCollega ? "collega" : (isMov ? "movimento" : "ods");
        let author = "";
        if (isMov) {
          const m = String(vInfo.note || cur.modifiedBy || "").match(/Movimento\s*\(([^)]+)\)/i);
          if (m && m[1]) author = m[1].trim();
          else if (vInfo.autore && !/movimento/i.test(vInfo.autore)) author = vInfo.autore.trim();
        }
        const label = isMov
          ? (author ? "Movimento (" + author + ")" : "Movimento")
          : (tipo === "collega" ? (author ? "Collega (" + author + ")" : "Collega") : (vInfo.ods ? (String(vInfo.ods).toUpperCase().startsWith("ODS") ? vInfo.ods : "ODS " + vInfo.ods) : "ODS"));
        results.push({
          tipo,
          agentName,
          originalShift: orig,
          newShift: nw,
          author,
          label,
          ods: vInfo.ods || (tipo === "ods" ? "ODS" : ""),
          docId: vInfo.docId || "",
          protocollo: vInfo.protocollo || "",
          note: vInfo.note || ""
        });
      }
    }

    // 2. Controlla ogni membro dell'equipaggio passato
    (crew || []).forEach(member => {
      const ag = findAgent(member.id, member.name);
      const agentId = String(ag?.id || member.id || "").trim();
      const agentName = String(ag?.agente || member.name || "").trim();
      const origShift = ag?.turni?.[dayStr] !== undefined ? String(ag.turni[dayStr]).trim() : "";

      let v = vodsList.find(x => (agentId && String(x.id_agente || "").trim() === agentId) || normStr(x.agente) === normStr(agentName) || normStr(x.agente).startsWith(normStr(agentName) + " ") || normStr(agentName).startsWith(normStr(x.agente) + " "));
      if (!v && ag?.variazioni_ods?.[dayStr]) {
        v = ag.variazioni_ods[dayStr];
      }

      if (v) {
        const orig = String(v.turno_originale || origShift || "").trim();
        const nw = String(v.turno_nuovo || cleanCode).trim();
        const key = (agentId || agentName) + ":" + orig + ":" + nw;
        if (!seen.has(key)) {
          seen.add(key);
          const isCollega = Boolean(v.requestId || v.collega || v.colleagueName || (String(v.tipo || "").toUpperCase() === "MANUALE" && !/movimento/i.test(String(v.note || v.autore || ""))));
          const isMov = !isCollega && (v.ods === "MOVIMENTO" || v.tipo === "DISPOSIZIONE" || v.tipo === "MANUALE" ||
            v.protocollo || v.docId || /movimento/i.test(String(v.note || "")) || /movimento/i.test(String(v.autore || "")));
          const tipo = isCollega ? "collega" : (isMov ? "movimento" : "ods");
          let author = "";
          if (isMov) {
            const m = String(v.note || v.autore || "").match(/Movimento\s*\(([^)]+)\)/i);
            if (m && m[1]) author = m[1].trim();
            else if (v.autore && !/movimento/i.test(v.autore)) author = v.autore.trim();
          } else if (isCollega) {
            author = v.collega || v.colleagueName || "";
          }
          const label = isMov
            ? (author ? "Movimento (" + author + ")" : "Movimento")
            : (tipo === "collega" ? (author ? "Collega (" + author + ")" : "Collega") : (v.ods ? (String(v.ods).toUpperCase().startsWith("ODS") ? v.ods : "ODS " + v.ods) : "ODS"));
          results.push({
            tipo,
            agentName,
            originalShift: orig,
            newShift: nw,
            author,
            label,
            ods: v.ods || (tipo === "ods" ? "ODS" : ""),
            docId: v.docId || "",
            protocollo: v.protocollo || "",
            note: v.note || ""
          });
        }
      } else {
        const manual = agentId ? modifiche.get(agentId + "|" + dayStr) : null;
        if (manual && (!origShift || normStr(manual) !== normStr(origShift))) {
          const manualFrom = modifiche.da?.get(agentId + "|" + dayStr) || origShift;
          const key = "manual:" + (agentId || agentName) + ":" + manualFrom + ":" + manual;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              tipo: "collega",
              agentName,
              originalShift: manualFrom,
              newShift: manual,
              author: "",
              label: "Collega",
              ods: "",
              docId: "",
              protocollo: "",
              note: "Cambio turno"
            });
          }
        }
      }
    });

    // 3. Controlla agenti originariamente assegnati a questo turno e poi spostati (partiti)
    if (cleanCode && cleanCode !== "RIP") {
      allAgents.forEach(ag => {
        const orig = ag?.turni?.[dayStr] !== undefined ? String(ag.turni[dayStr]).trim() : "";
        const cleanOrig = (naveCode(orig) || terraCode(orig) || orig).toUpperCase();
        if (cleanOrig === cleanCode) {
          const agentId = String(ag.id || "").trim();
          const agentName = String(ag.agente || "").trim();
          const inCrew = (crew || []).some(m => (agentId && String(m.id || "").trim() === agentId) || normStr(m.name) === normStr(agentName));
          if (!inCrew) {
            let v = vodsList.find(x => (agentId && String(x.id_agente || "").trim() === agentId) || normStr(x.agente) === normStr(agentName));
            if (!v && ag?.variazioni_ods?.[dayStr]) v = ag.variazioni_ods[dayStr];
            if (v) {
              const nw = String(v.turno_nuovo || "RIP").trim();
              const key = "departed:" + (agentId || agentName) + ":" + orig + ":" + nw;
              if (!seen.has(key)) {
                seen.add(key);
                const isCollega = Boolean(v.requestId || v.collega || v.colleagueName || (String(v.tipo || "").toUpperCase() === "MANUALE" && !/movimento/i.test(String(v.note || v.autore || ""))));
                const isMov = !isCollega && (v.ods === "MOVIMENTO" || v.tipo === "DISPOSIZIONE" || v.tipo === "MANUALE" ||
                  v.protocollo || v.docId || /movimento/i.test(String(v.note || "")) || /movimento/i.test(String(v.autore || "")));
                const tipo = isCollega ? "collega" : (isMov ? "movimento" : "ods");
                let author = "";
                if (isMov) {
                  const m = String(v.note || v.autore || "").match(/Movimento\s*\(([^)]+)\)/i);
                  if (m && m[1]) author = m[1].trim();
                  else if (v.autore && !/movimento/i.test(v.autore)) author = v.autore.trim();
                } else if (isCollega) {
                  author = v.collega || v.colleagueName || "";
                }
                const label = isMov
                  ? (author ? "Movimento (" + author + ")" : "Movimento")
                  : (tipo === "collega" ? (author ? "Collega (" + author + ")" : "Collega") : (v.ods ? (String(v.ods).toUpperCase().startsWith("ODS") ? v.ods : "ODS " + v.ods) : "ODS"));
                results.push({
                  tipo,
                  agentName,
                  originalShift: orig,
                  newShift: nw,
                  author,
                  label,
                  ods: v.ods || (tipo === "ods" ? "ODS" : ""),
                  docId: v.docId || "",
                  protocollo: v.protocollo || "",
                  note: v.note || "",
                  partito: true
                });
              }
            }
          }
        }
      });
    }

    return results;
  }

  function formattaPastiglieVariazioni(variazioni, cssPrefix) {
    cssPrefix = cssPrefix || "nt";
    if (!variazioni || !variazioni.length) return "";
    return variazioni.map(v => {
      const cls = cssPrefix + "-var-chip " + cssPrefix + "-var-" + v.tipo;
      let icon = "📋";
      if (v.tipo === "ods") icon = "📄";
      else if (v.tipo === "collega") icon = "⇄";

      const orig = String(v.originalShift || "").trim().toUpperCase();
      const nw = String(v.newShift || "").trim().toUpperCase();

      let cambioText = "";
      if (v.partito) {
        cambioText = "(da " + (orig || "—") + " a " + (nw || "RIP") + ")";
      } else if (orig && orig !== nw) {
        cambioText = "(da " + orig + ")";
      }

      const text = v.label + ": " + v.agentName + (cambioText ? " " + cambioText : "");

      const titleParts = [
        v.label,
        v.agentName + ": " + (orig || "—") + " → " + (nw || "—"),
        v.protocollo ? "prot. " + v.protocollo : "",
        v.note ? v.note : ""
      ].filter(Boolean);

      const title = titleParts.join(" · ");
      const docAttr = v.docId ? ' data-doc-id="' + String(v.docId).replace(/"/g, "&quot;") + '"' : "";
      const odsAttr = v.ods ? ' data-ods-doc="' + String(v.ods || "").replace(/"/g, "&quot;") + '"' : "";
      const protAttr = v.protocollo ? ' data-protocollo="' + String(v.protocollo || "").replace(/"/g, "&quot;") + '"' : "";
      const agentAttr = v.agentName ? ' data-agent-name="' + String(v.agentName || "").replace(/"/g, "&quot;") + '"' : "";

      return '<span class="' + cls + '" title="' + title.replace(/"/g, "&quot;") + '"' + docAttr + odsAttr + protAttr + agentAttr + ' role="note"><i class="' + cssPrefix + '-var-icon" aria-hidden="true">' + icon + '</i>' + text + (v.docId ? " 📄" : "") + '</span>';
    }).join("");
  }

  const STATIC_ODS_FILES = {
    16: "O.d.S. n. 16-2026 ESTATE.pdf",
    18: "O.d.S. n. 18-2026.pdf",
    19: "O.d.S. n. 19-2026.pdf",
    20: "O.d.S. n. 20-2026.pdf",
    21: "O.d.S. n. 21-2026.pdf",
    22: "O.d.S. n. 22-2026.pdf",
    23: "O.d.S. n. 23-2026.pdf",
    24: "O.d.S. n. 24-2026.pdf",
    25: "O.d.S. n. 25-2026.pdf",
    26: "O.d.S. n. 26-2026.pdf",
    27: "O.d.S. n. 27-2026.pdf",
    28: "O.d.S. n. 28-2026.pdf",
    29: "O.d.S. n. 29-2026.pdf",
    30: "O.d.S. n. 30-2026.pdf",
    31: "O.d.S. n. 31-2026.pdf",
    32: "O.d.S. n. 32-2026.pdf",
    34: "O.d.S. n. 34-2026.pdf",
    35: "O.d.S. n. 35-2026.pdf",
    36: "O.d.S. n. 36-2026.pdf",
    37: "O.d.S. n. 37-2026.pdf",
    38: "O.d.S. n. 38-2026.pdf",
    39: "O.d.S. n. 39-2026 INVERNO.pdf",
    40: "O.d.S. n. 40-2026.pdf",
    41: "O.d.S. n. 41-2026.pdf"
  };

  function b64toBlobUrl(dataUrl) {
    try {
      const parts = String(dataUrl).split(',');
      const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'application/pdf';
      const b64 = parts[1] || parts[0];
      const bin = atob(b64);
      const len = bin.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      return URL.createObjectURL(blob);
    } catch (_) {
      return dataUrl;
    }
  }

  async function apriDocumentoVariazione(info) {
    info = info || {};
    const ods = String(info.odsDoc || info.odsdoc || info.ods || "").trim();
    const docId = String(info.docId || info.docid || "").trim();
    const protocollo = String(info.protocollo || "").trim();
    const agentName = String(info.agentName || info.agentname || info.agent || "").trim();
    const options = {
      agentName: agentName,
      targetSection: "variazioni",
      ods: ods,
      protocollo: protocollo
    };

    // 1. Se c'è un docId esplicito di Firebase (es. Disposizione Movimento allegata o DOC_...)
    if (docId && window.NaviAdminFirebase?.getAdminDocumentFile) {
      try {
        const raw = await window.NaviAdminFirebase.getAdminDocumentFile(docId);
        const dataUrl = typeof raw === 'string' ? raw : (raw?.dataUrl || raw?.url || '');
        if (dataUrl) {
          const blobUrl = b64toBlobUrl(dataUrl);
          const title = protocollo ? ('Disposizione ' + protocollo) : (ods ? ('ODS ' + ods) : 'Documento');
          if (typeof window.openDocument === 'function') { window.openDocument(blobUrl, title, options); return true; }
          window.open(blobUrl, '_blank');
          return true;
        }
      } catch (err) {
        console.warn('Errore apertura docId Firebase:', err);
      }
    }

    // 2. Se è un ODS (es. "43/26", "43", "40/26", etc.)
    const odsMatch = ods.match(/\d+/);
    const odsNum = odsMatch ? parseInt(odsMatch[0], 10) : null;

    if (odsNum) {
      // 2a. Verifica se è un file statico già presente nella cartella ods/
      if (STATIC_ODS_FILES[odsNum]) {
        const url = 'ods/' + encodeURIComponent(STATIC_ODS_FILES[odsNum]);
        const title = ods.toUpperCase().startsWith('ODS') ? ods : ('ODS ' + ods);
        if (typeof window.openDocument === 'function') { window.openDocument(url, title, options); return true; }
        window.open(url, '_blank');
        return true;
      }

      // 2b. Cerca nei documenti caricati su Firebase
      if (window.NaviAdminFirebase) {
        try {
          const targetDocId = 'ods-' + odsNum + '-2026';
          let raw = null;
          try {
            raw = await window.NaviAdminFirebase.getAdminDocumentFile(targetDocId);
          } catch (_) {
            raw = null;
          }

          if (!raw && window.NaviAdminFirebase.getAdminDocuments) {
            const docs = await window.NaviAdminFirebase.getAdminDocuments();
            const found = (docs || []).find(d =>
              d && (
                Number(d.numero) === odsNum ||
                String(d.id || '').toLowerCase() === targetDocId.toLowerCase() ||
                new RegExp('\\b(?:o\\.?d\\.?s\\.?|ods)[^0-9]*' + odsNum + '\\b', 'i').test(d.filename || d.titolo || '')
              )
            );
            if (found?.id) {
              raw = await window.NaviAdminFirebase.getAdminDocumentFile(found.id);
            }
          }

          const dataUrl = typeof raw === 'string' ? raw : (raw?.dataUrl || raw?.url || '');
          if (dataUrl) {
            const blobUrl = b64toBlobUrl(dataUrl);
            const title = ods.toUpperCase().startsWith('ODS') ? ods : ('ODS ' + ods);
            if (typeof window.openDocument === 'function') { window.openDocument(blobUrl, title, options); return true; }
            window.open(blobUrl, '_blank');
            return true;
          }
        } catch (err) {
          console.warn('Errore ricerca ODS su Firebase:', err);
        }
      }
    }

    // Fallback: se proprio non si trova il file esatto
    window.open('documenti.html#ods-docs', '_blank');
    return false;
  }

  root.NaviTurniGiorno = { coloreTurno, testoSu, SIGLE_TERRA, TERRA_RESIDENZA, norm, terraCode, terraResidenza, naveCode, GRADI, gradoOf, comandante, equipaggi, turnoAgente, creaTurno, caricaModifiche, setModifiche, modificaManuale, modificheManuali, variazioniTurno, formattaPastiglieVariazioni, apriDocumentoVariazione };
})(typeof window !== 'undefined' ? window : globalThis);
