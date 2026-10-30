/* ═══ PENDIENTES DE ALMA (app de Alma: botón «Pendientes») ═════════════════════════════════════════════════
   Todo lo que Alma resuelve para el administrador principal queda aquí, con su esfera (las 6 del inicio) y su proyecto,
   en vez de llegarle por WhatsApp (el WhatsApp con Alma es solo para conversar). Tres tipos:
     · atencion  «Necesita tu sí»: comprar, decidir, responder, unir. Se queda hasta que Juan toca «Ya está» o lo
                 resuelven en una llamada (retomar.js). Si vino de segundo plano, avisa con notificación en la app.
     · aviso     «Para leer»: información que pidió. Se va sola a la hora.
     · hecho     «Listo hoy»: confirma algo que ya quedó. Se va solo a la hora.
   Entra por pendEncolar_ (cada pedido a Alma: chat, WhatsApp, llamada, segundo plano; se clasifica en procesarCola para
   no frenar la respuesta) o por pendAvisar_ (encargos, Claude, correos, entregas, programados).
   Algunos traen tarjeta (un vuelo: ruta, fecha, aerolínea, precio) y acciones («Comprar» abre la página; Juan paga ahí).
   Hoja ALMA_PENDIENTES. */
var PEND_CAB_ = ['id', 'ts', 'email', 'tipo', 'area', 'proyecto', 'titulo', 'resumen', 'detalle', 'tarjeta', 'acciones', 'estado', 'origen', 'ret_id', 'importancia'];
var PEND_HORA_ = 3600000;
var PEND_TIPOS_ = ['atencion', 'aviso', 'hecho'];

function hojaPend_() {
  var sh = hojaCrear_('ALMA_PENDIENTES', PEND_CAB_);
  if (sh.getLastColumn() < PEND_CAB_.length) sh.getRange(1, 1, 1, PEND_CAB_.length).setValues([PEND_CAB_]);
  return sh;
}
function pendFilas_() {
  var sh = hojaPend_(), n = sh.getLastRow(); if (n < 2) return [];
  var ini = Math.max(2, n - 299);   // los últimos 300 bastan: lo viejo ya venció o se resolvió
  return sh.getRange(ini, 1, n - ini + 1, PEND_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: ini + i }; PEND_CAB_.forEach(function (k, j) { o[k] = v[j]; }); o.ts = Number(o.ts) || 0; return o;
  });
}

/* ── Entrada 1: cada pedido a Alma (en cola; se clasifica en procesarCola) ── */
function pendEncolar_(adm, pedido, respuesta, canal) {
  if (!adm || !adm.email || !esAdminPrincipal_(adm) || !String(respuesta || '').trim()) return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var p = PropertiesService.getScriptProperties(), cola = []; try { cola = JSON.parse(p.getProperty('PEND_COLA') || '[]'); } catch (e) {}
    cola.push({ email: adm.email, pedido: String(pedido || '').slice(0, 1500), respuesta: String(respuesta).slice(0, 3500), canal: canal || '', t: Date.now() });
    p.setProperty('PEND_COLA', JSON.stringify(cola.slice(-25)));
  } finally { lock.releaseLock(); }
}
function pendProcesar_() {
  var p = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock(), cola = [];
  if (!lock.tryLock(5000)) return;
  try { try { cola = JSON.parse(p.getProperty('PEND_COLA') || '[]'); } catch (e) {} if (cola.length) p.deleteProperty('PEND_COLA'); } finally { lock.releaseLock(); }
  cola.slice(0, 8).forEach(function (x) {
    var adm = adminPorEmail_(x.email); if (!adm) return;
    try { pendCrear_(adm, pendClasificar_(x.pedido, x.respuesta, ''), { origen: x.canal, detalle: x.respuesta, push: x.canal === 'segundo_plano' }); }
    catch (e) { console.error('pendProcesar_: ' + e); }
  });
}

/* ── Entrada 2: avisos que no salen de un pedido (encargos, Claude, correos…) ──
   Devuelve true si quedó en Pendientes (es el principal): entonces no se manda por WhatsApp. */
function pendAvisar_(adm, texto, o) {
  o = o || {};
  if (!adm || !adm.email || !esAdminPrincipal_(adm) || !String(texto || '').trim()) return false;
  try {
    var c = o.clasif || pendClasificar_(o.pedido || '', texto, o.fallo || '');
    if (o.tipo) c.tipo = o.tipo; if (o.area) c.area = o.area; if (o.proyecto) c.proyecto = o.proyecto;
    if (c.tipo === 'nada') c.tipo = 'aviso';
    pendCrear_(adm, c, { origen: o.origen || '', detalle: texto, push: o.push !== false });
    return true;
  } catch (e) { console.error('pendAvisar_: ' + e); return false; }
}

