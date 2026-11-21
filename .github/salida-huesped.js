/* Prueba con dobles de la salida al huésped (apps-script/salidahuesped.js; 18-nov-2026). Sin Google, Hospitable ni Meta.
   Un huésped de una consulta recibió el razonamiento interno de Alma («El huésped está pidiendo… Según la base de
   conocimiento, ALMA no puede aprobar… la reserva no está confirmada…», «---» y recién la respuesta). Revisa que:
   1. el caso (anonimizado) sale recortado: solo la respuesta que va después del separador;
   2. sin separador ni rótulo no sale nada (ok = false);
   3. los mensajes normales de Alma y del equipo salen sin tocar ni un carácter (también con «---» decorativo);
   4. hosp_ (Hospitable: reservas, consultas y programados) no llama a la red con un texto así y devuelve 422 «bloqueado»,
      y el aviso a Pendientes sale una sola vez; con el recorte, a Hospitable le llega solo la respuesta;
   5. enviarPendiente_ (la cola) deja la fila en «borrador» sin reintentar;
   6. el cableado: waResponder_, adjEnviarWa_ y redesEnviar_ pasan por salidaHuesped_ y nadie más llama a la API de
      Hospitable sin pasar por hosp_.
   node .github/salida-huesped.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const SAL = leer('salidahuesped.js'), COD = leer('Código.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

function caja() {
  const avisos = [], llamadas = [], filas = [], logs = [], cache = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { HOSPITABLE_API: 'https://hosp.test/v2', MAX_INTENTOS: 3 },
    C: { intentos: 7, datos: 10, estado: 6, reservation_id: 2 },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'tok' }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    Utilities: { sleep() {} },
    avisarAdmins_: (asunto, texto, critico) => avisos.push({ asunto, texto, critico }),
    acortarEnTexto_: t => t,
    uf_: (url, opt) => { llamadas.push({ url, body: JSON.parse(opt.payload || '{}').body }); return { getResponseCode: () => 200, getContentText: () => '{}', getHeaders: () => ({}) }; },
    cacheEnvio_() {}, registrarEnvioInq_() {}, s_: x => (x == null ? '' : String(x)),
    hiloConv_: () => ({ code: 200, hilo: [{ tipo: 'guest', created: 'T1' }] }),
    turnoPendiente_: () => ({ pendiente: true, turno: [{ created: 'T1' }] }),
    observar_() {}, avisarSeguimiento_() {}, earlyRegistrar_() {},
    set_: (sh, f, c) => filas.push(Object.assign({ fila: f.fila }, c)),
    log_: (d, t, accion) => logs.push(accion),
    reintentar_: (sh, f, motivo) => filas.push({ fila: f.fila, reintento: motivo })
  };
  vm.createContext(ctx);
  vm.runInContext(SAL + '\n' + fs.readFileSync(path.join(DIR, 'colareproceso.js'), 'utf8') + '\n' + ['hosp_', 'limpiarSalida_', 'textoEnviable_', 'enviarCanal_', 'enviarPendiente_'].map(n => sacar(COD, n)).join('\n') +
    '\nvar TOKEN_SILENCIO_ = /\\[?\\s*\\b(SIN[\\s_-]*RESPUESTA|NO[\\s_-]*RESPONDER|NO[\\s_-]*REPLY|NO[\\s_-]*RESPONSE|SILENCIO)\\b\\s*\\]?\\.?/ig;', ctx);
  return { ctx, avisos, llamadas, filas, logs };
}

/* El caso del 18-nov, anonimizado (sin nombre, sin propiedad, sin texto real). */
const RESPUESTA = '¡Hola! Con gusto te ayudo. Para apartar el apartamento, toca «Reservar» en nuestro anuncio con tus fechas. Si algo no te deja, escríbenos por aquí y lo vemos.';
const FUGA = 'El huésped está pidiendo que le confirmemos la estadía de esta noche. Según la base de conocimiento, ALMA no puede aprobar ' +
  'reservas ni garantizar fechas, y la reserva no está confirmada todavía. Debo responderle con amabilidad y explicarle cómo reservar.\n\n---\n\n' + RESPUESTA;
const SIN_CORTE = 'El huésped está pidiendo que le confirmemos la estadía de esta noche. Según la base de conocimiento, ALMA no puede aprobar reservas. ' + RESPUESTA;

const { ctx } = caja();
let r = ctx.salidaHuesped_(FUGA);
ok(r.ok && r.recortado && r.texto === RESPUESTA, '1. el caso del 18-nov sale recortado: solo la respuesta después de «---»');
ok(!/hu[eé]sped est[aá]|base de conocimiento|ALMA/.test(r.texto), '1. el recorte no trae nada del análisis');
r = ctx.salidaHuesped_(SIN_CORTE);
ok(!r.ok && !r.texto && r.motivo, '2. sin separador no sale nada (' + r.motivo + ')');
r = ctx.salidaHuesped_('Análisis: el usuario quiere saber si hay parqueo.\nRespuesta al huésped:\nHola, sí: el edificio tiene un parqueo para ti sin costo.');
ok(r.ok && r.recortado && r.texto === 'Hola, sí: el edificio tiene un parqueo para ti sin costo.', '1. con rótulo «Respuesta al huésped:» sale solo lo que sigue');
r = ctx.salidaHuesped_('The guest is asking about late check-out. According to the knowledge base we can offer it until 1 pm.\n---\nHi! Sure, you can check out at 1 pm at no extra cost.');
ok(r.ok && r.texto === 'Hi! Sure, you can check out at 1 pm at no extra cost.', '1. en inglés también se recorta');
r = ctx.salidaHuesped_('<thinking>El huésped pregunta por el WiFi.</thinking>\nHola, la red y la clave están en la tarjeta junto al router.');
ok(r.ok && r.texto === 'Hola, la red y la clave están en la tarjeta junto al router.', '1. un bloque <thinking> se quita');
r = ctx.salidaHuesped_('Análisis previo de la consulta.\n---\nEl huésped está pidiendo descuento; Alma no puede darlo.');
ok(!r.ok, '2. si después del separador sigue el análisis, no sale');

