// Riepilogo della giornata per le notifiche push: titolo e testo con corsa,
// nave, orario di presentazione (anticipato se c'e' rifornimento), prima
// partenza, ormeggio serale ed equipaggio. Usato dall'invio manuale admin
// (push-center.js) e dal push-worker su TrueNAS, che scarica questo file da
// GitHub Pages: e' la stessa logica in entrambi i posti.
// Modulo puro (nessun DOM). Orari da course-info.js.
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NaviPushSummary = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const NON_WORKING = /^(?:RIP|RIPOSO|CON|CONG|CONGEDO|FERIE|MAL|MALATTIA|F\.?P\.?|S\.S\.|===|--+)$/i;
  const asArray = value => Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean);
  const norm = value => String(value || '').trim().toLocaleUpperCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();

  function displayShift(value) {
    const raw = String(value ?? '').trim().toUpperCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, '');
    if (!raw || /^(?:RIP|RIPOSO|===|--+)$/.test(raw)) return 'RIP';
    if (/^(?:CON|CONG\.?|CONGEDO)$/.test(raw)) return 'CON';
    if (/^(?:LAV\.?|TERRA)$/.test(raw)) return 'TERRA';
    if (/^F\.?P\.?$/.test(raw)) return 'F.P.';
    return raw;
  }

  // Corsa imbarcata del turno (trasferte CxxC comprese); CAR1/CAP1 -> CAR/CAP.
  function courseShift(value) {
    const raw = displayShift(value);
    const direct = raw.match(/^C?(D[1-4]|BIS2?|T[12]|M1|R[1-4]|CAR\d*|P[1-3]|CAP\d*|SR[12])C?$/)?.[1];
    if (!direct) return '';
    return /^(CAR|CAP)\d+$/.test(direct) ? direct.replace(/\d+$/, '') : direct;
  }

  function dateLabel(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    return `${WEEKDAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
  }

  function roleRank(agent) {
    const value = String(agent?.qualifica || agent?.grado || agent?.role || '');
    if (/capitano|comandante/i.test(value)) return 1;
    if (/capo\s*timoniere|capotimoniere/i.test(value)) return 2;
    if (/motorista/i.test(value) && !/aiuto/i.test(value)) return 3;
    if (/timoniere/i.test(value)) return 4;
    if (/aiuto\s*motorista|aiutomotorista/i.test(value)) return 5;
    if (/marinaio/i.test(value)) return 6;
    if (/barista/i.test(value)) return 7;
    return 99;
  }

  function flattenAgents(data) {
    const result = [], seen = new Set();
    Object.entries(data?.residenze || {}).forEach(([residence, list]) => (list || []).forEach(agent => {
      const key = String(agent?.id || agent?.agent_uid || norm(agent?.agente || agent?.name));
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({ ...agent, __residence: residence });
    }));
    return result;
  }

  function findAgent(data, id) {
    return flattenAgents(data).find(agent => String(agent?.id || agent?.agent_uid || '') === String(id)) || null;
  }

  // Dato nave della corsa: tra le righe attive della giornata vale la piu'
  // recente (un ODS ricaricato sostituisce la lettura precedente).
  function shipInfoFor(data, iso, shift) {
    const course = courseShift(shift);
    if (!course) return null;
    return asArray(data?.turni_navi)
      .filter(item => item?.attiva !== false && String(item?.data || '').slice(0, 10) === iso && courseShift(item?.corsa || item?.turno) === course && String(item?.nave || item?.ormeggio_serale || item?.rifornimento_mattina || '').trim())
      .sort((a, b) => String(b?.inserita_il || b?.updatedAt || '').localeCompare(String(a?.inserita_il || a?.updatedAt || '')))[0] || null;
  }

  function crewFor(data, iso, shift) {
    const course = courseShift(shift);
    if (!course) return [];
    return flattenAgents(data).filter(agent => courseShift(agent?.turni?.[iso]) === course)
      .sort((a, b) => roleRank(a) - roleRank(b) || String(a.agente || a.name).localeCompare(String(b.agente || b.name), 'it'));
  }

  function hasRefuel(ship) {
    const value = ship?.rifornimento_mattina ?? ship?.rifornimento ?? ship?.rifornimentoMattina ?? '';
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    const text = String(value).trim();
    return !!text && !/^(?:0|false|no)$/i.test(text);
  }

  // Dati della giornata dell'agente, anche per altri usi (es. orario di invio
  // "prima dell'inizio del servizio").
  function dayDetails(data, agentId, iso, options = {}) {
    const agent = findAgent(data, agentId);
    if (!agent) return null;
    const shift = displayShift(agent?.turni?.[iso]);
    const working = !!shift && !NON_WORKING.test(shift);
    const ship = working ? shipInfoFor(data, iso, shift) : null;
    const refuel = hasRefuel(ship);
    const courseInfo = options.courseInfo || root.NaviCourseInfo;
    const times = working && courseShift(shift) && courseInfo?.info ? courseInfo.info(courseShift(shift), iso, { refuel }) : null;
    return {
      agent, shift, working, ship, refuel, times,
      vessel: String(ship?.nave || ship?.nome_nave || '').trim(),
      berth: String(ship?.ormeggio_serale || ship?.ormeggio || ship?.ormeggioSera || '').trim(),
      crew: working ? crewFor(data, iso, shift).map(item => String(item?.agente || item?.name || '').trim()).filter(Boolean) : []
    };
  }

  function buildSummary(data, agentId, iso, options = {}) {
    const day = dayDetails(data, agentId, iso, options);
    if (!day) throw new Error('Agente non trovato nel turno corrente.');
    const { shift, working, vessel, berth, refuel, times, crew } = day;
    const title = `NaviSuite · ${dateLabel(iso)} · ${shift || 'N/D'}${working && vessel ? ` · ${vessel}` : ''}`;
    if (!working) return { title, body: shift || 'Nessun servizio assegnato.', shift: shift || '', iso, presentation: '' };
    const lines = [];
    if (times?.presentation) lines.push(`Presentarsi alle ${times.presentation}${refuel ? ' · ⛽ rifornimento' : ''}`);
    else if (refuel) lines.push('⛽ Rifornimento in mattinata');
    if (times?.firstDeparture) lines.push(`Prima partenza ${times.firstDeparture}${times.trips ? ` · corse ${times.trips}` : ''}${times.lastArrival ? ` · fine ${times.lastArrival}` : ''}`);
    if (!vessel && courseShift(shift)) lines.push('Nave non ancora assegnata');
    if (berth) lines.push(`Ormeggio serale: ${berth}`);
    if (crew.length) lines.push(`Equipaggio: ${crew.join(', ')}`);
    let body = lines.join('\n') || shift;
    if (body.length > 500) body = body.slice(0, 499) + '…';
    return { title, body, shift, iso, presentation: times?.presentation || '' };
  }

  // Turno effettivo calcolato dai dati Firebase grezzi, con le stesse regole
  // di NaviSuite (shared-data.js): turni caricati e cambi di residenza, poi
  // variazioni ODS e manuali in ordine di priorita', dati nave aggiornati.
  // `shared` espone applyScheduleImports e applyProfileResidenceMoves.
  function effectiveData(base, updates = {}, shared = {}) {
    const data = JSON.parse(JSON.stringify(base || {}));
    if (shared.applyScheduleImports) shared.applyScheduleImports(data, asArray(updates.scheduleImports));
    const profiles = updates.agentProfiles || {};
    if (shared.applyProfileResidenceMoves) shared.applyProfileResidenceMoves(data, profiles);
    const agents = flattenAgentsRaw(data);
    agents.forEach(agent => {
      const override = profiles[String(agent.id)] || Object.values(profiles).find(item => String(item?.id) === String(agent.id));
      if (override?.qualifica) agent.qualifica = override.qualifica;
    });
    const priority = item => String(item?.tipo || '').toUpperCase() === 'MANUALE'
      ? (item?.requestId ? -1 : 1000000)
      : Number.parseInt(String(item?.ods || '').match(/\d+/)?.[0] || '0', 10);
    const byId = new Map(agents.map(agent => [String(agent.id || ''), agent]));
    const byName = new Map(agents.map(agent => [norm(agent.agente), agent]));
    [...asArray(updates.odsVariations), ...asArray(updates.manualVariations)]
      .filter(item => item.attiva !== false && item.data && (item.turno_nuovo ?? item.turno))
      .sort((a, b) => priority(a) - priority(b))
      .forEach(item => {
        const agent = byId.get(String(item.id_agente || '')) || byName.get(norm(item.agente));
        if (!agent) return;
        agent.turni = agent.turni || {};
        agent.turni[String(item.data).slice(0, 10)] = String(item.turno_nuovo ?? item.turno);
      });
    data.turni_navi = [...asArray(data.turni_navi), ...asArray(updates.turniNavi)];
    return data;
  }

  function flattenAgentsRaw(data) {
    const seen = new Set(), list = [];
    Object.values(data?.residenze || {}).forEach(group => (group || []).forEach(agent => { if (!seen.has(agent)) { seen.add(agent); list.push(agent); } }));
    return list;
  }

  return { displayShift, courseShift, dateLabel, shipInfoFor, crewFor, hasRefuel, dayDetails, buildSummary, effectiveData };
});
