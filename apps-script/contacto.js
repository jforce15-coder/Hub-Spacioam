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
