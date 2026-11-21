/* ═══ Buscar en todo (pedido pc1795284175075, Juan, 21-nov-2026, #964) ═══════════════════════════════════════════════
   Juan: «Imágenes, archivos, textos, correos que cuando Alma busque un Keyboard, entonces encuentre todo una lista de
   archivos e información disponible sobre esa información».
   buscar_todo junta en UNA lista lo que hay sobre una palabra o un tema, de todas partes a la vez:
     · archivos y fotos: el Drive del Hub (alma@: Archivos del chat con Alma, Biblioteca de Claudio, Entregas y las carpetas
       que Juan comparte), por nombre y por lo que dicen (Drive lee el texto de los PDF, Word y de las fotos); además los
       archivos en órbita y de la Carpeta de archivos de Juan y la Biblioteca de Claudio, por su descripción y su resumen;
     · correos: la bandeja del Hub (lo que llega a alma@ y lo reenviado), el asunto, de quién (solo el nombre) y sus adjuntos;
     · textos: los mensajes del Chat con Alma de quien busca (buscar_en_mi_chat);
     · datos: reservas, propiedades y contactos (lo mismo que el Buscador de Alma, buscador.js).
   Sin IA y sin UrlFetch (no gasta cupo de Google de llamadas externas): Drive, Gmail y hojas. Solo LEE. Solo el
   administrador principal (ve el Drive y el correo del Hub). Nunca devuelve teléfonos ni correos: de quién, solo el nombre.
   Para abrir algo: leer_correo (con el asunto), ver_imagenes / el enlace del Drive (privado), o buscar_en_cerebro para una
   respuesta con prueba. */
var BTODO_MAX_ = { archivos: 10, fotos: 8, correos: 8, textos: 4 };
var BTODO_DIAS_CORREO_ = 365, BTODO_TEXTO_ = 280;
var BTODO_MIME_FUERA_ = ['application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.folder', 'application/vnd.google-apps.script',
  'application/vnd.google-apps.form', 'application/vnd.google-apps.shortcut'];

/* Las palabras a buscar: sin acentos ni signos, sin las vacías, hasta 4 (nada de «-» ni comillas: Gmail y Drive no las leen como texto).
   crudas = true: con sus acentos (para Drive y Gmail, que buscan la palabra como se escribe). */
