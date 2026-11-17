/* Prueba con dobles de los temas (apps-script/temas.js, issue #526), sin Google, IA, WhatsApp ni GitHub. 14-nov-2026: con
   Juan, Alma lleva muchas cosas a la vez; el 13-nov el pedido de Narama 633 quedó enterrado bajo 31 mensajes de otros temas
   y los números que Juan mandó por WhatsApp, sin citar, se trataron como de otro tema. Revisa:
   1. el caso del 13-nov: pedido por voz, 31 mensajes de otros temas, números por WhatsApp sin cita → el tema del socio, y
      Alma ve el hilo de ese tema aunque ya no esté en los últimos turnos;
   2. una cita (un mensaje de Alma en ese tema, o un relevo) fija el tema sin IA;
   3. el nombre de un apartamento fija el tema (Rue 301 gana sobre Ignacio 301 si dice «Rue»);
   4. Jev alto elige; Jev bajo con dos temas activos → Alma pregunta («¿Esto es para … o para …?») sin IA, y la respuesta
      lleva el pedido original al tema elegido; sin Jev, el tema activo más reciente;
   5. la etiqueta «📍 tema:» solo al administrador, solo con más de un tema vivo, de 28 letras como mucho, desde waEnviar_;
   6. un tema se cierra solo con su resultado: sin resultado no cierra, una llamada no cierra, «listo: …» sí;
   7. el pedido de un socio que compromete fechas, costos o cambios: un tema con su apartamento, una sola tarjeta en
      Pendientes, la respuesta de Juan va a ese tema y lo cierra el resultado (responder la tarjeta no);
   8. el aviso de GitHub: sin llave en el Hub o con otra no hace nada; con la llave procesa el issue al momento; el respaldo
      pasa a 30 min solo con la llave; el workflow no hace nada sin el secreto y nunca imprime la llave;
   9. la corrida única TEMAS_V1 liga los encargos, microproyectos y tarjetas abiertos, y no se repite.
   node .github/temas.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const COD = leer('Código.js'), AGE = leer('agente.js');
const H = 3600000, AHORA0 = Date.parse('2026-11-14T15:00:00Z');
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true, tels: ['50255550000'], wa: '50255550000' };
const SOCIO_TEL = '50255550101';

/* Una hoja de mentira. */
function hoja(cab) {
  const filas = [cab.slice()];
  let maxCol = cab.length;
  const sh = {
    filas, getLastRow: () => filas.length, getLastColumn: () => Math.max.apply(null, filas.map(r => r.length)), getMaxColumns: () => maxCol,
    insertColumnsAfter: (c, n) => { maxCol += n; }, appendRow: r => { filas.push(r.slice()); maxCol = Math.max(maxCol, r.length); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
      getValue: () => { const row = filas[r - 1] || []; return row[c - 1] === undefined ? '' : row[c - 1]; },
      setValue: v => { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; },
      setValues: vs => vs.forEach((row, i) => { filas[r - 1 + i] = filas[r - 1 + i] || []; row.forEach((v, j) => { filas[r - 1 + i][c - 1 + j] = v; }); })
    })
  };
  return sh;
}

