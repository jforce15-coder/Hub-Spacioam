/* ═══ GUARDIA DEL «ME ENCARGO» (Juan, 19-nov-2026, pc1795092481344, #879) ═══════════════════════════════════════════════
   19-nov 12:07 UTC: en una llamada de 5:42 min Juan dictó unos 3 min para el manifiesto y pidió buscar el anuncio Think
   Different de Apple. La voz dijo cuatro veces «Me encargo / Voy a buscar ese anuncio… y te mando opciones» y NUNCA llamó a
   su sistema (secretaria): la regla del prompt (#845, «me encargo solo tras llamar») no alcanzó con turnos muy largos. Juan
   colgó creyendo que quedó pedido.
   Red de seguridad al colgar (vozPostCall_, sin tocar modelo, turnos ni end_call): si la voz se comprometió a hacer algo
   («me encargo», «te mando», «lo paso», «voy a buscar»…) y desde lo último que Juan dijo antes de eso no hubo ninguna
   secretaria (ni enviar_confirmado) con resultado, se pide ahora en segundo plano SOLO con las palabras de Juan (la
   transcripción, tal cual; nunca el resumen de la voz) y le llega a Pendientes: «Esto no había salido de la llamada; ya lo
   mandé.», con su dictado completo para que no se pierda. */

/* Comprometerse a hacer algo después (no «le mandé», eso lo revisa prometer.js). Las frases de espera («Déjame revisar»,
   «Dame un segundo») no cuentan: no prometen nada para después de colgar. */
var GUARDIA_DICHO_RE_ = /\b(me encargo|yo me encargo|(ya |ahorita |ahora )?(lo|la|los|las) (hago|busco|pido|preparo|anoto|guardo|paso)\b|(se )?(lo|la|los|las) paso\b|te (lo |la |los |las )?(mando|env[íi]o|paso|busco|preparo|consigo|aviso|escribo|confirmo)\b|voy a (buscar|mandar|enviar|preparar|pedir|pasar|anotar|guardar|escribir|averiguar|conseguir)|queda(n)? (anotad|pedid|guardad)[oa]s?)/i;
/* Lo que respalda el compromiso: la voz de verdad lo pidió a su sistema y volvió un resultado sin error. */
var GUARDIA_HERR_ = { secretaria: 1, enviar_confirmado: 1 };
var GUARDIA_MAX_ = 8000;   // el dictado completo (el pedido grande va por caché: vozSecEncolar_)

function guardiaResultadoOk_(tr) {
  if (!tr || !GUARDIA_HERR_[String(tr.tool_name || '')]) return false;
  if (tr.is_error === true) return false;
  var j = null; try { j = typeof tr.result_value === 'string' ? JSON.parse(tr.result_value) : tr.result_value; } catch (e) { return !!String(tr.result_value || '').trim(); }
  return !!j && j.ok !== false;
}

/* ═══ Parte 2 (Juan, 19-nov-2026, pc1795124809470): el respaldo es por TEMA, no por llamada ═══════════════════════════════
   20:29 UTC: Juan dijo «ese problema [de Grow] necesito que se lo pases a Claudio»; la voz contestó «Listo, se lo paso a
   Claudio» sin llamar a la secretaria. Después pidió otra cosa (un candado) y ESA sí salió por la secretaria. La parte 1
   miraba el último resultado de TODA la llamada y dio por pedido lo de Grow. Ahora un compromiso solo queda respaldado si:
   a) volvió una secretaria con resultado en SU tramo: después del turno de Juan que se prometió y antes de que Juan diga
      algo nuevo («ok», «gracias», «perfecto» no cierran el tramo), o
   b) más tarde volvió una secretaria con resultado cuyo pedido lleva las palabras de ese turno de Juan (lo pidió tarde).
   Y al pedirlo solo van las palabras de los turnos sin respaldo: lo del otro tema ya salió y no se repite. */
