/* ═══ FOTO DEL CONTACTO: familia, amigos y contactos sin reserva (#567 T4) ═══════════════════════════════════════════════
   La bandeja del Hub pone la foto de cada persona (bandejaesfera.js): la del huésped, la del login o la de la reserva
   ligada. Quien escribe por WhatsApp sin cuenta ni reserva (familia, amigos, proveedores) se quedaba con sus iniciales.
   Decisión de Juan (16-nov-2026), en este orden:
     1. iphone · la app de Alma, con el permiso de Contactos de Juan (una vez), toma la foto del contacto que coincide por
        número, SOLO para los números de la bandeja sin foto que el Hub le pasa (fotosContacto «faltan»). Nunca la agenda.
     2. google · los Contactos de Google de Juan, con el servicio People del Apps Script (corre con su cuenta), una vez por
        hora desde aprender(): solo los números sin foto, cada número a lo mucho una vez cada FCT_GOOGLE_DIAS_ días.
     3. manual · Juan sube una foto en el chat abierto (Más acciones → «Subir una foto del contacto»).
   Facebook e Instagram no: su API no da la foto de otras personas.
   Dónde viven: JPEG de 256×256 o menos, en una carpeta privada del Drive del Hub (no se comparte; FOTOS_CT_CARPETA_ID se
   crea sola), nunca en el repo ni con enlace público. El índice es la hoja ALMA_FOTOS (tel · archivo · origen ·
   actualizado · google_buscado). La manual gana sobre las otras y la del iPhone sobre la de Google; «quitada» (Juan la
   quitó) tampoco la pisan las automáticas.
   Cómo llegan al Hub: la fila de la bandeja trae foto_contacto = «<últimos 8>.<versión>» y el Hub pide la foto aparte
   (fotosContacto «ver», con sesión), como data: URL; la clave cambia con cada foto nueva. Sin sesión no hay fotos. */
var FCT_HOJA_ = 'ALMA_FOTOS';
var FCT_CAB_ = ['tel', 'archivo', 'origen', 'actualizado', 'google_buscado'];
var FCT_RANGO_ = { manual: 3, quitada: 3, iphone: 2, google: 1 };   // quién pisa a quién (igual o más alto)
var FCT_LADO_ = 256, FCT_BYTES_ = 64 * 1024;
var FCT_CACHE_ = 'fct_indice_v1', FCT_SEG_ = 600;
var FCT_GOOGLE_DIAS_ = 7, FCT_GOOGLE_MAX_ = 20, FCT_GOOGLE_PAGINAS_ = 5;
var FCT_FALTAN_MAX_ = 80, FCT_VER_MAX_ = 12, FCT_SUBIR_MAX_ = 5;

/* ── Reglas puras (las prueba .github/fotos-contactos.js) ── */

/* ¿La foto nueva (origen) reemplaza a la que ya hay? Sin foto, sí; si no, solo con un origen igual o más fuerte. */
function fctGana_(nuevo, actual) {
  if (!FCT_RANGO_[nuevo] || nuevo === 'quitada') return false;
  return !actual || (FCT_RANGO_[nuevo] || 0) >= (FCT_RANGO_[actual] || 0);
}

/* Ancho y alto de un JPEG leyendo su cabecera (SOF), sin abrir la imagen. null si no es un JPEG. */
function fctJpegLado_(b) {
  var u = function (i) { return b[i] & 255; };
  if (!b || b.length < 4 || u(0) !== 0xFF || u(1) !== 0xD8) return null;
  var i = 2;
  while (i + 8 < b.length) {
    if (u(i) !== 0xFF) return null;
    var m = u(i + 1);
    if (m === 0xFF) { i++; continue; }
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD8)) { i += 2; continue; }
    var len = (u(i + 2) << 8) | u(i + 3);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { alto: (u(i + 5) << 8) | u(i + 6), ancho: (u(i + 7) << 8) | u(i + 8) };
    if (m === 0xDA || m === 0xD9 || len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/* La foto que llega (data: URL o base64) → bytes, solo si es un JPEG de 256×256 o menos y de hasta 64 KB. */
function fctRevisar_(entrada) {
  var s = String(entrada || ''), mm = /^data:([^;,]+);base64,/.exec(s);
  if (mm && mm[1].toLowerCase() !== 'image/jpeg') return { ok: false, error: 'La foto tiene que ser JPEG.' };
  s = s.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!s || s.length > Math.ceil(FCT_BYTES_ * 4 / 3) + 8 || !/^[A-Za-z0-9+\/=]+$/.test(s)) return { ok: false, error: 'La foto es muy grande o no se pudo leer.' };
  var b; try { b = Utilities.base64Decode(s); } catch (e) { return { ok: false, error: 'La foto no se pudo leer.' }; }
  return fctRevisarBytes_(b);
}
function fctRevisarBytes_(b) {
  if (!b || !b.length || b.length > FCT_BYTES_) return { ok: false, error: 'La foto es muy grande (máximo 64 KB).' };
  var t = fctJpegLado_(b);
  if (!t) return { ok: false, error: 'La foto tiene que ser JPEG.' };
  if (!t.ancho || !t.alto || t.ancho > FCT_LADO_ || t.alto > FCT_LADO_) return { ok: false, error: 'La foto tiene que medir 256×256 o menos.' };
  return { ok: true, bytes: b, ancho: t.ancho, alto: t.alto };
}

