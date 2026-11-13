/* Prueba de «Alma abre la conversación» (#509 T4, apps-script/almaabre.js) con dobles: sin hoja, sin Claude, sin ElevenLabs.
   Juan, 13-nov-2026: Alma abre ella misma la conversación para contarle un resultado, solo cuando
     · es un RESULTADO (terminó, necesita unir o necesita una acción de Juan), nunca cuando un proceso empieza;
     · es de sus pedidos RECIENTES (los últimos 4 de la fila), no de los viejos;
     · es del administrador principal;
     · y la app está donde puede abrir (Modo calle o conferencia: manda abre = true).
   1. Resultado sí / inicio no (y los tipos que no son resultado de un pedido, como «ya quedó unido», no).
   2. Los últimos 4 sí / el viejo no (un ajuste lo vuelve reciente).
   3. El principal sí / otro administrador no.
   4. Nunca dos veces: el mismo aviso no vuelve a abrir, uno por vuelta, nada viejo, tope en 24 h, se puede apagar, y sin
      abre = true (la app fuera de esos modos) no se marca nada.
   5. Sin datos sensibles: ni teléfonos, ni correos, ni códigos, ni enlaces en lo que va a la app; el contexto es JSON.
   6. De punta a punta: un segundo plano que termina lleva su pedido hasta la notificación y esta llega con su primer
      mensaje; la llamada que abre el aviso lo cuenta como dicho y no el saludo de retomar.
   7. Los ganchos en el código.
   node .github/alma-abre.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = { email: 'juan@x.com', nombre: 'Juan Ovalle', principal: true, tels: ['50200000000'], alternos: [] };
const GABY = { email: 'gaby@x.com', nombre: 'Gabriel', principal: false, tels: ['50211111111'], alternos: [] };
const SUCIO = /\+?\d(?:[\s().-]?\d){7,}|[\w.+-]+@[\w-]+\.[\w.-]+|4821|https?:\/\/|www\./;

function caja() {
  const props = {}, cache = {}, mencionados = [];
  let ahora = Date.parse('2026-11-13T15:00:00Z');
  const D = class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } };
  const lock = { tryLock: () => true, waitLock() {}, releaseLock() {} };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date: D,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; }, getAll: () => ({}), putAll() {} }) },
    LockService: { getScriptLock: () => lock, getUserLock: () => lock },
    Utilities: { base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64url'),
      computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(String(t)).digest()), DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }) }) }) },
    adminsOp_: () => [JUAN, GABY], adminPorEmail_: e => [JUAN, GABY].filter(a => a.email === String(e).toLowerCase())[0] || { email: e, principal: false, tels: [] },
    esAdminPrincipal_: a => !!(a && a.principal), vozColaLock_: () => lock,
    retClave_: a => 'VOZ_RET_' + a.email.replace(/\W/g, ''), retLeer_: () => [], retMencionado_: (a, id) => mencionados.push(id),
    pendFilas_: () => [], normTel_: t => String(t), tituloCorto_: (t, n) => String(t || '').slice(0, n),
    hojaCrear_: () => ({ getLastColumn: () => 15, appendRow() {}, getLastRow: () => 1, getRange: () => ({ setValues() {} }) })
  };
  vm.createContext(ctx);
  ['avisotexto.js', 'calle.js', 'voz.js', 'orbita.js', 'pendientes.js', 'almaabre.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  ctx.pendClasificar_ = () => ({ tipo: 'aviso', area: 'proposito', proyecto: '', titulo: 'Pagos de Amalfi', resumen: 'Ya revisé los pagos de Amalfi de octubre: todo cuadra.', aviso: 'Ya revisé los pagos de Amalfi de octubre: todo cuadra.', importancia: 2, acciones: [] });
  const avisos = (ses, b) => ctx.vozAvisos_(ses || { email: JUAN.email }, b === undefined ? { abre: true } : b).avisos || [];
  return { ctx, props, cache, mencionados, avisos, pasa: ms => { ahora += ms; } };
}

/* 1. Resultado sí / inicio no */
{
  const { ctx, avisos } = caja();
  ctx.abrePedido_(JUAN.email, 'mp1');
  ctx.avisoPoner_(JUAN, 'claude_listo', { titulo: 'Botón de facturas' }, 'r1', { nivel: 2, pedidos: ['mp1'] });
  ctx.vozAvisoPoner_(JUAN, 'Empecé a revisar lo de las facturas.', 'r2', { nivel: 3, pedidos: ['mp1'] });   // un proceso que empieza
  ctx.avisoPoner_(JUAN, 'claude_unido', { titulo: 'Botón de facturas' }, 'r3', { nivel: 3, pedidos: ['mp1'] });
  const l = avisos(), por = id => l.filter(x => x.id === id)[0];
  ok(por('r1').abre && /^Juan, /.test(por('r1').abre.primer_mensaje) && por('r1').abre_por === 'resultado_reciente',
    '1 · el cambio listo para unir de un pedido reciente abre la conversación: «' + (por('r1').abre || {}).primer_mensaje + '»');
  ok(!por('r2').abre && por('r2').abre_por === 'no_es_resultado', '1 · lo que apenas empieza no abre (' + por('r2').abre_por + ')');
  ok(!por('r3').abre && por('r3').abre_por === 'no_es_resultado', '1 · «ya quedó unido» (lo unió Juan) no es un resultado nuevo: no abre');
  ok(['claude_pregunta', 'claude_fallo'].every(t => ctx.abreEstado_({ tipo: t }) === 'accion') && ctx.abreEstado_({ tipo: 'claude_listo' }) === 'unir' &&
    ctx.abreEstado_({ tipo: 'escalar_entregado' }) === 'termino' && ctx.abreEstado_({ resultado: true, nivel: 3 }) === 'termino' &&
    ctx.abreEstado_({ resultado: true, nivel: 2 }) === 'accion' && ['huesped_espera', 'vuelo_aterrizo', 'vigilancia_paso', 'correo_respuesta'].every(t => ctx.abreEstado_({ tipo: t, resultado: true }) === ''),
    '1 · terminó, necesita unir o necesita a Juan; un huésped, un vuelo, una vigilancia o un correo no son el resultado de un pedido');
  const ctxJ = JSON.parse(por('r1').abre.contexto.replace(/^ALMA ABRE: /, ''));
  ok(ctxJ.alma_abre && ctxJ.alma_abre.pedido === 'Botón de facturas' && /una/.test(ctxJ.alma_abre.que_falta) && /end_call/.test(ctxJ.alma_abre.como_seguir),
    '1 · el contexto dice qué pedido es y qué falta («' + ctxJ.alma_abre.que_falta + '»), para que Alma siga la conversación');
}

