/* ═══ ALMA ESCALA SOLA (Juan, 12-nov-2026) ═════════════════════════════════════════════════════════════════════
   Pasó el 11-nov (13:44 en Guatemala): Juan pidió por WhatsApp sus apartamentos como contacto de recepción de Hola
   (principal y secundario). Alma no tenía cómo y preguntó dos veces («¿Te parece que lo haga en segundo plano…?» y
   «necesito pedírselo a Claudio… ¿Lo pido?») con la esfera Propósito · Operación, así que el cierre del turno no pidió
   nada: el pedido salió 44 minutos después, cuando Juan contestó «Si», y salió dos veces (pedir_a_agente desarrollo y el
   cierre del turno: dos sesiones de Claude para lo mismo).
   Lo que hace este archivo:
   · Lo decide el código, no el prompt: si con el administrador principal Alma dice que no puede, promete pedirlo, lo
     ofrece («¿lo pido?») o usa una herramienta que no existe, el pedido a Desarrollo sale EN ESE TURNO, sin preguntarle,
     y la respuesta es una sola frase ya hecha (escalarCerrarTurno_, desde chatTurnoCerrar_ en chat.js).
   · Los pedidos entre agentes van en JSON: rol, tarea, contexto, pasos, restricciones y formato_de_respuesta
     (escalarJson_; los demás agentes, agPedidoJson_ en agentes.js). Es lenguaje interno: a Juan, español simple.
   · Unión sola (Juan, 12-nov-2026): «Alma une sola únicamente cuando el usuario administrador principal hace un pedido y
     es necesaria alguna mejora o cambio para poder entregar el resultado solicitado.» Solo los pedidos que nacen aquí
     guardan su entrega (propiedad ESCALAR_ENTREGAS, con pedido_por y para_entregar). Cuando Claude responde con PR, Alma
     lo une con sus revisiones en verde (unirCambio_), espera que se publique, hace lo que Juan pidió y se lo entrega con
     el enlace (escalarRevisar_, cada 2 min desde procesarCola). Revisiones en rojo, choque o PR cerrado: no une y le
     avisa con el enlace y la causa. Todo lo demás sigue esperando el «une» de Juan (unir.js). */

var ESCALAR_PROP_ = 'ESCALAR_ENTREGAS', ESCALAR_MAX_ = 6, ESCALAR_VIGENCIA_ = 3 * 86400000, ESCALAR_ESPERA_CI_ = 2 * 3600000;
var ESCALAR_FRASE_ = 'Eso todavía no lo puedo hacer yo sola, así que ya quedó pedido; en cuanto esté, te lo entrego aquí con el enlace del cambio.';

/* ── ¿Alma no pudo? Lo que dijo (sin tildes) y las herramientas que no existen. Devuelve el motivo o ''. ──
   Solo frases de capacidad («no tengo la herramienta», «no puedo sacar…»), promesas de pedirlo a Claude, a Desarrollo o a
   un agente (en presente o futuro: «se lo pedí ayer» es un estado, no una promesa) y la pregunta de si lo pide. Un «no se
   lo puedo dar» (seguridad), un «no encontré» (no está) o «el pedido a Claudio sigue en trabajo» no escalan. */
var ESCALAR_A_ = '(?:claude|claudio|desarrollo|equipo tecnico|programador|(?:el |mi |tu |al )?agente de [a-z]+)';
var ESCALAR_VERBO_ = '(?:pido|pida|pidas|pidiendo|pedir|pedirle|pedirselo|pedirsela|pedire|pediria|mando|mandar|mandarle|mandarselo|mandare|paso|pasar|pasarle|pasarselo|pasare|' +
  'consulto|consultar|consultarle|consultare|derivo|derivar|derivarlo|derivarle|escalo|escalar|escalarlo)';
var ESCALAR_PROMESA_RE_ = new RegExp('\\b' + ESCALAR_VERBO_ + '\\b[^.?!\\n]{0,45}\\b' + ESCALAR_A_ + '\\b|\\b' + ESCALAR_A_ +
  '\\b[^.?!\\n]{0,30}\\b(?:lo|la|los|las) (?:saque|exporte|arme|haga|revise|programe|agregue|consiga)\\b');
