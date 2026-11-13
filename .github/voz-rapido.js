/* Prueba del camino rápido de la voz (apps-script/rapido.js, #498 T4) con dobles: sin Google, sin Anthropic, sin hojas.
   Corre el opAgente_ de verdad (agente.js) con una API de Claude de mentira que contesta según el modelo.
   1. Un pedido de leer en una llamada va al modelo rápido con SOLO herramientas de leer (y pasar_al_completo), sin
      temperatura y con esfuerzo bajo; contesta él y el de siempre no se llama. El cronómetro y IA_USO dicen qué modelo.
   2. Un pedido que escribe («escríbele…», «programa…», «cancela…») va directo al de siempre, con todas las herramientas.
   3. Si el rápido no puede (falla la API, pide pasar_al_completo, pide una herramienta que no tiene, dice que no sabe o
      que no puede, dice que algo quedó hecho, se niega), el turno pasa al de siempre desde el mismo pedido y sin lo que el
      rápido leyó; una herramienta que no es de leer nunca corre.
   4. Con el interruptor apagado (VOZ_RAPIDO = 0) todo va por el de siempre; fuera de la secretaria por voz (Hub, WhatsApp,
      la familia) nada cambia.
   5. Si el rápido gastó el plazo de la llamada, el de siempre no empieza otra vuelta: sigue en segundo plano.
   6. Las herramientas del rápido existen y ninguna escribe; la decisión vive en un solo lugar; vozSecretaria_ lo enciende
      y lo apaga; el precio del modelo rápido está en la tabla.
   7. El portero Jev (#498 T5), con una API de Jev de mentira: leer con confianza alta → rápido; leer con confianza baja,
      hacer u otro → el de siempre; si Jev falla, tarda o contesta raro → las reglas de antes, y tras tardar o 3 fallos
      seguidos se apaga 10 min; sin JEV_KEY o con VOZ_JEV = 0 → las reglas sin llamarlo; un verbo de hacer gana aunque Jev
      diga leer; a Jev va solo el pedido, sin teléfonos ni correos; la llave nunca sale en registros, traza ni respuestas.
   node .github/voz-rapido.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };

const SONNET = 'claude-sonnet-4-6', RAPIDO = 'claude-haiku-5-5';
/* Las que escriben o mandan algo: ninguna puede estar en el camino rápido. */
const ESCRIBEN = ['cancelar_programados_reserva', 'crear_evento', 'mover_evento', 'cancelar_evento', 'preparar_uber', 'marcar_resuelta', 'enviar_a_huesped',
  'escribir_a_equipo', 'crear_tarea', 'cerrar_tarea', 'agendar_en_epi', 'cambiar_dato_propiedad', 'encargar_conversacion', 'cerrar_encargo', 'grow_crear_proyecto',
  'grow_mover_etapa', 'grow_agendar_visita', 'grow_presupuesto_pdf', 'actualizar_dato', 'recordar_en_propiedad', 'olvidar_memoria', 'mensaje_personal',
  'asignar_a_proyecto', 'cerrar_proyecto', 'programar_mensaje', 'cancelar_programado', 'musica', 'pedir_a_agente', 'enviar_archivo', 'unir_cambio',
  'ajustar_playbook', 'decidir_propuestas', 'responder_correo', 'enviar_correo', 'guardar_familia', 'dar_acceso_mi_ayudante', 'guardar_nota', 'vigilar',
  'dejar_de_vigilar', 'avisar_aterrizaje', 'buscar_reuniones', 'buscar_contacto', 'ver_proyecto'];

