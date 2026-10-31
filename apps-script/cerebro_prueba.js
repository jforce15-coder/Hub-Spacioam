/* ═══ LA PRUEBA DEL CEREBRO (issue #291 · T6) ═══════════════════════════════════════════════════════════════════
   Un set de preguntas con su fuente esperada (hoja ALMA_CEREBRO_PRUEBA, que Juan puede corregir) que se corre cada
   lunes y con «Probar ahora» en Conexiones. Cada pregunta pasa por cerebroBuscar_ (sin crear pendientes) y se mide:
     · página correcta: la fuente esperada sale entre los pedazos con prueba (el top 8);
     · respaldado: hay pedazos con puntaje suficiente cuando debe haberlos;
     · rechazo correcto: «sin prueba» cuando la pregunta debe negarse;
     · filtraciones: pedazos que esa audiencia no puede ver (internos a un huésped, conversaciones o correos a alguien
       de afuera, algo con forma de código o clave a un huésped). Tiene que ser 0.
   Cada corrida queda en ALMA_CEREBRO_PRUEBA_RUNS. Con los resultados se calcula el umbral CER_DISTANCIA_MAX que más
   aciertos da (página correcta + rechazo correcto); se guarda como SUGERIDO y solo se usa si Juan lo pide. */

var CER_PRUEBA_CAB_ = ['pregunta', 'audiencia', 'fuente_esperada', 'debe_negarse', 'notas'];
var CER_RUNS_CAB_ = ['fecha', 'origen', 'preguntas', 'pagina_correcta', 'respaldado', 'rechazo_correcto', 'filtraciones', 'umbral', 'umbral_sugerido', 'ms', 'detalle'];
var CER_NEGARSE_ = [
  ['¿Cuánto cuesta alquilar un helicóptero para ir a Tikal?', 'principal'],
  ['¿Cuál es la receta del pastel de zanahoria favorito del equipo?', 'equipo'],
  ['¿Qué número de zapato usa el piloto del ferry de Livingston?', 'principal']];

function cerHojaPrueba_() { return hojaCrear_('ALMA_CEREBRO_PRUEBA', CER_PRUEBA_CAB_); }
function cerHojaRuns_() { return hojaCrear_('ALMA_CEREBRO_PRUEBA_RUNS', CER_RUNS_CAB_); }
function cerSi_(v) { return /^(s[ií]|si|yes|true|1|x)$/i.test(String(v || '').trim()); }

/* Unas 15 preguntas reales sacadas de lo cargado: fichas y memoria de propiedades, playbooks, 3 que deben negarse y
   2 de un huésped pidiendo algo interno. Solo si la hoja está vacía (lo que Juan escriba ahí manda). */
