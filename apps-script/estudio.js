/* ═══ MINI ESTUDIO · VOZ OFICIAL DE ALMA (Juan, 19-nov-2026) ════════════════════════════════════════════════════
   «Un mini estudio diseñado para esto: que ahí mismo se grabe, ahí mismo detecte los decibeles y diga si está bien o mal…
   que ahí mismo se guarde, y si hay un problema con la grabación que lo indique para regrabar esa parte.»
   La página (alma/estudio.html) graba, revisa cada toma (js/estudio-calidad.js) y manda aquí el WAV aprobado por trozos.
   Aquí solo se guarda: cada toma va al Drive de alma@, privada, en «Voz oficial de Alma / Sesión N» (nunca con enlace y
   nunca al repo, que es público), y su fila en la hoja ALMA_ESTUDIO (métricas, sin audio) para retomar donde se quedó.
   Quién: el administrador principal y las personas que él invita desde la misma página (propiedad ESTUDIO_INVITADOS).
   Trozos: un WAV de 24 bit a 48 kHz pesa 144 KB por segundo; un pedido lleva hasta ESTUDIO_TROZO_ (4 MiB, múltiplo de
   256 KiB como pide Drive). Una toma de un solo trozo se guarda con DriveApp; una más larga, con la subida reanudable de
   Drive (un pedido a internet por trozo, por uf_: cuenta en el cupo). Acciones: estudio, estudioSubir, estudioInvitar. */
var ESTUDIO_CAB_ = ['id', 'sesion', 'toma', 'intento', 'archivo', 'nombre', 'segundos', 'pico', 'rms', 'ruido', 'snr', 'semaforo', 'problemas', 'email', 'ts', 'hz'];
var ESTUDIO_TROZO_ = 4 * 1024 * 1024;
var ESTUDIO_MAX_ = 64 * 1024 * 1024;          // ~7 min de una toma: ninguna del guion se acerca
var ESTUDIO_TOMA_RE_ = /^S[1-9]-[A-Z0-9]{1,6}(-[0-9]{2})?$/;
var ESTUDIO_RAIZ_ = 'Voz oficial de Alma';

