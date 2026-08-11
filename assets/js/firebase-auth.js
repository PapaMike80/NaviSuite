(function(){
  const provider=async()=>{await window.NaviAdminFirebase?.ready;if(!window.NaviAdminFirebase)throw new Error('Firebase non disponibile');return window.NaviAdminFirebase};
  const directory=()=>window.NaviSharedData?.directory?.()||[];
  const agentFor=id=>directory().find(agent=>String(agent.id)===String(id));
  const localPinFor=id=>String(localStorage.getItem(`navidiaria.pin.${id}`)||'').toLowerCase();
  const validHash=value=>/^[a-f0-9]{64}$/.test(String(value||''));

  async function migrateStoredPin(agentId){
    const id=String(agentId||'').trim(),pinHash=localPinFor(id);
    if(!id||!validHash(pinHash))return false;
    const api=await provider(),saved=await api.getUserAuth(id);
    if(saved?.pinHash&&!saved.mustChangePin)return saved.pinHash===pinHash;
    await api.saveUserAuth(id,pinHash,{mustChangePin:false});
    return true;
  }

  async function authenticate(api,payload){
    const id=String(payload.agentId||'').trim();
    const pinHash=String(payload.pinHash||'').toLowerCase();
    const agent=agentFor(id);
    if(!agent)throw new Error('Utente non presente nell’anagrafica Firebase.');
    if(!validHash(pinHash))throw new Error('PIN non valido.');
    const saved=await api.getUserAuth(id);
    if(!saved)throw new Error('Primo accesso: chiedi all’amministratore il tuo PIN iniziale.');
    if(saved.pinHash!==pinHash)throw new Error('PIN non corretto.');
    return {ok:true,mustChangePin:Boolean(saved.mustChangePin),agent};
  }

  async function request(action,payload={}){
    const api=await provider();
    if(action==='auth')return authenticate(api,payload);
    if(action==='change_pin'){await authenticate(api,payload);await api.saveUserAuth(payload.agentId,payload.newPinHash,{mustChangePin:false});return {ok:true}}
    if(action==='reset_own_pin'){await authenticate(api,payload);await api.resetUserAuth(payload.agentId);return {ok:true}}
    if(action==='reset_pin'){await api.resetUserAuth(payload.targetAgentId);return {ok:true}}
    if(action==='delete_user'){await Promise.all([api.resetUserAuth(payload.targetAgentId),api.deleteRegisteredUser(payload.targetAgentId)]);return {ok:true}}
    if(action==='list_users')return {ok:true,users:await api.listRegisteredUsers()};
    if(action==='update_user_role')return {ok:true,...await api.saveAgentProfile(payload.targetAgentId,{role:payload.role})};
    if(action==='directory')return {ok:true,users:directory()};
    if(action==='variation_status')return {ok:true,variationStatus:null};
    if(action==='list_week_status')return {ok:true,weeks:await api.getWeekStatuses()};
    if(action==='save_week_status')return {ok:true,weeks:await api.saveWeekStatuses(payload.statuses)};
    throw new Error('Funzione non disponibile nella versione solo Firebase.');
  }

  window.NaviFirebaseAuth={request,migrateStoredPin,directory:async()=>directory(),provider:'Firebase'};

  if('serviceWorker' in navigator&&!window.__naviSwRegistrationPromise){
    window.__naviSwRegistrationPromise=navigator.serviceWorker.register('sw.js').then(registration=>{
      registration?.update?.().catch(()=>{});
      return registration;
    }).catch(()=>null);
  }
})();
