/* ═══ 22 · DE ALMA PARA CLAUDE: pedidos de mejora que el equipo le dicta a ALMA ═════════════════════════════════
   Juan (o un administrador) le dice a ALMA, por WhatsApp, en el Hub o en una llamada, cómo debería funcionar algo o
   qué está fallando. ALMA lo ordena (qué pasa, qué se quiere, un ejemplo) y lo deja:
     1. en la hoja ALMA_PARA_CLAUDE (siempre), y
     2. como issue en GitHub (jforce15-coder/Hub-Spacioam, etiqueta «alma-mejora») si existe GITHUB_TOKEN en las
        propiedades del script. Claude revisa esos issues, programa el cambio y abre un PR para que Juan lo una.
   El token es de GitHub (fine-grained, solo ese repositorio, permiso Issues: lectura y escritura).

   CONEXIÓN DIRECTA (Alma → Claude Code → Alma). Solo el administrador principal.
     3. Dispara la tarea de Claude Code «Alma → Claude · mejoras del sistema» (CLAUDE_RUTINA_ID) con el pedido ya ordenado,
        si existe CLAUDE_RUTINA_TOKEN en las propiedades del script (lo genera Juan en claude.ai/code/routines → la tarea →
        Editar → Agregar disparador → API → Generar token; nunca va en el chat ni en GitHub).
     4. Claude programa el cambio en una rama con su PR y responde al Hub (paraClaudeRespuesta_) con una llave de un solo uso
        que viaja dentro del pedido: el Hub guarda solo su huella SHA-256.
     5. La respuesta queda en el chat con Alma de quien lo pidió (chat único, #334: canal «claude», Propósito · Desarrollo),
        le llega por WhatsApp en una línea y Alma se la cuenta en voz corta en la próxima llamada (paraClaudeNovedades_).

   NIVEL DEL PEDIDO (sencillo · complejo), para cuidar el uso: hay DOS tareas de Claude Code, cada una con su llave.
     · complejo → la tarea de siempre con Opus (CLAUDE_RUTINA_TOKEN · CLAUDE_RUTINA_ID): cambios con lógica, funciones
       nuevas, errores, lo de varias partes o delicado, y las consultas o análisis complejos.
     · sencillo → la tarea con Sonnet (CLAUDE_RUTINA_TOKEN_SENCILLO · CLAUDE_RUTINA_ID_SENCILLO): preguntas simples,
       leer o revisar datos, análisis cortos, cambios chicos y claros (un texto, un color, una línea obvia). Si resulta
       difícil, responde «fallo» y le dice a Juan «dime "súbelo"».
   Alma lo clasifica (con duda, complejo) y se lo dice a Juan al preguntar; Juan lo cambia con «con Opus» / «con Sonnet»,
   y «súbelo» vuelve a mandar el último microproyecto como complejo, con su historial (chat.js). Nunca sube solo.
   Un ajuste hereda el nivel de su microproyecto salvo que Juan o Alma digan otro. Sin la llave de la sencilla, va a la
   compleja y se avisa (así nada se rompe antes de que Juan la pegue en hub.spacioam.com/claude.html). */

var PARA_CLAUDE_CAB_ = ['id', 'fecha', 'quien', 'app', 'tipo', 'prioridad', 'titulo', 'detalle', 'estado', 'issue', 'sesion', 'respuesta', 'llave', 'simple', 'chat', 'micro', 'nivel'];
var PARA_CLAUDE_REPO_ = 'jforce15-coder/Hub-Spacioam';
var CLAUDE_RUTINA_DEF_ = 'trig_01VrusYxvHrU1MBz4x39RVEm';
var CLAUDE_RUTINA_SENCILLO_DEF_ = 'trig_01Vdg8SQEvDKV2aywfmBtQ1X';
var CLAUDE_MODELO_NIVEL_ = { sencillo: 'Sonnet', complejo: 'Opus' };
/* La regla para clasificar (la usan la herramienta mejora_para_claude, la etiqueta [[nivel: …]] del chat y la voz). */
var CLAUDE_NIVEL_REGLA_ = 'sencillo (va con Sonnet): una pregunta simple, leer o revisar datos, un análisis corto, un cambio chico y claro (un texto, un color, una línea obvia). ' +
  'complejo (va con Opus): cambios con lógica, funciones nuevas, errores, lo que toca varias partes o es delicado, y las consultas o análisis complejos. Con duda, complejo.';
/* DERIVAR A CLAUDIO (pedido de Juan, microproyecto «Modo conferencia: no repetir pedido», parte 3): cuando Alma choca con
   un límite suyo (búsqueda en internet, procesar datos, un reporte, una consulta externa), arma de inmediato el borrador
   para Claudio en vez de alargarlo o decir que no se puede. Sigue siendo borrador: a Claudio le llega con el sí de Juan.
   La usan la voz (voz.js), el chat (chat.js) y la herramienta mejora_para_claude (agente.js). */
var CLAUDE_DERIVAR_REGLA_ = 'DERIVAR A CLAUDIO (solo con el administrador principal): Claudio es desarrollo y el cerebro de la operación. ' +
  'Si para cumplir lo que te pide chocas con un límite tuyo (una búsqueda en internet que no alcanza o no encuentra lo que pide, procesar muchos datos, ' +
  'generar un reporte o cualquier consulta externa que tus herramientas no resuelven), no lo alargues, no improvises ni digas que no se puede: ' +
  'de inmediato pásalo como pedido para Claudio, con lo que necesita y para qué (sale al instante; tú solo di el resultado). ' +
  'Lo que tus herramientas sí resuelven rápido (un dato de las hojas, una búsqueda corta) lo haces tú.';
/* Filas viejas (sin nivel) y cualquier cosa rara: complejo. */
function claudeNivel_(x) { return String(x || '').trim().toLowerCase() === 'sencillo' ? 'sencillo' : 'complejo'; }
function claudeNivelTexto_(n) { n = claudeNivel_(n); return n + ' (' + CLAUDE_MODELO_NIVEL_[n] + ')'; }
/* Lo que Juan pide al hablar: «con Opus» / «con Sonnet» (o «como complejo» / «como sencillo»). Devuelve el nivel o ''. */
var CLAUDE_NIVEL_FRASE_ = /\b(?:con|en|a|por)\s+(opus|sonnet)\b|\bcomo\s+(complejo|sencillo)\b/i;
function claudeNivelPedido_(texto) {
  var m = CLAUDE_NIVEL_FRASE_.exec(chatNorm_(texto)); if (!m) return '';
  return (m[1] || m[2]) === 'opus' || m[2] === 'complejo' ? 'complejo' : 'sencillo';
}
function claudeNivelQuitar_(texto) { return String(texto || '').replace(new RegExp(CLAUDE_NIVEL_FRASE_.source, 'gi'), ' ').replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').trim(); }
/* La etiqueta [[nivel: sencillo|complejo]] que Alma pone en su respuesta (agente.js): sale del texto antes de que nadie la vea. */
function claudeNivelSacarEtiqueta_(texto) {
  var nivel = '';
  var limpio = String(texto || '').replace(/\[\[\s*nivel\s*:?\s*([^\]]*?)\s*\]\]/gi, function (_, adentro) { var a = chatNorm_(adentro); nivel = /sencill/.test(a) ? 'sencillo' : /complej/.test(a) ? 'complejo' : nivel; return ''; })
    .replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, nivel: nivel };
}
var HUB_EXEC_DEF_ = 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec';
/* El antiguo chat aparte «Desarrollo» (usuario «desarrollo» en ALMA_OPERATIVO). Desde el chat único (#334) ya no se
   escribe aquí: chatMigrarDesarrollo_ (chat.js) pasa sus filas al chat del principal. Queda para reconocer lo viejo. */
