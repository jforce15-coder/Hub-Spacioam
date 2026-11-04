/* ═══ VIAJES (issue #376, T1) ════════════════════════════════════════════════════════════════════════════
   El botón del avión en el inicio de la app (alma/inicio.html) pide la acción «viajes»: Alma busca en el correo los
   mensajes de la aerolínea (confirmación, check-in, recibo, boleto, pase de abordar) de los últimos 60 días, lee el
   itinerario con UNA llamada barata a la IA por correo nuevo (CFG.MODELO_CLASIFICADOR) y lo guarda en ALMA_VIAJES.
   · Un viaje = una confirmación (PNR). Los correos de la misma confirmación se juntan: el más nuevo completa terminal,
     puerta y asiento. Sin confirmación, el viaje se identifica por su primer vuelo.
   · Cada correo ya leído queda en ALMA_VIAJES_CORREOS (también los que no eran de un vuelo): nunca se paga dos veces.
   · Se revisa el correo como mucho cada 30 min (o al jalar hacia abajo, cada minuto). Lo demás sale de la hoja.
   · Horas: la IA da la hora local de cada aeropuerto; aquí se vuelve ISO con el desfase de la zona DEL AEROPUERTO
     («2026-11-03T05:55:00+01:00»). La zona sale de VIAJES_ZONAS_ (IATA → zona), luego de la que dio la IA y luego del
     país; nunca de Guatemala por defecto. Al leer la hoja se vuelve a calcular (viajeTramoHoras_), así un tramo guardado
     con el desfase equivocado se arregla solo. Cada tramo lleva sale_utc / llega_utc (el instante) y zona; la app muestra
     la hora local tal cual («11:45 hora de París») y compara con el reloj (el instante).
     3-nov-2026: un vuelo de Francia guardado con −06:00 corría 7 h tarde: ni tarjeta, ni AirLabs, ni Alma lo veían.
   · Lo que no depende de la hora va calculado: a qué hora llegar al aeropuerto (3 h antes si es internacional, 2 h si
     es nacional), cuándo abre el check-in (24 h antes del primer vuelo de cada trayecto) y el trayecto de cada tramo.
     La app decide con su reloj el próximo tramo, si el check-in ya abrió y si toca la vista centrada (2 h antes).
   · Pase de abordar: un PDF, una imagen o un pase de Wallet (.pkpass) adjunto que parezca pase o boleto se copia a la
     carpeta privada «Alma · Viajes» de Drive. «viajePase» lo devuelve: la primera página del PDF como imagen (la
     miniatura grande de Drive, guardada una vez en la misma carpeta: abrirlo otra vez no gasta nada), la imagen tal cual
     o el .pkpass para Wallet. Si la imagen aún no está, va el PDF para abrirlo.
   · Cupo de Google: canal «Viajes». Leer el correo con la IA es de fondo (se pausa desde el 60 %), salvo si hay un tramo
     en las próximas 48 h: el viaje de la persona no se pausa.
   · Quién: cada persona ve solo los viajes de SU correo. Hoy el único correo que el Hub puede leer es el de la cuenta que
     lo corre (la de Juan); se le muestra a quien es dueño de ese buzón (su correo o su correo alterno) o al administrador
     principal. Para los demás: cuando su correo esté conectado con el puente (correo.js, correo-puente/Código.gs), el
     puente mandará el texto de los correos que coincidan con VIAJES_BUSCA_ a una acción «viajesPuente» que llama a
     viajeLeerTexto_ con la cuenta de ese buzón (la persona sale de ALMA_CORREO_CUENTAS). Mientras, «viajes» les dice
     que su correo todavía no está conectado (sin error).
   · No se guarda el cuerpo de los correos: solo el itinerario, la confirmación, el pasajero y el id del mensaje. */

var VIAJES_HOJA_ = 'ALMA_VIAJES';
var VIAJES_CAB_ = ['id', 'email', 'confirmacion', 'aerolinea', 'pasajero', 'tramos', 'fuentes', 'checkin_url', 'pase', 'actualizado'];
var VIAJES_VISTOS_HOJA_ = 'ALMA_VIAJES_CORREOS';
var VIAJES_VISTOS_CAB_ = ['mensaje', 'email', 'viaje', 'fecha', 'asunto'];
var VIAJES_CARPETA_ = 'Alma · Viajes';
var VIAJES_BUSCA_ = '(from:(delta OR airfrance OR united OR american OR aa.com OR avianca OR copa OR iberia OR latam OR volaris OR jetblue OR klm OR lufthansa OR ryanair OR vueling OR "boarding pass") ' +
  'OR subject:(itinerary OR itinerario OR "check in" OR "boarding pass" OR "pase de abordar" OR "flight receipt" OR "confirmación de vuelo" OR "e-ticket"))' +
  ' -in:sent -category:promotions -from:samsung';   // fuera lo que mandamos (check-in a huéspedes) y las promociones de aerolíneas
var VIAJES_DIAS_ = 60, VIAJES_REVISAR_MIN_ = 30, VIAJES_POR_VUELTA_ = 8;
/* Dónde hacer check-in si el correo no trae el enlace (código IATA de la aerolínea). */
var VIAJES_CHECKIN_ = { DL: 'https://www.delta.com/mytrips/', AF: 'https://wwws.airfrance.us/check-in', KL: 'https://www.klm.com/check-in', UA: 'https://www.united.com/en/us/checkin',
  AA: 'https://www.aa.com/reservation/view/find-your-trip', IB: 'https://www.iberia.com/es/checkin-online/', AV: 'https://www.avianca.com/es/check-in/', CM: 'https://www.copaair.com/es-gs/check-in/',
  LA: 'https://www.latamairlines.com/us/es/check-in', B6: 'https://www.jetblue.com/check-in', LH: 'https://www.lufthansa.com/es/es/online-check-in', VY: 'https://www.vueling.com/es/servicios-vueling/check-in-online' };

