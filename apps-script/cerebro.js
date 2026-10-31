/* ═══ EL CEREBRO DE ALMA (issue #291 · T1–T6) ═══════════════════════════════════════════════════════════════════
   Un índice común para que Alma encuentre rápido y con prueba. Cada fuente se lee, se etiqueta, se corta en pedazos
   y se guarda en BigQuery (alma_cerebro.pedazos) con su huella de significado (embeddings de Vertex AI, con la misma cuenta de servicio). Alma busca por
   significado y por palabras exactas a la vez, se queda con los 8 mejores y responde citando de dónde lo sacó.
     · La regla del tribunal: sin prueba no hay respuesta. Si no hay pedazos con puntaje suficiente, Alma lo dice y la
       pregunta queda en Pendientes para el responsable (o, con un huésped, «lo confirmo con el equipo»).
     · Quién puede ver qué lo decide el CÓDIGO (la columna audiencia, filtrada dentro del SQL), nunca la IA: la
       audiencia sale de quién habla (audienciaDe_), no de lo que diga el modelo.
     · Fuentes, en orden: propiedades (ficha + memoria) y playbooks; después (T5, cerebro_fuentes.js) conversaciones,
       correos y las carpetas de Drive que Juan elige. La prueba semanal (T6) vive en cerebro_prueba.js.

   PERMISOS: BigQuery se usa por REST con una CUENTA DE SERVICIO (JWT firmado aquí con Utilities), no con el servicio
   avanzado. Así appsscript.json no cambia, no hay permisos nuevos que Juan tenga que autorizar y la web app no se cae.
   Propiedades del script (ver Código.js): BQ_PROYECTO (id del proyecto de Google Cloud), BQ_CUENTA (la llave JSON de la
   cuenta de servicio, completa), BQ_UBICACION (opcional, US por defecto) y CER_VERTEX_REGION (opcional,
   us-central1). Las huellas salen de Vertex AI con esa misma cuenta (rol «Usuario de Vertex AI»): ninguna llave más.
   Si falta BQ_PROYECTO o BQ_CUENTA, el cerebro se apaga en silencio: Alma sigue con sus herramientas de siempre.

   Sincronización: el activador cerebroSincronizar (cada 15 min; se instala solo desde aprender()). Por cada documento
   compara su huella (hash): si cambió, PRIMERO entra lo nuevo (un load job) y DESPUÉS sale lo viejo (DELETE por
   doc_id y versión). Lo que no encaja en las listas aprobadas va a la hoja ALMA_CEREBRO_CUARENTENA con el motivo. */

var CER_DATASET_ = 'alma_cerebro', CER_TABLA_ = 'pedazos';
var CER_DIM_ = 768;                 // tamaño de la huella (gemini-embedding-001 la recorta y aquí se normaliza)
var CER_VERSION_CORTE_ = 'c1';      // si cambia el corte, las etiquetas o la huella: súbelo y todo se vuelve a indexar
var CER_VERSION_ESQUEMA_ = 'e1';
var CER_MAX_ = 2000, CER_MIN_ = 350;   // ≈500 tokens por pedazo; los de menos de CER_MIN_ se unen al vecino
var CER_PLAZO_MS_ = 240000;            // una tanda deja margen al límite de 6 min de Apps Script
var CER_REPO_ = 'jforce15-coder/Hub-Spacioam';
var CER_INSTRUCCION_ = 'Responde solo con esto y di de dónde lo sacaste; si no está, dilo.';

/* Listas aprobadas. Lo que no encaja aquí no se adivina: va a cuarentena. */
var CER_FUENTES_ = ['propiedad', 'playbook', 'conversacion', 'correo', 'drive'];
var CER_AUDIENCIAS_ = ['principal', 'equipo', 'asociado', 'externo'];   // las de audiencia.js
var CER_INTERNO_ = ['principal', 'equipo'];
var CER_PUBLICO_ = ['principal', 'equipo', 'asociado', 'externo'];
var CER_AREAS_TRABAJO_ = ['operaciones', 'huespedes', 'finanzas', 'crecimiento', 'marketing', 'mantenimiento', 'desarrollo', 'archivo', 'correos', 'mejora', 'alma', 'negocio'];
var CER_AREA_PLAYBOOK_ = { operaciones: 'operaciones', huespedes: 'huespedes', finanzas: 'finanzas', crecimiento: 'crecimiento', marketing: 'marketing',
  mantenimiento: 'mantenimiento', desarrollo: 'desarrollo', archivo: 'archivo', correos: 'correos', mejora: 'mejora', 'mejora-llamadas': 'mejora', alma: 'alma',
  hub: 'desarrollo', api: 'desarrollo', 'app-alma': 'desarrollo', hola: 'desarrollo', epi: 'desarrollo', grow: 'desarrollo', mi: 'desarrollo', docs: 'desarrollo', readme: 'desarrollo' };
var CER_AREA_NOMBRE_ = { operaciones: 'Operaciones', huespedes: 'Huéspedes', finanzas: 'Finanzas', crecimiento: 'Crecimiento', marketing: 'Marketing', mantenimiento: 'Mantenimiento',
  desarrollo: 'Desarrollo', archivo: 'Archivo', correos: 'Correos', mejora: 'Mejora continua', alma: 'Alma', negocio: 'Negocio' };
var CER_CUAR_CAB_ = ['fecha', 'doc_id', 'fuente', 'titulo', 'motivo'];
var CER_ESQUEMA_ = [
  { name: 'id', type: 'STRING', mode: 'REQUIRED' }, { name: 'doc_id', type: 'STRING' }, { name: 'fuente', type: 'STRING' },
  { name: 'titulo', type: 'STRING' }, { name: 'ruta', type: 'STRING' }, { name: 'texto', type: 'STRING' },
  { name: 'propiedad', type: 'STRING' }, { name: 'area', type: 'STRING' }, { name: 'audiencia', type: 'STRING', mode: 'REPEATED' },
  { name: 'vigente', type: 'BOOL' }, { name: 'version', type: 'STRING' }, { name: 'hash', type: 'STRING' },
  { name: 'actualizado', type: 'TIMESTAMP' }, { name: 'embedding', type: 'FLOAT64', mode: 'REPEATED' }];

/* ══ T1 · CIMIENTOS ═════════════════════════════════════════════════════════════════════════════════════════════ */

/* La configuración, o null si falta algo (el cerebro queda apagado sin errores). */
function cerConfig_() {
  var p = PropertiesService.getScriptProperties(), proy = String(p.getProperty('BQ_PROYECTO') || '').trim(), cuenta = p.getProperty('BQ_CUENTA');
  if (!proy || !cuenta || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(proy)) return null;   // el id va dentro del SQL: solo uno válido
  var j = null; try { j = JSON.parse(cuenta); } catch (e) { return null; }
  if (!j || !j.client_email || !j.private_key) return null;
  var ubic = String(p.getProperty('BQ_UBICACION') || 'US').trim(), reg = String(p.getProperty('CER_VERTEX_REGION') || 'us-central1').trim();
  return { proyecto: proy, email: String(j.client_email), llave: String(j.private_key), tokenUri: String(j.token_uri || 'https://oauth2.googleapis.com/token'),
    ubicacion: /^[A-Za-z0-9-]{2,30}$/.test(ubic) ? ubic : 'US', region: /^[a-z]+-[a-z]+\d$/.test(reg) ? reg : 'us-central1' };
}
function cerebroActivo_() { try { var c = cerConfig_(); return !!c; } catch (e) { return false; } }
function cerTablaSql_(c) { return '`' + c.proyecto + '.' + CER_DATASET_ + '.' + CER_TABLA_ + '`'; }
function cerModelo_() {
  var m = String(PropertiesService.getScriptProperties().getProperty('CER_EMBED_MODELO') || 'gemini-embedding-001').trim();
  return /^[a-z0-9.-]{3,60}$/.test(m) ? m : 'gemini-embedding-001';
}

