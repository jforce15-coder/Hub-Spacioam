/* ═══ TEMAS: cada mensaje con el administrador va a su tema (issue #526; Juan, 14-nov-2026) ═════════════════════════
   Con el mismo administrador Alma lleva muchas cosas a la vez (un formulario, un huésped, un pendiente, un socio). El 13-nov
   el pedido de Narama 633 quedó enterrado bajo 31 mensajes de otros temas y los números que Juan mandó por WhatsApp, sin
   citar, se trataron como de otro tema. Ahora cada cosa es un TEMA con su id (hoja ALMA_TEMAS) y cada fila de
   ALMA_OPERATIVO y ALMA_WHATSAPP lleva su tema_id; la voz, la app y WhatsApp comparten el mismo tema.
   · Un solo nombre (#583 T2, Juan 16-nov-2026): el título es corto y legible («Cupos de Google»), sin «Juan pregunta…» ni un
     conector al final (temaNombreCorto_); el mismo en el anillo, el microproyecto y el chat. Al tocar un anillo o su
     notificación llega su id (orbitaTema_, orbita.js) y el tema queda fijo sin adivinar. Si hay duda, Alma ELIGE (Juan:
     «ejecuta, no esperes»): solo pregunta con dos nombres legibles y distintos; una consulta con duda no se pega a otro tema;
     «el más reciente» nunca es un tema que espera el sí de un envío, salvo un acuse corto («sí», «mándalo»).
   · A qué tema va un mensaje (temaElegir_, el único lugar): la tarjeta de Pendientes o el socio que lo abrió → ese; cita un
     mensaje → el tema de ese mensaje; nombra un apartamento o una persona de un tema → ese; trae un número y un tema espera
     un número → ese; si no, Jev elige entre los temas vivos (umbral JEV_UMBRAL_). Si Jev duda y hay dos o más temas
     activos, Alma PREGUNTA («¿Esto es para Narama 633 o para el huésped de Monaco D4?») sin llamar a la IA, y la respuesta
     lleva el pedido original al tema elegido. Sin Jev: el tema activo más reciente (o uno nuevo si es un pedido).
   · En cada turno Alma ve los temas vivos (los más recientes, con su último paso) y el hilo del tema del mensaje: ya no
     depende de los últimos 24 turnos. Ella cierra su respuesta con [[tema: id]] (o «nuevo · título», o «id · listo:
     resultado»); el código la quita antes de que nadie la vea. Por cita o por tarjeta gana el código.
   · Un tema se cierra SOLO con su resultado (temaCerrar_ exige el texto del resultado): el encargo cumplido, el
     microproyecto unido, la tarjeta resuelta o el «listo: …» de Alma. Nunca porque terminó una llamada. Un tema sin
     movimiento en TEMA_VIVO_H_ deja de mostrarse y de contarse, pero sigue abierto: una cita o su nombre lo traen de vuelta.
   · Etiqueta: «📍 <tema corto>:» al inicio de cada WhatsApp de Alma al administrador que lleva tema, solo si tiene más de un
     tema vivo (temaEtiquetar_, desde waEnviar_). Nunca en la voz ni a huéspedes, socios o externos.
   · Socios (#522 T3): el pedido de un socio que compromete fechas, costos o cambios es un tema con su apartamento; pasa por
     Pendientes para la opinión de Juan; Alma contesta sola lo informativo y responde lo demás con el sí de Juan.
   · Encargos, microproyectos y tarjetas de Pendientes guardan su tema_id; los abiertos antes de esto se ligan una vez
     (TEMAS_V1, temasMigrar_). */

var TEMA_CAB_ = ['id', 'creado', 'actualizado', 'admin', 'titulo', 'tipo', 'apartamento', 'personas', 'estado', 'ultimo_paso', 'espera', 'origen', 'origen_id', 'resultado', 'cerrado', 'msgs', 'hilo'];
var TEMA_COLS_LEER_ = 16;        // sin «hilo» (lo largo): se lee solo el del tema del mensaje
var TEMA_VIVO_H_ = 72;           // con movimiento en las últimas 72 h: se muestra, se elige y cuenta para la etiqueta
var TEMA_ACTIVO_H_ = 6;          // en las últimas 6 h: activo (sin Jev gana el más reciente; dos activos y Jev duda → pregunta)
var TEMA_LISTA_ = 6, TEMA_JEV_MAX_ = 5, TEMA_HILO_ = 6, TEMA_MSGS_ = 12, TEMA_CORTO_MAX_ = 28, TEMA_DUDA_S_ = 1800;
var TEMA_POR_ = { tarjeta: 'por la tarjeta', socio: 'pedido del socio', cita: 'por cita', aclaracion: 'lo aclaró', nombre: 'por nombre', numero: 'esperaba un número', jev: 'por contexto', reciente: 'el más reciente', orbita: 'tocó su anillo' };
var TEMA_FIJOS_ = ['tarjeta', 'cita', 'socio', 'orbita'];   // el código ya sabe el tema: la etiqueta de Alma no lo cambia
var TEMA_CANALES_PREGUNTA_ = ['whatsapp', 'hub', 'app', 'llamada', 'calle'];   // donde alguien puede contestar «¿Esto es para A o para B?»
var TEMA_ACT_ = null;            // el tema de este turno { email, id | nuevo, por, … } (opAgente_); lo leen pendientes, encargos y microproyectos
var TEMA_PISTA_ = null;          // lo que quien llama ya sabe: { tema } (tarjeta, cita en WhatsApp)
var TEMA_MEMO_ = null;           // filas leídas en esta ejecución

