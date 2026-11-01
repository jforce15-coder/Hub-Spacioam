/* ═══ TEMAS POR RETOMAR ════════════════════════════════════════════════════════════════════════════════════
   Lo que Alma terminó en segundo plano y NECESITA algo de ti (una decisión, una respuesta, información que pediste) queda
   como «tema por retomar»: la app de iPhone te avisa con una notificación y, la próxima vez que hablas con Alma, ella
   empieza por el más importante. Si le dices «no te preocupes» y cambias de tema, el aviso no se borra: queda acumulado y
   en otra llamada se menciona otro (rota). Se cierra solo cuando en una llamada lo resuelven (lo revisa Alma al colgar) o a
   los 7 días. Lo que no necesita nada de ti (una confirmación de algo hecho) no avisa: queda en el chat.
   Guardado por administrador en la propiedad VOZ_RET_<hash>. */
var RET_MAX_ = 15, RET_DIAS_ = 7;

function retClave_(adm) {
  return 'VOZ_RET_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(adm.email).toLowerCase())).slice(0, 16);
}
function retLeer_(adm) {
  if (!adm || !adm.email) return [];
  var l = []; try { l = JSON.parse(PropertiesService.getScriptProperties().getProperty(retClave_(adm)) || '[]'); } catch (e) {}
  var corte = Date.now() - RET_DIAS_ * 86400000;
  return l.filter(function (x) { return x && x.ts >= corte; });
}
function retGuardar_(adm, l) {
  var p = PropertiesService.getScriptProperties();
  if (!l.length) p.deleteProperty(retClave_(adm)); else p.setProperty(retClave_(adm), JSON.stringify(l.slice(-RET_MAX_)));
}
function retCambiar_(adm, fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { var l = retLeer_(adm), r = fn(l); retGuardar_(adm, l); return r; } finally { lock.releaseLock(); }
}
/* o: { texto (lo que Alma dirá, 1 o 2 frases), tema (3 a 6 palabras, para invitar a verlo), detalle, importancia 1 a 3, origen } */
function retPoner_(adm, o) {
  if (!adm || !adm.email || !String(o.texto || '').trim()) return null;
  var it = { id: 'rt' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), ts: Date.now(), texto: String(o.texto).replace(/\s+/g, ' ').trim().slice(0, 300), tema: String(o.tema || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    detalle: String(o.detalle || '').replace(/\s+/g, ' ').trim().slice(0, 600), imp: Math.max(1, Math.min(3, Number(o.importancia) || 2)), veces: 0, ult: 0, origen: o.origen || '' };
  retCambiar_(adm, function (l) { l.push(it); });
  return it;
}
/* El orden en que se mencionan: primero el más importante; entre iguales, el que menos se ha mencionado y luego el más
   viejo. Así, si lo dejas pasar, la próxima vez sube otro y no se repite siempre el mismo. */
function retOrden_(l) {
  return l.slice().sort(function (a, b) { return (b.imp - a.imp) || (a.veces - b.veces) || (a.ts - b.ts); });
}
function retMencionado_(adm, id) {
  if (!id) return;
  retCambiar_(adm, function (l) { l.forEach(function (x) { if (x.id === id) { x.veces++; x.ult = Date.now(); } }); });
}
function retResolver_(adm, ids) {
  if (!ids || !ids.length) return;
  retCambiar_(adm, function (l) { for (var i = l.length - 1; i >= 0; i--) if (ids.indexOf(l[i].id) >= 0) l.splice(i, 1); });
  try { pendResolverRet_(ids); } catch (e) {}   // su tarjeta en Pendientes también (pendientes.js)
}

/* ¿Esto necesita algo de él? Lo decide el modelo rápido; ante la duda, sí (mejor avisar que perder algo). */
function retClasificar_(pedido, respuesta, fallo) {
  var out = { requiere: true, importancia: fallo ? 3 : 2, aviso: '' };
  try {
    var t = String(claude_(CFG.MODELO_CLASIFICADOR, 220,
      'Alma, la asistente de un administrador, terminó en segundo plano algo que él pidió en una llamada. Decide si el resultado NECESITA algo de él.\n' +
      'requiere = true si: tiene que decidir, elegir, aprobar, responder o hacer algo; le falta información o algo salió mal; o pidió información (opciones, datos, un resumen) que todavía no escuchó.\n' +
      'requiere = false si solo confirma algo que ya quedó hecho y no hay nada que decidir (p. ej. «listo, ya creé la tarea»).\n' +
      'importancia: 3 = urgente o con dinero, huéspedes o fechas cercanas en juego · 2 = normal · 1 = puede esperar.\n' +
      'aviso: cómo Alma se lo dice al retomar, 1 o 2 frases (máx. 30 palabras), en español, cálida y directa, sin enlaces; di qué quedó y qué necesitas de él.\n' +
      'tema: de qué se trata en 3 a 6 palabras, sin números (p. ej. «el vuelo a Lima», «la incidencia del 1104»).\n' +
      'Responde SOLO JSON: {"requiere":true|false,"importancia":1|2|3,"aviso":"…","tema":"…"}',
      'PEDIDO: ' + String(pedido || '').slice(0, 1500) + '\n\nRESULTADO: ' + String(respuesta || '').slice(0, 3000) + (fallo ? '\n\nOJO, FALLÓ: ' + fallo : ''), 0) || '');
    var j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    out.requiere = j.requiere !== false || !!fallo;
    out.importancia = Math.max(1, Math.min(3, Number(j.importancia) || out.importancia));
    out.aviso = String(j.aviso || '').trim(); out.tema = String(j.tema || '').trim();
  } catch (e) { console.error('retClasificar_: ' + e); }
  if (!out.aviso) out.aviso = vozAvisoCorto_(respuesta);
  return out;
}

