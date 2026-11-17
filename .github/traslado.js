/* Prueba con dobles del Mudador (traslado/Mudador.js), de la entrega de Propiedades del proyecto viejo
   (traslado/entregar.js) y del archivo «traslado_traer» que el Mudador pone en el proyecto nuevo. Sin red ni Google.
   1. Sin la llave del Mudador no hace nada; el estado y el registro nunca traen llaves ni valores de Propiedades.
   2. Idempotente: crea el proyecto una sola vez; la segunda publicación actualiza el mismo y la misma app web.
   3. La llave de «traer» sirve UNA vez; con otra llave no entrega nada; tras traer, la publicación quita traslado_traer.
   4. El viejo entrega solo a alma@ (correo verificado, emisor Google, sin vencer) y a la misma app (aud) siempre.
      Revisa la firma del token AQUÍ (RS256), sin UrlFetch: sin cupo de Google entrega igual; firma mala o llave
      desconocida, no entrega.
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
  formatDate: (d) => d.toISOString().slice(0, 10),
  base64DecodeWebSafe: t => Array.from(Buffer.from(t, 'base64url')).map(b => (b > 127 ? b - 256 : b)),
  newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes.map(b => b & 0xFF)).toString('utf8') })
};
/* Tokens de identidad firmados de verdad (RS256) con una llave de prueba que hace de «llave pública de Google». */
const LLAVE = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), OTRA = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = LLAVE.publicKey.export({ format: 'jwk' });
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(cambios, opc) {
  opc = opc || {};
  const t = Object.assign({ iss: 'https://accounts.google.com', email: 'alma@spacioam.com', email_verified: true, aud: 'app-mudador',
    exp: Math.floor(Date.now() / 1000) + 600 }, cambios || {});
  const datos = b64u({ alg: 'RS256', kid: opc.kid || 'prueba', typ: 'JWT' }) + '.' + b64u(t);
  return datos + '.' + crypto.sign('sha256', Buffer.from(datos), (opc.clave || LLAVE).privateKey).toString('base64url');
}
const contenido = { createTextOutput: t => ({ setMimeType() { return this; }, texto: t }), MimeType: { JSON: 'json' } };
const base = () => ({ console: { log: (...a) => logs.push(a.join(' ')), error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, Date, Error,
  encodeURIComponent, Utilities: utilidades, ContentService: contenido, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) } });

/* ── Proyecto VIEJO con entregar.js ── */
const viejo = propiedades({ ANTHROPIC_KEY: SECRETO, ACCESOS: 'a', CUPO_HORAS: '{}', SESION_EXIGIR: '1' });
let fetches = 0;
const sinCupo = () => { fetches++; throw new Error('Service invoked too many times for one day: urlfetch.'); };
const ctxViejo = Object.assign(base(), {
  PropertiesService: { getScriptProperties: () => viejo.sp },
  BigInt, uf_: sinCupo, UrlFetchApp: { fetch: sinCupo }   // la cuenta vieja sin cupo de Google (17-nov-2026)
});
vm.createContext(ctxViejo);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'traslado', 'entregar.js'), 'utf8'), ctxViejo, { filename: 'entregar.js' });
ok(ctxViejo.TRASLADO_LLAVES_.length >= 2 && ctxViejo.TRASLADO_LLAVES_.every(k => k.kid && k.n && k.e === 'AQAB'), 'entregar.js trae las llaves públicas de Google de hoy');
ctxViejo.TRASLADO_LLAVES_ = [{ kid: 'prueba', n: JWK.n, e: JWK.e }];
const entregar = tok => JSON.parse(ctxViejo.trasladoEntregar_({ traslado: 'entregar', id_token: tok }).texto);

ok(ctxViejo.trasladoEntregar_({ action: 'ping' }) === null, 'entregar.js no toca los pedidos normales de la app');
ok(/^identidad/.test(entregar('basura').error), 'sin token de identidad válido no entrega');
ok(/firma mala/.test(entregar(token({}, { clave: OTRA })).error), 'firma mala no recibe');
ok(/llave de Google desconocida/.test(entregar(token({}, { kid: 'otra-llave' })).error), 'llave desconocida no recibe');
const partes = token().split('.'), cambiado = partes[0] + '.' + b64u({ iss: 'https://accounts.google.com', email: 'alma@spacioam.com', email_verified: true, aud: 'x', exp: 9e9 }) + '.' + partes[2];
ok(/firma mala/.test(entregar(cambiado).error), 'token con datos cambiados no recibe');
ok(/emisor/.test(entregar(token({ iss: 'https://otro.com' })).error), 'emisor que no es Google no recibe');
delete viejo.d.TRASLADO_DIA;   // tope de 6 al día: se empieza de cero
ok(/otro correo/.test(entregar(token({ email: 'otra@gmail.com' })).error), 'a otra cuenta no le entrega');
ok(/sin verificar/.test(entregar(token({ email_verified: false })).error), 'correo sin verificar no recibe');
ok(/vencido/.test(entregar(token({ exp: 1000 })).error), 'token vencido no recibe');
ok(!viejo.d.TRASLADO_AUD, 'ningún rechazo fija la app');
delete viejo.d.TRASLADO_DIA;
const sinCupoOk = entregar(token());
ok(sinCupoOk.ok && sinCupoOk.propiedades.ANTHROPIC_KEY === SECRETO && fetches === 0, 'token válido y sin cupo de Google: entrega sin llamar a internet');
delete viejo.d.TRASLADO_AUD;
delete viejo.d.TRASLADO_DIA;   // los intentos de arriba cuentan en el tope del día; se empieza de cero