function estudioEmails_(ses) {
  if (!ses) return [];
  return [ses.email].concat(String(ses.email_alterno || '').split(/[\s,;]+/)).map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean);
}
function estudioInvitados_() {
  try { var l = JSON.parse(PropertiesService.getScriptProperties().getProperty('ESTUDIO_INVITADOS') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
/* { email, principal } o null: el principal con su sesión verificada, o alguien que él invitó (con su propia sesión). */
function estudioQuien_(ses) {
  if (!ses || !ses.email) return null;
  var adm = paraClaudePrincipalSes_(ses);
  if (adm) return { email: String(adm.email || ses.email).toLowerCase(), principal: true };
  var inv = estudioInvitados_(), cs = estudioEmails_(ses);
  for (var i = 0; i < cs.length; i++) if (inv.indexOf(cs[i]) >= 0) return { email: cs[i], principal: false };
  return null;
}
function estudioHoja_() {
  var sh = hojaCrear_('ALMA_ESTUDIO', ESTUDIO_CAB_);
  if (sh.getLastColumn() < ESTUDIO_CAB_.length) sh.getRange(1, 1, 1, ESTUDIO_CAB_.length).setValues([ESTUDIO_CAB_]);
  return sh;
}
/* La carpeta privada de una sesión (se crea una vez; sus ids quedan en ESTUDIO_CARPETAS). */
function estudioCarpeta_(n) {
  var p = PropertiesService.getScriptProperties(), ids = {};
  try { ids = JSON.parse(p.getProperty('ESTUDIO_CARPETAS') || '{}') || {}; } catch (e) { ids = {}; }
  var clave = 's' + n;
  if (ids[clave]) { try { return DriveApp.getFolderById(ids[clave]); } catch (e) {} }
  var raiz = null;
  if (ids.raiz) { try { raiz = DriveApp.getFolderById(ids.raiz); } catch (e) { raiz = null; } }
  if (!raiz) { raiz = DriveApp.createFolder(ESTUDIO_RAIZ_); ids.raiz = raiz.getId(); }
  var f = raiz.createFolder('Sesión ' + n); ids[clave] = f.getId();
  p.setProperty('ESTUDIO_CARPETAS', JSON.stringify(ids));
  return f;
}
function estudioFilas_() {
  var sh = estudioHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ESTUDIO_CAB_.length).getValues().map(function (r) { var o = {}; ESTUDIO_CAB_.forEach(function (k, j) { o[k] = r[j]; }); return o; });
}

/* Lo guardado por sesión (para retomar) y, para el principal, la lista de invitados. */
function estudioEstadoApi_(ses) {
  var q = estudioQuien_(ses); if (!q) return { ok: false, error: 'El Mini estudio es solo para el administrador principal y las personas que él invita.' };
  var tomas = estudioFilas_().map(function (f) {
    return { sesion: Number(f.sesion), toma: String(f.toma), intento: Number(f.intento) || 1, semaforo: String(f.semaforo || ''), segundos: Number(f.segundos) || 0, ts: String(f.ts || '') };
  });
  var r = { ok: true, principal: q.principal, tomas: tomas, trozo: ESTUDIO_TROZO_ };
  if (q.principal) r.invitados = estudioInvitados_();
  return r;
}

function estudioInvitarApi_(ses, b) {
  var q = estudioQuien_(ses); if (!q || !q.principal) return { ok: false, error: 'Solo el administrador principal invita.' };
  var email = String(b && b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Escribe un correo válido.' };
  var l = estudioInvitados_().filter(function (x) { return x !== email; });
  if (!(b && b.quitar)) l.push(email);
  PropertiesService.getScriptProperties().setProperty('ESTUDIO_INVITADOS', JSON.stringify(l.slice(-20)));
  return { ok: true, invitados: l.slice(-20) };
}

function estudioNum_(x, d) { var v = Number(x); return isFinite(v) ? Math.round(v * Math.pow(10, d || 1)) / Math.pow(10, d || 1) : ''; }

/* Un trozo de una toma: { sesion, toma, intento, n, total, bytes, data (base64), meta: { segundos, pico, rms, ruido, snr,
   semaforo, problemas, hz } }. Devuelve { ok, listo, archivo } al llegar el último. */
function estudioSubirApi_(ses, b) {
  var q = estudioQuien_(ses); if (!q) return { ok: false, error: 'El Mini estudio es solo para el administrador principal y las personas que él invita.' };
  b = b || {};
  var sesion = Number(b.sesion), toma = String(b.toma || ''), intento = Number(b.intento) || 1;
  var n = Number(b.n), total = Number(b.total), bytes = Number(b.bytes);
  if (!(sesion >= 1 && sesion <= 9) || !ESTUDIO_TOMA_RE_.test(toma) || toma.charAt(1) !== String(sesion)) return { ok: false, error: 'Toma no válida.' };
  if (!(intento >= 1 && intento <= 99) || !(total >= 1) || !(n >= 0 && n < total) || !(bytes > 44 && bytes <= ESTUDIO_MAX_)) return { ok: false, error: 'Trozo no válido.' };
  if (total !== Math.ceil(bytes / ESTUDIO_TROZO_)) return { ok: false, error: 'Trozo no válido.' };
  var datos; try { datos = Utilities.base64Decode(String(b.data || '').replace(/^data:[^,]*,/, '')); } catch (e) { return { ok: false, error: 'El trozo llegó dañado.' }; }
  var esperado = n < total - 1 ? ESTUDIO_TROZO_ : bytes - n * ESTUDIO_TROZO_;
  if (datos.length !== esperado) return { ok: false, error: 'El trozo llegó incompleto; se vuelve a mandar.' };
  var nombre = toma + '_t' + (intento < 10 ? '0' : '') + intento + '.wav', carpeta;
  try { carpeta = estudioCarpeta_(sesion); } catch (e) { console.error('estudioCarpeta_: ' + e); return { ok: false, error: 'No pude abrir la carpeta del Drive. Intenta de nuevo.' }; }
  var archivo = '';
  if (total === 1) {
    try { archivo = carpeta.createFile(Utilities.newBlob(datos, 'audio/wav', nombre)).getId(); }
    catch (e) { console.error('estudioSubir_ Drive: ' + e); return { ok: false, error: 'No pude guardarla en el Drive. Intenta de nuevo.' }; }
  } else {
    var cache = CacheService.getScriptCache(), clave = 'estudio_up_' + toma + '_' + intento, url = cache.get(clave);
    if (n === 0 || !url) {
      if (n !== 0) return { ok: false, error: 'Se perdió la subida; empieza de nuevo.', reiniciar: true };
      url = estudioReanudable_(nombre, carpeta.getId(), bytes);
      if (!url) return { ok: false, error: 'Drive no abrió la subida. Intenta de nuevo.' };
      cache.put(clave, url, 21600);
    }
    var desde = n * ESTUDIO_TROZO_, hasta = desde + datos.length - 1, r;
    try {
      r = uf_(url, { method: 'put', contentType: 'audio/wav', payload: datos, muteHttpExceptions: true, followRedirects: false,
        headers: { 'Content-Range': 'bytes ' + desde + '-' + hasta + '/' + bytes } });
    } catch (e) { console.error('estudioSubir_ trozo: ' + e); return { ok: false, error: 'No pude mandar el trozo a Drive. Intenta de nuevo.' }; }
    var cod = r.getResponseCode();
    if (cod === 308) return { ok: true, listo: false, siguiente: n + 1 };
    if (cod !== 200 && cod !== 201) { console.error('estudioSubir_ Drive ' + cod + ' ' + String(r.getContentText()).slice(0, 200)); return { ok: false, error: 'Drive no aceptó el trozo (' + cod + ').', reiniciar: cod === 404 || cod === 410 }; }
    try { archivo = JSON.parse(r.getContentText() || '{}').id || ''; } catch (e) { archivo = ''; }
    cache.remove(clave);
  }
  var m = b.meta || {};
  try { DriveApp.getFileById(archivo).setDescription('Voz oficial de Alma · sesión ' + sesion + ' · ' + toma + ' · intento ' + intento + ' · ' + String(m.semaforo || '') + ' · ' + new Date().toISOString()); } catch (e) {}
  var probs = (Array.isArray(m.problemas) ? m.problemas : []).map(function (x) { return String(x).slice(0, 20); }).join(' ');
  estudioHoja_().appendRow(['e' + Date.now().toString(36), sesion, toma, intento, archivo, nombre, estudioNum_(m.segundos, 2), estudioNum_(m.pico), estudioNum_(m.rms), estudioNum_(m.ruido),
    estudioNum_(m.snr), ['verde', 'amarillo', 'rojo'].indexOf(String(m.semaforo)) >= 0 ? String(m.semaforo) : '', probs.slice(0, 200), q.email, new Date().toISOString(), Number(m.hz) || '']);
  return { ok: true, listo: true, archivo: archivo };
}
/* Abre una subida reanudable de Drive (v3) dentro de la carpeta; devuelve su URL o ''. */
function estudioReanudable_(nombre, carpetaId, bytes) {
  try {
    var r = uf_('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
      payload: JSON.stringify({ name: nombre, parents: [carpetaId], mimeType: 'audio/wav' }),
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': 'audio/wav', 'X-Upload-Content-Length': String(bytes) } });
    if (r.getResponseCode() !== 200) { console.error('estudioReanudable_ ' + r.getResponseCode() + ' ' + String(r.getContentText()).slice(0, 200)); return ''; }
    var h = r.getHeaders() || {};
    return String(h.Location || h.location || '');
  } catch (e) { console.error('estudioReanudable_: ' + e); return ''; }
}
