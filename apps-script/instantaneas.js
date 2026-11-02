/* ═══ RESPUESTAS INSTANTÁNEAS: las 5 preguntas de lectura de siempre, sin IA ═════════════════════════════════════════
   En dos semanas, ≈280 de ~1500 pedidos de Juan fueron la misma pregunta de leer (casi todos por llamada → la voz los
   reescribe como «Verificar…/Revisar…/Buscar…» → opAgente_). Aquí se reconocen con reglas fijas, se lee con el mismo
   ayudante que usa la herramienta de la IA y se contesta con una frase fija:
     1. ruta       «¿Qué ruta tiene Sucely hoy?», «Verificar si Joselyn tiene ruta asignada para hoy», «¿Quién limpia mañana?»
                   → agRutaTrabajos_ (agente.js, el mismo de ruta_del_dia).
     2. operacion  «¿Quién llega hoy?», «check-ins de mañana», «resumen de la operación de ayer: cuántas llegadas, salidas»
                   → la hoja de reservas + agEstadoReserva_ (las canceladas no cuentan).
     3. reserva    «Buscar la reserva de Jorge Beteta y verificar si ya llegó», «¿Cuándo llega Marcela?» → buscar_reservas;
                   solo si hay UNA reserva y la coincidencia es exacta.
     4. codigo     «Código de acceso del 1102», «código de Ignacio 1105» → codigo_acceso; solo el administrador principal y
                   solo si la propiedad es una sola y trae todas las palabras pedidas (nada de «se parece»).
     5. tareas     «¿Qué tareas tengo abiertas?», «Revisar si hay pendientes o tareas urgentes activas» → las tareas
                   abiertas de Epi (como tareas_abiertas) y, para el principal, lo que espera su sí en Pendientes.
   · Cada regla cubre la frase COMPLETA (de principio a fin, con «por favor», «Alma,» y el verbo de la voz alrededor): si el
     pedido trae algo más («… y escríbele que…», dos preguntas, una hora, «ella»), no coincide y sigue la IA tal cual hoy.
   · También va a la IA: un nombre que no está o que se parece a dos, una propiedad que no existe o son varias, varias
     reservas, «¿ya llegó?» el mismo día de su entrada (la IA lee la conversación), Epi sin leer, fotos, la familia
     (AGENTE_PERMITIDAS_) y el que no es principal pidiendo un código.
   · Voz (llamada y calle): máximo 2 frases y 5 nombres («y 3 más»). En el chat, hasta 10.
   · «(al instante)» solo va en el registro (console), nunca en lo que se dice o se escribe. INSTANT_USO cuenta las de hoy y
     el total (Ajustes → Lo que Alma aprendió). INSTANT_ON = 0 lo apaga (por defecto encendido).
   · Corre después de las recetas (recetas.js) en opAgente_: un atajo que Juan enseñó («cuando diga X, haz Y») gana. */

var INST_VOZ_MAX_ = 5, INST_CHAT_MAX_ = 10, INST_MAX_LARGO_ = 160;
var INST_MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var INST_DIAS_SEM_ = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
var INST_DIAS_TXT_ = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/* Palabras que nunca son parte de un nombre: así «Sucely y Joselyn» o «Sucely y escríbele» no caben en la regla. */
var INST_NO_NOMBRE_ = 'y|e|o|u|ni|que|si|ya|no|hoy|manana|pasado|ayer|tiene|tienen|ruta|rutas|para|de|del|la|el|los|las|con|a|al|en|le|les|lo|' +
  'me|mi|mis|su|sus|tu|ella|el|ellos|ellas|esta|este|eso|esto|ese|esa|dile|dime|escribe|escribele|escribirle|avisa|avisale|manda|mandale|' +
  'pregunta|preguntale|tambien|ademas|verificar|verifica|revisar|revisa|ver|confirmar|confirma|buscar|busca|reserva|codigo|tareas|pendientes|' +
  'lunes|martes|miercoles|jueves|viernes|sabado|domingo|como|cuando|llego|llega|sale|entra|asignada|asignado|por|favor|tengo|hay|sus|fechas|estado|' +
  'quien|quienes|cual|cuales|donde|limpieza|limpiezas|trabajo|trabajos|hora|horas|todos|todas|equipo|alguien|nadie';
