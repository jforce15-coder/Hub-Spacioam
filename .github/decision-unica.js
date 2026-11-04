/* Prueba de «un mensaje del huésped = un caso = un aviso» (apps-script/decisiones.js) con dobles: sin internet ni Google.
   Repite el 3-nov: el caso de Alejandra (¿encontraron la biblia?) llegó dos veces a Juan, a las 14:57:38 y 14:57:43,
   con opciones A/B/C distintas. Dos pasadas de procesarCola se cruzaron y cada una llamó a la IA y avisó. Revisa:
   1. dos disparos que procesan el mismo caso a la vez → la IA corre una vez y sale un aviso por persona;
   2. el mismo mensaje del huésped procesado otra vez (aunque el caso ya se resolvió) → el mismo caso, sin aviso nuevo;
   3. un mensaje distinto del huésped, con el caso anterior resuelto → un caso nuevo, con su aviso;
   4. con el caso todavía abierto, un mensaje distinto no abre otro (una sola decisión viva por conversación);
   5. una reserva vieja (la pasada se cayó a medias) la toma la siguiente pasada; la IA sin opciones se reintenta.
   node .github/decision-unica.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const JUAN = '50255550100', TURNO = '50255550200';   // números de prueba, no son reales
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
const opsJson = n => JSON.stringify({ opciones: ['A', 'B', 'C'].map(l => ({ titulo: 'Opción ' + l + n, detalle: 'Detalle ' + n, mensaje: 'Alejandra, respuesta ' + l + n + '.', accion: 'ninguna' })) });
function caja() {
  const props = {}, avisos = [], chat = [];
  let n = 0, ia = 0, dec = null, candado = false;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, encodeURIComponent, decodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CFG: { HUB_URL: 'https://hub.prueba', MODELO_CLASIFICADOR: 'clasificador', MODELO_REDACTOR: 'redactor', WHATSAPP_JUAN: JUAN, WHATSAPP_NOCTURNO: JUAN },
    USO_REF_: '',
    s_: v => (v === null || v === undefined || typeof v === 'object') ? '' : String(v),
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8),
    normTel_: x => String(x || '').replace(/\D/g, ''),
    /* Candado de verdad (uno solo): si otra pasada lo tiene, waitLock falla como en Apps Script. */
    vozColaLock_: () => ({ hasLock: () => false, waitLock() { if (candado) throw new Error('candado ocupado'); candado = true; }, releaseLock() { candado = false; } }),
    hojaCrear_: (nombre, cab) => (dec = dec || hoja(cab)),
    hojaWA_: () => hoja(),
    waCfg_: () => ({ token: 't', phoneId: 'p' }),
    uf_: (url, o) => { const b = JSON.parse(o.payload), id = 'wamid.' + (++n); avisos.push({ a: b.to, texto: b.interactive.body.text });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id }] }) }; },
    waEnviar_: (to, texto) => { avisos.push({ a: to, texto, solo: true }); return { ok: true }; },
    waVentana_: () => true, deTurno_: () => [{ telefono: TURNO, nombre: 'Ana' }, { telefono: JUAN, nombre: 'Juan' }], escalamiento_: () => [],
    adminPorTel_: () => null, adminsOp_: () => [], chatPrincipal_: () => null,
    claude_: (modelo) => { if (modelo !== 'redactor') return '{"caso": false}'; ia++; if (ctx._mientras) { const f = ctx._mientras; ctx._mientras = null; f(); } return ctx._sinOpciones ? '' : opsJson(ia); },
    hiloConv_: () => ({ code: 404 }),
    formatearMensaje_: t => t, limpiarSalida_: t => ({ texto: t }), estilo_: () => ''
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'decisiones.js'), 'utf8'), ctx);
  /* El chat con Alma tiene sus propios dobles: aquí solo se cuenta cuántas veces se avisa. */
  ctx.decisionAvisarChat_ = f => chat.push(f.id);
  return { ctx, avisos, chat, ia: () => ia, candado: () => candado };
}
const ALEJANDRA = { resId: 'res-304', huesped: 'Alejandra', propiedad: 'Z4 - EdificioA4 - 304', idioma: 'es', canal: 'hospitable',
  texto: 'Buen dia perdone tanta molestia habrá preguntado a su equipo si encontraron la biblia\nGracias' };
const filas = c => c.ctx.decFilas_().filas;
const porPersona = (avisos, wa) => avisos.filter(a => a.a === wa).length;

