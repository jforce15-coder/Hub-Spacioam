/* ═══ MEJORA DE LLAMADAS · REPORTE SEMANAL ═══════════════════════════════════════════════════════════════════════
   El subequipo «Mejora de llamadas» (agente mejora_llamadas, lunes 7 h) cuida que las llamadas con Alma sean buenas y
   eficientes: el balance entre ahorrar tokens y créditos y que la conversación salga bien. Cada lunes:
     1. Junta los números de la semana anterior (lunes a domingo, hora de Guatemala): ElevenLabs (todas las llamadas y una
        muestra leída turno por turno: silencios, relleno, herramientas, respuestas negativas) y la hoja (el chat con
        Alma, el modo conferencia). Los guarda en ALMA_REPORTES con los de la semana anterior para comparar.
     2. Propone mejoras con esos números. Las «invisibles» (Juan no nota nada: ahorro, arreglos) se las pasa a Claude en un
        solo pedido y llegan como PR a Pendientes. Las «visibles» (cambian lo que Juan oye o ve) esperan su sí en el reporte.
     3. Avisa: notificación «Tu reporte de llamadas está listo» que abre alma/reporte.html.
   Playbook: playbooks/mejora-llamadas.md. Spec: issue #274. */
var RLL_CAB_ = ['id', 'semana', 'desde', 'hasta', 'creado', 'datos', 'propuestas', 'estado'];
var RLL_URL_ = 'https://hub.spacioam.com/alma/reporte.html';
var RLL_MUESTRA_ = 30;   // llamadas leídas turno por turno (cada una es una consulta a ElevenLabs)
function hojaRll_() { return hojaCrear_('ALMA_REPORTES', RLL_CAB_); }
function rllReportes_() { return agFilas_(hojaRll_(), RLL_CAB_); }

/* La semana anterior completa: del lunes 00:00 al domingo 23:59 (hora de Guatemala). */
function rllSemana_(fin) {
  var hoy = new Date(Utilities.formatDate(fin || new Date(), CFG.TZ, "yyyy-MM-dd'T'00:00:00") + '-06:00');
  var dia = Number(Utilities.formatDate(hoy, CFG.TZ, 'u'));   // 1 lunes … 7 domingo
  var hasta = new Date(hoy.getTime() - (dia - 1) * 86400000), desde = new Date(hasta.getTime() - 7 * 86400000);
  return { desde: desde, hasta: hasta, id: 'rll-' + Utilities.formatDate(desde, CFG.TZ, 'yyyy-MM-dd'),
    semana: Utilities.formatDate(desde, CFG.TZ, 'd MMM') + ' – ' + Utilities.formatDate(new Date(hasta.getTime() - 1), CFG.TZ, 'd MMM yyyy') };
}

/* ── 1 · Los números ── */
function rllModo_(c, dv) {
  var q = String((dv || {}).quien_llama || ''), src = String(c.conversation_initiation_source || '');
  if (/MODO CONFERENCIA/.test(q)) return 'conferencia';
  if (src === 'sip_trunk' || src === 'twilio') return 'llamada_whatsapp';
  if (/MODO ANILLO|APP DE ALMA/.test(q) || src === 'unknown' || src === 'swift_sdk') return 'llamada_app';
  return 'llamada_hub';
}
function rllFin_(t) {
  t = String(t || '');
  if (/end_call/.test(t)) return 'Alma colgó al terminar';
  if (/1000/.test(t)) return 'Colgó la app o la persona';
  if (/1006/.test(t)) return 'Se cortó la conexión';
  if (/user message/i.test(t)) return 'Silencio largo de la persona';
  if (/uardrail/.test(t)) return 'Filtro de seguridad';
  if (/quota/i.test(t)) return 'Cuota agotada';
  return t ? 'Otro corte' : 'Sin dato';
}
var RLL_MALOS_ = ['Se cortó la conexión', 'Silencio largo de la persona', 'Filtro de seguridad', 'Cuota agotada', 'Otro corte'];
var RLL_RELLENO_ = /(sigues ah[ií]|est[aá]s ah[ií]|skip_turn|^\s*\.{2,}\s*$|^\s*\[[^\]]*\]\s*$)/i;
var RLL_NEGATIVA_ = /\bno (puedo|pude|tengo acceso|encontr|me es posible)|no es algo que pueda|no tengo (la )?capacidad/i;