function caja(o) {
  o = o || {};
  const props = Object.assign({ WA_TOKEN: 'tok', WA_PHONE_ID: 'ph' }, o.props || {}), cache = {}, hojas = {}, jevs = [], jevGuion = (o.jev || []).slice(), tarjetas = [], wa = [], gh = [], uno = [];
  let ahora = o.ahora || AHORA0;
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const admins = [JUAN, { email: 'ana@ejemplo.com', nombre: 'Ana', principal: false, tels: ['50255550002'] }];
  const ctx = {
    console: { log() {}, warn() {}, error: (...a) => { if (o.verErrores) console.log('  (error) ' + a.join(' ')); } }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, Error, isNaN, encodeURIComponent,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => new Date(d).toISOString() },
    hojaCrear_: (n, cab) => (hojas[n] = hojas[n] || hoja(cab)),
    uf_: (url, op) => {
      if (/typesafe\.ai/.test(url)) {
        const cuerpo = JSON.parse(op.payload); jevs.push(cuerpo);
        const x = jevGuion.length ? jevGuion.shift() : { choice: 'nuevo', confianza: 0.95 };
        const ch = typeof x.choice === 'function' ? x.choice(cuerpo) : x.choice;
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ model: 'jev-1.13.0', answers: { tema: { type: 'choice', choice: ch, confidence: x.confianza } }, usage: {} }) };
      }
      if (/api\.github\.com/.test(url)) { gh.push(url); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(o.issue || {}) }; }
      if (/graph\.facebook\.com/.test(url)) { const b = JSON.parse(op.payload); wa.push({ to: b.to, texto: b.text.body }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ messages: [{ id: 'wamid.' + (wa.length) }] }) }; }
      throw new Error('internet inesperado: ' + url);
    },
    registrarUso_: () => {},
    adminsOp_: () => admins,
    adminPorTel_: w => admins.find(a => a.tels.some(t => t.slice(-8) === String(w).replace(/\D/g, '').slice(-8))) || null,
    adminPorEmail_: e => admins.find(a => a.email === e) || null,
    chatPrincipal_: () => JUAN, esAdminPrincipal_: a => !!(a && a.principal),
    relevoCitado_: id => (o.relevos || {})[id] || null,
    socioSeguro_: w => String(w).slice(-8) === SOCIO_TEL.slice(-8) ? { wa: SOCIO_TEL, nombre: 'Socio Prueba', propiedad: 'Z13 - Narama - 633' } : null,
    pendAvisar_: (adm, texto, x) => { tarjetas.push({ adm, texto, x, estado: 'abierto', id: 'pd' + tarjetas.length, tema_id: x.tema, titulo: x.clasif && x.clasif.titulo }); return true; },
    pendFilas_: () => tarjetas.map(t => ({ id: t.id, tema_id: t.tema_id, estado: t.estado, titulo: t.titulo, tipo: 'atencion', email: JUAN.email, ts: ahora })),
    propNombre_: p => String((p && (p.nombre || p.name)) || p || ''),
    acortarEnTexto_: t => t, waVentana_: () => true, waRetomar_: () => ({ ok: false }), waUltimoGuardar_: () => {},
    cupoAhorro_: () => props.CUPO_AHORRO !== '0'
  };
  vm.createContext(ctx);
  vm.runInContext(['s_', 'celdaTexto_', 'normTel_', 'telsEnTexto_', 'waEnviar_', 'hojaWA_'].map(n => sacar(COD, n)).join('\n') +
    '\nvar fin8_ = x => String(x || "").replace(/\\D/g, "").slice(-8);\n' + /const WA_CAB_ = [^\n]*/.exec(COD)[0].replace('const', 'var') + '\nvar WA_OK_ = false;\n' +
    sacar(leer('contacto.js'), 'esAcuseCorto_') + sacar(leer('pendientes.js'), 'tituloCorto_'), ctx, { filename: 'extractos' });
  ['sociosmi.js', 'rapido.js', 'paraalma.js', 'orbita.js', 'episnap.js', 'temas.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  /* El paso de una instrucción (paraalma.js) queda de mentira: aquí se prueba que el aviso llegue a él. */
  if (o.unoDeMentira) ctx.paraAlmaUno_ = (i) => { uno.push(i.number); return 1; };
  const reloj = ms => { ahora += ms; };
  /* Un turno completo sin IA: elige el tema, «Alma» responde y se cierra el turno como en chatTurnoCerrar_. */
  const turno = (texto, resp, x) => {
    x = x || {};
    ctx.TEMA_PISTA_ = x.pista || null;
    const sel = ctx.temaTurno_(JUAN, texto, x.canal || 'whatsapp');
    const bloque = ctx.temaBloque_(JUAN, sel);
    if (sel.pregunta) return { sel, bloque, pregunta: sel.pregunta, tema: '' };
    const tg = ctx.temaSacarEtiqueta_(resp || 'Listo.');
    const tema = ctx.temaCerrarTurno_(JUAN, texto, tg.texto, { respuesta: tg.texto, hechas: x.hechas || [], tema: tg.tag });
    reloj(x.paso || 60000);
    return { sel, bloque, tema, texto: tg.texto };
  };
  return { X: ctx, props, cache, hojas, jevs, tarjetas, wa, gh, uno, reloj, turno, temas: () => ctx.temaFilas_ ? (ctx.TEMA_MEMO_ = null, ctx.temaFilas_()) : [] };
}
const tema = (c, id) => { c.X.TEMA_MEMO_ = null; return c.X.temaLeer_(id); };

