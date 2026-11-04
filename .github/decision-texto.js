/* Prueba de los casos por WhatsApp (apps-script/decisiones.js) con dobles: sin internet ni Google. Repite la secuencia
   del 3-nov (caso de Alejandra pendiente y Juan pidiendo escribirle a una socia) y revisa:
   1. una orden («Escríbele a Diana… +502…») con un caso pendiente va a Alma (el agente), NO al caso;
   2. un texto que cita el aviso del caso sí es la respuesta al caso (sale en 1 minuto, con «Deshacer»);
   3. sin citar, solo cuenta como respuesta si el clasificador dice que sí; la duda va al agente;
   4. «no era para Alejandra» detiene la salida, el caso vuelve a esperar, Alma dice una línea y el texto desviado
      vuelve a entrar como pedido normal; después, el texto sin citar ya no va al caso hasta que citen o toquen una opción;
   5. los botones A/B/C y «Deshacer» siguen igual;
   6. el aviso dice «Para otra respuesta, responde a este mensaje.» y Alma recibe el caso pendiente como contexto;
   7. (#446 T5B) un caso que se cerró por otro lado (respuesta propia, Hub, resuelto): sus botones viejos dicen
      «Ese caso ya quedó resuelto.» y no hacen nada, el Hub ya no recibe sus opciones y el chat con Alma las quita;
      un mensaje del equipo desde Airbnb o Hospitable lo cierra, uno de Alma (public_api) no;
   8. (#446 T6) un escalado a quien está de turno sale UNA vez, con los botones A/B/C, y su elección vuelve al caso igual
      que la de Juan (con «Deshacer»); si las opciones no salen, el escalamiento sale igual en texto, una sola vez.
   node .github/decision-texto.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = '50255550100';   // número de prueba, no es el real
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
function caja(clasificaSi) {
  const props = {}, enviados = [], clasif = [];
  let n = 0;
  const wa = hoja(['ts', 'wa', 'nombre', 'dir', 'texto', 'msg_id', 'conv_id', 'tipo', 'autor', 'media']);
  let dec = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent, decodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }) }) }) },
    CFG: { HUB_URL: 'https://hub.prueba', MODELO_CLASIFICADOR: 'clasificador', MODELO_REDACTOR: 'redactor', WHATSAPP_JUAN: JUAN, WHATSAPP_NOCTURNO: JUAN },
    USO_REF_: '',
    s_: v => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8),
    normTel_: x => String(x || '').replace(/\D/g, ''),
    vozColaLock_: () => ({ hasLock: () => false, waitLock() {}, releaseLock() {} }),
    hojaCrear_: (nombre, cab) => (dec = dec || hoja(cab)),
    hojaWA_: () => wa,
    waCfg_: () => ({ token: 't', phoneId: 'p' }),
    uf_: (url, o) => { const id = 'wamid.' + (++n); const b = JSON.parse(o.payload); enviados.push({ tipo: 'botones', id, texto: b.interactive.body.text, botones: b.interactive.action.buttons.map(x => x.reply.title) });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id }] }) }; },
    waEnviar_: (to, texto) => { enviados.push({ tipo: 'texto', texto }); return { ok: true }; },
    waVentana_: () => true, deTurno_: () => [{ telefono: JUAN, nombre: 'Juan' }], escalamiento_: () => [],
    adminPorTel_: w => (w === JUAN ? { nombre: 'Juan Prueba', email: 'juan@prueba', tels: [JUAN], principal: true } : null),
    adminsOp_: () => [{ nombre: 'Juan Prueba', email: 'juan@prueba', tels: [JUAN], principal: true }],
    opActivo_: () => true, opWaProgramar_() {},
    claude_: (modelo, max, sys, usr) => { if (modelo === 'redactor') return ctx._redactor ? ctx._redactor() : ''; clasif.push(usr); return clasificaSi(usr) ? '{"caso": true}' : '{"caso": false}'; },
    opGuardar_: () => ({}), esAutoHosp_: m => /automat/.test(String(m.source || '')), esContencion_: () => false,
    preContexto_: () => ({ codigo: 'HM1' }), textosAlma_: () => ['Texto que mandó Alma'],
    hubRedactar_: (resId, t) => ({ ok: true, texto: 'Pulido: ' + t }),
    hubResponder_: () => ({ ok: true }),
    formatearMensaje_: t => t, limpiarSalida_: t => ({ texto: t }), estilo_: () => ''
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'decisiones.js'), 'utf8'), ctx);
  return { ctx, props, enviados, clasif, wa, dec: () => dec };
}
const OPS = [{ letra: 'A', titulo: 'Biblia encontrada', detalle: 'Coordinar entrega', mensaje: 'Alejandra, el equipo encontró tu biblia.', accion: 'ninguna' },
  { letra: 'B', titulo: 'Seguimos buscando', detalle: 'Aún no aparece', mensaje: 'Alejandra, seguimos buscándola.', accion: 'ninguna' },
  { letra: 'C', titulo: 'No apareció', detalle: 'No la encontramos', mensaje: 'Alejandra, lamentablemente no apareció.', accion: 'ninguna' }];
/* El caso de Alejandra, ya con sus opciones, avisado por WhatsApp a Juan. Devuelve el id del aviso. */
function conCaso(c) {
  const sh = c.ctx.hojaDec_();
  const fila = c.ctx.DEC_CAB_.map(k => ({ id: 'dc1', resId: 'res-1', creado: new Date().toISOString(), opciones: JSON.stringify(OPS), estado: 'abierta', origen: 'promesa',
    motivo: 'El equipo confirmará si encontraron la biblia', intentos: 0,
    contexto: JSON.stringify({ huesped: 'Alejandra', propiedad: 'Z4 - EdificioA4 - 304', texto: '¿encontraron la biblia?' }) })[k]);
  sh.appendRow(fila.map(v => v === undefined ? '' : v));
  c.ctx.decisionAvisarWa_(c.ctx.decFilas_().filas[0]);
  const aviso = c.enviados.filter(e => e.tipo === 'botones').pop();
  c.enviados.length = 0;
  return aviso;
}
const texto = (body, citado) => ({ id: 'in.' + Math.random(), type: 'text', text: { body }, context: citado ? { id: citado } : undefined });
const boton = (id, titulo) => ({ id: 'in.' + Math.random(), type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title: titulo } } });
const caso = c => c.ctx.decFilas_().filas[0];
const DIANA = 'Escríbele a diana de casa sol +502 5555 0101\n\nElla es la socia de todos los apartamentos de Mónaco.\n\nNecesito que le hablemos y nos presentemos como la asistente de spacio am y luego que le preguntemos si hay algún pendiente';

