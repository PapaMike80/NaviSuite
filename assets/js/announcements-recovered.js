(function(){
  // NaviTurni usa già una copia locale (localStorage + IndexedDB) e mostra
  // immediatamente l'ultimo calendario disponibile. Non trasformare loadBase
  // in load(): in assenza di cache il calendario base deve comparire appena
  // arriva, mentre ODS, profili e aggiornamenti amministrativi continuano a
  // sincronizzarsi in background dal normale flusso di NaviTurni.

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