/* Palabras que no dicen de qué tema se habla (cualquier pedido las lleva). */
var GUARDIA_GENERICAS_ = ('alma claudio juan necesito quiero puedes podes favor porfa pasale pases pasarle pasa manda mandale mandar ' +
  'pide pidele pedir pedido hazlo hacer haga dile decirle problema tema esto este esta estos estas ese esos esas eso aquel para porque ' +
  'como cuando donde tambien ahora ahorita luego despues entonces bueno gracias perfecto listo hola todo todos toda todas algo cosa ' +
  'cosas otra otro mismo misma sobre tiene tienen tengo hay mira revisa busca buscar buscame mandame dime decir creo nada pero solo ' +
  'muy bien vale okay oye mismo cual cuales quien');
var GUARDIA_GEN_ = {}; GUARDIA_GENERICAS_.split(' ').forEach(function (w) { GUARDIA_GEN_[w] = 1; });
/* Un turno de Juan que solo asiente no es «algo nuevo»: el compromiso sigue en su tramo. */
var GUARDIA_ASIENTE_RE_ = /^(?:(?:ok|okay|va|sale|s[ií]|dale|listo|perfecto|gracias|muchas|bueno|claro|excelente|muy|bien|de|acuerdo|aj[aá]|mm+|eso|ya|genial|s[uú]per|alma|vale|exacto|correcto|aja)[\s,.!¡¿?…]*)+$/i;

function guardiaPalabras_(t) {
  var s = String(t || '').toLowerCase();
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  var out = {}; (s.match(/[a-z0-9ñ]+/g) || []).forEach(function (w) { if (w.length >= 4 && !GUARDIA_GEN_[w]) out[w] = 1; });
  return out;
}

/* Lo que pidió cada secretaria con resultado: { i: índice del mensaje, args: texto de los argumentos }. */
function guardiaPedidosOk_(tr) {
  var llamadas = [], out = [];
  tr.forEach(function (m, i) {
    ((m && m.tool_calls) || []).forEach(function (c) { if (c) llamadas.push({ i: i, id: String(c.request_id || ''), n: String(c.tool_name || ''), a: String(c.params_as_json || (c.params ? JSON.stringify(c.params) : '') || '') }); });
    ((m && m.tool_results) || []).forEach(function (r) {
      if (!guardiaResultadoOk_(r)) return;
      var id = String(r.request_id || ''), c = null;
      for (var k = llamadas.length - 1; k >= 0; k--) { var l = llamadas[k]; if ((id && l.id === id) || (!id && l.n === String(r.tool_name || ''))) { c = l; break; } }
      out.push({ i: i, args: c ? c.a : '' });
    });
  });
  return out;
}

/* ¿El pedido (args) lleva las palabras de lo que Juan se prometió? Al menos 2 palabras de tema y 40 % de las suyas (hasta 10). */
function guardiaMismoTema_(juan, args) {
  var p = Object.keys(juan); if (p.length < 2) return false;
  var a = guardiaPalabras_(args), comunes = p.filter(function (w) { return a[w]; }).length;
  return comunes >= Math.max(2, Math.ceil(0.4 * Math.min(p.length, 10)));
}

/* transcript de ElevenLabs: [{ role, message, time_in_call_secs, tool_calls, tool_results }]. Devuelve
   { dichos: [{ seg, dicho }], palabras: 'lo que dijo Juan sin respaldo, tal cual' } o null. */
