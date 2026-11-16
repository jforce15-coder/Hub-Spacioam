/* ═══ MEMORIA FRESCA: las últimas 5 llamadas con el principal (Juan, 16-nov-2026) ═══════════════════════════════════════
   «No estamos teniendo contexto de la llamada anterior. Alma debería recordar las últimas 5 llamadas, tenerlas en su
   memoria fresca. Si le hablo de un huésped del que le hablé hace muy poco, debería entender que hablamos de ese Amílcar,
   no de otro. Esa es la primera forma de adivinar a qué nos referimos; la segunda es ir al Hub: ver si alguna de las
   conversaciones recientes tiene ese nombre o esa reserva.»

   Qué guarda (una propiedad por administrador principal, MF_<correo>; corta a propósito):
     ll · las últimas 5 llamadas de cualquier canal con voz (app, WhatsApp, teléfono, conferencia, Modo calle y Claudio):
          cuándo, canal, de qué se habló (el título de ElevenLabs, «sin verificar»), qué quedó pendiente (temas abiertos al
          colgar) y, de Claudio, lo que hizo (pedido creado sí/no, unido).
     me · las personas y reservas que salieron VERIFICADAS por una herramienta (destino.js al elegir destinatario,
          agElegirReserva_ al elegir reserva, las personas de los temas): nombre, rol, apartamento, código, fuente y hora.
   Se actualiza al cerrar cada llamada (vozPostCall_ → mfLlamadaDeVoz_; Claudio → mfClaudio_; Modo calle → mfCalle_).

   Para qué:
     1. mfBloque_: el bloque «ÚLTIMAS LLAMADAS» (~1 200 caracteres máx.) al iniciar cualquier llamada o chat con el principal
        (vozInicio_, opAgente_, claudioWebInicio_). Las personas de cada llamada son las que se verificaron en su ventana.
     2. mfDesempate_: cuando Juan nombra a alguien sin más y hay varios posibles, el orden es
          1) quien salió en las últimas llamadas o en el tema activo (lo más reciente gana),
          2) una conversación reciente de la bandeja del Hub (WhatsApp/plataforma) con ese nombre o esa reserva,
          3) si no, el resolvedor de siempre pregunta (destino.js).
        Lo usan destinoResolver_ y agElegirReserva_, y lo elegido lleva su fuente («lo hablaron hace 10 min»). */
var MF_LLAMADAS_ = 5, MF_MENC_ = 30, MF_MENC_H_ = 48, MF_BANDEJA_H_ = 48, MF_LARGO_ = 1200, MF_CALLE_JUNTA_MS_ = 10 * 60000;
var MF_ADM_ = null;   // el administrador del turno (opAgente_): lo usa el desempate cuando la herramienta no lo pasa

