/* ═══ ALMA ABRE LA CONVERSACIÓN (#509 T4, Juan 13-nov-2026) ══════════════════════════════════════════════════════
   Cuando uno de los pedidos recientes de Juan tiene un resultado, Alma no solo dice la frase grabada: abre ella misma la
   conversación de ElevenLabs con esa frase como primer mensaje y la plática sigue si Juan contesta. Cuesta (una
   conversación de Alma sale en promedio ~US$0,37), por eso solo cuando se cumplen las reglas de Juan, decididas aquí en
   un solo lugar (abreCalifica_), cada una con su motivo para el diagnóstico (`abre_por`):
     1. es del administrador principal;
     2. es un RESULTADO: terminó, necesita unir o necesita una acción de Juan (ABRE_RESULTADO_ por tipo de aviso, o lo que
        terminó en segundo plano); nunca cuando un proceso empieza;
     3. es de uno de sus ABRE_RECIENTES_ pedidos más recientes de la fila: los de segundo plano (orbitaEmpieza_) y los de
        desarrollo (paraClaudeCrear_, también lo que Alma escala). Cada aviso lleva los pedidos de los que es resultado
        (`pedidos`); los viejos de la fila (el 10, el 11…) no abren.
   El dónde lo sabe la app (Modo calle o conferencia; en una llamada espera a que termine): solo entonces manda
   `abre: true` a vozAvisos, y solo entonces se marca. Nunca dos veces el mismo aviso (lista de abiertos), uno por vuelta,
   nada de hace más de ABRE_VENCE_MS_ y ABRE_TOPE_DIA_ en 24 h como mucho; ALMA_ABRE_APAGADO = 1 lo apaga. Lo que no
   califica sigue como la notificación hablada de siempre (con la voz preparada de #512).
   A la app va { primer_mensaje, contexto }: la frase hablada (avisoHablarDe_, que sale de avisotexto.js) y un JSON corto
   con el pedido, el resultado y qué falta, para que Alma siga la conversación; sin teléfonos, correos, códigos ni enlaces.
   Estado en la Propiedad ALMA_ABRE: { p: { correo: [ids de pedidos, el más nuevo al final] }, a: [avisos abiertos],
   h: [cuándo se abrió cada uno, últimas 24 h] }. Check con dobles: .github/alma-abre.js. */

var ABRE_RECIENTES_ = 4;
var ABRE_TOPE_DIA_ = 8;                 // conversaciones que Alma abre en 24 h como mucho (~US$0,37 cada una)
var ABRE_VENCE_MS_ = 30 * 60000;        // un aviso de hace más de 30 min ya no abre: va como notificación hablada
var ABRE_ABIERTOS_MAX_ = 40;
/* Tipo de aviso (avisotexto.js) → qué resultado es. Lo que no está aquí (huésped en rojo, vuelos, vigilancias, correos,
   «ya quedó unido» después de que Juan lo unió) no es el resultado de un pedido reciente: no abre. */
var ABRE_RESULTADO_ = { claude_pregunta: 'accion', claude_fallo: 'accion', claude_listo: 'unir', claude_consulta: 'termino',
  escalar_entregado: 'termino', escalar_no_unido: 'accion', escalar_no_publico: 'accion' };
var ABRE_FALTA_ = { accion: 'que Juan responda o decida', unir: 'que Juan lo una (Pendientes, Unir)', termino: 'nada; solo contarle el resultado' };
var ABRE_QUE_ = { accion: 'necesita algo de Juan', unir: 'listo; falta que Juan lo una', termino: 'terminó' };

/* ── El estado (un candado corto: lo de la llamada nunca espera el del script) ── */
function abreLeer_() {
  var s = {}; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('ALMA_ABRE') || '{}') || {}; } catch (e) { s = {}; }
  var corte = Date.now() - 86400000;
  return { p: s.p && typeof s.p === 'object' ? s.p : {}, a: Array.isArray(s.a) ? s.a : [], h: (Array.isArray(s.h) ? s.h : []).filter(function (t) { return Number(t) > corte; }) };
}
function abreCambiar_(fn) {
  var lock = vozColaLock_(); if (!lock.tryLock(3000)) { console.error('almaabre: candado ocupado'); return null; }
  try {
    var s = abreLeer_(), r = fn(s);
    PropertiesService.getScriptProperties().setProperty('ALMA_ABRE', JSON.stringify({ p: s.p, a: s.a.slice(-ABRE_ABIERTOS_MAX_), h: s.h }));
    return r;
  } finally { lock.releaseLock(); }
}

/* ── Un pedido nuevo de Juan entra a la fila: segundo plano (orbitaEmpieza_) o desarrollo (paraClaudeCrear_). Un ajuste
   a un pedido que ya estaba lo vuelve el más reciente. Solo los del principal (son los únicos que pueden abrir). ── */
function abrePedido_(email, id) {
  email = String(email || '').trim().toLowerCase(); id = String(id || '').trim();
  if (!email || !id || !esAdminPrincipal_(adminPorEmail_(email))) return;
  abreCambiar_(function (s) {
    var l = (s.p[email] || []).filter(function (x) { return x !== id; });
    l.push(id); s.p[email] = l.slice(-ABRE_RECIENTES_);
  });
}
/* De qué pedidos es resultado un aviso: los que dice quien lo crea (o.pedidos) o, si no dice, los del segundo plano que
   está corriendo ahora para esa persona (ORBITA_ACTUAL_, orbita.js). */
