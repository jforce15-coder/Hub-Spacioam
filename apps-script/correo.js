/* ═══ CORREOS EN LA APP DE ALMA ══════════════════════════════════════════════════════════════════════════════
   Cada cuenta de correo (la personal, la de Spacio AM, la de cada proyecto) se conecta con un PUENTE: un Apps Script
   pequeñito que vive en esa misma cuenta (correo-puente/Código.gs). Cada 10 minutos lee lo nuevo y se lo manda al Hub
   con la llave de esa cuenta; al volver, se lleva lo que hay que hacer en su bandeja (marcar spam, archivar).
   Así no hace falta que Google verifique una app para leer Gmail, y funciona igual con @gmail.com y con Workspace.

   El Hub clasifica cada correo (sin guardar el cuerpo: solo remitente, asunto y un fragmento):
     · codigo        un código de verificación o de acceso (se muestra el código, listo para copiar)
     · verificacion  un enlace para confirmar el correo, una cuenta o un inicio de sesión
     · autorizacion  algo que pide tu aprobación de verdad (un pago, un acceso, una firma, un cargo)
     · promocion     publicidad, descuentos, ofertas, boletines
     · spam          posible spam: lo marcas tú (y de una vez te desuscribes)
     · normal        lo demás: va a su proyecto (Spacio AM, The Gentle Stoic Parent, Mi, tus proyectos) o a su área de vida
   Las reglas de guardado del departamento de Archivo valen aquí también (un código dura un día; una promoción, dos semanas).
   Hojas: ALMA_CORREO_CUENTAS (cada cuenta conectada y su llave) y ALMA_CORREOS. */

var CORREO_CUENTAS_CAB_ = ['cuenta', 'nombre', 'proyecto', 'llave', 'creada', 'ultima', 'acciones'];
var CORREOS_CAB_ = ['id', 'cuenta', 'hilo', 'de', 'de_nombre', 'asunto', 'fecha', 'fragmento', 'categoria', 'codigo', 'enlace', 'proyecto', 'area',
  'spam', 'unsub_url', 'unsub_mailto', 'unsub_un_clic', 'estado', 'recibido'];
var CORREO_CATS_ = ['codigo', 'verificacion', 'autorizacion', 'promocion', 'spam', 'normal'];
function hojaCorreoCuentas_() { return hojaCrear_('ALMA_CORREO_CUENTAS', CORREO_CUENTAS_CAB_); }
function hojaCorreos_() { return hojaCrear_('ALMA_CORREOS', CORREOS_CAB_); }

/* ── Las cuentas ── */
function correoCuentas_() { return agFilas_(hojaCorreoCuentas_(), CORREO_CUENTAS_CAB_); }
function correoCuenta_(cuenta) { cuenta = String(cuenta || '').trim().toLowerCase(); return correoCuentas_().filter(function (c) { return c.cuenta === cuenta; })[0] || null; }
/* Conectar una cuenta: crea su llave y devuelve el puente listo para pegar (con la llave y la dirección del Hub ya puestas). */
function correoConectar_(ses, b) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'Por ahora los correos son solo del administrador principal.' };
  var cuenta = String(b.cuenta || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cuenta)) return { ok: false, error: 'Escribe el correo completo (por ejemplo tu@gmail.com).' };
  var c = correoCuenta_(cuenta) || { cuenta: cuenta, creada: new Date().toISOString(), acciones: '[]' };
  c.nombre = String(b.nombre || c.nombre || cuenta).slice(0, 60); c.proyecto = String(b.proyecto || c.proyecto || '').slice(0, 60);
  if (!c.llave || b.nueva) c.llave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  agGuardar_(hojaCorreoCuentas_(), CORREO_CUENTAS_CAB_, c);
  return { ok: true, cuenta: cuenta, puente: correoPuenteCodigo_(c) };
}
function correoPuenteCodigo_(c) {
  var url = ScriptApp.getService().getUrl();
  var src = '';
  try { src = UrlFetchApp.fetch('https://hub.spacioam.com/correo-puente/Codigo.gs', { muteHttpExceptions: true }).getContentText(); } catch (e) {}
  if (!/function revisar/.test(src)) return { error: 'No pude leer el puente; ábrelo en hub.spacioam.com/correo-puente/Codigo.gs', url: url };
  return src.replace("var HUB = '';", "var HUB = '" + url + "';").replace("var CUENTA = '';", "var CUENTA = '" + c.cuenta + "';").replace("var LLAVE = '';", "var LLAVE = '" + c.llave + "';");
}

