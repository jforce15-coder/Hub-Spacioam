/* Prueba con dobles del pedido personal del principal (apps-script/pedidopersonal.js), sin Google, IA ni WhatsApp.
   20-nov-2026 (caso real, anonimizado): Juan reenvió por WhatsApp la foto de una invitación («… NIGHT OUT · FRI 27 NOV ·
   LOCATION TBD») y un minuto después una nota de voz «ponlo en mi agenda… en mi Google Calendar». Alma contestó a la foto
   sola con «¿Esto es para Confirmar envío de mensaje a huésped o para <persona> respuesta?» y a la nota de voz mezclándolo
   con ese tema, sin poner el evento. Revisa:
   1. lo personal (agenda, invitación) se separa de lo operativo sin IA; lo de huéspedes no es personal;
   2. el material suelto (reenviado, foto sin pie) espera 90 s a la instrucción; con texto propio o nota de voz, 20 s;
   3. con dos temas de trabajo activos y Jev dudoso: la invitación NO pregunta «¿Esto es para A o para B?» y va a un tema
      personal; la nota de voz que sigue va a ese mismo tema, aunque quedara pendiente la pregunta de trabajo;
   4. «ponlo en mi agenda» confirma crear_evento; el evento queda en la hora pedida («hora de España» = Europe/Madrid, a la
      hora exacta en UTC), con su enlace; sin CALENDARIO_JUAN y con el Hub en otra cuenta, no escribe en el calendario de
      la cuenta del Hub: dice qué compartir;
   5. el cableado: opWaProcesar_ usa opAgruparEspera_ y no manda el caso pendiente con lo personal; opProcesar_ suma
      ppNota_; decisionWaEntrante_ no toma lo personal como respuesta a un caso; agente.js confirma con la orden.
   node .github/pedido-personal.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const COD = leer('Código.js'), MICRO = leer('microproyectos.js');
const AHORA0 = Date.parse('2026-11-20T11:30:00Z'), H = 3600000;
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true, tels: ['50255550000'], wa: '50255550000' };

/* El caso real, sin datos personales. */
const FOTO = "[reenviado] Hey HEy !! Next Friday night ya'll. Location TBD- send me your favorites.\n[envió una foto: Es un afiche promocional para una salida nocturna de padres.\n\nDADS NIGHT OUT\nGOOD COMPANY\nCOLD DRINKS\nFRI 27 NOV\nLOCATION TBD!]";
const VOZ = '[nota de voz] Apunta este evento, es de los padres de la escuela de mis hijos. Se van a reunir el 27. Ponlo en mi agenda, a partir de las seis o siete de la tarde de hora de España. Y cada vez que te pida poner en mi agenda, ponlo en mi Google Calendar.';

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
  ['sociosmi.js', 'rapido.js', 'orbita.js', 'episnap.js', 'pedidopersonal.js', 'temas.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
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


/* 1 · Clasificar sin IA. */
{ const { X } = caja();
  const f = X.ppClasificar_(FOTO), v = X.ppClasificar_(VOZ);
  ok(f.personal && f.invitacion && !f.agenda, '1 · la invitación reenviada es personal (invitación, sin orden)');
  ok(v.personal && v.agenda, '1 · «ponlo en mi agenda» es personal y es orden de agendar');
  ['Dile al huésped de Monaco D4 que el check-in es a las 3', 'Confirma el envío del mensaje a la huésped', '¿Cómo va lo de los cupos de Google?', 'Christine respuesta: sí, mándalo', 'Escríbele al socio de Narama 633'].forEach(t =>
    ok(!X.ppClasificar_(t).personal, '1 · operativo, no personal: «' + t + '»'));
  ok(X.ppClasificar_('[reenviado] Fiesta de bienvenida para el huésped de la reserva 123').personal === false, '1 · una «fiesta» de un huésped sigue siendo operativa');
  ok(!X.ppNota_('Dile al huésped que sí') && /crear_evento ya/.test(X.ppNota_(VOZ)) && /pregúntale solo si lo pones en su agenda/.test(X.ppNota_(FOTO)), '1 · la nota para Alma: con la orden, crear_evento ya; con la invitación sola, preguntar si la pone');
  ok(!X.ppAgendaOrden_(X.ppNota_(FOTO)) && !X.ppAgendaOrden_(X.ppNota_(VOZ).replace(/crear_evento/g, '')), '1 · la nota misma no cuenta como orden de agendar');
}

/* 2 · Agrupar: material suelto espera la instrucción. */
{ const { X } = caja();
  X.opAgruparSeg_ = () => 20;
  ok(X.opAgruparEspera_([{ texto: FOTO, tipo: 'image' }]) === 90000, '2 · la foto reenviada sola espera 90 s a la nota de voz');
  ok(X.opAgruparEspera_([{ texto: '[envió una foto: un recibo]', tipo: 'image' }]) === 90000, '2 · una foto sin pie también espera');
  ok(X.opAgruparEspera_([{ texto: FOTO, tipo: 'image' }, { texto: VOZ, tipo: 'audio' }]) === 20000, '2 · con la nota de voz ya está la instrucción: 20 s');
  ok(X.opAgruparEspera_([{ texto: 'ponlo en mi agenda\n[envió una foto: afiche]', tipo: 'image' }]) === 20000, '2 · una foto con su propio pie: 20 s');
  ok(X.opAgruparEspera_([{ texto: 'Dile a la huésped que sí', tipo: 'text' }]) === 20000, '2 · texto propio: 20 s');
  ok(/espera = opAgruparEspera_\(g\.map\(x => \(\{ texto: s_\(x\.r\[4\]\), tipo: s_\(x\.r\[7\]\) \}\)\)\)/.test(COD), '2 · opWaProcesar_ usa opAgruparEspera_ por grupo');
}

/* 3 · Temas: nada de «¿Esto es para A o para B?» con lo personal. */
{ const c = caja({ jev: [{ choice: cu => Object.keys(cu.questions.tema.criteria)[0], confianza: 0.5 }, { choice: cu => Object.keys(cu.questions.tema.criteria)[0], confianza: 0.5 }], props: { JEV_KEY: 'llave-jev' } }), X = c.X;
  c.temaViejo('tm1', 'Confirmar envío de mensaje a huésped', { hace: H / 2, espera: 'respuesta' });
  c.temaViejo('tm2', 'Christine respuesta', { hace: H / 3 });
  /* Sin el arreglo, el mismo texto operativo con dos temas activos y Jev dudoso pregunta: la prueba sí ve el problema. */
  const ctrl = c.turno('Revisa esto y avísame qué hacemos mañana con lo pendiente', 'Listo.', { canal: 'whatsapp' });
  ok(!!ctrl.pregunta, '3 · control: un pedido de trabajo ambiguo con dos temas activos sí pregunta (' + (ctrl.pregunta || ctrl.sel.por) + ')');
  const r1 = c.turno(FOTO, '¡Qué plan! ¿Lo pongo en tu agenda el viernes 27? ¿A qué hora?', { canal: 'whatsapp' });
  ok(!r1.pregunta && r1.sel.por === 'personal' && !['tm1', 'tm2'].includes(r1.sel.id), '3 · la invitación no pregunta «¿Esto es para…?»: tema personal nuevo (' + (r1.pregunta || r1.sel.por) + ')');
  const tp = c.temas().find(t => t.tipo === 'personal');
  ok(!!tp && r1.tema === tp.id && tp.id !== 'tm1' && tp.id !== 'tm2', '3 · queda un tema personal propio, no el del huésped ni el de la otra persona');
  const r2 = c.turno(VOZ, 'Listo, quedó en tu agenda.', { canal: 'whatsapp' });
  ok(!r2.pregunta && r2.sel.id === tp.id && r2.sel.por === 'personal', '3 · la nota de voz va al mismo tema personal');
  ok(!c.cache['temaduda_' + JUAN.email], '3 · la pregunta de trabajo pendiente se olvida con lo personal');
  const r3 = c.turno(VOZ, 'Listo. [[tema: tm2]]', { canal: 'whatsapp' });
  ok(r3.tema === tp.id, '3 · la etiqueta de Alma no lo pasa a otro tema (por pedido personal gana el código)');
}

/* 4 · Calendario: orden = sí, hora exacta, enlace y cuenta correcta. */
function calCaja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), creados = [];
  const fmt = (d, tz, f) => {
    const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
    if (f === 'Z') { const m = /GMT([+-])(\d{2}):(\d{2})/.exec(p.timeZoneName || ''); return m ? m[1] + m[2] + m[3] : '+0000'; }
    return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
  };
  const cal = (id, nombre) => ({ getId: () => id, getName: () => nombre, getTimeZone: () => 'Europe/Madrid', getEvents: () => [],
    createEvent: (t, a, b, op) => { const ev = { t, a, b, op, getId: () => 'abc123@google.com', setTag() {} }; creados.push(ev); return ev; } });
  const ctx = { console: { log() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Intl,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => o.cuenta || 'hub@ejemplo.com' }) },
    CalendarApp: { getDefaultCalendar: () => cal(o.cuenta || 'hub@ejemplo.com', 'Calendario de la cuenta del Hub'), getCalendarById: id => (id === 'juan@ejemplo.com' ? cal(id, 'Juan') : null), subscribeToCalendar: () => null },
    Utilities: { formatDate: fmt, base64EncodeWebSafe: s => Buffer.from(String(s)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_') },
    adminsOp_: () => [JUAN] };
  vm.createContext(ctx);
  vm.runInContext(sacar(leer('programados.js'), 'progFecha_') + '\n' + leer('pedidopersonal.js') + '\n' + leer('calendario.js'), ctx);
  return { X: ctx, creados };
}
{ const { X, creados } = calCaja({ props: { CALENDARIO_JUAN: 'juan@ejemplo.com' } });
  const inp = X.ppConfirmarAgenda_({ titulo: 'Salida de padres', inicio: '2026-11-27 18:00', zona: 'hora de España', duracion_min: 180 }, FOTO + '\n\n' + VOZ);
  ok(inp.confirmado === true, '4 · «ponlo en mi agenda» en el turno ya es el sí');
  ok(X.ppConfirmarAgenda_({ titulo: 'x', inicio: '2026-11-27 18:00' }, FOTO).confirmado !== true, '4 · la invitación sola no confirma: Alma pregunta');
  const r = X.calendarioCrear_(inp);
  ok(r.creado && creados.length === 1 && creados[0].a.toISOString() === '2026-11-27T17:00:00.000Z', '4 · 18:00 hora de España = 17:00 UTC, con la zona explícita (' + (creados[0] && creados[0].a.toISOString()) + ')');
  ok(r.zona === 'Europe/Madrid' && /hora de España/.test(r.cuando) && /en Guatemala/.test(r.cuando), '4 · dice la zona y la hora de Guatemala: ' + r.cuando);
  const eid = /eid=([\w-]+)$/.exec(r.enlace || '');
  ok(!!eid && Buffer.from(eid[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString() === 'abc123 juan@ejemplo.com' && r.hecho.indexOf(r.enlace) >= 0, '4 · confirma con el enlace del evento');
  const g = X.calendarioCrear_({ titulo: 'Sin zona', inicio: '2026-11-27 18:00', confirmado: true });
  ok(g.creado && creados[1].a.toISOString() === '2026-11-28T00:00:00.000Z', '4 · sin zona: hora de Guatemala explícita, nunca la del calendario (Madrid)');
}
{ const { X, creados } = calCaja({ cuenta: 'hub@ejemplo.com' });
  const r = X.calendarioCrear_({ titulo: 'x', inicio: '2026-11-27 18:00', confirmado: true });
  ok(r.error && /CALENDARIO_JUAN/.test(r.error) && /hub@ejemplo\.com/.test(r.error) && !creados.length, '4 · sin CALENDARIO_JUAN y con el Hub en otra cuenta: no escribe en el calendario equivocado y dice qué compartir');
  const e = X.calendarioEstado_();
  ok(e.ok === false && e.calendario_juan === false, '4 · calendario_estado lo dice');
}
{ const { X, creados } = calCaja({ cuenta: JUAN.email });
  ok(X.calendarioCrear_({ titulo: 'x', inicio: '2026-11-27 18:00', confirmado: true }).creado && creados.length === 1, '4 · si el Hub corre en la cuenta del principal, su calendario predeterminado sirve');
}

/* 5 · Cableado. */
{ const DEC = leer('decisiones.js'), AG = leer('agente.js');
  const iP = DEC.indexOf('if (ppClasificar_(texto).personal) return false;'), iC = DEC.indexOf('if (!decEsParaCaso_(f, texto)) return false;');
  ok(iP > 0 && iC > iP, '5 · decisionWaEntrante_: lo personal sale antes de preguntar si es para el caso');
  ok(/if \(nombre === 'crear_evento'\) ppConfirmarAgenda_\(inp, AGENTE_TEXTO_\);[^\n]*\n\s*var rCal = calendarioHerramienta_/.test(AG), '5 · agente.js confirma crear_evento con la orden del turno');
  ok(/notaPers = ppNota_\(texto\)/.test(COD) && /\[nota, notaEst, notaPers,/.test(COD), '5 · opProcesar_ suma la nota de lo personal (en el turno, no en el prompt fijo)');
  ok(/if \(!rlv && !ppClasificar_\(textos\.join\('\\n'\)\)\.personal\) \{ try \{ notaCaso = decNotaAgente_\(wa\)/.test(COD), '5 · con lo personal no se manda el caso pendiente como contexto');
  ok(/case 'calendario_estado': return json_\(calendarioEstado_\(\)\)/.test(COD), '5 · el robot puede ver a qué calendario escribe Alma');
}

process.exit(fallo);
