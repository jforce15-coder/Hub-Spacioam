/* ═══ GASTO DE ALMA: UN SOLO REPORTE (Juan, 17-nov-2026) ═══════════════════════════════════════════════════════════
   «Hoy tenemos un reporte para los usos de Google, otro para los consumos, otro para las llamadas. Eso necesitamos
   unificarlo todo. Lo más importante es cuánto está gastando el app: el gasto mensual.» Un solo número arriba (el mes,
   la proyección y el mes pasado), los proveedores de mayor a menor y, al tocar uno, en qué se va.
   · De dónde sale cada número (cada línea dice si es medido, estimado o falta dato):
       Claude · tokens del Hub → IA_USO (registrarUso_ en cada llamada a la API; medido).
       ElevenLabs · lo pagado → la tabla de planes y recargas (de los recibos); el reparto por agente, canal y LLM/voz
         sale de las conversaciones del mes y de una muestra leída una por una (estimado: reparte lo pagado por créditos).
       Planes fijos (plan de Claude, Higgsfield, Google Workspace, Apple, dominio…) → la tabla de planes.
       Google → además los cupos de hoy por app (cupo.js); el cupo no cuesta dinero, pero si se acaba Alma se pausa.
   · La tabla de planes vive en la propiedad del script GASTO_PLANES, NUNCA en este repo (es público: ni montos ni datos
     de cuentas). Juan la corrige en la pantalla (gastoPlanFijar) y el robot la llena desde los recibos (gasto_planes).
     Lo que no tiene monto sale como «falta dato» y se puede escribir ahí mismo.
   · Hoja privada GASTO_MES: una fila por mes con el total y su desglose, para comparar con el mes pasado.
   · El equipo de ahorro (Pareto 80/20) vive abajo: gastoPareto_ y la hoja GASTO_AHORRO. Solo mira el gasto de Alma.
   · DOS CLASES, SIN MEZCLAR (Juan, 19-nov-2026): «Hospitable sí lo pondría, pero como un gasto aparte […] Hoy por hoy es
     un gasto de Spacio AM como empresa, no un gasto de Alma como agente. Esa diferenciación necesito que esté súper clara.»
     Y sobre el plan de Claude: «Alma lo único que gasta son tokens; hoy uso Claude porque estamos en desarrollo, pero un
     usuario normal usando solo la app de Alma solo debería gastar tokens.» Por eso tres clases:
       «alma»       = Gasto de Alma (agente): solo lo que cuesta que Alma funcione para un usuario (tokens de la llave de
                      API del Hub, la voz de ElevenLabs, Google de alma@…). Es el número grande.
       «desarrollo» = Desarrollo (empresa): construir Alma (plan de Claude de Claudio, Apple Developer, Higgsfield y la
                      GPU de voces, herramientas de construcción).
       «operacion»  = Operación (empresa): lo que Spacio AM pagaría igual sin Alma (Hospitable, dominio).
     Las dos de empresa van aparte, con su propio total, y NUNCA suman al número de Alma. El total general sale al
     final solo como referencia. Los tokens de la llave de API (IA_USO) y el plan de Claude son proveedores distintos.
   · Moneda: un plan puede venir en otra moneda (moneda + monto, p. ej. un recibo en euros). El Hub no tiene todavía una
     fuente de tipo de cambio: si falta usd, se muestra el monto en su moneda y «falta USD» (no se inventa la conversión).
   Pantalla: alma/gasto.html (Ajustes → Gasto de Alma). Voz y chat: herramienta gasto_alma («¿cuánto estamos gastando?»). */

var GASTO_URL_ = 'https://hub.spacioam.com/alma/gasto.html';
var GASTO_CACHE_MIN_ = 30;            // el reporte armado, en caché (lo pesado es ElevenLabs)
var GASTO_EL_CACHE_MIN_ = 180;        // conversaciones de ElevenLabs del mes: cada 3 h como mucho (cuida el cupo de Google)
var GASTO_EL_MUESTRA_ = 10;           // conversaciones leídas una por una (las más largas del mes): créditos y LLM reales
var GASTO_MES_CAB_ = ['mes', 'actualizado', 'total_usd', 'medido_usd', 'estimado_usd', 'faltan', 'desglose'];
/* Los proveedores, cada uno con su clase: «alma», «desarrollo» u «operacion». Sin montos aquí: están en GASTO_PLANES. */
var GASTO_PROV_ = [
  { id: 'anthropic', clase: 'alma', nombre: 'Claude · tokens (API)', que: 'Lo que Alma piensa por escrito con la llave de API del Hub: chat, WhatsApp, huéspedes. No es el plan de Claude.' },
  { id: 'elevenlabs', clase: 'alma', nombre: 'ElevenLabs', que: 'La voz de Alma: llamadas en la app, por teléfono y WhatsApp.' },
  { id: 'google', clase: 'alma', nombre: 'Google', que: 'Workspace de alma@ y Google Cloud. Aquí también los cupos de hoy.' },
  { id: 'onesignal', clase: 'alma', nombre: 'OneSignal', que: 'Las notificaciones de Alma en la web.' },
  { id: 'otros', clase: 'alma', nombre: 'Otros de Alma', que: 'Lo demás que cuesta que Alma funcione.' },
  { id: 'claude_plan', clase: 'desarrollo', nombre: 'Plan de Claude', que: 'Claudio: las sesiones de Claude Code que construyen Alma. Un usuario de la app no lo gasta.' },
  { id: 'apple', clase: 'desarrollo', nombre: 'Apple Developer', que: 'Para publicar la app de Alma (TestFlight).' },
  { id: 'higgsfield', clase: 'desarrollo', nombre: 'Higgsfield', que: 'Fotos y videos con IA y la GPU para crear voces.' },
  { id: 'desarrollo_otros', clase: 'desarrollo', nombre: 'Otras herramientas de construcción', que: 'Lo demás que se usa para construir Alma.' },
  { id: 'hospitable', clase: 'operacion', nombre: 'Hospitable', que: 'Las reservas y los canales de Spacio AM. Para Alma es conexión y respaldo, pero se paga igual sin ella.' },
  { id: 'dominio', clase: 'operacion', nombre: 'Dominio y web', que: 'spacioam.com y lo que lo sirve: es de la empresa.' },
  { id: 'empresa_otros', clase: 'operacion', nombre: 'Otros de la operación', que: 'Otra operación de Spacio AM que no es Alma.' }
];
var GASTO_CLASES_ = { alma: 'Gasto de Alma (agente)', empresa: 'Gastos de Spacio AM (empresa)', desarrollo: 'Desarrollo (empresa)', operacion: 'Operación (empresa)' };
var GASTO_CLASES_QUE_ = { desarrollo: 'Lo que cuesta construir Alma. Un usuario que solo usa la app no lo gasta.', operacion: 'Lo que Spacio AM pagaría igual sin Alma.' };
function gastoClase_(prov) { var P = GASTO_PROV_.filter(function (x) { return x.id === prov; })[0]; return P ? P.clase : ''; }