/* ── Lo que manda el puente: { correoPuente: 1, cuenta, llave, correos: [...] } → guarda, clasifica y devuelve las acciones pendientes ── */
function correoPuente_(b) {
  var c = correoCuenta_(b.cuenta);
  if (!c || !c.llave || String(b.llave || '') !== c.llave) return { ok: false, error: 'llave' };
  var sh = hojaCorreos_(), ya = {}, n = sh.getLastRow();
  if (n >= 2) sh.getRange(Math.max(2, n - 3000), 1, Math.min(n - 1, 3001), 1).getValues().forEach(function (v) { ya[String(v[0])] = 1; });
  var nuevos = (b.correos || []).slice(0, 60).filter(function (m) { return m && m.id && !ya[c.cuenta + '|' + m.id]; });
  var filas = correoClasificar_(c, nuevos).map(function (o) { return CORREOS_CAB_.map(function (k) { return o[k] != null ? o[k] : ''; }); });
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, CORREOS_CAB_.length).setValues(filas);
  /* lo que tiene que hacer el puente en su bandeja; se entrega una vez */
  var acciones = []; try { acciones = JSON.parse(c.acciones || '[]'); } catch (e) {}
  c.acciones = '[]'; c.ultima = new Date().toISOString(); agGuardar_(hojaCorreoCuentas_(), CORREO_CUENTAS_CAB_, c);
  /* lo que necesita algo de ti (una autorización) también llega como tema por retomar y notificación */
  filas.forEach(function (f) {
    var o = {}; CORREOS_CAB_.forEach(function (k, i) { o[k] = f[i]; });
    if (o.categoria === 'autorizacion') { try { var adm = agPrincipal_(), t = 'Te llegó un correo que pide tu autorización: «' + o.asunto + '» de ' + (o.de_nombre || o.de) + '.'; var it = retPoner_(adm, { texto: t, importancia: 3, origen: 'correo' }); vozAvisoPoner_(adm, t, it && it.id); } catch (e) {} }
  });
  return { ok: true, guardados: filas.length, acciones: acciones };
}

