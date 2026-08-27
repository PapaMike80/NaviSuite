(function(){
  const minutes=value=>Math.max(0,Math.round(Number(value)||0));
  const SENTINE_TYPES={merda:30,sentine:60,sentine_merda:90};
  const structured=entry=>!!entry?.overtimeComponents&&typeof entry.overtimeComponents==='object'&&!Array.isArray(entry.overtimeComponents);
  const components=entry=>structured(entry)?entry.overtimeComponents:null;
  const sum=entry=>structured(entry)?Object.values(components(entry)).reduce((total,value)=>total+minutes(value),0):minutes(entry?.delay);
  const ordinary=entry=>structured(entry)?minutes(components(entry).ordinario):minutes(entry?.delay);
  const changes=entry=>structured(entry)?minutes(components(entry).cambi):minutes(entry?.changeMinutes);
  const sentine=entry=>structured(entry)?minutes(components(entry).sentine):minutes(entry?.sentineActivity?.minutes);
  const sentineType=entry=>entry?.sentineActivity?.type||null;
  const isOrdinaryManual=entry=>entry?.overtimeMeta?.ordinaryMode==='manual';
  function activate(entry){
    if(structured(entry))return entry.overtimeComponents;
    // I record precedenti restano intatti fino a una modifica esplicita.
    // Il vecchio totale viene trattato come ritardo, evitando doppi conteggi.
    const legacyChange=minutes(entry?.changeMinutes);
    entry.overtimeComponents={ordinario:minutes(entry?.delay),cambi:0,sentine:0};
    if(Number.isFinite(Number(entry?.workedMinutes)))entry.workedMinutes=Math.max(0,minutes(entry.workedMinutes)-legacyChange);
    entry.changeMinutes=0;
    entry.delay=minutes(entry.overtimeComponents.ordinario);
    return entry.overtimeComponents;
  }
  function sync(entry){if(structured(entry))entry.delay=sum(entry);return entry}
  function recalculateOrdinary(entry,serviceMinutes){
    if(!structured(entry)||isOrdinaryManual(entry)||!Number.isFinite(Number(entry?.workedMinutes))||!Number.isFinite(Number(serviceMinutes)))return sync(entry);
    const extra=Math.max(0,minutes(entry.workedMinutes)-minutes(serviceMinutes));
    entry.overtimeComponents.ordinario=Math.max(0,extra-changes(entry)-sentine(entry));
    return sync(entry);
  }
  function setOrdinary(entry,value){activate(entry).ordinario=minutes(value);entry.overtimeMeta={...(entry.overtimeMeta||{}),ordinaryMode:'manual'};return sync(entry)}
  function setChanges(entry,value,serviceMinutes){activate(entry).cambi=minutes(value);entry.changeMinutes=minutes(value);return recalculateOrdinary(entry,serviceMinutes)}
  function setSentine(entry,type,serviceMinutes){
    activate(entry);
    const normalized=SENTINE_TYPES[type]?type:null,amount=normalized?SENTINE_TYPES[normalized]:0;
    entry.overtimeComponents.sentine=amount;
    entry.sentineActivity=normalized?{type:normalized,minutes:amount}:null;
    return recalculateOrdinary(entry,serviceMinutes);
  }
  function setWorked(entry,value,serviceMinutes){
    activate(entry);
    entry.workedMinutes=minutes(value);
    entry.overtimeMeta={...(entry.overtimeMeta||{}),ordinaryMode:'auto'};
    return recalculateOrdinary(entry,serviceMinutes);
  }
  function create(){return {ordinario:0,cambi:0,sentine:0}}
  window.NaviOvertimeComponents={structured,components,total:sum,ordinary,changes,sentine,sentineType,isOrdinaryManual,activate,sync,recalculateOrdinary,setOrdinary,setChanges,setSentine,setWorked,create,minutes,SENTINE_TYPES};
})();