var DESARROLLO_ = { email: 'desarrollo', nombre: 'Desarrollo · mejoras del sistema', tels: [], principal: false };

function paraClaudeHoja_() {
  var sh = hojaCrear_('ALMA_PARA_CLAUDE', PARA_CLAUDE_CAB_);
  if (sh.getLastColumn() < PARA_CLAUDE_CAB_.length) sh.getRange(1, 1, 1, PARA_CLAUDE_CAB_.length).setValues([PARA_CLAUDE_CAB_]);
  return sh;
}
function paraClaudeHuella_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function esAdminPrincipal_(adm) { return !!adm && (adm.principal || !adminsOp_().some(function (a) { return a.principal; })); }

function paraClaudeCrear_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede pedir cambios al sistema. Dile que se lo pida a Juan.' };
  var titulo = String(inp.titulo || '').trim().slice(0, 100); if (!titulo || !String(inp.que_quiere || '').trim()) return { ok: false, error: 'Falta el título o qué se quiere.' };
  var quien = (adm && adm.nombre) || 'Equipo', id = 'pc' + Date.now(), fecha = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
  /* Microproyecto (#374): un ajuste se suma al suyo (mismo issue como comentario, misma rama y PR, historial completo);
     si su PR ya se unió, es la «segunda parte» (PR nuevo, mismo historial). Un pedido nuevo abre uno. */
  var m = null; try { m = inp.micro ? microLeer_(inp.micro) : null; } catch (e) { console.error('microLeer_: ' + e); }
  var ajuste = !!m, segunda = false, prAnterior = '', sesionAnterior = m ? m.sesion : '';
  if (m && microPrTermino_(m)) { segunda = true; prAnterior = m.pr; m.parte = (Number(m.parte) || 1) + 1; m.pr = ''; m.rama = ''; m.unido = ''; }
  if (!m) m = microCrear_(adm, inp.nombre || titulo);
  var queQuiere = String(inp.que_quiere).trim();
  /* Nivel: lo que dijeron Juan o Alma (inp.nivel); si no, un ajuste hereda el de su microproyecto; si no, complejo. */
  var nivel = inp.nivel ? claudeNivel_(inp.nivel) : ajuste ? claudeNivel_(m.nivel) : 'complejo';
  m.ajustes.push({ ts: Date.now(), de: 'juan', texto: (ajuste ? '' : titulo + ': ') + queQuiere });
  var como = microComoSeguir_(m, segunda, prAnterior);
  var cuerpo = (ajuste ? '**' + (segunda ? 'Segunda parte' : 'Ajuste') + ' de ' + quien + ' a través de ALMA** · ' + fecha + ' (hora de Guatemala)\n\n' + '### Lo nuevo\n' + queQuiere + '\n\n'
    : '**Pedido de ' + quien + ' a través de ALMA** · ' + fecha + ' (hora de Guatemala)\n\n' +
    '**Dónde:** ' + (inp.app || 'Otro') + ' · **Tipo:** ' + String(inp.tipo || 'mejora').replace('_', ' ') + ' · **Prioridad:** ' + (inp.prioridad || 'normal') + '\n\n' +
    (String(inp.que_pasa || '').trim() ? '### Qué pasa hoy\n' + String(inp.que_pasa).trim() + '\n\n' : '') +
    '### Cómo debería funcionar\n' + queQuiere + '\n\n' +
    (String(inp.ejemplo || '').trim() ? '### Ejemplo\n' + String(inp.ejemplo).trim() + '\n\n' : '')) +
    '**Microproyecto:** «' + m.nombre + '» (' + m.id + (m.parte > 1 ? ' · parte ' + m.parte : '') + '). ' + como + '\n\n' +
    '**Nivel:** ' + claudeNivelTexto_(nivel) + '\n\n' +
    '---\n_Lo dictó ' + quien + ' a ALMA. Claude: sigue el método de CLAUDE.md (glosario, pregunta primero lo que es decisión de Juan, prototipos si es visual, spec y tickets si es grande, dos revisiones, evidencia en el PR). ' +
    (ajuste ? 'Es parte de un trabajo que ya empezó: lee el historial completo antes de tocar nada.' : 'Trabájalo en una rama nueva, abre un PR y enlázalo aquí.') + ' No incluyas datos personales de huéspedes._';
  var issue = m.issue || '';
  var pg = PropertiesService.getScriptProperties(), tok = pg.getProperty('GITHUB_TOKEN') || pg.getProperty('GITHUB_PRS');   // la llave de Conexiones también sirve
  if (tok && issue) { try { microComentar_(issue, cuerpo); } catch (e) { console.error('paraClaude comentario: ' + e); } }   // el ajuste va como comentario, no otro issue
  else if (tok) {
    try {
      var r = uf_('https://api.github.com/repos/' + PARA_CLAUDE_REPO_ + '/issues', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        payload: JSON.stringify({ title: '[' + (inp.app || 'Otro') + '] ' + (ajuste ? m.nombre : titulo), body: cuerpo, labels: ['alma-mejora', String(inp.tipo || 'mejora'), 'prioridad-' + (inp.prioridad || 'normal')] }) });
      if (r.getResponseCode() < 300) issue = JSON.parse(r.getContentText()).html_url || '';
      else console.error('GitHub issue ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    } catch (e) { console.error('paraClaude GitHub: ' + e); }
  }
  m.issue = issue;
  /* La instrucción lleva el historial completo: cada disparo abre una sesión nueva de Claude, sin memoria. */
  var instruccion = cuerpo + (m.ajustes.length > 1 ? '\n\n### Historial del microproyecto (lo más viejo primero)\n' + microHistorialTexto_(m).slice(-40000) : '') + '\n\n' + MICRO_RESPONDER_;
  var llave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var disparo = paraClaudeDisparar_({ id: id, llave: llave, respuesta_url: PropertiesService.getScriptProperties().getProperty('HUB_URL') || HUB_EXEC_DEF_,
    quien: quien, app: inp.app || 'Otro', tipo: inp.tipo || 'mejora', prioridad: inp.prioridad || 'normal', titulo: ajuste ? m.nombre + ' · ' + (segunda ? 'segunda parte' : 'ajuste') : titulo,
    instruccion: instruccion, issue: issue, micro: microParaClaude_(m, { ajuste: ajuste, segunda: segunda, como: como, sesionAnterior: sesionAnterior }) }, nivel);
  if (disparo.ok) nivel = claudeNivel_(disparo.nivel);   // sin la llave de la sencilla corrió la compleja: el chip dice la verdad
  m.nivel = nivel;
  if (disparo.ok) { m.estado = MICRO_ESTADOS_.trabajo; m.ultima_pregunta = ''; m.opciones = []; if (disparo.url) m.sesion = disparo.url; }
  else if (!ajuste) m.estado = MICRO_ESTADOS_.trabajo;   // quedó en la lista (y en el issue); la tarjeta lo muestra igual
  try { microGuardar_(m); } catch (e) { console.error('microGuardar_: ' + e); }
  /* chat: en qué chat con Alma caen sus respuestas (el de quien lo pidió). micro: su microproyecto. */
  try { paraClaudeHoja_().appendRow([id, fecha, quien, inp.app || 'Otro', inp.tipo || 'mejora', inp.prioridad || 'normal', ajuste ? m.nombre : titulo, cuerpo.slice(0, 45000), disparo.ok ? 'con Claude' : 'pendiente', issue, disparo.url || '', '', disparo.ok ? paraClaudeHuella_(llave) : '', '', (adm && adm.email) || '', m.id, nivel]); }
  catch (e) { return { ok: false, error: 'No pude guardarlo: ' + e }; }
  /* Lo que no salió de un mensaje suyo (rondas de los agentes, bots de prueba, Pendientes) queda anotado en su chat.
     Lo que sí salió de su chat (sinChat) ya está ahí: su mensaje y la respuesta de Alma. */
  if (!inp.sinChat && adm && adm.email) {
    try { opGuardar_(adm, 'alma', 'claude', 'Pedido para Claudio · ' + (ajuste ? m.nombre : titulo) + '\n\n' + queQuiere.slice(0, 1500) + (disparo.ok ? '' : '\n\n(No se pudo enviar directo a Claudio: ' + disparo.error + '. Quedó en la lista de pedidos.)'), [], CHAT_DESARROLLO_); } catch (e) { console.error('Pedido en el chat: ' + e); }
  }
  return { ok: true, id: id, issue: issue || undefined, claude: disparo.ok, nivel: nivel, nivelNota: disparo.ok ? (disparo.nota || '') : '', micro: { id: m.id, nombre: m.nombre, ajuste: ajuste, segunda: segunda, parte: m.parte, nivel: nivel },
    nota: disparo.ok ? 'Listo, quedó pedido.' :
      issue ? 'Listo, quedó pedido en la lista (el arranque directo falló); cuando esté, llega a Pendientes para unir.' : 'Quedó guardado en la lista de pedidos, pero no arrancó: falta CLAUDE_RUTINA_TOKEN.' };
}
/* Apps viejas que todavía responden en la conversación «Desarrollo» (resId op:desarrollo): el mensaje entra al chat del
   principal como Propósito · Desarrollo. Como en todo el chat (chat.js), queda de borrador y Alma pregunta
   «¿Se lo mando a Claude?»; si el mensaje es la respuesta a esa pregunta, se resuelve. Solo el principal, con su sesión. */
