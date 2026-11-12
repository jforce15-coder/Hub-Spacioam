/* ═══ INSTRUCCIÓN A ALMA: de una sesión de Claude a Alma (Juan, 12-nov-2026) ═══════════════════════════════════
   «¿No le puedes pedir tú a Alma desde acá? Si no es posible, busquemos la forma para que tú le puedas mandar esa
   instrucción a Alma.» Caso de ese día: programar a las 9:00 un WhatsApp de prueba a Recepción Brunelo.
   Cómo funciona:
   · Claude (la sesión de desarrollo de Juan, con su cuenta de GitHub) abre un issue en jforce15-coder/Hub-Spacioam con
     la etiqueta «para-alma» y en el cuerpo un bloque JSON:
       { "instruccion": "lo que Juan diría, en español simple", "responder_a": "whatsapp" | "chat", "hasta": "ISO opcional" }
   · Cada 2 min (procesarCola, paraAlmaRevisar_) el Hub lee los issues abiertos con esa etiqueta. Solo ejecuta los que abrió
     el dueño del repo y que nadie más editó (el repo es público: cualquiera puede abrir un issue). Si no, lo dice en el
     issue y lo cierra sin hacer nada.
   · Alma lo hace con sus herramientas como si se lo pidiera Juan (administrador principal), sin pedirle otra confirmación:
     él ya lo pidió por esta vía. Lo que el código exige con el sí de Juan en un mensaje nuevo (mensaje a un huésped,
     correo a un tercero) sigue quedando en borrador. No escala a Desarrollo (sería pedirle a Claude lo que Claude le pidió).
   · Responde en el issue (qué hizo, con los ids de lo programado) y lo cierra; con «whatsapp», además le avisa a Juan en una
     frase. El issue es público: la respuesta sale sin teléfonos, correos ni códigos (paraAlmaPublico_).
   · Una sola ejecución por issue: la marca va en la propiedad PARA_ALMA_ESTADO ANTES de llamar a la IA (dos pasadas de
     procesarCola pueden correr a la vez). Si falla, comenta el error real y deja el issue abierto con «para-alma-error»;
     nunca se reintenta solo. Sin «hasta», vence a las 24 h de abierto (un issue viejo no manda nada a nadie). */

var PARA_ALMA_REPO_ = 'jforce15-coder/Hub-Spacioam', PARA_ALMA_DUENO_ = 'jforce15-coder';
var PARA_ALMA_ETIQUETA_ = 'para-alma', PARA_ALMA_ERROR_ = 'para-alma-error', PARA_ALMA_PROP_ = 'PARA_ALMA_ESTADO';
var PARA_ALMA_CANAL_ = 'instruccion';                 // el canal de la fila en el chat de Juan (no es «claude»: ese es el de las respuestas de Claude)
var PARA_ALMA_VIGENCIA_ = 24 * 3600000;               // sin «hasta»: no se ejecuta después de 24 h de abierto
var PARA_ALMA_CORTADA_ = 15 * 60000;                  // «ejecutando» por más de 15 min: la ejecución se cortó
var PARA_ALMA_TOPE_ = 150000;                         // no empieza una instrucción si la pasada ya lleva 2,5 min (el límite es 6)
var PARA_ALMA_NOTA_ = 'INSTRUCCIÓN DE JUAN A TRAVÉS DE CLAUDE (su sesión de desarrollo, con su cuenta). Hazla ahora con tus herramientas, ' +
  'como si Juan te la dijera: él ya la pidió, así que no le pidas confirmación ni le preguntes nada (nadie está esperando en el chat). ' +
  'A un huésped o a un tercero escríbele solo si la instrucción lo dice explícitamente. Si falta un dato que ninguna herramienta te da, no lo inventes: di qué falta. ' +
  'Tu respuesta queda en un issue público de GitHub: di qué hiciste, sin teléfonos, correos ni códigos.\n\nINSTRUCCIÓN:\n';

