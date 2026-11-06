/* ═══ RESPONDER EN EL HILO (leer_correo y responder_correo) ═══════════════════════════════════════════════════════
   Pedido de Juan (4-nov-2026): le reenvía a Alma un correo de un socio, ella lo lee, le da un resumen, lo hablan y Juan
   le dice qué contestar. El Hub corre como la cuenta de Juan (webapp USER_DEPLOYING y disparadores) y manda como
   hola@spacioam.com si ese alias existe («Enviar como»).
   · leer_correo: el hilo entero, lo más reciente primero, hasta CORREO_LEER_MAX_ caracteres (uno solo, hasta CORREO_MSG_MAX_), sin el historial citado ni
     las firmas (y dice «recortado» si quitó o cortó algo). Si el correo es un reenvío, saca el bloque reenviado (quién lo
     escribió, asunto, fecha) y su texto. Los adjuntos: PDF y fotos los lee el modelo de visión (claude_, por uf_, con su
     costo en IA_USO), CSV y Excel (.xlsx) se vuelven tabla; lo demás, «No puedo abrir este tipo». A lo mucho 3 adjuntos y
     10 MB por correo.
   · responder_correo: contesta a quien escribió el correo, en el mismo hilo.
       1. Si el correo original está en esta bandeja (Juan lo recibió en su cuenta, o llegó a hola@ y entra aquí):
          GmailMessage.reply() (o replyAll() con a_todos), que mantiene el hilo y el «Re:».
       2. Si solo está el reenvío de Juan: un correo nuevo al socio con «Re: <asunto original>». Si el reenvío trae el
          Message-ID del original, sale por el servicio avanzado de Gmail con In-Reply-To y References (GmailApp no deja
          poner esos encabezados); si no lo trae, o el servicio no está, sale con GmailApp.sendEmail.
     Nunca sale sin el sí de Juan: la primera llamada solo arma el borrador (para, copia, asunto y texto) y lo guarda; el
     envío pide confirmado = true en un mensaje NUEVO de Juan (otro turno), con el mismo texto. Es la confirmación del
     chat para mensajes a terceros (como el calendario), no el «Envío con deshacer» de decisiones.js: ese es para los
     casos de huéspedes por WhatsApp y manda por la conversación de la reserva, no por correo.
   Lo que sale queda en ALMA_CORREOS con tipo «respuesta», el destinatario y el hilo. */

var CORREO_LEER_MAX_ = 20000, CORREO_MSG_MAX_ = 14000, CORREO_ADJ_MAX_ = 3, CORREO_ADJ_BYTES_ = 10 * 1024 * 1024, CORREO_ADJ_TEXTO_ = 1800;
var CORREO_REGISTRO_CAB_ = ['fecha', 'tipo', 'para', 'desde', 'asunto', 'propiedad', 'codigo', 'estado', 'texto', 'html', 'hilo'];

