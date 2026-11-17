/* Prueba con dobles del Mudador (traslado/Mudador.js), de la entrega de Propiedades del proyecto viejo
   (traslado/entregar.js) y del archivo «traslado_traer» que el Mudador pone en el proyecto nuevo. Sin red ni Google.
   1. Sin la llave del Mudador no hace nada; el estado y el registro nunca traen llaves ni valores de Propiedades.
   2. Idempotente: crea el proyecto una sola vez; la segunda publicación actualiza el mismo y la misma app web.
   3. La llave de «traer» sirve UNA vez; con otra llave no entrega nada; tras traer, la publicación quita traslado_traer.
   4. El viejo entrega solo a alma@ (correo verificado, emisor Google, sin vencer) y a la misma app (aud) siempre.
   5. trasladoTraer copia solo las Propiedades que faltan (nunca pisa) y corre lo de instalar.
   node .github/traslado.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const SECRETO = 'valor-secreto-que-no-debe-salir';
const VIEJO = 'https://script.google.com/macros/s/AKfycbVIEJO000/exec';
const logs = [];

function propiedades(inicial) {
  const d = Object.assign({}, inicial);
  return { d, sp: { getProperty: k => (k in d ? d[k] : null), setProperty: (k, v) => { d[k] = String(v); }, getProperties: () => Object.assign({}, d),
    setProperties: (o, borrar) => { if (borrar) for (const k in d) delete d[k]; for (const k in o) d[k] = String(o[k]); }, deleteProperty: k => { delete d[k]; } } };
}
function respuesta(code, cuerpo) { return { getResponseCode: () => code, getContentText: () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) }; }
const utilidades = {
  getUuid: () => crypto.randomUUID(), sleep() {},
  DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  computeDigest: (alg, t) => Array.from(crypto.createHash('sha256').update(t, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
  formatDate: (d) => d.toISOString().slice(0, 10)
};
const contenido = { createTextOutput: t => ({ setMimeType() { return this; }, texto: t }), MimeType: { JSON: 'json' } };
const base = () => ({ console: { log: (...a) => logs.push(a.join(' ')), error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, Error,
  encodeURIComponent, Utilities: utilidades, ContentService: contenido, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) } });

/* ── Proyecto VIEJO con entregar.js ── */
const viejo = propiedades({ ANTHROPIC_KEY: SECRETO, ACCESOS: 'a', CUPO_HORAS: '{}', SESION_EXIGIR: '1' });
let tokeninfo = { iss: 'https://accounts.google.com', email: 'alma@spacioam.com', email_verified: 'true', aud: 'app-mudador', exp: String(Math.floor(Date.now() / 1000) + 600) };
const ctxViejo = Object.assign(base(), {
  PropertiesService: { getScriptProperties: () => viejo.sp },
  uf_: (url) => (url.indexOf('https://oauth2.googleapis.com/tokeninfo?id_token=') === 0 && url.indexOf('a.b.c') > 0 ? respuesta(200, tokeninfo) : respuesta(400, {}))
});
vm.createContext(ctxViejo);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'traslado', 'entregar.js'), 'utf8'), ctxViejo, { filename: 'entregar.js' });
const entregar = tok => JSON.parse(ctxViejo.trasladoEntregar_({ traslado: 'entregar', id_token: tok }).texto);

ok(ctxViejo.trasladoEntregar_({ action: 'ping' }) === null, 'entregar.js no toca los pedidos normales de la app');
ok(entregar('basura').error === 'identidad', 'sin token de identidad válido no entrega');
tokeninfo.email = 'otra@gmail.com';
ok(entregar('a.b.c').error === 'identidad', 'a otra cuenta no le entrega');
tokeninfo.email = 'alma@spacioam.com'; tokeninfo.email_verified = 'false';
ok(entregar('a.b.c').error === 'identidad', 'correo sin verificar no recibe');
tokeninfo.email_verified = 'true'; tokeninfo.exp = '1000';
ok(entregar('a.b.c').error === 'identidad', 'token vencido no recibe');
tokeninfo.exp = String(Math.floor(Date.now() / 1000) + 600);
delete viejo.d.TRASLADO_DIA;   // los intentos de arriba cuentan en el tope del día; se empieza de cero