function paraAlmaTok_() { var p = PropertiesService.getScriptProperties(); return p.getProperty('GITHUB_TOKEN') || p.getProperty('GITHUB_PRS') || ''; }
/* GitHub con la llave del Hub. Devuelve { code, json }; un error de red es code 0. */
function paraAlmaGh_(metodo, ruta, cuerpo) {
  var tok = paraAlmaTok_(); if (!tok) return { code: 0, json: null };
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
  if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  try {
    var r = uf_('https://api.github.com' + ruta, o, 'Chat de Alma'), j = null;   // es Juan pidiendo: cuenta como el chat, que nunca se pausa
    try { j = JSON.parse(r.getContentText() || 'null'); } catch (e) {}
    return { code: r.getResponseCode(), json: j };
  } catch (e) { return { code: 0, json: null, error: String(e) }; }
}

function paraAlmaEstados_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PARA_ALMA_PROP_) || '{}') || {}; } catch (e) { return {}; } }
function paraAlmaGuardarEstados_(est) {
  var corte = Date.now() - 30 * 86400000;   // lo de más de 30 días ya no hace falta
  Object.keys(est).forEach(function (k) { if (est[k] && est[k].e === 'listo' && Number(est[k].t) < corte) delete est[k]; });
  PropertiesService.getScriptProperties().setProperty(PARA_ALMA_PROP_, JSON.stringify(est));
}
/* Cambia el estado de un issue bajo el candado. desde: estados permitidos antes del cambio ('' = sin estado). false si otra pasada ganó. */
function paraAlmaMarcar_(num, nuevo, desde) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return false;
  try {
    var est = paraAlmaEstados_(), ya = est[num];
    if (desde && desde.indexOf(ya ? ya.e : '') < 0) return false;
    nuevo.t = Date.now(); est[num] = nuevo; paraAlmaGuardarEstados_(est);
    return true;
  } finally { lock.releaseLock(); }
}

