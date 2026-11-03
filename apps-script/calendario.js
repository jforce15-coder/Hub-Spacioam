/* ═══ CALENDARIO DE JUAN (crear_evento, ver_agenda, mover_evento, cancelar_evento) ═══════════════════════════════
   Pedido de Juan (3-nov-2026): «Alma debe poder crear eventos en mi calendario». Solo el administrador principal.
   · Qué calendario: el predeterminado de la cuenta que corre el Hub (la web app corre como USER_DEPLOYING, igual que
     los disparadores: es la cuenta de Juan). Si la propiedad del script CALENDARIO_JUAN tiene el id de otro
     calendario, se usa ese: Juan lo comparte con la cuenta del Hub con permiso de «Hacer cambios en eventos».
   · Una sola confirmación: sin confirmado = true no se toca el calendario; se devuelve la pregunta lista («¿Lo pongo
     el jueves 5 de noviembre a las 10:00, hora de Guatemala?») y lo que choca. Con el sí de Juan, se hace.
   · Horas: «AAAA-MM-DD HH:MM» en la zona que diga Juan (Guatemala por defecto; «hora de Montana» = America/Denver),
     con progFecha_ (programados.js), que ya resuelve el desfase y el cambio de horario.
   · Invitados: solo si Juan lo pide («invítala»); entonces se agregan y Google les manda la invitación.
   · Lo que crea Alma lleva la marca «Creado por Alma» en la descripción y la etiqueta privada alma = 1: solo esos
     eventos se pueden mover o cancelar desde aquí. Los demás son de Juan y no se tocan.
   · Permiso: CalendarApp pide el permiso del calendario. Después de unir, Juan corre autorizarCalendario() una vez en el
     editor de Apps Script y lo acepta; hasta entonces Google puede frenar el script entero. */

var CALENDARIO_MARCA_ = 'Creado por Alma';
var CALENDARIO_DIAS_ = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var CALENDARIO_MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/* Cómo lo dice Juan → zona IANA. Lo que no se reconoce no se adivina: se pregunta. */
var CALENDARIO_ZONAS_ = [
  [/montana|mountain|denver|bozeman|\bmst\b|\bmdt\b|\bmt\b/, 'America/Denver'],
  [/espana|madrid/, 'Europe/Madrid'],
  [/nueva york|new york|miami|eastern|\best\b|\bedt\b|hora del este/, 'America/New_York'],
  [/pacifico|pacific|california|los angeles|\bpst\b|\bpdt\b/, 'America/Los_Angeles'],
  [/guate|\bgt\b|\bgmt-6\b/, 'America/Guatemala']
];
var CALENDARIO_NOMBRE_ZONA_ = { 'America/Guatemala': 'hora de Guatemala', 'America/Denver': 'hora de Montana', 'Europe/Madrid': 'hora de España',
  'America/New_York': 'hora de Nueva York', 'America/Los_Angeles': 'hora del Pacífico' };
var CALENDARIO_LIBRE_ = ['08:00', '19:00'];   // ver_agenda propone huecos solo en este horario (en la zona pedida)

/* Ejecútala UNA vez desde el editor de Apps Script después de unir: Google pide el permiso del calendario y en el
   registro queda en qué cuenta y en qué calendario escribe Alma. */
function autorizarCalendario() {
  var c = calendarioJuan_();
  if (c.error) { Logger.log(c.error); return c.error; }
  var txt = 'Listo: Alma escribe en el calendario «' + c.cal.getName() + '» (' + c.cal.getId() + ') con la cuenta ' + c.cuenta + '.';
  Logger.log(txt); return txt;
}

/* El calendario de Juan: CALENDARIO_JUAN si existe (compartido con la cuenta del Hub), si no el predeterminado. */
function calendarioJuan_() {
  var id = String(PropertiesService.getScriptProperties().getProperty('CALENDARIO_JUAN') || '').trim(), cuenta = '';
  try { cuenta = String(Session.getEffectiveUser().getEmail() || ''); } catch (e) {}
  if (!id) return { cal: CalendarApp.getDefaultCalendar(), cuenta: cuenta };
  var cal = CalendarApp.getCalendarById(id);
  if (!cal) { try { cal = CalendarApp.subscribeToCalendar(id); } catch (e) {} }   // compartido pero sin agregar a la lista
  if (!cal) return { error: 'No tengo acceso al calendario de CALENDARIO_JUAN (' + id + '). Juan tiene que compartirlo con ' + (cuenta || 'la cuenta del Hub') + ' con permiso de «Hacer cambios en eventos».' };
  return { cal: cal, cuenta: cuenta };
}