/* 1 · El caso del 13-nov. */
{ const c = caja();
  const t1 = c.turno('Escríbele al socio de Narama 633 que el lunes entra el técnico al aire acondicionado', 'No tengo su número. ¿Me pasas el número del socio de Narama 633? [[tema: nuevo · Narama 633 · socio]]', { canal: 'llamada' });
  const narama = tema(c, t1.tema);
  ok(narama && /Narama 633/.test(narama.titulo) && narama.espera === 'numero', '1 · el pedido por voz abre su tema («' + (narama && narama.titulo) + '») y queda esperando un número');
  /* 31 mensajes de otros temas (un huésped de Rue 301, un formulario, una compra), por WhatsApp y el Hub. */
  const rue = c.turno('¿Qué le contesto al huésped de Rue 301 que pregunta por el parqueo?', 'Le diría que el parqueo es el 2. [[tema: nuevo · Huésped de Rue 301]]');
  const form = c.turno('Revisa si ya llenaron el formulario de registro de la reserva de mañana', 'Todavía no lo llenan. [[tema: nuevo · Formulario de registro]]');
  const otros = [rue.tema, form.tema];
  for (let i = 0; i < 29; i++) c.turno(i % 2 ? 'Y del huésped de Rue 301, ¿ya contestó lo del parqueo?' : 'Sigue lo del formulario de registro, ¿ya llegó?', 'Sigo en eso. [[tema: ' + otros[i % 2] + ']]', { pista: { tema: otros[i % 2], por: 'tarjeta' } });
  const n = c.hojas.ALMA_TEMAS.filas.length - 1;
  const r = c.turno('+502 5555 0101', 'Listo, le escribí al socio de Narama 633. [[tema: ' + t1.tema + ']]', { hechas: [{ tipo: 'mensaje', tel: SOCIO_TEL, nombre: 'Socio Prueba', propiedad: 'Narama 633' }] });
  ok(r.sel.id === t1.tema && r.sel.por === 'numero', '1 · 31 mensajes después, los números por WhatsApp sin cita van al tema del socio (' + r.sel.por + ')');
  ok(/HILO DE ESE TEMA:[\s\S]*Narama 633 que el lunes entra el técnico/.test(r.bloque) && /\[[^\]]+\] Narama 633/.test(r.bloque), '1 · Alma ve los temas abiertos y el hilo del pedido original, aunque ya no esté en los últimos turnos');
  ok(c.hojas.ALMA_TEMAS.filas.length - 1 === n && n === 3, '1 · no se abrió otro tema por los números (' + n + ' temas)');
  ok(tema(c, t1.tema).personas.some(p => p.t === SOCIO_TEL) && tema(c, t1.tema).espera === '', '1 · el tema guarda a quién se le escribió y ya no espera número');
  ok(c.jevs.length === 0, '1 · sin JEV_KEY no se llamó a Jev');
}

/* 2 · Cita. */
{ const c = caja();
  const a = c.turno('Escríbele al socio de Narama 633 que el lunes entra el técnico', 'Listo. [[tema: nuevo · Narama 633 · socio]]');
  const b = c.turno('Pregúntale al huésped de Rue 301 a qué hora llega', 'Listo. [[tema: nuevo · Huésped de Rue 301]]');
  const env = c.X.waEnviar_(JUAN.wa, 'Le escribí al socio; te aviso cuando conteste.', { tema: a.tema });
  ok(env.ok && tema(c, a.tema).msgs.indexOf(env.id) >= 0, '2 · lo que Alma manda en un tema guarda el id de Meta');
  c.X.TEMA_MEMO_ = null;
  ok(c.X.temaPorMsg_(env.id, JUAN.email) === a.tema, '2 · citar ese mensaje da su tema');
  const r = c.turno('sí, dile eso', 'Listo.', { pista: { tema: c.X.temaPorMsg_(env.id, JUAN.email), por: 'cita' } });
  ok(r.sel.id === a.tema && r.sel.por === 'cita', '2 · el mensaje que cita va a ese tema aunque el último activo sea otro');
  const r2 = c.turno('ok, gracias', 'Claro. [[tema: ' + b.tema + ']]', { pista: { tema: a.tema, por: 'cita' } });
  ok(r2.tema === a.tema, '2 · con cita gana el código aunque Alma marque otro tema');
  /* Un relevo citado («X respondió: …») lleva al tema con esa persona. */
  c.X.temaCerrarTurno_; const t = tema(c, b.tema); c.X.temaPersonaSumar_(t, 'Huésped', '50255550909'); c.X.temaGuardar_(t);
  const c2 = Object.assign(c, {}); c.X.relevoCitado_ = id => id === 'wamid.relevo' ? { wa: '50255550909' } : null; c.X.TEMA_MEMO_ = null;
  ok(c.X.temaPorMsg_('wamid.relevo', JUAN.email) === b.tema, '2 · citar un relevo de contacto da el tema con esa persona');
}

