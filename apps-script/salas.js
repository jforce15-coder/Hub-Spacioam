/* ═══ SALAS PRIORITY PASS (issue #446, T1) ═══════════════════════════════════════════════════════════════════════
   En la tarjeta del vuelo (alma/inicio.html) y en «mi vuelo» de Alma (ver_vuelos): las salas Priority Pass de la terminal
   de donde sale el vuelo (o, si ya va en el aire, de la terminal donde llega: escala o llegada).
   · Fuente: Priority Pass no tiene API pública. La primera vez que aparece un aeropuerto (IATA), el modelo barato
     (CFG.MODELO_CLASIFICADOR) busca en la web SOLO dentro de prioritypass.com (herramienta web_search de Anthropic con
     allowed_domains) y devuelve nombre, terminal, airside o landside, horario y ubicación de cada sala. Se busca en vez
     de armar la dirección porque las páginas de Priority Pass no siguen el IATA («/lounges/guatemala/guatemala-la-aurora-intl»,
     «/lounges/united-states-of-america/hartsfield-jackson-atlanta-international»); cada sala sí empieza con el IATA
     («cdg8-yotelair-…», «gua4-copa-club»): una sala con el código de otro aeropuerto se descarta.
   · Caché: la hoja ALMA_SALAS (una fila por aeropuerto, con la fecha) dura 30 días; si la búsqueda falló, se vuelve a
     intentar al día siguiente, nunca en cada vistazo. CacheService la deja a mano por 6 h.
   · Filtro (salasFiltrar_): solo las de la terminal del vuelo. La terminal sale de AirLabs (dep_terminal / arr_terminal)
     o del correo, y la letra de la puerta cuenta como su concourse («B12» → B: así en ATL o MIA). Un aeropuerto de una
     sola terminal (GUA) las muestra todas. Sin terminal en un aeropuerto de varias: nada.
   · Si algo falla (sin llave, cupo, la búsqueda, ninguna en esa terminal): la tarjeta no muestra nada, sin error a la
     vista, y el motivo queda en el registro (console) y, si fue la búsqueda, en la fila de ALMA_SALAS.
   · Cupo de Google: canal «Viajes», por uf_. Buscar un aeropuerto nuevo es «de fondo» (se pausa desde el 60 %); leer lo
     guardado nunca se pausa. */

var SALAS_HOJA_ = 'ALMA_SALAS';
var SALAS_CAB_ = ['iata', 'fecha', 'ok', 'una_terminal', 'salas', 'fuente', 'motivo'];
var SALAS_DIAS_ = 30, SALAS_REINTENTO_H_ = 24, SALAS_MAX_ = 3;
var SALAS_DOMINIO_RE_ = /^https:\/\/(www\.|my\.)?prioritypass\.com\//i;
var SALAS_PROMPT_ = 'Buscas en prioritypass.com las salas (lounges) y experiencias de Priority Pass de un aeropuerto. Usa solo lo que diga ' +
  'prioritypass.com; si no lo encuentras ahí, devuelve salas vacías. Nunca inventes. Responde SOLO con un JSON, sin texto antes ni después:\n' +
  '{"una_terminal": true|false, "salas": [{"nombre": "", "tipo": "sala|restaurante|spa|descanso", "terminal": "como lo dice la página (p. ej. Terminal 2E, ' +
  'North Terminal Concourse D and E, Concourse F)", "zonas": ["códigos cortos de esa terminal y sus concourses o halls, p. ej. 2E, K, L, M o N, D, E o F"], ' +
  '"lado": "airside|landside", "horario": "p. ej. 05:00–22:00 o 24 h", "ubicacion": "dónde está, corto, en español (p. ej. después de seguridad, junto a la puerta 14)", ' +
  '"nota": "restricción importante, corta, en español (p. ej. solo vuelos fuera de Schengen) o vacío", "url": "la página de esa sala en prioritypass.com"}]}\n' +
  'una_terminal = el aeropuerto tiene una sola terminal de pasajeros.';

/* ── Lo de un tramo, para la tarjeta y para Alma → { iata, terminal, etiqueta, salas:[…] } o null (sin nada que mostrar).
   o.soloGuardado: no busca en la web (lo que pide la app al abrir; la búsqueda la hace «vueloVivo» o Alma). ── */
