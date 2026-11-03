/* ═══ VUELO EN VIVO (FlightAware AeroAPI) ══════════════════════════════════════════════════════════════════════
   La tarjeta del vuelo en el inicio de la app (alma/inicio.html) y la hoja «Tu viaje» muestran la puerta, la hora de
   embarque y el número del vuelo ACTUALIZADOS. La base sigue siendo el viaje que Alma leyó del correo (viajes.js);
   FlightAware solo completa o corrige la puerta, la terminal, las horas, el estado y quién opera el vuelo.
   · Llave: Propiedad del script FLIGHTAWARE_KEY (se pega en hub.spacioam.com/alma/conexiones.html). Va en el
     encabezado x-apikey. Sin llave, o si FlightAware falla, queda lo del correo, sin errores a la vista.
   · Cuidar el dinero (plan Personal: $5 gratis al mes, ~$0.005 por consulta de /flights/{ident}):
       - solo se pregunta dentro de la ventana: 3 h antes de la salida hasta 15 min después;
       - como mucho cada 10 min (cada 5 min en la última hora, si la app lo pide);
       - lo último se guarda en CacheService y en las Propiedades (VUELO_VIVO): fuera de la ventana nunca se pregunta.
   · Código compartido (comprado en Delta, operado por HOP, número de Air France): se pregunta y se muestra el número
     de quien lo vuela («AF 1234»), con «Vendido por Delta · opera HOP» en chico. El número sale de FlightAware
     (ident_iata) o, sin él, del otro número del mismo vuelo en el correo (el «tambien» de viajeSinDobles_).
   · Embarque: FlightAware no da la hora de embarque. Se calcula: salida − 40 min (30 si el vuelo dura 2 h o menos),
     y se marca «aprox.».
   · Cupo de Google: canal «Viajes», por uf_. Es el vuelo de la persona: no se pausa. */

var VIVO_BASE_ = 'https://aeroapi.flightaware.com/aeroapi';
var VIVO_PROP_ = 'VUELO_VIVO';            // { clave: lo último de ese tramo } — sobrevive a la caché
var VIVO_USO_PROP_ = 'VUELO_VIVO_USO';    // { mes, consultas, error } para Conexiones
var VIVO_COSTO_ = 0.005;                  // USD por consulta de /flights/{ident} (plan Personal)
var VIVO_MIN_ = 60000;
var VIVO_ANTES_ = 180 * VIVO_MIN_, VIVO_DESPUES_ = 15 * VIVO_MIN_;      // la ventana de consultas
var VIVO_CADA_ = 10 * VIVO_MIN_, VIVO_CADA_CERCA_ = 5 * VIVO_MIN_;      // cada cuánto, y en la última hora
/* El nombre corto de quien opera, por su código IATA (lo que no esté aquí se muestra como lo da FlightAware). */
var VIVO_AEROLINEAS_ = { A5: 'HOP', AF: 'Air France', KL: 'KLM', DL: 'Delta', OO: 'SkyWest', '9E': 'Endeavor', MQ: 'Envoy', OH: 'PSA', YX: 'Republic',
  UA: 'United', AA: 'American', B6: 'JetBlue', IB: 'Iberia', YW: 'Air Nostrum', AV: 'Avianca', CM: 'Copa', LA: 'LATAM', VY: 'Vueling', LH: 'Lufthansa',
  WA: 'KLM Cityhopper', VS: 'Virgin Atlantic', AM: 'Aeroméxico', Y4: 'Volaris', UX: 'Air Europa', TO: 'Transavia', HV: 'Transavia' };

/* Acción «vueloVivo» (la tarjeta del inicio la pide cada 5 min mientras se ve) → { ok, vivo?, viaje?, tramo? } */
function vueloVivoAccion_(ses) {
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var cuenta = viajesCuenta_(); if (!viajesPuede_(adm, cuenta)) return { ok: true, vivo: null };
  var ahora = Date.now();
  var viajes = viajesLeer_(cuenta).filter(function (v) { return viajeVigente_(v, ahora); }).map(function (v) { return viajeCalcular_(v); });
  var p = viajeProximo_(viajes, ahora); if (!p) return { ok: true, vivo: null };
  var v = viajes.filter(function (x) { return x.id === p.viaje; })[0];
  return { ok: true, viaje: p.viaje, tramo: p.tramo, vivo: vueloVivo_(v, v.tramos[p.tramo], ahora) };
}

