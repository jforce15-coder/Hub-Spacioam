/* ═══ VUELO EN VIVO (AirLabs; FlightAware opcional) ════════════════════════════════════════════════════════════
   La tarjeta del vuelo en el inicio de la app (alma/inicio.html) y la hoja «Tu viaje» muestran la puerta, la hora de
   embarque y el número del vuelo ACTUALIZADOS. La base sigue siendo el viaje que Alma leyó del correo (viajes.js);
   el proveedor solo completa o corrige la puerta, la terminal, las horas, el estado y quién opera el vuelo.
   · Orden: AirLabs → FlightAware → correo.
       - AirLabs (principal): plan gratis, sin tarjeta, ~1,000 consultas al mes. Llave en la Propiedad AIRLABS_KEY (se
         pega en hub.spacioam.com/alma/conexiones.html); va en la dirección (api_key), por eso nunca se escribe la
         dirección en un error ni en el registro. Si el mes llega a VIVO_AL_TOPE_ consultas, deja de preguntarle.
       - FlightAware (opcional): solo si hay FLIGHTAWARE_KEY y AirLabs no tiene llave o no encontró el vuelo. Cuesta
         ~$0.005 por consulta y su cuenta pide tarjeta (a Juan se la rechazó: por eso AirLabs, 3-nov-2026).
       - Sin llaves, o si los dos fallan, queda lo del correo, sin errores a la vista. Si el proveedor no trae puerta,
         se queda la del correo (o la última que sí dio).
   · Cuidar las consultas (iguales para los dos):
       - solo se pregunta dentro de la ventana: 3 h antes de la salida hasta 15 min después;
       - como mucho cada 10 min (cada 5 min en la última hora, si la app lo pide);
       - lo último se guarda en CacheService y en las Propiedades (VUELO_VIVO): fuera de la ventana nunca se pregunta.
   · Código compartido (comprado en Delta, operado por HOP, número de Air France): se pregunta y se muestra el número
     de quien lo vuela («AF 1234»), con «Vendido por Delta · opera HOP» en chico. Se pregunta primero con el número de
     quien vuela (el otro número del mismo vuelo en el correo, el «tambien» de viajeSinDobles_) y, si no aparece, con
     el del boleto. En AirLabs, cs_* es el otro número del mismo vuelo (vueloVivoAlNumeros_ decide cuál vuela).
   · Embarque: ningún proveedor da la hora de embarque. Se calcula: salida − 40 min (30 si el vuelo dura 2 h o
     menos), y se marca «aprox.».
   · Prueba: vueloPrueba_ (robot «vuelo_prueba» o el botón «Probar» de Conexiones, solo el admin) pregunta a AirLabs
     por un número y dice qué campos vinieron, para saber si el plan gratis da la puerta sin esperar un viaje.
   · Cupo de Google: canal «Viajes», por uf_. Es el vuelo de la persona: no se pausa. */

var VIVO_BASE_ = 'https://aeroapi.flightaware.com/aeroapi';
var VIVO_AL_BASE_ = 'https://airlabs.co/api/v9/flight';
var VIVO_AL_CAMPOS_ = 'flight_iata,flight_number,airline_iata,cs_airline_iata,cs_flight_iata,cs_flight_number,dep_iata,dep_gate,dep_terminal,' +
  'dep_time,dep_time_utc,dep_estimated,dep_estimated_utc,dep_actual,dep_actual_utc,dep_delayed,delayed,status,arr_terminal';   // arr_terminal: salas de la escala (salas.js)