/* guion[modelo] = lista de respuestas (una por vuelta); una función recibe el cuerpo y devuelve la respuesta. */
function caja(o) {
  o = o || {};
  const props = Object.assign({ ANTHROPIC_KEY: 'k' }, o.props || {}), pedidos = [], usos = [], corridas = [], jevs = [], logs = [], cache = {};
  const jevGuion = (o.jev || []).slice(); let desfase = 0;
  /* El reloj: Jev de mentira puede «tardar» sumando milisegundos sin esperar de verdad. */
  const RealDate = Date;
  const FakeDate = function (...a) { return a.length ? new RealDate(...a) : new RealDate(RealDate.now() + desfase); };
  FakeDate.now = () => RealDate.now() + desfase; FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse; FakeDate.prototype = RealDate.prototype;
  /* Jev de mentira: { choice, confianza } · { http } · { raro } · { lanza } · { tarda: ms } (además de contestar). */
  const jevResp = (x) => {
    if (x.tarda) desfase += x.tarda;
    if (x.lanza) throw new Error('Address unavailable');
    if (x.http) return { getResponseCode: () => x.http, getContentText: () => '{"detail":"error"}' };
    if (x.raro) return { getResponseCode: () => 200, getContentText: () => (x.raro === 'json' ? '<html>' : JSON.stringify({ answers: { otra: {} } })) };
    const probs = { leer: 0, hacer: 0, otro: 0 }; probs[x.choice] = x.confianza;
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ model: 'jev-1.13.0', answers: { camino: { type: 'choice', choice: x.choice, confidence: x.confianza, probabilities: probs } }, usage: { input_tokens: 180, output_tokens: 12 } }) };
  };
  const guion = { [RAPIDO]: (o.rapido || []).slice(), [SONNET]: (o.sonnet || [{ text: 'Respuesta del de siempre.' }]).slice() };
  const resp = (x, cuerpo) => {
    if (typeof x === 'function') x = x(cuerpo);
    if (x.http) return { getResponseCode: () => x.http, getContentText: () => '{"type":"error"}' };
    const content = (x.thinking ? [{ type: 'thinking', thinking: '', signature: 's' }] : []).concat(x.tools ? x.tools.map((t, i) => ({ type: 'tool_use', id: 'tu' + pedidos.length + i, name: t.name, input: t.input || {} })) : [{ type: 'text', text: x.text }]);
    const j = { content, stop_reason: x.stop || (x.tools ? 'tool_use' : 'end_turn'), usage: { input_tokens: 1000, output_tokens: 50 } };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(j) };
  };
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) }, JSON, Math, String, Number, Object, Array, RegExp, Error, Date: FakeDate, isNaN, encodeURIComponent,
    CFG: { TZ: 'America/Guatemala', MODELO_REDACTOR: SONNET, MODELO_CLASIFICADOR: 'claude-haiku-4-5-20251001' },
    Utilities: { formatDate: (d, tz, f) => (f === 'yyyy-MM-dd' ? '2026-11-12' : 'jueves 12 nov 10:00') },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
    ahora_: () => new Date(),
    uf_: (url, op) => {
      if (/typesafe\.ai/.test(url)) { const cuerpo = JSON.parse(op.payload); jevs.push({ url, op, cuerpo }); return jevResp(jevGuion.length ? jevGuion.shift() : { choice: 'leer', confianza: 0.95 }); }
      const cuerpo = JSON.parse(op.payload); pedidos.push(cuerpo);
      const g = guion[cuerpo.model]; if (!g) throw new Error('modelo inesperado: ' + cuerpo.model);
      if (!g.length) return resp({ text: 'Fin.' }, cuerpo);
      return resp(g.shift(), cuerpo);
    },
    registrarUso_: (u) => usos.push(u),
    /* El turno de alrededor: nada de hojas ni de IA fuera de lo que se prueba. */
    recetaIntentar_: () => null, recetaAprender_: () => {}, instAgente_: () => null, weeboBloque_: () => '', adaptBloque_: () => '', encValores_: () => [],
    audienciaDe_: () => ({ tipo: 'principal' }), encargosTexto_: () => '', encargosPedidosTexto_: () => '', CALLE_REGLA_: 'calle',
    chatClasificarRegla_: () => '', microBloque_: () => '', cerebroHerramientas_: () => [],
    epiSnap_: () => ({ tareas: [], props: [], vendors: [], schedules: [] }), pendEncolar_: () => {},
    microSacarEtiqueta_: (t) => ({ texto: t, micro: '' }), claudeNivelSacarEtiqueta_: (t) => ({ texto: t, nivel: '' }), chatSacarEtiqueta_: (t) => ({ texto: t, esfera: 'Trabajo', subcategoria: '' }),
    vozSeguirGuardar_: () => 'seg-1', imgBloque_: () => null
  };
  vm.createContext(ctx);
  ['promptjson.js', 'recetas.js', 'escalar.js', 'agente.js', 'rapido.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
  /* Después de cargar: estas viven en los archivos cargados y aquí van de mentira. */
  Object.assign(ctx, { recetaIntentar_: () => null, recetaAprender_: () => {}, secretariaPrompt_: () => '═══ ALMA ═══\nEres Alma, del equipo de Spacio AM.' });
  /* agEjecutar_ de mentira: lee sin tocar nada y cuenta lo que corre. Una de escribir deja una «hecha» (no debe correr en el rápido). */
  ctx.agEjecutar_ = (adm, nombre, inp, c) => {
    corridas.push(nombre);
    if (nombre === 'codigo_acceso') c.hechas.push({ tipo: 'consulta', resumen: 'Código · 1102' });
    if (ESCRIBEN.indexOf(nombre) >= 0) { c.hechas.push({ tipo: 'envio', resumen: 'escribió' }); return { ok: true }; }
    return { ok: true, reservas: [{ codigo: 'HM1', huesped: 'Mariana López', entrada: '2026-11-12' }] };
  };
  const turno = (pedido, x) => {
    x = x || {};
    ctx.AGENTE_RAPIDO_ = x.voz !== false; ctx.AGENTE_PERMITIDAS_ = x.permitidas || null;
    ctx.AGENTE_PLAZO_ = x.plazo || 0; ctx.AG_MS_ = { antes: 0, ia: 0, n: 0, herr: 0, nh: 0, agente: 0, despues: 0 }; const ms = ctx.AG_MS_;
    let r; try { r = ctx.opAgente_({ email: 'juan@x.com', nombre: 'Juan', principal: true }, pedido, x.canal || 'llamada', x.fotos || [], []); }
    finally { ctx.AGENTE_RAPIDO_ = false; ctx.AG_USO_FUNCION_ = ''; ctx.AGENTE_PLAZO_ = 0; ctx.AG_MS_ = null; }
    return { r, ms };
  };
  return { X: ctx, pedidos, usos, corridas, turno, jevs, logs, cache, props, de: (m) => pedidos.filter((p) => p.model === m) };
}
const nombres = (p) => p.tools.map((t) => t.name || t.type);
const LEER = 'Verificar si Mariana López ya llegó';

