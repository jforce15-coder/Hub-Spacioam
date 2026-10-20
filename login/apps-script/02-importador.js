/**********************************************************************
 * SPACIO AM · CONTROL DE USUARIOS UNIFICADO
 * 02 · IMPORTADOR  (v3 — solo usuarios reales)
 * --------------------------------------------------------------------
 * Pega en el MISMO Apps Script de la hoja «Control de usuarios».
 * Requiere haber corrido antes  setupControlUsuarios()  (archivo 01).
 *
 * QUÉ CAMBIÓ EN v4 (lo que reportaste):
 *   · EPI guardaba los usuarios como un JSON gigante en UNA celda
 *     (Config!B1, tipo clave-valor: A="vendors", B=[...]). Antes se
 *     saltaba la primera fila como si fuera encabezado. Ahora escanea
 *     TODAS las filas y celdas en busca de JSON, con o sin encabezado.
 *   · Lee los flags REALES del JSON de EPI: isAdmin, isSupervisor,
 *     tipo (interno/externo), categoria (Administrativo, EPI Limpieza,
 *     EPI Mantenimiento, etc.).
 *   · Distingue admin principal (jovalle) de secundario (resto isAdmin).
 *   · SOLO migra filas/objetos que tengan CONTRASEÑA (descarta reservas,
 *     pagos, catálogos, etc. que tienen correo pero no son usuarios).
 *   · Captura correo secundario en email_alterno.
 *
 * CÓMO EJECUTAR:
 *   1) importarUsuarios()            -> DRY RUN: solo muestra el log,
 *                                       NO escribe. Revisa el conteo.
 *   2) importarUsuariosDEFINITIVO()  -> ESCRIBE de verdad en «Usuarios».
 *   (elige la función en el menú de arriba y pulsa ▷ Ejecutar)
 *
 * HUÉSPEDES DE HOLA: no se migran (siguen con su código de reserva).
 **********************************************************************/

// Solo el ID de cada hoja: las pestañas se detectan solas.
var SOURCES = {
  MI:   '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4',
  EPI:  '1-SfKC-evkK24qfOrrvIrcDs6ckGAmRzSLS_IYB8cYZg',
  GROW: '1lF55y1dc6TYyh7wQvO3wYVWBlx6xU7E24BxYd73tNzI',
  HOLA: '12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ'
};

// Pestañas que se EXCLUYEN del escaneo (huéspedes de HOLA, reservas, etc.)
var SKIP_TABS = /huesped|huésped|reserva|log|historial|backup|catalogo|catálogo|item|propiedad|listing|deposito|depósito|factura|pago/i;

// El admin principal se unifica a este correo en todas las apps.
var PRIMARY_ADMIN = 'jovalle@spacioam.com';

// ID de la hoja «Control de usuarios» (proyecto independiente → openById).
var CONTROL_SHEET_ID = '1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U';

// ----------  Entradas  ----------
function importarUsuarios()            { _run(false); }  // DRY RUN (no escribe)
function importarUsuariosDEFINITIVO()  { _run(true);  }  // ESCRIBE de verdad

// Borra TODOS los datos de la pestaña «Usuarios» (deja el encabezado y el
// formato) y vuelve a importar todo desde cero. Úsalo si ya escribiste datos
// antes y quieres empezar limpio.
function reimportarDesdeCero() {
  borrarDatosUsuarios();
  _run(true);
}
// Solo borra las filas de datos (no toca encabezado ni formato).
function borrarDatosUsuarios() {
  var sh = SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheetByName('Usuarios');
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  Logger.log('Datos de «Usuarios» borrados (' + (last - 1) + ' fila(s)).');
}

function _run(commit) {
  var byEmail = {};
  ['MI','EPI','GROW','HOLA'].forEach(function(k){ _scan(k, byEmail); });

  var rows = Object.keys(byEmail).map(function(k){ return byEmail[k]; });
  Logger.log('\n===== RESUMEN =====');
  Logger.log('Usuarios únicos CON contraseña: ' + rows.length);
  rows.forEach(function(r){
    Logger.log([r.email, r.email_alterno?('(alt '+r.email_alterno+')'):'',
      'MI='+r.perm_mi, 'EPI='+r.perm_epi, 'GROW='+r.perm_grow, 'HOLA='+r.perm_hola
    ].join(' · '));
  });

  if (!commit) {
    Logger.log('\n--- DRY RUN --- No se escribió nada.');
    Logger.log('Si el conteo se ve bien, corre  importarUsuariosDEFINITIVO()');
    return;
  }
  _writeUsuarios(rows);
  Logger.log('\nEscritas ' + rows.length + ' filas en «Usuarios».');
}