function salasDelTramo_(t, vv, ahora, o) {
  o = o || {}; vv = vv || {};
  try {
    var llegada = Date.parse(vv.sale_utc || t.sale) <= ahora, lugar = llegada ? t.destino : t.origen;
    var iata = String((lugar && lugar.iata) || '').toUpperCase();
    var terminal = llegada ? (vv.terminal_llega || (t.destino && t.destino.terminal) || '') : (vv.terminal || (t.origen && t.origen.terminal) || '');
    var puerta = llegada ? '' : (vv.puerta || t.puerta || '');
    var datos = salasAeropuerto_(iata, o);
    if (!datos) return null;
    var f = salasFiltrar_(datos, terminal, puerta);
    if (!f.salas.length) { console.log('salas ' + iata + ': ' + f.motivo); return null; }
    return { iata: iata, terminal: terminal, etiqueta: terminal ? 'Terminal ' + salasTerminalCorta_(terminal) : iata, llegada: llegada, salas: f.salas, fuente: 'prioritypass.com' };
  } catch (e) { console.error('salasDelTramo_: ' + (e.stack || e)); return null; }
}
function salasTerminalCorta_(x) { return String(x || '').replace(/^\s*(terminal|term\.?)\s*/i, '').trim(); }

/* ── Las salas de un aeropuerto: lo guardado (30 días) o una búsqueda nueva. Nunca lanza. ── */
function salasAeropuerto_(iata, o) {
  o = o || {}; iata = String(iata || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) return null;
  var ahora = Date.now(), g = salasGuardado_(iata);
  if (g && salasVigente_(g, ahora)) return g.ok ? g : null;
  if (o.soloGuardado) return g && g.ok ? g : null;   // vencido pero útil mientras alguien con búsqueda lo renueva
  var c = CacheService.getScriptCache(), marca = 'salas_busca_' + iata;
  if (c.get(marca)) return g && g.ok ? g : null;     // otra pedida lo está buscando
  if (!cupoPermite_('fondo')) { console.log('salas ' + iata + ': no se buscó, el cupo de Google está alto'); return g && g.ok ? g : null; }
  c.put(marca, '1', 120);
  var r = salasBuscar_(iata);
  if (!r.ok) console.log('salas ' + iata + ': la búsqueda falló: ' + r.motivo);
  if (!r.ok && g && g.ok) { g.fecha = ahora - (SALAS_DIAS_ * 24 - SALAS_REINTENTO_H_) * 36e5; salasGuardar_(g); return g; }   // falló renovar: lo viejo un día más
  var nuevo = { iata: iata, fecha: ahora, ok: !!r.ok, una_terminal: !!r.una_terminal, salas: r.salas || [], fuente: r.fuente || '', motivo: r.motivo || '' };
  salasGuardar_(nuevo);
  return nuevo.ok ? nuevo : null;
}
function salasVigente_(g, ahora) { return ahora - g.fecha < (g.ok ? SALAS_DIAS_ * 864e5 : SALAS_REINTENTO_H_ * 36e5); }

