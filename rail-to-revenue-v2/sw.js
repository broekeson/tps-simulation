/* Rail to Revenue v2.0 service worker: keeps both pages usable through a reload with no signal. */
const CACHE = "r2r2-2.0.20261020";
const SHELL = ["./", "./index.html", "./console.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("r2r2-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Network first with a short timeout: a fresh deploy wins when the venue network is up, the cache wins when it is not.
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html"));
    const timer = setTimeout(() => { fromCache().then((r) => { if (!done && r) { done = true; resolve(r); } }); }, 3500);
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        if (!done) { done = true; clearTimeout(timer); resolve(res); }
        return;
      }
      fromCache().then((r) => { if (!done) { done = true; clearTimeout(timer); resolve(r || res || new Response("Offline", { status: 503 })); } });
    }).catch(() => {
      fromCache().then((r) => { if (!done) { done = true; clearTimeout(timer); resolve(r || new Response("Offline", { status: 503 })); } });
    });
  }));
});
