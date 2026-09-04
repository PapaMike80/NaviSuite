(function(){
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