function rllElevenLabs_(desde, hasta) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), ag = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key) return { error: 'falta ELEVENLABS_KEY' };
  var h = { 'xi-api-key': key }, lista = [], cursor = '';
  for (var i = 0; i < 10; i++) {
    var u = 'https://api.elevenlabs.io/v1/convai/conversations?page_size=100&call_start_after_unix=' + Math.floor(desde / 1000) + '&call_start_before_unix=' + Math.floor(hasta / 1000) +
      (ag ? '&agent_id=' + ag : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    var j = JSON.parse(uf_(u, { headers: h, muteHttpExceptions: true }).getContentText() || '{}');
    lista = lista.concat(j.conversations || []); if (!j.has_more || !j.next_cursor) break; cursor = j.next_cursor;
  }
  var fines = {}, porFuente = {};
  lista.forEach(function (c) { var f = rllFin_(c.termination_reason); fines[f] = (fines[f] || 0) + 1; var s = c.conversation_initiation_source || '?'; porFuente[s] = (porFuente[s] || 0) + 1; });
  var out = { llamadas: lista.length, minutos: Math.round(lista.reduce(function (s, c) { return s + (c.call_duration_secs || 0); }, 0) / 6) / 10,
    cortas_10s: lista.filter(function (c) { return (c.call_duration_secs || 0) < 10; }).length, fines: fines, por_fuente: porFuente,
    cortes: RLL_MALOS_.reduce(function (s, k) { return s + (fines[k] || 0); }, 0) };
  out.pct_cortes = lista.length ? Math.round(1000 * out.cortes / lista.length) / 10 : 0;
  /* La muestra: las más recientes con al menos 20 s, más las que terminaron mal. */
  var cand = lista.filter(function (c) { return (c.call_duration_secs || 0) >= 20; }).sort(function (a, b) { return b.start_time_unix_secs - a.start_time_unix_secs; });
  var malas = cand.filter(function (c) { return RLL_MALOS_.indexOf(rllFin_(c.termination_reason)) >= 0; });
  var elegidas = malas.slice(0, 8).concat(cand.filter(function (c) { return malas.indexOf(c) < 0; })).slice(0, RLL_MUESTRA_);
  var M = elegidas.map(function (c) { try { return rllUna_(c, h); } catch (e) { console.error('rllUna_: ' + e); return null; } }).filter(Boolean);
  out.muestra = M;
  out.modos = rllAgrupar_(M);
  out.total_muestra = rllAgrupar_(M.map(function (x) { var y = Object.assign({}, x); y.modo = 'todas'; return y; })).todas || null;
  return out;
}
/* Una llamada leída turno por turno. El silencio se estima por lo que dura lo dicho (no con el audio). */
function rllUna_(c, h) {
  var d = JSON.parse(uf_('https://api.elevenlabs.io/v1/convai/conversations/' + c.conversation_id, { headers: h, muteHttpExceptions: true }).getContentText() || '{}');
  var md = d.metadata || {}, ch = md.charging || {}, dv = ((d.conversation_initiation_client_data || {}).dynamic_variables) || {};
  var seg = c.call_duration_secs || md.call_duration_secs || 0, habla = 0, tok = 0, tokRelleno = 0, herr = [], negativas = [], previoRelleno = false;
  (d.transcript || []).forEach(function (t) {
    var msg = String(t.message || ''), u = ((t.llm_usage || {}).model_usage) || {}, tt = 0;
    Object.keys(u).forEach(function (m) { var x = u[m] || {}; ['input', 'input_cache_read', 'input_cache_write', 'output_total'].forEach(function (k) { tt += Number((x[k] || {}).tokens || 0); }); });
    tok += tt;
    if (t.role === 'agent') {
      habla += msg.length / 14;
      if (RLL_RELLENO_.test(msg) || previoRelleno) tokRelleno += tt;
      if (RLL_NEGATIVA_.test(msg)) negativas.push(msg.replace(/\s+/g, ' ').slice(0, 120));
      (t.tool_results || []).forEach(function (r) { herr.push({ n: r.tool_name || '', s: Number(r.tool_latency_secs || 0), error: !!r.is_error }); });
      previoRelleno = false;
    } else { habla += msg.length / 13; previoRelleno = !msg.trim() || RLL_RELLENO_.test(msg); }
  });
  var muerto = Math.max(0, seg - habla);
  return { id: c.conversation_id, modo: rllModo_(c, dv), seg: seg, creditos: Number(md.cost || 0), tokens: tok, pct_muerto: seg ? Math.round(1000 * muerto / seg) / 10 : 0,
    pct_relleno: tok ? Math.round(1000 * tokRelleno / tok) / 10 : 0, herramientas: herr, negativas: negativas, fin: rllFin_(c.termination_reason) };
}
function rllAgrupar_(M) {
  var g = {};
  M.forEach(function (x) { (g[x.modo] = g[x.modo] || []).push(x); });
  Object.keys(g).forEach(function (k) {
    var L = g[k], seg = L.reduce(function (s, x) { return s + x.seg; }, 0), cred = L.reduce(function (s, x) { return s + x.creditos; }, 0);
    var hs = [].concat.apply([], L.map(function (x) { return x.herramientas; }));
    var prom = function (f) { return Math.round(10 * L.reduce(function (s, x) { return s + x[f]; }, 0) / L.length) / 10; };
    g[k] = { n: L.length, seg_medio: Math.round(seg / L.length), creditos_min: seg ? Math.round(cred / (seg / 60)) : 0, pct_muerto: prom('pct_muerto'), pct_relleno: prom('pct_relleno'),
      espera_herramientas_s: hs.length ? Math.round(10 * hs.reduce(function (s, x) { return s + x.s; }, 0) / hs.length) / 10 : null,
      herramientas_con_error: hs.filter(function (x) { return x.error; }).length, negativas: L.reduce(function (s, x) { return s + x.negativas.length; }, 0),
      pct_cortes: Math.round(1000 * L.filter(function (x) { return RLL_MALOS_.indexOf(x.fin) >= 0; }).length / L.length) / 10 };
  });
  return g;
}
/* El chat con Alma (ALMA_OPERATIVO): cuánto tarda en responder, en 3 niveles, y cuántas respuestas son negativas. */
function rllChat_(desde, hasta) {
  var F = opFilas_('', 3000).filter(function (m) { var t = new Date(m.ts).getTime(); return t >= desde && t < hasta && m.usuario !== DESARROLLO_.email && m.canal !== 'claude' && !/^📞/.test(m.texto); });   // lo de Claude no es una respuesta de Alma
  var canales = {};
  F.forEach(function (m, i) {
    var c = m.canal === 'llamada' ? 'llamada' : m.canal === 'whatsapp' ? 'whatsapp' : 'app';
    var k = canales[c] = canales[c] || { pedidos: 0, respuestas: 0, tiempos: [], negativas: 0 };
    if (m.de === 'alma') { k.respuestas++; if (RLL_NEGATIVA_.test(m.texto)) k.negativas++; return; }
    k.pedidos++;
    var sig = F[i + 1]; if (sig && sig.de !== 'alma') return;   // un bloque seguido cuenta desde su último mensaje
    for (var j = i + 1; j < F.length; j++) if (F[j].de === 'alma' && F[j].usuario === m.usuario && F[j].canal === m.canal) { k.tiempos.push((new Date(F[j].ts) - new Date(m.ts)) / 1000); break; }
  });
  Object.keys(canales).forEach(function (c) {
    var k = canales[c], t = k.tiempos.slice().sort(function (a, b) { return a - b; }), n = t.length || 1;
    k.mediana_s = t.length ? Math.round(10 * t[Math.floor(t.length / 2)]) / 10 : null;
    k.n1 = Math.round(1000 * t.filter(function (x) { return x <= 10; }).length / n) / 10;
    k.n2 = Math.round(1000 * t.filter(function (x) { return x > 10 && x <= 60; }).length / n) / 10;
    k.n3 = Math.round(1000 * t.filter(function (x) { return x > 60; }).length / n) / 10;
    k.pct_negativas = k.respuestas ? Math.round(1000 * k.negativas / k.respuestas) / 10 : 0;
    delete k.tiempos;
  });
  return canales;
}
function rllConferencia_(desde, hasta) {
  var sh = ssAlma_().getSheetByName('ALMA_CONFERENCIAS'); if (!sh || sh.getLastRow() < 2) return { sesiones: 0 };
  var L = agFilas_(sh, CONF_CAB_).filter(function (c) { var t = new Date(c.inicio).getTime(); return t >= desde && t < hasta; });
  var est = {}; L.forEach(function (c) { est[c.estado] = (est[c.estado] || 0) + 1; });
  return { sesiones: L.length, por_estado: est, minutos: Math.round(L.reduce(function (s, c) { return s + Math.max(0, (new Date(c.actualizado) - new Date(c.inicio)) / 60000); }, 0)),
    reunion: L.filter(function (c) { return c.modo === 'reunion'; }).length, con_audio: L.filter(function (c) { return Number(c.partes) > 0; }).length };
}
function rllDatos_(desde, hasta) {
  var d = { semana_desde: desde.toISOString(), semana_hasta: hasta.toISOString() };
  try { d.voz = rllElevenLabs_(desde.getTime(), hasta.getTime()); } catch (e) { d.voz = { error: String(e).slice(0, 150) }; }
  try { d.chat = rllChat_(desde.getTime(), hasta.getTime()); } catch (e) { d.chat = { error: String(e).slice(0, 150) }; }
  try { d.conferencia = rllConferencia_(desde.getTime(), hasta.getTime()); } catch (e) { d.conferencia = { error: String(e).slice(0, 150) }; }
  return d;
}

