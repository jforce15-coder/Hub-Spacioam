/* ═══ INSTAGRAM Y MESSENGER EN LA BANDEJA (#888 T5) ═══════════════════════════════════════════════════════════════
   Pedido de Juan (19-nov-2026): «juntar WhatsApp, Instagram, etcétera, todo debidamente clasificado y ordenado para que
   tengamos un solo hub donde nos comuniquemos con el mundo». Decidió construir la conexión nosotros (APIs oficiales de
   Meta, sin terceros) y que Alma conteste sola lo público (precio, disponibilidad, cómo llegar), igual que en las
   consultas, y deje A · B · C al equipo en canjes, descuentos o lo delicado.

   · Entra por el MISMO /exec del WhatsApp: Meta manda object «instagram» (mensajes directos) u object «page» (Messenger)
     con entry[].messaging[]. El «Verify token» es el mismo del WhatsApp (WA_VERIFY_TOKEN, doGet).
   · Cada mensaje se guarda en ALMA_REDES (como ALMA_WHATSAPP) y la conversación va a la bandeja (ALMA_INBOX) con conv_id
     «ig:<id de Instagram>» o «fb:<id de Messenger>». Lo que entra no gasta cupo de internet; la foto de perfil se pide
     UNA vez por persona y se guarda (vSet_).
   · APAGADO hasta que exista su llave (Ajustes → Llaves): META_PAGE_TOKEN (la Página de Facebook: Messenger, y también
     Instagram si la cuenta está ligada a la Página) o IG_TOKEN (Instagram con inicio de sesión de Instagram; manda sobre
     la Página para Instagram). Sin llave, lo que llegue se guarda y se ve, pero Alma no lo contesta ni se puede responder.
   · Ventana de Meta: dentro de 24 h desde el último mensaje de la persona se responde normal (RESPONSE). Entre 24 h y
     7 días solo una persona del equipo, con la etiqueta HUMAN_AGENT (Alma nunca la usa). Más de 7 días: no sale y se dice
     por qué. Meta no deja escribir primero.
   · Lo que el equipo contesta desde la app de Instagram o de Facebook llega como «echo»: se guarda como nuestro y cierra
     la decisión del equipo de esa conversación, igual que en Hospitable. */

var REDES_CAB_ = ['ts', 'canal', 'persona', 'nombre', 'dir', 'texto', 'mid', 'conv_id', 'autor', 'media'];
var REDES_VENTANA_MS_ = 24 * 3600000, REDES_HUMANO_MS_ = 7 * 24 * 3600000;
var REDES_GRAPH_ = 'https://graph.facebook.com/v21.0', REDES_IG_GRAPH_ = 'https://graph.instagram.com/v21.0';
/* Lo que Alma nunca decide sola por redes: va al equipo con A · B · C (Juan, 19-nov-2026, pregunta 3). */
var REDES_DELICADO_RE_ = /\b(canje|intercambio|colab(oraci[oó]n|oremos)?|collab|influencer|creador(a)? de contenido|content creator|ugc|seguidores|followers|patrocin|sponsor|publicidad|promocionar|descuento|discount|rebaja|precio especial|mejor precio|cortes[ií]a|gratis|free stay|stay for free|reembolso|refund|devoluci[oó]n|queja|demanda|abogado|polic[ií]a)\b/i;

function redesCanalDe_(convId) { var id = String(convId || ''); return id.indexOf('ig:') === 0 ? 'instagram' : id.indexOf('fb:') === 0 ? 'messenger' : ''; }
/* Conversaciones que viven solo en las hojas del Hub (nunca se piden a Hospitable). */
function convSoloLocal_(convId) { return /^(wa|llamada|ig|fb|mail):/.test(String(convId || '')); }
function hojaRedes_() { return hojaCrear_('ALMA_REDES', REDES_CAB_); }
/* La llave con que sale (y se lee el perfil) por cada red. '' = apagado. */
function redesLlave_(canal) {
  var p = PropertiesService.getScriptProperties();
  if (canal === 'instagram') { var ig = p.getProperty('IG_TOKEN'); if (ig) return { token: ig, base: REDES_IG_GRAPH_ }; }
  var pg = p.getProperty('META_PAGE_TOKEN');
  return pg ? { token: pg, base: REDES_GRAPH_ } : null;
}
function redesActivo_(canal) { return !!redesLlave_(canal); }
function redesNombreCanal_(canal) { return canal === 'instagram' ? 'Instagram' : 'Messenger'; }

