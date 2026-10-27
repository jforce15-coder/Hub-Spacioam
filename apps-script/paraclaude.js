/* ═══ 22 · DE ALMA PARA CLAUDE: pedidos de mejora que el equipo le dicta a ALMA ═════════════════════════════════
   Juan (o un administrador) le dice a ALMA, por WhatsApp, en el Hub o en una llamada, cómo debería funcionar algo o
   qué está fallando. ALMA lo ordena (qué pasa, qué se quiere, un ejemplo) y lo deja:
     1. en la hoja ALMA_PARA_CLAUDE (siempre), y
     2. como issue en GitHub (jforce15-coder/Hub-Spacioam, etiqueta «alma-mejora») si existe GITHUB_TOKEN en las
        propiedades del script. Claude revisa esos issues, programa el cambio y abre un PR para que Juan lo una.
   El token es de GitHub (fine-grained, solo ese repositorio, permiso Issues: lectura y escritura). */

var PARA_CLAUDE_CAB_ = ['id', 'fecha', 'quien', 'app', 'tipo', 'prioridad', 'titulo', 'detalle', 'estado', 'issue'];
var PARA_CLAUDE_REPO_ = 'jforce15-coder/Hub-Spacioam';

function paraClaudeCrear_(adm, inp) {
  inp = inp || {};
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
  try { hojaCrear_('ALMA_PARA_CLAUDE', PARA_CLAUDE_CAB_).appendRow([id, fecha, quien, inp.app || 'Otro', inp.tipo || 'mejora', inp.prioridad || 'normal', titulo, cuerpo.slice(0, 45000), 'pendiente', issue]); }
  catch (e) { return { ok: false, error: 'No pude guardarlo: ' + e }; }
  return { ok: true, id: id, issue: issue || undefined,
    nota: issue ? 'Quedó enviado a Claude (issue en GitHub). Cuando esté listo llega un PR para que Juan lo una.' : 'Quedó guardado para Claude en la lista de pedidos. (La conexión directa con GitHub aún no está activa: falta GITHUB_TOKEN.)' };
}
/* Robot: los pedidos (por defecto los pendientes) y marcar uno como hecho. */
function paraClaudeLista_(todos) {
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: true, pedidos: [] };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PARA_CLAUDE_CAB_.length).getValues();
  return { ok: true, pedidos: v.map(function (r) { var o = {}; PARA_CLAUDE_CAB_.forEach(function (k, i) { o[k] = String(r[i]); }); return o; }).filter(function (o) { return todos || o.estado === 'pendiente'; }) };
}
function paraClaudeMarcar_(id, estado, nota) {
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: false, error: 'sin hoja' };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }), i = ids.indexOf(String(id));
  if (i < 0) return { ok: false, error: 'no existe' };
  sh.getRange(i + 2, 9).setValue(String(estado || 'hecho') + (nota ? ' · ' + String(nota).slice(0, 300) : ''));
  return { ok: true };
}
