/* ═══ SNAPSHOT ESTILO JARVIS (Juan, 16-nov-2026) ═══════════════════════════════════════════════════════════════════════
   «Estamos mostrando cuadros con un nombre o un número. Al bento grid tenemos que ponerle de todo […] Si pregunto por un
   huésped, ¡pum!, un snapshot para entender: este es el huésped, este es el problema, estos son los puntos que estamos
   atacando. Igual con socios, apartamentos, edificios, el equipo de recepción y los nuevos proyectos. Como Jarvis, pero que
   se sienta humano, no robot.»
   Encima de los tableros de tarjeta.js (mismas reglas: solo en una llamada de la app, solo administradores, nunca la
   familia; nunca códigos, claves, wifi, teléfonos ni correos) este archivo agrega las piezas que cuentan la historia:
   · destacado (en la cabeza del tablero): lo más importante en una frase.
   · termometro: la experiencia (buena · hay que cuidarla · mala) con el riesgo de mala reseña y su porqué.
   · animo: lo que le molesta y lo que lo tiene feliz.
   · foco: el problema de ahora y lo que estamos haciendo (promesas, temas, tareas).
   · cifras: tres o cuatro números grandes (ocupación, noches, llegadas…).
   · la conversación en dos líneas (resumen).
   LA LECTURA (molesta, feliz, experiencia, riesgo, problema, destacado, resumen) sale de los mensajes con el modelo que ya
   usa el Hub para clasificar (CFG.MODELO_CLASIFICADOR), UNA vez por conversación y por mensaje nuevo: queda en la caché 6 h
   (jvl_…). El mismo tablero otra vez, u otro turno sin mensajes nuevos, no gasta IA. Los mensajes salen de la copia del
   hilo que ya guardó el Hub (hiloCacheGet_) o de lo que trajo ver_conversacion: nunca se llama a Hospitable para esto.
   Sin mensajes del huésped no hay lectura, y lo que no está en los mensajes no se muestra (no se inventa).
   Lo demás (promesas, temas, tareas, estadías, recepción, Grow) son datos que el Hub ya tiene: sin IA. */

var JV_IA_SEG_ = 21600, JV_IA_FALLA_SEG_ = 900, JV_HILO_MAX_ = 24;
var JV_EXP_ = { buena: { nivel: 86, v: 'Buena', tono: 'libre' }, regular: { nivel: 55, v: 'Hay que cuidarla', tono: 'aviso' }, mala: { nivel: 22, v: 'Mala', tono: 'alerta' } };
var JV_RIESGO_ = { bajo: { v: 'Bajo', tono: 'libre' }, medio: { v: 'Medio', tono: 'aviso' }, alto: { v: 'Alto', tono: 'alerta' } };
var JV_PROMPT_ = 'Eres el ojo de Alma, la asistente de Spacio AM (apartamentos de estadía corta en Guatemala). Lees la conversación con un huésped y le dices al dueño, en segundos, cómo va. ' +
  'Devuelve SOLO un JSON, sin texto alrededor: {"resumen":"","molesta":[],"feliz":[],"experiencia":"buena|regular|mala","riesgo_resena":"bajo|medio|alto","porque":"","problema":"","destacado":""}. ' +
  'Reglas: 1) Solo lo que está escrito en la conversación. Si algo no está, déjalo vacío ("" o []). Nunca adivines. ' +
  '2) resumen: cómo va la comunicación en máximo 30 palabras. molesta y feliz: hasta 3 puntos cada uno, de máximo 8 palabras, de lo que el huésped dijo o mostró. ' +
  '3) experiencia: buena si está contento o todo fluye; regular si hay una molestia o algo pendiente; mala si está molesto o algo grave sigue sin resolver. ' +
  '4) riesgo_resena (de que deje una mala reseña): alto solo con una queja fuerte sin resolver, una amenaza de reseña o una promesa incumplida; medio con una molestia abierta; bajo si todo va bien o ya se resolvió. porque: la razón en máximo 14 palabras. ' +
  '5) problema: el problema de AHORA sin resolver, en máximo 14 palabras ("" si no hay). destacado: lo más importante para el dueño en una frase de máximo 16 palabras. ' +
  '6) Español simple y cálido, como lo diría una persona. Sin códigos, claves, contraseñas, wifi, teléfonos, correos ni montos.';

