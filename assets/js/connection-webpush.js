(function(){
  'use strict';
  if(window.__naviConnectionWebPush)return;
  window.__naviConnectionWebPush=true;

  const DATABASE_URL='https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app';
  const AUTH_KEY='navisuite.adminFirebaseAuth.v1';
  const TARGET_ADMIN_ID='91';
  const RECONNECT_MS=90*1000;
  const HEARTBEAT_MS=25*1000;
  const HEARTBEAT_PREFIX='navisuite.connectionHeartbeat.';
  const LOCK_PREFIX='navisuite.connectionPushLock.';

  const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}};
  const safeKey=value=>String(value||'').trim().replace(/[.#$\[\]\/]/g,'_');
  const formatName=value=>String(value||'').trim().split(/\s+/).map(part=>part.length>1?part[0]+part.slice(1).toLocaleLowerCase('it'):part).join(' ');

  function activeAgent(){
    return readJson('navidiaria.activeAgent')||readJson('naviturni_logged_agent');
  }

  function isTargetAdmin(agent){
    const id=String(agent?.id||agent?.agentId||'').toUpperCase();
    const name=String(agent?.name||agent?.agente||agent?.cognome||'');
    return ['91','AG_PEDRONI_M'].includes(id)||/\bPEDRONI\b/i.test(name);
  }

  function heartbeatKey(agentId){return HEARTBEAT_PREFIX+String(agentId||'');}
  function lockKey(agentId){return LOCK_PREFIX+String(agentId||'');}

  function lastHeartbeat(agentId){
    try{return Number(localStorage.getItem(heartbeatKey(agentId))||0);}catch(_){return 0;}
  }

  function touchHeartbeat(agentId,stamp=Date.now()){
    try{localStorage.setItem(heartbeatKey(agentId),String(stamp));}catch(_){ }
  }

  function acquireLock(agentId,stamp=Date.now()){
    try{
      const key=lockKey(agentId);
      const previous=Number(localStorage.getItem(key)||0);
      if(previous&&stamp-previous<30000)return false;
      localStorage.setItem(key,String(stamp));
      return true;
    }catch(_){return true;}
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
    if(auth?.idToken)return auth;
    return null;
  }

  async function queueConnection(agent,reason){
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(!agentId||isTargetAdmin(agent))return false;
    const stamp=Date.now();
    if(!acquireLock(agentId,stamp))return false;

    const auth=await validAuth(agent);
    if(!auth?.idToken){
      try{localStorage.removeItem(lockKey(agentId));}catch(_){ }
      return false;
    }

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
      targetAgentId:TARGET_ADMIN_ID,
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
      try{localStorage.removeItem(lockKey(agentId));}catch(_){ }
      const error=await response.json().catch(()=>null);
      throw new Error(error?.error||`Firebase HTTP ${response.status}`);
    }
    return true;
  }

  async function evaluate(agent,reason,{force=false}={}){
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(!agentId)return;
    const now=Date.now();
    const previous=lastHeartbeat(agentId);
    const isConnection=force||!previous||(now-previous)>=RECONNECT_MS;
    // Scriviamo subito prima delle operazioni di rete: il cambio pagina successivo
    // vede una sessione ancora attiva e non genera una seconda notifica.
    touchHeartbeat(agentId,now);
    if(!isConnection||isTargetAdmin(agent))return;
    try{await queueConnection(agent,reason);}catch(error){console.warn('Notifica collegamento NaviSuite non accodata',error);}
  }

  const bootAgent=activeAgent();
  const hadAgentAtBoot=Boolean(bootAgent?.id);
  if(bootAgent?.id)evaluate(bootAgent,'session-resume').catch(()=>{});

  document.addEventListener('navisuite-login-complete',()=>{
    const agent=activeAgent();
    if(!agent?.id)return;
    // Se all'apertura della pagina non c'era alcuna sessione, questo evento segue
    // un vero accesso con PIN (o il completamento del primo PIN): notificalo sempre.
    evaluate(agent,hadAgentAtBoot?'session-resume':'pin-login',{force:!hadAgentAtBoot}).catch(()=>{});
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    const agent=activeAgent();
    if(agent?.id)evaluate(agent,'foreground-resume').catch(()=>{});
  });

  setInterval(()=>{
    if(document.visibilityState==='hidden')return;
    const agent=activeAgent();
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(agentId)touchHeartbeat(agentId);
  },HEARTBEAT_MS);
})();