/* 1 · leer → rápido */
{ const c = caja({ rapido: [{ thinking: 1, tools: [{ name: 'buscar_reservas', input: { texto: 'Mariana López' } }] }, { thinking: 1, text: 'Sí, Mariana López llega hoy y ya tiene su registro completo.' }] });
  const { r, ms } = c.turno(LEER);
  const rp = c.de(RAPIDO);
  ok(rp.length === 2 && c.de(SONNET).length === 0, '1 · un pedido de leer lo contesta el modelo rápido (2 vueltas) y el de siempre no se llama');
  ok(r.respuesta === 'Sí, Mariana López llega hoy y ya tiene su registro completo.', '1 · la respuesta del rápido es la del turno');
  const permitidas = c.X.VOZ_RAPIDO_HERR_.concat(['pasar_al_completo']);
  ok(rp.every((p) => nombres(p).every((n) => permitidas.indexOf(n) >= 0)) && nombres(rp[0]).indexOf('enviar_a_huesped') < 0 && nombres(rp[0]).indexOf('web_search') < 0,
    '1 · el rápido recibe solo herramientas de leer y pasar_al_completo: ' + nombres(rp[0]).join(', '));
  ok(rp.every((p) => !('temperature' in p) && p.output_config && p.output_config.effort === 'low'), '1 · el rápido va sin temperatura (le da 400) y con esfuerzo bajo');
  ok(rp[1].messages.some((m) => m.role === 'assistant' && Array.isArray(m.content) && m.content[0].type === 'thinking'), '1 · los bloques de pensamiento vuelven tal cual en la vuelta siguiente');
  /* El mismo pedido con el interruptor apagado: lo que recibe el de siempre. */
  const c0 = caja({ props: { VOZ_RAPIDO: '0' } }); c0.turno(LEER); const s0 = c0.de(SONNET)[0].system;
  const t1 = JSON.parse(rp[0].system[1].text).este_turno, t0 = JSON.parse(s0[1].text).este_turno;
  ok(rp[0].system.length === 2 && rp[0].system[0].text === s0[0].text && t1 && t1.camino_rapido && !t0.camino_rapido && JSON.stringify(Object.assign({}, t1, { camino_rapido: undefined })) === JSON.stringify(t0),
    '1 · el rápido recibe el mismo system de Alma (lo fijo igual, en JSON) y solo una línea más en este_turno: camino_rapido');
  ok(c.corridas.join() === 'buscar_reservas', '1 · corrió solo la lectura que pidió');
  ok(ms.via === 'rapido' && ms.modelo === RAPIDO && ms.rapido >= 0 && ms.n === 2 && ms.nh === 1, '1 · el cronómetro dice que contestó el rápido: ' + JSON.stringify({ via: ms.via, modelo: ms.modelo, n: ms.n, nh: ms.nh }));
  ok(c.usos.length === 2 && c.usos.every((u) => u.modelo === RAPIDO && u.funcion === 'Voz · camino rápido'), '1 · IA_USO registra el modelo rápido como «Voz · camino rápido»');
}

