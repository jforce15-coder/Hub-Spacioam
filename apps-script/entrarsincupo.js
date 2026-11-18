/* ═══ ENTRAR NUNCA DEPENDE DEL CUPO (Juan, 18-nov-2026) ═══════════════════════════════════════════════════════════
   «El cupo nunca nos debería evitar que hagamos login. Siempre debemos tener un cupo en reserva para que por lo menos
   podamos hacer login.» Cómo queda:
   · Login: la contraseña y Face ID no llaman a internet; «Entrar con Google» revisa el token aquí si Google no deja (#750).
   · Hub: la sesión firmada se revisa con LOGIN_SECRETO si el login no contesta (sesionLocal_, Código.js).
   · Docs, Epi, Grow y Mi: lo mismo en su sesion.js, con su propia LOGIN_SECRETO. Este archivo se la entrega: el Hub la
     manda a cada app con la llave del robot (acción «__loginSecreto»); la app la guarda en sus Propiedades y nunca la
     devuelve. Hola tiene su propia sesión (repo aparte) y no está aquí.
   · Reserva (cupo.js): desde el 90 % de las últimas 24 h solo sale lo esencial.
   Se reparte sola cuando Juan guarda la llave en Ajustes → Conexiones; el robot (dsBot · «login_secreto_apps») la
   reparte otra vez o, con { revisar: true }, solo pregunta qué apps ya la tienen. */
var ENTRAR_APPS_ = ['epi', 'mi', 'grow', 'docs'];

function loginSecretoRepartir_(soloRevisar) {
  var llave = llaveRobot_(); if (!llave) return { ok: false, error: 'falta ROBOT_TOKEN en el Hub' };
  var sec = PropertiesService.getScriptProperties().getProperty('LOGIN_SECRETO') || '';
  if (!sec && !soloRevisar) return { ok: false, error: 'falta LOGIN_SECRETO en el Hub: pégala en Ajustes → Conexiones (es el SESSION_SECRET del login)' };
  var cuerpo = function () { var b = { action: '__loginSecreto', token: llave }; if (!soloRevisar) b.secreto = sec; return JSON.stringify(b); };
  var rs = ufAll_(ENTRAR_APPS_.map(function (app) {
    return { url: ACCESOS_APPS_[app](), method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: cuerpo() };
  }), 'Login');
  var out = { ok: true, hub: !!sec, apps: {} };
  ENTRAR_APPS_.forEach(function (app, i) {
    var j = null; try { j = JSON.parse(rs[i].getContentText() || '{}'); } catch (e) { j = null; }
    out.apps[app] = j && j.ok ? (j.tiene ? 'lista' : 'falta') : 'no contestó' + (j && j.error ? ' (' + String(j.error).slice(0, 40) + ')' : ' (HTTP ' + rs[i].getResponseCode() + ')');
    if (out.apps[app] !== 'lista') out.ok = false;
  });
  return out;
}
