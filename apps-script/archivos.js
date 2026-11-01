/* ═══ Alma envía archivos por WhatsApp ═══
   Alma arma un PDF (reporte de actividad o transcripción de una llamada) y lo manda como documento al WhatsApp del
   administrador principal. Usa el mismo envío de documentos que el registro de ingreso (recepcion.js): se sube el archivo
   a Meta (/media) y se manda como mensaje tipo «document». Dentro de las 24 h de su último mensaje va directo; fuera
   de la ventana WhatsApp no deja mandar documentos sueltos, así que Alma avisa y no lo manda. */

/* PDF simple a partir de texto. Si Apps Script no puede armarlo, cae a un .txt para que el archivo llegue igual. */
function archivoPdf_(titulo, lineas, nombre) {
  var esc = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var html = '<html><body style="font-family:Arial;font-size:11px"><h2>' + esc(titulo) + '</h2>' +
    lineas.map(function (l) { return '<p style="margin:3px 0">' + esc(l) + '</p>'; }).join('') + '</body></html>';
  try { return Utilities.newBlob(html, 'text/html', nombre + '.html').getAs('application/pdf').setName(nombre + '.pdf'); }
  catch (e) { console.error('archivoPdf_: ' + e); return Utilities.newBlob(titulo + '\n\n' + lineas.join('\n'), 'text/plain', nombre + '.txt'); }
}

/* Manda un archivo (blob) como documento al WhatsApp de la persona. Devuelve { ok, error }. */
function waEnviarDocumento_(numero, blob, leyenda) {
  var W = waCfg_(); if (!W.token || !W.phoneId) return { ok: false, error: 'WhatsApp de ALMA sin configurar' };
  var wa = String(numero || '').replace(/\D/g, ''); if (!wa) return { ok: false, error: 'sin número' };
  var abierta = false; try { abierta = waVentana_(wa); } catch (e) {}
  if (!abierta) return { ok: false, error: 'ventana', detalle: 'Pasaron más de 24 h desde el último mensaje de esa persona: WhatsApp no deja mandar archivos hasta que escriba a Alma.' };
  var up = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/media', { method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: { messaging_product: 'whatsapp', type: blob.getContentType(), file: blob } });
  var mid = ''; try { mid = JSON.parse(up.getContentText()).id || ''; } catch (e) {}
  if (!mid) return { ok: false, error: 'Meta no aceptó el archivo · HTTP ' + up.getResponseCode() + ' · ' + up.getContentText().slice(0, 200) };
  var r = uf_('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: wa, type: 'document', document: { id: mid, filename: blob.getName(), caption: String(leyenda || '').slice(0, 1000) } }) });
  var ok = r.getResponseCode() < 300;
  try { hojaWA_().appendRow([new Date().toISOString(), wa, 'ALMA', 'out', 'Archivo · ' + blob.getName() + (ok ? '' : ' · NO SE ENVIÓ'), '', 'wa:' + wa, 'document', 'alma', '']); } catch (e) {}
  return ok ? { ok: true } : { ok: false, error: r.getContentText().slice(0, 200) };
}

/* Herramienta enviar_archivo. tipo: «actividad» (lo que pasó en el chat operativo los últimos días) o «llamada»
   (transcripción de una llamada de voz; sin id, la última). Solo al WhatsApp del administrador principal. */
function archivoEnviar_(adm, inp) {
  var tel = (adm.tels || [])[0]; if (!tel) return { ok: false, error: 'No tengo tu WhatsApp registrado para mandarte el archivo.' };
  var tipo = String(inp.tipo || '').toLowerCase(), hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), titulo, lineas, nombre;
  if (tipo === 'llamada') {
    var t; try { t = vozTranscript_(inp.id); } catch (e) { return { ok: false, error: 'No pude leer la llamada: ' + e }; }
    if (!t.ok || !(t.turnos || []).length) return { ok: false, error: 'No encontré esa llamada.' };
    titulo = 'Transcripción de llamada · ' + hoy; nombre = 'Llamada-' + hoy;
    lineas = t.turnos.filter(function (x) { return x.m; }).map(function (x) { return (x.r === 'agent' ? 'ALMA' : 'Juan') + ' (' + Math.round(x.s || 0) + ' s): ' + x.m; });
  } else if (tipo === 'actividad') {
    var dias = Math.min(30, Math.max(1, Number(inp.dias) || 3)), desde = Date.now() - dias * 86400000;
    var filas = opFilas_(adm.email, 3000).filter(function (m) { return new Date(m.ts).getTime() >= desde; });
    titulo = 'Reporte de actividad de ALMA · últimos ' + dias + ' día(s) · ' + hoy; nombre = 'Actividad-' + hoy;
    lineas = filas.map(function (m) {
      var hechas = (m.acciones || []).map(function (a) { return a.resumen; }).filter(String).join('; ');
      return Utilities.formatDate(new Date(m.ts), CFG.TZ, 'dd/MM HH:mm') + ' · ' + (m.de === 'yo' ? 'Tú' : 'ALMA') + ' (' + m.canal + '): ' + m.texto.slice(0, 600) + (hechas ? ' [Hecho: ' + hechas + ']' : '');
    });
  } else return { ok: false, error: 'tipo debe ser «actividad» o «llamada».' };
  if (!lineas.length) return { ok: false, error: 'No hay nada que mandar en ese periodo.' };
  var r = waEnviarDocumento_(tel, archivoPdf_(titulo, lineas, nombre), titulo);
  if (r.ok) return { ok: true, enviado: titulo };
  return { ok: false, error: r.detalle || r.error };
}
