/* ═══ EL CEREBRO DE ALMA · MÁS FUENTES (issue #291 · T5) ════════════════════════════════════════════════════════
   Tres fuentes nuevas, todas INTERNAS salvo lo que Juan marque distinto en Drive. Usan las mismas piezas de cerebro.js:
   se leen, se etiquetan, se cortan (cerCortar_) y entran en la misma sincronización por huella de cada 15 minutos.
     · Conversaciones: con huéspedes (ALMA_LOG: la pregunta del huésped, lo que respondió Alma y la corrección del
       equipo; una conversación por reserva) y con Alma (ALMA_OPERATIVO: una conversación = mensajes seguidos, como en
       Áreas). Las de los últimos CER_CONV_DIAS días (90 por defecto), también las que ya pasaron al archivo (memoria
       larga). Antes de indexar se QUITAN: números de DPI, pasaporte y tarjetas, códigos de acceso, claves y contraseñas
       (cerLimpiarSensible_). Siempre internas: principal y equipo. Lo que Juan habla con Alma de su vida personal queda
       solo para él (audiencia principal), salvo lo que Áreas puso en Propósito (el trabajo).
     · Correos: la bandeja (ALMA_CORREO_BANDEJA). Ahí solo hay remitente, asunto y fragmento, no el cuerpo. Un hilo = un
       documento, con su proyecto y su categoría en la ruta. Los de códigos, verificación, autorización, promociones y
       spam no entran. Internos.
     · Drive: solo las carpetas que Juan pone en ALMA_CEREBRO_FUENTES (desde Conexiones). Google Docs, Sheets (la tabla
       entera), texto, PDF y Word (convertidos con la exportación de Google Docs, con el mismo permiso de Drive que ya
       tiene el Hub). Lo que parezca un documento de identidad o un contrato con datos personales va a cuarentena con su
       motivo y nunca entra. La audiencia sale de la fila; si dice externo, lo que parezca un código o una clave se pasa
       a interno. */

var CER_FUENTES_CAB_ = ['tipo', 'id_carpeta', 'nombre', 'area', 'audiencia', 'activa'];
var CER_CONV_DIAS_ = 90;              // ventana por defecto (Propiedad del script CER_CONV_DIAS para sumar lo más viejo)
var CER_CONV_FILAS_ = 6000;           // filas recientes que se leen de cada hoja (lo nuevo está al final)
var CER_CORREO_FUERA_ = ['codigo', 'verificacion', 'autorizacion', 'promocion', 'spam'];
var CER_DRIVE_MAX_ = 800;             // archivos por pasada (entre todas las carpetas)
var CER_DRIVE_MB_ = 10;               // los archivos más grandes no se leen
var CER_DRIVE_TEXTO_ = ['text/plain', 'text/markdown', 'text/csv', 'text/x-markdown'];
var CER_DRIVE_DOC_ = 'application/vnd.google-apps.document', CER_DRIVE_HOJA_ = 'application/vnd.google-apps.spreadsheet';
var CER_DRIVE_CONVERTIR_ = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
/* Nombres de archivo o carpeta que sugieren identidad o contrato con datos personales: no entran (cuarentena). */
var CER_IDENTIDAD_RE_ = /(^|[^a-z])(dpi|cui|pasaportes?|passports?|identificacion(es)?|cedulas?|contratos?|nit|licencias? de conducir|documentos? de identidad|id card)([^a-z]|$)/;
var CER_AUD_FILA_ = { principal: ['principal'], equipo: ['principal', 'equipo'], asociado: ['principal', 'equipo', 'asociado'], externo: ['principal', 'equipo', 'asociado', 'externo'] };

/* ══ Limpieza de datos sensibles (conversaciones y correos) ══════════════════════════════════════════════════════ */

