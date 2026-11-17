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

var GUIA_MODOS_ = {
  caminando: { maps: 'WALKING', texto: 'caminando' },
  carro: { maps: 'DRIVING', texto: 'en carro' },
  bici: { maps: 'BICYCLING', texto: 'en bici' },
  bus: { maps: 'TRANSIT', texto: 'en bus' }
};
var GUIA_LUGARES_ = 30;   // cuántos lugares con su medio se recuerdan
var GUIA_PASOS_ = 60;     // lo más que se manda a la app

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
      out.push({ texto: t, lat: s.start_location.lat, lng: s.start_location.lng, metros: s.distance ? s.distance.value : 0, seg: s.duration ? s.duration.value : 0 });
    });
  });
  return out.slice(0, GUIA_PASOS_);
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
  return { ok: true, destino: lugar.nombre, modo: modo, modo_texto: GUIA_MODOS_[modo].texto,
    minutos: Math.max(1, Math.round(((leg.duration && leg.duration.value) || 0) / 60)), metros: (leg.distance && leg.distance.value) || 0,
    pasos: pasos, fin: { lat: leg.end_location.lat, lng: leg.end_location.lng }, linea: (ruta.overview_polyline && ruta.overview_polyline.points) || '',
    fuente: 'Google Maps' };
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
        'Si responde recordado, dilo natural («Te llevo caminando, como la vez pasada») y ofrece cambiar solo si él lo pide. Con la ruta: di en UNA frase cuánto tarda y el primer paso (primer_paso); no leas los demás, la app los dice a tiempo. ' +
        'detener: true termina la guía. Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ESTÁS EN LA APP DE ALMA».',
      parameters: { type: 'object', required: [], properties: {
        destino: s('A dónde va, con el nombre como lo dijo y la ciudad si ayuda (p. ej. «Parque Central, Antigua Guatemala»).'),
        modo: { type: 'string', enum: ['caminando', 'carro', 'bici', 'bus'], description: 'Solo si Juan dijo cómo va (moto, Uber o taxi = carro).' },
        detener: { type: 'boolean', description: 'true para terminar la guía que va.' } } } }
  ];
}
