/* ═══ MODO CONFERENCIA (app de Alma: el botón entre Ajustes y la roca del inicio) ═══════════════════════════════
   Un solo modo, inteligente. La app transcribe en el iPhone (gratis) y manda el texto por tramos (acción «conferencia»,
   que: trozo | fin). Mientras, graba el audio en el teléfono, en partes de 5 min, sin mandarlo.
     · Con los primeros minutos, Alma decide quién habla (confModo_): una sola persona → «dictado» (se queda el texto del
       iPhone y la app borra el audio sin subirlo); varias → «reunion»: la app sube las partes (conferenciaAudio) y
       ElevenLabs Scribe las transcribe distinguiendo las voces (cuesta, pero sabe quién dijo qué).
     · Al terminar (o a los 20 min sin tramos), Alma la clasifica como todo lo que recibe: tipo (reunión, conferencia,
       llamada o memo), esfera, proyecto, resumen, acuerdos y lo que le toca a Juan; la deja en Pendientes y guardada en
       ALMA_CONFERENCIAS. El audio se borra en cuanto se transcribe. */
var CONF_CAB_ = ['id', 'email', 'inicio', 'actualizado', 'estado', 'texto', 'tipo', 'area', 'proyecto', 'titulo', 'resumen', 'acuerdos', 'para_juan', 'modo', 'partes'];
var CONFA_CAB_ = ['id', 'n', 'archivo', 'estado', 'texto', 'ts'];
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
  var texto = String(b.texto || '').trim(), ahora = new Date().toISOString(), antes = 0;
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  var c;
  try {
    var sh = hojaConf_(); c = confFila_(id);
    if (!c) {
      c = { id: id, email: adm.email, inicio: String(b.inicio || ahora), actualizado: ahora, estado: 'abierta', texto: texto.slice(0, CONF_MAX_) };
      sh.appendRow(CONF_CAB_.map(function (k) { return c[k] != null ? c[k] : ''; })); c = confFila_(id);
    } else if (texto && c.estado === 'abierta') {
      antes = String(c.texto || '').length;
      var junto = (String(c.texto || '') + '\n' + texto).trim();
      sh.getRange(c.fila, CONF_CAB_.indexOf('texto') + 1, 1, 1).setValue(junto.slice(-CONF_MAX_));   // si se pasa, queda lo último
      sh.getRange(c.fila, CONF_CAB_.indexOf('actualizado') + 1).setValue(ahora);
      c.texto = junto.slice(-CONF_MAX_);
    }
  } finally { lock.releaseLock(); }
  /* ¿Una persona o varias? Se decide con los primeros ~500 caracteres y se revisa cada ~3.000 mientras siga en dictado. */
  var modo = String(c && c.modo || '');
  if (c && c.estado === 'abierta' && modo !== 'reunion') {
    var largo = String(c.texto || '').length;
    if ((!modo && largo >= 500) || (modo === 'dictado' && Math.floor(largo / 3000) > Math.floor(antes / 3000))) {
      modo = confModo_(String(c.texto)); hojaConf_().getRange(c.fila, CONF_CAB_.indexOf('modo') + 1).setValue(modo);
    }
  }
  if (b.que === 'fin' && c && c.estado === 'abierta') {
    var partes = Number(b.partes) || 0;
    if (modo === 'reunion' && partes) {   // espera a que Scribe transcriba las partes (confCerrarViejas_)
      hojaConf_().getRange(c.fila, CONF_CAB_.indexOf('estado') + 1).setValue('esperando');
      hojaConf_().getRange(c.fila, CONF_CAB_.indexOf('partes') + 1).setValue(partes);
    } else { try { confCerrar_(c, adm); } catch (e) { console.error('confCerrar_: ' + e); } }
  }
  return { ok: true, modo: modo || 'dictado' };
}
function confModo_(txt) {
  try {
    var t = String(claude_(CFG.MODELO_CLASIFICADOR, 60, 'Te paso la transcripción automática (sin nombres de quién habla) del inicio de una grabación. ¿Habla UNA sola persona (dictado, nota de voz, alguien pensando en voz alta o hablando por teléfono del que solo se oye un lado) o es una conversación entre VARIAS personas presentes (reunión, conferencia, varias voces que se responden)? Responde SOLO «una» o «varias».', String(txt).slice(-4000), 0) || '').toLowerCase();
    return /varias/.test(t) ? 'reunion' : 'dictado';
  } catch (e) { return 'dictado'; }
}