function jvHash_(s) { var h = 5381; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
/* Lo que se ve: sin teléfonos, correos ni nada que parezca un código o una clave (si lo parece, no sale). */
function jvTxt_(t, n) {
  t = tvTxt_(t); if (!t || tvSecreto_('', t)) return '';
  t = tvSinTel_(t.replace(TV_CORREO_, ' ')).replace(/\b\d{5,}\b/g, '').replace(/\s+/g, ' ').trim();
  return t ? tvTxt_(t, n || 140) : '';
}
function jvLista_(a, n, largo) {
  var out = [];
  (Array.isArray(a) ? a : []).forEach(function (x) { var t = String(x || '').replace(/\D/g, '').length >= 7 || TV_CORREO_.test(String(x || '')) ? '' : jvTxt_(x, largo || 64); TV_CORREO_.lastIndex = 0; if (t && out.indexOf(t) < 0 && out.length < n) out.push(t.replace(/\.$/, '')); });
  return out;
}

/* ── La lectura de la conversación (IA una vez, caché 6 h) ── */
/* El hilo que ya está guardado (copia de respaldo de 6 h): sin llamar a nadie. */
function jvHiloGuardado_(conv) {
  if (!conv || typeof hiloCacheGet_ !== 'function') return [];
  try { return hiloCacheGet_(String(conv), false) || []; } catch (e) { return []; }
}
function jvLectura_(conv, hilo, o) {
  o = o || {};
  var msgs = (hilo || []).filter(function (m) { return m && tvTxt_(m.texto); }).slice(-JV_HILO_MAX_);
  if (!conv || !msgs.some(function (m) { return m.tipo === 'guest'; })) return null;
  var ult = msgs[msgs.length - 1];
  var clave = 'jvl_' + jvHash_(String(conv) + '|' + msgs.length + '|' + String(ult.created || '') + '|' + tvTxt_(ult.texto, 60));
  var c = CacheService.getScriptCache(), hit = c.get(clave);
  if (hit) { try { var h = JSON.parse(hit); return h && h.ok ? h : null; } catch (e) {} }
  if (o.soloCache || TV_SIN_PEDIR_ || typeof claude_ !== 'function') return null;   // lo que no se va a ver no gasta IA
  var texto = msgs.map(function (m) {
    var de = m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'AUTOMÁTICO' : 'SPACIO AM';
    return de + ' · ' + String(m.created || '').slice(0, 16).replace('T', ' ') + ': ' + tvTapar_(tvTxt_(m.texto, 360));
  }).join('\n');
  var raw = ''; try { raw = claude_(CFG.MODELO_CLASIFICADOR, 500, JV_PROMPT_, 'CONVERSACIÓN (de la más vieja a la más nueva):\n' + texto, 0); } catch (e) { console.error('jvLectura_: ' + e); }
  var lec = jvLecturaLimpia_(raw);
  try { c.put(clave, JSON.stringify(lec || { ok: false }), lec ? JV_IA_SEG_ : JV_IA_FALLA_SEG_); } catch (e) {}
  return lec;
}
/* Solo lo que vale: enumeraciones conocidas, textos cortos y limpios. */
function jvLecturaLimpia_(raw) {
  var m = /\{[\s\S]*\}/.exec(String(raw || '')), j = null;
  try { j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
  if (!j || typeof j !== 'object') return null;
  var exp = String(j.experiencia || '').toLowerCase(), rg = String(j.riesgo_resena || j.riesgo || '').toLowerCase();
  var out = { ok: true, resumen: jvTxt_(j.resumen, 220), molesta: jvLista_(j.molesta, 3), feliz: jvLista_(j.feliz, 3),
    experiencia: JV_EXP_[exp] ? exp : '', riesgo: JV_RIESGO_[rg] ? rg : '', porque: jvTxt_(j.porque, 120), problema: jvTxt_(j.problema, 120), destacado: jvTxt_(j.destacado, 140) };
  return out.resumen || out.molesta.length || out.feliz.length || out.experiencia ? out : null;
}

/* ── Las piezas ── */
/* El termómetro: la lectura manda; las señales del Hub (promesa vencida, mensaje esperando) la bajan y dicen por qué.
   Sin lectura ni señales, no hay termómetro. */
function jvTermometro_(lec, sen, k) {
  sen = sen || {};
  var exp = lec && JV_EXP_[lec.experiencia], rg = lec && lec.riesgo ? JV_RIESGO_[lec.riesgo] : null;
  var nivel = exp ? exp.nivel : null, porque = lec && lec.porque ? lec.porque : '';
  if (sen.vencida) { nivel = Math.min(nivel == null ? 50 : nivel, 40); if (!rg || rg === JV_RIESGO_.bajo) rg = JV_RIESGO_.medio; if (!porque) porque = 'Le prometimos algo y se venció: ' + sen.vencida; }
  if (sen.espera) { nivel = nivel == null ? 62 : Math.min(nivel, Math.max(30, nivel - 10)); if (!porque) porque = 'Escribió ' + sen.espera + ' y todavía espera respuesta.'; }
  if (nivel == null) return null;
  var e = nivel >= 70 ? JV_EXP_.buena : nivel >= 45 ? JV_EXP_.regular : JV_EXP_.mala;
  return { id: 'experiencia', tipo: 'termometro', tam: 'ancho', prioridad: 2.2, k: k || 'Experiencia', nivel: nivel, v: e.v, tono: e.tono,
    riesgo: rg ? rg.v : '', riesgoTono: rg ? rg.tono : '', porque: jvTxt_(porque, 140) };
}
function jvAnimo_(lec) {
  if (!lec || (!lec.molesta.length && !lec.feliz.length)) return null;
  return { id: 'animo', tipo: 'animo', tam: 'ancho', prioridad: 2.6, molesta: lec.molesta, feliz: lec.feliz };
}
function jvFoco_(problema, acciones, k) {
  acciones = (acciones || []).filter(function (a) { return a && a.v; });
  problema = jvTxt_(problema, 140);
  if (!problema && !acciones.length) return null;
  return { id: 'foco', tipo: 'foco', tam: 'ancho', prioridad: 2.4, k: k || 'El problema', problema: problema, kAcciones: 'Lo que estamos haciendo', acciones: tvRecortar_(acciones, 4) };
}
function jvCifras_(items, prioridad) {
  items = (items || []).filter(function (x) { return x && x.k && x.v !== '' && x.v !== undefined && x.v !== null; }).slice(0, 4);
  return items.length >= 2 ? { id: 'cifras', tipo: 'cifras', tam: 'ancho', prioridad: prioridad || 1.8, items: items } : null;
}
function jvDestacado_(texto, tono) { texto = jvTxt_(texto, 150); return texto ? { texto: texto, tono: tono || 'info' } : null; }
/* «hoy 14:10» → «hoy a las 14:10»; «vie 14 nov 10:00» → «el vie 14 nov 10:00». */
function jvCuando_(h) { h = tvTxt_(h); return !h ? 'hace un rato' : /^(hoy|ayer)\b/i.test(h) ? h.replace(/\s(\d{1,2}:\d\d)$/, ' a las $1') : 'el ' + h; }
function jvMeter_(t, c) { if (c) t.cuadros.push(c); }
function jvPct_(n, d) { return d ? Math.round(n / d * 100) + '%' : ''; }

/* Lo que ya estamos haciendo por una conversación: sus promesas (abiertas o vencidas) y sus temas abiertos. */
function jvAccionesHuesped_(conv, codigo) {
  var out = [], cod = String(codigo || '').toUpperCase(), vence = function (v) { v = tvTxt_(v); return /^\d{4}-\d\d-\d\dT/.test(v) ? tvHora_(v) : tvTxt_(v, 16); };
  try {
    if (typeof hubPromesas_ === 'function') (hubPromesas_(false).promesas || []).forEach(function (p) {
      if (!p || (String(p.conv_id) !== String(conv) && !(cod && String(p.codigo || '').toUpperCase() === cod))) return;
      var q = jvTxt_(p.que, 90); if (!q) return;
      out.push({ t: p.estado === 'vencida' ? 'Vencida' : 'Promesa', v: q, d: vence(p.vence) ? 'vence ' + vence(p.vence) : '', tono: p.estado === 'vencida' ? 'alerta' : 'aviso' });
    });
  } catch (e) { console.error('jvAccionesHuesped_ promesas: ' + e); }
  if (!TV_SIN_PEDIR_) try {
    if (typeof temaFilas_ === 'function') temaFilas_().forEach(function (t) {
      if (!t || t.estado !== 'abierto' || (String(t.origen_id) !== String(conv) && !(cod && String(t.origen_id).toUpperCase() === cod))) return;
      var q = jvTxt_(t.ultimo_paso, 90) || jvTxt_(t.titulo, 60); if (!q) return;
      out.push({ t: t.espera === 'juan' ? 'Tu opinión' : 'En curso', v: q, d: '', tono: t.espera === 'juan' ? 'aviso' : 'info' });
    });
  } catch (e) { console.error('jvAccionesHuesped_ temas: ' + e); }
  return out;
}

/* ── El huésped (reserva o conversación) ── o: { conv, codigo, hilo, pend, cancel, registro, entrada, hoy } */
function jvHuesped_(t, o) {
  if (!t || !Array.isArray(t.cuadros)) return t;
  o = o || {};
  var hilo = o.hilo || jvHiloGuardado_(o.conv), lec = jvLectura_(o.conv, hilo);
  var acc = o.cancel ? [] : jvAccionesHuesped_(o.conv, o.codigo), venc = acc.filter(function (a) { return a.t === 'Vencida'; })[0];
  var term = o.cancel ? null : jvTermometro_(lec, { vencida: venc && venc.v, espera: o.pend && jvCuando_(o.pend.hora) });
  jvMeter_(t, term);
  jvMeter_(t, jvFoco_(lec && lec.problema, acc));
  jvMeter_(t, jvAnimo_(lec));
  if (lec && lec.resumen) t.cuadros.push({ id: 'conversacion', tipo: 'resumen', tam: 'ancho', prioridad: 2.8, k: 'La conversación', texto: lec.resumen });
  /* Lo importante, arriba: la lectura; si no hay, lo que el Hub sabe con certeza. */
  var hoy = o.hoy || tvHoy_();
  t.destacado = jvDestacado_(lec && lec.destacado, term ? term.tono : 'info')
    || (venc ? jvDestacado_('Promesa vencida: ' + venc.v, 'alerta') : null)
    || (o.pend ? jvDestacado_('Escribió ' + jvCuando_(o.pend.hora) + ' y todavía espera respuesta.', 'aviso') : null)
    || (!o.cancel && o.entrada && String(o.entrada).slice(0, 10) === hoy && o.registro !== 'completo' ? jvDestacado_('Llega hoy y su registro sigue pendiente.', 'aviso') : null);
  /* La app de antes (sin cuadros) lo ve en sus líneas. */
  if (term) t.datos = (t.datos || []).concat(['Experiencia: ' + term.v + (term.riesgo ? ' · riesgo de mala reseña ' + term.riesgo.toLowerCase() : '')]);
  if (lec && lec.problema) t.detalle = (t.detalle || []).concat(['Problema: ' + lec.problema]);
  if (term || (lec && lec.problema)) t.resumen = String(t.resumen || '').replace(/\)$/, '') + (/\)$/.test(String(t.resumen || '')) ? ', cómo va su experiencia)' : ' y cómo va su experiencia');
  return t;
}

