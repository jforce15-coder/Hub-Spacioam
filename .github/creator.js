/* Modo Creator (apps-script/creator.js, #770; Juan, 18-nov-2026), con dobles de Anthropic, GitHub, Sheets y la caché:
   sin internet. Revisa:
   1. los reemplazos se aplican todo o nada (cada «buscar» una sola vez; sin fijarse en espacios si no está tal cual);
   2. solo las apps de la lista y archivos .html de su repo (sin «..»);
   3. lo que se pinta lleva la base del dominio de la app, nunca sa-sesion.js, y un guardia que no deja salir del marco;
   4. un cambio guarda una versión del archivo que se ve; si el modelo copia mal, prueba una vez más y si no, nada;
   5. BORRADOR vs EN VIVO: navegar muestra el borrador de lo que cambió y lo en vivo de lo demás; se dice qué cambió y
      cuántos cambios faltan por publicar; «en vivo» se puede pedir para comparar;
   6. deshacer vuelve a la versión madre (o a la que diga) sin borrar nada;
   7. publicar va en dos pasos: preparar (UN pedido normal con la app, los archivos y las versiones a leer; nada se
      escribe en GitHub) y, ya listo, publicar (une ese PR; por voz solo si Juan dijo «publícalo»); cambiar algo después
      de pedirlo lo devuelve a borrador;
   8. solo el administrador principal; la pantalla pregunta barato (sello en caché: sin hojas si nada cambió);
   9. Claudio tiene claudio_creator y el resultado avisa a la app;
  10. el enrutador: reglas y el modelo básico deciden el escalón (básico · medio · avanzado con tope diario), sube un
      escalón una sola vez si falla, modelos y tope en Propiedades, y cada llamada queda en IA_USO por escalón;
  11. datos reales en solo lectura: el marco trae una llave de lectura (nunca la sesión); el Hub solo le contesta lecturas;
  12. la barrera: lo que escribe se detiene en el marco y pide aprobación; aprobar lo anota (sin valores), una vez;
  13. toca datos: el borrador que agrega escrituras o el PR que toca apps-script/ lleva etiqueta y título «toca datos», no
      se une con «todos» ni por Alma, y Publicar pide confirmación aparte (nunca por voz).
   node .github/creator.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const { armar } = require('./prompts-armados.js');
const a = armar(DIR), ctx = a._ctx, R = c => vm.runInContext(c, ctx);

/* Dobles: hojas en memoria, caché, propiedades y un uf_ que anota todo lo que sale. */
const hojas = {}; let lecturas = 0;
function hoja(nombre, cab) {
  if (!hojas[nombre]) { const filas = [cab.slice()];
    hojas[nombre] = { filas, getLastRow: () => filas.length, getLastColumn: () => cab.length, appendRow: r => { filas.push(r.slice()); },
      getRange: (r, c, nr, nc) => ({ getValues: () => { lecturas++; return Array.from({ length: nr || 1 }, (_, i) => Array.from({ length: nc || 1 }, (_, j) => (filas[r - 1 + i] || [])[c - 1 + j] ?? '')); },
        setValues: v => v.forEach((row, i) => row.forEach((x, j) => { filas[r - 1 + i] = filas[r - 1 + i] || []; filas[r - 1 + i][c - 1 + j] = x; })) }) }; }
  return hojas[nombre];
}
let mem = { ANTHROPIC_KEY: 'k' }, cache = {}, salidas = [], pedidos = [], unidos = [], micro = null, resp = () => ({ codigo: 404, cuerpo: '' });
ctx.hojaCrear_ = hoja;
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); } }) };
ctx.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) };
ctx.uf_ = (url, o) => { o = o || {}; const s = { url: String(url), metodo: String(o.method || 'get').toLowerCase(), cuerpo: o.payload ? JSON.parse(o.payload) : null, headers: o.headers || {} }; salidas.push(s); const r = resp(s);
  return { getResponseCode: () => r.codigo, getContentText: () => (typeof r.cuerpo === 'string' ? r.cuerpo : JSON.stringify(r.cuerpo)) }; };
ctx.registrarUso_ = () => {};
const JUAN = { email: 'juan@x', nombre: 'Juan Prueba', principal: true, tels: ['50211110000'] };
const ANA = { email: 'ana@x', nombre: 'Ana', principal: false, tels: ['50222220000'] };
Object.assign(ctx, { adminsOp_: () => [JUAN, ANA], vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : ses && ses.email === 'ana@x' ? ANA : null),
  claudeMandarYa_: (adm, texto, o) => { pedidos.push({ texto, o }); return { texto: 'Quedó pedido.', claude: { ok: true, micro: 'mpcreator1' } }; },
  microLeer_: id => (id === 'mpcreator1' ? micro : null), unirCambio_: cual => { unidos.push(cual); return { ok: true, unidos: [{ pr: cual }] }; } });
