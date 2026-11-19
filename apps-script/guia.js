/* ═══ GUÍA DE CAMINO (pedido pc1794926294829, issue #661) ═══════════════════════════════════════════════════════════
   Juan: «Alma debe dar direcciones por voz, preguntando el medio de transporte y recordando preferencias para guiar paso a
   paso justo a tiempo, mostrando mapa en la app».
   · Quién guía: la app de iPhone (alma-app, GuiaCamino.swift). En la llamada, Alma usa la herramienta de cliente
     guiar_camino (vozGuiaHerramientas_, abajo); la app manda su ubicación a la acción guiaCamino, abre el mapa y dice cada
     paso al oído cuando Juan llega a ese punto (justo a tiempo), con la voz de Alma, también con el teléfono bloqueado.
   · El medio de transporte: caminando, carro, bici o bus. Si Juan no lo dice, se usa el que eligió la última vez para ese
     mismo lugar y, si no, el último que usó; la primera vez Alma pregunta (necesita_modo). Lo que elige se recuerda
     (Propiedad GUIA_PREF_<huella del correo>: { modo, destinos: { lugar: modo } }, 30 lugares como mucho).
   · La ruta: Google Maps de Apps Script (Maps.newDirectionFinder, sin llave), en español, desde donde está el teléfono.
     El lugar se busca primero cerca de él (unos 50 km) y si no, donde sea.
   · Desde el Modo calle: «¿cómo llego a…?», «llévame a…» abre la llamada sin la IA (guiaPideCamino_ en calle.js) y Alma
     sigue con guiar_camino.
   · Las reglas van en la descripción de la herramienta, no en el prompt (el presupuesto de la voz ya está lleno). */

/* maps = el valor de Maps.DirectionFinder.Mode (en minúsculas: con 'WALKING' Apps Script responde «Argumento no válido: mode»). */
var GUIA_MODOS_ = {
  caminando: { maps: 'walking', texto: 'caminando' },
  carro: { maps: 'driving', texto: 'en carro' },
  bici: { maps: 'bicycling', texto: 'en bici' },
  bus: { maps: 'transit', texto: 'en bus' }
};
var GUIA_LUGARES_ = 30;   // cuántos lugares con su medio se recuerdan
var GUIA_PASOS_ = 90;     // lo más que se manda a la app (con los avisos y los «vas bien» de los puntos de referencia)

/* «a pie», «en moto», «en Uber», «transporte público»… → caminando | carro | bici | bus | '' */
function guiaModo_(t) {
  t = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t.trim()) return '';
  if (/camin|a pie|andando|walk/.test(t)) return 'caminando';
  if (/bici|bicicleta|bike|cicl/.test(t)) return 'bici';
  if (/\bbus\b|camioneta|transmetro|transporte publico|publico|metro|tren|transit/.test(t)) return 'bus';
  if (/carro|auto|coche|manej|moto|uber|taxi|driv|car\b/.test(t)) return 'carro';
  return '';
}

function guiaClaveLugar_(destino) {
  return String(destino || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
function guiaPropPref_(email) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(email || '').toLowerCase());
  return 'GUIA_PREF_' + Utilities.base64EncodeWebSafe(h).replace(/=+$/, '').slice(0, 16);
}
function guiaPrefLeer_(email) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(guiaPropPref_(email)) || '{}') || {}; } catch (e) { return {}; }
}
/* Recuerda el medio: el general y el de ese lugar (el más reciente al final; se borran los más viejos). */
function guiaPrefGuardar_(email, destino, modo) {
  var p = guiaPrefLeer_(email), k = guiaClaveLugar_(destino);
  p.modo = modo; p.destinos = p.destinos || {};
  if (k) { delete p.destinos[k]; p.destinos[k] = modo; }
  var ks = Object.keys(p.destinos); while (ks.length > GUIA_LUGARES_) delete p.destinos[ks.shift()];
  try { PropertiesService.getScriptProperties().setProperty(guiaPropPref_(email), JSON.stringify(p)); } catch (e) { console.error('guiaPrefGuardar_: ' + e); }
  return p;
}
/* El medio recordado: { modo, por: 'lugar' | 'ultimo' } o null. */
function guiaPrefModo_(email, destino) {
  var p = guiaPrefLeer_(email), k = guiaClaveLugar_(destino);
  if (k && p.destinos && GUIA_MODOS_[p.destinos[k]]) return { modo: p.destinos[k], por: 'lugar' };
  if (GUIA_MODOS_[p.modo]) return { modo: p.modo, por: 'ultimo' };
  return null;
}

