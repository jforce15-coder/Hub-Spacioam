/* Prueba de la ficha del socio y los detalles que importan (#522 · T1 y T2) con dobles: sin internet ni Google. Carga
   apps-script/fichasocio.js, encargoEntrante_ y el caso ficha_socio de agente.js, y revisa los enganches de Código.js y
   voz.js. Mi es un doble en memoria con sus mismas ops (ver, anotar, retomado, corregir, borrar).
   1. Guarda lo personal permitido: lo que el redactor marca con [[FICHA:…]] va a Mi con su fecha, la marca nunca sale al
      socio y, aunque se redacte dos veces, se anota una sola vez. En un encargo, los campos «ficha» y «retomado» del JSON.
   2. Rechaza lo prohibido (salud, religión, política, datos bancarios) y lo que el socio no dijo.
   3. Retoma una sola vez: un detalle con fecha pasada (hasta 45 días) y no retomado sale en la ficha con RETOMAR; con
      [[RETOMADO:id]] (o, en la voz y en escribir_a_equipo, porque el texto lo nombra) se marca y ya no vuelve a salir.
      Uno futuro, de hace más de 45 días o ya retomado, no.
   4. Solo con socios: un huésped, alguien del equipo o un externo no tienen ficha ni bloque, y Mi ni se consulta.
   5. Juan ve, corrige y borra (herramienta ficha_socio, solo el principal); la voz recibe la ficha sin ids ni marcas y,
      después de la llamada, lo que contó el socio se anota (solo si el cupo de fondo lo permite).
   node .github/ficha-socio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const COD = leer('Código.js'), AGE = leer('agente.js'), VOZ = leer('voz.js');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

/* Números y nombres de prueba: no son los reales. */
const SOCIO = '50255550201', HUESPED = '50255550301', EQUIPO = '50255550401', HOY = '2026-11-14';

