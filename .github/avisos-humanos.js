/* Notificaciones humanas y voz lista antes (#509 T1 y T2), con dobles: sin internet ni Google.
   T2 · cada tipo de notificación que nace en el Hub (avisotexto.js):
     1. tiene una entrada humana: una frase de hasta 120 letras, que empieza con mayúscula, termina en punto o pregunta y
        no suena a sistema («Se registró», «Necesita tu aprobación», «Hay una pregunta sobre», «Error»);
     2. conserva los datos: lo que entra (el pedido, la causa, el vuelo, la propiedad…) sale en la entrada o en los datos,
        y los datos son líneas «Qué: valor» (3 como mucho, de 110 letras);
     3. nunca lleva teléfonos, correos ni códigos, aunque vengan en lo que entra; ni «Claudio», «PR» ni «secretaria».
   La frase hablada (avisoHablarDe_, calle.js) empieza con el nombre de quien escucha, termina con UNA sola pregunta (la del
   aviso si trae una) y conserva el dato clave.
   T1 · la voz lista antes (calle.js): el aviso que nace se encola y el disparador arma su audio; lo que ya está en la caché
   sale aunque haya pasado el plazo y no cuenta en los 3 por vuelta; un audio largo se guarda en partes; un 429 se reintenta
   una vez; cada caída queda en VOZ_CAIDAS sin datos personales.
   node .github/avisos-humanos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

/* ── T2 ── */
function cajaTexto() {
  const puestos = [];
  const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    vozAvisoPoner_: (adm, t, id, o) => puestos.push({ t, id, o }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'avisotexto.js'), 'utf8'), ctx, { filename: 'avisotexto.js' });
  return { ctx, puestos };
}
const { ctx: T, puestos } = cajaTexto();
const SUCIO = ' Llámame al +502 5555-1234 o escribe a ana.perez@correo.com, código de acceso 4821#.';
const TEL = /\+?\d(?:[\s().-]?\d){7,}/, CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/, CODIGO = /4821/;
const SISTEMA = /^(Se registró|Necesita tu aprobación|Hay una pregunta sobre|Error|Aviso:|Notificación)|\b(Claudio|secretaria|PR\b)/i;
/* tipo, lo que entra y lo que tiene que quedar (en la entrada o en los datos). */
const CASOS = [
  ['claude_pregunta', { titulo: 'Reporte de limpieza', detalle: '¿Lo quieres por propiedad o por día?' }, ['Reporte de limpieza', 'por propiedad', 'Pendientes']],
  ['claude_listo', { titulo: 'Botón de facturas' }, ['Botón de facturas', 'unas']],
  ['claude_fallo', { titulo: 'Borrar reservas viejas', detalle: 'no se considera seguro borrar sin respaldo' }, ['Borrar reservas viejas', 'seguro']],
  ['claude_unido', { titulo: 'Botón de facturas' }, ['Botón de facturas', 'unido']],
  ['claude_consulta', { titulo: 'Ocupación de octubre', detalle: 'Rue 301 tuvo 83.9 % de ocupación' }, ['Ocupación de octubre', '83.9']],
  ['escalar_entregado', { nombre: 'Contactos de recepción' }, ['Contactos de recepción', 'chat']],
  ['escalar_no_unido', { nombre: 'Contactos de recepción', causa: 'sus revisiones fallaron', url: 'https://github.com/x/y/pull/487' }, ['Contactos de recepción', 'revisiones fallaron', 'https://github.com/x/y/pull/487']],
  ['escalar_no_publico', { nombre: 'Contactos de recepción', url: 'https://github.com/x/y/pull/488' }, ['Contactos de recepción', 'publicarse', 'pull/488']],
  ['huesped_espera', { propiedad: 'Brunelo 1808', escalado: true }, ['Brunelo 1808', 'escalado']],
  ['huesped_espera', { propiedad: 'Ignacio 904', escalado: false }, ['Ignacio 904', 'en rojo']],
  ['promesa_vencida', { n: 1, que: 'mandarle las toallas extra' }, ['toallas']],
  ['promesa_vencida', { n: 3, que: 'confirmar la factura' }, ['3', 'factura']],
  ['vigilancia_paso', { resumen: 'el precio del vuelo a Madrid', avisar: 'Ya puedes comprarlo', detalle: 'Bajó a 640 USD (antes 720 USD).' }, ['vuelo a Madrid', 'comprarlo', '640']],
  ['vigilancia_error', { resumen: 'la página de la embajada', error: 'la página respondió 503' }, ['embajada', '503']],
  ['vigilancia_vencio', { resumen: 'la página de la embajada' }, ['embajada', 'no cambió']],
  ['vuelo_sin_hora', { vuelo: 'UA1234', quienes: 'Lucky' }, ['UA1234', 'Lucky']],
  ['vuelo_cancelado', { vuelo: 'UA1234', quienes: 'Lucky y Ana' }, ['UA1234', 'Lucky y Ana', 'cancel']],
  ['vuelo_aterrizo', { quienes: 'Lucky', lugar: 'Guatemala', esperan: 'Ana' }, ['Lucky', 'Guatemala', 'Ana']],
  ['vuelo_fallo', { nombre: 'Lucky', vuelo: 'UA1234', error: 'WhatsApp respondió 131047' }, ['Lucky', 'UA1234', '131047']],
  ['correo_autorizacion', { asunto: 'Cotización de remodelación', de_nombre: '', de: 'compras@casasol.com' }, ['Cotización de remodelación', 'Casasol', 'autorización']],
  ['correo_respuesta', { asunto: 'Cotización de remodelación' }, ['Cotización de remodelación', 'Tus correos']]
];
const tipos = new Set();
for (const [tipo, d0, quedan] of CASOS) {
  tipos.add(tipo);
  /* Con lo que llega de verdad: entrada humana y datos. Con teléfonos, correos y un código pegados: nada de eso sale. */
  const a = T.avisoTexto_(tipo, d0), todo = a.texto + '\n' + a.datos.join('\n');
  const d = Object.assign({}, d0); ['titulo', 'nombre', 'detalle', 'que', 'resumen', 'error', 'quienes', 'asunto', 'de_nombre'].forEach(k => { if (d[k] != null) d[k] += SUCIO; });
  const s = T.avisoTexto_(tipo, d), sucio = s.texto + '\n' + s.datos.join('\n');
  ok(a.texto.length <= 120 + (d.url ? d.url.length + 2 : 0) && /^[A-ZÁÉÍÓÚÑ¿]/.test(a.texto) && /[.?!]$|https?:\/\/\S+$/.test(a.texto) && !SISTEMA.test(todo),
    tipo + ': entrada humana «' + a.texto + '»');
  ok(quedan.every(q => todo.toLowerCase().indexOf(q.toLowerCase()) >= 0) && a.datos.length >= 1 && a.datos.length <= 3 && a.datos.every(l => /^[A-ZÁÉÍÓÚÑ][^:]{1,30}: \S/.test(l) && l.length <= 110),
    tipo + ': conserva los datos (' + quedan.join(', ') + ') y los ordena: ' + JSON.stringify(a.datos));
  ok(!TEL.test(sucio.replace(/https?:\/\/\S+/g, '')) && !CORREO.test(sucio) && !CODIGO.test(sucio) && quedan.filter(q => !/^https?:/.test(q)).every(q => sucio.toLowerCase().indexOf(q.toLowerCase()) >= 0), tipo + ': sin teléfonos, correos ni códigos aunque vengan pegados (y sin perder los datos)');
}
/* Ningún tipo de avisotexto.js se queda sin probar. */
const fuente = fs.readFileSync(path.join(DIR, 'avisotexto.js'), 'utf8'), declarados = [...fuente.matchAll(/case '([a-z_]+)':/g)].map(m => m[1]);
ok(declarados.length >= 15 && declarados.every(t => tipos.has(t)), 'cada tipo de notificación tiene su prueba (' + declarados.length + ' tipos)');
/* avisoPoner_ manda la entrada, los datos y el título a vozAvisoPoner_. */
T.avisoPoner_({ email: 'juan@x' }, 'claude_listo', { titulo: 'Botón de facturas' }, 'r1', { nivel: 2 });
const p = puestos[puestos.length - 1];
ok(p && /Botón de facturas/.test(p.t) && p.o.nivel === 2 && p.o.datos.length >= 2 && p.o.titulo, 'avisoPoner_: la entrada, los datos y el título llegan a la notificación');
T.avisoPoner_({ email: 'juan@x' }, 'claude_fallo', { titulo: 'Borrar reservas viejas', detalle: 'no se considera seguro, llama al +502 5555-1234' }, 'r2', { nivel: 2 });
const p2 = puestos[puestos.length - 1];
ok(/^El motivo: no se considera seguro/.test(p2.o.voz) && !/5555/.test(p2.o.voz), 'el detalle para decirlo al oído va en voz, sin teléfonos: «' + p2.o.voz + '»');
/* Cada lugar que antes escribía su texto fijo ahora pasa por avisotexto.js (nadie vuelve a «Hay una pregunta sobre…»). */
const viejos = [
  ['paraclaude.js', /'Hay una pregunta sobre '|'Listo, quedó '/], ['escalar.js', /'No uní el cambio para «'|'Ya está lo que pediste \(«'/],
  ['Código.js', /'Un huésped' \+/], ['promesas.js', /'Hay una promesa a un huésped vencida'/], ['vigilancias.js', /'Dejé de vigilar ' \+ v\.resumen \+ ': /],
  ['avisovuelo.js', /'El proveedor dice que se canceló el '/], ['correo.js', /'Te llegó un correo que pide tu autorización: «'/]
];
viejos.forEach(([f, re]) => ok(!re.test(fs.readFileSync(path.join(DIR, f), 'utf8')), f + ': usa las notificaciones humanas (avisotexto.js), no su texto viejo'));

/* ── Frase hablada y voz lista antes (calle.js) ── */
function cajaVoz(props, respuestas, extra) {
  const cache = {}, llamadas = [], triggers = [], dormidas = [];
  const ctx = Object.assign({
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); },
      getAll: ks => ks.reduce((o, k) => { if (k in cache) o[k] = cache[k]; return o; }, {}), putAll: o => Object.assign(cache, o) }) },
    Utilities: { base64EncodeWebSafe: x => Buffer.from(String(x)).toString('base64'), base64Encode: b => Buffer.from(b).toString('base64'),
      computeDigest: (a, s) => String(s), DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' }, sleep: ms => dormidas.push(ms) },
    ScriptApp: { getProjectTriggers: () => triggers.map(h => ({ getHandlerFunction: () => h })), deleteTrigger() { triggers.length = 0; },
      newTrigger: h => ({ timeBased: () => ({ after: () => ({ create: () => triggers.push(h) }) }) }) },
    LockService: { getUserLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }), getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    uf_: (url, o) => {
      const b = JSON.parse(o.payload); llamadas.push(b.text);
      const [code, cuerpo, bytes] = respuestas.length ? respuestas.shift() : [200, '', null];
      return { getResponseCode: () => code, getContentText: () => cuerpo, getBlob: () => ({ getBytes: () => bytes || [109, 112, 51] }) };
    },
    vozSinNotas_: t => String(t || ''), vozVozId_: () => 'vozAlma', vozColaLock_: () => ctx.LockService.getUserLock(), cupoCanal_() {},
    chatSesAdm_: s => (s ? { email: 'juan@x', nombre: 'Juan Pérez', principal: true } : null), esAdminPrincipal_: a => !!(a && a.principal),
    pendFilas_: () => [], retLeer_: () => [], pendVivo_: () => true, chatOpciones_: () => null
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'calle.js'), 'utf8'), ctx, { filename: 'calle.js' });
  return { ctx, llamadas, triggers, cache, props, dormidas };
}
{ const { ctx: C } = cajaVoz({}, []);
  const ejemplos = [
    [{ id: 'a1', texto: 'Revisé lo que me pediste de «Reporte de limpieza» y tengo una duda antes de seguir; necesito tu respuesta.', nivel: 2 }, /^Juan, revisé lo que me pediste de «Reporte de limpieza».*\. ¿Lo vemos ahora\?$/],
    [{ id: 'a1b', texto: 'Revisé lo que me pediste de «Reporte de limpieza» y tengo una duda antes de seguir; necesito tu respuesta.', voz: '¿Lo quieres por propiedad o por día?', nivel: 2 }, /^Juan, revisé .*respuesta\. ¿Lo quieres por propiedad o por día\?$/],
    [{ id: 'a1c', texto: 'Intenté «Borrar reservas viejas», pero no se pudo terminar; necesito que lo revises para ver cómo seguimos.', voz: 'El motivo: no se considera seguro borrar sin respaldo.', nivel: 2 }, /^Juan, intenté «Borrar reservas viejas».*El motivo: no se considera seguro borrar sin respaldo\. ¿Lo vemos ahora\?$/],
    [{ id: 'a2', texto: 'Hay un huésped en Brunelo 1808 esperando al equipo: su caso está escalado; alguien tiene que responderle ya.', nivel: 1 }, /^Juan, esto es urgente: hay un huésped en Brunelo 1808 .*¿Lo vemos ahora\?$/],
    [{ id: 'a3', texto: 'Ojo, el proveedor dice que se canceló tu vuelo UA1234 y no le he dicho nada a Lucky; ¿quieres que le escriba?', nivel: 2 }, /^Juan, ojo, .*UA1234.*Lucky; ¿quieres que le escriba\?$/],
    [{ id: 'a4', texto: 'Las toallas de Ignacio 904 ya se compraron y llegan mañana.', nivel: 3, resultado: true, conferencia: true }, /^Juan, ya terminé lo que me pediste: las toallas de Ignacio 904 .*\. ¿Quieres que te cuente\?$/],
    [{ id: 'a5', texto: 'Ya quedó unido el cambio de «Botón de facturas»; en unos minutos está publicado.', nivel: 3 }, /^Juan, ya quedó unido el cambio de «Botón de facturas».*publicado\.$/]
  ];
  ejemplos.forEach(([a, re]) => {
    const h = C.avisoHablarDe_(a, [], [], 'Juan Pérez');
    const preguntas = (h.hablar.match(/\?/g) || []).length;
    ok(re.test(h.hablar) && preguntas <= 1 && h.hablar.split(/\s+/).length <= 44, 'hablada (' + a.id + '): «' + h.hablar + '»');
  });
  const sin = C.avisoHablarDe_({ id: 'v', texto: 'Flor pregunta por la llave.', nivel: 2 }, [], []);
  ok(sin.hablar === 'Flor pregunta por la llave. ¿Lo vemos ahora?', 'sin nombre (llamada vieja): sin saludo «' + sin.hablar + '»'); }

