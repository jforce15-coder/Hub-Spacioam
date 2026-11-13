/* ═══ AVISOS DE ATERRIZAJE (issue #426) ═══════════════════════════════════════════════════════════════════════════
   «Avísale a Lucky cuando aterrice»: Juan elige POR VIAJE a quién avisar (herramienta avisar_aterrizaje; decisión de Juan,
   3-nov-2026). En cada llegada final de un trayecto (la ida, la vuelta; las conexiones no) Alma le escribe a cada persona
   como «la asistente de Juan» (personalEnviar_: texto libre si escribió en 24 h; si no, la plantilla personal y lo demás
   cuando conteste, sin repetir la plantilla en el mismo vuelo):
     1. Retraso (decisión de Juan): si la llegada estimada queda 15 min o más después de la programada, o se mueve 15 min
        de la última hora que le dimos, la nueva hora de llegada. Como mucho 3 por vuelo.
     2. Al aterrizar: «Juan acaba de aterrizar en Guatemala (GUA), a las 14:05 hora de Guatemala.»
     3. Al llegar a la puerta (o 10 min después de tocar tierra): cuánto tarda en salir. Lo estima la IA en ese momento
        (decisión de Juan): aeropuerto, terminal, si es internacional, la hora, puerta, banda de maletas y si lleva maleta.
        La IA da los minutos; las horas las escribe el código. Si la IA falla, una cuenta simple marcada «aprox.».
   · «Solo en»: a una persona se le puede avisar solo en una llegada (p. ej. Lucky solo al volver a Guatemala).
   · Proveedor: el de la tarjeta del vuelo (vuelovivo.js): AirLabs y, si no lo dio, FlightAware. Sin llaves no se arma.
   · Consultas (cuentan en el mes del proveedor): nada hasta 3 h antes de la salida; cada 15 min hasta que sale, cada 30
     en el aire y cada 3 desde 20 min antes de la llegada estimada hasta el aviso 3 (~25 a 45 por vuelo). Si 3 h después
     de la llegada estimada no supo que aterrizó, deja de preguntar y se lo dice a Juan. Cancelado: solo a Juan.
   · Propiedad VUELO_AVISOS: { viajeId: { email, confirmacion, personas: [{ nombre, wa, solo }], maleta, desde_ms, revisado,
     tramos: { clave: { llega_est, llega_dicha, retrasos, aterrizo_ms, aviso1, aviso2, fin, consultado, plantilla } } } }.
     Se borra cuando ya no quedan llegadas.
   · Cupo de Google: canal «Viajes». Es el vuelo de la persona: no se pausa. */

var AVL_PROP_ = 'VUELO_AVISOS', AVL_MIN_ = 60000, AVL_H_ = 3600000;
var AVL_RETRASO_MIN_ = 15, AVL_MAX_RETRASOS_ = 3, AVL_PUERTA_MIN_ = 10, AVL_RENDIRSE_H_ = 3;
var AVL_AL_CAMPOS_ = 'flight_iata,cs_flight_iata,dep_iata,dep_time,dep_time_utc,arr_iata,arr_terminal,arr_gate,arr_baggage,' +
  'arr_time,arr_time_utc,arr_estimated,arr_estimated_utc,arr_actual,arr_actual_utc,arr_delayed,status';

