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
  /* Un seguimiento (volver a escribirle) no duplica el mensaje que le llegará: se guarda una sola vez, con la fecha del primero. */
  var k = fin8_(wa), tx = String(texto).slice(0, 3500), prev = (pend[k] || []).filter(function (m) { return m.texto === tx; })[0];
  pend[k] = (pend[k] || []).filter(function (m) { return m.texto !== tx; }); pend[k].push({ texto: tx, ts: prev ? prev.ts : Date.now(), nombre: o.nombre || '' });
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
  L.forEach(function (m) { var r = waEnviar_(wa, m.texto); if (r && r.ok) { contactoRegistrar_(wa, m.nombre, m.texto); try { personalNotar_(wa, 'alma', m.texto); } catch (e) {} } });
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

function personalEnviar_(adm, persona, numero, texto, objetivo, contexto, proyecto) {
  var wa = normTel_(numero); if (!wa) return { ok: false, error: 'número inválido' };
  var nombre = String(persona || '').trim(), primer = /^[+\d]/.test(nombre) || !nombre ? '' : nombre.split(' ')[0];
  var de = (adm && adm.nombre ? String(adm.nombre).split(' ')[0] : 'Juan');
  var prev = personalDe_(wa) || {};
  var proy = proyecto ? proyAsegurar_(adm, proyecto, objetivo) : (prev.proy || '');
  if (proyecto && prev.proy && prev.proy !== proy) prev.h = [];   // cambió de proyecto: la conversación empieza de nuevo
  personalRelay_(wa, { proy: proy, nombre: nombre || prev.nombre || '+' + wa, dest: (adm && (adm.tels || [])[0]) || CFG.WHATSAPP_JUAN || prev.dest || '', adm: (adm && adm.email) || prev.adm || '', de: de,
    objetivo: objetivo ? String(objetivo).slice(0, 1500) : (prev.objetivo || ''), ctx: contexto ? String(contexto).slice(0, 4000) : (prev.ctx || ''), h: prev.h || [], fin: objetivo ? false : !!prev.fin });
  var abierta = false; try { abierta = waVentana_(wa); } catch (e) {}
  if (abierta) {
    var r = waEnviar_(wa, texto);
    if (r && r.ok) { contactoRegistrar_(wa, nombre, texto); personalNotar_(wa, 'alma', texto); return { ok: true, modo: 'texto' }; }
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

/* Historial corto de la conversación personal (últimos 16 mensajes) dentro del mismo registro. */
function personalNotar_(wa, quien, texto) {
  var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('WA_RELAY') || '{}'); } catch (e) {}
  var r = m[fin8_(wa)]; if (!r) return;
  r.h = (r.h || []).concat([{ q: quien, t: String(texto).slice(0, 700), ts: Date.now() }]).slice(-16);
  p.setProperty('WA_RELAY', JSON.stringify(m));
  if (r.proy) proyNotar_(r.proy, r.nombre, r.wa, quien === 'alma' ? 'alma' : 'persona', texto);
}
function personalAvisar_(rel, texto, resumen) {
  var adm = null; try { adm = rel.adm ? adminPorEmail_(rel.adm) : null; } catch (e) {}
  if (adm) { try { opGuardar_(adm, 'alma', 'whatsapp', texto, [{ tipo: 'mensaje', resumen: resumen }]); } catch (e) {} }
  if (rel.dest) { var r = waEnviar_(rel.dest, texto); if (!(r && r.ok)) console.error('aviso personal: ' + (r && r.error)); }
}

/* La persona respondió (el mensaje guardado ya salió con waPendienteSoltar_).
   · Con objetivo («recopila su itinerario…»): ALMA conversa como la asistente de Juan hasta reunirlo todo, sin
     inventar ni decidir nada; si pregunta algo que solo Juan sabe, se lo pasa. Al terminar, le manda el resumen.
   · Sin objetivo (o ya cumplido): lo que escriba se le reenvía a Juan tal cual. */
