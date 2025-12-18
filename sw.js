// Service Worker for caching ONLY the large WASM file
const CACHE_NAME = 'ghostscript-wasm-v2';
const WASM_FILES = [
  './gs.wasm',    // 14MB - This is what we want to cache
  './gs.js'       // 184KB - Essential companion file
];

// Install event - cache the WASM files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching WASM files');
        return cache.addAll(WASM_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache first with optimized headers
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isWasmFile = WASM_FILES.some(file => url.pathname.includes(file.replace('./', '')));

  if (isWasmFile) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return withOptimalHeaders(cached, url.pathname);
        }

        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const optimized = withOptimalHeaders(response.clone(), url.pathname);
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, optimized.clone()));
          return optimized;
        });
      })
    );
  }
});

// Set optimal headers for faster loading
function withOptimalHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (pathname.endsWith('.wasm')) {
    headers.set('Content-Type', 'application/wasm');
  } else if (pathname.endsWith('.js')) {
    headers.set('Content-Type', 'application/javascript');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