/* ── La Propiedad (con candado: la herramienta y la vuelta de cada minuto la escriben) ── */
function avlLeer_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(AVL_PROP_) || '{}') || {}; } catch (e) { return {}; } }
function avlCambiar_(id, fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var p = PropertiesService.getScriptProperties(), todo = avlLeer_(), x = fn(todo[id] || null);
    if (x) todo[id] = x; else delete todo[id];
    if (Object.keys(todo).length) p.setProperty(AVL_PROP_, JSON.stringify(todo)); else p.deleteProperty(AVL_PROP_);
    return x;
  } finally { lock.releaseLock(); }
}
function avlNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
/* Las llegadas que se avisan: el último tramo de cada trayecto (las conexiones no). */
function avlLlegadas_(calc) {
  var t = calc.tramos || [];
  return t.filter(function (x, i) { return i === t.length - 1 || t[i + 1].trayecto !== x.trayecto; });
}
function avlDestino_(t) { return VIAJES_ZONA_NOMBRE_[t.destino.zona] || viajeCiudad_(t.destino.ciudad) || t.destino.iata || ''; }
function avlLugar_(t) { var c = viajeCiudad_(t.destino.ciudad) || avlDestino_(t); return c + (t.destino.iata ? ' (' + t.destino.iata + ')' : ''); }
function avlHora_(t, ms) { return viajeHoraTexto_(viajeHoraIgual_(t.llega, ms), avlDestino_(t)); }   // «14:05 hora de Guatemala»
function avlLeToca_(persona, t) {
  var s = avlNorm_(persona.solo); if (!s) return true;
  return [t.destino.iata, t.destino.ciudad, avlDestino_(t)].some(function (x) { var n = avlNorm_(x); return n && (n === s || n.indexOf(s) >= 0 || s.indexOf(n) >= 0); });
}

/* ── Herramienta avisar_aterrizaje: { vuelo, personas[], numero?, solo_en?, maleta?, quitar? } ── */
function avlCrear_(adm, inp, ctx) {
  inp = inp || {};
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede pedir avisos de sus vuelos.' };
  var cuenta = viajesCuenta_(); if (!viajesPuede_(adm, cuenta)) return { ok: false, error: 'Tu correo todavía no está conectado para leer tus vuelos.' };
  var vj = vigViaje_(cuenta, inp.vuelo); if (!vj) return { ok: false, error: 'No encontré ese viaje en tu correo. Usa la confirmación o un número de vuelo de ver_vuelos.' };
  var calc = viajeCalcular_(vj), ahora = Date.now();
  var nombres = [].concat(inp.personas || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  if (inp.quitar) {
    var queda = avlCambiar_(vj.id, function (a) {
      if (!a) return null;
      if (!nombres.length) return null;
      a.personas = a.personas.filter(function (p) { return !nombres.some(function (n) { return avlNorm_(p.nombre).indexOf(avlNorm_(n)) >= 0; }); });
      return a.personas.length ? a : null;
    });
    return { ok: true, viaje: calc.confirmacion, avisar_a: queda ? queda.personas.map(function (p) { return p.nombre; }) : [], nota: 'Listo: ya no aviso a ' + (nombres.join(', ') || 'nadie') + ' en este viaje.' };
  }
  var llegadas = avlLlegadas_(calc).filter(function (t) { return Date.parse(t.llega) > ahora; });
  if (!llegadas.length) return { ok: false, error: 'Ese viaje ya aterrizó.' };
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('AIRLABS_KEY') && !p.getProperty('FLIGHTAWARE_KEY')) return { ok: false, error: 'Para saber cuándo aterriza necesito la llave de AirLabs: pégala en Conexiones (hub.spacioam.com/alma/conexiones.html).' };
  if (!nombres.length && !inp.numero) return { ok: false, error: '¿A quién le aviso? Dime el nombre (y su WhatsApp si nunca le he escrito).' };
  if (!nombres.length) nombres = ['+' + normTel_(inp.numero)];
  var personas = [], faltan = [];
  nombres.forEach(function (n) {
    var x = avlPersona_(n, nombres.length === 1 ? inp.numero : '', ctx);
    if (x) personas.push({ nombre: x.nombre, wa: x.wa, solo: String(inp.solo_en || '').trim().slice(0, 40) }); else faltan.push(n);
  });
  if (faltan.length) return { ok: false, error: 'No encontré el WhatsApp de ' + faltan.join(', ') + '. Pídeselo a Juan (con código de país).' };
  var a = avlCambiar_(vj.id, function (a) {
    a = a || { email: adm.email, confirmacion: calc.confirmacion || '', personas: [], tramos: {} };
    personas.forEach(function (n) { a.personas = a.personas.filter(function (q) { return fin8_(q.wa) !== fin8_(n.wa); }).concat([n]); });
    if (inp.maleta === true || inp.maleta === false) a.maleta = inp.maleta;
    a.desde_ms = 0;   // la próxima vuelta lo vuelve a calcular
    return a;
  });
  var dice = llegadas.map(function (t) {
    var quien = a.personas.filter(function (q) { return avlLeToca_(q, t); }).map(function (q) { return q.nombre; });
    return t.vuelo + ' a ' + avlLugar_(t) + ', ' + viajeHoraTexto_(t.llega, avlDestino_(t)) + ' · ' + String(t.llega).slice(0, 10) + (quien.length ? ' → ' + quien.join(', ') : ' → nadie (no coincide «solo en»)');
  });
  return { ok: true, viaje: calc.confirmacion, avisar_a: a.personas.map(function (q) { return q.nombre + (q.solo ? ' (solo en ' + q.solo + ')' : ''); }), llegadas: dice,
    maleta: a.maleta === true ? 'sí' : a.maleta === false ? 'no' : 'no se sabe',
    nota: 'Dile en una frase a quién avisarás y en qué llegadas: si se retrasa, la nueva hora; al aterrizar; y luego cuánto tarda en salir. Si la persona no ha escrito en 24 h, primero le llega «¿Tienes un minuto?» y lo demás cuando conteste.' };
}
/* Nombre (y número opcional) → { nombre, wa }. Primero las conversaciones personales recientes, luego los contactos y el equipo. */
function avlPersona_(nombre, numero, ctx) {
  var wa = normTel_(numero || ''), n = String(nombre || '').trim();
  if (wa) return { nombre: /^\+/.test(n) ? '' : n, wa: wa };
  var r = null; try { r = personalPorNombre_(n); } catch (e) {}
  if (r && normTel_(r.wa)) return { nombre: n, wa: normTel_(r.wa) };
  var pp = null; try { pp = ctx ? agPersona_(n, ctx) : null; } catch (e) {}
  if (pp && normTel_(pp.tel)) return { nombre: n, wa: normTel_(pp.tel) };
  var f = ''; try { f = familiaNumero_(n); } catch (e) {}
  return f ? { nombre: n, wa: f } : null;
}
/* Para ver_vuelos: a quién se le avisa en ese viaje. */
function avlNombres_(viajeId) {
  var a = avlLeer_()[viajeId]; if (!a) return undefined;
  return a.personas.map(function (q) { return q.nombre + (q.solo ? ' (solo en ' + q.solo + ')' : ''); });
}

