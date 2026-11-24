// TATELIFT PRO service worker — network first (always the newest code), cache only as an offline fallback.
// Only touches its own caches: other TATELIFT apps on betanogo.github.io share this origin.
const CACHE = 'tatelift-pro-v1';
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
