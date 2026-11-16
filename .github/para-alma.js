/* Prueba con dobles de la instrucción a Alma desde una sesión de Claude (apps-script/paraalma.js), sin GitHub, IA ni
   WhatsApp. 12-nov-2026: Juan quiere que Claude le pueda pedir cosas a Alma («programa a las 9:00 un WhatsApp de prueba a
   Recepción Brunelo»). Revisa que:
   1. un issue «para-alma» del dueño, sin ediciones de otros, se ejecuta UNA vez como el administrador principal (canal
      «instruccion», sin escalar ni Desarrollo), comenta lo que hizo con el id de lo programado, lo cierra y, con
      «whatsapp», le avisa a Juan en una frase; la pasada siguiente no lo repite;
   2. otro autor, o el issue editado por otra cuenta, o uno de Alma (alma-mejora): no se ejecuta, lo dice y lo cierra;
   3. «hasta» vencido (o 24 h sin «hasta»): no se ejecuta y lo dice;
   4. un error (la IA falla o una herramienta falla): comenta el error real, etiqueta «para-alma-error», deja el issue
      abierto y no se reintenta aunque vuelva a aparecer;
   5. un JSON inválido: comenta el error, etiqueta y no ejecuta;
   6. si GitHub falla al comentar, la próxima pasada repite solo el aviso, nunca la instrucción; y una ejecución cortada
      no se repite;
   7. lo que sale al issue (público) va sin teléfonos, correos ni códigos;
   8. procesarCola lo llama y programar_mensaje devuelve el id;
   9. (16-nov-2026: del 12 al 16-nov ninguna respuesta llegó a su issue) si GitHub rechaza una llave del Hub al comentar,
      va la otra; si rechaza las dos, el aviso de GitHub recibe el texto limpio una sola vez («pendiente») y, cuando el
      workflow confirma («avisado»), queda listo sin repetir nada; el workflow tiene permiso para comentar; el candado
      de la pasada no se suelta; y el robot ve el estado sin textos.
   node .github/para-alma.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const LIMPIAR = sacar(leer('cerebro_fuentes.js'), 'cerLimpiarSensible_');

const AHORA = Date.parse('2026-11-12T14:00:00Z');   // 8:00 en Guatemala
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true, tels: ['50255550000'], wa: '50255550000' };
const cuerpo = j => 'Pedido de Claude.\n\n```json\n' + JSON.stringify(j) + '\n```\n';
const issue = (n, o) => Object.assign({ number: n, user: { login: 'jforce15-coder' }, labels: [{ name: 'para-alma' }], created_at: new Date(AHORA - 5 * 60000).toISOString(),
  body: cuerpo({ instruccion: 'Programa para hoy a las 9:00 un WhatsApp de prueba a Recepción Brunelo que diga «Prueba de Alma».', responder_a: 'whatsapp' }) }, o || {});

function caja(o) {
  o = o || {};
  const props = Object.assign({ GITHUB_TOKEN: 'tok' }, o.props || {}), cache = {}, gh = [], agentes = [], cierres = [], wa = [], chat = [];
  let ahora = AHORA; const candado = { espera: [], sueltas: 0, mio: false };
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const res = (code, j) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(j) });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, Error,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: ms => { candado.espera.push(ms); if (o.candadoOcupado) return false; candado.mio = true; return true; }, releaseLock() { candado.sueltas++; candado.mio = false; }, hasLock: () => !!o.candadoDeLaPasada || candado.mio }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    Utilities: { formatDate: (d, tz, f) => new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 16).replace('T', ' ') },
    uf_: (url, op, canal) => {
      const metodo = op.method, ruta = url.replace('https://api.github.com', ''), b = op.payload ? JSON.parse(op.payload) : null;
      const tok = String((op.headers || {}).Authorization || '').replace('Bearer ', '');
      gh.push({ metodo, ruta, b, canal, tok });
      if (o.rechaza) { const cod = o.rechaza(tok, metodo, ruta); if (cod) return res(cod, { message: 'Resource not accessible by personal access token' }); }
      if (metodo === 'get' && /\/issues\?/.test(ruta)) return res(200, o.issues ? o.issues() : []);
      if (ruta === '/graphql') {
        if (o.graphqlFalla) return res(502, {});
        const n = b.variables.i, ed = (o.ediciones || {})[n] || [];
        return res(200, { data: { repository: { issue: { author: { login: (o.autorGql || {})[n] || 'jforce15-coder' }, editor: ed.length ? { login: ed[ed.length - 1] } : null,
          userContentEdits: { nodes: ed.map(l => ({ editor: l === null ? null : { login: l } })) } } } } });
      }
      if (/\/comments$/.test(ruta)) { if (o.comentarioFalla && o.comentarioFalla()) return res(500, {}); return res(201, { id: 1 }); }
      if (/\/labels$/.test(ruta)) return res(200, []);
      if (metodo === 'patch') { cierres.push(b); return res(200, {}); }
      return res(404, {});
    },
    cerLimpiarSensible_: null,
    opAgenteActivo_: () => o.agenteApagado ? false : true,
    chatPrincipal_: () => JUAN, esAdminPrincipal_: a => !!(a && a.principal),
    opFilas_: () => [],
    opAgente_: (adm, pedido, canal, fotos, previos) => {
      agentes.push({ adm, pedido, canal });
      if (o.agenteFalla) throw new Error('Anthropic respondió 529 (sobrecargado)');
      return o.agente ? o.agente(pedido) : { respuesta: 'Listo, quedó programado para hoy a las 9:00 a Recepción Brunelo.', hechas: [{ tipo: 'programado', resumen: 'Programado · Recepción Brunelo · jueves 12 de noviembre, 09:00 (hora de Guatemala)', id: 'wp1731420000123' }] };
    },
    chatTurnoCerrar_: (adm, ids, texto, ag, op) => { agentes[agentes.length - 1].cierre = op; return { texto: ag.respuesta }; },
    formatearMensaje_: t => t,
    opGuardar_: (adm, de, canal, texto, hechas) => { chat.push({ de, canal, texto, hechas }); },
    waEnviar_: (n, t) => { wa.push({ n, t }); return { ok: true }; }
  };
  vm.createContext(ctx);
  vm.runInContext(LIMPIAR + '\n' + leer('paraalma.js'), ctx);
  const pasada = (min) => { ahora += (min || 3) * 60000; delete cache.para_alma_t; return ctx.paraAlmaRevisar_(ahora); };
  return { ctx, props, gh, agentes, cierres, wa, chat, pasada, candado, avanzar: min => { ahora += min * 60000; }, estados: () => JSON.parse(props.PARA_ALMA_ESTADO || '{}'),
    comentarios: () => gh.filter(g => /\/comments$/.test(g.ruta)).map(g => g.b.body), etiquetas: () => gh.filter(g => /\/labels$/.test(g.ruta)).map(g => g.b.labels[0]) };
}

/* ── 1 ── Issue válido del dueño: se ejecuta una vez. */
{ let abiertos = [issue(501)];
  const c = caja({ issues: () => abiertos });
  c.pasada(0);
  ok(c.agentes.length === 1 && c.agentes[0].adm === JUAN && c.agentes[0].canal === 'instruccion', 'se ejecuta como el administrador principal, canal «instruccion»');
  ok(/Recepción Brunelo/.test(c.agentes[0].pedido) && /no le pidas confirmación/.test(c.agentes[0].pedido), 'Alma recibe la instrucción con la nota (ya lo pidió Juan: sin confirmación)');
  ok(c.agentes[0].cierre && c.agentes[0].cierre.sinDesarrollo && c.agentes[0].cierre.sinEscalar, 'no escala ni pide a Desarrollo (sería pedirle a Claude lo que Claude pidió)');
  const com = c.comentarios();
  ok(com.length === 1 && /Listo/.test(com[0]) && /wp1731420000123/.test(com[0]) && /09:00/.test(com[0]), 'comenta qué hizo, con el id de lo programado: ' + JSON.stringify(com[0]));
  ok(c.cierres.length === 1 && c.cierres[0].state === 'closed' && c.cierres[0].state_reason === 'completed', 'cierra el issue como completado');
  ok(c.wa.length === 1 && c.wa[0].n === JUAN.wa && /^Claude me pidió/.test(c.wa[0].t) && /ya quedó\.$/.test(c.wa[0].t), 'con «whatsapp» le avisa a Juan en una frase: ' + (c.wa[0] || {}).t);
  ok(c.chat.length === 1 && c.chat[0].canal === 'instruccion' && c.chat[0].de === 'alma', 'queda en el chat de Juan como fila de Alma (no como si él lo hubiera escrito)');
  ok(c.gh.every(g => g.canal === 'Chat de Alma'), 'las llamadas a GitHub cuentan en el cupo como el chat de Alma');
  // GitHub tarda en sacarlo de la lista (o alguien lo reabre): no se repite.
  c.pasada(); c.pasada();
  ok(c.agentes.length === 1 && c.comentarios().length === 1, 'la pasada siguiente no lo vuelve a ejecutar ni a comentar');
  // Con «chat» no hay WhatsApp
  abiertos = [issue(502, { body: cuerpo({ instruccion: 'Dime cuántas llegadas hay hoy.', responder_a: 'chat' }) })];
  c.pasada();
  ok(c.agentes.length === 2 && c.wa.length === 1, 'con «chat» no manda WhatsApp'); }

