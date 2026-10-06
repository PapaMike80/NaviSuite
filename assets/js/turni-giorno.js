// Turni di una giornata dai dati condivisi (come NaviTurni e Oggi): turno di ogni agente con le
// variazioni ODS, equipaggi delle navi ordinati per grado, agenti a terra e comandante.
// Usato dalle pagine Servizi a terra e Il mio turno. Modulo puro: niente DOM.
(function (root) {
  'use strict';

  // Turni a terra negli orari degli agenti (AGB, POND, AGT...) e sigla del servizio.
  // AGT e AGT1 sono lo stesso servizio: AgT.
  const SIGLE_TERRA = { AGB: 'AgB', POND: 'PonD', DT: 'DT', AGM: 'AgM', AGT: 'AgT', AGT1: 'AgT', AGT2: 'AgT2', PONM: 'PonM' };
  const TERRA_RESIDENZA = { DESENZANO: ['AgB', 'PonD', 'DT'], MADERNO: ['AgM', 'AgT', 'AgT2', 'PonM'] };
  const norm = value => String(value || '').trim().toLocaleUpperCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  function terraCode(value) {
    const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = raw.match(/^C?(AGB|POND|DT|AGM|AGT[12]?|PONM)C?$/)?.[1];
    return code ? SIGLE_TERRA[code] : '';
  }
  // Residenza di un servizio a terra (AgB -> DESENZANO).
  const terraResidenza = code => Object.keys(TERRA_RESIDENZA).find(res => TERRA_RESIDENZA[res].includes(code)) || '';

  // Turno nave di un agente (D1, P2, M1, T1, R1, SR1...): come in Oggi, CxxC (trasferta) vale xx.
  function naveCode(value) {
    const raw = String(value || '').trim().toUpperCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, '');
    const code = raw.match(/^C?(D[1-4]|BIS|T[12]|M1|R[1-4]|P[1-3]|SR[12])C?$/)?.[1];
    return code || '';
  }
  // Grado per ordinare e colorare l'equipaggio, come nel popup di NaviTurni.
  const GRADI = [
    [/capitano|comandante/i, 'Comandante', '#facc15', 1],
    [/capo\s*tim|capotim/i, 'Capo timoniere', '#fb923c', 1],
    [/aiuto\s*motorista|aiutomotorista/i, 'Aiuto motorista', '#3b82f6', 4],
    [/motorista/i, 'Motorista', '#a855f7', 2],
    [/timoniere/i, 'Timoniere', '#22c55e', 3],
    [/marinaio/i, 'Marinaio', '#ffffff', 5]
  ];
  const gradoOf = agent => GRADI.find(([pattern]) => pattern.test(String(agent?.qualifica || agent?.grado || '')))?.slice(1) || ['', '#e8f3f6', 9];
  // Comandante della nave: il capitano/comandante o, se manca, il capo timoniere (a bordo fa da capitano).
  const comandante = crew => (crew || []).find(member => member.grado[0] === 'Comandante')?.name ||
    (crew || []).find(member => member.grado[0] === 'Capo timoniere')?.name || '';

  function variazioni(data, day) {
    const map = new Map();
    (data?.variazioni_ods || []).forEach(item => {
      if (String(item?.data || '').slice(0, 10) !== day) return;
      const shift = item?.turno_nuovo ?? item?.turno;
      if (shift === undefined) return;
      if (item?.id_agente) map.set(`id:${item.id_agente}`, shift);
      if (item?.agente) map.set(`name:${norm(item.agente)}`, shift);
    });
    return map;
  }
  const turnoDi = (agent, day, map) => {
    const variation = map.get(`id:${agent?.id}`) ?? map.get(`name:${norm(agent?.agente)}`);
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

  // Turno di un agente (profilo di sessione: id e nome) in un giorno: {agent, residenza, turno}.
  function turnoAgente(data, profile, day) {
    const id = String(profile?.id || ''), name = norm(profile?.name || profile?.agente || profile?.cognome);
    for (const [residenza, list] of Object.entries(data?.residenze || {})) {
      const agent = (list || []).find(item => (id && String(item?.id || '') === id) || (!id && norm(item?.agente) === name));
      if (agent) return { agent, residenza, turno: String(turnoDi(agent, day, variazioni(data, day)) ?? '').trim() };
    }
    return null;
  }

  root.NaviTurniGiorno = { SIGLE_TERRA, TERRA_RESIDENZA, norm, terraCode, terraResidenza, naveCode, GRADI, gradoOf, comandante, equipaggi, turnoAgente };
})(typeof window !== 'undefined' ? window : globalThis);