{ const props = { ELEVENLABS_KEY: 'k', VOZ_AVISOS: JSON.stringify({ 'juan@x': [{ id: 'av1', ts: Date.now(), texto: 'Ya quedó listo el cambio para «Botón de facturas»; solo falta que lo unas para que se publique.', nivel: 2 }] }) };
  const v = cajaVoz(props, []), adm = { email: 'juan@x', nombre: 'Juan Pérez' };
  ok(v.ctx.avisoVozEncolar_(adm, { id: 'av1', nivel: 2 }) && v.triggers.join() === 'avisoVozPronto', 'al nacer un aviso de nivel 2 se encola y se programa el disparador');
  ok(!v.ctx.avisoVozEncolar_(adm, { id: 'av1', nivel: 2 }) && v.triggers.length === 1, 'el mismo aviso no se encola dos veces ni se programa otro disparador');
  ok(!v.ctx.avisoVozEncolar_(adm, { id: 'av3', nivel: 3 }), 'lo de nivel 3 suelto no se arma por adelantado (se arma cuando la app lo va a decir)');
  ok(v.ctx.avisoVozEncolar_(adm, { id: 'av4', nivel: 3, resultado: true }), 'lo que terminó en segundo plano sí, aunque sea de nivel 3');
  v.ctx.adminsOp_ = () => [adm];
  v.ctx.avisoVozPronto();
  ok(v.llamadas.length === 1 && /^Juan, ya quedó listo el cambio/.test(v.llamadas[0]) && v.props.AVISO_VOZ_COLA === '[]', 'el disparador arma el audio de la frase con el nombre y vacía la cola');
  const h = v.ctx.avisoHablarDe_(JSON.parse(props.VOZ_AVISOS)['juan@x'][0], [], [], 'Juan Pérez');
  const l = v.ctx.avisosConVoz_([{ id: 'av1', hablar: h.hablar, nivel: 2 }], { ahora: true, hablado: 3 });
  ok(l[0].audio && v.llamadas.length === 1, 'cuando la app pregunta, el audio ya está: sale de la caché sin llamar a ElevenLabs');
  const p2 = Object.assign({}, props, { AVISO_VOZ_PREVIA: '0' }), v2 = cajaVoz(p2, []);
  ok(!v2.ctx.avisoVozEncolar_(adm, { id: 'av1', nivel: 2 }) && !v2.triggers.length, 'AVISO_VOZ_PREVIA = 0 lo apaga'); }