var VIVO_AL_GRATIS_ = 1000, VIVO_AL_TOPE_ = 950;   // el plan gratis de AirLabs; se deja margen para las pruebas
var VIVO_PROP_ = 'VUELO_VIVO';            // { clave: lo último de ese tramo } — sobrevive a la caché
var VIVO_USO_PROP_ = 'VUELO_VIVO_USO';    // { mes, airlabs: { consultas, error }, flightaware: { consultas, error } } para Conexiones
var VIVO_COSTO_ = 0.005;                  // USD por consulta de /flights/{ident} (FlightAware, plan Personal)
var VIVO_MIN_ = 60000;
/* La ventana de consultas (3 h antes → 15 min después) está en viajeMomento_ (viajes.js): la misma para la tarjeta y Alma. */
var VIVO_CADA_ = 10 * VIVO_MIN_, VIVO_CADA_CERCA_ = 5 * VIVO_MIN_;      // cada cuánto, y en la última hora
/* El nombre corto de quien opera, por su código IATA (lo que no esté aquí se muestra como lo da el correo). */
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
  var t = v.tramos[p.tramo], vivo = vueloVivo_(v, t, ahora);
  /* Las salas Priority Pass de su terminal (salas.js): aquí sí se buscan si el aeropuerto es nuevo (una vez cada 30 días). */
  if (vivo) { var s = salasDelTramo_(t, vivo, ahora); if (s) vivo.salas = s; }
  return { ok: true, viaje: p.viaje, tramo: p.tramo, vivo: vivo };
}

/* Lo vivo de un tramo: lo del correo + lo último del proveedor (y pregunta otra vez si toca). Nunca lanza. */
function vueloVivo_(v, t, ahora, o) {
  o = o || {};
  try {
    var clave = vueloVivoClave_(t), g = vueloVivoGuardado_(clave);
    if (!o.soloGuardado && vueloVivoToca_(t, g, ahora)) g = vueloVivoPreguntar_(v, t, clave, g, ahora);
    return vueloVivoUnir_(v, t, g);
  } catch (e) { console.error('vueloVivo_: ' + vueloVivoSinLlave_(e.stack || e)); try { return vueloVivoUnir_(v, t, null); } catch (x) { return null; } }
}
function vueloVivoClave_(t) { return String(t.vuelo || '').replace(/\s/g, '') + '_' + String(t.sale || '').slice(0, 10); }

/* ¿Toca preguntar? Dentro de la ventana (3 h antes de la salida → 15 min después; la salida programada o la estimada,
   la que dé más ventana) y si ya pasó el tiempo desde la última consulta (10 min; 5 en la última hora). */
