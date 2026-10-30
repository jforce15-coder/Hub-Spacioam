/* ═══ UNIR CAMBIOS SIN ENTRAR A GITHUB ══════════════════════════════════════════════════════════════════════
   Juan decide; nadie más une. Los cambios abiertos (PR) de todos sus repos aparecen en «Pendientes» de la app de Alma
   con un botón «Unir», y Alma los une cuando Juan se lo pide por cualquier canal (voz, WhatsApp, chat) con unir_cambio.
   Usa la llave de GitHub de Conexiones (GITHUB_PRS o GITHUB_TOKEN); para unir necesita permiso de escritura en
   Pull requests y Contents. Si los checks fallaron o hay un choque con main, no une: dice por qué. */
var UNIR_DUENO_ = 'jforce15-coder';
var UNIR_NOMBRES_ = { 'hub-spacioam': 'Hub', 'alma-app': 'App de Alma', 'hola-spacioam': 'Hola', 'epi-spacioam': 'Epi', 'grow-spacioam': 'Grow',
  'mi-spacioam': 'Mi', 'docs-spacioam': 'Docs', 'spacio-am': 'Spacio AM', 'the-gentle-stoic-parent': 'Gentle Stoic Parent' };

function unirGh_(metodo, ruta, cuerpo) {
  var p = PropertiesService.getScriptProperties(), tok = p.getProperty('GITHUB_PRS') || p.getProperty('GITHUB_TOKEN');
  if (!tok) return { codigo: 0, j: null };
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
  if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  try { var r = UrlFetchApp.fetch('https://api.github.com' + ruta, o), t = r.getContentText(); return { codigo: r.getResponseCode(), j: t ? JSON.parse(t) : null }; }
  catch (e) { return { codigo: -1, j: null, error: String(e) }; }
}
function unirNombreRepo_(repo) { var n = String(repo).split('/')[1] || repo; return UNIR_NOMBRES_[n.toLowerCase()] || n; }

/* Los cambios abiertos, con su estado: listo (checks en verde), revisando, fallo o choque. Caché de 45 s. */
function prsAbiertos_(fresco) {
  var c = CacheService.getScriptCache(); if (!fresco) { var h = c.get('prs_abiertos'); if (h) return JSON.parse(h); }
  var dueno = PropertiesService.getScriptProperties().getProperty('GITHUB_DUENO') || UNIR_DUENO_;
  var s = unirGh_('get', '/search/issues?per_page=30&q=' + encodeURIComponent('is:pr is:open archived:false user:' + dueno));
  if (s.codigo !== 200 || !s.j) return null;
  var lista = (s.j.items || []).map(function (it) {
    var m = /repos\/([^\/]+\/[^\/]+)$/.exec(it.repository_url || ''), repo = m ? m[1] : '';
    var d = unirGh_('get', '/repos/' + repo + '/pulls/' + it.number).j || {};
    var ck = d.head && d.head.sha ? paraClaudeChecks_(repo, d.head.sha) : null;
    var estado = d.draft ? 'borrador' : d.mergeable === false ? 'choque' : ck && ck.fallas ? 'fallo' : ck && ck.corriendo ? 'revisando' : 'listo';
    return { repo: repo, app: unirNombreRepo_(repo), numero: it.number, titulo: it.title, url: it.html_url, estado: estado, fecha: it.created_at, checks: ck };
  });
  try { c.put('prs_abiertos', JSON.stringify(lista), 45); } catch (e) {}
  return lista;
}

