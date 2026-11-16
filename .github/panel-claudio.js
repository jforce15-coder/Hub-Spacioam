/* Panel de Claudio (apps-script/claudiopanel.js y alma/inicio.html, #550; Juan, 16-nov-2026), con dobles de la hoja, de
   GitHub y de ElevenLabs. Revisa:
   1. A (la lista) al entrar con Claudio y con «qué están haciendo»; B (el trabajo) cuando se habla de uno o se pide uno;
      unir vuelve a la lista; leer código no cambia lo que se ve;
   2. los pasos son etapas por hechos (microproyecto, PR, revisiones, lo escalado): nunca un porcentaje inventado;
   3. la pregunta lleva el id «mp:<microproyecto>» y la página la responde por el camino de Pendientes (pendienteResponder);
   4. solo el administrador principal y solo en el modo Claudio (la candidata la dejan solo las herramientas de Claudio);
   5. nada sensible: sin enlaces, correos, teléfonos ni códigos en lo que se ve.
   node .github/panel-claudio.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const { armar } = require('./prompts-armados.js');
const a = armar(DIR), ctx = a._ctx, R = c => vm.runInContext(c, ctx);
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

let mem = {}, cache = {};
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty: k => { delete mem[k]; }, getKeys: () => Object.keys(mem) }) };
ctx.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; }, getAll: () => ({}), putAll() {} }) };
const JUAN = { email: 'juan@x', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, tels: ['50222220000'] };
const AHORA = Date.now(), M = R('MICRO_ESTADOS_');
const micro = (id, nombre, estado, o) => Object.assign({ id, nombre, estado, quien: 'juan@x', pr: '', ultima_pregunta: '', opciones: [], ajustes: [], actualizado: AHORA - 60000, creado: AHORA - 3600000 }, o || {});
let MICROS = [], PRS = [], ESC = [];
Object.assign(ctx, { adminsOp_: () => [JUAN, ANA], adminPorTel_: t => [JUAN, ANA].filter(x => String(t).slice(-8) === x.tels[0].slice(-8))[0] || null,
  vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : ses && ses.email === 'ana@x' ? ANA : null), esAdminPrincipal_: x => !!(x && x.principal),
  microAbiertos_: () => MICROS.slice(), prsAbiertos_: () => PRS, escalarEntregas_: () => ESC, opGuardar_: () => ({}) });
const pr = (n, titulo, estado, checks) => ({ repo: 'o/Hub-Spacioam', app: 'Hub', numero: n, titulo, url: 'https://github.com/o/Hub-Spacioam/pull/' + n, estado, fecha: new Date(AHORA - n * 1000).toISOString(), checks: checks || null });
const API = (ses, conv) => { ctx.SES_ = ses; ctx.B_ = { conv_id: conv || '' }; return R('claudioPanelApi_(SES_, B_)'); };
const sinPorcentaje = p => { const t = JSON.stringify(p); return !/%|porcentaje|progreso/i.test(t) && !/"(avance|progress)"/.test(t); };

/* Datos de ejemplo: un trabajo escribiendo, uno con pregunta, uno listo con revisiones en verde, uno con revisiones que
   fallaron, un cambio abierto sin microproyecto y uno que Alma escaló y está publicando. */
const base = () => {
  MICROS = [
    micro('mpA', 'Botón de facturas', M.listo, { pr: 'https://github.com/o/Hub-Spacioam/pull/12' }),
    micro('mpB', 'Reporte de limpieza', M.pregunta, { ultima_pregunta: '¿Lo quieres por propiedad o por día? Escríbeme a ana@correo.com o al +502 5555 1234', opciones: ['Por propiedad', 'Por día'] }),
    micro('mpC', 'Contactos de recepción', M.listo, { pr: 'https://github.com/o/Hub-Spacioam/pull/14' }),
    micro('mpD', 'Uber con Alma HM4K2Q9XAB', M.trabajo, {}),
    micro('mpE', 'Pagos de Amalfi', M.unido, { pr: 'https://github.com/o/Hub-Spacioam/pull/9' }),
    micro('mpF', 'Viejo cerrado', M.cerrado, {})
  ];
  PRS = [pr(12, 'Botón de facturas', 'revisando', { total: 12, ok: 7, corriendo: 5, fallas: 0 }), pr(14, 'Contactos de recepción', 'listo', { total: 12, ok: 12, corriendo: 0, fallas: 0 }),
    pr(20, 'Arreglo del calendario', 'fallo', { total: 10, ok: 8, corriendo: 0, fallas: 2 })];
  ESC = [{ id: 'esc1', micro: 'mpE', nombre: 'Pagos de Amalfi', email: 'juan@x', estado: 'publicando', t: AHORA - 7200000 }];
};

