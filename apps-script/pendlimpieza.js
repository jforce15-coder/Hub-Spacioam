/* ═══ PENDIENTES LIMPIOS (#567 T2; Juan, 16-nov-2026: «debería quedar solo lo relevante») ══════════════════════════
   Medido el 16-nov en ALMA_PENDIENTES: 85 de 163 tarjetas seguían «abierto». 67 eran «Para leer» o «Listo hoy» que nunca
   cambiaban de estado (solo se escondían por tiempo); de las 18 «Necesita tu sí», 3 tenían su tema ya cerrado (2 de ellas
   por cambios que ya se habían unido) y 6 eran del mismo aviso de entrega repetido (2 números). Nada miraba el origen de
   una tarjeta: solo «Ya está», «Responder» o el tema por retomar resuelto en una llamada la cerraban.
   Aquí, en un solo lugar, cada tarjeta abierta se revisa contra su origen (pendMotivoCierre_, sin IA) y, si ya no hace
   falta, se cierra con su motivo (columna «motivo»):
     · su tema (temas.js) se cerró con su resultado → resuelto;
     · los cambios que nombra (PR de GitHub: enlace, «Hub #562», o «#541» junto a unir/PR) ya se unieron o se cerraron → resuelto;
     · pide unir un cambio o avisa que choca (Juan, 17-nov-2026, pc1794936657400: «Claudio recibe la instrucción, valida
       y publica directamente»; unir ya no es un pendiente de Juan) → resuelto, aunque el PR siga abierto;
     · un mensaje que no llegó (entrega.js): Meta ya entregó otro a ese número después, o hay una tarjeta más nueva del
       mismo número → resuelto;
     · el estado del cupo de Google (cupo.js): vale solo el último → resuelto (reemplazada);
     · lo informativo vence por tipo (PEND_VENCE_H_, PEND_VENCE_ORIGEN_H_) y lo que pide a Juan, a los 30 días → vencido.
   Las conversaciones de huéspedes y los pedidos de socios son temas: se cierran por la regla del tema. Los
   microproyectos (Claudio) se cierran en microproyectos.js cuando su PR se une o se cierra, también si preguntaban.
   Preguntas sin respuesta: la tarjeta trae sus opciones (un toque responde, js/sa-nav.js) y, si sigue sin respuesta
   PEND_REPREGUNTA_H_, Alma la vuelve a preguntar UNA sola vez por el canal de siempre (la notificación de la app, con
   sus ajustes por tipo de #551; nivel 2; no abre conversación de ElevenLabs: su tipo no es un resultado, almaabre.js),
   de día, con tope diario y espaciadas. La marca «repregunta» de la tarjeta (o PEND_REPREG_MICRO) impide una segunda.
   Corre en procesarCola cada PEND_LIMPIAR_MIN_ (solo hojas; GitHub solo si el cupo deja lo de fondo). La primera vez
   (PEND_LIMPIEZA_V1) respalda la hoja en ALMA_PENDIENTES_RESPALDO_V1 antes de tocar nada, revisa todas las filas y deja
   el conteo por motivo en el registro (propiedad PEND_LIMPIEZA_REGISTRO). Check con dobles: .github/pendientes-limpios.js. */

/* Cuánto vive lo que no pide nada, por tipo (horas). «Para leer» se queda los 3 días de Notificaciones; «Listo hoy», un
   día. Lo que pide a Juan sigue sus 30 días de siempre (pendVivo_), ahora con su estado «vencido» en la hoja. */
