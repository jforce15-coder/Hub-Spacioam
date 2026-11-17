/* ═══ MUDADOR · traslado de los Apps Script a alma@spacioam.com (spec docs/specs/traslado-workspace.md, issue #546) ═══
   Juan lo crea UNA vez en script.google.com con la cuenta alma@ (pega este archivo en Código.gs y traslado/appsscript.json
   en el manifiesto), corre «empezar» y toca Permitir. Desde ahí trabaja solo:
   · empezar()            Crea la llave del Mudador (la muestra UNA vez en el registro, para el secreto MUDADOR_LLAVE de
                          GitHub), se publica a sí mismo como app web y muestra su URL (secreto MUDADOR_URL).
   · accion «publicar»    (llave) Crea el proyecto si no existe (idempotente: guarda su scriptId), le sube el código que
                          manda el workflow traslado.yml, crea versión y crea o actualiza su app web. Mientras las Propiedades
                          no se hayan traído, agrega el archivo «traslado_traer» con una llave de UN solo uso.
   · accion «traer»       (llave de un solo uso) La pide el proyecto nuevo cuando Juan corre «trasladoTraer». El Mudador le
                          pide las Propiedades al proyecto VIEJO (que solo las entrega a alma@: token de identidad de Google)
                          y se las pasa por HTTPS. Nunca quedan en GitHub, en el chat ni en el registro.
   · accion «estado»      (llave) Qué proyectos hay, su URL, versión y lo último que pasó. Sin llaves.
   · accion «actualizar_mudador» (llave) Se sube su propio código nuevo (así Juan no lo vuelve a pegar).
   Nunca escribe una llave ni un valor de Propiedad en el registro, salvo la llave nueva en empezar() una sola vez. */

var MUD_API_ = 'https://script.googleapis.com/v1';
var MUD_TRAER_HORAS_ = 48;          // la llave de un solo uso vence a las 48 h
var MUD_TRAER_INTENTOS_ = 5;        // intentos fallidos antes de quemarla
var MUD_REGISTRO_MAX_ = 40;
var MUD_AVISO_VERSIONES_ = 180;     // Google permite 200 versiones por proyecto
var MUD_PROYECTO_RE_ = /^[a-z][a-z0-9_-]{1,30}$/;

/* ── Lo que Juan corre ── */
function empezar() {
  var sp = PropertiesService.getScriptProperties();
  var nueva = false;
  if (!sp.getProperty('MUDADOR_LLAVE')) { sp.setProperty('MUDADOR_LLAVE', mudLlaveNueva_()); nueva = true; }
  var url = sp.getProperty('MUDADOR_URL');
  if (!url) url = mudPublicarseASiMismo_();
  var identidad = '';
  try { identidad = ScriptApp.getIdentityToken() ? 'lista' : 'falta'; } catch (e) { identidad = 'falta'; }
  console.log('1) Secreto MUDADOR_URL en GitHub:\n' + url);
  if (nueva) console.log('2) Secreto MUDADOR_LLAVE en GitHub (se muestra solo esta vez):\n' + sp.getProperty('MUDADOR_LLAVE'));
  else console.log('2) La llave ya existía y no se vuelve a mostrar. Si se perdió, corre nuevaLlave.');
  console.log('Identidad para traer Propiedades: ' + identidad + '. Cuenta: ' + Session.getEffectiveUser().getEmail());
  mudRegistrar_('empezar', '', true, nueva ? 'llave nueva' : 'ya estaba');
}

/* Cambia la llave (si se filtró o se perdió). Hay que volver a pegarla en el secreto MUDADOR_LLAVE. */
function nuevaLlave() {
  PropertiesService.getScriptProperties().setProperty('MUDADOR_LLAVE', mudLlaveNueva_());
  console.log('Llave nueva para el secreto MUDADOR_LLAVE (se muestra solo esta vez):\n' +
    PropertiesService.getScriptProperties().getProperty('MUDADOR_LLAVE'));
  mudRegistrar_('nueva_llave', '', true, '');
}

/* ── App web ── */
function doGet() { return mudSalida_({ ok: true, mudador: true }); }

