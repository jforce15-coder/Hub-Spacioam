/* ═══ DECISIÓN DEL EQUIPO (issue #325) ═══════════════════════════════════════════════════════════════════
   Cuando un caso de un huésped espera al equipo (Alma le dijo «lo confirmo con el equipo», el caso quedó en rojo o
   escalado, o el huésped eligió algo que requiere al equipo), la IA propone 3 respuestas cortas, A, B y C, más
   «Otra respuesta» para escribir a mano. Se muestran en la conversación del Hub (tarjeta de acción), en el chat con
   Alma (op:) y en el chat de la app (bloque [[opciones]]), y por WhatsApp al responsable de turno (3 botones).
   Al elegir queda un borrador para revisar: nada sale solo, salvo el botón «Enviar» de WhatsApp, que es la
   confirmación explícita. Una sola decisión por conversación: lo que se elige o envía en un canal cierra los demás
   («Resuelto por Ana · opción B»).
   Hoja DECISIONES. Estados: abierta → elegida → enviada.
   Disparo (sin duplicar, una abierta por conversación): avisarRojo_ (rojo y escalados), promesaRegistrar_ («lo
   confirmo con el equipo») y avisarSeguimiento_ (el huésped eligió algo que requiere al equipo). decisionCrear_ solo
   anota el caso (rápido, dentro de la cola de huéspedes); las opciones con IA y los avisos salen en la siguiente
   pasada de procesarCola (decisionesProcesar_), que es de huéspedes y nunca se pausa por cupo. */
var DEC_CAB_ = ['id', 'resId', 'creado', 'opciones', 'estado', 'quien', 'opcion', 'cuando', 'origen', 'motivo', 'contexto', 'borrador', 'intentos', 'enviado_por', 'enviado_ts'];
var DEC_LETRAS_ = ['A', 'B', 'C'];
var DEC_ACCIONES_ = ['tarea', 'devolucion', 'ninguna'];
var DEC_WA_MIN_ = 20;   // minutos en que un texto suelto del responsable se toma como «otra respuesta»

function hojaDec_() {
  var sh = hojaCrear_('DECISIONES', DEC_CAB_);
  if (sh.getLastColumn() < DEC_CAB_.length) sh.getRange(1, 1, 1, DEC_CAB_.length).setValues([DEC_CAB_]);
  return sh;
}
function decFilas_() {
  var sh = hojaDec_(), n = sh.getLastRow(); if (n < 2) return { sh: sh, filas: [] };
  var ini = Math.max(2, n - 399), v = sh.getRange(ini, 1, n - ini + 1, DEC_CAB_.length).getValues();
  return { sh: sh, filas: v.map(function (r, i) { var o = { fila: ini + i }; DEC_CAB_.forEach(function (k, j) { o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j] == null ? '' : r[j]); }); return o; }) };
}
function decGuardar_(sh, f, cambios) {
  Object.keys(cambios).forEach(function (k) { f[k] = cambios[k]; sh.getRange(f.fila, DEC_CAB_.indexOf(k) + 1).setValue(cambios[k]); });
}
/* Candado: si quien llama ya lo tiene (la cola de huéspedes, al avisar un rojo), no se suelta aquí. Devuelve cómo soltarlo, o null. */
function decCandado_() {
  var lock = LockService.getScriptLock(), yaTenia = false;
  try { yaTenia = lock.hasLock(); if (!yaTenia) lock.waitLock(10000); } catch (e) { return null; }
  return function () { if (!yaTenia) { try { lock.releaseLock(); } catch (e) {} } };
}
function decOpciones_(f) { try { var o = JSON.parse(f.opciones || '[]'); return Array.isArray(o) ? o : []; } catch (e) { return []; } }
function decCtx_(f) { try { return JSON.parse(f.contexto || '{}') || {}; } catch (e) { return {}; } }
function decViva_(f) { return f.estado === 'abierta' || f.estado === 'elegida'; }
function decEnlace_(resId) { return CFG.HUB_URL + '/?conv=' + encodeURIComponent(resId); }
function decOpcionTxt_(f) { return f.opcion === 'otra' ? 'otra respuesta' : f.opcion && f.opcion !== '—' ? 'opción ' + f.opcion : ''; }
/* «Resuelto por Ana · opción B»: lo que ven los demás cuando alguien ya decidió. */
function decResueltoTxt_(f) { return 'Resuelto por ' + (f.quien || 'el equipo') + (decOpcionTxt_(f) ? ' · ' + decOpcionTxt_(f) : ''); }

