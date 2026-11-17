/* ═══ 15d · MARICARMEN: SU NOMBRE SOLO EN LA VOZ (Juan, 17-nov-2026, #667) ═══════════════════════════════════════════
   «Sumar a Maricarmen que solo de voz se identifique como Maricarmen, pero cualquier mensaje, contacto o acción externa
   siempre lo haga en nombre de Alma.» Maricarmen es el alter ego de voz de Alma (#666: «pásame con Maricarmen»). Es la
   misma Alma con otro nombre, y ese nombre vive solo en la conversación de voz con Juan:
     · en la voz, se presenta y habla como Maricarmen (identidadVozRegla_, en el prompt del turno);
     · todo lo que sale a otra persona (WhatsApp, plantillas, correos, encargos, mensajes programados, tareas al equipo)
       va SIEMPRE en nombre de Alma. Lo dice la regla y, por si la IA se equivoca, lo asegura el código: identidadEntrada_
       corre antes de CADA herramienta del agente (agEjecutar_) y cambia «soy Maricarmen», «te saluda Maricarmen»,
       «Maricarmen, la asistente…» o una firma «— Maricarmen» por Alma. Una persona de verdad que se llame Maricarmen
       («Hola Maricarmen», «escríbele a Maricarmen») no se toca: solo se cambia cuando el texto se presenta o firma con ese
       nombre.
   Cómo se enciende: la app manda persona: "maricarmen" en la acción «calle» (calle.js); el Hub pone IDENTIDAD_VOZ_ solo
   durante ese turno y opAgente_ suma la regla al prompt. Otro valor, o nada, es Alma de siempre. Solo el administrador
   principal (Maricarmen no existe con el equipo, socios, huéspedes ni externos).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var IDENTIDAD_EXTERNA_ = 'Alma';
var IDENTIDAD_ALTER_EGOS_ = { maricarmen: 'Maricarmen' };   // persona (lo que manda la app) → su nombre de voz
var IDENTIDAD_VOZ_ = '';                                   // el nombre de voz de ESTE turno ('' = Alma)

/* El nombre de voz que pide la app, solo si es uno conocido y quien habla es el principal. */
function identidadVozDe_(persona, adm) {
  var p = String(persona || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!IDENTIDAD_ALTER_EGOS_[p]) return '';
  try { return adm && esAdminPrincipal_(adm) ? IDENTIDAD_ALTER_EGOS_[p] : ''; } catch (e) { return ''; }
}

/* Hub #680: fuera de la llamada de la app (chat, WhatsApp), Alma no sabía quién era Maricarmen: si Juan la pedía, no pasaba
   nada o buscaba a una persona. Si Juan la nombra (y no está hablando ya con ella), el turno suma esta pista. Solo entonces:
   así no cuesta en los demás mensajes. */
