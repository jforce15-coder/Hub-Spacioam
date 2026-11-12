/* ═══ CÓDIGO NUEVO PARA UNA EXTENSIÓN (Juan, 12-nov-2026) ══════════════════════════════════════════════════════════
   «El problema con los códigos es que cuando hay una extensión el código no se renueva. El administrador principal y el
   secundario deben recibir una solicitud por WhatsApp en la que Alma les pida el código de una reserva con extensión.
   La solicitud se envía 1 o 2 horas antes de que venza la reserva original (no la extensión).»
   Cómo se ve una extensión en los datos (revisado en Hospitable el 12-nov):
   · La MISMA reserva con la salida movida (Estrella, Ignacio 1206: el PIN de igloohome decía «to 07 Nov 2026, 11AM» y su
     salida quedó el 8-nov; igloohome no manda otro PIN y Hospitable marca «Entry lock mismatch»).
   · Una reserva NUEVA del mismo huésped en la misma propiedad que empieza el día que termina la otra (Luis, Ignacio 904:
     «I am staying in this apartment and would like to extend my stay»): igloohome le manda otro PIN, pero vale desde las
     3 PM; el de la primera vence a las 11 AM y entre las dos queda sin código.
   El Hub solo sabe cuándo vence un código por el mensaje de igloohome (pinVigencia_, codigoaviso.js). Lo que el equipo
   manda a mano no dice hasta cuándo vale: si después del PIN alguien ya le mandó otro código, el equipo ya lo resolvió.
   Lo que hace (extensionRevisar_, desde procesarCola, cada 5 min; nunca se pausa por cupo: es acceso de un huésped):
   · Para cada estadía activa cuyo PIN de igloohome vence antes de su salida (o de la salida de la reserva que sigue), entre
     2 h y 1 h antes de que venza le pide UNA vez el código nuevo, por WhatsApp desde Alma, al administrador principal
     (CFG.WHATSAPP_NOCTURNO) y al secundario (CFG.WHATSAPP_RESPALDO; si no hay, solo al principal).
   · El que responda (citando la solicitud o, si solo hay una abierta, con el código suelto) es la respuesta: Alma se lo
     manda al huésped por su conversación y le confirma; al otro le avisa que ya quedó. Un solo envío por extensión.
   · Si 30 min antes del vencimiento nadie respondió ni mandó un código en la conversación, un recordatorio (uno solo).
   Estado en la propiedad EXT_CODIGOS (sin el código: solo sus 2 últimos dígitos). */

