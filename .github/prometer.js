/* Prueba de «verificar antes de prometer» (apps-script/prometer.js, enviohuesped.js y partes de agente.js y voz.js, #583
   T4) con dobles: sin internet, sin Google y sin IA. Repite lo que pasó:
   · 13-nov: Alma le mostró a Juan un borrador para el socio de un apartamento y luego dijo «Listo, con ese cambio: — Hola …»,
     pero nada salió a ese número (escribir_a_equipo no guardaba borradores y el «sí» no tenía a qué ligarse);
   · 16-nov: la misma huésped recibió el mismo mensaje a las 12:01 y a las 12:28 (el freno duraba 3 min y comparaba el texto
     exacto: los saltos de línea eran otros);
   · en una llamada la voz dijo «Listo, le llegó» 26 s antes de llamar a la herramienta.
   Revisa:
   1. el freno al cerrar el turno: «listo / le llegó» sin un envío hecho → «Todavía no salió: …»; un «Listo» de otra cosa
      que sí se hizo (una tarea) no se toca; un borrador o un envío fallido con «Listo» se corrige; si el pedido era de solo
      leer (guardia 19-nov: el contexto de un escalado), contar un envío de antes no se frena;
   2. borrador para el socio → no sale (ni con el sí en el mismo turno) → «sí» en otro mensaje → sale a ESE número con ese
      texto, una vez; un «sí» que nombra a otra persona no usa el borrador;
   3. dos enviar_a_huesped a 27 min con saltos de línea distintos → el segundo no sale; con «otra vez» sí; 25 h después sí;
      si ya es lo último que le escribimos en el hilo, tampoco;
   4. la llamada: «le llegó» sin un envío antes → un Pendiente para Juan; con el envío antes, nada; y vozPostCall_ lo revisa.
   node .github/prometer.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

/* Números, nombres y reservas de prueba: no son los reales. */
const SOC_A = '50255550201', AXEL = '50255550302', UUID = 'c0ffee00-0000-4000-8000-000000000583';
const PROPS = ['Z13 - Edificio Alto - 633', 'Z13 - Edificio Alto - 623'];
const ADM = { email: 'juan@prueba', nombre: 'Juan Prueba', tels: ['50255550100'], principal: true };

