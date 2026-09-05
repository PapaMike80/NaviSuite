(function(){
  'use strict';
  if(window.__naviLoginNotificationsRuntime)return;
  window.__naviLoginNotificationsRuntime=true;

  const ENABLE_KEY='navisuite.loginNotifications.enabled.v1';
  const STATE_KEY='navisuite.loginNotifications.runtimeState.v1';
  const POLL_MS=12000;
  const ONLINE_MS=120000;
  const STATE_MAX_AGE=150000;
  let timer=null;
  let previousOnline=null;
  let sessionAgent=null;

  function readSession(){
    for(const key of ['navidiaria.activeAgent','naviturni_logged_agent']){
      try{
        const value=JSON.parse(localStorage.getItem(key)||'null');
        if(value?.id)return value;
      }catch(_){ }
    }
    return null;
  }

  function isAdmin(agent){
    return ['91','92'].includes(String(agent?.id||''))||String(agent?.role||'').toLowerCase()==='admin';
  }

  function enabled(){
    return localStorage.getItem(ENABLE_KEY)==='1'&&'Notification' in window&&Notification.permission==='granted';
  }

  function formatName(value){
    return String(value||'').trim().split(/\s+/).map(part=>part.length>1?part[0]+part.slice(1).toLocaleLowerCase('it'):part).join(' ');
  }

  function timeOf(value){
    const date=new Date(value||Date.now());
    return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  }

  function restoreState(){
    try{
      const state=JSON.parse(sessionStorage.getItem(STATE_KEY)||localStorage.getItem(STATE_KEY)||'null');
      if(!state||Date.now()-Number(state.at||0)>STATE_MAX_AGE||!Array.isArray(state.online))return null;
      return new Set(state.online.map(String));
    }catch(_){return null;}
  }

  function saveState(set){
    const value=JSON.stringify({at:Date.now(),online:[...set]});
    try{sessionStorage.setItem(STATE_KEY,value);}catch(_){ }
    try{localStorage.setItem(STATE_KEY,value);}catch(_){ }
  }

  async function registration(){
    if(!('serviceWorker' in navigator))return null;
    try{
      if(!window.__naviSwRegistrationPromise){
        window.__naviSwRegistrationPromise=navigator.serviceWorker.register('sw.js?login-notifications=2').then(registration=>{
          registration?.update?.().catch(()=>{});
          return registration;
        }).catch(()=>null);
      }
      return await window.__naviSwRegistrationPromise;
    }catch(_){return null;}
  }

  async function notify(item){
    if(!enabled())return;
    const name=formatName(item?.name||item?.id||'Agente');
    const when=timeOf(item?.lastSeen)||timeOf(Date.now());
    const title='NaviSuite · agente online';
    const body=name+' si è collegato alle '+when;
    try{
      const reg=await registration();
      if(reg?.showNotification){
        await reg.showNotification(title,{
          body,
          icon:'assets/images/icona_192.png',
          badge:'assets/images/icona_192.png',
          tag:'navisuite-login-'+String(item?.id||'')+'-'+String(item?.lastSeen||Date.now()),
          renotify:true,
          data:{url:'agenti.html'}
        });
        return;
      }
      const notice=new Notification(title,{body,icon:'assets/images/icona_192.png'});
      notice.onclick=()=>{window.focus();location.href='agenti.html';};
    }catch(error){console.warn('Notifica accesso NaviSuite non mostrata',error);}
  }

  async function poll(){
    if(!enabled()||!isAdmin(sessionAgent))return;
    const provider=window.NaviAdminFirebase;
    if(!provider?.listUserPresence)return;
    try{
      await provider.ready;
      const items=await provider.listUserPresence(ONLINE_MS);
      const current=new Set(items.map(item=>String(item?.id||'')).filter(Boolean));
      if(previousOnline===null){
        previousOnline=restoreState();
        if(previousOnline===null){
          previousOnline=current;
          saveState(current);
          return;
        }
      }
      const ownId=String(sessionAgent?.id||'');
      const newcomers=items.filter(item=>{
        const id=String(item?.id||'');
        return id&&id!==ownId&&!previousOnline.has(id);
      });
      previousOnline=current;
      saveState(current);
      for(const item of newcomers)await notify(item);
    }catch(error){
      console.warn('Monitor accessi NaviSuite non disponibile',error);
    }
  }

  function install(attempt=0){
    sessionAgent=readSession();
    if(!sessionAgent?.id||!isAdmin(sessionAgent)||!enabled())return;
    if(!window.NaviAdminFirebase?.listUserPresence){
      if(attempt<40)setTimeout(()=>install(attempt+1),250);
      return;
    }
    previousOnline=restoreState();
    poll();
    if(timer)clearInterval(timer);
    timer=setInterval(poll,POLL_MS);
    registration().catch(()=>{});
  }

  window.addEventListener('storage',event=>{
    if(event.key!==ENABLE_KEY)return;
    if(timer){clearInterval(timer);timer=null;}
    previousOnline=null;
    install();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&enabled())poll();
  });
  document.addEventListener('navisuite-login-notifications-enabled',()=>{
    if(timer){clearInterval(timer);timer=null;}
    previousOnline=null;
    install();
  });

  install();
})();
