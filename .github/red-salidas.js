/* Prueba de la red de salidas del Hub (apps-script/redsalidas.js) con dobles: sin internet ni Google.
   Juan, 16-nov-2026 (Narama 623, 15-nov): «que no vuelva a pasar jamás». Revisa:
   1. a las 19:00 pide a Epi la red de MAÑANA y, si faltan limpiezas, deja UNA tarjeta «Necesita tu sí» en Pendientes
      del administrador principal, con notificación, sin datos de huéspedes; a la misma hora no la repite;
   2. fuera de las 7, 8, 19 y 20 no hace nada; a las 7:00 la red es de HOY;
   3. todo cubierto → sin tarjeta (y no vuelve a preguntar);
   4. Epi no contesta a las 7:00 → reintenta a las 8:00; si tampoco, la tarjeta lo dice;
   5. Epi no pudo leer Hospitable → tarjeta aunque no falte nada;
   6. aprender la corre antes de la pausa por cupo (nunca se pausa).
   node .github/red-salidas.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const H = 3600000, gt = s => Date.parse(s + '-06:00');

function caja(o) {
  o = o || {};
  const props = {}, tarjetas = [], pedidos = [];
  const st = { ahora: o.ahora };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    CFG: { TZ: 'America/Guatemala' },
    Utilities: { formatDate: (d, tz, f) => { const g = new Date(d.getTime() - 6 * H).toISOString(); return f === 'H' ? String(+g.slice(11, 13)) : g.slice(0, 10); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    ahora_: () => new Date(st.ahora),
    sumarDias_: (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    cupoCanal_() {}, cupoFuncion_() {},
    epiPost_: (accion, p) => { pedidos.push({ accion, p }); if (typeof o.epi === 'function') return o.epi(p, pedidos.length); return { ok: true, data: o.epi }; },
    adminsOp_: () => [{ email: 'otro@x', principal: false }, { email: 'juan@x', nombre: 'Juan', principal: true }],
    pendCrear_: (adm, c, op) => { tarjetas.push({ adm, c, op }); return { id: 'pd1' }; }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'redsalidas.js'), 'utf8'), ctx, { filename: 'redsalidas.js' });
  return { ctx, props, tarjetas, pedidos, st };
}
const FALTAN = { ok: true, fecha: '2026-11-15', lectura: { ok: true, edadH: 0.5, error: '' }, salidas: 20, tentativas: 1,
  faltan: [{ propiedad: 'Z13 - Narama - 623', entradaHoy: true, propuesta: 'Ana', razon: '' }, { propiedad: 'Z7 - Monaco - D6', entradaHoy: false, propuesta: '', razon: 'No cabe en la jornada de nadie' }] };

/* 1 · 19:00 → mañana, una tarjeta */
(() => {
  const c = caja({ ahora: gt('2026-11-14T19:20:00'), epi: FALTAN });
  const r = c.ctx.redSalidasRevisar_();
  ok(c.pedidos.length === 1 && c.pedidos[0].accion === 'redSalidas' && c.pedidos[0].p.fecha === '2026-11-15', 'a las 19:00 pide a Epi la red de mañana (15-nov)');
  const t = c.tarjetas[0];
  ok(t && t.adm.email === 'juan@x' && t.c.tipo === 'atencion' && t.op.push === true && t.op.origen === 'red_salidas', 'una tarjeta «Necesita tu sí» para el administrador principal, con notificación');
  ok(/^Mañana: 2 salidas sin limpieza confirmada$/.test(t.c.titulo) && /Narama - 623 \(tentativa con Ana\)/.test(t.c.resumen) && /Monaco - D6 \(sin persona\)/.test(t.c.resumen), 'el título y el resumen dicen cuáles y qué propone');
  ok(/No cabe en la jornada de nadie/.test(t.op.detalle) && /tiene entrada ese día/.test(t.op.detalle) && t.c.acciones[0].url === 'https://epi.spacioam.com', 'el detalle trae la razón y el botón abre Programación');
  ok(!/@|\+\d{6,}|hu[eé]sped/i.test(JSON.stringify([t.c, t.op.detalle])), 'sin correos, teléfonos ni datos de huéspedes');
  c.st.ahora = gt('2026-11-14T19:50:00');
  ok(c.ctx.redSalidasRevisar_().ya && c.pedidos.length === 1 && c.tarjetas.length === 1, 'a la misma hora no se repite');
  c.st.ahora = gt('2026-11-14T20:10:00');
  ok(c.ctx.redSalidasRevisar_().ya && c.tarjetas.length === 1, 'ni a las 20:00 (el reintento es solo si Epi no contestó)');
})();

