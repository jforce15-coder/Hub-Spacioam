/* Prueba con dobles de Pendientes limpios (apps-script/pendlimpieza.js, issue #567 T2), sin Google, GitHub, Meta ni IA.
   16-nov-2026: en ALMA_PENDIENTES 85 de 163 tarjetas seguían abiertas; 3 «Necesita tu sí» tenían su tema cerrado (2 por
   cambios ya unidos), 6 eran el mismo aviso de entrega repetido y 67 avisos informativos nunca cambiaban de estado.
   Revisa:
   1. cada regla de cierre: tema cerrado, cambios (PR) unidos o cerrados, entrega (otro mensaje llegó después o hay una
      más nueva del mismo número) y «solo la última» (cupo), cada una con su motivo; lo que sigue abierto no se toca;
   2. la expiración por tipo (aviso 3 días, hecho 1, cupo 12 h, atención 30 días) con estado «vencido»;
   3. la re-pregunta: una pregunta sin respuesta 24 h se vuelve a preguntar UNA sola vez (nivel 2, por la notificación de
      siempre, sin abrir conversación), nunca de noche, con tope diario, también lo que Claudio pregunta;
   4. la respuesta en un toque: la tarjeta que trae opciones en su texto llega a la app con sus opciones;
   5. la corrida única PEND_LIMPIEZA_V1: respalda la hoja antes de tocar, cierra lo resuelto con motivo, deja el conteo en
      el registro y no se repite; la limpieza normal corre cada 15 min;
   6. microproyectos: una pregunta de Claudio cuyo PR ya se unió deja de esperar, y un PR muestra una sola tarjeta;
   7. unir ya no es de Juan (17-nov-2026, pc1794936657400): una tarjeta que pide unir o avisa un choque se cierra aunque
      el PR siga abierto; la corrida única PEND_LIMPIEZA_UNIR_V1 da por hechas las acciones «Unir el PR» y quita los temas
      por retomar de unir; Desarrollo solo entra a Pendientes si Claudio pregunta o no pudo.
   node .github/pendientes-limpios.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const H = 3600000, D = 24 * H, AHORA0 = Date.parse('2026-11-16T16:00:00Z');   // 10:00 en Guatemala
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true, tels: ['50255550000'] };
const REPO = 'https://github.com/jforce15-coder/Hub-Spacioam/pull/';

function hoja(cab, filas0) {
  const filas = [cab.slice()].concat(filas0 || []), log = [];
  return {
    filas, log, getLastRow: () => filas.length, getLastColumn: () => Math.max.apply(null, filas.map(r => r.length)),
    appendRow: r => filas.push(r.slice()),
    copyTo: () => { log.push('copia'); return { setName: n => { log.push('nombre:' + n); } }; },
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
      setValue: v => { log.push('set'); filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; },
      setValues: vs => vs.forEach((row, i) => { filas[r - 1 + i] = filas[r - 1 + i] || []; row.forEach((v, j) => { filas[r - 1 + i][c - 1 + j] = v; }); })
    })
  };
}

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, hojas = {}, avisos = [], temasCerrados = [], rets = [];
  let ahora = o.ahora || AHORA0;
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const ctx = {
    console: { log() {}, warn() {}, error: (...a) => { if (o.verErrores) console.log('  (error) ' + a.join(' ')); } }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, Error, isNaN, encodeURIComponent,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    hojaCrear_: (n, cab) => (hojas[n] = hojas[n] || hoja(cab)),
    ssAlma_: () => ({ getSheetByName: n => hojas[n] || null }),
    adminPorEmail_: e => (e === JUAN.email ? JUAN : null), esAdminPrincipal_: a => !!(a && a.principal),
    retCambiar_: (adm, fn) => { const l = (o.rets || []).slice(); fn(l); rets.push(l.map(x => x.id)); },
    adminsOp_: () => [JUAN], ACCIONES_CAB_: ['id', 'fecha', 'titulo', 'instruccion', 'enlace', 'estado', 'origen'],
    accionesHoja_: () => (hojas.ALMA_ACCIONES = hojas.ALMA_ACCIONES || hoja(['id', 'fecha', 'titulo', 'instruccion', 'enlace', 'estado', 'origen'], o.acciones || [])),
    retResolver_: () => {}, retPoner_: () => ({ id: 'rt1' }),
    temaFilas_: () => o.temas || [],
    temaTarjetaResuelta_: x => temasCerrados.push(String(x.id)),
    waEntrega_: w => (o.entregas || {})[String(w).slice(-8)] || null,
    cupoPermite_: () => o.cupo !== false,
    paraClaudePrInfo_: u => { const e = (o.prs || {})[u]; return e ? { url: u, estado: e } : null; },
    vozAvisoPoner_: (adm, texto, id, op) => avisos.push({ texto, id, op }),
    paraClaudeAvisar_: () => avisos.push({ unido: true }),
    temaCerrar_: () => ({ ok: true }),
    claudeNivel_: x => (String(x || '') === 'sencillo' ? 'sencillo' : 'complejo'), CLAUDE_MODELO_NIVEL_: { sencillo: 'S', complejo: 'O' },
    PARA_CLAUDE_REPO_: 'jforce15-coder/Hub-Spacioam',
    AREAS_: [{ k: 'proposito', n: 'Propósito' }],
    paraClaudePrincipalSes_: () => JUAN, paraClaudePendientes_: () => ({ ok: true, lista: [] }), vigTarjetas_: () => [],
    tituloCorto_: t => String(t || '')
  };
  vm.createContext(ctx);
  ['avisotexto.js', 'pendientes.js', 'pendlimpieza.js', 'microproyectos.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  const chat = leer('chat.js');
  vm.runInContext(/var CHAT_PREG_VINETA_ = [^\n]*/.exec(chat)[0] + '\n' + sacar(chat, 'chatOpciones_'), ctx, { filename: 'chat.js (extracto)' });
  return { ctx, props, hojas, avisos, temasCerrados, rets, mover: ms => { ahora += ms; }, ahora: () => ahora };
}
/* Una tarjeta como fila de ALMA_PENDIENTES. */
let nId = 0;
function tarjeta(c, x) {
  const f = Object.assign({ id: 'pd' + (++nId), ts: AHORA0 - H, email: JUAN.email, tipo: 'atencion', area: 'proposito', proyecto: '', titulo: 'Algo', resumen: '', detalle: '',
    tarjeta: '', acciones: '[]', estado: 'abierto', origen: 'segundo_plano', ret_id: '', importancia: 2, tema_id: '', motivo: '', repregunta: '' }, x);
  return c.ctx.PEND_CAB_.map(k => f[k]);
}
function conHoja(o, filas) {
  const c = caja(o); const sh = c.ctx.hojaPend_(); filas.forEach(f => sh.appendRow(tarjeta(c, f))); return c;
}
const fila = (c, id) => { const cab = c.ctx.PEND_CAB_, f = c.hojas.ALMA_PENDIENTES.filas.find(r => r[0] === id); const o = {}; cab.forEach((k, i) => { o[k] = f[i]; }); return o; };