/* El clasificador: esfera, proyecto, tipo y, si hay algo que comprar o reservar, la tarjeta y su enlace. */
function pendClasificar_(pedido, respuesta, fallo) {
  var proys = []; try { proys = proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }).map(function (p) { return p.proyecto; }).slice(0, 30); } catch (e) {}
  var sys = 'Eres Alma, la asistente de Juan (dueño de Spacio AM, apartamentos de estadía corta en Guatemala). Le resolviste un pedido; ordénalo para su lista de pendientes.\n' +
    'tipo: "atencion" si necesita algo de él (decidir, elegir, comprar, aprobar, responder, o algo falló); "aviso" si es información que pidió y no hay nada que hacer; ' +
    '"hecho" si solo confirma algo que ya quedó hecho; "nada" si es charla, un saludo o no hay resultado.\n' +
    'area (una): proposito (su trabajo: Spacio AM, apartamentos, huéspedes, equipo, proveedores, desarrollo de las apps), relaciones (familia, pareja, amigos, bodas y viajes con ellos), ' +
    'finanzas (dinero, pagos, facturas, impuestos), health (salud, ejercicio, sueño, comida), comunidad (ayudar a otros, grupos), espiritualidad (fe, calma, meditación).\n' +
    'proyecto: el nombre corto del proyecto. Si es uno de estos, escríbelo igual: ' + (proys.join(' · ') || '(ninguno)') + '. Si es de Spacio AM y no hay otro, «Spacio AM». Si no hay, "".\n' +
    'titulo: 2 a 6 palabras. resumen: 1 frase corta y simple con lo importante (cifras incluidas). aviso: cómo se lo dirías al oído, 1 o 2 frases sin enlaces. importancia: 3 urgente o con dinero/fechas cercanas, 2 normal, 1 puede esperar.\n' +
    'tarjeta: si el resultado es un VUELO concreto, {"tipo":"vuelo","desde":"MAD","desde_ciudad":"Madrid","hasta":"SLC","hasta_ciudad":"Salt Lake City","fecha":"2026-12-12","aerolinea":"Delta","precio":763,"moneda":"USD","extra":"+ auto $250","alternativa":"Desde Valencia: $910"} ' +
    '(códigos IATA de 3 letras; deja "" lo que no sepas). Si es otra opción para comprar o reservar (hotel, auto, producto), {"tipo":"compra","nombre":"…","precio":0,"moneda":"USD","detalle":"…"}. Si no, null.\n' +
    'acciones: botones, máximo 2, [{"texto":"Comprar","url":"…"}], SOLO con enlaces que aparezcan en el resultado; si no hay enlace, [].\n' +
    'Responde SOLO JSON: {"tipo":"…","area":"…","proyecto":"…","titulo":"…","resumen":"…","aviso":"…","importancia":2,"tarjeta":null,"acciones":[]}';
  var usr = 'PEDIDO: ' + String(pedido || '(aviso de Alma)').slice(0, 1500) + '\n\nRESULTADO: ' + String(respuesta || '').slice(0, 3500) + (fallo ? '\n\nOJO, FALLÓ: ' + fallo : '');
  var j = null;
  try { var t = String(claude_(CFG.MODELO_CLASIFICADOR, 600, sys, usr, 0) || ''), m = /\{[\s\S]*\}/.exec(t); j = m ? JSON.parse(m[0]) : null; } catch (e) { console.error('pendClasificar_: ' + e); }
  j = j || { tipo: fallo ? 'atencion' : 'aviso', area: 'proposito', proyecto: '', titulo: String(pedido || respuesta).slice(0, 40), resumen: String(respuesta).replace(/\s+/g, ' ').slice(0, 160), aviso: '', importancia: 2 };
  if (j.tipo !== 'nada' && PEND_TIPOS_.indexOf(j.tipo) < 0) j.tipo = 'aviso';
  if (!areaOk_(j.area)) j.area = 'proposito';
  j.importancia = Math.max(1, Math.min(3, Number(j.importancia) || 2));
  j.acciones = (Array.isArray(j.acciones) ? j.acciones : []).filter(function (a) { return a && /^https:\/\//.test(String(a.url || '')); }).slice(0, 2);
  if (j.tarjeta && j.tarjeta.tipo === 'vuelo' && !j.acciones.length) {
    var u = pendVueloUrl_(j.tarjeta); if (u) j.acciones = [{ texto: 'Comprar', url: u }];
  }
  return j;
}
/* Sin enlace en el resultado: Google Flights con la ruta y la fecha ya puestas (Juan elige la tarifa y paga ahí). */
function pendVueloUrl_(v) {
  var a = String(v.desde || '').toUpperCase(), b = String(v.hasta || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(a) || !/^[A-Z]{3}$/.test(b)) return '';
  return 'https://www.google.com/travel/flights?hl=es&curr=' + encodeURIComponent(v.moneda || 'USD') + '&q=' + encodeURIComponent('Vuelos de ' + a + ' a ' + b + (v.fecha ? ' el ' + v.fecha : '') + ' solo ida');
}

function pendCrear_(adm, c, o) {
  if (!c || c.tipo === 'nada') return null;
  var it = null;
  /* Lo que necesita a Juan también queda como tema por retomar (Alma empieza por ahí en la próxima llamada). */
  if (c.tipo === 'atencion' && o.push) {
    try { it = retPoner_(adm, { texto: c.aviso || c.resumen, detalle: o.detalle, importancia: c.importancia, origen: o.origen }); vozAvisoPoner_(adm, c.aviso || c.resumen, it && it.id); } catch (e) { console.error('pendCrear_ aviso: ' + e); }
  }
  var fila = { id: 'pd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), ts: Date.now(), email: adm.email, tipo: c.tipo, area: c.area, proyecto: String(c.proyecto || '').slice(0, 60),
    titulo: String(c.titulo || '').slice(0, 80), resumen: String(c.resumen || '').slice(0, 300), detalle: String(o.detalle || '').slice(0, 4000),
    tarjeta: c.tarjeta ? JSON.stringify(c.tarjeta).slice(0, 1500) : '', acciones: JSON.stringify(c.acciones || []), estado: 'abierto', origen: o.origen || '', ret_id: it ? it.id : '', importancia: c.importancia || 2 };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { hojaPend_().appendRow(PEND_CAB_.map(function (k) { return fila[k]; })); } finally { lock.releaseLock(); }
  return fila;
}

/* ¿Sigue en la lista? Lo de atención, hasta resolverse (o 30 días); lo demás, una hora. */
function pendVivo_(x, ahora) {
  if (String(x.estado) !== 'abierto') return false;
  return x.tipo === 'atencion' ? ahora - x.ts < 30 * 86400000 : ahora - x.ts < PEND_HORA_;
}
function pendResolver_(ses, id) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  var x = pendFilas_().filter(function (r) { return String(r.id) === String(id); })[0]; if (!x) return { ok: false, error: 'no existe' };
  hojaPend_().getRange(x.fila, PEND_CAB_.indexOf('estado') + 1).setValue('resuelto');
  if (x.ret_id) { try { retResolver_(adminPorEmail_(x.email), [String(x.ret_id)]); } catch (e) {} }
  return { ok: true };
}
/* Si un tema por retomar se resolvió en una llamada, su pendiente también. */
function pendResolverRet_(ids) {
  if (!ids || !ids.length) return;
  try { var sh = hojaPend_(), col = PEND_CAB_.indexOf('estado') + 1; pendFilas_().forEach(function (x) { if (x.ret_id && ids.indexOf(String(x.ret_id)) >= 0 && x.estado === 'abierto') sh.getRange(x.fila, col).setValue('resuelto'); }); } catch (e) {}
}

