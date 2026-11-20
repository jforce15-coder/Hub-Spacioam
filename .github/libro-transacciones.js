/* Prueba con dobles del Libro de transacciones (apps-script/libro.js, #935 T1), sin Google ni dinero. 20-nov-2026:
   Juan dijo «Arranca el libro». Revisa:
   1. la hoja ALMA_TRANSACCIONES se crea sola con sus 17 columnas, en orden;
   2. anotar: «pagamos 300 quetzales al plomero por Mónaco B2» → fila manual, GTQ, margen supuesto 10 % (real = no), sin
      teléfonos ni correos; con comisión dicha, esa; sin costo, pregunta;
   3. importar de Mi: fee de Spacio como gestión real; insumos y reparaciones con comisión = costo × LIBRO_MARGEN_PCT
      (real = no); dos veces = sin duplicar; un mes que Mi no cerró no entra; Mi se lee por rmesFilas_ (su caché);
   4. resumen: por mes, lo real y lo que habría ganado, por tipo y por propiedad, con el supuesto dicho; solo lee;
   5. solo el principal; el cableado (agente.js, robot en Código.js, aprender una vez al mes).
   node .github/libro-transacciones.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const leer = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const LIBRO = leer('libro.js'), RMES = leer('reportemes.js'), AG = leer('agente.js'), COD = leer('Código.js');
const H = 3600000;

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), hojas = {}, lecturasMi = { n: 0 };
  let ahora = Date.parse(o.ahora || '2026-11-20T18:00:00Z');
  const DateF = function (...a) { return a.length ? new Date(...a) : new Date(ahora); };
  DateF.now = () => ahora; DateF.parse = Date.parse; DateF.UTC = Date.UTC; DateF.prototype = Date.prototype;
  const hoja = cab => {
    const filas = [cab.slice()];
    return { filas, getLastRow: () => filas.length,
      getRange: (r, c, nr, nc) => ({
        getValues: () => filas.slice(r - 1, r - 1 + nr).map(f => Array.from({ length: nc }, (_, j) => f[c - 1 + j] === undefined ? '' : f[c - 1 + j])),
        setValues: vs => vs.forEach((f, i) => { filas[r - 1 + i] = f.slice(); }) }) };
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: DateF, Math, String, Number, Object, Array, RegExp, isNaN, Error,
    CFG: { TZ: 'America/Guatemala' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: { formatDate: (d, tz, f) => { const g = new Date(d.getTime() - 6 * H).toISOString(); return f === 'yyyy-MM' ? g.slice(0, 7) : f === 'yyyy-MM-dd' ? g.slice(0, 10) : f === 'd' ? String(Number(g.slice(8, 10))) : g; } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    hojaCrear_: (n, cab) => (hojas[n] = hojas[n] || hoja(cab)),
    ahora_: () => new DateF(), esAdminPrincipal_: a => !!(a && a.principal), bqBuscar_: () => []
  };
  vm.createContext(ctx);
  vm.runInContext(RMES + '\n' + LIBRO, ctx);
  ctx.rmesFilas_ = () => { lecturasMi.n++; return (o.mi || []).map(f => Object.assign({}, f)); };   // la lectura de Mi (con su caché) es de reportemes.js
  return { ctx, props, hojas, lecturasMi, mover: ms => { ahora += ms; } };
}
const JUAN = { nombre: 'Juan', principal: true }, OTRO = { nombre: 'Equipo', principal: false };
const fila = (c, i) => { const o = {}; c.ctx.LIBRO_CAB_.forEach((k, j) => { o[k] = c.hojas.ALMA_TRANSACCIONES.filas[i][j]; }); return o; };
/* Mi de mentira (sin cifras reales): dos propiedades, septiembre y octubre cerrados; noviembre en curso. */
const MI = [
  { prop: 'Z1 - Prueba - 101', mes: '2026-09', bruto: 2000, fee: 400, insumos: 100, reparaciones: 50 },
  { prop: 'Z1 - Prueba - 101', mes: '2026-10', bruto: 1000, fee: 200, insumos: 60, reparaciones: 0 },
  { prop: 'Z1 - Prueba - 101', mes: '2026-10', bruto: 500, fee: 100, insumos: 40, reparaciones: 0 },   // dos anuncios: se suman
  { prop: 'Z2 - Ensayo - 202', mes: '2026-10', bruto: 3000, fee: 600, insumos: 0, reparaciones: 300 },
  { prop: 'Z2 - Ensayo - 202', mes: '2026-11', bruto: 900, fee: 180, insumos: 20, reparaciones: 0 }    // noviembre no está cerrado
];

