/* ═══ PEDIDO PERSONAL DEL PRINCIPAL (agenda, familia, invitaciones) ═══════════════════════════════════════════════════
   20-nov-2026: Juan reenvió por WhatsApp una invitación (una foto: «… NIGHT OUT · FRI 27 NOV · Location TBD») y, un minuto
   después, una nota de voz: «ponlo en mi agenda… en mi Google Calendar». Alma contestó a la foto sola en 1 s con
   «¿Esto es para Confirmar envío de mensaje a huésped o para <otra persona> respuesta?» (temaElegir_ dudó entre dos temas
   de trabajo) y a la nota de voz con «¿Quieres que le confirme a ella que sí vas?», mezclándolo con ese tema. La foto se
   leyó bien y la nota de voz se transcribió bien: el error fue de agrupar y de clasificar. Ahora, sin IA:
   · Material suelto (reenviado, foto o documento sin instrucción propia): se espera OP_MEDIA_SEG (90 s) a que llegue la
     instrucción (la nota de voz suele tardar lo que dura), y todo se lee como UN pedido (opAgruparEspera_).
   · Lo personal (agenda, invitaciones, escuela, familia) se separa de lo operativo ANTES de elegir tema o caso
     (ppClasificar_): va a su propio tema personal, nunca pregunta «¿Esto es para A o para B?» de trabajo, no se toma como
     respuesta a una decisión del equipo y Alma recibe una nota corta (ppNota_).
   · «Ponlo en mi agenda» es la orden: crear_evento sale sin la pregunta de confirmación (ppConfirmarAgenda_) y la
     respuesta trae el enlace del evento (calendarioEnlace_, calendario.js). */

var OP_MEDIA_SEG_ = 90;   // espera del material suelto; Propiedad OP_MEDIA_SEG (30 a 180) lo cambia
/* La orden de agendar: «ponlo en mi agenda», «apúntalo», «agéndalo», «en mi calendario», «save the date». */
var PP_AGENDA_RE_ = /\b(ap[uú]nta(lo|la|me)?|an[oó]ta(lo|la)? en (mi|el) (agenda|calendario)|ag[eé]nda(lo|la|me)|calendar[ií]za(lo|la)|(pon|mete|agrega|a[nñ]ade|guarda)(lo|la|me)? (en|a) (mi|el) (agenda|calendario|google calendar)|en mi (agenda|calendario|google calendar)|google calendar|save the date|add (it )?to (my )?calendar)\b/i;
/* Una invitación o algo de la vida personal: fiesta, cena, escuela, hijos, cumpleaños, boda, «location TBD», RSVP. */
var PP_INVITA_RE_ = /\b(night out|party|fiesta|cumplea[nñ]os|birthday|boda|wedding|invitaci[oó]n|invitation|invite|rsvp|location tbd|save the date|cena|dinner|brunch|playdate|reuni[oó]n de padres|padres de (la|el) (escuela|colegio)|dads|moms|escuela de (mis|los) hijos|colegio de (mis|los) hijos|mis hijos|mi esposa|mi familia)\b/i;
/* Lo operativo: si aparece y no hay orden de agendar, no es personal. */
var PP_OPERA_RE_ = /\b(hu[eé]sped(es)?|reserva(s|ci[oó]n)?|check.?in|check.?out|airbnb|booking|hospitable|limpieza|mantenimiento|socio|socia|propietari[oa]|apartamento|depa|inquilin[oa]|recepci[oó]n|epi|grow|cotizaci[oó]n)\b/i;
/* Una fecha escrita en el material («FRI 27 NOV», «27 de noviembre», «viernes 27»). */
var PP_FECHA_RE_ = /\b((mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2})\b/i;

/* ¿Es un pedido personal? → { personal, agenda, invitacion }. Sin IA: corre en cada mensaje del principal. */
function ppClasificar_(texto) {
  var t = String(texto || '');
  var agenda = PP_AGENDA_RE_.test(t), invita = PP_INVITA_RE_.test(t) || (/\[envi[oó] una foto/i.test(t) && PP_FECHA_RE_.test(t) && /\b(tbd|join us|you'?re invited|ven|vengan|acomp[aá][nñ]anos)\b/i.test(t));
  var opera = PP_OPERA_RE_.test(t.replace(/\[envi[oó] una foto[^\]]*\]/gi, ' '));   // lo que dice el afiche no cuenta como operativo
  return { personal: agenda || (invita && !opera), agenda: agenda, invitacion: invita };
}
/* ¿El texto ordena agendarlo? (para crear_evento sin la pregunta de confirmación). */
function ppAgendaOrden_(texto) { return PP_AGENDA_RE_.test(String(texto || '')); }

/* ¿Es solo material (reenviado, foto o documento sin instrucción propia)? items: [{ texto, tipo }] como en ALMA_WHATSAPP. */
function ppSoloMaterial_(items) {
  items = items || []; if (!items.length) return false;
  return items.every(function (x) {
    var t = String(x.texto || '').trim(), tipo = String(x.tipo || '');
    if (tipo === 'audio') return false;                                   // una nota de voz ES la instrucción
    if (/^\[reenviado\]/.test(t)) return true;                            // viene de otro chat
    return /^(image|document|video|sticker)$/.test(tipo) && /^\[envi[oó] (una foto|un documento|un video)|^\[sticker\]/i.test(t);   // sin pie propio
  });
}
/* Cuánto esperar a que deje de escribir: 90 s si es solo material (llega la instrucción después), si no OP_AGRUPAR_SEG. */
function opAgruparEspera_(items) {
  if (!ppSoloMaterial_(items)) return opAgruparSeg_() * 1000;
  var n = Number(PropertiesService.getScriptProperties().getProperty('OP_MEDIA_SEG'));
  return (n >= 30 && n <= 180 ? n : OP_MEDIA_SEG_) * 1000;
}

/* La nota para Alma en el turno (no va al prompt fijo: el de voz está en su tope). '' si no es personal. */
function ppNota_(texto) {
  var c = ppClasificar_(texto); if (!c.personal) return '';
  return '(Pedido PERSONAL de Juan (su agenda, su familia, una invitación): no es de huéspedes, socios ni de un caso pendiente; no lo mezcles con otros temas.' +
    (c.agenda ? ' Pide ponerlo en su agenda: usa crear_evento ya (sin preguntar), con la zona que él diga (si no dice, España), y confírmalo con el enlace.'
      : ' Si es una invitación o un evento con fecha, pregúntale solo si lo pones en su agenda y a qué hora.') + ')';
}
/* crear_evento con la orden explícita de Juan en el turno: sin la pregunta de confirmación. */
function ppConfirmarAgenda_(inp, textoTurno) {
  if (inp && inp.confirmado !== true && ppAgendaOrden_(textoTurno)) inp.confirmado = true;
  return inp;
}
