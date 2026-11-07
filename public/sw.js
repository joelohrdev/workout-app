// Home Gym service worker: makes the app open and work fully offline.
// All data lives in localStorage, so we only need to cache the app shell.
const VERSION = "v1";
const CACHE = `homegym-${VERSION}`;
const PAGES = ["/", "/treadmill", "/routines", "/workout", "/history", "/settings"];
const STATIC = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

// Pull every /_next/static asset referenced by a page so routes work offline
// even if they were never visited online.
async function precachePage(cache, url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(url, res);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
  await Promise.all(
    [...assets].map((a) => cache.add(a).catch(() => {})),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(STATIC).catch(() => {});
      await Promise.all(PAGES.map((p) => precachePage(cache, p).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page loads: network-first so updates land, fall back to the cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          return (
            (await caches.match(url.pathname)) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Icons / manifest: stale-while-revalidate.
  if (STATIC.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
  // Everything else (RSC payloads etc.) goes straight to the network. If it
  // fails offline, the router falls back to a full page load, which the
  // navigate handler above serves from cache.
});