/* La zona horaria de los aeropuertos de siempre (IATA → IANA). Manda sobre la que dice la IA (a veces viene vacía o mal). */
var VIAJES_ZONAS_ = (function () {
  var z = {
    'Europe/Paris': 'CDG ORY LYS NCE MRS TLS BOD NTE BES BIQ CFE MPL PUF LRT RNS SXB MLH BSL PGF LIL AJA BIA CLY PIS LRH LDE EGC FSC TLN BVA',
    'Europe/Madrid': 'MAD BCN VLC AGP SVQ BIO PMI ALC IBZ MAH SCQ OVD SDR VGO GRX XRY LEI REU ZAZ',
    'Atlantic/Canary': 'LPA TFN TFS ACE FUE SPC', 'Europe/Lisbon': 'LIS OPO FAO', 'Europe/London': 'LHR LGW STN LCY MAN EDI',
    'Europe/Amsterdam': 'AMS', 'Europe/Brussels': 'BRU', 'Europe/Berlin': 'FRA MUC BER DUS HAM', 'Europe/Zurich': 'ZRH GVA',
    'Europe/Rome': 'FCO MXP LIN VCE NAP', 'Europe/Dublin': 'DUB', 'Europe/Vienna': 'VIE', 'Europe/Copenhagen': 'CPH',
    'America/Guatemala': 'GUA FRS', 'America/El_Salvador': 'SAL', 'America/Tegucigalpa': 'SAP TGU', 'America/Costa_Rica': 'SJO LIR',
    'America/Panama': 'PTY', 'America/Bogota': 'BOG MDE CTG', 'America/Mexico_City': 'MEX GDL MTY', 'America/Cancun': 'CUN',
    'America/New_York': 'ATL JFK LGA EWR BOS MIA FLL MCO TPA IAD DCA BWI CLT DTW PHL RDU PIT', 'America/Chicago': 'ORD MDW MSP DFW IAH AUS MSY STL',
    'America/Denver': 'DEN SLC BZN MSO BIL GTF HLN FCA BTM JAC ABQ', 'America/Phoenix': 'PHX', 'America/Los_Angeles': 'LAX SFO SEA LAS SAN PDX SJC OAK',
    'America/Toronto': 'YYZ YUL YOW', 'America/Vancouver': 'YVR'
  }, out = {};
  Object.keys(z).forEach(function (k) { z[k].split(' ').forEach(function (i) { out[i] = k; }); });
  return out;
})();
/* Si el aeropuerto no está en la lista ni la IA dio zona: la del país. */
var VIAJES_ZONA_PAIS_ = { FR: 'Europe/Paris', ES: 'Europe/Madrid', PT: 'Europe/Lisbon', GB: 'Europe/London', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels',
  DE: 'Europe/Berlin', CH: 'Europe/Zurich', IT: 'Europe/Rome', IE: 'Europe/Dublin', GT: 'America/Guatemala', SV: 'America/El_Salvador', HN: 'America/Tegucigalpa',
  CR: 'America/Costa_Rica', PA: 'America/Panama', CO: 'America/Bogota', MX: 'America/Mexico_City' };
/* Cómo se nombra la hora en la app y en Alma («11:45 hora de París»). */
var VIAJES_ZONA_NOMBRE_ = { 'Europe/Paris': 'París', 'Europe/Madrid': 'Madrid', 'Atlantic/Canary': 'Canarias', 'Europe/Lisbon': 'Lisboa', 'Europe/London': 'Londres',
  'Europe/Amsterdam': 'Ámsterdam', 'Europe/Berlin': 'Alemania', 'Europe/Rome': 'Roma', 'America/Guatemala': 'Guatemala', 'America/Denver': 'Montana',
  'America/New_York': 'Nueva York', 'America/Chicago': 'Chicago', 'America/Los_Angeles': 'Los Ángeles', 'America/Mexico_City': 'México', 'America/Panama': 'Panamá' };

/* ── Acción «viajes» ── { forzar? } → { ok, cuenta, viajes:[…], proximo?, revisado, faltan, pausa?, conectar? } */
function viajes_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var cuenta = viajesCuenta_();
  if (!viajesPuede_(adm, cuenta)) return { ok: true, viajes: [], conectar: 'Tu correo todavía no está conectado a Alma para leer tus vuelos.' };
  try { viajesReparar_(cuenta); } catch (e) { console.error('viajesReparar_: ' + e); }
  var ahora = Date.now(), lista = viajesLeer_(cuenta), c = CacheService.getScriptCache(), clave = 'viajes_rev_' + cuenta;
  var ult = Number(c.get(clave) || 0), espera = (b.forzar ? 1 : VIAJES_REVISAR_MIN_) * 60000, out = { ok: true, cuenta: cuenta };
  if (ahora - ult >= espera) {
    var urgente = lista.some(function (v) { return viajeUrgente_(v, ahora); });
    if (!urgente && lista.length && !cupoPermite_('fondo')) out.pausa = 'Reviso tu correo cuando baje el uso de Google; te muestro lo que ya tenía.';
    else {
      try { out.faltan = viajesRevisar_(cuenta); } catch (e) { console.error('viajesRevisar_: ' + (e.stack || e)); out.aviso = 'No pude revisar el correo ahora.'; }
      if (!out.faltan) c.put(clave, String(ahora), 21600);   // si quedaron correos por leer, la próxima vez sigue
      lista = viajesLeer_(cuenta);
    }
  }
  out.revisado = new Date(Number(c.get(clave) || ahora)).toISOString();
  out.viajes = lista.filter(function (v) { return viajeVigente_(v, ahora); }).map(function (v) { return viajeCalcular_(v); })
    .sort(function (x, y) { return String(x.desde).localeCompare(String(y.desde)); });
  out.proximo = viajeProximo_(out.viajes, ahora);
  /* El próximo tramo lleva lo vivo (vuelovivo.js): puerta, embarque y número de quien lo vuela. AirLabs (o FlightAware) solo se
     pregunta dentro de su ventana; fuera de ella sale lo del correo y lo último guardado. */
  if (out.proximo) { var pv = out.viajes.filter(function (v) { return v.id === out.proximo.viaje; })[0]; if (pv) {
    var pt = pv.tramos[out.proximo.tramo]; pt.vivo = vueloVivo_(pv, pt, ahora);
    var sl = pt.vivo && salasDelTramo_(pt, pt.vivo, ahora, { soloGuardado: true }); if (sl) pt.vivo.salas = sl;   // salas.js: solo lo guardado (la búsqueda la hace «vueloVivo»)
  } }
  return out;
}

