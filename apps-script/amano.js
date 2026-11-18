/* ═══ A LA MANO: lo que se acerca, cargado antes (Juan, 18-nov-2026) ══════════════════════════════════════════════
   «La enseñanza del juego de mundo abierto: no tenemos toda la información siempre a la mano, pero podemos simular qué
   tanto nos acercamos a ciertos temas. Si hablo del equipo de limpieza, traemos a la mano todas las limpiezas de ese
   día, quién las hace, si hay algún problema y cómo va la operación. La próxima vez que se pregunte, Alma ya no busca.»
   Como el rango de carga de un juego de mundo abierto (Unreal World Partition): lo cercano se carga antes; primero la
   versión simple (el «corto», lo que Alma dice al instante) y detrás el detalle.

   · TEMA: limpieza (la operación del día, de la copia de Epi), socio:<apartamento> y reserva:<código>.
   · CERCANÍA (0–100) de cada tema, por administrador: sube cuando se menciona (+60), cuando una herramienta lo toca (+50)
     y, la limpieza, por la hora (de 6 a 11 de la mañana nunca baja de 60); baja a la mitad cada AMANO_VIDA_MIN_ minutos.
     Desde AMANO_UMBRAL_ el tema está «cerca».
   · PAQUETE: lo que el Hub prepara de un tema cercano (en procesarCola, sin IA y sin ir a internet para la limpieza):
     corto + detalle + de cuándo es el dato («de»). Vive en la caché: se rehace si cambió su fuente o venció; con más de
     AMANO_VIEJO_MIN_ minutos no se usa (Alma lo pide a la secretaria como siempre).
   · Alma lo recibe: al empezar la llamada (la ficha, solo lo cercano y recortado por prioridad: amanoFicha_), en cada
     turno con la herramienta de voz a_mano (sin modelo, al instante: amanoVoz_), en el resultado de la secretaria cuando
     el pedido era de un tema con paquete (amanoParaSecretaria_) y en el chat cuando el mensaje nombra un tema cercano
     (amanoBloque_). Siempre dice de cuándo es el dato y nunca inventa: si no está en el paquete, usa la secretaria.
   · Calidad: cada vez que la copia de Epi se renueva, se compara lo que decía el paquete con lo nuevo (AMANO_CALIDAD);
     el robot amano_prueba lo compara con Epi en vivo y, si no coincide, el paquete no se usa por AMANO_DUDA_MIN_ minutos.
   · Medición (robot amano_medir): pedidos a la secretaria por llamada, cuántos eran de leer un tema con paquete y cuánto
     tardaron, por día; más los usos de a_mano (AMANO_USO). AMANO_ON = 0 lo apaga todo. */

var AMANO_VIDA_MIN_ = 60, AMANO_UMBRAL_ = 40, AMANO_MENCION_ = 60, AMANO_HERR_ = 50, AMANO_MANANA_ = [6, 11], AMANO_MANANA_PISO_ = 60;
var AMANO_VIEJO_MIN_ = 45, AMANO_DUDA_MIN_ = 30, AMANO_FICHA_MAX_ = 900, AMANO_BLOQUE_MAX_ = 1600, AMANO_GUARDA_S_ = 21600, AMANO_MAX_TEMAS_ = 8;
/* Cada tema: cómo se reconoce en un mensaje, qué herramientas lo tocan y cada cuánto se rehace (min). */
var AMANO_TEMAS_ = {
  limpieza: { re: /\b(limpi\w*|ruta|rutas|aseo|camarer\w*|t[eé]cnic[oa]s?|housekeep\w*|epi|salidas? sin|qui[eé]n (va|limpia|hace)|operaci[oó]n (de )?(hoy|del d[ií]a|ma[nñ]ana)|c[oó]mo va (la operaci[oó]n|el d[ií]a))\b/i,
              herr: ['ruta_del_dia', 'tareas_abiertas', 'crear_tarea', 'cerrar_tarea', 'agendar_en_epi'], cada: 10 },
  socio:    { re: /\b(soci[oa]s?|propietari[oa]s?|due[nñ][oa])\b/i, herr: ['ficha_socio'], cada: 60 },
  reserva:  { re: /\b(reserva|reservaci[oó]n|hu[eé]sped(es)?|check ?in|check ?out|lleg[oó]|llega|registro de llegada)\b/i, herr: ['buscar_reservas', 'historial_reserva', 'programados_reserva', 'ver_conversacion'], cada: 30 }
};

