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
/* Código del hub (HTML, JS, JSX, CSS, JSON): siempre se pregunta a la red si hay versión nueva, pero con revalidación
   (If-None-Match → 304 sin cuerpo): si no cambió, no se vuelve a bajar. Si la red tarda más de 3 s al abrir la app
   y hay copia guardada, se muestra la copia (el aviso de versión nueva recarga después). Imágenes y fuentes: caché primero.
   Nada de otros dominios pasa por aquí. */
var FRESCO = {};   /* documento recién bajado: la página lo vuelve a pedir al arrancar (dc-runtime) y se sirve de aquí */
function guardar(req, r) { var c = r.clone(); return caches.open(SA_CACHE).then(function (k) { return k.put(req, c); }).catch(function () {}); }
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url; try { url = new URL(req.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;
  if (/OneSignalSDK/i.test(url.pathname)) return;
  var nav = req.mode === "navigate";
  var codigo = nav || /\.(html?|js|jsx|mjs|css|json|webmanifest)$/i.test(url.pathname) || url.pathname.slice(-1) === "/";
  if (codigo) {
    var f = FRESCO[req.url];
    if (!nav && f && Date.now() - f.t < 60000) {
      e.respondWith(f.p.then(function () { return caches.match(req.url); }).then(function (m) { return m || fetch(req, { cache: "no-cache" }); }));
      return;
    }
    var put = null;
    var red = fetch(req, { cache: "no-cache" }).then(function (r) {
      if (r && r.ok && r.type === "basic") { put = guardar(req, r); if (nav) FRESCO[req.url] = { t: Date.now(), p: put }; }
      return r;
    });
    e.waitUntil(red.then(function () { return put; }, function () {}));
    var copia = function () { return caches.match(req, { ignoreSearch: nav }).then(function (m) { return m || caches.match("./"); }); };
    if (nav && !/[?&]v=/.test(url.search)) {
      e.respondWith(new Promise(function (ok, no) {
        var listo = false, fin = function (r) { if (!listo && r) { listo = true; ok(r); } };
        var t = setTimeout(function () { copia().then(fin); }, 3000);
        red.then(function (r) { clearTimeout(t); fin(r); }, function () { clearTimeout(t); copia().then(function (m) { if (m) fin(m); else no(new TypeError("sin red")); }); });
      }));
      return;
    }
    e.respondWith(red.catch(copia));
    return;
  }
  if (/\.(png|jpe?g|webp|svg|gif|woff2?|otf|ttf)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { if (r && r.ok && r.type === "basic") guardar(req, r); return r; });
    }));
  }
});
