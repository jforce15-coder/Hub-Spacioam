/* ═══ PRIMER CONTACTO POR WHATSAPP ═════════════════════════════════════════════════════════════════════════
   WhatsApp solo deja escribir texto libre a quien nos escribió en las últimas 24 h. A alguien nuevo (o que no ha
   escrito en un día) Meta le rechaza el mensaje, y antes ALMA decía «enviado» igual. Ahora:
   · Dentro de las 24 h: texto libre, como siempre.
   · Fuera: plantilla aprobada contacto_alma («Soy Alma… {{2}} me pidió contactarte… respóndeme este mensaje»)
     y el mensaje completo queda guardado; en cuanto la persona responde, ALMA se lo envía (waPendienteSoltar_).
   · El resultado es real: si Meta lo rechaza, ALMA lo dice. */

var CONTACTO_PLANTILLA_ = 'contacto_alma';

/* Devuelve { ok, modo: 'texto' | 'plantilla', error } */
function waEnviarAlguien_(numero, texto, o) {
  o = o || {};
  var wa = normTel_(numero); if (!wa) return { ok: false, error: 'número inválido' };
  var abierta = false; try { abierta = waVentana_(wa); } catch (e) {}
  if (abierta) {
    var r = waEnviar_(wa, texto);
    if (r && r.ok) { contactoRegistrar_(wa, o.nombre, texto); return { ok: true, modo: 'texto' }; }
    if (!(r && /131047|24 hour|re-engagement/i.test(r.error || ''))) return { ok: false, error: (r && r.error) || 'no salió' };
  }
  var tpl = contactoPlantillaOk_();
  if (!tpl) return { ok: false, error: 'No le puedo escribir: no ha escrito al número de ALMA en las últimas 24 h y la plantilla de primer contacto (' + CONTACTO_PLANTILLA_ + ') aún no está aprobada por Meta.' };
  var W = waCfg_();
  var rr = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: wa, type: 'template', template: { name: CONTACTO_PLANTILLA_, language: { code: 'es' }, components: [
      { type: 'body', parameters: [/^[+\d]/.test(String(o.nombre || '')) || !o.nombre ? 'qué tal' : String(o.nombre).split(' ')[0], String(o.de || 'Spacio AM')].map(function (v) { return { type: 'text', text: v.slice(0, 60) }; }) }] } }) });
  if (rr.getResponseCode() >= 300) return { ok: false, error: 'Meta rechazó la plantilla: ' + rr.getContentText().slice(0, 200) };
  var p = PropertiesService.getScriptProperties(), pend = {}; try { pend = JSON.parse(p.getProperty('WA_PEND') || '{}'); } catch (e) {}
  var k = fin8_(wa); (pend[k] = pend[k] || []).push({ texto: String(texto).slice(0, 3500), ts: Date.now(), nombre: o.nombre || '' });
  Object.keys(pend).forEach(function (x) { pend[x] = pend[x].filter(function (m) { return Date.now() - m.ts < 7 * 86400000; }).slice(-3); if (!pend[x].length) delete pend[x]; });
  p.setProperty('WA_PEND', JSON.stringify(pend));
  contactoRegistrar_(wa, o.nombre, '[plantilla de primer contacto] · pendiente: ' + texto);
  return { ok: true, modo: 'plantilla' };
}

/* Alguien respondió: si tenía mensajes guardados, se le envían ahora (ya hay ventana de 24 h). */
function waPendienteSoltar_(wa) {
  var p = PropertiesService.getScriptProperties(), raw = p.getProperty('WA_PEND'); if (!raw || raw === '{}') return;
  var pend = {}; try { pend = JSON.parse(raw); } catch (e) { return; }
  var k = fin8_(wa), L = pend[k]; if (!L || !L.length) return;
  delete pend[k]; p.setProperty('WA_PEND', JSON.stringify(pend));
  L.forEach(function (m) { var r = waEnviar_(wa, m.texto); if (r && r.ok) contactoRegistrar_(wa, m.nombre, m.texto); });
}

