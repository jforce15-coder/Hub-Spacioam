/* Prueba de «Alma escala sola» (apps-script/escalar.js) con dobles: sin hoja, sin GitHub, sin Claude, sin WhatsApp.
   11-nov-2026 (Juan lo vio el 12): Juan pidió por WhatsApp sus apartamentos como contacto de recepción de Hola; Alma dijo
   «necesito pedírselo a Claudio… ¿Lo pido?» y no pidió nada hasta que él contestó «Si» 44 minutos después, y entonces
   salió dos veces. Juan, 12-nov: «si yo lo pido, se tiene que autogestionar» y «Alma une sola únicamente cuando el usuario
   administrador principal hace un pedido y es necesaria alguna mejora o cambio para poder entregar el resultado».
   1. Lo que dijo Alma el 11-nov (promete y pregunta) termina en UNA llamada real a Desarrollo en ese turno, con un JSON
      válido (rol, tarea, contexto, pasos, restricciones, formato_de_respuesta), sin pedir permiso, y la frase dice que ya
      quedó pedido.
   2. También escala si ofrece a un agente, dice que no tiene la herramienta o usa una herramienta que no existe.
   3. No escala: una negativa de seguridad, un «no encontré», el estado de algo que ya está con Claude, otra persona, un
      turno que ya pidió (pedir_a_agente) ni la entrega misma. Lo mismo dos veces en 2 h sale una vez.
   4. Desarrollo + pedir_a_agente en el mismo turno: un solo pedido (el 11-nov salieron dos).
   5. Pedido de Juan + PR en verde: Alma lo une sola, espera que se publique y le entrega el resultado con el enlace (por
      WhatsApp, donde lo pidió). Dos PR: en orden.
   6. Revisiones en rojo o choque: no une, avisa con el enlace y la causa y deja «Unir el PR» para Juan.
   7. Pedido de otra persona o un cambio que Juan pidió (no lo que Alma no podía): no une; queda el «Unir» de siempre.
   8. Los pedidos a los demás agentes y las rondas de Desarrollo también van en JSON; el pedido de Juan a Desarrollo, sin
      los pasos de revisar pantallas.
   node .github/escalar-sola.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = { email: 'juan@x.com', nombre: 'Juan Ovalle', principal: true, tels: ['50200000000'], wa: '50200000000' };
const GABY = { email: 'gaby@x.com', nombre: 'Gabriel', principal: false, tels: [] };
const PEDIDO = '[nota de voz] Alma, necesito que me armes un listado de todos los apartamentos donde me estás mandando el formulario de ingreso de los huéspedes a mí. Hay algunos donde yo estoy como el contacto principal de recepción y otros donde estoy como secundario.';
const DIJO_11NOV = 'Ese dato no está en mi sistema. El campo "contacto principal / secundario para el formulario de ingreso" no existe en ninguna ficha de las 23 propiedades.\n\nLo más probable es que viva en Hola directamente. Para sacarlo desde ahí necesito pedírselo a Claudio, que lo exporte de esa base de datos.\n\n¿Lo pido?';
const OFRECE_AGENTE = 'No tengo en mi cerebro un registro estructurado de qué propiedades tienen a Juan como contacto principal vs. secundario.\n\nLo que sí puedo hacer es pedírselo al agente de operaciones para que lo saque directo del sistema.\n\n¿Te parece que lo haga en segundo plano y te mando el listado cuando esté listo?';
const PR_HUB = 'https://github.com/jforce15-coder/Hub-Spacioam/pull/487', PR_HOLA = 'https://github.com/jforce15-coder/Hola-spacioam/pull/34';

function caja() {
  const mem = {}, cache = {}, log = { claude: [], unir: [], wa: [], avisos: [], chat: [], acciones: [], agente: [], desarrollo: [], cerrar: [] };
  const gh = { abiertos: {}, info: {}, checks: {} };
  let ahora = Date.parse('2026-11-11T19:45:00Z');
  const D = class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } };
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, Date: D,
    CFG: { TZ: 'America/Guatemala' }, ahora_: () => new D(),
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 16), getUuid: () => 'u', computeDigest: (a, t) => Array.from(Buffer.from(String(t))), DigestAlgorithm: {}, Charset: {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) }
  };
  vm.createContext(ctx);
  ['avisotexto.js', 'paraclaude.js', 'chat.js', 'agentes.js', 'escalar.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  Object.assign(ctx, {
    adminsOp_: () => [JUAN, GABY], adminPorEmail_: e => [JUAN, GABY].filter(a => a.email === e)[0] || null, opMarcar_: () => 0, chatMarcarLuego_: () => {},
    paraClaudeCrear_: (adm, inp) => { log.claude.push({ adm, inp }); return { ok: true, id: 'pc' + log.claude.length, claude: true, issue: 'https://github.com/x/y/issues/1', micro: { id: 'mp' + log.claude.length, nombre: 'Contactos recepción Hola' }, nivel: 'complejo' }; },
    chatDesarrollo_: (adm, texto) => { log.desarrollo.push(texto); return { texto: 'Listo, quedó pedido.' }; },
    prsAbiertos_: () => Object.keys(gh.abiertos).map(u => ({ url: u, repo: u.split('/').slice(3, 5).join('/'), numero: +u.split('/').pop(), titulo: 't', estado: gh.abiertos[u] })),
    unirCambio_: url => { log.unir.push(url); const est = gh.abiertos[url]; delete gh.abiertos[url]; gh.info[url] = { estado: 'unido', repo: url.split('/').slice(3, 5).join('/'), sha: 'sha' + url.split('/').pop() }; return est === 'listo' ? { ok: true, unidos: [{ url }], no_unidos: [] } : { ok: false, unidos: [], no_unidos: [{ error: 'no' }] }; },
    paraClaudePrInfo_: url => gh.info[url] || (gh.abiertos[url] ? { estado: 'abierto' } : null),
    paraClaudeChecks_: (repo, sha) => gh.checks[sha] || null,
    opAgente_: (adm, pedido, canal) => { log.agente.push({ pedido, canal }); return { respuesta: 'Eres contacto principal en 7 apartamentos y secundario en 4: …', hechas: [{ tipo: 'consulta', resumen: 'Contactos de recepción · Hola' }] }; },
    opFilas_: () => [], formatearMensaje_: t => t,
    opGuardar_: (adm, de, canal, texto) => { log.chat.push({ de, canal, texto }); return { id: 'op' + log.chat.length }; },
    waEnviar_: (n, t) => { log.wa.push({ n, t }); return { ok: true }; },
    vozAvisoPoner_: (adm, t) => { log.avisos.push(t); },
    accionCrear_: (titulo, inst, url) => { log.acciones.push(url); },
    pendAvisar_: () => {}, tituloCorto_: t => t
  });
  return { ctx, log, gh, mem, mover: ms => { ahora += ms; delete cache.escalar_t; }, entregas: () => ctx.escalarEntregas_() };
}
const json = inp => { try { return JSON.parse(inp.que_quiere); } catch (e) { return null; } };
const LLAVES = ['rol', 'tarea', 'contexto', 'pasos', 'restricciones', 'formato_de_respuesta'];
const cerrar = (c, adm, pedido, respuesta, extra, o) => c.ctx.chatTurnoCerrar_(adm, ['op1'], pedido, Object.assign({ respuesta, hechas: [], esfera: 'Propósito', subcategoria: 'Operación' }, extra || {}), Object.assign({ canal: 'whatsapp' }, o || {}));

/* ── 1 ── */
{
  const c = caja(), out = cerrar(c, JUAN, PEDIDO, DIJO_11NOV), j = c.log.claude[0] && json(c.log.claude[0].inp);
  ok(c.log.claude.length === 1, '11-nov: «necesito pedírselo a Claudio… ¿Lo pido?» → una llamada real a Desarrollo en ese mismo turno');
  ok(j && LLAVES.every(k => k in j), 'el pedido es JSON válido con rol, tarea, contexto, pasos, restricciones y formato_de_respuesta');
  ok(j && j.contexto.pedido_exacto === PEDIDO && j.contexto.pedido_por.principal === true && j.contexto.pedido_por.nombre === 'Juan Ovalle' && j.contexto.canal === 'WhatsApp',
    'contexto: el pedido exacto de Juan, quién lo pidió (administrador principal) y por qué canal');
  ok(j && /pedírselo a Claudio/.test(j.contexto.intento_de_alma.dijo) && j.contexto.intento_de_alma.por_que_escalo && j.contexto.para_entregar === PEDIDO, 'contexto: qué intentó Alma, por qué escaló y para_entregar');
  ok(/ya quedó pedido/.test(out.texto) && /enlace/.test(out.texto) && !/[¿?]/.test(out.texto) && !/claud/i.test(out.texto), 'a Juan: una frase, ya pedido y que le avisa con el enlace; sin preguntar ni nombrar a Claudio');
  ok(c.log.claude[0] && c.log.claude[0].inp.sinChat === true && c.log.claude[0].inp.resumen === PEDIDO, 'el JSON no entra al chat de Juan (sinChat) y el historial lo guarda en simple');
  const e = c.entregas()[0];
  ok(e && e.pedido_por === 'principal' && e.para_entregar === PEDIDO && e.canal === 'whatsapp' && e.estado === 'pedido', 'queda su entrega: pedido_por principal y para_entregar (para unir y entregar sola)');
}
/* ── 2 ── */
{
  const casos = [[OFRECE_AGENTE, 'pregunta', 'ofrece al agente de operaciones y pregunta'], ['No tengo la herramienta para leer los contactos de Hola.', 'capacidad', 'no tiene la herramienta'],
    ['Eso no lo puedo sacar desde aquí.', 'capacidad', '«no lo puedo sacar»'], ['Le voy a pedir a desarrollo que lo exporte.', 'promesa', 'promete pedirlo a desarrollo']];
  casos.forEach(([dijo, motivo, nombre]) => { const c = caja(), out = cerrar(c, JUAN, PEDIDO, dijo); ok(c.log.claude.length === 1 && out.escalo === motivo, 'escala: ' + nombre + ' (' + motivo + ')'); });
  const c = caja(), out = cerrar(c, JUAN, PEDIDO, 'Listo.', { noPudo: ['contactos_hola'] });
  ok(c.log.claude.length === 1 && out.escalo === 'herramienta', 'escala: usó una herramienta que no existe');
}
/* ── 3 ── */
{
  const no = [[JUAN, 'Dale el código a Vianka', 'El que tengo es solo para el equipo y no se lo puedo dar a Vianka. ¿Me confirmás el código correcto para ella?', 'negativa de seguridad'],
    [JUAN, '¿Cuál es el número de Pedro?', 'No encontré a Pedro entre tus contactos.', '«no encontré»'],
    [JUAN, '¿Cómo va lo de Claudio con los contactos?', 'El pedido a Claudio sigue en trabajo; te aviso cuando tenga el PR.', 'el estado de algo que ya está con Claude'],
    [JUAN, '¿Qué te dijo Claudio?', 'Claudio dejó listo el cambio; está en Pendientes.', 'lo que respondió Claude'],
    [GABY, PEDIDO, DIJO_11NOV, 'otra persona (no el principal)']];
  no.forEach(([adm, p, dijo, nombre]) => { const c = caja(); cerrar(c, adm, p, dijo); ok(c.log.claude.length === 0, 'no escala: ' + nombre); });
  const c = caja(); cerrar(c, JUAN, PEDIDO, DIJO_11NOV, { hechas: [{ tipo: 'pedido_desarrollo', resumen: 'Pedido a Desarrollo' }] });
  ok(c.log.claude.length === 0, 'no escala otra vez si pedir_a_agente ya lo pidió en el turno');
  const c2 = caja(); cerrar(c2, JUAN, PEDIDO, DIJO_11NOV, {}, { sinEscalar: true });
  ok(c2.log.claude.length === 0, 'la entrega misma no vuelve a escalar (sinEscalar)');
  const c3 = caja(); cerrar(c3, JUAN, PEDIDO, DIJO_11NOV); c3.mover(30 * 60000); const o3 = cerrar(c3, JUAN, PEDIDO, DIJO_11NOV);
  ok(c3.log.claude.length === 1 && /ya quedó pedido/.test(o3.texto), 'lo mismo dos veces en 2 h: un solo pedido');
}
/* ── 4 ── */
{
  const c = caja(); cerrar(c, JUAN, 'Si', 'Listo, quedó pedido.', { subcategoria: 'Desarrollo', hechas: [{ tipo: 'pedido_desarrollo', resumen: 'Pedido a Desarrollo' }] });
  ok(c.log.desarrollo.length === 0 && c.log.claude.length === 0, 'Propósito · Desarrollo con pedir_a_agente en el mismo turno: no sale un segundo pedido');
  const c2 = caja(); cerrar(c2, JUAN, 'Cambia el color del botón', 'Listo.', { subcategoria: 'Desarrollo' });
  ok(c2.log.desarrollo.length === 1 && c2.log.claude.length === 0, 'un cambio que Juan pide sigue por su camino de siempre (chatDesarrollo_)');
}
/* ── 5 ── */
{
  const c = caja(); cerrar(c, JUAN, PEDIDO, DIJO_11NOV); const e0 = c.entregas()[0];
  ok(c.ctx.escalarAlResponder_(e0.micro, 'listo', [PR_HOLA, PR_HUB], 'Claude dejó lista la herramienta') === 'unir' && c.entregas()[0].estado === 'por_unir', 'Claude responde con dos PR: queda por unir, en ese orden');
  c.gh.abiertos[PR_HOLA] = 'revisando'; c.gh.abiertos[PR_HUB] = 'revisando';
  c.ctx.escalarRevisar_();
  ok(c.log.unir.length === 0, 'revisiones corriendo: no une todavía');
  c.gh.abiertos[PR_HOLA] = 'listo'; c.mover(120000); c.ctx.escalarRevisar_();
  ok(c.log.unir.join() === PR_HOLA && c.entregas()[0].estado === 'por_unir', 'Hola en verde: une Hola (unir_cambio) y espera al Hub');
  c.gh.abiertos[PR_HUB] = 'listo'; c.mover(120000); c.ctx.escalarRevisar_();
  ok(c.log.unir.join() === PR_HOLA + ',' + PR_HUB && c.entregas()[0].estado === 'publicando', 'Hub en verde: lo une y sigue la publicación');
  c.gh.checks.sha34 = { total: 2, ok: 2, corriendo: 0, fallas: 0 }; c.gh.checks.sha487 = { total: 3, ok: 2, corriendo: 1, fallas: 0 };
  c.mover(120000); c.ctx.escalarRevisar_();
  ok(c.entregas()[0].estado === 'publicando' && c.log.agente.length === 0, 'Publicar Apps Script todavía corre: no entrega');
  c.gh.checks.sha487 = { total: 3, ok: 3, corriendo: 0, fallas: 0 }; c.mover(120000); c.ctx.escalarRevisar_();
  ok(c.entregas()[0].estado === 'publicado' && c.log.agente.length === 0, 'publicado: la entrega va en la pasada siguiente (con el código nuevo)');
  c.mover(120000); c.ctx.escalarRevisar_();
  const a = c.log.agente[0], wa = c.log.wa.slice(-1)[0];
  ok(a && a.pedido.indexOf(PEDIDO) >= 0 && a.canal === 'whatsapp', 'entrega: Alma hace lo que Juan pidió, con su pedido exacto');
  ok(wa && /contacto principal en 7/.test(wa.t) && wa.t.indexOf(PR_HOLA) >= 0 && wa.t.indexOf(PR_HUB) >= 0 && /Uní los cambios que hacían falta/.test(wa.t), 'le llega por WhatsApp el resultado y, en una frase, los enlaces de lo que unió');
  ok(c.entregas()[0].estado === 'entregada' && c.log.acciones.length === 0, 'queda entregada y sin «Unir el PR» para Juan');
  c.mover(120000); c.ctx.escalarRevisar_();
  ok(c.log.agente.length === 1, 'no se entrega dos veces');
}
/* ── 6 ── */
{
  [['fallo', 'sus revisiones fallaron'], ['choque', 'choca con lo último de main']].forEach(([est, causa]) => {
    const c = caja(); cerrar(c, JUAN, PEDIDO, DIJO_11NOV); c.ctx.escalarAlResponder_(c.entregas()[0].micro, 'listo', [PR_HUB], 'listo');
    c.gh.abiertos[PR_HUB] = est; c.ctx.escalarRevisar_();
    const av = c.log.avisos.join(' | ');
    ok(c.log.unir.length === 0 && c.entregas()[0].estado === 'no_unida', est + ': no une');
    ok(av.indexOf(PR_HUB) >= 0 && av.indexOf(causa) >= 0 && c.log.wa.some(w => w.t.indexOf(PR_HUB) >= 0) && c.log.acciones.join() === PR_HUB, est + ': avisa con el enlace y la causa («' + causa + '») y deja «Unir el PR» para Juan');
  });
  const c = caja(); cerrar(c, JUAN, PEDIDO, DIJO_11NOV); c.ctx.escalarAlResponder_(c.entregas()[0].micro, 'listo', [PR_HUB], 'listo');
  c.gh.abiertos[PR_HUB] = 'listo'; c.ctx.escalarRevisar_(); c.gh.checks.sha487 = { total: 3, ok: 2, corriendo: 0, fallas: 1 }; c.mover(120000); c.ctx.escalarRevisar_();
  ok(c.entregas()[0].estado === 'fallo_pub' && c.log.agente.length === 0 && c.log.avisos.join().indexOf(PR_HUB) >= 0, 'se unió pero falló la publicación: no entrega y avisa con el enlace');
}
/* ── 7 ── */
{
  const c = caja(); c.ctx.escalarPedir_(GABY, { pedido: 'quiero un reporte', canal: 'hub' });
  ok(c.entregas().length === 0 && c.ctx.escalarAlResponder_('mp1', 'listo', [PR_HUB], 'listo') === '', 'pedido de otra persona: no guarda entrega y no se une solo');
  const c2 = caja(); cerrar(c2, JUAN, 'Cambia el color del botón', 'Listo.', { subcategoria: 'Desarrollo' });
  ok(c2.entregas().length === 0, 'un cambio que Juan pide (no algo que Alma no podía): espera su «une»');
  ok(c.ctx.escalarAlResponder_('otro', 'listo', [PR_HUB], 'x') === '', 'un PR que no es de una entrega: sin cambios');
}
/* ── 8 ── */
{
  const c = caja(), a = { id: 'operaciones', nombre: 'Operaciones', rol: 'Jefe de operaciones' }, j = JSON.parse(c.ctx.agPedidoJson_(a, 'Revisa las limpiezas de mañana'));
  ok(LLAVES.every(k => k in j) && j.tarea === 'Revisa las limpiezas de mañana', 'pedir_a_agente a Operaciones: el pedido va en JSON con las seis llaves');
  Object.assign(c.ctx, { agGuardar_: (sh, cab, o) => o, hojaAg_: () => null, hojaAgT_: () => null, AGENTE_TEXTO_: PEDIDO, AGENTE_CANAL_: 'whatsapp' });
  const r = c.ctx.agDesarrolloRonda_({ id: 'desarrollo', nombre: 'Desarrollo' }, JUAN, 'pedido', 'Listado de propiedades donde Juan es contacto de recepción en Hola');
  const p = c.log.claude[0], jd = p && json(p.inp);
  ok(r.ok && jd && LLAVES.every(k => k in jd) && jd.contexto.pedido_exacto === PEDIDO && !/Playwright/.test(p.inp.que_quiere), 'pedir_a_agente a Desarrollo: JSON con el pedido exacto de Juan, sin «míralo con Playwright»');
  ok(c.entregas().length === 1 && /ya quedó pedido/.test(r.informe), 'y su entrega queda para unir y entregar sola');
  c.ctx.AG_DEV_OBJETIVOS_ = [{ app: 'Hub', que: 'el Hub' }];
  c.ctx.agDesarrolloRonda_({ id: 'dev_hub', nombre: 'Desarrollo · Hub', app: 'Hub' }, JUAN, 'rutina', '');
  const jr = json(c.log.claude[1].inp);
  ok(jr && LLAVES.every(k => k in jr) && /Playwright/.test(jr.pasos.join(' ')) && c.entregas().length === 1, 'la ronda de una app también va en JSON (con sus pasos) y no se une sola');
}
/* ── 9: la respuesta de Claude (paraClaudeRespuesta_) con una hoja de dobles ── */
{
  const respuesta = (c, micro, enlaces) => {
    const huella = c.ctx.paraClaudeHuella_('llave1'), fila = ['pc1', '2026-11-11 14:33', 'Juan Ovalle', 'Otro', 'mejora', 'normal', 'Contactos', '', 'con Claude', '', '', '', huella, '', JUAN.email, micro, 'complejo'];
    const avisos = [], sh = { getLastRow: () => 2, getLastColumn: () => 17, getRange: () => ({ getValues: () => [fila], setValue() {}, setValues() {} }) };
    Object.assign(c.ctx, { ssAlma_: () => ({ getSheetByName: () => sh }), hojaCrear_: () => sh, microRespuesta_: () => ({ nombre: 'Contactos recepción Hola', estado: 'listo para unir' }), MICRO_ESTADOS_: { listo: 'listo para unir' },
      paraClaudeAvisar_: (t, v, est) => avisos.push(est) });
    c.ctx.paraClaudeRespuesta_({ id: 'pc1', llave: 'llave1', estado: 'listo', voz: 'Alma ya puede sacar tus contactos de recepción.', enlaces });
    return avisos;
  };
  const c = caja(); cerrar(c, JUAN, PEDIDO, DIJO_11NOV); const av = respuesta(c, c.entregas()[0].micro, [PR_HUB]);
  ok(c.entregas()[0].estado === 'por_unir' && c.log.acciones.length === 0 && av.length === 0, 'Claude responde con PR a lo que Alma escaló: sin «Unir el PR» ni «para que lo unas»; Alma lo une sola');
  const c2 = caja(), av2 = respuesta(c2, 'mp9', [PR_HUB]);
  ok(c2.log.acciones.join() === PR_HUB && av2.join() === 'listo', 'un PR de cualquier otro pedido: «Unir el PR» y el aviso de siempre (Juan une)');
}
process.exit(fallo);
