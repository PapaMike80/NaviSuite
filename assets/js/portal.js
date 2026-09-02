const DIRECTORY_URL = '';
const DIARIA_SESSION = 'navidiaria.activeAgent';
const TURNI_SESSION = 'naviturni_logged_agent';
let agents = [];
let pendingFirstLogin = null;
let presenceTimer = null;

function startPresence(agent) {
  if (!window.NaviAdminFirebase?.touchUserPresence || !agent) return;
  const signal = () => window.NaviAdminFirebase.touchUserPresence(agent).catch(() => {});
  signal();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(signal, 45000);
}

const $ = id => document.getElementById(id);
const isAdminAgent = agent => ['91', '92'].includes(String(agent?.id || '')) || String(agent?.role || '').toLowerCase() === 'admin';
const isMovementAgent = agent => isAdminAgent(agent) || String(agent?.qualifica || agent?.office || '').toLowerCase().includes('movimento');
// NaviDiaria e' un registro personale: e' disponibile per ogni agente che ha
// gia' completato l'accesso, senza modificare il suo ruolo o i suoi permessi.
const canUseDiaria = agent => Boolean(String(agent?.id || '').trim());
const isBaristaAgent = agent => String(agent?.role || '').toLowerCase() === 'barista' || String(agent?.qualifica || '').toLowerCase() === 'barista';
const isHibaBarista = agent => String(agent?.id || '').toUpperCase() === 'BARISTA_HIBA' || (isBaristaAgent(agent) && String(agent?.name || agent?.agente || '').trim().toUpperCase() === 'HIBA');
let agentProfiles = {};
const profileFor = id => agentProfiles[String(id)] || Object.values(agentProfiles).find(item => String(item?.id) === String(id)) || {};
const applyAgentProfile = agent => ({...agent,...profileFor(agent?.id),id:agent?.id,name:agent?.name,residence:agent?.residence});
async function loadAgentProfiles(){try{await window.NaviAdminFirebase?.ready;const data=await window.NaviAdminFirebase?.getAgentAdminData?.();agentProfiles=data?.profiles||{};}catch(error){console.warn('Ruoli Firebase non disponibili',error)}return agentProfiles}
const formatName = name => String(name || '').trim().split(/\s+/).map(part => part.length > 1 ? part[0] + part.slice(1).toLocaleLowerCase('it') : part).join(' ');

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-navi-tab]');
  if (!link) return;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const mobile = window.innerWidth <= 800;
  if (standalone || mobile) {
    // Nelle PWA e sui telefoni apriamo nella stessa finestra: window.open può
    // essere bloccato e, dopo preventDefault, lascerebbe la scheda ferma.
    event.preventDefault();
    window.location.assign(link.href);
    return;
  }
  event.preventDefault();
  const target = window.open(link.href, link.dataset.naviTab);
  if (target) target.focus();
  else window.location.assign(link.href);
});

