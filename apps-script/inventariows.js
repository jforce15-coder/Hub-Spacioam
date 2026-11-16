/* ═══ INVENTARIO PARA EL TRASLADO A WORKSPACE (docs/specs/traslado-workspace.md · T1) ═══════════════════════════════
   Acción de solo lectura del robot (dsBot «inventario_ws»): lo que el código no muestra y hace falta para pasar el Hub a
   la cuenta Workspace. No escribe nada, no cambia permisos y no devuelve valores de llaves ni datos de personas.
   · propiedades: solo los NOMBRES de las Propiedades del script (nunca el valor).
   · activadores: los vivos del proyecto (función, tipo y origen).
   · archivos: para cada hoja o carpeta conocida (las del código, las Propiedades que guardan un id, las carpetas del
     cerebro y los ids extra que mande el robot en «ids»), su nombre, si este script la puede abrir, si es de la misma
     cuenta del script y la carpeta donde vive (para compartir la carpeta entera con un solo clic).
   · calendario: si CALENDARIO_JUAN existe (sin su valor). */
var INV_WS_PROPS_ID_ = ['ALMA_ARCHIVO_ID', 'SHEET_PROPIETARIOS_ID', 'ADJ_CARPETA_ID', 'ALMA_ARCH_CARPETA_ID', 'CONF_CARPETA',
  'FOTOS_CT_CARPETA_ID', 'VIAJES_CARPETA', 'WA_CARPETA'];
var INV_WS_MAX_ = 60;

/* Las hojas y carpetas que el Hub conoce, como [{ origen, id }] sin repetir. */
function invWsIds_(extra) {
  var out = [], visto = {}, add = function (origen, id) {
    id = String(id || '').trim(); if (!/^[\w-]{20,}$/.test(id) || visto[id] || out.length >= INV_WS_MAX_) return;
    visto[id] = 1; out.push({ origen: origen, id: id });
  };
  add('CFG.SHEET_ALMA_ID', CFG.SHEET_ALMA_ID); add('CFG.SHEET_WEBAPP_ID', CFG.SHEET_WEBAPP_ID); add('CFG.SHEET_EPI_ID', CFG.SHEET_EPI_ID);
  if (typeof SHEET_ACCESOS_ID !== 'undefined') add('SHEET_ACCESOS_ID', SHEET_ACCESOS_ID);
  if (typeof RMES_HOJA_ !== 'undefined') add('RMES_HOJA_', RMES_HOJA_);
  var P = PropertiesService.getScriptProperties();
  INV_WS_PROPS_ID_.forEach(function (k) { add('propiedad ' + k, P.getProperty(k)); });
  try {
    var sh = ssAlma_().getSheetByName('ALMA_CEREBRO_FUENTES'), n = sh ? sh.getLastRow() : 0;   // leer, nunca crear la pestaña
    if (n >= 2) sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (v) { if (String(v[0] || 'drive').toLowerCase() === 'drive') add('cerebro', v[1]); });
  } catch (e) { console.error('inventario_ws · cerebro: ' + e); }
  (Array.isArray(extra) ? extra : []).forEach(function (x) {
    if (x && typeof x === 'object') add('extra ' + String(x.origen || '').slice(0, 40), x.id); else add('extra', x);
  });
  return out;
}

/* Nombre, si se abre, si es de la cuenta del script y la carpeta que la contiene. Primero como archivo, luego como carpeta. */
function invWsArchivo_(x, yo) {
  var o = { origen: x.origen, id: x.id, fin: x.id.slice(-6), abre: false };
  var f = null, tipo = '';
  try { f = DriveApp.getFileById(x.id); tipo = String(f.getMimeType() || '').indexOf('spreadsheet') >= 0 ? 'hoja' : 'archivo'; } catch (e) { f = null; }
  if (!f) { try { f = DriveApp.getFolderById(x.id); f.getName(); tipo = 'carpeta'; } catch (e) { f = null; } }
  if (!f) { o.error = 'no se puede abrir'; return o; }
  o.abre = true; o.tipo = tipo;
  try { o.nombre = String(f.getName() || ''); } catch (e) {}
  try { var d = f.getOwner(); o.propia = !!(d && yo && String(d.getEmail() || '').toLowerCase() === yo); } catch (e) {}
  try { var ps = f.getParents(); if (ps.hasNext()) { var p = ps.next(); o.carpeta = { id: p.getId(), nombre: String(p.getName() || '') }; } } catch (e) {}
  return o;
}

function invWsInventario_(body) {
  body = body || {};
  var P = PropertiesService.getScriptProperties(), yo = '';
  try { yo = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) {}
  var nombres = Object.keys(P.getProperties() || {}).sort();
  var activadores = [];
  try {
    activadores = ScriptApp.getProjectTriggers().map(function (t) {
      return { funcion: t.getHandlerFunction(), tipo: String(t.getEventType()), origen: String(t.getTriggerSource()) };
    });
  } catch (e) { activadores = [{ error: String(e).slice(0, 120) }]; }
  var archivos = invWsIds_(body.ids).map(function (x) { return invWsArchivo_(x, yo); });
  return {
    ok: true,
    cuenta_gmail: /@gmail\.com$/.test(yo),
    propiedades: nombres,
    activadores: activadores,
    archivos: archivos,
    calendario_juan: !!P.getProperty('CALENDARIO_JUAN')
  };
}
