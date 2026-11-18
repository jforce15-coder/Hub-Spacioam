/* ═══ BIBLIOTECA DE CLAUDIO: skills y documentos que Juan le comparte a Claudio, sin el chat ══════════════════════════
   Juan (17-nov-2026, pedido pc1794916196762): «una opción para que el usuario comparta fácilmente un skill o documento,
   sin usar el chat, y que Claudio pueda pedirlo cuando sea necesario para hacerlo más rápido e inteligente».

   1. COMPARTIR (Ajustes → Biblioteca de Claudio, alma/biblioteca.html; solo el administrador principal con su sesión):
      un archivo (.md, .txt, .zip o .skill de un skill, PDF, Word, Excel, CSV, JSON) o un texto pegado, con su tipo
      (skill · documento) y para qué sirve. El original va a una carpeta PRIVADA del Drive del Hub («Biblioteca de Claudio»,
      BIBLIO_CARPETA_ID; nunca con enlace) y su texto, ya sacado, a un .txt al lado (Claudio no gasta IA en leerlo). La
      lista vive en la hoja ALMA_BIBLIOTECA. Quitar uno solo lo saca de la lista: el archivo se queda en el Drive.
   2. CLAUDIO LA VE EN CADA PEDIDO (paraClaudeCrear_ → bibliotecaParaClaude_): la lista (id, tipo, nombre, para qué) y
      cómo leer uno con el «lector» de ese pedido: otra llave, de solo lectura, distinta de la de responder (esa sigue
      siendo de un solo uso). El lector deja de servir cuando Claudio responde o a las 24 h. Nada de esto va al issue.
   3. CLAUDIO LO PIDE: si le falta un skill o documento, responde «pregunta» con «pide» (qué necesita, en una línea). Juan
      lo ve arriba en la Biblioteca («Claudio te pidió») y en su chat; al compartirlo desde ahí, sale solo como ajuste del
      mismo microproyecto con el id del documento (sin escribir nada en el chat).
   BIBLIO_ON = 0 apaga la lista en los pedidos (la página sigue). */

var BIBLIO_CAB_ = ['id', 'fecha', 'nombre', 'tipo', 'para_que', 'archivo', 'mime', 'drive_id', 'texto_id', 'caracteres', 'quien', 'estado', 'micro'];
var BIBLIO_TIPOS_ = ['skill', 'documento'];
var BIBLIO_MAX_B64_ = 11500000;           // ~8 MB, como el «Archivo» del chat de Alma
var BIBLIO_TEXTO_MAX_ = 400000;           // lo que se guarda del texto sacado
var BIBLIO_PAGINA_ = 60000;               // lo que Claudio recibe por lectura (sigue con «desde»)
var BIBLIO_LISTA_PEDIDO_ = 25;            // cuántos van en la lista de cada pedido (lo más nuevo primero)
var BIBLIO_LECTOR_MS_ = 24 * 3600000;     // el lector de un pedido sirve 24 h (o hasta que Claudio responde)
var BIBLIO_PIDE_DIAS_ = 14;               // lo que Claudio pidió y nadie compartió se olvida a los 14 días
var BIBLIO_EXT_TEXTO_ = /\.(md|markdown|txt|text|json|ya?ml|csv|tsv|js|ts|py|sh|html?|css|xml|swift|gs|sql)$/i;

function biblioHoja_() {
  var sh = hojaCrear_('ALMA_BIBLIOTECA', BIBLIO_CAB_);
  if (sh.getLastColumn() < BIBLIO_CAB_.length) sh.getRange(1, 1, 1, BIBLIO_CAB_.length).setValues([BIBLIO_CAB_]);
  return sh;
}
function biblioCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('BIBLIO_CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.error('BIBLIO_CARPETA_ID inválida: ' + e); } }
  var f = DriveApp.createFolder('Biblioteca de Claudio');
  p.setProperty('BIBLIO_CARPETA_ID', f.getId());
  return f;
}
function biblioFilas_() {
  var sh = biblioHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, BIBLIO_CAB_.length).getValues().map(function (r, i) {
    var o = { fila: i + 2 }; BIBLIO_CAB_.forEach(function (k, j) { o[k] = k === 'caracteres' ? Number(r[j]) || 0 : String(r[j] == null ? '' : r[j]); });
    return o;
  });
}
function biblioActivos_() { return biblioFilas_().filter(function (d) { return d.estado === 'activo'; }).reverse(); }   // lo más nuevo primero
function biblioPublico_(d) { return { id: d.id, fecha: d.fecha, nombre: d.nombre, tipo: d.tipo, para_que: d.para_que, archivo: d.archivo, caracteres: d.caracteres, solo_archivo: !d.texto_id }; }
function biblioLimpio_(t, max) { return String(t || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); }

