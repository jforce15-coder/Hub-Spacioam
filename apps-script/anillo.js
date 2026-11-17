/* ═══ 21 · PRUEBA DEL ANILLO (QRing / Colmi) ═══════════════════════════════════════════════════════════════
   La página hub.spacioam.com/anillo/ (abierta en Bluefy, que sí deja usar Bluetooth en el iPhone) se conecta al anillo
   de Juan, lee su acelerómetro y lo que manda al tocarlo o girarlo, y guarda aquí lo que pasó para que Claude lo lea
   sin capturas. Solo es diagnóstico: no hay datos de nadie más, se limita el tamaño y la frecuencia, y se guarda en la
   hoja ALMA_ANILLO. Claude lo lee con el robot (dsBot · action «anillo»). */

var ANILLO_CAB_ = ['fecha', 'sesion', 'equipo', 'eventos'];
function anilloGuardar_(body) {
  var c = CacheService.getScriptCache(), k = 'anillo_rate_' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0);
  if (n > 40) return { ok: false, error: 'demasiados' };
  c.put(k, String(n + 1), 120);
  var ev = body.eventos; if (!Array.isArray(ev) || !ev.length) return { ok: true, vacio: true };
  var txt = JSON.stringify(ev.slice(0, 400)); if (txt.length > 45000) txt = txt.slice(0, 45000);
  try {
    hojaCrear_('ALMA_ANILLO', ANILLO_CAB_).appendRow([new Date().toISOString(), String(body.sesion || '').slice(0, 40), String(body.equipo || '').slice(0, 160), txt]);
  } catch (e) { return { ok: false, error: String(e) }; }
  return { ok: true };
}
/* Robot: las últimas filas (por defecto 30) para leer una prueba completa, los pasos de la voz de la app, el último
   Diagnóstico del anillo por Bluetooth de cada usuario (ble, abajo) y la última Lectura del anillo (resumen, abajo). */
function anilloLeer_(n) {
  var app = {}, ble = {}, res = {}; try { app = anilloPasosLeer_(); } catch (e) {} try { ble = anilloBleLeer_(); } catch (e) {}
  try { var tp = PropertiesService.getScriptProperties().getProperties(); Object.keys(tp).filter(function (k) { return k.indexOf('ANILLO_RES_') === 0; }).forEach(function (k) { try { res[k.slice(11)] = JSON.parse(tp[k]); } catch (e) {} }); } catch (e) {}
  var sh = ssAlma_().getSheetByName('ALMA_ANILLO'); if (!sh || sh.getLastRow() < 2) return { ok: true, filas: [], app: app, ble: ble, resumen: res };
  n = Math.min(200, Number(n) || 30);
  var desde = Math.max(2, sh.getLastRow() - n + 1);
  var v = sh.getRange(desde, 1, sh.getLastRow() - desde + 1, 4).getValues();
  return { ok: true, app: app, ble: ble, resumen: res, filas: v.map(function (r) { var e = []; try { e = JSON.parse(r[3]); } catch (x) {} return { fecha: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), sesion: String(r[1]), equipo: String(r[2]), eventos: e }; }) };
}

/* ── Los pasos de la voz de la app de Alma (Juan, 16-nov-2026: el anillo deja de responder y nadie sabía por qué) ──
   La app manda con vozAvisos (voz.js) los pasos nuevos de su voz («El anillo encendió el modo conferencia», «Otra app tomó
   el audio…»), ya sin datos personales (PasosAnillo.swift). Aquí se limpian otra vez y se guardan los últimos
   ANILLO_PASOS_MAX_ por usuario, con origen «app», en la propiedad ANILLO_APP_<clave> (la clave no es el correo). El robot
   los lee junto con las filas de ALMA_ANILLO (anilloLeer_, dsBot · action «anillo»). */