/* ── Entrada ── */
function redesWebhook_(body) {
  var canal = body.object === 'instagram' ? 'instagram' : 'messenger';
  (body.entry || []).forEach(function (en) {
    (en.messaging || []).forEach(function (ev) { try { redesEntrante_(canal, ev, s_(en.id)); } catch (e) { console.error('redesEntrante_: ' + e); } });
  });
  return ok_('redes');   // siempre 200: Meta reintenta si no
}
/* El texto de un mensaje de Instagram o Messenger (o lo que mandó, si no es texto). */
function redesTexto_(msg) {
  var t = s_(msg.text);
  var adj = Array.isArray(msg.attachments) ? msg.attachments : [];
  var T = { image: '[envió una foto]', video: '[envió un video]', audio: '[envió una nota de voz]', file: '[envió un archivo]', share: '[compartió una publicación]',
    story_mention: '[te mencionó en su historia]', reel: '[compartió un reel]', ig_reel: '[compartió un reel]', sticker: '[sticker]', fallback: '[compartió un enlace]' };
  var extra = adj.map(function (a) { return T[s_(a && a.type)] || '[adjunto]'; }).filter(function (x, i, l) { return l.indexOf(x) === i; });
  if (msg.reply_to && msg.reply_to.story) extra.unshift('[respondió a tu historia]');
  if (msg.is_unsupported) extra.push('[mensaje que Meta no deja leer aquí: ábrelo en la app]');
  return (t + (extra.length ? (t ? ' ' : '') + extra.join(' ') : '')).trim();
}
function redesMedia_(msg) {
  return (Array.isArray(msg.attachments) ? msg.attachments : []).map(function (a) { return s_(a && a.payload && a.payload.url); })
    .filter(function (u) { return /^https:\/\//.test(u); }).slice(0, 4);
}
function redesEntrante_(canal, ev, cuentaId) {
  var msg = ev && ev.message; if (!msg || !msg.mid || msg.is_deleted) return;
  var cache = CacheService.getScriptCache(); if (cache.get('rd_' + msg.mid)) return; cache.put('rd_' + msg.mid, '1', 21600);
  var eco = !!msg.is_echo, persona = s_(eco ? ev.recipient && ev.recipient.id : ev.sender && ev.sender.id);
  if (!persona || persona === cuentaId) return;
  var convId = (canal === 'instagram' ? 'ig:' : 'fb:') + persona;
  var ts = ev.timestamp ? new Date(Number(ev.timestamp)).toISOString() : new Date().toISOString();
  var texto = redesTexto_(msg), media = redesMedia_(msg); if (!texto && !media.length) return;
  if (eco) {
    /* Lo mandó el equipo desde la app de Instagram o Facebook (lo que sale por la API ya quedó guardado con su mid). */
    if (redesMidGuardado_(msg.mid)) return;
    hojaRedes_().appendRow([ts, canal, persona, '', 'out', celdaTexto_(texto.slice(0, 4000)), s_(msg.mid), convId, 'equipo · app de ' + redesNombreCanal_(canal), media.join(' ')]);
    inboxUpsert_(convId, { ultimo_texto: texto.slice(0, 300), ultimo_de: 'host', ultimo_ts: ts, ultimo_host_ts: ts, ultimo_canal: canal, canal: canal });
    try { decisionAlResponder_(convId, 'Equipo'); } catch (e) { console.error('redes decisionAlResponder_: ' + e); }
    return;
  }
  var perfil = redesPerfil_(canal, persona);
  var nombre = perfil.nombre || (canal === 'instagram' ? 'Instagram' : 'Messenger') + ' · …' + persona.slice(-4);
  hojaRedes_().appendRow([ts, canal, persona, nombre, 'in', celdaTexto_(texto.slice(0, 4000)), s_(msg.mid), convId, '', media.join(' ')]);
  inboxUpsert_(convId, { huesped: nombre, foto: perfil.foto, propiedad: redesNombreCanal_(canal) + ' · Mensaje directo', tipo: 'redes', canal: canal, ultimo_canal: canal,
    ultimo_texto: texto.slice(0, 300), ultimo_de: 'guest', ultimo_ts: ts, ultimo_guest_ts: ts });
  try { CacheService.getScriptCache().remove('hf_' + convId); } catch (e) {}
  try { pushNuevo_(convId, nombre, redesNombreCanal_(canal), texto); } catch (e) { console.error('redes pushNuevo_: ' + e); }
  /* Apagado sin su llave: se guarda y se ve, pero Alma no lo contesta (no podría enviar). */
  if (!redesActivo_(canal)) return;
  hoja_(CFG.TAB_COLA).appendRow([new Date().toISOString(), s_(msg.mid), convId, '', nombre, texto.slice(0, 2000), 'pendiente', 0, '', '',
    JSON.stringify({ canal: canal, red: persona, categoria: 'reserva', actor: 'externo', huesped: nombre, propiedad: 'Sin reserva', fotos: media })]);
  var props = PropertiesService.getScriptProperties();
  props.setProperty('ALMA_ACTIVO', '1'); props.setProperty('ULTIMO_POST', String(Date.now()));
  programarPronto_(texto);
}
function redesMidGuardado_(mid) {
  var sh = ssAlma_().getSheetByName('ALMA_REDES'); if (!sh || sh.getLastRow() < 2 || !mid) return false;
  return !!sh.getRange(2, 7, sh.getLastRow() - 1, 1).createTextFinder(String(mid)).matchEntireCell(true).findNext();
}
/* Nombre y foto de perfil: una sola vez por persona (y nada si la red está apagada). */
function redesPerfil_(canal, persona) {
  var k = 'redperfil_' + canal + '_' + persona, g = vGet_(k);
  if (g) { try { return JSON.parse(g); } catch (e) {} }
  var L = redesLlave_(canal); if (!L) return { nombre: '', foto: '' };
  var out = { nombre: '', foto: '' };
  try {
    var campos = canal === 'instagram' ? 'name,username,profile_pic' : 'first_name,last_name,profile_pic';
    var r = uf_(L.base + '/' + encodeURIComponent(persona) + '?fields=' + campos, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + L.token } }, 'Huéspedes');
    if (r.getResponseCode() === 200) {
      var j = JSON.parse(r.getContentText() || '{}');
      out.nombre = s_(j.name) || [s_(j.first_name), s_(j.last_name)].filter(String).join(' ') || (j.username ? '@' + s_(j.username) : '');
      if (j.username && j.name) out.nombre += ' (@' + s_(j.username) + ')';
      out.foto = /^https:\/\//.test(s_(j.profile_pic)) ? s_(j.profile_pic) : '';
    } else console.error('redesPerfil_ ' + canal + ' HTTP ' + r.getResponseCode());
  } catch (e) { console.error('redesPerfil_: ' + e); }
  vSet_(k, JSON.stringify(out));   // también si vino vacío: no se vuelve a pedir en cada mensaje
  return out;
}

