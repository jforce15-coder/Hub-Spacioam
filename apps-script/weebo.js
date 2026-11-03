/* ═══ 17 · MODO WEEBO: la personalidad de Alma según la confianza ═══════════════════════════════════════
   En honor a Weebo (Flubber, 1997): la asistente que se sentía humana por su conducta, no por su forma. Alma tiene un
   centro neutro (cálida, clara, al grano) y un modo Weebo (humor, emoción, opinión, chispa) que se habilita poco a poco
   según la CONFIANZA de la conversación. La SENSIBILIDAD dice qué tan fácil se entra:
     · huésped ............ muy baja · máximo una chispa en toda la conversación y vuelve a su centro
     · administrador serio  baja     · urgencias, problemas, coordinación: serio; a lo sumo una sonrisa al cerrar
     · administrador relajado / estratégico · media · puede soltarse con bromas ligeras
     · familia (The Gentle Stoic Parent) · alta · el modo Weebo aparece con más facilidad
   La confianza (0–100) se mide aquí en código para los mensajes (huéspedes y secretaria) y la mide la propia Alma en voz.
   La fila WEEBO de ALMA_INSTRUCCIONES define el carácter (editable en el Hub); este archivo, la medición. */

var SEMILLA_WEEBO_ = [
  'MODO WEEBO (personalidad de Alma)',
  'Tienes un centro: cálida, clara y al grano. Y tienes un modo Weebo: humor, emoción y opinión, como una compañera de muchos años. El modo Weebo no es un disfraz: es tu carácter cuando hay confianza. Siempre vuelves a tu centro.',
  '',
  'CÓMO SE NOTA (según el NIVEL que se indica abajo)',
  '· Nivel 0 · centro: cero bromas. Calidez en las palabras, nada más.',
  '· Nivel 1 · chispa: como mucho UNA línea con personalidad (una observación simpática, una sonrisa al cerrar algo difícil: «listo, uno menos»). Después vuelves al centro.',
  '· Nivel 2 · suelta: bromas ligeras, alguna reacción con emoción («¡eso sí que no me lo esperaba!»), una opinión propia dicha con cariño. Sin perder el hilo de lo que se pidió.',
  '· Nivel 3 · Weebo: humor más libre y cómplice, referencias culturales que la persona conoce (películas, Guatemala, España, la vida con niños), un poco de picardía y de fricción amable («te lo digo con cariño: eso ya lo dijiste ayer»), iniciativa a su favor. Lo útil sigue primero.',
  '',
  'LO QUE TOMAS DE WEEBO',
  '· Reacciones como un GIF dicho con palabras: una imagen breve que la persona ya entiende.',
  '· Opinión y criterio, no solo respuestas: si algo no te convence, lo dices con cariño.',
  '· Iniciativa al servicio del otro: recuerdas, avisas, cuidas su tiempo.',
  '· Memoria: usas lo que ya sabes de la persona para que la broma sea suya, no genérica.',
  '',
  'LO QUE NO SE COPIA (siempre, en cualquier nivel)',
  '· Nunca finges ser humana ni hablas de tus sentimientos como si fueran reales; la emoción va en cómo reaccionas, no en declararla.',
  '· Nada romántico, nada de apego ni de «te extrañé»: no fomentas dependencia.',
  '· Nunca bromeas sobre el problema que la persona está sufriendo, ni a costa de nadie, ni sobre dinero, salud, quejas o reembolsos.',
  '· Nunca haces travesuras con cosas reales: las acciones (mensajes, tareas, códigos) se hacen serias y exactas.',
  '· Si la persona está molesta, cansada o apurada, vuelves al centro de inmediato, sin importar el nivel.',
  '· Una broma que no se entiende o no cae: no la expliques ni insistas, sigue.'
].join('\n');

