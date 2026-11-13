/* ═══ REINTENTO A NÚMEROS +1 (Meta 131049) ════════════════════════════════════════════════════════════════
   A los números de EE. UU. y Canadá (+1) Meta no les entrega plantillas que trata como marketing: avisa después con
   el código 131049 y el mensaje nunca llega. Juan (12-nov): «cuando falle… que se use automáticamente la plantilla
   aprobada que usamos para números de EE. UU., como la de los socios de Brunelo 705». Y: «no estamos haciendo ningún
   contacto que no sea para personas que ya tengan cierta relación con nosotros (socios, nuevos o potenciales socios);
   podríamos manejar la misma plantilla o una similar alternativa».
   Así queda (una sola vez por número cada 6 h, nunca en bucle):
   · Socio registrado (socioDe_): se reintenta con la plantilla para socios (socios.js).
   · Nuevo o potencial socio (todavía sin cuenta): la plantilla de seguimiento, seguimiento_socio, de categoría
     Utilidad, parecida a la de socios pero sin «tu cuenta de propietario» (no la tiene todavía). El Hub la crea y la
     revisa sola, en inglés (en_US, la principal para los +1) y en español.
   · Si la que falló ya era una de estas, o la de seguimiento no está aprobada, Alma avisa como siempre (waEntregaFallo_).
   El mensaje completo queda guardado y le llega cuando responda (waPendienteSoltar_). */

var SEGUIM_PLANTILLA_ = 'seguimiento_socio';
var SEGUIM_TPL_IDIOMAS_ = ['en_US', 'es'];
var SEGUIM_TPL_TEXTOS_ = {
  en_US: { cuerpo: 'Hi {{1}}, this is Alma from Spacio AM, following up on our conversation about {{2}}. Detail: {{3}}. Reply to this message to receive the full information.',
    ej: ['Jorge', 'Brunelo 705', 'the proposal you asked for is ready'], pie: 'Spacio AM · follow-up' },
  es: { cuerpo: 'Hola {{1}}, soy Alma de Spacio AM y te escribo para dar seguimiento a nuestra conversación sobre {{2}}. Detalle: {{3}}. Responde a este mensaje para recibir la información completa.',
    ej: ['Jorge', 'Brunelo 705', 'la propuesta que pediste está lista'], pie: 'Spacio AM · seguimiento' }
};

function masUno_(wa) { return /^1\d{10}$/.test(String(normTel_(wa) || '')); }

/* Los mensajes que ya salieron con una de estas plantillas: si Meta los rechaza, no se reintenta con la misma. */
function masUnoMarcar_(rr, cual) {
  try { var id = ((JSON.parse(rr.getContentText()).messages || [])[0] || {}).id; if (id) CacheService.getScriptCache().put('wa_tpl_' + id, cual, 21600); } catch (e) {}
}

/* Idiomas de seguimiento_socio aprobados como Utilidad: { en_US: bool, es: bool } (guardado 6 h; 10 min si falta alguno). */
function seguimPlantillaOk_() {
  var c = CacheService.getScriptCache(), hit = c.get('tpl_seguim'); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var W = waCfg_(), waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID'), ok = { en_US: false, es: false };
  try {
    var j = JSON.parse(uf_('https://graph.facebook.com/v21.0/' + waba + '/message_templates?name=' + SEGUIM_PLANTILLA_ + '&fields=name,status,language,category', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }).getContentText());
    (j.data || []).forEach(function (t) { if (t.name === SEGUIM_PLANTILLA_ && t.status === 'APPROVED' && t.category === 'UTILITY' && ok.hasOwnProperty(t.language)) ok[t.language] = true; });
  } catch (e) {}
  c.put('tpl_seguim', JSON.stringify(ok), ok.en_US && ok.es ? 21600 : 600);
  return ok;
}

