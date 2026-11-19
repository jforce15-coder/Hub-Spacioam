/* ═══ BANDEJA UNIFICADA: UNA PERSONA POR FILA, TODAS LAS REDES (#888) ═════════════════════════════════════════════
   Pedido de Juan (19-nov-2026): «juntar todo en un mismo chat … un solo hub donde nos comuniquemos con el mundo».
   Eligió el prototipo A en iPad y computadora (4 columnas: carpetas · personas · hilo mezclado · ficha) y el C en el
   iPhone (Alma decide el orden: Te toca decidir · Alma lo lleva · Esperando a otros · Listo hoy). Pantalla:
   alma/bandeja.html. Todo sale de las hojas (nada de internet ni de IA al armar la lista):

   · Ficha de la persona (T1): las conversaciones de ALMA_INBOX (Hospitable, WhatsApp, Instagram, Messenger) y los correos
     de personas conocidas se juntan solas cuando comparten teléfono, código de reserva o hilo de Hospitable. Lo demás se
     une a mano («Unir otra conversación») y se separa («Separar»). Lo hecho a mano vive en ALMA_PERSONAS, un registro:
     conv_id · campo · valor · por · ts, y la última fila de cada conversación y campo manda:
        unir      valor = otra conversación de la misma persona     separar   la saca de su persona (y de lo automático)
        carpeta   valor = huesped|socio|equipo|proveedor|prospecto|otro       posponer  valor = hasta cuándo (ISO) o ''
   · Carpeta y estado (T2): la carpeta sale de la reserva, de la ficha del contacto (contactos.js) y de cómo entró; Juan
     la puede mover. Estado: nuevo (nadie respondió) · esperando (respondimos; falta el otro) · resuelto (marcado, o sin
     movimiento en 48 h) · pospuesto (vuelve sola a su hora).
   · Prioridad (Alma decide el orden): urgente → te toca → normal → baja, y lo personal pendiente siempre entre los 3
     primeros (como los Círculos de la bandeja).
   · Hilo mezclado y «Responder por» (T3): al abrir una persona, todos sus mensajes en orden con el canal de cada uno, más
     sus llamadas con Alma (ya viven en ALMA_WHATSAPP), sus correos y las notas internas del equipo (T6, hoja ALMA_NOTAS:
     el huésped nunca las ve). Por omisión se responde por el canal donde escribió último, con su ventana a la vista.
   · Borrador A · B · C (T4): la Decisión del equipo de cualquier canal (decisiones.js). Elegir programa el Envío con
     deshacer (1 min). Si no hay decisión, «Pedir A · B · C» la crea a pedido: la IA solo corre cuando alguien la pide. */

var PERSONAS_CAB_ = ['conv_id', 'campo', 'valor', 'por', 'ts'];
var NOTAS_CAB_ = ['ts', 'conv_id', 'autor', 'texto'];
var BANDEJA_CARPETAS_ = ['huesped', 'socio', 'equipo', 'proveedor', 'prospecto', 'otro'];   // también el orden en que una manda sobre otra
var BANDEJA_MARCAS_CACHE_ = 'personas_marcas_v1';
var BANDEJA_RESUELTO_MS_ = 48 * 3600000;

function hojaPersonas_() { return hojaCrear_('ALMA_PERSONAS', PERSONAS_CAB_); }
function hojaNotas_() { return hojaCrear_('ALMA_NOTAS', NOTAS_CAB_); }

/* ── Lo hecho a mano: { conv: { union: {campo, valor, ts}, carpeta: {valor, ts}, posponer: {valor, ts} } } ── */
function personasMarcas_() {
  var c = null; try { c = CacheService.getScriptCache(); var h = c.get(BANDEJA_MARCAS_CACHE_); if (h) return JSON.parse(h); } catch (e) {}
  var sh = ssAlma_().getSheetByName('ALMA_PERSONAS'), n = sh ? sh.getLastRow() : 0, filas = [];
  if (n >= 2) filas = sh.getRange(Math.max(2, n - 3999), 1, Math.min(n - 1, 4000), PERSONAS_CAB_.length).getValues();
  var m = personasMarcasDe_(filas);
  try { var t = JSON.stringify(m); if (c && t.length < 95000) c.put(BANDEJA_MARCAS_CACHE_, t, 120); } catch (e) {}
  return m;
}
/* Separada para probarla sin Apps Script: las filas en orden, la última de cada conversación y campo manda. */
function personasMarcasDe_(filas) {
  var m = {};
  (filas || []).forEach(function (v) {
    var conv = String(v[0] || ''), campo = String(v[1] || ''); if (!conv || !campo) return;
    var ts = v[4] instanceof Date ? v[4].getTime() : (Date.parse(v[4]) || 0), x = m[conv] || (m[conv] = {});
    var o = { campo: campo, valor: String(v[2] == null ? '' : v[2]), ts: ts, por: String(v[3] || '') };
    if (campo === 'unir' || campo === 'separar') x.union = o; else x[campo] = o;
  });
  return m;
}
function personasMarcar_(convs, campo, valor, por) {
  var sh = hojaPersonas_(), ts = new Date().toISOString();
  (convs || []).forEach(function (c) { if (c) sh.appendRow([String(c), campo, celdaTexto_(String(valor == null ? '' : valor)), String(por || '').slice(0, 80), ts]); });
  try { CacheService.getScriptCache().remove(BANDEJA_MARCAS_CACHE_); } catch (e) {}
}