function mfClave_(email) { return 'MF_' + String(email || '').toLowerCase().trim(); }
function mfPara_(adm) { try { return !!(adm && adm.email && esAdminPrincipal_(adm)); } catch (e) { return false; } }
function mfLeer_(email) {
  var o = null; try { o = JSON.parse(PropertiesService.getScriptProperties().getProperty(mfClave_(email)) || 'null'); } catch (e) { o = null; }
  o = o && typeof o === 'object' ? o : {}; o.ll = Array.isArray(o.ll) ? o.ll : []; o.me = Array.isArray(o.me) ? o.me : [];
  return o;
}
function mfEscribir_(email, o) {
  o.ll = o.ll.slice(-MF_LLAMADAS_);
  var corte = Date.now() - MF_MENC_H_ * 3600000; o.me = o.me.filter(function (m) { return m.ts >= corte; }).slice(-MF_MENC_);
  var s = JSON.stringify(o);
  while (s.length > 8500 && o.me.length) { o.me.shift(); s = JSON.stringify(o); }   // una propiedad guarda 9 KB
  try { PropertiesService.getScriptProperties().setProperty(mfClave_(email), s); } catch (e) { console.error('mfEscribir_: ' + e); }
}
function mfNorm_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function mfApto_(p) { return String(p || '').split(/[,;\n]/)[0].replace(/^\s*z\s*\d+\s*-?\s*/i, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
function mfTema_(t) { return ctxSinNombres_(String(t || '')).replace(/\s*\(nombre sin verificar\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 70); }

/* ── Lo verificado: personas y reservas que dio una herramienta ── */
/* lista: [{ nombre, rol, propiedad, codigo, tel, fuente }]. Solo el principal. */
function mfAnotar_(adm, lista) {
  adm = adm || MF_ADM_; if (!mfPara_(adm) || !lista || !lista.length) return;
  var o = mfLeer_(adm.email), ts = Date.now();
  lista.forEach(function (c) {
    if (!c || !String(c.nombre || '').trim()) return;
    var m = { ts: ts, n: String(c.nombre).trim().slice(0, 50), r: String(c.rol || '').slice(0, 24), p: mfApto_(c.propiedad).slice(0, 30),
      k: String(c.codigo || '').toUpperCase().slice(0, 16), t4: String(c.tel || '').replace(/\D/g, '').slice(-4), fu: String(c.fuente || '').slice(0, 40) };
    o.me = o.me.filter(function (x) { return !(mfNorm_(x.n) === mfNorm_(m.n) && x.p === m.p && x.k === m.k); });
    o.me.push(m);
  });
  mfEscribir_(adm.email, o);
}

/* ── Cada llamada que termina ── */
function mfGuardarLlamada_(adm, e) {
  if (!mfPara_(adm)) return;
  var o = mfLeer_(adm.email);
  if (e.id && o.ll.some(function (x) { return x.id === e.id; })) return;
  /* Las personas de los temas que se movieron en la llamada (temas.js): ya verificadas por su herramienta. */
  try {
    var ventana = function (t) { return t.actualizado >= e.i - 60000 && t.actualizado <= e.f + 180000; };
    var temas = temaFilas_().filter(function (t) { return t.admin === adm.email && ventana(t); });
    temas.forEach(function (t) {
      (t.personas || []).forEach(function (p) {
        if (!p.n) return;
        var m = { ts: t.actualizado, n: String(p.n).slice(0, 50), r: t.tipo === 'huesped' ? 'huésped' : t.tipo === 'socio' ? 'socio' : '', p: mfApto_(t.apartamento).slice(0, 30), k: '', t4: String(p.t || '').replace(/\D/g, '').slice(-4), fu: 'tema' };
        if (!o.me.some(function (x) { return mfNorm_(x.n) === mfNorm_(m.n) && x.p === m.p; })) o.me.push(m);
      });
    });
    if (!e.q) e.q = temas.filter(function (t) { return t.estado === 'abierto'; }).slice(0, 2).map(function (t) { return temaCorto_(t); }).join(' · ');
  } catch (x) { console.error('mf temas: ' + x); }
  o.ll.push(e); o.ll.sort(function (a, b) { return a.f - b.f; });
  mfEscribir_(adm.email, o);
}
/* Llamada de Alma (vozPostCall_): el título de ElevenLabs es lo que se oyó: va «sin verificar» y sin nombres dictados. */
function mfLlamadaDeVoz_(adm, d, t0, dur, canal) {
  var a = d.analysis || {}, convEL = String(d.conversation_id || '');
  var c = CacheService.getScriptCache(), can = convEL && c.get('vozapp_' + convEL) ? 'app' : canal;
  try { if (vozEsConferencia_(convEL)) can = 'conferencia'; } catch (e) {}
  mfGuardarLlamada_(adm, { id: convEL, i: t0, f: t0 + dur * 1000, c: can, tm: mfTema_(a.call_summary_title || a.transcript_summary) });
}
/* Claudio (claudio.js): lo que hizo, según sus herramientas (claudioHizo_), no lo que se dijo. */
function mfClaudio_(adm, conv, t0, dur, titulo) {
  var h = claudioHizo_(conv, adm);
  var cl = (h.pedidos || []).map(function (p) { return (p.ok ? 'pedido creado: ' : 'pedido que NO salió: ') + p.titulo; });
  if (h.unidos) cl.push(h.unidos === 1 ? 'unió un cambio' : 'unió ' + h.unidos + ' cambios');
  mfGuardarLlamada_(adm, { id: conv, i: t0, f: t0 + dur * 1000, c: 'Claudio', tm: mfTema_(titulo), cl: cl.slice(0, 3) });
}
/* Modo calle: cada pedido es un turno; los turnos seguidos (menos de 10 min) son una sola «llamada». */
function mfCalle_(adm, texto) {
  if (!mfPara_(adm)) return;
  var o = mfLeer_(adm.email), ult = o.ll[o.ll.length - 1], ahora = Date.now(), t = mfTema_(temaTitulo_(texto));
  if (ult && ult.c === 'calle' && ahora - ult.f < MF_CALLE_JUNTA_MS_) {
    ult.f = ahora; if (t && String(ult.tm || '').indexOf(t) < 0) ult.tm = String((ult.tm ? ult.tm + ' · ' : '') + t).slice(-90);
    return mfEscribir_(adm.email, o);
  }
  mfGuardarLlamada_(adm, { id: 'calle' + ahora, i: ahora, f: ahora, c: 'calle', tm: t });
}

/* ── El bloque para la ficha y el chat ── */
function mfHace_(ms) { try { return claudioHace_(ms); } catch (e) { return 'hace ' + Math.max(1, Math.round(ms / 60000)) + ' min'; } }
function mfPersona_(m) {
  var de = [m.r, m.p].filter(Boolean).join(' de '), k = m.k ? (de ? ', ' : '') + 'reserva ' + m.k : '';
  return m.n + (de || k ? ' (' + de + k + ')' : '');
}
function mfBloque_(adm) {
  if (!mfPara_(adm)) return '';
  var o = mfLeer_(adm.email); if (!o.ll.length) return '';
  var ahora = Date.now(), usadas = {};
  var lineas = o.ll.slice().reverse().map(function (e) {
    var per = o.me.filter(function (m) { return m.ts >= e.i - 60000 && m.ts <= e.f + 180000; }).reverse().filter(function (m) { var k = mfNorm_(m.n) + m.p; if (usadas[k]) return false; usadas[k] = 1; return true; }).slice(0, 3).map(mfPersona_);
    var partes = ['· ' + mfHace_(ahora - e.f) + ' · ' + e.c];
    if (e.tm) partes.push('«' + e.tm + '» (sin verificar)');
    if (per.length) partes.push('personas: ' + per.join('; '));
    if (e.cl && e.cl.length) partes.push(e.cl.join('; '));
    if (e.q) partes.push('queda: ' + e.q);
    return partes.join(' · ').slice(0, 230);
  });
  var cab = 'ÚLTIMAS LLAMADAS CON ALMA (memoria fresca, la más reciente primero). Si nombra a alguien sin más, es quien salió aquí y lo dices con su fuente («el de la llamada de hace 10 min»); si no, búscalo:\n';
  var t = cab, i = 0;
  for (; i < lineas.length && (t + lineas[i]).length <= MF_LARGO_; i++) t += lineas[i] + '\n';
  return i ? '\n\n' + t.trim() : '';
}

/* ── Desempate por lo reciente ── */
/* ¿Esa mención (o fila de la bandeja) es ese candidato? Por código de reserva; si no, por el nombre completo (todas las
   palabras del más corto en el otro), los últimos 4 del número si los dos los tienen y el apartamento si los dos lo tienen. */
function mfEs_(m, c) {
  var k = String(c.codigo || '').toUpperCase();
  if (m.k && k) return m.k === k;
  var a = mfNorm_(m.n).split(' ').filter(Boolean), b = mfNorm_(c.nombre).split(' ').filter(Boolean);
  if (!a.length || !b.length) return false;
  var corto = a.length <= b.length ? a : b, largo = corto === a ? b : a;
  if (!corto.every(function (w) { return largo.indexOf(w) >= 0; })) return false;
  var t4 = String(c.tel || '').replace(/\D/g, '').slice(-4);
  if (m.t4 && t4 && m.t4 !== t4) return false;
  var pa = mfNorm_(m.p), pb = mfNorm_(mfApto_(c.propiedad));
  if (pa && pb && pa.indexOf(pb) < 0 && pb.indexOf(pa) < 0) return false;
  return true;
}
/* Lo reciente, por nivel: 1 = las últimas llamadas, el chat y el tema activo; 2 = la bandeja del Hub. */
function mfRecientes_(adm) {
  var out = [], ahora = Date.now();
  if (!mfPara_(adm)) return out;
  mfLeer_(adm.email).me.forEach(function (m) { out.push({ m: m, nivel: 1, ts: m.ts }); });
  try {
    temaAbiertos_(adm.email, ahora).filter(function (t) { return ahora - t.actualizado < TEMA_ACTIVO_H_ * 3600000; }).forEach(function (t) {
      (t.personas || []).forEach(function (p) { if (p.n) out.push({ m: { n: p.n, p: mfApto_(t.apartamento), k: '', t4: String(p.t || '').replace(/\D/g, '').slice(-4) }, nivel: 1, ts: t.actualizado, tema: 1 }); });
    });
  } catch (e) { console.error('mf temas activos: ' + e); }
  try {
    var corte = ahora - MF_BANDEJA_H_ * 3600000;
    hubInbox_().forEach(function (x) {
      var ts = actividadInbox_(x); if (!(ts >= corte) || !x.huesped) return;
      var tel = String(x.conv_id).indexOf('wa:') === 0 ? String(x.conv_id).slice(3) : String(x.wa || '');
      out.push({ m: { n: x.huesped, p: mfApto_(x.propiedad), k: String(x.codigo || '').toUpperCase(), t4: tel.replace(/\D/g, '').slice(-4) }, nivel: 2, ts: ts });
    });
  } catch (e) { console.error('mf bandeja: ' + e); }
  return out;
}
/* cands: [{ nombre, propiedad, codigo, tel }] (los que el resolvedor ya encontró). Devuelve { i, fuente } si lo reciente
   elige a uno solo; si no, null y se pregunta como siempre. Se mira primero el nivel 1 y, solo si no decide, el 2; dentro de
   un nivel gana el más reciente, y un empate (mismo minuto) no elige. */
function mfDesempate_(adm, cands, recientes) {
  adm = adm || MF_ADM_; if (!cands || cands.length < 2) return null;
  var rs = recientes || mfRecientes_(adm), ahora = Date.now();
  for (var nivel = 1; nivel <= 2; nivel++) {
    var mejor = cands.map(function (c, i) {
      var ts = 0, tema = false; rs.forEach(function (r) { if (r.nivel === nivel && mfEs_(r.m, c) && r.ts > ts) { ts = r.ts; tema = !!r.tema; } });
      return { i: i, ts: ts, tema: tema };
    }).filter(function (x) { return x.ts; }).sort(function (a, b) { return b.ts - a.ts; });
    if (!mejor.length) continue;
    if (mejor.length > 1 && mejor[0].ts - mejor[1].ts < 60000) return null;   // los dos igual de recientes: se pregunta
    var hace = mfHace_(ahora - mejor[0].ts);
    return { i: mejor[0].i, nivel: nivel, fuente: nivel === 1 ? (mejor[0].tema ? 'es del tema activo (' + hace + ')' : 'lo hablaron ' + hace) : 'conversación reciente de la bandeja (' + hace + ')' };
  }
  return null;
}
