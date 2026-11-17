/* ═══ CUPO DE GOOGLE (issue #318) ═════════════════════════════════════════════════════════════════════════
   El 31-oct se acabó el cupo diario de UrlFetch de la cuenta de Google («Service invoked too many times for one day:
   urlfetch»). Ese cupo lo comparten TODOS los Apps Script de la cuenta (Hub/ALMA, Hola, Epi, Grow, Docs, Mi y el login).
   · Contador (T1): toda llamada a internet del Hub pasa por uf_ / ufAll_, que cuentan por canal en CacheService (una
     clave por hora y canal: cupo_<yyyyMMddHH>_<canal>). La primera llamada de cada hora (y aprender(), cada hora) vuelca
     las horas cerradas a la hoja GOOGLE_USO. Sin candado: si dos ejecuciones cuentan a la vez se puede perder alguna
     llamada; es un contador para decidir, no una factura.
   · El canal sale de: el canal que pasa la llamada · el login (siempre «Login») · el canal de la ejecución (cupoCanal_,
     lo ponen doPost, hubApi_ y los activadores) · el servidor al que se llama.
   · Límite: propiedad CUPO_DIA (20 000 por defecto, cuentas Gmail). Google no dice a qué hora reinicia el día, así que
     el nivel usa las últimas 24 h y la página muestra el día calendario de Guatemala.
   · Niveles (T3): verde · fondo (≥ 60 %: se pausa lo de fondo) · crítico (≥ 85 %: aviso a Juan; la voz y el chat de Alma nunca se pausan).
     CUPO_NUNCA_ es lo que nunca se pausa. CUPO_PAUSAR = 0 apaga las pausas (solo cuenta). Aviso a Juan al cambiar de
     nivel y cuando la proyección del día pasa el 80 %, una vez por nivel por día.
   · Página «Uso» (T4): acción «uso» del Hub, solo el administrador principal → alma/uso.html.
   · Las otras apps (T2): Hola, Epi, Grow, Docs y Mi cuentan las suyas (su propio cupo.js) y las dan con la acción
     «__cupo» y la llave del robot. cupoApps_ las lee cada 15 min (canal «Otras apps») y se suman al nivel, a la
     proyección y a «Uso» como canales «App Hola», «App Epi»… (los canales «Hola» y «Epi» son lo que el Hub les pide).
     Si una app no contesta, se ignora y «Uso» lo dice (sinDatos). Desde el 14-nov se leen cada CUPO_APPS_MIN (60 min).
   · Por función (14-nov): además del canal, cada llamada cuenta la función que la hizo (cupoFuncion_: los pasos de
     procesarCola, el webhook, la acción del Hub, el activador). Va en la misma caché horaria (una clave JSON por hora,
     cupo_<hora>_fn = { canal: { función: n } }, sin lecturas extra: getAll/putAll), se vuelca a GOOGLE_USO_FUNCION y
     «Uso» lo muestra en «Por función». No suma al nivel: el total sigue saliendo de los canales.
   · Ahorro (14-nov, CUPO_INTERVALOS_): cada intervalo que se alargó para gastar menos, con su porqué y su valor de antes.
     Una propiedad con el mismo nombre lo cambia sin PR; CUPO_AHORRO = 0 vuelve todo a como estaba.
   · Cupo agotado (17-nov, #737): Google cortó a las 15:26 («too many times for one day: urlfetch») y, sin cupo, la app
     de Alma saludaba (el saludo grabado) y colgaba en cada llamada, también al despertarla con «Alma» en el Modo Inicio:
     la ficha de la voz necesita la URL firmada de ElevenLabs, que es una llamada a internet. Ahora uf_/ufAll_ reconocen ese
     error (cupoAgotadoMarcar_): el nivel pasa a «agotado» (lo de fondo se pausa), Juan recibe un aviso en Notificaciones,
     la voz contesta con un mensaje claro en vez del error de Google (CUPO_VOZ_SIN_, voz.js) y lo que el Hub había contado
     hasta ese momento queda como el límite que de verdad hay (CUPO_DIA_VISTO): así el 60 % y el 85 % llegan antes del
     corte la próxima vez. La primera llamada a internet que sale bien lo quita (cupoAgotadoQuitar_). */

var CUPO_LIMITE_DEF_ = 20000;
var CUPO_HOJA_ = 'GOOGLE_USO';
var CUPO_CAB_ = ['hora', 'canal', 'llamadas', 'inicio_ms'];
var CUPO_FONDO_PCT_ = 60, CUPO_CRITICO_PCT_ = 85, CUPO_PROY_PCT_ = 80;
/* Los canales (id corto para la clave de caché · nombre que ve Juan). Un canal desconocido cuenta como «Otros». */
var CUPO_CANALES_ = [
  ['inicio', 'Modo inicio'], ['chat', 'Chat de Alma'], ['voz', 'Voz'], ['huespedes', 'Huéspedes'], ['whatsapp', 'WhatsApp'],
  ['cerebro', 'Cerebro'], ['fondo', 'Mejoras y fondo'], ['login', 'Login'], ['hola', 'Hola'], ['epi', 'Epi'],
  ['apps', 'Otras apps'], ['ia', 'IA · Claude'], ['viajes', 'Viajes'], ['vigilar', 'Vigilancias'], ['otros', 'Otros']
];
/* Las otras apps: id en ACCESOS_APPS_ (Código.js) · nombre corto (aviso «Sin datos de: …») · canal en «Uso». */
var CUPO_APPS_ = [['hola', 'Hola', 'App Hola'], ['epi', 'Epi', 'App Epi'], ['grow', 'Grow', 'App Grow'], ['docs', 'Docs', 'App Docs'], ['mi', 'Mi', 'App Mi']];
/* Lo que NUNCA se pausa, aunque el cupo esté en crítico (decisión de Juan): entrar y comprobar la sesión, responder a
   huéspedes (Hospitable y WhatsApp), descargar documentos, Epi y sus automatizaciones, y las rutas y asignaciones de
   limpieza. cupoPermite_ siempre dice que sí a estos. */