const LISTA = '<!doctype html><html><head>\n<script src="https://hub.spacioam.com/js/sa-sesion.js"></script>\n<title>Prueba</title>\n<style>\n  h1 { font-size: 24px; }\n</style></head><body><h1>Llegadas de hoy</h1><p>Hola</p><p>Hola</p><a href="creator-prueba-detalle.html">Ver</a></body></html>';
const DETALLE = '<!doctype html><html><head><title>Detalle</title><style>h1{color:#333}</style></head><body><h1>Departamento 1104</h1></body></html>';
const MI = '<!doctype html><html><head><title>Mi</title></head><body><h1>Mi</h1></body></html>';
let respuestas = [];
let clasifica = [];   // lo que contesta el enrutador (modelo básico) cuando las reglas no alcanzan
const red = s => /api\.anthropic\.com/.test(s.url) && /Clasificador/.test(String(s.cuerpo.system || '')) ? { codigo: 200, cuerpo: { model: s.cuerpo.model, usage: { input_tokens: 5, output_tokens: 2 }, content: [{ type: 'text', text: JSON.stringify({ escalon: clasifica.length ? clasifica.shift() : 1 }) }] } }
  : /api\.anthropic\.com/.test(s.url) ? { codigo: 200, cuerpo: { model: s.cuerpo.model, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(respuestas.shift() || { resumen: 'nada', cambios: [] }) }] } }
  : /Hub-Spacioam\/main\/alma\/creator-prueba\.html$/.test(s.url) ? { codigo: 200, cuerpo: LISTA }
  : /Hub-Spacioam\/main\/alma\/creator-prueba-detalle\.html$/.test(s.url) ? { codigo: 200, cuerpo: DETALLE }
  : /mi-spacioam\/main\/index\.html$/.test(s.url) ? { codigo: 200, cuerpo: MI } : { codigo: 404, cuerpo: '' };

/* 1. Reemplazos */
{ const ap = (h, c) => R('creatorAplicar_')(h, c);
  let r = ap('<h1>Hola</h1><p>x</p>', [{ buscar: '<h1>Hola</h1>', reemplazar: '<h1 class="t">Hola</h1>' }]);
  ok(r.ok && r.html === '<h1 class="t">Hola</h1><p>x</p>' && r.hechos === 1, '1 · un reemplazo exacto');
  r = ap('<p>a</p><p>a</p>', [{ buscar: '<p>a</p>', reemplazar: '<p>b</p>' }]);
  ok(!r.ok && r.fallos[0].por === 'repetido' && r.html === '<p>a</p><p>a</p>', '1 · un «buscar» repetido no cambia nada (no adivina cuál)');
  r = ap('<h1>Hola</h1>', [{ buscar: '<h1>Hola</h1>', reemplazar: '<h1>Adiós</h1>' }, { buscar: '<h2>no</h2>', reemplazar: '' }]);
  ok(!r.ok && r.html === '<h1>Hola</h1>', '1 · todo o nada: si uno no está, no se aplica ninguno');
  r = ap('h1 {\n    font-size: 24px;\n}', [{ buscar: 'h1 {\n  font-size: 24px;\n}', reemplazar: 'h1 { font-size: 40px; }' }]);
  ok(r.ok && r.html === 'h1 { font-size: 40px; }', '1 · si solo cambia la sangría, igual lo encuentra'); }

/* 2. Apps y pantallas */
{ const app = x => R('creatorApp_')(x), pag = (a, x) => R('creatorPagina_')(a, x);
  ok(app('') === 'hub' && app('Mi') === 'mi' && app('la app de Epi') === 'epi' && app('el Hub') === 'hub' && app('docs') === 'docs', '2 · las apps que Juan nombra');
  ok(app('facebook') === '' && app('alma-app') === '', '2 · una app que no está en la lista: no');
  ok(pag('hub', '') === 'alma/creator-prueba.html' && pag('hub', 'inicio') === 'alma/inicio.html' && pag('mi', '') === 'index.html', '2 · cada app empieza en su pantalla (el Hub, en la de prueba)');
  ok(pag('mi', 'https://mi.spacioam.com/reservas/') === 'reservas/index.html' && pag('hub', '/alma/creator-prueba-detalle.html') === 'alma/creator-prueba-detalle.html', '2 · una dirección de su dominio o una ruta, a su archivo');
  ok(pag('hub', '../apps-script/llaves.js') === '' && pag('hub', 'alma/../../x.html') === '' && pag('mi', 'https://hub.spacioam.com/x.html') === '' && pag('hub', 'apps-script/llaves.js') === '', '2 · nada fuera de los .html de esa app'); }