/* ── La hoja ── */
/* Agrega columnas nuevas al final de una hoja que ya existe (encabezado y, si hace falta, la columna misma). */
function temaCabecera_(sh, cab) {
  try {
    if (sh.getMaxColumns() < cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), cab.length - sh.getMaxColumns());
    if (sh.getLastColumn() < cab.length) sh.getRange(1, 1, 1, cab.length).setValues([cab]);
  } catch (e) { console.error('temaCabecera_: ' + e); }
  return sh;
}
var TEMA_HOJA_OK_ = false;
function temaHoja_() { var sh = hojaCrear_('ALMA_TEMAS', TEMA_CAB_); if (!TEMA_HOJA_OK_) { TEMA_HOJA_OK_ = true; temaCabecera_(sh, TEMA_CAB_); } return sh; }
function temaDe_(r, fila) {
  var o = { fila: fila };
  TEMA_CAB_.slice(0, TEMA_COLS_LEER_).forEach(function (k, j) { o[k] = r[j] == null ? '' : r[j]; });
  ['id', 'admin', 'titulo', 'tipo', 'apartamento', 'estado', 'ultimo_paso', 'espera', 'origen', 'origen_id', 'resultado', 'cerrado', 'msgs'].forEach(function (k) { o[k] = String(o[k]); });
  o.creado = Number(o.creado) || 0; o.actualizado = Number(o.actualizado) || o.creado;
  try { o.personas = JSON.parse(String(r[7] || '[]')) || []; } catch (e) { o.personas = []; }
  return o;
}
function temaFilas_() {
  if (TEMA_MEMO_) return TEMA_MEMO_;
  var sh = temaHoja_(), n = sh.getLastRow(); if (!(n >= 2)) return (TEMA_MEMO_ = []);
  var ini = Math.max(2, n - 199);   // los últimos 200: lo más viejo ya se cerró o dejó de estar vivo
  return (TEMA_MEMO_ = sh.getRange(ini, 1, n - ini + 1, TEMA_COLS_LEER_).getValues().map(function (r, i) { return temaDe_(r, ini + i); }));
}
function temaLeer_(id) { id = String(id || ''); return id ? temaFilas_().filter(function (t) { return t.id === id; })[0] || null : null; }
function temaHilo_(t) {
  if (!t) return [];
  if (!t.hilo) { try { t.hilo = t.fila ? JSON.parse(String(temaHoja_().getRange(t.fila, TEMA_CAB_.length).getValue() || '[]')) || [] : []; } catch (e) { t.hilo = []; } }
  return t.hilo;
}
function temaGuardar_(t) {
  var sh = temaHoja_(), v = [t.id, t.creado, t.actualizado, t.admin, celdaTexto_(t.titulo), t.tipo, celdaTexto_(t.apartamento), JSON.stringify((t.personas || []).slice(-6)),
    t.estado, celdaTexto_(String(t.ultimo_paso || '').slice(0, 300)), t.espera || '', t.origen || '', String(t.origen_id || ''), celdaTexto_(String(t.resultado || '').slice(0, 500)), t.cerrado || '',
    String(t.msgs || ''), JSON.stringify((t.hilo || []).slice(-TEMA_HILO_))];
  if (!t.fila) { sh.appendRow(v); t.fila = sh.getLastRow(); if (TEMA_MEMO_) TEMA_MEMO_.push(t); return t; }
  sh.getRange(t.fila, 1, 1, t.hilo ? TEMA_CAB_.length : TEMA_COLS_LEER_).setValues([t.hilo ? v : v.slice(0, TEMA_COLS_LEER_)]);
  return t;
}
/* ── Un nombre corto y legible (#583 T2) ──
   El 16-nov el anillo decía «Cupos Google» y el tema «Juan pregunta cómo estamos con» (las primeras palabras del pedido, en
   tercera persona): Alma preguntó «¿Esto es para Juan pregunta cómo estamos con o para Estoy probando el modo?». Ahora el
   nombre sale sin quién lo pide («Juan pregunta…», «El usuario solicita…»), sin cortesías («Alma, por favor…»), sin la
   pregunta de estado («cómo estamos con…») y sin un conector al final («…con», «…o», «…de»). Lo usan el tema, el
   microproyecto (microNombre_) y la corrida única TEMAS_V2. ORBITA_SOBRA_ y ORBITA_COLA_ son de orbita.js. */