// ----------  Escaneo de una hoja  ----------
function _scan(appKey, acc){
  var ss;
  try { ss = SpreadsheetApp.openById(SOURCES[appKey]); }
  catch(e){ Logger.log(appKey+': no se pudo abrir ('+e+'). Se salta.'); return; }
  var found=0;
  ss.getSheets().forEach(function(sheet){
    var tab = sheet.getName();
    if (SKIP_TABS.test(tab)) { Logger.log(appKey+' · pestaña "'+tab+'" excluida.'); return; }
    var data = sheet.getDataRange().getValues();
    if (data.length < 1) return;
    var jsonRows = {};

    // (a) JSON embebido — se revisan TODAS las filas y celdas (incl. la
    //     primera). Aquí caen los usuarios de EPI (Config!B1) y cualquier
    //     otra celda que contenga objetos/arrays JSON de usuario.
    for (var r=0; r<data.length; r++){
      var us=_extractJson(data[r]);
      if(us.length){
        jsonRows[r]=true;
        us.forEach(function(o){ var rec=_fromJson(appKey,o); if(rec){ _merge(acc,rec); found++; } });
      }
    }

    // (b) Filas normales por columnas. Detecta si hay encabezado real.
    var h=_hmap(data[0]);
    var emailCol=_emailColByName(h);
    var start=1;
    if(emailCol<0){
      emailCol=_emailColByContent(data);           // busca por contenido (@)
      if(emailCol>=0 && String(data[0][emailCol]||'').indexOf('@')>0) start=0; // sin encabezado
    }
    if(emailCol>=0){
      for(var i=start;i<data.length;i++){
        if(jsonRows[i]) continue;                    // ya resuelta por JSON
        var row=data[i], email=_s(row[emailCol]);
        if(!email || email.indexOf('@')<0) continue;
        var rec2=_classify(appKey,row,h,tab,email);
        if(!rec2) continue;
        _merge(acc,rec2); found++;
      }
    }
  });
  Logger.log(appKey+': '+found+' usuario(s) con contraseña detectado(s).');
}

// ----------  JSON embebido (EPI)  ----------
// Devuelve una lista de objetos-usuario encontrados dentro de la fila.
function _extractJson(row){
  var out=[];
  for (var c=0;c<row.length;c++){
    var v=row[c];
    if (typeof v!=='string') continue;
    var t=v.trim();
    if (t.length<8) continue;
    if (t[0]!=='{' && t[0]!=='[') continue;
    var parsed;
    try { parsed = JSON.parse(t); } catch(e){ continue; }
    var arr = Array.isArray(parsed) ? parsed : [parsed];
    arr.forEach(function(o){
      if (o && typeof o==='object' && _pick(o, /correo|email|mail/i))
        out.push(o);
    });
  }
  return out;
}

function _fromJson(appKey, o){
  var email=_s(_pick(o, /^correo$|^email$|^mail$|correo_principal|email_principal/i));
  if(!email || email.indexOf('@')<0) return null;
  var pass =_s(_pick(o, /^password$|^pass$|contrase|clave|pwd/i));
  if(!pass) return null;                      // REGLA: sin contraseña no entra
  var alt  =_s(_pick(o, /alterno|secundario|secondary|correo2|email2|notifemail/i));
  if(alt && alt.toLowerCase()===email.toLowerCase()) alt='';
  var pn=_s(_pick(o,/primernombre|primer_nombre/i));
  var sn=_s(_pick(o,/segundonombre|segundo_nombre/i));
  var pa=_s(_pick(o,/primerapellido|primer_apellido/i));
  var sa=_s(_pick(o,/segundoapellido|segundo_apellido/i));
  var nombre=_s(_pick(o,/^name$|^nombre$/i));
  if(!nombre){ nombre=[pn,sn,pa,sa].map(_s).filter(Boolean).join(' ').trim(); }
  var rec={ email:email, email_alterno:alt, nombre:nombre,
            pn:pn, sn:sn, pa:pa, sa:sa,
            pass:pass, tel:_s(_pick(o,/^phone$|tel|celular/i)) };
  _roleForApp(appKey, rec, {
    tipo:_s(_pick(o,/^tipo$|tipo_proveedor/i)),
    cat:_s(_pick(o,/categor/i)),
    admin:_bool(_pick(o,/^isadmin$|acceso_admin|es_admin/i)),
    supervisor:_bool(_pick(o,/issupervisor|supervisor/i)),
    rango:_s(_pick(o,/rango|nivel/i)),
    rol:_s(_pick(o,/^rol$|role|perfil/i))
  }, '');
  if(rec._skip) return null;
  return rec;
}

