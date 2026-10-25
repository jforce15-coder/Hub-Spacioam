/* ═══ RECEPCIÓN DE EDIFICIOS POR WHATSAPP (ALMA) ═══════════════════════════════════════════════════════════
   Cuando el huésped envía su registro en Hola, Hola avisa aquí (body.recepcion) y ALMA manda el PDF del registro,
   con un resumen de la reserva, al WhatsApp de la recepción del edificio (desde el número de ALMA).
   · Hola solo avisa el código: el PDF lo pide ALMA a Hola con la llave del robot (ROBOT_TOKEN), y solo se envía a
     los números de recepción que Hola tiene para esa propiedad. Un aviso falso no puede mandar nada a otro número.
   · Cola en RECEP_COLA (se procesa con procesarCola, cada minuto). Un registro se envía una sola vez; el reenvío
     manual desde el Hub (force) se permite cada 10 min.
   · Plantilla de Meta: registro_recepcion (encabezado DOCUMENTO + 7 variables). Mientras no esté aprobada se usa
     registro_ingreso (la anterior, 5 variables) si existe aprobada en esta cuenta.
   · Si la recepción responde: no entra a ALMA como huésped. Se guarda, se ve en el Hub (tipo recepción) y ALMA
     contesta como mucho una vez cada 12 h recordando que el canal oficial es el grupo o Juan / Gabriel. */

var RECEP_PLANTILLA_ = 'registro_recepcion';
var RECEP_PLANTILLA_VIEJA_ = 'registro_ingreso';

function recepcionEncolar_(body) {
  var code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!code || code.length < 5) return { ok: false, error: 'codigo' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) return { ok: false, error: 'ocupado' };
  try {
    var p = PropertiesService.getScriptProperties(), cola = [], hecho = {};
    try { cola = JSON.parse(p.getProperty('RECEP_COLA') || '[]'); } catch (e) {}
    try { hecho = JSON.parse(p.getProperty('RECEP_HECHO') || '{}'); } catch (e) {}
    var force = !!body.force;
    if (hecho[code] && (!force || Date.now() - hecho[code] < 10 * 60000)) return { ok: true, ya: true };
    if (cola.some(function (x) { return x.code === code; })) return { ok: true, enCola: true };
    cola.push({ code: code, force: force, ts: Date.now() });
    p.setProperty('RECEP_COLA', JSON.stringify(cola.slice(-30)));
    recepcionEstadoGuardar_(code, { e: 'cola' });
  } finally { lock.releaseLock(); }
  return { ok: true, enCola: true };
}

/* Se llama desde procesarCola (cada minuto). Hasta 3 registros por vuelta. */
function recepcionProcesar_() {
  var p = PropertiesService.getScriptProperties(), raw = p.getProperty('RECEP_COLA');
  if (!raw || raw === '[]') return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  var lote = [];
  try {
    var cola = []; try { cola = JSON.parse(raw); } catch (e) {}
    lote = cola.slice(0, 3); p.setProperty('RECEP_COLA', JSON.stringify(cola.slice(3)));
  } finally { lock.releaseLock(); }
  lote.forEach(function (x) {
    var r; try { r = recepcionEnviar_(x.code); } catch (e) { r = { ok: false, error: String(e) }; }
    recepcionLog_(x.code, r);
    recepcionEstadoGuardar_(x.code, r && r.ok ? { e: 'ok', nums: r.nums || [] } : { e: r && r.reintentar && (x.intentos || 0) < 3 ? 'cola' : 'error', det: String((r && r.error) || '').slice(0, 160) });
    if (r && r.ok) {
      var h = {}; try { h = JSON.parse(p.getProperty('RECEP_HECHO') || '{}'); } catch (e) {}
      h[x.code] = Date.now();
      var ks = Object.keys(h).sort(function (a, b) { return h[b] - h[a]; }); ks.slice(300).forEach(function (k) { delete h[k]; });
      p.setProperty('RECEP_HECHO', JSON.stringify(h));
    } else if (r && r.reintentar && (x.intentos || 0) < 3) {
      var c2 = []; try { c2 = JSON.parse(p.getProperty('RECEP_COLA') || '[]'); } catch (e) {}
      c2.push(Object.assign({}, x, { intentos: (x.intentos || 0) + 1 })); p.setProperty('RECEP_COLA', JSON.stringify(c2.slice(-30)));
    }
  });
}

