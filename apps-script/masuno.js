/* ═══ NÚMEROS +1: LA PLANTILLA QUE SÍ LES LLEGA (#497) ═══════════════════════════════════════════════════════════
   A los números de EE. UU. y Canadá (+1) Meta no les entrega plantillas que trata como marketing (la de primer contacto,
   contacto_alma): avisa después con el código 131049 y el mensaje nunca llega. Juan (12-nov): «cuando falle… que se use
   automáticamente la plantilla aprobada que usamos para números de EE. UU., como la de los socios de Brunelo 705». Y:
   «no estamos haciendo ningún contacto que no sea para personas que ya tengan cierta relación con nosotros (socios,
   nuevos o potenciales socios); podríamos manejar la misma plantilla o una similar alternativa».
   #505 lo intentó y se cerró porque #524 ya mandaba la plantilla para socios a los socios +1. Faltaba lo demás:
     · Antes de mandar: a un +1 que NO es socio (nuevo o potencial socio) ya no le sale la de primer contacto (Marketing,
       no le llega) si la plantilla de seguimiento está aprobada: sale esa (waEnviarAlguien_, contacto.js).
     · Si Meta igual avisa 131049 a un +1: se reintenta UNA vez (por número, cada 6 h) con la plantilla que le llega: la
       para socios si es socio, la de seguimiento si no. Si lo que falló ya era esa, o no hay ninguna aprobada, Alma
       avisa como siempre (waEntregaFallo_). El mensaje completo queda guardado y le llega cuando responda.
   La plantilla de seguimiento (seguimiento_socio, Utilidad, en inglés y español) se parece a la de socios sin «tu cuenta
   de propietario» (un potencial socio no la tiene). El Hub la crea y la revisa sola, como la de socios (socios.js), y le
   avisa a Juan una vez cuando Meta la aprueba o si la rechaza o la pasa a Marketing. */

var SEGUIM_PLANTILLA_ = 'seguimiento_socio';
var SEGUIM_TPL_IDIOMAS_ = ['en_US', 'es'];
var SEGUIM_TPL_TEXTOS_ = {
  en_US: { cuerpo: 'Hi {{1}}, this is Alma from Spacio AM, following up on our conversation about {{2}}. Detail: {{3}}. Reply to this message to receive the full information.',
    ej: ['Jorge', 'Brunelo 705', 'the proposal you asked for is ready'], pie: 'Spacio AM · follow-up' },
  es: { cuerpo: 'Hola {{1}}, soy Alma de Spacio AM y te escribo para dar seguimiento a nuestra conversación sobre {{2}}. Detalle: {{3}}. Responde a este mensaje para recibir la información completa.',
    ej: ['Jorge', 'Brunelo 705', 'la propuesta que pediste está lista'], pie: 'Spacio AM · seguimiento' }
};
var MASUNO_HORAS_ = 6;

function masUno_(wa) { return /^1\d{10}$/.test(String(normTel_(wa) || '')); }

/* Qué plantilla llevaba un mensaje que salió (por su id de Meta): 'socio' o 'seguim'. Así un 131049 de esa misma no se
   reintenta con la misma. 6 h, lo que dura la ventana del reintento. */
function masUnoMarcar_(id, cual) { if (id && cual) { try { CacheService.getScriptCache().put('wa_tpl_' + id, cual, MASUNO_HORAS_ * 3600); } catch (e) {} } }
function masUnoCual_(id) { try { return id ? CacheService.getScriptCache().get('wa_tpl_' + id) || '' : ''; } catch (e) { return ''; } }

/* Idiomas de seguimiento_socio aprobados como Utilidad, según lo último que revisó seguimPlantillaAsegurar_ (sin red). */
function seguimPlantillaOk_() {
  var est = {}; try { est = JSON.parse(PropertiesService.getScriptProperties().getProperty('SEGUIM_TPL_EST') || '{}') || {}; } catch (e) {}
  var ok = {}; SEGUIM_TPL_IDIOMAS_.forEach(function (lg) { ok[lg] = socioTplClase_(est[lg]) === 'ok'; });
  return ok;
}

