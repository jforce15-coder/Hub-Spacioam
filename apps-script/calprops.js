/* ═══ CALENDARIO DE PROPIEDADES (#446 T10 y T3) ═══════════════════════════════════════════════════════════════════════
   El bloque Calendario del Hub muestra las 63 propiedades: eliges las noches y ves cuáles están libres, por zona.
   · Sin llamar a Hospitable por cada propiedad al abrir: las estadías salen de la hoja Reservas (la copia de Hospitable que
     ya leen Alma y Hola) y las consultas de la bandeja (ALMA_INBOX). Los bloqueos y la estadía mínima solo los sabe el
     calendario de Hospitable: se guardan aquí cada vez que el Hub ya lo leyó (la hoja de una conversación o el calendario
     de una propiedad que abriste) y valen 6 h. Todo junto se guarda 5 min (CacheService).
   · Recientes: las 5 propiedades que más tocaste, por persona (hoja ALMA_CAL_RECIENTES). Sube la que abriste, la que un
     huésped consultó (una consulta nueva o un mensaje que pregunta por fechas) y la que tú o Alma nombraron en tu Chat
     con Alma. Gana la más reciente; una consulta de huésped de las últimas 24 h va primero.
   · Colores (glosario, «Colores del calendario»): reservado azul, consulta o solicitud amarillo, bloqueado rojo, libre
     verde, gris lo pasado o lo que no se puede reservar (estadía mínima, sin entrada ese día). */

var CALP_CAB_ = ['ts', 'usuario', 'propiedad', 'por'];
var CALP_DIAS_ATRAS_ = 7, CALP_DIAS_ADELANTE_ = 120;
var CALP_PIDE_FECHAS_ = /disponib|libre|fecha|noche|reserv|availab|free|dates?\b|night|book|semana|fin de semana|weekend/i;