var CUPO_NUNCA_ = ['login', 'sesion', 'huespedes', 'documentos', 'epi', 'limpieza'];
/* Lo que sí se pausa y desde qué nivel. */
/* La voz y el chat de Alma NO se pausan por cupo (Juan, 1-nov: en crítico la app dejaba de conectar las llamadas y no
   respondía al chat, mientras el teléfono sí). Lo de fondo se pausa desde el 60 % justamente para dejarle el cupo a Alma. */
var CUPO_PAUSAS_ = { fondo: ['fondo', 'critico', 'agotado'] };
/* Acciones del Hub que son «Alma en el chat o en la voz»: en crítico devuelven un aviso amable (nunca error 'session'). */
var CUPO_ACC_ALMA_ = ['opEnviar', 'almaFoto', 'almaArchivo', 'vozWeb', 'vozFirma', 'vozClaudio', 'vozClaudioPanel', 'claudioLocal'];
var CUPO_PAUSA_ALMA_ = 'Alma está en pausa por cupo; vuelve en un rato.';
/* Lo que la app de Alma muestra (y dice) cuando no puede abrir la voz porque Google ya no deja llamar a internet. */
var CUPO_VOZ_SIN_ = 'Google se quedó sin cupo de llamadas a internet por hoy y no puedo abrir la voz. Vuelvo sola en cuanto Google lo reinicie; no es el Modo Inicio.';
/* Canal de cada acción del Hub (hubApi_). Lo que no está aquí cuenta como «Otros». */
var CUPO_ACCIONES_ = {
  inicio: 'pendientes notificaciones areas areaMover pendienteResolver pendienteResponder pendienteNota pendienteHecho pendientesClaude unirPr vozAvisos notifAjustes notifAjustesGuardar notifPrueba pedidosOrbita anilloBle anilloResumen tutoriales biblioteca bibliotecaSubir bibliotecaQuitar bibliotecaPedidoDejar recetas recetaBorrar vigilancias vigilanciaDejar llaveEstado llaveGuardar',
  chat: 'opEnviar opHilo opLista almaFoto almaArchivo mejorarCampo dictar plantillas',
  voz: 'vozWeb vozFirma vozClaudio vozClaudioPanel claudioLocal vozWebVincular conferencia conferenciaAudio reporteLlamadas calle calleUso calleUsoLeer calleVoz avisoHablar vozCaida vozCaidas',
  huespedes: 'responder responderWa adjunto hilo redactarHub cola reservaInfo programados programar adelantar cancelarProg editarProg setAuto setBorrador enviarAhora retener ' +
    'guestReview enviarReview reviewHuesped respuestaReview publicarRespuesta apelacionReview waNumeros resolver limpiezas pasos foto promesas promesaCerrar ajustarBorrador decision calendarioProps calendarioVisto calendarioProp',
  cerebro: 'cerebro conexiones',
  viajes: 'viajes viajePase vueloVivo',   // botón del avión (viajes.js): leer el correo con la IA se pausa como lo de fondo, salvo con un tramo en 48 h
  fondo: 'mejoras automejora purgarAutomejora mejoraEditar mejoraEliminar mejoraVerificar proponerMejora prompts setPrompt agentes correos usoIA usoMensual uso ' +
    'setConocimiento setPropiedadDato dsPropuestas dsDecidir'
};

var CUPO_FUNC_HOJA_ = 'GOOGLE_USO_FUNCION';
var CUPO_FUNC_CAB_ = ['hora', 'canal', 'funcion', 'llamadas', 'inicio_ms'];
/* ── Intervalos del ahorro (14-nov-2026): [ahora, antes, porqué]. Medido en GOOGLE_USO del 1 al 13-nov: «Huéspedes» era
   el 65–70 % del Hub y casi plano de madrugada (~300–400 por hora), o sea lo automático de procesarCola, no las personas.
   Nada de esto toca la respuesta a un mensaje que llega por webhook, lo de CUPO_NUNCA_, la voz ni el chat de Alma. */
var CUPO_INTERVALOS_ = {
  /* Cada cuánto corre el respaldo de la bandeja (sincronizarInbox_). Los mensajes entran al instante por el webhook y el
     turno de Alma relee el hilo de Hospitable antes de responder: esto solo arregla la bandeja si un webhook no llegó
     (p. ej. algo que el equipo escribió directo en Hospitable). Cada pasada lee hasta 15 conversaciones (~17 llamadas). */
  CUPO_RESPALDO_MIN: [15, 10, 'el respaldo de la bandeja: los mensajes ya entran por el webhook'],
  /* Una conversación quieta (sin movimiento en las últimas CUPO_RESPALDO_ACTIVA_H_ horas) se relee como mucho cada tanto;
     las que se movieron hace poco, en cada pasada. Antes las 15 se releían en cada pasada aunque nadie escribiera. */
  CUPO_RESPALDO_QUIETA_MIN: [60, 0, 'una conversación quieta casi nunca trae un webhook perdido'],
  /* Cada cuánto se le pregunta a Hola, Epi, Grow, Docs y Mi su gasto (5 llamadas por vez). Solo mueve el nivel, que se
     decide con las últimas 24 h: una hora de retraso no cambia la decisión. */
  CUPO_APPS_MIN: [60, 15, 'el gasto de las otras apps solo mueve el nivel, que mira 24 h']
};
var CUPO_RESPALDO_ACTIVA_H_ = 2;   // «se movió hace poco»: actividad en las últimas 2 h
/* Minutos de un intervalo: la propiedad del mismo nombre (si es un número ≥ 0) o el valor nuevo; CUPO_AHORRO = 0, el de antes. */
function cupoIntervalo_(nombre) {
  var x = CUPO_INTERVALOS_[nombre]; if (!x) return 0;
  try {
    var p = PropertiesService.getScriptProperties();
    if (p.getProperty('CUPO_AHORRO') === '0') return x[1];
    var v = p.getProperty(nombre);
    if (v !== null && v !== '' && !isNaN(Number(v)) && Number(v) >= 0) return Number(v);
  } catch (e) {}
  return x[0];
}
/* ¿El ahorro está prendido? (CUPO_AHORRO = 0 lo apaga: todo vuelve a como estaba antes del 14-nov). */
function cupoAhorro_() { try { return PropertiesService.getScriptProperties().getProperty('CUPO_AHORRO') !== '0'; } catch (e) { return true; } }

