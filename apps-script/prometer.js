/* ═══ VERIFICAR ANTES DE PROMETER (#583 T4) ═══════════════════════════════════════════════════════════════════════════
   13-nov: Juan pidió escribirle al socio de Narama 633. Alma dijo «Aquí va el borrador» y luego «Listo, con ese cambio:
   — Hola …», pero NUNCA salió nada a ese número: escribir_a_equipo no guardaba borradores (los huéspedes sí), el «sí» no
   tenía a qué ligarse y nada impedía decir «listo» sin envío. En una llamada dijo «Listo, le llegó» 26 s antes de llamar
   a la herramienta. Aquí:
     1. el borrador para el equipo, un socio o un contacto se guarda con su destinatario y su fuente; el «sí» siguiente
        lo manda a ESE destinatario (equipoBorrador*_);
     2. el freno al cerrar el turno (prometerFreno_): si la respuesta dice que salió y en este turno no hubo un envío sin
        error, se cambia por «Todavía no salió: …». Un «Listo» de otra cosa que sí se hizo no se toca;
     3. al colgar una llamada (prometerAuditarLlamada_): si la voz dijo «le llegó / ya salió / le mandé» sin que la
        secretaria devolviera antes un envío hecho, se abre un Pendiente para Juan. */

/* Los hechos que son un envío de verdad (agente.js: ctx.hechas). «programado» todavía no sale; «Encargo cumplido» no es envío. */
var PROMETER_ENVIO_TIPOS_ = { mensaje: 1, encargo: 1, archivo: 1, correo: 1, uber: 1, calendario: 1 };   // calendario: la invitación sale al crear el evento
/* Decir que salió (fuerte): eso solo con un envío hecho. «Listo» solo (débil): se corrige solo si hubo un borrador o un envío fallido. */
var PROMETER_DICHO_RE_ = /\b(le lleg[óo]|ya (le |se )?(sali[óo]|lleg[óo]|envi[óo])|ya (se )?(lo |la |le |les )?(envi[ée]|mand[ée])|(se lo|se la|se los|lo|la|le|les) (envi[ée]|mand[ée]|escrib[íi])\b|(mensaje|whatsapp|correo|borrador)( ya)? (fue |est[áa] |qued[óo] )?(enviad[oa]|mandad[oa])|qued[óo] enviad[oa]|ya est[áa] enviad[oa]|sali[óo] (el|tu|su) mensaje)/i;
var PROMETER_LISTO_RE_ = /^\W*(listo|hecho|perfecto)\b[,.:!]?\s*/i;
/* Herramientas que leen el estado real de un envío: si el turno las usó, «le llegó» puede venir de Meta (buscar_contacto). */
var PROMETER_LEE_ESTADO_ = ['buscar_contacto', 'ver_conversacion', 'ver_conversacion_personal', 'mensajes_programados', 'historial_reserva'];

function prometerEnvioHecho_(hechas) { return (hechas || []).some(function (h) { return h && PROMETER_ENVIO_TIPOS_[h.tipo] && !h.error && !/^Encargo cumplido/.test(String(h.resumen || '')); }); }
/* El texto final del turno, revisado contra lo que de verdad se hizo. Devuelve el texto (igual, o corregido). */
function prometerFreno_(texto, ctx) {
  var t = String(texto || ''), hechas = (ctx && ctx.hechas) || []; if (!t.trim()) return t;
  if (prometerEnvioHecho_(hechas) || (ctx && ctx.duplicado)) return t;
  var leyo = ((ctx && ctx.llamadas) || []).some(function (l) { return PROMETER_LEE_ESTADO_.indexOf(l.tool) >= 0 && l.ok; });
  var fuerte = PROMETER_DICHO_RE_.test(t) && !leyo, borr = ctx && ctx.borrador, fallo = hechas.filter(function (h) { return PROMETER_ENVIO_TIPOS_[h.tipo] && h.error; })[0];
  var debil = PROMETER_LISTO_RE_.test(t) && (borr || fallo);
  if (!fuerte && !debil) return t;
  var otras = hechas.filter(function (h) { return !h.error && !PROMETER_ENVIO_TIPOS_[h.tipo]; }).map(function (h) { return h.resumen || h.tipo; });
  var motivo = fallo ? 'el envío a ' + (fallo.nombre || 'esa persona') + ' falló (' + String(fallo.error).slice(0, 160) + ').'
    : borr ? 'es un borrador para ' + borr.para + '. Con tu sí lo mando a ese mismo número.' + (borr.texto ? '\n\n«' + String(borr.texto).slice(0, 900) + '»' : '')
    : 'en este turno no hice ningún envío. ¿Lo mando ahora?';
  console.log('prometerFreno_: «' + t.slice(0, 120) + '» → todavía no salió');
  if (ctx) ctx.frenado = true;
  return 'Todavía no salió: ' + motivo + (otras.length ? '\n\nLo que sí quedó: ' + otras.join('; ') + '.' : '');
}

