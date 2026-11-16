/* ═══ AJUSTES DE NOTIFICACIONES POR TIPO (#551) ════════════════════════════════════════════════════════════════════
   Juan, 16-nov-2026: «ajustes como los de WhatsApp en iOS», por tipo (diseño B), y que Siri anuncie las notificaciones de
   la app de Alma sin pisar la voz de Alma. Pantalla: alma/avisos.html (la lista de tipos y, al tocar uno, sus ajustes).
     · Tipos (NOTIF_TIPOS_): urgentes, huéspedes, equipo, socios y pendientes de Alma. Cada notificación cae en UNO, y
       solo aquí se decide en cuál (notifTipo_): lo urgente (nivel 1) va a «Urgentes» venga de donde venga, salvo lo que él
       pidió en conferencia; después, por su tipo y su origen.
     · Ajuste de un tipo: bloqueada, centro y banner (dónde se ve; los tres apagados = no llega), sonido, número en el ícono,
       anunciar con Siri, vista previa (siempre · desbloqueado · nunca) y agrupar (auto · tipo · no).
     · Se guardan por usuario (su correo, con la sesión verificada) en la propiedad NOTIF_AJUSTES; lo que no cambió queda de
       fábrica (NOTIF_FABRICA_). Nunca con la llave vieja del Hub: sin sesión, no se lee ni se guarda nada.
     · La app de Alma los recibe en vozAvisos (voz.js: notif_ajustes y notif_tipo en cada aviso) y arma cada notificación con
       ellos (AjustesNotif.swift). Siri solo con la app cerrada o en segundo plano y fuera de conferencia y Modo calle.
     · El Hub web (OneSignal, pushA_ y pushNuevo_ en Código.js) respeta «llega o no» y la vista previa; sonido, número,
       Siri y agrupar son del iPhone. Al guardar, las etiquetas n_<tipo> del usuario en OneSignal quedan al día
       (si · oculto · no) para los avisos que van a todos.
   Check con dobles: .github/notif-ajustes.js. */
var NOTIF_TIPOS_ = [
  { k: 'urgentes', n: 'Urgentes', d: 'Lo que no puede esperar: un huésped esperando al equipo, una promesa vencida o lo que vigilas.' },
  { k: 'huespedes', n: 'Huéspedes', d: 'Mensajes, casos y cambios de reserva de los huéspedes.' },
  { k: 'equipo', n: 'Equipo', d: 'Lo que te pide o te cuenta el equipo, y los encargos que cumplen.' },
  { k: 'socios', n: 'Socios', d: 'Lo que te piden los socios.' },
  { k: 'pendientes', n: 'Pendientes de Alma', d: 'Lo que Alma terminó o necesita de ti: cambios, correos, vuelos, vigilancias.' }
];
var NOTIF_VISTAS_ = ['siempre', 'desbloqueado', 'nunca'];
var NOTIF_AGRUPAR_ = ['auto', 'tipo', 'no'];
var NOTIF_PROP_ = 'NOTIF_AJUSTES';   // { correo: { tipo: ajuste } }
/* De fábrica: todo llega como hoy (bloqueada, centro, banner, sonido y número). Siri, de entrada, solo lo urgente. */
function notifFabrica_(k) {
  return { bloqueada: true, centro: true, banner: true, sonido: true, numero: true, siri: k === 'urgentes', vista: 'siempre', agrupar: 'auto' };
}
function notifTipoOk_(k) { return NOTIF_TIPOS_.some(function (t) { return t.k === k; }); }

/* EL ÚNICO LUGAR que decide el tipo de una notificación. a: { tipo (el de avisotexto.js), origen (pendientes, pushA_),
   nivel (1 urgente · 2 acción · 3 aviso), conferencia }. Sin nada que la ubique: «Pendientes de Alma». */
var NOTIF_ORIGEN_ = {
  huespedes: ['rojo', 'escalado', 'promesa', 'decision', 'huesped', 'reserva', 'mensaje'],
  equipo: ['chat', 'encargo', 'equipo', 'recepcion'],
  socios: ['socio']
};
function notifTipo_(a) {
  a = a || {};
  var t = String(a.tipo || ''), o = String(a.origen || '');
  if (Number(a.nivel) === 1 && !a.conferencia) return 'urgentes';
  if (/^(huesped|promesa)_/.test(t) || NOTIF_ORIGEN_.huespedes.indexOf(o) >= 0) return 'huespedes';
  if (/^socio_/.test(t) || NOTIF_ORIGEN_.socios.indexOf(o) >= 0) return 'socios';
  if (/^equipo_/.test(t) || NOTIF_ORIGEN_.equipo.indexOf(o) >= 0) return 'equipo';
  return 'pendientes';
}