function recepcionEnviar_(code, soloA) {
  var robot = PropertiesService.getScriptProperties().getProperty('ROBOT_TOKEN');
  if (!robot) return { ok: false, error: 'falta ROBOT_TOKEN en el Hub' };
  var W = waCfg_(); if (!W.token || !W.phoneId) return { ok: false, error: 'WhatsApp de ALMA sin configurar' };
  var rr = UrlFetchApp.fetch(holaUrl_(), { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'regPdfRobot', code: code, robot: robot }) });
  var d = {}; try { d = JSON.parse(rr.getContentText()); } catch (e) { return { ok: false, error: 'Hola no respondió', reintentar: true }; }
  if (!d.ok) return { ok: false, error: 'Hola: ' + (d.error || 'sin registro'), reintentar: d.error !== 'registro-no-encontrado' && d.error !== 'token' };
  var nums = (d.whatsapps || []).map(function (n) { return String(n).replace(/\D/g, ''); }).filter(function (n) { return n.length >= 8; });
  if (!nums.length) return { ok: false, error: 'la propiedad no tiene WhatsApp de recepción' };
  if (soloA) nums = [String(soloA).replace(/\D/g, '')];   // prueba: solo a este número
  var blob = Utilities.newBlob(Utilities.base64Decode(d.pdfB64), 'application/pdf', d.filename || ('Registro-' + code + '.pdf'));
  var up = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + W.phoneId + '/media', { method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: { messaging_product: 'whatsapp', type: 'application/pdf', file: blob } });
  var mid = ''; try { mid = JSON.parse(up.getContentText()).id || ''; } catch (e) {}
  if (!mid) return { ok: false, error: 'Meta no aceptó el PDF · HTTP ' + up.getResponseCode() + ' · ' + up.getContentText().slice(0, 200), reintentar: true };
  var m = d.meta || {}, tpl = recepcionPlantillaUsar_();
  if (!tpl) return { ok: false, error: 'ninguna plantilla de registro aprobada todavía (' + RECEP_PLANTILLA_ + ')', reintentar: false };
  var vars = tpl === RECEP_PLANTILLA_
    ? [m.propiedad, m.principal || '—', code, m.ingreso, m.salida, String(m.noches || '—'), String(m.huespedes || 0)]
    : [m.propiedad, code, m.ingreso, m.salida, String(m.huespedes || 0)];
  var res = nums.map(function (n) {
    var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + W.token },
      payload: JSON.stringify({ messaging_product: 'whatsapp', to: n, type: 'template', template: { name: tpl, language: { code: 'es' }, components: [
        { type: 'header', parameters: [{ type: 'document', document: { id: mid, filename: blob.getName() } }] },
        { type: 'body', parameters: vars.map(function (v) { return { type: 'text', text: String(v == null || v === '' ? '—' : v).slice(0, 200) }; }) }
      ] } }) });
    var ok = r.getResponseCode() < 300;
    try { hojaWA_().appendRow([new Date().toISOString(), n, 'Recepción', 'out', 'Registro de ingreso · ' + (m.propiedad || '') + ' · ' + code + (ok ? '' : ' · NO SE ENVIÓ'), '', 'wa:' + n, 'document', 'recepcion', '']); } catch (e) {}
    return { n: n, ok: ok, err: ok ? '' : r.getContentText().slice(0, 200) };
  });
  if (!soloA) recepcionRecordar_(nums, m.propiedad);
  var bien = res.filter(function (x) { return x.ok; }).length;
  return { ok: bien > 0, enviados: bien, total: res.length, nums: res.filter(function (x) { return x.ok; }).map(function (x) { return x.n; }), plantilla: tpl, error: bien === res.length ? '' : res.filter(function (x) { return !x.ok; }).map(function (x) { return '…' + x.n.slice(-4) + ': ' + x.err; }).join(' | ') };
}