/* ── El apartamento: el mes que viene, su huésped de hoy y lo que está pendiente ── */
function jvNochesOcupadas_(est, claves, desde, dias) {
  var n = 0;
  for (var i = 0; i < dias; i++) {
    var f = tvMasDias_(desde, i);
    if ((est || []).some(function (e) { return e && e.tipo !== 'consulta' && claves[calpClave_(e.propiedad)] && e.checkin <= f && f < e.checkout; })) n++;
  }
  return n;
}
function jvApartamento_(t, nombre, est) {
  if (!t || !Array.isArray(t.cuadros)) return t;
  var cl = tvClavesProp_(nombre), hoy = tvHoy_(), m = tvMovimientos_(cl, est), n30 = jvNochesOcupadas_(est, cl, hoy, 30);
  var lleg30 = (est || []).filter(function (e) { return e && e.tipo !== 'consulta' && cl[calpClave_(e.propiedad)] && e.checkin >= hoy && e.checkin < tvMasDias_(hoy, 30); }).length;
  jvMeter_(t, jvCifras_([{ k: 'Ocupación', v: jvPct_(n30, 30), d: 'próximos 30 días' }, { k: 'Llegadas', v: String(lleg30), d: 'en 30 días' },
    m.dentro[0] ? { k: 'Hoy', v: 'Ocupado', d: 'sale ' + tvCuando_(m.dentro[0].checkout).toLowerCase() } : { k: 'Hoy', v: 'Libre', d: m.proxima ? 'llega ' + tvCuando_(m.proxima.checkin).toLowerCase() : 'sin llegadas' }]));
  /* Su huésped de hoy: la lectura solo si ya está en la caché (no se gasta IA por un apartamento). */
  var d0 = m.dentro[0], lec = null, ib = null;
  if (d0) { var inbox = tvInbox_(); ib = inbox.filter(function (y) { return d0.codigo && String(y.codigo || '').toUpperCase() === String(d0.codigo).toUpperCase(); })[0] || null; if (ib) lec = jvLectura_(ib.conv_id, jvHiloGuardado_(ib.conv_id), { soloCache: true }); }
  var term = jvTermometro_(lec, {}, 'Huésped de hoy · ' + tvQuien_(d0));
  jvMeter_(t, term); jvMeter_(t, jvAnimo_(lec));
  var pend = tvPendientes_(cl), venc = pend.filter(function (p) { return p.tono === 'alerta'; });
  t.destacado = venc.length ? jvDestacado_('Hay ' + (venc.length === 1 ? 'una promesa vencida' : venc.length + ' promesas vencidas') + ': ' + venc[0].v, 'alerta')
    : d0 ? jvDestacado_(tvQuien_(d0) + ' está hoy; sale ' + tvCuando_(d0.checkout).toLowerCase() + (m.proxima ? '. Después llega ' + tvQuien_(m.proxima) + ' ' + tvCuando_(m.proxima.checkin).toLowerCase() : '') + '.', 'info')
    : m.proxima ? jvDestacado_('Libre hoy. La próxima llegada es ' + tvCuando_(m.proxima.checkin).toLowerCase() + ' (' + tvQuien_(m.proxima) + ').', 'libre')
    : jvDestacado_('Libre hoy y sin llegadas en los próximos 60 días.', 'aviso');
  t.datos = (t.datos || []).concat(['Ocupación 30 días: ' + jvPct_(n30, 30)]);
  return t;
}