/* ── La vuelta de cada minuto (procesarCola): solo código; la IA solo para el aviso 3 ── */
function avlProcesar_() {
  var todo = avlLeer_(), ids = Object.keys(todo), ahora = Date.now(); if (!ids.length) return;
  var c = CacheService.getScriptCache(); if (c.get('avl_t')) return; c.put('avl_t', '1', 50);
  var toca = ids.filter(function (id) { return !(todo[id].desde_ms > ahora) || ahora - (todo[id].revisado || 0) > 6 * AVL_H_; });
  if (!toca.length) return;
  var canal0 = CUPO_CTX_; cupoCanal_('Viajes');
  try {
    var viajes = viajesLeer_(viajesCuenta_());
    toca.forEach(function (id) { try { avlViaje_(id, todo[id], viajes, ahora); } catch (e) { console.error('avlViaje_: ' + vueloVivoSinLlave_(e.stack || e)); } });
  } finally { CUPO_CTX_ = canal0; }
}
function avlViaje_(id, a, viajes, ahora) {
  var adm = adminPorEmail_(a.email), vj = viajes.filter(function (v) { return v.id === id; })[0];
  if (!vj || !adm) { avlCambiar_(id, function () { return null; }); return; }
  var calc = viajeCalcular_(vj), llegadas = avlLlegadas_(calc), desde = Infinity, abiertas = 0;
  llegadas.forEach(function (t) {
    var k = vueloVivoClave_(t), st = (a.tramos || {})[k] || {};
    if (st.fin) return;
    var quienes = a.personas.filter(function (q) { return avlLeToca_(q, t); });
    if (!quienes.length || Date.parse(t.llega) + 2 * 864e5 < ahora) return;
    abiertas++;
    var empieza = Date.parse(t.sale) - 3 * AVL_H_;
    if (ahora < empieza) { desde = Math.min(desde, empieza); return; }
    var antes = JSON.stringify(st);
    desde = Math.min(desde, avlTramo_(adm, a, calc, t, st, quienes, ahora) || ahora);
    if (JSON.stringify(st) !== antes) avlCambiar_(id, function (x) { if (!x) return null; x.tramos = x.tramos || {}; x.tramos[k] = st; return x; });
  });
  avlCambiar_(id, function (x) {
    if (!x) return null;
    if (!abiertas) return null;   // ya no quedan llegadas por avisar
    x.desde_ms = desde === Infinity ? 0 : desde; x.revisado = ahora; return x;
  });
}

