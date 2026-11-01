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
   · Niveles (T3): verde · fondo (≥ 60 %: se pausa lo de fondo) · crítico (≥ 85 %: también la voz y el chat de Alma).
     CUPO_NUNCA_ es lo que nunca se pausa. CUPO_PAUSAR = 0 apaga las pausas (solo cuenta). Aviso a Juan al cambiar de
     nivel y cuando la proyección del día pasa el 80 %, una vez por nivel por día.
   · Página «Uso» (T4): acción «uso» del Hub, solo el administrador principal → alma/uso.html.
   · Las otras apps (T2): Hola, Epi, Grow, Docs y Mi cuentan las suyas (su propio cupo.js) y las dan con la acción
     «__cupo» y la llave del robot. cupoApps_ las lee cada 15 min (canal «Otras apps») y se suman al nivel, a la
     proyección y a «Uso» como canales «App Hola», «App Epi»… (los canales «Hola» y «Epi» son lo que el Hub les pide).
     Si una app no contesta, se ignora y «Uso» lo dice (sinDatos). */

var CUPO_LIMITE_DEF_ = 20000;
var CUPO_HOJA_ = 'GOOGLE_USO';
var CUPO_CAB_ = ['hora', 'canal', 'llamadas', 'inicio_ms'];
var CUPO_FONDO_PCT_ = 60, CUPO_CRITICO_PCT_ = 85, CUPO_PROY_PCT_ = 80;
/* Los canales (id corto para la clave de caché · nombre que ve Juan). Un canal desconocido cuenta como «Otros». */
var CUPO_CANALES_ = [
  ['inicio', 'Modo inicio'], ['chat', 'Chat de Alma'], ['voz', 'Voz'], ['huespedes', 'Huéspedes'], ['whatsapp', 'WhatsApp'],
  ['cerebro', 'Cerebro'], ['fondo', 'Mejoras y fondo'], ['login', 'Login'], ['hola', 'Hola'], ['epi', 'Epi'],
  ['apps', 'Otras apps'], ['ia', 'IA · Claude'], ['otros', 'Otros']
];
/* Las otras apps: id en ACCESOS_APPS_ (Código.js) · nombre corto (aviso «Sin datos de: …») · canal en «Uso». */
var CUPO_APPS_ = [['hola', 'Hola', 'App Hola'], ['epi', 'Epi', 'App Epi'], ['grow', 'Grow', 'App Grow'], ['docs', 'Docs', 'App Docs'], ['mi', 'Mi', 'App Mi']];
/* Lo que NUNCA se pausa, aunque el cupo esté en crítico (decisión de Juan): entrar y comprobar la sesión, responder a
   huéspedes (Hospitable y WhatsApp), descargar documentos, Epi y sus automatizaciones, y las rutas y asignaciones de
   limpieza. cupoPermite_ siempre dice que sí a estos. */
var CUPO_NUNCA_ = ['login', 'sesion', 'huespedes', 'documentos', 'epi', 'limpieza'];
/* Lo que sí se pausa y desde qué nivel. */
var CUPO_PAUSAS_ = { fondo: ['fondo', 'critico'], alma: ['critico'] };
/* Acciones del Hub que son «Alma en el chat o en la voz»: en crítico devuelven un aviso amable (nunca error 'session'). */
var CUPO_ACC_ALMA_ = ['opEnviar', 'almaFoto', 'vozWeb'];
var CUPO_PAUSA_ALMA_ = 'Alma está en pausa por cupo; vuelve en un rato.';
/* Canal de cada acción del Hub (hubApi_). Lo que no está aquí cuenta como «Otros». */
var CUPO_ACCIONES_ = {
  inicio: 'pendientes notificaciones areas areaMover pendienteResolver pendienteResponder pendienteNota pendienteHecho pendientesClaude unirPr vozAvisos tutoriales',
  chat: 'opEnviar opHilo opLista almaFoto mejorarCampo dictar plantillas',
  voz: 'vozWeb vozWebVincular conferencia conferenciaAudio reporteLlamadas',
  huespedes: 'responder responderWa adjunto hilo redactarHub cola reservaInfo programados programar adelantar cancelarProg editarProg setAuto setBorrador enviarAhora retener ' +
    'guestReview enviarReview reviewHuesped respuestaReview publicarRespuesta apelacionReview waNumeros resolver limpiezas pasos foto promesas promesaCerrar ajustarBorrador',
  cerebro: 'cerebro conexiones',
  fondo: 'mejoras automejora purgarAutomejora mejoraEditar mejoraEliminar mejoraVerificar proponerMejora prompts setPrompt agentes correos usoIA usoMensual uso ' +
    'setConocimiento setPropiedadDato dsPropuestas dsDecidir'
};

var CUPO_CTX_ = '';          // canal de esta ejecución (cupoCanal_)
var CUPO_MEMO_ = null;       // nivel ya calculado en esta ejecución
var CUPO_HORA_VISTA_ = '';   // hora ya revisada para el volcado en esta ejecución
var CUPO_EN_AVISO_ = false;  // el aviso también llama a internet: que no se vuelva a revisar a sí mismo