/* ── El edificio: cómo está esta noche y lo que falta en sus apartamentos ── */
function jvEdificio_(t, e, est) {
  if (!t || !Array.isArray(t.cuadros) || !e) return t;
  var claves = {}; e.props.forEach(function (n) { Object.keys(tvClavesProp_(n)).forEach(function (k) { claves[k] = 1; }); });
  var hoy = tvHoy_(), N = e.props.length, m = tvMovimientos_(claves, est), noche = {};
  m.dentro.forEach(function (x) { noche[calpClave_(x.propiedad)] = 1; });
  var nOcup = Object.keys(noche).length, n30 = 0;
  e.props.forEach(function (p) { n30 += jvNochesOcupadas_(est, tvClavesProp_(p), hoy, 30); });
  jvMeter_(t, jvCifras_([{ k: 'Esta noche', v: jvPct_(nOcup, N), d: nOcup + ' de ' + N + ' ocupados' }, { k: '30 días', v: jvPct_(n30, N * 30), d: n30 + ' noches' },
    { k: 'Hoy', v: String(m.llegan.length + m.salen.length), d: m.llegan.length + ' llegan · ' + m.salen.length + ' salen' }], 1.8));
  var pend = tvPendientes_(claves);
  if (pend.length) t.cuadros.push({ id: 'pendientes', tipo: 'lista', tam: 'ancho', prioridad: 2.4, k: 'Lo que estamos atendiendo', chip: String(pend.length), tono: pend.some(function (p) { return p.tono === 'alerta'; }) ? 'alerta' : 'aviso', items: tvRecortar_(pend, 4) });
  var venc = pend.filter(function (p) { return p.tono === 'alerta'; });
  t.destacado = venc.length ? jvDestacado_((venc.length === 1 ? 'Una promesa vencida' : venc.length + ' promesas vencidas') + ' en el edificio: ' + venc[0].v, 'alerta')
    : jvDestacado_(nOcup + ' de ' + N + ' apartamentos ocupados esta noche' + (m.llegan.length ? '; ' + (m.llegan.length === 1 ? 'llega 1 huésped' : 'llegan ' + m.llegan.length + ' huéspedes') + ' hoy' : '') + '.', nOcup ? 'info' : 'aviso');
  return t;
}

