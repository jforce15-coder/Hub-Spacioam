/* ═══ Reprocesar filas de ALMA_COLA que quedaron en «error» (robot dsBot) ═══
   18-nov-2026: el Hub viejo (apagado tras el corte a alma@) siguió tomando filas con su cupo de Google agotado y las dejó
   en «error» (envío HTTP 0, hilo HTTP 0, reserva no disponible). Juan pidió que Alma las vuelva a procesar.
   21-nov-2026: solo se leían las últimas 500 filas (la cola ya pasa de 1 500) y las del 16-17 nov no se podían ver ni
   reprocesar. Ahora se busca en TODA la hoja, por bloques: primero solo las columnas «recibido», «estado» y «message_id»
   (baratas) y después la fila completa solo de las que sirven. Así se cuida el cupo de Google.
   · cola_errores    Solo lee. Sin nada: las filas en «error» de las últimas 500 (como antes). Con «desde» y/o «hasta»
                     (ISO o AAAA-MM-DD, día de Guatemala): las de ese rango en toda la hoja. Con «filas» [n…] o
                     «message_ids» […]: esas filas, estén donde estén. Cada fila trae fila, fecha, propiedad, canal,
                     nombre (de pila) y error, más lo de antes (message_id, reservation_id, texto corto, intentos).
                     Con «detalle»: true agrega lo que Alma iba a mandar (borrador) para diagnosticar; nunca manda nada.
   · cola_reprocesar Vuelve a «pendiente» SOLO las filas pedidas ([{fila, message_id}] o [{message_id}]) que sigan en
                     «error» y cuyo message_id coincida, en cualquier parte de la hoja. Alma las procesa por el camino
                     normal: relee el hilo de hoy y, si el equipo ya respondió o no hace falta, no manda nada. Con
                     «un_intento» la fila queda a un intento del tope: si vuelve a fallar, queda en «error» con el motivo
                     exacto y no se reintenta. Nunca manda nada por sí misma. */