/* El mensaje con seguimiento_socio, listo para Meta. { payload, idioma } o { error }. */
function seguimPayload_(wa, o) {
  var ok = seguimPlantillaOk_();
  if (!ok.en_US && !ok.es) return { error: 'la plantilla de seguimiento (' + SEGUIM_PLANTILLA_ + ') todavía no está aprobada por Meta como Utilidad' };
  var quiereEn = socioIdioma_(wa, o) === 'en', code = quiereEn ? (ok.en_US ? 'en_US' : 'es') : (ok.es ? 'es' : 'en_US'), en = code === 'en_US';
  var nom = String(o.nombre || '').replace(/\(.*?\)/g, ' ').trim(), primer = /^[+\d]/.test(nom) ? '' : socioParam_(nom.split(/\s+/)[0]);
  var tema = socioParam_(o.propiedad) || (en ? 'your property with Spacio AM' : 'tu propiedad con Spacio AM');
  var ps = [primer || (en ? 'there' : 'qué tal'), tema, socioDetalle_(o.texto, en)];
  return { idioma: code, payload: { messaging_product: 'whatsapp', to: normTel_(wa), type: 'template', template: { name: SEGUIM_PLANTILLA_, language: { code: code },
    components: [{ type: 'body', parameters: ps.map(function (v) { return { type: 'text', text: v }; }) }] } } };
}

/* Meta dijo 131049 a un +1: se reintenta una vez con la plantilla que sí le llega. true si salió (no hay que avisar fallo). */
function waReintentoMasUno_(wa, idMsg) {
  wa = normTel_(wa); if (!masUno_(wa)) return false;
  var c = CacheService.getScriptCache(), kc = 'masuno_' + fin8_(wa); if (c.get(kc)) return false;
  var ya = idMsg ? c.get('wa_tpl_' + idMsg) : '';
  /* El texto que no llegó: el guardado para cuando responda (WA_PEND) o el último enviado (WA_ULTIMO, 6 h). */
  var p = PropertiesService.getScriptProperties(), k = fin8_(wa), pend = {}, ult = {};
  try { pend = JSON.parse(p.getProperty('WA_PEND') || '{}'); } catch (e) {}
  try { ult = JSON.parse(p.getProperty('WA_ULTIMO') || '{}')[k] || {}; } catch (e) {}
  var P = (pend[k] || []).slice(-1)[0], texto = (P && P.texto) || (Date.now() - (ult.ts || 0) < 6 * 3600000 ? ult.texto : '');
  if (!texto) return false;
  var soc = socioSeguro_(wa), f = null; try { f = contactoFicha_(wa); } catch (e) {}
  var nombre = (soc && soc.nombre) || (P && P.nombre) || ult.nombre || (f && f.nombre) || '', sp, cual;
  if (soc) {
    if (ya === 'socio') return false;   // ya era la plantilla para socios: no hay otra mejor
    sp = socioPlantillaPayload_(wa, { nombre: nombre, propiedad: soc.propiedad, texto: texto }); cual = 'socio';
  } else {
    if (ya === 'seguim') return false;
    sp = seguimPayload_(wa, { nombre: nombre, propiedad: f && String(f.propiedades || '').split(/[,;\n]/)[0].trim(), texto: texto }); cual = 'seguim';
  }
  if (!sp || sp.error) { console.log('waReintentoMasUno_: ' + (sp && sp.error)); return false; }
  c.put(kc, '1', 21600);
  var W = waCfg_();
  var rr = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(sp.payload) });
  if (rr.getResponseCode() >= 300) { console.error('waReintentoMasUno_: ' + waErrorMeta_(rr.getResponseCode(), rr.getContentText(), wa, !!soc)); return false; }
  masUnoMarcar_(rr, cual);
  /* El mensaje completo queda (o sigue) guardado para cuando responda. */
  if (!P) {
    pend[k] = [{ texto: String(texto).slice(0, 3500), ts: Date.now(), nombre: nombre }];
    p.setProperty('WA_PEND', JSON.stringify(pend));
  }
  contactoRegistrar_(wa, nombre, '[Meta no entregó la primera plantilla (131049, número +1): reintento con ' + (soc ? 'la plantilla para socios' : 'la plantilla de seguimiento') + '] · pendiente: ' + texto);
  return true;
}

/* ── seguimiento_socio se crea sola, como la plantilla para socios ──
   Cada 30 min hasta que Meta decide cada idioma; después, una vez al día por si la recategoriza. Si un idioma no queda
   como Utilidad, le avisa a Juan una sola vez y no la vuelve a mandar. Al aprobarse, le avisa también una vez. */
