/* ═══ MODO CONFERENCIA (app de Alma) ════════════════════════════════════════════════════════════════════════
   La app escucha una reunión, una conferencia o una llamada y transcribe en el iPhone (sin ElevenLabs: los silencios no
   cuestan). Manda el texto por tramos (acción «conferencia», que: trozo | fin). Al terminar (o a los 20 min sin tramos),
   Alma la clasifica como todo lo que recibe: tipo (reunión, conferencia, llamada o memo), esfera, proyecto, resumen,
   acuerdos y lo que le toca a Juan; la deja en Pendientes y guardada en ALMA_CONFERENCIAS. No se guarda audio. */
var CONF_CAB_ = ['id', 'email', 'inicio', 'actualizado', 'estado', 'texto', 'tipo', 'area', 'proyecto', 'titulo', 'resumen', 'acuerdos', 'para_juan'];
var CONF_MAX_ = 45000;   // caracteres por celda (Sheets admite 50.000)

function hojaConf_() {
  var sh = hojaCrear_('ALMA_CONFERENCIAS', CONF_CAB_);
  if (sh.getLastColumn() < CONF_CAB_.length) sh.getRange(1, 1, 1, CONF_CAB_.length).setValues([CONF_CAB_]);
  return sh;
}
function confFila_(id) {
  var sh = hojaConf_(), n = sh.getLastRow(); if (n < 2) return null;
  var ini = Math.max(2, n - 199), v = sh.getRange(ini, 1, n - ini + 1, CONF_CAB_.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === String(id)) { var o = { fila: ini + i }; CONF_CAB_.forEach(function (k, j) { o[k] = v[i][j]; }); return o; }
  return null;
}

function conferencia_(ses, b) {
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  var id = String(b.id || '').replace(/[^\w-]/g, '').slice(0, 40); if (!id) return { ok: false, error: 'Falta el id.' };
  var texto = String(b.texto || '').trim(), ahora = new Date().toISOString();
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  var c;
  try {
    var sh = hojaConf_(); c = confFila_(id);
    if (!c) {
      c = { id: id, email: adm.email, inicio: String(b.inicio || ahora), actualizado: ahora, estado: 'abierta', texto: texto.slice(0, CONF_MAX_) };
      sh.appendRow(CONF_CAB_.map(function (k) { return c[k] != null ? c[k] : ''; })); c = confFila_(id);
    } else if (texto && c.estado === 'abierta') {
      var junto = (String(c.texto || '') + '\n' + texto).trim();
      sh.getRange(c.fila, CONF_CAB_.indexOf('texto') + 1, 1, 1).setValue(junto.slice(-CONF_MAX_));   // si se pasa, queda lo último
      sh.getRange(c.fila, CONF_CAB_.indexOf('actualizado') + 1).setValue(ahora);
      c.texto = junto.slice(-CONF_MAX_);
    }
  } finally { lock.releaseLock(); }
  if (b.que === 'fin' && c && c.estado === 'abierta') { try { confCerrar_(c, adm); } catch (e) { console.error('confCerrar_: ' + e); } }
  return { ok: true };
}

/* Respaldo (procesarCola): las que quedaron abiertas 20 min sin tramos se cierran solas (la app se apagó o perdió red). */
function confCerrarViejas_() {
  var sh = hojaConf_(), n = sh.getLastRow(); if (n < 2) return;
  var ini = Math.max(2, n - 49), v = sh.getRange(ini, 1, n - ini + 1, CONF_CAB_.length).getValues();
  v.forEach(function (r, i) {
    if (String(r[4]) !== 'abierta' || Date.now() - new Date(String(r[3])).getTime() < 20 * 60000) return;
    var o = { fila: ini + i }; CONF_CAB_.forEach(function (k, j) { o[k] = r[j]; });
    try { confCerrar_(o, adminPorEmail_(String(r[1]))); } catch (e) { console.error('confCerrarViejas_: ' + e); }
  });
}