/* ── Juntar conversaciones en personas (T1). filas: las de la bandeja; marcas: personasMarcas_. Devuelve [[fila…]…]. ── */
function bandejaAgrupar_(filas, marcas) {
  marcas = marcas || {};
  var padre = {}, existe = {};
  filas.forEach(function (o) { padre[o.conv_id] = o.conv_id; existe[o.conv_id] = 1; });
  var raiz = function (x) { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
  var unir = function (a, b) { a = raiz(a); b = raiz(b); if (a !== b) { if (a < b) padre[b] = a; else padre[a] = b; } };
  var sep = function (id) { var u = (marcas[id] || {}).union; return u && u.campo === 'separar' ? u.ts : 0; };
  var porLlave = {};
  filas.forEach(function (o) {
    var id = String(o.conv_id); if (sep(id)) return;   // separada a mano: ya no se junta sola
    bandejaLlaves_(o).forEach(function (k) { if (porLlave[k]) unir(porLlave[k], id); else porLlave[k] = id; });
  });
  /* A mano: «unir» con otra conversación, salvo que esa otra se haya separado después. */
  Object.keys(marcas).forEach(function (id) {
    var u = marcas[id].union; if (!u || u.campo !== 'unir' || !existe[id] || !existe[u.valor]) return;
    if (sep(u.valor) > u.ts) return;
    unir(id, u.valor);
  });
  var grupos = {};
  filas.forEach(function (o) { var r = raiz(o.conv_id); (grupos[r] = grupos[r] || []).push(o); });
  return Object.keys(grupos).map(function (k) { return grupos[k]; });
}
/* Lo que identifica a una persona en una conversación: su teléfono, su código de reserva, su hilo de Hospitable, su correo. */
function bandejaLlaves_(o) {
  var out = [], id = String(o.conv_id || '');
  var tel = fin8_(id.indexOf('wa:') === 0 ? id.slice(3) : o.wa); if (tel && tel.length === 8) out.push('tel:' + tel);
  var cod = String(o.codigo || '').trim().toUpperCase(); if (cod) out.push('cod:' + cod);
  if (o.hosp_conv) out.push('hosp:' + String(o.hosp_conv));
  if (id.indexOf('mail:') === 0) out.push(id);
  return out;
}

/* ── Carpeta (T2) ── */
var BANDEJA_TIPO_CARPETA_ = { proveedor: 'proveedor', tecnico: 'proveedor', socio: 'socio', potencial_socio: 'socio', equipo: 'equipo', recepcion: 'equipo', familia: 'otro', otro: 'otro',
  interno: 'equipo', administrativa: 'equipo', estrategico: 'equipo', reserva: 'prospecto', huesped: 'prospecto', redes: 'prospecto', consulta: 'prospecto', sistema: 'otro', correo: 'otro' };
function bandejaCarpetaFila_(o) {
  var id = String(o.conv_id || '');
  if (o.codigo || (o.tipo === 'reserva' && !/^(wa|ig|fb|mail):/.test(id))) return 'huesped';
  if (o.contacto_tipo && BANDEJA_TIPO_CARPETA_[o.contacto_tipo]) return BANDEJA_TIPO_CARPETA_[o.contacto_tipo];
  if (id.indexOf('inq:') === 0) return 'prospecto';
  return BANDEJA_TIPO_CARPETA_[String(o.tipo || '')] || (/^(ig|fb):/.test(id) ? 'prospecto' : 'otro');
}
/* El canal que ve la pantalla (su logo) de una conversación. */
function bandejaCanalFila_(o) {
  var id = String(o.conv_id || '');
  if (id.indexOf('ig:') === 0) return 'instagram';
  if (id.indexOf('fb:') === 0) return 'messenger';
  if (id.indexOf('mail:') === 0) return 'correo';
  if (id.indexOf('llamada:') === 0) return 'llamada';
  if (id.indexOf('wa:') === 0) return 'whatsapp';
  var c = String(o.canal || ''); return /^(airbnb|booking|vrbo|expedia)$/.test(c) ? c : 'directa';
}

/* ── El estado, la prioridad y el carril de una persona. Pura (sin hojas): se prueba en .github/bandeja-unica.js. ──
   g: las filas de la persona (ya con esfera); x: { marcas, resueltas: {conv: ts de «resuelta»}, abiertas: {conv: ts de
   «abierta»}, alma: {conv: ts del último envío de Alma}, decisiones: {conv: decisión viva}, auto: {conv: 'off'}, ahora, hoy } */
function bandejaPersonaDe_(g, x) {
  var ahora = x.ahora || Date.now(), hoy = x.hoy || '', marcas = x.marcas || {};
  var t = function (v) { var n = v instanceof Date ? v.getTime() : Date.parse(v || ''); return isNaN(n) ? 0 : n; };
  var act = function (o) { return Math.max(t(o.ultimo_ts), t(o.ultimo_auto_ts) && !o.ultimo_ts ? t(o.ultimo_auto_ts) : 0); };
  g = g.slice().sort(function (a, b) { return act(b) - act(a); });
  var convs = g.map(function (o) {
    var id = String(o.conv_id), ug = t(o.ultimo_guest_ts) || (o.ultimo_de === 'guest' ? t(o.ultimo_ts) : 0);
    var resuelta = (x.resueltas || {})[id] || 0, nr = t(o.no_requiere);
    var pend = o.ultimo_de === 'guest' && !!ug && !(nr && nr >= ug) && !(resuelta && resuelta >= ug);
    var almaTs = (x.alma || {})[id] || 0, uh = t(o.ultimo_host_ts);
    return { conv_id: id, canal: bandejaCanalFila_(o), carpeta: bandejaCarpetaFila_(o), codigo: o.codigo || '', propiedad: o.propiedad || '', checkin: o.checkin || '', checkout: o.checkout || '',
      wa: o.wa || '', ultimo_texto: String(o.ultimo_texto || '').slice(0, 280), ultimo_de: o.ultimo_de || '', ultimo_ts: o.ultimo_ts || o.ultimo_auto_ts || '', pendiente: pend, desde: ug,
      resuelta: !!(resuelta && resuelta >= act(o)), por_alma: o.ultimo_de === 'host' && almaTs && Math.abs(almaTs - uh) < 6 * 60000, promesa: o.promesa_estado || '',
      no_requiere: o.revision_razon && nr && nr >= ug ? String(o.revision_razon) : '', foto: o.foto || '', foto_contacto: o.foto_contacto || '', auto_off: (x.auto || {})[id] === 'off' };
  });
  var top = g[0], c0 = convs[0];
  /* Nombre: el de la ficha o la reserva; si no, el más largo que no sea un número. */
  var nombres = g.map(function (o) { return String(o.huesped || '').trim(); }).filter(function (n) { return n && !/^\+?\d[\d\s]+$/.test(n); });
  var nombre = (g.filter(function (o) { return o.codigo && o.huesped; })[0] || {}).huesped || nombres[0] || String(top.huesped || top.conv_id);
  /* Carpeta: la que Juan movió a mano (la más nueva entre sus conversaciones) o la más fuerte de las automáticas. */
  var mano = null; convs.forEach(function (c) { var k = (marcas[c.conv_id] || {}).carpeta; if (k && BANDEJA_CARPETAS_.indexOf(k.valor) >= 0 && (!mano || k.ts > mano.ts)) mano = k; });
  var auto = BANDEJA_CARPETAS_.filter(function (k) { return convs.some(function (c) { return c.carpeta === k; }); })[0] || 'otro';
  var pos = 0; convs.forEach(function (c) { var p = (marcas[c.conv_id] || {}).posponer; var h = p ? t(p.valor) : 0; if (h > pos) pos = h; });
  var dec = null; convs.forEach(function (c) { var d = (x.decisiones || {})[c.conv_id]; if (d && !dec) dec = d; });
  var pend = convs.filter(function (c) { return c.pendiente; }), personal = g.some(function (o) { return o.esfera && o.esfera !== 'proposito'; });
  var ultAct = Math.max.apply(null, convs.map(function (c) { return t(c.ultimo_ts); }).concat([0]));
  var estado = pos > ahora ? 'pospuesto' : pend.length || (dec && !dec.enviada) ? 'nuevo'
    : convs.every(function (c) { return c.resuelta || !t(c.ultimo_ts); }) || ahora - ultAct > BANDEJA_RESUELTO_MS_ ? 'resuelto' : 'esperando';
  var minutos = pend.length ? Math.round((ahora - Math.min.apply(null, pend.map(function (c) { return c.desde; }))) / 60000) : 0;
  var carpeta = mano ? mano.valor : auto, prio = 4, razon = '';
  if (estado === 'nuevo') {
    var llegaYa = carpeta === 'huesped' && convs.some(function (c) { return c.checkin && hoy && c.checkin <= bandejaManana_(hoy) && (!c.checkout || c.checkout >= hoy); });
    if (dec && /rojo|escal|urgen|emergen/i.test(String(dec.origen || '') + ' ' + String(dec.motivo || ''))) { prio = 1; razon = 'Urgente'; }
    else if (convs.some(function (c) { return c.promesa === 'vencida'; })) { prio = 1; razon = 'Promesa vencida'; }
    else if (llegaYa && minutos > 20) { prio = 1; razon = 'Llega hoy o mañana'; }
    else if (dec) { prio = 2; razon = 'Espera tu decisión'; }
    else if (personal) { prio = 2; razon = 'Personal'; }
    else if (convs.some(function (c) { return c.pendiente && c.auto_off; })) { prio = 2; razon = 'Alma está apagada aquí'; }
    else if (minutos > 15) { prio = 2; razon = 'Sin respuesta hace ' + (minutos < 120 ? minutos + ' min' : Math.round(minutos / 60) + ' h'); }
    else { prio = 3; razon = 'Alma lo está viendo'; }
  }
  var porAlma = !!(c0.ultimo_de === 'host' && c0.por_alma);   // lo último que salió en su conversación más reciente lo mandó Alma
  var carril = estado === 'nuevo' ? (prio <= 2 ? 'toca' : 'alma') : estado === 'pospuesto' ? 'espera'
    : estado === 'esperando' ? (porAlma ? 'alma' : 'espera') : (bandejaHoyGt_(ultAct, hoy) || convs.some(function (c) { return bandejaHoyGt_((x.resueltas || {})[c.conv_id], hoy); }) ? 'listo' : '');
  var canales = []; convs.forEach(function (c) { if (canales.indexOf(c.canal) < 0) canales.push(c.canal); });
  var res = convs.filter(function (c) { return c.codigo || c.checkin; })[0] || null;
  return { id: 'p:' + convs.map(function (c) { return c.conv_id; }).sort()[0], nombre: nombre, foto: (g.filter(function (o) { return o.foto; })[0] || {}).foto || '', foto_contacto: (convs.filter(function (c) { return c.foto_contacto; })[0] || {}).foto_contacto || '',
    esfera: (g.filter(function (o) { return o.esfera && o.esfera !== 'proposito'; })[0] || top).esfera || 'proposito', personal: personal,
    carpeta: carpeta, carpeta_auto: auto, carpeta_mano: !!mano, canales: canales, ultimo_canal: c0.canal, convs: convs,
    texto: (pend[0] || c0).ultimo_texto, ultimo_de: c0.ultimo_de, ultimo_ts: c0.ultimo_ts, sin: pend.length,
    estado: estado, pospuesto_hasta: pos > ahora ? new Date(pos).toISOString() : '', prioridad: prio, razon: razon, minutos: minutos, carril: carril, por_alma: porAlma,
    decision: dec, reserva: res ? { codigo: res.codigo, propiedad: res.propiedad, checkin: res.checkin, checkout: res.checkout, canal: res.canal } : null };
}
function bandejaManana_(hoy) { var d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
/* ¿El instante cae hoy en Guatemala (UTC-6)? */
function bandejaHoyGt_(ms, hoy) { return !!ms && new Date(ms - 6 * 3600000).toISOString().slice(0, 10) === hoy; }

/* Orden: prioridad, y lo más reciente primero; lo personal pendiente nunca baja del 3.er lugar (Círculos de la bandeja). */
function bandejaOrdenar_(ps) {
  var t = function (p) { return Date.parse(p.ultimo_ts || '') || 0; };
  var L = ps.slice().sort(function (a, b) { return a.prioridad - b.prioridad || t(b) - t(a); });
  var esPers = function (p) { return p.personal && p.estado === 'nuevo'; };
  L.filter(esPers).slice(0, 3).forEach(function (p) {
    var k = L.indexOf(p); if (k <= 2) return;
    var s = 2; while (s >= 0 && esPers(L[s])) s--;   // el último lugar de arriba que no es otro personal
    if (s < 0) return;
    L.splice(k, 1); L.splice(s, 0, p);
  });
  return L;
}

/* ── Quién mira: un administrador con sesión. Lo personal y los correos, solo el principal. ── */
function bandejaQuien_(ses) {
  var em = String((ses && (ses.email || ses.correo)) || '').trim().toLowerCase(); if (!em) return null;
  var a = adminsOp_().filter(function (x) { return x.email === em || (x.alternos || []).indexOf(em) >= 0; })[0];
  return a ? { adm: a, principal: esAdminPrincipal_(a), nombre: decQuien_(ses) } : null;
}

/* Correos de personas conocidas (T6): los de Spacio AM que piden respuesta, y los que alguien ya unió a una persona. */
function bandejaCorreos_(marcas) {
  var sh = ssAlma_().getSheetByName('ALMA_CORREO_BANDEJA'), n = sh ? sh.getLastRow() : 0; if (n < 2) return [];
  var cab = typeof CORREOS_CAB_ !== 'undefined' ? CORREOS_CAB_ : [];
  var ix = function (k) { return cab.indexOf(k); }, ligados = {};
  Object.keys(marcas || {}).forEach(function (id) { var u = marcas[id].union; if (u && u.campo === 'unir') { if (id.indexOf('mail:') === 0) ligados[id] = 1; if (String(u.valor).indexOf('mail:') === 0) ligados[u.valor] = 1; } });
  var por = {};
  sh.getRange(Math.max(2, n - 599), 1, Math.min(n - 1, 600), cab.length).getValues().forEach(function (v) {
    var de = String(v[ix('de')] || '').trim().toLowerCase(), cat = String(v[ix('categoria')] || ''), est = String(v[ix('estado')] || '');
    if (!de || (cat !== 'normal' && cat !== 'autorizacion') || /spam|desuscrito|archivado/.test(est)) return;
    var id = 'mail:' + de;
    if (!ligados[id] && !(String(v[ix('accion')]) === 'responder' && /spacio/i.test(String(v[ix('proyecto')] || '') + ' ' + String(v[ix('cuenta')] || '')))) return;
    var f = v[ix('fecha')] instanceof Date ? v[ix('fecha')].toISOString() : String(v[ix('fecha')] || v[ix('recibido')] || '');
    var pend = !est || est === 'nuevo';
    if (por[id] && Date.parse(por[id].ultimo_ts) >= Date.parse(f)) return;
    por[id] = { conv_id: id, huesped: String(v[ix('de_nombre')] || de), tipo: 'correo', canal: 'correo', ultimo_canal: 'correo', propiedad: 'Correo · ' + String(v[ix('cuenta')] || ''),
      ultimo_texto: (String(v[ix('asunto')] || '') + ' — ' + String(v[ix('fragmento')] || '')).slice(0, 300), ultimo_de: pend ? 'guest' : 'host', ultimo_ts: f, ultimo_guest_ts: f };
  });
  return Object.keys(por).map(function (k) { return por[k]; });
}

/* ── La lista (op «lista»): solo hojas y caché, nada de internet. ── */
function bandejaPersonas_(q) {
  var filas = []; try { filas = hubInbox_(); } catch (e) { console.error('bandeja hubInbox_: ' + e); }
  filas = filas.filter(function (o) { return !/^op:/.test(o.conv_id); });
  var marcas = personasMarcas_();
  if (q.principal) { try { filas = filas.concat(bandejaCorreos_(marcas)); } catch (e) { console.error('bandejaCorreos_: ' + e); } }
  try { bandejaEsferaFoto_(filas); } catch (e) { console.error('bandeja esfera: ' + e); }
  var resueltas = {}; try { resueltasVivo_().forEach(function (r) { if (r.estado === 'resuelta') resueltas[r.res_key] = Math.max(resueltas[r.res_key] || 0, r.ts_ms); else if (resueltas[r.res_key] && r.ts_ms > resueltas[r.res_key]) delete resueltas[r.res_key]; }); } catch (e) {}
  var decisiones = {}; try { decFilas_().filas.forEach(function (f) { if (decViva_(f)) decisiones[f.resId] = decPublica_(f); }); } catch (e) { console.error('bandeja decisiones: ' + e); }
  var auto = {}; try { var A = autoTodos_(); Object.keys(A).forEach(function (k) { auto[k] = A[k].estado; }); } catch (e) {}
  var ahora = Date.now(), hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  var ps = bandejaAgrupar_(filas, marcas).map(function (g) {
    return bandejaPersonaDe_(g, { marcas: marcas, resueltas: resueltas, alma: bandejaEnviosAlma_(), decisiones: decisiones, auto: auto, ahora: ahora, hoy: hoy });
  }).filter(function (p) { return q.principal || (!p.personal && p.canales.indexOf('correo') < 0); });
  ps = bandejaOrdenar_(ps);
  var hoyP = ps.filter(function (p) { return p.convs.some(function (c) { return bandejaHoyGt_(c.desde, hoy); }); });
  var canalesHoy = {}; hoyP.forEach(function (p) { p.convs.forEach(function (c) { if (bandejaHoyGt_(c.desde, hoy)) canalesHoy[c.canal] = 1; }); });
  return { ok: true, personas: ps.slice(0, 220), principal: !!q.principal, nombre: q.nombre,
    resumen: { personas_hoy: hoyP.length, canales_hoy: Object.keys(canalesHoy), respondio_alma: hoyP.filter(function (p) { return p.por_alma; }).length,
      te_tocan: ps.filter(function (p) { return p.carril === 'toca'; }).length, alma_lleva: ps.filter(function (p) { return p.carril === 'alma'; }).length,
      esperando: ps.filter(function (p) { return p.carril === 'espera'; }).length, listo: ps.filter(function (p) { return p.carril === 'listo'; }).length },
    redes: { instagram: redesActivo_('instagram'), messenger: redesActivo_('messenger') }, ts: new Date().toISOString() };
}
/* Cuándo respondió Alma por última vez en cada conversación (ALMA_LOG, las últimas 600 filas; una vez por ejecución). */
var BANDEJA_ALMA_ = null;
function bandejaEnviosAlma_() {
  if (BANDEJA_ALMA_) return BANDEJA_ALMA_;
  BANDEJA_ALMA_ = {};
  try {
    var sh = hoja_(CFG.TAB_LOG), n = sh.getLastRow(); if (n < 2) return BANDEJA_ALMA_;
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toLowerCase(); });
    var cF = cab.indexOf('fecha'), cA = cab.indexOf('accion'), cR = cab.indexOf('reservation_id'); if (cF < 0 || cA < 0 || cR < 0) return BANDEJA_ALMA_;
    sh.getRange(Math.max(2, n - 599), 1, Math.min(n - 1, 600), cab.length).getValues().forEach(function (v) {
      if (!/^ENVIADO al huésped/.test(String(v[cA]))) return;
      var t = Date.parse(isoDe_(v[cF])) || 0, id = String(v[cR] || ''); if (id && t > (BANDEJA_ALMA_[id] || 0)) BANDEJA_ALMA_[id] = t;
    });
  } catch (e) { console.error('bandejaEnviosAlma_: ' + e); }
  return BANDEJA_ALMA_;
}