function seguimPlantillaAsegurar_(forzar) {
  var p = PropertiesService.getScriptProperties(), nom = SEGUIM_PLANTILLA_;
  var est = {}; try { est = JSON.parse(p.getProperty('SEGUIM_TPL_EST') || '{}') || {}; } catch (e) {}
  est.avisos = est.avisos || {};
  var cada = est.fin ? 24 * 3600000 : 30 * 60000;
  if (!forzar && Date.now() - Number(est.rev || 0) < cada) return { ok: true, espera: true };
  est.rev = Date.now();
  var W = waCfg_(), waba = p.getProperty('WA_WABA_ID');
  if (!W.token || !waba) return { ok: false, error: 'faltan WA_TOKEN o WA_WABA_ID' };
  var h = { Authorization: 'Bearer ' + W.token }, base = 'https://graph.facebook.com/v21.0/' + waba + '/message_templates';
  var hay = []; try { hay = JSON.parse(uf_(base + '?name=' + nom + '&fields=name,status,language,category,rejected_reason', { muteHttpExceptions: true, headers: h }).getContentText()).data || []; } catch (e) {}
  var out = { ok: true, plantilla: nom, creadas: [], estado: {} };
  SEGUIM_TPL_IDIOMAS_.forEach(function (lg) {
    var t = hay.filter(function (x) { return x.name === nom && x.language === lg; })[0];
    if (t) {
      est[lg] = { estado: String(t.status || ''), cat: String(t.category || ''), motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? String(t.rejected_reason) : '' };
    } else if (!(est[lg] && est[lg].estado === 'ERROR') || forzar) {   // un error al crearla no se repite solo
      var tx = SEGUIM_TPL_TEXTOS_[lg];
      var r = uf_(base, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: h, payload: JSON.stringify({ name: nom, language: lg, category: 'UTILITY',
        components: [{ type: 'BODY', text: tx.cuerpo, example: { body_text: [tx.ej] } }, { type: 'FOOTER', text: tx.pie }] }) });
      var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
      out.creadas.push(lg + ':' + r.getResponseCode());
      est[lg] = r.getResponseCode() < 300 ? { estado: String(j.status || 'PENDING'), cat: String(j.category || 'UTILITY'), motivo: '' }
        : { estado: 'ERROR', cat: '', motivo: String((j.error && (j.error.error_user_msg || j.error.message)) || ('HTTP ' + r.getResponseCode())).slice(0, 200) };
    }
    out.estado[lg] = est[lg] ? est[lg].estado + (est[lg].cat && est[lg].cat !== 'UTILITY' ? ' · ' + est[lg].cat : '') + (est[lg].motivo ? ' · ' + est[lg].motivo : '') : '';
  });
  var aviso = function (clave, txt) {
    if (est.avisos[clave]) return; est.avisos[clave] = Date.now();
    try { var adm = adminsOp_().filter(function (a) { return a.principal; })[0]; if (adm) vozAvisoPoner_(adm, txt, null, { nivel: 2 }); } catch (e) { console.error('seguim aviso: ' + e); }
  };
  var clase = {}; SEGUIM_TPL_IDIOMAS_.forEach(function (lg) { clase[lg] = socioTplClase_(est[lg]); });
  SEGUIM_TPL_IDIOMAS_.forEach(function (lg) {
    var e = est[lg], idi = SOCIO_TPL_NOMBRE_IDIOMA_[lg];
    if (clase[lg] === 'malo') {
      var mkt = e.cat && e.cat !== 'UTILITY', que = mkt ? 'pasó a ' + (e.cat === 'MARKETING' ? 'Marketing' : e.cat) : e.estado === 'ERROR' ? 'no aceptó' : 'dejó en ' + e.estado;
      aviso('malo:' + lg + ':' + e.estado + ':' + e.cat, 'Meta ' + que + ' la plantilla de seguimiento para nuevos socios en ' + idi + (e.motivo ? ' (' + e.motivo + ')' : '') +
        '. A los números de Estados Unidos que no son socios te seguiré avisando cuando no les llegue. No la vuelvo a mandar: se puede apelar en WhatsApp Manager.');
    } else if (clase[lg] === 'ok') {
      aviso('ok:' + lg, 'Meta aprobó la plantilla de seguimiento para nuevos socios en ' + idi + ' como Utilidad: si a un número de Estados Unidos no le llega un mensaje, la uso sola.');
    }
  });
  if (clase.en_US === 'ok' || clase.es === 'ok') CacheService.getScriptCache().remove('tpl_seguim');
  est.fin = SEGUIM_TPL_IDIOMAS_.every(function (lg) { return clase[lg] !== 'pend'; }) ? (est.fin || Date.now()) : 0;
  p.setProperty('SEGUIM_TPL_EST', JSON.stringify(est));
  out.idiomas = clase;
  return out;
}