/* ── 1 · Reglas de cierre, una por una (pendMotivoCierre_, sin internet) ── */
{
  const c = caja(), X = c.ctx, ahora = AHORA0;
  const base = x => Object.assign({ id: 'p', ts: ahora - 2 * H, tipo: 'atencion', estado: 'abierto', origen: 'segundo_plano', titulo: '', resumen: '', detalle: '', acciones: '[]', tarjeta: '', tema_id: '' }, x);
  const ctx = (extra) => Object.assign({ ahora, temas: {}, prs: {}, nueva: {}, entrega: () => null }, extra || {});
  let r = X.pendMotivoCierre_(base({ tema_id: 'tm1' }), ctx({ temas: { tm1: { estado: 'cerrado', resultado: 'Cambio unido' } } }));
  ok(r && r.estado === 'resuelto' && /su tema se cerró: Cambio unido/.test(r.motivo), '1 · tema cerrado → resuelta con su motivo (' + (r && r.motivo) + ')');
  ok(!X.pendMotivoCierre_(base({ tema_id: 'tm1' }), ctx({ temas: { tm1: { estado: 'abierto' } } })), '1 · tema abierto → sigue abierta');
  const prs = X.pendPrsDe_(base({ resumen: 'Dos PRs ya están unidos. El #555 necesita la llave y Hub #541 actualizarse; App #76 también.', detalle: 'ver ' + REPO + '558' }));
  ok([555, 541, 558].every(n => prs.includes(REPO + n)) && prs.includes('https://github.com/jforce15-coder/alma-app/pull/76') && prs.length === 4, '1 · lee los PR: enlace, «Hub #541», «App #76» y «#555» junto a unir/PR (' + prs.length + ')');
  ok(X.pendPrsDe_(base({ resumen: 'Confirmar socios de Narama #633 y Rue 3301.' })).length === 0, '1 · un «#633» sin hablar de unir ni de PR no es un cambio');
  const conPrs = base({ resumen: 'Revisa Hub #555 y Hub #541 antes de unir.' });
  r = X.pendMotivoCierre_(conPrs, ctx({ prs: { [REPO + '555']: { estado: 'unido' }, [REPO + '541']: { estado: 'cerrado' } } }));
  ok(r && r.estado === 'resuelto' && /se unieron/.test(r.motivo), '1 · todos sus PR unidos o cerrados → resuelta («' + (r && r.motivo) + '»)');
  const revisa = base({ resumen: 'Revisa Hub #555 y Hub #541 antes de decidir la tarifa.' });
  ok(!X.pendMotivoCierre_(revisa, ctx({ prs: { [REPO + '555']: { estado: 'unido' }, [REPO + '541']: { estado: 'abierto' } } })), '1 · un PR todavía abierto (y la tarjeta no pide unir) → sigue abierta');
  ok(!X.pendMotivoCierre_(revisa, ctx({ prs: { [REPO + '555']: { estado: 'unido' } } })), '1 · un PR que GitHub no contestó → sigue abierta (sin adivinar)');
  r = X.pendMotivoCierre_(conPrs, ctx({ prs: { [REPO + '555']: { estado: 'unido' }, [REPO + '541']: { estado: 'abierto' } } }));
  ok(r && r.estado === 'resuelto' && /era para unir/.test(r.motivo), '7 · pedía unir con un PR todavía abierto → resuelta (lo une Claudio): «' + (r && r.motivo) + '»');
  [['Unir el PR: Botón de pagos', REPO + '600'], ['Cambio por revisar', 'No pude unir sola el cambio: choca con lo último de main. ' + REPO + '601'], ['Hay 3 cambios por unir', ''], ['Únelo', 'Hub #602']].forEach(([t, d]) => {
    const q = X.pendMotivoCierre_(base({ titulo: t, detalle: d }), ctx());
    ok(q && /era para unir/.test(q.motivo), '7 · «' + t + '» → resuelta sin preguntar a GitHub');
  });
  ok(!X.pendMotivoCierre_(base({ origen: 'socio', resumen: 'El socio pide unir Hub #603 con su reporte.' }), ctx()), '7 · un pedido de socio no se toca aunque diga unir');
  ok(!X.pendMotivoCierre_(base({ resumen: '¿Unimos los dos apartamentos en una sola reserva?' }), ctx()), '7 · «unir» sin un cambio nombrado no es de unir PR');
  const ent = n => base({ id: 'e' + n, origen: 'entrega', ts: ahora - n * H, detalle: 'No le llegó tu mensaje a Recepción (+50255551234): bloqueada.' });
  r = X.pendMotivoCierre_(ent(5), ctx({ nueva: { 'entrega:55551234': 'e1' } }));
  ok(r && /repetida/.test(r.motivo), '1 · entrega: hay una más nueva del mismo número → la vieja se cierra');
  ok(!X.pendMotivoCierre_(ent(1), ctx({ nueva: { 'entrega:55551234': 'e1' } })), '1 · entrega: la más nueva se queda');
  r = X.pendMotivoCierre_(ent(1), ctx({ nueva: { 'entrega:55551234': 'e1' }, entrega: () => ({ estado: 'read', ts: ahora - 10 * 60000 }) }));
  ok(r && /ya le llegó/.test(r.motivo), '1 · entrega: Meta entregó otro mensaje a ese número después → resuelta');
  ok(!X.pendMotivoCierre_(ent(1), ctx({ nueva: { 'entrega:55551234': 'e1' }, entrega: () => ({ estado: 'delivered', ts: ahora - 3 * H }) })), '1 · entrega: lo entregado ANTES de la tarjeta no la cierra');
  r = X.pendMotivoCierre_(base({ id: 'c1', tipo: 'aviso', origen: 'cupo', ts: ahora - 2 * H }), ctx({ nueva: { cupo: 'c2' } }));
  ok(r && /reemplazada/.test(r.motivo), '1 · cupo: solo vale la última, la anterior queda reemplazada');
  ok(!X.pendMotivoCierre_(base({ estado: 'resuelto', tema_id: 'tm1' }), ctx({ temas: { tm1: { estado: 'cerrado' } } })), '1 · lo que ya no está abierto no se toca');
  const nuevas = X.pendMasNuevas_([ent(5), ent(1), ent(3), base({ id: 'c1', tipo: 'aviso', origen: 'cupo', ts: ahora - 5 * H }), base({ id: 'c2', tipo: 'aviso', origen: 'cupo', ts: ahora - H })]);
  ok(nuevas['entrega:55551234'] === 'e1' && nuevas.cupo === 'c2', '1 · la más nueva por número y la última del cupo');
}