/* Para Alma (herramienta ver_vuelos): los mismos vuelos que Juan ve en el botón del avión, leídos de lo ya guardado (no
   revisa el correo ni gasta IA). Devuelve por tramo: vuelo, aerolínea, origen, destino, salida, llegada, puerta, asiento y cuándo abre el check-in. */
function viajesParaAlma_(adm) {
  if (!adm) return { ok: false, error: 'session' };
  var cuenta = viajesCuenta_(), ahora = Date.now();
  if (!viajesPuede_(adm, cuenta)) return { ok: true, viajes: [], nota: 'Tu correo todavía no está conectado a Alma para leer tus vuelos.' };
  var viajes = viajesLeer_(cuenta).filter(function (v) { return viajeVigente_(v, ahora); }).map(function (v) { return viajeCalcular_(v); })
    .sort(function (x, y) { return String(x.desde).localeCompare(String(y.desde)); });
  var lugar = function (l) { return (l.ciudad || '') + (l.iata ? ' (' + l.iata + ')' : '') + (l.terminal ? ' · terminal ' + l.terminal : ''); };
  /* «Mi vuelo» = el que va ahora o el próximo (la misma regla que la tarjeta). Ese sí puede preguntarle a AirLabs si está en
     su ventana; los demás, lo último guardado. */
  var p = viajeProximo_(viajes, ahora), mio = null;
  var tramo = function (v, t, i) {
    var mi = !!(p && p.viaje === v.id && p.tramo === i), vv = vueloVivo_(v, t, ahora, mi ? {} : { soloGuardado: true }) || {};
    var mo = viajeMomento_(t, vv, ahora), dest = VIAJES_ZONA_NOMBRE_[t.destino.zona] || viajeCiudad_(t.destino.ciudad);
    var x = { vuelo: vv.numero || t.vuelo, boleto: t.vuelo, opera: t.opera || v.aerolinea, desde: lugar(t.origen), hasta: lugar(t.destino),
      sale: viajeHoraTexto_(vv.sale || t.sale, t.zona_nombre) + ' · ' + String(vv.sale || t.sale).slice(0, 10), sale_utc: new Date(mo.sale_ms).toISOString(),
      llega: viajeHoraTexto_(t.llega, dest) + ' · ' + String(t.llega).slice(0, 10),
      embarque: vv.embarque ? viajeHoraTexto_(vv.embarque, t.zona_nombre) + ' (aprox.)' : undefined,
      puerta: vv.puerta || t.puerta || 'por asignar', puerta_antes: vv.puerta_antes || undefined, terminal: vv.terminal || t.origen.terminal || undefined,
      estado: vv.estado || (mo.aterrizo ? 'ya aterrizó' : mo.salio ? 'en el aire' : 'sale en ' + mo.faltan_min + ' min'),
      llegar_al_aeropuerto: viajeHoraTexto_(t.llegar, t.zona_nombre), checkin_abre: t.checkin_abre, asiento: t.asiento,
      datos: vv.fuente && vv.fuente !== 'correo' ? 'en vivo (' + vv.fuente + ', ' + vv.consultado + ')' : 'del correo (sin datos en vivo todavía: dilo así)' };
    if (mi) { mio = Object.assign({ es: p.en_el_aire ? 'el vuelo que va ahora' : 'tu próximo vuelo' }, x); mio.salas_priority_pass = salasParaAlma_(salasDelTramo_(t, vv, ahora)); }   // salas.js
    return x;
  };
  var out = viajes.map(function (v) {
    return { confirmacion: v.confirmacion, aerolinea: v.aerolinea, pasajero: v.pasajero, checkin_url: v.checkin_url,
      tramos: v.tramos.map(function (t, i) { return tramo(v, t, i); }) };
  });
  return { ok: true, ahora_utc: new Date(ahora).toISOString(), mi_vuelo: mio || undefined,
    nota: 'Las horas son la hora local de cada aeropuerto (dice de dónde). «mi_vuelo» es su vuelo de ahora o el próximo: úsalo cuando diga «mi vuelo». «salas_priority_pass» son las salas Priority Pass de su terminal (de prioritypass.com); si no viene, no las encontré para esa terminal.',
    viajes: out };
}

/* El buzón que el Hub puede leer: el de la cuenta que lo corre. */
function viajesCuenta_() { try { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; } }
function viajesPuede_(adm, cuenta) {
  if (!adm || !cuenta) return false;
  var mios = [adm.email].concat(adm.alternos || []).map(function (x) { return String(x || '').toLowerCase(); });
  return mios.indexOf(cuenta) >= 0 || esAdminPrincipal_(adm);
}

