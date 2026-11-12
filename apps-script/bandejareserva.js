/* ═══ BANDEJA: LA CONSULTA QUE SE VUELVE RESERVA ═══════════════════════════════════════════════════════════════════════
   En noviembre había 95 filas de reserva en la bandeja (ALMA_INBOX) sin código, entre ellas la de Oscar (Brunelo 1808,
   7-nov): Alma no encontraba la conversación por el código (#475 lo esquivó al usarla). Todas venían de una consulta
   que se volvió reserva (ALMA_VINCULOS tiene inqres_<consulta> → <reserva>). La causa, en el origen:
   · vincularReserva_ (Código.js) movía la fila de «inq:<consulta>» al uuid de la reserva y le ponía tipo «reserva», pero
     el código, la propiedad y las fechas se quedaban los de la consulta: la consulta no tiene código. Casi siempre la
     fusión la hace el aviso reservation.created (reservaCambio_) o la búsqueda de reservaDeConsulta_, sin un mensaje
     detrás que vuelva a leer la reserva; y la pasada de la bandeja (sincronizarInbox_) solo repasa lo de las últimas 48 h.
   · reservaCambio_ comparaba la reserva con las fechas que tenía la fila (las de la consulta) y, si no había diferencia,
     no escribía nada; si la había, escribía fechas y propiedad, nunca el código.
   · Los vínculos (cres_, inqres_) se guardaban antes de mover la fila: si el candado no llegaba en 10 s (procesarCola lo
     tiene toda su pasada), la fila se quedaba «inq:» para siempre y nada lo volvía a intentar.
   · preContexto_ de «inq:<consulta>» seguía devolviendo la consulta (tipo consulta, sin código) aunque ya fuera reserva, y
     lo que llegaba sin reservation_id abría otra fila «inq:» al lado de la reserva.
   Ahora la fila toma el código, la propiedad y las fechas de la reserva al fusionarse (del dato que ya llega o de
   Hospitable), con cada aviso de cambio de la reserva, y las filas viejas se reparan una sola vez (BANDEJA_CODIGOS_V1).
   Prueba con dobles: .github/bandeja-codigos.js. */
var BANDEJA_CODIGOS_TOPE_ = 12, BANDEJA_CODIGOS_SEG_ = 25;
var BANDEJA_UUID_ = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Lo que la fila de la bandeja toma de una reserva de Hospitable (la de la API o la del aviso reservation.*). */
function bandejaDatosReserva_(res) {
  res = res || {};
  var prop = (res.properties && res.properties[0]) || res.property || {}, g = res.guest || {}, plat = res.platform || res.channel || res.source;
  return {
    codigo: s_(res.code) || s_(res.platform_id),
    propiedad: s_(prop.name) || s_(prop.public_name),
    huesped: [s_(g.first_name), s_(g.last_name)].filter(Boolean).join(' ') || s_(g.name),
    foto: s_(g.picture_url) || s_(g.profile_picture) || s_(g.thumbnail_url),
    checkin: s_(res.check_in || res.arrival_date).slice(0, 10),
    checkout: s_(res.check_out || res.departure_date).slice(0, 10),
    canal: plat ? canalPlat_(plat) : '',
    tipo: 'reserva'
  };
}

/* La fila de la bandeja de una reserva toma su código, propiedad y fechas. res: la reserva que ya llegó (si falta algo,
   preContexto_ la lee de Hospitable, salvo soloDato). Nunca abre una fila nueva. Devuelve lo que escribió o null. */
function bandejaReservaCompletar_(resId, res, soloDato) {
  resId = s_(resId); if (!BANDEJA_UUID_.test(resId)) return null;
  var d = bandejaDatosReserva_(res);
  if (!soloDato && (!d.codigo || !d.propiedad || !d.checkin)) {
    var p = {}; try { p = preContexto_(resId) || {}; } catch (e) {}
    ['codigo', 'propiedad', 'huesped', 'foto', 'checkin', 'checkout', 'canal'].forEach(function (k) { if (!d[k] && p[k]) d[k] = p[k]; });
  }
  if (!d.codigo) return null;   // Hospitable no contestó: lo vuelve a intentar el siguiente aviso o la reparación
  inboxUpsert_(resId, Object.assign({ _soloSiExiste: true }, d));
  return d;
}