function amanoOn_() { try { return String(PropertiesService.getScriptProperties().getProperty('AMANO_ON') || '1') !== '0'; } catch (e) { return true; } }
function amanoHora_() { return Number(Utilities.formatDate(ahora_(), CFG.TZ, 'H')); }
function amanoHoraTxt_(iso) { var t = Date.parse(iso); return isNaN(t) ? '' : Utilities.formatDate(new Date(t), CFG.TZ, 'H:mm'); }
function amanoEdadMin_(iso) { var t = Date.parse(iso); return isNaN(t) ? Infinity : Math.max(0, Math.round((Date.now() - t) / 60000)); }
function amanoDe_(p) { var m = amanoEdadMin_(p.de); return 'dato de las ' + amanoHoraTxt_(p.de) + (m >= 1 ? ' (hace ' + m + ' min)' : ''); }
function amanoNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function amanoCorta_(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
function amanoBase_(clave) { return String(clave).split(':')[0]; }

/* ── La cercanía de cada administrador (caché, 6 h) ── { temas: { clave: { p, t, q } } } */
function amanoClaveEstado_(adm) { return 'AMANO_C_' + String(adm && adm.email || '').toLowerCase().slice(0, 200); }
function amanoEstado_(adm) { try { var v = CacheService.getScriptCache().get(amanoClaveEstado_(adm)); var o = v ? JSON.parse(v) : null; return o && o.temas ? o : { temas: {} }; } catch (e) { return { temas: {} }; } }
function amanoGuardarEstado_(adm, o) {
  var ks = Object.keys(o.temas), ahora = Date.now();
  ks.sort(function (a, b) { return amanoCercania_(o.temas[b], ahora) - amanoCercania_(o.temas[a], ahora); });
  var t = {}; ks.slice(0, AMANO_MAX_TEMAS_).forEach(function (k) { if (amanoCercania_(o.temas[k], ahora) >= 5) t[k] = o.temas[k]; });
  try { CacheService.getScriptCache().put(amanoClaveEstado_(adm), JSON.stringify({ temas: t }), AMANO_GUARDA_S_); } catch (e) { console.error('amanoGuardarEstado_: ' + e); }
}
function amanoCercania_(x, ahora) { return x ? Number(x.p || 0) * Math.pow(0.5, Math.max(0, (ahora || Date.now()) - Number(x.t || 0)) / (AMANO_VIDA_MIN_ * 60000)) : 0; }
/* Acerca uno o varios temas: [{ clave, puntos, q }]. q: lo que se dijo (para ubicar al socio o la reserva después). */
function amanoAcercar_(adm, lista) {
  if (!adm || !adm.email || !lista.length || !amanoOn_()) return;
  var o = amanoEstado_(adm), ahora = Date.now();
  lista.forEach(function (x) {
    var y = o.temas[x.clave];
    o.temas[x.clave] = { p: Math.min(100, Math.round(amanoCercania_(y, ahora) + x.puntos)), t: ahora, q: amanoCorta_(x.q || (y && y.q) || '', 160) };
  });
  amanoGuardarEstado_(adm, o);
}
/* Un mensaje del administrador (cualquier canal): solo reglas, sin IA ni internet. Para un socio o una reserva queda
   «socio?» / «reserva?» con lo que dijo; el Hub lo ubica después, en segundo plano (amanoPrepararSiToca_). */
function amanoSentir_(adm, texto) {
  try {
    var t = String(texto || ''); if (!t.trim()) return;
    var l = [];
    Object.keys(AMANO_TEMAS_).forEach(function (k) {
      if (!AMANO_TEMAS_[k].re.test(t)) return;
      l.push({ clave: k === 'limpieza' ? 'limpieza' : k + '?', puntos: AMANO_MENCION_, q: t });
    });
    if (l.length) amanoAcercar_(adm, l);
  } catch (e) { console.error('amanoSentir_: ' + e); }
}
/* Una herramienta del chat o de la secretaria tocó un tema (agEjecutar_). Una vez por tema y ejecución. */
var AMANO_TOCADOS_ = {};
function amanoHerramienta_(adm, nombre, inp) {
  try {
    if (!adm || !adm.email) return;
    var k = Object.keys(AMANO_TEMAS_).filter(function (x) { return AMANO_TEMAS_[x].herr.indexOf(nombre) >= 0; })[0]; if (!k) return;
    var q = k === 'socio' ? s_((inp || {}).socio) : k === 'reserva' ? s_((inp || {}).codigo || (inp || {}).texto) : '';
    var clave = k === 'limpieza' ? 'limpieza' : k + '?', marca = clave + '|' + q;
    if (AMANO_TOCADOS_[marca]) return; AMANO_TOCADOS_[marca] = 1;
    if (k !== 'limpieza' && !q) return;
    amanoAcercar_(adm, [{ clave: clave, puntos: AMANO_HERR_, q: q }]);
  } catch (e) { console.error('amanoHerramienta_: ' + e); }
}
/* Los temas cerca de este administrador, del más cercano al menos: [{ clave, p, q }]. La limpieza, por la mañana. */
function amanoCerca_(adm) {
  var o = amanoEstado_(adm), ahora = Date.now(), h = amanoHora_(), l = [];
  Object.keys(o.temas).forEach(function (k) { var p = amanoCercania_(o.temas[k], ahora); if (p >= AMANO_UMBRAL_) l.push({ clave: k, p: Math.round(p), q: o.temas[k].q || '' }); });
  if (h >= AMANO_MANANA_[0] && h < AMANO_MANANA_[1] && adm && esAdminPrincipal_(adm)) {
    var lim = l.filter(function (x) { return x.clave === 'limpieza'; })[0];
    if (!lim) l.push({ clave: 'limpieza', p: AMANO_MANANA_PISO_, q: '' }); else lim.p = Math.max(lim.p, AMANO_MANANA_PISO_);
  }
  return l.sort(function (a, b) { return b.p - a.p; });
}

/* ── Los paquetes (caché, por tema; los de limpieza son los mismos para todos los administradores) ── */
function amanoClavePaq_(clave) { return 'AMANO_P_' + amanoNorm_(clave).replace(/\s+/g, '_').slice(0, 200); }
function amanoLeer_(clave) { try { var v = CacheService.getScriptCache().get(amanoClavePaq_(clave)); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function amanoGuardar_(p) { try { CacheService.getScriptCache().put(amanoClavePaq_(p.clave), JSON.stringify(p), AMANO_GUARDA_S_); } catch (e) { console.error('amanoGuardar_: ' + e); } }
function amanoDuda_(base) { try { return !!CacheService.getScriptCache().get('AMANO_DUDA_' + base); } catch (e) { return false; } }
/* ¿Se puede usar? No viejo, no en duda. */
function amanoUsable_(p) { return !!p && !p.vacio && amanoEdadMin_(p.de) <= AMANO_VIEJO_MIN_ && !amanoDuda_(amanoBase_(p.clave)); }
/* El paquete del tema: el guardado si sigue al día; si no (y construir), se arma ahora. */
function amanoPaquete_(clave, q, construir) {
  var p = amanoLeer_(clave), base = amanoBase_(clave), cada = (AMANO_TEMAS_[base] || {}).cada || 30;
  var alDia = p && (base === 'limpieza' ? p.base === amanoEpiTs_() && amanoEdadMin_(p.hecho) < 60 : amanoEdadMin_(p.hecho) < cada);
  if (alDia || !construir) return p;
  var n = null;
  try { n = base === 'limpieza' ? amanoLimpieza_() : base === 'socio' ? amanoSocio_(q || clave.slice(6)) : base === 'reserva' ? amanoReserva_(q || clave.slice(8)) : null; }
  catch (e) { console.error('amanoPaquete_ ' + clave + ': ' + (e.stack || e)); }
  if (!n) return p;
  if (base === 'limpieza' && p && p.firma && p.base !== n.base) amanoCalidad_(p.firma === n.firma, p, n);   // lo que decía vs. la copia nueva de Epi
  amanoGuardar_(n);
  return n;
}
function amanoEpiTs_() { try { var g = epiSnapCache_(); return g && g.ts ? String(g.ts) : ''; } catch (e) { return ''; } }

/* ── LIMPIEZA: la operación del día, de la copia de Epi (sin internet) y la hoja de reservas ── */
function amanoLimpieza_() {
  var cfg = epiSnapCache_(); if (!epiSnapUtil_(cfg)) return null;
  var hoy = recHoy_(), dias = [hoy], h = amanoHora_();
  if (h >= RUTA_HORA_VISIBLE_) dias.push(sumarDias_(hoy, 1));   // la de mañana se comparte desde las 7 p. m. (rutaFechaOculta_)
  var corto = [], detalle = [], firma = {};
  dias.forEach(function (f) {
    var rt = agRutaTrabajos_(cfg, f, ''); if (rt.error) return;
    var dt = f === hoy ? 'Hoy' : 'Mañana', tr = rt.trabajos, por = {}, orden = [];
    tr.forEach(function (t) { var q = t.quien || 'sin asignar'; if (!por[q]) { por[q] = []; orden.push(q); } por[q].push(t.x); });
    orden.sort(function (a, b) { return por[b].length - por[a].length || a.localeCompare(b); });
    var tent = tr.filter(function (t) { return t.x.estado === 'tentativa'; }).length, hechas = tr.filter(function (t) { return t.x.estado === 'hecha'; }).length;
    var sin = (por['sin asignar'] || []).length;
    firma[f] = orden.map(function (q) { return q + ':' + por[q].map(function (x) { return x.propiedad + '|' + (x.estado === 'tentativa' ? 't' : ''); }).sort().join(','); }).join(';');
    if (!tr.length) { corto.push(dt + ' no hay limpiezas en Epi.'); return; }
    corto.push(dt + ': ' + tr.length + (tr.length === 1 ? ' trabajo' : ' trabajos') + ' con ' + orden.length + (orden.length === 1 ? ' persona' : ' personas') + ' (' +
      orden.slice(0, 6).map(function (q) { return String(q).split(' ')[0] + ' ' + por[q].length; }).join(', ') + (orden.length > 6 ? '…' : '') + ')' +
      (f === hoy && hechas ? '; ' + hechas + (hechas === 1 ? ' hecha' : ' hechas') : '') + (tent ? '; ' + tent + (tent === 1 ? ' tentativa' : ' tentativas') : '') + (sin ? '; ' + sin + ' sin persona' : '') + '.');
    orden.forEach(function (q) {
      detalle.push(dt + ' · ' + q + ': ' + por[q].map(function (x) {
        return [x.hora, String(x.tipo || 'trabajo').toLowerCase(), 'en ' + (x.propiedad || 'sin propiedad')].filter(Boolean).join(' ') +
          (x.estado === 'tentativa' ? ' (tentativa)' : x.estado === 'hecha' ? ' (hecha)' : '') + (x.entradaHoy ? ' (entra alguien ese día)' : '');
      }).join('; '));
    });
  });
  /* Problemas: la red de salidas (redsalidas.js, la última revisión de Epi) y las tareas abiertas vencidas o de hoy. */
  var red = null; try { red = JSON.parse(PropertiesService.getScriptProperties().getProperty('RED_SAL_ULTIMA') || 'null'); } catch (e) {}
  if (red && dias.indexOf(red.fecha) >= 0) {
    var cuando = red.fecha === hoy ? 'hoy' : 'mañana';
    if (!red.ok) { corto.push('La red de salidas de ' + cuando + ' no pudo revisarse en Epi (' + amanoHoraTxt_(red.ts) + ').'); }
    else if (red.faltan && red.faltan.length) {
      corto.push(red.faltan.length + (red.faltan.length === 1 ? ' salida sin limpieza confirmada ' : ' salidas sin limpieza confirmada ') + cuando + ' (revisión de las ' + amanoHoraTxt_(red.ts) + ').');
      detalle.push('Salidas sin limpieza confirmada ' + cuando + ': ' + red.faltan.map(function (x) { return x.propiedad + (x.propuesta ? ' (tentativa con ' + x.propuesta + ')' : ' (sin persona)'); }).join('; '));
    } else corto.push('Todas las salidas de ' + cuando + ' tienen limpieza (revisión de las ' + amanoHoraTxt_(red.ts) + ').');
  }
  var ab = (cfg.tareas || []).filter(function (t) { return t && t.id && !t.hecha; });
  var venc = ab.filter(function (t) { var v = String(t.vence || '').slice(0, 10); return v && v <= hoy; });
  if (venc.length) {
    corto.push(venc.length + (venc.length === 1 ? ' tarea vencida o de hoy' : ' tareas vencidas o de hoy') + ' (de ' + ab.length + ' abiertas).');
    detalle.push('Tareas vencidas o de hoy: ' + venc.slice(0, 8).map(function (t) { return amanoCorta_(t.texto, 70) + (t.prop && t.prop !== '-' ? ' (' + t.prop + ')' : ''); }).join('; '));
  } else if (ab.length) corto.push(ab.length + (ab.length === 1 ? ' tarea abierta' : ' tareas abiertas') + ', ninguna vencida.');
  /* Llegadas y salidas de hoy, según la hoja de reservas (las canceladas no cuentan). */
  try {
    var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return s_(r.code) && !/cancel/i.test(s_(r.status)); });
    var lleg = filas.filter(function (r) { return fecha_(r.checkin_date) === hoy; }), sal = filas.filter(function (r) { return fecha_(r.checkout_date) === hoy; });
    corto.push('Hoy ' + lleg.length + (lleg.length === 1 ? ' llegada' : ' llegadas') + ' y ' + sal.length + (sal.length === 1 ? ' salida.' : ' salidas.'));
    if (sal.length) detalle.push('Salen hoy: ' + sal.map(function (r) { return s_(r.property_name); }).join('; '));
    if (lleg.length) detalle.push('Llegan hoy: ' + lleg.map(function (r) { return s_(r.property_name); }).join('; '));
  } catch (e) { console.error('amanoLimpieza_ reservas: ' + e); }
  return { clave: 'limpieza', titulo: 'Limpiezas y operación del día', corto: corto.join(' '), detalle: detalle, de: String(cfg.ts), base: String(cfg.ts),
    hecho: new Date().toISOString(), fuente: 'copia de Epi' + (cfg.vieja ? ' (vieja)' : '') + ' y hoja de reservas', firma: JSON.stringify(firma) };
}

/* ── SOCIO: quién es, su apartamento ahora (huésped y próxima llegada), su limpieza de hoy y lo que contó (ficha de Mi) ── */
function amanoSocio_(q) {
  var s = fichaSocioBuscar_(q); if (!s || s.error || !s.propiedad) return null;
  var clave = 'socio:' + socioClaveProp_(s.propiedad).join(' '), hoy = recHoy_(), k = socioClaveProp_(s.propiedad).join(' ');
  var mia = function (p) { return socioClaveProp_(p).join(' ') === k; };
  var corto = ['Socio de ' + s.propiedad + ': ' + (s.nombre || 'sin nombre en Mi') + '.'], detalle = [];
  try {
    var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return s_(r.code) && !/cancel/i.test(s_(r.status)) && mia(s_(r.property_name)); });
    var ahora = filas.filter(function (r) { return fecha_(r.checkin_date) <= hoy && hoy < fecha_(r.checkout_date); })[0];
    var prox = filas.filter(function (r) { return fecha_(r.checkin_date) > hoy; }).sort(function (a, b) { return String(fecha_(a.checkin_date)).localeCompare(String(fecha_(b.checkin_date))); })[0];
    corto.push(ahora ? 'Ahora hay huésped hasta el ' + instFechaTxt_(fecha_(ahora.checkout_date)) + '.' : 'Hoy no hay huésped.');
    if (prox) corto.push('Próxima llegada: ' + instFechaTxt_(fecha_(prox.checkin_date)) + '.');
    if (ahora) detalle.push('Huésped actual: ' + [s_(ahora.guest_first_name), s_(ahora.guest_last_name)].join(' ').trim() + ' · ' + s_(ahora.code) + ' · del ' + instFechaTxt_(fecha_(ahora.checkin_date)) + ' al ' + instFechaTxt_(fecha_(ahora.checkout_date)));
    if (prox) detalle.push('Próxima reserva: ' + [s_(prox.guest_first_name), s_(prox.guest_last_name)].join(' ').trim() + ' · ' + s_(prox.code) + ' · del ' + instFechaTxt_(fecha_(prox.checkin_date)) + ' al ' + instFechaTxt_(fecha_(prox.checkout_date)));
  } catch (e) { console.error('amanoSocio_ reservas: ' + e); }
  try {
    var cfg = epiSnapCache_();
    if (epiSnapUtil_(cfg)) {
      var rt = agRutaTrabajos_(cfg, hoy, ''), suyas = (rt.trabajos || []).filter(function (t) { return mia(t.x.propiedad); });
      corto.push(suyas.length ? 'Limpieza hoy: ' + suyas.map(function (t) { return [t.x.hora, String(t.x.tipo || '').toLowerCase()].filter(Boolean).join(' ') + ' con ' + String(t.quien || 'sin persona').split(' ')[0] + (t.x.estado === 'tentativa' ? ' (tentativa)' : t.x.estado === 'hecha' ? ' (hecha)' : ''); }).join('; ') + '.' : 'Hoy no tiene limpieza en Epi.');
    }
  } catch (e) { console.error('amanoSocio_ Epi: ' + e); }
  try {
    var items = s.tel || s.correo ? fichaVer_(s) : null;
    if (items && items.length) {
      detalle.push('Lo que ha contado (ficha de Mi): ' + items.slice(-5).map(function (x) { return amanoCorta_(x.texto, 80) + (x.fecha_evento ? ' (' + x.fecha_evento + ')' : ''); }).join(' · '));
      var ret = typeof fichaParaRetomar_ === 'function' ? fichaParaRetomar_(items) : null; if (ret) corto.push('Para retomar con él: ' + amanoCorta_(ret.texto, 80) + '.');
    }
  } catch (e) { console.error('amanoSocio_ ficha: ' + e); }
  var ahoraIso = new Date().toISOString();
  return { clave: clave, titulo: 'Socio de ' + s.propiedad, corto: corto.join(' '), detalle: detalle, de: ahoraIso, hecho: ahoraIso, fuente: 'Mi, hoja de reservas y copia de Epi',
    llaves: [s.propiedad, s.nombre].concat(socioClaveProp_(s.propiedad)).filter(Boolean) };
}

