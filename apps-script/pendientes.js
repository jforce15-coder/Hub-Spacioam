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
    'tipo: "atencion" SOLO si Juan tiene que hacer algo él mismo (decidir, elegir, comprar, aprobar, responder, darte un dato, o algo falló y sin él no se puede seguir); "aviso" si es información o un resultado y no tiene que hacer nada (ante la duda entre atencion y aviso, aviso); ' +
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
    try { it = retPoner_(adm, { texto: c.aviso || c.resumen, tema: c.titulo, detalle: o.detalle, importancia: c.importancia, origen: o.origen }); vozAvisoPoner_(adm, c.aviso || c.resumen, it && it.id); } catch (e) { console.error('pendCrear_ aviso: ' + e); }
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
/* Todo lo de Juan (lo que Alma resolvió, lo de Claude y los cambios por unir), cada uno con su sección. */
function pendItems_(ses, adm, noti) {
  var ahora = Date.now(), items = [];
  pendFilas_().forEach(function (x) {
    /* en Notificaciones, lo que es para leer o ya quedó listo se queda 3 días (como el historial de avisos) */
    var vivo = pendVivo_(x, ahora) || (noti && String(x.estado) === 'abierto' && x.tipo !== 'atencion' && ahora - x.ts < 3 * 86400000);
    if (String(x.email).toLowerCase() !== String(adm.email).toLowerCase() || !vivo) return;
    var tj = null, ac = []; try { tj = x.tarjeta ? JSON.parse(x.tarjeta) : null; } catch (e) {} try { ac = JSON.parse(x.acciones || '[]'); } catch (e) {}
    items.push({ id: String(x.id), fuente: 'alma', seccion: PEND_SECCION_[x.tipo] || 'leer', area: x.area, proyecto: x.proyecto, titulo: x.titulo, resumen: x.resumen,
      detalle: x.detalle, tarjeta: tj, acciones: ac, ts: x.ts, importancia: Number(x.importancia) || 2, resolver: x.tipo === 'atencion', responder: x.tipo === 'atencion' });
  });
  /* Lo de Claude y los cambios por unir: Propósito · Desarrollo */
  var claude = []; try { var rc = paraClaudePendientes_(ses); claude = rc.ok ? rc.lista : []; } catch (e) { console.error('pendientesTodo_ claude: ' + e); }
  claude.forEach(function (p) {
    var sec = (p.unir || []).length || p.estado === 'pregunta' || p.estado === 'fallo' || p.estado === 'fallo_pub' ? 'atencion' : p.estado === 'publicado' ? 'listo' : 'leer';
    items.push({ id: p.id, fuente: p.pr ? 'pr' : 'claude', seccion: sec, area: 'proposito', proyecto: 'Desarrollo', titulo: p.titulo, resumen: p.resumen, etiqueta: p.fecha, estado: p.estado,
      pasos: p.pasos, pregunta: p.pregunta, original: p.original, enlaces: p.enlaces, unir: p.unir, progreso: p.progreso, ts: 0, importancia: 2, hecho: !p.pr,
      responder: !p.pr && (p.estado === 'pregunta' || p.estado === 'fallo') });
  });
  return items;
}
var PEND_ORDEN_ = function (a, b) { return (b.importancia - a.importancia) || (b.ts - a.ts); };
function pendAreas_(items) {
  return AREAS_.map(function (a) { return { k: a.k, n: a.n, total: items.filter(function (x) { return x.area === a.k; }).length,
    atencion: items.filter(function (x) { return x.area === a.k && (x.seccion === 'atencion' || x.pendiente); }).length }; });
}
/* Pendientes: SOLO lo que necesita una acción de Juan (decidir, responder, unir, comprar). Lo que es para leer o ya
   quedó listo es una notificación: va a notificacionesTodo_. Las claves leer/listo quedan vacías por compatibilidad. */
function pendientesTodo_(ses) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  var items = pendItems_(ses, adm).filter(function (x) { return x.seccion === 'atencion'; }).sort(PEND_ORDEN_);
  return { ok: true, areas: pendAreas_(items), total: items.length, atencion: items, leer: [], listo: [] };
}
/* Notificaciones (la campana): lo que no pide nada —para leer, ya listo, lo que Claude está trabajando o publicando— y
   el historial de avisos de Alma (3 días), cada uno en su esfera. Los avisos de algo que sí pide acción se marcan
   «pendiente» y llevan a Pendientes. `lista` sigue igual para las versiones viejas de la página. */