/* ── Hilo (lo lee hiloConv_ igual que waHilo_) ── */
function redesFilas_(convId) {
  var sh = ssAlma_().getSheetByName('ALMA_REDES'); if (!sh || sh.getLastRow() < 2) return [];
  var hits = sh.getRange(2, 8, sh.getLastRow() - 1, 1).createTextFinder(String(convId)).matchEntireCell(true).findAll();
  return hits.slice(-200).map(function (h) { return sh.getRange(h.getRow(), 1, 1, REDES_CAB_.length).getValues()[0]; });
}
function redesHilo_(convId) {
  var canal = redesCanalDe_(convId); if (!canal) return [];
  return redesFilas_(convId).map(function (v) {
    return { tipo: v[4] === 'in' ? 'guest' : 'host', auto: false, alma: s_(v[8]) === 'alma', texto: s_(v[5]), nombre: v[4] === 'in' ? s_(v[3]) : s_(v[8]),
      fotos: s_(v[9]).split(/\s+/).filter(function (u) { return /^https:/.test(u); }), created: v[0] instanceof Date ? v[0].toISOString() : s_(v[0]), canal: canal };
  });
}
/* Cuánto hace del último mensaje de la persona (ms) o null si nunca escribió. */
function redesDesdeUltimo_(convId) {
  var f = redesFilas_(convId).filter(function (v) { return v[4] === 'in'; }).pop(); if (!f) return null;
  var t = f[0] instanceof Date ? f[0].getTime() : Date.parse(f[0]); return isNaN(t) ? null : Date.now() - t;
}
/* Qué ve la bandeja en «Responder por»: si la ventana está abierta, solo para el equipo o cerrada. */
function redesVentana_(convId) {
  var canal = redesCanalDe_(convId), ms = redesDesdeUltimo_(convId);
  if (!redesActivo_(canal)) return { abierta: false, estado: 'apagado', texto: redesNombreCanal_(canal) + ' todavía no está conectado (falta su llave en Ajustes → Llaves)' };
  if (ms == null) return { abierta: false, estado: 'cerrada', texto: 'Meta no deja escribir primero: espera a que la persona escriba' };
  if (ms < REDES_VENTANA_MS_) return { abierta: true, estado: 'abierta', texto: 'Ventana abierta ' + Math.max(1, Math.round((REDES_VENTANA_MS_ - ms) / 3600000)) + ' h más' };
  if (ms < REDES_HUMANO_MS_) return { abierta: true, estado: 'humano', texto: 'Pasaron más de 24 h: sale como respuesta de una persona del equipo (hasta 7 días)' };
  return { abierta: false, estado: 'cerrada', texto: 'Pasaron más de 7 días: Meta ya no deja responder por aquí' };
}