function doPost(e) {
  var p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return mudSalida_({ ok: false, error: 'json' }); }
  try {
    if (p.accion === 'traer') return mudSalida_(mudTraer_(p));
    if (!mudLlaveOk_(p.llave)) { Utilities.sleep(800); return mudSalida_({ ok: false, error: 'llave' }); }
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (p.accion === 'publicar') return mudSalida_(mudPublicar_(p));
      if (p.accion === 'estado') return mudSalida_(mudEstadoTodo_());
      if (p.accion === 'actualizar_mudador') return mudSalida_(mudActualizarse_(p));
      return mudSalida_({ ok: false, error: 'accion_desconocida' });
    } finally { lock.releaseLock(); }
  } catch (err) {
    mudRegistrar_(String(p.accion || ''), String(p.proyecto || ''), false, mudTexto_(err));
    return mudSalida_({ ok: false, error: mudTexto_(err) });
  }
}

/* ── publicar: crear si falta, subir, versión, app web ── */
function mudPublicar_(p) {
  var nombre = String(p.proyecto || '');
  if (!MUD_PROYECTO_RE_.test(nombre)) return { ok: false, error: 'proyecto' };
  var archivos = mudArchivosValidos_(p.archivos);
  if (!archivos) return { ok: false, error: 'archivos (falta appsscript o hay un tipo raro)' };
  var st = mudEstado_(nombre) || {};
  var creado = false;
  if (!st.scriptId) {
    if (!p.crear) return { ok: false, error: 'no_existe (manda crear: true la primera vez)' };
    var nuevo = mudApi_('post', '/projects', { title: String(p.titulo || nombre).slice(0, 80) });
    st = { scriptId: nuevo.scriptId, creado: new Date().toISOString() };
    creado = true;
    mudGuardarEstado_(nombre, st);   // guardado enseguida: si algo falla después, el siguiente intento no crea otro
  }
  st.viejo = p.viejo ? String(p.viejo) : (st.viejo || '');
  st.copiar = p.copiar || st.copiar || 'todas';
  st.excluir = p.excluir || st.excluir || [];
  st.al_traer = p.al_traer || st.al_traer || [];

  if (!creado && st.sha && st.sha === p.sha && st.deploymentId && (st.traido || !st.viejo) && !p.forzar) {
    mudRegistrar_('publicar', nombre, true, 'sin cambios ' + String(p.sha).slice(0, 7));
    return { ok: true, sin_cambios: true, url: st.url, version: st.version, traido: !!st.traido };
  }

  var subir = archivos.slice();
  if (!st.traido && st.viejo) {
    var k = mudLlaveNueva_();
    st.kHash = mudHash_(k);
    st.kVence = Date.now() + MUD_TRAER_HORAS_ * 3600000;
    st.kFallos = 0;
    subir.push({ name: 'traslado_traer', type: 'SERVER_JS', source: mudArchivoTraer_(nombre, k, st.al_traer) });
  }
  mudApi_('put', '/projects/' + st.scriptId + '/content', { files: subir });
  var desc = (String(p.sha || '').slice(0, 7) + ' ' + String(p.mensaje || 'Mudador')).slice(0, 90);
  var ver = mudApi_('post', '/projects/' + st.scriptId + '/versions', { description: desc }).versionNumber;
  var cfg = { scriptId: st.scriptId, versionNumber: ver, manifestFileName: 'appsscript', description: desc };
  var dep;
  if (st.deploymentId) dep = mudApi_('put', '/projects/' + st.scriptId + '/deployments/' + st.deploymentId, { deploymentConfig: cfg });
  else dep = mudApi_('post', '/projects/' + st.scriptId + '/deployments', { versionNumber: ver, manifestFileName: 'appsscript', description: desc });
  st.deploymentId = dep.deploymentId || st.deploymentId;
  st.url = mudUrlDe_(dep) || st.url || ('https://script.google.com/macros/s/' + st.deploymentId + '/exec');
  st.version = ver;
  st.sha = String(p.sha || '');
  st.publicado = new Date().toISOString();
  mudGuardarEstado_(nombre, st);
  var avisos = [];
  if (ver >= MUD_AVISO_VERSIONES_) avisos.push('El proyecto lleva ' + ver + ' de 200 versiones: hay que borrar las viejas.');
  if (!st.traido && st.viejo) avisos.push('Falta que Juan corra trasladoTraer en el proyecto nuevo (copia las Propiedades y da los permisos).');
  mudRegistrar_('publicar', nombre, true, (creado ? 'creado, ' : '') + 'versión ' + ver);
  return { ok: true, creado: creado, scriptId: st.scriptId, editar: 'https://script.google.com/d/' + st.scriptId + '/edit',
    url: st.url, version: ver, traido: !!st.traido, avisos: avisos };
}