/* Lo que Google escribe en HTML («Gira a la <b>derecha</b> en <b>5a Av</b><div>El destino está a la derecha</div>»)
   → una frase para decir al oído. */
function guiaTexto_(html) {
  var t = String(html || '').replace(/<div[^>]*>/gi, '. ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').replace(/\s+\./g, '.').replace(/\.\s*\./g, '.').trim();
  return t ? t.replace(/[.\s]+$/, '') + '.' : '';
}
/* Un tramo en bus: «Toma el bus 101 hacia Centro en la parada X. Bájate en Y, después de 6 paradas.» */
function guiaTextoBus_(st) {
  var d = st.transit_details || {}, l = d.line || {}, v = (l.vehicle && l.vehicle.name) || 'bus';
  var linea = l.short_name || l.name || '', n = Number(d.num_stops || 0);
  var t = 'Toma el ' + String(v).toLowerCase() + (linea ? ' ' + linea : '') + (d.headsign ? ' hacia ' + d.headsign : '') +
    (d.departure_stop && d.departure_stop.name ? ' en la parada ' + d.departure_stop.name : '') + '.';
  if (d.arrival_stop && d.arrival_stop.name) t += ' Bájate en ' + d.arrival_stop.name + (n ? ', después de ' + n + (n === 1 ? ' parada' : ' paradas') : '') + '.';
  return t;
}
/* Los pasos de Google → [{ texto, lat, lng, metros, seg, antes? }] (el punto es donde se hace la maniobra: el inicio del paso).
   En bus, los tramos a pie traen sus propios pasos: se aplanan. */
function guiaPasos_(leg) {
  var out = [];
  (leg.steps || []).forEach(function (st) {
    if (st.travel_mode === 'TRANSIT') {
      out.push({ texto: guiaTextoBus_(st), lat: st.start_location.lat, lng: st.start_location.lng, metros: st.distance ? st.distance.value : 0, seg: st.duration ? st.duration.value : 0, bus: true });
      /* Bajarse: se avisa antes (antes, en metros), porque en el bus 40 m es tarde. */
      var bajar = st.transit_details && st.transit_details.arrival_stop;
      if (st.end_location) out.push({ texto: 'Prepárate para bajarte' + (bajar && bajar.name ? ' en ' + bajar.name : '') + '.', lat: st.end_location.lat, lng: st.end_location.lng, metros: 0, seg: 0, antes: 350 });
      return;
    }
    var subs = st.steps && st.steps.length ? st.steps : [st];
    subs.forEach(function (s) {
      var t = guiaTexto_(s.html_instructions || st.html_instructions); if (!t || !s.start_location) return;
      out.push({ texto: t, lat: s.start_location.lat, lng: s.start_location.lng, metros: s.distance ? s.distance.value : 0, seg: s.duration ? s.duration.value : 0,
        maniobra: String(s.maneuver || ''), tramo: (s.polyline && s.polyline.points) || '' });
    });
  });
  return out;
}

