/* Prueba con dobles de la Página explicativa (apps-script/paginaexplicativa.js; Juan, 20-nov-2026, truco 2 del video de
   Andrej Karpathy: «Explícamelo en una página»). Sin Google ni IA. Revisa:
   1. solo administradores: la herramienta y la acción con sesión; quien no lo es no crea ni abre;
   2. el enlace sale en el acto y la página se arma en segundo plano con el modelo medio (y queda en IA_USO);
   3. el token del enlace abre una sola vez, «preparando» no lo gasta, otro token no abre; con sesión, todas las veces;
   4. vence a los 7 días y se borra sola;
   5. tope diario (10, o PAGINAS_TOPE);
   6. el HTML no trae scripts externos ni marcos ni otras hojas (solo Google Fonts) y lleva la política que cierra la red;
   7. el cableado: herramienta en el chat y WhatsApp (no en la voz), acción paginaVer, doGet con el token, robot,
      limpieza cada hora, alma/pagina.html en un marco aislado.
   node .github/pagina-explicativa.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const PAG = leer('paginaexplicativa.js'), AG = leer('agente.js'), COD = leer('Código.js');
const PAGINA = fs.readFileSync(path.join(DIR, '..', 'alma', 'pagina.html'), 'utf8');
const H = 3600000;

const HTML_MODELO = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarifa</title>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat">' +
  '<link rel="stylesheet" href="https://otro.example/estilo.css">' +
  '<script src="https://cdn.example/libreria.js"></script><SCRIPT defer SRC=\'https://cdn.example/b.js\'></SCRIPT>' +
  '<meta http-equiv="refresh" content="0;url=https://otro.example">' +
  '</head><body><h1>Cuánto deja</h1><input type="range" id="r"><iframe src="https://otro.example"></iframe>' +
  '<form action="https://otro.example"><input></form><script>document.getElementById("r").oninput=function(){};</script></body></html>';

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, disparadores = [], llamadas = [];
  let ahora = Date.parse(o.ahora || '2026-11-20T18:00:00Z');
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const filas = [];
  const hoja = {
    filas, getLastRow: () => filas.length,
    appendRow: r => filas.push(r.slice()),
    deleteRow: n => filas.splice(n - 1, 1),
    getRange: (r, c, nr, nc) => ({
      getValues: () => filas.slice(r - 1, r - 1 + nr).map(f => Array.from({ length: nc }, (_, j) => f[c - 1 + j] === undefined ? '' : f[c - 1 + j])),
      setValue: v => { filas[r - 1][c - 1] = v; } })
  };
  const admins = [{ email: 'juan@prueba.test', nombre: 'Juan', principal: true }, { email: 'ana@prueba.test', nombre: 'Ana', principal: false }];
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, isNaN, isFinite, Error,
    CFG: { TZ: 'America/Guatemala', HUB_URL: 'https://hub.spacioam.com' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    ScriptApp: { getProjectTriggers: () => disparadores.map(h => ({ getHandlerFunction: () => h })), deleteTrigger: () => { disparadores.length = 0; },
      newTrigger: h => ({ timeBased: () => ({ after: () => ({ create: () => disparadores.push(h) }) }) }) },
    Utilities: {
      formatDate: d => new Date(new Date(d).getTime() - 6 * H).toISOString().slice(0, 10),
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(String(s)).digest()).map(b => (b > 127 ? b - 256 : b))
    },
    hojaCrear_: (n, cab) => { if (!filas.length) filas.push(cab.slice()); return hoja; },
    celdaTexto_: x => String(x == null ? '' : x),
    esAdminOp_: a => !!(a && admins.some(x => x.email === a.email)),
    chatSesAdm_: ses => (ses && ses.email ? (admins.find(a => a.email === ses.email) || { email: ses.email, nombre: 'Otro' }) : null),
    agPrincipal_: () => admins[0],
    creatorEscalonModelo_: i => 'modelo-' + ['basico', 'medio', 'avanzado'][i],
    claude_: (modelo, max, system, user) => { llamadas.push({ modelo, system, user }); return 'Aquí va:\n' + (o.html || HTML_MODELO) + '\nListo.'; }
  };
  vm.createContext(ctx); vm.runInContext(PAG, ctx);
  return { ctx, props, hoja, disparadores, llamadas, mover: ms => { ahora += ms; } };
}
const JUAN = { email: 'juan@prueba.test', nombre: 'Juan', principal: true }, ANA = { email: 'ana@prueba.test', nombre: 'Ana' }, HUESPED = { email: 'otro@prueba.test', nombre: 'Otro' };
const tokenDe = enlace => new URL(enlace).searchParams.get('t');
/* Datos inventados: ninguna cifra real. */
const PEDIDO = { tema: 'Cuánto deja Mónaco B2 si subo la tarifa 10 %', datos: 'Tarifa de ejemplo 500 por noche; ocupación de ejemplo 70 %; comisión de ejemplo 20 %.' };