/* El mensaje con seguimiento_socio, listo para Meta. o: nombre, propiedad (el tema), texto, idioma. { payload, idioma } o { error }. */
function seguimPayload_(wa, o) {
  o = o || {};
  var ok = seguimPlantillaOk_();
  if (!ok.en_US && !ok.es) return { error: 'la plantilla de seguimiento (' + SEGUIM_PLANTILLA_ + ') todavía no está aprobada por Meta como Utilidad' };
  var quiereEn = socioIdioma_(wa, o) === 'en', code = quiereEn ? (ok.en_US ? 'en_US' : 'es') : (ok.es ? 'es' : 'en_US'), en = code === 'en_US';
  var nom = String(o.nombre || '').replace(/\(.*?\)/g, ' ').trim(), primer = /^[+\d]/.test(nom) ? '' : socioParam_(nom.split(/\s+/)[0]);
  var tema = socioParam_(o.propiedad) || (en ? 'your property with Spacio AM' : 'tu propiedad con Spacio AM');
  var ps = [primer || (en ? 'there' : 'qué tal'), tema, socioDetalle_(o.texto, en)];
  return { idioma: code, payload: { messaging_product: 'whatsapp', to: normTel_(wa), type: 'template', template: { name: SEGUIM_PLANTILLA_, language: { code: code },
    components: [{ type: 'body', parameters: ps.map(function (v) { return { type: 'text', text: v }; }) }] } } };
}
/* El tema para {{2}}: la primera propiedad de su ficha de contacto, si la tiene. */
function seguimTema_(wa) { var f = null; try { f = contactoFicha_(wa); } catch (e) {} return f ? String(f.propiedades || '').split(/[,;\n]/)[0].trim() : ''; }

/* Meta dijo 131049 a un +1: se reintenta una vez con la plantilla que sí le llega. true si salió (no hay que avisar el fallo). */
function waReintentoMasUno_(wa, idMsg) {
  wa = normTel_(wa); if (!masUno_(wa)) return false;
  var c = CacheService.getScriptCache(), kc = 'masuno_' + fin8_(wa); if (c.get(kc)) return false;   // una vez por número cada 6 h: nunca en bucle
  /* El texto que no llegó: el guardado para cuando responda (WA_PEND) o el último texto libre (WA_ULTIMO, 6 h). */
  var p = PropertiesService.getScriptProperties(), k = fin8_(wa), pend = {}, ult = {};
  try { pend = JSON.parse(p.getProperty('WA_PEND') || '{}'); } catch (e) {}
  try { ult = JSON.parse(p.getProperty('WA_ULTIMO') || '{}')[k] || {}; } catch (e) {}
  var P = (pend[k] || []).slice(-1)[0], texto = (P && P.texto) || (Date.now() - (ult.ts || 0) < MASUNO_HORAS_ * 3600000 ? ult.texto : '');
  if (!texto) return false;
  texto = acortarEnTexto_(texto, 'whatsapp');   // lo guardado sale corto (enlaces.js)
  var ya = masUnoCual_(idMsg), soc = socioSeguro_(wa), nombre = (soc && soc.nombre) || (P && P.nombre) || ult.nombre || '', sp, cual;
  if (!nombre) { try { nombre = (contactoFicha_(wa) || {}).nombre || ''; } catch (e) {} }
  if (soc) { if (ya === 'socio') return false; sp = socioPlantillaPayload_(wa, { nombre: nombre, propiedad: soc.propiedad, texto: texto }); cual = 'socio'; }
  else { if (ya === 'seguim') return false; sp = seguimPayload_(wa, { nombre: nombre, propiedad: seguimTema_(wa), texto: texto }); cual = 'seguim'; }
  if (!sp || sp.error) { console.log('waReintentoMasUno_: ' + (sp && sp.error)); return false; }
  c.put(kc, '1', MASUNO_HORAS_ * 3600);
  var W = waCfg_();
  var rr = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(sp.payload) });
  if (rr.getResponseCode() >= 300) { console.error('waReintentoMasUno_: ' + waErrorMeta_(rr.getResponseCode(), rr.getContentText(), wa, !!soc)); return false; }
  var id = ''; try { id = ((JSON.parse(rr.getContentText()).messages || [])[0] || {}).id || ''; } catch (e) {}
  masUnoMarcar_(id, cual);
  if (!P) {   // el mensaje completo queda guardado para cuando responda (si ya estaba, sigue ahí)
    pend[k] = [{ texto: String(texto).slice(0, 3500), ts: Date.now(), nombre: nombre }];
    p.setProperty('WA_PEND', JSON.stringify(pend));
  }
  contactoRegistrar_(wa, nombre, '[Meta no entregó el primer mensaje a este número +1 (131049): reintento con ' + (soc ? 'la plantilla para socios' : 'la plantilla de seguimiento') + '] · pendiente: ' + texto, '', id);
  return true;
}