/* 2 · escribir → el de siempre */
['Escríbele a Mariana López que su código ya está en el chat', 'Programa un mensaje a Recepción Brunelo para mañana a las 8', 'Cancela el recordatorio de reseña de la reserva HM1',
  'Avísale a Lucky cuando aterrice', 'Dile a Sucely que mañana entra a las 9', 'Crea una tarea para revisar el aire del 1102'].forEach((pedido) => {
  const c = caja(); const { r, ms } = c.turno(pedido);
  const s = c.de(SONNET);
  ok(c.de(RAPIDO).length === 0 && s.length === 1 && r.respuesta === 'Respuesta del de siempre.', '2 · «' + pedido + '» va directo al de siempre (' + ms.motivo + ')');
  ok(s[0].temperature === 0.2 && !s[0].output_config && nombres(s[0]).indexOf('enviar_a_huesped') >= 0 && nombres(s[0]).indexOf('pasar_al_completo') < 0, '2 · el de siempre va como hoy: todas sus herramientas y su temperatura');
  ok(ms.via === 'completo' && ms.modelo === SONNET && c.usos.every((u) => u.funcion === 'Chat operativo'), '2 · el cronómetro dice «completo» y IA_USO sigue como «Chat operativo»');
});

/* 3 · el rápido no puede → el de siempre, limpio */
[
  ['falla la API', [{ http: 529 }], /falló la API/],
  ['pide pasar_al_completo', [{ tools: [{ name: 'pasar_al_completo', input: { motivo: 'hay que escribirle' } }] }], /pidió el completo/],
  ['pide una herramienta que no tiene', [{ tools: [{ name: 'buscar_reservas' }, { name: 'enviar_a_huesped', input: { texto: 'hola' } }] }], /pidió enviar_a_huesped/],
  ['dice que no sabe', [{ text: 'No lo sé, no estoy segura de eso.' }], /no sabe/],
  ['dice que no puede', [{ text: 'No tengo forma de revisar eso desde aquí.' }], /no pudo/],
  ['dice que lo hizo', [{ text: 'Listo, ya le envié el mensaje a Mariana.' }], /dijo que lo hizo/],
  ['dice que ya lo mandó', [{ text: 'Ya le mandé el código a Mariana.' }], /dijo que lo hizo/],
  ['se niega', [{ text: '', stop: 'refusal' }], /se negó/],
  ['se queda sin tokens', [{ thinking: 1, text: 'Mariana', stop: 'max_tokens' }], /sin tokens/],
  ['da vueltas', [{ tools: [{ name: 'buscar_reservas' }] }, { tools: [{ name: 'ver_conversacion' }] }, { tools: [{ name: 'codigo_acceso' }] }], /muchas vueltas/]
].forEach(([caso, rapido, re]) => {
  const c = caja({ rapido });
  const { r, ms } = c.turno(LEER);
  const s = c.de(SONNET);
  ok(s.length === 1 && r.respuesta === 'Respuesta del de siempre.' && ms.via === 'rapido>completo' && re.test(ms.motivo) && ms.modelo === SONNET, '3 · ' + caso + ': pasa al de siempre (' + ms.motivo + ')');
  ok(s.length === 1 && s[0].messages.length === 1 && s[0].messages[0].content.some((b) => b.text === LEER) && !/CAMINO RÁPIDO/.test(s[0].system.map((b) => b.text).join('')),
    '3 · ' + caso + ': el de siempre empieza desde el mismo pedido, sin lo del rápido');
  ok(c.corridas.every((n) => ESCRIBEN.indexOf(n) < 0) && r.hechas.length === 0, '3 · ' + caso + ': nada de escribir corrió y lo que el rápido leyó no queda como hecho');
  ok(c.usos.filter((u) => u.modelo === SONNET).every((u) => u.funcion === 'Voz · completo tras el rápido'), '3 · ' + caso + ': IA_USO lo marca como «Voz · completo tras el rápido»');
});