/* ── Salida ── autor: 'alma' (la cola) o el nombre de quien escribe en el Hub. Devuelve { ok, code, error }. */
function redesEnviar_(convId, texto, autor) {
  var canal = redesCanalDe_(convId), persona = String(convId || '').slice(3);
  if (!canal || !persona) return { ok: false, code: 400, error: 'conversación de redes inválida' };
  var L = redesLlave_(canal); if (!L) return { ok: false, code: 412, error: redesNombreCanal_(canal) + ' todavía no está conectado: falta su llave en Ajustes → Llaves' };
  texto = acortarEnTexto_(String(texto || '').trim(), canal === 'instagram' ? 'instagram' : 'messenger');
  if (!texto) return { ok: false, code: 400, error: 'sin texto' };
  var ms = redesDesdeUltimo_(convId), esAlma = !autor || autor === 'alma';
  if (ms == null) return { ok: false, code: 409, error: 'Meta no deja escribir primero: la persona tiene que escribir antes' };
  var cuerpo = {};
  if (ms < REDES_VENTANA_MS_) cuerpo = { messaging_type: 'RESPONSE' };
  else if (ms < REDES_HUMANO_MS_ && !esAlma) cuerpo = { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' };
  else return { ok: false, code: 409, error: esAlma ? 'pasaron más de 24 h: solo una persona del equipo puede responder' : 'pasaron más de 7 días desde su último mensaje: Meta ya no deja responder por aquí' };
  var max = canal === 'instagram' ? 900 : 1900, partes = redesPartir_(texto, max), mids = [];
  for (var i = 0; i < partes.length; i++) {
    var r = uf_(L.base + '/me/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + L.token },
      payload: JSON.stringify(Object.assign({ recipient: { id: persona }, message: { text: partes[i] } }, cuerpo)) }, 'Huéspedes');
    var code = r.getResponseCode(), j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
    if (code >= 300) return { ok: false, code: code, error: (j.error && (j.error.error_user_msg || j.error.message)) || 'HTTP ' + code, salieron: i };
    mids.push(s_(j.message_id));
  }
  var ts = new Date().toISOString();
  hojaRedes_().appendRow([ts, canal, persona, '', 'out', celdaTexto_(texto.slice(0, 4000)), mids[0] || '', convId, esAlma ? 'alma' : String(autor).slice(0, 80), '']);
  try { inboxUpsert_(convId, { ultimo_texto: texto.slice(0, 300), ultimo_de: 'host', ultimo_ts: ts, ultimo_host_ts: ts, ultimo_canal: canal }); } catch (e) {}
  try { CacheService.getScriptCache().remove('hf_' + convId); } catch (e) {}
  return { ok: true, code: 200, humano: cuerpo.tag === 'HUMAN_AGENT' };
}
/* Meta corta los mensajes largos: se parten por párrafo o frase, nunca a media palabra. */
function redesPartir_(t, max) {
  var out = [], resto = String(t || '');
  while (resto.length > max) {
    var x = resto.slice(0, max), k = Math.max(x.lastIndexOf('\n'), x.lastIndexOf('. '), x.lastIndexOf(' '));
    if (k < max * 0.5) k = max;
    out.push(resto.slice(0, k + (resto.charAt(k) === '.' ? 1 : 0)).trim()); resto = resto.slice(k + (resto.charAt(k) === '.' ? 1 : 0)).trim();
  }
  if (resto) out.push(resto);
  return out;
}

/* ── El turno de Alma (procesarTurno_) ── */
/* El contexto de una conversación de redes: el de WhatsApp sin reserva, con su canal y sin número. */
function redesContexto_(ctx, resId) {
  var canal = redesCanalDe_(resId); if (!ctx || !canal) return ctx;
  var red = redesNombreCanal_(canal);
  ctx.canal = canal; ctx.wa = ''; ctx.actor = 'externo';
  ctx.estado = 'sin reserva · mensaje directo por ' + red + ' (ALMA sí responde: clasifica por el contenido)';
  ctx.momento = 'sin reserva: persona que escribe por ' + red + ' (posible huésped futuro)';
  if (!ctx.huesped || /^Contacto de WhatsApp$/.test(ctx.huesped)) ctx.huesped = red + ' · …' + String(resId).slice(-4);
  ctx.instrucciones = (ctx.instrucciones || '') + '\n· Este turno llegó por ' + red + ' (mensaje directo), no por WhatsApp. Responde como en un chat: breve, cálido, sin firma. ' +
    'Contesta tú lo público (precio, disponibilidad, zonas, cómo llegar, cómo reservar). Canjes, colaboraciones, descuentos, reembolsos o quejas los decide el equipo: di que lo consultas y no prometas nada.';
  return ctx;
}
/* ¿Canje, descuento o algo delicado por redes? Entonces no responde Alma: queda la decisión del equipo con A · B · C. */
function redesDelicado_(ctx) { return !!(ctx && redesCanalDe_(ctx.resId) && REDES_DELICADO_RE_.test(String(ctx.texto || ''))); }
