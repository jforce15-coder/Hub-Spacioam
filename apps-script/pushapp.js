/* ═══ NOTIFICACIÓN PUSH DE LA APP DE ALMA (Ticket #28; Juan, 16-nov-2026: «sí» a notificaciones push reales) ═══════════
   Hasta hoy la app de iPhone solo preguntaba cada 45 s (vozAvisos) y armaba notificaciones locales: con la app dormida o
   cerrada no llegaba nada y Siri no podía anunciar. Ahora cada aviso que nace para la app sale también como notificación
   push por OneSignal (Apps Script no habla HTTP/2 con Apple): la app trae el SDK de OneSignal y una extensión de
   notificaciones (NotifAlma) que la convierte en mensaje de Alma para que Siri la anuncie con los AirPods.
     · Una app de OneSignal aparte para el iPhone (ONESIGNAL_IOS_APP_ID y ONESIGNAL_IOS_KEY, en Ajustes → Llaves): la del
       Hub web (ONESIGNAL_APP_ID) manda avisos «a todos» (cada mensaje de un huésped) que no deben sonar en la app de Alma.
       Sin las dos llaves no pasa nada nuevo: avisos locales como siempre.
     · Quién: external_id = «alma_» + la clave del usuario (la misma de VOZ_RET_ y ANILLO_APP_, nunca el correo). La app lo
       recibe en vozAvisos (push: { app_id, externo }) y se registra con él (PushAlma.swift).
     · Cuándo: solo si la app NO está despierta (no preguntó en los últimos PUSH_APP_VIVA_MS_, o avisó al dormirse con
       duerme: true) y dijo que su push está listo (push: { listo: true } en vozAvisos). Despierta, la app la muestra ella
       como siempre (Modo calle, conferencia, la voz de Alma): Siri nunca habla encima de Alma. La prueba de Siri
       (notifPrueba) sale por push siempre que esté listo: es para probar con el teléfono bloqueado y la app cerrada.
     · Sin duplicados: el aviso queda marcado (push: true) en la cola y la app, al leerlo en vozAvisos, no arma otra
       notificación; push y local usan el mismo identificador (collapse_id = id del aviso): una reemplaza a la otra. Si el
       envío falla, la marca se quita y todo sigue como antes (la app lo muestra al despertar; el respaldo por WhatsApp).
     · Ajustes por tipo (notifajustes.js): el tipo apagado no sale; con vista previa «nunca» o «solo desbloqueado» sale
       «Alma te dejó un mensaje» (la extensión no sabe si el teléfono está bloqueado, como la web). El ajuste del tipo
       viaja con el push y la extensión lo aplica (Siri, sonido, hilo, urgente) con la misma lógica de la app.
     · Registro (ALMA_PUSH): solo «app», el tipo, el id del aviso y lo que respondió OneSignal; nunca el texto.
   Check con dobles: .github/push-app.js. */
var PUSH_APP_VIVA_MS_ = 100000;   // la app pregunta cada 45 s: si preguntó en los últimos 100 s, está despierta
var PUSH_APP_PROP_ = 'PUSH_APP';  // { clave: 1 }: quién tiene el push listo (se escribe solo cuando la app dice algo distinto)
var PUSH_APP_TTL_ = 21600;        // 6 h: lo mismo que vive un aviso en la cola (VOZ_AVISOS)

/* Las llaves de la app de OneSignal del iPhone; sin las dos, null (nada sale por push). */
function pushAppLlaves_() {
  var p = PropertiesService.getScriptProperties(), app = p.getProperty('ONESIGNAL_IOS_APP_ID'), key = p.getProperty('ONESIGNAL_IOS_KEY');
  return app && key ? { app: String(app).trim(), key: String(key).trim() } : null;
}
function pushAppClave_(adm) { return retClave_(adm).slice(8); }
function pushAppExterno_(adm) { return 'alma_' + pushAppClave_(adm); }
function pushAppListos_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PUSH_APP_PROP_) || '{}') || {}; } catch (e) { return {}; } }
function pushAppVivaK_(adm) { return 'pushviva_' + pushAppClave_(adm); }
/* ¿La app preguntó hace poco? Entonces está despierta y muestra ella el aviso. */
function pushAppDespierta_(adm) {
  var t = Number(CacheService.getScriptCache().get(pushAppVivaK_(adm)) || 0);
  return !!t && Date.now() - t < PUSH_APP_VIVA_MS_;
}