/* Primero las reglas claras (códigos, desuscripción, palabras de promoción); lo demás lo decide el modelo rápido en lote. */
function correoClasificar_(c, lista) {
  if (!lista.length) return [];
  var proys = []; try { proys = proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }).map(function (p) { return p.proyecto; }); } catch (e) {}
  var conocidos = ['Spacio AM', 'The Gentle Stoic Parent', 'Mi (contabilidad)'].concat(proys);
  var sys = 'Clasificas correos de Juan (fundador de Spacio AM, apartamentos de estadía corta en Guatemala). Para cada uno responde: ' +
    'c (categoría): codigo (trae un código de verificación, acceso o un solo uso), verificacion (un enlace para confirmar un correo, una cuenta o un inicio de sesión), ' +
    'autorizacion (pide de verdad su aprobación: un pago, un cargo, un acceso nuevo, una firma, un permiso; NO las promociones que dicen «aprueba»), ' +
    'promocion (publicidad, descuentos, ofertas, boletines, «aprovecha»), spam (sospechoso: premios, urgencias falsas, remitentes raros, phishing), normal (lo demás). ' +
    'code: el código exacto si es c = codigo. s: probabilidad de spam de 0 a 1. ' +
    'p (proyecto) si es normal o autorizacion: uno de [' + conocidos.join(' | ') + '] o "" si es personal. ' +
    'a (área de vida) si es personal: proposito, relaciones, finanzas, health, comunidad o espiritualidad. ' +
    (c.proyecto ? 'Esta cuenta es del proyecto «' + c.proyecto + '»: si no es claro, va ahí. ' : 'Esta cuenta es personal: puede traer cosas personales y de cualquier proyecto. ') +
    'Responde SOLO un JSON: {"1":{"c":"normal","code":"","s":0.05,"p":"Spacio AM","a":"proposito"},…}.';
  var bloque = function (m) {
    return 'De: ' + (m.de_nombre || '') + ' <' + (m.de || '') + '>\nAsunto: ' + String(m.asunto || '').slice(0, 200) +
      (m.unsub_url || m.unsub_mailto ? '\n(tiene enlace para desuscribirse)' : '') + '\n' + String(m.cuerpo || m.fragmento || '').replace(/\s+/g, ' ').slice(0, 700);
  };
  var j = {};
  for (var i = 0; i < lista.length; i += 15) {   // de 15 en 15
    var txt = lista.slice(i, i + 15).map(function (m, k) { return '### ' + (k + 1) + '\n' + bloque(m); }).join('\n\n'), t = '';
    try { t = claude_(CFG.MODELO_CLASIFICADOR, 900, sys, txt, 0, []); } catch (e) { console.error('correo clasificar: ' + e); }
    var r = {}; try { r = JSON.parse(String(t || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
    Object.keys(r).forEach(function (k) { j[String(Number(k) + i)] = r[k]; });
  }
  return lista.map(function (m, i) {
    var o = j[String(i + 1)] || {}, cat = CORREO_CATS_.indexOf(o.c) >= 0 ? o.c : 'normal';
    var cuerpo = String(m.cuerpo || m.fragmento || '');
    var code = String(o.code || '').trim() || (cat === 'codigo' ? ((cuerpo + ' ' + m.asunto).match(/\b(\d{4,8}|[A-Z0-9]{3,4}-[A-Z0-9]{3,4})\b/) || [])[1] || '' : '');
    var enlace = cat === 'verificacion' || cat === 'autorizacion' ? correoEnlace_(cuerpo) : '';
    var spam = Math.max(0, Math.min(1, Number(o.s) || 0)); if (cat === 'spam') spam = Math.max(spam, .7);
    return { id: c.cuenta + '|' + m.id, cuenta: c.cuenta, hilo: m.hilo || '', de: String(m.de || '').toLowerCase(), de_nombre: m.de_nombre || '', asunto: String(m.asunto || '').slice(0, 200),
      fecha: m.fecha || '', fragmento: String(m.fragmento || cuerpo).replace(/\s+/g, ' ').slice(0, 220), categoria: cat, codigo: String(code).slice(0, 20), enlace: enlace,
      proyecto: String(o.p || (cat === 'normal' ? c.proyecto : '') || '').slice(0, 60), area: areaOk_(o.a) ? o.a : '', spam: spam.toFixed(2),
      unsub_url: m.unsub_url || '', unsub_mailto: m.unsub_mailto || '', unsub_un_clic: m.unsub_un_clic ? 'si' : '', estado: 'nuevo', recibido: new Date().toISOString() };
  });
}
/* El enlace de acción del correo (confirmar, verificar, aprobar): el primero que lo parezca. */
function correoEnlace_(t) {
  var ls = String(t || '').match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  return ls.filter(function (u) { return /verif|confirm|activ|valid|approv|aprob|autoriz|login|signin|sign-in|magic|token|auth/i.test(u); })[0] || '';
}

/* ── La app: los correos ordenados por bandeja, con las reglas de guardado del Archivo ── */
function correos_(ses) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'Por ahora los correos son solo del administrador principal.' };
  var sh = hojaCorreos_(), n = sh.getLastRow(), L = [];
  if (n >= 2) sh.getRange(Math.max(2, n - 1500), 1, Math.min(n - 1, 1500), CORREOS_CAB_.length).getValues().forEach(function (v) {
    var o = {}; CORREOS_CAB_.forEach(function (k, i) { o[k] = v[i] instanceof Date ? v[i].toISOString() : String(v[i]); }); L.push(o);
  });
  var reglas = {}; try { reglas = archivistaReglas_(); } catch (e) {}
  L = L.filter(function (m) {
    if (m.estado === 'spam' || m.estado === 'desuscrito' || m.estado === 'archivado') return false;
    var e = archivistaEstado_(reglas, 'correo:' + m.categoria, '', '', m.fecha || m.recibido); return e.visible;
  }).reverse();
  var por = function (cat) { return L.filter(function (m) { return m.categoria === cat; }); };
  /* los posibles spam y las promociones se agrupan por remitente: una tarjeta por quién te escribe */
  var remitentes = function (lista) {
    var g = {}; lista.forEach(function (m) {
      var k = m.cuenta + '|' + m.de, x = g[k] || (g[k] = { de: m.de, de_nombre: m.de_nombre, cuenta: m.cuenta, total: 0, spam: 0, correos: [], unsub_url: '', unsub_mailto: '', unsub_un_clic: false });
      x.total++; x.spam = Math.max(x.spam, Number(m.spam) || 0); if (x.correos.length < 5) x.correos.push({ id: m.id, asunto: m.asunto, fragmento: m.fragmento, fecha: m.fecha });
      if (!x.unsub_url && m.unsub_url) { x.unsub_url = m.unsub_url; x.unsub_un_clic = m.unsub_un_clic === 'si'; } if (!x.unsub_mailto && m.unsub_mailto) x.unsub_mailto = m.unsub_mailto;
    });
    return Object.keys(g).map(function (k) { var x = g[k]; x.desuscribir = !!(x.unsub_url || x.unsub_mailto); return x; }).sort(function (a, b) { return b.spam - a.spam || b.total - a.total; });
  };
  var normales = por('normal'), proyectos = {};
  normales.forEach(function (m) { var k = m.proyecto || (m.area ? 'area:' + m.area : 'Personal'); (proyectos[k] = proyectos[k] || []).push(m); });
  var nomArea = {}; AREAS_.forEach(function (a) { nomArea['area:' + a.k] = a.n; });
  var posibles = L.filter(function (m) { return m.categoria === 'spam' || (m.categoria !== 'codigo' && m.categoria !== 'verificacion' && Number(m.spam) >= .6); });
  return { ok: true,
    cuentas: correoCuentas_().map(function (c) { return { cuenta: c.cuenta, nombre: c.nombre, proyecto: c.proyecto, ultima: c.ultima }; }),
    codigos: por('codigo').slice(0, 20), verificacion: por('verificacion').slice(0, 20), autorizacion: por('autorizacion').slice(0, 30),
    proyectos: Object.keys(proyectos).map(function (k) { return { k: k, n: nomArea[k] || k, correos: proyectos[k].slice(0, 40), total: proyectos[k].length }; }).sort(function (a, b) { return b.total - a.total; }),
    promociones: remitentes(por('promocion').filter(function (m) { return Number(m.spam) < .6; })).slice(0, 40),
    spam: remitentes(posibles).slice(0, 40) };
}

