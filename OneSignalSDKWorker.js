/* Spacio AM · service worker del hub (OneSignal + actualización automática).
   Un solo worker por sitio: OneSignal (avisos push) y la red primero para el código del hub,
   así la app de la pantalla de inicio de iPhone siempre corre la última versión publicada. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

var SA_CACHE = "sa-hub-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim().then(function () {
    return self.clients.matchAll({ type: "window" }).then(function (ws) { ws.forEach(function (w) { try { w.postMessage({ tipo: "sa-sw-activo" }); } catch (x) {} }); });
  }));
});
/* Código del hub (HTML, JS, JSX, CSS, JSON): siempre de la red y sin caché HTTP; si no hay señal, la última copia guardada.
   Imágenes y fuentes: caché primero (casi nunca cambian). Nada de otros dominios pasa por aquí. */
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url; try { url = new URL(req.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;
  if (/OneSignalSDK/i.test(url.pathname)) return;
  var codigo = req.mode === "navigate" || /\.(html?|js|jsx|mjs|css|json|webmanifest)$/i.test(url.pathname) || url.pathname.slice(-1) === "/";
  if (codigo) {
    e.respondWith(fetch(req, { cache: "no-store" }).then(function (r) {
      if (r && r.ok && r.type === "basic") { var c = r.clone(); caches.open(SA_CACHE).then(function (k) { k.put(req, c); }); }
      return r;
    }).catch(function () { return caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (m) { return m || caches.match("./"); }); }));
    return;
  }
  if (/\.(png|jpe?g|webp|svg|gif|woff2?|otf|ttf)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { if (r && r.ok && r.type === "basic") { var c = r.clone(); caches.open(SA_CACHE).then(function (k) { k.put(req, c); }); } return r; });
    }));
  }
});
