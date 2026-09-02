// RollCall service worker
// Bump CACHE_VERSION on every deploy so returning users get the new files
// instead of a stale cached copy.
const CACHE_VERSION = 'rollcall-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Third-party library CDNs used by index.html — cached so the app still
// works with no connection after the first successful load.
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache the app shell first; library caching is best-effort (a CDN
      // hiccup during install shouldn't block install of the app itself).
      return cache.addAll(APP_SHELL).then(() =>
        Promise.all(
          LIBS.map((url) =>
            cache.add(url).catch(() => {
              /* ignore individual CDN fetch failures at install time */
            })
          )
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first for everything: instant load, works offline. Falls back to
// network, and updates the cache in the background when online.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