/* Lo que sale a un issue público: sin correos, teléfonos ni códigos. */
function paraAlmaPublico_(t) {
  t = String(t || '')
    .replace(/[^\s@<>()"'«»,;:]+@[^\s@<>()"'«»,;:]+\.[a-z]{2,}/gi, '[correo]')
    .replace(/\+\s?\d[\d\s().\-\u2011]{6,}\d|\b\d{4}[\s\-\u2011]?\d{4}\b|\b\d{10,15}\b/g, '[número]');
  try { t = cerLimpiarSensible_(t); } catch (e) {}   // DPI, tarjetas, códigos y claves (cerebro_fuentes.js)
  return t;
}

/* El JSON del cuerpo: un bloque ```json …``` o el cuerpo entero. Devuelve { ok, instruccion, responder_a, hasta } o { ok: false, error }. */
function paraAlmaLeer_(cuerpo, creado) {
  var b = String(cuerpo || ''), m = /```(?:json)?\s*([\s\S]*?)```/i.exec(b), txt = (m ? m[1] : b).trim(), j;
  if (!m && txt.indexOf('{') > 0) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
  try { j = JSON.parse(txt); } catch (e) { return { ok: false, error: 'el cuerpo no trae un JSON válido (' + String(e.message || e).slice(0, 120) + ')' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, error: 'el JSON tiene que ser un objeto con «instruccion»' };
  var ins = typeof j.instruccion === 'string' ? j.instruccion.trim() : '';
  if (!ins) return { ok: false, error: 'falta «instruccion» (texto)' };
  if (ins.length > 4000) return { ok: false, error: '«instruccion» pasa de 4000 caracteres' };
  var resp = j.responder_a == null || j.responder_a === '' ? 'chat' : String(j.responder_a).trim().toLowerCase();
  if (resp !== 'chat' && resp !== 'whatsapp') return { ok: false, error: '«responder_a» tiene que ser «whatsapp» o «chat»' };
  var hasta = 0;
  if (j.hasta != null && j.hasta !== '') {
    var h = String(j.hasta).trim();
    if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(h)) h += '-06:00';   // sin zona: hora de Guatemala
    hasta = new Date(h).getTime();
    if (!hasta) return { ok: false, error: '«hasta» no es una fecha ISO (p. ej. 2026-11-12T08:55:00-06:00)' };
  } else hasta = new Date(creado).getTime() + PARA_ALMA_VIGENCIA_;
  return { ok: true, instruccion: ins, responder_a: resp, hasta: hasta, conHasta: j.hasta != null && j.hasta !== '' };
}

/* ¿Lo abrió el dueño y nadie más lo editó? GitHub da el historial de ediciones solo por GraphQL.
   Devuelve { ok } · { ok: false, motivo } · { duda: true } (GitHub no respondió: se mira en la próxima pasada). */
function paraAlmaAutorizado_(issue) {
  var dueno = PARA_ALMA_DUENO_.toLowerCase(), login = function (x) { return String((x && x.login) || '').toLowerCase(); };
  if (login(issue.user) !== dueno) return { ok: false, motivo: 'autor no autorizado (lo abrió ' + (login(issue.user) || 'otra cuenta') + '; solo ' + PARA_ALMA_DUENO_ + ' me puede pedir cosas por aquí)' };
  if ((issue.labels || []).some(function (l) { return String((l && l.name) || l) === 'alma-mejora'; })) return { ok: false, motivo: 'es un pedido que yo misma le hice a Claude (etiqueta alma-mejora), no una instrucción de Juan' };
  var rep = PARA_ALMA_REPO_.split('/');
  var q = 'query($o:String!,$n:String!,$i:Int!){repository(owner:$o,name:$n){issue(number:$i){author{login} editor{login} userContentEdits(first:50){nodes{editor{login}}}}}}';
  var r = paraAlmaGh_('post', '/graphql', { query: q, variables: { o: rep[0], n: rep[1], i: Number(issue.number) } });
  var is = r.code === 200 && r.json && r.json.data && r.json.data.repository && r.json.data.repository.issue;
  if (!is) return { duda: true, error: 'GitHub respondió ' + (r.code || 'sin conexión') + ' al revisar quién editó el issue' };
  if (login(is.author) !== dueno) return { ok: false, motivo: 'autor no autorizado' };
  /* editor: quien lo editó la última vez (null si nadie); userContentEdits: todas las ediciones (una cuenta borrada no tiene login). */
  var editores = (is.editor ? [is.editor] : []).concat(((is.userContentEdits || {}).nodes || []).map(function (n) { return n ? n.editor : null; }));
  var otros = editores.filter(function (e) { return login(e) !== dueno; });
  if (otros.length) return { ok: false, motivo: 'autor no autorizado (lo editó ' + (login(otros[0]) || 'una cuenta borrada') + ')' };
  return { ok: true };
}

/* Comenta, etiqueta y cierra. true si todo salió (si no, queda «por_avisar» y se reintenta solo el aviso). */
function paraAlmaAvisar_(num, a) {
  var base = '/repos/' + PARA_ALMA_REPO_ + '/issues/' + num;
  if (!a.comentado) {
    var c = paraAlmaGh_('post', base + '/comments', { body: paraAlmaPublico_(a.texto) });
    if (c.code < 200 || c.code >= 300) return false;
    a.comentado = 1;
  }
  if (a.etiqueta && !a.etiquetado) { var l = paraAlmaGh_('post', base + '/labels', { labels: [a.etiqueta] }); if (l.code < 200 || l.code >= 300) return false; a.etiquetado = 1; }
  if (a.cerrar) { var x = paraAlmaGh_('patch', base, { state: 'closed', state_reason: a.cerrar }); if (x.code < 200 || x.code >= 300) return false; }
  return true;
}
/* Primero queda «por_avisar» con el texto (si GitHub falla, la próxima pasada solo repite el aviso, nunca la instrucción).
   Después de 10 intentos se da por terminado: un permiso que falta no hace llamadas cada 2 min para siempre. */
function paraAlmaTerminar_(num, a) {
  if (!paraAlmaMarcar_(num, Object.assign({}, a, { e: 'por_avisar' }), ['', 'ejecutando', 'por_avisar'])) return;
  if (paraAlmaAvisar_(num, a)) { paraAlmaMarcar_(num, { e: 'listo' }, ['por_avisar']); return; }
  a.intentos = (Number(a.intentos) || 0) + 1;
  if (a.intentos >= 10) { console.error('paraAlma #' + num + ': GitHub no dejó avisar en 10 intentos'); paraAlmaMarcar_(num, { e: 'listo', sinAviso: 1 }, ['por_avisar']); }
  else paraAlmaMarcar_(num, Object.assign({}, a, { e: 'por_avisar' }), ['por_avisar']);   // guarda lo que sí salió (comentado, etiquetado)
}
function paraAlmaFecha_(ms) { return Utilities.formatDate(new Date(ms), CFG.TZ, "d MMM yyyy, HH:mm") + ' (hora de Guatemala)'; }

/* Hace la instrucción con Alma, como el administrador principal. Devuelve { ok, texto (para el issue), resumen, error }. */
function paraAlmaEjecutar_(adm, inst) {
  if (!opAgenteActivo_()) return { ok: false, error: 'Alma tiene el agente apagado (OP_AGENTE = 0): no tengo herramientas' };
  var pedido = PARA_ALMA_NOTA_ + inst.instruccion;
  /* Como la entrega de escalar.js: el pedido no se guarda como si Juan lo hubiera escrito. Sin escalar ni Desarrollo. */
  var ag = opAgente_(adm, pedido, PARA_ALMA_CANAL_, [], opFilas_(adm.email, 20));
  var turno = chatTurnoCerrar_(adm, [], pedido, ag, { canal: PARA_ALMA_CANAL_, sinEscalar: true, sinDesarrollo: true });
  var resp = String((turno && turno.texto) || (ag && ag.respuesta) || '').trim(), hechas = (ag && ag.hechas) || [];
  try { resp = formatearMensaje_(resp); } catch (e) {}
  try { opGuardar_(adm, 'alma', PARA_ALMA_CANAL_, 'Claude me pidió (de tu parte): «' + inst.instruccion.slice(0, 400) + '»\n\n' + (resp || 'Listo.'), hechas); } catch (e) { console.error('paraAlma chat: ' + e); }
  var linea = function (h) { return '· ' + (h.resumen || h.tipo || 'acción') + (h.id ? ' · id ' + h.id : '') + (h.error ? ' · falló: ' + h.error : ''); };
  var fallidas = hechas.filter(function (h) { return h && h.error; });
  var texto = (fallidas.length ? 'No salió todo. No lo reintento sola: si hace falta, abre otro issue.' : 'Listo, lo hice como si me lo pidiera Juan.') +
    (hechas.length ? '\n\n**Lo que hice**\n' + hechas.map(linea).join('\n') : '\n\n**Lo que hice:** nada con herramientas (solo respondí).') +
    '\n\n**Lo que respondí**\n' + (resp || 'Listo.').split('\n').map(function (l) { return '> ' + l; }).join('\n');
  return { ok: !fallidas.length, texto: texto, error: fallidas.map(function (h) { return (h.resumen || h.tipo) + ': ' + h.error; }).join('; '), hechas: hechas };
}

/* La pasada (procesarCola, cada 2 min). inicio: cuándo empezó la pasada, para el tope de tiempo. Una instrucción por pasada. */
function paraAlmaRevisar_(inicio) {
  if (!paraAlmaTok_()) return 0;
  var c = CacheService.getScriptCache(); if (c.get('para_alma_t')) return 0; c.put('para_alma_t', '1', 110);
  var r = paraAlmaGh_('get', '/repos/' + PARA_ALMA_REPO_ + '/issues?state=open&labels=' + PARA_ALMA_ETIQUETA_ + '&sort=created&direction=asc&per_page=20');
  if (r.code !== 200 || !Array.isArray(r.json)) return 0;
  var est = paraAlmaEstados_(), hecho = 0;
  var lista = r.json.filter(function (i) { return i && !i.pull_request && !(i.labels || []).some(function (l) { return String((l && l.name) || l) === PARA_ALMA_ERROR_; }); });
  for (var k = 0; k < lista.length; k++) {
    var i = lista[k], num = String(i.number), ya = est[num];
    try {
      if (ya && ya.e === 'listo') continue;   // una sola vez por issue, aunque lo vuelvan a abrir
      if (ya && ya.e === 'por_avisar') { paraAlmaTerminar_(num, ya); continue; }   // ya se hizo: solo falta el aviso
      if (ya && ya.e === 'ejecutando') {
        if (Date.now() - Number(ya.t) > PARA_ALMA_CORTADA_) paraAlmaTerminar_(num, { texto: 'La ejecución se cortó a la mitad (' + paraAlmaFecha_(Number(ya.t)) + '). No la reintento para no repetir nada: revisa el chat de Juan y, si hace falta, abre otro issue.', etiqueta: PARA_ALMA_ERROR_ });
        continue;
      }
      if (hecho) continue;   // una instrucción con IA por pasada; los avisos pendientes sí salen
      var aut = paraAlmaAutorizado_(i);
      if (aut.duda) {
        if (Date.now() - new Date(i.created_at).getTime() > PARA_ALMA_CORTADA_) paraAlmaTerminar_(num, { texto: 'No lo ejecuté: ' + aut.error + '.', etiqueta: PARA_ALMA_ERROR_ });
        continue;
      }
      if (!aut.ok) { paraAlmaTerminar_(num, { texto: 'No lo ejecuté: ' + aut.motivo + '.', cerrar: 'not_planned' }); continue; }
      var inst = paraAlmaLeer_(i.body, i.created_at);
      if (!inst.ok) { paraAlmaTerminar_(num, { texto: 'No lo ejecuté: ' + inst.error + '. Formato: un bloque ```json con {"instruccion": "…", "responder_a": "whatsapp|chat", "hasta": "ISO opcional"}. No lo reintento: abre otro issue.', etiqueta: PARA_ALMA_ERROR_ }); continue; }
      if (Date.now() > inst.hasta) { paraAlmaTerminar_(num, { texto: 'No lo ejecuté: ' + (inst.conHasta ? 'vencía el ' : 'pasaron 24 h desde que se abrió (vencía el ') + paraAlmaFecha_(inst.hasta) + (inst.conHasta ? '' : ')') + ' y lo vi el ' + paraAlmaFecha_(Date.now()) + '.', cerrar: 'not_planned' }); continue; }
      if (inicio && Date.now() - inicio > PARA_ALMA_TOPE_) continue;   // no alcanza el tiempo: en la próxima pasada
      var adm = chatPrincipal_();
      if (!adm || !esAdminPrincipal_(adm)) { paraAlmaTerminar_(num, { texto: 'No lo ejecuté: no encontré al administrador principal en Accesos.', etiqueta: PARA_ALMA_ERROR_ }); continue; }
      /* Reserva primero: dos pasadas de procesarCola pueden correr a la vez. */
      if (!paraAlmaMarcar_(num, { e: 'ejecutando' }, [''])) continue;
      hecho = 1;
      var res;
      try { res = paraAlmaEjecutar_(adm, inst); }
      catch (e) { res = { ok: false, texto: 'Falló: ' + String((e && e.message) || e).slice(0, 300) + '. No lo reintento sola: si hace falta, abre otro issue.', error: String((e && e.message) || e).slice(0, 200) }; }
      if (!res.texto) res.texto = 'Falló: ' + res.error + '. No lo reintento sola: si hace falta, abre otro issue.';
      if (inst.responder_a === 'whatsapp' && (adm.tels || []).length) {
        var corto = inst.instruccion.replace(/\s+/g, ' ').slice(0, 140) + (inst.instruccion.length > 140 ? '…' : '');
        try { waEnviar_(adm.wa || adm.tels[0], 'Claude me pidió de tu parte: «' + corto + '»; ' + (res.ok ? 'ya quedó.' : 'no se pudo: ' + String(res.error).slice(0, 200) + '.')); } catch (e) { console.error('paraAlma WhatsApp: ' + e); }
      }
      paraAlmaTerminar_(num, res.ok ? { texto: res.texto, cerrar: 'completed' } : { texto: res.texto, etiqueta: PARA_ALMA_ERROR_ });
    } catch (e) { console.error('paraAlmaRevisar_ #' + num + ': ' + ((e && e.stack) || e)); }
  }
  return hecho;
}
