/*
 * Service Worker NaviSuite - hotfix minimo Diaria.
 *
 * Non usa cache. Intercetta solo gli script che hanno causato blocchi:
 * - navidiaria-monthly.js: rimuove il MutationObserver globale dei ticket;
 * - shared-menu.js: aggiunge fallback colori e isola le classi del popup;
 * - shared-menu.css: forza il ricaricamento delle correzioni del menu mobile;
 * - orario-lucide-init.js: forza il ricaricamento del pulsante menu in Orario.
 */

const CACHE_VERSION = 'navisuite-v197-left-menu';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function js(text) {
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

function css(text) {
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/NaviSuite/assets/css/shared-menu.css') {
    event.respondWith((async () => {
      const response = await fetch(event.request, { cache: 'reload' });
      let text = await response.text();
      text += `

/* Android Turni/Cambi: resa simile a Impostazioni, pannello stretto allineato a sinistra. */
@media(max-width:850px){
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup{
    overflow:hidden!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-dialog{
    position:fixed!important;
    top:10px!important;
    bottom:10px!important;
    left:12px!important;
    right:auto!important;
    width:clamp(180px,56vw,240px)!important;
    height:auto!important;
    min-width:0!important;
    max-width:calc(100vw - 24px)!important;
    max-height:none!important;
    margin:0!important;
    transform:none!important;
    box-sizing:border-box!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-head,
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot{
    flex:0 0 auto!important;
    min-width:0!important;
    width:100%!important;
    box-sizing:border-box!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-head{
    padding:12px 10px 8px!important;
    font-size:20px!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-close{
    flex:0 0 36px!important;
    width:36px!important;
    min-width:36px!important;
    height:36px!important;
    margin:0!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-links{
    display:grid!important;
    flex:1 1 auto!important;
    min-height:0!important;
    width:100%!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    gap:6px!important;
    padding:0 9px 9px!important;
    box-sizing:border-box!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-links a{
    display:flex!important;
    flex:0 0 44px!important;
    align-items:center!important;
    justify-content:flex-start!important;
    gap:9px!important;
    width:100%!important;
    height:44px!important;
    min-height:44px!important;
    max-height:44px!important;
    margin:0!important;
    padding:0 10px!important;
    box-sizing:border-box!important;
    border-radius:12px!important;
    font-size:13px!important;
    line-height:1!important;
    transform:none!important;
    overflow:hidden!important;
    white-space:nowrap!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-links a span{
    flex:0 0 18px!important;
    width:18px!important;
    font-size:17px!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot{
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    gap:6px!important;
    padding:8px 9px calc(8px + env(safe-area-inset-bottom,0px))!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot a,
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot button{
    min-width:0!important;
    min-height:40px!important;
    padding:0 4px!important;
    font-size:11px!important;
  }
}
`;
      return css(text);
    })());
    return;
  }

  if (url.pathname === '/NaviSuite/assets/js/orario-lucide-init.js') {
    event.respondWith(fetch(event.request, { cache: 'reload' }));
    return;
  }

  if (url.pathname === '/NaviSuite/assets/js/navidiaria-monthly.js') {
    event.respondWith((async () => {
      const response = await fetch(event.request, { cache: 'reload' });
      let text = await response.text();
      text = text.replace(
        "new MutationObserver(fix).observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(fix,0)",
        "document.addEventListener('navidiaria:render',()=>setTimeout(fix,0));setTimeout(fix,0)"
      );
      return js(text);
    })());
    return;
  }

  if (url.pathname === '/NaviSuite/assets/js/shared-menu.js') {
    event.respondWith((async () => {
      const response = await fetch(event.request, { cache: 'reload' });
      let text = await response.text();
      text = text.replace(
        "const palette=type==='residence'\n        ? residenceColors[raw]\n        : shiftColors[raw] || ['#94a3b8','rgba(148,163,184,.13)'];",
        "const palette=(type==='residence'\n        ? residenceColors[raw]\n        : shiftColors[raw]) || ['#2dd4bf','rgba(45,212,191,.13)'];"
      );
      text = text.replace(
        "links.forEach(link=>{const clone=link.cloneNode(true);clone.innerHTML=clone.innerHTML.replace(/NaviDiaria/g,'Distinta');if(/navidiaria\\.html/.test(clone.getAttribute('href')||''))clone.setAttribute('aria-label','Apri Distinta');target.appendChild(clone);});",
        "links.forEach(link=>{const clone=link.cloneNode(true);clone.className=link.classList.contains('active')?'active':'';clone.removeAttribute('id');clone.removeAttribute('style');clone.innerHTML=clone.innerHTML.replace(/NaviDiaria/g,'Distinta');if(/navidiaria\\.html/.test(clone.getAttribute('href')||''))clone.setAttribute('aria-label','Apri Distinta');target.appendChild(clone);});"
      );
      return js(text);
    })());
  }
});
