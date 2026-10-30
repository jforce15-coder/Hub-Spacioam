/* ═══ ALMA · PUENTE DE CORREO ═══════════════════════════════════════════════════════════════════════════
   Este pedacito vive en TU cuenta de correo (script.google.com, con la sesión de esa cuenta). Cada 10 minutos lee lo
   nuevo de tu bandeja y se lo manda a Alma para que lo ordene (códigos, verificaciones, autorizaciones, promociones,
   posible spam y cada proyecto). Manda remitente, asunto y el principio del texto; Alma no guarda el cuerpo completo.
   Al volver, hace en tu bandeja lo que le pediste en la app: mover a Spam, archivar, o traerle a Alma un hilo completo
   para que lo responda y mandar su respuesta (desde esta cuenta, en el mismo hilo).

   Instalar (una vez por cuenta):
     1. Abre script.google.com con esa cuenta → Nuevo proyecto → pega todo esto (la app ya pone tu llave abajo).
     2. Arriba elige la función «instalar» y toca Ejecutar. Acepta los permisos (es tu propio script).
     Listo: revisa solo cada 10 minutos. Para desconectar, borra el proyecto. */
var HUB = '';
var CUENTA = '';
var LLAVE = '';

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('revisar').timeBased().everyMinutes(10).create();
  revisar();
}

function revisar() {
  var p = PropertiesService.getUserProperties(), desde = Number(p.getProperty('desde') || (Date.now() - 2 * 86400000));
  var correos = [];
  GmailApp.search('after:' + Math.floor(desde / 1000) + ' -in:chats -in:sent -in:drafts', 0, 50).forEach(function (h) {
    h.getMessages().forEach(function (m) {
      var t = m.getDate().getTime(); if (t <= desde) return;
      var de = m.getFrom(), dm = de.match(/^\s*"?(.*?)"?\s*<([^>]+)>\s*$/), dir = (dm ? dm[2] : de).trim().toLowerCase();
      if (dir === CUENTA) return;   // lo que mandaste tú
      var lu = '', lup = ''; try { lu = m.getHeader('List-Unsubscribe') || ''; lup = m.getHeader('List-Unsubscribe-Post') || ''; } catch (e) {}
      correos.push({ t: t, id: m.getId(), hilo: h.getId(), de: dir, de_nombre: dm ? dm[1] : '', asunto: m.getSubject(), fecha: m.getDate().toISOString(),
        cuerpo: String(m.getPlainBody() || '').slice(0, 1500),
        unsub_url: (lu.match(/<(https?:[^>]+)>/) || [])[1] || '', unsub_mailto: (lu.match(/<mailto:([^>]+)>/) || [])[1] || '', unsub_un_clic: /one-click/i.test(lup) });
    });
  });
  correos.sort(function (a, b) { return a.t - b.t; }); correos = correos.slice(0, 60);   // lo más viejo primero; lo demás en la próxima vuelta
  var r = UrlFetchApp.fetch(HUB, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
    payload: JSON.stringify({ correoPuente: 1, cuenta: CUENTA, llave: LLAVE, correos: correos }) });
  var j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
  if (!j.ok) throw new Error('Alma no recibió los correos: ' + (j.error || r.getResponseCode()));
  if (correos.length) p.setProperty('desde', String(correos[correos.length - 1].t));
  var leer = hacer(j.acciones || []);
  /* Alma pidió hilos completos para responderlos: se los lleva ahora mismo y manda lo que ella devuelva */
  if (leer.length) {
    var hilos = leer.slice(0, 5).map(function (id) {
      var h = GmailApp.getThreadById(id); if (!h) return null;
      return { hilo: id, mensajes: h.getMessages().slice(-8).map(function (m) { return { de: m.getFrom(), fecha: m.getDate().toISOString(), cuerpo: String(m.getPlainBody() || '').slice(0, 3000) }; }) };
    }).filter(Boolean);
    var r2 = UrlFetchApp.fetch(HUB, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ correoPuente: 1, cuenta: CUENTA, llave: LLAVE, correos: [], hilos: hilos }) });
    var j2 = {}; try { j2 = JSON.parse(r2.getContentText() || '{}'); } catch (e) {}
    hacer(j2.acciones || []);
  }
}

/* Lo que Alma pidió: spam, archivar, responder (al último mensaje que no es tuyo) o leer (devuelve los hilos a traer). */
function hacer(acciones) {
  var leer = [];
  acciones.forEach(function (a) {
    try {
      if (a.accion === 'leer') { if (leer.indexOf(a.hilo) < 0) leer.push(a.hilo); return; }
      var h = GmailApp.getThreadById(a.hilo); if (!h) return;
      if (a.accion === 'spam') h.moveToSpam();
      else if (a.accion === 'archivar') h.moveToArchive();
      else if (a.accion === 'responder' && a.texto) {
        var ms = h.getMessages().filter(function (m) { return m.getFrom().toLowerCase().indexOf(CUENTA) < 0; });
        if (ms.length) ms[ms.length - 1].reply(a.texto);
      }
    } catch (e) { console.error(a.accion + ': ' + e); }
  });
  return leer;
}
