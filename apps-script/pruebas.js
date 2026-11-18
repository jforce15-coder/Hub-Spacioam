/* ── Registro de pruebas del Modo inicio (Juan, 18-nov-2026, #764: «Hacer un récord/registro de las pruebas del modo OK
   durante las siguientes dos horas») ──
   Mientras Juan prueba el Modo inicio (decir «Alma» con la app abierta en el inicio), la página del inicio
   (alma/inicio.html, AlmaPrueba) anota lo que pasa y el Hub lo guarda en la hoja PRUEBAS_INICIO, solo dentro de la
   ventana que se abrió (propiedad PRUEBAS_REGISTRO = { desde, hasta, cerrado }):
     escucha_on / escucha_off       el Modo inicio empezó o dejó de escuchar
     conferencia_on / conferencia_off   «Alma» la despertó (o el botón) / se apagó
     voz_conectando / voz_hablando (ms en conectar) / voz_fin (s de llamada; «sin_conectar» si nunca habló) / error
   Nunca lo que se dijo ni datos personales: solo qué pasó, a qué hora y cuánto tardó (el error pasa por vozCaidaLimpiar_).
   Alma lo abre y lo lee con la herramienta registro_de_pruebas (agente.js). Al cerrarse la ventana, pruebasCerrar
   (un activador de una sola vez) le deja a Juan el resumen en Notificaciones. */
var PRUEBAS_HOJA_ = 'PRUEBAS_INICIO';
var PRUEBAS_CAB_ = ['ts', 'que', 'detalle', 'ms', 'ventana'];
var PRUEBAS_QUE_ = ['escucha_on', 'escucha_off', 'conferencia_on', 'conferencia_off', 'voz_conectando', 'voz_hablando', 'voz_fin', 'error', 'app_abierta'];
var PRUEBAS_MAX_LOTE_ = 60;

function pruebasVentana_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('PRUEBAS_REGISTRO') || 'null'); } catch (e) { return null; }
}
function pruebasActiva_(v) { v = v || pruebasVentana_(); var t = Date.now(); return !!(v && !v.cerrado && t >= Date.parse(v.desde) && t < Date.parse(v.hasta)); }

/* Abre (o alarga) la ventana: horas desde ahora (2 por defecto, de 0,25 a 12). */
function pruebasEmpezar_(horas) {
  var h = Math.max(0.25, Math.min(12, Number(horas) || 2)), ahora = new Date(), v = pruebasVentana_();
  var sigue = pruebasActiva_(v), desde = sigue ? v.desde : ahora.toISOString(), hasta = new Date(ahora.getTime() + h * 3600000).toISOString();
  var nv = { desde: desde, hasta: hasta, cerrado: false, id: sigue && v.id ? v.id : 'pr' + ahora.getTime() };
  PropertiesService.getScriptProperties().setProperty('PRUEBAS_REGISTRO', JSON.stringify(nv));
  hojaCrear_(PRUEBAS_HOJA_, PRUEBAS_CAB_);
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pruebasCerrar') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('pruebasCerrar').timeBased().at(new Date(Date.parse(hasta) + 60000)).create();
  } catch (e) { console.warn('pruebasEmpezar_ activador: ' + e); }
  return nv;
}

/* Acción pruebasInicio (la página del inicio, sesión del principal):
     { que: 'estado' }                → { ok, activo, hasta }
     { que: 'anotar', eventos: [...] } → guarda los eventos si la ventana está abierta (si no, { activo: false }) */
function pruebasInicio_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  if (!esAdminPrincipal_(adm)) return { ok: true, activo: false };
  var v = pruebasVentana_(), activo = pruebasActiva_(v);
  if (b.que !== 'anotar' || !activo) return { ok: true, activo: activo, hasta: activo ? v.hasta : '' };
  var ev = (Array.isArray(b.eventos) ? b.eventos : []).slice(0, PRUEBAS_MAX_LOTE_), filas = [];
  ev.forEach(function (e) {
    if (!e || PRUEBAS_QUE_.indexOf(String(e.que)) < 0) return;
    var t = Number(e.t) || Date.now(); if (t < Date.parse(v.desde) - 60000 || t > Date.now() + 60000) return;
    filas.push([new Date(t).toISOString(), String(e.que), vozCaidaLimpiar_(e.det).slice(0, 120), Math.round(Number(e.ms) || 0), v.id || '']);
  });
  if (filas.length) {
    var lk = LockService.getScriptLock(); try { lk.waitLock(10000); } catch (x) {}
    try { var sh = hojaCrear_(PRUEBAS_HOJA_, PRUEBAS_CAB_); sh.getRange(sh.getLastRow() + 1, 1, filas.length, PRUEBAS_CAB_.length).setValues(filas); }
    finally { try { lk.releaseLock(); } catch (x) {} }
  }
  return { ok: true, activo: true, hasta: v.hasta, anotados: filas.length };
}