/* ── 2 ── Autor no autorizado. */
{ const c = caja({ issues: () => [issue(510, { user: { login: 'alguien' } })] });
  c.pasada(0);
  ok(c.agentes.length === 0, 'otro autor: no se ejecuta');
  ok(/autor no autorizado/.test(c.comentarios()[0] || '') && c.cierres[0] && c.cierres[0].state_reason === 'not_planned', 'otro autor: comenta «autor no autorizado» y lo cierra');
  ok(!c.gh.some(g => g.ruta === '/graphql'), 'otro autor: ni siquiera revisa las ediciones'); }
{ const c = caja({ issues: () => [issue(511)], ediciones: { 511: ['jforce15-coder', 'intruso'] } });
  c.pasada(0);
  ok(c.agentes.length === 0 && /autor no autorizado \(lo editó intruso\)/.test(c.comentarios()[0] || '') && c.cierres.length === 1, 'editado por otra cuenta: no se ejecuta, lo dice y lo cierra'); }
{ const c = caja({ issues: () => [issue(512)], ediciones: { 512: ['jforce15-coder', null] } });
  c.pasada(0);
  ok(c.agentes.length === 0 && /cuenta borrada/.test(c.comentarios()[0] || ''), 'editado por una cuenta borrada: no se ejecuta'); }
{ const c = caja({ issues: () => [issue(513)], ediciones: { 513: ['jforce15-coder'] } });
  c.pasada(0);
  ok(c.agentes.length === 1, 'editado solo por el dueño: se ejecuta'); }
{ const c = caja({ issues: () => [issue(514, { labels: [{ name: 'para-alma' }, { name: 'alma-mejora' }] })] });
  c.pasada(0);
  ok(c.agentes.length === 0 && c.cierres.length === 1, 'un pedido de Alma a Claude (alma-mejora) no es una instrucción de Juan: no se ejecuta'); }
{ const c = caja({ issues: () => [issue(515)], graphqlFalla: true });
  c.pasada(0);
  ok(c.agentes.length === 0 && c.comentarios().length === 0, 'GitHub no dice quién editó: no se ejecuta y espera la próxima pasada');
  c.pasada(20);
  ok(c.agentes.length === 0 && /No lo ejecuté/.test(c.comentarios()[0] || '') && c.etiquetas()[0] === 'para-alma-error', 'si a los 15 min sigue sin saberse: lo dice con la etiqueta de error, sin ejecutar'); }

