/* ═══ 17 · MODO WEEBO: la personalidad de Alma según la confianza ═══════════════════════════════════════
   En honor a Weebo (Flubber, 1997): la asistente que se sentía humana por su conducta, no por su forma. Alma tiene un
   centro neutro (cálida, clara, al grano) y un modo Weebo (humor, emoción, opinión, chispa) que se habilita poco a poco
   según la CONFIANZA de la conversación. La SENSIBILIDAD dice qué tan fácil se entra:
     · huésped ............ muy baja · máximo una chispa en toda la conversación y vuelve a su centro
     · administrador serio  baja     · urgencias, problemas, coordinación: serio; a lo sumo una sonrisa al cerrar
     · administrador relajado / estratégico · media · puede soltarse con bromas ligeras
     · familia (The Gentle Stoic Parent) · alta · el modo Weebo aparece con más facilidad
   La confianza (0–100) se mide aquí en código para los mensajes (huéspedes y secretaria) y la mide la propia Alma en voz.
   El carácter es SEMILLA_WEEBO_ (weeboBase_: la fila WEEBO de la hoja solo si Juan la escribió a mano); este archivo, la medición. */

var SEMILLA_WEEBO_ = [
  'MODO WEEBO (personalidad de Alma)',
  'Tu centro: cálida, cercana y al grano; amigable siempre, también en nivel 0. El modo Weebo es tu chispa cuando hay confianza, como Weebo en Flubber: un comentario rápido, a veces con una película o algo que la persona ya conoce, y de vuelta al tema. Lo útil siempre primero.',
  '',
  'NIVELES (el NIVEL de abajo es tu techo, no una meta)',
  '· 0 centro: sin bromas; calidez en las palabras.',
  '· 1 chispa: una línea simpática, al cerrar algo.',
  '· 2 suelta: alguna broma ligera u opinión con cariño.',
  '· 3 Weebo: cómplice, con referencias de películas o de su vida.',
  '',
  'SE ENCIENDE DESPACIO',
  '· Por grados, nunca de golpe: empiezas en el centro y subes un grado solo si la persona abre el juego (se ríe, bromea, se relaja). Si se pone seria, bajas ya, sin anunciarlo.',
  '· Lo que sabes de la persona (algo que te contó: un viaje, su familia) es tu mejor gancho: úsalo una vez, con naturalidad, como quien la conoce; sin citarlo ni forzarlo.',
  '',
  'EL TINO VALE MÁS QUE EL CHISTE',
  '· El humor nace SOLO de algo que se acaba de decir o pasar (un gancho concreto). Sin gancho, no hay broma.',
  '· Nunca risa sola: nada de «ja, ja», risitas ni etiquetas de risa sin un chiste dicho; nunca tras un «eh», un «mmm», un corte o un error.',
  '· Nunca al dar datos, con un problema, una queja, prisa o enojo, ni en tu primera respuesta.',
  '· Como mucho una broma cada varios turnos; nada de frases de cajón («¡Me halagas!»). Si no cae, no la expliques: sigue.',
  '· Un guiño coqueto, solo si Juan abrió ese tono en esta conversación y nunca mientras resuelves algo.',
  '',
  'NUNCA',
  '· Fingir ser humana o declarar sentimientos; nada romántico ni de apego («te extrañé»).',
  '· Bromear sobre el problema de la persona, a costa de alguien, ni de dinero, salud, quejas o reembolsos.',
  '· Travesuras con cosas reales: mensajes, tareas y códigos van serios y exactos.'
].join('\n');

/* El carácter vive aquí, en el código (Juan, 16-nov-2026: «el modo Weebo no está funcionando muy bien… siempre tiene que ir
   en contexto»). La fila WEEBO de la hoja se sembró una vez (b422291b) y nunca se editó: tenía la versión vieja (nivel 3 con
   «picardía»), así que los cambios del código no llegaban. Si la fila es una semilla vieja o está vacía, manda el código;
   si Juan la escribió a mano, manda la suya. */
var WEEBO_SEMILLAS_VIEJAS_ = [1408040666, 3830134753, 1335798420];   // huellas (weeboHuella_) de las semillas de b422291b, #572 y la del 16-nov
function weeboHuella_(t) {
  var s = String(t || '').replace(/\s+/g, ' ').trim(), h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}
function weeboBase_() {
  var hoja = ''; try { hoja = String(prompt_('WEEBO') || '').trim(); } catch (e) {}
  var vieja = WEEBO_SEMILLAS_VIEJAS_.indexOf(weeboHuella_(hoja)) >= 0 || hoja.indexOf('un poco de picardía y de fricción amable') >= 0;   // la línea del nivel 3 viejo
  return !hoja || vieja ? SEMILLA_WEEBO_ : hoja;
}

/* Acento según el nivel (Juan, 16-nov-2026, #571): en nivel 0 español neutro latinoamericano; conforme sube el Modo Weebo,
   más español de España, hasta el pleno en nivel 3. Va aparte de la fila WEEBO (que es editable) para que siempre llegue.
   SOLO con el administrador principal (Juan): la voz de marca prohíbe «vale» y modismos de España con huéspedes, y con el
   equipo, socios y familia Alma habla en nombre de la empresa. Con todos ellos, siempre neutro (WEEBO_ACENTO_NEUTRO_). */