var ANILLO_PASOS_MAX_ = 30;
function anilloPasoLimpio_(t) {
  return String(t == null ? '' : t).replace(/«[^»]*»/g, '«…»').replace(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi, '(correo)')
    .replace(/https?:\/\/\S+/g, '(enlace)').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function anilloPasosGuardar_(adm, pasos, anillo) {
  if (!adm || !adm.email || !Array.isArray(pasos)) return 0;
  var nuevos = pasos.slice(-30).map(anilloPasoLimpio_).filter(Boolean); if (!nuevos.length) return 0;
  var p = PropertiesService.getScriptProperties(), k = 'ANILLO_APP_' + retClave_(adm).slice(8), l = [];
  try { l = JSON.parse(p.getProperty(k) || '[]') || []; } catch (e) {}
  var f = new Date().toISOString();
  nuevos.forEach(function (t) { l.push({ f: f, origen: 'app', anillo: anillo === true, paso: t }); });
  p.setProperty(k, JSON.stringify(l.slice(-ANILLO_PASOS_MAX_)));
  return nuevos.length;
}
function anilloPasosLeer_() {
  var t = PropertiesService.getScriptProperties().getProperties(), r = {};
  Object.keys(t).filter(function (k) { return k.indexOf('ANILLO_APP_') === 0; }).forEach(function (k) { try { r[k.slice(11)] = JSON.parse(t[k]); } catch (e) {} });
  return r;
}

/* ── Diagnóstico del anillo (Bluetooth) (Juan, 16-nov-2026, ticket #29 paso 1) ────────────────────────────────────────
   Hoy el anillo llega a la app como control de música y otra app de audio (Spotify) se lo quita. Juan aprobó leerlo directo
   por Bluetooth; antes hay que saber qué manda. En la app, Ajustes → Alma con el anillo → «Diagnóstico del anillo
   (Bluetooth)» (DiagnosticoAnillo.swift) se conecta, se suscribe a todo y anota lo que llega con las marcas de Juan
   («1 toque», «2 toques», «largo»). «Mandar al Hub» llega aquí (action anilloBle, con la sesión) y se guarda SOLO el último
   diagnóstico por usuario en la propiedad ANILLO_BLE_<clave> (la clave no es el correo), recortado para que quepa (una
   propiedad aguanta ~9 KB). El robot lo lee con «anillo» (anilloLeer_, campo ble) para mapear los toques (paso 2).
   Sin datos personales: solo los campos conocidos, sin correos, enlaces ni teléfonos, y el nombre del aparato se quita si
   lleva «de …» o «'s» (la app ya quita los que parecen de persona). */
var ANILLO_BLE_MAX_ = 8500;
function anilloBleTexto_(t, n) {
  return String(t == null ? '' : t).replace(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi, '(correo)').replace(/https?:\/\/\S+/g, '(enlace)')
    .replace(/\+?\d[\d \-]{6,}\d/g, '(número)').replace(/\s+/g, ' ').trim().slice(0, n || 60);
}
function anilloBleUuid_(t) { return String(t == null ? '' : t).toUpperCase().replace(/[^0-9A-F-]/g, '').slice(0, 36); }
function anilloBleHex_(t) { return String(t == null ? '' : t).toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 64); }
function anilloBleNum_(t) { var n = Number(t); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
/* Solo los campos conocidos del registro (DiagAnillo.registro en la app), cada uno limpio y con tope. */
function anilloBleOrdenar_(d) {
  var dp = d.dispositivo || {}, vd = d.veredicto || {}, nombre = anilloBleTexto_(dp.nombre, 40);
  if (/\sdel?\s|['’]s\b/i.test(' ' + nombre + ' ')) nombre = '(nombre quitado)';
  var claves = ['solo_hid', 'propio', 'estandar', 'nada'];
  return {
    v: 1, f: new Date().toISOString(), f_app: anilloBleTexto_(d.f, 30), app: anilloBleTexto_(d.app, 20),
    dispositivo: { nombre: nombre, fabricante: anilloBleTexto_(dp.fabricante, 40), modelo: anilloBleTexto_(dp.modelo, 40),
      firmware: anilloBleTexto_(dp.firmware, 40), senal: anilloBleNum_(dp.senal), porHID: dp.porHID === true },
    veredicto: { clave: claves.indexOf(vd.clave) >= 0 ? vd.clave : 'nada', texto: anilloBleTexto_(vd.texto, 240) },
    servicios: (Array.isArray(d.servicios) ? d.servicios : []).slice(0, 20).map(function (s) {
      return { uuid: anilloBleUuid_(s && s.uuid), nombre: anilloBleTexto_(s && s.nombre, 40), propio: !!(s && s.propio),
        car: (Array.isArray(s && s.car) ? s.car : []).slice(0, 20).map(function (c) {
          var o = { uuid: anilloBleUuid_(c && c.uuid), props: String((c && c.props) || '').replace(/[^a-zA-Z,]/g, '').slice(0, 40) };
          if (c && c.valor != null) o.valor = anilloBleHex_(c.valor);
          return o;
        }) };
    }),
    eventos: (Array.isArray(d.eventos) ? d.eventos : []).slice(-600).map(function (e) {
      return { t: anilloBleNum_(e && e.t), s: anilloBleUuid_(e && e.s), c: anilloBleUuid_(e && e.c), hex: anilloBleHex_(e && e.hex) };
    }),
    marcas: (Array.isArray(d.marcas) ? d.marcas : []).slice(-40).map(function (m) { return { t: anilloBleNum_(m && m.t), gesto: anilloBleTexto_(m && m.gesto, 20) }; }),
    sin_datos: Math.max(0, Math.round(Number(d.sin_datos) || 0)), recortados: Math.max(0, Math.round(Number(d.recortados) || 0))
  };
}
/* Que quepa: primero se van los datos más viejos (de a 10 %), luego los valores leídos, luego servicios. Las marcas y el
   veredicto se quedan. null si aun así no cabe. */
function anilloBleRecortar_(r) {
  var largo = function () { return JSON.stringify(r).length; };
  while (largo() > ANILLO_BLE_MAX_ && r.eventos.length) { var n = Math.max(1, Math.floor(r.eventos.length / 10)); r.eventos = r.eventos.slice(n); r.recortados += n; }
  if (largo() > ANILLO_BLE_MAX_) r.servicios.forEach(function (s) { s.car.forEach(function (c) { delete c.valor; }); });
  while (largo() > ANILLO_BLE_MAX_ && r.servicios.length) r.servicios.pop();
  return largo() > ANILLO_BLE_MAX_ ? null : r;
}
function anilloBleGuardar_(ses, body) {
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  var d = body && body.diagnostico; if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, error: 'vacio' };
  var c = CacheService.getScriptCache(), k = 'anillo_ble_' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0);
  if (n > 10) return { ok: false, error: 'demasiados' };
  c.put(k, String(n + 1), 120);
  var r = anilloBleRecortar_(anilloBleOrdenar_(d)); if (!r) return { ok: false, error: 'grande' };
  PropertiesService.getScriptProperties().setProperty('ANILLO_BLE_' + retClave_(adm).slice(8), JSON.stringify(r));
  return { ok: true, eventos: r.eventos.length, recortados: r.recortados };
}
function anilloBleLeer_() {
  var t = PropertiesService.getScriptProperties().getProperties(), r = {};
  Object.keys(t).filter(function (k) { return k.indexOf('ANILLO_BLE_') === 0; }).forEach(function (k) { try { r[k.slice(11)] = JSON.parse(t[k]); } catch (e) {} });
  return r;
}

/* ── Lectura del anillo (Juan, 16-nov-2026, rebanada 2 del anillo) ──────────────────────────────────────────────────────
   La app de iPhone lee el anillo QRing por Bluetooth (AnilloAlma.swift: batería, pasos, ritmo, oxígeno, ajustes) y, como
   mucho cada 10 min, manda aquí lo último que leyó con su hora (action anilloResumen, con la sesión). Se guarda SOLO lo
   último por usuario en ANILLO_RES_<clave> (la clave no es el correo): números con su hora, sin nombres ni aparatos.
   Así Alma lo dice también por WhatsApp, en el chat o por teléfono cuando el iPhone no está (herramienta «anillo» del chat,
   agente.js): «80 % de batería, leída hace 2 h». En la app, la voz lo lee en vivo con sus herramientas de cliente
   (anillo_estado, anillo_medidas, anillo_medir_ahora, anillo_ajustes, anillo_buscar: vozAnilloHerramientas_). */
var ANILLO_RES_RANGOS_ = { bateria: [0, 100], ritmo: [25, 250], oxigeno: [70, 100], pasos: [0, 100000], kcal: [0, 20000], metros: [0, 200000] };
var ANILLO_RES_ZONA_S_ = -6 * 3600;   // Guatemala, sin horario de verano: para decir «hoy» o «ayer»
function anilloResNum_(x, r) { var n = Math.round(Number(x)); return isFinite(n) && n >= r[0] && n <= r[1] ? n : null; }
/* Una hora válida (segundos): ni del futuro ni de hace más de 30 días. */
function anilloResT_(t, ahora) { var n = Number(t); return isFinite(n) && n <= ahora + 300 && n >= ahora - 30 * 86400 ? Math.round(n) : null; }
/* Solo los campos conocidos, cada uno limpio. Lo que no viene se queda como estaba (base). */
function anilloResOrdenar_(r, base, ahora) {
  var o = JSON.parse(JSON.stringify(base || {})); o.v = 1; r = r || {};
  Object.keys(ANILLO_RES_RANGOS_).forEach(function (k) {
    var x = r[k]; if (!x || typeof x !== 'object') return;
    var v = anilloResNum_(x.v, ANILLO_RES_RANGOS_[k]), t = anilloResT_(x.t, ahora);
    if (v != null && t != null) o[k] = { v: v, t: t };
  });
  if (o.bateria && r.bateria && typeof r.bateria.cargando === 'boolean') o.bateria.cargando = r.bateria.cargando;
  var d = r.ritmo_dia, td = d && anilloResT_(d.t, ahora);
  if (d && td != null) {
    var rd = { t: td }, rr = ANILLO_RES_RANGOS_.ritmo;
    ['min', 'max', 'prom', 'ultimo'].forEach(function (k) { var n = anilloResNum_(d[k], rr); if (n != null) rd[k] = n; });
    var um = anilloResNum_(d.ultimo_min, [0, 1439]); if (um != null) rd.ultimo_min = um;
    var cu = anilloResNum_(d.lecturas, [0, 1440]); if (cu != null) rd.lecturas = cu;
    if (rd.min != null || rd.ultimo != null) o.ritmo_dia = rd;
  }
  var a = r.ajustes, ta = a && anilloResT_(a.t, ahora);
  if (a && ta != null && typeof a.activo === 'boolean') o.ajustes = { activo: a.activo, minutos: anilloResNum_(a.minutos, [1, 120]) || 0, t: ta };
  if (typeof r.firmware === 'string') { var fw = r.firmware.replace(/[^0-9A-Za-z._-]/g, '').slice(0, 20); if (fw) o.firmware = fw; }
  var ts = anilloResT_(r.sync, ahora); if (ts != null) o.sync = ts;
  if (typeof r.conectado === 'boolean') o.conectado = { v: r.conectado, t: Math.round(ahora) };
  o.f = Math.round(ahora);
  return o;
}
function anilloResClave_(adm) { return 'ANILLO_RES_' + retClave_(adm).slice(8); }
function anilloResumenGuardar_(ses, body) {
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  var r = body && body.resumen; if (!r || typeof r !== 'object' || Array.isArray(r)) return { ok: false, error: 'vacio' };
  var c = CacheService.getScriptCache(), k = 'anillo_res_' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0);
  if (n > 10) return { ok: false, error: 'demasiados' };
  c.put(k, String(n + 1), 120);
  var p = PropertiesService.getScriptProperties(), clave = anilloResClave_(adm), base = {};
  try { base = JSON.parse(p.getProperty(clave) || '{}') || {}; } catch (e) {}
  var o = anilloResOrdenar_(r, base, Date.now() / 1000), txt = JSON.stringify(o);
  if (txt.length > 4000) return { ok: false, error: 'grande' };
  p.setProperty(clave, txt);
  return { ok: true };
}
function anilloResumenDe_(adm) {
  if (!adm || !adm.email) return null;
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(anilloResClave_(adm)) || 'null'); } catch (e) { return null; }
}
/* «hace 5 min», «hace 2 h», «ayer a las 18:40», «el 14-nov». */
function anilloHace_(t, ahora) {
  var s = Math.max(0, ahora - t);
  if (s < 120) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  var dia = function (x) { return Math.floor((x + ANILLO_RES_ZONA_S_) / 86400); }, dd = dia(ahora) - dia(t);
  if (dd === 0) return 'hace ' + Math.round(s / 3600) + ' h';
  var l = new Date((t + ANILLO_RES_ZONA_S_) * 1000), hm = ('0' + l.getUTCHours()).slice(-2) + ':' + ('0' + l.getUTCMinutes()).slice(-2);
  if (dd === 1) return 'ayer a las ' + hm;
  return 'el ' + l.getUTCDate() + '-' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][l.getUTCMonth()] + ' a las ' + hm;
}
/* La herramienta «anillo» del chat (agente.js): lo último que mandó la app, en frases cortas con su hora. */
function anilloHerramienta_(adm, ahora) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal ve su anillo.' };
  ahora = ahora || Date.now() / 1000;
  var r = anilloResumenDe_(adm);
  if (!r || !r.f) return { ok: false, error: 'La app de Alma todavía no ha mandado lecturas del anillo. Dile que abra la app con el anillo cerca.' };
  var h = function (x) { return anilloHace_(x.t, ahora); }, o = { ok: true, fuente: 'Lo último que la app de Alma leyó del anillo; no es en vivo. Di siempre de cuándo es.' };
  var ult = Math.max(r.sync || 0, r.bateria ? r.bateria.t : 0, r.pasos ? r.pasos.t : 0, r.ritmo ? r.ritmo.t : 0);
  if (ult) o.ultima_lectura = anilloHace_(ult, ahora);
  if (r.bateria) o.bateria = r.bateria.v + ' %' + (r.bateria.cargando ? ', cargando' : '') + ' (' + h(r.bateria) + ')';
  if (r.pasos) o.actividad = r.pasos.v + ' pasos' + (r.kcal ? ' · ' + r.kcal.v + ' kcal' : '') + (r.metros ? ' · ' + (r.metros.v / 1000).toFixed(1) + ' km' : '') + ' (contados hasta ' + h(r.pasos) + ')';
  if (r.ritmo) o.ritmo = r.ritmo.v + ' lpm, medido ' + h(r.ritmo);
  if (r.ritmo_dia) {
    var d = r.ritmo_dia, p = [];
    if (d.min != null) p.push('mín ' + d.min); if (d.max != null) p.push('máx ' + d.max); if (d.prom != null) p.push('promedio ' + d.prom);
    o.ritmo_del_dia = p.join(' · ') + (d.lecturas ? ' (' + d.lecturas + ' lecturas)' : '') + ', leído ' + anilloHace_(d.t, ahora);
  }
  if (r.oxigeno) o.oxigeno = r.oxigeno.v + ' %, medido ' + h(r.oxigeno);
  if (r.ajustes) o.monitoreo_ritmo = r.ajustes.activo ? 'encendido, cada ' + r.ajustes.minutos + ' min' : 'apagado';
  if (r.firmware) o.firmware = r.firmware;
  if (ult && ahora - ult > 24 * 3600) o.nota = 'La última lectura tiene más de un día: dilo así y sugiere abrir la app con el anillo cerca.';
  return o;
}