{ const c = caja(() => true);   // aunque el clasificador dijera que sí, una orden nunca se le pregunta
  const aviso = conCaso(c);
  ok(/Para otra respuesta, responde a este mensaje\./.test(aviso.texto) && !/escríbela aquí/.test(aviso.texto), 'el aviso dice «Para otra respuesta, responde a este mensaje.»');
  ok(aviso.botones.join('|') === 'Biblia encontrada|Seguimos buscando|No apareció', 'el aviso trae los 3 botones A/B/C');
  const r = c.ctx.decisionWaEntrante_(texto(DIANA), JUAN, '');
  ok(r === false && !c.enviados.length && caso(c).estado === 'abierta' && !caso(c).sale_estado, 'la orden de escribirle a Diana con el caso pendiente va al agente, no al caso');
  ok(!c.clasif.length, 'la orden ni siquiera pasa por el clasificador');
  const nota = c.ctx.decNotaAgente_(JUAN);
  ok(/Alejandra/.test(nota) && /NO se tomó como respuesta/.test(nota), 'Alma (el agente) recibe el caso pendiente como contexto');
  ok(c.ctx.decisionWaEntrante_(texto('Mándale a Gabriel la lista de limpieza'), JUAN, '') === false, '«Mándale a Gabriel…» tampoco va al caso'); }

{ const c = caja(() => false);   // la duda: el clasificador dice que no
  conCaso(c);
  ok(c.ctx.decisionWaEntrante_(texto('Y cómo vamos con lo de mañana'), JUAN, '') === false && c.clasif.length === 1 && caso(c).estado === 'abierta', 'sin citar y con duda: va al agente'); }

