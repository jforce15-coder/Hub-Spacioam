/* ═══ PLAYBOOKS: UN SOLO AGENTE, UN PLAYBOOK POR TRABAJO ════════════════════════════════════════════════════
   Lección «AI delegation»: en vez de muchos agentes cableados o un cerebro gigante, UN agente (Alma) con un playbook
   por trabajo. Los playbooks son los .md de playbooks/ en el repo del Hub (una sola fuente, con historial), publicados
   en hub.spacioam.com/playbooks/:
     · alma.json               la fuente única de Alma (quién es, audiencias, canales, confirmaciones): no se lee por
                               red, viaja con el código (tools/alma-fuente.js → almafuente.js) y la arma almaPrompt_.
     · negocio-<nombre>.md     lo del negocio (datos, voz de marca, cómo se dice, y el índice de playbooks).
                               Propiedad ALMA_NEGOCIO (por defecto spacio-am): cambiándola, Alma trabaja para otro negocio.
     · <departamento>.md       operaciones, huespedes, correos… y cada app: Alma abre el que toca (leer_playbook).
   Se leen con caché de 6 h; si la página no responde, se usa la última copia buena (y si no hay, una mínima). */
var PLAYBOOKS_URL_ = 'https://hub.spacioam.com/playbooks/';

function playbookLeer_(nombre) {
  nombre = String(nombre || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!nombre) return '';
  var c = CacheService.getScriptCache(), k = 'pb6_' + nombre   /* pb6: cambia la clave cuando un playbook debe llegar ya (no esperar 6 h) */, v = c.get(k); if (v != null) return v;
  var p = PropertiesService.getScriptProperties(), txt = '';
  try {
    var r = uf_((p.getProperty('PLAYBOOKS_URL') || PLAYBOOKS_URL_) + nombre + '.md', { muteHttpExceptions: true, followRedirects: true });
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
/* ═══ FUENTE ÚNICA DE ALMA (playbooks/alma.json → almafuente.js; decisión de Juan, 3-nov-2026) ═══════════════════
   Cada regla vive una sola vez en el JSON. almaPrompt_ la convierte en texto limpio para un canal y una audiencia
   (el modelo nunca ve el JSON). Reemplaza alma.md, AUDIENCIAS_, AGENTE_MI_SISTEMA_, VOZ_HUMANA y VOZ CLARA.
   canal: 'voz' | 'chat' | 'whatsapp' | 'calle' (cada uno hereda de otro: calle → voz → base; whatsapp → chat → base).
   audiencia: 'principal' | 'equipo' | 'asociado' | 'familia' | 'huesped' | 'externo', o 'todas' (la voz: según caller_type).
   o: { negocio, dueño, sinEjemplos, sinHerramientas, sinIdentidad }. */
function almaRellenar_(t, o) {
  var d = {}; try { d = negocioDatos_(); } catch (e) {}
  return String(t || '').replace(/\{negocio\}/g, o.negocio || d.negocio || 'Spacio AM').replace(/\{dueño\}/g, o['dueño'] || d['dueño'] || 'Juan');
}
/* Las reglas de un canal con las de los canales que hereda (primero las más generales). */
function almaCanalReglas_(canal) {
  var C = ALMA_FUENTE_.canales, cadena = [], k = canal, vistos = {};
  while (k && C[k] && !vistos[k]) { vistos[k] = 1; cadena.unshift(C[k]); k = C[k].hereda; }
  var out = []; cadena.forEach(function (c) { (c.reglas || []).forEach(function (r) { out.push(r.texto); }); });
  return { titulo: (C[canal] || {}).titulo || canal, reglas: out };
}
function almaPrompt_(canal, audiencia, o) {
  o = o || {}; canal = ALMA_FUENTE_.canales[canal] ? canal : 'chat';
  var A = ALMA_FUENTE_, L = [], r = function (t) { return almaRellenar_(t, o); }, linea = function (t) { L.push('· ' + r(t)); };
  var esVoz = canal === 'voz' || canal === 'calle';
  if (!o.sinIdentidad) {
    L.push('QUIÉN ERES', r(A.identidad.quien) + ' ' + r(A.identidad.caracter));
    A.identidad.como_habla.forEach(function (x) { linea(x.texto); });
    linea(A.identidad.si_preguntan_si_eres_persona);
  }
  L.push('', A.prioridad.titulo.toUpperCase());
  A.prioridad.orden.forEach(function (x, i) { L.push((i + 1) + '. ' + r(x.texto)); });
  L.push('', 'CON QUIÉN HABLAS');
  var auds = audiencia === 'todas' ? Object.keys(A.audiencias) : [A.audiencias[audiencia] ? audiencia : 'externo'];
  auds.forEach(function (k) {
    var a = A.audiencias[k];
    if (audiencia === 'todas') { if (k === 'externo') return; L.push('caller_type ' + a.caller_type + (k === 'huesped' ? ' (huésped o persona sin relación)' : '') + ' → ' + r(a.quien)); }
    else L.push(r(a.quien));
    a.reglas.forEach(function (x) { linea(x.texto); });
  });
  L.push('', A.confirmaciones.titulo.toUpperCase());
  A.confirmaciones.reglas.forEach(function (x) { linea(x.texto); });
  var c = almaCanalReglas_(canal);
  L.push('', c.titulo.toUpperCase()); c.reglas.forEach(linea);
  if (!o.sinHerramientas && esVoz) {
    var H = A.herramientas.lista, hs = Object.keys(H).filter(function (n) { return H[n].canales.indexOf('voz') >= 0; });
    if (hs.length) { L.push('', A.herramientas.titulo.toUpperCase()); hs.forEach(function (n) { L.push('· ' + n + ': ' + r(H[n].linea)); }); }
  }
  L.push('', A.prohibiciones.titulo.toUpperCase()); A.prohibiciones.reglas.forEach(function (x) { linea(x.texto); });
  if (!o.sinEjemplos) {
    var ej = A.ejemplos.lista.filter(function (x) { return x.canales.indexOf(esVoz ? 'voz' : canal === 'whatsapp' ? 'whatsapp' : 'chat') >= 0 || (canal === 'whatsapp' && x.canales.indexOf('chat') >= 0); });
    if (ej.length) { L.push('', A.ejemplos.titulo.toUpperCase()); ej.forEach(function (x) { L.push('· ' + r(x.caso) + ' → «' + r(x.bien) + '» (no: «' + r(x.mal) + '»)'); }); }
  }
  return '═══ ALMA ═══\n' + L.join('\n');
}
/* Una línea de identidad para los encargos sueltos (ordenar un pendiente, traducir algo para Juan, escuchar una reunión):
   lo mismo que dice el JSON, sin repetir todo el prompt. */
function almaIdentidad_(o) {
  o = o || {};
  return almaRellenar_(ALMA_FUENTE_.identidad.quien + ' ' + ALMA_FUENTE_.identidad.caracter, o) + ' ' + almaRellenar_(ALMA_FUENTE_.identidad.como_habla[0].texto, o);
}
/* Reglas de huéspedes consolidadas (playbooks/huespedes.json). En la voz, «por aquí mismo» es WhatsApp a ese número. */
function huespedesReglas_(canal) {
  var H = HUESPEDES_FUENTE_, voz = canal === 'voz';
  return '\n\n' + H.titulo + ':\n' + H.reglas.map(function (x) {
    var t = x.texto; if (voz) t = t.replace(/por aquí mismo/g, 'por WhatsApp a este mismo número');
    return '· ' + t;
  }).join('\n');
}
/* Compatibilidad: la personalidad para un canal ('texto' o 'voz'), hoy sale de la fuente única. */
function almaPersona_(canal, o) {
  return almaPrompt_(canal === 'voz' ? 'voz' : 'chat', (o && o.audiencia) || 'principal', o);
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