function paraClaudeDesdeChat_(ses, texto) {
  texto = String(texto || '').trim(); if (!texto) return { ok: false, error: 'faltan datos' };
  var adm = paraClaudePrincipalSes_(ses);
  if (!adm) return { ok: false, error: 'Solo el administrador principal puede pedirle cambios a Claudio.' };
  var rb = chatBorradorTurno_(adm, null, texto, 'hub');
  if (rb) return rb.claude && !rb.claude.ok ? { ok: false, error: rb.alma.texto, alma: rb.alma } : rb;
  var yo = opGuardar_(adm, 'yo', 'hub', texto, [], CHAT_DESARROLLO_);
  var d = chatDesarrollo_(adm, texto, '', [], { canal: 'hub' });
  var alma = opGuardar_(adm, 'alma', 'hub', d.texto, [], CHAT_DESARROLLO_);
  return { ok: true, yo: yo, alma: alma, borrador: d.borrador };
}
/* hub.spacioam.com/alma/conexiones.html: las llaves de las conexiones de Alma (Claude, Spotify, AirLabs, Google Home). Solo el admin
   principal con su sesión; las llaves nunca se devuelven, solo si están puestas. */
function conexiones_(ses, b) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede ver las conexiones.' };
  var p = PropertiesService.getScriptProperties(), g = b.guardar || {};
  if (g.claude) { if (!/^sk-ant-oat01-[\w-]{20,}$/.test(String(g.claude).trim())) return { ok: false, error: 'La llave de Claude empieza con sk-ant-oat01-' }; p.setProperty('CLAUDE_RUTINA_TOKEN', String(g.claude).trim()); }
  if (g.spotifyId) p.setProperty('SPOTIFY_CLIENT_ID', String(g.spotifyId).trim());
  if (g.spotifySecret) p.setProperty('SPOTIFY_CLIENT_SECRET', String(g.spotifySecret).trim());
  if (g.github) p.setProperty('GITHUB_PRS', String(g.github).trim());
  /* AirLabs (vuelovivo.js): la llave del plan gratis, para la puerta y el embarque al día. Es la principal. */
  if (g.airlabs) { var al = String(g.airlabs).trim(); if (!/^[A-Za-z0-9-]{20,64}$/.test(al)) return { ok: false, error: 'Esa no parece la llave de AirLabs: son letras, números y guiones, sin espacios.' }; p.setProperty('AIRLABS_KEY', al); }
  if (b.desconectar === 'airlabs') p.deleteProperty('AIRLABS_KEY');
  /* FlightAware AeroAPI (vuelovivo.js), opcional: solo se usa si AirLabs no tiene llave o no encuentra el vuelo. */
  if (g.flightaware) { var fa = String(g.flightaware).trim(); if (!/^[A-Za-z0-9]{20,64}$/.test(fa)) return { ok: false, error: 'Esa no parece la llave de FlightAware: son letras y números, sin espacios (unas 32).' }; p.setProperty('FLIGHTAWARE_KEY', fa); }
  if (b.desconectar === 'flightaware') p.deleteProperty('FLIGHTAWARE_KEY');
  /* Respaldo del inicio de sesión (issue #318): el SESSION_SECRET del login, para comprobar la sesión aquí si el login no
     contesta (sin cupo de Google). Nunca se devuelve: solo si está puesto. */
  if (g.loginSecreto) { var ls = String(g.loginSecreto).trim(); if (ls.length < 32 || /\s/.test(ls)) return { ok: false, error: 'Esa no parece la llave: SESSION_SECRET es un texto largo, sin espacios (32 letras o más).' }; p.setProperty('LOGIN_SECRETO', ls); }
  /* El cerebro de Alma (BigQuery): el id del proyecto y la llave JSON de la cuenta de servicio. Se revisa que sea una
     llave de cuenta de servicio de verdad; nunca se devuelve, solo el correo de la cuenta (no es secreto). */
  if (g.bqProyecto) { if (!/^[a-z][a-z0-9-]{4,29}$/.test(String(g.bqProyecto).trim())) return { ok: false, error: 'El ID del proyecto va en minúsculas, con números y guiones (p. ej. alma-cerebro-123456).' }; p.setProperty('BQ_PROYECTO', String(g.bqProyecto).trim()); }
  if (g.bqCuenta) {
    var cj = null; try { cj = JSON.parse(String(g.bqCuenta)); } catch (e) {}
    if (!cj || cj.type !== 'service_account' || !cj.private_key || !cj.client_email) return { ok: false, error: 'Ese no es el archivo de la cuenta de servicio: es un JSON que dice "type": "service_account".' };
    p.setProperty('BQ_CUENTA', JSON.stringify(cj));
  }
  if (b.desconectar === 'spotify') p.deleteProperty('SPOTIFY_REFRESH');
  var canje = b.spotifyCodigo ? spotifyCanjear_(b.spotifyCodigo) : null;
  var out = { ok: true, claude: !!p.getProperty('CLAUDE_RUTINA_TOKEN'), claudeSencillo: !!p.getProperty('CLAUDE_RUTINA_TOKEN_SENCILLO'), spotify: spotifyEstado_(), github: !!(p.getProperty('GITHUB_PRS') || p.getProperty('GITHUB_TOKEN')), bigquery: conexBq_(p), loginSecreto: !!p.getProperty('LOGIN_SECRETO'), airlabs: vueloVivoEstado_(p, 'airlabs'), flightaware: vueloVivoEstado_(p, 'flightaware') };
  if (canje) out.canje = canje;
  if (b.vueloPrueba) out.vueloPrueba = vueloPrueba_(b.vueloPrueba);   // ¿el plan gratis de AirLabs da la puerta? (vuelovivo.js)
  /* El cerebro: «Cargar ahora» instala el activador y corre una tanda; con BigQuery puesto, siempre su estado. */
  if (out.bigquery.proyecto && out.bigquery.cuenta) {
    try {
      if (b.cerebro === 'cargar') { cerebroAsegurarActivador_(); out.carga = cerebroSincronizar_({ ahora: true }); }
      if (b.cerebro === 'probar') out.prueba = cerebroProbar_({ origen: 'conexiones' });           // la prueba del cerebro (cerebro_prueba.js)
      if (b.cerebro === 'umbral') out.umbral = cerUsarUmbralSugerido_();                          // solo cuando Juan lo toca
      /* Fuentes del cerebro: agregar o quitar una carpeta de Drive por su enlace (cerebro_fuentes.js) */
      if (b.cerebroFuente) out.fuente = b.cerebroFuente.quitar ? cerFuenteQuitar_(b.cerebroFuente.quitar) : cerFuenteAgregar_(b.cerebroFuente);
      out.cerebro = cerebroEstado_();
    } catch (e) { out.cerebro = { ok: false, error: String(e.message || e).slice(0, 200) }; }
  }
  if (b.conectar === 'spotify') { var a = spotifyAutorizar_(); if (!a.ok) return a; out.url = a.url; }
  return out;
}
function conexBq_(p) { var c = null; try { c = JSON.parse(p.getProperty('BQ_CUENTA') || 'null'); } catch (e) {} return { proyecto: p.getProperty('BQ_PROYECTO') || '', cuenta: c && c.client_email ? c.client_email : '' }; }
/* hub.spacioam.com/claude.html: el admin principal pega ahí las llaves de las dos tareas (la pantalla de Propiedades del
   script no deja agregar más de 50): la compleja (Opus, CLAUDE_RUTINA_TOKEN) y la sencilla (Sonnet,
   CLAUDE_RUTINA_TOKEN_SENCILLO). Con llaves vacías solo dice si ya hay; nunca las devuelve, solo sus 4 últimas letras.
   llave: la de la compleja (como siempre) · sencilla: la de la sencilla. */
