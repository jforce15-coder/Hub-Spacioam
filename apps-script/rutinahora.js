/* ═══ RUTINA DE CADA HORA (microproyecto «Crear una nueva rutina recurrente», issue #545) ═════════════════════════
   Juan, 15-nov-2026: «cada hora debe revisar los pendientes, notificaciones y limpiar lo que esté pendiente, solucionando
   de forma automática por lo menos el sesenta por ciento usando información a la mano o el historial de respuestas
   previas a preguntas repetitivas» y «que también incluya la revisión y limpieza de promesas pendientes no atendidas por
   humanos». Corre desde aprender() (el disparador de cada hora), después del latido de los agentes.
   Qué hace en cada vuelta (docs/GLOSARIO.md, «Rutina de cada hora»):
   1. Promesas al huésped: repasa TODAS las vivas (no solo las de hace 30 min): cierra las cumplidas, las que ya no
      aplican y las repetidas (las reglas de promesas.js).
   2. Promesas vencidas que ningún humano atendió: si el equipo ya respondió antes algo casi igual (una decisión del
      equipo enviada o una respuesta del equipo que Alma aprendió), Alma la adapta a este huésped y se la manda
      (hubResponder_, que cumple la promesa y cierra su decisión). Solo de 7:00 a 22:00 y como mucho RUTH_MAX_RESP_ por hora.
      Nunca sola: dinero, factura, objetos olvidados, insumos (hay que llevar algo, no decirlo) ni acceso (los códigos son de
      cada huésped). RUTINA_HORA_RESPONDER = no (Propiedades del script) la deja solo proponiendo, sin enviar.
   3. Decisiones del equipo: cierra las que ya se resolvieron en otro lado (la promesa que las abrió ya se cerró, o la
      estadía terminó hace más de un día).
   4. Resumen: UNA tarjeta «Para leer» en Pendientes (sin notificación) con cuántas resolvió de cuántas (meta 60 %) y lo que
      sigue esperando a una persona. Solo si resolvió algo o si cambió lo que espera. La cuenta de las últimas 24 vueltas
      queda en RUTINA_HORA_HIST para medir la meta.
   Cupo: aprender() ya no llega aquí con el cupo de Google en pausa de fondo (cupo.js). */
var RUTH_META_ = 0.6;
var RUTH_MAX_RESP_ = 4;            // respuestas automáticas por hora (cada una llama una vez al modelo)
var RUTH_SEGUNDOS_ = 120;          // tope de la rutina dentro de aprender()
var RUTH_TIPOS_OK_ = { confirmacion: 1, wifi: 1, direccion: 1 };   // lo que se resuelve diciéndolo
var RUTH_MISMA_PROP_ = { wifi: 1, direccion: 1 };                  // solo con una respuesta de la misma propiedad
var RUTH_QUIEN_ = 'Alma (rutina de cada hora)';

