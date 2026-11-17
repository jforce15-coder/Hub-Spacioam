/* Prueba de la regla «Operaciones: de día solo hoy, mañana al cierre» (apps-script/agentes.js) con dobles: sin internet
   ni Google. Juan, 17-nov-2026: «descartar propuestas de mensajes a Gabriel por tareas vencidas ya realizadas; no presentar
   propuestas de limpiezas de mañana durante el día; las de mañana, solo de 7 a 8 PM si queda alguna pendiente».
   Revisa:
   1. agOpFuera_: de día, lo de mañana (por fecha o por «mañana») → fuera; «de la mañana» de hoy → se queda; al cierre,
      solo mañana; un mensaje al equipo por una tarea vencida → fuera siempre; cerrar_tarea → se queda;
   2. en la ronda de la 1 PM la propuesta que se sale no se guarda y el agente recibe el porqué; la de hoy sí; la ronda
      descarta lo que Operaciones tenía sin decidir; si Juan lo pidió, no hay filtro; la regla es solo de Operaciones;
   3. hojaAg_: horario 7,13,18 → 7,13,19 y la misión vieja → la nueva (lo de otros agentes no se toca).
   node .github/operaciones-hoy.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const H = 3600000;

function hoja(cab, filas) {
  const v = [cab.slice()].concat((filas || []).map(o => cab.map(k => (o[k] != null ? o[k] : ''))));
  return {
    v,
    getLastRow: () => v.length, getLastColumn: () => cab.length,
    getRange: (r, c, nr, nc) => ({
      getValues: () => v.slice(r - 1, r - 1 + nr).map(f => f.slice(c - 1, c - 1 + nc).concat(Array(Math.max(0, nc - f.length)).fill(''))),
      setValues: (vals) => vals.forEach((f, i) => { v[r - 1 + i] = f.slice(); })
    }),
    appendRow: f => v.push(f.slice())
  };
}

function caja(o) {
  o = o || {};
  const st = { ahora: o.ahora || Date.parse('2026-11-17T13:00:00-06:00'), hojas: {}, respuestas: (o.respuestas || []).slice(), vistos: [] };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Object, Array, RegExp,
    CFG: { TZ: 'America/Guatemala', MODELO_REDACTOR: 'm' },
    Utilities: { formatDate: (d, tz, f) => { const g = new Date(d.getTime() - 6 * H).toISOString(); if (f === 'H') return String(+g.slice(11, 13)); if (f === 'u') return '2'; if (f === 'yyyy-MM') return g.slice(0, 7); if (/HH/.test(f)) return g.slice(0, 10) + 'T' + g.slice(11, 13); return g.slice(0, 10); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    ahora_: () => new Date(st.ahora),
    hojaCrear_: (n, cab) => (st.hojas[n] = st.hojas[n] || hoja(cab, (o.filas || {})[n])),
    adminsOp_: () => [{ email: 'juan@x', nombre: 'Juan', principal: true }],
    esAdminPrincipal_: () => true,
    agHerramientas_: () => ['buscar_reservas', 'ruta_del_dia', 'tareas_abiertas', 'crear_tarea', 'cerrar_tarea', 'agendar_en_epi', 'escribir_a_equipo'].map(n => ({ name: n })),
    agEjecutar_: () => ({ ok: true }),
    epiSnap_: () => ({}),
    claudeTools_: (m, system, msgs) => { st.system = system; if (msgs.length > 1) st.vistos.push(msgs[msgs.length - 1]); return st.respuestas.shift() || { content: [{ type: 'text', text: 'Informe.' }] }; },
    EQ_EQUIPOS_: ['operaciones'], EQ_EQUIPOS_: ['operaciones'], costoIA_: () => 0, playbookLeer_: () => '', opGuardar_() {}, pushA_() {}, eqRefrescarSuave_() {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'literal.js'), 'utf8'), ctx, { filename: 'literal.js' });   // las palabras de Juan tal cual
  vm.runInContext(fs.readFileSync(path.join(DIR, 'agentes.js'), 'utf8'), ctx, { filename: 'agentes.js' });
  return { ctx, st };
}
const uso = (name, input, id) => ({ type: 'tool_use', id: id || 'u' + name, name, input });

/* 1 · el filtro */
(() => {
  const { ctx } = caja(), dia = ctx.agOpAlcance_(new Date(Date.parse('2026-11-17T13:00:00-06:00'))), noche = ctx.agOpAlcance_(new Date(Date.parse('2026-11-17T19:20:00-06:00')));
  const F = (alc, h, inp) => ctx.agOpFuera_(alc, h, inp);
  ok(!dia.cierre && noche.cierre && noche.manana === '2026-11-18', 'la 1 PM es del día y las 7 PM son el cierre');
  ok(F(dia, 'agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Narama 623', fecha: '2026-11-18' }), 'de día, agendar una limpieza de mañana → fuera');
  ok(!F(dia, 'agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Narama 623', fecha: '2026-11-17' }), 'de día, agendar una de hoy → se queda');
  ok(F(dia, 'escribir_a_equipo', { persona: 'Gabriel', texto: 'Mañana hay que limpiar Monaco D6 antes de las 3' }), 'de día, avisar una limpieza de mañana → fuera');
  ok(!F(dia, 'escribir_a_equipo', { persona: 'Selvin', texto: 'Hoy a las 10 de la mañana hay limpieza en Monaco D6' }), '«de la mañana» de hoy → se queda');
  ok(!F(noche, 'agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Narama 623', fecha: '2026-11-18' }) && F(noche, 'agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Narama 623', fecha: '2026-11-17' }), 'al cierre, solo lo de mañana');
  ok(F(dia, 'escribir_a_equipo', { persona: 'Gabriel', texto: 'Gabriel, la tarea de revisar la lavadora en 1104 está vencida desde el 12' }), 'mensaje a Gabriel por tarea vencida → fuera');
  ok(F(noche, 'escribir_a_equipo', { persona: 'Gabriel', texto: 'Te recuerdo la tarea pendiente de cambiar focos en 301' }), 'también al cierre: recordatorio de tarea pendiente → fuera');
  ok(F(dia, 'programar_mensaje', { persona: 'Gabriel', texto: 'Sigue pendiente lo del control remoto', cuando: 'hoy 5 pm' }), 'programar un recordatorio de algo que sigue pendiente → fuera');
  ok(!F(dia, 'cerrar_tarea', { id: 't9', comentario: 'Vencida; parece hecha' }), 'proponer cerrar una tarea vencida → se queda');
  ok(!F(dia, 'escribir_a_equipo', { persona: 'Selvin', texto: 'Hoy entra un huésped a 623 a las 3 pm; ¿puedes dejar toallas extra?' }), 'aviso normal de hoy → se queda');
})();

