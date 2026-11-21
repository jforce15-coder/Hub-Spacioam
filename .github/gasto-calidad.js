/* Gasto de Alma y su equipo de ahorro (apps-script/gasto.js), con dobles: sin hoja real, sin ElevenLabs, sin GitHub.
   Juan, 17-nov-2026: «esos proyectos tienen que ir súper revisados para que no solo reduzcamos el consumo sino que
   mantengamos la misma calidad. Si deterioramos la calidad, no es un buen proyecto.»
   1. COMPUERTA: un PR de ahorro (título «Ahorro ·», rama claude/ahorro-… o «Microproyecto de reducción» en el cuerpo) no
      pasa sin «## Compuerta de calidad» con «Antes:», «Después:», «Ahorro medido: N %» y «Veredicto: igual|mejor».
      «Veredicto: peor» es rojo siempre. Lee TITULO, RAMA y CUERPO del PR (en local, sin PR, solo corren los dobles).
   2. El repo es público: gasto.js no trae montos (la tabla de planes vive en la propiedad GASTO_PLANES).
   3. El reporte: lo fijo cuenta entero, lo de una vez en su mes, lo anual entre 12, «falta dato» se marca y no suma,
      los tokens salen de IA_USO del mes, y el gasto de Alma (agente) y el de Spacio AM (empresa) nunca se mezclan:
      Hospitable es empresa, con su propio total; un recibo en euros sin usd se ve con «falta USD» y no suma.
   4. Solo el administrador principal ve el gasto y cambia la tabla.
   5. Pareto: abre como mucho 2 por semana, solo de lo que suma el 80 % y nunca dos veces el mismo lugar; el pedido a
      Claude va en JSON, sin montos, con la compuerta de calidad en sus pasos.
   6. Se aplica solo (Juan, 21-nov-2026): el proyecto que pasa la compuerta y tiene las revisiones en verde se une solo
      (squash con el sha de la cabeza); el que sale peor o no ahorra se cierra; lo que toca la voz o ElevenLabs espera a
      Juan; con revisiones corriendo o en rojo, espera. Gasto de Alma ve qué se aplicó, cuánto ahorra y la calidad.
   node .github/gasto-calidad.js [carpeta apps-script] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', 'apps-script');
let fallo = 0; const ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('::error::' + m); fallo = 1; } };
const src = fs.readFileSync(path.join(DIR, 'gasto.js'), 'utf8');

/* 2 · sin montos en el código */
const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok(!/(US?\$|\$\s?\d|\d+\s?(usd|dólares|€|eur)\b)/i.test(sinComentarios), '2 · gasto.js no trae montos (van en la propiedad GASTO_PLANES)');