/* La dirección de «Nombre <a@b.com>», «a@b.com» o «Nombre [mailto:a@b.com]», en minúsculas. */
function correoDir_(s) {
  s = String(s || '');
  var m = /<\s*([^<>\s]+@[^<>\s]+)\s*>/.exec(s) || /mailto:([^\]\s>]+@[^\]\s>]+)/i.exec(s) || /([A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(s);
  return m ? m[1].replace(/[.,;:]+$/, '').toLowerCase() : '';
}
function correoNombre_(s) { var n = String(s || '').replace(/<[^>]*>|\[mailto:[^\]]*\]/gi, '').replace(/["*]/g, '').trim(); return n && n.indexOf('@') < 0 ? n : ''; }
/* Nuestras direcciones: la cuenta que corre el Hub, sus alias y hola@. Lo que viene de ellas no es «de afuera». */
function correoPropias_() {
  var l = [String(CFG.EMAIL_DESDE || '').toLowerCase()];
  try { l.push(String(Session.getEffectiveUser().getEmail() || '').toLowerCase()); } catch (e) {}
  try { (GmailApp.getAliases() || []).forEach(function (a) { l.push(String(a).toLowerCase()); }); } catch (e) {}
  return l.filter(Boolean);
}
function correoCuentaHub_() { try { return String(Session.getEffectiveUser().getEmail() || ''); } catch (e) { return ''; } }
/* «RE: Fwd: RV: Estado de cuenta» → «Estado de cuenta». */
function correoAsuntoBase_(s) {
  s = String(s || '').trim();
  for (var i = 0; i < 6; i++) { var t = s.replace(/^\s*(re|rv|fw|fwd|tr|aw|wg|reenviar|reenviado|res)\s*(\[\d+\])?\s*:\s*/i, ''); if (t === s) break; s = t; }
  return s.trim();
}
function correoTextoPlano_(m) {
  return String(m.getPlainBody() || '').replace(/\r/g, '').replace(/<(https?|mailto):[^>\s]+>/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ── El bloque reenviado ──
   Gmail web (es/en):  «---------- Forwarded message ---------» o «---------- Mensaje reenviado ---------», luego
                       De:/From:, Date:/Fecha:, Subject:/Asunto:, To:/Para:.
   iPhone (Mail):      «Begin forwarded message:» o «Inicio del mensaje reenviado:», una línea vacía y From:/De:, Subject:/
                       Asunto:, Date:/Fecha:, To:/Para: (a veces con «> » delante).
   Outlook (es/en):    «________________________________» o «-----Original Message-----» / «-----Mensaje original-----», y
                       From:/De:, Sent:/Enviado:, To:/Para:, Subject:/Asunto: (el remitente a veces «[mailto:…]» o en *negrita*).
   Devuelve { de, de_nombre, asunto, fecha, para, cc, mid, nota (lo que Juan escribió arriba), cuerpo } o null. */
var CORREO_REENVIO_MARCA_ = /^[ \t>*]*(?:-{2,}\s*(?:forwarded message|mensaje reenviado|original message|mensaje original)\s*-{2,}|begin forwarded message\s*:|inicio del mensaje reenviado\s*:|_{10,})\s*$/i;
var CORREO_REENVIO_EXPLICITO_ = /^[ \t>*]*(?:-{2,}\s*(?:forwarded message|mensaje reenviado)\s*-{2,}|begin forwarded message\s*:|inicio del mensaje reenviado\s*:)\s*$/im;
var CORREO_CAMPO_ = /^[ \t>]*\*?\s*(de|from|asunto|subject|tema|fecha|date|enviado(?: el)?|sent|para|to|cc|message-id)\s*\*?\s*:\s*\*?\s*(.*?)\s*$/i;
var CORREO_CAMPO_CLAVE_ = { de: 'de', from: 'de', asunto: 'asunto', subject: 'asunto', tema: 'asunto', fecha: 'fecha', date: 'fecha', enviado: 'fecha', 'enviado el': 'fecha', sent: 'fecha', para: 'para', to: 'para', cc: 'cc', 'message-id': 'mid' };
function correoReenvio_(txt) {
  var L = String(txt || '').replace(/\r/g, '').split('\n');
  for (var i = 0; i < L.length; i++) {
    var marca = CORREO_REENVIO_MARCA_.test(L[i]), esDe = /^[ \t>]*\*?\s*(de|from)\s*\*?\s*:/i.test(L[i]);
    if (!marca && !esDe) continue;
    var j = marca ? i + 1 : i; while (j < L.length && !L[j].replace(/^[ \t>]*/, '').trim()) j++;
    var cab = {}, ultimo = '', k = j;
    for (; k < L.length && k < j + 14; k++) {
      var lin = L[k], m = CORREO_CAMPO_.exec(lin);
      if (m) { ultimo = CORREO_CAMPO_CLAVE_[m[1].toLowerCase()]; if (!(ultimo in cab)) cab[ultimo] = m[2].replace(/\*+$/, '').trim(); continue; }
      if (!lin.replace(/^[ \t>]*/, '').trim()) { if (Object.keys(cab).length) { k++; break; } continue; }
      if ((ultimo === 'para' || ultimo === 'cc') && /@/.test(lin)) { cab[ultimo] += ' ' + lin.trim(); continue; }   // «To:» partido en dos líneas
      break;
    }
    var de = correoDir_(cab.de);
    if (!de || cab.asunto == null) continue;
    var mid = (/<[^<>\s]+@[^<>\s]+>/.exec(cab.mid || '') || [''])[0];
    return { de: de, de_nombre: correoNombre_(cab.de), asunto: String(cab.asunto || '').trim(), fecha: String(cab.fecha || '').trim(), para: cab.para || '', cc: cab.cc || '', mid: mid,
      nota: L.slice(0, i).join('\n').trim(), cuerpo: L.slice(k).map(function (x) { return x.replace(/^> ?/, ''); }).join('\n').trim() };
  }
  return null;
}
/* Un mensaje es un reenvío si su asunto lo dice (Fwd:, RV:, TR:…) o trae una marca de reenvío explícita. Así una respuesta de
   Outlook, que cita el correo anterior con «From:/Sent:» abajo, no se toma por reenvío. */
function correoEsReenvio_(asunto, txt) {
  return /^\s*(fwd?|rv|tr|wg|reenv(?:iado|iar)?)\s*:/i.test(String(asunto || '')) || CORREO_REENVIO_EXPLICITO_.test(String(txt || ''));
}

/* Quita el historial citado y la firma. Devuelve { texto, recortado }. */
function correoLimpio_(txt) {
  var t = String(txt || '').replace(/\r/g, ''), antes = t.length;
  var cortes = [/^[ \t]*(?:On|El|Le|Am)\s[^\n]{0,240}(?:\n[^\n]{0,160}){0,2}?(?:wrote|escribió|a écrit|schrieb)\s*:\s*$/im,
    /^[ \t>*]*-{2,}\s*(?:original message|mensaje original)\s*-{2,}\s*$/im, /^[ \t]*_{10,}\s*\n[ \t*]*(?:from|de)\s*\*?:/im,
    /^[ \t]*\*?(?:from|de)\s*\*?:[^\n]*\n[ \t]*\*?(?:sent|enviado(?: el)?|date|fecha)\s*\*?:/im, /^-- ?$/m];
  cortes.forEach(function (re) { var m = re.exec(t); if (m) t = t.slice(0, m.index); });
  t = t.split('\n').filter(function (l) { return !/^\s*>/.test(l) && !/^\s*(enviado desde mi (iphone|ipad|android|móvil|celular)|sent from my (iphone|ipad|android|mobile)|(get|obtener) outlook (for|para) (ios|android))\s*$/i.test(l); }).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return { texto: t, recortado: t.length < antes - 40 };
}

/* ── Buscar el correo ──
   6-nov-2026: Juan pidió contestar «Seguimiento a rentas Actuales - Apartamentos para remodelación» y Alma dijo que no
   estaba en la bandeja del Hub, aunque estaba (el original y el reenvío de Juan, en el mismo hilo). El asunto real dice
   «remodelacion», sin tilde, y la búsqueda de Gmail distingue tildes: «remodelación» da cero y «remodelacion» lo
   encuentra (y al revés: «energia» no encuentra «energía»). La búsqueda de antes mandaba el texto tal cual, luego
   cualquiera de sus palabras (con «para» salían 200 correos y se tomaba el más nuevo, otro correo) y luego la palabra
   más larga; y si no encontraba, le decía a Alma que le pidiera a Juan reenviarlo. Ahora:
   · las palabras se buscan con y sin tilde ({remodelación remodelacion}); sin comillas, guiones de negación ni
     palabras vacías («a», «para», «correo»);
   · from:/subject: del modelo se prueban tal cual y también como palabras sueltas («from:diana» no encuentra a
     Casa Sol, que escribe como «administración Casa Sol», pero «Diana» sí está en la firma);
   · cada candidato se califica aquí, sin tildes: cuántas de las palabras están en su asunto, en quién lo mandó o
     recibió, o en el texto; gana el que más tiene, y si ninguno tiene al menos la mitad, no se adivina;
   · si no lo encuentra, dice qué buscó y en qué cuenta, y nunca pide reenviar lo que ya llega a esta bandeja. */
var CORREO_VACIAS_ = ['a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'lo', 'le', 'y', 'o', 'u', 'e', 'en', 'con', 'por', 'para', 'que', 'un', 'una', 'mi', 'su', 'tu',
  'es', 'se', 'sus', 'mis', 're', 'rv', 'fw', 'fwd', 'tr', 'correo', 'email', 'mail', 'asunto', 'the', 'of', 'and', 'to', 'for', 'from', 'subject'];
var CORREO_OP_ = /^-?(from|to|cc|bcc|subject|has|in|is|label|filename|after|before|newer_than|older_than|newer|older|category|larger|smaller|deliveredto|list|rfc822msgid):/i;
function correoSinTilde_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
/* El pedido del modelo → { ops (operadores tal cual), palabras (sin vacías, sin repetir), fecha (si ya trae una) }. */
function correoPalabras_(q) {
  var ops = [], pal = [], vistas = {}, fecha = false;
  String(q || '').replace(/[«»“”"'`(){}\[\]]/g, ' ').split(/\s+/).forEach(function (t) {
    t = t.replace(/[.,;:!?¿¡]+$/, '');
    if (!CORREO_OP_.test(t)) t = t.replace(/^[-–—.,;:!?¿¡]+/, '');   // «-Apartamentos» del asunto no es «sin Apartamentos»
    if (!t) return;
    if (CORREO_OP_.test(t)) {
      if (/^(after|before|newer_than|older_than|newer|older):/i.test(t)) fecha = true;
      ops.push(t);
      var val = t.replace(CORREO_OP_, '');
      if (/^(from|to|cc|subject):/i.test(t) && val) t = val; else return;   // su valor también sirve como palabra
    }
    var n = correoSinTilde_(t);
    if (n.length < 3 && !/\d/.test(n) || CORREO_VACIAS_.indexOf(n) >= 0 || vistas[n]) return;
    vistas[n] = 1; pal.push(t);
  });
  return { ops: ops, palabras: pal.slice(0, 8), fecha: fecha };
}
/* «remodelación» → «{remodelación remodelacion}»; «remodelacion» → «{remodelacion remodelación}» (-cion/-sion). */
function correoVariantes_(w) {
  var sin = correoSinTilde_(w), v = [w];
  if (sin !== String(w).toLowerCase()) v.push(sin);
  else if (/[cs]ion(es)?$/.test(sin)) v.push(sin.replace(/([cs])ion(es)?$/, function (m, c, es) { return es ? c + 'iones' : c + 'ión'; }));
  return v.length > 1 ? '{' + v.join(' ') + '}' : w;
}
/* Cuántas palabras tiene el hilo: asunto y direcciones valen 2, el texto 1. El texto solo se lee si hace falta. */
function correoPuntaje_(h, pal) {
  var ms = h.getMessages(), cab = correoSinTilde_(h.getFirstMessageSubject() + ' ' + ms.map(function (m) { return m.getSubject() + ' ' + m.getFrom() + ' ' + m.getTo() + ' ' + m.getCc(); }).join(' '));
  var txt = null, puntos = 0, tiene = 0;
  pal.forEach(function (w) {
    var re = new RegExp('(^|[^a-z0-9])' + correoSinTilde_(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (re.test(cab)) { puntos += 2; tiene++; return; }
    if (txt === null) txt = correoSinTilde_([ms[0], ms[ms.length - 1]].map(function (m) { return String(m.getPlainBody() || '').slice(0, 8000); }).join(' '));
    if (re.test(txt)) { puntos += 1; tiene++; }
  });
  return { puntos: puntos, tiene: tiene };
}
function correoBuscar_(q) {
  q = String(q || '').replace(/\s+/g, ' ').trim(); if (!q) return { error: 'Dime qué correo busco.' };
  var cuenta = correoCuentaHub_(), p = correoPalabras_(q), pal = p.palabras, vars = pal.map(correoVariantes_);
  var ventana = p.fecha ? '' : ' newer_than:30d', otros = p.ops.filter(function (o) { return !/^(from|to|cc|subject):/i.test(o); }).join(' ');
  var intentos = [
    (p.ops.join(' ') + ' ' + vars.join(' ')).trim() + ventana,                        // tal cual, con y sin tildes
    (otros + ' ' + vars.join(' ')).trim() + ventana,                                  // from:/subject: como palabras sueltas
    pal.length > 1 ? (otros + ' {' + vars.join(' ').replace(/[{}]/g, '') + '}').trim() + ventana : '',   // cualquiera de ellas
    pal.length ? 'in:anywhere {' + vars.join(' ').replace(/[{}]/g, '') + '}' + (p.fecha ? '' : ' newer_than:90d') : ''   // archivo y spam, 90 días
  ].filter(function (x, i, arr) { return x && x !== ventana.trim() && arr.indexOf(x) === i; });
  if (!pal.length && !p.ops.length) return { error: 'Dime qué correo busco: una palabra del asunto o quién lo mandó.' };
  var minimo = Math.max(1, Math.ceil(pal.length / 2)), vistos = {}, cand = [], buscado = [], fallo = '';
  for (var i = 0; i < intentos.length; i++) {
    var hs = [];
    try { hs = GmailApp.search(intentos[i], 0, i >= 2 ? 20 : 10) || []; } catch (e) { fallo = String(e).slice(0, 150); }
    buscado.push(intentos[i]);
    hs.forEach(function (h, k) {
      var id = h.getId(); if (vistos[id]) return; vistos[id] = 1;
      var s = pal.length ? correoPuntaje_(h, pal) : { puntos: 1, tiene: 1 };
      cand.push({ h: h, puntos: s.puntos, tiene: s.tiene, orden: cand.length });
    });
    if (cand.some(function (c) { return c.tiene >= minimo && c.tiene === pal.length; })) break;   // ya está el que tiene todas
  }
  var buenos = cand.filter(function (c) { return c.tiene >= minimo; }).sort(function (a, b) { return b.puntos - a.puntos || a.orden - b.orden; });
  if (buenos.length) return { ok: true, cuenta: cuenta, hilos: buenos.slice(0, 5).map(function (c) { return c.h; }), q: q, buscado: buscado };
  var parecidos = cand.slice(0, 3).map(function (c) { return c.h.getFirstMessageSubject(); });
  return { error: 'No encontré ese correo en la bandeja del Hub, la cuenta ' + cuenta + '. Busqué en Gmail: ' + buscado.map(function (x) { return '«' + x + '»'; }).join(' · ') +
      ' (con y sin tildes; los últimos 30 días y, en archivo y spam, 90).' + (fallo ? ' Gmail respondió: ' + fallo + '.' : '') +
      (parecidos.length ? ' Lo más parecido, sin ser ese: ' + parecidos.map(function (x) { return '«' + x + '»'; }).join(', ') + '.' : '') +
      ' Dile a Juan qué buscaste y en qué cuenta, y pídele otra palabra del asunto o quién lo mandó. No le pidas que lo reenvíe: lo que llega a su correo y a hola@spacioam.com ya entra a esta cuenta.',
    cuenta: cuenta, buscado: buscado };
}

/* leer_correo: el hilo entero, lo más reciente primero, limpio, con lo que dicen sus adjuntos. */
function correoLeer_(q) {
  var b = correoBuscar_(q); if (b.error) return b;
  var hilo = b.hilos[0], ms = hilo.getMessages().slice().reverse(), usado = 0, recortado = false, reenvio = null, mensajes = [];
  ms.forEach(function (m) {
    if (usado >= CORREO_LEER_MAX_) { recortado = true; return; }
    var crudo = correoTextoPlano_(m), rv = correoEsReenvio_(m.getSubject(), crudo) ? correoReenvio_(crudo) : null, texto, rec;
    if (rv) {
      var a = correoLimpio_(rv.nota), c = correoLimpio_(rv.cuerpo);
      texto = (a.texto ? a.texto + '\n\n' : '') + '[Reenviado · de ' + (rv.de_nombre ? rv.de_nombre + ' <' + rv.de + '>' : rv.de) + (rv.fecha ? ' · ' + rv.fecha : '') + ' · «' + rv.asunto + '»]\n' + c.texto;
      rec = a.recortado || c.recortado;
      if (!reenvio) reenvio = { de: rv.de, nombre: rv.de_nombre, asunto: rv.asunto, fecha: rv.fecha };
    } else { var l = correoLimpio_(crudo); texto = l.texto; rec = l.recortado; }
    var cabe = Math.min(CORREO_LEER_MAX_ - usado, CORREO_MSG_MAX_);   // uno muy largo no deja fuera a los anteriores
    if (texto.length > cabe) { texto = texto.slice(0, cabe); rec = true; }
    usado += texto.length; recortado = recortado || rec;
    mensajes.push({ de: m.getFrom(), fecha: Utilities.formatDate(m.getDate(), CFG.TZ, 'yyyy-MM-dd HH:mm'), texto: texto });
  });
  var adj = correoAdjuntosLeer_(ms), largo = usado > 3000 || ms.length > 2;
  return { ok: true, cuenta: b.cuenta, asunto: hilo.getFirstMessageSubject(), de: ms[0].getFrom(), fecha: mensajes[0] && mensajes[0].fecha, n_mensajes: ms.length,
    mensajes: mensajes, reenvio: reenvio || undefined, adjuntos: adj.length ? adj : undefined, recortado: recortado,
    nota: largo ? 'Es largo: a Juan dale un resumen corto (de qué trata, qué piden y qué queda pendiente), no el texto entero.' : undefined,
    otros: b.hilos.slice(1).map(function (h) { return h.getFirstMessageSubject(); }) };
}

/* ── Adjuntos ── */
function correoAdjTipo_(mime, nombre) {
  mime = String(mime || '').toLowerCase(); nombre = String(nombre || '').toLowerCase();
  if (mime === 'application/pdf' || /\.pdf$/.test(nombre)) return 'pdf';
  if (/^image\/(jpeg|png|webp|gif)$/.test(mime)) return 'imagen';
  if (/csv/.test(mime) || /\.csv$/.test(nombre)) return 'csv';
  if (/spreadsheetml/.test(mime) || /\.xlsx$/.test(nombre)) return 'excel';
  return '';
}
function correoAdjuntosLeer_(ms) {
  var out = [], leidos = 0, bytes = 0;
  ms.forEach(function (m) {
    var as = []; try { as = m.getAttachments({ includeInlineImages: false }) || []; } catch (e) {}
    as.forEach(function (a) {
      if (out.length >= 10) return;
      var nombre = String(a.getName() || 'adjunto'), mime = String(a.getContentType() || '').split(';')[0].toLowerCase(), tam = Number(a.getSize()) || 0, tipo = correoAdjTipo_(mime, nombre);
      var it = { nombre: nombre, tipo: tipo || 'otro', kb: Math.round(tam / 1024) };
      if (!tipo) it.nota = 'No puedo abrir este tipo.';
      else if (leidos >= CORREO_ADJ_MAX_) it.nota = 'No lo leí: leo a lo mucho ' + CORREO_ADJ_MAX_ + ' adjuntos por correo.';
      else if (bytes + tam > CORREO_ADJ_BYTES_ || (tipo === 'imagen' && tam > 4.5 * 1024 * 1024)) it.nota = 'No lo leí: es muy pesado (tope 10 MB entre todos).';
      else {
        leidos++; bytes += tam;
        var r = tipo === 'csv' ? correoCsvTabla_(a) : tipo === 'excel' ? correoXlsxTabla_(a) : correoAdjuntoVer_(a, tipo, mime, nombre);
        if (r.error) it.nota = r.error; else { it.contenido = r.texto; if (r.recortado) it.recortado = true; }
      }
      out.push(it);
    });
  });
  return out;
}
/* PDF o foto: el modelo de visión (claude_ → uf_, y su costo queda en IA_USO). Caché de 6 h por archivo: releer el
   mismo correo no paga dos veces. */
function correoAdjuntoVer_(a, tipo, mime, nombre) {
  var bytes = a.getBytes(), c = CacheService.getScriptCache(), k = '';
  try { k = 'CORADJ_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes)).replace(/[^A-Za-z0-9]/g, ''); var ya = c.get(k); if (ya) return { texto: ya }; } catch (e) {}
  var data = 'data:' + (tipo === 'pdf' ? 'application/pdf' : mime) + ';base64,' + Utilities.base64Encode(bytes);
  var t = claude_(CFG.MODELO_REDACTOR, 900, 'Es un adjunto de un correo que recibió Spacio AM (alojamientos de estancia corta en Guatemala). En español y en hasta 12 líneas: qué documento es y lo importante, copiando tal cual montos, fechas, nombres, números de factura o de cuenta, y lo que pide o queda pendiente. Solo lo que se ve; sin suponer.',
    'Adjunto «' + nombre + '».', 0.2, [data], 1);
  t = String(t || '').trim(); if (!t) return { error: 'No pude leerlo ahora.' };
  t = t.slice(0, CORREO_ADJ_TEXTO_);
  try { if (k) c.put(k, t, 21600); } catch (e) {}
  return { texto: t };
}
function correoTablaTexto_(filas) {
  filas = (filas || []).filter(function (f) { return f.some(function (x) { return String(x).trim(); }); });
  var out = [], n = 0;
  for (var i = 0; i < filas.length && i < 40; i++) {
    var lin = filas[i].slice(0, 12).map(function (x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }).join(' | ');
    if (n + lin.length > CORREO_ADJ_TEXTO_) break;
    out.push(lin); n += lin.length + 1;
  }
  return { texto: out.join('\n'), recortado: out.length < filas.length };
}
function correoCsvTabla_(a) {
  try { return correoTablaTexto_(Utilities.parseCsv(a.getDataAsString())); } catch (e) { return { error: 'No pude abrir el CSV.' }; }
}
/* Excel (.xlsx) sin servicios extra: es un zip; se lee la primera hoja y sus textos compartidos. El .xls viejo no. */
function correoXml_(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
function correoXlsxTabla_(a) {
  try {
    var partes = Utilities.unzip(a.copyBlob ? a.copyBlob().setContentType('application/zip') : a), hoja = '', comp = '';
    partes.forEach(function (p) { var n = p.getName(); if (n === 'xl/worksheets/sheet1.xml') hoja = p.getDataAsString(); if (n === 'xl/sharedStrings.xml') comp = p.getDataAsString(); });
    if (!hoja) return { error: 'No puedo abrir este tipo.' };
    var textos = [], m, re = /<si>([\s\S]*?)<\/si>/g;
    while ((m = re.exec(comp))) textos.push((m[1].match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(correoXml_).join(''));
    var filas = [], rf = /<row\b[^>]*>([\s\S]*?)<\/row>/g, fm;
    while ((fm = rf.exec(hoja)) && filas.length < 200) {
      var fila = [], rc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
      while ((cm = rc.exec(fm[1]))) {
        var col = (/\br="([A-Z]+)\d+"/.exec(cm[1]) || [])[1], t = (/\bt="(\w+)"/.exec(cm[1]) || [])[1], cuerpo = cm[2] || '';
        var v = (/<v>([\s\S]*?)<\/v>/.exec(cuerpo) || [])[1], val = t === 's' ? (textos[Number(v)] || '') : t === 'inlineStr' ? correoXml_(cuerpo) : correoXml_(v || '');
        var ix = col ? col.split('').reduce(function (s, ch) { return s * 26 + ch.charCodeAt(0) - 64; }, 0) - 1 : fila.length;
        while (fila.length < ix) fila.push('');
        fila[ix] = val;
      }
      filas.push(fila);
    }
    return correoTablaTexto_(filas);
  } catch (e) { return { error: 'No puedo abrir este tipo.' }; }
}

/* ── responder_correo ── */
/* A quién va la respuesta y cómo. { modo: 'hilo', mensaje } si el correo de afuera está en esta bandeja; { modo:
   'reenvio', mid } si solo está el reenvío de Juan. */
function correoDestino_(q, aTodos) {
  var b = correoBuscar_(q); if (b.error) return b;
  var propias = correoPropias_(), hilo = b.hilos[0], ms = hilo.getMessages();
  var nuestra = function (d) { return propias.indexOf(correoDir_(d)) >= 0; };
  var copia = function (lista, sin) { return lista.join(',').split(/[,;]/).map(correoDir_).filter(function (d, i, arr) { return d && !nuestra(d) && sin.indexOf(d) < 0 && arr.indexOf(d) === i; }); };
  var enHilo = function (m) {
    var para = correoDir_(m.getReplyTo() || m.getFrom());
    return { modo: 'hilo', mensaje: m, hilo: hilo, para: para, asunto: 'Re: ' + correoAsuntoBase_(m.getSubject()), cc: aTodos ? copia([m.getTo(), m.getCc()], [para]) : [] };
  };
  var ult = ms[ms.length - 1], crudo = correoTextoPlano_(ult);
  var rv = correoEsReenvio_(ult.getSubject(), crudo) ? correoReenvio_(crudo) : null;
  if (rv && nuestra(rv.de)) rv = null;   // un reenvío de algo que escribimos nosotros: no es el socio
  if (!rv) {
    for (var i = ms.length - 1; i >= 0; i--) if (!nuestra(ms[i].getFrom())) return enHilo(ms[i]);
    return { error: 'En ese correo no hay nada de otra persona ni un reenvío al que responder.' };
  }
  /* Es un reenvío: ¿está el original en esta misma bandeja? Primero en el mismo hilo: Gmail junta el reenvío de Juan con
     el original cuando los dos llegan a esta cuenta (pasó con Casa Sol, 6-nov), y entonces se responde ahí mismo. */
  var base = correoAsuntoBase_(rv.asunto).toLowerCase(), otros = [];
  try { otros = GmailApp.search('from:' + rv.de + ' newer_than:90d', 0, 20) || []; } catch (e) {}
  otros = [hilo].concat(otros.filter(function (x) { return x.getId() !== hilo.getId(); }));
  for (var h = 0; h < otros.length; h++) {
    var om = otros[h] === hilo ? ms : otros[h].getMessages();
    for (var j = om.length - 1; j >= 0; j--) if (correoDir_(om[j].getFrom()) === rv.de && correoAsuntoBase_(om[j].getSubject()).toLowerCase() === base) { var d = enHilo(om[j]); d.hilo = otros[h]; return d; }
  }
  return { modo: 'reenvio', hilo: hilo, para: rv.de, asunto: 'Re: ' + correoAsuntoBase_(rv.asunto), mid: rv.mid, cc: aTodos ? copia([rv.para, rv.cc], [rv.de]) : [] };
}
function correoNorm_(s) { return String(s || '').replace(/[“”«»"]/g, '"').replace(/\s+/g, ' ').trim(); }
/* Sin confirmado (o en el mismo turno del borrador): arma el borrador y lo guarda. Con confirmado en un mensaje nuevo de
   Juan y el mismo texto: lo manda. AGENTE_TEXTO_ es lo que Juan escribió en este turno (agente.js). */
function correoResponder_(adm, o) {
  o = o || {};
  var c = CacheService.getScriptCache(), k = 'CORREO_RESP_' + String((adm && adm.email) || '').toLowerCase(), turno = String(typeof AGENTE_TEXTO_ === 'undefined' ? '' : AGENTE_TEXTO_ || '');
  var aTodos = o.a_todos === true, texto = String(o.texto || '').trim(), prev = null;
  try { prev = JSON.parse(c.get(k) || 'null'); } catch (e) {}
  if (o.confirmado === true && prev && turno && prev.turno !== turno && (!texto || correoNorm_(texto) === correoNorm_(prev.texto)) && (o.a_todos == null || aTodos === prev.a_todos)) {
    c.remove(k);
    return correoResponderEnviar_(prev);
  }
  if (!texto) return { error: prev ? 'Falta el texto de la respuesta (el borrador pendiente era: «' + prev.texto.slice(0, 200) + '»).' : 'Falta el texto de la respuesta.' };
  var d = correoDestino_(o.buscar, aTodos); if (d.error) return d;
  var no = ''; try { no = correoNoResponder_(correoCuentaHub_(), d.para); } catch (e) {}
  if (no) return { error: 'No le respondo a ' + d.para + ': ' + no + '.' };
  var b = { texto: texto, a_todos: aTodos, turno: turno, modo: d.modo, para: d.para, cc: d.cc, asunto: d.asunto, msg: d.mensaje ? d.mensaje.getId() : '', hilo: d.hilo.getId(), mid: d.mid || '' };
  c.put(k, JSON.stringify(b), 3600);
  return { ok: true, falta_confirmar: true,
    borrador: { para: d.para, copia: d.cc.length ? d.cc.join(', ') : 'nadie', asunto: d.asunto, texto: texto, como: d.modo === 'hilo' ? 'respuesta en el mismo hilo' : 'correo nuevo con «Re:» (solo tengo tu reenvío)' },
    nota: 'Todavía NO salió.' + (o.confirmado === true ? ' El sí tiene que llegar en un mensaje nuevo de Juan, después de ver este borrador.' : '') + ' Muéstrale a Juan el borrador COMPLETO (para, copia, asunto y texto) y espera su sí. Con su sí, llama otra vez con confirmado = true y el mismo texto. Si cambia algo, es un borrador nuevo.' };
}
function correoResponderEnviar_(b) {
  var yo = correoCuentaHub_(), desde = yo, o = { name: 'Alma' }, estado = 'enviado', como = b.modo === 'hilo' ? 'en el mismo hilo' : 'correo nuevo con Re:';
  try { if (yo !== CFG.EMAIL_DESDE && GmailApp.getAliases().indexOf(CFG.EMAIL_DESDE) !== -1) { o.from = CFG.EMAIL_DESDE; desde = CFG.EMAIL_DESDE; } } catch (e) {}
  try {
    if (b.modo === 'hilo') { var m = GmailApp.getMessageById(b.msg); if (b.a_todos) m.replyAll(b.texto, o); else m.reply(b.texto, o); }
    else if (b.mid && typeof Gmail !== 'undefined' && Gmail.Users && Gmail.Users.Messages) { correoEnviarConEncabezados_(b, desde); como = 'correo nuevo en el hilo del socio (In-Reply-To)'; }
    else { if (b.a_todos && b.cc && b.cc.length) o.cc = b.cc.join(','); GmailApp.sendEmail(b.para, b.asunto, b.texto, o); }
  } catch (e) { estado = 'error: ' + String(e).slice(0, 200); console.error('correoResponderEnviar_: ' + e); }
  var para = b.para + (b.a_todos && b.cc && b.cc.length ? ', ' + b.cc.join(', ') : '');
  try {
    var sh = hojaCrear_('ALMA_CORREOS', CORREO_REGISTRO_CAB_);
    if (sh.getLastColumn && sh.getLastColumn() < CORREO_REGISTRO_CAB_.length) sh.getRange(1, CORREO_REGISTRO_CAB_.length).setValue('hilo');   // la hoja vieja no tenía «hilo»
    sh.appendRow([new Date().toISOString(), 'respuesta', para, desde, b.asunto, '', '', estado, String(b.texto).slice(0, 4000), '', b.hilo]);
  } catch (e) {}
  return estado === 'enviado' ? { ok: true, enviado: true, enviado_a: para, desde: desde, asunto: b.asunto, como: como } : { error: 'No salió la respuesta: ' + estado };
}
/* Solo el reenvío y con Message-ID: GmailApp no deja poner In-Reply-To ni References, el servicio avanzado de Gmail sí. */
function correoEnviarConEncabezados_(b, desde) {
  var U = Utilities.Charset.UTF_8;
  var cab = ['From: Alma <' + desde + '>', 'To: ' + b.para];
  if (b.a_todos && b.cc && b.cc.length) cab.push('Cc: ' + b.cc.join(', '));
  cab.push('Subject: =?UTF-8?B?' + Utilities.base64Encode(b.asunto, U) + '?=', 'In-Reply-To: ' + b.mid, 'References: ' + b.mid,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64');
  var raw = cab.join('\r\n') + '\r\n\r\n' + (Utilities.base64Encode(b.texto, U).match(/.{1,76}/g) || []).join('\r\n');
  return Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(raw, U) }, 'me');
}
