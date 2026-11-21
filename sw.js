// Service worker: guarda la app en caché para que funcione sin conexión.
// Al cambiar la app, sube CACHE y el ?v= de los scripts en index.html.
const CACHE = 'split-carlis-v10';
const FILES = ['./', 'index.html', 'app.js', 'core.js', 'look.js', 'mod-home.js', 'logic.js', 'shoplogic.js', 'store.js', 'defaults.js', 'catalog.js', 'mod-split.js', 'mod-menu.js', 'mod-shop.js', 'mod-settings.js', 'manifest.webmanifest', 'favicon.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'cats-wide.jpg'];

self.addEventListener('install', e => {
  // cache: 'reload' → baja los archivos del servidor, nunca de la caché del navegador.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Red primero (comprobando siempre con el servidor), caché solo si no hay conexión.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
