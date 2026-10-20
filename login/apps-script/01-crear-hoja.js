/**********************************************************************
 * SPACIO AM · CONTROL DE USUARIOS UNIFICADO
 * 01 · CREAR Y FORMATEAR LA HOJA
 * --------------------------------------------------------------------
 * Pega este archivo en el Apps Script ligado a la hoja
 *   1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U  (Control de usuarios)
 * y ejecuta  setupControlUsuarios()  una sola vez.
 *
 * Crea 2 pestañas con formato de marca Spacio AM:
 *   · Usuarios          — la fuente única (una fila por persona)
 *   · Catálogo de roles — roles por app; agregar filas NO toca código
 *
 * No borra datos existentes: si las pestañas ya existen, solo
 * reaplica encabezados, formato y validaciones.
 **********************************************************************/

// ---- Paleta de marca (del design system) ----
var SA = {
  ink:     '#3E3F3F',  // texto primario
  alab:    '#FAFAFA',  // fondo
  beige:   '#F5F3F0',  // banda alterna
  white:   '#FFFFFF',
  grey:    '#D8D4CE',  // divisores
  graph:   '#6F6867',  // texto secundario
  peach:   '#E9826A',  // acento
  peachTint:'#FBE9E4', // tinte de atención
  success: '#3d6b52',
  successTint:'#E4EDE8',
  attTxt:  '#B54D36'   // atención legible
};

var USERS_HEADERS = [
  'user_id','primer_nombre','segundo_nombre','primer_apellido','segundo_apellido','nombre',
  'email','email_alterno','password_hash','foto',
  'estado','es_dueno','es_socio',
  'perm_mi','perm_epi','perm_grow','perm_hola',
  'telefono','notas','creado','actualizado'
];

// Valores válidos por app (deben existir en el Catálogo de roles)
var ROLES = {
  estado: ['activo','suspendido'],
  bool:   ['sí','no'],
  mi:     ['','admin_principal','socio','contador'],
  epi:    ['','admin_principal','admin_secundario','supervisor','colaborador_admin',
           'tecnico_limpieza','tecnico_mantenimiento','proveedor_externo'],
  grow:   ['','admin_principal','admin_secundario','personal_campo',
           'compras_montaje','dueno'],
  hola:   ['','admin_principal','admin_secundario','huesped_principal',
           'huesped_adicional']
};

// ID de la hoja «Control de usuarios». Se usa openById porque este
// Apps Script es un proyecto INDEPENDIENTE (no está ligado a la hoja).
var CONTROL_SHEET_ID = '1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U';

function setupControlUsuarios() {
  var ss = SpreadsheetApp.openById(CONTROL_SHEET_ID);
  _buildUsuarios(ss);
  _buildCatalogo(ss);
  Logger.log('Listo. Hoja «Control de usuarios» creada y con formato de marca.');
}

