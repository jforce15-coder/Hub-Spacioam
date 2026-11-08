/* Prueba del envío a un huésped con el «sí» de Juan y del aviso del código de acceso, con dobles: sin Google, sin
   Hospitable de verdad y sin IA (apps-script/enviohuesped.js, codigoaviso.js, agente.js y extractos de Código.js).
   Repite el 7-nov:
   · Oscar (Brunelo 1808): la fila de la bandeja de su reserva no tenía el código; Alma mostró el borrador, Juan dijo «Si»
     y Alma contestó «la reserva no tiene conversación activa». Revisa que:
     1. el borrador (borrador = true) se guarda con el uuid exacto de la reserva y no sale; en el mismo turno tampoco;
     2. con el «sí» en un mensaje nuevo sale una vez a ESE uuid (con o sin código, aunque haya otro Oscar en Brunelo 1808);
     3. sin borrador, el código igual encuentra la conversación (hoja Reservas y Hospitable en vivo) y repara la bandeja;
     4. si el «sí» nombra a otra persona, no sale al borrador.
   · Hospitable con error: 429 se reintenta (hosp_) y si sigue, Alma recibe «Hospitable respondió 429 …», nunca otra causa;
     un 503 se reintenta una vez y sale; un 422 no se reintenta y dice el motivo de Hospitable.
   · Estrella (Ignacio 1206): tres mensajes «no funciona el código» abrían tres revisiones y Juan recibió la misma alerta
     tres veces, después de haberle contestado. Revisa que la alerta sale una sola vez, que no sale si el equipo contestó
     en la conversación, y que dice que el PIN de igloohome vence antes de su salida.
   node .github/envio-huesped.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js');
const sacar = (nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(COD); if (!m) throw new Error('no encontré ' + nombre + ' en Código.js'); return m[0]; };

const HOY = '2026-11-07', AHORA = Date.parse('2026-11-07T23:54:20Z');
const UUID_OSCAR = 'b29098fa-0000-4000-8000-000000000001', UUID_MELGAR = '341d9828-0000-4000-8000-000000000002', UUID_ESTRELLA = '4330b930-0000-4000-8000-000000000003';
const RESERVAS = [
  { code: 'HMWM942RSN', guest_first_name: 'Oscar', guest_last_name: 'Suchite', property_name: 'Z10 - Brunelo - 1808', checkin_date: '2026-11-07', checkout_date: '2026-11-08', status: 'accepted', reservation_uuid: '' },
  { code: 'HMJFJQCMAS', guest_first_name: 'Oscar', guest_last_name: 'Melgar', property_name: 'Z10 - Brunelo - 1808', checkin_date: '2026-10-04', checkout_date: '2026-10-08', status: 'accepted', reservation_uuid: '' },
  { code: 'HM5TWHD8KK', guest_first_name: 'Estrella', guest_last_name: 'Hernandez', property_name: 'Z10 - Ignacio - 1206', checkin_date: '2026-10-31', checkout_date: '2026-11-08', status: 'accepted', reservation_uuid: '' }
];
/* La bandeja como estaba: la fila de Oscar sin código (así la dejó la consulta que se volvió reserva). */
const bandeja = () => [
  { conv_id: UUID_OSCAR, codigo: '', huesped: 'Oscar', propiedad: '', tipo: '', ultimo_de: 'guest', ultimo_ts: '2026-11-07T23:49:04Z' },
  { conv_id: UUID_MELGAR, codigo: 'HMJFJQCMAS', huesped: 'Oscar Melgar', propiedad: 'Z10 - Brunelo - 1808', tipo: 'reserva' },
  { conv_id: UUID_ESTRELLA, codigo: 'HM5TWHD8KK', huesped: 'Estrella Hernandez', propiedad: 'Z10 - Ignacio - 1206', tipo: 'reserva', ultimo_de: 'guest', ultimo_ts: '2026-11-07T23:50:29Z' }
];