/* 2. Los últimos 4 sí / el viejo no */
{
  const { ctx, avisos } = caja();
  ['mp1', 'ob2', 'ob3', 'mp4', 'ob5'].forEach(id => ctx.abrePedido_(JUAN.email, id));   // el 1 ya quedó atrás
  ctx.avisoPoner_(JUAN, 'claude_pregunta', { titulo: 'Reporte de limpieza', detalle: '¿Por propiedad o por día?' }, 'v1', { nivel: 2, pedidos: ['mp1'] });
  let l = avisos();
  ok(!l[0].abre && l[0].abre_por === 'pedido_viejo', '2 · el resultado de un pedido que ya no está entre los 4 más recientes no abre');
  ctx.avisoPoner_(JUAN, 'claude_pregunta', { titulo: 'Reporte de ocupación', detalle: '¿Con o sin Airbnb?' }, 'v2', { nivel: 2, pedidos: ['mp4'] });
  l = avisos();
  ok(l[0].abre && l[0].abre_por === 'resultado_reciente', '2 · el de uno de los 4 más recientes sí');
  ctx.abrePedido_(JUAN.email, 'mp1');   // Juan le agrega algo al pedido viejo: vuelve a ser reciente
  ctx.avisoPoner_(JUAN, 'claude_listo', { titulo: 'Reporte de limpieza' }, 'v3', { nivel: 2, pedidos: ['mp1'] });
  l = avisos();
  ok(l[0].abre, '2 · un ajuste al pedido viejo lo vuelve reciente');
  const s = ctx.abreLeer_();
  ok(s.p[JUAN.email].length === 4 && s.p[JUAN.email].join() === 'ob3,mp4,ob5,mp1', '2 · la fila guarda solo los 4 más recientes, el más nuevo al final: ' + s.p[JUAN.email].join(' · '));
}

/* 3. El principal sí / otro no */
{
  const { ctx, avisos } = caja();
  ctx.abrePedido_(GABY.email, 'ob9');
  ok(!ctx.abreLeer_().p[GABY.email], '3 · los pedidos de otro administrador no entran a la fila de Alma abre');
  ctx.vozAvisoPoner_(GABY, 'Ya terminé lo que me pediste de las llaves.', 'g1', { resultado: true, nivel: 3, pedidos: ['ob9'] });
  const l = avisos({ email: GABY.email });
  ok(l.length === 1 && !l[0].abre && l[0].abre_por === 'no_es_el_principal', '3 · a otro administrador Alma no le abre la conversación (' + l[0].abre_por + ')');
}