/* Un tramo: pregunta si toca y manda lo que haga falta. Cambia st. Devuelve cuándo volver a mirarlo. */
function avlTramo_(adm, a, calc, t, st, quienes, ahora) {
  var prog = Date.parse(t.llega), est = st.llega_est || prog, juan = String((adm && adm.nombre) || 'Juan').split(' ')[0];
  if (!st.aterrizo_ms && ahora > est + AVL_RENDIRSE_H_ * AVL_H_) {
    st.fin = 'sin_dato';
    avisoPoner_(adm, 'vuelo_sin_hora', { vuelo: t.vuelo, quienes: avlLista_(quienes) }, 'avl:' + vueloVivoClave_(t) + ':sd', { nivel: 3 });
    return 0;
  }
  var cada = (st.aterrizo_ms || ahora >= est - 20 * AVL_MIN_ ? 3 : ahora < Date.parse(t.sale) ? 15 : 30) * AVL_MIN_ - 20000;
  if (st.consultado && ahora - st.consultado < cada) return Math.min(st.consultado + cada, est - 20 * AVL_MIN_ > ahora ? est - 20 * AVL_MIN_ : Infinity);
  st.consultado = ahora;
  var f = avlPreguntar_(calc, t) || {};
  if (f.cancelado) {
    st.fin = 'cancelado';
    avisoPoner_(adm, 'vuelo_cancelado', { vuelo: t.vuelo, quienes: avlLista_(quienes) }, 'avl:' + vueloVivoClave_(t) + ':cx', { nivel: 2 });
    return 0;
  }
  /* 1 · Retraso: la nueva hora de llegada (solo antes de aterrizar y si falta más de 10 min). */
  if (!st.aterrizo_ms && !f.aterrizo_ms && f.llega_est) {
    st.llega_est = f.llega_est;
    var base = st.llega_dicha || prog, dif = (f.llega_est - base) / AVL_MIN_;
    var cambio = st.llega_dicha ? Math.abs(dif) >= AVL_RETRASO_MIN_ : dif >= AVL_RETRASO_MIN_;
    if (cambio && (st.retrasos || 0) < AVL_MAX_RETRASOS_ && f.llega_est - ahora > 10 * AVL_MIN_) {
      var txt = (st.llega_dicha ? 'Cambió otra vez la hora del vuelo de ' + juan : 'El vuelo de ' + juan + ' viene con retraso') + ' (' + t.vuelo + '): ahora llega a ' +
        avlLugar_(t) + ' a las ' + avlHora_(t, f.llega_est) + ', en vez de las ' + avlHora_(t, base).replace(/ hora de .*$/, '') + '. Te aviso cuando aterrice.';
      avlMandarTodos_(adm, quienes, txt, st, t);
      st.llega_dicha = f.llega_est; st.retrasos = (st.retrasos || 0) + 1;
    }
  }
  /* 2 · Aterrizó. */
  if (f.aterrizo_ms && !st.aviso1) {
    st.aterrizo_ms = f.aterrizo_ms; st.aviso1 = ahora;
    var modos = avlMandarTodos_(adm, quienes, juan + ' acaba de aterrizar en ' + avlLugar_(t) + ', a las ' + avlHora_(t, f.aterrizo_ms) + '. En unos minutos te digo a qué hora calculo que sale.', st, t);
    var esperan = quienes.filter(function (q, i) { return modos[i] === 'plantilla' || modos[i] === 'pendiente'; });
    avisoPoner_(adm, 'vuelo_aterrizo', { quienes: avlLista_(quienes), lugar: avlLugar_(t), esperan: esperan.length ? avlLista_(esperan) : '' }, 'avl:' + vueloVivoClave_(t) + ':a1', { nivel: 3 });
  }
  /* 3 · En la puerta (o 10 min después): cuánto tarda en salir, estimado con IA. */
  if (st.aviso1 && !st.aviso2 && (f.en_puerta_ms || ahora - st.aterrizo_ms >= AVL_PUERTA_MIN_ * AVL_MIN_)) {
    st.aviso2 = ahora; st.fin = 'listo';
    avlMandarTodos_(adm, quienes, avlSalidaTexto_(juan, a, t, f, st.aterrizo_ms, ahora), st, t);
    return 0;
  }
  var cerca = (st.llega_est || prog) - 20 * AVL_MIN_;
  return Math.min(ahora + cada, cerca > ahora ? cerca : Infinity);
}
function avlLista_(q) { return q.map(function (x) { return x.nombre; }).join(' y ') || 'nadie'; }

