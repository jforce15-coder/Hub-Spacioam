/* ═══ LECTURAS MÁS RÁPIDAS EN LA VOZ (guardia 20-nov-2026, microproyecto «Guardia: Alma no contesta tras», parte 4) ══════
   La guardia del 19-nov midió (voz_traza, d.lentas): buscar_reservas hasta 15,8 s (varias de 4-7 s), enviar_a_huesped
   9,5-10,9 s, buscar_contacto 3-4 s. Y d.rapido de 9,5-11,7 s aunque el tope es 5 s: el tope solo impide EMPEZAR otra
   vuelta; la primera vuelta corre entera, con sus herramientas lentas adentro. Lo que se hizo:
   · hubInbox_ (Código.js) buscaba la ficha de cada chat de WhatsApp de la bandeja una por una (contactoFicha_: caché
     + JSON de toda la lista por fila, o la hoja entera si la lista no cabía en la caché). Ahora arma el mapa una vez.
   · Mientras dura un turno de voz (AG_MS_ puesto por calle.js o voz.js), la bandeja y la hoja Reservas se leen una sola
     vez por turno (VOZ_LECTURA_SEG_ como máximo); una escritura en la bandeja (inboxUpsert_) borra la copia.
   · buscar_reservas pregunta a Hospitable el estado en vivo de sus primeras reservas TODAS A LA VEZ (fetchAll), no una
     tras otra; y, si una reserva no tiene su conversación en la bandeja, la busca solo alrededor de su llegada (no la
     búsqueda amplia de 6 páginas: esa queda para historial_reserva y para enviar, que sí la necesitan).
   · voz_traza guarda br (cuánto tardó cada parte de buscar_reservas: hoja, bandeja, vivo) y rapido_tope (el tope que
     de verdad usó la vía rápida, para ver si VOZ_RAPIDO_MS cambió en el Hub). */
var VOZ_LECTURA_SEG_ = 60;
var VOZ_LECTURA_ = { t: 0, inbox: null, reservas: null };

/* ¿Estamos en un turno de voz? Solo entonces se guarda la copia (fuera de la voz todo se lee como siempre). */
function vozLecturaActiva_() { return typeof AG_MS_ !== 'undefined' && !!AG_MS_; }
function vozLecturaFresca_() {
  if (!vozLecturaActiva_()) return false;
  if (Date.now() - VOZ_LECTURA_.t > VOZ_LECTURA_SEG_ * 1000) { VOZ_LECTURA_ = { t: Date.now(), inbox: null, reservas: null }; }
  return true;
}
/* Una escritura en la bandeja: la próxima lectura va a la hoja. */
function vozLecturaOlvidarBandeja_() { VOZ_LECTURA_.inbox = null; }
/* La bandeja (hubInbox_) una sola vez por turno de voz. Copia de la lista: quien la filtra no toca la guardada. */
function vozInbox_(leer) {
  if (!vozLecturaFresca_()) return leer();
  if (!VOZ_LECTURA_.inbox) VOZ_LECTURA_.inbox = leer();
  return VOZ_LECTURA_.inbox.slice();
}
/* La hoja Reservas una sola vez por turno de voz (agBuscarReservas_, reservaFila_). */
function vozReservas_() {
  if (!vozLecturaFresca_()) return leerTabla_(CFG.TAB_RESERVAS);
  if (!VOZ_LECTURA_.reservas) VOZ_LECTURA_.reservas = leerTabla_(CFG.TAB_RESERVAS);
  return VOZ_LECTURA_.reservas.slice();
}
/* Cuánto tardó una parte de buscar_reservas, en la traza de la voz (d.br: { hoja, bandeja, vivo } en segundos). */
function vozLecturaMedir_(parte, ms) {
  if (!vozLecturaActiva_()) return;
  var b = AG_MS_.br || (AG_MS_.br = {});
  b[parte] = Math.round(((b[parte] || 0) * 1000 + ms) / 100) / 10;
}

/* El estado en vivo de varias reservas a la vez: una sola tanda a Hospitable (fetchAll) para las que no están en la
   caché de agEstadoReserva_ (10 min). Después agEstadoReserva_ las encuentra en la caché y no llama de nuevo.
   pares: [{ uuid, fila }] (la fila de la hoja da el estado si Hospitable no lo trae). Nunca rompe la búsqueda: si falla,
   agEstadoReserva_ pregunta como siempre. */
function agEstadosVivos_(pares) {
  try {
    var c = CacheService.getScriptCache(), token = PropertiesService.getScriptProperties().getProperty('HOSPITABLE_TOKEN'), filaDe = {};
    (pares || []).forEach(function (p) { if (p && p.uuid && !filaDe[p.uuid]) filaDe[p.uuid] = p.fila || {}; });
    var faltan = Object.keys(filaDe).filter(function (u) { return !/^(wa|op|inq):/.test(u); });
    if (!faltan.length || !token) return;
    var ya = c.getAll(faltan.map(function (u) { return 'agest_' + String(u).slice(-40); })) || {};
    faltan = faltan.filter(function (u) { return !ya['agest_' + String(u).slice(-40)]; });
    if (!faltan.length) return;
    var rs = ufAll_(faltan.map(function (u) {
      return { url: CFG.HOSPITABLE_API + '/reservations/' + u, method: 'get', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } };
    }));
    faltan.forEach(function (u, i) {
      var r = rs[i]; if (!r || r.getResponseCode() !== 200) return;   // 429 u otro: agEstadoReserva_ lo intenta solo, como antes
      var d = null; try { d = JSON.parse(r.getContentText()).data; } catch (e) {}
      if (d) c.put('agest_' + String(u).slice(-40), JSON.stringify(agEstadoDeHosp_(d, agEstadoHoja_(filaDe[u]))), 600);
    });
  } catch (e) { console.error('agEstadosVivos_: ' + e); }
}
