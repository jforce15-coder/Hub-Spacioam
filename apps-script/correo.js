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
   ALMA RESPONDE: desde la app puedes involucrar a Alma en un hilo. El puente le trae el hilo completo, Alma redacta la
   respuesta (en nombre del proyecto de esa cuenta, p. ej. Spacio AM) y te la deja lista para enviar con un toque, o la
   manda sola si así lo pediste. Mientras siga involucrada, cada respuesta nueva en ese hilo trae otro borrador.
   BANDEJA EN CERO (inbox zero): cada correo normal trae su siguiente paso — responder, leer, esperar o nada (solo para
   que sepas) — y si es urgente. La app muestra primero lo que pide respuesta; lo demás se lee, se pospone («recuérdamelo
   mañana») o se archiva en lote (también en Gmail). Los hilos que Alma respondió y siguen sin respuesta a los 3 días
   aparecen para darles seguimiento.
   ENTREGA (deliverability) de lo que Alma manda: texto simple, sin acortadores ni enlaces que no vengan del hilo; nunca
   responde a direcciones no-reply, a respuestas automáticas (evita bucles) ni a quien marcaste como spam o te desuscribiste;
   las respuestas solas tienen un tope diario por cuenta (lo demás queda como borrador); y para los dominios propios
   (spacioam.com) revisa SPF, DKIM y DMARC y te dice qué falta.
   Hojas: ALMA_CORREO_CUENTAS (cada cuenta conectada y su llave), ALMA_CORREOS y ALMA_CORREO_HILOS (los hilos de Alma). */

var CORREO_CUENTAS_CAB_ = ['cuenta', 'nombre', 'proyecto', 'llave', 'creada', 'ultima', 'acciones'];
var CORREOS_CAB_ = ['id', 'cuenta', 'hilo', 'de', 'de_nombre', 'asunto', 'fecha', 'fragmento', 'categoria', 'codigo', 'enlace', 'proyecto', 'area',
  'spam', 'unsub_url', 'unsub_mailto', 'unsub_un_clic', 'estado', 'recibido', 'accion', 'urgente', 'auto', 'hasta'];
