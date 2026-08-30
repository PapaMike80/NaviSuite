(function(){
  const minutes=value=>Math.max(0,Math.round(Number(value)||0));
  const SENTINE_TYPES={merda:30,sentine:60,sentine_merda:90};
  const structured=entry=>!!entry?.overtimeComponents&&typeof entry.overtimeComponents==='object'&&!Array.isArray(entry.overtimeComponents);
  const components=entry=>structured(entry)?entry.overtimeComponents:null;
  // Nei record legacy il cambio era un campo distinto dal ritardo: entrambi
  // compongono lo straordinario anche prima della prima modifica esplicita.
  const sum=entry=>structured(entry)?Object.values(components(entry)).reduce((total,value)=>total+minutes(value),0):minutes(entry?.delay)+minutes(entry?.changeMinutes);
  const ordinary=entry=>structured(entry)?minutes(components(entry).ordinario):minutes(entry?.delay);
  const changes=entry=>structured(entry)?minutes(components(entry).cambi):minutes(entry?.changeMinutes);
  const sentine=entry=>structured(entry)?minutes(components(entry).sentine):minutes(entry?.sentineActivity?.minutes);
  const sentineType=entry=>entry?.sentineActivity?.type||null;
  const isOrdinaryManual=entry=>entry?.overtimeMeta?.ordinaryMode==='manual';
  const isWorkedManual=entry=>entry?.overtimeMeta?.workedMode==='manual';
  function activate(entry){
    if(structured(entry))return entry.overtimeComponents;
    // I record precedenti restano intatti fino a una modifica esplicita.
    // Il ritardo e il cambio legacy diventano le rispettive componenti,
    // senza perdere il cambio già confermato e senza duplicarlo.
    const legacyChange=minutes(entry?.changeMinutes);
    entry.overtimeComponents={ordinario:minutes(entry?.delay),cambi:legacyChange,sentine:0};
    entry.changeMinutes=legacyChange;
    entry.delay=minutes(entry.overtimeComponents.ordinario);
    return entry.overtimeComponents;
  }
  function sync(entry,serviceMinutes){
    if(structured(entry))entry.delay=sum(entry);
    // La nuova relazione viene applicata solo durante un salvataggio esplicito.
    // Nessuna semplice lettura/apertura di una giornata storica la modifica.
    // Le ore lavorate sono calcolate automaticamente solo finché l'agente
    // non le ha corrette esplicitamente. Il servizio è una durata prevista,
    // non un valore minimo delle ore effettivamente lavorate.
    if(Number.isFinite(Number(serviceMinutes))&&!isWorkedManual(entry))entry.workedMinutes=minutes(serviceMinutes)+sum(entry);
    return entry;
  }
  function recalculateOrdinary(entry,serviceMinutes){
    if(!structured(entry)||isOrdinaryManual(entry)||!Number.isFinite(Number(entry?.workedMinutes))||!Number.isFinite(Number(serviceMinutes)))return sync(entry,serviceMinutes);
    const extra=Math.max(0,minutes(entry.workedMinutes)-minutes(serviceMinutes));
    entry.overtimeComponents.ordinario=Math.max(0,extra-changes(entry)-sentine(entry));
    return sync(entry,serviceMinutes);
  }
  function setOrdinary(entry,value,serviceMinutes){activate(entry).ordinario=minutes(value);entry.overtimeMeta={...(entry.overtimeMeta||{}),ordinaryMode:'manual'};return sync(entry,serviceMinutes)}
  function setChanges(entry,value,serviceMinutes){activate(entry).cambi=minutes(value);entry.changeMinutes=minutes(value);return sync(entry,serviceMinutes)}
  function setSentine(entry,type,serviceMinutes){
    activate(entry);
    const normalized=SENTINE_TYPES[type]?type:null,amount=normalized?SENTINE_TYPES[normalized]:0;
    entry.overtimeComponents.sentine=amount;
    entry.sentineActivity=normalized?{type:normalized,minutes:amount}:null;
    return sync(entry,serviceMinutes);
  }
  function setSentineMinutes(entry,value,serviceMinutes){
    activate(entry);
    const amount=minutes(value);
    entry.overtimeComponents.sentine=amount;
    entry.sentineActivity=amount?{minutes:amount}:null;
    return sync(entry,serviceMinutes);
  }
  function setWorked(entry,value,serviceMinutes){
    entry.workedMinutes=minutes(value);
    entry.overtimeMeta={...(entry.overtimeMeta||{}),workedMode:'manual'};
    // Una correzione manuale delle ore non ricava né modifica le causali:
    // ritardo, cambio e sentine restano dati distinti e non negativi.
    return entry;
  }
  function create(){return {ordinario:0,cambi:0,sentine:0}}
  window.NaviOvertimeComponents={structured,components,total:sum,ordinary,changes,sentine,sentineType,isOrdinaryManual,isWorkedManual,activate,sync,recalculateOrdinary,setOrdinary,setChanges,setSentine,setSentineMinutes,setWorked,create,minutes,SENTINE_TYPES};
})();
