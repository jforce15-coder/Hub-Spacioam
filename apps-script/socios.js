/* ═══ PLANTILLA PARA SOCIOS ═══════════════════════════════════════════════════════════════════════════════
   A un socio o propietario que no ha escrito en 24 h no se le puede mandar texto libre: hace falta una plantilla.
   Las que había (contacto_alma, WA_PLANTILLA) Meta las trata como marketing, y a los números de EE. UU. (+1) Meta no
   les entrega marketing: el socio nunca recibía el mensaje. La plantilla para socios es de categoría Utilidad.
   La primera (actualizacion_cuenta_socio, #414) decía solo «tenemos una actualización sobre tu cuenta»: muy general, y
   el 3-nov Meta la pasó a Marketing. Ya no se usa (sigue en Meta, no se borra). La de ahora, estado_cuenta_socio, nombra
   algo concreto de la cuenta del socio: la propiedad, el periodo y el detalle (Juan, 3-nov). El Hub la crea y la activa:
     WA_PLANTILLA_SOCIO            estado_cuenta_socio (la pone el Hub cuando Meta la aprueba como Utilidad)
     WA_PLANTILLA_SOCIO_IDIOMA     es, o «no» si la de español no quedó como Utilidad
     WA_PLANTILLA_SOCIO_IDIOMA_EN  en_US, o «no» si la de inglés no quedó como Utilidad
   Parámetros: {{1}} primer nombre · {{2}} propiedad · {{3}} periodo (mes y año) · {{4}} detalle concreto del mensaje.
   Idioma: la de inglés es la principal para los números +1 (Juan, 3-nov: «quizás en inglés»), salvo que su ficha diga
   que habla español; a los demás, el idioma de su último mensaje (español si no hay).
   Quién es socio: el Control de usuarios (es_dueno / es_socio, rol socio o propietario, o solo acceso a Mi), la hoja
   SHEET_PROPIETARIOS_ID, los números sueltos de WA_PROPIETARIOS y las fichas de contacto con tipo socio. Un potencial
   socio no cuenta: todavía no tiene cuenta, y la plantilla habla de su cuenta.
   Solo el administrador principal puede escribirle a un socio desde Alma. */

var SOCIO_PLANTILLA_SUGERIDA_ = 'estado_cuenta_socio';
var SOCIO_PLANTILLA_VIEJA_ = 'actualizacion_cuenta_socio';   // Meta la pasó a Marketing el 3-nov: se ignora

function socioPlantillaCfg_() {
  var p = PropertiesService.getScriptProperties(), nom = String(p.getProperty('WA_PLANTILLA_SOCIO') || '').trim();
  var lg = function (k, def) { var v = p.getProperty(k); v = v == null ? def : String(v).trim(); return v === 'no' ? '' : v; };
  if (nom === SOCIO_PLANTILLA_VIEJA_) nom = '';
  return { nombre: nom, idES: lg('WA_PLANTILLA_SOCIO_IDIOMA', 'es'), idEN: lg('WA_PLANTILLA_SOCIO_IDIOMA_EN', '') };
}
function socioPlantillaFalta_() {
  return 'La plantilla para socios (' + SOCIO_PLANTILLA_SUGERIDA_ + ') todavía no está aprobada por Meta como Utilidad: el mensaje no salió. Te aviso en cuanto la aprueben para que le escribas.';
}
/* Los socios a los que no se pudo escribir por falta de plantilla: al aprobarla, Alma le dice a Juan que ya puede. */
function socioEsperaAnotar_(wa, nombre) {
  try {
    var p = PropertiesService.getScriptProperties(), l = []; try { l = JSON.parse(p.getProperty('SOCIO_TPL_ESPERA') || '[]'); } catch (e) {}
    var k = fin8_(wa); l = l.filter(function (x) { return fin8_(x.wa) !== k && Date.now() - x.ts < 14 * 86400000; });
    l.push({ wa: normTel_(wa), nombre: String(nombre || '').slice(0, 60), ts: Date.now() });
    p.setProperty('SOCIO_TPL_ESPERA', JSON.stringify(l.slice(-20)));
  } catch (e) {}
}