function gastoR2_(x) { return Math.round((Number(x) || 0) * 100) / 100; }
function gastoMesDe_(t) { return Utilities.formatDate(new Date(t), CFG.TZ, 'yyyy-MM'); }
/* Inicio y fin de un mes «yyyy-MM» en hora de Guatemala (UTC-6, sin horario de verano). */
function gastoRangoMes_(mes) {
  var y = +mes.slice(0, 4), m = +mes.slice(5, 7);
  var ini = Date.UTC(y, m - 1, 1, 6), fin = Date.UTC(y, m, 1, 6);
  return { ini: ini, fin: fin, dias: Math.round((fin - ini) / 86400000) };
}
function gastoMesAnterior_(mes) { var y = +mes.slice(0, 4), m = +mes.slice(5, 7); return Utilities.formatDate(new Date(Date.UTC(y, m - 2, 15)), 'UTC', 'yyyy-MM'); }

/* ── La tabla de planes (GASTO_PLANES) ── [{ id, prov, nombre, tipo: mes|año|una_vez, usd, moneda?, monto?, desde, hasta, fecha, fuente, nota }]
   usd vacío = falta dato. tipo «una_vez» (recargas, cuotas): cuenta en el mes de su fecha.
   moneda + monto: el recibo en otra moneda (EUR…). Si no vienen pero la nota o el nombre dicen «N EUR» o «N €», se leen de ahí. */