/* ── 2 · Las propuestas del equipo ── */
function rllProponer_(datos, previa) {
  var sys = 'Eres el equipo «Mejora de llamadas» de Spacio AM: haces que las llamadas con Alma (asistente de voz en ElevenLabs) sean mejores y más eficientes. ' +
    'Tu meta es mejorar los indicadores de la semana con el balance correcto entre ahorro de tokens y créditos y una buena conversación (nunca ahorres a costa de que Juan no entienda o no le resuelvan). ' +
    'Con los números de esta semana y los de la anterior, propone de 3 a 6 mejoras concretas, la más valiosa primero. Cada una: titulo (máx. 8 palabras), porque (1 frase con la cifra que la motiva), ' +
    'efecto (qué indicador mueve y cuánto, estimado), tipo ("invisible" si Juan no notaría nada en cómo suena o se ve Alma: ahorro de contexto, arreglos, cortar llamadas que quedaron abiertas en silencio, ' +
    'reintentos; "visible" si cambia lo que oye o ve: voz, modelo, estilo, cuándo cuelga Alma, qué dice, filtros) y para_claude (instrucción técnica para el desarrollador, 2 a 4 frases). ' +
    'Si una propuesta de la semana pasada sigue sin hacerse y sigue siendo la más valiosa, repítela. Responde SOLO JSON: {"lectura":"2 frases: cómo estuvo la semana","propuestas":[…]}.';
  var usr = 'ESTA SEMANA:\n' + JSON.stringify(rllResumen_(datos)).slice(0, 9000) + '\n\nSEMANA ANTERIOR:\n' + (previa ? JSON.stringify(rllResumen_(previa)).slice(0, 4000) : '(no hay)');
  try {
    var t = String(claude_(CFG.MODELO_REDACTOR, 1600, sys, usr, 0.3) || ''), j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    var P = (j.propuestas || []).slice(0, 6).map(function (x, i) { return { n: i + 1, titulo: String(x.titulo || '').slice(0, 90), porque: String(x.porque || '').slice(0, 300), efecto: String(x.efecto || '').slice(0, 200),
      tipo: x.tipo === 'invisible' ? 'invisible' : 'visible', para_claude: String(x.para_claude || '').slice(0, 900), estado: x.tipo === 'invisible' ? 'con Claude' : 'espera tu sí' }; });
    return { lectura: String(j.lectura || '').slice(0, 400), propuestas: P };
  } catch (e) { console.error('rllProponer_: ' + e); return { lectura: '', propuestas: [] }; }
}
/* Lo que el equipo y la página necesitan, sin la muestra completa. */
function rllResumen_(d) {
  var v = d.voz || {}, s = Object.assign({}, d); s.voz = Object.assign({}, v); delete s.voz.muestra;
  return s;
}