{ const c = caja(() => false);
  const aviso = conCaso(c);
  const r = c.ctx.decisionWaEntrante_(texto('Dile que no apareció, que lo sentimos', aviso.id), JUAN, '');
  const f = caso(c), salida = c.enviados.filter(e => e.tipo === 'botones').pop();
  ok(r === true && f.estado === 'elegida' && f.opcion === 'otra' && f.sale_estado === 'programado', 'citando el aviso: es la respuesta al caso (sale en 1 minuto)');
  ok(salida && /^Sale en 1 minuto para Alejandra/.test(salida.texto) && salida.botones[0] === 'Deshacer', 'muestra el texto con «Deshacer»');
  ok(!c.clasif.length, 'citado: no hace falta el clasificador');
  /* Citar el borrador también es responder al caso. */
  const r2 = c.ctx.decisionWaEntrante_(texto('Mejor agrégale que la seguimos buscando', salida.id), JUAN, '');
  ok(r2 === true && /seguimos buscando/.test(caso(c).borrador), 'citando el borrador: también es el caso'); }

{ const c = caja(usr => /no apareció en la limpieza/.test(usr));   // el clasificador dice que sí: es para el huésped
  conCaso(c);
  const r = c.ctx.decisionWaEntrante_(texto('Revisamos y no apareció en la limpieza, lo sentimos mucho'), JUAN, '');
  ok(r === true && caso(c).sale_estado === 'programado' && c.clasif.length === 1, 'sin citar, con un sí claro del clasificador: es la respuesta al caso');
  c.enviados.length = 0;
  const antes = c.wa.filas.length;
  const rc = c.ctx.decisionWaEntrante_(texto('Mi anterior mensaje no era para alejandra'), JUAN, '');
  const f = caso(c), linea = c.enviados.filter(e => e.tipo === 'texto').pop();
  ok(rc === true && f.sale_estado === 'deshecho' && f.estado === 'abierta' && !f.borrador && !f.opcion, '«no era para alejandra»: no sale y el caso vuelve a esperar');
  ok(linea && linea.texto === 'Entendido, no era para Alejandra.', 'Alma responde una línea: «' + (linea && linea.texto) + '»');
  const otraVez = c.wa.filas.slice(antes).filter(r => r[8] === 'operativo_pend');
  ok(otraVez.length === 1 && /no apareció en la limpieza/.test(otraVez[0][4]) && otraVez[0][6] === 'op:juan@prueba' && c.props.OP_WA_PEND === '1', 'el texto desviado vuelve a Alma como un pedido normal');
  ok(!!f.sin_texto, 'el caso queda «no contestar con texto libre»');
  const n0 = c.clasif.length;
  ok(c.ctx.decisionWaEntrante_(texto('Revisamos y no apareció en la limpieza, lo sentimos mucho'), JUAN, '') === false && c.clasif.length === n0, 'después, sin citar ya no va al caso (ni pregunta al clasificador)');
  c.enviados.length = 0;
  const rc2 = c.ctx.decisionWaEntrante_(texto('No se porque estas indicando que esta es la respuesta a alejandra … no es el caso es un tema aparte'), JUAN, '');
  ok(rc2 === true && c.enviados.length === 1 && c.enviados[0].texto === 'Entendido, no era para Alejandra.' && caso(c).estado === 'abierta', 'otra corrección: la misma línea, nada sale');
  const aviso = c.ctx.decWaMapa_()[c.ctx.fin8_(JUAN)];
  const rq = c.ctx.decisionWaEntrante_(texto('No la encontramos, lo sentimos', aviso.msgs[0]), JUAN, '');
  ok(rq === true && caso(c).sale_estado === 'programado' && !caso(c).sin_texto, 'citando el aviso otra vez: vuelve a aceptar la respuesta'); }

{ const c = caja(() => false);
  conCaso(c);
  const r = c.ctx.decisionWaEntrante_(boton('dec:dc1:A', 'Biblia encontrada'), JUAN, '');
  const salida = c.enviados.filter(e => e.tipo === 'botones').pop();
  ok(r === true && caso(c).opcion === 'A' && caso(c).sale_estado === 'programado' && /opción A/.test(salida.texto), 'botón A: sale en 1 minuto, como antes');
  const rd = c.ctx.decisionWaEntrante_(boton('dec:dc1:deshacer', 'Deshacer'), JUAN, '');
  ok(rd === true && caso(c).sale_estado === 'deshecho' && c.enviados.pop().texto === 'Listo, no lo mandé.', '«Deshacer»: no sale, como antes');
  const rb = c.ctx.decisionWaEntrante_(boton('dec:dc1:C', 'No apareció'), JUAN, '');
  ok(rb === true && caso(c).opcion === 'C' && caso(c).sale_estado === 'programado', 'botón C después de deshacer: sale la C'); }

