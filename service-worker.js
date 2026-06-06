const CACHE_NAME = "lista-spesa-v1";
const urlsToCache = ["./", "./index.html", "./app.js", "./manifest.json"];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const url = event.request.url;
    if (url.includes("firebasedatabase.app") || url.includes("firebase") || url.includes("gstatic.com")) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
