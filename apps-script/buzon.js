/* ═══ CORREO A CLAUDIO: lo que Juan manda por correo a la cuenta del Hub (alma@spacioam.com) ════════════════════════
   Juan (18-nov-2026, pedido pc1795012841121): «¿qué te parece si te mando correos a alma@spacioam.com? ¿Podrías verlo?»
   Desde el traslado (#757) el Hub corre en la cuenta alma@spacioam.com: su Gmail es la bandeja del Hub, así que Alma ya
   lee esos correos con leer_correo. Lo que faltaba es que le lleguen a Claudio (una sesión de Claude no ve Gmail):
   · Cada BUZON_CADA_MIN_ minutos (desde procesarCola) busca en la bandeja los correos de los últimos BUZON_DIAS_ días que
     el administrador principal mandó o reenvió A esta cuenta (en «Para»; una copia no cuenta), desde su correo o su
     alterno, y con la firma de su dominio en «pass» (DKIM o DMARC): un remitente falsificado no entra. Lo interno del
     mismo dominio, sin ese encabezado, también vale.
   · Cada adjunto que la Biblioteca sabe leer (PDF, Word, Excel, CSV, texto, .zip o .skill; hasta 8 MB) entra a la
     Biblioteca de Claudio como documento, con «para qué» = el asunto y lo primero que Juan escribió. Si el correo no
     trae adjuntos, su texto entra como un documento. Lo que no se puede guardar (una foto, algo pesado) se dice en el aviso.
   · Si Claudio pidió un documento («pide») y solo hay UN pedido esperando, lo del correo se lo entrega como ajuste de ese
     microproyecto (igual que al compartir desde la app). Si no, Juan recibe en su chat y en Pendientes «Ya le llegó a
     Claudio…», sin IA.
   · Cada mensaje se procesa una sola vez (BUZON_VISTOS, los últimos 300) y su hilo lleva la etiqueta «Alma/Para Claudio».
   Lo de otras personas no entra a la Biblioteca (Alma lo lee igual si Juan se lo pide). BUZON_ON = 0 lo apaga. */

var BUZON_CADA_MIN_ = 5, BUZON_DIAS_ = 3, BUZON_HILOS_ = 15, BUZON_VISTOS_MAX_ = 300, BUZON_ETIQUETA_ = 'Alma/Para Claudio';
var BUZON_PARA_QUE_ = 300, BUZON_BYTES_ = 8 * 1024 * 1024;

function buzonOn_() { return PropertiesService.getScriptProperties().getProperty('BUZON_ON') !== '0'; }
function buzonVistos_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BUZON_VISTOS') || '[]') || []; } catch (e) { return []; } }
function buzonVistosGuardar_(l) { PropertiesService.getScriptProperties().setProperty('BUZON_VISTOS', JSON.stringify(l.slice(-BUZON_VISTOS_MAX_))); }

/* El administrador principal (de la hoja de accesos) que tiene esta dirección como su correo o su alterno. */
function buzonPrincipal_(dir) {
  dir = String(dir || '').toLowerCase(); if (!dir) return null;
  return adminsOp_().filter(function (a) { return a.principal && (a.email === dir || (a.alternos || []).indexOf(dir) >= 0); })[0] || null;
}
function buzonDominio_(dir) { var m = /@([^@\s>]+)$/.exec(String(dir || '').toLowerCase()); return m ? m[1] : ''; }
/* ¿El correo viene de verdad de ese dominio? Authentication-Results de Gmail: dmarc=pass con header.from del dominio, o
   dkim=pass firmado por el dominio (o un subdominio). Sin encabezado solo vale lo interno (mismo dominio que el Hub). */
function buzonAutentico_(m, dir) {
  var dom = buzonDominio_(dir); if (!dom) return false;
  var ar = ''; try { ar = String(m.getHeader('Authentication-Results') || '').toLowerCase(); } catch (e) {}
  if (!ar) return dom === buzonDominio_(correoCuentaHub_());
  var del = function (d) { d = String(d || '').replace(/^@/, ''); return d === dom || d.slice(-(dom.length + 1)) === '.' + dom; };
  var mm, re = /dkim=pass[^;]*?header\.(?:i|d)=([^\s;]+)/g;
  while ((mm = re.exec(ar))) { if (del(mm[1].split('@').pop())) return true; }
  mm = /dmarc=pass[^;]*?header\.from=([^\s;]+)/.exec(ar);
  return !!(mm && del(mm[1]));
}
/* ¿Va dirigido a la cuenta del Hub (o a uno de sus alias)? Solo «Para»: si Juan copia a Alma en un correo a otro, no. */
function buzonParaHub_(m) {
  var propias = correoPropias_(), para = String(m.getTo() || '').toLowerCase();
  return propias.some(function (p) { return p && para.indexOf(p) >= 0; });
}

