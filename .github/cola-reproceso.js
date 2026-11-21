/* Prueba con dobles de la cola en error (apps-script/colareproceso.js) y del envío que Hospitable rechaza (enviarPendiente_ y
   hosp_ en Código.js). Sin Google ni Hospitable. 21-nov-2026: la cola tenía ~1 555 filas y cola_errores / cola_reprocesar
   solo miraban las últimas 500: las filas del 16-17 nov no se podían ver ni reprocesar. Revisa que:
   1. cola_errores con desde/hasta (día de Guatemala) encuentra filas viejas en toda la hoja y trae fila, fecha, propiedad,
      canal, nombre de pila y error; sin rango sigue mirando solo las últimas 500;
   2. lee por bloques (nunca más de 500 filas por lectura) y la fila completa solo de las que sirven;
   3. cola_reprocesar encuentra una fila vieja por número o por message_id, rechaza un message_id que no coincide y deja
      dicho a procesarColaNucleo_ desde qué fila leer (COLA_REPROCESO_DESDE); la cola la lee y luego lo borra;
   4. un 400 de Hospitable sin «message» trae su cuerpo crudo en la nota; en una consulta (inq:) queda en revisión y el
      borrador va a Pendientes para responder desde la plataforma; en una reserva va a «error» al primer intento.
   node .github/cola-reproceso.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), COLA = leer('colareproceso.js'), SAL = leer('salidahuesped.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const HEAD = ['recibido', 'message_id', 'reservation_id', 'conversation_id', 'huesped', 'texto', 'estado', 'intentos', 'proximo', 'nota', 'datos'];

/* 1 555 filas: una cada 12 min desde el 14-nov; en error, la 300 (16-nov), la 400 (17-nov, Guatemala) y la 1 500 (reciente). */
function hoja() {
  const filas = [HEAD];
  const t0 = Date.parse('2026-11-14T00:00:00Z');
  for (let f = 2; f <= 1555; f++) {
    const err = f === 300 || f === 400 || f === 1500;
    filas.push([new Date(t0 + (f - 2) * 12 * 60000).toISOString(), 'm' + f, f === 400 ? 'inq:q-400' : 'r-' + f, '', 'Persona' + f + ' Apellido', 'hola ' + f,
      err ? 'error' : 'respondido', err ? 3 : 0, '', err ? 'envío HTTP 400' : '', f === 300 ? JSON.stringify({ propiedad: 'Z99 - Prueba - 101', canal: 'airbnb' }) : '']);
  }
  const lecturas = [];
  const sh = {
    getLastRow: () => filas.length,
    getRange: (r, c, n, m) => ({
      getValues: () => { lecturas.push(n || 1); return filas.slice(r - 1, r - 1 + (n || 1)).map(x => x.slice(c - 1, c - 1 + (m || 1))); },
      setValue: v => { filas[r - 1][c - 1] = v; }
    })
  };
  return { filas, sh, lecturas };
}
function caja() {
  const H = hoja(), props = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { TAB_COLA: 'ALMA_COLA', MAX_INTENTOS: 3 }, COLA_HEADERS: HEAD, C: {},
    hoja_: () => H.sh, s_: x => (x == null ? '' : String(x)),
    hubInbox_: () => [{ conv_id: 'inq:q-400', propiedad: 'Z98 - Consulta - 202', huesped: 'Persona400' }],
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) }, avisarAdmins_() {}
  };
  HEAD.forEach((h, i) => { ctx.C[h] = i; });
  ctx.set_ = (sh, f, c) => Object.keys(c).forEach(k => { f.v[ctx.C[k]] = c[k]; sh.getRange(f.fila, ctx.C[k] + 1).setValue(c[k]); });
  vm.createContext(ctx); vm.runInContext(SAL + '\n' + COLA, ctx);
  return { ctx, H, props };
}

let { ctx, H, props } = caja();
let r = ctx.colaErrores_({});
ok(r.ok && r.filas.length === 1 && r.filas[0].fila === 1500, '1. sin rango: solo las últimas 500 (como antes)');
H.lecturas.length = 0;
r = ctx.colaErrores_({ desde: '2026-11-16', hasta: '2026-11-17' });
ok(r.filas.map(f => f.fila).join() === '300,400', '1. del 16 al 17 de nov encuentra las filas viejas 300 y 400 (' + r.filas.map(f => f.fila).join() + ')');
const a = r.filas[0], b = r.filas[1];
ok(a.fecha && a.propiedad === 'Z99 - Prueba - 101' && a.canal === 'airbnb' && a.nombre === 'Persona300' && a.error === 'envío HTTP 400', '1. trae fila, fecha, propiedad, canal, nombre de pila y error');
ok(b.propiedad === 'Z98 - Consulta - 202' && b.canal === 'consulta', '1. sin datos guardados, la propiedad sale de la bandeja y el canal del id');
ok(H.lecturas.every(n => n <= 500), '2. ninguna lectura pasa de 500 filas (' + Math.max.apply(null, H.lecturas) + ')');
ok(H.lecturas.filter(n => n > 1).length <= 8, '2. lee por columnas y bloques, no fila por fila (' + H.lecturas.length + ' lecturas)');
r = ctx.colaErrores_({ filas: [400], detalle: true });
ok(r.filas.length === 1 && r.filas[0].detalle && r.filas[0].detalle.salida === 'limpia', '1. por número de fila, con detalle para diagnosticar');
r = ctx.colaErrores_({ message_ids: ['m300'] });
ok(r.filas.length === 1 && r.filas[0].fila === 300, '1. por message_id, en toda la hoja');