/* Un ajuste limpio: solo las llaves conocidas, con su tipo; lo que falta o no sirve, de fábrica. */
function notifLimpio_(k, x) {
  var f = notifFabrica_(k), o = {}; x = x && typeof x === 'object' ? x : {};
  ['bloqueada', 'centro', 'banner', 'sonido', 'numero', 'siri'].forEach(function (c) { o[c] = typeof x[c] === 'boolean' ? x[c] : f[c]; });
  o.vista = NOTIF_VISTAS_.indexOf(x.vista) >= 0 ? x.vista : f.vista;
  o.agrupar = NOTIF_AGRUPAR_.indexOf(x.agrupar) >= 0 ? x.agrupar : f.agrupar;
  return o;
}
function notifTodos_() { var t = {}; try { t = JSON.parse(PropertiesService.getScriptProperties().getProperty(NOTIF_PROP_) || '{}') || {}; } catch (e) {} return t; }
/* Los ajustes de un correo: los 5 tipos, con lo de fábrica donde no cambió nada. */
function notifAjustesDe_(email, todos) {
  var mios = (todos || notifTodos_())[String(email || '').trim().toLowerCase()] || {}, out = {};
  NOTIF_TIPOS_.forEach(function (t) { out[t.k] = notifLimpio_(t.k, mios[t.k]); });
  return out;
}
/* ¿Llega? Con los tres lugares apagados (bloqueada, centro y banner), no. */
function notifLlega_(aj) { return !!(aj && (aj.bloqueada || aj.centro || aj.banner)); }

/* Quién guarda: el correo de la sesión verificada (el del administrador si entra con un alterno). Sin sesión, nadie. */
function notifQuien_(ses) {
  if (!ses || typeof ses !== 'object' || !String(ses.email || '').trim()) return '';
  var adm = null; try { adm = vozWebAdmin_(ses); } catch (e) {}
  return String((adm && adm.email) || ses.email).trim().toLowerCase();
}

/* Acción notifAjustes: la lista de tipos con sus ajustes. */
function notifAjustesApi_(ses) {
  var email = notifQuien_(ses); if (!email) return { ok: false, error: 'Entra con tu usuario para ver tus notificaciones.' };
  var aj = notifAjustesDe_(email);
  return { ok: true, tipos: NOTIF_TIPOS_.map(function (t) { return { k: t.k, nombre: t.n, que: t.d, ajuste: aj[t.k] }; }) };
}
/* Acción notifAjustesGuardar { tipo, ajuste }: guarda el ajuste de un tipo y deja al día las etiquetas de OneSignal. */
function notifAjustesGuardarApi_(ses, b) {
  var email = notifQuien_(ses); if (!email) return { ok: false, error: 'Entra con tu usuario para cambiar tus notificaciones.' };
  b = b || {}; var k = String(b.tipo || '');
  if (!notifTipoOk_(k)) return { ok: false, error: 'tipo' };
  var aj = notifLimpio_(k, b.ajuste), p = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock(), todos;
  lock.waitLock(10000);
  try {
    todos = notifTodos_(); todos[email] = todos[email] || {}; todos[email][k] = aj;
    p.setProperty(NOTIF_PROP_, JSON.stringify(todos));
  } finally { lock.releaseLock(); }
  var web = false; try { web = notifOSEtiquetas_(email, notifAjustesDe_(email, todos)); } catch (e) { console.error('notifOSEtiquetas_: ' + e); }
  return { ok: true, tipo: k, ajuste: aj, web: web };
}

/* Acción notifPrueba (Juan, 16-nov-2026): «Probar con Siri» desde el Hub web (en la app, el botón la programa ella misma a
   los 15 s). Solo el administrador principal con su sesión. Deja en la cola de la app (VOZ_AVISOS) un aviso de prueba que
   no se dice en voz alta, no entra al historial ni gasta voz de ElevenLabs; la app lo recoge con vozAvisos (cada 45 s, si
   está abierta o en segundo plano) y lo arma como mensaje de Alma con Siri (NotifArmar.swift, probarSiri). */
var NOTIF_PRUEBA_TEXTO_ = 'Prueba: si Siri te lee esto, los anuncios funcionan.';
function notifPruebaApi_(ses) {
  if (!ses || typeof ses !== 'object' || !String(ses.email || '').trim()) return { ok: false, error: 'Entra con tu usuario para probar.' };
  var prin = paraClaudePrincipalSes_(ses);
  if (!prin) return { ok: false, error: 'Solo el administrador principal prueba los anuncios de Siri.' };
  var adm = null; try { adm = vozWebAdmin_(ses); } catch (e) {}
  adm = adm && adm.email ? adm : prin;
  vozAvisoPoner_(adm, NOTIF_PRUEBA_TEXTO_, 'prueba-siri-' + Date.now(), { nivel: 3, historial: false, prueba: true, origen: 'prueba' });
  return { ok: true, en: 45 };
}

/* ── Hub web (OneSignal) ──────────────────────────────────────────────────────────────────────────────────────────
   Lo que la web puede cumplir: si llega y si se ve lo que dice. La web no sabe si el teléfono está bloqueado: «solo
   desbloqueado» se trata como «nunca» (texto genérico), para no mostrar de más. */