/* Lo vivo de un tramo: lo del correo + lo último de FlightAware (y pregunta otra vez si toca). Nunca lanza. */
function vueloVivo_(v, t, ahora, o) {
  o = o || {};
  try {
    var clave = vueloVivoClave_(t), g = vueloVivoGuardado_(clave);
    if (!o.soloGuardado && vueloVivoToca_(t, g, ahora)) g = vueloVivoPreguntar_(v, t, clave, g, ahora);
    return vueloVivoUnir_(v, t, g);
  } catch (e) { console.error('vueloVivo_: ' + (e.stack || e)); try { return vueloVivoUnir_(v, t, null); } catch (x) { return null; } }
}
function vueloVivoClave_(t) { return String(t.vuelo || '').replace(/\s/g, '') + '_' + String(t.sale || '').slice(0, 10); }

/* ¿Toca preguntar? Dentro de la ventana (3 h antes de la salida → 15 min después; la salida programada o la estimada,
   la que dé más ventana) y si ya pasó el tiempo desde la última consulta (10 min; 5 en la última hora). */
function vueloVivoToca_(t, g, ahora) {
  var prog = Date.parse(t.sale), est = g && g.sale_ms ? g.sale_ms : prog;
  if (!(ahora >= Math.min(prog, est) - VIVO_ANTES_ && ahora <= Math.max(prog, est) + VIVO_DESPUES_)) return false;
  var cada = ahora >= Math.min(prog, est) - 60 * VIVO_MIN_ ? VIVO_CADA_CERCA_ : VIVO_CADA_;
  return !(g && g.consultado && ahora - g.consultado < cada);
}

/* Los números del tramo: el del boleto (t.vuelo) y el de quien lo vuela (el otro número del correo, si es de otra aerolínea). */
function vueloVivoNumeros_(v, t) {
  var pre = function (x) { return (/^([A-Z0-9]{2})\s?\d/.exec(String(x || '').toUpperCase()) || [])[1] || ''; };
  var cod = v.codigo_aerolinea || pre(t.vuelo);
  var otro = [t.tambien].filter(function (x) { return x && pre(x) && pre(x) !== cod; })[0] || '';
  return { boleto: t.vuelo, vuela: otro || t.vuelo, prefijo: pre };
}
function vueloVivoFormato_(ident) {   // «AF1234» → «AF 1234»
  var m = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(String(ident || '').replace(/\s/g, '').toUpperCase());
  return m ? m[1] + ' ' + m[2] : String(ident || '');
}

