/* Ajustes de notificaciones por tipo (#551, apps-script/notifajustes.js) con dobles: sin hoja, sin OneSignal, sin Google.
   Juan, 16-nov-2026: ajustes como los de WhatsApp en iOS, por tipo (urgentes, huéspedes, equipo, socios y pendientes de
   Alma), guardados por usuario en el Hub, que la app de Alma aplica al armar cada notificación y el Hub web respeta.
   1. Clasificación: cada notificación cae en UN tipo, y solo notifTipo_ lo decide (lo urgente primero, salvo conferencia).
   2. Ajustes por usuario: sin sesión no hay nada; cada quien guarda los suyos (con su alterno, el del administrador); lo
      que no sirve queda de fábrica; las etiquetas de OneSignal quedan al día (si · oculto · no) sin tocar a nadie más.
   3. Lo que la app recibe (vozAvisos): el tipo de cada aviso, los ajustes de quien pregunta y el número del ícono solo con
      los tipos que lo tienen encendido.
   4. Hub web (pushA_ y pushNuevo_): quien lo apagó no lo recibe, quien lo ocultó recibe «Alma te dejó un mensaje» y, si
      nadie cambió ese tipo, el envío es exactamente el de antes.
   5. Los ganchos en el código y la pantalla (alma/avisos.html) con los componentes de Ajustes.
   6. «Probar con Siri» (16-nov-2026): solo el principal con su sesión; la prueba llega a la app sin voz ni historial.
   7. Los pasos del anillo (16-nov-2026): llegan con vozAvisos, se guardan los últimos 30 por usuario, con origen «app» y
      sin datos personales.
   8. Conversación continua en Modo calle y conferencia (16-nov-2026): sin despedidas y sin colgar; la app cierra sola
      tras un silencio (los segundos van en la ficha).
   node .github/notif-ajustes.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const JUAN = { email: 'juan@x.com', nombre: 'Juan Ovalle', principal: true, tels: ['50200000000'], alternos: ['juan.alterno@x.com'] };
const ANA = { email: 'ana@x.com', nombre: 'Ana', principal: false, tels: [], alternos: [] };

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, llamadas = [], logs = [];
  const lock = { tryLock: () => true, waitLock() {}, releaseLock() {} };
  const resp = (code, j) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(j || {}) });
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; }, getAll: () => ({}), putAll() {} }) },
    LockService: { getScriptLock: () => lock, getUserLock: () => lock },
    Utilities: { base64EncodeWebSafe: b => Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64url'),
      computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(String(t)).digest()), DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }) }) }) },
    CFG: { HUB_URL: 'https://hub.x', TZ: 'America/Guatemala' },
    uf_: (url, op) => { const b = op && op.payload ? JSON.parse(op.payload) : null; llamadas.push({ url, metodo: op && op.method, auth: op && op.headers && op.headers.Authorization, body: b }); return resp(200, { id: 'n' + llamadas.length, recipients: 1 }); },
    adminsOp_: () => [JUAN, ANA], adminPorEmail_: e => [JUAN, ANA].filter(a => a.email === String(e).toLowerCase())[0] || null,
    esAdminPrincipal_: a => !!(a && a.principal), vozColaLock_: () => lock,
    paraClaudePrincipalSes_: s => { const a = s && s.email ? [JUAN, ANA].filter(x => x.email === String(s.email).toLowerCase() || x.alternos.indexOf(String(s.email).toLowerCase()) >= 0)[0] : null; return a && a.principal ? a : null; },
    retClave_: a => 'VOZ_RET_' + a.email.replace(/\W/g, ''), retLeer_: () => o.rets || [], retMencionado_() {},
    pendFilas_: () => [], normTel_: t => String(t), tituloCorto_: (t, n) => String(t || '').slice(0, n),
    hojaCrear_: () => ({ getLastColumn: () => 15, appendRow() {}, getLastRow: () => 1, getRange: () => ({ setValues() {} }) }),
    sinEmoji_: s => String(s || ''), s_: x => (x == null ? '' : String(x)), logPush_: (...a) => logs.push(a)
  };
  vm.createContext(ctx);
  ['avisotexto.js', 'calle.js', 'voz.js', 'orbita.js', 'pendientes.js', 'almaabre.js', 'notifajustes.js', 'anillo.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  /* pushA_ y pushNuevo_, sacadas de Código.js tal cual */
  const COD = leer('Código.js');
  const sacar = n => { const m = new RegExp('\\nfunction ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(COD); if (!m) throw new Error('no encontré ' + n + ' en Código.js'); return m[0]; };
  vm.runInContext(sacar('pushA_') + '\n' + sacar('pushNuevo_'), ctx, { filename: 'Código.js (push)' });
  return { ctx, props, llamadas, logs };
}

/* ── 1. Clasificación ── */
{
  const { ctx } = caja();
  const T = a => ctx.notifTipo_(a);
  const casos = [
    [{ tipo: 'huesped_espera', nivel: 1 }, 'urgentes', 'un huésped esperando al equipo (nivel 1) es urgente'],
    [{ tipo: 'promesa_vencida', nivel: 1 }, 'urgentes', 'una promesa vencida (nivel 1) es urgente'],
    [{ tipo: 'vigilancia_paso', nivel: 1 }, 'urgentes', 'lo que vigilaba y pasó (nivel 1) es urgente'],
    [{ tipo: 'huesped_espera', nivel: 2 }, 'huespedes', 'un huésped sin urgencia va a Huéspedes'],
    [{ origen: 'decision', nivel: 2 }, 'huespedes', 'una decisión del equipo sobre un huésped va a Huéspedes'],
    [{ origen: 'reserva' }, 'huespedes', 'un cambio de reserva va a Huéspedes'],
    [{ origen: 'mensaje' }, 'huespedes', 'un mensaje nuevo de un huésped va a Huéspedes'],
    [{ origen: 'socio', nivel: 2 }, 'socios', 'lo que pide un socio va a Socios'],
    [{ origen: 'chat', nivel: 2 }, 'equipo', 'alguien del equipo que pide un cambio va a Equipo'],
    [{ origen: 'encargo' }, 'equipo', 'un encargo cumplido va a Equipo'],
    [{ origen: 'recepcion' }, 'equipo', 'un WhatsApp de Recepción va a Equipo'],
    [{ tipo: 'claude_listo', nivel: 2 }, 'pendientes', 'un cambio por unir va a Pendientes de Alma'],
    [{ tipo: 'correo_respuesta', nivel: 2 }, 'pendientes', 'un correo va a Pendientes de Alma'],
    [{ tipo: 'vuelo_aterrizo', nivel: 3 }, 'pendientes', 'un aviso de vuelo va a Pendientes de Alma'],
    [{ origen: 'segundo_plano', nivel: 3 }, 'pendientes', 'lo que terminó en segundo plano va a Pendientes de Alma'],
    [{ origen: 'conferencia', conferencia: true, nivel: 1 }, 'pendientes', 'lo que él pidió en conferencia (nivel 1) no cuenta como urgente'],
    [{}, 'pendientes', 'sin nada que lo ubique: Pendientes de Alma'],
    [null, 'pendientes', 'sin aviso: Pendientes de Alma']
  ];
  casos.forEach(([a, k, m]) => ok(T(a) === k, '1 · ' + m + ' (' + T(a) + ')'));
  const tipos = ctx.NOTIF_TIPOS_.map(t => t.k);
  ok(JSON.stringify(tipos) === JSON.stringify(['urgentes', 'huespedes', 'equipo', 'socios', 'pendientes']), '1 · los 5 tipos de Juan, en su orden');
  /* Cada tipo de avisotexto.js cae en uno de los 5, con su nivel de siempre */
  const ts = (leer('avisotexto.js').match(/case '([a-z_]+)'/g) || []).map(x => x.slice(6, -1));
  ok(ts.length > 15 && ts.every(t => tipos.indexOf(T({ tipo: t, nivel: 2 })) >= 0), '1 · cada notificación de avisotexto.js tiene su tipo (' + ts.length + ')');
  /* Un solo lugar: nadie más decide el tipo por su cuenta */
  const otros = fs.readdirSync(DIR).filter(f => /\.js$/.test(f) && f !== 'notifajustes.js').filter(f => /function notifTipo_|NOTIF_ORIGEN_\s*=/.test(leer(f)));
  ok(!otros.length, '1 · notifTipo_ es el único lugar que clasifica' + (otros.length ? ': también ' + otros.join(', ') : ''));
}

/* ── 2. Ajustes por usuario ── */
{
  const { ctx, props, llamadas } = caja({ props: { ONESIGNAL_APP_ID: 'app1', ONESIGNAL_KEY: 'os_v2_prueba' } });
  ok(!ctx.notifAjustesApi_(null).ok && !ctx.notifAjustesGuardarApi_(null, { tipo: 'huespedes', ajuste: { sonido: false } }).ok && !props.NOTIF_AJUSTES,
    '2 · sin sesión (la llave vieja del Hub) no se lee ni se guarda nada');
  ok(!ctx.notifAjustesApi_({}).ok && !ctx.notifAjustesApi_({ email: '  ' }).ok, '2 · sin correo en la sesión, tampoco');
  const l = ctx.notifAjustesApi_({ email: JUAN.email });
  const h = l.tipos.filter(t => t.k === 'huespedes')[0], u = l.tipos.filter(t => t.k === 'urgentes')[0];
  ok(l.ok && l.tipos.length === 5 && h.nombre === 'Huéspedes' && h.que && h.ajuste.bloqueada && h.ajuste.centro && h.ajuste.banner && h.ajuste.sonido && h.ajuste.numero && !h.ajuste.siri && h.ajuste.vista === 'siempre' && h.ajuste.agrupar === 'auto' && u.ajuste.siri,
    '2 · de fábrica todo llega como hoy, y Siri solo en Urgentes');
  ok(!ctx.notifAjustesGuardarApi_({ email: JUAN.email }, { tipo: 'clima', ajuste: {} }).ok, '2 · un tipo que no existe no se guarda');
  const g = ctx.notifAjustesGuardarApi_({ email: 'Juan.Alterno@x.com' }, { tipo: 'huespedes', ajuste: { banner: false, sonido: false, siri: true, vista: 'nunca', agrupar: 'tipo', numero: 'si', raro: 'x', bloqueada: 1 } });
  const guardado = JSON.parse(props.NOTIF_AJUSTES || '{}');
  ok(g.ok && guardado[JUAN.email] && !guardado['juan.alterno@x.com'], '2 · con su correo alterno se guarda en el del administrador');
  const gh = (guardado[JUAN.email] || {}).huespedes || {};
  ok(gh.banner === false && gh.sonido === false && gh.siri === true && gh.vista === 'nunca' && gh.agrupar === 'tipo' && gh.numero === true && gh.bloqueada === true && !('raro' in gh),
    '2 · solo las llaves conocidas, con su tipo; lo que no sirve queda de fábrica');
  ok(ctx.notifAjustesDe_(ANA.email).huespedes.banner === true && ctx.notifAjustesDe_(JUAN.email).equipo.banner === true, '2 · los de Juan no tocan los de Ana ni los otros tipos de Juan');
  ctx.notifAjustesGuardarApi_({ email: ANA.email }, { tipo: 'equipo', ajuste: { bloqueada: false, centro: false, banner: false } });
  ok(ctx.notifAjustesDe_(JUAN.email).huespedes.vista === 'nunca' && !ctx.notifLlega_(ctx.notifAjustesDe_(ANA.email).equipo), '2 · cada quien con lo suyo (Ana apagó Equipo; Juan sigue igual)');
  const os = llamadas.filter(x => /onesignal\.com\/apps\/app1\/users\/by\/external_id\//.test(x.url));
  const tj = os[0] && os[0].body.properties.tags, ta = os[1] && os[1].body.properties.tags;
  ok(os.length === 2 && os[0].metodo === 'patch' && /juan%40x\.com$/.test(os[0].url) && /ana%40x\.com$/.test(os[1].url) && os[0].auth === 'Key os_v2_prueba',
    '2 · al guardar, las etiquetas del usuario en OneSignal (por su correo, con la llave de siempre)');
  ok(tj && tj.n_huespedes === 'oculto' && tj.n_urgentes === 'si' && ta && ta.n_equipo === 'no' && Object.keys(tj).length === 5, '2 · etiquetas n_<tipo>: si · oculto · no');
  ok(g.web === true, '2 · la respuesta dice que la web quedó al día');
}

/* ── 3. Lo que la app recibe (vozAvisos) ── */
{
  const rets = [{ id: 'rt1', origen: 'segundo_plano', ts: Date.now() }, { id: 'rt2', origen: 'socio', ts: Date.now() }, { id: 'rt3', origen: 'decision', ts: Date.now() }];
  const { ctx } = caja({ rets });
  ctx.notifAjustesGuardarApi_({ email: JUAN.email }, { tipo: 'socios', ajuste: { numero: false, siri: true } });
  ctx.avisoPoner_(JUAN, 'huesped_espera', { propiedad: 'Brunelo 1808' }, 'a1', { nivel: 1 });
  ctx.avisoPoner_(JUAN, 'claude_listo', { titulo: 'Botón de facturas' }, 'a2', { nivel: 2 });
  ctx.vozAvisoPoner_(JUAN, 'Un socio pide revisar su estado de cuenta.', 'a3', { origen: 'socio' });
  ctx.vozAvisoPoner_(JUAN, 'El equipo cumplió el encargo.', 'a4', { origen: 'encargo', nivel: 3 });
  ctx.vozAvisoPoner_(JUAN, 'Ya está lo que pediste en la reunión.', 'a5', { origen: 'conferencia', conferencia: true, resultado: true, nivel: 1 });
  const r = ctx.vozAvisos_({ email: JUAN.email }, {}), por = id => (r.avisos || []).filter(x => x.id === id)[0] || {};
  ok(r.ok && por('a1').notif_tipo === 'urgentes' && por('a2').notif_tipo === 'pendientes' && por('a3').notif_tipo === 'socios' && por('a4').notif_tipo === 'equipo' && por('a5').notif_tipo === 'pendientes',
    '3 · cada aviso llega con su tipo (urgentes, pendientes, socios, equipo; lo de conferencia no es urgente)');
  const aj = r.notif_ajustes || {};
  ok(Object.keys(aj).length === 5 && aj.socios.siri === true && aj.socios.numero === false && aj.huespedes.numero === true, '3 · con los ajustes de quien pregunta, los 5 tipos');
  ok(r.pendientes === 3 && r.numero === 2, '3 · el número del ícono cuenta solo los tipos con «Número en el ícono» (' + r.numero + ' de ' + r.pendientes + ')');
  const r2 = ctx.vozAvisos_({ email: JUAN.email }, {});
  ok(r2.ok && !(r2.avisos || []).length && r2.notif_ajustes && r2.notif_ajustes.socios.siri === true, '3 · sin avisos nuevos, los ajustes igual llegan (la app los guarda)');
  ok(JSON.stringify(aj).indexOf('@') < 0, '3 · en los ajustes no va ningún correo');
}

/* ── 4. Hub web (pushA_ y pushNuevo_) ── */
{
  /* Nadie cambió nada: exactamente como antes */
  let v = caja({ props: { ONESIGNAL_APP_ID: 'app1', ONESIGNAL_KEY: 'os_v2_prueba' } });
  v.ctx.pushA_(null, 'Rojo · Brunelo', 'Un huésped espera', '', { origen: 'rojo', nivel: 1 });
  v.ctx.pushNuevo_('c1', 'Ana Pérez', 'Brunelo 1808', 'Hola, ¿a qué hora es el check-in?');
  const n0 = v.llamadas.filter(x => /notifications$/.test(x.url));
  ok(n0.length === 2 && JSON.stringify(n0[0].body.included_segments) === '["Total Subscriptions"]' && !n0[0].body.filters, '4 · si nadie cambió el tipo, el aviso a todos sale con los segmentos de siempre');
  ok(JSON.stringify(n0[1].body.filters) === JSON.stringify([{ field: 'tag', key: 'nuevos', relation: '!=', value: '0' }, { operator: 'OR' }, { field: 'tag', key: 'nuevos', relation: 'not_exists' }]),
    '4 · y el de un mensaje nuevo, con los filtros de siempre');
  /* Con ajustes: Ana apagó Huéspedes; Juan lo tiene sin vista previa */
  v = caja({ props: { ONESIGNAL_APP_ID: 'app1', ONESIGNAL_KEY: 'os_v2_prueba' } });
  v.ctx.notifAjustesGuardarApi_({ email: ANA.email }, { tipo: 'huespedes', ajuste: { bloqueada: false, centro: false, banner: false } });
  v.ctx.notifAjustesGuardarApi_({ email: JUAN.email }, { tipo: 'huespedes', ajuste: { vista: 'desbloqueado' } });
  v.llamadas.length = 0;
  v.ctx.pushA_([JUAN.email, ANA.email, 'otro@x.com'], 'Cambio en reserva · Ana Pérez', 'Cambio de fechas: 3 – 5 dic', '', { origen: 'reserva' });
  let n = v.llamadas.filter(x => /notifications$/.test(x.url)), para = x => JSON.stringify((x.body.include_aliases || {}).external_id || []);
  const gen = n.filter(x => x.body.contents.es === 'Alma te dejó un mensaje'), comp = n.filter(x => /Cambio de fechas/.test(x.body.contents.es));
  ok(gen.length === 1 && para(gen[0]) === '["juan@x.com"]' && gen[0].body.headings.es === 'Alma', '4 · a quien lo ocultó (solo desbloqueado = nunca en la web): «Alma te dejó un mensaje», sin el texto');
  ok(comp.length === 1 && para(comp[0]) === '["otro@x.com"]', '4 · el completo solo a quien no lo cambió; a quien lo apagó, nada');
  v.llamadas.length = 0; v.logs.length = 0;
  const rr = v.ctx.pushA_([ANA.email], 'Cambio en reserva', 'x', '', { origen: 'reserva' });
  ok(rr.ok && !v.llamadas.length && v.logs.length === 1 && /apagado en sus ajustes \(huespedes\)/.test(v.logs[0][5]), '4 · si todos lo apagaron, no sale nada y queda en el registro por qué');
  v.llamadas.length = 0;
  v.ctx.pushA_(null, 'Huésped sin código', 'x', '', { origen: 'huesped', nivel: 2 });
  n = v.llamadas.filter(x => /notifications$/.test(x.url));
  const f0 = JSON.stringify(n[0] && n[0].body.filters), f1 = JSON.stringify(n[1] && n[1].body.filters);
  ok(n.length === 2 && !n[0].body.included_segments && f0 === JSON.stringify([{ field: 'tag', key: 'n_huespedes', relation: 'not_exists' }, { operator: 'OR' }, { field: 'tag', key: 'n_huespedes', relation: '=', value: 'si' }]),
    '4 · aviso a todos: el completo a quien no lo cambió o lo tiene igual (n_huespedes)');
  ok(f1 === JSON.stringify([{ field: 'tag', key: 'n_huespedes', relation: '=', value: 'oculto' }]) && n[1].body.contents.es === 'Alma te dejó un mensaje', '4 · y el genérico a quien lo ocultó; a quien lo apagó (no), nada');
  v.llamadas.length = 0;
  v.ctx.pushNuevo_('c2', 'Ana Pérez', 'Brunelo 1808', 'Hola');
  n = v.llamadas.filter(x => /notifications$/.test(x.url));
  const fn = n[0] && n[0].body.filters || [];
  ok(n.length === 2 && fn.filter(x => x.operator === 'OR').length === 3 && fn.filter(x => x.key === 'nuevos').length === 4 && fn.filter(x => x.key === 'n_huespedes').length === 4,
    '4 · un mensaje nuevo: «Mensajes nuevos» y Huéspedes juntos (4 grupos) y el genérico aparte');
  ok(n[1] && n[1].body.contents.es === 'Alma te dejó un mensaje' && n[1].body.headings.es === 'Alma' && JSON.stringify(n[1].body).indexOf('Hola') < 0, '4 · el genérico no lleva el nombre ni el texto del huésped');
  v.llamadas.length = 0;
  v.ctx.pushNuevo_('c3', 'Recepción', 'WhatsApp de ALMA', 'Llegó un paquete', { origen: 'recepcion' });
  n = v.llamadas.filter(x => /notifications$/.test(x.url));
  ok(n.length === 1 && JSON.stringify(n[0].body.filters).indexOf('n_huespedes') < 0, '4 · Recepción es Equipo: los ajustes de Huéspedes no la tocan');
  v.llamadas.length = 0;
  v.ctx.pushA_([ANA.email], 'Prueba de ALMA', 'Si ves esto…');
  ok(v.llamadas.filter(x => /notifications$/.test(x.url)).length === 1, '4 · sin tipo (la prueba del Hub) sale como siempre');
}

/* ── 5. Ganchos y pantalla ── */
{
  const COD = leer('Código.js'), VOZ = leer('voz.js');
  ok(/case 'notifAjustes': return json_\(notifAjustesApi_\(ses\)\)/.test(COD) && /case 'notifAjustesGuardar': return json_\(notifAjustesGuardarApi_\(ses, body\)\)/.test(COD), '5 · las acciones del Hub, con la sesión');
  ok(/notifAvisos_\(adm, mios, salida, rets, resp\)/.test(VOZ) && /nuevo\.origen = /.test(VOZ), '5 · vozAvisos manda el tipo y los ajustes; cada aviso guarda su origen');
  ok((COD.match(/pushA_\([^;]*\{ origen: '/g) || []).length >= 7 && /pushNuevo_\(convId, quien, propiedad, texto, de\)/.test(COD), '5 · los avisos web dicen de dónde vienen');
  ok(/notifAjustes notifAjustesGuardar/.test(leer('cupo.js')), '5 · las acciones cuentan en el cupo como «Inicio»');
  const H = fs.readFileSync(path.join(RAIZ, 'alma', 'avisos.html'), 'utf8');
  ok(/\.grupo \{/.test(H) && /el\("div", "grupo"\)/.test(H) && /\.interruptor/.test(H) && /\.fila \.sel select/.test(H) && /\.tit-g|\.nota-g/.test(H), '5 · la pantalla usa los componentes de Ajustes (grupo, fila, interruptor, selector)');
  ok(['Bloqueada', 'Centro', 'Banner', 'Sonido', 'Número en el ícono', 'Anunciar con Siri', 'Vista previa', 'Agrupar', 'Solo desbloqueado', 'Automático', 'Por tipo'].every(t => H.indexOf(t) >= 0), '5 · todas las opciones del diseño B');
  ok(/if \(NATIVA\) g\.appendChild\(interruptor\("siri"/.test(H), '5 · en el Hub web no hay fila de Siri');
  ok(/href="avisos\.html"/.test(fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8')) && /href="\.\/alma\/avisos\.html"/.test(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')), '5 · se entra desde Ajustes de la app y desde el menú del Hub');
}

/* ── 6. «Probar con Siri» desde el Hub web ── */
{
  const { ctx, props } = caja();
  ok(!ctx.notifPruebaApi_(null).ok && !ctx.notifPruebaApi_({}).ok && !props.VOZ_AVISOS, '6 · sin sesión (la llave vieja del Hub) no hay prueba');
  ok(!ctx.notifPruebaApi_({ email: ANA.email }).ok && !props.VOZ_AVISOS, '6 · otro administrador no la pide: solo el principal');
  const r = ctx.notifPruebaApi_({ email: JUAN.email });
  const cola = (JSON.parse(props.VOZ_AVISOS || '{}')[JUAN.email] || []);
  ok(r.ok && cola.length === 1 && cola[0].prueba === true && cola[0].texto === 'Prueba: si Siri te lee esto, los anuncios funcionan.', '6 · el principal: queda en la cola de su app, con el texto de Juan');
  ok(!Object.keys(props).some(k => /^VOZ_AVISOS_H_/.test(k)) && !props.AVISO_VOZ_COLA, '6 · no entra al historial ni gasta voz de ElevenLabs');
  const v = ctx.vozAvisos_({ email: JUAN.email }, { hablado: 3, ahora: true }), a = (v.avisos || [])[0] || {};
  ok(v.ok && a.prueba === true && !a.hablar && !a.audio, '6 · la app la recibe marcada como prueba, sin frase para decir ni audio');
  ok(/case 'notifPrueba': return json_\(notifPruebaApi_\(ses\)\)/.test(leer('Código.js')) && /notifPrueba/.test(leer('cupo.js')), '6 · la acción, con la sesión, y cuenta en el cupo como «Inicio»');
  const H = fs.readFileSync(path.join(RAIZ, 'alma', 'avisos.html'), 'utf8');
  ok(/Probar con Siri/.test(H) && /que: "probarSiri"/.test(H) && /pedir\("notifPrueba"\)/.test(H) && /Bloquea el teléfono, ponte los AirPods y espera 15 segundos/.test(H), '6 · el botón en Ajustes → Notificaciones: la app la programa; en la web, el Hub');
}

/* ── 7. Los pasos del anillo ── */
{
  const { ctx, props } = caja();
  const pasos = ['10:00:01 El anillo encendió el modo conferencia', '10:00:09 Aviso: Flor (flor@x.com) pagó https://x.co/a «hola»'];
  ctx.vozAvisos_({ email: JUAN.email }, { pasos, anillo: true });
  const k = Object.keys(props).filter(x => /^ANILLO_APP_/.test(x));
  const l = k.length ? JSON.parse(props[k[0]]) : [];
  ok(k.length === 1 && k[0].indexOf('@') < 0 && l.length === 2 && l.every(x => x.origen === 'app' && x.anillo === true && x.f), '7 · llegan con vozAvisos y se guardan por usuario (la clave no es el correo), con origen «app»');
  ok(!/@|https?:|hola/.test(JSON.stringify(l)), '7 · sin correos, enlaces ni lo que va entre «»');
  for (let i = 0; i < 5; i++) ctx.vozAvisos_({ email: JUAN.email }, { pasos: Array.from({ length: 14 }, (_, j) => '10:0' + i + ':' + j + ' paso ' + j) });
  ok(JSON.parse(props[k[0]]).length === 30, '7 · solo los últimos 30');
  ctx.vozAvisos_({ email: JUAN.email }, {});
  ok(JSON.parse(props[k[0]]).length === 30, '7 · sin pasos nuevos no se toca nada');
  ctx.ssAlma_ = () => ({ getSheetByName: () => null });
  const leido = ctx.anilloLeer_(30);
  ok(leido.ok && Object.keys(leido.app || {}).length === 1, '7 · el robot los lee con «anillo» aunque la hoja esté vacía');
}

/* ── 8. Conversación continua en Modo calle y conferencia: sin despedidas y sin colgar ── */
{
  const VOZ = leer('voz.js');
  const regla = n => (VOZ.match(new RegExp("'· " + n + "[^\\n]*")) || [''])[0];
  ok(/MODO CALLE o MODO CONFERENCIA con CONVERSACIÓN CONTINUA[^']*no te despidas ni cuelgues[^']*skip_turn/.test(regla('SILENCIO LARGO')), '8 · SILENCIO LARGO: con conversación continua no se despide ni cuelga: se queda en silencio');
  ok(/MODO CALLE o MODO CONFERENCIA con CONVERSACIÓN CONTINUA nunca cuelgas tú ni te despides[^']*sigues escuchando/.test(regla('Nunca cuelgues tú primero')), '8 · «Nunca cuelgues tú primero»: con conversación continua nunca cuelga ella');
  ok(/Entendido, lo hago y te aviso cuando esté listo» y, con CONVERSACIÓN CONTINUA, sigue escuchando sin despedirte ni colgar/.test(regla('SEGUNDO PLANO')), '8 · segundo plano: la frase corta y sigue escuchando');
  ok(/sin CONVERSACIÓN CONTINUA, despídete y cuelga con end_call/.test(regla('SEGUNDO PLANO')), '8 · «TARDA MÁS DE LO NORMAL»: solo cuelga sin conversación continua');
  const ec = (VOZ.match(/end_call: '[^\n]*/) || [''])[0];
  ok(/Con CONVERSACIÓN CONTINUA \(MODO CALLE o MODO CONFERENCIA[^']*no la uses nunca/.test(ec) && !/apenas termines/.test(ec) && !/salvo en MODO CALLE/.test(ec), '8 · la descripción de end_call: con conversación continua no se usa');
  ok(/Si la ficha trae la regla SIN DESPEDIDAS \(una versión anterior de la app, que no cierra sola\), cuelga como ella dice/.test(ec), '8 · una app de antes (que no cierra sola) sigue colgando: ninguna llamada queda abierta');
  const st = (VOZ.match(/skip_turn: '[^\n]*/) || [''])[0];
  ok(/MODO CALLE o MODO CONFERENCIA cuando ya respondiste/.test(st), '8 · la descripción de skip_turn: quedarse escuchando después de responder');
  /* Nada de la voz del Hub manda colgar en esos modos (así empezó «se corta en automático», 16-nov-2026). Lo decide la
     ficha de la app («CONVERSACIÓN CONTINUA»): una app de antes, que no sabe cerrar sola, sigue colgando como antes. */
  const cuelga = /MODO (?:CALLE|CONFERENCIA)[^.'\n]{0,90}(?:cuelga con end_call|cuelgas tú al terminar|úsala apenas)/i;
  ok(!cuelga.test(VOZ) && !cuelga.test(leer('almaabre.js')), '8 · ninguna regla manda colgar en Modo calle o conferencia');
  ok(/Si tu ficha dice CONVERSACIÓN CONTINUA, no cuelgues ni te despidas: sigue escuchando/.test(VOZ) && /con CONVERSACIÓN CONTINUA en tu ficha no: ahí sigue escuchando/.test(VOZ), '8 · lo que tarda de más: con conversación continua tampoco cuelga');
  ok(/no cuelgues tú: la app cierra sola/.test(leer('almaabre.js')), '8 · Alma abre: tampoco cuelga ella');
  ok(/en Modo calle o conferencia no cuelgas: la app cierra sola/.test(fs.readFileSync(path.join(RAIZ, 'playbooks', 'alma.json'), 'utf8')), '8 · la fuente única dice lo mismo de end_call');
  /* La app cierra sola: los segundos van en la ficha y se ajustan con las Propiedades del script. */
  const { ctx, props } = caja();
  const d = ctx.confSueno_();
  ok(d.silencio === 30 && d.tope === 60, '8 · de fábrica: 30 s de silencio y 60 s sin que Alma hable');
  props.CONF_SILENCIO_S = '40'; props.CONF_TOPE_S = '90';
  const a1 = ctx.confSueno_(); ok(a1.silencio === 40 && a1.tope === 90, '8 · se ajustan con CONF_SILENCIO_S y CONF_TOPE_S');
  props.CONF_SILENCIO_S = '2'; props.CONF_TOPE_S = '9999';
  const a2 = ctx.confSueno_(); ok(a2.silencio === 10 && a2.tope === 300, '8 · con límites: nunca menos de 10 s ni más de 5 min abierta sin que Alma hable');
  ok(/case 'voz_sync':[^\n]*vozHerramientasSiCambiaron_\(\)/.test(leer('Código.js')), '8 · el robot voz_sync también sube las descripciones de end_call y skip_turn (no esperan la vuelta de 30 min)');
  ok(/out\.conferencia_silencio_s = cf\.silencio; out\.conferencia_tope_s = cf\.tope/.test(VOZ), '8 · la ficha de la llamada los lleva (conferencia_silencio_s, conferencia_tope_s)');
}

if (fallo) process.exit(1);
console.log('Todo bien.');
