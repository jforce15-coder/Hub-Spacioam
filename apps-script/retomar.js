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
    detalle: String(o.detalle || '').replace(/\s+/g, ' ').trim().slice(0, 600), imp: Math.max(1, Math.min(3, Number(o.importancia) || 2)), veces: 0, ult: 0, origen: o.origen || '', ref: String(o.ref || '') };
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
      'aviso: cómo Alma se lo cuenta en una conversación, 1 o 2 frases simples (máx. 30 palabras): primero qué quedó y luego qué necesitas de él, con el dato clave (nombre, cifra o fecha); sin enlaces, teléfonos, correos ni códigos.\n' +
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

/* ── Para la ficha de la llamada: solo lo que importa (#607; Juan, 16-nov-2026: «Alma me está preguntando siempre por los
   pendientes, demasiado insistentemente, y muchas veces me está dando pendientes que ya no tienen ninguna relevancia»).
   Medido el 15 y 16-nov: 13 de 44 llamadas empezaron con «Cuando quieras vemos tus pendientes…», casi nunca con algo
   urgente (errores viejos, cambios ya unidos, un «no entregado» repetido, algo ya descartado).
   · Alma NO ofrece pendientes en el saludo ni insiste: el saludo es el normal.
   · URGENTE (retUrgente_): importancia 3 (urgente, dinero, huéspedes o fechas cercanas: retClasificar_), de las últimas
     RET_URGENTE_H_ horas, nunca de desarrollo y ofrecido en menos de RET_VOZ_VECES_ llamadas. Solo ese se menciona, UNA vez
     en la llamada; si lo deja pasar en RET_VOZ_VECES_ llamadas, ya no es urgente (sigue en Pendientes).
   · Lo demás, solo si él pregunta. Antes de llegar a la ficha se quita lo que ya no aplica (retVigente_, sin IA): lo de
     desarrollo cuyo cambio ya se unió o se cerró (lo quita microGuardar_ con retQuitarRef_) o de hace más de RET_CLAUDE_H_,
     el repetido del mismo cambio (vale el más nuevo) y lo que no es urgente de hace más de RET_VOZ_DIAS_ días.
     Lo que se cierra en Pendientes ya sale solo (pendCerrarCon_, pendResolver_). Check: .github/pendientes-voz.js. */