function gastoMoneda_(p) {
  var mon = String(p.moneda || '').toUpperCase().replace('€', 'EUR').slice(0, 3), monto = p.monto === '' || p.monto == null ? null : Number(String(p.monto).replace(',', '.'));
  if (!mon || mon === 'USD') {
    var m = /(\d[\d.,]*)\s*(EUR|€)/i.exec([p.nota, p.nombre, p.fuente].join(' '));
    if (m && (p.usd === '' || p.usd == null)) { mon = 'EUR'; monto = Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')); }
  }
  if (!mon || mon === 'USD' || !isFinite(monto) || monto == null) return { moneda: 'USD', monto: null };
  return { moneda: mon, monto: monto };
}
function gastoPlanes_() {
  var s = PropertiesService.getScriptProperties().getProperty('GASTO_PLANES'), l = [];
  try { l = JSON.parse(s || '[]') || []; } catch (e) { l = []; }
  return l.filter(function (p) { return p && p.prov; }).map(function (p, i) {
    var usd = p.usd === '' || p.usd == null ? null : Number(p.usd);
    return { id: String(p.id || ('p' + i)), prov: String(p.prov), nombre: String(p.nombre || 'Plan'), tipo: /^(año|anual|ano)$/i.test(p.tipo) ? 'año' : p.tipo === 'una_vez' ? 'una_vez' : 'mes',
      usd: isFinite(usd) ? usd : null, moneda: gastoMoneda_(p).moneda, monto: gastoMoneda_(p).monto, desde: String(p.desde || ''), hasta: String(p.hasta || ''), fecha: String(p.fecha || ''), fuente: String(p.fuente || ''), nota: String(p.nota || '').slice(0, 200) };
  });
}
function gastoPlanesGuardar_(l) { PropertiesService.getScriptProperties().setProperty('GASTO_PLANES', JSON.stringify(l).slice(0, 8500)); CacheService.getScriptCache().remove('gasto_rep'); }
/* Cuánto de un plan cae en el mes. null = falta el monto (pero el plan está activo ese mes). undefined = no aplica. */
function gastoPlanEnMes_(p, mes) {
  if (p.tipo === 'una_vez') { if (String(p.fecha).slice(0, 7) !== mes) return undefined; return p.usd == null ? null : p.usd; }
  if (p.desde && String(p.desde).slice(0, 7) > mes) return undefined;
  if (p.hasta && String(p.hasta).slice(0, 7) < mes) return undefined;
  if (p.usd == null) return null;
  return p.tipo === 'año' ? p.usd / 12 : p.usd;
}

/* ── Claude · tokens: IA_USO del mes (medido) ── */
function gastoClaude_(mes) {
  var R = gastoRangoMes_(mes), out = { usd: 0, n: 0, inp: 0, out: 0, cache: 0, funciones: {}, modelos: {}, apps: {}, dias: {} };
  var sh = ssAlma_().getSheetByName('IA_USO');
  if (!sh || sh.getLastRow() < 2) return gastoClaudeOrden_(out);
  var n = sh.getLastRow(), ini = Math.max(2, n - 60000);
  sh.getRange(ini, 1, n - ini + 1, USO_CAB_.length).getValues().forEach(function (v) {
    var t = v[0] instanceof Date ? v[0].getTime() : Date.parse(v[0]); if (!(t >= R.ini && t < R.fin)) return;
    var usd = +v[10] || 0, app = String(v[1] || 'ALMA'), fn = String(v[2] || 'Otro'), mod = String(v[5] || '¿?'), k = app + ' · ' + fn;
    out.usd += usd; out.n++; out.inp += +v[6] || 0; out.out += +v[7] || 0; out.cache += (+v[8] || 0) + (+v[9] || 0);
    var F = out.funciones[k] = out.funciones[k] || { nombre: k, usd: 0, n: 0, inp: 0, out: 0, modelos: {} };
    F.usd += usd; F.n++; F.inp += (+v[6] || 0) + (+v[8] || 0) + (+v[9] || 0); F.out += +v[7] || 0; F.modelos[mod] = (F.modelos[mod] || 0) + 1;
    out.modelos[mod] = (out.modelos[mod] || 0) + usd; out.apps[app] = (out.apps[app] || 0) + usd;
    var d = Utilities.formatDate(new Date(t), CFG.TZ, 'dd'); out.dias[d] = (out.dias[d] || 0) + usd;
  });
  return gastoClaudeOrden_(out);
}
function gastoClaudeOrden_(o) {
  var lista = function (m) { return Object.keys(m).map(function (k) { return { nombre: k, usd: gastoR2_(m[k]) }; }).sort(function (a, b) { return b.usd - a.usd; }); };
  return { usd: gastoR2_(o.usd), n: o.n, tokens: { entrada: o.inp, salida: o.out, cache: o.cache },
    funciones: Object.keys(o.funciones).map(function (k) { var F = o.funciones[k]; var mm = Object.keys(F.modelos).sort(function (a, b) { return F.modelos[b] - F.modelos[a]; })[0] || '';
      return { nombre: F.nombre, usd: gastoR2_(F.usd), n: F.n, tokens: F.inp + F.out, modelo: mm }; }).sort(function (a, b) { return b.usd - a.usd; }).slice(0, 25),
    modelos: lista(o.modelos), apps: lista(o.apps), dias: Object.keys(o.dias).sort().map(function (d) { return { d: d, usd: gastoR2_(o.dias[d]) }; }) };
}

/* ── ElevenLabs: el plan (créditos) y las conversaciones del mes, con una muestra leída una por una ── */
function gastoElCanal_(c) {
  var m = rllModo_(c, {});
  return { llamada_app: 'App de Alma', llamada_whatsapp: 'Teléfono y WhatsApp', conferencia: 'Modo conferencia', llamada_hub: 'Web (Hub)' }[m] || 'Otro';
}
function gastoElAgente_(id, nombre) {
  var p = PropertiesService.getScriptProperties();
  if (id && id === p.getProperty('ELEVENLABS_AGENT_ID')) return 'Alma';
  if (id && id === p.getProperty('CLAUDIO_AGENT_ID')) return 'Claudio';
  if (id && id === p.getProperty('ALMA_FAMILIA_AGENT_ID')) return 'Alma familia';
  return String(nombre || 'Otro agente').slice(0, 40);
}
function gastoElevenLabs_(mes, fresco) {
  var c = CacheService.getScriptCache(), ck = 'gasto_el_' + mes;
  if (!fresco) { try { var h = JSON.parse(c.get(ck) || 'null'); if (h) return h; } catch (e) {} }
  var key = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY');
  if (!key) return { ok: false, error: 'Falta la llave de ElevenLabs.' };
  var H = { 'xi-api-key': key }, R = gastoRangoMes_(mes), out = { ok: true, plan: null, conversaciones: 0, minutos: 0, agentes: {}, canales: {}, muestra: [] };
  /* Lo que ElevenLabs contestó cuando no fue 200 (código y el principio del error, sin la llave): para saber por qué falta un dato. */
  var leer = function (u, que) {
    var r = uf_(u, { headers: H, muteHttpExceptions: true }), c = r.getResponseCode(), t = r.getContentText() || '{}';
    if (c !== 200) { (out.avisos = out.avisos || []).push(que + ': HTTP ' + c + ' ' + t.slice(0, 140)); return {}; }
    try { return JSON.parse(t); } catch (e) { return {}; }
  };
  cupoFuncion_('gastoElevenLabs_');
  try {
    var s = leer('https://api.elevenlabs.io/v1/user/subscription', 'plan');
    if (s && s.tier) out.plan = { nivel: String(s.tier), creditos_usados: Number(s.character_count) || 0, creditos_limite: Number(s.character_limit) || 0,
      reinicio: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString() : '' };
  } catch (e) { (out.avisos = out.avisos || []).push('plan: ' + String(e).slice(0, 120)); }
  var lista = [], cursor = '';
  try {
    for (var i = 0; i < 8; i++) {
      var u = 'https://api.elevenlabs.io/v1/convai/conversations?page_size=100&call_start_after_unix=' + Math.floor(R.ini / 1000) + '&call_start_before_unix=' + Math.floor(Math.min(R.fin, Date.now()) / 1000) + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      var j = leer(u, 'conversaciones');
      lista = lista.concat(j.conversations || []); if (!j.has_more || !j.next_cursor) break; cursor = j.next_cursor;
    }
  } catch (e) { (out.avisos = out.avisos || []).push('conversaciones: ' + String(e).slice(0, 120)); }
  /* La muestra: las más largas del mes (son las que más pesan). Créditos reales y la parte del LLM. */
  var largas = lista.slice().sort(function (a, b) { return (b.call_duration_secs || 0) - (a.call_duration_secs || 0); }).slice(0, GASTO_EL_MUESTRA_);
  var real = {};
  largas.forEach(function (cv) {
    try {
      var d = leer('https://api.elevenlabs.io/v1/convai/conversations/' + cv.conversation_id, 'detalle');
      var md = d.metadata || {}, ch = md.charging || {};
      real[cv.conversation_id] = { creditos: Number(md.cost) || 0, llm: Number(ch.llm_charge) || 0, llm_usd: Number(ch.llm_price) || 0 };
    } catch (e) { console.error('gastoElevenLabs_ detalle: ' + e); }
  });
  /* Créditos por minuto medidos en la muestra, por agente (y en total para los que no tienen muestra). */
  var cpm = {}, tot = { cr: 0, min: 0 };
  lista.forEach(function (cv) { var r = real[cv.conversation_id]; if (!r) return; var a = gastoElAgente_(cv.agent_id, cv.agent_name), mi = (cv.call_duration_secs || 0) / 60;
    var X = cpm[a] = cpm[a] || { cr: 0, min: 0 }; X.cr += r.creditos; X.min += mi; tot.cr += r.creditos; tot.min += mi; });
  var cpmDe = function (a) { var X = cpm[a]; return X && X.min > 0.5 ? X.cr / X.min : tot.min > 0.5 ? tot.cr / tot.min : 0; };
  var llmCr = 0, crMuestra = 0;
  lista.forEach(function (cv) {
    var a = gastoElAgente_(cv.agent_id, cv.agent_name), ca = gastoElCanal_(cv), mi = (cv.call_duration_secs || 0) / 60, r = real[cv.conversation_id];
    var cr = r ? r.creditos : mi * cpmDe(a);
    if (r) { llmCr += r.llm; crMuestra += r.creditos; }
    out.conversaciones++; out.minutos += mi;
    [['agentes', a], ['canales', ca]].forEach(function (g) { var X = out[g[0]][g[1]] = out[g[0]][g[1]] || { nombre: g[1], n: 0, minutos: 0, creditos: 0 }; X.n++; X.minutos += mi; X.creditos += cr; });
    if (r) out.muestra.push({ fecha: new Date((cv.start_time_unix_secs || 0) * 1000).toISOString(), agente: a, canal: ca, minutos: Math.round(mi * 10) / 10, creditos: Math.round(cr), llm_pct: r.creditos ? Math.round(100 * r.llm / r.creditos) : null });
  });
  var orden = function (m) { return Object.keys(m).map(function (k) { var X = m[k]; return { nombre: X.nombre, n: X.n, minutos: Math.round(X.minutos), creditos: Math.round(X.creditos) }; }).sort(function (a, b) { return b.creditos - a.creditos || b.minutos - a.minutos; }); };
  out.agentes = orden(out.agentes); out.canales = orden(out.canales); out.minutos = Math.round(out.minutos);
  out.creditos_mes = out.agentes.reduce(function (s, x) { return s + x.creditos; }, 0);
  out.llm_pct = crMuestra ? Math.round(100 * llmCr / crMuestra) : null;   // de la muestra: qué parte de los créditos fue el LLM
  out.cpm = Object.keys(cpm).map(function (a) { return { agente: a, creditos_min: Math.round(cpmDe(a)) }; });
  out.muestra.sort(function (a, b) { return b.creditos - a.creditos; });
  out.actualizado = new Date().toISOString();
  try { c.put(ck, JSON.stringify(out), GASTO_EL_CACHE_MIN_ * 60); } catch (e) {}
  return out;
}

/* ── Google: lo que dicen los cupos de hoy (no es dinero; si se acaba, Alma se pausa) ── */
function gastoGoogle_() {
  try {
    var ahora = Date.now(), horas = cupoLeer_(ahora - 7 * 86400000), o = cupoCalcular_(horas), m = {};
    Object.keys(horas).forEach(function (t) { if (Number(t) >= ahora - 7 * 86400000) Object.keys(horas[t]).forEach(function (k) { m[k] = (m[k] || 0) + horas[t][k]; }); });
    return { ok: true, nivel: o.nivel, hoy_pct: Math.round(o.pctHoy || 0), usado_hoy: o.usado, limite: o.limite,
      apps_semana: Object.keys(m).map(function (k) { return { nombre: k, llamadas: m[k] }; }).sort(function (a, b) { return b.llamadas - a.llamadas; }).slice(0, 8) };
  } catch (e) { return { ok: false, error: String(e).slice(0, 120) }; }
}

/* ── El reporte del mes ── */
function gastoReporte_(mes, fresco) {
  var hoyMes = gastoMesDe_(Date.now());
  if (!/^\d{4}-\d{2}$/.test(String(mes || ''))) mes = hoyMes;
  var c = CacheService.getScriptCache(), ck = 'gasto_rep';
  if (!fresco && mes === hoyMes) { try { var h = JSON.parse(c.get(ck) || 'null'); if (h) return h; } catch (e) {} }
  var R = gastoRangoMes_(mes), actual = mes === hoyMes, transcurrido = actual ? Math.max(1, (Date.now() - R.ini) / 86400000) : R.dias;
  var planes = gastoPlanes_(), cl = gastoClaude_(mes), el = gastoElevenLabs_(mes, fresco === 'todo'), faltan = [];   // «Actualizar» rehace el reporte; ElevenLabs sigue con su caché de 3 h (cupo de Google)
  var provs = GASTO_PROV_.map(function (P) {
    var lineas = [], fijo = 0, unaVez = 0, falta = false, sinUsd = [];
    planes.filter(function (p) { return p.prov === P.id; }).forEach(function (p) {
      var v = gastoPlanEnMes_(p, mes); if (v === undefined) return;
      if (v === null) {
        /* Sin usd pero con el monto en otra moneda: se ve el monto y «falta USD» (no suma a ningún total en dólares). */
        var otra = p.moneda !== 'USD' && p.monto != null ? { monto: gastoR2_(p.tipo === 'año' ? p.monto / 12 : p.monto), moneda: p.moneda } : null;
        if (otra) sinUsd.push(otra);
        falta = true; lineas.push({ id: p.id, nombre: p.nombre, usd: null, estado: otra ? 'falta_usd' : 'falta', tipo: p.tipo, fuente: p.fuente, nota: p.nota, moneda: otra && otra.moneda, monto: otra && otra.monto }); return;
      }
      if (p.tipo === 'una_vez') unaVez += v; else fijo += v;
      lineas.push({ id: p.id, nombre: p.nombre, usd: gastoR2_(v), estado: /recibo|factura/i.test(p.fuente) ? 'medido' : 'estimado', tipo: p.tipo, fuente: p.fuente, nota: p.nota, fecha: p.fecha });
    });
    var variable = 0, estado = lineas.some(function (l) { return l.estado === 'estimado'; }) ? 'estimado' : 'medido';
    if (P.id === 'anthropic') { variable = cl.usd; lineas.push({ nombre: 'Tokens registrados (IA_USO)', usd: cl.usd, estado: 'medido', tipo: 'uso' }); }
    if (!lineas.length && /_otros$|^otros$/.test(P.id)) return null;   // «Otros» solo sale si alguien le puso algo
    if (!lineas.length) { falta = true; lineas.push({ nombre: 'Sin dato todavía', usd: null, estado: 'falta' }); }
    var usd = gastoR2_(fijo + unaVez + variable);
    /* Proyección: lo fijo entero; lo de uso (tokens y recargas) al ritmo de lo que va del mes. */
    var proy = actual ? gastoR2_(fijo + (unaVez + variable) * R.dias / transcurrido) : usd;
    if (falta) faltan.push(P.nombre);
    return { id: P.id, nombre: P.nombre, que: P.que, clase: P.clase, usd: usd, proyeccion: proy, sin_usd: sinUsd,
      estado: falta && !usd ? (sinUsd.length ? 'falta_usd' : 'falta') : falta ? 'incompleto' : estado, lineas: lineas };
  });
  provs = provs.filter(Boolean);
  /* Las dos clases nunca se mezclan: el número grande (total) es SOLO de Alma; la empresa lleva su propio total. */
  var deAlma = provs.filter(function (p) { return p.clase === 'alma'; }), deEmpresa = provs.filter(function (p) { return p.clase !== 'alma'; });
  var total = gastoR2_(deAlma.reduce(function (s, p) { return s + p.usd; }, 0)), proy = gastoR2_(deAlma.reduce(function (s, p) { return s + p.proyeccion; }, 0));
  var medido = gastoR2_(deAlma.reduce(function (s, p) { return s + p.lineas.filter(function (l) { return l.estado === 'medido'; }).reduce(function (a, l) { return a + (l.usd || 0); }, 0); }, 0));
  deAlma.forEach(function (p) { p.pct = total ? Math.round(1000 * p.usd / total) / 10 : 0; });
  deAlma.sort(function (a, b) { return b.usd - a.usd || (a.estado === 'falta') - (b.estado === 'falta'); });
  /* ElevenLabs: lo pagado del mes, repartido por créditos (estimado). */
  var E = deAlma.filter(function (p) { return p.id === 'elevenlabs'; })[0];
  if (E && el && el.ok) {
    var usdCr = el.creditos_mes ? E.usd / el.creditos_mes : 0, rep = function (l) { return l.map(function (x) { return Object.assign({}, x, { usd: usdCr ? gastoR2_(x.creditos * usdCr) : null, pct: el.creditos_mes ? Math.round(1000 * x.creditos / el.creditos_mes) / 10 : 0 }); }); };
    E.detalle = { avisos: el.avisos || [], plan: el.plan, conversaciones: el.conversaciones, minutos: el.minutos, creditos_mes: el.creditos_mes, llm_pct: el.llm_pct, cpm: el.cpm,
      usd_min: el.minutos ? gastoR2_(E.usd / el.minutos) : null, agentes: rep(el.agentes), canales: rep(el.canales),
      caras: el.muestra.slice(0, 6).map(function (x) { return Object.assign({}, x, { usd: usdCr ? gastoR2_(x.creditos * usdCr) : null }); }), actualizado: el.actualizado,
      nota: 'Lo pagado sale de los recibos; el reparto por agente y canal es estimado con los créditos de cada conversación (las más largas, leídas una por una).' };
  } else if (E) E.detalle = { error: (el && el.error) || 'Sin datos de ElevenLabs.' };
  var A = deAlma.filter(function (p) { return p.id === 'anthropic'; })[0]; if (A) A.detalle = cl;
  var G = deAlma.filter(function (p) { return p.id === 'google'; })[0]; if (G) G.detalle = gastoGoogle_();
  var CP = deAlma.filter(function (p) { return p.id === 'claude_plan'; })[0];
  if (CP) { try { var mic = microFilas_().filter(function (m) { return gastoMesDe_(m.creado instanceof Date ? m.creado : Date.parse(m.creado) || 0) === mes; }); CP.detalle = { microproyectos: mic.length, unidos: mic.filter(function (m) { return m.estado === MICRO_ESTADOS_.unido; }).length }; } catch (e) {} }
  var ant = gastoMesAnterior_(mes), previo = gastoMesLeer_(ant);
  var suma = function (l, k) { return gastoR2_(l.reduce(function (s, p) { return s + (p[k] || 0); }, 0)); };
  var sinUsdDe = function (l) { var m = {}; l.forEach(function (p) { (p.sin_usd || []).forEach(function (x) { m[x.moneda] = gastoR2_((m[x.moneda] || 0) + x.monto); }); });
    return Object.keys(m).map(function (k) { return { moneda: k, monto: m[k] }; }); };
  deEmpresa.sort(function (a, b) { return b.usd - a.usd || (b.sin_usd.length - a.sin_usd.length); });
  var bloque = function (l) { return { usd: suma(l, 'usd'), proyeccion: suma(l, 'proyeccion'), sin_usd: sinUsdDe(l),
    faltan: l.filter(function (p) { return p.estado === 'falta' || p.estado === 'falta_usd' || p.estado === 'incompleto'; }).map(function (p) { return p.nombre; }), proveedores: l }; };
  var empresa = Object.assign(bloque(deEmpresa), { titulo: GASTO_CLASES_.empresa, nota: 'Gastos de Spacio AM como empresa. No suman al gasto de Alma.',
    partes: ['desarrollo', 'operacion'].map(function (k) { return Object.assign(bloque(deEmpresa.filter(function (p) { return p.clase === k; })), { clase: k, titulo: GASTO_CLASES_[k], que: GASTO_CLASES_QUE_[k] }); }) });
  var empUsd = empresa.usd;
  var rep = { ok: true, mes: mes, actual: actual, actualizado: new Date().toISOString(), dia: Math.floor(transcurrido), dias_mes: R.dias,
    titulo: GASTO_CLASES_.alma,
    total: { usd: total, proyeccion: proy, medido: medido, estimado: gastoR2_(total - medido), faltan: faltan.filter(function (n) { return deAlma.some(function (p) { return p.nombre === n; }); }) },
    mes_anterior: previo ? { mes: ant, usd: previo.total_usd } : { mes: ant, usd: null },
    proveedores: deAlma, empresa: empresa,
    general: { usd: gastoR2_(total + empUsd), proyeccion: gastoR2_(proy + empresa.proyeccion), sin_usd: empresa.sin_usd.concat(sinUsdDe(deAlma)), nota: 'Solo como referencia: Alma + empresa.' },
    ahorro: gastoAhorroLista_(), url: GASTO_URL_ };
  if (actual) { try { c.put(ck, JSON.stringify(rep), GASTO_CACHE_MIN_ * 60); } catch (e) {} try { gastoMesGuardar_(rep); } catch (e) { console.error('gastoMesGuardar_: ' + e); } }
  return rep;
}
/* La hoja privada GASTO_MES: una fila por mes (se reescribe la del mes en curso). */
function gastoMesHoja_() { return hojaCrear_('GASTO_MES', GASTO_MES_CAB_); }
function gastoMesLeer_(mes) {
  var sh = ssAlma_().getSheetByName('GASTO_MES'); if (!sh || sh.getLastRow() < 2) return null;
  var f = sh.getRange(2, 1, sh.getLastRow() - 1, GASTO_MES_CAB_.length).getValues().filter(function (r) { return String(r[0]) === mes; })[0];
  return f ? { mes: mes, total_usd: Number(f[2]) || 0 } : null;
}
function gastoMesGuardar_(rep) {
  var sh = gastoMesHoja_(), n = sh.getLastRow(), fila = -1;
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { if (String(r[0]) === rep.mes) fila = i + 2; });
  var v = [rep.mes, new Date(), rep.total.usd, rep.total.medido, rep.total.estimado, rep.total.faltan.join(', '),
    JSON.stringify(rep.proveedores.map(function (p) { return { id: p.id, usd: p.usd, estado: p.estado }; }))];
  if (fila > 0) sh.getRange(fila, 1, 1, v.length).setValues([v]); else sh.appendRow(v);
}

