/*
 * NaviSuite · Ruoli condivisi
 *
 * Sorgente unica per il riconoscimento di amministratori, super user e bariste.
 * Prima di questo file ogni pagina/modulo ripeteva la stessa logica: una
 * divergenza (il mancato controllo su `cognome`) era la causa storica del bug
 * per cui Hiba non veniva riconosciuta e non vedeva il proprio turno.
 *
 * Espone `window.NaviRoles`. Va caricato come primo script interno, prima di
 * shared-menu.js e turni-shared.js. Quei due moduli mantengono comunque un
 * fallback interno identico, per le pagine che non lo caricano
 * (es. gestione_navi.html).
 */
(function () {
  'use strict';

  const ADMIN_IDS = ['91', '92'];
  const idOf = agent => String(agent?.id || '').trim();
  const idOrAgentIdOf = agent => String(agent?.id || agent?.agentId || '').trim();
  const roleOf = agent => String(agent?.role || '').toLowerCase();
  const qualificaOf = agent => String(agent?.qualifica || '').toLowerCase();

  // Amministratore "pieno": ID storici oppure ruolo esplicito `admin`.
  function isAdminAgent(agent) {
    return ADMIN_IDS.includes(idOf(agent)) || roleOf(agent) === 'admin';
  }

  // Come sopra, ma riconosce anche `role == 'super_user'`. Usato dai moduli che
  // concedono al super user le stesse funzioni admin (Ponte Radio, Centro Push).
  function isAdminOrSuperUser(agent) {
    return ADMIN_IDS.includes(idOrAgentIdOf(agent)) || ['admin', 'super_user'].includes(roleOf(agent));
  }

  // Barista in base al ruolo o alla qualifica registrata nell'anagrafica.
  function isBaristaAgent(agent) {
    return roleOf(agent) === 'barista' || qualificaOf(agent) === 'barista';
  }

  // Hiba: barista con vista completa. Riconosciuta dall'ID sintetico
  // `BARISTA_HIBA` oppure dal nome/agente/cognome uguale a "HIBA".
  function isHibaBarista(agent) {
    if (idOf(agent).toUpperCase() === 'BARISTA_HIBA') return true;
    const label = String(agent?.name || agent?.agente || agent?.cognome || '').trim().toUpperCase();
    return isBaristaAgent(agent) && label === 'HIBA';
  }

  window.NaviRoles = Object.freeze({
    isAdminAgent,
    isAdminOrSuperUser,
    isBaristaAgent,
    isHibaBarista,
  });
})();