/* ── Puntos de referencia (pedido pc1795047765857, issue #839) ──────────────────────────────────────────────────────
   Juan: «a diferencia de Google, que usáramos landmarks para guiar: nombres de tiendas cercanas, monumentos». Con la ruta
   de Google se buscan, en UNA consulta gratis a OpenStreetMap (Overpass), los lugares con nombre junto a cada cruce y a
   mitad de los tramos largos. Con ellos la guía suma, sin cambiar la app (usa `antes`, que ya entiende):
     · Aviso antes del cruce: «Sigue recto hasta la farmacia Galeno; ahí cruzas a la izquierda. Yo te aviso.»
     · En el cruce: «Ahora, en la farmacia Galeno: cruza a la izquierda hacia 5a Avenida.»
     · A mitad de un tramo largo: «Excelente, vas bien: vas a ver la tienda de tabacos La Esquina. Sigue recto.»
   Sin referencia cerca, el aviso dice los metros y el cruce queda como lo dice Google («gira» → «cruza», como en Guatemala).
   El bus no lleva referencias (lo guían sus paradas). GUIA_REFERENCIAS = 0 lo apaga; en la reserva del cupo no se busca. */
var GUIA_REF_ = {   // aviso: metros antes del cruce · cerca: qué tan lejos del punto puede estar la referencia
  caminando: { aviso: 120, cerca: 35, umbral: 25 },
  bici: { aviso: 180, cerca: 40, umbral: 45 },
  carro: { aviso: 450, cerca: 60, umbral: 150 },
  bus: { aviso: 120, cerca: 35, umbral: 40 }   // los tramos a pie del viaje en bus
};
var GUIA_REF_PUNTOS_ = 40;   // lo más que se consulta a OpenStreetMap por ruta
var GUIA_REF_URL_ = 'https://overpass-api.de/api/interpreter';
/* Qué es cada lugar de OpenStreetMap → [cómo se nombra, importancia 1-3]. Lo que no está aquí no sirve de referencia
   (parqueos, bancas, basureros…), salvo cualquier tienda (shop), que es «la tienda». */
var GUIA_REF_TIPOS_ = {
  'amenity=pharmacy': ['la farmacia', 3], 'amenity=bank': ['el banco', 3], 'amenity=fuel': ['la gasolinera', 3],
  'amenity=place_of_worship': ['la iglesia', 3], 'amenity=marketplace': ['el mercado', 3], 'amenity=hospital': ['el hospital', 3],
  'amenity=townhall': ['la municipalidad', 3], 'amenity=fountain': ['la fuente', 3], 'amenity=university': ['la universidad', 3],
  'amenity=school': ['el colegio', 2], 'amenity=clinic': ['la clínica', 2], 'amenity=restaurant': ['el restaurante', 2],
  'amenity=fast_food': ['el restaurante', 2], 'amenity=cafe': ['el café', 2], 'amenity=bar': ['el bar', 1],
  'amenity=cinema': ['el cine', 2], 'amenity=theatre': ['el teatro', 2], 'amenity=police': ['la estación de policía', 2],
  'amenity=post_office': ['el correo', 2], 'amenity=library': ['la biblioteca', 2],
  'shop=supermarket': ['el supermercado', 3], 'shop=mall': ['el centro comercial', 3], 'shop=tobacco': ['la tienda de tabacos', 2],
  'shop=bakery': ['la panadería', 2], 'shop=hardware': ['la ferretería', 2], 'shop=convenience': ['la tienda', 2], 'shop=*': ['la tienda', 2],
  'tourism=museum': ['el museo', 3], 'tourism=hotel': ['el hotel', 2], 'tourism=viewpoint': ['el mirador', 2],
  'tourism=attraction': ['', 3], 'tourism=artwork': ['', 2],
  'historic=monument': ['el monumento', 3], 'historic=memorial': ['el monumento', 3], 'historic=church': ['la iglesia', 3],
  'historic=ruins': ['las ruinas', 3], 'historic=*': ['', 3],
  'leisure=park': ['el parque', 3], 'leisure=stadium': ['el estadio', 3], 'leisure=sports_centre': ['el centro deportivo', 2]
};
function guiaRefNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
/* Las etiquetas de un lugar → { texto: «la farmacia Galeno», peso } o null. */
function guiaRefNombre_(tags) {
  tags = tags || {}; var nombre = String(tags.name || '').replace(/\s+/g, ' ').trim();
  if (!nombre || nombre.length > 40) return null;
  var tipo = null;
  ['historic', 'tourism', 'leisure', 'amenity', 'shop'].some(function (k) {
    if (!tags[k]) return false;
    tipo = GUIA_REF_TIPOS_[k + '=' + tags[k]] || GUIA_REF_TIPOS_[k + '=*'] || null;
    return !!tipo;
  });
  if (!tipo) return null;
  var dicho = tipo[0]; if (!dicho) return { texto: nombre, peso: tipo[1] };
  var art = dicho.split(' ')[0], sust = dicho.split(' ').slice(1).join(' ');
  /* «Farmacia Galeno» ya dice qué es: «la Farmacia Galeno», no «la farmacia Farmacia Galeno». «La Esquina» no: «la tienda
     de tabacos La Esquina». */
  var ya = guiaRefNorm_(nombre).indexOf(guiaRefNorm_(sust.split(' ')[0])) === 0;
  return { texto: ya && !/^(el|la|los|las) /i.test(nombre) ? art + ' ' + nombre : dicho + ' ' + nombre, peso: tipo[1] };
}

