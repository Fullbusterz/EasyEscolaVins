// La app abre al instante y sin cobertura: sus archivos salen de la caché de su versión.
// Las búsquedas y los cálculos de ruta siempre van a la red.
// Al publicar cambios hay que subir VERSION (y la de js/app.js): así el móvil descarga el
// conjunto nuevo completo y avisa con "Hay una versión nueva".
const VERSION = '1.14.0';
const CACHE = `ruta-escola-${VERSION}`;
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/parse.js', 'js/geo.js', 'js/planner.js', 'js/solver.js', 'js/portal.js', 'js/parking.js', 'js/hours.js', 'js/map.js', 'data/dum-bcn.json',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'fonts/inter-latin.woff2', 'fonts/cormorant-garamond-latin.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' salta la caché HTTP para no guardar una mezcla de archivos viejos y nuevos.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ruta-escola-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// La app pide el cambio cuando el usuario pulsa "Actualizar".
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // APIs de mapas: directo a la red
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = req.mode === 'navigate'
      ? await cache.match('index.html')
      : await cache.match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
