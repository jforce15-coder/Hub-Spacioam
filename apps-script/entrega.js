/* ═══ 18 · ENTREGA REAL DE WHATSAPP ══════════════════════════════════════════════════════════════════
   Que Meta acepte un mensaje no quiere decir que llegue. Meta avisa después (webhook «statuses»): enviado, entregado,
   leído o FALLIDO. Antes solo se anotaba en la consola, así que ALMA decía «enviado» aunque nunca llegara (caso Liliana).
   Ahora: se guarda el último estado de cada número, un fallo queda escrito en su conversación del Hub y se le avisa a
   quien lo pidió, y la secretaria ve el estado real (entregado / leído / no entregado y por qué). */

var ENTREGA_ORDEN_ = { sent: 1, delivered: 2, read: 3 };
function waEntregaMapa_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_ENTREGA') || '{}'); } catch (e) { return {}; } }
/* wa: el número (13-nov: a un +502 le decía «A números de Estados Unidos (+1)…» y Juan contestó que no tenía sentido). */
function waEntregaMotivo_(errs, wa) {
  var e = (errs || [])[0] || {}, c = Number(e.code) || 0, det = String(((e.error_data || {}).details) || e.message || e.title || '').slice(0, 200);
  var masUno = /^1\d{10}$/.test(String(normTel_(wa || '') || ''));
  var M = {
    131049: masUno ? 'Meta no lo entregó. A números de Estados Unidos (+1) Meta no entrega plantillas que clasifica como marketing, y limita los mensajes a quien no ha escrito antes'
      : 'Meta no lo entregó: para cuidar la calidad, limita las plantillas que clasifica como marketing a quien no ha escrito antes o no suele responder (no tiene que ver con el país)',
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
  /* Candado aparte (de usuario): el de script lo tiene la cola de huéspedes mucho rato y el estado se perdía (tryLock
     fallaba y se salía): Alma nunca veía «enviado». Si ni este se consigue, se guarda igual: un estado vale más. */
  var lock = LockService.getUserLock(), tengo = false; try { tengo = lock.tryLock(4000); } catch (e) {}
  if (!tengo) console.warn('waEntregaGuardar_ sin candado: ' + k);
  try {
    var p = PropertiesService.getScriptProperties(), m = waEntregaMapa_(), prev = m[k];
    var nuevo = !prev || ts > prev.ts + 1000 || (prev.id === st.id && (est === 'failed' || (ENTREGA_ORDEN_[est] || 0) > (ENTREGA_ORDEN_[prev.estado] || 0)));
    if (!nuevo) return;
    m[k] = { wa: wa, id: s_(st.id), estado: est, ts: ts, motivo: est === 'failed' ? waEntregaMotivo_(st.errors, wa) : '' };
    var ks = Object.keys(m); if (ks.length > 300) ks.sort(function (a, b) { return m[a].ts - m[b].ts; }).slice(0, ks.length - 300).forEach(function (x) { delete m[x]; });
    p.setProperty('WA_ENTREGA', JSON.stringify(m));
  } finally { if (tengo) lock.releaseLock(); }
  if (est === 'failed') {
    /* 131047 (pasaron las 24 h): no se avisa como fallo; se manda la plantilla y el mensaje sale cuando responda.
       131049 a un +1 (Meta lo trató como marketing): un reintento con la plantilla que sí le llega (masuno.js, #497). */
    var cod = Number((((st.errors || [])[0]) || {}).code) || 0, retomado = false;
    if (cod === 131047) { try { retomado = waRetomarFallido_(wa, s_(st.id)); } catch (e) { console.error('waRetomarFallido_: ' + e); } }
    if (cod === 131049) { try { retomado = waReintentoMasUno_(wa, s_(st.id)); } catch (e) { console.error('waReintentoMasUno_: ' + e); } }
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
    var j = JSON.parse(uf_('https://graph.facebook.com/v21.0/' + waba + '/message_templates?fields=name,status,category,language&limit=60', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText());
    tpl = (j.data || []).map(function (t) { return t.name + ' · ' + t.language + ' · ' + t.status + ' · ' + t.category; });
  } catch (e) { tpl = ['error: ' + e]; }
  var m = waEntregaMapa_();
  return { ok: true, plantillas: tpl, entregas: Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 25).map(function (e) { return '+' + e.wa.slice(0, 4) + '…' + e.wa.slice(-4) + ' · ' + e.estado + ' · ' + new Date(e.ts).toISOString().slice(0, 16) + (e.motivo ? ' · ' + e.motivo : ''); }) };
}

/* ═══ CONFIRMACIÓN REAL ANTES DE DECIR «LISTO» (13-nov) ═════════════════════════════════════════════════════════════
   Juan pidió escribirle a dos socios; Alma dijo que ya estaba y no podía confirmar si salió (no había salido nada). Que
   Meta acepte el pedido (HTTP 200) no es que salió: Meta lo confirma segundos después por el webhook (sent, delivered,
   read o failed). Ahora, al mandar por pedido de un administrador, se espera ese estado unos segundos:
     · enviado, entregado o leído → Alma puede decir «listo» (y si fue la plantilla, que el mensaje sale al responder);
     · fallido → no salió: lo dice con el motivo y queda en Pendientes (waEntregaFallo_);
     · sin estado todavía → «Meta aún no confirma»: nunca «listo». Queda vigilado y, si en 10 min no hay estado, va a
       Pendientes. «¿Le llegó?» se contesta con buscar_contacto (waEstadoContacto_), con el estado real de Meta. */
var WA_ESPERA_MS_ = 6000, WA_VIGILA_MIN_ = 10;
var WA_ESTADO_PALABRA_ = { sent: 'enviado', delivered: 'entregado', read: 'leído', failed: 'fallido' };

/* Espera el estado de Meta de ESE mensaje (por su id). { estado, motivo } o null si no llegó a tiempo. */
function waEntregaEsperar_(wa, id, ms) {
  if (!id) return null;
  var fin = Date.now() + (ms == null ? WA_ESPERA_MS_ : ms);
  for (;;) {
    var e = waEntregaMapa_()[fin8_(wa)];
    if (e && e.id === id && WA_ESTADO_PALABRA_[e.estado]) return { estado: e.estado, motivo: e.motivo || '' };
    if (Date.now() >= fin) return null;
    Utilities.sleep(1000);
  }
}
/* Lo que la herramienta le devuelve a Alma después de mandar (r = resultado de waEnviarAlguien_ o waEnviar_). */
function waConfirmacion_(r, est, nombre) {
  var quien = nombre || 'esa persona', plant = r && r.modo === 'plantilla';
  if (est && est.estado === 'failed') return { ok: false, entrega: 'fallido', error: 'NO SALIÓ: Meta no lo entregó a ' + quien + ' (' + est.motivo + '). Quedó en Pendientes. Díselo así a Juan; nunca digas que se envió.' };
  if (est && WA_ESTADO_PALABRA_[est.estado]) return { ok: true, entrega: WA_ESTADO_PALABRA_[est.estado],
    nota: 'Meta confirmó: ' + WA_ESTADO_PALABRA_[est.estado].toUpperCase() + '. ' + (plant ? 'No había escrito en 24 h: le salió la ' + (r.plantilla || 'plantilla') + ' pidiéndole que responda; el mensaje completo sale en cuanto responda (dilo así).' : 'Ya puedes decir que salió' + (est.estado === 'sent' ? ' (entregado todavía no: eso lo dice Meta después)' : '') + '.') };
  return { ok: true, entrega: 'sin confirmación', nota: 'Meta recibió el pedido pero TODAVÍA NO confirma que salió. NO digas «listo», «enviado» ni «le llegó»: di que lo mandaste y que Meta aún no confirma la salida; si falla, queda en Pendientes y se lo dices.' };
}
/* Mandó y no hubo estado a tiempo: se vigila. Si en 10 min Meta no dice nada de ese mensaje, va a Pendientes. */
function waVigilarAnotar_(wa, id, nombre, adm) {
  if (!id) return;
  try {
    var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('WA_VIGILA') || '{}'); } catch (e) {}
    m[id] = { wa: normTel_(wa), nombre: String(nombre || '').slice(0, 60), adm: (adm && adm.email) || '', ts: Date.now() };
    var ks = Object.keys(m); if (ks.length > 40) ks.sort(function (a, b) { return m[a].ts - m[b].ts; }).slice(0, ks.length - 40).forEach(function (k) { delete m[k]; });
    p.setProperty('WA_VIGILA', JSON.stringify(m));
  } catch (e) { console.error('waVigilarAnotar_: ' + e); }
}
function waVigilarRevisar_() {
  var p = PropertiesService.getScriptProperties(), raw = p.getProperty('WA_VIGILA'); if (!raw || raw === '{}') return 0;
  var m = {}; try { m = JSON.parse(raw); } catch (e) { return 0; }
  var mapa = waEntregaMapa_(), avisos = 0, cambio = false;
  Object.keys(m).forEach(function (id) {
    var v = m[id], e = mapa[fin8_(v.wa)];
    if (e && (e.id === id || e.ts > v.ts)) { delete m[id]; cambio = true; return; }   // Meta ya dijo algo (un fallo ya se avisó solo)
    if (Date.now() - v.ts < WA_VIGILA_MIN_ * 60000) return;
    delete m[id]; cambio = true;
    var adm = null; try { adm = (v.adm && adminPorEmail_(v.adm)) || adminsOp_().filter(function (a) { return a.principal; })[0]; } catch (x) {}
    var txt = 'No tengo confirmación de Meta de que salió el WhatsApp a ' + (v.nombre || '+' + v.wa) + ' (hace ' + Math.round((Date.now() - v.ts) / 60000) + ' min). Puede que no le haya llegado. ¿Lo intento otra vez?';
    try { if (adm && pendAvisar_(adm, txt, { origen: 'entrega', tipo: 'atencion', fallo: 'sin confirmación de Meta' })) avisos++; } catch (x) { console.error('waVigilarRevisar_: ' + x); }
  });
  if (cambio) p.setProperty('WA_VIGILA', JSON.stringify(m));
  return avisos;
}

