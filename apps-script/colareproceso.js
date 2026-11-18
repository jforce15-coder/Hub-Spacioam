/* ═══ Reprocesar filas de ALMA_COLA que quedaron en «error» (robot dsBot) ═══
   18-nov-2026: el Hub viejo (apagado tras el corte a alma@) siguió tomando filas con su cupo de Google agotado y las dejó
   en «error» (envío HTTP 0, hilo HTTP 0, reserva no disponible). Juan pidió que Alma las vuelva a procesar.
   · cola_errores    Solo lee: las filas en «error» de las últimas 500 (o desde «desde»), con lo mínimo para reconocerlas.
   · cola_reprocesar Vuelve a «pendiente» SOLO las filas pedidas que sigan en «error» y cuyo message_id coincida. Alma las
                     procesa por el camino normal: relee el hilo de hoy y, si el equipo ya respondió o no hace falta, no manda
                     nada. Con «un_intento» la fila queda a un intento del tope: si vuelve a fallar, queda en «error» con el
                     motivo exacto y no se reintenta. Nunca manda nada por sí misma. */
function colaFilasError_(desde) {
  var sh = hoja_(CFG.TAB_COLA), n = sh.getLastRow(); if (n < 2) return [];
  var p = Math.max(2, n - 499), lim = desde ? new Date(desde).getTime() : 0;
  return sh.getRange(p, 1, n - p + 1, COLA_HEADERS.length).getValues().map(function (v, i) { return { fila: p + i, v: v }; })
    .filter(function (f) { return f.v[C.estado] === 'error' && (!lim || new Date(f.v[C.recibido]).getTime() >= lim); });
}
function colaErrores_(body) {
  return { ok: true, filas: colaFilasError_(body && body.desde).map(function (f) {
    return { fila: f.fila, recibido: s_(f.v[C.recibido] instanceof Date ? f.v[C.recibido].toISOString() : f.v[C.recibido]), message_id: s_(f.v[C.message_id]),
      reservation_id: s_(f.v[C.reservation_id]), huesped: s_(f.v[C.huesped]).split(' ')[0], texto: s_(f.v[C.texto]).slice(0, 80),
      intentos: Number(f.v[C.intentos] || 0), nota: s_(f.v[C.nota]).slice(0, 160) };
  }) };
}
function colaReprocesar_(body) {
  var pedidas = (body && body.filas) || [], unIntento = (body && body.un_intento) || [];
  if (!pedidas.length) return { ok: false, error: 'faltan filas [{fila, message_id}]' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'cola ocupada, repite' }; }
  try {
    var sh = hoja_(CFG.TAB_COLA), errores = {}, out = [];
    colaFilasError_('').forEach(function (f) { errores[f.fila] = f; });
    pedidas.forEach(function (p) {
      var f = errores[Number(p.fila)];
      if (!f) return out.push({ fila: p.fila, hecho: false, motivo: 'ya no está en error' });
      if (s_(f.v[C.message_id]) !== s_(p.message_id)) return out.push({ fila: p.fila, hecho: false, motivo: 'message_id no coincide' });
      var uno = unIntento.indexOf(Number(p.fila)) >= 0;
      set_(sh, f, { estado: 'pendiente', intentos: uno ? Math.max(0, CFG.MAX_INTENTOS - 1) : 0, proximo: '', nota: 'reproceso pedido por Juan (18-nov)' });
      out.push({ fila: p.fila, hecho: true, un_intento: uno });
    });
    if (out.some(function (x) { return x.hecho; })) PropertiesService.getScriptProperties().setProperty('ALMA_ACTIVO', '1');
    return { ok: true, filas: out };
  } finally { lock.releaseLock(); }
}