/* ── seguimiento_socio se crea sola, como la plantilla para socios ──
   Cada 30 min hasta que Meta decide cada idioma; después, una vez al día por si la recategoriza. Si un idioma no queda
   como Utilidad, le avisa a Juan una sola vez y no la vuelve a mandar. Al aprobarse, le avisa también una vez. Sin
   WA_WABA_ID no va a internet. Desde el Hub: acción seguim_plantilla (fuerza la revisión ahora). */
function seguimPlantillaAsegurar_(forzar) {
  var p = PropertiesService.getScriptProperties(), nom = SEGUIM_PLANTILLA_;
  var est = {}; try { est = JSON.parse(p.getProperty('SEGUIM_TPL_EST') || '{}') || {}; } catch (e) {}
  est.avisos = est.avisos || {};
  var cada = est.fin ? 24 * 3600000 : 30 * 60000;
  if (!forzar && Date.now() - Number(est.rev || 0) < cada) return { ok: true, espera: true };
  var W = waCfg_(), waba = p.getProperty('WA_WABA_ID');
  if (!W.token || !waba) return { ok: false, error: 'faltan WA_TOKEN o WA_WABA_ID' };
  est.rev = Date.now();
  var h = { Authorization: 'Bearer ' + W.token }, base = 'https://graph.facebook.com/v21.0/' + waba + '/message_templates';
  var hay = []; try { hay = JSON.parse(uf_(base + '?name=' + nom + '&fields=name,status,language,category,rejected_reason', { muteHttpExceptions: true, headers: h }).getContentText()).data || []; } catch (e) {}
  var out = { ok: true, plantilla: nom, creadas: [], estado: {} };
  SEGUIM_TPL_IDIOMAS_.forEach(function (lg) {   // inglés primero: es la principal para los números +1
    var t = hay.filter(function (x) { return x.name === nom && x.language === lg; })[0];
    if (t) est[lg] = { estado: String(t.status || ''), cat: String(t.category || ''), motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? String(t.rejected_reason) : '' };
    else if (!(est[lg] && est[lg].estado === 'ERROR') || forzar) {   // un error al crearla no se repite solo: solo con forzar
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
      aviso('ok:' + lg, 'Meta aprobó la plantilla de seguimiento para nuevos socios en ' + idi + ' como Utilidad: a los números de Estados Unidos que no son socios ya les llega, y si alguno falla, la uso sola.');
    }
  });
  est.fin = SEGUIM_TPL_IDIOMAS_.every(function (lg) { return clase[lg] !== 'pend'; }) ? (est.fin || Date.now()) : 0;
  p.setProperty('SEGUIM_TPL_EST', JSON.stringify(est));
  out.idiomas = clase;
  return out;
}