var NOTIF_GENERICO_ = 'Alma te dejó un mensaje';
function notifWebModo_(aj) { return !notifLlega_(aj) ? 'no' : aj.vista === 'siempre' ? 'si' : 'oculto'; }
/* Las etiquetas del usuario en OneSignal (todas sus suscripciones): n_<tipo> = si · oculto · no. true si quedaron. */
function notifOSEtiquetas_(email, aj) {
  var p = PropertiesService.getScriptProperties(), app = p.getProperty('ONESIGNAL_APP_ID'), key = p.getProperty('ONESIGNAL_KEY');
  if (!app || !key || !email) return false;
  var tags = {}; NOTIF_TIPOS_.forEach(function (t) { tags['n_' + t.k] = notifWebModo_(aj[t.k]); });
  var url = 'https://api.onesignal.com/apps/' + encodeURIComponent(app) + '/users/by/external_id/' + encodeURIComponent(String(email).toLowerCase());
  var f = function (pref) { return uf_(url, { method: 'patch', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: pref + ' ' + key }, payload: JSON.stringify({ properties: { tags: tags } }) }); };
  var p1 = /^os_v2_/.test(key) ? 'Key' : 'Basic', r = f(p1);
  if (r.getResponseCode() === 401 || r.getResponseCode() === 403) r = f(p1 === 'Key' ? 'Basic' : 'Key');
  return r.getResponseCode() < 300;
}
/* Un aviso a correos con nombre (pushA_): quién lo recibe completo, quién genérico y quién no (lo apagó). */
function notifWebPara_(emails, de) {
  var k = notifTipo_(de), todos = notifTodos_(), out = { tipo: k, si: [], oculto: [], no: [] };
  (emails || []).forEach(function (e) { out[notifWebModo_(notifAjustesDe_(e, todos)[k])].push(e); });
  return out;
}
/* Un aviso a todos (filtros de OneSignal): base = grupos que ya tenía (cada grupo es Y; entre grupos, O). Devuelve los
   envíos que hacen falta: el completo a quien no lo cambió o lo tiene en «si», el genérico a quien lo tiene en «oculto»;
   quien lo tiene en «no» queda fuera. Si nadie cambió ese tipo, un solo envío como antes (sin filtros nuevos). */
function notifWebTodos_(de, base) {
  var k = notifTipo_(de), todos = notifTodos_(), hay = { oculto: false, no: false };
  Object.keys(todos).forEach(function (e) { var m = notifWebModo_(notifAjustesDe_(e, todos)[k]); if (m !== 'si') hay[m] = true; });
  if (!hay.oculto && !hay.no) return [{ generico: false, filtros: notifOSUnir_(base || [], null) }];
  var tag = 'n_' + k, envios = [{ generico: false, filtros: notifOSUnir_(base || [], [[{ field: 'tag', key: tag, relation: 'not_exists' }], [{ field: 'tag', key: tag, relation: '=', value: 'si' }]]) }];
  if (hay.oculto) envios.push({ generico: true, filtros: notifOSUnir_(base || [], [[{ field: 'tag', key: tag, relation: '=', value: 'oculto' }]]) });
  return envios;
}
/* (A1 o A2 …) y (B1 o B2 …) → A1B1 o A1B2 o A2B1 …, en la forma de OneSignal (grupos separados por { operator: 'OR' }).
   Sin grupos de ninguno de los dos lados: null (el envío usa los segmentos de siempre). */
function notifOSUnir_(a, b) {
  var ga = a && a.length ? a : [[]], gb = b && b.length ? b : [[]], out = [];
  if (!(a && a.length) && !(b && b.length)) return null;
  ga.forEach(function (x) { gb.forEach(function (y) { if (out.length) out.push({ operator: 'OR' }); x.concat(y).forEach(function (f) { out.push(f); }); }); });
  return out;
}

/* ── App de Alma (vozAvisos, voz.js) ──────────────────────────────────────────────────────────────────────────────
   A cada aviso de la salida le pone su tipo (notif_tipo) y a la respuesta, los ajustes (notif_ajustes) y el número del
   ícono (numero: los temas por retomar de los tipos con «Número en el ícono»). crudos: la cola guardada, en el mismo orden. */
function notifAvisos_(adm, crudos, salida, rets, resp) {
  var aj = notifAjustesDe_(adm && adm.email);
  (salida || []).forEach(function (o, i) {
    var a = (crudos || [])[i] || {};
    o.notif_tipo = notifTipo_({ tipo: a.tipo, origen: a.origen, nivel: o.nivel, conferencia: a.conferencia });
  });
  resp.notif_ajustes = aj;
  resp.numero = (rets || []).filter(function (x) { return aj[notifTipo_({ origen: x && x.origen })].numero; }).length;
  return resp;
}
