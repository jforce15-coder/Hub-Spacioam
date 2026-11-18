/* Prueba con dobles: entrar nunca depende del cupo (Juan, 18-nov-2026: «El cupo nunca nos debería evitar que hagamos
   login. Siempre debemos tener un cupo en reserva»). Con Google sin cupo de UrlFetch revisa:
   1. Login (login/apps-script/03-auth-endpoint.js): entrar con contraseña, comprobar la sesión (verify) y Face ID
      funcionan sin ninguna llamada a internet. Si alguien agrega una llamada sin respaldo local, esto falla.
   2. Reserva (apps-script/cupo.js): desde CUPO_RESERVA_PCT_ (90 %) uf_/ufAll_ frenan lo no esencial sin gastar la llamada;
      entrar, huéspedes, WhatsApp, Epi, la voz y el chat siguen; CUPO_RESERVA_PCT = 0 o CUPO_PAUSAR = 0 la apagan; la
      propiedad CUPO_RESERVA_PAUSA nunca frena el login; sin nivel guardado no frena.
   3. El Hub entrega LOGIN_SECRETO a Docs, Epi, Grow y Mi por el canal «Login» (esencial) y sin llave no manda nada.
   (La sesión firmada del Hub sin cupo la revisa .github/sesion-sin-cupo.js; la de las apps, su .github/entrar-sin-cupo.js.)
   node .github/entrar-sin-cupo.js [carpeta raíz del repo] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const RAIZ = process.argv[2] || path.join(__dirname, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const GOOGLE = 'Exception: Service invoked too many times for one day: urlfetch.';
const firmados = b => Array.from(Buffer.from(b)).map(x => (x > 127 ? x - 256 : x));
const buf = b => Buffer.from((Array.isArray(b) ? b : Array.from(b)).map(x => x & 255));
const UT = {
  DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  base64EncodeWebSafe: b => buf(typeof b === 'string' ? firmados(Buffer.from(b)) : b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
  base64DecodeWebSafe: s => firmados(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
  computeDigest: (alg, d) => firmados(crypto.createHash('sha256').update(typeof d === 'string' ? Buffer.from(d, 'utf8') : buf(d)).digest()),
  computeHmacSha256Signature: (d, k) => firmados(crypto.createHmac('sha256', typeof k === 'string' ? k : buf(k)).update(typeof d === 'string' ? d : buf(d)).digest()),
  newBlob: b => ({ getDataAsString: () => (typeof b === 'string' ? b : buf(b).toString('utf8')), getBytes: () => firmados(Buffer.from(String(b), 'utf8')) }),
  getUuid: () => crypto.randomUUID(),
  formatDate: (d, tz, f) => { const x = new Date(d.getTime() - 6 * 3600000), p = n => String(n).padStart(2, '0');
    return f.replace('yyyy', x.getUTCFullYear()).replace('MM', p(x.getUTCMonth() + 1)).replace('dd', p(x.getUTCDate())).replace('HH', p(x.getUTCHours())).replace('mm', p(x.getUTCMinutes())).replace(/^H$/, String(x.getUTCHours())); }
};
const mem = () => { const m = {}; return { m, get: k => (k in m ? m[k] : null), put: (k, v) => { m[k] = String(v); }, remove: k => { delete m[k]; },
  getAll: ks => { const o = {}; ks.forEach(k => { if (k in m) o[k] = m[k]; }); return o; }, putAll: o => Object.assign(m, o) }; };

/* ── 1 ── Login: contraseña, verify y Face ID sin internet. */
{
  const SRC = fs.readFileSync(path.join(RAIZ, 'login', 'apps-script', '03-auth-endpoint.js'), 'utf8');
  const CAB = ['user_id', 'nombre', 'email', 'email_alterno', 'estado', 'perm_mi', 'perm_epi', 'perm_grow', 'perm_hola', 'password_hash', 'actualizado'];
  const USUARIOS = [CAB, ['U1', 'Juan', 'juan@prueba.test', '', 'activo', 'admin_principal', '', '', '', '', '']];
  const hoja = { getDataRange: () => ({ getValues: () => USUARIOS.map(r => r.slice()) }), getRange: () => ({ setValue() {} }) };
  const props = { SESSION_SECRET: 'y'.repeat(48) }, cache = mem(); let llamadas = 0;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, Buffer, isNaN, parseInt, BigInt, Utilities: UT,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => cache },
    UrlFetchApp: { fetch: () => { llamadas++; throw new Error(GOOGLE); }, fetchAll: () => { llamadas++; throw new Error(GOOGLE); } },
    MailApp: { sendEmail() { llamadas++; } }, GmailApp: { sendEmail() { llamadas++; } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => n === 'Usuarios' ? hoja : { getDataRange: () => ({ getValues: () => [['user email', 'secondary user email']] }) } }) }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: '03-auth-endpoint.js' });
  USUARIOS[1][9] = ctx._hashClave('Clave-de-prueba-77');
  const pedir = b => ctx._handle({ postData: { contents: JSON.stringify(Object.assign({ token: ctx.AUTH_TOKEN }, b)) } });
  const r = pedir({ action: 'login', email: 'juan@prueba.test', password: 'Clave-de-prueba-77' });
  ok(r.ok === true && r.session && llamadas === 0, 'Login sin cupo: entrar con contraseña no llama a internet');
  ok(pedir({ action: 'login', email: 'juan@prueba.test', password: 'otra' }).error === 'bad_pass', 'Login sin cupo: contraseña mala, no entra');
  const v = pedir({ action: 'verify', session: r.session });
  ok(v.ok === true && v.profile && v.profile.email === 'juan@prueba.test' && llamadas === 0, 'Login sin cupo: comprobar la sesión (verify) no llama a internet');
  const fe = ctx._faceEnroll(ctx._verificarSesion(r.session));
  const f = fe && fe.llave ? pedir({ action: 'faceLogin', email: 'juan@prueba.test', llave: fe.llave }) : { ok: false };
  ok(f.ok === true && llamadas === 0, 'Login sin cupo: Face ID no llama a internet');
}