/* 7 · #446 T5B: el caso se cerró por otro lado y los botones viejos ya no estorban. */
{ const c = caja(() => false);
  conCaso(c);
  c.ctx.decisionAlResponder_('res-1', 'Juan');   // Juan le contestó a Alejandra desde el Hub
  ok(caso(c).estado === 'enviada', 'responder desde el Hub cierra el caso');
  const r = c.ctx.decisionWaEntrante_(boton('dec:dc1:B', 'Seguimos buscando'), JUAN, '');
  const linea = c.enviados.pop();
  ok(r === true && linea && linea.texto === 'Ese caso ya quedó resuelto.' && caso(c).opcion !== 'B' && !caso(c).sale_estado, 'botón viejo: «Ese caso ya quedó resuelto.» y no elige nada');
  const rd = c.ctx.decisionWaEntrante_(boton('dec:dc1:deshacer', 'Deshacer'), JUAN, '');
  ok(rd === true && c.enviados.pop().texto === 'Ese caso ya quedó resuelto.', '«Deshacer» viejo (nada estaba por salir): la misma línea');
  const rx = c.ctx.decisionWaEntrante_(boton('dec:dcviejo:A', 'Algo'), JUAN, '');
  ok(rx === true && c.enviados.pop().texto === 'Ese caso ya quedó resuelto.', 'botón de un caso que ya no está en la hoja: la misma línea');
  const pub = c.ctx.decisionLeer_('res-1');
  ok(pub && pub.opciones.length === 0 && pub.estado === 'enviada', 'el Hub ya no recibe sus opciones (la tarjeta no se pinta)');
  const aviso = { de: 'alma', ts: new Date().toISOString(), texto: c.ctx.decTextoChat_(Object.assign({}, caso(c), { opciones: JSON.stringify(OPS) })) };
  const otro = { de: 'alma', ts: aviso.ts, texto: 'Hola' };
  const sin = c.ctx.decChatSinOpciones_([aviso, otro]);
  ok(!/\[\[opciones\]\]/.test(sin[0].texto) && /Ese caso ya quedó resuelto\./.test(sin[0].texto) && /Alejandra/.test(sin[0].texto) && sin[1] === otro, 'chat con Alma: el aviso queda sin opciones, con la línea');
  ok(/\[\[opciones\]\]/.test(aviso.texto), 'la fila guardada no se toca (solo se limpia al leer)'); }

{ const c = caja(() => false);
  conCaso(c);
  const sh = c.ctx.hojaDec_(); sh.filas[1][c.ctx.DEC_CAB_.indexOf('creado')] = new Date(Date.now() - 10 * 60000).toISOString();
  const vivo = { aviso: { de: 'alma', ts: new Date().toISOString(), texto: c.ctx.decTextoChat_(caso(c)) } };
  ok(/\[\[opciones\]\]/.test(c.ctx.decChatSinOpciones_([vivo.aviso])[0].texto), 'caso abierto: el chat conserva sus opciones');
  const ahora = new Date().toISOString();
  ok(c.ctx.decisionHumanoHosp_('res-1', { sender_type: 'host', source: 'public_api', body: 'Hola Alejandra', created_at: ahora }) === false && caso(c).estado === 'abierta', 'Hospitable: lo que sale por la API (Alma o el Hub) no lo cierra');
  ok(c.ctx.decisionHumanoHosp_('res-1', { sender_type: 'host', source: 'automated', body: 'Recordatorio', created_at: ahora }) === false, 'Hospitable: un automático no lo cierra');
  ok(c.ctx.decisionHumanoHosp_('res-1', { sender_type: 'host', source: 'platform', body: 'Texto que mandó Alma', created_at: ahora }) === false, 'Hospitable: un texto que ya mandó Alma no lo cierra');
  ok(c.ctx.decisionHumanoHosp_('res-1', { sender_type: 'host', source: 'platform', body: 'Hola Alejandra, la encontramos', created_at: ahora }) === true && caso(c).estado === 'enviada', 'Hospitable: Juan le contestó desde Airbnb → el caso se cierra');
  const r = c.ctx.decisionWaEntrante_(boton('dec:dc1:A', 'Biblia encontrada'), JUAN, '');
  ok(r === true && c.enviados.pop().texto === 'Ese caso ya quedó resuelto.', 'y su botón ya no hace nada'); }

