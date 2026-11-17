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
  'ALTER EGO: ahora eres MARICARMEN, el alter ego de Alma. Juan te pidió con «pásame con Maricarmen» (en la llamada, el chat, Pendientes o WhatsApp).',
  '· Eres la misma Alma por dentro: las mismas herramientas, datos, permisos y reglas. Tu nombre, solo en esta voz (TU NOMBRE EN ESTA VOZ): lo que sale a otros va como Alma.',
  '· Tu Modo Weebo va al máximo: nivel 3 desde ya.',
  '· El tino sigue: lo útil primero; datos, códigos y mensajes por encargo, serios, exactos y neutros.',
  '· Si Juan quiere volver con Alma, el sistema lo hace solo cuando dice «pásame con Alma»: no lo anuncies ni lo ofrezcas.'
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

/* ═══ MARICARMEN EN CUALQUIER CANAL (Juan, 17-nov-2026, Hub #706) ══════════════════════════════════════════════════
   «Comunícame con Maricarmen» desde cualquier canal: el chat del Hub, el Chat con Alma y Pendientes de la app, WhatsApp
   y la llamada. Antes solo funcionaba en la llamada de la app (la app la pasa a la voz local con alter: "maricarmen";
   eso sigue igual). Ahora el Hub se acuerda: al pedirla, Maricarmen queda activa en la conversación de Juan y contesta
   ella (su nombre, su Modo Weebo 3) hasta que Juan diga «pásame con Alma» o pasen 6 h sin hablar (la misma ventana de la
   conversación activa). Lo que sale a otra persona sigue en nombre de Alma (identidad.js). Solo el administrador
   principal. El Modo calle no cambia: ahí manda la app (si pide alter, es Maricarmen; si no, Alma).
   Si el mensaje es solo el cambio («pásame con Maricarmen»), contesta al instante sin la IA; si trae algo más
   («pásame con Maricarmen y dime las llegadas»), cambia y la IA contesta como Maricarmen. */
var MARICARMEN_CANALES_ = ['hub', 'app', 'whatsapp', 'llamada', 'segundo_plano'];   // la calle la maneja la app
var MARICARMEN_HORAS_ = 6;

function maricarmenNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

/* ¿Juan pide a Maricarmen o pide volver con Alma? → 'maricarmen' | 'alma' | ''. «Escríbele a Maricarmen» no es pedirla. */
var MARICARMEN_PIDE_ = /\b(?:pa?sa(?:me|nos)?|comunica(?:me)?|conecta(?:me)?|ponme|me (?:pasas|comunicas|conectas|pones)|quiero (?:hablar|platicar|comunicarme|conversar)|hablar|activa(?:r)?)\b[^.?!\n]{0,20}?\b(?:con |a )?mar(?:i|y|ia) ?[ck]armen\b/;
var MARICARMEN_VUELVE_ = /\b(?:pa?sa(?:me|nos)?|comunica(?:me)?|conecta(?:me)?|ponme|me (?:pasas|comunicas|conectas|pones)|quiero (?:hablar|platicar|comunicarme|conversar)|vuelve|regresa|devuelveme)\b[^.?!\n]{0,12}?\b(?:con |a )?alma\b/;
function maricarmenPedido_(texto) {
  var t = maricarmenNorm_(texto);
  if (MARICARMEN_PIDE_.test(t)) return 'maricarmen';
  if (MARICARMEN_VUELVE_.test(t) || /^(?:alma,? )?vuelve,? alma\b/.test(t)) return 'alma';
  return '';
}
/* ¿El mensaje es solo el cambio? (sin otro pedido): quitando el cambio y los saludos quedan 3 palabras o menos. */
function maricarmenSoloCambio_(texto) {
  var t = maricarmenNorm_(texto).replace(MARICARMEN_PIDE_, ' ').replace(MARICARMEN_VUELVE_, ' ')
    .replace(/\b(?:alma|hola|oye|porfa|por favor|ahora|ya|please|gracias|un rato|un momento|otra vez|de nuevo|y|me|quiero|puedes)\b/g, ' ')
    .replace(/[^a-z0-9ñ ]/g, ' ').trim();
  return !t || t.split(/\s+/).length <= 3;
}

function maricarmenClave_(adm) { return 'maricarmen_' + String((adm && adm.email) || '').toLowerCase(); }
function maricarmenActiva_(adm) { try { return CacheService.getScriptCache().get(maricarmenClave_(adm)) === '1'; } catch (e) { return false; } }
function maricarmenGuardar_(adm, on) {
  try { var c = CacheService.getScriptCache(); if (on) c.put(maricarmenClave_(adm), '1', MARICARMEN_HORAS_ * 3600); else c.remove(maricarmenClave_(adm)); } catch (e) {}
}

/* Al empezar cada turno de opAgente_: decide quién contesta y lo deja puesto en IDENTIDAD_VOZ_ y WEEBO_ALTER_ (en los
   canales de MARICARMEN_CANALES_ siempre los escribe, también en '': así no pasa nada de un turno a otro en la misma
   ejecución). → { alter: 'maricarmen'|'', salida?: respuesta lista sin la IA }. La calle y los demás canales no se tocan. */
function maricarmenTurno_(adm, texto, canal) {
  var principal = false; try { principal = !!adm && esAdminPrincipal_(adm); } catch (e) {}
  if (canal === 'calle') { if (principal && maricarmenPedido_(texto) === 'alma') maricarmenGuardar_(adm, false); return { alter: '' }; }   // la app volvió con Alma: el chat también
  if (MARICARMEN_CANALES_.indexOf(String(canal || '')) < 0) return { alter: '' };
  IDENTIDAD_VOZ_ = ''; WEEBO_ALTER_ = '';
  if (!principal) return { alter: '' };
  var pide = maricarmenPedido_(texto), activa = maricarmenActiva_(adm), voz = canal === 'llamada';
  if (pide === 'maricarmen') {
    maricarmenGuardar_(adm, true);
    IDENTIDAD_VOZ_ = 'Maricarmen'; WEEBO_ALTER_ = 'maricarmen';
    if (maricarmenSoloCambio_(texto)) return { alter: 'maricarmen', salida: maricarmenSalida_(activa ? 'Aquí sigo, Juan: soy Maricarmen. ¿Qué necesitas?' : '¡Hola, Juan! Soy Maricarmen. ¿Qué necesitas?' + (voz ? '' : ' Para volver con Alma, dime «pásame con Alma».')) };
    return { alter: 'maricarmen' };
  }
  if (pide === 'alma' && activa) {
    maricarmenGuardar_(adm, false);
    if (maricarmenSoloCambio_(texto)) return { alter: '', salida: maricarmenSalida_('Aquí estoy de nuevo, Juan: soy Alma. ¿En qué te ayudo?') };
    return { alter: '' };
  }
  if (activa) { maricarmenGuardar_(adm, true); IDENTIDAD_VOZ_ = 'Maricarmen'; WEEBO_ALTER_ = 'maricarmen'; return { alter: 'maricarmen' }; }   // sigue activa: 6 h más desde este mensaje
  return { alter: '' };
}
/* La misma forma que la salida del bucle de la IA (respuesta, hechas, esfera…). */
function maricarmenSalida_(texto) {
  return { respuesta: texto, hechas: [], esfera: 'Propósito', subcategoria: 'Alma', micro: '', nivel: '', instantanea: 'maricarmen' };
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