/* 2 · la ronda */
(() => {
  const P = [{ id: 'v1', tarea: 't0', agente: 'operaciones', creado: '2026-11-16T15:00:00Z', titulo: 'Escribirle a Gabriel', herramienta: 'escribir_a_equipo', entrada: '{}', estado: 'pendiente' },
    { id: 'v2', tarea: 't0', agente: 'mantenimiento', creado: '2026-11-16T15:00:00Z', titulo: 'x', herramienta: 'crear_tarea', entrada: '{}', estado: 'pendiente' }];
  const { ctx, st } = caja({ filas: { ALMA_AG_PROPUESTAS: P }, respuestas: [
    { content: [{ type: 'text', text: 'Falta limpieza.' }, uso('agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Narama 623', fecha: '2026-11-18' }, 'a1'), uso('escribir_a_equipo', { persona: 'Gabriel', texto: 'La tarea de 1104 está vencida' }, 'a2'), uso('agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Monaco D6', fecha: '2026-11-17' }, 'a3')] },
    { content: [{ type: 'text', text: 'Informe final.' }] }] });
  const a = ctx.agentes_().filter(x => x.id === 'operaciones')[0];
  const r = ctx.agenteCorrer_(a, 'rutina', '');
  ok(r.propuestas.length === 1 && /Monaco D6/.test(r.propuestas[0].titulo), 'en la ronda de la 1 PM solo queda la propuesta de hoy (' + r.propuestas.length + ')');
  const res = (st.vistos[0] || { content: [] }).content;
  ok(res.length === 3 && /7 a 8 PM/.test(res[0].content) && /tarea vencida/.test(res[1].content), 'el agente recibe el porqué de cada una que se salió');
  ok(/REVISIÓN DEL DÍA/.test(st.system), 'el prompt de la ronda dice que es la revisión del día');
  const E = {}; ctx.agFilas_(st.hojas.ALMA_AG_PROPUESTAS, vm.runInContext('AGP_CAB_', ctx)).forEach(p => { E[p.id] = p; });
  ok(E.v1.estado === 'descartada' && E.v1.resultado && E.v2.estado === 'pendiente', 'la ronda descarta lo viejo de Operaciones (con motivo) y no toca lo de otros');
})();
(() => {
  const { ctx, st } = caja({ respuestas: [
    { content: [uso('agendar_en_epi', { trabajo: 'Limpieza', propiedad: 'Narama 623', fecha: '2026-11-18' })] }, { content: [{ type: 'text', text: 'Listo.' }] }] });
  const a = ctx.agentes_().filter(x => x.id === 'operaciones')[0];
  const r = ctx.agenteCorrer_(a, 'a mano', 'Revisa las limpiezas de mañana');
  ok(r.propuestas.length === 1 && !/REVISIÓN DEL DÍA/.test(st.system), 'si Juan lo pide, lo de mañana sí se propone');
})();
(() => {
  const { ctx } = caja({ respuestas: [{ content: [uso('escribir_a_equipo', { persona: 'Gabriel', texto: 'La tarea de 1104 está vencida' })] }, { content: [{ type: 'text', text: 'ok' }] }] });
  const a = ctx.agentes_().filter(x => x.id === 'mantenimiento')[0];
  ok(ctx.agenteCorrer_(a, 'rutina', '').propuestas.length === 1, 'la regla es solo de Operaciones');
})();

/* 3 · la hoja vieja se pone al día */
(() => {
  const { ctx } = caja();
  const vieja = vm.runInContext('AG_OP_MISION_VIEJA_', ctx);
  const { ctx: c2 } = caja({ filas: { ALMA_AGENTES: [{ id: 'operaciones', nombre: 'Operaciones', mision: vieja, horas: '7,13,18', estado: 'activo' }, { id: 'huespedes', nombre: 'H', mision: 'a mano hoy y mañana', horas: '8,16,21', estado: 'activo' }] } });
  const L = c2.agentes_(), op = L.filter(x => x.id === 'operaciones')[0], hu = L.filter(x => x.id === 'huespedes')[0];
  ok(op.horas === '7,13,19' && op.mision !== vieja && /HOY/.test(op.mision), 'Operaciones pasa a 7,13,19 y a la misión nueva');
  ok(hu.mision === 'a mano hoy y mañana' && hu.horas === '8,16,21', 'lo de otros agentes no se toca');
})();

process.exit(fallo);