/* «hora de Montana», «GT», «America/Denver» → zona IANA. Vacío = Guatemala. '' si no se reconoce. */
function calendarioZona_(z) {
  var t = String(z || '').trim();
  if (!t) return CFG.TZ;
  if (/^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(t)) return t;
  var n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (var i = 0; i < CALENDARIO_ZONAS_.length; i++) if (CALENDARIO_ZONAS_[i][0].test(n)) return CALENDARIO_ZONAS_[i][1];
  return '';
}
function calendarioZonaNombre_(tz) { return CALENDARIO_NOMBRE_ZONA_[tz] || tz; }

/* Date → «jueves 5 de noviembre a las 10:00» en la zona dada (sin depender del idioma del servidor). */
function calendarioDia_(d, tz) {
  var f = Utilities.formatDate(d, tz, 'yyyy-MM-dd').split('-').map(Number);
  return CALENDARIO_DIAS_[new Date(Date.UTC(f[0], f[1] - 1, f[2])).getUTCDay()] + ' ' + f[2] + ' de ' + CALENDARIO_MESES_[f[1] - 1];
}
function calendarioHora_(d, tz) { return Utilities.formatDate(d, tz, 'HH:mm'); }
/* «el jueves 5 de noviembre a las 10:00, hora de Montana (11:00 en Guatemala)» */
function calendarioCuando_(ini, tz) {
  var t = calendarioDia_(ini, tz) + ' a las ' + calendarioHora_(ini, tz) + ', ' + calendarioZonaNombre_(tz);
  if (tz !== CFG.TZ) t += ' (' + calendarioHora_(ini, CFG.TZ) + ' en Guatemala' + (calendarioDia_(ini, CFG.TZ) !== calendarioDia_(ini, tz) ? ', ' + calendarioDia_(ini, CFG.TZ) : '') + ')';
  return t;
}
function calendarioDeAlma_(ev) {
  try { if (String(ev.getTag('alma') || '') === '1') return true; } catch (e) {}
  try { return String(ev.getDescription() || '').indexOf(CALENDARIO_MARCA_) >= 0; } catch (e) { return false; }
}
/* Lo que ya hay en el calendario entre ini y fin (para avisar choques). */
function calendarioChoques_(cal, ini, fin, tz, sinId) {
  return cal.getEvents(ini, fin).filter(function (e) { return !sinId || e.getId() !== sinId; }).map(function (e) {
    return e.isAllDayEvent() ? e.getTitle() + ' (todo el día)' : e.getTitle() + ' (' + calendarioHora_(e.getStartTime(), tz) + '–' + calendarioHora_(e.getEndTime(), tz) + ')';
  });
}
/* Final: fin explícito, o inicio + duracion_min (o la duración que ya tenía, o 60 min). */
function calendarioFin_(o, ini, tz, durMs) {
  if (o.fin) return progFecha_(o.fin, tz);
  var min = Number(o.duracion_min);
  return new Date(ini.getTime() + (min > 0 ? min * 60000 : durMs || 3600000));
}

/* Entrada única desde la secretaria (agente.js). Nunca lanza: un error de Google vuelve como { error }. */
function calendarioHerramienta_(nombre, inp) {
  try {
    if (nombre === 'crear_evento') return calendarioCrear_(inp || {});
    if (nombre === 'ver_agenda') return calendarioAgenda_(inp || {});
    if (nombre === 'mover_evento') return calendarioCambiar_(inp || {}, false);
    if (nombre === 'cancelar_evento') return calendarioCambiar_(inp || {}, true);
    return { error: 'No conozco esa herramienta del calendario.' };
  } catch (e) {
    console.error('calendario ' + nombre + ': ' + (e.stack || e));
    var permiso = /autoriz|authoriz|permis|scope/i.test(String(e));
    return { ok: false, error: permiso ? 'Todavía falta aceptar el permiso del calendario: Juan abre el editor de Apps Script y corre autorizarCalendario una vez.' : 'No pude usar el calendario: ' + String(e.message || e).slice(0, 160) };
  }
}