function vueloVivoToca_(t, g, ahora) {
  var mo = viajeMomento_(t, g && g.sale_ms ? { sale: new Date(g.sale_ms).toISOString() } : null, ahora);   // la misma regla que la tarjeta y Alma (viajes.js)
  if (!mo.vivo) return false;
  var cada = ahora >= Math.min(Date.parse(t.sale), mo.sale_ms) - 60 * VIVO_MIN_ ? VIVO_CADA_CERCA_ : VIVO_CADA_;
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
function vueloVivoIdent_(x) { return String(x || '').replace(/\s/g, '').toUpperCase(); }   // «AF 1234» → «AF1234»
/* La llave de AirLabs va en la dirección: un error de UrlFetch la repite. Se tapa antes de guardar o escribir nada. */
function vueloVivoSinLlave_(s) {
  return String(s || '').replace(/(https?:\/\/[^\s?"']+)\?[^\s"']*/g, '$1').replace(/(api_key=)[^&\s"']+/gi, '$1•••');
}

/* ── Preguntar: AirLabs → FlightAware (si tiene llave y AirLabs no dio el vuelo) → se queda lo del correo ── */
function vueloVivoPreguntar_(v, t, clave, g, ahora) {
  var p = PropertiesService.getScriptProperties(), llaveAl = p.getProperty('AIRLABS_KEY'), llaveFa = p.getProperty('FLIGHTAWARE_KEY');
  if (!llaveAl && !llaveFa) return g;   // sin llaves: lo del correo, sin preguntar
  var n = vueloVivoNumeros_(v, t), idents = [n.vuela, n.boleto].map(vueloVivoIdent_).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  var sale = Date.parse(t.sale), nuevo = JSON.parse(JSON.stringify(g || {})), f = null, error = '';
  nuevo.consultado = ahora;   // también si falla: no se vuelve a intentar hasta que toque
  if (llaveAl && vueloVivoUsoMes_('airlabs') < VIVO_AL_TOPE_) { var a = vueloVivoAirLabs_(llaveAl, idents, v, t); f = a.vuelo; error = a.error; }
  if (!f && llaveFa) { var b = vueloVivoFlightAware_(llaveFa, idents, t); f = b.vuelo; error = b.error || error; }
  if (f) {
    var antes = (g && g.puerta) || t.puerta || '';
    if (f.puerta && antes && f.puerta !== antes) nuevo.puerta_antes = antes;   // la puerta cambió: «antes B3»
    Object.keys(f).forEach(function (k) { if (f[k] !== '' && f[k] != null) nuevo[k] = f[k]; });   // sin puerta: se queda la anterior o la del correo
    nuevo.error = '';
  } else if (error) nuevo.error = error;
  vueloVivoGuardar_(clave, nuevo, sale);
  return nuevo;
}

/* ── AirLabs: /flight?flight_iata=…; primero el número de quien vuela y, si no aparece, el del boleto ── */
function vueloVivoAirLabs_(llave, idents, v, t) {
  var error = '';
  for (var i = 0; i < idents.length; i++) {
    var r = vueloVivoAlPedir_(llave, idents[i], VIVO_AL_CAMPOS_);
    if (r.error) { error = r.error; if (r.parar) break; continue; }
    var rec = vueloVivoAlElegir_(r.vuelo, t);
    if (rec) return { vuelo: vueloVivoDeAl_(rec, v, t), error: '' };
  }
  return { vuelo: null, error: error };
}
/* Una consulta a AirLabs → { vuelo (lo que vino en response), error, parar }. Cuenta en el uso del mes. Nunca lanza. */
function vueloVivoAlPedir_(llave, ident, campos) {
  var url = VIVO_AL_BASE_ + '?flight_iata=' + encodeURIComponent(ident) + (campos ? '&_fields=' + encodeURIComponent(campos) : '') + '&api_key=' + encodeURIComponent(llave);
  try {
    var r = uf_(url, { method: 'get', muteHttpExceptions: true, headers: { Accept: 'application/json' } }, 'Viajes'), code = r.getResponseCode(), j = null;
    try { j = JSON.parse(r.getContentText()); } catch (e) {}
    /* AirLabs contesta 200 con { error: { code, message } }: llave mala o límite del mes → no tiene caso probar el otro número */
    var err = j && j.error ? String(j.error.code || j.error.message || j.error) : code !== 200 ? 'http ' + code : !j ? 'respuesta rota' : '';
    if (err && /not.?found|no.?data|unknown.?flight/i.test(err)) err = '';   // no lo encontró: no es un error
    vueloVivoContar_('airlabs', err ? 'AirLabs: ' + err.slice(0, 80) : '');
    if (err) return { vuelo: null, error: err.slice(0, 120), parar: code === 401 || code === 403 || code === 429 || /key|limit|expired|plan|subscription/i.test(err) };
    return { vuelo: j ? j.response : null, error: '' };
  } catch (e) {
    var m = vueloVivoSinLlave_(String(e)).slice(0, 120);
    console.error('vueloVivoAlPedir_: ' + m); vueloVivoContar_('airlabs', 'AirLabs: ' + m);
    return { vuelo: null, error: m };
  }
}
/* Lo de AirLabs (un vuelo o una lista) → el que sale del mismo aeropuerto más cerca de la hora del correo (máx. 12 h). */
function vueloVivoAlElegir_(raw, t) {
  var mejor = null, dif = 12 * 60 * VIVO_MIN_, sale = Date.parse(t.sale), orig = t.origen && t.origen.iata;
  [].concat(raw || []).forEach(function (f) {
    if (!f || typeof f !== 'object') return;
    if (orig && f.dep_iata && String(f.dep_iata).toUpperCase() !== orig) return;
    var d = Math.abs(vueloVivoAlMs_(f.dep_time_utc, f.dep_time, t) - sale); if (!(d <= dif)) return;
    dif = d; mejor = f;
  });
  return mejor;
}
/* «2026-11-03 13:05» (UTC) → ms. Sin la UTC, la hora local del aeropuerto con el desfase de la salida del correo. */
function vueloVivoAlMs_(utc, local, t) {
  var a = function (s) { return String(s || '').trim().replace(' ', 'T'); };
  if (utc) { var u = Date.parse(a(utc) + (/[zZ]|[+-]\d\d:?\d\d$/.test(a(utc)) ? '' : 'Z')); if (!isNaN(u)) return u; }
  if (local) { var off = (/([+-]\d{2}:?\d{2}|Z)$/.exec(String(t.sale)) || [])[1] || 'Z', l = Date.parse(a(local) + (a(local).length === 16 ? ':00' : '') + off); if (!isNaN(l)) return l; }
  return NaN;
}
/* Qué número vuela y cuál se vendió. Juan lo leyó así: con cs_* lleno, flight_iata es quien opera y cs_* el vendido. Como
   no está confirmado, manda lo que ya sabemos del correo: si uno de los dos es el número de quien vuela, ese; si uno es
   el del boleto (el vendido), el otro. */
function vueloVivoAlNumeros_(f, v, t) {
  var a = vueloVivoIdent_(f.flight_iata), b = vueloVivoIdent_(f.cs_flight_iata), n = vueloVivoNumeros_(v, t);
  var vuela = vueloVivoIdent_(n.vuela), boleto = vueloVivoIdent_(n.boleto);
  if (!b || a === b) return { vuela: a, otro: '', aerolinea: String(f.airline_iata || '').toUpperCase() };
  var alReves = vuela !== boleto && (a === vuela || b === vuela) ? b === vuela : a === boleto;
  return alReves ? { vuela: b, otro: a, aerolinea: String(f.cs_airline_iata || n.prefijo(b)).toUpperCase() }
    : { vuela: a, otro: b, aerolinea: String(f.airline_iata || n.prefijo(a)).toUpperCase() };
}
/* Un vuelo de AirLabs → lo que importa, con las horas en la hora local del aeropuerto (mismo desfase que el correo). */
function vueloVivoDeAl_(f, v, t) {
  var prog = vueloVivoAlMs_(f.dep_time_utc, f.dep_time, t), est = vueloVivoAlMs_(f.dep_estimated_utc, f.dep_estimated, t);
  var real = vueloVivoAlMs_(f.dep_actual_utc, f.dep_actual, t), atraso = Number(f.dep_delayed != null ? f.dep_delayed : f.delayed) || 0;
  var salida = !isNaN(est) ? est : !isNaN(prog) ? prog + (atraso > 0 ? atraso * VIVO_MIN_ : 0) : NaN;
  var retraso = !isNaN(salida) && !isNaN(prog) ? Math.round((salida - prog) / VIVO_MIN_) : atraso;
  var st = String(f.status || '').toLowerCase(), num = vueloVivoAlNumeros_(f, v, t);
  var estado = st === 'cancelled' ? ['Cancelado', 'mal'] : (!isNaN(real) || st === 'active' || st === 'en-route' || st === 'landed') ? ['Salió', 'ok']
    : retraso >= 15 ? ['Retrasado ' + retraso + ' min', 'tarde'] : ['A tiempo', 'ok'];
  /* El desfase del aeropuerto según AirLabs (dep_time local − dep_time_utc): manda sobre el del correo para escribir la hora. */
  var loc = Date.parse(String(f.dep_time || '').trim().replace(' ', 'T') + (String(f.dep_time || '').trim().length === 16 ? ':00' : '') + 'Z');
  var off = f.dep_time_utc && !isNaN(loc) && !isNaN(prog) ? Math.round((loc - prog) / VIVO_MIN_) : null;
  if (off != null && (Math.abs(off) > 14 * 60 || off % 15)) off = null;
  var escribir = function (ms) { return off != null ? viajeIsoCon_(ms, off) : viajeHoraIgual_(t.sale, ms); };
  return { puerta: String(f.dep_gate || '').trim().slice(0, 8), terminal: String(f.dep_terminal || '').trim().slice(0, 8), terminal_llega: String(f.arr_terminal || '').trim().slice(0, 8),
    sale: isNaN(salida) ? '' : escribir(salida), sale_ms: isNaN(salida) ? 0 : salida, prog_ms: isNaN(prog) ? 0 : prog, desfase_min: off, numero: vueloVivoFormato_(num.vuela),
    opera_iata: num.aerolinea.slice(0, 3), codigos: num.otro ? [vueloVivoFormato_(num.otro)] : [], estado: estado[0], estado_tipo: estado[1],
    estado_original: st.slice(0, 40), fuente: 'airlabs' };
}

/* ── FlightAware (opcional): /flights/{ident} con fechas; mismo orden de números ── */
function vueloVivoFlightAware_(llave, idents, t) {
  var sale = Date.parse(t.sale), iso = function (ms) { return new Date(ms).toISOString().slice(0, 19) + 'Z'; }, error = '';
  for (var i = 0; i < idents.length; i++) {
    var url = VIVO_BASE_ + '/flights/' + encodeURIComponent(idents[i]) + '?start=' + encodeURIComponent(iso(sale - 6 * 60 * VIVO_MIN_)) + '&end=' + encodeURIComponent(iso(sale + 6 * 60 * VIVO_MIN_));
    try {
      var r = uf_(url, { method: 'get', muteHttpExceptions: true, headers: { 'x-apikey': llave, Accept: 'application/json' } }, 'Viajes');
      vueloVivoContar_('flightaware', r.getResponseCode() === 200 ? '' : 'FlightAware respondió ' + r.getResponseCode());
      if (r.getResponseCode() !== 200) { error = 'http ' + r.getResponseCode(); if (r.getResponseCode() === 401 || r.getResponseCode() === 403) break; continue; }
      var vuelo = vueloVivoElegir_(JSON.parse(r.getContentText()), t);
      if (vuelo) return { vuelo: vueloVivoDeFa_(vuelo, t), error: '' };
    } catch (e) { error = String(e).slice(0, 120); console.error('vueloVivoFlightAware_: ' + error); }
  }
  return { vuelo: null, error: error };
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
  return { puerta: String(f.gate_origin || '').trim().slice(0, 8), terminal: String(f.terminal_origin || '').trim().slice(0, 8), terminal_llega: String(f.terminal_destination || '').trim().slice(0, 8),
    sale: local(salida), sale_ms: Date.parse(salida) || 0, numero: vueloVivoFormato_(f.ident_iata || ''),
    opera_iata: String(f.operator_iata || '').toUpperCase().slice(0, 3), opera_fa: String(f.operator || '').slice(0, 40),
    codigos: (f.codeshares_iata || []).slice(0, 8).map(vueloVivoFormato_), estado: estado[0], estado_tipo: estado[1], estado_original: String(f.status || '').slice(0, 60), fuente: 'flightaware' };
}

/* Lo que ve Juan: el correo de base, lo del proveedor encima. */
function vueloVivoUnir_(v, t, g) {
  g = g || {};
  var n = vueloVivoNumeros_(v, t), numero = g.numero || vueloVivoFormato_(n.vuela);
  var limpio = function (s) { return String(s || '').replace(/[!*]+$/, '').trim(); };
  var opera = limpio(t.opera) || VIVO_AEROLINEAS_[g.opera_iata] || '';
  var duenoNum = VIVO_AEROLINEAS_[n.prefijo(numero)] || '', vende = String(v.aerolinea || '').split(/\s+/)[0];
  if (opera && duenoNum && opera.toLowerCase() === duenoNum.toLowerCase()) opera = '';   // un AF que vuela Air France: nada que aclarar
  var vendido = v.codigo_aerolinea && n.prefijo(numero) && v.codigo_aerolinea !== n.prefijo(numero) ? vende : '';
  if (opera && vende && opera.toLowerCase() === vende.toLowerCase()) opera = '';
  /* Las horas: el instante (UTC) del proveedor si lo hay, escrito en la hora local del aeropuerto. */
  var ref = g.desfase_min != null ? null : t.sale, escribir = function (ms) { return ref ? viajeHoraIgual_(ref, ms) : viajeIsoCon_(ms, g.desfase_min); };
  var sale = g.sale_ms ? escribir(g.sale_ms) : t.sale, dura = (Date.parse(t.llega) - Date.parse(t.sale)) / VIVO_MIN_;
  var embarque = escribir(Date.parse(sale) - (dura > 0 && dura <= 120 ? 30 : 40) * VIVO_MIN_);
  return { numero: numero, boleto: t.vuelo, vendido: vendido, opera: opera,
    puerta: g.puerta || t.puerta || '', puerta_antes: g.puerta_antes || '', terminal: g.terminal || (t.origen && t.origen.terminal) || '',
    terminal_llega: g.terminal_llega || (t.destino && t.destino.terminal) || '', asiento: t.asiento || '', sale: sale, sale_prog: g.prog_ms ? escribir(g.prog_ms) : t.sale, sale_utc: new Date(Date.parse(sale)).toISOString(),
    zona_nombre: t.zona_nombre || '', embarque: embarque, embarque_aprox: true,
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
/* El uso del mes, por proveedor. El formato viejo ({ mes, consultas, error }, solo FlightAware) se lee como FlightAware. */
function vueloVivoUso_(p) {
  var u = {}; try { u = JSON.parse(p.getProperty(VIVO_USO_PROP_) || '{}') || {}; } catch (e) {}
  if (u.consultas != null && !u.flightaware) u = { mes: u.mes, flightaware: { consultas: u.consultas, error: u.error || '' } };
  var mes = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM');
  return u.mes === mes ? u : { mes: mes };
}
function vueloVivoUsoMes_(prov) { try { return ((vueloVivoUso_(PropertiesService.getScriptProperties())[prov]) || {}).consultas || 0; } catch (e) { return 0; } }
/* Cuántas consultas van este mes con ese proveedor (para Conexiones) y el último error. */
function vueloVivoContar_(prov, error) {
  try {
    var p = PropertiesService.getScriptProperties(), u = vueloVivoUso_(p), x = u[prov] || { consultas: 0 };
    x.consultas = (x.consultas || 0) + 1; x.error = vueloVivoSinLlave_(error || '');
    u[prov] = x; p.setProperty(VIVO_USO_PROP_, JSON.stringify(u));
  } catch (e) {}
}
/* Para Conexiones: si hay llave y cuánto va del mes, por proveedor. La llave nunca se devuelve. */
function vueloVivoEstado_(p, prov) {
  var x = vueloVivoUso_(p)[prov] || {}, n = x.consultas || 0;
  if (prov === 'airlabs') return { llave: !!p.getProperty('AIRLABS_KEY'), consultas: n, gratis: VIVO_AL_GRATIS_, error: x.error || '' };
  return { llave: !!p.getProperty('FLIGHTAWARE_KEY'), consultas: n, costo: Math.round(n * VIVO_COSTO_ * 100) / 100, error: x.error || '' };
}

/* ── Prueba (robot «vuelo_prueba» o «Probar» en Conexiones; solo el admin): pregunta a AirLabs por un número, sin filtrar
   campos, y dice cuáles vinieron con dato. Sirve para saber si el plan gratis da la puerta sin esperar un viaje. Gasta
   una consulta del mes; no toca la tarjeta del vuelo. ── */
function vueloPrueba_(numero) {
  var ident = vueloVivoIdent_(numero);
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(ident)) return { ok: false, error: 'Escribe el número del vuelo, como AF1234 o DL 8632.' };
  var llave = PropertiesService.getScriptProperties().getProperty('AIRLABS_KEY');
  if (!llave) return { ok: false, error: 'Falta la llave de AirLabs: pégala en Conexiones.' };
  var r = vueloVivoAlPedir_(llave, ident, '');
  var base = { numero: vueloVivoFormato_(ident), consultas_mes: vueloVivoUsoMes_('airlabs'), gratis: VIVO_AL_GRATIS_ };
  if (r.error) return Object.assign({ ok: false, error: 'AirLabs: ' + r.error }, base);
  var f = [].concat(r.vuelo || [])[0];
  if (!f || typeof f !== 'object') return Object.assign({ ok: true, encontrado: false, aviso: 'AirLabs no tiene ese vuelo ahora (solo da los de hoy y los próximos días).' }, base);
  var lleno = function (k) { return f[k] !== null && f[k] !== undefined && f[k] !== ''; };
  var importan = ['dep_gate', 'dep_terminal', 'dep_iata', 'dep_time', 'dep_time_utc', 'dep_estimated', 'dep_estimated_utc', 'dep_actual', 'dep_delayed', 'delayed',
    'status', 'airline_iata', 'flight_iata', 'flight_number', 'cs_airline_iata', 'cs_flight_iata', 'cs_flight_number'];
  var muestra = {}; importan.forEach(function (k) { if (lleno(k)) muestra[k] = String(f[k]).slice(0, 40); });
  return Object.assign({ ok: true, encontrado: true, puerta: lleno('dep_gate') ? String(f.dep_gate) : '', trae_puerta: lleno('dep_gate'),
    con_dato: Object.keys(f).filter(lleno).sort(), vacios: importan.filter(function (k) { return !lleno(k); }), muestra: muestra }, base);
}