/* ── FlightAware: /flights/{ident} con fechas; primero el número de quien vuela y, si no aparece, el del boleto ── */
function vueloVivoPreguntar_(v, t, clave, g, ahora) {
  var llave = PropertiesService.getScriptProperties().getProperty('FLIGHTAWARE_KEY');
  if (!llave) return g;   // sin llave: lo del correo, sin preguntar
  var n = vueloVivoNumeros_(v, t), idents = [n.vuela, n.boleto].map(function (x) { return String(x || '').replace(/\s/g, ''); })
    .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  var sale = Date.parse(t.sale), iso = function (ms) { return new Date(ms).toISOString().slice(0, 19) + 'Z'; };
  var nuevo = JSON.parse(JSON.stringify(g || {})), vuelo = null, error = '';
  nuevo.consultado = ahora;   // también si falla: no se vuelve a intentar hasta que toque
  for (var i = 0; i < idents.length && !vuelo; i++) {
    var url = VIVO_BASE_ + '/flights/' + encodeURIComponent(idents[i]) + '?start=' + encodeURIComponent(iso(sale - 6 * 60 * VIVO_MIN_)) + '&end=' + encodeURIComponent(iso(sale + 6 * 60 * VIVO_MIN_));
    try {
      var r = uf_(url, { method: 'get', muteHttpExceptions: true, headers: { 'x-apikey': llave, Accept: 'application/json' } }, 'Viajes');
      vueloVivoContar_(r.getResponseCode() === 200 ? '' : 'FlightAware respondió ' + r.getResponseCode());
      if (r.getResponseCode() !== 200) { error = 'http ' + r.getResponseCode(); if (r.getResponseCode() === 401 || r.getResponseCode() === 403) break; continue; }
      vuelo = vueloVivoElegir_(JSON.parse(r.getContentText()), t);
    } catch (e) { error = String(e).slice(0, 120); console.error('vueloVivoPreguntar_: ' + error); }
  }
  if (vuelo) {
    var f = vueloVivoDeFa_(vuelo, t);
    var antes = (g && g.puerta) || t.puerta || '';
    if (f.puerta && antes && f.puerta !== antes) nuevo.puerta_antes = antes;   // la puerta cambió: «antes B3»
    Object.keys(f).forEach(function (k) { if (f[k] !== '' && f[k] != null) nuevo[k] = f[k]; });
    nuevo.fuente = 'flightaware'; nuevo.error = '';
  } else if (error) nuevo.error = error;
  vueloVivoGuardar_(clave, nuevo, sale);
  return nuevo;
}
/* De la lista de FlightAware, el vuelo que sale del mismo aeropuerto más cerca de la hora del correo (máx. 12 h). */
function vueloVivoElegir_(j, t) {
  var mejor = null, dif = 12 * 60 * VIVO_MIN_, sale = Date.parse(t.sale), orig = t.origen && t.origen.iata;
  ((j && j.flights) || []).forEach(function (f) {
    var o = f.origin || {}; if (orig && o.code_iata && o.code_iata !== orig) return;
    var d = Math.abs(Date.parse(f.scheduled_out || f.scheduled_off || '') - sale); if (!(d <= dif)) return;
    dif = d; mejor = f;
  });
  return mejor;
}
/* Un vuelo de FlightAware → lo que importa, con las horas en la hora local del aeropuerto (mismo desfase que el correo). */
function vueloVivoDeFa_(f, t) {
  var local = function (s) { var ms = Date.parse(s || ''); return isNaN(ms) ? '' : viajeHoraIgual_(t.sale, ms); };
  var salida = f.estimated_out || f.scheduled_out || '', prog = f.scheduled_out || '';
  var retraso = salida && prog ? Math.round((Date.parse(salida) - Date.parse(prog)) / VIVO_MIN_) : Math.round(Number(f.departure_delay || 0) / 60);
  var estado = f.cancelled ? ['Cancelado', 'mal'] : (f.actual_out || f.actual_off) ? ['Salió', 'ok'] : retraso >= 15 ? ['Retrasado ' + retraso + ' min', 'tarde'] : ['A tiempo', 'ok'];
  return { puerta: String(f.gate_origin || '').trim().slice(0, 8), terminal: String(f.terminal_origin || '').trim().slice(0, 8),
    sale: local(salida), sale_ms: Date.parse(salida) || 0, numero: vueloVivoFormato_(f.ident_iata || ''),
    opera_iata: String(f.operator_iata || '').toUpperCase().slice(0, 3), opera_fa: String(f.operator || '').slice(0, 40),
    codigos: (f.codeshares_iata || []).slice(0, 8).map(vueloVivoFormato_), estado: estado[0], estado_tipo: estado[1], fa_estado: String(f.status || '').slice(0, 60) };
}

