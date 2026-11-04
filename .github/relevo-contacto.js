/* Prueba del relevo de contacto (apps-script/relevo.js, contacto.js y el WhatsApp de Juan en Código.js) con dobles: sin
   internet ni Google. Repite la secuencia del 4-nov: Gustavo Peña (socio nuevo) contestó «Hola» y «Mucho gusto», Alma se
   lo pasó a Juan («Gustavo Peña respondió: … (Dime qué le contesto y se lo escribo.)») y Juan respondió CITANDO ese
   mensaje. Alma preguntó si era para Inés Flores y después pidió el número. Revisa:
   1. el relevo queda guardado con el id de su WhatsApp (WA_RELEVOS y ALMA_WHATSAPP), con el número, el nombre y lo pedido;
   2. la respuesta de Juan citándolo llega a Alma con «RESPUESTA CITADA» para Gustavo (su número, mensaje_personal, su
      conversación y que la instrucción ya es el sí), sin preguntar a quién y sin el caso de un huésped pendiente; el caso
      tampoco la toma (ni se le pregunta al clasificador);
   3. «A Gustavo Peña» sin citar: contactoRecientes_ lo encuentra por nombre en los registros (aunque ya no esté en
      WA_RELAY), con su número y sus últimos mensajes, y Alma recibe a Gustavo como relevo que espera indicación;
   4. un mensaje sin cita y sin nombre, sin relevos, sigue igual que antes (sin notas nuevas); citar otro mensaje de Alma
      no es un relevo.
   node .github/relevo-contacto.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = '50255550100', GUS = '50255550199', INES = '50255550177';   // números de prueba, no son los reales
const COD = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
const sacar = nombre => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(COD); if (!m) throw new Error('no encontré ' + nombre + ' en Código.js'); return m[0]; };

function hoja(cab) {
  const filas = cab ? [cab.slice()] : [];
  return {
    filas,
    getLastRow: () => filas.length, getLastColumn: () => Math.max.apply(null, filas.map(r => r.length).concat([0])),
    appendRow: r => { filas.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
      setValue: v => { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; },
      setValues: vs => { vs.forEach((row, i) => row.forEach((v, j) => { filas[r - 1 + i] = filas[r - 1 + i] || []; filas[r - 1 + i][c - 1 + j] = v; })); }
    })
  };
}
function caja() {
  const props = {}, cache = {}, enviados = [], procesados = [], clasif = [];
  let n = 0, dec = null;
  const wa = hoja(['ts', 'wa', 'nombre', 'dir', 'texto', 'msg_id', 'conv_id', 'tipo', 'autor', 'media']);
  const JUAN_ADM = { nombre: 'Juan Prueba', email: 'juan@prueba', tels: [JUAN], principal: true };
  const ctx = {
    console: { log() {}, warn() {}, error(e) { console.log('  (error en la prueba) ' + e); } }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent, decodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }) }) }) },
    Utilities: { sleep() {}, formatDate: d => new Date(d).toISOString().slice(11, 16), getUuid: () => 'u' + (++n) },
    SpreadsheetApp: { flush() {} },
    CFG: { HUB_URL: 'https://hub.prueba', MODELO_CLASIFICADOR: 'clasificador', MODELO_REDACTOR: 'redactor', WHATSAPP_JUAN: JUAN, WHATSAPP_NOCTURNO: JUAN, TZ: 'America/Guatemala', TAB_COLA: 'ALMA_COLA' },
    USO_REF_: '',
    s_: v => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8),
    normTel_: x => String(x || '').replace(/\D/g, ''),
    celdaTexto_: x => String(x),
    hojaWA_: () => wa,
    hojaCrear_: (nombre, cab) => (dec = dec || hoja(cab)),
    vozColaLock_: () => ({ hasLock: () => false, waitLock() {}, releaseLock() {} }),
    waCfg_: () => ({ token: 't', phoneId: 'p', equipo: [] }),
    waPropietarios_: () => [], vSet_() {}, waCategoria_: () => 'otro', waReserva_: () => null, recepcionDe_: () => null, encargoAbierto_: () => null,
    adminPorTel_: w => (ctx.fin8_(w) === ctx.fin8_(JUAN) ? JUAN_ADM : null),
    adminPorEmail_: e => (e === 'juan@prueba' ? JUAN_ADM : null),
    adminsOp_: () => [JUAN_ADM], opActivo_: () => true, opWaProgramar_() {}, opAgruparSeg_: () => 0,
    escalamiento_: () => [], deTurno_: () => [],
    datosHechoDeRespuesta_: () => [], proyNotar_() {},
    opGuardar_: () => ({}),
    waVentana_: () => true,
    waEnviar_: (to, texto) => { const id = 'wamid.out' + (++n); enviados.push({ to: String(to), texto, id }); return { ok: true, modo: 'texto', id }; },
    uf_: (url, o) => { const id = 'wamid.btn' + (++n); const b = JSON.parse(o.payload); enviados.push({ to: b.to, texto: (b.interactive && b.interactive.body.text) || '', id });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id }] }) }; },
    claude_: (modelo, max, sys, usr) => { clasif.push(usr); return '{"caso": true}'; },
    opProcesar_: (adm, texto, canal, fotos, nota) => { procesados.push({ texto, nota: nota || '' }); return { ok: true }; },
    WA_CAB_: ['ts', 'wa', 'nombre', 'dir', 'texto', 'msg_id', 'conv_id', 'tipo', 'autor', 'media'],
    formatearMensaje_: t => t, hubRedactar_: (r, t) => ({ ok: true, texto: t }), hubResponder_: () => ({ ok: true }), preContexto_: () => ({}), textosAlma_: () => []
  };
  vm.createContext(ctx);
  ['contacto.js', 'relevo.js', 'decisiones.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  vm.runInContext(['waEntrante_', 'waCitado_', 'opWaProcesar_'].map(sacar).join('\n'), ctx, { filename: 'Código.js (extracto)' });
  return { ctx, props, cache, enviados, procesados, clasif, wa };
}
const PRECIOS = 'Hola Gustavo, mucho gusto. Soy Alma, la asistente de Juan. Te comparto los precios de referencia: refrigerador, microondas, cooktop, cafetera y torre de lavado.';
let reloj = Date.parse('2026-11-04T17:30:00Z'), sec = 0;
const msg = (from, texto, citado) => Object.assign({ from, id: 'wamid.in' + (++sec), type: 'text', text: { body: texto }, timestamp: String(Math.floor((reloj += 1000) / 1000)) }, citado ? { context: { id: citado } } : {});
/* El 3-nov Juan le pidió escribirle a Gustavo (mensaje personal programado) y a Inés; Inés aún no responde. */
function preparar(c, conRelay) {
  const hace = h => new Date(Date.now() - h * 3600000).toISOString();
  c.wa.appendRow([hace(4), GUS, 'Gustavo Peña', 'out', '[plantilla personal: ¿tienes un minuto?] · pendiente: ' + PRECIOS, '', 'wa:' + GUS, 'text', 'alma', '']);
  c.wa.appendRow([hace(4), INES, 'Inés Flores', 'out', '[plantilla personal: ¿tienes un minuto?] · pendiente: Hola Inés… tu apartamento en Amalfi…', '', 'wa:' + INES, 'text', 'alma', '']);
  c.props.WA_PEND = JSON.stringify({ [c.ctx.fin8_(INES)]: [{ texto: 'Hola Inés… tu apartamento en Amalfi…', ts: Date.now() - 4 * 3600000, nombre: 'Inés Flores' }],
    [c.ctx.fin8_(GUS)]: [{ texto: PRECIOS, ts: Date.now() - 4 * 3600000, nombre: 'Gustavo Peña' }] });
  if (conRelay) c.ctx.personalRelay_(GUS, { nombre: 'Gustavo Peña', dest: JUAN, adm: 'juan@prueba', de: 'Juan', objetivo: '', ctx: '', h: [], fin: false });
}

