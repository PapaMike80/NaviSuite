/* NaviSuite - menu mobile unico, pensato per iPhone. */
(() => {
  'use strict';
  const BAR='navisuite-mobile-menu', SHEET='navisuite-mobile-menu-sheet';
  const OLD='.mobile-liquid-nav,.admin-mobile-nav,.mobile-nav,.hiba-mobile-nav,.hiba-updates-mobile-nav,.navisuite-mobile-nav';
  const icon={home:'⌂',turni:'▦',swap:'⇄',diaria:'◫',docs:'▤',menu:'☰',navi:'⛴',settings:'⚙',updates:'↻',agents:'♙',clock:'◷',pin:'⌁',logout:'⇥',residence:'⌖',notice:'✉',close:'×',next:'›'};
  const glyph=n=>'<span class="ns-icon" aria-hidden="true">'+icon[n]+'</span>';
  const account=()=>{try{return JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch(_){return null}};
  const isAdmin=p=>['91','92'].includes(String(p?.id||''))||String(p?.role||'').toLowerCase()==='admin';
  const isHiba=p=>String(p?.id||'').toUpperCase()==='BARISTA_HIBA'||(String(p?.role||'').toLowerCase()==='barista'&&String(p?.name||p?.agente||p?.cognome||'').trim().toUpperCase()==='HIBA');

  function css(){
    if(document.getElementById('navisuite-mobile-menu-style'))return;
    const s=document.createElement('style');s.id='navisuite-mobile-menu-style';
    s.textContent=OLD+','+OLD+'[hidden]{display:none!important;visibility:hidden!important;pointer-events:none!important}#'+BAR+',#'+SHEET+'{display:none}@media(max-width:850px){body{padding-bottom:calc(98px + env(safe-area-inset-bottom,0px))!important}#'+BAR+'{position:fixed;z-index:2147483000;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(5,minmax(0,1fr));height:72px;padding:5px;border:1px solid rgba(170,218,222,.26);border-radius:25px;background:rgba(10,35,46,.95);box-shadow:0 18px 38px rgba(2,17,23,.38),inset 0 1px rgba(255,255,255,.10);backdrop-filter:blur(18px);box-sizing:border-box;transition:transform .22s ease;touch-action:manipulation}#'+BAR+'.is-hidden{transform:translateY(calc(100% + 25px))}#'+BAR+' a,#'+BAR+' button{display:flex;min-width:0;align-items:center;justify-content:center;flex-direction:column;gap:3px;padding:4px 1px;border:0;border-radius:19px;background:transparent;color:#b7cbd0;text-decoration:none;font:800 9px/1.1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;cursor:pointer;-webkit-appearance:none;appearance:none}#'+BAR+' .ns-icon{font:400 24px/22px -apple-system,BlinkMacSystemFont,Segoe UI Symbol,sans-serif}#'+BAR+' a.active{background:linear-gradient(145deg,rgba(45,212,191,.28),rgba(45,212,191,.08));color:#a7fff2;box-shadow:inset 0 0 0 1px rgba(85,237,216,.18)}#'+BAR+' a:active,#'+BAR+' button:active{transform:scale(.95);background-color:rgba(45,212,191,.16)}#'+SHEET+'{position:fixed;inset:0;z-index:2147483001;display:grid;align-items:end;background:rgba(1,14,20,.55);opacity:0;transition:opacity .2s ease}#'+SHEET+'[hidden]{display:none!important}#'+SHEET+'.is-open{opacity:1}#'+SHEET+' .ns-sheet{max-height:min(76dvh,620px);overflow:auto;padding:10px 14px calc(16px + env(safe-area-inset-bottom,0px));border:1px solid rgba(167,211,217,.25);border-bottom:0;border-radius:27px 27px 0 0;background:#102d39;color:#edf9fb;box-shadow:0 -14px 36px rgba(0,0,0,.31);transform:translateY(22px);transition:transform .2s ease}#'+SHEET+'.is-open .ns-sheet{transform:translateY(0)}#'+SHEET+' .ns-grabber{width:38px;height:4px;margin:0 auto 12px;border-radius:999px;background:rgba(211,239,241,.32)}#'+SHEET+' header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}#'+SHEET+' h2{margin:0;color:#f1ffff;font:800 19px/1.1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}#'+SHEET+' .ns-close{width:38px;height:38px;border:1px solid rgba(174,219,224,.3);border-radius:50%;background:rgba(255,255,255,.06);color:#d8f3f3;font-size:24px}#'+SHEET+' .ns-caption{display:block;margin:16px 2px 7px;color:#93b7bd;font:800 10px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:.1em;text-transform:uppercase}#'+SHEET+' .ns-list{overflow:hidden;border:1px solid rgba(160,207,212,.19);border-radius:17px;background:rgba(3,22,30,.34)}#'+SHEET+' .ns-action{display:grid;grid-template-columns:28px 1fr 18px;align-items:center;gap:9px;width:100%;min-height:51px;padding:9px 12px;border:0;border-bottom:1px solid rgba(160,207,212,.14);background:transparent;color:#effbfc;text-align:left;text-decoration:none;font:750 14px/1.15 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-sizing:border-box}#'+SHEET+' .ns-action:last-child{border-bottom:0}#'+SHEET+' .ns-action .ns-icon{font-size:20px;color:#64e1d0}#'+SHEET+' .ns-arrow{color:#82a8ae;font-size:22px;text-align:right}#'+SHEET+' .ns-action:active{background:rgba(45,212,191,.14)}#'+SHEET+' .is-danger{color:#ffdce1!important}#'+SHEET+' .is-danger .ns-icon{color:#ff99a8!important}#'+SHEET+' .ns-residences{display:grid;grid-template-columns:1fr 1fr;gap:8px}#'+SHEET+' .ns-residence{display:flex;align-items:center;gap:8px;min-height:46px;padding:9px 10px;border:1px solid var(--c);border-radius:14px;background:var(--b);color:var(--c);font-weight:800}#'+SHEET+' .ns-residence.active{box-shadow:inset 0 0 0 2px var(--c)}html.navisuite-light #'+BAR+'{background:rgba(255,255,255,.96);border-color:#c3dfe2;box-shadow:0 12px 30px rgba(22,58,66,.18)}html.navisuite-light #'+BAR+' a,html.navisuite-light #'+BAR+' button{color:#49656b}html.navisuite-light #'+BAR+' a.active{color:#087b6e;background:#daf7f1}html.navisuite-light #'+SHEET+'{background:rgba(20,51,59,.28)}html.navisuite-light #'+SHEET+' .ns-sheet{background:#f8ffff;color:#17323a;border-color:#b6d8dc}html.navisuite-light #'+SHEET+' h2{color:#17323a}html.navisuite-light #'+SHEET+' .ns-list{background:#fff;border-color:#c5e0e3}html.navisuite-light #'+SHEET+' .ns-action{color:#17323a;border-color:#d8eaec}html.navisuite-light #'+SHEET+' .ns-caption{color:#58767c}}';
    document.head.appendChild(s);
  }

  function install(){
    css();document.querySelectorAll(OLD).forEach(el=>{el.hidden=true;el.style.setProperty('display','none','important')});document.getElementById(BAR)?.remove();document.getElementById(SHEET)?.remove();
    const person=account(),path=location.pathname.toLowerCase(),turns=path.endsWith('naviturni.html'),active=f=>path.endsWith(f);
    const navItem=(href,name,label,on)=>'<a href="'+href+'" class="'+(on?'active':'')+'">'+glyph(name)+'<b>'+label+'</b></a>';
    const bar=document.createElement('nav');bar.id=BAR;bar.setAttribute('aria-label','Navigazione principale');
    bar.innerHTML=navItem('naviturni.html','turni','Turni',turns)+navItem('cambi_turno.html','swap','Cambio',active('cambi_turno.html'))+navItem('navidiaria.html','diaria','Diaria',active('navidiaria.html'))+navItem('documenti.html','docs','Documenti',active('documenti.html'))+'<button type="button" data-menu aria-expanded="false">'+glyph('menu')+'<b>Menu</b></button>';document.body.appendChild(bar);
    const overlay=document.createElement('div');overlay.id=SHEET;overlay.hidden=true;document.body.appendChild(overlay);const trigger=bar.querySelector('[data-menu]');
    const close=()=>{overlay.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');setTimeout(()=>{if(!overlay.classList.contains('is-open'))overlay.hidden=true},200)};
    const action=(href,name,label,danger)=>href?'<a class="ns-action '+(danger?'is-danger':'')+'" href="'+href+'">'+glyph(name)+'<span>'+label+'</span><i class="ns-arrow">'+icon.next+'</i></a>':'<button type="button" class="ns-action '+(danger?'is-danger':'')+'" data-action="'+name+'">'+glyph(name)+'<span>'+label+'</span><i class="ns-arrow">'+icon.next+'</i></button>';
    const bind=()=>{overlay.querySelector('[data-close]')?.addEventListener('click',close);overlay.querySelector('[data-action="residence"]')?.addEventListener('click',residences);overlay.querySelector('[data-action="clock"]')?.addEventListener('click',()=>{window.togglePastColumns?.();render()});overlay.querySelector('[data-action="updates"]')?.addEventListener('click',()=>{close();if(typeof window.ricaricaDati==='function')window.ricaricaDati();else if(typeof window.loadDocuments==='function')window.loadDocuments();else location.reload()});overlay.querySelector('[data-action="logout"]')?.addEventListener('click',()=>{if(typeof window.logoutAgent==='function')return window.logoutAgent();localStorage.removeItem('navidiaria.activeAgent');localStorage.removeItem('naviturni_logged_agent');location.href='index.html'})};
    const render=()=>{const page=[];if(turns)page.push(action(null,'residence','Cambia residenza'),action(null,'clock',document.getElementById('togglePastBtn')?.textContent.replace(/^[^A-Za-zÀ-ÿ]+/,'').trim()||'Mostra passato'));page.push(action(null,'updates','Aggiorna dati'));const app=[action('index.html','home','Home'),action('segnalazioni.html','notice','Segnalazioni')];if(isAdmin(person))app.push(action('gestione_navi.html','navi','Navi'),action('impostazioni.html','settings','Impostazioni'));if(isAdmin(person)||isHiba(person))app.push(action('aggiornamenti.html','updates','Aggiornamenti'));if(isAdmin(person))app.push(action('agenti.html','agents','Agenti'),action('Orario.html','clock','Orario'));overlay.innerHTML='<section class="ns-sheet" role="dialog" aria-modal="true"><div class="ns-grabber"></div><header><h2>Menu</h2><button type="button" class="ns-close" data-close aria-label="Chiudi">'+icon.close+'</button></header><span class="ns-caption">Questa pagina</span><div class="ns-list">'+page.join('')+'</div><span class="ns-caption">NaviSuite</span><div class="ns-list">'+app.join('')+'</div><span class="ns-caption">Account</span><div class="ns-list">'+action('navidiaria.html?pin=1','pin','Cambia PIN')+action(null,'logout','Esci',true)+'</div></section>';bind()};
    const residences=()=>{const source=[...document.querySelectorAll('#top-residence-buttons button')],palette={DESENZANO:['#0497c9','#e2f6fd'],MADERNO:['#c77700','#fff1d9'],PESCHIERA:['#20834b','#e2f7e9'],RIVA:['#6952bd','#eeeaff']};const cards=source.map((b,i)=>({b,i})).filter(x=>x.b.textContent.trim().toUpperCase()!=='TUTTE').map(x=>{const label=x.b.textContent.trim(),p=palette[label.toUpperCase()]||['#32d5c0','rgba(45,212,191,.14)'];return '<button class="ns-residence '+(x.b.classList.contains('active')?'active':'')+'" data-residence="'+x.i+'" style="--c:'+p[0]+';--b:'+p[1]+'">'+glyph('residence')+'<span>'+label+'</span></button>'}).join('');overlay.innerHTML='<section class="ns-sheet" role="dialog" aria-modal="true"><div class="ns-grabber"></div><header><h2>Residenza</h2><button type="button" class="ns-close" data-close aria-label="Chiudi">'+icon.close+'</button></header><span class="ns-caption">Mostra i turni di</span><div class="ns-residences">'+cards+'</div></section>';overlay.querySelector('[data-close]')?.addEventListener('click',close);overlay.querySelectorAll('[data-residence]').forEach(el=>el.addEventListener('click',()=>{source[Number(el.dataset.residence)]?.click();close()}))};
    trigger.addEventListener('click',()=>{if(!overlay.hidden)return close();render();overlay.hidden=false;requestAnimationFrame(()=>overlay.classList.add('is-open'));trigger.setAttribute('aria-expanded','true');bar.classList.remove('is-hidden')});overlay.addEventListener('click',e=>{if(e.target===overlay)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
    let last=0;const scroll=()=>{const now=Math.max(0,document.scrollingElement?.scrollTop||0);if(now<20||now<last-5)bar.classList.remove('is-hidden');else if(now>last+12&&overlay.hidden)bar.classList.add('is-hidden');last=now};window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('scroll',scroll,{passive:true,capture:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Durante il pinch zoom Safari mantiene la pagina scalata, ma questa barra resta
   disegnata con le sue misure fisiche normali nella viewport effettivamente visibile. */
(() => {
  const install = () => {
    const bar = document.getElementById('navisuite-mobile-menu');
    const vv = window.visualViewport;
    if (!bar || !vv) return;
    const style = document.createElement('style');
    style.textContent = '#navisuite-mobile-menu{--ns-zoom:1;transform:scale(var(--ns-zoom))!important;transform-origin:bottom left!important}#navisuite-mobile-menu.is-hidden{transform:scale(var(--ns-zoom)) translateY(calc(100% + 25px))!important}';
    document.head.appendChild(style);
    const clear = () => ['left','right','top','bottom','width','height','zoom','--ns-zoom'].forEach(p => bar.style.removeProperty(p));
    const sync = () => {
      if (innerWidth > 850 || vv.scale <= 1.01) return clear();
      const scale = vv.scale;
      /* Nessuna coordinata manuale: position:fixed resta ancorato al bordo basso
         della viewport Safari. Correggiamo soltanto l'ingrandimento del pinch. */
      ['left','right','top','bottom','width','height','zoom'].forEach(p => bar.style.removeProperty(p));
      bar.style.removeProperty('zoom');
      bar.style.setProperty('--ns-zoom', String(1 / scale));
    };
    vv.addEventListener('resize', sync, {passive:true});
    vv.addEventListener('scroll', sync, {passive:true});
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();


/* Feedback immediato: la voce selezionata resta visibile durante la navigazione. */
(() => {
  const style=document.createElement('style');
  style.textContent='@keyframes ns-navigation-pulse{0%,100%{opacity:1;filter:none}50%{opacity:.52;filter:brightness(1.35)}}.ns-navigation-pending{pointer-events:none!important;animation:ns-navigation-pulse .72s ease-in-out infinite!important;outline:2px solid rgba(90,245,221,.8)!important;outline-offset:-2px!important;background:rgba(45,212,191,.24)!important;color:#d9fffb!important}';
  document.head.appendChild(style);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
    const href=link.getAttribute('href')||'';
    if(!href||href[0]==='#'||/^javascript:/i.test(href))return;
    link.classList.add('ns-navigation-pending');
    link.setAttribute('aria-busy','true');
  },true);
})();