/* El verbo con que la voz reescribe el pedido («Verificar si…», «Revisar…», «Buscar…») o con que Juan pregunta. */
var INST_V_ = '(?:(?:verificar|verifica|revisar|revisa|revisame|consultar|consulta|confirmar|confirma|ver|checar|chequear|buscar|busca|buscame|' +
  'dime|decime|dame|averiguar|averigua|necesito saber|quiero saber|me dices|me puedes decir|puedes decirme|me podrias decir|puedes revisar|podrias revisar|' +
  'puedes ver|podrias ver|quisiera saber|sabes)\\s+)?';
var INST_DIA_ = '(?:\\s+(?:(?:para|de|del|el|este|esta|en|dia|al|por)\\s+)*(?<dia>hoy|pasado manana|manana|ayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo))?';

function instOn_() { return String(PropertiesService.getScriptProperties().getProperty('INSTANT_ON') || '1') !== '0'; }
function instNorm_(t) {
  var s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/check[\s-]*(in|out)s?/g, 'check $1').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  /* Lo que no cambia el pedido, al principio y al final. */
  var antes;
  do { antes = s; s = s.replace(/^(?:alma|oye|hola|buenas|buenos dias|buenas tardes|porfa|por favor|porfavor|una pregunta|pregunta|ok|okay|bueno|a ver|mira|oye alma|disculpa)\s+/, ''); } while (s !== antes);
  do { antes = s; s = s.replace(/\s+(?:por favor|porfa|porfavor|gracias|alma|please)$/, ''); } while (s !== antes);
  return s;
}
/* Arma una regla de frase completa: {V} verbo opcional · {N} nombre (1 a 4 palabras) · {P} propiedad · {DIA} día opcional. */
function instRe_(s) {
  var tok = '(?:(?!(?:' + INST_NO_NOMBRE_ + ')\\b)[a-z0-9]+)', nombre = tok + '(?:\\s+' + tok + '){0,3}';
  return new RegExp('^' + s.replace('{V}', INST_V_).replace('{N}', '(?<n>' + nombre + ')').replace('{P}', '(?<p>' + nombre + ')').replace('{DIA}', INST_DIA_) + '$');
}
var INST_REGLAS_ = null;
function instReglas_() {
  if (INST_REGLAS_) return INST_REGLAS_;
  var R = function (tipo, s, extra) { return { tipo: tipo, re: instRe_(s), extra: extra || {} }; };
  INST_REGLAS_ = [
    /* 1 · ruta de todos (antes que la de una persona: «ruta de hoy» no es una persona) */
    R('ruta', '{V}(?:si )?(?:quien|quienes) (?:limpia|limpian|trabaja|trabajan|tiene ruta|tienen ruta|va a limpiar|van a limpiar|esta de turno|estan de turno)(?: asignad[ao]s?)?{DIA}', { todos: true }),
    R('ruta', '{V}(?:las |la )?rutas?(?: del dia| del equipo| de limpieza)?{DIA}', { todos: true }),
    R('ruta', '{V}(?:que|como) (?:rutas hay|estan las rutas|esta la ruta|hay en la ruta)(?: del dia)?{DIA}', { todos: true }),
    R('ruta', '{V}(?:que |cuales |cuantas )?limpiezas (?:hay|tenemos)(?: programadas)?{DIA}', { todos: true }),
    /* 1 · ruta de una persona */
    R('ruta', '{V}(?:que|cual) (?:es la )?ruta (?:tiene|lleva|le toca a|le toca|de) {N}{DIA}'),
    R('ruta', '{V}(?:si )?{N} tiene (?:ruta|trabajos?|limpiezas?)(?: asignad[ao]s?)?{DIA}'),
    R('ruta', '{V}(?:si )?tiene (?:ruta|trabajos?|limpiezas?)(?: asignad[ao]s?)? {N}{DIA}'),
    R('ruta', '{V}(?:la )?ruta (?:de|del dia de) {N}{DIA}'),
    R('ruta', '{V}(?:que|cuales|cuantas|cuantos) (?:trabajos|limpiezas|casas|apartamentos) tiene {N}{DIA}'),
    R('ruta', '{V}a donde (?:va|le toca ir a|le toca a) {N}{DIA}'),
    /* 2 · llegadas y salidas */
    R('operacion', '{V}(?:quien|quienes) (?:llega|llegan|entra|entran|hace check in|hacen check in) y (?:quien |quienes )?(?:sale|salen|se va|se van){DIA}', { modo: 'ambas' }),
    R('operacion', '{V}(?:quien|quienes) (?:llega|llegan|entra|entran|hace check in|hacen check in|tiene check in|tienen check in){DIA}', { modo: 'llegadas' }),
    R('operacion', '{V}(?:quien|quienes) (?:sale|salen|se va|se van|hace check out|hacen check out|tiene check out|tienen check out){DIA}', { modo: 'salidas' }),
    R('operacion', '{V}(?:(?:que|cuales|cuantas|cuantos) )?(?:las |los |hay )?(?:llegadas|check ins?|check in|entradas) y (?:(?:cuantas|cuantos) )?(?:las |los )?(?:salidas|check outs?|check out)(?: hay| tenemos)?{DIA}', { modo: 'ambas' }),
    R('operacion', '{V}(?:(?:que|cuales|cuantas|cuantos) )?(?:las |los |hay )?(?:llegadas|check ins?|check in|entradas)(?: hay| tenemos)?{DIA}', { modo: 'llegadas' }),
    R('operacion', '{V}(?:(?:que|cuales|cuantas|cuantos) )?(?:las |los |hay )?(?:salidas|check outs?|check out)(?: hay| tenemos)?{DIA}', { modo: 'salidas' }),
    R('operacion', '{V}(?:(?:que|cuantas|cuantos) )?(?:reservas|huespedes) (?:llegan|entran){DIA}', { modo: 'llegadas' }),
    R('operacion', '{V}(?:el |un )?resumen(?: de (?:la )?operacion| del dia| de la operacion del dia)?{DIA}(?: (?:cuant[ao]s )?(?:llegadas|salidas)(?: y)?(?: cuant[ao]s)? (?:llegadas|salidas)(?: hubo| hay)?)?', { modo: 'ambas' }),
    R('operacion', '{V}como (?:esta|va|viene) (?:la operacion|el dia)(?: de)?{DIA}', { modo: 'ambas' }),
    /* 3 · una reserva (por nombre o código) */
    R('reserva', '{V}(?:la )?reserva (?:de|del huesped|de la huesped|a nombre de|del|de la) {N}(?: y)?(?: (?:verificar|verifica|revisar|revisa|ver|confirmar|confirma|dime|decime))?(?: si)?(?: (?<cola>ya llego|ya entro|ya hizo check in|sus fechas|las fechas|fechas|como esta|su estado|el estado|cuando llega|cuando sale))?'),
    R('reserva', '{V}(?:la )?reserva (?<n>hm[a-z0-9]{4,})(?: y)?(?: (?:verificar|revisar|ver|dime))?(?: si)?(?: (?<cola>ya llego|ya entro|sus fechas|fechas|como esta|su estado))?'),
    R('reserva', '{V}(?:si )?{N} ya (?<cola>llego|entro|hizo check in)'),
    R('reserva', '{V}(?:si )?ya (?<cola>llego|entro|hizo check in) {N}'),
    R('reserva', '{V}como (?:esta|va) la reserva (?:de|del|de la) {N}'),
    R('reserva', '{V}(?:el )?estado de la reserva (?:de|del|de la) {N}'),
    R('reserva', '{V}(?:que |cuales son las |las )?fechas (?:tiene |de |de la reserva de |trae )?{N}'),
    R('reserva', '{V}cuando (?<cola>llega|sale|entra|se va) {N}'),
    /* 4 · código de acceso */
    R('codigo', '{V}(?:cual es |me das |me pasas |pasame |necesito |el )?(?:el )?codigo(?: de acceso| de la puerta| de entrada| de la cerradura| del equipo)? (?:del|de|de la|para|para el|para la|en|en el) (?:apartamento |apto |depa |departamento |propiedad )?{P}{DIA}'),
    R('codigo', '{V}(?:el )?codigo de acceso {P}{DIA}'),
    /* 5 · tareas y pendientes */
    R('tareas', '{V}(?:que|cuales|cuantas) (?:son las |son mis )?tareas (?:tengo|hay|tenemos|quedan|estan)(?: abiertas| pendientes| activas| urgentes)?(?: hoy)?', { modo: 'tareas' }),
    R('tareas', '{V}(?:si hay )?(?:que |cuales |las |mis )?tareas(?: abiertas| pendientes| activas| urgentes)(?: activas)?(?: hay| tengo| tenemos)?(?: hoy)?', { modo: 'tareas' }),
    R('tareas', '{V}(?:mis|las) tareas', { modo: 'tareas' }),
    R('tareas', '{V}(?:que|cuales|cuantos) (?:son (?:los |mis )?)?pendientes (?:hay|tengo|tenemos|quedan)(?: abiertos| urgentes)?(?: hoy)?', { modo: 'pendientes' }),
    R('tareas', '{V}(?:mis |los )?pendientes(?: abiertos| urgentes)?(?: de hoy)?', { modo: 'pendientes' }),
    R('tareas', '{V}que (?:tengo|hay|tenemos) pendientes?(?: hoy)?', { modo: 'pendientes' }),
    R('tareas', '{V}si hay (?:pendientes|tareas)(?: urgentes)?(?: o (?:tareas|pendientes)(?: urgentes)?)?(?: activ[ao]s| abiert[ao]s)?', { modo: 'pendientes' })
  ];
  return INST_REGLAS_;
}
/* El pedido → { tipo, extra, n, p, dia, cola } o null. Solo lee el texto (sin hojas): se puede probar solo. */
function instReconocer_(texto) {
  var t = String(texto || '');
  if (!t.trim() || t.length > INST_MAX_LARGO_ || /\n/.test(t) || /\?.+\?/.test(t)) return null;   // dos preguntas: IA
  var s = instNorm_(t); if (!s) return null;
  var reglas = instReglas_();
  for (var i = 0; i < reglas.length; i++) {
    var m = reglas[i].re.exec(s); if (!m) continue;
    var g = m.groups || {};
    return { tipo: reglas[i].tipo, extra: reglas[i].extra, n: g.n || '', p: g.p || '', dia: g.dia || '', cola: g.cola || '', norm: s };
  }
  return null;
}

