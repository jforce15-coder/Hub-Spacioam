/* Alma no repite frases (Juan, 14-nov-2026, pedido pc1794698090317): «evitar que Alma repita frases idénticas seguidas o
   caiga en bucles repetitivos (como "Listo, entregado"); siempre debe variar el fraseo».
   La regla «varia» de playbooks/alma.json se lo pide al modelo; esto es la red de seguridad en el código, porque muchas
   respuestas son frases fijas del sistema («Listo, quedó pedido.», «Listo.»). Antes de guardar y enviar la respuesta al
   administrador se mira cómo empezaron las últimas respuestas de Alma (6 h): si esta empieza con la misma muletilla
   («Listo», «Hecho», «Perfecto»…) o es idéntica a una reciente, se cambia el arranque. El resto del texto no se toca. */
var VARIAR_HECHO_ = ['listo', 'hecho', 'ya esta', 'ya quedo', 'perfecto', 'entregado', 'enviado', 'anotado', 'ok', 'okey', 'de acuerdo'];
var VARIAR_ENTIENDO_ = ['entendido', 'claro', 'claro que si', 'entiendo', 'con gusto'];
var VARIAR_OTROS_HECHO_ = ['', 'Hecho', 'Ya está'];            // '' = sin muletilla: el resultado directo
var VARIAR_OTROS_ENTIENDO_ = [''];   // «Claro, …» repetido: mejor ir directo («Entendido, mañana llega…» suena raro)
var VARIAR_SOLOS_HECHO_ = ['Hecho.', 'Ya está.', 'Quedó hecho.', 'Listo.'];
var VARIAR_SOLOS_ENTIENDO_ = ['Entendido.', 'Claro.', 'De acuerdo.'];

function variarNorm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/* El arranque de un texto: la primera frase corta antes de «,», «.», «:», «!» o «;» (hasta 3 palabras). */
function variarArranque_(t) {
  var m = /^\s*¡?([^,.:;!?¡\n]{1,22}?)\s*!?\s*[,.:;!]\s*/.exec(String(t || '')) || /^\s*¡?([^,.:;!?¡\n]{1,22}?)\s*!?\s*$/.exec(String(t || ''));
  if (!m) return null;
  var n = variarNorm_(m[1]); if (!n || n.split(' ').length > 3) return null;
  var tipo = VARIAR_HECHO_.indexOf(n) >= 0 ? 'hecho' : VARIAR_ENTIENDO_.indexOf(n) >= 0 ? 'entiendo' : '';
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
  if (!igual && usados[usados.length - 1] !== a.norm) return t;   // no repite: se queda como está
  var resto = a.resto.trim(), vistos = prev.map(variarNorm_);
  var ops = resto ? (a.tipo === 'hecho' ? VARIAR_OTROS_HECHO_ : VARIAR_OTROS_ENTIENDO_) : (a.tipo === 'hecho' ? VARIAR_SOLOS_HECHO_ : VARIAR_SOLOS_ENTIENDO_);
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