/* ── Para la pantalla (solo el administrador principal) ── */
function gastoApi_(ses, body) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal ve el gasto de Alma.' };
  return gastoReporte_(body && body.mes, !!(body && body.fresco));
}
/* Juan escribe o corrige un monto en la pantalla: { id?, prov, nombre, tipo, usd, desde?, fecha?, fuente? } o { quitar: id }. */
function gastoPlanFijarApi_(ses, b) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal cambia la tabla de gastos.' };
  return gastoPlanFijar_(b || {});
}
function gastoPlanFijar_(b) {
  var l = gastoPlanes_();
  if (b.quitar) { l = l.filter(function (p) { return p.id !== String(b.quitar); }); gastoPlanesGuardar_(l); return { ok: true, planes: l }; }
  if (!GASTO_PROV_.some(function (P) { return P.id === b.prov; })) return { ok: false, error: 'No conozco ese proveedor.' };
  var usd = b.usd === '' || b.usd == null ? null : Number(String(b.usd).replace(',', '.'));
  if (usd != null && !(usd >= 0 && usd < 100000)) return { ok: false, error: 'El monto no es un número válido.' };
  var p = { id: String(b.id || ('p' + Date.now().toString(36))), prov: b.prov, nombre: String(b.nombre || 'Plan').slice(0, 60), tipo: b.tipo === 'una_vez' ? 'una_vez' : /^a/.test(b.tipo || '') ? 'año' : 'mes',
    usd: usd, moneda: /^[A-Za-z]{3}$/.test(b.moneda || '') ? String(b.moneda).toUpperCase() : 'USD', monto: b.monto === '' || b.monto == null || !isFinite(Number(String(b.monto).replace(',', '.'))) ? '' : Number(String(b.monto).replace(',', '.')), desde: String(b.desde || ''), hasta: String(b.hasta || ''), fecha: String(b.fecha || ''), fuente: String(b.fuente || 'Juan en la pantalla').slice(0, 60), nota: String(b.nota || '').slice(0, 200) };
  var i = -1; l.forEach(function (x, k) { if (x.id === p.id) i = k; });
  if (i >= 0) l[i] = p; else l.push(p);
  gastoPlanesGuardar_(l);
  return { ok: true, plan: p };
}

