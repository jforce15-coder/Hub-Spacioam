/* ═══ PEDIDOS EN ÓRBITA (#509 T3, Juan 13-nov-2026) ══════════════════════════════════════════════════════════════
   Lo que Alma sigue trabajando para quien pregunta, para dibujarlo en el inicio de la app como anillos que orbitan la
   roca (alma/inicio.html, «Pedidos en órbita»). Una sola acción liviana con sesión de administrador: `pedidosOrbita`.
   De dónde sale cada pedido:
   · segundo plano del agente (órbita cercana, «rapido»): lo que la llamada o el Modo calle dejaron trabajando
     (vozSeguirGuardar_ en retomar.js) y lo que se pidió en segundo plano (vozSecEncolar_ en voz.js). Se anota aquí al
     empezar, el paso cambia con cada herramienta (orbitaPaso_, desde el bucle de agente.js) y se cierra al terminar
     (vozSecProcesar_ y vozSeguirPronto). Vive en la caché del script, por persona.
   · desarrollo (órbita lejana, «largo»): los pedidos a Claude del administrador principal que siguen en trabajo
     (microproyectos.js) y los que Alma escaló y une y entrega sola (escalar.js). Llevan un PR y tardan horas.
   Rápido o largo lo decide la FUENTE, en un solo lugar (ORBITA_TIPO_), nunca un cálculo de tiempo ni un porcentaje.
   Estados: en_curso · listo · fallo. Lo terminado se queda ORBITA_FIN_MS_ (10 min) para que la app muestre el check.
   Nunca devuelve el pedido completo, teléfonos, correos, enlaces ni códigos: solo un nombre corto ya limpio. */

var ORBITA_TIPO_ = { segundo_plano: 'rapido', desarrollo: 'largo' };
var ORBITA_FIN_MS_ = 10 * 60000;
/* Una ejecución de Apps Script se corta a los 6 min: un segundo plano «en curso» de hace más de 15 min ya no corre. */
var ORBITA_VIVO_MS_ = 15 * 60000;
/* Un pedido a Claude «en trabajo» sin noticias en 24 h ya no se dibuja (sigue en Pendientes). */
var ORBITA_DESARROLLO_MS_ = 24 * 3600000;
var ORBITA_MAX_ = 8;
/* Mientras corre un segundo plano: { email, ids } (el paso de cada herramienta va a esos pedidos). */
var ORBITA_ACTUAL_ = null;
/* El paso, por la herramienta que Alma está usando. El primero que coincide gana; sin coincidencia, «Actualizando». */
var ORBITA_PASOS_ = [
  [/evento|agendar|agenda/, 'Agendando'],
  [/^(buscar|ver|leer|tareas|promesas|propuestas|mensajes_programados|programados|cancelaciones|vigilancias|proyectos|ruta|calcular|reporte|memoria|grow_proyectos|grow_fotos)/, 'Revisando'],
  [/^(enviar|escribir|mensaje|responder|programar_mensaje|encargar|pedir_a_agente)/, 'Redactando']
];

function orbitaClave_(email) {
  return 'orbita_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(email || '').toLowerCase())).slice(0, 16);
}
function orbitaLeer_(email) {
  var l = []; try { l = JSON.parse(CacheService.getScriptCache().get(orbitaClave_(email)) || '[]'); } catch (e) { l = []; }
  var ahora = Date.now();
  return (Array.isArray(l) ? l : []).filter(function (x) {
    return x && x.id && (x.estado === 'en_curso' ? ahora - x.desde < ORBITA_VIVO_MS_ : ahora - (x.fin || 0) < ORBITA_FIN_MS_);
  });
}
/* Cosmético: si el candado está ocupado, no se espera (la llamada y el segundo plano no se frenan por un anillo). Es el
   de las colas de la llamada (vozColaLock_, retomar.js), no el del script: ese lo tiene procesarCola toda su pasada. */