/* Lo que Juan escribió arriba (sin citas ni firmas), en una línea, para el «para qué» de cada adjunto. */
function buzonNota_(m) {
  var t = ''; try { t = correoLimpio_(correoTextoPlano_(m)).texto; } catch (e) {}
  t = String(t || '').split(/\n-{5,}|\n_{10,}|\nBegin forwarded|\nInicio del mensaje reenviado/i)[0];
  return t.replace(/\s+/g, ' ').trim();
}

/* Un mensaje → la Biblioteca. Devuelve { asunto, guardados: [{id, nombre}], fuera: ['nombre (por qué)'] }. */
function buzonGuardar_(adm, m) {
  var asunto = correoAsuntoBase_(m.getSubject() || '') || '(sin asunto)', fecha = Utilities.formatDate(m.getDate(), CFG.TZ, 'yyyy-MM-dd');
  var nota = buzonNota_(m), ses = { email: adm.email }, guardados = [], fuera = [];
  var paraQue = ('Del correo «' + asunto + '» (' + fecha + ')' + (nota ? ': ' + nota : '')).slice(0, BUZON_PARA_QUE_);
  var as = []; try { as = m.getAttachments({ includeInlineImages: false }) || []; } catch (e) { console.error('buzonGuardar_ adjuntos: ' + e); }
  as.forEach(function (a) {
    var archivo = String(a.getName() || 'adjunto'), mime = String(a.getContentType() || '').split(';')[0].toLowerCase(), tam = Number(a.getSize()) || 0;
    if (/^image\//.test(mime) && tam < 30 * 1024) return;   // logos de la firma
    if (tam > BUZON_BYTES_) { fuera.push(archivo + ' (pasa de 8 MB)'); return; }
    var r;
    try { r = bibliotecaSubir_(ses, { tipo: 'documento', nombre: archivo.replace(/\.[^.]+$/, ''), para_que: paraQue, archivo: archivo, mime: mime, data: Utilities.base64Encode(a.getBytes()) }); }
    catch (e) { r = { ok: false, error: 'no pude guardarlo' }; console.error('buzonGuardar_: ' + e); }
    if (r && r.ok) guardados.push({ id: r.documento.id, nombre: r.documento.nombre });
    else fuera.push(archivo + ' (' + (/tipo/.test(String(r && r.error)) ? 'ese tipo no lo puedo guardar' : String((r && r.error) || 'no pude guardarlo').replace(/\.$/, '').toLowerCase()) + ')');
  });
  if (!as.length || (!guardados.length && !fuera.length)) {
    var texto = ''; try { texto = correoTextoPlano_(m); } catch (e) {}
    if (String(texto).trim()) {
      var r2 = bibliotecaSubir_(ses, { tipo: 'documento', nombre: 'Correo · ' + asunto.slice(0, 68), para_que: ('Del correo «' + asunto + '» (' + fecha + ')').slice(0, BUZON_PARA_QUE_), texto: 'Asunto: ' + asunto + '\nFecha: ' + fecha + '\n\n' + texto });
      if (r2 && r2.ok) guardados.push({ id: r2.documento.id, nombre: r2.documento.nombre });
    }
  }
  return { asunto: asunto, guardados: guardados, fuera: fuera };
}

/* Cada pocos minutos (procesarCola). Sin IA: solo Gmail, Drive y la hoja. */
function buzonRevisar_(forzar) {
  if (!buzonOn_()) return { ok: true, apagado: true };
  var sp = PropertiesService.getScriptProperties(), ult = Number(sp.getProperty('BUZON_ULTIMA') || 0);
  if (!forzar && Date.now() - ult < BUZON_CADA_MIN_ * 60000) return { ok: true, espera: true };
  sp.setProperty('BUZON_ULTIMA', String(Date.now()));
  var dirs = [];
  adminsOp_().forEach(function (a) { if (a.principal) [a.email].concat(a.alternos || []).forEach(function (d) { if (d && dirs.indexOf(d) < 0) dirs.push(d); }); });
  if (!dirs.length) return { ok: true, nadie: true };
  var q = 'in:inbox newer_than:' + BUZON_DIAS_ + 'd {' + dirs.map(function (d) { return 'from:' + d; }).join(' ') + '}', hilos = [];
  try { hilos = GmailApp.search(q, 0, BUZON_HILOS_) || []; } catch (e) { console.error('buzonRevisar_ Gmail: ' + e); return { ok: false, error: 'gmail' }; }
  var vistos = buzonVistos_(), limite = Date.now() - BUZON_DIAS_ * 86400000, hechos = [];
  hilos.forEach(function (h) {
    var tocado = false;
    h.getMessages().forEach(function (m) {
      var id = m.getId(); if (vistos.indexOf(id) >= 0) return;
      if (m.getDate().getTime() < limite) return;
      var dir = correoDir_(m.getFrom()), adm = buzonPrincipal_(dir);
      if (!adm || !buzonParaHub_(m)) return;   // de otra persona o no va a Alma: no se marca (otro principal o un alias nuevo lo verá)
      vistos.push(id);
      if (!buzonAutentico_(m, dir)) { console.warn('buzonRevisar_: correo sin firma válida, no entra a la Biblioteca'); return; }
      var r = buzonGuardar_(adm, m); r.adm = adm; hechos.push(r); tocado = true;
    });
    if (tocado) { try { h.addLabel(GmailApp.getUserLabelByName(BUZON_ETIQUETA_) || GmailApp.createLabel(BUZON_ETIQUETA_)); } catch (e) {} }
  });
  buzonVistosGuardar_(vistos);
  if (hechos.length) buzonAvisar_(hechos);
  return { ok: true, correos: hechos.length, documentos: hechos.reduce(function (n, r) { return n + r.guardados.length; }, 0) };
}

/* Un solo aviso por vuelta. Si Claudio esperaba UN documento, va como ajuste de su microproyecto; si no, al chat de Juan. */
function buzonAvisar_(hechos) {
  var adm = hechos[0].adm, docs = [], fuera = [];
  hechos.forEach(function (r) { docs = docs.concat(r.guardados); fuera = fuera.concat(r.fuera); });
  var asuntos = hechos.map(function (r) { return '«' + r.asunto + '»'; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
  var lista = docs.map(function (d) { return '«' + d.nombre + '»'; }).join(', ');
  var txtFuera = fuera.length ? ' No pude guardar: ' + fuera.join(', ') + '.' : '';
  var pedidos = [];
  try { pedidos = biblioPedidos_(); } catch (e) {}
  if (docs.length && pedidos.length === 1) {
    var p = pedidos[0];
    biblioPedidoQuitar_(p.micro);
    try {
      var rr = microResponder_(adm, p.micro, 'Te mandé por correo a alma@ ' + (docs.length === 1 ? 'el documento ' : 'los documentos ') + docs.map(function (d) { return '«' + d.nombre + '» (id ' + d.id + ')'; }).join(', ') +
        '; ya están en la Biblioteca de Claudio, lo que pediste («' + p.que + '»). Léelos con tu lector y sigue.', { sinChat: false });
      if (rr && rr.ok) { buzonChat_(adm, 'Listo, tu correo ' + asuntos.join(', ') + ' ya quedó con Claudio en «' + p.nombre + '»: ' + lista + '.' + txtFuera, docs.length); return; }
    } catch (e) { console.error('buzonAvisar_ ajuste: ' + e); }
  }
  var t = docs.length
    ? 'Me llegó tu correo ' + asuntos.join(', ') + '. Ya está en la Biblioteca de Claudio (' + lista + '): Claudio lo ve en su próximo pedido. Pídele lo que quieras con eso.' + txtFuera
    : 'Me llegó tu correo ' + asuntos.join(', ') + ', pero no pude pasarle nada a Claudio.' + txtFuera;
  buzonChat_(adm, t, docs.length);
}
function buzonChat_(adm, texto, n) {
  try { opGuardar_(adm, 'alma', 'hub', texto, [{ tipo: 'biblioteca', resumen: 'Correo a Claudio · ' + n + (n === 1 ? ' documento' : ' documentos') }]); } catch (e) { console.error('buzonChat_ chat: ' + e); }
  try {
    pendAvisar_(adm, texto, { origen: 'segundo_plano', clasif: { tipo: n ? 'aviso' : 'atencion', area: 'proposito', proyecto: 'Spacio AM', titulo: 'Correo a Claudio',
      resumen: texto.slice(0, 280), aviso: texto.slice(0, 280), importancia: 1, tarjeta: null, acciones: [] } });
  } catch (e) { console.error('buzonChat_ pendiente: ' + e); }
}