var CORREO_CATS_ = ['codigo', 'verificacion', 'autorizacion', 'promocion', 'spam', 'normal'];
function hojaCorreoCuentas_() { return hojaCrear_('ALMA_CORREO_CUENTAS', CORREO_CUENTAS_CAB_); }
function hojaCorreos_() {
  var sh = hojaCrear_('ALMA_CORREOS', CORREOS_CAB_);
  if (sh.getLastColumn() < CORREOS_CAB_.length) sh.getRange(1, 1, 1, CORREOS_CAB_.length).setValues([CORREOS_CAB_]);   // columnas nuevas (bandeja en cero)
  return sh;
}
var CORREO_ACCIONES_ = ['responder', 'leer', 'esperar', 'nada'], CORREO_SOLA_MAX_DIA_ = 25;
/* A quién Alma nunca le responde: no-reply, sistemas, y quien marcaste como spam o de quien te desuscribiste. */
function correoNoResponder_(cuenta, dir) {
  dir = String(dir || '').toLowerCase();
  if (/(^|[._+-])(no-?reply|do-?not-?reply|noresponder|mailer-daemon|postmaster|bounce|notificaciones?|notifications?)([._+-]|@)/.test(dir)) return 'es una dirección que no recibe respuestas';
  var sh = hojaCorreos_(), n = sh.getLastRow(); if (n < 2) return '';
  var ix = function (k) { return CORREOS_CAB_.indexOf(k); }, malo = '';
  sh.getRange(Math.max(2, n - 3000), 1, Math.min(n - 1, 3001), CORREOS_CAB_.length).getValues().forEach(function (v) {
    if (String(v[ix('cuenta')]) === cuenta && String(v[ix('de')]) === dir && (v[ix('estado')] === 'spam' || v[ix('estado')] === 'desuscrito')) malo = 'lo marcaste como spam o te desuscribiste';
  });
  return malo;
}
/* Respuestas que Alma manda sola hoy desde una cuenta (tope diario: lo demás queda como borrador). */
function correoSolaHoy_(cuenta, sumar) {
  var k = 'CORREO_SOLA_' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd') + '_' + cuenta, p = PropertiesService.getScriptProperties(), n = Number(p.getProperty(k) || 0);
  if (sumar) p.setProperty(k, String(n + 1));
  return n;
}
var CORREO_HILOS_CAB_ = ['hilo', 'cuenta', 'asunto', 'estado', 'instruccion', 'borrador', 'sola', 'actualizado', 'enviados'];
function hojaCorreoHilos_() { return hojaCrear_('ALMA_CORREO_HILOS', CORREO_HILOS_CAB_); }
function correoHilos_() { return agFilas_(hojaCorreoHilos_(), CORREO_HILOS_CAB_); }
function correoHilo_(cuenta, hilo) { return correoHilos_().filter(function (h) { return h.cuenta === cuenta && h.hilo === hilo; })[0] || null; }
/* Lo que el puente tiene que hacer en Gmail (se entrega en su próxima vuelta). */
function correoEncolar_(c, accs) {
  var acc = []; try { acc = JSON.parse(c.acciones || '[]'); } catch (e) {}
  c.acciones = JSON.stringify(acc.concat(accs).slice(-200)); agGuardar_(hojaCorreoCuentas_(), CORREO_CUENTAS_CAB_, c);
}

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
  /* el puente trajo hilos completos que Alma tiene que responder */
  var deHilos = [];
  (b.hilos || []).slice(0, 5).forEach(function (h) { try { deHilos = deHilos.concat(correoRedactar_(c, h)); } catch (e) { console.error('correo redactar: ' + e); } });
  /* alguien contestó en un hilo donde Alma está involucrada: que lo traiga para otro borrador */
  var vivos = {}; correoHilos_().forEach(function (h) { if (h.cuenta === c.cuenta && (h.estado === 'enviado' || h.estado === 'borrador')) vivos[h.hilo] = h; });
  var releer = {}; nuevos.forEach(function (m) { if (vivos[m.hilo] && !m.auto) releer[m.hilo] = 1; });   // una respuesta automática no pide otro borrador (evita bucles)
  /* lo que tiene que hacer el puente en su bandeja; se entrega una vez */
  var acciones = []; try { acciones = JSON.parse(c.acciones || '[]'); } catch (e) {}
  acciones = acciones.concat(deHilos, Object.keys(releer).map(function (h) { return { hilo: h, accion: 'leer' }; }));
  c.acciones = '[]'; c.ultima = new Date().toISOString(); agGuardar_(hojaCorreoCuentas_(), CORREO_CUENTAS_CAB_, c);
  /* lo que necesita algo de ti (una autorización) también llega como tema por retomar y notificación */
  filas.forEach(function (f) {
    var o = {}; CORREOS_CAB_.forEach(function (k, i) { o[k] = f[i]; });
    if (o.categoria === 'autorizacion') { try { var adm = agPrincipal_(), t = 'Te llegó un correo que pide tu autorización: «' + o.asunto + '» de ' + (o.de_nombre || o.de) + '.'; if (!pendAvisar_(adm, t, { origen: 'correo', tipo: 'atencion' })) { var it = retPoner_(adm, { texto: t, importancia: 3, origen: 'correo' }); vozAvisoPoner_(adm, t, it && it.id); } } catch (e) {} }
  });
  return { ok: true, guardados: filas.length, acciones: acciones };
}

/* Involucrar a Alma en un hilo (desde la app): pide el hilo completo al puente. */
function correoInvolucrar_(ses, b) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'solo admin principal' };
  var sh = hojaCorreos_(), n = sh.getLastRow(), id = String(b.id || ''), m = null;
  if (n >= 2) sh.getRange(2, 1, n - 1, CORREOS_CAB_.length).getValues().forEach(function (v) { if (v[0] === id) { m = {}; CORREOS_CAB_.forEach(function (k, i) { m[k] = String(v[i]); }); } });
  if (!m || !m.hilo) return { ok: false, error: 'No encontré ese correo.' };
  var c = correoCuenta_(m.cuenta); if (!c) return { ok: false, error: 'Esa cuenta ya no está conectada.' };
  var no = correoNoResponder_(m.cuenta, m.de); if (no && !b.seguimiento) return { ok: false, error: 'Alma no responde a ' + m.de + ': ' + no + '.' };
  var h = correoHilo_(m.cuenta, m.hilo) || { hilo: m.hilo, cuenta: m.cuenta, enviados: 0 };
  h.asunto = m.asunto; h.estado = 'esperando_hilo'; h.instruccion = String(b.instruccion || '').slice(0, 1000); h.sola = b.sola ? 'si' : ''; h.borrador = ''; h.actualizado = new Date().toISOString();
  agGuardar_(hojaCorreoHilos_(), CORREO_HILOS_CAB_, h);
  correoEncolar_(c, [{ hilo: m.hilo, accion: 'leer' }]);
  return { ok: true };
}
/* Alma redacta la respuesta con el hilo completo. Firma como el proyecto de la cuenta (Spacio AM) o como asistente de Juan.
   Si es «sola», devuelve la acción de responder para el puente; si no, deja el borrador para que lo apruebes. */