/* ── 3 ── «hasta» vencido. */
{ const c = caja({ issues: () => [issue(520, { body: cuerpo({ instruccion: 'Programa el WhatsApp de prueba.', responder_a: 'chat', hasta: '2026-11-12T07:55:00-06:00' }) })] });
  c.pasada(0);
  ok(c.agentes.length === 0 && /vencía el 2026-11-12 07:55/.test(c.comentarios()[0] || '') && c.cierres[0].state_reason === 'not_planned', '«hasta» vencido: no se ejecuta y dice cuándo vencía: ' + c.comentarios()[0]); }
{ const c = caja({ issues: () => [issue(521, { body: cuerpo({ instruccion: 'Programa el WhatsApp.', hasta: '2026-11-12T08:30' }) })] });
  c.pasada(0);
  ok(c.agentes.length === 1, '«hasta» sin zona es hora de Guatemala (08:30 todavía no pasa a las 08:03)'); }
{ const c = caja({ issues: () => [issue(522, { created_at: new Date(AHORA - 30 * 3600000).toISOString() })] });
  c.pasada(0);
  ok(c.agentes.length === 0 && /24 h/.test(c.comentarios()[0] || ''), 'sin «hasta», un issue de hace más de 24 h no se ejecuta'); }

/* ── 4 ── Errores: etiqueta y sin reintentos. */
{ let abiertos = [issue(530)];
  const c = caja({ issues: () => abiertos, agenteFalla: true });
  c.pasada(0);
  const com = c.comentarios()[0] || '';
  ok(/529/.test(com) && c.etiquetas()[0] === 'para-alma-error' && c.cierres.length === 0, 'la IA falla: comenta el error real, etiqueta «para-alma-error» y deja el issue abierto');
  ok(/no se pudo: Anthropic respondió 529/.test((c.wa[0] || {}).t || ''), 'con «whatsapp» Juan sabe que no se pudo');
  c.pasada(); c.pasada();
  ok(c.agentes.length === 1 && c.comentarios().length === 1, 'aunque GitHub lo siga listando, no lo reintenta');
  abiertos = [issue(530, { labels: [{ name: 'para-alma' }, { name: 'para-alma-error' }] })];
  c.props.PARA_ALMA_ESTADO = '{}'; c.pasada();
  ok(c.agentes.length === 1, 'con la etiqueta de error no se toca aunque se pierda la marca'); }
{ const c = caja({ issues: () => [issue(531)], agente: () => ({ respuesta: 'No pude programarlo.', hechas: [{ tipo: 'programado', resumen: 'Programar a Recepción Brunelo', error: 'Esa hora ya pasó' }] }) });
  c.pasada(0);
  ok(/Esa hora ya pasó/.test(c.comentarios()[0] || '') && c.etiquetas()[0] === 'para-alma-error' && c.cierres.length === 0, 'una herramienta falla: el error real en el comentario, etiqueta y abierto'); }
{ const c = caja({ issues: () => [issue(532)], agenteApagado: true });
  c.pasada(0);
  ok(c.agentes.length === 0 && /OP_AGENTE/.test(c.comentarios()[0] || '') && c.etiquetas()[0] === 'para-alma-error', 'con el agente apagado lo dice y no lo intenta'); }