function paraClaudeLlave_(ses, llave, sencilla) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }   // también con su correo alterno
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede guardar esta llave.' };
  var p = PropertiesService.getScriptProperties(); llave = String(llave || '').trim(); sencilla = String(sencilla || '').trim();
  var valida = /^sk-ant-oat01-[\w-]{20,}$/;
  if (llave && !valida.test(llave)) return { ok: false, error: 'Esa no parece la llave de la tarea compleja: empieza con sk-ant-oat01-' };
  if (sencilla && !valida.test(sencilla)) return { ok: false, error: 'Esa no parece la llave de la tarea sencilla: empieza con sk-ant-oat01-' };
  if (llave) p.setProperty('CLAUDE_RUTINA_TOKEN', llave);
  if (sencilla) p.setProperty('CLAUDE_RUTINA_TOKEN_SENCILLO', sencilla);
  var t = p.getProperty('CLAUDE_RUTINA_TOKEN') || '', ts = p.getProperty('CLAUDE_RUTINA_TOKEN_SENCILLO') || '';
  return { ok: true, guardada: !!t, termina: t ? t.slice(-4) : '', sencilla: { guardada: !!ts, termina: ts ? ts.slice(-4) : '' } };
}
/* Dispara la tarea de Claude Code del nivel (sencillo → Sonnet, complejo → Opus). Devuelve { ok, url, nivel, nota } o
   { ok:false, error, nivel }. nivel = el que de verdad corrió: sin la llave de la sencilla va a la compleja y nota lo dice.
   Sin reintentos: cada disparo abre una sesión. Las llaves nunca se registran ni se devuelven. */