/* ── El proveedor: lo de la llegada. AirLabs → FlightAware. → { llega_est, aterrizo_ms, en_puerta_ms, puerta, terminal, banda, cancelado } | null ── */
function avlPreguntar_(calc, t) {
  var p = PropertiesService.getScriptProperties(), llaveAl = p.getProperty('AIRLABS_KEY'), llaveFa = p.getProperty('FLIGHTAWARE_KEY');
  var n = vueloVivoNumeros_(calc, t), idents = [n.vuela, n.boleto].map(vueloVivoIdent_).filter(function (x, i, l) { return x && l.indexOf(x) === i; }), f = null;
  if (llaveAl && vueloVivoUsoMes_('airlabs') < VIVO_AL_TOPE_) {
    for (var i = 0; i < idents.length && !f; i++) {
      var r = vueloVivoAlPedir_(llaveAl, idents[i], AVL_AL_CAMPOS_);
      if (r.error) { if (r.parar) break; continue; }
      var rec = vueloVivoAlElegir_(r.vuelo, t); if (rec) f = avlDeAl_(rec, t);
    }
  }
  if (!f && llaveFa) f = avlFlightAware_(llaveFa, idents, t);
  return f;
}
function avlDeAl_(f, t) {
  var ms = function (u, l) { return vueloVivoAlMs_(u, l, { sale: t.llega }); };   // sin la UTC: la hora local con el desfase del destino
  var prog = ms(f.arr_time_utc, f.arr_time), est = ms(f.arr_estimated_utc, f.arr_estimated), real = ms(f.arr_actual_utc, f.arr_actual);
  var st = String(f.status || '').toLowerCase(), atraso = Number(f.arr_delayed) || 0;
  var llega = !isNaN(est) ? est : !isNaN(prog) ? prog + (atraso > 0 ? atraso * AVL_MIN_ : 0) : NaN;
  var aterrizo = !isNaN(real) ? real : st === 'landed' ? Date.now() : NaN;
  return { llega_est: isNaN(llega) ? 0 : llega, aterrizo_ms: isNaN(aterrizo) ? 0 : aterrizo, en_puerta_ms: 0, cancelado: st === 'cancelled',
    puerta: String(f.arr_gate || '').trim().slice(0, 8), terminal: String(f.arr_terminal || '').trim().slice(0, 8), banda: String(f.arr_baggage || '').trim().slice(0, 8) };
}
function avlFlightAware_(llave, idents, t) {
  var sale = Date.parse(t.sale), iso = function (ms) { return new Date(ms).toISOString().slice(0, 19) + 'Z'; };
  for (var i = 0; i < idents.length; i++) {
    var url = VIVO_BASE_ + '/flights/' + encodeURIComponent(idents[i]) + '?start=' + encodeURIComponent(iso(sale - 6 * AVL_H_)) + '&end=' + encodeURIComponent(iso(sale + 6 * AVL_H_));
    try {
      var r = uf_(url, { method: 'get', muteHttpExceptions: true, headers: { 'x-apikey': llave, Accept: 'application/json' } }, 'Viajes');
      vueloVivoContar_('flightaware', r.getResponseCode() === 200 ? '' : 'FlightAware respondió ' + r.getResponseCode());
      if (r.getResponseCode() !== 200) { if (r.getResponseCode() === 401 || r.getResponseCode() === 403) break; continue; }
      var f = vueloVivoElegir_(JSON.parse(r.getContentText()), t); if (!f) continue;
      var ms = function (s) { var x = Date.parse(s || ''); return isNaN(x) ? 0 : x; };
      return { llega_est: ms(f.estimated_in) || ms(f.estimated_on) || ms(f.scheduled_in), aterrizo_ms: ms(f.actual_on) || ms(f.actual_in), en_puerta_ms: ms(f.actual_in),
        cancelado: !!f.cancelled, puerta: String(f.gate_destination || '').trim().slice(0, 8), terminal: String(f.terminal_destination || '').trim().slice(0, 8),
        banda: String(f.baggage_claim || '').trim().slice(0, 8) };
    } catch (e) { console.error('avlFlightAware_: ' + String(e).slice(0, 120)); }
  }
  return null;
}

