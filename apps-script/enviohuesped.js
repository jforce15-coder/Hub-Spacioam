/* ═══ ENVÍO A UN HUÉSPED DESDE EL CHAT CON ALMA ═══════════════════════════════════════════════════════════════════════
   Pasó el 7-nov (Oscar, Brunelo 1808, HMWM942RSN): Alma le mostró a Juan el borrador por WhatsApp, Juan dijo «Si» y
   Alma contestó «No pudo salir por la plataforma — la reserva no tiene conversación activa». Sí la tenía: Alma misma le
   había escrito ahí a las 5:54 pm. La fila de la bandeja (ALMA_INBOX) de esa reserva no tenía el código (95 filas de
   noviembre están así), y agResId_ y agElegirReserva_ solo encontraban la conversación por ese código: devolvían «no
   encontré una reserva … con conversación» y Alma lo tradujo a otra causa. Ya había pasado el 1-nov (Elvin, Modra 311)
   y a las 12:53 del mismo 7-nov (Eloísa, Ignacio 1104). Ahora:
   · reservaConv_: el código lleva a su conversación aunque la bandeja no lo tenga (bandeja → columna reservation_uuid de
     Reservas → Hospitable en vivo por la fecha de llegada) y completa la fila de la bandeja.
   · Borrador de reserva: enviar_a_huesped con borrador = true guarda a qué reserva va (su uuid exacto) y el texto; el
     «sí» de Juan en un mensaje nuevo lo envía a ESA reserva, sin volver a buscar por nombre.
   · hospEnviarMensaje_: si Hospitable falla de paso (5xx o sin respuesta; el 429 ya lo reintenta hosp_), reintenta una
     vez; si sigue, devuelve el error real («Hospitable respondió 429…»), nunca una causa inventada. */
var RESERVA_BORRADOR_SEG_ = 3600, RESERVA_CONV_SEG_ = 21600;

function reservaCodigoNorm_(c) { return String(c || '').toUpperCase().replace(/\s+/g, ''); }
function reservaFila_(codigo) {
  var C = reservaCodigoNorm_(codigo); if (!C) return null;
  return leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return reservaCodigoNorm_(r.code) === C; }).pop() || null;
}
/* La conversación (uuid de Hospitable) de una reserva por su código: { conv_id } o { error } con el motivo real.
   vivo = false: solo la bandeja y la hoja, sin llamar a Hospitable. */
function reservaConv_(codigo, fila, vivo, inbox) {
  var C = reservaCodigoNorm_(codigo); if (!C) return { error: 'falta el código de la reserva' };
  var ib = (inbox || hubInbox_()).filter(function (x) { return reservaCodigoNorm_(x.codigo) === C && x.conv_id && !/^(wa|op|inq):/.test(x.conv_id); })[0];
  if (ib) return { conv_id: String(ib.conv_id) };
  var cache = CacheService.getScriptCache(), k = 'rconv_' + C, c0 = cache.get(k);
  if (c0) return { conv_id: c0 };
  if (fila === undefined) fila = reservaFila_(C);
  if (!fila) return { error: 'el código ' + C + ' no está en la hoja de reservas' };
  var uu = s_(fila.reservation_uuid).trim();
  if (/^[0-9a-f-]{20,}$/i.test(uu)) { cache.put(k, uu, RESERVA_CONV_SEG_); reservaConvReparar_(uu, C, fila, inbox); return { conv_id: uu }; }
  if (!vivo) return { error: 'la bandeja todavía no tiene la conversación de ' + C };
  var ci = fecha_(fila.checkin_date); if (!ci) return { error: 'la reserva ' + C + ' no tiene fecha de llegada en la hoja' };
  var ids = idsPropiedades_(); if (!ids.length) return { error: 'no pude leer las propiedades de Hospitable' };
  var falla = 0;
  for (var i = 0; i < ids.length; i += 40) {
    var qs = ids.slice(i, i + 40).map(function (x) { return 'properties[]=' + encodeURIComponent(x); }).join('&');
    var r = hosp_('get', '/reservations?' + qs + '&date_query=checkin&start_date=' + sumarDias_(ci, -1) + '&end_date=' + sumarDias_(ci, 1) + '&per_page=100');
    if (r.code !== 200) { falla = r.code || -1; continue; }
    var hit = ((r.json && r.json.data) || []).filter(function (x) { return reservaCodigoNorm_(x.code) === C || reservaCodigoNorm_(x.platform_id) === C; })[0];
    if (hit && s_(hit.id)) { cache.put(k, s_(hit.id), RESERVA_CONV_SEG_); reservaConvReparar_(s_(hit.id), C, fila, inbox); return { conv_id: s_(hit.id) }; }
  }
  return { error: falla ? hospErrorTexto_(falla < 0 ? 0 : falla) : 'Hospitable no tiene la reserva ' + C + ' con llegada el ' + ci };
}
/* La fila de la bandeja que perdió su código lo recupera (así la próxima búsqueda no vuelve a Hospitable). */
function reservaConvReparar_(uuid, codigo, fila, inbox) {
  try {
    var ib = (inbox || hubInbox_()).filter(function (x) { return String(x.conv_id) === uuid; })[0];
    if (!ib || reservaCodigoNorm_(ib.codigo) === codigo) return;
    inboxUpsert_(uuid, { codigo: codigo, propiedad: ib.propiedad ? '' : s_(fila && fila.property_name), checkin: ib.checkin ? '' : fecha_(fila && fila.checkin_date), checkout: ib.checkout ? '' : fecha_(fila && fila.checkout_date), tipo: ib.tipo ? '' : 'reserva' });
  } catch (e) { console.error('reservaConvReparar_: ' + e); }
}