/* Las claves que el Hub conoce (WiFi, cerraduras, cajas): se buscan tal cual en el texto. */
function cerSecretosConocidos_(ctx) {
  var out = {};
  Object.keys((ctx && ctx.fichas) || {}).forEach(function (k) {
    var j = null; try { j = JSON.parse(String(ctx.fichas[k].info_json || '')); } catch (e) {}
    (function mirar(o, hondo) {
      if (!o || typeof o !== 'object' || hondo > 3) return;
      Object.keys(o).forEach(function (c) {
        var v = o[c];
        if (v && typeof v === 'object') return mirar(v, hondo + 1);
        v = String(v == null ? '' : v).trim();
        if (v.length >= 4 && v.length <= 40 && (/pass|clave|pin/i.test(c) || (/code|codigo|lock|door|puerta|caja|key/i.test(c) && /\d/.test(v)))) out[v] = 1;
      });
    })(j, 0);
  });
  return Object.keys(out).sort(function (a, b) { return b.length - a.length; });
}
/* Quita del texto lo que nunca debe entrar al cerebro: números de documento (DPI, pasaporte, cédula), tarjetas,
   códigos de acceso, claves y contraseñas. Lo reemplaza por [documento], [tarjeta] o [clave]. */
function cerLimpiarSensible_(texto, secretos) {
  var t = String(texto || '');
  (secretos || []).forEach(function (s) { if (s && s.length >= 4) t = t.split(s).join('[clave]'); });
  t = t.replace(/\b\d{4}[\s-]?\d{5}[\s-]?\d{4}\b/g, '[documento]');                                    // DPI / CUI (13 cifras)
  t = t.replace(/\b\d(?:[ -]?\d){12,18}\b/g, '[tarjeta]');                                              // tarjetas (13 a 19 cifras)
  t = t.replace(/\b(dpi|cui|pasaporte|passport|c[eé]dula|nit|documento(?: de identidad)?|n[uú]mero de documento)(\s*(?:n[uú]mero|no\.?|num\.?|#)?\s*(?:es|is|:|#)?\s*)([A-Z]{0,3}[-\s]?\d[\dA-Z-]{3,15})/gi, '$1$2[documento]');
  /* después de «código», «clave», «contraseña», «password», «PIN», «WiFi»… (hasta el final de la frase): lo que lleve
     números o venga justo después de «:», «es» o «is» */
  t = t.replace(/\b(c[oó]digos?|codes?|claves?|contrase[nñ]as?|passwords?|passcodes?|pass|pin|wi-?fi|red)\b([^.\n!?]{0,60})/gi, function (m, clave, resto) {
    resto = resto.replace(/((?:\s(?:es|is|son|será|sera)\s|[:=]\s*))(["«']?)([^\s,;"»']{3,})/i, '$1$2[clave]');
    resto = resto.replace(/[^\s,;:"«»'()]*\d[^\s,;:"«»'()]*/g, function (w) { return w === '[clave]' || w.length < 4 ? w : '[clave]'; });
    return clave + resto;
  });
  return t;
}

/* ══ Conversaciones ══════════════════════════════════════════════════════════════════════════════════════════════ */

function cerConvDias_() {
  var n = Number(PropertiesService.getScriptProperties().getProperty('CER_CONV_DIAS')) || CER_CONV_DIAS_;
  return Math.max(7, Math.min(730, Math.round(n)));
}
/* Las últimas filas de una hoja (el encabezado y hasta `max` filas del final), como objetos. */
function cerFilasRecientes_(sh, max) {
  if (!sh || sh.getLastRow() < 2) return [];
  var n = sh.getLastRow(), nc = sh.getLastColumn(), cab = sh.getRange(1, 1, 1, nc).getValues()[0].map(function (x) { return String(x).trim().toLowerCase(); });
  var desde = Math.max(2, n - max + 1);
  return sh.getRange(desde, 1, n - desde + 1, nc).getValues().map(function (r) { var o = {}; cab.forEach(function (k, i) { o[k] = r[i]; }); return o; });
}
/* La hoja viva y la del archivo (memoria larga, archivo.js), juntas. */
function cerFilasConArchivo_(tab) {
  var filas = []; try { filas = cerFilasRecientes_(ssAlma_().getSheetByName(tab), CER_CONV_FILAS_); } catch (e) { console.error('cerebro · ' + tab + ': ' + e); throw e; }
  var id = PropertiesService.getScriptProperties().getProperty('ALMA_ARCHIVO_ID');
  if (id) { try { filas = cerFilasRecientes_(SpreadsheetApp.openById(id).getSheetByName(tab), CER_CONV_FILAS_).concat(filas); } catch (e) { console.error('cerebro · archivo ' + tab + ': ' + e); } }
  return filas;
}
function cerMs_(v) { try { return archivoFecha_(v); } catch (e) { var t = new Date(v).getTime(); return isNaN(t) ? 0 : t; } }
function cerDia_(ms) { return Utilities.formatDate(new Date(ms), (typeof CFG !== 'undefined' && CFG.TZ) || 'America/Guatemala', 'yyyy-MM-dd'); }
function cerPropiedadDe_(texto, ctx) {
  var n = cerNorm_(texto); if (!n) return '';
  return ctx.nombres.filter(function (x) { return cerNorm_(x) === n; })[0] || ctx.nombres.filter(function (x) { return n.indexOf(cerNorm_(x)) >= 0 || cerNorm_(x).indexOf(n) >= 0; })[0] || '';
}

/* Con huéspedes: ALMA_LOG agrupado por reserva. */
function cerConvHuespedes_(ctx, desde) {
  var grupos = {};
  cerFilasConArchivo_(CFG.TAB_LOG).forEach(function (r) {
    var ms = cerMs_(r.fecha); if (!ms || ms < desde) return;
    if (!String(r.pregunta || '').trim() && !String(r.respuesta || '').trim()) return;
    var cod = String(r.codigo || r.reservation_id || '').trim(), clave = cod || ('sin-reserva-' + cerDia_(ms) + '-' + cerNorm_(r.huesped || r.propiedad || 'x').slice(0, 20));
    var g = grupos[clave] = grupos[clave] || { clave: clave, codigo: cod, huesped: '', propiedad: '', msgs: [] };
    if (r.huesped) g.huesped = String(r.huesped).trim();
    if (r.propiedad) g.propiedad = String(r.propiedad).trim();
    g.msgs.push({ ms: ms, pregunta: String(r.pregunta || ''), respuesta: String(r.respuesta || ''), modo: String(r.modo || ''), corregida: String(r.corregida || '') });
  });
  return Object.keys(grupos).map(function (k) {
    var g = grupos[k]; g.msgs.sort(function (a, b) { return a.ms - b.ms; });
    return { id: 'conversacion:huesped:' + k.replace(/[^\w.-]/g, '_').slice(0, 80), fuente: 'conversacion', ref: k, tipo: 'huesped', datos: g, fecha: g.msgs[g.msgs.length - 1].ms };
  });
}
/* Con Alma: ALMA_OPERATIVO por persona; una pausa de más de 45 min empieza otra conversación (como Áreas). */
function cerConvAlma_(ctx, desde) {
  var porUsuario = {}, out = [];
  cerFilasConArchivo_('ALMA_OPERATIVO').forEach(function (r) {
    var ms = cerMs_(r.ts), u = String(r.usuario || '').toLowerCase(); if (!ms || ms < desde || !u || !String(r.texto || '').trim()) return;
    (porUsuario[u] = porUsuario[u] || []).push({ ms: ms, de: String(r.de || ''), texto: String(r.texto), id: String(r.id || ''), nombre: String(r.nombre || '') });
  });
  var areas = {}; try { areas = areasFilas_(); } catch (e) {}
  var admins = []; try { admins = adminsOp_(); } catch (e) {}
  Object.keys(porUsuario).forEach(function (u) {
    var L = porUsuario[u].sort(function (a, b) { return a.ms - b.ms; }), cur = null;
    var adm = admins.filter(function (a) { return a.email === u; })[0] || null;
    L.forEach(function (m) {
      if (!cur || m.ms - cur.fin > 45 * 60000) { cur = { id: m.id || String(m.ms), ini: m.ms, fin: m.ms, usuario: u, nombre: m.nombre || u, msgs: [] }; out.push(cur); }
      cur.fin = m.ms; cur.msgs.push(m);
    });
    out.filter(function (c) { return c.usuario === u; }).forEach(function (c) {
      var f = areas['alma:' + c.id] || null;
      c.titulo = f && f.titulo ? String(f.titulo) : '';
      /* Quién la puede ver: lo de alguien del equipo es trabajo (interno); lo de Juan (o de quien no es del equipo) solo él,
         salvo lo que Áreas puso en Propósito (su trabajo). Ante la duda, solo Juan. */
      c.audiencia = adm && !adm.principal ? CER_INTERNO_ : f && String(f.area) === 'proposito' && !f.cajon ? CER_INTERNO_ : ['principal'];
    });
  });
  return out.filter(function (c) { return c.msgs.some(function (m) { return m.de === 'yo'; }); }).map(function (c) {
    return { id: 'conversacion:alma:' + c.id.replace(/[^\w.-]/g, '_').slice(0, 80), fuente: 'conversacion', ref: c.id, tipo: 'alma', datos: c, fecha: c.fin };
  });
}
function cerConvCatalogo_(ctx) {
  var desde = Date.now() - cerConvDias_() * 86400000;
  return cerConvHuespedes_(ctx, desde).concat(cerConvAlma_(ctx, desde));
}
/* Una conversación como documento: un título por día y un párrafo por mensaje, ya limpios. */
function cerDocConversacion_(d, ctx) {
  var g = d.datos, sec = ctx.secretos || (ctx.secretos = cerSecretosConocidos_(ctx)), lineas = [], dia = '', quitados = 0;
  var poner = function (ms, quien, texto) {
    texto = String(texto || '').replace(/\s+\n/g, '\n').trim(); if (!texto) return;
    var limpio = cerLimpiarSensible_(texto, sec);
    if (cerTieneIdentidad_(limpio)) { quitados++; return; }   // si aún se ve un documento: el mensaje no entra
    var dd = cerDia_(ms); if (dd !== dia) { dia = dd; lineas.push('\n## ' + dd); }
    lineas.push(quien + ': ' + limpio.replace(/\n{2,}/g, '\n'), '');
  };
  var raiz, titulo, propiedad = '', area, audiencia;
  if (d.tipo === 'huesped') {
    propiedad = cerPropiedadDe_(g.propiedad, ctx);
    raiz = 'Conversación con ' + (String(g.huesped || '').split(/\s+/)[0] || 'un huésped') + (g.propiedad ? ' · ' + g.propiedad : '') + (g.codigo ? ' · ' + g.codigo : '');
    g.msgs.forEach(function (m) {
      poner(m.ms, 'Huésped', m.pregunta);
      poner(m.ms, /AUTO/i.test(m.modo) ? 'Alma' : /BORRADOR/i.test(m.modo) ? 'Alma (borrador)' : 'Alma (no se envió)', m.respuesta);
      poner(m.ms, 'Corrección del equipo', m.corregida && !/^(s[ií]|no|true|false|1|0)$/i.test(m.corregida.trim()) ? m.corregida : '');
    });
    area = 'huespedes'; audiencia = CER_INTERNO_;
  } else {
    raiz = 'Conversación con Alma · ' + String(g.nombre || '').split(/[\s@]/)[0] + (g.titulo ? ' · ' + g.titulo : '');   // la fecha va en los títulos de cada día
    g.msgs.forEach(function (m) { poner(m.ms, m.de === 'yo' ? String(g.nombre || '').split(/[\s@]/)[0] || 'Persona' : 'Alma', m.texto); });
    area = 'alma'; audiencia = g.audiencia;
  }
  titulo = raiz;
  if (!lineas.length) return { titulo: titulo, hash: cerHash_('vacia:' + d.id), cuarentena: 'La conversación quedó vacía al quitar los datos sensibles.' };
  var md = '# ' + raiz + '\n' + lineas.join('\n');
  return { titulo: titulo, hash: cerHash_(CER_VERSION_CORTE_ + ':' + JSON.stringify(audiencia) + '\n' + md), quitados: quitados,
    pedazos: cerCortar_(md, raiz).map(function (p) { return Object.assign(p, { fuente: 'conversacion', area: area, propiedad: propiedad, audiencia: audiencia }); }) };
}

/* ══ Correos ═════════════════════════════════════════════════════════════════════════════════════════════════════ */

function cerCorreoCatalogo_(ctx) {
  var desde = Date.now() - cerConvDias_() * 86400000, hilos = {};
  var sh = ssAlma_().getSheetByName('ALMA_CORREO_BANDEJA'); if (!sh) return [];
  cerFilasRecientes_(sh, CER_CONV_FILAS_).forEach(function (r) {
    var ms = cerMs_(r.fecha || r.recibido); if (!ms || ms < desde) return;
    var cat = String(r.categoria || 'normal').toLowerCase(), est = String(r.estado || '').toLowerCase();
    if (CER_CORREO_FUERA_.indexOf(cat) >= 0 || /^(s[ií]|true|1)$/i.test(String(r.spam || '')) || est === 'spam' || est === 'desuscrito') return;
    if (!String(r.asunto || r.fragmento || '').trim()) return;
    var k = String(r.cuenta || '') + ':' + String(r.hilo || r.id || '');
    var h = hilos[k] = hilos[k] || { clave: k, cuenta: String(r.cuenta || ''), proyecto: '', categoria: cat, asunto: '', msgs: [] };
    if (r.proyecto) h.proyecto = String(r.proyecto);
    if (!h.asunto) h.asunto = String(r.asunto || '');
    h.msgs.push({ ms: ms, de: String(r.de || ''), de_nombre: String(r.de_nombre || ''), asunto: String(r.asunto || ''), fragmento: String(r.fragmento || '') });
  });
  return Object.keys(hilos).map(function (k) {
    var h = hilos[k]; h.msgs.sort(function (a, b) { return a.ms - b.ms; });
    return { id: 'correo:' + k.replace(/[^\w.@:-]/g, '_').slice(0, 120), fuente: 'correo', ref: k, datos: h, fecha: h.msgs[h.msgs.length - 1].ms };
  });
}
function cerDocCorreo_(d, ctx) {
  var h = d.datos, sec = ctx.secretos || (ctx.secretos = cerSecretosConocidos_(ctx));
  var raiz = 'Correo · ' + (h.proyecto || h.cuenta.split('@')[0] || 'bandeja') + ' · ' + h.categoria;
  var asunto = cerLimpiarSensible_(String(h.asunto || '(sin asunto)').replace(/^\s*(re|rv|fw|fwd)\s*:\s*/i, ''), sec).slice(0, 140);
  var cuerpo = h.msgs.map(function (m) {
    return cerDia_(m.ms) + ' · ' + (m.de_nombre ? m.de_nombre + ' <' + m.de + '>' : m.de) + '\nAsunto: ' + cerLimpiarSensible_(m.asunto, sec) + '\n' + cerLimpiarSensible_(m.fragmento, sec);
  }).join('\n\n');
  var md = '# ' + raiz + '\n\n## ' + asunto + '\n' + cuerpo;
  return { titulo: raiz + ' › ' + asunto, hash: cerHash_(CER_VERSION_CORTE_ + '\n' + md),
    pedazos: cerCortar_(md, raiz).map(function (p) { return Object.assign(p, { fuente: 'correo', area: 'correos', propiedad: '', audiencia: CER_INTERNO_ }); }) };
}

/* ══ Drive: las carpetas que eligió Juan ═════════════════════════════════════════════════════════════════════════ */

function cerHojaFuentes_() { return hojaCrear_('ALMA_CEREBRO_FUENTES', CER_FUENTES_CAB_); }
function cerFuentesFilas_() {
  var sh = cerHojaFuentes_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, CER_FUENTES_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: i + 2 }; CER_FUENTES_CAB_.forEach(function (k, j) { o[k] = String(v[j] == null ? '' : v[j]).trim(); }); return o;
  }).filter(function (o) { return o.id_carpeta; });
}
function cerFilaActiva_(f) { return String(f.tipo || 'drive').toLowerCase() === 'drive' && !/^(no|false|0|inactiva)$/i.test(f.activa || 'sí'); }
/* El id de una carpeta desde su enlace de Drive (o el id solo). */
function cerIdCarpeta_(enlace) {
  var s = String(enlace || '').trim(), m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{10,})$/);
  return m ? m[1] : '';
}
function cerPareceIdentidad_(nombre) { return CER_IDENTIDAD_RE_.test(String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')); }

/* Recorre las carpetas activas y sus subcarpetas. Lista corta en caché 30 min por carpeta (no se lista cada 15 min). */
function cerDriveCatalogo_(ctx, t0) {
  var docs = [], vistos = {}, completo = true, cache = CacheService.getScriptCache();
  cerFuentesFilas_().filter(cerFilaActiva_).forEach(function (fila) {
    var ck = 'cer_drv_' + fila.id_carpeta, cv = null; try { cv = cache.get(ck); } catch (e) {}
    var lista = null; try { lista = cv ? JSON.parse(cv) : null; } catch (e) {}
    if (!lista) {
      lista = []; var raiz; try { raiz = DriveApp.getFolderById(fila.id_carpeta); } catch (e) { console.error('cerebro · carpeta ' + fila.id_carpeta + ': ' + e); completo = false; return; }
      var cola = [{ f: raiz, camino: [] }], corto = false;
      while (cola.length) {
        if (docs.length + lista.length >= CER_DRIVE_MAX_ || Date.now() - t0 > 60000) { corto = true; break; }
        var x = cola.shift();
        var fs = x.f.getFiles();
        while (fs.hasNext()) {
          if (docs.length + lista.length >= CER_DRIVE_MAX_) { corto = true; break; }
          var a = fs.next(), mt = String(a.getMimeType() || '');
          if (mt !== CER_DRIVE_DOC_ && mt !== CER_DRIVE_HOJA_ && CER_DRIVE_TEXTO_.indexOf(mt) < 0 && CER_DRIVE_CONVERTIR_.indexOf(mt) < 0) continue;
          lista.push({ i: a.getId(), n: a.getName(), m: mt, u: a.getLastUpdated().getTime(), s: Number(a.getSize() || 0), c: x.camino });
        }
        if (x.camino.length < 6) { var sub = x.f.getFolders(); while (sub.hasNext()) { var sf = sub.next(); cola.push({ f: sf, camino: x.camino.concat([sf.getName()]) }); } }
      }
      if (corto) completo = false;
      else { try { var js = JSON.stringify(lista); if (js.length < 90000) cache.put(ck, js, 1800); } catch (e) {} }
    }
    lista.forEach(function (a) {
      if (vistos[a.i]) return; vistos[a.i] = 1;   // un archivo en dos carpetas: cuenta la primera
      docs.push({ id: 'drive:' + a.i, fuente: 'drive', ref: a.i, datos: { archivo: a, fila: { id_carpeta: fila.id_carpeta, nombre: fila.nombre, area: fila.area, audiencia: fila.audiencia } } });
    });
  });
  return { docs: docs, completo: completo };
}

/* Drive por REST con el permiso que el Hub ya tiene (DriveApp): exportar un Doc y convertir PDF/Word en un Doc temporal. */
function cerDriveApi_(metodo, ruta, cuerpo) {
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  return uf_('https://www.googleapis.com/drive/v3/files/' + ruta, o, 'Cerebro');
}
function cerDriveExportar_(id) {
  var r = cerDriveApi_('get', encodeURIComponent(id) + '/export?mimeType=' + encodeURIComponent('text/markdown'));
  if (r.getResponseCode() !== 200) r = cerDriveApi_('get', encodeURIComponent(id) + '/export?mimeType=' + encodeURIComponent('text/plain'));
  if (r.getResponseCode() !== 200) throw new Error('Drive export ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 150));
  return r.getContentText();
}
function cerDriveConvertir_(id) {
  var c = cerDriveApi_('post', encodeURIComponent(id) + '/copy?fields=id', { mimeType: CER_DRIVE_DOC_, name: 'cerebro · temporal (se borra solo)' });
  if (c.getResponseCode() >= 300) throw new Error('Drive convertir ' + c.getResponseCode() + ': ' + String(c.getContentText()).slice(0, 150));
  var tmp = JSON.parse(c.getContentText()).id;
  try { return cerDriveExportar_(tmp); }
  finally { try { cerDriveApi_('delete', encodeURIComponent(tmp)); } catch (e) { console.error('cerebro · borrar temporal: ' + e); } }
}
function cerCelda_(v) { return String(v == null ? '' : v).replace(/\|/g, '/').replace(/\s+/g, ' ').trim().slice(0, 200); }
function cerHojaMd_(id) {
  return SpreadsheetApp.openById(id).getSheets().map(function (sh) {
    var n = Math.min(sh.getLastRow(), 150), m = Math.min(sh.getLastColumn(), 26); if (n < 1 || m < 1) return '';
    var v = sh.getRange(1, 1, n, m).getDisplayValues().filter(function (r) { return r.some(function (x) { return String(x).trim(); }); }); if (!v.length) return '';
    var fila = function (r) { return '| ' + r.map(cerCelda_).join(' | ') + ' |'; };
    return '## ' + sh.getName() + '\n' + [fila(v[0]), '|' + v[0].map(function () { return ' --- '; }).join('|') + '|'].concat(v.slice(1).map(fila)).join('\n') + (sh.getLastRow() > 150 ? '\n\n(Solo las primeras 150 filas.)' : '');
  }).filter(Boolean).join('\n\n');
}
/* Lo que se ve como un número de DPI o de pasaporte dentro del texto. */
function cerTieneIdentidad_(texto) {
  var t = String(texto || '');
  if (/\b\d{4}[\s-]?\d{5}[\s-]?\d{4}\b/.test(t)) return 'un número con forma de DPI (13 cifras)';
  if (/(pasaporte|passport)[^\n]{0,40}?\b[A-Z]{0,3}\d{6,9}\b/i.test(t)) return 'un número de pasaporte';
  return '';
}
function cerDocDrive_(d, ctx, hashPrevio) {
  var a = d.datos.archivo, fila = d.datos.fila, camino = ['Drive · ' + (fila.nombre || 'carpeta')].concat(a.c || []);
  var aud = String(fila.audiencia || 'equipo').toLowerCase().trim(), area = String(fila.area || '').toLowerCase().trim();
  var hash = cerHash_([CER_VERSION_CORTE_, a.i, a.u, aud, area, camino.join('/'), a.n].join(':'));   // si no cambió, ni se abre
  var titulo = camino.concat([a.n]).join(' › ');
  if (hash === hashPrevio) return { hash: hash };
  if (cerPareceIdentidad_(a.n) || (a.c || []).some(cerPareceIdentidad_)) return { hash: hash, titulo: titulo, cuarentena: 'Parece un documento de identidad o un contrato con datos personales (por su nombre o su carpeta): no entra al cerebro.' };
  if (!CER_AUD_FILA_[aud]) return { hash: hash, titulo: titulo, cuarentena: 'La carpeta tiene una audiencia no aprobada («' + aud + '»): usa principal, equipo, asociado o externo.' };
  /* lo que ya se revisó y quedó en cuarentena no se vuelve a abrir mientras no cambie */
  var cache = CacheService.getScriptCache(), cq = null; try { cq = cache.get('cer_cq_' + a.i); } catch (e) {}
  if (cq && cq.indexOf(hash + '|') === 0) return { hash: hash, titulo: titulo, cuarentena: cq.slice(hash.length + 1) };
  var cuar = function (m) { try { cache.put('cer_cq_' + a.i, hash + '|' + m, 21600); } catch (e) {} return { hash: hash, titulo: titulo, cuarentena: m }; };
  if (a.s > CER_DRIVE_MB_ * 1048576) return cuar('El archivo pesa más de ' + CER_DRIVE_MB_ + ' MB: no se lee.');
  var texto = '';
  try {
    if (a.m === CER_DRIVE_DOC_) texto = cerDriveExportar_(a.i);
    else if (a.m === CER_DRIVE_HOJA_) texto = cerHojaMd_(a.i);
    else if (CER_DRIVE_CONVERTIR_.indexOf(a.m) >= 0) texto = cerDriveConvertir_(a.i);
    else texto = DriveApp.getFileById(a.i).getBlob().getDataAsString('UTF-8');
  } catch (e) { return cuar('No pude leer el archivo: ' + String(e.message || e).slice(0, 160)); }
  var ident = cerTieneIdentidad_(texto);
  if (ident) return cuar('Tiene ' + ident + ': parece un documento con datos personales y no entra al cerebro.');
  texto = String(texto || '').replace(/\r/g, '').trim();
  if (!texto) return cuar('El archivo está vacío o no tiene texto.');
  var raiz = titulo, md = '# ' + raiz + '\n\n' + texto;   // los títulos del archivo quedan debajo de su ruta
  var audiencia = CER_AUD_FILA_[aud], sec = ctx.secretos || (ctx.secretos = cerSecretosConocidos_(ctx));
  /* Para externos o asociados igual pasa el filtro de códigos y claves: lo que lo parezca se queda interno. */
  var pedazos = cerCortar_(md, raiz).map(function (p) {
    var abierto = audiencia.indexOf('asociado') >= 0 && cerPareceSecreto_(p.texto, sec);
    return Object.assign(p, { fuente: 'drive', area: area, propiedad: '', audiencia: abierto ? CER_INTERNO_ : audiencia });
  });
  return { hash: hash, titulo: titulo, pedazos: pedazos, secretos: sec };
}

/* ══ Conexiones: agregar o quitar una carpeta (solo el administrador principal, desde conexiones_) ═══════════════ */
function cerFuenteAgregar_(o) {
  o = o || {};
  var id = cerIdCarpeta_(o.enlace); if (!id) return { ok: false, error: 'Pega el enlace de la carpeta de Drive (drive.google.com/drive/folders/…).' };
  var area = String(o.area || '').toLowerCase().trim(), aud = String(o.audiencia || 'equipo').toLowerCase().trim();
  if (CER_AREAS_TRABAJO_.indexOf(area) < 0) return { ok: false, error: 'Elige el área de la carpeta.' };
  if (!CER_AUD_FILA_[aud]) return { ok: false, error: 'Elige quién la puede ver.' };
  var carpeta = null; try { carpeta = DriveApp.getFolderById(id); carpeta.getName(); } catch (e) { carpeta = null; }
  if (!carpeta) return { ok: false, error: 'El Hub no puede abrir esa carpeta. Revisa el enlace o compártela con la cuenta del Hub.' };
  var nombre = String(carpeta.getName() || '').slice(0, 120);
  if (cerPareceIdentidad_(nombre)) return { ok: false, error: '«' + nombre + '» parece una carpeta de contratos o documentos de identidad: no entra al cerebro.' };
  var sh = cerHojaFuentes_(), ya = cerFuentesFilas_().filter(function (f) { return f.id_carpeta === id; })[0];
  var fila = ['drive', id, nombre, area, aud, 'sí'];
  if (ya) sh.getRange(ya.fila, 1, 1, fila.length).setValues([fila]); else sh.appendRow(fila);
  try { CacheService.getScriptCache().remove('cer_drv_' + id); } catch (e) {}
  return { ok: true, nombre: nombre, id: id };
}
function cerFuenteQuitar_(id) {
  id = String(id || '').trim(); if (!id) return { ok: false, error: 'Falta la carpeta.' };
  var f = cerFuentesFilas_().filter(function (x) { return x.id_carpeta === id; })[0]; if (!f) return { ok: true };
  cerHojaFuentes_().deleteRow(f.fila);   // sus pedazos salen en la próxima pasada (ya no está en el catálogo)
  try { CacheService.getScriptCache().remove('cer_drv_' + id); } catch (e) {}
  return { ok: true, nombre: f.nombre };
}
function cerFuentesLista_() {
  try { return cerFuentesFilas_().map(function (f) { return { id: f.id_carpeta, nombre: f.nombre, area: f.area, audiencia: f.audiencia, activa: cerFilaActiva_(f) }; }); } catch (e) { return []; }
}
