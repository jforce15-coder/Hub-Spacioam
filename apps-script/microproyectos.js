/* ═══ MICROPROYECTOS (issue #374): cada pedido para Claude agrupa sus ajustes ═════════════════════════════════════
   Antes, cada cosa que Juan le decía a Alma para Claude salía como un pedido nuevo: otro issue y otra sesión de Claude,
   sin contexto («Si» llegó solo como #367). Ahora cada pedido nuevo abre un MICROPROYECTO con un nombre corto
   («Uber con Alma») y lo que sigue se suma a ese mismo microproyecto:
     · mismo issue de GitHub (como comentario, no otro issue);
     · misma rama y mismo PR mientras sigan abiertos; si el PR ya se unió, «segunda parte» (PR nuevo, mismo historial);
     · cada disparo de la rutina de Claude lleva el historial completo (pedido, ajustes y respuestas de Claude).
   A qué microproyecto va cada pedido lo decide Alma en el MISMO turno, sin otra llamada a la IA: el prompt de la
   secretaria lleva la lista de los abiertos y ella termina su respuesta con [[micro: …]] (microBloque_). Sin etiqueta
   (llamada, segundo plano, voz), una comparación de palabras barata (microElegir_). Si tiene duda, pregunta con botones
   «A <nombre>» · «Es nuevo» (chat.js, borrador para Claude).
   Estados: en trabajo → Claude pregunta → listo para unir → unido (o cerrado). Los cambian las respuestas de Claude
   (paraClaudeRespuesta_), el «Unir» (unir.js) y una revisión de fondo cada 10 min (microRevisar_, respeta el cupo).
   El borrador (antes del «mándalo») vive en el borrador para Claude (chat.js), no en esta hoja.
   Pendientes muestra una tarjeta por microproyecto (microTarjetas_), con sus ajustes y, si Claude pregunta, botones.
   Nivel (sencillo · complejo, paraclaude.js): la columna «nivel» guarda con qué tarea corrió lo último (Sonnet u Opus);
   los ajustes lo heredan salvo que Juan o Alma digan otro, y la tarjeta lo muestra como chip. Filas viejas: complejo.
   «Súbelo» (microSubir_) vuelve a mandar el más reciente como complejo, con su historial, como ajuste del mismo. */

var MICRO_CAB_ = ['id', 'nombre', 'estado', 'creado', 'actualizado', 'quien', 'issue', 'pr', 'rama', 'sesion', 'ajustes', 'ultima_pregunta', 'opciones', 'parte', 'unido', 'nivel'];
var MICRO_ABIERTO_DIAS_ = 7;   // un microproyecto unido o cerrado sigue «abierto» para ajustes 7 días
var MICRO_ESTADOS_ = { trabajo: 'en trabajo', pregunta: 'Claude pregunta', listo: 'listo para unir', unido: 'unido', cerrado: 'cerrado' };
var MICRO_VACIAS_ = ('para como esta este esto estos estas tambien ademas cuando donde porque quiero quieres puedes puede ' +
  'deberia debe tiene tienen hacer haga hagas algo cosa cosas favor gracias claude claudio alma agregale agrega anade anadele ' +
  'sumale pedido borrador cambio cambia cambiale ponle quita quitale mejor mismo misma ahora luego despues siempre nunca solo ' +
  'sobre entre desde hasta pero todo toda todos todas cada otro otra otros unas unos sean sera seria esos esas ellos ella ' +
  'mandalo mandale dile digale hola bien bueno buena listo').split(' ');

