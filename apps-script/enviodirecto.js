/* ═══ ENVÍO DIRECTO: la orden de Juan ya es su sí (Juan, 17-nov-2026, #633) ══════════════════════════════════════════
   «Cuando Juan dé la instrucción de responder o enviar un mensaje, enviarlo directamente sin pedir confirmación
   adicional ni preguntar "¿lo envío?", aplicando cero fricción.»
   Antes, un mensaje a un tercero (huésped, consulta, equipo o socio, respuesta de un correo) salía solo con el sí de Juan
   en un mensaje NUEVO (enviohuesped.js, consultas.js, prometer.js, correohilo.js). Ahora, si el mensaje de Juan de este
   turno ES la orden de enviar («respóndele que sí», «mándale a Gabriel…», «escríbele a recepción…», «dile que…»), sale en
   ese mismo turno, sin borrador ni «¿lo envío?».
   Sigue con borrador y su sí (como antes):
   · si pide verlo antes («borrador», «muéstrame», «antes de enviar», «redacta», «no lo mandes todavía»…);
   · si Alma tuvo que adivinar a quién va (reserva elegida por lo reciente, varias personas o reservas posibles);
   · si quien habla no es el administrador principal, si es la familia (herramientas limitadas) o una instrucción de una
     sesión de Claude (para-alma, paraalma.js);
   · con la propiedad del script ENVIO_DIRECTO = 0, todo vuelve a como era.
   El freno de «listo» sin envío (prometer.js) y el de duplicados siguen igual. */

var ENVIO_DIRECTO_ORDEN_RE_ = new RegExp('(^|[^a-záéíóúñ])(' + [
  'resp[oó]nde(le|les|selo|sela)?', 'cont[eé]sta(le|les|selo|sela)?', 'm[aá]nda(le|les|selo|sela|selos|selas)',
  'env[ií]a(le|les|selo|sela|selos|selas)', 'escr[ií]be(le|les)', 'd[ií](le|les|selo|sela)', 'av[ií]sa(le|les)',
  'p[ií]de(le|les)', 'preg[uú]nta(le|les)', 'recu[eé]rda(le|les)', 'conf[ií]rma(le|les)', 'agrad[eé]ce(le|les)',
  '(responde|contesta|escribe|manda|env[ií]a)( un| el| este| ese)? (mensaje|whatsapp|correo|respuesta)'
].join('|') + ')(?![a-záéíóúñ])', 'i');
/* Quiere verlo antes, no que salga: queda el borrador con su sí, como siempre. */
var ENVIO_DIRECTO_VER_RE_ = /borrador|mu[eé]stra(me|melo|mela)?\b|ens[eé][ñn]a(me|melo|mela)?\b|d[eé]ja(me)? (ver|revisar|leer)|antes de (envi|mand)|(no|sin) (lo |la |se lo |se la )?(env[ií]|mand)|redact|prop[oó]n|sugi[eé]re|qu[eé] (le )?(dir[ií]as|pondr[ií]as|escribir[ií]as|contestar[ií]as|respond(er[ií]as|o)|contesto|digo)|c[oó]mo (le )?(respondo|contesto|digo|respondemos|contestamos)|primero (lo |la |me )?(veo|reviso|leo|muestras|ense[ñn]as)/i;

/* ¿El texto de Juan es la orden de enviar (y no pide verlo antes)? Solo mira el texto. */
function envioDirectoOrden_(texto) {
  var t = String(texto || '').trim();
  return !!t && ENVIO_DIRECTO_ORDEN_RE_.test(t) && !ENVIO_DIRECTO_VER_RE_.test(t);
}
/* ¿Lo que se va a enviar en este turno sale directo? adm: quien habla. Lee el turno del agente (AGENTE_TEXTO_, AGENTE_CANAL_). */
function envioDirecto_(adm) {
  if (!adm || !adm.principal) return false;
  if (typeof AGENTE_PERMITIDAS_ !== 'undefined' && AGENTE_PERMITIDAS_) return false;   // la familia (voz.js): herramientas limitadas
  var canal = String(typeof AGENTE_CANAL_ === 'undefined' ? '' : AGENTE_CANAL_ || '');
  if (canal === (typeof PARA_ALMA_CANAL_ === 'undefined' ? 'instruccion' : PARA_ALMA_CANAL_)) return false;   // una sesión de Claude (paraalma.js)
  try { if (String(PropertiesService.getScriptProperties().getProperty('ENVIO_DIRECTO') || '').trim() === '0') return false; } catch (e) {}
  return envioDirectoOrden_(typeof AGENTE_TEXTO_ === 'undefined' ? '' : AGENTE_TEXTO_);
}