/* 3. Lo que se pinta */
{ const p = R('creatorParaPintar_')(LISTA, 'hub', 'alma/creator-prueba.html');
  ok(/<head><base href="https:\/\/hub\.spacioam\.com\/alma\/">/.test(p), '3 · la base del dominio de la app va primero (los archivos relativos cargan de lo en vivo)');
  ok(!/sa-sesion/.test(p) && /<title>Prueba<\/title>/.test(p), '3 · el borrador nunca carga sa-sesion.js (sin la sesión de Juan)');
  ok(/parent\.postMessage\(\{creator:"ir"/.test(p) && /e\.preventDefault\(\)/.test(p) && /"hub\.spacioam\.com"/.test(p), '3 · un enlace no sale del marco: la misma app se pide a la pantalla; otro sitio no se abre');
  ok(/base href="https:\/\/mi\.spacioam\.com\/"/.test(R('creatorParaPintar_')(MI, 'mi', 'index.html')), '3 · otra app, con su propio dominio');
  const html = fs.readFileSync(path.join(DIR, '..', 'alma', 'creator.html'), 'utf8');
  ok(/setAttribute\("sandbox", "allow-scripts"\)/.test(html) && !/allow-same-origin|allow-top-navigation|allow-forms/.test(html), '3 · alma/creator.html pinta en un marco aislado (sin mismo origen, sin salir, sin formularios)');
  ok(/BORRADOR · no publicado/.test(html) && /EN VIVO/.test(html), '3 · la pantalla dice siempre si es BORRADOR o EN VIVO'); }

const ses = { email: 'juan@x' }, act = () => R('creatorActivo_')('juan@x');
{ resp = red; salidas = [];
  /* 4. Cambios */
  const v0 = R('creatorVerApi_')(ses, {});
  ok(v0.ok && v0.creator.app === 'hub' && v0.creator.pagina === 'alma/creator-prueba.html' && v0.creator.actual === 0 && v0.creator.estado === 'borrador' && /Llegadas de hoy/.test(v0.html) && v0.sin_publicar === 0, '4 · sin nada abierto: el Hub en la página de prueba, en borrador y sin cambios');
  respuestas = [{ resumen: 'Puse el título más grande.', cambios: [{ buscar: 'h1 { font-size: 24px; }', reemplazar: 'h1 { font-size: 40px; }' }] }];
  const c1 = R('creatorAccionApi_')(ses, 'creatorCambiar', { texto: 'haz el título más grande' });
  ok(c1.ok && c1.version === 1 && /Listo, mira/.test(c1.resultado) && /aún no está en vivo/.test(c1.resultado), '4 · un cambio guarda la versión 1; Claudio dice «Listo, mira.» y sabe que no está en vivo');
  const ll = salidas.filter(s => /anthropic/.test(s.url)).pop();
  ok(ll.cuerpo.model === 'claude-haiku-5-5' && !ll.cuerpo.fallbacks && c1.escalon === 'básico', '4 · enrutador: «el título más grande» es simple → modelo básico (Haiku), sin pasar por el caro');
  respuestas = [{ resumen: 'Animé.', cambios: [] }];
  const r1b = R('creatorRuta_')('agrega una animación a las tarjetas al pasar el dedo');
  R('creatorPedirAlModelo_')('<p>x</p>', 'anima', [], r1b);
  const llm = salidas.filter(s => /anthropic/.test(s.url)).pop();
  ok(r1b.escalon === 1 && r1b.por === 'reglas' && llm.cuerpo.model === 'claude-sonnet-5-5' && llm.cuerpo.output_config.effort === 'low' && llm.cuerpo.output_config.format.type === 'json_schema' && llm.cuerpo.fallbacks === 'default' && llm.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', '4 · escalón medio (componente, animación): Sonnet 5.5, esfuerzo bajo, salida JSON y respaldo si un clasificador declina');
  ok(/<pantalla>[\s\S]*Llegadas de hoy/.test(ll.cuerpo.messages[0].content[0].text) && JSON.parse(ll.cuerpo.system[0].text).formato_de_respuesta, '4 · le llega la pantalla y el prompt en JSON (rol, tarea, contexto, pasos, restricciones, formato)');
  mem.CREATOR_MODELO = 'claude-haiku-5-5';
  respuestas = [{ resumen: 'Le puse vidrio.', cambios: [{ buscar: '</style>', reemplazar: '.v{backdrop-filter:blur(20px)}</style>' }] }];
  const c2 = R('creatorCambiar_')(JUAN, 'ponle vidrio esmerilado', 'voz'), ll2 = salidas.filter(s => /anthropic/.test(s.url)).pop();
  ok(c2.ok && c2.version === 2 && ll2.cuerpo.model === 'claude-haiku-5-5' && !ll2.cuerpo.fallbacks && /Pedidos anteriores[^\n]*haz el título más grande/.test(ll2.cuerpo.messages[0].content[1].text), '4 · CREATOR_MODELO cambia el modelo sin PR; el modelo sabe lo ya pedido en esa pantalla');
  delete mem.CREATOR_MODELO;
  const nA = salidas.filter(s => /anthropic/.test(s.url)).length;
  respuestas = [{ resumen: 'x', cambios: [{ buscar: '<p>Hola</p>', reemplazar: '<p>Adiós</p>' }] }, { resumen: 'x', cambios: [{ buscar: '<h2>nada</h2>', reemplazar: '' }] }];
  const c3 = R('creatorCambiar_')(JUAN, 'cambia el saludo', 'voz');
  ok(!c3.ok && /^NO CAMBIÓ NADA/.test(c3.error) && salidas.filter(s => /anthropic/.test(s.url)).length === nA + 3 && act().actual === 2, '4 · si copia mal, prueba una vez más; si tampoco, no guarda nada y lo dice');
  { const m3 = salidas.filter(s => /anthropic/.test(s.url)).slice(-3).map(s => s.cuerpo.model);
    ok(m3[0] === 'claude-haiku-5-5' && m3[1] === 'claude-sonnet-5-5' && m3[2] === 'claude-opus-5-5', '10 · sin regla: clasifica el básico (nunca el caro) → medio; falló al aplicar → sube UN escalón una sola vez (avanzado)'); }
  ok(!R('creatorCambiar_')(JUAN, 'pon ' + ['sk', 'ant', 'api03', 'abcdefghijklmnopqrstuvwxyz'].join('-'), 'voz').ok, '4 · algo que parece una llave no viaja al modelo');

  /* 5. Navegar: borrador vs en vivo */
  const ir = R('creatorAccionApi_')(ses, 'creatorIr', { ruta: '/alma/creator-prueba-detalle.html' });
  const vd = R('creatorVerApi_')(ses, { vivo: true });
  ok(ir.ok && vd.creator.pagina === 'alma/creator-prueba-detalle.html' && /Departamento 1104/.test(vd.html) && !vd.pagina_cambiada, '5 · un toque en un enlace abre la otra pantalla; sin cambios, es la en vivo');
  ok(vd.cambiados.join() === 'alma/creator-prueba.html' && vd.sin_publicar === 2, '5 · dice qué pantalla cambió y cuántos cambios faltan por publicar');
  ok(!R('creatorAccionApi_')(ses, 'creatorIr', { ruta: 'https://otro.com/x.html' }).ok, '5 · no se navega fuera de la app');
  respuestas = [{ resumen: 'Título en durazno.', cambios: [{ buscar: 'h1{color:#333}', reemplazar: 'h1{color:#E9826A}' }] }];
  const c4 = R('creatorCambiar_')(JUAN, 'el título en durazno', 'voz');
  R('creatorIr_')(JUAN, 'alma/creator-prueba.html');
  const vl = R('creatorVerApi_')(ses, { vivo: true });
  ok(c4.ok && c4.version === 3 && vl.pagina_cambiada && /font-size: 40px/.test(vl.html) && /backdrop-filter/.test(vl.html) && /font-size: 24px/.test(vl.html_vivo) && !/backdrop/.test(vl.html_vivo), '5 · de vuelta en la lista: el borrador trae sus cambios y «en vivo» la de hoy, para comparar');
  ok(vl.cambiados.length === 2 && vl.versiones.filter(x => x.en_borrador).length === 3, '5 · dos pantallas cambiadas, tres cambios en el borrador');

  /* 6. Deshacer */
  const d1 = R('creatorAccionApi_')(ses, 'creatorCambiar', { texto: 'regresa a la anterior' });
  ok(d1.ok && d1.version === 2 && act().pagina === 'alma/creator-prueba-detalle.html', '6 · «regresa a la anterior» (escrito) quita el último cambio y muestra la pantalla donde se quitó');
  ok(R('creatorVerApi_')(ses, {}).cambiados.join() === 'alma/creator-prueba.html', '6 · el detalle vuelve a estar igual que en vivo');
  ok(R('creatorDeshacer_')(JUAN, 9).ok === false, '6 · una versión que no existe: lo dice');
  ok(R('creatorDeshacer_')(JUAN, 3).ok && R('creatorVersiones_')(act().id).length === 3, '6 · se puede volver a cualquier versión: nada se borra');

  /* 8. Barato y solo el principal */
  const s1 = R('creatorVerApi_')(ses, {}); lecturas = 0;
  const s2 = R('creatorVerApi_')(ses, { desde: s1.sello });
  ok(s2.ok && s2.igual && lecturas === 0 && !s2.html, '8 · creatorVer con el sello de siempre: sin leer hojas ni mandar la pantalla');
  ok(R('creatorVerApi_')({ email: 'ana@x' }, {}).ok === false && R('creatorAccionApi_')({ email: 'ana@x' }, 'creatorCambiar', { texto: 'x' }).ok === false && R('creatorVerApi_')(null, {}).ok === false, '8 · solo el administrador principal, con su sesión');

  /* 7. Publicar en dos pasos */
  ok(R('creatorSubeloEsMio_')(JUAN), '7 · recién tocado y en borrador: «súbelo» es del Modo Creator');
  salidas = [];
  const p1 = R('creatorAccionApi_')(ses, 'creatorPublicar', {});
  const id = act().id;
  ok(p1.ok && act().estado === 'preparando' && pedidos.length === 1 && unidos.length === 0, '7 · paso 1: «Preparar para publicar» manda UN pedido y no une nada');
  ok(/Hub-Spacioam/.test(pedidos[0].texto) && new RegExp('creator-prueba\\.html» con \\{"action": "creator_leer", "creator": "' + id + '", "v": 2\\}').test(pedidos[0].texto) && new RegExp('"creator": "' + id + '", "v": 3').test(pedidos[0].texto) && /capturas antes y después/.test(pedidos[0].texto), '7 · el pedido lleva la app, cada archivo con su versión a leer y las capturas');
  ok(!salidas.some(s => /github/.test(s.url) && s.metodo !== 'get'), '7 · nada se escribe en GitHub desde el Modo Creator');
  ok(/BORRADOR/.test(p1.resultado) && R('creatorPublicar_')(JUAN, 'publícalo', true).estado === 'preparando' && unidos.length === 0, '7 · mientras se prepara sigue en BORRADOR y no se puede publicar');
  micro = { id: 'mpcreator1', estado: R('MICRO_ESTADOS_').listo, pr: 'https://github.com/jforce15-coder/Hub-Spacioam/pull/900' }; delete cache['creator_mira_' + id];
  const vListo = R('creatorVerApi_')(ses, {});
  ok(vListo.creator.estado === 'listo' && /pull\/900/.test(vListo.creator.pr), '7 · cuando su PR queda listo, la pantalla lo dice (listo para publicar)');
  ok(!R('creatorPublicar_')(JUAN, '¿ya está?', true).ok && unidos.length === 0, '7 · por voz, sin «publícalo», no publica');
  const pub = R('creatorAccionApi_')(ses, 'creatorPublicar', {});
  ok(pub.ok && unidos.length === 1 && unidos[0] === micro.pr && act().estado === 'publicado', '7 · paso 2: «Publicar» une ese PR (su «une») y queda publicado');
  respuestas = [{ resumen: 'Botón.', cambios: [{ buscar: '<p>Hola</p><p>Hola</p>', reemplazar: '<p>Hola</p><button>Ver</button>' }] }];
  R('creatorIr_')(JUAN, 'alma/creator-prueba.html');
  const c5 = R('creatorCambiar_')(JUAN, 'agrega un botón', 'voz');
  ok(c5.ok && act().estado === 'borrador' && !act().micro, '7 · un cambio después vuelve a ser borrador (sin publicar)');
  const lee = R('creatorRobot_')({ action: 'creator_leer', creator: id, v: 1 });
  ok(lee.ok && /font-size: 40px/.test(lee.html) && /sa-sesion\.js/.test(lee.html), '7 · el robot lee la versión tal cual (lo que se publica es el archivo, sin lo de la vista previa)');
  const claudio = fs.readFileSync(path.join(DIR, 'claudio.js'), 'utf8');
  ok(/if \(subir && !trabajo && creatorSubeloEsMio_\(adm\)\) return claudioCreatorHerr_\(adm, \{ accion: 'publicar', dijo: texto \}\)/.test(claudio), '7 · claudio_responder: un «súbelo» con el Modo Creator recién tocado es prepararlo para publicar'); }

/* Otra app */
{ const ab = R('creatorAbrir_')(JUAN, 'Mi', '');
  ok(ab.ok && act().app === 'mi' && act().pagina === 'index.html' && act().actual === 0, '5 · «abre Mi»: otra app empieza su propio borrador, en su pantalla principal'); }

/* 9. Claudio y la app */
{ const defs = R("claudioDefHerramientas_('B')"), t = defs.filter(d => d.name === 'claudio_creator')[0];
  ok(t && t.type === 'webhook' && R('CLAUDIO_HERR_').indexOf('claudio_creator') >= 0 && t.api_schema.request_body_schema.properties.accion.enum.join() === 'cambiar,deshacer,abrir,publicar' && t.response_timeout_secs >= 30, '9 · Claudio tiene claudio_creator (cambiar, deshacer, abrir, publicar) y espera lo que tarda el modelo');
  ok(R('CLAUDIO_ACC_PANTALLAS_').creator && R('CLAUDIO_ACC_PANTALLAS_').creator.u === 'creator.html', '9 · una acción de Claudio puede llevar al Modo Creator');
  const r = R('claudioEjecutar_')(JUAN, 'claudio_creator', { conv_id: 'conv_1', accion: 'abrir', app: 'mi' });
  ok(r.ok && r.creator === true, '9 · el resultado avisa a la app que abra el Modo Creator'); }

/* 10. El enrutador */
{ const E = (t, o) => R('creatorEnrutar_')(t, Object.assign({ queda_avanzado: true, clasificar: () => null }, o || {}));
  ok(E('el título más grande').escalon === 0 && E('ponlo en durazno').escalon === 0 && E('cambia el texto del botón').escalon === 0, '10 · simple (color, texto, tamaño) → básico, por reglas');
  ok(E('agrega una lista de llegadas con filtro').escalon === 1 && E('ponle vidrio esmerilado').escalon === 1, '10 · componente o lógica de pantalla → medio');
  ok(E('rediseño completo de todas las pantallas').escalon === 2 && E('rediseño completo de todas las pantallas', { queda_avanzado: false }).escalon === 1, '10 · avanzado solo con señales claras, y con el tope diario lleno baja a medio');
  let pregunto = 0; const q = E('mejóralo', { clasificar: () => { pregunto++; return 0; } });
  ok(pregunto === 1 && q.escalon === 0 && q.por === 'básico' && E('mejóralo', { clasificar: () => 2 }).escalon === 1, '10 · sin regla, decide el básico (0 o 1; nunca sube al avanzado él solo)');
  mem.CREATOR_MODELO_BASICO = 'claude-haiku-9'; mem.CREATOR_TOPE_AVANZADO = '1'; delete mem.CREATOR_AVANZADO_HOY;
  ok(R('creatorRuta_')('el título más grande').modelo === 'claude-haiku-9', '10 · los modelos se cambian sin PR (CREATOR_MODELO_BASICO/MEDIO/AVANZADO)');
  const a1 = R('creatorRuta_')('toda la app desde cero'), a2 = R('creatorRuta_')('toda la app desde cero');
  ok(a1.escalon === 2 && a2.escalon === 1 && JSON.parse(mem.CREATOR_AVANZADO_HOY).n === 1, '10 · CREATOR_TOPE_AVANZADO: el avanzado se cuenta por día y al llegar al tope usa el medio');
  mem.CREATOR_ENRUTADOR = '0'; ok(R('creatorRuta_')('el título más grande').escalon === 1, '10 · CREATOR_ENRUTADOR = 0 lo apaga (medio, como antes)');
  delete mem.CREATOR_ENRUTADOR; delete mem.CREATOR_MODELO_BASICO; delete mem.CREATOR_TOPE_AVANZADO; delete mem.CREATOR_AVANZADO_HOY;
  const usos = []; const reg0 = ctx.registrarUso_; ctx.registrarUso_ = o => usos.push(o);
  R('creatorPedirAlModelo_')('<p>x</p>', 'x', [], R('creatorRuta_')('el título más grande'));
  ctx.registrarUso_ = reg0;
  ok(usos.length === 1 && usos[0].funcion === 'Modo Creator · básico' && /cambio simple/.test(usos[0].detalle), '10 · cada pedido queda en IA_USO con su escalón y por qué (Gasto de Alma lo mide)'); }

/* 11 y 12. Datos reales en solo lectura y la barrera */
{ let n = 0; ctx.Utilities.getUuid = () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(++n).padStart(12, '0');
  const SES = { email: 'juan@x', nombre: 'Juan Prueba' };
  const t = R('creatorLecturaLlave_')(SES);
  ok(/^crlec_[a-f0-9]{32}$/.test(t) && t.indexOf('.') < 0 && R('creatorLecturaLlave_')(SES) === t, '11 · la llave de lectura no tiene punto (ningún login la toma por sesión) y se reusa');
  ok(R('creatorLecturaPuerta_')({ action: 'cola', session: 'abc.def' }) === null, '11 · una sesión de verdad no pasa por la puerta');
  const lee = R('creatorLecturaPuerta_')({ hub: 1, action: 'cola', session: t });
  ok(lee && lee.ses && lee.ses.email === 'juan@x' && !lee.salida, '11 · con la llave, una lectura («cola») se contesta con los datos de Juan');
  const esc = ['enviarAhora', 'responderWa', 'programar', 'setAuto', 'resolver', 'calendarioVisto', 'llaveGuardar', 'creatorCambiar', 'creatorAprobar', 'loQueSea'].map(a => R('creatorLecturaPuerta_')({ hub: 1, action: a, session: t }));
  ok(esc.every(x => x && x.salida && x.salida.creator_bloqueo && !x.ses), '11 · con la llave, lo que escribe (o no está en la lista) vuelve como creator_bloqueo, sin tocar nada');
  ok(R('creatorLecturaPuerta_')({ hub: 1, action: 'correos', session: t }).ses && R('creatorLecturaPuerta_')({ hub: 1, action: 'correos', accion: 'hacer', session: t }).salida &&
    R('creatorLecturaPuerta_')({ hub: 1, action: 'decision', op: 'elegir', session: t }).salida, '11 · las que leen y escriben según sus campos: solo su forma de leer');
  ok(R('creatorLecturaPuerta_')({ hub: 1, action: 'cola', session: 'crlec_ffffffffffffffffffffffffffffffff' }).salida.creator_vencido, '11 · una llave vencida o inventada no lee nada');
  const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), ih = cod.indexOf('function hubApi_('), ip = cod.indexOf('creatorLecturaPuerta_(body)', ih), is = cod.indexOf('sesionLogin_(body.session)', ih);
  ok(ip > ih && ip < is && /if \(lec && lec\.salida\) return json_\(lec\.salida\)/.test(cod), '11 · hubApi_ pasa por la puerta antes de cualquier acción');
  const v = R('creatorVerApi_')(ses, {});
  ok(v.ok && v.html.indexOf(t) > 0 && !/sa-sesion\.js/.test(v.html) && /window\.SASesion=/.test(v.html) && v.datos === 'reales · solo lectura', '11 · el borrador se pinta con la llave de lectura y un SASesion que solo la entrega (nunca la sesión)');

  /* El lector, corriendo en un marco de mentira */
  const pinta = R('creatorParaPintar_')('<html><head></head><body></body></html>', 'hub', 'alma/x.html', { token: t, perfil: SES });
  const codigo = /<script>(\(function\(\)\{var C=[\s\S]*?)<\/script>/.exec(pinta)[1];
  const avisos = [], red2 = [];
  class Resp { constructor(b, o) { this.b = b; this.status = (o || {}).status || 200; } text() { return Promise.resolve(this.b); } json() { return Promise.resolve(JSON.parse(this.b)); } }
  const escuchas = [], parent = { postMessage: (d) => { avisos.push(d); if (d.creator === 'aprobar' || d.creator === 'hoja') setTimeout(() => escuchas.forEach(f => f({ source: parent, data: d.creator === 'hoja' ? { creatorRespuesta: 1, id: d.id, texto: 'a,b', status: 200 } : { creatorRespuesta: 1, id: d.id, ok: false } })), 0); } };
  const w = { parent, document: { baseURI: 'https://hub.spacioam.com/alma/' }, navigator: { sendBeacon: () => true }, Response: Resp, URL, Promise, JSON, Object, String, setTimeout,
    addEventListener: (k, f) => { if (k === 'message') escuchas.push(f); },
    fetch: (u, o) => { red2.push({ u, o }); const b = o && o.body ? JSON.parse(o.body) : {}; return Promise.resolve(new Resp(JSON.stringify(b.action === 'enviarAhora' ? { ok: false, creator_bloqueo: { accion: 'enviarAhora', por: 'escribe datos' } } : { ok: true, lista: [1] }))); } };
  w.window = w; w.self = w;
  vm.runInNewContext(codigo, w);
  const HUB = 'https://script.google.com/macros/s/HUB/exec';
  Promise.all([
    w.fetch(HUB, { method: 'POST', body: JSON.stringify({ hub: 1, action: 'cola', session: 'otra', token: 'viejo' }) }).then(r => r.text()),
    w.fetch(HUB, { method: 'POST', body: JSON.stringify({ hub: 1, action: 'enviarAhora', fila: 3 }) }).then(r => r.text()),
    w.fetch('https://script.google.com/macros/s/OTRA/exec', { method: 'POST', body: JSON.stringify({ action: 'guardar' }) }).then(r => r.text()),
    w.fetch('https://api.ejemplo.com/x', { method: 'POST', body: '{}' }).then(r => r.text()),
    w.fetch('https://docs.google.com/spreadsheets/d/' + 'a'.repeat(44) + '/gviz/tq?tqx=out:csv').then(r => r.text()),
    w.fetch('https://hub.spacioam.com/ds/x.css').then(r => r.text())
  ]).then(([lect, bloq, otro, fuera, hoja, css]) => {
    const pedidosHub = red2.filter(x => /HUB/.test(x.u)).map(x => JSON.parse(x.o.body));
    ok(JSON.parse(lect).ok && pedidosHub[0].session === t && !pedidosHub[0].token, '12 · en el marco, una lectura sale al Hub con la llave de lectura (la de la página se cambia; sin llave vieja)');
    ok(JSON.parse(bloq).creator_no_aprobado && avisos.some(a => a.creator === 'aprobar' && a.accion === 'enviarAhora'), '12 · lo que el Hub bloquea pide aprobación a la pantalla; con «No», la página recibe «no se aprobó» y nada cambia');
    ok(JSON.parse(otro).creator_no_aprobado && JSON.parse(fuera).creator_no_aprobado && !red2.some(x => /OTRA|ejemplo/.test(x.u)), '12 · otro Apps Script o un envío a otro sitio no sale del marco sin aprobación');
    ok(hoja === 'a,b' && !red2.some(x => /gviz/.test(x.u)) && css && red2.some(x => /x\.css/.test(x.u)), '12 · las hojas las lee la pantalla (con la sesión de Juan) y lo demás (estilos, fotos) carga igual');
    ok(w.navigator.sendBeacon('https://x.com/y', 'z') === false && avisos.some(a => a.creator === 'bloqueado'), '12 · sendBeacon no sale');
    ok(w.SASesion.leer() === t && w.SASesion.perfilRapido().email === 'juan@x', '12 · SASesion del marco entrega solo la llave de lectura');
  }).catch(e => ok(false, '12 · el lector del marco: ' + e));

  const ap = R('creatorAccionApi_')(ses, 'creatorAprobar', { accion: 'enviarAhora', url: HUB, campos: ['fila', 'texto'], que: 'accion' });
  const fila = hojas.ALMA_CREATOR_APROBADOS && hojas.ALMA_CREATOR_APROBADOS.filas.slice(-1)[0];
  ok(ap.ok && fila && fila[1] === 'juan@x' && fila[5] === 'enviarAhora' && fila[6] === 'script.google.com' && fila[7] === 'fila, texto', '12 · aprobar queda anotado: quién, qué acción, a dónde y los NOMBRES de los campos (nunca sus valores)');
  ok(R('creatorAccionApi_')({ email: 'ana@x' }, 'creatorAprobar', { accion: 'x' }).ok === false, '12 · solo el administrador principal aprueba');
  const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'creator.html'), 'utf8');
  ok(/Este cambio modificaría datos reales: ¿apruebas\?/.test(h) && /Aprobar esta vez/.test(h) && /pedir\("creatorAprobar"/.test(h) && /if \(!esMarco\(e\.source\)\) return;/.test(h) && /Datos reales · solo lectura/.test(h),
    '12 · la pantalla: tarjeta «¿apruebas?» con detalle, anota antes de mandar, y solo escucha a sus marcos');
  ok(/if \(!r \|\| !r\.ok\) \{ contestar\(w, d\.id, \{ ok: false \}\)/.test(h), '12 · si no se pudo anotar la aprobación, no se manda nada'); }

/* 13. Toca datos */
{ const T = (a, b) => R('creatorTocaDatos_')(a, b);
  const vivo = "<script>pedir({ action: 'cola' })</script>";
  ok(!T(vivo, vivo + '<style>h1{color:red}</style>').toca, '13 · un cambio de estilo no toca datos');
  const t1 = T(vivo, vivo + "<script>pedir({ action: 'enviarAhora', fila: 1 })</script>");
  ok(t1.toca && t1.acciones.join() === 'enviarAhora', '13 · agregar una acción que escribe sí toca datos');
  ok(T(vivo, vivo + "<script>fetch('https://api.otro.com/x',{method:'POST'})</script>").sitios.join() === 'https://api.otro.com', '13 · mandar algo a un sitio nuevo también');
  ok(R('creatorPrTocaDatos_')(['alma/x.html', 'apps-script/creator.js'], [], 'Diseño', false).toca && !R('creatorPrTocaDatos_')(['alma/x.html'], [], 'Diseño', false).toca, '13 · un PR que toca apps-script/ toca datos');
  ok(R('unirAparte_')('Toca datos · solo con Juan · Hub') && R('prsElegir_')('todos', [{ estado: 'listo', titulo: 'Toca datos · solo con Juan · x' }]).length === 0, '13 · «une todos» no une un PR «toca datos»');
  ok(/if \(\/toca datos\/i\.test\(String\(pr\.titulo/.test(fs.readFileSync(path.join(DIR, 'escalar.js'), 'utf8')), '13 · Alma (escalar) tampoco lo une sola');

  /* El camino completo: borrador que escribe → preparar avisa → PR listo con apps-script → etiqueta → publicar pide confirmación */
  R('creatorAbrir_')(JUAN, 'hub', 'alma/creator-prueba.html');
  respuestas = [{ resumen: 'Botón que manda.', cambios: [{ buscar: '<p>Hola</p><p>Hola</p>', reemplazar: "<p>Hola</p><button onclick=\"pedir({ action: 'enviarAhora' })\">Enviar</button>" }] }];
  ok(R('creatorCambiar_')(JUAN, 'agrega un botón que mande el mensaje', 'voz').ok, '13 · (un cambio que agrega un botón que escribe)');
  pedidos = []; const pr = R('creatorPublicar_')(JUAN, 'súbelo', true);
  ok(pr.ok && /ESTE BORRADOR TOCA DATOS \(acciones que escriben: enviarAhora/.test(pedidos[0].texto) && /etiqueta toca-datos/.test(pedidos[0].texto) && /Toca datos · solo con Juan/.test(pedidos[0].texto) && /no toques apps-script/.test(pedidos[0].texto),
    '13 · preparar avisa a Claude: etiqueta toca-datos, título «Toca datos · solo con Juan» y no tocar apps-script/');
  const id = act().id; micro = { id: 'mpcreator1', estado: R('MICRO_ESTADOS_').listo, pr: 'https://github.com/jforce15-coder/Hub-Spacioam/pull/901' }; delete cache['creator_mira_' + id];
  const gh = []; ctx.unirGh_ = (m, r, c) => { gh.push({ m, r, c }); return /\/files/.test(r) ? { codigo: 200, j: [{ filename: 'alma/creator-prueba.html' }, { filename: 'apps-script/x.js' }] } : /\/labels$/.test(r) ? { codigo: 200, j: [] } : { codigo: 200, j: { title: 'Diseño · Hub', labels: [] } }; };
  const vL = R('creatorVerApi_')(ses, {});
  ok(vL.creator.estado === 'listo' && /apps-script\/x\.js/.test(vL.toca_datos) && gh.some(x => x.m === 'post' && /issues\/901\/labels$/.test(x.r) && x.c.labels[0] === 'toca-datos'), '13 · cuando el PR queda listo y toca datos, se le pone la etiqueta y la pantalla lo dice');
  unidos = [];
  const voz = R('creatorPublicar_')(JUAN, 'publícalo', true), sin = R('creatorAccionApi_')(ses, 'creatorPublicar', {});
  ok(!voz.ok && voz.toca_datos && !sin.ok && sin.toca_datos && unidos.length === 0, '13 · toca datos: ni por voz («publícalo») ni con el botón solo se publica');
  const con = R('creatorAccionApi_')(ses, 'creatorPublicar', { confirmo_datos: true });
  ok(con.ok && unidos.length === 1 && hojas.ALMA_CREATOR_APROBADOS.filas.slice(-1)[0][5] === 'publicar · toca datos', '13 · con la confirmación aparte de Juan en la pantalla sí se publica, y queda anotado');
  const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'creator.html'), 'utf8');
  ok(/Este cambio toca datos reales: ¿publicar igual\?/.test(h) && /confirmo_datos: true/.test(h), '13 · la pantalla pide esa confirmación con su tarjeta'); }

setTimeout(() => { if (fallo) process.exit(1); else console.log('Todo bien: el Modo Creator muestra el borrador con datos reales en solo lectura, pide aprobación para lo que escribe, elige el modelo justo y publica solo en dos pasos con Juan.'); }, 50);