/* ── Errores de Hospitable, tal cual ── */
function hospErrorTexto_(code, json) {
  var m = '';
  try { var e = json && (json.message || json.error || json.errors); m = (typeof e === 'string' ? e : e ? JSON.stringify(e) : '').slice(0, 160); } catch (x) {}
  if (code === 429) return 'Hospitable respondió 429 (demasiados pedidos seguidos); reintenta en un minuto';
  if (code >= 500) return 'Hospitable respondió ' + code + ' (falla de su lado); reintenta en un minuto';
  if (!code) return 'Hospitable no respondió (sin conexión o se agotó el tiempo); reintenta en un minuto';
  return 'Hospitable respondió ' + code + (m ? ': ' + m : '');
}
function hospTransitorio_(code) { return !code || code >= 500; }   // el 429 ya lo reintenta hosp_ con su espera
/* Mensaje a la conversación de una reserva. Un error de paso se reintenta una sola vez. */
function hospEnviarMensaje_(resId, texto) {
  var ruta = '/reservations/' + resId + '/messages', r = hosp_('post', ruta, { body: texto }), otra = false;
  if (hospTransitorio_(r.code)) { Utilities.sleep(1500); r = hosp_('post', ruta, { body: texto }); otra = true; }
  if (r.code >= 200 && r.code < 300) return { ok: true, code: r.code, reintento: otra };
  return { ok: false, code: r.code, reintento: otra, error: hospErrorTexto_(r.code, r.json) + (otra ? ' (ya lo reintenté una vez)' : '') };
}

/* ── Borrador de reserva: el «sí» va a la reserva exacta del borrador ── */
function reservaBorradorClave_(adm) { return 'RESERVA_BORR_' + String((adm && adm.email) || '').toLowerCase(); }
function reservaBorradorPendiente_(adm) {
  try { return JSON.parse(CacheService.getScriptCache().get(reservaBorradorClave_(adm)) || 'null'); } catch (e) { return null; }
}
function reservaBorradorGuardar_(adm, ficha, texto, canal) {
  var turno = String(typeof AGENTE_TEXTO_ === 'undefined' ? '' : AGENTE_TEXTO_ || '');
  var b = { conv_id: ficha.conv_id, codigo: ficha.codigo || '', huesped: ficha.huesped || '', propiedad: ficha.propiedad || '', texto: texto, canal: canal || 'plataforma', turno: turno };
  var c = CacheService.getScriptCache();
  c.put(reservaBorradorClave_(adm), JSON.stringify(b), RESERVA_BORRADOR_SEG_);
  try { c.remove('CONSULTA_BORR_' + String((adm && adm.email) || '').toLowerCase()); } catch (e) {}   // el último borrador es el que espera el sí
  return b;
}
function reservaBorradorBorrar_(adm) { try { CacheService.getScriptCache().remove(reservaBorradorClave_(adm)); } catch (e) {} }
function reservaNombreNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 3; }); }
/* ¿El «sí» es para el borrador pendiente? Sí, si no dice a quién o si lo que dice (código, uuid, nombre o apartamento) es
   de esa misma reserva. Si nombra a otra persona, no: se busca de nuevo. */
function reservaBorradorCoincide_(b, inp) {
  if (!b || !b.conv_id) return false;
  var cod = String(inp.codigo || '').trim(), hu = String(inp.huesped || '').trim(), pr = String(inp.propiedad || '').trim();
  if (!cod && !hu && !pr) return true;
  if (cod) return cod === b.conv_id || reservaCodigoNorm_(cod) === reservaCodigoNorm_(b.codigo);
  var nb = reservaNombreNorm_(b.huesped), nh = reservaNombreNorm_(hu);
  var aptB = (String(b.propiedad).match(/\d{2,4}[a-z]?/gi) || []).map(function (x) { return x.toLowerCase(); }), aptP = (pr.match(/\d{2,4}[a-z]?/gi) || []).map(function (x) { return x.toLowerCase(); });
  var porNombre = nh.length && nh.some(function (w) { return nb.indexOf(w) >= 0; }), porApto = aptP.length && aptP.some(function (x) { return aptB.indexOf(x) >= 0; });
  return hu ? !!porNombre && (!aptP.length || !!porApto) : !!porApto;
}
/* A quién va (para el borrador y para decir a quién salió) cuando la reserva vino por su código o uuid. */
function reservaFichaDeConv_(rid, codigo, inbox) {
  var ib = (inbox || hubInbox_()).filter(function (x) { return String(x.conv_id) === rid; })[0] || {};
  var C = reservaCodigoNorm_(ib.codigo || (/^[0-9a-f-]{20,}$/i.test(String(codigo || '')) ? '' : codigo)), f = C ? reservaFila_(C) : null;
  return { conv_id: rid, codigo: C, huesped: f ? [s_(f.guest_first_name), s_(f.guest_last_name)].join(' ').trim() : s_(ib.huesped), propiedad: f ? s_(f.property_name) : s_(ib.propiedad) };
}