/* El socio de ese número ({ wa, nombre, propiedad }) o null. Un administrador nunca cuenta como socio. */
function socioDe_(wa) {
  var k = fin8_(wa); if (!k) return null;
  try { if (adminPorTel_(wa)) return null; } catch (e) {}
  var fila = null; try { fila = (accesosPorRol_().socios || []).filter(function (s) { return fin8_(s.tel) === k; })[0] || null; } catch (e) {}
  var esProp = !!fila; if (!esProp) { try { esProp = waPropietarios_().some(function (x) { return fin8_(x) === k; }); } catch (e) {} }
  var f = null; try { f = contactoFicha_(wa); } catch (e) {}
  var esFicha = !!f && String(f.tipo || '') === 'socio';
  if (!esProp && !esFicha) return null;
  var prop = String((esFicha && f.propiedades) || (fila && fila.propiedad) || (f && f.propiedades) || '').split(/[,;\n]/)[0].trim();
  return { wa: normTel_(wa), nombre: String((fila && fila.nombre) || (f && f.nombre) || '').trim(), propiedad: prop };
}
function socioSeguro_(wa) { try { return socioDe_(wa); } catch (e) { return null; } }

/* Desde Alma, solo el administrador principal le escribe a un socio. '' si puede; si no, el motivo. */
function socioSoloPrincipal_(adm, tel) {
  if (!socioSeguro_(tel)) return '';
  var ok = false; try { ok = esAdminPrincipal_(adm); } catch (e) {}
  return ok ? '' : 'Solo el administrador principal puede escribirle a un socio. Si hace falta, se lo paso a Juan.';
}

/* Meta no acepta parámetros vacíos, con saltos de línea ni con 4 espacios seguidos. */
function socioParam_(v, n) { return String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, n || 60); }

/* En qué idioma va la plantilla: lo que pidió quien escribe, si no la ficha del socio, si no inglés para un +1
   (Juan, 3-nov) y si no el idioma de su último mensaje. */