/* ── Buscar: el modelo barato con web_search, solo en prioritypass.com → { ok, una_terminal, salas, fuente, motivo } ── */
function salasBuscar_(iata) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY');
  if (!key) return { ok: false, motivo: 'falta ANTHROPIC_KEY' };
  var msgs = [{ role: 'user', content: 'Aeropuerto: ' + iata + '. Busca sus salas Priority Pass en prioritypass.com.' }], j = null, t0 = Date.now(), busquedas = 0;
  for (var vuelta = 0; vuelta < 2; vuelta++) {   // la búsqueda puede pausar el turno (pause_turn): se sigue una vez
    var r;
    try {
      r = uf_('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify({ model: CFG.MODELO_CLASIFICADOR, max_tokens: 1500, temperature: 0, system: SALAS_PROMPT_, messages: msgs,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, allowed_domains: ['prioritypass.com'] }] }) }, 'Viajes');
    } catch (e) { return { ok: false, motivo: 'no se pudo llamar a Claude: ' + String(e).slice(0, 120) }; }
    try { j = JSON.parse(r.getContentText()) || {}; } catch (e) { j = {}; }
    var u = j.usage || {}; busquedas += Number((u.server_tool_use || {}).web_search_requests || 0);
    try { registrarUso_({ app: 'ALMA', funcion: 'Viajes · salas Priority Pass', detalle: iata, modelo: CFG.MODELO_CLASIFICADOR, usage: u, ms: Date.now() - t0, ok: r.getResponseCode() === 200, fotos: 0 }); } catch (e) {}
    if (r.getResponseCode() !== 200) return { ok: false, motivo: 'Claude respondió ' + r.getResponseCode() + (/web_search/i.test(r.getContentText()) ? ' (la búsqueda web no está habilitada en la cuenta de Anthropic)' : '') };
    if (j.stop_reason !== 'pause_turn') break;
    msgs = msgs.slice(0, 1).concat([{ role: 'assistant', content: j.content }]);
  }
  var texto = ((j && j.content) || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  return salasLeerRespuesta_(iata, texto, busquedas);
}

/* La respuesta del modelo → lo que se guarda. Solo salas con su página en prioritypass.com y de ESTE aeropuerto. */
function salasLeerRespuesta_(iata, texto, busquedas) {
  var a = String(texto || '').indexOf('{'), b = String(texto || '').lastIndexOf('}'), x = null;
  if (a >= 0 && b > a) try { x = JSON.parse(texto.slice(a, b + 1)); } catch (e) {}
  if (!x || !Array.isArray(x.salas)) return { ok: false, motivo: 'la respuesta no traía el JSON de salas' };
  var corto = function (s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); };
  var salas = x.salas.map(function (s) {
    s = s || {};
    var url = corto(s.url, 300), cod = (/\/([a-z]{3})\d+[a-z]?-[^\/]*\/?$/i.exec(url) || [])[1];
    if (!SALAS_DOMINIO_RE_.test(url) || (cod && cod.toUpperCase() !== iata)) return null;   // sin fuente, o es de otro aeropuerto
    var lado = /land/i.test(s.lado) ? 'landside' : /air/i.test(s.lado) ? 'airside' : '';
    var zonas = [].concat(s.zonas || []).map(salasCodigo_).filter(Boolean);
    salasCodigos_(s.terminal, '').forEach(function (z) { if (zonas.indexOf(z) < 0) zonas.push(z); });
    /* «2» junto a «2E» sobra: con él, cualquier vuelo de la terminal 2 (2A…2G) vería esta sala */
    zonas = zonas.filter(function (z) { return !/^\d+$/.test(z) || !zonas.some(function (y) { return y !== z && y.indexOf(z) === 0; }); });
    return { nombre: corto(s.nombre, 60), tipo: corto(s.tipo, 20).toLowerCase() || 'sala', terminal: corto(s.terminal, 60), zonas: zonas.slice(0, 8), lado: lado,
      horario: corto(s.horario, 40), ubicacion: corto(s.ubicacion, 140), nota: corto(s.nota, 100), url: url };
  }).filter(function (s) { return s && s.nombre; });
  if (x.salas.length && !salas.length) return { ok: false, motivo: 'ninguna sala traía su página de prioritypass.com' };
  return { ok: true, una_terminal: x.una_terminal === true, salas: salas.slice(0, 20), fuente: 'prioritypass.com (búsqueda web' + (busquedas ? ', ' + busquedas : '') + ')' };
}

