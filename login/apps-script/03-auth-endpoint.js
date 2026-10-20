/**********************************************************************
 * SPACIO AM · CONTROL DE USUARIOS UNIFICADO
 * 03 · AUTH — endpoint compartido (login + perfil + escritura + equipo)
 * --------------------------------------------------------------------
 * Este es el ÚNICO punto por el que las 4 apps hablan con la hoja.
 * Pégalo en el Apps Script de la hoja «Control de usuarios» y publícalo
 * como App Web:  Implementar › Nueva implementación › App web
 *   · Ejecutar como: **yo (jforce15@gmail.com)**
 *   · Con acceso a:  Cualquier usuario
 * Copia la URL /exec resultante: es SA_AUTH_URL para las apps.
 *
 * Protocolo: POST con JSON { action, token, ... }.
 * Token compartido para evitar llamadas anónimas de terceros.
 *
 * Acciones:
 *   login        { email, password }        -> perfil + apps permitidas
 *   profile      { email }                   -> perfil (sin hash)
 *   users        { app }                     -> equipo con permiso en esa app (Grow lo usa como única fuente)
 *   owners       { }                         -> propietarios/socios de TODA la hoja (es_dueno o es_socio),
 *                                               sin importar en qué app tengan permiso
 *   addUser      { by, email, nombre, app, rol } -> crea (o da permiso a) un usuario desde la app; solo un
 *                                               Administrador principal de esa app puede hacerlo
 *   setInitialPassword { email, next }       -> fija contraseña en el primer ingreso
 *   setPassword  { email, current, next }    -> cambia contraseña (todas las apps)
 *   setEmail     { email, next }             -> cambia correo
 *   setPhoto     { email, url }              -> guarda link de foto
 *
 * La respuesta SIEMPRE incluye { ok:true/false }. Nunca devuelve el hash.
 **********************************************************************/

// Llave compartida con las apps. Se puede cambiar sin tocar el código con la propiedad AUTH_TOKEN (fase 3).
var AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty('AUTH_TOKEN') || 'SpacioAM2026!';
var ROLES_ADMIN = ['admin_principal', 'admin_secundario'];
var SHEET_TAB  = 'Usuarios';
var APP_KEYS   = ['mi','epi','grow','hola'];
// ID de la hoja «Control de usuarios» (proyecto independiente → openById).
var CONTROL_SHEET_ID = '1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U';