/* 4 · interruptor y fuera de la voz */
{ const c = caja({ props: { VOZ_RAPIDO: '0' }, rapido: [{ text: 'no debería' }] }); const { ms } = c.turno(LEER);
  ok(c.de(RAPIDO).length === 0 && c.de(SONNET).length === 1 && ms.via === 'completo' && /apagado/.test(ms.motivo), '4 · VOZ_RAPIDO = 0: todo va por el de siempre (' + ms.motivo + ')'); }
{ const c = caja({ props: { VOZ_RAPIDO_MODELO: 'claude-haiku-9' }, rapido: [] }); c.X.uf_ = ((uf) => (u, op) => { const b = JSON.parse(op.payload); if (b.model === 'claude-haiku-9') b.model = RAPIDO; return uf(u, Object.assign({}, op, { payload: JSON.stringify(b) })); })(c.X.uf_);
  c.turno(LEER); ok(c.usos[0] && c.usos[0].modelo === 'claude-haiku-9', '4 · VOZ_RAPIDO_MODELO cambia el modelo rápido sin un PR'); }
[['el Hub', { voz: false, canal: 'hub' }], ['WhatsApp', { voz: false, canal: 'whatsapp' }], ['la familia', { permitidas: ['proyectos_personales'] }], ['una llamada con fotos', { fotos: ['https://x/f.jpg'] }]].forEach(([q, x]) => {
  const c = caja({ rapido: [{ text: 'no debería' }] }); c.turno(LEER, x);
  ok(c.de(RAPIDO).length === 0 && c.de(SONNET).length === 1, '4 · ' + q + ': nada cambia, va por el de siempre');
});

/* 5 · el plazo */
{ const c = caja({ rapido: [{ http: 500 }] }); const { r, ms } = c.turno(LEER, { plazo: Date.now() + 1000 });
  ok(r.seguira === true && c.de(SONNET).length === 0 && ms.via === 'rapido>completo', '5 · si el rápido gastó el plazo, el de siempre no empieza otra vuelta: sigue en segundo plano'); }

