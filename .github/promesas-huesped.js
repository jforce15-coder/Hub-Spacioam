/* Prueba de las promesas al huésped (apps-script/promesas.js) con dobles: sin internet ni Google.
   Juan, 6-nov-2026: «La gestión de promesas es fatal. Se acumulan sin sentido.» Del 26-oct al 4-nov, 95 de 147 vencieron
   sin marca porque el equipo contesta directo en Hospitable o WhatsApp. Revisa:
   1. una promesa de código y un mensaje después con el código → cumplida (con su evidencia, sin el número);
   2. el huésped ya entró → cumplida;
   3. WiFi después del checkout → ya no aplica (con el motivo);
   4. una factura después del checkout → sigue abierta;
   5. la misma promesa dos veces en la conversación → cuenta 1 (al registrarla y en el historial);
   6. reserva activa, plazo vencido y nadie respondió → vencida (la única que se recuerda);
   7. el equipo contestó directo en Hospitable sobre el tema → cumplida; volver a prometer no cuenta;
   8. conversación interna del equipo y consulta para una fecha pasada → ya no aplica;
   9. la limpieza del historial se puede correr otra vez sin cambiar nada.
   node .github/promesas-huesped.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

function hoja(cab) {
  const filas = [cab.slice()];
  return {
    filas,
    getLastRow: () => filas.length, getLastColumn: () => Math.max.apply(null, filas.map(r => r.length)),
    appendRow: r => { filas.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = filas[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
      setValue: v => { filas[r - 1] = filas[r - 1] || []; filas[r - 1][c - 1] = v; },
      setValues: vs => { vs.forEach((row, i) => row.forEach((v, j) => { filas[r - 1 + i] = filas[r - 1 + i] || []; filas[r - 1 + i][c - 1 + j] = v; })); }
    })
  };
}
const H = 3600000, AHORA = Date.parse('2026-11-06T18:00:00Z');   // 12:00 en Guatemala
const iso = ms => new Date(ms).toISOString();
function caja(o) {
  o = o || {};
  const props = {}, inbox = {}, avisos = [];
  let sh = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp, isNaN,
    CFG: { TZ: 'America/Guatemala', MODELO_CLASIFICADOR: 'clasificador' },
    Utilities: { formatDate: (d, tz, f) => { const g = new Date(d.getTime() - 6 * H).toISOString(); return f === 'H' ? String(+g.slice(11, 13)) : g.slice(0, 10); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    hojaCrear_: (n, cab) => (sh = sh || hoja(o.cabVieja || cab)),
    claude_: () => JSON.stringify(o.detectado || { promesa: true, que: 'Confirmar con el equipo si hay televisión en la habitación', canal: 'plataforma', horas: 2 }),
    inboxUpsert_: (id, x) => { inbox[id] = Object.assign(inbox[id] || {}, x); },
    decisionCrear_: () => null,
    hiloConv_: id => ({ code: 200, hilo: (o.hilos || {})[id] || [] }),
    preContexto_: id => (o.reservas || {})[id] || {},
    adminPorTel_: t => (t === '50255550100' ? { nombre: 'Juan' } : null),
    chatPrincipal_: () => 'juan', vozAvisoPoner_: (a, t) => avisos.push(t), escalar_: (t, cuerpo) => avisos.push(t + '\n' + cuerpo)
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'promesas.js'), 'utf8'), ctx);
  return { ctx, inbox, avisos, props, hoja: () => sh };
}
/* Una promesa guardada (como las que ya hay en la hoja). */
function fila(c, p) {
  const CAB = c.ctx.PROM_CAB_, sh = c.ctx.hojaProm_();
  const r = Object.assign({ id: 'pr' + (sh.filas.length + 100), creada: iso(AHORA - 30 * H), conv_id: 'res-1', huesped: 'Huésped', propiedad: 'Z10 - Prueba - 101', canal: 'plataforma', vence: iso(AHORA - 28 * H), estado: 'abierta', origen: 'texto', texto: 'Lo confirmo con el equipo y te escribimos por aquí mismo.', avisos: 1 }, p);
  sh.appendRow(CAB.map(k => (r[k] === undefined ? '' : r[k])));
  return r.id;
}
const est = (c, id) => c.ctx.promFilas_().filas.find(f => f.id === id);
const repasar = c => c.ctx.promesasRepasar_({ todas: true, ahora: AHORA, max: 100 });
const activa = { checkin: '2026-11-04', checkout: '2026-11-09', status: 'accepted', tipo: 'reserva' };
const salio = { checkin: '2026-11-01', checkout: '2026-11-04', status: 'accepted', tipo: 'reserva' };
const msg = (tipo, horasAntes, texto, auto) => ({ tipo, texto, created: iso(AHORA - horasAntes * H), auto: !!auto });

