/* ═══ RESPALDO POR WHATSAPP DE LAS NOTIFICACIONES (issue #501; Juan, 12-nov-2026: «Sí») ══════════════════════════════
   Las notificaciones de la app de iPhone se quedan en la cola VOZ_AVISOS (voz.js) hasta que la app las recoge; la app
   pregunta cada 45 s, pero solo mientras está abierta. Con la app cerrada o dormida nadie las recogía y a las 6 h se
   borraban: Juan nunca se enteraba de que algo de segundo plano terminó.
   Ahora, si una notificación del administrador principal sigue en la cola AVISO_WA_MIN_ minutos después de creada, le
   llega por WhatsApp en una línea. Solo lo que sirve: lo que pide algo de él (nivel 1 o 2: preguntas, listo para unir,
   fallos, urgencias) y lo que terminó en segundo plano (aviso con `resultado`); lo de nivel 3 suelto, no.
   Una sola vez por notificación (marca `wa` en la cola, con el candado), varias juntas en un solo mensaje. Si la app la
   recoge después, igual la muestra. Corre en cada pasada de procesarCola (solo lee una propiedad; sin IA).
   AVISO_WA = 0 en las Propiedades del script lo apaga. */
var AVISO_WA_MIN_ = 10, AVISO_WA_MAX_ = 5;
function avisoWaRespaldo_() {
  var p = PropertiesService.getScriptProperties();
  if (String(p.getProperty('AVISO_WA') || '') === '0') return;
  var jefe = chatPrincipal_(); if (!jefe || !jefe.email) return;
  var num = jefe.wa || (jefe.tels || [])[0]; if (!num) return;
  var ahora = Date.now(), corte = ahora - AVISO_WA_MIN_ * 60000;
  var leer = function () { var t = {}; try { t = JSON.parse(p.getProperty('VOZ_AVISOS') || '{}'); } catch (e) {} return t; };
  var viejos = (leer()[jefe.email] || []).filter(function (a) { return a && !a.wa && a.ts <= corte && ahora - a.ts < 6 * 3600000; });
  if (!viejos.length) return;   // lo normal: nada que mandar, sin tocar hojas
  var rets = [], pends = [];
  try { rets = retLeer_(jefe); } catch (e) {}
  try { pends = pendFilas_(); } catch (e) {}
  var toca = viejos.filter(function (a) { return a.resultado || avisoNivel_(a, rets, pends) <= 2; });
  /* Lo que no toca también se marca: así no se vuelve a calcular su nivel en cada pasada. */
  var ids = {}; viejos.forEach(function (a) { ids[String(a.id)] = true; });
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var t = leer(), l = t[jefe.email] || [], sigue = {};
    l.forEach(function (a) { if (a && ids[String(a.id)] && !a.wa) { a.wa = ahora; sigue[String(a.id)] = true; } });
    if (!Object.keys(sigue).length) return;   // la app la recogió en medio: no se manda
    t[jefe.email] = l; p.setProperty('VOZ_AVISOS', JSON.stringify(t));
    toca = toca.filter(function (a) { return sigue[String(a.id)]; });
  } finally { lock.releaseLock(); }
  if (!toca.length) return;
  var texto = avisoWaTexto_(toca); if (!texto) return;
  try {
    var r = waEnviar_(num, texto);
    if (r && r.ok === false) console.error('avisoWaRespaldo_: ' + r.error);
  } catch (e) { console.error('avisoWaRespaldo_: ' + e); }
}
/* Una línea por notificación (sin enlaces), la más vieja primero; el resto, contado. */
function avisoWaTexto_(lista) {
  var linea = function (a) { return String(a.texto || '').replace(/https?:\/\/\S+/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200); };
  lista = lista.slice().sort(function (a, b) { return a.ts - b.ts; });
  var ls = lista.slice(0, AVISO_WA_MAX_).map(linea).filter(Boolean);
  if (!ls.length) return '';
  var extra = lista.length - ls.length;
  /* Una sola: la entrada y, debajo, sus datos ordenados (notificaciones humanas, avisotexto.js, #509 T2). */
  if (ls.length === 1 && !extra) return 'Alma · ' + ls[0] + ((lista[0].datos || []).length ? '\n' + lista[0].datos.slice(0, 3).map(function (d) { return '· ' + String(d).replace(/https?:\/\/\S+/g, '').trim(); }).join('\n') : '');
  return 'Alma · tienes ' + lista.length + ' avisos:\n' + ls.map(function (l) { return '· ' + l; }).join('\n') +
    (extra > 0 ? '\n· y ' + extra + ' más en la app' : '');
}