/* ── Disparo: anota el caso (sin IA). Una sola decisión viva por conversación. ── */
function decisionCrear_(ctx, origen, motivo) {
  ctx = ctx || {};
  var resId = String(ctx.resId || ctx.conv_id || '');
  if (!resId || /^op:/.test(resId)) return null;
  var soltar = decCandado_(); if (!soltar) return null;
  try {
    var d = decFilas_(), viva = d.filas.filter(function (f) { return f.resId === resId && decViva_(f); }).pop();
    if (viva) return { id: viva.id, ya: true };
    var id = 'dc' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    var c = { huesped: s_(ctx.huesped), propiedad: s_(ctx.propiedad), codigo: s_(ctx.codigo), idioma: s_(ctx.idioma), canal: s_(ctx.canal), wa: s_(ctx.wa),
      texto: String(ctx.texto || ctx.pregunta || '').slice(0, 1500), hilo: String(ctx.hiloTexto || '').slice(-4000) };
    d.sh.appendRow(DEC_CAB_.map(function (k) {
      return ({ id: id, resId: resId, creado: new Date().toISOString(), opciones: '', estado: 'abierta', quien: '', opcion: '', cuando: '', origen: String(origen || ''),
        motivo: String(motivo || ctx.razon || '').slice(0, 400), contexto: JSON.stringify(c), borrador: '', intentos: 0, enviado_por: '', enviado_ts: '' })[k];
    }));
    PropertiesService.getScriptProperties().setProperty('DEC_PEND', '1');
    return { id: id, ya: false };
  } finally { soltar(); }
}

/* ── procesarCola: las decisiones nuevas reciben sus opciones (IA) y se avisan (WhatsApp y chat con Alma). ── */
function decisionesProcesar_() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('DEC_PEND') !== '1') return;
  var d = decFilas_(), nuevas = d.filas.filter(function (f) { return f.estado === 'abierta' && !f.opciones && Number(f.intentos || 0) < 3; });
  if (!nuevas.length) { P.deleteProperty('DEC_PEND'); return; }
  nuevas.slice(0, 3).forEach(function (f) {
    var ops = null; try { ops = decisionGenerar_(f); } catch (e) { console.error('decisionGenerar_: ' + e); }
    if (!ops) { decGuardar_(d.sh, f, { intentos: Number(f.intentos || 0) + 1 }); return; }
    decGuardar_(d.sh, f, { opciones: JSON.stringify(ops) });
    try { decisionAvisarWa_(f); } catch (e) { console.error('decisionAvisarWa_: ' + e); }
    try { decisionAvisarChat_(f); } catch (e) { console.error('decisionAvisarChat_: ' + e); }
  });
}

