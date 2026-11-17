/* ═══ ESTADO DE LOS EQUIPOS, PRECARGADO (Juan, 17-nov-2026) ══════════════════════════════════════════════════════════
   «Mantener precargado e inmediato el estado y resumen de los equipos de operaciones, finanzas y desarrollo (tareas,
   limitaciones y problemas) para poder darlo al instante sin demoras.»

   Antes, «¿cómo van los equipos?» hacía que Alma corriera a cada agente (pedir_a_agente: una revisión con IA de 20 s a
   1 min cada uno) o leyera varias hojas en el turno. Ahora el resumen ya está armado y guardado:
     · eqRefrescar_ lo arma SIN IA, solo leyendo hojas, y lo guarda en la propiedad EQ_RESUMEN (≤ 9 KB):
         Operaciones · su agente (última revisión e informe, propuestas que esperan el sí) + las tareas abiertas de Epi.
         Finanzas    · su agente (igual).
         Desarrollo  · los microproyectos con Claudio (en trabajo, Claudio pregunta, listos para unir, unidos hoy) y los
                       pedidos que fallaron en los últimos 3 días.
       De cada equipo: tareas (lo que tiene entre manos), limitaciones (lo que hoy no puede: en pausa, sin presupuesto,
       el cupo de Google en pausa, solo propone) y problemas (revisión fallida, sin revisar hace más de lo normal,
       propuestas que no salieron, tareas vencidas, Claudio esperando tu respuesta).
     · Se refresca solo: cada hora (aprender, aunque el cupo esté en pausa: solo lee hojas), al terminar la revisión de un
       agente, al aprobar o rechazar propuestas, y Desarrollo también al pedirle algo a Claudio y cuando responde.
     · Se da al instante: la respuesta instantánea «equipos» (instantaneas.js, sin IA: «¿cómo van los equipos?», «estado
       de operaciones y finanzas») y la herramienta de lectura estado_equipos (también en el camino rápido de la voz).
       Si el guardado no existe todavía, se arma en ese momento (una sola vez).
   Solo el administrador principal. EQ_ON = 0 apaga la respuesta instantánea (la herramienta sigue). */

var EQ_EQUIPOS_ = ['operaciones', 'finanzas', 'desarrollo'];
var EQ_NOMBRES_ = { operaciones: 'Operaciones', finanzas: 'Finanzas', desarrollo: 'Desarrollo' };
var EQ_PROP_ = 'EQ_RESUMEN', EQ_MAX_ = 8800, EQ_VIEJO_MIN_ = 180;