/* La caja de dobles */
function caja(o) {
  o = o || {};
  const props = Object.assign({}, o.props || {}), cache = {}, hojas = {}, pedidos = [];
  const ahora = Date.parse(o.ahora || '2026-11-17T18:00:00Z');
  const D = class extends Date { constructor(...a) { super(...(a.length ? a : [ahora])); } static now() { return ahora; } };
  const hoja = (nombre, filas) => { const h = { nombre, filas: filas || [], getLastRow() { return this.filas.length; }, appendRow(r) { this.filas.push(r); },
    getRange(f, c, nf, nc) { const self = this; return { getValues() { return self.filas.slice(f - 1, f - 1 + nf).map(r => { const x = r.slice(c - 1, c - 1 + nc); while (x.length < nc) x.push(''); return x; }); },
      setValues(v) { v.forEach((r, i) => { const fila = self.filas[f - 1 + i] = self.filas[f - 1 + i] || []; r.forEach((x, j) => { fila[c - 1 + j] = x; }); }); } }; } }; hojas[nombre] = h; return h; };
  const fmt = (d, tz, f) => { const t = new Date(new Date(d).getTime() - 6 * 3600000).toISOString();
    return f === 'yyyy-MM' ? t.slice(0, 7) : f === 'yyyy-MM-dd' ? t.slice(0, 10) : f === 'dd' ? t.slice(8, 10) : f === 'u' ? String(((new Date(t).getUTCDay() + 6) % 7) + 1) : f === 'H' ? String(+t.slice(11, 13)) : t; };
  const USO = [['ts', 'app', 'funcion', 'detalle', 'ref', 'modelo', 'input', 'output', 'cache_read', 'cache_write', 'usd', 'ms', 'ok']].concat(o.uso || []);
  hoja('IA_USO', USO);
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, String, Number, Object, Array, RegExp, isNaN, isFinite, Date: D,
    CFG: { TZ: 'America/Guatemala' }, USO_CAB_: USO[0],
    Utilities: { formatDate: fmt },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    ssAlma_: () => ({ getSheetByName: n => hojas[n] || null }),
    hojaCrear_: (n, cab) => hojas[n] || hoja(n, [cab]),
    cupoFuncion_() {}, uf_() { throw new Error('sin red en la prueba'); },
    rllModo_: c => c.src || 'llamada_app',
    cupoLeer_: () => ({}), cupoCalcular_: () => ({ nivel: 'verde', pctHoy: 10, usado: 100, limite: 20000 }),
    microFilas_: () => [], MICRO_ESTADOS_: { unido: 'unido', cerrado: 'cerrado' }, microLeer_: () => null, unirGh_: () => ({ j: {} }),
    paraClaudePrincipalSes_: s => (s === 'juan' ? { email: 'juan@x.com', principal: true } : null),
    esAdminPrincipal_: a => !!(a && a.principal), agPrincipal_: () => ({ email: 'juan@x.com', nombre: 'Juan', principal: true }),
    paraClaudeCrear_: (adm, inp) => { pedidos.push(inp); return { ok: true, issue: 'https://github.com/x/y/issues/' + pedidos.length, micro: { id: 'm' + pedidos.length } }; }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  if (o.el) ctx.gastoElevenLabs_ = () => o.el;
  return { ctx, props, hojas, pedidos };
}

/* 1 · la compuerta, con los dobles de cuerpos de PR */
{
  const { ctx } = caja();
  const bien = 'Resumen\n\n## Compuerta de calidad\n- Antes: 20 casos reales, 20 útiles\n- Después: 20 casos, 20 útiles\n- Veredicto: igual\n- Ahorro medido: 23 %\n\n## Peligros al unir\nNinguno';
  const v = ctx.gastoCompuerta_(bien);
  ok(v.hay && v.antes && v.despues && v.veredicto === 'igual' && v.ahorro === 23, '1 · la compuerta lee antes, después, veredicto y ahorro medido');
  ok(ctx.gastoCompuerta_(bien.replace('igual', 'peor')).veredicto === 'peor', '1 · «Veredicto: peor» se lee como peor');
  ok(!ctx.gastoCompuerta_('## Evidencia\nVeredicto: igual').hay, '1 · sin la sección «Compuerta de calidad» no hay compuerta (el veredicto suelto no cuenta)');
}
function compuertaPr(titulo, rama, cuerpo) {
  const esAhorro = /^\s*ahorro\b/i.test(titulo || '') || /^claude\/ahorro-/i.test(rama || '') || /microproyecto de reducci[oó]n/i.test(cuerpo || '');
  if (!esAhorro) return { esAhorro, ok: true };
  const { ctx } = caja(); const v = ctx.gastoCompuerta_(cuerpo || '');
  const faltan = [!v.hay && '«## Compuerta de calidad»', v.hay && !v.antes && '«Antes:»', v.hay && !v.despues && '«Después:»', v.hay && v.ahorro == null && '«Ahorro medido: N %»', v.hay && !v.veredicto && '«Veredicto: igual|mejor»'].filter(Boolean);
  return { esAhorro, ok: !faltan.length && v.veredicto !== 'peor', faltan, peor: v.veredicto === 'peor' };
}
ok(compuertaPr('Ahorro · Claude · Redactar', '', 'sin nada').ok === false, '1 · un PR de ahorro sin compuerta sale en rojo');
ok(compuertaPr('Ahorro · X', '', '## Compuerta de calidad\nAntes: a\nDespués: b\nVeredicto: peor\nAhorro medido: 40 %').ok === false, '1 · un PR de ahorro con veredicto «peor» sale en rojo aunque ahorre');
ok(compuertaPr('Ahorro · X', '', '## Compuerta de calidad\nAntes: a\nDespués: b\nVeredicto: mejor\nAhorro medido: 12 %').ok === true, '1 · un PR de ahorro con antes, después, «mejor» y su ahorro pasa');
ok(compuertaPr('Alma · Otra cosa', 'claude/otra', 'Resumen').ok === true, '1 · un PR que no es de ahorro no necesita compuerta');
/* El PR de verdad (en GitHub Actions) */
if (process.env.TITULO || process.env.CUERPO) {
  const r = compuertaPr(process.env.TITULO || '', process.env.RAMA || '', process.env.CUERPO || '');
  if (r.esAhorro) ok(r.ok, '1 · ESTE PR es de ahorro: ' + (r.peor ? 'el veredicto es «peor»: si baja la calidad, no se une (ciérralo como descartado)' : r.faltan.length ? 'le falta ' + r.faltan.join(', ') + ' en el cuerpo' : 'compuerta de calidad completa'));
  else console.log('· este PR no es de ahorro: no necesita compuerta');
}