function mudArchivosValidos_(lista) {
  if (!lista || !lista.length) return null;
  var tipos = { SERVER_JS: 1, HTML: 1, JSON: 1 }, manifiesto = false, out = [];
  for (var i = 0; i < lista.length; i++) {
    var a = lista[i] || {};
    if (!tipos[a.type] || typeof a.name !== 'string' || !a.name || typeof a.source !== 'string') return null;
    if (a.type === 'JSON' && a.name !== 'appsscript') return null;
    if (a.name === 'traslado_traer') continue;   // ese nombre es del Mudador
    if (a.name === 'appsscript') manifiesto = true;
    out.push({ name: a.name, type: a.type, source: a.source });
  }
  return manifiesto ? out : null;
}

function mudUrlDe_(dep) {
  var eps = (dep && dep.entryPoints) || [];
  for (var i = 0; i < eps.length; i++) if (eps[i].webApp && eps[i].webApp.url) return eps[i].webApp.url;
  return '';
}

/* ── traer: el proyecto nuevo pide las Propiedades del viejo con su llave de un solo uso ── */
function mudTraer_(p) {
  var nombre = String(p.proyecto || '');
  if (!MUD_PROYECTO_RE_.test(nombre)) return { ok: false, error: 'proyecto' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var st = mudEstado_(nombre);
    if (!st || !st.kHash) return { ok: false, error: 'sin_llave (ya se trajeron o no hay proyecto)' };
    if (Date.now() > st.kVence) { st.kHash = ''; mudGuardarEstado_(nombre, st); return { ok: false, error: 'llave_vencida (vuelve a publicar)' }; }
    if (!mudIgual_(mudHash_(String(p.llave || '')), st.kHash)) {
      st.kFallos = (st.kFallos || 0) + 1;
      if (st.kFallos >= MUD_TRAER_INTENTOS_) st.kHash = '';
      mudGuardarEstado_(nombre, st);
      Utilities.sleep(800);
      return { ok: false, error: 'llave' };
    }
    var r = mudPedirAlViejo_(st.viejo);
    if (!r.ok) { mudRegistrar_('traer', nombre, false, r.error); return r; }
    var props = mudFiltrar_(r.propiedades || {}, st.copiar, st.excluir);
    st.kHash = ''; st.traido = new Date().toISOString(); st.sha = '';   // sha vacío: la próxima publicación quita traslado_traer
    mudGuardarEstado_(nombre, st);
    mudRegistrar_('traer', nombre, true, Object.keys(props).length + ' propiedades');
    return { ok: true, propiedades: props, al_traer: st.al_traer || [] };
  } finally { lock.releaseLock(); }
}

function mudPedirAlViejo_(url) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(url || ''))) return { ok: false, error: 'viejo (URL rara)' };
  var tok = ScriptApp.getIdentityToken();
  if (!tok) return { ok: false, error: 'sin_identidad (el manifiesto necesita openid y userinfo.email)' };
  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ traslado: 'entregar', id_token: tok }) });
  var j = null;
  try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!j) return { ok: false, error: 'viejo respondió ' + res.getResponseCode() + ' sin JSON (¿ya tiene traslado.js publicado?)' };
  if (!j.ok) return { ok: false, error: 'viejo: ' + String(j.error || 'no') };
  return { ok: true, propiedades: j.propiedades || {} };
}

