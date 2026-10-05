/* Spacio AM · Avisos push del hub con OneSignal (gratis).
   1. onesignal.com → New App → Web → Typical Site → URL: https://hub.spacioam.com
   2. Copia el App ID aquí. 3. Sube OneSignalSDKWorker.js a la raíz del sitio.
   El Apps Script de ALMA envía los avisos con la REST API Key (propiedad ONESIGNAL_KEY). */
(function (g) {
  var APP_ID = '7ab3b3cf-d7f3-4d1b-8377-3f7d20c4db96';
  var cargado = null;
  function standalone() { return (g.matchMedia && matchMedia('(display-mode: standalone)').matches) || g.navigator.standalone === true; }
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function cargar() {
    if (cargado) return cargado;
    cargado = new Promise(function (ok, ko) {
      g.OneSignalDeferred = g.OneSignalDeferred || [];
      var s = document.createElement('script'); s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true; s.onerror = ko;
      document.head.appendChild(s);
      g.OneSignalDeferred.push(function (OS) { OS.init({ appId: APP_ID, serviceWorkerPath: 'OneSignalSDKWorker.js', notifyButton: { enable: false }, allowLocalhostAsSecureOrigin: true }).then(function () { ok(OS); }, ko); });
    });
    return cargado;
  }
  var SAPush = {
    configurado: function () { return !!APP_ID; },
    instalada: standalone,
    estado: function () {
      if (!APP_ID) return 'sin_config';
      if (ios && !standalone()) return 'instalar';
      if (!('serviceWorker' in navigator) || !('Notification' in g)) return 'no';
      if (Notification.permission === 'denied') return 'bloqueado';
      var pref = localStorage.getItem('sa_push_on');
      if (Notification.permission === 'granted' && pref === '1') return 'activo';
      if (Notification.permission === 'granted' && pref === '0') return 'pausado';
      return 'soportado';
    },
    /* Vincula el dispositivo a tu correo (external_id) para que ALMA avise solo a quien esté de turno. Llamar desde un toque. */
    activar: function (quien) {
      var est = SAPush.estado();
      if (est !== 'soportado' && est !== 'activo' && est !== 'pausado') return Promise.resolve({ ok: false, estado: est });
      return cargar().then(function (OS) {
        var email = String((quien && quien.email) || '').toLowerCase();
        return (email ? OS.login(email) : Promise.resolve()).then(function () { return OS.Notifications.requestPermission(); }).then(function () {
          var ok = OS.Notifications.permission === true || Notification.permission === 'granted';
          if (ok) { localStorage.setItem('sa_push_on', '1'); try { OS.User.PushSubscription.optIn(); } catch (e) {} if (quien && quien.rol) OS.User.addTag('rol', String(quien.rol)); }
          return { ok: ok, estado: ok ? 'activo' : (Notification.permission === 'denied' ? 'bloqueado' : 'soportado') };
        });
      }).catch(function (e) { console.error('push', e); return { ok: false, estado: 'no' }; });
    },
    /* Apagar en este dispositivo: deja de recibir sin revocar el permiso (se puede volver a encender con el toggle). */
    desactivar: function () {
      localStorage.setItem('sa_push_on', '0');
      return cargar().then(function (OS) { return OS.User.PushSubscription.optOut(); }).then(function () { return { ok: true, estado: 'pausado' }; }, function () { return { ok: true, estado: 'pausado' }; });
    },
    /* Mantiene el vínculo al abrir el hub (sin pedir permiso de nuevo). */
    reanudar: function (quien) { if (SAPush.estado() === 'activo') cargar().then(function (OS) { var e = String((quien && quien.email) || '').toLowerCase(); if (e) OS.login(e); }).catch(function () {}); }
  };
  g.SAPush = SAPush;
})(window);