/* ── El MUDADOR ── */
const mud = propiedades({ MUDADOR_LLAVE: 'llave-maestra', MUDADOR_URL: 'https://script.google.com/macros/s/AKfycbMUD/exec', MUDADOR_DEPLOY: 'AKfycbMUD' });
const api = [];
let proximo = 0;
const ctxMud = Object.assign(base(), {
  PropertiesService: { getScriptProperties: () => mud.sp },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'alma@spacioam.com' }) },
  ScriptApp: { getOAuthToken: () => 'tok-oauth', getIdentityToken: () => 'a.b.c', getScriptId: () => 'MUDADOR' },
  UrlFetchApp: { fetch: (url, o) => {
    if (url === VIEJO) return respuesta(200, JSON.parse(ctxViejo.trasladoEntregar_(JSON.parse(o.payload)).texto));
    const ruta = url.replace('https://script.googleapis.com/v1', ''), cuerpo = o.payload ? JSON.parse(o.payload) : null;
    api.push({ m: o.method, ruta, cuerpo, auth: o.headers && o.headers.Authorization });
    if (o.method === 'post' && ruta === '/projects') return respuesta(200, { scriptId: 'NUEVO' + (++proximo) });
    if (/\/content$/.test(ruta)) return respuesta(200, {});
    if (/\/versions$/.test(ruta)) return respuesta(200, { versionNumber: api.filter(x => /\/versions$/.test(x.ruta)).length });
    if (/\/deployments/.test(ruta)) return respuesta(200, { deploymentId: 'DEP1', entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'https://script.google.com/macros/s/DEP1/exec' } }] });
    return respuesta(404, { error: { message: 'no' } });
  } }
});
vm.createContext(ctxMud);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'traslado', 'Mudador.js'), 'utf8'), ctxMud, { filename: 'Mudador.js' });
const post = obj => JSON.parse(ctxMud.doPost({ postData: { contents: JSON.stringify(obj) } }).texto);

const archivos = [{ name: 'appsscript', type: 'JSON', source: '{}' }, { name: 'Código', type: 'SERVER_JS', source: 'function instalar(){}' }];
const pub = (extra) => post(Object.assign({ llave: 'llave-maestra', accion: 'publicar', proyecto: 'docs', titulo: 'Docs', viejo: VIEJO,
  copiar: 'todas', excluir: ['CUPO_*'], al_traer: ['instalar'], sha: 'aaa111', archivos }, extra || {}));

ok(post({ llave: 'mala', accion: 'estado' }).error === 'llave' && post({ accion: 'publicar' }).error === 'llave', 'sin la llave del Mudador no hace nada');
ok(pub({ crear: false }).error.indexOf('no_existe') === 0 && api.length === 0, 'sin crear: true no crea proyectos');
ok(pub({ archivos: [{ name: 'Código', type: 'SERVER_JS', source: '' }], crear: true }).ok === false && api.length === 0, 'sin appsscript.json no sube nada');

const r1 = pub({ crear: true });
ok(r1.ok && r1.creado && r1.scriptId === 'NUEVO1' && r1.url === 'https://script.google.com/macros/s/DEP1/exec', 'la primera vez crea el proyecto y su app web');
ok(api.every(x => x.auth === 'Bearer tok-oauth'), 'llama a la API de Apps Script con el token de alma@');
const sub1 = api.filter(x => /\/content$/.test(x.ruta))[0].cuerpo.files;
const traer = sub1.filter(f => f.name === 'traslado_traer')[0];
ok(traer && sub1.some(f => f.name === 'appsscript'), 'sube el código con el manifiesto y agrega traslado_traer');
const K = traer && JSON.parse(traer.source.match(/var TRASLADO_TRAER_ = (\{.*\});/)[1]).llave;
ok(K && K !== 'llave-maestra' && traer.source.indexOf('llave-maestra') < 0, 'traslado_traer lleva una llave propia, nunca la del Mudador');

const r2 = pub({ crear: true, sha: 'bbb222' });
ok(r2.ok && !r2.creado && r2.scriptId === 'NUEVO1' && api.filter(x => x.ruta === '/projects').length === 1, 'idempotente: la segunda vez no crea otro proyecto');
ok(api.filter(x => x.m === 'put' && /\/deployments\/DEP1$/.test(x.ruta)).length === 1, 'la segunda vez actualiza la misma app web (misma URL)');
const sub2 = api.filter(x => /\/content$/.test(x.ruta))[1].cuerpo.files.filter(f => f.name === 'traslado_traer')[0];
const K2 = JSON.parse(sub2.source.match(/var TRASLADO_TRAER_ = (\{.*\});/)[1]).llave;
ok(post({ accion: 'traer', proyecto: 'docs', llave: K }).error === 'llave', 'la llave de traer vieja ya no sirve tras otra publicación');