/* copiar: 'todas' o lista de nombres (un * al final = prefijo). excluir: igual, se aplica después. */
function mudFiltrar_(props, copiar, excluir) {
  var calza = function (lista, k) {
    for (var i = 0; i < lista.length; i++) {
      var x = String(lista[i]);
      if (x.slice(-1) === '*' ? k.indexOf(x.slice(0, -1)) === 0 : k === x) return true;
    }
    return false;
  };
  var out = {};
  Object.keys(props).forEach(function (k) {
    if (copiar !== 'todas' && !calza(copiar || [], k)) return;
    if (calza(excluir || [], k)) return;
    out[k] = String(props[k]);
  });
  return out;
}

/* El archivo que se agrega al proyecto nuevo. Juan corre trasladoTraer: pide los permisos de TODO el proyecto (una vez),
   copia las Propiedades que faltan (nunca pisa una que ya está) y corre lo de instalar (activadores). */
function mudArchivoTraer_(nombre, k, alTraer) {
  var url = PropertiesService.getScriptProperties().getProperty('MUDADOR_URL') || '';
  return [
    '/* Lo puso el Mudador (alma@). Corre trasladoTraer una vez: copia las Propiedades del script viejo y da los permisos.',
    '   Se borra solo en la próxima publicación. La llave de abajo sirve una sola vez y vence en ' + MUD_TRAER_HORAS_ + ' h. */',
    'var TRASLADO_TRAER_ = ' + JSON.stringify({ url: url, proyecto: nombre, llave: k, al_traer: alTraer || [] }) + ';',
    'function trasladoTraer() {',
    '  var c = TRASLADO_TRAER_, o = { method: "post", contentType: "text/plain", muteHttpExceptions: true, followRedirects: true,',
    '    payload: JSON.stringify({ accion: "traer", proyecto: c.proyecto, llave: c.llave }) };',
    '  var res = typeof uf_ === "function" ? uf_(c.url, o, "traslado") : UrlFetchApp.fetch(c.url, o);',
    '  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}',
    '  if (!j.ok) throw new Error("No se pudo traer: " + (j.error || res.getResponseCode()));',
    '  var sp = PropertiesService.getScriptProperties(), ya = sp.getProperties(), nuevas = {}, nombres = [];',
    '  Object.keys(j.propiedades || {}).forEach(function (n) { if (ya[n] == null || ya[n] === "") { nuevas[n] = j.propiedades[n]; nombres.push(n); } });',
    '  if (nombres.length) sp.setProperties(nuevas, false);',
    '  console.log("Propiedades copiadas: " + nombres.length + (nombres.length ? " (" + nombres.join(", ") + ")" : "") +',
    '    ". Ya estaban: " + (Object.keys(j.propiedades || {}).length - nombres.length));',
    '  (j.al_traer || []).forEach(function (f) {',
    '    try { if (typeof globalThis[f] === "function") { globalThis[f](); console.log("Corrió " + f); } }',
    '    catch (e) { console.log("Falló " + f + ": " + e.message); }',
    '  });',
    '  console.log("Listo. Avísale a Claude.");',
    '}',
    ''
  ].join('\n');
}

/* ── El Mudador se actualiza a sí mismo (sin que Juan vuelva a pegar) ── */
function mudActualizarse_(p) {
  var archivos = mudArchivosValidos_(p.archivos);
  if (!archivos) return { ok: false, error: 'archivos' };
  var yo = ScriptApp.getScriptId();
  var sp = PropertiesService.getScriptProperties();
  mudApi_('put', '/projects/' + yo + '/content', { files: archivos });
  var desc = (String(p.sha || '').slice(0, 7) + ' Mudador').slice(0, 90);
  var ver = mudApi_('post', '/projects/' + yo + '/versions', { description: desc }).versionNumber;
  var dep = sp.getProperty('MUDADOR_DEPLOY');
  mudApi_('put', '/projects/' + yo + '/deployments/' + dep,
    { deploymentConfig: { scriptId: yo, versionNumber: ver, manifestFileName: 'appsscript', description: desc } });
  mudRegistrar_('actualizar_mudador', '', true, 'versión ' + ver);
  return { ok: true, version: ver };
}

