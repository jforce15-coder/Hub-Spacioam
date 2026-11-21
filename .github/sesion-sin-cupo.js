/* Prueba con dobles: entrar sin cupo de Google (17-nov-2026). Google cortó las llamadas a internet de la cuenta
   («Service invoked too many times for one day: urlfetch») y Juan no podía entrar: «Entrar con Google» del login
   pregunta a Google (tokeninfo) y el Hub comprueba la sesión llamando al login. Revisa, con Google sin cupo:
   1. Hub (apps-script/Código.js, sesionLogin_): sesión firmada válida → entra sin llamar a internet; firma inválida,
      vencida o sin LOGIN_SECRETO → no entra.
   2. Login (login/apps-script/03-auth-endpoint.js, _googleLogin): un ID token de Google con firma RS256 válida → entra
      (sesión firmada); firma mala, llave desconocida, vencido, de otro Client ID o de otro emisor → no entra.
   node .github/sesion-sin-cupo.js [carpeta raíz del repo] */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const RAIZ = process.argv[2] || path.join(__dirname, '..');
const CANDADO_ = fs.readFileSync(path.join(path.join(RAIZ, 'apps-script'), 'candado.js'), 'utf8') + '\n';   // el candado único (apps-script/candado.js)
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const GOOGLE = 'Exception: Service invoked too many times for one day: urlfetch.';
const sacar = (src, nombre) => { const m = new RegExp('\\nfunction ' + nombre + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(src); if (!m) throw new Error('no encontré ' + nombre); return m[0]; };

/* Utilities de Apps Script con Node (bytes con signo, como en Google). */
const firmados = b => Array.from(Buffer.from(b)).map(x => (x > 127 ? x - 256 : x));
const buf = b => Buffer.from((Array.isArray(b) ? b : Array.from(b)).map(x => x & 255));
const UT = {
  DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  base64EncodeWebSafe: b => buf(typeof b === 'string' ? firmados(Buffer.from(b)) : b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
  base64DecodeWebSafe: s => firmados(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
  computeDigest: (alg, d) => firmados(crypto.createHash('sha256').update(typeof d === 'string' ? Buffer.from(d, 'utf8') : buf(d)).digest()),
  computeHmacSha256Signature: (d, k) => firmados(crypto.createHmac('sha256', k).update(d).digest()),
  newBlob: b => ({ getDataAsString: () => (typeof b === 'string' ? b : buf(b).toString('utf8')), getBytes: () => firmados(Buffer.from(String(b), 'utf8')) }),
  getUuid: () => crypto.randomUUID()
};
const b64u = x => Buffer.from(x).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/* ── 1 ── Hub. */
{
  const SRC = fs.readFileSync(path.join(RAIZ, 'apps-script', 'Código.js'), 'utf8');
  const SECRETO = 'x'.repeat(48);
  const props = { LOGIN_SECRETO: SECRETO }, cache = {}; let llamadas = 0;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, Utilities: UT,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getUserLock: () => ({ hasLock: () => false, tryLock: () => true, releaseLock() {} }) },
    uf_: () => { llamadas++; throw new Error(GOOGLE); }, cupoAgotado_: () => true
  };
  vm.createContext(ctx);
  vm.runInContext(CANDADO_ + 'const LOGIN_URL_ = "https://login";' + sacar(SRC, 'sesionLogin_') + sacar(SRC, 'sesionLoginRemota_') + sacar(SRC, 'sesionLocal_'), ctx);
  const firmar = (d, sec) => { const c = b64u(JSON.stringify(d)); return c + '.' + b64u(crypto.createHmac('sha256', sec).update(c).digest()); };
  const prof = { email: 'juan@prueba.test', nombre: 'Juan', apps: { hub: 'admin_principal' } };
  const vale = firmar({ e: prof.email, n: 'Juan', apps: prof.apps, p: prof, iat: Date.now(), exp: Date.now() + 864e5 }, SECRETO);
  const r1 = ctx.sesionLogin_(vale);
  ok(r1 && r1.email === 'juan@prueba.test' && llamadas === 0, 'Hub sin cupo: sesión firmada válida entra, sin llamar a internet');
  ok(ctx.sesionLogin_(firmar({ e: prof.email, p: prof, exp: Date.now() + 864e5 }, 'otra-llave-'.repeat(5))) === null, 'Hub sin cupo: firma con otra llave, no entra');
  ok(ctx.sesionLogin_(vale.slice(0, -3) + 'AAA') === null, 'Hub sin cupo: firma alterada, no entra');
  ok(ctx.sesionLogin_(firmar({ e: prof.email, p: prof, exp: Date.now() - 1000 }, SECRETO)) === null, 'Hub sin cupo: sesión vencida, no entra');
  ok(ctx.sesionLogin_('sin-firma') === null, 'Hub sin cupo: texto sin firma, no entra');
  delete props.LOGIN_SECRETO; for (const k in cache) delete cache[k];
  ok(ctx.sesionLogin_(vale) === null, 'Hub sin cupo y sin LOGIN_SECRETO: no entra (no se abre nada)');
}

/* ── 2 ── Login: entrar con Google sin cupo. */
{
  const SRC = fs.readFileSync(path.join(RAIZ, 'login', 'apps-script', '03-auth-endpoint.js'), 'utf8');
  const CAB = ['user_id', 'nombre', 'email', 'email_alterno', 'estado', 'perm_mi', 'perm_epi', 'perm_grow', 'perm_hola', 'password_hash', 'actualizado'];
  const USUARIOS = [CAB, ['U1', 'Juan', 'juan@prueba.test', '', 'activo', 'admin_principal', '', '', '', 'h1', '']];
  const hoja = { getDataRange: () => ({ getValues: () => USUARIOS.map(r => r.slice()) }), getRange: () => ({ setValue() {} }) };
  const props = { SESSION_SECRET: 'y'.repeat(48), GOOGLE_CLIENT_IDS: 'cliente-hub' }; let llamadas = 0;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, Buffer, isNaN, parseInt, BigInt, Utilities: UT,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    UrlFetchApp: { fetch: () => { llamadas++; throw new Error(GOOGLE); } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => n === 'Usuarios' ? hoja : { getDataRange: () => ({ getValues: () => [['user email', 'secondary user email']] }) } }) }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: '03-auth-endpoint.js' });
  const par = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const A = par(), B = par(), jwkA = A.publicKey.export({ format: 'jwk' });
  props.GOOGLE_LLAVES = JSON.stringify({ t: Date.now(), keys: [{ kid: 'k-a', n: jwkA.n, e: jwkA.e }] });
  const token = (o, llave, kid) => {
    const c = b64u(JSON.stringify({ alg: 'RS256', kid: kid || 'k-a', typ: 'JWT' })) + '.' + b64u(JSON.stringify(Object.assign(
      { iss: 'https://accounts.google.com', aud: 'cliente-hub', email: 'juan@prueba.test', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600 }, o || {})));
    return c + '.' + b64u(crypto.sign('sha256', Buffer.from(c), (llave || A).privateKey));
  };
  const pedir = cred => ctx._handle({ postData: { contents: JSON.stringify({ action: 'googleLogin', token: ctx.AUTH_TOKEN, credential: cred }) } });
  const r = pedir(token());
  ok(r.ok === true && r.profile && r.profile.email === 'juan@prueba.test' && ctx._verificarSesion(r.session) && llamadas >= 1,
    'Login sin cupo: token de Google con firma válida entra y recibe su sesión firmada');
  ok(pedir(token({}, B)).error === 'google', 'Login sin cupo: token firmado con otra llave, no entra');
  ok(pedir(token({}, A, 'desconocida')).error === 'google', 'Login sin cupo: llave que no es de Google, no entra');
  { const t = token().split('.'); t[1] = b64u(JSON.stringify({ iss: 'accounts.google.com', aud: 'cliente-hub', email: 'otro@prueba.test', email_verified: true, exp: 9e9 }));
    ok(pedir(t.join('.')).error === 'google', 'Login sin cupo: datos cambiados después de firmar, no entra'); }
  ok(pedir(token({ exp: Math.floor(Date.now() / 1000) - 60 })).error === 'google', 'Login sin cupo: token vencido, no entra');
  ok(pedir(token({ aud: 'otra-app' })).error === 'google_client', 'Login sin cupo: token de otra app (Client ID), no entra');
  ok(pedir(token({ iss: 'https://otro.example' })).error === 'google', 'Login sin cupo: emisor que no es Google, no entra');
  ok(pedir(token({ email_verified: false })).error === 'google', 'Login sin cupo: correo sin verificar, no entra');
  ok(pedir('basura').error === 'google', 'Login sin cupo: texto cualquiera, no entra');
  ok(Array.isArray(ctx.GOOGLE_LLAVES_SEMILLA) && ctx.GOOGLE_LLAVES_SEMILLA.every(k => k.kid && k.n && k.e === 'AQAB'), 'las llaves semilla son solo públicas (kid, n, e)');
}
process.exit(fallo);
