/* ═══ ENLACES CORTOS (#488 · T2, el mismo diseño que Grow en T1; Hola, Docs y Mi en T3–T5) ═════════════════════
   Un enlace corto lleva la dirección de la app que lo genera (Juan, 12-nov-2026: «Cada web app tiene su propia página por
   una razón y si el proceso se genera en grow debe salir desde la URL de esa web app»). Nunca hub.spacioam.com para algo
   que no es del Hub.
   · Lo del Hub (sus avisos, sus archivos, enlaces a hub.spacioam.com): hub.spacioam.com/<código>, hoja ENLACES (en la de
     Alma: codigo · url · app · creado · por · clics · ultimo; se crea sola la primera vez).
   · Lo de Grow (enlaces a grow.spacioam.com, los PDF de grow_presupuesto_pdf y lo que devuelven las herramientas grow_*):
     grow.spacioam.com/<código>, que da Grow (growApi_ «acortar», su hoja 40_ENLACES).
   · Lo de Hola, Docs y Mi (enlaces a hola, docs y mi.spacioam.com; T3–T5): <app>.spacioam.com/<código>, que da cada app
     con su op «acortar» y la llave del robot (Hola por holaPost_; Docs y Mi por su Apps Script de ACCESOS_APPS_).
   · Si la app no responde o no da un corto con su dirección, sale el largo (nunca con hub.spacioam.com) y por 10 min no
     se le vuelve a preguntar. Las demás apps (epi…) y otros dominios: tal cual, largos.
   · Drive y Docs de Google: con la app del proceso que los manda (acortarEnTexto_(texto, por, 'grow' | 'hola' | 'docs' |
     'mi')); sin app, el Hub.
   · acortar_(url, por, app) y acortarEnTexto_(texto, por, app): el mismo enlace da siempre el mismo código. Nunca frenan un
     envío: si algo falla, sale el enlace largo. acortarEnTexto_ lo llama el punto final de cada canal (WhatsApp, correo,
     Hospitable) para que nada se escape; no toca los ya cortos (hub|grow|hola|docs|mi.spacioam.com/<5>), los de otros
     dominios, los que se escriben a mano (una dirección sola o de 40 letras o menos) ni los códigos y números.
   · enlacePublico_(codigo): la acción pública «enlace» (doGet y doPost). Solo devuelve el enlace largo y suma un clic.
     La usa 404.html, la página que GitHub Pages muestra para cualquier dirección que no existe.
   · El código: 5 caracteres al azar de 23456789abcdefghjkmnpqrstuvwxyz (sin 0/o ni 1/l/i). Si choca, se sortea otro. */
var ENLACES_HOJA_ = 'ENLACES';
var ENLACES_CAB_ = ['codigo', 'url', 'app', 'creado', 'por', 'clics', 'ultimo'];
var ENLACES_ABC_ = '23456789abcdefghjkmnpqrstuvwxyz';
var ENLACES_RX_ = /^[23456789abcdefghjkmnpqrstuvwxyz]{5}$/;
var ENLACES_BASE_ = 'https://hub.spacioam.com/';
var ENLACES_GOOGLE_ = ['drive.google.com', 'docs.google.com'];
var ENLACES_YA_CORTO_ = /^https:\/\/(hub|grow|hola|docs|mi)\.spacioam\.com\/[23456789abcdefghjkmnpqrstuvwxyz]{5}\/?$/i;
var ENLACES_APPS_ = ['grow', 'hola', 'docs', 'mi'];   // las apps con su acortador: cada una da el corto de lo suyo
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

