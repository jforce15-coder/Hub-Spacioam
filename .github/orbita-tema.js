/* Prueba con dobles del toque de un anillo o de su notificación (apps-script/orbita.js, chat.js, pushapp.js; #583 T1), sin
   Google, IA ni OneSignal. 16-nov-2026: tocar el anillo «Cupos Google» mandaba solo el texto; el tema se adivinaba y el anillo,
   el microproyecto y el tema tenían tres nombres distintos. Revisa:
   1. orbita = «mp…» trae su tema (microproyecto → tema) y su estado en la nota, sin herramientas ni Jev: qué pidió, qué se
      hizo, en qué estado va, el PR y qué falta; el mensaje va a ese tema («tocó su anillo») y no va a Claude;
   2. «es…» (escalado → microproyecto → tema), «ob…» (el tema guardado al empezar) y «tm…»; lo de otra persona o un id raro, no;
      un microproyecto de antes sin tema recibe uno;
   3. un solo nombre: el título del anillo se guarda una vez en el microproyecto y su tema;
   4. orbitaExplicar_ encuentra el microproyecto por lo que pidió (x.texto y det.micro.pidio), no solo por el nombre;
   5. «¿cómo estamos con los cupos de Google?» es una pregunta de estado: nota con lo que ya se sabe y su tema; con algo que
      hacer después, no;
   6. la notificación lleva el mismo id (vozAvisoSalida_ y data.alma del push) y la página lo manda con el texto.
   node .github/orbita-tema.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script'), RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };
const COD = leer('Código.js'), MICRO = leer('microproyectos.js');
const AHORA0 = Date.parse('2026-11-16T18:00:00Z'), H = 3600000;
const JUAN = { email: 'juan@ejemplo.com', nombre: 'Juan', principal: true, tels: ['50255550000'] };
const GABY = { email: 'gaby@ejemplo.com', nombre: 'Gabriel', principal: false, tels: ['50255550001'] };

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
function caja() {
  const props = {}, cache = {}, hojas = {}, d = { escalar: [], jev: 0, modelo: [], titulos: [] };
  let ahora = AHORA0;
  const DateF = class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, Error, isNaN, encodeURIComponent, Buffer,
    CFG: { TZ: 'America/Guatemala', MODELO_CLASIFICADOR: 'rapido' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: x => new Date(x).toISOString().slice(0, 16), base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'), computeDigest: (a, t) => Array.from(require('crypto').createHash('md5').update(String(t)).digest()), DigestAlgorithm: { MD5: 'md5' } },
    hojaCrear_: (n, cab) => (hojas[n] = hojas[n] || hoja(cab)),
    uf_: url => { if (/typesafe/.test(url)) d.jev++; throw new Error('internet inesperado: ' + url); },
    claude_: (m, max, sys, user) => { d.modelo.push(user); const t = d.titulos.filter(x => x[0].test(user))[0]; return t ? t[1] : ''; },
    vozColaLock_: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }), abrePedido_: () => {},
    adminsOp_: () => [JUAN, GABY], adminPorTel_: () => null, adminPorEmail_: e => [JUAN, GABY].find(a => a.email === e) || null,
    esAdminPrincipal_: a => !!(a && a.principal), chatPrincipal_: () => JUAN, relevoCitado_: () => null, socioSeguro_: () => null,
    propNombre_: p => String(p || ''), claudeNivel_: x => x || 'complejo', escalarEntregas_: () => d.escalar
  };
  vm.createContext(ctx);
  vm.runInContext(['s_', 'celdaTexto_', 'normTel_', 'telsEnTexto_'].map(n => sacar(COD, n)).join('\n') + '\nvar fin8_ = x => String(x || "").replace(/\\D/g, "").slice(-8);\n' +
    sacar(leer('contacto.js'), 'esAcuseCorto_') + '\n' + /var MICRO_CAB_ = [^\n]*/.exec(MICRO)[0] + '\n' + /var MICRO_ESTADOS_ = [^\n]*/.exec(MICRO)[0] + '\n' +
    ['microHoja_', 'microDe_', 'microFilas_', 'microNombre_'].map(n => sacar(MICRO, n)).join('\n'), ctx, { filename: 'extractos' });
  ['candado.js', 'sociosmi.js', 'rapido.js', 'orbita.js', 'episnap.js', 'temas.js'].forEach(f => vm.runInContext(leer(f), ctx, { filename: f }));
  const micro = (id, nombre, x) => { x = x || {}; ctx.microHoja_().appendRow([id, nombre, x.estado || 'en trabajo', ahora - 2 * H, ahora - (x.hace || 10 * 60000), x.quien || JUAN.email, x.issue || '', x.pr || '', '', '', JSON.stringify(x.ajustes || []), x.pregunta || '', '[]', 1, '', 'complejo', x.tema || '']); };
  return { X: ctx, d, props, cache, hojas, micro, pasa: ms => { ahora += ms; }, tema: id => { ctx.TEMA_MEMO_ = null; return ctx.temaLeer_(id); } };
}
const PIDIO = 'Juan pregunta cómo estamos con los cupos de Google';
const AJUSTES = [{ ts: AHORA0 - 2 * H, de: 'juan', texto: PIDIO }, { ts: AHORA0 - H, de: 'claude', texto: 'Revisé el cupo: va en 62 % del día y lo que más gasta es procesarCola.' }];