function contactoRegistrar_(wa, nombre, texto) {
  try { hojaWA_().appendRow([new Date().toISOString(), wa, nombre || '', 'out', String(texto).slice(0, 4000), '', 'wa:' + wa, 'text', 'alma', '']); } catch (e) {}
}

function contactoPlantillaOk_() {
  var c = CacheService.getScriptCache(), hit = c.get('tpl_contacto'); if (hit) return hit === '1';
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID'), ok = false;
  try {
    var j = JSON.parse(UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates?name=' + CONTACTO_PLANTILLA_ + '&fields=name,status,language', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText());
    ok = (j.data || []).some(function (t) { return t.name === CONTACTO_PLANTILLA_ && t.status === 'APPROVED'; });
  } catch (e) {}
  c.put('tpl_contacto', ok ? '1' : '0', ok ? 21600 : 600);
  return ok;
}
function contactoPlantillaCrear_() {
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID');
  if (!W.token || !waba) return { ok: false, error: 'faltan WA_TOKEN o WA_WABA_ID' };
  CacheService.getScriptCache().remove('tpl_contacto');
  var body = { name: CONTACTO_PLANTILLA_, language: 'es', category: 'UTILITY', components: [
    { type: 'BODY', text: 'Hola {{1}}, soy Alma, la asistente virtual de Spacio AM. {{2}} me pidió contactarte por un tema pendiente. ¿Me respondes este mensaje para darte los detalles? Gracias.',
      example: { body_text: [['Lucía', 'Juan Ovalle']] } },
    { type: 'FOOTER', text: 'Spacio AM' } ] };
  var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(body) });
  return { ok: r.getResponseCode() < 300, http: r.getResponseCode(), respuesta: r.getContentText().slice(0, 300) };
}

/* ═══ MENSAJES PERSONALES (de parte del administrador, no de Spacio AM) ═════════════════════════════════════
   «Escríbele a Lucky…»: ALMA se presenta como la asistente de Juan (nunca Spacio AM). Si la persona no ha escrito en
   24 h, le llega la plantilla asistente_personal («Hola Lucky, soy Alma, la asistente de Juan. ¿Tienes un minuto?»)
   y, cuando contesta, el mensaje completo. Durante 7 días, lo que esa persona escriba no entra a ALMA como
   huésped: se le reenvía a quien lo pidió (WhatsApp + su chat con ALMA) y él decide qué responder. */
var PERSONAL_PLANTILLA_ = 'asistente_personal';

function personalEnviar_(adm, persona, numero, texto) {
  var wa = normTel_(numero); if (!wa) return { ok: false, error: 'número inválido' };
  var nombre = String(persona || '').trim(), primer = /^[+\d]/.test(nombre) || !nombre ? '' : nombre.split(' ')[0];
  var de = (adm && adm.nombre ? String(adm.nombre).split(' ')[0] : 'Juan');
  personalRelay_(wa, { nombre: nombre || '+' + wa, dest: (adm && (adm.tels || [])[0]) || CFG.WHATSAPP_JUAN || '', adm: (adm && adm.email) || '' });
  var abierta = false; try { abierta = waVentana_(wa); } catch (e) {}
  if (abierta) {
    var r = waEnviar_(wa, texto);
    if (r && r.ok) { contactoRegistrar_(wa, nombre, texto); return { ok: true, modo: 'texto' }; }
  }
  if (!personalPlantillaOk_()) return { ok: false, error: 'No ha escrito al número de ALMA en las últimas 24 h y la plantilla personal (' + PERSONAL_PLANTILLA_ + ') aún no está aprobada por Meta.' };
  var W = waCfg_();
  var rr = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: wa, type: 'template', template: { name: PERSONAL_PLANTILLA_, language: { code: 'es' }, components: [
      { type: 'body', parameters: [{ type: 'text', text: primer || 'qué tal' }, { type: 'text', text: de }] }] } }) });
  if (rr.getResponseCode() >= 300) return { ok: false, error: 'Meta rechazó la plantilla: ' + rr.getContentText().slice(0, 200) };
  var p = PropertiesService.getScriptProperties(), pend = {}; try { pend = JSON.parse(p.getProperty('WA_PEND') || '{}'); } catch (e) {}
  (pend[fin8_(wa)] = pend[fin8_(wa)] || []).push({ texto: String(texto).slice(0, 3500), ts: Date.now(), nombre: nombre });
  p.setProperty('WA_PEND', JSON.stringify(pend));
  contactoRegistrar_(wa, nombre, '[plantilla personal: ¿tienes un minuto?] · pendiente: ' + texto);
  return { ok: true, modo: 'plantilla' };
}