/* Token de la cuenta de servicio: JWT firmado (RS256) → oauth2.googleapis.com/token. 50 min en caché. El alcance
   cloud-platform cubre BigQuery y Vertex AI; lo que la cuenta puede hacer lo deciden sus roles en Google Cloud. */
function cerToken_(c) {
  var cache = CacheService.getScriptCache(), k = 'cer_tok2_' + c.email.replace(/[^a-z0-9]/gi, '').slice(0, 60), t = cache.get(k);
  if (t) return t;
  var b64 = function (x) { return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); };
  var ahora = Math.floor(Date.now() / 1000);
  var cab = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var cuerpo = b64(JSON.stringify({ iss: c.email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: c.tokenUri, iat: ahora, exp: ahora + 3600 }));
  var firma = b64(Utilities.computeRsaSha256Signature(cab + '.' + cuerpo, c.llave));
  var r = UrlFetchApp.fetch(c.tokenUri, { method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cab + '.' + cuerpo + '.' + firma } });
  var j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
  if (r.getResponseCode() >= 300 || !j.access_token) throw new Error('Cuenta de servicio: no dio token (' + r.getResponseCode() + ' ' + String(j.error_description || j.error || '').slice(0, 120) + ')');
  cache.put(k, j.access_token, 3000);
  return j.access_token;
}

/* BigQuery por REST. Devuelve { code, json }. */
function cerBq_(c, metodo, ruta, cuerpo) {
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + cerToken_(c) } };
  if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  var r = UrlFetchApp.fetch('https://bigquery.googleapis.com/bigquery/v2/projects/' + c.proyecto + ruta, o);
  var j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
  return { code: r.getResponseCode(), json: j };
}
function cerError_(j) { var e = (j && j.error) || {}; return String(e.message || (j && j.errorResult && j.errorResult.message) || JSON.stringify(j || {})).slice(0, 300); }

/* Un parámetro con nombre (el texto del usuario NUNCA se concatena al SQL). tipo: STRING, FLOAT64, INT64, BOOL. */
function cerParam_(nombre, valor, tipo) {
  tipo = tipo || 'STRING';
  if (Array.isArray(valor)) return { name: nombre, parameterType: { type: 'ARRAY', arrayType: { type: tipo } },
    parameterValue: { arrayValues: valor.map(function (x) { return { value: String(x) }; }) } };
  return { name: nombre, parameterType: { type: tipo }, parameterValue: { value: valor == null ? '' : String(valor) } };
}
function cerValor_(campo, v) {
  if (v == null) return null;
  if (campo.mode === 'REPEATED') return (v || []).map(function (x) { return cerValor_({ type: campo.type }, x && x.v); });
  switch (campo.type) {
    case 'INTEGER': case 'INT64': case 'FLOAT': case 'FLOAT64': case 'NUMERIC': return Number(v);
    case 'BOOLEAN': case 'BOOL': return v === true || v === 'true';
    case 'TIMESTAMP': return new Date(Number(v) * 1000).toISOString();
    default: return v;
  }
}
function cerFilas_(schema, rows) {
  var f = (schema && schema.fields) || [];
  return (rows || []).map(function (r) { var o = {}; f.forEach(function (campo, i) { o[campo.name] = cerValor_(campo, r.f[i] && r.f[i].v); }); return o; });
}
/* jobs.query: SQL estándar, parámetros con nombre, caché de consultas y espera corta. */
function cerConsulta_(c, sql, params, o) {
  o = o || {};
  var r = cerBq_(c, 'post', '/queries', { query: sql, useLegacySql: false, useQueryCache: o.cache !== false, timeoutMs: o.timeoutMs || 15000,
    location: c.ubicacion, parameterMode: 'NAMED', queryParameters: params || [] });
  if (r.code >= 300) throw new Error('BigQuery ' + r.code + ': ' + cerError_(r.json));
  var j = r.json, t0 = Date.now();
  while (!j.jobComplete && Date.now() - t0 < (o.esperaMs || 60000)) {
    var rr = cerBq_(c, 'get', '/queries/' + encodeURIComponent(j.jobReference.jobId) + '?location=' + encodeURIComponent(c.ubicacion) + '&timeoutMs=10000');
    if (rr.code >= 300) throw new Error('BigQuery ' + rr.code + ': ' + cerError_(rr.json));
    j = rr.json;
  }
  if (!j.jobComplete) throw new Error('BigQuery: la consulta tardó demasiado');
  return cerFilas_(j.schema, j.rows);
}
function cerEsperarJob_(c, ref) {
  var t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    var r = cerBq_(c, 'get', '/jobs/' + encodeURIComponent(ref.jobId) + '?location=' + encodeURIComponent(ref.location || c.ubicacion));
    if (r.code >= 300) throw new Error('BigQuery job ' + r.code + ': ' + cerError_(r.json));
    var st = r.json.status || {};
    if (st.state === 'DONE') { if (st.errorResult) throw new Error('BigQuery carga: ' + cerError_(st)); return r.json; }
    Utilities.sleep(1000);
  }
  throw new Error('BigQuery: la carga tardó demasiado');
}

/* Crea el dataset y la tabla si no existen (una vez por proyecto y versión del esquema). */
function cerAsegurarTabla_(c) {
  var P = PropertiesService.getScriptProperties(), marca = c.proyecto + '/' + CER_VERSION_ESQUEMA_;
  if (P.getProperty('CER_TABLA') === marca) return;
  var d = cerBq_(c, 'get', '/datasets/' + CER_DATASET_);
  if (d.code === 404) {
    var cd = cerBq_(c, 'post', '/datasets', { datasetReference: { projectId: c.proyecto, datasetId: CER_DATASET_ }, location: c.ubicacion, description: 'Cerebro de Alma (Spacio AM): pedazos con su huella.' });
    if (cd.code >= 300 && cd.code !== 409) throw new Error('No pude crear el dataset: ' + cerError_(cd.json));
  } else if (d.code >= 300) throw new Error('BigQuery ' + d.code + ': ' + cerError_(d.json));
  var t = cerBq_(c, 'get', '/datasets/' + CER_DATASET_ + '/tables/' + CER_TABLA_);
  if (t.code === 404) {
    var ct = cerBq_(c, 'post', '/datasets/' + CER_DATASET_ + '/tables', { tableReference: { projectId: c.proyecto, datasetId: CER_DATASET_, tableId: CER_TABLA_ },
      schema: { fields: CER_ESQUEMA_ }, clustering: { fields: ['fuente', 'doc_id'] }, description: 'Un pedazo por fila: texto con su ruta, etiquetas y huella.' });
    if (ct.code >= 300 && ct.code !== 409) throw new Error('No pude crear la tabla: ' + cerError_(ct.json));
  } else if (t.code >= 300) throw new Error('BigQuery ' + t.code + ': ' + cerError_(t.json));
  P.setProperty('CER_TABLA', marca);
}

/* Huellas de significado con Vertex AI (gemini-embedding-001, mismo modelo que Gemini, pagado en el mismo proyecto).
   Vertex recibe un texto por llamada con este modelo: van 20 a la vez (fetchAll), con reintento corto en 429/5xx.
   tarea: RETRIEVAL_DOCUMENT para pedazos, RETRIEVAL_QUERY para preguntas. Se normalizan (con 768 dimensiones no
   vienen normalizadas). */
