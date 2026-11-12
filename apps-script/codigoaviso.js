/* ═══ CÓDIGO DE ACCESO PENDIENTE: UN SOLO AVISO POR RESERVA ════════════════════════════════════════════════════════════
   Pasó el 7-nov (Estrella, Ignacio 1206, HM5TWHD8KK): no pudo entrar porque el PIN de igloohome del 31-oct decía «to
   07 Nov 2026, 11AM» y su salida era el 8-nov. Cada mensaje suyo («no funciona el código», «puedo volver a intentar…»,
   «sigue marcando en rojo») abrió su propia revisión del código (manejarCodigo_) y cada una avisó por WhatsApp: Juan
   recibió «El huésped sigue sin su código…» a las 5:44, 5:56 y 5:58 pm, las dos últimas después de que él ya le había
   contestado en la conversación (5:56) y de mandarle un PIN nuevo a mano (5:58). Ahora:
   · una revisión abierta, un aviso ya enviado o una respuesta del equipo cierran los mensajes siguientes sin aviso nuevo
     durante CODIGO_UN_AVISO_SEG_;
   · la revisión se cierra sola, sin aviso, si alguien del equipo contestó después de la contención;
   · si el PIN de igloohome que recibió vence antes de su salida, el aviso lo dice (pinVenceAntes_). */
var CODIGO_UN_AVISO_SEG_ = 7200;
var CODIGO_AVISO_TXT_ = { revision: 'ya hay una revisión del código en curso', aviso: 'ya se avisó a los administradores', equipo: 'el equipo ya respondió en la conversación' };

function codigoAvisoMarcar_(resId, tipo, seg) {
  if (!resId) return;
  try { CacheService.getScriptCache().put('codaviso_' + tipo + '_' + resId, String(Date.now()), seg || CODIGO_UN_AVISO_SEG_); } catch (e) { console.error('codigoAvisoMarcar_: ' + e); }
}
/* '' si se puede avisar; si no, el motivo. sinRevision: la revisión que pregunta es la abierta (no se cuenta a sí misma). */
function codigoAvisoAbierto_(resId, sinRevision) {
  if (!resId) return '';
  var c = CacheService.getScriptCache(), tipos = sinRevision ? ['equipo', 'aviso'] : ['equipo', 'aviso', 'revision'];
  for (var i = 0; i < tipos.length; i++) { try { if (c.get('codaviso_' + tipos[i] + '_' + resId)) return CODIGO_AVISO_TXT_[tipos[i]]; } catch (e) {} }
  return '';
}
function codigoTextoNorm_(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '').slice(0, 120); }
/* ¿Alguien del equipo contestó después de la contención? Un mensaje nuestro (no del huésped) que no es automático ni de
   ALMA: ni la contención, ni lo que salió por la API (public_api, ALMA; lo que el equipo manda desde el Hub ya cierra la
   revisión en hubResponder_), ni lo que ALMA acaba de enviar (env_, cacheEnvio_). También cuenta la bandeja
   (ultimo_host_ts, que escribe el webhook) por si Hospitable todavía no lo devuelve en el hilo. */
function equipoRespondioCodigo_(hilo, d) {
  var desde = new Date(d && d.contencionAt).getTime(); if (isNaN(desde)) return false;
  desde += 5000;
  var env = []; try { env = JSON.parse(CacheService.getScriptCache().get('env_' + d.resId) || '[]'); } catch (e) {}
  var propios = [d.borrador].concat(env.map(function (m) { return m && m.texto; })).filter(Boolean).map(codigoTextoNorm_);
  var deEquipo = function (texto, ts) { return ts > desde && propios.indexOf(codigoTextoNorm_(texto)) < 0; };
  if ((hilo || []).some(function (m) { return m.tipo !== 'guest' && !m.auto && m.fuente !== 'public_api' && deEquipo(m.texto, new Date(m.created).getTime()); })) return true;
  try {
    var ib = hubInbox_().filter(function (x) { return String(x.conv_id) === String(d.resId); })[0];
    if (ib && ib.ultimo_de === 'host' && deEquipo(ib.ultimo_texto, new Date(ib.ultimo_host_ts || ib.ultimo_ts).getTime())) return true;
  } catch (e) { console.error('equipoRespondioCodigo_: ' + e); }
  return false;
}

/* ── Vigencia del PIN de igloohome ──
   El mensaje de igloohome dice «… from 31 Oct 2026, 3PM, UTC-06:00 to 07 Nov 2026, 11AM, UTC-06:00» y, unas líneas más
   abajo, el PIN (9 dígitos, en su propia línea, con 🔓). Se lee el último que llegó al hilo. Devuelve
   { hasta: 'yyyy-MM-dd', texto, hastaMs, desdeMs, codigo, created } o null (hastaMs/desdeMs: NaN si no traen hora). */