/* ── Para Alma (herramienta gasto_alma, voz y chat) ── corto: el número, la proyección y lo que más pesa. */
function gastoParaAlma_(adm) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal ve el gasto de Alma.' };
  var r = gastoReporte_();
  return { ok: true, mes: r.mes, gastado_hasta_hoy_usd: r.total.usd, proyeccion_fin_de_mes_usd: r.total.proyeccion, mes_pasado_usd: r.mes_anterior.usd,
    lo_que_mas_pesa: r.proveedores.slice(0, 3).map(function (p) { return { nombre: p.nombre, usd: p.usd, pct: p.pct }; }), falta_dato_de: r.total.faltan,
    gasto_de_empresa_aparte: r.empresa.partes.map(function (x) { return { clase: x.titulo, usd: x.usd, sin_usd: x.sin_usd, que: x.proveedores.map(function (p) { return p.nombre; }) }; }),
    ahorro_en_curso: (r.ahorro || []).filter(function (x) { return x.estado !== 'descartado'; }).length, detalle: GASTO_URL_,
    nota: 'Dilo simple: el número grande primero («este mes Alma va en X dólares; a este ritmo cerramos en Y»), luego lo que más pesa. Si falta dato de algo, dilo. El plan de Claude, Apple, Higgsfield (desarrollo) y Hospitable (operación) NO son gasto de Alma: si los nombras, di que son gasto de Spacio AM como empresa, aparte. El detalle está en Ajustes → Gasto de Alma.' };
}

