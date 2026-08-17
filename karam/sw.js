/**
 * KARAM · sw.js — Service worker (cache-first para funcionar 100% offline)
 */
const CACHE_NAME = 'karam-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/db.js',
  './js/utils.js',
  './js/auth.js',
  './js/repo.js',
  './js/calc.js',
  './js/modal.js',
  './js/app.js',
  './js/views/dashboard.js',
  './js/views/orders.js',
  './js/views/payments.js',
  './js/views/sales.js',
  './js/views/products.js',
  './js/views/purchases.js',
  './js/views/inventory.js',
  './js/views/expenses.js',
  './js/views/cash.js',
  './js/views/capital.js',
  './js/views/partners.js',
  './js/views/promotions.js',
  './js/views/reports.js',
  './js/views/settings.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