/* La línea codificada de Google → [{ lat, lng }]. */
function guiaDecodificar_(s) {
  s = String(s || ''); var out = [], i = 0, lat = 0, lng = 0;
  function uno() { var r = 0, sh = 0, c; do { if (i >= s.length) return null; c = s.charCodeAt(i++) - 63; r |= (c & 31) << sh; sh += 5; } while (c >= 32); return (r & 1) ? ~(r >> 1) : (r >> 1); }
  while (i < s.length) { var a = uno(), b = uno(); if (a === null || b === null) break; lat += a; lng += b; out.push({ lat: lat / 1e5, lng: lng / 1e5 }); }
  return out;
}
function guiaMetros_(a, b) {
  var r = 6371000, k = Math.PI / 180, dLat = (b.lat - a.lat) * k, dLng = (b.lng - a.lng) * k;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}
/* El punto que está a la mitad (en metros) de una línea, o null. */
function guiaMitad_(linea) {
  var pts = guiaDecodificar_(linea); if (pts.length < 2) return null;
  var total = 0, i; for (i = 1; i < pts.length; i++) total += guiaMetros_(pts[i - 1], pts[i]);
  var falta = total / 2;
  for (i = 1; i < pts.length; i++) {
    var d = guiaMetros_(pts[i - 1], pts[i]);
    if (d >= falta) { var t = d ? falta / d : 0; return { lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * t, lng: pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * t }; }
    falta -= d;
  }
  return pts[pts.length - 1];
}

/* «turn-left», «Gira a la izquierda…» → «a la izquierda» | «a la derecha» | '' (seguir recto o rotonda no lleva aviso). */
function guiaGiro_(maniobra, texto) {
  var m = String(maniobra || '');
  if (/left/.test(m)) return 'a la izquierda';
  if (/right/.test(m)) return 'a la derecha';
  if (m) return '';
  var t = guiaRefNorm_(texto);
  if (/^(gira|dobla|cruza)[^.]*izquierda/.test(t)) return 'a la izquierda';
  if (/^(gira|dobla|cruza)[^.]*derecha/.test(t)) return 'a la derecha';
  return '';
}
/* En Guatemala se «cruza» a la izquierda: «Gira a la izquierda…» → «Cruza a la izquierda…». */
function guiaCruza_(texto) {
  return String(texto || '').replace(/^Gira ligeramente/, 'Cruza un poco').replace(/^Gira bruscamente/, 'Cruza bien').replace(/^Gira /, 'Cruza ');
}
function guiaMinus_(t) { t = String(t || ''); return t.charAt(0).toLowerCase() + t.slice(1); }
function guiaRedondeo_(m) { return m >= 1000 ? (Math.round(m / 100) / 10 + ' kilómetros').replace('.', ',') : Math.max(50, Math.round(m / 50) * 50) + ' metros'; }

