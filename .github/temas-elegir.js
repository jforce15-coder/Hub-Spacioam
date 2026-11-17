/* Prueba con dobles de cómo se elige el tema de un mensaje (apps-script/temas.js, #583 T2), sin Google, IA ni WhatsApp.
   16-nov-2026: Alma preguntó «¿Esto es para Juan pregunta cómo estamos con o para Estoy probando el modo?» al tocar el anillo
   «Cupos Google», y «pásame con Claudio» cayó en el tema de una huésped que esperaba «¿por la plataforma o por WhatsApp?»:
   el «sí» anterior se había terminado en segundo plano y el tema nunca supo que ya había salido. Revisa:
   1. el nombre: corto y legible, sin «Juan pregunta…», sin «cómo estamos con» ni un conector al final; la corrida única
      TEMAS_V2 renombra los temas y microproyectos viejos con la misma función y no se repite;
   2. el 16-nov: con «Cupos de Google» y «Estoy probando el modo» activos, «¿Cómo va «Cupos Google»?» va a su tema sin
      preguntar y sin llamar a Jev (por el nombre citado, el del microproyecto o el del anillo);
   3. con duda, Alma elige: solo pregunta con dos nombres legibles y distintos; una consulta pura no se pega a otro tema;
   4. «quiero hablar con Claudio» no cae en el tema de la huésped que espera el sí de un envío (sin Jev y con Jev dudoso);
      un acuse corto («sí», «por WhatsApp») sí va ahí;
   5. la secuencia: pregunta de canal → «sí» que se termina en segundo plano → «pásame con Claudio»: el hilo dice que ya salió,
      la espera se limpió y el mensaje nuevo no va a ese tema (nada que se vuelva a mandar);
   6. una frase de prueba o charla («Estoy probando el modo») no abre tema; un pedido con verbo sí.
   node .github/temas-elegir.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const COD = leer('Código.js'), MICRO = leer('microproyectos.js');
const AHORA0 = Date.parse('2026-11-16T18:00:00Z'), H = 3600000;
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true, tels: ['50255550000'], wa: '50255550000' };

function hoja(cab) {
  const filas = [cab.slice()];
  return {
    filas, getLastRow: () => filas.length, getLastColumn: () => cab.length, getMaxColumns: () => cab.length, insertColumnsAfter() {},
    appendRow: r => { filas.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
      getValue: () => { const row = filas[r - 1] || []; return row[c - 1] === undefined ? '' : row[c - 1]; },
      setValue: v => { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; },
      setValues: vs => vs.forEach((row, i) => { filas[r - 1 + i] = filas[r - 1 + i] || []; row.forEach((v, j) => { filas[r - 1 + i][c - 1 + j] = v; }); })
    })
  };
}
function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, hojas = {}, jevs = [], guion = (o.jev || []).slice();
  let ahora = AHORA0;
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const ctx = {
    console: { log() {}, warn() {}, error: (...a) => { if (o.ver) console.log('  (error) ' + a.join(' ')); } }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, Error, isNaN, encodeURIComponent,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    hojaCrear_: (n, cab) => (hojas[n] = hojas[n] || hoja(cab)),
    uf_: (url, op) => {
      if (!/typesafe\.ai/.test(url)) throw new Error('internet inesperado: ' + url);
      const cuerpo = JSON.parse(op.payload); jevs.push(cuerpo);
      const x = guion.length ? guion.shift() : { choice: 'nuevo', confianza: 0.95 };
      const ch = typeof x.choice === 'function' ? x.choice(cuerpo) : x.choice;
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ model: 'jev', answers: { tema: { type: 'choice', choice: ch, confidence: x.confianza } }, usage: {} }) };
    },
    registrarUso_: () => {}, adminsOp_: () => [JUAN], adminPorTel_: () => null, adminPorEmail_: e => (e === JUAN.email ? JUAN : null),
    chatPrincipal_: () => JUAN, esAdminPrincipal_: a => !!(a && a.principal), relevoCitado_: () => null, socioSeguro_: () => null,
    propNombre_: p => String(p || ''), claudeNivel_: x => x || 'complejo'
  };
  vm.createContext(ctx);
  vm.runInContext(['s_', 'celdaTexto_', 'normTel_', 'telsEnTexto_'].map(n => sacar(COD, n)).join('\n') + '\nvar fin8_ = x => String(x || "").replace(/\\D/g, "").slice(-8);\n' +
    sacar(leer('contacto.js'), 'esAcuseCorto_') + '\n' + /var MICRO_CAB_ = [^\n]*/.exec(MICRO)[0] + '\n' + /var MICRO_ESTADOS_ = [^\n]*/.exec(MICRO)[0] + '\n' +
    ['microHoja_', 'microDe_', 'microFilas_', 'microNombre_'].map(n => sacar(MICRO, n)).join('\n'), ctx, { filename: 'extractos' });
  ['sociosmi.js', 'rapido.js', 'orbita.js', 'episnap.js', 'temas.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  const reloj = ms => { ahora += ms; };
  /* Un turno como opAgente_ + chatTurnoCerrar_, sin IA: elige el tema, «Alma» responde y se cierra el turno. */
  const turno = (texto, resp, x) => {
    x = x || {}; ctx.TEMA_PISTA_ = x.pista || null;
    const sel = ctx.temaTurno_(JUAN, texto, x.canal || 'app');
    const bloque = ctx.temaBloque_(JUAN, sel);
    if (sel.pregunta) { reloj(60000); return { sel, bloque, pregunta: sel.pregunta, tema: '' }; }
    const tg = ctx.temaSacarEtiqueta_(resp || 'Listo.');
    const tema = ctx.temaCerrarTurno_(JUAN, texto, tg.texto, { respuesta: tg.texto, hechas: x.hechas || [], tema: tg.tag });
    ctx.TEMA_ACT_ = null; reloj(x.paso || 60000);
    return { sel, bloque, tema, texto: tg.texto };
  };
  /* Una fila como las de antes (el título viejo, tal cual quedó en la hoja). */
  const temaViejo = (id, titulo, x) => { x = x || {}; const t = Object.assign({ id, creado: ahora - (x.hace || H), actualizado: ahora - (x.hace || H), admin: JUAN.email, titulo, tipo: x.tipo || 'pedido', apartamento: x.apartamento || '', personas: [], estado: 'abierto', ultimo_paso: x.paso || '', espera: x.espera || '', origen: x.origen || 'chat', origen_id: x.origen_id || '', resultado: '', cerrado: '', msgs: '', hilo: x.hilo || [], fila: 0 }); ctx.TEMA_MEMO_ = null; ctx.temaGuardar_(t); ctx.TEMA_MEMO_ = null; return id; };
  return { X: ctx, props, cache, hojas, jevs, reloj, turno, temaViejo, tema: id => { ctx.TEMA_MEMO_ = null; return ctx.temaLeer_(id); }, temas: () => { ctx.TEMA_MEMO_ = null; return ctx.temaFilas_(); } };
}