{ const v = cajaVoz({ ELEVENLABS_KEY: 'k' }, []);
  v.ctx.calleAudio_('Listo, quedó anotado.', 0, {});
  const t0 = Date.now() - 60000;
  ok(v.ctx.calleAudio_('Listo, quedó anotado.', t0, { donde: 'vozAvisos' }) && v.llamadas.length === 1, 'lo que ya está en la caché sale aunque haya pasado el plazo');
  ok(!v.ctx.calleAudio_('Otra frase nueva.', t0, { donde: 'vozAvisos' }) && /tardó más de 20 s/.test(v.ctx.CALLE_VOZ_MOTIVO_), 'lo nuevo, pasado el plazo, no se pide y dice por qué');
  const caidas = JSON.parse(v.props.VOZ_CAIDAS || '[]');
  ok(caidas.length === 1 && caidas[0].donde === 'vozAvisos' && /tardó/.test(caidas[0].motivo) && !('texto' in caidas[0]) && JSON.stringify(caidas).indexOf('Otra frase') < 0, 'la caída queda en VOZ_CAIDAS (dónde y por qué, sin la frase)'); }

{ const largo = Array.from({ length: 150000 }, (_, i) => i % 251);
  const v = cajaVoz({ ELEVENLABS_KEY: 'k' }, [[200, '', largo]]);
  const a1 = v.ctx.calleAudio_('Una frase larga.', 0, {}), a2 = v.ctx.calleAudio_('Una frase larga.', 0, {});
  ok(a1.length > 90000 && a2 === a1 && v.llamadas.length === 1 && /^n:\d$/.test(Object.values(v.cache).find(x => /^n:/.test(x)) || ''), 'un audio largo (' + a1.length + ' letras) se guarda en partes y la segunda vez sale de la caché'); }

