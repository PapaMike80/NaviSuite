(function(){
  // La strategia cache-first di NaviTurni ora passa da NaviSharedData.loadCacheFirst
  // (vedi shared-data.js e naviturni.html): non serve più intercettare loadBase qui.

  const load=(src)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    document.head.appendChild(script);
  };
  load('assets/js/announcements-core-20260903.js?v=1');
  load('assets/js/turn-pdf-import-repair-v2.js?v=20260903-2');
  load('assets/js/ods-navi-pdf-repair.js?v=20260904-1');

  // Notifica l'amministratore quando un agente torna attivo su NaviSuite.
  load('assets/js/connection-webpush.js?v=20260909-2');

  // Centro Web Push di produzione: attivazione dispositivo, orari automatici,
  // invio giornata admin. I messaggi tra agenti sono in Ponte Radio.
  if(/(?:^|\/)impostazioni\.html$/i.test(location.pathname)){
    // Impostazioni non caricava shared-data.js: senza questo il riepilogo manuale
    // non poteva leggere il turno e mostrava "Dati turni non disponibili".
    load('assets/js/shared-data.js?v=119');
    load('assets/js/push-notifications-v3.js?v=20260906-1');
    load('assets/js/push-center.js?v=20260909-2');
  }
})();