var PIN_MESES_ = { jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12 };
var PIN_FECHA_RX_ = '(\\d{1,2})\\s+([A-Za-zé]{3})[a-zé]*\\.?\\s+(\\d{4}),?\\s*(\\d{1,2}(?::\\d\\d)?\\s*[AaPp]\\.?[Mm]\\.?)?(?:,?\\s*UTC([+-]\\d\\d):?(\\d\\d))?';
/* «07 Nov 2026», «11AM», «UTC-06:00» → milisegundos (sin zona: Guatemala, UTC-6). */
function pinMs_(dia, mes, anio, hora, tzh, tzm) {
  var m = PIN_MESES_[String(mes).slice(0, 3).toLowerCase()]; if (!m) return NaN;
  var h = 0, mi = 0, x = /(\d{1,2})(?::(\d\d))?\s*([AaPp])/.exec(String(hora || ''));
  if (x) { h = Number(x[1]) % 12 + (/p/i.test(x[3]) ? 12 : 0); mi = Number(x[2] || 0); } else if (!hora) return NaN;
  var off = tzh ? Number(tzh) * 60 + (Number(tzh) < 0 ? -1 : 1) * Number(tzm || 0) : -360;
  return Date.UTC(Number(anio), m - 1, Number(dia), h, mi) - off * 60000;
}
function pinVigencia_(hilo) {
  var rx = new RegExp('\\b(?:to|until|hasta|al)\\s+' + PIN_FECHA_RX_), rd = new RegExp('\\b(?:from|desde|del)\\s+' + PIN_FECHA_RX_);
  var dos = function (n) { return ('0' + n).slice(-2); };
  for (var i = (hilo || []).length - 1; i >= 0; i--) {
    var m = hilo[i], t = String((m && m.texto) || '');
    if (m.tipo === 'guest' || !/igloohome/i.test(t)) continue;
    var x = rx.exec(t); if (!x) continue;
    var mes = PIN_MESES_[x[2].slice(0, 3).toLowerCase()]; if (!mes) continue;
    var d = rd.exec(t), ip = t.search(/\bPIN\b/i), pin = ip >= 0 ? /^[ \t]*(\d{4,10}#?)[ \t]*(?:🔒|🔓|🔑)?[ \t]*$/m.exec(t.slice(ip)) : null;   // el PIN va solo en su línea
    return { hasta: x[3] + '-' + dos(mes) + '-' + dos(x[1]), texto: x[1] + ' ' + x[2] + ' ' + x[3] + (x[4] ? ', ' + x[4].replace(/\s+/g, '') : ''),
      hastaMs: pinMs_(x[1], x[2], x[3], x[4], x[5], x[6]), desdeMs: d ? pinMs_(d[1], d[2], d[3], d[4], d[5], d[6]) : NaN,
      codigo: pin ? pin[1] : '', created: m.created || '' };
  }
  return null;
}

/* ═══ CÓDIGO YA ENVIADO Y VIGENTE (Juan, 12-nov-2026) ══════════════════════════════════════════════════════════
   «Hoy estamos mandando código de emergencia cuando el código ya se había enviado en la conversación. Si el huésped lo
   pide y ya se había enviado, mencionar primero que ya se había enviado en un mensaje anterior, pero que con gusto se
   lo enviamos de nuevo, y volver a enviar ese código.» El PIN de igloohome (9 dígitos en su propia línea) y el que el
   equipo manda suelto («Please try this one ⏎ 123456789🔒») no tenían «código» antes del número: nadie los veía y salía
   el de emergencia. Ahora se lee el último código que le mandamos, se decide si sigue vigente y, si lo está, se
   reenvía ESE con la frase; el de emergencia solo cuando no hay ninguno vigente. */
var COD_ED_RX_ = /(edificio|porter[ií]a|recepci[oó]n|lobby|garita|parqueo|s[oó]tano|ascensor|elevador|torre|building|gate|front desk|elevator|garage|peatonal|locker|casillero|buz[oó]n)/i;
var COD_AP_RX_ = /(apartamento|apto|puerta|cerradura|chapa|lock|door|unit|smart ?lock|teclado|keypad)/i;
var COD_WIFI_RX_ = /(wi-?fi|red |internet|network|password de la red)/i;
var COD_PALABRA_RX_ = /(c[oó]digo|\bcode\b|clave|\bpin\b|contrase[nñ]a|passcode|🔒|🔓|🔑|try this|prueba (este|con))/i;
/* Códigos del apartamento en un mensaje nuestro: tras «código/PIN/clave…» (hasta 40 letras, misma línea) o solos en su
   línea si el mensaje habla de un código o trae el candado. Sin WiFi ni códigos del edificio. */
function codigosHostEnMensaje_(texto) {
  var s = String(texto || ''), out = [], x;
  var add = function (cod, i) {
    var antes = s.slice(Math.max(0, i - 90), i + cod.length), cerca = s.slice(Math.max(0, i - 40), i + cod.length + 40);
    if (COD_WIFI_RX_.test(cerca)) return;
    if (COD_ED_RX_.test(antes) && !COD_AP_RX_.test(antes)) return;
    if (out.indexOf(cod) < 0) out.push(cod);
  };
  var re = /(c[oó]digo|\bcode\b|clave|\bpin\b|contraseña|passcode)[^0-9\n]{0,40}?(\d{4,10}#?)(?!\d)/gi;
  while ((x = re.exec(s))) add(x[2], x.index + x[0].length - x[2].length);
  if (COD_PALABRA_RX_.test(s)) { var rl = /^[ \t]*(\d{4,10}#?)[ \t]*(?:🔒|🔓|🔑)?[ \t]*$/gm; while ((x = rl.exec(s))) add(x[1], x.index + x[0].indexOf(x[1])); }
  return out;
}
/* El último código del apartamento que le mandamos: { codigo, fuente: 'igloohome'|'conversacion', created, hastaMs, desdeMs, temporal }. */
function codigoUltimoEnviado_(hilo) {
  var h = hilo || [];
  for (var i = h.length - 1; i >= 0; i--) {
    var m = h[i]; if (!m || m.tipo === 'guest' || m.hito) continue;
    var t = String(m.texto || '');
    if (/igloohome/i.test(t)) { var p = pinVigencia_([m]); if (p && p.codigo) return { codigo: p.codigo, fuente: 'igloohome', created: m.created || '', hastaMs: p.hastaMs, desdeMs: p.desdeMs, hastaTexto: p.texto }; }
    var c = codigosHostEnMensaje_(t);
    if (c.length) return { codigo: c[c.length - 1], fuente: 'conversacion', created: m.created || '', temporal: /temporal|temporary|emergencia|emergency/i.test(t) };
  }
  return null;
}
/* ¿Sigue vigente? o = { checkout, propiedad, ahoraMs }. Devuelve el código (con por_que) o null.
   · igloohome: hasta su hora de fin (la del mensaje).
   · Un código de Epi (el de limpieza que salió como emergencia): solo si sigue siendo el de Epi de hoy.
   · Uno que mandó el equipo a mano: durante la estadía (hasta el día de salida). */
function codigoVigenteEnHilo_(hilo, o) {
  o = o || {};
  var c = codigoUltimoEnviado_(hilo); if (!c) return null;
  var ahora = o.ahoraMs || Date.now(), hoy = Utilities.formatDate(new Date(ahora), CFG.TZ, 'yyyy-MM-dd');
  if (c.fuente === 'igloohome') {
    if (!isNaN(c.hastaMs) && ahora >= c.hastaMs) return null;
    return Object.assign(c, { por_que: 'PIN de igloohome' + (c.hastaTexto ? ' hasta el ' + c.hastaTexto : '') });
  }
  if (o.checkout && hoy > String(o.checkout).slice(0, 10)) return null;
  var epi = null; try { if (typeof codigoEquipo_ === 'function' && o.propiedad) epi = codigoEquipo_(o.propiedad, hoy); } catch (e) { console.error('codigoVigenteEnHilo_: ' + e); }
  if (c.temporal) return epi && epi.codigo === c.codigo ? Object.assign(c, { por_que: 'código de Epi vigente' }) : null;
  return Object.assign(c, { por_que: 'código enviado en la conversación' });
}
/* La frase que pidió Juan, y el código otra vez. */
function codigoReenvioTexto_(idioma, codigo) {
  return /^en/i.test(String(idioma || ''))
    ? 'Your access code was already sent in a previous message, but we are happy to send it again: ' + codigo + '\n\nEnter it on the lock and confirm with the lock (or #) key.'
    : 'Tu código de acceso ya se había enviado en un mensaje anterior, pero con gusto te lo enviamos de nuevo: ' + codigo + '\n\nMárcalo en la cerradura y confirma con la tecla del candado (o #).';
}
/* El huésped dice que el código NO funciona: repetirle el mismo no ayuda (ahí sí va el de emergencia si nadie responde). */
var COD_FALLA_RX_ = /(no (me |nos )?(funciona|sirve|abre|jala|acepta|deja)|marca (en )?rojo|sigue (en |marcando )?rojo|incorrect|inv[aá]lid|(doesn'?t|does not|isn'?t|is not|won'?t|not) (work|open|accept)|red light|bloque[oó]|blocked|locked)/i;
var COD_PIDE_RX_ = /(\?|cu[aá]l (es|era)|me (lo |la )?(puede|podr[ií]a|pued|pas|mand|envi|compart|recuerd|das|da)|(m[aá]nd|env[ií]|pas|compart|d)[aá]?(me|nos)(lo|la)?\b|no (me |nos )?(ha )?(lleg|tengo|tenemos|encuentro|encontramos|veo|aparece)|necesit|olvid|perd[ií]|what('?s| is)|send|resend|share|forgot|lost|can'?t find|need)/i;
function codigoPideDeNuevo_(texto) {
  var t = String(texto || '');
  if (!RX_PIDE_CODIGO_.test(t) || COD_FALLA_RX_.test(t)) return false;
  if (/wi-?fi|internet|router|network|\bred\b/i.test(t) && !/puerta|door|cerradura|lock|entrar|ingres|acceso|access/i.test(t)) return false;
  return COD_PIDE_RX_.test(t);
}
/* procesar_: el huésped pide el código (solo eso) y ya se le mandó uno vigente → se le reenvía ESE con la frase, sin IA,
   sin alerta y sin código de emergencia. Solo en AUTO; en BORRADOR/SOMBRA sigue el camino normal. */
function codigoReenvioAplica_(ctx, hilo) {
  if (!ctx || ctx.esWA || ctx.modo !== 'AUTO' || !ctx.reservaConfirmada || !ctx.checkin || !ctx.hoy) return null;
  if (ctx.hoy < sumarDias_(ctx.checkin, -1) || (ctx.checkout && ctx.hoy > ctx.checkout)) return null;
  if (String(ctx.texto || '').length > 220 || !codigoPideDeNuevo_(ctx.texto)) return null;
  return codigoVigenteEnHilo_(hilo, { checkout: ctx.checkout, propiedad: ctx.propiedad });
}
function codigoReenviar_(sh, lider, otros, ctx, vig) {
  (otros || []).forEach(function (f) { set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila }); });
  var msg = codigoReenvioTexto_(ctx.idioma, vig.codigo), env = enviarCanal_(ctx, msg), bien = env.code >= 200 && env.code < 300;
  ctx.nivel = 'VERDE'; ctx.razon = 'Pide el código y ya se le había enviado (' + vig.por_que + '): se le reenvía el mismo';
  set_(sh, lider, { estado: bien ? 'respondido' : 'escalado', nota: 'CÓDIGO · ya enviado y vigente · ' + (bien ? 'reenviado' : 'FALLÓ ' + env.code) });
  if (!bien) avisarAdmins_('🔑 ALMA · no pude reenviar el código · ' + ctx.propiedad, 'El huésped ' + ctx.huesped + ' (' + ctx.codigo + ') pidió su código; ya se le había enviado (' + vig.por_que + ') pero el reenvío falló (' + env.code + '). Mándaselo tú.');
  return log_(ctx, msg, bien ? 'ENVIADO al huésped · código ya enviado y vigente: reenviado con la frase, sin emergencia' : 'NO ENVIADO · reenvío del código falló ' + env.code);
}
/* Antes del código de emergencia (verificarCodigo_ y verificarRojo_): si hay uno vigente y el huésped no dijo que falla,
   se reenvía ESE. Devuelve true si lo atendió. */
function codigoReenvioAntesDeEmergencia_(d, hilo) {
  if (COD_FALLA_RX_.test(String(d.texto || ''))) return false;
  var vig = codigoVigenteEnHilo_(hilo, { checkout: d.checkout, propiedad: d.propiedad });
  if (!vig) return false;
  var msg = codigoReenvioTexto_(d.idioma, vig.codigo), env = enviarCanal_(d, msg);
  d.reenvioAt = new Date().toISOString();
  log_(d, msg, (env.code < 300 ? 'ENVIADO al huésped' : 'NO ENVIADO (' + env.code + ')') + ' · código ya enviado y vigente (' + vig.por_que + '): reenviado en vez del de emergencia');
  return true;
}

/* El PIN vence antes de la salida: { hasta, texto } o null. */
function pinVenceAntes_(hilo, checkout) {
  var sale = String(checkout || '').slice(0, 10); if (!/^\d{4}-\d\d-\d\d$/.test(sale)) return null;
  var p = pinVigencia_(hilo);
  return p && p.hasta < sale ? p : null;
}
function pinNota_(pin, checkout) {
  return 'Ojo: el PIN de igloohome que recibió vale hasta el ' + pin.texto + ' y su salida es el ' + String(checkout).slice(0, 10) + '. Hay que generarle uno nuevo hasta su salida.';
}
