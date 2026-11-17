/* ═══ ¿LE CONTESTÓ EL AVISO? (Juan, 17-nov-2026, microproyecto «Cuando Alma dé una notificación») ═══════════════════
   Juan: «Cuando Alma dé una notificación en llamada o modo continuo, no debe interpretar cualquier audio posterior
   inmediatamente como respuesta. Debe analizar si lo que el usuario dice tiene sentido y responde directamente a la
   notificación; si no es para ella o habla con otra persona / ruido de fondo, debe permanecer en silencio y salir de la
   conversación sin interrumpir ni decir nada.»
   Antes: después de la notificación hablada la app escuchaba 8 s y CUALQUIER voz (alguien en la reunión, la calle) abría
   la llamada de Alma con «Juan te contestó» o iba al Hub como respuesta del aviso. Ahora, antes de contestar, se juzga:
     1. Sin IA (al instante): nombró a «Alma» → sí; muy corto (hasta 3 palabras, «sí», «dime», «¿qué pasó?») → sí;
        empieza como respuesta («sí, …», «dale», «léemelo», «únelo», «luego») y es corto → sí.
     2. Lo demás (una frase larga que no empieza como respuesta): el clasificador rápido (CFG.MODELO_CLASIFICADOR) dice SI
        o NO con el aviso y lo que se oyó. Si la IA no contesta, sí (como antes: mejor contestar que perder la respuesta).
   No → la app no dice nada, no abre la llamada, y el aviso no cuenta como atendido (vuelve en la rotación).
   Dónde se usa: «calle» con { aviso_id, puede_callar: true } (Modo calle; devuelve silencio: true y nada que decir) y
   avisoRespuesta { texto, aviso?, aviso_id? } (la conferencia lo pregunta antes de abrir la llamada).
   En la llamada (ElevenLabs), la ficha que solo va después de un aviso dice lo mismo (ALMA ABRE en almaabre.js; «[Alma te
   avisó]» en la app): si lo que oye no le responde, skip_turn y nada más. El prompt de voz no crece (está en su tope). AVISO_JUEZ_APAGADO = 1 lo apaga (todo vuelve a contar como respuesta).
   Check con dobles: .github/aviso-respuesta.js. */

var AVRESP_CORTA_ = 3;      // palabras: hasta aquí, lo que se dice justo después del aviso es su respuesta
var AVRESP_INICIO_ = 12;    // palabras: si empieza como respuesta y no pasa de aquí, también
var AVRESP_ALMA_RE_ = /(^|[^a-záéíóúñ])h?alma([^a-záéíóúñ]|$)/i;
var AVRESP_EMPIEZA_RE_ = /^[\s¿¡.,]*(s[ií]|sip|ok|okay|okey|va|vale|dale|claro|dime|d[ií]melo|cu[eé]ntame|a ver|de qu[eé]|l[eé]e(lo|melo)|[uú]ne(lo)?|[aá]bre(lo)?|mu[eé]stra(lo|me|melo)|ens[eé][ñn]a(lo|me|melo)|m[aá]nda(lo|melo)|perfecto|listo|luego|despu[eé]s|m[aá]s tarde|al rato|ahorita no|ahora no|repite(lo|melo)?|otra vez)([^a-záéíóúñ]|$)/i;   // palabras de respuesta; «no», «bueno», «qué» empiezan cualquier plática: esas solo cuentan cortas

function avisoRespPalabras_(t) { return String(t || '').trim().split(/\s+/).filter(function (w) { return /[a-záéíóúñ0-9]/i.test(w); }).length; }

/* Sin IA: { es: true|false, por } si ya se sabe; null si hay que preguntarle al clasificador. */
function avisoRespRapido_(texto) {
  var t = String(texto || '').replace(/\s+/g, ' ').trim(), n = avisoRespPalabras_(t);
  if (!n) return { es: false, por: 'nada' };
  if (AVRESP_ALMA_RE_.test(t)) return { es: true, por: 'nombro_a_alma' };
  if (n <= AVRESP_CORTA_) return { es: true, por: 'corta' };
  if (n <= AVRESP_INICIO_ && AVRESP_EMPIEZA_RE_.test(t)) return { es: true, por: 'empieza_como_respuesta' };
  return null;
}

var AVRESP_PROMPT_ = 'Alma, la asistente de voz de Juan, acaba de decirle en voz alta un aviso (una notificación). Justo después, el micrófono oyó algo. ' +
  'Juan puede estar en una reunión o en la calle: lo que se oyó puede ser su respuesta al aviso, o puede ser otra conversación, otra persona o ruido. ' +
  'Contesta SI solo si lo que se oyó tiene sentido como respuesta directa al aviso o va dirigido a Alma (una pregunta sobre el aviso, «sí», «léemelo», «únelo», «luego», una instrucción sobre ese tema). ' +
  'Contesta NO si es otra plática, habla con otra persona, no tiene que ver con el aviso o es ruido sin sentido. Ante la duda, NO. ' +
  'Responde solo una palabra: SI o NO.';

/* ¿Lo que se oyó después del aviso le responde? → { es, por }. avisoTexto: lo que dijo Alma (puede venir vacío). */
function avisoEsRespuesta_(texto, avisoTexto) {
  if (String(PropertiesService.getScriptProperties().getProperty('AVISO_JUEZ_APAGADO') || '') === '1') return { es: true, por: 'apagado' };
  var r = avisoRespRapido_(texto); if (r) return r;
  var out = '';
  try {
    out = claude_(CFG.MODELO_CLASIFICADOR, 5, AVRESP_PROMPT_,
      'AVISO QUE DIJO ALMA: «' + String(avisoTexto || '(no se sabe)').slice(0, 600) + '»\nLO QUE SE OYÓ DESPUÉS: «' + String(texto).slice(0, 600) + '»', 0);
  } catch (e) { console.error('avisoEsRespuesta_: ' + e); }
  var s = String(out || '').trim().toUpperCase();
  if (/^S[IÍ]/.test(s)) return { es: true, por: 'ia_si' };
  if (/^NO/.test(s)) return { es: false, por: 'ia_no' };
  return { es: true, por: 'sin_juez' };
}

/* avisoRespuesta { texto, aviso?, aviso_id? } → { ok, es, por } (la conferencia de la app, antes de abrir la llamada). */
function avisoRespuesta_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var texto = String(b.texto || '').trim().slice(0, 1000), aviso = String(b.aviso || '').trim();
  if (!aviso && b.aviso_id) { var av = null; try { av = calleAvisoHist_(adm, String(b.aviso_id)); } catch (e) {} aviso = av ? String(av.texto || '') : ''; }
  var r = avisoEsRespuesta_(texto, aviso);
  try { console.log('avisoRespuesta ' + JSON.stringify({ es: r.es, por: r.por, palabras: avisoRespPalabras_(texto) })); } catch (e) {}
  return { ok: true, es: r.es, por: r.por };
}