function recepcionLog_(code, r) {
  try {
    var ss = ssAlma_(), sh = ss.getSheetByName('ALMA_RECEPCION');
    if (!sh) { sh = ss.insertSheet('ALMA_RECEPCION'); sh.appendRow(['fecha', 'codigo', 'resultado', 'enviados', 'plantilla', 'detalle']); }
    sh.appendRow([new Date().toISOString(), code, r && r.ok ? 'OK' : 'ERROR', r && r.enviados != null ? r.enviados + ' de ' + r.total : '', (r && r.plantilla) || '', String((r && r.error) || '').slice(0, 400)]);
  } catch (e) { console.error('recepcionLog_: ' + e); }
}

/* Números de recepción conocidos: los que Hola tiene por propiedad (caché 6 h) + a los que ya enviamos registros. */
function recepcionRecordar_(nums, prop) {
  try {
    var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('RECEP_NUMS') || '{}'); } catch (e) {}
    nums.forEach(function (n) { m[fin8_(n)] = { n: n, prop: prop || (m[fin8_(n)] || {}).prop || '' }; });
    p.setProperty('RECEP_NUMS', JSON.stringify(m));
  } catch (e) {}
}
function recepcionNumeros_() {
  var c = CacheService.getScriptCache(), hit = c.get('recep_nums');
  var m = {}; try { m = JSON.parse(PropertiesService.getScriptProperties().getProperty('RECEP_NUMS') || '{}'); } catch (e) {}
  var hola = null;
  if (hit) { try { hola = JSON.parse(hit); } catch (e) {} }
  if (!hola) {
    hola = {};
    try {
      var r = UrlFetchApp.fetch(holaUrl_(), { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: JSON.stringify({ action: 'listContacts' }) });
      var j = JSON.parse(r.getContentText());
      (j.properties || []).forEach(function (pr) { (pr.whatsapps || []).forEach(function (w) { hola[fin8_(w)] = { n: String(w).replace(/\D/g, ''), prop: pr.name || '' }; }); });
      if (j.admin) delete hola[fin8_(j.admin)];
      c.put('recep_nums', JSON.stringify(hola), 21600);
    } catch (e) { console.error('recepcionNumeros_: ' + e); }
  }
  return Object.assign({}, hola, m);
}
function recepcionDe_(wa) {
  try { return recepcionNumeros_()[fin8_(wa)] || null; } catch (e) { return null; }
}

/* La recepción respondió al número de ALMA. */
function recepcionEntrante_(wa, nombre, texto, ts, media, msgId, rec) {
  var conv = 'wa:' + wa, edificio = (rec && rec.prop) || '';
  hojaWA_().appendRow([ts, wa, nombre, 'in', String(texto).slice(0, 4000), msgId, conv, 'text', 'recepcion', (media || []).join(' ')]);
  inboxUpsert_(conv, { huesped: nombre || ('Recepción ' + edificio).trim(), propiedad: 'Recepción' + (edificio ? ' · ' + edificio : ''), tipo: 'recepcion', canal: 'whatsapp', wa: wa,
    ultimo_canal: 'whatsapp', ultimo_texto: String(texto).slice(0, 300), ultimo_de: 'guest', ultimo_ts: ts, ultimo_guest_ts: ts });
  try { pushNuevo_(conv, 'Recepción' + (edificio ? ' · ' + edificio : ''), 'WhatsApp de ALMA', texto); } catch (e) {}
  var k = 'recep_resp_' + fin8_(wa);
  if (vGet_(k) && Date.now() - Number(vGet_(k)) < 12 * 3600000) return;
  var corto = /^\s*(ok|oki|okay|okey|listo|recibido|recibida|enterado|enterada|gracias|muchas gracias|perfecto|de acuerdo|va|sale|👍|🙏|✅|👌)[\s.!¡,🙏👍✅👌]*$/i.test(String(texto));
  var msg = corto
    ? '¡Gracias! 🙌 Les recordamos que este número es solo para enviarles los registros de ingreso. Para cualquier consulta o comentario, escríbannos en el grupo de Spacio AM o directamente a Juan o Gabriel.'
    : 'Hola, gracias por escribir. Este número es solo para enviarles los registros de ingreso y no lo atendemos como chat. Para que todo el equipo lo vea, por favor escríbannos en el grupo de Spacio AM o directamente a Juan o Gabriel. ¡Gracias!';
  waEnviar_(wa, msg);
  vSet_(k, String(Date.now()));
  try { hojaWA_().appendRow([new Date().toISOString(), wa, 'ALMA', 'out', msg, '', conv, 'text', 'recepcion', '']); } catch (e) {}
  try { inboxUpsert_(conv, { ultimo_texto: msg.slice(0, 300), ultimo_de: 'host', ultimo_ts: new Date().toISOString(), ultimo_host_ts: new Date().toISOString(), ultimo_canal: 'whatsapp' }); } catch (e) {}
}

