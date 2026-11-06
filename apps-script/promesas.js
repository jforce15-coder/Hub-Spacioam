/* ═══ PROMESAS AL HUÉSPED ═════════════════════════════════════════════════════════════════════
   Cuando ALMA le promete algo a un huésped («el equipo te escribe por WhatsApp», «lo confirmo con el equipo»), por chat,
   WhatsApp o llamada, queda una fila en ALMA_PROMESAS y el Hub la muestra en la conversación.
   Estados (docs/GLOSARIO.md, «Promesa al huésped»):
   · abierta: todavía se puede cumplir y no ha vencido.
   · cumplida: alguien la cumplió. Se cierra sola si el equipo le escribe desde el Hub, si la conversación queda resuelta
     o si la conversación (Hospitable y WhatsApp, también lo que el equipo contestó directo allí) muestra que ya se dio lo
     prometido: el código, el WiFi, la dirección, la factura, la respuesta… (promEvidencia_). Guarda la evidencia.
   · ya no aplica: dejó de tener sentido (la estadía terminó y era para la estadía, la reserva se canceló, la consulta era
     para una fecha que ya pasó, era repetida de otra, o era una conversación interna del equipo). Guarda el motivo.
     Lo que sigue importando después de la salida (factura, reembolso o depósito, un objeto olvidado) no se cierra así.
   · vencida: pasó su plazo, sigue teniendo sentido y nadie la cumplió. Solo «abierta» y «vencida» se muestran y se
     recuerdan al equipo.
   Por qué (Juan, 6-nov-2026: «se acumulan sin sentido»): del 26-oct al 4-nov, 95 de 147 vencieron sin marca porque el
   equipo contesta directo en Hospitable o WhatsApp y nada las cerraba.
   Hooks: log_ (texto), vozPostCall_ (llamadas), hubResponder_ / hubResponderWa_ (cumplir), procesarCola (repaso). */
