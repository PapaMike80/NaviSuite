(function(){
  'use strict';

  const API_KEY='AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE';
  const DATABASE_URL='https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app';
  const AUTH_KEY='navisuite.adminFirebaseAuth.v1';
  // Condiviso con Navibeta: attivando le notifiche su NaviSuite questo dispositivo
  // migra naturalmente la propria subscription dalla beta alla produzione.
  const DEVICE_KEY='navisuite.push.deviceId.v1';
  const PREFS_PREFIX='navisuite.push.preferences.';
  const VAPID_PUBLIC_KEY='BBuuE6ITF9JZ2ADHsgAbt4Vfc74bNsST6dbixZEtcWa8QppgWhrmtQdH46GkMtG12FFuC6bxl5MpxPCrRYKDgL0';
  const VAPID_VERSION='2';
  const VAPID_VERSION_KEY='navisuite.push.vapidVersion.v1';

  let volatileAuth=null;
  let pendingAuth=null;

  const safeKey=value=>String(value||'').trim().replace(/[.#$\[\]\/]/g,'_');
  const now=()=>new Date().toISOString();
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch(_){return fallback;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}};
  const currentVapidVersion=()=>{try{return String(localStorage.getItem(VAPID_VERSION_KEY)||'');}catch(_){return '';}};
  const markCurrentVapid=()=>{try{localStorage.setItem(VAPID_VERSION_KEY,VAPID_VERSION);}catch(_){}};
  const clearVapidVersion=()=>{try{localStorage.removeItem(VAPID_VERSION_KEY);}catch(_){}};

  function deviceId(){
    let value='';
    try{value=String(localStorage.getItem(DEVICE_KEY)||'').trim();}catch(_){ }
    if(value)return value;
    const random=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
    value=`web-${random}`;
    try{localStorage.setItem(DEVICE_KEY,value);}catch(_){ }
    return value;
  }

  function defaultPreferences(){
    return {tomorrowSummary:true,shiftChanges:true,ods:true,summaryDelivery:{mode:'previous-day',time:'22:05',leadMinutes:60}};
  }
  function normalizePreferences(value){
    const defaults=defaultPreferences();
    const source=value&&typeof value==='object'?value:{};
    const raw=source.summaryDelivery&&typeof source.summaryDelivery==='object'?source.summaryDelivery:{};
    const mode=['previous-day','same-day','before-service'].includes(String(raw.mode))?String(raw.mode):defaults.summaryDelivery.mode;
    const time=/^\d{2}:\d{2}$/.test(String(raw.time||''))?String(raw.time):defaults.summaryDelivery.time;
    const leadMinutes=[30,60,120].includes(Number(raw.leadMinutes))?Number(raw.leadMinutes):60;
    return {...defaults,...source,summaryDelivery:{mode,time,leadMinutes}};
  }
  function preferences(agentId){return normalizePreferences(readJson(PREFS_PREFIX+String(agentId||''),{}));}
  function savePreferencesLocal(agentId,value){const next=normalizePreferences(value);writeJson(PREFS_PREFIX+String(agentId||''),next);return next;}

  function readAuth(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')||volatileAuth;}catch(_){return volatileAuth;}}
  function saveAuth(value){volatileAuth=value;try{localStorage.setItem(AUTH_KEY,JSON.stringify(value));}catch(_){ }return value;}
  async function authRequest(url,options){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timeout);}
  }
  async function signUp(){
    const response=await authRequest(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||'Autenticazione Firebase non riuscita');
    return saveAuth({uid:data.localId,idToken:data.idToken,refreshToken:data.refreshToken,expiresAt:Date.now()+Number(data.expiresIn||3600)*1000});
  }
  async function refreshAuth(auth){
    const response=await authRequest(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:auth.refreshToken})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){try{localStorage.removeItem(AUTH_KEY);}catch(_){ }return signUp();}
    return saveAuth({uid:data.user_id,idToken:data.id_token,refreshToken:data.refresh_token||auth.refreshToken,expiresAt:Date.now()+Number(data.expires_in||3600)*1000});
  }
  async function ensureAuth(){
    try{await window.NaviAdminFirebase?.ready;}catch(_){ }
    const auth=readAuth();
    if(auth?.idToken&&auth?.uid&&Number(auth.expiresAt||0)>Date.now()+60000)return auth;
    if(pendingAuth)return pendingAuth;
    pendingAuth=(async()=>{const latest=readAuth();if(latest?.idToken&&latest?.uid&&Number(latest.expiresAt||0)>Date.now()+60000)return latest;return latest?.refreshToken?refreshAuth(latest):signUp();})();
    try{return await pendingAuth;}finally{pendingAuth=null;}
  }
  async function databaseRequest(path,options={}){
    const auth=await ensureAuth();
    const url=`${DATABASE_URL}/${String(path).replace(/^\/+/, '')}.json?auth=${encodeURIComponent(auth.idToken)}`;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(url,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',...(options.headers||{})}});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||`Firebase HTTP ${response.status}`);
      return {data,auth};
    }finally{clearTimeout(timeout);}
  }

  function urlBase64ToUint8Array(value){
    const pad='='.repeat((4-value.length%4)%4),base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);
    return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
  }
  const isIos=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

  async function registration(){
    if(!('serviceWorker' in navigator))throw new Error('Service Worker non disponibile');
    let reg=null;
    try{reg=await window.__naviSwRegistrationPromise;}catch(_){ }
    if(!reg){try{reg=await navigator.serviceWorker.getRegistration('./');}catch(_){ }}
    if(!reg)reg=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
    window.__naviSwRegistrationPromise=Promise.resolve(reg);
    return navigator.serviceWorker.ready;
  }
  async function localSubscription(){if(!('PushManager' in window))return null;try{return await (await registration()).pushManager.getSubscription();}catch(_){return null;}}
  function deviceLabel(){if(/iPhone/i.test(navigator.userAgent))return 'iPhone';if(/iPad/i.test(navigator.userAgent))return 'iPad';if(/Android/i.test(navigator.userAgent))return 'Android';return 'Browser';}

  async function saveSubscription(profile,subscription,prefs){
    const agentId=String(profile?.id||profile?.agentId||'').trim();if(!agentId)throw new Error('Profilo agente non riconosciuto');
    const id=deviceId(),path=`private/adminUpdates/pushSubscriptions/${safeKey(agentId)}/${safeKey(id)}`;
    let previous=null;try{previous=(await databaseRequest(path)).data;}catch(_){ }
    const json=subscription.toJSON();const auth=await ensureAuth();
    const item={agentId,agentName:String(profile?.name||profile?.agente||profile?.cognome||agentId),deviceId:id,deviceLabel:deviceLabel(),endpoint:String(json.endpoint||''),keys:{p256dh:String(json.keys?.p256dh||''),auth:String(json.keys?.auth||'')},enabled:true,vapidVersion:2,preferences:normalizePreferences(prefs),createdAt:String(previous?.createdAt||now()),updatedAt:now(),ownerUid:auth.uid};
    await databaseRequest(path,{method:'PUT',body:JSON.stringify(item)});return item;
  }
  async function subscribe(profile,prefs){
    if(!('Notification' in window)||!('PushManager' in window))throw new Error('Web Push non disponibile su questo dispositivo');
    if(isIos()&&!isStandalone())throw new Error('Su iPhone apri NaviSuite dalla schermata Home per attivare le notifiche');
    const reg=await registration();let permission=Notification.permission;
    if(permission!=='granted')permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Permesso notifiche non concesso');
    let sub=await reg.pushManager.getSubscription();
    if(sub&&currentVapidVersion()!==VAPID_VERSION){try{await sub.unsubscribe();}catch(_){ }sub=null;}
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
    const agentId=String(profile?.id||profile?.agentId||'').trim(),savedPrefs=savePreferencesLocal(agentId,prefs||preferences(agentId));
    const saved=await saveSubscription(profile,sub,savedPrefs);markCurrentVapid();return saved;
  }
  async function unsubscribe(profile){
    const agentId=String(profile?.id||profile?.agentId||'').trim(),id=deviceId(),sub=await localSubscription();
    if(sub){try{await sub.unsubscribe();}catch(_){ }}clearVapidVersion();
    if(agentId){try{await databaseRequest(`private/adminUpdates/pushSubscriptions/${safeKey(agentId)}/${safeKey(id)}`,{method:'DELETE'});}catch(_){ }}return true;
  }
  async function updatePreferences(profile,prefs){
    const agentId=String(profile?.id||profile?.agentId||'').trim(),next=savePreferencesLocal(agentId,prefs),sub=await localSubscription();
    if(sub&&Notification.permission==='granted'&&currentVapidVersion()===VAPID_VERSION)await saveSubscription(profile,sub,next);return next;
  }
  async function getStatus(profile){
    const agentId=String(profile?.id||profile?.agentId||'').trim(),sub=await localSubscription(),permission='Notification' in window?Notification.permission:'unsupported';
    const requiresMigration=Boolean(sub)&&currentVapidVersion()!==VAPID_VERSION,enabled=Boolean(sub)&&permission==='granted'&&!requiresMigration;
    return {supported:'Notification' in window&&'PushManager' in window,permission,enabled,requiresMigration,deviceId:deviceId(),preferences:preferences(agentId)};
  }
  async function listSubscriptions(agentId=''){
    const target=String(agentId||'').trim();
    if(target){const result=await databaseRequest(`private/adminUpdates/pushSubscriptions/${safeKey(target)}`);return Object.values(result.data||{}).filter(item=>item&&item.enabled!==false);}
    const result=await databaseRequest('private/adminUpdates/pushSubscriptions'),out=[];Object.values(result.data||{}).forEach(devices=>Object.values(devices||{}).forEach(item=>{if(item&&item.enabled!==false)out.push(item);}));return out;
  }
  async function queuePush(payload={}){
    const requestedByAgentId=String(payload.requestedByAgentId||'').trim(),targetAgentId=String(payload.targetAgentId||'').trim(),title=String(payload.title||'NaviSuite').trim().slice(0,120),body=String(payload.body||'').trim().slice(0,500);
    if(!requestedByAgentId)throw new Error('Utente non riconosciuto');if(!targetAgentId)throw new Error('Scegli un destinatario');if(!body)throw new Error('Inserisci il testo della notifica');
    const auth=await ensureAuth(),id=`PUSH_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const item={id,status:'pending',kind:String(payload.kind||'custom'),requestedByAgentId,requestedByName:String(payload.requestedByName||''),ownerUid:auth.uid,targetAgentId,targetDeviceId:String(payload.targetDeviceId||''),title,body,url:String(payload.url||'naviturni.html').trim().slice(0,500),meta:payload.meta&&typeof payload.meta==='object'?payload.meta:{},createdAt:now()};
    await databaseRequest(`private/adminUpdates/pushQueue/${safeKey(id)}`,{method:'PUT',body:JSON.stringify(item)});return item;
  }
  async function listQueue(limit=20){const result=await databaseRequest('private/adminUpdates/pushQueue');return Object.values(result.data||{}).filter(Boolean).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,Math.max(1,Number(limit||20)));}

  window.NaviPush={VAPID_PUBLIC_KEY,VAPID_VERSION,subscribe,unsubscribe,updatePreferences,getStatus,listSubscriptions,queuePush,listQueue,localSubscription,preferences,defaultPreferences,normalizePreferences,isIos,isStandalone,deviceId,provider:'Web Push v3 + Firebase registry'};
})();
