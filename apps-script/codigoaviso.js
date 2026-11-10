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
   El mensaje de igloohome dice «… from 31 Oct 2026, 3PM, UTC-06:00 to 07 Nov 2026, 11AM, UTC-06:00». Se lee el último
   que llegó al hilo. Devuelve { hasta: 'yyyy-MM-dd', texto } o null. */
var PIN_MESES_ = { jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12 };
function pinVigencia_(hilo) {
  var rx = /\b(?:to|until|hasta|al)\s+(\d{1,2})\s+([A-Za-zé]{3})[a-zé]*\.?\s+(\d{4}),?\s*(\d{1,2}(?::\d\d)?\s*[AaPp]\.?[Mm]\.?)?/;
  var dos = function (n) { return ('0' + n).slice(-2); };
  for (var i = (hilo || []).length - 1; i >= 0; i--) {
    var m = hilo[i], t = String((m && m.texto) || '');
    if (m.tipo === 'guest' || !/igloohome/i.test(t)) continue;
    var x = rx.exec(t); if (!x) continue;
    var mes = PIN_MESES_[x[2].slice(0, 3).toLowerCase()]; if (!mes) continue;
    return { hasta: x[3] + '-' + dos(mes) + '-' + dos(x[1]), texto: x[1] + ' ' + x[2] + ' ' + x[3] + (x[4] ? ', ' + x[4].replace(/\s+/g, '') : '') };
  }
  return null;
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