function _buildUsuarios(ss) {
  var sh = ss.getSheetByName('Usuarios') || ss.insertSheet('Usuarios', 0);
  sh.clearFormats();
  var nCols = USERS_HEADERS.length;

  // Encabezado
  var head = sh.getRange(1, 1, 1, nCols);
  head.setValues([USERS_HEADERS])
      .setBackground(SA.ink).setFontColor(SA.alab)
      .setFontFamily('Montserrat').setFontSize(9).setFontWeight('bold')
      .setVerticalAlignment('middle').setHorizontalAlignment('left');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);

  // Cuerpo: tipografía + bandas alternas
  var maxRows = Math.max(sh.getMaxRows(), 400);
  if (sh.getMaxRows() < 400) sh.insertRowsAfter(sh.getMaxRows(), 400 - sh.getMaxRows());
  var body = sh.getRange(2, 1, maxRows - 1, nCols);
  body.setFontFamily('Montserrat').setFontSize(10).setFontColor(SA.ink)
      .setVerticalAlignment('middle');
  var banding = sh.getRange(1, 1, maxRows, nCols);
  try { banding.getBandings().forEach(function(b){ b.remove(); }); } catch(e){}
  banding.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  var band = banding.getBandings()[0];
  if (band) band.setHeaderRowColor(SA.ink).setFirstRowColor(SA.white)
                .setSecondRowColor(SA.beige);

  // Anchos
  var widths = [110,140,140,140,140,180,220,220,150,160,100,80,80,150,160,150,150,130,220,130,130];
  widths.forEach(function(w,i){ if(i<nCols) sh.setColumnWidth(i+1, w); });

  // Validaciones (dropdowns) — primero LIMPIA todas las validaciones viejas
  // (de esquemas anteriores) en TODO el ancho, para que ninguna quede pegada a
  // una columna equivocada (p. ej. «estado» sobre «email»).
  sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearDataValidations();
  _dropdown(sh, 'estado',    ROLES.estado);
  _dropdown(sh, 'es_dueno',  ROLES.bool);
  _dropdown(sh, 'es_socio',  ROLES.bool);
  _dropdown(sh, 'perm_mi',   ROLES.mi);
  _dropdown(sh, 'perm_epi',  ROLES.epi);
  _dropdown(sh, 'perm_grow', ROLES.grow);
  _dropdown(sh, 'perm_hola', ROLES.hola);

  // Formato condicional
  _clearRules(sh);
  var rules = [];
  var colEstado = _colLetter(_idx('estado')+1);
  var rngAll = sh.getRange(2, 1, maxRows-1, nCols);
  // Suspendido → fila en tinte peach + texto atención
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$'+colEstado+'2="suspendido"')
    .setBackground(SA.peachTint).setFontColor(SA.attTxt).setRanges([rngAll]).build());
  // Activo → celda estado en tinte success
  var rngEstado = sh.getRange(2, _idx('estado')+1, maxRows-1, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('activo').setBackground(SA.successTint).setFontColor(SA.success)
    .setRanges([rngEstado]).build());
  // Roles admin_principal → tinte cálido en cada perm_*
  ['perm_mi','perm_epi','perm_grow','perm_hola'].forEach(function(c){
    var r = sh.getRange(2, _idx(c)+1, maxRows-1, 1);
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('admin_principal').setBackground(SA.peachTint)
      .setFontColor(SA.attTxt).setRanges([r]).build());
  });
  sh.setConditionalFormatRules(rules);
  sh.getRange(1,1,1,nCols).setBorder(false,false,true,false,false,false,SA.peach,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function _buildCatalogo(ss) {
  var sh = ss.getSheetByName('Catálogo de roles') || ss.insertSheet('Catálogo de roles');
  sh.clear();
  var headers = ['app','rol','nombre_visible','descripcion','puede_editar_usuarios','notas'];
  var rows = [
    ['MI','admin_principal','Administrador principal','Todo: reportes, depósitos, contabilidad, setup, usuarios','sí',''],
    ['MI','socio','Socio','Solo sus propiedades y reportes; sube facturas','no','suele ser dueño'],
    ['MI','contador','Contador','Solo pestaña Contabilidad (lectura)','no',''],
    ['EPI','admin_principal','Administrador principal','Todo incl. Seguridad y Empresa','sí',''],
    ['EPI','admin_secundario','Administrador secundario','Operación diaria; sin Seguridad/Empresa ni editar otros admins','sí','ej. gasturias@spacioam.com'],
    ['EPI','supervisor','Supervisor / encargado','Agenda y control de calidad; revisa limpiezas','no','isSupervisor=true'],
    ['EPI','colaborador_admin','Colaborador administrativo','Planilla, sin panel admin','no',''],
    ['EPI','tecnico_limpieza','Técnico de limpieza','Agenda por zonas; marca limpiezas','no','interno'],
    ['EPI','tecnico_mantenimiento','Técnico de mantenimiento','Agenda de mantenimiento','no','interno'],
    ['EPI','proveedor_externo','Proveedor externo','Trabajos asignados; control de pagos y facturas','no','categoría libre'],
    ['GROW','admin_principal','Administrador principal','Todo incl. contratos y reuniones con socios','sí',''],
    ['GROW','admin_secundario','Administrador secundario','Proyectos y ejecución; sin Contratos','sí','oculta pestaña Contratos'],
    ['GROW','personal_campo','Personal de campo','Ejecución y tareas asignadas','no',''],
    ['GROW','compras_montaje','Compras y montaje','Facturas y control de compras/recepción','no',''],
    ['GROW','dueno','Dueño','Ve avance de su proyecto (lectura)','no','puede no ser socio'],
    ['HOLA','admin_principal','Administrador principal','Panel completo incl. pestaña Accesos','sí',''],
    ['HOLA','admin_secundario','Administrador secundario','Registros y seguimiento; sin pestaña Accesos','no',''],
    ['HOLA','huesped_principal','Huésped principal','Su reserva, check-in, guía, factura','no',''],
    ['HOLA','huesped_adicional','Huésped adicional','Su documento y su espacio de la reserva','no','']
  ];
  sh.getRange(1,1,1,headers.length).setValues([headers])
    .setBackground(SA.ink).setFontColor(SA.alab).setFontFamily('Montserrat')
    .setFontSize(9).setFontWeight('bold');
  sh.getRange(2,1,rows.length,headers.length).setValues(rows)
    .setFontFamily('Montserrat').setFontSize(10).setFontColor(SA.ink);
  sh.setRowHeight(1,34); sh.setFrozenRows(1);
  [90,190,220,360,150,220].forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
  var mr = sh.getRange(1,1,rows.length+1,headers.length);
  try { mr.getBandings().forEach(function(b){b.remove();}); } catch(e){}
  mr.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,true,false);
  var b = mr.getBandings()[0];
  if (b) b.setHeaderRowColor(SA.ink).setFirstRowColor(SA.white).setSecondRowColor(SA.beige);
}

// ---- helpers ----
function _idx(name){ return USERS_HEADERS.indexOf(name); }
function _dropdown(sh, col, values){
  var c = _idx(col)+1, maxRows = sh.getMaxRows();
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true)
    .setAllowInvalid(false).build();
  sh.getRange(2, c, maxRows-1, 1).setDataValidation(rule);
}
function _clearRules(sh){ sh.setConditionalFormatRules([]); }
function _colLetter(n){ var s=''; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=(n-m-1)/26; } return s; }
