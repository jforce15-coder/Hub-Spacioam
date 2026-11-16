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
/* Robot: las últimas filas (por defecto 30) para leer una prueba completa, los pasos de la voz de la app y el último
   Diagnóstico del anillo por Bluetooth de cada usuario (ble, abajo). */
function anilloLeer_(n) {
  var app = {}, ble = {}; try { app = anilloPasosLeer_(); } catch (e) {} try { ble = anilloBleLeer_(); } catch (e) {}
  var sh = ssAlma_().getSheetByName('ALMA_ANILLO'); if (!sh || sh.getLastRow() < 2) return { ok: true, filas: [], app: app, ble: ble };
  n = Math.min(200, Number(n) || 30);
  var desde = Math.max(2, sh.getLastRow() - n + 1);
  var v = sh.getRange(desde, 1, sh.getLastRow() - desde + 1, 4).getValues();
  return { ok: true, app: app, ble: ble, filas: v.map(function (r) { var e = []; try { e = JSON.parse(r[3]); } catch (x) {} return { fecha: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), sesion: String(r[1]), equipo: String(r[2]), eventos: e }; }) };
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