/* La versión corta de una fecha: cambia con cada foto nueva, así el Hub sabe cuándo pedirla otra vez. */
function fctVersion_(iso) { var n = Date.parse(iso || ''); return n ? Math.floor(n / 1000).toString(36) : '0'; }

/* La foto de un contacto de Google, en 256 px y JPEG (el sufijo «=s100» de su enlace dice el tamaño). */
function fctGoogleUrl_(u) { return String(u || '').replace(/=[A-Za-z0-9-]+$/, '') + '=s256-c-rj'; }

/* ── Hoja e índice ── */

function fctHoja_(crear) {
  var ss = ssAlma_(), sh = ss.getSheetByName(FCT_HOJA_);
  if (!sh && crear) sh = hojaCrear_(FCT_HOJA_, FCT_CAB_);
  return sh || null;
}
function fctFilas_() {
  var sh = fctHoja_(false); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, FCT_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: i + 2 }; FCT_CAB_.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : String(v[j] == null ? '' : v[j]); }); return o;
  });
}
/* Índice: últimos 8 → { a: archivo, o: origen, v: versión, g: última búsqueda en Google, t: número }. */
function fctIndice_() {
  var cache = null; try { cache = CacheService.getScriptCache(); } catch (e) {}
  var c0 = cache && cache.get(FCT_CACHE_); if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  var idx = {};
  fctFilas_().forEach(function (o) {
    var k = fin8_(o.tel); if (!k) return;
    idx[k] = { a: o.archivo, o: o.origen, v: fctVersion_(o.actualizado), g: o.google_buscado, t: normTel_(o.tel) };
  });
  try { var s = JSON.stringify(idx); if (cache && s.length < 90000) cache.put(FCT_CACHE_, s, FCT_SEG_); } catch (e) {}
  return idx;
}
/* Para la bandeja: últimos 8 → versión, solo de los que tienen foto. */
function fctVersiones_() {
  var idx = fctIndice_(), out = {};
  Object.keys(idx).forEach(function (k) { if (idx[k].a) out[k] = idx[k].v; });
  return out;
}
function fctOlvidarCache_() {
  try { var c = CacheService.getScriptCache(); c.remove(FCT_CACHE_); c.remove(BANDEJA_ESFERA_CACHE_); } catch (e) {}
}
/* Escribe cambios { tel: { campo: valor } } en ALMA_FOTOS. Quien llama tiene el candado. */
function fctEscribir_(cambios) {
  var tels = Object.keys(cambios || {}); if (!tels.length) return;
  var sh = fctHoja_(true), filas = fctFilas_(), porK = {};
  filas.forEach(function (o) { var k = fin8_(o.tel); if (k) porK[k] = o; });
  var nuevas = [];
  tels.forEach(function (t) {
    var k = fin8_(t), o = porK[k], c = cambios[t];
    var fila = FCT_CAB_.map(function (h) { return h === 'tel' ? normTel_(t) : (c[h] != null ? String(c[h]) : (o ? o[h] : '')); });
    if (o) sh.getRange(o.fila, 1, 1, FCT_CAB_.length).setValues([fila]); else nuevas.push(fila);
  });
  if (nuevas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, FCT_CAB_.length).setValues(nuevas);
  fctOlvidarCache_();
}
/* La carpeta privada del Drive del Hub (no se comparte con nadie). */
function fctCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('FOTOS_CT_CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.error('FOTOS_CT_CARPETA_ID inválida: ' + e); } }
  var f = DriveApp.createFolder('Fotos de contactos (Hub, privada)');
  p.setProperty('FOTOS_CT_CARPETA_ID', f.getId());
  return f;
}