/* 6 · fijo */
{ const c = caja(); const X = c.X; X.AGENTE_APP_ = true;
  const todas = X.agHerramientas_().map((t) => t.name).filter(Boolean);
  ok(X.VOZ_RAPIDO_HERR_.every((n) => todas.indexOf(n) >= 0), '6 · cada herramienta del rápido existe en agHerramientas_');
  ok(X.VOZ_RAPIDO_HERR_.every((n) => ESCRIBEN.indexOf(n) < 0), '6 · ninguna herramienta del rápido escribe, manda, une ni cambia algo');
  /* Lo que decide va en un solo lugar (rapido.js), para que T5 lo cambie. */
  const otros = fs.readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'rapido.js').filter((f) => /VOZ_RAPIDO_HERR_|VOZ_RAPIDO_HACER|function rapidoDecide_/.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
  ok(!otros.length, '6 · la decisión (rapidoDecide_ y sus listas) vive solo en rapido.js' + (otros.length ? ': también en ' + otros.join(', ') : ''));
  const voz = fs.readFileSync(path.join(DIR, 'voz.js'), 'utf8'), sec = voz.slice(voz.indexOf('function vozSecretaria_('), voz.indexOf('function vozFamilia_('));
  ok(/AGENTE_RAPIDO_ = true;[^\n]*\n\s*try \{ r = opAgente_\(adm, pedido, 'llamada'/.test(sec) && /finally \{[^}]*AGENTE_RAPIDO_ = false;[^}]*AG_USO_FUNCION_ = ''/.test(sec), '6 · vozSecretaria_ lo enciende solo para su turno y lo apaga en el finally');
  const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), m = cod.match(/function precioIA_\(modelo\) \{[\s\S]*?\n\}/);
  const precio = m && vm.runInContext('(' + m[0] + ')', vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }, JSON, String, Object }));
  ok(precio && JSON.stringify(precio(RAPIDO)) === '[0.1,0.5]' && JSON.stringify(precio('claude-haiku-4-5-20251001')) === '[1,5]' && JSON.stringify(precio(SONNET)) === '[3,15]', '6 · precioIA_: el modelo rápido a 0.10 / 0.50 USD por millón; los demás igual');
  /* Lo que decide, con ejemplos de las llamadas de Juan. */
  X.AGENTE_RAPIDO_ = true;
  ['¿Quién llega hoy?', 'Verificar si Jorge Beteta ya llegó', '¿Qué tareas tengo abiertas?', '¿Hubo cancelaciones ayer?', 'Revisar los mensajes programados de la reserva HM1',
    '¿Qué tengo en la agenda mañana?', '¿Qué dijo el último mensaje de Mariana?', '¿Cuál es el código del 1102?', 'Revisa si hay pendientes de los agentes'].forEach((p) => {
    const d = X.rapidoDecide_(p, {}); ok(d.usar, '6 · leer → rápido: «' + p + '»');
  });
  ['Mándale el código a Mariana', 'Programar un mensaje para el viernes', 'Une el cambio', 'Llama a Recepción Brunelo', 'Pon música', 'Guarda una nota: el 1102 no tiene plancha',
    'Revisa la reserva de Mariana y escríbele que llegue a las 3', 'Hola', 'Cuando diga «ruta», dime la ruta de Sucely'].forEach((p) => {
    const d = X.rapidoDecide_(p, { nombrada: /^cuando diga/i.test(p) }); ok(!d.usar, '6 · no es de leer → el de siempre: «' + p + '» (' + d.motivo + ')');
  });
}

/* 7 · el portero Jev */
const LLAVE = 'jev-llave-de-prueba-0123456789abcdef';
const conJev = (jev, extra) => caja(Object.assign({ props: { JEV_KEY: LLAVE }, jev, rapido: [{ text: 'Sí, Mariana López llega hoy.' }] }, extra || {}));
const sinLlave = (c, r, ms) => { const todo = JSON.stringify([r, ms, c.usos, c.logs, c.cache, c.pedidos]); return todo.indexOf(LLAVE) < 0; };
{ const c = conJev([{ choice: 'leer', confianza: 0.93 }]); const { r, ms } = c.turno('Las llegadas de mañana en el 1102');
  ok(c.jevs.length === 1 && c.de(RAPIDO).length === 1 && c.de(SONNET).length === 0, '7 · Jev dice leer con 93 %: va al rápido aunque las reglas no vean una pregunta (' + ms.motivo + ')');
  ok(ms.via === 'rapido' && ms.portero === 'jev' && ms.jev_conf === 0.93 && ms.jev_ms >= 0, '7 · el cronómetro dice que decidió Jev, su confianza y sus ms: ' + JSON.stringify({ portero: ms.portero, jev_conf: ms.jev_conf, jev_ms: ms.jev_ms }));
  const j = c.jevs[0], q = j.cuerpo.questions.camino;
  ok(j.url === 'https://api.typesafe.ai/v1/systemone' && j.op.method === 'post' && j.op.muteHttpExceptions === true && j.op.headers.Authorization === 'Bearer ' + LLAVE && j.cuerpo.model === 'jev-1.13.0',
    '7 · llama a /v1/systemone con la llave en Authorization y el modelo jev-1.13.0');
  ok(q.type === 'choice' && Object.keys(q.criteria).join() === 'leer,hacer,otro' && JSON.stringify(Object.keys(j.cuerpo.state)) === '["pedido"]' && j.cuerpo.state.pedido === 'Las llegadas de mañana en el 1102',
    '7 · una sola pregunta «camino» (leer · hacer · otro) y en state solo el pedido');
  const u = c.usos.filter((x) => x.funcion === 'Voz · portero Jev');
  ok(u.length === 1 && u[0].modelo === 'jev-1.13.0' && u[0].usage.input_tokens === 180 && u[0].ok === true && /estimado/.test(u[0].detalle), '7 · IA_USO: una fila «Voz · portero Jev» con el modelo, sus tokens y el precio marcado como estimado');
  ok(sinLlave(c, r, ms), '7 · la llave no aparece en la respuesta, el cronómetro, IA_USO, los registros ni la caché'); }