/* ¿Puede tocar esta conversación? Lo personal y los correos, solo el principal. */
function bandejaPuede_(q, conv) {
  conv = String(conv || ''); if (!conv || /^op:/.test(conv)) return false;
  if (q.principal) return true;
  if (conv.indexOf('mail:') === 0) return false;
  var m = {}; try { m = bandejaEsferaMapas_(); } catch (e) { return false; }
  return bandejaEsferaDe_(m, conv) === 'proposito';
}

/* ── El hilo mezclado de una persona (op «hilo», T3 y T6). Lo único que puede ir a internet: Hospitable (caché 60 s). ── */
function bandejaHilo_(q, convs) {
  convs = (Array.isArray(convs) ? convs : []).map(String).filter(function (c) { return bandejaPuede_(q, c); }).slice(0, 6);
  if (!convs.length) return { ok: false, error: 'No encuentro esa conversación.' };
  var filas = {}; try { hubInbox_().forEach(function (o) { filas[o.conv_id] = o; }); } catch (e) {}
  var msgs = [], opciones = [], decisiones = [];
  convs.forEach(function (id) {
    var fila = filas[id] || { conv_id: id }, canalFila = bandejaCanalFila_(fila);
    if (id.indexOf('mail:') === 0) {
      bandejaCorreoMensajes_(id.slice(5)).forEach(function (m) { msgs.push(m); });
      opciones.push({ via: 'correo', resId: id, canal: 'correo', abierta: false, texto: 'Los correos se responden desde Correos, con tu sí' });
      return;
    }
    var h = { hilo: [] }; try { h = hiloConv_(id); } catch (e) { console.error('bandejaHilo_ ' + id + ': ' + e); }
    var waNum = '';
    (h.hilo || []).forEach(function (m) {
      var canal = m.llamada ? 'llamada' : m.canal === 'whatsapp' ? 'whatsapp' : m.canal === 'instagram' || m.canal === 'messenger' ? m.canal : canalFila === 'whatsapp' ? 'whatsapp' : canalFila;
      if (m.canal === 'whatsapp' && m.wa) waNum = m.wa;
      msgs.push({ conv: id, canal: canal, de: m.tipo === 'guest' ? 'ella' : m.alma ? 'alma' : m.auto ? 'auto' : 'nosotros', texto: String(m.texto || '').slice(0, 4000),
        ts: m.created, fotos: (m.fotos || []).slice(0, 4), autor: m.tipo === 'guest' ? '' : String(m.nombre || '').slice(0, 60) });
    });
    if (/^(ig|fb):/.test(id)) { var v = redesVentana_(id); opciones.push({ via: 'red', resId: id, canal: redesCanalDe_(id), abierta: v.abierta, texto: v.texto }); }
    else if (id.indexOf('wa:') === 0) { var ab = waVentana_(id.slice(3)); opciones.push({ via: 'wa', resId: id, canal: 'whatsapp', wa: id.slice(3), abierta: true, texto: ab ? 'Ventana de WhatsApp abierta' : 'Pasaron más de 24 h: sale la plantilla para retomar y tu mensaje cuando responda' }); }
    else if (!convSoloLocal_(id)) {
      opciones.push({ via: 'plataforma', resId: id, canal: canalFila, abierta: true, texto: 'Por la plataforma de la reserva' });
      var num = waNum || normTel_(fila.wa || '');
      if (num) { var ab2 = waVentana_(num); opciones.push({ via: 'wa', resId: id, canal: 'whatsapp', wa: num, abierta: true, texto: ab2 ? 'Ventana de WhatsApp abierta' : 'Pasaron más de 24 h: sale la plantilla para retomar' }); }
    }
    try { var d = decisionLeer_(id); if (d) decisiones.push(d); } catch (e) {}
  });
  bandejaNotas_(convs).forEach(function (n) { msgs.push(n); });
  msgs.sort(function (a, b) { return (Date.parse(a.ts) || 0) - (Date.parse(b.ts) || 0); });
  var ultG = msgs.filter(function (m) { return m.de === 'ella' && m.canal !== 'llamada'; }).pop();
  /* Por omisión, el canal donde escribió último: su WhatsApp, o la plataforma o la red de esa conversación. */
  var omision = ultG ? opciones.filter(function (o) { return o.resId === ultG.conv && (ultG.canal === 'whatsapp' ? o.via === 'wa' : o.via !== 'wa' && o.via !== 'correo'); })[0] : null;
  omision = omision || opciones.filter(function (o) { return o.abierta; })[0] || null;
  return { ok: true, mensajes: msgs.slice(-250), responder_por: opciones, por_omision: omision ? opciones.indexOf(omision) : -1, decisiones: decisiones };
}
function bandejaCorreoMensajes_(dir) {
  var sh = ssAlma_().getSheetByName('ALMA_CORREO_BANDEJA'), n = sh ? sh.getLastRow() : 0; if (n < 2 || typeof CORREOS_CAB_ === 'undefined') return [];
  var ix = function (k) { return CORREOS_CAB_.indexOf(k); };
  return sh.getRange(2, ix('de') + 1, n - 1, 1).createTextFinder(dir).matchEntireCell(true).findAll().slice(-30).map(function (h) {
    var v = sh.getRange(h.getRow(), 1, 1, CORREOS_CAB_.length).getValues()[0];
    return { conv: 'mail:' + dir, canal: 'correo', de: 'ella', texto: String(v[ix('asunto')] || '(sin asunto)') + '\n' + String(v[ix('fragmento')] || ''), ts: v[ix('fecha')] instanceof Date ? v[ix('fecha')].toISOString() : String(v[ix('fecha')] || ''), fotos: [], autor: '' };
  });
}
/* Notas internas del equipo (T6): en el hilo de la persona; nunca salen a nadie. */
function bandejaNotas_(convs) {
  var sh = ssAlma_().getSheetByName('ALMA_NOTAS'), n = sh ? sh.getLastRow() : 0; if (n < 2) return [];
  var set = {}; convs.forEach(function (c) { set[c] = 1; });
  return sh.getRange(Math.max(2, n - 2999), 1, Math.min(n - 1, 3000), NOTAS_CAB_.length).getValues().filter(function (v) { return set[String(v[1])]; }).map(function (v) {
    return { conv: String(v[1]), canal: 'nota', de: 'nota', texto: String(v[3] || ''), ts: v[0] instanceof Date ? v[0].toISOString() : String(v[0]), fotos: [], autor: String(v[2] || '') };
  });
}

