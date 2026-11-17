/* Alma y el anillo QRing (rebanada 2 del anillo, apps-script/anillo.js) con dobles: sin hoja ni Google.
   Juan, 16-nov-2026: «controlar desde Alma todas las funciones del anillo». En la app la voz lo lee en vivo (herramientas de
   cliente anillo_*, AnilloAlma.swift); la app manda lo último que leyó (action anilloResumen) y Alma lo dice también por
   WhatsApp, chat o teléfono (herramienta «anillo» del chat), siempre con su hora.
   1. La Lectura del anillo se guarda solo con la sesión de un administrador, por usuario (la clave no es el correo).
   2. Solo números conocidos con su hora: fuera de rango, del futuro o de hace más de 30 días no entra; nada de nombres.
   3. Una lectura nueva no borra lo que no trae (la batería de ayer sigue si hoy solo llegan pasos).
   4. La herramienta del chat dice de cuándo es cada dato («hace 2 h», «ayer a las…»), avisa si es vieja y es solo del principal.
   5. Las 5 herramientas de cliente de la voz (solo con «ANILLO DE JUAN» en la ficha) van al agente, y el chat, el robot,
      la voz rápida y Código.js tienen su gancho.
   node .github/anillo-alma.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const JUAN = { email: 'juan@x.com', nombre: 'Juan', principal: true };
const ANA = { email: 'ana@x.com', nombre: 'Ana', principal: false };

function caja() {
  const props = {}, cache = {};
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
    vozWebAdmin_: s => (s && s.email === JUAN.email ? JUAN : s && s.email === ANA.email ? ANA : null),
    esAdminPrincipal_: a => !!a && !!a.principal,
    retClave_: a => 'VOZ_RET_' + Buffer.from(a.email).toString('base64url').slice(0, 16),
    ssAlma_: () => ({ getSheetByName: () => null }), hojaCrear_: () => ({ appendRow() {} })
  };
  vm.createContext(ctx);
  vm.runInContext(leer('anillo.js'), ctx, { filename: 'anillo.js' });
  return { ctx, props };
}
const ahora = () => Date.now() / 1000;

/* ── 1. Solo con sesión, por usuario ── */
{
  const { ctx, props } = caja();
  const r = ctx.anilloResumenGuardar_(null, { resumen: { bateria: { v: 80, t: ahora() } } });
  ok(!r.ok && r.error === 'usuario' && !Object.keys(props).length, '1 · sin la sesión de un administrador no se guarda nada');
  ok(ctx.anilloResumenGuardar_({ email: JUAN.email }, {}).error === 'vacio', '1 · sin resumen, nada');
  const r2 = ctx.anilloResumenGuardar_({ email: JUAN.email }, { resumen: { bateria: { v: 80, t: ahora(), cargando: true } } });
  const k = Object.keys(props).filter(x => x.indexOf('ANILLO_RES_') === 0);
  ok(r2.ok && k.length === 1 && !/@|juan/.test(k[0]), '1 · se guarda por usuario en ANILLO_RES_<clave> (la clave no es el correo)');
  const leido = ctx.anilloLeer_(30);
  ok(leido.resumen && Object.values(leido.resumen)[0].bateria.v === 80, '1 · el robot la lee con «anillo» (campo resumen)');
}

/* ── 2. Solo números conocidos con su hora ── */
{
  const { ctx } = caja(), t = ahora();
  const o = ctx.anilloResOrdenar_({
    bateria: { v: 180, t }, ritmo: { v: 72, t: t + 9999 }, oxigeno: { v: 97, t: t - 40 * 86400 }, pasos: { v: '3200', t },
    kcal: { v: 120.4, t }, metros: { v: -5, t }, nombre: 'Anillo de Juan', correo: 'juan@x.com',
    ritmo_dia: { min: 55, max: 400, prom: 71, ultimo: 66, ultimo_min: 600, lecturas: 40, t },
    ajustes: { activo: true, minutos: 30, t }, firmware: 'R08_3.10.46 <b>', sync: t, conectado: true
  }, {}, t);
  ok(!o.bateria && !o.ritmo && !o.oxigeno && !o.metros, '2 · fuera de rango, del futuro o de hace más de 30 días no entra');
  ok(o.pasos.v === 3200 && o.kcal.v === 120, '2 · los números se guardan enteros');
  ok(!('nombre' in o) && !('correo' in o) && JSON.stringify(o).indexOf('@') < 0, '2 · nada que no sea un campo conocido (ni nombre ni correo)');
  ok(o.ritmo_dia.min === 55 && o.ritmo_dia.max === undefined && o.ritmo_dia.ultimo_min === 600, '2 · el ritmo del día, campo por campo');
  ok(o.firmware === 'R08_3.10.46b' && o.ajustes.minutos === 30 && o.conectado.v === true, '2 · firmware limpio, ajustes y conexión');
}

