(function(){
  // NaviTurni usa una copia locale completa (localStorage + IndexedDB). Se la
  // copia esiste, non deve essere rimpiazzata per alcuni secondi dal solo
  // calendario base Firebase, che può terminare prima delle importazioni/bozze.
  // Manteniamo quindi la copia completa a schermo e avviamo comunque il fetch
  // del calendario base in background: il normale NaviSharedData.load() che
  // segue si aggancia a quel fetch, applica ODS/profili/importazioni e aggiorna
  // la tabella soltanto quando il dataset completo è pronto.
  if(/(?:^|\/)naviturni\.html$/i.test(location.pathname)&&window.NaviSharedData?.loadBase&&!window.NaviSharedData.__turniKeepCompleteCache){
    const originalLoadBase=window.NaviSharedData.loadBase.bind(window.NaviSharedData);
    let firstCall=true;

    const readCompleteCache=async()=>{
      try{
        if(typeof window.readTurniCache==='function'){
          const saved=await window.readTurniCache();
          if(saved)return typeof saved==='string'?JSON.parse(saved):saved;
        }
      }catch(error){console.warn('Cache Turni IndexedDB non leggibile',error)}
      try{
        const saved=localStorage.getItem('turno_finali_data');
        if(saved)return JSON.parse(saved);
      }catch(error){console.warn('Cache Turni locale non leggibile',error)}
      return null;
    };

    window.NaviSharedData.loadBase=async(url,options={})=>{
      if(firstCall){
        firstCall=false;
        const cached=await readCompleteCache();
        if(cached&&typeof cached==='object'){
          originalLoadBase(url,{...options,force:true}).catch(error=>
            console.warn('Aggiornamento calendario base in background non riuscito',error)
          );
          return cached;
        }
      }
      return originalLoadBase(url,options);
    };
    window.NaviSharedData.__turniKeepCompleteCache=true;
  }

  const load=(src)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    document.head.appendChild(script);
  };
  load('assets/js/announcements-core-20260903.js?v=1');
  load('assets/js/turn-pdf-import-repair-v2.js?v=20260903-2');
  load('assets/js/ods-navi-pdf-repair.js?v=20260904-1');
  // NaviSuite produce l'evento di collegamento; il Web Push viene poi consegnato
  // alla subscription dell'amministratore registrata dalla PWA Navibeta.
  load('assets/js/connection-webpush.js?v=20260905-4');
})();