/* ── Responder por el canal elegido (T3). ── */
function bandejaResponder_(q, ses, b) {
  var resId = String(b.resId || ''), via = String(b.via || ''), texto = String(b.texto || '').trim();
  if (!bandejaPuede_(q, resId)) return { ok: false, error: 'No encuentro esa conversación.' };
  if (!texto) return { ok: false, error: 'Escribe el mensaje.' };
  if (via === 'correo' || resId.indexOf('mail:') === 0) return { ok: false, error: 'Los correos se responden desde Correos, con tu sí.' };
  var cuerpo = { resId: resId, texto: texto, quien: q.nombre, adj: [] };
  if (via === 'wa' && resId.indexOf('wa:') !== 0) cuerpo = Object.assign(cuerpo, { action: 'responderWa', wa: String(b.wa || '') });
  else cuerpo = Object.assign(cuerpo, { action: 'responder', canal: via === 'plataforma' ? 'plataforma' : '' });
  return hubResponderSeguro_(cuerpo, ses);
}

/* ── A · B · C (T4): elegir programa el Envío con deshacer; deshacer lo detiene; pedir crea la decisión a pedido. ── */
function bandejaDecision_(q, ses, b) {
  var sub = String(b.sub || '');
  if (sub === 'pedir') {
    var resId = String(b.resId || ''); if (!bandejaPuede_(q, resId)) return { ok: false, error: 'No encuentro esa conversación.' };
    var f = null; try { f = hubInbox_().filter(function (o) { return o.conv_id === resId; })[0]; } catch (e) {}
    if (!f) return { ok: false, error: 'No encuentro esa conversación.' };
    var ctx = { resId: resId, huesped: f.huesped, propiedad: f.propiedad, codigo: f.codigo, canal: bandejaCanalFila_(f), wa: f.wa, texto: String(f.ultimo_texto || ''), idioma: (idiomaDe_(f.ultimo_texto) || 'es').toUpperCase() };
    var r = decisionCrear_(ctx, 'bandeja', 'Pedido desde la Bandeja por ' + q.nombre);
    return r ? { ok: true, id: r.id, ya: !!r.ya, generando: !r.ya } : { ok: false, error: 'ocupado: intenta en unos segundos' };
  }
  var d = decFila_(b.id); if (!d.f || !bandejaPuede_(q, d.f.resId)) return { ok: false, error: 'Ya no encuentro ese caso.' };
  if (sub === 'deshacer') { var st = decSalidaParar_(d.f.id, 'deshecho'); return { ok: st === 'parado', estado: st, error: st === 'salio' ? 'Ya salió.' : st === 'ocupado' ? 'ocupado' : '' }; }
  if (sub !== 'elegir') return { ok: false, error: 'sub' };
  var texto = String(b.texto || '').trim(), op = String(b.opcion || '').toUpperCase();
  var orig = (decOpciones_(d.f).filter(function (o) { return o.letra === op; })[0] || {}).mensaje || '';
  var otra = !op || op === 'OTRA' || (texto && texto !== String(orig).trim());
  var el = decisionElegir_(ses, d.f.id, otra ? 'otra' : op, q.nombre); if (!el.ok) return el;
  if (otra) {
    if (!texto) return { ok: false, error: 'Escribe la respuesta.' };
    var soltar = decCandado_(); if (!soltar) return { ok: false, error: 'ocupado' };
    try { var d2 = decFila_(d.f.id); if (d2.f) decGuardar_(d2.sh, d2.f, { borrador: celdaTexto_(texto.slice(0, 4000)) }); } finally { soltar(); }
  }
  var p = decSalidaProgramar_(d.f.id, '');
  return p.ok ? { ok: true, sale: p.ts, texto: otra ? texto : orig } : p;
}