const NORMALES = [
  RESPUESTA,
  '¡Hola, bienvenida! El check-in es desde las 3:00 p. m. y el check-out hasta las 11:00 a. m.\n\n---\n\nCualquier cosa, aquí estoy. Soy Alma, de Spacio AM.',
  'Hola, la reserva no está confirmada todavía en Airbnb: cuando la confirmes te mando los detalles de acceso.',
  'Hi! The apartment has a fully equipped kitchen and a washer. Let me know if you need anything else.',
  'Hola, Alma te ayuda con lo que necesites. El parqueo es el número que te mandamos el día de llegada.',
  'Claro que sí. En la cocina hay caja de herramientas básica por si la necesitas.',
  'Hola, te escribe el equipo de Spacio AM. Ya revisamos el aire acondicionado y quedó funcionando.'
];
NORMALES.forEach((t, i) => { const x = ctx.salidaHuesped_(t); ok(x.ok && !x.recortado && x.texto === t, '3. mensaje normal ' + (i + 1) + ' sale sin tocar'); });

/* 4. hosp_: la puerta de Hospitable. */
let k = caja();
let env = k.ctx.hosp_('post', '/reservations/inq:abc-123/messages', { body: SIN_CORTE });
ok(env.code === 422 && env.bloqueado === 'razonamiento' && !k.llamadas.length, '4. hosp_ no llama a Hospitable con razonamiento y devuelve 422 bloqueado');
k.ctx.hosp_('patch', '/scheduled-messages/9', { body: SIN_CORTE });
ok(k.avisos.length === 1 && k.avisos[0].critico === false && /inquiries\/abc-123/.test(k.avisos[0].texto), '4. un solo aviso a Pendientes (sin WhatsApp) aunque el mismo texto se intente por dos caminos');
k.ctx.hosp_('post', '/reservations/r-9/messages', { body: 'Otro caso. ' + SIN_CORTE });
ok(k.avisos.length === 2 && /r-9/.test(k.avisos[1].texto), '4. otro texto sí abre su aviso');
env = k.ctx.hosp_('post', '/inquiries/abc-123/messages', { body: FUGA });
ok(env.code === 200 && k.llamadas.length === 1 && k.llamadas[0].body === RESPUESTA, '4. con el recorte, a Hospitable le llega solo la respuesta');
env = k.ctx.hosp_('post', '/reservations/r-1/messages', { body: NORMALES[1] });
ok(k.llamadas.length === 2 && k.llamadas[1].body === NORMALES[1], '4. un mensaje normal llega a Hospitable igual');
k.ctx.hosp_('get', '/reservations/r-1/messages');
ok(k.llamadas.length === 3, '4. las lecturas no pasan por la revisión');

/* 5. la cola: la fila queda en revisión, sin reintento. */
k = caja();
const fila = { fila: 77, v: [] }; fila.v[6] = 'esperando_envio'; fila.v[10] = JSON.stringify({ resId: 'inq:abc-123', borrador: SIN_CORTE, ultimoGuestAt: 'T1', nivel: 'VERDE', codigo: '' });
k.ctx.enviarPendiente_({}, fila, { toggle: 'ON', modo: 'AUTO' }, [fila]);
k.filas = k.filas.filter(x => x.estado !== 'enviando');   // la marca de antes de mandar (consultas-atrasadas.js)
ok(k.filas.length === 1 && k.filas[0].estado === 'borrador' && !k.filas[0].reintento && !k.llamadas.length, '5. la cola deja la fila en «borrador» sin reintentar y sin mandar');
ok(/RETENIDO/.test(k.logs[0] || ''), '5. el log dice RETENIDO');

/* 6. cableado. */
const fn = (src, n) => sacar(src, n);
ok(/salidaHuesped_\(/.test(fn(COD, 'waResponder_')), '6. waResponder_ (WhatsApp del huésped) pasa por salidaHuesped_');
ok(/salidaHuesped_\(/.test(fn(leer('adjuntos.js'), 'adjEnviarWa_')), '6. adjEnviarWa_ (fotos con texto) pasa por salidaHuesped_');
ok(/salidaHuesped_\(/.test(fn(leer('redesmeta.js'), 'redesEnviar_')), '6. redesEnviar_ (Instagram y Messenger) pasa por salidaHuesped_');
const h = fn(COD, 'hosp_'); ok(h.indexOf('salidaHuesped_(') > 0 && h.indexOf('salidaHuesped_(') < h.indexOf('uf_('), '6. hosp_ revisa antes de llamar a la red');
const fuera = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).filter(f => {
  const s = leer(f).replace(/\nfunction hosp_\([\s\S]*?\n\}/, '');
  return /uf_\(\s*CFG\.HOSPITABLE_API/.test(s);
});
ok(!fuera.length, '6. nadie llama a la API de Hospitable sin hosp_ (usa hosp_ para que la salida se revise)' + (fuera.length ? ': ' + fuera.join(', ') : ''));

if (fallo) process.exit(1);
console.log('OK salida al huésped');