/* 1 · solo administradores */
{
  const c = caja();
  ok(!c.ctx.pagExplicar_(HUESPED, PEDIDO, 'hub').ok && c.hoja.filas.length <= 1, 'quien no es administrador no crea una página');
  ok(!c.ctx.pagExplicar_(JUAN, { tema: '' }, 'hub').ok, 'sin tema no se crea');
  const r = c.ctx.pagExplicar_(ANA, PEDIDO, 'whatsapp');
  ok(r.ok, 'cualquier administrador la crea (no solo el principal)');
  c.ctx.pagProcesar();
  ok(!c.ctx.pagVerApi_({ email: 'otro@prueba.test' }, { id: r.id }).ok, 'con la sesión de alguien que no es administrador no abre');
  ok(!c.ctx.pagVerApi_(null, { id: r.id }).ok, 'sin sesión, la acción no abre');
}
/* 2 · enlace en el acto; se arma después con el modelo medio */
{
  const c = caja();
  const r = c.ctx.pagExplicar_(JUAN, PEDIDO, 'hub');
  ok(r.ok && /^https:\/\/hub\.spacioam\.com\/alma\/pagina\.html\?id=pg\w+&t=[0-9a-f]{64}$/.test(r.enlace), 'el enlace sale en el acto, del Hub, con un token largo');
  ok(c.llamadas.length === 0 && c.disparadores.indexOf('pagProcesar') >= 0, 'no espera al modelo: programa el disparador pagProcesar');
  ok(r.decir.indexOf(r.enlace) >= 0 && /7 días/.test(r.decir), 'Alma recibe el enlace para mandarlo tal cual y que vence en 7 días');
  const ver0 = c.ctx.pagVerApi_({ email: 'juan@prueba.test' }, { id: r.id });
  ok(ver0.ok && ver0.estado === 'preparando', 'antes de armarse dice «preparando»');
  const fila = c.hoja.filas[1];
  ok(fila.indexOf(tokenDe(r.enlace)) < 0 && /^h[0-9a-f]{64}$/.test(fila[8]), 'la hoja guarda solo la huella del token, nunca el token');
  c.ctx.pagProcesar();
  ok(c.llamadas.length === 1 && c.llamadas[0].modelo === 'modelo-medio', 'la arma el modelo medio, una vez');
  const pr = JSON.parse(c.llamadas[0].system);
  ok(pr.rol && pr.tarea && pr.contexto && pr.pasos && pr.restricciones && pr.formato_de_respuesta && /E9826A/.test(pr.contexto.join(' ')) && /script src/.test(pr.restricciones.join(' ')), 'el pedido al modelo va en JSON, con los colores de Alma y sin scripts de fuera');
  ok(c.llamadas[0].user.indexOf(PEDIDO.datos) >= 0, 'el modelo recibe los datos que Alma ya tiene');
  const ver = c.ctx.pagVerApi_({ email: 'juan@prueba.test' }, { id: r.id });
  ok(ver.ok && ver.estado === 'lista' && /<h1>Cuánto deja<\/h1>/.test(ver.html), 'ya armada, se ve con la sesión de un administrador');
  ok(!c.props.PAG_PEND || (c.ctx.pagProcesar_(), !c.props.PAG_PEND), 'sin pendientes, procesarCola solo lee una propiedad');
  ok(/pagGenerar_: 'Página explicativa'/.test(COD), 'cada página queda en IA_USO como «Página explicativa» (el Gasto de Alma la cuenta)');
}
/* 3 · el token del enlace */
{
  const c = caja();
  const r = c.ctx.pagExplicar_(JUAN, PEDIDO, 'whatsapp'), t = tokenDe(r.enlace);
  const prep = c.ctx.pagVerToken_(r.id, t);
  ok(prep.ok && prep.estado === 'preparando', 'el token abre «preparando»…');
  c.ctx.pagProcesar();
  const v1 = c.ctx.pagVerToken_(r.id, t);
  ok(v1.ok && v1.estado === 'lista' && v1.html, '…y «preparando» no lo gastó: abre la página lista');
  const v2 = c.ctx.pagVerToken_(r.id, t);
  ok(!v2.ok && v2.estado === 'usado', 'el token abre una sola vez');
  ok(!c.ctx.pagVerToken_(r.id, t.replace(/.$/, x => (x === 'a' ? 'b' : 'a'))).ok, 'otro token no abre');
  ok(!c.ctx.pagVerToken_(r.id, '').ok, 'sin token no abre');
  ok(c.ctx.pagVerApi_({ email: 'ana@prueba.test' }, { id: r.id }).ok && c.ctx.pagVerApi_({ email: 'ana@prueba.test' }, { id: r.id }).ok, 'con sesión de administrador abre todas las veces');
}
/* 4 · vence a los 7 días y se borra */
{
  const c = caja();
  const r = c.ctx.pagExplicar_(JUAN, PEDIDO, 'hub'), t = tokenDe(r.enlace); c.ctx.pagProcesar();
  c.mover(7 * 24 * H - 60000);
  ok(c.ctx.pagVerApi_({ email: 'juan@prueba.test' }, { id: r.id }).ok, 'un minuto antes de los 7 días todavía abre');
  c.mover(120000);
  const v = c.ctx.pagVerApi_({ email: 'juan@prueba.test' }, { id: r.id });
  ok(!v.ok && v.estado === 'vencida', 'a los 7 días ya no abre con sesión');
  ok(c.ctx.pagVerToken_(r.id, t).estado === 'vencida', 'ni con el token');
  ok(c.ctx.pagLimpiar_() === 1 && c.hoja.filas.length === 1, 'pagLimpiar_ la borra de la hoja');
  ok(/try \{ pagLimpiar_\(\); \}/.test(COD.slice(COD.indexOf('function aprender()'))), 'la limpieza corre cada hora (aprender)');
}
/* 5 · tope diario */
{
  const c = caja();
  for (let i = 0; i < 10; i++) c.ctx.pagExplicar_(JUAN, { tema: 'tema ' + i }, 'hub');
  const once = c.ctx.pagExplicar_(JUAN, { tema: 'una más' }, 'hub');
  ok(!once.ok && /10 páginas hoy/.test(once.error), 'la página 11 del día no se crea (tope 10)');
  c.mover(24 * H);
  ok(c.ctx.pagExplicar_(JUAN, { tema: 'mañana' }, 'hub').ok, 'al día siguiente vuelve a haber');
  const c2 = caja({ props: { PAGINAS_TOPE: '2' } });
  c2.ctx.pagExplicar_(JUAN, { tema: 'a' }, 'hub'); c2.ctx.pagExplicar_(JUAN, { tema: 'b' }, 'hub');
  ok(!c2.ctx.pagExplicar_(JUAN, { tema: 'c' }, 'hub').ok, 'PAGINAS_TOPE cambia el tope sin PR');
}
/* 6 · HTML seguro */
{
  const c = caja();
  const s = c.ctx.pagHtmlSeguro_(HTML_MODELO);
  ok(!/<script[^>]*\bsrc/i.test(s.html), 'el HTML no trae scripts externos');
  ok(/<script>document\.getElementById/.test(s.html), 'el JavaScript en línea (la calculadora) se queda');
  ok(!/<iframe|<form|http-equiv="refresh"/i.test(s.html), 'sin marcos, formularios ni refresco');
  ok(/fonts\.googleapis\.com/.test(s.html) && !/otro\.example\/estilo\.css/.test(s.html), 'solo la hoja de Google Fonts');
  ok(/<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';/.test(s.html) && !/connect-src/.test(s.html), 'lleva la política de contenido que cierra la red (sin connect-src)');
  ok(s.quitados >= 6, 'cuenta lo quitado (' + s.quitados + ')');
  const c2 = caja({ html: HTML_MODELO });
  const r = c2.ctx.pagRobot_(PEDIDO);
  const h = c2.ctx.pagRobot_({ id: r.id, html: true }).html;
  ok(r.ok && r.estado === 'lista' && !/<script[^>]*\bsrc/i.test(h) && /Content-Security-Policy/.test(h), 'lo que arma el modelo pasa siempre por la limpieza antes de guardarse (robot)');
  ok(c2.ctx.pagRobot_({ borrar: r.id }).borrada && !c2.ctx.pagRobot_({ id: r.id }).ok, 'el robot borra la página de prueba');
}
/* 7 · cableado */
{
  ok(/T\('explicar_en_pagina', '[^']{20,90}', \{ tema: AG_S_, datos: AG_S_ \}, \['tema'\]\)/.test(AG), 'la herramienta explicar_en_pagina, descripción mínima (tema y datos)');
  ok(/case 'explicar_en_pagina': \{ var rPg = pagExplicar_\(adm, inp, AGENTE_CANAL_\)/.test(AG), 'agEjecutar_ la manda a pagExplicar_ con el canal');
  ok(/AG_SOLO_ESCRITO_ = \['explicar_en_pagina'\]/.test(AG) && /!\/\^\(calle\|llamada\)\$\/\.test\(canal\) \|\| AG_SOLO_ESCRITO_\.indexOf\(t\.name\) < 0/.test(AG), 'solo chat y WhatsApp: la llamada y el Modo calle no la ven');
  ok(/case 'paginaVer': return json_\(pagVerApi_\(ses, body\)\)/.test(COD), 'acción paginaVer con la sesión');
  ok(/if \(q\.pagina\) \{ cupoCanal_\('Otros'\); return json_\(pagVerToken_\(q\.pagina, q\.t\)\); \}/.test(COD), 'doGet abre con el token del enlace');
  ok(/JSON\.stringify\(PAG_PROMPT_\), user, null\)/.test(PAG), 'la página va sin temperature (el modelo medio la rechaza con 400)');
  ok(/case 'pagina_explicativa': return json_\(pagRobot_\(body\)\)/.test(COD), 'robot pagina_explicativa');
  ok(/try \{ pagProcesar_\(\); \}/.test(COD.slice(COD.indexOf('function procesarCola()'))), 'procesarCola es el respaldo del disparador');
  const marco = (PAGINA.match(/<iframe[^>]*>/) || [''])[0];
  ok(/sandbox="allow-scripts"/.test(marco) && !/allow-same-origin/.test(marco), 'alma/pagina.html la muestra en un marco aislado (sin allow-same-origin: no ve la sesión)');
  ok(/srcdoc = r\.html/.test(PAGINA) && !/innerHTML\s*=\s*r\.html/.test(PAGINA), 'el HTML va al marco, nunca al Hub');
  ok(/action: "paginaVer"/.test(PAGINA) && /\?pagina=/.test(PAGINA), 'la página usa la sesión y, si no hay, el token');
  const glos = fs.readFileSync(path.join(DIR, '..', 'docs', 'GLOSARIO.md'), 'utf8');
  ok(/\*\*Página explicativa\*\*/.test(glos), 'el glosario define «Página explicativa»');
}
process.exit(fallo);
