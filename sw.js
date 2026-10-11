// La Fructosa · Service Worker
// Sube CACHE_VERSION en cada despliegue: la app avisará "Hay una versión nueva".
const CACHE_VERSION = 'fructosa-v12';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/api.js',
  './js/store.js',
  './js/money.js',
  './js/rates.js',
  './js/ui.js',
  './js/ai.js',
  './js/learn.js',
  './js/tour.js',
  './js/charts.js',
  './js/export.js',
  './js/supabase.js',
  './js/screens/common.js',
  './js/screens/auth.js',
  './js/screens/home.js',
  './js/screens/movements.js',
  './js/screens/txform.js',
  './js/screens/accounts.js',
  './js/screens/budgets.js',
  './js/screens/recurring.js',
  './js/screens/rates.js',
  './js/screens/insights.js',
  './js/screens/settings.js',
  './js/screens/learn.js',
  './js/screens/copilot.js',
  './js/screens/onboarding.js',
  './icons/favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Librerías con versión fija: se guardan al primer uso y no cambian.
const CDN_HOSTS = ['esm.sh'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await (await caches.open(CACHE_VERSION)).addAll(APP_SHELL);
    // Viniendo de la versión 1.x (cachés fructosa-v1…v39) activamos de inmediato;
    // después, la app pregunta antes de actualizar.
    const keys = await caches.keys();
    if (keys.some((k) => /^fructosa-v([0-9]|[1-3][0-9])$/.test(k))) self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Nunca cachear Supabase ni APIs de tasas: datos privados o que deben ser frescos.
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('dolarapi.com')) return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  // config.js (tus claves) siempre desde la red si es posible.
  if (sameOrigin && url.pathname.endsWith('/js/config.js')) {
    event.respondWith(fetch(request).then((res) => {
      if (res.ok) caches.open(CACHE_VERSION).then((c) => c.put(request, res.clone()));
      return res;
    }).catch(() => caches.match(request)));
    return;
  }

  // Cache first: la versión instalada es coherente; las nuevas llegan con CACHE_VERSION.
  event.respondWith(
    caches.match(request, { ignoreSearch: sameOrigin && request.mode === 'navigate' }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
