/* ═══ ENLACES CORTOS (#488 · T2, el mismo diseño que Grow en T1) ═══════════════════════════════════════════════
   hub.spacioam.com/k7q2m en vez de un enlace largo (un PDF de Drive, un formulario, una conversación del Hub).
   · Hoja ENLACES (en la de Alma): codigo · url · app · creado · por · clics · ultimo. Se crea sola la primera vez.
   · acortar_(url, por): para el código del Hub y de Alma. El mismo enlace da siempre el mismo código. Solo acorta
     enlaces https de *.spacioam.com, drive.google.com y docs.google.com; cualquier otro vuelve tal cual. Nunca frena un
     envío: si algo falla, devuelve el enlace largo.
   · acortarEnTexto_(texto, por): cambia cada enlace acortable de un texto por su forma corta. Lo llama el punto final de
     cada canal (WhatsApp, correo, Hospitable) para que nada se escape. No toca los que ya son cortos
     (hub|grow|hola|docs|mi.spacioam.com/<5>), los de otros dominios, los que se escriben a mano (una dirección sola o
     de menos de 40 letras) ni los códigos y números (no son enlaces).
   · enlacePublico_(codigo): la acción pública «enlace» (doGet y doPost). Solo devuelve el enlace largo y suma un clic.
     La usa 404.html, la página que GitHub Pages muestra para cualquier dirección que no existe.
   · El código: 5 caracteres al azar de 23456789abcdefghjkmnpqrstuvwxyz (sin 0/o ni 1/l/i). Si choca, se sortea otro.
   Un enlace de grow.spacioam.com que manda Alma también sale con hub.spacioam.com: el acortador de Grow pide su sesión
   o su llave de robot y el Hub todavía no la tiene (queda para después, ver #488). */
var ENLACES_HOJA_ = 'ENLACES';
var ENLACES_CAB_ = ['codigo', 'url', 'app', 'creado', 'por', 'clics', 'ultimo'];
var ENLACES_ABC_ = '23456789abcdefghjkmnpqrstuvwxyz';
var ENLACES_RX_ = /^[23456789abcdefghjkmnpqrstuvwxyz]{5}$/;
var ENLACES_BASE_ = 'https://hub.spacioam.com/';
var ENLACES_GOOGLE_ = ['drive.google.com', 'docs.google.com'];
var ENLACES_YA_CORTO_ = /^https:\/\/(hub|grow|hola|docs|mi)\.spacioam\.com\/[23456789abcdefghjkmnpqrstuvwxyz]{5}\/?$/i;
var ENLACES_MIN_ = 40;   // el corto mide 30: uno de 40 o menos se deja (y casi siempre es una dirección que se escribe a mano)

/* La hoja, o null si no existe y no se pidió crearla. La columna del código va como texto: «22345» no se vuelve número. */
function enlacesHoja_(crear) {
  var ss = ssAlma_(), sh = ss.getSheetByName(ENLACES_HOJA_);
  if (!sh && crear) {
    sh = ss.insertSheet(ENLACES_HOJA_);
    sh.getRange(1, 1, 1, ENLACES_CAB_.length).setValues([ENLACES_CAB_]);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');
  }
  return sh || null;
}