function personalEntrante_(wa, nombre, texto, ts, media, msgId, rel) {
  try { hojaWA_().appendRow([ts, wa, nombre, 'in', String(texto).slice(0, 4000), msgId, 'wa:' + wa, 'text', 'personal', (media || []).join(' ')]); } catch (e) {}
  personalNotar_(wa, 'ella', texto);
  var quien = rel.nombre || nombre || ('+' + wa), de = rel.de || 'Juan';
  if (!rel.objetivo || rel.fin) { personalAvisar_(rel, quien + ' respondió:\n\n' + texto + '\n\n(Dime qué le contesto y se lo escribo.)', 'Respuesta de ' + quien); return; }
  var r2 = personalDe_(wa) || rel, hist = (r2.h || []).map(function (x) { return (x.q === 'alma' ? 'ALMA' : quien) + ': ' + x.t; }).join('\n');
  var sys = 'Eres Alma, la asistente personal de ' + de + '. Conversas por WhatsApp con ' + quien + ' para cumplir un encargo PERSONAL de ' + de + ' (no es tema de ningún negocio: nunca menciones Spacio AM ni hables de alquileres). ' +
    'Tono cálido, natural y breve, como una asistente de confianza; tutea si la otra persona tutea. Una o dos preguntas por mensaje, no un formulario. ' +
    'No inventes datos ni tomes decisiones por ' + de + ': si preguntan algo que no sabes o que debe decidir ' + de + ', di que se lo consultas y márcalo en para_juan. ' +
    'Cuando tengas todo lo que pide el objetivo (o la persona no puede/no quiere dar más), agradece, despídete en una línea y marca completo. ' +
    'Responde SOLO JSON: {"respuesta":"mensaje para ' + quien + ' (vacío si no hace falta responder)","para_juan":"pregunta o dato urgente para ' + de + ' (vacío si nada)","completo":true|false,"resumen":"si completo: resumen ordenado para ' + de + ' con todo lo reunido (fechas, horas, números, detalles), en viñetas «· »; si hay CONTEXTO de otras personas, intégralo y señala diferencias o datos que se contradicen"}';
  var usr = 'OBJETIVO DEL ENCARGO: ' + rel.objetivo + (r2.proy ? '\n\n' + proyContexto_(r2.proy, wa) + '\n(Usa el contexto del proyecto para no repetir lo que ya se sabe, completar lo que falta y contrastar.)' : r2.ctx ? '\n\nCONTEXTO (lo que ya se habló con otras personas sobre este tema; úsalo para no volver a preguntar lo que ya se sabe, para contrastar y para completar):\n' + r2.ctx : '') + '\n\nCONVERSACIÓN HASTA AHORA:\n' + hist;
  var out = {};
  try { var raw = String(claude_(CFG.MODELO_REDACTOR, 900, sys, usr, 0.4) || ''); out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { out = {}; }
  if (!out || (out.respuesta == null && !out.completo)) { personalAvisar_(rel, quien + ' respondió:\n\n' + texto + '\n\n(No pude seguir la conversación sola; dime qué le contesto.)', 'Respuesta de ' + quien); return; }
  if (String(out.respuesta || '').trim()) {
    var w = waEnviar_(wa, String(out.respuesta).trim());
    if (w && w.ok) { contactoRegistrar_(wa, quien, out.respuesta); personalNotar_(wa, 'alma', out.respuesta); }
  }
  if (String(out.para_juan || '').trim()) personalAvisar_(rel, quien + ' pregunta algo que debes decidir tú:\n\n' + String(out.para_juan).trim() + '\n\n(Dime qué le respondo.)', 'Consulta de ' + quien);
  if (out.completo) {
    var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('WA_RELAY') || '{}'); } catch (e) {}
    if (m[fin8_(wa)]) { m[fin8_(wa)].fin = true; p.setProperty('WA_RELAY', JSON.stringify(m)); }
    if (r2.proy) {
      var cons = ''; try { cons = proyActualizarResumen_(r2.proy, de); } catch (e) {}
      personalAvisar_(rel, 'Listo, hablé con ' + quien + '. Proyecto «' + r2.proy + '» actualizado con todo lo que se sabe:\n\n' + String(cons || out.resumen || '(sin resumen)').trim(), 'Proyecto ' + r2.proy + ' · ' + quien);
    } else personalAvisar_(rel, 'Listo, hablé con ' + quien + '. Esto es lo que reuní:\n\n' + String(out.resumen || '(sin resumen)').trim(), 'Encargo personal cumplido · ' + quien);
  }
}

/* Robot: poner o cambiar el objetivo de una conversación personal ya iniciada. */
function personalObjetivo_(wa, objetivo) {
  var p = PropertiesService.getScriptProperties(), m = {}; try { m = JSON.parse(p.getProperty('WA_RELAY') || '{}'); } catch (e) {}
  var r = m[fin8_(wa)]; if (!r) return { ok: false, error: 'no hay conversación personal con ese número' };
  r.objetivo = String(objetivo || '').slice(0, 1500); r.fin = false; p.setProperty('WA_RELAY', JSON.stringify(m));
  return { ok: true, nombre: r.nombre, historial: (r.h || []).length };
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

/* Texto de las conversaciones personales con otras personas (por nombre), para dar contexto a una nueva. */
function personalContextoDe_(nombres) {
  return [].concat(nombres || []).map(function (n) {
    var r = personalPorNombre_(String(n)); if (!r) return '';
    var h = (r.h || []).map(function (x) { return (x.q === 'alma' ? 'ALMA' : r.nombre) + ': ' + x.t; }).join('\n');
    return h ? '— Conversación con ' + r.nombre + ':\n' + h : '';
  }).filter(Boolean).join('\n\n').slice(0, 4000);
}