/* 1. Dos disparos de procesarCola a la vez sobre el mismo caso (el segundo corre mientras el primero espera a la IA). */
{ const c = caja();
  const r = c.ctx.decisionCrear_(ALEJANDRA, 'promesa', 'El equipo confirmará si encontraron la biblia');
  ok(r && r.id && !r.ya, 'el mensaje de Alejandra abre un caso');
  c.ctx._mientras = () => c.ctx.decisionesProcesar_();   // segundo disparo, en medio del primero
  c.ctx.decisionesProcesar_();
  ok(filas(c).length === 1, 'dos disparos: queda 1 caso (hay ' + filas(c).length + ')');
  ok(c.ia() === 1, 'dos disparos: la IA propone las opciones 1 vez (fueron ' + c.ia() + ')');
  ok(porPersona(c.avisos, JUAN) === 1, 'dos disparos: Juan recibe 1 aviso (recibió ' + porPersona(c.avisos, JUAN) + ')');
  ok(porPersona(c.avisos, TURNO) === 1, 'dos disparos: quien está de turno recibe 1 aviso (recibió ' + porPersona(c.avisos, TURNO) + ')');
  ok(c.chat.length === 1, 'dos disparos: el chat con Alma recibe 1 aviso (recibió ' + c.chat.length + ')');
  const f = filas(c)[0], ops = JSON.parse(f.opciones);
  ok(c.avisos.every(a => a.texto.indexOf(ops[0].titulo) >= 0), 'el aviso lleva las mismas opciones que guarda la hoja');
  ok(f.avisado && f.reserva, 'la hoja marca la reserva y cuándo se avisó');
  ok(!c.candado(), 'el candado queda suelto (la IA nunca corre con el candado puesto)');
  c.ctx.decisionesProcesar_();
  ok(c.ia() === 1 && c.avisos.length === 2, 'una tercera pasada no vuelve a avisar');

  /* 2. El mismo mensaje del huésped otra vez, con el caso ya resuelto: el mismo caso, sin aviso nuevo. */
  c.ctx.decGuardar_(c.ctx.hojaDec_(), filas(c)[0], { estado: 'enviada', enviado_ts: new Date().toISOString() });
  const r2 = c.ctx.decisionCrear_(Object.assign({}, ALEJANDRA), 'escalado', 'urgente');
  ok(r2 && r2.id === r.id && r2.ya && r2.mismo, 'el mismo mensaje procesado otra vez devuelve el mismo caso');
  ok(filas(c).length === 1, 'y no abre otro');
  c.ctx.decisionesProcesar_();
  ok(c.avisos.length === 2, 'y no manda otro aviso');

  /* 3. Un mensaje distinto, con el anterior resuelto: un caso nuevo con su aviso. */
  const r3 = c.ctx.decisionCrear_(Object.assign({}, ALEJANDRA, { texto: '¿Me la pueden mandar a la capital?' }), 'promesa', 'Confirmar el envío');
  ok(r3 && r3.id && r3.id !== r.id && !r3.ya, 'un mensaje distinto abre un caso nuevo');
  c.ctx.decisionesProcesar_();
  ok(porPersona(c.avisos, JUAN) === 2 && c.ia() === 2, 'y el caso nuevo se avisa una vez');

  /* 4. Con ese caso abierto, otro mensaje distinto no abre un tercero: una decisión viva por conversación. */
  const r4 = c.ctx.decisionCrear_(Object.assign({}, ALEJANDRA, { texto: 'Gracias, quedo atenta' }), 'seguimiento', 'Seguimiento');
  ok(r4 && r4.id === r3.id && r4.ya && !r4.mismo, 'con un caso abierto, un mensaje distinto usa el mismo caso');
}

/* 5. Una pasada se cae después de reservar: a los 5 minutos la siguiente la toma; sin opciones, se reintenta. */
{ const c = caja();
  c.ctx.decisionCrear_(ALEJANDRA, 'promesa', 'El equipo confirmará si encontraron la biblia');
  const f = filas(c)[0];
  c.ctx.decGuardar_(c.ctx.hojaDec_(), f, { reserva: 'rviejo@' + new Date(Date.now() - 60000).toISOString() });
  c.ctx.decisionesProcesar_();
  ok(c.ia() === 0 && c.avisos.length === 0, 'una reserva de hace 1 minuto es de otra pasada: no se toca');
  c.ctx.decGuardar_(c.ctx.hojaDec_(), filas(c)[0], { reserva: 'rviejo@' + new Date(Date.now() - 6 * 60000).toISOString() });
  c.ctx._sinOpciones = true;
  c.ctx.decisionesProcesar_();
  ok(c.ia() === 1 && c.avisos.length === 0 && Number(filas(c)[0].intentos) === 1 && !filas(c)[0].reserva, 'una reserva de hace 6 minutos se toma; sin opciones suma un intento y suelta la reserva');
  c.ctx._sinOpciones = false;
  c.ctx.decisionesProcesar_();
  ok(c.ia() === 2 && porPersona(c.avisos, JUAN) === 1, 'el reintento sale una vez');
}

/* 6. La clave: sin texto no hay clave; el id del mensaje manda sobre el texto. */
{ const c = caja();
  ok(c.ctx.decClave_('r', {}) === '', 'sin mensaje, sin clave');
  ok(c.ctx.decClave_('r', { texto: 'Hola  ' }) === c.ctx.decClave_('r', { texto: 'hola' }), 'el mismo texto (mayúsculas y espacios aparte) da la misma clave');
  ok(c.ctx.decClave_('r', { texto: 'hola', msgId: 'm1' }) === 'r|m1', 'el id del mensaje, si viene, es la clave');
}
process.exit(fallo);
