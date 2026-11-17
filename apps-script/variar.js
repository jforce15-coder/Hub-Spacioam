/* Alma no repite frases (Juan, 14-nov-2026, pedido pc1794698090317): «evitar que Alma repita frases idénticas seguidas o
   caiga en bucles repetitivos (como "Listo, entregado"); siempre debe variar el fraseo».
   La regla «varia» de playbooks/alma.json se lo pide al modelo; esto es la red de seguridad en el código, porque muchas
   respuestas son frases fijas del sistema («Listo, quedó pedido.», «Listo.»). Antes de guardar y enviar la respuesta al
   administrador se mira cómo empezaron las últimas respuestas de Alma (6 h): si esta empieza con la misma muletilla
   («Listo», «Hecho», «Perfecto»…) o es idéntica a una reciente, se cambia el arranque. El resto del texto no se toca.
   Segunda parte (Juan, 16-nov-2026, pedido pc1794873974792: «me halagas», «vale, lo hago»): «Vale» cuenta como muletilla
   y un halago de cajón («¡Me halagas!») no se repite si ya salió en las últimas respuestas, aunque no fuera la anterior:
   se quita y queda el resto («¡Me halagas! Soy Alma…» → «Soy Alma…»). */
var VARIAR_HECHO_ = ['listo', 'hecho', 'ya esta', 'ya quedo', 'perfecto', 'entregado', 'enviado', 'anotado', 'ok', 'okey', 'de acuerdo'];
var VARIAR_ENTIENDO_ = ['entendido', 'claro', 'claro que si', 'entiendo', 'con gusto', 'vale'];
var VARIAR_HALAGO_ = ['me halagas', 'que halago', 'me sonrojas', 'me haces sonrojar'];
var VARIAR_OTROS_HECHO_ = ['', 'Hecho', 'Ya está'];            // '' = sin muletilla: el resultado directo
var VARIAR_OTROS_ENTIENDO_ = [''];   // «Claro, …» repetido: mejor ir directo («Entendido, mañana llega…» suena raro)
var VARIAR_SOLOS_HECHO_ = ['Hecho.', 'Ya está.', 'Quedó hecho.', 'Listo.'];
var VARIAR_SOLOS_ENTIENDO_ = ['Entendido.', 'Claro.', 'De acuerdo.'];
var VARIAR_OTROS_HALAGO_ = [''];   // el halago ya salió: queda la respuesta sin él
var VARIAR_SOLOS_HALAGO_ = ['Gracias.', 'Qué amable.'];

function variarNorm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/* El arranque de un texto: la primera frase corta antes de «,», «.», «:», «!» o «;» (hasta 3 palabras). */
function variarArranque_(t) {
  var m = /^\s*¡?([^,.:;!?¡\n]{1,22}?)\s*!?\s*[,.:;!]\s*/.exec(String(t || '')) || /^\s*¡?([^,.:;!?¡\n]{1,22}?)\s*!?\s*$/.exec(String(t || ''));
  if (!m) return null;
  var n = variarNorm_(m[1]); if (!n || n.split(' ').length > 3) return null;
  var tipo = VARIAR_HECHO_.indexOf(n) >= 0 ? 'hecho' : VARIAR_ENTIENDO_.indexOf(n) >= 0 ? 'entiendo' : VARIAR_HALAGO_.indexOf(n) >= 0 ? 'halago' : '';
  return { norm: n, tipo: tipo, sep: m[0].replace(/^\s*¡?[^,.:;!?¡\n]*/, '').trim(), resto: String(t).slice(m[0].length) };
}
/* texto: la respuesta nueva. recientes: las respuestas anteriores de Alma, de la más vieja a la más nueva. */
function variarFrase_(texto, recientes) {
  var t = String(texto || ''); if (!t.trim()) return t;
  var prev = (recientes || []).map(String).filter(function (x) { return x.trim(); }).slice(-4);
  if (!prev.length) return t;
  var a = variarArranque_(t); if (!a || !a.tipo) return t;   // solo se cambian muletillas conocidas
  var usados = prev.map(function (p) { var x = variarArranque_(p); return x ? x.norm : ''; });
  var nt = variarNorm_(t), igual = prev.some(function (p) { return variarNorm_(p) === nt; });
  var vistos = prev.map(variarNorm_);
  /* Un halago se cuida más: basta con que haya salido en cualquiera de las últimas respuestas, al inicio o en medio. */
  var halagoVisto = a.tipo === 'halago' && vistos.some(function (p) { return VARIAR_HALAGO_.some(function (h) { return p.indexOf(h) >= 0; }); });
  if (!igual && !halagoVisto && usados[usados.length - 1] !== a.norm) return t;   // no repite: se queda como está
  var resto = a.resto.trim();
  var OTROS = { hecho: VARIAR_OTROS_HECHO_, entiendo: VARIAR_OTROS_ENTIENDO_, halago: VARIAR_OTROS_HALAGO_ };
  var SOLOS = { hecho: VARIAR_SOLOS_HECHO_, entiendo: VARIAR_SOLOS_ENTIENDO_, halago: VARIAR_SOLOS_HALAGO_ };
  var ops = (resto ? OTROS : SOLOS)[a.tipo];
  /* Se rota según cuántas respuestas hubo, para no caer siempre en la misma alternativa. */
  for (var i = 0; i < ops.length; i++) {
    var op = ops[(prev.length + i) % ops.length], cand;
    if (!resto) cand = op;
    else if (!op) cand = resto.charAt(0).toUpperCase() + resto.slice(1);
    else cand = op + (/^[,:;]/.test(a.sep) ? ', ' : '. ') + resto;   // el resto queda tal cual: «Listo, quedó…» → «Hecho, quedó…»; «Listo. Le escribí…» → «Hecho. Le escribí…»
    var ca = variarArranque_(cand), cn = variarNorm_(cand);
    if (ca && usados.indexOf(ca.norm) >= 0) continue;   // tampoco con un arranque que ya usó hace poco
    if (vistos.indexOf(cn) >= 0) continue;
    if (op && variarNorm_(resto).indexOf(variarNorm_(op)) === 0) continue;   // «Ya quedó, quedó pedido» no
    return cand;
  }
  return t;
}
/* Las respuestas de Alma de las últimas 6 h en el chat de un administrador (filas de opFilas_). */
function variarRecientes_(previos) {
  var corte = Date.now() - 6 * 3600000;
  return (previos || []).filter(function (m) { return m && m.de === 'alma' && new Date(m.ts).getTime() >= corte; }).map(function (m) { return m.texto; });
}