/* ── Leer el correo: los mensajes nuevos de aerolíneas, uno por uno con la IA, y juntarlos por confirmación ── */
function viajesRevisar_(cuenta) {
  var vistos = viajesVistos_(cuenta), nuevos = [];
  var hilos = GmailApp.search(VIAJES_BUSCA_ + ' newer_than:' + VIAJES_DIAS_ + 'd', 0, 40);
  hilos.forEach(function (h) { h.getMessages().forEach(function (m) { if (!vistos[m.getId()]) nuevos.push(m); }); });
  /* Lo más nuevo primero (el vuelo de mañana está en el correo de hoy); el filtro sin IA no gasta la tanda: solo cuentan
     los correos que sí se leen con la IA. Dentro de la tanda, del más viejo al más nuevo: lo nuevo completa lo viejo. */
  nuevos.sort(function (a, b) { return b.getDate() - a.getDate(); });
  var shV = hojaCrear_(VIAJES_VISTOS_HOJA_, VIAJES_VISTOS_CAB_), conIa = [], resto = 0;
  nuevos.forEach(function (m) {
    var asunto = String(m.getSubject() || '').slice(0, 150), texto = '';
    try { texto = String(m.getPlainBody() || ''); } catch (e) {}
    if (!viajeParecido_(asunto, texto)) { shV.appendRow([m.getId(), cuenta, '', new Date().toISOString(), asunto]); return; }
    if (conIa.length < VIAJES_POR_VUELTA_) conIa.push({ m: m, asunto: asunto, texto: texto }); else resto++;
  });
  conIa.reverse().forEach(function (x) {
    var m = x.m, id = m.getId(), asunto = x.asunto, texto = x.texto, vj = '', reintentar = false;
    try {
      var html = '';
      try { html = String(m.getBody() || ''); } catch (e) {}
      {
        USO_DET_ = 'Viajes · ' + asunto.slice(0, 80);
        var r = viajeLeerTexto_(cuenta, { id: id, de: m.getFrom(), asunto: asunto, fecha: m.getDate(), texto: texto, html: html });
        USO_DET_ = '';
        reintentar = r === false;   // la IA no contestó: se lee en la próxima vuelta
        if (r) { vj = r.id; try { viajePasesGuardar_(m, r.id); } catch (e) { console.error('viajePasesGuardar_: ' + e); } }
      }
    } catch (e) { console.error('viajes correo ' + id + ': ' + e); }
    if (!reintentar) shV.appendRow([id, cuenta, vj, new Date().toISOString(), asunto]);
  });
  return resto;
}
function viajesVistos_(cuenta) {
  var sh = hojaCrear_(VIAJES_VISTOS_HOJA_, VIAJES_VISTOS_CAB_), o = {};
  if (sh.getLastRow() < 2) return o;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { if (String(r[1]) === cuenta) o[String(r[0])] = 1; });
  return o;
}
/* Antes de gastar en la IA: ¿parece un correo con un itinerario? (un número de vuelo y una hora) */
function viajeParecido_(asunto, texto) {
  var t = String(asunto || '') + '\n' + String(texto || '').slice(0, 20000);
  return /flight|vuelo|itinerar|boarding|abordar|check.?in|e-?ticket|boleto|confirmaci|reserva|booking|receipt|recibo|trip/i.test(t) &&
    /\b(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}\b/.test(t) && /(^|\D)\d{1,2}:\d{2}(?!\d)/.test(t);   // «05:55AM» también
}

/* Un correo → su viaje (null si no era de un vuelo, false si la IA no contestó). Guarda y devuelve el viaje ya junto con los anteriores. */
function viajeLeerTexto_(cuenta, correo) {
  var j = viajeExtraer_(correo);
  if (j === false) return false;
  var nuevo = j && viajeNormalizar_(j, viajeIsoLocal_);
  if (!nuevo || !nuevo.tramos.length) return null;
  nuevo.email = cuenta; nuevo.fuentes = [correo.id];
  if (!nuevo.checkin_url) nuevo.checkin_url = viajeCheckinUrl_(correo.html, nuevo.codigo_aerolinea);
  var antes = viajeMismo_(viajesLeer_(cuenta), nuevo);
  if (!antes) nuevo.tramos = viajeSinDobles_(nuevo.tramos, nuevo.codigo_aerolinea);
  var v = antes ? viajeUnir_(antes, nuevo) : nuevo;
  viajeGuardar_(v);
  return v;
}

/* El viaje ya guardado que es este mismo: la misma confirmación o, si a uno le falta, un vuelo en común (mismo número y día).
   Se queda el id del guardado (así la fila no cambia) y gana la confirmación que sí venga. */
function viajeMismo_(lista, nuevo) {
  var clave = function (t) { return t.vuelo + '|' + String(t.sale).slice(0, 10); }, mias = nuevo.tramos.map(clave);
  return (lista || []).filter(function (v) { return v.id === nuevo.id; })[0] || (lista || []).filter(function (v) {
    if (v.confirmacion && nuevo.confirmacion && v.confirmacion !== nuevo.confirmacion) return false;
    return (v.tramos || []).some(function (t) { return mias.indexOf(clave(t)) >= 0; });
  })[0] || null;
}

var VIAJE_PROMPT_ = 'Lees un correo de una aerolínea o agencia de viajes. Devuelve SOLO JSON, sin markdown:\n' +
  '{"es_vuelo":true,"confirmacion":"código de reserva (PNR) o vacío","aerolinea":"nombre","codigo_aerolinea":"código IATA de 2 letras de quien vende",' +
  '"pasajero":"nombre como aparece","checkin_url":"","tramos":[{"vuelo":"DL 8632","opera":"aerolínea que opera si es otra, o vacío",' +
  '"origen":{"ciudad":"Valencia","iata":"VLC","pais":"ES","zona":"Europe/Madrid","terminal":""},"destino":{"ciudad":"Paris","iata":"CDG","pais":"FR","zona":"Europe/Paris","terminal":""},' +
  '"sale":"2026-11-03T05:55","llega":"2026-11-03T08:10","puerta":"","asiento":""}]}\n' +
  'Reglas: incluye TODOS los vuelos del itinerario (ida y vuelta, cada escala es un tramo), en orden. «sale» y «llega» son la hora LOCAL de cada aeropuerto ' +
  'tal como la dice el correo, en 24 h (yyyy-MM-ddTHH:mm); si el correo no da el año, usa el de la fecha del correo (o el siguiente si esa fecha ya pasó). ' +
  '«zona» es la zona horaria IANA del aeropuerto y «pais» su código ISO de 2 letras. Si no hay aeropuerto exacto, el principal de esa ciudad. ' +
  'No inventes terminal, puerta, asiento ni enlace: vacíos si el correo no los dice. Si el correo no trae un itinerario de vuelo (publicidad, millas, ' +
  'encuesta, cambio de contraseña), responde {"es_vuelo":false,"tramos":[]}.';
/* Una llamada barata a la IA por correo. */
function viajeExtraer_(correo) {
  var fecha = correo.fecha ? Utilities.formatDate(new Date(correo.fecha), CFG.TZ, 'yyyy-MM-dd') : '';
  var txt = viajeLimpiar_(correo.texto);
  var usr = 'DE: ' + String(correo.de || '') + '\nASUNTO: ' + String(correo.asunto || '') + '\nFECHA DEL CORREO: ' + fecha + '\n\n' + txt;
  var t = '';
  try { t = String(claude_(CFG.MODELO_CLASIFICADOR, 1500, VIAJE_PROMPT_, usr, 0) || ''); } catch (e) { console.error('viajeExtraer_: ' + e); }
  return t ? viajeJson_(t) : false;
}
function viajeJson_(t) {
  var m = /\{[\s\S]*\}/.exec(String(t || '')); if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}
