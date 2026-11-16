/* Prueba de la rutina de cada hora (apps-script/rutinahora.js, #545) con dobles: sin internet ni Google.
   Juan, 15-nov-2026: cada hora revisar pendientes y promesas que ningún humano atendió, y resolver sola al menos el 60 %
   con respuestas anteriores a preguntas repetidas. Revisa:
   1. una promesa vencida («¿se permiten mascotas?») con una respuesta anterior del equipo casi igual → Alma la responde
      UNA vez y la promesa queda cumplida «por Alma», con el motivo;
   2. dinero (reembolso) nunca se responde solo, aunque haya una respuesta parecida;
   3. si el modelo solo vuelve a prometer, o pone un número que no está ni en la conversación ni en la respuesta anterior,
      no sale nada;
   4. RUTINA_HORA_RESPONDER = no y de noche (23:00) → no envía: queda como propuesta;
   5. la respuesta anterior de la MISMA conversación o de la propia rutina no cuenta;
   6. la decisión del equipo que abrió una promesa ya cerrada se cierra;
   7. una sola tarjeta «Para leer» por cambio, sin notificación, con la cuenta y la meta del 60 %.
   node .github/rutina-hora.js [carpeta apps-script] */
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
const H = 3600000, MEDIODIA = Date.parse('2026-11-15T18:00:00Z'), NOCHE = Date.parse('2026-11-16T05:00:00Z');   // 12:00 y 23:00 en Guatemala
const iso = ms => new Date(ms).toISOString();
const PROMESA = 'Lo confirmo con el equipo y te escribimos por aquí mismo.';
const activa = { checkin: '2026-11-14', checkout: '2026-11-20', status: 'accepted', tipo: 'reserva' };
const BUENA = '¡Hola! Sí, en el apartamento se aceptan mascotas pequeñas; solo te pedimos que no suban a las camas. ¡Que disfrutes tu estadía!';