/* ── Fechas (hora de Guatemala) ── */
function instFechaDe_(dia) {
  var hoy = recHoy_(), w = String(dia || 'hoy');
  if (w === 'hoy') return hoy;
  if (w === 'manana') return sumarDias_(hoy, 1);
  if (w === 'pasado manana') return sumarDias_(hoy, 2);
  if (w === 'ayer') return sumarDias_(hoy, -1);
  var k = INST_DIAS_SEM_.indexOf(w); if (k < 0) return hoy;
  var dw = new Date(hoy + 'T12:00:00').getDay();
  return sumarDias_(hoy, (k - dw + 7) % 7);
}
function instDiaTxt_(dia, f) {
  var w = String(dia || 'hoy');
  if (w === 'hoy' || f === recHoy_()) return 'hoy';
  if (w === 'manana') return 'mañana';
  if (w === 'pasado manana') return 'pasado mañana';
  if (w === 'ayer') return 'ayer';
  return 'el ' + INST_DIAS_TXT_[new Date(f + 'T12:00:00').getDay()] + ' ' + Number(f.slice(8, 10));
}
function instFechaTxt_(f) { return f ? Number(f.slice(8, 10)) + ' de ' + INST_MESES_[Number(f.slice(5, 7)) - 1] : ''; }
function instRango_(a, b) {
  if (!a) return '';
  if (!b || a === b) return 'el ' + instFechaTxt_(a);
  return a.slice(0, 7) === b.slice(0, 7) ? 'del ' + Number(a.slice(8, 10)) + ' al ' + instFechaTxt_(b) : 'del ' + instFechaTxt_(a) + ' al ' + instFechaTxt_(b);
}
function instMayus_(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

/* «A, B y C» con máximo `max` y «y 3 más». */
function instLista_(items, max) {
  var v = items.slice(0, max), resto = items.length - v.length;
  if (resto > 0) return v.join(', ') + ' y ' + resto + ' más';
  return v.length > 1 ? v.slice(0, -1).join(', ') + ' y ' + v[v.length - 1] : (v[0] || '');
}
function instEsVoz_(canal) { return canal === 'llamada' || canal === 'calle'; }

/* Una persona del equipo por nombre: sin acentos ni mayúsculas, el nombre completo o una de sus palabras (el primer
   nombre basta si es único). Si son dos o ninguna, '' (la IA pregunta o busca mejor). */
function instPersona_(q, nombres) {
  var nq = instNorm_(q), w = nq.split(' ').filter(Boolean); if (!w.length) return '';
  var norm = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var exactos = nombres.filter(function (x) { return norm(x) === nq; }); if (exactos.length === 1) return exactos[0];
  var hits = nombres.filter(function (x) { var p = norm(x).split(' '); return w.every(function (a) { return p.indexOf(a) >= 0; }); });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return '';
  /* Un error de escritura o de voz (Sucelly/Sucely): el mismo buscador que usa el agente, que no adivina en un empate. */
  var b = bqBuscar_(q, nombres, function (x) { return x; }, 3);
  if (b.length && b[0].puntaje >= 0.8 && !(b[1] && b[1].puntaje >= b[0].puntaje - 0.05)) return b[0].item;
  return '';
}

/* ── 1 · Ruta ── */
function instRuta_(adm, r, canal, ctx) {
  var cfg = ctx.cfg(); if (!cfg || !cfg.vendors || !cfg.vendors.length) return null;   // Epi sin leer: que la IA lo diga bien
  var f = instFechaDe_(r.dia), dt = instDiaTxt_(r.dia, f), max = instEsVoz_(canal) ? INST_VOZ_MAX_ : INST_CHAT_MAX_, pasado = f < recHoy_();
  if (r.extra.todos) {
    var rt = agRutaTrabajos_(cfg, f, ''); if (rt.error) return null;
    if (!rt.trabajos.length) return instMayus_(dt) + ' no ' + (pasado ? 'hubo' : 'hay') + ' trabajos programados en Epi.';
    var por = {}, orden = [];
    rt.trabajos.forEach(function (t) { if (!por[t.quien]) { por[t.quien] = 0; orden.push(t.quien); } por[t.quien]++; });
    orden.sort(function (a, b) { return por[b] - por[a] || a.localeCompare(b); });
    var nP = orden.length, nT = rt.trabajos.length;
    return instMayus_(dt) + ' ' + (pasado ? 'tuvieron' : 'tienen') + ' ruta ' + nP + (nP === 1 ? ' persona' : ' personas') + ' (' + nT + (nT === 1 ? ' trabajo' : ' trabajos') + '): ' +
      instLista_(orden.map(function (q) { return q.split(' ')[0] + ' (' + por[q] + ')'; }), max) + '.';
  }
  var quien = instPersona_(r.n, cfg.vendors.map(vendNombre_)); if (!quien) return null;
  var rp = agRutaTrabajos_(cfg, f, quien); if (rp.error) return null;
  var corto = String(rp.persona).split(' ')[0];
  if (!rp.trabajos.length) return corto + ' no ' + (pasado ? 'tuvo' : 'tiene') + ' ruta asignada ' + dt + '.';
  var items = rp.trabajos.map(function (t) { var x = t.x; return [String(x.tipo || 'trabajo').toLowerCase(), 'en', x.propiedad || 'sin propiedad'].join(' ') + (x.hora ? ' a las ' + x.hora : '') + (x.estado === 'tentativa' ? ' (tentativa)' : ''); });
  var n = items.length;
  return corto + ' ' + (pasado ? 'tuvo' : 'tiene') + ' ' + n + (n === 1 ? ' trabajo ' : ' trabajos ') + dt + ': ' + instLista_(items, max) + '.';
}

/* ── 2 · Llegadas y salidas ── */
function instReservasDia_(f) {
  var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (x) { return s_(x.code); }), inbox = [];
  try { inbox = hubInbox_(); } catch (e) {}
  var vivos = 0, conv = function (r) { var cod = s_(r.code).toUpperCase(); var ib = inbox.filter(function (x) { return String(x.codigo || '').toUpperCase() === cod; })[0]; return ib ? ib.conv_id : ''; };
  var vale = function (r) { return agEstadoReserva_(conv(r), r, vivos++ < 8).estado !== 'cancelada'; };   // en vivo las primeras, como buscar_reservas
  var dato = function (r) { return { huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim() || 'Sin nombre', propiedad: s_(r.property_name) }; };
  var lleg = filas.filter(function (r) { return fecha_(r.checkin_date) === f; }).filter(vale).map(dato);
  var sal = filas.filter(function (r) { return fecha_(r.checkout_date) === f; }).filter(vale).map(dato);
  return { llegadas: lleg, salidas: sal };
}
function instOperacion_(adm, r, canal) {
  var f = instFechaDe_(r.dia), dt = instDiaTxt_(r.dia, f), voz = instEsVoz_(canal), max = voz ? INST_VOZ_MAX_ : INST_CHAT_MAX_, pasado = f < recHoy_();
  var d = instReservasDia_(f), modo = r.extra.modo;
  var quien = function (l) { return instLista_(l.map(function (x) { return x.huesped.split(' ')[0] + (x.propiedad ? ' (' + x.propiedad + ')' : ''); }), max); };
  var verbo = function (n, pres, pas) { return pasado ? pas[n === 1 ? 0 : 1] : pres[n === 1 ? 0 : 1]; };
  if (modo === 'llegadas') {
    if (!d.llegadas.length) return instMayus_(dt) + ' no ' + (pasado ? 'llegó' : 'llega') + ' nadie.';
    return instMayus_(dt) + ' ' + verbo(d.llegadas.length, ['llega', 'llegan'], ['llegó', 'llegaron']) + ' ' + d.llegadas.length + ': ' + quien(d.llegadas) + '.';
  }
  if (modo === 'salidas') {
    if (!d.salidas.length) return instMayus_(dt) + ' no ' + (pasado ? 'salió' : 'sale') + ' nadie.';
    return instMayus_(dt) + ' ' + verbo(d.salidas.length, ['sale', 'salen'], ['salió', 'salieron']) + ' ' + d.salidas.length + ': ' + quien(d.salidas) + '.';
  }
  var nl = d.llegadas.length, ns = d.salidas.length;
  var cab = instMayus_(dt) + ' ' + (pasado ? 'hubo' : 'hay') + ' ' + nl + (nl === 1 ? ' llegada' : ' llegadas') + ' y ' + ns + (ns === 1 ? ' salida' : ' salidas') + '.';
  if (!nl && !ns) return cab;
  var partes = [];
  if (nl) partes.push(instMayus_(verbo(nl, ['llega', 'llegan'], ['llegó', 'llegaron'])) + ' ' + quien(d.llegadas));
  if (ns) { var vs = verbo(ns, ['sale', 'salen'], ['salió', 'salieron']); partes.push((nl ? vs : instMayus_(vs)) + ' ' + quien(d.salidas)); }
  return cab + ' ' + partes.join('; ') + '.';
}