/* Menos texto para la IA: sin enlaces largos, sin espacios de sobra, hasta 9000 letras. */
function viajeLimpiar_(texto) {
  return String(texto || '').replace(/\r/g, '').replace(/<https?:[^>\s]+>/g, '').replace(/https?:\/\/\S{60,}/g, '').replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 9000);
}

/* Lo que devuelve la IA → un viaje limpio. isoLocal(local, zona) da la hora con su desfase (en Apps Script, viajeIsoLocal_). */
function viajeNormalizar_(j, isoLocal) {
  if (!j || j.es_vuelo === false || !Array.isArray(j.tramos)) return null;
  var lugar = function (x) {
    x = x || {};
    return { ciudad: String(x.ciudad || '').trim().slice(0, 60), iata: String(x.iata || '').trim().toUpperCase().slice(0, 4), pais: String(x.pais || '').trim().toUpperCase().slice(0, 2),
      zona: String(x.zona || '').trim().slice(0, 60), terminal: String(x.terminal || '').trim().slice(0, 20) };
  };
  var tramos = j.tramos.map(function (t) {
    t = t || {};
    var o = lugar(t.origen), d = lugar(t.destino);
    o.zona = viajeZona_(o); d.zona = viajeZona_(d);
    var sale = viajeHora_(t.sale, o.zona, isoLocal), llega = viajeHora_(t.llega, d.zona, isoLocal);
    if (!sale || !(o.iata || o.ciudad) || !(d.iata || d.ciudad)) return null;
    return { vuelo: String(t.vuelo || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 12), opera: String(t.opera || '').trim().slice(0, 60), origen: o, destino: d,
      sale: sale, llega: llega || sale, puerta: String(t.puerta || '').trim().slice(0, 10), asiento: String(t.asiento || '').trim().slice(0, 10) };
  }).filter(Boolean).sort(function (a, b) { return Date.parse(a.sale) - Date.parse(b.sale); });
  if (!tramos.length) return null;
  var conf = String(j.confirmacion || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
  var cod = String(j.codigo_aerolinea || '').trim().toUpperCase().slice(0, 3) || (/^([A-Z0-9]{2})\s?\d/.exec(tramos[0].vuelo) || [])[1] || '';
  var url = String(j.checkin_url || '').trim();
  return { id: 'vj_' + (conf || (tramos[0].vuelo.replace(/\s/g, '') + '_' + tramos[0].sale.slice(0, 10))), confirmacion: conf, aerolinea: String(j.aerolinea || '').trim().slice(0, 60),
    codigo_aerolinea: cod, pasajero: String(j.pasajero || '').trim().slice(0, 80), tramos: tramos, fuentes: [], checkin_url: /^https:\/\//.test(url) ? url.slice(0, 500) : '', pases: [] };
}
/* «2026-11-03T05:55» + «Europe/Madrid» → «2026-11-03T05:55:00+01:00». La hora escrita es SIEMPRE la local del aeropuerto
   (así la pide el prompt): si ya trae un desfase, se ignora y se pone el de la zona (la IA a veces pone Z o el de otro lado). */
function viajeHora_(local, zona, isoLocal) {
  var s = String(local || '').trim().replace(' ', 'T');
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})/.exec(s); if (!m) return '';
  var base = m[1] + 'T' + ('0' + m[2]).slice(-2) + ':' + m[3];
  if (!zona) return /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : '';
  try { return (isoLocal || viajeIsoLocal_)(base, zona); } catch (e) { return ''; }
}
/* La zona del aeropuerto: la lista (por IATA) → la que dio la IA (si existe) → la del país → '' (no se adivina). */
function viajeZona_(l) {
  l = l || {};
  var iata = String(l.iata || '').toUpperCase(), z = String(l.zona || '').trim();
  if (VIAJES_ZONAS_[iata]) return VIAJES_ZONAS_[iata];
  if (z && viajeDesfaseMin_(z, Date.now()) != null) return z;
  return VIAJES_ZONA_PAIS_[String(l.pais || '').toUpperCase()] || '';
}
/* El desfase (en minutos) de una zona en un instante, o null si la zona no existe. Sin Utilities.formatDate: con una zona
   que no conoce, Apps Script devuelve GMT sin avisar. */
function viajeDesfaseMin_(zona, ms) {
  try {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var p = {}; f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var w = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    return Math.round((w - Math.floor(ms / 60000) * 60000) / 60000);
  } catch (e) {
    if (typeof Utilities === 'undefined' || !VIAJES_ZONA_NOMBRE_[zona] && Object.keys(VIAJES_ZONAS_).every(function (k) { return VIAJES_ZONAS_[k] !== zona; })) return null;
    try { var z = Utilities.formatDate(new Date(ms), zona, 'Z'); return (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5))); } catch (x) { return null; }
  }
}
/* Un instante con un desfase dado → «2026-11-03T12:25:00+01:00». */
function viajeIsoCon_(ms, off) {
  var a = Math.abs(off), d = new Date(ms + off * 60000).toISOString().slice(0, 19);
  return d + (off < 0 ? '-' : '+') + ('0' + Math.floor(a / 60)).slice(-2) + ':' + ('0' + (a % 60)).slice(-2);
}
/* «2026-11-03T12:25» en la zona → ISO con su desfase (también en el cambio de horario). */
function viajeIsoLocal_(base, zona) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(base), w = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  var off = viajeDesfaseMin_(zona, w); if (off == null) throw new Error('zona ' + zona);
  var off2 = viajeDesfaseMin_(zona, w - off * 60000); if (off2 != null && off2 !== off) off = off2;
  return viajeIsoCon_(w - off * 60000, off);
}
/* Al leer la hoja: la hora escrita del tramo + la zona de su aeropuerto → el desfase correcto, el instante en UTC y la zona.
   Arregla los tramos que se guardaron con el desfase de Guatemala (o sin zona). */