var ESCALAR_PREGUNTA_RE_ = /¿\s*(?:te parece (?:que|si)|quieres que|prefieres que|lo|se lo|le)\s+(?:lo |se lo |la )?(?:pid[ao]|pase|mande|haga en segundo plano|derive)\b/;
var ESCALAR_CAPACIDAD_RE_ = /\bno tengo (?:la |una |esa |ninguna )?(?:capacidad|herramienta|forma|manera|como|acceso)\b|\bno (?:lo |la |los |las )?puedo (?:hacer|sacar|generar|armar|exportar|leer|consultar|acceder|calcular|procesar|cruzar)\b|\bmis herramientas no\b|\bfuera de mi alcance\b/;
/* Juan pregunta cómo va algo que ya está con Claude: la respuesta habla de Claude sin prometer nada. */
var ESCALAR_ESTADO_RE_ = /\b(?:como va|como vamos|en que va|que (?:te )?(?:dijo|respondio|contesto)|ya (?:termino|respondio|contesto|quedo))\b/;
function escalarNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ \t]+/g, ' ').trim(); }
function escalarNoPudo_(respuesta, ag) {
  if ((ag && ag.noPudo || []).length) return 'herramienta';
  var t = escalarNorm_(respuesta); if (!t) return '';
  if (ESCALAR_PREGUNTA_RE_.test(t)) return 'pregunta';
  if (ESCALAR_PROMESA_RE_.test(t)) return 'promesa';
  if (ESCALAR_CAPACIDAD_RE_.test(t)) return 'capacidad';
  return '';
}
var ESCALAR_MOTIVOS_ = { herramienta: 'usó una herramienta que no existe', pregunta: 'ofreció pedirlo y preguntó si lo hacía', promesa: 'dijo que lo pediría', capacidad: 'dijo que no tiene cómo hacerlo', alma: 'decidió pedírselo a Desarrollo' };

/* ── El pedido en JSON (lo lee Claude; nadie más lo ve) ── */
var ESCALAR_CANALES_ = { whatsapp: 'WhatsApp', hub: 'el chat del Hub', app: 'la app de Alma', llamada: 'una llamada', calle: 'el Modo calle', segundo_plano: 'una llamada (en segundo plano)' };
function escalarJson_(adm, x) {
  x = x || {};
  var principal = esAdminPrincipal_(adm), juan = String(x.pedido || '').trim(), entrega = principal && x.entrega !== false;
  var hechas = (x.hechas || []).filter(function (h) { return h && h.resumen; }).map(function (h) { return h.resumen + (h.error ? ' (falló: ' + h.error + ')' : ''); }).slice(0, 8);
  return {
    rol: x.rol || 'Desarrollo de Spacio AM (Claude): resuelves lo que Alma no puede hacer sola.',
    tarea: x.tarea || 'Consigue lo que pidió ' + (adm.nombre || 'Juan') + '. Si hace falta un cambio (una herramienta de Alma, un dato, una pantalla), constrúyelo para que Alma lo pueda entregar.',
    contexto: {
      pedido_exacto: juan,
      pedido_por: { nombre: adm.nombre || '', rol: principal ? 'administrador principal' : 'administrador', principal: principal },
      canal: ESCALAR_CANALES_[x.canal] || x.canal || 'el chat con Alma',
      intento_de_alma: { dijo: String(x.intento || '').replace(/\s+/g, ' ').slice(0, 700), herramientas: hechas, por_que_escalo: ESCALAR_MOTIVOS_[x.motivo] || x.motivo || '' },
      para_entregar: entrega ? juan : '',
      seguimiento_de: x.seguimiento ? String(x.seguimiento).slice(0, 1500) : undefined,
      union: entrega ? 'Si es un PR necesario para entregar este pedido, Alma lo une sola con las revisiones en verde, espera la publicación y le entrega el resultado a Juan (Juan, 12-nov-2026).' : 'Juan une (dice «une»).'
    },
    pasos: x.pasos || [
      'Lee CLAUDE.md, ESTANDARES.md y docs/GLOSARIO.md.',
      'Si el resultado sale de datos que puedes leer, devuélvelo completo en tu respuesta (detalle).',
      'Si hace falta un cambio, hazlo en un PR chico, con prueba, para que Alma entregue el resultado sola cuando se una.',
      'Lo que sea decisión de Juan, pregúntalo (estado pregunta) con tu opción recomendada.'
    ],
    restricciones: x.restricciones || [
      entrega ? 'No unas tú: Alma une sola solo lo necesario para este pedido del administrador principal y con las revisiones en verde.' : 'No unas: Juan une.',
      'Sin datos personales de huéspedes, llaves, teléfonos ni correos en código o PRs.',
      'Español en commits, PRs y textos.'
    ],
    formato_de_respuesta: {
      estado: 'listo | pregunta | fallo',
      voz: 'una frase simple para Juan: el resultado o qué hace el cambio',
      detalle: 'el resultado completo o lo que cambió',
      enlaces: 'los PR en el orden en que se unen (si hay dos repos, primero el que el otro necesita)',
      rama: 'tu rama'
    }
  };
}
function escalarTitulo_(t) { return String(t || '').replace(/^\[nota de voz\]\s*/i, '').replace(/^alma[,:]?\s*/i, '').replace(/\s+/g, ' ').trim().split(/[.!?]\s/)[0].slice(0, 80) || 'Pedido de Juan'; }