/* trasladoTraer en el proyecto NUEVO, con su llave */
const nuevo = propiedades({ SESION_EXIGIR: '0' });
let instalo = 0;
const ctxNuevo = Object.assign(base(), {
  PropertiesService: { getScriptProperties: () => nuevo.sp },
  UrlFetchApp: { fetch: (url, o) => respuesta(200, post(JSON.parse(o.payload))) },
  instalar: () => { instalo++; }
});
ctxNuevo.globalThis = ctxNuevo;
vm.createContext(ctxNuevo);
vm.runInContext(sub2.source, ctxNuevo, { filename: 'traslado_traer.js' });
logs.length = 0;
ctxNuevo.trasladoTraer();
ok(nuevo.d.ANTHROPIC_KEY === SECRETO && nuevo.d.ACCESOS === 'a', 'trae las Propiedades del viejo al nuevo');
ok(nuevo.d.SESION_EXIGIR === '0', 'nunca pisa una Propiedad que ya está en el nuevo');
ok(!('CUPO_HORAS' in nuevo.d) && !('TRASLADO_AUD' in nuevo.d) && !('TRASLADO_DIA' in nuevo.d), 'respeta excluir y no pasa las marcas del traslado');
ok(instalo === 1, 'corre lo de instalar (activadores) después de traer');
ok(viejo.d.TRASLADO_AUD === 'app-mudador', 'el viejo fija la app que pidió (aud)');
ok(!logs.join('\n').includes(SECRETO), 'el registro de trasladoTraer dice nombres, nunca valores');
let segunda = '';
try { ctxNuevo.trasladoTraer(); } catch (e) { segunda = e.message; }
ok(/sin_llave/.test(segunda), 'la llave de traer sirve una sola vez');

tokeninfo.aud = 'otra-app';
ok(entregar('a.b.c').error === 'otra_app', 'otra app de alma@ ya no puede pedir las Propiedades');
tokeninfo.aud = 'app-mudador';
viejo.d.TRASLADO_DIA = JSON.stringify({ d: new Date().toISOString().slice(0, 10), n: 99 });
ok(entregar('a.b.c').error === 'tope_del_dia', 'el viejo tiene tope de entregas al día');

const r3 = pub({ sha: 'bbb222' });
const sub3 = api.filter(x => /\/content$/.test(x.ruta)).slice(-1)[0].cuerpo.files;
ok(r3.ok && r3.traido && !sub3.some(f => f.name === 'traslado_traer'), 'después de traer, la publicación quita traslado_traer');
const r4 = pub({ sha: 'bbb222' });
ok(r4.ok && r4.sin_cambios, 'mismo commit ya publicado: sin cambios (no gasta versiones)');

const est = post({ llave: 'llave-maestra', accion: 'estado' });
const txt = JSON.stringify(est) + JSON.stringify(mud.d.MUD_REGISTRO) + logs.join('\n');
ok(est.ok && est.proyectos.docs && est.proyectos.docs.url && est.proyectos.docs.traido, 'estado dice qué proyecto hay, su URL y si ya trajo');
ok(!txt.includes('llave-maestra') && !txt.includes(SECRETO) && !txt.includes(K2) && !/kHash/.test(JSON.stringify(est)), 'estado y registro sin llaves ni valores');

/* El empaque del workflow: la llave va al archivo, nunca a la pantalla */
const { armar } = require(path.join(RAIZ, 'traslado', 'empacar.js'));
const a = armar(['publicar', 'docs', path.join(RAIZ, 'traslado'), 'sha1', '/dev/null', 'true'], { MUDADOR_LLAVE: 'x' });
ok(a.cuerpo.crear === true && a.cuerpo.viejo && a.cuerpo.archivos.some(f => f.name === 'appsscript' && f.type === 'JSON') &&
  a.cuerpo.archivos.some(f => f.name === 'Mudador' && f.type === 'SERVER_JS'), 'empacar arma el pedido con manifiesto y archivos');
let sinLlave = '';
try { armar(['estado', '/dev/null'], {}); } catch (e) { sinLlave = e.message; }
ok(/MUDADOR_LLAVE/.test(sinLlave), 'empacar sin el secreto se detiene');
const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'traslado', 'appsscript.json'), 'utf8'));
ok(['script.projects', 'script.deployments', 'script.external_request', 'userinfo.email'].every(s => man.oauthScopes.some(x => x.endsWith(s))) &&
  man.oauthScopes.includes('openid') && man.webapp.executeAs === 'USER_DEPLOYING', 'el manifiesto del Mudador pide los permisos justos');

process.exit(fallo);