function caja(o) {
  o = o || {};
  const mi = (o.mi || []).map(x => Object.assign({ tipo: 'nota', fecha_evento: '', retomado: '', socio_correo: 'socio.a@prueba.test', socio_tel: SOCIO }, x));
  const llamadas = [], cache = {}, claudes = [], wa = [], avisos = [];
  let n = 0;
  const miOp = b => {
    llamadas.push(b);
    if (o.miCaido) return { ok: false, error: 'Mi no responde' };
    const de = x => !x.borrado && ((b.correo && x.socio_correo === b.correo) || (b.tel && x.socio_tel.slice(-8) === String(b.tel).slice(-8)));
    if (b.op === 'ver') return { ok: true, items: mi.filter(de).map(x => Object.assign({}, x)) };
    if (b.op === 'anotar') { const id = 'fs' + (++n); mi.push({ id, socio_correo: b.correo, socio_tel: b.tel, tipo: b.tipo, texto: b.texto, fecha_evento: b.fecha_evento, fuente: b.fuente, retomado: '' }); return { ok: true, id }; }
    const f = mi.find(x => x.id === b.id && !x.borrado); if (!f) return { ok: false, error: 'No encontré esa nota' };
    if (b.op === 'retomado') f.retomado = '2026-11-14T10:00:00Z';
    if (b.op === 'borrar') { f.borrado = 'sí'; f.texto = ''; }
    if (b.op === 'corregir') { if (b.texto) f.texto = b.texto; if (b.fecha_evento != null) f.fecha_evento = b.fecha_evento; }
    return { ok: true };
  };
  const ctx = {
    console: { log() {}, warn() {}, error(e) { if (o.verErrores) console.log('  (error) ' + e); } }, JSON, Math, String, Number, Object, Array, RegExp, isNaN,
    Date: Object.assign(function (...a) { return a.length ? new Date(...a) : new Date(HOY + 'T16:00:00Z'); }, { now: () => Date.parse(HOY + 'T16:00:00Z'), parse: Date.parse, UTC: Date.UTC }),
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: () => HOY },
    CFG: { TZ: 'America/Guatemala', MODELO_CLASIFICADOR: 'rapido', MODELO_REDACTOR: 'redactor' },
    ACCESOS_APPS_: { mi: () => 'https://mi.apps-script.prueba/exec' }, llaveRobot_: () => 'llave-de-prueba',
    uf_: (url, op) => { const b = JSON.parse(op.payload); if (b.action !== 'fichaSocio' || b.robot !== 'llave-de-prueba') throw new Error('llamada rara a Mi'); const r = miOp(b); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(r) }; },
    fin8_: x => String(x || '').replace(/\D/g, '').slice(-8), normTel_: x => String(x || '').replace(/\D/g, ''),
    socioSeguro_: w => (String(w).replace(/\D/g, '').slice(-8) === SOCIO.slice(-8) ? { wa: SOCIO, nombre: 'Socio Prueba', propiedad: 'Z13 - Edificio Alto - 633' } : null),
    socioMiUsuarios_: () => ({ 'socio.a@prueba.test': { nombre: 'Socio Prueba', tel: SOCIO } }),
    socioDelApartamento_: t => (/edificio alto 633/i.test(t) ? { propiedad: 'Z13 - Edificio Alto - 633', socios: [{ nombre: 'Socio Prueba', tel: SOCIO, email: 'socio.a@prueba.test' }] } : null),
    socioNorm_: s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(),
    SOCIO_MI_PALABRAS_: /\b(socio|socia)\b/i, contactosTodos_: () => [],
    esAdminPrincipal_: a => !!(a && a.principal), cupoPermite_: () => !o.cupoPausado,
    claude_: (modelo, max, sys, usr) => { claudes.push({ modelo, sys, usr }); return typeof o.claude === 'function' ? o.claude(sys, usr) : (o.claude || '{}'); },
    /* encargoEntrante_ */
    hojaWA_: () => ({ appendRow: r => wa.push(r) }), celdaTexto_: x => String(x), adminPorEmail_: () => ({ nombre: 'Juan', email: 'juan@prueba', tels: [] }),
    inboxUpsert_() {}, contactoEncolar_() {}, esRespuestaAutomatica_: () => false, waHilo_: () => [], almaIdentidad_: () => 'Eres Alma.',
    audienciaBloque_: () => '', audienciaDe_: () => 'asociado', datosHechoDeRespuesta_: () => [], opGuardar_() {}, pendAvisar_: (a, t) => { avisos.push(t); return true; },
    waEnviar_: (w, t) => { wa.push(['out', w, t]); return { ok: true }; }, contactoRegistrar_() {}, relevoGuardar_() {}, vozSecEncolar_() {},
    esAcuseCorto_: () => false, idiomaDe_: () => 'es'
  };
  vm.createContext(ctx);
  vm.runInContext(leer('fichasocio.js'), ctx, { filename: 'fichasocio.js' });
  vm.runInContext(['encargoEntrante_', 'encargoRespuestaFalta_'].map(nm => sacar(AGE, nm)).join('\n'), ctx, { filename: 'agente.js (extracto)' });
  return { ctx, mi, llamadas, cache, claudes, wa, avisos };
}
const detalle = (id, fecha, extra) => Object.assign({ id, tipo: 'detalle', texto: 'La boda de su hija', fecha_evento: fecha }, extra || {});