var TEMA_QUIEN_ = /^(juan|el usuario|la usuaria|el administrador|el admin|el due[nñ]o|[eé]l)\s+(me\s+|nos\s+)?(pregunta|pide|quiere|solicita|necesita|dice|consulta|comenta|avisa|propone|sugiere|reporta)(\s+(si|que|por|saber|sobre|a))?\s+/i;
var TEMA_ESTADO_RE_ = /^[¿¡\s]*(y\s+)?(c[oó]mo\s+(va|van|vamos|estamos|est[aá]|est[aá]n|sigue|siguen|qued[oó]|quedaron|anda|andamos|vas)|en\s+qu[eé]\s+(va|van|vamos|qued[oó]|est[aá]|quedamos)|qu[eé]\s+pas[oó]|qu[eé]\s+sabes|el\s+estado)(\s+(con|de|del|en))?(?=\s|$|[¿?¡!,.])\s*/i;
var TEMA_ARTICULO_ = /^(lo\s+del?|el|la|los|las|un|una|unos|unas|mi|mis)\s+/i;
var TEMA_CONECTOR_ = /^(de|del|la|las|el|los|a|al|en|y|o|con|para|por|que|un|una|su|sus|mi|mis|si|como|cómo)$/i;
function temaNombreCorto_(x, max, largo) {
  max = max || 6; largo = largo || 48;
  var t = String(x || '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(/\[[^\]]*\]/g, ' ').replace(/[«»"“”*_#`]/g, '').replace(/\+?\d[\d\s().\-]{6,}\d/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/(^|\s)(\S+)(\s+\2)+(?=\s|$)/gi, '$1$2');   // «o o» → «o»
  for (var k = 0; k < 5; k++) {
    var a = t;
    t = t.replace(TEMA_QUIEN_, '').replace(ORBITA_SOBRA_, '').replace(TEMA_ESTADO_RE_, '').replace(TEMA_ARTICULO_, '').trim();
    if (a === t) break;
  }
  t = t.split(/[?!\n]|\.(?:\s|$)|,\s|;\s/)[0].trim();
  var p = t.split(' ').filter(Boolean).slice(0, max).join(' ');
  if (p.length > largo) p = p.slice(0, largo).replace(/\s+\S*$/, '');
  for (var j = 0; j < 5; j++) {
    p = p.replace(/[.,;:!?¿¡\-–—·\s]+$/, '');
    if (ORBITA_COLA_.test(p)) p = p.replace(ORBITA_COLA_, '');
    else if (TEMA_CONECTOR_.test(p)) p = '';
    else break;
  }
  p = p.trim();
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
}
/* «Escríbele al socio de Narama 633 que…» → «Escríbele al socio de Narama 633» (2 a 6 palabras, sin cortar una a la mitad). */
function temaTitulo_(x) { return temaNombreCorto_(x, 6, 48) || 'Pedido'; }
/* ¿Se entiende al leerlo? 2 palabras o más, sin un conector al final y sin «Juan pregunta…». */
function temaLegible_(n) {
  n = String(n || '').trim(); var w = n.split(/\s+/).filter(Boolean);
  if (w.length < 2 || /^(el )?pedido( para claudio| en curso)?$/i.test(n)) return false;
  return !TEMA_CONECTOR_.test(w[w.length - 1].replace(/[.,;:!?]+$/, '')) && !TEMA_QUIEN_.test(n + ' ');
}
function temaCrear_(adm, d) {
  d = d || {};
  var ahora = Date.now(), t = { id: 'tm' + ahora.toString(36) + Math.floor(Math.random() * 1e3), creado: ahora, actualizado: ahora, admin: String((adm && adm.email) || d.admin || ''),
    titulo: temaTitulo_(d.titulo), tipo: d.tipo || 'pedido', apartamento: String(d.apartamento || ''), personas: d.personas || [], estado: 'abierto',
    ultimo_paso: String(d.ultimo_paso || ''), espera: d.espera || '', origen: d.origen || 'chat', origen_id: String(d.origen_id || ''), resultado: '', cerrado: '', msgs: '', hilo: [], fila: 0 };
  return temaGuardar_(t);
}
/* Cerrar: solo con su resultado (Juan, 14-nov-2026). Sin resultado no cierra; un tema ya cerrado no se toca. */
function temaCerrar_(idOt, resultado) {
  var t = typeof idOt === 'object' ? idOt : temaLeer_(idOt); resultado = String(resultado || '').trim();
  if (!t) return { ok: false, error: 'no existe' };
  if (!resultado) return { ok: false, error: 'un tema se cierra solo con su resultado' };
  if (t.estado === 'cerrado') return { ok: true, ya: true };
  t.estado = 'cerrado'; t.resultado = resultado; t.cerrado = new Date().toISOString(); t.actualizado = Date.now(); t.espera = '';
  temaGuardar_(t);
  return { ok: true };
}
function temaVivo_(t, ahora) { return t.estado === 'abierto' && (ahora || Date.now()) - t.actualizado < TEMA_VIVO_H_ * 3600000; }
/* Los temas vivos del administrador, el más reciente primero. */
function temaAbiertos_(email, ahora) {
  ahora = ahora || Date.now();
  return temaFilas_().filter(function (t) { return temaVivo_(t, ahora) && (!email || t.admin === email); }).sort(function (a, b) { return b.actualizado - a.actualizado; });
}
/* El tema de este turno, si es de esta persona (para ligar lo que se crea en el turno: encargo, microproyecto, tarjeta). Si
   el turno abre un tema nuevo, se crea aquí (y el cierre del turno usa ese mismo). '' si el turno no tiene tema. */
function temaActualId_(adm) {
  var s = TEMA_ACT_; if (!s || s.pregunta || (adm && adm.email && s.email !== adm.email)) return '';
  if (!s.id && s.nuevo) { var t = temaCrear_(adm || { email: s.email }, { titulo: s.titulo, apartamento: s.apartamento }); s.id = t.id; s.nuevo = false; s.por = s.por || 'nuevo'; }
  return s.id || '';
}
function temaPersonaSumar_(t, nombre, tel) {
  var k = fin8_(tel), n = String(nombre || '').trim().slice(0, 60); if (!k && !n) return;
  var ya = (t.personas || []).filter(function (p) { return (k && fin8_(p.t) === k) || (!k && p.n === n); })[0];
  if (ya) { if (n && !ya.n) ya.n = n; return; }
  (t.personas = t.personas || []).push({ n: n, t: k ? normTel_(tel) : '' });
}
function temaHiloSumar_(t, items) {
  var h = temaHilo_(t).slice();
  (items || []).forEach(function (x) { var s = String(x.t || '').replace(/\s+/g, ' ').trim(); if (s) h.push({ d: x.d, t: s.slice(0, 240), ts: Date.now() }); });
  t.hilo = h.slice(-TEMA_HILO_);
}

/* ── Nombres ── */
function temaApto_(a) { return String(a || '').replace(/^\s*z\s*\d+\s*-?\s*/i, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
/* Cómo se nombra al preguntar: «Narama 633», «el socio de Narama 633», «el huésped de Monaco D4» o su título. */
function temaNombre_(t) {
  var a = temaApto_(t.apartamento);
  if (!a) return t.titulo || 'el pedido';
  return t.tipo === 'socio' ? 'el socio de ' + a : t.tipo === 'huesped' ? 'el huésped de ' + a : a;
}
/* La etiqueta corta (≤ 28): «Narama 633 · socio» o el título, sin cortar una palabra a la mitad. */
function temaCorto_(t) {
  var a = temaApto_(t.apartamento), suf = { socio: 'socio', huesped: 'huésped' }[t.tipo] || '';
  var s = a ? a + (suf ? ' · ' + suf : '') : String(t.titulo || 'Pedido');
  if (s.length > TEMA_CORTO_MAX_) s = s.slice(0, TEMA_CORTO_MAX_ + 1).replace(/\s+\S*$/, '').replace(/[\s·,.;:-]+$/, '') || s.slice(0, TEMA_CORTO_MAX_);
  return s;
}
/* Un apartamento que el texto nombra entre los conocidos (sin internet: lo que Mi y Epi ya dejaron en caché). */
function temaAptoEnTexto_(texto) {
  var nombres = [], c = CacheService.getScriptCache();
  try { (JSON.parse(c.get('socmi_setup') || '[]') || []).forEach(function (s) { if (s && s.propiedad) nombres.push(s.propiedad); }); } catch (e) {}
  try { ((JSON.parse(c.get('episnap') || '{}') || {}).props || []).forEach(function (p) { var n = propNombre_(p); if (n) nombres.push(n); }); } catch (e) {}
  var h = []; try { h = socioPropsEnTexto_(texto, nombres); } catch (e) {}
  return h.length === 1 ? temaApto_(h[0]) : '';
}

/* ── Señales sin IA ── */
/* El tema del mensaje que se citó: el que Alma mandó en ese tema o, si era un relevo, el tema con esa persona. */
function temaPorMsg_(msgId, email) {
  msgId = String(msgId || ''); if (!msgId) return '';
  var t = temaFilas_().filter(function (x) { return (!email || x.admin === email) && (' ' + x.msgs + ' ').indexOf(' ' + msgId + ' ') >= 0; }).pop();
  if (t) return t.id;
  var rel = null; try { rel = relevoCitado_(msgId); } catch (e) {}
  return rel && rel.wa ? temaPorTel_(rel.wa, email) : '';
}
/* El tema abierto (aunque ya no esté vivo) con esa persona, el más reciente. o.tipo: solo de ese tipo; o.vivos: solo vivos. */
function temaPorTel_(tel, email, o) {
  o = o || {}; var k = fin8_(tel); if (!k) return '';
  var l = temaFilas_().filter(function (t) { return t.estado === 'abierto' && (!email || t.admin === email) && (!o.tipo || t.tipo === o.tipo) && (!o.vivos || temaVivo_(t)) && (t.personas || []).some(function (p) { return fin8_(p.t) === k; }); })
    .sort(function (a, b) { return b.actualizado - a.actualizado; });
  return l.length ? l[0].id : '';
}
/* Los temas que el texto nombra: el apartamento (todas sus palabras, o su número de 3+ cifras), el nombre de una persona y
   (#583 T2) su nombre: el título, el del microproyecto o el que se ve en el anillo, con todas sus palabras, o lo citado
   entre «…» o comillas (eso pesa más). Gana el que coincide más (Rue 301 sobre Ignacio 301 si dice «Rue»). */
var TEMA_VACIAS_ = /^(con|los|las|del|una|uno|unos|unas|que|por|para|sus|mis|como|socio|socia|pedido|tema)$/;
function temaPalabras_(n) { return socioNorm_(n).split(' ').filter(function (w) { return w.length > 2 && !TEMA_VACIAS_.test(w); }); }
function temaCitas_(texto) {
  var out = [], re = /[«"“]([^»"”]{2,80})[»"”]/g, m;
  while ((m = re.exec(String(texto || '')))) { var q = socioNorm_(m[1]); if (q) out.push(q); }
  return out;
}
function temaNombrados_(texto, lista) {
  var tn = ' ' + socioNorm_(texto) + ' ', tiene = function (w) { return tn.indexOf(' ' + w + ' ') >= 0; }, citas = temaCitas_(texto), alias = {};
  try { alias = temaAliasDe_(lista) || {}; } catch (e) { alias = {}; }
  var pts = lista.map(function (t) {
    var p = 0, k = socioClaveProp_(t.apartamento), num = k.filter(function (w) { return /^\d{3,}$/.test(w); }), pal = k.filter(function (w) { return !/^\d+$/.test(w) && w.length > 2; });
    if (k.length && k.every(tiene)) p = 3;
    else if (num.length && num.every(tiene)) p = pal.length && !pal.some(tiene) ? 1 : 2;
    if (!p && (t.personas || []).some(function (x) { var w = socioNorm_(x.n).split(' ').filter(function (y) { return y.length > 3 && !/^(socio|socia|recepcion|contacto|equipo)$/.test(y); }); return w.length && tiene(w[0]); })) p = 2;
    [t.titulo].concat(alias[t.id] || []).forEach(function (nom) {
      var n = socioNorm_(nom); if (!n || !temaLegible_(nom)) return;
      if (citas.some(function (q) { return q === n || (q.length >= 4 && (n.indexOf(q) >= 0 || q.indexOf(n) >= 0)); })) p = Math.max(p, 4);
      var w = temaPalabras_(nom); if (w.length >= 2 && w.every(tiene)) p = Math.max(p, 3);
    });
    return { t: t, p: p };
  }).filter(function (x) { return x.p; });
  var max = Math.max.apply(null, [0].concat(pts.map(function (x) { return x.p; })));
  return pts.filter(function (x) { return x.p === max; }).map(function (x) { return x.t; });
}
/* Los otros nombres de cada tema: el del microproyecto que lo lleva y el que se vio en su anillo (orbitaNombreGuardar_). */
var TEMA_ALIAS_K_ = 'tema_alias', TEMA_MICROS_ = null;
function temaAliasDe_(lista) {
  var ids = {}, out = {}; (lista || []).forEach(function (t) { ids[t.id] = 1; });
  try { var c = JSON.parse(CacheService.getScriptCache().get(TEMA_ALIAS_K_) || '{}') || {}; Object.keys(c).forEach(function (id) { if (ids[id]) out[id] = [].concat(c[id] || []); }); } catch (e) {}
  if (!TEMA_MICROS_ && typeof microFilas_ === 'function') {   // una lectura por turno (temaTurno_ la olvida)
    try { TEMA_MICROS_ = microFilas_().filter(function (m) { return m.tema_id && m.nombre; }).map(function (m) { return { tema: m.tema_id, nombre: m.nombre }; }); } catch (e) { TEMA_MICROS_ = []; }
  }
  (TEMA_MICROS_ || []).forEach(function (m) { if (ids[m.tema]) (out[m.tema] = out[m.tema] || []).push(m.nombre); });
  return out;
}
function temaAliasSumar_(id, nombre) {
  id = String(id || ''); nombre = String(nombre || '').trim(); if (!id || !temaLegible_(nombre)) return;
  try {
    var c = CacheService.getScriptCache(), m = JSON.parse(c.get(TEMA_ALIAS_K_) || '{}') || {};
    var l = (m[id] || []).filter(function (x) { return socioNorm_(x) !== socioNorm_(nombre); }); l.push(nombre); m[id] = l.slice(-3);
    var ks = Object.keys(m); if (ks.length > 40) ks.slice(0, ks.length - 40).forEach(function (k) { delete m[k]; });
    c.put(TEMA_ALIAS_K_, JSON.stringify(m), 21600);
  } catch (e) { console.error('temaAliasSumar_: ' + e); }
}
/* ¿Es un pedido (abre tema) o solo un saludo o acuse? */
/* #583 T2: una frase de prueba o charla («Estoy probando el modo») no abre tema: 5 palabras o más, o un verbo de acción. */
var TEMA_VERBO_ = /^(escrib|mand|envi|llam|agend|program|revis|busc|cambi|pon|quit|agreg|anad|crea|hac|haz|pid|pregunt|dile|dig|avis|recuerd|record|compr|pag|cancel|reserv|bloque|muev|mov|sub|baj|arregl|cotiz|confirm|respond|contest|cobr|factur|registr|anot|apunt|guard|borr|elimin|actualiz|prepar|redact|compart|verific|chequ|calcul|organiz|coordin|resuelv|soluc|abr|cierr|cerr|termin|activ|desactiv|apag|enciend|prend|notific|ayud)/;
function temaVerbo_(texto) {
  var w = socioNorm_(String(texto || '').replace(ORBITA_SOBRA_, '')).split(' ').filter(Boolean).slice(0, 3);
  return w.some(function (x) { return x.length > 2 && TEMA_VERBO_.test(x); });
}
function temaEsPedido_(texto) {
  var t = String(texto || '').trim(); if (!t || esAcuseCorto_(t)) return false;
  var n = socioNorm_(t).split(' ').filter(Boolean).length;
  return n >= 5 || (n >= 2 && temaVerbo_(t));
}
/* Una consulta pura: pregunta algo y no pide hacer nada («¿cómo va…?», «¿quién llega hoy?»). */
function temaEsConsulta_(texto) {
  var t = String(texto || '').trim(), n = socioNorm_(t);
  return !!t && (/\?/.test(t) || /^(como|que|cuando|cuanto|cuantos|cuantas|donde|quien|quienes|cual|cuales|hay|ya)\b/.test(n)) && !temaVerbo_(t);
}
/* Un acuse corto que sí contesta la pregunta de un envío: «sí», «mándalo», «por WhatsApp», «dale». */
function temaAcuse_(texto) {
  var t = String(texto || '').trim(); if (esAcuseCorto_(t)) return true;
  var n = socioNorm_(t); if (n.split(' ').length > 6) return false;
  return /^((si|no|ok) )?(si|mandal[oae]s?|envial[oae]s?|mandaselo|enviaselo|dale|hazlo|adelante|asi esta bien|esta bien|por (la )?plataforma|por whatsapp|por correo|por airbnb|por booking|el primero|el segundo|ese|esa|no lo mandes|no lo envies|espera)( |$)/.test(n);
}
/* ¿El tema espera el sí de un envío? Su último paso fue un borrador o la pregunta del canal («¿por la plataforma o por WhatsApp?»). */
function temaEsperaEnvio_(t) {
  return !!t && (t.espera === 'respuesta' || t.espera === 'numero') && /borrador|plataforma|whatsapp|por correo|(lo|se lo|te lo|la|se la) (mando|envio|mandamos|enviamos)|mandarlo|enviarlo|mandarselo|enviarselo|asi le (escribo|digo)/.test(socioNorm_(t.ultimo_paso));
}
/* Lo que Alma espera después de su respuesta: un número, una respuesta o nada. */
function temaEspera_(resp) {
  var t = socioNorm_(resp); if (String(resp || '').indexOf('?') < 0) return '';
  /* «¿Se lo mando por la plataforma o por WhatsApp?» no pide un número (#583): solo «su número», «su WhatsApp», «su celular». */
  return /\b(numero|telefono|celular|cel)\b/.test(t) || /\b(su|tu|el|un|otro) whatsapp\b/.test(t) ? 'numero' : 'respuesta';
}

/* ── Jev elige entre los temas vivos (rapido.js, mismo cliente). TEMA_JEV = 0 lo apaga. ── */
function temaJev_(texto, lista) {
  if (String(PropertiesService.getScriptProperties().getProperty('TEMA_JEV') || '1') === '0') return { ok: false, error: 'apagado (TEMA_JEV = 0)' };
  var pedido = jevLimpiar_(texto); if (!pedido) return { ok: false, error: 'sin pedido' };
  var crit = {}; lista.forEach(function (t, i) { crit['t' + (i + 1)] = jevLimpiar_(temaNombre_(t) + ' · ' + (t.titulo || '') + (t.ultimo_paso ? ' · último paso: ' + t.ultimo_paso : '')).slice(0, 220); });
  crit.nuevo = 'Otro asunto distinto de todos los anteriores, o un saludo o charla';
  var q = { tema: { type: 'choice', instructions: 'A cuál de los temas abiertos con su asistente pertenece este mensaje del administrador', criteria: crit } };
  return jevPreguntar_({ pedido: pedido }, q, 'Temas · Jev', function (j) {
    var a = j && j.answers && j.answers.tema, ch = a && String(a.choice || '');
    var conf = Number(a && a.confidence != null ? a.confidence : a && a.probabilities && a.probabilities[ch]);
    if (!a || !crit.hasOwnProperty(ch) || !(conf >= 0 && conf <= 1)) return null;
    return { choice: ch === 'nuevo' ? 'nuevo' : lista[Number(ch.slice(1)) - 1].id, confianza: conf };
  });
}

/* ── La pregunta cuando hay duda ── */
function temaDudaClave_(email) { return 'temaduda_' + String(email || '').toLowerCase(); }
/* Respondió a «¿Esto es para A o para B?»: nombra uno, dice «el primero/segundo» o «otro». null si no contesta eso. */
function temaDudaResolver_(email, texto, lista) {
  var c = CacheService.getScriptCache(), k = temaDudaClave_(email), d = null; try { d = JSON.parse(c.get(k) || 'null'); } catch (e) {}
  if (!d || !d.op || !d.op.length) return null;
  c.remove(k);
  var ops = d.op.map(function (id) { return temaLeer_(id); }).filter(Boolean), n = socioNorm_(texto), elegido = null;
  var nom = temaNombrados_(texto, ops); if (nom.length === 1) elegido = nom[0];
  /* Al contestar basta una palabra propia de la opción («el de Narama»). */
  if (!elegido) { var tn = ' ' + n + ' ', suyas = ops.filter(function (t) { return socioNorm_(temaApto_(t.apartamento) + ' ' + t.titulo).split(' ').some(function (w) { return w.length > 3 && !/^(socio|socia|huesped|pedido|encargo)$/.test(w) && tn.indexOf(' ' + w + ' ') >= 0; }); }); if (suyas.length === 1) elegido = suyas[0]; }
  if (!elegido && /^(el |la |al )?(primer[oa]?|1|a)\b/.test(n)) elegido = ops[0];
  if (!elegido && /^(el |la |al )?(segund[oa]|2|b)\b/.test(n)) elegido = ops[1] || null;
  if (!elegido && /^(el |la |al )?(tercer[oa]?|3|c)\b/.test(n)) elegido = ops[2] || null;
  var otro = !elegido && /^(otro|otra|ninguno|ninguna|es otro|es otra|nuevo|es nuevo)\b/.test(n);
  if (!elegido && !otro) return null;   // escribió otra cosa: se atiende como mensaje nuevo
  var junto = d.texto + '\n\n(Aclaró: «' + String(texto).trim().slice(0, 200) + '».)';
  return elegido ? { id: elegido.id, por: 'aclaracion', texto: junto } : { nuevo: true, por: 'aclaracion', titulo: temaTitulo_(d.texto), apartamento: temaAptoEnTexto_(d.texto), texto: junto };
}
function temaPregunta_(email, texto, ops) {
  try { CacheService.getScriptCache().put(temaDudaClave_(email), JSON.stringify({ texto: String(texto).slice(0, 3000), op: ops.map(function (t) { return t.id; }), ts: Date.now() }), TEMA_DUDA_S_); } catch (e) {}
  return '¿Esto es para ' + ops.map(temaNombre_).join(' o para ') + '?';
}

/* ── A qué tema va un mensaje: el único lugar ── → { id | nuevo, por, lista, pregunta?, texto?, jev? } */
/* ¿Se puede preguntar «¿Esto es para A o para B?»? Solo con nombres legibles y distintos (#583 T2). */
function temaSePuedePreguntar_(ops) {
  var n = (ops || []).map(temaNombre_), k = n.map(socioNorm_);
  return n.length >= 2 && n.every(temaLegible_) && k.every(function (x, i) { return k.indexOf(x) === i; });
}
function temaElegir_(adm, texto, o) {
  o = o || {}; var email = adm.email, ahora = Date.now(), vivos = temaAbiertos_(email, ahora);
  var con = function (x) { return Object.assign({ lista: vivos }, x); };
  var fijo = o.tema ? temaLeer_(o.tema) : null; if (fijo && fijo.admin === email) return con({ id: fijo.id, por: o.por || 'tarjeta' });
  /* Sin nadie que conteste (segundo plano, instrucción de GitHub, vigilancias) o con nombres que no se leen bien (#583):
     nunca pregunta; va el primero. */
  var preguntar = function (ops, extra) {
    if (o.sinPregunta || !temaSePuedePreguntar_(ops)) return Object.assign(con({ id: ops[0].id, por: 'reciente' }), extra || {});
    return Object.assign(con({ pregunta: temaPregunta_(email, texto, ops) }), extra || {});
  };
  var ac = temaDudaResolver_(email, texto, vivos); if (ac) return con(ac);
  var abiertos = temaFilas_().filter(function (t) { return t.estado === 'abierto' && t.admin === email; });
  var nom = temaNombrados_(texto, abiertos);
  if (nom.length === 1) return con({ id: nom[0].id, por: 'nombre' });
  if (nom.length > 1) return preguntar(nom.sort(function (a, b) { return b.actualizado - a.actualizado; }).slice(0, 3));
  var tels = []; try { tels = telsEnTexto_(texto); } catch (e) {}
  if (tels.length) {
    var porTel = tels.map(function (x) { return temaPorTel_(x, email); }).filter(Boolean)[0]; if (porTel) return con({ id: porTel, por: 'nombre' });
    var esp = vivos.filter(function (t) { return t.espera === 'numero'; })[0]; if (esp) return con({ id: esp.id, por: 'numero' });
  }
  var pedido = temaEsPedido_(texto), activos = vivos.filter(function (t) { return ahora - t.actualizado < TEMA_ACTIVO_H_ * 3600000; });
  /* Lo que no es seguro (Jev con duda o «el más reciente») nunca cae en un tema que espera el sí de un envío, salvo un acuse
     corto: el 16-nov «pásame con Claudio» se tomó como respuesta a «¿por la plataforma o por WhatsApp?». */
  var acuse = temaAcuse_(texto), apto = function (t) { return acuse || !temaEsperaEnvio_(t); };
  var nuevo = function () { return pedido ? con({ nuevo: true, por: 'nuevo', titulo: temaTitulo_(texto), apartamento: temaAptoEnTexto_(texto) }) : con({}); };
  if (!vivos.length) return nuevo();
  var j = (vivos.length > 1 || pedido) ? temaJev_(texto, vivos.slice(0, TEMA_JEV_MAX_)) : { ok: false, error: 'un solo tema y no es un pedido' };
  var conJev = function (r) { r.jev = j; return r; };
  if (j.ok && j.confianza >= JEV_UMBRAL_) return conJev(j.choice === 'nuevo' ? nuevo() : con({ id: j.choice, por: 'jev' }));
  /* Con duda, Alma elige (Juan, 16-nov: «ejecuta, no esperes»). Una consulta pura no se pega a otro tema. */
  if (temaEsConsulta_(texto) && !acuse) return conJev(nuevo());
  if (j.ok) {
    var prim = vivos.filter(function (t) { return t.id === j.choice; })[0];
    if (activos.length >= 2) {
      var ops = (prim ? [prim] : []).concat(activos.filter(function (t) { return t !== prim; })).filter(apto).slice(0, 2);
      if (ops.length === 2 && !o.sinPregunta && temaSePuedePreguntar_(ops)) return preguntar(ops, { jev: j });
    }
    if (j.choice === 'nuevo') return conJev(nuevo());
    if (prim && apto(prim)) return conJev(con({ id: prim.id, por: 'jev' }));
  }
  var rec = activos.filter(apto)[0];
  if (rec) return conJev(con({ id: rec.id, por: 'reciente' }));
  return conJev(nuevo());
}

/* ── El turno (opAgente_): elige, deja TEMA_ACT_ y arma el bloque para el prompt ── */
function temaTurno_(adm, texto, canal) {
  TEMA_ACT_ = null; TEMA_MEMO_ = null; TEMA_MICROS_ = null;
  if (!adm || !adm.email) return null;
  var pista = TEMA_PISTA_ || {}; TEMA_PISTA_ = null;
  var sel = temaElegir_(adm, texto, Object.assign({ sinPregunta: TEMA_CANALES_PREGUNTA_.indexOf(String(canal || '')) < 0 }, pista));
  sel.email = adm.email; sel.canal = canal;
  TEMA_ACT_ = sel;
  return sel;
}
/* Lo que Alma ve en el turno: solo si hay temas vivos (con la hoja vacía no suma nada al prompt). */
function temaBloque_(adm, sel) {
  var l = (sel && sel.lista) || []; if (!l.length) return '';
  var t = sel.id ? temaLeer_(sel.id) : null, quien = String(adm.nombre || 'Juan').split(' ')[0].toUpperCase();
  var out = '\n\nTEMAS ABIERTOS (cada mensaje va a uno; termina con [[tema: <id>]], [[tema: nuevo · <título corto>]] si es otro asunto o [[tema: <id> · listo: <resultado>]] solo cuando ya tiene su resultado, nunca porque terminó una llamada; nadie lo ve):';
  l.slice(0, TEMA_LISTA_).forEach(function (x) {
    var tel = x.tipo === 'socio' ? (x.personas || []).filter(function (p) { return p.t; })[0] : null;
    out += '\n· [' + x.id + '] ' + temaNombre_(x) + (x.apartamento && x.titulo && x.titulo.indexOf(temaApto_(x.apartamento)) < 0 ? ' · ' + x.titulo : '') + (tel ? ' (+' + tel.t + ')' : '') + (x.ultimo_paso ? ' — último: ' + String(x.ultimo_paso).slice(0, 140) : '') + (x.espera === 'numero' ? ' (espera un número)' : '');
  });
  out += '\nESTE MENSAJE: ' + (t ? '[' + t.id + '] ' + temaNombre_(t) + ' (' + (TEMA_POR_[sel.por] || sel.por) + ')' : 'tema nuevo') + '.';
  var h = t ? temaHilo_(t) : [];
  if (h.length) out += ' HILO DE ESE TEMA:\n' + h.map(function (x) { return (x.d === 'yo' ? quien : x.d === 'socio' ? 'SOCIO' : 'ALMA') + ': ' + x.t; }).join('\n');
  return out;
}
/* Alma pregunta a cuál va: la respuesta del turno, sin IA. */
function temaPreguntaSalida_(sel) { return { respuesta: sel.pregunta, hechas: [], esfera: '', subcategoria: '', micro: '', nivel: '', noPudo: [], temaPregunta: true }; }
/* [[tema: tm1]] · [[tema: nuevo · Título]] · [[tema: tm1 · listo: el resultado]] fuera del texto. */
function temaSacarEtiqueta_(texto) {
  var tag = null;
  var limpio = String(texto || '').replace(/\[\[\s*tema\s*:?\s*([^\]]*?)\s*\]\]/gi, function (_, a) {
    var p = String(a).split(/\s*·\s*|\s+\|\s+/), id = String(p[0] || '').trim(), resto = p.slice(1).join(' · ').trim(), lm = /^(?:listo|cerrar|cerrado)\s*:\s*([\s\S]+)$/i.exec(resto);
    tag = /^nuevo$/i.test(id) ? { nuevo: true, titulo: resto } : { id: id, listo: lm ? lm[1].trim() : '' };
    return '';
  }).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, tag: tag };
}
/* Al cerrar el turno (chatTurnoCerrar_): el tema final, su último paso, su hilo, a quién se le escribió y, con «listo», el
   cierre. Devuelve el tema_id para las filas del turno ('' si no hay tema). */
function temaCerrarTurno_(adm, texto, resp, ag) {
  var sel = TEMA_ACT_; if (!adm || !sel || sel.email !== adm.email || sel.pregunta || (ag && ag.temaPregunta)) return '';
  var tag = (ag && ag.tema) || null, fijo = TEMA_FIJOS_.indexOf(sel.por) >= 0, t = null;
  if (tag && tag.id && !fijo) { var tg = temaLeer_(tag.id); if (tg && tg.admin === adm.email) t = tg; }   // Alma lo corrige: otro tema
  if (!t && tag && tag.nuevo && !fijo) {
    if (sel.id && sel.por === 'nuevo') { t = temaLeer_(sel.id); if (t && tag.titulo) t.titulo = temaTitulo_(tag.titulo); }   // ya se creó en el turno (un encargo, un microproyecto)
    else t = temaCrear_(adm, { titulo: tag.titulo || texto, apartamento: temaAptoEnTexto_(tag.titulo + ' ' + texto) });
  }
  if (!t && sel.id) t = temaLeer_(sel.id);
  /* Un tema nuevo nace si hizo algo, si espera algo de Juan o si Alma lo marcó nuevo; una consulta suelta no abre tema. */
  var hizo = ((ag && ag.hechas) || []).some(function (h) { return h && !h.error && h.tipo !== 'consulta'; });
  if (!t && sel.nuevo && (hizo || temaEspera_(resp) || (tag && tag.nuevo))) t = temaCrear_(adm, { titulo: (tag && tag.titulo) || sel.titulo || texto, apartamento: sel.apartamento });
  if (!t) return '';
  sel.id = t.id; sel.nuevo = false;   // lo que el cierre del turno crea después (un pedido a Desarrollo) va a este mismo tema
  if (t.estado !== 'abierto') { t.estado = 'abierto'; t.resultado = ''; t.cerrado = ''; }   // un mensaje nuevo en un tema cerrado lo reabre
  temaHiloSumar_(t, [{ d: 'yo', t: texto }, { d: 'alma', t: resp }]);
  ((ag && ag.hechas) || []).forEach(function (h) { if (h && h.tel && !h.error) temaPersonaSumar_(t, h.nombre, h.tel); if (h && h.propiedad && !t.apartamento) t.apartamento = temaApto_(h.propiedad); });
  t.ultimo_paso = String(resp || '').replace(/\s+/g, ' ').trim().slice(0, 200); t.espera = temaEspera_(resp); t.actualizado = Date.now();
  if (tag && tag.listo && (!tag.id || tag.id === t.id)) temaCerrar_(t, tag.listo); else temaGuardar_(t);
  return t.id;
}

/* Lo que terminó en segundo plano (#583 T2.4). El 16-nov el «sí, envíalo» se terminó por detrás (opProcesar_ con seguira,
   y vozSeguirPronto en retomar.js) y el tema nunca supo que ya había salido: siguió esperando «respuesta», el siguiente
   mensaje («pásame con Claudio») cayó ahí y el agente lo tomó como el sí. Ahora el resultado queda en el hilo («Ya salió: …»)
   y, si algo salió, la espera se limpia. Devuelve el tema_id ('' si no hay). */
function temaSumarResultado_(adm, id, r) {
  var t = id ? temaLeer_(id) : null; if (!t || !adm || t.admin !== adm.email) return '';
  r = r || {};
  var hechas = r.hechas || [], bien = hechas.filter(function (h) { return h && !h.error && h.tipo !== 'consulta'; }), malas = hechas.filter(function (h) { return h && h.error; });
  var res = String(r.respuesta || '').replace(/\s+/g, ' ').trim(), corto = function (h) { return String(h.resumen || h.tipo || '').replace(/\s+/g, ' ').slice(0, 90); };
  var paso = r.fallo ? 'No se pudo terminar en segundo plano (' + String(r.fallo).slice(0, 100) + ')'
    : (bien.length ? 'Ya salió: ' + bien.slice(0, 3).map(corto).join(' · ') : 'Terminado en segundo plano') + (malas.length ? ' · no salió: ' + malas.slice(0, 2).map(corto).join(' · ') : '');
  var linea = paso + (res && !r.fallo ? ' — ' + res : '');
  temaHiloSumar_(t, [{ d: 'alma', t: linea }]);
  bien.forEach(function (h) { if (h.tel) temaPersonaSumar_(t, h.nombre, h.tel); if (h.propiedad && !t.apartamento) t.apartamento = temaApto_(h.propiedad); });
  t.ultimo_paso = linea.slice(0, 200); t.espera = bien.length || r.fallo ? '' : temaEspera_(res); t.actualizado = Date.now();
  if (t.estado !== 'abierto') { t.estado = 'abierto'; t.resultado = ''; t.cerrado = ''; }
  temaGuardar_(t);
  return t.id;
}

/* ── WhatsApp ── */
/* «📍 Narama 633 · socio: …» solo al administrador y solo si tiene más de un tema vivo (contando este). */
function temaEtiquetar_(wa, texto, id) {
  if (!id || /^📍/.test(String(texto || ''))) return texto;
  var adm = null; try { adm = adminPorTel_(wa); } catch (e) {}
  if (!adm) return texto;   // nunca a huéspedes, socios ni externos
  var t = temaLeer_(id); if (!t) return texto;
  var otros = temaAbiertos_(adm.email).filter(function (x) { return x.id !== t.id; }).length;
  return otros >= 1 ? '📍 ' + temaCorto_(t) + ': ' + texto : texto;
}
/* El id de Meta de lo que Alma mandó en ese tema: si Juan lo cita, el mensaje va a ese tema. */
function temaMsg_(id, msgId) {
  var t = temaLeer_(id); msgId = String(msgId || ''); if (!t || !msgId) return;
  var l = String(t.msgs || '').split(' ').filter(Boolean).concat([msgId]);
  t.msgs = l.slice(-TEMA_MSGS_).join(' ');
  try { temaHoja_().getRange(t.fila, TEMA_CAB_.indexOf('msgs') + 1).setValue(t.msgs); } catch (e) { console.error('temaMsg_: ' + e); }
}
/* El tema en las filas de ALMA_WHATSAPP (columna tema_id). filas: números de fila, o { wa } para el último mensaje entrante de ese número. */
function temaMarcarWA_(filas, id) {
  if (!id) return 0;
  var sh = hojaWA_(), col = WA_CAB_.indexOf('tema_id') + 1, n = 0;
  if (filas && filas.wa) {
    var last = sh.getLastRow(), desde = Math.max(2, last - 199), v = last >= 2 ? sh.getRange(desde, 1, last - desde + 1, WA_CAB_.length).getValues() : [], k = fin8_(filas.wa);
    for (var i = v.length - 1; i >= 0; i--) if (fin8_(v[i][1]) === k && v[i][3] === 'in') { if (!String(v[i][col - 1] || '')) { sh.getRange(desde + i, col).setValue(id); n++; } break; }
    return n;
  }
  (filas || []).forEach(function (f) { try { sh.getRange(f, col).setValue(id); n++; } catch (e) {} });
  return n;
}

/* ── Socios (#522 T3): el pedido de un socio que compromete fechas, costos o cambios ── */
function temaSocioPedido_(ctx) {
  var wa = String(ctx.resId || '').indexOf('wa:') === 0 ? String(ctx.resId).slice(3) : ''; if (!wa) return '';
  var jefe = chatPrincipal_(); if (!jefe) return '';
  var s = null; try { s = socioSeguro_(wa); } catch (e) {}
  var apto = temaApto_((s && s.propiedad) || ''), nombre = String((s && s.nombre) || ctx.huesped || '').trim(), texto = String(ctx.texto || '').trim();
  TEMA_MEMO_ = null;
  var id = temaPorTel_(wa, jefe.email, { tipo: 'socio', vivos: true }), t = id ? temaLeer_(id) : null;
  if (!t) t = temaCrear_(jefe, { tipo: 'socio', titulo: apto ? apto + ' · socio' : 'Pedido de socio', apartamento: apto, personas: [{ n: nombre, t: normTel_(wa) }], origen: 'socio', origen_id: normTel_(wa) });
  temaHiloSumar_(t, [{ d: 'socio', t: texto }]);
  t.ultimo_paso = 'El socio pidió: ' + texto.replace(/\s+/g, ' ').slice(0, 180); t.espera = 'juan'; t.actualizado = Date.now();
  temaGuardar_(t);
  try { temaMarcarWA_({ wa: wa }, t.id); } catch (e) { console.error('temaMarcarWA_: ' + e); }
  var yaTarjeta = false; try { yaTarjeta = pendFilas_().some(function (x) { return String(x.tema_id) === t.id && String(x.estado) === 'abierto'; }); } catch (e) {}
  if (!yaTarjeta) {
    var de = apto ? 'el socio de ' + apto : 'un socio';
    pendAvisar_(jefe, (nombre || 'Un socio') + (apto ? ' (socio de ' + apto + ')' : '') + ' pide:\n«' + texto.slice(0, 800) + '»\n\nDime qué opinas y se lo respondo.', { origen: 'socio', tema: t.id, push: true,
      clasif: { tipo: 'atencion', area: 'proposito', proyecto: 'Socios', titulo: tituloCorto_('Pedido de ' + de, 100), resumen: texto.replace(/\s+/g, ' ').slice(0, 200),
        aviso: (apto ? 'El socio de ' + apto : 'Un socio') + ' pide algo y necesito tu opinión antes de responderle.', importancia: 2, acciones: [] } });
  }
  return 'PEDIDO DEL SOCIO (tema ' + t.id + '): lo que pide compromete fechas, costos o cambios. No los confirmes ni prometas: dile que lo revisas con Juan y le respondes por aquí. Lo que sea solo información sí contéstalo.';
}
/* Juan responde una tarjeta que tiene tema: qué hacer con su respuesta (con un socio, escribirle y cerrar al resolverse). */
function temaNotaTarjeta_(id) {
  var t = temaLeer_(id); if (!t || t.tipo !== 'socio') return '';
  var p = (t.personas || []).filter(function (x) { return x.t; })[0], a = temaApto_(t.apartamento);
  return '\nEs el pedido de un socio (tema ' + t.id + (a ? ', socio de ' + a : '') + (p ? ', +' + p.t : '') + '). Con lo que dice Juan, respóndele al socio con escribir_a_equipo' +
    (a ? ' (persona «socio de ' + a + '»' + (p ? ', numero +' + p.t : '') + ')' : '') + ' y, cuando quede resuelto, cierra con [[tema: ' + t.id + ' · listo: <resultado>]].';
}
/* Juan tocó «Ya está» en la tarjeta: cierra el tema que nació de ella (o el del socio), con ese resultado. */
function temaTarjetaResuelta_(x) {
  var id = String((x && x.tema_id) || ''); if (!id) return;
  var t = temaLeer_(id); if (!t) return;
  if ((t.origen === 'pendiente' && String(t.origen_id) === String(x.id)) || t.tipo === 'socio') temaCerrar_(t, 'Juan lo dio por resuelto en Pendientes: ' + String(x.titulo || '').slice(0, 120));
}

/* ── Una sola vez (TEMAS_V1): los encargos, microproyectos y tarjetas abiertos de antes se ligan a un tema ── */
var TEMAS_V1_TOPE_ = 40;
function temasMigrar_() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('TEMAS_V1')) return { hecho: true, ligados: 0 };
  var n = 0, ahora = Date.now(), tope = function () { return n >= TEMAS_V1_TOPE_; };
  var porMail = function (email) { return adminPorEmail_(email) || { email: email }; };
  /* Encargos abiertos (14 días, como «lo que pediste y sigue abierto»). */
  var shE = hojaEnc_(), nE = shE.getLastRow(), cE = ENC_CAB_.indexOf('tema_id');
  if (nE >= 2) shE.getRange(2, 1, nE - 1, ENC_CAB_.length).getValues().forEach(function (r, i) {
    if (tope() || String(r[7]) !== 'abierto' || String(r[cE] || '') || ahora - new Date(r[1]).getTime() > 14 * 86400000) return;
    var t = temaCrear_(porMail(String(r[2])), { tipo: 'encargo', titulo: 'Encargo · ' + String(r[4] || ''), personas: [{ n: String(r[4] || ''), t: normTel_(r[5]) }], origen: 'encargo', origen_id: String(r[0]), ultimo_paso: String(r[6] || '').slice(0, 200) });
    shE.getRange(i + 2, cE + 1).setValue(t.id); n++;
  });
  /* Microproyectos sin terminar. */
  microFilas_().forEach(function (m) {
    if (tope() || m.tema_id || [MICRO_ESTADOS_.unido, MICRO_ESTADOS_.cerrado].indexOf(m.estado) >= 0) return;
    var t = temaCrear_(porMail(m.quien), { tipo: 'micro', titulo: m.nombre, origen: 'micro', origen_id: m.id, ultimo_paso: m.estado });
    microHoja_().getRange(m.fila, MICRO_CAB_.indexOf('tema_id') + 1).setValue(t.id); n++;
  });
  /* Tarjetas de Pendientes que esperan a Juan. */
  pendFilas_().forEach(function (x) {
    if (tope() || x.tema_id || x.tipo !== 'atencion' || !pendVivo_(x, ahora)) return;
    var t = temaCrear_(porMail(String(x.email)), { tipo: 'pendiente', titulo: x.titulo, origen: 'pendiente', origen_id: String(x.id), ultimo_paso: String(x.resumen || '').slice(0, 200) });
    hojaPend_().getRange(x.fila, PEND_CAB_.indexOf('tema_id') + 1).setValue(t.id); n++;
  });
  if (!tope()) P.setProperty('TEMAS_V1', new Date().toISOString() + ' · ' + n + ' ligados en la última pasada');
  return { hecho: !tope(), ligados: n };
}

