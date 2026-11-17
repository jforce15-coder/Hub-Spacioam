/* Prueba de precio_por_noche (apps-script/precionoche.js) con dobles: Hospitable y Hola sin red.
   17-nov-2026: Juan pidió para Mónaco el desglose de una reserva de Airbnb del último mes ÷ noches y el largo plazo de Hola.
   1. Elige la reserva de Airbnb terminada más reciente (no Booking, no canceladas, no futuras) de las propiedades de Mónaco.
   2. Tarifa, limpieza y comisión de Airbnb (centavos → dólares) y cada una ÷ noches; el pago al anfitrión.
   3. Largo plazo de Hola: solo Mónaco, por noche según la frecuencia y sin datos del inquilino.
   4. Solo el administrador principal.
   node .github/precio-noche.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const c$ = n => ({ amount: Math.round(n * 100), formatted: '$' + n });
const FIN = { currency: 'USD', host: { accommodation: c$(150), guest_fees: [Object.assign(c$(30), { label: 'Cleaning fee' })], host_fees: [Object.assign(c$(-5.4), { label: 'Host Service Fee' })], revenue: c$(174.6) } };
const RES = [
  { id: 'a1', code: 'HMAAA', platform: 'airbnb', arrival_date: '2026-11-01', departure_date: '2026-11-04', nights: 3, reservation_status: { current: { category: 'accepted' } }, properties: [{ name: 'Z7 - Monaco - 1104' }], financials: FIN },
  { id: 'a2', code: 'HMBBB', platform: 'airbnb', arrival_date: '2026-11-08', departure_date: '2026-11-10', nights: 2, reservation_status: { current: { category: 'cancelled' } }, properties: [{ name: 'Z7 - Monaco - 1104' }] },
  { id: 'a3', code: 'BK1', platform: 'booking', arrival_date: '2026-11-09', departure_date: '2026-11-12', nights: 3, reservation_status: { current: { category: 'accepted' } }, properties: [{ name: 'Z7 - Monaco - 902' }] },
  { id: 'a4', code: 'HMCCC', platform: 'airbnb', arrival_date: '2026-11-15', departure_date: '2026-11-20', nights: 5, reservation_status: { current: { category: 'accepted' } }, properties: [{ name: 'Z7 - Monaco - 902' }] }];
const LT = [{ propertyName: 'Z7 - Mónaco - 1102', monto: 6000, moneda: 'GTQ', frecuencia: 'mensual', estado: 'activa', entrada: '2026-09-01', tipoFin: 'indefinido', guest: { nombre: 'Inquilino X', telefono: '+50200000000' } },
  { propertyName: 'Z10 - Ignacio - 506', monto: 700, moneda: 'USD', frecuencia: 'mensual', estado: 'activa', entrada: '2026-08-01' }];
const pedidos = [];
const ctx = {
  console, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN, encodeURIComponent,
  CFG: { TZ: 'America/Guatemala' }, s_: v => (v == null ? '' : String(v)), esAdminPrincipal_: a => !!(a && a.principal),
  sumarDias_: (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  hospErrorTexto_: c => 'Hospitable ' + c,
  Utilities: { formatDate: () => '2026-11-17' },
  hosp_: (m, u) => { pedidos.push(u); if (/^\/properties/.test(u)) return { code: 200, json: { data: [{ id: 'p1', name: 'Z7 - Monaco - 1104' }, { id: 'p2', name: 'Z7 - Monaco - 902' }, { id: 'p3', name: 'Z10 - Ignacio - 506' }] } };
    if (/^\/reservations\?/.test(u)) return { code: 200, json: { data: RES, meta: { last_page: 1 } } }; return { code: 404 }; },
  holaPost_: b => (b.action === 'ltList' ? { ok: true, list: LT } : { ok: false })
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'precionoche.js'), 'utf8'), ctx, { filename: 'precionoche.js' });
const r = ctx.precioPorNoche_({ principal: true }, { propiedad: 'Mónaco' });
ok(r.ok && r.propiedades.length === 2, '1. Encuentra las 2 propiedades de Mónaco (sin tilde en Hospitable)');
ok(!/p3/.test(pedidos.find(u => /^\/reservations\?/.test(u))), '1. Solo pide reservas de Mónaco');
const c = r.corta_airbnb;
ok(c.codigo === 'HMAAA' && c.noches === 3 && c.terminada, '1. Elige la de Airbnb terminada más reciente (no la cancelada, ni Booking, ni la que sigue en curso)');
const p = n => (c.partes || []).find(x => x.parte.indexOf(n) === 0) || {};
ok(p('Tarifa de alojamiento').total === 150 && p('Tarifa de alojamiento').por_noche === 50, '2. Tarifa 150 → 50 por noche');
ok(p('Tarifa de limpieza').total === 30 && p('Tarifa de limpieza').por_noche === 10, '2. Limpieza 30 → 10 por noche');
ok(p('Comisión').total === -5.4 && p('Comisión').por_noche === -1.8, '2. Comisión de Airbnb −5.40 → −1.80 por noche');
ok(p('Pago al anfitrión').total === 174.6 && p('Pago al anfitrión').por_noche === 58.2, '2. Pago al anfitrión 174.60 → 58.20 por noche');
const l = r.largo_plazo_hola.contratos;
ok(l.length === 1 && l[0].monto === 6000 && l[0].por_noche === 200 && l[0].moneda === 'GTQ' && l[0].salida === 'indefinida', '3. Largo plazo de Mónaco: Q6,000 al mes → Q200 por noche');
ok(!/Inquilino|5020000/.test(JSON.stringify(r)), '3. Sin nombre ni teléfono del inquilino');
ok(!ctx.precioPorNoche_({ principal: false }, { propiedad: 'Mónaco' }).ok, '4. Solo el administrador principal');
process.exit(fallo);