var COLA_BLOQUE_ = 500;   // filas por lectura
/* Una columna entera (desde la fila 2), leída por bloques. */
function colaColumna_(sh, col, n) {
  var out = [];
  for (var p = 2; p <= n; p += COLA_BLOQUE_) {
    var k = Math.min(COLA_BLOQUE_, n - p + 1);
    sh.getRange(p, col + 1, k, 1).getValues().forEach(function (r) { out.push(r[0]); });
  }
  return out;
}
/* Filas completas de los números pedidos: los seguidos se leen de una vez (máximo un bloque). */
function colaFilasCompletas_(sh, nums) {
  nums = nums.slice().sort(function (a, b) { return a - b; });
  var out = [];
  for (var i = 0; i < nums.length;) {
    var j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1 && nums[j + 1] - nums[i] < COLA_BLOQUE_) j++;
    sh.getRange(nums[i], 1, nums[j] - nums[i] + 1, COLA_HEADERS.length).getValues().forEach(function (v, k) { out.push({ fila: nums[i] + k, v: v }); });
    i = j + 1;
  }
  return out;
}
/* «2026-11-16» es el día de Guatemala; un ISO completo se respeta. «hasta» con solo fecha incluye ese día entero. */
function colaFechaMs_(s, finDeDia) {
  s = String(s || '').trim(); if (!s) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T00:00:00-06:00') + (finDeDia ? 86400000 : 0);
  var t = Date.parse(s); return isNaN(t) ? 0 : t;
}
/* o: texto «desde» (como antes) u { desde, hasta, filas, message_ids, cualquier_estado }. Devuelve [{ fila, v }]. */
function colaFilasError_(o) {
  if (typeof o !== 'object' || !o) o = { desde: o || '' };
  var sh = hoja_(CFG.TAB_COLA), n = sh.getLastRow(); if (n < 2) return [];
  var deEstado = function (f) { return o.cualquier_estado || f.v[C.estado] === 'error'; };
  var pedidas = (o.filas || []).map(Number).filter(function (x) { return x >= 2 && x <= n; });
  var mids = (o.message_ids || []).map(function (x) { return s_(x); }).filter(Boolean);
  if (mids.length) colaColumna_(sh, C.message_id, n).forEach(function (m, i) { if (mids.indexOf(s_(m)) >= 0) pedidas.push(i + 2); });
  if (pedidas.length || mids.length) {
    pedidas = pedidas.filter(function (x, i, a) { return a.indexOf(x) === i; });
    return pedidas.length ? colaFilasCompletas_(sh, pedidas).filter(deEstado) : [];
  }
  var desde = colaFechaMs_(o.desde, false), hasta = colaFechaMs_(o.hasta, true);
  var primera = desde || hasta ? 2 : Math.max(2, n - 499);   // sin rango: las últimas 500, como antes
  var est = colaColumna_(sh, C.estado, n), rec = desde || hasta ? colaColumna_(sh, C.recibido, n) : null, nums = [];
  for (var f = primera; f <= n; f++) {
    if (!o.cualquier_estado && est[f - 2] !== 'error') continue;
    if (rec) { var t = new Date(rec[f - 2]).getTime(); if (!t || (desde && t < desde) || (hasta && t >= hasta)) continue; }
    nums.push(f);
  }
  return nums.length ? colaFilasCompletas_(sh, nums).filter(deEstado) : [];
}
/* Canal de la fila: por el dato guardado o por el prefijo del id. */
function colaCanal_(id, d) {
  if (d && d.canal) return s_(d.canal);
  id = s_(id);
  if (/^inq:/.test(id)) return 'consulta';
  if (/^wa:/.test(id)) return 'whatsapp';
  if (/^ig:/.test(id)) return 'instagram';
  if (/^fb:/.test(id)) return 'messenger';
  return id ? 'plataforma' : '';
}
function colaErrores_(body) {
  body = body || {};
  var filas = colaFilasError_({ desde: body.desde, hasta: body.hasta, filas: body.filas, message_ids: body.message_ids });
  var inbox = null;
  var bandeja = function (id) { try { inbox = inbox || hubInbox_(); } catch (e) { inbox = []; } return inbox.filter(function (x) { return s_(x.conv_id) === id; })[0] || {}; };
  return { ok: true, total: filas.length, filas: filas.map(function (f) {
    var d = {}; try { d = JSON.parse(f.v[C.datos] || '{}') || {}; } catch (e) {}
    var id = s_(f.v[C.reservation_id] || f.v[C.conversation_id]), ib = d.propiedad ? {} : bandeja(id);
    var rec = f.v[C.recibido] instanceof Date ? f.v[C.recibido].toISOString() : s_(f.v[C.recibido]);
    var out = { fila: f.fila, fecha: rec, recibido: rec, propiedad: s_(d.propiedad || ib.propiedad), canal: colaCanal_(id, d),
      nombre: s_(f.v[C.huesped] || d.huesped || ib.huesped).split(' ')[0], error: s_(f.v[C.nota]).slice(0, 200),
      message_id: s_(f.v[C.message_id]), reservation_id: s_(f.v[C.reservation_id]), huesped: s_(f.v[C.huesped]).split(' ')[0],
      texto: s_(f.v[C.texto]).slice(0, 80), intentos: Number(f.v[C.intentos] || 0), nota: s_(f.v[C.nota]).slice(0, 160) };
    if (body.detalle) out.detalle = { nivel: s_(d.nivel), borrador: s_(d.borrador).slice(0, 2000), largo: s_(d.borrador).length, salida: salidaHuesped_(s_(d.borrador)).ok ? 'limpia' : 'con razonamiento' };
    return out;
  }) };
}
function colaReprocesar_(body) {
  var pedidas = (body && body.filas) || [], unIntento = ((body && body.un_intento) || []).map(Number);
  if (!pedidas.length) return { ok: false, error: 'faltan filas [{fila, message_id}] o [{message_id}]' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'cola ocupada, repite' }; }
  try {
    var sh = hoja_(CFG.TAB_COLA), out = [];
    var todas = colaFilasError_({ filas: pedidas.map(function (p) { return p.fila; }).filter(Boolean), cualquier_estado: true })
      .concat(colaFilasError_({ message_ids: pedidas.filter(function (p) { return !p.fila; }).map(function (p) { return p.message_id; }), cualquier_estado: true }));
    pedidas.forEach(function (p) {
      var f = todas.filter(function (x) { return p.fila ? x.fila === Number(p.fila) : s_(x.v[C.message_id]) === s_(p.message_id); })[0];
      var ref = p.fila || p.message_id;
      if (!f) return out.push({ fila: ref, hecho: false, motivo: 'no encontré esa fila' });
      if (f.v[C.estado] !== 'error') return out.push({ fila: f.fila, hecho: false, motivo: 'ya no está en error' });
      if (s_(f.v[C.message_id]) !== s_(p.message_id)) return out.push({ fila: f.fila, hecho: false, motivo: 'message_id no coincide' });
      var uno = unIntento.indexOf(f.fila) >= 0;
      set_(sh, f, { estado: 'pendiente', intentos: uno ? Math.max(0, CFG.MAX_INTENTOS - 1) : 0, proximo: '', nota: 'reproceso pedido por Juan' });
      out.push({ fila: f.fila, hecho: true, un_intento: uno });
    });
    var hechas = out.filter(function (x) { return x.hecho; }).map(function (x) { return x.fila; });
    if (hechas.length) {
      var props = PropertiesService.getScriptProperties(), previa = Number(props.getProperty('COLA_REPROCESO_DESDE') || 0);
      /* procesarColaNucleo_ lee las últimas 500 filas: una fila más vieja solo la ve si sabe desde dónde leer. */
      props.setProperty('COLA_REPROCESO_DESDE', String(Math.min.apply(null, hechas.concat(previa ? [previa] : []))));
      props.setProperty('ALMA_ACTIVO', '1');
    }
    return { ok: true, filas: out };
  } finally { lock.releaseLock(); }
}