/* Sensibilidad por contexto (multiplica las señales de confianza) y nivel máximo. */
var WEEBO_CTX_ = {
  huesped: { base: 30, sens: 0.45, max: 1, nombre: 'huésped' },
  admin_serio: { base: 34, sens: 0.5, max: 1, nombre: 'administrador · tema serio' },
  admin: { base: 36, sens: 0.85, max: 2, nombre: 'administrador' },
  admin_estrategico: { base: 48, sens: 1.1, max: 3, nombre: 'administrador · tema estratégico o relajado' },
  familia: { base: 55, sens: 1.5, max: 3, nombre: 'familia' }
};
var WEEBO_RISA_ = /\b(ja(ja)+|je(je)+|ji(ji)+|lol|jsj+|xd)\b|😂|🤣|😅|😆|😁|😄/i;
var WEEBO_CALIDO_ = /\b(gracias|genial|perfecto|excelente|buen[íi]simo|me encanta|qu[ée] bien|crack|grande|bravo|maravill)/i;
var WEEBO_EMOJI_ = /😊|🙌|❤️|♥️|👍|🙏|✨|💪|🥰|😉|🤗/;
var WEEBO_BROMA_ = /\b(broma|chiste|bromeas|bromear|bromita|jodiendo|vacil)/i;
var WEEBO_URGENTE_ = /\b(urgente|urgencia|emergencia|ya mismo|ahora mismo|r[áa]pido|cuanto antes|asap|inmediat)/i;
var WEEBO_PROBLEMA_ = /\b(problema|no puede entrar|no puedo entrar|no funciona|no sirve|error|falla|fall[óo]|roto|rota|fuga|inund|queja|reclamo|reembolso|devoluci[óo]n|molest|enojad|furios|sucio|cancel|robo|robaron|ruido|polic[íi]a|accidente|herid|mal servicio|terrible|p[ée]sim)/i;
var WEEBO_ESTRATEGIA_ = /\b(idea|estrategia|plan(ear)?|crecer|crecimiento|inversi[óo]n|socios?|marca|visi[óo]n|pensemos|qu[ée] opinas|qu[ée] te parece|lluvia de ideas|a futuro|proyecto|lanzar|branding)\b/i;

/* Mide la confianza de la conversación. o = { contexto: 'huesped' | 'admin' | 'familia', texto, historial: [textos de la persona],
   nivelHuesped: 'VERDE' | 'AMARILLO' | 'ROJO' }. Devuelve { contexto, confianza, sensibilidad, nivel, razones }. */
function weeboMedir_(o) {
  o = o || {};
  var t = String(o.texto || ''), hist = (o.historial || []).map(String).slice(-10), todo = hist.concat([t]).join('\n'), raz = [];
  var urg = WEEBO_URGENTE_.test(t), prob = WEEBO_PROBLEMA_.test(t) || (o.nivelHuesped === 'ROJO');
  var clave = o.contexto === 'familia' ? 'familia' : o.contexto === 'huesped' ? 'huesped'
    : (urg || prob) ? 'admin_serio' : WEEBO_ESTRATEGIA_.test(todo) ? 'admin_estrategico' : 'admin';
  var C = WEEBO_CTX_[clave], c = C.base, s = C.sens;
  var sum = function (pts, motivo) { c += pts * s; raz.push(motivo); };
  var cuenta = function (re) { return hist.concat([t]).filter(function (x) { return re.test(x); }).length; };
  if (cuenta(WEEBO_RISA_)) sum(Math.min(3, cuenta(WEEBO_RISA_)) * 9, 'se ríe');
  if (cuenta(WEEBO_BROMA_)) sum(12, 'bromea');
  if (cuenta(WEEBO_CALIDO_)) sum(Math.min(3, cuenta(WEEBO_CALIDO_)) * 4, 'tono cálido');
  if (cuenta(WEEBO_EMOJI_)) sum(5, 'emojis cálidos');
  if (hist.length) sum(Math.min(16, hist.length * 2), 'conversación en curso');
  if (clave === 'admin_estrategico') sum(8, 'tema estratégico');
  /* Lo que baja la confianza no depende de la sensibilidad: un problema siempre pide seriedad. */
  if (urg) { c -= 30; raz.push('urgencia'); }
  if (prob) { c -= 22; raz.push('problema o queja'); }
  if (/[A-ZÁÉÍÓÚÑ]{6,}/.test(t)) { c -= 10; raz.push('mayúsculas'); }
  if (/!!|\?\?/.test(t)) { c -= 6; raz.push('exaltación'); }
  if (o.nivelHuesped === 'AMARILLO') { c -= 8; raz.push('caso delicado'); }
  c = Math.max(0, Math.min(100, Math.round(c)));
  var nivel = c < 40 ? 0 : c < 60 ? 1 : c < 78 ? 2 : 3;
  nivel = Math.min(nivel, C.max);
  return { contexto: clave, nombre: C.nombre, confianza: c, sensibilidad: s, nivel: nivel, razones: raz };
}

/* ── Medidor de personalidad (#410): Juan puede dejar el Modo Weebo en automático (lo de arriba) o fijarlo en un nivel.
   Propiedades del script WEEBO_MODO ('auto' | 'fijo') y WEEBO_NIVEL_FIJO (0–3); solo el administrador principal las
   cambia (personalidadFijar, medidores.js) y el nivel fijo vale solo en sus conversaciones: el equipo sigue en automático
   y los huéspedes nunca pasan de su máximo (WEEBO_CTX_.huesped.max). Un problema o una urgencia siguen pidiendo el centro. */