/* 2 · horas */
(() => {
  const c = caja({ ahora: gt('2026-11-15T13:05:00'), epi: FALTAN });
  ok(c.ctx.redSalidasRevisar_() === null && !c.pedidos.length, 'a la 1:00 pm no hace nada');
  c.st.ahora = gt('2026-11-15T07:05:00');
  c.ctx.redSalidasRevisar_();
  ok(c.pedidos[0].p.fecha === '2026-11-15' && /^Hoy: /.test(c.tarjetas[0].c.titulo), 'a las 7:00 la red es de hoy');
})();

/* 3 · todo cubierto */
(() => {
  const c = caja({ ahora: gt('2026-11-16T19:05:00'), epi: { ok: true, fecha: '2026-11-17', lectura: { ok: true }, salidas: 24, faltan: [], tentativas: 0 } });
  const r = c.ctx.redSalidasRevisar_();
  ok(r.ok && !r.tarjeta && !c.tarjetas.length, 'todo cubierto: sin tarjeta');
  c.st.ahora = gt('2026-11-16T20:05:00');
  ok(c.ctx.redSalidasRevisar_().ya && c.pedidos.length === 1, 'y no vuelve a preguntar a las 20:00');
})();

/* 4 · Epi no contesta */
(() => {
  const c = caja({ ahora: gt('2026-11-15T07:10:00'), epi: () => { throw new Error('Epi HTTP 500'); } });
  ok(c.ctx.redSalidasRevisar_().reintenta && !c.tarjetas.length, 'Epi no contesta a las 7:00: reintenta después, sin tarjeta todavía');
  c.st.ahora = gt('2026-11-15T08:10:00');
  c.ctx.redSalidasRevisar_();
  ok(c.pedidos.length === 2 && c.tarjetas.length === 1 && /no pude revisar las salidas en Epi/.test(c.tarjetas[0].c.titulo) && /Epi HTTP 500/.test(c.tarjetas[0].c.resumen), 'a las 8:00 tampoco: la tarjeta lo dice');
})();

/* 5 · Epi no pudo leer Hospitable */
(() => {
  const c = caja({ ahora: gt('2026-11-14T19:30:00'), epi: { ok: true, fecha: '2026-11-15', lectura: { ok: false, edadH: 30, error: 'Hospitable no entregó 2 página(s)' }, salidas: null, faltan: [], tentativas: 0 } });
  c.ctx.redSalidasRevisar_();
  const t = c.tarjetas[0];
  ok(t && /no pudo leer las salidas de Hospitable/.test(t.c.titulo) && /No sé qué salidas hay/.test(t.c.resumen) && /no entregó 2/.test(t.op.detalle), 'sin lectura de Hospitable: tarjeta aunque no falte nada');
})();

/* 6 · aprender la corre antes de la pausa por cupo */
(() => {
  const src = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8');
  const i = src.indexOf('function aprender() {'), cuerpo = src.slice(i, i + 3000);
  const a = cuerpo.indexOf('redSalidasRevisar_()'), b = cuerpo.indexOf("cupoPermite_('fondo')");
  ok(i >= 0 && a > 0 && b > 0 && a < b, 'aprender llama a redSalidasRevisar_ antes de la pausa por cupo');
})();

process.exit(fallo);
