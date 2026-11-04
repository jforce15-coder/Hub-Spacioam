/* ═══ RELEVO DE CONTACTO ══════════════════════════════════════════════════════════════════════════════════
   Cuando alguien a quien Alma le escribió de parte de un administrador contesta, Alma se lo pasa («Gustavo Peña
   respondió: … (Dime qué le contesto y se lo escribo.)»). Eso es un relevo de contacto (glosario).
   El 4-nov Juan respondió CITANDO ese relevo («pregúntale cuáles tiene en mente como siguientes pasos…») y Alma le
   preguntó «¿Es para Inés Flores (Amalfi)?», luego «No tengo ficha ni proyecto de Gustavo Peña» y le pidió el número:
   · el relevo salía por WhatsApp sin guardar su id, así que la cita no decía nada (waCitado_ no lo encontraba);
   · buscar_contacto solo mira ALMA_CONTACTOS, y a un contacto personal (WA_RELAY) nunca se le hace ficha;
   · la lista «LO QUE PEDISTE Y SIGUE ABIERTO» solo tenía a Inés (aún sin responder) y el pedido decía «seguimiento».
   Ahora:
   · cada relevo guarda el id de su WhatsApp con la persona (número, nombre y lo que se le pidió) en WA_RELEVOS y en
     ALMA_WHATSAPP (conv relevo:<número>), 30 días;
   · si el administrador lo cita, Alma recibe el bloque «RESPUESTA CITADA» con esa persona y su conversación: lo que diga
     es para ella y se lo escribe sin preguntar (el relevo ya decía «dime qué le contesto»: su instrucción es el sí);
   · sin cita, los relevos de las últimas horas que nadie atendió van como candidatos, para no adivinar con otro pendiente;
   · contactoRecientes_ encuentra por nombre a quien Alma le escribió o le contestó en 30 días (ALMA_WHATSAPP, WA_RELAY,
     ALMA_ENCARGOS), con su número, sus últimos mensajes y lo que se le pidió: nunca hace falta pedir el número. */

var RELEVO_DIAS_ = 30, RELEVO_MAX_ = 150, RELEVO_HORAS_PEND_ = 6;

function relevoMapa_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELEVOS') || '{}') || {}; } catch (e) { return {}; } }
function relevoGuardarMapa_(m) {
  var lim = Date.now() - RELEVO_DIAS_ * 86400000, ks = Object.keys(m).filter(function (k) { return m[k] && m[k].ts > lim; }).sort(function (a, b) { return m[a].ts - m[b].ts; }).slice(-RELEVO_MAX_), out = {};
  ks.forEach(function (k) { out[k] = m[k]; });
  PropertiesService.getScriptProperties().setProperty('WA_RELEVOS', JSON.stringify(out));
}
/* Lo que se le pidió a la persona: el objetivo del encargo o, si no hay, el primer mensaje que Alma le mandó. */
function relevoPedido_(rel) {
  if (!rel) return '';
  if (rel.objetivo) return String(rel.objetivo).slice(0, 400);
  var prim = (rel.h || []).filter(function (x) { return x.q === 'alma'; })[0];
  return String((prim && prim.t) || rel.ctx || '').slice(0, 400);
}
/* El relevo salió (msgId = el id que devolvió Meta): queda el vínculo mensaje → persona. */
function relevoGuardar_(msgId, dest, o) {
  msgId = String(msgId || ''); o = o || {}; var wa = normTel_(o.wa || ''); if (!msgId || !wa) return false;
  var m = relevoMapa_();
  m[msgId] = { wa: wa, nombre: String(o.nombre || '+' + wa).slice(0, 80), dest: fin8_(dest), pedido: String(o.pedido || '').slice(0, 400), tipo: o.tipo === 'encargo' ? 'encargo' : 'personal', ts: Date.now(), at: 0 };
  relevoGuardarMapa_(m);
  /* En la hoja con su id: así waCitado_ sabe qué se citó y el historial lo muestra. */
  try { hojaWA_().appendRow([new Date().toISOString(), normTel_(dest), '', 'out', celdaTexto_(String(o.texto || '').slice(0, 4000)), msgId, 'relevo:' + wa, 'text', 'relevo', '']); } catch (e) {}
  return true;
}
function relevoCitado_(msgId) { var e = msgId ? relevoMapa_()[String(msgId)] : null; return e ? Object.assign({ msg: String(msgId) }, e) : null; }
/* Ya se le contestó a esa persona (el administrador citó su relevo o Alma le escribió): deja de ser candidato. */
function relevoAtender_(wa) {
  var k = fin8_(wa); if (!k) return; var m = relevoMapa_(), cambio = false;
  Object.keys(m).forEach(function (id) { if (fin8_(m[id].wa) === k && !m[id].at) { m[id].at = Date.now(); cambio = true; } });
  if (cambio) relevoGuardarMapa_(m);
}
/* Relevos a este administrador de las últimas horas que nadie atendió, uno por persona, el más nuevo primero. */
function relevoPendientes_(dest, horas) {
  var m = relevoMapa_(), lim = Date.now() - (horas || RELEVO_HORAS_PEND_) * 3600000, k = fin8_(dest), vistos = {};
  return Object.keys(m).map(function (id) { return Object.assign({ msg: id }, m[id]); })
    .filter(function (e) { return e.dest === k && !e.at && e.ts > lim; }).sort(function (a, b) { return b.ts - a.ts; })
    .filter(function (e) { var w = fin8_(e.wa); if (vistos[w]) return false; vistos[w] = 1; return true; });
}

