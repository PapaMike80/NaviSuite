/*
 * Service Worker NaviSuite - modalità emergenza con hotfix menu.
 *
 * Disattiva la cache applicativa e corregge al volo shared-menu.js per evitare
 * il blocco del click su NaviDiaria causato da palette residenza non mappata.
 */

const CACHE_VERSION = 'navisuite-v189-shared-menu-hotfix';

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

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname !== '/NaviSuite/assets/js/shared-menu.js') return;
  event.respondWith((async () => {
    const response = await fetch(event.request, { cache: 'reload' });
    let text = await response.text();
    text = text.replace(
      "const palette=type==='residence'\n        ? residenceColors[raw]\n        : shiftColors[raw] || ['#94a3b8','rgba(148,163,184,.13)'];",
      "const palette=(type==='residence'\n        ? residenceColors[raw]\n        : shiftColors[raw]) || ['#2dd4bf','rgba(45,212,191,.13)'];"
    );
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  })());
});
