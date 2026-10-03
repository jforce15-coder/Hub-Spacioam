/* Spacio AM · Sesión compartida entre subdominios (hub + 4 apps)
   Capa fina sobre la cookie de dominio padre. Expone el objeto global SA que
   ya usan las otras apps: SA.getCookie, SA.getRole, SA.isValidSession, SA.HUB.
   El login real lo hace SAAuth (sa-auth-client.js, hoja «Control de usuarios»). */
(function (global) {
  var SA = global.SA || (global.SA = {});

  SA.HUB  = "https://hub.spacioam.com";
  SA.HOME = "https://spacioam.com";
  SA.APPS = {
    grow: "https://grow.spacioam.com",
    hola: "https://hola.spacioam.com",
    epi:  "https://epi.spacioam.com",
    mi:   "https://mi.spacioam.com"
  };
  var DIAS_SESION = 180 * 86400;            // sesión larga: 180 días, renovada en cada visita
  var LS_KEY = "sa_session";
  /* En *.spacioam.com la cookie se comparte entre subdominios; en cualquier otro host
     (vista previa, localhost) una cookie con domain=.spacioam.com se descarta, así que
     se escribe sin dominio y con respaldo en localStorage. */
  function cookieAttrs(maxAge) {
    var h = location.hostname, enMarca = /(^|\.)spacioam\.com$/.test(h);
    return (enMarca ? "; domain=.spacioam.com" : "") + "; path=/" + (location.protocol === "https:" ? "; Secure" : "") + "; SameSite=Lax; max-age=" + maxAge;
  }
  function writeSession(token) {
    document.cookie = "sa_session=" + token + cookieAttrs(DIAS_SESION);
    try { localStorage.setItem(LS_KEY, token); } catch (e) {}
  }

  SA.getCookie = function (name) {
    var m = document.cookie.match("(^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[2]) : null;
  };

  /* El token es un JSON en base64url: { email, nombre, apps, rol, exp } */
  function decode(token) {
    try {
      var s = token.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) { return null; }
  }
  function encode(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_");
  }

  SA.getToken = function () {
    var t = SA.getCookie("sa_session");
    if (!t) { try { t = localStorage.getItem(LS_KEY) || ""; } catch (e) { t = ""; } }
    return t || null;
  };
  SA.session = function () {
    var t = SA.getToken();
    return t ? decode(t) : null;
  };

  SA.isValidSession = function (token) {
    var s = token ? decode(token) : SA.session();
    return !!(s && s.email && (!s.exp || s.exp > Date.now()));
  };
  /* Renovación deslizante: cada visita con sesión válida vuelve a contar 180 días. */
  SA.touchSession = function () {
    var s = SA.session();
    if (!s || !SA.isValidSession()) return false;
    s.exp = Date.now() + DIAS_SESION * 1000;
    writeSession(encode(s));
    return true;
  };

  /* Rol del HUB. El perfil de la hoja trae apps:{hub,grow,hola,epi,mi}.
     Si no hay clave "hub", vale el rol admin/admin2 que tenga en cualquier app:
     nadie ve aquí nada que no tenga asignado en su perfil. */
  /* La hoja escribe admin_principal / admin_secundario en perm_mi, perm_epi,
     perm_grow, perm_hola. Aquí se traducen a admin / admin2. */
  SA.normRol = function (v) {
    v = String(v || "").toLowerCase().trim();
    if (v === "admin_principal" || v === "admin") return "admin";
    if (v === "admin_secundario" || v === "admin2") return "admin2";
    return v;
  };
  SA.appsDePerfil = function (profile) {
    var out = {}, p = profile || {}, src = p.apps || p.perms || null;
    if (src) Object.keys(src).forEach(function (k) { if (src[k]) out[k.replace(/^perm_/, "")] = SA.normRol(src[k]); });
    Object.keys(p).forEach(function (k) { if (/^perm_/.test(k) && p[k]) out[k.replace(/^perm_/, "")] = SA.normRol(p[k]); });
    return out;
  };
  SA.rolDePerfil = function (profile) {
    var apps = SA.appsDePerfil(profile);
    if (apps.hub === "admin" || apps.hub === "admin2") return apps.hub;
    var roles = Object.keys(apps).map(function (k) { return apps[k]; });
    if (roles.indexOf("admin") >= 0) return "admin";
    if (roles.indexOf("admin2") >= 0) return "admin2";
    return null;
  };

  SA.getRole = function () {
    var s = SA.session();
    return s ? s.rol || null : null;
  };

  SA.startSession = function (profile) {
    var rol = SA.rolDePerfil(profile);
    if (!rol) return null;
    var token = encode({
      email: profile.email, nombre: profile.nombre || profile.email,
      apps: SA.appsDePerfil(profile), rol: rol, exp: Date.now() + DIAS_SESION * 1000
    });
    writeSession(token);
    SA.stampHub();
    return { token: token, rol: rol };
  };

  /* "Pasé por el hub" — cookie de sesión, muere al cerrar el navegador. */
  SA.stampHub = function () {
    document.cookie = "sa_hub_seen=" + Date.now() + cookieAttrs(86400).replace(/; max-age=\d+$/, "");
  };

  SA.logout = function () {
    ["; domain=.spacioam.com; path=/; max-age=0", "; path=/; max-age=0"].forEach(function (a) {
      document.cookie = "sa_session=" + a; document.cookie = "sa_hub_seen=" + a;
    });
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  };
})(window);