function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), enviados = [], tarjetas = [], cerradas = [], llamadas = [];
  let sh = null;
  const ahora = o.ahora || MEDIODIA;
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(ahora); } static now() { return ahora; } }, Math, String, Number, Object, Array, RegExp, isNaN,
    CFG: { TZ: 'America/Guatemala', MODELO_CLASIFICADOR: 'clasificador', MODELO_REDACTOR: 'redactor', TAB_AUTOMEJORA: 'ALMA_AUTOMEJORA', HUB_URL: 'https://hub.prueba' },
    Utilities: { formatDate: (d, tz, f) => { const g = new Date(d.getTime() - 6 * H).toISOString(); return f === 'H' ? String(+g.slice(11, 13)) : g.slice(0, 10); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    USO_REF_: '', s_: v => (v == null || typeof v === 'object') ? '' : String(v),
    hojaCrear_: (n, cab) => (sh = sh || hoja(cab)),
    hoja_: () => o.automejora || null,
    inboxUpsert_() {}, decisionCrear_: () => null,
    hiloConv_: id => ({ code: 200, hilo: (o.hilos || {})[id] || [] }),
    preContexto_: id => (o.reservas || {})[id] || {},
    adminPorTel_: () => null,
    claude_: (modelo, max, sys, usr) => { llamadas.push(usr); return typeof o.modelo === 'function' ? o.modelo(usr) : JSON.stringify({ responder: true, mensaje: o.mensaje || BUENA, por_que: 'regla general' }); },
    hubResponder_: (conv, texto, quien) => { enviados.push({ conv, texto, quien }); ctx.promesasCumplir_(conv, quien); return { ok: true }; },
    decFilas_: () => ({ filas: o.decisiones || [] }),
    decViva_: f => f.estado === 'abierta' || f.estado === 'elegida',
    decTexto_: f => f.mensaje || '', decCtx_: f => f.ctx || {},
    decisionCerrar_: (conv, quien) => { cerradas.push({ conv, quien }); (o.decisiones || []).forEach(f => { if (f.resId === conv) f.estado = 'enviada'; }); },
    decEnlace_: id => 'https://hub.prueba/?conv=' + id,
    chatPrincipal_: () => ({ email: 'juan@prueba', principal: true }),
    pendAvisar_: (adm, texto, op) => { tarjetas.push({ texto, op }); return true; }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(DIR, 'promesas.js'), 'utf8'), ctx, { filename: 'promesas.js' });
  vm.runInContext(fs.readFileSync(path.join(DIR, 'rutinahora.js'), 'utf8'), ctx, { filename: 'rutinahora.js' });
  const fila = p => {
    const CAB = ctx.PROM_CAB_, s = ctx.hojaProm_();
    const r = Object.assign({ id: 'pr' + (s.filas.length + 100), creada: iso(ahora - 30 * H), conv_id: 'res-1', huesped: 'Huésped', propiedad: 'Z10 - Prueba - 101', canal: 'plataforma',
      vence: iso(ahora - 28 * H), estado: 'vencida', origen: 'texto', texto: PROMESA, avisos: 1 }, p);
    s.appendRow(CAB.map(k => (r[k] === undefined ? '' : r[k])));
    return r.id;
  };
  const est = id => ctx.promFilas_().filas.find(f => f.id === id);
  return { ctx, props, enviados, tarjetas, cerradas, llamadas, fila, est, correr: () => ctx.rutinaHora_({ ahora }) };
}
const hiloMascotas = ahora => [
  { tipo: 'guest', texto: '¿Se permiten mascotas? Viajamos con un perrito.', created: iso(ahora - 31 * H) },
  { tipo: 'host', texto: PROMESA, created: iso(ahora - 30 * H) }
];
const decAnterior = (o) => Object.assign({ id: 'dc1', resId: 'res-9', estado: 'enviada', enviado_por: 'Ana', origen: 'promesa', motivo: 'Confirmar si se aceptan mascotas en el apartamento',
  mensaje: '¡Hola! Sí aceptamos mascotas pequeñas, solo te pedimos que no suban a las camas.', ctx: { propiedad: 'Z11 - Otra - 202', texto: '¿Aceptan perros?' } }, o || {});
const base = (o) => Object.assign({ reservas: { 'res-1': activa }, hilos: { 'res-1': hiloMascotas(MEDIODIA) }, decisiones: [decAnterior()] }, o || {});