/* ── 3 · Una reserva ── */
function instReserva_(adm, r, canal, ctx) {
  var res = agEjecutar_(adm, 'buscar_reservas', { texto: r.n }, ctx);
  /* Una sola con todas las palabras exactas (las «se parece» de al lado no cuentan); dos exactas o ninguna: la IA confirma cuál. */
  var lista = ((res && res.reservas) || []).filter(function (x) { return x.coincidencia === 'exacta'; });
  if (lista.length !== 1) return null;
  var x = lista[0], hoy = recHoy_(), nom = x.huesped || 'El huésped', donde = x.propiedad ? ' en ' + x.propiedad : '';
  var pregLlego = /llego|entro|check in/.test(r.cola);
  if (x.estado === 'cancelada') return 'La reserva de ' + nom + donde + ' (' + instRango_(x.entrada, x.salida) + ') está cancelada' + (x.cancelada_el ? ' desde el ' + instFechaTxt_(String(x.cancelada_el).slice(0, 10)) : '') + '.';
  /* «¿Ya llegó?» el día de su entrada: eso no está en la reserva; la IA lo mira en la conversación. */
  if (pregLlego && x.entrada === hoy) return null;
  var cuando;
  if (x.entrada > hoy) cuando = (pregLlego ? 'todavía no: llega el ' : 'llega el ') + instFechaTxt_(x.entrada) + ' y sale el ' + instFechaTxt_(x.salida);
  else if (x.entrada === hoy) cuando = 'llega hoy y sale el ' + instFechaTxt_(x.salida);
  else if (x.salida > hoy) cuando = (pregLlego ? 'sí, está hospedado desde el ' : 'está hospedado desde el ') + instFechaTxt_(x.entrada) + ' y sale el ' + instFechaTxt_(x.salida);
  else if (x.salida === hoy) cuando = (pregLlego ? 'sí, llegó el ' : 'llegó el ') + instFechaTxt_(x.entrada) + ' y sale hoy';
  else cuando = 'ya salió: estuvo ' + instRango_(x.entrada, x.salida);
  var reg = x.estado === 'confirmada' && x.salida >= hoy ? '; registro ' + (x.registro === 'completo' ? 'completo' : 'pendiente') : '';
  return nom + donde + ': ' + cuando + reg + '.';
}