async function hashPin(pin) {
  if (hasSecureCrypto()) {
    const bytes = new TextEncoder().encode(`NaviDiaria:${pin}`);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Questo login richiede HTTPS (Web Crypto non disponibile).');
}

function hasSecureCrypto() {
  return typeof window !== 'undefined' && !!(window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function');
}

function renderSuggestions() {
  const input = $('agentSearch');
  const suggestions = $('agentSuggestions');
  const query = input.value.trim().toLocaleLowerCase('it');
  const exact = query && agents.some(agent => agent.name.toLocaleLowerCase('it') === query);

  // Nessun elenco prima che l'utente inizi a scrivere. Quando viene scelto
  // un agente esatto stacchiamo anche il datalist, così il menu si richiude.
  if (!query || exact) {
    suggestions.innerHTML = '';
    input.removeAttribute('list');
    return;
  }

  suggestions.innerHTML = agents
    .filter(agent => startsWithInitial(agent, query))
    .map(agent => `<option value="${agent.name.replace(/"/g, '&quot;')}">${agent.residence}</option>`)
    .join('');
  if (suggestions.children.length) input.setAttribute('list', 'agentSuggestions');
  else input.removeAttribute('list');
}

function startsWithInitial(agent, query) {
  const terms = String(agent?.name || '').toLocaleLowerCase('it').split(/[\s.'’-]+/).filter(Boolean);
  return terms.some(term => term.startsWith(query));
}

function selectedAgent() {
  const query = $('agentSearch').value.trim().toLocaleLowerCase('it');
  const exact = agents.find(agent => agent.name.toLocaleLowerCase('it') === query);
  if (exact) return exact;
  const matches = agents.filter(agent => startsWithInitial(agent, query));
  return matches.length === 1 ? matches[0] : null;
}

function showChoice(agent) {
  startPresence(agent);
  $('loginForm').hidden = true;
  $('firstPinForm').hidden = true;
  $('appChoice').hidden = false;
  $('welcomeUser').textContent = `Ciao ${formatName(agent.name)}, dove vuoi andare?`;
  document.dispatchEvent(new CustomEvent('navisuite-login-complete', { detail:{ agentId:String(agent.id||'') } }));
  const allowedStartPages=new Set(['index.html','oggi.html','naviturni.html','cambi_turno.html','navidiaria.html','documenti.html','Orario.html','impostazioni.html','segnalazioni.html','aggiornamenti.html','agenti.html','gestione_navi.html']);
  const savedStartPage=localStorage.getItem('navisuite.startPage.'+String(agent.id||''));
  const preferred=allowedStartPages.has(savedStartPage||'')?savedStartPage:'index.html';
  if(preferred&&preferred!=='index.html'){location.href=preferred;return;}
  const diaria = document.querySelector('.app-card.diaria');
  const oggi = document.querySelector('.app-card.oggi');
  const docs = document.querySelector('.app-card.docs');
  const trova = document.querySelector('.app-card.trova');
  const orario = document.querySelector('.app-card.orario');
  const orariTabella = document.querySelector('.app-card.orari-tabella');
  const settings = document.querySelector('.app-card.settings');
  const updates = document.querySelector('.app-card.updates');
  const agentAdmin = document.querySelector('.app-card.agents');
  const shipManagement = document.querySelector('[data-navi-tab="NaviGestioneNaviTab"]');
  if (diaria) diaria.hidden = !canUseDiaria(agent);
  if (oggi) oggi.hidden = isBaristaAgent(agent) && !isHibaBarista(agent);
  if (docs) docs.hidden = isBaristaAgent(agent);
  if (trova) trova.hidden = isBaristaAgent(agent);
  // Orario visibile solo agli admin (nascosto alle bariste)
  if (orario) orario.hidden = isBaristaAgent(agent);
  if (orariTabella) orariTabella.hidden = isBaristaAgent(agent);
  if (settings) settings.hidden = isBaristaAgent(agent);
  if (updates) updates.hidden = !(isAdminAgent(agent) || isHibaBarista(agent));
  if (agentAdmin) agentAdmin.hidden = !isAdminAgent(agent);
  if (shipManagement) shipManagement.hidden = !isAdminAgent(agent);
}

async function loadAgents() {
  // La directory deve essere aggiornata a ogni apertura: NAVI_UTENTI può cambiare.
  try {
    await NaviSharedData.load(DIRECTORY_URL, { force:true });
  } catch (error) {
    // In assenza di rete resta disponibile l'ultima copia valida.
  }
  agents = NaviSharedData.directory() || [];
  await loadAgentProfiles();
  agents = agents
    .map(applyAgentProfile)
    .sort((a, b) => Number(isBaristaAgent(a)) - Number(isBaristaAgent(b)) || a.name.localeCompare(b.name, 'it'));
  renderSuggestions();
}

document.addEventListener('DOMContentLoaded', async () => {
  let active = JSON.parse(localStorage.getItem(DIARIA_SESSION) || 'null') || JSON.parse(localStorage.getItem(TURNI_SESSION) || 'null');
  if (active) {
    await loadAgentProfiles();active=applyAgentProfile(active);localStorage.setItem(DIARIA_SESSION,JSON.stringify(active));localStorage.setItem(TURNI_SESSION,JSON.stringify(active));
    await NaviFirebaseAuth.migrateStoredPin(active.id).catch(error=>console.warn('Migrazione PIN Firebase non completata',error));
    showChoice(active);
    window.NaviAdminFirebase?.recordUserAccess?.(active).catch(() => {});
    NaviSharedData.load(DIRECTORY_URL, { force:true }).catch(() => {});
    return;
  }
  try {
    await loadAgents();
  } catch (error) {
    $('loginMessage').textContent = 'Impossibile caricare gli agenti. Controlla la connessione e ricarica.';
    $('loginSubmit').disabled = true;
  }
});

$('agentSearch').addEventListener('input', renderSuggestions);

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const agent = selectedAgent();
  const button = $('loginSubmit');
  if (!agent) {
    $('loginMessage').textContent = 'Seleziona un agente dai suggerimenti.';
    return;
  }

  const pin = $('agentPin').value;
  button.disabled = true;
  $('loginMessage').textContent = 'Verifica online…';
  try {
    const digest = await hashPin(pin);
    const auth = await NaviFirebaseAuth.request('auth', { agentId:agent.id, pinHash:digest });
    if (auth.mustChangePin) {
      pendingFirstLogin = { agent, pinHash:digest };
      $('loginForm').hidden = true;
      $('firstPinForm').hidden = false;
      $('firstNewPin').focus();
      return;
    }
    localStorage.setItem(`navidiaria.pin.${agent.id}`, digest);
    localStorage.setItem(DIARIA_SESSION, JSON.stringify(agent));
    localStorage.setItem(TURNI_SESSION, JSON.stringify({ id:agent.id, name:agent.name, residence:agent.residence, qualifica:agent.qualifica, role:agent.role || '' }));
    window.NaviAdminFirebase?.recordUserAccess?.(agent).catch(() => {});
    $('loginMessage').textContent = '';
    showChoice(agent);
    NaviSharedData.load(DIRECTORY_URL, { force:true }).catch(() => {});
  } catch (error) {
    $('loginMessage').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('firstPinForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!pendingFirstLogin) {
    location.reload();
    return;
  }
  const nextPin = $('firstNewPin').value;
  const confirmation = $('firstConfirmPin').value;
  const button = $('firstPinSubmit');
  if (nextPin !== confirmation) {
    $('firstPinMessage').textContent = 'I PIN non coincidono.';
    return;
  }
  button.disabled = true;
  $('firstPinMessage').textContent = 'Salvataggio online…';
  try {
    const newPinHash = await hashPin(nextPin);
    const { agent, pinHash } = pendingFirstLogin;
    await NaviFirebaseAuth.request('change_pin', { agentId:agent.id, pinHash, newPinHash });
    localStorage.setItem(`navidiaria.pin.${agent.id}`, newPinHash);
    localStorage.setItem(DIARIA_SESSION, JSON.stringify(agent));
    localStorage.setItem(TURNI_SESSION, JSON.stringify({ id:agent.id, name:agent.name, residence:agent.residence, qualifica:agent.qualifica, role:agent.role || '' }));
    window.NaviAdminFirebase?.recordUserAccess?.(agent).catch(() => {});
    pendingFirstLogin = null;
    $('firstPinMessage').textContent = '';
    showChoice(agent);
  } catch (error) {
    $('firstPinMessage').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('logoutButton').addEventListener('click', () => {
  localStorage.removeItem(DIARIA_SESSION);
  localStorage.removeItem(TURNI_SESSION);
  location.reload();
});