/* Las herramientas de CLIENTE de la voz para el anillo (las ejecuta la app de iPhone, AnilloAlma.swift; sin URL ni llave).
   vozDefHerramientas_ (voz.js) las suma a las del agente. Solo cuando la ficha trae «ANILLO DE JUAN» (la pone la app si
   hay un anillo guardado): fuera de la app, Alma usa secretaria (herramienta «anillo» del chat, lo último guardado). */
function vozAnilloHerramientas_() {
  var cliente = function (nombre, segundos, descripcion, props, requeridos) {
    return { type: 'client', name: nombre, expects_response: true, response_timeout_secs: segundos, description: descripcion,
      parameters: { type: 'object', required: requeridos || [], properties: props || {} }, disable_interruptions: false,
      pre_tool_speech: 'off', force_pre_tool_speech: false };
  };
  var solo = ' Úsala SOLO si la FICHA DE QUIEN LLAMA dice «ANILLO DE JUAN». Si responde conectado: false, dilo claro y no inventes datos (lo que traiga es lo último leído, con su hora).';
  var dia = { type: 'integer', description: '0 = hoy (por defecto), 1 = ayer… hasta 6.' };
  return [
    cliente('anillo_estado', 8, 'Estado del anillo QRing de Juan: si está conectado, batería y si carga, firmware y cuándo se sincronizó. Con mostrar: true abre en la app la pantalla Dispositivos (el anillo y los lentes, con su batería y sus ajustes) si Juan la pide o quiere verlo.' + solo,
      { mostrar: { type: 'boolean', description: 'true para abrir la pantalla Dispositivos en la app.' } }),
    cliente('anillo_medidas', 20, 'Lo que el anillo midió en un día: pasos, kcal y km, el ritmo cardíaco del día (mín., máx., promedio y la última lectura con su hora) y el último ritmo y oxígeno medidos en vivo.' + solo,
      { dia: dia }),
    cliente('anillo_medir_ahora', 40, 'Mide AHORA el ritmo cardíaco o el oxígeno con el anillo (tarda de 15 a 30 s). Antes di una frase corta («Te mido; quédate quieto unos segundos»). Si Juan dice que ya no, llámala con cancelar: true.' + solo,
      { tipo: { type: 'string', enum: ['ritmo', 'oxigeno'], description: 'ritmo (por defecto) u oxigeno.' }, cancelar: { type: 'boolean', description: 'true para detener una medición en curso.' } }),
    cliente('anillo_ajustes', 10, 'Lee o cambia el monitoreo automático del ritmo cardíaco del anillo (encendido y cada cuántos minutos). Cambia solo lo que Juan pidió y di cómo quedó.' + solo,
      { accion: { type: 'string', enum: ['ver', 'cambiar'], description: 'ver (por defecto) o cambiar.' }, activo: { type: 'boolean', description: 'cambiar: encendido o apagado.' }, minutos: { type: 'integer', description: 'cambiar: cada cuántos minutos (5 a 60).' } }),
    cliente('anillo_buscar', 6, 'Hace parpadear el anillo para que Juan lo encuentre.' + solo)
  ];
}