/* ── 2 ── Reserva en cupo.js. */
{
  const SRC = fs.readFileSync(path.join(RAIZ, 'apps-script', 'cupo.js'), 'utf8');
  const props = {}, cache = mem(); let llamadas = 0;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, isNaN, Utilities: UT, CFG: { TZ: 'America/Guatemala', HUB_URL: 'https://hub' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => cache },
    UrlFetchApp: { fetch: () => { llamadas++; return { ok: 1 }; }, fetchAll: l => { llamadas += l.length; return l.map(() => ({ ok: 1 })); } },
    hojaCrear_: () => ({ getLastRow: () => 1, getRange: () => ({ setValues() {} }), deleteRows() {} }), ssAlma_: () => ({ getSheetByName: () => null })
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'cupo.js' });
  const nivel = pct => { cache.put('cupo_nivel', JSON.stringify({ pct, nivel: pct >= 85 ? 'critico' : 'verde' })); ctx.CUPO_RESERVA_MEMO_ = null; ctx.CUPO_MEMO_ = null; };
  const sale = canal => { const n = llamadas; try { ctx.uf_('https://ejemplo.test/x', {}, canal); } catch (e) { return llamadas > n ? 'rara' : /reserva/.test(e.message) ? 'frenada' : 'error'; } return llamadas > n ? 'sale' : 'rara'; };
  nivel(92);
  ok(sale('Mejoras y fondo') === 'frenada' && sale('Cerebro') === 'frenada', 'Reserva (92 %): lo de fondo y el cerebro se frenan sin gastar la llamada');
  ok(['Login', 'Huéspedes', 'WhatsApp', 'Epi', 'Voz', 'Chat de Alma'].every(c => sale(c) === 'sale'), 'Reserva (92 %): entrar, huéspedes, WhatsApp, Epi, la voz y el chat siguen');
  { const n = llamadas; let fr = false; try { ctx.ufAll_([{ url: 'https://a' }, { url: 'https://b' }], 'Mejoras y fondo'); } catch (e) { fr = /reserva/.test(e.message); }
    ok(fr && llamadas === n, 'Reserva (92 %): ufAll_ también frena lo de fondo sin gastar'); }
  props.CUPO_RESERVA_PAUSA = 'fondo,login,voz'; nivel(92);
  ok(sale('Login') === 'sale' && sale('Voz') === 'frenada', 'Reserva: la propiedad CUPO_RESERVA_PAUSA cambia lo que se frena, pero nunca el login');
  delete props.CUPO_RESERVA_PAUSA;
  nivel(80); ok(sale('Mejoras y fondo') === 'sale', 'Debajo del 90 %: la reserva no frena nada');
  props.CUPO_RESERVA_PCT = '0'; nivel(99); ok(sale('Mejoras y fondo') === 'sale', 'CUPO_RESERVA_PCT = 0 apaga la reserva');
  props.CUPO_RESERVA_PCT = '75'; nivel(80); ok(sale('Mejoras y fondo') === 'frenada', 'CUPO_RESERVA_PCT cambia el umbral sin PR');
  delete props.CUPO_RESERVA_PCT; props.CUPO_PAUSAR = '0'; nivel(99); ok(sale('Mejoras y fondo') === 'sale', 'CUPO_PAUSAR = 0 también la apaga (solo cuenta)');
  delete props.CUPO_PAUSAR; cache.remove('cupo_nivel'); ctx.CUPO_RESERVA_MEMO_ = null; ctx.CUPO_MEMO_ = null;
  ok(sale('Mejoras y fondo') === 'sale', 'Sin nivel guardado, la reserva no frena (nunca lo calcula dentro de una llamada)');
  ok(ctx.CUPO_RESERVA_PCT_ === 90, 'el umbral por defecto es 90 % de las últimas 24 h');
}

/* ── 3 ── El Hub entrega LOGIN_SECRETO por el canal «Login». */
{
  const SRC = fs.readFileSync(path.join(RAIZ, 'apps-script', 'entrarsincupo.js'), 'utf8');
  const props = {}, enviados = []; let canal = '';
  const ctx = {
    JSON, String, Object, Array, console: { warn() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    llaveRobot_: () => 'robot-prueba', ACCESOS_APPS_: { epi: () => 'https://epi', mi: () => 'https://mi', grow: () => 'https://grow', docs: () => 'https://docs', hola: () => 'https://hola' },
    ufAll_: (l, c) => { canal = c; enviados.push(...l); return l.map(() => ({ getContentText: () => '{"ok":true,"tiene":true}', getResponseCode: () => 200 })); }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'entrarsincupo.js' });
  ok(ctx.loginSecretoRepartir_(false).ok === false && enviados.length === 0, 'Entregar LOGIN_SECRETO: si el Hub no la tiene, no manda nada y lo dice');
  props.LOGIN_SECRETO = 's'.repeat(48);
  const r = ctx.loginSecretoRepartir_(false);
  ok(r.ok && canal === 'Login' && enviados.length === 4 && enviados.every(x => JSON.parse(x.payload).action === '__loginSecreto'), 'Entregar LOGIN_SECRETO: a Docs, Epi, Grow y Mi, por el canal «Login» (esencial)');
  enviados.length = 0; ctx.loginSecretoRepartir_(true);
  ok(enviados.length === 4 && enviados.every(x => !('secreto' in JSON.parse(x.payload))), 'Revisar: solo pregunta, sin mandar la llave');
}
process.exit(fallo);
