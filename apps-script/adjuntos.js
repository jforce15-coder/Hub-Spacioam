/* ═══ ADJUNTOS AL HUÉSPED desde el «+» del nuevo chat (issue #304 · T5) ══════════════════════════════════════════
   Lo que cada canal acepta (comprobado contra las APIs):
     · Hospitable, reserva: solo FOTOS, hasta 3 por mensaje, por dirección pública, y siempre con texto. Si no escribiste
       nada, va «📷» (decisión de Juan). Airbnb no deja mandar fotos a una reserva que todavía no está aceptada.
     · Hospitable, consulta (inq:): solo texto.
     · WhatsApp: fotos y PDF. Se suben directo a Meta (/media) y salen como «image» o «document», con tu texto como pie
       en el primero. Solo dentro de las 24 h desde su último mensaje: fuera de la ventana WhatsApp no deja mandar archivos.
   Las fotos para Hospitable se guardan en la carpeta de Drive «Adjuntos a huéspedes (Alma)» con enlace público (cualquiera
   con el enlace la ve; decisión de Juan: es lo mismo que recibe el huésped). Solo se mandan archivos de ESA carpeta: así
   nadie puede compartir por aquí otro archivo del Drive. Propiedad del script: ADJ_CARPETA_ID (se crea sola). */

var ADJ_MIME_ = { 'image/jpeg': 'foto', 'image/png': 'foto', 'image/webp': 'foto', 'application/pdf': 'pdf' };
var ADJ_MAX_ = 3;

function adjCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('ADJ_CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.error('ADJ_CARPETA_ID inválida: ' + e); } }
  var f = DriveApp.createFolder('Adjuntos a huéspedes (Alma)');
  p.setProperty('ADJ_CARPETA_ID', f.getId());
  return f;
}

/* Sube un adjunto (base64) y devuelve { ok, id, nombre, mime, tipo }. Todavía no se manda a nadie. */
function adjSubir_(ses, b) {
  var mime = String(b.mime || '').split(';')[0].toLowerCase();
  if (!ADJ_MIME_[mime]) return { ok: false, error: 'Solo fotos (JPG, PNG, WebP) o PDF.' };
  var data = String(b.data || '').replace(/^data:[^,]*,/, '');
  if (!data || data.length > 11500000) return { ok: false, error: 'El archivo está vacío o pasa de 8 MB.' };
  var nombre = String(b.nombre || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80) || ('adjunto-' + Date.now() + (mime === 'application/pdf' ? '.pdf' : '.jpg'));
  var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, nombre);
  var f = adjCarpeta_().createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { console.error('adjSubir_ compartir: ' + e); }
  try { f.setDescription('Subido desde el Hub por ' + String((ses && ses.email) || 'el equipo') + ' · ' + new Date().toISOString()); } catch (e) {}
  return { ok: true, id: f.getId(), nombre: nombre, mime: mime, tipo: ADJ_MIME_[mime] };
}

/* Los adjuntos que llegan con el mensaje: solo ids de archivos de la carpeta de adjuntos (máximo 3). */
function adjLeer_(lista) {
  if (!Array.isArray(lista) || !lista.length) return { ok: true, items: [] };
  if (lista.length > ADJ_MAX_) return { ok: false, error: 'Máximo ' + ADJ_MAX_ + ' adjuntos por mensaje.' };
  var carpeta = adjCarpeta_().getId(), items = [];
  for (var i = 0; i < lista.length; i++) {
    var id = String((lista[i] && lista[i].id) || lista[i] || ''); if (!/^[\w-]{20,}$/.test(id)) return { ok: false, error: 'Adjunto inválido.' };
    var f; try { f = DriveApp.getFileById(id); } catch (e) { return { ok: false, error: 'Ya no encuentro uno de los adjuntos.' }; }
    var dentro = false, ps = f.getParents(); while (ps.hasNext()) if (ps.next().getId() === carpeta) { dentro = true; break; }
    if (!dentro) return { ok: false, error: 'Adjunto inválido.' };
    var mime = f.getMimeType(); if (!ADJ_MIME_[mime]) return { ok: false, error: 'Solo fotos o PDF.' };
    items.push({ id: id, mime: mime, tipo: ADJ_MIME_[mime], nombre: f.getName(), archivo: f,
      url: 'https://drive.google.com/uc?export=view&id=' + id });
  }
  return { ok: true, items: items };
}