/* ── El socio: lo que espera de nosotros, en una frase ── */
function jvSocio_(t) {
  if (!t || !Array.isArray(t.cuadros)) return t;
  var de = function (id) { return t.cuadros.filter(function (c) { return c.id === id; })[0]; };
  var ped = de('pedidos'), ficha = de('ficha'), oc = de('ocupacion'), dep = de('deposito');
  var espera = ped ? ped.items.filter(function (x) { return x.t === 'Tu opinión'; }) : [], ret = ficha ? ficha.items.filter(function (x) { return x.t === 'Retomar'; })[0] : null;
  t.destacado = espera.length ? jvDestacado_('Espera tu opinión: ' + espera[0].v, 'aviso')
    : ret ? jvDestacado_('Para retomar con él: ' + ret.v, 'info')
    : ped && ped.items.length ? jvDestacado_((ped.items.length === 1 ? 'Tiene un pedido abierto: ' : 'Tiene ' + ped.items.length + ' pedidos abiertos; el último: ') + ped.items[0].v, 'info')
    : oc ? jvDestacado_('El último mes sus apartamentos tuvieron ' + oc.v + ' de ocupación' + (dep ? ' y le toca ' + dep.v : '') + '.', 'info') : null;
  if (ped && ped.items.length) { ped.k = 'Lo que estamos atendiendo'; ped.prioridad = 2.4; }
  return t;
}