/* ── Lo que haces desde la app ──
   spam: marca como spam todo lo de ese remitente (el puente lo mueve a Spam en tu bandeja) y te desuscribe si se puede.
   desuscribir: si el remitente ofrece desuscripción de un clic (RFC 8058), la hace el Hub; si no, devuelve la página para abrirla.
   no_spam · archivar · leido: lo quita de la bandeja de Alma (archivar también lo archiva en Gmail). */
function correoAccion_(ses, b) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'solo admin principal' };
  var que = String(b.que || ''), cuenta = String(b.cuenta || '').toLowerCase(), de = String(b.de || '').toLowerCase(), id = String(b.id || '');
  var sh = hojaCorreos_(), n = sh.getLastRow(); if (n < 2) return { ok: false, error: 'sin correos' };
  var v = sh.getRange(2, 1, n - 1, CORREOS_CAB_.length).getValues(), ix = function (k) { return CORREOS_CAB_.indexOf(k); };
  var mios = []; v.forEach(function (r, i) { if ((id && r[0] === id) || (!id && String(r[ix('cuenta')]) === cuenta && String(r[ix('de')]) === de)) mios.push(i); });
  if (!mios.length) return { ok: false, error: 'no encontré esos correos' };
  var estado = { spam: 'spam', desuscribir: 'desuscrito', archivar: 'archivado', leido: 'archivado', no_spam: 'nuevo' }[que]; if (!estado) return { ok: false, error: 'acción' };
  var r0 = v[mios[0]], out = { ok: true };
  /* En spam de verdad, abrir su enlace de baja le confirma a quien lo mandó que tu correo existe: ahí solo se usa la
     desuscripción oficial de un clic; si no la trae, basta con mandarlo a Spam. */
  if (que === 'spam' || que === 'desuscribir') out.desuscripcion = correoDesuscribir_(r0[ix('unsub_url')], r0[ix('unsub_mailto')], r0[ix('unsub_un_clic')] === 'si', que === 'spam');
  mios.forEach(function (i) {
    sh.getRange(i + 2, ix('estado') + 1).setValue(estado);
    if (que === 'no_spam') { sh.getRange(i + 2, ix('spam') + 1).setValue('0'); if (v[i][ix('categoria')] === 'spam') sh.getRange(i + 2, ix('categoria') + 1).setValue('normal'); }
  });
  /* en la bandeja de Gmail: lo hace el puente en su próxima vuelta */
  if (que === 'spam' || que === 'archivar') {
    var c = correoCuenta_(r0[ix('cuenta')]);
    if (c) { var acc = []; try { acc = JSON.parse(c.acciones || '[]'); } catch (e) {}
      mios.forEach(function (i) { acc.push({ hilo: v[i][ix('hilo')], accion: que }); });
      c.acciones = JSON.stringify(acc.slice(-200)); agGuardar_(hojaCorreoCuentas_(), CORREO_CUENTAS_CAB_, c); }
  }
  out.cuantos = mios.length;
  return out;
}
/* Desuscripción: de un clic si el remitente lo permite (POST «List-Unsubscribe=One-Click»); si no, la página para abrirla
   en el navegador de la app, o el correo de baja. Nunca se sigue un enlace de un correo sin la cabecera oficial. */
function correoDesuscribir_(url, mailto, unClic, soloUnClic) {
  if (url && unClic && /^https:\/\//i.test(url)) {
    try {
      var r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/x-www-form-urlencoded', payload: 'List-Unsubscribe=One-Click', muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() < 400) return { hecha: true, como: 'un clic' };
    } catch (e) { console.error('desuscribir: ' + e); }
  }
  if (soloUnClic) return { hecha: false, sin_enlace: !url && !mailto, solo_spam: !!(url || mailto) };
  if (url && /^https?:\/\//i.test(url)) return { hecha: false, abrir: url };
  if (mailto) return { hecha: false, mailto: mailto };
  return { hecha: false, sin_enlace: true };
}

/* Para la app: { accion: 'lista' | 'conectar' | 'hacer' } */
function correoApi_(ses, b) {
  var a = String(b.accion || 'lista');
  if (a === 'conectar') return correoConectar_(ses, b);
  if (a === 'hacer') return correoAccion_(ses, b);
  return correos_(ses);
}