/* ═══ EQUIPO DE AHORRO · PARETO 80/20 ═══════════════════════════════════════════════════════════════════════════════
   Cada lunes (desde las 9, una vez) toma lo que se gasta POR USO (tokens de Claude por función y ElevenLabs por agente y
   canal), lo ordena de mayor a menor y se queda con lo poco que suma el 80 %. Para cada lugar sin un proyecto abierto
   abre un microproyecto de reducción (máximo GASTO_PARETO_MAX_ por semana) por la rutina de Claude de siempre
   (paraClaudeCrear_), con su hipótesis, el ahorro esperado y CÓMO se mide la calidad.
   Regla dura (Juan): «si deterioramos la calidad, no es un buen proyecto». Ningún PR de ahorro se une sin la sección
   «Compuerta de calidad» (antes y después sobre casos reales, mismo resultado útil, veredicto igual o mejor): lo revisa
   la máquina (.github/gasto-calidad.js en «Revisar estándares») y con ese check en rojo nadie lo une (unir.js no une en
   «fallo»). Los planes fijos no entran: bajarlos es decisión de Juan.
   La pantalla muestra cada proyecto con su ahorro medido y la calidad verificada (lo lee del PR: «Ahorro medido: N %»,
   «Veredicto: igual|mejor|peor»). En GitHub (público) solo van porcentajes, nunca montos.
   GASTO_PARETO = 0 en las propiedades lo apaga sin un PR. */