/* ── RESERVA: una sola, con coincidencia exacta (como la respuesta instantánea); si son varias, no se arma ── */
function amanoReserva_(q) {
  q = String(q || '').trim(); if (!q) return null;
  var hoy = recHoy_(), hits = agBuscarReservas_(q, '', false, hoy, 5).filter(function (x) { return x.coincidencia === 'exacta'; });
  if (hits.length !== 1) return null;
  var r = hits[0].item, cod = s_(r.code).toUpperCase(), ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date);
  var nom = [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim() || 'Sin nombre', prop = s_(r.property_name);
  var est = /cancel/i.test(s_(r.status)) ? 'cancelada' : ci > hoy ? 'llega el ' + instFechaTxt_(ci) : co > hoy ? 'hospedado desde el ' + instFechaTxt_(ci) : co === hoy ? 'sale hoy' : 'ya salió (' + instFechaTxt_(co) + ')';
  var reg = '';
  try { reg = /complet/i.test(s_(r.status_form)) || formsOk_().indexOf(cod) >= 0 ? 'registro completo' : 'registro pendiente'; } catch (e) {}
  var corto = [nom + ' · ' + prop + ' · ' + est + (co && ci <= hoy && co > hoy ? ', sale el ' + instFechaTxt_(co) : '') + (reg && !/cancel/.test(est) ? ' · ' + reg : '') + ' (según la hoja de reservas).'];
  var detalle = ['Código ' + cod + ' · del ' + instFechaTxt_(ci) + ' al ' + instFechaTxt_(co) + (s_(r.guest_count) ? ' · ' + s_(r.guest_count) + ' huéspedes' : '')];
  try {
    var cfg = epiSnapCache_(), kp = socioClaveProp_(prop).join(' ');
    if (epiSnapUtil_(cfg) && co) {
      var rt = agRutaTrabajos_(cfg, co, ''); if (!rt.error) {
        var l = (rt.trabajos || []).filter(function (t) { return socioClaveProp_(t.x.propiedad).join(' ') === kp; });
        detalle.push(l.length ? 'Limpieza de su salida: ' + l.map(function (t) { return [t.x.hora, String(t.quien || 'sin persona').split(' ')[0], t.x.estado === 'tentativa' ? '(tentativa)' : ''].filter(Boolean).join(' '); }).join('; ') : 'Su salida todavía no tiene limpieza en Epi.');
      }
    }
  } catch (e) { console.error('amanoReserva_ Epi: ' + e); }
  var ahoraIso = new Date().toISOString();
  return { clave: 'reserva:' + cod, titulo: 'Reserva de ' + nom, corto: corto.join(' '), detalle: detalle, de: ahoraIso, hecho: ahoraIso, fuente: 'hoja de reservas y copia de Epi',
    llaves: [cod, nom.split(' ')[0], nom, prop].concat(socioClaveProp_(prop)).filter(Boolean) };
}