/* ── Pedir a Desarrollo, ya. x: { pedido (lo que dijo Juan), tarea?, intento, canal, motivo, hechas, sinChat }.
   Devuelve { ok, texto (la frase para Juan), claude, micro, repetido? }. Un pedido igual en 2 h no sale otra vez. ── */
function escalarPedir_(adm, x) {
  x = x || {};
  var juan = String(x.pedido || '').trim(); if (!juan) return { ok: false, texto: '', error: 'sin pedido' };
  var clave = escalarNorm_(juan).slice(0, 120), canal = x.canal || (typeof AGENTE_CANAL_ !== 'undefined' && AGENTE_CANAL_) || 'hub';
  var ya = escalarEntregas_().filter(function (e) { return e.clave === clave && Date.now() - e.t < 2 * 3600000; })[0];
  if (ya) return { ok: true, repetido: true, texto: ESCALAR_FRASE_, micro: ya.micro, claude: { ok: true, micro: ya.micro } };
  var json = escalarJson_(adm, Object.assign({}, x, { canal: canal }));
  var r = paraClaudeCrear_(adm, { titulo: escalarTitulo_(x.tarea || juan), app: 'Otro', tipo: 'mejora', prioridad: 'normal', nivel: 'complejo', sinChat: x.sinChat !== false,
    que_quiere: JSON.stringify(json, null, 2), resumen: juan });
  if (!r || !r.ok) return { ok: false, texto: 'Eso todavía no lo puedo hacer yo sola, y el pedido no salió: ' + ((r && r.error) || 'error') + '.', claude: { ok: false } };
  var mi = r.micro || {};
  /* Solo el pedido del principal se une solo (Juan, 12-nov-2026); el de otra persona espera su «une». */
  if (esAdminPrincipal_(adm) && mi.id) escalarGuardar_({ id: 'esc' + Date.now(), micro: mi.id, nombre: mi.nombre || escalarTitulo_(juan), email: adm.email, canal: canal,
    pedido_por: 'principal', para_entregar: juan.slice(0, 700), clave: clave, t: Date.now(), estado: 'pedido', prs: [], unidos: [] });
  return { ok: true, texto: r.claude ? ESCALAR_FRASE_ : r.nota, micro: mi.id || '', claude: { ok: true, id: r.id || '', directo: !!r.claude, issue: r.issue || '', micro: mi.id || '', nivel: r.nivel || '' } };
}