/* ── 5 ── JSON inválido. */
for (const [n, body, por] of [[540, 'Programa un mensaje a Brunelo', 'no trae un JSON'], [541, cuerpo({ responder_a: 'chat' }), 'falta «instruccion»'], [542, cuerpo({ instruccion: 'x', responder_a: 'correo' }), '«responder_a»'],
  [543, cuerpo({ instruccion: 'x', hasta: 'mañana' }), '«hasta»'], [544, '```json\n{"instruccion": "x",}\n```', 'no trae un JSON']]) {
  const c = caja({ issues: () => [issue(n, { body })] });
  c.pasada(0);
  ok(c.agentes.length === 0 && (c.comentarios()[0] || '').indexOf(por) >= 0 && c.etiquetas()[0] === 'para-alma-error' && c.cierres.length === 0, 'JSON inválido (' + por + '): comenta el error y no ejecuta');
}

/* ── 6 ── GitHub falla al comentar: se repite solo el aviso. Una ejecución cortada no se repite. */
{ let falla = true;
  const c = caja({ issues: () => [issue(550)], comentarioFalla: () => falla });
  c.pasada(0);
  ok(c.agentes.length === 1 && c.estados()['550'].e === 'por_avisar', 'el comentario falló: queda «por_avisar» con el texto');
  falla = false; c.pasada();
  ok(c.agentes.length === 1 && c.cierres.length === 1 && c.estados()['550'].e === 'listo' && /wp1731420000123/.test(c.gh.filter(g => /\/comments$/.test(g.ruta)).pop().b.body), 'la pasada siguiente solo comenta y cierra, sin volver a ejecutar'); }
{ const c = caja({ issues: () => [issue(551)], props: { PARA_ALMA_ESTADO: JSON.stringify({ 551: { e: 'ejecutando', t: AHORA - 60000 } }) } });
  c.pasada(0);
  ok(c.agentes.length === 0 && c.comentarios().length === 0, 'otra pasada lo está ejecutando: no lo toca');
  c.pasada(20);
  ok(c.agentes.length === 0 && /se cortó/.test(c.comentarios()[0] || '') && c.etiquetas()[0] === 'para-alma-error', 'ejecución cortada: lo dice con la etiqueta de error y no la repite'); }
{ const c = caja({ issues: () => [issue(552), issue(553)] });
  c.pasada(0);
  ok(c.agentes.length === 1, 'una instrucción con IA por pasada');
  c.pasada();
  ok(c.agentes.length === 2, 'la otra, en la pasada siguiente'); }
{ const c = caja({ issues: () => [issue(554)] });
  c.ctx.paraAlmaRevisar_(AHORA - 200000);
  ok(c.agentes.length === 0, 'si la pasada ya lleva más de 2,5 min no empieza una instrucción'); }
{ const c = caja({ issues: () => [issue(555)], props: { GITHUB_TOKEN: '' } });
  c.pasada(0);
  ok(c.gh.length === 0, 'sin llave de GitHub no llama a nada'); }

