/* ═══ 22 · DE ALMA PARA CLAUDE: pedidos de mejora que el equipo le dicta a ALMA ═════════════════════════════════
   Juan (o un administrador) le dice a ALMA, por WhatsApp, en el Hub o en una llamada, cómo debería funcionar algo o
   qué está fallando. ALMA lo ordena (qué pasa, qué se quiere, un ejemplo) y lo deja:
     1. en la hoja ALMA_PARA_CLAUDE (siempre), y
     2. como issue en GitHub (jforce15-coder/Hub-Spacioam, etiqueta «alma-mejora») si existe GITHUB_TOKEN en las
        propiedades del script. Claude revisa esos issues, programa el cambio y abre un PR para que Juan lo una.
   El token es de GitHub (fine-grained, solo ese repositorio, permiso Issues: lectura y escritura).

   CONEXIÓN DIRECTA (Alma → Claude Code → Alma). Solo el administrador principal.
     3. Dispara la tarea de Claude Code «Alma → Claude · mejoras del sistema» (CLAUDE_RUTINA_ID) con el pedido ya ordenado,
        si existe CLAUDE_RUTINA_TOKEN en las propiedades del script (lo genera Juan en claude.ai/code/routines → la tarea →
        Editar → Agregar disparador → API → Generar token; nunca va en el chat ni en GitHub).
     4. Claude programa el cambio en una rama con su PR y responde al Hub (paraClaudeRespuesta_) con una llave de un solo uso
        que viaja dentro del pedido: el Hub guarda solo su huella SHA-256.
     5. La respuesta queda en la conversación «Desarrollo» del Hub (solo la ve el principal), le llega por WhatsApp en una
        línea y Alma se la cuenta en voz corta en la próxima llamada (paraClaudeNovedades_). */

var PARA_CLAUDE_CAB_ = ['id', 'fecha', 'quien', 'app', 'tipo', 'prioridad', 'titulo', 'detalle', 'estado', 'issue', 'sesion', 'respuesta', 'llave'];
var PARA_CLAUDE_REPO_ = 'jforce15-coder/Hub-Spacioam';
var CLAUDE_RUTINA_DEF_ = 'trig_01VrusYxvHrU1MBz4x39RVEm';
var HUB_EXEC_DEF_ = 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec';
/* La conversación aparte del chat de Alma: una fila más en ALMA_OPERATIVO con este «usuario». */
var DESARROLLO_ = { email: 'desarrollo', nombre: 'Desarrollo · mejoras del sistema', tels: [], principal: false };

function paraClaudeHoja_() {
  var sh = hojaCrear_('ALMA_PARA_CLAUDE', PARA_CLAUDE_CAB_);
  if (sh.getLastColumn() < PARA_CLAUDE_CAB_.length) sh.getRange(1, 1, 1, PARA_CLAUDE_CAB_.length).setValues([PARA_CLAUDE_CAB_]);
  return sh;
}
function paraClaudeHuella_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function esAdminPrincipal_(adm) { return !!adm && (adm.principal || !adminsOp_().some(function (a) { return a.principal; })); }