/* Los lugares con nombre cerca de los puntos (una sola consulta a Overpass, guardada 6 h) → [{ texto, peso, lat, lng }]. */
function guiaLugaresCerca_(puntos, radio) {
  if (!puntos.length) return [];
  var q = '[out:json][timeout:6];(' + puntos.map(function (p) {
    return 'nwr(around:' + radio + ',' + p.lat.toFixed(5) + ',' + p.lng.toFixed(5) + ')[name][~"^(shop|amenity|tourism|historic|leisure)$"~"."];';
  }).join('') + ');out center tags 400;';
  var c = null, k = 'guia_ref_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, q)).slice(0, 22);
  try { c = CacheService.getScriptCache(); var v = c.get(k); if (v) return JSON.parse(v); } catch (e) {}
  var r = uf_(GUIA_REF_URL_, { method: 'post', payload: { data: q }, muteHttpExceptions: true, headers: { 'User-Agent': 'SpacioAM-Hub/1.0 (guia de camino)' } }, 'Guía');
  if (r.getResponseCode() !== 200) { console.error('guiaLugaresCerca_: Overpass ' + r.getResponseCode()); return []; }
  var out = [];
  (JSON.parse(r.getContentText()).elements || []).forEach(function (el) {
    var n = guiaRefNombre_(el.tags), lat = el.lat != null ? el.lat : el.center && el.center.lat, lng = el.lon != null ? el.lon : el.center && el.center.lon;
    if (n && lat != null && lng != null) out.push({ texto: n.texto, peso: n.peso, lat: Number(lat), lng: Number(lng) });
  });
  try { if (c) c.put(k, JSON.stringify(out).slice(0, 95000), 21600); } catch (e) {}
  return out;
}
/* La mejor referencia junto al punto (cerca, importante y que no se haya usado) → su texto o ''. */
function guiaRefJunto_(lugares, p, cerca, usados) {
  var mejor = null, nota = Infinity;
  lugares.forEach(function (l) {
    var d = guiaMetros_(p, l); if (d > cerca || usados[guiaRefNorm_(l.texto)]) return;
    var n = d - 15 * l.peso; if (n < nota) { nota = n; mejor = l; }
  });
  if (!mejor) return '';
  usados[guiaRefNorm_(mejor.texto)] = 1;
  return mejor.texto;
}

/* Los pasos de Google → los mismos con los avisos antes del cruce, el cruce con su referencia y los «vas bien» a mitad
   de los tramos largos → { pasos, referencias }. */
function guiaConReferencias_(pasos, modo) {
  var cfg = GUIA_REF_[modo] || GUIA_REF_.caminando, sinRef = { pasos: pasos, referencias: 0 };
  try { if (PropertiesService.getScriptProperties().getProperty('GUIA_REFERENCIAS') === '0') return sinRef; } catch (e) {}
  try { if (typeof cupoEnReserva_ === 'function' && cupoEnReserva_().si) return sinRef; } catch (e) {}
  var largo = 3 * cfg.aviso + 2 * cfg.umbral;          // un tramo así de largo lleva su «vas bien» a la mitad
  var puntos = [];
  pasos.forEach(function (p, i) {
    if (p.bus) return;
    if (i > 0) puntos.push({ lat: p.lat, lng: p.lng });
    if (p.metros >= largo && p.tramo) { p.mitad = guiaMitad_(p.tramo); if (p.mitad) puntos.push(p.mitad); }
  });
  var lugares = [];
  try { lugares = guiaLugaresCerca_(puntos.slice(0, GUIA_REF_PUNTOS_), cfg.cerca); } catch (e) { console.error('guiaLugaresCerca_: ' + e); }
  var out = [], usados = {}, refs = 0;
  pasos.forEach(function (p, i) {
    var mitad = p.mitad; delete p.mitad;
    if (p.bus || p.antes) { out.push(p); return; }
    if (i > 0) {
      var ref = guiaRefJunto_(lugares, p, cfg.cerca, usados), giro = guiaGiro_(p.maniobra, p.texto), ant = pasos[i - 1];
      if (ref) refs++;
      /* Aviso antes del cruce, si el tramo que llega es largo (si no, se diría justo después del paso anterior). */
      var avisa = giro && !ant.bus && ant.metros >= cfg.aviso + cfg.umbral + 60;
      if (avisa) out.push({ texto: ref ? 'Sigue recto hasta ' + ref + '; ahí cruzas ' + giro + '. Yo te aviso.' : 'Sigue recto; en unos ' + guiaRedondeo_(cfg.aviso) + ' cruzas ' + giro + '. Yo te aviso.',
        lat: p.lat, lng: p.lng, metros: 0, seg: 0, antes: cfg.aviso, aviso: true });
      var t = guiaCruza_(p.texto);
      p.texto = ref ? 'Ahora, en ' + ref + ': ' + guiaMinus_(t) : (avisa ? 'Ahora: ' + guiaMinus_(t) : t);
      if (ref) p.referencia = ref;
    }
    out.push(p);
    /* A mitad de un tramo largo: «vas bien» con lo que va a ver (se dice un poco antes de llegar a eso). */
    if (mitad) {
      var r2 = guiaRefJunto_(lugares, mitad, cfg.cerca, usados);
      if (r2) { refs++; out.push({ texto: (i ? 'Excelente, vas bien' : 'Vas bien') + ': vas a ver ' + r2 + '. Sigue recto.', lat: mitad.lat, lng: mitad.lng, metros: 0, seg: 0, antes: Math.round(cfg.aviso / 2), referencia: r2 }); }
    }
  });
  return { pasos: out, referencias: refs };
}