function microHoja_() {
  var sh = hojaCrear_('ALMA_MICROPROYECTOS', MICRO_CAB_);
  if (sh.getLastColumn() < MICRO_CAB_.length) sh.getRange(1, 1, 1, MICRO_CAB_.length).setValues([MICRO_CAB_]);
  return sh;
}
function microDe_(r, fila) {
  var o = { fila: fila }; MICRO_CAB_.forEach(function (k, j) { o[k] = r[j]; });
  ['id', 'nombre', 'estado', 'quien', 'issue', 'pr', 'rama', 'sesion', 'ultima_pregunta', 'unido'].forEach(function (k) { o[k] = String(o[k] == null ? '' : o[k]); });
  try { o.ajustes = JSON.parse(String(o.ajustes || '[]')) || []; } catch (e) { o.ajustes = []; }
  try { o.opciones = JSON.parse(String(o.opciones || '[]')) || []; } catch (e) { o.opciones = []; }
  o.parte = Number(o.parte) || 1;
  o.nivel = claudeNivel_(o.nivel);   // filas viejas (sin nivel): complejo
  o.creado = Number(o.creado) || 0; o.actualizado = Number(o.actualizado) || o.creado;
  return o;
}
function microFilas_() {
  var sh = microHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  var ini = Math.max(2, n - 299);   // los últimos 300 bastan: lo viejo ya se cerró
  return sh.getRange(ini, 1, n - ini + 1, MICRO_CAB_.length).getValues().map(function (r, i) { return microDe_(r, ini + i); });
}
function microLeer_(id) { id = String(id || ''); if (!id) return null; return microFilas_().filter(function (m) { return m.id === id; })[0] || null; }
/* Una celda guarda 50 000 caracteres: el historial se corta por en medio (el pedido original siempre se queda). */
function microAjustesJson_(aj) {
  aj = (aj || []).map(function (a) { return { ts: Number(a.ts) || Date.now(), de: a.de === 'claude' ? 'claude' : 'juan', texto: String(a.texto || '').slice(0, 1500) }; });
  var s = JSON.stringify(aj);
  while (s.length > 45000 && aj.length > 2) { aj.splice(1, 1); s = JSON.stringify(aj); }
  return s;
}
function microGuardar_(m) {
  m.actualizado = Date.now();
  var v = MICRO_CAB_.map(function (k) {
    if (k === 'ajustes') return microAjustesJson_(m.ajustes);
    if (k === 'opciones') return JSON.stringify((m.opciones || []).slice(0, 5));
    if (k === 'ultima_pregunta') return String(m.ultima_pregunta || '').slice(0, 3000);
    return m[k] == null ? '' : m[k];
  });
  var sh = microHoja_();
  if (m.fila) sh.getRange(m.fila, 1, 1, MICRO_CAB_.length).setValues([v]);
  else { sh.appendRow(v); m.fila = sh.getLastRow(); }
  return m;
}
/* Nombre corto: 2 a 5 palabras del título, sin cortar a media palabra («Uber con Alma»). */
function microNombre_(t) {
  t = String(t || '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
  var p = t.split(' ').slice(0, 5).join(' ').replace(/[.,;:!?¿¡\-–—]+$/, '');
  p = p.slice(0, 40).replace(/\s+\S*$/, function (x) { return p.length > 40 ? '' : x; });
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Pedido para Claudio';
}
function microCrear_(adm, nombre) {
  var m = { id: 'mp' + Date.now().toString(36) + Math.floor(Math.random() * 1e3), nombre: microNombre_(nombre), estado: MICRO_ESTADOS_.trabajo,
    creado: Date.now(), actualizado: Date.now(), quien: (adm && adm.email) || '', issue: '', pr: '', rama: '', sesion: '', ajustes: [],
    ultima_pregunta: '', opciones: [], parte: 1, unido: '', nivel: '' };
  return m;   // se guarda al disparar (paraClaudeCrear_): un pedido que no sale no deja fila
}
/* Abiertos para sumar ajustes: los que no han terminado, o terminaron (unido o cerrado) hace menos de 7 días. */
function microAbiertos_(email, ahora) {
  ahora = ahora || Date.now(); email = String(email || '').toLowerCase();
  return microFilas_().filter(function (m) {
    if (email && String(m.quien).toLowerCase() !== email) return false;
    var fin = m.estado === MICRO_ESTADOS_.unido || m.estado === MICRO_ESTADOS_.cerrado;
    return !fin || ahora - m.actualizado < MICRO_ABIERTO_DIAS_ * 86400000;
  }).sort(function (a, b) { return b.actualizado - a.actualizado; });
}

/* ── Elegir el microproyecto de un pedido nuevo ─────────────────────────────────────────────────────────────────
   sugerido: lo que dijo Alma en su turno ([[micro: mp…]], [[micro: nuevo · Nombre]], [[micro: duda mp…]]) o la
   herramienta mejora_para_claude. Devuelve { id, nombre, seguro } (sumar a uno), o { nuevo: true, nombre? }. */
function microElegir_(adm, texto, sugerido) {
  var abiertos = microAbiertos_(adm && adm.email);
  var s = String(sugerido || '').trim();
  if (s) {
    var duda = /^duda\b/i.test(s), cuerpo = s.replace(/^duda\s*[:·\-]?\s*/i, '').trim();
    if (/^nuevo\b/i.test(cuerpo)) return { nuevo: true, nombre: cuerpo.replace(/^nuevo\s*[:·\-]?\s*/i, '').trim().slice(0, 40) };
    var id = (/\bmp[a-z0-9]{6,}\b/i.exec(cuerpo) || [])[0], nc = chatNorm_(cuerpo.replace(/\bmp[a-z0-9]{6,}\b/i, '').replace(/[·:\-]/g, ' '));
    var m = abiertos.filter(function (x) { return (id && x.id === id) || (nc && chatNorm_(x.nombre) === nc); })[0];
    if (m) return { id: m.id, nombre: m.nombre, seguro: !duda };
  }
  if (!abiertos.length) return { nuevo: true };
  var pal = microPalabras_(texto), puntos = abiertos.map(function (m) {
    var nom = microPalabras_(m.nombre), aj = microPalabras_(m.ajustes.filter(function (a) { return a.de === 'juan'; }).slice(-6).map(function (a) { return a.texto; }).join(' '));
    var p = 0, k = 0; Object.keys(pal).forEach(function (w) { if (nom[w]) { p += 3; k++; } else if (aj[w]) { p += 1; k++; } });
    return { m: m, p: p, k: k };
  }).sort(function (a, b) { return b.p - a.p; });
  /* Una sola palabra en común («botón») no basta: hacen falta 2 o más. Seguro: varias y muy por delante del segundo. */
  var mejor = puntos[0], segundo = puntos[1] || { p: 0 };
  if (mejor.k >= 2 && mejor.p >= 5 && mejor.p >= 2 * segundo.p) return { id: mejor.m.id, nombre: mejor.m.nombre, seguro: true };
  if (mejor.k >= 2) return { id: mejor.m.id, nombre: mejor.m.nombre, seguro: false };
  /* Un seguimiento corto («sí», «agrégale que…», «y que también…») sin palabras en común: el más reciente de las
     últimas 6 h. Si Claude le está preguntando algo en ese, es su respuesta; si no, se pregunta. */
  var n = chatNorm_(texto), corto = n.split(' ').filter(Boolean).length <= 8, sigue = /^(si|no|y |tambien|ademas|agregale|anadele|sumale|quitale|cambiale|ponle|une|unelo|dale|ok|va)\b/.test(n);
  var reciente = abiertos.filter(function (m) { return Date.now() - m.actualizado < 6 * 3600000 && m.estado !== MICRO_ESTADOS_.cerrado; })[0];
  if (reciente && (corto || sigue)) {
    var preguntan = abiertos.filter(function (m) { return m.estado === MICRO_ESTADOS_.pregunta; });
    return { id: reciente.id, nombre: reciente.nombre, seguro: corto && reciente.estado === MICRO_ESTADOS_.pregunta && preguntan.length === 1 };
  }
  return { nuevo: true };
}
/* Las palabras que cuentan para comparar (sin acentos, sin las vacías, cortadas a 5 letras: «botones» = «botón»). */
function microPalabras_(t) {
  var o = {};
  chatNorm_(t).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').forEach(function (w) {
    if (w.length < 4 || MICRO_VACIAS_.indexOf(w) >= 0) return; o[w.slice(0, 5)] = 1;
  });
  return o;
}
/* Para el prompt de la secretaria (agente.js, mismo turno, sin otra llamada a la IA): los abiertos y la etiqueta. */
function microBloque_(adm) {
  if (!adm || !esAdminPrincipal_(adm)) return '';
  var L = []; try { L = microAbiertos_(adm.email).slice(0, 8); } catch (e) { return ''; }
  if (!L.length) return '';
  return '\n\nMICROPROYECTOS ABIERTOS PARA CLAUDE (id · nombre · estado · nivel · lo último):\n' + L.map(function (m) {
    var u = m.ajustes[m.ajustes.length - 1]; return '· ' + m.id + ' · ' + m.nombre + ' · ' + m.estado + ' · ' + m.nivel + (u ? ' · ' + String(u.texto).replace(/\s+/g, ' ').slice(0, 110) : '');
  }).join('\n') +
    '\nSOLO cuando el turno sea Propósito · Desarrollo, agrega antes de la etiqueta de esfera otra línea: [[micro: <id>]] si es un ajuste o seguimiento de uno de esos ' +
    '(«agrégale…», «sí», «también que…», responde a lo que Claude preguntó), [[micro: nuevo · <nombre corto de 2 a 4 palabras>]] si es otra cosa, o [[micro: duda <id>]] si no estás segura. ' +
    'Nadie la ve: el sistema la quita. No digas tú a qué microproyecto va: lo dice el sistema.';
}
/* Quita [[micro: …]] del texto de Alma. Devuelve { texto, micro } (micro = lo que venía adentro o ''). */
function microSacarEtiqueta_(texto) {
  var micro = '';
  var limpio = String(texto || '').replace(/\[\[\s*micro\s*:?\s*([^\]]*?)\s*\]\]/gi, function (_, adentro) { micro = String(adentro).trim(); return ''; })
    .replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, micro: micro };
}