function viajeTramoHoras_(t) {
  if (!t) return t;
  ['origen', 'destino'].forEach(function (k) { var l = t[k] = t[k] || {}, z = viajeZona_(l); if (z) l.zona = z; });
  var s = viajeHora_(t.sale, t.origen.zona), l = viajeHora_(t.llega, t.destino.zona);
  if (s) t.sale = s; if (l) t.llega = l;
  t.sale_utc = isNaN(Date.parse(t.sale)) ? '' : new Date(Date.parse(t.sale)).toISOString();
  t.llega_utc = isNaN(Date.parse(t.llega)) ? '' : new Date(Date.parse(t.llega)).toISOString();
  t.zona_nombre = VIAJES_ZONA_NOMBRE_[t.origen.zona] || viajeCiudad_(t.origen.ciudad) || t.origen.iata || '';
  return t;
}
function viajeCiudad_(c) { return String(c || '').toLowerCase().replace(/(^|[\s-])(\S)/g, function (a, s, x) { return s + x.toUpperCase(); }); }
/* «12:25 hora de París» (la hora escrita del ISO, que ya es la local del aeropuerto). */
function viajeHoraTexto_(iso, nombre) {
  var m = /T(\d{2}):(\d{2})/.exec(String(iso || '')); if (!m) return '';
  return Number(m[1]) + ':' + m[2] + (nombre ? ' hora de ' + nombre : '');
}

/* El momento del tramo, UNA sola regla para la tarjeta (en la app, con las mismas cuentas), AirLabs y Alma.
   salida = la estimada del proveedor (si hay) o la del correo, ya en UTC. */
var VIAJE_TARJETA_ANTES_ = 100 * 60000,   // 1 h antes del embarque (embarque ≈ salida − 40 min)
    VIAJE_VIVO_ANTES_ = 180 * 60000, VIAJE_DESPUES_ = 15 * 60000;
function viajeMomento_(t, vivo, ahora) {
  var prog = Date.parse(t.sale), est = vivo && vivo.sale ? Date.parse(vivo.sale) : prog;
  if (isNaN(est)) est = prog;
  var desde = Math.min(prog, est), hasta = Math.max(prog, est);
  return { sale_ms: est, faltan_min: Math.round((est - ahora) / 60000),
    tarjeta: ahora >= desde - VIAJE_TARJETA_ANTES_ && ahora <= hasta + VIAJE_DESPUES_,
    vivo: ahora >= desde - VIAJE_VIVO_ANTES_ && ahora <= hasta + VIAJE_DESPUES_,
    salio: ahora >= est, aterrizo: ahora >= Date.parse(t.llega) };
}

/* Juntar dos lecturas del mismo viaje: los tramos por vuelo y día; lo nuevo completa (no borra) terminal, puerta y asiento. */
function viajeUnir_(viejo, nuevo) {
  /* Un tramo es el mismo si tiene el mismo vuelo y la misma ruta (aunque cambie la fecha: la aerolínea movió el vuelo y
     manda el correo más nuevo), o si sale a la misma hora por la misma ruta con otro número (código compartido: AF 1493 = DL 8632). */
  var v = JSON.parse(JSON.stringify(viejo));
  v.tramos = viajeSinDobles_(v.tramos, v.codigo_aerolinea || nuevo.codigo_aerolinea);
  var ruta = function (t) { return (t.origen && t.origen.iata) + '>' + (t.destino && t.destino.iata); };
  viajeSinDobles_(nuevo.tramos, v.codigo_aerolinea || nuevo.codigo_aerolinea).forEach(function (t) {
    var a = v.tramos.filter(function (x) { return x.vuelo === t.vuelo && ruta(x) === ruta(t); })[0] ||
      v.tramos.filter(function (x) { return ruta(x) === ruta(t) && Date.parse(x.sale) === Date.parse(t.sale); })[0];
    if (!a) { v.tramos.push(t); return; }
    ['puerta', 'asiento', 'opera'].forEach(function (k) { if (t[k]) a[k] = t[k]; });
    ['origen', 'destino'].forEach(function (k) { ['terminal', 'ciudad', 'iata', 'pais', 'zona'].forEach(function (x) { if (t[k][x]) a[k][x] = t[k][x]; }); });
    if (t.sale) a.sale = t.sale; if (t.llega) a.llega = t.llega;   // la aerolínea cambió la hora: manda el correo más nuevo
  });
  v.tramos.sort(function (a, b) { return Date.parse(a.sale) - Date.parse(b.sale); });
  ['aerolinea', 'pasajero', 'checkin_url', 'codigo_aerolinea', 'confirmacion'].forEach(function (k) { if (nuevo[k]) v[k] = nuevo[k]; });
  v.fuentes = (v.fuentes || []).concat((nuevo.fuentes || []).filter(function (f) { return (v.fuentes || []).indexOf(f) < 0; }));
  v.pases = (v.pases || []).concat((nuevo.pases || []).filter(function (p) { return !(v.pases || []).some(function (q) { return q.id === p.id; }); }));
  return v;
}

/* Una sola vez por cuenta (2-nov): los viajes leídos antes de este arreglo juntaban mal los tramos (código compartido
   repetido y la vuelta vieja de un boleto que se cambió). Se borran el viaje y los correos vistos de esa cuenta para que
   se vuelvan a leer, del más viejo al más nuevo, con la regla nueva. */
var VIAJES_REPARA_ = 'VIAJES_REPARADO_2_';
function viajesReparar_(cuenta) {
  var p = PropertiesService.getScriptProperties(); if (!cuenta || p.getProperty(VIAJES_REPARA_ + cuenta)) return;
  [[VIAJES_HOJA_, VIAJES_CAB_], [VIAJES_VISTOS_HOJA_, VIAJES_VISTOS_CAB_]].forEach(function (h) {
    var sh = hojaCrear_(h[0], h[1]), n = sh.getLastRow(); if (n < 2) return;
    var rg = sh.getRange(2, 1, n - 1, h[1].length), v = rg.getValues(), quedan = v.filter(function (r) { return String(r[1]) !== cuenta; });
    if (quedan.length === v.length) return;
    rg.clearContent();
    if (quedan.length) sh.getRange(2, 1, quedan.length, h[1].length).setValues(quedan);
  });
  CacheService.getScriptCache().remove('viajes_rev_' + cuenta);
  p.setProperty(VIAJES_REPARA_ + cuenta, new Date().toISOString());
}