function cerNormalizar_(v) {
  var s = 0; v.forEach(function (x) { s += x * x; }); s = Math.sqrt(s) || 1;
  return v.map(function (x) { return Math.round((x / s) * 1e7) / 1e7; });
}
function cerVertexUrl_(c, modelo) {
  return 'https://' + c.region + '-aiplatform.googleapis.com/v1/projects/' + c.proyecto + '/locations/' + c.region + '/publishers/google/models/' + modelo + ':predict';
}
function cerEmbeddings_(c, textos, tarea, o) {
  o = o || {};
  var modelo = cerModelo_(), url = cerVertexUrl_(c, modelo), out = new Array(textos.length), tokens = 0, t0 = Date.now();
  var pedido = function (t) {
    return { url: url, method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + cerToken_(c) },
      payload: JSON.stringify({ instances: [{ content: String(t).slice(0, 8000), task_type: tarea }], parameters: { outputDimensionality: CER_DIM_, autoTruncate: true } }) };
  };
  for (var i = 0; i < textos.length; i += 20) {
    var pendientes = []; for (var k = i; k < Math.min(i + 20, textos.length); k++) pendientes.push(k);
    for (var intento = 0; intento < 4 && pendientes.length; intento++) {
      if (intento) Utilities.sleep(1000 * intento);
      var rs = UrlFetchApp.fetchAll(pendientes.map(function (n) { return pedido(textos[n]); })), otra = [];
      rs.forEach(function (r, x) {
        var n = pendientes[x], code = r.getResponseCode();
        if (code < 300) {
          var j = JSON.parse(r.getContentText() || '{}'), e = (((j.predictions || [])[0] || {}).embeddings || {});
          out[n] = cerNormalizar_(e.values || []);
        } else if ([429, 500, 502, 503, 504].indexOf(code) >= 0 && intento < 3) otra.push(n);
        else throw new Error(cerVertexError_(code, r.getContentText()));
      });
      pendientes = otra;
    }
    textos.slice(i, i + 20).forEach(function (t) { tokens += Math.ceil(Math.min(8000, String(t).length) / 4); });
  }
  if (out.some(function (v) { return !v || v.length !== CER_DIM_; })) throw new Error('Vertex AI no devolvió todas las huellas');
  if (o.registrar !== false) {
    try { registrarUso_({ app: 'ALMA', funcion: 'Cerebro · índice', detalle: textos.length + ' pedazos', modelo: modelo, usage: { input_tokens: tokens }, usd: tokens * 0.15 / 1e6, ms: Date.now() - t0, ok: true }); } catch (e) {}
  }
  out.tokens = tokens;
  return out;
}

/* El error de Vertex en palabras de Juan: lo de siempre es que falta activar la API o darle el rol a la cuenta. */
function cerVertexError_(code, texto) {
  var t = String(texto || ''), m = ''; try { m = String((JSON.parse(t).error || {}).message || ''); } catch (e) { m = t; }
  if (code === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(t)) return 'Vertex AI: falta activar «Vertex AI API» en el proyecto.';
  if (code === 403) return 'Vertex AI: a la cuenta del cerebro le falta el rol «Usuario de Vertex AI».';
  return 'Vertex AI ' + code + ': ' + m.slice(0, 200);
}
/* ¿Vertex responde? Una huella de prueba; si sale bien, no se vuelve a probar en 6 horas. Devuelve '' o el problema. */
function cerVertexListo_(c) {
  var cache = CacheService.getScriptCache(); if (cache.get('cer_vertex_ok')) return '';
  try { cerEmbeddings_(c, ['prueba'], 'RETRIEVAL_QUERY', { registrar: false }); cache.put('cer_vertex_ok', '1', 21600); return ''; }
  catch (e) { return String(e.message || e).slice(0, 200); }
}

/* Escritura por lotes: un load job desde NDJSON (lo cargado así se puede borrar con DML al instante; lo insertado por
   streaming no, durante un rato). */
function cerCargar_(c, filas) {
  if (!filas.length) return;
  var limite = 'cer' + Utilities.getUuid().replace(/-/g, '');
  var cfg = { configuration: { load: { destinationTable: { projectId: c.proyecto, datasetId: CER_DATASET_, tableId: CER_TABLA_ }, sourceFormat: 'NEWLINE_DELIMITED_JSON', writeDisposition: 'WRITE_APPEND' } },
    jobReference: { projectId: c.proyecto, location: c.ubicacion } };
  var cuerpo = '--' + limite + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(cfg) + '\r\n--' + limite +
    '\r\nContent-Type: application/octet-stream\r\n\r\n' + filas.map(function (f) { return JSON.stringify(f); }).join('\n') + '\r\n--' + limite + '--';
  var r = UrlFetchApp.fetch('https://bigquery.googleapis.com/upload/bigquery/v2/projects/' + c.proyecto + '/jobs?uploadType=multipart', { method: 'post',
    contentType: 'multipart/related; boundary=' + limite, payload: Utilities.newBlob(cuerpo).getBytes(), headers: { Authorization: 'Bearer ' + cerToken_(c) }, muteHttpExceptions: true });
  var j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
  if (r.getResponseCode() >= 300) throw new Error('BigQuery carga ' + r.getResponseCode() + ': ' + cerError_(j));
  cerEsperarJob_(c, j.jobReference || {});
}
/* Reemplaza los pedazos de unos documentos: primero entra lo nuevo y después sale lo viejo (otra versión). */
function cerReemplazar_(c, filas, docs, version) {
  cerCargar_(c, filas);
  if (docs.length) cerConsulta_(c, 'DELETE FROM ' + cerTablaSql_(c) + ' WHERE doc_id IN UNNEST(@docs) AND version != @version',
    [cerParam_('docs', docs, 'STRING'), cerParam_('version', version)], { cache: false });
}

/* ══ T2 · CARGADOR ══════════════════════════════════════════════════════════════════════════════════════════════ */

function cerNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-–_]/g, ''); }
function cerHash_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 32);
}
/* ¿Parece un código, una clave o la contraseña del WiFi? Lo que lo parece nunca va a un pedazo para huéspedes. */
function cerPareceSecreto_(texto, secretos) {
  var t = String(texto || ''), plano = t.replace(/[\s.-]/g, '');
  if ((secretos || []).some(function (x) { x = String(x || '').trim(); return x.length >= 4 && t.indexOf(x) >= 0; })) return true;
  return /(c[oó]digo|clave|contrase|password|passcode|\bpin\b|wi-?fi)/i.test(t) && /\d{4,}/.test(plano);
}

/* El corte: por títulos; las tablas, las listas de pasos y el código no se cortan; los párrafos largos se parten;
   los pedazos muy cortos se unen al vecino. Cada pedazo lleva antes su ruta («Playbook · Operaciones › Pasos»). */