/* ── 1 y 2 · WhatsApp del socio: guarda lo permitido, rechaza lo prohibido y lo que no dijo ── */
{ const C = caja({ mi: [{ id: 'fs9', texto: 'Prefiere que le escriban por la tarde' }] });
  const ctxT = { resId: 'wa:' + SOCIO, hoy: HOY, texto: 'Hola! Te cuento que mi hija se casa el 8 de noviembre y después nos vamos de viaje a Japón. Ah, y me operaron de la rodilla.' };
  const bloque = C.ctx.fichaTurnoSocio_(ctxT);
  ok(/FICHA DEL SOCIO/.test(bloque) && /Prefiere que le escriban por la tarde/.test(bloque) && /\[\[FICHA:/.test(bloque) && /nunca salud, religión, política ni datos bancarios/.test(bloque), 'un socio por WhatsApp: el redactor recibe su ficha y cómo anotar lo nuevo');
  const bruto = '¡Qué alegría, Socio! Felicidades por la boda. Que disfruten Japón.\n[[FICHA:{"tipo":"detalle","texto":"La boda de su hija","fecha":"2026-11-08"}]]\n[[FICHA:{"tipo":"detalle","texto":"Viaje a Japón después de la boda","fecha":""}]]\n[[FICHA:{"tipo":"detalle","texto":"Lo operaron de la rodilla","fecha":""}]]\n[[FICHA:{"tipo":"nota","texto":"Tiene un barco en Miami","fecha":""}]]';
  const limpio = C.ctx.fichaTrasRedactar_(ctxT, bruto);
  ok(limpio === '¡Qué alegría, Socio! Felicidades por la boda. Que disfruten Japón.', 'las marcas nunca le llegan al socio: «' + limpio + '»');
  const anot = C.llamadas.filter(b => b.op === 'anotar');
  ok(anot.length === 2 && anot[0].texto === 'La boda de su hija' && anot[0].fecha_evento === '2026-11-08' && anot[0].tipo === 'detalle' && anot[0].fuente === 'whatsapp' && anot[0].correo === 'socio.a@prueba.test' && anot[0].tel === SOCIO,
    'lo personal permitido (la boda de su hija, con su fecha; el viaje) va a Mi con el socio (correo y número) y la fuente');
  ok(!anot.some(b => /rodilla/.test(b.texto)), 'lo de salud (lo operaron de la rodilla) no se anota');
  ok(!anot.some(b => /barco/.test(b.texto)), 'lo que el socio no dijo (un barco en Miami) no se anota');
  C.ctx.fichaTrasRedactar_(ctxT, bruto);
  ok(C.llamadas.filter(b => b.op === 'anotar').length === 2, 'si el redactor corrige y vuelve a marcar lo mismo, se anota una sola vez');
  const P = ['Va a misa los domingos', 'Votó por el candidato', 'Su cuenta del Banco Industrial', 'Su número es 5555 0101', 'Su esposa está embarazada'];
  ok(P.every(t => C.ctx.fichaProhibido_(t)) && ['La boda de su hija', 'El partido de fútbol de su hijo', 'Viaja a Pinula', 'Practica judo'].every(t => !C.ctx.fichaProhibido_(t)), 'la lista frena salud, religión, política y banco, sin frenar un partido de fútbol, Pinula ni judo');
}

/* ── 3 · retomar una sola vez ── */
{ const C = caja({ mi: [detalle('fs1', '2026-11-08'), detalle('fs2', '2026-12-20', { texto: 'Viaje a Japón' }), detalle('fs3', '2026-08-01', { texto: 'Graduación de su hijo' }), detalle('fs4', '2026-11-01', { texto: 'Cumpleaños de su esposa', retomado: '2026-11-02' })] });
  const items = C.mi.map(x => Object.assign({}, x));
  const ret = C.ctx.fichaParaRetomar_(items, HOY);
  ok(ret && ret.id === 'fs1', 'retoma el detalle ya pasado y reciente (la boda del 8-nov), no el futuro (Japón), ni el de hace más de 45 días, ni el ya retomado');
  const ctxT = { resId: 'wa:' + SOCIO, hoy: HOY, texto: 'Hola, ¿ya está mi estado de cuenta?' };
  const b1 = C.ctx.fichaTurnoSocio_(ctxT);
  ok(/RETOMAR una sola vez/.test(b1) && /«La boda de su hija»/.test(b1) && /\[\[RETOMADO:fs1\]\]/.test(b1) && /no en una queja ni en una urgencia/.test(b1), 'la ficha del turno pide retomarlo con calidez, una vez y solo si el tono lo permite');
  const t = C.ctx.fichaTrasRedactar_(ctxT, '¿Cómo estás? Espero que todo haya salido muy bien con la boda de tu hija. Tu estado de cuenta sale el lunes.\n[[RETOMADO:fs1]]');
  ok(!/\[\[/.test(t) && C.mi.find(x => x.id === 'fs1').retomado, 'con [[RETOMADO:fs1]] queda retomado en Mi y la marca no sale');
  const b2 = C.ctx.fichaTurnoSocio_({ resId: 'wa:' + SOCIO, hoy: HOY, texto: 'Gracias' });
  ok(!/RETOMAR/.test(b2) && /ya retomado/.test(b2), 'el turno siguiente ya no lo pide (la caché se renovó)');
  const C2 = caja({ mi: [detalle('fs1', '2026-11-08')] });
  C2.ctx.fichaTrasRedactar_({ resId: 'wa:' + SOCIO, fichaSocio: { s: C2.ctx.fichaSocioDe_(SOCIO), items: [{ id: 'otro', retomado: '' }], vistos: {} }, texto: 'hola' }, 'Hola [[RETOMADO:fs1]]');
  ok(!C2.mi[0].retomado, 'un id que no estaba por retomar en este turno no se marca');
  const C3 = caja({ mi: [detalle('fs1', '2026-11-08')] });
  ok(C3.ctx.fichaTrasEscribir_(SOCIO, 'Hola, espero que todo haya salido muy bien con la boda. Te escribo por el reporte de octubre.') === 'fs1' && C3.mi[0].retomado, 'escribir_a_equipo: si el mensaje al socio nombra el detalle, queda retomado');
  const C4 = caja({ mi: [detalle('fs1', '2026-11-08')] });
  ok(C4.ctx.fichaTrasEscribir_(SOCIO, 'Hola, te escribo por el reporte de octubre.') === '' && !C4.mi[0].retomado, '…y si no lo nombra, sigue pendiente para la próxima');
}

/* ── 4 · solo con socios ── */
{ const C = caja({ mi: [detalle('fs1', '2026-11-08')] });
  ok(C.ctx.fichaTurnoSocio_({ resId: 'wa:' + HUESPED, hoy: HOY }) === '' && C.ctx.fichaTurnoSocio_({ resId: 'wa:' + EQUIPO, hoy: HOY }) === '' && C.ctx.fichaTurnoSocio_({ resId: '4f1e2d3c-reserva', hoy: HOY }) === '', 'un huésped, alguien del equipo o una reserva de plataforma: sin ficha');
  ok(C.ctx.fichaVozBloque_(HUESPED) === '' && C.ctx.fichaDeLlamada_(HUESPED, [{ role: 'user', message: 'Mi hija se casa el sábado, estoy feliz de verdad, muchas gracias' }]) === null, 'en la voz tampoco: ni ficha al llamar ni lectura después');
  ok(C.llamadas.length === 0 && C.claudes.length === 0, 'y Mi ni la IA se consultan');
  const caido = caja({ miCaido: true });
  ok(caido.ctx.fichaTurnoSocio_({ resId: 'wa:' + SOCIO, hoy: HOY }) === '', 'si Mi no responde, el turno sigue igual, sin ficha');
}

/* ── 1 · encargo con un socio: los campos del JSON ── */
{ const C = caja({ mi: [detalle('fs1', '2026-11-08')], claude: (sys) => (/FICHA DEL SOCIO/.test(sys) ? JSON.stringify({ respuesta: '¡Qué gusto! Espero que la boda haya salido muy bien. Gracias por confirmar.', para_admin: '', completo: false, retomado: 'fs1', ficha: [{ tipo: 'detalle', texto: 'Viaje a Guatemala en diciembre', fecha: '2026-12-15' }, { tipo: 'nota', texto: 'Es evangélico', fecha: '' }] }) : '{"respuesta":"ok","completo":false}') });
  C.ctx.encargoEntrante_(SOCIO, 'Socio Prueba', 'Sí, confirmo. Por cierto, viajo a Guatemala en diciembre, el 15. Soy evangélico.', '2026-11-14T16:00:00Z', [], 'wamid.1', { solicitante: 'juan@prueba', persona: 'Socio Prueba', objetivo: 'Confirmar la fecha de la visita' });
  ok(/FICHA DEL SOCIO/.test(C.claudes[0].sys) && /"retomado":"fs1"/.test(C.claudes[0].sys) && /"ficha":\[/.test(C.claudes[0].sys), 'en un encargo con un socio, el mismo turno recibe la ficha y los campos «ficha» y «retomado»');
  const anot = C.llamadas.filter(b => b.op === 'anotar');
  ok(anot.length === 1 && anot[0].texto === 'Viaje a Guatemala en diciembre' && anot[0].fecha_evento === '2026-12-15' && anot[0].fuente === 'encargo', 'lo que contó (el viaje, con su fecha) se anota; la religión no');
  ok(C.mi[0].retomado, 'y el detalle retomado queda marcado');
  ok(C.wa.some(r => r[0] === 'out' && /boda/.test(r[2])), 'la respuesta sale al socio como siempre');
  const E = caja({ claude: '{"respuesta":"Gracias","completo":false,"ficha":[{"tipo":"detalle","texto":"Su boda","fecha":""}]}' });
  E.ctx.encargoEntrante_(EQUIPO, 'Técnico', 'Listo, mañana voy. Me caso el sábado', '2026-11-14T16:00:00Z', [], 'wamid.2', { solicitante: 'juan@prueba', persona: 'Técnico', objetivo: 'Agendar la visita' });
  ok(!/FICHA DEL SOCIO/.test(E.claudes[0].sys) && E.llamadas.length === 0, 'un encargo con alguien que no es socio no lleva ficha ni anota nada');
}

/* ── 5 · Juan ve, corrige y borra; la voz ── */
{ const C = caja({ mi: [detalle('fs1', '2026-11-08'), { id: 'fs2', texto: 'Habla inglés' }] });
  const juan = { principal: true, nombre: 'Juan' }, otro = { principal: false, nombre: 'Ana' };
  const v = C.ctx.fichaHerramienta_(juan, { socio: 'socio de Edificio Alto 633' });
  ok(v.ficha && v.ficha.length === 2 && v.ficha[0].id === 'fs1' && /boda de su hija/.test(v.retomar), 'ficha_socio (ver): Juan ve la ficha con ids y el detalle por retomar');
  ok(/Solo el administrador principal/.test(C.ctx.fichaHerramienta_(otro, { socio: SOCIO }).error), 'otro administrador no la ve');
  ok(C.ctx.fichaHerramienta_(juan, { socio: SOCIO, accion: 'corregir', id: 'fs2', texto: 'Habla inglés y español' }).ok && C.mi[1].texto === 'Habla inglés y español', 'Juan la corrige');
  ok(C.ctx.fichaHerramienta_(juan, { socio: SOCIO, accion: 'borrar', id: 'fs2' }).ok && C.mi[1].borrado, 'Juan la borra');
  ok(C.ctx.fichaHerramienta_(juan, { socio: SOCIO }).ficha.length === 1, 'lo borrado ya no sale');
  ok(/religión/.test(C.ctx.fichaHerramienta_(juan, { socio: SOCIO, accion: 'anotar', texto: 'Va a misa los domingos' }).error), 'ni pidiéndoselo a Alma se anota algo prohibido');
  ok(C.ctx.fichaHerramienta_(juan, { socio: SOCIO, accion: 'anotar', texto: 'Su aniversario', fecha: '2026-12-02' }).ok && C.mi.some(x => x.texto === 'Su aniversario' && x.tipo === 'detalle' && x.fuente === 'chat'), 'lo que Juan le dicta a Alma se anota (con fecha = detalle)');
  ok(/socio/.test(C.ctx.fichaHerramienta_(juan, { socio: HUESPED }).error), 'un número que no es de un socio: no hay ficha');

  const V = caja({ mi: [detalle('fs1', '2026-11-08'), { id: 'fs2', texto: 'Habla inglés' }], claude: '{"ficha":[{"tipo":"detalle","texto":"Su nieto nace en enero","fecha":"2027-01-10"},{"tipo":"nota","texto":"Tiene diabetes","fecha":""}]}' });
  const vb = V.ctx.fichaVozBloque_(SOCIO);
  ok(/FICHA DEL SOCIO/.test(vb) && /Habla inglés/.test(vb) && /RETOMAR una sola vez/.test(vb) && !/fs1|\[\[/.test(vb), 'la voz recibe la ficha y el detalle por retomar, sin ids ni marcas');
  const r = V.ctx.fichaDeLlamada_(SOCIO, [{ role: 'agent', message: '¡Hola! ¿Cómo te fue en la boda de tu hija?' }, { role: 'user', message: 'Muy bien, gracias. Y te cuento que mi nieto nace en enero, el diez. Tengo diabetes, por cierto.' }]);
  ok(r.retomado === 'fs1' && V.mi[0].retomado, 'después de la llamada: Alma nombró la boda, queda retomada');
  ok(V.claudes.length === 1 && /LO QUE DIJO EL SOCIO/.test(V.claudes[0].usr) && !/boda de tu hija/.test(V.claudes[0].usr), 'una lectura corta solo de lo que dijo el socio');
  ok(r.anotados.length === 1 && V.mi.some(x => x.texto === 'Su nieto nace en enero' && x.fuente === 'llamada') && !V.mi.some(x => /diabetes/.test(x.texto)), 'lo personal se anota (su nieto); la salud no');
  const VP = caja({ mi: [{ id: 'fs2', texto: 'Habla inglés' }], cupoPausado: true });
  VP.ctx.fichaDeLlamada_(SOCIO, [{ role: 'user', message: 'Mi hija se casa el sábado, estoy muy feliz, gracias por todo lo de este mes' }]);
  ok(VP.claudes.length === 0, 'con el cupo de fondo en pausa, no hay lectura de la llamada');
}

/* ── Enganches en el Hub ── */
{ const red = sacar(COD, 'redactar_'), cla = sacar(COD, 'clasificar_');
  ok(/fichaTrasRedactar_\(ctx, bruto0\)/.test(red) && red.indexOf('fichaTrasRedactar_') < red.indexOf('extraerFactura_(bruto)'), 'redactar_ quita las marcas de la ficha antes de todo lo demás');
  ok(/fichaTurnoSocio_\(ctx\)/.test(cla) && cla.indexOf('fichaTurnoSocio_') < cla.indexOf("return { nivel: rt.urgencia"), 'clasificar_ suma la ficha a las instrucciones en la ruta de un socio');
  ok(/fichaVozBloque_\(tel\)/.test(sacar(VOZ, 'vozInicio_')) && /fichaDeLlamada_\(tel, d\.transcript\)/.test(sacar(VOZ, 'vozPostCall_')), 'la voz: ficha al empezar y lectura al terminar');
  ok(/case 'ficha_socio'/.test(AGE) && /T\('ficha_socio'/.test(AGE) && /fichaTrasEscribir_\(p\.tel, inp\.texto\)/.test(AGE), 'agente.js: la herramienta ficha_socio y escribir_a_equipo marca lo retomado');
}

process.exit(fallo);