function paraClaudeCrear_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede pedir cambios al sistema. Dile que se lo pida a Juan.' };
  var titulo = String(inp.titulo || '').trim().slice(0, 100); if (!titulo || !String(inp.que_quiere || '').trim()) return { ok: false, error: 'Falta el título o qué se quiere.' };
  var quien = (adm && adm.nombre) || 'Equipo', id = 'pc' + Date.now(), fecha = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
  var cuerpo = '**Pedido de ' + quien + ' a través de ALMA** · ' + fecha + ' (hora de Guatemala)\n\n' +
    '**Dónde:** ' + (inp.app || 'Otro') + ' · **Tipo:** ' + String(inp.tipo || 'mejora').replace('_', ' ') + ' · **Prioridad:** ' + (inp.prioridad || 'normal') + '\n\n' +
    (String(inp.que_pasa || '').trim() ? '### Qué pasa hoy\n' + String(inp.que_pasa).trim() + '\n\n' : '') +
    '### Cómo debería funcionar\n' + String(inp.que_quiere).trim() + '\n\n' +
    (String(inp.ejemplo || '').trim() ? '### Ejemplo\n' + String(inp.ejemplo).trim() + '\n\n' : '') +
    '---\n_Lo dictó ' + quien + ' a ALMA. Claude: trabájalo en una rama nueva, abre un PR y enlázalo aquí. No incluyas datos personales de huéspedes._';
  var issue = '';
  var tok = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (tok) {
    try {
      var r = UrlFetchApp.fetch('https://api.github.com/repos/' + PARA_CLAUDE_REPO_ + '/issues', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        payload: JSON.stringify({ title: '[' + (inp.app || 'Otro') + '] ' + titulo, body: cuerpo, labels: ['alma-mejora', String(inp.tipo || 'mejora'), 'prioridad-' + (inp.prioridad || 'normal')] }) });
      if (r.getResponseCode() < 300) issue = JSON.parse(r.getContentText()).html_url || '';
      else console.error('GitHub issue ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    } catch (e) { console.error('paraClaude GitHub: ' + e); }
  }
  var llave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var disparo = paraClaudeDisparar_({ id: id, llave: llave, respuesta_url: PropertiesService.getScriptProperties().getProperty('HUB_URL') || HUB_EXEC_DEF_,
    quien: quien, app: inp.app || 'Otro', tipo: inp.tipo || 'mejora', prioridad: inp.prioridad || 'normal', titulo: titulo, instruccion: cuerpo, issue: issue });
  try { paraClaudeHoja_().appendRow([id, fecha, quien, inp.app || 'Otro', inp.tipo || 'mejora', inp.prioridad || 'normal', titulo, cuerpo.slice(0, 45000), disparo.ok ? 'con Claude' : 'pendiente', issue, disparo.url || '', '', disparo.ok ? paraClaudeHuella_(llave) : '']); }
  catch (e) { return { ok: false, error: 'No pude guardarlo: ' + e }; }
  try { opGuardar_(DESARROLLO_, 'yo', 'hub', 'Pedido para Claude · ' + titulo + '\n\n' + String(inp.que_quiere).trim().slice(0, 1500) + (disparo.ok ? '' : '\n\n(No se pudo enviar directo a Claude: ' + disparo.error + '. Quedó en la lista de pedidos.)'), []); } catch (e) { console.error('Desarrollo: ' + e); }
  return { ok: true, id: id, issue: issue || undefined, claude: disparo.ok,
    nota: disparo.ok ? 'Ya se lo pasé a Claude. Está trabajando en eso; cuando termine te cuento en corto y queda en la conversación Desarrollo.' :
      issue ? 'Quedó enviado a Claude (issue en GitHub). Cuando esté listo llega un PR para que Juan lo una.' : 'Quedó guardado para Claude en la lista de pedidos. (La conexión directa aún no está activa: falta CLAUDE_RUTINA_TOKEN.)' };
}
/* Responder en la conversación «Desarrollo» del Hub: el mensaje va directo a Claude como seguimiento, con su última
   respuesta como contexto. Solo el administrador principal (con su sesión). */
function paraClaudeDesdeChat_(ses, texto) {
  texto = String(texto || '').trim(); if (!texto) return { ok: false, error: 'faltan datos' };
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede pedirle cambios a Claude.' };
  var ult = '';
  try { var fs = opFilas_(DESARROLLO_.email, 20).filter(function (m) { return m.de === 'alma'; }); if (fs.length) ult = String(fs[fs.length - 1].texto || '').slice(0, 3000); } catch (e) {}
  var r = paraClaudeCrear_(adm, { titulo: texto.replace(/\s+/g, ' ').slice(0, 80), app: 'Otro', tipo: 'mejora', prioridad: 'normal',
    que_quiere: texto + (ult ? '\n\nEs un seguimiento de Juan a tu respuesta anterior en «Desarrollo»:\n' + ult : '') });
  if (!r.ok) return r;
  var alma = opGuardar_(DESARROLLO_, 'alma', 'hub', r.claude ? 'Listo, ya se lo pasé a Claude. Te aviso aquí cuando responda.' : r.nota, []);
  return { ok: true, alma: alma };
}
/* hub.spacioam.com/claude.html: el admin principal pega ahí la llave de la tarea (la pantalla de Propiedades del script
   no deja agregar más de 50). Con llave vacía solo dice si ya hay una guardada; nunca la devuelve. */