/* 1 · Nombres cortos y legibles, y la corrida única TEMAS_V2. */
{ const { X } = caja();
  const casos = [['Juan pregunta cómo estamos con los cupos de Google', 'Cupos de Google'], ['El usuario solicita que se desconecte o o para', 'Se desconecte'],
    ['¿Cómo va «Cupos Google»? Cuéntame qué pasó, qué has hecho y en qué estado está.', 'Cupos Google'], ['Alma, por favor revisa los pagos de Amalfi de octubre', 'Revisa los pagos de Amalfi'],
    ['Escríbele al socio de Narama 633 que el lunes entra el técnico', 'Escríbele al socio de Narama 633'], ['Narama 633 · socio', 'Narama 633 · socio']];
  casos.forEach(([a, b]) => ok(X.temaTitulo_(a) === b, '1 · «' + a + '» → «' + X.temaTitulo_(a) + '»'));
  ok(X.microNombre_('Juan pregunta cómo estamos con los cupos de Google') === 'Cupos de Google' && X.microNombre_('') === 'Pedido para Claudio', '1 · el microproyecto usa la misma limpieza');
  ok(!X.temaLegible_('Juan pregunta cómo estamos con') && !X.temaLegible_('Pedido') && !X.temaLegible_('Cupos') && X.temaLegible_('Cupos de Google') && X.temaLegible_('Estoy probando el modo'), '1 · legible: 2 palabras o más, sin conector al final ni «Juan pregunta…»');
  ok(X.temaLegible_('Narama 623') && !X.temaSePuedePreguntar_([{ apartamento: 'Ignacio 1102, Ignacio 1104, Mónaco B2' }, { apartamento: 'Narama 623' }]) && X.temaSePuedePreguntar_([{ apartamento: 'Narama 633' }, { apartamento: 'Monaco D4' }]), '1 · un nombre que ya es una lista no se usa para preguntar «¿A o B?» (16-nov: la pregunta salió con cuatro opciones); con dos nombres simples sí');
  ok(X.temaTitulo_('Juan pregunta cómo estamos con') === 'Pedido', '1 · sin nada que nombrar queda «Pedido» (y TEMAS_V2 busca otro origen)');
}
{ const c = caja(), X = c.X;
  const t69 = c.temaViejo('tm69', 'Juan pregunta cómo estamos con', { tipo: 'pedido', origen: 'chat' });
  c.temaViejo('tm70', 'Estoy probando el modo');
  const t71 = c.temaViejo('tm71', 'Juan pide que se desconecte o', { hilo: [{ d: 'yo', t: 'Desconecta el aviso de limpieza de los domingos', ts: 1 }] });
  const t72 = c.temaViejo('tm72', 'Narama 633 · socio', { tipo: 'socio', apartamento: 'Narama 633' });
  X.microHoja_().appendRow(['mpcupos1', 'Juan pregunta cómo estamos con', 'en trabajo', AHORA0 - H, AHORA0 - H, JUAN.email, '', '', '', '', JSON.stringify([{ ts: AHORA0 - H, de: 'juan', texto: 'Juan pregunta cómo estamos con los cupos de Google' }]), '', '[]', 1, '', 'complejo', t69]);
  X.microHoja_().appendRow(['mpuber1', 'Uber con Alma', 'en trabajo', AHORA0 - H, AHORA0 - H, JUAN.email, '', '', '', '', '[]', '', '[]', 1, '', 'complejo', '']);
  const r = X.temasRenombrar_();
  const micros = X.microFilas_();
  ok(r.hecho && c.tema(t69).titulo === 'Cupos de Google' && micros[0].nombre === 'Cupos de Google', '1 · TEMAS_V2: el tema y su microproyecto se llaman igual: «' + c.tema(t69).titulo + '» / «' + micros[0].nombre + '»');
  ok(c.tema(t71).titulo !== 'Juan pide que se desconecte o' && X.temaLegible_(c.tema(t71).titulo), '1 · TEMAS_V2: «Juan pide que se desconecte o» → «' + c.tema(t71).titulo + '»');
  ok(c.tema('tm70').titulo === 'Estoy probando el modo' && c.tema(t72).titulo === 'Narama 633 · socio' && micros[1].nombre === 'Uber con Alma', '1 · lo que ya se leía bien no cambia');
  const filasAntes = JSON.stringify(c.hojas.ALMA_TEMAS.filas), r2 = X.temasRenombrar_();
  ok(r2.hecho && r2.temas === 0 && JSON.stringify(c.hojas.ALMA_TEMAS.filas) === filasAntes && /renombrados/.test(c.props.TEMAS_V2), '1 · TEMAS_V2 corre una sola vez');
  ok(/cupoFuncion_\('temasRenombrar_'\); try \{ temasRenombrar_\(\)/.test(COD), '1 · procesarCola la llama, con su nombre');
}

/* 2 · El 16-nov: «¿Cómo va «Cupos Google»?» con dos temas activos. */
{ const armar = (jev, sinMigrar) => {
    const c = caja({ jev, props: { JEV_KEY: 'llave-jev' } }), X = c.X;
    c.temaViejo('tm69', 'Juan pregunta cómo estamos con', { hace: 2 * H });
    c.temaViejo('tm70', 'Estoy probando el modo', { hace: H / 2 });
    X.microHoja_().appendRow(['mpcupos1', 'Juan pregunta cómo estamos con', 'en trabajo', AHORA0 - H, AHORA0 - H, JUAN.email, '', '', '', '', JSON.stringify([{ ts: AHORA0 - H, de: 'juan', texto: 'Juan pregunta cómo estamos con los cupos de Google' }]), '', '[]', 1, '', 'complejo', 'tm69']);
    if (!sinMigrar) X.temasRenombrar_();
    return c;
  };
  const pref = (cu, n) => Object.keys(cu.questions.tema.criteria).find(k => cu.questions.tema.criteria[k].indexOf(n) >= 0);
  { const c = armar([{ choice: cu => pref(cu, 'probando'), confianza: 0.55 }]);
    const r = c.turno('¿Cómo va «Cupos Google»? Cuéntame qué pasó, qué has hecho y en qué estado está.', 'Va en 62 %.');
    ok(!r.pregunta && r.sel.id === 'tm69' && r.sel.por === 'nombre' && c.jevs.length === 0, '2 · va al tema de los cupos por su nombre, sin preguntar y sin Jev (' + (r.pregunta || r.sel.por) + ')'); }
  { const c = armar([{ choice: cu => pref(cu, 'probando'), confianza: 0.55 }], true);   // sin TEMAS_V2: el nombre del anillo como otro nombre
    c.X.temaAliasSumar_('tm69', 'Cupos Google');
    const r = c.turno('¿Cómo va «Cupos Google»?', 'Va en 62 %.');
    ok(!r.pregunta && r.sel.id === 'tm69', '2 · el nombre que se ve en el anillo también lo encuentra'); }
  { const c = armar([{ choice: cu => pref(cu, 'probando'), confianza: 0.55 }], true);
    c.X.microHoja_().filas[1][1] = 'Cupos Google';   // el microproyecto ya tiene el nombre del anillo
    const r = c.turno('¿Cómo vamos con los cupos de Google?', 'Va en 62 %.');
    ok(!r.pregunta && r.sel.id === 'tm69', '2 · y el del microproyecto'); }
  { const c = armar([{ choice: cu => pref(cu, 'probando'), confianza: 0.55 }], true);
    const r = c.turno('Y eso, súbelo cuando puedas al otro lado', 'Listo.');
    ok(!r.pregunta && r.sel.id === 'tm70' && r.sel.por === 'jev', '2 · con duda y un nombre que no se lee («Juan pregunta cómo estamos con») no pregunta: va con lo que eligió Jev'); }
}

/* 3 · Con duda, Alma elige. */
{ const pref = (cu, n) => Object.keys(cu.questions.tema.criteria).find(k => cu.questions.tema.criteria[k].indexOf(n) >= 0);
  const armar = jev => {
    const c = caja({ jev, props: { JEV_KEY: 'llave-jev' } });
    c.temaViejo('tma', 'Narama 633 · socio', { tipo: 'socio', apartamento: 'Narama 633', hace: H });
    c.temaViejo('tmb', 'Huésped de Monaco D4', { tipo: 'huesped', apartamento: 'Monaco D4', hace: H / 2 });
    return c;
  };
  { const c = armar([{ choice: cu => pref(cu, 'Narama'), confianza: 0.55 }]);
    const r = c.turno('dile que sí, que puede ir el martes', 'NO');
    ok(r.pregunta === '¿Esto es para el socio de Narama 633 o para el huésped de Monaco D4?', '3 · dos nombres legibles y distintos: sí pregunta («' + r.pregunta + '»)'); }
  { const c = armar([{ choice: cu => pref(cu, 'Narama'), confianza: 0.5 }]);
    const r = c.turno('¿Quién llega hoy a los apartamentos?', 'Llegan dos.');
    ok(!r.pregunta && !r.sel.id && !r.tema, '3 · una consulta pura con duda: sin tema y sin preguntar'); }
  { const c = armar([]);
    const r = c.turno('¿Quién llega hoy a los apartamentos?', 'Llegan dos.');
    ok(!r.pregunta && !r.sel.id, '3 · y sin Jev, tampoco se pega al más reciente'); }
}

/* 4 · «quiero hablar con Claudio» no cae en el tema de la huésped que espera el sí de un envío. */
{ const armar = (jev, props) => {
    const c = caja({ jev, props });
    const r = c.turno('Escríbele a la huésped de Monaco D4 que el check-in es a las 3', 'Listo el borrador para la huésped. ¿Se lo mando por la plataforma o por WhatsApp? [[tema: nuevo · Huésped de Monaco D4]]');
    const t = c.tema(r.tema); t.tipo = 'huesped'; t.apartamento = 'Monaco D4'; c.X.temaGuardar_(t);
    return { c, h: r.tema };
  };
  { const { c, h } = armar();
    ok(c.tema(h).espera === 'respuesta' && c.X.temaEsperaEnvio_(c.tema(h)), '4 · el tema de la huésped espera el sí del envío (no un número: «por WhatsApp» no es «su WhatsApp»)');
    const r = c.turno('quiero hablar con Claudio', 'Claro.');
    ok(r.sel.id !== h && !r.pregunta, '4 · sin Jev: «quiero hablar con Claudio» no va al tema de la huésped (' + (r.sel.por || 'sin tema') + ')'); }
  { const { c, h } = armar([{ choice: cu => Object.keys(cu.questions.tema.criteria).find(k => /Monaco/.test(cu.questions.tema.criteria[k])), confianza: 0.6 }], { JEV_KEY: 'k' });
    const r = c.turno('pásame con Claudio', 'Claro.');
    ok(r.sel.id !== h, '4 · con Jev dudoso (60 %) por la huésped: tampoco'); }
  { const { c, h } = armar();
    const r = c.turno('por WhatsApp', 'Listo, se lo mandé por WhatsApp.');
    ok(r.sel.id === h && r.sel.por === 'reciente', '4 · un acuse corto («por WhatsApp») sí va a ese tema'); }
  { const { c, h } = armar();
    ok(c.turno('sí', 'Listo.').sel.id === h, '4 · «sí» también'); }
}

/* 5 · La secuencia del 16-nov: pregunta de canal → «sí» en segundo plano → «pásame con Claudio». */
{ const c = caja(), X = c.X;
  const r1 = c.turno('Escríbele a la huésped de Monaco D4 que el check-in es a las 3', 'Listo el borrador. ¿Se lo mando por la plataforma o por WhatsApp? [[tema: nuevo · Huésped de Monaco D4]]');
  const h = r1.tema;
  /* «sí, por WhatsApp» y el agente se va a segundo plano (opProcesar_ con seguira): vozSeguirGuardar_ toma el tema del turno
     y opProcesar_ cierra el turno en ese tema antes de devolver. */
  X.TEMA_PISTA_ = null; const sel = X.temaTurno_(JUAN, 'sí, por WhatsApp', 'calle');
  const temaGuardado = X.temaActualId_({ email: JUAN.email });
  const tmS = X.temaCerrarTurno_(JUAN, 'sí, por WhatsApp', 'Esto toma un rato: lo sigo trabajando en segundo plano y te aviso cuando esté.', { hechas: [] }); X.TEMA_ACT_ = null;
  ok(sel.id === h && temaGuardado === h && tmS === h && c.tema(h).espera === '', '5 · el «sí» va al tema, el segundo plano guarda ese tema y la espera se limpia al irse por detrás');
  c.reloj(90000);
  /* vozSeguirPronto termina: el mensaje salió. */
  X.temaSumarResultado_(JUAN, h, { respuesta: 'Listo, le mandé a la huésped que el check-in es a las 3.', hechas: [{ tipo: 'mensaje', resumen: 'WhatsApp a la huésped de Monaco D4', tel: '50255550909', nombre: 'Huésped' }] });
  const t = c.tema(h), hilo = X.temaHilo_(t);
  ok(/^Ya salió: WhatsApp a la huésped/.test(hilo[hilo.length - 1].t) && /^Ya salió/.test(t.ultimo_paso) && t.espera === '' && t.personas.some(p => p.t === '50255550909'), '5 · el hilo dice que ya salió («' + hilo[hilo.length - 1].t.slice(0, 50) + '…») y ya no espera nada');
  const r3 = c.turno('pásame con Claudio', 'Claro.');
  const ultAlma = (/HILO DE ESE TEMA:\n([\s\S]*)$/.exec(r3.bloque) || ['', ''])[1].split('\n').filter(l => /^ALMA: /.test(l)).pop() || '';
  ok(r3.sel.id !== h || (/^ALMA: Ya salió/.test(ultAlma) && c.tema(h).espera === ''), '5 · «pásame con Claudio»: si cae en ese tema, lo último que Alma ve es «Ya salió» y nada espera el sí: no hay segundo envío');
  ok(/último: Ya salió/.test(r3.bloque), '5 · en la lista de temas Alma ve que ya salió');
  /* El código real hace lo mismo. */
  const seg = /if \(ag && ag\.seguira\) \{[\s\S]*?return \{ ok: true, yo: yo, alma: sigue, seguira: true \};/.exec(COD);
  ok(seg && /temaCerrarTurno_\(adm, texto, txtSigue/.test(seg[0]) && /TEMA_ACT_ = null/.test(seg[0]), '5 · opProcesar_ (rama seguira) cierra el turno en su tema antes de devolver');
  const ret = leer('retomar.js');
  ok(/o\.tema = temaActualId_\(\{ email: o\.email \}\)/.test(sacar(ret, 'vozSeguirGuardar_')) && /temaSumarResultado_\(adm, o\.tema, r\)/.test(sacar(ret, 'vozSeguirPronto')) && /orbitaEmpieza_\(o\.email, o\.pedido, 'segundo_plano', '', o\.orb, o\.tema\)/.test(ret),
    '5 · vozSeguirGuardar_ guarda el tema y vozSeguirPronto le suma lo que salió');
}

/* 6 · Una frase de prueba no abre tema. */
{ const c = caja();
  const r = c.turno('Estoy probando el modo', 'Te escucho.');
  ok(!r.tema && c.temas().length === 0, '6 · «Estoy probando el modo» no abre tema');
  ok(c.X.temaEsPedido_('Llama a Brunelo') && c.X.temaEsPedido_('Recuérdame comprar café para la oficina') && !c.X.temaEsPedido_('quiero hablar con Claudio') && !c.X.temaEsPedido_('hola, buenos días'), '6 · un verbo de acción o 5 palabras sí es pedido; charla y saludos no');
  const r2 = c.turno('Recuérdame comprar café para la oficina', 'Listo. [[tema: nuevo · Café para la oficina]]');
  ok(r2.tema && c.tema(r2.tema).titulo === 'Café para la oficina', '6 · un pedido sí abre su tema');
}

process.exit(fallo);