/* Una sola vez (BANDEJA_CODIGOS_V1), en la pasada de fondo de procesarCola: las filas de reserva que se quedaron sin
   código toman código, propiedad y fechas de Hospitable. Por vuelta, a lo mucho BANDEJA_CODIGOS_TOPE_ filas y
   BANDEJA_CODIGOS_SEG_ segundos. Lo que Hospitable no reconoce (404, o una reserva sin código) se anota y no se reintenta;
   un 429 o 5xx se reintenta en la siguiente vuelta. Cada fila reparada queda en el registro de la ejecución y, al
   terminar, la propiedad del script dice cuándo y cuántas. o.forzar: correrla otra vez (desde el editor). */
function bandejaCodigosReparar_(o) {
  o = o || {};
  var P = PropertiesService.getScriptProperties();
  if (!o.forzar && P.getProperty('BANDEJA_CODIGOS_V1')) return { hecho: true, reparadas: 0 };
  var av = {}; try { av = JSON.parse(P.getProperty('BANDEJA_CODIGOS_V1_AVANCE') || '{}') || {}; } catch (e) {}
  av.reparadas = av.reparadas || 0; av.sin = av.sin || [];
  var sin = {}; av.sin.forEach(function (id) { sin[id] = 1; });
  var sh = ssAlma_().getSheetByName('ALMA_INBOX'), n = sh ? sh.getLastRow() : 0;
  var cand = n < 2 ? [] : sh.getRange(2, 1, n - 1, 2).getValues().filter(function (v) {
    var id = s_(v[0]); return BANDEJA_UUID_.test(id) && !s_(v[1]).trim() && !sin[id];
  }).map(function (v) { return s_(v[0]); });
  var tope = o.tope || BANDEJA_CODIGOS_TOPE_, hasta = Date.now() + (o.seg || BANDEJA_CODIGOS_SEG_) * 1000;
  var hechas = 0, vistas = 0, pendientes = 0;
  for (var i = 0; i < cand.length; i++) {
    if (vistas >= tope || Date.now() > hasta) { pendientes += cand.length - i; break; }
    var id = cand[i]; vistas++;
    var r = hosp_('get', '/reservations/' + id + '?include=properties,guest');
    var d = r.code === 200 && r.json && r.json.data ? bandejaDatosReserva_(r.json.data) : null;
    if (d && d.codigo) {
      inboxUpsert_(id, Object.assign({ _soloSiExiste: true }, d)); hechas++;
      console.log('bandeja reparada: ' + id + ' → ' + d.codigo + ' · ' + (d.propiedad || 'sin propiedad') + ' · ' + (d.checkin || '?') + ' a ' + (d.checkout || '?'));
    } else if (d || r.code === 404 || r.code === 400 || r.code === 422) { av.sin.push(id); console.log('bandeja sin reparar: ' + id + ' (Hospitable ' + r.code + (d ? ', sin código' : '') + ')'); }
    else pendientes++;   // 429, 5xx o sin respuesta: la siguiente vuelta
  }
  av.reparadas += hechas; av.sin = av.sin.slice(-200);   // una propiedad del script guarda hasta 9 KB
  if (!pendientes) {
    P.setProperty('BANDEJA_CODIGOS_V1', new Date().toISOString() + ' · ' + av.reparadas + ' reparadas · ' + av.sin.length + ' sin código en Hospitable');
    P.deleteProperty('BANDEJA_CODIGOS_V1_AVANCE');
  } else P.setProperty('BANDEJA_CODIGOS_V1_AVANCE', JSON.stringify(av));
  return { hecho: !pendientes, reparadas: hechas, quedan: pendientes };
}