// ----------  Fila normal por columnas  ----------
function _classify(appKey, row, h, tab, email){
  var pass=_s(row[h.pass]||row[h.password]||row['contraseña']||row.clave||row.pwd);
  if(!pass) return null;                      // REGLA: sin contraseña no entra
  var alt =_s(row[h.email_alterno]||row.correo_alterno||row.correo_secundario||
              row.email_secundario||row.correo2||row.email2||row.alterno);
  var rec={ email:email, email_alterno:alt,
    nombre:_s(row[h.nombre]||row[h.name]||row.nombre_completo),
    pn:_s(row[h.primer_nombre]||row['primer nombre']),
    sn:_s(row[h.segundo_nombre]||row['segundo nombre']),
    pa:_s(row[h.primer_apellido]||row['primer apellido']),
    sa:_s(row[h.segundo_apellido]||row['segundo apellido']),
    pass:pass, tel:_s(row[h.tel]||row.telefono||row['teléfono']) };
  if(!rec.nombre){ rec.nombre=[rec.pn,rec.sn,rec.pa,rec.sa].filter(Boolean).join(' ').trim(); }
  _roleForApp(appKey, rec, {
    tipo:_s(row[h.tipo]||row.tipo_proveedor),
    cat:_s(row[h.categoria]||row['categoría']),
    admin:_s(row[h.acceso_admin]||row.admin||row.acceso),
    rango:_s(row[h.supervision]||row['supervisión']||row.rango),
    rol:_s(row[h.rol]||row.role||row.perfil)
  }, tab);
  if(rec._skip) return null;
  return rec;
}

// ----------  Deducción de rol por app (compartida)  ----------
function _roleForApp(appKey, rec, f, tab){
  if(appKey==='MI'){
    var esContador=/contador/i.test(f.rol||'');
    rec.es_dueno='sí'; rec.es_socio=esContador?'no':'sí';
    rec.perm_mi=esContador?'contador':'socio';
  } else if(appKey==='EPI'){
    var tipo=(f.tipo||'').toLowerCase(), cat=(f.cat||'').toLowerCase();
    var esAdmin=/sí|si|true|1|activo/i.test(f.admin||'');
    var esSuper=/sí|si|true|1/i.test(f.supervisor||'');
    var rango=(f.rango||'').toLowerCase();
    var rol;
    if(esAdmin){
      // principal solo el correo canónico; el resto, secundario
      rol=(rec.email.toLowerCase()===PRIMARY_ADMIN || /principal/.test(rango))
            ? 'admin_principal' : 'admin_secundario';
    }
    else if(esSuper) rol='supervisor';
    else if(/externo/.test(tipo)||/proveedor|fumig/.test(cat)) rol='proveedor_externo';
    else if(/mantenimiento/.test(cat)) rol='tecnico_mantenimiento';
    else if(/administrativo/.test(cat)) rol='colaborador_admin';
    else rol='tecnico_limpieza';
    rec.perm_epi=rol;
  } else if(appKey==='GROW'){
    var r=(f.rol||'').toLowerCase().replace(/\s+/g,'_');
    if(/dueno|dueño/i.test(tab||'') || /dueno|dueño|propietario/.test(r)){
      rec.es_dueno='sí'; rec.perm_grow='dueno';
    } else {
      if(!r) r='personal_campo';
      if(/admin2|secundario/.test(r)) r='admin_secundario';
      else if(/admin/.test(r)) r='admin_principal';
      else if(/compra|montaje/.test(r)) r='compras_montaje';
      else if(/campo|ejecu/.test(r)) r='personal_campo';
      rec.perm_grow=r;
    }
  } else if(appKey==='HOLA'){
    var rh=(f.rol||'').toLowerCase();
    if(/huesped|huésped|guest/.test(rh)){ rec._skip=true; return; } // no migrar
    rec.perm_hola=(rec.email.toLowerCase()===PRIMARY_ADMIN)?'admin_principal':'admin_secundario';
  }
}