/* 4. Nunca dos veces, una por vuelta, nada viejo, tope, apagado, y solo donde la app puede abrir */
{
  const { ctx, props, avisos, pasa } = caja();
  ['ob1', 'ob2', 'ob3'].forEach(id => ctx.abrePedido_(JUAN.email, id));
  ctx.vozAvisoPoner_(JUAN, 'Ya revisé los pagos de octubre.', 'n1', { resultado: true, nivel: 3, pedidos: ['ob1'] });
  let l = avisos({ email: JUAN.email }, { hablado: 3 });   // la app no está en Modo calle ni en conferencia
  ok(l.length === 1 && !l[0].abre && !('abre_por' in l[0]) && ctx.abreLeer_().a.length === 0, '4 · sin abre = true (fuera de Modo calle o conferencia) no abre ni se marca: va la notificación de siempre');
  ctx.vozAvisoPoner_(JUAN, 'Ya revisé los pagos de octubre.', 'n1', { resultado: true, nivel: 3, pedidos: ['ob1'] });
  l = avisos();
  ok(l[0].abre, '4 · el mismo aviso, ya en Modo calle o conferencia, sí abre');
  ctx.vozAvisoPoner_(JUAN, 'Ya revisé los pagos de octubre.', 'n1', { resultado: true, nivel: 3, pedidos: ['ob1'] });
  l = avisos();
  ok(!l[0].abre && l[0].abre_por === 'ya_abierto', '4 · nunca dos veces el mismo aviso (' + l[0].abre_por + ')');
  ctx.vozAvisoPoner_(JUAN, 'Ya quedó la lista de llegadas.', 'n2', { resultado: true, nivel: 3, pedidos: ['ob2'] });
  ctx.vozAvisoPoner_(JUAN, 'Ya le escribí al equipo de limpieza.', 'n3', { resultado: true, nivel: 3, pedidos: ['ob3'] });
  l = avisos();
  ok(l.filter(x => x.abre).length === 1 && l[1].abre && l[0].abre_por === 'una_por_vuelta', '4 · dos en la misma vuelta: abre el más nuevo y el otro va como notificación de siempre');
  ctx.vozAvisoPoner_(JUAN, 'Ya revisé las facturas.', 'n4', { resultado: true, nivel: 3, pedidos: ['ob2'] });
  pasa(31 * 60000);
  l = avisos();
  ok(!l[0].abre && l[0].abre_por === 'ya_paso_tiempo', '4 · lo de hace más de 30 min (Juan estaba en otra llamada) ya no abre: queda para después');
  for (let i = 0; i < 8; i++) { ctx.vozAvisoPoner_(JUAN, 'Ya terminé la tarea ' + i + '.', 't' + i, { resultado: true, nivel: 3, pedidos: ['ob3'] }); avisos(); }
  ctx.vozAvisoPoner_(JUAN, 'Ya terminé otra más.', 't9', { resultado: true, nivel: 3, pedidos: ['ob3'] });
  l = avisos();
  ok(!l[0].abre && l[0].abre_por === 'tope_del_dia', '4 · ' + ctx.ABRE_TOPE_DIA_ + ' conversaciones en 24 h como mucho (cada una cuesta)');
  pasa(25 * 3600000);
  props.ALMA_ABRE_APAGADO = '1';
  ctx.vozAvisoPoner_(JUAN, 'Ya terminé.', 'z1', { resultado: true, nivel: 3, pedidos: ['ob3'] });
  l = avisos();
  ok(!l[0].abre, '4 · ALMA_ABRE_APAGADO = 1 lo apaga');
}

/* 5. Sin datos sensibles */
{
  const { ctx, avisos } = caja();
  ctx.abrePedido_(JUAN.email, 'mp7');
  ctx.avisoPoner_(JUAN, 'claude_fallo', { titulo: 'Contactos de recepción', detalle: 'no pude: llama al +502 5555-1234, escribe a ana@correo.com, código de acceso 4821#, ver https://github.com/x/y/pull/9' }, 's1', { nivel: 2, pedidos: ['mp7'] });
  const a = avisos()[0], todo = JSON.stringify(a.abre || {});
  ok(a.abre && !SUCIO.test(todo), '5 · ni teléfonos, ni correos, ni códigos, ni enlaces en el primer mensaje ni en el contexto');
  let j = null; try { j = JSON.parse(a.abre.contexto.replace(/^ALMA ABRE: /, '')); } catch (e) {}
  ok(j && Object.keys(j.alma_abre).sort().join() === 'como_seguir,datos,pedido,que_falta,que_paso,resultado' && a.abre.contexto.length < 1200,
    '5 · el contexto es JSON corto con solo pedido, resultado, qué falta, datos y cómo seguir (' + a.abre.contexto.length + ' letras)');
  ok(!/\b(Claudio|secretaria|PR)\b/.test(a.abre.primer_mensaje), '5 · el primer mensaje no nombra a Claudio, la secretaria ni el PR');
}