function paraClaudeDisparar_(pedido, nivel) {
  var p = PropertiesService.getScriptProperties(), tok = '', rutina = '', nota = '';
  nivel = claudeNivel_(nivel);
  if (nivel === 'sencillo') {
    tok = p.getProperty('CLAUDE_RUTINA_TOKEN_SENCILLO'); rutina = p.getProperty('CLAUDE_RUTINA_ID_SENCILLO') || CLAUDE_RUTINA_SENCILLO_DEF_;
    if (!tok) { nivel = 'complejo'; nota = 'Fue con Opus: la tarea sencilla todavía no tiene su llave.'; console.log('paraClaudeDisparar_: sin llave de la tarea sencilla, va a la compleja'); }
  }
  if (nivel === 'complejo') { tok = p.getProperty('CLAUDE_RUTINA_TOKEN'); rutina = p.getProperty('CLAUDE_RUTINA_ID') || CLAUDE_RUTINA_DEF_; }
  if (!tok) return { ok: false, error: 'falta CLAUDE_RUTINA_TOKEN', nivel: nivel };
  pedido = Object.assign({}, pedido, { nivel: nivel });
  try {
    var r = uf_('https://api.anthropic.com/v1/claude_code/routines/' + rutina + '/fire', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tok, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'experimental-cc-routine-2026-04-01' },
      payload: JSON.stringify({ text: JSON.stringify(pedido).slice(0, 65000) }) });
    var c = r.getResponseCode(), j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
    if (c >= 300) { console.error('Rutina Claude (' + nivel + ') ' + c + ': ' + r.getContentText().slice(0, 300)); return { ok: false, nivel: nivel, error: 'Claudio respondió ' + c + ((j.error && j.error.message) ? ' (' + String(j.error.message).slice(0, 120) + ')' : '') }; }
    return { ok: true, url: j.claude_code_session_url || '', nivel: nivel, nota: nota };
  } catch (e) { console.error('paraClaudeDisparar_: ' + e); return { ok: false, nivel: nivel, error: String(e).slice(0, 160) }; }
}
/* Claude responde (doPost con {mejora:1, action:'respuesta'}). La llave es de un solo uso: se borra al aceptarla. */
function paraClaudeRespuesta_(b) {
  b = b || {};
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2 || !b.id || !b.llave) return { ok: false, error: 'pedido' };
  sh = paraClaudeHoja_();   // con la columna «chat» (las filas viejas la tienen vacía)
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, PARA_CLAUDE_CAB_.length).getValues(), i = -1;
    for (var k = 0; k < v.length; k++) if (String(v[k][0]) === String(b.id)) { i = k; break; }
    if (i < 0 || !v[i][12] || String(v[i][12]) !== paraClaudeHuella_(b.llave)) return { ok: false, error: 'llave' };
    var estado = /^(listo|pregunta|fallo)$/.test(String(b.estado)) ? String(b.estado) : 'listo', titulo = String(v[i][6]);
    var voz = String(b.voz || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    var enlaces = (Array.isArray(b.enlaces) ? b.enlaces : []).map(String).filter(function (u) { return /^https:\/\/github\.com\//.test(u); }).slice(0, 6);
    var cuerpoR = (voz ? voz + '\n\n' : '') + String(b.detalle || '').trim().slice(0, 3000);
    /* Su microproyecto (#374): la respuesta entra al historial y cambia el estado (pregunta, listo para unir…). */
    var m = null; if (v[i][15]) { try { m = microRespuesta_(String(v[i][15]), { estado: estado, voz: voz, detalle: b.detalle, enlaces: enlaces, rama: b.rama }, cuerpoR); } catch (e) { console.error('microRespuesta_: ' + e); } }
    if (m) titulo = m.nombre;
    var texto = (estado === 'pregunta' ? 'Pregunta · ' : estado === 'fallo' ? 'No se pudo · ' : 'Listo · ') + titulo + '\n\n' +
      cuerpoR + (enlaces.length ? '\n\n' + enlaces.join('\n') : '');
    var conPr = enlaces.some(function (u) { return /\/pull\/\d+/.test(u); }) || !!(m && m.estado === MICRO_ESTADOS_.listo);
    if (estado === 'listo') enlaces.forEach(function (u) { if (/\/pull\/\d+/.test(u)) { try { accionCrear_('Unir el PR: ' + titulo, 'Claudio dejó listo este cambio. Abre el enlace, revisa y toca «Merge pull request».', u, 'claude'); } catch (e) { console.error('accionCrear_: ' + e); } } });
    sh.getRange(i + 2, 9).setValue(estado === 'listo' ? (conPr ? 'PR listo' : 'respondido') : estado);
    sh.getRange(i + 2, 12, 1, 2).setValues([[texto.slice(0, 45000), '']]);   // la llave ya no sirve
    /* En el chat con Alma de quien lo pidió (o del principal, para los pedidos viejos); cada mensaje empieza con la fecha. */
    var dest = (v[i][14] && adminPorEmail_(String(v[i][14]))) || chatPrincipal_() || DESARROLLO_;
    opGuardar_(dest, 'alma', 'claude', paraClaudeFecha_() + ' · ' + texto, [], CHAT_DESARROLLO_);
    paraClaudeAvisar_(titulo, voz || cuerpoR.slice(0, 200), estado === 'listo' && !conPr ? 'consulta' : estado);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/* Fecha legible en hora de Guatemala, ej. «28 Oct 2026». */
function paraClaudeFecha_() {
  var d = new Date(), m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var dia = Utilities.formatDate(d, 'America/Guatemala', 'd'), mes = Number(Utilities.formatDate(d, 'America/Guatemala', 'M')) - 1;
  return dia + ' ' + m[mes] + ' ' + Utilities.formatDate(d, 'America/Guatemala', 'yyyy');
}
/* Avisos de Claude (decisión de Juan, #374): solo lo que sirve, nunca un acuse («se lo mandé», «lo recibió»).
     pregunta → nivel 2 «Hay una pregunta sobre «X»» (las opciones van en su tarjeta de Pendientes)
     listo    → nivel 2 «Listo, quedó «X»: está en Pendientes para que lo unas» (hay un PR)
     fallo    → nivel 2 «No se pudo con «X»»
   Sin «Claudio» en lo que se dice: el resultado, ya hecho (Juan, 3-nov-2026).
     consulta → nivel 3 (respondió sin PR: solo para leer)
     unido    → nivel 3 «Quedó unido «X»» (microUnido_)
   Lo de nivel 2 también queda como tema por retomar. Además, novedad para su próxima llamada con Alma. */
function paraClaudeAvisarTexto_(titulo, voz, estado) {
  var t = '«' + titulo + '»';
  return estado === 'pregunta' ? 'Hay una pregunta sobre ' + t + (voz ? ': ' + voz : '.')
    : estado === 'fallo' ? 'No se pudo con ' + t + (voz ? ': ' + voz : '.')
    : estado === 'unido' ? 'Quedó unido ' + t + '.'
    : estado === 'consulta' ? 'Listo, ' + t + (voz ? ': ' + voz : '.')
    : 'Listo, quedó ' + t + ': está en Pendientes para que lo unas.';
}
function paraClaudeAvisar_(titulo, voz, estado) {
  var p = PropertiesService.getScriptProperties(), nov = [], texto = paraClaudeAvisarTexto_(titulo, voz, estado), nivel = /^(pregunta|fallo|listo)$/.test(String(estado)) ? 2 : 3;
  try { nov = JSON.parse(p.getProperty('DESARROLLO_NOVEDADES') || '[]'); } catch (e) {}
  nov.push({ ts: new Date().toISOString(), titulo: titulo, voz: texto, estado: estado });
  p.setProperty('DESARROLLO_NOVEDADES', JSON.stringify(nov.slice(-5)));
  try {
    var jefe = adminsOp_().find(function (a) { return a.principal; });
    /* tema por retomar (solo lo que pide algo de Juan) y notificación en la app de iPhone */
    try { var it = nivel === 2 ? retPoner_(jefe, { texto: texto, importancia: 2, origen: 'claude' }) : null; vozAvisoPoner_(jefe, texto, it && it.id, { nivel: nivel }); } catch (e) {}
    /* lo de Claude ya aparece en Pendientes (Propósito · Desarrollo): al principal no se le manda por WhatsApp */
    if (jefe && jefe.tels.length && !esAdminPrincipal_(jefe) && nivel === 2) waEnviar_(jefe.wa || jefe.tels[0], texto + '\n\nEl detalle está en tu chat con Alma (Propósito · Desarrollo).');
  } catch (e) { console.error('paraClaudeAvisar_: ' + e); }
}
/* Para la ficha de la llamada del principal: lo que Claude respondió desde la última llamada (y lo marca como contado). */
function paraClaudeNovedades_(adm) {
  if (!adm || !adm.principal) return '';
  var p = PropertiesService.getScriptProperties(), nov = [];
  try { nov = JSON.parse(p.getProperty('DESARROLLO_NOVEDADES') || '[]'); } catch (e) {}
  if (!nov.length) return '';
  p.deleteProperty('DESARROLLO_NOVEDADES');
  return '\nNOVEDADES DEL SISTEMA (lo que terminó Claude, el desarrollador; nómbralo «Claudio» solo si Juan pregunta por él): cuéntaselas en una frase cada una, sin leer detalles, cuando termine su primer pedido o si pregunta qué hay nuevo:\n' +
    nov.map(function (n) { return '· ' + n.voz; }).join('\n');
}
/* Robot: los pedidos (por defecto los pendientes) y marcar uno como hecho. */
function paraClaudeLista_(todos) {
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: true, pedidos: [] };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PARA_CLAUDE_CAB_.length).getValues();
  return { ok: true, pedidos: v.map(function (r) { var o = {}; PARA_CLAUDE_CAB_.forEach(function (k, i) { if (k !== 'llave') o[k] = String(r[i]); }); return o; }).filter(function (o) { return todos || o.estado === 'pendiente'; }) };
}
function paraClaudeMarcar_(id, estado, nota) {
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: false, error: 'sin hoja' };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }), i = ids.indexOf(String(id));
  if (i < 0) return { ok: false, error: 'no existe' };
  sh.getRange(i + 2, 9).setValue(String(estado || 'hecho') + (nota ? ' · ' + String(nota).slice(0, 300) : ''));
  return { ok: true };
}