function doPost(e){
  var out = _handle(e);
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
// GET solo para prueba rápida de que la implementación responde
function doGet(){
  return ContentService.createTextOutput(JSON.stringify({ok:true, service:'sa-auth'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function _handle(e){
  try{
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if(body.token !== AUTH_TOKEN) return {ok:false, error:'token'};
    var ses = body.session ? _verificarSesion(body.session) : null;   // sesión firmada (si la app ya la envía)
    switch(body.action){
      case 'login':       return _login(body.email, body.password);
      case 'verify':      return _verify(body.session);
      case 'hoja':        return _hoja(ses, body.q);
      case 'profile':     return _profile(body.email);
      case 'users':       return _users(body.app);
      case 'owners':      return _owners();
      case 'addUser':     return _addUser(ses ? ses.e : body.by, body.email, body.nombre, body.app, body.rol, !!ses);
      case 'setInitialPassword': return _setInitialPassword(body.email, body.next);
      case 'setPassword': return _setPassword(body.email, body.current, body.next);
      case 'setEmail':    return _setEmail(body.email, body.next);
      case 'setPhoto':    return _setPhoto(body.email, body.url);
      default:            return {ok:false, error:'action'};
    }
  }catch(err){ return {ok:false, error:String(err)}; }
}

// ---- lectura ----
function _sheet(){ return SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheetByName(SHEET_TAB); }
function _all(){
  var sh=_sheet(), data=sh.getDataRange().getValues(), head=data[0], H={};
  head.forEach(function(c,i){ H[String(c).trim()]=i; });
  return {sh:sh, data:data, H:H};
}
function _findRow(email){
  var d=_all(), key=String(email||'').toLowerCase();
  for(var i=1;i<d.data.length;i++){
    if(String(d.data[i][d.H.email]).toLowerCase()===key) return {i:i, d:d};
  }
  return null;
}
function _publicProfile(row, H){
  var apps={};
  APP_KEYS.forEach(function(a){ var v=row[H['perm_'+a]]; if(v) apps[a]=v; });
  return {
    user_id: row[H.user_id], nombre: row[H.nombre], email: row[H.email],
    primer_nombre: row[H.primer_nombre] || "", segundo_nombre: row[H.segundo_nombre] || "",
    primer_apellido: row[H.primer_apellido] || "", segundo_apellido: row[H.segundo_apellido] || "",
    email_alterno: row[H.email_alterno]||'', foto: row[H.foto]||'',
    estado: row[H.estado], es_dueno: row[H.es_dueno]==='sí',
    es_socio: row[H.es_socio]==='sí', apps: apps
  };
}

function _login(email, password){
  if(_bloqueado(email)) return {ok:false, error:'too_many', detail:'Demasiados intentos. Espera 15 minutos.'};
  var f=_findRow(email); if(!f){ _fallo(email); return {ok:false, error:'no_user'}; }
  var row=f.d.data[f.i], H=f.d.H;
  if(row[H.estado]==='suspendido') return {ok:false, error:'suspended'};
  var hash=String(row[H.password_hash]||'');
  // password_hash vacío → primer ingreso: la app debe pedir crear contraseña
  if(!hash) return {ok:false, error:'needs_password', profile:_publicProfile(row, H)};
  if(!_claveOk(hash, password)){ _fallo(email); return {ok:false, error:'bad_pass'}; }
  _limpiarFallos(email);
  if(!_esHashNuevo(hash) || Number(String(hash).split('$')[2]) !== VUELTAS){   // hash antiguo o con otras vueltas: se actualiza
    try{ f.d.sh.getRange(f.i+1, H.password_hash+1).setValue(_hashClave(password)); }catch(e){}
  }
  var prof=_publicProfile(row, H);
  return {ok:true, profile:prof, session:_firmarSesion(prof)};
}
function _verify(session){
  var s=_verificarSesion(session); if(!s) return {ok:false, error:'session'};
  var f=_findRow(s.e); if(!f) return {ok:false, error:'no_user'};
  var row=f.d.data[f.i]; if(row[f.d.H.estado]==='suspendido') return {ok:false, error:'suspended'};
  var prof=_publicProfile(row, f.d.H);
  // Renueva la sesión (perfil al día, 30 días más) solo si es del formato anterior o tiene más de un día:
  // así no cambia en cada comprobación y los backends aprovechan su caché.
  var renovar = !s.p || (Date.now() - (s.iat||0) > 86400000);
  return {ok:true, profile:prof, exp:s.exp, session: renovar ? _firmarSesion(prof) : undefined};
}
function _profile(email){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  return {ok:true, profile:_publicProfile(f.d.data[f.i], f.d.H)};
}

// Lista de usuarios con permiso en una app (por defecto grow). Es la única
// fuente del equipo para Grow: miembros de proyecto, asignación de visitas,
// responsables y menciones. Nunca devuelve el hash. Omite suspendidos.
function _users(app){
  app = String(app || 'grow').toLowerCase();
  if (APP_KEYS.indexOf(app) < 0) return {ok:false, error:'app'};
  var d = _all(), users = [];
  for (var i = 1; i < d.data.length; i++){
    var row = d.data[i], H = d.H;
    var email = String(row[H.email] || '').trim().toLowerCase();
    if (!email) continue;
    if (row[H.estado] === 'suspendido') continue;
    var rol = String(row[H['perm_' + app]] || '').trim();
    if (!rol) continue;                       // sin acceso a esta app
    var p = _publicProfile(row, H);
    users.push({ user_id: p.user_id, email: email, nombre: p.nombre, foto: p.foto, es_dueno: p.es_dueno, rol: rol, apps: p.apps });
  }
  return {ok:true, users: users};
}

// Alta de usuario desde una app (Grow: «Equipo del proyecto»). Si el correo ya
// existe solo se le da/actualiza el permiso en esa app; si no, se crea la fila con
// estado activo y sin contraseña (la fija en su primer ingreso). Quien lo pide
// debe ser Administrador principal de la misma app.
function _addUser(by, email, nombre, app, rol, conSesion){
  app = String(app || 'grow').toLowerCase();
  if (APP_KEYS.indexOf(app) < 0) return {ok:false, error:'app'};
  rol = String(rol || '').trim();
  if (!rol) return {ok:false, error:'rol'};
  // La columna perm_* tiene validación de datos con códigos fijos; las etiquetas legibles se traducen.
  var ROL_MAP = { 'administrador principal':'admin_principal', 'admin principal':'admin_principal', 'admin. principal':'admin_principal', 'principal':'admin_principal',
                  'administrador secundario':'admin_secundario', 'admin secundario':'admin_secundario', 'admin. secundario':'admin_secundario', 'secundario':'admin_secundario',
                  'técnico':'personal_campo', 'tecnico':'personal_campo', 'personal de campo':'personal_campo',
                  'compras y montaje':'compras_montaje', 'compras':'compras_montaje', 'dueño':'dueno', 'propietario':'dueno' };
  var codigo = ROL_MAP[rol.toLowerCase()] || rol.toLowerCase().replace(/\s+/g, '_');
  var ok = ['admin_principal','admin_secundario','personal_campo','compras_montaje','dueno'];
  if (ok.indexOf(codigo) < 0) return {ok:false, error:'rol'};
  rol = codigo;
  // Dar acceso de administrador exige una sesión firmada de un admin principal: sin ella, cualquiera que
  // conozca la llave compartida (está en el código público) podía hacerse administrador.
  if (ROLES_ADMIN.indexOf(rol) >= 0 && !conSesion) return {ok:false, error:'session_required'};
  var solicitante = _findRow(by);
  if (!solicitante) return {ok:false, error:'no_user'};
  var permBy = String(solicitante.d.data[solicitante.i][solicitante.d.H['perm_' + app]] || '');
  if (!/principal/i.test(permBy)) return {ok:false, error:'forbidden'};
  email = String(email || '').trim().toLowerCase();
  if (email.indexOf('@') < 0) return {ok:false, error:'bad_email'};
  var f = _findRow(email), sh, H, i;
  if (f){
    // Ya existe: solo se da/actualiza el permiso. El nombre se conserva tal como está.
    sh = f.d.sh; H = f.d.H; i = f.i;
    var prev = String(f.d.data[i][H['perm_' + app]] || '');
    // Un acceso de equipo (principal/secundario/campo/compras) no se degrada a 'dueno'.
    if (!conSesion && ROLES_ADMIN.indexOf(prev) >= 0) return {ok:false, error:'session_required'};   // sin sesión no se toca a un admin
    if (!(rol === 'dueno' && prev && prev !== 'dueno')) sh.getRange(i+1, H['perm_' + app]+1).setValue(rol);
    if (rol === 'dueno' && String(f.d.data[i][H.es_dueno] || '') !== 'sí') sh.getRange(i+1, H.es_dueno+1).setValue('sí');
    if (nombre && !String(f.d.data[i][H.nombre] || '').trim()) sh.getRange(i+1, H.nombre+1).setValue(String(nombre).trim());
    if (String(f.d.data[i][H.estado] || '') === 'suspendido') sh.getRange(i+1, H.estado+1).setValue('activo');
    _touch(sh, H, i);
    return {ok:true, created:false, kept: (rol === 'dueno' && prev && prev !== 'dueno') ? prev : '', profile:_publicProfile(sh.getRange(i+1,1,1,sh.getLastColumn()).getValues()[0], H)};
  }
  if (!String(nombre || '').trim()) return {ok:false, error:'needs_name'};
  var d = _all(); sh = d.sh; H = d.H;
  nombre = String(nombre || '').trim() || email.split('@')[0];
  var partes = nombre.split(/\s+/);
  var row = [];
  for (var k = 0; k < sh.getLastColumn(); k++) row.push('');
  var set = function(col, v){ if (H[col] != null) row[H[col]] = v; };
  set('user_id', 'U-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  set('nombre', nombre); set('email', email);
  set('primer_nombre', partes[0] || ''); set('primer_apellido', partes.length > 1 ? partes[partes.length - 1] : '');
  set('estado', 'activo'); set('es_dueno', rol === 'dueno' ? 'sí' : 'no'); set('es_socio', 'no');
  set('perm_' + app, rol); set('password_hash', ''); set('actualizado', new Date());
  sh.appendRow(row);
  return {ok:true, created:true, profile:_publicProfile(row, H)};
}

// Propietarios y socios de toda la hoja. A diferencia de _users, NO filtra por permiso
// de app: un dueño suele tener acceso solo al dashboard (perm_mi) y aun así debe poder
// vincularse a un proyecto en Grow.
function _owners(){
  var d = _all(), out = [];
  for (var i = 1; i < d.data.length; i++){
    var row = d.data[i], H = d.H;
    var email = String(row[H.email] || '').trim().toLowerCase();
    if (!email) continue;
    if (row[H.estado] === 'suspendido') continue;
    if (row[H.es_dueno] !== 'sí' && row[H.es_socio] !== 'sí') continue;
    var p = _publicProfile(row, H);
    out.push({ user_id: p.user_id, email: email, nombre: p.nombre, primer_nombre: p.primer_nombre, primer_apellido: p.primer_apellido,
               foto: p.foto, es_dueno: p.es_dueno, es_socio: p.es_socio, email_alterno: p.email_alterno });
  }
  return {ok:true, owners: out};
}

// ---- escritura (aplica a TODAS las apps a la vez) ----
function _touch(sh, H, i){ sh.getRange(i+1, H.actualizado+1).setValue(new Date()); }

// Primer ingreso: fija la contraseña SOLO si el hash está vacío.
function _setInitialPassword(email, next){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  var row=f.d.data[f.i], H=f.d.H, sh=f.d.sh;
  if(String(row[H.password_hash]||'')) return {ok:false, error:'already_set'};
  if(!next || String(next).length<8) return {ok:false, error:'weak'};
  sh.getRange(f.i+1, H.password_hash+1).setValue(_hashClave(next));
  _touch(sh,H,f.i);
  var prof=_publicProfile(row, H);
  return {ok:true, profile:prof, session:_firmarSesion(prof)};
}

function _setPassword(email, current, next){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  var row=f.d.data[f.i], H=f.d.H, sh=f.d.sh;
  if(_bloqueado(email)) return {ok:false, error:'too_many'};
  if(!_claveOk(String(row[H.password_hash]||''), current)){ _fallo(email); return {ok:false, error:'bad_current'}; }
  if(!next || String(next).length<8) return {ok:false, error:'weak'};
  sh.getRange(f.i+1, H.password_hash+1).setValue(_hashClave(next));
  _touch(sh,H,f.i);
  return {ok:true};
}
function _setEmail(email, next){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  if(!next || String(next).indexOf('@')<0) return {ok:false, error:'bad_email'};
  if(_findRow(next)) return {ok:false, error:'email_taken'};
  var sh=f.d.sh, H=f.d.H;
  sh.getRange(f.i+1, H.email+1).setValue(String(next).trim());
  _touch(sh,H,f.i);
  return {ok:true};
}
function _setPhoto(email, url){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  var sh=f.d.sh, H=f.d.H;
  sh.getRange(f.i+1, H.foto+1).setValue(String(url||'').trim());
  _touch(sh,H,f.i);
  return {ok:true};
}

// mismo hash que el importador
function sha256(txt){
  var raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(txt), Utilities.Charset.UTF_8);
  return raw.map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
}

/* ═══ SEGURIDAD (fase 1, oct 2026) ═══════════════════════════════════════════
   · Contraseñas con sal: 'v2$<sal>$<hash>' = HMAC-SHA256 iterado (200 vueltas; cada vuelta en Apps Script es lenta). Las antiguas (SHA-256 sin
     sal, 64 hex) siguen valiendo y se convierten solas en el siguiente ingreso correcto.
   · Sesión firmada: el login devuelve "session" = base64url(datos) + '.' + base64url(HMAC-SHA256) con una
     clave secreta (propiedad SESSION_SECRET, se crea sola). No se puede fabricar desde el navegador.
     verify { session } la comprueba y devuelve el perfil vigente; las demás apps la usarán en la fase 1b.
   · Intentos: 5 contraseñas erróneas seguidas bloquean ese correo 15 minutos.
   ════════════════════════════════════════════════════════════════════════ */
var SESION_DIAS = 30, VUELTAS = 200;
function _hex(bytes){ return bytes.map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join(''); }
function _b64u(bytes){ return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,''); }
function _esHashNuevo(h){ return /^v2\$/.test(String(h)); }
function _derivar(clave, sal, vueltas){
  var k=Utilities.computeHmacSha256Signature(String(clave), String(sal), Utilities.Charset.UTF_8), acc=k.slice();
  for (var i=1; i<vueltas; i++){
    k=Utilities.computeHmacSha256Signature(k, Utilities.newBlob(String(sal)).getBytes());
    for (var j=0; j<acc.length; j++) acc[j]^=k[j];
  }
  return _hex(acc);
}
function _hashClave(clave){
  var sal=Utilities.getUuid().replace(/-/g,'').slice(0,16);
  return 'v2$'+sal+'$'+VUELTAS+'$'+_derivar(clave, sal, VUELTAS);
}
function _iguales(a, b){ a=String(a); b=String(b); if(a.length!==b.length) return false; var r=0; for(var i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }
function _claveOk(hash, clave){
  hash=String(hash||''); if(!hash) return false;
  if(_esHashNuevo(hash)){ var p=hash.split('$'); return _iguales(_derivar(clave, p[1], Number(p[2])||VUELTAS), p[3]); }
  return _iguales(hash, sha256(clave));
}
function _secreto(){
  var p=PropertiesService.getScriptProperties(), s=p.getProperty('SESSION_SECRET');
  if(!s){ s=Utilities.getUuid()+Utilities.getUuid(); p.setProperty('SESSION_SECRET', s); }
  return s;
}
function _firmarSesion(prof){
  // p: perfil público completo, para que las apps puedan entrar al instante y comprobar la firma en segundo plano.
  var datos={ e:String(prof.email||'').toLowerCase(), n:prof.nombre||'', apps:prof.apps||{}, p:prof, iat:Date.now(), exp:Date.now()+SESION_DIAS*86400000 };
  var cuerpo=_b64u(Utilities.newBlob(JSON.stringify(datos)).getBytes());
  return cuerpo+'.'+_b64u(Utilities.computeHmacSha256Signature(cuerpo, _secreto()));
}
function _verificarSesion(tok){
  tok=String(tok||''); var i=tok.lastIndexOf('.'); if(i<1) return null;
  var cuerpo=tok.slice(0,i), firma=tok.slice(i+1);
  if(!_iguales(firma, _b64u(Utilities.computeHmacSha256Signature(cuerpo, _secreto())))) return null;
  try{
    var d=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(cuerpo+'==='.slice((cuerpo.length+3)%4))).getDataAsString());
    if(!d.e || !d.exp || d.exp<Date.now()) return null;
    return d;
  }catch(e){ return null; }
}
function _claveFallos(email){ return 'fail_'+String(email||'').toLowerCase().slice(0,200); }
function _bloqueado(email){ return Number(CacheService.getScriptCache().get(_claveFallos(email))||0) >= 5; }
function _fallo(email){ var c=CacheService.getScriptCache(), k=_claveFallos(email); c.put(k, String(Number(c.get(k)||0)+1), 900); }
function _limpiarFallos(email){ CacheService.getScriptCache().remove(_claveFallos(email)); }

/* ═══ LECTOR SEGURO DE HOJAS (fase 2, oct 2026) ═══════════════════════════════════════
   Las apps leían las hojas de Google directo desde el navegador (gviz CSV), por eso tenían que ser
   públicas. Ahora sa-sesion.js envía esas lecturas aquí: solo con sesión firmada válida y solo para las
   hojas de Spacio AM. Este script corre como el dueño, así que puede leer hojas PRIVADAS.
   · q: lo que va después de /spreadsheets/d/ en la URL original (id + /gviz/tq?…).
   · La hoja «Control de usuarios» nunca devuelve la columna password_hash.
   · Caché de 30 s por consulta (si el CSV cabe), para no repetir lecturas al abrir varias pantallas.
   ════════════════════════════════════════════════════════════════════════════ */
var HOJAS_PERMITIDAS = {
  '1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U': 'usuarios',   // Control de usuarios
  '1K8_MUCmJ4_Ks4DMKLSCbua1qC7X6QuilRaMvCquZ7kk': 'alma',       // ALMA (Hub)
  '12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ': 'hola',       // Hola / reservas
  '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4': 'epi',        // EPI / Mi
  '1-SfKC-evkK24qfOrrvIrcDs6ckGAmRzSLS_IYB8cYZg': 'docs',       // Docs / reportes
  '1r__zfIAFLr6mxcuAN6HwQF1OmLTG-lce-jv_naGRDVU': 'docs2',      // Docs
  '11V5EoY84H8tDQ6DvZ9jqtIcoBarY7EODqueNmNr71iM': 'tgsp'        // The Gentle Stoic Parent
};
function _hoja(ses, q){
  if(!ses) return {ok:false, error:'session'};
  q=String(q||'');
  var m=/^([A-Za-z0-9_-]{30,60})\/gviz\/tq(\?[^#]*)?$/.exec(q);
  if(!m) return {ok:false, error:'consulta'};
  var id=m[1], tipo=HOJAS_PERMITIDAS[id];
  if(!tipo) return {ok:false, error:'hoja_no_permitida'};
  var cache=CacheService.getScriptCache(), ck='h_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, q)).slice(0,40);
  var hit=cache.get(ck); if(hit!=null) return {ok:true, csv:hit, cache:true};
  var r=UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/'+q, { muteHttpExceptions:true, followRedirects:true,
    headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() } });
  var code=r.getResponseCode(), csv=r.getContentText();
  if(code>=300 || /^\s*</.test(csv)) return {ok:false, error:'google_'+code};
  if(tipo==='usuarios') csv=_sinColumna(csv, 'password_hash');
  if(csv.length<90000){ try{ cache.put(ck, csv, 30); }catch(e){} }
  return {ok:true, csv:csv};
}
/* Quita una columna de un CSV (por nombre de cabecera), respetando comillas. */
function _sinColumna(csv, nombre){
  var filas=Utilities.parseCsv(csv); if(!filas.length) return csv;
  var i=filas[0].map(function(h){ return String(h).trim().toLowerCase(); }).indexOf(nombre);
  if(i<0) return csv;
  return filas.map(function(f){ f.splice(i,1); return f.map(function(c){ c=String(c); return /[",\n\r]/.test(c) ? '"'+c.replace(/"/g,'""')+'"' : c; }).join(','); }).join('\n');
}
/* Ejecútala UNA vez desde el editor tras publicar esta versión: concede el permiso nuevo de leer hojas
   y conectarse a Google (UrlFetch). Sin esto el lector responde error de autorización. */
function autorizarLectorHojas(){
  var r=UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U/gviz/tq?tqx=out:csv&tq=select%20A%20limit%201',
    { headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() }, muteHttpExceptions:true });
  console.log('Lector de hojas: HTTP '+r.getResponseCode()+(r.getResponseCode()===200?' · listo':' · revisa permisos'));
}