/* ── La recepción de un edificio (contacto tipo recepción): llegadas de hoy y si su registro le llegó ── */
var JV_RECEP_EST_ = { ok: ['Enviado', 'info'], entregado: ['Entregado', 'libre'], leido: ['Leído', 'libre'], no_entregado: ['No llegó', 'alerta'], cola: ['En cola', 'aviso'], error: ['Falló', 'alerta'] };
function jvRecepcion_(f) {
  f = f || {};
  var props = String(f.propiedades || '').split(/[,;\n]/).map(function (x) { return tvTxt_(x, 60); }).filter(Boolean);
  var ed = props[0] ? (calpPartes_(props[0]).edificio || props[0]) : tvTxt_(String(f.nombre || '').replace(/^recepci[oó]n\s*/i, ''), 40);
  if (!ed) return null;
  var todos = []; try { todos = (tvEstadias_() || []).map(function (e) { return e.propiedad; }); } catch (e) {}
  var grupo = typeof tvEdificioDe_ === 'function' ? tvEdificioDe_(ed, props, todos) : null, nombres = grupo ? grupo.props : props;
  var claves = {}; (nombres.length ? nombres : [ed]).forEach(function (n) { Object.keys(tvClavesProp_(n)).forEach(function (k) { claves[k] = 1; }); });
  var est = tvEstadias_(), m = tvMovimientos_(claves, est), inbox = m.llegan.length ? tvInbox_() : [];
  var codes = m.llegan.map(function (x) { return String(x.codigo || '').toUpperCase(); }).filter(Boolean), rs = {};
  try { if (codes.length && typeof recepcionEstados_ === 'function') rs = recepcionEstados_(codes).estados || {}; } catch (e) { console.error('jvRecepcion_: ' + e); }
  var items = m.llegan.map(function (x) {
    var s = rs[String(x.codigo || '').toUpperCase()], e = s && JV_RECEP_EST_[s.e];
    return { t: e ? e[0] : 'Sin registro', v: (calpPartes_(x.propiedad).unidad || tvLugar_(x.propiedad)) + ' · ' + tvQuien_(x), d: tvNoches_(x.checkin, x.checkout) + ' noches', tono: e ? e[1] : 'aviso',
      foto: tvFotoHuesped_(x, inbox), iniciales: tvIniciales_(x.huesped) };
  });
  var malos = items.filter(function (x) { return x.tono === 'alerta'; }).length, sin = items.filter(function (x) { return x.t === 'Sin registro'; }).length;
  var foto = ''; nombres.some(function (n) { foto = tvFotoProp_(n); return !!foto; });
  var co = null; nombres.some(function (n) { co = tvCoords_(n); return !!co; });
  var titulo = 'Recepción ' + ed, cuadros = [
    { id: 'foto', tipo: 'foto', tam: foto ? 'alto' : 'm', prioridad: 1, fondo: foto, de: foto ? 'propiedad' : '', iniciales: tvIniciales_(ed), alt: foto ? 'Foto de ' + ed : '', chip: 'Recepción', tono: 'info' },
    { id: 'llegadas', tipo: 'dato', tam: 's', prioridad: 2, k: 'Llegadas hoy', v: items.length ? String(items.length) : 'Ninguna', d: items.length ? items.length - malos - sin + ' con registro enviado' : '' },
    { id: 'salidas', tipo: 'dato', tam: 's', prioridad: 3, k: 'Salidas hoy', v: m.salen.length ? String(m.salen.length) : 'Ninguna' }
  ];
  if (items.length) cuadros.push({ id: 'registros', tipo: 'lista', tam: 'ancho', prioridad: 2.4, k: 'Registros de hoy', chip: String(items.length), tono: malos ? 'alerta' : 'info', items: tvRecortar_(items, 5) });
  /* Lo último que escribió la recepción (su conversación en la bandeja; nunca su número). */
  var conv = inbox.length ? inbox : tvInbox_(), suya = conv.filter(function (y) { return String(y.tipo) === 'recepcion' && calpClave_(String(y.propiedad || '')).indexOf(calpClave_(ed)) >= 0; })[0];
  if (suya && jvTxt_(suya.ultimo_texto)) cuadros.push({ id: 'ultimo', tipo: 'resumen', tam: 'ancho', prioridad: 2.8, k: 'Lo último que escribió' + (tvHora_(suya.ultimo_ts) ? ' · ' + tvHora_(suya.ultimo_ts) : ''), texto: '«' + jvTxt_(suya.ultimo_texto, 180) + '»' });
  var rel = jvTxt_(f.resumen, 260);
  if (rel) cuadros.push({ id: 'relacion', tipo: 'resumen', tam: 'm', prioridad: 6, k: 'La relación', texto: rel.replace(/\s*·\s*/g, ' · ') });
  if (co) cuadros.push({ id: 'mapa', tipo: 'mapa', tam: 'm', prioridad: 5, lat: co.lat, lng: co.lng, lugar: ed });
  /* Cómo va hoy con recepción (no es una nota de la persona: es si tiene todo lo que necesita para dejar entrar). */
  if (items.length) cuadros.push({ id: 'experiencia', tipo: 'termometro', tam: 'ancho', prioridad: 2.2, k: 'Hoy con recepción', nivel: malos ? 25 : sin ? 55 : 90,
    v: malos ? 'Hay que reenviar' : sin ? 'Falta un registro' : 'Al día', tono: malos ? 'alerta' : sin ? 'aviso' : 'libre', riesgo: '', riesgoTono: '',
    porque: malos ? (malos === 1 ? 'Un registro no le llegó.' : malos + ' registros no le llegaron.') : sin ? (sin === 1 ? 'Un huésped todavía no manda su registro.' : sin + ' huéspedes todavía no mandan su registro.') : 'Todos los registros de hoy le llegaron.' });
  var t = { tipo: 'recepcion', clave: 'recepcion:' + calpClave_(ed), ref: ed, etiqueta: 'Recepción', titulo: titulo, sub: [grupo && grupo.zona !== 'Otras' ? grupo.zona : '', jvTxt_(f.estado, 40)].filter(Boolean).join(' · '),
    chip: 'Recepción', tono: 'info', foto: foto, iniciales: tvIniciales_(ed), fechas: [], mensajes: [], promesas: [], semana: [], conv: '', tel: '', wa: '',
    datos: [items.length ? items.length + ' llegadas hoy' : 'Sin llegadas hoy', malos ? malos + ' registros sin llegar' : ''].filter(Boolean),
    detalle: items.map(function (x) { return x.t + ': ' + x.v; }), resumen: 'la recepción de ' + ed + ' (llegadas de hoy y sus registros)', cabeza: titulo, cuadros: cuadros };
  t.destacado = malos ? jvDestacado_((malos === 1 ? 'Un registro de hoy no le llegó' : malos + ' registros de hoy no le llegaron') + ': conviene reenviarlo.', 'alerta')
    : items.length ? jvDestacado_(sin ? 'Hoy llegan ' + items.length + '; falta el registro de ' + sin + '.' : 'Hoy llegan ' + items.length + ' y recepción ya tiene todos los registros.', sin ? 'aviso' : 'libre')
    : jvDestacado_('Hoy no llega nadie a ' + ed + '.', 'info');
  return t;
}