function calendarioCrear_(o) {
  var titulo = String(o.titulo || '').trim().slice(0, 200); if (!titulo) return { error: 'Falta el título del evento.' };
  var tz = calendarioZona_(o.zona); if (!tz) return { error: 'No reconozco la zona «' + o.zona + '». Pregúntale a Juan en qué ciudad es la hora.' };
  var ini = progFecha_(o.inicio, tz); if (!ini) return { error: 'Necesito el inicio como AAAA-MM-DD HH:MM.' };
  var fin = calendarioFin_(o, ini, tz); if (!fin || fin <= ini) return { error: 'El final tiene que ser después del inicio.' };
  if (ini.getTime() < Date.now() - 60000) return { error: 'Esa hora ya pasó (' + calendarioCuando_(ini, tz) + ').' };
  var invitados = String(o.invitar || '').split(/[\s,;]+/).filter(Boolean);
  var malo = invitados.filter(function (x) { return !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x); })[0];
  if (malo) return { error: '«' + malo + '» no parece un correo. Pídele a Juan el correo de la persona.' };
  var c = calendarioJuan_(); if (c.error) return c;
  var cuando = calendarioCuando_(ini, tz), choques = calendarioChoques_(c.cal, ini, fin, tz);
  if (o.confirmado !== true) return { ok: true, falta_confirmar: true, pregunta: '¿Lo pongo el ' + cuando + '?', hasta: calendarioHora_(fin, tz),
    choca_con: choques.length ? choques : undefined, invitara: invitados.length ? invitados : undefined,
    nota: 'Todavía NO está en el calendario. Pregúntaselo a Juan una sola vez (di si choca); con su sí, llama otra vez igual con confirmado = true.' };
  /* Si ya lo puse (un doble sí, un reintento de la llamada), no se duplica. */
  var ya = c.cal.getEvents(ini, fin).filter(function (e) { return calendarioDeAlma_(e) && e.getTitle() === titulo && e.getStartTime().getTime() === ini.getTime(); })[0];
  if (ya) return { ok: true, ya_estaba: true, id: ya.getId(), titulo: titulo, cuando: cuando };
  var opc = { description: (String(o.descripcion || '').trim() + '\n\n' + CALENDARIO_MARCA_).trim() };
  if (String(o.lugar || '').trim()) opc.location = String(o.lugar).trim();
  if (invitados.length) { opc.guests = invitados.join(','); opc.sendInvites = true; }
  var ev = c.cal.createEvent(titulo, ini, fin, opc);
  try { ev.setTag('alma', '1'); } catch (e) {}
  return { ok: true, creado: true, id: ev.getId(), titulo: titulo, cuando: cuando, hasta: calendarioHora_(fin, tz), calendario: c.cal.getName(),
    invitados: invitados.length ? invitados : undefined, hecho: 'Evento en tu calendario · ' + titulo + ' · ' + cuando };
}