/* Para la ficha de la llamada. Los pendientes se ofrecen con suavidad: el saludo invita a verlos y nombra solo UNO (el más
   importante que no se ofreció en las últimas RET_PAUSA_H_ horas), sin contar cuántos hay ni leer datos. Si ya se ofreció
   hace poco, el saludo es el normal y Alma solo lo ofrece si encuentra una pausa natural. */
var RET_PAUSA_H_ = 2;
function retTema_(x) {
  var t = String(x.tema || '').trim();
  if (!t) { t = String(x.texto || '').split(/[:.;!?]|—| - /)[0].trim(); if (t.split(/\s+/).length > 8) t = t.split(/\s+/).slice(0, 8).join(' ') + '…'; }
  return t.charAt(0).toLowerCase() + t.slice(1);
}
function retFicha_(adm, nom) {
  var l = retOrden_(retLeer_(adm)); if (!l.length) return null;
  var corte = Date.now() - RET_PAUSA_H_ * 3600000, top = l.filter(function (x) { return !x.ult || x.ult < corte; })[0] || null;
  var saludo = top ? '¡Hola, ' + nom + '! Aquí estoy. Cuando quieras vemos tus pendientes; el más importante es ' + retTema_(top) + '. ¿Lo retomamos?' : '';
  var bloque = '\n\nPENDIENTES POR RETOMAR (lo que trabajaste en segundo plano y necesita algo de él; el más importante primero). CÓMO TRATARLOS: con suavidad, nunca de golpe. ' +
    (top ? 'Ya lo invitaste en el saludo a ver «' + retTema_(top) + '». Si dice que sí, cuéntaselo en 1 o 2 frases sencillas y pregúntale lo que necesitas. '
         : 'Ya se los ofreciste hace poco: NO empieces por ahí. Solo si hay una pausa natural, pregúntale una vez «¿quieres que veamos los pendientes?». ') +
    'Si dice «luego», «no te preocupes» o cambia de tema, síguelo sin insistir: queda guardado. Nunca leas la lista, ni cuántos hay, ni números sueltos; ' +
    'si pregunta qué más hay, nombra el siguiente (solo su tema) y pregunta si lo ven.\n' +
    l.map(function (x, i) { return (i + 1) + ') ' + retTema_(x) + ': ' + x.texto + (x.detalle ? ' — detalle: ' + x.detalle.slice(0, 300) : '') + ' (hace ' + retHace_(x.ts) + ')'; }).join('\n');
  return { id: top ? top.id : '', total: l.length, saludo: saludo, bloque: bloque };
}
function retHace_(ts) {
  var m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' días';
}

/* Al colgar: ¿qué temas quedaron resueltos en la llamada? Solo los que de verdad atendió (decidió, respondió, lo vio).
   «No te preocupes» o cambiar de tema NO lo resuelve: queda acumulado. */
function retDespuesLlamada_(adm, transcript) {
  var l = retLeer_(adm); if (!l.length) return;
  var txt = (transcript || []).map(function (m) { return (m.role === 'agent' ? 'Alma' : 'Él') + ': ' + vozSinNotas_(s_(m.message)); }).filter(function (x) { return x.length > 6; }).join('\n').slice(-6000);
  if (!txt) return;
  try {
    var t = String(claude_(CFG.MODELO_CLASIFICADOR, 200,
      'Tienes una lista de temas pendientes y la transcripción de una llamada. Devuelve los id de los temas que quedaron RESUELTOS en la llamada: él decidió, respondió, eligió, dio lo que faltaba, o dijo que ya no hace falta para nada. ' +
      'NO cuentan como resueltos: «no te preocupes», «luego lo vemos», «después» o simplemente cambiar de tema. Responde SOLO JSON: {"resueltos":["id",…]}',
      'TEMAS:\n' + l.map(function (x) { return x.id + ': ' + x.texto; }).join('\n') + '\n\nLLAMADA:\n' + txt, 0) || '');
    var j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    var ids = (j.resueltos || []).map(String).filter(function (id) { return l.some(function (x) { return x.id === id; }); });
    retResolver_(adm, ids);
  } catch (e) { console.error('retDespuesLlamada_: ' + e); }
}

