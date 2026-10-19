/* Сервис-воркер: кэширует только оболочку приложения (эту страницу и иконки).
   Сайт и данные живут в Google и в кэш не попадают — запросы к другим адресам не перехватываются. */
var CACHE = 'usmle-shell-v3';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // Google, YouTube и пр. — напрямую
  if (req.mode === 'navigate') {                                  // страница: сначала сеть (свежая версия), без сети — из кэша
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('index.html', copy); }); return res;
    }).catch(function () { return caches.match('index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {           // иконки и манифест: сначала кэш
    return hit || fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    });
  }));
});


/* Уведомления: сообщение приходит зашифрованным от push-сервиса; браузер расшифровывает его сам. Каждое push-сообщение обязано показать уведомление. */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { body: e.data.text() }; } catch (y) { d = {}; } }
  var title = String((d && d.title) || 'USMLE Progress').slice(0, 120), opts = { body: String((d && d.body) || '').slice(0, 300), icon: 'icon-192.png', badge: 'icon-192.png', data: { url: (d && d.url) || './' } };
  if (d && d.tag) { opts.tag = String(d.tag).slice(0, 80); opts.renotify = true; }
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  if (!/^(\.\/|\/(?!\/))/.test(String(url))) url = './';                      // открываем только страницы своего сайта
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if (cs[i].focus) return cs[i].focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
