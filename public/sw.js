const CACHE_NAME = 'elite-md-cache-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then(networkResponse => {
            // تجاهل أي استجابات غير صالحة للتخزين (كأخطاء السيرفر)
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                return networkResponse;
            }
            // استنساخ الاستجابة وحفظها في الـ Cache تلقائياً (مثل ملفات JS و CSS المجزأة بواسطة Vite)
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
            });
            return networkResponse;
        }).catch(error => {
            console.error('Fetch failed (offline):', error);
            // فشل جلب الملف بسبب انقطاع الإنترنت (سيستمر التطبيق باستخدام البيانات المخبأة المتاحة)
            throw error;
        });
    })
  );
});