/* ── 4 · Código de acceso (solo el administrador principal) ── */
function instCodigo_(adm, r, canal, ctx) {
  if (!esAdminPrincipal_(adm)) return null;
  var f = instFechaDe_(r.dia), rc = agEjecutar_(adm, 'codigo_acceso', { propiedad: r.p, fecha: f }, ctx);
  var eq = (rc && rc.equipo) || []; if (!rc || rc.error || eq.length !== 1) return null;
  /* Nada de «se parece»: la propiedad debe traer cada palabra pedida (1103 no es 1102). */
  var e = eq[0], nn = ' ' + cdNorm_(e.propiedad) + ' ';
  if (!cdNorm_(r.p).split(' ').every(function (w) { return nn.indexOf(' ' + w + ' ') >= 0; })) return null;
  if (!e.codigo) return e.nota ? e.propiedad + ': ' + e.nota : 'Epi no tiene código cargado para ' + e.propiedad + '.';
  var vig = e.tipo === 'permanente' ? ' (permanente)' : e.vigente ? ' (vigente ' + String(e.vigente).replace(/(\d{4}-\d\d-\d\d) al (\d{4}-\d\d-\d\d)/, function (_, a, b) { return instRango_(a, b); }).replace(/\d{4}-\d\d-\d\d/g, instFechaTxt_) + ')' : '';
  return 'El código de ' + e.propiedad + ' es ' + e.codigo + vig + '.';
}