function hoja(filas) { return { getDataRange: () => ({ getDisplayValues: () => filas.map(r => r.map(String)) }), getLastRow: () => filas.length, appendRow: r => filas.push(r) }; }
function caja(o) {
  o = o || {};
  let reloj = Date.parse('2026-11-16T18:01:00Z');
  const cache = {}, props = {}, posts = [], hosp = [], pend = [];
  const SETUP = [['property_name', 'User email'], [PROPS[0], 'socio.a@prueba.test'], [PROPS[1], 'vecino@prueba.test']];
  const USR = [['nombre', 'email', 'telefono'], ['Ana Prueba', 'socio.a@prueba.test', SOC_A], ['Mario Vecino', 'vecino@prueba.test', '50255550203']];
  const fichas = [{ tel: AXEL, nombre: 'Axel Duarte', tipo: 'equipo', rol: 'Técnico', propiedades: '' }];
  const D = class extends Date { constructor(...a) { if (!a.length) super(reloj); else super(...a); } static now() { return reloj; } };
  const ctx = {
    console: { log() {}, warn() {}, error(e) { if (o.verErrores) console.log('  (error) ' + e); } }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Boolean, Date: D,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache[k] && cache[k].hasta > reloj ? cache[k].v : null), put: (k, v, s) => { cache[k] = { v: String(v), hasta: reloj + (s || 600) * 1000 }; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 16), sleep() {}, base64EncodeWebSafe: b => Buffer.from(String(b)).toString('base64'), computeDigest: (a, t) => require('crypto').createHash('md5').update(t).digest('hex'), DigestAlgorithm: { MD5: 'md5' } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => (n === 'SETUP' ? hoja(SETUP) : null), getSheets: () => [hoja(USR)] }) },
    RMES_HOJA_: 'hoja-mi', SHEET_ACCESOS_ID: 'hoja-usuarios', CFG: { TZ: 'America/Guatemala' }, ahora_: () => new D(),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8), s_: v => (v == null || typeof v === 'object') ? '' : String(v),
    adminsOp_: () => [ADM], adminPorTel_: () => null, opFilas_: () => [], contactosTodos_: () => fichas, contactoFicha_: () => null, contactoGuardar_() {},
    CONTACTO_TIPOS_: {}, epiSnap_: () => ({ vendors: [] }), vendNombre_: v => v.name, contactoRolEpi_: c => c, escalamiento_: () => [], recepcionNumeros_: () => ({}),
    accesosPorRol_: () => ({ socios: [] }), contactoRecientes_: () => [], bqMejor_: () => '', hojaCrear_: () => ({ appendRow() {} }), DATO_HECHO_CAB_: [], celdaTexto_: String,
    /* Envíos de mentira */
    socioSoloPrincipal_: () => '', waEnviarAlguien_: (tel, texto) => { posts.push({ a: tel, texto }); return { ok: true, modo: 'texto', id: 'wamid.' + posts.length }; },
    waEntregaEsperar_: () => ({ estado: 'sent' }), waConfirmacion_: () => ({ ok: true, entrega: 'enviado', nota: 'Meta confirmó: ENVIADO.' }), waVigilarAnotar_() {},
    contactoAsegurar_() {}, relevoAtender_() {}, fichaTrasEscribir_() {}, contactoEncolar_() {}, encargoCrear_() {},
    hubInbox_: () => o.inbox || [{ conv_id: UUID, codigo: 'HMPRUEBA01', huesped: 'Huésped Prueba', propiedad: PROPS[0] }],
    hubResponder_: (rid, texto) => { hosp.push({ rid, texto }); return { ok: true }; }, hubResponderWa_: () => ({ ok: false, error: 'no aquí' }),
    reservaConv_: () => ({}), consultaPendiente_: () => null, tvCandidata_() {}, tvCandidataTema_() {},
    pendAvisar_: (adm, t, x) => { pend.push({ t, x }); return true; }, pendEncolar_() {},
    microSacarEtiqueta_: t => ({ texto: t }), claudeNivelSacarEtiqueta_: t => ({ texto: t }), chatSacarEtiqueta_: t => ({ texto: t }), temaSacarEtiqueta_: t => ({ texto: t })
  };
  vm.createContext(ctx);
  vm.runInContext(['telsEnTexto_', 'normTel_', 'telsDe_'].map(n => sacar(COD, n)).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  ['sociosmi.js', 'destino.js', 'enviohuesped.js', 'agente.js', 'prometer.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  return { X: ctx, posts, hosp, pend, props, avanzar: ms => { reloj += ms; } };
}
const turno = (X, t) => { X.AGENTE_TEXTO_ = t; X.AGENTE_CANAL_ = 'hub'; X.AGENTE_PERMITIDAS_ = null; };
const nuevo = () => ({ hechas: [], llamadas: [] });

/* ── 1 · El freno al cerrar el turno ── */
{ const { X } = caja();
  const c1 = nuevo(); const r1 = X.agCerrarTurno_(ADM, 'Listo, le llegó a Ana.', c1).respuesta;
  ok(/^Todavía no salió: /.test(r1) && /ningún envío/.test(r1), '«Listo, le llegó» sin un envío en el turno → «Todavía no salió: …»');
  const c2 = { hechas: [{ tipo: 'tarea', resumen: 'Tarea · revisar el aire' }], llamadas: [] };
  ok(X.agCerrarTurno_(ADM, 'Listo, quedó la tarea para revisar el aire.', c2).respuesta === 'Listo, quedó la tarea para revisar el aire.', 'un «Listo» de otra cosa que sí se hizo (una tarea) no se toca');
  const c3 = { hechas: [{ tipo: 'mensaje', resumen: 'WhatsApp a Ana · enviado', error: '' }], llamadas: [] };
  ok(X.agCerrarTurno_(ADM, 'Listo, le mandé el WhatsApp a Ana.', c3).respuesta === 'Listo, le mandé el WhatsApp a Ana.', 'con un envío hecho, «le mandé» queda igual');
  const c4 = { hechas: [{ tipo: 'mensaje', nombre: 'Ana', resumen: 'WhatsApp a Ana', error: 'Meta no lo entregó' }], llamadas: [] };
  const r4 = X.agCerrarTurno_(ADM, 'Listo.', c4).respuesta;
  ok(/^Todavía no salió: el envío a Ana falló \(Meta no lo entregó\)/.test(r4), '«Listo» con un envío fallido → dice que falló y por qué');
  const c5 = { hechas: [{ tipo: 'tarea', resumen: 'Tarea · limpieza' }], llamadas: [] };
  const r5 = X.agCerrarTurno_(ADM, 'Hecho: creé la tarea y ya le envié el mensaje a Karen.', c5).respuesta;
  ok(/^Todavía no salió/.test(r5) && /Lo que sí quedó: Tarea · limpieza/.test(r5), 'dice que salió sin envío aunque hizo otra cosa → corregido, con lo que sí quedó');
  const c6 = { hechas: [], llamadas: [{ tool: 'buscar_contacto', ok: true }] };
  ok(X.agCerrarTurno_(ADM, 'Sí, le llegó: Meta dice ENTREGADO.', c6).respuesta === 'Sí, le llegó: Meta dice ENTREGADO.', '«¿le llegó?» contestado con el estado real (buscar_contacto) no se toca');
  ok(X.agCerrarTurno_(ADM, 'Mañana llegan tres huéspedes.', nuevo()).respuesta === 'Mañana llegan tres huéspedes.', 'una respuesta sin promesa de envío queda igual');
  /* Guardia 19-nov: un pedido de solo leer cuya respuesta cuenta un envío de antes no se cambia por «Todavía no salió». */
  const leerR = 'El reporte se escaló a las 17:05: ya se le envió a Gabriel y falta el código de la quincena en Epi.';
  turno(X, 'Dame contexto del problema escalado de Baldone 1103');
  ok(X.agCerrarTurno_(ADM, leerR, nuevo()).respuesta === leerR, 'pedido de leer (contexto de un escalado) que cuenta un envío pasado → la respuesta queda igual');
  turno(X, '¿Qué pasó con el reporte de Gabriel? ¿Qué mandó?');
  ok(X.agCerrarTurno_(ADM, leerR, nuevo()).respuesta === leerR, '«¿qué mandó Gabriel?» es leer: no se frena');
  turno(X, 'Mándale los códigos pendientes a las llegadas de hoy');
  ok(/^Todavía no salió: .*ningún envío/.test(X.agCerrarTurno_(ADM, 'Listo, ya les mandé los códigos.', nuevo()).respuesta), 'pedido de mandar y «ya les mandé los códigos» sin envío → se frena');
  turno(X, 'sí');
  ok(/^Todavía no salió/.test(X.agCerrarTurno_(ADM, 'Listo, le llegó a Ana.', nuevo()).respuesta), 'un «sí» seguido de «le llegó» sin envío → se frena');
  turno(X, 'Dame contexto del escalado');
  const c7 = { hechas: [{ tipo: 'mensaje', nombre: 'Ana', resumen: 'WhatsApp a Ana', error: 'Meta no lo entregó' }], llamadas: [] };
  ok(/^Todavía no salió: el envío a Ana falló/.test(X.agCerrarTurno_(ADM, 'Listo.', c7).respuesta), 'un envío fallido se corrige aunque el pedido fuera de leer');
  turno(X, '');
}

/* ── 2 · Borrador para el socio → «sí» → sale a ese número ── */
{ const { X, posts } = caja();
  turno(X, 'escríbele al socio de Edificio Alto 633 que ya está su reporte; enséñame antes el mensaje');
  const c1 = nuevo();
  const b = X.agEjecutar_(ADM, 'escribir_a_equipo', { persona: 'socio de Edificio Alto 633', texto: 'Hola Ana, ya está tu reporte de octubre.', borrador: true }, c1);
  ok(b.falta_confirmar && !posts.length && /^Borrador para Ana Prueba \(socio de Edificio Alto 633, número de Control de usuarios\)\. Todavía no salió\.$/.test(b.decir), 'borrador: no sale y dice para quién, de qué apartamento y de dónde salió el número: ' + b.decir);
  const r1 = X.agCerrarTurno_(ADM, 'Listo, con ese cambio: — Hola Ana, ya está tu reporte de octubre.', c1).respuesta;
  ok(/^Todavía no salió: es un borrador para Ana Prueba/.test(r1) && /reporte de octubre/.test(r1), '«Listo, con ese cambio: …» sobre un borrador → «Todavía no salió: es un borrador para …» (13-nov)');
  const mismo = X.agEjecutar_(ADM, 'escribir_a_equipo', { persona: 'socio de Edificio Alto 633', texto: 'x', confirmado: true }, nuevo());
  ok(mismo.falta_confirmar && !posts.length, 'confirmado en el MISMO turno del borrador: no sale');
  turno(X, 'Sí');
  const c2 = nuevo();
  const r = X.agEjecutar_(ADM, 'escribir_a_equipo', { persona: 'Ana', texto: 'Un texto que Juan no vio', confirmado: true }, c2);
  ok(r.enviado_a === 'Ana Prueba' && posts.length === 1 && posts[0].a === SOC_A && posts[0].texto === 'Hola Ana, ya está tu reporte de octubre.', 'con el «sí» en otro mensaje sale a ESE número y con el texto que Juan vio');
  ok(X.agCerrarTurno_(ADM, 'Listo, le llegó a Ana.', c2).respuesta === 'Listo, le llegó a Ana.', 'y ahí «listo» sí vale (hubo un envío hecho)');
  ok(X.equipoBorradorPendiente_(ADM) === null, 'el borrador se usa una sola vez');
}
{ const { X, posts } = caja();
  turno(X, 'borrador para el socio de Edificio Alto 633');
  X.agEjecutar_(ADM, 'escribir_a_equipo', { persona: 'socio de Edificio Alto 633', texto: 'Hola Ana.', borrador: true }, nuevo());
  turno(X, 'sí, y escríbele a Axel Duarte que pase mañana');
  X.agEjecutar_(ADM, 'escribir_a_equipo', { persona: 'Axel Duarte', texto: 'Hola Axel, ¿puedes pasar mañana?' }, nuevo());
  ok(posts.length === 1 && posts[0].a === AXEL && X.equipoBorradorPendiente_(ADM) !== null, 'un mensaje que nombra a otra persona no usa el borrador del socio (sigue esperando)');
}
{ const { X, posts } = caja();
  turno(X, 'muéstrame el borrador para Mario Mayorga del 633');
  const b = X.agEjecutar_(ADM, 'escribir_a_equipo', { persona: 'Mayorga', propiedad: 'Edificio Alto 633', texto: 'Hola.', borrador: true }, nuevo());
  ok(b.error && /no encontré a «Mayorga» en Edificio Alto 633/.test(b.error) && !posts.length && X.equipoBorradorPendiente_(ADM) === null, 'sin destinatario verificado no hay borrador: no inventa al vecino del 623 y pide el dato');
}

/* ── 3 · El mismo mensaje al huésped, 27 min después y con otros saltos de línea ── */
{ const { X, hosp, avanzar } = caja();
  const T1 = 'Hola, te saluda Alma.\n\nTu código de la puerta es el mismo de ayer.\n\nCualquier cosa, me escribes.';
  const T2 = 'Hola, te saluda Alma. Tu código de la puerta es el mismo de ayer.\nCualquier cosa, me escribes';
  turno(X, 'mándale el código a la huésped'); X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: UUID, texto: T1, canal: 'plataforma' }, nuevo());
  avanzar(27 * 60000); turno(X, 'pásame con Claudio');
  const c2 = nuevo(), r2 = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: UUID, texto: T2, canal: 'plataforma' }, c2);
  ok(hosp.length === 1 && r2.duplicado && /NO SE ENVIÓ/.test(r2.error), '27 min después, mismo texto con otros saltos de línea: el segundo no sale (16-nov 12:01 y 12:28)');
  ok(c2.duplicado && /ya le salió/.test(X.agCerrarTurno_(ADM, 'Ese mensaje ya le salió antes.', c2).respuesta), 'y decir que ya le había salido no se corrige');
  turno(X, 'mándaselo otra vez'); X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: UUID, texto: T2, canal: 'plataforma' }, nuevo());
  ok(hosp.length === 2, 'con «otra vez» de Juan sí sale');
  avanzar(25 * 3600000); turno(X, 'mándale el código');
  X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: UUID, texto: T1, canal: 'plataforma' }, nuevo());
  ok(hosp.length === 3, 'pasadas 24 h ya no es duplicado');
}
{ const T = 'Hola, te saluda Alma. Mañana a las 10 pasa el técnico del aire.';
  const { X, hosp } = caja({ inbox: [{ conv_id: UUID, codigo: 'HMPRUEBA01', ultimo_de: 'host', ultimo_texto: T, ultimo_ts: '2026-11-16T17:30:00Z' }] });
  turno(X, 'dile que mañana pasa el técnico');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: UUID, texto: T.replace('. ', '.\n\n'), canal: 'plataforma' }, nuevo());
  ok(!hosp.length && r.duplicado, 'si ya es lo último que le escribimos en el hilo (aunque el registro no lo tenga), tampoco sale');
}