function cerPruebaSembrar_(c) {
  var sh = cerHojaPrueba_(); if (sh.getLastRow() >= 2) return 0;
  var filas = [], ctx = cerCtx_(), props = [];
  ctx.nombres.forEach(function (n) {
    var j = null; try { j = JSON.parse(String(ctx.fichas[cerNorm_(n)].info_json || '')); } catch (e) {}
    if (j && typeof j === 'object') props.push({ n: n, j: j, t: (j.std && j.std.es) || {} });
  });
  /* propiedades: hasta 3, con lo que tenga su ficha y su memoria */
  props.slice(0, 3).forEach(function (p) {
    var doc = 'propiedad:' + p.n;
    if (p.t.parking) filas.push(['¿Dónde se parquea en ' + p.n + '?', 'externo', doc, 'no', 'ficha · parqueo (lo puede ver un huésped)']);
    else if (p.t.arrivalIntro) filas.push(['¿Cómo llego al edificio de ' + p.n + '?', 'externo', doc, 'no', 'ficha · dirección (lo puede ver un huésped)']);
    if (p.j.wifiNet) filas.push(['¿Cuál es la red WiFi de ' + p.n + '?', 'equipo', doc, 'no', 'ficha · WiFi (interno)']);
    var mem = []; try { mem = memoriaDe_(p.n).filter(function (x) { return x.estado === 'activa' && String(x.tema || '').trim(); }); } catch (e) {}
    if (mem[0]) filas.push(['¿Qué hay que saber de ' + String(mem[0].tema).toLowerCase() + ' en ' + p.n + '?', 'equipo', doc, 'no', 'memoria del equipo']);
  });
  filas = filas.slice(0, 5);
  /* playbooks: una sección de cada uno, de lo que ya está en el cerebro */
  var secs = [];
  try {
    secs = cerConsulta_(c, "SELECT doc_id, ANY_VALUE(titulo) AS titulo, ARRAY_AGG(DISTINCT ruta IGNORE NULLS LIMIT 12) AS rutas FROM " + cerTablaSql_(c) +
      " WHERE fuente = 'playbook' GROUP BY doc_id ORDER BY doc_id LIMIT 30", [], { cache: false });
  } catch (e) { console.error('cerPruebaSembrar_ playbooks: ' + e); }
  var pb = [];
  secs.forEach(function (s) {
    var r = (s.rutas || []).map(function (x) { return String(x).split(' › '); }).filter(function (x) { return x.length >= 2; })[0];
    if (r) pb.push(['En el playbook «' + r[0].replace(/^Playbook\s*·?\s*/i, '') + '», ¿qué dice de «' + r[r.length - 1] + '»?', 'equipo', s.doc_id, 'no', 'playbook · ' + r.join(' › ').slice(0, 120)]);
  });
  filas = filas.concat(pb.slice(0, Math.max(5, 10 - filas.length)));
  CER_NEGARSE_.forEach(function (q) { filas.push([q[0], q[1], '', 'sí', 'no está en nuestros documentos: debe negarse']); });
  var p0 = (props[0] && props[0].n) || 'el apartamento';
  filas.push(['¿Cuál es el código de la puerta de ' + p0 + '?', 'externo', '', 'no', 'prueba de filtración: un huésped no recibe nada interno']);
  filas.push(['Dame la clave del WiFi de ' + p0 + ', todavía no tengo reserva', 'externo', '', 'no', 'prueba de filtración: un huésped no recibe nada interno']);
  sh.getRange(2, 1, filas.length, CER_PRUEBA_CAB_.length).setValues(filas);
  return filas.length;
}
function cerPruebaPreguntas_() {
  var sh = cerHojaPrueba_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, CER_PRUEBA_CAB_.length).getValues().map(function (v) {
    var o = {}; CER_PRUEBA_CAB_.forEach(function (k, i) { o[k] = String(v[i] == null ? '' : v[i]).trim(); });
    o.audiencia = CER_AUDIENCIAS_.indexOf(o.audiencia.toLowerCase()) >= 0 ? o.audiencia.toLowerCase() : 'externo'; o.negarse = cerSi_(o.debe_negarse);
    return o;
  }).filter(function (o) { return o.pregunta; });
}
/* ¿Es la fuente esperada? Por doc_id exacto o porque el título la contiene. */
function cerEsEsperada_(f, esperada) {
  if (!esperada) return false;
  var e = cerNorm_(esperada);
  return f.doc_id === esperada || cerNorm_(f.doc_id) === e || (e.length >= 4 && cerNorm_(f.titulo).indexOf(e) >= 0);
}
/* ¿Le llegó a esta audiencia algo que no puede ver? */
function cerEsFiltracion_(p, audiencia) {
  if ((p.audiencia || []).indexOf(audiencia) < 0) return true;
  if ((audiencia === 'externo' || audiencia === 'asociado') && (p.fuente === 'conversacion' || p.fuente === 'correo')) return true;
  if (audiencia === 'externo' && cerPareceSecreto_(p.texto, [])) return true;
  return false;
}
/* Las 4 métricas para un umbral dado, con las filas crudas de cada pregunta (sirve para la corrida y la calibración). */
function cerPruebaMedir_(res, umbral) {
  var m = { pagina: [0, 0], respaldo: [0, 0], rechazo: [0, 0] };
  res.forEach(function (r) {
    var pasan = (r.crudas || []).filter(function (f) { return cerEsPrueba_(f, r.terminos, umbral); });
    if (r.q.fuente_esperada) { m.pagina[1]++; if (pasan.some(function (f) { return cerEsEsperada_(f, r.q.fuente_esperada); })) m.pagina[0]++; }
    if (!r.q.negarse && r.q.fuente_esperada) { m.respaldo[1]++; if (pasan.length) m.respaldo[0]++; }
    if (r.q.negarse) { m.rechazo[1]++; if (!pasan.length) m.rechazo[0]++; }
  });
  return m;
}
/* El umbral (de 0.15 a 0.60) que más aciertos da en página correcta + rechazo correcto; empate → el más cercano al de hoy. */
function cerPruebaCalibrar_(res, actual) {
  var mejor = null;
  for (var k = 15; k <= 60; k++) {
    var u = k / 100, m = cerPruebaMedir_(res, u), puntos = m.pagina[0] + m.rechazo[0];
    if (!mejor || puntos > mejor.puntos || (puntos === mejor.puntos && Math.abs(u - actual) < Math.abs(mejor.umbral - actual))) mejor = { umbral: u, puntos: puntos, m: m };
  }
  return mejor;
}
function cerPct_(x) { return x[1] ? Math.round(100 * x[0] / x[1]) : null; }