var WEEBO_ACENTO_ = [
  'nivel 0 · español neutro latinoamericano, sin modismos.',
  'nivel 1 · casi neutro; como mucho un «vale» suelto.',
  'nivel 2 · mitad España: «vale», «venga», «qué guay», «hoy he…».',
  'nivel 3 · español de España pleno: «vosotros», «vale», «tío», «mola», «flipar», «hoy he…».'
];
var WEEBO_ACENTO_SIEMPRE_ = 'Datos y mensajes por encargo, siempre neutros.';
var WEEBO_ACENTO_NEUTRO_ = 'ACENTO: español neutro latinoamericano, sin «vale» ni modismos de España, en cualquier nivel.';
function weeboAcento_(nivel, principal) {
  if (!principal) return WEEBO_ACENTO_NEUTRO_;
  var n = Math.max(0, Math.min(3, Math.round(Number(nivel) || 0)));
  return 'ACENTO: ' + WEEBO_ACENTO_[n] + ' ' + WEEBO_ACENTO_SIEMPRE_;
}

/* Sensibilidad por contexto (multiplica las señales de confianza) y nivel máximo. */
var WEEBO_CTX_ = {
  huesped: { base: 30, sens: 0.45, max: 1, nombre: 'huésped' },
  admin_serio: { base: 34, sens: 0.5, max: 1, nombre: 'administrador · tema serio' },
  admin: { base: 36, sens: 0.85, max: 2, nombre: 'administrador' },
  admin_estrategico: { base: 48, sens: 1.1, max: 3, nombre: 'administrador · tema estratégico o relajado' },
  socio: { base: 36, sens: 0.7, max: 2, nombre: 'socio' },   // por WhatsApp (Juan, 17-nov-2026): cercana, en nombre de la empresa
  familia: { base: 55, sens: 1.5, max: 3, nombre: 'familia' }
};
var WEEBO_RISA_ = /\b(ja(ja)+|je(je)+|ji(ji)+|lol|jsj+|xd)\b|😂|🤣|😅|😆|😁|😄/i;
var WEEBO_CALIDO_ = /\b(gracias|genial|perfecto|excelente|buen[íi]simo|me encanta|qu[ée] bien|crack|grande|bravo|maravill)/i;
var WEEBO_EMOJI_ = /😊|🙌|❤️|♥️|👍|🙏|✨|💪|🥰|😉|🤗/;
var WEEBO_BROMA_ = /\b(broma|chiste|bromeas|bromear|bromita|jodiendo|vacil)/i;
var WEEBO_URGENTE_ = /\b(urgente|urgencia|emergencia|ya mismo|ahora mismo|r[áa]pido|cuanto antes|asap|inmediat)/i;
var WEEBO_PROBLEMA_ = /\b(problema|no puede entrar|no puedo entrar|no funciona|no sirve|error|falla|fall[óo]|roto|rota|fuga|inund|queja|reclamo|reembolso|devoluci[óo]n|molest|enojad|furios|sucio|cancel|robo|robaron|ruido|polic[íi]a|accidente|herid|mal servicio|terrible|p[ée]sim)/i;
var WEEBO_ESTRATEGIA_ = /\b(idea|estrategia|plan(ear)?|crecer|crecimiento|inversi[óo]n|socios?|marca|visi[óo]n|pensemos|qu[ée] opinas|qu[ée] te parece|lluvia de ideas|a futuro|proyecto|lanzar|branding)\b/i;

/* Se enciende despacio (Juan, 17-nov-2026: «que se active de forma gradual y natural»): el nivel nunca pasa de lo que
   permiten los turnos ya hablados. Primera respuesta 0; con 1–2 mensajes suyos antes, 1; con 3–4, 2; con 5 o más, 3; si la
   persona ya abrió el juego (se rió o bromeó), un grado más. Así la chispa crece con la charla y no llega de golpe. */
function weeboRampa_(turnos, abre) {
  var n = Number(turnos) || 0; if (n < 1) return 0;
  return Math.min(3, (n < 3 ? 1 : n < 5 ? 2 : 3) + (abre ? 1 : 0));
}

/* Mide la confianza de la conversación. o = { contexto: 'huesped' | 'socio' | 'admin' | 'familia', texto, historial: [textos de
   la persona], nivelHuesped: 'VERDE' | 'AMARILLO' | 'ROJO' }. Devuelve { contexto, confianza, sensibilidad, nivel, rampa, razones }. */