function rutinaHora_(o) {
  o = o || {};
  var ahora = o.ahora || Date.now(), hasta = ahora + RUTH_SEGUNDOS_ * 1000, out = { revisadas: 0, resueltas: 0, respondidas: 0, propuestas: [], esperan: [], decisiones: 0 };
  var P = PropertiesService.getScriptProperties();

  /* 1. Promesas: repaso completo con las reglas de siempre. */
  var antes = promFilas_().filas.filter(promViva_);
  out.revisadas += antes.length;
  try { promesasRepasar_({ todas: true, max: 15, hasta: hasta - 60000, ahora: ahora }); } catch (e) { console.error('rutinaHora_ repaso: ' + e); }
  var d = promFilas_(), vivas = d.filas.filter(promViva_);
  out.resueltas += antes.length - vivas.length;

  /* 2. Vencidas sin humano: responder con una respuesta anterior del equipo. */
  var h = +Utilities.formatDate(new Date(ahora), CFG.TZ, 'H'), enviar = P.getProperty('RUTINA_HORA_RESPONDER') !== 'no' && h >= 7 && h < 22;
  var fuentes = null, hechas = 0, convHechas = {};
  vivas.filter(function (f) { return f.estado === 'vencida' && RUTH_TIPOS_OK_[f.tipo || promTipo_(f.que)] && !/^(op|llamada):/.test(f.conv_id) && !promEsInterna_(f); })
    .forEach(function (f) {
      if (hechas >= RUTH_MAX_RESP_ || Date.now() > hasta || convHechas[f.conv_id]) return;
      fuentes = fuentes || rutHFuentes_();
      var cand = rutHParecidas_(f, fuentes); if (!cand.length) return;
      hechas++;
      var r = null; try { r = rutHRedactar_(f, cand); } catch (e) { console.error('rutHRedactar_: ' + e); }
      if (!r) return;
      if (!enviar) { out.propuestas.push({ huesped: f.huesped, propiedad: f.propiedad, que: f.que, mensaje: r.mensaje, conv: f.conv_id }); return; }
      var env = null; try { env = hubResponder_(f.conv_id, r.mensaje, RUTH_QUIEN_); } catch (e) { env = { ok: false, error: String(e && e.message || e) }; }
      if (!env || !env.ok) { console.warn('rutinaHora_: no salió la respuesta de ' + f.id + ': ' + (env && env.error)); return; }
      convHechas[f.conv_id] = 1; out.respondidas++; out.resueltas++;
      /* hubResponder_ la marcó cumplida «por el equipo»: se deja dicho que fue Alma y con qué respuesta anterior. */
      try { var d2 = promFilas_(), g = d2.filas.filter(function (x) { return x.id === f.id; })[0]; if (g) promCerrar_(d2.sh, g, 'cumplida', 'Alma respondió con una respuesta anterior del equipo', promSinNumeros_(r.mensaje), RUTH_QUIEN_); } catch (e) {}
    });

  /* 3. Decisiones del equipo que ya se resolvieron en otro lado. */
  try { var dec = rutHDecisiones_(ahora); out.revisadas += dec.vivas; out.resueltas += dec.cerradas; out.decisiones = dec.cerradas; } catch (e) { console.error('rutHDecisiones_: ' + e); }

  /* Lo que sigue esperando a una persona. */
  promFilas_().filas.filter(function (f) { return f.estado === 'vencida'; }).forEach(function (f) { out.esperan.push((f.huesped || 'Huésped') + (f.propiedad ? ' (' + f.propiedad + ')' : '') + ': ' + String(f.que).slice(0, 120)); });
  out.pct = out.revisadas ? Math.round(out.resueltas * 100 / out.revisadas) : 100;

  /* 4. Resumen. */
  try { rutHHistorial_(P, ahora, out); } catch (e) {}
  try { rutHResumen_(P, out); } catch (e) { console.error('rutHResumen_: ' + e); }
  console.log('rutinaHora_: ' + JSON.stringify({ revisadas: out.revisadas, resueltas: out.resueltas, respondidas: out.respondidas, propuestas: out.propuestas.length, decisiones: out.decisiones, esperan: out.esperan.length, pct: out.pct }));
  return out;
}

/* Respuestas anteriores de personas: decisiones del equipo enviadas (lo que se prometió → lo que se le mandó) y las
   respuestas del equipo que Alma aprendió (ALMA_AUTOMEJORA: pregunta → respuesta_humana). Nunca las de la propia rutina. */
function rutHFuentes_() {
  var out = [];
  try {
    decFilas_().filas.forEach(function (f) {
      if (f.estado !== 'enviada' || /^alma/i.test(String(f.enviado_por || ''))) return;
      var t = decTexto_(f), c = decCtx_(f); if (!t || !f.motivo) return;
      out.push({ conv: f.resId, propiedad: c.propiedad || '', pregunta: String(f.motivo) + ' ' + String(c.texto || '').slice(0, 300), respuesta: t });
    });
  } catch (e) { console.error('rutHFuentes_ decisiones: ' + e); }
  try {
    var sh = hoja_(CFG.TAB_AUTOMEJORA);
    if (sh && sh.getLastRow() >= 2) {
      var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toLowerCase(); });
      var ip = cab.indexOf('pregunta'), ir = cab.indexOf('respuesta_humana'), ic = cab.indexOf('reservation_id'), ipr = cab.indexOf('propiedad');
      var ini = Math.max(2, sh.getLastRow() - 499);
      if (ip >= 0 && ir >= 0) sh.getRange(ini, 1, sh.getLastRow() - ini + 1, cab.length).getValues().forEach(function (v) {
        var p = String(v[ip] || '').trim(), r = String(v[ir] || '').trim(); if (!p || !r) return;
        out.push({ conv: ic >= 0 ? String(v[ic] || '') : '', propiedad: ipr >= 0 ? String(v[ipr] || '') : '', pregunta: p, respuesta: r });
      });
    }
  } catch (e) { console.error('rutHFuentes_ automejora: ' + e); }
  return out;
}

