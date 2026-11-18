/* ═══ VER VIDEO: un enlace y Claudio lo ve (Juan, 18-nov-2026) ═══════════════════════════════════════════════════════
   «Para que evitáramos tener que bajar videos de TikTok, Facebook, Instagram o cualquier red social, yo pueda pasarte el
   link para que tú puedas verlo. Dejemos la opción de la carpeta como base, pero tengo que poder compartir un link de
   TikTok y que tú puedas ver el video, entenderlo. Esto tiene que estar también habilitado para Alma App: si a Claudio le
   pasamos un link de TikTok o de Instagram, debería ser capaz de ver el video y tomar decisiones en base a eso.»

   Cómo funciona:
   1. PEDIDO: Juan pasa un enlace (TikTok, Instagram, Facebook, YouTube o X) o un archivo de su carpeta de Drive de
      desarrollo, a Claudio (herramienta ver_video, voz y chat) o a una sesión de Claude (robot «ver_video»). Se anota en
      ALMA_VIDEOS y el Hub lanza el workflow «Ver video» de GitHub (repository_dispatch «ver-video»).
   2. EL WORKFLOW (.github/workflows/ver-video.yml) baja el video, saca fotos clave con su hora (hojas de contacto de 3 x 3)
      y la transcripción con tiempos, y lo entrega aquí (verVideo «listo», con la llave que comparte con el Hub). Los
      archivos de Drive los pide por trozos (verVideo «trozo»): la llave de Google nunca sale del Hub, y solo da archivos
      que se pidieron y que están en la carpeta de desarrollo.
   3. RESULTADO: se guarda en el Drive de alma@ («Claudio · Videos vistos», una carpeta por video: transcripción, hojas y
      datos), Claude arma un resumen mirando las hojas y leyendo la transcripción, y Claudio se lo cuenta a Juan en su hilo
      (y una notificación). Con el mismo enlace, ver_video devuelve el resumen y la transcripción para decidir.
   Privado: nada de esto pasa por el repo (es público); el workflow no imprime ni deja artefactos.
   «Mira lo nuevo»: los archivos que Juan subió hoy a la carpeta de desarrollo (vvCarpetaNuevo_): los videos se ven y lo
   demás (fotos, documentos) se lista para que Claude los lea con el robot «drive_archivo». */

var VV_CAB_ = ['id', 'creado', 'email', 'origen', 'url', 'drive', 'estado', 'titulo', 'plataforma', 'duracion', 'idioma', 'resumen', 'carpeta', 'transcripcion', 'hojas', 'error', 'listo', 'lanzado'];
var VV_HOST_RE_ = /^(?:[\w-]+\.)*(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|fb\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)$/i;
var VV_CARPETA_DEV_ = '1S1P3dhd6W71SEgzSTUMyC_V_Gg_BNJX7';   // la carpeta de desarrollo de Juan (compartida con alma@); se cambia con VER_VIDEO_DEV
var VV_CARPETA_PROP_ = 'VER_VIDEO_CARPETA', VV_CARPETA_NOMBRE_ = 'Claudio · Videos vistos';
var VV_VIENDO_MS_ = 25 * 60000;      // un pedido sin respuesta por más de 25 min se puede volver a pedir
var VV_REUSO_MS_ = 30 * 86400000;    // un video visto se reusa 30 días
var VV_TROZO_ = 6 * 1024 * 1024;     // lo que se entrega por vuelta desde Drive
var VV_ARCHIVO_MAX_ = 15 * 1024 * 1024;
var VV_POR_VEZ_ = 3;                 // «mira lo nuevo»: a lo mucho 3 videos por vez
var VV_RESUMEN_SYS_ = JSON.stringify({
  rol: 'Ves videos para Claudio, el equipo de desarrollo de Spacio AM (apartamentos de estadía corta en Guatemala, con su asistente Alma).',
  tarea: 'Con las hojas de fotos clave (cada foto con su hora arriba a la izquierda), la transcripción con tiempos y los datos del video, di de qué trata el video para que Juan y Claudio puedan decidir algo con eso.',
  pasos: ['Mira las hojas en orden: qué se ve, qué pasa, qué texto aparece en pantalla.', 'Lee la transcripción: qué se dice y quién.', 'Junta las dos cosas.'],
  restricciones: ['Solo lo que se ve o se oye; si algo no se distingue, dilo.', 'Español simple, sin títulos ni listas.', 'Máximo 700 caracteres.'],
  formato_de_respuesta: 'Texto plano: 3 a 5 frases (de qué trata, qué se ve, qué se dice, la idea principal) y al final una frase que empiece con «Para Spacio AM:» con lo que podría servirnos o qué decidir.'
});

