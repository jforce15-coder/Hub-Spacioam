/* ═══ 15d · ACCIONES DE CLAUDIO Y SU HILO (Juan, 17-nov-2026) ════════════════════════════════════════════════════════
   «Al momento de hablar con Claudio, me gustaría que fuese similar a como hablo contigo: tú me das tu input o tu
   respuesta, pero también a veces me pides ciertas acciones: haz esto, métete a este lugar, visita esta página web, aquí
   tienes que poner tu código… Que Claudio me fuera dando propuestas, respuestas, estuviéramos discutiendo.»

   Tres piezas:
   1. ACCIÓN (glosario): algo concreto que Juan tiene que hacer él, como tarjeta con su botón. Siete tipos:
        abrir_enlace · copiar_texto · pegar_en · elegir_opcion · aprobar (unir) · ver_captura · ir_a_pantalla.
      Cada una con título corto, detalle y estado (pendiente · hecho). La dejan:
        · Claudio en la llamada (ElevenLabs o Claudio local) y en el chat de texto, con la herramienta claudio_acciones;
          por voz solo dice «Te dejé dos acciones en pantalla»;
        · Claudio trabajando un pedido (la sesión de Claude Code), en «acciones» de su respuesta (paraClaudeRespuesta_).
   2. HECHO: al tocarlo, la acción queda hecha y Claudio se entera. Si la dejó un pedido que espera («espera»), sale como
      ajuste del mismo microproyecto (microResponder_, el camino de Pendientes) y Claudio sigue; si Juan está en la llamada,
      la página se lo cuenta a la voz (respuesta «aviso»). «aprobar» une de verdad: el toque de Juan es su «une».
   3. HILO DE CLAUDIO (alma/claudio.html): como esta conversación con Claude Code. Las burbujas son el chat de Juan en
      Propósito · Desarrollo (lo que dijo, lo que respondió Claudio y las respuestas de sus pedidos), las acciones como
      tarjetas y el estado de cada trabajo (escribiendo, revisando, listo para unir, falló, te pregunta) como tarjeta en el
      mismo hilo, en orden de tiempo. Abajo se le escribe a Claudio (claudioEscribir): el mismo Claudio de la voz (prompt,
      ficha y herramientas de claudio.js), con reglas de texto en vez de voz.

   Seguridad:
   · Solo el administrador principal, con su sesión (cada acción) o con la firma de la conversación de Claudio.
   · Nunca una llave ni una contraseña en el chat: una acción que pide una se convierte en «Guárdala en Ajustes → Llaves»
     (o GitHub → secretos); un texto con algo que parece una llave no se guarda (ni en una acción ni en lo que Juan
     escribe). Los enlaces, solo https. Las pantallas, solo las de la lista.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var CLAUDIO_ACC_CAB_ = ['id', 'email', 'creado', 'tipo', 'titulo', 'detalle', 'datos', 'estado', 'hecho', 'eleccion', 'micro', 'conv', 'origen'];
var CLAUDIO_ACC_TIPOS_ = ['abrir_enlace', 'copiar_texto', 'pegar_en', 'elegir_opcion', 'aprobar', 'ver_captura', 'ir_a_pantalla'];
var CLAUDIO_ACC_MAX_ = 5;                  // por respuesta o por turno: más que eso no es una lista de pasos, es un pedido
var CLAUDIO_ACC_DIAS_ = 3;                 // lo hecho se queda en el hilo 3 días; lo pendiente, hasta que se haga
/* Las pantallas a las que una acción puede llevar (alma/…). Nada fuera de esta lista. */
var CLAUDIO_ACC_PANTALLAS_ = {
  inicio: { t: 'Inicio', u: 'inicio.html' },
  ajustes: { t: 'Ajustes', u: 'inicio.html#ajustes' },
  llaves: { t: 'Ajustes → Llaves', u: 'inicio.html#ajustes-llaves' },
  biblioteca: { t: 'Biblioteca de Claudio', u: 'biblioteca.html' },
  conexiones: { t: 'Conexiones', u: 'conexiones.html' },
  agentes: { t: 'Agentes', u: 'agentes.html' },
  avisos: { t: 'Avisos', u: 'avisos.html' },
  uso: { t: 'Uso', u: 'uso.html' },
  google: { t: 'Google', u: 'google.html' }
};
/* Algo que parece una llave: prefijos conocidos o una tira larga sin espacios con letras y números mezclados. */
var CLAUDIO_ACC_LLAVE_RE_ = /\b(sk-[A-Za-z0-9_-]{12,}|sk_(live|test)_[A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z_-]{20,}|dsbot-[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})|(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])\b[A-Za-z0-9_-]{36,}\b/;
/* Pedir una llave o contraseña (para que Juan la ponga en el chat). */
var CLAUDIO_ACC_PIDE_LLAVE_RE_ = /\b(llave|api ?key|token|contrase(ñ|n)a|password|clave secreta|secreto|secret)\b/i;
var CLAUDIO_ACC_LLAVE_AVISO_ = 'Eso parece una llave. No la pongas en el chat: guárdala en Ajustes → Llaves (o en GitHub → secretos).';

