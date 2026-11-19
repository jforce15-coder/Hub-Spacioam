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

/* transcript de ElevenLabs: [{ role, message, time_in_call_secs, tool_calls, tool_results }]. Un compromiso queda
   respaldado si desde lo último que dijo Juan antes de él (o después, en la misma llamada) volvió una secretaria con
   resultado. Devuelve { dichos: [{ seg, dicho }], palabras: 'lo que dijo Juan sin respaldo, tal cual' } o null. */
function guardiaSinPedir_(transcript) {
  var tr = transcript || [], okEn = [], usuario = -1, dichos = [], desde = -1;
  tr.forEach(function (m, i) { okEn[i] = ((m && m.tool_results) || []).some(guardiaResultadoOk_); });
  var ultimoOk = -1; tr.forEach(function (m, i) { if (okEn[i]) ultimoOk = i; });
  tr.forEach(function (m, i) {
    if (!m) return;
    var txt = String(m.message || '').trim();
    if (m.role === 'user' && txt) { usuario = i; return; }
    if (m.role !== 'agent' || !txt || !GUARDIA_DICHO_RE_.test(txt)) return;
    if (ultimoOk >= Math.max(usuario, 0) && ultimoOk >= 0) return;   // hubo una secretaria con resultado desde lo último que dijo Juan
    if (desde < 0) desde = usuario < 0 ? 0 : usuario;
    dichos.push({ seg: Number(m.time_in_call_secs || 0), dicho: txt.replace(/\s+/g, ' ').slice(0, 160) });
  });
  if (!dichos.length) return null;
  /* Las palabras de Juan desde el turno que quedó sin pedir, sin lo que ya respaldó una secretaria antes (eso ya salió). */
  var inicio = desde; for (var k = desde; k >= 0; k--) { if (okEn[k]) break; if (tr[k] && tr[k].role === 'user') inicio = k; }
  var palabras = tr.slice(inicio).filter(function (m) { return m && m.role === 'user' && String(m.message || '').trim(); })
    .map(function (m) { return String(m.message).replace(/\s+/g, ' ').trim(); }).join('\n');
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