/* ── Aviso 3: cuánto tarda en salir. La IA da los minutos desde que tocó tierra; el código escribe las horas. ── */
var AVL_PROMPT_ = 'Estimas cuántos minutos tarda un pasajero desde que su avión toca tierra hasta que sale por la puerta de llegadas, en ESE aeropuerto y esa terminal. ' +
  'Usa lo que sabes de él: rodaje a la puerta, desembarque, distancia a migración, filas típicas de migración y aduana a esa hora y ese día (solo si el vuelo es internacional), ' +
  'y la entrega de maletas si lleva maleta documentada (si no se sabe, supón que sí). Responde SOLO JSON: {"min": número, "max": número, "razon": "una frase corta en español sencillo, sin horas ni cifras de minutos"}. ' +
  'min y max en minutos desde que tocó tierra; max − min entre 10 y 30.';
function avlEstimar_(a, t, f, aterrizo, ahora) {
  var local = viajeHoraIgual_(t.llega, aterrizo), dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var dia = dias[new Date(Date.parse(local.slice(0, 10) + 'T12:00:00Z')).getUTCDay()];
  var usr = ['Aeropuerto de llegada: ' + (t.destino.iata || '') + ' · ' + (t.destino.ciudad || '') + ' · país ' + (t.destino.pais || '?'),
    'Terminal: ' + (f.terminal || t.destino.terminal || 'no se sabe') + ' · puerta: ' + (f.puerta || 'no se sabe') + ' · banda de maletas: ' + (f.banda || 'no se sabe'),
    'Viene de: ' + (t.origen.iata || '') + ' · país ' + (t.origen.pais || '?') + ' · ' + (t.internacional ? 'INTERNACIONAL (migración y aduana)' : 'nacional'),
    'Tocó tierra: ' + local.slice(11, 16) + ' hora local, ' + dia + ' · hace ' + Math.round((ahora - aterrizo) / AVL_MIN_) + ' min' + (f.en_puerta_ms ? ' · ya en la puerta' : ''),
    'Maleta documentada: ' + (a.maleta === true ? 'sí' : a.maleta === false ? 'no, solo de mano' : 'no se sabe')].join('\n');
  try {
    var j = viajeJson_(claude_(CFG.MODELO_REDACTOR, 200, AVL_PROMPT_, usr, 0.2));
    var mn = Math.round(Number(j && j.min)), mx = Math.round(Number(j && j.max));
    if (mn > 0 && mx >= mn && mx <= 240) return { min: mn, max: mx, razon: String(j.razon || '').replace(/\s+/g, ' ').trim().slice(0, 200), ia: true };
  } catch (e) { console.error('avlEstimar_: ' + e); }
  /* Si la IA falla: una cuenta simple, marcada «aprox.» */
  var base = t.internacional ? 45 : 15, mal = a.maleta === false ? 0 : 20;
  return { min: base + mal, max: base + mal + 25, razon: '', ia: false };
}
function avlSalidaTexto_(juan, a, t, f, aterrizo, ahora) {
  var e = avlEstimar_(a, t, f, aterrizo, ahora);
  var lo = Math.max(aterrizo + e.min * AVL_MIN_, ahora + 5 * AVL_MIN_), hi = Math.max(aterrizo + e.max * AVL_MIN_, lo + 10 * AVL_MIN_);
  var red = function (ms) { return Math.round(ms / (5 * AVL_MIN_)) * 5 * AVL_MIN_; };   // a 5 min: suena natural
  var donde = [f.terminal ? 'terminal ' + f.terminal : '', f.puerta ? 'puerta ' + f.puerta : ''].filter(Boolean).join(', ');
  return (donde ? juan + ' ya va bajando del avión (' + donde + '). ' : '') +
    'Calculo que sale del aeropuerto entre las ' + avlHora_(t, red(lo)).replace(/ hora de .*$/, '') + ' y las ' + avlHora_(t, red(hi)) + (e.ia ? '' : ' (aprox.)') +
    (e.razon ? ': ' + e.razon.replace(/\.$/, '') + '.' : '.') + (f.banda ? ' Sus maletas salen en la banda ' + f.banda + '.' : '');
}

