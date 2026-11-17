/* Prueba de la espera de Alma y del envío de fondo (Juan, 17-nov-2026). Con dobles, sin Google ni ElevenLabs.
   «El typing es el sonido mientras se procesa la solicitud; el eco (coro) es el sonido de espera.» «Después de confirmado
   un envío, ya no typing: escuchar la continuación de la conversación; lo pendiente se queda en el background.»
   1. Tecleo o coro (js/alma-voz.js, coroReglas): el tecleo se queda; el coro entra solo si la herramienta pasa de 2,5 s;
      las de fondo y las que no esperan respuesta nunca lo tocan; −10 dB con Alma, −6 dB con Juan; rampas.
   2. Herramientas (voz.js, claudio.js): las de trabajo siguen con tecleo; enviar_confirmado y claudio_pedido, sin tecleo,
      async y sin frase antes.
   3. enviar_confirmado (vozEnviarConfirmado_): va a la cola marcado como envío, con disparador corto, y contesta al
      instante «en camino» (nunca «enviado»); su texto vale como sí del borrador y como orden de envío directo.
   4. La cola no hace esperar 40 s a un envío; si el envío no salió, aviso a Juan (Pendientes) una sola vez; si salió, nada.
   node .github/espera-coro.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

/* ── 1. Tecleo o coro (la web; la app usa los mismos números: alma-app CoroTrabajoReglas.swift) ── */
{
  const store = {};
  const w = { location: { href: 'https://hub.spacioam.com/' }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } };
  const ctx = { window: w, document: { currentScript: { src: 'https://hub.spacioam.com/js/alma-voz.js' }, addEventListener() {}, visibilityState: 'visible', documentElement: { style: { setProperty() {} } } },
    localStorage: w.localStorage, URL, console, setTimeout, clearTimeout, setInterval, clearInterval, CustomEvent: function () {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'alma-voz.js'), 'utf8'), ctx, { filename: 'alma-voz.js' });
  const R = w.SAAlmaVoz && w.SAAlmaVoz.coroReglas;
  ok(!!R, 'alma-voz.js expone sus reglas de espera');
  if (R) {
    ok(R.cuenta('secretaria') && R.cuenta('lookup_reservation') && R.cuenta('claudio_estado') && R.cuenta('anillo_medir_ahora'), 'las herramientas de trabajo cuentan para la espera');
    ['enviar_confirmado', 'claudio_pedido', 'nivel_weebo', 'mostrar_gif', 'hablar_con_claudio', 'mostrar_en_chat', ''].forEach(n => ok(!R.cuenta(n), 'nunca suena el coro con «' + n + '» (de fondo o sin espera)'));
    const t0 = 1e12;
    ok(!R.debe({ a: t0 }, t0 + 1000), 'a 1 s: solo tecleo (búsqueda corta)');
    ok(!R.debe({ a: t0 }, t0 + 2400), 'a 2,4 s: todavía tecleo');
    ok(R.debe({ a: t0 }, t0 + 2500), 'a 2,5 s: entra el coro de espera');
    ok(!R.debe({}, t0 + 9000), 'sin herramientas: nada');
    ok(R.debe({ a: t0, b: t0 + 2000 }, t0 + 2600), 'con dos herramientas, cuenta desde la primera que sigue');
    ok(Math.abs(R.objetivo(false, false) - 1) < 1e-9, 'nadie habla: coro completo');
    ok(Math.abs(R.objetivo(true, false) - Math.pow(10, -0.5)) < 1e-9, 'Alma habla: −10 dB');
    ok(Math.abs(R.objetivo(false, true) - Math.pow(10, -0.3)) < 1e-9, 'Juan habla: −6 dB');
    ok(Math.abs(R.objetivo(true, true) - Math.pow(10, -0.5)) < 1e-9, 'los dos: manda Alma');
    ok(R.rampa(0, 1) === 0.4 && R.rampa(1, 0) === 0.5 && R.rampa(1, 0.3) === 0.15 && R.rampa(0.3, 1) === 0.4, 'rampas: entra 0,4 · sale 0,5 · baja 150 ms · sube 400 ms');
  }
  const src = fs.readFileSync(path.join(RAIZ, 'js', 'alma-voz.js'), 'utf8');
  ok(!/tool_ids/.test(src), 'la web no cambia la lista de herramientas (el tecleo se queda)');
}