/* ── En segundo plano (procesarCola, cada minuto): prepara lo que está cerca. La limpieza solo lee la caché de Epi y la
   hoja (sin internet): se rehace cuando cambia la copia de Epi. «socio?» y «reserva?» se ubican aquí, no en el turno. ── */
function amanoPrepararSiToca_() {
  if (!amanoOn_()) return null;
  var c = CacheService.getScriptCache(); if (c.get('amano_t')) return null; c.put('amano_t', '1', 55);
  var hechos = 0, admins = []; try { admins = adminsOp_(); } catch (e) { return null; }
  admins.forEach(function (adm) {
    var cerca = amanoCerca_(adm), o = null;
    cerca.forEach(function (x) {
      if (hechos >= 3) return;
      if (/\?$/.test(x.clave)) {   // «socio?» / «reserva?»: ubicar de qué socio o reserva se habló
        var base = x.clave.slice(0, -1), p = null;
        try { p = base === 'socio' ? amanoSocio_(x.q) : amanoReserva_(x.q); } catch (e) { console.error('amanoPreparar ' + base + ': ' + e); }
        hechos++;
        o = o || amanoEstado_(adm); delete o.temas[x.clave];
        if (p) { amanoGuardar_(p); o.temas[p.clave] = { p: x.p, t: Date.now(), q: x.q }; }
        return;
      }
      var antes = amanoLeer_(x.clave), n = amanoPaquete_(x.clave, x.q, true);
      if (n && n !== antes) hechos++;
    });
    if (o) amanoGuardarEstado_(adm, o);
  });
  return { hechos: hechos };
}