/* Las 3 respuestas anteriores más parecidas a la promesa (palabras con contenido en común, de otra conversación). */
function rutHParecidas_(f, fuentes) {
  var cl = promClaves_(f.que), tipo = f.tipo || promTipo_(f.que); if (cl.length < 2) return [];
  return fuentes.map(function (x) {
    if (x.conv === f.conv_id) return null;
    if (RUTH_MISMA_PROP_[tipo] && (!f.propiedad || x.propiedad !== f.propiedad)) return null;
    var cx = promClaves_(x.pregunta), n = cl.filter(function (k) { return cx.indexOf(k) >= 0; }).length;
    return n >= 2 && n / cl.length >= 0.5 ? { x: x, n: n } : null;
  }).filter(Boolean).sort(function (a, b) { return b.n - a.n; }).slice(0, 3).map(function (y) { return y.x; });
}

/* El modelo decide si una respuesta anterior sirve para ESTE huésped y la adapta; sin inventar datos. → {mensaje} o null. */
function rutHRedactar_(f, cand) {
  var hilo = '';
  try { var hc = hiloConv_(f.conv_id); if (hc && hc.code === 200) hilo = (hc.hilo || []).slice(-10).map(function (m) { return '[' + (m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'SPACIO AM · automático' : 'SPACIO AM') + '] ' + String(m.texto || '').slice(0, 600); }).join('\n'); } catch (e) {}
  if (!hilo) return null;   // sin la conversación no se responde a ciegas
  var sys = 'Eres Alma, de Spacio AM (apartamentos de estadía corta en Guatemala). Le prometimos algo a un huésped y nadie del equipo lo ha cumplido. ' +
    'Tienes respuestas que el equipo ya dio antes a preguntas parecidas de OTROS huéspedes. Decide si alguna responde de verdad lo que se le prometió a ESTE huésped.\n' +
    'Responde solo si la respuesta anterior es una regla o dato general de Spacio AM o de esa misma propiedad, que vale igual para este huésped. ' +
    'NO respondas (responder:false) si depende de algo de este caso que no está en la conversación (disponibilidad, una fecha, un monto, un permiso, revisar algo en el apartamento), ' +
    'si habría que copiar un código, un número, un nombre o una fecha de otro huésped, o si solo volverías a prometer («lo confirmo», «el equipo te escribe»).\n' +
    'Si respondes: el mensaje completo para el huésped en su idioma, con la voz de Spacio AM (cálida, humana, «tú», sin markdown ni firma), corto, sin disculpas largas por la demora.\n' +
    'Devuelve SOLO JSON: {"responder":true|false,"mensaje":"…","por_que":"una frase"}' + (typeof estilo_ === 'function' ? estilo_() : '');
  var usr = 'HUÉSPED: ' + (f.huesped || 'Huésped') + '\nPROPIEDAD: ' + (f.propiedad || '-') + '\nLO QUE SE LE PROMETIÓ: ' + f.que +
    '\n\nCONVERSACIÓN:\n' + hilo + '\n\nRESPUESTAS ANTERIORES DEL EQUIPO:\n' +
    cand.map(function (x, i) { return (i + 1) + '. Pregunta: ' + String(x.pregunta).slice(0, 400) + '\n   Respuesta del equipo: ' + String(x.respuesta).slice(0, 700); }).join('\n');
  USO_REF_ = s_(f.conv_id);
  var raw = String(claude_(CFG.MODELO_REDACTOR, 700, sys, usr, 0.2) || '');
  return rutHValidar_(raw, hilo, cand);
}
/* Del texto del modelo a un mensaje seguro (o null). Separada para probarla sin Apps Script. */
function rutHValidar_(raw, hilo, cand) {
  var m = String(raw || '').match(/\{[\s\S]*\}/); if (!m) return null;
  var j = null; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  var t = j && j.responder ? String(j.mensaje || '').trim() : ''; if (t.length < 15) return null;
  if (PROM_RX_.test(t) || PROM_REPITE_RX_.test(t)) return null;   // volver a prometer no es resolver
  /* Ningún número de dos cifras o más que no venga de la conversación o de la respuesta anterior (códigos, montos, teléfonos). */
  var base = String(hilo || '') + ' ' + cand.map(function (x) { return x.respuesta; }).join(' ');
  var nums = t.match(/\d[\d.,:]*\d/g) || [];   // dos cifras o más: montos, horas, códigos
  if (nums.some(function (n) { return base.indexOf(n) < 0; })) return null;
  return { mensaje: t.slice(0, 1500), por_que: String(j.por_que || '').slice(0, 200) };
}

