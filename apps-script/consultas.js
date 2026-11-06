/* ═══ CONSULTAS (inquiries) PARA ALMA ═══════════════════════════════════════════════════════════════════════════════
   Una consulta es quien escribió por Airbnb (o Booking) sin reservar todavía. Vive en ALMA_INBOX con conv_id «inq:<uuid>»
   y tipo «consulta»; se le responde por Hospitable (/inquiries/<uuid>/messages: hosp_ cambia la ruta sola).
   Pasó el 5-nov: Juan pidió por voz tres veces «escríbele a la interesada del 725 de Narama» y Alma nunca la
   encontró: buscar_reservas solo leía la hoja Reservas y enviar_a_huesped descartaba las «inq:». Ahora:
   · consultasBuscar_: por nombre (tolera un nombre mal transcrito), propiedad o apartamento, fecha, o la más reciente.
   · consultaElegir_: a cuál va el mensaje (una sola; si hay varias, las opciones para preguntar).
   · consultaBorrador_: un mensaje a una consulta es un mensaje a un tercero: la primera vez solo arma el borrador y lo
     guarda; sale con confirmado = true en un mensaje NUEVO de Juan (otro turno) y el mismo texto (como Responder en el
     hilo, correohilo.js). El código lo exige, no el prompt. */
var CONSULTA_BORRADOR_SEG_ = 3600;
/* Juan aprobó una propuesta de un agente que escribe a una consulta (agDecidir_, agentes.js): esa aprobación ya es su sí. */
var CONSULTA_APROBADA_ = false;