/* Los últimos mensajes de WhatsApp con un número (lo que Alma le mandó y lo que contestó), del más viejo al más nuevo. */
function relevoConversacion_(wa, n, nombre) {
  var k = fin8_(wa); if (!k) return [];
  try {
    var sh = hojaWA_(), last = sh.getLastRow(); if (last < 2) return [];
    var desde = Math.max(2, last - 2999), v = sh.getRange(desde, 1, last - desde + 1, 9).getValues();
    return v.filter(function (r) { return fin8_(r[1]) === k && !/^(op|relevo|dec):/.test(String(r[6])); }).slice(-(n || 8)).map(function (r) {
      var ts = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
      return ts.slice(0, 16).replace('T', ' ') + ' · ' + (r[3] === 'in' ? String(nombre || r[2] || 'CONTACTO').toUpperCase() : 'ALMA') + ': ' + String(r[4] || '').replace(/^\[plantilla[^\]]*\]\s*·\s*pendiente:\s*/, '[aviso de primer contacto] ').replace(/\s+/g, ' ').slice(0, 300);
    });
  } catch (e) { console.error('relevoConversacion_: ' + e); return []; }
}

/* Para Alma: el administrador citó el relevo de esta persona. */
function relevoNota_(e) {
  if (!e || !e.wa) return '';
  var herr = e.tipo === 'encargo' ? 'escribir_a_equipo' : 'mensaje_personal', conv = relevoConversacion_(e.wa, 8, e.nombre);
  return '(RESPUESTA CITADA: el administrador contesta al relevo de ' + e.nombre + ' (+' + normTel_(e.wa) + (e.pedido ? '; lo que se le pidió: «' + e.pedido + '»' : '') + '). ' +
    'Lo que dice este mensaje es para ' + e.nombre + ', no para otra persona ni para otro pendiente. Si es una instrucción o una respuesta para él o ella, escríbele ya con ' + herr +
    ' (persona «' + e.nombre + '», numero +' + normTel_(e.wa) + '), con la conversación de abajo como contexto, y confirma una vez, ya enviado. ' +
    'El relevo decía «Dime qué le contesto y se lo escribo»: su instrucción ya es el sí. No preguntes a quién va ni pidas el número.' +
    (conv.length ? '\nCONVERSACIÓN CON ' + String(e.nombre).toUpperCase() + ':\n' + conv.join('\n') : '') + ')';
}
/* Sin cita: los relevos que esperan su indicación, para que «pregúntale…» no se adivine con otro pendiente. '' si no hay. */
function relevoNotaPendientes_(dest) {
  var L = []; try { L = relevoPendientes_(dest); } catch (e) {}
  if (!L.length) return '';
  var f = function (t) { try { return Utilities.formatDate(new Date(t), CFG.TZ, 'HH:mm'); } catch (e) { return ''; } };
  return '(RESPUESTAS QUE ESPERAN TU INDICACIÓN (relevos de contacto): ' + L.slice(0, 3).map(function (e) { return e.nombre + ' (+' + normTel_(e.wa) + ', ' + f(e.ts) + (e.pedido ? '; se le pidió: «' + e.pedido.slice(0, 160) + '»' : '') + ')'; }).join(' · ') +
    '. Si el mensaje no nombra a nadie y habla de «él», «ella» o «su…», es para una de estas personas, no para LO QUE PEDISTE Y SIGUE ABIERTO: con una sola, es esa; con varias, pregunta nombrando estas.)';
}

