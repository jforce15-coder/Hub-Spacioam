/* Alma no repite frases (Juan, 14-nov-2026, pedido pc1794698090317): «evitar que Alma repita frases idénticas seguidas o
   caiga en bucles repetitivos (como "Listo, entregado"); siempre debe variar el fraseo».
   La regla «varia» de playbooks/alma.json se lo pide al modelo; esto es la red de seguridad en el código, porque muchas
   respuestas son frases fijas del sistema («Listo, quedó pedido.», «Listo.»). Antes de guardar y enviar la respuesta al
   administrador se mira cómo empezaron las últimas respuestas de Alma (6 h): si esta empieza con la misma muletilla
   («Listo», «Hecho», «Perfecto»…) o es idéntica a una reciente, se cambia el arranque. El resto del texto no se toca.
   Segunda parte (Juan, 16-nov-2026, pedido pc1794873974792: «me halagas», «vale, lo hago»): «Vale» cuenta como muletilla
   y un halago de cajón («¡Me halagas!») no se repite si ya salió en las últimas respuestas, aunque no fuera la anterior:
   se quita y queda el resto («¡Me halagas! Soy Alma…» → «Soy Alma…»).
   Tercera parte (Juan, 17-nov-2026, pedido pc1794933663821): «repite "Listo, quedó pedido" hasta ocho veces; con una sola
   vez basta», y lo mismo con Maricarmen. Cambiar la muletilla no alcanzaba: «Hecho, quedó pedido», «Quedó pedido»… seguían
   repitiendo lo mismo. Si en las últimas respuestas ya se confirmó un pedido, la confirmación fija se dice corta y sin
   «quedó pedido» («También quedó.»; «Sumado a «X».»). Lo usan el chat, WhatsApp y la calle (Alma y Maricarmen, que pasan
   por opProcesar_) y Claudio (claudio.js, por conversación). */
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
/* Confirmación de pedido ya dicha: la frase corta que la reemplaza. i rota entre las opciones. */
var VARIAR_PEDIDO_RE_ = /^\s*(?:(?:listo|hecho|ya está|ya quedó)\s*[,.]\s*)?quedó pedido(\s+lo de [^.]+)?\.\s*/i;
var VARIAR_SUMADO_RE_ = /^\s*(?:(?:listo|hecho|ya está)\s*[,.]\s*)?quedó sumado a («[^»]+»)\.\s*/i;
var VARIAR_CORTAS_ = ['También quedó.', 'Anotado también.', 'Ese también.'];
var VARIAR_YA_CONFIRMO_ = ['quedo pedido', 'quedaron pedidos', 'quedo sumado', 'tambien quedo', 'anotado tambien', 'ese tambien'];
function variarEsConfirmacion_(t) { return VARIAR_PEDIDO_RE_.test(String(t || '')) || VARIAR_SUMADO_RE_.test(String(t || '')); }
function variarYaConfirmo_(recientes) {
  return (recientes || []).some(function (p) { var n = variarNorm_(p); return VARIAR_YA_CONFIRMO_.some(function (x) { return n.indexOf(x) >= 0; }); });
}
/* «Listo, quedó pedido.» → «También quedó.» (o la que no se usó hace poco); «…quedó pedido lo de X.» → «También quedó lo de
   X.»; «Listo, quedó sumado a «X».» → «Sumado a «X».». El resto del texto queda. Sin confirmación fija: null. */
function variarConfirmacionCorta_(texto, recientes) {
  var t = String(texto || ''), m = VARIAR_PEDIDO_RE_.exec(t), corta = '';
  var vistos = (recientes || []).map(variarNorm_);
  if (m && m[1]) corta = 'También quedó' + m[1].replace(/\s+/g, ' ') + '.';
  else if (m) {   // la que hace más que no se usa (o nunca), para no decir la misma dos veces seguidas
    var cuando = VARIAR_CORTAS_.map(function (o) { var k = -1; vistos.forEach(function (p, j) { if (p.indexOf(variarNorm_(o)) === 0) k = j; }); return k; });
    corta = VARIAR_CORTAS_[cuando.indexOf(Math.min.apply(null, cuando))];
  } else { m = VARIAR_SUMADO_RE_.exec(t); if (!m) return null; corta = 'Sumado a ' + m[1] + '.'; }
  var resto = t.slice(m[0].length).trim();
  return corta + (resto ? ' ' + resto : '');
}
/* texto: la respuesta nueva. recientes: las respuestas anteriores de Alma, de la más vieja a la más nueva. */
function variarFrase_(texto, recientes) {
  var t = String(texto || ''); if (!t.trim()) return t;
  var prev = (recientes || []).map(String).filter(function (x) { return x.trim(); }).slice(-4);
  if (!prev.length) return t;
  /* Un pedido ya confirmado hace poco: «quedó pedido» no se repite (tercera parte). */
  var prev8 = (recientes || []).map(String).filter(function (x) { return x.trim(); }).slice(-8);
  if (variarEsConfirmacion_(t) && variarYaConfirmo_(prev8)) { var c = variarConfirmacionCorta_(t, prev8); if (c) return c; }
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