function btodoPalabras_(texto, crudas) {
  var vacias = ['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'con', 'por', 'para', 'sobre', 'todo', 'lo', 'que'];
  var t = crudas ? String(texto || '').toLowerCase() : norm_(texto);
  return t.replace(/[^a-z0-9áéíóúüñ@.]+/g, ' ').replace(/(^|\s)\.+|\.+(?=\s|$)/g, ' ').split(' ')
    .filter(function (w) { return w.length >= 2 && vacias.indexOf(norm_(w)) < 0; }).slice(0, 4);
}
/* ¿Está todo lo buscado en este texto? (todas las palabras, sin acentos) */
function btodoCoincide_(palabras, texto) {
  var t = norm_(texto); if (!t || !palabras.length) return false;
  return palabras.every(function (w) { return t.indexOf(w) >= 0; });
}
function btodoTipo_(mime, nombre) {
  var m = String(mime || '');
  if (/^image\//.test(m) || /\.(jpe?g|png|heic|webp|gif)$/i.test(nombre)) return 'foto';
  if (/^video\//.test(m)) return 'video';
  if (/^audio\//.test(m)) return 'audio';
  if (/pdf/.test(m)) return 'pdf';
  if (/sheet|excel|csv/.test(m)) return 'hoja';
  if (/presentation|powerpoint/.test(m)) return 'presentación';
  return 'documento';
}
function btodoFecha_(d) {
  try { return d ? Utilities.formatDate(new Date(d), (typeof CFG !== 'undefined' && CFG.TZ) || 'America/Guatemala', 'yyyy-MM-dd') : ''; } catch (e) { return ''; }
}
/* Un correo «Nombre <x@y>» → solo «Nombre» (nunca la dirección). */
function btodoDe_(de) {
  var s = String(de || '').replace(/<[^>]*>/g, '').replace(/"/g, '').trim();
  return /@/.test(s) ? s.split('@')[0] : s;
}

/* Drive: por nombre y por lo que dice (fullText), sin la hoja del sistema ni carpetas. */
function btodoDrive_(crudas) {
  var q = 'trashed = false and ' + BTODO_MIME_FUERA_.map(function (m) { return "mimeType != '" + m + "'"; }).join(' and ') + ' and ' +
    crudas.map(function (w) { return "fullText contains '" + w + "'"; }).join(' and ');
  var out = [], it = DriveApp.searchFiles(q), vistos = 0, tope = BTODO_MAX_.archivos + BTODO_MAX_.fotos + 6;
  while (it.hasNext() && vistos < tope) {
    var f = it.next(); vistos++;
    var nombre = String(f.getName() || ''), mime = String(f.getMimeType() || '');
    if (/^b[0-9a-z]{6,} · .*\.txt$/i.test(nombre)) continue;   // el texto sacado de un documento de la Biblioteca: ya está su original
    out.push({ nombre: nombre.slice(0, 120), tipo: btodoTipo_(mime, nombre), fecha: btodoFecha_(f.getLastUpdated()), drive_id: f.getId(), enlace: f.getUrl(), donde: 'Drive del Hub' });
  }
  return out;
}

/* Lo que Alma ya sabe describir: los archivos en órbita y de la Carpeta de archivos (archivosorbita.js) y la Biblioteca de
   Claudio (biblioteca.js), por nombre, descripción y resumen (así también se encuentran las fotos por lo que se ve en ellas). */
function btodoGuardados_(palabras) {
  var out = [];
  try {
    archOrbDelPrincipal_().forEach(function (o) {
      var x = o.x; if (!btodoCoincide_(palabras, [x.nombre, x.desc, x.resumen].join(' '))) return;
      out.push({ nombre: String(x.nombre || '').slice(0, 120), tipo: x.tipo === 'foto' ? 'foto' : x.tipo === 'hoja' ? 'hoja' : x.tipo === 'audio' ? 'audio' : x.tipo === 'pdf' ? 'pdf' : 'documento',
        fecha: btodoFecha_(x.tc || x.t), drive_id: x.drive_id || '', desc: x.desc || '', resumen: String(x.resumen || '').slice(0, BTODO_TEXTO_),
        donde: x.estado === 'carpeta' ? 'Carpeta de archivos' : 'En órbita' });
    });
  } catch (e) { console.error('buscar_todo órbita: ' + e); }
  try {
    biblioActivos_().forEach(function (d) {
      if (!btodoCoincide_(palabras, [d.nombre, d.para_que, d.archivo].join(' '))) return;
      out.push({ nombre: String(d.nombre || d.archivo || '').slice(0, 120), tipo: btodoTipo_(d.mime, d.archivo), fecha: btodoFecha_(d.fecha),
        drive_id: d.drive_id || '', desc: d.tipo === 'skill' ? 'Skill' : 'Documento', resumen: String(d.para_que || '').slice(0, BTODO_TEXTO_), donde: 'Biblioteca de Claudio' });
    });
  } catch (e) { console.error('buscar_todo biblioteca: ' + e); }
  return out;
}

/* Correos de la bandeja del Hub: asunto, de quién (nombre), fecha y adjuntos. Para abrir uno: leer_correo con el asunto. */
function btodoCorreos_(crudas) {
  var q = crudas.join(' ') + ' newer_than:' + BTODO_DIAS_CORREO_ + 'd';
  var hilos = GmailApp.search(q, 0, BTODO_MAX_.correos) || [];
  return hilos.map(function (h) {
    var msgs = h.getMessages() || [], ult = msgs[msgs.length - 1], adj = [];
    msgs.slice(-3).forEach(function (m) {
      try { (m.getAttachments({ includeInlineImages: false }) || []).forEach(function (a) { var n = String(a.getName() || ''); if (n && adj.indexOf(n) < 0 && adj.length < 6) adj.push(n.slice(0, 80)); }); } catch (e) {}
    });
    return { asunto: String(h.getFirstMessageSubject() || '(sin asunto)').slice(0, 140), de: ult ? btodoDe_(ult.getFrom()).slice(0, 60) : '',
      fecha: btodoFecha_(h.getLastMessageDate()), mensajes: msgs.length, adjuntos: adj.length ? adj : undefined,
      fragmento: ult ? String(ult.getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 160).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '…').replace(/\+?\d[\d\s-]{7,}\d/g, '…') : '' };
  });
}

/* La herramienta. adm: quien habla (de la sesión, nunca del modelo). */
function buscarTodo_(adm, inp) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal busca en todo (archivos y correos del Hub).' };
  var texto = String((inp && inp.texto) || '').replace(/\s+/g, ' ').trim().slice(0, 80), palabras = btodoPalabras_(texto), crudas = btodoPalabras_(texto, true);
  if (!palabras.length) return { ok: false, error: 'Dime qué buscar: una palabra o un tema (p. ej. «keyboard», «factura de luz»).' };
  var r = { ok: true, buscado: texto, archivos: [], fotos: [], correos: [], textos: [], datos: {}, no_pude: [] };

  /* 1 · archivos y fotos: lo guardado con descripción primero, después el Drive; un mismo archivo una sola vez */
  var vistos = {}, todos = [];
  try { todos = todos.concat(btodoGuardados_(palabras)); } catch (e) { r.no_pude.push('archivos guardados'); }
  try { todos = todos.concat(btodoDrive_(crudas)); } catch (e) { console.error('buscar_todo Drive: ' + e); r.no_pude.push('Drive'); }
  todos.forEach(function (a) {
    var k = a.drive_id || (a.donde + '|' + a.nombre); if (vistos[k]) { if (a.enlace && !vistos[k].enlace) vistos[k].enlace = a.enlace; return; }
    vistos[k] = a;
    var lista = a.tipo === 'foto' ? r.fotos : r.archivos;
    if (lista.length < (a.tipo === 'foto' ? BTODO_MAX_.fotos : BTODO_MAX_.archivos)) lista.push(a);
  });

  /* 2 · correos */
  try { r.correos = btodoCorreos_(crudas); } catch (e) { console.error('buscar_todo Gmail: ' + e); r.no_pude.push('correos'); }

  /* 3 · textos: su Chat con Alma */
  try {
    var ch = chatBuscar_(adm, { texto: palabras.join(' ') });
    r.textos = ((ch && ch.mensajes) || []).slice(0, BTODO_MAX_.textos).map(function (m) {
      return { fecha: m.fecha, de: m.de, canal: m.canal, texto: String(m.texto || '').slice(0, BTODO_TEXTO_) + (String(m.texto || '').length > BTODO_TEXTO_ ? '…' : '') };
    });
    if (ch && ch.encontrados > r.textos.length) r.textos_total = ch.encontrados;
  } catch (e) { console.error('buscar_todo chat: ' + e); r.no_pude.push('chat'); }

  /* 4 · datos: reservas, propiedades y contactos (Buscador de Alma) */
  try {
    var d = buscadorBuscar_(texto);
    ['reservas', 'propiedades', 'contactos'].forEach(function (k) { if (d && d[k] && d[k].length) r.datos[k] = d[k]; });
  } catch (e) { console.error('buscar_todo datos: ' + e); r.no_pude.push('reservas y contactos'); }

  var n = { archivos: r.archivos.length, fotos: r.fotos.length, correos: r.correos.length, textos: r.textos_total || r.textos.length,
    datos: Object.keys(r.datos).reduce(function (s, k) { return s + r.datos[k].length; }, 0) };
  r.total = n.archivos + n.fotos + n.correos + n.textos + n.datos;
  r.resumen = btodoResumen_(texto, n);
  if (!r.no_pude.length) delete r.no_pude;
  r.nota = r.total
    ? 'Entrégalo como lista por grupo (fotos, archivos, correos, mensajes, datos), con nombre y fecha. Para abrir un correo: leer_correo con su asunto.'
    : 'No encontré nada con «' + texto + '». Prueba con otra palabra (en español o inglés) o más corta.';
  return r;
}
function btodoResumen_(texto, n) {
  var partes = [], pl = function (c, uno, varios) { return c + ' ' + (c === 1 ? uno : varios); };
  if (n.fotos) partes.push(pl(n.fotos, 'foto', 'fotos'));
  if (n.archivos) partes.push(pl(n.archivos, 'archivo', 'archivos'));
  if (n.correos) partes.push(pl(n.correos, 'correo', 'correos'));
  if (n.textos) partes.push(pl(n.textos, 'mensaje', 'mensajes'));
  if (n.datos) partes.push(pl(n.datos, 'dato', 'datos') + ' (reservas, propiedades o contactos)');
  if (!partes.length) return 'Sobre «' + texto + '» no encontré nada.';
  return 'Sobre «' + texto + '» encontré ' + (partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0]) + '.';
}