/* ── Las llamadas ── mismos argumentos que UrlFetchApp.fetch / fetchAll, más el canal (opcional). */
function uf_(url, opciones, canal) {
  cupoContar_(canal || cupoCanalDe_(url), 1);
  return opciones === undefined ? UrlFetchApp.fetch(url) : UrlFetchApp.fetch(url, opciones);
}
function ufAll_(pedidos, canal) {
  var lista = pedidos || [];
  if (lista.length) cupoContar_(canal || cupoCanalDe_(typeof lista[0] === 'string' ? lista[0] : lista[0].url), lista.length);   // fetchAll cuenta N
  return UrlFetchApp.fetchAll(lista);
}
/* El canal de la ejecución: lo ponen doPost, hubApi_ y los activadores. */
function cupoCanal_(nombre) { CUPO_CTX_ = cupoNombre_(nombre); }
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
function cupoLimite_() { var n = Number(PropertiesService.getScriptProperties().getProperty('CUPO_DIA') || 0); return n > 0 ? n : CUPO_LIMITE_DEF_; }

/* ── El contador ── barato: una lectura y una escritura de caché por llamada; nunca rompe la llamada. */
function cupoContar_(canal, n) {
  try {
    var c = CacheService.getScriptCache(), hora = cupoHora_(Date.now()), k = 'cupo_' + hora + '_' + cupoId_(canal);
    c.put(k, String(Number(c.get(k) || 0) + (n || 1)), 21600);
    if (CUPO_HORA_VISTA_ !== hora) {   // la primera llamada de la hora vuelca las horas que ya cerraron
      CUPO_HORA_VISTA_ = hora;
      if (c.get('cupo_hora') !== hora) { c.put('cupo_hora', hora, 21600); cupoVolcar_(); }
    }
  } catch (e) { console.warn('cupoContar_: ' + e); }
}
/* Vuelca a GOOGLE_USO las últimas horas cerradas que aún no estén en la hoja (las de la caché duran 6 h). */
function cupoVolcar_() {
  try {
    var c = CacheService.getScriptCache(), ahora = Date.now(), filas = [];
    for (var i = 1; i <= 5; i++) {
      var ms = ahora - i * 3600000, hora = cupoHora_(ms);
      if (c.get('cupo_v_' + hora)) continue;
      c.put('cupo_v_' + hora, '1', 21600);   // primero la marca: otra ejecución no la vuelca dos veces
      var claves = CUPO_CANALES_.map(function (x) { return 'cupo_' + hora + '_' + x[0]; }), v = c.getAll(claves);
      CUPO_CANALES_.forEach(function (x, j) {
        var n = Number(v[claves[j]] || 0);
        if (n > 0) filas.push([hora.slice(0, 4) + '-' + hora.slice(4, 6) + '-' + hora.slice(6, 8) + ' ' + hora.slice(8, 10) + ':00', x[1], n, cupoInicioHora_(ms)]);
      });
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
    if (e.avisados.indexOf(o.nivel) < 0) {
      e.avisados.push(o.nivel);
      if (o.nivel === 'critico') { critico = true; texto = 'El cupo de Google va en ' + Math.round(o.pct) + ' %. Pausé lo de fondo y también la voz y el chat de Alma un rato. Huéspedes, entrar, documentos, Epi y limpieza siguen normal.'; }
      else if (o.nivel === 'fondo') texto = 'El cupo de Google va en ' + Math.round(o.pct) + ' %. Pausé lo de fondo (cerebro, mejoras y sincronizaciones). Huéspedes, entrar, documentos, Epi y limpieza siguen normal.';
      else texto = 'El cupo de Google volvió a estar bien (' + Math.round(o.pct) + ' %). Ya corre todo otra vez.';
    }
    e.nivel = o.nivel;
  }
  if (!texto && o.proyeccion >= CUPO_PROY_PCT_ && e.avisados.indexOf('proyeccion') < 0) {
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
    try { pushA_([adm.email], 'Cupo de Google', texto, CFG.HUB_URL + '/alma/uso.html'); } catch (e) { console.warn('cupo push: ' + e); }
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
    niveles: [
      { nivel: 'verde', desde: 0, texto: 'Todo corre normal.' },
      { nivel: 'fondo', desde: CUPO_FONDO_PCT_, texto: 'Se pausa lo de fondo: cerebro, mejoras y sincronizaciones.' },
      { nivel: 'critico', desde: CUPO_CRITICO_PCT_, texto: 'También se pausan la voz y el chat de Alma.' }
    ],
    nunca: 'Nunca se pausa: entrar, responder a huéspedes, documentos, Epi y las rutas de limpieza.',
    pausas: PropertiesService.getScriptProperties().getProperty('CUPO_PAUSAR') !== '0' };
}
/* ── Las otras apps ── { horas: { inicio_ms: { 'App Hola': n, … } }, sinDatos: ['Grow', …] }. Cada app guarda 48 h.
   Cacheado 15 min (también si alguna no contestó: no se reintenta en cada llamada). */
function cupoApps_() {
  var c = CacheService.getScriptCache(), h = null;
  try { h = JSON.parse(c.get('cupo_apps') || 'null'); } catch (e) {}
  if (h) return h;
  var out = { horas: {}, sinDatos: [] }, llave = llaveRobot_(), rs = [];
  if (llave) {
    try {
      rs = ufAll_(CUPO_APPS_.map(function (a) {
        return { url: ACCESOS_APPS_[a[0]](), method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: JSON.stringify({ action: '__cupo', token: llave }) };
      }), 'Otras apps');
    } catch (e) { console.warn('cupoApps_: ' + e); rs = []; }
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
  try { c.put('cupo_apps', JSON.stringify(out), 900); } catch (e) {}
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