/* ── 2 · Expiración por tipo ── */
{
  const c = caja(), X = c.ctx, ahora = AHORA0, cx = { ahora, temas: {}, prs: {}, nueva: {} };
  ok(X.PEND_VENCE_H_.aviso === 72 && X.PEND_VENCE_H_.hecho === 24 && X.PEND_VENCE_H_.atencion === 720 && X.PEND_VENCE_ORIGEN_H_.cupo === 12, '2 · constantes: aviso 3 días, hecho 1, atención 30, cupo 12 h');
  const v = (tipo, h, origen) => X.pendMotivoCierre_({ id: 'v', tipo, ts: ahora - h * H, estado: 'abierto', origen: origen || 'segundo_plano', titulo: '', resumen: '', detalle: '', acciones: '[]' }, cx);
  ok(v('aviso', 73) && v('aviso', 73).estado === 'vencido' && !v('aviso', 71), '2 · «Para leer» vence a los 3 días (' + (v('aviso', 73) || {}).motivo + ')');
  ok(v('hecho', 25) && !v('hecho', 23), '2 · «Listo hoy» vence al día');
  ok(v('aviso', 13, 'cupo') && !v('aviso', 11, 'cupo'), '2 · el aviso del cupo vence a las 12 h');
  ok(v('atencion', 721) && v('atencion', 721).estado === 'vencido' && /sin respuesta en 30 días/.test(v('atencion', 721).motivo) && !v('atencion', 700), '2 · «Necesita tu sí» vence a los 30 días, como siempre, ahora con su estado');
  ok(/pendVenceH_\(x\) \* 3600000/.test(leer('pendientes.js')), '2 · Notificaciones usa los mismos días por tipo (pendVenceH_)');
}