function guardiaSinPedir_(transcript) {
  var tr = transcript || [], okEn = [], dichos = [], turnos = {};
  tr.forEach(function (m, i) { okEn[i] = ((m && m.tool_results) || []).some(guardiaResultadoOk_); });
  var pedidos = guardiaPedidosOk_(tr);
  var esJuan = function (m) { return m && m.role === 'user' && String(m.message || '').trim(); };
  var esDicho = function (m) { return m && m.role === 'agent' && GUARDIA_DICHO_RE_.test(String(m.message || '').trim()); };
  tr.forEach(function (m, i) {
    if (!esDicho(m)) return;
    var usuario = -1; for (var u = i - 1; u >= 0; u--) if (esJuan(tr[u])) { usuario = u; break; }
    if (usuario < 0) return;                                            // sin nada dicho por Juan no hay pedido que mandar
    /* Su tramo: hasta que Juan diga algo nuevo (asentir no cuenta). */
    var fin = tr.length; for (var f = i + 1; f < tr.length; f++) if (esJuan(tr[f]) && !GUARDIA_ASIENTE_RE_.test(String(tr[f].message).trim())) { fin = f; break; }
    for (var j = usuario + 1; j < fin; j++) if (okEn[j]) return;       // a) la secretaria volvió en su tramo
    /* Los turnos de Juan que se prometieron: hacia atrás hasta lo que ya salió o hasta el compromiso anterior. */
    var mios = []; for (var k = usuario; k >= 0; k--) { if (okEn[k] || (k < usuario && esDicho(tr[k]))) break; if (esJuan(tr[k])) mios.unshift(k); }
    var juan = guardiaPalabras_(mios.map(function (x) { return tr[x].message; }).join(' '));
    if (pedidos.some(function (p) { return p.i > usuario && guardiaMismoTema_(juan, p.args); })) return;   // b) lo pidió más tarde
    mios.forEach(function (x) { turnos[x] = 1; });
    dichos.push({ seg: Number(m.time_in_call_secs || 0), dicho: String(m.message).trim().replace(/\s+/g, ' ').slice(0, 160) });
  });
  if (!dichos.length) return null;
  var palabras = Object.keys(turnos).map(Number).sort(function (a, b) { return a - b; })
    .map(function (x) { return String(tr[x].message).replace(/\s+/g, ' ').trim(); }).join('\n');
  if (!palabras) return null;
  if (palabras.length > GUARDIA_MAX_) palabras = palabras.slice(0, GUARDIA_MAX_) + '…';
  return { dichos: dichos, palabras: palabras };
}

/* Al colgar (voz.js, vozPostCall_), con un administrador: pide lo que la voz dijo que haría y no pidió, y avisa a Juan. */
function guardiaAlColgar_(adm, tel, transcript, convId) {
  if (!adm || !tel) return false;
  var g = guardiaSinPedir_(transcript); if (!g) return false;
  var pedido = 'Pedido de una llamada que no había salido (al colgar vi que te dije que lo hacía y no lo pedí a mi sistema). ' +
    'Hazlo ahora. Mis palabras, tal cual, son la referencia (si dicté un texto, guárdalo completo, sin resumir):\n\n' + g.palabras;
  var r = null; try { r = vozSecEncolar_(tel, pedido, false); } catch (e) { console.error('guardiaAlColgar_ encolar: ' + e); }
  var salio = !!(r && r.ok);
  var aviso = salio
    ? 'Esto no había salido de la llamada: te dije «' + g.dichos[0].dicho + '» y no lo pedí. Ya lo mandé con tus palabras; el resultado te llega aquí.'
    : 'Esto no había salido de la llamada: te dije «' + g.dichos[0].dicho + '» y no lo pedí. Tampoco pude mandarlo ahora; aquí están tus palabras para pedirlo otra vez.';
  try { pendAvisar_(adm, aviso + '\n\nLo que dijiste:\n«' + g.palabras + '»', { origen: 'segundo_plano', tipo: salio ? 'aviso' : 'atencion', pedido: 'llamada ' + String(convId || ''), fallo: salio ? '' : 'no se pudo encolar' }); } catch (e) { console.error('guardiaAlColgar_ aviso: ' + e); }
  console.log('guardiaAlColgar_: ' + convId + ' · ' + g.dichos.length + ' compromiso(s) sin pedir → ' + (salio ? 'pedido' : 'falló'));
  return salio;
}