[['leer con confianza baja', [{ choice: 'leer', confianza: 0.6 }], /menos de 80/], ['hacer', [{ choice: 'hacer', confianza: 0.97 }], /Jev: hacer/], ['otro', [{ choice: 'otro', confianza: 0.9 }], /Jev: otro/]].forEach(([caso, jev, re]) => {
  const c = conJev(jev); const { ms } = c.turno('¿Quién llega hoy?');
  ok(c.jevs.length === 1 && c.de(RAPIDO).length === 0 && c.de(SONNET).length === 1 && ms.via === 'completo' && ms.portero === 'jev' && re.test(ms.motivo), '7 · Jev dice ' + caso + ': va al de siempre aunque las reglas digan leer (' + ms.motivo + ')');
});
{ const c = conJev([{ choice: 'leer', confianza: 0.99 }]); const { ms } = c.turno('Revisa la reserva de Mariana y escríbele que llegue a las 3');
  ok(c.de(RAPIDO).length === 0 && c.de(SONNET).length === 1 && ms.portero === 'reglas' && /pide hacer algo/.test(ms.motivo) && c.jevs.length === 0, '7 · un verbo de hacer gana aunque Jev diga leer (ni se le pregunta: ' + ms.motivo + ')'); }
[['sin JEV_KEY', { props: {} }], ['VOZ_JEV = 0', { props: { JEV_KEY: LLAVE, VOZ_JEV: '0' } }]].forEach(([caso, extra]) => {
  const c = conJev([{ choice: 'hacer', confianza: 0.99 }], extra); const { ms } = c.turno(LEER);
  ok(c.jevs.length === 0 && c.de(RAPIDO).length === 1 && ms.via === 'rapido' && ms.portero === 'reglas' && ms.motivo === 'leer', '7 · ' + caso + ': deciden las reglas de antes y Jev no se llama (' + (ms.jev_error || '') + ')');
});
[['error HTTP 401', { http: 401 }, /HTTP 401/], ['saturado (529)', { http: 529 }, /HTTP 529/], ['no responde', { lanza: 1 }, /no respondió/], ['JSON raro', { raro: 'json' }, /respuesta rara/], ['sin la respuesta «camino»', { raro: 1 }, /respuesta rara/],
  ['tarda 2 s', { choice: 'leer', confianza: 0.99, tarda: 2000 }, /tardó/]].forEach(([caso, jev, re]) => {
  const c = conJev([jev]); const { r, ms } = c.turno(LEER);
  ok(c.jevs.length === 1 && c.de(RAPIDO).length === 1 && ms.via === 'rapido' && ms.portero === 'reglas' && ms.motivo === 'leer' && re.test(ms.jev_error), '7 · Jev ' + caso + ': deciden las reglas de antes (' + ms.jev_error + ')');
  const c2 = conJev([jev]); const t2 = c2.turno('Hola, buenos días');
  ok(c2.de(SONNET).length === 1 && t2.ms.portero === 'reglas' && /no es una pregunta/.test(t2.ms.motivo), '7 · Jev ' + caso + ': y lo que las reglas no ven de leer sigue al de siempre');
  ok(c.usos.filter((u) => u.funcion === 'Voz · portero Jev').every((u) => u.ok === false) && sinLlave(c, r, ms), '7 · Jev ' + caso + ': IA_USO lo marca fallido y la llave no sale en ningún lado');
});
{ const c = conJev([{ choice: 'leer', confianza: 0.95, tarda: 1600 }, { choice: 'hacer', confianza: 0.99 }]); c.turno(LEER); const { ms } = c.turno(LEER);
  ok(c.jevs.length === 1 && ms.portero === 'reglas' && ms.jev_error === 'en pausa' && c.cache.jev_pausa === '1', '7 · si Jev tardó de más, se apaga solo 10 min y la llamada siguiente no lo espera'); }
{ const c = conJev([{ http: 500 }, { http: 500 }, { choice: 'leer', confianza: 0.95 }, { http: 500 }, { http: 500 }, { http: 500 }, { choice: 'hacer', confianza: 0.99 }]);
  const malos = () => c.jevs.length;
  c.turno(LEER); c.turno(LEER); const t3 = c.turno(LEER);   // dos fallos y uno bueno: vuelve a contar desde cero
  ok(malos() === 3 && t3.ms.portero === 'jev' && !c.cache.jev_pausa && !c.cache.jev_fallos, '7 · un acierto de Jev borra los fallos seguidos');
  c.turno(LEER); c.turno(LEER); c.turno(LEER); const t7 = c.turno(LEER);
  ok(malos() === 6 && t7.ms.portero === 'reglas' && t7.ms.jev_error === 'en pausa' && c.cache.jev_pausa === '1', '7 · tres fallos seguidos lo apagan 10 min: el cuarto pedido ni lo llama');
  ok(c.X.JEV_PAUSA_S_ === 600 && c.X.JEV_FALLOS_MAX_ === 3 && c.X.JEV_MS_MAX_ === 1500 && c.X.JEV_UMBRAL_ === 0.8, '7 · las cifras: umbral 0,8 · 1500 ms · 3 fallos · 10 min'); }
{ const c = conJev([{ choice: 'leer', confianza: 0.9 }], { props: { JEV_KEY: LLAVE, JEV_MODELO: 'jev-latest' } }); c.turno('¿Quién llega al 1102? Su número es +00 1234 5678, correo nombre@dominio.test');
  const st = c.jevs[0].cuerpo.state.pedido;
  ok(c.jevs[0].cuerpo.model === 'jev-latest', '7 · JEV_MODELO cambia el modelo de Jev sin un PR');
  ok(!/1234|5678|@|dominio/.test(st) && /\[teléfono\]/.test(st) && /\[correo\]/.test(st) && /1102/.test(st), '7 · a Jev no le llegan teléfonos ni correos (y sí el número del apartamento): «' + st + '»');
  ok(c.X.jevLimpiar_('x'.repeat(2000)).length === 600, '7 · el pedido que va a Jev se corta a 600 letras'); }
{ const c = caja({ props: { JEV_KEY: LLAVE }, jev: [{ choice: 'leer', confianza: 0.99 }] }); const { ms } = c.turno(LEER, { voz: false, canal: 'hub' });
  ok(c.jevs.length === 0 && !ms.portero, '7 · fuera de la secretaria por voz Jev no se llama'); }
{ const cod = fs.readFileSync(path.join(DIR, 'Código.js'), 'utf8'), m = cod.match(/function precioIA_\(modelo\) \{[\s\S]*?\n\}/);
  const precio = vm.runInContext('(' + m[0] + ')', vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }, JSON, String, Object }));
  ok(JSON.stringify(precio('jev-1.13.0')) === '[0.042,0]' && JSON.stringify(precio('jev-latest')) === '[0.042,0]', '7 · precioIA_: Jev a 0.042 USD por millón de entrada (estimado) y la salida sin costo');
  const src = fs.readFileSync(path.join(DIR, 'rapido.js'), 'utf8');
  ok(!/console\.[a-z]+\([^)]*\bkey\b/.test(src) && /split\(key\)\.join\('\*\*\*'\)/.test(src), '7 · rapido.js nunca registra la llave (y la tapa si un error la trae)'); }

process.exit(fallo);