function mudPublicarseASiMismo_() {
  var yo = ScriptApp.getScriptId(), sp = PropertiesService.getScriptProperties();
  var ver = mudApi_('post', '/projects/' + yo + '/versions', { description: 'Mudador' }).versionNumber;
  var dep = mudApi_('post', '/projects/' + yo + '/deployments', { versionNumber: ver, manifestFileName: 'appsscript', description: 'Mudador' });
  var url = mudUrlDe_(dep) || ('https://script.google.com/macros/s/' + dep.deploymentId + '/exec');
  sp.setProperties({ MUDADOR_DEPLOY: dep.deploymentId, MUDADOR_URL: url }, false);
  return url;
}

/* ── Estado y registro (sin llaves: el hash de la de un solo uso nunca sale) ── */
function mudEstado_(nombre) {
  var t = PropertiesService.getScriptProperties().getProperty('MUD_P_' + nombre);
  return t ? JSON.parse(t) : null;
}
function mudGuardarEstado_(nombre, st) { PropertiesService.getScriptProperties().setProperty('MUD_P_' + nombre, JSON.stringify(st)); }

function mudEstadoTodo_() {
  var todo = PropertiesService.getScriptProperties().getProperties(), proyectos = {};
  Object.keys(todo).forEach(function (k) {
    if (k.indexOf('MUD_P_') !== 0) return;
    var s = JSON.parse(todo[k]);
    proyectos[k.slice(6)] = { scriptId: s.scriptId, url: s.url, version: s.version, sha: s.sha, publicado: s.publicado,
      traido: s.traido || false, esperando_traer: !!s.kHash, editar: 'https://script.google.com/d/' + s.scriptId + '/edit' };
  });
  var reg = [];
  try { reg = JSON.parse(todo.MUD_REGISTRO || '[]'); } catch (e) {}
  return { ok: true, cuenta: Session.getEffectiveUser().getEmail(), proyectos: proyectos, registro: reg };
}

function mudRegistrar_(accion, proyecto, ok, nota) {
  try {
    var sp = PropertiesService.getScriptProperties(), reg = [];
    try { reg = JSON.parse(sp.getProperty('MUD_REGISTRO') || '[]'); } catch (e) {}
    reg.push({ t: new Date().toISOString(), accion: accion, proyecto: proyecto, ok: ok, nota: String(nota || '').slice(0, 200) });
    sp.setProperty('MUD_REGISTRO', JSON.stringify(reg.slice(-MUD_REGISTRO_MAX_)));
    console.log([accion, proyecto, ok ? 'ok' : 'falló', nota].join(' · '));
  } catch (e) {}
}

/* ── Apps Script API con el token de alma@ ── */
function mudApi_(metodo, ruta, cuerpo) {
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (cuerpo !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  var res = UrlFetchApp.fetch(MUD_API_ + ruta, o), code = res.getResponseCode(), j = {};
  try { j = JSON.parse(res.getContentText() || '{}'); } catch (e) {}
  if (code >= 200 && code < 300) return j;
  var msg = (j.error && j.error.message) || ('HTTP ' + code);
  if (code === 403 && /Apps Script API|has not been used|disabled/i.test(msg))
    msg = 'Activa la API de Apps Script de alma@ en script.google.com/home/usersettings (' + msg.slice(0, 120) + ')';
  throw new Error('API ' + metodo.toUpperCase() + ' ' + ruta.replace(/\/projects\/[^/]+/, '/projects/…') + ': ' + msg);
}

/* ── Utilidades ── */
function mudLlaveNueva_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function mudHash_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function mudIgual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function mudLlaveOk_(llave) {
  var guardada = PropertiesService.getScriptProperties().getProperty('MUDADOR_LLAVE');
  return !!guardada && mudIgual_(mudHash_(String(llave || '')), mudHash_(guardada));
}
function mudTexto_(err) {
  return String((err && err.message) || err).replace(/Bearer\s+\S+/g, 'Bearer …').slice(0, 300);
}
function mudSalida_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
