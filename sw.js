/*
 * Service Worker NaviSuite - emergenza no-cache.
 *
 * Nessuna cache e nessuna intercettazione delle richieste: il browser usa
 * direttamente la rete. Serve a uscire da stati PWA/cache rotti.
 */

const CACHE_VERSION = 'navisuite-v191-no-fetch-emergency';

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

// Nessun fetch handler: niente cache, niente patch runtime.
