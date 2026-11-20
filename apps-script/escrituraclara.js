/* ═══ ESCRITURA CLARA (Juan, 20-nov-2026: truco 1 del video de Andrej Karpathy, «decide tú» → opción A) ═══════════════
   Lo que Alma ESCRIBE sale al 80 % de ASD-STE100 (el inglés técnico simplificado de los manuales de aviones): frases
   cortas, una idea por frase, voz activa y una palabra = un significado (para Alma, el diccionario es docs/GLOSARIO.md:
   la columna «Evitar» no se usa). Al 100 % suena robótico; al 80 % queda claro y natural.
   Sin agregar texto a los prompts (están en su tope; docs/PIRAMIDE.md): es una revisión EN CÓDIGO, sin IA, antes de salir.
   · ecRevisar_ mide frases largas (más de 25 palabras), voz pasiva y palabras «Evitar» del glosario.
   · Solo si falla de forma clara (EC_PUNTOS_FALLA_ o más) hay UNA reescritura con el modelo básico; se usa solo si
     conserva números, enlaces y nombres, no agrega ninguno y queda mejor medida. Si no, sale el original: mejor no tocar
     que romper un mensaje.
   · Dónde se engancha: opProcesar_ (chat del Hub, chat de la app y WhatsApp del equipo; la calle es voz y no pasa) y la
     respuesta al huésped (la cola, después del control de calidad). La voz y las llamadas nunca pasan por aquí.
   · Tiempo: la revisión tarda milisegundos; la reescritura (1 de cada pocos mensajes) suma ~1-2 s. Al huésped le
     responde la cola en segundo plano (ya tarda varios segundos en redactar y revisar), así que nadie la espera en vivo.
   · ESCRITURA_CLARA = 'no' (Propiedades del script) la apaga; ESCRITURA_CLARA_MODELO cambia el modelo.
   · Cuenta del día en la propiedad ESCRITURA_CLARA_CUENTA (revisados, reescritos, descartados) y en el log; robot
     escritura_clara (estado o prueba con un texto, sin mandar nada). La reescritura va a IA_USO («Escritura clara»).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var EC_LARGA_ = 25;            // palabras: una descripción de ASD-STE100 (las instrucciones, 20)
var EC_MUY_LARGA_ = 40;        // una frase así ya cuesta leerla: pesa doble
var EC_PUNTOS_FALLA_ = 3;      // umbral prudente: una frase larga sola o dos pasivas no tocan el mensaje
var EC_MIN_ = 140, EC_MAX_ = 2500;   // corto: no hay nada que aclarar; muy largo: listas y reportes, mejor no tocar
/* La columna «Evitar» de docs/GLOSARIO.md que puede salir en un mensaje (la prueba exige que sigan en el glosario). Solo
   en español: «staff» o «inbox» son correctos en un mensaje en inglés. */
var EC_EVITAR_ = ['popup', 'sidebar', 'fallback', 'attachment', 'snippet', 'widgets', 'spinner', 'inbox', 'staff', 'webhook',
  'polling', 'sandbox', 'staging', 'to-do', 'deep link', 'burbuja', 'guardrail', 'mergear', 'auto-merge', 'crash log',
  'throttling', 'drill-down', 'modo debug', 'Alma offline', 'Claudio offline', 'voz offline', 'TTS local'];
var EC_PASIVA_ES_ = /\b(es|son|fue|fueron|era|eran|ser[áa]n?|sido|sea|sean)\s+(?!bienvenid)([a-záéíóúñ]+(?:ad|id)[oa]s?|(?:escrit|hech|puest|abiert|cubiert|dich|vist|devuelt|resuelt|rot|enviad)[oa]s?)\b/gi;
var EC_PASIVA_EN_ = /\b(is|are|was|were|been|being|be)\s+([a-z]+ed|done|made|given|taken|sent|paid|seen|known|found|built|held|kept|told)\b/gi;
var EC_PROMPT_ = {
  rol: 'Editor de Escritura clara de Spacio AM.',
  tarea: 'Reescribe el mensaje al 80 % de ASD-STE100, en el mismo idioma.',
  contexto: ['ASD-STE100 al 80 %: frases cortas (20 palabras en instrucciones, 25 en descripciones), una idea por frase, voz activa, sin rodeos; natural, no robótico.'],
  pasos: ['Parte las frases largas.', 'Pasa la voz pasiva a activa.', 'Quita rodeos y palabras de relleno.'],
  restricciones: ['No cambies datos, montos, números, fechas, horas, enlaces, códigos ni nombres: cópialos tal cual.', 'No agregues ni quites información.', 'Mismo tono, mismo trato (tú o usted), mismos emojis y mismos saltos de línea de las listas.', 'No uses: ' + EC_EVITAR_.join(', ') + '.'],
  formato_de_respuesta: 'Solo el mensaje reescrito, sin comillas ni explicación.'
};