var RET_URGENTE_H_ = 24, RET_VOZ_VECES_ = 2, RET_VOZ_DIAS_ = 3, RET_CLAUDE_H_ = 48, RET_FICHA_MAX_ = 3;
function retTema_(x) {
  var t = String(x.tema || '').trim();
  if (!t) { t = String(x.texto || '').split(/[:.;!?]|—| - /)[0].trim(); if (t.split(/\s+/).length > 8) t = t.split(/\s+/).slice(0, 8).join(' ') + '…'; }
  return t.charAt(0).toLowerCase() + t.slice(1);
}
function retUrgente_(x, ahora) {
  return Number(x.imp) >= 3 && x.origen !== 'claude' && ahora - Number(x.ts || 0) < RET_URGENTE_H_ * 3600000 && (Number(x.veces) || 0) < RET_VOZ_VECES_;
}
/* '' = sigue vigente para la voz; si no, por qué no llega a la ficha. vistos: refs de desarrollo ya vistas (el más nuevo gana). */
function retVigente_(x, ahora, vistos) {
  var h = (ahora - Number(x.ts || 0)) / 3600000;
  if (x.origen === 'claude') {
    if (h >= RET_CLAUDE_H_) return 'de desarrollo, de hace más de ' + RET_CLAUDE_H_ + ' h (está en Pendientes)';
    if (x.ref && vistos[x.ref]) return 'repetido: hay uno más nuevo del mismo cambio';
    if (x.ref) vistos[x.ref] = 1;
  }
  if (Number(x.imp) < 3 && h >= RET_VOZ_DIAS_ * 24) return 'de hace más de ' + RET_VOZ_DIAS_ + ' días y no es urgente';
  return '';
}
/* l: la lista guardada. → { urgente, lista (vigentes; el urgente primero), fuera: [{ id, motivo }] } */
function retVoz_(l, ahora) {
  var vistos = {}, fuera = [], vig = (l || []).slice().sort(function (a, b) { return b.ts - a.ts; }).filter(function (x) {
    var m = retVigente_(x, ahora, vistos); if (m) fuera.push({ id: x.id, motivo: m }); return !m;
  });
  vig = retOrden_(vig);
  var urg = vig.filter(function (x) { return retUrgente_(x, ahora); })[0] || null;
  if (urg) vig = [urg].concat(vig.filter(function (x) { return x !== urg; }));
  return { urgente: urg, lista: vig, fuera: fuera };
}
function retFicha_(adm, nom) {
  var v = retVoz_(retLeer_(adm), Date.now()), l = v.lista, u = v.urgente; if (!l.length) return null;
  var bloque = '\n\nPENDIENTES (él quiere una plática directa: NO los ofrezcas en el saludo ni insistas). ' +
    (u ? 'UNO ES URGENTE, el 1): menciónalo UNA sola vez en toda la llamada, en una frase y con su dato clave, después de atender lo primero que pida (o enseguida si solo saluda). Si dice «luego», «no te preocupes» o cambia de tema, no lo vuelvas a sacar. '
       : 'Ninguno es urgente: no los menciones. ') +
    'Los demás, SOLO si él pregunta por pendientes: nombra uno (su tema) y pregunta si lo ven; nunca leas la lista ni cuántos hay.\n' +
    l.slice(0, RET_FICHA_MAX_).map(function (x, i) { return (i + 1) + ') ' + retTema_(x) + ': ' + String(x.texto || '').replace(/\s+/g, ' ').slice(0, 140) + ' (hace ' + retHace_(x.ts) + ')'; }).join('\n') +
    (l.length > RET_FICHA_MAX_ ? '\n(y ' + (l.length - RET_FICHA_MAX_) + ' más en Pendientes)' : '');
  return { id: u ? u.id : '', total: l.length, saludo: '', bloque: bloque };
}
/* Un cambio de desarrollo se unió o se cerró (microGuardar_): su tema por retomar ya no hace falta. Sin el candado si no hay. */
function retQuitarRef_(ref) {
  ref = String(ref || ''); if (!ref) return 0;
  var jefe = adminsOp_().filter(function (a) { return a.principal; })[0]; if (!jefe) return 0;
  if (!retLeer_(jefe).some(function (x) { return String(x.ref || '') === ref; })) return 0;
  return retCambiar_(jefe, function (l) { var n = 0; for (var i = l.length - 1; i >= 0; i--) if (String(l[i].ref || '') === ref) { l.splice(i, 1); n++; } return n; });
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

/* El candado de las colas de la llamada (VOZ_SEGUIR aquí y VOZ_SEC_COLA en voz.js): el del usuario, no el del script.
   El del script lo tiene procesarCola durante toda su pasada (las respuestas a huéspedes con Claude y hasta 40 s de espera
   para un envío). El 2-nov a las 18:39 la llamada no lo consiguió en 5 s, la secretaria se cayó («error interno») y el
   mensaje a la huésped no salió al primer intento. Todo corre como Juan (webapp USER_DEPLOYING y disparadores), así que
   el del usuario protege lo mismo sin esperar a los huéspedes. */
function vozColaLock_() { try { var l = LockService.getUserLock(); if (l) return l; } catch (e) {} return LockService.getScriptLock(); }
function vozSeguirGuardar_(o) {
  try { o.orb = orbitaId_(); } catch (e) {}   // su anillo en el inicio (orbita.js): se anota cuando ya quedó en la cola
  /* Su tema (#583 T2.4): el del turno que se corta (si el turno abría uno, se crea ya). Al terminar se le suma lo que salió. */
  if (!o.tema) { try { o.tema = temaActualId_({ email: o.email }) || ''; } catch (e) { console.error('temaActualId_: ' + e); } }
  var id = 'sg' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), s = JSON.stringify(o), c = CacheService.getScriptCache(), partes = {}, n = 0;
  for (var i = 0; i < s.length; i += 90000) partes[id + '_' + (n++)] = s.slice(i, i + 90000);
  partes[id] = String(n);
  c.putAll(partes, 21600);
  var lock = vozColaLock_(); lock.waitLock(10000);
  try {
    var p = PropertiesService.getScriptProperties(), cola = []; try { cola = JSON.parse(p.getProperty('VOZ_SEGUIR') || '[]'); } catch (e) {}
    cola.push({ id: id, email: o.email, t: Date.now() }); p.setProperty('VOZ_SEGUIR', JSON.stringify(cola.slice(-10)));
  } finally { lock.releaseLock(); }
  try { orbitaEmpieza_(o.email, o.pedido, 'segundo_plano', '', o.orb, o.tema); } catch (e) { console.error('orbitaEmpieza_: ' + e); }
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
  var p = PropertiesService.getScriptProperties(), lock = vozColaLock_();
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
    /* Esta ejecución es nueva (un disparador): sin AGENTE_CANAL_ = 'segundo_plano' el bucle no dejaba el resultado en
       Pendientes, y al principal vozSecAvisar_ no le avisa por otro lado: lo que la llamada pasó a segundo plano terminaba
       sin tarjeta, sin notificación y sin la notificación hablada del modo conferencia (Juan, 3-nov-2026). */
    AGENTE_CANAL_ = 'segundo_plano'; AGENTE_TEXTO_ = String(o.pedido || ''); AGENTE_PEDIDO_ = String(o.pedido || ''); AGENTE_CONF_ = !!o.conf;
    ORBITA_ACTUAL_ = o.orb ? { email: adm.email, ids: [o.orb] } : null;   // el paso de cada herramienta va a su anillo (orbita.js)
    try {
      AGENTE_APP_ = !!o.app;
      var tools = agHerramientas_().filter(function (t) { return AGENTE_APP_ || AG_SOLO_APP_.indexOf(t.name) < 0; });
      r = opAgenteBucle_(adm, o.system + vozSeguirCanal_(), o.msgs, tools, { hechas: o.hechas || [], parcial: o.parcial || null, _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } }, 0, true);
      AGENTE_APP_ = false;
      opGuardar_(adm, 'alma', 'llamada', r.respuesta, r.hechas, { esfera: r.esfera, subcategoria: r.subcategoria, tema: o.tema || '' });   // la esfera del turno (chat.js) y su tema
    } catch (e) { AGENTE_APP_ = false; r = { respuesta: 'No pude terminar lo que me pediste en la llamada: ' + String(e).slice(0, 150) + '. ¿Lo intentamos de nuevo?', hechas: [], fallo: String(e).slice(0, 150) }; }
    finally { AGENTE_CANAL_ = ''; AGENTE_TEXTO_ = ''; AGENTE_PEDIDO_ = ''; AGENTE_CONF_ = false; ORBITA_ACTUAL_ = null; }
    try { orbitaTermina_(adm.email, [o.orb], r.fallo, r); } catch (e) { console.error('orbitaTermina_: ' + e); }
    if (o.tema) { try { temaSumarResultado_(adm, o.tema, r); } catch (e) { console.error('temaSumarResultado_: ' + e); } }   // el hilo dice que ya salió (temas.js, #583)
    try { vozSecAvisar_(normTel_(adm.tels[0]), adm, r, o.pedido, [o.orb]); } catch (e) { console.error('vozSecAvisar_: ' + e); }
    try { pendProcesar_(); } catch (e) { console.error('pendProcesar_: ' + e); }   // la tarjeta y su aviso ya, sin esperar al minuto de procesarCola
  }
}
function vozSeguirCanal_() {
  return '\n\nCAMBIO DE CANAL: la llamada ya terminó (tardaba demasiado y le dijiste que lo seguías por detrás). Termina el pedido y escribe tu respuesta final completa y ordenada (líneas con ·): le llega tal cual a él por escrito. ' +
    'Si te pidió que le mandes información, tu respuesta ES ese envío: no uses herramientas para escribirle. Si algo no se pudo, dilo claro.';
}