var GASTO_AHORRO_CAB_ = ['id', 'creado', 'lugar', 'tipo', 'pct_gasto', 'usd_30d', 'hipotesis', 'ahorro_esperado_pct', 'calidad_como', 'micro', 'issue', 'pr', 'estado', 'ahorro_medido_pct', 'calidad', 'actualizado'];
var GASTO_PARETO_MAX_ = 2, GASTO_PARETO_CORTE_ = 80;
function gastoAhorroHoja_() { return hojaCrear_('GASTO_AHORRO', GASTO_AHORRO_CAB_); }
function gastoAhorroFilas_() {
  var sh = ssAlma_().getSheetByName('GASTO_AHORRO'); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, GASTO_AHORRO_CAB_.length).getValues().map(function (r, i) { var o = { fila: i + 2 }; GASTO_AHORRO_CAB_.forEach(function (k, j) { o[k] = r[j]; }); return o; });
}
function gastoAhorroLista_() {
  try {
    return gastoAhorroFilas_().map(function (x) { return { id: String(x.id), lugar: String(x.lugar), tipo: String(x.tipo), pct_gasto: Number(x.pct_gasto) || 0, hipotesis: String(x.hipotesis),
      ahorro_esperado_pct: Number(x.ahorro_esperado_pct) || 0, calidad_como: String(x.calidad_como), estado: String(x.estado || 'propuesto'), pr: String(x.pr || ''),
      ahorro_medido_pct: x.ahorro_medido_pct === '' ? null : Number(x.ahorro_medido_pct), calidad: String(x.calidad || 'pendiente'), usd_30d: Number(x.usd_30d) || 0 }; }).reverse().slice(0, 20);
  } catch (e) { return []; }
}
/* Los lugares de gasto por uso, de mayor a menor, y los que suman el 80 %. */
function gastoParetoLugares_() {
  /* Solo el gasto de Alma (agente): la empresa (Hospitable…) nunca entra al equipo de ahorro. */
  if (gastoClase_('anthropic') !== 'alma' || gastoClase_('elevenlabs') !== 'alma') return { total: 0, lugares: [], top: [] };
  var hoy = gastoMesDe_(Date.now()), lug = [];
  [gastoMesAnterior_(hoy), hoy].forEach(function (mes) { gastoClaude_(mes).funciones.forEach(function (f) { lug.push({ lugar: 'Claude · ' + f.nombre, tipo: 'claude', usd: f.usd, modelo: f.modelo }); }); });
  var r = gastoReporte_(), E = r.proveedores.filter(function (p) { return p.id === 'elevenlabs' && p.clase === 'alma'; })[0];
  if (E && E.detalle && E.detalle.agentes) {
    /* agente × canal no viene cruzado: se usa por agente y, para Alma, por canal (lo que más pesa es Alma). */
    (E.detalle.canales || []).forEach(function (c) { if (c.usd) lug.push({ lugar: 'ElevenLabs · ' + c.nombre, tipo: 'elevenlabs', usd: c.usd }); });
  }
  var m = {}; lug.forEach(function (x) { var k = x.lugar; m[k] = m[k] || { lugar: k, tipo: x.tipo, usd: 0, modelo: x.modelo }; m[k].usd += x.usd; });
  var L = Object.keys(m).map(function (k) { return m[k]; }).filter(function (x) { return x.usd > 0; }).sort(function (a, b) { return b.usd - a.usd; });
  var tot = L.reduce(function (s, x) { return s + x.usd; }, 0), acum = 0, top = [];
  L.forEach(function (x) { x.pct = tot ? Math.round(1000 * x.usd / tot) / 10 : 0; if (acum < GASTO_PARETO_CORTE_) top.push(x); acum += x.pct; });
  return { total: gastoR2_(tot), lugares: L.slice(0, 30), top: top };
}
function gastoParetoSiToca_() {
  var P = PropertiesService.getScriptProperties(), ahora = new Date();
  if (P.getProperty('GASTO_PARETO') === '0') return;
  if (Utilities.formatDate(ahora, CFG.TZ, 'u') !== '1' || +Utilities.formatDate(ahora, CFG.TZ, 'H') < 9) return;
  var hoy = Utilities.formatDate(ahora, CFG.TZ, 'yyyy-MM-dd'); if (P.getProperty('GASTO_PARETO_DIA') === hoy) return;
  P.setProperty('GASTO_PARETO_DIA', hoy);
  try { gastoAhorroSincronizar_(); } catch (e) { console.error('gastoAhorroSincronizar_: ' + e); }
  try { gastoPareto_(false); } catch (e) { console.error('gastoPareto_: ' + e); }
}
/* seco = true: solo dice qué abriría (robot «gasto_pareto»). */
function gastoPareto_(seco) {
  var p = gastoParetoLugares_(), filas = gastoAhorroFilas_(), abiertos = {};
  filas.forEach(function (x) { if (!/descartado|unido/.test(String(x.estado))) abiertos[String(x.lugar)] = true; });
  var nuevos = p.top.filter(function (x) { return !abiertos[x.lugar]; }).slice(0, GASTO_PARETO_MAX_), hechos = [];
  nuevos.forEach(function (x) {
    var prop = gastoAhorroPropuesta_(x);
    if (seco) { hechos.push(prop); return; }
    var adm = agPrincipal_(), r = { ok: false };
    try { r = paraClaudeCrear_(adm, { titulo: 'Ahorro · ' + x.lugar.slice(0, 80), nombre: 'Ahorro · ' + x.lugar.slice(0, 50), que_quiere: JSON.stringify(prop.pedido), resumen: prop.resumen, app: 'Hub', tipo: 'mejora', nivel: 'complejo', canal: 'pareto', sinChat: true }); }
    catch (e) { r = { ok: false, error: String(e) }; }
    gastoAhorroHoja_().appendRow([prop.id, new Date(), x.lugar, x.tipo, x.pct, gastoR2_(x.usd), prop.hipotesis, prop.ahorro_esperado_pct, prop.calidad_como,
      (r.micro && r.micro.id) || '', r.issue || '', '', r.ok ? 'en trabajo' : 'propuesto', '', 'pendiente', new Date()]);
    hechos.push({ lugar: x.lugar, ok: !!r.ok, issue: r.issue || '' });
  });
  return { ok: true, total_por_uso_usd: p.total, top_80: p.top.map(function (x) { return { lugar: x.lugar, pct: x.pct }; }), abiertos: hechos, seco: !!seco };
}
/* La propuesta de un lugar: hipótesis, ahorro esperado y cómo se mide la calidad. El pedido a Claude va en JSON y SIN montos
   (el issue es público): solo el porcentaje del gasto por uso. */
