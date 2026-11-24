// TATELIFT PRO service worker — network first (always the newest code), cache only as an offline fallback.
// Only touches its own caches: other TATELIFT apps on betanogo.github.io share this origin.
const CACHE = 'tatelift-pro-v2';
const CORE = ['./', './index.html', './app.js', './pro.js', './rpe.html', './manifest.webmanifest', './pro-192.png', './pro-512.png', './V3_White.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tatelift-pro') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;   // CDN, Supabase, AI worker: straight to the network
  e.respondWith(
    fetch(req)
      .then(res => { if (res.ok && !/\.mp4$/i.test(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});

// Rest timer: the page tells us when it ends; if the app isn't on screen then, show a notification.
let timerToken = 0;
self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'timer-cancel') { timerToken++; return; }
  if (m.type !== 'timer-start') return;
  const tok = ++timerToken, wait = Math.max(0, m.at - Date.now());
  e.waitUntil(new Promise(res => setTimeout(async () => {
    try {
      if (tok !== timerToken) return res();
      const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (cl.some(c => c.visibilityState === 'visible' && c.focused)) return res();
      await self.registration.showNotification('휴식 끝! 💪', {
        body: (m.name ? m.name + ' — ' : '') + '다음 세트 시작하세요',
        icon: 'pro-192.png', badge: 'pro-192.png', tag: 'rest-timer', renotify: true,
        vibrate: [300, 150, 300, 150, 500], requireInteraction: false,
      });
    } catch (err) {}
    res();
  }, wait)));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cl => {
    const c = cl.find(x => x.url.includes(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