/* ── 7 ── Lo público va limpio. */
{ const c = caja({ issues: () => [issue(560)], agente: () => ({ respuesta: 'Listo, le escribí a Recepción (+502 5555 0101, recepcion@edificio.com). El código de la puerta es 4821.', hechas: [{ tipo: 'mensaje', resumen: 'Equipo · Recepción · 50255550101' }] }) });
  c.pasada(0);
  const com = c.comentarios()[0] || '';
  ok(!/5555|recepcion@|4821/.test(com) && /\[número\]/.test(com) && /\[correo\]/.test(com) && /\[clave\]/.test(com), 'el comentario público va sin teléfonos, correos ni códigos: ' + JSON.stringify(com)); }

/* ── 8 ── Conexiones con el resto del Hub. */
{ const cod = leer('Código.js'), cola = sacar(cod, 'procesarCola');
  ok(/paraAlmaRevisar_\(inicioCola\)/.test(cola) && !/cupoPermite_\('fondo'\)[\s\S]*paraAlmaRevisar_/.test(cola), 'procesarCola revisa las instrucciones en cada pasada, fuera de lo de fondo (es Juan pidiendo)');
  ok(/case 'programar_mensaje'[\s\S]{0,900}id: rpg\.id/.test(leer('agente.js')), 'programar_mensaje devuelve el id de lo programado');
  ok(/m\.canal === 'instruccion'/.test(sacar(leer('chat.js'), 'chatPreguntasRevisar_')), 'una respuesta de una instrucción no se vuelve tarjeta de Pendientes'); }

