/* Spacio AM · Cliente de auth unificado — HUB
   Fuente única de usuarios y accesos: hoja «Control de usuarios»
   https://docs.google.com/spreadsheets/d/1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U
   Vía principal: el Apps Script publicado sobre esa hoja (login, contraseñas, perfil).
   Respaldo de solo lectura: la hoja misma (gviz CSV) si el script no responde.
   Cárgalo DESPUÉS de React/ReactDOM y ANTES de app.js:
       <script src="sa-auth-client.js"></script>                             */
(function (global) {
  var CFG = {
    sheetId: '1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U',
    sheetName: 'Hoja 1',
    url:   'https://script.google.com/macros/s/AKfycbxfdwLzsA8bwgOxUTOtf3Hw1ptIm8Cy34tspmFndu3WtRrkVSSnGyBP7obRrm73mcUd/exec',
    token: 'SpacioAM2026!'
  };

  /* ── Sesión firmada (la emite el Apps Script en login / setInitialPassword) ── */
  var SES_KEY = 'sa_auth', SES_MAX = 30 * 86400;
  function sesDominio() { return /(^|\.)spacioam\.com$/i.test(location.hostname) ? '; domain=.spacioam.com' : ''; }
  function sesGuardar(ses) {
    if (!ses) return;
    var v = typeof ses === 'string' ? ses : JSON.stringify(ses);
    try { document.cookie = SES_KEY + '=' + encodeURIComponent(v) + sesDominio() + '; path=/; max-age=' + SES_MAX + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
    try { localStorage.setItem(SES_KEY, v); } catch (e) {}
  }
  function sesLeer() {
    var v = null;
    try { var m = document.cookie.match(/(?:^|;\s*)sa_auth=([^;]*)/); if (m && m[1]) v = decodeURIComponent(m[1]); } catch (e) {}
    if (!v) { try { v = localStorage.getItem(SES_KEY); } catch (e) {} }
    if (!v) return null;
    try { return JSON.parse(v); } catch (e) { return v; }
  }
  function sesBorrar() {
    [sesDominio(), ''].forEach(function (d) { try { document.cookie = SES_KEY + '=' + d + '; path=/; max-age=0'; } catch (e) {} });
    try { localStorage.removeItem(SES_KEY); } catch (e) {}
  }
  function conSesion(r) { if (r && r.ok && r.session) sesGuardar(r.session); return r; }
  /* Sesión rechazada por el servidor: se borra y se vuelve al login (una sola vez). */
  var expirando = false;
  function revisarSesion(r) {
    if (r && r.ok === false && r.error === 'session' && !expirando) {
      expirando = true; sesBorrar();
      try { if (global.SA && global.SA.logout) global.SA.logout(); } catch (e) {}
      setTimeout(function () { location.reload(); }, 50);
    }
    return r;
  }

  function call(action, payload) {
    var body = Object.assign({ action: action, token: CFG.token, session: sesLeer() }, payload || {});
    // text/plain evita el preflight CORS de Apps Script
    return fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(revisarSesion)
      .catch(function (e) { return { ok: false, error: 'no_url', detail: String(e) }; });
  }

  /* ── Respaldo: lectura directa de la hoja ─────────────────────────────── */
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
  var usersCache = null;
  function readSheet() {
    if (usersCache) return Promise.resolve(usersCache);
    var u = 'https://docs.google.com/spreadsheets/d/' + CFG.sheetId + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(CFG.sheetName);
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var rows = parseCsv(t).filter(function (r) { return r.some(function (c) { return c && c.trim(); }); });
      if (!rows.length) return [];
      var head = rows[0].map(norm);
      var col = function (names) {
        for (var i = 0; i < names.length; i++) { var k = head.indexOf(norm(names[i])); if (k >= 0) return k; }
        for (var j = 0; j < head.length; j++) for (var n = 0; n < names.length; n++) if (head[j].indexOf(names[n]) >= 0) return j;
        return -1;
      };
      var cEmail = col(['email', 'correo', 'usuario']), cPass = col(['password_hash', 'password', 'contrasena', 'clave']),
          cNombre = col(['nombre', 'name']), cRol = col(['rol', 'role']), cActivo = col(['estado', 'activo', 'active']),
          cApps = { hub: col(['perm_hub', 'hub']), grow: col(['perm_grow', 'grow']), hola: col(['perm_hola', 'hola']), epi: col(['perm_epi', 'epi']), mi: col(['perm_mi', 'mi spacioam', 'dashboard']) };
      usersCache = rows.slice(1).map(function (r) {
        var apps = {};
        Object.keys(cApps).forEach(function (k) { var v = cApps[k] >= 0 ? (r[cApps[k]] || '').trim() : ''; if (v && norm(v) !== 'no' && norm(v) !== 'false') apps[k] = v; });
        if (cRol >= 0 && r[cRol] && !Object.keys(apps).length) apps.hub = r[cRol].trim();
        return {
          email: cEmail >= 0 ? (r[cEmail] || '').trim() : '',
          password: cPass >= 0 ? (r[cPass] || '') : '',
          nombre: cNombre >= 0 ? (r[cNombre] || '').trim() : '',
          activo: cActivo < 0 || ['si', 'sí', 'activo', 'true', '1', 'yes', ''].indexOf(norm(r[cActivo])) >= 0,
          apps: apps
        };
      }).filter(function (u) { return u.email; });
      return usersCache;
    });
  }
  function sheetLogin(email, password) {
    return readSheet().then(function (users) {
      var e = norm(email);
      var u = users.filter(function (x) { return norm(x.email) === e; })[0];
      if (!u) return { ok: false, error: 'not_found' };
      if (!u.activo) return { ok: false, error: 'inactive' };
      if (!u.password) return { ok: false, error: 'needs_password' };
      if (u.password !== password) return { ok: false, error: 'bad_password' };
      return { ok: true, profile: { email: u.email, nombre: u.nombre, apps: u.apps }, source: 'sheet' };
    }).catch(function (e) { return { ok: false, error: 'no_url', detail: String(e) }; });
  }

  var SAAuth = {
    APP: 'hub',    // clave de ESTA app en el perfil (r.profile.apps['hub'])
    SHEET: CFG.sheetId,
    configure: function (url, token) { CFG.url = url; if (token) CFG.token = token; },
    login: function (email, password) {
      return call('login', { email: email, password: password }).then(function (r) {
        return r && r.error === 'no_url' ? sheetLogin(email, password) : conSesion(r);
      });
    },
    setInitialPassword: function (email, next)     { return call('setInitialPassword', { email: email, next: next }).then(conSesion); },
    /* Formas alternativas de entrar (la contraseña sigue igual): Google y Face ID de este dispositivo. */
    googleLogin:        function (credential)      { return call('googleLogin', { credential: credential }).then(conSesion); },
    faceEnroll:         function ()                { return call('faceEnroll', {}); },
    faceLogin:          function (email, llave)    { return call('faceLogin', { email: email, llave: llave }).then(conSesion); },
    faceOff:            function (llave)           { return call('faceOff', { llave: llave }); },
    session:            function () { return sesLeer(); },
    clearSession:       function () { sesBorrar(); },
    /* Para otros clientes (ALMA, EPI, Hola): si su respuesta es { ok:false, error:"session" }, borra y vuelve al login. */
    checkResponse:      function (r) { return revisarSesion(r); },
    profile:            function (email)           { return call('profile', { email: email }); },
    setPassword:        function (email, cur, next){ return call('setPassword', { email: email, current: cur, next: next }); },
    setEmail:           function (email, next)     { return call('setEmail', { email: email, next: next }); },
    setPhoto:           function (email, url)      { return call('setPhoto', { email: email, url: url }); },
    /* Lista de solo lectura (email, nombre, apps) de la hoja «Control de usuarios». */
    usuarios:           function () { return readSheet().then(function (us) { return us.filter(function (u) { return u.activo; }).map(function (u) { return { email: u.email, nombre: u.nombre, apps: u.apps }; }); }).catch(function () { return []; }); },
    roleFor:            function (profile, appKey) { return (profile && profile.apps && profile.apps[appKey || SAAuth.APP]) || null; }
  };

  global.SAAuth = SAAuth;
})(window);
