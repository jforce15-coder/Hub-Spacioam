/* ═══ LAS PALABRAS DE JUAN, TAL CUAL (Juan, 17-nov-2026) ═══════════════════════════════════════════════════════════
   «Cuando tú le pides a Claudio, es importante que le pases mi transcripción y que la transcripción mía sea la referencia
   principal de lo que se le está pidiendo. Tú siempre haces un resumen de lo que entendiste, pero a veces ese resumen no
   es exactamente lo que yo estoy pidiendo.»
   Todo pedido a Claudio o a un agente lleva sus palabras exactas (palabras_de_juan) como la referencia principal; lo que
   entendió Alma va aparte (resumen_de_alma) y solo ayuda: si no coinciden, mandan sus palabras.
   · Chat del Hub, Chat con Alma, Pendientes, WhatsApp (también la nota de voz transcrita) y Modo calle: su mensaje tal
     cual (el texto del turno, AGENTE_TEXTO_).
   · Llamada (secretaria con «Mejora para Claude» y claudio_pedido): lo que la llamada transcribió de él (ElevenLabs, sus
     últimas frases hasta el momento del pedido). Si no se puede leer, lo que la voz copió palabra por palabra
     (palabras_de_juan de la herramienta). En una llamada nunca se usa el resumen de la voz como si fueran sus palabras.
   · Claudio local (claudiolocal.js): el dictado del iPhone de ese turno.
   Lo usan escalarJson_ (escalar.js), el borrador para Claude (chat.js), paraClaudeCrear_ (paraclaude.js) y los pedidos
   a los agentes (agentes.js). */

var LITERAL_LLAMADA_ = null;   // { conv, copia, hasta, texto? } mientras se atiende un pedido de una llamada
var LITERAL_MAX_ = 3000, LITERAL_TURNOS_ = 4;

/* Al empezar un pedido de una llamada: el id de la conversación, lo que copió la voz y el momento del pedido. dicho: lo que
   ya se sabe que dijo, tal cual (Claudio local: el dictado del iPhone de este turno); con él no se lee ElevenLabs. Si ya
   está puesto el de esa misma conversación con su dictado, no se cambia (claudio_pedido dentro de Claudio local). */
function literalLlamadaPoner_(conv, copia, hasta, dicho) {
  conv = String(conv || '').trim();
  if (dicho === undefined && LITERAL_LLAMADA_ && LITERAL_LLAMADA_.dictado && LITERAL_LLAMADA_.conv === conv) return;
  LITERAL_LLAMADA_ = { conv: conv, copia: String(copia || '').trim(), hasta: Number(hasta) || Date.now() };
  if (dicho !== undefined) { LITERAL_LLAMADA_.dictado = true; LITERAL_LLAMADA_.texto = literalCortar_(dicho); }
}

function literalCortar_(t) {
  t = String(t || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  return t.length > LITERAL_MAX_ ? '…' + t.slice(-(LITERAL_MAX_ - 1)) : t;   // lo último que dijo es lo que pide
}
function literalNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim(); }
/* ¿Dicen lo mismo? (sin tildes, mayúsculas ni signos) */
function literalIgual_(a, b) { return literalNorm_(a) === literalNorm_(b); }

/* Sus últimas frases en una llamada, como las transcribió ElevenLabs, hasta hastaMs (0 = hasta ahora). '' si no se pudo. */
function literalDeLlamada_(conv, hastaMs) {
  conv = String(conv || '').trim(); if (!/^conv_/.test(conv) || /^conv_local_/.test(conv)) return '';   // Claudio local no pasa por ElevenLabs
  var key = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY'); if (!key) return '';
  try {
    var r = uf_('https://api.elevenlabs.io/v1/convai/conversations/' + encodeURIComponent(conv), { headers: { 'xi-api-key': key }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var d = JSON.parse(r.getContentText() || '{}'), ini = Number((d.metadata || {}).start_time_unix_secs || 0);
    var dichas = (d.transcript || []).filter(function (m) {
      if (!m || m.role !== 'user' || !String(m.message || '').trim()) return false;
      return !hastaMs || !ini || (ini + Number(m.time_in_call_secs || 0)) * 1000 <= hastaMs + 2000;
    }).map(function (m) { return String(m.message).trim(); });
    return literalCortar_(dichas.slice(-LITERAL_TURNOS_).join('\n'));
  } catch (e) { console.error('literalDeLlamada_: ' + e); return ''; }
}

/* Las palabras de Juan para el pedido de este turno. texto: su mensaje (en el chat ya es literal). En una llamada se lee
   la transcripción una sola vez por ejecución; si la voz copió algo que no está en ella, se suma al final. */
function literalDeJuan_(texto) {
  var L = LITERAL_LLAMADA_;
  if (L) {
    if (L.texto === undefined) {
      var t = literalDeLlamada_(L.conv, L.hasta), c = L.copia;
      if (c && literalNorm_(t).indexOf(literalNorm_(c)) < 0) t = t ? t + '\n' + c : c;
      L.texto = literalCortar_(t);
    }
    return L.texto;
  }
  return literalCortar_(texto !== undefined ? texto : (typeof AGENTE_TEXTO_ !== 'undefined' ? AGENTE_TEXTO_ : ''));
}

/* La regla que va en cada pedido (pasos del JSON). */
var LITERAL_REGLA_ = 'La referencia principal es contexto.palabras_de_juan: lo que Juan dijo o escribió, tal cual. contexto.resumen_de_alma es solo lo que Alma entendió; si no coinciden, mandan las palabras de Juan.';

/* En el cuerpo del pedido (paraclaude.js): sus palabras arriba, como cita. */
function literalBloque_(lit) {
  lit = String(lit || '').trim(); if (!lit) return '';
  return '### Palabras de Juan, tal cual (la referencia principal)\n' + lit.split('\n').map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
}