/* ═══ ACCIONES PENDIENTES DEL USUARIO ═══════════════════════════════════════════════════════════════════════════
   Cuando Claude deja algo que Juan debe hacer a mano (unir un PR, aprobar, abrir un enlace), queda aquí como una
   acción con título, instrucción y enlace. El Hub muestra un botón «Acciones pendientes (N)» solo si hay alguna.
   Si el enlace es un PR de GitHub, el Hub la da por hecha sola cuando el PR ya se unió o se cerró. */
var ACCIONES_CAB_ = ['id', 'fecha', 'titulo', 'instruccion', 'enlace', 'estado', 'origen'];
function accionesHoja_() {
  var sh = hojaCrear_('ALMA_ACCIONES', ACCIONES_CAB_);
  if (sh.getLastColumn() < ACCIONES_CAB_.length) sh.getRange(1, 1, 1, ACCIONES_CAB_.length).setValues([ACCIONES_CAB_]);
  return sh;
}
/* Crea una acción pendiente. Solo enlaces https. Si ya hay una pendiente con el mismo enlace, no la repite. */
function accionCrear_(titulo, instruccion, enlace, origen) {
  titulo = String(titulo || '').trim().slice(0, 120); if (!titulo) return { ok: false, error: 'titulo' };
  enlace = /^https:\/\//.test(String(enlace || '')) ? String(enlace).slice(0, 500) : '';
  var sh = accionesHoja_(), lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (enlace && sh.getLastRow() > 1) {
      var v = sh.getRange(2, 1, sh.getLastRow() - 1, ACCIONES_CAB_.length).getValues();
      for (var k = 0; k < v.length; k++) if (String(v[k][4]) === enlace && String(v[k][5]) === 'pendiente') return { ok: true, id: String(v[k][0]), repetida: true };
    }
    var id = 'ac' + Date.now();
    sh.appendRow([id, Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm'), titulo, String(instruccion || '').trim().slice(0, 2000), enlace, 'pendiente', String(origen || '').slice(0, 60)]);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}
/* ¿El PR de GitHub ya se unió o se cerró? true/false, o null si no se pudo saber. Repos públicos o con GITHUB_TOKEN. */
function accionPrCerrado_(enlace) {
  var m = /^https:\/\/github\.com\/(jforce15-coder\/[\w.-]+)\/pull\/(\d+)/i.exec(String(enlace)); if (!m) return null;
  try {
    var tok = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'), h = { Accept: 'application/vnd.github+json' };
    if (tok) h.Authorization = 'Bearer ' + tok;
    var r = uf_('https://api.github.com/repos/' + m[1] + '/pulls/' + m[2], { headers: h, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    var pr = JSON.parse(r.getContentText()); return pr.state === 'closed' || !!pr.merged;
  } catch (e) { return null; }
}
/* Lista las pendientes; antes revisa las de PR (como mucho una vez por minuto) y marca como hechas las ya unidas. */
function accionesLista_() {
  var sh = accionesHoja_(); if (sh.getLastRow() < 2) return { ok: true, acciones: [] };
  var cache = CacheService.getScriptCache(), v = sh.getRange(2, 1, sh.getLastRow() - 1, ACCIONES_CAB_.length).getValues(), lista = [];
  v.forEach(function (r, i) {
    if (String(r[5]) !== 'pendiente') return;
    var ck = 'acc_' + r[0];
    if (/\/pull\/\d+/.test(String(r[4])) && !cache.get(ck)) {
      cache.put(ck, '1', 60);
      if (accionPrCerrado_(r[4]) === true) { sh.getRange(i + 2, 6).setValue('completada'); return; }
    }
    lista.push({ id: String(r[0]), fecha: String(r[1]), titulo: String(r[2]), instruccion: String(r[3]), enlace: String(r[4]) });
  });
  return { ok: true, acciones: lista };
}
function accionMarcar_(id) {
  var sh = accionesHoja_(); if (sh.getLastRow() < 2) return { ok: false, error: 'no existe' };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }), i = ids.indexOf(String(id));
  if (i < 0) return { ok: false, error: 'no existe' };
  sh.getRange(i + 2, 6).setValue('completada'); return { ok: true };
}

/* ═══ PENDIENTES DE CLAUDE (app de Alma) ═══════════════════════════════════════════════════════════════════
   El botón «Pendientes» del inicio de la app de Alma: lo que Claude está haciendo o dejó listo para Juan, con sus
   instrucciones y el cambio para unir. Cada uno desaparece solo cuando su PR se une (con GITHUB_PRS o GITHUB_TOKEN:
   un token de GitHub de solo lectura de pull requests) o cuando Juan lo marca como hecho. */
var PEND_ABIERTOS_ = /^(con Claude|PR listo|pregunta|fallo|pendiente|publicado)/;
function paraClaudePrincipalSes_(ses) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }
  return adm && esAdminPrincipal_(adm) ? adm : null;
}
/* El estado de un PR en GitHub: abierto, unido o cerrado; si se unió, su commit (para seguir sus revisiones). */
function paraClaudeGh_(ruta) {
  var p = PropertiesService.getScriptProperties(), tok = p.getProperty('GITHUB_PRS') || p.getProperty('GITHUB_TOKEN'); if (!tok) return null;
  try {
    var r = uf_('https://api.github.com' + ruta, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
  } catch (e) { return null; }
}
function paraClaudePrInfo_(url) {
  var m = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/.exec(String(url || '')); if (!m) return null;
  var c = CacheService.getScriptCache(), k = 'prinf_' + m[1] + '_' + m[2] + '_' + m[3], h = c.get(k); if (h) return JSON.parse(h);
  var j = paraClaudeGh_('/repos/' + m[1] + '/' + m[2] + '/pulls/' + m[3]); if (!j) return null;
  var o = { url: url, repo: m[1] + '/' + m[2], estado: j.merged_at ? 'unido' : j.state === 'closed' ? 'cerrado' : 'abierto', unido: j.merged_at || '', sha: j.merge_commit_sha || '' };
  c.put(k, JSON.stringify(o), o.estado === 'abierto' ? 45 : 3600); return o;
}
/* Las revisiones de GitHub sobre el commit del Merge (Actions, Pages, TestFlight…): cuántas van y si alguna falló. */
function paraClaudeChecks_(repo, sha) {
  var c = CacheService.getScriptCache(), k = 'prck_' + repo + '_' + sha, h = c.get(k); if (h) return JSON.parse(h);
  var cr = paraClaudeGh_('/repos/' + repo + '/commits/' + sha + '/check-runs?per_page=100'), st = paraClaudeGh_('/repos/' + repo + '/commits/' + sha + '/status');
  if (!cr && !st) return null;
  var o = { total: 0, ok: 0, corriendo: 0, fallas: 0 };
  ((cr && cr.check_runs) || []).forEach(function (x) {
    o.total++;
    if (x.status !== 'completed') o.corriendo++;
    else if (/^(success|skipped|neutral)$/.test(x.conclusion)) o.ok++;
    else if (x.conclusion === 'action_required') o.corriendo++;
    else o.fallas++;
  });
  ((st && st.statuses) || []).forEach(function (x) { o.total++; if (x.state === 'pending') o.corriendo++; else if (x.state === 'success') o.ok++; else o.fallas++; });
  c.put(k, JSON.stringify(o), o.corriendo ? 15 : 600); return o;
}
/* Alma traduce a Claude: de lo técnico a lo simple, como para un niño. Se guarda en la columna «simple» (una vez por respuesta). */
function paraClaudeSimple_(titulo, estado, resp) {
  var sys = 'Eres Alma, la asistente de Juan. Claude (el programador; a Juan dile siempre «Claudio») le dejó un pendiente. Tradúcelo para Juan como si se lo explicaras a un niño de 10 años: palabras de todos los días, cero términos técnicos (nada de PR, Apps Script, commit, branch, código, archivo, merge: di «unir el cambio»). ' +
    'Responde SOLO un JSON: {"titulo":"máx. 6 palabras, claro","que_es":"1 frase corta: qué cambia para él o qué está pasando","pasos":["1 a 3 pasos cortísimos que Juan debe hacer, ej. «Toca Ver cambio y luego el botón verde Merge»; vacío si no tiene que hacer nada"],"pregunta":"si Claude le pregunta algo, la pregunta en simple; si no, vacío"}';
  var txt = 'Título del pedido: ' + titulo + '\nEstado: ' + estado + '\nLo que respondió Claude:\n' + String(resp || '(todavía no responde: está trabajando)').slice(0, 4000);
  try {
    var t = String(claude_(CFG.MODELO_REDACTOR, 400, sys, txt, 0.2) || ''), m = /\{[\s\S]*\}/.exec(t), j = m ? JSON.parse(m[0]) : null;
    if (j && j.titulo) return { titulo: String(j.titulo).slice(0, 60), que_es: String(j.que_es || '').slice(0, 240), pasos: (j.pasos || []).map(String).slice(0, 3), pregunta: String(j.pregunta || '').slice(0, 240) };
  } catch (e) { console.error('paraClaudeSimple_: ' + e); }
  return null;
}
function paraClaudePendientes_(ses) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  /* Microproyectos (#374): una tarjeta por microproyecto, no una por pedido o respuesta. */
  var micros = []; try { micros = microTarjetas_(paraClaudePrincipalSes_(ses)); } catch (e) { console.error('microTarjetas_: ' + e); }
  var sh = ssAlma_().getSheetByName('ALMA_PARA_CLAUDE'); if (!sh || sh.getLastRow() < 2) return { ok: true, lista: pendientesPrs_(micros) };
  var n = Math.min(60, sh.getLastRow() - 1), ini = sh.getLastRow() - n + 1;
  if (sh.getLastColumn() < PARA_CLAUDE_CAB_.length) sh.getRange(1, 1, 1, PARA_CLAUDE_CAB_.length).setValues([PARA_CLAUDE_CAB_]);
  var v = sh.getRange(ini, 1, n, PARA_CLAUDE_CAB_.length).getValues(), lista = [], corte = Date.now() - 21 * 86400000, traducidos = 0;
  v.forEach(function (r, i) {
    var estado = String(r[8] || ''); if (!PEND_ABIERTOS_.test(estado) || String(r[15] || '')) return;   // lo de un microproyecto va en su tarjeta
    var f = r[1] instanceof Date ? r[1].getTime() : new Date(String(r[1]).replace(' ', 'T') + ':00-06:00').getTime(); if (f && f < corte) return;
    var resp = String(r[11] || ''), enlaces = resp.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/g) || [];
    /* «PR listo» sin ningún PR: era una consulta que Claudio ya contestó (la respuesta llegó al chat y al aviso).
       No hay nada que unir: se cierra sola en vez de quedarse como «Unir» para siempre. */
    if (/^PR listo/.test(estado) && !enlaces.length) { try { sh.getRange(ini + i, 9).setValue('hecho · consulta respondida'); } catch (e) {} return; }
    var prs = enlaces.map(function (u) { return paraClaudePrInfo_(u) || { url: u, estado: null }; });
    /* Después del Merge: la lista sigue la publicación (las revisiones de GitHub) hasta que queda en verde. */
    var pub = null;
    if (prs.length && prs.every(function (x) { return x.estado === 'unido' || x.estado === 'cerrado'; })) {
      var unidos = prs.filter(function (x) { return x.estado === 'unido'; });
      if (!unidos.length) { try { sh.getRange(ini + i, 9).setValue('cerrado'); } catch (e) {} return; }
      var listoDesde = /^publicado · (\S+)/.exec(estado);
      if (listoDesde) { if (Date.now() - new Date(listoDesde[1]).getTime() > 20 * 60000) return; pub = { est: 'publicado' }; }
      else {
        var ultimo = Math.max.apply(null, unidos.map(function (x) { return new Date(x.unido).getTime() || 0; }));
        if (Date.now() - ultimo > 3 * 3600000) { try { sh.getRange(ini + i, 9).setValue('unido'); } catch (e) {} return; }   // unido hace mucho: ya no se sigue
        var t = { total: 0, ok: 0, corriendo: 0, fallas: 0 };
        unidos.forEach(function (x) { var ck = x.sha && paraClaudeChecks_(x.repo, x.sha); if (ck) { t.total += ck.total; t.ok += ck.ok; t.corriendo += ck.corriendo; t.fallas += ck.fallas; } else t.corriendo++; });
        if (t.fallas) pub = { est: 'fallo_pub', t: t };
        else if (t.corriendo || (!t.total && Date.now() - ultimo < 180000)) pub = { est: 'publicando', t: t };
        else { pub = { est: 'publicado' }; try { sh.getRange(ini + i, 9).setValue('publicado · ' + new Date().toISOString()); } catch (e) {} }
      }
      pub.app = unidos.some(function (x) { return /alma-app/i.test(x.repo); });
    }
    var cuerpo = resp.split(/\n\n/).slice(1).join('\n\n').replace(/https:\/\/github\.com\/\S+/g, '').trim();   // sin el encabezado «Claude terminó · …»
    var est = /^PR listo/.test(estado) ? 'listo' : /^pregunta/.test(estado) ? 'pregunta' : /^fallo/.test(estado) ? 'fallo' : 'trabajando';
    /* la traducción simple: se guarda con la huella de la respuesta (si Claude responde de nuevo, se vuelve a traducir) */
    var simple = null, huella = String(resp.length) + ':' + est; try { var sv = JSON.parse(String(r[13] || '{}')); if (sv.h === huella) simple = sv; } catch (e) {}
    if (!simple && traducidos < 4) { traducidos++; simple = paraClaudeSimple_(String(r[6] || ''), est, resp); if (simple) { simple.h = huella; try { sh.getRange(ini + i, 14).setValue(JSON.stringify(simple)); } catch (e) {} } }
    simple = simple || { titulo: String(r[6] || ''), que_es: est === 'trabajando' ? 'Claudio está trabajando en esto.' : (cuerpo.split(/\n\n/)[0] || ''), pasos: [], pregunta: '' };
    if (pub) {   // estados de la publicación: textos fijos y simples
      var tt = pub.t || {}, de = tt.total ? ' (' + tt.ok + ' de ' + tt.total + ' listos)' : '';
      var tx = { publicando: ['Ya lo uniste. GitHub lo está revisando y publicando' + de + '.', []],
        publicado: [pub.app ? '¡Listo! Ya está publicado. La versión nueva llega a TestFlight en unos minutos.' : '¡Listo! Ya está publicado.', [pub.app ? 'Actualiza Alma en TestFlight y pruébalo.' : 'Pruébalo.']],
        fallo_pub: ['Se unió, pero algo falló al publicarlo.', ['Escríbele a Alma en tu chat: «falló la publicación de ' + simple.titulo + '».']] }[pub.est];
      lista.push({ id: String(r[0]), titulo: simple.titulo, fecha: '', estado: pub.est, resumen: tx[0], pasos: tx[1], pregunta: '', original: cuerpo, instrucciones: '',
        progreso: tt.total ? tt.ok / tt.total : 0, enlaces: pub.est === 'fallo_pub' ? prs.map(function (x) { return x.url; }) : [] });
      return;
    }
    lista.push({ id: String(r[0]), titulo: simple.titulo, fecha: String(r[1] instanceof Date ? Utilities.formatDate(r[1], CFG.TZ, 'd MMM') : String(r[1]).slice(0, 10)),
      estado: est, resumen: simple.que_es, pasos: simple.pasos || [], pregunta: simple.pregunta || '', original: cuerpo, instrucciones: '',
      enlaces: prs.filter(function (x) { return x.estado !== 'unido' && x.estado !== 'cerrado'; }).map(function (x) { return x.url; }) });
  });
  return { ok: true, lista: pendientesPrs_(micros.concat(lista.reverse())) };
}
/* Todos los cambios abiertos de GitHub (también los que Claude abrió fuera del Hub) entran a la lista; los que ya
   están en un pendiente de Claude no se repiten: ese pendiente recibe su botón «Unir» (unir.js). */