function cerBloques_(lineas) {
  var out = [], cur = null, enCodigo = false;
  var cerrar = function () { if (cur && cur.l.join('').trim()) out.push({ tipo: cur.tipo, atomico: cur.tipo !== 'parrafo', texto: cur.l.join('\n').replace(/\n+$/, '') }); cur = null; };
  var tipoDe = function (l) { return /^\s*\|/.test(l) ? 'tabla' : /^\s*([-*+·]|\d+[.)])\s+/.test(l) ? 'lista' : 'parrafo'; };
  lineas.forEach(function (l) {
    if (/^\s*```/.test(l)) {
      if (!enCodigo) { cerrar(); cur = { tipo: 'codigo', l: [l] }; enCodigo = true; } else { cur.l.push(l); enCodigo = false; cerrar(); }
      return;
    }
    if (enCodigo) { cur.l.push(l); return; }
    if (!l.trim()) { if (cur && cur.tipo === 'lista') cur.blanco = true; else cerrar(); return; }
    var t = tipoDe(l);
    if (cur && cur.tipo === 'lista' && (t === 'lista' || /^\s{2,}\S/.test(l))) { if (cur.blanco) cur.l.push(''); cur.blanco = false; cur.l.push(l); return; }
    if (cur && cur.tipo === t && !cur.blanco) { cur.l.push(l); return; }
    cerrar(); cur = { tipo: t, l: [l] };
  });
  if (enCodigo && cur) cur.tipo = 'codigo';
  cerrar();
  return out;
}
function cerPartirParrafo_(t) {
  var partes = [], cur = '';
  String(t).split(/(?<=[.!?])\s+/).forEach(function (f) {
    while (f.length > CER_MAX_) { if (cur) { partes.push(cur); cur = ''; } partes.push(f.slice(0, CER_MAX_)); f = f.slice(CER_MAX_); }
    if (cur && cur.length + f.length + 1 > CER_MAX_) { partes.push(cur); cur = ''; }
    cur = cur ? cur + ' ' + f : f;
  });
  if (cur) partes.push(cur);
  return partes;
}
function cerCortar_(md, raiz) {
  var secciones = [], camino = [], actual = { camino: [], lineas: [] }, enCodigo = false;
  String(md || '').replace(/\r/g, '').split('\n').forEach(function (l) {
    if (/^\s*```/.test(l)) enCodigo = !enCodigo;
    var h = !enCodigo && l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      if (actual.lineas.join('').trim()) secciones.push(actual);
      var nivel = h[1].length; camino = camino.slice(0, nivel - 1); while (camino.length < nivel - 1) camino.push('');
      camino[nivel - 1] = h[2].replace(/[*_`]/g, '').trim();
      actual = { camino: camino.filter(function (x) { return x && x !== raiz; }), lineas: [] };
    } else actual.lineas.push(l);
  });
  if (actual.lineas.join('').trim()) secciones.push(actual);
  /* 1) cada sección en pedazos de hasta CER_MAX_ (los bloques atómicos van enteros aunque sean más largos) */
  var piezas = [];
  secciones.forEach(function (s) {
    var grupo = [], largo = 0, cam = [raiz].concat(s.camino);
    var soltar = function () { if (grupo.length) piezas.push({ secs: [{ camino: cam, cuerpo: grupo.join('\n\n') }] }); grupo = []; largo = 0; };
    cerBloques_(s.lineas).forEach(function (b) {
      (b.atomico || b.texto.length <= CER_MAX_ ? [b.texto] : cerPartirParrafo_(b.texto)).forEach(function (p) {
        if (largo && largo + p.length + 2 > CER_MAX_) soltar();
        grupo.push(p); largo += p.length + 2;
      });
    });
    soltar();
  });
  /* 2) los muy cortos se unen al vecino (primero el siguiente, si no el anterior) mientras quepan */
  var largoDe = function (x) { return x.secs.reduce(function (a, s) { return a + s.cuerpo.length + s.camino.join(' › ').length + 2; }, 0); };
  for (var i = 0; i < piezas.length; i++) {
    if (largoDe(piezas[i]) >= CER_MIN_) continue;
    if (i + 1 < piezas.length && largoDe(piezas[i]) + largoDe(piezas[i + 1]) <= CER_MAX_) { piezas[i + 1].secs = piezas[i].secs.concat(piezas[i + 1].secs); piezas.splice(i, 1); i--; }
    else if (i > 0 && largoDe(piezas[i - 1]) + largoDe(piezas[i]) <= CER_MAX_) { piezas[i - 1].secs = piezas[i - 1].secs.concat(piezas[i].secs); piezas.splice(i, 1); i -= 2; if (i < -1) i = -1; }
  }
  /* 3) la ruta (lo común a sus secciones) va antes del texto */
  return piezas.map(function (x) {
    var ruta = x.secs[0].camino.slice();
    x.secs.forEach(function (s) { var k = 0; while (k < ruta.length && k < s.camino.length && ruta[k] === s.camino[k]) k++; ruta = ruta.slice(0, k); });
    if (!ruta.length) ruta = [raiz];
    var cuerpo = x.secs.map(function (s) { var sub = s.camino.slice(ruta.length).join(' › '); return (sub ? sub + '\n' : '') + s.cuerpo; }).join('\n\n');
    return { ruta: ruta, titulo: ruta[ruta.length - 1], texto: ruta.join(' › ') + '\n\n' + cuerpo };
  });
}

/* La ficha (texto de infoPropiedad_, el mismo que ve Alma) en markdown: cada «Dato: valor» es un título. */
function cerFichaMd_(info) {
  return String(info || '').split('\n').map(function (l) {
    if (/^·\s*/.test(l)) return '- ' + l.replace(/^·\s*/, '');
    var m = l.match(/^(?!·)([^:]{2,60}):\s*(.*)$/);
    return m ? '\n### ' + m[1].trim() + (m[2] ? '\n' + m[2] : '') : l;
  }).join('\n');
}

/* Lo que se lee una vez por tanda. */
function cerCtx_() {
  var filas = leerTabla_(CFG.TAB_PROPIEDADES), fichas = {}, nombres = [], manual = null;
  filas.forEach(function (f) {
    var n = String(f.property_name || '').trim(); if (!n) return;
    if (n.indexOf('__manual__') >= 0) { try { manual = JSON.parse(String(f.info_json || '{}')); } catch (e) {} return; }
    if (n.indexOf('__') >= 0) return;
    if (!fichas[cerNorm_(n)]) { fichas[cerNorm_(n)] = f; nombres.push(n); }
  });
  return { fichas: fichas, nombres: nombres, manual: manual };
}

/* Una propiedad = un documento con dos juegos de pedazos:
     · para todos (también huéspedes): lo que hoy se le da a un huésped SIN validar su reserva (regla 7 del redactor:
       edificio, zona y políticas) → dirección y edificio, parqueo, consejo, manuales y lo que el equipo enseñó del
       EDIFICIO. Nunca WiFi, piso, apartamento, cerradura ni códigos: esos Alma solo los da con la reserva validada
       (property_info) o con codigo_acceso, y el cerebro no valida reservas.
     · interno (principal y equipo): la ficha completa (la misma de infoPropiedad_, sin códigos de puerta) y la memoria.
   Lo que parezca un código o una clave se pasa a interno; ante la duda, interno. */
function cerDocPropiedad_(nombre, ctx) {
  var fila = ctx.fichas[cerNorm_(nombre)], j = null;
  try { j = JSON.parse(String((fila && fila.info_json) || '')); } catch (e) {}
  var zona = vozZona_(nombre) || nombre, raizPub = 'Propiedad ' + zona, raizInt = 'Propiedad ' + nombre;
  if (!j || typeof j !== 'object') return { cuarentena: 'La propiedad no tiene ficha (info_json vacío o inválido).', titulo: raizInt };
  var secretos = [j.wifiPass, j.wifiPassBk, j.wifiPassBk2], t = (j.std && j.std.es) || {}, pub = [];
  var poner = function (titulo, texto) { texto = String(texto || '').trim(); if (texto && !cerPareceSecreto_(titulo + ' ' + texto, secretos)) pub.push('## ' + titulo + '\n' + texto); };
  poner('Dirección y edificio', t.arrivalIntro);
  var parq = ''; try { parq = t.parking || kbParqueo_(nombre); } catch (e) {}
  poner('Parqueo', parq);
  poner('Consejo', t.tip);
  var m = ctx.manual;
  if (m && m.items && m.assign) m.items.filter(function (it) { return (m.assign[it.id] || []).some(function (n) { return cerNorm_(n) === cerNorm_(nombre); }); }).forEach(function (it) {
    poner('Manual · ' + String(it.title || '').trim(), [String(it.intro || '').trim(), (it.steps || []).map(function (s, k) { return (k + 1) + '. ' + String(s).trim(); }).join('\n')].filter(Boolean).join('\n\n'));
  });
  var memPub = [], memInt = [], edificio = cerNorm_(memEdificio_(nombre)), mem = [];
  try { mem = memoriaDe_(nombre).filter(function (x) { return x.estado === 'activa'; }); } catch (e) {}
  mem.forEach(function (x) {
    var linea = '- ' + String(x.dato).trim() + (x.temporal === 'sí' ? ' (temporal, hasta ' + String(x.vence).slice(0, 10) + ')' : '');
    var publica = cerNorm_(x.aplica_a) === edificio && !/acceso|wifi/i.test(x.tema) && !cerPareceSecreto_(x.tema + ' ' + x.dato, secretos) && !/\d{4,}/.test(String(x.dato).replace(/[\s.-]/g, ''));
    (publica ? memPub : memInt).push(linea);
  });
  if (memPub.length) pub.push('## Lo que el equipo enseñó del edificio\n' + memPub.join('\n'));
  var info = ''; try { info = infoPropiedad_(nombre, 'es'); } catch (e) {}
  var mdPub = pub.length ? '# ' + raizPub + '\n\n' + pub.join('\n\n') : '';
  var mdInt = '# ' + raizInt + '\n\n## Ficha\n' + cerFichaMd_(info) + (memInt.concat(memPub).length ? '\n\n## Memoria del equipo\n' + memInt.concat(memPub).join('\n') : '');
  var base = { fuente: 'propiedad', area: 'operaciones', propiedad: nombre };
  var pedazos = (mdPub ? cerCortar_(mdPub, raizPub).map(function (p) { return Object.assign(p, base, { audiencia: CER_PUBLICO_ }); }) : [])
    .concat(cerCortar_(mdInt, raizInt).map(function (p) { return Object.assign(p, base, { audiencia: CER_INTERNO_ }); }));
  return { titulo: raizInt, hash: cerHash_(CER_VERSION_CORTE_ + '\n' + mdPub + '\n' + mdInt), pedazos: pedazos, secretos: secretos };
}

/* Los playbooks del repo (main): la lista por la API de GitHub y cada .md por raw. Son internos. */
function cerGithubCab_() {
  var tok = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  return tok ? { Authorization: 'Bearer ' + tok } : {};
}
function cerPlaybooksLista_() {
  var h = cerGithubCab_(); h.Accept = 'application/vnd.github+json';
  var r = UrlFetchApp.fetch('https://api.github.com/repos/' + CER_REPO_ + '/contents/playbooks?ref=main', { muteHttpExceptions: true, headers: h });
  if (r.getResponseCode() !== 200) throw new Error('GitHub ' + r.getResponseCode());
  return JSON.parse(r.getContentText()).filter(function (x) { return x.type === 'file' && /\.md$/i.test(x.name); }).map(function (x) {
    return { nombre: x.name.replace(/\.md$/i, '').toLowerCase(), sha: x.sha, url: 'https://raw.githubusercontent.com/' + CER_REPO_ + '/main/playbooks/' + encodeURIComponent(x.name) };
  });
}
function cerDocPlaybook_(d, hashPrevio) {
  var hash = cerHash_(CER_VERSION_CORTE_ + ':' + d.sha);   // la huella del archivo en git: si no cambió, ni se descarga
  if (hash === hashPrevio) return { hash: hash };
  var r = UrlFetchApp.fetch(d.url, { muteHttpExceptions: true, headers: cerGithubCab_() });
  if (r.getResponseCode() !== 200) throw new Error('playbook ' + d.ref + ': HTTP ' + r.getResponseCode());
  return cerDocPlaybookMd_(d.ref, r.getContentText(), hash);
}
function cerDocPlaybookMd_(nombre, md, hash) {
  var titulo = ((String(md).match(/^#\s+(.+)$/m) || [])[1] || 'Playbook ' + nombre).replace(/[*_`]/g, '').trim();
  var area = CER_AREA_PLAYBOOK_[nombre] || (/^negocio-/.test(nombre) ? 'negocio' : '');
  if (!area) return { hash: hash, titulo: titulo, cuarentena: 'El playbook «' + nombre + '» no tiene un área aprobada: agrégalo a CER_AREA_PLAYBOOK_ (cerebro.js).' };
  return { hash: hash, titulo: titulo, pedazos: cerCortar_(md, titulo).map(function (p) { return Object.assign(p, { fuente: 'playbook', area: area, propiedad: '', audiencia: CER_INTERNO_ }); }) };
}

/* Etiquetas de listas aprobadas. Devuelve el motivo de cuarentena, o '' si todo encaja. */
function cerValidar_(doc, nombres) {
  var areaOk = function (a) { return CER_AREAS_TRABAJO_.indexOf(a) >= 0 || (typeof areaOk_ === 'function' && areaOk_(a)); };
  for (var i = 0; i < doc.pedazos.length; i++) {
    var p = doc.pedazos[i];
    if (CER_FUENTES_.indexOf(p.fuente) < 0) return 'Fuente no aprobada: ' + p.fuente;
    if (!areaOk(p.area)) return 'Área no aprobada: ' + p.area;
    if (p.propiedad && nombres.indexOf(p.propiedad) < 0) return 'Propiedad que no está en PropiedadesInfo: ' + p.propiedad;
    if (!p.audiencia || !p.audiencia.length || p.audiencia.some(function (a) { return CER_AUDIENCIAS_.indexOf(a) < 0; })) return 'Audiencia no aprobada: ' + JSON.stringify(p.audiencia);
    if ((p.fuente === 'conversacion' || p.fuente === 'correo') && p.audiencia.some(function (a) { return CER_INTERNO_.indexOf(a) < 0; })) return 'Una conversación o un correo solo puede ser interno (principal y equipo).';
    if (p.audiencia.indexOf('externo') >= 0 && cerPareceSecreto_(p.texto, doc.secretos)) return 'Un pedazo para huéspedes parece tener un código o una clave (' + p.titulo + ').';
    if (!String(p.texto || '').trim()) return 'Pedazo vacío.';
  }
  return '';
}

/* Cuarentena: una fila por documento (se actualiza; sale cuando el documento ya encaja). */
function cerHojaCuar_() { return hojaCrear_('ALMA_CEREBRO_CUARENTENA', CER_CUAR_CAB_); }
function cerCuarentena_(docId, fuente, titulo, motivo) {
  var sh = cerHojaCuar_(), n = sh.getLastRow(), ids = n >= 2 ? sh.getRange(2, 2, n - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var i = ids.indexOf(docId);
  if (motivo == null) { if (i >= 0) sh.deleteRow(i + 2); return; }
  if (i >= 0 && String(sh.getRange(i + 2, 5, 1, 1).getValues()[0][0]) === String(motivo).slice(0, 300)) return;   // ya estaba igual
  var fila = [new Date().toISOString(), docId, fuente, String(titulo || '').slice(0, 120), String(motivo).slice(0, 300)];
  if (i >= 0) sh.getRange(i + 2, 1, 1, fila.length).setValues([fila]); else sh.appendRow(fila);
}

/* ══ T3 · SINCRONIZACIÓN ════════════════════════════════════════════════════════════════════════════════════════ */

/* Todos los documentos de las fuentes. completo[fuente] = la lista se leyó bien (solo así se borra lo que falta). */
function cerCatalogo_(ctx) {
  var docs = [], completo = {};
  ctx.nombres.forEach(function (n) { docs.push({ id: 'propiedad:' + n, fuente: 'propiedad', ref: n }); });
  completo.propiedad = ctx.nombres.length > 0;
  try { cerPlaybooksLista_().forEach(function (pb) { docs.push({ id: 'playbook:' + pb.nombre, fuente: 'playbook', ref: pb.nombre, sha: pb.sha, url: pb.url }); }); completo.playbook = true; }
  catch (e) { console.error('cerebro · lista de playbooks: ' + e); }
  /* T5 · conversaciones, correos y Drive (cerebro_fuentes.js). Cada una por su lado: si una falla, las demás siguen. */
  try { cerConvCatalogo_(ctx).forEach(function (d) { docs.push(d); }); completo.conversacion = true; } catch (e) { console.error('cerebro · conversaciones: ' + e); }
  try { cerCorreoCatalogo_(ctx).forEach(function (d) { docs.push(d); }); completo.correo = true; } catch (e) { console.error('cerebro · correos: ' + e); }
  try { var dr = cerDriveCatalogo_(ctx, ctx.t0 || Date.now()); dr.docs.forEach(function (d) { docs.push(d); }); completo.drive = dr.completo; } catch (e) { console.error('cerebro · Drive: ' + e); }
  docs.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  return { docs: docs, completo: completo };
}
function cerLeerDoc_(d, ctx, hashPrevio) {
  switch (d.fuente) {
    case 'propiedad': return cerDocPropiedad_(d.ref, ctx);
    case 'playbook': return cerDocPlaybook_(d, hashPrevio);
    case 'conversacion': return cerDocConversacion_(d, ctx);
    case 'correo': return cerDocCorreo_(d, ctx);
    case 'drive': return cerDocDrive_(d, ctx, hashPrevio);
  }
  return null;
}

/* El activador (sin «_»: Apps Script no deja que un activador llame a una función privada). */
function cerebroSincronizar() { return cerebroSincronizar_(); }
function cerebroSincronizar_() {
  var c = cerConfig_(); if (!c) return { ok: true, apagado: true };
  /* Candado propio (no el LockService del script: lo usan los Pendientes y una tanda dura minutos). */
  var P = PropertiesService.getScriptProperties(), t0 = Date.now(), corriendo = Number(P.getProperty('CER_CORRIENDO') || 0);
  if (corriendo && t0 - corriendo < 7 * 60000) return { ok: true, ocupado: true };
  P.setProperty('CER_CORRIENDO', String(t0));
  try { return cerTanda_(c, t0); }
  catch (e) {
    console.error('cerebroSincronizar_: ' + (e.stack || e));
    try { var u = JSON.parse(P.getProperty('CER_ULTIMA') || '{}'); u.error = String(e.message || e).slice(0, 300); u.error_ts = new Date().toISOString(); P.setProperty('CER_ULTIMA', JSON.stringify(u)); } catch (x) {}
    return { ok: false, error: String(e.message || e) };
  } finally { P.deleteProperty('CER_CORRIENDO'); }
}
function cerTanda_(c, t0) {
  cerAsegurarTabla_(c);
  var P = PropertiesService.getScriptProperties();
  var est = null; try { est = JSON.parse(P.getProperty('CER_PASADA') || 'null'); } catch (e) {}
  est = est || { cursor: 0, inicio: new Date(t0).toISOString(), cambiados: 0, pedazos: 0, borrados: 0, cuarentena: 0, tandas: 0 };
  est.tandas++;
  var ctx = cerCtx_(); ctx.t0 = t0;
  var cat = cerCatalogo_(ctx), docs = cat.docs, previos = {};
  cerConsulta_(c, 'SELECT doc_id, ARRAY_AGG(`hash` ORDER BY actualizado DESC LIMIT 1)[OFFSET(0)] AS `hash` FROM ' + cerTablaSql_(c) + ' GROUP BY doc_id', [], { cache: false })
    .forEach(function (f) { previos[f.doc_id] = f.hash; });
  if (est.cursor === 0) {   // al empezar la pasada: lo que ya no existe se borra (solo de fuentes que se leyeron completas)
    var vivos = {}; docs.forEach(function (d) { vivos[d.id] = 1; });
    var borrar = Object.keys(previos).filter(function (id) { return !vivos[id] && cat.completo[id.split(':')[0]]; });
    if (borrar.length) {
      cerConsulta_(c, 'DELETE FROM ' + cerTablaSql_(c) + ' WHERE doc_id IN UNNEST(@docs)', [cerParam_('docs', borrar, 'STRING')], { cache: false });
      est.borrados += borrar.length;
      borrar.forEach(function (id) { try { cerCuarentena_(id, '', '', null); } catch (e) {} });
    }
  }
  /* Se sigue por el id del último documento hecho (no por posición): si entra una conversación nueva, nada se salta. */
  var i = est.cursor;
  if (est.ultimo_id) { i = 0; while (i < docs.length && docs[i].id <= est.ultimo_id) i++; }
  var version = 'v' + t0.toString(36), filas = [], cambiados = [], ahora = Utilities.formatDate(new Date(t0), 'UTC', 'yyyy-MM-dd HH:mm:ss') + ' UTC';
  var vaciar = function () {
    if (!cambiados.length) return;
    if (filas.length) { var emb = cerEmbeddings_(c, filas.map(function (f) { return f.texto; }), 'RETRIEVAL_DOCUMENT'); filas.forEach(function (f, k) { f.embedding = emb[k]; }); }
    cerReemplazar_(c, filas, cambiados, version);   // primero lo nuevo, después sale lo viejo
    est.cambiados += cambiados.length; est.pedazos += filas.length; filas = []; cambiados = [];
  };
  for (; i < docs.length; i++) {
    if (Date.now() - t0 > CER_PLAZO_MS_) break;
    var d = docs[i], doc = null;
    try { doc = cerLeerDoc_(d, ctx, previos[d.id]); } catch (e) { console.error('cerebro · ' + d.id + ': ' + e); continue; }   // no se pudo leer: se queda lo de antes
    if (!doc || (!doc.cuarentena && doc.hash === previos[d.id])) continue;
    var motivo = doc.cuarentena || cerValidar_(doc, ctx.nombres);
    if (motivo) {
      cerCuarentena_(d.id, d.fuente, doc.titulo || d.ref, motivo); est.cuarentena++;
      if (previos[d.id]) cambiados.push(d.id);   // lo viejo de un documento que ya no encaja también sale
      continue;
    }
    try { cerCuarentena_(d.id, '', '', null); } catch (e) {}
    cambiados.push(d.id);
    doc.pedazos.forEach(function (p, k) {
      filas.push({ id: d.id + '#' + k + '@' + version, doc_id: d.id, fuente: p.fuente, titulo: p.titulo, ruta: p.ruta.join(' › '), texto: p.texto, propiedad: p.propiedad || '',
        area: p.area, audiencia: p.audiencia, vigente: true, version: version, hash: doc.hash, actualizado: ahora, embedding: [] });
    });
    if (filas.length >= 150) vaciar();
  }
  vaciar();
  if (i >= docs.length) {
    P.deleteProperty('CER_PASADA');
    est.fin = new Date().toISOString(); est.docs = docs.length; delete est.cursor; delete est.ultimo_id;
    P.setProperty('CER_ULTIMA', JSON.stringify(est));
    return { ok: true, terminada: true, pasada: est };
  }
  est.cursor = i; est.ultimo_id = i > 0 ? docs[i - 1].id : ''; P.setProperty('CER_PASADA', JSON.stringify(est));
  return { ok: true, terminada: false, van: i, de: docs.length };
}

/* Se instala solo desde aprender() (cada hora) cuando el cerebro tiene su configuración. */
function cerebroAsegurarActivador_() {
  if (!cerebroActivo_()) return false;
  if (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cerebroSincronizar'; })) return true;
  ScriptApp.newTrigger('cerebroSincronizar').timeBased().everyMinutes(15).create();
  return true;
}
/* Para correr a mano en el editor después de pegar BQ_CUENTA y BQ_PROYECTO. */
function cerebroInstalar() {
  if (!cerebroActivo_()) { console.log('Cerebro apagado: faltan BQ_PROYECTO o BQ_CUENTA (llave JSON válida) en las Propiedades del script.'); return; }
  console.log('Activador: ' + cerebroAsegurarActivador_());
  console.log(JSON.stringify(cerebroSincronizar_()));
}

/* ══ T4 · BÚSQUEDA ══════════════════════════════════════════════════════════════════════════════════════════════ */

var CER_VACIAS_ = ('que como cual cuales cuando donde quien quienes por para con sin una uno unos unas los las del las ella ellos esta este esto estos estas ese esa eso ' +
  'hay tiene tienen tengo puede pueden hace hacer sobre entre desde hasta pero mas muy tambien alma dime decir sabes saber the and for what how').split(' ');
function cerTerminos_(pregunta) {
  var vistos = {};
  return String(pregunta || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/)
    .filter(function (t) { return t && (t.length >= 3 || /^\d{2,}$/.test(t)) && CER_VACIAS_.indexOf(t) < 0 && !vistos[t] && (vistos[t] = 1); }).slice(0, 10);
}
/* Una sola consulta: significado (ML.DISTANCE coseno, top 50) + palabras exactas (top 50), con la audiencia y la
   vigencia filtradas DENTRO del SQL, fusión de rangos (RRF, k = 60) y los 8 mejores. Sin índice vectorial: con pocos
   miles de pedazos la distancia directa es exacta y rápida (VECTOR_SEARCH conviene cuando haya índice). */
function cerSqlBuscar_(tabla) {
  return [
    'WITH base AS (',
    '  SELECT id, doc_id, titulo, ruta, fuente, texto, area, propiedad, audiencia, embedding,',
    "    LOWER(REGEXP_REPLACE(NORMALIZE(CONCAT(IFNULL(titulo, ''), ' ', IFNULL(texto, '')), NFD), r'\\p{M}', '')) AS plano",
    '  FROM ' + tabla,
    '  WHERE vigente AND @audiencia IN UNNEST(audiencia)',
    "    AND (@fuente = '' OR fuente = @fuente) AND (@propiedad = '' OR propiedad = @propiedad) AND (@area = '' OR area = @area)",
    '), sem AS (',
    '  SELECT id, distancia, ROW_NUMBER() OVER (ORDER BY distancia, id) AS r FROM (',
    "    SELECT id, IF(ARRAY_LENGTH(@vector) > 0 AND ARRAY_LENGTH(embedding) = ARRAY_LENGTH(@vector), ML.DISTANCE(embedding, @vector, 'COSINE'), NULL) AS distancia FROM base)",
    '  WHERE distancia IS NOT NULL ORDER BY distancia LIMIT 50',
    '), pal AS (',
    '  SELECT id, aciertos, ROW_NUMBER() OVER (ORDER BY aciertos DESC, id) AS r FROM (',
    '    SELECT id, (SELECT COUNT(1) FROM UNNEST(@terminos) AS t WHERE STRPOS(plano, t) > 0) AS aciertos FROM base)',
    '  WHERE aciertos > 0 ORDER BY aciertos DESC LIMIT 50',
    ')',
    'SELECT b.doc_id, b.titulo, b.ruta, b.fuente, b.texto, b.area, b.propiedad, b.audiencia, sem.distancia, IFNULL(pal.aciertos, 0) AS aciertos,',
    '  IFNULL(1 / (60 + sem.r), 0) + IFNULL(1 / (60 + pal.r), 0) AS rrf',
    'FROM base AS b LEFT JOIN sem ON sem.id = b.id LEFT JOIN pal ON pal.id = b.id',
    'WHERE sem.id IS NOT NULL OR pal.id IS NOT NULL',
    'ORDER BY rrf DESC LIMIT 8'].join('\n');
}
function cerParamsBuscar_(audiencia, filtros, vector, terminos) {
  return [cerParam_('audiencia', audiencia), cerParam_('fuente', filtros.fuente || ''), cerParam_('propiedad', filtros.propiedad || ''), cerParam_('area', filtros.area || ''),
    cerParam_('vector', vector || [], 'FLOAT64'), cerParam_('terminos', terminos || [], 'STRING')];
}
/* ¿Es prueba? Cerca en significado o con la mayoría de las palabras de la pregunta. Ajustable: CER_DISTANCIA_MAX. */
function cerUmbral_() { return Number(PropertiesService.getScriptProperties().getProperty('CER_DISTANCIA_MAX')) || 0.35; }
function cerEsPrueba_(f, nTerminos, umbral) {
  var dmax = umbral != null ? umbral : cerUmbral_();
  var minAc = !nTerminos ? Infinity : nTerminos <= 2 ? nTerminos : Math.max(2, Math.ceil(nTerminos * 0.6));
  return (f.distancia != null && f.distancia <= dmax) || f.aciertos >= minAc;
}

/* cerebroBuscar_(pregunta, audiencia, filtros) → { ok, sin_prueba, pedazos: [{ titulo, ruta, fuente, texto }], area_cercana, ms }.
   audiencia: principal | equipo | asociado | externo (la decide quien llama, desde quién habla). filtros: { fuente, propiedad, area }.
   o.detalle (solo la prueba del cerebro): cada pedazo trae además doc_id, audiencia, distancia y aciertos, y vienen
   «crudas» (los 8 del SQL ya filtrados por audiencia) y «fugas_sql» (los que el SQL dejó pasar y paró la segunda llave). */
function cerebroBuscar_(pregunta, audiencia, filtros, o) {
  o = o || {};
  var c = cerConfig_(); if (!c) return { ok: false, apagado: true, pedazos: [] };
  audiencia = CER_AUDIENCIAS_.indexOf(audiencia) >= 0 ? audiencia : 'externo';   // lo desconocido se trata como lo más cerrado
  filtros = filtros || {};
  var f0 = { fuente: CER_FUENTES_.indexOf(filtros.fuente) >= 0 ? filtros.fuente : '', propiedad: String(filtros.propiedad || '').slice(0, 120), area: String(filtros.area || '').slice(0, 40) };
  pregunta = String(pregunta || '').trim().slice(0, 1000);
  if (!pregunta) return { ok: false, error: 'Falta la pregunta.', pedazos: [] };
  var t0 = Date.now(), vector = [], tokens = Math.ceil(pregunta.length / 4), terminos = cerTerminos_(pregunta);
  var ck = 'cer_q_' + cerHash_(pregunta), cache = CacheService.getScriptCache();
  try { var cv = cache.get(ck); vector = cv ? JSON.parse(cv) : cerEmbeddings_(c, [pregunta], 'RETRIEVAL_QUERY', { registrar: false })[0]; if (!cv) cache.put(ck, JSON.stringify(vector), 600); }
  catch (e) { console.error('cerebroBuscar_ huella: ' + e); vector = []; }   // sin huella, igual busca por palabras
  var filas;
  try { filas = cerConsulta_(c, cerSqlBuscar_(cerTablaSql_(c)), cerParamsBuscar_(audiencia, f0, vector, terminos), { timeoutMs: 10000, esperaMs: 15000 }); }
  catch (e) {
    console.error('cerebroBuscar_: ' + e);
    try { registrarUso_({ app: 'ALMA', funcion: 'Cerebro · búsqueda', detalle: audiencia + ' · error', modelo: cerModelo_(), usage: { input_tokens: tokens }, usd: tokens * 0.15 / 1e6, ms: Date.now() - t0, ok: false }); } catch (x) {}
    return { ok: false, error: String(e.message || e).slice(0, 200), pedazos: [] };
  }
  /* Segunda llave (además del WHERE del SQL): nada sale si su audiencia no incluye a quien pregunta. */
  var nSql = filas.length;
  filas = filas.filter(function (f) { return (f.audiencia || []).indexOf(audiencia) >= 0; });
  var vistos = {}, pedazos = filas.filter(function (f) { return cerEsPrueba_(f, terminos.length); }).filter(function (f) { var k = cerHash_(f.texto); return !vistos[k] && (vistos[k] = 1); })
    .map(function (f) { var p = { titulo: f.titulo, ruta: f.ruta, fuente: f.fuente, texto: f.texto };
      if (o.detalle) { p.doc_id = f.doc_id; p.audiencia = f.audiencia; p.distancia = f.distancia; p.aciertos = f.aciertos; } return p; });
  var ms = Date.now() - t0;
  try { registrarUso_({ app: 'ALMA', funcion: 'Cerebro · búsqueda', detalle: audiencia + ' · ' + pedazos.length + ' pedazos' + (pedazos.length ? '' : ' · sin prueba'), modelo: cerModelo_(), usage: { input_tokens: tokens }, usd: tokens * 0.15 / 1e6, ms: ms, ok: true }); } catch (e) {}
  /* El área del pedazo más cercano (si de verdad se parece) dice quién es el responsable cuando no hay prueba. */
  var cerca = filas.filter(function (f) { return f.aciertos >= 2 || (f.distancia != null && f.distancia <= 0.45); })[0];
  var out = { ok: true, sin_prueba: !pedazos.length, pedazos: pedazos, area_cercana: cerca ? cerca.area : '', ms: ms };
  if (o.detalle) { out.terminos = terminos.length; out.fugas_sql = nSql - filas.length;
    out.crudas = filas.map(function (f) { return { doc_id: f.doc_id, titulo: f.titulo, fuente: f.fuente, distancia: f.distancia, aciertos: f.aciertos }; }); }
  return out;
}

/* «Sin prueba» con alguien interno: la pregunta queda en Pendientes del responsable (el administrador principal), una vez cada 6 h. */
function cerPendienteSinPrueba_(pregunta, area, quien) {
  var cache = CacheService.getScriptCache(), k = 'cer_sp_' + cerHash_(cerTerminos_(pregunta).join(' ') || pregunta);
  if (cache.get(k)) return { ya: true };
  var jefe = adminsOp_().filter(function (a) { return a.principal; })[0]; if (!jefe) return null;
  var proyecto = CER_AREA_NOMBRE_[area] || 'Operaciones';
  var fila = pendCrear_(jefe, { tipo: 'atencion', area: 'proposito', proyecto: proyecto, importancia: 2, titulo: 'Sin respuesta en nuestros documentos: ' + String(pregunta).slice(0, 70),
    resumen: (quien ? quien + ' preguntó' : 'Preguntaron') + ' y Alma no encontró prueba en nuestros documentos (fichas, playbooks, conversaciones, correos ni Drive). Respóndela o agrega el dato donde corresponde.' },
    { origen: 'cerebro', detalle: 'Pregunta: ' + String(pregunta).slice(0, 1500) + (quien ? '\nQuién: ' + quien : ''), push: false });
  try { cache.put(k, '1', 21600); } catch (e) {}
  return fila ? { id: fila.id, para: jefe.nombre || 'Juan', proyecto: proyecto } : null;
}

/* La herramienta de Alma (secretaria, en el chat y en la voz). La audiencia sale de quién habla, nunca del modelo:
   el modelo solo puede ANGOSTAR la búsqueda (propiedad, fuente), nunca ampliar lo que se ve. */
function cerebroHerramientas_(T, s) {
  if (!cerebroActivo_()) return [];
  return [T('buscar_en_cerebro', 'Busca en el cerebro de Alma (fichas y memoria de las propiedades, playbooks de cada trabajo, conversaciones, correos y documentos de Drive) y devuelve los pedazos que lo prueban, con su fuente. ' +
    'Úsala ANTES de responder una pregunta sobre una propiedad o sobre cómo se hace algo. Responde solo con lo que devuelva y di de dónde lo sacaste. Si devuelve sin_prueba, dilo así y no inventes. ' +
    'Para códigos de acceso sigue usando codigo_acceso.',
    { pregunta: s('La pregunta, con sus palabras'), propiedad: s('Opcional: la propiedad, si la pregunta es de una'), fuente: { type: 'string', enum: CER_FUENTES_, description: 'Opcional: buscar solo en una fuente (fichas, playbooks, conversaciones, correos o Drive)' } }, ['pregunta'])];
}
function cerebroHerramienta_(adm, inp) {
  var aud = 'externo'; try { aud = audienciaDe_({ adm: adm }); } catch (e) {}
  var filtros = { fuente: inp && inp.fuente };
  if (inp && inp.propiedad) {
    try { var c0 = cerCtx_(), pn = c0.nombres.filter(function (x) { return cerNorm_(x) === cerNorm_(inp.propiedad); })[0] || bqMejor_(inp.propiedad, c0.nombres); if (pn) filtros.propiedad = pn; } catch (e) {}
  }
  return cerebroResponder_(inp && inp.pregunta, aud, filtros, (adm && adm.nombre) || '');
}
function cerebroResponder_(pregunta, audiencia, filtros, quien) {
  var r = cerebroBuscar_(pregunta, audiencia, filtros);
  if (!r.ok) return { ok: false, error: r.apagado ? 'El cerebro no está configurado: usa ver_propiedad, memoria_propiedad o leer_playbook.' : 'No pude buscar en el cerebro ahora (' + (r.error || 'error') + '): usa ver_propiedad, memoria_propiedad o leer_playbook.' };
  if (!r.sin_prueba) {
    /* El resultado de una herramienta se corta a 12.000 caracteres (agente.js): que quepan enteros, los mejores primero. */
    var resto = 10000, caben = r.pedazos.filter(function (p) { if (resto < 300) return false; if (p.texto.length > resto) p.texto = p.texto.slice(0, resto) + '…'; resto -= p.texto.length + 120; return true; });
    return { ok: true, instruccion: CER_INSTRUCCION_, pedazos: caben };
  }
  if (audiencia === 'principal' || audiencia === 'equipo') {
    var pd = null; try { pd = cerPendienteSinPrueba_(pregunta, r.area_cercana, quien); } catch (e) { console.error('cerPendienteSinPrueba_: ' + e); }
    return { ok: true, sin_prueba: true, pendiente: pd && pd.id ? pd.id : undefined,
      instruccion: 'No hay prueba en nuestros documentos. Dilo así: «No lo encontré en nuestros documentos». No inventes ni completes con lo que creas.' +
        (pd && (pd.id || pd.ya) ? ' Di también que la pregunta quedó en Pendientes' + (audiencia === 'principal' ? ' (' + (pd.proyecto || 'Operaciones') + ')' : ' para Juan') + '.' : '') };
  }
  /* Huésped o externo: como hoy cuando Alma no sabe algo (AMARILLO, «necesita equipo»): lo consulta con el equipo. */
  return { ok: true, sin_prueba: true, necesita_equipo: true, nivel: 'AMARILLO',
    instruccion: 'No está en nuestros documentos: no inventes. Dile «Ese dato no lo tengo a la mano. Lo confirmo con el equipo y te escribimos por aquí mismo.» y pásalo al equipo como cualquier AMARILLO.' };
}

/* ══ Acción del Hub «cerebro» (solo el administrador principal): estado y búsqueda de prueba. ════════════════════ */
function cerebroAccion_(ses, body) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  body = body || {};
  var que = String(body.que || 'estado');
  if (que === 'buscar') return cerebroBuscar_(body.pregunta, CER_AUDIENCIAS_.indexOf(body.audiencia) >= 0 ? body.audiencia : 'principal', body.filtros || {});   // prueba: no crea pendientes
  if (que === 'sincronizar') return cerebroSincronizar_();
  if (que === 'probar') return cerebroProbar_({ origen: 'hub' });
  return cerebroEstado_();
}
function cerebroEstado_() {
  var P = PropertiesService.getScriptProperties(), c = cerConfig_(), leer = function (k) { try { return JSON.parse(P.getProperty(k) || 'null'); } catch (e) { return null; } };
  var out = { ok: true, activo: !!c, falta: [!P.getProperty('BQ_PROYECTO') && 'BQ_PROYECTO', !c && P.getProperty('BQ_CUENTA') && 'BQ_CUENTA (no es una llave JSON válida)', !P.getProperty('BQ_CUENTA') && 'BQ_CUENTA'].filter(Boolean),
    ultima: leer('CER_ULTIMA'), en_curso: leer('CER_PASADA'), cuarentena: [], pedazos: [],
    fuentes: cerFuentesLista_(), areas: CER_AREAS_TRABAJO_, prueba: leer('CER_PRUEBA_ULTIMA'), umbral: cerUmbral_(), umbral_sugerido: Number(P.getProperty('CER_UMBRAL_SUGERIDO')) || null };
  try { var sh = ssAlma_().getSheetByName('ALMA_CEREBRO_CUARENTENA'); if (sh && sh.getLastRow() >= 2) out.cuarentena = sh.getRange(2, 1, sh.getLastRow() - 1, CER_CUAR_CAB_.length).getValues().map(function (r) { var o = {}; CER_CUAR_CAB_.forEach(function (k, i) { o[k] = String(r[i]); }); return o; }); } catch (e) {}
  if (!out.activo) return out;
  out.vertex = cerVertexListo_(c);   // '' si las huellas funcionan; si no, qué falta en Google Cloud
  try { out.activador = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cerebroSincronizar'; }); } catch (e) {}
  try {
    cerAsegurarTabla_(c);
    out.pedazos = cerConsulta_(c, "SELECT fuente, COUNT(1) AS pedazos, COUNT(DISTINCT doc_id) AS documentos, COUNTIF('externo' IN UNNEST(audiencia)) AS para_huespedes, MAX(actualizado) AS actualizado FROM " +
      cerTablaSql_(c) + ' GROUP BY fuente ORDER BY fuente', [], { cache: false });
  } catch (e) { out.error = String(e.message || e).slice(0, 300); }
  return out;
}