/* ── Filtro por terminal → { salas (máx. 3, airside y salas primero), motivo } ── */
function salasFiltrar_(datos, terminal, puerta) {
  var todas = (datos && datos.salas) || [];
  if (!todas.length) return { salas: [], motivo: 'Priority Pass no tiene salas en ' + (datos && datos.iata) };
  var cods = salasCodigos_(terminal, puerta), lista;
  if (datos.una_terminal) lista = todas;
  else if (!cods.length) return { salas: [], motivo: 'el vuelo no trae terminal y el aeropuerto tiene varias' };
  else lista = todas.filter(function (s) { return (s.zonas || []).some(function (z) { return cods.indexOf(z) >= 0; }); });
  if (!lista.length) return { salas: [], motivo: 'ninguna sala en la terminal ' + terminal + (puerta ? ' (puerta ' + puerta + ')' : '') };
  var peso = function (s) { return (s.lado === 'landside' ? 2 : 0) + (s.tipo === 'sala' ? 0 : 1); };
  lista = lista.slice().sort(function (a, b) { return peso(a) - peso(b); });
  return { salas: lista.slice(0, SALAS_MAX_).map(function (s) { return { nombre: s.nombre, tipo: s.tipo, terminal: s.terminal, lado: s.lado, horario: s.horario, ubicacion: s.ubicacion, nota: s.nota, url: s.url }; }), motivo: '' };
}
/* «Terminal 2E» → 2E · «T1» → 1 · «North Terminal» → N · «Concourse F» → F · «International» → I */
function salasCodigo_(x) {
  var s = String(x || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(TERMINAL|TERM|CONCOURSE|HALL|PIER|SALA|ZONA)\b/g, ' ').trim();
  var pal = { NORTH: 'N', NORTE: 'N', SOUTH: 'S', SUR: 'S', INTERNATIONAL: 'I', INTERNACIONAL: 'I', INTL: 'I', DOMESTIC: 'D', NACIONAL: 'D', MAIN: 'M', PRINCIPAL: 'M', CENTRAL: 'C', EAST: 'E', WEST: 'W' };
  if (pal[s]) return pal[s];
  s = s.replace(/\s+/g, '');
  if (/^T\d/.test(s)) s = s.slice(1);
  return /^[A-Z0-9]{1,3}$/.test(s) ? s : '';
}
/* Los códigos del vuelo: su terminal (y cada parte de «North Terminal Concourse D and E») y la letra de la puerta. */
function salasCodigos_(terminal, puerta) {
  var out = [], mete = function (c) { if (c && out.indexOf(c) < 0) out.push(c); };
  var t = String(terminal || '');
  mete(salasCodigo_(t));
  t.split(/\s*(?:,|\/|&|\band\b|\by\b|\bterminal\b|\bconcourses?\b)\s*/i).forEach(function (p) { mete(salasCodigo_(p)); });
  var m = /^([A-Z]{1,2})\s?-?\d/.exec(String(puerta || '').toUpperCase().trim()); if (m) mete(m[1]);
  return out;
}

/* ── Para Alma («¿qué salas hay?»): una línea por sala ── */
function salasParaAlma_(s) {
  if (!s || !s.salas || !s.salas.length) return undefined;
  return { donde: s.iata + (s.terminal ? ' · terminal ' + s.terminal : '') + (s.llegada ? ' (donde llega)' : ''), fuente: s.fuente,
    salas: s.salas.map(function (x) { return [x.nombre, x.terminal, x.lado === 'airside' ? 'después de seguridad' : x.lado === 'landside' ? 'antes de seguridad' : '', x.horario, x.ubicacion, x.nota].filter(Boolean).join(' · '); }) };
}

/* ── La hoja ALMA_SALAS (y CacheService para no leerla cada vez) ── */
function salasGuardado_(iata) {
  var c = CacheService.getScriptCache();
  try { var x = c.get('salas_' + iata); if (x) return JSON.parse(x); } catch (e) {}
  try {
    var sh = hojaCrear_(SALAS_HOJA_, SALAS_CAB_), n = sh.getLastRow(); if (n < 2) return null;
    var v = sh.getRange(2, 1, n - 1, SALAS_CAB_.length).getValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][0]) === iata) {
      var g = { iata: iata, fecha: v[i][1] instanceof Date ? v[i][1].getTime() : Date.parse(v[i][1]) || 0, ok: v[i][2] === true || String(v[i][2]) === 'TRUE',
        una_terminal: v[i][3] === true || String(v[i][3]) === 'TRUE', salas: JSON.parse(v[i][4] || '[]'), fuente: String(v[i][5] || ''), motivo: String(v[i][6] || '') };
      try { c.put('salas_' + iata, JSON.stringify(g), 6 * 3600); } catch (e) {}
      return g;
    }
  } catch (e) { console.error('salasGuardado_: ' + e); }
  return null;
}
function salasGuardar_(g) {
  try { CacheService.getScriptCache().put('salas_' + g.iata, JSON.stringify(g), 6 * 3600); } catch (e) {}
  try {
    var sh = hojaCrear_(SALAS_HOJA_, SALAS_CAB_), n = sh.getLastRow(), fila = 0;
    if (n >= 2) { var ids = sh.getRange(2, 1, n - 1, 1).getValues(); for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === g.iata) { fila = i + 2; break; } }
    var row = [g.iata, new Date(g.fecha).toISOString(), !!g.ok, !!g.una_terminal, JSON.stringify(g.salas || []).slice(0, 45000), g.fuente || '', String(g.motivo || '').slice(0, 300)];
    if (fila) sh.getRange(fila, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  } catch (e) { console.error('salasGuardar_: ' + e); }
}