function abrePedidosDe_(adm, o) {
  var l = (o && Array.isArray(o.pedidos) ? o.pedidos : []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  if (!l.length && typeof ORBITA_ACTUAL_ !== 'undefined' && ORBITA_ACTUAL_ && adm && ORBITA_ACTUAL_.email === adm.email)
    l = (ORBITA_ACTUAL_.ids || []).map(function (x) { return String(x || ''); }).filter(Boolean);
  return l.slice(0, 4);
}

/* ── ¿Es un resultado? 'accion' · 'unir' · 'termino', o '' (no lo es: un inicio, un aviso suelto) ── */
function abreEstado_(a) {
  a = a || {};
  if (ABRE_RESULTADO_[a.tipo]) return ABRE_RESULTADO_[a.tipo];
  if (a.tipo) return '';
  return a.resultado ? (Number(a.nivel) >= 1 && Number(a.nivel) <= 2 ? 'accion' : 'termino') : '';
}
/* ── Las reglas de Juan, en orden. s: el estado (abreLeer_). Devuelve { abre, por, estado? } ── */
function abreCalifica_(adm, a, s) {
  a = a || {};
  if (!adm || !esAdminPrincipal_(adm)) return { abre: false, por: 'no_es_el_principal' };
  var estado = abreEstado_(a); if (!estado) return { abre: false, por: 'no_es_resultado' };
  var ped = (a.pedidos || []).map(String); if (!ped.length) return { abre: false, por: 'sin_pedido' };
  var mios = s.p[String(adm.email || '').toLowerCase()] || [];
  if (!ped.some(function (x) { return mios.indexOf(x) >= 0; })) return { abre: false, por: 'pedido_viejo' };
  if (s.a.indexOf(String(a.id)) >= 0) return { abre: false, por: 'ya_abierto' };
  if (Number(a.ts) && Date.now() - Number(a.ts) > ABRE_VENCE_MS_) return { abre: false, por: 'ya_paso_tiempo' };
  if (s.h.length >= ABRE_TOPE_DIA_) return { abre: false, por: 'tope_del_dia' };
  return { abre: true, por: 'resultado_reciente', estado: estado };
}
/* ── Lo que va a la app: la frase con la que abre y el contexto para seguir (sin datos sensibles ni enlaces) ── */
function abreLimpio_(t, n) {
  var s = avisoSinDatos_(String(t == null ? '' : t).replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\[\[[\s\S]*?\]\]/g, ' ')).replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}
/* a: el aviso guardado · o: lo que ya va a la app (hablar, titulo, lineas) · estado: abreEstado_. */
function abreDatos_(a, o, estado) {
  var lineas = (o.lineas || a.datos || []).map(function (l) { return abreLimpio_(l, 110); }).filter(Boolean).slice(0, 3);
  var ped = lineas.filter(function (l) { return /^Pedido:/.test(l); })[0];
  var ctx = { alma_abre: {
    que_paso: 'Abriste tú esta conversación para contarle a Juan el resultado de un pedido suyo reciente; tu primer mensaje ya se lo dijo.',
    pedido: ped ? ped.replace(/^Pedido:\s*/, '') : abreLimpio_(o.titulo || a.titulo || '', 80),
    resultado: ABRE_QUE_[estado], que_falta: ABRE_FALTA_[estado], datos: lineas,
    como_seguir: 'No repitas lo que ya le dijiste ni saludes. Si quiere el detalle, búscalo con tus herramientas (está en Pendientes). Si te pide algo sobre esto, hazlo como siempre. Si dice que no o «luego», contesta solo «Claro, queda en Pendientes» y cuelga con end_call; si se queda callado, la app cuelga sola.'
  } };
  return { primer_mensaje: abreLimpio_(o.hablar || a.texto, 400), contexto: 'ALMA ABRE: ' + JSON.stringify(ctx) };
}
/* ── vozAvisos (voz.js): crudos = la cola guardada, salida = lo que va a la app (mismo orden). Solo si la app dice que
   puede abrir (b.abre: Modo calle o conferencia). El más nuevo primero, uno por vuelta. ── */
function abreAvisos_(adm, crudos, salida, b) {
  if (!b || b.abre !== true || !(salida || []).length) return salida;
  if (String(PropertiesService.getScriptProperties().getProperty('ALMA_ABRE_APAGADO') || '') === '1') return salida;
  abreCambiar_(function (s) {
    var una = false;
    for (var i = salida.length - 1; i >= 0; i--) {
      var a = Object.assign({}, crudos[i] || {}, { nivel: salida[i].nivel }), c = abreCalifica_(adm, a, s);
      if (c.abre && una) c = { abre: false, por: 'una_por_vuelta' };
      salida[i].abre_por = c.por;
      if (!c.abre) continue;
      salida[i].abre = abreDatos_(a, salida[i], c.estado);
      s.a.push(String(a.id)); s.h.push(Date.now()); una = true;
    }
  });
  return salida;
}