/* El lugar, primero cerca de donde está Juan (unos 50 km), luego donde sea → { lat, lng, nombre } o null. */
function guiaLugar_(destino, lat, lng) {
  var d = 0.45, g = null;
  try {
    var r = Maps.newGeocoder().setLanguage('es').setBounds(lat - d, lng - d, lat + d, lng + d).geocode(destino);
    g = r && r.status === 'OK' && r.results && r.results[0];
    var cerca = g && g.geometry && Math.abs(g.geometry.location.lat - lat) < d && Math.abs(g.geometry.location.lng - lng) < d;
    if (!cerca) { r = Maps.newGeocoder().setLanguage('es').geocode(destino); g = (r && r.status === 'OK' && r.results && r.results[0]) || g; }
  } catch (e) { console.error('guiaLugar_: ' + e); }
  if (!g || !g.geometry) return null;
  return { lat: g.geometry.location.lat, lng: g.geometry.location.lng, nombre: String(g.formatted_address || destino).split(',').slice(0, 2).join(',') };
}

/* La ruta → { ok, ... } o { ok: false, error }. */
function guiaRuta_(destino, lat, lng, modo) {
  var lugar = guiaLugar_(destino, lat, lng);
  if (!lugar) return { ok: false, error: 'No encontré «' + destino + '». Pídele a Juan el nombre completo o la dirección.' };
  var f = Maps.newDirectionFinder().setLanguage('es').setOrigin(lat, lng).setDestination(lugar.lat, lugar.lng).setMode(GUIA_MODOS_[modo].maps);
  if (modo === 'bus') f.setDepart(new Date());
  var r = f.getDirections(), ruta = r && r.status === 'OK' && r.routes && r.routes[0], leg = ruta && ruta.legs && ruta.legs[0];
  if (!leg) return { ok: false, sin_ruta: true, error: 'Google no tiene ruta ' + GUIA_MODOS_[modo].texto + ' hasta ' + lugar.nombre + (r && r.status ? ' (' + r.status + ')' : '') + '. Ofrécele otro medio.' };
  var pasos = guiaPasos_(leg);
  if (!pasos.length) return { ok: false, error: 'La ruta vino sin pasos.' };
  var refs = 0;
  try { var cr = guiaConReferencias_(pasos, modo); pasos = cr.pasos; refs = cr.referencias; } catch (e) { console.error('guiaConReferencias_: ' + (e.stack || e)); }
  pasos = pasos.slice(0, GUIA_PASOS_).map(function (p) { delete p.maniobra; delete p.tramo; return p; });
  return { ok: true, destino: lugar.nombre, modo: modo, modo_texto: GUIA_MODOS_[modo].texto,
    minutos: Math.max(1, Math.round(((leg.duration && leg.duration.value) || 0) / 60)), metros: (leg.distance && leg.distance.value) || 0,
    pasos: pasos, fin: { lat: leg.end_location.lat, lng: leg.end_location.lng }, linea: (ruta.overview_polyline && ruta.overview_polyline.points) || '',
    referencias: refs, fuente: 'Google Maps' + (refs ? ' · puntos de referencia de OpenStreetMap' : '') };
}

