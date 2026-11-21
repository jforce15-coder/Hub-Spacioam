/* Prueba con dobles de las 4 fallas del 21-nov-2026, al reprocesar consultas atrasadas (casos anonimizados). Sin Google
   ni Hospitable. Revisa que:
   1. Mensaje doble: hosp_ no manda dos veces el mismo texto a la misma conversación (15 min) ni reintenta un POST de
      mensaje tras un 429; enviarPendiente_ relee la fila y no manda una que ya está «enviando» o «respondido»; de dos
      respuestas listas para la misma conversación sale una; un fallo a medio envío va a «error», no se reintenta solo;
      una pasada de la cola no arranca si otra sigue viva (COLA_EN_CURSO);
   2. Disculpa: con más de 3 h de demora el redactor lo sabe y la respuesta empieza (tras el saludo) con una disculpa
      breve, en el idioma del huésped; con poca demora no se agrega nada;
   3. Datos públicos: el piso sale del número del apartamento (404 → 4, 623 → 6, 1004 → 10) o de la dirección pública, la
      referencia pública del anuncio llega sin calles ni número de unidad, una reserva sin confirmar los conserva, y si
      preguntó el piso la respuesta lo dice; el precio se responde con la tarifa del calendario, no con una promesa;
   4. Promesas: lo que promete algo al huésped queda registrado ANTES de salir; si no se puede registrar, la frase sale
      del texto; si el modelo no responde, se registra con la frase misma;
   5. cola_descartar: solo filas en «error», con motivo obligatorio, a «descartado» y con registro, sin mandar nada.
   node .github/consultas-atrasadas.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), SAL = leer('salidahuesped.js'), COLA = leer('colareproceso.js'), RF = leer('respuestafija.js'), PROM = leer('promesas.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const HEAD = ['recibido', 'message_id', 'reservation_id', 'conversation_id', 'huesped', 'texto', 'estado', 'intentos', 'proximo', 'nota', 'datos'];
const H = 3600000;
const base = () => ({ console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, Error, s_: x => (x == null || typeof x === 'object' ? '' : String(x)) });
function cacheMem() { const m = {}; return { m, get: k => (k in m ? m[k] : null), put: (k, v) => { m[k] = v; }, remove: k => { delete m[k]; } }; }

/* ── 1. Mensaje doble ── */
{
  const cache = cacheMem(), llamadas = [];
  let respuesta = 201;
  const ctx = Object.assign(base(), {
    CFG: { HOSPITABLE_API: 'https://hosp.test/v2', MAX_INTENTOS: 3 }, C: {},
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'tok' }) },
    CacheService: { getScriptCache: () => cache }, Utilities: { sleep() {} },
    avisarAdmins_() {}, acortarEnTexto_: t => t, cacheEnvio_() {}, registrarEnvioInq_() {},
    uf_: (url, opt) => { llamadas.push(JSON.parse(opt.payload || '{}').body); const c = respuesta; return { getResponseCode: () => c, getContentText: () => '{}', getHeaders: () => ({}) }; }
  });
  HEAD.forEach((h, i) => { ctx.C[h] = i; });
  vm.createContext(ctx); vm.runInContext(SAL + '\n' + sacar(COD, 'hosp_'), ctx);
  const T = 'Hola, Persona.\n\nEl apartamento está en el piso 4 del edificio.';
  const a = ctx.hosp_('post', '/reservations/inq:q-1/messages', { body: T });
  const b = ctx.hosp_('post', '/inquiries/q-1/messages', { body: T });
  ok(a.code === 201 && b.code === 200 && b.duplicado && llamadas.length === 1, '1. el mismo texto a la misma consulta sale una vez (la segunda vuelve como duplicado, sin POST)');
  ctx.hosp_('post', '/inquiries/q-1/messages', { body: 'Otro texto distinto para la misma consulta.' });
  ctx.hosp_('post', '/inquiries/q-2/messages', { body: T });
  ok(llamadas.length === 3, '1. otro texto, u otra conversación, sí sale');
  respuesta = 429; llamadas.length = 0;
  const c = ctx.hosp_('post', '/reservations/r-9/messages', { body: 'Texto que choca con el límite.' }, { sinReintentos: true });
  ok(c.code === 429 && llamadas.length === 1, '1. la cola manda sin reintentos: un 429 no se reintenta en el momento (pudo haber salido)');
  ok(/d\.cola \? \{ sinReintentos: true \}/.test(sacar(COD, 'enviarCanal_')) && /enviarCanal_\(Object\.assign\(\{\}, d, \{ cola: true \}\)/.test(sacar(COD, 'enviarPendiente_')), '1. enviarPendiente_ manda por enviarCanal_ sin reintentos');
  respuesta = 201;
  ctx.hosp_('post', '/reservations/r-9/messages', { body: 'Texto que choca con el límite.' });
  ok(llamadas.length === 2, '1. tras un rechazo la marca se suelta y el reintento de la cola sí puede mandarlo');
}
{
  const envios = [], setsPor = {};
  const ctx = Object.assign(base(), {
    CFG: { MAX_INTENTOS: 3 }, C: {}, ahora_: () => new Date(),
    hiloConv_: () => ({ code: 200, hilo: [{ tipo: 'guest', created: 'T1' }] }), turnoPendiente_: () => ({ pendiente: true, turno: [{ created: 'T1' }] }),
    limpiarSalida_: t => ({ texto: t }), textoEnviable_: t => String(t || '').trim().length > 5,
    enviarCanal_: (d, t) => { envios.push(t); return { code: 201 }; },
    observar_() {}, avisarSeguimiento_() {}, earlyRegistrar_() {}, log_() {}, notificar_() {}, avisarAdmins_() {},
    set_: (sh, f, c) => { Object.keys(c).forEach(k => { f.v[ctx.C[k]] = c[k]; }); (setsPor[f.fila] = setsPor[f.fila] || []).push(c); }
  });
  HEAD.forEach((h, i) => { ctx.C[h] = i; });
  vm.createContext(ctx); vm.runInContext(COLA + '\n' + ['enviarPendiente_', 'reintentar_', 'protegido_'].map(n => sacar(COD, n)).join('\n'), ctx);
  const fila = (n, estado) => { const v = []; v[ctx.C.reservation_id] = 'inq:q-1'; v[ctx.C.estado] = estado; v[ctx.C.intentos] = 0;
    v[ctx.C.datos] = JSON.stringify({ resId: 'inq:q-1', borrador: 'Hola, Persona. Te cuento lo que preguntaste.', ultimoGuestAt: 'T1', nivel: 'VERDE' }); return { fila: n, v }; };
  const hoja = estadoReal => ({ getRange: () => ({ setValue() {}, getValue: () => estadoReal }) });
  const ctrl = { toggle: 'ON', modo: 'AUTO' };
  let f1 = fila(742, 'esperando_envio');
  ctx.enviarPendiente_(hoja('enviando'), f1, ctrl, [f1]);
  ok(envios.length === 0, '1. una fila que otra pasada ya marcó «enviando» no se manda otra vez');
  f1 = fila(742, 'esperando_envio');
  ctx.enviarPendiente_(hoja('respondido'), f1, ctrl, [f1]);
  ok(envios.length === 0, '1. una fila que ya quedó «respondido» en la hoja no se manda aunque la foto vieja diga «esperando_envio»');
  const vieja = fila(741, 'esperando_envio'), nueva = fila(745, 'esperando_envio');
  ctx.enviarPendiente_(hoja('esperando_envio'), vieja, ctrl, [vieja, nueva]);
  ok(envios.length === 0 && /duplicado: .*fila 745/.test(vieja.v[ctx.C.nota]), '1. dos respuestas listas para la misma conversación: la vieja se omite y sale solo la más nueva');
  ctx.enviarPendiente_(hoja('esperando_envio'), nueva, ctrl, [vieja, nueva]);
  ok(envios.length === 1 && nueva.v[ctx.C.estado] === 'respondido' && setsPor[745].some(c => c.estado === 'enviando'), '1. la fila se marca «enviando» antes de mandar y «respondido» después');
  const g = fila(800, 'enviando'); let reintento = 0; ctx.reintentar_ = () => { reintento++; };
  ctx.protegido_(hoja('enviando'), g, () => { throw new Error('se cortó la red'); });
  ok(g.v[ctx.C.estado] === 'error' && /pudo haber salido/.test(g.v[ctx.C.nota]) && !reintento, '1. un fallo a medio envío va a «error» para revisar; no se reintenta solo');
  const nucleo = sacar(COD, 'procesarColaNucleo_');
  ok(/COLA_EN_CURSO/.test(nucleo) && /inicio - enCurso < 330000/.test(nucleo) && /deleteProperty\('COLA_EN_CURSO'\)/.test(nucleo), '1. procesarColaNucleo_ no arranca si otra pasada sigue viva aunque alguien soltara el candado');
  ok(/yaTenia/.test(sacar(PROM, 'promesaRegistrar_')) && /if \(!yaTenia\) lock\.releaseLock\(\)/.test(PROM), '1. registrar una promesa a media pasada ya no suelta el candado de la cola');
}

