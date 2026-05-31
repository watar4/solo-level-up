/* Solo Level Up — service worker.
 *
 * Strategy:
 *   - Navigation (HTML) requests: NETWORK-FIRST. While online the freshest
 *     index.html is served, so a new deploy's content-hashed bundles are
 *     always picked up — no "stuck on the old version" problem. Offline, we
 *     fall back to the cached app shell.
 *   - Same-origin static assets (content-hashed JS/CSS/svg, immutable):
 *     CACHE-FIRST. New deploys have new filenames, so this never serves stale
 *     code; it just makes return visits instant and enables offline.
 *   - Cross-origin requests (Gemini API, Firebase/Firestore, Google Fonts):
 *     left untouched — the SW does not call respondWith for them.
 *
 * Bump CACHE when the caching logic itself changes to evict old caches.
 */
const CACHE = 'slu-cache-v1';

// Resolved relative to the SW's own location (e.g. /solo-level-up/), so this
// works correctly under the GitHub Pages base path.
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle our own origin; let API / font calls pass straight through.
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first with offline app-shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Static assets: cache-first, populate on first fetch.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
    })
  );
});
