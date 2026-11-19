/* ═══ VIDA PERSONAL EN EL BENTO VIVO (Juan, 19-nov-2026: «no todo es de trabajo») ═══════════════════════════════════
   El reposo del Bento vivo (js/alma-bento.js) muestra, junto a lo de Spacio AM, dos tarjetas de vida personal:
     · «Tu agenda»: lo que queda de hoy y lo de mañana en el Calendario de Juan (calendario.js, calendarioJuan_).
     · «Familia»: el día de The Gentle Stoic Parent: quién lleva a los niños, quién se queda en casa, lo de la tarde y la
       frase del día. Sale de la biblioteca pública de la app (thegentlestoicparent.com/kb.js), guardada 6 h; lo privado
       de la familia (notas, menús, conversaciones con Alma) no se toca.
   Va dentro de la respuesta de «areas» (solo el administrador principal): sin otra llamada de la página. Si algo falla,
   esa tarjeta no sale. */
var VIDA_GSP_KB_ = 'https://thegentlestoicparent.com/kb.js';
var VIDA_GSP_URL_ = 'https://thegentlestoicparent.com';
var VIDA_FAMILIA_TZ_ = 'Europe/Madrid';   // la zona de la familia en The Gentle Stoic Parent (su CFG.TZ)

function vidaHoy_() {
  var r = {};
  try { r.agenda = vidaAgenda_(); } catch (e) { console.error('vida agenda: ' + e); }
  try { r.familia = vidaFamilia_(); } catch (e) { console.error('vida familia: ' + e); }
  return r;
}

/* Lo que queda de hoy y lo de mañana (máx. 6), en la hora de Guatemala. Solo título y hora: nada de invitados ni notas. */
function vidaAgenda_() {
  var cache = CacheService.getScriptCache(), k = 'vida_agenda', c = cache.get(k);
  if (c) return JSON.parse(c);
  var cal = calendarioJuan_(); if (cal.error) return null;
  var tz = CFG.TZ, ahora = new Date(), hoy = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd');
  var p = hoy.split('-').map(Number), manana = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1)).toISOString().slice(0, 10);
  var pasado = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 2)).toISOString().slice(0, 10);
  var evs = cal.cal.getEvents(ahora, progFecha_(pasado + ' 00:00', tz));
  var out = evs.slice(0, 6).map(function (e) {
    var a = e.getStartTime(), dia = Utilities.formatDate(a, tz, 'yyyy-MM-dd');
    return { t: String(e.getTitle() || 'Evento').slice(0, 80), dia: dia < manana ? 'hoy' : 'mañana', h: e.isAllDayEvent() ? '' : Utilities.formatDate(a, tz, 'H:mm'),
      fin: e.getEndTime().toISOString() };
  });
  var r = { eventos: out, hoy: hoy };
  cache.put(k, JSON.stringify(r), 600);
  return r;
}

/* El día de la familia, de la biblioteca de The Gentle Stoic Parent (WEEK y QUOTES de kb.js). */
function vidaFamilia_() {
  var kb = vidaGspKb_(); if (!kb) return null;
  var dow = Number(Utilities.formatDate(new Date(), VIDA_FAMILIA_TZ_, 'u'));   // 1 lunes … 7 domingo
  var dia = kb.semana[dow] || null, frases = kb.frases || [];
  var doy = Math.floor(Date.now() / 86400000);
  return { url: VIDA_GSP_URL_, finde: dow > 5, lleva: dia ? dia.lleva : '', casa: dia ? dia.casa : '', tarde: dia ? dia.tarde : '',
    frase: frases.length ? frases[doy % frases.length] : '' };
}

function vidaGspKb_() {
  var cache = CacheService.getScriptCache(), k = 'vida_gsp_kb', c = cache.get(k);
  if (c) return JSON.parse(c);
  var res = uf_(VIDA_GSP_KB_, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var kb = vidaGspLeer_(res.getContentText());
  if (!kb) return null;
  cache.put(k, JSON.stringify(kb), 21600);
  return kb;
}

/* Solo lee datos: nunca ejecuta el archivo. WEEK: «1: { take: 'Juan', stay: 'Christine', …, pm: L('…', '…') }». */
function vidaGspLeer_(txt) {
  var semana = {}, m, re = /^\s*([1-7]):\s*\{\s*take:\s*'([^']+)',\s*stay:\s*'([^']+)'[^\n]*?pm:\s*(?:L\(\s*'((?:[^'\\]|\\.)*)'|null)/gm;
  var w = String(txt).split('export const WEEK')[1]; if (!w) return null;
  w = w.split('export const')[0];
  while ((m = re.exec(w))) semana[m[1]] = { lleva: m[2], casa: m[3], tarde: m[4] ? m[4].replace(/\\'/g, "'") : '' };
  var frases = [], q = String(txt).split('export const QUOTES')[1], rq = /L\(\s*'((?:[^'\\]|\\.)*)'/g;
  if (q) { q = q.split('export const')[0]; while ((m = rq.exec(q))) frases.push(m[1].replace(/\\'/g, "'")); }
  if (!Object.keys(semana).length && !frases.length) return null;
  return { semana: semana, frases: frases.slice(0, 40) };
}