/* Las consultas de la bandeja que siguen vivas: salida desde hace 14 días o actividad en los últimos 14 días. */
function consultasVivas_(inbox, hoy) {
  var corte = new Date(Date.now() - 14 * 864e5).toISOString(), desde = sumarDias_(hoy, -14);
  return (inbox || []).filter(function (x) {
    if (String(x.conv_id || '').indexOf('inq:') !== 0) return false;
    var sale = String(x.checkout || '').slice(0, 10), act = String(x.ultimo_guest_ts || x.ultimo_ts || x.actualizado || '');
    return (sale && sale >= desde) || act >= corte;
  });
}
/* La más reciente primero (la que acaba de entrar es la del último mensaje del huésped). */
function consultaReciente_(a, b) { return String(b.ultimo_guest_ts || b.ultimo_ts || '').localeCompare(String(a.ultimo_guest_ts || a.ultimo_ts || '')); }
/* Devuelve [{ item, coincidencia }]. texto: nombre, propiedad o apartamento; f: un día dentro de la consulta (YYYY-MM-DD). */
function consultasBuscar_(texto, f, inbox, hoy, max) {
  var vivas = consultasVivas_(inbox, hoy).filter(function (x) {
    var ci = String(x.checkin || '').slice(0, 10), co = String(x.checkout || '').slice(0, 10);
    return !f || !ci || (ci <= f && f <= (co || ci));
  });
  var q = String(texto || '').trim();
  if (!q) return vivas.sort(consultaReciente_).slice(0, max || 5).map(function (x) { return { item: x, coincidencia: 'exacta' }; });
  return bqBuscar_(q, vivas, function (x) { var pn = String(x.propiedad || ''); return [x.huesped, pn, pn.replace(/\s+/g, '')].join(' '); }, 30)
    .sort(function (a, b) { return ((a.coincidencia === 'exacta' ? 0 : 1) - (b.coincidencia === 'exacta' ? 0 : 1)) || (b.puntaje - a.puntaje) || consultaReciente_(a.item, b.item); })
    .slice(0, max || 5).map(function (x) { return { item: x.item, coincidencia: x.coincidencia }; });
}
/* Lo que Alma ve de una consulta (nunca el teléfono ni el correo: Airbnb no los da y no hacen falta). */
function consultaFicha_(x) {
  return { conv_id: String(x.conv_id), tipo: 'consulta', huesped: String(x.huesped || '').trim(), propiedad: String(x.propiedad || ''), entrada: String(x.checkin || '').slice(0, 10), salida: String(x.checkout || '').slice(0, 10),
    canal: String(x.canal || ''), ultimo_mensaje: String(x.ultimo_texto || '').replace(/\s+/g, ' ').slice(0, 300), ultimo_de: x.ultimo_de === 'guest' ? 'huésped' : 'Spacio AM', recibido: String(x.ultimo_guest_ts || '').slice(0, 16).replace('T', ' ') };
}
/* A qué consulta va un mensaje. null si ninguna coincide; { error, opciones } si hay más de una. */
function consultaElegir_(texto, inbox, hoy) {
  var hits = consultasBuscar_(texto, '', inbox, hoy, 5);
  var exactas = hits.filter(function (x) { return x.coincidencia === 'exacta'; }); if (exactas.length) hits = exactas;
  if (!hits.length) return null;
  if (hits.length > 1) return { error: 'NO SE ENVIÓ: hay ' + hits.length + ' consultas que coinciden con «' + texto + '». Pregúntale en una frase cuál es (nombre, apartamento o fechas).', ambiguo: true, opciones: hits.map(function (x) { return consultaFicha_(x.item); }) };
  return consultaFicha_(hits[0].item);
}
function consultaNorm_(t) { return String(t || '').replace(/[“”«»"]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase(); }
/* El mensaje a una consulta. Sin confirmado, o en el mismo turno del borrador: lo guarda y devuelve el borrador (no sale).
   Con confirmado = true en otro turno y el mismo texto (o sin texto: el del borrador): { enviar: true, texto }. */
function consultaBorrador_(adm, ficha, texto, confirmado) {
  var c = CacheService.getScriptCache(), k = 'CONSULTA_BORR_' + String((adm && adm.email) || '').toLowerCase();
  var turno = String(typeof AGENTE_TEXTO_ === 'undefined' ? '' : AGENTE_TEXTO_ || ''), prev = null;
  try { prev = JSON.parse(c.get(k) || 'null'); } catch (e) {}
  texto = String(texto || '').trim();
  if (CONSULTA_APROBADA_ && texto) return { enviar: true, texto: texto };
  if (confirmado === true && prev && prev.conv_id === ficha.conv_id && turno && prev.turno !== turno && (!texto || consultaNorm_(texto) === consultaNorm_(prev.texto))) {
    c.remove(k);
    return { enviar: true, texto: prev.texto };
  }
  if (!texto) return { error: prev ? 'Falta el texto (el borrador pendiente era: «' + prev.texto.slice(0, 200) + '»).' : 'Falta el texto del mensaje.' };
  c.put(k, JSON.stringify({ conv_id: ficha.conv_id, texto: texto, turno: turno }), CONSULTA_BORRADOR_SEG_);
  return { ok: true, falta_confirmar: true,
    borrador: { codigo: ficha.conv_id, para: ficha.huesped + ' (consulta, sin reserva)', propiedad: ficha.propiedad, fechas: [ficha.entrada, ficha.salida].filter(Boolean).join(' al '), por: (TV_CANAL_[String(ficha.canal).toLowerCase()] || 'la plataforma'), texto: texto },
    nota: 'Todavía NO salió.' + (confirmado === true ? ' El sí tiene que llegar en un mensaje nuevo de Juan, después de ver este borrador.' : '') +
      ' Muéstrale a Juan el borrador (a quién y el texto) y espera su sí. Con su sí, otra vez enviar_a_huesped con el mismo codigo, confirmado = true y el mismo texto. Si cambia algo, es un borrador nuevo.' };
}
/* El borrador que espera el sí de este administrador (para «sí, envíalo» sin repetir a quién). */
function consultaPendiente_(adm) {
  try { return JSON.parse(CacheService.getScriptCache().get('CONSULTA_BORR_' + String((adm && adm.email) || '').toLowerCase()) || 'null'); } catch (e) { return null; }
}