/* 3 · el reporte del mes */
{
  const planes = [
    { id: 'el', prov: 'elevenlabs', nombre: 'Plan', tipo: 'mes', usd: 100, desde: '2026-10-30', fuente: 'recibo' },
    { id: 'elr', prov: 'elevenlabs', nombre: 'Recarga', tipo: 'una_vez', usd: 50, fecha: '2026-11-16', fuente: 'recibo' },
    { id: 'elv', prov: 'elevenlabs', nombre: 'Recarga vieja', tipo: 'una_vez', usd: 999, fecha: '2026-10-02', fuente: 'recibo' },
    { id: 'ap', prov: 'apple', nombre: 'Programa', tipo: 'año', usd: 120, fuente: 'estimado' },
    { id: 'cp', prov: 'claude_plan', nombre: 'Plan', tipo: 'mes', usd: null },
    { id: 'ho', prov: 'hospitable', nombre: 'Plan', tipo: 'mes', usd: 800, fuente: 'recibo' },
    { id: 'do', prov: 'dominio', nombre: 'Dominio', tipo: 'año', usd: 24, fuente: 'recibo' }
  ];
  const el = { ok: true, plan: { nivel: 'pro', creditos_usados: 1, creditos_limite: 2 }, conversaciones: 3, minutos: 60, creditos_mes: 1000, llm_pct: 52, cpm: [],
    agentes: [{ nombre: 'Alma', n: 2, minutos: 50, creditos: 900 }, { nombre: 'Claudio', n: 1, minutos: 10, creditos: 100 }],
    canales: [{ nombre: 'App de Alma', n: 3, minutos: 60, creditos: 1000 }], muestra: [] };
  const uso = [[new Date('2026-11-10T15:00:00Z'), 'ALMA', 'Redactar respuestas', '', '', 'm', 10, 5, 0, 0, 3, 0, 'sí'],
    [new Date('2026-11-12T15:00:00Z'), 'ALMA', 'Chat operativo', '', '', 'm', 10, 5, 0, 0, 1, 0, 'sí'],
    [new Date('2026-10-12T15:00:00Z'), 'ALMA', 'Chat operativo', '', '', 'm', 10, 5, 0, 0, 77, 0, 'sí']];
  const { ctx, hojas } = caja({ props: { GASTO_PLANES: JSON.stringify(planes) }, uso, el });
  const r = ctx.gastoReporte_();
  const P = id => r.proveedores.filter(p => p.id === id)[0];
  ok(r.mes === '2026-11' && P('elevenlabs').usd === 150, '3 · ElevenLabs del mes = plan + la recarga de noviembre (la de octubre no)');
  ok(P('anthropic').usd === 4 && P('anthropic').detalle.funciones[0].nombre === 'ALMA · Redactar respuestas', '3 · Claude · tokens sale de IA_USO del mes, por función');
  ok(r.empresa.proveedores.filter(p => p.id === 'apple')[0].usd === 10, '3 · lo anual cuenta entre 12');
  ok(r.empresa.proveedores.filter(p => p.id === 'claude_plan')[0].estado === 'falta' && r.empresa.faltan.indexOf('Plan de Claude') >= 0 && r.total.faltan.indexOf('Plan de Claude') < 0, '3 · un plan sin monto queda como «falta dato» (en su clase)');
  ok(P('anthropic') && !P('claude_plan'), '3 · los tokens de la llave de API cuentan en Alma; el plan de Claude no (es desarrollo)');
  ok(r.total.usd === 154 && !r.proveedores.some(p => p.clase !== 'alma') && r.empresa.proveedores[0].id === 'hospitable', '3 · el número grande es solo de Alma (agente); Hospitable va en la empresa');
  ok(r.empresa.usd === 812 && r.general.usd === 966 && r.proveedores.every(p => p.clase === 'alma') && r.empresa.proveedores.every(p => p.clase !== 'alma'), '3 · la empresa lleva su propio total y el total general (referencia) suma las dos');
  ok(ctx.GASTO_PROV_.every(P => ['alma', 'desarrollo', 'operacion'].indexOf(P.clase) >= 0) && ctx.gastoClase_('hospitable') === 'operacion' && ctx.gastoClase_('claude_plan') === 'desarrollo' && ctx.gastoClase_('anthropic') === 'alma', '3 · cada proveedor tiene su clase (alma, desarrollo u operación)');
  const parte = k => r.empresa.partes.filter(x => x.clase === k)[0];
  ok(parte('operacion').usd === 802 && parte('desarrollo').usd === 10 && parte('desarrollo').proveedores.some(p => p.id === 'claude_plan'), '3 · la empresa se parte en desarrollo (plan de Claude, Apple) y operación (Hospitable)');
  {
    const pe = [{ id: 'ho', prov: 'hospitable', nombre: 'Professional + precios dinámicos', tipo: 'mes', usd: '', moneda: 'EUR', monto: 804, fuente: 'recibo' }];
    const { ctx: ce } = caja({ props: { GASTO_PLANES: JSON.stringify(pe) }, uso, el });
    const re = ce.gastoReporte_(), H = re.empresa.proveedores.filter(p => p.id === 'hospitable')[0];
    ok(H.estado === 'falta_usd' && H.usd === 0 && H.sin_usd[0].monto === 804 && H.sin_usd[0].moneda === 'EUR' && re.empresa.sin_usd[0].monto === 804 && re.total.usd === 4,
      '3 · un recibo en euros sin usd se ve con su monto y «falta USD», y no toca el gasto de Alma');
    const pn = [{ id: 'ho', prov: 'hospitable', nombre: 'Plan', tipo: 'mes', usd: '', nota: 'recibo de 1.234,50 EUR' }];
    ok(caja({ props: { GASTO_PLANES: JSON.stringify(pn) } }).ctx.gastoPlanes_()[0].monto === 1234.5, '3 · si la moneda viene solo en la nota («N EUR»), se lee de ahí');
  }
  ok(r.proveedores[0].id === 'elevenlabs' && r.proveedores[0].pct > 90, '3 · los proveedores van de mayor a menor con su porcentaje');
  const ag = P('elevenlabs').detalle.agentes;
  ok(ag[0].nombre === 'Alma' && ag[0].usd === 135 && ag[1].usd === 15, '3 · ElevenLabs se reparte por agente según sus créditos');
  ok(r.total.proyeccion > r.total.usd, '3 · la proyección a fin de mes sube lo de uso al ritmo del mes');
  ok(hojas.GASTO_MES && hojas.GASTO_MES.filas.length === 2, '3 · el mes queda en la hoja privada GASTO_MES');
  /* 4 · solo el principal */
  ok(ctx.gastoApi_('otro', {}).ok === false && ctx.gastoApi_('juan', {}).ok === true, '4 · solo el administrador principal ve el gasto');
  ok(ctx.gastoPlanFijarApi_('otro', { prov: 'apple', usd: 1 }).ok === false, '4 · solo el administrador principal cambia la tabla');
  const f = ctx.gastoPlanFijarApi_('juan', { id: 'cp', prov: 'claude_plan', nombre: 'Plan', tipo: 'mes', usd: '20,5' });
  ok(f.ok && f.plan.usd === 20.5 && ctx.gastoPlanes_().filter(p => p.id === 'cp')[0].usd === 20.5, '4 · Juan escribe el monto que faltaba (acepta coma decimal)');
  ok(ctx.gastoPlanFijar_({ prov: 'nadie', usd: 1 }).ok === false && ctx.gastoPlanFijar_({ prov: 'apple', usd: 'abc' }).ok === false, '4 · proveedor desconocido o monto raro: no se guarda');
  const al = ctx.gastoParaAlma_({ principal: true });
  ok(al.ok && al.gastado_hasta_hoy_usd > 0 && al.lo_que_mas_pesa.length === 3 && /Gasto de Alma/.test(al.nota), '4 · gasto_alma: el número, la proyección y lo que más pesa, en simple');
  ok(ctx.gastoParaAlma_({ principal: false }).ok === false, '4 · gasto_alma solo con el principal');
  ok(al.gasto_de_empresa_aparte.some(x => x.que.indexOf('Hospitable') >= 0) && !al.lo_que_mas_pesa.some(x => x.nombre === 'Hospitable'), '4 · gasto_alma dice la empresa aparte, nunca como gasto de Alma');
}