/* ── El MUDADOR ── */
const mud = propiedades({ MUDADOR_LLAVE: 'llave-maestra', MUDADOR_URL: 'https://script.google.com/macros/s/AKfycbMUD/exec', MUDADOR_DEPLOY: 'AKfycbMUD' });
const api = [];
let proximo = 0;
const ctxMud = Object.assign(base(), {
  PropertiesService: { getScriptProperties: () => mud.sp },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'alma@spacioam.com' }) },
  ScriptApp: { getOAuthToken: () => 'tok-oauth', getIdentityToken: () => token(), getScriptId: () => 'MUDADOR' },
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

ok(entregar(token({ aud: 'otra-app' })).error === 'otra_app', 'otra app de alma@ ya no puede pedir las Propiedades');
viejo.d.TRASLADO_DIA = JSON.stringify({ d: new Date().toISOString().slice(0, 10), n: 99 });
ok(entregar(token()).error === 'tope_del_dia', 'el viejo tiene tope de entregas al día');

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

ok(fetches === 0, 'entregar.js nunca usó UrlFetch');
const roto = Object.assign(base(), { PropertiesService: { getScriptProperties: () => { throw new Error('Service invoked too many times for one day: properties.'); } } });
vm.createContext(roto);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'traslado', 'entregar.js'), 'utf8'), roto);
ok(/^sin cupo de Google/.test(JSON.parse(roto.trasladoEntregar_({ traslado: 'entregar', id_token: 'x' }).texto).error), 'un error de cupo dice «sin cupo de Google», no «interno»');

/* 6. Las copias en el Hub y el login son iguales al original y doPost las llama primero (antes de cualquier llave). */
const original = fs.readFileSync(path.join(RAIZ, 'traslado', 'entregar.js'), 'utf8');
for (const [copia, entrada] of [['apps-script/traslado.js', 'apps-script/Código.js'], ['login/apps-script/traslado.js', 'login/apps-script/03-auth-endpoint.js']]) {
  ok(fs.readFileSync(path.join(RAIZ, copia), 'utf8') === original, copia + ' es igual a traslado/entregar.js');
  const src = fs.readFileSync(path.join(RAIZ, entrada), 'utf8'), dp = src.slice(src.indexOf('function doPost'), src.indexOf('function doPost') + 600);
  ok(/trasladoEntregar_\(/.test(dp), entrada + ': doPost entrega las Propiedades al Mudador');
}

/* 7. El corte del Hub (trasladocorte.js): apagar borra los activadores y marca; encender crea los fijos y guarda el cupo. */
{
  const props = propiedades({});
  let trig = [{ f: 'procesarCola' }, { f: 'aprender' }, { f: 'cerebroSincronizar' }];
  const nuevo = f => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => trig.push({ f }) }), everyHours: () => ({ create: () => trig.push({ f }) }) }) });
  const ctx = Object.assign(base(), { PropertiesService: { getScriptProperties: () => props.sp },
    ScriptApp: { getScriptId: () => 'id-prueba', getProjectTriggers: () => trig.map(t => ({ getHandlerFunction: () => t.f, _t: t })),
      deleteTrigger: x => { trig = trig.filter(t => t !== x._t); }, newTrigger: nuevo } });
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'apps-script', 'trasladocorte.js'), 'utf8'), ctx);
  let r = ctx.trasladoCorte_('traslado_apagar', {});
  ok(r.ok && trig.length === 0 && ctx.trasladoApagado_(), 'apagar borra todos los activadores y marca el Hub como apagado');
  r = ctx.trasladoCorte_('traslado_encender', { cupo_dia: 100000 });
  ok(r.ok && !ctx.trasladoApagado_() && r.activadores.procesarCola === 1 && r.activadores.aprender === 1 && props.d.CUPO_DIA === '100000', 'encender crea procesarCola y aprender una vez y guarda CUPO_DIA');
  ctx.trasladoCorte_('traslado_encender', {});
  ok(trig.length === 2, 'encender dos veces no duplica activadores');
  const cod = fs.readFileSync(path.join(RAIZ, 'apps-script', 'Código.js'), 'utf8');
  ok(/function procesarCola\(\) \{\s*if \([^\n]*trasladoApagado_\(\)\) return;/.test(cod) && /function aprender\(\) \{\s*if \([^\n]*trasladoApagado_\(\)\) return;/.test(cod), 'procesarCola y aprender no corren en el Hub apagado');
}

process.exit(fallo);