/* Hospitable de mentira: lista de reservas por fecha de llegada y POST de mensajes con las respuestas que pida la prueba. */
function caja(opc) {
  opc = opc || {};
  const cache = {}, posts = [], gets = [], avisos = [], filasSet = [], upserts = [], logs = [];
  let respuestas = (opc.respuestasPost || []).slice();
  const inbox = bandeja();
  const fmt = (d, tz, f) => { const g = new Date(new Date(d).getTime() - 6 * 3600e3), p = (n) => String(n).padStart(2, '0');
    if (f === 'yyyy-MM-dd') return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
    if (f === 'HH:mm') return p(g.getUTCHours()) + ':' + p(g.getUTCMinutes()); return g.toISOString(); };
  const resp = (code, json) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(json || {}), getHeaders: () => ({}) });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Boolean, encodeURIComponent, decodeURIComponent,
    Date: class extends Date { constructor(...a) { if (!a.length) super(AHORA); else super(...a); } static now() { return AHORA; } },
    CFG: { TZ: 'America/Guatemala', TAB_RESERVAS: 'Reservas', TAB_PROPIEDADES: 'Propiedades', TAB_COLA: 'ALMA_COLA', HOSPITABLE_API: 'https://hosp.example/v2' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { formatDate: fmt, sleep() {}, base64EncodeWebSafe: (b) => Buffer.from(String(b)).toString('base64'), computeDigest: (a, t) => String(t), DigestAlgorithm: { MD5: 'md5' } },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; }, removeAll: (ks) => ks.forEach((k) => delete cache[k]) }) },
    s_: (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8), normTel_: (t) => String(t || '').replace(/\D/g, ''),
    fecha_: (v) => String(v || '').slice(0, 10), ahora_: () => new Date(AHORA),
    sumarDias_: (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    leerTabla_: () => RESERVAS, hubInbox_: () => inbox, formsOk_: () => [], estadoEs_: (x) => x,
    inboxUpsert_: (id, o) => { upserts.push({ id, o }); const f = inbox.filter((x) => x.conv_id === id)[0]; if (f) Object.keys(o).forEach((k) => { if (o[k]) f[k] = o[k]; }); },
    idsPropiedades_: () => ['p-brunelo-1808', 'p-ignacio-1206'],
    /* uf_ es la única puerta a internet (cupo.js): aquí contesta Hospitable de mentira. */
    uf_: (url, o) => {
      if (/\/messages$/.test(url) && o && o.method === 'post') { posts.push({ url, body: JSON.parse(o.payload).body }); const r = respuestas.length ? respuestas.shift() : [201, { data: {} }]; return resp(r[0], r[1]); }
      gets.push(url);
      if (/\/reservations\?/.test(url)) return resp(200, { data: [{ id: UUID_OSCAR, code: 'HMWM942RSN' }, { id: 'otra-0000-0000-0000-000000000009', code: 'HMOTRA0001' }] });
      if (/\/reservations\/[^/]+$/.test(url)) return resp(200, { data: { reservation_status: { current: { category: 'accepted' } } } });
      return resp(404, {});
    },
    /* Lo que hubResponder_ toca después de enviar: nada de hojas reales. */
    adjLeer_: () => ({ ok: true, items: [] }), hiloConv_: () => ({ code: 200, hilo: [] }), cacheEnvio_() {}, registrarEnvioInq_() {},
    hoja_: () => ({ getLastRow: () => 1 }), hubDespuesEncolar_() {}, promesasCumplir_() {}, decisionAlResponder_() {}, COLA_HEADERS: [], C: {}, FINALES: [],
    hubResponderWa_: () => { throw new Error('a Oscar se le escribe por la plataforma'); },
    tvCandidata_() {}, consultaElegir_: () => null, consultasBuscar_: () => [], consultaPendiente_: () => null, consultaFicha_: (x) => x,
    vozWebTel_: () => '', adminPorTel_: () => null
  };
  vm.createContext(ctx);
  ['buscar.js', 'enviohuesped.js', 'codigoaviso.js', 'agente.js'].forEach((f) => vm.runInContext(leer(f), ctx, { filename: f }));
  vm.runInContext(['hosp_', 'hubResponder_'].map(sacar).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  Object.assign(ctx, { avisos, filasSet, logs });
  return { X: ctx, cache, posts, gets, upserts, inbox };
}
const ADM = { email: 'juan@spacioam.com', nombre: 'Juan Ovalle', tels: ['50255550101'], principal: true };
const turno = (X, texto) => { X.AGENTE_TEXTO_ = texto; X.AGENTE_CANAL_ = 'whatsapp'; X.AGENTE_PERMITIDAS_ = null; };
const ctxH = () => ({ hechas: [] });
const MSG = 'Hola Oscar, sin ningún problema: puedes salir más tarde.\n\nPara compensar el tiempo que se atrasó la limpieza, mañana te damos 3 horas adicionales de late check-out, sin costo.';