var CUPO_CTX_ = '';          // canal de esta ejecución (cupoCanal_)
var CUPO_FUNC_ = '';         // función de esta ejecución (cupoFuncion_): el detalle de «Uso» por función
var CUPO_MEMO_ = null;       // nivel ya calculado en esta ejecución
var CUPO_HORA_VISTA_ = '';   // hora ya revisada para el volcado en esta ejecución
var CUPO_EN_AVISO_ = false;  // el aviso también llama a internet: que no se vuelva a revisar a sí mismo

/* ── Las llamadas ── mismos argumentos que UrlFetchApp.fetch / fetchAll, más el canal (opcional). */
function uf_(url, opciones, canal) {
  cupoContar_(canal || cupoCanalDe_(url), 1);
  var r;
  try { r = opciones === undefined ? UrlFetchApp.fetch(url) : UrlFetchApp.fetch(url, opciones); }
  catch (e) { if (cupoSinGoogle_(e)) cupoAgotadoMarcar_(); throw e; }
  if (CUPO_AGOTADO_VISTO_) cupoAgotadoQuitar_();   // salió bien: Google ya volvió a dejar
  return r;
}
function ufAll_(pedidos, canal) {
  var lista = pedidos || [];
  if (lista.length) cupoContar_(canal || cupoCanalDe_(typeof lista[0] === 'string' ? lista[0] : lista[0].url), lista.length);   // fetchAll cuenta N
  var r;
  try { r = UrlFetchApp.fetchAll(lista); }
  catch (e) { if (cupoSinGoogle_(e)) cupoAgotadoMarcar_(); throw e; }
  if (CUPO_AGOTADO_VISTO_ && lista.length) cupoAgotadoQuitar_();
  return r;
}

