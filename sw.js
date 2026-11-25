/* Log Pose · service worker: la app abre sin conexión. Los datos van por Supabase y no se cachean aquí. */
var CACHE = 'logpose-v9';
var FILES = ['./', 'index.html', 'style.css?v=9', 'config.js?v=9', 'leaders.js?v=9', 'emblems.js?v=9', 'reference.js?v=9', 'app.js?v=9', 'icon.svg', 'manifest.webmanifest', 'fonts/rubik-dirt.woff2'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // red primero (para recibir cambios), caché si no hay conexión
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
});
