const CACHE = 'agentic-dining-v1'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE))))
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
})