function ecProp_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }
function ecActiva_() { return !/^(no|0|false|apagada?)$/i.test(ecProp_('ESCRITURA_CLARA')); }
/* El modelo básico: el más barato que ya usa el Hub (el escalón básico del Modo Creator). */
function ecModelo_() { return ecProp_('ESCRITURA_CLARA_MODELO') || creatorEscalonModelo_(0); }

function ecIdioma_(t) {
  var s = ' ' + String(t || '').toLowerCase() + ' ';
  var es = (s.match(/\s(el|la|los|las|que|de|en|para|con|por|una|está|es|tu|su)\s/g) || []).length;
  var en = (s.match(/\s(the|and|you|your|is|are|to|of|for|with|we|our|will)\s/g) || []).length;
  return en > es ? 'en' : 'es';
}
/* Frases sin enlaces: cada renglón y, dentro, cada punto, signo de pregunta o de exclamación seguido de espacio. */
function ecFrases_(t) {
  return String(t || '').replace(/https?:\/\/\S+/g, ' ENLACE ').split(/\n+/).map(function (l) { return l.replace(/^\s*(?:[·•\-*]|\d+[.)])\s+/, ''); })
    .reduce(function (a, l) { return a.concat(l.split(/(?<=[.!?…])\s+/)); }, [])
    .map(function (f) { return f.trim(); }).filter(function (f) { return /[a-záéíóúñ]/i.test(f); });
}
function ecPalabras_(f) { return (String(f).match(/[0-9a-záéíóúñü]+(?:['’][a-z]+)?/gi) || []).length; }

/* La revisión, sin IA. { frases, largas, muyLargas, pasivas, evitar: [...], puntos, falla, idioma } */
function ecRevisar_(texto) {
  var t = String(texto || ''), idioma = ecIdioma_(t), frases = ecFrases_(t);
  var largas = [], muy = [];
  frases.forEach(function (f) { var n = ecPalabras_(f); if (n > EC_MUY_LARGA_) muy.push(f); else if (n > EC_LARGA_) largas.push(f); });
  var sinEnlaces = t.replace(/https?:\/\/\S+/g, ' ');
  var pasivas = (sinEnlaces.match(idioma === 'en' ? EC_PASIVA_EN_ : EC_PASIVA_ES_) || []).length;
  var evitar = idioma === 'es' ? EC_EVITAR_.filter(function (w) {
    return new RegExp('(^|[^\\wáéíóúñ-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\wáéíóúñ-])', 'i').test(sinEnlaces);
  }) : [];
  var puntos = largas.length + 2 * muy.length + Math.max(0, pasivas - 1) + 2 * evitar.length;
  return { idioma: idioma, frases: frases.length, largas: largas.length, muyLargas: muy.length, pasivas: pasivas, evitar: evitar,
    puntos: puntos, falla: puntos >= EC_PUNTOS_FALLA_ };
}

/* Lo que no se puede perder: números, enlaces y nombres (palabras con mayúscula que no abren la frase). */
function ecDatos_(t) {
  t = String(t || '');
  var enlaces = t.match(/https?:\/\/[^\s)»"']+/g) || [], sin = t.replace(/https?:\/\/\S+/g, ' ');
  var numeros = sin.match(/\d+/g) || [];
  var nombres = [];
  ecFrases_(sin).forEach(function (f) {
    var ws = f.match(/[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]{2,}/g) || [], primera = (f.match(/[A-Za-zÁÉÍÓÚÑáéíóúñü]+/) || [''])[0];
    ws.forEach(function (w) { if (w !== primera && nombres.indexOf(w) < 0) nombres.push(w); });
  });
  return { enlaces: enlaces, numeros: numeros, nombres: nombres };
}
function ecCuenta_(lista) { var o = {}; lista.forEach(function (x) { o[x] = (o[x] || 0) + 1; }); return o; }
/* '' si la reescritura conserva todo; si no, qué perdió o qué inventó. */
function ecConserva_(orig, nuevo) {
  var a = ecDatos_(orig), b = ecDatos_(nuevo), ca, cb, k;
  for (var i = 0; i < a.enlaces.length; i++) if (b.enlaces.indexOf(a.enlaces[i]) < 0) return 'perdió un enlace';
  for (i = 0; i < b.enlaces.length; i++) if (a.enlaces.indexOf(b.enlaces[i]) < 0) return 'agregó un enlace';
  ca = ecCuenta_(a.numeros); cb = ecCuenta_(b.numeros);
  for (k in ca) if ((cb[k] || 0) < ca[k]) return 'perdió el número ' + k;
  for (k in cb) if (!ca[k]) return 'agregó el número ' + k;
  for (i = 0; i < a.nombres.length; i++) if (String(nuevo).indexOf(a.nombres[i]) < 0) return 'perdió el nombre ' + a.nombres[i];
  return '';
}

function ecContar_(campo) {
  try {
    var p = PropertiesService.getScriptProperties(), hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), o = {};
    try { o = JSON.parse(p.getProperty('ESCRITURA_CLARA_CUENTA') || '{}') || {}; } catch (e) {}
    if (o.fecha !== hoy) o = { fecha: hoy, revisados: 0, reescritos: 0, descartados: 0 };
    o[campo] = (o[campo] || 0) + 1; p.setProperty('ESCRITURA_CLARA_CUENTA', JSON.stringify(o));
  } catch (e) {}
}
function ecReescribir_(texto) {
  return String(claude_(ecModelo_(), Math.min(4000, Math.ceil(String(texto).length / 2) + 1500), JSON.stringify(EC_PROMPT_), String(texto), null) || '').trim();
}

/* El punto de salida: devuelve el texto que sale (el mismo o el reescrito). o.canal: 'calle', 'voz' o 'llamada' no pasan;
   o.detalle: { revision, motivo } para quien quiera saber qué pasó (la prueba, el robot). */
function escrituraClara_(texto, o) {
  o = o || {};
  var t = String(texto || ''), det = o.detalle || {};
  if (/^(calle|voz|llamada)$/.test(String(o.canal || ''))) { det.motivo = 'voz: no pasa'; return t; }
  if (!ecActiva_()) { det.motivo = 'apagada (ESCRITURA_CLARA = no)'; return t; }
  if (t.length < EC_MIN_ || t.length > EC_MAX_ || /```|^\s*[{[]/.test(t)) { det.motivo = 'fuera de tamaño o con código'; return t; }
  var contar = o.canal !== 'prueba' ? ecContar_ : function () {};   // la prueba del robot no suma a la cuenta del día
  var rev = ecRevisar_(t); det.revision = rev; contar('revisados');
  if (!rev.falla) { det.motivo = 'clara'; return t; }
  var nuevo = '';
  try { nuevo = ecReescribir_(t); } catch (e) { console.error('escrituraClara_: ' + e); }
  var malo = !nuevo ? 'sin respuesta del modelo' : nuevo.length < t.length * 0.5 || nuevo.length > t.length * 1.3 ? 'cambió demasiado de largo' : ecConserva_(t, nuevo);
  if (!malo && ecRevisar_(nuevo).puntos >= rev.puntos) malo = 'no quedó más clara';
  if (malo) { contar('descartados'); det.motivo = 'descartada: ' + malo; console.log('Escritura clara · descartada (' + malo + ') · ' + (o.canal || '')); return t; }
  contar('reescritos'); det.motivo = 'reescrita'; det.nuevo = nuevo;
  console.log('Escritura clara · reescrito (' + (o.canal || '') + ', ' + rev.puntos + ' puntos)');
  return nuevo;
}

/* Robot escritura_clara: { texto } → la revisión y lo que saldría (no manda nada); sin texto → la cuenta de hoy. */
function escrituraClaraRobot_(body) {
  body = body || {};
  var cuenta = {}; try { cuenta = JSON.parse(ecProp_('ESCRITURA_CLARA_CUENTA') || '{}') || {}; } catch (e) {}
  if (!body.texto) return { ok: true, activa: ecActiva_(), modelo: ecModelo_(), cuenta: cuenta };
  var det = {}, sale = escrituraClara_(String(body.texto).slice(0, 4000), { canal: String(body.canal || 'prueba'), detalle: det });
  return { ok: true, activa: ecActiva_(), revision: det.revision || null, motivo: det.motivo || '', sale: sale, cambio: sale !== String(body.texto) };
}
