/* Prueba con dobles de «Reiniciar contraseña» (usuarios.html y login/apps-script/03-auth-endpoint.js, acción
   resetPassword). 16-nov-2026: la página llevaba escrita la llave compartida de las apps (pública, el repo es público) y
   no mandaba la sesión; el login ya exigía la sesión, así que el botón nunca reiniciaba nada. Revisa que:
   1. sin sesión, con una sesión inventada o vencida, o con solo la llave compartida: «session», y la hoja no se toca;
   2. con la sesión de alguien que no es administrador principal (equipo, socio, un principal suspendido): «forbidden»;
   3. con la sesión del administrador principal: sale un código temporal de 8 caracteres y la contraseña anterior deja de
      valer; no hace falta ninguna llave en el pedido;
   4. usuarios.html no lleva ninguna llave escrita y manda la sesión firmada.
   node .github/usuarios-reinicio.js [carpeta login/apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'login', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const CAB = ['user_id', 'nombre', 'email', 'email_alterno', 'estado', 'perm_mi', 'perm_epi', 'perm_grow', 'perm_hola', 'password_hash', 'actualizado'];
const USUARIOS = [CAB,
  ['U1', 'Admin', 'admin@prueba.test', '', 'activo', 'admin_principal', 'admin_principal', '', '', 'h1', ''],
  ['U2', 'Socio', 'socio@prueba.test', '', 'activo', 'socio', '', '', '', 'h2', ''],
  ['U3', 'Equipo', 'equipo@prueba.test', '', 'activo', '', 'admin_secundario', '', '', 'h3', ''],
  ['U4', 'Antes admin', 'antes@prueba.test', '', 'suspendido', 'admin_principal', '', '', '', 'h4', '']];
const escritos = [];
let uuid = 0;
const hoja = { getDataRange: () => ({ getValues: () => USUARIOS.map(r => r.slice()) }), getRange: (f, c) => ({ setValue: v => { escritos.push({ f, c, v }); } }) };
const ctx = {
  console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, Error, Buffer, isNaN, parseInt,
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { getUuid: () => ('0000000' + (++uuid * 7919).toString(16)).slice(-8) + '-a1b2-c3d4-e5f6-0123456789ab' },
  SpreadsheetApp: { openById: () => ({ getSheetByName: n => n === 'Usuarios' ? hoja : { getDataRange: () => ({ getValues: () => [['user email', 'secondary user email']] }) } }) }
};
vm.createContext(ctx);
const SRC = fs.readFileSync(path.join(DIR, '03-auth-endpoint.js'), 'utf8');
vm.runInContext(SRC, ctx, { filename: '03-auth-endpoint.js' });
/* Dobles de lo que no se prueba aquí: la firma (cada «sesión» de prueba es un texto) y el hash de la clave. */
const SESIONES = { 'ses-admin': { e: 'admin@prueba.test', exp: Date.now() + 1e6 }, 'ses-socio': { e: 'socio@prueba.test', exp: Date.now() + 1e6 },
  'ses-equipo': { e: 'equipo@prueba.test', exp: Date.now() + 1e6 }, 'ses-antes': { e: 'antes@prueba.test', exp: Date.now() + 1e6 } };
vm.runInContext('_verificarSesion = function (t) { return SES_[t] || null; }; _hashClave = function (c) { return "hash(" + c + ")"; };', Object.assign(ctx, { SES_: SESIONES }));
const pedir = b => ctx._handle({ postData: { contents: JSON.stringify(b) } });
const LLAVE = /var AUTH_TOKEN = [^\n]*\|\| '([^']+)'/.exec(SRC)[1];   // la llave compartida de las apps (pública)

/* ── 1 ── Sin sesión válida no pasa nada. */
for (const [b, caso] of [[{ action: 'resetPassword', email: 'socio@prueba.test' }, 'sin sesión ni llave'],
  [{ action: 'resetPassword', token: LLAVE, email: 'socio@prueba.test' }, 'solo con la llave compartida (lo que mandaba la página)'],
  [{ action: 'resetPassword', token: LLAVE, session: 'inventada', email: 'socio@prueba.test' }, 'con una sesión inventada o vencida']]) {
  const r = pedir(b);
  ok(r.ok === false && r.error === 'session' && !r.codigo, caso + ': «session», sin código');
}
ok(escritos.length === 0, 'y la hoja de usuarios no se toca');

/* ── 2 ── Con sesión, pero sin ser hoy administrador principal. */
for (const s of ['ses-socio', 'ses-equipo', 'ses-antes']) {
  const r = pedir({ action: 'resetPassword', token: LLAVE, session: s, email: 'socio@prueba.test' });
  ok(r.ok === false && r.error === 'forbidden' && !r.codigo, s + ' (no es administrador principal activo): «forbidden»');
}
ok(escritos.length === 0, 'tampoco se toca la hoja');

/* ── 3 ── El administrador principal, solo con su sesión (sin llave). */
{ const r = pedir({ action: 'resetPassword', session: 'ses-admin', email: 'socio@prueba.test' });
  ok(r.ok === true && /^[A-HJ-NP-Z2-9]{8}$/.test(r.codigo || '') && r.email === 'socio@prueba.test' && !!r.vence, 'el administrador principal, solo con su sesión: código temporal de 8 caracteres');
  const h = escritos.find(x => x.c === CAB.indexOf('password_hash') + 1);
  ok(h && h.f === 3 && /^reset\|\d+\|hash\(/.test(h.v) && h.v.indexOf(r.codigo) > 0, 'la contraseña anterior deja de valer: queda el código temporal en la fila de esa persona');
  ok(pedir({ action: 'resetPassword', session: 'ses-admin', email: 'nadie@prueba.test' }).error === 'no_user', 'un correo que no existe: «no_user»'); }
ok(pedir({ action: 'users', token: 'otra' }).error === 'token', 'las demás acciones siguen pidiendo la llave de las apps');

/* ── 4 ── La página. */
{ const html = fs.readFileSync(path.join(DIR, '..', '..', 'usuarios.html'), 'utf8');
  ok(html.indexOf(LLAVE) < 0 && !/token\s*:/.test(html), 'usuarios.html no lleva ninguna llave escrita');
  ok(/action: 'resetPassword', session: sesion, email: u\.email/.test(html) && /var sesion = SASesion\.leer\(\)/.test(html), 'usuarios.html manda la sesión firmada de quien está usando la página');
  ok(/if\(body\.action === 'resetPassword'\) return _resetPassword\(body\.session \? _verificarSesion\(body\.session\) : null, body\.email\);\s*\n\s*if\(body\.token !== AUTH_TOKEN\)/.test(SRC) && !/case 'resetPassword'/.test(SRC),
    'el login decide el reinicio por la sesión, antes de mirar la llave compartida, y en un solo lugar'); }
process.exit(fallo);
