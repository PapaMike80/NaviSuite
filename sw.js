/*
 * Service Worker NaviSuite - modalità emergenza con hotfix mirati.
 *
 * - elimina le cache vecchie;
 * - corregge shared-menu.js per evitare il blocco dei link;
 * - corregge navidiaria.html per caricare gli asset Diaria aggiornati;
 * - forza rete/no-store sugli asset critici della Diaria.
 */

const CACHE_VERSION = 'navisuite-v190-diaria-asset-hotfix';

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

function textResponse(text, type) {
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': `${type}; charset=utf-8`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/NaviSuite/navidiaria.html') {
    event.respondWith((async () => {
      const response = await fetch(event.request, { cache: 'reload' });
      let text = await response.text();
      text = text
        .replace('assets/css/navidiaria-monthly.css?v=120', 'assets/css/navidiaria-monthly.css?v=122')
        .replace('assets/js/day-popup.js?v=2', 'assets/js/day-popup.js?v=4')
        .replace('assets/js/navidiaria-monthly.js?v=119', 'assets/js/navidiaria-monthly.js?v=122')
        .replace('assets/js/navidiaria-reset-hours.js?v=1', 'assets/js/navidiaria-reset-hours.js?v=2');
      return textResponse(text, 'text/html');
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
      return textResponse(text, 'application/javascript');
    })());
    return;
  }

  const criticalAssets = new Set([
    '/NaviSuite/assets/js/day-popup.js',
    '/NaviSuite/assets/js/navidiaria-monthly.js',
    '/NaviSuite/assets/js/navidiaria-reset-hours.js',
    '/NaviSuite/assets/css/navidiaria-monthly.css'
  ]);
  if (criticalAssets.has(url.pathname)) {
    event.respondWith((async () => {
      const response = await fetch(event.request, { cache: 'reload' });
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    })());
  }
});