/* ── 3 · Re-pregunta única ── */
{
  const preg = { ts: AHORA0 - 25 * H, titulo: 'Tarifa de limpieza', resumen: '¿La cobramos por noche o por estadía?', detalle: '¿La cobramos por noche o por estadía?\n• Por noche\n• Por estadía', origen: 'segundo_plano' };
  const c = conHoja({}, [preg, { ts: AHORA0 - 3 * H, titulo: 'Reciente', resumen: '¿Lo hago?', origen: 'segundo_plano' }, { ts: AHORA0 - 30 * H, origen: 'entrega', resumen: '¿Otra vía?', detalle: 'No llegó (+50255551234)' }]);
  const id = c.hojas.ALMA_PENDIENTES.filas[1][0];
  let r = c.ctx.pendRepreguntar_(AHORA0);
  const a = c.avisos[0] || { op: {} };
  ok(r.hechas === 1 && r.id === id && c.avisos.length === 1, '3 · la pregunta de hace 25 h se vuelve a preguntar (la de 3 h y la de entrega no)');
  ok(a.op.tipo === 'pend_repregunta' && a.op.nivel === 2 && a.id === id && /sigo esperando/.test(a.texto) && /Tarifa de limpieza/.test(a.texto) && (a.op.datos || []).some(d => /Por noche · Por estadía/.test(d)),
    '3 · por la notificación de siempre, nivel 2, con su id y sus opciones: «' + a.texto + '»');
  ok(fila(c, id).repregunta, '3 · queda marcada en la tarjeta');
  r = c.ctx.pendRepreguntar_(AHORA0 + 2 * H);
  ok(r.hechas === 0 && c.avisos.length === 1, '3 · una sola vez: la siguiente pasada no la repite');
  const abre = leer('almaabre.js'), resultado = /var ABRE_RESULTADO_ = \{[^}]*\}/.exec(abre)[0];
  ok(!/pend_repregunta/.test(resultado), '3 · no abre una conversación de ElevenLabs (no es un resultado: almaabre.js)');
  const n = conHoja({}, [preg]);
  ok(n.ctx.pendRepreguntar_(Date.parse('2026-11-17T04:00:00Z')).hechas === 0 && n.avisos.length === 0, '3 · de noche (22:00 en Guatemala) no pregunta');
  const t = conHoja({ props: { PEND_REPREGUNTA_HIST: JSON.stringify([AHORA0 - 3 * H, AHORA0 - 6 * H, AHORA0 - 9 * H]) } }, [preg]);
  ok(t.ctx.pendRepreguntar_(AHORA0).por === 'tope del día', '3 · tope de ' + t.ctx.PEND_REPREGUNTA_DIA_ + ' re-preguntas en 24 h');
  const e = conHoja({ props: { PEND_REPREGUNTA_HIST: JSON.stringify([AHORA0 - H]) } }, [preg]);
  ok(e.ctx.pendRepreguntar_(AHORA0).por === 'muy seguido' && e.ctx.pendRepreguntar_(AHORA0 + 70 * 60000).hechas === 1, '3 · espaciadas: al menos ' + e.ctx.PEND_REPREGUNTA_ENTRE_MIN_ + ' min entre una y otra (nada de ráfagas)');
  const v = conHoja({}, [Object.assign({}, preg, { ts: AHORA0 - 9 * D })]);
  ok(v.ctx.pendRepreguntar_(AHORA0).hechas === 0, '3 · lo de hace más de 7 días no se revive');
  /* Lo que Claudio pregunta (microproyecto): también una sola vez. */
  const m = caja(), sh = m.ctx.microHoja_(), cab = m.ctx.MICRO_CAB_;
  const mp = { id: 'mp1', nombre: 'Botón de facturas', estado: 'Claude pregunta', creado: AHORA0 - 30 * H, actualizado: AHORA0 - 26 * H, quien: JUAN.email, ultima_pregunta: '¿Arriba o abajo?', opciones: '["Arriba","Abajo"]', ajustes: '[]' };
  sh.appendRow(cab.map(k => (k in mp ? mp[k] : '')));
  r = m.ctx.pendRepreguntar_(AHORA0);
  ok(r.hechas === 1 && r.id === 'mp:mp1' && m.ctx.pendRepreguntar_(AHORA0 + H).hechas === 0 && JSON.parse(m.props.PEND_REPREG_MICRO).mp1, '3 · lo que Claudio pregunta en un microproyecto: una vez, con su marca');
}

