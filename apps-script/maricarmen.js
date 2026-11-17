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
