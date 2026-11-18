/* ── Archivos en órbita y Carpeta de archivos (Juan, 18-nov-2026) ──────────────────────────────────────────────────────
   Juan: «Si hacemos drag and drop de un archivo en el app de Alma debe leerlo como input… tiene que verse en el chat, pero
   también en las órbitas… un iconito de archivo con el nombre o la descripción del archivo flotando, durante las próximas 5
   interacciones: 5 llamadas, 5 inicios de chat. Modo Inicio no cuenta… Una vez que pasaron esas 5 interacciones, el
   archivo pasa a una carpetita.»
   1. Cada archivo (o foto) que entra al chat de Alma (almaArchivo_, almaFoto_) queda anotado aquí por persona: nombre,
      una descripción corta (2 a 4 palabras) y un resumen de su contenido (para la voz). El archivo mismo sigue en la
      carpeta privada del Drive del Hub (adjuntos.js); aquí nunca va su contenido completo.
   2. Interacción = una llamada con Alma que de verdad empezó (vozWebVincular_) o un chat con Alma en el que se escribió
      (la página manda «interaccion» con su clave al primer mensaje). Cada clave cuenta una sola vez y solo para los
      archivos que ya estaban antes de que empezara. Escuchar en el inicio (Modo inicio) no cuenta.
   3. A las ARCH_ORB_VUELTAS_ interacciones el archivo pasa a la Carpeta de archivos (estado «carpeta»). Desde la carpeta
      se puede volver a usar (vuelve a la órbita, de cero) o quitar de la lista (el archivo sigue en el Drive privado).
   4. Por voz: la ficha de la llamada (vozWebInicio_) lleva los archivos en órbita con su resumen (archivosFicha_).
   Se guarda en las Propiedades del script (privado; una propiedad por persona, menos de 9 KB). */
var ARCH_ORB_VUELTAS_ = 5, ARCH_ORB_MAX_ORBITA_ = 6, ARCH_ORB_MAX_CARPETA_ = 12, ARCH_ORB_RESUMEN_ = 320, ARCH_ORB_FICHA_ = 4;
var ARCH_ORB_SYS_ = JSON.stringify({
  rol: 'Bibliotecario de los archivos que el equipo de Spacio AM le pasa a su asistente Alma.',
  tarea: 'Dar a un archivo una descripción corta y un resumen de lo que dice.',
  restricciones: ['Solo lo que dice el archivo; sin suponer.', 'Nada de teléfonos, correos, contraseñas ni números de tarjeta.'],
  formato_de_respuesta: 'Solo JSON: {"desc": "2 a 4 palabras, sin comillas (p. ej. Factura de luz)", "resumen": "1 a 3 frases con lo importante: montos, fechas, nombres de lugares"}'
});