/* 1 · Oscar: borrador, mismo turno, «Si» en un mensaje nuevo */
{ const { X, posts } = caja();
  turno(X, '[nota de voz] Óscar de Brunello 1808: dile que sí puede salir más tarde, tres horas sin costo');
  const b = X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Oscar', propiedad: 'Brunelo 1808', texto: MSG, canal: 'plataforma', borrador: true }, ctxH());
  ok(b.ok && b.falta_confirmar && b.borrador && b.borrador.codigo === 'HMWM942RSN' && /Suchite/.test(b.borrador.para) && posts.length === 0, '1 · el borrador se guarda para Oscar Suchite (HMWM942RSN) y no sale: ' + JSON.stringify(b.borrador || b));
  const b2 = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'HMWM942RSN', texto: MSG, canal: 'plataforma', confirmado: true }, ctxH());
  ok(b2.falta_confirmar && posts.length === 0, '1 · confirmado en el MISMO turno del borrador: no sale');
  turno(X, 'Si');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'HMWM942RSN', texto: MSG, canal: 'plataforma', confirmado: true }, ctxH());
  ok(r.ok && posts.length === 1 && posts[0].url === 'https://hosp.example/v2/reservations/' + UUID_OSCAR + '/messages', '1 · con el «Si» sale una vez al uuid exacto de la reserva del borrador: ' + JSON.stringify(posts[0] || r));
  ok(r.enviado_a && r.enviado_a.codigo === 'HMWM942RSN', '1 · Alma sabe a quién salió (HMWM942RSN)');
  ok(!X.reservaBorradorPendiente_(ADM), '1 · el borrador se usa una sola vez');
}
/* 2 · «Sí, envíalo» sin decir a quién, y con el nombre: el borrador manda (aunque haya otro Oscar en Brunelo 1808) */
{ const { X, posts } = caja();
  turno(X, 'escríbele a Oscar de Brunelo 1808'); X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Oscar', propiedad: 'Brunelo 1808', texto: MSG, canal: 'plataforma', borrador: true }, ctxH());
  turno(X, 'sí, envíalo');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { texto: '', canal: 'plataforma', confirmado: true }, ctxH());
  ok(r.ok && posts.length === 1 && posts[0].url.indexOf(UUID_OSCAR) > 0 && posts[0].body.indexOf('3 horas') > 0, '2 · «sí» sin código: sale el texto del borrador a su reserva');
  turno(X, 'mándaselo a Oscar'); X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Oscar Suchite', texto: 'Oscar, mañana puedes salir a las 2 pm.', canal: 'plataforma', borrador: true }, ctxH());
  turno(X, 'Si');
  const r2 = X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Oscar', propiedad: 'Brunelo 1808', texto: 'Oscar, mañana puedes salir a las 2 pm.', canal: 'whatsapp', confirmado: true }, ctxH());
  ok(r2.ok && posts.length === 2 && posts[1].url.indexOf(UUID_OSCAR) > 0 && posts.every((p) => p.url.indexOf(UUID_MELGAR) < 0), '2 · «sí» con el nombre: va a la reserva del borrador (nunca a Oscar Melgar) y por la plataforma del borrador');
}
/* 3 · sin borrador: el código igual encuentra la conversación y la bandeja queda reparada */
{ const { X, posts, gets, inbox } = caja();
  ok(X.agResId_('HMWM942RSN') === UUID_OSCAR, '3 · agResId_ encuentra la conversación aunque la bandeja no tenga el código (antes devolvía «»)');
  ok(gets.some((u) => /date_query=checkin&start_date=2026-11-06&end_date=2026-11-08/.test(u)), '3 · la busca en Hospitable por su fecha de llegada');
  ok(inbox[0].codigo === 'HMWM942RSN' && inbox[0].propiedad === 'Z10 - Brunelo - 1808', '3 · la fila de la bandeja recupera el código y la propiedad');
  const n = gets.length; X.agResId_('HMWM942RSN');
  ok(gets.length === n, '3 · la segunda vez no vuelve a Hospitable');
  turno(X, 'Si');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Oscar Suchite', propiedad: 'Brunelo 1808', texto: MSG, canal: 'plataforma' }, ctxH());
  ok(r.ok && posts.length === 1 && posts[0].url.indexOf(UUID_OSCAR) > 0, '3 · por nombre y propiedad, sin código: sale a Oscar Suchite');
  const b = X.agEjecutar_(ADM, 'buscar_reservas', { texto: 'Oscar Brunelo' }, ctxH());
  const fo = (b.reservas || []).filter((x) => x.codigo === 'HMWM942RSN')[0] || {};
  ok(fo.conv_id === UUID_OSCAR, '3 · buscar_reservas ya no dice conv_id vacío para la reserva de hoy');
}
/* 4 · el «sí» que nombra a otra persona no sale al borrador */
{ const { X, posts } = caja();
  turno(X, 'escríbele a Oscar'); X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Oscar', propiedad: 'Brunelo 1808', texto: MSG, canal: 'plataforma', borrador: true }, ctxH());
  turno(X, 'mejor a Estrella');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { huesped: 'Estrella', propiedad: 'Ignacio 1206', texto: 'Hola Estrella', canal: 'plataforma', confirmado: true }, ctxH());
  ok(posts.length === 1 && posts[0].url.indexOf(UUID_ESTRELLA) > 0 && X.reservaBorradorPendiente_(ADM), '4 · nombra a Estrella: sale a Estrella y el borrador de Oscar sigue esperando');
}
/* 5 · Hospitable con error: reintento y error real */
{ const { X, posts } = caja({ respuestasPost: [[429, {}], [429, {}], [429, {}]] });
  turno(X, 'Si');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'HMWM942RSN', texto: MSG, canal: 'plataforma' }, ctxH());
  ok(posts.length === 3, '5 · 429: Hospitable se reintenta (hosp_ espera y vuelve a pedir): ' + posts.length + ' intentos');
  ok(r.error && /Hospitable respondió 429/.test(r.error) && /reintenta en un minuto/.test(r.error) && !/conversaci/i.test(r.error), '5 · 429 que sigue: el error real para Juan, sin inventar otra causa: ' + r.error);
}
{ const { X, posts } = caja({ respuestasPost: [[503, {}], [201, {}]] });
  turno(X, 'Si');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'HMWM942RSN', texto: MSG, canal: 'plataforma' }, ctxH());
  ok(r.ok && posts.length === 2, '5 · 503 de paso: se reintenta una vez y sale');
}
{ const { X, posts } = caja({ respuestasPost: [[422, { message: 'The conversation is closed' }]] });
  turno(X, 'Si');
  const r = X.agEjecutar_(ADM, 'enviar_a_huesped', { codigo: 'HMWM942RSN', texto: MSG, canal: 'plataforma' }, ctxH());
  ok(posts.length === 1 && r.error && /Hospitable respondió 422: The conversation is closed/.test(r.error), '5 · 422: no se reintenta y dice el motivo de Hospitable: ' + r.error);
}