function eqOn_() { return String(PropertiesService.getScriptProperties().getProperty('EQ_ON') || '1') !== '0'; }
function eqLinea_(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); n = n || 160; return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
function eqHace_(iso, ahora) {
  var t = new Date(iso).getTime(); if (!t) return '';
  var m = Math.round(((ahora || Date.now()) - t) / 60000);
  if (m < 2) return 'hace un momento'; if (m < 60) return 'hace ' + m + ' min';
  var h = Math.round(m / 60); if (h < 24) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
  var d = Math.round(h / 24); return 'hace ' + d + (d === 1 ? ' día' : ' días');
}
/* El informe del agente en una frase (sin el «Listo: ✓ …» de su prueba). */
function eqInforme_(t) {
  var s = String(t || '').split('\n').map(function (x) { return x.replace(/^[\s·•\-*#]+/, '').trim(); })
    .filter(function (x) { return x && !/^(listo|falta)\s*:/i.test(x) && !/^informe\b/i.test(x); });
  return eqLinea_(s.slice(0, 2).join(' '), 220);
}
/* Cada cuántas horas revisa (sus horas y días): para saber si ya se atrasó. */
function eqEsperaH_(a) {
  var horas = String(a.horas || '').split(/[,\s]+/).filter(String).length || 1, dias = String(a.dias || '1,2,3,4,5,6,7').split(/[,\s]+/).filter(String).length || 7;
  return Math.ceil((24 / horas) * (7 / dias)) + 3;
}

/* ── Un equipo con agente (Operaciones, Finanzas) ── */
function eqAgente_(id, T, P, ahora, cupoPausa, epi) {
  var a = agente_(id), nom = EQ_NOMBRES_[id], o = { id: id, nombre: nom, estado: 'activo', tareas: [], limitaciones: [], problemas: [], informe: '', ultima: '' };
  if (!a) { o.estado = 'sin agente'; o.problemas.push('No encontré al agente de ' + nom + ' en la hoja ALMA_AGENTES.'); return o; }
  o.estado = a.estado || 'activo'; o.ultima = a.ultima ? String(a.ultima) : '';
  var mias = T.filter(function (t) { return t.agente === id; }), ult = mias.slice(-1)[0] || null;
  o.informe = ult ? eqInforme_(ult.informe) : '';
  if (o.ultima) o.tareas.push('Última revisión ' + eqHace_(o.ultima, ahora) + (o.informe ? ': ' + o.informe : '.'));
  else o.tareas.push('Todavía no ha hecho su primera revisión.');
  var pend = P.filter(function (p) { return p.agente === id && p.estado === 'pendiente'; });
  if (pend.length) o.tareas.push(pend.length + (pend.length === 1 ? ' propuesta espera tu sí' : ' propuestas esperan tu sí') + ': ' + pend.slice(0, 3).map(function (p) { return eqLinea_(p.titulo, 70); }).join(' · ') + (pend.length > 3 ? ' · y ' + (pend.length - 3) + ' más' : '') + '.');
  if (id === 'operaciones' && epi) {
    if (epi.error) o.problemas.push('No pude leer las tareas de Epi (' + eqLinea_(epi.error, 60) + ').');
    else {
      o.tareas.push(epi.abiertas + (epi.abiertas === 1 ? ' tarea abierta' : ' tareas abiertas') + ' en Epi' + (epi.hoy ? ' (' + epi.hoy + ' vence' + (epi.hoy === 1 ? '' : 'n') + ' hoy)' : '') + '.');
      if (epi.vencidas) o.problemas.push(epi.vencidas + (epi.vencidas === 1 ? ' tarea vencida' : ' tareas vencidas') + ' en Epi' + (epi.ejemplos.length ? ': ' + epi.ejemplos.join(' · ') : '') + '.');
    }
  }
  /* Limitaciones: lo que hoy no puede. */
  if (o.estado !== 'activo') o.limitaciones.push('Está en pausa: no revisa solo hasta que lo actives en Agentes.');
  var mes = Utilities.formatDate(new Date(ahora), CFG.TZ, 'yyyy-MM'), gasto = a.mes === mes ? Number(a.gasto_mes || 0) : 0, tope = Number(a.presupuesto_usd || 0);
  if (tope > 0 && gasto >= tope) o.limitaciones.push('Ya usó su presupuesto del mes (US$' + tope + '): no revisa hasta el próximo mes.');
  else if (tope > 0 && gasto >= tope * 0.8) o.limitaciones.push('Lleva US$' + gasto.toFixed(2) + ' de US$' + tope + ' del mes.');
  if (cupoPausa && id !== 'operaciones') o.limitaciones.push('El cupo de Google está alto: sus revisiones de fondo están en pausa.');
  o.limitaciones.push(id === 'finanzas' ? 'Solo propone: nunca mueve dinero.' : 'Solo propone: lo que cambia algo afuera espera tu sí.');
  o.limitaciones.push('Revisa ' + eqHorario_(a) + '.');
  /* Problemas: lo que salió mal o se atrasó. */
  if (ult && /no pude terminar|sin respuesta del modelo/i.test(String(ult.informe || ''))) o.problemas.push('Su última revisión no terminó (sin respuesta del modelo).');
  if (ult && ult.estado === 'en_curso' && ahora - new Date(ult.creado).getTime() > 30 * 60000) o.problemas.push('Una revisión quedó a medias desde ' + eqHace_(ult.creado, ahora) + '.');
  if (o.estado === 'activo' && o.ultima && ahora - new Date(o.ultima).getTime() > eqEsperaH_(a) * 3600000) o.problemas.push('No revisa desde ' + eqHace_(o.ultima, ahora) + ' (más de lo normal en su horario).');
  var errores = P.filter(function (p) { return p.agente === id && p.estado === 'error' && ahora - new Date(p.decidido || p.creado).getTime() < 7 * 86400000; });
  if (errores.length) o.problemas.push(errores.length + (errores.length === 1 ? ' propuesta aprobada no salió' : ' propuestas aprobadas no salieron') + ' esta semana: ' + errores.slice(-2).map(function (p) { return eqLinea_(p.titulo, 60); }).join(' · ') + '.');
  return o;
}
function eqHorario_(a) {
  var h = String(a.horas || '').split(/[,\s]+/).filter(String).map(function (x) { return x + ':00'; }), d = String(a.dias || '').split(/[,\s]+/).filter(String);
  var dias = d.length >= 7 || !d.length ? 'todos los días' : d.join(',') === '1,2,3,4,5' ? 'de lunes a viernes' : d.join(',') === '1,2,3,4,5,6' ? 'de lunes a sábado' :
    d.map(function (k) { return ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][Number(k)] || k; }).join(', ');
  return dias + (h.length ? ' a las ' + (h.length > 1 ? h.slice(0, -1).join(', ') + ' y ' + h[h.length - 1] : h[0]) : '');
}

/* ── Desarrollo (Claudio): microproyectos y pedidos ── */
function eqDesarrollo_(ahora) {
  var o = { id: 'desarrollo', nombre: 'Desarrollo', estado: 'activo', tareas: [], limitaciones: [], problemas: [], informe: '', ultima: '' };
  var M = []; try { M = microFilas_(); } catch (e) { o.problemas.push('No pude leer los microproyectos (' + eqLinea_(String(e), 60) + ').'); }
  var hoy = Utilities.formatDate(new Date(ahora), CFG.TZ, 'yyyy-MM-dd');
  var por = function (est) { return M.filter(function (m) { return m.estado === est; }).sort(function (a, b) { return b.actualizado - a.actualizado; }); };
  var trabajo = por(MICRO_ESTADOS_.trabajo).filter(function (m) { return ahora - m.actualizado < 7 * 86400000; });
  var pregunta = por(MICRO_ESTADOS_.pregunta), listo = por(MICRO_ESTADOS_.listo);
  var unidosHoy = por(MICRO_ESTADOS_.unido).filter(function (m) { return m.actualizado && Utilities.formatDate(new Date(m.actualizado), CFG.TZ, 'yyyy-MM-dd') === hoy; });
  var nombres = function (L) { return L.slice(0, 3).map(function (m) { return '«' + eqLinea_(m.nombre, 45) + '»'; }).join(', ') + (L.length > 3 ? ' y ' + (L.length - 3) + ' más' : ''); };
  if (trabajo.length) o.tareas.push(trabajo.length + (trabajo.length === 1 ? ' pedido en trabajo con Claudio' : ' pedidos en trabajo con Claudio') + ': ' + nombres(trabajo) + '.');
  if (listo.length) o.tareas.push(listo.length + (listo.length === 1 ? ' cambio listo para unir' : ' cambios listos para unir') + ': ' + nombres(listo) + '.');
  if (unidosHoy.length) o.tareas.push(unidosHoy.length + (unidosHoy.length === 1 ? ' cambio unido hoy' : ' cambios unidos hoy') + ': ' + nombres(unidosHoy) + '.');
  if (!trabajo.length && !listo.length && !unidosHoy.length) o.tareas.push('Sin pedidos en trabajo ahora.');
  if (M.length) o.ultima = new Date(Math.max.apply(null, M.map(function (m) { return m.actualizado || 0; }))).toISOString();
  /* Problemas: Claudio espera tu respuesta, se trabó o falló. */
  if (pregunta.length) o.problemas.push('Claudio espera tu respuesta en ' + pregunta.length + (pregunta.length === 1 ? ' pedido' : ' pedidos') + ': ' + nombres(pregunta) + '.');
  var trabados = trabajo.filter(function (m) { return ahora - m.actualizado > 3 * 3600000; });
  if (trabados.length) o.problemas.push(trabados.length + (trabados.length === 1 ? ' pedido lleva' : ' pedidos llevan') + ' más de 3 horas sin respuesta de Claudio: ' + nombres(trabados) + '.');
  try {
    var fallos = (paraClaudeLista_(true).pedidos || []).filter(function (p) { return /^fallo/i.test(p.estado) && ahora - new Date(p.fecha).getTime() < 3 * 86400000; });
    if (fallos.length) o.problemas.push(fallos.length + (fallos.length === 1 ? ' pedido falló' : ' pedidos fallaron') + ' en los últimos 3 días: ' + fallos.slice(-2).map(function (p) { return '«' + eqLinea_(p.titulo, 45) + '»'; }).join(', ') + '.');
  } catch (e) {}
  o.limitaciones.push('Trabaja por pedidos: Claudio programa cada uno en su PR y se publica al unirlo.');
  o.limitaciones.push('La ronda de revisión de las apps es los viernes a las 16:00.');
  return o;
}

/* ── Armar y guardar (sin IA; solo lee hojas) ── */
function eqArmar_() {
  var ahora = Date.now(), T = [], P = [], epi = null, cupoPausa = false;
  try { T = agFilas_(hojaAgT_(), AGT_CAB_); } catch (e) {}
  try { P = agFilas_(hojaAgP_(), AGP_CAB_); } catch (e) {}
  try { cupoPausa = !cupoPermite_('fondo'); } catch (e) {}
  try {
    var cfg = epiSnap_(false), hoy = recHoy_();
    if (!cfg || !cfg.tareas) epi = { error: 'Epi sin respuesta' };
    else {
      var ab = cfg.tareas.filter(function (t) { return t && t.id && !t.hecha; });
      var venc = ab.filter(function (t) { return t.vence && String(t.vence).slice(0, 10) < hoy; });
      epi = { abiertas: ab.length, vencidas: venc.length, hoy: ab.filter(function (t) { return String(t.vence || '').slice(0, 10) === hoy; }).length,
        ejemplos: venc.slice(0, 2).map(function (t) { return eqLinea_(t.texto, 50); }) };
    }
  } catch (e) { epi = { error: String(e) }; }
  var equipos = EQ_EQUIPOS_.map(function (id) {
    try { return id === 'desarrollo' ? eqDesarrollo_(ahora) : eqAgente_(id, T, P, ahora, cupoPausa, epi); }
    catch (e) { return { id: id, nombre: EQ_NOMBRES_[id], estado: 'error', tareas: [], limitaciones: [], problemas: ['No pude armar su resumen (' + eqLinea_(String(e), 60) + ').'] }; }
  });
  return { ts: new Date(ahora).toISOString(), equipos: equipos };
}
function eqRefrescar_() {
  var r = eqArmar_(), s = JSON.stringify(r);
  /* Una propiedad guarda 9 KB: se acortan los informes y luego las listas largas, nunca se pierde un equipo. */
  r.equipos.forEach(function (e) { if (s.length > EQ_MAX_) { e.informe = eqLinea_(e.informe, 100); e.tareas = e.tareas.map(function (t) { return eqLinea_(t, 140); }); s = JSON.stringify(r); } });
  r.equipos.forEach(function (e) { if (s.length > EQ_MAX_) { e.tareas = e.tareas.slice(0, 3); e.problemas = e.problemas.slice(0, 3); e.limitaciones = e.limitaciones.slice(0, 2); s = JSON.stringify(r); } });
  try { PropertiesService.getScriptProperties().setProperty(EQ_PROP_, s); } catch (e) { console.error('eqRefrescar_: ' + e); }
  return r;
}
/* Refrescar sin romper a quien llama (al final de una revisión, de una decisión o de una respuesta de Claudio). */
function eqRefrescarSuave_() { try { eqRefrescar_(); } catch (e) { console.error('eqRefrescarSuave_: ' + e); } }
/* Solo Desarrollo (dos hojas, rápido): al pedirle algo a Claudio y cuando responde. */
function eqDesarrolloSuave_() {
  try {
    var p = PropertiesService.getScriptProperties(), r = JSON.parse(p.getProperty(EQ_PROP_) || 'null');
    if (!r || !Array.isArray(r.equipos)) return;
    var d = eqDesarrollo_(Date.now()), i = r.equipos.map(function (e) { return e.id; }).indexOf('desarrollo');
    if (i < 0) return; r.equipos[i] = d;
    var s = JSON.stringify(r); if (s.length <= EQ_MAX_) p.setProperty(EQ_PROP_, s);
  } catch (e) { console.error('eqDesarrolloSuave_: ' + e); }
}
/* Lo guardado (al instante); si no hay nada todavía, se arma una vez. */
function eqResumen_() {
  var r = null; try { r = JSON.parse(PropertiesService.getScriptProperties().getProperty(EQ_PROP_) || 'null'); } catch (e) { r = null; }
  if (!r || !Array.isArray(r.equipos) || !r.equipos.length) r = eqRefrescar_();
  return r;
}

/* ── Qué equipos pidió («operaciones y finanzas», «desarrollo»); vacío = los tres ── */
function eqCuales_(texto) {
  var s = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  var L = EQ_EQUIPOS_.filter(function (id) { return new RegExp('\\b' + { operaciones: 'operacion(?:es)?|ops', finanzas: 'finanzas?|dinero|contab', desarrollo: 'desarrollo|claudio|dev' }[id]).test(s); });
  return L.length ? L : EQ_EQUIPOS_.slice();
}

/* ── El texto para Juan ── voz: una línea por equipo, corta · chat: completo (tareas, limitaciones y problemas) */
function eqTexto_(r, cuales, voz) {
  var L = (r.equipos || []).filter(function (e) { return cuales.indexOf(e.id) >= 0; });
  if (!L.length) return '';
  var edad = eqHace_(r.ts), viejo = Date.now() - new Date(r.ts).getTime() > EQ_VIEJO_MIN_ * 60000;
  if (voz) {
    return L.map(function (e) {
      var t = (e.tareas || []).filter(function (x) { return !/^Última revisión|^Todavía no/.test(x); }).map(function (x) { return x.replace(/:.*$/, ''); }).slice(0, 2);
      var p = (e.problemas || []).map(function (x) { return x.replace(/:.*$/, '').replace(/\.$/, ''); }).slice(0, 2);
      return e.nombre + ': ' + (t.length ? t.join(', ').replace(/\.$/, '') : 'al día') + (p.length ? '; ojo: ' + p.join(', ') : '; sin problemas') + '.';
    }).join(' ');
  }
  var bloque = function (titulo, xs) { return xs && xs.length ? titulo + '\n' + xs.map(function (x) { return '· ' + x; }).join('\n') : ''; };
  return L.map(function (e) {
    return [e.nombre + (e.estado && e.estado !== 'activo' ? ' (' + e.estado + ')' : ''),
      bloque('Tareas', e.tareas), bloque('Problemas', e.problemas.length ? e.problemas : ['Ninguno.']), bloque('Limitaciones', e.limitaciones)].filter(Boolean).join('\n');
  }).join('\n\n') + '\n\n(Actualizado ' + edad + (viejo ? '; lo refresco en la próxima hora' : '') + '.)';
}

/* ── Herramienta estado_equipos (agente.js) y respuesta instantánea (instantaneas.js) ── */
function eqHerramienta_(adm, inp) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'El estado de los equipos es solo del administrador principal.' };
  var r = eqResumen_(), cuales = inp && inp.equipos ? eqCuales_(inp.equipos) : EQ_EQUIPOS_.slice();
  return { ok: true, actualizado: r.ts, hace: eqHace_(r.ts), equipos: (r.equipos || []).filter(function (e) { return cuales.indexOf(e.id) >= 0; }),
    nota: 'Ya está precargado: dalo tal cual, sin pedir_a_agente. Si Juan quiere una revisión nueva de un equipo, entonces sí pedir_a_agente.' };
}
function instEquipos_(adm, r, canal) {
  if (!eqOn_() || !esAdminPrincipal_(adm)) return null;
  var res = eqResumen_(); if (!res || !res.equipos) return null;
  return eqTexto_(res, eqCuales_(r.eq || r.norm), instEsVoz_(canal)) || null;
}