/* Hospitable: el texto con hasta 3 fotos. Devuelve { code, error } como hosp_. */
function adjEnviarHosp_(resId, texto, items) {
  if (String(resId).indexOf('inq:') === 0) return { code: 422, error: 'En una consulta Hospitable solo deja mandar texto. Las fotos van cuando la reserva esté aceptada.' };
  if (items.some(function (x) { return x.tipo !== 'foto'; })) return { code: 422, error: 'Por Airbnb o Booking solo se pueden mandar fotos, no PDF. El PDF va por WhatsApp.' };
  var r = hosp_('post', '/reservations/' + resId + '/messages', { body: String(texto || '').trim() || '📷', images: items.map(function (x) { return x.url; }) });
  if (r.code === 422) r.error = 'Hospitable no aceptó las fotos (Airbnb no deja mandarlas si la reserva aún no está aceptada).';
  return r;
}

/* WhatsApp: cada adjunto se sube a Meta y sale como image o document; el texto va de pie en el primero. */
function adjEnviarWa_(numero, texto, items, convId, autor) {
  var W = waCfg_(); if (!W.token || !W.phoneId) return { ok: false, error: 'WhatsApp de ALMA sin configurar' };
  var wa = normTel_(numero); if (!wa) return { ok: false, error: 'sin número' };
  var abierta = false; try { abierta = waVentana_(wa); } catch (e) {}
  if (!abierta) return { ok: false, error: 'Pasaron más de 24 h desde su último mensaje: WhatsApp no deja mandar fotos ni archivos hasta que te escriba. Manda solo el texto.' };
  texto = String(texto || '').trim();
  for (var i = 0; i < items.length; i++) {
    var x = items[i], blob = x.archivo.getBlob();
    var up = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/media', { method: 'post', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + W.token }, payload: { messaging_product: 'whatsapp', type: x.mime, file: blob } });
    var mid = ''; try { mid = JSON.parse(up.getContentText()).id || ''; } catch (e) {}
    if (!mid) return { ok: false, error: 'Meta no aceptó «' + x.nombre + '» (HTTP ' + up.getResponseCode() + ')' };
    var pie = i === 0 ? texto.slice(0, 1000) : '', cuerpo = { messaging_product: 'whatsapp', to: wa, type: x.tipo === 'pdf' ? 'document' : 'image' };
    cuerpo[cuerpo.type] = x.tipo === 'pdf' ? { id: mid, filename: x.nombre, caption: pie } : { id: mid, caption: pie };
    var r = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(cuerpo) });
    var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
    if (r.getResponseCode() >= 300) return { ok: false, error: (j.error && (j.error.error_user_msg || j.error.message)) || 'HTTP ' + r.getResponseCode() };
    var ts = new Date().toISOString(), guardado = (x.tipo === 'pdf' ? '📄 ' + x.nombre : '📷 Foto') + (pie ? ' · ' + pie : '');
    try { hojaWA_().appendRow([ts, wa, '', 'out', guardado.slice(0, 4000), s_(j.messages && j.messages[0] && j.messages[0].id), String(convId || 'wa:' + wa), cuerpo.type, autor || 'Equipo', x.url]); } catch (e) {}
    try { inboxUpsert_(String(convId || 'wa:' + wa), { ultimo_texto: guardado.slice(0, 300), ultimo_de: 'host', ultimo_ts: ts, ultimo_host_ts: ts, ultimo_canal: 'whatsapp', wa: wa }); } catch (e) {}
  }
  /* Sin adjuntos que lleven el texto (no debería pasar) el texto sale solo. */
  if (!items.length && texto) return waEnviar_(wa, texto, { yaVentana: true });
  return { ok: true };
}
