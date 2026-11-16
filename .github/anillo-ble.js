/* Diagnóstico del anillo por Bluetooth (ticket #29 paso 1, apps-script/anillo.js) con dobles: sin hoja ni Google.
   Juan, 16-nov-2026: el anillo llega como control de música y Spotify se lo quita; antes de leerlo directo hay que saber
   qué manda. La app (DiagnosticoAnillo.swift) manda el registro con «Mandar al Hub» (action anilloBle).
   1. Solo con la sesión de un administrador; sin ella no se guarda nada.
   2. Se guarda el último diagnóstico por usuario en ANILLO_BLE_<clave> (la clave no es el correo) y el robot lo lee con
      «anillo» (campo ble), aunque la hoja ALMA_ANILLO esté vacía.
   3. Sin datos personales: solo los campos conocidos, nombre «de …» fuera, sin correos ni teléfonos, hex y UUID limpios.
   4. El recorte: cabe en una propiedad (8500), se van los datos más viejos y las marcas se quedan.
   5. El gancho en Código.js y la fila en Ajustes (alma/inicio.html), solo con una app que lo sabe abrir.
   node .github/anillo-ble.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
const RAIZ = path.join(DIR, '..');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const JUAN = { email: 'juan@x.com', nombre: 'Juan', principal: true, tels: ['50200000000'] };

function caja() {
  const props = {}, cache = {};
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
    vozWebAdmin_: s => (s && s.email === JUAN.email ? JUAN : null),
    retClave_: a => 'VOZ_RET_' + Buffer.from(a.email).toString('base64url').slice(0, 16),
    ssAlma_: () => ({ getSheetByName: () => null }), hojaCrear_: () => ({ appendRow() {} })
  };
  vm.createContext(ctx);
  vm.runInContext(leer('anillo.js'), ctx, { filename: 'anillo.js' });
  return { ctx, props };
}

const diag = n => ({
  v: 1, f: '2026-11-16T10:00:00Z', app: '1.0 (80)',
  dispositivo: { nombre: 'COLMI R02_1A2B', fabricante: 'COLMI', modelo: 'R02', firmware: '3.1', senal: -58, porHID: true },
  veredicto: { clave: 'propio', texto: 'Este anillo tiene servicios propios que sí se pueden leer (6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E).' },
  servicios: [{ uuid: '180F', nombre: 'Batería', propio: false, car: [{ uuid: '2A19', props: 'read,notify', valor: '5a' }] },
    { uuid: '6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E', nombre: 'Propio del fabricante', propio: true, car: [{ uuid: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E', props: 'notify' }] }],
  eventos: Array.from({ length: n }, (_, i) => ({ t: i * 0.1, s: '6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E', c: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E', hex: '1d0102030405060708090a0b0c0d0e0f' })),
  marcas: [{ t: 1.2, gesto: '1 toque' }, { t: 5, gesto: '2 toques' }, { t: 9, gesto: 'largo' }],
  sin_datos: 0, recortados: 0
});

/* ── 1. Solo con sesión ── */
{
  const { ctx, props } = caja();
  const r = ctx.anilloBleGuardar_(null, { diagnostico: diag(3) });
  ok(!r.ok && r.error === 'usuario' && !Object.keys(props).length, '1 · sin la sesión de un administrador no se guarda nada');
  const r2 = ctx.anilloBleGuardar_({ email: JUAN.email }, {});
  ok(!r2.ok && r2.error === 'vacio', '1 · sin diagnóstico, nada');
}

/* ── 2. Guardar y leer ── */
{
  const { ctx, props } = caja();
  const r = ctx.anilloBleGuardar_({ email: JUAN.email }, { diagnostico: diag(5) });
  const k = Object.keys(props).filter(x => x.indexOf('ANILLO_BLE_') === 0);
  ok(r.ok && r.eventos === 5 && k.length === 1 && k[0].indexOf('@') < 0 && k[0].indexOf('juan') < 0, '2 · se guarda por usuario en ANILLO_BLE_<clave> (la clave no es el correo)');
  const leido = ctx.anilloLeer_(30);
  const b = leido.ble && leido.ble[k[0].slice(11)];
  ok(leido.ok && b && b.eventos.length === 5 && b.veredicto.clave === 'propio' && b.dispositivo.modelo === 'R02' && b.marcas.length === 3, '2 · el robot lo lee con «anillo» (campo ble) aunque la hoja esté vacía');
  ok(Array.isArray(leido.filas) && leido.filas.length === 0 && typeof leido.app === 'object', '2 · «anillo» sigue dando filas y app como antes');
  const otro = diag(2); otro.veredicto = { clave: 'solo_hid', texto: 'Este anillo solo habla como teclado; iOS no deja leerlo directo.' };
  ctx.anilloBleGuardar_({ email: JUAN.email }, { diagnostico: otro });
  const b2 = ctx.anilloLeer_(30).ble[k[0].slice(11)];
  ok(Object.keys(props).filter(x => x.indexOf('ANILLO_BLE_') === 0).length === 1 && b2.veredicto.clave === 'solo_hid' && b2.eventos.length === 2, '2 · solo el último diagnóstico (el nuevo reemplaza al anterior)');
}