/* ── Lo que recibe Claude: el historial completo, la rama y el PR ── */
function microHistorialTexto_(m) {
  var f = function (ts) { try { return Utilities.formatDate(new Date(Number(ts)), CFG.TZ, 'd MMM HH:mm'); } catch (e) { return ''; } };
  return m.ajustes.map(function (a, i) { return (i + 1) + '. ' + f(a.ts) + ' · ' + (a.de === 'claude' ? 'Claude' : 'Juan') + ': ' + String(a.texto).trim(); }).join('\n\n');
}
/* Cómo sigue Claude con este microproyecto: la frase que va al principio de la instrucción. */
function microComoSeguir_(m, segunda, prAnterior) {
  if (segunda) return 'Esta es la «segunda parte» del microproyecto: el PR anterior (' + prAnterior + ') ya se unió. Abre una rama nueva desde main y un PR nuevo; enlaza el PR anterior en la descripción.';
  if (m.pr && m.rama) return 'Continúa en la rama ' + m.rama + ' y en el mismo PR (' + m.pr + '). No abras otro PR ni otro issue.';
  if (m.pr) return 'Continúa en el mismo PR (' + m.pr + ') y en su rama. No abras otro PR ni otro issue.';
  if (m.rama) return 'Continúa en la rama ' + m.rama + ' (todavía sin PR). No abras otro issue.';
  if (m.ajustes.length > 1) return 'Claude ya empezó este microproyecto pero todavía no dejó rama ni PR: búscalos por el issue antes de empezar otra rama. No abras otro issue.';
  return 'Es un microproyecto nuevo: trabájalo en una rama nueva con su PR.';
}
var MICRO_RESPONDER_ = 'Al responder a Alma (respuesta_url) manda también «rama» (el nombre de tu rama) y el enlace del PR en «enlaces»: ' +
  'así el siguiente ajuste sigue en el mismo PR. Si preguntas algo, pon las opciones como viñetas «• » debajo de la pregunta (2 a 5, cortas): Juan las toca como botones.';
