/* ═══ MARICARMEN: el alter ego de Alma (Juan, 17-nov-2026, Hub #666) ════════════════════════════════════════════
   «Pásame con Maricarmen»: en la llamada de la app de Alma, Juan pasa a Maricarmen, el alter ego de Alma. Va 100 % por
   la voz local del iPhone (la misma oreja y la misma voz de mujer que la voz de respaldo; sin ElevenLabs) y su cabeza es
   el Chat con Alma por la acción calle con { sin_audio: true, alter: 'maricarmen' } (calle.js; también vale persona: 'maricarmen', #671). Su nombre solo en la voz lo pone identidad.js; aquí, quién
   es: la misma Alma (mismas herramientas, datos y reglas) con el Modo Weebo al máximo (nivel 3 desde la primera
   respuesta, sin la rampa de «se enciende despacio») y con el acento del nivel 3 (español de España pleno).
   Solo el administrador principal: con cualquier otro, la acción calle ignora el alter y contesta Alma de siempre.
   «Pásame con Alma» (o «vuelve Alma») lo resuelve la app sola (alma-app, MaricarmenReglas.swift): vuelve la voz de
   ElevenLabs sin colgar. */

var WEEBO_ALTER_ = '';   // 'maricarmen' mientras contesta una frase de Maricarmen (calle_ lo pone y lo quita)

var MARICARMEN_BLOQUE_ = [
  'ALTER EGO: ahora eres MARICARMEN, el alter ego de Alma. Juan te llamó con «pásame con Maricarmen».',
  '· Eres la misma Alma por dentro: las mismas herramientas, datos, permisos y reglas. Tu nombre, solo en esta voz (TU NOMBRE EN ESTA VOZ): lo que sale a otros va como Alma.',
  '· Tu Modo Weebo va al máximo: nivel 3 desde ya.',
  '· El tino sigue: lo útil primero; datos, códigos y mensajes por encargo, serios, exactos y neutros.',
  '· Si Juan quiere volver con Alma, la app lo hace sola: no lo anuncies ni lo ofrezcas.'
].join('\n');

/* ¿El pedido de la acción calle viene de Maricarmen? Solo con el administrador principal. */
function maricarmenAlter_(b, principal) {
  return !!principal && String((b && b.alter) || '').toLowerCase() === 'maricarmen' ? 'maricarmen' : '';
}

/* Lo que cambia weeboBloque_ (weebo.js) con Maricarmen: nivel 3 fijo con Juan (contexto admin), con su porqué. */
function maricarmenWeebo_(m, o) {
  if (WEEBO_ALTER_ !== 'maricarmen' || !o || !o.principal || o.contexto !== 'admin') return false;
  m.nivel = 3; m.razones = ['Maricarmen: Modo Weebo al máximo, pedido por Juan'];
  return true;
}

/* ── Alma la pasa sola, dentro de la llamada (Juan, 17-nov-2026, Hub #707) ──────────────────────────────────────────
   «Poder hablar directamente con Maricarmen dentro de la llamada de la app de Alma, sin derivarlo a WhatsApp ni llamadas
   externas.» Antes solo entraba si la app reconocía la frase exacta («pásame con Maricarmen»); si Juan lo decía de otra
   forma, Alma (ElevenLabs) no sabía quién era y ofrecía escribirle o llamarla. Ahora Alma tiene la herramienta de CLIENTE
   pasar_a_maricarmen (como hablar_con_claudio: la atiende la app, sin URL ni llave) y la usa en cuanto Juan pide hablar,
   comunicarse o «llamar» a Maricarmen. Solo el principal y solo en una app que sabe hacerlo (la pide con «maricarmen»). */
var MARICARMEN_PERMISO_ = 'PUEDES PASARLO CON MARICARMEN: es tu alter ego de voz en esta misma llamada (no una persona ni un contacto). Si Juan pide hablar, comunicarse o llamar a Maricarmen, usa pasar_a_maricarmen: nunca le ofrezcas WhatsApp, una llamada aparte ni un mensaje.';
function maricarmenPermiso_(adm) { try { return adm && esAdminPrincipal_(adm) ? MARICARMEN_PERMISO_ : ''; } catch (e) { return ''; } }
function vozPasarAMaricarmen_() {
  return { type: 'client', name: 'pasar_a_maricarmen', expects_response: false, response_timeout_secs: 1,
    description: 'Pasa a Juan con Maricarmen, tu alter ego de voz, dentro de esta misma llamada de la app (sin colgar). Úsala SOLO si la FICHA DE QUIEN LLAMA dice «PUEDES PASARLO CON MARICARMEN» y Juan pide hablar, comunicarse, pasar o llamar a Maricarmen (dicho como sea). Llámala en ese mismo turno, sin confirmar ni anunciar nada y sin decir nada después: la app cambia la voz al instante. Maricarmen no es una persona ni un contacto: nunca le ofrezcas WhatsApp, una llamada aparte ni un mensaje. Sin esa línea en la ficha, no la uses.',
    parameters: { type: 'object', required: [], properties: {} },
    pre_tool_speech: 'off', force_pre_tool_speech: false, disable_interruptions: false };
}