function vvHoja_() {
  var sh = hojaCrear_('ALMA_VIDEOS', VV_CAB_);
  if (sh.getLastColumn() < VV_CAB_.length) sh.getRange(1, 1, 1, VV_CAB_.length).setValues([VV_CAB_]);
  return sh;
}
function vvFilas_() {
  var sh = vvHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, VV_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: i + 2 }; VV_CAB_.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : String(v[j] == null ? '' : v[j]); }); return o;
  });
}
function vvGuardar_(x, cambios) {
  Object.keys(cambios).forEach(function (k) { x[k] = cambios[k]; });
  vvHoja_().getRange(x.fila, 1, 1, VV_CAB_.length).setValues([VV_CAB_.map(function (k) { return k === 'fila' ? '' : celdaTexto_(String(x[k] == null ? '' : x[k])); })]);
}
function vvCarpetaDev_() { try { return PropertiesService.getScriptProperties().getProperty('VER_VIDEO_DEV') || VV_CARPETA_DEV_; } catch (e) { return VV_CARPETA_DEV_; } }

/* ── Qué pasó Juan: un enlace de red social, un enlace o id de Drive. Texto con más cosas: el primer enlace. ── */
function vvEntrada_(t) {
  t = String(t || '').trim();
  var d = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/.exec(t);
  if (d) return { drive: d[1] };
  if (/^[\w-]{25,}$/.test(t)) return { drive: t };
  var m = /https?:\/\/[^\s<>"'«»]+/.exec(t); if (!m) return null;
  var u = m[0].replace(/[).,;!?]+$/, ''), h = (/^https?:\/\/([^\/?#:]+)/.exec(u) || [])[1] || '';
  if (!VV_HOST_RE_.test(h)) return null;
  u = u.replace(/^http:/, 'https:');
  /* Sin lo que sigue al «?» (rastreo de quién compartió), salvo lo que dice cuál video es (YouTube v, Facebook v / story_fbid). */
  var q = (u.split('?')[1] || '').split('#')[0], deja = [];
  q.split('&').forEach(function (p) { if (/^(v|story_fbid|id|fbid)=/.test(p)) deja.push(p); });
  return { url: u.split(/[?#]/)[0] + (deja.length ? '?' + deja.join('&') : '') };
}

/* ── Pedir: anota y lanza el workflow. Si ya se vio (30 días) o se está viendo, no repite. ── */
function vvPedir_(adm, texto, o) {
  o = o || {};
  var e = vvEntrada_(texto);
  if (!e) return { ok: false, error: 'No reconozco ese enlace. Sirve uno de TikTok, Instagram, Facebook, YouTube o X, o un archivo de la carpeta de desarrollo en Drive.' };
  var ahora = Date.now(), ya = vvFilas_().filter(function (x) { return e.url ? x.url === e.url : x.drive === e.drive; }).reverse();
  var listo = ya.filter(function (x) { return x.estado === 'listo' && ahora - Date.parse(x.listo || x.creado) < VV_REUSO_MS_; })[0];
  if (listo && !o.otraVez) return { ok: true, ya: true, video: listo };
  var viendo = ya.filter(function (x) { return x.estado === 'pedido' && ahora - Date.parse(x.creado) < VV_VIENDO_MS_; })[0];
  if (viendo) return { ok: true, viendo: true, video: viendo, min: Math.round((ahora - Date.parse(viendo.creado)) / 60000) };
  var sh = vvHoja_(), x = { id: 'vv' + ahora + Math.floor(Math.random() * 90 + 10), creado: new Date(ahora).toISOString(), email: (adm && adm.email) || '',
    origen: o.origen || 'claudio', url: e.url || '', drive: e.drive || '', estado: 'pedido' };
  sh.appendRow(VV_CAB_.map(function (k) { return celdaTexto_(String(x[k] || '')); }));
  x.fila = sh.getLastRow();
  if (o.sinLanzar) return { ok: true, nuevo: true, video: x, lanzado: 0 };
  var r = vvLanzar_(x);
  vvGuardar_(x, { lanzado: String(r.code) });
  if (r.code !== 204) {
    vvGuardar_(x, { estado: 'error', error: 'GitHub no lanzó el workflow (' + r.code + ')' });
    return { ok: false, error: 'No pude lanzar la revisión del video (GitHub respondió ' + r.code + '). Revisa la llave de GitHub en Conexiones (permiso «Contents: Read and write»).', video: x, lanzado: r.code };
  }
  return { ok: true, nuevo: true, video: x, lanzado: r.code };
}
/* El workflow «Ver video» con la llave de GitHub del Hub (las mismas de «para-alma»: prueba las dos). */
function vvLanzar_(x) {
  var p = { id: x.id }; if (x.url) p.url = x.url; if (x.drive) p.drive = x.drive;
  return paraAlmaGh_('POST', '/repos/' + PARA_ALMA_REPO_ + '/dispatches', { event_type: 'ver-video', client_payload: p });
}

/* ── Lo que llega del workflow (doPost: body.verVideo), con la llave compartida ── */
function vvApi_(b) {
  b = b || {};
  var llave = paraAlmaAvisoLlave_(); if (!llave) return { ok: false, error: 'el Hub no tiene la llave' };
  if (!paraAlmaLlaveIgual_(String(b.llave || ''), llave)) return { ok: false, error: 'llave incorrecta' };
  if (b.verVideo === 'trozo') return vvTrozo_(b);
  if (b.verVideo === 'listo') return vvListo_(b);
  return { ok: false, error: 'qué' };
}
/* ¿Está el archivo en la carpeta de desarrollo (o en una carpeta dentro de ella, hasta 3 niveles)? */
function vvEnCarpetaDev_(f) {
  var dev = vvCarpetaDev_(), nivel = [f], vistos = {};
  for (var n = 0; n < 4 && nivel.length; n++) {
    var sig = [];
    for (var i = 0; i < nivel.length; i++) {
      var ps = nivel[i].getParents();
      while (ps.hasNext()) { var p = ps.next(), id = p.getId(); if (id === dev) return true; if (!vistos[id]) { vistos[id] = 1; sig.push(p); } }
    }
    nivel = sig;
  }
  return false;
}
/* Un trozo del archivo de Drive: solo si hay un pedido abierto con ese archivo y está en la carpeta de desarrollo. */
function vvTrozo_(b) {
  var id = String(b.id || ''), desde = Math.max(0, Number(b.desde) || 0);
  var x = vvFilas_().filter(function (v) { return v.drive === id && v.estado === 'pedido'; })[0];
  if (!x) return { ok: false, error: 'no hay un pedido abierto con ese archivo' };
  var f; try { f = DriveApp.getFileById(id); } catch (e) { return { ok: false, error: 'no encuentro el archivo en Drive' }; }
  if (!vvEnCarpetaDev_(f)) return { ok: false, error: 'el archivo no está en la carpeta de desarrollo' };
  var total = f.getSize(), hasta = Math.min(total, desde + VV_TROZO_) - 1, bytes = null;
  if (desde >= total) return { ok: false, error: 'fuera del archivo' };
  try {
    var r = uf_('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + desde + '-' + hasta }, muteHttpExceptions: true }, 'Chat de Alma');
    if (r.getResponseCode() === 206 || (r.getResponseCode() === 200 && desde === 0 && total <= VV_TROZO_)) bytes = r.getContent();
    else console.error('vvTrozo_ Drive ' + r.getResponseCode());
  } catch (e) { console.error('vvTrozo_: ' + e); }
  if (!bytes && total <= 45 * 1024 * 1024) bytes = f.getBlob().getBytes().slice(desde, hasta + 1);   // respaldo: el archivo entero por DriveApp
  if (!bytes || !bytes.length) return { ok: false, error: 'no pude leer el archivo' };
  return { ok: true, total: total, nombre: f.getName(), datos: Utilities.base64Encode(bytes) };
}
function vvCarpetaRaiz_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty(VV_CARPETA_PROP_);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var c = DriveApp.createFolder(VV_CARPETA_NOMBRE_); p.setProperty(VV_CARPETA_PROP_, c.getId()); return c;
}
function vvHora_(s) { s = Math.round(Number(s) || 0); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
/* El resultado: Drive de alma@ + resumen + aviso a Juan en el hilo de Claudio. */
function vvListo_(b) {
  var x = vvFilas_().filter(function (v) { return v.id === String(b.id || ''); })[0];
  if (!x) return { ok: false, error: 'no conozco ese pedido' };
  if (x.estado === 'listo') return { ok: true, ya: true };
  var adm = (x.email && adminsOp_().filter(function (a) { return a.email === x.email; })[0]) || agPrincipal_();
  if (b.error) {
    var mot = String(b.error).replace(/\s+/g, ' ').slice(0, 300);
    vvGuardar_(x, { estado: 'error', error: mot, listo: new Date().toISOString() });
    var pista = /login|log in|cookies|sign in|private|privad|rate|inicia sesi/i.test(mot) ? ' Esa red pide iniciar sesión: súbelo a la carpeta de desarrollo en Drive y dime «mira lo nuevo».' : '';
    vvContar_(adm, 'No pude ver el video' + (x.url ? ' (' + x.url + ')' : '') + ': ' + mot + '.' + pista, { titulo: 'No pude ver el video', detalle: mot });
    return { ok: true, error_guardado: true };
  }
  var meta = b.meta || {}, res = b.resultado || {}, segs = Array.isArray(res.segmentos) ? res.segmentos : [], hojas = Array.isArray(b.hojas) ? b.hojas.slice(0, 6) : [];
  var titulo = String(meta.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 120) || (x.drive ? 'archivo de Drive' : 'video');
  var texto = segs.map(function (s) { return '[' + vvHora_(s.i) + '] ' + String(s.t || '').trim(); }).join('\n');
  var raiz = vvCarpetaRaiz_(), fecha = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  var c = raiz.createFolder(fecha + ' · ' + titulo.replace(/[\/\\]/g, ' ').slice(0, 60));
  var tf = c.createFile('transcripcion.txt', (texto || '(sin voz)') + '\n', MimeType.PLAIN_TEXT);
  var ids = hojas.map(function (h, i) {
    var bl = Utilities.newBlob(Utilities.base64Decode(String(h.jpg || '')), 'image/jpeg', 'hoja_' + (i + 1) + '.jpg');
    return { id: c.createFile(bl).getId(), desde: h.desde, hasta: h.hasta };
  });
  c.createFile('video.json', JSON.stringify({ id: x.id, url: x.url, drive: x.drive, meta: meta, duracion: res.duracion, idioma: res.idioma, ancho: res.ancho, alto: res.alto, segmentos: segs }, null, 1), MimeType.PLAIN_TEXT);
  var user = 'DATOS: ' + JSON.stringify({ titulo: titulo, autor: meta.autor || '', plataforma: meta.plataforma || (x.drive ? 'drive' : ''), descripcion: String(meta.descripcion || '').slice(0, 1500), duracion: vvHora_(res.duracion), vistas: meta.vistas, likes: meta.likes }) +
    '\n\nTRANSCRIPCIÓN (' + (res.idioma || 'sin voz') + '):\n' + (texto.slice(0, 14000) || '(el video no tiene voz)') +
    '\n\nLas imágenes son las hojas de fotos clave, en orden.';
  var resumen = '';
  try { resumen = String(vvResumir_(user, hojas) || '').replace(/\s+/g, ' ').trim().slice(0, 900); } catch (e) { console.error('vvResumir_: ' + e); }
  if (!resumen) resumen = segs.length ? 'Dice: ' + texto.replace(/\[[\d:]+\]\s*/g, '').replace(/\s+/g, ' ').slice(0, 400) : 'No pude armar el resumen; las fotos y los datos quedaron guardados.';
  vvGuardar_(x, { estado: 'listo', titulo: titulo, plataforma: meta.plataforma || (x.drive ? 'drive' : ''), duracion: String(res.duracion || ''), idioma: res.idioma || '', resumen: resumen,
    carpeta: c.getId(), transcripcion: tf.getId(), hojas: JSON.stringify(ids), listo: new Date().toISOString(), error: '' });
  vvContar_(adm, 'Ya vi el video «' + titulo + '» (' + vvHora_(res.duracion) + '). ' + resumen, { titulo: titulo, detalle: resumen });
  return { ok: true, id: x.id, hojas: ids.length, frases: segs.length };
}
function vvResumir_(user, hojas) {
  var imgs = hojas.slice(0, 4).map(function (h) { return 'data:image/jpeg;base64,' + h.jpg; });
  return claude_(CFG.MODELO_REDACTOR, 700, VV_RESUMEN_SYS_, user, 0.2, imgs, 4);
}
/* Claudio se lo cuenta a Juan en su hilo (Propósito · Desarrollo, canal claudio: lo ve también en su siguiente turno) y una notificación. */
function vvContar_(adm, texto, d) {
  if (!adm) return;
  try { opGuardar_(adm, 'alma', 'claudio', String(texto).slice(0, 790), [], CHAT_DESARROLLO_); } catch (e) { console.error('vvContar_ hilo: ' + e); }
  try { avisoPoner_(adm, d.titulo === 'No pude ver el video' ? 'video_fallo' : 'video_visto', d, null, { nivel: 3 }); } catch (e) { console.error('vvContar_ aviso: ' + e); }
}

/* ── Leer un video visto: resumen, transcripción y (si se pide) las hojas en base64, para Claudio y el robot ── */
function vvLeer_(x, o) {
  o = o || {};
  var out = { id: x.id, estado: x.estado, url: x.url, drive: x.drive, titulo: x.titulo, plataforma: x.plataforma, duracion: x.duracion, idioma: x.idioma, resumen: x.resumen, error: x.error, creado: x.creado, listo: x.listo };
  if (x.carpeta) out.carpeta = 'https://drive.google.com/drive/folders/' + x.carpeta;
  if (x.estado !== 'listo') return out;
  if (o.transcripcion !== false && x.transcripcion) {
    try { var t = DriveApp.getFileById(x.transcripcion).getBlob().getDataAsString('UTF-8'); out.transcripcion = o.max ? t.slice(0, o.max) : t; } catch (e) { out.transcripcion = ''; }
  }
  if (o.fotos) {
    var hs = []; try { hs = JSON.parse(x.hojas || '[]'); } catch (e) {}
    out.hojas = hs.map(function (h) { try { return { desde: h.desde, hasta: h.hasta, jpg: Utilities.base64Encode(DriveApp.getFileById(h.id).getBlob().getBytes()) }; } catch (e) { return null; } }).filter(Boolean);
  }
  return out;
}
function vvBuscar_(b) {
  var fs = vvFilas_();
  if (b.id) return fs.filter(function (x) { return x.id === String(b.id); })[0] || null;
  var e = vvEntrada_(b.url || b.drive || ''); if (!e) return fs[fs.length - 1] || null;
  return fs.filter(function (x) { return e.url ? x.url === e.url : x.drive === e.drive; }).pop() || null;
}

/* ── «Mira lo nuevo»: lo que Juan subió hoy (o en los últimos días) a la carpeta de desarrollo ── */
function vvCarpetaNuevo_(adm, dias, o) {
  o = o || {};
  dias = Math.max(1, Math.min(14, Number(dias) || 1));
  var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd'), desde = Date.parse(hoy + 'T00:00:00-06:00') - (dias - 1) * 86400000;
  var raiz; try { raiz = DriveApp.getFolderById(vvCarpetaDev_()); } catch (e) { return { ok: false, error: 'No puedo abrir la carpeta de desarrollo (¿sigue compartida con alma@?).' }; }
  var lista = [], cola = [{ c: raiz, ruta: '' }];
  for (var n = 0; n < 20 && cola.length; n++) {
    var it = cola.shift(), fs = it.c.getFiles();
    while (fs.hasNext()) {
      var f = fs.next(), t = Math.max(f.getDateCreated().getTime(), f.getLastUpdated().getTime());
      if (t >= desde) lista.push({ id: f.getId(), nombre: (it.ruta ? it.ruta + '/' : '') + f.getName(), tipo: f.getMimeType(), mb: Math.round(f.getSize() / 104857.6) / 10, creado: f.getDateCreated().toISOString() });
    }
    var cs = it.c.getFolders(); while (cs.hasNext()) { var s = cs.next(); cola.push({ c: s, ruta: (it.ruta ? it.ruta + '/' : '') + s.getName() }); }
  }
  lista.sort(function (a, b) { return a.creado < b.creado ? -1 : 1; });
  var vistos = 0;
  lista.forEach(function (a) {
    if (!/^video\//.test(a.tipo)) return;
    if (o.sinVer || vistos >= VV_POR_VEZ_) { a.video = 'sin pedir'; return; }
    var r = vvPedir_(adm, a.id, { origen: o.origen || 'carpeta' });
    a.video = r.ok ? (r.ya ? 'visto' : r.viendo ? 'viendo' : 'pedido') : 'no salió: ' + r.error;
    a.video_id = r.video && r.video.id; if (r.ya) a.resumen = r.video.resumen;
    vistos++;
  });
  return { ok: true, desde: new Date(desde).toISOString(), archivos: lista };
}
/* Un archivo de la carpeta (foto, PDF, documento) en base64, para que una sesión de Claude lo lea (robot «drive_archivo»). */
function vvArchivo_(id) {
  var f; try { f = DriveApp.getFileById(String(id || '')); } catch (e) { return { ok: false, error: 'no encuentro el archivo' }; }
  if (!vvEnCarpetaDev_(f)) return { ok: false, error: 'el archivo no está en la carpeta de desarrollo' };
  var tipo = f.getMimeType();
  if (/^video\//.test(tipo)) return { ok: false, error: 'es un video: pídelo con «ver_video» (drive)' };
  var bl = /^application\/vnd\.google-apps\./.test(tipo) ? f.getAs('application/pdf') : f.getBlob();
  if (bl.getBytes().length > VV_ARCHIVO_MAX_) return { ok: false, error: 'pesa más de 15 MB' };
  return { ok: true, nombre: f.getName(), tipo: bl.getContentType(), datos: Utilities.base64Encode(bl.getBytes()) };
}

/* ── La herramienta de Claudio (voz y chat): ver_video ── */
function claudioVerVideo_(adm, b) {
  var url = String(b.url || '').trim(), carpeta = String(b.carpeta || '').trim().toLowerCase();
  if (carpeta === 'nuevo' && !url) {
    var c = vvCarpetaNuevo_(adm, b.dias || 1, { origen: 'claudio' });
    if (!c.ok) return { ok: false, error: c.error };
    if (!c.archivos.length) return { ok: true, resultado: 'Hoy no hay nada nuevo en la carpeta de desarrollo.' };
    var vs = c.archivos.filter(function (a) { return a.video; }), otros = c.archivos.filter(function (a) { return !a.video; });
    return { ok: true, archivos: c.archivos.map(function (a) { return { nombre: a.nombre, tipo: a.tipo, video: a.video || '', resumen: a.resumen || '' }; }),
      resultado: (vs.length ? vs.length + (vs.length === 1 ? ' video' : ' videos') + ' de hoy: los que dicen «pedido» o «viendo» llegan en 1 a 5 minutos a tu hilo con su resumen. ' : '') +
        (otros.length ? otros.length + ' archivo(s) más (fotos o documentos): nómbralos; para leerlos a fondo, que Juan te lo pida como pedido de desarrollo.' : '') };
  }
  if (!url) {
    var ult = vvFilas_().filter(function (x) { return x.email === adm.email; }).slice(-3).reverse();
    if (!ult.length) return { ok: true, resultado: 'Todavía no has visto ningún video. Pídele a Juan el enlace (en el chat) o que lo suba a la carpeta de desarrollo.' };
    return { ok: true, videos: ult.map(function (x) { return vvLeer_(x, { transcripcion: false }); }),
      resultado: 'Estos son los últimos videos. Si Juan habla de uno, usa su resumen; para el detalle, llama otra vez con su enlace.' };
  }
  var r = vvPedir_(adm, url, { origen: 'claudio', otraVez: /^(si|sí|otra vez)$/i.test(String(b.otra_vez || '')) });
  if (!r.ok) return { ok: false, error: 'NO SE PUDO: ' + r.error };
  if (r.ya) {
    var v = vvLeer_(r.video, { max: 3000 });
    return { ok: true, visto: true, titulo: v.titulo, duracion: vvHora_(v.duracion), resumen: v.resumen, transcripcion: v.transcripcion, carpeta: v.carpeta,
      resultado: 'YA LO VISTE: usa el resumen y la transcripción (con sus tiempos) para contestar o decidir con Juan. No digas que lo vas a ver.' };
  }
  if (r.viendo) return { ok: true, resultado: 'Lo estás viendo desde hace ' + r.min + ' min: en cuanto termine, el resumen llega al hilo de Claudio. Díselo en una frase y sigue.' };
  return { ok: true, resultado: 'Lo estás viendo: en 1 a 5 minutos el resumen llega al hilo de Claudio (y una notificación). Di solo «Lo estoy viendo; te aviso en el hilo» y sigue con Juan.' };
}

/* ── Robot (dsBot): las sesiones de Claude ── */
function vvRobot_(b) {
  var adm = agPrincipal_();
  switch (b.action) {
    case 'ver_video': {
      var r = vvPedir_(adm, b.url || b.drive || '', { origen: 'claude', otraVez: !!b.otra_vez, sinLanzar: !!b.sin_lanzar });
      return Object.assign({ ok: r.ok, error: r.error, lanzado: r.lanzado || 0, ya: !!r.ya, viendo: !!r.viendo }, r.video ? { video: vvLeer_(r.video, { transcripcion: false }) } : {});
    }
    case 'ver_video_estado': { var x = vvBuscar_(b); return x ? { ok: true, video: vvLeer_(x, { fotos: !!b.fotos }) } : { ok: false, error: 'no encontré ese video' }; }
    case 'ver_videos': return { ok: true, videos: vvFilas_().slice(-Math.min(30, Number(b.n) || 10)).reverse().map(function (x) { return vvLeer_(x, { transcripcion: false }); }) };
    case 'carpeta_nuevo': return vvCarpetaNuevo_(adm, b.dias, { origen: 'claude', sinVer: !!b.sin_ver });
    case 'drive_archivo': return vvArchivo_(b.id);
  }
  return { ok: false, error: 'accion' };
}