function archOrbClave_(email) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(email || '').toLowerCase().trim());
  return 'ARCH_ORB_' + h.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 16);
}
function archOrbLeer_(email) {
  var v = null; try { v = JSON.parse(PropertiesService.getScriptProperties().getProperty(archOrbClave_(email)) || 'null'); } catch (e) { v = null; }
  return v && Array.isArray(v.l) ? { l: v.l, claves: Array.isArray(v.claves) ? v.claves : [] } : { l: [], claves: [] };
}
function archOrbGuardar_(email, d) {
  /* Lo más viejo de la carpeta se va primero si no cabe (las Propiedades guardan hasta 9 KB por valor). */
  var orb = d.l.filter(function (x) { return x.estado !== 'carpeta'; }), car = d.l.filter(function (x) { return x.estado === 'carpeta'; });
  car.sort(function (a, b) { return (b.tc || 0) - (a.tc || 0); });
  d.l = orb.slice(-ARCH_ORB_MAX_ORBITA_).concat(car.slice(0, ARCH_ORB_MAX_CARPETA_)); d.claves = d.claves.slice(-30);
  var s = JSON.stringify(d);
  while (s.length > 8500 && d.l.length) { var i = d.l.map(function (x) { return x.estado; }).lastIndexOf('carpeta'); d.l.splice(i >= 0 ? i : 0, 1); s = JSON.stringify(d); }
  PropertiesService.getScriptProperties().setProperty(archOrbClave_(email), s);
}
function archOrbCandado_(fn) {
  var lk = LockService.getScriptLock(); try { lk.waitLock(8000); } catch (e) { return fn(); }
  try { return fn(); } finally { try { lk.releaseLock(); } catch (e) {} }
}
/* La descripción corta y el resumen: el modelo rápido una vez por archivo; si no responde, el nombre y el principio del texto. */
function archOrbDescribir_(nombre, texto) {
  var base = String(nombre || 'Archivo').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 40) || 'Archivo';
  var out = { desc: base, resumen: String(texto || '').replace(/\s+/g, ' ').trim().slice(0, ARCH_ORB_RESUMEN_) };
  if (!texto) return out;
  try {
    var r = String(claude_(CFG.MODELO_CLASIFICADOR, 260, ARCH_ORB_SYS_, 'ARCHIVO: ' + nombre + '\n\n' + String(texto).slice(0, 2500), 0) || '');
    var j = JSON.parse((r.match(/\{[\s\S]*\}/) || ['null'])[0]);
    if (j && j.desc) out.desc = String(j.desc).replace(/["«»]/g, '').trim().split(/\s+/).slice(0, 5).join(' ').slice(0, 40);
    if (j && j.resumen) out.resumen = String(j.resumen).trim().slice(0, ARCH_ORB_RESUMEN_);
  } catch (e) { console.error('archOrbDescribir_: ' + e); }
  return out;
}
/* Lo que ve la pantalla: nunca el resumen ni el drive_id. */
function archOrbPublico_(x) {
  var o = { id: x.id, nombre: x.nombre, desc: x.desc, tipo: x.tipo };
  if (x.estado === 'carpeta') o.fecha = x.tc || x.t; else o.quedan = Math.max(0, ARCH_ORB_VUELTAS_ - (x.n || 0));
  return o;
}
function archOrbTipo_(nombre, tipo) {
  var t = String(tipo || ''), e = (/\.([a-z0-9]+)$/i.exec(String(nombre || '')) || [])[1] || '';
  if (t === 'foto' || /^(jpe?g|png|heic|webp)$/i.test(e)) return 'foto';
  if (t === 'excel' || t === 'csv' || /^(xlsx?|csv)$/i.test(e)) return 'hoja';
  if (t === 'audio') return 'audio';
  if (t === 'pdf' || /^pdf$/i.test(e)) return 'pdf';
  return 'doc';
}

/* Un archivo nuevo del chat: r es lo que devolvió almaArchivo_ o almaFoto_ ({ ok, nombre, texto, drive_id }). Le suma
   r.orbita (lo público) para que la pantalla lo pinte ya en la órbita. Nunca rompe la subida. */
function archivoEnOrbita_(ses, r, nombre, tipo) {
  if (!r || !r.ok || !ses || !ses.email) return r;
  try {
    nombre = String(r.nombre || nombre || (tipo === 'foto' ? 'Foto' : 'Archivo')).slice(0, 100);
    var dsc = archOrbDescribir_(nombre, r.texto || r.nota || ''), id = 'ar' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    var x = { id: id, nombre: nombre, desc: dsc.desc, resumen: dsc.resumen, tipo: archOrbTipo_(nombre, tipo || r.tipo), drive_id: r.drive_id || '', n: 0, estado: 'orbita', t: Date.now() };
    archOrbCandado_(function () { var d = archOrbLeer_(ses.email); d.l.push(x); archOrbGuardar_(ses.email, d); });
    r.orbita = archOrbPublico_(x);
  } catch (e) { console.error('archivoEnOrbita_: ' + e); }
  return r;
}

/* Una interacción con Alma (llamada o chat). clave: una vez por conversación. desde (ms): cuándo empezó; los archivos que
   llegaron después no cuentan esta vuelta. Devuelve los ids que pasaron a la carpeta. */
function archivosInteraccion_(email, clave, desde) {
  clave = String(clave || '').slice(0, 90); if (!email || !clave) return [];
  return archOrbCandado_(function () {
    var d = archOrbLeer_(email), pasan = [], ahora = Date.now(), t0 = Number(desde) > 0 ? Math.min(Number(desde), ahora) : ahora;
    if (d.claves.indexOf(clave) >= 0) return [];
    var hay = d.l.some(function (x) { return x.estado === 'orbita' && x.t < t0; });
    d.claves.push(clave);
    d.l.forEach(function (x) {
      if (x.estado !== 'orbita' || x.t >= t0) return;
      x.n = (x.n || 0) + 1;
      if (x.n >= ARCH_ORB_VUELTAS_) { x.estado = 'carpeta'; x.tc = ahora; pasan.push(x.id); }
    });
    if (hay || pasan.length) archOrbGuardar_(email, d);
    return pasan;
  });
}

/* La pantalla (alma/inicio.html y el chat de js/sa-nav.js): acción archivosOrbita { que, … }
   lista · interaccion { clave, desde } · quitar { id } (el ✕ antes de mandarlo) · usar { id } (de la carpeta otra vez a
   la órbita; devuelve el texto para el chat) · borrar { id } (sale de la carpeta; el archivo sigue en el Drive privado). */
function archivosOrbitaApi_(ses, b) {
  if (!ses || !ses.email) return { ok: false, error: 'session' };
  b = b || {}; var que = String(b.que || 'lista'), id = String(b.id || ''), out = { ok: true };
  if (que === 'interaccion') out.pasan = archivosInteraccion_(ses.email, 'chat:' + String(b.clave || ''), b.desde);
  else if (que === 'quitar' || que === 'borrar' || que === 'usar') {
    var r = archOrbCandado_(function () {
      var d = archOrbLeer_(ses.email), i = -1;
      d.l.forEach(function (x, k) { if (x.id === id) i = k; });
      if (i < 0) return { ok: false, error: 'No encontré ese archivo.' };
      var x = d.l[i];
      if (que === 'usar') { x.estado = 'orbita'; x.n = 0; x.t = Date.now(); delete x.tc; d.l.splice(i, 1); d.l.push(x); }
      else d.l.splice(i, 1);
      archOrbGuardar_(ses.email, d);
      return que === 'usar' ? { ok: true, archivo: archOrbPublico_(x), texto: archOrbMensaje_(x) } : { ok: true };
    });
    if (!r.ok) return r; Object.assign(out, r);
  }
  var d = archOrbLeer_(ses.email);
  out.orbita = d.l.filter(function (x) { return x.estado !== 'carpeta'; }).map(archOrbPublico_);
  out.carpeta = d.l.filter(function (x) { return x.estado === 'carpeta'; }).sort(function (a, c) { return (c.tc || 0) - (a.tc || 0); }).map(archOrbPublico_);
  out.vueltas = ARCH_ORB_VUELTAS_;
  return out;
}
/* Volver a usar un archivo de la carpeta: lo que le llega a Alma con el próximo mensaje. */
function archOrbMensaje_(x) {
  return '[Te vuelvo a pasar el archivo «' + x.nombre + '»' + (x.drive_id ? ' (está en el Drive del Hub, drive_id ' + x.drive_id + ')' : '') +
    (x.resumen ? '. En corto dice: ' + x.resumen : '') + ']';
}

/* La ficha de la voz: los archivos en órbita (los más nuevos primero), para que Alma los use si Juan habla de ellos. */
function archivosFicha_(adm) {
  if (!adm || !adm.email) return '';
  var l = archOrbLeer_(adm.email).l.filter(function (x) { return x.estado !== 'carpeta'; }).slice(-ARCH_ORB_FICHA_).reverse();
  if (!l.length) return '';
  return '\nARCHIVOS QUE TE CARGÓ (en órbita; úsalos solo si habla de ellos, sin leerlos completos): ' + l.map(function (x) {
    return '«' + x.nombre + '» (' + x.desc + ')' + (x.resumen ? ': ' + x.resumen : '');
  }).join(' · ');
}

/* ── De la órbita a la Biblioteca de Claudio (Juan, 18-nov-2026, pedido pc1795012788851) ─────────────────────────────
   Juan: «ya están cargados en mis archivos en órbita… pásalos a la biblioteca y quítalos de la órbita». Claudio no tiene
   sesión en la app: ve los archivos que el administrador principal tiene en órbita o en la Carpeta de archivos en cada
   pedido (archivosOrbitaParaClaude_) y, con el lector de ese pedido, pasa uno a la Biblioteca (bibliotecaClaude_ con
   «orbita»: «lista» o el id). Pasar = una fila nueva en ALMA_BIBLIOTECA con el mismo archivo del Drive privado (no se
   copia) y su texto si es Word, Excel o texto (un PDF se lee con «crudo»), y el archivo sale de la órbita y de la carpeta.
   Solo los del administrador principal y solo en un pedido que él hizo. */
function archOrbCorreosPrincipal_() {
  var out = [];
  adminsOp_().filter(function (a) { return a.principal; }).forEach(function (a) {
    [a.email].concat(a.alternos || []).forEach(function (c) { c = String(c || '').trim().toLowerCase(); if (c && out.indexOf(c) < 0) out.push(c); });
  });
  return out;
}
function archOrbDelPrincipal_() {
  var out = [];
  archOrbCorreosPrincipal_().forEach(function (c) { archOrbLeer_(c).l.forEach(function (x) { out.push({ email: c, x: x }); }); });
  return out;
}
function archOrbParaClaudePublico_(x) { return { id: x.id, nombre: x.nombre, desc: x.desc, tipo: x.tipo, estado: x.estado === 'carpeta' ? 'carpeta' : 'orbita' }; }
/* El bloque del pedido (va con la biblioteca, nunca en el issue): nombre y descripción corta, sin el resumen. */
function archivosOrbitaParaClaude_() {
  var l = []; try { l = archOrbDelPrincipal_(); } catch (e) { console.error('archivosOrbitaParaClaude_: ' + e); return ''; }
  if (!l.length) return '';
  return '### Archivos en órbita de Juan (los que cargó en la app; todavía no están en la biblioteca)\n' + l.slice(-12).reverse().map(function (o) {
    return '- ' + o.x.id + ' · «' + o.x.nombre + '» · ' + o.x.desc + ' · ' + (o.x.estado === 'carpeta' ? 'en la Carpeta de archivos' : 'en órbita');
  }).join('\n') + '\nSi uno sirve, pásalo a la biblioteca con tu lector: el mismo curl de la biblioteca con "orbita":"<id>" en vez de "doc" (sale de la órbita y queda como documento; "orbita":"lista" da esta lista).';
}
function archOrbABiblioteca_(arId) {
  arId = String(arId || '');
  return archOrbCandado_(function () {
    var o = archOrbDelPrincipal_().filter(function (y) { return y.x.id === arId; })[0];
    if (!o) return { ok: false, error: 'Ese archivo ya no está en la órbita ni en la carpeta.' };
    var x = o.x, mime = '', texto = '', textoId = '';
    if (!x.drive_id) return { ok: false, error: 'Ese archivo no quedó guardado en el Drive del Hub.' };
    try {
      var f = DriveApp.getFileById(x.drive_id), blob = f.getBlob(); mime = String(blob.getContentType() || '').toLowerCase();
      var r = {}; try { r = biblioTexto_(blob, x.nombre, mime) || {}; } catch (e) { r = {}; }
      texto = biblioLimpio_(r.texto, BIBLIO_TEXTO_MAX_);
      if (texto) textoId = biblioCarpeta_().createFile(Utilities.newBlob(texto, 'text/plain', x.id + ' · ' + x.nombre + '.txt')).getId();
    } catch (e) { console.error('archOrbABiblioteca_ Drive: ' + e); return { ok: false, error: 'No pude abrir el archivo en el Drive del Hub.' }; }
    var id = 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), fecha = new Date().toISOString();
    var nombre = biblioLimpio_(x.desc || x.nombre, 80), paraQue = biblioLimpio_('Lo cargó en la órbita de la app' + (x.resumen ? ': ' + x.resumen : ''), 300);
    biblioHoja_().appendRow([id, fecha, nombre, 'documento', paraQue, x.nombre, mime, x.drive_id, textoId, texto.length, o.email, 'activo', '']);
    var d = archOrbLeer_(o.email); d.l = d.l.filter(function (y) { return y.id !== arId; }); archOrbGuardar_(o.email, d);
    return { ok: true, documento: biblioPublico_({ id: id, fecha: fecha, nombre: nombre, tipo: 'documento', para_que: paraQue, archivo: x.nombre, caracteres: texto.length, texto_id: textoId }) };
  });
}