/* 1. Respuesta anterior casi igual → responde una vez y queda cumplida por Alma. */
{ const c = caja(base());
  const id = c.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  const r = c.correr(), f = c.est(id);
  ok(c.enviados.length === 1 && c.enviados[0].conv === 'res-1' && c.enviados[0].texto === BUENA, 'promesa vencida con respuesta anterior casi igual → Alma responde una vez (' + c.enviados.length + ')');
  ok(f.estado === 'cumplida' && /Alma respondió/.test(f.motivo) && /Alma/.test(f.cerrada_por), 'queda cumplida por Alma, con el motivo (' + f.estado + ' · ' + f.motivo + ' · ' + f.cerrada_por + ')');
  ok(r.respondidas === 1 && r.resueltas >= 1 && r.pct === 100, 'la cuenta: resolvió 1 de 1 (' + r.resueltas + ' de ' + r.revisadas + ', ' + r.pct + ' %)');
  ok(c.llamadas.length === 1 && /aceptan mascotas/.test(c.llamadas[0]) && /perrito/.test(c.llamadas[0]), 'el modelo recibe la conversación y la respuesta anterior');
}
/* 2. Dinero: nunca solo. */
{ const c = caja(base({ decisiones: [decAnterior({ motivo: 'Confirmar el reembolso de la noche del apartamento', mensaje: 'Ya hicimos el reembolso.' })] }));
  const id = c.fila({ que: 'Confirmar el reembolso de la noche del apartamento' });
  c.correr();
  ok(c.enviados.length === 0 && c.llamadas.length === 0 && c.est(id).estado === 'vencida', 'reembolso → no se responde solo; sigue esperando (' + c.est(id).estado + ')');
}
/* 3. Volver a prometer o inventar un número no sale. */
{ const c = caja(base({ mensaje: 'Gracias por tu paciencia, lo confirmo con el equipo y te escribimos.' }));
  const id = c.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  c.correr();
  ok(c.enviados.length === 0 && c.est(id).estado === 'vencida', 'el modelo solo vuelve a prometer → no sale nada');
  const c2 = caja(base({ mensaje: 'Sí se aceptan mascotas pequeñas con un cargo de Q350 por estadía. ¡Bienvenido!' }));
  c2.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  c2.correr();
  ok(c2.enviados.length === 0, 'un monto que no está en la conversación ni en la respuesta anterior → no sale');
  const c3 = caja(base({ modelo: () => '{"responder": false, "por_que": "depende de este caso"}' }));
  c3.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  c3.correr();
  ok(c3.enviados.length === 0, 'el modelo dice que no aplica → no sale');
}
/* 4. Apagado o de noche: propuesta, sin enviar. */
{ const c = caja(base({ props: { RUTINA_HORA_RESPONDER: 'no' } }));
  c.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  const r = c.correr();
  ok(c.enviados.length === 0 && r.propuestas.length === 1, 'RUTINA_HORA_RESPONDER = no → queda como propuesta, sin enviar');
  ok(c.tarjetas.length === 1 && /Propuestas sin enviar/.test(c.tarjetas[0].texto), 'la propuesta sale en la tarjeta «Para leer»');
  const n = caja(base({ ahora: NOCHE, hilos: { 'res-1': hiloMascotas(NOCHE) } }));
  n.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  n.correr();
  ok(n.enviados.length === 0, 'a las 23:00 no se le escribe al huésped');
}
/* 5. La misma conversación o la propia rutina no son «respuesta anterior». */
{ const c = caja(base({ decisiones: [decAnterior({ resId: 'res-1' }), decAnterior({ id: 'dc2', enviado_por: 'Alma (rutina de cada hora)' })] }));
  c.fila({ que: 'Confirmar con el equipo si se permiten mascotas en el apartamento' });
  c.correr();
  ok(c.enviados.length === 0 && c.llamadas.length === 0, 'solo cuentan respuestas de personas en otras conversaciones');
}
/* 6. Decisión de una promesa ya cerrada → se cierra. */
{ const dec = { id: 'dc5', resId: 'res-5', estado: 'abierta', origen: 'promesa', creado: iso(MEDIODIA - 3 * H), motivo: 'x' };
  const c = caja(base({ decisiones: [decAnterior(), dec] }));
  c.fila({ conv_id: 'res-5', estado: 'cumplida', que: 'Confirmar algo' });
  const r = c.correr();
  ok(c.cerradas.length === 1 && c.cerradas[0].conv === 'res-5' && /promesa ya se cerró/.test(c.cerradas[0].quien), 'la decisión de una promesa ya cerrada se cierra (' + c.cerradas.length + ')');
  ok(r.decisiones === 1, 'y cuenta como resuelta');
}
/* 7. Una tarjeta por cambio, sin notificación. */
{ const c = caja(base({ decisiones: [] }));
  c.fila({ que: 'Confirmar con el equipo si hay estacionamiento techado para una camioneta' });
  c.correr(); c.correr();
  ok(c.tarjetas.length === 1, 'lo mismo dos horas seguidas → una sola tarjeta (' + c.tarjetas.length + ')');
  const t = c.tarjetas[0];
  ok(t && t.op.push === false && t.op.clasif.tipo === 'aviso', 'es «Para leer» y sin notificación');
  ok(t && /meta 60 %/.test(t.texto) && /Siguen esperando/.test(t.texto) && /estacionamiento/.test(t.texto), 'dice la cuenta, la meta y lo que sigue esperando');
  ok(JSON.parse(c.props.RUTINA_HORA_HIST).length === 2, 'guarda la cuenta de cada vuelta para medir la meta');
}
process.exit(fallo);