/* ── Cupo agotado (#737) ── Google dijo que no hay más llamadas a internet por hoy. */
var CUPO_AGOTADO_VISTO_ = false;   // la caché dice que está agotado (lo lee cupoContar_ junto con su clave, sin lecturas extra)
var CUPO_AGOTADO_HECHO_ = false;   // ya se marcó en esta ejecución: no se repite
var CUPO_VISTO_MIN_ = 5000;        // el límite aprendido nunca baja de esto (un contador que perdió horas no apaga todo)
function cupoSinGoogle_(e) { var m = String((e && e.message) || e || ''); return /too many times/i.test(m) && /urlfetch/i.test(m); }
function cupoAgotadoMarcar_() {
  if (CUPO_AGOTADO_HECHO_) return; CUPO_AGOTADO_HECHO_ = true; CUPO_AGOTADO_VISTO_ = true;
  try {
    var c = CacheService.getScriptCache(); if (c.get('cupo_agotado')) return;   // otra ejecución ya lo marcó
    c.put('cupo_agotado', String(Date.now()), 21600); c.remove('cupo_nivel'); CUPO_MEMO_ = null;
    var p = PropertiesService.getScriptProperties(), usado = 0;
    try { var desde = Date.now() - 24 * 3600000, horas = cupoLeer_(desde); cupoSumarApps_(horas, desde); usado = cupoSuma_(horas, desde + 1); } catch (x) {}
    var hora = Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm');
    p.setProperty('CUPO_AGOTADO', JSON.stringify({ ts: new Date().toISOString(), hora: hora, contado: usado }));
    if (usado >= CUPO_VISTO_MIN_) p.setProperty('CUPO_DIA_VISTO', String(usado));
    cupoAvisar_('Google se quedó sin cupo de llamadas a internet a las ' + hora + ' (el Hub llevaba ' + usado + ' contadas). Mientras vuelve, nada sale a internet: '
      + 'la voz de Alma no conecta y WhatsApp y Hospitable no reciben respuestas. No es el Modo Inicio. Pausé lo de fondo; todo vuelve solo en cuanto Google lo reinicie.', false);
  } catch (e) { console.warn('cupoAgotadoMarcar_: ' + e); }
}
function cupoAgotadoQuitar_() {
  CUPO_AGOTADO_VISTO_ = false; CUPO_AGOTADO_HECHO_ = false;
  try { var c = CacheService.getScriptCache(); c.remove('cupo_agotado'); c.remove('cupo_nivel'); CUPO_MEMO_ = null; } catch (e) { console.warn('cupoAgotadoQuitar_: ' + e); }
}
/* ¿Google cortó hace poco? Lo mira la ficha de la voz antes de pedir nada. */
function cupoAgotado_() { if (CUPO_AGOTADO_VISTO_) return true; try { return !!CacheService.getScriptCache().get('cupo_agotado'); } catch (e) { return false; } }
/* El canal de la ejecución: lo ponen doPost, hubApi_ y los activadores. */
function cupoCanal_(nombre) { CUPO_CTX_ = cupoNombre_(nombre); }
/* La función que está gastando ahora (un paso de procesarCola, el webhook, una acción del Hub, un activador). */
function cupoFuncion_(nombre) { CUPO_FUNC_ = String(nombre || '').slice(0, 60); }
function cupoCanalAccion_(accion) {
  var a = ' ' + String(accion || '') + ' ', ids = Object.keys(CUPO_ACCIONES_);
  for (var i = 0; i < ids.length; i++) if ((' ' + CUPO_ACCIONES_[ids[i]] + ' ').indexOf(a) >= 0) return cupoNombre_(ids[i]);
  return 'Otros';
}
function cupoCanalDe_(url) {
  var u = String(url || '');
  var login = typeof LOGIN_URL_ !== 'undefined' ? LOGIN_URL_.replace(/^.*\/s\/([^\/]+)\/.*$/, '$1') : '';
  if (login && u.indexOf(login) >= 0) return 'Login';   // el login siempre es «Login», venga de donde venga
  if (CUPO_CTX_) return CUPO_CTX_;
  var host = (/^https?:\/\/([^\/?#]+)/i.exec(u) || [])[1] || '';
  if (/hospitable/i.test(host)) return 'Huéspedes';
  if (/graph\.facebook\.com/i.test(host)) return 'WhatsApp';
  if (/api\.anthropic\.com/i.test(host)) return 'IA · Claude';
  if (/elevenlabs/i.test(host)) return 'Voz';
  if (/aiplatform|bigquery|^www\.googleapis\.com|oauth2\.googleapis\.com/i.test(host)) return 'Cerebro';
  if (/script\.google(usercontent)?\.com/i.test(host)) return 'Otras apps';
  return 'Otros';
}
/* Nombre o id → nombre del canal (lo desconocido, «Otros»). */
function cupoNombre_(x) {
  x = String(x || '');
  for (var i = 0; i < CUPO_CANALES_.length; i++) if (CUPO_CANALES_[i][0] === x || CUPO_CANALES_[i][1] === x) return CUPO_CANALES_[i][1];
  return 'Otros';
}
function cupoId_(nombre) {
  nombre = cupoNombre_(nombre);
  for (var i = 0; i < CUPO_CANALES_.length; i++) if (CUPO_CANALES_[i][1] === nombre) return CUPO_CANALES_[i][0];
  return 'otros';
}
function cupoHora_(ms) { return Utilities.formatDate(new Date(ms), CFG.TZ, 'yyyyMMddHH'); }
function cupoInicioHora_(ms) { return Math.floor(ms / 3600000) * 3600000; }   // Guatemala va en horas enteras respecto a UTC
/* CUPO_DIA si Juan lo puso; si no, lo que el Hub había contado cuando Google cortó (CUPO_DIA_VISTO, #737), si es menor. */
function cupoLimite_() {
  var p = PropertiesService.getScriptProperties(), n = Number(p.getProperty('CUPO_DIA') || 0); if (n > 0) return n;
  var v = Number(p.getProperty('CUPO_DIA_VISTO') || 0);
  return v >= CUPO_VISTO_MIN_ && v < CUPO_LIMITE_DEF_ ? v : CUPO_LIMITE_DEF_;
}

/* ── El contador ── barato: una lectura y una escritura de caché por llamada (el canal y la función van juntos con
   getAll/putAll); nunca rompe la llamada. */
function cupoContar_(canal, n) {
  try {
    var c = CacheService.getScriptCache(), hora = cupoHora_(Date.now()), k = 'cupo_' + hora + '_' + cupoId_(canal), kf = 'cupo_' + hora + '_fn';
    var v = c.getAll([k, kf, 'cupo_agotado']), F = {}, nom = cupoNombre_(canal), fn = CUPO_FUNC_ || 'otra', put = {};
    try { F = JSON.parse(v[kf] || '{}') || {}; } catch (e) { F = {}; }
    F[nom] = F[nom] || {}; F[nom][fn] = (Number(F[nom][fn]) || 0) + (n || 1);
    put[k] = String(Number(v[k] || 0) + (n || 1)); put[kf] = JSON.stringify(F);
    CUPO_AGOTADO_VISTO_ = !!v['cupo_agotado'];
    c.putAll(put, 21600);
    if (CUPO_HORA_VISTA_ !== hora) {   // la primera llamada de la hora vuelca las horas que ya cerraron
      CUPO_HORA_VISTA_ = hora;
      if (c.get('cupo_hora') !== hora) { c.put('cupo_hora', hora, 21600); cupoVolcar_(); }
    }
  } catch (e) { console.warn('cupoContar_: ' + e); }
}
/* Vuelca a GOOGLE_USO las últimas horas cerradas que aún no estén en la hoja (las de la caché duran 6 h). */
function cupoVolcar_() {
  try {
    var c = CacheService.getScriptCache(), ahora = Date.now(), filas = [], filasF = [];
    for (var i = 1; i <= 5; i++) {
      var ms = ahora - i * 3600000, hora = cupoHora_(ms);
      if (c.get('cupo_v_' + hora)) continue;
      c.put('cupo_v_' + hora, '1', 21600);   // primero la marca: otra ejecución no la vuelca dos veces
      var claves = CUPO_CANALES_.map(function (x) { return 'cupo_' + hora + '_' + x[0]; }), kf = 'cupo_' + hora + '_fn', v = c.getAll(claves.concat([kf]));
      var etiqueta = hora.slice(0, 4) + '-' + hora.slice(4, 6) + '-' + hora.slice(6, 8) + ' ' + hora.slice(8, 10) + ':00';
      CUPO_CANALES_.forEach(function (x, j) {
        var n = Number(v[claves[j]] || 0);
        if (n > 0) filas.push([etiqueta, x[1], n, cupoInicioHora_(ms)]);
      });
      var F = {}; try { F = JSON.parse(v[kf] || '{}') || {}; } catch (e) { F = {}; }
      Object.keys(F).forEach(function (canal) { Object.keys(F[canal] || {}).forEach(function (fn) { var n = Number(F[canal][fn]) || 0; if (n > 0) filasF.push([etiqueta, canal, fn, n, cupoInicioHora_(ms)]); }); });
    }
    if (filasF.length) {   // el detalle por función, en su propia hoja: no suma al total (ese sale de los canales)
      var shF = hojaCrear_(CUPO_FUNC_HOJA_, CUPO_FUNC_CAB_);
      shF.getRange(shF.getLastRow() + 1, 1, filasF.length, CUPO_FUNC_CAB_.length).setValues(filasF);
      if (shF.getLastRow() > 30000) shF.deleteRows(2, 6000);
    }
    if (!filas.length) return 0;
    var sh = hojaCrear_(CUPO_HOJA_, CUPO_CAB_);
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, CUPO_CAB_.length).setValues(filas);
    if (sh.getLastRow() > 9000) sh.deleteRows(2, 2000);   // ~40 días bastan
    return filas.length;
  } catch (e) { console.warn('cupoVolcar_: ' + e); return 0; }
}
/* Llamadas por hora desde «desde» (ms): { inicio_ms: { canal: n } }. La hoja para las horas volcadas y la caché para
   la hora actual y las que aún no están en la hoja. */
function cupoLeer_(desde) {
  var horas = {}, ahora = Date.now();
  try {
    var sh = ssAlma_().getSheetByName(CUPO_HOJA_);
    if (sh && sh.getLastRow() >= 2) {
      var n = sh.getLastRow(), ini = Math.max(2, n - 4000);
      sh.getRange(ini, 1, n - ini + 1, CUPO_CAB_.length).getValues().forEach(function (v) {
        var t = Number(v[3]) || 0; if (t < cupoInicioHora_(desde)) return;
        var H = horas[t] = horas[t] || {}, k = cupoNombre_(v[1]); H[k] = (H[k] || 0) + (Number(v[2]) || 0);
      });
    }
  } catch (e) { console.warn('cupoLeer_ hoja: ' + e); }
  try {
    var c = CacheService.getScriptCache();
    for (var i = 0; i <= 5; i++) {
      var ms = ahora - i * 3600000, t = cupoInicioHora_(ms); if (t < cupoInicioHora_(desde) || horas[t]) continue;   // ya está en la hoja
      var hora = cupoHora_(ms), claves = CUPO_CANALES_.map(function (x) { return 'cupo_' + hora + '_' + x[0]; }), v = c.getAll(claves), H = {};
      CUPO_CANALES_.forEach(function (x, j) { var n = Number(v[claves[j]] || 0); if (n) H[x[1]] = n; });
      if (Object.keys(H).length) horas[t] = H;
    }
  } catch (e) { console.warn('cupoLeer_ caché: ' + e); }
  return horas;
}
/* Lo mismo por función: { inicio_ms: { canal: { función: n } } } (GOOGLE_USO_FUNCION y la caché de las horas sin volcar). */
function cupoLeerFunciones_(desde) {
  var horas = {}, ahora = Date.now(), ini = cupoInicioHora_(desde);
  var sumar = function (t, canal, fn, n) { var H = horas[t] = horas[t] || {}, C = H[canal] = H[canal] || {}; C[fn] = (C[fn] || 0) + n; };
  try {
    var sh = ssAlma_().getSheetByName(CUPO_FUNC_HOJA_);
    if (sh && sh.getLastRow() >= 2) {
      var n = sh.getLastRow(), i0 = Math.max(2, n - 12000);
      sh.getRange(i0, 1, n - i0 + 1, CUPO_FUNC_CAB_.length).getValues().forEach(function (v) {
        var t = Number(v[4]) || 0; if (t < ini) return; sumar(t, String(v[1]), String(v[2]), Number(v[3]) || 0);
      });
    }
  } catch (e) { console.warn('cupoLeerFunciones_ hoja: ' + e); }
  try {
    var c = CacheService.getScriptCache();
    for (var i = 0; i <= 5; i++) {
      var ms = ahora - i * 3600000, t = cupoInicioHora_(ms); if (t < ini || horas[t]) continue;   // ya está en la hoja
      var F = {}; try { F = JSON.parse(c.get('cupo_' + cupoHora_(ms) + '_fn') || '{}') || {}; } catch (e) { F = {}; }
      Object.keys(F).forEach(function (canal) { Object.keys(F[canal] || {}).forEach(function (fn) { var n = Number(F[canal][fn]) || 0; if (n > 0) sumar(t, canal, fn, n); }); });
    }
  } catch (e) { console.warn('cupoLeerFunciones_ caché: ' + e); }
  return horas;
}
/* Las funciones que más gastan desde «desde»: [{ canal, funcion, llamadas }], de mayor a menor. */
function cupoTopFunciones_(horas, desde, max) {
  var m = {};
  Object.keys(horas).forEach(function (t) {
    if (Number(t) < desde) return;
    Object.keys(horas[t]).forEach(function (canal) { Object.keys(horas[t][canal]).forEach(function (fn) { var k = canal + '\u0001' + fn; m[k] = (m[k] || 0) + horas[t][canal][fn]; }); });
  });
  return Object.keys(m).map(function (k) { var p = k.split('\u0001'); return { canal: p[0], funcion: p[1], llamadas: m[k] }; })
    .sort(function (a, b) { return b.llamadas - a.llamadas; }).slice(0, max || 30);
}
function cupoSuma_(horas, desde, hasta) {
  var s = 0; Object.keys(horas).forEach(function (t) { t = Number(t); if (t >= desde && (hasta == null || t < hasta)) Object.keys(horas[t]).forEach(function (k) { s += horas[t][k]; }); });
  return s;
}
/* Las cuentas del día: últimas 24 h (para el nivel) y día calendario de Guatemala (para mostrar). */
function cupoCalcular_(horas) {
  var ahora = Date.now(), limite = cupoLimite_(), horaIni = cupoInicioHora_(ahora);
  var hDia = Number(Utilities.formatDate(new Date(ahora), CFG.TZ, 'H')), minFr = (ahora - horaIni) / 3600000;
  var hoyIni = horaIni - hDia * 3600000, finDia = hoyIni + 86400000, horasHoy = Math.max(0.25, hDia + minFr);
  var usado24 = cupoSuma_(horas, ahora - 24 * 3600000 + 1), usadoHoy = cupoSuma_(horas, hoyIni);
  var reciente = cupoSuma_(horas, horaIni - 2 * 3600000), ritmo = reciente / Math.max(0.25, 2 + minFr);   // llamadas por hora, últimas ~3 h
  var proyFin = Math.round(usadoHoy + ritmo * Math.max(0, (finDia - ahora) / 3600000));
  var pct = Math.round(1000 * usado24 / limite) / 10, restante = Math.max(0, limite - usado24), agotaMs = ritmo > 0 ? ahora + restante / ritmo * 3600000 : 0;
  return { pct: pct, nivel: pct >= CUPO_CRITICO_PCT_ ? 'critico' : pct >= CUPO_FONDO_PCT_ ? 'fondo' : 'verde', limite: limite, usado24: usado24, restante: restante,
    usado: usadoHoy, pctHoy: Math.round(1000 * usadoHoy / limite) / 10, porHora: Math.round(usadoHoy / horasHoy), ritmo: Math.round(ritmo),
    proyeccionFinDia: proyFin, proyeccion: Math.round(1000 * proyFin / limite) / 10,
    horaAgotado: agotaMs && agotaMs < finDia ? Utilities.formatDate(new Date(agotaMs), CFG.TZ, 'HH:mm') : '', alcanza: !(agotaMs && agotaMs < finDia),
    hoyIni: hoyIni, ts: ahora };
}
/* { pct, nivel: 'verde'|'fondo'|'critico', proyeccion, … } con lo usado en las últimas 24 h. Cacheado 5 min. */
function cupoNivel_() {
  if (CUPO_MEMO_) return CUPO_MEMO_;
  var c = CacheService.getScriptCache(), h = null;
  try { h = JSON.parse(c.get('cupo_nivel') || 'null'); } catch (e) {}
  if (h) return (CUPO_MEMO_ = h);
  var desde = Date.now() - 24 * 3600000, horas = cupoLeer_(desde);
  cupoSumarApps_(horas, desde);   // el cupo es de la cuenta: también lo de Hola, Epi, Grow, Docs y Mi
  var o = cupoCalcular_(horas);
  if (cupoAgotado_()) o.nivel = 'agotado';   // Google ya cortó: manda sobre lo contado
  try { c.put('cupo_nivel', JSON.stringify(o), 300); } catch (e) {}
  CUPO_MEMO_ = o;
  try { cupoAvisarSiToca_(o); } catch (e) { console.warn('cupoAvisarSiToca_: ' + e); }
  return o;
}
/* ¿Se puede gastar en esto ahora? Lo de CUPO_NUNCA_ siempre; «fondo» solo en verde; «alma» (voz y chat) salvo en crítico.
   Si algo falla al medir, deja pasar: un contador roto no debe apagar a Alma. */
function cupoPermite_(que) {
  if (CUPO_NUNCA_.indexOf(que) >= 0) return true;
  var pausa = CUPO_PAUSAS_[que]; if (!pausa) return true;
  try {
    if (PropertiesService.getScriptProperties().getProperty('CUPO_PAUSAR') === '0') return true;
    return pausa.indexOf(cupoNivel_().nivel) < 0;
  } catch (e) { return true; }
}

/* ── Avisos a Juan ── al cambiar de nivel y cuando la proyección del día pasa el 80 %; una vez por nivel por día. */
function cupoAvisarSiToca_(o) {
  if (CUPO_EN_AVISO_) return;
  var p = PropertiesService.getScriptProperties(), dia = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), e = {};
  try { e = JSON.parse(p.getProperty('CUPO_ESTADO') || '{}') || {}; } catch (x) {}
  if (e.dia !== dia) { e.dia = dia; e.avisados = []; }
  e.avisados = e.avisados || [];
  var texto = '', critico = false, cambio = false;
  if (o.nivel !== (e.nivel || 'verde')) {
    cambio = true;
    if (o.nivel === 'agotado') { /* el aviso ya salió al marcarlo (cupoAgotadoMarcar_) */ }
    else if (e.avisados.indexOf(o.nivel) < 0) {
      e.avisados.push(o.nivel);
      if (o.nivel === 'critico') { critico = true; texto = 'El cupo de Google va en ' + Math.round(o.pct) + ' %. Pausé lo de fondo; la voz y el chat de Alma siguen. Huéspedes, entrar, documentos, Epi y limpieza siguen normal.'; }
      else if (o.nivel === 'fondo') texto = 'El cupo de Google va en ' + Math.round(o.pct) + ' %. Pausé lo de fondo (cerebro, mejoras y sincronizaciones). Huéspedes, entrar, documentos, Epi y limpieza siguen normal.';
      else texto = 'El cupo de Google volvió a estar bien (' + Math.round(o.pct) + ' %). Ya corre todo otra vez.';
    }
    e.nivel = o.nivel;
  }
  if (!texto && o.nivel !== 'agotado' && o.proyeccion >= CUPO_PROY_PCT_ && e.avisados.indexOf('proyeccion') < 0) {
    e.avisados.push('proyeccion');
    texto = o.horaAgotado ? 'A este ritmo, el cupo de Google de hoy se acaba cerca de las ' + o.horaAgotado + '. Mira qué lo gasta en Ajustes → Uso.'
      : 'A este ritmo, el cupo de Google de hoy va a pasar el ' + CUPO_PROY_PCT_ + ' %. Mira qué lo gasta en Ajustes → Uso.';
  }
  if (!texto && !cambio) return;
  p.setProperty('CUPO_ESTADO', JSON.stringify(e));
  if (texto) cupoAvisar_(texto, critico);
}
function cupoAvisar_(texto, critico) {
  CUPO_EN_AVISO_ = true;
  try {
    var adm = agPrincipal_(); if (!adm || !adm.email) return;
    /* En Notificaciones, sin pasar por la IA (la clasificación ya está hecha). */
    pendAvisar_(adm, texto, { origen: 'cupo', push: false, clasif: { tipo: 'aviso', area: 'proposito', proyecto: 'Spacio AM', titulo: 'Cupo de Google', resumen: texto, aviso: texto, importancia: critico ? 3 : 2, tarjeta: null, acciones: [] } });
    try { pushA_([adm.email], 'Cupo de Google', texto, CFG.HUB_URL + '/alma/uso.html', { origen: 'cupo' }); } catch (e) { console.warn('cupo push: ' + e); }
    if (critico && adm.tels && adm.tels[0]) { try { waEnviar_(adm.tels[0], 'Alma · ' + texto); } catch (e) { console.warn('cupo WhatsApp: ' + e); } }
  } catch (e) { console.warn('cupoAvisar_: ' + e); } finally { CUPO_EN_AVISO_ = false; }
}

/* ── Página «Uso» (alma/uso.html) ── solo el administrador principal. */
function cupoUso_(ses) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal puede ver el uso.' };
  var ahora = Date.now(), horas = cupoLeer_(ahora - 7 * 86400000), sinDatos = cupoSumarApps_(horas, ahora - 7 * 86400000), o = cupoCalcular_(horas);
  var porCanal = function (desde) {
    var m = {}; Object.keys(horas).forEach(function (t) { if (Number(t) >= desde) Object.keys(horas[t]).forEach(function (k) { m[k] = (m[k] || 0) + horas[t][k]; }); });
    return Object.keys(m).map(function (k) { return { canal: k, llamadas: m[k] }; }).sort(function (a, b) { return b.llamadas - a.llamadas; });
  };
  var horaIni = cupoInicioHora_(ahora), lineaHoy = [];
  for (var t = o.hoyIni; t <= horaIni; t += 3600000) lineaHoy.push({ hora: Utilities.formatDate(new Date(t), CFG.TZ, 'HH'), llamadas: cupoSuma_(horas, t, t + 3600000) });
  return { ok: true, actualizado: new Date(ahora).toISOString(),
    hoy: { usado: o.usado, limite: o.limite, pct: o.pctHoy, restante: Math.max(0, o.limite - o.usado), porHora: o.porHora, ritmo: o.ritmo, proyeccionFinDia: o.proyeccionFinDia,
      proyeccionPct: o.proyeccion, horaAgotado: o.horaAgotado, alcanza: o.alcanza, nivel: o.nivel, usado24: o.usado24, pct24: o.pct },
    porHora: lineaHoy, canales: { hoy: porCanal(o.hoyIni), semana: porCanal(ahora - 7 * 86400000) }, ia: cupoIA_(o.hoyIni), sinDatos: sinDatos,
    funciones: (function () { var F = cupoLeerFunciones_(ahora - 7 * 86400000); return { hoy: cupoTopFunciones_(F, o.hoyIni, 30), semana: cupoTopFunciones_(F, ahora - 7 * 86400000, 30) }; })(),
    niveles: [
      { nivel: 'verde', desde: 0, texto: 'Todo corre normal.' },
      { nivel: 'fondo', desde: CUPO_FONDO_PCT_, texto: 'Se pausa lo de fondo: cerebro, mejoras y sincronizaciones.' },
      { nivel: 'critico', desde: CUPO_CRITICO_PCT_, texto: 'Lo de fondo sigue en pausa; la voz y el chat de Alma siguen.' },
      { nivel: 'agotado', desde: 100, texto: 'Google ya no deja llamar a internet: la voz de Alma no conecta hasta que lo reinicie. Lo contado ese día queda como el límite.' }
    ],
    agotado: (function () { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CUPO_AGOTADO') || 'null'); } catch (e) { return null; } })(),
    nunca: 'Nunca se pausa: entrar, responder a huéspedes, documentos, Epi y las rutas de limpieza.',
    pausas: PropertiesService.getScriptProperties().getProperty('CUPO_PAUSAR') !== '0' };
}
/* ── Para Alma (herramienta cupo_google, agente.js) ── «¿cómo estamos con los cupos de Google?» por voz o chat, solo el
   principal. Lo mismo que «Uso» pero corto: nivel, % de las últimas 24 h, lo de hoy, la proyección y qué más gasta
   (por canal y, desde el ahorro del 14-nov, por función), y si el ahorro está prendido. */
function cupoParaAlma_(adm) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal ve el cupo de Google.' };
  var ahora = Date.now(), desde = ahora - 24 * 3600000, horas = cupoLeer_(desde), sinDatos = cupoSumarApps_(horas, desde), o = cupoCalcular_(horas), m = {};
  Object.keys(horas).forEach(function (t) { if (Number(t) >= o.hoyIni) Object.keys(horas[t]).forEach(function (k) { m[k] = (m[k] || 0) + horas[t][k]; }); });
  var top = Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 3).map(function (k) { return { canal: k, llamadas: m[k] }; });
  var NIV = { agotado: 'agotado: Google ya no deja llamar a internet hasta que lo reinicie', verde: 'bien: todo corre normal', fondo: 'en riesgo: lo de fondo (cerebro, mejoras y sincronizaciones) está en pausa', critico: 'crítico: lo de fondo en pausa; la voz y el chat de Alma siguen' };
  return { ok: true, nivel: o.nivel, como_va: NIV[o.nivel], pct_24h: o.pct, usado_24h: o.usado24, limite_dia: o.limite, restante: o.restante,
    hoy: { usado: o.usado, pct: o.pctHoy, proyeccion_fin_dia_pct: o.proyeccion, se_acaba_hoy_cerca_de: o.horaAgotado || '', alcanza: o.alcanza },
    lo_que_mas_gasta_hoy: top, funciones_que_mas_gastan_hoy: cupoTopFunciones_(cupoLeerFunciones_(o.hoyIni), o.hoyIni, 3), sin_datos_de: sinDatos,
    pausas: PropertiesService.getScriptProperties().getProperty('CUPO_PAUSAR') !== '0', ahorro: cupoAhorro_(),
    nota: 'Dilo simple: «vamos en X % del cupo de hoy, estamos bien / en riesgo» y, si preguntan, qué más gasta. El detalle está en Ajustes → Uso.' };
}
/* ── Las otras apps ── { horas: { inicio_ms: { 'App Hola': n, … } }, sinDatos: ['Grow', …] }. Cada app guarda 48 h.
   Cacheado CUPO_APPS_MIN (60 min; antes 15), también si alguna no contestó: no se reintenta en cada llamada. */