/* «Z10 - Brunelo - 1203» → zona Z10, edificio Brunelo, unidad 1203. «Antigua - Casa Jacaranda» → zona Antigua. */
function calpPartes_(nombre) {
  var p = String(nombre || '').split(/\s+-\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (p.length >= 3) return { zona: p[0], edificio: p[1], unidad: p.slice(2).join(' '), corto: p[1] + ' ' + p.slice(2).join(' ') };
  if (p.length === 2) return { zona: p[0], edificio: p[1], unidad: '', corto: p[1] };
  return { zona: 'Otras', edificio: p[0] || '', unidad: '', corto: p[0] || '' };
}
function calpClave_(nombre) { return norm_(nombre).replace(/[^a-z0-9]+/g, ''); }

/* El catálogo de Hospitable (id, nombre y en qué canales está anunciada): una llamada por página cada 6 h. */
function calpCatalogo_() {
  var cache = CacheService.getScriptCache(), c0 = cache.get('calp_catalogo');
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  var out = [], p = 1;
  while (p <= 5) {
    var r = hosp_('get', '/properties?per_page=100&include=listings&page=' + p); if (r.code !== 200) break;
    var d = (r.json && r.json.data) || [];
    d.forEach(function (x) {
      var n = s_(x.name) || s_(x.public_name); if (!x.id || !n) return;
      var can = {}; (x.listings || []).forEach(function (l) { var c = canalPlat_(l.platform); if (c) can[c] = 1; });
      var co = (x.address && x.address.coordinates) || {};   // foto y coordenadas: las del tablero bento de la llamada (tarjeta.js)
      out.push({ id: s_(x.id), nombre: n, canales: Object.keys(can), foto: /^https:\/\//.test(s_(x.picture)) ? s_(x.picture) : '', lat: Number(co.latitude) || 0, lng: Number(co.longitude) || 0 });
    });
    if (d.length < 100) break; p++;
  }
  try { if (out.length) cache.put('calp_catalogo', JSON.stringify(out), 21600); } catch (e) {}
  return out;
}
/* Las propiedades: el catálogo de Hospitable y las que salen en Reservas (por si el catálogo no respondió). */
function calpPropiedades_(estadias) {
  var vistos = {}, out = [];
  var add = function (n, canales) { n = s_(n).trim(); var k = calpClave_(n); if (!n || !k) return; if (vistos[k]) { (canales || []).forEach(function (c) { if (vistos[k].canales.indexOf(c) < 0) vistos[k].canales.push(c); }); return; } vistos[k] = { nombre: n, canales: (canales || []).slice() }; out.push(vistos[k]); };
  try { calpCatalogo_().forEach(function (x) { add(x.nombre, x.canales); }); } catch (e) { console.error('calpPropiedades_: ' + e); }
  (estadias || []).forEach(function (e) { if (e.tipo !== 'consulta') add(e.propiedad, e.canal ? [e.canal] : []); });
  return out.sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
}

/* Estadías del rango: la hoja Reservas (no canceladas) y las consultas de la bandeja. */
function calpEstadias_(desde, hasta) {
  var out = [];
  leerTabla_(CFG.TAB_RESERVAS).forEach(function (r) {
    var st = s_(r.status).toLowerCase(); if (/cancel|declin|expired|denied|not_accepted/.test(st)) return;
    var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date); if (!ci || !co || co < desde || ci > hasta) return;
    var nom = [s_(r.guest_first_name), s_(r.guest_last_name)].filter(Boolean).join(' ') || s_(r.guest_name) || s_(r.guest);
    out.push({ propiedad: s_(r.property_name), checkin: ci, checkout: co, huesped: nom, canal: canalPlat_(r.platform || r.source || r.channel),
      tipo: /request|pending|inquiry|checkpoint/.test(st) ? 'solicitud' : 'reserva', codigo: s_(r.code) });
  });
  try {
    hubInbox_().forEach(function (x) {
      if (String(x.tipo) !== 'consulta' || !x.checkin || !x.checkout || !x.propiedad) return;
      var ci = String(x.checkin).slice(0, 10), co = String(x.checkout).slice(0, 10); if (co < desde || ci > hasta) return;
      out.push({ propiedad: x.propiedad, checkin: ci, checkout: co, huesped: s_(x.huesped), canal: canalPlat_(x.canal), tipo: 'consulta', conv: x.conv_id });
    });
  } catch (e) { console.error('calpEstadias_ bandeja: ' + e); }
  return out;
}

/* Lo que el calendario de Hospitable ya dijo de una propiedad (bloqueos, estadía mínima): 6 h en caché. */
function calpGuardarDias_(propiedad, dias) {
  try {
    var k = calpClave_(propiedad); if (!k || !dias || !dias.length) return;
    var poco = dias.filter(function (x) { return !x.libre && x.razon !== 'RESERVADO' || (x.min && x.min > 1) || x.sinEntrada; })
      .map(function (x) { return [x.fecha, x.libre ? 1 : 0, x.razon === 'BLOQUEADO' ? 'B' : x.razon === 'RESERVADO' ? 'R' : 'L', x.min || 0, x.sinEntrada ? 1 : 0]; });
    CacheService.getScriptCache().put('calpb_' + k, JSON.stringify({ desde: dias[0].fecha, hasta: dias[dias.length - 1].fecha, d: poco }), 21600);
  } catch (e) { console.error('calpGuardarDias_: ' + e); }
}
function calpBloqueos_(props) {
  var out = {};
  try {
    var claves = props.map(function (n) { return 'calpb_' + calpClave_(n); }), c = CacheService.getScriptCache();
    for (var i = 0; i < claves.length; i += 80) {
      var got = c.getAll(claves.slice(i, i + 80));
      Object.keys(got).forEach(function (k) { try { out[k.slice(6)] = JSON.parse(got[k]); } catch (e) {} });
    }
  } catch (e) { console.error('calpBloqueos_: ' + e); }
  return out;
}

/* Un día del calendario de Hospitable con el formato del Hub (lo usa también la hoja de la conversación). */
function calpDia_(x) {
  var st = x.status, disp = st && typeof st === 'object' ? st.available !== false : /avail/i.test(String(st || x.available));
  var razon = String((st && st.reason) || st || '').toUpperCase();
  var pr = x.price && typeof x.price === 'object' ? Number(x.price.amount) : Number(x.price);
  var min = Number(x.min_stay || x.minimum_stay || (x.stay && x.stay.min) || 0) || 0;
  return { fecha: s_(x.date).slice(0, 10), libre: !!disp, razon: disp ? 'LIBRE' : /RESERV|BOOK/.test(razon) ? 'RESERVADO' : 'BLOQUEADO', precio: isNaN(pr) ? null : pr / 100,
    min: min, sinEntrada: x.closed_for_checkin === true || !!(x.closed && x.closed.checkin) };
}

/* Las estadías de una propiedad para la hoja de su calendario (T3): la reserva de esta conversación va marcada. */
function calpEstadiasProp_(propiedad, desde, hasta, resId, checkin, checkout) {
  var k = calpClave_(propiedad); if (!k) return [];
  var lista = calpEstadias_(desde, hasta).filter(function (e) { return calpClave_(e.propiedad) === k; });
  var esta = lista.filter(function (e) { return e.checkin === checkin && e.checkout === checkout; })[0];
  if (esta) esta.esta = true;
  else if (checkin && checkout) lista.push({ propiedad: propiedad, checkin: checkin, checkout: checkout, huesped: '', canal: '', tipo: String(resId || '').indexOf('inq:') === 0 ? 'consulta' : 'reserva', esta: true });
  return lista.map(function (e) { return { checkin: e.checkin, checkout: e.checkout, huesped: e.huesped, canal: e.canal, tipo: e.tipo, esta: !!e.esta }; });
}

/* Recientes de una persona: lo que abrió, lo que preguntó un huésped y lo que se nombró en su Chat con Alma. */
function calpRecientes_(email, props) {
  var ev = {}, por = {}, ahora = Date.now();
  var poner = function (n, ts, quien, peso) {
    var k = calpClave_(n); if (!k) return; var t = new Date(ts).getTime(); if (isNaN(t) || t > ahora + 60000) return;
    var v = t + (peso || 0);
    if (!ev[k] || v > ev[k].v) ev[k] = { v: v, ts: new Date(t).toISOString(), por: quien, nombre: n };
  };
  var nombres = {}; props.forEach(function (n) { nombres[calpClave_(n)] = n; });
  var real = function (n) { return nombres[calpClave_(n)] || n; };
  try {
    var sh = ssAlma_().getSheetByName('ALMA_CAL_RECIENTES');
    if (sh && sh.getLastRow() >= 2) {
      var n0 = sh.getLastRow(), desde = Math.max(2, n0 - 1500);
      sh.getRange(desde, 1, n0 - desde + 1, CALP_CAB_.length).getValues().forEach(function (v) { if (String(v[1]) === email) poner(real(v[2]), v[0] instanceof Date ? v[0] : String(v[0]), String(v[3] || 'visto'), 0); });
    }
  } catch (e) { console.error('calpRecientes_ hoja: ' + e); }
  /* Huéspedes: una consulta o un mensaje que pregunta por fechas sube su propiedad; las de las últimas 24 h van primero. */
  try {
    hubInbox_().forEach(function (x) {
      if (!x.propiedad || String(x.conv_id).indexOf('wa:') === 0 || x.ultimo_de !== 'guest') return;
      var pide = String(x.tipo) === 'consulta' || CALP_PIDE_FECHAS_.test(String(x.ultimo_texto || ''));
      if (!pide) return;
      var t = new Date(x.ultimo_guest_ts || x.ultimo_ts).getTime();
      poner(real(x.propiedad), x.ultimo_guest_ts || x.ultimo_ts, 'huésped', ahora - t < 864e5 ? 864e5 : 0);
    });
  } catch (e) { console.error('calpRecientes_ bandeja: ' + e); }
  /* Chat con Alma de esta persona (lo que dijo ella o Alma): una propiedad cuenta si aparecen su edificio y su unidad. */
  if (email) {
    try {
      var pares = props.map(function (n) { var p = calpPartes_(n); return { n: n, ed: norm_(p.edificio), un: norm_(p.unidad) }; }).filter(function (p) { return p.ed && p.un; });
      opFilas_(email, 200).forEach(function (m) {
        var t = norm_(m.texto); if (!t) return;
        pares.forEach(function (p) { if (t.indexOf(p.ed) >= 0 && new RegExp('(^|[^a-z0-9])' + p.un.replace(/[^a-z0-9]/g, '\\$&') + '($|[^a-z0-9])').test(t)) poner(p.n, m.ts, m.de === 'alma' ? 'Alma' : 'tú', 0); });
      });
    } catch (e) { console.error('calpRecientes_ chat: ' + e); }
  }
  return Object.keys(ev).map(function (k) { return ev[k]; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5)
    .map(function (x) { return { propiedad: x.nombre, ts: x.ts, por: x.por }; });
}

/* hubApi_ → 'calendarioProps': todo lo que pinta el bloque Calendario en una sola llamada. */
function calpApi_(ses) {
  var hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), desde = sumarDias_(hoy, -CALP_DIAS_ATRAS_), hasta = sumarDias_(hoy, CALP_DIAS_ADELANTE_);
  var cache = CacheService.getScriptCache(), base = null;
  try { base = JSON.parse(cache.get('calp_base_' + hoy) || 'null'); } catch (e) {}
  if (!base) {
    var est = calpEstadias_(desde, hasta), props = calpPropiedades_(est);
    base = { propiedades: props.map(function (x) { var p = calpPartes_(x.nombre); return { nombre: x.nombre, zona: p.zona, edificio: p.edificio, unidad: p.unidad, corto: p.corto, canales: x.canales }; }), estadias: est };
    try { cache.put('calp_base_' + hoy, JSON.stringify(base), 300); } catch (e) { console.error('calp caché: ' + e); }
  }
  var nombres = base.propiedades.map(function (p) { return p.nombre; });
  return { ok: true, hoy: hoy, desde: desde, hasta: hasta, propiedades: base.propiedades, estadias: base.estadias, bloqueos: calpBloqueos_(nombres),
    recientes: calpRecientes_(ses && ses.email ? String(ses.email) : '', nombres) };
}
/* 'calendarioVisto': abriste una propiedad en el calendario → sube en tus Recientes. */
function calpVisto_(ses, propiedad, por) {
  var n = s_(propiedad).trim(); if (!n) return { ok: false, error: 'propiedad' };
  hojaCrear_('ALMA_CAL_RECIENTES', CALP_CAB_).appendRow([new Date().toISOString(), ses && ses.email ? String(ses.email) : 'equipo', celdaTexto_(n.slice(0, 120)), s_(por || 'visto').slice(0, 20)]);
  return { ok: true };
}
/* 'calendarioProp': el calendario de Hospitable de UNA propiedad (la que abriste), para ver bloqueos y estadía mínima.
   Se guarda 30 min; así abrirla otra vez no vuelve a llamar. */
function calpPropCal_(propiedad) {
  var n = s_(propiedad).trim(), k = calpClave_(n); if (!k) return { ok: false, error: 'propiedad' };
  var c = CacheService.getScriptCache(), ya = c.get('calpc_' + k);
  if (ya) { try { return JSON.parse(ya); } catch (e) {} }
  var pid = (calpCatalogo_().filter(function (x) { return calpClave_(x.nombre) === k; })[0] || {}).id;
  if (!pid) return { ok: false, error: 'No encontré esa propiedad en Hospitable' };
  var hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), ini = hoy.slice(0, 8) + '01', fin = sumarDias_(ini, 92);
  var r = hosp_('get', '/properties/' + pid + '/calendar?start_date=' + ini + '&end_date=' + fin);
  if (r.code !== 200) return { ok: false, error: 'Hospitable respondió ' + r.code };
  var cd = (r.json && r.json.data) || {}, lista = Array.isArray(cd) ? cd : (cd.days || []);
  var dias = lista.map(calpDia_).filter(function (x) { return x.fecha; });
  calpGuardarDias_(n, dias);
  var out = { ok: true, propiedad: n, inicio: ini, fin: fin, dias: dias };
  try { c.put('calpc_' + k, JSON.stringify(out), 1800); } catch (e) {}
  return out;
}