{ const c = caja(() => false);   // ya había salido: «Deshacer» sigue diciendo «Ya había salido.»
  conCaso(c);
  c.ctx.hubResponder_ = resId => { c.ctx.decisionAlResponder_(resId, 'Juan'); return { ok: true }; };   // como el de verdad: cierra el caso
  c.ctx.decisionWaEntrante_(boton('dec:dc1:A', 'Biblia encontrada'), JUAN, '');
  const sh = c.ctx.hojaDec_(); sh.filas[1][c.ctx.DEC_CAB_.indexOf('sale_ts')] = new Date(Date.now() - 1000).toISOString();
  c.props.DEC_SALE = String(Date.now() - 1000);
  ok(c.ctx.decisionesSalir_() === 1 && caso(c).estado === 'enviada' && caso(c).sale_estado === 'enviado', 'la opción A salió al minuto');
  c.enviados.length = 0;
  c.ctx.decisionWaEntrante_(boton('dec:dc1:deshacer', 'Deshacer'), JUAN, '');
  ok(c.enviados.pop().texto === 'Ya había salido.', '«Deshacer» después de salir: «Ya había salido.»'); }

/* 8 · #446 T6: escalado a quien está de turno, con botones. */
const ANA = '50255550200';   // número de prueba
function cajaTurno(redactor) {
  const c = caja(() => false);
  c.ctx.deTurno_ = () => [{ telefono: ANA, nombre: 'Ana', email: 'ana@prueba' }];
  c.ctx.escalamiento_ = () => [{ telefono: ANA, nombre: 'Ana' }];
  c.ctx._redactor = redactor;
  c.ctx.decisionCrear_({ resId: 'res-9', huesped: 'Marta', propiedad: 'Z10 - Ignacio - 301', texto: 'No hay agua caliente', hiloTexto: '[HUÉSPED] No hay agua caliente' }, 'escalado', 'Sin agua caliente',
    { asunto: 'ALMA ROJO · Z10 - Ignacio - 301', texto: 'Huésped: Marta\nMotivo: sin agua caliente\n\nEscalado por ALMA · motivo: urgente' });
  c.ctx.decisionesProcesar_();
  return c;
}
{ const c = cajaTurno(() => JSON.stringify({ opciones: OPS.map(o => Object.assign({}, o, { mensaje: o.mensaje.replace('Alejandra', 'Marta') })) }));
  const avisos = c.enviados.filter(e => e.tipo === 'botones'), textos = c.enviados.filter(e => e.tipo === 'texto');
  ok(avisos.length === 1 && !textos.length, 'el escalado sale una sola vez a quien está de turno, con botones (sin el texto aparte)');
  ok(/^Alma necesita al equipo · Marta · Z10 - Ignacio - 301/.test(avisos[0].texto) && avisos[0].botones.length === 3, 'el aviso dice que Alma necesita al equipo y trae A/B/C: «' + avisos[0].texto.split('\n')[0] + '»');
  ok(!!JSON.parse(caso(c).contexto).esc_av, 'queda anotado que el escalamiento ya salió');
  c.enviados.length = 0;
  const r = c.ctx.decisionWaEntrante_(boton('dec:' + caso(c).id + ':B', 'Seguimos buscando'), ANA, '');
  const salida = c.enviados.filter(e => e.tipo === 'botones').pop();
  ok(r === true && caso(c).opcion === 'B' && caso(c).sale_estado === 'programado' && caso(c).sale_wa === ANA && /Sale en 1 minuto para Marta/.test(salida.texto), 'Ana toca B: sale al minuto para Marta, como cuando elige Juan');
  ok(caso(c).quien === 'Ana', 'queda «Resuelto por Ana»');
  const rd = c.ctx.decisionWaEntrante_(boton('dec:' + caso(c).id + ':deshacer', 'Deshacer'), ANA, '');
  ok(rd === true && caso(c).sale_estado === 'deshecho' && c.enviados.pop().texto === 'Listo, no lo mandé.', 'y Ana puede deshacerlo'); }

{ const c = cajaTurno(() => 'no es JSON');   // la IA no dio opciones
  const textos = c.enviados.filter(e => e.tipo === 'texto');
  ok(textos.length === 1 && /^ALMA ROJO · Z10 - Ignacio - 301/.test(textos[0].texto) && /hub\.prueba\/\?conv=res-9/.test(textos[0].texto), 'sin opciones: el escalamiento sale igual, en texto');
  c.ctx.decisionesProcesar_();
  ok(c.enviados.filter(e => e.tipo === 'texto').length === 1, 'y no se repite en el siguiente intento'); }

process.exit(fallo);