/* 1. Código prometido y después enviado (por un automático de Hospitable) → cumplida, con la evidencia sin el número. */
{ const c = caja({ reservas: { 'res-1': Object.assign({}, activa, { checkin: '2026-11-06' }) }, hilos: { 'res-1': [msg('host', 29, 'Tu código de la puerta es 482913. ¡Bienvenido!', true)] } });
  const id = fila(c, { que: 'Enviar el código de la cerradura del apartamento si no ha llegado por la plataforma' });
  repasar(c); const f = est(c, id);
  ok(f.estado === 'cumplida', 'código y luego un mensaje con el código → cumplida (quedó ' + f.estado + ')');
  ok(f.tipo === 'acceso' && /acceso/.test(f.motivo), 'guarda el tipo y el motivo (' + f.tipo + ' · ' + f.motivo + ')');
  ok(/automático/.test(f.evidencia) && !/482913/.test(f.evidencia), 'la evidencia dice qué mensaje fue, sin el código');
  ok(c.inbox['res-1'].promesa_estado === 'cumplida', 'la bandeja ya no la muestra como abierta');
}
/* 2. El huésped ya entró. */
{ const c = caja({ reservas: { 'res-1': Object.assign({}, activa, { checkin: '2026-11-06' }) }, hilos: { 'res-1': [msg('guest', 20, 'Listo, ya entramos, todo perfecto')] } });
  const id = fila(c, { que: 'Enviar el código de acceso directamente si no llega por la plataforma' });
  repasar(c);
  ok(est(c, id).estado === 'cumplida' && /entró/.test(est(c, id).motivo), 'el huésped ya entró → cumplida (' + est(c, id).motivo + ')');
}
/* 3. WiFi después del checkout → ya no aplica, con el motivo. */
{ const c = caja({ reservas: { 'res-1': salio } });
  const id = fila(c, { que: 'Confirmar la contraseña del WiFi y escribir al huésped' });
  repasar(c); const f = est(c, id);
  ok(f.estado === 'ya no aplica', 'WiFi después del checkout → ya no aplica (quedó ' + f.estado + ')');
  ok(/estadía terminó el 2026-11-04/.test(f.motivo), 'el motivo dice por qué (' + f.motivo + ')');
}
/* 4. Factura después del checkout → sigue viva. */
{ const c = caja({ reservas: { 'res-1': salio } });
  const id = fila(c, { que: 'Enviar la factura dentro de 5 días hábiles posteriores a la salida', vence: iso(AHORA + 48 * H) });
  const vieja = fila(c, { conv_id: 'res-2', que: 'Confirmar cuando se haya realizado el depósito de la multa', vence: iso(AHORA - 48 * H) });
  c.ctx.preContexto_ = () => salio;
  repasar(c);
  ok(est(c, id).estado === 'abierta', 'factura después del checkout → sigue abierta (quedó ' + est(c, id).estado + ')');
  ok(est(c, vieja).estado === 'vencida', 'un depósito vencido después de la salida sigue importando → vencida (quedó ' + est(c, vieja).estado + ')');
}
/* 5. Repetidas: al registrarla y en el historial. */
{ const c = caja({ reservas: { 'res-1': activa } });
  const a = c.ctx.promesaRegistrar_({ resId: 'res-1', huesped: 'H' }, 'Lo confirmo con el equipo y te escribimos por aquí mismo.', 'texto');
  c.ctx.hojaProm_().filas[1][1] = iso(Date.now() - 2 * H);   // la primera es de hace 2 h (fuera de la ventana de 30 min)
  const b = c.ctx.promesaRegistrar_({ resId: 'res-1', huesped: 'H' }, 'Ya le pregunté al equipo; te confirmamos en cuanto tengamos respuesta.', 'texto');
  ok(a && b && b.repetida && b.id === a.id, 'la misma promesa otra vez → devuelve la que ya estaba');
  ok(c.ctx.promFilas_().filas.length === 1, 'al registrar: 1 fila (hay ' + c.ctx.promFilas_().filas.length + ')');
  const c2 = caja({ reservas: { 'res-1': activa } });
  const x = fila(c2, { que: 'Confirmar con el equipo si se puede agregar una persona más y escribir la respuesta', creada: iso(AHORA - 10 * H), vence: iso(AHORA + 10 * H) });
  const y = fila(c2, { que: 'Confirmar con el equipo si se puede agregar una persona más y comunicar la respuesta', creada: iso(AHORA - 6 * H), vence: iso(AHORA + 10 * H) });
  repasar(c2);
  const vivas = c2.ctx.promFilas_().filas.filter(f => f.estado === 'abierta' || f.estado === 'vencida');
  ok(vivas.length === 1 && vivas[0].id === x, 'historial con dos iguales → queda 1 viva (quedan ' + vivas.length + ')');
  ok(/repetida: es la misma que /.test(est(c2, y).motivo), 'la repetida dice cuál es la original');
}
/* 6. Reserva activa, sin respuesta y con el plazo vencido → vencida, y es lo único que se recuerda. */
{ const c = caja({ reservas: { 'res-1': activa, 'res-2': salio }, hilos: { 'res-1': [msg('guest', 25, '¿Me confirman lo de las toallas?')] } });
  const id = fila(c, { que: 'Confirmar con el equipo sobre las toallas y escribir mañana temprano' });
  fila(c, { conv_id: 'res-2', que: 'Revisar el problema de internet y escribir al huésped' });
  c.ctx.promesasRevisar_ = c.ctx.promesasRevisar_;   // la pasada periódica de procesarCola
  c.props.PROM_LIMPIEZA_V1 = '';
  const realNow = Date.now; Date.now = () => AHORA;
  try { c.ctx.promesasRevisar_(); } finally { Date.now = realNow; }
  ok(est(c, id).estado === 'vencida', 'reserva activa y nadie respondió → vencida (quedó ' + est(c, id).estado + ')');
  const res = c.avisos.join('\n');
  ok(/toallas/.test(res) && !/internet/.test(res), 'el resumen al equipo trae solo la vencida de verdad');
  ok(!!c.props.PROM_LIMPIEZA_V1, 'la primera pasada limpia el historial y lo anota (PROM_LIMPIEZA_V1)');
}
/* 7. El equipo contestó directo en Hospitable; volver a prometer no cuenta. */
{ const c = caja({ reservas: { 'res-1': activa, 'res-2': activa }, hilos: {
    'res-1': [msg('host', 20, 'Hola, sí: hay televisión en las dos habitaciones.')],
    'res-2': [msg('host', 20, 'Gracias por tu paciencia, el equipo te confirma en cuanto tengamos respuesta sobre la televisión.')] } });
  const a = fila(c, { que: 'Confirmar con el equipo si hay televisión en la habitación y escribir la respuesta' });
  const b = fila(c, { conv_id: 'res-2', que: 'Confirmar con el equipo si hay televisión en la habitación y escribir la respuesta' });
  repasar(c);
  ok(est(c, a).estado === 'cumplida' && /respondió/.test(est(c, a).motivo), 'respuesta del equipo en Hospitable sobre el tema → cumplida');
  ok(est(c, b).estado === 'vencida', 'un mensaje que solo vuelve a prometer no la cumple (quedó ' + est(c, b).estado + ')');
}
/* 8. Conversación interna del equipo y consulta de una fecha pasada → ya no aplica; lo interno ni se registra. */
{ const c = caja({ reservas: { 'inq:q1': { checkin: '2026-11-02', checkout: '2026-11-05', status: 'inquiry', tipo: 'consulta' } } });
  const a = fila(c, { conv_id: 'wa:50255550100', huesped: 'Equipo · Juan', propiedad: 'Llamada del equipo', que: 'Avisar cuando llegue la respuesta' });
  const b = fila(c, { conv_id: 'inq:q1', que: 'Confirmar con el equipo si la piscina es climatizada' });
  repasar(c);
  ok(est(c, a).estado === 'ya no aplica' && /interna/.test(est(c, a).motivo), 'conversación interna del equipo → ya no aplica');
  ok(est(c, b).estado === 'ya no aplica' && /consulta era para el 2026-11-02/.test(est(c, b).motivo), 'consulta para una fecha pasada → ya no aplica');
  const n = c.ctx.promFilas_().filas.length;
  c.ctx.promesaRegistrar_({ resId: 'wa:50255550100', huesped: 'Juan' }, 'Te aviso cuando llegue la respuesta.', 'texto');
  ok(c.ctx.promFilas_().filas.length === n, 'lo que Alma le promete a alguien del equipo no se registra como promesa al huésped');
}
/* 9. Limpieza del historial: hoja vieja (14 columnas), se puede correr otra vez. */
{ const vieja = ['id', 'creada', 'conv_id', 'huesped', 'propiedad', 'canal', 'que', 'vence', 'estado', 'origen', 'texto', 'avisos', 'cerrada_por', 'cerrada_ts'];
  const c = caja({ cabVieja: vieja, reservas: { 'res-1': salio, 'res-2': activa } });
  fila(c, { que: 'Revisar el problema de internet y escribir al huésped', estado: 'vencida' });
  fila(c, { conv_id: 'res-2', que: 'Revisar la lavadora y confirmar al huésped', estado: 'vencida' });
  ok(c.hoja().filas[0].length === c.ctx.PROM_CAB_.length, 'la hoja vieja recibe las columnas nuevas (tipo, motivo, evidencia, revisada)');
  const realNow = Date.now; Date.now = () => AHORA;
  let r1, r2; try { r1 = c.ctx.promesasLimpiarHistorial(); r2 = c.ctx.promesasLimpiarHistorial(); } finally { Date.now = realNow; }
  ok(r1.antes.vencida === 2 && r1.despues.vencida === 1, 'limpieza: 2 vencidas antes, 1 después (' + JSON.stringify(r1.despues) + ')');
  ok(JSON.stringify(r2.antes) === JSON.stringify(r2.despues), 'correrla otra vez no cambia nada');
}
process.exit(fallo);