{ const v = cajaVoz({ ELEVENLABS_KEY: 'k' }, [[429, JSON.stringify({ detail: { status: 'too_many_concurrent_requests' } })], [200, '']]);
  ok(v.ctx.calleAudio_('Hola.', 0, {}) && v.llamadas.length === 2 && v.dormidas.length === 1, 'ElevenLabs ocupada (429): espera un respiro y lo intenta una vez más');
  const v2 = cajaVoz({ ELEVENLABS_KEY: 'k' }, [[429, '{}'], [429, '{}']]);
  ok(!v2.ctx.calleAudio_('Hola.', 0, {}) && v2.llamadas.length === 2 && /ocupada/.test(v2.ctx.CALLE_VOZ_MOTIVO_), 'dos veces 429: no insiste más y dice por qué'); }

{ const v = cajaVoz({}, []);
  const r = v.ctx.vozCaida_({ email: 'juan@x' }, { donde: 'aviso', motivo: 'el Hub no contestó a tiempo; llama al +502 5555-1234 o ana@x.com', ms: 30000 });
  const l = v.ctx.vozCaidas_({ email: 'juan@x' }, {});
  ok(r.ok && l.ok && l.caidas[0].de === 'app' && !/5555|@/.test(JSON.stringify(l.caidas)), 'la app anota su caída (vozCaida) y se lee con vozCaidas, sin teléfonos ni correos');
  v.ctx.chatSesAdm_ = () => ({ email: 'otra@x' });
  ok(!v.ctx.vozCaidas_({ email: 'otra@x' }, {}).ok, 'vozCaidas: solo el principal'); }

process.exit(fallo);