/* ── La ronda del lunes ── */
function rllGenerar_(adm, pedido) {
  var sem = rllSemana_(), previa = rllReportes_().filter(function (r) { return r.id < sem.id; }).sort(function (a, b) { return a.id < b.id ? 1 : -1; })[0];
  var datPrevia = null; try { datPrevia = previa ? JSON.parse(previa.datos) : null; } catch (e) {}
  var datos = rllDatos_(sem.desde, sem.hasta);
  var prop = rllProponer_(datos, datPrevia);
  datos.lectura = prop.lectura;
  datos.previa = datPrevia ? rllResumen_(datPrevia) : null;
  /* lo invisible: un solo pedido a Claude; su PR llega a Pendientes para unir */
  var inv = prop.propuestas.filter(function (x) { return x.tipo === 'invisible'; });
  if (inv.length && adm) {
    var rc = paraClaudeCrear_(adm, { titulo: 'Mejora de llamadas · semana ' + sem.semana, app: 'Alma voz', tipo: 'mejora', prioridad: 'normal',
      que_quiere: 'Eres el equipo «Mejora de llamadas». Lee playbooks/mejora-llamadas.md y síguelo. Implementa en UN PR estas mejoras que no cambian nada de lo que Juan oye o ve; mide antes y después:\n' +
        inv.map(function (x) { return x.n + ') ' + x.titulo + ' — ' + x.para_claude + ' (efecto esperado: ' + x.efecto + ')'; }).join('\n') +
        (pedido ? '\n\nQUÉ PIDIÓ JUAN: ' + pedido : '') + '\n\nNúmeros de la semana (resumen): ' + JSON.stringify(rllResumen_(datos)).slice(0, 5000) });
    inv.forEach(function (x) { x.estado = rc.ok ? 'con Claude' : 'no se pudo enviar'; });
  }
  var sh = hojaRll_(), ya = rllReportes_().filter(function (r) { return r.id === sem.id; })[0];
  var row = { id: sem.id, semana: sem.semana, desde: sem.desde.toISOString(), hasta: sem.hasta.toISOString(), creado: new Date().toISOString(),
    datos: JSON.stringify(datos).slice(0, 45000), propuestas: JSON.stringify(prop.propuestas), estado: 'listo' };
  if (ya) row.fila = ya.fila;
  agGuardar_(sh, RLL_CAB_, row);
  /* el aviso: notificación con el enlace; lo que espera su sí también queda en Pendientes */
  if (adm) {
    var vis = prop.propuestas.filter(function (x) { return x.tipo === 'visible'; }).length, url = RLL_URL_ + '?id=' + encodeURIComponent(sem.id);
    try { vozAvisoPoner_(adm, 'Tu reporte de llamadas de la semana está listo' + (vis ? ': el equipo tiene ' + vis + (vis === 1 ? ' propuesta' : ' propuestas') + ' para ti.' : '.')); } catch (e) {}
    try { pendCrear_(adm, { tipo: 'aviso', area: 'proposito', proyecto: 'Mejora de llamadas', titulo: 'Reporte de llamadas · ' + sem.semana, resumen: prop.lectura || 'Los números de la semana y lo que propone el equipo.',
      acciones: [{ texto: 'Ver el reporte', url: url }], importancia: 2 }, { origen: 'mejora_llamadas', push: false }); } catch (e) { console.error('rll aviso: ' + e); }
    if (vis) { try { pendCrear_(adm, { tipo: 'atencion', area: 'proposito', proyecto: 'Mejora de llamadas', titulo: 'Propuestas de mejora de llamadas', resumen: vis + (vis === 1 ? ' propuesta espera' : ' propuestas esperan') + ' tu sí en el reporte de la semana.',
      acciones: [{ texto: 'Decidir', url: url + '#propuestas' }], importancia: 2 }, { origen: 'mejora_llamadas', push: false }); } catch (e) { console.error('rll pendiente: ' + e); } }
  }
  return { ok: true, id: sem.id, semana: sem.semana, propuestas: prop.propuestas.length, lectura: prop.lectura };
}
function agMejoraLlamadasRonda_(a, adm, origen, pedido) {
  var r = rllGenerar_(adm, pedido);
  a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
  agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: a.ultima, origen: origen, pedido: pedido || '', estado: r.ok ? 'listo' : 'error',
    informe: r.ok ? 'Reporte de llamadas · ' + r.semana + ': ' + (r.lectura || '') + ' (' + r.propuestas + ' propuestas)' : String(r.error || ''), costo_usd: 0, terminado: new Date().toISOString() });
  return { ok: !!r.ok, agente: a.nombre, informe: r.ok ? 'Listo el reporte de llamadas de la semana ' + r.semana + '. ' + (r.lectura || '') : r.error, propuestas: [], costo_usd: 0 };
}