function notificacionesTodo_(ses) {
  var base = vozNotificaciones_(ses); if (!base.ok) return base;
  var adm = paraClaudePrincipalSes_(ses), items = [];
  if (adm) {
    pendItems_(ses, adm, true).filter(function (x) { return x.seccion !== 'atencion'; }).forEach(function (x) {
      items.push({ id: String(x.id), ts: x.ts || Date.now(), area: x.area, proyecto: x.proyecto || '', titulo: x.titulo || '', texto: x.resumen || '', estado: x.estado || '',
        detalle: x.detalle || x.original || '', enlaces: x.enlaces || [], fuente: x.fuente, enlace: ((x.acciones || [])[0] || {}).url || '' });
    });
    var porRet = {}, ahora = Date.now(); pendFilas_().forEach(function (r) { if (r.ret_id) porRet[String(r.ret_id)] = r; });
    (base.lista || []).forEach(function (a) {
      var r = porRet[String(a.id)];
      items.push({ id: 'av:' + a.id + ':' + a.ts, ts: a.ts, area: r ? r.area : '', proyecto: r ? String(r.proyecto || '') : '', titulo: r ? String(r.titulo || '') : '', texto: a.texto,
        pendiente: !!(r && r.tipo === 'atencion' && pendVivo_(r, ahora)), fuente: 'aviso' });
    });
  }
  items.sort(function (a, b) { return b.ts - a.ts; });
  return { ok: true, lista: base.lista, items: items, areas: pendAreas_(items), total: items.length };
}

/* «Responder» en una tarjeta que necesita algo de Juan. Lo de Claude (una pregunta o algo que falló) le llega a Claude como
   seguimiento, con lo que pidió y lo que respondió; lo de Alma lo atiende Alma como un mensaje del chat, con la tarjeta de
   contexto. En los dos casos la tarjeta se cierra: lo que siga aparece como una tarjeta nueva. */
function pendResponder_(ses, b) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  var texto = String(b.texto || '').trim(), id = String(b.id || ''); if (!texto || !id) return { ok: false, error: 'faltan datos' };
  var x = pendFilas_().filter(function (r) { return String(r.id) === id; })[0];
  if (x) {
    var nota = 'Juan responde desde Pendientes a esta tarjeta tuya: «' + x.titulo + '». ' + (x.resumen || '') + (x.detalle ? '\nLo que habías dicho: ' + String(x.detalle).slice(0, 1500) : '') +
      '\nAtiende su respuesta como siguiente paso de ese tema.';
    var r = opProcesar_(adm, texto, 'hub', [], nota);
    if (!r.ok) return r;
    try { pendResolver_(ses, id); } catch (e) {}
    return { ok: true, a: 'alma', respuesta: r.alma && r.alma.texto || '' };
  }
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'), v = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, PARA_CLAUDE_CAB_.length).getValues() : [];
  var c = v.filter(function (r) { return String(r[0]) === id; })[0]; if (!c) return { ok: false, error: 'Ya no encuentro esa tarjeta.' };
  var rc = paraClaudeCrear_(adm, { titulo: ('Respuesta: ' + c[6]).slice(0, 80), app: c[3] || 'Otro', tipo: c[4] || 'mejora', prioridad: c[5] || 'normal',
    que_quiere: texto + '\n\nEs la respuesta de Juan (desde Pendientes) a lo que le dijiste sobre «' + c[6] + '».\nLO QUE PIDIÓ: ' + String(c[7] || '').slice(0, 2500) +
      '\nLO QUE RESPONDISTE: ' + String(c[11] || '').slice(0, 3000) });
  if (!rc.ok) return rc;
  paraClaudeMarcar_(id, 'hecho', 'Juan respondió en Pendientes');
  return { ok: true, a: 'claude', respuesta: rc.claude ? 'Listo, ya se lo pasé a Claude. Su respuesta aparece aquí.' : rc.nota || '' };
}
/* La nota de voz de «Responder»: llega en base64 y vuelve en texto, para que Juan la vea antes de enviarla. */
function pendNota_(ses, b) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  if (!b.audio || String(b.audio).length > 12000000) return { ok: false, error: 'La nota está vacía o es muy larga.' };
  var t = transcribir_(Utilities.newBlob(Utilities.base64Decode(String(b.audio)), String(b.mime || 'audio/mp4').split(';')[0], 'nota'));
  return t ? { ok: true, texto: t } : { ok: false, error: 'No te entendí. ¿La grabas otra vez o la escribes?' };
}