/* ── 5 · Tareas y pendientes ── */
function instTareas_(adm, r, canal, ctx) {
  var cfg = ctx.cfg(); if (!cfg || !cfg.tareas) return null;
  var hoy = recHoy_(), voz = instEsVoz_(canal), max = voz ? INST_VOZ_MAX_ : INST_CHAT_MAX_;
  var abiertas = cfg.tareas.filter(function (t) { return t && t.id && !t.hecha; }).slice().sort(function (a, b) { return String(a.vence || '9999').localeCompare(String(b.vence || '9999')); });
  var vencidas = abiertas.filter(function (t) { return t.vence && String(t.vence).slice(0, 10) < hoy; }).length;
  var items = abiertas.map(function (t) {
    var v = String(t.vence || '').slice(0, 10), txt = String(t.texto || '').replace(/\s+/g, ' ').trim();
    if (txt.length > 60) txt = txt.slice(0, 57).replace(/\s+\S*$/, '') + '…';
    var nota = [t.prop && t.prop !== '-' && txt.indexOf(t.prop) < 0 ? t.prop : '', v && v < hoy ? 'vencida' : v === hoy ? 'vence hoy' : ''].filter(Boolean).join(', ');
    return txt + (nota ? ' (' + nota + ')' : '');
  });
  var frTareas = !abiertas.length ? 'No hay tareas abiertas.' :
    'Hay ' + abiertas.length + (abiertas.length === 1 ? ' tarea abierta' : ' tareas abiertas') + (vencidas ? ' (' + vencidas + (vencidas === 1 ? ' vencida' : ' vencidas') + ')' : '') + ': ' + instLista_(items, max) + '.';
  if (r.extra.modo !== 'pendientes' || !esAdminPrincipal_(adm)) return frTareas;
  /* Lo que espera su sí en Pendientes (lo mismo que ve en la app). Si no se puede leer, mejor la IA. */
  var p = pendientesTodo_({ email: adm.email }); if (!p || !p.ok) return null;
  var tit = (p.atencion || []).map(function (x) { return String(x.titulo || x.resumen || '').replace(/\s+/g, ' ').trim().slice(0, 60); }).filter(Boolean);
  var frPend = !tit.length ? 'En Pendientes no hay nada esperando tu sí.' : 'En Pendientes ' + (tit.length === 1 ? 'te espera 1' : 'te esperan ' + tit.length) + ': ' + instLista_(tit, voz ? 3 : max) + '.';
  return frPend + ' ' + frTareas;
}