/* ── Plantillas de Meta ── */
function recepcionPlantillas_() {
  var c = CacheService.getScriptCache(), hit = c.get('recep_tpl'); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID'), out = {};
  if (!W.token || !waba) return out;
  var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates?fields=name,status,language,rejected_reason&limit=200', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  (j.data || []).forEach(function (t) { if ((t.name === RECEP_PLANTILLA_ || t.name === RECEP_PLANTILLA_VIEJA_) && String(t.language || '').indexOf('es') === 0) out[t.name] = { status: t.status, motivo: t.rejected_reason || '' }; });
  if (j.error) out._error = String(j.error.message || '').slice(0, 200);
  c.put('recep_tpl', JSON.stringify(out), 600);
  return out;
}
function recepcionPlantillaUsar_() {
  var t = recepcionPlantillas_();
  if (t[RECEP_PLANTILLA_] && t[RECEP_PLANTILLA_].status === 'APPROVED') return RECEP_PLANTILLA_;
  if (t[RECEP_PLANTILLA_VIEJA_] && t[RECEP_PLANTILLA_VIEJA_].status === 'APPROVED') return RECEP_PLANTILLA_VIEJA_;
  return '';
}
function recepcionPlantillaCrear_() {
  var W = waCfg_(), p = PropertiesService.getScriptProperties(), waba = p.getProperty('WA_WABA_ID');
  if (!W.token || !waba) return { ok: false, error: 'faltan WA_TOKEN o WA_WABA_ID' };
  CacheService.getScriptCache().remove('recep_tpl');
  var ya = recepcionPlantillas_(); if (ya[RECEP_PLANTILLA_]) return { ok: true, ya: ya[RECEP_PLANTILLA_] };
  var appId = p.getProperty('WA_APP_ID') || '';
  if (!appId) { try { appId = JSON.parse(UrlFetchApp.fetch('https://graph.facebook.com/v21.0/app', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText()).id || ''; } catch (e) {} }
  if (!appId) return { ok: false, error: 'no encontré el ID de la app de Meta (agrega WA_APP_ID)' };
  var html = '<html><body style="font-family:Arial;padding:40px"><h2>Spacio AM · Registro de ingreso</h2><p>Propiedad: Ejemplo</p><p>Reserva: HMEJEMPLO</p></body></html>';
  var bytes = Utilities.newBlob(html, 'text/html', 'e.html').getAs('application/pdf').getBytes();
  var ses = JSON.parse(UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + appId + '/uploads?file_name=registro-ejemplo.pdf&file_length=' + bytes.length + '&file_type=application/pdf',
    { method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText() || '{}');
  if (!ses.id) return { ok: false, error: 'Meta no abrió la subida del ejemplo: ' + JSON.stringify(ses).slice(0, 300) };
  var up = JSON.parse(UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + ses.id, { method: 'post', muteHttpExceptions: true, contentType: 'application/pdf',
    headers: { Authorization: 'OAuth ' + W.token, file_offset: '0' }, payload: bytes }).getContentText() || '{}');
  if (!up.h) return { ok: false, error: 'Meta no aceptó el PDF de ejemplo: ' + JSON.stringify(up).slice(0, 300) };
  var body = {
    name: RECEP_PLANTILLA_, language: 'es', category: 'UTILITY',
    components: [
      { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [up.h] } },
      { type: 'BODY', text: 'Nuevo registro de ingreso de Spacio AM.\n\nPropiedad: {{1}}\nHuésped principal: {{2}}\nReserva: {{3}}\nIngreso: {{4}}\nSalida: {{5}}\nNoches: {{6}}\nHuéspedes: {{7}}\n\nAdjuntamos el formulario con los datos y documentos de identificación. Este número solo envía registros: para cualquier consulta, escríbannos en el grupo de Spacio AM o directamente a Juan o Gabriel. Gracias.',
        example: { body_text: [['Z10 · Ignacio 1206', 'Ana López', 'HMEJEMPLO', '24 oct 2026 · 3:00 PM', '26 oct 2026 · 11:00 AM', '2', '3']] } },
      { type: 'FOOTER', text: 'Spacio AM · hola.spacioam.com' }
    ]
  };
  var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(body) });
  CacheService.getScriptCache().remove('recep_tpl');
  return { ok: r.getResponseCode() < 300, http: r.getResponseCode(), respuesta: r.getContentText().slice(0, 400) };
}
function recepcionEstado_() {
  CacheService.getScriptCache().remove('recep_tpl');
  var p = PropertiesService.getScriptProperties(), sh = null, ult = [];
  try { sh = ssAlma_().getSheetByName('ALMA_RECEPCION'); if (sh && sh.getLastRow() > 1) ult = sh.getRange(Math.max(2, sh.getLastRow() - 9), 1, Math.min(10, sh.getLastRow() - 1), 6).getValues().map(function (v) { return { fecha: v[0], resultado: v[2], enviados: v[3], plantilla: v[4], detalle: String(v[5]).slice(0, 160) }; }); } catch (e) {}
  return { ok: true, plantillas: recepcionPlantillas_(), usa: recepcionPlantillaUsar_(), robot: !!p.getProperty('ROBOT_TOKEN'), cola: JSON.parse(p.getProperty('RECEP_COLA') || '[]').length, recepciones: Object.keys(recepcionNumeros_()).length, ultimos: ult };
}