/* ── Un proyecto de Grow (captación y montaje): en qué etapa va, qué sigue y desde cuándo ── */
function jvProyecto_(p) {
  if (!p || !p.id) return null;
  var orden = TV_GROW_ETAPAS_.map(function (e) { return e[0]; }), i = orden.indexOf(String(p.etapa || '')), hoy = tvHoy_();
  var lugar = [jvTxt_(p.edificio, 40), jvTxt_(p.apto, 16)].filter(Boolean).join(' '), titulo = lugar || jvTxt_(p.nombre, 40) || 'Proyecto en Grow';
  var dueno = tvSocioLimpio_(p.dueno, 40), v = p.visita, sig = '';
  if (v && !v.completa && /^\d{4}-\d\d-\d\d/.test(String(v.fecha || '')) && String(v.fecha).slice(0, 10) >= hoy) sig = 'Visita ' + tvCuando_(v.fecha).toLowerCase() + (v.asignado ? ' con ' + jvTxt_(v.asignado, 30).split(' ')[0] : '');
  else if (i >= 0 && i < orden.length - 1) sig = TV_GROW_ETAPAS_[i + 1][1];
  var hechas = i >= 0 ? i : 0, total = orden.length - 1;
  var pasos = TV_GROW_ETAPAS_.slice(Math.max(0, i - 2), i >= 0 ? i + 3 : 4).map(function (e, k, arr) {
    var j = orden.indexOf(e[0]); return { h: j < i ? 'Hecho' : j === i ? 'Ahora' : 'Sigue', t: e[1], tono: j === i ? 'aviso' : j < i ? '' : 'info' };
  });
  var cuadros = [
    { id: 'foto', tipo: 'foto', tam: 'm', prioridad: 1, fondo: '', iniciales: tvIniciales_(p.edificio || titulo), chip: 'Grow', tono: 'info' },
    { id: 'etapa', tipo: 'dato', tam: 's', prioridad: 2, k: 'Etapa', v: i >= 0 ? TV_GROW_ETAPAS_[i][1] : (jvTxt_(p.etapa, 20) || 'En Grow'), d: i >= 0 ? 'paso ' + (hechas + 1) + ' de ' + (total + 1) : '' },
    { id: 'sigue', tipo: 'dato', tam: 's', prioridad: 3, k: 'Lo que sigue', v: sig || 'Por definir' }
  ];
  if (dueno) cuadros.push({ id: 'dueno', tipo: 'dato', tam: 's', prioridad: 4, k: 'Dueño', v: dueno });
  cuadros.push({ id: 'avance', tipo: 'cifras', tam: 'ancho', prioridad: 1.8, items: [{ k: 'Avance', v: Math.round(hechas / total * 100) + '%', d: hechas + ' de ' + total + ' etapas' },
    { k: 'Zona', v: jvTxt_(p.zona, 16) || (calpPartes_(lugar).zona !== 'Otras' ? calpPartes_(lugar).zona : '—'), d: jvTxt_(p.edificio, 30) }] });
  cuadros.push({ id: 'camino', tipo: 'linea', tam: 'ancho', prioridad: 2.4, k: 'El camino', items: pasos });
  return { tipo: 'proyecto', clave: 'proyecto:' + jvTxt_(p.id, 24), ref: titulo, etiqueta: 'Proyecto · Grow', titulo: titulo, sub: [jvTxt_(p.zona, 20), dueno].filter(Boolean).join(' · '),
    chip: 'Grow', tono: 'info', foto: '', iniciales: tvIniciales_(titulo), fechas: [], mensajes: [], promesas: [], semana: [], conv: '', tel: '', wa: '',
    datos: ['Etapa: ' + cuadros[1].v, sig ? 'Sigue: ' + sig : ''].filter(Boolean), detalle: dueno ? ['Dueño: ' + dueno] : [],
    resumen: 'el proyecto ' + titulo + ' en Grow (etapa y lo que sigue)', cabeza: titulo, cuadros: cuadros,
    destacado: jvDestacado_('Está en ' + cuadros[1].v.toLowerCase() + (sig ? '; lo que sigue: ' + sig.charAt(0).toLowerCase() + sig.slice(1) : '') + '.', 'info') };
}
/* grow_proyectos con UN proyecto: su tablero. Varios: ninguno (las listas no son tarjetas). */
function jvCandidataGrow_(r) {
  var l = (r && r.ok && Array.isArray(r.proyectos)) ? r.proyectos.filter(function (p) { return p && p.id && p.etapa !== 'descartado'; }) : [];
  if (l.length === 1) tvCandidata_('proyecto', function () { return jvProyecto_(l[0]); });
}