/* guiaCamino { destino, modo?, lat, lng } → la ruta para la app, o { ok: true, necesita_modo: true } la primera vez.
   El medio que dice Juan se recuerda; si no lo dice, va el recordado (recordado: 'lugar' | 'ultimo'). */
function guiaCamino_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var destino = String(b.destino || '').trim().slice(0, 200), lat = Number(b.lat), lng = Number(b.lng);
  if (!destino) return { ok: false, error: 'Falta a dónde va.' };
  if (!isFinite(lat) || !isFinite(lng) || (!lat && !lng)) return { ok: false, error: 'Sin la ubicación del teléfono.' };
  var dicho = guiaModo_(b.modo), modo = dicho, recordado = '';
  if (!modo) { var p = guiaPrefModo_(adm.email, destino); if (p) { modo = p.modo; recordado = p.por; } }
  if (!modo) return { ok: true, necesita_modo: true, opciones: ['caminando', 'carro', 'bici', 'bus'] };
  var out;
  try { out = guiaRuta_(destino, lat, lng, modo); } catch (e) { console.error('guiaCamino_: ' + (e.stack || e)); out = { ok: false, error: 'Google Maps falló: ' + String(e.message || e).slice(0, 120) }; }
  if (dicho && out.ok) guiaPrefGuardar_(adm.email, destino, dicho);   // solo lo que Juan eligió, y solo si hubo ruta
  if (recordado) out.recordado = recordado;
  return out;
}

/* ═══ CÓMO LLEGAR EN EL CHAT (pedido pc1795047612596, #838) ═══
   Juan: «Siempre es desde mi ubicación actual, tómalo en cuenta». En el chat (Hub, app, WhatsApp) el Hub no sabe dónde
   está el teléfono, así que Alma no calcula la ruta: manda los enlaces de Google Maps, Apple Maps y Waze SIN origen, y el
   mapa sale desde donde esté Juan al tocarlo. Nunca le pregunta desde dónde ni pone una propiedad u oficina de salida;
   solo si él nombra otro punto («desde el aeropuerto») va como origen. El medio: el que dice, o el que eligió la última
   vez para ese lugar (GUIA_PREF_, igual que la Guía de camino); si no hay, Maps usa el suyo. */