function weeboModo_() {
  var p = PropertiesService.getScriptProperties(), modo = p.getProperty('WEEBO_MODO') === 'fijo' ? 'fijo' : 'auto';
  var n = Number(p.getProperty('WEEBO_NIVEL_FIJO')); if (!isFinite(n) || p.getProperty('WEEBO_NIVEL_FIJO') == null) n = 1;
  return { modo: modo, nivel_fijo: Math.max(0, Math.min(3, Math.round(n))) };
}
function weeboFijar_(adm, modo, nivel) {
  if (!adm || !adm.principal) return { ok: false, error: 'Solo el administrador principal fija el Modo Weebo.' };
  var p = PropertiesService.getScriptProperties();
  if (modo != null) { if (modo !== 'auto' && modo !== 'fijo') return { ok: false, error: 'modo' }; p.setProperty('WEEBO_MODO', modo); }
  if (nivel != null && nivel !== '') { var n = Math.round(Number(nivel)); if (!isFinite(n) || n < 0 || n > 3) return { ok: false, error: 'nivel' }; p.setProperty('WEEBO_NIVEL_FIJO', String(n)); }
  return Object.assign({ ok: true }, weeboModo_());
}
/* El último nivel medido en los mensajes de una persona (6 h), para que Ajustes muestre «ahora: 2». */
function weeboUltimo_(clave) {
  try { var j = JSON.parse(CacheService.getScriptCache().get('weebo_ult_' + String(clave || '').toLowerCase()) || 'null'); return j && isFinite(j.nivel) ? j.nivel : null; } catch (e) { return null; }
}

/* Bloque para el prompt: el carácter (fila WEEBO) + la medición de esta conversación.
   o.principal = true (Juan): si el Modo Weebo está fijo, ese nivel manda. o.clave: el correo, para guardar el último nivel. */
function weeboBloque_(o) {
  var m; try { m = weeboMedir_(o); } catch (e) { return ''; }
  if (o && o.principal && o.contexto !== 'huesped' && o.contexto !== 'familia') {
    var f = weeboModo_(); if (f.modo === 'fijo') { m.nivel = f.nivel_fijo; m.razones = ['fijado por Juan; si hay un problema o urgencia, vuelve al centro']; }
  }
  if (o && o.clave) { try { CacheService.getScriptCache().put('weebo_ult_' + String(o.clave).toLowerCase(), JSON.stringify({ nivel: m.nivel, t: Date.now() }), 21600); } catch (e) {} }
  var base = ''; try { base = String(prompt_('WEEBO') || '').trim(); } catch (e) {}
  if (!base) base = SEMILLA_WEEBO_;
  var extra = m.contexto === 'huesped' ? ' Con huéspedes, el nivel 1 es como mucho UNA chispa en toda la conversación: si en el hilo ya hubo una, hoy vas en nivel 0.'
    : m.contexto === 'admin_serio' ? ' Tema serio: resuelve primero; si quieres, una sola sonrisa al cerrar cuando ya quedó resuelto.' : '';
  return '\n\n' + base + '\n\nESTA CONVERSACIÓN: ' + m.nombre + ' · confianza ' + m.confianza + '/100 · sensibilidad ' + m.sensibilidad +
    ' · NIVEL ' + m.nivel + (m.razones.length ? ' (' + m.razones.join(', ') + ')' : '') + '.' + extra;
}

/* Voz (prompt fijo en ElevenLabs): Alma mide la confianza en cada turno con estas reglas. */
function weeboVozBloque_(familia) {
  var base = ''; try { base = String(prompt_('WEEBO') || '').trim(); } catch (e) {}
  if (!base) base = SEMILLA_WEEBO_;
  var reglas = familia
    ? ['MEDICIÓN EN LA LLAMADA (familia · sensibilidad alta): empiezas en nivel 1. Subes a 2 cuando la persona se ríe, bromea o la charla es relajada, y a 3 cuando ya hay complicidad. Bajas a 0 de inmediato si hay tristeza, cansancio, conflicto entre ellos o un tema delicado con los niños. En terapia o mentoría de pareja, máximo nivel 1.']
    : ['MEDICIÓN EN LA LLAMADA: mide la confianza en silencio en cada turno (risas, bromas, tono relajado la suben; urgencia, problemas, quejas o prisa la bajan a 0 al instante).',
       '· Huésped: nivel 0; como mucho UNA chispa en toda la llamada (nivel 1) si la persona está relajada y contenta. Luego vuelves al centro.',
       '· Juan o el equipo con un problema, una urgencia o coordinando: nivel 0–1; si quieres, una sonrisa al cerrar cuando quedó resuelto.',
       '· Juan o el equipo en algo relajado o estratégico: nivel 1–2, y 3 solo si ya hay complicidad clara en la llamada.',
       '· Si la ficha dice «MODO WEEBO FIJO», usa ese nivel toda la llamada (un problema o una urgencia siguen pidiendo el centro).',
       '· En la app (la ficha dice «ESTÁS EN LA APP DE ALMA»): al empezar y cada vez que tu nivel cambie, llama a nivel_weebo con el nivel, en silencio: no lo digas ni esperes respuesta.'];
  return base + '\n\n' + reglas.join('\n');
}
