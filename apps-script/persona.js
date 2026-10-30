/* ═══ PLAYBOOKS: UN SOLO AGENTE, UN PLAYBOOK POR TRABAJO ════════════════════════════════════════════════════
   Lección «AI delegation»: en vez de muchos agentes cableados o un cerebro gigante, UN agente (Alma) con un playbook
   por trabajo. Los playbooks son los .md de playbooks/ en el repo del Hub (una sola fuente, con historial), publicados
   en hub.spacioam.com/playbooks/:
     · alma.md                 su personalidad: cómo habla y se expresa. No menciona ningún negocio.
     · negocio-<nombre>.md     lo del negocio (datos, voz de marca, cómo se dice, y el índice de playbooks).
                               Propiedad ALMA_NEGOCIO (por defecto spacio-am): cambiándola, Alma trabaja para otro negocio.
     · <departamento>.md       operaciones, huespedes, correos… y cada app: Alma abre el que toca (leer_playbook).
   Se leen con caché de 6 h; si la página no responde, se usa la última copia buena (y si no hay, una mínima). */
var PLAYBOOKS_URL_ = 'https://hub.spacioam.com/playbooks/';
var ALMA_PERSONA_MIN_ = '# Alma\nEres Alma, la asistente de {dueño} en {negocio}: cálida, tranquila, segura y resolutiva. Hablas simple, en frases cortas, de tú; ' +
  'nunca susurras ni narras tus herramientas; actúas en vez de preguntar y nunca inventas un dato.';

function playbookLeer_(nombre) {
  nombre = String(nombre || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!nombre) return '';
  var c = CacheService.getScriptCache(), k = 'pb_' + nombre, v = c.get(k); if (v != null) return v;
  var p = PropertiesService.getScriptProperties(), txt = '';
  try {
    var r = UrlFetchApp.fetch((p.getProperty('PLAYBOOKS_URL') || PLAYBOOKS_URL_) + nombre + '.md', { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() === 200) txt = r.getContentText();
  } catch (e) { console.error('playbook ' + nombre + ': ' + e); }
  if (txt) { try { if (txt.length < 8500) p.setProperty('PB_' + nombre, txt); } catch (e) {} }
  else txt = p.getProperty('PB_' + nombre) || '';
  try { c.put(k, txt, txt ? 21600 : 600); } catch (e) {}
  return txt;
}
function almaNegocio_() { return String(PropertiesService.getScriptProperties().getProperty('ALMA_NEGOCIO') || 'spacio-am').toLowerCase(); }
/* Los datos del negocio («- clave: valor» bajo «## Datos»). */
function negocioDatos_() {
  var md = playbookLeer_('negocio-' + almaNegocio_()), out = {}, i = md.indexOf('## Datos');
  if (i >= 0) md.slice(i).split('\n## ')[0].split('\n').forEach(function (l) { var m = l.match(/^- ([^:]+):\s*(.+)$/); if (m) out[m[1].trim()] = m[2].trim(); });
  return out;
}
/* La personalidad de Alma para un canal ('texto' sin la sección de voz, 'voz' completa), con el negocio puesto. */
function almaPersona_(canal, o) {
  o = o || {};
  var d = negocioDatos_(), md = playbookLeer_('alma') || ALMA_PERSONA_MIN_;
  if (canal === 'texto') md = md.replace(/\n## Por voz[\s\S]*?(?=\n## )/, '\n');
  md = md.replace(/^> .*\n/m, '').replace(/\{negocio\}/g, o.negocio || d.negocio || 'el negocio').replace(/\{dueño\}/g, o.dueño || d['dueño'] || 'el dueño');
  return '═══ PERSONALIDAD DE ALMA (playbook alma; prevalece en cómo hablas) ═══\n' + md.trim();
}
/* Lo del negocio: sus datos y el índice de playbooks (Alma abre el que toca con leer_playbook). */
function negocioBloque_() {
  var md = playbookLeer_('negocio-' + almaNegocio_()); if (!md) return '';
  return '═══ EL NEGOCIO (playbook negocio-' + almaNegocio_() + ') ═══\n' + md.replace(/^> .*\n/m, '').trim() +
    '\nAntes de un trabajo de un departamento (o si no sabes bien cómo se hace algo), abre su playbook con leer_playbook y síguelo.';
}
/* Para la herramienta leer_playbook: el .md más lo que el dueño agregó (reglas) y lo que ya aprobó (caja). */
function leerPlaybookTool_(nombre) {
  nombre = String(nombre || '').toLowerCase().trim();
  var md = playbookLeer_(nombre); if (!md) return { ok: false, error: 'No existe el playbook «' + nombre + '». Mira el índice en el playbook del negocio.' };
  var a = null; try { a = agentes_().filter(function (x) { return x.id === nombre || (x.app && AG_DEV_PLAYBOOK_[x.app] === nombre); })[0] || null; } catch (e) {}
  return { ok: true, playbook: md.slice(0, 9000), reglas_del_dueño: a && a.reglas || '', ya_aprobado: a && a.caja || '' };
}