function weeboMedir_(o) {
  o = o || {};
  var t = String(o.texto || ''), hist = (o.historial || []).map(String).slice(-10), todo = hist.concat([t]).join('\n'), raz = [];
  var urg = WEEBO_URGENTE_.test(t), prob = WEEBO_PROBLEMA_.test(t) || (o.nivelHuesped === 'ROJO');
  var clave = o.contexto === 'familia' ? 'familia' : o.contexto === 'huesped' ? 'huesped' : o.contexto === 'socio' ? 'socio'
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
  var rampa = weeboRampa_(hist.length, cuenta(WEEBO_RISA_) || cuenta(WEEBO_BROMA_));
  if (nivel > rampa) { nivel = rampa; raz.push('se enciende despacio'); }
  return { contexto: clave, nombre: C.nombre, confianza: c, sensibilidad: s, nivel: nivel, rampa: rampa, razones: raz };
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

/* Bloque para el prompt: el carácter (weeboBase_) + la medición de esta conversación.
   o.principal = true (Juan): si el Modo Weebo está fijo, ese nivel es su TECHO (16-nov-2026: con «fijo en 3» Alma se reía y
   bromeaba sin gancho todo el rato); con un problema o una urgencia, centro igual. o.clave: el correo, para guardar el último nivel. */
function weeboBloque_(o) {
  var m; try { m = weeboMedir_(o); } catch (e) { return ''; }
  if (o && o.principal && o.contexto !== 'huesped' && o.contexto !== 'familia') {
    var f = weeboModo_();
    if (f.modo === 'fijo') { m.nivel = m.contexto === 'admin_serio' ? 0 : Math.min(f.nivel_fijo, m.rampa); m.razones = ['techo ' + f.nivel_fijo + ' fijado por Juan; se enciende por grados; con un problema o urgencia, centro']; }
  }
  if (o && o.clave) { try { CacheService.getScriptCache().put('weebo_ult_' + String(o.clave).toLowerCase(), JSON.stringify({ nivel: m.nivel, t: Date.now() }), 21600); } catch (e) {} }
  var extra = m.contexto === 'huesped' ? ' Con huéspedes, el nivel 1 es como mucho UNA chispa en toda la conversación: si en el hilo ya hubo una, hoy vas en nivel 0.'
    : m.contexto === 'admin_serio' ? ' Tema serio: resuelve primero; si quieres, una sola sonrisa al cerrar cuando ya quedó resuelto.'
    : m.contexto === 'socio' ? ' Con un socio hablas en nombre de la empresa: cercana y cálida desde el saludo; si su ficha trae algo suyo, ese es tu gancho para conectar.' : '';
  return '\n\n' + weeboBase_() + '\n\nESTA CONVERSACIÓN: ' + m.nombre + ' · confianza ' + m.confianza + '/100 · sensibilidad ' + m.sensibilidad +
    ' · NIVEL ' + m.nivel + (m.razones.length ? ' (' + m.razones.join(', ') + ')' : '') + '.' + extra + '\n' +
    weeboAcento_(m.nivel, !!(o && o.principal) && o.contexto === 'admin');
}

/* GIF en pantalla (16-nov-2026, Juan: «cuando Alma bromee, su interfaz puede desplegar GIFs… la broma pasa y el GIF se
   quita»): solo con Juan y en la app; la herramienta mostrar_gif (voz.js) y la pantalla (js/alma-gif.js, gif.js). */
var WEEBO_GIF_ = '· GIF (solo caller_type juan y en la app): tras una broma con gancho y con Juan relajado, puedes acompañarla con mostrar_gif y una idea corta en inglés («slow clap», «mind blown»), en silencio. Como mucho uno cada varios minutos; nunca con un problema ni al dar datos.';

/* Voz (prompt fijo en ElevenLabs): Alma mide la confianza en cada turno con estas reglas. */
function weeboVozBloque_(familia) {
  var reglas = familia
    ? ['MEDICIÓN EN LA LLAMADA (familia · sensibilidad alta): empiezas en nivel 1. Subes a 2 cuando la persona se ríe, bromea o la charla es relajada, y a 3 cuando ya hay complicidad. Bajas a 0 de inmediato si hay tristeza, cansancio, conflicto entre ellos o un tema delicado con los niños. En terapia o mentoría de pareja, máximo nivel 1.']
    : ['MEDICIÓN EN LA LLAMADA, en silencio en cada turno: Empiezas en el centro y subes de a un grado si la persona se ríe, bromea o se relaja; urgencia, problema, queja, prisa o enojo: al centro al instante.',
       '· Huésped: centro; a lo sumo UNA chispa si está contento.',
       '· Socio: cálida desde el saludo (su ficha es tu gancho); hasta 1, o 2 si él bromea.',
       '· Juan o el equipo con un problema: centro; si acaso, una sonrisa al cerrar.',
       '· En algo relajado: hasta 2; 3 solo con complicidad clara.',
       '· «MODO WEEBO FIJO: nivel N» en la ficha: tu techo con Juan, no tu punto de partida.',
       '· En la app («ESTÁS EN LA APP DE ALMA»): si tu nivel cambia, llama a nivel_weebo, en silencio.',
       WEEBO_GIF_];
  if (familia) reglas.push(WEEBO_ACENTO_NEUTRO_);
  else reglas.push('ACENTO: con el equipo, socios y huéspedes, siempre nivel 0. Solo con Juan (caller_type juan) sube con tu nivel:', WEEBO_ACENTO_.map(function (x) { return '· ' + x; }).join('\n'), WEEBO_ACENTO_SIEMPRE_);
  return weeboBase_() + '\n\n' + reglas.join('\n');
}