function claudioAccHoja_() {
  var sh = hojaCrear_('ALMA_CLAUDIO_ACCIONES', CLAUDIO_ACC_CAB_);
  if (sh.getLastColumn() < CLAUDIO_ACC_CAB_.length) sh.getRange(1, 1, 1, CLAUDIO_ACC_CAB_.length).setValues([CLAUDIO_ACC_CAB_]);
  return sh;
}
function claudioAccTieneLlave_(t) { return CLAUDIO_ACC_LLAVE_RE_.test(String(t || '').replace(/https:\/\/\S+/g, ' ')); }
function claudioAccCorto_(t, max) { var x = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return x.length > max ? x.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : x; }
function claudioAccUrl_(u) { u = String(u || '').trim(); return /^https:\/\/[^\s"'<>]{3,500}$/.test(u) && !claudioAccTieneLlave_(u.replace(/^https:\/\/[^\/]+/, '')) ? u : ''; }
function claudioAccRepo_(r) { r = String(r || '').trim(); return /^[\w.-]{1,60}$/.test(r) ? r : 'Hub-Spacioam'; }
function claudioAccSecretos_(repo) {
  var d = ''; try { d = PropertiesService.getScriptProperties().getProperty('GITHUB_DUENO') || ''; } catch (e) {}
  return 'https://github.com/' + (d || UNIR_DUENO_) + '/' + claudioAccRepo_(repo) + '/settings/secrets/actions';
}
/* Opciones de elegir_opcion: una lista ([«A», «B»] o [{t, imagen}]) o un texto «A | B». 2 a 4, cortas. */
function claudioAccOpciones_(x) {
  var l = Array.isArray(x) ? x : String(x || '').split(/\s*\|\s*|\n+/);
  return l.map(function (o) {
    var t = o && typeof o === 'object' ? (o.t || o.texto || o.titulo) : o, img = o && typeof o === 'object' ? claudioAccUrl_(o.imagen || o.captura) : '';
    t = claudioAccCorto_(t, 60); if (!t || claudioAccTieneLlave_(t)) return null;
    return img ? { t: t, imagen: img } : { t: t };
  }).filter(Boolean).slice(0, 4);
}

/* ── Normalizar una acción (lo que mande Claudio): null si no sirve. Nunca deja pedir una llave en el chat. ── */
function claudioAccNormalizar_(a) {
  if (!a || typeof a !== 'object') return null;
  var tipo = String(a.tipo || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (tipo === 'unir') tipo = 'aprobar';
  if (CLAUDIO_ACC_TIPOS_.indexOf(tipo) < 0) return null;
  var titulo = claudioAccCorto_(a.titulo, 60), detalle = claudioAccCorto_(a.detalle, 240);
  if (!titulo || claudioAccTieneLlave_(titulo) || claudioAccTieneLlave_(detalle)) return null;
  var d = {}, enlace = claudioAccUrl_(a.enlace || a.url);
  var texto = String(a.texto || '').trim().slice(0, 2000);
  if (texto && claudioAccTieneLlave_(texto)) return null;   // una llave no viaja en una acción
  var destino = String(a.destino || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  /* Pedir una llave o contraseña: nunca para el chat. Va a Ajustes → Llaves (o a los secretos de GitHub). */
  var pideLlave = CLAUDIO_ACC_PIDE_LLAVE_RE_.test(titulo + ' ' + detalle) && (tipo === 'pegar_en' || tipo === 'copiar_texto' || destino === 'llaves' || destino === 'github_secretos');
  if (pideLlave || destino === 'llaves' || destino === 'github_secretos') {
    var gh = destino === 'github_secretos' || /github/i.test(titulo + ' ' + detalle + ' ' + destino);
    return { tipo: 'pegar_en', titulo: gh ? 'Guarda la llave en GitHub → secretos' : 'Guarda la llave en Ajustes → Llaves',
      detalle: (detalle && !/chat/i.test(detalle) ? detalle + ' ' : '') + 'Pégala ahí, nunca en el chat: así no queda escrita en ningún lado.',
      datos: gh ? { destino: 'github_secretos', enlace: claudioAccSecretos_(a.repo) } : { destino: 'llaves', pantalla: 'llaves' }, espera: a.espera !== false };
  }
  if (tipo === 'abrir_enlace') { if (!enlace) return null; d.enlace = enlace; }
  else if (tipo === 'copiar_texto') { if (!texto) return null; d.texto = texto; }
  else if (tipo === 'pegar_en') { if (!enlace && !texto) return null; if (enlace) d.enlace = enlace; if (texto) d.texto = texto; }
  else if (tipo === 'elegir_opcion') { d.opciones = claudioAccOpciones_(a.opciones); if (d.opciones.length < 2) return null; }
  else if (tipo === 'aprobar') { var c = claudioAccCorto_(a.cual || a.pr || '', 40); if (c) d.cual = c; }
  else if (tipo === 'ver_captura') { d.imagen = claudioAccUrl_(a.imagen || a.captura || enlace); if (!d.imagen) return null; }
  else if (tipo === 'ir_a_pantalla') { var p = String(a.pantalla || '').trim().toLowerCase(); if (!CLAUDIO_ACC_PANTALLAS_[p]) return null; d.pantalla = p; }
  return { tipo: tipo, titulo: titulo, detalle: detalle, datos: d, espera: tipo === 'elegir_opcion' || tipo === 'aprobar' || !!a.espera };
}

/* ── Guardar las acciones de un turno o de una respuesta de Claudio. o: { micro, conv, origen }. ── */
function claudioAccCrear_(adm, lista, o) {
  o = o || {};
  if (!adm || !adm.email || !esAdminPrincipal_(adm)) return { ok: false, error: 'Las acciones de Claudio son solo para el administrador principal.', creadas: [] };
  var ls = (Array.isArray(lista) ? lista : [lista]).map(claudioAccNormalizar_).filter(Boolean).slice(0, CLAUDIO_ACC_MAX_);
  if (!ls.length) return { ok: false, error: 'Ninguna acción sirve (falta el título, el enlace https, las opciones o pedía una llave en el chat).', creadas: [] };
  var micro = String(o.micro || '').replace(/^mp:/, '').slice(0, 60), conv = String(o.conv || '').trim();
  if (!/^conv_[\w-]{4,80}$/.test(conv)) conv = '';
  var sh = claudioAccHoja_(), lock = LockService.getScriptLock(); lock.waitLock(20000);
  var creadas = [];
  try {
    var ya = claudioAccFilas_(sh).filter(function (x) { return x.email === adm.email && x.estado === 'pendiente'; });
    var ahora = Date.now();
    ls.forEach(function (a, i) {
      /* La misma acción pendiente (mismo tipo y título, del mismo trabajo) no se repite. */
      var igual = ya.filter(function (x) { return x.tipo === a.tipo && x.titulo === a.titulo && x.micro === micro; })[0];
      if (igual) { creadas.push(igual.id); return; }
      if (a.espera) a.datos.espera = true;
      var id = 'ca' + (ahora + i).toString(36) + Math.floor(Math.random() * 1296).toString(36);
      sh.appendRow([id, adm.email, ahora + i, a.tipo, a.titulo, a.detalle, JSON.stringify(a.datos), 'pendiente', '', '', micro, conv, String(o.origen || '').slice(0, 30)]);
      creadas.push(id);
    });
  } finally { lock.releaseLock(); }
  return { ok: true, creadas: creadas, pendientes: claudioAccPendientes_(adm.email).length };
}
function claudioAccDe_(r, fila) {
  var o = { fila: fila }; CLAUDIO_ACC_CAB_.forEach(function (k, j) { o[k] = r[j]; });
  ['id', 'email', 'tipo', 'titulo', 'detalle', 'estado', 'eleccion', 'micro', 'conv', 'origen'].forEach(function (k) { o[k] = String(o[k] == null ? '' : o[k]); });
  o.email = o.email.toLowerCase(); o.creado = Number(o.creado) || 0; o.hecho = Number(o.hecho) || 0;
  try { o.datos = JSON.parse(String(o.datos || '{}')) || {}; } catch (e) { o.datos = {}; }
  return o;
}
function claudioAccFilas_(sh) {
  sh = sh || claudioAccHoja_(); var n = sh.getLastRow(); if (n < 2) return [];
  var ini = Math.max(2, n - 299);
  return sh.getRange(ini, 1, n - ini + 1, CLAUDIO_ACC_CAB_.length).getValues().map(function (r, i) { return claudioAccDe_(r, ini + i); });
}
/* Lo que se ve de una acción (sin la fila ni el correo). */
function claudioAccVista_(x) {
  var d = x.datos || {}, o = { id: x.id, tipo: x.tipo, titulo: x.titulo, detalle: x.detalle, estado: x.estado, ts: x.creado, espera: !!d.espera };
  if (d.enlace) o.enlace = d.enlace;
  if (d.texto) o.texto = d.texto;
  if (d.opciones) o.opciones = d.opciones;
  if (d.imagen) o.imagen = d.imagen;
  if (d.cual) o.cual = d.cual;
  if (d.destino) o.destino = d.destino;
  if (d.pantalla && CLAUDIO_ACC_PANTALLAS_[d.pantalla]) o.pantalla = { clave: d.pantalla, t: CLAUDIO_ACC_PANTALLAS_[d.pantalla].t, u: CLAUDIO_ACC_PANTALLAS_[d.pantalla].u };
  if (x.eleccion) o.eleccion = x.eleccion;
  if (x.hecho) o.hecho = x.hecho;
  if (x.micro) o.trabajo = 'mp:' + x.micro;
  return o;
}
function claudioAccPendientes_(email) {
  email = String(email || '').toLowerCase();
  return claudioAccFilas_().filter(function (x) { return x.email === email && x.estado === 'pendiente'; });
}
/* Las del hilo: las pendientes y lo hecho en los últimos días. */
function claudioAccHilo_(email) {
  email = String(email || '').toLowerCase(); var desde = Date.now() - CLAUDIO_ACC_DIAS_ * 86400000;
  return claudioAccFilas_().filter(function (x) { return x.email === email && (x.estado === 'pendiente' || x.hecho >= desde || x.creado >= desde); });
}

/* ── Acción claudioAccion { id, eleccion?, quitar? } (solo el principal): Hecho, elegir, unir o quitarla ── */
function claudioAccionApi_(ses, b) {
  b = b || {};
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };   // no 'session': ese error cierra la sesión del navegador
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Las acciones de Claudio son solo para el administrador principal.' };
  return claudioAccHecho_(adm, String(b.id || ''), String(b.eleccion || ''), !!b.quitar);
}
function claudioAccHecho_(adm, id, eleccion, quitar) {
  var sh = claudioAccHoja_(), x = claudioAccFilas_(sh).filter(function (r) { return r.id === id; })[0];
  if (!x || x.email !== String(adm.email || '').toLowerCase()) return { ok: false, error: 'Ya no encuentro esa acción.' };
  if (x.estado !== 'pendiente') return { ok: true, ya: true, accion: claudioAccVista_(x) };
  var d = x.datos || {}, out = { ok: true };
  if (quitar) { sh.getRange(x.fila, 8, 1, 2).setValues([['quitada', Date.now()]]); return { ok: true, quitada: true }; }
  if (x.tipo === 'elegir_opcion') {
    var op = (d.opciones || []).filter(function (o) { return o.t === eleccion; })[0];
    if (!op) return { ok: false, error: 'Elige una de las opciones.' };
  } else eleccion = '';
  if (x.tipo === 'aprobar') {
    /* El toque de Juan es su «une»: las mismas revisiones de siempre (unirCambio_). Sin cual, el PR de su trabajo. */
    var cual = d.cual || '';
    if (!cual && x.micro) { var m0 = null; try { m0 = microLeer_(x.micro); } catch (e) {} var n = m0 && /\/pull\/(\d+)/.exec(m0.pr || ''); if (n) cual = '#' + n[1]; }
    if (!cual) return { ok: false, error: 'No sé cuál cambio unir. Pídeselo a Claudio por su nombre.' };
    var u = unirCambio_(cual);
    if (!u || !u.ok || !(u.unidos || []).length) return { ok: false, error: (u && (u.error || u.nota)) || 'No se pudo unir.' };
    out.unidos = u.unidos.length;
  }
  sh.getRange(x.fila, 8, 1, 3).setValues([['hecho', Date.now(), eleccion]]);
  x.estado = 'hecho'; x.hecho = Date.now(); x.eleccion = eleccion;
  /* Claudio se entera: en la llamada (la página se lo dice a la voz con «aviso») y, si un pedido espera esto, sigue. */
  out.aviso = 'Juan ya hizo en pantalla la acción «' + x.titulo + '»' + (eleccion ? ' y eligió «' + eleccion + '»' : '') + (out.unidos ? ' (quedó unido)' : '') + '. No se la vuelvas a pedir; sigue con lo que viene.';
  if (x.micro && d.espera && x.tipo !== 'aprobar') {
    var m = null; try { m = microLeer_(x.micro); } catch (e) {}
    if (m && m.estado !== MICRO_ESTADOS_.cerrado && m.estado !== MICRO_ESTADOS_.unido) {
      var txt = eleccion ? 'Juan eligió «' + eleccion + '» en la acción «' + x.titulo + '».' : 'Juan ya hizo lo que le pediste: «' + x.titulo + '». Sigue con el trabajo.';
      try { var r = microResponder_(adm, x.micro, txt, { sinChat: false }); out.siguio = !!(r && r.ok); if (r && !r.ok) out.nota = r.error; } catch (e) { console.error('claudioAccHecho_ micro: ' + e); out.siguio = false; }
    }
  }
  out.accion = claudioAccVista_(x);
  return out;
}

/* ── La herramienta claudio_acciones (voz y chat): una acción por llamada; devuelve cuántas hay en pantalla ── */
function claudioAccionesHerr_(adm, b) {
  var a = { tipo: b.tipo, titulo: b.titulo, detalle: b.detalle, enlace: b.enlace, texto: b.texto, opciones: b.opciones, pantalla: b.pantalla, destino: b.destino, repo: b.repo, cual: b.cual, imagen: b.imagen };
  var micro = '';
  if (String(b.trabajo || '').trim()) { try { var m = claudioMicroBuscar_(claudioMicros_(adm), b.trabajo); if (m) micro = m.id; } catch (e) {} }
  var r = claudioAccCrear_(adm, [a], { micro: micro, conv: b.conv_id, origen: 'llamada' });
  if (!r.ok) return { ok: false, error: 'NO SE DEJÓ: ' + r.error };
  var n = r.pendientes, letras = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco'];
  return { ok: true, en_pantalla: n, resultado: 'HECHO. Si ya no vas a dejar otra, di solo «Te dejé ' + (letras[n] || n) + ' ' + (n === 1 ? 'acción' : 'acciones') + ' en pantalla.» Nunca leas el enlace ni el texto en voz alta.' };
}

/* ── El hilo: chat de Desarrollo + acciones + estado de cada trabajo, en orden de tiempo ── */
function claudioHiloConv_(adm) { return 'conv_chat_' + claudioPanelHuella_(String(adm.email || '').toLowerCase()); }
/* Un mensaje del chat como burbuja: «Claudio: …» de la llamada sin su prefijo; los enlaces de GitHub, como «el cambio». */
function claudioHiloTexto_(t) {
  return String(t || '').replace(/^Claudio:\s*/, '').replace(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(pull|issues)\/(\d+)\S*/g, function (_, k, n) { return (k === 'pull' ? 'cambio #' : 'pedido #') + n; })
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1600);
}
function claudioHiloApi_(ses, b) {
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'El hilo de Claudio es solo para el administrador principal.' };
  return claudioHiloArmar_(adm);
}
function claudioHiloArmar_(adm) {
  var items = [], email = String(adm.email || '').toLowerCase();
  try {
    opFilas_(email, 900).filter(function (m) { return chatEsDesarrollo_(m); }).slice(-40).forEach(function (m) {
      var t = claudioHiloTexto_(m.texto); if (!t) return;
      items.push({ k: 'msg', id: m.id, de: m.de === 'alma' ? 'claudio' : 'juan', canal: m.canal, texto: t, ts: new Date(m.ts).getTime() || 0 });
    });
  } catch (e) { console.error('claudioHilo chat: ' + e); }
  try { claudioAccHilo_(email).forEach(function (x) { var v = claudioAccVista_(x); v.k = 'accion'; items.push(v); }); } catch (e) { console.error('claudioHilo acciones: ' + e); }
  var prs = null; try { prs = prsAbiertos_(false); } catch (e) { console.error('claudioHilo prs: ' + e); }
  try {
    claudioTrabajos_(adm, prs).slice(0, 8).forEach(function (t) {
      var o = { k: 'estado', id: t.id, nombre: t.nombre, etapa: t.etapa, paso: t.paso, pasos: t.pasos.map(function (p) { return p.e; }), indice: t.indice, total: t.total, ts: t.ts };
      if (t.une) o.une = true; if (t.sola) o.sola = true; if (t.cual) o.cual = t.cual; if (t.pregunta) o.pregunta = t.pregunta;
      items.push(o);
    });
  } catch (e) { console.error('claudioHilo trabajos: ' + e); }
  items.sort(function (a, b) { return a.ts - b.ts; });
  var pend = items.filter(function (x) { return x.k === 'accion' && x.estado === 'pendiente'; }).length;
  return { ok: true, items: items.slice(-70), pendientes: pend, conv: claudioHiloConv_(adm), github: prs ? 'ok' : 'sin respuesta' };
}

/* ── Acción claudioEscribir { texto }: un turno de Claudio por texto (el mismo Claudio de la voz) ── */
var CLAUDIO_CHAT_REGLAS_ = [
  'Esta vez Juan te escribe en el hilo de Claudio (texto, no voz): contestas por escrito, como en un chat con el equipo de desarrollo.',
  'Primero tu respuesta o tu propuesta, en dos a cinco frases claras. Si hay dos caminos, propón A y B en una línea cada uno y di cuál recomiendas; si Juan tiene que escoger, déjale una acción elegir_opcion.',
  'Cuando Juan tenga que hacer algo él (abrir una página, copiar o pegar algo, tocar Permitir, ir a una pantalla de la app, revisar una captura, unir), usa claudio_acciones, una por paso y en orden, y di en una frase que te dejó los pasos abajo. No escribas el enlace ni el texto en tu respuesta: van en la acción.',
  'Nunca le pidas una llave, un token o una contraseña en el chat: la acción lo lleva a Ajustes → Llaves (destino llaves) o a GitHub → secretos.',
  'Texto plano: sin títulos ni tablas; una lista corta solo si son pasos. Sin nombres de archivos ni términos técnicos salvo que Juan los use.',
  'Discute de verdad: si algo no conviene, dilo con su porqué y propón otra cosa. Los pedidos de código siguen saliendo con claudio_pedido.'
];
function claudioEscribirApi_(ses, b) {
  b = b || {};
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Claudio es solo para el administrador principal.' };
  var texto = String(b.texto || '').replace(/[ \t]+/g, ' ').trim().slice(0, 2000);
  if (!texto) return { ok: false, error: 'Escribe algo para Claudio.' };
  if (claudioAccTieneLlave_(texto)) return { ok: false, llave: true, error: CLAUDIO_ACC_LLAVE_AVISO_ };
  var conv = claudioHiloConv_(adm), c = CacheService.getScriptCache();
  c.put('claudio_' + conv, normTel_(adm.tels[0]), 21600);
  var historial = [];
  try {
    historial = opFilas_(String(adm.email).toLowerCase(), 600).filter(function (m) { return chatEsDesarrollo_(m) && m.canal === 'claudio'; }).slice(-12)
      .map(function (m) { return { de: m.de === 'alma' ? 'claudio' : 'juan', texto: String(m.texto || '').slice(0, 800) }; });
  } catch (e) { console.error('claudioEscribir historial: ' + e); }
  var ficha = c.get('claudiochat_' + conv);
  if (!ficha) { ficha = claudioFicha_(adm, String(adm.nombre || '').trim().split(/\s+/)[0] || 'Juan', ''); try { c.put('claudiochat_' + conv, ficha.slice(0, 90000), 1800); } catch (e) {} }
  literalLlamadaPoner_(conv, '', Date.now(), texto);   // un pedido de este turno lleva lo que escribió, tal cual (literal.js)
  var o = claudioPromptObj_(); delete o.claudio.por_voz; o.claudio.por_escrito = CLAUDIO_CHAT_REGLAS_.slice(); o.ficha_de_quien_llama = [ficha];
  var yo = null; try { yo = opGuardar_(adm, 'yo', 'claudio', texto, [], CHAT_DESARROLLO_); } catch (e) { console.error('claudioEscribir yo: ' + e); }
  var t = claudioLocalTurno_(adm, conv, JSON.stringify(o), claudioLocalMensajes_(historial, texto), { texto: true });
  var resp = t.ok ? t.hablar : 'No me llegó bien. ¿Me lo vuelves a escribir?';
  try { opGuardar_(adm, 'alma', 'claudio', resp, [], CHAT_DESARROLLO_); } catch (e) { console.error('claudioEscribir claudio: ' + e); }
  return { ok: true, respuesta: resp, herramientas: t.herramientas || [], yo: yo ? yo.id : '' };
}
