/* Acceso cerrado a la voz de Alma (apps-script/vozacceso.js, js/alma-voz.js), con dobles de ElevenLabs, de Google y del
   navegador: sin internet. 12-nov-2026: el agente aceptaba conversaciones con solo su id (enable_auth = false) y el id está
   en el repo público, así que cualquiera podía abrir una llamada con una ficha {{quien_llama}} falsa. Revisa:
   1. nadie abre la conversación con solo el id: ni agentId en las páginas ni la dirección wss con ?agent_id=;
   2. la app web (alma-voz.js) se conecta siempre con la URL firmada: la primera vez la trae la ficha, después usa la
      pedida por adelantado (sin esperar al Hub), cada una una sola vez, y sin URL firmada no se conecta;
   3. el Hub da la URL firmada solo con la sesión verificada de un administrador (vozWeb y vozFirma);
   4. la sincronización deja enable_auth en true con un PATCH que solo toca auth (la lista de orígenes queda), no repite
      si nada cambió, lo vuelve a poner si alguien lo apagó y corre cada 30 min con el prompt.
   node .github/voz-acceso.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script'), RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(f, 'utf8');

/* 1. Nadie abre la conversación con solo el id */
{ const archivos = [];
  const recorrer = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(\.git|node_modules|vendor)$/.test(e.name)) recorrer(f); }
    else if (/\.(js|html|mjs)$/.test(e.name) && !f.startsWith(path.join(RAIZ, '.github'))) archivos.push(f);
  });
  recorrer(RAIZ);
  const conId = archivos.filter(f => /\bagentId\s*:/.test(leer(f)));
  ok(!conId.length, 'ninguna página abre la voz con agentId (solo con signedUrl)' + (conId.length ? ': ' + conId.map(f => path.relative(RAIZ, f)).join(', ') : ''));
  const wss = archivos.filter(f => /wss:\/\/api\.elevenlabs\.io\/v1\/convai\/conversation\?agent_id/.test(leer(f)));
  ok(!wss.length, 'nadie arma la dirección wss con ?agent_id=' + (wss.length ? ': ' + wss.map(f => path.relative(RAIZ, f)).join(', ') : '')); }

/* 2. La app web: alma-voz.js con dobles del navegador, del Hub y del SDK de ElevenLabs */
function navegador(hub) {
  const ls = {}, timers = [], sesiones = [], llamadas = [];
  const w = {
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    addEventListener() {}, setTimeout: (f, ms) => { timers.push(f); return timers.length; },
    ALMA: {
      vozWeb: () => { llamadas.push('vozWeb'); return Promise.resolve(hub.vozWeb()); },
      vozFirma: () => { llamadas.push('vozFirma'); return Promise.resolve(hub.vozFirma()); }
    },
    Audio: function () { this.play = () => Promise.resolve(); }
  };
  const sdk = { Conversation: { startSession: opt => { sesiones.push(opt); return Promise.resolve({ endSession() {}, getOutputVolume: () => 0 }); } } };
  const ctx = Object.assign(w, {
    window: w, document: { currentScript: { src: 'https://hub.x/js/alma-voz.js' }, addEventListener() {}, visibilityState: 'visible' },
    location: { href: 'https://hub.x/' }, URL, JSON, Date, Math, String, Number, Object, Array, RegExp, Promise, Error, console,
    __importar: () => Promise.resolve(sdk)
  });
  ctx.setTimeout = (f, ms) => { if (ms >= 1000) { timers.push(f); return 0; } return setTimeout(f, 0); };
  vm.createContext(ctx);
  vm.runInContext(leer(path.join(RAIZ, 'js', 'alma-voz.js')).replace(/\bimport\(SDK\)/g, '__importar(SDK)'), ctx);
  const h = { status() {}, message() {}, ended() {}, error() {} };
  return { w, ls, timers, sesiones, llamadas, start: () => w.SAAlmaVoz.start(h) };
}
const FICHA = n => ({ ok: true, agent_id: 'agent_x', dynamic_variables: { quien_llama: 'ficha' }, first_message: 'Hola', signed_url: 'wss://ficha' + n });
const espera = () => new Promise(r => setTimeout(r, 20));

