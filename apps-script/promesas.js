/* ═══ PROMESAS RASTREABLES ═══════════════════════════════════════════════════════════════════
   Cuando ALMA le promete algo a alguien («el equipo te escribe por WhatsApp», «lo confirmo y te aviso»), por chat,
   WhatsApp o llamada, queda un pendiente en ALMA_PROMESAS, se avisa al equipo de turno y el Hub lo muestra en la
   conversación. Se cierra solo cuando alguien del equipo le escribe a esa conversación desde el Hub, o a mano.
   Si vence sin cumplirse, se vuelve a avisar una vez.  Hooks: log_ (texto), vozPostCall_ (llamadas),
   hubResponder_ / hubResponderWa_ (cumplir), procesarCola (vencidas). */
var PROM_CAB_ = ['id', 'creada', 'conv_id', 'huesped', 'propiedad', 'canal', 'que', 'vence', 'estado', 'origen', 'texto', 'avisos', 'cerrada_por', 'cerrada_ts'];
var PROM_RX_ = /(te (escrib|contact|llam|confirm|avis|envi|mand|respond|comparto|paso)|le (escrib|contact|llam|confirm|avis)|(el|nuestro|alguien del) equipo (te|le|lo|se|va)|lo (confirmo|reviso|consulto|verifico|reviso) con|lo (dejo|dejamos) anotado|te (lo )?(hago|haremos|hacemos) saber|te (escribimos|enviamos|confirmamos|avisamos|llamamos)|por (whatsapp|aquí mismo|este (chat|medio))[^.]{0,40}(te|le) |we('ll| will) (get back|contact|send|write|confirm|let you know)|someone (will|from our team)|our team will)/i;

function hojaProm_() { return hojaCrear_('ALMA_PROMESAS', PROM_CAB_); }

function promFilas_() {
  var sh = hojaProm_(), n = sh.getLastRow(); if (n < 2) return { sh: sh, filas: [] };
  var v = sh.getRange(2, 1, n - 1, PROM_CAB_.length).getValues();
  return { sh: sh, filas: v.map(function (r, i) { var o = { fila: i + 2 }; PROM_CAB_.forEach(function (k, j) { o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j] == null ? '' : r[j]); }); return o; }) };
}

/* ¿El texto promete un contacto o acción futura del equipo? Filtro barato (regex) y luego confirmación con el modelo pequeño. */
function promesaDetectar_(texto, contexto) {
  texto = String(texto || ''); if (!PROM_RX_.test(texto)) return null;
  var sys = 'Analizas un mensaje que ALMA (asistente de Spacio AM, alojamientos) le dijo a un huésped o contacto. Decide si ALMA PROMETIÓ una acción futura del equipo o un contacto posterior ' +
    '(escribirle, llamarle, confirmarle algo, enviarle algo, revisar algo y avisarle). No es promesa: dar información, pedir un dato, decir que algo llega automáticamente por la plataforma, ' +
    'o recordar algo ya enviado. Devuelve SOLO JSON: {"promesa":true|false,"que":"qué se prometió, en una frase corta en español","canal":"whatsapp|plataforma|llamada|correo|sin_definir","horas":número de horas en que debería cumplirse (usa 1 si dice «en unos minutos», 2 si no dice plazo, 24 si dice «mañana»)}';
  var r = '';
  try { r = String(claude_(CFG.MODELO_CLASIFICADOR, 200, sys, (contexto ? 'CONTEXTO: ' + String(contexto).slice(0, 600) + '\n\n' : '') + 'MENSAJE DE ALMA:\n' + texto.slice(0, 2500), 0) || ''); } catch (e) { console.error('promesaDetectar_: ' + e); return null; }
  var m = r.match(/\{[\s\S]*\}/); if (!m) return null;
  try { var j = JSON.parse(m[0]); return j && j.promesa ? { que: String(j.que || '').slice(0, 300), canal: String(j.canal || 'sin_definir'), horas: Math.max(0.25, Math.min(72, Number(j.horas) || 2)) } : null; } catch (e) { return null; }
}