function paraClaudeLlave_(ses, llave) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }   // también con su correo alterno
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede guardar esta llave.' };
  var p = PropertiesService.getScriptProperties(); llave = String(llave || '').trim();
  if (llave) {
    if (!/^sk-ant-oat01-[\w-]{20,}$/.test(llave)) return { ok: false, error: 'Esa no parece la llave de la tarea: empieza con sk-ant-oat01-' };
    p.setProperty('CLAUDE_RUTINA_TOKEN', llave);
  }
  var t = p.getProperty('CLAUDE_RUTINA_TOKEN') || '';
  return { ok: true, guardada: !!t, termina: t ? t.slice(-4) : '' };
}
/* Dispara la tarea de Claude Code. Devuelve { ok, url } o { ok:false, error }. Sin reintentos: cada disparo abre una sesión. */
function paraClaudeDisparar_(pedido) {
  var p = PropertiesService.getScriptProperties(), tok = p.getProperty('CLAUDE_RUTINA_TOKEN'), rutina = p.getProperty('CLAUDE_RUTINA_ID') || CLAUDE_RUTINA_DEF_;
  if (!tok) return { ok: false, error: 'falta CLAUDE_RUTINA_TOKEN' };
  try {
    var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/claude_code/routines/' + rutina + '/fire', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'experimental-cc-routine-2026-04-01' },
      payload: JSON.stringify({ text: JSON.stringify(pedido).slice(0, 65000) }) });
    var c = r.getResponseCode(), j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
    if (c >= 300) { console.error('Rutina Claude ' + c + ': ' + r.getContentText().slice(0, 300)); return { ok: false, error: 'Claude respondió ' + c + ((j.error && j.error.message) ? ' (' + String(j.error.message).slice(0, 120) + ')' : '') }; }
    return { ok: true, url: j.claude_code_session_url || '' };
  } catch (e) { console.error('paraClaudeDisparar_: ' + e); return { ok: false, error: String(e).slice(0, 160) }; }
}
/* Claude responde (doPost con {mejora:1, action:'respuesta'}). La llave es de un solo uso: se borra al aceptarla. */
function paraClaudeRespuesta_(b) {
  b = b || {};
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2 || !b.id || !b.llave) return { ok: false, error: 'pedido' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, PARA_CLAUDE_CAB_.length).getValues(), i = -1;
    for (var k = 0; k < v.length; k++) if (String(v[k][0]) === String(b.id)) { i = k; break; }
    if (i < 0 || !v[i][12] || String(v[i][12]) !== paraClaudeHuella_(b.llave)) return { ok: false, error: 'llave' };
    var estado = /^(listo|pregunta|fallo)$/.test(String(b.estado)) ? String(b.estado) : 'listo', titulo = String(v[i][6]);
    var voz = String(b.voz || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    var enlaces = (Array.isArray(b.enlaces) ? b.enlaces : []).map(String).filter(function (u) { return /^https:\/\/github\.com\//.test(u); }).slice(0, 6);
    var texto = (estado === 'pregunta' ? 'Claude pregunta · ' : estado === 'fallo' ? 'Claude no pudo · ' : 'Claude terminó · ') + titulo + '\n\n' +
      (voz ? voz + '\n\n' : '') + String(b.detalle || '').trim().slice(0, 3000) + (enlaces.length ? '\n\n' + enlaces.join('\n') : '');
    if (estado === 'listo') enlaces.forEach(function (u) { if (/\/pull\/\d+/.test(u)) { try { accionCrear_('Unir el PR: ' + titulo, 'Claude dejó listo este cambio. Abre el enlace, revisa y toca «Merge pull request».', u, 'claude'); } catch (e) { console.error('accionCrear_: ' + e); } } });
    sh.getRange(i + 2, 9).setValue(estado === 'listo' ? 'PR listo' : estado);
    sh.getRange(i + 2, 12, 1, 2).setValues([[texto.slice(0, 45000), '']]);   // la llave ya no sirve
    opGuardar_(DESARROLLO_, 'alma', 'hub', paraClaudeFecha_() + ' · ' + texto, []);   // cada mensaje de Claude empieza con la fecha
    paraClaudeAvisar_(titulo, voz || texto.slice(0, 200), estado);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/* Fecha legible en hora de Guatemala, ej. «28 Oct 2026». */
function paraClaudeFecha_() {
  var d = new Date(), m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var dia = Utilities.formatDate(d, 'America/Guatemala', 'd'), mes = Number(Utilities.formatDate(d, 'America/Guatemala', 'M')) - 1;
  return dia + ' ' + m[mes] + ' ' + Utilities.formatDate(d, 'America/Guatemala', 'yyyy');
}
/* WhatsApp de una línea al principal + novedad pendiente para su próxima llamada con Alma. */
function paraClaudeAvisar_(titulo, voz, estado) {
  var p = PropertiesService.getScriptProperties(), nov = [];
  try { nov = JSON.parse(p.getProperty('DESARROLLO_NOVEDADES') || '[]'); } catch (e) {}
  nov.push({ ts: new Date().toISOString(), titulo: titulo, voz: voz, estado: estado });
  p.setProperty('DESARROLLO_NOVEDADES', JSON.stringify(nov.slice(-5)));
  try {
    var jefe = adminsOp_().find(function (a) { return a.principal; });
    if (jefe && jefe.tels.length) waEnviar_(jefe.wa || jefe.tels[0], voz + (estado === 'listo' ? '\n\nEl detalle está en el Hub, conversación Desarrollo.' : ''));
  } catch (e) { console.error('paraClaudeAvisar_: ' + e); }
}
/* Para la ficha de la llamada del principal: lo que Claude respondió desde la última llamada (y lo marca como contado). */
function paraClaudeNovedades_(adm) {
  if (!adm || !adm.principal) return '';
  var p = PropertiesService.getScriptProperties(), nov = [];
  try { nov = JSON.parse(p.getProperty('DESARROLLO_NOVEDADES') || '[]'); } catch (e) {}
  if (!nov.length) return '';
  p.deleteProperty('DESARROLLO_NOVEDADES');
  return '\nNOVEDADES DE CLAUDE (desarrollo del sistema): cuéntaselas en una frase cada una, sin leer detalles, cuando termine su primer pedido o si pregunta qué hay nuevo:\n' +
    nov.map(function (n) { return '· ' + n.titulo + ': ' + n.voz; }).join('\n');
}
/* Robot: los pedidos (por defecto los pendientes) y marcar uno como hecho. */
function paraClaudeLista_(todos) {
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: true, pedidos: [] };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PARA_CLAUDE_CAB_.length).getValues();
  return { ok: true, pedidos: v.map(function (r) { var o = {}; PARA_CLAUDE_CAB_.forEach(function (k, i) { if (k !== 'llave') o[k] = String(r[i]); }); return o; }).filter(function (o) { return todos || o.estado === 'pendiente'; }) };
}
function paraClaudeMarcar_(id, estado, nota) {
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: false, error: 'sin hoja' };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }), i = ids.indexOf(String(id));
  if (i < 0) return { ok: false, error: 'no existe' };
  sh.getRange(i + 2, 9).setValue(String(estado || 'hecho') + (nota ? ' · ' + String(nota).slice(0, 300) : ''));
  return { ok: true };
}

