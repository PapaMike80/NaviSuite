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
const CACHE_VERSION = 'navisuite-v179-navigation-feedback';
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
