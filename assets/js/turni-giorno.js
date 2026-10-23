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
    const code = raw.match(/^C?(D[1-4]|BIS|T[12]|M1|R[1-4]|P[1-3]|SR[12])C?\*?$/)?.[1];
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
      if (item?.ods === 'MOVIMENTO') {
        const decisione = { shift, sovrascrive: item.sovrascrive };
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

        if (decisione && (manual === undefined || String(manual).trim().toUpperCase() === String(decisione.sovrascrive ?? '').trim().toUpperCase())) {
          currentTurno = String(decisione.shift ?? '').trim();
          isModified = true;
          modifiedBy = 'Movimento';
        } else if (manual !== undefined) {
          currentTurno = String(manual).trim();
          isModified = true;
          modifiedBy = 'Utente';
        } else if (variation !== undefined) {
          currentTurno = String(variation).trim();
          isModified = true;
          modifiedBy = 'ODs';
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
          modifiedBy
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
  const COLORI_NAVITURNI = { d1: '#3b6bcc', d2: '#2d9e6b', d3: '#e07b3a', d4: '#c45cba', dt: '#e6d44a', bis: '#5ec4d4', pond: '#f08080', rip: '#6b7280', cong: '#a78bfa', agb: '#60a5fa', fp: '#94a3b8', rf: '#84cc16', lav: '#c49a6c', agm: '#f472b6', agt: '#818cf8', other: '#94a3b8' };
  function coloreTurno(code) {
    const u = String(code || '').toUpperCase().trim().replace(/\*/g, '');
    if (!u || /^(R|RIP|RIPOSO)$/.test(u)) return COLORI_NAVITURNI.rip;
    const k = /^(D1|R1|P1|T1)/.test(u) ? 'd1' : /^(D2|R2|P2|T2)/.test(u) ? 'd2' : /^(D3|R3|P3|M1)/.test(u) ? 'd3' : /^(D4|R4|P4)/.test(u) ? 'd4'
      : /^DT/.test(u) ? 'dt' : /^BIS/.test(u) ? 'bis' : /^POND/.test(u) ? 'pond' : /^AGB/.test(u) ? 'agb' : /^CON/.test(u) ? 'cong' : /^(FP|F\.P\.|CORSO)$/.test(u) ? 'fp' : u === 'RF' ? 'rf' : /^(LAV|TERRA)/.test(u) ? 'lav' : /^AGM/.test(u) ? 'agm' : /^AGT/.test(u) ? 'agt' : 'other';
    return COLORI_NAVITURNI[k];
  }
  // testo chiaro sui colori scuri, scuro su quelli chiari
  const testoSu = hex => { const n = parseInt(String(hex).slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? '#06231f' : '#ffffff'; };

  root.NaviTurniGiorno = { coloreTurno, testoSu, SIGLE_TERRA, TERRA_RESIDENZA, norm, terraCode, terraResidenza, naveCode, GRADI, gradoOf, comandante, equipaggi, turnoAgente, creaTurno, caricaModifiche, setModifiche, modificaManuale, modificheManuali };
})(typeof window !== 'undefined' ? window : globalThis);