/* ── Calidad: ¿lo que decía el paquete coincidía con la copia nueva de Epi? (por día, en AMANO_CALIDAD) ── */
function amanoCalidad_(igual, viejo, nuevo) {
  try {
    var P = PropertiesService.getScriptProperties(), q = {}; try { q = JSON.parse(P.getProperty('AMANO_CALIDAD') || '{}') || {}; } catch (e) {}
    var d = recHoy_(); q[d] = q[d] || { iguales: 0, distintos: 0 }; q[d][igual ? 'iguales' : 'distintos']++;
    var ks = Object.keys(q).sort().slice(-14), o = {}; ks.forEach(function (k) { o[k] = q[k]; });
    P.setProperty('AMANO_CALIDAD', JSON.stringify(o));
  } catch (e) { console.error('amanoCalidad_: ' + e); }
}
/* Robot amano_prueba: arma la limpieza con Epi EN VIVO y la compara con la precargada. Si no coincide, el paquete no se
   usa por AMANO_DUDA_MIN_ minutos (Alma vuelve a la secretaria) y se reemplaza por el nuevo. */
function amanoPrueba_() {
  var antes = amanoLeer_('limpieza'), t0 = Date.now();
  try { epiSnap_(true); } catch (e) { return { ok: false, error: 'Epi en vivo no respondió: ' + e }; }
  var msEpi = Date.now() - t0, vivo = amanoLimpieza_(); if (!vivo) return { ok: false, error: 'no pude armar la limpieza con la copia nueva' };
  var igual = !!antes && antes.firma === vivo.firma;
  if (antes && !igual) { try { CacheService.getScriptCache().put('AMANO_DUDA_limpieza', '1', AMANO_DUDA_MIN_ * 60); } catch (e) {} }
  if (antes) amanoCalidad_(igual, antes, vivo);
  amanoGuardar_(vivo);
  return { ok: true, habia_paquete: !!antes, coincide: igual, edad_min_del_precargado: antes ? amanoEdadMin_(antes.de) : null, ms_epi_en_vivo: msEpi,
    nota: !antes ? 'No había paquete precargado: ahora sí.' : igual ? 'Lo precargado era igual a Epi en vivo.' : 'No coincidía: no se usa por ' + AMANO_DUDA_MIN_ + ' min.' };
}