/* ═══ TOLERANCIA EN LA LLAMADA ═════════════════════════════════════════════════════════════════════════════
   Si un pedido por voz tarda más de VOZ_TOLERANCIA_S segundos (por defecto 20), la llamada deja de esperar: la secretaria
   guarda dónde iba (conversación completa con sus herramientas, en caché) y lo termina en segundo plano. Alma te dice que
   lo trabaja por detrás y cuelga; el resultado llega como tema por retomar (y notificación) si necesita algo de ti. */
function vozTolerancia_() { var n = Number(PropertiesService.getScriptProperties().getProperty('VOZ_TOLERANCIA_S')); return (n >= 8 && n <= 50 ? n : 20) * 1000; }

function vozSeguirGuardar_(o) {
  var id = 'sg' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), s = JSON.stringify(o), c = CacheService.getScriptCache(), partes = {}, n = 0;
  for (var i = 0; i < s.length; i += 90000) partes[id + '_' + (n++)] = s.slice(i, i + 90000);
  partes[id] = String(n);
  c.putAll(partes, 21600);
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var p = PropertiesService.getScriptProperties(), cola = []; try { cola = JSON.parse(p.getProperty('VOZ_SEGUIR') || '[]'); } catch (e) {}
    cola.push({ id: id, email: o.email, t: Date.now() }); p.setProperty('VOZ_SEGUIR', JSON.stringify(cola.slice(-10)));
  } finally { lock.releaseLock(); }
  try {
    ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'vozSeguirPronto'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('vozSeguirPronto').timeBased().after(5000).create();
  } catch (e) { console.error('trigger vozSeguirPronto: ' + e); }
  return id;
}
function vozSeguirLeer_(id) {
  var c = CacheService.getScriptCache(), n = Number(c.get(id) || 0); if (!n) return null;
  var ks = []; for (var i = 0; i < n; i++) ks.push(id + '_' + i);
  var v = c.getAll(ks), s = ks.map(function (k) { return v[k] || ''; }).join('');
  c.removeAll(ks.concat([id]));
  try { return JSON.parse(s); } catch (e) { return null; }
}
/* Pedidos que la llamada dejó a medias: se terminan aquí, uno por uno (nunca se repiten: se sacan antes de seguir). */
function vozSeguirPronto() {
  cupoCanal_('Voz');
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'vozSeguirPronto'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var p = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock();
  for (var n = 0; n < 4; n++) {
    var it = null;
    if (!lock.tryLock(5000)) return;
    try {
      var cola = []; try { cola = JSON.parse(p.getProperty('VOZ_SEGUIR') || '[]'); } catch (e) {}
      it = cola.shift(); p.setProperty('VOZ_SEGUIR', JSON.stringify(cola));
    } finally { lock.releaseLock(); }
    if (!it) return;
    var o = vozSeguirLeer_(it.id), adm = o && adminsOp_().filter(function (a) { return a.email === o.email; })[0];
    if (!adm) continue;
    var r;
    try {
      AGENTE_APP_ = !!o.app;
      var tools = agHerramientas_().filter(function (t) { return AGENTE_APP_ || AG_SOLO_APP_.indexOf(t.name) < 0; });
      r = opAgenteBucle_(adm, o.system + vozSeguirCanal_(), o.msgs, tools, { hechas: o.hechas || [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } }, 0, true);
      AGENTE_APP_ = false;
      opGuardar_(adm, 'alma', 'llamada', r.respuesta, r.hechas, { esfera: r.esfera, subcategoria: r.subcategoria });   // la esfera del turno (chat.js)
    } catch (e) { AGENTE_APP_ = false; r = { respuesta: 'No pude terminar lo que me pediste en la llamada: ' + String(e).slice(0, 150) + '. ¿Lo intentamos de nuevo?', hechas: [] }; }
    try { vozSecAvisar_(normTel_(adm.tels[0]), adm, r, o.pedido); } catch (e) { console.error('vozSecAvisar_: ' + e); }
  }
}
function vozSeguirCanal_() {
  return '\n\nCAMBIO DE CANAL: la llamada ya terminó (tardaba demasiado y le dijiste que lo seguías por detrás). Termina el pedido y escribe tu respuesta final completa y ordenada (líneas con ·): le llega tal cual a él por escrito. ' +
    'Si te pidió que le mandes información, tu respuesta ES ese envío: no uses herramientas para escribirle. Si algo no se pudo, dilo claro.';
}