/* ── Una sola vez (TEMAS_V2, #583 T2): los nombres viejos se limpian con la misma función ──
   «Juan pregunta cómo estamos con» → «Cupos de Google». Un microproyecto toma su nombre limpio o, si no se lee, el de lo
   que pidió Juan; su tema toma ese mismo nombre (un solo nombre para el anillo, el microproyecto y el chat). Un tema suelto
   toma su título limpio o, si no se lee, el de su primer mensaje. Solo escribe lo que cambia; se repite hasta terminar. */
var TEMAS_V2_TOPE_ = 60;
function temasRenombrar_() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('TEMAS_V2')) return { hecho: true, temas: 0, micros: 0 };
  var n = 0, nT = 0, nM = 0, tope = function () { return n >= TEMAS_V2_TOPE_; };
  var mejor = function (fn, fuentes) { for (var i = 0; i < fuentes.length; i++) { var x = fn(fuentes[i]); if (temaLegible_(x)) return x; } return ''; };
  var porTema = {};
  microFilas_().forEach(function (m) {
    var pidio = String(((m.ajustes || []).filter(function (a) { return a.de !== 'claude'; })[0] || {}).texto || '');
    var nuevo = mejor(microNombre_, [m.nombre, pidio]) || m.nombre;
    if (nuevo !== m.nombre && !tope()) { microHoja_().getRange(m.fila, MICRO_CAB_.indexOf('nombre') + 1).setValue(nuevo); m.nombre = nuevo; n++; nM++; }
    if (m.tema_id) porTema[m.tema_id] = { nombre: m.nombre, pidio: pidio };
  });
  TEMA_MEMO_ = null;
  temaFilas_().forEach(function (t) {
    if (tope() || t.tipo === 'socio') return;
    var mi = porTema[t.id], primero = mi ? '' : String((temaHilo_(t).filter(function (h) { return h.d === 'yo'; })[0] || {}).t || '');
    var nuevo = mi && (t.tipo === 'micro' || t.origen === 'micro' || !temaLegible_(t.titulo)) && temaLegible_(mi.nombre) ? mi.nombre
      : mejor(temaTitulo_, [t.titulo].concat(mi ? [mi.nombre, mi.pidio] : [primero])) || t.titulo;
    if (nuevo === t.titulo) return;
    temaHoja_().getRange(t.fila, TEMA_CAB_.indexOf('titulo') + 1).setValue(celdaTexto_(nuevo)); t.titulo = nuevo; n++; nT++;
  });
  if (!tope()) P.setProperty('TEMAS_V2', new Date().toISOString() + ' · ' + nT + ' temas y ' + nM + ' microproyectos renombrados en la última pasada');
  return { hecho: !tope(), temas: nT, micros: nM };
}