/* Decisiones vivas ya resueltas en otro lado: la promesa que la abrió se cerró, o la estadía terminó hace más de un día. */
function rutHDecisiones_(ahora) {
  var d = decFilas_(), vivas = d.filas.filter(decViva_), prom = promFilas_().filas, cerradas = 0, lecturas = 0;
  vivas.forEach(function (f) {
    var conv = f.resId, motivo = '';
    if (f.origen === 'promesa') {
      var suyas = prom.filter(function (p) { return p.conv_id === conv; });
      if (suyas.length && !suyas.some(promViva_)) motivo = 'la promesa ya se cerró';
    }
    if (!motivo && !/^(wa|llamada):/.test(conv) && ahora - (Date.parse(f.creado) || ahora) > 86400000 && lecturas++ < 20) {
      var res = promReserva_(conv, ahora - 86400000);   // «hoy» de ayer: terminó hace más de un día
      if (res.checkout && res.hoy > res.checkout) motivo = 'la estadía terminó';
    }
    if (!motivo) return;
    try { decisionCerrar_(conv, RUTH_QUIEN_ + ' · ' + motivo); cerradas++; } catch (e) { console.error('rutHDecisiones_ ' + f.id + ': ' + e); }
  });
  return { vivas: vivas.length, cerradas: cerradas };
}

/* Las últimas 24 vueltas (para medir la meta del 60 %). */
function rutHHistorial_(P, ahora, out) {
  var l = []; try { l = JSON.parse(P.getProperty('RUTINA_HORA_HIST') || '[]'); } catch (e) {}
  l.push({ ts: new Date(ahora).toISOString(), r: out.revisadas, s: out.resueltas, a: out.respondidas, p: out.pct });
  P.setProperty('RUTINA_HORA_HIST', JSON.stringify(l.slice(-24)));
  var tot = l.slice(-24).reduce(function (a, x) { a.r += x.r; a.s += x.s; return a; }, { r: 0, s: 0 });
  out.pct24 = tot.r ? Math.round(tot.s * 100 / tot.r) : 100;
}

/* Una tarjeta «Para leer» (se va sola a la hora), solo si resolvió algo o si cambió lo que espera a una persona. */
function rutHResumen_(P, out) {
  var firma = out.esperan.slice().sort().join('|') + '#' + out.propuestas.length;
  if (!out.resueltas && firma === (P.getProperty('RUTINA_HORA_FIRMA') || '')) return false;
  P.setProperty('RUTINA_HORA_FIRMA', firma);
  if (!out.resueltas && !out.esperan.length && !out.propuestas.length) return false;
  var jefe = chatPrincipal_(); if (!jefe) return false;
  var titulo = 'Rutina de cada hora: resolví ' + out.resueltas + ' de ' + out.revisadas;
  var lineas = ['Resolví ' + out.resueltas + ' de ' + out.revisadas + ' (' + out.pct + ' %; últimas 24 h: ' + out.pct24 + ' %, meta ' + Math.round(RUTH_META_ * 100) + ' %).'];
  if (out.respondidas) lineas.push('· Respondí ' + out.respondidas + (out.respondidas === 1 ? ' promesa' : ' promesas') + ' con una respuesta que el equipo ya había dado.');
  if (out.decisiones) lineas.push('· Cerré ' + out.decisiones + (out.decisiones === 1 ? ' decisión del equipo que ya estaba resuelta.' : ' decisiones del equipo que ya estaban resueltas.'));
  if (out.propuestas.length) {
    lineas.push('', 'Propuestas sin enviar (RUTINA_HORA_RESPONDER = no o fuera de horario):');
    out.propuestas.slice(0, 5).forEach(function (p) { lineas.push('· ' + (p.huesped || 'Huésped') + ': ' + String(p.mensaje).slice(0, 200) + '\n  ' + decEnlace_(p.conv)); });
  }
  if (out.esperan.length) {
    lineas.push('', 'Siguen esperando a alguien del equipo (' + out.esperan.length + '):');
    out.esperan.slice(0, 8).forEach(function (t) { lineas.push('· ' + t); });
    if (out.esperan.length > 8) lineas.push('· …y ' + (out.esperan.length - 8) + ' más');
  }
  var texto = lineas.join('\n');
  return pendAvisar_(jefe, texto, { origen: 'rutina', push: false, clasif: { tipo: 'aviso', area: 'proposito', proyecto: 'Spacio AM', titulo: titulo,
    resumen: lineas[0], aviso: titulo + '.', importancia: 1, tarjeta: null, acciones: [] } });
}