/* vozAvisos (voz.js): la app pregunta. b.duerme = se va a dormir (sin Modo calle, conferencia ni anillo); b.push.listo =
   OneSignal tiene su suscripción con permiso y el external_id de este usuario. resp.push le dice con qué registrarse. */
function pushAppAlPreguntar_(adm, b, resp) {
  if (!adm || !adm.email) return;
  b = b || {};
  var c = CacheService.getScriptCache(), k = pushAppVivaK_(adm);
  if (b.duerme) c.remove(k); else c.put(k, String(Date.now()), 600);
  if (b.push && typeof b.push.listo === 'boolean') {
    var clave = pushAppClave_(adm), l = pushAppListos_(), antes = !!l[clave];
    if (antes !== b.push.listo) {
      if (b.push.listo) l[clave] = 1; else delete l[clave];
      PropertiesService.getScriptProperties().setProperty(PUSH_APP_PROP_, JSON.stringify(l));
    }
  }
  var ll = pushAppLlaves_();
  if (ll && resp) resp.push = { app_id: ll.app, externo: pushAppExterno_(adm) };
}

/* vozAvisoPoner_ (voz.js), con el candado: ¿este aviso sale también por push? Sin leer hojas: llaves, push listo y app dormida. */
function pushAppToca_(adm, a) {
  if (!adm || !adm.email || !a || !pushAppLlaves_()) return false;
  if (!pushAppListos_()[pushAppClave_(adm)]) return false;
  return !!a.prueba || !pushAppDespierta_(adm);
}

/* Un identificador con forma de UUID que sale siempre igual del mismo aviso: OneSignal no manda dos veces el mismo
   (idempotency_key, 30 días) aunque dos disparos lo intenten. */
function pushAppUuid_(s) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s)).map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h.charAt(16), 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32);
}

/* Lo que va a OneSignal para un aviso (sin enviarlo). null si su tipo está apagado (no llega). */
function pushAppCuerpo_(adm, a, ll) {
  var rets = [], pends = [];
  try { rets = retLeer_(adm); } catch (e) {}
  try { pends = pendFilas_(); } catch (e) {}
  var s = vozAvisoSalida_(a, rets, pends, adm.nombre);   // lo mismo que la app recibiría en vozAvisos
  var tipo = notifTipo_({ tipo: a.tipo, origen: a.origen, nivel: s.nivel, conferencia: a.conferencia });
  var aj = notifAjustesDe_(adm.email)[tipo];
  if (!a.prueba && !notifLlega_(aj)) return { tipo: tipo, apagado: true };
  var ver = !!a.prueba || aj.vista === 'siempre';
  var texto = ver ? String(s.texto || '').replace(/\s+/g, ' ').trim().slice(0, 700) : NOTIF_GENERICO_;
  var datos = { id: String(a.id), tipo: tipo, aj: aj };
  if (a.prueba) datos.prueba = true;
  if (s.orbita) datos.orbita = s.orbita;   // al tocarla, la app abre el chat con ese id (#583 T1.3, lo mismo que un anillo)
  if (ver && s.titulo && s.lineas && s.lineas.length) { datos.titulo = String(s.titulo).slice(0, 60); datos.lineas = s.lineas.slice(0, 3); }
  return { tipo: tipo, body: {
    app_id: ll.app, target_channel: 'push', include_aliases: { external_id: [pushAppExterno_(adm)] },
    headings: { en: 'Alma', es: 'Alma' }, contents: { en: texto || NOTIF_GENERICO_, es: texto || NOTIF_GENERICO_ },
    data: { alma: datos }, mutable_content: true, thread_id: 'alma.retomar',
    ios_interruption_level: tipo === 'urgentes' || a.prueba ? 'time_sensitive' : 'active',
    collapse_id: String(a.id).slice(0, 64), idempotency_key: pushAppUuid_(pushAppClave_(adm) + '|' + a.id), ttl: PUSH_APP_TTL_ } };
}

