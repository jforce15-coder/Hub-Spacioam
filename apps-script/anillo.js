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
/* Robot: las últimas filas (por defecto 30) para leer una prueba completa, y los pasos de la voz de la app (abajo). */
function anilloLeer_(n) {
  var app = {}; try { app = anilloPasosLeer_(); } catch (e) {}
  var sh = ssAlma_().getSheetByName('ALMA_ANILLO'); if (!sh || sh.getLastRow() < 2) return { ok: true, filas: [], app: app };
  n = Math.min(200, Number(n) || 30);
  var desde = Math.max(2, sh.getLastRow() - n + 1);
  var v = sh.getRange(desde, 1, sh.getLastRow() - desde + 1, 4).getValues();
  return { ok: true, app: app, filas: v.map(function (r) { var e = []; try { e = JSON.parse(r[3]); } catch (x) {} return { fecha: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), sesion: String(r[1]), equipo: String(r[2]), eventos: e }; }) };
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
  var nuevos = pasos.slice(-14).map(anilloPasoLimpio_).filter(Boolean); if (!nuevos.length) return 0;
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
