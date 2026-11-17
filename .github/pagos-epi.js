/* Prueba de pagos_epi (apps-script/pagosepi.js) con dobles: la hoja de Epi (pestaña Config) sin red.
   17-nov-2026: Juan le preguntó a Alma por llamada cuánto hay que depositarle a Gabriel Asturias y ella no tenía cómo ver
   el historial de pagos de Epi.
   1. Gabriel (planilla): por depositar = la quincena sin soporte, con su neto tal cual; la que tiene soporte no cuenta.
   2. Los pagos repartidos en «pagos» y «pagos_2» se unen, y un comprobante anulado no cuenta.
   3. Un comprobante de lote con varios técnicos: solo lo suyo.
   4. Si falta el comprobante de una quincena vencida, lo dice y no inventa el monto.
   5. Nombre con tildes o solo el nombre; dos parecidas → pregunta cuál; nadie → error.
   6. Solo el administrador principal.
   node .github/pagos-epi.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const GAB = 'gabriel@ejemplo.com', ANA = 'ana@ejemplo.com';
const nom = (per, label, neto, sop, extra) => Object.assign({ id: 'pg_' + per, folio: 'NOM-' + per + '-GA', nomKey: GAB + '|' + per, fechaPago: per.endsWith('Q1') ? per.slice(0, 7) + '-15' : per.slice(0, 7) + '-30',
  tipo: 'nomina', createdAt: 1, tecnicos: [{ vendorEmail: GAB, vendorName: 'Gabriel Asturias', subtotal: 2623.21, adelanto: 375, neto: neto }], totalBruto: 2623.21, totalDescuento: 375, totalNeto: neto,
  nomina: { email: GAB, label: label }, soporte: sop ? { name: 'transferencia.jpg', url: 'https://drive/x' } : null }, extra || {});
function hoja(o) {
  o = o || {};
  const p1 = [nom('2026-10-Q1', '1–15 Octubre 2026', 2248.21, true), nom('2026-10-Q2', '16–31 Octubre 2026', 2248.21, true)];
  const p2 = [nom('2026-11-Q1', '1–15 Noviembre 2026', 2248.21, false),
    { id: 'pg_lote1', folio: 'PAG-0042', fechaPago: '2026-11-10', tipo: 'lote', createdAt: 2, soporte: null, rangoDesde: '2026-11-03', rangoHasta: '2026-11-09',
      tecnicos: [{ vendorEmail: GAB, vendorName: 'Gabriel Asturias', subtotal: 150, adelanto: 0, neto: 150 }, { vendorEmail: ANA, vendorName: 'Ana López', subtotal: 900, adelanto: 100, neto: 800 }], totalNeto: 950 },
    { id: 'pg_anulado', folio: 'PAG-0040', fechaPago: '2026-11-08', tipo: 'lote', soporte: null, tecnicos: [{ vendorEmail: GAB, vendorName: 'Gabriel Asturias', subtotal: 999, adelanto: 0, neto: 999 }] }];
  if (o.sinNov) p2.shift();
  const vend = [{ email: GAB, name: 'Gabriel Asturias', primerNombre: 'Gabriel', primerApellido: 'Asturias', tipo: 'interno', planilla: true, salarioBase: 5250, planillaDesde: '2026-07-16' },
    { email: ANA, name: 'Ana López', tipo: 'externo' }, { email: 'gabriela@ejemplo.com', name: 'Gabriela Pérez', tipo: 'externo' }];
  return [['Clave', 'Valor'], ['vendors', JSON.stringify(vend)], ['pagos', JSON.stringify(p1)], ['pagos_2', JSON.stringify(p2)], ['pagos_n', 2],
    ['pagos_anulados', JSON.stringify([{ id: 'pg_anulado', folio: 'PAG-0040' }])], ['schedules', '[]']];
}
function caja(o) {
  const vistas = {};
  const ctx = {
    console, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, parseFloat,
    CFG: { TZ: 'America/Guatemala', SHEET_EPI_ID: 'HOJA_EPI' }, ahora_: () => new Date('2026-11-17T17:00:00Z'), esAdminPrincipal_: a => !!(a && a.principal),
    Utilities: { formatDate: (d) => new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10) },
    SpreadsheetApp: { openById: id => { vistas.id = id; return { getSheetByName: n => n === 'Config' ? { getDataRange: () => ({ getValues: () => hoja(o) }) } : null }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'pagosepi.js'), 'utf8'), ctx, { filename: 'pagosepi.js' });
  return { ctx, vistas, R: (inp, adm) => ctx.pagosEpi_(adm === undefined ? JUAN : adm, inp) };
}
const JUAN = { nombre: 'Juan', principal: true };

/* ── 1, 2, 3 ── */
{
  const c = caja(), r = c.R({ persona: 'Gabriel Asturias' });
  ok(r.ok && r.persona === 'Gabriel Asturias' && c.vistas.id === 'HOJA_EPI', '1 · encuentra a Gabriel Asturias en la hoja de Epi');
  ok(r.por_depositar.total === 'Q2,398.21' && r.por_depositar.comprobantes.length === 2, '1 · por depositar Q2,398.21: la quincena del 1–15 nov (Q2,248.21) y su parte del lote (Q150.00)');
  ok(r.por_depositar.comprobantes[0].neto === 'Q2,248.21' && /no/.test(r.por_depositar.comprobantes[0].depositado), '1 · la quincena de noviembre sin soporte, con el neto tal cual');
  ok(r.historial.length === 4 && r.historial.filter(h => /^sí/.test(h.depositado)).length === 2, '2 · une pagos y pagos_2 (4 comprobantes) y los de octubre salen depositados');
  ok(!JSON.stringify(r).includes('PAG-0040') && !JSON.stringify(r).includes('999'), '2 · el comprobante anulado no cuenta');
  ok(r.por_depositar.comprobantes.some(x => x.folio === 'PAG-0042' && x.neto === 'Q150.00'), '3 · del lote con Ana, solo lo de Gabriel (Q150.00, no Q950.00)');
  ok(/hay que depositarle Q2,398\.21/.test(r.decir) && !r.faltan_comprobantes, '1 · la frase para decir trae el total, y no falta ninguna quincena');
}
/* ── 4 ── */
{
  const r = caja({ sinNov: true }).R({ persona: 'gabriel asturias' });
  ok(r.ok && r.faltan_comprobantes && r.faltan_comprobantes.length === 1 && /1–15 de noviembre de 2026/.test(r.faltan_comprobantes[0]), '4 · dice que falta el comprobante de la quincena 1–15 de noviembre');
  ok(r.por_depositar.total === 'Q150.00' && /No lo calcules/.test(r.decir), '4 · no inventa el monto de la quincena que falta');
}
/* ── 5 ── */
{
  const c = caja();
  ok(c.R({ persona: 'Gabriél ASTURIAS' }).ok, '5 · con tilde y mayúsculas');
  const g = c.R({ persona: 'Gabriel' });
  ok(!g.ok && g.opciones && g.opciones.length === 2, '5 · «Gabriel» se parece a dos (Gabriel y Gabriela): pregunta cuál');
  ok(!c.R({ persona: 'Pedro Nadie' }).ok, '5 · alguien que no está: error');
  const a = c.R({ persona: 'Ana' });
  ok(a.ok && a.por_depositar.total === 'Q800.00', '5 · Ana: solo su parte del lote (Q800.00)');
}
/* ── 6 ── */
{
  const c = caja(), r = c.R({ persona: 'Gabriel Asturias' }, { nombre: 'Lucky', principal: false });
  ok(!r.ok && !c.vistas.id, '6 · alguien que no es el principal no ve los pagos (ni se abre la hoja)');
}
process.exit(fallo);