function orbitaCambiar_(email, fn) {
  if (!email) return null;
  var lock = vozColaLock_(); if (!lock.tryLock(3000)) { console.error('orbita: candado ocupado'); return null; }
  try {
    var l = orbitaLeer_(email), r = fn(l);
    CacheService.getScriptCache().put(orbitaClave_(email), JSON.stringify(l.slice(-12)), 21600);
    return r;
  } catch (e) { console.error('orbitaCambiar_: ' + e); return null; } finally { lock.releaseLock(); }
}
/* Empieza un pedido de segundo plano. Devuelve su id ('' si no se pudo anotar). id: el que ya se guardó con el pedido. */
function orbitaId_() { return 'ob' + Date.now().toString(36) + Math.floor(Math.random() * 1e4); }
function orbitaEmpieza_(email, pedido, fuente, paso, id) {
  id = id || orbitaId_();
  var ok = orbitaCambiar_(email, function (l) {
    l.push({ id: id, nombre: orbitaNombre_(pedido), paso: String(paso || ''), fuente: fuente || 'segundo_plano', estado: 'en_curso', desde: Date.now() });
    return true;
  });
  return ok ? id : '';
}
/* La herramienta que Alma va a usar ahora (agente.js): solo escribe si el paso cambió. */
function orbitaPaso_(herramienta) {
  var a = ORBITA_ACTUAL_; if (!a || !a.email || !(a.ids || []).length) return;
  var n = String(herramienta || ''), paso = 'Actualizando';
  for (var i = 0; i < ORBITA_PASOS_.length; i++) if (ORBITA_PASOS_[i][0].test(n)) { paso = ORBITA_PASOS_[i][1]; break; }
  if (a.paso === paso) return;
  a.paso = paso;
  orbitaCambiar_(a.email, function (l) { l.forEach(function (x) { if (a.ids.indexOf(x.id) >= 0 && x.estado === 'en_curso') x.paso = paso; }); });
}
/* Terminó (con o sin falla). */
function orbitaTermina_(email, ids, fallo) {
  ids = (ids || []).filter(Boolean); if (!ids.length) return;
  orbitaCambiar_(email, function (l) {
    l.forEach(function (x) { if (ids.indexOf(x.id) >= 0) { x.estado = fallo ? 'fallo' : 'listo'; x.fin = Date.now(); x.paso = fallo ? 'No se pudo' : 'Listo'; } });
  });
}

