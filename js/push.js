/* Spacio AM · Avisos push del hub con OneSignal.
   El Apps Script de ALMA envía los avisos con la REST API Key (propiedad ONESIGNAL_KEY).
   iPhone: solo funciona desde el ícono de la pantalla de inicio (iOS 16.4+), y el permiso
   debe pedirse en el mismo toque, antes de cualquier carga o llamada de red. */
(function (g) {
  var APP_ID = '7ab3b3cf-d7f3-4d1b-8377-3f7d20c4db96';
  var cargado = null, errInit = '';
  function standalone() { return (g.matchMedia && matchMedia('(display-mode: standalone)').matches) || g.navigator.standalone === true; }
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function cargar() {
    if (cargado) return cargado;
    cargado = new Promise(function (ok, ko) {
      g.OneSignalDeferred = g.OneSignalDeferred || [];
      var s = document.createElement('script'); s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true;
      s.onerror = function (e) { cargado = null; errInit = 'no se pudo descargar el SDK de OneSignal (red o bloqueador)'; ko(e); };
      document.head.appendChild(s);
      g.OneSignalDeferred.push(function (OS) { OS.init({ appId: APP_ID, serviceWorkerPath: 'OneSignalSDKWorker.js', notifyButton: { enable: false }, allowLocalhostAsSecureOrigin: true }).then(function () {
        /* Cualquier suscripción nueva (también la del aviso de OneSignal) se vincula al correo: sin eso ALMA no sabe a quién avisar. */
        try { OS.User.PushSubscription.addEventListener('change', function (ev) { var c = ev && ev.current || {}; if (c.optedIn && c.id) { if (localStorage.getItem('sa_push_on') !== '0') localStorage.setItem('sa_push_on', '1'); vincular(OS); } avisar(); }); } catch (e) {}
        errInit = ''; vincular(OS); avisar(); ok(OS);
      }, function (e) { errInit = 'OneSignal rechazó el inicio: ' + String((e && e.message) || e || '').slice(0, 140); cargado = null; ko(e); }); });
    });
    return cargado;
  }
  function correo() { try { return String(localStorage.getItem('sa_push_email') || '').toLowerCase(); } catch (e) { return ''; } }
  function vincular(OS) { var e = correo(); if (!e) return Promise.resolve(); var actual = ''; try { actual = String(OS.User.externalId || '').toLowerCase(); } catch (x) {} return actual === e ? Promise.resolve() : OS.login(e).catch(function () {}); }
  function avisar() { try { g.dispatchEvent(new Event('sa-push')); } catch (e) {} }
  /* OneSignal crea la suscripción unos segundos después del permiso: se espera a tener id y token. */
  function esperarSub(OS, ms) {
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function mirar() { var s = OS.User.PushSubscription; if ((s.id && s.token && s.optedIn) || Date.now() - t0 > ms) return ok(s); setTimeout(mirar, 400); })();
    });
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
      /* Si el permiso ya está dado (aunque lo haya pedido el aviso de OneSignal y no el hub), cuenta como activo. */
      if (Notification.permission === 'granted') return pref === '0' ? 'pausado' : 'activo';
      return 'soportado';
    },
    /* Vincula el dispositivo a tu correo (external_id) para que ALMA avise solo a quien esté de turno. Llamar desde un toque. */
    activar: function (quien) {
      var est = SAPush.estado();
      if (est !== 'soportado' && est !== 'activo' && est !== 'pausado') return Promise.resolve({ ok: false, estado: est });
      var permiso;
      try { permiso = Notification.permission === 'default' ? Notification.requestPermission() : Notification.permission; } catch (e) { permiso = Notification.permission; }
      return Promise.resolve(permiso).then(function (p) {
        if (p !== 'granted') return { ok: false, estado: p === 'denied' ? 'bloqueado' : 'soportado' };
        return cargar().then(function (OS) {
          var email = String((quien && quien.email) || '').toLowerCase(); if (email) localStorage.setItem('sa_push_email', email);
          return (email ? OS.login(email) : Promise.resolve()).catch(function () {})
            .then(function () { return OS.User.PushSubscription.optIn(); }).catch(function () {})
            .then(function () { return esperarSub(OS, 10000); })
            .then(function (s) {
              localStorage.setItem('sa_push_on', '1'); avisar();
              if (quien && quien.rol) { try { OS.User.addTag('rol', String(quien.rol)); } catch (e) {} }
              return { ok: !!s.id, estado: 'activo', subId: s.id || '' };
            });
        });
      }).catch(function (e) { console.error('push', e); return { ok: false, estado: 'no' }; });
    },
    /* Diagnóstico real del dispositivo: permiso, suscripción en OneSignal, token de Apple/Google y correo vinculado. */
    diag: function () {
      var d = { permiso: ('Notification' in g) ? Notification.permission : 'no', instalada: standalone(), ios: ios, subId: '', token: false, optedIn: false, externalId: '', motivo: '' };
      if (ios && !d.instalada) { d.motivo = 'ábrelo desde el ícono de la pantalla de inicio'; return Promise.resolve(d); }
      if (d.permiso !== 'granted') { d.motivo = d.permiso === 'denied' ? 'permiso bloqueado en los ajustes del teléfono' : 'falta dar permiso de notificaciones'; return Promise.resolve(d); }
      var tope = new Promise(function (ok) { setTimeout(function () { if (!d.subId) d.motivo = d.motivo || errInit || 'OneSignal tardó más de 20 s en responder'; ok(d); }, 20000); });
      var real = cargar().then(function (OS) {
        return esperarSub(OS, 4000).then(function (s) {
          d.subId = s.id || ''; d.token = !!s.token; d.optedIn = !!s.optedIn;
          try { d.externalId = String(OS.User.externalId || '').toLowerCase(); } catch (e) {}
          d.motivo = !s.id ? 'OneSignal no registró este dispositivo (revisa que OneSignalSDKWorker.js esté en la raíz de hub.spacioam.com)' : !s.token ? 'falta el token de notificaciones' : !s.optedIn ? 'la suscripción está pausada' : '';
          return d;
        });
      }).catch(function (e) { d.motivo = errInit || ('OneSignal no inició: ' + String((e && e.message) || e || '').slice(0, 140)); return d; });
      return Promise.race([real, tope]);
    },
    /* Apagar en este dispositivo: deja de recibir sin revocar el permiso. */
    desactivar: function () {
      localStorage.setItem('sa_push_on', '0');
      return cargar().then(function (OS) { return OS.User.PushSubscription.optOut(); }).then(function () { return { ok: true, estado: 'pausado' }; }, function () { return { ok: true, estado: 'pausado' }; });
    },
    /* Al abrir el hub: mantiene el vínculo con el correo y reactiva la suscripción si OneSignal la perdió. */
    reanudar: function (quien) {
      if (SAPush.estado() !== 'activo') return;
      cargar().then(function (OS) {
        var e = String((quien && quien.email) || '').toLowerCase(); if (e) localStorage.setItem('sa_push_email', e);
        return vincular(OS).then(function () { if (!OS.User.PushSubscription.optedIn) return OS.User.PushSubscription.optIn(); }).then(function () { return esperarSub(OS, 8000); }).then(function (s) { if (s && s.id) localStorage.setItem('sa_push_on', '1'); avisar(); });
      }).catch(function () {});
    }
  };
  /* Precarga: el SDK queda listo antes del toque. */
  if (APP_ID && (!ios || standalone()) && 'serviceWorker' in navigator) setTimeout(function () { cargar().catch(function () {}); }, 1500);
  g.SAPush = SAPush;
})(window);