/* ── 2 a 4. Hub: herramientas, envío de fondo y cola ── */
function caja() {
  const props = {}, cache = {}, triggers = [], avisos = [], agentes = [];
  const ctx = { console: { log() {}, error() {}, warn() {} }, JSON, String, Number, Object, Array, RegExp, Date, Math, Boolean, encodeURIComponent,
    props, triggers, avisos, agentes,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: h => ({ timeBased: () => ({ after: ms => ({ create: () => triggers.push({ h, ms }) }) }) }) },
    Utilities: { computeDigest: () => [], DigestAlgorithm: {}, Charset: {}, base64Encode: () => '', formatDate: () => '' },
    CFG: { TZ: 'America/Guatemala' }
  };
  vm.createContext(ctx);
  ['prometer.js', 'enviodirecto.js', 'voz.js', 'claudio.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  /* dobles de lo que vive en otros archivos */
  Object.assign(ctx, {
    normTel_: t => String(t || '').replace(/\D/g, ''), adminPorTel_: t => (t === '50255550000' ? { email: 'juan@x.test', nombre: 'Juan', principal: true } : null),
    vozEsConferencia_: () => false, vozColaLock_: () => ctx.LockService.getScriptLock(), orbitaEmpieza_: () => 'orb1', orbitaTermina_() {}, vozTrabajando_() {},
    esAdminPrincipal_: a => !!(a && a.principal), pendAvisar_: (adm, texto, o) => { ctx.avisos.push({ texto, o }); return true; },
    opFilas_: () => [], opGuardar_: () => ({ id: 'f1' }), chatTurnoCerrar_: (a, b, c, r) => ({ texto: r.respuesta }), cupoCanal_() {}, pendProcesar_() {},
    retClasificar_: () => ({ requiere: false }), waEnviarAlguien_: () => ({ ok: true }),
    vozMostrarEnChat_: () => ({ type: 'client', name: 'mostrar_en_chat' }), vozNivelWeebo_: () => ({ type: 'client', name: 'nivel_weebo' }),
    vozMostrarGif_: () => ({ type: 'client', name: 'mostrar_gif' }), vozMostrarTarjetaClub_: () => ({ type: 'client', name: 'mostrar_tarjeta_club' }),
    vozHablarConClaudio_: () => ({ type: 'client', name: 'hablar_con_claudio' }), vozPasarAMaricarmen_: () => ({ type: 'client', name: 'pasar_a_maricarmen' }),
    vozManosHerramientas_: () => [], vozAnilloHerramientas_: () => [], guiaHerramienta_: () => [], vozGuiaHerramientas_: () => []
  });
  return ctx;
}
{
  const c = caja();
  let defs = []; try { defs = c.vozDefHerramientas_('BASE'); } catch (e) { ok(false, 'vozDefHerramientas_ corre con dobles: ' + e.message); }
  const de = n => defs.filter(d => d.name === n)[0] || {};
  ['secretaria', 'lookup_reservation', 'property_info'].forEach(n => ok(de(n).tool_call_sound === 'typing' && de(n).tool_call_sound_behavior === 'always', n + ': con tecleo (el trabajo corto suena a tecleo)'));
  const e = de('enviar_confirmado');
  ok(e.type === 'webhook' && /h=enviar_confirmado/.test(e.api_schema && e.api_schema.url), 'enviar_confirmado existe y va al Hub');
  ok(e.tool_call_sound === null && e.execution_mode === 'async' && e.pre_tool_speech === 'off', 'enviar_confirmado: sin tecleo, async y sin frase antes');
  ok(/«Lo estoy enviando»/.test(e.description) && /nunca «enviado»/.test(e.description), 'su descripción: «Lo estoy enviando», nunca «enviado»');
  ok(/enviar_confirmado/.test(c.VOZ_SECRETARIA_DESC_), 'secretaria remite a enviar_confirmado cuando el envío ya está confirmado');
  const cl = c.claudioDefHerramientas_('BASE'), cd = n => cl.filter(d => d.name === n)[0] || {};
  ok(cd('claudio_pedido').tool_call_sound === null && cd('claudio_pedido').execution_mode === 'async', 'claudio_pedido (manda el pedido a Claude): sin tecleo y async');
  ['claudio_estado', 'claudio_unir', 'claudio_codigo', 'claudio_responder'].forEach(n => ok(cd(n).tool_call_sound === 'typing', n + ': Claudio sigue con tecleo'));
}
{
  const c = caja();
  const r = c.vozEnviarConfirmado_({ caller_id: '+502 5555 0000', pedido: 'A Gabriel de Narama 633: mañana llego tarde', conv_id: 'cv1' });
  const cola = JSON.parse(c.props.VOZ_SEC_COLA || '[]');
  ok(r.ok && r.en_camino && cola.length === 1 && cola[0].envio === 1, 'el envío confirmado va a la cola de fondo, marcado como envío');
  ok(c.triggers.length === 1 && c.triggers[0].ms <= 10000, 'sale enseguida (disparador de ' + (c.triggers[0] || {}).ms + ' ms, no 45 s)');
  ok(/Lo estoy enviando/.test(r.resultado) && /No digas «enviado»/.test(r.resultado) && /todavía no salió/.test(r.resultado), 'contesta al instante «en camino»: Alma dice «Lo estoy enviando», nunca «enviado»');
  ok(c.envioDirectoOrden_(cola[0].pedido), 'el pedido de la cola vale como orden de envío directo');
  ok(c.EQUIPO_SI_RE_.test(cola[0].pedido), 'y como el sí de un borrador pendiente');
  const n = c.vozEnviarConfirmado_({ caller_id: '+1 000', pedido: 'x' });
  ok(n.ok === false && /NO SE ENVIÓ NADA/.test(n.error), 'sin un administrador: no se encola nada y Alma lo dice');
  ok(c.vozEnviarConfirmado_({ caller_id: '50255550000', pedido: ' ' }).ok === false, 'sin qué enviar: no se encola nada');
}
{
  const c = caja();
  c.vozEnviarConfirmado_({ caller_id: '50255550000', pedido: 'A Gabriel: llego tarde' });
  let pedidoAgente = '';
  c.opAgente_ = (adm, p) => { pedidoAgente = p; return { respuesta: 'Listo.', hechas: [{ tipo: Object.keys(c.PROMETER_ENVIO_TIPOS_)[0], resumen: 'WhatsApp a Gabriel' }] }; };
  c.vozSecProcesar_();
  ok(/^Envíaselo/.test(pedidoAgente), 'la cola no hace esperar 40 s a un envío confirmado: sale en la primera pasada');
  ok(c.avisos.length === 0, 'si salió, a Juan no se le interrumpe');
}
{
  const c = caja();
  c.vozEnviarConfirmado_({ caller_id: '50255550000', pedido: 'A Gabriel: llego tarde' });
  c.opAgente_ = () => ({ respuesta: 'No pude.', hechas: [{ tipo: Object.keys(c.PROMETER_ENVIO_TIPOS_)[0], resumen: 'WhatsApp a Gabriel', error: 'número inválido' }] });
  c.vozSecProcesar_();
  ok(c.avisos.length === 1 && /No salió el mensaje/.test(c.avisos[0].texto) && /número inválido/.test(c.avisos[0].texto), 'si el envío falló: aviso a Juan con el porqué');
  const c2 = caja();
  c2.vozEnviarConfirmado_({ caller_id: '50255550000', pedido: 'A Gabriel: llego tarde' });
  c2.opAgente_ = () => { throw new Error('se cayó'); };
  c2.vozSecProcesar_();
  ok(c2.avisos.length === 1, 'si el agente se cayó: un solo aviso (no dos)');
  const c3 = caja();
  c3.vozEnviarConfirmado_({ caller_id: '50255550000', pedido: 'A Gabriel: llego tarde' });
  c3.opAgente_ = () => ({ respuesta: 'Es un borrador para Gabriel. ¿Lo mando?', hechas: [] });
  c3.vozSecProcesar_();
  ok(c3.avisos.length === 1, 'si no se hizo ningún envío (quedó en borrador): aviso a Juan');
}
process.exit(fallo);