function personalRelay_(wa, o) {
  var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('WA_RELAY') || '{}'); } catch (e) {}
  m[fin8_(wa)] = Object.assign({ wa: wa, hasta: Date.now() + 7 * 86400000 }, o);
  Object.keys(m).forEach(function (k) { if (!(m[k].hasta > Date.now())) delete m[k]; });
  p.setProperty('WA_RELAY', JSON.stringify(m));
}
function personalDe_(wa) {
  var m = {}; try { m = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}'); } catch (e) {}
  var r = m[fin8_(wa)]; return r && r.hasta > Date.now() ? r : null;
}
/* Para «dile a Lucky…» después: busca entre los contactos personales recientes por nombre. */
function personalPorNombre_(nombre) {
  var m = {}; try { m = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}'); } catch (e) {}
  var L = Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) { return r.hasta > Date.now(); });
  var hit = opMatch_(nombre, L.map(function (r) { return r.nombre; }));
  return hit ? L.filter(function (r) { return r.nombre === hit; })[0] : null;
}

/* La persona respondió: el mensaje completo ya salió (waPendienteSoltar_); aquí se le reenvía a quien lo pidió. */
function personalEntrante_(wa, nombre, texto, ts, media, msgId, rel) {
  try { hojaWA_().appendRow([ts, wa, nombre, 'in', String(texto).slice(0, 4000), msgId, 'wa:' + wa, 'text', 'personal', (media || []).join(' ')]); } catch (e) {}
  var quien = rel.nombre || nombre || ('+' + wa), aviso = quien + ' respondió:\n\n' + texto + '\n\n(Dime qué le contesto y se lo escribo.)';
  var adm = null; try { adm = rel.adm ? adminPorEmail_(rel.adm) : null; } catch (e) {}
  if (adm) { try { opGuardar_(adm, 'alma', 'whatsapp', aviso, [{ tipo: 'mensaje', resumen: 'Respuesta de ' + quien }]); } catch (e) {} }
  if (rel.dest) { var r = waEnviar_(rel.dest, aviso); if (!(r && r.ok)) console.error('aviso personal: ' + (r && r.error)); }
}

function personalPlantillaOk_() {
  var c = CacheService.getScriptCache(), hit = c.get('tpl_personal'); if (hit) return hit === '1';
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID'), ok = false;
  try {
    var j = JSON.parse(UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates?name=' + PERSONAL_PLANTILLA_ + '&fields=name,status', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText());
    ok = (j.data || []).some(function (t) { return t.name === PERSONAL_PLANTILLA_ && t.status === 'APPROVED'; });
  } catch (e) {}
  c.put('tpl_personal', ok ? '1' : '0', ok ? 21600 : 600);
  return ok;
}
function personalPlantillaCrear_() {
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID');
  if (!W.token || !waba) return { ok: false, error: 'faltan WA_TOKEN o WA_WABA_ID' };
  CacheService.getScriptCache().remove('tpl_personal');
  var body = { name: PERSONAL_PLANTILLA_, language: 'es', category: 'UTILITY', components: [
    { type: 'BODY', text: 'Hola {{1}}, soy Alma, la asistente de {{2}}. ¿Tienes un minuto? Tengo un mensaje de su parte para ti.', example: { body_text: [['Lucía', 'Juan']] } } ] };
  var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/message_templates', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(body) });
  return { ok: r.getResponseCode() < 300, http: r.getResponseCode(), respuesta: r.getContentText().slice(0, 300) };
}
