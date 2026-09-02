(function(){
  'use strict';
  const COURSES={DESENZANO:['D1','D2','D3','D4','BIS'],MADERNO:['T1','T2','M1'],RIVA:['R1','R2','R3','R4','CAR'],PESCHIERA:['P1','P2','P3','CAP','SR1']};
  const COURSE_COLORS={D1:'#58d8c5',D2:'#44b8f1',D3:'#b78cff',D4:'#f1a960',BIS:'#f1ce62',T1:'#75d992',T2:'#b0df64',M1:'#48c7ba',R1:'#e988b2',R2:'#efac73',R3:'#d782ef',R4:'#e67e7e',CAR:'#80b5ff',P1:'#80b5ff',P2:'#82d8ea',P3:'#71cdae',CAP:'#b8a2ff',SR1:'#e6cc75'};
  const ROLE_INFO=[
    [/capitano|comandante/i,'Capitano','#facc15',1],
    [/capo\s*timoniere|capotimoniere/i,'Capo timoniere','#fb923c',2],
    [/motorista/i,'Motorista','#a855f7',3],
    [/timoniere/i,'Timoniere','#22c55e',4],
    [/aiuto\s*motorista|aiutomotorista/i,'Aiuto motorista','#3b82f6',5],
    [/marinaio/i,'Marinaio','#94a3b8',6]
  ];
  const statusEl=document.getElementById('oggi-status');
  const contentEl=document.getElementById('oggi-content');
  const refreshButton=document.getElementById('oggi-refresh');
  const todayIso=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});
  const dateLabel=iso=>new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Rome'}).format(new Date(`${iso}T12:00:00`));
  const norm=value=>String(value||'').trim().toLocaleUpperCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim();
  const cleanShift=value=>{
    const raw=String(value||'').trim().toUpperCase().replace(/[‐‑–—]/g,'-').replace(/\s+/g,'');
    if(!raw||/^(RIP|RIPOSO|===|--+|CON|FP|F\.P\.|TERRA|LAV)$/.test(raw))return '';
    // Le trasferte sono codificate nel piano con una C prima e/o dopo il
    // turno: CD1C, CP1C, CR3C, CT2C. La C non è una nuova corsa: l'agente
    // deve entrare nell'equipaggio della corsa di destinazione.
    const direct=raw.match(/^C?(D[1-4]|BIS|T[12]|M1|R[1-4]|CAR\d*|P[1-3]|CAP\d*|SR1)C?$/)?.[1];
    if(!direct)return '';
    const code=direct.replace(/\d+$/,'');
    return code==='CAR'||code==='CAP'?code:direct;
  };
  const residenceForCourse=course=>Object.entries(COURSES).find(([,list])=>list.includes(course))?.[0]||'ALTRE CORSE';
  const roleFor=agent=>{
    const value=String(agent?.qualifica||agent?.grado||agent?.role||'');
    return ROLE_INFO.find(([pattern])=>pattern.test(value))?.slice(1)||['Equipaggio','#94a3b8',99];
  };
  const isBarista=agent=>String(agent?.role||'').toLowerCase()==='barista'||String(agent?.qualifica||'').toLowerCase()==='barista';
  const isHiba=agent=>String(agent?.id||'').toUpperCase()==='BARISTA_HIBA'||(isBarista(agent)&&norm(agent?.name||agent?.agente||agent?.cognome)==='HIBA');
  function getSession(){try{return JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch{return null}}
  function validShip(value){const ship=String(value||'').trim();return ship&&!/^(?:-|N\/A|NESSUNA|NON ASSEGNATA|RIP)$/i.test(ship)&&!cleanShift(ship)?ship:''}
  function getShift(agent,iso,variationMap){
    const id=String(agent?.id||agent?.agent_uid||'');
    const byId=variationMap.get(`id:${id}`);const byName=variationMap.get(`name:${norm(agent?.agente||agent?.name)}`);
    const variation=byId?.get(iso)||byName?.get(iso);
    if(variation!==undefined)return cleanShift(variation);
    return cleanShift(agent?.turni?.[iso]);
  }
  function buildVariationMap(data){
    const map=new Map();
    (data?.variazioni_ods||[]).forEach(item=>{
      const iso=String(item?.data||item?.date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return;
      const shift=item?.turno_nuovo??item?.turno??item?.dopo; if(shift===undefined)return;
      const keys=[];if(item?.id_agente||item?.agentId)keys.push(`id:${String(item.id_agente||item.agentId)}`);if(item?.agente||item?.nome)keys.push(`name:${norm(item.agente||item.nome)}`);
      keys.forEach(key=>{if(!map.has(key))map.set(key,new Map());map.get(key).set(iso,shift);});
    });
    return map;
  }
  function buildCourses(data,iso){
    const variationMap=buildVariationMap(data);const agents=[];const unique=new Set();
    Object.entries(data?.residenze||{}).forEach(([residence,list])=>(list||[]).forEach(agent=>{
      const key=String(agent?.agent_uid||agent?.id||norm(agent?.agente));if(!key||unique.has(key))return;unique.add(key);agents.push({...agent,__residence:residence});
    }));
    const cards=new Map();
    const ensure=(course,residence)=>{if(!course)return null;const key=`${residenceForCourse(course)}:${course}`;if(!cards.has(key))cards.set(key,{course,residence:residence||residenceForCourse(course),ship:'',crew:[]});return cards.get(key)};
    (data?.turni_navi||[]).filter(item=>String(item?.data||'').slice(0,10)===iso&&item?.attiva!==false).forEach(item=>{
      const course=cleanShift(item?.corsa||item?.turno);const card=ensure(course);if(card){const ship=validShip(item?.nave||item?.nome_nave);if(ship)card.ship=ship;}
    });
    agents.forEach(agent=>{const course=getShift(agent,iso,variationMap);const card=ensure(course,agent.__residence);if(card)card.crew.push(agent);});
    return [...cards.values()].map(card=>({...card,crew:card.crew.sort((a,b)=>roleFor(a)[2]-roleFor(b)[2]||String(a.agente||a.name).localeCompare(String(b.agente||b.name),'it'))})).sort((a,b)=>Object.keys(COURSES).indexOf(a.residence)-Object.keys(COURSES).indexOf(b.residence)||a.course.localeCompare(b.course,undefined,{numeric:true}));
  }
  function escapeHtml(value){const el=document.createElement('div');el.textContent=String(value||'');return el.innerHTML}
  function render(data,iso){
    const cards=buildCourses(data,iso);statusEl.hidden=true;statusEl.classList.remove('error');
    if(!cards.length){contentEl.innerHTML='<div class="oggi-empty">Non risultano corse operative per questa giornata.</div>';return}
    const grouped=cards.reduce((map,card)=>{(map[card.residence]||=[]).push(card);return map},{});
    const ordered=['DESENZANO','PESCHIERA','MADERNO','RIVA'].filter(residence=>grouped[residence]?.length).map(residence=>[residence,grouped[residence]]);
    contentEl.classList.add('oggi-pairs');
    const colors={DESENZANO:'#4ea9ff',PESCHIERA:'#51cf92',MADERNO:'#f59f55',RIVA:'#be8cff'};
    contentEl.innerHTML=ordered.map(([residence,items])=>`<section class="oggi-residence" style="--res-color:${colors[residence]}"><h2 class="oggi-residence-title"><button class="oggi-residence-toggle" type="button" aria-expanded="false">${escapeHtml(residence)} ⌄</button><button class="oggi-residence-menu" type="button" aria-label="Apri menu">☰</button></h2><div class="oggi-grid">${items.map(card=>`<article class="oggi-card" style="--course-color:${COURSE_COLORS[card.course]||'#62e4d0'}"><button class="oggi-card-head" type="button" aria-expanded="false" aria-label="Apri equipaggio ${escapeHtml(card.course)}"><span class="oggi-code">${escapeHtml(card.course)}</span><span class="oggi-card-copy"><strong>${escapeHtml(card.course)}</strong><small>⛴ ${card.ship?escapeHtml(card.ship):'Nave non assegnata'} · ${escapeHtml(card.crew.length)} equipaggio</small></span><span class="oggi-card-arrow" aria-hidden="true">⌄</span></button><div class="oggi-card-body">${card.crew.length?`<ul class="oggi-crew">${card.crew.map(agent=>{const [role,color]=roleFor(agent);return `<li><i class="oggi-role-dot" style="--role-color:${color}"></i><span class="oggi-crew-name">${escapeHtml(agent.agente||agent.name)}</span><span class="oggi-role">${escapeHtml(role)}</span></li>`}).join('')}</ul>`:'<p class="oggi-no-crew">Nessun componente equipaggio assegnato.</p>'}</div></article>`).join('')}</div></section>`).join('');
  }
  async function refresh(){
    const session=getSession();if(isBarista(session)&&!isHiba(session)){contentEl.innerHTML='<section class="oggi-access"><h1>Area riservata</h1><p>La panoramica degli equipaggi non è disponibile per questo profilo.</p></section>';statusEl.hidden=true;return}
    const iso=todayIso();if(refreshButton)refreshButton.disabled=true;statusEl.hidden=false;statusEl.classList.remove('error');statusEl.textContent='Aggiornamento equipaggi…';
    try{const data=await window.NaviSharedData.load('',{force:true});render(data,iso)}catch(error){console.error('Oggi: caricamento non riuscito',error);statusEl.hidden=false;statusEl.textContent='Impossibile caricare le corse di oggi. Riprova.';statusEl.classList.add('error');contentEl.innerHTML=''}finally{if(refreshButton)refreshButton.disabled=false}
  }
  refreshButton?.addEventListener('click',refresh);
  contentEl?.addEventListener('click',event=>{
    const menuButton=event.target.closest('.oggi-residence-menu');if(menuButton){window.NaviOggi?.openMenu?.();return;}\n    const residenceButton=event.target.closest('.oggi-residence-toggle');if(residenceButton){const section=residenceButton.closest('.oggi-residence');const open=residenceButton.getAttribute('aria-expanded')!=='true';residenceButton.setAttribute('aria-expanded',String(open));section.querySelectorAll('.oggi-card').forEach(card=>{card.classList.toggle('is-open',open);card.querySelector('.oggi-card-head').setAttribute('aria-expanded',String(open));});return;}
    const button=event.target.closest('.oggi-card-head');if(!button)return;
    const card=button.closest('.oggi-card');const open=!card.classList.contains('is-open');
    card.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));
  });
  document.getElementById('oggi-menu')?.addEventListener('click',()=>document.querySelector('.app-sidebar')?.classList.toggle('open'));
  const openMenu=()=>{const p=document.getElementById('oggi-nav-popup');const nav=document.querySelector('.app-sidebar nav');if(p&&nav){p.querySelector('nav').innerHTML=nav.innerHTML;p.hidden=false;}};document.getElementById('oggi-nav-popup')?.addEventListener('click',e=>{if(e.target.id==='oggi-nav-popup'||e.target.closest('#oggi-nav-close'))e.currentTarget.hidden=true;});window.NaviOggi={refresh,buildCourses,openMenu};
  refresh();
})();