/* 3 · Nombre de apartamento. */
{ const c = caja();
  const rue = c.turno('El huésped de Rue 301 pide factura', 'Le pedí el NIT. [[tema: nuevo · Huésped de Rue 301]]');
  const t = tema(c, rue.tema); t.apartamento = 'Z4 - Rue - 301'; t.tipo = 'huesped'; c.X.temaGuardar_(t);
  const ign = c.turno('En Ignacio 301 falta una toalla', 'Anotado. [[tema: nuevo · Ignacio 301]]');
  const ti = tema(c, ign.tema); ti.apartamento = 'Ignacio 301'; c.X.temaGuardar_(ti);
  const nar = c.turno('Lo de Narama 633 sigue pendiente', 'Sí. [[tema: nuevo · Narama 633]]');
  const tn = tema(c, nar.tema); tn.apartamento = 'Narama 633'; c.X.temaGuardar_(tn);
  const r = c.turno('¿Y lo de Rue 301?', 'Ya mandó el NIT.');
  ok(r.sel.id === rue.tema && r.sel.por === 'nombre', '3 · nombrar «Rue 301» fija su tema (Rue 301 gana sobre Ignacio 301)');
  const r2 = c.turno('¿Qué pasó con el 633?', 'Sigue pendiente.');
  ok(r2.sel.id === nar.tema && r2.sel.por === 'nombre', '3 · «el 633» fija el tema de Narama 633');
  const r3 = c.turno('¿Y lo del 301?', '');
  ok(!!r3.pregunta && /Rue 301/.test(r3.pregunta) && /Ignacio 301/.test(r3.pregunta), '3 · «el 301» nombra dos temas: Alma pregunta («' + r3.pregunta + '»)');
}

/* 4 · Jev alto, Jev bajo y la pregunta. */
{ const pref = (cuerpo, nombre) => Object.keys(cuerpo.questions.tema.criteria).find(k => cuerpo.questions.tema.criteria[k].indexOf(nombre) >= 0);
  const armar = (jev) => {
    const c = caja({ jev });
    const a = c.turno('Escríbele al socio de Narama 633 que el lunes entra el técnico', 'Listo. [[tema: nuevo · Narama 633 · socio]]');
    const ta = tema(c, a.tema); ta.apartamento = 'Narama 633'; ta.tipo = 'socio'; c.X.temaGuardar_(ta);
    const b = c.turno('Al huésped de Monaco D4 dile que el check-in es a las 3', 'Listo. [[tema: nuevo · Huésped de Monaco D4]]');
    const tb = tema(c, b.tema); tb.apartamento = 'Monaco D4'; tb.tipo = 'huesped'; c.X.temaGuardar_(tb);
    c.props.JEV_KEY = 'llave-jev';   // Jev desde aquí: lo de antes solo arma los dos temas
    return { c, a: a.tema, b: b.tema };
  };
  { const { c, a } = armar([{ choice: cu => pref(cu, 'Narama'), confianza: 0.93 }]);
    const r = c.turno('dile que sí, que puede ir el martes', 'Listo.');
    ok(r.sel.id === a && r.sel.por === 'jev' && c.jevs.length === 1, '4 · Jev con 93 % elige el tema del socio');
    const q = c.jevs[0].questions.tema;
    ok(q.type === 'choice' && Object.keys(q.criteria).length === 3 && q.criteria.nuevo && JSON.stringify(c.jevs[0]).indexOf('5555') < 0, '4 · a Jev van los temas vivos + «nuevo», sin teléfonos'); }
  { const { c } = armar([{ choice: 'nuevo', confianza: 0.95 }]);
    const r = c.turno('Recuérdame comprar café para la oficina', 'Listo. [[tema: nuevo · Café para la oficina]]');
    ok(r.sel.por === 'nuevo' && r.sel.jev && r.sel.jev.choice === 'nuevo' && tema(c, r.tema) && /Café/.test(tema(c, r.tema).titulo), '4 · Jev dice «nuevo» con confianza: abre otro tema'); }
  { const { c, a } = armar([{ choice: cu => pref(cu, 'Narama'), confianza: 0.55 }]);
    const r = c.turno('dile que sí, que puede ir el martes', 'NO DEBE LLAMARSE');
    ok(r.pregunta === '¿Esto es para el socio de Narama 633 o para el huésped de Monaco D4?', '4 · Jev con 55 % y dos temas activos: Alma pregunta («' + r.pregunta + '»)');
    const r2 = c.turno('el de Narama', 'Listo, le dije al socio de Narama 633 que sí el martes.');
    ok(r2.sel.id === a && r2.sel.por === 'aclaracion' && /dile que sí, que puede ir el martes/.test(r2.sel.texto), '4 · la respuesta lleva el pedido original al tema elegido'); }
  { const { c, a } = armar([{ choice: cu => pref(cu, 'Narama'), confianza: 0.55 }]);
    const r = c.turno('dile que sí, que puede ir el martes', 'Listo.', { canal: 'segundo_plano' });
    ok(!r.pregunta && r.sel.id, '4 · sin nadie que conteste (segundo plano, GitHub): no pregunta, va al primero'); }
  { const c = caja(); const r = c.turno('¿Quién llega hoy a los apartamentos?', 'Llegan dos huéspedes.');
    ok(!r.tema && c.temas().length === 0, '4 · una consulta suelta no abre tema'); }
  { const { c, b } = armar([]); delete c.props.JEV_KEY;
    const r = c.turno('dile que sí, que puede ir el martes', 'Listo.');
    ok(r.sel.id === b && r.sel.por === 'reciente' && c.jevs.length === 0, '4 · sin Jev: el tema activo más reciente (reglas)'); }
  { const { c } = armar([{ http: 1 }]); c.X.uf_ = () => ({ getResponseCode: () => 500, getContentText: () => '' });
    const r = c.turno('dile que sí', 'Listo.');
    ok(r.sel.por === 'reciente', '4 · si Jev falla: las reglas'); }
}