var GUIA_AQUI_RX_ = /^\s*(desde\s+)?(mi ubicaci[oó]n( actual)?|aqu[ií]|donde estoy|ubicaci[oó]n actual|my location|current location)?\s*$/i;
var GUIA_LINK_MODO_ = { caminando: ['walking', 'w'], carro: ['driving', 'd'], bici: ['bicycling', 'w'], bus: ['transit', 'r'] };
/* calcular_distancia sin propiedad (agente.js) → guiaComoLlegar_(adm, { destino, modo?, origen? }) → { ok, desde, destino, modo, google, apple, waze, como_usarlo } */
function guiaComoLlegar_(adm, inp) {
  inp = inp || {};
  var destino = String(inp.destino || '').trim().slice(0, 200), origen = String(inp.origen || '').trim().slice(0, 200);
  if (!destino) return { ok: false, error: 'Falta a dónde va.' };
  var aqui = GUIA_AQUI_RX_.test(origen), modo = guiaModo_(inp.modo), recordado = '';
  if (modo && adm && adm.email) { try { guiaPrefGuardar_(adm.email, destino, modo); } catch (e) { console.error('guiaComoLlegar_: ' + e); } }
  if (!modo && adm && adm.email) { var p = guiaPrefModo_(adm.email, destino); if (p) { modo = p.modo; recordado = p.por; } }
  var lm = GUIA_LINK_MODO_[modo], e = encodeURIComponent;
  var google = 'https://www.google.com/maps/dir/?api=1' + (aqui ? '' : '&origin=' + e(origen)) + '&destination=' + e(destino) + (lm ? '&travelmode=' + lm[0] : '');
  var apple = 'https://maps.apple.com/?' + (aqui ? '' : 'saddr=' + e(origen) + '&') + 'daddr=' + e(destino) + (lm ? '&dirflg=' + lm[1] : '');
  var out = { ok: true, desde: aqui ? 'tu ubicación actual' : origen, destino: destino, modo: modo ? GUIA_MODOS_[modo].texto : '', google: google, apple: apple,
    como_usarlo: 'Manda el enlace de Google Maps (y el de Apple Maps o Waze si los pide): el mapa arma la ruta ' + (aqui ? 'desde donde está Juan al tocarlo' : 'desde ' + origen) + '. No le preguntes desde dónde.' };
  if (aqui) out.waze = 'https://waze.com/ul?q=' + e(destino) + '&navigate=yes';   // Waze siempre sale desde donde está el teléfono
  if (recordado) out.recordado = recordado;
  return out;
}

/* Modo calle: «¿cómo llego a…?», «llévame a…», «guíame a…», «direcciones para…» → se abre la llamada sin la IA. */
var GUIA_PIDE_RX_ = /(c[oó]mo (llego|me voy|se llega|puedo llegar|hago para llegar) (a|al|hasta|para)\b|ll[eé]vame (a|al|hasta)\b|gu[ií]ame (a|al|hasta)\b|(dame|necesito) (las )?(direcciones|indicaciones)|direcciones (a|al|para|hasta)\b|indicaciones para llegar)/i;
function guiaPideCamino_(texto) { return GUIA_PIDE_RX_.test(String(texto || '')); }

/* La herramienta de cliente de la voz (la corre la app; vozDefHerramientas_ en voz.js la suma). */
function vozGuiaHerramientas_() {
  var s = function (d) { return { type: 'string', description: d }; };
  return [
    { type: 'client', name: 'guiar_camino', expects_response: true, response_timeout_secs: 20, disable_interruptions: false,
      pre_tool_speech: 'off', force_pre_tool_speech: false,
      description: 'Guía de camino: Juan pide cómo llegar a un lugar («¿cómo llego a…?», «llévame a…»). La app calcula la ruta desde donde está el teléfono, abre el mapa y le dice cada paso al oído justo cuando llega a ese punto, aunque cuelgues o bloquee el teléfono. ' +
        'Llámala con destino y SIN modo si Juan no dijo cómo va: si responde necesita_modo, pregúntale en una frase «¿Vas caminando, en carro, en bici o en bus?» y vuelve a llamarla con su respuesta (se recuerda para la próxima). ' +
        'Si responde recordado, dilo natural («Te llevo caminando, como la vez pasada») y ofrece cambiar solo si él lo pide. Con la ruta: di en UNA frase cuánto tarda y el primer paso (primer_paso); no leas los demás, la app los dice a tiempo, con puntos de referencia (tiendas, iglesias, monumentos), avisando antes de cada cruce y en el momento. ' +
        'detener: true termina la guía. Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».',
      parameters: { type: 'object', required: [], properties: {
        destino: s('A dónde va, con el nombre como lo dijo y la ciudad si ayuda (p. ej. «Parque Central, Antigua Guatemala»).'),
        modo: { type: 'string', enum: ['caminando', 'carro', 'bici', 'bus'], description: 'Solo si Juan dijo cómo va (moto, Uber o taxi = carro).' },
        detener: { type: 'boolean', description: 'true para terminar la guía que va.' } } } }
  ];
}
