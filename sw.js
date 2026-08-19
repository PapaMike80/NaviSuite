/*
 * Service Worker per NaviDiaria.
 *
 * Obiettivi:
 * - mantenere in cache la shell dell'app;
 * - eliminare automaticamente le cache obsolete;
 * - provare sempre prima la rete e usare la cache solo come fallback.
 */

// Cambio obbligatorio dopo il ripristino dello script popup: invalida anche
// le copie memorizzate dalla PWA e da Safari.
const CACHE_VERSION = 'navisuite-v168-menu-mobile';
const CACHE_NAME = CACHE_VERSION;

// File statici da pre-caricare durante l'installazione.
// La lista include le pagine principali, i fogli di stile e gli script comuni.
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'assets/images/favicon.svg',
  'assets/images/icona_192.png',
  'assets/images/icona_512.png',
  'assets/images/icona_apple_180.png',
  'assets/images/logo_maskable.svg',
  'assets/images/logo_principale.svg',
  'assets/images/splash_ios.png',
  'navidiaria.html',
  'naviturni.html',
  'cambi_turno.html',
  'aggiornamenti.html',
  'agenti.html',
  'documenti.html',
  'impostazioni.html',
  'segnalazioni.html',
  'Orario.html',
  'orari-tabella.html',
  'assets/css/portal.css',
  'assets/css/styles.css',
  'assets/css/navidiaria-weekly.css',
  'assets/css/navidiaria-monthly.css',
  'assets/css/navi-layout.css',
  'assets/css/navi-shared.css',
  'assets/css/naviturni-theme.css',
  'assets/css/orario.css',
  'assets/css/turni.css',
  'assets/css/turni-common.css',
  'assets/css/shared-menu.css',
  'assets/js/shared-data.js',
  'assets/js/firebase-data.js',
  'assets/js/admin-firebase-rest.js',
  'assets/js/draft-period.js',
  'assets/js/cambi-change-arrows.js',
  'assets/js/aggiornamenti-data.js',
  'vendor/pdfjs/pdf.min.js',
  'vendor/pdfjs/pdf.worker.min.js',
  'assets/js/firebase-auth.js',
  'assets/js/portal.js',
  'assets/js/app.js',
  'assets/js/navidiaria-weekly.js',
  'assets/js/navidiaria-monthly.js',
  'assets/js/shared-menu.js',
  'assets/js/mobile-menu-solid.js',
  'assets/js/turni-shared.js',
  'assets/js/announcements-recovered.js',
  'assets/js/documenti.js',
  'assets/js/orari-tabella.js',
  'assets/js/orario-main.js',
  'assets/js/orario-shared.js',
  'assets/js/orario-tooltip.js',
  'assets/js/cambia-pin.js'
];

self.addEventListener('install', event => {
  // Durante l'installazione salviamo la shell minima dell'app.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  // Alla nuova attivazione eliminiamo tutte le cache vecchie.
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName !== CACHE_NAME)
        .map(cacheName => caches.delete(cacheName))
    );
    await self.clients.claim();

    // Le PWA possono restare sospese in memoria per giorni. Al cambio di
    // versione ricarichiamo una sola volta le pagine operative già aperte,
    // così ricevono subito nuovi script e popup senza reinstallare l’app.
    const openClients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    await Promise.all(openClients.map(client => {
      const url = new URL(client.url);
      if (!/(?:\/|\/(?:index|naviturni|cambi_turno|navidiaria|impostazioni|segnalazioni)\.html)$/.test(url.pathname)) return Promise.resolve();
      url.searchParams.set('pwa-update', CACHE_VERSION);
      return client.navigate(url.toString()).catch(() => null);
    }));
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' && event.request.method !== 'POST') {
    return;
  }

  event.respondWith(networkFirst(event.request, event));
});

async function networkFirst(request, event) {
  const cacheKey = await buildCacheKey(request);
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    // Conserviamo nella cache le risposte utili per un eventuale fallback offline.
    if (response && (response.ok || response.type === 'opaque')) {
      event.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Per le navigazioni, se la pagina specifica non esiste in cache,
    // proviamo almeno a servire la home per mantenere l'app accessibile.
    if (request.mode === 'navigate') {
      const fallback = await cache.match('index.html') || await cache.match('./');
      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}

async function buildCacheKey(request) {
  if (request.method === 'GET') {
    const url = new URL(request.url);

    // Rimuoviamo i parametri usati solo per rompere la cache, così il fallback
    // offline può riusare l'ultima risposta valida.
    url.searchParams.delete('t');
    url.searchParams.delete('cacheBust');
    url.searchParams.delete('cache-bust');
    url.searchParams.delete('_');
    // Le pagine aggiungono ?v=… e ?pwa-update=… solo per forzare il refresh.
    // La cache invece deve riconoscere lo stesso file già verificato,
    // altrimenti una PWA con segnale debole resta in attesa dello script.
    url.searchParams.delete('v');
    url.searchParams.delete('pwa-update');

    return new Request(url.toString(), { method: 'GET' });
  }

  const bodyText = await request.clone().text();
  const bodyHash = await sha256Hex(bodyText);
  const normalizedUrl = new URL(request.url);
  const cacheUrl = new URL('/__navi_cache__', self.location.origin);

  cacheUrl.searchParams.set('method', 'POST');
  cacheUrl.searchParams.set('url', normalizedUrl.toString());
  cacheUrl.searchParams.set('hash', bodyHash);

  return new Request(cacheUrl.toString(), { method: 'GET' });
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashBytes = Array.from(new Uint8Array(hashBuffer));
  return hashBytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}