/* 6 · Estrella: la alerta del código sale una vez y se calla cuando el equipo contesta */
const PIN_IGLOO = '[Automated Message for your Self Check-In]\n\nHi Estrella Hernandez,\n\nHere is your igloohome self check-in details at Z10 - Ignacio - 1206 from 31 Oct 2026, 3PM, UTC-06:00 to 07 Nov 2026, 11AM, UTC-06:00.\n\nPlace your palm over the lock keypad and enter below PIN to unlock:\n\nCasa Ignacio 1206:\n 000000000🔓';
const CONT = 'Entendido, gracias por contarnos. Ya avisé al equipo y te contactan por este chat en breve.';
function cajaCodigo(hilo) {
  const { X, cache } = caja();
  const avisos = [], estados = [];
  Object.assign(X, {
    C: { estado: 0, datos: 1, nota: 2, intentos: 3, proximo: 4 }, cfg_: (k) => (k === 'CODIGO_REVISION_MIN' ? 6 : 0),
    set_: (sh, f, o) => { Object.assign(f.est = f.est || {}, o); estados.push(o); },
    log_() {}, reintentar_() { throw new Error('no debía reintentar'); }, enviarCanal_: () => ({ code: 201 }),
    compacto_: (c, o) => Object.assign({}, c, o), contencion_: () => CONT, avisarAdmins_: (asunto, texto, critico) => avisos.push({ asunto, texto, critico: !!critico }),
    codigoEmergencia_: () => null, mensajeEmergencia_: () => '', escalar_() {},
    hiloConv_: () => ({ code: 200, hilo: hilo() })
  });
  vm.runInContext(['codigoEnviadoEnHilo_', 'manejarCodigo_', 'verificarCodigo_'].map(sacar).join('\n') + '\nvar RX_CODIGO_ENVIADO_ = /(c[oó]digo|clave|contrase[nñ]a|\\bpin\\b|\\bcode\\b|passcode)[^\\d\\n]{0,48}\\d{4,8}\\b/i;', X);
  return { X, cache, avisos, estados };
}
const ctxE = (texto, cont) => ({ resId: UUID_ESTRELLA, codigo: 'HM5TWHD8KK', huesped: 'Estrella Hernandez', propiedad: 'Z10 - Ignacio - 1206', checkin: '2026-10-31', checkout: '2026-11-08', texto, modo: 'AUTO', idioma: 'es', contencionReciente: !!cont });
const fila = (n) => ({ fila: n, v: [] });
const filaRev = (c, d) => ({ fila: 99, v: ['esperando_codigo', JSON.stringify(Object.assign({ resId: UUID_ESTRELLA, codigo: 'HM5TWHD8KK', huesped: 'Estrella', propiedad: 'Z10 - Ignacio - 1206', checkin: '2026-10-31', checkout: '2026-11-08', borrador: CONT }, d)), '', 0, ''] });
const hiloBase = () => [
  { tipo: 'host', auto: true, texto: PIN_IGLOO, created: '2026-10-31T20:04:40Z', fuente: 'platform' },
  { tipo: 'guest', texto: 'Pero no funciona el código de ingreso', created: '2026-11-07T23:36:42Z' },
  { tipo: 'host', auto: false, texto: CONT, created: '2026-11-07T23:37:34Z', fuente: 'public_api' }
];
{ let hilo = hiloBase();
  const { X, avisos, estados } = cajaCodigo(() => hilo);
  ok(X.pinVenceAntes_(hilo, '2026-11-08') && X.pinVenceAntes_(hilo, '2026-11-08').hasta === '2026-11-07', '6 · lee del mensaje de igloohome que el PIN vale hasta el 07-nov (su salida es el 08-nov)');
  ok(!X.pinVenceAntes_(hilo, '2026-11-07'), '6 · si la salida es el mismo día del PIN, no avisa');
  /* Tres mensajes seguidos, como el 7-nov: la revisión se abre una sola vez. */
  X.manejarCodigo_({}, fila(1), [], ctxE('Pero no funciona el código de ingreso'), hilo);
  X.manejarCodigo_({}, fila(2), [], ctxE('Puedo volver a intentar entrar con el mismo código?', true), hilo);
  X.manejarCodigo_({}, fila(3), [], ctxE('Sigue marcando en rojo', true), hilo);
  ok(avisos.length === 1 && estados.filter((e) => e.estado === 'esperando_codigo').length === 1, '6 · tres mensajes del huésped: una sola revisión y un solo aviso (antes 3 y 3)');
  ok(/vale hasta el 07 Nov 2026, 11AM/.test(avisos[0].texto) && /salida es el 2026-11-08/.test(avisos[0].texto), '6 · el aviso dice que el PIN de igloohome vence antes de la salida');
  /* A los 6 min nadie contestó: la alerta urgente sale una vez; una segunda revisión ya no avisa. */
  X.verificarCodigo_({}, filaRev(0, { contencionAt: '2026-11-07T23:37:36Z' }));
  X.verificarCodigo_({}, filaRev(0, { contencionAt: '2026-11-07T23:47:18Z' }));
  const urg = avisos.filter((a) => a.critico);
  ok(urg.length === 1 && /sigue sin su código/.test(urg[0].texto) && /PIN de igloohome/.test(urg[0].texto), '6 · «El huésped sigue sin su código» sale una sola vez (antes 5:44, 5:56 y 5:58)');
}
{ let hilo = hiloBase().concat([{ tipo: 'host', auto: false, texto: 'Hola', created: '2026-11-07T23:56:01Z', fuente: 'hospitable' }]);
  const { X, avisos, estados } = cajaCodigo(() => hilo);
  X.verificarCodigo_({}, filaRev(0, { contencionAt: '2026-11-07T23:51:21Z' }));
  ok(avisos.length === 0 && estados.some((e) => /equipo ya respondió/.test(e.nota || '')), '6 · Juan contestó en la conversación (Hospitable) después de la contención: no hay alerta y la revisión se cierra');
  X.manejarCodigo_({}, fila(4), [], ctxE('Sigue en rojo', true), hilo);
  ok(avisos.length === 0, '6 · y el siguiente mensaje del huésped tampoco abre otra alerta');
}
{ const hilo = hiloBase().concat([{ tipo: 'host', auto: false, texto: 'Te escribe Alma: seguimos en eso.', created: '2026-11-07T23:45:00Z', fuente: 'public_api' }]);
  const { X, avisos } = cajaCodigo(() => hilo);
  X.verificarCodigo_({}, filaRev(0, { contencionAt: '2026-11-07T23:37:36Z' }));
  ok(avisos.filter((a) => a.critico).length === 1, '6 · un mensaje de ALMA (public_api) no cuenta como respuesta del equipo: la alerta sale');
}

/* 7 · ningún «Hospitable HTTP» suelto ni «conversación activa» inventada en el envío */
{ const ag = leer('agente.js'), env = leer('enviohuesped.js');
  ok(!/conversaci[oó]n activa/i.test(env) || /no tiene conversación activa»/.test(env), '7 · el código no inventa «no tiene conversación activa» como causa');
  ok(!/'Hospitable HTTP ' \+ env\.code/.test(COD), '7 · hubResponder_ ya no devuelve «Hospitable HTTP N» sin explicar');
  ok(/borrador: \{ type: 'boolean'/.test(ag), '7 · enviar_a_huesped tiene borrador = true para guardar a qué reserva va');
}
process.exit(fallo);