/* ── 2 y 3. Disculpa, piso, referencia y precio (respuestafija.js) ── */
const rf = Object.assign(base(), {
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }, CacheService: { getScriptCache: () => cacheMem() },
  turnoPendiente_: hilo => { let i = hilo.length - 1; while (i >= 0 && hilo[i].tipo !== 'guest') i--; let j = i; while (j >= 0 && hilo[j].tipo === 'guest') j--; return { pendiente: i >= 0, turno: hilo.slice(j + 1, i + 1) }; },
  hosp_: (m, u) => (/\/calendar\?start_date=2026-11-23&end_date=2026-11-25/.test(u) ? { code: 200, json: { data: { days: [33, 32, 32].map(n => ({ status: { available: true }, price: { amount: n * 100, currency: 'USD' } })) } } } : { code: 404 })
});
vm.createContext(rf); vm.runInContext(RF, rf);
{
  const ahora = Date.parse('2026-11-21T16:54:00Z');
  const hilo = [{ tipo: 'guest', created: '2026-11-17T03:38:51Z', texto: 'Hola, ¿en qué nivel está? ¿Son 962 quetzales exactos?' }, { tipo: 'host', auto: true, created: '2026-11-17T03:44:05Z', texto: 'Automático' }, { tipo: 'guest', created: '2026-11-17T03:45:18Z', texto: 'Me interesa, ¿qué nivel?' }];
  const h = rf.demoraTurnoHoras_(hilo, ahora);
  ok(h > 100 && h < 110, '2. la demora se mide desde el mensaje sin responder (≈ ' + Math.round(h) + ' h)');
  ok(/disculpa breve por la demora/.test(rf.demoraInstruccion_(h)) && /\d días/.test(rf.demoraInstruccion_(h)), '2. el redactor recibe la demora y la regla de disculparse');
  const t = rf.conDisculpa_('Hola, Persona 🙏\n\nEl apartamento está en el piso 4.', 'es');
  ok(/^Hola, Persona 🙏\n\nDisculpa la demora en responderte\.\n\nEl apartamento/.test(t), '2. la disculpa va justo después del saludo (con su emoji)');
  ok(rf.conDisculpa_(t, 'es') === t, '2. si ya trae disculpa no se repite');
  ok(/^Hi Anna,\n\nSorry for the delay/.test(rf.conDisculpa_('Hi Anna, the flat is on floor 6.', 'en')), '2. en inglés, frase en inglés');
  ok(/^Disculpa la demora/.test(rf.conDisculpa_('El apartamento está en el piso 4.', 'es')), '2. sin saludo, la disculpa abre el mensaje');
  const ctx = { texto: 'qué nivel', demoraHoras: 1, pisoPublico: '' };
  ok(!rf.controlRespuesta_(ctx, 'Hola').some(x => x.k === 'disculpa'), '2. con 1 h de demora no se pide disculpa');
  ctx.demoraHoras = 100;
  ok(rf.controlRespuesta_(ctx, 'Hola, Persona.\n\nTe cuento.').some(x => x.k === 'disculpa'), '2. con 4 días sin disculpa, el control la pide');
}
{
  ok(rf.pisoDeUnidad_('Z10 - Edificio A - 404') === '4' && rf.pisoDeUnidad_('Z13 - Edificio B - 623') === '6' && rf.pisoDeUnidad_('Z10 - Edificio C - 1004') === '10', '3. piso por el número: 404 → 4, 623 → 6, 1004 → 10');
  ok(rf.pisoDeUnidad_('Z4 - Edificio D - 8F') === '8' && rf.pisoDeUnidad_('Z1 - Casa E') === '', '3. «8F» → 8; sin número de unidad, nada');
  ok(rf.pisoDeDireccion_('Apartamento 1004, piso 10, Edificio C') === '10', '3. o el piso que trae la dirección pública');
  const prop = { public_name: 'Zona 10 - Ubicación céntrica - cerca del aeropuerto', address: { number: '404', street: '9A Calle 1-50' },
    summary: 'Apartamento 404 con vista. Estarás a solo minutos de dos centros comerciales. Está en la 9A Calle 1-50. Cerca de restaurantes y tiendas.' };
  const lin = rf.fichaPublicaLineas_('Dirección y edificio: privado', 'Z10 - Edificio A - 404', prop);
  ok(/^\nPiso: 4\n/.test(lin) && /Referencia pública: Nombre del anuncio: Zona 10 - Ubicación céntrica - cerca del aeropuerto/.test(lin) && /minutos de dos centros comerciales/.test(lin), '3. la ficha recibe el piso deducido y la referencia pública del anuncio');
  ok(!/404|1-50|9A Calle/.test(lin), '3. la referencia no trae número de apartamento ni calle');
  ok(!/Piso: /.test(rf.fichaPublicaLineas_('Piso: Cuarto', 'Z10 - Edificio A - 404', null)), '3. si la ficha ya tiene el piso no se repite');
  /* aplicarSinConfirmar_ (reserva sin confirmar) conserva piso y referencia y quita el número de apartamento. */
  const sc = Object.assign(base(), {}); vm.createContext(sc); vm.runInContext(sacar(COD, 'tokensPrivados_') + '\n' + sacar(COD, 'aplicarSinConfirmar_'), sc);
  const c = { propiedad: 'Z10 - Edificio A - 404', apartamento: '404', propiedadInfo: 'Apartamento / unidad: 404' + lin };
  sc.aplicarSinConfirmar_(c);
  ok(/Piso: 4/.test(c.propiedadInfo) && /Referencia pública: /.test(c.propiedadInfo) && c.tokensPrivados.indexOf('404') >= 0 && c.tokensPrivados.indexOf('4') < 0, '3. sin confirmar: piso y referencia se quedan; el 404 sigue privado');
  const ctx = { texto: 'HOLA, ME GUSTARÍA SABER EN QUÉ NIVEL SE ENCUENTRA', demoraHoras: 0, pisoPublico: '4', idioma: 'es' };
  const mal = 'Hola, Persona.\n\nEse dato te lo compartimos cuando la reserva quede confirmada.';
  ok(rf.controlRespuesta_(ctx, mal).some(x => x.k === 'piso'), '3. preguntó el piso, la ficha lo tiene y la respuesta no lo dice → el control rechaza');
  ok(!rf.controlRespuesta_(ctx, 'Está en el piso 4 del edificio.').length && !rf.controlRespuesta_(ctx, 'Queda en el cuarto piso.').length, '3. «piso 4» o «cuarto piso» pasan');
  ok(/El apartamento está en el piso 4\.$/.test(rf.respuestaFija_(ctx, mal)), '3. si después de re-redactar aún falta, se agrega la frase fija');
  const ctxL = Object.assign({}, ctx, { pisoPublico: '' });
  ok(!rf.controlRespuesta_(ctxL, mal).length, '3. sin piso en la ficha no se exige (no se inventa)');
}
{
  const tf = rf.tarifaFechas_('p-1', '2026-11-23', '2026-11-26');
  ok(tf && tf.total === '$97' && tf.porNoche === '$32–$33' && tf.noches === 3, '3. la tarifa sale del calendario de la plataforma: $32–$33 por noche, $97 por 3 noches');
  ok(/PROHIBIDO decir que lo confirmas con el equipo/.test(rf.precioInstruccion_(tf)), '3. el redactor recibe la cifra y la regla de no prometer');
  const ctx = { texto: '¿Son 962 quetzales exactos?', tarifa: tf, idioma: 'es' };
  const mal = 'Hola, Persona.\n\nEl precio exacto lo confirmo con el equipo y te escribimos por aquí mismo.';
  ok(rf.controlRespuesta_(ctx, mal).some(x => x.k === 'precio'), '3. preguntó el precio y Alma promete confirmarlo → el control rechaza');
  ok(!rf.controlRespuesta_(ctx, 'La tarifa es de $33 por noche; el total final lo ves en la plataforma.').length, '3. con la cifra de la plataforma pasa');
  const fijo = rf.respuestaFija_(ctx, mal);
  ok(!/lo confirmo con el equipo/.test(fijo) && /\$32–\$33 por noche \(\$97 por 3 noches\)/.test(fijo), '3. la frase fija cambia la promesa por la tarifa');
  ok(rf.tarifaFechas_('p-1', '2026-11-01', '2026-11-03') === null, '3. sin calendario, sin tarifa (no se inventa)');
}