/* Quita los tramos repetidos de un mismo correo: misma ruta y misma salida = el mismo vuelo con código compartido.
   Se queda el número de la aerolínea del boleto (DL) y anota el otro en «tambien». */
function viajeSinDobles_(tramos, codigo) {
  var out = [];
  (tramos || []).forEach(function (t) {
    var r = (t.origen && t.origen.iata) + '>' + (t.destino && t.destino.iata);
    var a = out.filter(function (x) { return (x.origen && x.origen.iata) + '>' + (x.destino && x.destino.iata) === r && Date.parse(x.sale) === Date.parse(t.sale); })[0];
    if (!a) { out.push(t); return; }
    var mio = function (x) { return codigo && String(x.vuelo || '').indexOf(codigo) === 0; };
    if (mio(t) && !mio(a)) { var otro = a.vuelo; Object.keys(t).forEach(function (k) { if (t[k]) a[k] = t[k]; }); a.tambien = otro; }
    else if (t.vuelo !== a.vuelo) a.tambien = t.vuelo;
    ['puerta', 'asiento'].forEach(function (k) { if (!a[k] && t[k]) a[k] = t[k]; });
  });
  return out;
}

/* ── Lo calculado (no depende de la hora): trayecto, internacional, a qué hora llegar y cuándo abre el check-in ── */
var VIAJE_H_ = 3600000;
function viajeCalcular_(v) {
  var t = (v.tramos || []).map(function (x) { return JSON.parse(JSON.stringify(x)); }), tray = 0, abre = 0;
  t.forEach(function (x, i) {
    if (i && Date.parse(x.sale) - Date.parse(t[i - 1].llega) > 24 * VIAJE_H_) tray++;   // más de un día en tierra: otro trayecto
    x.trayecto = tray;
    x.internacional = !!(x.origen.pais && x.destino.pais && x.origen.pais !== x.destino.pais);
    x.llegar = viajeHoraIgual_(x.sale, Date.parse(x.sale) - (x.internacional ? 3 : 2) * VIAJE_H_);
  });
  t.forEach(function (x, i) {
    if (!i || x.trayecto !== t[i - 1].trayecto) abre = Date.parse(x.sale) - 24 * VIAJE_H_;
    x.checkin_abre = new Date(abre).toISOString();
  });
  return { id: v.id, confirmacion: v.confirmacion, aerolinea: v.aerolinea, codigo_aerolinea: v.codigo_aerolinea || '', pasajero: v.pasajero,
    checkin_url: v.checkin_url || VIAJES_CHECKIN_[v.codigo_aerolinea] || '', tramos: t,
    pases: (v.pases || []).map(function (p) { return { id: p.id, tipo: p.tipo, nombre: p.nombre }; }),
    desde: t.length ? t[0].sale : '', hasta: t.length ? t[t.length - 1].llega : '', actualizado: v.actualizado || '' };
}
/* Un instante escrito en la hora local de otro ISO (mismo desfase): «2026-11-03T02:55:00+01:00». */
function viajeHoraIgual_(iso, ms) {
  var m = /([+-])(\d{2}):?(\d{2})$/.exec(String(iso)), off = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  var d = new Date(ms + off * 60000).toISOString().slice(0, 19);
  return d + (m ? m[1] + m[2] + ':' + m[3] : 'Z');
}
/* Se muestra desde 7 días antes del primer tramo hasta 5 días después del último. */
function viajeVigente_(v, ahora) {
  var t = v.tramos || []; if (!t.length) return false;
  return ahora >= Date.parse(t[0].sale) - 7 * 24 * VIAJE_H_ && ahora <= Date.parse(t[t.length - 1].llega) + 5 * 24 * VIAJE_H_;
}
/* Hay un tramo en las próximas 48 h (o en el aire): leer el correo no se pausa por cupo. */
function viajeUrgente_(v, ahora) {
  return (v.tramos || []).some(function (t) { var s = Date.parse(t.sale), l = Date.parse(t.llega); return l > ahora && s - ahora < 48 * VIAJE_H_; });
}
/* El próximo tramo (o el que va en el aire) y si toca la vista centrada (2 h antes de salir, hasta que aterriza). */
function viajeProximo_(viajes, ahora) {
  var mejor = null;
  (viajes || []).forEach(function (v) {
    (v.tramos || []).forEach(function (t, i) {
      if (Date.parse(t.llega) <= ahora) return;
      if (!mejor || Date.parse(t.sale) < Date.parse(mejor.sale)) mejor = { viaje: v.id, tramo: i, sale: t.sale };
    });
  });
  if (!mejor) return null;
  var v = viajes.filter(function (x) { return x.id === mejor.viaje; })[0], t = v.tramos[mejor.tramo];
  return { viaje: mejor.viaje, tramo: mejor.tramo, foco: ahora >= Date.parse(t.sale) - 2 * VIAJE_H_, en_el_aire: ahora >= Date.parse(t.sale),
    checkin_abierto: ahora >= Date.parse(t.checkin_abre) };
}

/* El enlace de check-in del correo (un <a> que dice check-in), si lo trae. */
function viajeCheckinUrl_(html, codigo) {
  var re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi, m, s = String(html || '');
  while ((m = re.exec(s))) {
    var texto = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^https:\/\//i.test(m[1]) && /check.?in|documentarse|registro en l[ií]nea|web check/i.test(texto)) return m[1].replace(/&amp;/g, '&').slice(0, 500);
  }
  return VIAJES_CHECKIN_[String(codigo || '').toUpperCase()] || '';
}