/* ── La página (alma/reporte.html): el reporte y las decisiones de Juan ── */
function reporteLlamadas_(ses, b) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  b = b || {};
  var L = rllReportes_().sort(function (x, y) { return x.id < y.id ? 1 : -1; });
  if (b.decidir) {
    var r0 = L.filter(function (r) { return r.id === b.decidir.id; })[0]; if (!r0) return { ok: false, error: 'No encontré ese reporte.' };
    var P = []; try { P = JSON.parse(r0.propuestas || '[]'); } catch (e) {}
    var p = P.filter(function (x) { return x.n === Number(b.decidir.n); })[0]; if (!p || p.estado !== 'espera tu sí') return { ok: false, error: 'Esa propuesta ya se decidió.' };
    if (b.decidir.si) {
      var rc = paraClaudeCrear_(adm, { titulo: 'Mejora de llamadas · ' + p.titulo, app: 'Alma voz', tipo: 'mejora', prioridad: 'normal',
        que_quiere: 'Juan aprobó esta propuesta del equipo «Mejora de llamadas» (lee playbooks/mejora-llamadas.md): ' + p.titulo + '. ' + p.para_claude + ' Efecto esperado: ' + p.efecto + '. Mide antes y después.' });
      p.estado = rc.ok ? 'aprobada · con Claude' : 'aprobada · no se pudo enviar';
    } else p.estado = 'no';
    r0.propuestas = JSON.stringify(P); agGuardar_(hojaRll_(), RLL_CAB_, r0);
    if (!P.some(function (x) { return x.estado === 'espera tu sí'; })) { try { pendFilas_().forEach(function (x) { if (x.origen === 'mejora_llamadas' && x.tipo === 'atencion' && x.estado === 'abierto') hojaPend_().getRange(x.fila, PEND_CAB_.indexOf('estado') + 1).setValue('resuelto'); }); } catch (e) {} }
  }
  var r = (b.id ? L.filter(function (x) { return x.id === b.id; })[0] : null) || L[0];
  var out = { ok: true, lista: L.map(function (x) { return { id: x.id, semana: x.semana }; }) };
  if (r) { var dat = {}, pro = []; try { dat = JSON.parse(r.datos); } catch (e) {} try { pro = JSON.parse(r.propuestas || '[]'); } catch (e) {}
    if (dat.voz) delete dat.voz.muestra;
    out.reporte = { id: r.id, semana: r.semana, creado: r.creado, datos: dat, propuestas: pro }; }
  return out;
}