/* 1 · «mp…»: su tema y su estado, sin herramientas. */
{ const c = caja(), X = c.X;
  const tm = X.temaCrear_(JUAN, { tipo: 'micro', titulo: 'Cupos de Google', origen: 'micro', origen_id: 'mpcupos1' }).id;
  c.micro('mpcupos1', 'Cupos de Google', { ajustes: AJUSTES, pr: 'https://github.com/x/y/pull/590', issue: 'https://github.com/x/y/issues/588', tema: tm });
  const r = X.orbitaTurno_(JUAN, 'mpmpcupos1');
  ok(r && r.o.tema === tm && r.o.por === 'orbita' && r.o.estado === true && r.o.orbita === 'mpmpcupos1', '1 · orbita «mp…» → su microproyecto → su tema, fijo («tocó su anillo»)');
  const est = JSON.parse((/\nESTADO: (\{[\s\S]*\})$/.exec(r.nota) || [])[1] || '{}');
  ok(/cupos de Google/.test(est.que_pidio) && /62 %/.test(est.que_se_hizo) && /^en curso/.test(est.estado) && /pull\/590/.test(est.pr) && /issues\/588/.test(est.issue) && est.que_falta,
    '1 · la nota trae el estado en JSON corto: qué pidió, qué se hizo, en qué estado va, PR, issue y qué falta');
  ok(/«Cupos de Google»/.test(r.nota) && /no lo busques otra vez/.test(r.nota) && /No es un pedido para Claude/.test(r.nota) && r.nota.length < 1600, '1 · le dice que ya lo tiene, que es una pregunta de estado y no un pedido para Claude (' + r.nota.length + ' letras)');
  ok(c.d.jev === 0 && c.d.modelo.length === 0, '1 · sin IA ni Jev para saber de qué habla');
  X.TEMA_PISTA_ = { tema: r.o.tema, por: r.o.por };
  const sel = X.temaTurno_(JUAN, '¿Cómo va «Cupos de Google»? Cuéntame qué pasó, qué has hecho y en qué estado está.', 'app');
  ok(sel.id === tm && sel.por === 'orbita' && /tocó su anillo/.test(X.temaBloque_(JUAN, sel)), '1 · el mensaje va a ese tema sin adivinar');
  const op = sacar(COD, 'opProcesar_'), env = sacar(leer('chat.js'), 'chatEnviar_');
  ok(/orbitaTurno_\(adm, String\(b\.orbita\)/.test(env) && /opProcesar_\(adm, b\.texto, canal, \[\], nota, o\)/.test(env), '1 · chatEnviar_ pasa el id a orbitaTurno_ y su nota y tema a opProcesar_');
  ok(/sinDesarrollo: !!\(o && o\.estado\)/.test(op) && /TEMA_PISTA_ = o && o\.tema \? \{ tema: o\.tema, por: o\.por \|\| 'tarjeta' \}/.test(op), '1 · opProcesar_ fija el tema y una pregunta de estado no va a Claude (sinDesarrollo)');
  ok(/TEMA_FIJOS_ = \[[^\]]*'orbita'/.test(leer('temas.js')), '1 · con el anillo gana el código aunque Alma marque otro tema');
}

/* 2 · «es…», «ob…», «tm…», lo ajeno y lo raro. */
{ const c = caja(), X = c.X;
  const tm = X.temaCrear_(JUAN, { tipo: 'micro', titulo: 'Cupos de Google' }).id;
  c.micro('mpcupos1', 'Cupos de Google', { ajustes: AJUSTES, tema: tm });
  c.d.escalar = [{ id: 'esc1', micro: 'mpcupos1', email: JUAN.email, estado: 'por_unir', nombre: 'Cupos de Google', para_entregar: 'El cupo de hoy', t: AHORA0 - H, prs: ['https://github.com/x/y/pull/590'] }];
  ok(X.orbitaTema_(JUAN, 'esesc1') === tm, '2 · «es…»: escalado → microproyecto → tema');
  const tmOb = X.temaCrear_(JUAN, { titulo: 'Pagos de Amalfi' }).id;
  const ob = X.orbitaEmpieza_(JUAN.email, 'Revisa los pagos de Amalfi de octubre', 'segundo_plano', '', '', tmOb);
  ok(X.orbitaTema_(JUAN, ob) === tmOb, '2 · «ob…»: el tema que se guardó al empezar');
  ok(X.orbitaTema_(JUAN, tm) === tm && X.orbitaTurno_(JUAN, tm).o.tema === tm && /Cupos de Google/.test(X.orbitaTurno_(JUAN, tm).nota), '2 · «tm…»: el tema mismo, con su último paso');
  ok(X.orbitaTema_(GABY, 'mpmpcupos1') === '' && X.orbitaTema_(GABY, 'esesc1') === '' && X.orbitaTema_(GABY, ob) === '', '2 · lo de otra persona no');
  ok(X.orbitaTurno_(JUAN, 'xx1') === null && X.orbitaTurno_(JUAN, 'mp"><script>') === null && X.orbitaTema_(JUAN, 'mpnoexiste') === '', '2 · un id raro o que no existe: nada');
  c.micro('mpviejo1', 'Uber con Alma', { ajustes: [{ ts: AHORA0 - H, de: 'juan', texto: 'Que Alma pida un Uber' }] });
  const nuevo = X.orbitaTema_(JUAN, 'mpmpviejo1');
  ok(nuevo && c.tema(nuevo).titulo === 'Uber con Alma' && X.microFilas_().find(m => m.id === 'mpviejo1').tema_id === nuevo, '2 · un microproyecto de antes sin tema recibe uno con su nombre');
}

/* 3 · Un solo nombre: el del anillo. */
{ const c = caja(), X = c.X;
  const tm = X.temaCrear_(JUAN, { tipo: 'micro', titulo: 'Cupos de Google' }).id;
  c.micro('mpcupos1', 'Cupos de Google', { ajustes: AJUSTES, tema: tm });
  c.d.titulos = [[/cupos de Google/, 'Cupos Google']];
  const l = X.orbitaLista_(JUAN), a = l.find(x => x.id === 'mpmpcupos1');
  ok(a && a.nombre === 'Cupos Google', '3 · el anillo se llama «' + (a && a.nombre) + '»');
  ok(X.microFilas_()[0].nombre === 'Cupos Google' && c.tema(tm).titulo === 'Cupos Google', '3 · el microproyecto y su tema toman ese mismo nombre');
  ok(!('mid' in a) && !('tema' in a) && Object.keys(a).sort().join() === 'desde,estado,id,nombre,paso,tipo', '3 · a la app solo van id, nombre, paso, tipo, estado y desde');
  const n = c.d.modelo.length; Object.keys(c.cache).filter(k => /_d$/.test(k)).forEach(k => delete c.cache[k]);
  X.orbitaLista_(JUAN); ok(c.d.modelo.length === n, '3 · el título se pide una vez');
  const sinModelo = caja(); delete sinModelo.X.claude_;
  const tm2 = sinModelo.X.temaCrear_(JUAN, { tipo: 'micro', titulo: 'Cupos de Google' }).id; sinModelo.micro('mpcupos1', 'Cupos de Google', { ajustes: AJUSTES, tema: tm2 });
  sinModelo.X.orbitaLista_(JUAN);
  ok(sinModelo.X.microFilas_()[0].nombre === 'Cupos de Google', '3 · sin modelo (el respaldo de 3 palabras) no se renombra nada');
}

/* 4 · orbitaExplicar_ busca también en lo que pidió. */
{ const c = caja(), X = c.X;
  c.micro('mpcupos1', 'Revisión de consumo', { ajustes: AJUSTES });
  const r = X.orbitaExplicar_(JUAN, 'cupos de Google');
  ok(r.ok && r.pedidos.length === 1 && r.pedidos[0].id === 'mpmpcupos1', '4 · «cupos de Google» encuentra el microproyecto aunque se llame «Revisión de consumo» (det.micro.pidio / x.texto)');
}

/* 5 · Pregunta de estado escrita o dicha. */
{ const c = caja(), X = c.X;
  const tm = X.temaCrear_(JUAN, { tipo: 'micro', titulo: 'Cupos de Google' }).id;
  c.micro('mpcupos1', 'Cupos de Google', { ajustes: AJUSTES, tema: tm });
  const e = X.orbitaEstadoPregunta_(JUAN, '¿Cómo estamos con los cupos de Google?');
  ok(e && e.o.estado && e.o.tema === tm && /PREGUNTA DE ESTADO sobre «Cupos de Google»/.test(e.nota) && /LO QUE YA SÉ: .*62 %/.test(e.nota) && /No es un pedido para Claude/.test(e.nota),
    '5 · «¿Cómo estamos con los cupos de Google?»: pregunta de estado con su estado y su tema');
  const g = X.orbitaEstadoPregunta_(JUAN, '¿Cómo va el cupo de Google hoy?');
  ok(g && g.o.estado && /cupo_google/.test(g.nota), '5 · algo con herramienta (cupo_google): la contesta Alma con sus herramientas de leer');
  ok(X.orbitaEstadoPregunta_(JUAN, '¿Cómo va lo del cupo? Y súbele el tope a 200') === null && X.orbitaEstadoPregunta_(JUAN, 'Cámbiale el color al botón del inicio') === null && X.orbitaEstadoPregunta_(JUAN, '¿Qué tal si cambias el botón a azul?') === null,
    '5 · con algo que hacer, o sin pregunta de estado, no');
  ok(/orbitaEstadoPregunta_\(adm, texto\)/.test(sacar(COD, 'opProcesar_')), '5 · opProcesar_ la revisa en el Hub, la app y WhatsApp');
}

/* 6 · La notificación lleva el mismo id y la página lo manda. */
{ const voz = leer('voz.js'), ctx = { String, Number, Object, Array, JSON, Math, RegExp,
    avisoHablarDe_: () => ({ nivel: 2, hablar: 'x', importante: true }), callePendDeAviso_: (p, id) => (p || []).find(x => x.id === id) || null, avisoLineas_: t => [String(t)] };
  vm.createContext(ctx); vm.runInContext(sacar(voz, 'vozAvisoSalida_'), ctx);
  const s1 = ctx.vozAvisoSalida_({ id: 'av1', ts: 1, texto: 'Listo', pedidos: ['mpmpcupos1'] }, [], [], 'Juan');
  const s2 = ctx.vozAvisoSalida_({ id: 'pd9', ts: 1, texto: 'Te pregunta algo' }, [], [{ id: 'pd9', titulo: 'x', resumen: 'y', tema_id: 'tm123' }], 'Juan');
  const s3 = ctx.vozAvisoSalida_({ id: 'av2', ts: 1, texto: 'Hola' }, [], [], 'Juan');
  ok(s1.orbita === 'mpmpcupos1' && s2.orbita === 'tm123' && !('orbita' in s3), '6 · el aviso lleva el id del anillo del que es resultado, o el tema de su tarjeta');
  ok(/if \(s\.orbita\) datos\.orbita = s\.orbita/.test(leer('pushapp.js')) && /var s = vozAvisoSalida_\(a, rets, pends, adm\.nombre\)/.test(sacar(leer('pushapp.js'), 'pushAppCuerpo_')), '6 · el push manda el mismo id en data.alma');
  const h = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8'), nav = fs.readFileSync(path.join(RAIZ, 'js', 'sa-nav.js'), 'utf8'), cli = fs.readFileSync(path.join(RAIZ, 'js', 'alma-client.js'), 'utf8');
  ok(/SANav\.chat\(\{ texto: pregunta\(x\), orbita: x \? x\.id : "" \}\)/.test(h) && /q\.orbita = o\.id/.test(nav) && /q\.orbita = String\(o\.orbita\)/.test(cli), '6 · tocar el anillo manda su id con el texto (inicio → sa-nav → alma-client → Hub)');
}

process.exit(fallo);
