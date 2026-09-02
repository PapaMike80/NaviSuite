/*
 * Service Worker NaviSuite - hotfix minimo Diaria.
 *
 * Non usa cache. Intercetta solo gli script che hanno causato blocchi:
 * - navidiaria-monthly.js: rimuove il MutationObserver globale dei ticket;
 * - shared-menu.js: aggiunge fallback colori se manca una residenza;
 * - shared-menu.css: forza il ricaricamento delle correzioni del menu mobile;
 * - orario-lucide-init.js: forza il ricaricamento del pulsante menu in Orario.
 */

const CACHE_VERSION = 'navisuite-v195-turni-cambi-menu';

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

/* Android Turni/Cambi: menu compatto, centrato e con chiusura/footer sempre visibili. */
@media(max-width:850px){
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup{
    overflow:hidden!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-dialog{
    top:max(10px,env(safe-area-inset-top,0px))!important;
    left:50%!important;
    right:auto!important;
    width:calc(100vw - 36px)!important;
    max-width:360px!important;
    min-width:0!important;
    max-height:calc(100dvh - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important;
    margin:0!important;
    transform:translateX(-50%)!important;
    box-sizing:border-box!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-head,
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot{
    flex:0 0 auto!important;
    min-width:0!important;
    box-sizing:border-box!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-head{
    padding:14px 14px 10px!important;
    font-size:22px!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-close{
    flex:0 0 40px!important;
    width:40px!important;
    min-width:40px!important;
    height:40px!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-links{
    flex:1 1 auto!important;
    min-height:0!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    gap:6px!important;
    padding:0 12px 10px!important;
    box-sizing:border-box!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-links a{
    min-height:44px!important;
    padding:0 12px!important;
    border-radius:13px!important;
    font-size:14px!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-links a span{
    width:20px!important;
    font-size:19px!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot{
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    gap:7px!important;
    padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px))!important;
  }
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot a,
  body.turni-page:not(.diaria-page):not(.archive-page):not(.orario-page):not(.orario-data-page) #navisuite-popup .ns-menu-foot button{
    min-width:0!important;
    min-height:42px!important;
    font-size:13px!important;
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
      return js(text);
    })());
  }
});