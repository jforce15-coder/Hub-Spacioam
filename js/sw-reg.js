/* Registra el service worker del hub desde la primera carga (no solo al activar avisos) y lo
   revisa cada vez que la app vuelve a primer plano: en iPhone, la app de inicio no se actualiza sola. */
(function (g) {
  if (!("serviceWorker" in navigator)) return;
  var SW = "OneSignalSDKWorker.js";
  function revisar() { navigator.serviceWorker.getRegistration("./").then(function (r) { if (r) r.update().catch(function () {}); }).catch(function () {}); }
  navigator.serviceWorker.getRegistration("./").then(function (r) {
    if (!r) return navigator.serviceWorker.register(SW, { scope: "./", updateViaCache: "none" });
    r.update().catch(function () {});
  }).catch(function () {});
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") revisar(); });
  navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.tipo === "sa-sw-activo") { try { g.dispatchEvent(new Event("sa-sw-activo")); } catch (x) {} } });
  g.SAUpdate = { revisar: revisar };
})(window);
