const CACHE_NAME = 'admin-data-management-v1';

// Files to pre-cache on install
const PRECACHE_URLS = [
  '/admin/dataManagement',
  '/admin/dataManagement/',
];

// Install: pre-cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for log files, network-first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache log file downloads (GET requests to /api/logs/*)
  if (url.pathname.startsWith('/api/logs/') && event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data || {};

  if (type === 'CACHE_FILE') {
    // Cache a specific log file by URL
    const { url, filename } = payload;
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response.clone());
        event.source.postMessage({ type: 'CACHE_FILE_SUCCESS', filename });
      } else {
        event.source.postMessage({ type: 'CACHE_FILE_ERROR', filename, error: 'Fetch failed' });
      }
    } catch (err) {
      event.source.postMessage({ type: 'CACHE_FILE_ERROR', filename, error: err.message });
    }
  }

  if (type === 'LIST_CACHED_FILES') {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const files = keys.map((req) => req.url);
    event.source.postMessage({ type: 'CACHED_FILES_LIST', files });
  }

  if (type === 'DELETE_CACHED_FILE') {
    const { url } = payload;
    const cache = await caches.open(CACHE_NAME);
    const deleted = await cache.delete(url);
    event.source.postMessage({ type: 'CACHE_DELETE_RESULT', url, deleted });
  }

  if (type === 'CLEAR_ALL_CACHE') {
    await caches.delete(CACHE_NAME);
    event.source.postMessage({ type: 'CACHE_CLEARED' });
  }
});