function cupoApps_() {
  var c = CacheService.getScriptCache(), h = null;
  try { h = JSON.parse(c.get('cupo_apps') || 'null'); } catch (e) {}
  if (h) return h;
  var out = { horas: {}, sinDatos: [] }, llave = llaveRobot_(), rs = [], fn0 = CUPO_FUNC_;
  if (llave) {
    cupoFuncion_('cupoApps_');   // se cuenta como suya, no como el paso de procesarCola que preguntó el nivel
    try {
      rs = ufAll_(CUPO_APPS_.map(function (a) {
        return { url: ACCESOS_APPS_[a[0]](), method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: JSON.stringify({ action: '__cupo', token: llave }) };
      }), 'Otras apps');
    } catch (e) { console.warn('cupoApps_: ' + e); rs = []; }
    CUPO_FUNC_ = fn0;
  }
  CUPO_APPS_.forEach(function (a, i) {
    var j = null;
    try { j = rs[i] && rs[i].getResponseCode() === 200 ? JSON.parse(rs[i].getContentText() || '{}') : null; } catch (e) { j = null; }
    if (!j || !j.ok || !j.horas || typeof j.horas !== 'object') { out.sinDatos.push(a[1]); return; }
    Object.keys(j.horas).forEach(function (k) {
      var n = Number(j.horas[k]) || 0; if (!(n > 0) || !/^\d{10}$/.test(k)) return;
      var t; try { t = Utilities.parseDate(k, CFG.TZ, 'yyyyMMddHH').getTime(); } catch (e) { return; }
      var H = out.horas[t] = out.horas[t] || {}; H[a[2]] = (H[a[2]] || 0) + n;
    });
  });
  try { c.put('cupo_apps', JSON.stringify(out), Math.max(60, Math.min(21600, Math.round(cupoIntervalo_('CUPO_APPS_MIN') * 60)))); } catch (e) {}
  return out;
}
/* Suma lo de las otras apps a «horas» (de cupoLeer_) desde «desde» (ms). Devuelve las que no contestaron. */
function cupoSumarApps_(horas, desde) {
  try {
    var A = cupoApps_(), ini = cupoInicioHora_(desde);
    Object.keys(A.horas || {}).forEach(function (t) {
      if (Number(t) < ini) return;
      var H = horas[t] = horas[t] || {};
      Object.keys(A.horas[t]).forEach(function (k) { H[k] = (H[k] || 0) + A.horas[t][k]; });
    });
    return A.sinDatos || [];
  } catch (e) { console.warn('cupoSumarApps_: ' + e); return CUPO_APPS_.map(function (a) { return a[1]; }); }
}
/* La IA (hoja IA_USO, la misma de usoIA y del reporte mensual): dólares y tokens por app · función, hoy y 7 días. */
function cupoIA_(hoyIni) {
  var desde = Date.now() - 7 * 86400000, H = {}, S = {}, tot = { hoy: { usd: 0, tokens: 0, n: 0 }, semana: { usd: 0, tokens: 0, n: 0 } };
  try {
    var sh = ssAlma_().getSheetByName('IA_USO');
    if (sh && sh.getLastRow() >= 2) {
      var n = sh.getLastRow(), ini = Math.max(2, n - 20000);
      sh.getRange(ini, 1, n - ini + 1, USO_CAB_.length).getValues().forEach(function (v) {
        var t = v[0] instanceof Date ? v[0].getTime() : Date.parse(v[0]); if (!(t >= desde)) return;
        var k = String(v[1] || 'ALMA') + ' · ' + String(v[2] || 'Otro'), usd = +v[10] || 0, tok = (+v[6] || 0) + (+v[7] || 0) + (+v[8] || 0) + (+v[9] || 0);
        var sumar = function (M, T) { var x = M[k] = M[k] || { nombre: k, usd: 0, tokens: 0, n: 0 }; x.usd += usd; x.tokens += tok; x.n++; T.usd += usd; T.tokens += tok; T.n++; };
        sumar(S, tot.semana); if (t >= hoyIni) sumar(H, tot.hoy);
      });
    }
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
  var r4 = function (x) { return Math.round(x * 1e4) / 1e4; };
  var lista = function (M) { return Object.keys(M).map(function (k) { var x = M[k]; return { nombre: x.nombre, usd: r4(x.usd), tokens: x.tokens, n: x.n }; }).sort(function (a, b) { return b.usd - a.usd; }).slice(0, 12); };
  tot.hoy.usd = r4(tot.hoy.usd); tot.semana.usd = r4(tot.semana.usd);
  return { ok: true, hoy: Object.assign(tot.hoy, { funciones: lista(H) }), semana: Object.assign(tot.semana, { funciones: lista(S) }) };
}