(async () => {
  { // la primera vez: sin ficha guardada; la ficha trae la URL firmada y no hace falta otra vuelta al Hub
    let n = 0; const b = navegador({ vozWeb: () => FICHA(++n), vozFirma: () => ({ ok: true, signed_url: 'wss://firma' }) });
    await b.start();
    const o = b.sesiones[0] || {};
    ok(o.signedUrl === 'wss://ficha1' && !('agentId' in o), 'la primera llamada se conecta con la URL firmada de la ficha, sin agentId');
    ok(b.llamadas.join() === 'vozWeb', 'la primera llamada no pide otra URL aparte (una sola vuelta al Hub)');
    ok(o.dynamicVariables && /ficha/.test(o.dynamicVariables.quien_llama), 'la ficha del Hub va en las variables de la llamada');
    // la segunda: la URL de la ficha ya se usó; la renovación de fondo trae otra y queda guardada
    await espera();
    const guardada = JSON.parse(b.ls['sa_alma_voz_ficha:firma'] || 'null');
    ok(!guardada || guardada.u !== 'wss://ficha1', 'una URL firmada se usa una sola vez (no se vuelve a guardar la ya usada)');
  }
  { // con ficha guardada y URL pedida por adelantado: no espera al Hub
    let n = 0; const b = navegador({ vozWeb: () => FICHA(++n), vozFirma: () => ({ ok: true, signed_url: 'wss://firma' + (++n) }) });
    b.ls.sa_alma_voz_ficha = JSON.stringify({ t: Date.now(), agent_id: 'agent_x', dynamic_variables: { quien_llama: 'ficha' } });
    ok(b.timers.length >= 1, 'al abrir la página se agenda pedir la URL por adelantado');
    b.timers.forEach(f => f()); await espera();
    ok(b.llamadas.join() === 'vozFirma' && /wss:\/\/firma/.test(b.ls['sa_alma_voz_ficha:firma'] || ''), 'por adelantado: pide solo la URL firmada (vozFirma) y la guarda');
    b.llamadas.length = 0;
    await b.start();
    ok(b.sesiones[0].signedUrl === 'wss://firma1' && !('agentId' in b.sesiones[0]), 'la llamada usa la URL pedida por adelantado');
    ok(b.llamadas.indexOf('vozFirma') < 0, 'con la URL ya guardada, la llamada no espera otra al Hub');
    ok(!b.ls['sa_alma_voz_ficha:firma'] || JSON.parse(b.ls['sa_alma_voz_ficha:firma']).u !== 'wss://firma1', 'la URL usada se borra');
    b.ls['sa_alma_voz_ficha:firma'] = JSON.stringify({ t: Date.now() - 10 * 60e3, u: 'wss://vieja' });
    await b.start();
    ok(b.sesiones[1].signedUrl !== 'wss://vieja', 'una URL de más de 9 min no se usa (ElevenLabs da 15)');
  }
  { // el Hub no da la URL liviana (versión anterior o error): la trae la ficha
    let n = 0; const b = navegador({ vozWeb: () => FICHA(++n), vozFirma: () => ({ ok: false, error: 'accion' }) });
    b.ls.sa_alma_voz_ficha = JSON.stringify({ t: Date.now(), agent_id: 'agent_x', dynamic_variables: {} });
    await b.start();
    ok(/^wss:\/\/ficha/.test(b.sesiones[0].signedUrl), 'sin vozFirma, la URL firmada sale de la ficha completa');
  }
  { // sin URL firmada no hay llamada (nunca con solo el id)
    const b = navegador({ vozWeb: () => ({ ok: true, agent_id: 'agent_x', dynamic_variables: {} }), vozFirma: () => ({ ok: false, error: 'ElevenLabs 500' }) });
    let err = null; try { await b.start(); } catch (e) { err = e; }
    ok(err && !b.sesiones.length, 'sin URL firmada no se conecta (no cae a agentId)');
  }

  /* 3. El Hub: la URL firmada solo con la sesión verificada de un administrador */
  { const { armar } = require('./prompts-armados.js');
    const a = armar(DIR), ctx = a._ctx, R = c => vm.runInContext(c, ctx);
    const mem = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agente' }, pedidas = [];
    ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in mem ? mem[k] : null), setProperty: (k, v) => { mem[k] = String(v); }, deleteProperty() {} }) };
    const ufBase = ctx.uf_;
    ctx.uf_ = (url, o) => { if (/get-signed-url/.test(url)) { pedidas.push(url); return { getResponseCode: () => 200, getContentText: () => '{"signed_url":"wss://firmada"}' }; } return ufBase(url, o); };
    const JUAN = { email: 'juan@x', nombre: 'Juan', principal: true, tels: ['50211110000'] };
    Object.assign(ctx, {
      vozLookup_: () => ({}), adminsOp_: () => [JUAN], adminPorTel_: () => JUAN, contextoReciente_: () => null, encargoAbierto_: () => null,
      vozWebAdmin_: ses => (ses && ses.email === 'juan@x' ? JUAN : null), vozWebFicha_: () => 'ficha', saludosVoz_: () => [],
      calleSueno_: () => ({}), personalidadFicha_: () => null, retFicha_: () => null, vozWebToken_: () => 'tok', vozWebTiempos_: () => {}
    });
    const ini = (ses, ligero) => { ctx.SES_ = ses; return R('vozWebInicio_(SES_, ' + !!ligero + ', false)'); };
    ok(ini({ email: 'juan@x' }, true).signed_url === 'wss://firmada' && ini({ email: 'juan@x' }, false).signed_url === 'wss://firmada', 'la ficha (también la «ligera») trae siempre la URL firmada');
    pedidas.length = 0;
    const sin = ini(null, true);
    ok(sin.ok === false && !sin.signed_url && !pedidas.length, 'sin sesión (solo la llave antigua) no hay ficha ni URL firmada');
    ok(sin.error !== 'session', 'el aviso sin sesión no es «session» (ese cierra la sesión del navegador)');
    ok(ini({ email: 'nadie@x' }, true).ok === false && !pedidas.length, 'una sesión que no es de administrador no recibe URL firmada');
    ctx.SES_ = { email: 'juan@x' };
    ok(R('vozWebUrlApi_(SES_)').signed_url === 'wss://firmada', 'vozFirma: un administrador con sesión recibe la URL firmada');
    ctx.SES_ = null; ok(R('vozWebUrlApi_(SES_)').ok === false, 'vozFirma sin sesión: no');
    ctx.SES_ = { email: 'nadie@x' }; ok(R('vozWebUrlApi_(SES_)').ok === false, 'vozFirma con otra sesión: no');
    const cod = leer(path.join(DIR, 'Código.js')), cupo = leer(path.join(DIR, 'cupo.js'));
    ok(/case 'vozFirma': return json_\(vozWebUrlApi_\(ses\)\)/.test(cod), 'la acción vozFirma del Hub usa la sesión verificada');
    ok(/CUPO_ACC_ALMA_ = \[[^\]]*'vozFirma'/.test(cupo) && /voz: '[^']*\bvozFirma\b/.test(cupo), 'vozFirma cuenta como voz de Alma en el cupo (no se pausa)');
  }

  /* 4. La sincronización de enable_auth */
  function caja(props, agente) {
    const llamadas = [];
    const ctx = {
      console: { log() {}, error() {} }, JSON, Date, Math, String, Number, Object, encodeURIComponent,
      PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
      uf_: (url, o) => {
        o = o || {}; llamadas.push({ url, metodo: o.method || 'get', cuerpo: o.payload ? JSON.parse(o.payload) : null });
        if ((o.method || 'get') === 'get') return { getResponseCode: () => agente.get || 200, getContentText: () => JSON.stringify({ platform_settings: { auth: agente.auth, guardrails: { x: 1 } } }) };
        const code = agente.patch || 200;
        if (code < 300) agente.auth = JSON.parse(o.payload).platform_settings.auth;
        return { getResponseCode: () => code, getContentText: () => (code < 300 ? '{}' : '{"detail":"mal"}') };
      }
    };
    vm.createContext(ctx); vm.runInContext(leer(path.join(DIR, 'vozacceso.js')), ctx);
    return { ctx, llamadas };
  }
  { const c = caja({}, { auth: { enable_auth: false } });
    ok(c.ctx.vozAccesoSiCambio_(false).ok === false && !c.llamadas.length, 'sin ELEVENLABS_KEY: no llama a ElevenLabs'); }
  { const props = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agente' }, ag = { auth: { enable_auth: false, allowlist: [{ hostname: 'hub.spacioam.com' }], shareable_token: 's' } }, c = caja(props, ag);
    const r = c.ctx.vozAccesoSiCambio_(false), patch = c.llamadas.filter(l => l.metodo === 'patch');
    ok(r.ok && patch.length === 1 && ag.auth.enable_auth === true, 'la primera vez: un solo PATCH que deja enable_auth en true');
    const b = patch[0].cuerpo;
    ok(Object.keys(b).join() === 'platform_settings' && Object.keys(b.platform_settings).join() === 'auth', 'el PATCH solo toca platform_settings.auth (protecciones, prompt y voz quedan)');
    ok(JSON.stringify(ag.auth.allowlist) === '[{"hostname":"hub.spacioam.com"}]' && ag.auth.shareable_token === 's', 'la lista de orígenes y lo demás de auth quedan como estaban');
    const antes = c.llamadas.length; c.ctx.vozAccesoSiCambio_(false);
    ok(c.llamadas.length === antes, 'si nada cambió: no vuelve a llamar (huella)');
    props.VOZ_ACCESO_T = String(Date.now() - 25 * 3600000); c.ctx.vozAccesoSiCambio_(false);
    ok(c.llamadas.length === antes + 1 && c.llamadas[antes].metodo === 'get', 'una vez al día lo lee y, si sigue cerrado, no lo cambia');
    ag.auth.enable_auth = false; c.ctx.vozAccesoSiCambio_(true);
    ok(ag.auth.enable_auth === true && c.llamadas.filter(l => l.metodo === 'patch').length === 2, 'si alguien lo abrió a mano, lo vuelve a cerrar'); }
  { const props = { ELEVENLABS_KEY: 'k', ELEVENLABS_AGENT_ID: 'agente' }, c = caja(props, { auth: {}, patch: 422 });
    const r = c.ctx.vozAccesoSiCambio_(false);
    ok(!r.ok && /422/.test(r.error) && !props.VOZ_ACCESO_HUELLA, 'si ElevenLabs rechaza el cambio: lo dice y lo reintenta en la siguiente vuelta (sin huella)'); }
  { const voz = leer(path.join(DIR, 'voz.js')), cod = leer(path.join(DIR, 'Código.js'));
    const sync = (voz.match(/function vozSyncSiToca_\(\) \{[\s\S]*?\n\}/) || [''])[0];
    ok(/vozAccesoSiCambio_\(false\)/.test(sync), 'corre cada 30 min con el prompt (vozSyncSiToca_)');
    ok(/case 'voz_sync':[^\n]*vozAccesoSiCambio_\(true\)/.test(cod), 'el robot voz_sync también lo aplica'); }

  process.exit(fallo);
})().catch(e => { console.log('::error::' + (e && e.stack || e)); process.exit(1); });
