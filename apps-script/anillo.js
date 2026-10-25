/* ═══ 21 · PRUEBA DEL ANILLO (QRing / Colmi) ═══════════════════════════════════════════════════════════════
   La página hub.spacioam.com/anillo/ (abierta en Bluefy, que sí deja usar Bluetooth en el iPhone) se conecta al anillo
   de Juan, lee su acelerómetro y lo que manda al tocarlo o girarlo, y guarda aquí lo que pasó para que Claude lo lea
   sin capturas. Solo es diagnóstico: no hay datos de nadie más, se limita el tamaño y la frecuencia, y se guarda en la
   hoja ALMA_ANILLO. Claude lo lee con el robot (dsBot · action «anillo»). */

var ANILLO_CAB_ = ['fecha', 'sesion', 'equipo', 'eventos'];
function anilloGuardar_(body) {
  var c = CacheService.getScriptCache(), k = 'anillo_rate_' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0);
  if (n > 40) return { ok: false, error: 'demasiados' };
  c.put(k, String(n + 1), 120);
  var ev = body.eventos; if (!Array.isArray(ev) || !ev.length) return { ok: true, vacio: true };
  var txt = JSON.stringify(ev.slice(0, 400)); if (txt.length > 45000) txt = txt.slice(0, 45000);
  try {
    hojaCrear_('ALMA_ANILLO', ANILLO_CAB_).appendRow([new Date().toISOString(), String(body.sesion || '').slice(0, 40), String(body.equipo || '').slice(0, 160), txt]);
  } catch (e) { return { ok: false, error: String(e) }; }
  return { ok: true };
}
/* Robot: las últimas filas (por defecto 30) para leer una prueba completa. */
function anilloLeer_(n) {
  var sh = ssAlma_().getSheetByName('ALMA_ANILLO'); if (!sh || sh.getLastRow() < 2) return { ok: true, filas: [] };
  n = Math.min(200, Number(n) || 30);
  var desde = Math.max(2, sh.getLastRow() - n + 1);
  var v = sh.getRange(desde, 1, sh.getLastRow() - desde + 1, 4).getValues();
  return { ok: true, filas: v.map(function (r) { var e = []; try { e = JSON.parse(r[3]); } catch (x) {} return { fecha: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), sesion: String(r[1]), equipo: String(r[2]), eventos: e }; }) };
}