/* ── Nombre corto, sin datos sensibles ── */
function orbitaLimpio_(t) {
  return String(t || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')
    .replace(/\b(c[oó]digo|pin|clave|contraseña)\s*(de acceso)?\s*:?\s*\d+/gi, '$1')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, ' ')   // teléfonos y números largos (5 o más cifras seguidas o con espacios)
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
var ORBITA_SOBRA_ = /^(alma|oye|hola|por favor|porfa|me puedes|puedes|podr[ií]as|quiero que|necesito que|ay[uú]dame a|me ayudas a|tambi[eé]n|y)\b[\s,:]*/i;
var ORBITA_COLA_ = /\s+(de|del|la|las|el|los|a|al|en|y|o|con|para|por|que|un|una|su|sus|mi|mis)$/i;
function orbitaNombre_(pedido) {
  var t = orbitaLimpio_(String(pedido || '').replace(/^\[[^\]]*\]\s*/, '').replace(/[«»"“”*_#>`]/g, ''));
  /* Encargos que vuelven (agente.js): «Terminé la llamada con …» no es un nombre. */
  if (/^termin[eé] la (llamada|conversaci[oó]n)/i.test(t)) return 'Lo que sigue del encargo';
  if (/^me pediste varias cosas/i.test(t)) return 'Varios pedidos';
  for (var k = 0; k < 4 && ORBITA_SOBRA_.test(t); k++) t = t.replace(ORBITA_SOBRA_, '');
  t = t.split(/[.?!\n]|,\s/)[0].trim();
  var p = t.split(/\s+/).slice(0, 5).join(' ');
  if (p.length > 34) p = p.slice(0, 34).replace(/\s+\S*$/, '');
  while (ORBITA_COLA_.test(p)) p = p.replace(ORBITA_COLA_, '');
  p = p.replace(/[,;:\-–—]+$/, '').trim();
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Pedido en curso';
}

/* ── Desarrollo: pedidos a Claude del principal (microproyectos) y lo que Alma escaló (escalar.js) ── */
var ORBITA_ESCALAR_PASO_ = { pedido: 'En desarrollo', por_unir: 'Uniendo', publicando: 'Publicando', publicado: 'Entregando', entregando: 'Entregando', entregada: 'Entregado' };
function orbitaDesarrollo_(adm) {
  if (!adm || !esAdminPrincipal_(adm)) return [];
  var c = CacheService.getScriptCache(), k = orbitaClave_(adm.email) + '_d', guardado = c.get(k);
  if (guardado) { try { return JSON.parse(guardado); } catch (e) {} }
  var ahora = Date.now(), email = String(adm.email || '').toLowerCase(), out = [], vistos = {};
  var esc = []; try { esc = escalarEntregas_(); } catch (e) { console.error('orbita escalar: ' + e); }
  esc.forEach(function (e) {
    if (String(e.email || '').toLowerCase() !== email) return;
    var estado = /^(fallo|no_unida|fallo_pub)$/.test(e.estado) ? 'fallo' : e.estado === 'entregada' ? 'listo' : 'en_curso';
    var fin = Number(e.fin || 0);
    if (estado !== 'en_curso' && ahora - fin >= ORBITA_FIN_MS_) { if (e.micro) vistos[e.micro] = 1; return; }
    if (e.micro) vistos[e.micro] = 1;
    out.push({ id: 'es' + String(e.id || e.micro).replace(/\W/g, ''), nombre: e.nombre, paso: estado === 'fallo' ? 'No se pudo' : ORBITA_ESCALAR_PASO_[e.estado] || 'En desarrollo',
      fuente: 'desarrollo', estado: estado, desde: Number(e.t || ahora), fin: estado === 'en_curso' ? 0 : fin });
  });
  var micros = []; try { micros = microFilas_(); } catch (e) { console.error('orbita micro: ' + e); }
  micros.forEach(function (m) {
    if (vistos[m.id] || String(m.quien || '').toLowerCase() !== email) return;
    var act = Number(m.actualizado) || 0, est = String(m.estado || '');
    if (est === MICRO_ESTADOS_.trabajo) {
      if (ahora - act < ORBITA_DESARROLLO_MS_) out.push({ id: 'mp' + String(m.id).replace(/\W/g, ''), nombre: m.nombre, paso: 'En desarrollo', fuente: 'desarrollo', estado: 'en_curso', desde: Number(m.creado) || act, fin: 0 });
      return;
    }
    /* Recién terminado: lo último es una respuesta de Claude (listo para unir, pregunta o consulta contestada) de los
       últimos 10 min. Un «cerrado» a mano o un «unido» no es un resultado nuevo. */
    var ult = (m.ajustes || [])[(m.ajustes || []).length - 1], fin = ult && ult.de === 'claude' ? Number(ult.ts) || 0 : 0;
    if (!fin || ahora - fin >= ORBITA_FIN_MS_ || est === MICRO_ESTADOS_.unido) return;
    var paso = est === MICRO_ESTADOS_.listo ? 'Listo para unir' : est === MICRO_ESTADOS_.pregunta ? 'Te pregunta algo' : 'Listo';
    out.push({ id: 'mp' + String(m.id).replace(/\W/g, ''), nombre: m.nombre, paso: paso, fuente: 'desarrollo', estado: 'listo', desde: Number(m.creado) || fin, fin: fin });
  });
  try { c.put(k, JSON.stringify(out), 60); } catch (e) {}
  return out;
}

/* ── La lista para la app ── */
function orbitaLista_(adm) {
  if (!adm || !adm.email) return [];
  var l = orbitaLeer_(adm.email).concat(orbitaDesarrollo_(adm));
  var orden = { en_curso: 0, fallo: 1, listo: 2 };
  return l.map(function (x) {
    var o = { id: String(x.id), nombre: orbitaLimpio_(x.nombre).slice(0, 40) || 'Pedido en curso', paso: orbitaLimpio_(x.paso).slice(0, 24),
      tipo: ORBITA_TIPO_[x.fuente] || 'rapido', estado: x.estado, desde: Number(x.desde) || 0 };
    if (x.estado !== 'en_curso') o.fin = Number(x.fin) || 0;
    return o;
  }).sort(function (a, b) { return (orden[a.estado] - orden[b.estado]) || (b.desde - a.desde); }).slice(0, ORBITA_MAX_);
}
/* Acción `pedidosOrbita` (Código.js): solo administradores, solo lo suyo. */
function orbitaApi_(ses) {
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  return { ok: true, pedidos: orbitaLista_(adm), ahora: Date.now() };
}