/* ── Lo que recibe Alma ── */
/* Al empezar la llamada (vozInicio_): lo cercano, solo el corto, por prioridad y recortado. */
function amanoFicha_(adm) {
  if (!adm || !amanoOn_()) return '';
  var l = [], largo = 0;
  amanoCerca_(adm).forEach(function (x) {
    if (/\?$/.test(x.clave)) return;
    var p = amanoLeer_(x.clave); if (!amanoUsable_(p)) return;
    var linea = '· ' + p.titulo + ' (' + amanoDe_(p) + '): ' + p.corto;
    if (largo + linea.length > AMANO_FICHA_MAX_) linea = amanoCorta_(linea, Math.max(0, AMANO_FICHA_MAX_ - largo));
    if (linea.length < 40) return;
    l.push(linea); largo += linea.length;
  });
  if (!l.length) return '';
  amanoUso_('ficha', 0);
  return '\n\nA LA MANO (el Hub lo preparó antes de la llamada; es de la hora que dice): ' + l.join('\n') +
    '\nSi la pregunta se contesta con esto, contesta ya, sin herramientas, y si el dato tiene más de 15 min di de cuándo es. Para el detalle usa a_mano. Lo que no esté aquí o haya que hacer: secretaria, como siempre.';
}
/* En el chat y en la secretaria (opAgente_): el paquete de los temas que nombra este mensaje y están cerca. */
function amanoBloque_(adm, texto) {
  if (!adm || !amanoOn_()) return '';
  var t = String(texto || ''), nt = ' ' + amanoNorm_(t) + ' ', out = [], largo = 0;
  amanoCerca_(adm).forEach(function (x) {
    if (/\?$/.test(x.clave)) return;
    var base = amanoBase_(x.clave), p = amanoLeer_(x.clave); if (!amanoUsable_(p)) return;
    var nombra = base === 'limpieza' ? AMANO_TEMAS_.limpieza.re.test(t) : (p.llaves || []).some(function (k) { k = amanoNorm_(k); return k.length >= 3 && nt.indexOf(' ' + k + ' ') >= 0; });
    if (!nombra) return;
    var b = p.titulo + ' (' + amanoDe_(p) + '; ' + p.fuente + '): ' + p.corto + (p.detalle.length ? '\n' + p.detalle.join('\n') : '');
    if (largo + b.length > AMANO_BLOQUE_MAX_) b = amanoCorta_(b, Math.max(0, AMANO_BLOQUE_MAX_ - largo));
    if (b.length < 40) return;
    out.push(b); largo += b.length;
  });
  if (!out.length) return '';
  amanoUso_('bloque', 0);
  return '\n\nA LA MANO (ya leído para este tema; no vuelvas a buscarlo con herramientas si la respuesta está aquí, y di de cuándo es si tiene más de 15 min):\n' + out.join('\n\n');
}
/* La herramienta de voz a_mano: sin modelo, al instante. Solo administradores (por el número o la firma de la llamada). */
var AMANO_VOZ_DESC_ = 'Al instante y sin esperar: lo que el Hub ya tiene preparado de un tema (limpieza = limpiezas de hoy y, desde las 7 p. m., de mañana: quién, dónde, tentativas, salidas sin limpieza, tareas vencidas, llegadas y salidas; socio = su apartamento, huésped, limpieza y ficha; reserva = una reserva por nombre o código). Solo administradores. Úsala ANTES que secretaria para preguntas de leer de esos temas, sin frase de espera. Si devuelve encontrado = false, usa secretaria con el mismo pedido. Di de cuándo es el dato si tiene más de 15 min y no agregues nada que no diga.';
function amanoVoz_(b) {
  var t0 = Date.now(), tel = normTel_(b.caller_id || b.system__caller_id || ''), adm = tel ? adminPorTel_(tel) : null;
  if (!adm) return { ok: true, encontrado: false, resultado: 'Solo para administradores: usa secretaria.' };
  if (!amanoOn_()) return { ok: true, encontrado: false, resultado: 'No lo tengo a la mano: usa secretaria con el pedido.' };
  var tema = String(b.tema || '').toLowerCase().trim(), que = String(b.que || '').trim();
  if (!AMANO_TEMAS_[tema]) tema = Object.keys(AMANO_TEMAS_).filter(function (k) { return AMANO_TEMAS_[k].re.test(que); })[0] || 'limpieza';
  var p = null;
  if (tema === 'limpieza') { amanoAcercar_(adm, [{ clave: 'limpieza', puntos: AMANO_HERR_, q: que }]); p = amanoPaquete_('limpieza', '', true); }
  else {
    /* El socio o la reserva ya cercanos que el pedido nombra; si no hay, se arma ahora con lo que dijo. */
    var nq = ' ' + amanoNorm_(que) + ' ';
    amanoCerca_(adm).forEach(function (x) { if (p || amanoBase_(x.clave) !== tema || /\?$/.test(x.clave)) return; var y = amanoLeer_(x.clave); if (y && (y.llaves || []).some(function (k) { k = amanoNorm_(k); return k.length >= 3 && nq.indexOf(' ' + k + ' ') >= 0; })) p = y; });
    if (!p && que) { try { p = tema === 'socio' ? amanoSocio_(que) : amanoReserva_(que); } catch (e) { console.error('amanoVoz_: ' + e); } if (p) amanoGuardar_(p); }
    if (p) amanoAcercar_(adm, [{ clave: p.clave, puntos: AMANO_HERR_, q: que }]);
  }
  var ok = amanoUsable_(p);
  amanoUso_(ok ? 'voz_' + tema : 'voz_falta', Date.now() - t0);
  if (!ok) return { ok: true, encontrado: false, resultado: 'No lo tengo a la mano' + (p && amanoDuda_(tema) ? ' (en revisión)' : p ? ' (el dato es viejo)' : '') + ': usa secretaria con el pedido, sin decirlo.' };
  return { ok: true, encontrado: true, de: amanoDe_(p), resumen: p.corto, detalle: p.detalle.join('\n').slice(0, 2500), fuente: p.fuente,
    regla: 'Contesta solo con esto, corto. Si tiene más de 15 min, di de cuándo es. Lo que no esté aquí: secretaria.' };
}
/* Al resultado de la secretaria: si el pedido era de un tema con paquete, el paquete va con él (así la siguiente pregunta
   del mismo tema ya no busca). */
