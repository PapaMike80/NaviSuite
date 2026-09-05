(function(){
  'use strict';
  if(window.__naviConnectionWebPush)return;
  window.__naviConnectionWebPush=true;

  const DATABASE_URL='https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app';
  const AUTH_KEY='navisuite.adminFirebaseAuth.v1';
  const TARGET_ADMIN_IDS=['92','91','AG_PEDRONI_M'];
  const DEFAULT_TARGET_ADMIN_ID='92';

  // Una pausa reale dell'app deve valere come nuovo collegamento anche se il
  // profilo e' gia' autenticato. I cambi pagina interni vengono invece marcati
  // esplicitamente e non generano notifiche.
  const RESUME_MIN_MS=3000;
  const STALE_ACTIVITY_MS=8000;
  const HEARTBEAT_MS=10000;
  const DEDUP_MS=5000;
  const INTERNAL_NAV_TTL_MS=15000;
  const ACTIVITY_PREFIX='navisuite.connectionActivity.';
  const HIDDEN_PREFIX='navisuite.connectionHidden.';
  const INTERNAL_NAV_PREFIX='navisuite.connectionInternalNav.';
  const LOCK_PREFIX='navisuite.connectionPushLock.';

  const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}};
  const safeKey=value=>String(value||'').trim().replace(/[.#$\[\]\/]/g,'_');
  const formatName=value=>String(value||'').trim().split(/\s+/).map(part=>part.length>1?part[0]+part.slice(1).toLocaleLowerCase('it'):part).join(' ');
  const readNumber=key=>{try{return Number(localStorage.getItem(key)||0);}catch(_){return 0;}};
  const writeNumber=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){ }};
  const removeKey=key=>{try{localStorage.removeItem(key);}catch(_){ }};

  function activeAgent(){
    return readJson('navidiaria.activeAgent')||readJson('naviturni_logged_agent');
  }

  function isTargetAdmin(agent){
    const id=String(agent?.id||agent?.agentId||'').toUpperCase();
    const name=String(agent?.name||agent?.agente||agent?.cognome||'');
    return TARGET_ADMIN_IDS.includes(id)||/\bPEDRONI\b/i.test(name);
  }

  function activityKey(agentId){return ACTIVITY_PREFIX+String(agentId||'');}
  function hiddenKey(agentId){return HIDDEN_PREFIX+String(agentId||'');}
  function internalNavKey(agentId){return INTERNAL_NAV_PREFIX+String(agentId||'');}
  function lockKey(agentId){return LOCK_PREFIX+String(agentId||'');}

  function markActivity(agentId,stamp=Date.now()){
    if(agentId)writeNumber(activityKey(agentId),stamp);
  }

  function markHidden(agentId,stamp=Date.now()){
    if(!agentId)return;
    writeNumber(hiddenKey(agentId),stamp);
    markActivity(agentId,stamp);
  }

  function markInternalNavigation(agentId,stamp=Date.now()){
    if(agentId)writeNumber(internalNavKey(agentId),stamp+INTERNAL_NAV_TTL_MS);
  }

  function consumeInternalNavigation(agentId,stamp=Date.now()){
    const key=internalNavKey(agentId);
    const until=readNumber(key);
    removeKey(key);
    return Boolean(until&&stamp<=until);
  }

  function acquireLock(agentId,stamp=Date.now()){
    const key=lockKey(agentId);
    const previous=readNumber(key);
    if(previous&&stamp-previous<DEDUP_MS)return false;
    writeNumber(key,stamp);
    return true;
  }

  async function waitProvider(){
    for(let attempt=0;attempt<50;attempt+=1){
      if(window.NaviAdminFirebase?.recordUserAccess)return window.NaviAdminFirebase;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    return null;
  }

  async function validAuth(agent){
    const provider=await waitProvider();
    if(!provider)return null;
    try{await provider.ready;}catch(_){ }
    try{await provider.recordUserAccess(agent,{page:'Connessione'});}catch(_){ }
    const auth=readJson(AUTH_KEY);
    return auth?.idToken?auth:null;
  }

  async function resolveTargetAdminId(auth){
    if(!auth?.idToken)return DEFAULT_TARGET_ADMIN_ID;
    for(const candidate of TARGET_ADMIN_IDS){
      try{
        const url=`${DATABASE_URL}/private/adminUpdates/pushSubscriptions/${safeKey(candidate)}.json?auth=${encodeURIComponent(auth.idToken)}`;
        const response=await fetch(url,{cache:'no-store'});
        if(!response.ok)continue;
        const devices=await response.json().catch(()=>null);
        const active=Object.values(devices||{}).some(item=>item&&item.enabled!==false&&item.endpoint&&item.keys?.p256dh&&item.keys?.auth);
        if(active)return candidate;
      }catch(_){ }
    }
    return DEFAULT_TARGET_ADMIN_ID;
  }

  async function queueConnection(agent,reason){
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(!agentId||isTargetAdmin(agent))return false;
    const stamp=Date.now();
    if(!acquireLock(agentId,stamp))return false;

    const auth=await validAuth(agent);
    if(!auth?.idToken){
      removeKey(lockKey(agentId));
      return false;
    }

    const targetAdminId=await resolveTargetAdminId(auth);
    const name=formatName(agent?.name||agent?.agente||agent?.cognome||agentId);
    const residence=String(agent?.residence||agent?.residenza||'').trim();
    const id=`CONNECT_${stamp}_${Math.random().toString(36).slice(2,8)}`;
    const item={
      id,
      status:'pending',
      kind:'agent-connection',
      requestedByAgentId:agentId,
      requestedByName:name,
      ownerUid:auth.uid||'',
      targetAgentId:targetAdminId,
      title:'NaviSuite · agente collegato',
      body:`${name} si è collegato a NaviSuite${residence?` · ${residence}`:''}.`,
      url:'agenti.html',
      createdAt:new Date(stamp).toISOString(),
      source:'navisuite-connection',
      connectionReason:String(reason||'resume'),
      loginAgentId:agentId
    };

    const url=`${DATABASE_URL}/private/adminUpdates/pushQueue/${safeKey(id)}.json?auth=${encodeURIComponent(auth.idToken)}`;
    const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    if(!response.ok){
      removeKey(lockKey(agentId));
      const error=await response.json().catch(()=>null);
      throw new Error(error?.error||`Firebase HTTP ${response.status}`);
    }
    return true;
  }

  async function notify(agent,reason){
    if(!agent?.id||isTargetAdmin(agent))return;
    try{await queueConnection(agent,reason);}
    catch(error){console.warn('Notifica collegamento NaviSuite non accodata',error);}
  }

  function evaluateBoot(agent){
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(!agentId)return;
    const now=Date.now();
    const lastActivity=readNumber(activityKey(agentId));
    const hiddenAt=readNumber(hiddenKey(agentId));
    const internalNavigation=consumeInternalNavigation(agentId,now);
    removeKey(hiddenKey(agentId));
    markActivity(agentId,now);

    if(internalNavigation||isTargetAdmin(agent))return;
    const hiddenLongEnough=hiddenAt&&now-hiddenAt>=RESUME_MIN_MS;
    const staleLongEnough=lastActivity&&now-lastActivity>=STALE_ACTIVITY_MS;
    if(!lastActivity||hiddenLongEnough||staleLongEnough)notify(agent,'session-resume');
  }

  function evaluateForeground(agent){
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(!agentId)return;
    const now=Date.now();
    const hiddenAt=readNumber(hiddenKey(agentId));
    const lastActivity=readNumber(activityKey(agentId));
    removeKey(hiddenKey(agentId));
    markActivity(agentId,now);
    if(isTargetAdmin(agent))return;

    const hiddenFor=hiddenAt?now-hiddenAt:0;
    const inactiveFor=lastActivity?now-lastActivity:0;
    if(hiddenFor>=RESUME_MIN_MS||(!hiddenAt&&inactiveFor>=STALE_ACTIVITY_MS))notify(agent,'foreground-resume');
  }

  // Segna i normali link interni: anche se una pagina fosse lenta a caricarsi,
  // il passaggio Turni -> Diaria -> Oggi non deve sembrare una nuova connessione.
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');
    const agent=activeAgent();
    if(!link||!agent?.id)return;
    try{
      const target=new URL(link.href,location.href);
      if(target.origin===location.origin)markInternalNavigation(String(agent.id));
    }catch(_){ }
  },true);

  const bootAgent=activeAgent();
  const hadAgentAtBoot=Boolean(bootAgent?.id);
  if(bootAgent?.id)evaluateBoot(bootAgent);

  document.addEventListener('navisuite-login-complete',()=>{
    const agent=activeAgent();
    if(!agent?.id)return;
    const agentId=String(agent.id);
    removeKey(hiddenKey(agentId));
    markActivity(agentId);
    // Se la pagina era partita senza sessione, il PIN e' appena stato verificato.
    if(!hadAgentAtBoot)notify(agent,'pin-login');
  });

  document.addEventListener('visibilitychange',()=>{
    const agent=activeAgent();
    if(!agent?.id)return;
    const agentId=String(agent.id);
    if(document.visibilityState==='hidden')markHidden(agentId);
    else if(document.visibilityState==='visible')evaluateForeground(agent);
  });

  window.addEventListener('pagehide',()=>{
    const agent=activeAgent();
    if(agent?.id)markHidden(String(agent.id));
  });

  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    const agent=activeAgent();
    if(agent?.id)evaluateForeground(agent);
  });

  setInterval(()=>{
    if(document.visibilityState==='hidden')return;
    const agent=activeAgent();
    if(agent?.id)markActivity(String(agent.id));
  },HEARTBEAT_MS);
})();