var PEND_VENCE_H_ = { aviso: 72, hecho: 24, atencion: 30 * 24 };
/* Por origen, cuando su aviso caduca antes: el estado del cupo cambia cada hora y solo vale el último. */
var PEND_VENCE_ORIGEN_H_ = { cupo: 12 };
/* Orígenes donde solo vale la tarjeta más nueva (la anterior queda reemplazada). */
var PEND_SOLO_ULTIMA_ = ['cupo'];
var PEND_LIMPIAR_MIN_ = 15;              // cada cuánto se revisa (procesarCola corre cada minuto)
var PEND_REPREGUNTA_H_ = 24;             // una pregunta sin respuesta 24 h: Alma la vuelve a preguntar, una sola vez
var PEND_REPREGUNTA_HASTA_H_ = 7 * 24;   // las más viejas no se reviven
var PEND_REPREGUNTA_DIA_ = 3;            // como mucho 3 re-preguntas en 24 h, y una por pasada
var PEND_REPREGUNTA_ENTRE_MIN_ = 120;    // y entre una y otra, al menos 2 h (nada de ráfagas después de la corrida única)
var PEND_REPREGUNTA_HORAS_ = [8, 20];    // solo de 8:00 a 19:59 de Guatemala
var PEND_PR_MAX_ = 10;                   // PR distintos que se miran en GitHub por pasada (caché en paraClaudePrInfo_)
var PEND_REPOS_ = { hub: 'Hub-Spacioam', app: 'alma-app', grow: 'Grow-spacioam', mi: 'mi-spacioam' };
/* Unir ya no es de Juan (17-nov-2026): con un cambio nombrado, cualquier palabra de unir o de choque; sin él, la frase. */
var PEND_UNIR_RE_ = /\b(unir|unirlo|unirlos|une|unelo|unelos|unamos|choca|choque|chocan|merge|fusionar)\b/;
var PEND_POR_UNIR_RE_ = /\b(por unir|para unir|listos? para unir|pendientes? de unir|falta que lo unas|unir el pr)\b/;