/* 1. Las vistas y cuándo cambian */
{ base(); cache = {};
  const p = API({ email: 'juan@x' }, 'conv_claudio1').panel;
  ok(p && p.tipo === 'claudio' && p.vista === 'lista' && p.clave === 'claudio:lista', 'A al entrar con Claudio: sin herramienta todavía, la lista de trabajos');
  const ids = p.trabajos.map(t => t.id);
  ok(ids[0] === 'mp:mpB' && p.trabajos[0].etapa === 'pregunta', 'A: el que pregunta va primero');
  ok(ids.indexOf('mp:mpF') < 0 && ids.indexOf('pr:Hub#12') < 0 && ids.indexOf('pr:Hub#14') < 0, 'A: lo cerrado no está y el PR de un microproyecto no se repite');
  ok(ids.indexOf('pr:Hub#20') >= 0 && ids.indexOf('mp:mpE') >= 0, 'A: los cambios abiertos sin microproyecto y lo que Alma escaló y está publicando también');
  const c = p.trabajos.filter(t => t.id === 'mp:mpC')[0], e = p.trabajos.filter(t => t.id === 'mp:mpE')[0];
  ok(c && c.une === true && c.etapa === 'listo' && /revisiones en verde/.test(c.paso), 'A: lo listo dice que está para unir con «une» (revisiones en verde)');
  ok(e && !e.une && e.sola && e.etapa === 'listo' && e.paso === 'Publicando', 'A: lo escalado no pide «une»: Alma lo une sola y va «Publicando»');
  ok(p.titulo === 'Trabajando en 6' && /1 te pregunta/.test(p.sub) && /1 listo para unir/.test(p.sub) && /1 falló/.test(p.sub), 'A: el título y el resumen cuentan lo que necesita a Juan');
  ok(Array.isArray(p.datos) && p.datos.length === p.trabajos.length && typeof p.id === 'string' && p.id.length > 3, 'A: con datos de respaldo para la app de antes y un id');
  ok(API({ email: 'juan@x' }, 'conv_claudio1').panel.id === p.id, 'el mismo contenido da el mismo id (la app no lo vuelve a armar)');

  /* Las herramientas de Claudio dejan la candidata, como tvCandidata_ para Alma */
  let conv = { tel: '50211110000', otro: true, agente: 'agent_claudio' }; ctx.vozWebConvInfo_ = () => conv;
  mem = { CLAUDIO_AGENT_ID: 'agent_claudio' };
  const H = (herr, b) => { ctx.HB_ = b; return R("claudioHerramienta_('" + herr + "', HB_)"); };
  const est = H('claudio_estado', { conv_id: 'conv_claudio1', trabajo: 'facturas' });
  ok(est.ok && est.del_que_habla && est.del_que_habla.nombre === 'Botón de facturas', 'claudio_estado con trabajo: Claudio sabe de cuál habla');
  const b = API({ email: 'juan@x' }, 'conv_claudio1').panel;
  ok(b.vista === 'trabajo' && b.titulo === 'Botón de facturas' && b.clave === 'claudio:trabajo:mp:mpA', 'B al hablar de un trabajo («facturas» → Botón de facturas)');
  const ps = b.trabajo.pasos.map(x => x.e).join(',');
  ok(ps === 'hecho,hecho,en_curso,pendiente' && b.trabajo.pasos[2].d === '7 de 12 revisiones en verde', 'B: sus pasos (hecho · en curso · pendiente) y las revisiones que GitHub cuenta de verdad');
  ok(b.listos.n === 1 && b.listos.nombres[0] === 'Contactos de recepción' && b.fallaron.n === 1 && b.fallaron.por_que === 'Sus revisiones fallaron', 'B: al lado, listos para unir y fallaron con su porqué');
  ok(b.pregunta && b.pregunta.id === 'mp:mpB' && b.pregunta.opciones.join('|') === 'Por propiedad|Por día', 'B: abajo la pregunta pendiente (de otro trabajo) con sus opciones');
  H('claudio_estado', { conv_id: 'conv_claudio1' });
  ok(API({ email: 'juan@x' }, 'conv_claudio1').panel.vista === 'lista', 'A con «qué están haciendo» (claudio_estado sin trabajo): se reemplaza el B');
  H('claudio_estado', { conv_id: 'conv_claudio1', trabajo: 'algo que no existe' });
  ok(API({ email: 'juan@x' }, 'conv_claudio1').panel.vista === 'lista', 'un trabajo que no existe: la lista (nunca uno equivocado)');
  H('claudio_estado', { conv_id: 'conv_claudio1', trabajo: '#20' });
  ok(API({ email: 'juan@x' }, 'conv_claudio1').panel.titulo === 'Arreglo del calendario', 'B también por su número');
  ctx.claudeMandarYa_ = () => { MICROS.unshift(micro('mpN', 'Color del botón', M.trabajo, { actualizado: AHORA })); return { texto: 'Listo, quedó pedido.', claude: { ok: true, micro: 'mpN' } }; };
  H('claudio_pedido', { conv_id: 'conv_claudio1', pedido: 'que el botón sea naranja', confirmado: true });
  const nb = API({ email: 'juan@x' }, 'conv_claudio1').panel;
  ok(nb.vista === 'trabajo' && nb.titulo === 'Color del botón' && nb.trabajo.etapa === 'escribiendo', 'B del pedido que se acaba de crear (escribiendo)');
  ctx.claudioCodigo_ = () => ({ ok: true });
  H('claudio_codigo', { conv_id: 'conv_claudio1', buscar: 'orbita' });
  ok(API({ email: 'juan@x' }, 'conv_claudio1').panel.clave === nb.clave, 'leer código no cambia lo que se ve');
  ctx.unirCambio_ = () => ({ ok: true, unidos: [] });
  H('claudio_unir', { conv_id: 'conv_claudio1', dijo: 'une', cual: 'todos' });
  ok(API({ email: 'juan@x' }, 'conv_claudio1').panel.vista === 'lista', 'después de unir: la lista al día');
}

