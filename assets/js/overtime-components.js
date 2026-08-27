(function(){
  const minutes=value=>Math.max(0,Math.round(Number(value)||0));
  const structured=entry=>!!entry?.overtimeComponents&&typeof entry.overtimeComponents==='object'&&!Array.isArray(entry.overtimeComponents);
  const components=entry=>structured(entry)?entry.overtimeComponents:null;
  const sum=entry=>structured(entry)?Object.values(components(entry)).reduce((total,value)=>total+minutes(value),0):minutes(entry?.delay);
  const ordinary=entry=>structured(entry)?minutes(components(entry).ordinario):minutes(entry?.delay);
  const changes=entry=>structured(entry)?minutes(components(entry).cambi):minutes(entry?.changeMinutes);
  function activate(entry){
    if(structured(entry))return entry.overtimeComponents;
    // I record precedenti restano immutati finché non si interviene su
    // Straordinario o Cambi. Il vecchio totale viene quindi trattato come
    // ordinario, evitando di sommare di nuovo un Cambio storico già incluso.
    const legacyChange=minutes(entry?.changeMinutes);
    entry.overtimeComponents={ordinario:minutes(entry?.delay),cambi:0};
    if(Number.isFinite(Number(entry?.workedMinutes)))entry.workedMinutes=Math.max(0,minutes(entry.workedMinutes)-legacyChange);
    entry.changeMinutes=0;
    entry.delay=minutes(entry.overtimeComponents.ordinario);
    return entry.overtimeComponents;
  }
  function sync(entry){
    if(structured(entry))entry.delay=sum(entry); // compatibilità con lettori meno recenti: non è la fonte del totale.
    return entry;
  }
  function setOrdinary(entry,value){activate(entry).ordinario=minutes(value);return sync(entry)}
  function setChanges(entry,value){activate(entry).cambi=minutes(value);entry.changeMinutes=minutes(value);return sync(entry)}
  function setWorked(entry,value,serviceMinutes){
    activate(entry);
    const worked=minutes(value),service=minutes(serviceMinutes);
    entry.workedMinutes=worked;
    entry.overtimeComponents.ordinario=Math.max(0,worked-service);
    return sync(entry);
  }
  function create(){return {ordinario:0,cambi:0}}
  window.NaviOvertimeComponents={structured,components,total:sum,ordinary,changes,activate,sync,setOrdinary,setChanges,setWorked,create,minutes};
})();