/* ── La acción del Hub «bandeja» { op, … } ── */
function bandejaApi_(ses, b) {
  b = b || {};
  var q = bandejaQuien_(ses); if (!q) return { ok: false, error: 'Inicia sesión con tu cuenta del equipo para ver la Bandeja.' };
  var op = String(b.op || 'lista'), convs = (Array.isArray(b.convs) ? b.convs : [b.conv]).map(String).filter(function (c) { return c && bandejaPuede_(q, c); });
  switch (op) {
    case 'lista': return bandejaPersonas_(q);
    case 'hilo': return bandejaHilo_(q, b.convs);
    case 'responder': return bandejaResponder_(q, ses, b);
    case 'decision': return bandejaDecision_(q, ses, b);
    case 'unir':
      if (!convs.length || !bandejaPuede_(q, b.con)) return { ok: false, error: 'No encuentro esa conversación.' };
      personasMarcar_([convs[0]], 'unir', String(b.con), q.nombre); return { ok: true };
    case 'separar':
      if (!convs.length) return { ok: false, error: 'No encuentro esa conversación.' };
      personasMarcar_([convs[0]], 'separar', '', q.nombre); return { ok: true };
    case 'carpeta':
      if (BANDEJA_CARPETAS_.indexOf(String(b.carpeta)) < 0 || !convs.length) return { ok: false, error: 'carpeta' };
      personasMarcar_(convs, 'carpeta', String(b.carpeta), q.nombre); return { ok: true };
    case 'posponer': {
      var h = b.hasta ? Date.parse(b.hasta) : 0; if (b.hasta && (!h || h < Date.now())) return { ok: false, error: 'Elige una hora que todavía no pasó.' };
      if (!convs.length) return { ok: false, error: 'No encuentro esa conversación.' };
      personasMarcar_(convs, 'posponer', h ? new Date(h).toISOString() : '', q.nombre); return { ok: true, hasta: h ? new Date(h).toISOString() : '' };
    }
    case 'resolver':
      if (!convs.length) return { ok: false, error: 'No encuentro esa conversación.' };
      convs.forEach(function (c) { hubResolver_(c, b.estado === 'abierta' ? 'abierta' : 'resuelta', q.nombre, Date.now()); });
      return { ok: true };
    case 'nota': {
      var t = String(b.texto || '').trim(); if (!t || !convs.length) return { ok: false, error: 'Escribe la nota.' };
      var ts = new Date().toISOString(); hojaNotas_().appendRow([ts, convs[0], q.nombre, celdaTexto_(t.slice(0, 2000))]);
      return { ok: true, nota: { conv: convs[0], canal: 'nota', de: 'nota', texto: t.slice(0, 2000), ts: ts, fotos: [], autor: q.nombre } };
    }
  }
  return { ok: false, error: 'op' };
}