var EXT_PROP_ = 'EXT_CODIGOS', EXT_PEDIR_MIN_ = 120, EXT_RECORDAR_MIN_ = 30, EXT_CADA_SEG_ = 300;
var EXT_MESES_ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var EXT_MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function extNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function extEstados_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(EXT_PROP_) || '{}') || {}; } catch (e) { return {}; } }
function extGuardar_(m) {
  var lim = Date.now() - 3 * 86400000;
  Object.keys(m).forEach(function (k) { if (!(m[k].hastaMs > lim)) delete m[k]; });
  PropertiesService.getScriptProperties().setProperty(EXT_PROP_, JSON.stringify(m));
}
/* Las 11:00 de Guatemala de ese día (la hora de salida de todas las propiedades). */
function extSalidaMs_(ymd) { return Date.parse(String(ymd).slice(0, 10) + 'T11:00:00-06:00'); }
function extHora_(ms) { return Utilities.formatDate(new Date(ms), CFG.TZ, 'HH:mm'); }
function extDia_(ms, en) {
  var d = new Date(ms), n = Number(Utilities.formatDate(d, CFG.TZ, 'd')), m = Number(Utilities.formatDate(d, CFG.TZ, 'M')) - 1;
  return en ? EXT_MONTHS_[m] + ' ' + n : n + ' ' + EXT_MESES_[m];
}
/* Los dos administradores: principal y secundario, sin repetir. */
function extAdmins_() {
  var out = [];
  [CFG.WHATSAPP_NOCTURNO, CFG.WHATSAPP_RESPALDO].forEach(function (t) { var n = normTel_(t); if (n && !out.some(function (x) { return fin8_(x) === fin8_(n); })) out.push(n); });
  return out;
}
function extEsAdmin_(wa) {
  if (extAdmins_().some(function (x) { return fin8_(x) === fin8_(wa); })) return true;
  try { return !!adminPorTel_(wa); } catch (e) { return false; }
}
function extConv_(r) { var u = s_(r.reservation_uuid); if (/^[0-9a-f-]{20,}$/i.test(u)) return u; try { return agResId_(s_(r.code)); } catch (e) { return ''; } }
/* El último código que le mandamos en esa conversación (codigoaviso.js). leer: true = sin la caché de 6 h. */
function extUltimo_(resId, fresco) {
  if (!resId) return null;
  var c = CacheService.getScriptCache(), k = 'extv_' + resId;
  if (!fresco) { var v = c.get(k); if (v) { try { return v === '-' ? null : JSON.parse(v); } catch (e) {} } }
  var r = hiloConv_(resId); if (r.code !== 200) return null;
  var u = codigoUltimoEnviado_(r.hilo || []), g = (r.hilo || []).filter(function (m) { return m.tipo === 'guest'; }).pop();
  var out = u ? { fuente: u.fuente, hastaMs: u.hastaMs, desdeMs: u.desdeMs, created: u.created, idioma: (g && idiomaDe_(g.texto)) || '' } : null;
  try { c.put(k, out ? JSON.stringify(out) : '-', out ? 21600 : 10800); } catch (e) {}
  return out;
}