/* El dominio de un enlace https limpio (sin espacios, @ ni puerto), o '' si no lo es. */
function enlaceHost_(url) {
  url = String(url == null ? '' : url).trim();
  if (!url || url.length > 2000 || /\s/.test(url)) return '';
  var m = url.match(/^https:\/\/([^\/?#:@]+)(?:[\/?#]|$)/i);
  return m ? m[1].toLowerCase() : '';
}

/* El enlace limpio si el Hub lo guarda en su hoja (hub.spacioam.com, Drive o Docs), o ''. */
function enlaceValido_(url) {
  var h = enlaceHost_(url);
  return h === 'hub.spacioam.com' || ENLACES_GOOGLE_.indexOf(h) >= 0 ? String(url).trim() : '';
}

/* Qué app da el corto: la de su dirección (hub, grow, hola, docs o mi.spacioam.com), la app del proceso (o el Hub) para
   Drive y Docs, y '' para lo demás (las otras apps de spacioam.com y otros dominios: van tal cual). */
function enlaceApp_(url, app) {
  var h = enlaceHost_(url), m = /^([a-z]+)\.spacioam\.com$/.exec(h);
  if (h === 'hub.spacioam.com') return 'hub';
  if (m && ENLACES_APPS_.indexOf(m[1]) >= 0) return m[1];
  if (ENLACES_GOOGLE_.indexOf(h) >= 0) return ENLACES_APPS_.indexOf(app) >= 0 ? app : 'hub';
  return '';
}

/* ¿Vale la pena acortarlo, y con qué app? No es ya corto, no es solo una dirección y mide más de 40. */
function enlaceAcortable_(url, app) {
  var u = String(url == null ? '' : url).trim(), a = enlaceApp_(u, app);
  return a && !ENLACES_YA_CORTO_.test(u) && !/^https:\/\/[^\/?#]+\/?$/i.test(u) && u.length > ENLACES_MIN_ ? a : '';
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

/* El enlace corto de url con la dirección de su app (<app>.spacioam.com/<código>), o url tal cual si no se acorta o
   algo falla. app: la app del proceso que lo manda (solo cuenta para Drive y Docs; sin app, el Hub). */
function acortar_(url, por, app) {
  var a = enlaceAcortable_(url, app);
  if (!a) return url;
  return a === 'hub' ? enlaceHub_(String(url).trim(), por) : enlaceDeApp_(a, String(url).trim(), por);
}

/* hub.spacioam.com/<código>. El candado es el de usuario, no el del script: procesarCola tiene el del script toda su
   pasada y un mensaje en una llamada no puede esperarlo (ESTANDARES.md). Si no se consigue en 5 s, sale el enlace largo. */
function enlaceHub_(u, por) {
  try {
    var cache = CacheService.getScriptCache(), k = enlaceClaveCache_(u), ya = cache.get(k);
    if (ya && ENLACES_RX_.test(ya)) return ENLACES_BASE_ + ya;
    var lock = LockService.getUserLock(), mio = !lock.hasLock();
    if (mio && !lock.tryLock(5000)) return u;
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
  } catch (e) { console.error('enlaceHub_: ' + e); return u; }
}

/* <app>.spacioam.com/<código> (grow, hola, docs o mi): se lo pide a esa app (enlacePuerta_), que guarda en su hoja y da
   el mismo código para el mismo enlace. Si la app no responde, falla o da un corto que no es de su dirección, sale el
   enlace largo (nunca con la dirección del Hub ni de otra app) y por 10 min no se le vuelve a preguntar, para no trabar
   cada envío. */
function enlaceDeApp_(app, u, por) {
  try {
    var cache = CacheService.getScriptCache(), k = app + ':' + enlaceClaveCache_(u), ya = cache.get(k);
    var suyo = new RegExp('^https://' + app + '\\.spacioam\\.com/[23456789abcdefghjkmnpqrstuvwxyz]{5}$');
    if (ya && suyo.test(ya)) return ya;
    if (cache.get('enl_' + app + '_caido')) return u;
    var r = enlacePuerta_(app, u, String(por || 'alma').slice(0, 60));
    var corto = r && r.ok ? String(r.corto || '') : '';
    if (!suyo.test(corto)) { cache.put('enl_' + app + '_caido', '1', 600); console.warn('enlaceDeApp_ ' + app + ': ' + JSON.stringify(r).slice(0, 200)); return u; }
    cache.put(k, corto, 21600);
    return corto;
  } catch (e) { console.error('enlaceDeApp_ ' + app + ': ' + e); return u; }
}

/* La puerta de cada app para su op «acortar»: Grow por la de la secretaria (growApi_, agente.js); Hola, Docs y Mi con la
   llave del robot (la misma con la que el Hub ya les habla: holaPost_ en holaacceso.js y ACCESOS_APPS_ en Código.js). */
function enlacePuerta_(app, u, por) {
  if (app === 'grow') return growApi_('acortar', { url: u, por: por });
  if (app === 'hola') return holaPost_({ action: 'acortar', url: u, por: por });
  var url = ACCESOS_APPS_[app] ? ACCESOS_APPS_[app]() : '', llave = llaveRobot_();
  if (!url || !llave) return { ok: false, error: 'sin puerta a ' + app + (llave ? '' : ' (falta ROBOT_TOKEN)') };
  var r = uf_(url, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'acortar', robot: llave, url: u, por: por }) }, 'Otras apps');
  try { return JSON.parse(r.getContentText() || '{}'); }
  catch (e) { return { ok: false, error: app + ' respondió ' + r.getResponseCode() }; }
}

/* Cada enlace acortable del texto, por su forma corta con la dirección de su app. app: la del proceso que lo manda, si
   se sabe (para Drive y Docs). Los signos que cierran la frase (punto, coma, paréntesis que no abrió el enlace,
   *negritas*) se quedan fuera del enlace. Sin enlaces https, el texto vuelve igual. */
function acortarEnTexto_(texto, por, app) {
  if (texto == null || String(texto).indexOf('https://') < 0) return texto;
  return String(texto).replace(/https:\/\/[^\s<>"'«»“”\[\]{}|\\^`]+/gi, function (m) {
    var url = m, cola = '';
    while (/[.,;:!?)*~…]$/.test(url)) {
      if (url.slice(-1) === ')' && url.split('(').length >= url.split(')').length) break;   // (…) del propio enlace
      cola = url.slice(-1) + cola; url = url.slice(0, -1);
    }
    return enlaceAcortable_(url, app) ? acortar_(url, por, app) + cola : m;
  });
}

/* Lo mismo dentro del resultado de una herramienta (p. ej. las grow_*): cada texto con su app; los campos que empiezan con
   «_» (fotos en base64) y los drive_id no se tocan. */
function acortarEnObjeto_(o, por, app, hondo) {
  hondo = hondo || 0;
  if (typeof o === 'string') return acortarEnTexto_(o, por, app);
  if (!o || typeof o !== 'object' || hondo > 5) return o;
  if (Array.isArray(o)) return o.map(function (x) { return acortarEnObjeto_(x, por, app, hondo + 1); });
  var out = {};
  Object.keys(o).forEach(function (k) { out[k] = /^_|drive_id|file_id/.test(k) ? o[k] : acortarEnObjeto_(o[k], por, app, hondo + 1); });
  return out;
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
  if (!enlaceValido_(url)) return { ok: false, error: 'Ese enlace no se puede acortar aquí: solo los de hub.spacioam.com o de Google Drive y Docs.' };
  var corto = acortar_(String(url).trim(), String(ses.email || ses.nombre || 'sesión'));
  var m = /\/([23456789abcdefghjkmnpqrstuvwxyz]{5})$/.exec(corto);
  return m && corto.indexOf(ENLACES_BASE_) === 0 ? { ok: true, corto: corto, codigo: m[1] } : { ok: true, corto: corto, codigo: '', nota: 'Quedó el enlace tal cual (ya era corto o no se pudo acortar ahora).' };
}
