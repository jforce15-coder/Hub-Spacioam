/* Prueba de la copia de Epi (apps-script/episnap.js y epiSnap_ en agente.js; Juan, 17-nov-2026) con dobles: una caché
   que, como la de Google, rechaza más de 100 KB por llave, y un Epi de mentira que cuenta sus llamadas.
   1. Una foto grande (más de 100 KB, la programación de 7 semanas) se guarda en trozos y se lee igual.
   2. Con la copia fresca, las consultas responden al instante: Epi no se llama.
   3. Copia vieja y Epi caído: responde con la copia (vieja = minutos) y no vuelve a intentar en vivo en el siguiente pedido.
   4. Sin copia y Epi caído: un error claro que dice no volver a intentar, nunca «urlfetch».
   5. Una foto vacía de Epi no pisa la buena.
   node .github/epi-copia.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sacar = (src, nombre) => { const i = src.indexOf('function ' + nombre + '('); if (i < 0) throw new Error('falta ' + nombre); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };

function caja(epi) {
  const cache = {}, llamadas = { epi: 0 };
  const put = (k, v) => { if (Buffer.byteLength(String(v), 'utf8') > 100 * 1024) throw new Error('Argument too large: ' + k); cache[k] = String(v); };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, Date, isNaN, Buffer,
    CFG: { TZ: 'America/Guatemala' },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put, putAll: (o) => Object.keys(o).forEach((k) => put(k, o[k])), remove: (k) => { delete cache[k]; },
      getAll: (ks) => { const r = {}; ks.forEach((k) => { if (k in cache) r[k] = cache[k]; }); return r; } }) },
    ahora_: () => new Date(), sumarDias_: (f, n) => new Date(Date.parse(f) + n * 864e5).toISOString().slice(0, 10),
    vendNombre_: (v) => String(v.name || ''), propNombre_: (p) => String(p.nombre || p.name || ''),
    epiCfg_: () => { llamadas.epi++; return epi(); }
  };
  vm.createContext(ctx);
  vm.runInContext(leer('episnap.js'), ctx);
  const ag = leer('agente.js'), i = ag.indexOf('var EPISNAP_FRESCA_MIN_'), varsFin = ag.indexOf('\n', ag.indexOf('var EPISNAP_SIN_EPI_'));
  vm.runInContext(ag.slice(i, varsFin), ctx);
  ['epiSnapUtil_', 'epiSnap_', 'epiSnapNota_'].forEach((f) => vm.runInContext(sacar(ag, f), ctx));
  return { X: ctx, cache, llamadas };
}
const hoy = new Date().toISOString().slice(0, 10), dia = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const GRANDE = () => ({ vendors: [{ id: 1, name: 'Técnica Uno', email: 'a@x' }], props: [{ nombre: 'Brunelo 1203' }], tareas: [],
  schedules: Array.from({ length: 900 }, (_, k) => ({ id: 'sch' + k, fecha: dia((k % 50) - 20), hora: '09:00', tipo: 'Limpieza de salida', propiedad: 'Edificio Ejemplo ' + k, vendorEmail: 'tecnica' + k + '@ejemplo.com', vendorRaw: 'Técnica número ' + k, estado: 'confirmada', orden: k })) });
const CAIDO = () => { throw new Error('Exception: Address unavailable (urlfetch)'); };

{ const c = caja(GRANDE), s = c.X.epiSnap_(true);
  ok(JSON.stringify(s).length > 100 * 1024, '1 · la foto de prueba pesa más de 100 KB (' + Math.round(JSON.stringify(s).length / 1024) + ' KB), como la real desde #621');
  ok(Number(c.cache.episnap_n) > 1, '1 · se guardó en ' + c.cache.episnap_n + ' trozos');
  const g = c.X.epiSnapCache_(); ok(g && g.schedules.length === s.schedules.length, '1 · y se lee entera de la caché');
  const antes = c.llamadas.epi; for (let k = 0; k < 5; k++) c.X.epiSnap_(false);
  ok(c.llamadas.epi === antes, '2 · con la copia fresca, 5 consultas seguidas no llaman a Epi'); }

{ let epi = GRANDE; const c = caja(() => epi()); c.X.epiSnap_(true);
  const g = c.X.epiSnapCache_(); g.ts = new Date(Date.now() - 90 * 60000).toISOString(); c.X.epiSnapGuardar_(g);
  epi = CAIDO; const n0 = c.llamadas.epi, r = c.X.epiSnap_(false);
  ok(r && r.vieja >= 89 && r.schedules.length > 0, '3 · copia de hace 90 min y Epi caído: responde con la copia (vieja = ' + (r && r.vieja) + ' min)');
  ok(/hace \d+ min/.test(c.X.epiSnapNota_(r) || ''), '3 · y la nota lo dice para que Alma no reintente');
  const r2 = c.X.epiSnap_(false);
  ok(c.llamadas.epi === n0 + 1 && r2.vieja, '3 · el siguiente pedido no vuelve a llamar a Epi (pausa tras el fallo)'); }

{ const c = caja(CAIDO); let err = '';
  try { c.X.epiSnap_(false); } catch (e) { err = String(e.message); }
  ok(/Epi no respondió/.test(err) && /no vuelvas a intentarlo/.test(err) && !/urlfetch/i.test(err), '4 · sin copia y Epi caído: error claro sin «urlfetch»');
  try { c.X.epiSnap_(false); } catch (e) {}
  ok(c.llamadas.epi === 1, '4 · y el segundo pedido no vuelve a llamar a Epi'); }

{ let epi = GRANDE; const c = caja(() => epi()); c.X.epiSnap_(true);
  epi = () => ({ vendors: [], props: [], tareas: [], schedules: [] });
  const r = c.X.epiSnap_(true), g = c.X.epiSnapCache_();
  ok(r.props.length && g.props.length && g.vendors.length, '5 · una foto vacía de Epi no pisa la buena'); }

{ const tj = leer('tarjeta.js'), te = leer('temas.js');
  ok(!/get\('episnap'\)/.test(tj + te), '6 · tarjeta y temas leen la copia en trozos (epiSnapCache_), no la llave vieja'); }
process.exit(fallo);