function pendientesPrs_(lista) {
  var prs = null; try { prs = prsAbiertos_(false); } catch (e) { console.error('pendientesPrs_: ' + e); }
  if (!prs) return lista;
  var porUrl = {}; prs.forEach(function (x) { porUrl[x.url] = x; });
  var vistos = {};
  lista.forEach(function (p) {
    (p.enlaces || []).forEach(function (u) { vistos[u] = 1; });
    p.unir = (p.enlaces || []).filter(function (u) { return porUrl[u] && porUrl[u].estado === 'listo'; });
  });
  var TX = { listo: 'Pasó sus revisiones: está listo para unir.', revisando: 'GitHub lo está revisando; en un momento queda listo.',
    fallo: 'Algo falló en sus revisiones; Claudio lo está arreglando.', choque: 'Choca con lo último que se unió; Claudio tiene que ponerlo al día.', borrador: 'Todavía es un borrador.' };
  var EST = { listo: 'listo', revisando: 'revisando', fallo: 'fallo', choque: 'fallo', borrador: 'trabajando' };
  var nuevos = prs.filter(function (x) { return !vistos[x.url]; }).map(function (x) {
    return { id: 'pr:' + x.repo + '#' + x.numero, pr: true, titulo: x.titulo, fecha: x.app + ' #' + x.numero, estado: EST[x.estado] || 'listo', resumen: TX[x.estado] || '',
      pasos: x.estado === 'listo' ? ['Toca «Unir». O dile a Alma: «une el ' + x.numero + '».'] : [], pregunta: '', original: '', instrucciones: '',
      enlaces: [x.url], unir: x.estado === 'listo' ? [x.url] : [] };
  });
  return nuevos.concat(lista);
}
function paraClaudeHecho_(ses, id) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  if (/^mp:/.test(String(id))) return microCerrar_(String(id).slice(3));   // «Ya lo hice» en la tarjeta de un microproyecto
  return paraClaudeMarcar_(id, 'hecho', 'lo marcó Juan en la app');
}
