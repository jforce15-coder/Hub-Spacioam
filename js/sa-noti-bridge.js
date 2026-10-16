/* Spacio AM · Puente de notificaciones hacia el hub (sa-noti-bridge.js)
   Cárgalo en el <head> de hola, epi, mi, docs y grow. Cada vez que la app arma su lista de notificaciones, llama:
       SANoti.publicar("epi", numeroDeNotificacionesSinLeer);
   Se guarda en una cookie del dominio .spacioam.com (sa_noti_<app>=n.ts) que el hub lee para mostrar el número en su botón.
   No envía nada a ningún servidor. */
(function () {
  var marca = /(^|\.)spacioam\.com$/.test(location.hostname);
  window.SANoti = {
    publicar: function (app, n) {
      try {
        n = Math.max(0, Math.round(Number(n) || 0));
        var prev = (document.cookie.match(new RegExp("(^|; )sa_noti_" + app + "=([^;]*)")) || [])[2];
        if (prev && prev.split(".")[0] === String(n)) return;
        document.cookie = "sa_noti_" + app + "=" + n + "." + Date.now() + (marca ? "; domain=.spacioam.com" : "") + "; path=/; Secure; SameSite=Lax; max-age=" + (14 * 86400);
      } catch (e) {}
    }
  };
})();
