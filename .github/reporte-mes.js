/* Prueba de reporte_mes (apps-script/reportemes.js) con dobles: la hoja de Mi (Resumenconsolidado) sin red.
   7-nov-2026: Juan preguntó por WhatsApp la ocupación de octubre de «Z4 - Rue - 301» y Alma dijo 26 % (eran las noches).
   1. Rue 301 en octubre: 83.9 %, 26 noches, neto USD 567.15, y la comparación con septiembre.
   2. La ocupación llega como fracción (0.8387) o como texto con % («83.87%»): las dos dan 83.9 %.
   3. Un mes que no está en la hoja: error, sin cifras ni estimación.
   4. El nombre con tildes, espacios o guiones; dos parecidas → pregunta cuál.
   5. Solo el administrador principal (los socios no llegan a las herramientas de Alma).
   6. El mes: vacío, «el mes pasado», «octubre», «2026-09» y varios meses para comparar; la hoja se lee una vez (caché).
   node .github/reporte-mes.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const CAB = ['Usuario ID', 'Property_name', 'Mes', 'Noches', 'Estadías', 'Ingreso Bruto', 'IVA Total', 'IVA Socios', 'Host Service Fee', 'Fee Spacio', 'Insumos & Gastos',
  'Reparaciones', 'Ingreso Neto', 'Lead Time Prom', 'Cleaning Fee', 'Estadía Prom', 'Precio Prom', 'Ocupación', 'Ocupación Ajustada', 'Otros ingresos', 'Estadía propietario',
  'Costo de oportunidad', 'Ingreso Neto 2', 'Noches propietario', 'Cleaning socio'];
const fila = (u, p, mes, o) => CAB.map(h => ({ 'Usuario ID': u, 'Property_name': p, 'Mes': mes, 'Noches': o.noches, 'Estadías': o.est, 'Ingreso Bruto': o.bruto, 'Fee Spacio': o.fee,
  'Insumos & Gastos': o.ins, 'Reparaciones': o.rep || 0, 'Ingreso Neto': o.neto, 'Precio Prom': o.adr, 'Ocupación': o.ocupT != null ? o.ocupT : o.ocup, 'Ocupación Ajustada': o.ocup,
  'Ingreso Neto 2': o.neto2 || 0 })[h] ?? '');
const HOJA = [CAB,
  fila('U12', 'Z4-Rue-301', 'octubre de 2026', { noches: 26, est: 13, bruto: 1004.66, fee: 200.93, ins: 236.58, neto: 567.15, adr: 45.73, ocup: 0.8387 }),
  fila('U12', 'Z4-Rue-301', 'septiembre de 2026', { noches: 29, est: 12, bruto: 1300, fee: 260, ins: 267.18, neto: 772.82, adr: 44.83, ocup: 0.9667, neto2: 734.18 }),
  fila('U12', 'Z4-Rue-301', 'agosto de 2026', { noches: 12, est: 5, bruto: 1050, fee: 210, ins: 149.94, neto: 690.06, adr: 87.5, ocup: 0.3871 }),
  fila('U12', 'Z4-Rue-302', 'octubre de 2026', { noches: 20, est: 8, bruto: 900, fee: 180, ins: 120, neto: 600, adr: 45, ocup: 0.6452 }),
  fila('U30', 'Z10-Ignacio-506', 'octubre de 2026', { noches: 26, est: 10, bruto: '$1,200.00', fee: '$240.00', ins: '$100.00', neto: '$860.00', adr: '$46.15', ocup: '83.87%' }),
  fila('U30', 'Z10-Ignacio-506', 'julio de 2026', { noches: 10, est: 4, bruto: 500, fee: 100, ins: 50, neto: 350, adr: 50, ocup: 0.3226 })];

function caja(adm) {
  const cache = {}, vistas = { abrir: 0 };
  const ctx = {
    console, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, parseFloat,
    CFG: { TZ: 'America/Guatemala' }, ahora_: () => new Date('2026-11-07T15:00:00Z'), esAdminPrincipal_: a => !!(a && a.principal),
    Utilities: { formatDate: (d, tz, f) => { const g = new Date(d.getTime() - 6 * 3600000); return f.replace('yyyy', g.getUTCFullYear()).replace('MM', String(g.getUTCMonth() + 1).padStart(2, '0')); } },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), getAll: ks => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; },
      putAll: o => Object.assign(cache, o), put: (k, v) => { cache[k] = v; } }) },
    SpreadsheetApp: { openById: id => { vistas.abrir++; vistas.id = id; return { getSheetByName: n => n === 'Resumenconsolidado' ? { getDataRange: () => ({ getValues: () => HOJA }) } : null }; } }
  };
  vm.createContext(ctx);
  ['buscar.js', 'reportemes.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  return { ctx, vistas, R: inp => ctx.reporteMes_(adm === undefined ? JUAN : adm, inp) };
}
const JUAN = { nombre: 'Juan', principal: true };

/* ── 1 ── */
{
  const c = caja(), r = c.R({ propiedad: 'Z4 - Rue - 301', mes: 'octubre' }), m = r.meses && r.meses[0];
  ok(r.ok && r.propiedad === 'Z4-Rue-301' && m.mes === 'octubre de 2026', 'Rue 301 octubre: encuentra Z4-Rue-301 y el mes');
  ok(m.ocupacion === '83.9%' && m.noches === 26 && m.estadias === 13, 'ocupación 83.9 % con 26 noches y 13 estadías (nunca 26 %)');
  ok(m.ingreso_neto === 'USD 567.15' && m.monto_a_depositar === 'USD 567.15' && m.ingreso_bruto === 'USD 1,004.66' && m.fee_spacio === 'USD 200.93' && m.gastos === 'USD 236.58' && m.adr === 'USD 45.73',
    'neto USD 567.15, a depositar USD 567.15 (sin Ingreso Neto 2), bruto, fee, gastos y ADR');
  ok(m.vs_mes_anterior.mes === 'septiembre de 2026' && m.vs_mes_anterior.ocupacion === '96.7% → 83.9% (-12.8 puntos)' && m.vs_mes_anterior.noches === '29 → 26 (-3)' && /USD 772\.82 → USD 567\.15 \(-26\.6%\)/.test(m.vs_mes_anterior.ingreso_neto),
    'compara con septiembre: 96.7 % → 83.9 %, 29 → 26 noches, neto -26.6 %');
  ok(/83\.9% de ocupación \(26 noches/.test(r.decir) && !/26 ?%/.test(JSON.stringify(r)) && /mes en que empieza/.test(r.regla), 'la frase para decir trae 83.9 % y la regla de conteo; en ningún lado sale 26 %');
  ok(c.vistas.id === '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4', 'lee la hoja de Mi');
  const s = c.R({ propiedad: 'rue 301', mes: '2026-09' }).meses[0];
  ok(s.monto_a_depositar === 'USD 734.18' && s.ingreso_neto === 'USD 772.82' && s.ocupacion === '96.7%', 'septiembre: monto a depositar = Ingreso Neto 2 cuando es mayor que 0');
}
/* ── 2 ── */
{
  const c = caja(), F = c.ctx.rmesFraccion_;
  ok(F(0.8387) === 0.8387 && F('0.8387') === 0.8387 && Math.abs(F('83.87%') - 0.8387) < 1e-9 && Math.abs(F(83.87) - 0.8387) < 1e-9 && F('') === null && F(1.2) === 1.2, '«0.8387», 0.8387, «83.87%» y 83.87 dan la misma fracción; vacía no es 0');
  const r = c.R({ propiedad: 'Ignacio 506', mes: 'octubre 2026' }).meses[0];
  ok(r.ocupacion === '83.9%' && r.ingreso_neto === 'USD 860.00' && r.adr === 'USD 46.15', 'con «83.87%» y montos con $ y comas: 83.9 % y USD 860.00');
}
/* ── 3 ── */
{
  const c = caja(), r = c.R({ propiedad: 'Rue 301', mes: 'noviembre' });
  ok(r.ok === false && r.error.indexOf('Ese mes todavía no está en el reporte (se cierra el día 10)') === 0 && !r.meses && !r.decir, 'noviembre no está: «todavía no está en el reporte (se cierra el día 10)», sin cifras');
  const j = c.R({ propiedad: 'Rue 301', mes: 'julio 2026' });
  ok(j.ok === false && /no tiene fila/.test(j.error) && !j.meses, 'julio existe para otra propiedad pero no para Rue 301: lo dice y no estima');
  const x = c.R({ propiedad: 'Rue 301', mes: 'el mes de la luna' });
  ok(x.ok === false && /No entendí el mes/.test(x.error), 'un mes que no se entiende: pregunta, no adivina');
}
/* ── 4 ── */
{
  const c = caja();
  ['Z4 - Rúe - 301', 'rue 301', 'RUE301', 'z4 rue 301', 'Ruè 301'].forEach(q => { const r = c.R({ propiedad: q, mes: 'octubre' }); ok(r.ok && r.propiedad === 'Z4-Rue-301', '«' + q + '» → Z4-Rue-301'); });
  const a = c.R({ propiedad: 'z4 rue', mes: 'octubre' });
  ok(a.ok === false && a.opciones.length === 2 && a.opciones.indexOf('Z4-Rue-301') >= 0 && !a.meses, '«z4 rue» con dos Rue: devuelve las opciones y pregunta cuál');
  const n = c.R({ propiedad: 'Casa Sol', mes: 'octubre' });
  ok(n.ok === false && /No encontré/.test(n.error), 'una propiedad que no está en el reporte: lo dice');
}
/* ── 5 ── */
{
  const r = caja({ nombre: 'Flor', principal: false }).R({ propiedad: 'Rue 301', mes: 'octubre' });
  ok(r.ok === false && /administrador principal/.test(r.error) && !r.meses, 'alguien del equipo (o un socio) no ve el reporte: solo el administrador principal');
  const s = caja(null).R({ propiedad: 'Rue 301', mes: 'octubre' });
  ok(s.ok === false && !s.meses, 'sin administrador identificado, nada');
}
/* ── 6 ── */
{
  const c = caja();
  ok(c.R({ propiedad: 'Rue 301' }).meses[0].mes === 'octubre de 2026', 'sin mes: el último que ya está en el reporte (octubre)');
  ok(c.R({ propiedad: 'Rue 301', mes: 'el mes pasado' }).meses[0].mes === 'octubre de 2026', '«el mes pasado» el 7-nov = octubre');
  ok(c.R({ propiedad: 'Rue 301', mes: 'agosto' }).meses[0].noches === 12, '«agosto» sin año = agosto de 2026 (12 noches)');
  const t = c.R({ propiedad: 'Rue 301', mes: 'octubre', meses: 3 });
  ok(t.meses.length === 3 && t.meses.map(m => m.mes).join() === 'octubre de 2026,septiembre de 2026,agosto de 2026' && t.meses[2].ocupacion === '38.7%' && t.meses[2].ingreso_neto === 'USD 690.06'
    && /julio de 2026 no está/.test(t.meses[2].vs_mes_anterior), 'meses = 3: octubre, septiembre y agosto (38.7 %, USD 690.06); julio no está y lo dice');
  ok(c.vistas.abrir === 1, 'la hoja se abrió una sola vez en todas estas preguntas (caché)');
}
process.exit(fallo);