function socioIdioma_(wa, o) {
  if (o.idioma) return String(o.idioma).slice(0, 2);
  var f = null; try { f = contactoFicha_(wa); } catch (e) {}
  var nota = f ? String((f.resumen || '') + ' ' + (f.rol || '')) : '';
  if (/espa[ñn]ol|spanish/i.test(nota)) return 'es';
  if (/ingl[eé]s|english/i.test(nota)) return 'en';
  if (/^1\d{10}$/.test(String(normTel_(wa) || ''))) return 'en';
  try { return idiomaDe_((waHilo_('wa:' + normTel_(wa)).filter(function (m) { return m.tipo === 'guest'; }).pop() || {}).texto || '').slice(0, 2) || 'es'; } catch (e) { return 'es'; }
}
/* {{3}}: el mes y el año de hoy («noviembre de 2026» · «November 2026»), salvo que quien escribe diga otro. */
var SOCIO_MESES_ = { es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
function socioPeriodo_(en, d) { d = d || new Date(); return en ? SOCIO_MESES_.en[d.getMonth()] + ' ' + d.getFullYear() : SOCIO_MESES_.es[d.getMonth()] + ' de ' + d.getFullYear(); }
/* {{4}}: lo concreto, sacado del mensaje real (sin el saludo, la primera frase, hasta 100 letras). Meta revisa que la
   plantilla hable de algo específico de la cuenta; este detalle es lo que el socio ve antes de responder. */
function socioDetalle_(texto, en) {
  var t = String(texto || '').replace(/^\s*sobre lo que me pediste[^:]*:\s*/i, '')
    .replace(/^\s*(hola|hi|hello|hey|buen[oa]s(\s+(d[ií]as|tardes|noches))?|good\s+(morning|afternoon|evening))\b[^,.!:\n]{0,40}[,.!:]?\s*/i, '');
  var f = (t.split(/\n|(?:[.!?](?:\s|$))/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || '').replace(/[.:;,\s]+$/, '');
  f = socioParam_(f, 400);
  if (f.length > 100) f = f.slice(0, 100).replace(/\s+\S*$/, '') + '…';
  return f || (en ? 'a message from our team about your account' : 'un mensaje de nuestro equipo sobre tu cuenta');
}
/* El mensaje de la plantilla para socios, listo para la API de Meta. { payload, nombre, idioma } o { error }.
   o: nombre, propiedad, texto (el mensaje completo, de ahí sale el detalle), detalle y periodo (opcionales), idioma. */
function socioPlantillaPayload_(wa, o) {
  o = o || {};
  var cfg = socioPlantillaCfg_(); if (!cfg.nombre || (!cfg.idES && !cfg.idEN)) { socioEsperaAnotar_(wa, o.nombre); return { error: socioPlantillaFalta_() }; }
  var propiedad = socioParam_(o.propiedad);
  if (!propiedad) return { error: 'No sé de qué propiedad es ' + (socioParam_(o.nombre) || 'este socio') + ': dime el apartamento para la plantilla para socios.' };
  var quiereEn = socioIdioma_(wa, o) === 'en';
  var code = quiereEn ? (cfg.idEN || cfg.idES) : (cfg.idES || cfg.idEN), en = code.slice(0, 2) === 'en';   // si su idioma no está aprobado, va el otro
  var nom = String(o.nombre || '').replace(/\(.*?\)/g, ' ').trim(), primer = /^[+\d]/.test(nom) ? '' : socioParam_(nom.split(/\s+/)[0]);
  var ps = [primer || (en ? 'there' : 'qué tal'), propiedad];
  if (cfg.nombre === SOCIO_PLANTILLA_SUGERIDA_) ps.push(socioParam_(o.periodo) || socioPeriodo_(en), socioParam_(o.detalle, 100) || socioDetalle_(o.texto, en));
  return { nombre: cfg.nombre, idioma: code, payload: { messaging_product: 'whatsapp', to: normTel_(wa), type: 'template', template: { name: cfg.nombre, language: { code: code },
    components: [{ type: 'body', parameters: ps.map(function (v) { return { type: 'text', text: v }; }) }] } } };
}

/* El error de Meta en palabras claras, con su propio mensaje. A un +1 que no es socio se le explica por qué no llega. */
function waErrorMeta_(code, cuerpo, wa, esSocio) {
  var j = cuerpo; if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { j = { error: { message: String(cuerpo).slice(0, 200) } }; } }
  var e = (j && j.error) || {}, c = Number(e.code) || 0;
  var msg = String(e.error_user_msg || (e.error_data && e.error_data.details) || e.message || ('HTTP ' + code)).slice(0, 240);
  var masUno = /^1\d{10}$/.test(String(normTel_(wa) || ''));
  return 'Meta rechazó la plantilla' + (c ? ' (código ' + c + ')' : '') + ': ' + msg +
    (masUno && !esSocio ? ' · Es un número de EE. UU. o Canadá (+1): ahí Meta no entrega plantillas de marketing. Si es socio, regístralo como socio y uso la plantilla para socios.' : '');
}

/* ── La plantilla para socios se crea sola (Juan, 3-nov: «¿no me la puedes crear tú?») ──
   Con WA_TOKEN y WA_WABA_ID (los mismos que ya usa contactoPlantillaCrear_), el Hub manda estado_cuenta_socio a Meta,
   primero en inglés (en_US, la principal para los +1) y luego en español, y revisa cada 30 min. Cuando un idioma queda
   APROBADO como Utilidad, llena WA_PLANTILLA_SOCIO y sus idiomas, y Alma le dice a Juan a qué socios ya puede escribir.
   Si Meta la rechaza o la pasa a Marketing, le avisa una sola vez con el motivo y no la vuelve a mandar (nada de
   repetir en bucle). Ya decidido cada idioma, revisa una vez al día por si Meta la recategoriza después (como pasó con
   actualizacion_cuenta_socio). Desde el Hub: acción socio_plantilla (fuerza la revisión ahora y reintenta lo que falló). */
var SOCIO_TPL_IDIOMAS_ = ['en_US', 'es'];
var SOCIO_TPL_TEXTOS_ = {
  en_US: { cuerpo: 'Hi {{1}}, there is an update on your owner account for {{2}} with Spacio AM. Period: {{3}}. Detail: {{4}}. If you have questions about this update, reply to this message.',
    ej: ['Jorge', 'Brunelo 705', 'November 2026', 'your October owner statement is ready'], pie: 'Spacio AM · owner account', boton: 'See details' },
  es: { cuerpo: 'Hola {{1}}, hay una actualización en tu cuenta de propietario de {{2}} con Spacio AM. Periodo: {{3}}. Detalle: {{4}}. Si tienes dudas sobre esta actualización, responde a este mensaje.',
    ej: ['Jorge', 'Brunelo 705', 'noviembre de 2026', 'tu estado de cuenta de octubre está listo'], pie: 'Spacio AM · cuenta de propietario', boton: 'Ver detalle' }
};
var SOCIO_TPL_NOMBRE_IDIOMA_ = { en_US: 'inglés', es: 'español' };
function socioTplCuerpo_(lg) {
  var tx = SOCIO_TPL_TEXTOS_[lg];
  return { name: SOCIO_PLANTILLA_SUGERIDA_, language: lg, category: 'UTILITY', components: [
    { type: 'BODY', text: tx.cuerpo, example: { body_text: [tx.ej] } }, { type: 'FOOTER', text: tx.pie },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: tx.boton }] }] };
}
/* ok: aprobada como Utilidad · malo: rechazada, pausada, con error o en otra categoría · si no, en revisión. */
function socioTplClase_(e) {
  if (!e) return 'pend';
  if (e.cat && e.cat !== 'UTILITY') return 'malo';
  if (e.estado === 'APPROVED') return 'ok';
  return /REJECTED|DISABLED|PAUSED|ERROR/.test(e.estado || '') ? 'malo' : 'pend';
}
/* Los socios que esperan la plantilla: los que no se pudieron escribir, los mensajes guardados (WA_PEND) y los encargos abiertos. */
function socioEsperando_() {
  var p = PropertiesService.getScriptProperties(), vistos = {}, nombres = [];
  var sumar = function (wa, nombre) {
    var k = fin8_(wa); if (!k || vistos[k]) return; var s = socioSeguro_(wa); if (!s) return;
    vistos[k] = 1; var n = String(nombre || s.nombre || '').trim(); if (n) nombres.push(n + (s.propiedad ? ' (' + s.propiedad + ')' : ''));
  };
  try { JSON.parse(p.getProperty('SOCIO_TPL_ESPERA') || '[]').forEach(function (x) { sumar(x.wa, x.nombre); }); } catch (e) {}
  try { var pend = JSON.parse(p.getProperty('WA_PEND') || '{}'); Object.keys(pend).forEach(function (k) { sumar(k, ((pend[k] || [])[0] || {}).nombre); }); } catch (e) {}
  try {
    var sh = hojaEnc_(), n = sh.getLastRow();
    if (n > 1) sh.getRange(2, 1, n - 1, ENC_CAB_.length).getValues().forEach(function (v) {
      if (v[7] === 'abierto' && Date.now() - new Date(v[1]).getTime() < 7 * 86400000) sumar(v[5], v[4]);
    });
  } catch (e) {}
  return nombres;
}
function socioPlantillaAsegurar_(forzar) {
  var p = PropertiesService.getScriptProperties(), nom = SOCIO_PLANTILLA_SUGERIDA_;
  var est = {}; try { est = JSON.parse(p.getProperty('SOCIO_TPL_EST') || '{}') || {}; } catch (e) {}
  est.avisos = est.avisos || {};
  var cada = est.fin ? 24 * 3600000 : 30 * 60000;
  if (!forzar && Date.now() - Number(p.getProperty('SOCIO_TPL_REV') || 0) < cada) return { ok: true, espera: true };
  p.setProperty('SOCIO_TPL_REV', String(Date.now()));
  var W = waCfg_(), waba = p.getProperty('WA_WABA_ID');
  if (!W.token || !waba) return { ok: false, error: 'faltan WA_TOKEN o WA_WABA_ID' };
  var h = { Authorization: 'Bearer ' + W.token }, base = 'https://graph.facebook.com/v21.0/' + waba + '/message_templates';
  var hay = []; try { hay = JSON.parse(uf_(base + '?name=' + nom + '&fields=name,status,language,category,rejected_reason,previous_category', { muteHttpExceptions: true, headers: h }).getContentText()).data || []; } catch (e) {}
  var out = { ok: true, plantilla: nom, creadas: [], estado: {} };
  SOCIO_TPL_IDIOMAS_.forEach(function (lg) {   // inglés primero: es la principal para los números +1
    var t = hay.filter(function (x) { return x.name === nom && x.language === lg; })[0];
    if (t) {
      est[lg] = { estado: String(t.status || ''), cat: String(t.category || ''), motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? String(t.rejected_reason) : '' };
    } else if (!(est[lg] && est[lg].estado === 'ERROR') || forzar) {   // un error al crearla no se repite solo: solo con forzar
      var r = uf_(base, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: h, payload: JSON.stringify(socioTplCuerpo_(lg)) });
      var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
      out.creadas.push(lg + ':' + r.getResponseCode());
      est[lg] = r.getResponseCode() < 300 ? { estado: String(j.status || 'PENDING'), cat: String(j.category || 'UTILITY'), motivo: '' }
        : { estado: 'ERROR', cat: '', motivo: String((j.error && (j.error.error_user_msg || j.error.message)) || ('HTTP ' + r.getResponseCode())).slice(0, 200) };
    }
    out.estado[lg] = est[lg] ? est[lg].estado + (est[lg].cat && est[lg].cat !== 'UTILITY' ? ' · ' + est[lg].cat : '') + (est[lg].motivo ? ' · ' + est[lg].motivo : '') : '';
  });
  var aviso = function (clave, txt, nivel) {
    if (est.avisos[clave]) return; est.avisos[clave] = Date.now();
    try { var adm = adminsOp_().filter(function (a) { return a.principal; })[0]; if (adm) vozAvisoPoner_(adm, txt, null, { nivel: nivel }); } catch (e) { console.error('socio aviso: ' + e); }
  };
  var clase = {}; SOCIO_TPL_IDIOMAS_.forEach(function (lg) { clase[lg] = socioTplClase_(est[lg]); });
  /* Lo que Meta no dejó como Utilidad: un aviso por idioma y estado, con el motivo, y no se vuelve a mandar. */
  SOCIO_TPL_IDIOMAS_.forEach(function (lg) {
    if (clase[lg] !== 'malo') return;
    var e = est[lg], mkt = e.cat && e.cat !== 'UTILITY', que = mkt ? 'pasó a ' + (e.cat === 'MARKETING' ? 'Marketing' : e.cat) : e.estado === 'ERROR' ? 'no aceptó' : 'dejó en ' + e.estado;
    var motivo = e.motivo || (mkt ? 'Meta no da el motivo; casi siempre es que el texto le parece general o promocional' : '');
    aviso('malo:' + lg + ':' + e.estado + ':' + e.cat, 'Meta ' + que + ' la plantilla para socios en ' + SOCIO_TPL_NOMBRE_IDIOMA_[lg] + (motivo ? ' (' + motivo + ')' : '') +
      (lg === 'en_US' && e.cat === 'MARKETING' ? '. Así no les llega a los socios con número de Estados Unidos' : '') + '. No la vuelvo a mandar: se puede apelar en WhatsApp Manager.', 2);
  });
  /* Activar los idiomas aprobados como Utilidad (y apagar uno que Meta recategorizó después). */
  var okEs = clase.es === 'ok', okEn = clase.en_US === 'ok';
  if (okEs || okEn) {
    var antes = socioPlantillaCfg_(), eraActiva = antes.nombre === nom;
    p.setProperty('WA_PLANTILLA_SOCIO', nom);
    p.setProperty('WA_PLANTILLA_SOCIO_IDIOMA', okEs ? 'es' : 'no');
    p.setProperty('WA_PLANTILLA_SOCIO_IDIOMA_EN', okEn ? 'en_US' : 'no');
    var nuevos = (okEn && !(eraActiva && antes.idEN)) || (okEs && !(eraActiva && antes.idES));
    if (nuevos) {
      var quienes = socioEsperando_(), idi = okEn && okEs ? 'en inglés y en español' : okEn ? 'en inglés' : 'en español';
      aviso('ok:' + (okEn ? 'en' : '') + (okEs ? 'es' : ''), 'Meta aprobó la plantilla para socios ' + idi + ' como Utilidad: ya les puedo escribir por WhatsApp, también a los números de Estados Unidos.' +
        (quienes.length ? ' Ya puedes escribirle a ' + quienes.slice(0, 4).join(', ') + '.' : ''), 2);
    }
  } else if (socioPlantillaCfg_().nombre === nom) {
    p.setProperty('WA_PLANTILLA_SOCIO_IDIOMA', 'no'); p.setProperty('WA_PLANTILLA_SOCIO_IDIOMA_EN', 'no');   // Meta la recategorizó en los dos idiomas
  }
  est.fin = SOCIO_TPL_IDIOMAS_.every(function (lg) { return clase[lg] !== 'pend'; }) ? (est.fin || Date.now()) : 0;
  p.setProperty('SOCIO_TPL_EST', JSON.stringify(est));
  out.activa = okEs || okEn; out.idiomas = { es: clase.es, en_US: clase.en_US };
  return out;
}
