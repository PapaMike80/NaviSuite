(()=>{
 let requests=[];
 let changeAdminUpdates={odsVariations:[],dismissedOdsApprovals:[]};
 let lastFocusRefresh=0;
 async function post(payload){const firebase=window.NaviFirebase||window.NaviAdminFirebase;if(!firebase)throw new Error('Firebase non disponibile');if(payload?.action==='list_change_requests')return {ok:true,requests:await firebase.listChangeRequests(payload.agentId)};throw new Error('Azione Firebase non supportata')}
 function profile(){try{return window.TurniShared?.readLoggedAgentProfile?.()||JSON.parse(localStorage.getItem('naviturni_logged_agent')||'null')}catch(e){return null}}
 function norm(v){return String(v||'').trim().toUpperCase().replace(/\s+/g,' ')}
 function findAgentRow(id,name){const rows=[...document.querySelectorAll('#tbody tr')];return rows.find(r=>String(r.dataset.agentId||'')===String(id||''))||rows.find(r=>norm(r.dataset.agentName)===norm(name))}
 function shift(v){const value=norm(v).replace(/\./g,'');return !value||/^={3,}$/.test(value)||value==='RIPOSO'||value==='RIP'?'RIP':value}
 function variationFor(row,date){
   if(!row||!date)return false;
   const all=Object.values(globalData?.residenze||{}).flat();
   const agent=all.find(a=>String(a.id||'')===String(row.dataset.agentId||''))||all.find(a=>norm(a.agente)===norm(row.dataset.agentName));
   return agent?.variazioni_ods?.[date]||null;
 }
 function variationForAgent(id,name,date){
   const all=Object.values(globalData?.residenze||{}).flat();
   const agent=all.find(a=>String(a.id||'')===String(id||''))||all.find(a=>norm(a.agente)===norm(name));
   return agent?.variazioni_ods?.[date]||null;
 }
 function odsRequestMatches(req){
   const dismissedRows=changeAdminUpdates.dismissedOdsApprovals?.length?changeAdminUpdates.dismissedOdsApprovals:(globalData?.dismissedOdsApprovals||[]);
   const dismissed=dismissedRows.some(item=>String(item?.requestId||'')===String(req?.id||''));
   if(dismissed)return false;
   const changes=Array.isArray(req?.changes)?req.changes:[];
   const rawOds=(changeAdminUpdates.odsVariations||[]).filter(item=>item?.attiva!==false&&norm(item?.tipo||'ODS')!=='MANUALE');
   if(rawOds.length){
     const belongs=(variation,id,name)=>String(variation?.id_agente||'')===String(id||'')||norm(variation?.agente)===norm(name);
     return changes.length>0&&changes.every(ch=>
       rawOds.some(v=>String(v.data||'')===String(ch.date||'')&&belongs(v,req.agentId,req.agentName)&&shift(v.turno_nuovo)===shift(ch.to))&&
       rawOds.some(v=>String(v.data||'')===String(ch.date||'')&&belongs(v,req.colleagueId,req.colleagueName)&&shift(v.turno_nuovo)===shift(ch.from))
     );
   }
   return changes.length>0&&changes.every(ch=>{
     const agentVariation=variationForAgent(req.agentId,req.agentName,ch.date);
     const colleagueVariation=variationForAgent(req.colleagueId,req.colleagueName,ch.date);
     return agentVariation?.attiva!==false&&norm(agentVariation?.tipo)!=='MANUALE'&&shift(agentVariation?.turno_nuovo)===shift(ch.to)&&
       colleagueVariation?.attiva!==false&&norm(colleagueVariation?.tipo)!=='MANUALE'&&shift(colleagueVariation?.turno_nuovo)===shift(ch.from);
   });
 }
 function variationMatches(row,date,source,target,requestId,odsRequestConfirmed){
   const variation=variationFor(row,date);
   if(!variation||variation.attiva===false)return false;
   const sameRequest=String(requestId||'')&&String(variation.requestId||'')===String(requestId);
   const sameTransition=shift(variation.turno_originale)===shift(source)&&shift(variation.turno_nuovo)===shift(target);
   const manualTransition=norm(variation.tipo)==='MANUALE'&&sameTransition;
   return Boolean(sameRequest||manualTransition||odsRequestConfirmed);
 }
 function addCell(row,cal,cls,items,confirmed=false){const td=row?.querySelector(`td[data-col="${cal.col}"]`);if(!td)return;if(td.hasAttribute('title')&&!td.dataset.changeRequestPreviousTitle)td.dataset.changeRequestPreviousTitle=td.getAttribute('title')||'';td.removeAttribute('title');td.classList.add(cls);td.classList.toggle('confirmed-change-request',confirmed);td.dataset.changeRequest=JSON.stringify(items)}
 function apply(){
   document.querySelectorAll('#tbody td.my-change-request,#tbody td.peer-change-request').forEach(td=>{td.classList.remove('my-change-request','peer-change-request','confirmed-change-request');delete td.dataset.changeRequest;if('changeRequestPreviousTitle'in td.dataset){if(td.dataset.changeRequestPreviousTitle)td.setAttribute('title',td.dataset.changeRequestPreviousTitle);else td.removeAttribute('title');delete td.dataset.changeRequestPreviousTitle}});
   document.querySelectorAll('#tbody tr.peer-change-row').forEach(r=>r.classList.remove('peer-change-row'));
   const p=profile();if(!p)return;
   requests.forEach(req=>{
     const agentRow=findAgentRow(req.agentId,req.agentName);
     const colleagueRow=findAgentRow(req.colleagueId,req.colleagueName);
     const loggedIsAgent=String(p.id||'')===String(req.agentId||'');
     const peerRow=loggedIsAgent?colleagueRow:agentRow;
     const odsConfirmed=odsRequestMatches(req);
     if(peerRow)peerRow.classList.add('peer-change-row');
     (req.changes||[]).forEach(ch=>{
       const cal=(window.dateCalendario||dateCalendario||[]).find(c=>c.iso===ch.date);if(!cal)return;
       const detail={agentName:req.agentName||p.name||'Tu',agentTo:ch.to,colleagueName:req.colleagueName||'Collega',colleagueTo:ch.from};
       addCell(agentRow,cal,loggedIsAgent?'my-change-request':'peer-change-request',[detail],variationMatches(agentRow,ch.date,ch.from,ch.to,req.id,odsConfirmed));
       addCell(colleagueRow,cal,loggedIsAgent?'peer-change-request':'my-change-request',[detail],variationMatches(colleagueRow,ch.date,ch.to,ch.from,req.id,odsConfirmed));
     });
   });
 }
 async function load(){const p=profile();if(!p?.id)return;try{const d=await post({action:'list_change_requests',agentId:String(p.id)});requests=Array.isArray(d.requests)?d.requests:[];if(window.NaviAdminFirebase?.getAdminUpdates)try{changeAdminUpdates=await window.NaviAdminFirebase.getAdminUpdates()}catch(error){console.warn('Conferme ODS non disponibili',error)}apply()}catch(e){console.warn('Richieste cambio non disponibili',e)}}

 window.addEventListener('DOMContentLoaded',()=>setTimeout(load,1200));
 const obs=new MutationObserver(()=>setTimeout(apply,0));window.addEventListener('DOMContentLoaded',()=>{const t=document.getElementById('tbody');if(t)obs.observe(t,{childList:true,subtree:true})});
 window.addEventListener('focus',()=>{
   const now=Date.now();
   if(now-lastFocusRefresh<60000)return;
   lastFocusRefresh=now;
   load();
   if(typeof caricaStatoSettimane==='function'){
     const before=JSON.stringify([...(weekStatusMap||new Map())]);
     caricaStatoSettimane().then(()=>{
       // globalData è già nel formato interno: non deve essere trasformato una seconda volta,
       // altrimenti i turni vengono sostituiti da RIP. Aggiorniamo soltanto intestazioni e tabella.
       const changed=before!==JSON.stringify([...(weekStatusMap||new Map())]);
       if(globalData&&changed){
         if(typeof buildTableHeader==='function') buildTableHeader();
         if(typeof renderTable==='function') renderTable();
         if(typeof scrollToToday==='function') setTimeout(scrollToToday,30);
       }
     }).catch(()=>{});
   }
 });
})();