/* Las 3 opciones con IA (el modelo redactor, la voz de Spacio AM y ESTILO de ALMA_INSTRUCCIONES). */
function decisionGenerar_(f) {
  var c = decCtx_(f), hilo = c.hilo || '';
  if (!hilo) {   // el disparo de promesas no trae el hilo: se lee (Hospitable o WhatsApp)
    try {
      var hc = hiloConv_(f.resId);
      if (hc.code === 200) hilo = (hc.hilo || []).slice(-14).map(function (m) { return '[' + (m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'SPACIO AM · automático' : 'SPACIO AM') + '] ' + String(m.texto || '').slice(0, 700); }).join('\n');
    } catch (e) { console.error('decision hilo: ' + e); }
  }
  USO_REF_ = s_(f.resId);
  var sys = 'Eres Alma, del equipo de Spacio AM (apartamentos de estadía corta en Guatemala). Un caso de un huésped espera una decisión del equipo. ' +
    'Propón exactamente 3 respuestas posibles y distintas entre sí (por ejemplo: sí, una alternativa, y un no amable), para que la persona del equipo elija con un toque.\n' +
    'Cada opción:\n· titulo: máximo 20 letras, en español, la acción concreta («Devolver la noche», «Técnico hoy», «Sin excepción»).\n' +
    '· detalle: máximo 60 letras, en español, qué implica para nosotros.\n' +
    '· mensaje: el mensaje completo para el huésped, en su idioma (IDIOMA DE RESPUESTA), listo para enviar, con la voz de Spacio AM: cálida, humana, siempre «tú», gratitud antes que disculpa, sin markdown ni firma.\n' +
    '· accion: "tarea" si elegirla obliga a que alguien del equipo haga algo (mantenimiento, limpieza, llevar algo); "devolucion" si implica devolver o compensar dinero; si no, "ninguna".\n' +
    'Nunca inventes datos (montos, códigos, horarios, números) que no estén en la conversación: si hace falta un monto, el mensaje dice que el equipo se lo confirma. Nunca digas que eres IA.\n' +
    'Responde SOLO JSON: {"opciones":[{"titulo":"…","detalle":"…","mensaje":"…","accion":"ninguna"},{…},{…}]}' + estilo_();
  var usr = 'HUÉSPED: ' + (c.huesped || 'Huésped') + '\nPROPIEDAD: ' + (c.propiedad || '-') + '\nIDIOMA DE RESPUESTA: ' + (c.idioma || 'ES') +
    '\nQUÉ ESPERA DEL EQUIPO: ' + (f.motivo || 'una decisión') + '\n\nÚLTIMO MENSAJE DEL HUÉSPED:\n' + (c.texto || '(no disponible)') + '\n\nCONVERSACIÓN:\n' + (hilo || '(no disponible)');
  var raw = String(claude_(CFG.MODELO_REDACTOR, 1400, sys, usr, 0.4) || '');
  return decLimpiarOpciones_(raw);
}
/* Del texto del modelo a 3 opciones válidas (o null). Separada para probarla sin Apps Script. */
function decLimpiarOpciones_(raw) {
  var j = null; try { var m = String(raw || '').match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { return null; }
  var lista = (j && Array.isArray(j.opciones) ? j.opciones : []).map(function (o, i) {
    o = o || {};
    var corta = function (t, max) { t = String(t || '').replace(/\s+/g, ' ').replace(/\s[-–—|]\s/g, ', ').replace(/[|]/g, ' ').trim(); if (t.length <= max) return t; var x = t.slice(0, max), k = x.lastIndexOf(' '); return (k > max * 0.5 ? x.slice(0, k) : x).replace(/[\s,;:.]+$/, ''); };
    var msg = String(o.mensaje || '').trim();
    try { msg = formatearMensaje_(limpiarSalida_(msg).texto); } catch (e) {}
    var acc = String(o.accion || 'ninguna').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return { letra: DEC_LETRAS_[i], titulo: corta(o.titulo, 20), detalle: corta(o.detalle, 60), mensaje: msg, accion: DEC_ACCIONES_.indexOf(acc) >= 0 ? acc : 'ninguna' };
  }).filter(function (o, i) { return i < 3 && o.titulo && o.mensaje; });
  return lista.length === 3 ? lista : null;
}

/* ── Lectura para el Hub: la decisión viva de la conversación (o la última, si se resolvió hace menos de 24 h). ── */
function decPublica_(f) {
  if (!f) return null;
  return { id: f.id, resId: f.resId, creado: f.creado, estado: f.estado, generando: !f.opciones && f.estado === 'abierta', motivo: f.motivo, origen: f.origen,
    opciones: decOpciones_(f), quien: f.quien, opcion: f.opcion, cuando: f.cuando, resuelto: f.estado === 'abierta' ? '' : decResueltoTxt_(f),
    enviada: f.estado === 'enviada', borrador: f.opcion === 'otra' ? f.borrador : '' };
}
function decisionLeer_(resId) {
  resId = String(resId || ''); if (!resId) return null;
  var d = decFilas_(), mias = d.filas.filter(function (f) { return f.resId === resId; });
  var viva = mias.filter(decViva_).pop();
  if (viva) return decPublica_(viva);
  var ult = mias.pop();
  return ult && Date.now() - Date.parse(ult.enviado_ts || ult.cuando || ult.creado) < 24 * 3600000 ? decPublica_(ult) : null;
}

/* ── Elegir (Hub, chat con Alma o WhatsApp): queda como borrador de quien eligió; los demás ven «Resuelto por…». ──
   quien: la sesión del Hub ({email}), un administrador ({nombre}) o un texto. opcion: 'A' | 'B' | 'C' | 'otra'. */
function decQuien_(ses, nombre) {
  if (ses && ses.nombre && !ses.email) return String(ses.nombre).slice(0, 80);
  var em = String((ses && (ses.email || ses.correo)) || '').trim().toLowerCase();
  if (em) { try { var a = adminPorEmail_(em); if (a && a.nombre) return String(a.nombre).slice(0, 80); } catch (e) {} }
  return String(nombre || 'Equipo').slice(0, 80);
}
function decisionElegir_(ses, id, opcion, nombre) {
  opcion = String(opcion || '').trim(); if (opcion !== 'otra') opcion = opcion.toUpperCase();
  if (DEC_LETRAS_.indexOf(opcion) < 0 && opcion !== 'otra') return { ok: false, error: 'opción' };
  var quien = decQuien_(ses, nombre);
  var soltar = decCandado_(); if (!soltar) return { ok: false, error: 'ocupado' };
  try {
    var d = decFilas_(), f = d.filas.filter(function (x) { return x.id === String(id || ''); })[0];
    if (!f) return { ok: false, error: 'Ya no encuentro ese caso.' };
    /* Una sola decisión: si otra persona ya eligió o ya se envió, no se puede elegir de nuevo. Quien eligió sí puede cambiar. */
    if (f.estado === 'enviada' || (f.estado === 'elegida' && f.quien !== quien)) return { ok: false, resuelta: true, error: decResueltoTxt_(f), decision: decPublica_(f) };
    var op = decOpciones_(f).filter(function (o) { return o.letra === opcion; })[0];
    if (opcion !== 'otra' && !op) return { ok: false, error: 'Las opciones todavía se están preparando.' };
    decGuardar_(d.sh, f, { estado: 'elegida', quien: quien, opcion: opcion, cuando: new Date().toISOString() });
    return { ok: true, decision: decPublica_(f), mensaje: op ? op.mensaje : '', accion: op ? op.accion : 'ninguna' };
  } finally { soltar(); }
}

/* ── Enviada: el mensaje ya salió al huésped. Si la opción trae acción, aquí se hace: la tarea con la herramienta de
   tareas (opEjecutar_ → Epi) y la devolución solo se anota en Pendientes del administrador (no mueve dinero). ── */
function decisionEnviada_(id, quien) {
  var soltar = decCandado_() || function () {};
  var f = null, sh = null;
  try {
    var d = decFilas_(); sh = d.sh; f = d.filas.filter(function (x) { return x.id === String(id || ''); })[0];
    if (!f || f.estado === 'enviada') return { ok: !!f, ya: true };
    var cambios = { estado: 'enviada', enviado_por: String(quien || f.quien || 'Equipo').slice(0, 80), enviado_ts: new Date().toISOString() };
    if (f.estado === 'abierta') { cambios.quien = cambios.enviado_por; cambios.opcion = 'otra'; cambios.cuando = cambios.enviado_ts; }   // respondió a mano sin elegir
    decGuardar_(sh, f, cambios);
  } finally { soltar(); }
  var hecho = '';
  try { hecho = decisionAccion_(f); } catch (e) { console.error('decisionAccion_: ' + e); }
  return { ok: true, decision: decPublica_(f), accion: hecho };
}
function decisionAccion_(f) {
  var op = decOpciones_(f).filter(function (o) { return o.letra === f.opcion; })[0]; if (!op || op.accion === 'ninguna') return '';
  var c = decCtx_(f), quien = f.enviado_por || f.quien || 'Equipo';
  var adm = adminsOp_().filter(function (a) { return a.nombre === quien; })[0] || adminsOp_().filter(function (a) { return a.principal; })[0] || { email: '', nombre: quien, tels: [] };
  if (op.accion === 'tarea') {
    var cfg = epiCfg_(), props = cfg.props.map(propNombre_).filter(Boolean);
    var out = opEjecutar_(adm, [{ tipo: 'tarea', texto: op.titulo + ' · ' + (c.huesped || 'huésped') + (op.detalle ? ' · ' + op.detalle : ''), prop: c.propiedad, nota: 'Decisión del equipo (' + quien + ' · opción ' + f.opcion + '). Mensaje al huésped: ' + String(op.mensaje).slice(0, 300) }], cfg, props);
    return out[0] && !out[0].error ? out[0].resumen : 'No se pudo crear la tarea' + (out[0] && out[0].error ? ': ' + out[0].error : '');
  }
  if (op.accion === 'devolucion') {
    var ppal = adminsOp_().filter(function (a) { return a.principal; })[0]; if (!ppal) return '';
    var res = 'Devolución por revisar · ' + (c.huesped || 'huésped') + (c.propiedad ? ' (' + c.propiedad + ')' : '') + ': ' + op.titulo + (op.detalle ? ' · ' + op.detalle : '') + '. ' + quien + ' eligió la opción ' + f.opcion + '.';
    pendAvisar_(ppal, res + '\n\nMensaje enviado al huésped:\n' + op.mensaje + '\n\nConversación: ' + decEnlace_(f.resId), { origen: 'decision',
      clasif: { tipo: 'atencion', area: 'finanzas', proyecto: 'Spacio AM', titulo: 'Devolución por revisar', resumen: res.slice(0, 280), aviso: 'Hay una devolución por revisar de ' + (c.huesped || 'un huésped') + '.', importancia: 3, tarjeta: null, acciones: [] } });
    return 'Devolución anotada en Pendientes';
  }
  return '';
}
/* El equipo le escribió al huésped (Hub, WhatsApp del Hub o «Enviar» de WhatsApp): la decisión de esa conversación se cierra. */
function decisionAlResponder_(resId, quien) {
  resId = String(resId || ''); if (!resId || /^op:/.test(resId)) return;
  var f = decFilas_().filas.filter(function (x) { return x.resId === resId && decViva_(x); }).pop();
  if (f) decisionEnviada_(f.id, quien);
}
/* Marcar la conversación como resuelta también la cierra (sin opción). */
function decisionCerrar_(resId, quien) {
  resId = String(resId || ''); if (!resId) return;
  var d = decFilas_(), f = d.filas.filter(function (x) { return x.resId === resId && decViva_(x); }).pop(); if (!f) return;
  decGuardar_(d.sh, f, { estado: 'enviada', quien: f.quien || String(quien || 'Equipo').slice(0, 80), opcion: f.opcion || '—', cuando: f.cuando || new Date().toISOString(), enviado_por: String(quien || 'Equipo').slice(0, 80), enviado_ts: new Date().toISOString() });
}

/* ── Hub: acción «decision» (op: leer | elegir | enviada). ── */
function decisionApi_(ses, b) {
  b = b || {};
  var op = String(b.op || 'leer');
  if (op === 'leer') return { ok: true, decision: decisionLeer_(b.resId) };
  if (op === 'elegir') return decisionElegir_(ses, b.id, b.opcion, b.quien);
  if (op === 'enviada') return decisionEnviada_(b.id, decQuien_(ses, b.quien));
  return { ok: false, error: 'op' };
}

/* ── Chat con Alma (op:) y chat de la app: Alma avisa del caso con sus opciones en el bloque [[opciones]] que
   SAChat.opciones convierte en tarjeta de acción. Elegir ahí deja el borrador listo en la conversación del huésped. ── */
function decTextoChat_(f) {
  var c = decCtx_(f), ops = decOpciones_(f);
  return 'Un caso espera tu decisión: ' + (c.huesped || 'huésped') + (c.propiedad ? ' · ' + c.propiedad : '') + '.\n' + (f.motivo ? f.motivo + '\n' : '') +
    '\n¿Qué le respondemos?\n[[opciones]]\n' + ops.map(function (o) { return o.letra + ' · ' + o.titulo + (o.detalle ? ' — ' + o.detalle : ''); }).join('\n') +
    '\nOtra respuesta — la escribes tú en su conversación\n[[/opciones]]\n\n' + decEnlace_(f.resId);
}
function decisionAvisarChat_(f) {
  var turno = []; try { turno = deTurno_().map(function (p) { return String(p.email || '').toLowerCase(); }).filter(Boolean); } catch (e) {}
  var para = adminsOp_().filter(function (a) { return a.principal || turno.indexOf(a.email) >= 0; });
  var txt = decTextoChat_(f);
  para.forEach(function (a) { try { opGuardar_(a, 'alma', 'hub', txt); } catch (e) { console.error('decision chat: ' + e); } });
}
/* Lo que la persona tocó en la tarjeta del chat («B · Devolver la noche», «Otra respuesta») → la decisión de ese aviso.
   Devuelve la respuesta de Alma (ya guardada) o null si el mensaje no era una opción. */
function decisionDesdeChat_(adm, texto) {
  var t = String(texto || '').replace(/\s+/g, ' ').trim(), m = t.match(/^([ABC])\s*·\s*(.+)$/), otra = /^otra respuesta\b/i.test(t);
  if (!m && !otra) return null;
  var avisos = opFilas_(adm.email, 80).filter(function (x) { return x.de === 'alma' && /\[\[opciones\]\]/.test(x.texto) && /\?conv=/.test(x.texto); }).reverse();
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); };
  var aviso = avisos.filter(function (x) { return otra ? /\notra respuesta/i.test(x.texto) : norm(x.texto).indexOf(norm(m[1] + ' · ' + m[2])) >= 0; })[0];
  if (!aviso) return null;
  var resId = decodeURIComponent((aviso.texto.match(/\?conv=([^\s&]+)/) || [])[1] || ''), dec = decisionLeer_(resId);
  if (!dec) return null;
  var yo = opGuardar_(adm, 'yo', 'hub', t), r, resp;
  if (otra) resp = 'Escríbela en su conversación y la reviso contigo antes de enviarla:\n' + decEnlace_(resId);
  else {
    r = decisionElegir_({ nombre: adm.nombre }, dec.id, m[1]);
    resp = r.ok ? 'Listo: opción ' + m[1] + '. Te dejé el borrador en su conversación para que lo revises y lo envíes:\n' + decEnlace_(resId)
      : r.resuelta ? r.error + '. Ya no hace falta elegir.' : 'No pude elegirla: ' + (r.error || 'intenta de nuevo') + '.';
  }
  var alma = opGuardar_(adm, 'alma', 'hub', resp);
  return { ok: true, yo: yo, alma: alma };
}