function gastoAhorroPropuesta_(x) {
  var el = x.tipo === 'elevenlabs';
  var hip = el ? 'Bajar los créditos por minuto de «' + x.lugar + '» sin que la llamada cambie para quien habla: menos turnos de relleno y silencios cobrados, menos contexto repetido por turno y herramientas que respondan más corto.'
    : 'Bajar los tokens de «' + x.lugar + '» sin cambiar lo que entrega: no mandar contexto que no usa, aprovechar la caché del prompt fijo y no llamar a la IA cuando la respuesta ya se conoce.';
  var esperado = el ? 15 : 25;
  var cal = el ? 'Las mismas 10 tareas reales de las últimas 2 semanas (de la hoja de llamadas), antes y después: mismo pedido resuelto, mismos datos dichos, sin más cortes ni silencios largos y misma duración o menos; Juan escucha 3 de cada lado.'
    : 'Los mismos 20 casos reales de las últimas 2 semanas (de IA_USO y su hoja), con la versión de hoy y la nueva: mismo resultado útil en al menos 19 de 20 y ninguno peor en algo que vea un huésped o Juan.';
  var id = 'ah' + Date.now().toString(36) + Math.floor(Math.random() * 1e3);
  return { id: id, hipotesis: hip, ahorro_esperado_pct: esperado, calidad_como: cal,
    resumen: 'Proyecto de ahorro: «' + x.lugar + '» es el ' + x.pct + ' % del gasto por uso. Bajarlo sin perder calidad.',
    pedido: { rol: 'Desarrollador del equipo de ahorro de Alma (Pareto 80/20).',
      tarea: 'Microproyecto de reducción de gasto: «' + x.lugar + '», que hoy es el ' + x.pct + ' % del gasto por uso de Alma. Reducirlo sin bajar la calidad.',
      contexto: { lugar: x.lugar, pct_del_gasto_por_uso: x.pct, hipotesis: hip, ahorro_esperado_pct: esperado, como_se_mide_la_calidad: cal, id_ahorro: id,
        fuente: 'Pantalla Gasto de Alma (alma/gasto.html) y apps-script/gasto.js; tokens en IA_USO, llamadas en ElevenLabs.' },
      pasos: ['Mide la línea base con datos reales (créditos o tokens por uso) y guarda los casos de prueba de la compuerta de calidad.',
        'Haz el cambio más chico que logre la hipótesis.',
        'Corre la comparación antes y después con los MISMOS casos reales y anota caso por caso si el resultado útil es igual, mejor o peor.',
        'Abre el PR con título que empiece con «Ahorro ·» y la sección «## Compuerta de calidad» con las líneas «Antes:», «Después:», «Veredicto: igual|mejor|peor» y «Ahorro medido: N %».',
        'Si algún caso sale peor en algo que vea un huésped o Juan, el veredicto es «peor»: cierra el PR sin unir y responde «descartado: …».'],
      restricciones: ['Si deterioramos la calidad, no es un buen proyecto: nada se une sin la compuerta de calidad en verde.',
        'Ningún monto en GitHub (el repo es público): solo porcentajes.',
        'No cambies en ElevenLabs end_call, guardrails, LLM ni voz sin evidencia de llamadas reales (memoria del proyecto).',
        'El tope del prompt de voz es 42 800 caracteres: si agregas, recorta.',
        'Sin datos personales de huéspedes en el PR ni en el issue.'],
      formato_de_respuesta: 'PR con la plantilla (Resumen · Evidencia antes y después · Compuerta de calidad · Peligros al unir · Cómo probarlo) y, al responder, una línea: «Ahorro medido: N % · Calidad: igual|mejor|peor».' } };
}
/* Lee de cada proyecto su microproyecto y su PR: estado, ahorro medido y veredicto de calidad. */
function gastoAhorroSincronizar_() {
  var sh = ssAlma_().getSheetByName('GASTO_AHORRO'); if (!sh) return { ok: true, n: 0 };
  var n = 0;
  gastoAhorroFilas_().forEach(function (x) {
    if (/descartado|unido/.test(String(x.estado)) || !x.micro) return;
    var m = null; try { m = microLeer_(String(x.micro)); } catch (e) {}
    if (!m) return;
    var pr = m.pr || String(x.pr || ''), est = String(x.estado), med = x.ahorro_medido_pct, cal = String(x.calidad || 'pendiente');
    var mm = /github\.com\/([^\/]+\/[^\/]+)\/pull\/(\d+)/.exec(pr);
    if (mm) {
      var d = unirGh_('get', '/repos/' + mm[1] + '/pulls/' + mm[2]).j || {}, cuerpo = String(d.body || '');
      var v = gastoCompuerta_(cuerpo);
      if (v.veredicto) cal = v.veredicto;
      if (v.ahorro != null) med = v.ahorro;
      est = d.merged_at ? 'unido' : d.state === 'closed' ? 'descartado' : v.veredicto === 'peor' ? 'descartado' : 'en revisión';
    } else if (m.estado === MICRO_ESTADOS_.cerrado) est = 'descartado';
    sh.getRange(x.fila, 12, 1, 5).setValues([[pr, est, med === '' || med == null ? '' : med, cal, new Date()]]); n++;
  });
  return { ok: true, n: n };
}
/* Lo que la compuerta lee de un PR (la misma regla que .github/gasto-calidad.js). */
function gastoCompuerta_(cuerpo) {
  cuerpo = String(cuerpo || '');
  var sec = /^#{2,}\s*compuerta de calidad\b([\s\S]*?)(?=^#{2}\s|$(?![\s\S]))/im.exec(cuerpo), s = sec ? sec[1] : '';
  var ver = /veredicto\s*:\s*\**\s*(igual|mejor|peor)/i.exec(s), ah = /ahorro medido\s*:\s*\**\s*(-?\d+(?:[.,]\d+)?)\s*%/i.exec(s);
  return { hay: !!sec, antes: /^\s*[-*]?\s*\**antes\**\s*:/im.test(s), despues: /^\s*[-*]?\s*\**despu[eé]s\**\s*:/im.test(s),
    veredicto: ver ? ver[1].toLowerCase() : '', ahorro: ah ? Number(ah[1].replace(',', '.')) : null };
}