/* ── Borrador para el equipo, un socio o un contacto (escribir_a_equipo con borrador = true) ── */
var EQUIPO_BORRADOR_SEG_ = 3 * 3600;
var EQUIPO_SI_RE_ = /^\W*(s[ií]|sip|dale|ok|okay|claro|perfecto|adelante|m[aá]nd[ae]lo|m[aá]ndaselo|env[ií]a(lo|selo)?|enviar|de acuerdo|correcto|as[ií] est[aá] bien)\b/i;
function equipoBorradorClave_(adm) { return 'EQUIPO_BORR_' + String((adm && adm.email) || '').toLowerCase(); }
function equipoBorradorPendiente_(adm) { try { return JSON.parse(CacheService.getScriptCache().get(equipoBorradorClave_(adm)) || 'null'); } catch (e) { return null; } }
function equipoBorradorGuardar_(adm, destinos, texto, o) {
  o = o || {};
  var b = { destinos: destinos.map(function (c) { return { tel: c.tel, nombre: c.nombre, rol: c.rol || '', propiedad: c.propiedad || '', fuente: c.fuente || '' }; }),
    texto: String(texto || ''), propiedad: o.propiedad || '', al_responder: o.al_responder || '', turno: String(typeof AGENTE_TEXTO_ === 'undefined' ? '' : AGENTE_TEXTO_ || ''), ts: Date.now() };
  try { CacheService.getScriptCache().put(equipoBorradorClave_(adm), JSON.stringify(b), EQUIPO_BORRADOR_SEG_); } catch (e) { console.error('equipoBorradorGuardar_: ' + e); }
  return b;
}
function equipoBorradorBorrar_(adm) { try { CacheService.getScriptCache().remove(equipoBorradorClave_(adm)); } catch (e) {} }
/* ¿Este llamado es el «sí» al borrador? Sí, si llega en otro mensaje de Juan, con confirmado = true o un «sí» claro, y no
   nombra a otra persona (un número distinto o un nombre que no es el del borrador). */
function equipoBorradorEsSi_(b, inp) {
  if (!b || !b.destinos || !b.destinos.length || inp.borrador === true) return false;
  var turno = String(typeof AGENTE_TEXTO_ === 'undefined' ? '' : AGENTE_TEXTO_ || '');
  if (b.turno && b.turno === turno) return false;
  if (inp.confirmado !== true && !EQUIPO_SI_RE_.test(turno)) return false;
  var num = normTel_(inp.numero || ''); if (num) return b.destinos.some(function (d) { return fin8_(d.tel) === fin8_(num); });
  var pal = destinoPalabras_(inp.persona || '', []); if (!pal.length) return true;
  return b.destinos.some(function (d) { return destinoCoincide_(pal, d.nombre) || destinoCoincide_(pal, d.rol + ' ' + destinoPropTexto_(d.propiedad)); });
}
function equipoBorradorDecir_(b) { return 'Borrador para ' + b.destinos.map(destinoDecir_).join(' y ') + '. Todavía no salió.'; }

/* ── Al colgar (voz.js, vozPostCall_): lo que la voz dijo contra lo que la secretaria devolvió ── */
var PROMETER_ACCION_ENVIO_RE_ = /^(WhatsApp a|Mensaje al huésped|Personal ·|Encargo · |Archivo enviado|Uber listo|Correo a|Respuesta en el hilo)/;
function prometerResultadoEnvio_(tr) {
  var j = null; try { j = typeof tr.result_value === 'string' ? JSON.parse(tr.result_value) : tr.result_value; } catch (e) { return false; }
  if (!j || j.ok === false) return false;
  if (j.envio_hecho === true) return true;
  return (j.acciones || []).some(function (a) { return PROMETER_ACCION_ENVIO_RE_.test(String(a)) && /\(hecho\)\s*$/.test(String(a)); });
}
/* transcript de ElevenLabs: [{ role, message, time_in_call_secs, tool_calls, tool_results }]. Lo dicho en un turno cuenta
   solo con un resultado de turnos anteriores (el de su mismo turno llegó después de hablar). Devuelve lo sin respaldo. */
function prometerSinRespaldo_(transcript) {
  var respaldo = false, sin = [];
  (transcript || []).forEach(function (m) {
    var txt = String((m && m.message) || '');
    if (m && m.role === 'agent' && txt && PROMETER_DICHO_RE_.test(txt) && !respaldo) sin.push({ seg: Number(m.time_in_call_secs || 0), dicho: txt.replace(/\s+/g, ' ').slice(0, 160) });
    ((m && m.tool_results) || []).forEach(function (tr) { if (prometerResultadoEnvio_(tr)) respaldo = true; });
  });
  return sin;
}
function prometerAuditarLlamada_(adm, transcript, convId) {
  var sin = prometerSinRespaldo_(transcript); if (!sin.length || !adm) return false;
  var txt = 'En una llamada dije «' + sin[0].dicho + '» (al segundo ' + Math.round(sin[0].seg) + ') sin que hubiera salido ningún mensaje antes. Puede que no le haya llegado nada. Revisa: ¿lo mando?';
  try { return !!pendAvisar_(adm, txt, { origen: 'entrega', tipo: 'atencion', fallo: 'dijo que salió sin un envío hecho', pedido: 'llamada ' + String(convId || '') }); } catch (e) { console.error('prometerAuditarLlamada_: ' + e); return false; }
}
