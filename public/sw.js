const CACHE = "bwq-v2";
const CORE = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // HTML navigations: network-first so deploys are never stale
  if (isSameOrigin && e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }

  // Static assets (same-origin): stale-while-revalidate. Serve the cached copy
  // instantly for a fast load, but kick off a network refresh in the background
  // so a stale bundle is replaced within seconds instead of living forever.
  // Cached-on-failure fallback still covers offline.
  if (isSameOrigin) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  // Cross-origin requests: network-first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request)),
  );
});
