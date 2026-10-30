/* ═══ 18 · ENTREGA REAL DE WHATSAPP ══════════════════════════════════════════════════════════════════
   Que Meta acepte un mensaje no quiere decir que llegue. Meta avisa después (webhook «statuses»): enviado, entregado,
   leído o FALLIDO. Antes solo se anotaba en la consola, así que ALMA decía «enviado» aunque nunca llegara (caso Liliana).
   Ahora: se guarda el último estado de cada número, un fallo queda escrito en su conversación del Hub y se le avisa a
   quien lo pidió, y la secretaria ve el estado real (entregado / leído / no entregado y por qué). */

var ENTREGA_ORDEN_ = { sent: 1, delivered: 2, read: 3 };
function waEntregaMapa_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_ENTREGA') || '{}'); } catch (e) { return {}; } }
function waEntregaMotivo_(errs) {
  var e = (errs || [])[0] || {}, c = Number(e.code) || 0, det = String(((e.error_data || {}).details) || e.message || e.title || '').slice(0, 200);
  var M = {
    131049: 'Meta no lo entregó. A números de Estados Unidos (+1) Meta no entrega plantillas que clasifica como marketing, y limita los mensajes a quien no ha escrito antes',
    131026: 'el número no tiene WhatsApp o no puede recibir el mensaje',
    131047: 'pasaron más de 24 h desde su último mensaje y no se usó una plantilla',
    131050: 'la persona dejó de recibir mensajes de marketing de este número',
    131051: 'tipo de mensaje no compatible',
    131053: 'no se pudo enviar el archivo',
    130472: 'Meta lo frenó porque el número está en un experimento de entrega de WhatsApp',
    131048: 'Meta limitó los envíos de este número (demasiados mensajes sin respuesta)',
    131056: 'demasiados mensajes seguidos a esa persona; espera un momento'
  };
  return (M[c] || ('WhatsApp no lo entregó' + (e.title ? ': ' + e.title : ''))) + (c ? ' (código ' + c + ')' : '') + (det && !M[c] ? ' · ' + det : '');
}
/* Webhook de Meta: un estado por mensaje. Se guarda el último de cada número (el fallo siempre gana si es más nuevo). */
function waEntregaGuardar_(st) {
  var wa = normTel_(st && st.recipient_id); if (!wa) return;
  var est = String(st.status || ''), ts = Number(st.timestamp || 0) * 1000 || Date.now(), k = fin8_(wa);
  var lock = LockService.getScriptLock(); if (!lock.tryLock(4000)) return;
  try {
    var p = PropertiesService.getScriptProperties(), m = waEntregaMapa_(), prev = m[k];
    var nuevo = !prev || ts > prev.ts + 1000 || (prev.id === st.id && (est === 'failed' || (ENTREGA_ORDEN_[est] || 0) > (ENTREGA_ORDEN_[prev.estado] || 0)));
    if (!nuevo) return;
    m[k] = { wa: wa, id: s_(st.id), estado: est, ts: ts, motivo: est === 'failed' ? waEntregaMotivo_(st.errors) : '' };
    var ks = Object.keys(m); if (ks.length > 300) ks.sort(function (a, b) { return m[a].ts - m[b].ts; }).slice(0, ks.length - 300).forEach(function (x) { delete m[x]; });
    p.setProperty('WA_ENTREGA', JSON.stringify(m));
  } finally { lock.releaseLock(); }
  if (est === 'failed') {
    /* 131047 (pasaron las 24 h): no se avisa como fallo; se manda la plantilla y el mensaje sale cuando responda. */
    var cod = Number((((st.errors || [])[0]) || {}).code) || 0, retomado = false;
    if (cod === 131047) { try { retomado = waRetomarFallido_(wa, s_(st.id)); } catch (e) { console.error('waRetomarFallido_: ' + e); } }
    if (!retomado) { try { waEntregaFallo_(wa, m[k].motivo); } catch (e) { console.error('waEntregaFallo_: ' + e); } }
  }
}
function waEntrega_(wa) { var e = waEntregaMapa_()[fin8_(wa)]; return e || null; }
function waEntregaTexto_(wa) {
  var e = waEntrega_(wa); if (!e) return 'sin confirmación de Meta todavía';
  var f = Utilities.formatDate(new Date(e.ts), CFG.TZ, 'd MMM HH:mm');
  return e.estado === 'read' ? 'LEÍDO el ' + f : e.estado === 'delivered' ? 'ENTREGADO el ' + f + ' (aún no lo lee)' : e.estado === 'sent' ? 'enviado el ' + f + ', sin confirmación de entrega'
    : e.estado === 'failed' ? 'NO ENTREGADO (' + f + '): ' + e.motivo : e.estado;
}
/* Un mensaje no llegó: queda escrito en su conversación y se le avisa a quien lo pidió (una vez cada 6 h por número). */
function waEntregaFallo_(wa, motivo) {
  var c = CacheService.getScriptCache(), kc = 'entrega_fallo_' + fin8_(wa); if (c.get(kc)) return; c.put(kc, '1', 21600);
  var pend = {}; try { pend = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_PEND') || '{}'); } catch (e) {}
  var P = (pend[fin8_(wa)] || [])[0] || {}, enc = null; try { enc = encargoAbierto_(wa); } catch (e) {}
  var nombre = (enc && enc.persona && !/^\d+$/.test(String(enc.persona)) ? enc.persona : '') || P.nombre || ('+' + wa);
  try { hojaWA_().appendRow([new Date().toISOString(), wa, nombre, 'out', '⚠ No se entregó: ' + motivo, '', 'wa:' + wa, 'sistema', 'sistema', '']); } catch (e) {}
  var adm = (enc && adminPorEmail_(enc.solicitante)) || adminsOp_().filter(function (a) { return a.principal; })[0];
  if (!adm) return;
  var txt = 'No le llegó tu mensaje a ' + nombre + ' (+' + wa + '): ' + motivo + '.\n\nNada de lo que dependía de su respuesta se ha hecho. ¿Lo intento por otra vía (correo o llamada), o prefieres escribirle tú?';
  try { opGuardar_(adm, 'alma', 'whatsapp', txt, [{ tipo: 'mensaje', resumen: 'No entregado · ' + nombre, error: motivo }]); } catch (e) {}
  if (pendAvisar_(adm, txt, { origen: 'entrega', tipo: 'atencion', fallo: motivo })) return;   // al principal: a Pendientes, no por WhatsApp
  var d = (enc && normTel_(enc.solicitante_tel)) || (adm.tels || [])[0]; if (d) { try { waEnviar_(d, txt); } catch (e) {} }
}
/* Robot: plantillas (estado y categoría según Meta) y últimos estados de entrega. */
function waDiag_() {
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID'), tpl = [];
  try {
    var j = JSON.parse(UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates?fields=name,status,category,language&limit=60', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText());
    tpl = (j.data || []).map(function (t) { return t.name + ' · ' + t.language + ' · ' + t.status + ' · ' + t.category; });
  } catch (e) { tpl = ['error: ' + e]; }
  var m = waEntregaMapa_();
  return { ok: true, plantillas: tpl, entregas: Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 25).map(function (e) { return '+' + e.wa.slice(0, 4) + '…' + e.wa.slice(-4) + ' · ' + e.estado + ' · ' + new Date(e.ts).toISOString().slice(0, 16) + (e.motivo ? ' · ' + e.motivo : ''); }) };
}