r = ctx.colaReprocesar_({ filas: [{ fila: 300, message_id: 'm300' }, { fila: 400, message_id: 'otro' }, { message_id: 'm1500' }, { fila: 20, message_id: 'm20' }] });
const por = {}; r.filas.forEach(x => { por[x.fila] = x; });
ok(por[300].hecho && H.filas[299][6] === 'pendiente' && H.filas[299][7] === 0, '3. la fila vieja 300 vuelve a «pendiente»');
ok(!por[400].hecho && por[400].motivo === 'message_id no coincide' && H.filas[399][6] === 'error', '3. un message_id que no coincide no se toca');
ok(por[1500].hecho, '3. por message_id solo también se encuentra');
ok(!por[20].hecho && /ya no está en error/.test(por[20].motivo), '3. una fila que no está en error no se toca');
ok(props.COLA_REPROCESO_DESDE === '300' && props.ALMA_ACTIVO === '1', '3. le deja a la cola desde qué fila leer (300)');

/* 3b. procesarColaNucleo_ lee desde esa fila y lo borra cuando ya no queda nada vivo atrás. */
const nucleo = sacar(COD, 'procesarColaNucleo_');
ok(/COLA_REPROCESO_DESDE/.test(nucleo) && /deleteProperty\('COLA_REPROCESO_DESDE'\)/.test(nucleo), '3. procesarColaNucleo_ usa COLA_REPROCESO_DESDE y lo borra al terminar');
ok(/hoja_\(CFG\.TAB_COLA\)/.test(sacar(COLA, 'colaFilasError_')) && !/n - 499\), lim/.test(COLA), '3. ya no hay un tope fijo de 500 al buscar');

/* 4. el 400 de Hospitable. */
const k = { avisos: [], pend: [] }, filasSet = [];
const c2 = {
  console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, Error,
  CFG: { HOSPITABLE_API: 'https://hosp.test/v2', MAX_INTENTOS: 3 }, C: {},
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'tok' }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) }, Utilities: { sleep() {} },
  avisarAdmins_: (a, t) => k.pend.push(t), acortarEnTexto_: t => t, cacheEnvio_() {}, registrarEnvioInq_() {}, s_: x => (x == null ? '' : String(x)),
  uf_: () => ({ getResponseCode: () => 400, getContentText: () => 'Bad Request: inquiry is closed', getHeaders: () => ({}) }),
  hiloConv_: () => ({ code: 200, hilo: [{ tipo: 'guest', created: 'T1' }] }), turnoPendiente_: () => ({ pendiente: true, turno: [{ created: 'T1' }] }),
  observar_() {}, avisarSeguimiento_() {}, earlyRegistrar_() {}, log_() {}, notificar_: () => k.avisos.push(1), ahora_: () => new Date(),
  set_: (sh, f, c) => filasSet.push(c)
};
HEAD.forEach((h, i) => { c2.C[h] = i; });
vm.createContext(c2);
vm.runInContext(SAL + '\n' + ['hosp_', 'limpiarSalida_', 'textoEnviable_', 'enviarCanal_', 'enviarPendiente_', 'reintentar_'].map(n => sacar(COD, n)).join('\n') +
  '\nvar TOKEN_SILENCIO_ = /\\[?\\s*\\b(SIN[\\s_-]*RESPUESTA|NO[\\s_-]*RESPONDER)\\b\\s*\\]?\\.?/ig;', c2);
const env = c2.hosp_('post', '/reservations/inq:q-1/messages', { body: 'Hola, con gusto te ayudo con tu consulta de hoy.' });
ok(env.code === 400 && env.error === 'Bad Request: inquiry is closed', '4. hosp_ trae el cuerpo crudo de un 400 sin «message»');
const fila = { fila: 9, v: [] }; fila.v[c2.C.datos] = JSON.stringify({ resId: 'inq:q-1', borrador: 'Hola, con gusto te ayudo con tu consulta de hoy.', ultimoGuestAt: 'T1', nivel: 'VERDE' });
fila.v[c2.C.intentos] = 0;
c2.enviarPendiente_({ getRange: () => ({ setValue() {} }) }, fila, { toggle: 'ON', modo: 'AUTO' }, [fila]);
const ult = filasSet[filasSet.length - 1] || {};
ok(ult.estado === 'borrador' && /HTTP 400 · Bad Request: inquiry is closed/.test(ult.nota) && /plataforma/.test(ult.nota) && k.pend.length === 1 && /borrador de Alma/.test(k.pend[0]), '4. una consulta que Hospitable rechaza queda en revisión con el motivo y el borrador va a Pendientes, sin reintentar');
filasSet.length = 0;
const fila2 = { fila: 10, v: [] }; fila2.v[c2.C.datos] = JSON.stringify({ resId: 'r-77', borrador: 'Hola, con gusto te ayudo con tu consulta de hoy.', ultimoGuestAt: 'T1', nivel: 'VERDE' }); fila2.v[c2.C.intentos] = 0;
c2.enviarPendiente_({ getRange: () => ({ setValue() {} }) }, fila2, { toggle: 'ON', modo: 'AUTO' }, [fila2]);
const ult2 = filasSet[filasSet.length - 1] || {};
ok(ult2.estado === 'error' && /HTTP 400 · Bad Request: inquiry is closed/.test(ult2.nota) && k.avisos.length === 1, '4. en una reserva, el 400 va a «error» al primer intento, con el motivo de Hospitable y un aviso');

if (fallo) process.exit(1);
console.log('OK cola en error');