/* ── La hoja ── */
function viajesLeer_(cuenta) {
  var sh = hojaCrear_(VIAJES_HOJA_, VIAJES_CAB_); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, VIAJES_CAB_.length).getValues().filter(function (r) { return String(r[1]) === cuenta; }).map(viajeDeFila_).filter(Boolean)
    .map(function (v) { v.tramos = viajeSinDobles_((v.tramos || []).map(viajeTramoHoras_), v.codigo_aerolinea); return v; });
}
function viajeDeFila_(r) {
  try {
    var pase = r[8] ? JSON.parse(r[8]) : [];
    return { id: String(r[0]), email: String(r[1]), confirmacion: String(r[2]), aerolinea: String(r[3]), pasajero: String(r[4]), tramos: JSON.parse(r[5] || '[]'),
      fuentes: String(r[6] || '').split(',').filter(Boolean), checkin_url: String(r[7] || ''), pases: Array.isArray(pase) ? pase : [pase],
      codigo_aerolinea: (/^([A-Z0-9]{2})\s?\d/.exec((JSON.parse(r[5] || '[]')[0] || {}).vuelo || '') || [])[1] || '',
      actualizado: r[9] instanceof Date ? r[9].toISOString() : String(r[9] || '') };
  } catch (e) { return null; }
}
function viajeGuardar_(v) {
  var sh = hojaCrear_(VIAJES_HOJA_, VIAJES_CAB_), n = sh.getLastRow(), fila = 0;
  if (n >= 2) {
    var ids = sh.getRange(2, 1, n - 1, 2).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === v.id && String(ids[i][1]) === v.email) { fila = i + 2; break; }
  }
  v.actualizado = new Date().toISOString();
  var row = [v.id, v.email, v.confirmacion, v.aerolinea, v.pasajero, JSON.stringify(v.tramos), (v.fuentes || []).join(','), v.checkin_url || '', JSON.stringify(v.pases || []), v.actualizado];
  if (fila) sh.getRange(fila, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
}

/* ── Pase de abordar ── */
function viajeEsPase_(nombre, mime) {
  var n = String(nombre || '').toLowerCase(), t = String(mime || '').toLowerCase();
  if (/pkpass/.test(t) || /\.pkpass$/.test(n)) return 'pkpass';
  var parece = /board|pase|pass|ticket|boleto|e-?tkt|itiner|tarjeta de embarque|embarque/.test(n);
  if (/pdf/.test(t) || /\.pdf$/.test(n)) return parece ? 'pdf' : '';
  if (/^image\/(png|jpe?g|gif|webp)/.test(t)) return parece ? 'imagen' : '';
  return '';
}
function viajePasesGuardar_(m, viajeId) {
  var adj = []; try { adj = m.getAttachments({ includeInlineImages: false }) || []; } catch (e) { return; }
  var nuevos = [];
  adj.forEach(function (a) {
    var tipo = viajeEsPase_(a.getName(), a.getContentType()); if (!tipo || a.getSize() > 8 * 1024 * 1024) return;
    var f = viajesCarpeta_().createFile(a.copyBlob().setName(a.getName()));
    nuevos.push({ id: f.getId(), tipo: tipo, nombre: String(a.getName()).slice(0, 80), mensaje: m.getId() });
  });
  if (!nuevos.length) return;
  var cuenta = viajesCuenta_(), v = viajesLeer_(cuenta).filter(function (x) { return x.id === viajeId; })[0]; if (!v) return;
  v.pases = (v.pases || []).concat(nuevos); viajeGuardar_(v);
}
function viajesCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('VIAJES_CARPETA');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder(VIAJES_CARPETA_);   // privada: solo la cuenta del Hub
  p.setProperty('VIAJES_CARPETA', f.getId());
  return f;
}
/* Acción «viajePase» { id, pdf? } → { ok, tipo:'imagen'|'pdf'|'pkpass', mime, b64, nombre }. */
function viajePase_(ses, b) {
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var cuenta = viajesCuenta_(); if (!viajesPuede_(adm, cuenta)) return { ok: false, error: 'Ese pase no es tuyo.' };
  var id = String((b && b.id) || ''), v = null, p = null;
  viajesLeer_(cuenta).some(function (x) { var q = (x.pases || []).filter(function (y) { return y.id === id; })[0]; if (q) { v = x; p = q; } return !!q; });
  if (!p) return { ok: false, error: 'No encuentro ese pase.' };
  var blob;
  try {
    if (p.tipo === 'pdf' && !(b && b.pdf)) {
      if (!p.png) { p.png = viajePng_(p.id); if (p.png) viajeGuardar_(v); }
      if (p.png) blob = DriveApp.getFileById(p.png).getBlob();
    }
    if (!blob) blob = DriveApp.getFileById(p.id).getBlob();
  } catch (e) { return { ok: false, error: 'No pude abrir el pase: ' + String(e).slice(0, 120) }; }
  var mime = String(blob.getContentType() || ''), tipo = /^image\//.test(mime) ? 'imagen' : p.tipo === 'pkpass' ? 'pkpass' : 'pdf';
  if (tipo === 'pkpass') mime = 'application/vnd.apple.pkpass';
  return { ok: true, tipo: tipo, mime: mime, nombre: p.nombre, b64: Utilities.base64Encode(blob.getBytes()), hay_pdf: p.tipo === 'pdf' };
}
/* La primera página del PDF como imagen grande (miniatura de Drive a 1600 px), guardada en la carpeta: una sola vez. */
function viajePng_(fileId) {
  try {
    var o = { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
    var r = uf_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?fields=thumbnailLink', o, 'Viajes');
    var link = r.getResponseCode() === 200 ? String(JSON.parse(r.getContentText()).thumbnailLink || '') : '';
    if (!link) return '';   // Drive aún no la generó: se intenta la próxima vez
    var img = uf_(link.replace(/=s\d+$/, '') + '=s1600', o, 'Viajes');
    if (img.getResponseCode() !== 200) return '';
    return viajesCarpeta_().createFile(img.getBlob().setName('pase-' + fileId + '.png')).getId();
  } catch (e) { console.error('viajePng_: ' + e); return ''; }
}

/* Para probar a mano desde el editor: revisa el correo ya (sin esperar los 30 min) y muestra los viajes. */
function viajesProbar() {
  var cuenta = viajesCuenta_();
  CacheService.getScriptCache().remove('viajes_rev_' + cuenta);
  console.log('faltan: ' + viajesRevisar_(cuenta));
  console.log(JSON.stringify(viajesLeer_(cuenta).map(viajeCalcular_), null, 1).slice(0, 6000));
}
