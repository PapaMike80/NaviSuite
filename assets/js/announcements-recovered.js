(function(){
  // NaviTurni non deve ridisegnarsi prima con il solo calendario base e poi
  // con gli aggiornamenti amministrativi. La copia locale completa resta
  // visibile subito; la prima sincronizzazione di rete restituisce già il
  // dataset completo (base + importazioni + ODS + profili).
  if(/(?:^|\/)naviturni\.html$/i.test(location.pathname)&&window.NaviSharedData?.loadBase&&window.NaviSharedData?.load&&!window.NaviSharedData.__naviturniCompleteFirst){
    const loadComplete=window.NaviSharedData.load.bind(window.NaviSharedData);
    window.NaviSharedData.loadBase=(url,options={})=>loadComplete(url,options);
    window.NaviSharedData.__naviturniCompleteFirst=true;
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
})();