/* ── 4 · Respuesta en un toque: las opciones del texto llegan como tarjeta de pregunta ── */
{
  const c = conHoja({}, [{ titulo: 'Guardar equipaje', resumen: '¿Cuál cierro?', detalle: 'Encontré dos tareas. ¿Cuál cierro?\n• La de hoy\n• La de mañana' }, { titulo: 'Sin opciones', resumen: 'Revisa esto.' }]);
  const items = c.ctx.pendItems_({}, JUAN), con = items.find(x => x.titulo === 'Guardar equipaje'), sin = items.find(x => x.titulo === 'Sin opciones');
  ok(con && con.tarjeta && con.tarjeta.tipo === 'pregunta' && con.tarjeta.opciones.join('|') === 'La de hoy|La de mañana' && con.responder, '4 · la tarjeta trae sus opciones: un toque responde (' + (con && con.tarjeta && con.tarjeta.opciones.join(' · ')) + ')');
  ok(sin && !sin.tarjeta, '4 · sin opciones, sin tarjeta de pregunta («Responder» de siempre)');
}

/* ── 5 · Corrida única PEND_LIMPIEZA_V1 y la limpieza cada 15 min ── */
{
  const temas = [{ id: 'tmC', estado: 'cerrado', resultado: 'Listo' }, { id: 'tmA', estado: 'abierto' }];
  const filas = [
    { titulo: 'Tema cerrado', tema_id: 'tmC', ts: AHORA0 - 3 * H, ret_id: 'rt9' },
    { titulo: 'Tema abierto', tema_id: 'tmA', ts: AHORA0 - 3 * H },
    { titulo: 'PR unidos', resumen: 'Revisa Hub #555 antes de unir.', ts: AHORA0 - 3 * H },
    { titulo: 'PR abierto', resumen: 'Une Hub #562.', ts: AHORA0 - 3 * H },
    { titulo: 'PR por decidir', resumen: 'Revisa Hub #562 y dime qué tarifa dejamos.', ts: AHORA0 - 3 * H },
    { titulo: 'Entrega vieja', origen: 'entrega', detalle: '(+50255551234)', ts: AHORA0 - 40 * H },
    { titulo: 'Entrega nueva', origen: 'entrega', detalle: '(+50255551234)', ts: AHORA0 - 2 * H },
    { titulo: 'Aviso viejo', tipo: 'aviso', ts: AHORA0 - 10 * D },
    { titulo: 'Hecho de ayer', tipo: 'hecho', ts: AHORA0 - 30 * H },
    { titulo: 'Cupo viejo', tipo: 'aviso', origen: 'cupo', ts: AHORA0 - 5 * H },
    { titulo: 'Cupo nuevo', tipo: 'aviso', origen: 'cupo', ts: AHORA0 - 1 * H },
    { titulo: 'Aviso de hoy', tipo: 'aviso', ts: AHORA0 - 2 * H },
    { titulo: 'Ya resuelta', estado: 'resuelto', tema_id: 'tmC' }
  ];
  const c = conHoja({ temas, prs: { [REPO + '555']: 'unido', [REPO + '562']: 'abierto' }, rets: [{ id: 'rt9' }, { id: 'rt8' }] }, filas);
  const sh = c.hojas.ALMA_PENDIENTES, antes = sh.log.length;
  const r = c.ctx.pendLimpiar_();
  const est = t => { const f = sh.filas.find(x => x[6] === t); return f[c.ctx.PEND_CAB_.indexOf('estado')] + ' · ' + f[c.ctx.PEND_CAB_.indexOf('motivo')]; };
  ok(sh.log[antes] === 'copia' && sh.log[antes + 1] === 'nombre:ALMA_PENDIENTES_RESPALDO_V1', '5 · respaldo en ALMA_PENDIENTES_RESPALDO_V1 antes de tocar nada');
  const cerradas = ['Tema cerrado', 'PR unidos', 'PR abierto', 'Entrega vieja', 'Aviso viejo', 'Hecho de ayer', 'Cupo viejo'], siguen = ['Tema abierto', 'PR por decidir', 'Entrega nueva', 'Cupo nuevo', 'Aviso de hoy'];
  ok(cerradas.every(t => /^(resuelto|vencido) · \S/.test(est(t))), '5 · cierra con motivo lo ya resuelto o vencido: ' + cerradas.map(t => t + ' → ' + est(t)).join(' | '));
  ok(siguen.every(t => /^abierto · $/.test(est(t))) && /^resuelto · $/.test(est('Ya resuelta')), '5 · lo que sigue vivo (y lo que ya estaba cerrado) no se toca');
  ok(r.v1 && r.v1.total === 7 && /7 cerradas/.test(c.props.PEND_LIMPIEZA_V1) && JSON.parse(c.props.PEND_LIMPIEZA_REGISTRO).PEND_LIMPIEZA_V1.cuenta.total === 7, '5 · conteo en el registro: ' + JSON.stringify(r.v1));
  ok(c.rets.some(l => l.indexOf('rt9') < 0 && l.indexOf('rt8') >= 0) && c.temasCerrados.length >= 2, '5 · lo que esperaba a Juan suelta su tema por retomar y su tema');
  const copias = () => sh.log.filter(x => x === 'copia').length;
  ok(c.ctx.pendLimpiar_() === null, '5 · la limpieza normal no corre antes de 15 min');
  c.mover(16 * 60000); const r2 = c.ctx.pendLimpiar_();
  ok(r2 && !r2.v1 && copias() === 1 && r2.cuenta.total === 0, '5 · la corrida única no se repite (un solo respaldo) y después solo limpia lo nuevo');
  const sinCupo = conHoja({ cupo: false, prs: { [REPO + '555']: 'unido' } }, [{ titulo: 'PR unidos', resumen: 'Revisa Hub #555 antes de decidir.' }]);
  sinCupo.ctx.pendLimpiar_();
  ok(/^abierto/.test(sinCupo.hojas.ALMA_PENDIENTES.filas[1][sinCupo.ctx.PEND_CAB_.indexOf('estado')]), '5 · con el cupo de Google alto no pregunta a GitHub (la tarjeta espera)');
  ok(/cupoFuncion_\('pendLimpiar_'\); try \{ pendLimpiar_\(\); \}/.test(leer('Código.js')), '5 · procesarCola la llama con su nombre (cupoFuncion_)');
}