/* El texto de lo que se compartió, sin IA: texto tal cual, Word, Excel y CSV con lo que el Hub ya sabe leer, y un .zip o
   .skill (un skill empacado) con sus archivos de texto uno tras otro. Un PDF se guarda y Claudio lo lee del original. */
function biblioTexto_(blob, nombre, mime) {
  var n = String(nombre || '').toLowerCase();
  if (BIBLIO_EXT_TEXTO_.test(n) || /^text\//.test(mime) || mime === 'application/json') return { texto: blob.getDataAsString() };
  if (/\.docx$/.test(n) || mime === BIBLIO_MIME_DOCX_) return almaDocxTexto_(blob);
  if (/\.xlsx$/.test(n) || mime === BIBLIO_MIME_XLSX_) return correoXlsxTabla_(blob);
  if (/\.(zip|skill)$/.test(n) || /zip/.test(mime)) {
    try {
      var partes = Utilities.unzip(blob.copyBlob().setContentType('application/zip')), out = [];
      partes.forEach(function (p) {
        var pn = String(p.getName() || ''); if (!pn || /\/$/.test(pn) || /(^|\/)(__MACOSX|\.)/.test(pn) || !BIBLIO_EXT_TEXTO_.test(pn)) return;
        out.push('=== ' + pn + ' ===\n' + p.getDataAsString());
      });
      return out.length ? { texto: out.join('\n\n') } : { error: 'El .zip no trae archivos de texto.' };
    } catch (e) { return { error: 'No pude abrir el .zip.' }; }
  }
  if (/\.pdf$/.test(n) || mime === 'application/pdf') return { soloArchivo: true };
  return { error: 'Ese tipo no lo puedo leer. Comparte un .md, .txt, .zip de un skill, PDF, Word, Excel, CSV o pega el texto.' };
}
var BIBLIO_MIME_DOCX_ = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var BIBLIO_MIME_XLSX_ = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/* ── La página (Ajustes → Biblioteca de Claudio) ── */
function bibliotecaLista_(ses) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  return { ok: true, documentos: biblioActivos_().map(biblioPublico_), pedidos: biblioPedidos_(), on: biblioOn_() };
}
/* b = { tipo, nombre, para_que, data (base64) + mime + archivo | texto (pegado), pedido (micro que lo pidió) } */
function bibliotecaSubir_(ses, b) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  b = b || {};
  var tipo = BIBLIO_TIPOS_.indexOf(String(b.tipo)) >= 0 ? String(b.tipo) : 'documento';
  var archivo = String(b.archivo || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 100);
  var nombre = biblioLimpio_(b.nombre, 80) || archivo.replace(/\.[^.]+$/, '') || '';
  var paraQue = biblioLimpio_(b.para_que, 300);
  var mime = String(b.mime || '').split(';')[0].toLowerCase(), data = String(b.data || '').replace(/^data:[^,]*,/, ''), pegado = biblioLimpio_(b.texto, BIBLIO_TEXTO_MAX_);
  if (!nombre) return { ok: false, error: 'Ponle un nombre.' };
  if (!data && !pegado) return { ok: false, error: 'Elige un archivo o pega el texto.' };
  if (data.length > BIBLIO_MAX_B64_) return { ok: false, error: 'El archivo pasa de 8 MB.' };
  var blob, r;
  if (data) {
    if (!archivo) archivo = nombre;
    blob = Utilities.newBlob(Utilities.base64Decode(data), mime || 'application/octet-stream', archivo);
    try { r = biblioTexto_(blob, archivo, mime); } catch (e) { r = { error: 'No pude leerlo.' }; }
    if (r.error) return { ok: false, error: r.error };
  } else {
    archivo = nombre.replace(/[\\/:*?"<>|]+/g, ' ') + '.md'; mime = 'text/markdown';
    blob = Utilities.newBlob(pegado, 'text/markdown', archivo); r = { texto: pegado };
  }
  var texto = biblioLimpio_(r.texto, BIBLIO_TEXTO_MAX_);
  if (!texto && !r.soloArchivo) return { ok: false, error: 'No encontré texto en lo que compartiste.' };
  var carpeta, f, ft = null, id = 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  try { carpeta = biblioCarpeta_(); f = carpeta.createFile(blob); if (texto && data) ft = carpeta.createFile(Utilities.newBlob(texto, 'text/plain', id + ' · ' + nombre + '.txt')); }
  catch (e) { console.error('bibliotecaSubir_ Drive: ' + e); return { ok: false, error: 'No pude guardarlo en el Drive del Hub. Intenta de nuevo.' }; }
  try { f.setDescription('Biblioteca de Claudio · ' + tipo + ' · compartido por ' + String(adm.email || '') + ' · ' + new Date().toISOString()); } catch (e) {}
  var textoId = texto ? (ft ? ft.getId() : f.getId()) : '';
  var micro = String(b.pedido || '').trim();
  var pedido = micro ? biblioPedidos_().filter(function (p) { return p.micro === micro; })[0] : null;
  biblioHoja_().appendRow([id, new Date().toISOString(), nombre, tipo, paraQue, archivo, mime, f.getId(), textoId, texto.length, String(adm.email || ''), 'activo', pedido ? micro : '']);
  var out = { ok: true, documento: biblioPublico_({ id: id, fecha: new Date().toISOString(), nombre: nombre, tipo: tipo, para_que: paraQue, archivo: archivo, caracteres: texto.length, texto_id: textoId }) };
  /* Lo pidió Claudio: sale solo como ajuste de su microproyecto, con el id, y el pedido deja de esperar. */
  if (pedido) {
    biblioPedidoQuitar_(micro);
    try {
      var rr = microResponder_(adm, micro, 'Te compartí ' + (tipo === 'skill' ? 'el skill' : 'el documento') + ' «' + nombre + '» en la Biblioteca de Claudio (id ' + id + '), lo que pediste («' + pedido.que + '»). Léelo con tu lector y sigue.', { sinChat: false });
      out.claudio = rr.ok ? 'Claudio ya lo tiene en «' + pedido.nombre + '».' : (rr.error || 'Quedó en la biblioteca, pero no pude avisarle a Claudio.');
    } catch (e) { console.error('bibliotecaSubir_ ajuste: ' + e); out.claudio = 'Quedó en la biblioteca, pero no pude avisarle a Claudio.'; }
  }
  return out;
}
/* Quitar: sale de la lista (Claudio ya no lo ve); el archivo se queda en el Drive privado. */
function bibliotecaQuitar_(ses, id) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  var d = biblioFilas_().filter(function (x) { return x.id === String(id || ''); })[0];
  if (!d) return { ok: false, error: 'Ya no está en la biblioteca.' };
  biblioHoja_().getRange(d.fila, BIBLIO_CAB_.indexOf('estado') + 1).setValue('quitado');
  return { ok: true };
}
/* «No lo tengo» a un pedido de Claudio: deja de esperar (Claudio sigue con lo que tiene cuando Juan le responda). */
function bibliotecaPedidoDejar_(ses, micro) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  biblioPedidoQuitar_(String(micro || ''));
  return { ok: true };
}