/* ── WhatsApp al responsable: 3 botones de respuesta rápida (dentro de las 24 h) o, fuera, texto con el enlace al Hub. ── */
function decResponsables_() {
  var out = [], add = function (tel, nombre) { var n = normTel_(tel); if (n && !out.some(function (x) { return fin8_(x.wa) === fin8_(n); })) out.push({ wa: n, nombre: nombre || '' }); };
  try { deTurno_().forEach(function (p) { add(p.telefono, p.nombre); }); } catch (e) {}
  if (!out.length) add(CFG.WHATSAPP_NOCTURNO, '');
  return out;
}
function decNombreWa_(wa) {
  try { var a = adminPorTel_(wa); if (a) return a.nombre; } catch (e) {}
  try { var p = escalamiento_().filter(function (x) { return fin8_(x.telefono) === fin8_(wa); })[0]; if (p && p.nombre) return p.nombre; } catch (e) {}
  return '+' + String(wa).replace(/\D/g, '');
}
/* Mensaje interactivo de Meta con hasta 3 botones (título ≤ 20 letras). Devuelve { ok, id }. */
function waBotones_(wa, cuerpo, botones) {
  var W = waCfg_(); if (!W.token || !W.phoneId) return { ok: false, error: 'falta WA_TOKEN o WA_PHONE_ID' };
  var payload = { messaging_product: 'whatsapp', to: wa, type: 'interactive', interactive: { type: 'button', body: { text: String(cuerpo).slice(0, 1024) },
    action: { buttons: botones.slice(0, 3).map(function (b) { return { type: 'reply', reply: { id: String(b.id).slice(0, 256), title: String(b.titulo).slice(0, 20) } }; }) } } };
  var r = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(payload) });
  var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
  if (r.getResponseCode() >= 300) { console.error('waBotones_ ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300)); return { ok: false, error: (j.error && j.error.message) || 'HTTP ' + r.getResponseCode() }; }
  var id = s_(j.messages && j.messages[0] && j.messages[0].id);
  try { hojaWA_().appendRow([new Date().toISOString(), wa, '', 'out', String(cuerpo).slice(0, 4000), id, 'dec:' + String(botones[0].id).split(':')[1], 'interactive', 'decision', '']); } catch (e) {}
  return { ok: true, id: id };
}
/* Qué decisión espera respuesta de cada responsable (para tomar su texto como «otra respuesta»). */
function decWaMapa_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DEC_WA') || '{}') || {}; } catch (e) { return {}; } }
function decWaMarcar_(wa, id, msgId) {
  var m = decWaMapa_(), lim = Date.now() - 24 * 3600000;
  Object.keys(m).forEach(function (k) { if (!(m[k].ts > lim)) delete m[k]; });
  if (id) m[fin8_(wa)] = { id: id, msg: msgId || '', ts: Date.now() }; else delete m[fin8_(wa)];
  PropertiesService.getScriptProperties().setProperty('DEC_WA', JSON.stringify(m));
}
function decTextoWa_(f) {
  var c = decCtx_(f), ops = decOpciones_(f);
  return 'Un caso espera tu decisión · ' + (c.huesped || 'huésped') + (c.propiedad ? ' · ' + c.propiedad : '') + '\n' + (f.motivo ? f.motivo + '\n' : '') +
    (c.texto ? '\nEl huésped dijo: «' + String(c.texto).slice(0, 300) + '»\n' : '') + '\n' +
    ops.map(function (o) { return o.letra + ') ' + o.titulo + (o.detalle ? ' — ' + o.detalle : ''); }).join('\n') +
    '\n\nToca una opción y te mando el borrador. Para otra respuesta, escríbela aquí.';
}
function decisionAvisarWa_(f) {
  var ops = decOpciones_(f); if (ops.length !== 3) return;
  decResponsables_().forEach(function (p) {
    var abierta = false; try { abierta = waVentana_(p.wa); } catch (e) {}
    if (abierta) {
      var r = waBotones_(p.wa, decTextoWa_(f), ops.map(function (o) { return { id: 'dec:' + f.id + ':' + o.letra, titulo: o.titulo }; }));
      if (r.ok) { decWaMarcar_(p.wa, f.id, r.id); return; }
    }
    /* Fuera de las 24 h (o si Meta rechazó los botones): solo texto con el enlace al Hub. */
    var c = decCtx_(f);
    waEnviar_(p.wa, 'Un caso espera tu decisión · ' + (c.huesped || 'huésped') + (c.propiedad ? ' · ' + c.propiedad : '') + (f.motivo ? '\n' + f.motivo : '') + '\n\nAlma te dejó 3 opciones en su conversación:\n' + decEnlace_(f.resId));
  });
}
/* El borrador que el responsable confirma con «Enviar» o abre con «Editar en el Hub». */
function decMandarBorradorWa_(wa, f, texto) {
  var c = decCtx_(f);
  var cuerpo = 'Borrador para ' + (c.huesped || 'el huésped') + ' (' + (f.opcion === 'otra' ? 'tu respuesta, pulida' : 'opción ' + f.opcion) + '):\n\n' + texto + '\n\nEditar: ' + decEnlace_(f.resId);
  var r = waBotones_(wa, cuerpo, [{ id: 'dec:' + f.id + ':enviar', titulo: 'Enviar' }, { id: 'dec:' + f.id + ':hub', titulo: 'Editar en el Hub' }]);
  if (r.ok) decWaMarcar_(wa, f.id, r.id); else waEnviar_(wa, cuerpo);
}
/* Webhook: ¿este mensaje del responsable es parte de una decisión? (botón o texto como «otra respuesta»). true = atendido. */
function decisionWaEntrante_(m, wa, ts) {
  var boton = m.type === 'interactive' && m.interactive && m.interactive.button_reply ? s_(m.interactive.button_reply.id) : '';
  var mb = boton.match(/^dec:([\w-]+):(A|B|C|enviar|hub)$/);
  var marca = decWaMapa_()[fin8_(wa)], texto = m.type === 'text' ? s_(m.text && m.text.body).trim() : '';
  var esOtra = !mb && !!texto && !!marca && ((m.context && m.context.id && m.context.id === marca.msg) || Date.now() - marca.ts < DEC_WA_MIN_ * 60000);
  if (!mb && !esOtra) return false;
  var id = mb ? mb[1] : marca.id, f = decFilas_().filas.filter(function (x) { return x.id === id; })[0];
  if (!f) return false;
  if (!mb && !decViva_(f)) { decWaMarcar_(wa, null); return false; }   // ya se resolvió: su texto sigue su camino normal
  var quien = decNombreWa_(wa);
  try { hojaWA_().appendRow([ts || new Date().toISOString(), wa, quien, 'in', (mb ? '[botón] ' + s_(m.interactive.button_reply.title) : texto).slice(0, 4000), s_(m.id), 'dec:' + id, s_(m.type), 'decision', '']); } catch (e) {}
  var accion = mb ? mb[2] : 'otra';
  if (accion === 'hub') { waEnviar_(wa, 'Ábrelo aquí, el borrador te espera en el cuadro:\n' + decEnlace_(f.resId), { yaVentana: true }); return true; }
  if (accion === 'enviar') {
    if (f.estado === 'enviada' || (f.estado === 'elegida' && f.quien !== quien)) { waEnviar_(wa, decResueltoTxt_(f) + '. Ya no hace falta enviarlo.', { yaVentana: true }); return true; }
    var op = decOpciones_(f).filter(function (o) { return o.letra === f.opcion; })[0], msg = f.opcion === 'otra' ? f.borrador : op ? op.mensaje : '';
    if (!msg) { waEnviar_(wa, 'Primero elige una opción.', { yaVentana: true }); return true; }
    var r = hubResponder_(f.resId, msg, quien, '', null);   // cierra la decisión (decisionAlResponder_) y hace la acción
    decWaMarcar_(wa, null);
    waEnviar_(wa, r && r.ok ? 'Listo: se lo envié a ' + (decCtx_(f).huesped || 'el huésped') + '.' : 'No salió: ' + ((r && r.error) || 'error') + '. Ábrelo en el Hub:\n' + decEnlace_(f.resId), { yaVentana: true });
    return true;
  }
  if (accion === 'otra') {
    var e0 = decisionElegir_({ nombre: quien }, f.id, 'otra');
    if (!e0.ok) { waEnviar_(wa, (e0.error || 'No pude tomarla') + '.', { yaVentana: true }); return true; }
    var pul = null; try { pul = hubRedactar_(f.resId, texto, []); } catch (e) { console.error('decision otra: ' + e); }
    var final = pul && pul.ok ? pul.texto : texto;
    var d2 = decFilas_(), f2 = d2.filas.filter(function (x) { return x.id === f.id; })[0]; if (f2) { decGuardar_(d2.sh, f2, { borrador: String(final).slice(0, 3000) }); f = f2; }
    decMandarBorradorWa_(wa, f, final);
    return true;
  }
  var r2 = decisionElegir_({ nombre: quien }, f.id, accion);
  if (!r2.ok) { waEnviar_(wa, (r2.error || 'No pude elegirla') + (r2.resuelta ? '. Ya no hace falta elegir.' : '.'), { yaVentana: true }); return true; }
  var f3 = decFilas_().filas.filter(function (x) { return x.id === f.id; })[0] || f;
  decMandarBorradorWa_(wa, f3, r2.mensaje);
  return true;
}