/* 6. De punta a punta: el segundo plano lleva su pedido; la llamada que abre el aviso lo cuenta como dicho */
{
  const { ctx, cache, mencionados, avisos } = caja();
  const id = ctx.orbitaEmpieza_(JUAN.email, 'Alma, revisa los pagos de Amalfi de octubre', 'segundo_plano', 'En fila');
  ok(ctx.abreLeer_().p[JUAN.email].indexOf(id) >= 0, '6 · el pedido que entra a la órbita entra a la fila de Alma abre');
  ctx.ORBITA_ACTUAL_ = { email: JUAN.email, ids: [id] };
  ctx.pendEncolar_(JUAN, 'revisa los pagos de Amalfi de octubre', 'Todo cuadra.', 'segundo_plano');
  ctx.ORBITA_ACTUAL_ = null;
  ctx.pendProcesar_();   // en otra ejecución (procesarCola): el pedido viaja en la cola
  const a = avisos()[0];
  ok(a && a.resultado && a.abre && /^Juan, /.test(a.abre.primer_mensaje), '6 · el resultado del segundo plano llega con su primer mensaje: «' + (a && a.abre || {}).primer_mensaje + '»');
  cache['vozret_' + JUAN.email] = 'rtSaludo';
  ctx.vozWebVincular_({ email: JUAN.email }, 'conv1', true, { aviso_id: a.id });
  ok(mencionados.join() === a.id && !cache['vozret_' + JUAN.email], '6 · la llamada que abrió el aviso lo cuenta como dicho (no vuelve en el saludo) y no el tema de retomar, que no se dijo');
  ctx.vozWebVincular_({ email: JUAN.email }, 'conv2', true, {});
  ok(mencionados.length === 1, '6 · una llamada normal sigue igual');
  ctx.ORBITA_ACTUAL_ = { email: JUAN.email, ids: ['obX'] };
  ok(ctx.abrePedidosDe_(GABY, {}).length === 0 && ctx.abrePedidosDe_(JUAN, {}).join() === 'obX' && ctx.abrePedidosDe_(JUAN, { pedidos: ['mp1'] }).join() === 'mp1',
    '6 · un aviso toma los pedidos de quien lo crea o, si no dice, los del segundo plano de esa persona');
}

/* 7. Los ganchos */
{
  const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
  const fn = (f, n) => { const s = src(f), i = s.indexOf('function ' + n + '('); return i < 0 ? '' : s.slice(i, s.indexOf('\nfunction ', i + 10)); };
  ok(/abrePedido_\(email, id\)/.test(fn('orbita.js', 'orbitaEmpieza_')), '7 · orbitaEmpieza_ anota el pedido de segundo plano');
  ok(/abrePedido_\(adm && adm\.email, m\.id\)/.test(fn('paraclaude.js', 'paraClaudeCrear_')), '7 · paraClaudeCrear_ anota el pedido de desarrollo (también lo que Alma escala)');
  ok(/pedidos: micro/.test(fn('paraclaude.js', 'paraClaudeAvisar_')) && /paraClaudeAvisar_\(titulo,[^\n]*String\(v\[i\]\[15\]/.test(src('paraclaude.js')), '7 · la respuesta de Claude lleva su microproyecto');
  ok((src('escalar.js').match(/pedidos: e(\.micro| && e\.micro)/g) || []).length === 2, '7 · lo que Alma escaló lleva su microproyecto (entregado, no unido, no publicado)');
  ok(/pedidos/.test(fn('pendientes.js', 'pendEncolar_')) && (fn('pendientes.js', 'pendCrear_').match(/pedidos: o\.pedidos/g) || []).length === 2, '7 · Pendientes lleva los pedidos hasta la notificación');
  ok(/abreAvisos_\(adm, mios, salida, b\)/.test(fn('voz.js', 'vozAvisos_')) && /abrePedidosDe_/.test(fn('voz.js', 'vozAvisoPoner_')), '7 · vozAvisos marca lo que abre y vozAvisoPoner_ guarda tipo y pedidos');
  ok(/tipo: tipo/.test(fn('avisotexto.js', 'avisoPoner_')), '7 · avisoPoner_ guarda el tipo de la notificación');
}

if (fallo) process.exit(1);
console.log('Todo bien: Alma abre la conversación solo con un resultado de un pedido reciente del principal.');
