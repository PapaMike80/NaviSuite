/*
 * Service Worker NaviSuite - hotfix minimo Diaria.
 *
 * Non usa cache. Intercetta solo gli script che hanno causato blocchi:
 * - navidiaria-monthly.js: rimuove il MutationObserver globale dei ticket;
 * - shared-menu.js: aggiunge fallback colori se manca una residenza.
 */

const CACHE_VERSION = 'navisuite-v192-diaria-loop-hotfix';

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

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

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
