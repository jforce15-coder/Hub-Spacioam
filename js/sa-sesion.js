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
  var verif = null;
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
        estado = 'invalida';
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
  var origFetch = w.fetch && w.fetch.bind(w);
  if (origFetch) {
    w.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!esAppsScript(url)) return origFetch(input, init);
      var accion = '';
      try {
        if (init && typeof init.body === 'string' && /^\s*\{/.test(init.body)) {
          var b = JSON.parse(init.body); accion = String(b.action || '');
          var s = leer();
          if (s && !b.session) { b.session = s; init = Object.assign({}, init, { body: JSON.stringify(b) }); }
        }
      } catch (e) {}
      return origFetch(input, init).then(function (res) {
        try {
          res.clone().json().then(function (j) {
            if (!j || typeof j !== 'object') return;
            if (j.ok && j.session && url.indexOf(LOGIN) >= 0 && (accion === 'login' || accion === 'setInitialPassword')) guardar(j.session);
            else if (j.ok === false && j.error === 'session' && leer()) { borrar(); setTimeout(function () { location.reload(); }, 50); }
          }).catch(function () {});
        } catch (e) {}
        return res;
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
  w.addEventListener('load', envolver);
})(window);