/* El enlace limpio si se puede acortar por su dominio, o '' (otro dominio, sin https, con espacios, @ o puerto). */
function enlaceValido_(url) {
  url = String(url == null ? '' : url).trim();
  if (!url || url.length > 2000 || /\s/.test(url)) return '';
  var m = url.match(/^https:\/\/([^\/?#:@]+)(?:[\/?#]|$)/i);
  if (!m) return '';
  var host = m[1].toLowerCase();
  return ENLACES_GOOGLE_.indexOf(host) >= 0 || /^([a-z0-9-]+\.)+spacioam\.com$/.test(host) ? url : '';
}

/* ¿Vale la pena acortarlo? Su dominio es nuestro, no es ya corto, no es solo una dirección y mide más de 40. */
function enlaceAcortable_(url) {
  var u = enlaceValido_(url);
  return !!u && !ENLACES_YA_CORTO_.test(u) && !/^https:\/\/[^\/?#]+\/?$/i.test(u) && u.length > ENLACES_MIN_;
}

function enlaceCodigoNuevo_(usados) {
  for (var intento = 0; intento < 20; intento++) {
    var c = '';
    for (var i = 0; i < 5; i++) c += ENLACES_ABC_.charAt(Math.floor(Math.random() * ENLACES_ABC_.length));
    if (!usados[c]) return c;
  }
  throw new Error('No pude crear un código nuevo.');
}

function enlaceClaveCache_(u) {
  return 'enl_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, u, Utilities.Charset.UTF_8));
}

/* El enlace corto de url (https://hub.spacioam.com/<código>), o url tal cual si no se acorta o algo falla.
   El candado es el de usuario, no el del script: procesarCola tiene el del script toda su pasada y un mensaje en una
   llamada no puede esperarlo (ESTANDARES.md). Si no se consigue en 5 s, sale el enlace largo. */
function acortar_(url, por) {
  var u = enlaceAcortable_(url) ? enlaceValido_(url) : '';
  if (!u) return url;
  try {
    var cache = CacheService.getScriptCache(), k = enlaceClaveCache_(u), ya = cache.get(k);
    if (ya && ENLACES_RX_.test(ya)) return ENLACES_BASE_ + ya;
    var lock = LockService.getUserLock(), mio = !lock.hasLock();
    if (mio && !lock.tryLock(5000)) return url;
    try {
      var sh = enlacesHoja_(true), v = sh.getDataRange().getValues(), usados = {};
      for (var i = 1; i < v.length; i++) {
        var c = String(v[i][0] == null ? '' : v[i][0]).trim().toLowerCase();
        if (!c) continue;
        if (String(v[i][1]) === u && ENLACES_RX_.test(c)) { cache.put(k, c, 21600); return ENLACES_BASE_ + c; }
        usados[c] = true;
      }
      var codigo = enlaceCodigoNuevo_(usados), fila = Math.max(sh.getLastRow(), 1) + 1;
      sh.getRange(fila, 1).setNumberFormat('@');
      sh.getRange(fila, 1, 1, ENLACES_CAB_.length).setValues([[codigo, u, 'hub', new Date().toISOString(), celdaTexto_(String(por || 'alma').slice(0, 80)), 0, '']]);
      cache.put(k, codigo, 21600);
      return ENLACES_BASE_ + codigo;
    } finally { if (mio) lock.releaseLock(); }
  } catch (e) { console.error('acortar_: ' + e); return url; }
}

/* Cada enlace acortable del texto, por su forma corta. Los signos que cierran la frase (punto, coma, paréntesis que
   no abrió el enlace, *negritas*) se quedan fuera del enlace. Sin enlaces https, el texto vuelve igual. */
function acortarEnTexto_(texto, por) {
  if (texto == null || String(texto).indexOf('https://') < 0) return texto;
  return String(texto).replace(/https:\/\/[^\s<>"'«»“”\[\]{}|\\^`]+/gi, function (m) {
    var url = m, cola = '';
    while (/[.,;:!?)*~…]$/.test(url)) {
      if (url.slice(-1) === ')' && url.split('(').length >= url.split(')').length) break;   // (…) del propio enlace
      cola = url.slice(-1) + cola; url = url.slice(0, -1);
    }
    return enlaceAcortable_(url) ? acortar_(url, por) + cola : m;
  });
}

/* Acción pública «enlace» (doGet ?enlace=, doPost { action: 'enlace', codigo }): solo el enlace largo, y suma un clic.
   Nunca crea la hoja ni filas; un código con otra forma o que no existe da el mismo error, sin más datos. */
function enlacePublico_(codigo) {
  var NO = { ok: false, error: 'Este enlace no existe.' };
  try {
    var c = String(codigo == null ? '' : codigo).trim().toLowerCase();
    if (!ENLACES_RX_.test(c)) return NO;
    var sh = enlacesHoja_(false); if (!sh) return NO;
    var v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0] == null ? '' : v[i][0]).trim().toLowerCase() !== c) continue;
      var url = enlaceValido_(v[i][1]);   // por si alguien editó la hoja a mano: nunca redirige a otro dominio
      if (!url) return NO;
      try {   // contar el clic nunca frena la apertura
        var lock = LockService.getUserLock(), mio = !lock.hasLock();
        if (!mio || lock.tryLock(3000)) {
          try {
            var celdas = sh.getRange(i + 1, 6, 1, 2), act = celdas.getValues()[0];
            celdas.setValues([[(Number(act[0]) || 0) + 1, new Date().toISOString()]]);
          } finally { if (mio) lock.releaseLock(); }
        }
      } catch (e) { console.warn('enlacePublico_ clic: ' + e); }
      return { ok: true, data: { url: url } };
    }
    return NO;
  } catch (e) { console.error('enlacePublico_: ' + e); return NO; }
}

/* Hub → «acortar» (con la sesión firmada del login; la llave vieja del Hub no basta porque viaja en la página). */
function enlaceAcortarApi_(ses, url) {
  if (!ses) return { ok: false, error: 'Para acortar un enlace hace falta iniciar sesión.' };
  if (!enlaceValido_(url)) return { ok: false, error: 'Ese enlace no se puede acortar: solo los de spacioam.com o de Google Drive y Docs.' };
  var corto = acortar_(String(url).trim(), String(ses.email || ses.nombre || 'sesión'));
  var m = /\/([23456789abcdefghjkmnpqrstuvwxyz]{5})$/.exec(corto);
  return m && corto.indexOf(ENLACES_BASE_) === 0 ? { ok: true, corto: corto, codigo: m[1] } : { ok: true, corto: corto, codigo: '', nota: 'Quedó el enlace tal cual (ya era corto o no se pudo acortar ahora).' };
}