/* Lo que ve Juan: el correo de base, lo de FlightAware encima. */
function vueloVivoUnir_(v, t, g) {
  g = g || {};
  var n = vueloVivoNumeros_(v, t), numero = g.numero || vueloVivoFormato_(n.vuela);
  var limpio = function (s) { return String(s || '').replace(/[!*]+$/, '').trim(); };
  var opera = limpio(t.opera) || VIVO_AEROLINEAS_[g.opera_iata] || '';
  var duenoNum = VIVO_AEROLINEAS_[n.prefijo(numero)] || '', vende = String(v.aerolinea || '').split(/\s+/)[0];
  if (opera && duenoNum && opera.toLowerCase() === duenoNum.toLowerCase()) opera = '';   // un AF que vuela Air France: nada que aclarar
  var vendido = v.codigo_aerolinea && n.prefijo(numero) && v.codigo_aerolinea !== n.prefijo(numero) ? vende : '';
  if (opera && vende && opera.toLowerCase() === vende.toLowerCase()) opera = '';
  var sale = g.sale || t.sale, dura = (Date.parse(t.llega) - Date.parse(t.sale)) / VIVO_MIN_;
  var embarque = viajeHoraIgual_(t.sale, Date.parse(sale) - (dura > 0 && dura <= 120 ? 30 : 40) * VIVO_MIN_);
  return { numero: numero, boleto: t.vuelo, vendido: vendido, opera: opera,
    puerta: g.puerta || t.puerta || '', puerta_antes: g.puerta_antes || '', terminal: g.terminal || (t.origen && t.origen.terminal) || '',
    asiento: t.asiento || '', sale: sale, sale_prog: t.sale, embarque: embarque, embarque_aprox: true,
    estado: g.estado || '', estado_tipo: g.estado_tipo || '', fuente: g.fuente || 'correo',
    consultado: g.consultado ? new Date(g.consultado).toISOString() : '' };
}

/* ── Guardar: CacheService (rápido) y Propiedades (dura); se borran los tramos de hace más de 2 días ── */
function vueloVivoGuardado_(clave) {
  try { var c = CacheService.getScriptCache().get('vivo_' + clave); if (c) return JSON.parse(c); } catch (e) {}
  try { return (JSON.parse(PropertiesService.getScriptProperties().getProperty(VIVO_PROP_) || '{}') || {})[clave] || null; } catch (e) { return null; }
}
function vueloVivoGuardar_(clave, g, sale) {
  g.sale_prog_ms = sale;
  try { CacheService.getScriptCache().put('vivo_' + clave, JSON.stringify(g), 6 * 3600); } catch (e) {}
  try {
    var p = PropertiesService.getScriptProperties(), todo = JSON.parse(p.getProperty(VIVO_PROP_) || '{}') || {}, limite = Date.now() - 2 * 864e5;
    Object.keys(todo).forEach(function (k) { if (!(todo[k] && todo[k].sale_prog_ms > limite)) delete todo[k]; });
    todo[clave] = g; p.setProperty(VIVO_PROP_, JSON.stringify(todo));
  } catch (e) { console.error('vueloVivoGuardar_: ' + e); }
}
/* Cuántas consultas van este mes (para ver el costo en Conexiones) y el último error. */
function vueloVivoContar_(error) {
  try {
    var p = PropertiesService.getScriptProperties(), mes = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM'), u = JSON.parse(p.getProperty(VIVO_USO_PROP_) || '{}') || {};
    if (u.mes !== mes) u = { mes: mes, consultas: 0 };
    u.consultas = (u.consultas || 0) + 1; u.error = error || '';
    p.setProperty(VIVO_USO_PROP_, JSON.stringify(u));
  } catch (e) {}
}
/* Para Conexiones: si hay llave y cuánto va del mes. La llave nunca se devuelve. */
function vueloVivoEstado_(p) {
  var u = {}; try { u = JSON.parse(p.getProperty(VIVO_USO_PROP_) || '{}') || {}; } catch (e) {}
  var mes = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM'), n = u.mes === mes ? u.consultas || 0 : 0;
  return { llave: !!p.getProperty('FLIGHTAWARE_KEY'), consultas: n, costo: Math.round(n * VIVO_COSTO_ * 100) / 100, error: u.mes === mes ? u.error || '' : '' };
}