/* ── Mandar: como la asistente de Juan. Si ya le llegó la plantilla en este vuelo y no ha contestado, se suma a lo que
   recibe al contestar (sin otra plantilla). ── */
function avlMandarTodos_(adm, quienes, texto, st, t) { return quienes.map(function (q) { return avlMandar_(adm, q, texto, st, t); }); }   // → ['texto' | 'plantilla' | 'pendiente' | 'error']
function avlMandar_(adm, q, texto, st, t) {
  var k = fin8_(q.wa), abierta = false; try { abierta = waVentana_(q.wa); } catch (e) {}
  st.plantilla = st.plantilla || {};
  if (!abierta && st.plantilla[k]) {
    var p = PropertiesService.getScriptProperties(), pend = {}; try { pend = JSON.parse(p.getProperty('WA_PEND') || '{}'); } catch (e) {}
    (pend[k] = pend[k] || []).push({ texto: String(texto).slice(0, 3500), ts: Date.now(), nombre: q.nombre });
    p.setProperty('WA_PEND', JSON.stringify(pend));
    try { contactoRegistrar_(q.wa, q.nombre, '[pendiente: le llega cuando conteste] ' + texto); } catch (e) {}
    return 'pendiente';
  }
  var r = { ok: false, error: '' };
  try { r = personalEnviar_(adm, q.nombre, q.wa, texto, '', '', ''); } catch (e) { r = { ok: false, error: String(e.message || e).slice(0, 200) }; }
  if (r.ok && r.modo === 'plantilla') st.plantilla[k] = Date.now();
  if (!r.ok) avisoPoner_(adm, 'vuelo_fallo', { nombre: q.nombre, vuelo: t.vuelo, error: r.error }, 'avl:' + vueloVivoClave_(t) + ':' + k + ':' + Date.now(), { nivel: 2 });
  return r.ok ? r.modo || 'texto' : 'error';
}