function correoRedactar_(c, h) {
  var row = correoHilo_(c.cuenta, String(h.hilo || '')); if (!row || row.estado === 'soltado' || row.estado === 'descartado') return [];
  var msgs = (h.mensajes || []).slice(-8);
  if (!msgs.length) return [];
  var ult = msgs[msgs.length - 1];
  if (ult.auto && row.estado !== 'esperando_hilo') return [];   // respuesta automática (fuera de oficina, aviso): no se contesta
  if (String(ult.de || '').toLowerCase().indexOf(c.cuenta) >= 0 && row.estado !== 'esperando_hilo') return [];   // lo último es nuestro: nada que responder
  var quien = c.proyecto ? 'Alma, del equipo de ' + c.proyecto : 'Alma, asistente de Juan';
  var firma = c.proyecto ? '\n\nAlma\n' + c.proyecto : '\n\nAlma\nAsistente de Juan Ovalle';
  var sys = 'Eres ' + quien + '. Respondes un hilo de correo en nombre de ' + (c.proyecto || 'Juan') + ' (Spacio AM: apartamentos de estadía corta en Guatemala). ' +
    'Escribe SOLO el cuerpo del correo de respuesta, en el idioma del último mensaje, cálido, claro y breve, con saludo por el nombre. ' +
    'No inventes datos (precios, fechas, disponibilidad, direcciones, códigos): si hace falta uno que no está en el hilo ni en las instrucciones, dilo con naturalidad («te confirmo en breve») y no lo prometas. ' +
    'Texto simple (sin formato), sin acortadores de enlaces y sin enlaces que no estén en el hilo o en las instrucciones. ' +
    'No firmes: la firma se agrega sola.' + (row.instruccion ? '\nINSTRUCCIONES DE JUAN: ' + row.instruccion : '');
  try { sys += audienciaBloque_('externo'); } catch (e) {}
  var hilo = msgs.map(function (x) { return 'De: ' + x.de + ' · ' + String(x.fecha || '').slice(0, 16) + '\n' + String(x.cuerpo || '').replace(/\n>.*$/gm, '').slice(0, 3000); }).join('\n\n---\n\n');
  var t = String(claude_(CFG.MODELO_REDACTOR, 900, sys, 'Asunto: ' + row.asunto + '\n\n' + hilo, 0.4, []) || '').trim();
  if (!t) return [];
  t = t.replace(/\n+(saludos|atentamente|un abrazo)[^\n]*\n+alma[\s\S]*$/i, '') + firma;
  row.actualizado = new Date().toISOString();
  if (row.sola === 'si' && correoSolaHoy_(c.cuenta) < CORREO_SOLA_MAX_DIA_) {
    correoSolaHoy_(c.cuenta, true);
    row.estado = 'enviado'; row.borrador = t; row.enviados = Number(row.enviados || 0) + 1; agGuardar_(hojaCorreoHilos_(), CORREO_HILOS_CAB_, row);
    return [{ hilo: row.hilo, accion: 'responder', texto: t }];
  }
  row.estado = 'borrador'; row.borrador = t; agGuardar_(hojaCorreoHilos_(), CORREO_HILOS_CAB_, row);
  try { var adm = agPrincipal_(), av = 'Te dejé lista la respuesta al correo «' + row.asunto + '». Revísala en Tus correos y la mando con un toque.'; if (!pendAvisar_(adm, av, { origen: 'correo', tipo: 'atencion' })) { var it = retPoner_(adm, { texto: av, importancia: 2, origen: 'correo' }); vozAvisoPoner_(adm, av, it && it.id); } } catch (e) {}
  return [];
}
/* Lo que haces con un hilo de Alma: enviar (con tu edición), descartar el borrador o soltarlo (Alma deja de seguirlo). */
function correoHiloAccion_(ses, b) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'solo admin principal' };
  var h = correoHilo_(String(b.cuenta || '').toLowerCase(), String(b.hilo || '')); if (!h) return { ok: false, error: 'No encontré ese hilo.' };
  var c = correoCuenta_(h.cuenta); if (!c) return { ok: false, error: 'Esa cuenta ya no está conectada.' };
  if (b.que === 'enviar') {
    var t = String(b.texto || h.borrador || '').trim(); if (!t) return { ok: false, error: 'No hay nada que enviar.' };
    correoEncolar_(c, [{ hilo: h.hilo, accion: 'responder', texto: t }]);
    h.estado = 'enviado'; h.borrador = t; h.enviados = Number(h.enviados || 0) + 1;
  } else if (b.que === 'descartar') { h.estado = 'descartado'; h.borrador = ''; }
  else if (b.que === 'soltar') { h.estado = 'soltado'; h.borrador = ''; }
  else if (b.que === 'seguimiento') {   // sin respuesta desde hace días: Alma redacta un seguimiento corto y amable
    h.estado = 'esperando_hilo'; h.sola = ''; h.borrador = ''; h.instruccion = 'Seguimiento: no hemos recibido respuesta. Escribe un seguimiento corto y amable que retome lo último que dijimos.';
    correoEncolar_(c, [{ hilo: h.hilo, accion: 'leer' }]);
  }
  else return { ok: false, error: 'acción' };
  h.actualizado = new Date().toISOString(); agGuardar_(hojaCorreoHilos_(), CORREO_HILOS_CAB_, h);
  return { ok: true, estado: h.estado };
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
    'x (siguiente paso, solo si es normal o autorizacion): responder (una persona le pregunta o pide algo a él), leer (vale la pena leerlo, no pide respuesta), ' +
    'esperar (él espera algo de otro: un envío, una confirmación en camino) o nada (solo para que sepa: avisos, recibos, notificaciones). u: true si es urgente (hoy o mañana, dinero, un huésped esperando). ' +
    (c.proyecto ? 'Esta cuenta es del proyecto «' + c.proyecto + '»: si no es claro, va ahí. ' : 'Esta cuenta es personal: puede traer cosas personales y de cualquier proyecto. ') +
    'Responde SOLO un JSON: {"1":{"c":"normal","code":"","s":0.05,"p":"Spacio AM","a":"proposito","x":"responder","u":false},…}.';
  var bloque = function (m) {
    return 'De: ' + (m.de_nombre || '') + ' <' + (m.de || '') + '>\nAsunto: ' + String(m.asunto || '').slice(0, 200) +
      (m.unsub_url || m.unsub_mailto ? '\n(tiene enlace para desuscribirse)' : '') + (m.auto ? '\n(mensaje automático)' : '') + '\n' + String(m.cuerpo || m.fragmento || '').replace(/\s+/g, ' ').slice(0, 700);
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
      unsub_url: m.unsub_url || '', unsub_mailto: m.unsub_mailto || '', unsub_un_clic: m.unsub_un_clic ? 'si' : '', estado: 'nuevo', recibido: new Date().toISOString(),
      accion: cat === 'normal' || cat === 'autorizacion' ? (CORREO_ACCIONES_.indexOf(o.x) >= 0 ? (m.auto && o.x === 'responder' ? 'leer' : o.x) : 'leer') : 'nada',
      urgente: o.u === true ? 'si' : '', auto: m.auto ? 'si' : '', hasta: '' };
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
    if (m.estado === 'pospuesto' && new Date(m.hasta).getTime() > Date.now()) return false;   // vuelve cuando se cumple el plazo
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
  /* bandeja en cero: lo que pide respuesta primero (lo urgente arriba); lo que Alma ya está respondiendo no se repite */
  var enHilo = {}; correoHilos_().forEach(function (h) { if (h.estado !== 'soltado' && h.estado !== 'descartado') enHilo[h.cuenta + '|' + h.hilo] = 1; });
  var responder = L.filter(function (m) { return (m.categoria === 'normal' || m.categoria === 'autorizacion') && m.accion === 'responder' && !enHilo[m.cuenta + '|' + m.hilo]; })
    .sort(function (a, b) { return (b.urgente === 'si') - (a.urgente === 'si'); });
  var fyi = L.filter(function (m) { return m.categoria === 'normal' && m.accion === 'nada'; });
  var normales = por('normal').filter(function (m) { return m.accion !== 'responder' && m.accion !== 'nada'; }), proyectos = {};
  normales.forEach(function (m) { var k = m.proyecto || (m.area ? 'area:' + m.area : 'Personal'); (proyectos[k] = proyectos[k] || []).push(m); });
  var nomArea = {}; AREAS_.forEach(function (a) { nomArea['area:' + a.k] = a.n; });
  var posibles = L.filter(function (m) { return m.categoria === 'spam' || (m.categoria !== 'codigo' && m.categoria !== 'verificacion' && Number(m.spam) >= .6); });
  var hilos = correoHilos_().filter(function (h) { return h.estado === 'borrador' || h.estado === 'esperando_hilo' || h.estado === 'enviado'; })
    .sort(function (a, b) { return String(b.actualizado).localeCompare(String(a.actualizado)); }).slice(0, 20)
    .map(function (h) { return { hilo: h.hilo, cuenta: h.cuenta, asunto: h.asunto, estado: h.estado, borrador: h.borrador, sola: h.sola === 'si', actualizado: h.actualizado,
      seguimiento: h.estado === 'enviado' && Date.now() - new Date(h.actualizado).getTime() > 3 * 86400000 }; });
  var resumen = { responder: responder.length, autorizacion: por('autorizacion').length, leer: normales.length, fyi: fyi.length, seguimiento: hilos.filter(function (h) { return h.seguimiento; }).length };
  return { ok: true, hilos: hilos, resumen: resumen, responder: responder.slice(0, 40), fyi: fyi.slice(0, 60),
    cuentas: correoCuentas_().map(function (c) { var d = {}; try { d = correoDominio_(c.cuenta); } catch (e) {} return { cuenta: c.cuenta, nombre: c.nombre, proyecto: c.proyecto, ultima: c.ultima, entrega: d }; }),
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
  var que = String(b.que || ''), cuenta = String(b.cuenta || '').toLowerCase(), de = String(b.de || '').toLowerCase(), id = String(b.id || ''), ids = (b.ids || []).map(String);
  var sh = hojaCorreos_(), n = sh.getLastRow(); if (n < 2) return { ok: false, error: 'sin correos' };
  var v = sh.getRange(2, 1, n - 1, CORREOS_CAB_.length).getValues(), ix = function (k) { return CORREOS_CAB_.indexOf(k); };
  var mios = []; v.forEach(function (r, i) { if (ids.length ? ids.indexOf(String(r[0])) >= 0 : (id && r[0] === id) || (!id && String(r[ix('cuenta')]) === cuenta && String(r[ix('de')]) === de)) mios.push(i); });
  if (!mios.length) return { ok: false, error: 'no encontré esos correos' };
  var estado = { spam: 'spam', desuscribir: 'desuscrito', archivar: 'archivado', leido: 'archivado', no_spam: 'nuevo', posponer: 'pospuesto' }[que]; if (!estado) return { ok: false, error: 'acción' };
  if (que === 'posponer') {   // «recuérdamelo»: vuelve a la bandeja de Alma al cumplirse el plazo
    var hasta = new Date(Date.now() + Math.max(1, Number(b.dias) || 1) * 86400000); hasta.setHours(8, 0, 0, 0);
    mios.forEach(function (i) { sh.getRange(i + 2, ix('estado') + 1).setValue('pospuesto'); sh.getRange(i + 2, ix('hasta') + 1).setValue(hasta.toISOString()); });
    return { ok: true, cuantos: mios.length, hasta: hasta.toISOString() };
  }
  var r0 = v[mios[0]], out = { ok: true };
  /* En spam de verdad, abrir su enlace de baja le confirma a quien lo mandó que tu correo existe: ahí solo se usa la
     desuscripción oficial de un clic; si no la trae, basta con mandarlo a Spam. */
  if (que === 'spam' || que === 'desuscribir') out.desuscripcion = correoDesuscribir_(r0[ix('unsub_url')], r0[ix('unsub_mailto')], r0[ix('unsub_un_clic')] === 'si', que === 'spam');
  mios.forEach(function (i) {
    sh.getRange(i + 2, ix('estado') + 1).setValue(estado);
    if (que === 'no_spam') { sh.getRange(i + 2, ix('spam') + 1).setValue('0'); if (v[i][ix('categoria')] === 'spam') sh.getRange(i + 2, ix('categoria') + 1).setValue('normal'); }
  });
  /* en la bandeja de Gmail: lo hace el puente de cada cuenta en su próxima vuelta (un lote puede traer varias cuentas) */
  if (que === 'spam' || que === 'archivar') {
    var porCuenta = {}; mios.forEach(function (i) { var k = String(v[i][ix('cuenta')]); (porCuenta[k] = porCuenta[k] || []).push({ hilo: v[i][ix('hilo')], accion: que }); });
    Object.keys(porCuenta).forEach(function (k) { var c = correoCuenta_(k); if (c) correoEncolar_(c, porCuenta[k]); });
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

/* Entrega de un dominio propio: SPF (y si incluye a Google), DKIM de Google Workspace y DMARC. En caché un día.
   Para @gmail.com no hace falta (Google ya firma). */
function correoDominio_(cuenta) {
  var dom = String(cuenta || '').split('@')[1] || ''; if (!dom || /^(gmail|googlemail)\.com$/.test(dom)) return {};
  var cache = CacheService.getScriptCache(), k = 'dom_' + dom, c0 = cache.get(k); if (c0) return JSON.parse(c0);
  var txt = function (n) {
    try { var r = UrlFetchApp.fetch('https://dns.google/resolve?type=TXT&name=' + encodeURIComponent(n), { muteHttpExceptions: true });
      return (JSON.parse(r.getContentText() || '{}').Answer || []).map(function (a) { return String(a.data || '').replace(/"\s*"/g, '').replace(/^"|"$/g, ''); }); } catch (e) { return null; }
  };
  var raiz = txt(dom), dmarc = txt('_dmarc.' + dom), dkim = txt('google._domainkey.' + dom);
  if (raiz === null) return {};
  var spfs = raiz.filter(function (t) { return /^v=spf1/i.test(t); }), dm = (dmarc || []).filter(function (t) { return /^v=DMARC1/i.test(t); })[0] || '';
  var o = { dominio: dom, spf: spfs.length === 1, spf_google: spfs.length === 1 && /include:_spf\.google\.com/i.test(spfs[0]), spf_doble: spfs.length > 1,
    dkim: (dkim || []).some(function (t) { return /v=DKIM1|k=rsa|p=/i.test(t); }), dmarc: (dm.match(/;\s*p=(none|quarantine|reject)/i) || [])[1] || '', consejos: [] };
  if (o.spf_doble) o.consejos.push('Hay dos registros SPF: eso rompe el SPF. Únelos en uno solo.');
  else if (!o.spf) o.consejos.push('Falta el SPF: agrega un TXT «v=spf1 include:_spf.google.com ~all».');
  else if (!o.spf_google) o.consejos.push('El SPF no incluye a Google: agrega «include:_spf.google.com».');
  if (!o.dkim) o.consejos.push('Falta la firma DKIM de Google: actívala en la consola de Google Workspace (Gmail → Autenticar correo).');
  if (!o.dmarc) o.consejos.push('Falta DMARC: empieza con «v=DMARC1; p=none; rua=mailto:tu-correo» y obsérvalo 2 a 4 semanas.');
  else if (o.dmarc === 'none') o.consejos.push('DMARC está en «none»: cuando los reportes estén limpios, súbelo a «quarantine» (poco a poco) y luego a «reject».');
  cache.put(k, JSON.stringify(o), 86400);
  return o;
}

/* Para la app: { accion: 'lista' | 'conectar' | 'hacer' } */
function correoApi_(ses, b) {
  var a = String(b.accion || 'lista');
  if (a === 'conectar') return correoConectar_(ses, b);
  if (a === 'hacer') return correoAccion_(ses, b);
  if (a === 'involucrar') return correoInvolucrar_(ses, b);
  if (a === 'hilo') return correoHiloAccion_(ses, b);
  return correos_(ses);
}
