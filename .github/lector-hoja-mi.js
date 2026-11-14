/* Prueba con dobles del lector de hojas del login (login/apps-script/03-auth-endpoint.js, acción «hoja») con la hoja de
   Mi, que deja de ser pública (14-nov-2026): tiene SETUP (correos de los socios) y los números del negocio.
   1. La lee entera solo quien HOY es administrador principal de Mi en Control de usuarios (no basta lo que diga la sesión).
   2. Un socio, alguien del equipo, un admin principal de otra app o un usuario suspendido: «hoja_no_permitida», sin datos.
   3. Las demás hojas siguen igual (cualquier sesión firmada).
   node .github/lector-hoja-mi.js [carpeta login/apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'login', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const MI = '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4', ALMA = '1K8_MUCmJ4_Ks4DMKLSCbua1qC7X6QuilRaMvCquZ7kk';
const USUARIOS = [
  ['user_id', 'nombre', 'email', 'email_alterno', 'estado', 'perm_mi', 'perm_epi', 'perm_grow', 'perm_hola', 'password_hash'],
  ['U1', 'Admin', 'admin@prueba.test', '', 'activo', 'admin_principal', 'admin_principal', '', '', 'h'],
  ['U2', 'Socio', 'socio@prueba.test', '', 'activo', 'socio', '', '', '', 'h'],
  ['U3', 'Equipo', 'equipo@prueba.test', '', 'activo', '', 'admin_secundario', '', 'admin_principal', 'h'],
  ['U4', 'Antes admin', 'antes@prueba.test', '', 'suspendido', 'admin_principal', '', '', '', 'h']];
let pedidos = 0;
const ctx = {
  console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, Buffer, isNaN,
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => { const c = {}; return { get: k => c[k] ?? null, put: (k, v) => { c[k] = v; }, remove() {} }; } },
  Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (a, t) => Array.from(require('crypto').createHash(a).update(String(t)).digest()),
    base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url'), parseCsv: t => t.split('\n').map(l => l.split(',')) },
  ScriptApp: { getOAuthToken: () => 'token' },
  UrlFetchApp: { fetch: () => { pedidos++; return { getResponseCode: () => 200, getContentText: () => 'col_a,col_b\n1,2' }; } },
  SpreadsheetApp: { openById: id => ({ getSheetByName: n => n === 'Usuarios'
    ? { getDataRange: () => ({ getValues: () => USUARIOS.map(r => r.slice()) }) }
    : { getDataRange: () => ({ getValues: () => [['user email', 'secondary user email']] }) } }) }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, '03-auth-endpoint.js'), 'utf8'), ctx, { filename: '03-auth-endpoint.js' });
const ses = e => ({ e, apps: { mi: 'admin_principal' }, exp: Date.now() + 1e6 });   // la sesión dice admin; manda la hoja de hoy
const q = id => id + '/gviz/tq?tqx=out:csv&sheet=SETUP';

const admin = ctx._hoja(ses('admin@prueba.test'), q(MI));
ok(admin.ok && /col_a/.test(admin.csv), 'el administrador principal de Mi lee la hoja de Mi');
const n0 = pedidos;
const otros = ['socio@prueba.test', 'equipo@prueba.test', 'antes@prueba.test', 'nadie@prueba.test'].map(e => ctx._hoja(ses(e), q(MI)));
ok(otros.every(r => r.ok === false && r.error === 'hoja_no_permitida' && !r.csv) && pedidos === n0,
  'un socio, alguien del equipo (admin de otra app), un suspendido o un desconocido: «hoja_no_permitida», sin leer nada');
ok(ctx._hoja(null, q(MI)).error === 'session', 'sin sesión: «session»');
const alma = ctx._hoja(ses('equipo@prueba.test'), q(ALMA));
ok(alma.ok && /col_a/.test(alma.csv), 'las demás hojas siguen igual (ALMA con cualquier sesión firmada)');
process.exit(fallo);