/* ── Quién es «Gustavo Peña»: las personas a quien Alma le escribió o que le contestaron en los últimos días ── */
function relevoNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function relevoCoincide_(q, nombre) {
  var a = relevoNorm_(q), b = relevoNorm_(nombre); if (!a || !b || /^\+?\d+$/.test(b.replace(/ /g, ''))) return false;
  var ws = a.split(' ').filter(function (w) { return w.length > 2; }); if (!ws.length) return false;
  var bw = b.split(' ');
  return ws.every(function (w) { return bw.indexOf(w) >= 0; }) || (b.length > 3 && (' ' + a + ' ').indexOf(' ' + b + ' ') >= 0);
}
function contactoRecientes_(texto, dias) {
  var q = String(texto || '').trim(); if (!q) return [];
  var lim = Date.now() - (dias || RELEVO_DIAS_) * 86400000, gente = {};
  var esAdm = function (w) { try { return !!adminPorTel_(w) || fin8_(CFG.WHATSAPP_JUAN) === fin8_(w); } catch (e) { return false; } };
  var add = function (wa, nombre, origen, pedido) {
    var k = fin8_(wa); if (!k || esAdm(wa)) return;
    var g = gente[k] = gente[k] || { wa: normTel_(wa), nombres: [], origen: [], pedido: '' };
    if (nombre && g.nombres.indexOf(String(nombre)) < 0) g.nombres.push(String(nombre));
    if (origen && g.origen.indexOf(origen) < 0) g.origen.push(origen);
    if (pedido && !g.pedido) g.pedido = String(pedido).slice(0, 400);
  };
  try {   // WhatsApp: lo que Alma le mandó (el nombre que le pusimos) y lo que contestó (su perfil)
    var sh = hojaWA_(), last = sh.getLastRow();
    if (last >= 2) { var desde = Math.max(2, last - 2999); sh.getRange(desde, 1, last - desde + 1, 9).getValues().forEach(function (r) {
      var t = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]); if (!(t > lim) || /^(op|relevo|dec):/.test(String(r[6]))) return;
      if (/^(operativo|operativo_pend|decision|relevo|sistema)$/.test(String(r[8]))) return;
      add(r[1], r[2], 'whatsapp');
    }); }
  } catch (e) { console.error('contactoRecientes_ wa: ' + e); }
  try { var rl = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}'); Object.keys(rl).forEach(function (k) { var r = rl[k]; if (r && r.wa) add(r.wa, r.nombre, 'personal', relevoPedido_(r)); }); } catch (e) {}
  try { var se = hojaEnc_(), ne = se.getLastRow(); if (ne >= 2) se.getRange(2, 1, ne - 1, ENC_CAB_.length).getValues().forEach(function (r) { var t = r[1] instanceof Date ? r[1].getTime() : Date.parse(r[1]); if (t > lim) add(r[5], r[4], 'encargo', r[6]); }); } catch (e) {}
  try { var rm = relevoMapa_(); Object.keys(rm).forEach(function (id) { add(rm[id].wa, rm[id].nombre, 'relevo', rm[id].pedido); }); } catch (e) {}
  return Object.keys(gente).map(function (k) { return gente[k]; }).filter(function (g) { return g.nombres.some(function (n) { return relevoCoincide_(q, n); }); }).slice(0, 3).map(function (g) {
    var nom = g.nombres.filter(function (n) { return relevoCoincide_(q, n); })[0] || g.nombres[0];
    return { nombre: nom, numero: '+' + g.wa, origen: g.origen.join(', '), encargo: g.pedido || undefined, ultimos_mensajes: relevoConversacion_(g.wa, 6, nom) };
  });
}
/* El número de alguien por su nombre, si Alma ya habló con esa persona en 30 días y solo hay una que coincide. */
function relevoNumeroDe_(persona) {
  var L = contactoRecientes_(persona, RELEVO_DIAS_);
  return L.length === 1 ? { wa: normTel_(L[0].numero), nombre: L[0].nombre } : null;
}