/* ── 3. Una lectura nueva no borra lo que no trae ── */
{
  const { ctx } = caja(), t = ahora();
  ctx.anilloResumenGuardar_({ email: JUAN.email }, { resumen: { bateria: { v: 64, t: t - 7200 } } });
  ctx.anilloResumenGuardar_({ email: JUAN.email }, { resumen: { pasos: { v: 4000, t } } });
  const r = ctx.anilloResumenDe_(JUAN);
  ok(r.bateria.v === 64 && r.pasos.v === 4000, '3 · la batería de antes sigue cuando solo llegan pasos');
}

/* ── 4. La herramienta del chat ── */
{
  const { ctx } = caja(), t = ahora();
  ok(ctx.anilloHerramienta_(JUAN, t).ok === false, '4 · sin lecturas lo dice claro (no inventa)');
  ctx.anilloResumenGuardar_({ email: JUAN.email }, { resumen: {
    bateria: { v: 80, t: t - 2 * 3600, cargando: false }, pasos: { v: 3200, t: t - 600 }, kcal: { v: 150, t: t - 600 }, metros: { v: 2300, t: t - 600 },
    ritmo: { v: 72, t: t - 30 }, ritmo_dia: { min: 58, max: 110, prom: 74, lecturas: 30, t: t - 600 }, ajustes: { activo: true, minutos: 30, t }, sync: t - 30 } });
  const h = ctx.anilloHerramienta_(JUAN, t);
  ok(h.ok && /80 %/.test(h.bateria) && /hace 2 h/.test(h.bateria), '4 · la batería con su hora («hace 2 h»): ' + h.bateria);
  ok(/3200 pasos · 150 kcal · 2\.3 km/.test(h.actividad) && /hace 10 min/.test(h.actividad), '4 · pasos, kcal y km: ' + h.actividad);
  ok(/hace un momento/.test(h.ritmo) && /mín 58 · máx 110 · promedio 74/.test(h.ritmo_del_dia), '4 · ritmo y ritmo del día');
  ok(h.monitoreo_ritmo === 'encendido, cada 30 min' && /no es en vivo/.test(h.fuente) && !h.nota, '4 · el monitoreo y que no es en vivo');
  ok(ctx.anilloHerramienta_(ANA, t).ok === false, '4 · solo el administrador principal');
  const viejo = ctx.anilloHerramienta_(JUAN, t + 3 * 86400);
  ok(/más de un día/.test(viejo.nota || '') && /^el \d+-[a-z]{3} a las \d\d:\d\d$/.test(viejo.ultima_lectura), '4 · una lectura de hace días se dice con su fecha y avisa: ' + viejo.ultima_lectura);
  const t0 = Date.UTC(2026, 10, 16, 20, 0) / 1000;   // 14:00 en Guatemala
  ok(ctx.anilloHace_(t0 - 86400 - 60, t0) === 'ayer a las 13:59' && ctx.anilloHace_(t0 - 3 * 3600, t0) === 'hace 3 h', '4 · «ayer a las 13:59» y «hace 3 h» (hora de Guatemala)');
}

/* ── 5. Las herramientas y sus ganchos ── */
{
  const { ctx } = caja();
  const hs = ctx.vozAnilloHerramientas_(), nombres = hs.map(h => h.name).join(' ');
  ok(nombres === 'anillo_estado anillo_medidas anillo_medir_ahora anillo_ajustes anillo_buscar', '5 · las 5 herramientas de cliente: ' + nombres);
  ok(hs.every(h => h.type === 'client' && h.expects_response === true && /ANILLO DE JUAN/.test(h.description) && /no inventes/.test(h.description) && !h.url),
    '5 · de cliente, contestan, sin URL ni llave y solo con «ANILLO DE JUAN» en la ficha');
  ok(hs[0].parameters.properties.mostrar, '5 · anillo_estado también abre la pantalla Wearables (mostrar)');
  const med = hs.find(h => h.name === 'anillo_medir_ahora');
  ok(med.response_timeout_secs >= 35 && med.parameters.properties.cancelar, '5 · medir ahora espera lo que tarda el anillo y se puede cancelar');
  const voz = leer('voz.js'), ag = leer('agente.js'), cod = leer('Código.js'), rap = leer('rapido.js'), cupo = leer('cupo.js');
  ok(/vozManosHerramientas_\(\), vozAnilloHerramientas_\(\)\)/.test(voz), '5 · vozDefHerramientas_ las suma al agente');
  ok(/T\('anillo', /.test(ag) && /case 'anillo': return anilloHerramienta_\(adm\)/.test(ag), '5 · la herramienta «anillo» del chat');
  ok(/case 'anilloResumen': return json_\(anilloResumenGuardar_\(ses, body\)\)/.test(cod) && /anilloResumen/.test(cupo), '5 · la acción anilloResumen en Código.js y su canal');
  ok(/'anillo', 'pedidos_en_orbita'\]/.test(rap), '5 · la voz rápida también la puede leer');
  const ini = fs.readFileSync(path.join(DIR, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/id="b-dispositivos"[^>]*hidden/.test(ini) && /\$\("b-dispositivos"\)\.hidden = !e\.dispositivos/.test(ini) && /accion: "dispositivos"/.test(ini),
    '5 · Ajustes → «Wearables», solo con una app que la sabe abrir');
}

process.exit(fallo);