/* ── 3. Sin datos personales ── */
{
  const { ctx, props } = caja();
  const d = diag(2);
  d.dispositivo.nombre = 'iPhone de Ana'; d.dispositivo.fabricante = 'ana@x.com'; d.dispositivo.modelo = '+502 5555 1234';
  d.huesped = 'Ana Pérez'; d.eventos[0].hex = '01<script>zz'; d.servicios[0].uuid = 'javascript:180F'; d.veredicto.clave = 'otra';
  ctx.anilloBleGuardar_({ email: JUAN.email }, { diagnostico: d });
  const g = JSON.parse(Object.values(props)[0]);
  ok(g.dispositivo.nombre === '(nombre quitado)', '3 · «iPhone de Ana»: el nombre se quita');
  ok(g.dispositivo.fabricante === '(correo)' && g.dispositivo.modelo === '(número)', '3 · sin correos ni teléfonos');
  ok(!('huesped' in g) && JSON.stringify(g).indexOf('Ana') < 0, '3 · solo los campos conocidos');
  ok(g.eventos[0].hex === '01c' && /^[0-9A-F-]+$/.test(g.servicios[0].uuid) && g.veredicto.clave === 'nada', '3 · hex, UUID y veredicto limpios');
  const r = ctx.anilloBleGuardar_({ email: JUAN.email }, { diagnostico: diag(1) });
  ok(r.ok && JSON.parse(Object.values(props)[0]).dispositivo.nombre === 'COLMI R02_1A2B', '3 · el modelo del anillo sí se queda');
}

/* ── 4. El recorte ── */
{
  const { ctx, props } = caja();
  const r = ctx.anilloBleGuardar_({ email: JUAN.email }, { diagnostico: diag(2000) });
  const txt = Object.values(props)[0], g = JSON.parse(txt);
  ok(r.ok && txt.length <= ctx.ANILLO_BLE_MAX_, '4 · cabe en una propiedad (' + txt.length + ' ≤ ' + ctx.ANILLO_BLE_MAX_ + ')');
  ok(g.recortados > 0 && r.recortados === g.recortados && g.eventos.length > 0, '4 · dice cuántos datos se quitaron');
  ok(g.eventos[g.eventos.length - 1].t === Math.round(1999 * 0.1 * 100) / 100, '4 · se quedan los más nuevos');
  ok(g.marcas.length === 3 && g.veredicto.clave === 'propio', '4 · las marcas y el veredicto se quedan siempre');
}

/* ── 5. Los ganchos ── */
{
  const cod = leer('Código.js'), cupo = leer('cupo.js');
  ok(/case 'anilloBle': return json_\(anilloBleGuardar_\(ses, body\)\)/.test(cod), '5 · Código.js: action anilloBle con la sesión');
  ok(/case 'anillo': return json_\(anilloLeer_\(body\.n\)\)/.test(cod), '5 · el robot sigue leyendo con «anillo»');
  ok(/inicio: '[^']*\banilloBle\b/.test(cupo), '5 · anilloBle cuenta en el canal «Modo inicio» del cupo');
  const ini = fs.readFileSync(path.join(RAIZ, 'alma', 'inicio.html'), 'utf8');
  ok(/id="b-anillo-ble"[^>]*hidden/.test(ini) && /\$\("b-anillo-ble"\)\.hidden = \$\("n-anillo-ble"\)\.hidden = !e\.diagBle/.test(ini), '5 · Ajustes: la fila sale solo con una app que sabe abrir el diagnóstico');
  ok(/nativa\(\{ accion: "anilloBle" \}\)/.test(ini), '5 · la fila le pide a la app su pantalla');
  ok(/\*\*Diagnóstico del anillo\*\*/.test(fs.readFileSync(path.join(RAIZ, 'docs', 'GLOSARIO.md'), 'utf8')), '5 · «Diagnóstico del anillo» está en el glosario');
}

process.exit(fallo);