function microParaClaude_(m, o) {
  return { id: m.id, nombre: m.nombre, parte: m.parte, ajuste: !!o.ajuste, segunda_parte: !!o.segunda, issue: m.issue, pr: m.pr, rama: m.rama,
    sesion_anterior: o.sesionAnterior || '', como_seguir: o.como, como_responder: MICRO_RESPONDER_,
    historial: m.ajustes.slice(-30).map(function (a) { return { ts: new Date(Number(a.ts)).toISOString(), de: a.de, texto: String(a.texto).slice(0, 1500) }; }) };
}
/* Comentario en el issue del microproyecto (no otro issue). true si quedó. */
function microComentar_(issueUrl, cuerpo) {
  var mi = /github\.com\/([^\/]+\/[^\/]+)\/issues\/(\d+)/.exec(String(issueUrl || '')); if (!mi) return false;
  var pg = PropertiesService.getScriptProperties(), tok = pg.getProperty('GITHUB_TOKEN') || pg.getProperty('GITHUB_PRS'); if (!tok) return false;
  try {
    var r = uf_('https://api.github.com/repos/' + mi[1] + '/issues/' + mi[2] + '/comments', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, payload: JSON.stringify({ body: String(cuerpo).slice(0, 60000) }) });
    if (r.getResponseCode() < 300) return true;
    console.error('GitHub comentario ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  } catch (e) { console.error('microComentar_: ' + e); }
  return false;
}
/* Antes de sumar un ajuste: ¿el PR ya se unió (o se cerró)? Entonces es «segunda parte». Una consulta, en caché. */
function microPrTermino_(m) {
  if (m.estado === MICRO_ESTADOS_.unido) return true;
  if (!m.pr) return false;
  var i = null; try { i = paraClaudePrInfo_(m.pr); } catch (e) {}
  return !!(i && (i.estado === 'unido' || i.estado === 'cerrado'));
}

/* ── Claude respondió (paraClaudeRespuesta_): su respuesta entra al historial y cambia el estado ── */
function microRespuesta_(id, b, texto) {
  var m = microLeer_(id); if (!m) return null;
  var estado = String(b.estado || 'listo'), enlaces = (b.enlaces || []).map(String);
  var pr = enlaces.filter(function (u) { return /\/pull\/\d+/.test(u); })[0];
  if (pr) m.pr = pr;
  if (/^[\w.\/-]{1,120}$/.test(String(b.rama || ''))) m.rama = String(b.rama);
  if (b.sesion) m.sesion = String(b.sesion).slice(0, 300);
  m.ajustes.push({ ts: Date.now(), de: 'claude', texto: String(texto || '').slice(0, 1500) });
  if (estado === 'pregunta' || estado === 'fallo') {
    var cuerpo = String(b.detalle || '').trim(), op = chatOpciones_(cuerpo) || chatOpciones_(String(b.voz || '') + '\n' + cuerpo);
    m.estado = MICRO_ESTADOS_.pregunta;
    m.ultima_pregunta = (estado === 'fallo' ? 'Claudio no pudo: ' : '') + (op && op.pregunta ? op.pregunta : String(b.voz || cuerpo).trim()).slice(0, 600);
    m.opciones = op && estado === 'pregunta' ? op.opciones.slice(0, 5) : [];
  } else {
    m.ultima_pregunta = ''; m.opciones = [];
    m.estado = m.pr && !microPrTermino_(m) ? MICRO_ESTADOS_.listo : m.pr ? MICRO_ESTADOS_.unido : MICRO_ESTADOS_.cerrado;
  }
  microGuardar_(m);
  return m;
}
/* Se unió un PR («Unir», unir_cambio o la revisión de fondo): su microproyecto queda «unido». */
function microUnido_(url) {
  var n = 0; url = String(url || '').replace(/\/+$/, ''); if (!url) return 0;
  microFilas_().forEach(function (m) {
    if (String(m.pr).replace(/\/+$/, '') !== url || m.estado === MICRO_ESTADOS_.unido) return;
    m.estado = MICRO_ESTADOS_.unido; m.unido = new Date().toISOString(); m.opciones = []; m.ultima_pregunta = '';
    microGuardar_(m); n++;
    try { paraClaudeAvisar_(m.nombre, '', 'unido', m.id); } catch (e) { console.error('aviso unido: ' + e); }   // nivel 3, corto
  });
  return n;
}
/* De fondo (procesarCola, solo si el cupo deja lo de fondo): cada 10 min mira en GitHub los PR de lo «listo para unir»
   (Juan también une desde GitHub). Una consulta por PR, en caché (paraClaudePrInfo_). */
function microRevisar_() {
  var c = CacheService.getScriptCache(); if (c.get('micro_revisar')) return 0;
  c.put('micro_revisar', '1', 600);
  var n = 0;
  microFilas_().filter(function (m) { return m.estado === MICRO_ESTADOS_.listo && m.pr; }).slice(0, 10).forEach(function (m) {
    var i = null; try { i = paraClaudePrInfo_(m.pr); } catch (e) {}
    if (!i) return;
    if (i.estado === 'unido') n += microUnido_(m.pr);
    else if (i.estado === 'cerrado') { m.estado = MICRO_ESTADOS_.cerrado; microGuardar_(m); n++; }
  });
  return n;
}
function microCerrar_(id) { var m = microLeer_(id); if (!m) return { ok: false, error: 'no existe' }; m.estado = MICRO_ESTADOS_.cerrado; m.opciones = []; m.ultima_pregunta = ''; microGuardar_(m); return { ok: true }; }

/* Juan responde a lo que Claude preguntó (botón de opción o «Responder» en Pendientes, o la opción en su chat):
   es un ajuste del mismo microproyecto y sale directo a Claude con el historial (el toque ya es su «sí»). */
function microResponder_(adm, id, texto, o) {
  o = o || {};
  var m = microLeer_(id); if (!m) return { ok: false, error: 'Ya no encuentro ese microproyecto.' };
  texto = String(texto || '').trim(); if (!texto) return { ok: false, error: 'faltan datos' };
  if (microEsSubelo_(texto)) return microSubir_(adm, m, o);   // «Súbelo» en la tarjeta: lo mismo, pero con Opus
  var q = m.ultima_pregunta;
  var r = paraClaudeCrear_(adm, { micro: m.id, titulo: m.nombre, app: 'Otro', tipo: 'mejora', prioridad: 'normal', sinChat: !!o.sinChat, nivel: o.nivel || '',
    que_quiere: (q ? 'Juan responde a tu pregunta («' + q + '»): ' : '') + texto });
  if (!r.ok) return r;
  return { ok: true, a: 'claude', micro: m.id, respuesta: r.claude ? 'Listo, quedó tu respuesta en «' + m.nombre + '».' : r.nota };
}
/* «Súbelo»: Juan pide que el último pedido lo haga Claudio con Opus (la tarea sencilla dijo que era más complejo, o él
   lo quiere así). Nunca pasa solo. Entra como ajuste del mismo microproyecto (mismo issue, rama y PR; segunda parte si ya
   se unió), con el historial completo. m: el microproyecto (si no, el más reciente de Juan). */
var MICRO_SUBIR_TEXTO_ = 'Juan lo sube a complejo (Opus): lee el historial completo y resuelve lo que se pidió (la tarea sencilla no alcanzó o Juan lo quiere con Opus).';
/* '' (no es), 'solo' («súbelo» a secas) o 'explicito' («súbelo a Opus», «súbeselo a Claudio», «pásalo a Opus»). */
function microEsSubelo_(texto) {
  var n = chatNorm_(texto).replace(/[¡!¿?.,;:«»"()]/g, ' ').replace(/\s+/g, ' ').trim();
  var m = /^(?:si |ok |va |dale |entonces )?(subelo|subeselo|subelo a claudio|subeselo a claudio|subelo a (?:opus|complejo)|subelo con opus|pasalo a opus|pasaselo a opus)(?: porfa| por favor)?$/.exec(n);
  return !m ? '' : /^sube(lo|selo)$/.test(m[1]) ? 'solo' : 'explicito';
}
function microSubir_(adm, m, o) {
  o = o || {};
  if (!m) m = microAbiertos_(adm && adm.email)[0] || null;   // el más reciente (aunque ya haya respondido: una consulta queda «cerrado»)
  if (!m) return { ok: false, error: 'No encuentro ningún pedido reciente para Claudio que pueda subir.' };
  var r = paraClaudeCrear_(adm, { micro: m.id, titulo: m.nombre, app: 'Otro', tipo: 'mejora', prioridad: 'normal', sinChat: !!o.sinChat, nivel: 'complejo', que_quiere: MICRO_SUBIR_TEXTO_ });
  if (!r.ok) return r;
  return { ok: true, a: 'claude', micro: m.id, nombre: m.nombre, claude: !!r.claude,
    respuesta: r.claude ? 'Listo, «' + m.nombre + '» quedó con Opus.' : r.nota };
}
/* En el chat, tocar una opción de la pregunta de Claude (su mensaje trae «• » opciones): va directo a ese microproyecto.
   Solo si el texto es exactamente una de las opciones del que está preguntando (el más reciente). */
function microOpcionChat_(adm, texto) {
  if (!adm || !esAdminPrincipal_(adm)) return null;
  var n = chatNorm_(texto); if (!n || n.length > 90) return null;
  var m = microAbiertos_(adm.email).filter(function (x) { return x.estado === MICRO_ESTADOS_.pregunta && (x.opciones || []).some(function (op) { return chatNorm_(op) === n; }); })[0];
  return m || null;
}

/* ── Pendientes: una tarjeta por microproyecto (pendientes.js → paraClaudePendientes_) ── */
function microTarjetas_(adm) {
  var out = [], ahora = Date.now();
  microAbiertos_(adm && adm.email, ahora).forEach(function (m) {
    if (m.estado === MICRO_ESTADOS_.cerrado) return;
    var info = null;
    if (m.pr && (m.estado === MICRO_ESTADOS_.listo || m.estado === MICRO_ESTADOS_.unido)) { try { info = paraClaudePrInfo_(m.pr); } catch (e) {} }
    if (info && info.estado === 'unido' && m.estado !== MICRO_ESTADOS_.unido) { microUnido_(m.pr); m.estado = MICRO_ESTADOS_.unido; m.unido = info.unido || new Date().toISOString(); }
    if (info && info.estado === 'cerrado' && m.estado === MICRO_ESTADOS_.listo) { m.estado = MICRO_ESTADOS_.cerrado; microGuardar_(m); return; }
    var ajustes = m.ajustes.slice(-12).map(function (a) { return { ts: a.ts, de: a.de, texto: String(a.texto).slice(0, 400) }; });
    var base = { id: 'mp:' + m.id, micro: m.id, titulo: m.nombre, nivel: m.nivel, modelo: CLAUDE_MODELO_NIVEL_[m.nivel], fecha: m.parte > 1 ? 'Parte ' + m.parte : '', ajustes: ajustes, pasos: [], pregunta: '', instrucciones: '', hecho: true,
      original: (m.ajustes.filter(function (a) { return a.de === 'claude'; }).pop() || {}).texto || '', enlaces: [], ts: m.actualizado };
    if (m.estado === MICRO_ESTADOS_.unido) {
      /* Unido: sigue la publicación un rato y la tarjeta se cierra sola (sin pregunta abierta). */
      var t0 = new Date(m.unido || (info && info.unido) || m.actualizado).getTime() || m.actualizado;
      if (ahora - t0 > 3 * 3600000) return;
      var ck = info && info.sha ? paraClaudeChecks_(info.repo, info.sha) : null;
      var est = ck && ck.fallas ? 'fallo_pub' : (!ck || ck.corriendo || (!ck.total && ahora - t0 < 180000)) ? 'publicando' : 'publicado';
      if (est === 'publicado' && ahora - t0 > 30 * 60000) return;
      out.push(Object.assign(base, { estado: est, progreso: ck && ck.total ? ck.ok / ck.total : 0, resumen: est === 'publicando' ? 'Ya lo uniste. GitHub lo está revisando y publicando.' : est === 'publicado' ? '¡Listo! Ya está publicado.' : 'Se unió, pero algo falló al publicarlo.',
        pasos: est === 'publicado' ? ['Pruébalo.'] : est === 'fallo_pub' ? ['Escríbele a Alma en tu chat: «falló la publicación de ' + m.nombre + '».'] : [], enlaces: est === 'fallo_pub' ? [m.pr] : [] }));
      return;
    }
    if (m.estado === MICRO_ESTADOS_.pregunta) {
      out.push(Object.assign(base, { estado: 'pregunta', resumen: m.ultima_pregunta || 'Claudio te pregunta algo.', responder: true,
        tarjeta: (m.opciones || []).length >= 2 ? { tipo: 'pregunta', esfera: 'Propósito', subcategoria: 'Desarrollo', opciones: m.opciones } : null,
        pregunta: (m.opciones || []).length >= 2 ? '' : m.ultima_pregunta, enlaces: m.pr ? [m.pr] : [] }));
      return;
    }
    if (m.estado === MICRO_ESTADOS_.listo) {
      out.push(Object.assign(base, { estado: 'listo', resumen: 'Claudio lo dejó listo. Revísalo y únelo.', pasos: ['Toca «Unir». O dile a Alma: «une ' + m.nombre + '».'], enlaces: m.pr ? [m.pr] : [] }));
      return;
    }
    var n = m.ajustes.filter(function (a) { return a.de === 'juan'; }).length;
    out.push(Object.assign(base, { estado: 'trabajando', resumen: 'Claudio está trabajando en esto' + (n > 1 ? ' (' + n + ' pedidos juntos)' : '') + '.', enlaces: m.pr ? [m.pr] : [] }));
  });
  return out;
}
