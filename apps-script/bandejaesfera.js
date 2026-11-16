/* ═══ ESFERA Y FOTO DE CADA CONVERSACIÓN DE LA BANDEJA (#567 T1) ═══════════════════════════════════════════════════
   La bandeja del Hub (diseño A3) pinta cada conversación con el color de su esfera y la foto de la persona. Cada fila
   que va al Hub (hubCola_) sale con:
     · esfera: una de las 6 claves de AREAS_ (areas.js). La que movió Juan a mano (hoja ALMA_AREAS, «conv:<id>») manda;
       si es un WhatsApp personal (los encargos de «escríbele a…», WA_RELAY), la que Alma le puso («pers:<últimos 8>»,
       Relaciones mientras no la clasifica); todo lo demás (Hospitable, Airbnb, Booking y el WhatsApp de Spacio AM) es
       Propósito, igual que en areas_.
     · foto: la del huésped (ALMA_INBOX.foto); si no hay y es un WhatsApp, la del login de esa persona (Control de
       usuarios, columna foto, por su teléfono) o la de la reserva ligada a ese número o a ese código; si no, null (el Hub
       pone las iniciales). Nunca se inventa una foto.
   Las hojas se leen como mucho una vez cada BANDEJA_ESFERA_SEG_ (el Hub pregunta cada 5–10 s); mover una conversación
   de esfera borra la caché (areaMover_). Solo hojas y propiedades: nada va a internet. */
var BANDEJA_ESFERA_SEG_ = 300, BANDEJA_ESFERA_CACHE_ = 'bandeja_esfera_v1';

/* Lo que no cambia cada pocos segundos: esferas movidas a mano, lo personal y las fotos del login por teléfono. */
function bandejaEsferaMapas_() {
  var cache = null; try { cache = CacheService.getScriptCache(); } catch (e) {}
  var c0 = cache && cache.get(BANDEJA_ESFERA_CACHE_);
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  var m = { conv: {}, pers: {}, fotos: {} };
  try {
    var filas = areasFilas_();
    Object.keys(filas).forEach(function (k) {
      var a = String(filas[k].area || '');
      if (k.indexOf('conv:') === 0 && areaOk_(a)) m.conv[k.slice(5)] = a;
      else if (k.indexOf('pers:') === 0) m.pers[k.slice(5)] = areaOk_(a) ? a : 'relaciones';
    });
  } catch (e) { console.error('bandejaEsfera areas: ' + e); }
  try {
    var relay = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}');
    Object.keys(relay).forEach(function (k) { if (!m.pers[k]) m.pers[k] = 'relaciones'; });   // aún sin clasificar: como en areas_
  } catch (e) {}
  try { m.fotos = bandejaFotosLogin_(); } catch (e) { console.error('bandejaEsfera fotos: ' + e); }
  try { var s = JSON.stringify(m); if (cache && s.length < 90000) cache.put(BANDEJA_ESFERA_CACHE_, s, BANDEJA_ESFERA_SEG_); } catch (e) {}
  return m;
}

/* Fotos del login (Control de usuarios): teléfono (últimos 8) → foto. Solo las cuentas activas y con foto http(s). */
function bandejaFotosLogin_() {
  var out = {}, norm = function (x) { return String(x || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  SpreadsheetApp.openById(SHEET_ACCESOS_ID).getSheets().forEach(function (sh) {
    var v = sh.getDataRange().getDisplayValues(); if (v.length < 2) return;
    var cab = v[0].map(norm), cf = cab.indexOf('foto'), cEst = cab.findIndex(function (x) { return /^(estado|activo|active)$/.test(x); });
    var tels = cab.map(function (c, i) { return /^(telefono|telefonos|tel|celular|whatsapp|phone|movil)$/.test(c) ? i : -1; }).filter(function (i) { return i >= 0; });
    if (cf < 0 || !tels.length) return;
    v.slice(1).forEach(function (r) {
      if (cEst >= 0 && /inactiv|baja|bloque|suspend|^no$|false/.test(norm(r[cEst]))) return;
      var f = String(r[cf] || '').trim(); if (!/^https?:\/\//i.test(f)) return;
      tels.forEach(function (i) { telsDe_(r[i]).forEach(function (t) { var k = fin8_(t); if (k && !out[k]) out[k] = f; }); });
    });
  });
  return out;
}

/* La esfera de una conversación de la bandeja (clave de AREAS_). */
function bandejaEsferaDe_(m, convId) {
  var id = String(convId || ''); if (m.conv[id]) return m.conv[id];
  if (id.indexOf('wa:') === 0) { var k = fin8_(id.slice(3)); if (k && m.pers[k]) return m.pers[k]; }
  return 'proposito';
}

/* Completa las filas que van al Hub: esfera y foto (o null). Devuelve las mismas filas. */
function bandejaEsferaFoto_(filas, mapas) {
  var m = mapas || bandejaEsferaMapas_(), esUrl = function (x) { return /^https?:\/\//i.test(String(x || '')); };
  var porCodigo = {}, porWa = {};   // la foto de la reserva, para el WhatsApp ligado a ella
  filas.forEach(function (o) {
    if (!esUrl(o.foto)) return;
    if (o.codigo) porCodigo[String(o.codigo).toUpperCase()] = o.foto;
    if (o.wa) { var w = fin8_(o.wa); if (w) porWa[w] = o.foto; }
  });
  filas.forEach(function (o) {
    var id = String(o.conv_id || ''), wa = id.indexOf('wa:') === 0 ? fin8_(id.slice(3)) : '';
    o.esfera = bandejaEsferaDe_(m, id);
    var f = esUrl(o.foto) ? String(o.foto) : '';
    if (!f && wa) f = m.fotos[wa] || porWa[wa] || '';
    if (!f && o.codigo) f = porCodigo[String(o.codigo).toUpperCase()] || '';
    o.foto = f || null;
  });
  return filas;
}
