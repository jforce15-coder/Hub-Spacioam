/* ═══ DISTANCIAS ═══════════════════════════════════════════════════════════════════════════════════
   El huésped pregunta «¿qué tan lejos está de la USAC / del aeropuerto / del centro?». ALMA calcula el tiempo
   real desde la propiedad (coordenadas de Hospitable) y responde en TIEMPO, no en km:
     · caminando 15 min o menos → «está a X min en carro y Y min si decides ir caminando»
     · caminando más de 15 min  → solo el tiempo en carro.
   Con GOOGLE_MAPS_KEY (propiedad del script) usa Google con tráfico real; sin llave, OpenStreetMap
   (Nominatim + OSRM) con un margen por tráfico. Casco 64A/64B: Google Maps se equivoca con su ubicación,
   así que para el centro/parque de Antigua se usa un valor fijo. */
var DIST_RX_ = /(qu[eé] tan (lejos|cerca)|a cu[aá]nto(s)? (tiempo|minutos|km|kil[oó]metros)?\s*(est[aá]|queda|me queda|estamos|de)|cu[aá]nto (tiempo|se tarda|me tardo|tardo|hay)|distancia|cerca (de|del)|lejos (de|del)|minutos (de|del|a|al)|how far|how long (does it take|to get|is it)|distance (to|from)|close to|near(by)? (the )?)/i;

