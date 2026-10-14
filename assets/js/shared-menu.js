(function(){
  const APP_VERSION='v1.48';
  const NAVISUITE_KOFI_URL='https://ko-fi.com/papamike80';
  function installSupportFooter(){
    if(document.getElementById('navisuite-support-footer'))return;
    const style=document.createElement('style');
    style.id='navisuite-support-footer-style';
    style.textContent='.navisuite-support-footer{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;max-width:720px;margin:30px auto calc(22px + env(safe-area-inset-bottom,0px));padding:0 16px;color:#9fb8c2;font:600 13px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.navisuite-support-footer a{color:#2dd4bf;text-decoration:none;font-weight:800}.navisuite-support-footer a:hover{text-decoration:underline}';
    document.head.appendChild(style);
    const footer=document.createElement('footer');
    footer.id='navisuite-support-footer';
    footer.className='navisuite-support-footer';
    footer.innerHTML='<p>☕ NaviSuite ti è utile?</p><a href="'+NAVISUITE_KOFI_URL+'" target="_blank" rel="noopener noreferrer" aria-label="Offrimi un caffè e sostieni NaviSuite tramite Ko-fi">Offrimi un caffè</a>';
    document.body.appendChild(footer);
  }
  installSupportFooter();
  window.NAVISUITE_VERSION=APP_VERSION;
  let initialThemeAgent=null;try{initialThemeAgent=JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch{}
  const initialLightTester=['91','AG_PEDRONI_M'].includes(String(initialThemeAgent?.id||'').toUpperCase())||/\bPEDRONI\b/i.test(String(initialThemeAgent?.name||initialThemeAgent?.agente||initialThemeAgent?.cognome||''));
  const initialLightTheme=initialLightTester&&localStorage.getItem('navisuite.theme.'+String(initialThemeAgent?.id||''))==='light';
  document.documentElement.classList.toggle('navisuite-light',initialLightTheme);
  document.body.classList.toggle('navisuite-light',initialLightTheme);
  if(initialLightTheme)document.documentElement.dataset.theme='light';
  const sessionValue=localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null';
  let sessionAgent=null;try{sessionAgent=JSON.parse(sessionValue)}catch{}
  const installAnalytics=()=>{
    const GA_ID='G-R59ZS3YB4Q';
    if(window.__naviGaInstalled)return;
    window.__naviGaInstalled=true;
    window.dataLayer=window.dataLayer||[];
    if(typeof window.gtag!=='function')window.gtag=function(){window.dataLayer.push(arguments);};
    if(!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')){
      const script=document.createElement('script');
      script.async=true;
      script.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;
      document.head.appendChild(script);
    }
    const roles=window.NaviRoles;
    const roleOf=agent=>{
      if(!agent?.id||!roles)return '';
      if(roles.isAdminAgent(agent))return 'admin';
      if(String(agent?.qualifica||agent?.office||'').toLowerCase().includes('movimento'))return 'movimento';
      if(roles.isBaristaAgent(agent))return 'barista';
      if(roles.isScaloAgent?.(agent))return 'scalo';
      return 'agente';
    };
    const ruolo=roleOf(sessionAgent);
    window.gtag('js',new Date());
    if(ruolo)window.gtag('set','user_properties',{ruolo});
    window.gtag('config',GA_ID,{send_page_view:false});
    window.gtag('event','page_view',{page_title:document.title,page_location:location.origin+location.pathname,page_path:location.pathname});
  };
  try{installAnalytics()}catch{}
  const trackPageView=attempt=>{
    if(!sessionAgent?.id)return;
    const tracker=window.NaviAdminFirebase?.recordUserAccess;
    if(typeof tracker==='function'){tracker(sessionAgent).catch(()=>{});return;}
    if(attempt<8)setTimeout(()=>trackPageView(attempt+1),250);
  };
  trackPageView(0);
  const installTodayAboveResidences=()=>{const box=document.getElementById('top-residence-buttons');if(!box||document.getElementById('today-above-residences'))return Boolean(box);const link=document.createElement('a');link.id='today-above-residences';link.href='oggi.html';link.textContent='Oggi';box.parentNode.insertBefore(link,box);return true};
  function installUnifiedMenu(agent){
    if(document.getElementById('navisuite-popup'))return;
    const roles=window.NaviRoles||{};
    const isAdmin=Boolean(roles.isAdminAgent?.(agent));
    const isBarista=Boolean(roles.isBaristaAgent?.(agent));
    const isHiba=Boolean(roles.isHibaBarista?.(agent));
    const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    const onTurni=file==='naviturni.html';
    const MENU_SCALO={'oggi.html':['☀','Oggi'],'naviturni.html':['▦','Turni'],'navidiaria.html':['≈','Distinta'],'documenti.html':['▤','Documenti'],'mio-turno.html':['⚑','Il mio turno']};
    const entries=roles.isScaloAgent?.(agent)?(roles.pagineAperte?.(agent)||['orario.html']).map(f=>[f,...(MENU_SCALO[f]||['•',f])]):[
      ...(isBarista&&!isHiba?[]:[['mio-turno.html','⚑','Il mio turno'],['orario.html','⚓','Scali'],['oggi.html','☀','Oggi']]),
      ['naviturni.html','▦','Turni'],
      ['navidiaria.html','≈','Distinta'],
      ['documenti.html','▤','Documenti'],
      ['cambi_turno.html','⇄','Cambio'],
      ['quiz.html','✎','Quiz'],
      ['impostazioni.html','⚙','Impostazioni'],
      ...(isAdmin?[['agenti.html','♙','Agenti'],['aggiornamenti.html','↻','Aggiornamenti'],['movimento.html','⚓','Movimento'],['controllo_cassa.html','¤','Cassa']]:[['controllo_cassa.html','¤','Cassa']])
    ];
    const escapeText=value=>String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
    const PRINCIPALI={'navidiaria.html':['Ore, ritardi e competenze','#fb923c',0],'mio-turno.html':['Nave, corse e colleghi','#2dd4bf',1],'naviturni.html':['Turni di tutti gli agenti','#2dd4bf',2]};
    const COLORI={'index.html':'#94a3b8','cambi_turno.html':'#a78bfa','documenti.html':'#f59e0b','impostazioni.html':'#94a3b8','quiz.html':'#f472b6','agenti.html':'#fb7185','aggiornamenti.html':'#f97316','movimento.html':'#22c55e','controllo_cassa.html':'#27a9b6'};
    const linkHtml=([href,icon,label])=>{
      const key=href.split('?')[0].toLowerCase(),active=key===file,main=PRINCIPALI[key];
      const colore=main?.[1]||COLORI[key]||'#94a3b8';
      return `<a class="nav-link ns-tile${main?' ns-main':''}${key==='navidiaria.html'?' ns-wide':''}${active?' active':''}" href="${href}" style="--c:${colore}"${active?' aria-current="page"':''}><span>${icon}</span><i><b>${escapeText(label)}</b></i></a>`;
    };
    const pastHtml='<a href="#" data-turni-main-past><span>◷</span><b>Mostra passato</b></a>';
    const ordine=e=>PRINCIPALI[e[0].split('?')[0].toLowerCase()]?.[2];
    const principali=entries.filter(e=>ordine(e)!==undefined).sort((a,b)=>ordine(a)-ordine(b)),altre=entries.filter(e=>ordine(e)===undefined);
    const pastTile=onTurni?pastHtml.replace('<a ','<a class="ns-tile" style="--c:#2dd4bf" ').replace('<b>','<i><b>').replace('</b>','</b></i>'):'';
    const linksHtml=`<div class="ns-grid ns-grid-main">${principali.map(linkHtml).join('')}</div>${altre.length||pastTile?`<p class="ns-altre">ALTRE PAGINE</p><div class="ns-grid ns-grid-small">${altre.map(linkHtml).join('')}${pastTile}</div>`:''}`;
    const style=document.createElement('style');
    style.id='navisuite-unified-menu-style';
    style.textContent=`
      .app-sidebar,.sidebar-collapse-button,.sidebar-reopen-button{display:none!important}
      @media(max-width:950px){.mobile-liquid-nav{display:none!important}}
      #navisuite-popup[hidden],#ns-condividi[hidden]{display:none!important}
      #navisuite-popup{position:fixed;inset:0;z-index:10000;background:rgba(2,12,17,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .ns-menu-dialog{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:12px;right:12px;box-sizing:border-box;width:auto;max-width:none;margin:0;max-height:calc(100dvh - env(safe-area-inset-top,0px) - 24px);background:#0b1f28;border:1px solid rgba(126,243,226,.18);border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45)}
      .ns-menu-head{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px;color:#a7fff0;font:900 26px/1 Manrope,system-ui,sans-serif}
      .ns-menu-close{width:44px;height:44px;border:1px solid rgba(126,243,226,.35);border-radius:14px;background:rgba(255,255,255,.06);color:#eafffb;font-size:30px;line-height:1;cursor:pointer}
      .ns-menu-links{display:block;overflow:auto;padding:0 16px 14px;-webkit-overflow-scrolling:touch}
      .ns-grid{display:grid;gap:9px}
      .ns-grid-main{grid-template-columns:1fr 1fr}
      .ns-grid-small{grid-template-columns:repeat(3,1fr);gap:8px}
      .ns-tile{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:13px 12px;border:1px solid #285560;border-radius:16px;background:rgba(255,255,255,.025);color:#e8f7f7;text-decoration:none}
      .ns-tile>span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);font-size:19px;flex:none}
      .ns-tile i{display:grid;gap:3px;font-style:normal;min-width:0}
      .ns-tile b{font:800 17px/1.15 Manrope,system-ui,sans-serif}
      .ns-tile small{font:600 12.5px/1.3 "DM Sans",system-ui,sans-serif;color:#9fb8c2}
      .ns-tile.ns-wide{grid-column:1/-1;flex-direction:row;align-items:center;gap:12px}
      .ns-tile.ns-wide>span{width:46px;height:46px;font-size:23px}
      .ns-tile.ns-wide b{font-size:21px}
      .ns-grid-small .ns-tile{align-items:center;text-align:center;padding:10px 4px;gap:4px}
      .ns-grid-small .ns-tile>span{width:32px;height:32px;font-size:16px;border-radius:10px}
      .ns-grid-small .ns-tile b{font-size:12.5px}
      .ns-tile.active{border-color:#45d9c7;background:rgba(45,212,191,.14)}
      .ns-saluto{display:flex;align-items:center;gap:10px;min-width:0;color:#eafffb;font-size:23px}
      .ns-grado{--g:#e8f3f6;display:inline-grid;place-items:center;flex:none;width:34px;height:34px;border:3px solid var(--g);border-radius:50%;background:color-mix(in srgb,var(--g) 18%,transparent);color:var(--g);font:900 13px/1 Inter,system-ui,sans-serif}
      #navisuite-popup .ns-tile{display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;text-align:left!important;gap:6px!important}
      #navisuite-popup .ns-tile.active{border-color:#45d9c7!important;background:rgba(45,212,191,.14)!important}
      #navisuite-popup .ns-tile.ns-wide{flex-direction:row!important;align-items:center!important;gap:12px!important}
      #navisuite-popup .ns-grid-small .ns-tile{align-items:center!important;text-align:center!important;padding:10px 4px!important;gap:4px!important}
      #navisuite-popup .ns-tile b{color:#e8f7f7!important;font:800 17px/1.15 Manrope,system-ui,sans-serif!important}
      #navisuite-popup .ns-tile small{color:#9fb8c2!important;font:600 12.5px/1.3 "DM Sans",system-ui,sans-serif!important}
      #navisuite-popup .ns-tile.ns-wide b{font-size:21px!important}
      #navisuite-popup .ns-grid-small .ns-tile b{font-size:12.5px!important}
      #navisuite-popup .ns-tile>span{flex:0 0 auto!important;width:38px!important;min-width:38px!important;height:38px!important;margin:0!important;padding:0!important;font-family:system-ui,sans-serif!important}
      #navisuite-popup .ns-tile.ns-wide>span{width:46px!important;min-width:46px!important;height:46px!important}
      #navisuite-popup .ns-grid-small .ns-tile>span{width:32px!important;min-width:32px!important;height:32px!important}
      .ns-altre{margin:16px 2px 8px;color:#66818d;font:900 10px/1 Manrope,system-ui,sans-serif;letter-spacing:.16em}
      .ns-grid-main+.ns-grid-small{margin-top:9px}
      .ns-menu-foot{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:14px 18px calc(18px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(126,243,226,.16)}
      .ns-menu-foot a,.ns-menu-foot button{display:flex;align-items:center;justify-content:center;min-height:46px;border:1px solid #285560;border-radius:14px;background:rgba(255,255,255,.05);color:#e8f7f7;text-decoration:none;font:800 14px/1 Manrope,system-ui,sans-serif;cursor:pointer}
      .ns-menu-foot .ns-menu-exit{border-color:rgba(251,113,133,.52);background:rgba(251,113,133,.09);color:#fdb2ba}
      @media(min-width:851px){#navisuite-popup .ns-tile.ns-wide{flex-direction:column!important;align-items:flex-start!important;gap:6px!important}#navisuite-popup .ns-tile.ns-wide b{font-size:17px!important}}
    `;
    document.head.appendChild(style);
    const nome=String(agent?.name||agent?.agente||'').trim().toLowerCase().replace(/(^|[\s'.-])\S/g,c=>c.toUpperCase());
    const qualifica=String(agent?.qualifica||agent?.grado||(window.NaviSharedData?.directory?.()||[]).find(a=>String(a.id)===String(agent?.id))?.qualifica||'');
    const grado=[[/capitano|comandante/i,'Capitano','Cap','#facc15'],[/capo\s*tim|capotim/i,'Capo timoniere','CT','#fb923c'],[/aiuto\s*motorista|aiutomotorista/i,'Aiuto motorista','AM','#3b82f6']].find(([r])=>r.test(qualifica));
    const saluto=`<span class="ns-saluto">${nome?`Ciao ${escapeText(nome)}`:'Menu'}${grado?`<span class="ns-grado" style="--g:${grado[3]}" title="${grado[1]}">${grado[2]}</span>`:''}</span>`;
    const popup=document.createElement('div');
    popup.id='navisuite-popup';
    popup.hidden=true;
    popup.innerHTML=`<section class="ns-menu-dialog" role="dialog" aria-modal="true" aria-label="Menu NaviSuite"><div class="ns-menu-head">${saluto} <button type="button" class="ns-menu-close" aria-label="Chiudi menu">×</button></div><div class="ns-menu-links">${linksHtml}</div><div class="ns-menu-foot"><a href="https://github.com/PapaMike80/NaviSuite" target="_blank" rel="noopener noreferrer">GitHub</a><button type="button" class="ns-menu-exit">Esci</button></div></section>`;
    document.body.appendChild(popup);
    const pastLink=popup.querySelector('[data-turni-main-past]');
    const syncPastLabel=()=>{ const label=pastLink?.querySelector('b'); const source=document.getElementById('togglePastBtn'); if(label)label.textContent=source?.textContent?.replace(/^[^A-Za-zÀ-ÿ]+/,'').trim()||'Mostra passato'; };
    pastLink?.addEventListener('click',event=>{ event.preventDefault(); if(typeof window.togglePastColumns==='function')window.togglePastColumns(); syncPastLabel(); });
    const close=()=>{popup.hidden=true;document.body.classList.remove('ns-menu-open');};
    const open=()=>{syncPastLabel();popup.hidden=false;document.body.classList.add('ns-menu-open');};
    popup.querySelector('.ns-menu-close').addEventListener('click',close);
    popup.addEventListener('click',event=>{if(event.target===popup)close();});
    popup.querySelector('.ns-menu-exit').addEventListener('click',()=>{ if(typeof window.logoutAgent==='function'){window.logoutAgent();return;} localStorage.removeItem('navidiaria.activeAgent'); localStorage.removeItem('naviturni_logged_agent'); location.href='index.html'; });
    const TESTO_CONDIVIDI=["⚓ Scarica *NaviSuite*: il tuo turno e la tua distinta sempre con te","","👉 https://papamike80.github.io/NaviSuite/","","🔑 *Primo accesso*","1. Apri il link e premi *Condividi / Aggiungi alla schermata Home*.","2. Usa il PIN personale che ti è stato consegnato.","3. Il colore del tema e le funzioni si adattano al tuo ruolo."];
    const IMG_LOCANDINA='assets/images/navisuite-locandina.png';
    const apriCondividi=()=>{ close(); let box=document.getElementById('ns-condividi'); if(!box){ box=document.createElement('div');box.id='ns-condividi'; box.style.cssText='position:fixed;inset:0;z-index:10001;display:grid;place-items:center;padding:calc(12px + env(safe-area-inset-top,0px)) 12px 12px;background:rgba(2,12,17,.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)'; box.innerHTML=`<div style="position:relative;width:min(420px,100%);max-height:100%;display:flex;flex-direction:column;gap:10px"><button type="button" data-chiudi aria-label="Chiudi" style="position:absolute;top:8px;right:8px;width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(0,0,0,.28);color:#fff;font-size:28px;line-height:1;cursor:pointer;z-index:1">×</button><img src="${IMG_LOCANDINA}" alt="Locandina NaviSuite" style="width:100%;border-radius:18px;display:block"><div style="background:#fff;border-radius:18px;padding:14px 14px 8px;box-shadow:0 20px 60px rgba(0,0,0,.4)"><div style="display:grid;gap:6px;color:#0f1720;font:600 14px/1.45 Inter,system-ui,sans-serif;white-space:pre-wrap">${TESTO_CONDIVIDI.map(line=>line).join('\n')}</div></div></div>`; document.body.appendChild(box); box.addEventListener('click',e=>{if(e.target===box||e.target.closest('[data-chiudi]'))box.hidden=true;}); } box.hidden=false; };
    popup.querySelector('[data-ns-condividi]')?.addEventListener('click',event=>{event.preventDefault();apriCondividi();});
    window.NaviSuiteMenu={open,close,condividi:apriCondividi};
    const host=document.querySelector('.page-header,.archive-header,.diaria-header,main>header,body.impostazioni-page>header');
    const floating=!host&&(file==='quiz.html'||file==='cambia-pin.html');
    if(host||floating){ const button=document.createElement('button'); button.type='button';button.id='navisuite-header-menu';button.setAttribute('aria-label','Apri menu');button.textContent='☰'; button.style.cssText=`position:${floating?'fixed':'absolute'};right:12px;top:${floating?'calc(12px + env(safe-area-inset-top,0px))':'12px'};z-index:${floating?9000:30};width:44px;height:44px;border:1px solid rgba(45,212,191,.5);border-radius:13px;background:#103a3d;color:#a7fff0;font-size:25px;font-weight:900;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.24)`; if(host){host.style.position=host.style.position||'relative';host.appendChild(button);} else document.body.appendChild(button); button.addEventListener('click',open); }
  }
  const sidebar=document.querySelector('.app-sidebar');
  if(!sidebar){ const file=(location.pathname.split('/').pop()||'').toLowerCase(); if(sessionAgent?.id&&(file==='quiz.html'||file==='cambia-pin.html'))setTimeout(()=>installUnifiedMenu(sessionAgent),0); return; }
  if('serviceWorker' in navigator){ if(!window.__naviSwRegistrationPromise){ window.__naviSwRegistrationPromise=navigator.serviceWorker.register('sw.js?menu=171').then(registration=>{ if(registration&&typeof registration.update==='function')registration.update().catch(()=>{}); return registration; }).catch(()=>null); } }
  const page=document.body.classList.contains('oggi-page')?'oggi':document.body.classList.contains('impostazioni-page')?'settings':document.body.classList.contains('trova-turno-page')?'trova':document.body.classList.contains('diaria-page')?'diaria':document.body.classList.contains('archive-page')?'archive':document.body.classList.contains('agenti-page')?'agenti':document.body.classList.contains('aggiornamenti-page')?'aggiornamenti':document.body.classList.contains('movimento-page')?'movimento':document.body.classList.contains('terra-page')?'terra':document.body.classList.contains('mio-turno-page')?'mioturno':'turni';
  const Roles=window.NaviRoles||{ isAdminAgent:agent=>['91','92'].includes(String(agent?.id||''))||String(agent?.role||'').toLowerCase()==='admin', isBaristaAgent:agent=>String(agent?.role||'').toLowerCase()==='barista'||String(agent?.qualifica||'').toLowerCase()==='barista', isHibaBarista:agent=>String(agent?.id||'').toUpperCase()==='BARISTA_HIBA'||((String(agent?.role||'').toLowerCase()==='barista'||String(agent?.qualifica||'').toLowerCase()==='barista')&&String(agent?.id||'').toUpperCase()==='HIBA') };
  const isAdminAgent=agent=>Roles.isAdminAgent(agent);
  const canUseDiaria=agent=>Boolean(String(agent?.id||'').trim());
  const isBaristaAgent=agent=>Roles.isBaristaAgent(agent);
  const isHibaBarista=agent=>Roles.isHibaBarista(agent);
  const isBaristaSession=isBaristaAgent(sessionAgent);
  const isLightThemeTester=['91','AG_PEDRONI_M'].includes(String(sessionAgent?.id||'').toUpperCase())||/\bPEDRONI\b/i.test(String(sessionAgent?.name||sessionAgent?.agente||sessionAgent?.cognome||''));
  const themeKey='navisuite.theme.'+String(sessionAgent?.id||'');
  const currentTheme=()=>isLightThemeTester&&localStorage.getItem(themeKey)==='light'?'light':'dark';
  function applyTheme(){ const light=currentTheme()==='light'; document.documentElement.classList.toggle('navisuite-light',light); document.body.classList.toggle('navisuite-light',light); if(light)document.documentElement.dataset.theme='light';else delete document.documentElement.dataset.theme; }
  function installLightTheme(){ if(document.getElementById('navisuite-light-theme-style'))return; const style=document.createElement('style');style.id='navisuite-light-theme-style'; style.textContent='html.navisuite-light{color-scheme:light}html.navisuite-light body{background:#edf5f6!important;color:#17323a!important}html.navisuite-light .app-sidebar{background:#ffffff!important;border-color:#d6e7ea!important}'; document.head.appendChild(style); const loadingStyle=document.createElement('style');loadingStyle.id='navisuite-light-loading-style'; loadingStyle.textContent='html.navisuite-light #welcome-notice{background:#fff!important;border-color:#83c9c2!important;color:#17323a!important;box-shadow:0 6px 20px rgba(22,56,66,.1)!important}'; document.head.appendChild(loadingStyle); }
  installLightTheme();applyTheme();
  if(currentTheme()==='light'){ const menuToggleLight=document.createElement('style'); menuToggleLight.textContent='html.navisuite-light .sidebar-collapse-button{background:#fff!important;border-color:#9fc4ca!important;color:#176b87!important;box-shadow:6px 0 16px rgba(22,56,66,.08)!important}'; document.head.appendChild(menuToggleLight); }
  if(!sessionAgent){ document.documentElement.style.display='none'; location.replace('index.html'); return; }
  if((page==='agenti'||page==='aggiornamenti'||page==='movimento')&&!isAdminAgent(sessionAgent)&&!(page==='aggiornamenti'&&isHibaBarista(sessionAgent))){location.replace('index.html');return}
  if(window.NaviAdminFirebase?.touchUserPresence){ const signalPresence=()=>window.NaviAdminFirebase.touchUserPresence(sessionAgent).catch(()=>{}); signalPresence(); setInterval(signalPresence,45000); document.addEventListener('visibilitychange',()=>{if(!document.hidden)signalPresence();}); }
  try{ if(!localStorage.getItem('navidiaria.activeAgent'))localStorage.setItem('navidiaria.activeAgent',JSON.stringify(sessionAgent)); if(!localStorage.getItem('naviturni_logged_agent'))localStorage.setItem('naviturni_logged_agent',JSON.stringify({ id:sessionAgent.id, name:sessionAgent.name||sessionAgent.agente||sessionAgent.cognome||'', residence:sessionAgent.residence||sessionAgent.residenza||'', qualifica:sessionAgent.qualifica||'', role:sessionAgent.role||'' })); }catch{}
  if(isBaristaSession&&(page==='aggiornamenti'||page==='oggi')&&!isHibaBarista(sessionAgent)){location.replace('naviturni.html');return}
  const item=(href,icon,label,active=false,id='')=>`<a ${id?`id="${id}" `:''}class="nav-link${active?' active':''}" href="${href}"${['competencyNav','adminNav','archiveAdminNav'].includes(id)?' hidden':''}>${icon} ${label}</a>`;
  let common='',specific='',user='',status='<div id="odsVariationStatus" class="ods-variation-status" hidden></div>';
  common=(()=>{ const activeHref={oggi:'oggi.html',turni:'naviturni.html',trova:'cambi_turno.html',diaria:'navidiaria.html',archive:'documenti.html',terra:'orario.html',mioturno:'mio-turno.html',orario:'orario.html'}[page]||''; const selfAnchor={'oggi.html':'#oggi','naviturni.html':'#turni-operativi','cambi_turno.html':'#turni-operativi','navidiaria.html':'#oggi','documenti.html':'#turni-docs'}; return [['index.html?home=1','⌂','Home',''],['mio-turno.html','⚑','Il mio turno','mioTurnoNavLink'],['orario.html','⚓','Scali','orarioNavLink'],['oggi.html','☀','Oggi','oggiNav'],['naviturni.html','▦','NaviTurni',''],['navidiaria.html','≈','Distinta','diariaNavLink'],['documenti.html','▤','Documenti','archiveNavLink'],['impostazioni.html','⚙','Impostazioni',''],['cambi_turno.html','⇄','Cambio turno','trovaTurnoNavLink']].map(([href,icon,label,id])=>{ const active=href===activeHref; return item(active&&selfAnchor[href]?selfAnchor[href]:href,icon,label,active,id); }).join(''); })();
  if(page==='oggi'){ specific='<span class="sidebar-menu-label">GIORNATA</span>'; user=`<div class="sidebar-user-actions login-user-panel" id="login-user-panel"><button id="refreshBtn" class="sidebar-footer-update" onclick="window.NaviOggi?.refresh?.()" type="button"><span>↻</span>Aggiorna</button><button class="sidebar-action sidebar-exit" id="logoutBtn" type="button">Esci</button></div>`; }else if(page==='diaria'){ specific=`<span class="sidebar-menu-label">DIARIA</span>${item('#registro','≡','Registro mese')}${item('#consultivo','≈','Consultivo settimane')}${item('#competenze','◇','Competenze',false,'competencyNav')}`; user=`<div class="sidebar-user-actions"><button id="syncShifts" class="sidebar-footer-update" type="button"><span>↻</span>Aggiorna</button><small id="syncStatus" class="sidebar-data-status"></small><button class="sidebar-action sidebar-exit" id="logoutBtn" type="button">Esci</button></div>`; }else if(page==='trova'){ specific=`<div hidden aria-hidden="true"><button id="togglePastBtn" type="button"></button><div id="shift-filter-container"><div id="top-residence-buttons"></div><div id="shift-buttons-wrapper"></div></div></div>`; user=`<div class="sidebar-user-actions login-user-panel" id="login-user-panel"><button id="refreshBtn" class="sidebar-footer-update" onclick="ricaricaDati()" type="button"><span>↻</span>Aggiorna</button><button class="sidebar-action sidebar-exit" id="logoutBtn" type="button">Esci</button></div>`; }else if(page==='turni'){ specific=`<span class="sidebar-menu-label">TURNI</span><button id="togglePastBtn" class="nav-link sidebar-nav-button" onclick="togglePastColumns()" type="button"><span>◷</span>Mostra passato</button>`; user=`<div class="sidebar-user-actions login-user-panel" id="login-user-panel"><button id="refreshBtn" class="sidebar-footer-update" onclick="ricaricaDati()" type="button"><span>↻</span>Aggiorna</button><button class="sidebar-action sidebar-exit" id="logoutBtn" type="button">Esci</button></div>`; }else if(page==='terra'||page==='mioturno'||page==='orario'){ user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button></div>`; }else if(page==='settings'){ specific=isAdminAgent(sessionAgent)?`<span class="sidebar-menu-label">PREFERENZE</span>${item('aggiornamenti.html','↻','Aggiornamenti turni')}${item('agenti.html','♙','Gestione agenti')}`:''; user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button></div>`; }else if(page==='agenti'||page==='aggiornamenti'||page==='movimento'){ specific=`<span class="sidebar-menu-label">AMMINISTRAZIONE</span>${item('aggiornamenti.html','↻','Aggiornamenti turni',page==='aggiornamenti','aggiornamentiNav')}${item('agenti.html','♙','Gestione agenti',page==='agenti','agentiNav')}${item('movimento.html','⚓','Movimento',page==='movimento','movimentoNav')}`; user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button></div>`; }else{ specific=`<span class="sidebar-menu-label">DOCUMENTI</span>${item('#turni-docs','▦','Turni e bozze')}${item('#ods-docs','≡','ODS 2026')}${item('#terra-docs','⛴','Servizi a terra')}${item('#altro-docs','…','Altro')}`; user=`<div class="sidebar-user-actions"><button class="sidebar-footer-update" type="button" onclick="typeof loadDocuments==='function'?loadDocuments():location.reload()"><span>↻</span>Aggiorna</button><button class="sidebar-action sidebar-exit" id="logoutBtn" type="button">Esci</button></div>`; }
  if(isAdminAgent(sessionAgent)&&page!=='settings'&&page!=='agenti'&&page!=='aggiornamenti'&&page!=='movimento'){ common+=item('aggiornamenti.html','↻','Aggiornamenti'); common+=item('agenti.html','♙','Agenti'); common+=item('movimento.html','⚓','Movimento'); }
  const brandTitle=page==='oggi'?'NaviSuite Oggi':page==='diaria'?'NaviSuite Diaria':page==='trova'?'NaviSuite Cambi':page==='turni'?'NaviSuite Turni':page==='settings'?'NaviSuite Impostazioni':page==='archive'?'NaviSuite Documenti':page==='agenti'?'NaviSuite Agenti':page==='aggiornamenti'?'NaviSuite Aggiornamenti':page==='movimento'?'NaviSuite Movimento':'NaviSuite';
  const version=`<div class="shared-app-version" aria-label="Versione applicazione">Versione ${APP_VERSION}</div>`;
  const brandHref=isBaristaSession?(page==='turni'?'#turni-operativi':'naviturni.html'):'index.html';
  sidebar.innerHTML=`<a class="shared-sidebar-brand" href="${brandHref}"><span class="shared-brand-mark">N</span><strong>${brandTitle}</strong></a><nav>${common}${specific}</nav>${user}${status}${version}`;
  if(Roles.isScaloAgent?.(sessionAgent)){ document.body.classList.add('scalo-session'); const style=document.createElement('style'); const aperte=(Roles.pagineAperte?.(sessionAgent)||['orario.html']).map(f=>`:not([href^="${f}"])`).join(''); style.textContent=`body.scalo-session nav a${aperte},`+'body.scalo-session nav button,body.scalo-session nav .sidebar-menu-label,body.scalo-session nav .shifts-filter-block{display:none!important}'; document.head.appendChild(style); }
  if(!canUseDiaria(sessionAgent))sidebar.querySelectorAll('a[href="navidiaria.html"],#diariaNavLink').forEach(link=>link.hidden=true);
  setTimeout(()=>installUnifiedMenu(sessionAgent),0);
  function installThemeSettings(){ if(page!=='settings'||!isLightThemeTester||document.getElementById('theme-test-setting'))return; const main=document.querySelector('main');if(!main)return; const section=document.createElement('section');section.id='theme-test-setting';section.className='section'; section.innerHTML='<div class="section-head"><div><h2>Tema grafico <small style="color:#2dd4bf">· prova personale</small></h2><p>Questa scelta è visibile e applicata solo al tuo profilo di test. Si memorizza sul dispositivo.</p></div></div><div class="section-body"><label for="theme-select">Seleziona tema</label><select id="theme-select"><option value="dark">Scuro</option><option value="light">Chiaro</option></select></div>'; const target=main.querySelector('.section');if(target)main.insertBefore(section,target);else main.appendChild(section); const select=section.querySelector('select');select.value=currentTheme(); select.addEventListener('change',()=>{localStorage.setItem(themeKey,select.value);applyTheme();}); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installThemeSettings,{once:true});else installThemeSettings();
  const settingsAgent=sidebar.querySelector('#settingsSidebarAgent'); if(settingsAgent) settingsAgent.textContent=String(sessionAgent?.name||sessionAgent?.cognome||'AGENTE').toLocaleUpperCase('it');
  const settingsLogout=sidebar.querySelector('#settingsLogout'); if(settingsLogout)settingsLogout.addEventListener('click',()=>{ localStorage.removeItem('navidiaria.activeAgent'); localStorage.removeItem('naviturni_logged_agent'); location.href='index.html'; });
  const versionEl=sidebar.querySelector('.shared-app-version'); if(versionEl){ versionEl.style.cssText='margin:10px 12px 8px;padding-top:10px;border-top:1px solid rgba(124,173,189,.18);color:#19e3c1;font-size:11px;font-weight:700;letter-spacing:.04em;text-align:center'; }
  document.body.classList.add('menu-collapsed');
})();
(() => { const style=document.createElement('style'); style.textContent='@keyframes ns-navigation-pulse{0%,100%{opacity:1;filter:none}50%{opacity:.52;filter:brightness(1.35)}}.ns-navigation-pending{pointer-events:none!important;animation:ns-navigation-pulse .55s ease-in-out 1}'; document.head.appendChild(style); document.addEventListener('click',event=>{ const link=event.target.closest('a[href]'); if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return; const href=link.getAttribute('href')||''; if(!href||href[0]==='#'||/^javascript:/i.test(href))return; link.classList.add('ns-navigation-pending'); link.setAttribute('aria-busy','true'); },true); })();