/* ── Guardar, quitar y servir ── */

/* Guarda la foto de un número (bytes o data: URL). → { ok, clave } · { ok, omitida } · { ok: false, error }. */
function fctGuardar_(tel, foto, origen) {
  tel = normTel_(tel); var k = fin8_(tel);
  if (!tel) return { ok: false, error: 'Número inválido.' };
  if (!FCT_RANGO_[origen] || origen === 'quitada') return { ok: false, error: 'Origen inválido.' };
  var r = typeof foto === 'string' ? fctRevisar_(foto) : fctRevisarBytes_(foto); if (!r.ok) return r;
  var soltar = candadoTomar_(8000); if (!soltar) { return { ok: false, error: 'Ocupado, intenta de nuevo.' }; }
  try {
    var act = fctIndice_()[k];
    if (act && act.o && !fctGana_(origen, act.o)) return { ok: true, omitida: true, tel: tel };
    var f = fctCarpeta_().createFile(Utilities.newBlob(r.bytes, 'image/jpeg', 'contacto-' + k + '-' + origen + '.jpg'));
    if (act && act.a && act.a !== f.getId()) { try { DriveApp.getFileById(act.a).setTrashed(true); } catch (e) {} }
    var ahora = new Date().toISOString(), c = {}; c[tel] = { archivo: f.getId(), origen: origen, actualizado: ahora };
    fctEscribir_(c);
    return { ok: true, tel: tel, clave: k + '.' + fctVersion_(ahora) };
  } finally { soltar(); }
}
function fctQuitar_(tel) {
  tel = normTel_(tel); var k = fin8_(tel); if (!tel) return { ok: false, error: 'Número inválido.' };
  var soltar = candadoTomar_(8000); if (!soltar) { return { ok: false, error: 'Ocupado, intenta de nuevo.' }; }
  try {
    var act = fctIndice_()[k];
    if (act && act.a) { try { DriveApp.getFileById(act.a).setTrashed(true); } catch (e) {} }
    var c = {}; c[tel] = { archivo: '', origen: 'quitada', actualizado: new Date().toISOString() };
    fctEscribir_(c);
    return { ok: true };
  } finally { soltar(); }
}
/* La foto como data: URL (en caché 6 h; cabe holgada: 64 KB → ~86 KB en base64). */
function fctDatos_(k, x) {
  var cache = null; try { cache = CacheService.getScriptCache(); } catch (e) {}
  var ck = 'fct_img_' + k + '_' + x.v, c0 = cache && cache.get(ck); if (c0) return c0;
  var d = ''; try { d = 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(x.a).getBlob().getBytes()); } catch (e) { console.error('fctDatos_: ' + e); return ''; }
  try { if (cache && d.length < 99000) cache.put(ck, d, 21600); } catch (e) {}
  return d;
}
/* «ver»: solo la clave exacta que la bandeja mandó (últimos 8 y versión actual); otra cosa no devuelve nada. */
function fctVer_(claves) {
  var idx = fctIndice_(), out = {};
  (Array.isArray(claves) ? claves : []).slice(0, FCT_VER_MAX_).forEach(function (c) {
    var m = /^(\d{8})\.([a-z0-9]+)$/.exec(String(c || '')); if (!m) return;
    var x = idx[m[1]]; if (!x || !x.a || x.v !== m[2]) return;
    var d = fctDatos_(m[1], x); if (d) out[c] = d;
  });
  return { ok: true, fotos: out };
}

/* Los números de la bandeja (WhatsApp) sin foto de ningún lado. paraIphone: también los que solo tienen la de Google
   (la del iPhone va antes). Nunca los que Juan quitó a mano. */
function fctFaltan_(paraIphone) {
  var filas = hubInbox_(); bandejaEsferaFoto_(filas);
  var idx = fctIndice_(), vistos = {}, out = [];
  filas.forEach(function (o) {
    var id = String(o.conv_id || ''); if (id.indexOf('wa:') !== 0 || o.foto) return;
    var t = normTel_(id.slice(3)), k = fin8_(t); if (!t || vistos[k]) return; vistos[k] = 1;
    var x = idx[k];
    if (x && x.o === 'quitada') return;
    if (x && x.a && !(paraIphone && x.o === 'google')) return;
    out.push(t);
  });
  return out;
}

/* ── Contactos de Google (servicio avanzado People; corre con la cuenta de Juan) ── */