/* Lo ocupado y los huecos libres (8:00–19:00, de al menos 30 min) entre desde y hasta (máx. 14 días). */
function calendarioAgenda_(o) {
  var tz = calendarioZona_(o.zona); if (!tz) return { error: 'No reconozco la zona «' + o.zona + '».' };
  var hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var desde = /^\d{4}-\d{2}-\d{2}$/.test(String(o.desde || '')) ? o.desde : hoy, hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(o.hasta || '')) ? o.hasta : desde;
  if (hasta < desde) hasta = desde;
  var dias = [], d = desde;
  while (d <= hasta && dias.length < 14) { dias.push(d); var p = d.split('-').map(Number); d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1)).toISOString().slice(0, 10); }
  var c = calendarioJuan_(); if (c.error) return c;
  var ini = progFecha_(dias[0] + ' 00:00', tz), fin = progFecha_(d + ' 00:00', tz);
  var evs = c.cal.getEvents(ini, fin), ahora = Date.now();
  var ocupado = evs.map(function (e) {
    var a = e.getStartTime(), b = e.getEndTime(), mio = calendarioDeAlma_(e);
    return { titulo: e.getTitle(), dia: Utilities.formatDate(a, tz, 'yyyy-MM-dd'), de: e.isAllDayEvent() ? 'todo el día' : calendarioHora_(a, tz), a: e.isAllDayEvent() ? undefined : calendarioHora_(b, tz),
      id: mio ? e.getId() : undefined, de_alma: mio || undefined };
  });
  var bloques = evs.filter(function (e) { return !e.isAllDayEvent(); }).map(function (e) { return [e.getStartTime().getTime(), e.getEndTime().getTime()]; }).sort(function (x, y) { return x[0] - y[0]; });
  var libre = [];
  dias.forEach(function (dia) {
    var t = Math.max(progFecha_(dia + ' ' + CALENDARIO_LIBRE_[0], tz).getTime(), Math.ceil(ahora / 1800000) * 1800000), tope = progFecha_(dia + ' ' + CALENDARIO_LIBRE_[1], tz).getTime();
    var hueco = function (a, b) { if (b - a >= 1800000) libre.push(dia + ' ' + calendarioHora_(new Date(a), tz) + '–' + calendarioHora_(new Date(b), tz)); };
    bloques.forEach(function (bl) { if (bl[1] <= t || bl[0] >= tope) return; hueco(t, Math.min(bl[0], tope)); t = Math.max(t, bl[1]); });
    if (t < tope) hueco(t, tope);
  });
  return { ok: true, calendario: c.cal.getName(), zona: calendarioZonaNombre_(tz), desde: dias[0], hasta: dias[dias.length - 1], ocupado: ocupado, libre: libre,
    nota: 'libre = huecos de 8:00 a 19:00 (' + calendarioZonaNombre_(tz) + '). Solo los eventos con id los creaste tú.' };
}

/* Mover o cancelar SOLO un evento que creó Alma. Misma regla: primero la pregunta, con el sí confirmado = true. */
function calendarioCambiar_(o, cancelar) {
  if (!String(o.id || '').trim()) return { error: 'Falta el id del evento (sale de crear_evento o ver_agenda).' };
  var c = calendarioJuan_(); if (c.error) return c;
  var ev = c.cal.getEventById(String(o.id).trim());
  if (!ev) return { error: 'No encontré ese evento en el calendario. Búscalo con ver_agenda.' };
  if (!calendarioDeAlma_(ev)) return { error: 'Ese evento no lo creé yo: solo muevo o cancelo los míos. Ese lo cambia Juan en su calendario.' };
  var titulo = ev.getTitle();
  if (cancelar) {
    var cuandoC = calendarioCuando_(ev.getStartTime(), CFG.TZ);
    if (o.confirmado !== true) return { ok: true, falta_confirmar: true, pregunta: '¿Cancelo «' + titulo + '» del ' + cuandoC + '?', nota: 'Todavía NO se borró. Con el sí de Juan, otra vez con confirmado = true.' };
    ev.deleteEvent();
    return { ok: true, cancelado: true, titulo: titulo, hecho: 'Evento cancelado · ' + titulo + ' · ' + cuandoC };
  }
  var tz = calendarioZona_(o.zona); if (!tz) return { error: 'No reconozco la zona «' + o.zona + '».' };
  var ini = progFecha_(o.inicio, tz); if (!ini) return { error: 'Necesito el nuevo inicio como AAAA-MM-DD HH:MM.' };
  var fin = calendarioFin_(o, ini, tz, ev.getEndTime().getTime() - ev.getStartTime().getTime()); if (!fin || fin <= ini) return { error: 'El final tiene que ser después del inicio.' };
  if (ini.getTime() < Date.now() - 60000) return { error: 'Esa hora ya pasó.' };
  var cuando = calendarioCuando_(ini, tz), choques = calendarioChoques_(c.cal, ini, fin, tz, ev.getId());
  if (o.confirmado !== true) return { ok: true, falta_confirmar: true, pregunta: '¿Muevo «' + titulo + '» al ' + cuando + '?', choca_con: choques.length ? choques : undefined, nota: 'Todavía NO se movió. Con el sí de Juan, otra vez con confirmado = true.' };
  ev.setTime(ini, fin);
  return { ok: true, movido: true, id: ev.getId(), titulo: titulo, cuando: cuando, hasta: calendarioHora_(fin, tz), hecho: 'Evento movido · ' + titulo + ' · ' + cuando };
}