function confCerrar_(c, adm) {
  var sh = hojaConf_(); sh.getRange(c.fila, CONF_CAB_.indexOf('estado') + 1).setValue('cerrando');
  var txt = String(c.texto || '').trim();
  if (txt.length < 40 || !adm) { sh.getRange(c.fila, CONF_CAB_.indexOf('estado') + 1).setValue('vacía'); return; }
  var proys = []; try { proys = proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }).map(function (p) { return p.proyecto; }).slice(0, 30); } catch (e) {}
  var sys = 'Eres Alma, la asistente de Juan (dueño de Spacio AM, apartamentos de estadía corta en Guatemala). Escuchaste en silencio una reunión, una conferencia, una llamada o un memo de voz; ' +
    'abajo está la transcripción automática (puede tener errores en nombres; corrígelos por contexto). Ignora lo que no tenga que ver (charla, pruebas de micrófono, ruido).\n' +
    'tipo: "reunion", "conferencia", "llamada" o "memo" (si habla una sola persona para sí). area (una): proposito (trabajo, Spacio AM, apps), relaciones (familia, pareja, amigos, bodas y viajes con ellos), ' +
    'finanzas, health, comunidad, espiritualidad. proyecto: el nombre corto del proyecto; si es uno de estos, escríbelo igual: ' + (proys.join(' · ') || '(ninguno)') + '; si es de Spacio AM sin otro, «Spacio AM»; si no hay, "".\n' +
    'titulo: 3 a 7 palabras. resumen: 3 a 5 frases simples con lo importante (cifras y fechas incluidas). acuerdos: lo que se decidió, en frases cortas. para_juan: lo que le toca hacer a Juan o lo que Alma debería hacer por él (tareas concretas, con fecha si se dijo).\n' +
    'Responde SOLO JSON: {"tipo":"reunion","area":"proposito","proyecto":"","titulo":"…","resumen":"…","acuerdos":["…"],"para_juan":["…"]}';
  var j = null;
  try { var t = String(claude_(CFG.MODELO_REDACTOR, 1200, sys, 'TRANSCRIPCIÓN (con la hora de cada tramo):\n' + txt.slice(-30000), 0.2) || ''), m = /\{[\s\S]*\}/.exec(t); j = m ? JSON.parse(m[0]) : null; } catch (e) { console.error('confCerrar_ claude: ' + e); }
  j = j || { tipo: 'reunion', area: 'proposito', proyecto: '', titulo: 'Reunión del ' + Utilities.formatDate(new Date(), CFG.TZ, 'd MMM'), resumen: txt.slice(0, 400), acuerdos: [], para_juan: [] };
  if (!areaOk_(j.area)) j.area = 'proposito';
  var ac = (j.acuerdos || []).map(String).slice(0, 12), pj = (j.para_juan || []).map(String).slice(0, 12);
  var TIPO = { reunion: 'Reunión', conferencia: 'Conferencia', llamada: 'Llamada', memo: 'Memo' }[j.tipo] || 'Reunión';
  sh.getRange(c.fila, CONF_CAB_.indexOf('estado') + 1, 1, 9).setValues([['cerrada', txt.slice(-CONF_MAX_), TIPO, j.area, String(j.proyecto || ''), String(j.titulo || ''), String(j.resumen || ''), ac.join(' · '), pj.join(' · ')]]);
  /* A Pendientes, como todo lo que Alma recibe: con su esfera y proyecto. Si le toca algo a Juan, se queda hasta resolverse. */
  var detalle = TIPO + ' · ' + j.titulo + '\n\n' + j.resumen + (ac.length ? '\n\nAcuerdos:\n· ' + ac.join('\n· ') : '') + (pj.length ? '\n\nPara ti:\n· ' + pj.join('\n· ') : '');
  pendAvisar_(adm, detalle, { origen: 'conferencia', push: pj.length > 0, clasif: { tipo: pj.length ? 'atencion' : 'aviso', area: j.area, proyecto: String(j.proyecto || ''),
    titulo: TIPO + ' · ' + String(j.titulo || ''), resumen: pj.length ? 'Te toca: ' + pj.slice(0, 2).join('; ') : String(j.resumen || '').slice(0, 220),
    aviso: 'Te dejé el resumen de la ' + TIPO.toLowerCase() + ' en Pendientes' + (pj.length ? ', con ' + pj.length + (pj.length === 1 ? ' cosa' : ' cosas') + ' para ti.' : '.'), importancia: pj.length ? 2 : 1, tarjeta: null, acciones: [] } });
}

/* Para Alma (buscar_reuniones): las reuniones guardadas que coinciden con lo que busca (título, proyecto, resumen, texto). */
function confBuscar_(q, n) {
  var sh = hojaConf_(), filas = sh.getLastRow(); if (filas < 2) return [];
  var v = sh.getRange(Math.max(2, filas - 199), 1, Math.min(200, filas - 1), CONF_CAB_.length).getValues().filter(function (r) { return String(r[4]) === 'cerrada'; });
  var pal = String(q || '').toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
  return v.reverse().filter(function (r) { var t = (r[9] + ' ' + r[8] + ' ' + r[10] + ' ' + r[5]).toLowerCase(); return !pal.length || pal.every(function (w) { return t.indexOf(w) >= 0; }); })
    .slice(0, n || 5).map(function (r) { return { fecha: String(r[2]).slice(0, 16).replace('T', ' '), tipo: r[6], esfera: r[7], proyecto: r[8], titulo: r[9], resumen: r[10], acuerdos: r[11], para_juan: r[12] }; });
}