/* ── Lo que Claudio pidió (respuesta con «pide») ── */
function biblioPedidosTodos_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BIBLIO_PEDIDOS') || '[]') || []; } catch (e) { return []; } }
function biblioPedidosGuardar_(l) { PropertiesService.getScriptProperties().setProperty('BIBLIO_PEDIDOS', JSON.stringify(l.slice(-10))); }
function biblioPedidos_() {
  var limite = Date.now() - BIBLIO_PIDE_DIAS_ * 86400000;
  return biblioPedidosTodos_().filter(function (p) { return p && p.micro && Number(p.ts) > limite; }).reverse();
}
function biblioPedir_(micro, nombre, que) {
  micro = String(micro || ''); que = biblioLimpio_(que, 300); if (!micro || !que) return false;
  var l = biblioPedidosTodos_().filter(function (p) { return p.micro !== micro; });   // uno por microproyecto: el último manda
  l.push({ micro: micro, nombre: String(nombre || 'Pedido para Claudio').slice(0, 60), que: que, ts: Date.now() });
  biblioPedidosGuardar_(l);
  return true;
}
function biblioPedidoQuitar_(micro) { biblioPedidosGuardar_(biblioPedidosTodos_().filter(function (p) { return p.micro !== micro; })); }

/* ── Para cada pedido a Claudio ── */
function biblioOn_() { return PropertiesService.getScriptProperties().getProperty('BIBLIO_ON') !== '0'; }
/* El bloque que va en la instrucción (no en el issue): la lista y cómo leer o pedir. Corto: va en cada pedido. */
function bibliotecaParaClaude_(url) {
  if (!biblioOn_()) return '';
  var docs = []; try { docs = biblioActivos_(); } catch (e) { console.error('bibliotecaParaClaude_: ' + e); return ''; }
  var lineas = docs.slice(0, BIBLIO_LISTA_PEDIDO_).map(function (d) {
    return '- ' + d.id + ' · ' + d.tipo + ' · «' + d.nombre + '»' + (d.para_que ? ' · ' + d.para_que : '') + ' · ' + (d.texto_id ? d.caracteres + ' caracteres' : 'PDF, pide "crudo":1');
  });
  return '### Biblioteca de Claudio (skills y documentos que Juan te compartió desde la app)\n' +
    (lineas.length ? lineas.join('\n') + (docs.length > lineas.length ? '\n- (y ' + (docs.length - lineas.length) + ' más: pide la lista sin "doc")' : '') : '- (todavía vacía)') + '\n' +
    'Si uno sirve para este pedido, léelo antes de programar: curl -sL -H "Content-Type: text/plain;charset=utf-8" --data-binary ' +
    '\'{"mejora":1,"action":"biblioteca","id":"<id del pedido>","lector":"<biblioteca.lector del payload>","doc":"<id>"}\' "' + (url || '<respuesta_url>') + '" ' +
    '(devuelve el texto en páginas: sigue con "desde"; "crudo":1 da el archivo original en base64). El lector es solo para leer y no gasta la llave de responder. ' +
    'Si te falta un skill o documento de Juan para hacerlo mejor o más rápido, responde estado "pregunta" y agrega "pide": "qué necesitas, en una línea": Juan lo comparte desde la app y te llega como ajuste con su id. ' +
    'Si el resultado es un archivo para Juan (un formulario lleno, un reporte), entrégaselo con el mismo curl y el lector, con "entregar":{"archivo":"nombre.pdf","mime":"application/pdf","data":"<base64>"} en vez de "doc": queda privado en el Drive del Hub, compartido solo con Juan, y devuelve "url"; ponla en una acción abrir_enlace al responder.' +
    (function () { var o = ''; try { o = archivosOrbitaParaClaude_(); } catch (e) { console.error('archivosOrbitaParaClaude_: ' + e); } return o ? '\n\n' + o : ''; })();
}
/* Claudio lee (doPost {mejora:1, action:'biblioteca', id, lector, doc?, desde?, crudo?, orbita?, entregar?}). Solo con el lector vivo de su pedido. */
function bibliotecaClaude_(b) {
  b = b || {};
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2 || !b.id || !b.lector) return { ok: false, error: 'lector' };
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), cId = cab.indexOf('id'), cL = cab.indexOf('lector'), cF = cab.indexOf('fecha_lector');
  if (cL < 0) return { ok: false, error: 'lector' };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues(), fila = null;
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][cId]) === String(b.id)) { fila = v[i]; break; }
  if (!fila || !fila[cL] || String(fila[cL]) !== paraClaudeHuella_(b.lector)) return { ok: false, error: 'lector' };
  if (cF >= 0 && Number(fila[cF]) && Date.now() - Number(fila[cF]) > BIBLIO_LECTOR_MS_) return { ok: false, error: 'lector vencido' };
  /* Los archivos en órbita de Juan (archivosorbita.js): solo en un pedido del administrador principal. */
  if (b.orbita) {
    var cQ = cab.indexOf('quien'), ppal = adminsOp_().filter(function (a) { return a.principal; }).map(function (a) { return a.nombre; });
    if (cQ < 0 || ppal.indexOf(String(fila[cQ])) < 0) return { ok: false, error: 'Solo en un pedido del administrador principal.' };
    if (String(b.orbita) === 'lista') return { ok: true, archivos: archOrbDelPrincipal_().map(function (o) { return archOrbParaClaudePublico_(o.x); }) };
    return archOrbABiblioteca_(b.orbita);
  }
  /* Claudio le entrega un archivo a Juan (un formulario lleno, un reporte): solo en un pedido del administrador principal. */
  if (b.entregar) {
    var cQe = cab.indexOf('quien'), ppalE = adminsOp_().filter(function (a) { return a.principal; }).map(function (a) { return a.nombre; });
    if (cQe < 0 || ppalE.indexOf(String(fila[cQe])) < 0) return { ok: false, error: 'Solo en un pedido del administrador principal.' };
    return biblioEntregar_(b.entregar, String(b.id));
  }
  var docs = biblioActivos_();
  if (!b.doc) return { ok: true, documentos: docs.map(biblioPublico_) };
  var d = docs.filter(function (x) { return x.id === String(b.doc); })[0];
  if (!d) return { ok: false, error: 'No está en la biblioteca (o Juan lo quitó).' };
  try {
    if (b.crudo) { var fb = DriveApp.getFileById(d.drive_id).getBlob(); return { ok: true, id: d.id, nombre: d.nombre, archivo: d.archivo, mime: d.mime, base64: Utilities.base64Encode(fb.getBytes()) }; }
    if (!d.texto_id) return { ok: true, id: d.id, nombre: d.nombre, tipo: d.tipo, texto: '', nota: 'Es un PDF: pide "crudo":1 y léelo tú.' };
    var t = DriveApp.getFileById(d.texto_id).getBlob().getDataAsString(), desde = Math.max(0, Number(b.desde) || 0), parte = t.slice(desde, desde + BIBLIO_PAGINA_);
    return { ok: true, id: d.id, nombre: d.nombre, tipo: d.tipo, para_que: d.para_que, texto: parte, desde: desde, total: t.length, sigue: desde + parte.length < t.length ? desde + parte.length : null };
  } catch (e) { console.error('bibliotecaClaude_: ' + e); return { ok: false, error: 'No pude leerlo del Drive ahora.' }; }
}