/* El resumen de la ventana (la última, abierta o cerrada): cuentas, tiempos y la línea de tiempo. */
function pruebasResumen_(v) {
  v = v || pruebasVentana_(); if (!v) return { ok: true, hay: false, nota: 'Todavía no hay registro de pruebas. Ábrelo con registro_de_pruebas (que: empezar).' };
  var sh = hoja_(PRUEBAS_HOJA_), filas = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, PRUEBAS_CAB_.length).getValues() : [];
  var ev = filas.filter(function (f) { return String(f[4]) === String(v.id || ''); }).map(function (f) {
    return { t: Date.parse(f[0] instanceof Date ? f[0].toISOString() : String(f[0])), que: String(f[1]), det: String(f[2] || ''), ms: Number(f[3]) || 0 };
  }).sort(function (a, b) { return a.t - b.t; });
  var cuenta = function (q) { return ev.filter(function (e) { return e.que === q; }).length; };
  var conecto = ev.filter(function (e) { return e.que === 'voz_hablando'; }), sin = ev.filter(function (e) { return e.que === 'voz_fin' && e.det === 'sin_conectar'; });
  var prom = conecto.length ? Math.round(conecto.reduce(function (s, e) { return s + e.ms; }, 0) / conecto.length) : 0;
  var maxMs = conecto.reduce(function (m, e) { return Math.max(m, e.ms); }, 0);
  var errores = {}; ev.forEach(function (e) { if (e.que === 'error' && e.det) errores[e.det] = (errores[e.det] || 0) + 1; });
  var hora = function (t) { return Utilities.formatDate(new Date(t), CFG.TZ, 'HH:mm:ss'); };
  var NOM = { escucha_on: 'empezó a escuchar', escucha_off: 'dejó de escuchar', conferencia_on: 'conferencia encendida', conferencia_off: 'conferencia apagada',
    voz_conectando: 'llamada: conectando', voz_hablando: 'llamada: conectó', voz_fin: 'llamada: terminó', error: 'error', app_abierta: 'app abierta en el inicio' };
  var linea = ev.map(function (e) {
    var x = hora(e.t) + ' · ' + (NOM[e.que] || e.que);
    if (e.que === 'voz_hablando') x += ' en ' + (e.ms / 1000).toFixed(1) + ' s';
    else if (e.que === 'voz_fin') x += e.det === 'sin_conectar' ? ' sin conectar' : ' (' + Math.round(e.ms / 1000) + ' s)';
    else if (e.det) x += ': ' + e.det;
    return x;
  });
  var caidas = []; try { caidas = JSON.parse(PropertiesService.getScriptProperties().getProperty('VOZ_CAIDAS') || '[]').filter(function (c) { return Date.parse(c.ts) >= Date.parse(v.desde) && Date.parse(c.ts) <= Date.parse(v.hasta); }); } catch (e) {}
  var ag = null; try { ag = JSON.parse(PropertiesService.getScriptProperties().getProperty('CUPO_AGOTADO') || 'null'); } catch (e) {}
  return { ok: true, hay: true, abierto: pruebasActiva_(v), desde: hora(Date.parse(v.desde)), hasta: hora(Date.parse(v.hasta)), eventos: ev.length,
    veces_escucho: cuenta('escucha_on'), despertares: cuenta('conferencia_on'), llamadas: cuenta('voz_conectando'), conectaron: conecto.length,
    sin_conectar: sin.length, segundos_en_conectar: { promedio: +(prom / 1000).toFixed(1), maximo: +(maxMs / 1000).toFixed(1) },
    errores: Object.keys(errores).map(function (k) { return { error: k, veces: errores[k] }; }), voz_del_iphone: caidas.length,
    cupo_agotado: ag && Date.parse(ag.ts) >= Date.parse(v.desde) ? 'Google se quedó sin cupo a las ' + ag.hora : '',
    linea_de_tiempo: linea.slice(-80) };
}
function pruebasResumenTexto_(r) {
  if (!r || !r.hay) return 'No hubo registro de pruebas.';
  if (!r.eventos) return 'Registro de pruebas del Modo inicio (' + r.desde + '–' + r.hasta + '): no llegó ninguna prueba. ¿Estaba la app abierta en el inicio?';
  var t = 'Registro de pruebas del Modo inicio (' + r.desde + '–' + r.hasta + '): escuchó ' + r.veces_escucho + ' veces, «Alma» la despertó ' + r.despertares
    + ', ' + r.llamadas + ' llamadas: ' + r.conectaron + ' conectaron' + (r.conectaron ? ' (' + r.segundos_en_conectar.promedio + ' s en promedio)' : '') + ' y ' + r.sin_conectar + ' no conectaron.';
  if (r.errores.length) t += ' Errores: ' + r.errores.map(function (e) { return e.error + (e.veces > 1 ? ' (×' + e.veces + ')' : ''); }).join('; ') + '.';
  if (r.cupo_agotado) t += ' ' + r.cupo_agotado + '.';
  return t;
}