/* Registra la promesa (una por conversación y tema en 30 min), la marca en el inbox y avisa al equipo de turno. */
function promesaRegistrar_(c, texto, origen) {
  c = c || {}; var convId = String(c.resId || c.conv_id || ''); if (!convId || /^op:/.test(convId)) return null;
  var p = promesaDetectar_(texto, c.texto || c.pregunta || ''); if (!p) return null;
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) {}
  try {
    var d = promFilas_(), ahora = Date.now();
    if (d.filas.some(function (f) { return f.conv_id === convId && f.estado === 'abierta' && ahora - Date.parse(f.creada) < 30 * 60000; })) return null;
    var vence = new Date(ahora + p.horas * 3600000).toISOString(), id = 'pr' + ahora + Math.floor(Math.random() * 1000);
    d.sh.appendRow([id, new Date(ahora).toISOString(), convId, c.huesped || '', c.propiedad || '', p.canal, p.que, vence, 'abierta', origen || 'texto', String(texto).slice(0, 1500), 1, '', '']);
    try { inboxUpsert_(convId, { promesa: p.que, promesa_vence: vence, promesa_id: id, promesa_estado: 'abierta' }); } catch (e) {}
    var donde = (c.huesped || 'Huésped') + (c.propiedad ? ' · ' + c.propiedad : '');
    var canalTxt = { whatsapp: 'por WhatsApp', plataforma: 'por la plataforma', llamada: 'por llamada', correo: 'por correo' }[p.canal] || '';
    try {
      escalar_('ALMA prometió algo · ' + donde,
        'ALMA le dijo a ' + donde + ' que el equipo ' + (canalTxt ? 'le respondería ' + canalTxt : 'haría seguimiento') + '.\n\nQué se prometió: ' + p.que +
        '\nPlazo: ' + Utilities.formatDate(new Date(vence), CFG.TZ, 'dd MMM HH:mm') + ' (hora Guatemala)\n\nÁbrelo en el Hub y respóndele desde ahí: la promesa se cierra sola.\nhttps://hub.spacioam.com/');
    } catch (e) { console.error('promesa aviso: ' + e); }
    return { id: id, que: p.que, vence: vence };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* El equipo le escribió a esa conversación: se cumplen sus promesas abiertas. */
function promesasCumplir_(convId, quien, motivo) {
  convId = String(convId || ''); if (!convId) return 0;
  var d = promFilas_(), n = 0, ts = new Date().toISOString();
  d.filas.forEach(function (f) {
    if (f.conv_id !== convId || (f.estado !== 'abierta' && f.estado !== 'vencida')) return;
    d.sh.getRange(f.fila, PROM_CAB_.indexOf('estado') + 1, 1, 1).setValue('cumplida');
    d.sh.getRange(f.fila, PROM_CAB_.indexOf('cerrada_por') + 1, 1, 2).setValues([[String(quien || motivo || 'equipo').slice(0, 80), ts]]);
    n++;
  });
  if (n) { try { inboxUpsert_(convId, { promesa_estado: 'cumplida' }); } catch (e) {} }
  return n;
}

/* Revisión periódica (procesarCola): las vencidas avisan una segunda vez y quedan marcadas. */
function promesasRevisar_() {
  var c = CacheService.getScriptCache(); if (c.get('prom_rev')) return; c.put('prom_rev', '1', 600);
  var d = promFilas_(), ahora = Date.now();
  d.filas.forEach(function (f) {
    if (f.estado !== 'abierta' || !(Date.parse(f.vence) < ahora)) return;
    d.sh.getRange(f.fila, PROM_CAB_.indexOf('estado') + 1).setValue('vencida');
    d.sh.getRange(f.fila, PROM_CAB_.indexOf('avisos') + 1).setValue(Number(f.avisos || 1) + 1);
    try { inboxUpsert_(f.conv_id, { promesa: f.que, promesa_vence: f.vence, promesa_id: f.id, promesa_estado: 'vencida' }); } catch (e) {}
    try { escalar_('Promesa vencida · ' + (f.huesped || 'Huésped'), 'Sigue pendiente lo que ALMA le prometió a ' + (f.huesped || 'un huésped') + (f.propiedad ? ' (' + f.propiedad + ')' : '') + ':\n\n' + f.que + '\n\nVenció ' + Utilities.formatDate(new Date(f.vence), CFG.TZ, 'dd MMM HH:mm') + '. Respóndele desde el Hub.\nhttps://hub.spacioam.com/'); } catch (e) {}
  });
}

/* Hub: lista de promesas (abiertas y vencidas por defecto) y cierre manual. */
function hubPromesas_(todas) {
  var f = promFilas_().filas.filter(function (x) { return todas || x.estado === 'abierta' || x.estado === 'vencida'; });
  return { ok: true, promesas: f.slice(-200).reverse().map(function (x) { return { id: x.id, creada: x.creada, conv_id: x.conv_id, huesped: x.huesped, propiedad: x.propiedad, canal: x.canal, que: x.que, vence: x.vence, estado: x.estado, origen: x.origen }; }) };
}
function hubPromesaCerrar_(id, quien) {
  var d = promFilas_(), f = d.filas.filter(function (x) { return x.id === String(id); })[0]; if (!f) return { ok: false, error: 'no existe' };
  d.sh.getRange(f.fila, PROM_CAB_.indexOf('estado') + 1).setValue('cumplida');
  d.sh.getRange(f.fila, PROM_CAB_.indexOf('cerrada_por') + 1, 1, 2).setValues([[String(quien || 'equipo').slice(0, 80) + ' (a mano)', new Date().toISOString()]]);
  if (!d.filas.some(function (x) { return x.id !== f.id && x.conv_id === f.conv_id && (x.estado === 'abierta' || x.estado === 'vencida'); })) { try { inboxUpsert_(f.conv_id, { promesa_estado: 'cumplida' }); } catch (e) {} }
  return { ok: true };
}
