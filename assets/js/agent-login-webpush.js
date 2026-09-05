(function(){
  'use strict';

  const DATABASE_URL='https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app';
  const AUTH_KEY='navisuite.adminFirebaseAuth.v1';
  const TARGET_ADMIN_ID='91';
  const COOLDOWN_MS=3*60*1000;

  const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}};
  const safeKey=value=>String(value||'').trim().replace(/[.#$\[\]\/]/g,'_');
  const formatName=value=>String(value||'').trim().split(/\s+/).map(part=>part.length>1?part[0]+part.slice(1).toLocaleLowerCase('it'):part).join(' ');

  function activeAgent(){
    return readJson('navidiaria.activeAgent')||readJson('naviturni_logged_agent');
  }

  function isMarco(agent){
    const id=String(agent?.id||agent?.agentId||'').toUpperCase();
    const name=String(agent?.name||agent?.agente||agent?.cognome||'');
    return ['91','AG_PEDRONI_M'].includes(id)||/\bPEDRONI\b/i.test(name);
  }

  async function validAuth(){
    try{await window.NaviAdminFirebase?.ready;}catch(_){ }
    let auth=readJson(AUTH_KEY);
    if(auth?.idToken&&Number(auth.expiresAt||0)>Date.now()+30000)return auth;
    const agent=activeAgent();
    if(agent&&window.NaviAdminFirebase?.recordUserAccess){
      try{await window.NaviAdminFirebase.recordUserAccess(agent);}catch(_){ }
      auth=readJson(AUTH_KEY);
    }
    return auth?.idToken?auth:null;
  }

  async function queueLoginAlert(agent){
    const agentId=String(agent?.id||agent?.agentId||'').trim();
    if(!agentId||isMarco(agent))return false;

    const sessionKey='navisuite.agentLoginPush.session.'+agentId;
    try{if(sessionStorage.getItem(sessionKey)==='1')return false;}catch(_){ }

    const cooldownKey='navisuite.agentLoginPush.last.'+agentId;
    let last=0;
    try{last=Number(localStorage.getItem(cooldownKey)||0);}catch(_){ }
    if(last&&Date.now()-last<COOLDOWN_MS){
      try{sessionStorage.setItem(sessionKey,'1');}catch(_){ }
      return false;
    }

    const auth=await validAuth();
    if(!auth?.idToken)return false;

    const name=formatName(agent?.name||agent?.agente||agent?.cognome||agentId);
    const residence=String(agent?.residence||agent?.residenza||'').trim();
    const id=`LOGIN_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now=new Date().toISOString();
    const item={
      id,
      status:'pending',
      kind:'agent-login',
      requestedByAgentId:agentId,
      requestedByName:name,
      ownerUid:auth.uid||'',
      targetAgentId:TARGET_ADMIN_ID,
      title:'NaviSuite · agente collegato',
      body:`${name} si è collegato a NaviSuite${residence?` · ${residence}`:''}.`,
      url:'agenti.html',
      createdAt:now,
      source:'navisuite-login',
      loginAgentId:agentId
    };

    const url=`${DATABASE_URL}/private/adminUpdates/pushQueue/${safeKey(id)}.json?auth=${encodeURIComponent(auth.idToken)}`;
    const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    if(!response.ok){
      const error=await response.json().catch(()=>null);
      throw new Error(error?.error||`Firebase HTTP ${response.status}`);
    }

    try{sessionStorage.setItem(sessionKey,'1');}catch(_){ }
    try{localStorage.setItem(cooldownKey,String(Date.now()));}catch(_){ }
    return true;
  }

  async function run(){
    const agent=activeAgent();
    if(!agent?.id)return;
    try{await queueLoginAlert(agent);}
    catch(error){console.warn('Notifica Web Push accesso non accodata',error);}
  }

  // Il loader è presente su tutte le pagine: così funziona anche quando una
  // preferenza di avvio porta l'agente direttamente a Oggi/Turni/Diaria.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,700),{once:true});
  else setTimeout(run,700);
  document.addEventListener('navisuite-login-complete',()=>setTimeout(run,250));
})();