/* 1 · la hoja */
{
  const c = caja();
  c.ctx.libroHoja_();
  ok(c.hojas.ALMA_TRANSACCIONES && c.hojas.ALMA_TRANSACCIONES.filas[0].join(',') === 'id,fecha,origen,tipo_cliente,cliente,proveedor,concepto,propiedad,costo,moneda,precio_cliente,tipo_comision,comision,real,comprobante,anotado_por,nota',
    '1 · ALMA_TRANSACCIONES se crea sola con sus 17 columnas en orden');
}

/* 2 · anotar */
{
  const c = caja();
  const r = c.ctx.libroParaAlma_(JUAN, { accion: 'anotar', costo: 300, moneda: 'quetzales', proveedor: 'plomero', concepto: 'reparación de fuga', propiedad: 'Mónaco B2' });
  const f = fila(c, 1);
  ok(r.ok && f.origen === 'manual' && f.moneda === 'GTQ' && f.costo === 300 && f.tipo_comision === 'margen' && f.comision === 30 && f.precio_cliente === 330 && f.real === 'no',
    '2 · anotar: 300 quetzales al plomero → GTQ, margen supuesto 10 % = 30, precio 330, real = no');
  ok(f.tipo_cliente === 'socio' && f.cliente === 'socio de Mónaco B2' && f.anotado_por === 'Juan' && /10 % de margen/.test(f.nota) && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha), '2 · con propiedad: cliente = socio de la propiedad; anotado por Juan; el supuesto en la nota');
  ok(/10 % de margen supuesto/.test(r.decir) && /GTQ 30\.00/.test(r.decir) && /Sin dinero real/.test(r.decir), '2 · Alma dice el supuesto y que no hay dinero real');
  const r2 = c.ctx.libroParaAlma_(JUAN, { accion: 'anotar', costo: 50, moneda: 'USD', proveedor: 'Traslados Ejemplo +502 5555 1234 ventas@ejemplo.com', concepto: 'traslado', comision: 8 });
  const f2 = fila(c, 2);
  ok(r2.ok && f2.comision === 8 && f2.precio_cliente === 58 && f2.moneda === 'USD' && !/5555|@/.test(f2.proveedor) && !/supuesta/.test(f2.nota), '2 · con comisión dicha usa esa; nunca guarda teléfonos ni correos');
  ok(c.ctx.libroParaAlma_(JUAN, { accion: 'anotar', proveedor: 'plomero' }).ok === false && c.hojas.ALMA_TRANSACCIONES.filas.length === 3, '2 · sin costo no anota: pregunta');
  const c3 = caja({ props: { LIBRO_MARGEN_PCT: '15' } });
  c3.ctx.libroParaAlma_(JUAN, { accion: 'anotar', costo: 200, concepto: 'lavandería' });
  ok(fila(c3, 1).comision === 30 && fila(c3, 1).tipo_cliente === 'otro', '2 · el margen sale de LIBRO_MARGEN_PCT (15 % de 200 = 30)');
}

/* 3 · importar de Mi */
{
  const c = caja({ mi: MI });
  const r = c.ctx.libroImportarMi_();
  const filas = c.hojas.ALMA_TRANSACCIONES.filas.slice(1).map((_, i) => fila(c, i + 1));
  const fee = filas.filter(f => f.tipo_comision === 'gestion'), compras = filas.filter(f => f.tipo_comision === 'margen');
  ok(r.ok && r.nuevas === 7 && fee.length === 3 && compras.length === 4, '3 · importa fee, insumos y reparaciones por propiedad y mes (7 filas; sin las de 0)');
  ok(fee.every(f => f.real === 'sí' && f.origen === 'mi' && f.moneda === 'USD') && fee.find(f => f.id === 'mi:z1prueba101:2026-10:fee').comision === 300, '3 · fee de Spacio = gestión real (dos anuncios del mismo mes se suman: 300)');
  const ins = compras.find(f => f.id === 'mi:z1prueba101:2026-10:insumos'), rep = compras.find(f => f.id === 'mi:z2ensayo202:2026-10:reparaciones');
  ok(ins.costo === 100 && ins.comision === 10 && ins.real === 'no' && rep.costo === 300 && rep.comision === 30 && /10 % de margen/.test(rep.nota), '3 · insumos y reparaciones: comisión supuesta = costo × 10 %, real = no');
  ok(!filas.some(f => /2026-11/.test(f.fecha)), '3 · noviembre (Mi no lo cerró) no entra');
  const r2 = c.ctx.libroImportarMi_();
  ok(r2.ok && r2.nuevas === 0 && r2.ya_estaban === 7 && c.hojas.ALMA_TRANSACCIONES.filas.length === 8, '3 · importar otra vez no duplica (clave propiedad + mes)');
  const c5 = caja({ mi: MI, ahora: '2026-11-05T18:00:00Z' });
  const r5 = c5.ctx.libroImportarMi_();
  ok(r5.ok && r5.meses.join(',') === '2026-09', '3 · antes del día 11, el mes pasado no entra (Mi lo cierra el 10)');
  const c6 = caja({ mi: MI });
  ok(c6.ctx.libroImportarSiToca_() && c6.props.LIBRO_MI_MES === '2026-11' && c6.ctx.libroImportarSiToca_() === null && c6.lecturasMi.n === 1, '3 · desde aprender: una sola vez al mes (Mi se lee una vez)');
  const c7 = caja({ mi: MI, ahora: '2026-12-03T18:00:00Z', props: { LIBRO_MI_MES: '2026-11' } });
  ok(c7.ctx.libroImportarSiToca_() === null && c7.lecturasMi.n === 0, '3 · antes del 11 del mes siguiente no lee Mi');
}

