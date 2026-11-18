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
   9. Claudio tiene claudio_creator y el resultado avisa a la app.
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
const red = s => /api\.anthropic\.com/.test(s.url) ? { codigo: 200, cuerpo: { model: s.cuerpo.model, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(respuestas.shift() || { resumen: 'nada', cambios: [] }) }] } }
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
  ok(ll.cuerpo.model === 'claude-sonnet-5-5' && ll.cuerpo.output_config.effort === 'low' && ll.cuerpo.output_config.format.type === 'json_schema' && ll.cuerpo.fallbacks === 'default' && ll.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', '4 · motor: Sonnet 5.5, esfuerzo bajo, salida JSON y respaldo si un clasificador declina');
  ok(/<pantalla>[\s\S]*Llegadas de hoy/.test(ll.cuerpo.messages[0].content[0].text) && JSON.parse(ll.cuerpo.system[0].text).formato_de_respuesta, '4 · le llega la pantalla y el prompt en JSON (rol, tarea, contexto, pasos, restricciones, formato)');
  mem.CREATOR_MODELO = 'claude-haiku-5-5';
  respuestas = [{ resumen: 'Le puse vidrio.', cambios: [{ buscar: '</style>', reemplazar: '.v{backdrop-filter:blur(20px)}</style>' }] }];
  const c2 = R('creatorCambiar_')(JUAN, 'ponle vidrio esmerilado', 'voz'), ll2 = salidas.filter(s => /anthropic/.test(s.url)).pop();
  ok(c2.ok && c2.version === 2 && ll2.cuerpo.model === 'claude-haiku-5-5' && !ll2.cuerpo.fallbacks && /Pedidos anteriores[^\n]*haz el título más grande/.test(ll2.cuerpo.messages[0].content[1].text), '4 · CREATOR_MODELO cambia el modelo sin PR; el modelo sabe lo ya pedido en esa pantalla');
  delete mem.CREATOR_MODELO;
  const nA = salidas.filter(s => /anthropic/.test(s.url)).length;
  respuestas = [{ resumen: 'x', cambios: [{ buscar: '<p>Hola</p>', reemplazar: '<p>Adiós</p>' }] }, { resumen: 'x', cambios: [{ buscar: '<h2>nada</h2>', reemplazar: '' }] }];
  const c3 = R('creatorCambiar_')(JUAN, 'cambia el saludo', 'voz');
  ok(!c3.ok && /^NO CAMBIÓ NADA/.test(c3.error) && salidas.filter(s => /anthropic/.test(s.url)).length === nA + 2 && act().actual === 2, '4 · si copia mal, prueba una vez más; si tampoco, no guarda nada y lo dice');
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

if (fallo) process.exit(1); else console.log('Todo bien: el Modo Creator muestra el borrador, cambia en segundos, deshace y publica solo en dos pasos con Juan.');
