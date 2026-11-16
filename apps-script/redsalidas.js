/* ═══ RED DE SALIDAS (Juan, 16-nov-2026: «que no vuelva a pasar jamás») ═══════════════════════════════════════════
   El 15-nov la salida de Narama 623 se quedó sin limpieza: dos lecturas cortadas de Hospitable dejaron a Epi sin
   programación para el 14 y el 15, y el aviso solo llegó como un correo de Epi que nadie vio a tiempo.
   Ahora, la noche anterior (19:00) y la mañana (7:00), Alma le pide a Epi la red de salidas del día (acción
   «redSalidas», Epi-spacioam apps-script/redsalidas.js): Epi compara las salidas de Hospitable con su programación y
   deja como tentativa lo que el motor puede cubrir. Si una salida no tiene limpieza confirmada con persona, si Epi no
   pudo leer Hospitable o si Epi no contesta, queda una tarjeta «Necesita tu sí» en Pendientes del administrador
   principal, con notificación. Una vez por fecha y momento; si Epi no contesta, se reintenta a la hora siguiente
   (20:00 o 8:00) y, si tampoco, la tarjeta dice eso. Nunca se pausa por cupo (Epi y limpieza están en CUPO_NUNCA_).
   Corre desde aprender (cada hora). Check con dobles: .github/red-salidas.js. */

var RED_SAL_HORAS_ = { 19: 'noche', 20: 'noche', 7: 'manana', 8: 'manana' };   // la segunda hora es el reintento
var RED_SAL_PROP_ = 'RED_SALIDAS_HECHAS';   // { 'fecha|momento': ts }, las últimas 10
var RED_SAL_EPI_URL_ = 'https://epi.spacioam.com';

function redSalidasRevisar_() {
  var ahora = ahora_(), h = Number(Utilities.formatDate(ahora, CFG.TZ, 'H')), momento = RED_SAL_HORAS_[h];
  if (!momento) return null;
  var hoy = Utilities.formatDate(ahora, CFG.TZ, 'yyyy-MM-dd'), fecha = momento === 'noche' ? sumarDias_(hoy, 1) : hoy;
  var P = PropertiesService.getScriptProperties(), clave = fecha + '|' + momento, hechas = {};
  try { hechas = JSON.parse(P.getProperty(RED_SAL_PROP_) || '{}') || {}; } catch (e) { hechas = {}; }
  if (hechas[clave]) return { ya: true };
  cupoCanal_('Epi'); cupoFuncion_('redSalidasRevisar_');
  var r = null, error = '';
  try { var j = epiPost_('redSalidas', { fecha: fecha }); r = j && (j.data || j); } catch (e) { error = String(e && e.message || e); }
  if (!r || !r.ok) {
    if (!error) error = 'Epi no devolvió la revisión';
    if (h === 19 || h === 7) return { reintenta: true, error: error };   // a la hora siguiente se vuelve a pedir
  }
  var tarjeta = redSalidasTarjeta_(momento, fecha, r, error);
  if (tarjeta) {
    var jefe = adminsOp_().filter(function (a) { return a.principal; })[0];
    if (jefe) pendCrear_(jefe, tarjeta.c, { origen: 'red_salidas', detalle: tarjeta.detalle, push: true });
  }
  hechas[clave] = Date.now();
  var claves = Object.keys(hechas).sort(function (a, b) { return hechas[b] - hechas[a]; }).slice(0, 10), corto = {};
  claves.forEach(function (k) { corto[k] = hechas[k]; });
  P.setProperty(RED_SAL_PROP_, JSON.stringify(corto));
  return { ok: true, fecha: fecha, momento: momento, tarjeta: !!tarjeta, faltan: r && r.faltan ? r.faltan.length : null };
}

/* La tarjeta (o null si todo está cubierto). Solo nombres de propiedades y del equipo: nunca datos de huéspedes. */
function redSalidasTarjeta_(momento, fecha, r, error) {
  var cuando = momento === 'noche' ? 'Mañana' : 'Hoy', faltan = (r && r.faltan) || [], L = [], resumen, titulo;
  if (!r || !r.ok) {
    titulo = cuando + ': no pude revisar las salidas en Epi';
    resumen = 'Epi no contestó (' + String(error || 'sin respuesta').slice(0, 80) + '). Revisa que cada salida del ' + fecha + ' tenga su limpieza en Programación.';
    L.push('Fecha: ' + fecha, 'Error: ' + error);
  } else {
    var sinLectura = r.lectura && r.lectura.ok === false;
    if (!faltan.length && !sinLectura) return null;
    if (faltan.length) {
      titulo = cuando + ': ' + faltan.length + (faltan.length === 1 ? ' salida sin limpieza confirmada' : ' salidas sin limpieza confirmada');
      var nombres = faltan.slice(0, 3).map(function (f) { return f.propiedad + (f.propuesta ? ' (tentativa con ' + f.propuesta + ')' : ' (sin persona)'); });
      resumen = nombres.join(', ') + (faltan.length > 3 ? ' y ' + (faltan.length - 3) + ' más' : '') + '. Confírmalas en Programación de Epi.';
    } else {
      titulo = cuando + ': Epi no pudo leer las salidas de Hospitable';
      resumen = r.salidas == null ? 'No sé qué salidas hay el ' + fecha + ': revisa Programación de Epi.' : 'Revisé con una copia de hace ' + (r.lectura.edadH == null ? 'varias' : r.lectura.edadH) + ' h y todo está cubierto; revísalo cuando puedas.';
    }
    if (sinLectura) L.push('Epi no pudo leer Hospitable' + (r.lectura.error ? ': ' + r.lectura.error : '') + '.');
    L.push('Salidas del ' + fecha + ': ' + (r.salidas == null ? 'no sé' : r.salidas) + (r.tentativas ? ' · ' + r.tentativas + ' tentativa(s) nuevas de la red' : ''));
    faltan.forEach(function (f) {
      L.push('• ' + f.propiedad + (f.entradaHoy ? ' · tiene entrada ese día' : '') + ' — ' +
        (f.propuesta ? 'tentativa con ' + f.propuesta + ': confírmala y envía la ruta' : 'sin persona (' + (f.razon || 'sin razón') + '): asígnala a mano'));
    });
  }
  return { c: { tipo: 'atencion', area: 'proposito', proyecto: 'Operaciones', importancia: 3, titulo: titulo, resumen: resumen, aviso: resumen,
                acciones: [{ texto: 'Abrir Programación', url: RED_SAL_EPI_URL_ }] },
           detalle: L.join('\n') };
}