/* vozAvisoPoner_ (voz.js), ya sin el candado: manda el push del aviso marcado. Si no sale, quita la marca. */
function pushAppMandar_(adm, a) {
  var ll = pushAppLlaves_();
  if (!ll) { pushAppDesmarcar_(adm, a.id); return { ok: false, error: 'sin llaves' }; }
  var c, r;
  try {
    c = pushAppCuerpo_(adm, a, ll);
    if (c.apagado) { logPush_(['app'], 'App · ' + c.tipo + ' · ' + a.id, 0, '', 0, 'apagado en sus ajustes (' + c.tipo + ')'); return { ok: true, apagado: c.tipo }; }
    /* Llaves nuevas (os_v2_…) usan 'Key'; las REST API Key antiguas, 'Basic'. Se prueba una y si OneSignal rechaza, la otra. */
    var f = function (pref) { return uf_('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: pref + ' ' + ll.key }, payload: JSON.stringify(c.body) }); };
    var p1 = /^os_v2_/.test(ll.key) ? 'Key' : 'Basic'; r = f(p1);
    if (r.getResponseCode() === 401 || r.getResponseCode() === 403) r = f(p1 === 'Key' ? 'Basic' : 'Key');
  } catch (e) {
    /* Sin red o sin cupo: el aviso vuelve a ser de la app, como si no hubiera push. */
    pushAppDesmarcar_(adm, a.id); logPush_(['app'], 'App · ' + ((c && c.tipo) || '') + ' · ' + a.id, 0, '', 0, String(e).slice(0, 200));
    return { ok: false, error: String(e) };
  }
  var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
  var code = r.getResponseCode(), errs = j.errors ? JSON.stringify(j.errors).slice(0, 300) : (code >= 300 ? String(r.getContentText()).slice(0, 300) : '');
  var ok = code < 300 && !!j.id && !j.errors;
  logPush_(['app'], 'App · ' + c.tipo + ' · ' + a.id, code, String(j.id || ''), ok ? -1 : 0, errs);
  if (!ok) {
    pushAppDesmarcar_(adm, a.id);
    /* OneSignal no conoce a este usuario en el iPhone: hasta que la app vuelva a decir que está lista, no se intenta. */
    if (/invalid_aliases|not subscribed|no.*subscri/i.test(errs)) {
      var l = pushAppListos_(); delete l[pushAppClave_(adm)];
      PropertiesService.getScriptProperties().setProperty(PUSH_APP_PROP_, JSON.stringify(l));
    }
  }
  return { ok: ok, http: code, id: String(j.id || ''), error: errs };
}

/* El push no salió: el aviso vuelve a ser solo de la app (la muestra al despertar) y del respaldo por WhatsApp. */
function pushAppDesmarcar_(adm, id) {
  var p = PropertiesService.getScriptProperties(), soltar = candadoTomar_(10000, { lanzar: true });
  try {
    var t = {}; try { t = JSON.parse(p.getProperty('VOZ_AVISOS') || '{}'); } catch (e) {}
    var l = t[adm.email] || [], cambio = false;
    l.forEach(function (x) { if (x && String(x.id) === String(id) && x.push) { delete x.push; cambio = true; } });
    if (cambio) { t[adm.email] = l; p.setProperty('VOZ_AVISOS', JSON.stringify(t)); }
  } finally { soltar(); }
}