/* ── 9 ── La respuesta siempre llega al issue. */
{ // Una llave sin permiso para comentar (403) y la de Conexiones sí puede: sale con la otra, una sola vez.
  const c = caja({ issues: () => [issue(570)], props: { GITHUB_TOKEN: 'vieja', GITHUB_PRS: 'conexiones' }, rechaza: (tok, m) => tok === 'conexiones' && m !== 'get' && m !== 'post-graphql' ? 0 : 0 });
  c.pasada(0);
  ok(c.gh.filter(g => /\/comments$/.test(g.ruta))[0].tok === 'conexiones', 'primero va la llave de Conexiones (GITHUB_PRS), la que Juan mantiene'); }
{ const c = caja({ issues: () => [issue(571)], props: { GITHUB_TOKEN: 'vieja', GITHUB_PRS: 'conexiones' }, rechaza: (tok, m, ruta) => tok === 'conexiones' && m !== 'get' && ruta !== '/graphql' ? 403 : 0 });
  c.pasada(0);
  const com = c.gh.filter(g => /\/comments$/.test(g.ruta));
  ok(com.length === 2 && com[0].tok === 'conexiones' && com[1].tok === 'vieja' && c.estados()['571'].e === 'listo' && c.cierres.length === 1, 'GitHub rechaza una llave al comentar (403): sale con la otra y el issue queda comentado y cerrado');
  ok(c.agentes.length === 1, 'y la instrucción se ejecutó una sola vez'); }
{ const c = caja({ issues: () => [issue(572)], props: { GITHUB_TOKEN: 'igual', GITHUB_PRS: 'igual' }, rechaza: (tok, m, ruta) => m !== 'get' && ruta !== '/graphql' ? 403 : 0 });
  c.pasada(0);
  ok(c.gh.filter(g => /\/comments$/.test(g.ruta)).length === 1, 'la misma llave en las dos propiedades no se prueba dos veces'); }
{ // Las dos llaves rechazadas: por el aviso de GitHub, el workflow recibe el texto limpio una vez y confirma.
  const iss = issue(573);
  const c = caja({ props: { GITHUB_TOKEN: 'vieja', GITHUB_PRS: 'conexiones', PARA_ALMA_AVISO_KEY: 'llave-aviso' }, rechaza: (tok, m, ruta) => m !== 'get' && ruta !== '/graphql' ? 403 : 0,
    agente: () => ({ respuesta: 'Listo, le escribí a Recepción (+502 5555 0101).', hechas: [{ tipo: 'mensaje', resumen: 'Equipo · Recepción' }] }) });
  const uf0 = c.ctx.uf_; c.ctx.uf_ = (url, op, canal) => /\/issues\/573$/.test(url) && op.method === 'get' ? { getResponseCode: () => 200, getContentText: () => JSON.stringify(Object.assign({ state: 'open' }, iss)) } : uf0(url, op, canal);
  ok(c.ctx.paraAlmaAviso_({ llave: 'otra', issue: 573 }).ok === false && c.agentes.length === 0, 'el aviso con otra llave no hace nada');
  const r1 = c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 573 });
  ok(r1.ok && r1.procesado && c.agentes.length === 1 && c.estados()['573'].e === 'por_avisar' && c.estados()['573'].codigo === 'comentar 403', 'las dos llaves rechazadas: la instrucción se hizo, queda «por_avisar» y se guarda el código del rechazo (comentar 403)');
  ok(r1.pendiente && /Listo/.test(r1.pendiente.texto) && r1.pendiente.cerrar === 'completed' && !/5555/.test(r1.pendiente.texto) && /\[número\]/.test(r1.pendiente.texto), 'el aviso devuelve «pendiente» con el texto ya limpio y cómo cerrar: ' + JSON.stringify(r1.pendiente).slice(0, 160));
  const r2 = c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 573 });   // el segundo aviso (al etiquetar) llega segundos después
  ok(r2.ok && !r2.procesado && !r2.pendiente && c.agentes.length === 1, 'el segundo aviso seguido no recibe el texto otra vez (un solo comentario) ni repite la instrucción');
  const r3 = c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 573, avisado: true });
  ok(r3.ok && r3.avisado === true && c.estados()['573'].e === 'listo' && c.estados()['573'].porWorkflow === 1, 'el workflow confirma («avisado»): queda listo');
  const antes = c.gh.length; c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 573 });
  ok(c.agentes.length === 1 && c.gh.slice(antes).every(g => g.metodo === 'get'), 'después de listo no se ejecuta ni se comenta otra vez');
  ok(c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 999, avisado: true }).avisado === false, '«avisado» de un issue sin aviso pendiente no marca nada');
  const d = c.ctx.paraAlmaDiag_();
  ok(d.ok && d.llaves === 2 && d.issues['573'].estado === 'listo' && d.issues['573'].por_workflow === true && !/Listo|Recepción/.test(JSON.stringify(d)), 'el robot «para_alma_estado» da el estado sin textos: ' + JSON.stringify(d.issues['573'])); }
{ // Si nadie confirma, a los 10 min el texto se puede volver a entregar (el workflow falló a la mitad).
  const iss = issue(574);
  const c = caja({ props: { GITHUB_TOKEN: 'vieja', PARA_ALMA_AVISO_KEY: 'llave-aviso' }, rechaza: (tok, m, ruta) => m !== 'get' && ruta !== '/graphql' ? 404 : 0 });
  const uf0 = c.ctx.uf_; c.ctx.uf_ = (url, op, canal) => /\/issues\/574$/.test(url) && op.method === 'get' ? { getResponseCode: () => 200, getContentText: () => JSON.stringify(Object.assign({ state: 'open' }, iss)) } : uf0(url, op, canal);
  const r1 = c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 574 });
  c.avanzar(11);
  const r2 = c.ctx.paraAlmaAviso_({ llave: 'llave-aviso', issue: 574 });
  ok(!!r1.pendiente && !!r2.pendiente && c.agentes.length === 1, 'sin confirmación, a los 10 min el texto se entrega otra vez (la instrucción no se repite)'); }
{ // El candado: desde el aviso espera hasta 30 s; si la pasada ya lo tiene, no lo suelta.
  const c = caja({ issues: () => [issue(575)] });
  c.pasada(0);
  ok(c.candado.espera.length > 0 && c.candado.espera.every(ms => ms === 30000), 'fuera de la pasada espera el candado hasta 30 s (con 5 s el resultado se perdía en silencio)');
  const c2 = caja({ issues: () => [issue(576)], candadoDeLaPasada: true });
  c2.pasada(0);
  ok(c2.agentes.length === 1 && c2.candado.sueltas === 0 && c2.candado.espera.length === 0 && c2.estados()['576'].e === 'listo', 'si la pasada ya tiene el candado, no lo vuelve a pedir ni lo suelta'); }
{ const y = fs.readFileSync(path.join(DIR, '..', '.github', 'workflows', 'para-alma-aviso.yml'), 'utf8');
  ok(/permissions:\s*\n\s+issues: write/.test(y) && !/contents: write|pull-requests: write/.test(y), 'el workflow tiene permiso solo para escribir en issues');
  ok(/has\("pendiente"\)/.test(y) && /\/comments/.test(y) && /avisado: true/.test(y) && /del\(\.pendiente\.texto\)/.test(y), 'el workflow deja el pendiente en el issue, confirma al Hub y no imprime el texto en el registro');
  ok(/github\.event\.issue\.user\.login == github\.repository_owner/.test(y) && !/\$\{\{\s*github\.event\.issue\.(title|body)/.test(y), 'solo con issues del dueño y sin meter el título ni el cuerpo en el script');
  ok(/case 'para_alma_estado': return json_\(paraAlmaDiag_\(\)\)/.test(leer('Código.js')), 'el robot tiene «para_alma_estado»'); }

process.exit(fallo);