/* 5 · Etiqueta. */
{ const c = caja();
  const a = c.turno('Escríbele al socio de Narama 633 que el lunes entra el técnico', 'Listo. [[tema: nuevo · Narama 633 · socio]]');
  const ta = tema(c, a.tema); ta.apartamento = 'Z13 - Narama - 633'; ta.tipo = 'socio'; c.X.temaGuardar_(ta);
  c.X.waEnviar_(JUAN.wa, 'Le escribí.', { tema: a.tema });
  ok(c.wa[0].texto === 'Le escribí.', '5 · con un solo tema: sin etiqueta');
  const b = c.turno('Revisa el formulario de registro de la reserva de la familia que llega el viernes a Monaco', 'Listo. [[tema: nuevo · Formulario de registro de la reserva de la familia]]');
  c.X.TEMA_MEMO_ = null; c.X.waEnviar_(JUAN.wa, 'Le escribí.', { tema: a.tema }); c.X.waEnviar_(JUAN.wa, 'Ya lo llenaron.', { tema: b.tema });
  ok(c.wa[1].texto === '📍 Narama 633 · socio: Le escribí.', '5 · con dos temas: «' + c.wa[1].texto + '»');
  const et = /^📍 (.*?): /.exec(c.wa[2].texto);
  ok(et && et[1].length <= 28, '5 · la etiqueta es corta (≤ 28): «' + (et && et[1]) + '»');
  c.X.waEnviar_(SOCIO_TEL, 'Hola, ¿te parece el lunes?', { tema: a.tema });
  ok(c.wa[3].texto === 'Hola, ¿te parece el lunes?', '5 · nunca a un socio, huésped o externo');
  ok(!/temaEtiquetar_|tema:/.test(sacar(leer('voz.js'), 'vozSecretaria_')), '5 · la voz no lleva etiqueta');
  ok(/waEnviar_\(adm\.wa \|\| adm\.tels\[0\], resp, \{ tema: turno\.clas\.tema/.test(COD), '5 · la respuesta de Alma por WhatsApp sale con su tema');
}

/* 6 · Cierre solo por resultado. */
{ const c = caja();
  const a = c.turno('Escríbele al socio de Narama 633 que el lunes entra el técnico', 'Listo. [[tema: nuevo · Narama 633 · socio]]', { canal: 'llamada' });
  ok(c.X.temaCerrar_(a.tema, '').ok === false && tema(c, a.tema).estado === 'abierto', '6 · sin resultado no se cierra');
  c.turno('Gracias, eso es todo, ya cuelgo', 'Claro, hasta luego.', { canal: 'llamada', pista: { tema: a.tema, por: 'tarjeta' } });
  ok(tema(c, a.tema).estado === 'abierto', '6 · terminar una llamada no cierra el tema');
  const llamadaCierra = /temaCerrar_|temaTarjetaResuelta_/.test(sacar(leer('voz.js'), 'vozSecretaria_')) || /temaCerrar_/.test(leer('retomar.js'));
  ok(!llamadaCierra, '6 · nada de la llamada (vozSecretaria_, retomar.js) cierra temas');
  ok(/fin8_\(e\.solicitante_tel\) === fin8_\(tel\)\) return;/.test(sacar(AGE, 'encargoCerrarConLlamada_')), '6 · una llamada del mismo administrador no cierra su encargo (ni su tema)');
  c.turno('El socio ya confirmó el lunes', 'Perfecto. [[tema: ' + a.tema + ' · listo: el socio confirmó el lunes para el técnico]]', { pista: { tema: a.tema, por: 'tarjeta' } });
  const t = tema(c, a.tema);
  ok(t.estado === 'cerrado' && /confirmó el lunes/.test(t.resultado), '6 · «listo: …» lo cierra con su resultado');
  const r = c.turno('Al final el técnico va el martes', 'Anotado.', { pista: { tema: a.tema, por: 'cita' } });
  ok(tema(c, a.tema).estado === 'abierto' && tema(c, a.tema).resultado === '', '6 · un mensaje nuevo en ese tema (cita) lo reabre');
  ok(/temaCerrar_\(m\.tema_id/.test(leer('microproyectos.js')) && /encargoTemaCerrar_\(String\(v\[i\]\[10\]/.test(AGE), '6 · el microproyecto unido y el encargo cumplido cierran su tema con su resultado');
}

/* 7 · Pedido de un socio (#522 T3). */
{ const c = caja();
  const ctx = { resId: 'wa:' + SOCIO_TEL, huesped: 'Socio Prueba', texto: '¿Me pueden cambiar la cerradura este fin de semana? ¿Cuánto costaría?', actor: 'propietario' };
  const ins = c.X.temaSocioPedido_(ctx);
  const t = c.temas().find(x => x.tipo === 'socio');
  ok(t && t.apartamento === 'Narama 633' && t.titulo === 'Narama 633 · socio' && t.admin === JUAN.email, '7 · el pedido del socio abre un tema con su apartamento');
  ok(/No los confirmes ni prometas/.test(ins) && /información sí contéstalo/.test(ins), '7 · Alma no compromete fechas ni costos y contesta lo informativo');
  ok(c.tarjetas.length === 1 && c.tarjetas[0].x.tema === t.id && c.tarjetas[0].x.clasif.tipo === 'atencion' && /opinión/.test(c.tarjetas[0].x.clasif.aviso), '7 · pasa por Pendientes para la opinión de Juan (una tarjeta con su tema)');
  c.X.temaSocioPedido_(Object.assign({}, ctx, { texto: 'Y también revisen la llave del agua' }));
  ok(c.temas().filter(x => x.tipo === 'socio').length === 1 && c.tarjetas.length === 1, '7 · lo que el socio agrega va al mismo tema, sin otra tarjeta');
  const nota = c.X.temaNotaTarjeta_(t.id);
  ok(/escribir_a_equipo/.test(nota) && /socio de Narama 633/.test(nota) && nota.indexOf('[[tema: ' + t.id + ' · listo:') >= 0, '7 · la respuesta de Juan en la tarjeta: escribirle al socio y cerrar al resolverse');
  const r = c.turno('Que sí, el sábado a las 10, sin costo', 'Listo, le escribí al socio. [[tema: ' + t.id + ']]', { pista: { tema: t.id, por: 'tarjeta' } });
  ok(r.tema === t.id && tema(c, t.id).estado === 'abierto', '7 · la respuesta de Juan va al tema del socio y responder no lo cierra');
  ok(/pendResolver_\(ses, id, \{ sinTema: true \}\)/.test(leer('pendientes.js')), '7 · cerrar la tarjeta al responder no cierra el tema');
  c.X.temaTarjetaResuelta_({ id: 'pd0', tema_id: t.id, titulo: 'Pedido del socio' });
  ok(tema(c, t.id).estado === 'cerrado' && /resuelto/.test(tema(c, t.id).resultado), '7 · «Ya está» en la tarjeta lo cierra con su resultado');
  ok(/rt\.ruta === 'socio' && rt\.pedido\) \{ try \{ const ts = temaSocioPedido_\(ctx\)/.test(COD) && /"pedido":true\|false/.test(COD), '7 · el router marca el pedido del socio (en la misma llamada) y abre su tema');
}

/* 8 · Aviso de GitHub (T5). */
{ const issue = { number: 77, state: 'open', labels: [{ name: 'para-alma' }], user: { login: 'jforce15-coder' }, body: '{}' };
  { const c = caja({ props: { GITHUB_TOKEN: 't' }, issue, unoDeMentira: true });
    const r = c.X.paraAlmaAviso_({ action: 'paraAlmaAviso', llave: 'x', issue: 77 });
    ok(!r.ok && /no tiene PARA_ALMA_AVISO_KEY/.test(r.error) && !c.gh.length && !c.uno.length, '8 · sin la llave en el Hub no hace nada'); }
  { const c = caja({ props: { GITHUB_TOKEN: 't', PARA_ALMA_AVISO_KEY: 'llave-buena-123' }, issue, unoDeMentira: true });
    const r = c.X.paraAlmaAviso_({ llave: 'llave-mala-123', issue: 77 });
    ok(!r.ok && r.error === 'llave incorrecta' && !c.gh.length && JSON.stringify(r).indexOf('llave-buena') < 0, '8 · con otra llave no hace nada y no la devuelve');
    const r2 = c.X.paraAlmaAviso_({ llave: 'llave-buena-123', issue: 77 });
    ok(r2.ok && r2.procesado && c.uno[0] === 77 && /issues\/77$/.test(c.gh[0]), '8 · con la llave lee ese issue y lo procesa al momento');
    c.X.paraAlmaAviso_({ llave: 'llave-buena-123', issue: 78 });
    ok(c.X.paraAlmaLlaveIgual_('abc', 'abc') && !c.X.paraAlmaLlaveIgual_('abc', 'abd') && !c.X.paraAlmaLlaveIgual_('', ''), '8 · la comparación de la llave'); }
  { const c = caja({ props: { GITHUB_TOKEN: 't', PARA_ALMA_AVISO_KEY: 'k' }, issue: Object.assign({}, issue, { labels: [{ name: 'otra' }] }), unoDeMentira: true });
    const r = c.X.paraAlmaAviso_({ llave: 'k', issue: 77 });
    ok(r.ok && !r.procesado && !c.uno.length, '8 · un issue sin «para-alma» no se procesa'); }
  { const ttl = props => { let t = 0; const c = caja({ props: Object.assign({ GITHUB_TOKEN: 't' }, props) }); c.X.CacheService = { getScriptCache: () => ({ get: () => null, put: (k, v, s) => { t = s; } }) }; c.X.uf_ = () => ({ getResponseCode: () => 500, getContentText: () => '' }); c.X.paraAlmaRevisar_(Date.now()); return t; };
    ok(ttl({}) === 110 && ttl({ PARA_ALMA_AVISO_KEY: 'k' }) === 1800 && ttl({ PARA_ALMA_AVISO_KEY: 'k', CUPO_AHORRO: '0' }) === 110, '8 · el respaldo pasa de 110 s a 30 min solo con la llave (y vuelve con CUPO_AHORRO = 0)'); }
  const yml = fs.readFileSync(path.join(DIR, '..', '.github', 'workflows', 'para-alma-aviso.yml'), 'utf8');
  ok(/secrets\.PARA_ALMA_AVISO_KEY/.test(yml) && /if \[ -z "\$LLAVE" \]; then[^\n]*exit 0/.test(yml), '8 · el workflow sin el secreto no hace nada (sale bien)');
  ok(!/echo[^\n]*\$LLAVE|echo[^\n]*\$CUERPO|set -x/.test(yml) && /paraAlmaAviso/.test(yml) && /para-alma/.test(yml), '8 · el workflow nunca imprime la llave');
  ok(/body\.action === 'paraAlmaAviso' && !body\.hub\) \{[^\n]*paraAlmaAviso_\(body\)/.test(COD), '8 · el Hub atiende la acción paraAlmaAviso');
  ok(/'PARA_ALMA_AVISO_KEY'/.test(leer('llaves.js')), '8 · la llave se puede guardar desde Ajustes → Llaves');
}

/* 9 · TEMAS_V1. */
{ const c = caja();
  const X = c.X;
  vm.runInContext(/var ENC_CAB_ = [^\n]*/.exec(AGE)[0] + '\nvar ENC_OK_ = false;\n' + sacar(AGE, 'hojaEnc_') + '\n' + /var MICRO_CAB_ = [^\n]*/.exec(leer('microproyectos.js'))[0] + '\n' + /var MICRO_ESTADOS_ = [^\n]*/.exec(leer('microproyectos.js'))[0] + '\n' +
    ['microHoja_', 'microDe_', 'microFilas_'].map(n => sacar(leer('microproyectos.js'), n)).join('\n') + '\n' + /var PEND_CAB_ = [^\n]*/.exec(leer('pendientes.js'))[0] + '\nvar PEND_HORA_ = 3600000;\n' + /var PEND_VENCE_H_ = [^\n]*/.exec(leer('pendlimpieza.js'))[0] + '\n' +
    ['hojaPend_', 'pendFilas_', 'pendVivo_'].map(n => sacar(leer('pendientes.js'), n)).join('\n'), X, { filename: 'extractos 9' });
  X.claudeNivel_ = x => x || 'complejo';
  const iso = new Date(AHORA0 - 2 * H).toISOString();
  X.hojaEnc_().appendRow(['en1', iso, JUAN.email, JUAN.wa, 'Socio Prueba', SOCIO_TEL, 'Pedirle la fecha', 'abierto', '', '']);
  X.hojaEnc_().appendRow(['en2', iso, JUAN.email, JUAN.wa, 'Otro', '50255550303', 'Ya cumplido', 'cumplido', 'ok', iso]);
  X.microHoja_().appendRow(['mp1', 'Uber con Alma', 'en trabajo', AHORA0 - H, AHORA0 - H, JUAN.email, '', '', '', '', '[]', '', '[]', 1, '', 'complejo']);
  X.microHoja_().appendRow(['mp2', 'Viejo', 'unido', AHORA0 - H, AHORA0 - H, JUAN.email, '', '', '', '', '[]', '', '[]', 1, 'x', 'complejo']);
  X.hojaPend_().appendRow(['pd1', AHORA0 - H, JUAN.email, 'atencion', 'proposito', '', 'Elegir proveedor', 'r', '', '', '[]', 'abierto', '', '', 2]);
  X.hojaPend_().appendRow(['pd2', AHORA0 - H, JUAN.email, 'aviso', 'proposito', '', 'Para leer', 'r', '', '', '[]', 'abierto', '', '', 2]);
  const r = X.temasMigrar_();
  const ts = c.temas();
  ok(r.hecho && r.ligados === 3 && ts.length === 3, '9 · TEMAS_V1 liga el encargo, el microproyecto y la tarjeta abiertos (' + r.ligados + ')');
  ok(c.hojas.ALMA_ENCARGOS.filas[1][10] && !c.hojas.ALMA_ENCARGOS.filas[2][10] && c.hojas.ALMA_MICROPROYECTOS.filas[1][16] && c.hojas.ALMA_PENDIENTES.filas[1][15] && !c.hojas.ALMA_PENDIENTES.filas[2][15], '9 · solo lo abierto queda con su tema_id');
  ok(ts.find(t => t.origen === 'encargo').personas[0].t === SOCIO_TEL, '9 · el tema del encargo sabe con quién es');
  const r2 = X.temasMigrar_();
  ok(r2.hecho && r2.ligados === 0 && c.temas().length === 3 && /ligados/.test(c.props.TEMAS_V1), '9 · corre una sola vez (TEMAS_V1)');
  ok(/cupoFuncion_\('temasMigrar_'\); try \{ temasMigrar_\(\)/.test(COD), '9 · procesarCola la llama, con su nombre');
}

/* Los prompts con la hoja vacía no cambian: el bloque de temas solo aparece con temas vivos. */
{ const c = caja(); const sel = c.X.temaTurno_(JUAN, 'hola', 'hub');
  ok(c.X.temaBloque_(JUAN, sel) === '' && !sel.id && !sel.nuevo, 'con la hoja vacía y un saludo: ni tema ni bloque en el prompt'); }

process.exit(fallo);
