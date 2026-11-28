// Service worker: guarda la app en caché para que funcione sin conexión.
// Al cambiar la app, sube CACHE y el ?v= de los scripts en index.html.
const CACHE = 'split-carlis-v15';
const FILES = ['./', 'index.html', 'app.js', 'core.js', 'look.js', 'mod-home.js', 'logic.js', 'shoplogic.js', 'store.js', 'defaults.js', 'catalog.js', 'mod-split.js', 'mod-menu.js', 'mod-shop.js', 'mod-pantry.js', 'mod-chores.js', 'mod-auto.js', 'mod-edit.js', 'mod-settings.js', 'manifest.webmanifest', 'favicon.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'cats-wide.jpg'];

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

// ---------- Recordatorios ----------
// El móvil despierta la app de vez en cuando (sincronización periódica). Si es la hora y quedan tareas, avisa.
// Los datos los deja la app en la caché «splitcarlis-reminders» (state.json).
const REM = 'splitcarlis-reminders';
const localDate = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
async function remind() {
  const c = await caches.open(REM);
  const r = await c.match('state.json'); if (!r) return;
  const st = await r.json(), cfg = st.cfg || {};
  if (!cfg.on) return;
  const sent = (await (await c.match('sent.json') || new Response('{}')).json());
  const now = new Date(), today = localDate(now);
  const jobs = [];
  const left = (st.days || {})[today] || [];
  if (left.length && now.getHours() >= (cfg.hour || 21) && sent.tasks !== today) {
    jobs.push(self.registration.showNotification(`🧹 Te ${left.length === 1 ? 'queda 1 tarea' : `quedan ${left.length} tareas`} de hoy`, {
      body: left.slice(0, 4).join(' · ') + (left.length > 4 ? '…' : ''), icon: 'icon-192.png', badge: 'favicon.png', tag: 'tasks', data: { go: 'chores' } }));
    sent.tasks = today;
  }
  const lw = st.lastWeek;
  if (cfg.weekly && lw && now.getDay() === 1 && now.getHours() >= 9 && sent.week !== lw.week) {
    jobs.push(self.registration.showNotification('🏆 Resumen de la semana', { body: lw.text, icon: 'icon-192.png', badge: 'favicon.png', tag: 'week', data: { go: 'chores/rank' } }));
    sent.week = lw.week;
  }
  if (jobs.length) { await Promise.all(jobs); await c.put('sent.json', new Response(JSON.stringify(sent))); }
}
self.addEventListener('periodicsync', e => { if (e.tag === 'reminders') e.waitUntil(remind()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.go) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const url = './#' + go;
    for (const w of list) { if ('focus' in w) { w.postMessage({ go }); return w.focus(); } }
    return self.clients.openWindow(url);
  }));
});