/* ── Lo que dice una tarjeta de sí misma (sin IA) ── */
function pendVenceH_(x) {
  if (x.tipo === 'atencion') return PEND_VENCE_H_.atencion;
  return PEND_VENCE_ORIGEN_H_[String(x.origen || '')] || PEND_VENCE_H_[x.tipo] || PEND_VENCE_H_.aviso;
}
/* Las opciones de una pregunta: las de su tarjeta o, si no trae, las que Alma escribió (chatOpciones_, chat.js). */
function pendOpcionesDe_(x) {
  var tj = null; try { tj = typeof x.tarjeta === 'string' ? (x.tarjeta ? JSON.parse(x.tarjeta) : null) : x.tarjeta; } catch (e) {}
  if (tj && tj.tipo === 'pregunta' && (tj.opciones || []).length >= 2) return tj.opciones.slice(0, 5);
  if (tj) return [];   // una tarjeta de vuelo o de compra no es una pregunta
  var op = null; try { op = chatOpciones_(String(x.detalle || '')); } catch (e) {}
  return op ? op.opciones.slice(0, 5) : [];
}
/* ¿Espera una respuesta de Juan? Una pregunta con opciones, una del chat o de un socio, o un resumen que pregunta. */
function pendEsPregunta_(x) {
  if (x.tipo !== 'atencion' || /^(claude_borrador|entrega)$/.test(String(x.origen || ''))) return false;
  if (pendOpcionesDe_(x).length >= 2 || /^(pregunta|socio)$/.test(String(x.origen || ''))) return true;
  return /\?/.test(String(x.resumen || ''));
}
/* Los cambios (PR) que nombra: enlaces de GitHub, «Hub #562» / «App #76», o «#541» si habla de unir o de PR. */
function pendPrsDe_(x) {
  var t = [x.titulo, x.resumen, x.detalle, x.acciones].map(function (s) { return String(s || ''); }).join('\n'), out = {}, m;
  var dueno = String(PARA_CLAUDE_REPO_).split('/')[0];
  var rx = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g;
  while ((m = rx.exec(t))) out['https://github.com/' + m[1] + '/' + m[2] + '/pull/' + m[3]] = 1;
  var rn = /\b(Hub|App|Grow|Mi)\s*#(\d{1,5})\b/gi;
  while ((m = rn.exec(t))) out['https://github.com/' + dueno + '/' + PEND_REPOS_[m[1].toLowerCase()] + '/pull/' + m[2]] = 1;
  if (/\b(PRs?|unir|une|unido|unidos|fusionar|merge)\b/i.test(t)) {
    var rb = /(^|[^\w#&])#(\d{2,5})\b/g, sin = t.replace(rn, ' ');
    while ((m = rb.exec(sin))) out['https://github.com/' + PARA_CLAUDE_REPO_ + '/pull/' + m[2]] = 1;
  }
  return Object.keys(out);
}
/* ¿Lo que pide es unir un cambio (o avisa que choca)? Sin acentos: «únelo» = «unelo». */
function pendEsDeUnir_(x) {
  var t = [x.titulo, x.resumen, x.detalle].map(function (s) { return String(s || ''); }).join('\n').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PEND_POR_UNIR_RE_.test(t) || (PEND_UNIR_RE_.test(t) && pendPrsDe_(x).length > 0);
}
/* El número de un mensaje que no llegó (entrega.js: «… a Nombre (+50255550000) …»). */
function pendEntregaNum_(x) { var m = /\+(\d{8,15})\b/.exec(String(x.detalle || '') + ' ' + String(x.resumen || '')); return m ? m[1] : ''; }
function pendFin8_(n) { return String(n || '').replace(/\D/g, '').slice(-8); }

/* ── LA REGLA: ¿esta tarjeta abierta ya no hace falta? → { estado, motivo } o null. Sin IA ni internet: lo de afuera
   llega en c = { ahora, temas: {id: tema}, prs: {url: info}, entrega: fn(wa) → {estado, ts}, nueva: {clave: id} }. ── */
function pendMotivoCierre_(x, c) {
  if (String(x.estado) !== 'abierto') return null;
  var edadH = (c.ahora - Number(x.ts || 0)) / 3600000, origen = String(x.origen || '');
  /* 1 · su tema se cerró (el tema solo se cierra con su resultado) */
  var t = x.tema_id ? (c.temas || {})[String(x.tema_id)] : null;
  if (x.tipo === 'atencion' && t && t.estado === 'cerrado') return { estado: 'resuelto', motivo: 'su tema se cerró' + (t.resultado ? ': ' + String(t.resultado).replace(/\s+/g, ' ').slice(0, 90) : '') };
  /* 2 · los cambios que nombra ya se unieron o se cerraron (todos, y todos conocidos) */
  if (x.tipo === 'atencion') {
    var prs = pendPrsDe_(x), info = prs.map(function (u) { return (c.prs || {})[u] || null; });
    if (prs.length && info.every(function (i) { return i && (i.estado === 'unido' || i.estado === 'cerrado'); }))
      return { estado: 'resuelto', motivo: info.some(function (i) { return i.estado === 'unido'; }) ? 'los cambios que esperaba ya se unieron' : 'los cambios que esperaba se cerraron' };
  }
  /* 2b · pedía unir (o avisaba un choque): eso lo hace Claudio, no espera a Juan */
  if (x.tipo === 'atencion' && !/^(socio|pregunta)$/.test(origen) && pendEsDeUnir_(x)) return { estado: 'resuelto', motivo: 'era para unir: Claudio une y publica solo' };
  /* 3 · un mensaje que no llegó: otro sí le llegó después, o hay una tarjeta más nueva del mismo número */
  if (origen === 'entrega') {
    var wa = pendEntregaNum_(x), e = wa && c.entrega ? c.entrega(wa) : null;
    if (e && /^(delivered|read)$/.test(String(e.estado)) && Number(e.ts) > Number(x.ts)) return { estado: 'resuelto', motivo: 'ya le llegó un mensaje a ese número después' };
    if (wa && (c.nueva || {})['entrega:' + pendFin8_(wa)] && (c.nueva || {})['entrega:' + pendFin8_(wa)] !== String(x.id)) return { estado: 'resuelto', motivo: 'repetida: hay una más nueva del mismo número' };
  }
  /* 4 · donde solo vale la última */
  if (PEND_SOLO_ULTIMA_.indexOf(origen) >= 0 && (c.nueva || {})[origen] && (c.nueva || {})[origen] !== String(x.id)) return { estado: 'resuelto', motivo: 'reemplazada por una más nueva' };
  /* 5 · venció por tiempo */
  var h = pendVenceH_(x);
  if (edadH >= h) return { estado: 'vencido', motivo: (x.tipo === 'atencion' ? 'sin respuesta en ' : 'aviso informativo de hace más de ') + (h % 24 ? h + ' h' : (h / 24) + (h === 24 ? ' día' : ' días')) };
  return null;
}
/* La tarjeta más nueva de cada grupo donde solo vale una (cupo; entrega por número). */
function pendMasNuevas_(filas) {
  var n = {}, ts = {};
  filas.forEach(function (x) {
    if (String(x.estado) !== 'abierto') return;
    var o = String(x.origen || ''), k = PEND_SOLO_ULTIMA_.indexOf(o) >= 0 ? o : o === 'entrega' && pendEntregaNum_(x) ? 'entrega:' + pendFin8_(pendEntregaNum_(x)) : '';
    if (k && !(ts[k] >= Number(x.ts))) { ts[k] = Number(x.ts); n[k] = String(x.id); }
  });
  return n;
}

/* ── Cerrar con su motivo: estado y motivo en la hoja; lo que esperaba a Juan suelta su tema por retomar y su tema propio. ── */
function pendCerrarCon_(x, estado, motivo) {
  var sh = hojaPend_();
  sh.getRange(x.fila, PEND_CAB_.indexOf('estado') + 1).setValue(estado);
  sh.getRange(x.fila, PEND_CAB_.indexOf('motivo') + 1).setValue(String(motivo || '').slice(0, 200));
  x.estado = estado;
  if (x.tipo !== 'atencion') return;
  if (x.ret_id) { try { retCambiar_(adminPorEmail_(x.email), function (l) { for (var i = l.length - 1; i >= 0; i--) if (String(l[i].id) === String(x.ret_id)) l.splice(i, 1); }); } catch (e) {} }
  if (estado === 'resuelto') { try { temaTarjetaResuelta_(x); } catch (e) { console.error('pendCerrarCon_ tema: ' + e); } }
}

/* Lo de afuera que la regla necesita: temas (hoja), PR (GitHub, solo si el cupo deja lo de fondo) y entregas (Meta). */
function pendContexto_(filas, ahora) {
  var c = { ahora: ahora, temas: {}, prs: {}, nueva: pendMasNuevas_(filas) };
  try { temaFilas_().forEach(function (t) { c.temas[t.id] = t; }); } catch (e) { console.error('pendContexto_ temas: ' + e); }
  c.entrega = function (wa) { try { return waEntrega_(wa); } catch (e) { return null; } };
  var urls = {};
  filas.forEach(function (x) { if (String(x.estado) === 'abierto' && x.tipo === 'atencion') pendPrsDe_(x).forEach(function (u) { urls[u] = 1; }); });
  var permite = true; try { permite = cupoPermite_('fondo'); } catch (e) {}
  if (permite) Object.keys(urls).slice(0, PEND_PR_MAX_).forEach(function (u) { try { var i = paraClaudePrInfo_(u); if (i) c.prs[u] = i; } catch (e) {} });
  return c;
}
/* Una pasada: cierra lo que ya no hace falta. filas: las que se revisan. Devuelve el conteo por motivo. */
function pendLimpiarFilas_(filas, ahora) {
  var c = pendContexto_(filas, ahora), cuenta = { total: 0 };
  filas.forEach(function (x) {
    var r = pendMotivoCierre_(x, c); if (!r) return;
    try { pendCerrarCon_(x, r.estado, r.motivo); } catch (e) { console.error('pendCerrarCon_: ' + e); return; }
    var k = r.motivo.split(':')[0]; cuenta[k] = (cuenta[k] || 0) + 1; cuenta.total++;
  });
  return cuenta;
}
function pendRegistrar_(clave, cuenta) {
  var P = PropertiesService.getScriptProperties(), reg = {}; try { reg = JSON.parse(P.getProperty('PEND_LIMPIEZA_REGISTRO') || '{}') || {}; } catch (e) {}
  reg[clave] = { ts: new Date().toISOString(), cuenta: cuenta };
  P.setProperty('PEND_LIMPIEZA_REGISTRO', JSON.stringify(reg));
  console.log('Pendientes limpios · ' + clave + ' · ' + JSON.stringify(cuenta));
}

/* ── Una sola vez (PEND_LIMPIEZA_V1): respaldo de la hoja, todas las filas y el conteo en el registro ── */
function pendLimpiezaV1_(ahora) {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('PEND_LIMPIEZA_V1')) return null;
  var ss = ssAlma_(), sh = hojaPend_();
  if (!ss.getSheetByName('ALMA_PENDIENTES_RESPALDO_V1')) sh.copyTo(ss).setName('ALMA_PENDIENTES_RESPALDO_V1');   // antes de tocar nada
  var cuenta = pendLimpiarFilas_(pendFilas_(true), ahora);
  P.setProperty('PEND_LIMPIEZA_V1', new Date(ahora).toISOString() + ' · ' + cuenta.total + ' cerradas');
  pendRegistrar_('PEND_LIMPIEZA_V1', cuenta);
  return cuenta;
}

/* ── Una sola vez (PEND_LIMPIEZA_UNIR_V1, 17-nov-2026): los pendientes viejos de unir ya no son de Juan. Revisa todas las
   filas con la regla 2b, da por hechas las acciones «Unir el PR» y quita los temas por retomar de «solo falta que lo
   unas». Deja el conteo en el registro. ── */
function pendLimpiezaUnirV1_(ahora) {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('PEND_LIMPIEZA_UNIR_V1')) return null;
  var cuenta = pendLimpiarFilas_(pendFilas_(true), ahora);
  cuenta.acciones = 0; cuenta.retomar = 0;
  try {
    var sh = accionesHoja_(), n = sh.getLastRow();
    if (n > 1) sh.getRange(2, 1, n - 1, ACCIONES_CAB_.length).getValues().forEach(function (r, i) {
      if (String(r[5]) === 'pendiente' && /^Unir el PR/i.test(String(r[2]))) { sh.getRange(i + 2, 6).setValue('completada'); cuenta.acciones++; }
    });
  } catch (e) { console.error('pendLimpiezaUnirV1_ acciones: ' + e); }
  try {
    adminsOp_().filter(function (a) { return a.principal; }).forEach(function (adm) {
      retCambiar_(adm, function (l) {
        for (var i = l.length - 1; i >= 0; i--) {
          var t = String(l[i].texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (l[i].origen === 'claude' && (PEND_POR_UNIR_RE_.test(t) || /\bno pude unir\b/.test(t))) { l.splice(i, 1); cuenta.retomar++; }
        }
      });
    });
  } catch (e) { console.error('pendLimpiezaUnirV1_ retomar: ' + e); }
  P.setProperty('PEND_LIMPIEZA_UNIR_V1', new Date(ahora).toISOString() + ' · ' + cuenta.total + ' cerradas · ' + cuenta.acciones + ' acciones · ' + cuenta.retomar + ' por retomar');
  pendRegistrar_('PEND_LIMPIEZA_UNIR_V1', cuenta);
  return cuenta;
}

/* ── Cada PEND_LIMPIAR_MIN_ (procesarCola): la corrida única si falta, la limpieza y la re-pregunta ── */
function pendLimpiar_() {
  var P = PropertiesService.getScriptProperties(), ahora = Date.now(), ult = Number(P.getProperty('PEND_LIMPIEZA_ULT') || 0);
  if (ahora - ult < PEND_LIMPIAR_MIN_ * 60000) return null;
  P.setProperty('PEND_LIMPIEZA_ULT', String(ahora));
  var out = { v1: null, cuenta: null, unir: null, repregunta: null };
  out.v1 = pendLimpiezaV1_(ahora);
  if (!out.v1) { out.cuenta = pendLimpiarFilas_(pendFilas_(), ahora); if (out.cuenta.total) pendRegistrar_('ultima', out.cuenta); }
  try { out.unir = pendLimpiezaUnirV1_(ahora); } catch (e) { console.error('pendLimpiezaUnirV1_: ' + e); }
  try { out.repregunta = pendRepreguntar_(ahora); } catch (e) { console.error('pendRepreguntar_: ' + e); }
  return out;
}

/* ── La re-pregunta: una pregunta sin respuesta PEND_REPREGUNTA_H_, una sola vez, de día y con tope ── */
function pendHoraGt_(ahora) { return new Date(ahora - 6 * 3600000).getUTCHours(); }
function pendRepreguntar_(ahora) {
  var hora = pendHoraGt_(ahora); if (hora < PEND_REPREGUNTA_HORAS_[0] || hora >= PEND_REPREGUNTA_HORAS_[1]) return { hechas: 0, por: 'de noche' };
  var P = PropertiesService.getScriptProperties(), hist = [];
  try { hist = (JSON.parse(P.getProperty('PEND_REPREGUNTA_HIST') || '[]') || []).filter(function (t) { return ahora - Number(t) < 86400000; }); } catch (e) { hist = []; }
  if (hist.length >= PEND_REPREGUNTA_DIA_) return { hechas: 0, por: 'tope del día' };
  if (hist.some(function (t) { return ahora - Number(t) < PEND_REPREGUNTA_ENTRE_MIN_ * 60000; })) return { hechas: 0, por: 'muy seguido' };
  var enRango = function (ts) { var h = (ahora - Number(ts || 0)) / 3600000; return h >= PEND_REPREGUNTA_H_ && h < PEND_REPREGUNTA_HASTA_H_; };
  /* Candidatas: tarjetas de Alma que preguntan y microproyectos donde Claudio pregunta; la más vieja primero. */
  var cand = [];
  pendFilas_().forEach(function (x) {
    if (String(x.estado) !== 'abierto' || x.repregunta || !enRango(x.ts) || !pendEsPregunta_(x)) return;
    cand.push({ ts: x.ts, email: x.email, id: String(x.id), titulo: x.titulo, pregunta: x.resumen, opciones: pendOpcionesDe_(x), origen: x.origen || 'pendientes', x: x });
  });
  var marcas = {}; try { marcas = JSON.parse(P.getProperty('PEND_REPREG_MICRO') || '{}') || {}; } catch (e) {}
  try {
    microFilas_().forEach(function (m) {
      if (m.estado !== MICRO_ESTADOS_.pregunta || marcas[m.id] || !enRango(m.actualizado)) return;
      cand.push({ ts: m.actualizado, email: m.quien, id: 'mp:' + m.id, titulo: m.nombre, pregunta: m.ultima_pregunta, opciones: (m.opciones || []).slice(0, 5), origen: 'claude', micro: m.id });
    });
  } catch (e) { console.error('pendRepreguntar_ micro: ' + e); }
  cand.sort(function (a, b) { return a.ts - b.ts; });
  var c = null, adm = null;
  for (var i = 0; i < cand.length && !c; i++) { var a = adminPorEmail_(cand[i].email); if (a && esAdminPrincipal_(a)) { c = cand[i]; adm = a; } }   // solo el principal
  if (!c) return { hechas: 0, por: 'nada que preguntar' };
  /* La marca va ANTES de avisar: si algo falla después, no se repite (una sola vez, siempre). */
  if (c.x) hojaPend_().getRange(c.x.fila, PEND_CAB_.indexOf('repregunta') + 1).setValue(new Date(ahora).toISOString());
  else { marcas[c.micro] = ahora; Object.keys(marcas).forEach(function (k) { if (ahora - marcas[k] > 30 * 86400000) delete marcas[k]; }); P.setProperty('PEND_REPREG_MICRO', JSON.stringify(marcas)); }
  hist.push(ahora); P.setProperty('PEND_REPREGUNTA_HIST', JSON.stringify(hist));
  avisoPoner_(adm, 'pend_repregunta', { titulo: c.titulo, pregunta: c.pregunta, opciones: c.opciones }, c.id, { nivel: 2, origen: c.origen });
  return { hechas: 1, id: c.id };
}