/* ═══ Candado por fila al enviar (21-nov-2026, mensaje doble) ═══════════════════════════════════════════════════════════
   Antes de mandar, la fila se relee de la hoja (no de la foto que la pasada leyó al empezar) y solo sigue si sigue en
   «esperando_envio»; enviarPendiente_ la marca «enviando» justo antes del envío. Una fila que otra pasada ya tomó o
   mandó no sale otra vez. */
function colaTomarFila_(sh, f) {
  var actual = f.v[C.estado];
  try { actual = sh.getRange(f.fila, C.estado + 1).getValue(); } catch (e) {}
  if (actual !== 'esperando_envio') { f.v[C.estado] = actual; console.error('colaTomarFila_: la fila ' + f.fila + ' ya está en «' + actual + '»; no se manda'); return false; }
  return true;
}

/* ═══ cola_descartar (robot): cerrar filas en «error» sin mandar nada ═══════════════════════════════════════════════════
   21-nov-2026: la fila 1532 quedó en «error» y no había forma de cerrarla (Juan: el huésped buscaba otra fecha).
   { filas: [n…], motivo } → cada fila que siga en «error» pasa a «descartado» (final, nunca se procesa ni se manda) con
   el motivo y la fecha en su nota, y queda una línea en ALMA_LOG. Sin motivo no hace nada. Nunca manda nada. */
function colaDescartar_(body) {
  body = body || {};
  var nums = (body.filas || []).map(function (x) { return Number(x && x.fila != null ? x.fila : x); }).filter(function (x) { return x >= 2; });
  var motivo = s_(body.motivo).trim().slice(0, 200);
  if (!nums.length) return { ok: false, error: 'faltan filas [n…]' };
  if (!motivo) return { ok: false, error: 'falta motivo' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'cola ocupada, repite' }; }
  try {
    var sh = hoja_(CFG.TAB_COLA), todas = colaFilasError_({ filas: nums, cualquier_estado: true }), out = [], ts = new Date().toISOString();
    nums.forEach(function (n) {
      var f = todas.filter(function (x) { return x.fila === n; })[0];
      if (!f) return out.push({ fila: n, hecho: false, motivo: 'no encontré esa fila' });
      if (f.v[C.estado] !== 'error') return out.push({ fila: n, hecho: false, motivo: 'no está en error (está en «' + s_(f.v[C.estado]) + '»)' });
      set_(sh, f, { estado: 'descartado', nota: ('descartada por el robot ' + ts.slice(0, 16) + ': ' + motivo + ' · antes: ' + s_(f.v[C.nota])).slice(0, 480) });
      try {
        var d = {}; try { d = JSON.parse(f.v[C.datos] || '{}') || {}; } catch (e) {}
        hoja_(CFG.TAB_LOG).appendRow([Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), s_(d.codigo), s_(d.propiedad), 'DESCARTADO',
          'Fila ' + n + ' de ALMA_COLA descartada: ' + motivo, s_(f.v[C.texto]).slice(0, 300), '', '', '', 'descartada por el robot (no se mandó nada)']);
      } catch (e) { console.error('colaDescartar_ registro: ' + e); }
      out.push({ fila: n, hecho: true });
    });
    return { ok: true, filas: out };
  } finally { lock.releaseLock(); }
}