/* 4 · resumen */
{
  const c = caja({ mi: MI });
  c.ctx.libroImportarMi_();
  c.ctx.libroParaAlma_(JUAN, { accion: 'anotar', costo: 300, moneda: 'quetzales', proveedor: 'plomero', propiedad: 'Mónaco B2' });
  const lecturas = c.lecturasMi.n;
  const r = c.ctx.libroParaAlma_(JUAN, { accion: 'resumen', mes: '2026-10' });
  const m = r.meses && r.meses[0];
  ok(r.ok && r.meses.length === 1 && m.real === 'USD 900.00' && m.habria_ganado === 'USD 40.00', '4 · octubre: real USD 900 (fee) y habría ganado USD 40 (10 % de 100 + 300)');
  ok(m.por_tipo.gestion.real === 'USD 900.00' && m.por_tipo.margen.habria_ganado === 'USD 40.00' && m.por_propiedad[0].propiedad === 'Z2 - Ensayo - 202', '4 · por tipo y por propiedad (la de más comisión primero)');
  ok(/con 10 % de margen supuesto/.test(r.supuesto) && /10 % de margen supuesto/.test(r.decir) && /nunca como dinero que ya entró/.test(r.nota), '4 · el resumen dice el supuesto del margen');
  const iOct = c.hojas.ALMA_TRANSACCIONES.filas.findIndex(f => f[0] === 'mi:z2ensayo202:2026-10:fee');
  c.hojas.ALMA_TRANSACCIONES.filas[iOct][1] = new Date('2026-10-01T00:00:00+01:00');   // la hoja la vuelve fecha a medianoche en su zona (otra que la del Hub)
  ok(c.ctx.libroParaAlma_(JUAN, { accion: 'resumen', mes: '2026-10' }).meses[0].real === 'USD 900.00', '4 · una fecha que la hoja volvió Date en otra zona sigue en su mes (octubre no cae en septiembre)');
  const r2 = c.ctx.libroParaAlma_(JUAN, { accion: 'resumen' });
  ok(r2.ok && r2.meses[0].clave === '2026-11' && r2.meses[0].habria_ganado === 'GTQ 30.00' && r2.meses.length === 3, '4 · sin mes: los últimos meses con datos (noviembre trae lo anotado en GTQ)');
  ok(c.lecturasMi.n === lecturas, '4 · el resumen solo lee el libro: nunca abre Mi');
}

/* 5 · solo el principal y el cableado */
{
  const c = caja({ mi: MI });
  ok(c.ctx.libroParaAlma_(OTRO, { accion: 'anotar', costo: 10, concepto: 'x' }).ok === false && c.ctx.libroResumen_(OTRO, {}).ok === false && !c.hojas.ALMA_TRANSACCIONES, '5 · solo el administrador principal anota o ve el libro');
  ok(/T\('libro'/.test(AG) && /case 'libro': \{ var rLb = libroParaAlma_\(adm, inp\)/.test(AG), '5 · Alma tiene la herramienta libro (chat y WhatsApp)');
  ok(/case 'libro_resumen': return json_\(libroResumen_\(agPrincipal_\(\), body\)\)/.test(COD) && /case 'libro_importar': return json_\(libroImportarMi_\(\)\)/.test(COD), '5 · el robot: libro_resumen y libro_importar');
  ok(/libroImportarSiToca_\(\)/.test(COD.slice(COD.indexOf('function aprender()'), COD.indexOf('function aprender()') + 4000)), '5 · aprender importa de Mi una vez al mes');
  ok(!/SpreadsheetApp\.openById/.test(LIBRO), '5 · el libro nunca abre Mi por su cuenta: usa rmesFilas_ (reportemes.js, con caché)');
}
process.exit(fallo);
