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
 *   googleLogin  { credential }              -> entra con la cuenta de Google (correo principal o alterno)
 *   faceEnroll   { session }                 -> llave de este dispositivo para entrar con Face ID
 *   faceLogin    { email, llave }            -> entra con esa llave (el teléfono la libera solo tras Face ID)
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
function doGet(e){
  var t = e && e.parameter && e.parameter.confirmar;   // enlace del correo «Confirma tu contraseña»
  if (t) return _paginaConfirmar(_confirmarClave(String(t)));
  return ContentService.createTextOutput(JSON.stringify({ok:true, service:'sa-auth'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function _handle(e){
  try{
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if(body.action === 'diagLector') return _diagLector(body.robot);
    if(body.action === 'diagClaves') return _diagClaves(body.robot);
    if(body.action === 'diagAlternos') return _diagAlternos(body.robot);
    if(body.action === 'resolverSocios') return _resolverSocios(body.robot, body.aplicar === true);
    if(body.action === 'crearContador') return _crearContador(body.robot, body.email, body.alternos, body.nombre, body.aplicar === true);
    if(body.token !== AUTH_TOKEN) return {ok:false, error:'token'};
    var ses = body.session ? _verificarSesion(body.session) : null;   // sesión firmada (si la app ya la envía)
    switch(body.action){
      case 'login':       return _login(body.email, body.password);
      case 'verify':      return _verify(body.session);
      case 'hoja':        return _hoja(ses, body.q);
      /* Fase 1c: la llave compartida (AUTH_TOKEN) está en el código público de todas las apps; sola ya no basta
         para ver el equipo ni para dar de alta usuarios. Hace falta sesión firmada o la llave del robot. */
      case 'profile':     if(!ses && !_esRobot(body.robot)) return {ok:false, error:'session'}; return _profile(body.email);
      case 'users':       if(!ses && !_esRobot(body.robot)) return {ok:false, error:'session'}; return _users(body.app);
      case 'owners':      if(!ses && !_esRobot(body.robot)) return {ok:false, error:'session'}; return _owners();
      case 'addUser':     if(!ses && !_esRobot(body.robot)) return {ok:false, error:'session'}; return _addUser(ses ? ses.e : body.by, body.email, body.nombre, body.app, body.rol, !!ses);
      case 'setInitialPassword': return _setInitialPassword(body.email, body.next);
      case 'setPassword': return _setPassword(body.email, body.current, body.next);
      case 'setEmail':    if(!_puedeEditar(ses, body.email)) return {ok:false, error:'session'}; return _setEmail(body.email, body.next);
      case 'setPhoto':    if(!_puedeEditar(ses, body.email)) return {ok:false, error:'session'}; return _setPhoto(body.email, body.url);
      case 'resetPassword': return _resetPassword(ses, body.email);
      case 'googleLogin': return _googleLogin(body.credential);
      case 'faceEnroll':  return _faceEnroll(ses);
      case 'faceLogin':   return _faceLogin(body.email, body.llave);
      case 'faceOff':     return _faceOff(ses, body.llave);
      default:            return {ok:false, error:'action'};
    }
  }catch(err){ return {ok:false, error:String(err)}; }
}

// ---- fase 1c: confirmar la primera contraseña desde el correo ----
var LOGIN_URL_ = 'https://script.google.com/macros/s/AKfycbxfdwLzsA8bwgOxUTOtf3Hw1ptIm8Cy34tspmFndu3WtRrkVSSnGyBP7obRrm73mcUd/exec';
function _esRobot(token){ return !!token && _diagLector(token).ok; }
function _pedirConfirmacion(row, H, next){
  var email = String(row[H.email]||'').trim().toLowerCase(), c = CacheService.getScriptCache();
  var aviso = {ok:false, error:'check_email', message:'Te mandamos un correo a ' + email + '. Ábrelo, toca «Confirmar mi contraseña» y después entra con tu nueva contraseña.'};
  if (c.get('conf_env_' + email)) return aviso;   // como mucho un correo por minuto
  var tok = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  c.put('conf_' + tok, JSON.stringify({ e: email, h: _hashClave(next) }), 3600);
  var url = LOGIN_URL_ + '?confirmar=' + tok, nombre = String(row[H.primer_nombre] || row[H.nombre] || '').split(/\s+/)[0];
  try {
    MailApp.sendEmail({ to: email, name: 'Spacio AM', subject: 'Confirma tu contraseña · Spacio AM',
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">' +
        '<p>Hola' + (nombre ? ' ' + nombre : '') + ',</p><p>Alguien (seguramente tú) creó la contraseña de tu cuenta de Spacio AM. ' +
        'Para activarla, toca el botón. El enlace vale 1 hora.</p>' +
        '<p><a href="' + url + '" style="display:inline-block;background:#222;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">Confirmar mi contraseña</a></p>' +
        '<p style="color:#777;font-size:13px">Si no fuiste tú, ignora este correo: sin tu confirmación la contraseña no se activa.</p></div>' });
  } catch (err) {
    console.error('_pedirConfirmacion: ' + err);
    return {ok:false, error:'mail', message:'No pudimos mandarte el correo de confirmación. Escríbenos a hola@spacioam.com.'};
  }
  c.put('conf_env_' + email, '1', 60);
  return aviso;
}
function _confirmarClave(tok){
  var c = CacheService.getScriptCache(), raw = /^[0-9a-f]{64}$/.test(tok) ? c.get('conf_' + tok) : null;
  if (!raw) return {ok:false, msg:'Este enlace ya venció o ya se usó. Vuelve a crear tu contraseña en la app.'};
  var x = JSON.parse(raw), f = _findRow(x.e);
  if (!f) return {ok:false, msg:'No encontramos tu cuenta. Escríbenos a hola@spacioam.com.'};
  var row = f.d.data[f.i], H = f.d.H;
  if (String(row[H.password_hash]||'')) { c.remove('conf_' + tok); return {ok:true, msg:'Tu cuenta ya tenía contraseña. Entra con ella.'}; }
  f.d.sh.getRange(f.i+1, H.password_hash+1).setValue(x.h);
  _touch(f.d.sh, H, f.i);
  c.remove('conf_' + tok);
  return {ok:true, msg:'¡Listo! Tu contraseña quedó activa. Vuelve a la app y entra con tu correo y tu nueva contraseña.'};
}
function _paginaConfirmar(r){
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:Arial,sans-serif;max-width:420px;margin:60px auto;padding:0 20px;text-align:center;color:#222">' +
    '<div style="font-size:42px">' + (r.ok ? '✓' : '⚠︎') + '</div><h2 style="font-weight:600">Spacio AM</h2><p style="font-size:16px;line-height:1.5">' + r.msg + '</p></div>')
    .setTitle('Spacio AM · Contraseña');
}
/* Ejecútala UNA vez desde el editor para autorizar el envío de correos (te llega una prueba). */
function autorizarCorreo(){ MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Spacio AM · correo del login autorizado', 'Listo: el login ya puede mandar el correo para confirmar contraseñas.'); }

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
    if(String(d.data[i][d.H.email]).replace(/\s+/g,'').toLowerCase()===key.replace(/\s+/g,'')) return {i:i, d:d};
  }
  // Correo alterno (personas con varios correos, p. ej. la contadora): entra con cualquiera de ellos. El principal siempre gana.
  if(key && d.H.email_alterno!=null){
    for(var j=1;j<d.data.length;j++){
      var alt=String(d.data[j][d.H.email_alterno]||'').toLowerCase().split(/[\s,;]+/);
      if(alt.indexOf(key)>=0) return {i:j, d:d};
    }
  }
  // Correos secundarios que el socio guardó en Mi (SETUP · «secondary user email»): llevan a su correo principal.
  var prin=key ? _alternosMi()[key] : '';
  if(prin && prin!==key){
    for(var q=1;q<d.data.length;q++){ if(String(d.data[q][d.H.email]).toLowerCase()===prin) return {i:q, d:d}; }
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
  // Contraseña reiniciada por un admin: entra con el código temporal y la app le pide crear una nueva.
  if(_esReinicio(hash)){
    var rp=String(hash).split('|');
    if(Number(rp[1]) < Date.now()) return {ok:false, error:'reset_expired', detail:'El código temporal venció. Pide uno nuevo al administrador.'};
    if(!_claveOk(rp[2], String(password||'').trim().toUpperCase())){ _fallo(email); return {ok:false, error:'bad_pass'}; }
    _limpiarFallos(email);
    CacheService.getScriptCache().put(_permisoReinicio(email), '1', 900);   // 15 min para crear la nueva
    return {ok:false, error:'needs_password', reset:true, profile:_publicProfile(row, H)};
  }
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
  // Administradores: solo un admin principal. Técnicos, compras y dueños: cualquier admin de esa app (fase 1c:
  // ahora es quien tiene la sesión; antes bastaba con escribir el correo de un principal en «by»).
  var esPrincipal = /principal/i.test(permBy), esAdmin = esPrincipal || /secundario/i.test(permBy);
  if (ROLES_ADMIN.indexOf(rol) >= 0 ? !esPrincipal : !esAdmin) return {ok:false, error:'forbidden'};
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
  var hActual=String(row[H.password_hash]||''), porReinicio=_esReinicio(hActual) && CacheService.getScriptCache().get(_permisoReinicio(email));
  if(hActual && !porReinicio) return {ok:false, error:'already_set'};
  if(!next || String(next).length<8 || _claveDebil(next)) return {ok:false, error:'weak'};
  /* Primer ingreso (sin reinicio del admin): antes bastaba saber el correo para ponerle contraseña a una cuenta
     nueva y entrar como esa persona. Ahora la contraseña queda pendiente hasta que la confirme desde su correo. */
  if(!porReinicio) return _pedirConfirmacion(row, H, next);
  sh.getRange(f.i+1, H.password_hash+1).setValue(_hashClave(next));
  _touch(sh,H,f.i);
  if(porReinicio) CacheService.getScriptCache().remove(_permisoReinicio(email));
  var prof=_publicProfile(row, H);
  return {ok:true, profile:prof, session:_firmarSesion(prof)};
}

function _setPassword(email, current, next){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  var row=f.d.data[f.i], H=f.d.H, sh=f.d.sh;
  if(_bloqueado(email)) return {ok:false, error:'too_many'};
  if(!_claveOk(String(row[H.password_hash]||''), current)){ _fallo(email); return {ok:false, error:'bad_current'}; }
  if(!next || String(next).length<8 || _claveDebil(next)) return {ok:false, error:'weak'};
  sh.getRange(f.i+1, H.password_hash+1).setValue(_hashClave(next));
  _touch(sh,H,f.i);
  _faceBorrarTodo(row[H.email]);   // cambiar la contraseña desactiva Face ID en todos los dispositivos
  return {ok:true};
}
// ---- Reinicio de contraseña (respaldo) ----
// Un administrador principal (con su sesión firmada) reinicia la contraseña de un usuario: se genera un código
// temporal de 8 caracteres válido 48 h. El usuario entra con su correo + ese código y la app le pide crear una
// contraseña nueva (mismo flujo que el primer ingreso). Hasta entonces la contraseña anterior deja de valer.
var REINICIO_HORAS = 48;
function _esReinicio(h){ return /^reset\|/.test(String(h||'')); }
function _permisoReinicio(email){ return 'rp_'+String(email||'').toLowerCase().slice(0,200); }
function _esAdminPrincipal(email){
  var f=_findRow(email); if(!f) return false;
  var row=f.d.data[f.i], H=f.d.H;
  if(row[H.estado]==='suspendido') return false;
  return APP_KEYS.some(function(a){ return String(row[H['perm_'+a]]||'')==='admin_principal'; });
}
function _puedeEditar(ses, email){
  if(!ses) return false;
  return String(ses.e||'')===String(email||'').trim().toLowerCase() || _esAdminPrincipal(ses.e);
}
function _resetPassword(ses, email){
  if(!ses) return {ok:false, error:'session'};
  if(!_esAdminPrincipal(ses.e)) return {ok:false, error:'forbidden'};
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  var ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789', bytes=Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''), codigo='';
  for(var k=0;k<8;k++) codigo+=ABC.charAt(parseInt(bytes.substr(k*4,4),16) % ABC.length);
  var vence=Date.now()+REINICIO_HORAS*3600000, sh=f.d.sh, H=f.d.H;
  sh.getRange(f.i+1, H.password_hash+1).setValue('reset|'+vence+'|'+_hashClave(codigo));
  _touch(sh,H,f.i);
  _faceBorrarTodo(f.d.data[f.i][H.email]);
  _limpiarFallos(email);
  return {ok:true, codigo:codigo, vence:new Date(vence).toISOString(), email:String(f.d.data[f.i][H.email]||'')};
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
// Contraseñas que no se aceptan como nuevas (las iniciales que se repartían y las obvias).
function _claveDebil(x){ x=String(x||'').toLowerCase(); return /^(\d)\1*$/.test(x) || /^(0?123456789?0?|12345678|87654321|password|contrase(n|ñ)a|qwerty\w*|spacio\s*am\d*|spacioam\d*|epi\d*)$/.test(x); }
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
  var t0=Date.now(), code=0, csv='';
  try{
    var r=UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/'+q, { muteHttpExceptions:true, followRedirects:true,
      headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() } });
    code=r.getResponseCode(); csv=r.getContentText();
  }catch(e){ code=-1; csv=''; _lectorError(q, 'fetch: '+e, Date.now()-t0); }
  if(code>=300 || code<0 || /^\s*</.test(csv)){
    // Respaldo: si gviz falla (límite de Google, error temporal), se lee la pestaña directo con SpreadsheetApp.
    // Solo para lecturas de pestaña completa (sin consulta tq), que es lo que piden casi todas las apps.
    _lectorError(q, 'gviz '+code, Date.now()-t0);
    var alt=_hojaDirecta(id, m[2]||'');
    if(alt==null) return {ok:false, error:'google_'+code};
    csv=alt;
  }
  if(tipo==='usuarios') csv=_sinColumna(csv, 'password_hash');
  if(csv.length<90000){ try{ cache.put(ck, csv, 30); }catch(e){} }
  return {ok:true, csv:csv};
}
/* Quita una columna de un CSV (por nombre de cabecera), respetando comillas. */
function _lectorError(q, err, ms){
  try{ var c=CacheService.getScriptCache(), l=[]; try{ l=JSON.parse(c.get('lector_err')||'[]'); }catch(e){}
    l.unshift({ t:new Date().toISOString(), q:String(q).replace(/^[^\/]+/, function(x){ return (HOJAS_PERMITIDAS[x]||'?'); }).slice(0,120), err:String(err).slice(0,120), ms:ms });
    c.put('lector_err', JSON.stringify(l.slice(0,40)), 21600); }catch(e){}
}
function _hojaDirecta(id, qs){
  try{
    var p={}; String(qs||'').replace(/^\?/,'').split('&').forEach(function(kv){ if(!kv) return; var i=kv.indexOf('='); p[decodeURIComponent(kv.slice(0,i<0?kv.length:i))]=decodeURIComponent((i<0?'':kv.slice(i+1)).replace(/\+/g,' ')); });
    if(p.tq || (p.tqx && !/out:csv/.test(p.tqx))) return null;      // consultas gviz: no se emulan
    var ss=SpreadsheetApp.openById(id), sh=p.sheet ? ss.getSheetByName(p.sheet) : (p.gid ? ss.getSheets().filter(function(x){ return String(x.getSheetId())===String(p.gid); })[0] : ss.getSheets()[0]);
    if(!sh) return null;
    var v=sh.getDataRange().getDisplayValues();
    return v.map(function(row){ return row.map(function(x){ return '"'+String(x).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
  }catch(e){ _lectorError(id, 'directa: '+e, 0); return null; }
}
// Diagnóstico para el robot: por app, cuántos usuarios activos tienen contraseña, cuántos no y cuántos en reinicio.
// Solo cuentas, sin correos ni nombres.
function _diagClaves(token){
  if(!_diagLector(token).ok) return {ok:false, error:'token'};
  var d=_all(), out={};
  for(var i=1;i<d.data.length;i++){
    var row=d.data[i], H=d.H; if(!row[H.email] || row[H.estado]==='suspendido') continue;
    var h=String(row[H.password_hash]||''), tipo=!h?'sin_clave':(_esReinicio(h)?'reinicio':'con_clave');
    APP_KEYS.forEach(function(a){ if(!row[H['perm_'+a]]) return; out[a]=out[a]||{con_clave:0,sin_clave:0,reinicio:0}; out[a][tipo]++; });
  }
  return {ok:true, apps:out};
}
// Diagnóstico para el robot (llave por hash): últimos errores del lector.
function _diagLector(token){
  var h=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token||''), Utilities.Charset.UTF_8).map(function(b){ return ('0'+(b&0xff).toString(16)).slice(-2); }).join('');
  if(h!=='b0d3ca9d3adb76025e4b4289181cb6300d7769a1d53a2a0c91636df9e0c65ed5') return {ok:false, error:'token'};
  return {ok:true, errores: JSON.parse(CacheService.getScriptCache().get('lector_err')||'[]')};
}
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

// ---- Correos secundarios de los socios (Mi) ----
// Mi guarda en SETUP, por propiedad, «User email» (principal) y «secondary user email» (varios, separados por coma).
// Mapa secundario → principal, en caché 10 min. Así el socio entra al login unificado con cualquiera de sus correos.
var MI_SETUP_ID = '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4';
function _alternosMi(){
  var c=CacheService.getScriptCache(), v=c.get('alt_mi'); if(v){ try{ return JSON.parse(v); }catch(e){} }
  var out={};
  try{
    var sh=SpreadsheetApp.openById(MI_SETUP_ID).getSheetByName('SETUP'), data=sh.getDataRange().getValues();
    var h=data[0].map(function(x){ return String(x).trim().toLowerCase(); }), cp=h.indexOf('user email'), cs=h.indexOf('secondary user email');
    if(cp>=0 && cs>=0) for(var i=1;i<data.length;i++){
      var p=String(data[i][cp]||'').trim().toLowerCase(); if(p.indexOf('@')<0) continue;
      String(data[i][cs]||'').toLowerCase().split(/[\s,;]+/).forEach(function(a){ if(a.indexOf('@')>0 && a!==p && !out[a]) out[a]=p; });
    }
  }catch(e){ console.error('alternosMi: '+e); return {}; }
  try{ c.put('alt_mi', JSON.stringify(out), 600); }catch(e){}
  return out;
}
// Robot: cuántos secundarios hay en Mi, cuántos llevan a un usuario existente, y conflictos (sin datos personales).
function _diagAlternos(token){
  if(!_diagLector(token).ok) return {ok:false, error:'token'};
  CacheService.getScriptCache().remove('alt_mi');
  var m=_alternosMi(), d=_all(), prin={}, alt={};
  for(var i=1;i<d.data.length;i++){
    prin[String(d.data[i][d.H.email]).toLowerCase()]=1;
    if(d.H.email_alterno!=null) String(d.data[i][d.H.email_alterno]||'').toLowerCase().split(/[\s,;]+/).forEach(function(a){ if(a) alt[a]=1; });
  }
  var r={secundarios:0, socios:0, llevan_a_usuario:0, principal_sin_usuario:0, ya_en_alterno:0, es_principal_de_otro:0}, vistos={};
  Object.keys(m).forEach(function(a){
    r.secundarios++; if(!vistos[m[a]]){ vistos[m[a]]=1; r.socios++; }
    if(prin[a]) r.es_principal_de_otro++;
    else if(prin[m[a]]) r.llevan_a_usuario++; else r.principal_sin_usuario++;
    if(alt[a]) r.ya_en_alterno++;
  });
  // Socios cuyo correo principal de Mi no existe en el login: código de socio y propiedades (sin correos).
  var sinUsuario=[];
  try{
    var data=SpreadsheetApp.openById(MI_SETUP_ID).getSheetByName('SETUP').getDataRange().getValues(), h=data[0].map(function(x){ return String(x).trim().toLowerCase(); });
    var cp=h.indexOf('user email'), cu=h.indexOf('usuario id'), cn=h.indexOf('property_name'), porSocio={};
    if(cn<0) cn=h.indexOf('property name');
    for(var i=1;i<data.length;i++){
      var p=String(data[i][cp]||'').trim().toLowerCase(); if(p.indexOf('@')<0 || prin[p]) continue;
      var k=String(data[i][cu]||'').trim()||'(sin código)'; porSocio[k]=porSocio[k]||{socio:k, propiedades:[], tiene_secundario:false};
      var pn=String(data[i][cn]||'').trim(); if(pn && porSocio[k].propiedades.indexOf(pn)<0) porSocio[k].propiedades.push(pn);
      if(Object.keys(m).some(function(a){ return m[a]===p; })) porSocio[k].tiene_secundario=true;
    }
    sinUsuario=Object.keys(porSocio).map(function(k){ return porSocio[k]; });
  }catch(e){ sinUsuario=[{error:String(e)}]; }
  return {ok:true, mi:r, socios_sin_usuario:sinUsuario};
}

// ---- Socios de Mi sin usuario por correo (robot) ----
// Control de usuarios manda: si el socio ya existe ahí (user_id = su código «Socio_###»), su correo es el bueno y se
// escribe en Mi (SETUP · User email), dejando el correo viejo de Mi como secundario para que siga sirviendo.
// Si no existe, se da de alta con el correo de Mi como socio de Mi (sin contraseña: la crea en su primer ingreso).
// aplicar=false (por defecto) solo informa, sin datos personales.
function _resolverSocios(token, aplicar){
  if(!_diagLector(token).ok) return {ok:false, error:'token'};
  var d=_all(), H=d.H, porCorreo={}, porId={};
  var norm=function(x){ return String(x||'').replace(/\s+/g,'').toLowerCase(); };
  var lista=function(x){ return String(x||'').toLowerCase().split(/[\s,;]+/).map(norm).filter(function(e){ return e.indexOf('@')>0; }); };
  for(var i=1;i<d.data.length;i++){
    lista(d.data[i][H.email]).forEach(function(e){ porCorreo[e]=porCorreo[e]!=null?porCorreo[e]:i; });
    if(H.email_alterno!=null) lista(d.data[i][H.email_alterno]).forEach(function(e){ if(porCorreo[e]==null) porCorreo[e]=i; });
    var uid=norm(d.data[i][H.user_id]); if(uid) porId[uid]=i;
  }
  var ms=SpreadsheetApp.openById(MI_SETUP_ID).getSheetByName('SETUP'), md=ms.getDataRange().getValues(), mh=md[0].map(function(x){ return String(x).trim().toLowerCase(); });
  var cp=mh.indexOf('user email'), cs=mh.indexOf('secondary user email'), cu=mh.indexOf('usuario id');
  var socios={};
  for(var r=1;r<md.length;r++){
    var code=String(md[r][cu]||'').trim(), ps=lista(md[r][cp]); if(!code || !ps.length) continue;
    if(String(md[r][cp]).trim().toLowerCase()===ps[0] && ps.length===1 && porCorreo[ps[0]]!=null && norm(d.data[porCorreo[ps[0]]][H.email])===ps[0]) continue;   // ya cuadra exacto
    var s=(socios[code]=socios[code]||{code:code, correos:{}, filas:[]}); s.filas.push(r);
    ps.concat(cs>=0?lista(md[r][cs]):[]).forEach(function(e){ s.correos[e]=1; });
  }
  var out=[];
  Object.keys(socios).forEach(function(code){
    var s=socios[code], k=null, via='';
    if(porId[norm(code)]!=null){ k=porId[norm(code)]; via='código de socio'; }
    else Object.keys(s.correos).some(function(e){ if(porCorreo[e]!=null){ k=porCorreo[e]; via=norm(d.data[k][H.email])===e?'correo (con espacios o mayúsculas distintas, o un secundario de Mi)':'correo alterno de Control'; return true; } return false; });
    if(k!=null){
      var correo=String(d.data[k][H.email]||'').trim();
      out.push({socio:code, existe:true, encontrado_por:via, accion:'escribir en Mi el correo de Control de usuarios', filas_mi:s.filas.length});
      if(aplicar) s.filas.forEach(function(r){
        var viejo=lista(md[r][cp]), sec=(cs>=0?lista(md[r][cs]):[]).concat(viejo).filter(function(x,i,a){ return x!==norm(correo) && a.indexOf(x)===i; });
        ms.getRange(r+1, cp+1).setValue(correo);
        if(cs>=0) ms.getRange(r+1, cs+1).setValue(sec.join(', '));
      });
    } else {
      var correoMi=lista(md[s.filas[0]][cp])[0];
      out.push({socio:code, existe:false, accion:'dar de alta con el correo de Mi', filas_mi:s.filas.length});
      if(aplicar){
        var fila=d.data[0].map(function(){ return ''; }), put=function(c,v){ if(H[c]!=null) fila[H[c]]=v; };
        put('user_id', code); put('nombre', code); put('email', correoMi); put('estado','activo'); put('es_dueno','sí'); put('es_socio','sí'); put('perm_mi','socio');
        put('creado', new Date()); put('actualizado', new Date());
        d.sh.appendRow(fila);
      }
    }
  });
  if(aplicar) CacheService.getScriptCache().remove('alt_mi');
  return {ok:true, aplicado:!!aplicar, socios:out};
}

/* Robot: usuario de contabilidad de Mi (perm_mi = contador → Mi solo le muestra Contabilidad). Entra con el correo
   principal o con cualquiera de los alternos. Sin contraseña: en su primer ingreso Mi le pide crearla.
   Sin aplicar, solo dice qué haría. */
function _crearContador(token, email, alternos, nombre, aplicar){
  if(!_diagLector(token).ok) return {ok:false, error:'token'};
  email=String(email||'').trim().toLowerCase(); if(email.indexOf('@')<0) return {ok:false, error:'bad_email'};
  var alt=[].concat(alternos||[]).map(function(x){ return String(x||'').trim().toLowerCase(); }).filter(function(x){ return x.indexOf('@')>0 && x!==email; });
  var d=_all(), sh=d.sh, H=d.H, f=_findRow(email);
  if(H.perm_mi==null) return {ok:false, error:'sin columna perm_mi'};
  if(f){
    var prev=String(f.d.data[f.i][H.perm_mi]||'');
    if(ROLES_ADMIN.indexOf(prev)>=0) return {ok:false, error:'ese correo ya es administrador; no se cambia'};
    if(!aplicar) return {ok:true, existe:true, perm_mi_actual:prev||'(ninguno)', haria:'perm_mi = contador y agregar alternos'};
    sh.getRange(f.i+1, H.perm_mi+1).setValue('contador');
    if(H.email_alterno!=null && alt.length){ var ya=String(f.d.data[f.i][H.email_alterno]||'').toLowerCase().split(/[\s,;]+/).filter(Boolean); sh.getRange(f.i+1, H.email_alterno+1).setValue(ya.concat(alt).filter(function(x,i,a){ return a.indexOf(x)===i; }).join(', ')); }
    if(String(f.d.data[f.i][H.estado]||'')==='suspendido') sh.getRange(f.i+1, H.estado+1).setValue('activo');
    return {ok:true, actualizado:true};
  }
  if(!aplicar) return {ok:true, existe:false, haria:'crear usuario contador', alternos:alt.length, columna_alterno:H.email_alterno!=null};
  nombre=String(nombre||'Contabilidad').trim();
  var row=[]; for(var k=0;k<sh.getLastColumn();k++) row.push('');
  var set=function(col, v){ if(H[col]!=null) row[H[col]]=v; };
  set('user_id', 'U-' + Utilities.getUuid().slice(0, 8).toUpperCase()); set('nombre', nombre); set('email', email);
  set('primer_nombre', nombre.split(/\s+/)[0]||''); set('estado', 'activo'); set('es_dueno', 'no'); set('es_socio', 'no');
  set('perm_mi', 'contador'); set('password_hash', ''); set('actualizado', new Date());
  if(H.email_alterno!=null) set('email_alterno', alt.join(', '));
  sh.appendRow(row);
  CacheService.getScriptCache().remove('alt_mi');
  return {ok:true, creado:true};
}


/* ═══ ENTRAR CON GOOGLE Y CON FACE ID (oct 2026) ═══════════════════════════════════════
   Formas alternativas de entrar: la contraseña sigue igual. El usuario es el mismo de siempre, el de esta hoja
   (correo principal o alterno), así que la misma persona entra igual en todas las apps.
   · Google: la app manda el ID token de Google; se verifica con Google y que sea de nuestro Client ID
     (propiedad GOOGLE_CLIENT_IDS, separados por coma; por defecto el de The Gentle Stoic Parent).
   · Face ID: con la sesión abierta, el dispositivo pide una llave larga y la guarda; el teléfono solo la usa
     después de pasar Face ID (passkey del dispositivo). Aquí se guarda solo su huella. Cambiar o reiniciar la
     contraseña borra todas las llaves de esa persona.
   ════════════════════════════════════════════════════════════════════════════ */
var GOOGLE_CLIENT_ID_GSP = '946315464909-i0uptgcvbpqnspnjp5a0o4a7dnpi0ngi.apps.googleusercontent.com';
function _googleIds(){ return String(PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_IDS') || GOOGLE_CLIENT_ID_GSP).split(/[\s,;]+/).filter(String); }
function _entrarComo(email){
  var f=_findRow(email); if(!f) return {ok:false, error:'no_user'};
  var row=f.d.data[f.i], H=f.d.H;
  if(row[H.estado]==='suspendido') return {ok:false, error:'suspended'};
  var prof=_publicProfile(row, H);
  return {ok:true, profile:prof, session:_firmarSesion(prof)};
}
function _googleLogin(credential){
  credential=String(credential||''); if(!credential) return {ok:false, error:'google'};
  var r=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential), {muteHttpExceptions:true});
  if(r.getResponseCode()!==200) return {ok:false, error:'google'};
  var t=JSON.parse(r.getContentText()||'{}');
  if(_googleIds().indexOf(String(t.aud))<0) return {ok:false, error:'google_client'};
  if(String(t.email_verified)!=='true' || !t.email || Number(t.exp)*1000<Date.now()) return {ok:false, error:'google'};
  return _entrarComo(String(t.email).toLowerCase());
}
function _faceClave(email){ return 'face_'+String(email||'').toLowerCase().slice(0,200); }
function _faceLista(email){ try{ return JSON.parse(PropertiesService.getScriptProperties().getProperty(_faceClave(email))||'[]'); }catch(e){ return []; } }
function _faceHuella(llave){ return _hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(llave), Utilities.Charset.UTF_8)); }
function _faceEnroll(ses){
  if(!ses) return {ok:false, error:'session'};
  var f=_findRow(ses.e); if(!f) return {ok:false, error:'no_user'};
  var email=String(f.d.data[f.i][f.d.H.email]||ses.e).toLowerCase();
  var llave=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  var l=_faceLista(email); l.push({h:_faceHuella(llave), t:Date.now()});
  PropertiesService.getScriptProperties().setProperty(_faceClave(email), JSON.stringify(l.slice(-6)));   // hasta 6 dispositivos
  return {ok:true, email:email, llave:llave};
}
function _faceLogin(email, llave){
  email=String(email||'').toLowerCase();
  if(_bloqueado(email)) return {ok:false, error:'too_many'};
  var h=_faceHuella(llave||''), ok=_faceLista(email).some(function(x){ return _iguales(x.h, h); });
  if(!ok){ _fallo(email); return {ok:false, error:'face'}; }
  return _entrarComo(email);
}
function _faceOff(ses, llave){
  if(!ses) return {ok:false, error:'session'};
  var f=_findRow(ses.e); if(!f) return {ok:false, error:'no_user'};
  var email=String(f.d.data[f.i][f.d.H.email]||ses.e).toLowerCase(), h=_faceHuella(llave||'');
  PropertiesService.getScriptProperties().setProperty(_faceClave(email), JSON.stringify(_faceLista(email).filter(function(x){ return x.h!==h; })));
  return {ok:true};
}
function _faceBorrarTodo(email){ try{ PropertiesService.getScriptProperties().deleteProperty(_faceClave(email)); }catch(e){} }