/* procesarCola: busca extensiones cuyo código vence en menos de 2 h y pide el código; manda el recordatorio. */
function extensionRevisar_() {
  var cache = CacheService.getScriptCache(); if (cache.get('ext_rev')) return; cache.put('ext_rev', '1', EXT_CADA_SEG_);
  var ahora = Date.now(), hoy = Utilities.formatDate(new Date(ahora), CFG.TZ, 'yyyy-MM-dd');
  var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return s_(r.code) && !/cancel|not accepted|denied|declined/i.test(s_(r.reservation_status || r.status)); });
  var estados = extEstados_(), cambio = false;
  filas.filter(function (r) { var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date); return ci && co && ci <= hoy && hoy <= co; }).forEach(function (r) {
    var prop = extNorm_(r.property_name), nom = extNorm_(r.guest_first_name), ape = extNorm_(r.guest_last_name).slice(0, 3);
    /* La reserva que sigue: mismo huésped, misma propiedad, entra el día que esta sale. */
    var sigue = filas.filter(function (b) { return b !== r && extNorm_(b.property_name) === prop && fecha_(b.checkin_date) === fecha_(r.checkout_date) && extNorm_(b.guest_first_name) === nom && (!ape || !extNorm_(b.guest_last_name) || extNorm_(b.guest_last_name).slice(0, 3) === ape); })[0];
    var hasta = sigue ? fecha_(sigue.checkout_date) : fecha_(r.checkout_date);
    if (hasta <= hoy) return;   // sale hoy y no sigue: no hay extensión
    var resId = extConv_(r), u = extUltimo_(resId, false);
    if (!u || u.fuente !== 'igloohome' || isNaN(u.hastaMs)) return;   // sin PIN de igloohome no sabemos cuándo vence
    if (u.hastaMs >= extSalidaMs_(hasta) - 30 * 60000) return;        // el código cubre hasta su salida
    var falta = (u.hastaMs - ahora) / 60000;
    var clave = s_(r.code) + '|' + u.hastaMs;
    if (estados[clave] || falta > EXT_PEDIR_MIN_ || falta <= 0) return;
    /* En la ventana: se vuelve a leer sin caché (¿el equipo ya le mandó otro código?) y la reserva que sigue. */
    u = extUltimo_(resId, true);
    if (!u || u.fuente !== 'igloohome' || s_(r.code) + '|' + u.hastaMs !== clave) return;
    var destino = resId;
    if (sigue) {
      var idB = extConv_(sigue), uB = extUltimo_(idB, true);
      if (uB && (uB.fuente !== 'igloohome' || (!isNaN(uB.desdeMs) && uB.desdeMs <= u.hastaMs))) return;   // la que sigue ya tiene un código que cubre
      destino = idB || resId;
    }
    var e = { codigo: s_(r.code), sigue: sigue ? s_(sigue.code) : '', resId: destino, huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim(), nombre: s_(r.guest_first_name),
      propiedad: s_(r.property_name), hastaMs: u.hastaMs, saleMs: extSalidaMs_(hasta), idioma: u.idioma || 'es', estado: 'pedido', pedidoTs: ahora, msgs: [] };
    var txt = extPedidoTexto_(e, false);
    extAdmins_().forEach(function (wa) { var w = waEnviar_(wa, txt); if (w && w.id) e.msgs.push(w.id); });
    try { pushA_(null, '🔑 Alma pide un código para una extensión · ' + e.propiedad, txt); } catch (x) {}
    estados[clave] = e; cambio = true;
  });
  /* Recordatorio: 30 min antes del vencimiento, si nadie respondió ni mandó un código en su conversación. */
  Object.keys(estados).forEach(function (k) {
    var e = estados[k];
    if (e.estado !== 'pedido' || e.recordadoTs || ahora < e.hastaMs - EXT_RECORDAR_MIN_ * 60000 || ahora > e.hastaMs + 3600000) return;
    var u = extUltimo_(e.resId, true);
    if (u && u.created && Date.parse(u.created) > e.pedidoTs) { e.estado = 'enviado_por_equipo'; cambio = true; return; }
    var txt = extPedidoTexto_(e, true);
    extAdmins_().forEach(function (wa) { var w = waEnviar_(wa, txt); if (w && w.id) e.msgs.push(w.id); });
    e.recordadoTs = ahora; cambio = true;
  });
  if (cambio) extGuardar_(estados);
}
function extPedidoTexto_(e, recordatorio) {
  var hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd') === Utilities.formatDate(new Date(e.hastaMs), CFG.TZ, 'yyyy-MM-dd');
  return (recordatorio ? '⏰ Recordatorio · ' : '🔑 ') + 'Código para una extensión · ' + e.propiedad +
    '\nHuésped: ' + e.huesped + '\nReserva: ' + e.codigo + (e.sigue ? ' (sigue con ' + e.sigue + ')' : '') +
    '\nSu código vence ' + (hoy ? 'hoy' : 'el ' + extDia_(e.hastaMs)) + ' a las ' + extHora_(e.hastaMs) + ' (fin de su reserva original) y se queda hasta el ' + extDia_(e.saleMs) + ' a las ' + extHora_(e.saleMs) + '.' +
    '\n\n' + (recordatorio ? 'Su código vence en 30 min. ' : '') + 'Respóndeme a este mensaje con el código nuevo y se lo mando por su conversación.';
}
function extHuespedTexto_(e, codigo) {
  var en = /^en/i.test(e.idioma || '');
  return en
    ? 'Hi' + (e.nombre ? ' ' + e.nombre : '') + '! Since you extended your stay, here is your new access code: ' + codigo + '\n\nIt works until your check-out on ' + extDia_(e.saleMs, true) + ' at 11:00. Enter it on the lock and confirm with the lock (or #) key.'
    : 'Hola' + (e.nombre ? ', ' + e.nombre : '') + '. Como extendiste tu estadía, aquí tienes tu nuevo código de acceso: ' + codigo + '\n\nFunciona hasta tu salida, el ' + extDia_(e.saleMs) + ' a las 11:00. Márcalo en la cerradura y confirma con la tecla del candado (o #).';
}

