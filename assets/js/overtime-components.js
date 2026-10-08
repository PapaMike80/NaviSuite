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
    if(Number.isFinite(Number(serviceMinutes))&&!isWorkedManual(entry))entry.workedMinutes=minutes(serviceMinutes)+sum(entry)+minutes(entry?.refuelWorked);
    return entry;
  }
  function recalculateOrdinary(entry,serviceMinutes){
    if(!structured(entry)||isOrdinaryManual(entry)||!Number.isFinite(Number(entry?.workedMinutes))||!Number.isFinite(Number(serviceMinutes)))return sync(entry,serviceMinutes);
    const extra=Math.max(0,minutes(entry.workedMinutes)-minutes(serviceMinutes));
    entry.overtimeComponents.ordinario=Math.max(0,extra-changes(entry)-sentine(entry));
    return sync(entry,serviceMinutes);
  }
  function setOrdinary(entry,value,serviceMinutes){activate(entry).ordinario=minutes(value);entry.overtimeMeta={...(entry.overtimeMeta||{}),ordinaryMode:'manual'};return sync(entry,serviceMinutes)}
  // Cambio e sentine aumentano sempre le ore lavorate: se le ore sono state corrette a mano
  // si aggiunge (o toglie) la differenza alla correzione.
  function addToManualWorked(entry,delta){if(isWorkedManual(entry)&&delta)entry.workedMinutes=minutes(minutes(entry.workedMinutes)+delta)}
  function setChanges(entry,value,serviceMinutes){const before=changes(entry);activate(entry).cambi=minutes(value);entry.changeMinutes=minutes(value);addToManualWorked(entry,minutes(value)-before);return sync(entry,serviceMinutes)}
  function setSentine(entry,type,serviceMinutes){
    const before=sentine(entry);
    activate(entry);
    const normalized=SENTINE_TYPES[type]?type:null,amount=normalized?SENTINE_TYPES[normalized]:0;
    entry.overtimeComponents.sentine=amount;
    entry.sentineActivity=normalized?{type:normalized,minutes:amount}:null;
    addToManualWorked(entry,amount-before);
    return sync(entry,serviceMinutes);
  }
  function setSentineMinutes(entry,value,serviceMinutes){
    const before=sentine(entry);
    activate(entry);
    const amount=minutes(value);
    addToManualWorked(entry,amount-before);
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
  // Rifornimento: sempre 1 ora di banca ore (una volta) e il suo tempo in piu' nelle ore lavorate.
  // refuelBank / refuelWorked ricordano quanto e' gia' stato aggiunto (nei record vecchi il
  // rifornimento dava in banca ore i suoi minuti e nulla alle ore lavorate).
  const REFUEL_BANK=60;
  // done: rifornimento fatto anche senza anticipo (es. BIS e SR2): 1 ora di banca ore, ore lavorate invariate.
  function setRefuel(entry,value,serviceMinutes,previous=0,done=minutes(value)>0){
    const next=minutes(value),before=minutes(previous);
    const creditedBank=entry.refuelBank===undefined?before:minutes(entry.refuelBank),creditedWorked=minutes(entry.refuelWorked);
    const bank=done||next>0?REFUEL_BANK:0;
    entry.refuelDone=bank>0;
    entry.bank=Math.round(Number(entry.bank)||0)+bank-creditedBank;
    entry.refuelBank=bank;
    if(isWorkedManual(entry))entry.workedMinutes=minutes(minutes(entry.workedMinutes)+next-creditedWorked);
    entry.refuelWorked=next;
    entry.refuel=next;
    return sync(entry,serviceMinutes);
  }
  // Rifornimenti dell'O.d.S. (8815/2°, dal 5/10/2026 al 25/3/2027): giorni (0 = domenica) e anticipo.
  // motorista = solo il motorista; tutti = tutto l'equipaggio (M1). BIS e SR2 ogni giorno senza anticipo.
  const RIFORNIMENTI={D1:{giorni:[2,5],motorista:30},D2:{giorni:[1,4],motorista:30},T1:{giorni:[3],motorista:60},T2:{giorni:[4],motorista:60},
    M1:{giorni:[4],tutti:30},R1:{giorni:[2,5],motorista:30},R2:{giorni:[2,5],motorista:60},R3:{giorni:[2,5],motorista:30},
    BIS:{giorni:[0,1,2,3,4,5,6],motorista:0},SR2:{giorni:[0,1,2,3,4,5,6],motorista:0}};
  // Minuti di anticipo per il rifornimento del giorno (0 = senza anticipo), null se non tocca all'agente.
  function suggestRefuel(entry,{qualifica='',ship=''}={}){
    if(!entry?.date||entry.date<'2026-10-05'||entry.date>'2027-03-25')return null;
    const code=String(entry.shift||'').trim().toUpperCase().replace(/^C(?=[A-Z]+\d)/,'').replace(/C$/,''),regola=RIFORNIMENTI[code];
    if(!regola)return null;
    const giorno=new Date(`${entry.date}T12:00:00`).getDay(),agone=code==='D1'&&String(ship).toUpperCase().includes('AGONE');
    if(!regola.giorni.includes(giorno)&&!(agone&&giorno===0))return null;
    if(regola.tutti)return regola.tutti;
    const q=String(qualifica||'').trim().toLowerCase().replace(/\s+/g,' ');
    if(q==='motorista')return regola.motorista;
    if(agone&&/^aiuto ?motorista$/.test(q))return 30;
    return null;
  }
  const refuelDone=entry=>entry?.refuelDone===true||(typeof entry?.refuel==='number'?entry.refuel>0:!!entry?.refuel);
  // Applica la proposta una volta sola (refuelDecision): se l'agente lo cambia a mano resta la sua scelta.
  function autoRefuel(entry,serviceMinutes,context){
    if(!entry||entry.refuelDecision||refuelDone(entry))return false;
    if(['RIP','RIPOSO','MALATTIA'].includes(String(entry.shift||'').toUpperCase()))return false;
    const value=suggestRefuel(entry,context);
    if(value==null)return false;
    setRefuel(entry,value,serviceMinutes,0,true);entry.refuelDecision='auto';return true;
  }
  function create(){return {ordinario:0,cambi:0,sentine:0}}
  window.NaviOvertimeComponents={structured,components,total:sum,ordinary,changes,sentine,sentineType,isOrdinaryManual,isWorkedManual,activate,sync,recalculateOrdinary,setOrdinary,setChanges,setSentine,setSentineMinutes,setWorked,setRefuel,suggestRefuel,autoRefuel,RIFORNIMENTI,REFUEL_BANK,create,minutes,SENTINE_TYPES};
})();

(() => {
  if (!document.body?.classList.contains('diaria-page')) return;
  const load = () => {
    if (window.NaviTicketPersonalizationLoaded || document.querySelector('script[data-navi-ticket-personalization]')) return;
    const script = document.createElement('script');
    script.src = 'assets/js/ticket-personalization.js?v=1';
    script.dataset.naviTicketPersonalization = '1';
    document.head.appendChild(script);
  };
  if (document.readyState === 'complete') setTimeout(load, 0);
  else window.addEventListener('load', load, {once:true});
})();
