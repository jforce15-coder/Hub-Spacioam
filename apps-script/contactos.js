/* ═══ 19 · CONTACTOS: proveedores, técnicos, socios y potenciales socios ═════════════════════════════════
   Las conversaciones de WhatsApp que no son de una reserva (el transporte privado, el técnico del aire, Liliana la socia…)
   tienen ahora una ficha que se mantiene sola:
     tipo     proveedor · tecnico · socio · potencial_socio · recepcion · equipo · otro
     estado   en qué está, como las etapas de una reserva («Servicio solicitado», «Esperando cotización», «Mantenimiento hoy»…)
     resumen  la memoria de la relación: quién es, qué se ha hablado, acuerdos y pendientes (para retomarlo meses después)
   Se reclasifica cuando ALMA le escribe por pedido de un administrador (con lo que él dijo de esa persona), cuando la
   persona responde y cuando se cierra un encargo. Hoja ALMA_CONTACTOS. El Hub agrupa por tipo y muestra el estado;
   la secretaria la consulta con buscar_contacto, que trae también todo el historial con ese número. */

var CONTACTOS_CAB_ = ['tel', 'nombre', 'tipo', 'rol', 'empresa', 'propiedades', 'estado', 'resumen', 'actualizado', 'origen'];
var CONTACTO_TIPOS_ = { proveedor: 'Proveedor', tecnico: 'Técnico', socio: 'Socio', potencial_socio: 'Potencial socio', recepcion: 'Recepción', equipo: 'Equipo', otro: 'Contacto' };
function hojaContactos_() { return hojaCrear_('ALMA_CONTACTOS', CONTACTOS_CAB_); }
function contactosTodos_() {
  var c = CacheService.getScriptCache(), hit = c.get('contactos_v1'); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var sh = hojaContactos_(), n = sh.getLastRow(); if (n < 2) return [];
  var out = sh.getRange(2, 1, n - 1, CONTACTOS_CAB_.length).getValues().map(function (v, i) { var o = { fila: i + 2 }; CONTACTOS_CAB_.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : String(v[j]); }); return o; });
  try { var t = JSON.stringify(out); if (t.length < 95000) c.put('contactos_v1', t, 300); } catch (e) {}
  return out;
}
function contactoFicha_(wa) { var k = fin8_(wa); return k ? contactosTodos_().filter(function (o) { return fin8_(o.tel) === k; })[0] || null : null; }
function contactoGuardar_(wa, o) {
  var lock = LockService.getScriptLock(); try { lock.waitLock(6000); } catch (e) { return; }
  try {
    CacheService.getScriptCache().remove('contactos_v1');
    var sh = hojaContactos_(), prev = contactoFicha_(wa), cur = prev || {};
    var fila = CONTACTOS_CAB_.map(function (k) { return k === 'tel' ? normTel_(wa) : k === 'actualizado' ? new Date().toISOString() : (o[k] != null && String(o[k]).trim() !== '' ? String(o[k]).slice(0, k === 'resumen' ? 2500 : 200) : (cur[k] || '')); });
    if (prev) sh.getRange(prev.fila, 1, 1, CONTACTOS_CAB_.length).setValues([fila]); else sh.appendRow(fila);
    CacheService.getScriptCache().remove('contactos_v1');
  } finally { lock.releaseLock(); }
}
/* Todo lo que se ha hablado con un número (la hoja entera, no solo lo reciente), del más viejo al más nuevo. */
function contactoHistorial_(wa, n) {
  var sh = ssAlma_().getSheetByName('ALMA_WHATSAPP'); if (!sh || sh.getLastRow() < 2) return [];
  var w = normTel_(wa); if (!w) return [];
  var hits = sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(w).matchEntireCell(true).findAll();
  var filas = hits.map(function (r) { return r.getRow(); }).slice(-(n || 60));
  return filas.map(function (f) { var v = sh.getRange(f, 1, 1, 9).getValues()[0]; return { ts: v[0] instanceof Date ? v[0].toISOString() : String(v[0]), de: v[3] === 'in' ? (v[2] || 'Contacto') : (v[8] === 'alma' ? 'ALMA' : v[8] === 'sistema' ? 'Sistema' : 'Spacio AM'), texto: String(v[4] || '') }; });
}
/* Clasifica y resume un contacto con lo que se ha hablado (y, si viene, lo que dijo el administrador de esa persona). */
function contactoClasificar_(wa, contexto, forzar) {
  wa = normTel_(wa); if (!wa) return null;
  var c = CacheService.getScriptCache(), kc = 'ctclas_' + fin8_(wa);
  if (!forzar && !contexto && c.get(kc)) return null; c.put(kc, '1', 180);
  try { if (adminPorTel_(wa)) return null; } catch (e) {}
  try { if (JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}')[fin8_(wa)]) return null; } catch (e) {}   // contactos personales: no son de la empresa
  var prev = contactoFicha_(wa) || {}, hist = contactoHistorial_(wa, 30);
  var lineas = hist.map(function (m) { return m.de + ' (' + m.ts.slice(0, 10) + '): ' + m.texto.replace(/\s+/g, ' ').slice(0, 400); }).join('\n').slice(-7000);
  if (!lineas && !contexto) return null;
  var sys = 'Llevas la libreta de contactos de Spacio AM (alojamientos de estancia corta en Guatemala). Clasificas a una persona con la que la empresa habla por WhatsApp fuera de las reservas y mantienes su ficha. Responde SOLO JSON:\n' +
    '{"nombre":"nombre de la persona (o vacío)","tipo":"proveedor|tecnico|socio|potencial_socio|recepcion|equipo|otro","rol":"qué hace o qué es para la empresa, en pocas palabras (ej. transporte privado, técnico de aire acondicionado, socia de Brunelo 705)","empresa":"empresa o servicio si aplica","propiedades":"apartamentos o edificios relacionados, separados por coma","estado":"en qué está la relación AHORA en 2 a 5 palabras (ej. Servicio solicitado, Esperando cotización, Mantenimiento programado hoy, Esperando su respuesta, Pago pendiente, Propuesta enviada, Sin pendientes)","resumen":"memoria de la relación en 3 a 8 líneas con ·: quién es, qué se ha hablado, acuerdos, montos o fechas que se dijeron, y pendientes. Integra la ficha anterior: no borres lo que sigue siendo cierto."}\n' +
    'Reglas: socio = dueño o socio de apartamentos que Spacio AM administra; potencial_socio = alguien con quien se habla de sumar un apartamento o invertir; proveedor = vende o presta un servicio (transporte, insumos, lavandería, fotografía…); tecnico = mantenimiento, reparaciones, limpieza externa; recepcion = portería o administración de un edificio. Lo que dijo el administrador sobre la persona manda. No inventes datos.';
  var usr = 'FICHA ANTERIOR: ' + JSON.stringify({ nombre: prev.nombre || '', tipo: prev.tipo || '', rol: prev.rol || '', empresa: prev.empresa || '', propiedades: prev.propiedades || '', estado: prev.estado || '', resumen: prev.resumen || '' }) +
    (contexto ? '\n\nLO QUE DIJO O PIDIÓ EL ADMINISTRADOR SOBRE ESTA PERSONA:\n' + String(contexto).slice(0, 1500) : '') + '\n\nCONVERSACIÓN (+' + wa + '):\n' + (lineas || '(todavía no hay mensajes)') +
    '\n\nENTREGA DEL ÚLTIMO MENSAJE: ' + (function () { try { return waEntregaTexto_(wa); } catch (e) { return '?'; } })();
  var j = {};
  try { var raw = String(claude_(CFG.MODELO_CLASIFICADOR, 700, sys, usr, 0) || ''); j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { return null; }
  if (!CONTACTO_TIPOS_[j.tipo]) j.tipo = prev.tipo || 'otro';
  contactoGuardar_(wa, { nombre: j.nombre, tipo: j.tipo, rol: j.rol, empresa: j.empresa, propiedades: j.propiedades, estado: j.estado, resumen: j.resumen, origen: prev.origen || (contexto ? 'pedido del administrador' : 'WhatsApp') });
  return contactoFicha_(wa);
}
/* Para no frenar el webhook ni la respuesta: se clasifica en la siguiente pasada (cola corta en propiedades). */
function contactoEncolar_(wa, contexto) {
  wa = normTel_(wa); if (!wa) return;
  var p = PropertiesService.getScriptProperties(), q = {}; try { q = JSON.parse(p.getProperty('CONTACTOS_COLA') || '{}'); } catch (e) {}
  var k = fin8_(wa); q[k] = { wa: wa, ctx: ((q[k] && q[k].ctx ? q[k].ctx + '\n' : '') + (contexto || '')).slice(-1500), t: Date.now() };
  p.setProperty('CONTACTOS_COLA', JSON.stringify(q));
}
function contactosProcesar_() {
  var p = PropertiesService.getScriptProperties(), q = {}; try { q = JSON.parse(p.getProperty('CONTACTOS_COLA') || '{}'); } catch (e) {}
  var ks = Object.keys(q); if (!ks.length) return;
  var t0 = Date.now();
  ks.slice(0, 6).forEach(function (k) {
    if (Date.now() - t0 > 40000) return;
    var it = q[k]; delete q[k]; p.setProperty('CONTACTOS_COLA', JSON.stringify(q));
    try { contactoClasificar_(it.wa, it.ctx, true); } catch (e) { console.error('contactoClasificar_: ' + e); }
  });
}
/* Secretaria: busca contactos por nombre, empresa, rol, apartamento o número. */
function contactoBuscar_(texto) {
  var q = String(texto || '').trim(); if (!q) return [];
  var tel = normTel_(q), L = contactosTodos_();
  if (tel && q.replace(/\D/g, '').length >= 8) return L.filter(function (o) { return fin8_(o.tel) === fin8_(tel); });
  var n = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }, palabras = n(q).split(/\s+/).filter(function (w) { return w.length > 2; });
  return L.map(function (o) { var h = n([o.nombre, o.rol, o.empresa, o.propiedades, o.tipo, o.resumen].join(' ')); return { o: o, s: palabras.filter(function (w) { return h.indexOf(w) >= 0; }).length + (n(o.nombre).indexOf(n(q)) >= 0 ? 3 : 0) }; })
    .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 5).map(function (x) { return x.o; });
}
/* Robot: llenar las fichas de las conversaciones de WhatsApp sin reserva que ya existen (hasta 25 por pasada). */
function contactosRellenar_() {
  var ya = {}; contactosTodos_().forEach(function (o) { ya[fin8_(o.tel)] = 1; });
  var pend = hubInbox_().filter(function (o) { return /^wa:/.test(o.conv_id) && !/reserva|huesped/.test(o.tipo) && !ya[fin8_(o.conv_id.slice(3))]; }).slice(0, 25);
  var hechos = 0, t0 = Date.now();
  pend.forEach(function (o) { if (Date.now() - t0 > 240000) return; try { if (contactoClasificar_(o.conv_id.slice(3), '', true)) hechos++; } catch (e) {} });
  return { ok: true, clasificados: hechos, quedan: Math.max(0, pend.length - hechos) };
}