/* ── 6 · Microproyectos: la pregunta con su PR unido deja de esperar; un PR, una tarjeta ── */
{
  const mk = (c, m) => { const sh = c.ctx.microHoja_(); sh.appendRow(c.ctx.MICRO_CAB_.map(k => (k in m ? m[k] : ''))); };
  const base = { quien: JUAN.email, creado: AHORA0 - 5 * H, ajustes: '[]', opciones: '[]' };
  const c = caja({ prs: { [REPO + '541']: 'unido', [REPO + '562']: 'abierto' } });
  mk(c, Object.assign({ id: 'mpA', nombre: 'Unir todo', estado: 'Claude pregunta', actualizado: AHORA0 - H, pr: REPO + '541', ultima_pregunta: '¿Uno los dos?' }, base));
  mk(c, Object.assign({ id: 'mpB', nombre: 'Chat viejo', estado: 'listo para unir', actualizado: AHORA0 - 3 * H, pr: REPO + '562' }, base));
  mk(c, Object.assign({ id: 'mpC', nombre: 'Chat', estado: 'listo para unir', actualizado: AHORA0 - 2 * H, pr: REPO + '562' }, base));
  const t = c.ctx.microTarjetas_(JUAN);
  ok(!t.some(x => x.micro === 'mpA' && x.estado === 'pregunta') && c.ctx.microLeer_('mpA').estado === 'unido' && !c.avisos.some(a => a.unido), '6 · Claudio preguntaba y Juan ya unió su PR: deja de preguntar, queda unido y sin otro aviso');
  ok(t.filter(x => (x.enlaces || []).indexOf(REPO + '562') >= 0).length === 1 && t.some(x => x.micro === 'mpC'), '6 · dos microproyectos con el mismo PR: una sola tarjeta, la más reciente');
}