// ----------  Merge + escritura  ----------
function _merge(acc, r){
  var key=r.email.toLowerCase();
  var u=acc[key];
  if(!u){
    u=acc[key]={ user_id:_uid(key), nombre:r.nombre||'', pn:r.pn||'', sn:r.sn||'', pa:r.pa||'', sa:r.sa||'', email:r.email,
      email_alterno:r.email_alterno||'', password_hash:'', foto:'', estado:'activo',
      es_dueno:'no', es_socio:'no',
      perm_mi:'', perm_epi:'', perm_grow:'', perm_hola:'',
      telefono:'', notas:'', _rawpass:'' };
  }
  if(r.nombre && !u.nombre) u.nombre=r.nombre;
  ['pn','sn','pa','sa'].forEach(function(k){ if(r[k] && !u[k]) u[k]=r[k]; });
  if(r.email_alterno && !u.email_alterno) u.email_alterno=r.email_alterno;
  if(r.tel && !u.telefono) u.telefono=r.tel;
  if(r.es_dueno==='sí') u.es_dueno='sí';
  if(r.es_socio==='sí') u.es_socio='sí';
  ['perm_mi','perm_epi','perm_grow','perm_hola'].forEach(function(p){
    if(r[p]) u[p]=r[p];
  });
  if(r.pass && !u._rawpass) u._rawpass=r.pass;
  if(key===PRIMARY_ADMIN){
    ['perm_mi','perm_epi','perm_grow','perm_hola'].forEach(function(p){
      if(u[p] && /admin/.test(u[p])) u[p]='admin_principal';
    });
  }
}

function _writeUsuarios(rows){
  var sh=SpreadsheetApp.openById(CONTROL_SHEET_ID).getSheetByName('Usuarios');
  var now=new Date();
  // Lee el encabezado REAL de la hoja y alinea cada valor por NOMBRE de columna.
  // Así no importa el orden ni cuántas columnas tenga la hoja: cada dato cae en
  // su columna (evita el choque con la validación de «estado», etc.).
  var head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(c){ return String(c).trim(); });
  var out=rows.map(function(u){
    var m = {
      user_id:u.user_id, primer_nombre:u.pn||'', segundo_nombre:u.sn||'',
      primer_apellido:u.pa||'', segundo_apellido:u.sa||'', nombre:u.nombre||'',
      email:u.email, email_alterno:u.email_alterno||'',
      password_hash:u._rawpass?sha256(u._rawpass):'', foto:u.foto||'', estado:u.estado||'activo',
      es_dueno:u.es_dueno||'no', es_socio:u.es_socio||'no',
      perm_mi:u.perm_mi||'', perm_epi:u.perm_epi||'', perm_grow:u.perm_grow||'', perm_hola:u.perm_hola||'',
      telefono:u.telefono||'', notas:u.notas||'', creado:now, actualizado:now
    };
    return head.map(function(h){ return m.hasOwnProperty(h) ? m[h] : ''; });
  });
  if(out.length) sh.getRange(2,1,out.length,head.length).setValues(out);
}

// ----------  Utilidades  ----------
function _hmap(headerRow){
  var m={}; headerRow.forEach(function(c,i){
    var k=_s(c).toLowerCase().replace(/\s+/g,'_'); if(k) m[k]=i;
  }); return m;
}
// Localiza la columna de correo por NOMBRE de encabezado
function _emailColByName(h){
  return (h.email!=null?h.email : h.correo!=null?h.correo :
          h.e_mail!=null?h.e_mail : h.mail!=null?h.mail :
          h.correo_electronico!=null?h.correo_electronico : -1);
}
// Localiza la columna de correo por CONTENIDO (@) — para hojas sin encabezado
function _emailColByContent(data){
  var cols=data[0].length;
  for(var c=0;c<cols;c++){
    var hits=0;
    for(var i=0;i<Math.min(data.length,12);i++){
      if(String(data[i][c]||'').indexOf('@')>0) hits++;
    }
    if(hits>=1) return c;
  }
  return -1;
}
// Busca en un objeto JSON la primera clave que casa con el patrón
function _pick(obj, re){
  for(var k in obj){ if(obj.hasOwnProperty(k) && re.test(k)) return obj[k]; }
  return '';
}
function _bool(v){ return v===true?'true':_s(v); }
function _s(v){ return v==null?'':String(v).trim(); }
function _uid(email){
  var base=email.split('@')[0].replace(/[^a-z0-9]/gi,'').toLowerCase();
  return 'u_'+base+'_'+Utilities.getUuid().slice(0,4);
}
function sha256(txt){
  var raw=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(txt), Utilities.Charset.UTF_8);
  return raw.map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
}