/* ── Al cerrar un turno (chat.js): si Alma no pudo y nada salió todavía, sale aquí. null si no aplica. ── */
function escalarCerrarTurno_(adm, pedido, ag, o) {
  o = o || {};
  if (!adm || !esAdminPrincipal_(adm) || o.sinEscalar || !String(pedido || '').trim()) return null;
  var hechas = (ag && ag.hechas) || [];
  if (hechas.some(function (h) { return h && (h.tipo === 'pedido_desarrollo' || h.tipo === 'borrador_claude'); })) return null;   // ya salió en este turno
  if (ESCALAR_ESTADO_RE_.test(escalarNorm_(pedido))) return null;
  var motivo = escalarNoPudo_(ag && ag.respuesta, ag); if (!motivo) return null;
  var r = escalarPedir_(adm, { pedido: pedido, intento: ag && ag.respuesta, canal: o.canal, motivo: motivo, hechas: hechas });
  r.motivo = motivo;
  return r;
}

/* ── Las entregas pendientes (pocas y cortas: caben en una propiedad) ── */
function escalarEntregas_() {
  var l = []; try { l = JSON.parse(PropertiesService.getScriptProperties().getProperty(ESCALAR_PROP_) || '[]'); } catch (e) { l = []; }
  return (Array.isArray(l) ? l : []).filter(function (e) { return e && Date.now() - Number(e.t || 0) < ESCALAR_VIGENCIA_; });
}
function escalarEscribir_(l) {
  var P = PropertiesService.getScriptProperties();
  l = l.filter(function (e) { return e && Date.now() - Number(e.t || 0) < ESCALAR_VIGENCIA_; }).slice(-ESCALAR_MAX_);
  if (!l.length) { P.deleteProperty(ESCALAR_PROP_); return; }
  /* Una propiedad guarda ~9 KB: si no cabe, primero se van las ya terminadas y luego las más viejas. */
  var vivas = function (e) { return /^(pedido|por_unir|publicando|publicado|entregando)$/.test(e.estado); };
  for (var k = 0; k < 3; k++) {
    try { P.setProperty(ESCALAR_PROP_, JSON.stringify(l)); return; }
    catch (er) { l = k === 0 ? l.filter(vivas) : l.slice(-Math.max(1, l.length - 2)); }
  }
  console.error('escalarEscribir_: no cupo en la propiedad');
}
function escalarGuardar_(e) {
  var l = escalarEntregas_().filter(function (x) { return x.id !== e.id; }); l.push(e); escalarEscribir_(l); return e;
}
function escalarDeMicro_(micro) { return micro ? escalarEntregas_().filter(function (e) { return e.micro === micro && /^(pedido|por_unir)$/.test(e.estado); })[0] || null : null; }

/* ── Claude respondió (paraClaudeRespuesta_). Devuelve 'unir' (Alma lo une y entrega: sin «Unir» para Juan), 'entregado'
   (respondió sin PR: su respuesta es el resultado) o '' (sigue como siempre). ── */
function escalarAlResponder_(micro, estado, enlaces, texto) {
  var e = escalarDeMicro_(micro); if (!e || e.pedido_por !== 'principal' || !e.para_entregar) return '';
  if (estado === 'pregunta') return '';   // Juan contesta; la próxima respuesta vuelve aquí
  if (estado === 'fallo') { e.estado = 'fallo'; escalarGuardar_(e); return ''; }
  var prs = (enlaces || []).filter(function (u) { return /github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/.test(u); });
  if (!prs.length) {
    e.estado = 'entregada'; e.fin = Date.now(); escalarGuardar_(e);
    if (e.canal === 'whatsapp') escalarWhatsApp_(e, 'Sobre lo que me pediste («' + e.nombre + '»):\n\n' + String(texto || '').trim());
    return 'entregado';
  }
  e.prs = prs; e.estado = 'por_unir'; e.listo_t = Date.now(); escalarGuardar_(e);
  try { CacheService.getScriptCache().remove('escalar_t'); } catch (er) {}
  return 'unir';
}