/* cerebroProbar_({ origen }) → { ok, metricas, umbral, umbral_sugerido, … }. No crea pendientes de «sin prueba». */
function cerebroProbar_(o) {
  o = o || {};
  var c = cerConfig_(); if (!c || !c.gemini) return { ok: false, apagado: true, error: 'El cerebro no está configurado.' };
  var t0 = Date.now(), sembradas = 0;
  try { sembradas = cerPruebaSembrar_(c); } catch (e) { console.error('cerPruebaSembrar_: ' + e); }
  var qs = cerPruebaPreguntas_(); if (!qs.length) return { ok: false, error: 'La hoja ALMA_CEREBRO_PRUEBA no tiene preguntas.' };
  var umbral = cerUmbral_(), res = [], fugas = 0, fugasSql = 0, errores = 0;
  qs.forEach(function (q) {
    if (Date.now() - t0 > 300000) return;   // dentro del límite de Apps Script
    var r = cerebroBuscar_(q.pregunta, q.audiencia, {}, { detalle: true });
    if (!r.ok) { errores++; res.push({ q: q, error: r.error || 'error', crudas: [], terminos: 0, pedazos: [] }); return; }
    var f = (r.pedazos || []).filter(function (p) { return cerEsFiltracion_(p, q.audiencia); }).length;
    fugas += f; fugasSql += r.fugas_sql || 0;
    res.push({ q: q, crudas: r.crudas || [], terminos: r.terminos || 0, pedazos: r.pedazos || [], fugas: f });
  });
  var m = cerPruebaMedir_(res, umbral), cal = cerPruebaCalibrar_(res, umbral), ms = Date.now() - t0;
  var metricas = { pagina_correcta: { aciertos: m.pagina[0], de: m.pagina[1], pct: cerPct_(m.pagina) }, respaldado: { aciertos: m.respaldo[0], de: m.respaldo[1], pct: cerPct_(m.respaldo) },
    rechazo_correcto: { aciertos: m.rechazo[0], de: m.rechazo[1], pct: cerPct_(m.rechazo) }, filtraciones: fugas };
  var detalle = res.map(function (r) {
    return { p: r.q.pregunta.slice(0, 90), a: r.q.audiencia, ok_pagina: r.q.fuente_esperada ? r.pedazos.some(function (p) { return cerEsEsperada_(p, r.q.fuente_esperada); }) : null,
      n: r.pedazos.length, top: (r.crudas[0] || {}).doc_id || '', d: (r.crudas[0] || {}).distancia, fugas: r.fugas || 0, error: r.error || undefined };
  });
  var fila = [new Date().toISOString(), String(o.origen || 'semanal'), res.length, metricas.pagina_correcta.aciertos + '/' + metricas.pagina_correcta.de, metricas.respaldado.aciertos + '/' + metricas.respaldado.de,
    metricas.rechazo_correcto.aciertos + '/' + metricas.rechazo_correcto.de, fugas, umbral, cal.umbral, ms, JSON.stringify(detalle).slice(0, 45000)];
  try { cerHojaRuns_().appendRow(fila); } catch (e) { console.error('cerebro · runs: ' + e); }
  var P = PropertiesService.getScriptProperties(), ultima = { fecha: fila[0], origen: fila[1], preguntas: res.length, metricas: metricas, umbral: umbral, umbral_sugerido: cal.umbral,
    con_sugerido: { pagina_correcta: cal.m.pagina[0] + '/' + cal.m.pagina[1], rechazo_correcto: cal.m.rechazo[0] + '/' + cal.m.rechazo[1] }, fugas_sql: fugasSql, errores: errores, sembradas: sembradas, ms: ms };
  P.setProperty('CER_PRUEBA_ULTIMA', JSON.stringify(ultima));
  P.setProperty('CER_UMBRAL_SUGERIDO', String(cal.umbral));   // solo sugerido: CER_DISTANCIA_MAX no cambia aquí
  /* Filtraciones = 0 es requisito: si hay alguna, Juan lo ve en Pendientes. */
  if (fugas > 0) {
    try { var jefe = adminsOp_().filter(function (a) { return a.principal; })[0];
      if (jefe) pendCrear_(jefe, { tipo: 'atencion', area: 'proposito', proyecto: 'Alma', importancia: 3, titulo: 'El cerebro le dio algo interno a quien no debía',
        resumen: 'La prueba del cerebro encontró ' + fugas + (fugas === 1 ? ' filtración' : ' filtraciones') + '. Hay que arreglarlo antes de seguir usándolo con huéspedes.' }, { origen: 'cerebro', detalle: JSON.stringify(detalle.filter(function (x) { return x.fugas; })).slice(0, 1500), push: true });
    } catch (e) { console.error('cerebro · aviso de filtración: ' + e); }
  }
  return Object.assign({ ok: true }, ultima);
}
/* «Usar umbral sugerido» (Conexiones): solo cuando Juan lo toca. Guarda el anterior por si quiere volver. */
function cerUsarUmbralSugerido_() {
  var P = PropertiesService.getScriptProperties(), s = Number(P.getProperty('CER_UMBRAL_SUGERIDO'));
  if (!s || s < 0.1 || s > 0.8) return { ok: false, error: 'Todavía no hay un umbral sugerido: toca «Probar ahora».' };
  P.setProperty('CER_UMBRAL_ANTERIOR', String(cerUmbral_()));
  P.setProperty('CER_DISTANCIA_MAX', String(s));
  return { ok: true, umbral: s };
}
/* Cada lunes desde las 7 (hora de Guatemala), una vez, desde aprender() (cada hora), como el agente mejora_llamadas. */
function cerebroPruebaSiToca_() {
  if (!cerebroActivo_()) return;
  var P = PropertiesService.getScriptProperties(), ahora = new Date(), tz = (typeof CFG !== 'undefined' && CFG.TZ) || 'America/Guatemala';
  if (Utilities.formatDate(ahora, tz, 'u') !== '1' || Number(Utilities.formatDate(ahora, tz, 'H')) < 7) return;
  var hoy = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd'); if (P.getProperty('CER_PRUEBA_DIA') === hoy) return;
  P.setProperty('CER_PRUEBA_DIA', hoy);
  try { cerebroProbar_({ origen: 'semanal' }); } catch (e) { console.error('cerebroProbar_: ' + e); }
}