/* Estado del envío a recepción por código, para los botones del panel de Hola (verde = entregado, rojo = no llegó).
   Guarda lo último de cada código y lo cruza con la entrega real que avisa Meta (entrega.js). */
function recepcionEstadoGuardar_(code, o) {
  try {
    var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('RECEP_EST') || '{}'); } catch (e) {}
    m[code] = Object.assign({ ts: Date.now() }, o);
    var ks = Object.keys(m); if (ks.length > 300) ks.sort(function (a, b) { return m[a].ts - m[b].ts; }).slice(0, ks.length - 300).forEach(function (k) { delete m[k]; });
    p.setProperty('RECEP_EST', JSON.stringify(m));
  } catch (e) { console.error('recepcionEstadoGuardar_: ' + e); }
}
function recepcionEstados_(codes) {
  var m = {}; try { m = JSON.parse(PropertiesService.getScriptProperties().getProperty('RECEP_EST') || '{}'); } catch (e) {}
  var out = {};
  (codes || []).slice(0, 200).forEach(function (c) {
    c = String(c || '').trim().toUpperCase(); var x = m[c]; if (!x) return;
    var o = { e: x.e, ts: x.ts, det: x.det || '' };
    if (x.e === 'ok' && (x.nums || []).length) {
      var est = (x.nums || []).map(function (n) { var w = null; try { w = waEntrega_(n); } catch (e) {} return w && w.ts >= x.ts - 60000 ? w : null; });
      var fallo = est.filter(function (w) { return w && w.estado === 'failed'; })[0];
      if (fallo) { o.e = 'no_entregado'; o.det = fallo.motivo || ''; }
      else if (est.length && est.every(function (w) { return w && (w.estado === 'delivered' || w.estado === 'read'); })) o.e = est.every(function (w) { return w.estado === 'read'; }) ? 'leido' : 'entregado';
    }
    out[c] = o;
  });
  return { ok: true, estados: out };
}
