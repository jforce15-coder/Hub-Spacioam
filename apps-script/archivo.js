/* ═══ MEMORIA CORTA Y LARGA ════════════════════════════════════════════════════════════════════════
   Las hojas de trabajo de ALMA (cola y registro) crecían sin fin y cada lectura completa se volvía más lenta:
   el job, el Hub y la carga inicial. Una vez al día lo viejo se MUEVE (no se borra) a un archivo aparte,
   «ALMA · Archivo», con las mismas columnas. La conversación en sí nunca se pierde: el hilo real viene de
   Hospitable y de WhatsApp, que no se archivan. Si una conversación vieja se reactiva, ALMA lee el hilo
   completo de Hospitable y, para consultas sin reserva, también busca en el archivo (archivoBuscar_). */
var ARCH_REGLAS_ = [
  { tab: 'ALMA_COLA', dias: 7, col: 'recibido', soloFinales: true },
  { tab: 'ALMA_LOG', dias: 30, col: 'fecha' },
  { tab: 'ALMA_OPERATIVO', dias: 45, col: 'ts' }
];
function archivoSS_() {
  var P = PropertiesService.getScriptProperties(), id = P.getProperty('ALMA_ARCHIVO_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { console.error('archivo: ' + e); } }
  var ss = SpreadsheetApp.create('ALMA · Archivo (memoria larga)');
  P.setProperty('ALMA_ARCHIVO_ID', ss.getId());
  return ss;
}
function archivoFecha_(v) {
  if (v instanceof Date) return v.getTime();
  var s = String(v || '').trim(); if (!s) return 0;
  var t = Date.parse(s.replace(' ', 'T')); if (!isNaN(t)) return t;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0;
}
/* seco = true: solo cuenta lo que se movería. */
function archivar_(seco) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'ocupado' };
  var out = { ok: true, seco: !!seco, tablas: {} };
  try {
    var ahora = Date.now();
    ARCH_REGLAS_.forEach(function (r) {
      var sh = ssAlma_().getSheetByName(r.tab); if (!sh || sh.getLastRow() < 3) { out.tablas[r.tab] = { filas: sh ? Math.max(0, sh.getLastRow() - 1) : 0, mover: 0 }; return; }
      var v = sh.getDataRange().getValues(), cab = v[0].map(function (x) { return String(x).trim().toLowerCase(); });
      var cF = cab.indexOf(r.col), cE = cab.indexOf('estado'); if (cF < 0) cF = 0;
      var limite = ahora - r.dias * 86400000, mover = [], quedan = [v[0]];
      for (var i = 1; i < v.length; i++) {
        var t = archivoFecha_(v[i][cF]), viejo = t && t < limite;
        if (viejo && r.soloFinales && cE >= 0 && FINALES.indexOf(String(v[i][cE])) === -1) viejo = false;   // lo vivo nunca se archiva
        (viejo ? mover : quedan).push(v[i]);
      }
      out.tablas[r.tab] = { filas: v.length - 1, mover: mover.length, quedan: quedan.length - 1 };
      if (seco || !mover.length) return;
      var ss = archivoSS_(), dst = ss.getSheetByName(r.tab) || ss.insertSheet(r.tab);
      if (dst.getLastRow() < 1) dst.getRange(1, 1, 1, v[0].length).setValues([v[0]]);
      for (var k = 0; k < mover.length; k += 2000) { var lote = mover.slice(k, k + 2000); dst.getRange(dst.getLastRow() + 1, 1, lote.length, v[0].length).setValues(lote); }
      SpreadsheetApp.flush();
      /* Se reescribe la hoja viva con lo que queda (una escritura, sin borrar fila por fila). */
      sh.getRange(1, 1, v.length, v[0].length).clearContent();
      sh.getRange(1, 1, quedan.length, v[0].length).setValues(quedan);
      var sobra = sh.getMaxRows() - quedan.length; if (sobra > 500) sh.deleteRows(quedan.length + 200, sobra - 200);
    });
    if (!seco) { PropertiesService.getScriptProperties().setProperty('ARCHIVO_ULT', new Date().toISOString()); try { CacheService.getScriptCache().removeAll(['op_admins2']); } catch (e) {} }
  } finally { lock.releaseLock(); }
  return out;
}
/* Una vez al día, de madrugada en Guatemala (solo si ARCHIVO_AUTO = 1). */
function archivoSiToca_() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('ARCHIVO_AUTO') !== '1') return;
  var hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), h = +Utilities.formatDate(new Date(), CFG.TZ, 'H');
  if (h < 3 || h > 5 || P.getProperty('ARCHIVO_DIA') === hoy) return;
  P.setProperty('ARCHIVO_DIA', hoy);
  try { archivar_(false); } catch (e) { console.error('archivar_: ' + e); }
}
/* Busca en el archivo las filas de una conversación (para cuando una vieja se reactiva). */
function archivoBuscar_(tab, campo, valor) {
  var id = PropertiesService.getScriptProperties().getProperty('ALMA_ARCHIVO_ID'); if (!id || !valor) return [];
  try { var sh = SpreadsheetApp.openById(id).getSheetByName(tab); return leerTablaHoja_(sh).filter(function (r) { return s_(r[campo]) === String(valor); }); } catch (e) { return []; }
}
/* Diagnóstico de velocidad (robot): tamaño de cada hoja y cuánto tarda cada parte de lo que el Hub pide cada pocos segundos. */
function diagVelocidad_() {
  var ss = ssAlma_(), tablas = {};
  ss.getSheets().forEach(function (sh) { tablas[sh.getName()] = { filas: Math.max(0, sh.getLastRow() - 1), cols: sh.getLastColumn() }; });
  var med = function (f) { var t = Date.now(); try { f(); } catch (e) { return 'error ' + e; } return Date.now() - t; };
  var tiempos = {
    inbox: med(function () { hubInbox_(); }),
    auto: med(function () { AUTO_ = null; autoTodos_(); }),
    resueltas: med(function () { resueltasVivo_(); }),
    formsOk: med(function () { formsOk_(); }),
    cola_completa: med(function () { hubCola_(); }),
    leer_log_entero: med(function () { leerTabla_(CFG.TAB_LOG); }),
    leer_cola_entera: med(function () { leerTabla_(CFG.TAB_COLA); })
  };
  var tam = 0; try { tam = JSON.stringify(hubCola_(48)).length; } catch (e) {}
  return { ok: true, tablas: tablas, tiempos_ms: tiempos, respuesta_cola_kb: Math.round(tam / 1024), archivo: PropertiesService.getScriptProperties().getProperty('ARCHIVO_ULT') || '', auto: PropertiesService.getScriptProperties().getProperty('ARCHIVO_AUTO') || '0' };
}