/* ── La lista para la app: los de Alma + lo de Claude + los cambios por unir, por urgencia y con conteo por esfera ── */
var PEND_SECCION_ = { atencion: 'atencion', aviso: 'leer', hecho: 'listo' };
function pendientesTodo_(ses) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  var ahora = Date.now(), items = [];
  pendFilas_().forEach(function (x) {
    if (String(x.email).toLowerCase() !== String(adm.email).toLowerCase() || !pendVivo_(x, ahora)) return;
    var tj = null, ac = []; try { tj = x.tarjeta ? JSON.parse(x.tarjeta) : null; } catch (e) {} try { ac = JSON.parse(x.acciones || '[]'); } catch (e) {}
    items.push({ id: String(x.id), fuente: 'alma', seccion: PEND_SECCION_[x.tipo] || 'leer', area: x.area, proyecto: x.proyecto, titulo: x.titulo, resumen: x.resumen,
      detalle: x.detalle, tarjeta: tj, acciones: ac, ts: x.ts, importancia: Number(x.importancia) || 2, resolver: x.tipo === 'atencion' });
  });
  /* Lo de Claude y los cambios por unir: Propósito · Desarrollo */
  var claude = []; try { var rc = paraClaudePendientes_(ses); claude = rc.ok ? rc.lista : []; } catch (e) { console.error('pendientesTodo_ claude: ' + e); }
  claude.forEach(function (p) {
    var sec = (p.unir || []).length || p.estado === 'pregunta' || p.estado === 'fallo' || p.estado === 'fallo_pub' ? 'atencion' : p.estado === 'publicado' ? 'listo' : 'leer';
    items.push({ id: p.id, fuente: p.pr ? 'pr' : 'claude', seccion: sec, area: 'proposito', proyecto: 'Desarrollo', titulo: p.titulo, resumen: p.resumen, etiqueta: p.fecha, estado: p.estado,
      pasos: p.pasos, pregunta: p.pregunta, original: p.original, enlaces: p.enlaces, unir: p.unir, progreso: p.progreso, ts: 0, importancia: 2, hecho: !p.pr });
  });
  var orden = function (a, b) { return (b.importancia - a.importancia) || (b.ts - a.ts); };
  var areas = AREAS_.map(function (a) { return { k: a.k, n: a.n, total: items.filter(function (x) { return x.area === a.k; }).length,
    atencion: items.filter(function (x) { return x.area === a.k && x.seccion === 'atencion'; }).length }; });
  return { ok: true, areas: areas, total: items.length,
    atencion: items.filter(function (x) { return x.seccion === 'atencion'; }).sort(orden),
    leer: items.filter(function (x) { return x.seccion === 'leer'; }).sort(orden),
    listo: items.filter(function (x) { return x.seccion === 'listo'; }).sort(orden) };
}