var PROM_CAB_ = ['id', 'creada', 'conv_id', 'huesped', 'propiedad', 'canal', 'que', 'vence', 'estado', 'origen', 'texto', 'avisos', 'cerrada_por', 'cerrada_ts', 'tipo', 'motivo', 'evidencia', 'revisada'];
var PROM_RX_ = /(te (escrib|contact|llam|confirm|avis|envi|mand|respond|comparto|paso)|le (escrib|contact|llam|confirm|avis)|(el|nuestro|alguien del) equipo (te|le|lo|se|va)|lo (confirmo|reviso|consulto|verifico|reviso) con|lo (dejo|dejamos) anotado|te (lo )?(hago|haremos|hacemos) saber|te (escribimos|enviamos|confirmamos|avisamos|llamamos)|por (whatsapp|aquí mismo|este (chat|medio))[^.]{0,40}(te|le) |we('ll| will) (get back|contact|send|write|confirm|let you know)|someone (will|from our team)|our team will)/i;
var PROM_NO_APLICA_ = 'ya no aplica';
var PROM_REPASO_MIN_ = 30;   // cada conversación con promesas vivas se vuelve a mirar a lo mucho cada 30 min
var PROM_REPASO_MAX_ = 8;    // conversaciones por pasada (cada una puede leer su hilo de Hospitable)

/* Tipo de promesa (clasificador barato, sin IA): decide qué evidencia la cumple y si sobrevive a la salida. El orden importa
   («Enviar la factura al número…» es factura; «Validar si las llaves fueron encontradas» es un objeto olvidado). */
var PROM_TIPOS_ = [
  ['factura', /factur|invoice|\bfel\b|proforma/i],
  ['dinero', /reembols|devoluci[oó]n|refund|dep[oó]sito|multa|garant[ií]a/i],
  ['olvidado', /olvid|encontr|apareci|perdi[oó]|biblia|objeto|bolsa con|forgot|lost|left behind/i],
  ['wifi', /wi-?fi|router|internet|netflix/i],
  ['acceso', /c[oó]digo|cerradura|\bpin\b|acceso|ingres|entrada|informaci[oó]n de (llegada|check)/i],
  ['direccion', /direcci[oó]n|ubicaci[oó]n|c[oó]mo llegar|indicaciones|address|location/i],
  ['insumo', /toalla|s[aá]bana|edred[oó]n|duvet|almohad|secador|percha|\bbote\b|basura|papel|jab[oó]n|llevar|reponer/i]
];
var PROM_DESPUES_ = { factura: 1, dinero: 1, olvidado: 1 };   // siguen teniendo sentido después del checkout
function promTipo_(que) {
  var t = String(que || '');
  for (var i = 0; i < PROM_TIPOS_.length; i++) if (PROM_TIPOS_[i][1].test(t)) return PROM_TIPOS_[i][0];
  return 'confirmacion';
}

/* Palabras con contenido de lo prometido («si hay televisión en la habitación» → telev, habit), para reconocer la respuesta
   y las repetidas. Se comparan por sus 5 primeras letras (televisión / televisores). */
var PROM_VACIAS_ = ' confirmar confirma confirmo confirmacion equipo escribir escribira escribiran escribe respuesta respuestas responder huesped cliente revisar revisara revisa consultar consulta enviar envia avisar avisara plataforma cuando sobre para con mensaje tiene tienen hay puede pueden posible posibilidad detalles detalle informacion comunicar resultado resultados manana temprano hoy mismo todos todas este esta estos estas cual cuales donde como luego pasar paso solicitud tema dato datos opciones disponible disponibilidad confirme confirmen tenga tengan una uno unos unas los las del que por mas muy ver hacer queda quedara saber caso chat whatsapp llamada entre desde hasta despues antes ';
function promClaves_(t) {
  var s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');
  var vis = {}, out = [];
  s.split(/\s+/).forEach(function (w) {
    if (w.length < 4 || /^\d+$/.test(w) || PROM_VACIAS_.indexOf(' ' + w + ' ') >= 0) return;
    var k = w.slice(0, 5); if (!vis[k]) { vis[k] = 1; out.push(k); }
  });
  return out;
}
function promComparten_(a, b) { return a.some(function (k) { return b.indexOf(k) >= 0; }); }

/* Un mensaje que solo vuelve a prometer («lo confirmo con el equipo», «queda anotado») no es la respuesta.
   Mejor dejarla abierta que cerrarla por un «queda anotado»: ante la duda, el mensaje cuenta como otra promesa. */
var PROM_REPITE_RX_ = /(lo (confirmo|reviso|consulto|verifico|comparto|dejo|paso)|los dejo|ya les aviso|queda anotado|\banoto\b|pendiente de confirm|en cuanto|apenas (tenga|tengamos|el equipo)|el equipo (revisa|ya est|est[aá] (revisando|viendo|buscando)|lo coordina|responda|te |le |se )|te (escrib|confirm|avis|contact)|esperemos|estamos (revisando|esperando|viendo)|tiene que confirmar|en revisi[oó]n|esperando (la )?respuesta|we('ll| will)|as soon as|let you know|get back to you)/i;
/* Evidencia en lo que enviamos (ALMA, el equipo o un automático de Hospitable), por tipo. */
var PROM_EVID_ = {
  acceso: /((c[oó]digo|code|clave|pin|contrase[ñn]a|cerradura|lock|acceso|access)[^\n]{0,60}\d{4,8})|(\d{4,8}[^\n]{0,20}(#|c[oó]digo|code))|(hola\.spacioam\.com[\s\S]{0,400}(acceso|ingreso|instruc|llegada|access|check.?in))|((acceso|ingreso|instruc|llegada|access|check.?in)[\s\S]{0,400}hola\.spacioam\.com)/i,
  wifi: /wi-?fi|router|internet|\bred\b|network|contrase[ñn]a|password|netflix/i,
  direccion: /maps\.|waze|goo\.gl|direcci[oó]n|address|ubicaci[oó]n|hola\.spacioam\.com/i,
  factura: /(factura|invoice|\bfel\b)[^.\n]{0,80}(adjunt|te (la )?(envi|mand)[eéoa]|enviamos|enviada|ya (est[aá]|sali|qued)|emitid|attached|sent)|(adjunt|aqu[ií] (est[aá]|va|te (dejo|env))|te (la )?(envi|mand)(é|e|amos)|enviamos|emitimos|attached|here is)[^.\n]{0,80}(factura|invoice|\bfel\b)/i,
  dinero: /(reembols|devoluci|devolv|refund|dep[oó]sit|transfer|multa)[\s\S]{0,200}(realiz|hech|envi|procesad|list[oa]|acredit|done|sent|processed|complet)|(realiz|hech|envi|procesad|list[oa]|acredit|done|sent|processed|complet)[\s\S]{0,200}(reembols|devoluci|devolv|refund|dep[oó]sit|transfer|multa)/i,
  olvidado: /encontr|apareci|guardad|found|no (lo|la|los|las) (hall|vimos|tenemos)/i
};
/* Lo que dice el huésped después: ya entró (acceso), ya le llegó / ya quedó (cumplida) o ya no hace falta (ya no aplica). */
var PROM_ENTRO_RX_ = /ya (entr|ingres|estamos (aden|den)tro|estoy (aden|den)tro|pudimos (entrar|ingresar)|abri[oó]|hicimos (el )?check)|we('re| are) (in|inside)|got in|(we|i)('ve| have) (arrived and|checked in)|ya llegamos al (apartamento|depa)/i;
var PROM_LISTO_RX_ = /ya (me|nos) (lleg[oó]|lo (mandaron|enviaron))|ya (lo|la) (tengo|tenemos|encontr|recib)|ya (funciona|qued[oó]|se resolvi[oó]|est[aá] (resuelto|listo))|all (good|set|sorted)|got it,? thanks/i;
var PROM_YA_NO_RX_ = /ya no (es necesario|hace falta|lo necesit|la necesit|importa)|no (te|se) preocupe|never ?mind|no longer need|ya no (vamos|voy) a/i;
/* Lo que era para el día de llegada (early check-in, guardar maletas, recibirlo): pasada la llegada, ya no aplica. */
var PROM_LLEGADA_RX_ = /early|antes de las 15|(tu|su) llegada|maletas|recibir (al|a la|el|la|lo|la)|cuando llegue|ingreso a las|check-?in/i;
var PROM_CANCELADA_RX_ = /cancel|declin|denied|not_accepted|expired|withdrawn|rechaz/i;

function hojaProm_() {
  var sh = hojaCrear_('ALMA_PROMESAS', PROM_CAB_);
  if (sh.getLastColumn() < PROM_CAB_.length) sh.getRange(1, 1, 1, PROM_CAB_.length).setValues([PROM_CAB_]);   // columnas nuevas de la hoja vieja
  return sh;
}

function promFilas_() {
  var sh = hojaProm_(), n = sh.getLastRow(); if (n < 2) return { sh: sh, filas: [] };
  var v = sh.getRange(2, 1, n - 1, PROM_CAB_.length).getValues();
  return { sh: sh, filas: v.map(function (r, i) { var o = { fila: i + 2 }; PROM_CAB_.forEach(function (k, j) { o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j] == null ? '' : r[j]); }); return o; }) };
}
function promViva_(f) { return f.estado === 'abierta' || f.estado === 'vencida'; }
function promTs_(x) { var t = Date.parse(String(x || '')); return isNaN(t) ? 0 : t; }
/* La evidencia se guarda sin códigos ni números largos: basta saber cuándo y qué mensaje fue. */
function promSinNumeros_(t) { return String(t || '').replace(/\s+/g, ' ').replace(/\d{4,}/g, function (m) { return new Array(m.length + 1).join('•'); }).slice(0, 200); }

/* Cierra (o marca) una fila y guarda por qué. f se actualiza en memoria para lo que sigue en la misma pasada. */
function promCerrar_(sh, f, estado, motivo, evidencia, quien) {
  var ts = new Date().toISOString(), cierra = estado !== 'abierta' && estado !== 'vencida';
  f.estado = estado; f.tipo = f.tipo || promTipo_(f.que); f.motivo = String(motivo || '').slice(0, 200); f.evidencia = String(evidencia || '').slice(0, 300); f.revisada = ts;
  if (cierra) { f.cerrada_por = String(quien || 'Alma (repaso)').slice(0, 80); f.cerrada_ts = ts; }
  sh.getRange(f.fila, PROM_CAB_.indexOf('estado') + 1).setValue(estado);
  var i0 = PROM_CAB_.indexOf('cerrada_por');
  sh.getRange(f.fila, i0 + 1, 1, PROM_CAB_.length - i0).setValues([[f.cerrada_por || '', f.cerrada_ts || '', f.tipo, f.motivo, f.evidencia, f.revisada]]);
}
/* La bandeja (ALMA_INBOX) muestra la última promesa viva de la conversación o, si no queda ninguna, cómo cerró. */
function promInboxSync_(convId, filas) {
  var mias = filas.filter(function (x) { return x.conv_id === convId; }), vivas = mias.filter(promViva_);
  var f = vivas.length ? vivas[vivas.length - 1] : mias[mias.length - 1]; if (!f) return;
  try { inboxUpsert_(convId, vivas.length ? { promesa: f.que, promesa_vence: f.vence, promesa_id: f.id, promesa_estado: f.estado } : { promesa_estado: f.estado }); } catch (e) {}
}

/* Conversación del equipo (Juan o un administrador): no es una promesa a un huésped; lo suyo va a Pendientes. */
function promEsInterna_(c) {
  c = c || {}; var id = String(c.conv_id || c.resId || '');
  if (/^equipo\b/i.test(String(c.huesped || '')) || /llamada del equipo/i.test(String(c.propiedad || ''))) return true;
  if (!/^wa:/.test(id)) return false;
  try { return typeof adminPorTel_ === 'function' && !!adminPorTel_(id.slice(3)); } catch (e) { return false; }
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

/* La misma promesa ya está viva en esa conversación (mismo tipo y el mismo tema): cuenta una sola vez. */
function promRepetidaDe_(convId, tipo, que, filas, antesDe) {
  var cl = promClaves_(que);
  return filas.filter(function (q) {
    if (q.conv_id !== convId || (antesDe && promTs_(q.creada) >= antesDe) || /^repetida/.test(q.motivo || '')) return false;
    var viva = promViva_(q) || (antesDe && promTs_(q.cerrada_ts) > antesDe);   // seguía viva cuando se hizo la nueva
    if (!viva || (q.tipo || promTipo_(q.que)) !== tipo) return false;
    var cq = promClaves_(q.que);
    return !cl.length || !cq.length || promComparten_(cl, cq);
  })[0] || null;
}

/* Registra la promesa (una por conversación y tema), la marca en el inbox y abre la decisión del equipo. */
function promesaRegistrar_(c, texto, origen) {
  c = c || {}; var convId = String(c.resId || c.conv_id || ''); if (!convId || /^op:/.test(convId)) return null;
  if (promEsInterna_({ conv_id: convId, huesped: c.huesped, propiedad: c.propiedad })) return null;
  var p = promesaDetectar_(texto, c.texto || c.pregunta || ''); if (!p) return null;
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) {}
  try {
    var d = promFilas_(), ahora = Date.now(), tipo = promTipo_(p.que);
    if (d.filas.some(function (f) { return f.conv_id === convId && f.estado === 'abierta' && ahora - promTs_(f.creada) < 30 * 60000; })) return null;
    var ya = promRepetidaDe_(convId, tipo, p.que, d.filas, 0);
    if (ya) return { id: ya.id, que: ya.que, vence: ya.vence, repetida: true };
    var vence = new Date(ahora + p.horas * 3600000).toISOString(), id = 'pr' + ahora + Math.floor(Math.random() * 1000);
    d.sh.appendRow([id, new Date(ahora).toISOString(), convId, c.huesped || '', c.propiedad || '', p.canal, p.que, vence, 'abierta', origen || 'texto', String(texto).slice(0, 1500), 1, '', '', tipo, '', '', '']);
    try { inboxUpsert_(convId, { promesa: p.que, promesa_vence: vence, promesa_id: id, promesa_estado: 'abierta' }); } catch (e) {}
    try { decisionCrear_(Object.assign({}, c, { resId: convId }), 'promesa', p.que); } catch (e) { console.error('decisionCrear_ promesa: ' + e); }   // opciones A/B/C para el equipo (decisiones.js)
    /* Sin aviso al crearla: el seguimiento queda en el Hub y, si vence, entra en el resumen periódico (promesasRevisar_). */
    return { id: id, que: p.que, vence: vence };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* El equipo le escribió a esa conversación desde el Hub (o la marcó resuelta): se cumplen sus promesas vivas. */
function promesasCumplir_(convId, quien, motivo) {
  convId = String(convId || ''); if (!convId) return 0;
  var d = promFilas_(), n = 0;
  d.filas.forEach(function (f) {
    if (f.conv_id !== convId || !promViva_(f)) return;
    promCerrar_(d.sh, f, 'cumplida', motivo === 'resuelta' ? 'la conversación quedó resuelta' : 'el equipo le escribió desde el Hub', '', quien || motivo || 'equipo');
    n++;
  });
  if (n) promInboxSync_(convId, d.filas);
  return n;
}

/* ── Repaso inteligente ── */
/* Lo que pasó en la conversación después de la promesa: ¿se cumplió? → {estado, motivo, evidencia} o null. */
function promEvidencia_(f, hilo, res) {
  var desde = promTs_(f.creada), propia = String(f.texto || '').replace(/\s+/g, ' ').slice(0, 60), tipo = f.tipo || promTipo_(f.que), cl = promClaves_(f.que);
  var despues = (hilo || []).filter(function (m) {
    if (promTs_(m.created) <= desde || !String(m.texto || '').trim()) return false;
    return !(m.tipo !== 'guest' && propia && String(m.texto).replace(/\s+/g, ' ').slice(0, 60) === propia);   // el propio mensaje de la promesa
  });
  var ev = function (m) { return (m.created || '') + ' · ' + (m.tipo === 'guest' ? 'huésped' : m.auto ? 'automático' : 'Spacio AM') + ': ' + promSinNumeros_(m.texto); };
  for (var i = 0; i < despues.length; i++) {
    var m = despues[i], t = String(m.texto);
    if (m.tipo === 'guest') {
      if (tipo === 'acceso' && PROM_ENTRO_RX_.test(t)) return { estado: 'cumplida', motivo: 'el huésped ya entró', evidencia: ev(m) };
      if (PROM_LISTO_RX_.test(t)) return { estado: 'cumplida', motivo: 'el huésped dijo que ya quedó', evidencia: ev(m) };
      if (PROM_YA_NO_RX_.test(t)) return { estado: PROM_NO_APLICA_, motivo: 'el huésped dijo que ya no hace falta', evidencia: ev(m) };
      continue;
    }
    /* Lo enviado por nosotros. Un automático de Hospitable solo cuenta para lo que entrega solo (código, WiFi, dirección). */
    if (m.auto && !/^(acceso|wifi|direccion)$/.test(tipo)) continue;
    var rx = PROM_EVID_[tipo];
    var repite = PROM_RX_.test(t) || PROM_REPITE_RX_.test(t);
    if (tipo === 'acceso' && /wi-?fi|\bred\b|network/i.test(t) && !/c[oó]digo|cerradura|puerta|door|lock/i.test(t)) continue;   // la clave del WiFi no es el acceso
    if (rx && rx.test(t) && (m.auto || !repite || tipo === 'acceso')) return { estado: 'cumplida', motivo: 'se le envió ' + ({ acceso: 'el acceso', wifi: 'el WiFi', direccion: 'la dirección', factura: 'la factura', dinero: 'lo del dinero', olvidado: 'la respuesta del objeto' })[tipo], evidencia: ev(m) };
    if (m.auto || repite) continue;
    /* Confirmaciones e insumos: una respuesta nuestra sobre el mismo tema (o cualquier respuesta, si la promesa no nombra tema). */
    if (!rx || tipo === 'olvidado') {
      var ct = promClaves_(t), iguales = cl.filter(function (k) { return ct.indexOf(k) >= 0; }).length;
      if (!cl.length || iguales >= (cl.length >= 3 ? 2 : 1)) return { estado: 'cumplida', motivo: 'se le respondió', evidencia: ev(m) };
    }
  }
  if (tipo === 'acceso' && res) {
    if (/checked.?in|in_house|hospedad/i.test(res.status || '')) return { estado: 'cumplida', motivo: 'el huésped ya entró (check-in hecho)', evidencia: 'estado de la reserva: ' + res.status };
    /* Solo si se prometió antes de llegar: un «nuevo código» a mitad de la estadía no se cumple porque ya entró. */
    if (res.checkin && res.hoy > res.checkin && String(f.creada).slice(0, 10) <= res.checkin && !PROM_CANCELADA_RX_.test(res.status || '') && res.tipo !== 'consulta') return { estado: 'cumplida', motivo: 'la estadía empezó el ' + res.checkin + ': el huésped ya entró', evidencia: 'check-in ' + res.checkin };
  }
  return null;
}
/* ¿Dejó de tener sentido? → {estado: 'ya no aplica', motivo} o null. */
function promNoAplica_(f, res) {
  if (promEsInterna_(f)) return { estado: PROM_NO_APLICA_, motivo: 'conversación interna del equipo, no es un huésped' };
  if (!res) return null;
  var tipo = f.tipo || promTipo_(f.que), despues = !!PROM_DESPUES_[tipo];
  if (PROM_CANCELADA_RX_.test(res.status || '') && !despues) return { estado: PROM_NO_APLICA_, motivo: res.tipo === 'consulta' ? 'la consulta no se convirtió en reserva (' + res.status + ')' : 'la reserva se canceló' };
  if (despues) return null;
  if (res.tipo === 'consulta' && res.checkin && res.hoy > res.checkin) return { estado: PROM_NO_APLICA_, motivo: 'la consulta era para el ' + res.checkin + ' y esa fecha ya pasó' };
  if (res.checkout && res.hoy > res.checkout) return { estado: PROM_NO_APLICA_, motivo: 'la estadía terminó el ' + res.checkout + ' y era para la estadía' };
  if (res.checkin && res.hoy > res.checkin && PROM_LLEGADA_RX_.test(f.que)) return { estado: PROM_NO_APLICA_, motivo: 'era para la llegada del ' + res.checkin + ', que ya pasó' };
  return null;
}
/* Decide el estado de una promesa viva: evidencia → ya no aplica → repetida → vencida (real) → abierta. */
function promEvaluar_(f, filas, hilo, res, ahora) {
  f.tipo = f.tipo || promTipo_(f.que);
  var r = promNoAplica_(f, res);
  if (r && /interna/.test(r.motivo)) return r;
  r = promEvidencia_(f, hilo, res) || r; if (r) return r;
  var q = promRepetidaDe_(f.conv_id, f.tipo, f.que, filas, promTs_(f.creada));
  if (q) return { estado: PROM_NO_APLICA_, motivo: 'repetida: es la misma que ' + q.id };
  /* El acceso se manda antes de llegar (el automático sale el día anterior): antes del check-in todavía no falló. */
  if (f.tipo === 'acceso' && res && res.checkin && res.hoy < res.checkin) return { estado: 'abierta', motivo: '' };
  if (promTs_(f.vence) && promTs_(f.vence) < ahora) return { estado: 'vencida', motivo: 'pasó el plazo y nadie la cumplió' };
  return { estado: 'abierta', motivo: '' };
}
/* Fechas y estado de la reserva o consulta (preContexto_ guarda 6 h en caché). */
function promReserva_(convId, ahora) {
  var hoy = Utilities.formatDate(new Date(ahora), CFG.TZ, 'yyyy-MM-dd');
  if (/^(wa|llamada):/.test(convId)) return { hoy: hoy };
  var pre = {}; try { pre = preContexto_(convId) || {}; } catch (e) {}
  return { hoy: hoy, checkin: String(pre.checkin || '').slice(0, 10), checkout: String(pre.checkout || '').slice(0, 10), status: String(pre.status || ''), tipo: pre.tipo || (/^inq:/.test(convId) ? 'consulta' : '') };
}
function promHilo_(convId) {
  try { var h = hiloConv_(convId); return h && h.code === 200 ? (h.hilo || []) : null; } catch (e) { console.error('promHilo_: ' + e); return null; }
}

/* Repasa las promesas vivas: una lectura del hilo por conversación, las vencidas primero. o.todas: sin esperar los 30 min
   (la limpieza del historial); o.max: conversaciones; o.hasta: hora (ms) para soltar antes del tope de Apps Script. */
function promesasRepasar_(o) {
  o = o || {}; var ahora = o.ahora || Date.now(), d = promFilas_(), porConv = {}, cuenta = { cumplida: 0, 'ya no aplica': 0, vencida: 0, abierta: 0 };
  d.filas.filter(promViva_).forEach(function (f) { (porConv[f.conv_id] = porConv[f.conv_id] || []).push(f); });
  var convs = Object.keys(porConv).filter(function (c) {
    return o.todas || porConv[c].some(function (f) { return ahora - promTs_(f.revisada) >= PROM_REPASO_MIN_ * 60000; });
  }).sort(function (a, b) {
    var va = porConv[a].some(function (f) { return promTs_(f.vence) < ahora; }) ? 0 : 1, vb = porConv[b].some(function (f) { return promTs_(f.vence) < ahora; }) ? 0 : 1;
    var ra = Math.min.apply(null, porConv[a].map(function (f) { return promTs_(f.revisada); })), rb = Math.min.apply(null, porConv[b].map(function (f) { return promTs_(f.revisada); }));
    return va - vb || ra - rb;
  });
  var hechas = 0;
  convs.slice(0, o.max || PROM_REPASO_MAX_).forEach(function (c) {
    if (o.hasta && Date.now() > o.hasta) return;
    var hilo = promHilo_(c), res = promReserva_(c, ahora); hechas++;
    porConv[c].sort(function (a, b) { return promTs_(a.creada) - promTs_(b.creada); }).forEach(function (f) {
      var r = promEvaluar_(f, d.filas, hilo || [], res, ahora);
      if (!hilo && r.estado === 'vencida' && !res.checkout) r = null;   // sin hilo ni fechas no se decide que falló: se reintenta
      if (!r) return;
      if (r.estado !== f.estado || r.motivo !== f.motivo) promCerrar_(d.sh, f, r.estado, r.motivo, r.evidencia || '');
      else { f.revisada = new Date().toISOString(); d.sh.getRange(f.fila, PROM_CAB_.length).setValue(f.revisada); }
      cuenta[r.estado] = (cuenta[r.estado] || 0) + 1;
    });
    promInboxSync_(c, d.filas);
  });
  return { conversaciones: hechas, quedan: Math.max(0, convs.length - hechas), estados: cuenta };
}

/* Revisión periódica (procesarCola): repaso de las vivas y, como mucho cada PROM_AVISO_HORAS (6 h por defecto) y solo de
   7:00 a 21:00 en Guatemala, UN resumen con las vencidas de verdad (ya repasadas). Nada de un aviso por promesa.
   La primera vez limpia el historial acumulado en tandas (PROM_LIMPIEZA_V1), sin esperar a nadie. */
function promesasRevisar_() {
  var c = CacheService.getScriptCache(); if (c.get('prom_rev')) return; c.put('prom_rev', '1', 600);
  var P = PropertiesService.getScriptProperties(), ahora = Date.now();
  /* Leer los hilos va a Hospitable: con el cupo de Google en pausa de fondo (cupo.js) se espera a la siguiente pasada. */
  var leer = typeof cupoPermite_ !== 'function' || cupoPermite_('fondo');
  if (leer && !P.getProperty('PROM_LIMPIEZA_V1')) {
    var l = promesasRepasar_({ todas: true, max: 15, hasta: ahora + 40000 });
    if (!l.quedan) P.setProperty('PROM_LIMPIEZA_V1', new Date().toISOString());
  } else if (leer) promesasRepasar_({});
  var cada = Math.max(1, Number(P.getProperty('PROM_AVISO_HORAS') || 6)), ult = Number(P.getProperty('PROM_ULT_AVISO') || 0);
  var h = +Utilities.formatDate(new Date(), CFG.TZ, 'H');
  if (h < 7 || h >= 21 || ahora - ult < cada * 3600000) return;
  var venc = promFilas_().filas.filter(function (f) { return f.estado === 'vencida' && f.revisada; });
  if (!venc.length) return;
  P.setProperty('PROM_ULT_AVISO', String(ahora));
  var lineas = venc.slice(-8).reverse().map(function (f) { return '· ' + (f.huesped || 'Huésped') + (f.propiedad ? ' (' + f.propiedad + ')' : '') + ': ' + String(f.que).slice(0, 140); });
  try { var jefe = chatPrincipal_(); if (jefe) vozAvisoPoner_(jefe, (venc.length === 1 ? 'Hay una promesa a un huésped vencida' : 'Hay ' + venc.length + ' promesas a huéspedes vencidas') + ': ' + String(venc[venc.length - 1].que).slice(0, 80) + '.', '', { nivel: 1 }); } catch (e) {}   // notificación de nivel 1 (calle.js)
  try { escalar_('Promesas pendientes · ' + venc.length, 'Resumen de lo que ALMA prometió, sigue teniendo sentido y nadie cumplió (' + venc.length + '):\n\n' + lineas.join('\n') + (venc.length > 8 ? '\n· …y ' + (venc.length - 8) + ' más' : '') + '\n\nSe cierran solas cuando la conversación muestra que ya se cumplió (también lo que contesten directo en Hospitable o WhatsApp), al responderle desde el Hub o al marcar la conversación como resuelta. Próximo resumen en ' + cada + ' h como mínimo.\nhttps://hub.spacioam.com/', { sinWa: true }); } catch (e) { console.error('promesas resumen: ' + e); }
}

/* Limpieza del historial acumulado, a mano desde el editor (se puede correr las veces que haga falta: solo toca las vivas
   y aplica las mismas reglas). Devuelve cuántas había vivas antes y después. */
function promesasLimpiarHistorial() {
  var cuenta = function () { var n = { abierta: 0, vencida: 0 }; promFilas_().filas.forEach(function (f) { if (promViva_(f)) n[f.estado]++; }); return n; };
  var antes = cuenta(), r = promesasRepasar_({ todas: true, max: 1000, hasta: Date.now() + 270000 }), despues = cuenta();
  if (!r.quedan) PropertiesService.getScriptProperties().setProperty('PROM_LIMPIEZA_V1', new Date().toISOString());
  var out = { antes: antes, despues: despues, repaso: r };
  console.log('promesasLimpiarHistorial: ' + JSON.stringify(out));
  return out;
}

/* Hub: lista de promesas (abiertas y vencidas por defecto) y cierre manual. */
function hubPromesas_(todas) {
  var f = promFilas_().filas.filter(function (x) { return todas || promViva_(x); });
  return { ok: true, promesas: f.slice(-200).reverse().map(function (x) { return { id: x.id, creada: x.creada, conv_id: x.conv_id, huesped: x.huesped, propiedad: x.propiedad, canal: x.canal, que: x.que, vence: x.vence, estado: x.estado, origen: x.origen, motivo: x.motivo }; }) };
}
function hubPromesaCerrar_(id, quien) {
  var d = promFilas_(), f = d.filas.filter(function (x) { return x.id === String(id); })[0]; if (!f) return { ok: false, error: 'no existe' };
  promCerrar_(d.sh, f, 'cumplida', 'marcada a mano', '', String(quien || 'equipo').slice(0, 70) + ' (a mano)');
  promInboxSync_(f.conv_id, d.filas);
  return { ok: true };
}