/* ── Cada 2 min (procesarCola): une lo que está en verde, sigue la publicación y entrega. Una entrega por pasada. ── */
function escalarRevisar_() {
  if (!PropertiesService.getScriptProperties().getProperty(ESCALAR_PROP_)) return 0;   // sin entregas: ni red ni hoja
  var c = CacheService.getScriptCache(); if (c.get('escalar_t')) return 0; c.put('escalar_t', '1', 110);
  var n = 0;
  escalarEntregas_().filter(function (e) { return /^(por_unir|publicando|publicado)$/.test(e.estado); }).slice(0, 3).forEach(function (e) {
    try { n += e.estado === 'por_unir' ? escalarUnir_(e) : e.estado === 'publicando' ? escalarPublicacion_(e) : escalarEntregar_(e); }
    catch (er) { console.error('escalarRevisar_ ' + e.id + ': ' + (er.stack || er)); }
  });
  return n;
}
/* Une en orden, uno por uno; solo con las revisiones en verde. */
function escalarUnir_(e) {
  var adm = adminPorEmail_(e.email); if (!adm || !esAdminPrincipal_(adm)) return 0;
  var lista = prsAbiertos_(true); if (!lista) return 0;   // sin llave o GitHub no respondió: la próxima pasada
  for (var i = 0; i < e.prs.length; i++) {
    var url = e.prs[i]; if (e.unidos.indexOf(url) >= 0) continue;
    var pr = lista.filter(function (x) { return String(x.url).replace(/\/+$/, '') === String(url).replace(/\/+$/, ''); })[0];
    if (!pr) {   // ya no está abierto: Juan lo unió en GitHub, o se cerró
      var inf = paraClaudePrInfo_(url);
      if (inf && inf.estado === 'unido') { e.unidos.push(url); continue; }
      return escalarNoUne_(e, adm, url, inf && inf.estado === 'cerrado' ? 'se cerró sin unir' : 'no lo encuentro en GitHub');
    }
    if (pr.estado === 'revisando') {
      if (Date.now() - Number(e.listo_t || e.t) > ESCALAR_ESPERA_CI_) return escalarNoUne_(e, adm, url, 'sus revisiones llevan más de 2 horas sin terminar');
      return 0;   // en la próxima pasada
    }
    if (pr.estado !== 'listo') return escalarNoUne_(e, adm, url, pr.estado === 'fallo' ? 'sus revisiones fallaron' : pr.estado === 'choque' ? 'choca con lo último de main' : 'todavía es un borrador');
    var r = unirCambio_(url);   // lo mismo que unir_cambio
    if (!r || !(r.unidos || []).length) return escalarNoUne_(e, adm, url, String(((r && r.no_unidos || [])[0] || {}).error || (r && r.error) || 'GitHub no lo dejó unir').replace(/\.$/, ''));
    e.unidos.push(url); e.unido_t = Date.now(); escalarGuardar_(e);
  }
  e.estado = 'publicando'; e.unido_t = e.unido_t || Date.now(); escalarGuardar_(e);
  return 1;
}
function escalarNoUne_(e, adm, url, causa) {
  e.estado = 'no_unida'; e.causa = causa; e.fin = Date.now(); escalarGuardar_(e);
  try { accionCrear_('Unir el PR: ' + e.nombre, 'No lo uní sola: ' + causa + '. Revísalo y únelo cuando esté.', url, 'claude'); } catch (er) {}
  escalarAvisar_(adm, e, 'No uní el cambio para «' + e.nombre + '»: ' + causa + '. ' + url, 2);
  return 1;
}
/* La publicación: las revisiones del commit de cada unión (Actions, Publicar Apps Script, Pages). */
function escalarPublicacion_(e) {
  var adm = adminPorEmail_(e.email); if (!adm) return 0;
  for (var i = 0; i < e.unidos.length; i++) {
    var inf = paraClaudePrInfo_(e.unidos[i]); if (!inf || !inf.sha) return 0;
    var ck = paraClaudeChecks_(inf.repo, inf.sha);
    if (ck && ck.fallas) {
      e.estado = 'fallo_pub'; e.fin = Date.now(); escalarGuardar_(e);
      escalarAvisar_(adm, e, 'Uní el cambio para «' + e.nombre + '», pero falló al publicarse: ' + e.unidos[i], 2);
      return 1;
    }
    if (!ck || ck.corriendo || (!ck.total && Date.now() - Number(e.unido_t) < 180000)) return 0;
  }
  /* Publicado. La entrega va en la pasada siguiente: esta ejecución puede tener el código de antes. */
  e.estado = 'publicado'; e.pub_t = Date.now(); escalarGuardar_(e);
  return 1;
}
/* Hace lo que Juan pidió con el código nuevo y se lo entrega con el enlace. Reserva primero (dos pasadas a la vez). */
function escalarEntregar_(e) {
  if (Date.now() - Number(e.pub_t || 0) < 60000) return 0;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return 0;
  try {
    var hoy = escalarEntregas_().filter(function (x) { return x.id === e.id; })[0];
    if (!hoy || hoy.estado !== 'publicado') return 0;
    hoy.estado = 'entregando'; escalarGuardar_(hoy); e = hoy;
  } finally { lock.releaseLock(); }
  var adm = adminPorEmail_(e.email); if (!adm) return 0;
  var canal = e.canal === 'whatsapp' ? 'whatsapp' : /^(llamada|calle|segundo_plano)$/.test(e.canal) ? 'segundo_plano' : 'hub';
  var pedido = 'Ya está publicado el cambio que hacía falta para lo que te pedí. Hazlo ahora con tus herramientas y dame el resultado completo: ' + e.para_entregar;
  var resp = '', hechas = [];
  try {
    /* El pedido es interno: no se guarda como si Juan lo hubiera escrito; en su chat queda solo el resultado. */
    var ag = opAgente_(adm, pedido, canal, [], opFilas_(adm.email, 20));
    var turno = chatTurnoCerrar_(adm, [], pedido, ag, { canal: canal, sinEscalar: true, sinDesarrollo: true });
    resp = String(turno.texto || ag.respuesta || '').trim(); hechas = ag.hechas || [];
    try { resp = formatearMensaje_(resp); } catch (er) {}
  } catch (er) { resp = 'Uní el cambio, pero no pude sacar el resultado: ' + String(er).slice(0, 150) + '.'; }
  var texto = resp + '\n\n' + (e.unidos.length > 1 ? 'Uní los cambios que hacían falta: ' : 'Uní el cambio que hacía falta: ') + e.unidos.join(' ');
  e.estado = 'entregada'; e.fin = Date.now(); escalarGuardar_(e);
  try { opGuardar_(adm, 'alma', canal === 'segundo_plano' ? 'llamada' : canal, texto, hechas); } catch (er) { console.error('escalarEntregar_ chat: ' + er); }
  if (e.canal === 'whatsapp') escalarWhatsApp_(e, texto);
  try { vozAvisoPoner_(adm, 'Ya está lo que pediste («' + e.nombre + '»): uní el cambio y te lo dejé en tu chat.', null, { nivel: 2 }); } catch (er) {}
  return 1;
}
function escalarAvisar_(adm, e, texto, nivel) {
  try { opGuardar_(adm, 'alma', 'claude', texto, [], CHAT_DESARROLLO_); } catch (er) { console.error('escalarAvisar_ chat: ' + er); }
  try { vozAvisoPoner_(adm, texto, null, { nivel: nivel || 2 }); } catch (er) {}
  if (e && e.canal === 'whatsapp') escalarWhatsApp_(e, texto);
}
/* Lo pidió por WhatsApp: el resultado y los avisos de su pedido vuelven por WhatsApp. */
function escalarWhatsApp_(e, texto) {
  var adm = adminPorEmail_(e.email); if (!adm || !(adm.tels || []).length) return;
  try { var w = waEnviar_(adm.wa || adm.tels[0], texto); if (w && w.ok === false) console.error('escalar WhatsApp: ' + w.error); } catch (er) { console.error('escalar WhatsApp: ' + er); }
}