/* ── 1 y 2. La secuencia de las capturas ── */
{
  const c = caja(); preparar(c, true);
  /* Caso de un huésped pendiente para Juan (como el 4-nov): su texto sin citar se lo preguntaría al clasificador. */
  const sh = c.ctx.hojaDec_();
  sh.appendRow(c.ctx.DEC_CAB_.map(k => ({ id: 'dc1', resId: 'res-1', creado: new Date().toISOString(), estado: 'abierta', origen: 'promesa', motivo: 'Confirmar TV', intentos: 0,
    opciones: JSON.stringify([{ letra: 'A', titulo: 'Sí', mensaje: 'Sí tiene TV.' }]), contexto: JSON.stringify({ huesped: 'Andrea', propiedad: 'Z10 - Ignacio - 904' }) })[k] || ''));
  c.props.DEC_WA = JSON.stringify({ [c.ctx.fin8_(JUAN)]: { id: 'dc1', ts: Date.now(), msg: 'wamid.caso' } });

  c.ctx.waEntrante_(msg(GUS, 'Hola'), 'Gp');
  c.ctx.waEntrante_(msg(GUS, 'Mucho gusto'), 'Gp');
  ok(c.enviados.filter(e => e.to === JUAN && /^Gustavo Peña respondió:/.test(e.texto) && /Dime qué le contesto/.test(e.texto)).length === 2, 'los dos relevos le llegan a Juan («Gustavo Peña respondió: … Dime qué le contesto»)');
  const relevo = c.enviados.filter(e => e.to === JUAN && /Hola\n/.test(e.texto))[0];
  const mapa = JSON.parse(c.props.WA_RELEVOS || '{}'), e1 = relevo && mapa[relevo.id];
  ok(!!e1 && e1.wa === GUS && e1.nombre === 'Gustavo Peña' && /precios de referencia/.test(e1.pedido), 'el relevo guarda su id con el número, el nombre y lo que se le pidió (los precios)');
  ok(c.wa.filas.some(r => r[5] === (relevo && relevo.id) && r[6] === 'relevo:' + GUS), 'el relevo queda en ALMA_WHATSAPP con su id (la cita ya no sale vacía)');

  c.ctx.waEntrante_(msg(JUAN, 'Dale seguimiento al proceso de amueblado de su apartamento, pregúntale cuáles tiene en mente como siguientes pasos y cuándo quisiera iniciar', relevo && relevo.id), 'Juan');
  ok(c.clasif.length === 0, 'citar el relevo no pasa por el caso del huésped (ni se le pregunta al clasificador)');
  c.ctx.opWaProcesar_();
  const p = c.procesados[0] || { texto: '', nota: '' };
  ok(c.procesados.length === 1, 'el mensaje de Juan va a Alma (el agente) una sola vez');
  ok(/\[respondiendo a: «Gustavo Peña respondió/.test(p.texto), 'Alma ve qué citó Juan («respondiendo a: Gustavo Peña respondió…»)');
  ok(/RESPUESTA CITADA/.test(p.nota) && /Gustavo Peña/.test(p.nota) && p.nota.indexOf('+' + GUS) >= 0, 'la nota dice que es para Gustavo Peña, con su número');
  ok(/mensaje_personal/.test(p.nota) && /ya es el sí/.test(p.nota) && /No preguntes a quién va ni pidas el número/.test(p.nota), 'la nota pide escribirle ya con mensaje_personal: la instrucción es el sí, sin preguntar ni pedir número');
  ok(/CONVERSACIÓN CON GUSTAVO PEÑA/.test(p.nota) && /Mucho gusto/.test(p.nota) && /precios de referencia/.test(p.nota), 'la nota trae la conversación con Gustavo como contexto');
  ok(!/Inés|Andrea/.test(p.nota), 'nada de Inés ni del caso de la huésped en lo que recibe Alma');
  ok(c.ctx.relevoPendientes_(JUAN).length === 0, 'el relevo citado queda atendido (ya no es candidato)');
}

/* ── 3. «A Gustavo Peña» sin citar: lo encuentra en sus registros ── */
{
  const c = caja(); preparar(c, true);
  c.ctx.waEntrante_(msg(GUS, 'Hola'), 'Gp');
  delete c.props.WA_RELAY;   // aunque su conversación personal ya haya vencido
  const L = c.ctx.contactoRecientes_('Gustavo Peña', 30);
  ok(L.length === 1 && L[0].numero === '+' + GUS, 'buscar «Gustavo Peña» lo encuentra en los registros, con su número');
  ok(L[0] && L[0].ultimos_mensajes.some(x => /GUSTAVO PEÑA: Hola/.test(x)) && /precios de referencia/.test(L[0].encargo || ''), 'trae sus últimos mensajes y lo que se le pidió');
  const n = c.ctx.relevoNumeroDe_('gustavo pena');
  ok(!!n && n.wa === GUS, 'mensaje_personal sin número también lo encuentra (sin acentos)');
  ok(c.ctx.contactoRecientes_('Pedro Alvarado', 30).length === 0 && c.ctx.contactoRecientes_('Juan Prueba', 30).length === 0, 'no inventa: alguien que no aparece (o el propio Juan) no sale');
  c.ctx.waEntrante_(msg(JUAN, 'A Gustavo Peña'), 'Juan');
  c.ctx.opWaProcesar_();
  const p = c.procesados[0] || { nota: '' };
  ok(/RESPUESTAS QUE ESPERAN TU INDICACIÓN/.test(p.nota) && /Gustavo Peña/.test(p.nota) && !/RESPUESTA CITADA/.test(p.nota), 'sin cita, Alma recibe a Gustavo como relevo que espera indicación (no a Inés)');
}

/* ── 4. Sin cita, sin nombre y sin relevos: igual que antes ── */
{
  const c = caja(); preparar(c, false);
  c.ctx.waEntrante_(msg(JUAN, '¿Cuántas llegadas hay hoy?'), 'Juan');
  c.ctx.opWaProcesar_();
  const p = c.procesados[0] || { texto: 'x', nota: 'x' };
  ok(c.procesados.length === 1 && p.texto === '¿Cuántas llegadas hay hoy?' && p.nota === '', 'un mensaje normal llega a Alma igual que antes, sin notas nuevas');
  c.wa.appendRow([new Date().toISOString(), JUAN, '', 'out', 'Hoy hay 3 llegadas.', 'wamid.normal', 'otra', 'text', 'alma', '']);
  c.ctx.waEntrante_(msg(JUAN, '¿Y mañana?', 'wamid.normal'), 'Juan');
  c.ctx.opWaProcesar_();
  const q = c.procesados[1] || { nota: 'x' };
  ok(c.procesados.length === 2 && !/RESPUESTA CITADA|RESPUESTAS QUE ESPERAN/.test(q.nota), 'citar otro mensaje de Alma no es un relevo');
}

process.exit(fallo);