function distFijo_(propiedad, destino) {
  if (!/casco\s*-?\s*64\s*[ab]\b/i.test(String(propiedad))) return null;
  if (/centro|parque|antigua|catedral|arco|plaza|ayuntamiento|downtown|central park|city cent/i.test(String(destino))) return { carro: 5, caminando: 15, fijo: true };
  return null;
}
function distPropiedades_() {
  var c = CacheService.getScriptCache(), v = c.get('dist_props'); if (v) { try { return JSON.parse(v); } catch (e) {} }
  var out = [], page = 1;
  for (; page <= 5; page++) {
    var r = hosp_('get', '/properties?per_page=100&page=' + page); if (r.code !== 200 || !r.json) break;
    (r.json.data || []).forEach(function (p) { var co = p.address && p.address.coordinates; if (co && co.latitude) out.push({ n: String(p.name || ''), lat: Number(co.latitude), lng: Number(co.longitude), dir: String((p.address || {}).display || '') }); });
    if (!r.json.meta || page >= Number(r.json.meta.last_page || 1)) break;
  }
  try { c.put('dist_props', JSON.stringify(out), 21600); } catch (e) {}
  return out;
}
function distOrigen_(propiedad) {
  var ps = distPropiedades_(); if (!ps.length || !propiedad) return null;
  var exacta = ps.filter(function (p) { return p.n.toLowerCase().replace(/\s+/g, '') === String(propiedad).toLowerCase().replace(/\s+/g, ''); })[0];
  if (exacta) return exacta;
  var m = bqMejor_(propiedad, ps.map(function (p) { return p.n; }));
  return m ? ps.filter(function (p) { return p.n === m; })[0] : null;
}
function distMin_(seg) { return Math.max(1, Math.round(seg / 60)); }
function distGoogle_(o, destino, key) {
  var base = 'https://maps.googleapis.com/maps/api/distancematrix/json?language=es&region=gt&origins=' + o.lat + ',' + o.lng + '&destinations=' + encodeURIComponent(destino + ', Guatemala') + '&key=' + key;
  var a = JSON.parse(UrlFetchApp.fetch(base + '&mode=driving&departure_time=now', { muteHttpExceptions: true }).getContentText() || '{}');
  var e = a.rows && a.rows[0] && a.rows[0].elements && a.rows[0].elements[0];
  if (!e || e.status !== 'OK') return null;
  var w = JSON.parse(UrlFetchApp.fetch(base + '&mode=walking', { muteHttpExceptions: true }).getContentText() || '{}');
  var ew = w.rows && w.rows[0] && w.rows[0].elements && w.rows[0].elements[0];
  return { carro: distMin_((e.duration_in_traffic || e.duration).value), caminando: ew && ew.status === 'OK' ? distMin_(ew.duration.value) : null,
    lugar: String((a.destination_addresses || [])[0] || destino), fuente: 'Google Maps (tráfico actual)' };
}
function distOSM_(o, destino) {
  var d = 0.35, vb = (o.lng - d) + ',' + (o.lat + d) + ',' + (o.lng + d) + ',' + (o.lat - d);
  /* Nominatim no entiende búsquedas largas: se prueba el nombre completo, la parte antes de la coma y sin paréntesis; primero cerca de la propiedad. */
  var variantes = [destino, String(destino).split(',')[0], String(destino).replace(/\(.*?\)/g, ' ')].map(function (x) { return String(x).replace(/\s+/g, ' ').trim(); }).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; });
  var g = [];
  for (var i = 0; i < variantes.length && !g.length; i++) {
    [true, false].some(function (cerca) {
      if (g.length) return true;
      var u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gt&email=hola@spacioam.com&q=' + encodeURIComponent(variantes[i]) + (cerca ? '&bounded=1&viewbox=' + vb : '');
      try { g = JSON.parse(UrlFetchApp.fetch(u, { muteHttpExceptions: true, headers: { 'Accept-Language': 'es' } }).getContentText() || '[]'); } catch (e) { g = []; }
      Utilities.sleep(1100);   // política de uso de Nominatim: 1 consulta por segundo
      return g.length > 0;
    });
  }
  if (!g.length) return null;
  var p = g[0], par = o.lng + ',' + o.lat + ';' + p.lon + ',' + p.lat;
  var car = JSON.parse(UrlFetchApp.fetch('https://router.project-osrm.org/route/v1/driving/' + par + '?overview=false', { muteHttpExceptions: true }).getContentText() || '{}');
  var pie = JSON.parse(UrlFetchApp.fetch('https://routing.openstreetmap.de/routed-foot/route/v1/driving/' + par + '?overview=false', { muteHttpExceptions: true }).getContentText() || '{}');
  if (!car.routes || !car.routes.length) return null;
  /* Sin tráfico real: se suma un margen (la ciudad casi nunca va a velocidad libre). */
  return { carro: Math.round(distMin_(car.routes[0].duration) * 1.4 + 3), caminando: pie.routes && pie.routes.length ? distMin_(pie.routes[0].duration) : null,
    lugar: String(p.display_name || destino).split(',').slice(0, 3).join(','), fuente: 'OpenStreetMap (aproximado, sin tráfico real)' };
}
/* Tiempo desde una propiedad hasta un lugar. */
function distanciaCalcular_(propiedad, destino) {
  var f = distFijo_(propiedad, destino); if (f) return Object.assign({ lugar: destino, fuente: 'valor fijo de la propiedad' }, f);
  var o = distOrigen_(propiedad); if (!o) return { error: 'sin coordenadas de la propiedad' };
  var c = CacheService.getScriptCache(), k = 'dist_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, o.n + '|' + String(destino).toLowerCase())).slice(0, 20);
  var v = c.get(k); if (v) { try { return JSON.parse(v); } catch (e) {} }
  var key = PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_KEY'), r = null;
  try { if (key) r = distGoogle_(o, destino, key); } catch (e) { console.error('distGoogle_: ' + e); }
  try { if (!r) r = distOSM_(o, destino); } catch (e) { console.error('distOSM_: ' + e); }
  if (!r) return { error: 'no encontré ese lugar' };
  try { c.put(k, JSON.stringify(r), 1800); } catch (e) {}
  return r;
}
function distanciaFrase_(r) {
  if (!r || r.error) return '';
  var walk = r.caminando != null && r.caminando <= 15;
  return walk ? r.carro + ' min en carro y ' + r.caminando + ' min caminando' : r.carro + ' min en carro' + (r.caminando != null ? ' (caminando sería ' + r.caminando + ' min: no lo menciones)' : '');
}
/* Si el huésped pregunta por tiempos o distancias, se calculan y se entregan al redactor dentro del conocimiento. */
function distanciaBloque_(propiedad, texto) {
  try {
    texto = String(texto || ''); if (!propiedad || !DIST_RX_.test(texto)) return '';
    var sys = 'Del mensaje de un huésped de un alojamiento en Guatemala, extrae los lugares a los que pregunta cuánto tiempo o qué tan lejos queda. ' +
      'Devuelve SOLO JSON: {"destinos":["nombre buscable del lugar, con ciudad si ayuda (p. ej. «Universidad de San Carlos USAC, Ciudad de Guatemala», «Aeropuerto La Aurora», «Parque Central, Antigua Guatemala»)"]}. Si no pregunta por un lugar concreto, {"destinos":[]}.';
    var j = JSON.parse(String(claude_(CFG.MODELO_CLASIFICADOR, 200, sys, texto.slice(-1500), 0)).match(/\{[\s\S]*\}/)[0]);
    var ds = (j.destinos || []).slice(0, 3); if (!ds.length) return '';
    var lineas = ds.map(function (d) { var r = distanciaCalcular_(propiedad, d); return r.error ? '- ' + d + ': no se pudo calcular (' + r.error + ')' : '- ' + d + ': ' + distanciaFrase_(r) + ' · ' + r.fuente; });
    return '\n\n## TIEMPOS CALCULADOS AHORA desde la propiedad (el huésped preguntó por esto)\n' + lineas.join('\n') +
      '\nCómo responder: habla en TIEMPO, no en kilómetros. Si caminando son 15 min o menos, di «está a X min en carro y Y min si decides ir caminando». ' +
      'Si caminar toma más de 15 min, menciona solo el tiempo en carro. Son aproximados: puedes decir «aproximadamente» o «según el tráfico». No pidas la dirección ni sugieras buscarlo en Google Maps.';
  } catch (e) { console.error('distanciaBloque_: ' + e); return ''; }
}
