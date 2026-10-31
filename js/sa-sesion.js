/* Spacio AM · Sesión firmada compartida (fase 1b, oct 2026)
   ---------------------------------------------------------------------------
   UN solo archivo para todas las apps. Se carga desde el Hub:
       <script src="https://hub.spacioam.com/js/sa-sesion.js"></script>
   (en <head>, antes de los demás scripts). Lo mantiene GitHub (repo del Hub);
   no forma parte de los proyectos de Claude Design.

   Qué hace, sin tocar el código de cada app:
   · Cuando el login (Apps Script de «Control de usuarios») responde ok con
     "session", la guarda: cookie sa_auth en .spacioam.com (compartida por todas
     las apps) + localStorage.
   · A toda llamada POST con cuerpo JSON a un Apps Script (script.google.com/macros)
     le añade "session" si no la trae ya.
   · Si un Apps Script responde { ok:false, error:"session" }, borra la sesión y
     recarga para volver al login.
   · Al cerrar sesión (SA.logout / SAAuth.clearSession) la borra.
   · SASesion.verificar() → perfil vigente para la sesión única entre apps.
   · Lecturas de hojas (docs.google.com/…/gviz/tq) → lector seguro del login (hojas privadas).
   --------------------------------------------------------------------------- */
(function (w) {
  if (w.__saSesion) return; w.__saSesion = true;
  var KEY = 'sa_auth', MAX = 30 * 86400;
  var LOGIN = 'AKfycbxfdwLzsA8bwgOxUTOtf3Hw1ptIm8Cy34tspmFndu3WtRrkVSSnGyBP7obRrm73mcUd';

  function dominio() { return /(^|\.)spacioam\.com$/i.test(location.hostname) ? '; domain=.spacioam.com' : ''; }
  function leer() {
    var v = null;
    try { var m = document.cookie.match(/(?:^|;\s*)sa_auth=([^;]*)/); if (m && m[1]) v = decodeURIComponent(m[1]); } catch (e) {}
    if (!v) { try { v = localStorage.getItem(KEY); } catch (e) {} }
    return v || null;
  }
  function guardar(s) {
    if (!s || typeof s !== 'string') return;
    try { document.cookie = KEY + '=' + encodeURIComponent(s) + dominio() + '; path=/; max-age=' + MAX + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
    try { localStorage.setItem(KEY, s); } catch (e) {}
  }
  function borrar() {
    [dominio(), ''].forEach(function (d) { try { document.cookie = KEY + '=' + d + '; path=/; max-age=0'; } catch (e) {} });
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  /* Sesión única: comprueba la sesión firmada con el login y devuelve el perfil vigente (o null).
     Cada app la llama al arrancar, antes de mostrar su pantalla de login. Resultado en memoria 5 min. */
  var verif = null, DEFINITIVOS = { session: 1, no_user: 1, suspended: 1 };
  function verificar() {
    var s = leer(); if (!s) return Promise.resolve(null);
    if (verif && verif.s === s && Date.now() - verif.t < 300000) return verif.p;
    var estado = '';
    var p = (origFetch || w.fetch)('https://script.google.com/macros/s/' + LOGIN + '/exec', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'verify', token: 'SpacioAM2026!', session: s })
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.profile) { estado = 'ok'; if (j.session) guardar(j.session); return j.profile; }
        /* Solo es «inválida» si el login lo dice claro (firma mala, usuario borrado o suspendido). Un error del
           login (cupo, hoja ocupada) no saca a nadie: se queda como «red». */
        estado = j && j.ok === false && DEFINITIVOS[j.error] ? 'invalida' : 'red';
        if (j && j.ok === false && j.error === 'session') borrar();
        return null;
      })
      .catch(function () { estado = 'red'; return null; });
    verif = { s: s, t: Date.now(), p: p, estado: function () { return estado; } };
    return p;
  }
  /* Perfil incluido en la sesión (sin comprobar la firma): permite entrar AL INSTANTE y llamar a
     verificar() en segundo plano; si la firma no vale, la app cierra la sesión. Igual de seguro que el
     inicio de sesión recordado que ya usa cada app, y la seguridad real la ponen los backends. */
  function perfilRapido() {
    var s = leer(); if (!s) return null;
    try {
      var c = s.slice(0, s.lastIndexOf('.')).replace(/-/g, '+').replace(/_/g, '/');
      while (c.length % 4) c += '=';
      var d = JSON.parse(decodeURIComponent(escape(atob(c))));
      if (!d || !d.p || !d.p.email || !d.exp || d.exp < Date.now()) return null;
      return d.p;
    } catch (e) { return null; }
  }
  /* Comprueba en segundo plano un ingreso instantáneo. Si la firma no vale o el perfil perdió el
     acceso a appKey, borra la sesión y llama a alFallar (por ejemplo, cerrar sesión y recargar). */
  function confirmar(appKey, alFallar) {
    verificar().then(function (p) {
      if (p && p.apps && (!appKey || p.apps[appKey])) return;
      if (!p && !(verif && verif.estado() === 'invalida')) return;   // sin red: no se cierra la sesión
      borrar();
      try { alFallar && alFallar(); } catch (e) {}
    });
  }
  w.SASesion = { leer: leer, guardar: guardar, borrar: borrar, verificar: verificar, perfilRapido: perfilRapido, confirmar: confirmar };

  var esAppsScript = function (u) { return /script\.google(usercontent)?\.com\/macros\//.test(String(u || '')); };
  /* Lector seguro de hojas (fase 2): las descargas gviz de las hojas de Spacio AM pasan por el login, que
     comprueba la sesión y lee la hoja aunque sea privada. Sin sesión, o si el lector falla, se intenta la
     descarga directa de siempre (funciona mientras la hoja siga pública). */
  var RX_GVIZ = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{30,60}\/gviz\/tq(?:\?[^#]*)?)/;
  function leerHoja(q) {
    return origFetch('https://script.google.com/macros/s/' + LOGIN + '/exec', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'hoja', token: 'SpacioAM2026!', session: leer(), q: q })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.error === 'session') { var es = new Error('session'); es.sesion = true; throw es; }
      if (!j || !j.ok || typeof j.csv !== 'string') throw new Error((j && j.error) || 'lector');
      return new Response(new Blob([j.csv], { type: 'text/csv;charset=utf-8' }), { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
    });
  }
  w.SASesion.leerHoja = leerHoja;
  /* Fase 1c: quien entró a una app ANTES de las sesiones firmadas tiene su sesión vieja guardada pero no la
     pulsera (sa_auth). El backend lo rechaza con error "session" y la app se quedaba vacía, sin pedir login.
     Si este navegador guarda la sesión vieja de alguna app, se borra y se recarga: la app muestra su login y
     al entrar recibe la pulsera. Huéspedes, firmantes y propietarios no tienen sesión vieja: no les pasa nada.
     Como mucho una vez cada 10 minutos, para no entrar en un ciclo. */
  var VIEJAS = ['sam_sess', 'sa-session', 'SPACIO_GROW_SESION', 'spacio_admin_user', 'spacio_admin_sesion_v1',
                'spacioam_admin_session', 'spacioam_admin_profile', 'sa_session'];
  function sinPulsera() {
    try {
      if (/[?&](firmar|datos)=/.test(location.search)) return;   // enlace de firma (Docs) o de datos del cliente (Grow)
      var hay = VIEJAS.filter(function (k) { return localStorage.getItem(k) != null; });
      if (/(?:^|;\s*)sa_session=/.test(document.cookie)) hay.push('cookie');
      if (!hay.length) return;
      var t = +sessionStorage.getItem('sa_sin_pulsera') || 0;
      if (Date.now() - t < 600000) return;
      sessionStorage.setItem('sa_sin_pulsera', String(Date.now()));
      VIEJAS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      [dominio(), ''].forEach(function (d) { try { document.cookie = 'sa_session=' + d + '; path=/; max-age=0'; } catch (e) {} });
      try { w.dispatchEvent(new Event('sa-sesion-vencida')); } catch (e) {}
      setTimeout(function () { location.reload(); }, 50);
    } catch (e) {}
  }
  var origFetch = w.fetch && w.fetch.bind(w);
  if (origFetch) {
    w.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var g = RX_GVIZ.exec(url);
      if (g && leer() && (!init || !init.method || String(init.method).toUpperCase() === 'GET')) {
        return leerHoja(g[1]).catch(function (e0) {   // un reintento antes de ir directo (la hoja privada no se puede leer directo)
          if (e0 && e0.sesion) throw e0;
          return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return leerHoja(g[1]); });
        }).catch(function (e) {
          /* Sesión vencida o inválida: no tiene sentido leer directo (la hoja es privada). Se borra para que la app pida entrar de nuevo. */
          if (e && e.sesion) { borrar(); try { w.dispatchEvent(new Event('sa-sesion-vencida')); } catch (x) {} throw e; }
          try { console.warn('[sa-sesion] lector de hojas: ' + (e && e.message) + ' · se intenta directo'); } catch (x) {}
          return origFetch(input, init);
        });
      }
      if (!esAppsScript(url)) return origFetch(input, init);
      var accion = '';
      try {
        if (init && typeof init.body === 'string' && /^\s*\{/.test(init.body)) {
          var b = JSON.parse(init.body); accion = String(b.action || '');
          var s = leer();
          if (s && !b.session) { b.session = s; init = Object.assign({}, init, { body: JSON.stringify(b) }); }
        }
      } catch (e) {}
      /* Se lee la respuesta UNA vez y se devuelve una copia nueva. Antes se usaba res.clone(): en Safari
         (iPad) la respuesta clonada de Apps Script a veces no terminaba de llegar y la app se quedaba
         esperando aunque el servidor ya había respondido. */
      var dbg = function (m) { try { w.saDbg && w.saDbg('  [sesión] ' + accion + ' · ' + m); } catch (e) {} };
      dbg('enviada');
      return origFetch(input, init).then(function (res) {
        dbg('respuesta ' + res.status + ' ' + res.type);
        if (res.type === 'opaque' || res.status < 200 || [204, 205, 304].indexOf(res.status) >= 0) return res;
        return res.text().then(function (txt) {
          dbg('leída ' + txt.length + ' bytes');
          try {
            var j = JSON.parse(txt);
            if (j && typeof j === 'object') {
              if (j.ok && j.session && url.indexOf(LOGIN) >= 0 && (accion === 'login' || accion === 'setInitialPassword')) guardar(j.session);
              else if (j.ok === false && j.error === 'session' && leer()) {
                /* Un backend dice «session»: antes de sacar a la persona se le pregunta al login. Solo si el login
                   confirma que la sesión ya no vale se cierra; si el login dice que vale o no contesta, se queda. */
                verif = null;
                verificar().then(function (p) { if (!p && verif && verif.estado() === 'invalida') { borrar(); location.reload(); } });
              }
              else if (j.ok === false && j.error === 'session') sinPulsera();
            }
          } catch (e) {}
          var h = { 'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8' };   // solo el tipo: copiar longitud/compresión del original confunde a Safari
          var nueva = new Response(txt, { status: res.status, statusText: res.statusText, headers: h });
          dbg('entregada');
          return nueva;
        });
      });
    };
  }

  /* Cerrar sesión: envuelve SA.logout y SAAuth.clearSession en cuanto existan. */
  function envolver() {
    try {
      if (w.SA && w.SA.logout && !w.SA.logout.__ses) {
        var lo = w.SA.logout; w.SA.logout = function () { borrar(); return lo.apply(this, arguments); }; w.SA.logout.__ses = true;
      }
      if (w.SAAuth && !w.SAAuth.session) { w.SAAuth.session = leer; w.SAAuth.clearSession = borrar; }
    } catch (e) {}
  }
  envolver();
  document.addEventListener('DOMContentLoaded', envolver);

  /* Hub: quien tenga la sesión antigua del Hub (sa_session) pero no la firmada, vuelve a iniciar sesión una
     vez. Sin la firmada no puede leer las hojas privadas (ALMA, usuarios) y vería el Hub vacío. */
  if (/^hub\.spacioam\.com$/i.test(location.hostname)) {
    w.addEventListener('load', function () {
      try {
        if (leer() || sessionStorage.getItem('sa_relogin')) return;
        if (w.SA && w.SA.isValidSession && w.SA.isValidSession()) {
          sessionStorage.setItem('sa_relogin', '1');
          if (w.SA.logout) w.SA.logout();
          location.reload();
        }
      } catch (e) {}
    });
  }
  /* Epi: los técnicos con la sesión antigua guardada (sam_sess) pero sin la firmada vuelven una vez al login.
     Sin la firmada no pueden leer la hoja de Guest app (wi-fi de las propiedades) cuando sea privada. */
  if (/^epi\.spacioam\.com$/i.test(location.hostname)) {
    try {
      if (!leer() && !sessionStorage.getItem('sa_relogin') && localStorage.getItem('sam_sess')) {
        sessionStorage.setItem('sa_relogin', '1');
        localStorage.removeItem('sam_sess');
      }
    } catch (e) {}
  }
  w.addEventListener('load', envolver);
})(window);