/* ── El núcleo: el pedido → { texto, acciones, tipo, esfera, subcategoria } o null (sigue la IA) ── */
function instResponder_(adm, texto, canal) {
  if (!instOn_() || !adm || AGENTE_PERMITIDAS_) return null;
  var r = instReconocer_(texto); if (!r) return null;
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } };
  var f = { ruta: instRuta_, operacion: instOperacion_, reserva: instReserva_, codigo: instCodigo_, tareas: instTareas_ }[r.tipo];
  var t = f ? f(adm, r, canal, ctx) : null;
  if (!t) return null;
  return { texto: t, acciones: ctx.hechas, tipo: r.tipo, esfera: 'Propósito', subcategoria: r.tipo === 'reserva' ? 'Huéspedes' : 'Operación' };
}
/* Para opAgente_: la misma salida que el bucle de la IA (respuesta, hechas, esfera…), o null. */
function instAgente_(adm, texto, canal) {
  var t0 = Date.now(), x = instResponder_(adm, texto, canal); if (!x) return null;
  instUsada_(x.tipo);
  console.log('Respuesta instantánea (al instante) · ' + x.tipo + ' · ' + (canal || '') + ' · ' + (Date.now() - t0) + ' ms');   // sin el texto: puede llevar un código
  if (canal === 'segundo_plano') { try { pendEncolar_(adm, texto, x.texto, canal); } catch (e) {} }
  return { respuesta: x.texto, hechas: x.acciones || [], esfera: x.esfera, subcategoria: x.subcategoria, micro: '', nivel: '', instantanea: x.tipo };
}
function instUsada_(tipo) {
  try {
    var p = PropertiesService.getScriptProperties(), u = {}; try { u = JSON.parse(p.getProperty('INSTANT_USO') || '{}') || {}; } catch (e) {}
    var dia = recHoy_(); if (u.dia !== dia) { u.dia = dia; u.hoy = 0; }
    u.hoy = (u.hoy || 0) + 1; u.total = (u.total || 0) + 1; u.por = u.por || {}; u.por[tipo] = (u.por[tipo] || 0) + 1;
    p.setProperty('INSTANT_USO', JSON.stringify(u));
  } catch (e) { console.error('instUsada_: ' + e); }
}
/* Para Ajustes → Lo que Alma aprendió: las de hoy y el total. */
function instUso_() {
  var u = {}; try { u = JSON.parse(PropertiesService.getScriptProperties().getProperty('INSTANT_USO') || '{}') || {}; } catch (e) {}
  return { on: instOn_(), hoy: u.dia === recHoy_() ? (u.hoy || 0) : 0, total: u.total || 0, por: u.por || {} };
}
