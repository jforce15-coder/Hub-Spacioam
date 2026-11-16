/* Prueba del tablero de datos (apps-script/tablero.js, #607 T-B) con dobles: sin Google, sin Hospitable y sin IA.
   1. Cada tablero sale con sus cuadros (número grande, barras, línea de tiempo, lista) y su texto para la app de antes:
      reservas, llegadas y salidas del día, el mes de un apartamento, la ruta, las tareas, lo que espera su sí, las
      promesas, las cancelaciones, cómo va un pedido y la agenda.
   2. Nunca un código, una clave, un teléfono ni un correo (la ruta viene sin código aunque la herramienta lo traiga).
   3. Las barras: la más larga es el 100 %; sin nada que comparar no van. Lo mismo arma la misma clave (no se rearma).
   4. En la llamada: «datos» sale en pantalla solo si la app lo nombra en tipos; si no, solo el chat. Fuera de una
      llamada no hay candidata.
   5. Las candidatas: agEjecutar_ (buscar_reservas con varias, cancelaciones, ruta_del_dia, tareas_abiertas,
      reporte_mes, promesas_abiertas, pedidos_en_orbita, ver_agenda) y las respuestas instantáneas (ruta, llegadas y
      salidas, tareas y pendientes).
   6. alma/inicio.html pinta número, barras y línea de tiempo y el encabezado del tablero («Alma te muestra»).
   node .github/tablero-datos.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const HOY = '2026-11-16';
function caja(o) {
  o = o || {};
  const cache = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite,
    Date: class extends Date { constructor(...a) { if (!a.length) super(HOY + 'T16:00:00Z'); else super(...a); } static now() { return Date.parse(HOY + 'T16:00:00Z'); } },
    CFG: { TZ: 'America/Guatemala' },
    Utilities: { formatDate: (d) => new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 10) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; }, getAll: () => ({}) }) },
    s_: (v) => (v == null || typeof v === 'object') ? '' : String(v),
    norm_: (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(),
    fin8_: (t) => String(t || '').replace(/\D/g, '').slice(-8),
    vozWebTel_: (c) => (c === 'conv-app' ? '50255550101' : ''),
    adminPorTel_: (t) => (String(t).slice(-8) === '55550101' ? { email: 'juan@spacioam.com', tels: ['50255550101'], principal: true } : null),
    AGENTE_CANAL_: o.canal === undefined ? 'llamada' : o.canal
  };
  vm.createContext(ctx);
  ['calprops.js', 'tarjeta.js', 'tablero.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx));
  return { X: ctx, cache };
}
const tipos = (t) => (t.cuadros || []).map((c) => c.tipo);
const texto = (t) => JSON.stringify(t);
const SECRETO = /\b\d{6,}\b|@|\+502|c[oó]digo \d/i;

const { X } = caja();
/* 1 · cada tablero */
const RES = [
  { codigo: 'HMAAA11111', huesped: 'Mariana López', propiedad: 'Z10 - Brunelo - 1203', entrada: '2026-11-17', salida: '2026-11-20', estado: 'confirmada' },
  { codigo: 'HMBBB22222', huesped: 'Pedro Ruiz', propiedad: 'Z14 - Parque 14 - 501', entrada: '2026-11-18', salida: '2026-11-19', estado: 'confirmada' },
  { codigo: 'HMCCC33333', huesped: 'Ana Gil', propiedad: 'Z10 - Brunelo - 1102', entrada: '2026-11-18', salida: '2026-11-21', estado: 'cancelada' }
];
{ const t = X.tdReservas_(RES, { inbox: [{ codigo: 'HMAAA11111', foto: 'https://fotos.example/m.jpg' }] });
  ok(t && t.tipo === 'datos' && t.clase === 'reservas' && t.eti === 'Alma te muestra', '1 · reservas: tablero de datos');
  ok(tipos(t).join() === 'numero,barras,lista', '1 · reservas: número, barras por día y la lista');
  ok(t.cuadros[0].v === '2' && /1 cancelada/.test(t.cuadros[0].d), '1 · reservas: cuenta las vivas y dice las canceladas');
  ok(t.cuadros[2].items[0].foto === 'https://fotos.example/m.jpg' && t.cuadros[2].items[2].tono === 'alerta', '1 · reservas: la foto del huésped y la cancelada en rojo');
  ok(t.datos.length && t.detalle.length, '1 · reservas: texto para la app de antes');
  ok(X.tdReservas_([RES[0]]) === null, '1 · una sola reserva no es tablero de datos (es la tarjeta de la reserva)');
}
{ const t = X.tdReservas_([RES[0], RES[1]], { dia: '2026-11-17', que: 'Llegan', salidas: [RES[2]], titulo: 'Mañana' });
  ok(t && tipos(t).join() === 'numero,numero,lista,lista' && t.cuadros[1].k === 'Salen', '1 · llegadas y salidas del día: dos números y dos listas');
}
const MES = { ok: true, propiedad: 'Z10 - Brunelo - 1203', meses: [
  { mes: 'octubre 2026', ocupacion: '83.9 %', ingreso_neto: 'US$ 1,250', monto_a_depositar: 'US$ 1,100', noches: 26, estadias: 7, adr: 'US$ 78',
    vs_mes_anterior: { mes: 'septiembre 2026', ocupacion: '70.0 % → 83.9 % (+13.9 puntos)', ingreso_neto: 'US$ 1,000 → US$ 1,250 (+25.0%)' } }] };
{ const t = X.tdMes_(MES);
  ok(t && tipos(t).join() === 'numero,numero,numero,numero,barras', '1 · mes: ocupación, ingreso, depósito, noches y la barra contra el mes anterior');
  ok(t.cuadros[0].v === '83.9 %' && t.cuadros[0].d === '+13.9 puntos' && t.cuadros[1].d === '+25.0%', '1 · mes: el cambio contra el mes anterior debajo del número');
  ok(t.cuadros[4].items[0].n === 1000 && t.cuadros[4].items[1].n === 1250, '1 · mes: las barras con los números del reporte');
  ok(X.tdMes_({ ok: false }) === null, '1 · mes: sin reporte, nada (no se estima)');
}
const RUTA = { persona: 'todos', trabajos: [
  { x: { hora: '10:00', tipo: 'Limpieza', propiedad: 'Z10 - Brunelo - 1203', estado: 'confirmada', entradaHoy: true, codigo: '483920' }, quien: 'Sucely Pérez' },
  { x: { hora: '8:30', tipo: 'Limpieza', propiedad: 'Z14 - Parque 14 - 501', estado: 'tentativa' }, quien: 'Joselyn Ruiz' },
  { x: { hora: '13:00', tipo: 'Mantenimiento', propiedad: 'Z10 - Brunelo - 1102' }, quien: 'Sucely Pérez' }] };
{ const t = X.tdRuta_(RUTA, HOY);
  ok(t && tipos(t).join() === 'numero,numero,barras,linea', '1 · ruta: trabajos, personas, por persona y la línea de tiempo');
  ok(t.cuadros[3].items.map((x) => x.h).join() === '8:30,10:00,13:00', '1 · ruta: la línea en orden de hora');
  ok(t.cuadros[3].items[0].tono === 'aviso' && /1 tentativa/.test(t.cuadros[0].d), '1 · ruta: la tentativa se marca');
  ok(!/483920/.test(texto(t)), '2 · ruta: nunca el código');
  const una = X.tdRuta_({ persona: 'Sucely Pérez', trabajos: RUTA.trabajos.filter((x) => x.quien === 'Sucely Pérez') }, HOY);
  ok(una && /Ruta de Sucely/.test(una.titulo) && tipos(una).join() === 'numero,linea', '1 · ruta de una persona: su línea');
}
{ const t = X.tdTareas_([{ texto: 'Cambiar foco', prop: 'Z10 - Brunelo - 1203', quien: 'Edgar', vence: '2026-11-10' }, { texto: 'Llamar al técnico 55551234', quien: 'Edgar', vence: HOY }, { texto: 'Revisar', quien: 'Ana', vence: '2026-12-01' }, { texto: 'hecha', hecha: true }], HOY);
  ok(t && tipos(t).join() === 'numero,numero,barras,lista' && t.cuadros[0].v === '3' && t.cuadros[1].v === '1' && t.cuadros[1].tono === 'alerta', '1 · tareas: abiertas, vencidas, por persona y la lista');
  ok(!/55551234/.test(texto(t)), '2 · tareas: sin teléfonos');
}
{ const t = X.tdPendientes_({ ok: true, atencion: [{ titulo: 'Unir el cambio', area: 'Propósito' }, { titulo: 'Decidir precio', area: 'Finanzas' }, { titulo: 'Otro', area: 'Propósito' }] });
  ok(t && t.cuadros[0].v === '3' && tipos(t).join() === 'numero,barras,lista', '1 · pendientes: cuántos, por esfera y los primeros');
}
{ const t = X.tdPromesas_([{ huesped: 'Ana Gil', que: 'mandarle la factura', vence: 'hoy 18:00', estado: 'vencida' }, { huesped: 'Pedro', que: 'el wifi', vence: 'mañana' }]);
  ok(t && t.cuadros[1].v === '1' && t.cuadros[2].items[0].tono === 'alerta', '1 · promesas: las vencidas primero y en rojo');
}
{ const t = X.tdCancelaciones_({ cancelaciones: [RES[2]] });
  ok(t && t.cuadros[0].v === '1', '1 · cancelaciones: cuántas y cuáles');
}
{ const t = X.tdPedido_({ ok: true, pedidos: [{ nombre: 'Uber con Alma', estado: 'en curso', paso: 'Revisando', empezo: '16 nov 10:00', que_pidio: 'pedir un uber', pasos_que_dio: ['Leyó la agenda'], que_falta: 'Nada' }] });
  ok(t && tipos(t).join() === 'numero,numero,linea' && t.cuadros[2].items.length === 3 && t.cuadros[2].items[2].h === 'ahora', '1 · pedido: estado, qué falta y la línea de lo que va');
}
{ const t = X.tdAgenda_({ ok: true, desde: HOY, hasta: HOY, ocupado: [{ titulo: 'Reunión socio', dia: HOY, de: '15:00', a: '16:00' }, { titulo: 'Dentista', dia: HOY, de: '9:00', a: '10:00' }], libre: ['2026-11-16 11:00–15:00'] });
  ok(t && t.cuadros[2].items[0].t === 'Dentista' && t.cuadros[1].d === '11:00–15:00', '1 · agenda: la línea del día en orden y el primer hueco');
}
/* 2 · nada secreto en ningún tablero con textos de riesgo */
{ const t = X.tdTareas_([{ texto: 'El código de la puerta es 482910', quien: 'Edgar' }, { texto: 'Escribir a ana@correo.com', quien: 'Edgar' }], HOY);
  ok(!SECRETO.test(texto(t.cuadros)), '2 · tareas con un código o un correo: se tapan');
}
/* 3 · barras y clave */
{ const b = X.tdBarras_('x', 'k', [{ t: 'a', n: 0 }, { t: 'b', n: 0 }]);
  ok(b === null, '3 · barras sin nada que comparar: no van');
  ok(X.tdReservas_(RES).clave === X.tdReservas_(RES).clave && X.tdReservas_(RES).clave !== X.tdReservas_(RES.slice(0, 2)).clave, '3 · lo mismo arma la misma clave; otra cosa, otra');
}
/* 4 · en la llamada */
{ const { X: Y, cache } = caja();
  cache['vozapp_conv-app'] = '1';
  Y.tvCandidata_('datos', () => Y.tdReservas_(RES));
  let r = Y.tvCerrar_('conv-app', true, false);
  ok(r && !r.visible && !cache['voztarjeta_conv-app'], '4 · la app de antes (sin «datos» en tipos): solo el chat');
  cache['voztvtipos_conv-app'] = JSON.stringify(['reserva', 'datos']);
  Y.tvCandidata_('datos', () => Y.tdReservas_(RES));
  r = Y.tvCerrar_('conv-app', true, false);
  ok(r && r.visible && /^EN PANTALLA: la lista de 2 reservas/.test(r.voz) && JSON.parse(cache['voztarjeta_conv-app']).tipo === 'datos', '4 · la app nueva: en pantalla y la voz dice lo importante');
  ok(/Tarjeta de la llamada · 2 reservas/.test(Y.tvLineaChat_(r.celda)), '4 · en el chat queda su línea');
}
{ const { X: Y } = caja({ canal: 'hub' });
  Y.tvCandidata_('datos', () => Y.tdReservas_(RES));
  ok(Y.TV_CANDIDATA_ === null, '4 · fuera de una llamada no hay candidata');
}
/* 5 · las candidatas */
{ const ag = fs.readFileSync(path.join(DIR, 'agente.js'), 'utf8'), ins = fs.readFileSync(path.join(DIR, 'instantaneas.js'), 'utf8');
  [['buscar_reservas', /tdReservas_\(outR\.reservas/], ['cancelaciones', /tdCancelaciones_\(rCa\)/], ['ruta_del_dia', /tdRuta_\(rt, fd\)/], ['tareas_abiertas', /tdTareas_\(ctx\.cfg\(\)\.tareas/],
    ['reporte_mes', /tdMes_\(rMe\)/], ['promesas_abiertas', /tdPromesas_\(lPr\)/], ['pedidos_en_orbita', /tdPedido_\(rOr\)/], ['ver_agenda', /tdAgenda_\(rCal\)/]]
    .forEach(([n, re]) => ok(re.test(ag), '5 · ' + n + ' deja el tablero de datos'));
  ok(/tdRuta_\(rt, f\)/.test(ins) && /tdRuta_\(rp, f\)/.test(ins), '5 · la respuesta instantánea de ruta también');
  ok(/tdReservas_\(lis, \{ dia: f/.test(ins), '5 · la de llegadas y salidas también');
  ok(/tdTareas_\(cfg\.tareas, hoy\)/.test(ins) && /tdPendientes_\(p\)/.test(ins), '5 · la de tareas y pendientes también');
}
/* 6 · la página */
{ const h = fs.readFileSync(path.join(__dirname, '..', 'alma', 'inicio.html'), 'utf8');
  ok(/c\.tipo === "barras"/.test(h) && /c\.tipo === "linea"/.test(h) && /c\.tipo === "numero"/.test(h), '6 · inicio.html pinta barras, línea y número');
  ok(/\.tvb-br i \{/.test(h) && /\.tvb-ln \{/.test(h) && /\.tvb-numero \{/.test(h), '6 · con su estilo');
  ok(/t\.eti \|\| "Alma encontró"/.test(h), '6 · el encabezado dice «Alma te muestra» en el tablero de datos');
}
process.exit(fallo);