/* 2. Pasos reales o etapa; nunca un porcentaje */
{ base(); cache = {};
  const p = API({ email: 'juan@x' }, 'conv_x').panel;
  ok(sinPorcentaje(p), 'A sin porcentajes (ni «progreso» ni «avance»)');
  ok(p.trabajos.every(t => ['escribiendo', 'revisando', 'listo', 'fallo', 'pregunta'].indexOf(t.etapa) >= 0 && t.total >= 4 && t.indice >= 0 && t.indice < t.total), 'cada trabajo trae su etapa (escribiendo, revisando, listo, falló o te pregunta) y en qué paso va de una lista fija');
  const d = p.trabajos.filter(t => t.id === 'mp:mpD')[0];
  ok(d && d.etapa === 'escribiendo' && d.pasos.join(',') === 'hecho,en_curso,pendiente,pendiente', 'sin PR: «Escribiendo el cambio» en curso, lo demás pendiente');
  const f = p.trabajos.filter(t => t.id === 'pr:Hub#20')[0];
  ok(f && f.etapa === 'fallo' && f.pasos[2] === 'fallo' && /Falló/.test(f.paso), 'revisiones en rojo: el paso falló, con su porqué');
  MICROS.push(micro('mpG', 'Algo difícil', M.pregunta, { ultima_pregunta: 'Claudio no pudo: falta la llave de AirLabs' }));
  const g = API({ email: 'juan@x' }, 'conv_x').panel.trabajos.filter(t => t.id === 'mp:mpG')[0];
  ok(g && g.etapa === 'fallo' && !g.pregunta, '«Claudio no pudo» es un fallo, no una pregunta');
  ok(!/function claudio[\s\S]*?(\* ?100|porcentaje)/.test(leer('claudiopanel.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'el Hub no calcula porcentajes');
  PRS = null; ctx.prsAbiertos_ = () => null;
  const sg = API({ email: 'juan@x' }, 'conv_x').panel;
  ok(sg.aviso && sg.trabajos.some(t => t.id === 'mp:mpA'), 'sin respuesta de GitHub: lo dice y muestra lo que sabe de la hoja');
  ctx.prsAbiertos_ = () => PRS; }

/* 3. La pregunta tocable responde por el camino de Pendientes */
{ base(); cache = {};
  const q = API({ email: 'juan@x' }, 'conv_x').panel.trabajos[0].pregunta;
  ok(q && q.id === 'mp:mpB' && q.opciones.length === 2, 'la pregunta trae el id del microproyecto («mp:…») y sus opciones');
  const pend = leer('pendientes.js');
  ok(/if \(\/\^mp:\/\.test\(id\)\) return microResponder_\(adm, id\.slice\(3\), texto\)/.test(pend), 'pendienteResponder con «mp:…» responde a ese microproyecto (microResponder_)');
  const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  const mod = (html.match(/\/\* ── Panel de Claudio \(#550[^\n]*── Mientras[\s\S]*?\/\* ── fin del Panel de Claudio ── \*\//) || [''])[0];
  ok(mod.length > 1500, 'el panel vive en alma/inicio.html');
  ok(/ALMA\.pendienteResponder\(p\.id, op\)/.test(mod), 'tocar una opción llama a pendienteResponder con el id de la pregunta (el mismo camino de la tarjeta de Pendientes)');
  ok(!/"%"|\+ ?"%"|porcentaje|progreso/.test(mod.replace(/\/\*[\s\S]*?\*\//g, '')), 'la página no inventa porcentajes (la barra son los pasos)');
  ok(/Di «une» para publicarlo/.test(mod), 'lo listo dice «Di "une" para publicarlo»'); }

/* 4. Solo el principal y solo en el modo Claudio */
{ base(); cache = {};
  ok(API({ email: 'ana@x' }, 'conv_x').ok === false, 'otro administrador: no hay panel');
  ok(API(null, 'conv_x').ok === false, 'sin sesión verificada: no hay panel (tampoco con la llave antigua)');
  cache['claudio_conv_ajena'] = '50299990000';
  ok(API({ email: 'juan@x' }, 'conv_ajena').ok === false, 'la conversación de Claudio de otro teléfono no se mira');
  let conv = { tel: '50222220000', otro: true, agente: 'agent_claudio' }; ctx.vozWebConvInfo_ = () => conv; mem = { CLAUDIO_AGENT_ID: 'agent_claudio' };
  ctx.HB_ = { conv_id: 'conv_ana', trabajo: 'facturas' }; R("claudioHerramienta_('claudio_estado', HB_)");
  ok(!('claudiopanel_conv_ana' in cache), 'una herramienta de Claudio que no es del principal no deja candidata');
  const usos = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && /claudiopanel_|claudioPanelCandidata_\(/.test(leer(f)));
  ok(usos.sort().join(',') === 'claudio.js,claudiopanel.js', 'la candidata solo la dejan las herramientas de Claudio (claudio.js), nunca Alma, el chat ni WhatsApp');
  ok(/case 'vozClaudioPanel': return json_\(claudioPanelApi_\(ses, body\)\)/.test(leer('Código.js')), 'la acción vozClaudioPanel usa la sesión verificada');
  ok(/voz: '[^']*\bvozClaudioPanel\b/.test(leer('cupo.js')), 'vozClaudioPanel cuenta como voz en el cupo'); }

/* 5. Nada sensible en lo que se ve */
{ base(); cache = {};
  const t = JSON.stringify(API({ email: 'juan@x' }, 'conv_x').panel);
  ok(!/@|https?:|\+?502|5555|HM4K2Q9XAB/.test(t), 'sin correos, enlaces, teléfonos ni códigos de reserva');
  ok(/Uber con Alma/.test(t) && /Por propiedad o por día|por propiedad o por día/.test(t), 'el resto del nombre y la pregunta quedan'); }

if (!fallo) console.log('Todo bien: el Panel de Claudio, A y B por estado, sin porcentajes y solo con el principal.');
process.exit(fallo);