function amanoParaSecretaria_(adm, pedido) {
  if (!adm || !amanoOn_()) return '';
  try {
    var t = String(pedido || ''), p = null;
    if (AMANO_TEMAS_.limpieza.re.test(t)) p = amanoLeer_('limpieza');
    if (!amanoUsable_(p)) return '';
    return 'A LA MANO para lo que siga de ' + p.titulo.toLowerCase() + ' (' + amanoDe_(p) + '): ' + amanoCorta_(p.corto + ' ' + p.detalle.join(' · '), 900);
  } catch (e) { return ''; }
}

/* ── Uso y medición ── */
var AMANO_PRUEBA_ = false;   // la prueba del robot no cuenta como uso
function amanoUso_(que, ms) {
  if (AMANO_PRUEBA_) return;
  try {
    var c = CacheService.getScriptCache(), d = recHoy_(), k = 'AMANO_USO_' + d, u = {}; try { u = JSON.parse(c.get(k) || '{}') || {}; } catch (e) {}
    u[que] = (u[que] || 0) + 1; if (ms) u[que + '_ms'] = (u[que + '_ms'] || 0) + ms;
    c.put(k, JSON.stringify(u), AMANO_GUARDA_S_ * 4);
    var P = PropertiesService.getScriptProperties(), h = {}; try { h = JSON.parse(P.getProperty('AMANO_USO') || '{}') || {}; } catch (e) {}
    h[d] = u; var ks = Object.keys(h).sort().slice(-14), o = {}; ks.forEach(function (x) { o[x] = h[x]; });
    P.setProperty('AMANO_USO', JSON.stringify(o));
  } catch (e) { console.error('amanoUso_: ' + e); }
}
/* Robot amano_medir: en el chat de cada administrador (hoja del chat, las últimas 3000 filas), los pedidos que la voz le
   pasó a la secretaria (canal llamada o calle, escritos por el Hub, no la transcripción), por día: cuántos, cuánto tardó
   la respuesta (desde que llegó el pedido hasta que se guardó la de Alma) y cuántos eran de LEER un tema que tiene
   paquete (limpieza, socio, reserva). Sin textos ni nombres: solo números. */