/* ── 4. Promesas con dueño ── */
function promCaja(o) {
  const filas = [];
  const hoja = { getLastRow: () => filas.length + 1, getLastColumn: () => 18, appendRow: r => { if (o.hojaRota) throw new Error('hoja'); filas.push(r); },
    getRange: (r, c, nr, nc) => ({ getValues: () => filas.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)), setValue: v => { filas[r - 2][c - 1] = v; }, setValues: vs => { vs[0].forEach((v, j) => { filas[r - 2][c - 1 + j] = v; }); } }) };
  const ctx = Object.assign(base(), {
    CFG: { MODELO_CLASIFICADOR: 'x' }, LockService: { getScriptLock: () => ({ hasLock: () => false, waitLock() {}, releaseLock() {} }) },
    hojaCrear_: () => hoja, inboxUpsert_() {}, decisionCrear_: () => { o.decisiones = (o.decisiones || 0) + 1; },
    claude_: () => { if (o.modeloCaido) throw new Error('sin red'); return JSON.stringify(o.respuesta || { promesa: true, que: 'Confirmar el precio exacto con el equipo', canal: 'plataforma', horas: 2 }); }
  });
  vm.createContext(ctx); vm.runInContext(PROM, ctx);
  return { ctx, filas, o };
}
{
  const T = 'Hola, Persona.\n\nEstá en el piso 4. El precio exacto lo confirmo con el equipo y te escribimos por aquí mismo.';
  const c1 = promCaja({});
  const r1 = c1.ctx.promesaAsegurar_({ resId: 'inq:q-1', huesped: 'Persona' }, T);
  ok(r1.ok && r1.texto === T && c1.filas.length === 1 && c1.o.decisiones === 1, '4. la promesa queda registrada (con su decisión para el equipo) antes de salir, y el texto sale igual');
  const r1b = c1.ctx.promesaAsegurar_({ resId: 'inq:q-1', huesped: 'Persona' }, T);
  ok(r1b.ok && r1b.promesa.repetida && c1.filas.length === 1, '4. la misma promesa otra vez (el reintento) no abre otra');
  const c2 = promCaja({ modeloCaido: true });
  const r2 = c2.ctx.promesaAsegurar_({ resId: 'inq:q-2' }, T);
  ok(r2.ok && c2.filas.length === 1 && /lo confirmo con el equipo/.test(c2.filas[0][6]), '4. si el modelo no responde, se registra con la frase misma');
  const c3 = promCaja({ hojaRota: true });
  const r3 = c3.ctx.promesaAsegurar_({ resId: 'inq:q-3' }, T);
  ok(!r3.ok && r3.quitada && r3.texto === 'Hola, Persona.\n\nEstá en el piso 4.', '4. si no se puede registrar, la frase que promete no sale (el resto sí)');
  const r4 = c3.ctx.promesaAsegurar_({ resId: 'inq:q-3' }, 'Lo confirmo con el equipo y te escribimos.');
  ok(!r4.ok && r4.texto === '', '4. si solo prometía, no queda texto (la cola lo retiene)');
  const c5 = promCaja({ respuesta: { promesa: false } });
  const r5 = c5.ctx.promesaAsegurar_({ resId: 'inq:q-5' }, 'Te escribimos el código automáticamente por la plataforma un día antes.');
  ok(r5.ok && !c5.filas.length && /Te escribimos/.test(r5.texto), '4. si el modelo ve que no es promesa, sale igual y no se registra');
  ok(c1.ctx.promesaAnular_(c1.filas[0][0], 'el mensaje no salió') && c1.filas[0][8] === 'ya no aplica', '4. si el mensaje no salió, su promesa queda «ya no aplica»');
  const env = sacar(COD, 'enviarPendiente_');
  ok(env.indexOf('promesaAsegurar_(d, d.borrador)') >= 0 && env.indexOf('promesaAsegurar_') < env.indexOf('enviarCanal_(Object.assign'), '4. enviarPendiente_ asegura la promesa antes de enviar');
  ok(/promesaAsegurar_\(\{ resId: 'inq:'/.test(sacar(COD, 'inquiryResponder_')), '4. la consulta directa también');
}

/* ── 5. cola_descartar ── */
{
  const filas = [HEAD], log = [];
  for (let n = 2; n <= 1540; n++) filas.push(['2026-11-17T00:00:00Z', 'm' + n, 'r-' + n, '', 'Persona', 'texto ' + n, n === 1532 ? 'error' : 'respondido', 3, '', n === 1532 ? 'envío HTTP 400' : '', '']);
  const sh = { getLastRow: () => filas.length, getRange: (r, c, n, m) => ({ getValues: () => filas.slice(r - 1, r - 1 + (n || 1)).map(x => x.slice(c - 1, c - 1 + (m || 1))), setValue: v => { filas[r - 1][c - 1] = v; } }) };
  const ctx = Object.assign(base(), {
    CFG: { TAB_COLA: 'ALMA_COLA', TAB_LOG: 'ALMA_LOG', TZ: 'America/Guatemala' }, COLA_HEADERS: HEAD, C: {},
    hoja_: n => (n === 'ALMA_LOG' ? { appendRow: r => log.push(r) } : sh), Utilities: { formatDate: () => '2026-11-21 11:00:00' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  });
  HEAD.forEach((h, i) => { ctx.C[h] = i; });
  ctx.set_ = (s, f, c) => Object.keys(c).forEach(k => { f.v[ctx.C[k]] = c[k]; s.getRange(f.fila, ctx.C[k] + 1).setValue(c[k]); });
  vm.createContext(ctx); vm.runInContext(COLA, ctx);
  ok(!ctx.colaDescartar_({ filas: [1532] }).ok && filas[1531][6] === 'error', '5. sin motivo no hace nada');
  const r = ctx.colaDescartar_({ filas: [1532, 20], motivo: 'el huésped buscaba otra fecha' });
  ok(r.ok && r.filas[0].hecho && filas[1531][6] === 'descartado' && /el huésped buscaba otra fecha/.test(filas[1531][9]) && /envío HTTP 400/.test(filas[1531][9]), '5. la fila en error queda «descartado» con el motivo (y lo que decía antes)');
  ok(!r.filas[1].hecho && /no está en error/.test(r.filas[1].motivo) && filas[19][6] === 'respondido', '5. una fila que no está en error no se toca');
  ok(log.length === 1 && log[0][3] === 'DESCARTADO' && /Fila 1532/.test(log[0][4]), '5. queda una línea en el registro');
  ok(/'descartado'/.test((COD.match(/const FINALES = \[[^\]]*\]/) || [''])[0]), '5. «descartado» es final: la cola nunca la vuelve a tomar');
  ok(/case 'cola_descartar': return json_\(colaDescartar_\(body\)\)/.test(COD), '5. el robot tiene la acción cola_descartar');
}

if (fallo) process.exit(1);
console.log('OK consultas atrasadas');
