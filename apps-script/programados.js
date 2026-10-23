/* ═══ MENSAJES PROGRAMADOS POR WHATSAPP ════════════════════════════════════════════════════════════════════
   «Mándale a Gabriel mañana a las 7 a. m. …»: ALMA guarda el mensaje (hoja ALMA_PROGRAMADOS) y lo envía a la hora,
   revisando cada minuto con procesarCola. Sirve para el equipo (operativo o administrativo) y para temas personales:
   · equipo   → waEnviarAlguien_ (Spacio AM; fuera de 24 h, plantilla de primer contacto y el mensaje al responder)
   · personal → personalEnviar_ («Alma, la asistente de Juan»; nunca Spacio AM)
   La hora se guarda en hora de Guatemala salvo que se indique otra zona. Si el envío falla, se le avisa a quien lo pidió. */

var PROG_CAB_ = ['id', 'creado', 'solicitante', 'persona', 'tel', 'texto', 'cuando', 'zona', 'tipo', 'estado', 'resultado', 'enviado'];
function hojaProg_() { return hojaCrear_('ALMA_PROGRAMADOS', PROG_CAB_); }

/* "2026-10-24 07:00" en la zona dada → Date */
function progFecha_(txt, zona) {
  var m = String(txt || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/); if (!m) return null;
  var tz = zona || CFG.TZ, guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // ajusta por el desfase de la zona en esa fecha (dos pasadas cubren cambios de horario)
  for (var i = 0; i < 2; i++) {
    var off = Utilities.formatDate(new Date(guess), tz, 'Z'), sg = off[0] === '-' ? -1 : 1, mins = sg * (Number(off.slice(1, 3)) * 60 + Number(off.slice(3, 5)));
    guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - mins * 60000;
  }
  return new Date(guess);
}

function progCrear_(adm, o) {
  var zona = o.zona || CFG.TZ, d = progFecha_(o.cuando, zona);
  if (!d) return { error: 'Necesito fecha y hora en formato AAAA-MM-DD HH:MM.' };
  if (d.getTime() < Date.now() - 60000) return { error: 'Esa hora ya pasó (' + Utilities.formatDate(d, zona, 'd MMM HH:mm') + ' ' + zona + ').' };
  if (d.getTime() > Date.now() + 60 * 86400000) return { error: 'Solo programo hasta 60 días adelante.' };
  var tel = normTel_(o.tel); if (!tel) return { error: 'Falta el número de WhatsApp de ' + (o.persona || 'esa persona') + '.' };
  var id = 'pg' + Date.now();
  hojaProg_().appendRow([id, new Date().toISOString(), (adm && adm.email) || '', o.persona || '', tel, String(o.texto).slice(0, 3500), d.toISOString(), zona, o.tipo === 'personal' ? 'personal' : 'equipo', 'pendiente', '', '']);
  progProximo_();
  return { ok: true, id: id, para: o.persona || '+' + tel, cuando: Utilities.formatDate(d, zona, "EEEE d 'de' MMMM, HH:mm") + ' (' + (zona === CFG.TZ ? 'hora de Guatemala' : zona) + ')',
    en_espana: Utilities.formatDate(d, 'Europe/Madrid', 'd MMM HH:mm') + ' hora de España' };
}

function progLista_(adm, todos) {
  var sh = hojaProg_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PROG_CAB_.length).getValues().filter(function (v) { return v[9] === 'pendiente' && (todos || !adm || String(v[2]) === adm.email); })
    .map(function (v) { var d = new Date(v[6]); return { id: String(v[0]), para: v[3] || '+' + v[4], cuando: Utilities.formatDate(d, String(v[7] || CFG.TZ), 'd MMM HH:mm') + (String(v[7]) === CFG.TZ ? ' GT' : ' ' + v[7]), tipo: v[8], texto: String(v[5]).slice(0, 160) }; });
}
function progCancelar_(id) {
  var sh = hojaProg_(), n = sh.getLastRow(); if (n < 2) return { error: 'No hay mensajes programados.' };
  var v = sh.getRange(2, 1, n - 1, PROG_CAB_.length).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === String(id)) {
    if (v[i][9] !== 'pendiente') return { error: 'Ese mensaje ya está ' + v[i][9] + '.' };
    sh.getRange(i + 2, 10).setValue('cancelado'); progProximo_(); return { ok: true, cancelado: v[i][3] || v[i][4] };
  }
  return { error: 'No encontré ese mensaje programado.' };
}

/* Guarda cuándo vence el próximo, para no leer la hoja cada minuto si no hay nada. */
function progProximo_() {
  var sh = hojaProg_(), n = sh.getLastRow(), prox = 0;
  if (n >= 2) sh.getRange(2, 7, n - 1, 4).getValues().forEach(function (v) { if (v[3] === 'pendiente') { var t = new Date(v[0]).getTime(); if (t && (!prox || t < prox)) prox = t; } });
  PropertiesService.getScriptProperties().setProperty('PROG_PROX', String(prox));
}

/* procesarCola (cada minuto) */
function progProcesar_() {
  var prox = Number(PropertiesService.getScriptProperties().getProperty('PROG_PROX') || 0);
  if (!prox || prox > Date.now()) return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var sh = hojaProg_(), n = sh.getLastRow(); if (n < 2) return;
    var v = sh.getRange(2, 1, n - 1, PROG_CAB_.length).getValues();
    v.forEach(function (r, i) {
      if (r[9] !== 'pendiente' || new Date(r[6]).getTime() > Date.now()) return;
      sh.getRange(i + 2, 10).setValue('enviando');
      var adm = r[2] ? adminPorEmail_(String(r[2])) : null, res;
      try {
        res = r[8] === 'personal' ? personalEnviar_(adm, String(r[3]), String(r[4]), String(r[5]))
          : waEnviarAlguien_(String(r[4]), String(r[5]), { nombre: String(r[3]), de: (adm && adm.nombre) || 'Spacio AM' });
      } catch (e) { res = { ok: false, error: String(e) }; }
      var txt = res.ok ? (res.modo === 'plantilla' ? 'enviado · primer contacto (el mensaje sale cuando responda)' : 'enviado') : ('error · ' + (res.error || ''));
      sh.getRange(i + 2, 10, 1, 3).setValues([[res.ok ? 'enviado' : 'error', txt.slice(0, 400), new Date().toISOString()]]);
      var quien = r[3] || ('+' + r[4]);
      if (adm) {
        var aviso = res.ok ? 'Mensaje programado enviado a ' + quien + (res.modo === 'plantilla' ? ' (no había escrito en 24 h: le llegó el primer contacto y el mensaje sale cuando responda).' : '.') : 'No pude enviar el mensaje programado a ' + quien + ': ' + (res.error || 'error') ;
        try { opGuardar_(adm, 'alma', 'whatsapp', aviso, [{ tipo: 'programado', resumen: (res.ok ? 'Programado enviado · ' : 'Programado falló · ') + quien, error: res.ok ? '' : (res.error || 'error') }]); } catch (e) {}
        if (!res.ok && adm.tels && adm.tels[0]) { try { waEnviar_(adm.tels[0], aviso); } catch (e) {} }
      }
    });
  } finally { try { progProximo_(); } catch (e) {} lock.releaseLock(); }
}