function amanoMedir_(dias) {
  dias = Math.max(1, Math.min(14, Number(dias) || 7));
  var desde = sumarDias_(recHoy_(), -dias + 1), filas = opFilas_('', 3000), por = {};
  var hacer = function (t) { return rapidoPideHacer_(t); };
  filas.forEach(function (m, i) {
    if (m.de !== 'yo' || (m.canal !== 'llamada' && m.canal !== 'calle') || !/^op\d/.test(m.id)) return;
    var dia = Utilities.formatDate(new Date(m.ts), CFG.TZ, 'yyyy-MM-dd'); if (dia < desde) return;
    var r = null; for (var j = i + 1; j < filas.length && j < i + 80; j++) { var y = filas[j]; if (y.usuario === m.usuario && y.de === 'alma' && y.canal === m.canal && /^op\d/.test(y.id)) { r = y; break; } }
    var s = r ? (Date.parse(r.ts) - Date.parse(m.ts)) / 1000 : null; if (s != null && (s < 0 || s > 180)) s = null;
    var tema = Object.keys(AMANO_TEMAS_).filter(function (k) { return AMANO_TEMAS_[k].re.test(m.texto); })[0] || 'otro', leer = !hacer(m.texto);
    var d = por[dia] = por[dia] || { pedidos: 0, s_total: 0, con_tiempo: 0, leer_tema: 0, s_leer_tema: 0, con_tiempo_tema: 0, por_tema: {} };
    d.pedidos++; if (s != null) { d.s_total += s; d.con_tiempo++; }
    if (leer && tema !== 'otro') { d.leer_tema++; d.por_tema[tema] = (d.por_tema[tema] || 0) + 1; if (s != null) { d.s_leer_tema += s; d.con_tiempo_tema++; } }
  });
  var uso = {}, cal = {}; try { uso = JSON.parse(PropertiesService.getScriptProperties().getProperty('AMANO_USO') || '{}'); cal = JSON.parse(PropertiesService.getScriptProperties().getProperty('AMANO_CALIDAD') || '{}'); } catch (e) {}
  return { ok: true, desde: desde, nota: 'pedidos = pedidos de la voz a la secretaria; leer_tema = de leer y de limpieza, socio o reserva; s = segundos del Hub (sin lo que tarda ElevenLabs).',
    por_dia: Object.keys(por).sort().map(function (k) {
      var d = por[k], u = uso[k] || {};
      var voz = Object.keys(u).filter(function (x) { return /^voz_(limpieza|socio|reserva)$/.test(x); }).reduce(function (n, x) { return n + u[x]; }, 0);
      var vozMs = Object.keys(u).filter(function (x) { return /^voz_(limpieza|socio|reserva)_ms$/.test(x); }).reduce(function (n, x) { return n + u[x]; }, 0);
      return { dia: k, pedidos: d.pedidos, s_prom: d.con_tiempo ? Math.round(d.s_total / d.con_tiempo * 10) / 10 : null, leer_tema: d.leer_tema, por_tema: d.por_tema,
        s_prom_leer_tema: d.con_tiempo_tema ? Math.round(d.s_leer_tema / d.con_tiempo_tema * 10) / 10 : null, s_secretaria_leer_tema: Math.round(d.s_leer_tema),
        a_mano: voz, a_mano_ms_prom: voz ? Math.round(vozMs / voz) : null, a_mano_sin_dato: u.voz_falta || 0, fichas_con_a_la_mano: u.ficha || 0, bloques_en_chat: u.bloque || 0,
        calidad: cal[k] || null };
    }) };
}
/* Robot amano_estado: qué tiene cerca cada administrador y qué paquetes hay (edad y largo; sin el contenido). */
function amanoEstadoRobot_(ver) {
  var out = { ok: true, on: amanoOn_(), admins: [], paquetes: {} };
  try {
    adminsOp_().forEach(function (adm) {
      var cerca = amanoCerca_(adm); if (!cerca.length) return;
      out.admins.push({ principal: !!adm.principal, cerca: cerca.map(function (x) { return { tema: amanoBase_(x.clave), p: x.p }; }) });
      cerca.forEach(function (x) { var p = amanoLeer_(x.clave); if (p) out.paquetes[x.clave.replace(/:.*/, ':…')] = { edad_min: amanoEdadMin_(p.de), usable: amanoUsable_(p), corto_largo: p.corto.length, detalle_lineas: p.detalle.length, ver: ver ? p.corto : undefined }; });
    });
  } catch (e) { out.error = String(e); }
  return out;
}
/* Robot amano_voz: corre a_mano como si llamara el administrador principal y dice cuánto tardó el Hub y si lo tenía (sin
   el contenido). Es la medición de la herramienta sin depender de una llamada real. */
function amanoVozPrueba_(tema, que) {
  var adm = adminsOp_().filter(function (a) { return a.principal; })[0]; if (!adm || !adm.tels || !adm.tels[0]) return { ok: false, error: 'sin principal con número' };
  AMANO_PRUEBA_ = true; var t0 = Date.now(), r; try { r = amanoVoz_({ caller_id: adm.tels[0], tema: tema || 'limpieza', que: que || '' }); } finally { AMANO_PRUEBA_ = false; }
  return { ok: true, ms: Date.now() - t0, encontrado: !!r.encontrado, de: r.de || '', resumen_largo: String(r.resumen || '').length, detalle_largo: String(r.detalle || '').length };
}