/* ── Reunión: el audio por partes → ElevenLabs Scribe con voces separadas ── */
function hojaConfA_() { return hojaCrear_('ALMA_CONF_AUDIO', CONFA_CAB_); }
function confCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('CONF_CARPETA');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('ALMA · Audio de reuniones (se borra al transcribir)'); p.setProperty('CONF_CARPETA', f.getId()); return f;
}
function conferenciaAudio_(ses, b) {
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  var id = String(b.id || '').replace(/[^\w-]/g, '').slice(0, 40), n = Number(b.n) || 0; if (!id || !b.audio) return { ok: false, error: 'Falta el audio.' };
  var blob = Utilities.newBlob(Utilities.base64Decode(String(b.audio)), String(b.mime || 'audio/mp4'), id + '-' + n + '.m4a');
  var f = confCarpeta_().createFile(blob);
  hojaConfA_().appendRow([id, n, f.getId(), 'pendiente', '', new Date().toISOString()]);
  return { ok: true };
}
/* procesarCola: transcribe hasta 2 partes por vuelta (cada parte de 5 min tarda unos segundos) y borra su audio. */
function confAudioProcesar_() {
  var sh = hojaConfA_(), n = sh.getLastRow(); if (n < 2) return;
  var key = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY'); if (!key) return;
  var v = sh.getRange(2, 1, n - 1, CONFA_CAB_.length).getValues(), hechas = 0;
  for (var i = 0; i < v.length && hechas < 2; i++) {
    if (String(v[i][3]) !== 'pendiente') continue; hechas++;
    var fila = i + 2, texto = '', estado = 'listo';
    try {
      var f = DriveApp.getFileById(String(v[i][2]));
      var r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'post', muteHttpExceptions: true, headers: { 'xi-api-key': key },
        payload: { model_id: 'scribe_v1', diarize: 'true', language_code: 'spa', file: f.getBlob() } });
      var j = JSON.parse(r.getContentText() || '{}');
      if (r.getResponseCode() !== 200) throw new Error(r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
      texto = confVoces_(j, Number(v[i][1]));
      try { registrarUso_({ app: 'ALMA', funcion: 'Modo conferencia · Scribe', modelo: 'elevenlabs-scribe', usage: {}, minutos: 5, ok: true }); } catch (e) {}
      f.setTrashed(true);   // el audio no se guarda
    } catch (e) { console.error('confAudioProcesar_: ' + e); estado = 'error'; texto = String(e).slice(0, 200); }
    sh.getRange(fila, 4, 1, 2).setValues([[estado, texto.slice(0, 45000)]]);
  }
}
/* Las palabras de Scribe, juntas por quién habla: «[parte 2 · 03:15] Persona 1: …». */
function confVoces_(j, n) {
  var out = [], cur = null;
  (j.words || []).forEach(function (w) {
    if (w.type === 'audio_event') return;
    var sp = String(w.speaker_id || 'speaker_0').replace(/\D/g, '');
    if (!cur || cur.sp !== sp) { if (cur) out.push(cur); cur = { sp: sp, t: Number(w.start) || 0, x: '' }; }
    cur.x += w.text;
  });
  if (cur) out.push(cur);
  return out.filter(function (u) { return u.x.trim(); }).map(function (u) {
    var m = Math.floor(u.t / 60), sgs = Math.floor(u.t % 60);
    return '[parte ' + (n + 1) + ' · ' + (m < 10 ? '0' : '') + m + ':' + (sgs < 10 ? '0' : '') + sgs + '] Persona ' + (Number(u.sp) + 1) + ': ' + u.x.trim();
  }).join('\n') || String(j.text || '');
}
/* Lo que Scribe transcribió de una reunión, en orden; null si todavía faltan partes. */
function confTextoVoces_(id, partes, forzar) {
  var sh = hojaConfA_(), n = sh.getLastRow(); if (n < 2) return null;
  var mias = sh.getRange(2, 1, n - 1, CONFA_CAB_.length).getValues().filter(function (r) { return String(r[0]) === String(id); });
  var listas = mias.filter(function (r) { return r[3] === 'listo' || r[3] === 'error'; });
  if (!forzar && (listas.length < partes || listas.length < mias.length)) return null;
  var buenas = listas.filter(function (r) { return r[3] === 'listo'; }).sort(function (a, b) { return a[1] - b[1]; });
  return buenas.length ? buenas.map(function (r) { return r[4]; }).join('\n') : '';
}

/* Respaldo (procesarCola): las que quedaron abiertas 20 min sin tramos se cierran solas (la app se apagó o perdió red). */
function confCerrarViejas_() {
  var sh = hojaConf_(), n = sh.getLastRow(); if (n < 2) return;
  var ini = Math.max(2, n - 49), v = sh.getRange(ini, 1, n - ini + 1, CONF_CAB_.length).getValues();
  v.forEach(function (r, i) {
    var o = { fila: ini + i }; CONF_CAB_.forEach(function (k, j) { o[k] = r[j]; });
    var quieta = Date.now() - new Date(String(r[3])).getTime();
    try {
      if (String(r[4]) === 'esperando') {   // reunión: cuando Scribe terminó todas las partes (o pasaron 40 min), se cierra con las voces
        var voces = confTextoVoces_(o.id, Number(o.partes) || 0, quieta > 40 * 60000);
        if (voces != null) confCerrar_(o, adminPorEmail_(String(r[1])), voces);
      } else if (String(r[4]) === 'abierta' && quieta > 20 * 60000) confCerrar_(o, adminPorEmail_(String(r[1])));
    } catch (e) { console.error('confCerrarViejas_: ' + e); }
  });
}

function confCerrar_(c, adm, voces) {
  var sh = hojaConf_(); sh.getRange(c.fila, CONF_CAB_.indexOf('estado') + 1).setValue('cerrando');
  var txt = String(voces || c.texto || '').trim();   // en reunión, la de Scribe (con quién habla); si no, la del iPhone
  if (txt.length < 40 || !adm) { sh.getRange(c.fila, CONF_CAB_.indexOf('estado') + 1).setValue('vacía'); return; }
  var proys = []; try { proys = proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }).map(function (p) { return p.proyecto; }).slice(0, 30); } catch (e) {}
  var sys = 'Eres Alma, la asistente de Juan (dueño de Spacio AM, apartamentos de estadía corta en Guatemala). Escuchaste en silencio una reunión, una conferencia, una llamada o un memo de voz; ' +
    'abajo está la transcripción automática (puede tener errores en nombres; corrígelos por contexto; si dice «Persona 1, Persona 2…», deduce quién es cada uno por lo que dicen y usa su nombre si se sabe). Ignora lo que no tenga que ver (charla, pruebas de micrófono, ruido).\n' +
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