/* «¿Le llegó?», «¿ya le escribiste al socio de…?»: lo que de verdad pasó con ese número. h = contactoHistorial_ (del más
   viejo al más nuevo), e = waEntrega_, pend = mensajes guardados en WA_PEND. Sin IA: lo que dice la hoja y Meta. */
function waEstadoResumen_(h, e, pend) {
  h = h || []; pend = pend || [];
  var nuestros = h.filter(function (x) { return x.propio; });
  var ult = nuestros[nuestros.length - 1] || null, resp = h.filter(function (x) { return x.de === 'Contacto'; }).pop() || null;
  var fallo = h.filter(function (x) { return x.de === 'Sistema' && /No se entreg/.test(x.texto); }).pop() || null;
  if (!ult) return { enviado: false, resumen: 'NO se le ha enviado nada por WhatsApp desde el número de Alma. Si Juan cree que sí, dile que no salió nada y ofrece mandarlo ahora.' };
  var plantilla = /^\[plantilla/.test(ult.texto), est = e ? (e.estado === 'read' ? 'LEÍDO' : e.estado === 'delivered' ? 'ENTREGADO' : e.estado === 'sent' ? 'ENVIADO (sin confirmación de entrega)' : e.estado === 'failed' ? 'NO ENTREGADO: ' + e.motivo : e.estado) : 'sin confirmación de Meta';
  var out = { enviado: true, ultimo: { cuando: String(ult.ts).slice(0, 16).replace('T', ' '), texto: String(ult.texto).slice(0, 300) }, estado_meta: est };
  if (fallo && fallo.ts >= ult.ts) out.estado_meta = 'NO ENTREGADO: ' + fallo.texto.replace(/^⚠\s*No se entregó:\s*/, '');
  if (plantilla || pend.length) out.esperando = 'Le salió la plantilla (aviso para que responda); el mensaje completo sale cuando responda.' + (pend.length ? ' AÚN NO RESPONDE.' : '');
  if (resp && resp.ts > ult.ts) out.respondio = { cuando: String(resp.ts).slice(0, 16).replace('T', ' '), texto: String(resp.texto).slice(0, 300) };
  out.resumen = 'Último mensaje de Alma: ' + out.ultimo.cuando + ' · estado de Meta: ' + out.estado_meta + (out.esperando ? ' · ' + out.esperando : '') + (out.respondio ? ' · respondió: «' + out.respondio.texto.slice(0, 120) + '»' : '') +
    '. Repite este estado tal cual: «le llegó» solo con ENTREGADO o LEÍDO.';
  return out;
}
function waEstadoContacto_(wa) {
  wa = normTel_(wa); if (!wa) return { error: 'número inválido' };
  var sh = hojaWA_(), last = sh.getLastRow(), h = [];
  if (last >= 2) {
    var hits = sh.getRange(2, 2, last - 1, 1).createTextFinder(wa).matchEntireCell(true).findAll().map(function (r) { return r.getRow(); }).slice(-40);
    h = hits.map(function (f) { var v = sh.getRange(f, 1, 1, 9).getValues()[0]; return { ts: v[0] instanceof Date ? v[0].toISOString() : String(v[0]), propio: v[3] === 'out' && v[8] !== 'sistema', de: v[8] === 'sistema' ? 'Sistema' : v[3] === 'in' ? 'Contacto' : 'Alma', texto: String(v[4] || ''), conv: String(v[6] || '') }; })
      .filter(function (x) { return !/^(op|dec|relevo):/.test(x.conv); });
  }
  var pend = []; try { pend = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_PEND') || '{}')[fin8_(wa)] || []; } catch (e) {}
  return waEstadoResumen_(h, waEntrega_(wa), pend);
}