/* ═══ ACCIONES PENDIENTES DEL USUARIO ═══════════════════════════════════════════════════════════════════════════
   Cuando Claude deja algo que Juan debe hacer a mano (unir un PR, aprobar, abrir un enlace), queda aquí como una
   acción con título, instrucción y enlace. El Hub muestra un botón «Acciones pendientes (N)» solo si hay alguna.
   Si el enlace es un PR de GitHub, el Hub la da por hecha sola cuando el PR ya se unió o se cerró. */
var ACCIONES_CAB_ = ['id', 'fecha', 'titulo', 'instruccion', 'enlace', 'estado', 'origen'];
function accionesHoja_() {
  var sh = hojaCrear_('ALMA_ACCIONES', ACCIONES_CAB_);
  if (sh.getLastColumn() < ACCIONES_CAB_.length) sh.getRange(1, 1, 1, ACCIONES_CAB_.length).setValues([ACCIONES_CAB_]);
  return sh;
}
/* Crea una acción pendiente. Solo enlaces https. Si ya hay una pendiente con el mismo enlace, no la repite. */
function accionCrear_(titulo, instruccion, enlace, origen) {
  titulo = String(titulo || '').trim().slice(0, 120); if (!titulo) return { ok: false, error: 'titulo' };
  enlace = /^https:\/\//.test(String(enlace || '')) ? String(enlace).slice(0, 500) : '';
  var sh = accionesHoja_(), lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (enlace && sh.getLastRow() > 1) {
      var v = sh.getRange(2, 1, sh.getLastRow() - 1, ACCIONES_CAB_.length).getValues();
      for (var k = 0; k < v.length; k++) if (String(v[k][4]) === enlace && String(v[k][5]) === 'pendiente') return { ok: true, id: String(v[k][0]), repetida: true };
    }
    var id = 'ac' + Date.now();
    sh.appendRow([id, Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm'), titulo, String(instruccion || '').trim().slice(0, 2000), enlace, 'pendiente', String(origen || '').slice(0, 60)]);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}
/* ¿El PR de GitHub ya se unió o se cerró? true/false, o null si no se pudo saber. Repos públicos o con GITHUB_TOKEN. */
function accionPrCerrado_(enlace) {
  var m = /^https:\/\/github\.com\/(jforce15-coder\/[\w.-]+)\/pull\/(\d+)/i.exec(String(enlace)); if (!m) return null;
  try {
    var tok = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'), h = { Accept: 'application/vnd.github+json' };
    if (tok) h.Authorization = 'Bearer ' + tok;
    var r = UrlFetchApp.fetch('https://api.github.com/repos/' + m[1] + '/pulls/' + m[2], { headers: h, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    var pr = JSON.parse(r.getContentText()); return pr.state === 'closed' || !!pr.merged;
  } catch (e) { return null; }
}
/* Lista las pendientes; antes revisa las de PR (como mucho una vez por minuto) y marca como hechas las ya unidas. */
function accionesLista_() {
  var sh = accionesHoja_(); if (sh.getLastRow() < 2) return { ok: true, acciones: [] };
  var cache = CacheService.getScriptCache(), v = sh.getRange(2, 1, sh.getLastRow() - 1, ACCIONES_CAB_.length).getValues(), lista = [];
  v.forEach(function (r, i) {
    if (String(r[5]) !== 'pendiente') return;
    var ck = 'acc_' + r[0];
    if (/\/pull\/\d+/.test(String(r[4])) && !cache.get(ck)) {
      cache.put(ck, '1', 60);
      if (accionPrCerrado_(r[4]) === true) { sh.getRange(i + 2, 6).setValue('completada'); return; }
    }
    lista.push({ id: String(r[0]), fecha: String(r[1]), titulo: String(r[2]), instruccion: String(r[3]), enlace: String(r[4]) });
  });
  return { ok: true, acciones: lista };
}
function accionMarcar_(id) {
  var sh = accionesHoja_(); if (sh.getLastRow() < 2) return { ok: false, error: 'no existe' };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }), i = ids.indexOf(String(id));
  if (i < 0) return { ok: false, error: 'no existe' };
  sh.getRange(i + 2, 6).setValue('completada'); return { ok: true };
}
