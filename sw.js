/*
 * Service Worker NaviSuite - modalità emergenza.
 *
 * Disattiva temporaneamente la cache applicativa per evitare che Safari/PWA
 * o Chrome continuino a servire file JS/HTML obsoleti dopo gli ultimi deploy.
 */

const CACHE_VERSION = 'navisuite-v188-no-cache-emergency';

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

// Non intercettiamo più le richieste: il browser va direttamente in rete.
// Questo evita blocchi causati da cache vecchie o da asset parzialmente aggiornati.