/* Webhook de WhatsApp: ¿el administrador responde una solicitud con el código? true = atendido. */
var EXT_COD_RX_ = /(?:^|[^\d+])(\d{4,10}#?)(?!\d)/;
function extensionWaEntrante_(m, wa) {
  if (!m || m.type !== 'text' || !extEsAdmin_(wa)) return false;
  var estados = extEstados_(), ahora = Date.now(), texto = s_(m.text && m.text.body).trim();
  var abiertas = Object.keys(estados).filter(function (k) { return ahora < estados[k].hastaMs + 6 * 3600000; });
  var cid = m.context && m.context.id ? String(m.context.id) : '';
  var k = cid ? abiertas.filter(function (x) { return (estados[x].msgs || []).indexOf(cid) >= 0; })[0] : '';
  var x = EXT_COD_RX_.exec(texto);
  if (!k) {
    /* Sin citar: solo si hay UNA solicitud esperando y el mensaje es solo el código (un teléfono de 8 dígitos no cuenta). */
    var pend = abiertas.filter(function (y) { return estados[y].estado === 'pedido'; });
    if (pend.length !== 1 || !x || texto.length > 60 || /\+/.test(texto)) return false;
    if (!/^[^\d]{0,30}\d{4,10}#?\s*(?:🔒|🔓|🔑)?\s*$/.test(texto) || (x[1].length === 8 && !/#|c[oó]digo|code|pin|clave/i.test(texto))) return false;
    k = pend[0];
  }
  var e = estados[k];
  if (e.estado !== 'pedido') { waEnviar_(wa, e.estado === 'enviado' ? 'Ese código ya se lo mandó ' + (e.quien || 'el equipo') + ' a las ' + extHora_(e.enviadoTs) + '.' : 'Esa extensión ya quedó resuelta en su conversación.', { yaVentana: true }); return true; }
  if (!x) { waEnviar_(wa, 'No vi el código en tu mensaje. Respóndeme a la solicitud con el código nuevo, solo los números.', { yaVentana: true }); return true; }
  var codigo = x[1], quien = 'el equipo';
  try { var a = adminPorTel_(wa); if (a && a.nombre) quien = a.nombre.split(/\s+/)[0]; } catch (z) {}
  /* Se marca antes de enviar: si el otro administrador responde al mismo tiempo, no sale dos veces. */
  e.estado = 'enviando'; extGuardar_(estados);
  var d = { resId: e.resId, codigo: e.codigo, huesped: e.huesped, propiedad: e.propiedad, idioma: e.idioma, canal: 'hospitable', modo: 'AUTO' };
  var msg = extHuespedTexto_(e, codigo), env = { code: 0 };
  try { env = enviarCanal_(d, msg); } catch (z) { env = { code: 500, error: String(z) }; }
  var bien = env.code >= 200 && env.code < 300;
  estados = extEstados_(); e = estados[k] || e;
  if (bien) Object.assign(e, { estado: 'enviado', quien: quien, enviadoTs: Date.now(), fin: codigo.slice(-2) });
  else e.estado = 'pedido';
  estados[k] = e; extGuardar_(estados);
  try { log_(d, msg, bien ? 'ENVIADO al huésped · código nuevo por extensión (lo dio ' + quien + ')' : 'NO ENVIADO · código por extensión (' + (env.code || '') + ')'); } catch (z) {}
  if (!bien) { waEnviar_(wa, 'No le salió el código a ' + e.huesped + ' (' + (env.error || env.code) + '). Mándaselo desde su conversación en el Hub:\n' + CFG.HUB_URL + '/?conv=' + encodeURIComponent(e.resId), { yaVentana: true }); return true; }
  waEnviar_(wa, 'Listo, le mandé el código nuevo a ' + e.huesped + ' (' + e.propiedad + ').', { yaVentana: true });
  extAdmins_().filter(function (o) { return fin8_(o) !== fin8_(wa); }).forEach(function (o) { waEnviar_(o, 'Listo: ' + quien + ' ya mandó el código nuevo de ' + e.huesped + ' (' + e.propiedad + ').'); });
  return true;
}