/* Una vez por hora desde aprender(): busca en los Contactos de Google los números de la bandeja sin foto. Lee solo
   teléfonos y fotos, en memoria; guarda solo las fotos de esos números. */
function fotosGoogleRepasar_(o) {
  o = o || {};
  if (typeof People === 'undefined' || !People.People || !People.People.Connections) return { ok: false, error: 'Falta el servicio People.' };
  var idx = fctIndice_(), ahora = o.ahora || Date.now(), lim = ahora - FCT_GOOGLE_DIAS_ * 864e5;
  var faltan = (o.tels || fctFaltan_(false)).filter(function (t) { var x = idx[fin8_(t)]; return !(x && x.g && Date.parse(x.g) > lim); }).slice(0, FCT_FALTAN_MAX_);
  if (!faltan.length) return { ok: true, buscados: 0, encontradas: 0 };
  var quiero = {}; faltan.forEach(function (t) { quiero[fin8_(t)] = t; });
  var hallado = fctGoogleBuscar_(quiero), n = 0;
  Object.keys(hallado).slice(0, FCT_GOOGLE_MAX_).forEach(function (k) {
    try {
      var r = uf_(fctGoogleUrl_(hallado[k]), { muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() >= 300) return;
      var g = fctGuardar_(quiero[k], r.getBlob().getBytes(), 'google');
      if (g.ok && !g.omitida) n++;
    } catch (e) { console.error('fotosGoogle ' + k + ': ' + e); }
  });
  var soltar = candadoTomar_(8000); if (!soltar) { return { ok: true, buscados: faltan.length, encontradas: n }; }
  try { var c = {}, iso = new Date(ahora).toISOString(); faltan.forEach(function (t) { c[t] = { google_buscado: iso }; }); fctEscribir_(c); }
  finally { soltar(); }
  return { ok: true, buscados: faltan.length, encontradas: n };
}
/* { últimos 8: true } → { últimos 8: enlace de la foto } de los contactos de Google con foto propia (no la de la letra). */
function fctGoogleBuscar_(quiero) {
  var hallado = {}, token = '', paginas = 0;
  do {
    var q = { personFields: 'phoneNumbers,photos', pageSize: 1000 }; if (token) q.pageToken = token;
    var r = People.People.Connections.list('people/me', q) || {};
    (r.connections || []).forEach(function (p) {
      var foto = (p.photos || []).filter(function (f) { return f && f.url && !f.default; })[0]; if (!foto) return;
      (p.phoneNumbers || []).forEach(function (n) { var k = fin8_(n.canonicalForm || n.value); if (k && quiero[k] && !hallado[k]) hallado[k] = foto.url; });
    });
    token = r.nextPageToken || ''; paginas++;
  } while (token && paginas < FCT_GOOGLE_PAGINAS_);
  return hallado;
}
/* Para correr UNA vez desde el editor de Apps Script después de unir: Google pide a Juan el permiso nuevo
   («Ver tus contactos»). Solo lee si la cuenta tiene contactos; no guarda nada. */
function fotosGoogleAutorizar() {
  var r = People.People.Connections.list('people/me', { personFields: 'names', pageSize: 1 }) || {};
  console.log('Contactos de Google: permiso listo (' + (r.totalPeople || 0) + ' contactos).');
}

/* ── API del Hub: acción fotosContacto { que: ver | faltan | subir | quitar } ── */
function fotosContactoApi_(ses, b) {
  b = b || {}; var que = String(b.que || 'ver');
  if (!ses || !String(ses.email || '').trim()) return { ok: false, error: 'Inicia sesión para ver las fotos.' };
  if (que === 'ver') return fctVer_(b.claves);
  if (!areasAdmin_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  if (que === 'faltan') return { ok: true, tels: fctFaltan_(true).slice(0, FCT_FALTAN_MAX_) };
  if (que === 'quitar') return fctQuitar_(b.tel);
  if (que === 'subir') {
    var origen = String(b.origen || ''); if (origen !== 'iphone' && origen !== 'manual') return { ok: false, error: 'Origen inválido.' };
    var lista = (Array.isArray(b.fotos) ? b.fotos : []).slice(0, FCT_SUBIR_MAX_);
    if (!lista.length) return { ok: false, error: 'No llegó ninguna foto.' };
    return { ok: true, fotos: lista.map(function (f) { try { return fctGuardar_(f && f.tel, f && f.jpeg, origen); } catch (e) { console.error('fctGuardar_: ' + e); return { ok: false, error: 'No se guardó.' }; } }) };
  }
  return { ok: false, error: 'Acción inválida.' };
}