function identidadPistaAlter_(adm, texto) {
  if (IDENTIDAD_VOZ_ || !/mar(?:i|y|ia)\s?[ck]armen/i.test(String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return '';
  try { if (!adm || !esAdminPrincipal_(adm)) return ''; } catch (e) { return ''; }
  return '\nMARICARMEN: es tu alter ego de voz (no una persona ni un contacto: no la busques ni le escribas a nadie). Si Juan quiere hablar ' +
    'o comunicarse con ella (o que ella lo llame), dile en una frase cómo: diciendo «pásame con Maricarmen» aquí mismo (chat, Pendientes, WhatsApp) o en la llamada de la app; vuelve contigo con «pásame con Alma» (maricarmen.js, #706). ' +
    'Eso no es un cambio del sistema: no lo pidas a Desarrollo.';
}

/* Hub #705 (Juan, 17-nov-2026, en una llamada): «Comunicar a Juan con Mari Carmen o solicitarle que lo llame» salió como
   pedido a Desarrollo, aunque ya existe: Maricarmen vive en la llamada de la app. Si el principal pide HABLAR con ella
   (pásame, comunícame, conéctame, quiero hablar con…) o que ELLA LO LLAME, el turno no escala (chatTurnoCerrar_, chat.js):
   Alma le dice cómo en una frase (IDENTIDAD_COMO_ALTER_). Maricarmen no llama sola (no tiene teléfono: es la voz local de
   la app); la forma es abrir la llamada de Alma y decir «pásame con Maricarmen», que la app atrapa al instante. Un pedido
   de CAMBIAR algo de Maricarmen («haz que Maricarmen hable más lento») sí sigue a Desarrollo. */
var IDENTIDAD_COMO_ALTER_ = 'Para hablar con Maricarmen, dime «pásame con Maricarmen» aquí mismo o en la llamada de Alma; ' +
  'ella no puede llamarte sola. Para volver conmigo, «pásame con Alma».';   // #706: «pásame con Maricarmen» ya la activa en el chat (maricarmen.js)
function identidadPideAlter_(adm, texto) {
  if (IDENTIDAD_VOZ_) return false;
  var t = ' ' + String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\bmar(?:i|y|ia) ?[ck]armen\b/g, 'maricarmen') + ' ';
  if (t.indexOf(' maricarmen ') < 0) return false;
  try { if (!adm || !esAdminPrincipal_(adm)) return false; } catch (e) { return false; }
  if (/ (haz|hagas|hagan|hacer|cambia|cambiale|cambiar|agrega|agregale|agregar|anade|anadele|suma|sumale|quita|quitale|arregla|arreglar|mejora|mejorar|configura|ajusta|ajustar|programa|programar|que pueda|que sepa|que hable|que diga|que suene|no funciona|falla) /.test(t)) return false;
  var hablar = / (pasa|pasame|pasar|pasarme|pasas|pon|ponme|ponerme|comunica|comunicame|comunicar|comunicarme|comunicarlo|conecta|conectame|conectar|conectarme|conectarlo|hablar|habla|hablo|platicar|conversar)( \w+){0,4} con (la )?maricarmen /;
  var llame = / maricarmen( \w+){0,4} (me|lo|le|a juan) (llame|llama|marque|hable)|(me|lo|le) (llame|marque) maricarmen|llamada (de|con) maricarmen /;
  return hablar.test(t) || llame.test(t);
}

/* La regla para el prompt del turno (vacía si habla Alma). */
function identidadVozRegla_(nombre) {
  nombre = String(nombre || '').trim(); if (!nombre) return '';
  return '\nTU NOMBRE EN ESTA VOZ: en esta conversación con Juan (de voz o por escrito) te llamas ' + nombre + ' (eres Alma con otro nombre: mismas herramientas, misma memoria). ' +
    'Si te presentas o te pregunta quién eres, di que eres ' + nombre + '. ' +
    'PERO todo lo que sale a otra persona (mensajes, plantillas, correos, encargos, mensajes programados, tareas al equipo, llamadas) va SIEMPRE en nombre de ' + IDENTIDAD_EXTERNA_ + ': ' +
    'ahí nunca escribas, firmes ni te presentes como ' + nombre + ' («Soy ' + IDENTIDAD_EXTERNA_ + ', la asistente de Juan»), y no menciones a ' + nombre + ' a terceros.';
}

/* Cambia la presentación o la firma con un nombre de voz por Alma. Un saludo o una mención a otra persona no se toca. */
function identidadExterna_(texto) {
  var t = String(texto == null ? '' : texto);
  Object.keys(IDENTIDAD_ALTER_EGOS_).forEach(function (k) {
    var n = IDENTIDAD_ALTER_EGOS_[k], N = '(' + n.slice(0, 4) + '\\s?' + n.slice(4) + ')';   // «Maricarmen» o «Mari Carmen»
    var verbo = '(\\b(?:soy|habla|te saluda|les saluda|le saluda|te escribe|les escribe|le escribe|me llamo|mi nombre es|aqu[ií] (?:es|habla)|i am|i\'m|this is|my name is)\\s+)';
    t = t.replace(new RegExp(verbo + N + '\\b', 'gi'), function (m, v) { return v + IDENTIDAD_EXTERNA_; })
      .replace(new RegExp('\\b' + N + '(\\s*,?\\s*(?:la|tu|su)\\s+(?:asistente|assistant))', 'gi'), function (m, nn, resto) { return IDENTIDAD_EXTERNA_ + resto; })
      .replace(new RegExp('(\\b(?:asistente|assistant)\\s*,?\\s+)' + N + '\\b', 'gi'), function (m, a) { return a + IDENTIDAD_EXTERNA_; })
      .replace(new RegExp('(^|\\n)(\\s*(?:[—–-]\\s*|(?:saludos|atentamente|un abrazo|gracias)\\s*,?\\s*\\n?\\s*))' + N + '(\\s*(?:\\n|$))', 'gi'), function (m, ini, pre, nn, fin) { return ini + pre + IDENTIDAD_EXTERNA_ + fin; });
  });
  return t;
}

/* Antes de cada herramienta del agente: los textos que pueden salir a otra persona (cualquier campo de texto, también
   dentro de listas u objetos) van en nombre de Alma. Cambia el mismo objeto (quien llama puede seguir leyéndolo). */
function identidadEntrada_(inp) {
  var limpia = function (v, prof) {
    if (typeof v === 'string') return identidadExterna_(v);
    if (prof > 3 || !v || typeof v !== 'object') return v;
    Object.keys(v).forEach(function (k) { var nv = limpia(v[k], prof + 1); if (nv !== v[k]) v[k] = nv; });
    return v;
  };
  return limpia(inp || {}, 0);
}