/* ── 7 · Unir ya no es de Juan: la corrida única PEND_LIMPIEZA_UNIR_V1 y Desarrollo en Pendientes ── */
{
  const acciones = [['ac1', '2026-11-15 10:00', 'Unir el PR: Botón de pagos', 'Claudio dejó listo este cambio.', REPO + '600', 'pendiente', 'claude'],
    ['ac2', '2026-11-15 11:00', 'Aprobar la factura', 'Ábrela y apruébala.', 'https://x.y/f', 'pendiente', 'claude'],
    ['ac3', '2026-11-14 11:00', 'Unir el PR: Viejo', '', REPO + '590', 'completada', 'claude']];
  const rets = [{ id: 'rt1', origen: 'claude', texto: 'Ya quedó listo el cambio para «X»; solo falta que lo unas para que se publique.' },
    { id: 'rt2', origen: 'claude', texto: 'Revisé lo que me pediste de «Y» y tengo una duda antes de seguir.' },
    { id: 'rt3', origen: 'segundo_plano', texto: 'Hay 2 cambios por unir.' }];
  const c = conHoja({ props: { PEND_LIMPIEZA_V1: 'ya' }, acciones, rets, prs: { [REPO + '562']: 'abierto' } }, [
    { id: 'u1', titulo: 'Unir', resumen: 'Une Hub #562 cuando puedas.', ts: AHORA0 - 5 * D },
    { id: 'u2', titulo: 'Decidir', resumen: '¿Cuál tarifa dejamos para Rue?', ts: AHORA0 - 2 * D }]);
  const r = c.ctx.pendLimpiar_();
  const est = id => fila(c, id).estado + ' · ' + fila(c, id).motivo;
  ok(r.unir && /^resuelto · era para unir/.test(est('u1')) && /^abierto/.test(est('u2')), '7 · corrida única: lo viejo de unir se cierra con su motivo y lo que pide a Juan se queda (' + est('u1') + ')');
  const ac = c.hojas.ALMA_ACCIONES.filas;
  ok(ac[1][5] === 'completada' && ac[2][5] === 'pendiente' && r.unir.acciones === 1, '7 · las acciones «Unir el PR» quedan hechas; las demás no se tocan');
  ok(c.rets.some(l => l.indexOf('rt1') < 0 && l.indexOf('rt2') >= 0 && l.indexOf('rt3') >= 0) && r.unir.retomar === 1, '7 · sale el tema por retomar de «solo falta que lo unas» (de Claude); lo demás se queda');
  ok(/1 acciones · 1 por retomar/.test(c.props.PEND_LIMPIEZA_UNIR_V1) && JSON.parse(c.props.PEND_LIMPIEZA_REGISTRO).PEND_LIMPIEZA_UNIR_V1, '7 · deja su marca y el conteo en el registro: ' + c.props.PEND_LIMPIEZA_UNIR_V1);
  c.mover(16 * 60000); const r2 = c.ctx.pendLimpiar_();
  ok(r2 && r2.unir === null, '7 · la corrida única de unir no se repite');
  const S = c.ctx.pendDesarrolloSeccion_;
  ok(S({ estado: 'pregunta' }) === 'atencion' && S({ estado: 'fallo' }) === 'atencion', '7 · Desarrollo en Pendientes: Claudio pregunta o no pudo');
  ok(['listo', 'revisando', 'trabajando', 'publicando', 'fallo_pub'].every(e => S({ estado: e, unir: ['u'] }) === 'leer') && S({ estado: 'fallo', pr: true }) === 'leer' && S({ estado: 'publicado' }) === 'listo',
    '7 · listo para unir, un choque, un PR suelto que falla o una publicación que falló: a Notificaciones, no a Pendientes');
}

process.exit(fallo);