/* Activador de una sola vez al terminar la ventana: la cierra y deja el resumen en Notificaciones. */
function pruebasCerrar() {
  try { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pruebasCerrar') ScriptApp.deleteTrigger(t); }); } catch (e) {}
  var v = pruebasVentana_(); if (!v || v.cerrado) return;
  if (Date.now() < Date.parse(v.hasta)) { try { ScriptApp.newTrigger('pruebasCerrar').timeBased().at(new Date(Date.parse(v.hasta) + 60000)).create(); } catch (e) {} return; }   // la alargaron
  v.cerrado = true; PropertiesService.getScriptProperties().setProperty('PRUEBAS_REGISTRO', JSON.stringify(v));
  var texto = pruebasResumenTexto_(pruebasResumen_(v));
  try {
    var adm = agPrincipal_(); if (!adm || !adm.email) return;
    pendAvisar_(adm, texto, { origen: 'pruebas', push: false, clasif: { tipo: 'aviso', area: 'proposito', proyecto: 'Spacio AM', titulo: 'Registro de pruebas', resumen: texto, aviso: texto, importancia: 2, tarjeta: null, acciones: [] } });
    try { pushA_([adm.email], 'Registro de pruebas', texto, CFG.HUB_URL + '/alma/', { origen: 'pruebas' }); } catch (e) { console.warn('pruebas push: ' + e); }
  } catch (e) { console.warn('pruebasCerrar: ' + e); }
}

/* Herramienta registro_de_pruebas (agente.js), solo el principal: empezar { horas } · ver · parar. */
function pruebasParaAlma_(adm, inp) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal usa el registro de pruebas.' };
  inp = inp || {}; var que = String(inp.que || 'ver');
  if (que === 'empezar') {
    var v = pruebasEmpezar_(inp.horas);
    return { ok: true, abierto: true, desde: Utilities.formatDate(new Date(v.desde), CFG.TZ, 'HH:mm'), hasta: Utilities.formatDate(new Date(v.hasta), CFG.TZ, 'HH:mm'),
      nota: 'Dilo simple: «Listo, anoto tus pruebas del Modo inicio hasta las HH:mm; al terminar te dejo el resumen». Se anota solo con la app abierta en el inicio.' };
  }
  if (que === 'parar') {
    var w = pruebasVentana_(); if (!w || w.cerrado) return { ok: true, abierto: false, nota: 'No había registro abierto.' };
    w.hasta = new Date().toISOString(); PropertiesService.getScriptProperties().setProperty('PRUEBAS_REGISTRO', JSON.stringify(w));
    pruebasCerrar();
    return Object.assign(pruebasResumen_(pruebasVentana_()), { texto: pruebasResumenTexto_(pruebasResumen_(pruebasVentana_())) });
  }
  var r = pruebasResumen_(); r.texto = pruebasResumenTexto_(r);
  r.nota = 'Cuéntalo simple: cuántas veces la despertó «Alma», cuántas llamadas conectaron y en cuánto, y los errores. La línea de tiempo, solo si la pide.';
  return r;
}