/* Cuál une: el enlace, «repo#123», el número, palabras del título o «todos» (los que están listos). */
function prsElegir_(cual, lista) {
  var q = String(cual || '').trim(), m;
  if (!q) return [];
  if (/^tod[oa]s?$/i.test(q)) return lista.filter(function (x) { return x.estado === 'listo'; });
  if ((m = /github\.com\/([^\/]+\/[^\/]+)\/pull\/(\d+)/.exec(q))) return lista.filter(function (x) { return x.repo.toLowerCase() === m[1].toLowerCase() && x.numero === +m[2]; });
  if ((m = /^([\w.-]+)\s*#\s*(\d+)$/.exec(q))) return lista.filter(function (x) { return (x.repo.split('/')[1].toLowerCase() === m[1].toLowerCase() || x.app.toLowerCase() === m[1].toLowerCase()) && x.numero === +m[2]; });
  if ((m = /^#?\s*(\d+)$/.exec(q))) return lista.filter(function (x) { return x.numero === +m[1]; });
  var pal = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
  return lista.filter(function (x) { var t = (x.titulo + ' ' + x.app).toLowerCase(); return pal.length && pal.every(function (w) { return t.indexOf(w) >= 0; }); });
}

function prUnirUno_(pr) {
  if (pr.estado === 'fallo') return { ok: false, pr: pr.app + ' #' + pr.numero, error: 'Sus revisiones fallaron; Claude lo arregla primero.' };
  if (pr.estado === 'choque') return { ok: false, pr: pr.app + ' #' + pr.numero, error: 'Choca con lo último de main; Claude tiene que ponerlo al día.' };
  if (pr.estado === 'borrador') return { ok: false, pr: pr.app + ' #' + pr.numero, error: 'Todavía es un borrador.' };
  var r = unirGh_('put', '/repos/' + pr.repo + '/pulls/' + pr.numero + '/merge', { merge_method: 'merge' });
  if (r.codigo === 200) return { ok: true, pr: pr.app + ' #' + pr.numero, titulo: pr.titulo, url: pr.url };
  var por = r.codigo === 403 || r.codigo === 404 ? 'La llave de GitHub no tiene permiso para unir: en Conexiones, pon una con «Read and write» en Pull requests y Contents.'
    : r.codigo === 405 ? 'GitHub no lo deja unir todavía (revisiones pendientes o bloqueo).' : r.codigo === 409 ? 'Choca con lo último de main.' : 'GitHub respondió ' + r.codigo + '.';
  return { ok: false, pr: pr.app + ' #' + pr.numero, error: por };
}

/* Para Alma (unir_cambio) y para el botón de la app. Sin «cual»: devuelve la lista para que Alma pregunte. */
function unirCambio_(cual) {
  var lista = prsAbiertos_(true);
  if (!lista) return { ok: false, error: 'No tengo la llave de GitHub o GitHub no respondió. Se pone en hub.spacioam.com/alma/conexiones.html.' };
  var resumen = lista.map(function (x) { return { cual: x.app + ' #' + x.numero, titulo: x.titulo, estado: x.estado }; });
  if (!lista.length) return { ok: true, unidos: [], abiertos: [], nota: 'No hay cambios pendientes de unir.' };
  if (!cual) return { ok: true, unidos: [], abiertos: resumen, nota: 'Dile a Juan cuáles hay (en simple) y pregúntale cuál une, o si une todos los listos.' };
  var elegidos = prsElegir_(cual, lista);
  if (!elegidos.length) return { ok: false, error: 'No encontré ese cambio entre los abiertos.', abiertos: resumen };
  if (elegidos.length > 1 && !/^tod[oa]s?$/i.test(String(cual).trim())) return { ok: false, error: 'Hay varios que coinciden; pregúntale cuál.', abiertos: elegidos.map(function (x) { return { cual: x.app + ' #' + x.numero, titulo: x.titulo, estado: x.estado }; }) };
  var res = elegidos.map(prUnirUno_);
  try { CacheService.getScriptCache().remove('prs_abiertos'); } catch (e) {}
  return { ok: res.some(function (x) { return x.ok; }), unidos: res.filter(function (x) { return x.ok; }), no_unidos: res.filter(function (x) { return !x.ok; }),
    nota: 'Al unirse se publica solo; los bots de prueba lo revisan después.' };
}
function unirPrSes_(ses, ref) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal une cambios.' };
  return unirCambio_(ref);
}