/* ═══ ENTREGAS DE CLAUDIO: el archivo que Claudio le prepara a Juan (Juan, 18-nov-2026, pedido pc1795013670362) ═══════
   Claudio, con el lector de un pedido de Juan, manda {mejora:1, action:'biblioteca', id, lector, entregar:{archivo, mime,
   data (base64)}}. El archivo va a una carpeta PRIVADA del Drive del Hub («Entregas de Claudio», ENTREGAS_CARPETA_ID;
   nunca con enlace público) y se comparte como lector solo con los correos del administrador principal (Drive le avisa
   por correo). Devuelve el enlace de Drive, que Claudio le deja a Juan en una acción del hilo («Abrir»). */
var ENTREGAS_MIME_ = /^(application\/pdf|image\/(png|jpeg)|text\/(plain|csv|markdown)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))$/;
function entregasCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('ENTREGAS_CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.error('ENTREGAS_CARPETA_ID inválida: ' + e); } }
  var f = DriveApp.createFolder('Entregas de Claudio');
  p.setProperty('ENTREGAS_CARPETA_ID', f.getId());
  return f;
}
function biblioEntregar_(e, pedido) {
  e = e || {};
  var archivo = String(e.archivo || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 100);
  var mime = String(e.mime || '').split(';')[0].toLowerCase(), data = String(e.data || '').replace(/^data:[^,]*,/, '');
  if (!archivo || !data) return { ok: false, error: 'Falta el archivo (archivo y data en base64).' };
  if (!ENTREGAS_MIME_.test(mime)) return { ok: false, error: 'Solo PDF, imagen, texto, Word, Excel o PowerPoint.' };
  if (data.length > BIBLIO_MAX_B64_) return { ok: false, error: 'El archivo pasa de 8 MB.' };
  var correos = archOrbCorreosPrincipal_(); if (!correos.length) return { ok: false, error: 'No encontré el correo del administrador principal.' };
  var f;
  try {
    f = entregasCarpeta_().createFile(Utilities.newBlob(Utilities.base64Decode(data), mime, archivo));
    f.setDescription('Entrega de Claudio · pedido ' + pedido + ' · ' + new Date().toISOString());
    f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    correos.forEach(function (c) { try { f.addViewer(c); } catch (x) { console.warn('biblioEntregar_ addViewer: ' + x); } });
  } catch (x) { console.error('biblioEntregar_: ' + x); return { ok: false, error: 'No pude guardarlo en el Drive del Hub. Intenta de nuevo.' }; }
  return { ok: true, archivo: archivo, drive_id: f.getId(), url: f.getUrl() };
}