/* ── 4 · La llamada: «le llegó» antes de la herramienta ── */
{ const { X, pend } = caja();
  const envio = JSON.stringify({ ok: true, resultado: 'Listo.', acciones: ['WhatsApp a Ana Prueba · enviado · Hola (hecho)'], envio_hecho: true });
  const antes = [{ role: 'user', message: 'Escríbele a Ana que ya está su reporte', time_in_call_secs: 10 },
    { role: 'agent', message: 'Listo, le llegó.', time_in_call_secs: 20 },
    { role: 'agent', message: null, tool_calls: [{ tool_name: 'secretaria' }], time_in_call_secs: 22 },
    { role: 'agent', message: null, tool_results: [{ tool_name: 'secretaria', result_value: envio }], time_in_call_secs: 46 }];
  ok(X.prometerAuditarLlamada_(ADM, antes, 'conv1') && pend.length === 1 && /Listo, le llegó/.test(pend[0].t) && pend[0].x.tipo === 'atencion', '«Listo, le llegó» 26 s antes de la herramienta → un Pendiente para Juan');
  const despues = antes.slice(0, 1).concat(antes.slice(2), [{ role: 'agent', message: 'Listo, ya le salió el mensaje a Ana.', time_in_call_secs: 50 }]);
  ok(!X.prometerAuditarLlamada_(ADM, despues, 'conv2') && pend.length === 1, 'con el envío hecho antes de decirlo, nada');
  const fallido = JSON.stringify({ ok: true, resultado: 'No salió.', acciones: ['WhatsApp a Ana Prueba (falló: NO SALIÓ)'], envio_hecho: false });
  ok(X.prometerAuditarLlamada_(ADM, [{ role: 'agent', tool_results: [{ tool_name: 'secretaria', result_value: fallido }] }, { role: 'agent', message: 'Ya se lo mandé.', time_in_call_secs: 30 }], 'conv3') && pend.length === 2, 'si la secretaria devolvió un envío fallido y la voz dice «ya se lo mandé» → Pendiente');
  ok(!X.prometerAuditarLlamada_(ADM, [{ role: 'agent', message: 'Listo, quedó la tarea.', time_in_call_secs: 5 }], 'conv4'), 'un «Listo» que no habla de un envío no abre nada');
  const voz = leer('voz.js');
  ok(/prometerAuditarLlamada_\(admC, d\.transcript, convEL\)/.test(sacar(voz, 'vozPostCall_')) && /out\.envio_hecho = prometerEnvioHecho_\(r\.hechas\)/.test(sacar(voz, 'vozSecretaria_')), 'vozPostCall_ audita la llamada y vozSecretaria_ devuelve envio_hecho');
  ok(/prometerFreno_\(respFinal, ctx\)/.test(sacar(leer('agente.js'), 'agCerrarTurno_')), 'agCerrarTurno_ pasa la respuesta por el freno');
}

process.exit(fallo);