/* 5 · Pareto */
{
  const uso = [];
  for (let i = 0; i < 8; i++) uso.push([new Date('2026-11-0' + (i + 1) + 'T15:00:00Z'), 'ALMA', 'F' + i, '', '', 'm', 1, 1, 0, 0, [50, 30, 10, 4, 3, 2, 1, 0.5][i], 0, 'sí']);
  const el = { ok: true, conversaciones: 0, minutos: 0, creditos_mes: 0, agentes: [], canales: [], muestra: [] };
  const lunes = '2026-11-16T16:00:00Z';   // lunes 10:00 en Guatemala
  const { ctx, pedidos, props } = caja({ uso, el, ahora: lunes });
  const L = ctx.gastoParetoLugares_();
  ok(L.top.length === 3 && L.top[0].lugar === 'Claude · ALMA · F0', '5 · el 80 % son los pocos lugares de arriba (aquí 3 de 8)');
  ok(!L.lugares.some(x => /hospitable|dominio|empresa|plan de claude|apple|higgsfield/i.test(x.lugar)), '5 · el equipo de ahorro solo trabaja sobre el gasto de Alma (nada de la empresa)');
  const seco = ctx.gastoPareto_(true);
  ok(seco.seco && pedidos.length === 0 && seco.abiertos.length === 2, '5 · en seco solo dice qué abriría');
  ctx.gastoParetoSiToca_();
  ok(pedidos.length === 2, '5 · el lunes abre los microproyectos (máximo 2)');
  const q = JSON.parse(pedidos[0].que_quiere);
  ok(['rol', 'tarea', 'contexto', 'pasos', 'restricciones', 'formato_de_respuesta'].every(k => k in q), '5 · el pedido a Claude va en JSON (rol, tarea, contexto, pasos, restricciones, formato_de_respuesta)');
  ok(/Compuerta de calidad/.test(q.pasos.join(' ')) && /calidad/.test(q.restricciones[0]) && q.contexto.como_se_mide_la_calidad, '5 · el pedido lleva la compuerta de calidad y cómo se mide');
  ok(!/(US?\$|\d\s?(usd|dólares)\b)/i.test(pedidos[0].que_quiere + pedidos[0].titulo + pedidos[0].resumen) && !('usd' in q.contexto), '5 · el pedido (va al issue público) no trae montos, solo porcentajes');
  ok(/^Ahorro · /.test(pedidos[0].titulo) && pedidos[0].sinChat, '5 · el título empieza con «Ahorro ·» (así lo reconoce la compuerta)');
  props.GASTO_PARETO_DIA = '';
  ctx.gastoParetoSiToca_();
  ok(pedidos.length === 3 && pedidos[2].titulo === 'Ahorro · Claude · ALMA · F2', '5 · la semana siguiente abre el que faltaba y nunca otra vez los que siguen abiertos');
  ok(ctx.gastoAhorroLista_().length === 3 && ctx.gastoAhorroLista_()[0].calidad === 'pendiente', '5 · la pantalla ve cada proyecto con su calidad «pendiente» hasta que se mida');
  const { ctx: c2, pedidos: p2 } = caja({ uso, el, ahora: lunes, props: { GASTO_PARETO: '0' } });
  c2.gastoParetoSiToca_();
  ok(p2.length === 0, '5 · GASTO_PARETO = 0 lo apaga');
}
/* 6 · Se aplica solo lo que pasa la compuerta (Juan, 21-nov-2026) */
{
  const { ctx, hojas } = caja({ ahora: '2026-11-21T18:00:00Z' });
  const CAB = ctx.GASTO_AHORRO_CAB_, sh = ctx.hojaCrear_('GASTO_AHORRO', CAB);
  const fila = (id, tipo, lugar) => { const r = CAB.map(() => ''); r[0] = id; r[2] = lugar; r[3] = tipo; r[4] = 30; r[5] = 40; r[9] = 'm' + id; r[12] = 'en trabajo'; r[14] = 'pendiente'; return r; };
  const comp = (ver, ah) => '## Resumen\nx\n\n## Compuerta de calidad\nAntes: 20 casos\nDespués: 20 casos\nVeredicto: ' + ver + '\nAhorro medido: ' + ah + ' %\n\n## Cómo probarlo\ny';
  const PR = {
    1: { body: comp('igual', 30), files: ['apps-script/gasto.js'], ck: { total: 5, ok: 5, corriendo: 0, fallas: 0 } },
    2: { body: comp('peor', 40), files: ['apps-script/agente.js'], ck: { total: 5, ok: 5, corriendo: 0, fallas: 0 } },
    3: { body: comp('mejor', 20), files: ['apps-script/voz.js'], ck: { total: 5, ok: 5, corriendo: 0, fallas: 0 } },
    4: { body: comp('igual', 15), files: ['apps-script/rapido.js'], ck: { total: 5, ok: 5, corriendo: 0, fallas: 0 } },
    5: { body: comp('igual', 10), files: ['apps-script/rapido.js'], ck: { total: 5, ok: 4, corriendo: 0, fallas: 1 } },
    6: { body: '## Resumen\nsin compuerta todavía', files: ['apps-script/rapido.js'], ck: { total: 5, ok: 5, corriendo: 0, fallas: 0 } },
    7: { body: comp('igual', 0), files: ['apps-script/rapido.js'], ck: { total: 5, ok: 5, corriendo: 0, fallas: 0 } }
  };
  [['a1', 'claude', 'Claude · F1'], ['a2', 'claude', 'Claude · F2'], ['a3', 'claude', 'Claude · F3'], ['a4', 'elevenlabs', 'ElevenLabs · App'], ['a5', 'claude', 'Claude · F5'], ['a6', 'claude', 'Claude · F6'], ['a7', 'claude', 'Claude · F7']]
    .forEach((x) => sh.appendRow(fila(...x)));
  ctx.microLeer_ = (id) => ({ pr: 'https://github.com/o/r/pull/' + id.replace(/\D/g, '') });
  const llamadas = [];
  ctx.unirGh_ = (metodo, ruta, cuerpo) => {
    llamadas.push({ metodo, ruta, cuerpo });
    const n = +((/\/(?:pulls|issues)\/(\d+)/.exec(ruta) || [])[1]);
    if (metodo === 'get' && /\/files/.test(ruta)) return { codigo: 200, j: PR[n].files.map((f) => ({ filename: f, patch: '+ algo' })) };
    if (metodo === 'get') return { codigo: 200, j: { number: n, title: 'Ahorro · F' + n, state: 'open', draft: false, mergeable: true, body: PR[n].body, head: { sha: 'sha' + n } } };
    if (metodo === 'put') return { codigo: 200, j: { merged: true } };
    return { codigo: 200, j: {} };
  };
  ctx.paraClaudeChecks_ = (repo, sha) => PR[+sha.replace('sha', '')].ck;
  /* El lunes (sin aplicar): solo lee, nunca une. */
  ctx.gastoAhorroSincronizar_();
  ok(!llamadas.some((x) => x.metodo === 'put' || x.metodo === 'patch'), '6 · la lectura de los lunes no une ni cierra nada');
  llamadas.length = 0;
  const r = ctx.gastoAhorroRevisar_();
  const unidos = llamadas.filter((x) => x.metodo === 'put'), cerrados = llamadas.filter((x) => x.metodo === 'patch');
  ok(unidos.length === 1 && /pulls\/1\/merge$/.test(unidos[0].ruta) && unidos[0].cuerpo.merge_method === 'squash' && unidos[0].cuerpo.sha === 'sha1', '6 · pasó la compuerta y revisiones en verde: se une solo, squash con el sha de la cabeza');
  ok(cerrados.length === 2 && cerrados.some((x) => /pulls\/2$/.test(x.ruta)) && cerrados.some((x) => /pulls\/7$/.test(x.ruta)), '6 · calidad peor o sin ahorro: se cierra (descartado)');
  ok(llamadas.some((x) => x.metodo === 'post' && /issues\/2\/comments/.test(x.ruta)), '6 · el PR descartado dice por qué');
  const L = {}; ctx.gastoAhorroLista_().forEach((x) => { L[x.id] = x; });
  ok(L.a1.estado === 'aplicado' && L.a1.decision === 'auto' && L.a1.aplicado && L.a1.calidad === 'igual' && L.a1.ahorro_medido_pct === 30, '6 · Gasto de Alma: qué se aplicó, cuándo y con qué calidad');
  ok(L.a1.ahorro_usd_mes === 12, '6 · cuánto ahorra al mes (estimado: 30 días × ahorro medido)');
  ok(L.a2.estado === 'descartado' && /peor/.test(L.a2.motivo), '6 · el peor queda descartado con su motivo');
  ok(L.a3.estado === 'espera a Juan' && /voz/.test(L.a3.motivo), '6 · toca la voz (voz.js): no se aplica solo, espera a Juan');
  ok(L.a4.estado === 'espera a Juan' && /ElevenLabs/.test(L.a4.motivo), '6 · un lugar de ElevenLabs: espera a Juan');
  ok(L.a5.estado === 'en revisión' && /rojo/.test(L.a5.motivo), '6 · revisiones en rojo: no se une, espera el arreglo');
  ok(L.a6.estado === 'en revisión' && /compuerta/.test(L.a6.motivo), '6 · sin compuerta completa: sigue en revisión');
  ok(L.a7.estado === 'descartado' && /no ahorra/.test(L.a7.motivo), '6 · ahorro medido 0 %: descartado');
  ok(r && r.hechos.length === 3, '6 · la vuelta de cada hora dice lo que hizo');
  llamadas.length = 0; ctx.gastoAhorroRevisar_();
  ok(!llamadas.some((x) => x.metodo === 'put' && /pulls\/1\//.test(x.ruta)), '6 · lo ya aplicado no se vuelve a tocar');
  /* La regla sola, sin red */
  const D = { state: 'open', mergeable: true, head: { sha: 's' } }, V = ctx.gastoCompuerta_(comp('igual', 12));
  ok(ctx.gastoAhorroDecidir_(D, V, { total: 3, ok: 1, corriendo: 2, fallas: 0 }, '').estado === 'en revisión', '6 · revisiones corriendo: espera');
  ok(ctx.gastoAhorroDecidir_(Object.assign({}, D, { mergeable: false }), V, { total: 3, ok: 3, corriendo: 0, fallas: 0 }, '').unir === false, '6 · choca con main: no se une');
  ok(ctx.gastoAhorroDecidir_(D, V, { total: 3, ok: 3, corriendo: 0, fallas: 0 }, 'no pude leer sus archivos').estado === 'espera a Juan', '6 · sin poder leer los archivos: espera a Juan');
  const { ctx: c3 } = caja({ props: { GASTO_AHORRO_AUTO: '0' } });
  const sh3 = c3.hojaCrear_('GASTO_AHORRO', c3.GASTO_AHORRO_CAB_); sh3.appendRow(fila('b1', 'claude', 'Claude · F1'));
  const ll3 = []; c3.microLeer_ = ctx.microLeer_; c3.paraClaudeChecks_ = ctx.paraClaudeChecks_;
  c3.unirGh_ = (m, ruta, cu) => { ll3.push(m); return ctx.unirGh_(m, ruta, cu); };
  c3.gastoAhorroRevisar_();
  ok(!ll3.includes('put') && !ll3.includes('patch'), '6 · GASTO_AHORRO_AUTO = 0: nada se une solo');
}
process.exit(fallo);
