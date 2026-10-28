/* ═══ 15 · ALMA VOZ (ElevenLabs) ════════════════════════════════════════════════════════════════
   El agente de voz «Alma» de ElevenLabs atiende las llamadas (WhatsApp por SIP y, más adelante, teléfono).
   Su system prompt ya define cómo habla y cómo valida; aquí viven sus herramientas, con el mismo cerebro
   de datos que ALMA por mensajes (reservas, bandeja, WhatsApp vinculado, ficha de la propiedad):

     lookup_reservation  → ubica y valida la reserva (por el número que llama, código, o nombre + fecha)
     property_info       → ficha de la propiedad, solo de una reserva vigente (sin códigos de cerradura)
     post-call webhook   → cada llamada terminada aparece en «Mensajes» del Hub, como cualquier conversación

   URL (Server tool o post-call webhook, POST con JSON):
       https://script.google.com/macros/s/<despliegue del Hub>/exec?voz=1&k=<LLAVE_VOZ>&h=<herramienta>
   La llave solo vive en ElevenLabs; aquí se guarda su huella SHA-256 (este código es público).
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var VOZ_HASH_ = '4dedaf0c70ab1f199064dc935b16a00f3419183628540516a52d48b16e53d44a';

function vozApi_(e, body) {
  var p = (e && e.parameter) || {};
  var k = String(p.k || body.k || '');
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, k, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (h !== VOZ_HASH_) return json_({ ok: false, error: 'llave' });
  var herr = String(p.h || body.herramienta || (body.type === 'post_call_transcription' ? 'postcall' : '')).toLowerCase();
  try {
    var out;
    vozWebIdentificar_(body);   // llamada desde el botón de Alma del Hub: sin número, se reconoce por su conversación
    if (herr === 'lookup_reservation') out = vozLookup_(body);
    else if (herr === 'property_info') out = vozPropertyInfo_(body);
    else if (herr === 'postcall') out = vozPostCall_(body);
    else if (herr === 'secretaria') out = vozSecretaria_(body);
    else if (herr === 'inicio') { out = vozInicio_(body); vozTraza_(herr, body, { ok: true, found: out._tipo }); delete out._tipo; return json_(out); }
    else out = { ok: false, error: 'herramienta desconocida: ' + herr };
    vozTraza_(herr, body, out);
    return json_(out);
  } catch (err) {
    console.error('vozApi_: ' + (err.stack || err));
    vozTraza_(herr, body, { ok: false, error: String(err).slice(0, 120) });
    return json_({ ok: false, error: 'interno' });
  }
}

/* ── utilidades ─────────────────────────────────────────────────────────────────────────── */
function vozNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function vozHoy_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
/* "Z10 - Airali - 1508" → "Zona 10 – Airali" (nunca el tercer segmento: número de apartamento). */
function vozZona_(nombre) {
  var seg = String(nombre || '').split(/\s+-\s+|\s+–\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (!seg.length) return '';
  var z = seg[0].match(/^Z(\d+)$/i);
  return (z ? 'Zona ' + z[1] : seg[0]) + (seg[1] ? ' – ' + seg[1] : '');
}
function vozPrefijo_(nombre) { return String(nombre || '').split(/\s+-\s+/)[0].trim().toLowerCase(); }
function vozVigente_(ci, co, hoy) { return !!ci && !!co && sumarDias_(ci, -30) <= hoy && hoy <= sumarDias_(co, 1); }

function vozRespuesta_(r, metodo, hoy) {
  var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date);
  return { ok: true, found: true, verified: true, ambiguous: false, metodo: metodo, today: hoy,
    code: s_(r.code), guest_name: [s_(r.guest_first_name), s_(r.guest_last_name)].filter(Boolean).join(' '),
    check_in: ci, check_out: co, property: vozZona_(r.property_name), guests: s_(r.guest_count),
    form_status: (/complet/i.test(s_(r.status_form)) || (function () { try { return formsOk_().indexOf(s_(r.code).toUpperCase()) >= 0; } catch (e) { return false; } })()) ? 'completo' : 'pendiente',
    stay: hoy < ci ? 'antes_del_checkin' : hoy > co ? 'despues_del_checkout' : 'estadia_activa' };
}

/* ── lookup_reservation ─────────────────────────────────────────────────────────────────── */
/* Quién llama. Fuente principal: Control de usuarios (todas sus pestañas), con nombre, rol y apps de cada persona.
   Respaldos: propietarios del Hub, técnicos de EPI, lista de escalamiento y WA_EQUIPO. WA_PRUEBA = equipo tratado como huésped. */
function vozUsuarioPorTel_(tel) {
  var k = fin8_(tel), c = CacheService.getScriptCache(), ck = 'vozusr_' + k, c0 = c.get(ck);
  if (c0) return c0 === '-' ? null : JSON.parse(c0);
  var norm = function (x) { return String(x || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
  var lleno = function (x) { var t = norm(x); return !!t && t !== 'no' && t !== 'false' && t !== '0'; };
  var hit = null;
  try {
    SpreadsheetApp.openById(SHEET_ACCESOS_ID).getSheets().forEach(function (sh) {
      if (hit) return;
      var v = sh.getDataRange().getDisplayValues(); if (v.length < 2) return;
      var cab = v[0].map(norm);
      var tels = cab.map(function (x, i) { return /^(telefono|telefonos|tel|celular|whatsapp|phone|movil)$/.test(x) ? i : -1; }).filter(function (i) { return i >= 0; });
      if (!tels.length) return;
      var cn = cab.findIndex(function (x) { return /^(nombre|name|primer_nombre)$/.test(x); }), cr = cab.findIndex(function (x) { return /^(rol|role|perfil|tipo_usuario|tipo)$/.test(x); });
      var cEst = cab.findIndex(function (x) { return /^(estado|activo|active)$/.test(x); });
      v.slice(1).forEach(function (r) {
        if (hit || (cEst >= 0 && /inactiv|baja|bloque|suspend|^no$|false/.test(norm(r[cEst])))) return;
        if (!tels.some(function (i) { return telsDe_(r[i]).some(function (t) { return fin8_(t) === k; }); })) return;
        var apps = {}; cab.forEach(function (x, i) { var m = x.replace(/\s+/g, '_').match(/^perm_(.+)$/); if (m && lleno(r[i])) apps[m[1]] = String(r[i]).trim(); });
        var flagsSocio = cab.some(function (x, i) { return /^(es_)?(dueno|duenio|duena|socio|socia|propietario)$/.test(x) && /^(si|yes|true|x|1|verdadero)$/.test(norm(r[i])); });
        hit = { nombre: cn >= 0 ? String(r[cn]).trim() : '', rol: cr >= 0 ? String(r[cr]).trim() : '', apps: apps, socio: flagsSocio, hoja: sh.getName() };
      });
    });
  } catch (e) { console.error('vozUsuarioPorTel_: ' + e); }
  c.put(ck, hit ? JSON.stringify(hit) : '-', 1800);
  return hit;
}

function vozQuien_(tel) {
  if (!tel) return { tipo: 'externo' };
  var p = PropertiesService.getScriptProperties();
  if (String(p.getProperty('VOZ_INTERNOS') || '').split(/[\s,;]+/).some(function (n) { n = n.replace(/\D/g, ''); return n && fin8_(n) === fin8_(tel); })) return { tipo: 'registro' };
  var prueba = String(p.getProperty('WA_PRUEBA') || '').split(/[,;\s]+/).some(function (x) { return x && fin8_(x) === fin8_(tel); });
  if (prueba) return { tipo: 'externo' };
  var u = vozUsuarioPorTel_(tel), nombre = u && u.nombre ? u.nombre.split(' ')[0] : '';
  if (!nombre) { try { var esc = escalamiento_().filter(function (x) { return fin8_(x.telefono) === fin8_(tel); })[0]; if (esc && esc.nombre) nombre = String(esc.nombre).split(' ')[0]; } catch (e) {} }
  var roles = u ? [u.rol].concat(Object.keys(u.apps).map(function (a) { return a + ': ' + u.apps[a]; })).filter(Boolean).join(' · ') : '';
  var texto = (u ? u.rol + ' ' + Object.keys(u.apps).map(function (a) { return u.apps[a]; }).join(' ') : '').toLowerCase();
  var esProp = false; try { esProp = waPropietarios_().some(function (x) { return fin8_(x) === fin8_(tel); }); } catch (e) {}
  if (u && (u.socio || /propietari|socio/.test(texto)) || (!u && esProp)) return { tipo: 'propietario', nombre: nombre, rol: roles || 'propietario / socio' };
  var juan = fin8_(CFG.WHATSAPP_JUAN) === fin8_(tel) || /admin_principal|principal/.test(texto);
  if (juan) return { tipo: 'juan', nombre: nombre || 'Juan', rol: roles || 'administrador principal' };
  if (u) return { tipo: 'equipo', nombre: nombre, rol: roles || 'equipo' };
  var tec = false; try { tec = waCfg_().equipo.some(function (x) { return fin8_(x) === fin8_(tel); }); } catch (e) {}
  if (tec) return { tipo: 'equipo', nombre: nombre, rol: 'equipo operativo (técnicos / escalamiento)' };
  return { tipo: 'externo' };
}

function vozCompetencias_(q) {
  var t = (q.rol || '').toLowerCase();
  if (q.tipo === 'juan') return 'Es el administrador principal de Spacio AM (fundador). Tiene acceso a todo: reservas, huéspedes, propiedades, códigos, finanzas y equipo. Respóndele todo lo que pida con los datos de las herramientas.';
  if (/admin/.test(t)) return 'Es administrador de Spacio AM. Puede consultar reservas, huéspedes, datos de propiedades y accesos. Respóndele directo lo operativo.';
  if (/tecnic|mantenimiento|proveedor/.test(t)) return 'Es técnico o proveedor de mantenimiento. Ayúdale con lo de su trabajo: qué propiedad, dirección, cómo entrar al edificio y quién está hospedado o llega hoy. No le des montos ni datos financieros.';
  if (/limpi|housekeep|camarer/.test(t)) return 'Es del equipo de limpieza. Ayúdale con entradas y salidas del día, direcciones y acceso a las propiedades para su trabajo. No le des montos ni datos financieros.';
  return 'Es del equipo de Spacio AM. Ayúdale con lo operativo de su trabajo; si pide algo financiero o sensible fuera de su rol, dile que lo vea con Juan.';
}

function vozLookup_(b) {
  var tel0 = normTel_(b.caller_id || b.system__caller_id || b.telefono || ''), q = vozQuien_(tel0);
  if (q.tipo === 'juan' || q.tipo === 'equipo' || q.tipo === 'propietario') {
    var equipo = q.tipo !== 'propietario';
    var base = { IMPORTANTE: equipo
        ? 'NO ES HUÉSPED. Quien llama es ' + (q.nombre || 'alguien') + ', del equipo de Spacio AM (' + q.rol + '). Ya está identificado por su número: no le pidas reserva, código, nombre ni fechas. ' + vozCompetencias_(q) + (q.nombre ? ' Llámalo ' + q.nombre + '.' : '')
        : 'NO ES HUÉSPED. Quien llama es ' + (q.nombre || 'un socio') + ', socio o propietario de Spacio AM. Ya está identificado por su número: no le pidas reserva. Atiéndelo con calidez; para reportes, pagos o decisiones de su propiedad, el equipo le escribe por WhatsApp.',
      ok: true, caller_type: q.tipo, team_member: equipo, caller_name: q.nombre || '', caller_role: q.rol || '', identified: true, today: vozHoy_() };
    try { var enc = encargoAbierto_(tel0); if (enc) base.ENCARGO = encargoInstruccion_(enc); } catch (e) {}
    var busca = b.code || b.codigo || b.guest_first_name || b.guest_last_name;
    if (!busca || !equipo) return base;
    var r = vozLookupHuesped_(Object.assign({}, b, { usar_telefono: false }));
    var o = { IMPORTANTE: base.IMPORTANTE, reserva_buscada: r };
    for (var x in base) if (x !== 'IMPORTANTE') o[x] = base[x];
    return o;
  }
  var out = vozLookupHuesped_(b); out.caller_type = q.tipo;
  try { var enc0 = encargoAbierto_(tel0); if (enc0) { out.ENCARGO = encargoInstruccion_(enc0); } } catch (e) {}
  return out;
}

function vozLookupHuesped_(b) {
  var hoy = vozHoy_(), cache = CacheService.getScriptCache();
  var tel = normTel_(b.caller_id || b.system__caller_id || b.telefono || '');
  var kf = 'vozf_' + (fin8_(tel) || 'x');
  var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return !/cancel/i.test(s_(r.status)) && s_(r.code); });
  var porCodigo = {}; filas.forEach(function (r) { porCodigo[s_(r.code).toUpperCase()] = r; });

  // 0) Teléfonos que el huésped dejó en el registro de llegada de hola.spacioam.com (titular, contacto y emergencia).
  if (tel && b.usar_telefono !== false) {
    try {
      var codHola = vozCodigoPorTelHola_(tel), rH = codHola && porCodigo[codHola];
      if (rH && vozVigente_(fecha_(rH.checkin_date), fecha_(rH.checkout_date), hoy)) return vozRespuesta_(rH, 'telefono_registro', hoy);
    } catch (e) { console.error('voz hola: ' + e); }
  }
  // 1) El número desde el que llama (WhatsApp vinculado, hoja de reservas o teléfonos del huésped en Hospitable).
  if (tel && b.usar_telefono !== false) {
    try {
      var rel = waReserva_(tel);
      if (rel && rel.resId) {
        var pre = preContexto_(rel.resId) || {};
        var rT = pre.codigo && porCodigo[String(pre.codigo).toUpperCase()];
        if (rT && vozVigente_(fecha_(rT.checkin_date), fecha_(rT.checkout_date), hoy)) return vozRespuesta_(rT, 'telefono', hoy);
      }
    } catch (x) { console.error('vozLookup_ tel: ' + x); }
  }
  // 2) Código de reserva (último recurso según el prompt, pero si lo dan, basta).
  var code = String(b.code || b.codigo || '').replace(/\s+/g, '').toUpperCase();
  if (code) {
    if (porCodigo[code]) { cache.remove(kf); return vozRespuesta_(porCodigo[code], 'codigo', hoy); }
    return vozFallo_(cache, kf, hoy, 'codigo_no_encontrado');
  }
  // 3) Nombre + apellido + fecha de entrada (o salida), con zona opcional para desempatar.
  if (Number(cache.get(kf) || 0) >= 6) return { ok: true, found: false, verified: false, today: hoy, blocked: true };
  var nombre = vozNorm_(b.guest_first_name || ''), apellido = vozNorm_(b.guest_last_name || '');
  if (!apellido && b.caller_name) { var cn = vozNorm_(b.caller_name).split(' '); apellido = cn.length > 1 ? cn.slice(1).join(' ') : ''; nombre = nombre || cn[0]; }
  var ci = fecha_(b.check_in || ''), co = fecha_(b.check_out || ''), zona = vozNorm_(b.property_name || '');
  if (!apellido && !nombre) return { ok: true, found: false, verified: false, today: hoy, ask_next: 'last_name' };
  var tok = function (s) { return s.split(' ').filter(function (w) { return w.length >= 3; }); };
  /* Por voz los nombres llegan mal transcritos (Erika/Ericka, Cuba/Kuba): se comparan por sonido y con tolerancia. */
  var seParece = function (w, full) { return full.split(' ').some(function (t) { return bqPalabraSim_(w, t) >= 0.7; }); };
  var cand = filas.filter(function (r) {
    var full = vozNorm_(s_(r.guest_first_name) + ' ' + s_(r.guest_last_name));
    if (apellido && !tok(apellido).some(function (w) { return seParece(w, full); })) return false;
    if (nombre && !tok(nombre).some(function (w) { return seParece(w, full); })) return false;
    var rci = fecha_(r.checkin_date), rco = fecha_(r.checkout_date);
    if (ci && !(rci === ci || rci === sumarDias_(ci, -1) || rci === sumarDias_(ci, 1))) return false;
    if (!ci && co && rco !== co) return false;
    if (!ci && !co && !vozVigente_(rci, rco, hoy)) return false;   // sin fecha: solo reservas vigentes
    if (zona && vozPrefijo_(r.property_name).indexOf(vozPrefijo_(zona)) !== 0 && vozNorm_(r.property_name).indexOf(zona) < 0 && bqPuntaje_(zona, r.property_name).puntaje < 0.7) return false;
    return true;
  });
  if (cand.length === 1) { cache.remove(kf); return vozRespuesta_(cand[0], 'nombre_y_fecha', hoy); }
  if (!cand.length) return vozFallo_(cache, kf, hoy, 'sin_coincidencia');
  var ask = !apellido ? 'last_name' : !ci && !co ? 'check_in' : 'zone';
  var zonas = cand.map(function (r) { return vozZona_(r.property_name); }).filter(function (z, i, a) { return z && a.indexOf(z) === i; });
  return { ok: true, found: true, verified: false, ambiguous: true, today: hoy, ask_next: ask, matches: cand.length, zone_options: zonas.slice(0, 2) };
}
function vozFallo_(cache, kf, hoy, motivo) {
  cache.put(kf, String(Number(cache.get(kf) || 0) + 1), 1800);
  return { ok: true, found: false, verified: false, ambiguous: false, today: hoy, motivo: motivo };
}

/* ── property_info ──────────────────────────────────────────────────────────────────────── */
function vozPropertyInfo_(b) {
  var code = String(b.code || b.codigo || '').replace(/\s+/g, '').toUpperCase(), hoy = vozHoy_();
  var r = code ? leerTabla_(CFG.TAB_RESERVAS).filter(function (x) { return s_(x.code).toUpperCase() === code && !/cancel/i.test(s_(x.status)); })[0] : null;
  if (!r) return { ok: true, found: false, verified: false, today: hoy };
  var lang = String(b.lang || 'es').slice(0, 2).toLowerCase() === 'en' ? 'en' : 'es';
  return { ok: true, found: true, verified: true, today: hoy, property: vozZona_(r.property_name), check_in: fecha_(r.checkin_date), check_out: fecha_(r.checkout_date),
    portal: 'hola.spacioam.com', form_status: /complet/i.test(s_(r.status_form)) ? 'completo' : 'pendiente',
    info: infoPropiedad_(s_(r.property_name), lang), knowledge: conocimiento_(s_(r.property_name)).slice(0, 4000) };
}

/* ── post-call webhook → «Mensajes» del Hub ─────────────────────────────────────────────────
   Cada llamada terminada se guarda como una conversación más: en la reserva del huésped si su número
   está vinculado, o como conversación de WhatsApp de ese número. Se ve el resumen y la transcripción. */
function vozPostCall_(body) {
  var d = body.data || body, md = d.metadata || {}, pc = md.phone_call || {}, dv = ((d.conversation_initiation_client_data || {}).dynamic_variables) || {};
  var convEL = s_(d.conversation_id);
  /* El webhook de ElevenLabs es de toda la cuenta: las conversaciones de otros agentes (Alma · Familia de The Gentle Stoic Parent)
     son personales y no entran al Hub. */
  var miAgente = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_AGENT_ID');
  if (d.agent_id && miAgente && s_(d.agent_id) !== miAgente) return { ok: true, ignorado: 'otro agente' };
  var tel = normTel_(pc.external_number || dv.system__caller_id || '');
  if (!convEL) return { ok: false, error: 'sin conversation_id' };
  /* Llamada sin número (prueba desde el navegador o el panel de ElevenLabs): es del administrador principal y va a su conversación. */
  var prueba = false;
  if (!tel) { var tw = vozWebTel_(convEL); if (tw) tel = normTel_(tw); }
  if (!tel) { try { var ppal = adminsOp_().filter(function (a) { return a.principal; })[0]; if (ppal && ppal.tels && ppal.tels[0]) { tel = normTel_(ppal.tels[0]); prueba = true; } } catch (x) {} }
  if (!vozMarcar_(convEL)) return { ok: true, duplicado: true };
  var t0 = Number(md.start_time_unix_secs || 0) * 1000 || Date.now(), dur = Number(md.call_duration_secs || 0);
  var rel = null; try { rel = tel ? waReserva_(tel) : null; } catch (x) {}
  var convId = rel && rel.resId ? rel.resId : (tel ? 'wa:' + tel : 'llamada:' + convEL);
  var pre = {}; try { pre = rel && rel.resId ? (preContexto_(rel.resId) || {}) : {}; } catch (x) {}
  var quien = { tipo: 'externo' }; try { quien = vozQuien_(tel); } catch (x) {}
  if (!pre.huesped && (quien.tipo === 'equipo' || quien.tipo === 'juan')) { pre.huesped = 'Equipo' + (quien.nombre ? ' · ' + quien.nombre : ''); pre.propiedad = 'Llamada del equipo'; }
  else if (!pre.huesped && quien.tipo === 'propietario') pre.propiedad = 'Llamada de propietario';
  var resumen = s_((d.analysis || {}).transcript_summary) || s_((d.analysis || {}).call_summary_title);
  /* Nombre y motivo: data collection del agente (nombre, motivo, propiedad) y, de respaldo, lo que devolvieron las herramientas. */
  var dc = (d.analysis || {}).data_collection_results || {}, dcv = function (k) { var x = dc[k]; var v = x && (x.value !== undefined ? x.value : x); return v == null || typeof v === 'object' ? '' : String(v).trim(); };
  var nomTool = '';
  (d.transcript || []).forEach(function (m) { (m.tool_results || []).forEach(function (tr) { if (nomTool) return; try { var j = JSON.parse(tr.result_value || '{}'); nomTool = s_(j.guest_name || j.caller_name).trim(); } catch (e) {} }); });
  var nomDC = dcv('nombre'), motivo = dcv('motivo') || s_((d.analysis || {}).call_summary_title), propDC = dcv('propiedad');
  if (!pre.huesped && (nomDC || nomTool) && !/^(desconocid|no se|n\/a|vac)/i.test(nomDC || nomTool)) pre.huesped = (nomDC || nomTool).slice(0, 60);
  if (!pre.propiedad && (motivo || propDC)) pre.propiedad = [propDC, motivo].filter(Boolean).join(' · ').slice(0, 90);
  var mmss = Math.floor(dur / 60) + ':' + ('0' + (dur % 60)).slice(-2);
  var canal = /sip/i.test(s_(pc.type)) || s_(pc.agent_number).replace(/\D/g, '').slice(-8) === '31280966' ? 'WhatsApp' : prueba ? 'navegador (prueba)' : 'teléfono';
  /* Un administrador: la llamada va a SU chat con Alma (el mismo de Hub y WhatsApp), no a la lista de conversaciones. */
  var admC = null; try { admC = tel ? (adminPorTel_(tel) || (quien.tipo === 'juan' ? adminsOp_().filter(function (a) { return a.principal; })[0] || null : null)) : null; } catch (x) {}
  var convHilo = admC ? 'op:' + admC.email : convId;
  if (admC) { try { opLlamadaGuardar_(admC, d, t0, dur, canal, motivo, resumen); } catch (x) { console.error('opLlamadaGuardar_: ' + x); } }
  var sh = hojaWA_(), filas = [];
  filas.push([new Date(t0).toISOString(), tel, pre.huesped || '', 'in', '📞 Llamada por ' + canal + ' · ' + mmss + (motivo ? ' · ' + motivo : '') + (resumen ? '\n' + resumen : ''), convEL + '#0', convHilo, 'llamada', 'sistema', '']);
  (d.transcript || []).forEach(function (m, i) {
    var txt = s_(m.message).trim(); if (m.role === 'agent') txt = vozSinNotas_(txt); if (!txt) return;
    var ts = new Date(t0 + Number(m.time_in_call_secs || 0) * 1000).toISOString();
    filas.push(m.role === 'agent' ? [ts, tel, 'ALMA voz', 'out', txt, convEL + '#' + (i + 1), convHilo, 'llamada', 'alma', '']
                                  : [ts, tel, pre.huesped || '', 'in', txt, convEL + '#' + (i + 1), convHilo, 'llamada', '', '']);
  });
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
  /* Si la llamada cumplía un encargo, el resumen le llega a quien lo pidió. */
  try { encargoCerrarConLlamada_(tel, d, resumen); } catch (x) { console.error('encargo voz: ' + x); }
  /* Lo que ALMA prometió en la llamada queda como pendiente rastreable (promesas.js). */
  try { var dichoAlma = (d.transcript || []).filter(function (m) { return m.role === 'agent'; }).map(function (m) { return s_(m.message); }).join('\n'); if (dichoAlma) promesaRegistrar_({ resId: convId, huesped: pre.huesped || (tel ? '+' + tel : ''), propiedad: pre.propiedad || '', texto: resumen }, dichoAlma.slice(-3000), 'llamada'); } catch (x) { console.error('promesa voz: ' + x); }
  if (admC) return { ok: true, conv_id: convHilo, mensajes: filas.length, administrador: admC.email };   // no entra a la lista de conversaciones ni al registro de huéspedes
  var fin = new Date(t0 + dur * 1000).toISOString();
  inboxUpsert_(convId, Object.assign({ huesped: pre.huesped || (tel ? '+' + tel : 'Llamada'), propiedad: pre.propiedad || 'Llamada · ' + canal, canal: pre.canal || 'whatsapp',
    ultimo_canal: 'whatsapp', ultimo_texto: '📞 Llamada · ' + (motivo ? motivo + ' · ' : '') + (resumen || mmss).slice(0, 260), ultimo_de: 'host', ultimo_ts: fin, ultimo_host_ts: fin },
    tel ? { wa: tel } : {}, pre.codigo ? { codigo: pre.codigo, checkin: pre.checkin, checkout: pre.checkout } : {}));
  try {
    log_({ resId: convId, huesped: pre.huesped || (tel ? '+' + tel : ''), propiedad: pre.propiedad || '', codigo: pre.codigo || '', checkin: pre.checkin || '', checkout: pre.checkout || '',
      canal: 'llamada', nivel: 'VERDE', texto: '📞 Llamada por ' + canal + ' (' + mmss + ')', razon: resumen.slice(0, 300) },
      '', 'ENVIADO · llamada atendida por ALMA voz');
  } catch (x) { console.error('vozPostCall_ log: ' + x); }
  return { ok: true, conv_id: convId, mensajes: filas.length };
}

/* Diagnóstico: últimas 30 llamadas a herramientas (sin datos personales), en caché 6 h. */
function vozTraza_(herr, b, out) {
  try {
    var c = CacheService.getScriptCache(), l = []; try { l = JSON.parse(c.get('voz_traza') || '[]'); } catch (x) {}
    l.unshift({ t: new Date().toISOString(), h: herr, tel: fin8_(b.caller_id || b.telefono || '').slice(-4), ok: !!(out && out.ok), found: out && out.found, verified: out && out.verified, ask: out && out.ask_next, metodo: out && out.metodo, tipo: out && out.caller_type, err: out && (out.error || out.motivo) || '' });
    c.put('voz_traza', JSON.stringify(l.slice(0, 30)), 21600);
  } catch (x) {}
}

/* ═══ Un solo prompt vivo ═══════════════════════════════════════════════════════════════════
   El agente de voz usa EL MISMO prompt con el que ALMA responde a los huéspedes en el Hub:
   REDACTOR + REGLAS_REDACTOR + automejoras aceptadas (lo mismo que se ve como «vigente» en el Hub),
   más los avisos temporales (REGLAS_EXTRA) y la fila «VOZ» con las anotaciones propias de las llamadas
   (editable en el Hub, grupo Llamadas). ESTILO no se manda: es formato de texto para el teléfono.
   Cada 30 min, si cambió algo, el Hub lo copia al agente de ElevenLabs por API (no se edita allá).
   Propiedades del script: ELEVENLABS_KEY, ELEVENLABS_AGENT_ID y, opcional, VOZ_INTERNOS
   (números internos separados por coma: se agregan al prompt al sincronizar, nunca quedan en el código). */
var SEMILLA_VOZ_ = [
  'ANOTACIONES PARA LLAMADAS (prevalecen sobre todo lo anterior cuando hablas por teléfono o por llamada de WhatsApp)',
  '',
  'CANAL',
  'Estás en una llamada de voz, no en un chat. Todo lo anterior aplica, con estas equivalencias:',
  '· No escribes: hablas. Turnos cortos, una idea por turno, ritmo suave y pausas naturales. Sin listas, viñetas, enlaces escritos, negritas ni emojis. La sección de FORMATO de chat no aplica.',
  '· Lo que antes venía en el mensaje ahora te lo dan las herramientas: RESERVA_CONFIRMADA = verified de lookup_reservation; HOY = today; CHECKIN / CHECKOUT = check_in / check_out; FORM_STATUS = form_status; la FICHA DE LA PROPIEDAD = property_info.',
  '· "Te escribimos por aquí mismo" se convierte en: "el equipo te escribe por WhatsApp a este mismo número; no necesitas esperar en línea".',
  '· Persona de voz: cálida, tranquila, segura, como una directora de hospitalidad boutique. Nunca robótica ni excesivamente alegre.',
  '',
  'VALIDAR LA RESERVA',
  '· Lo primero, antes de preguntar nada, llama a lookup_reservation con caller_id = {{system__caller_id}}. Si devuelve verified = true, la reserva ya quedó validada por el número desde el que llama: no pidas nombre, apellido ni fecha. Di algo breve como "Listo, ya la tengo" y sigue con lo que necesitaba, sin recitar los datos.',
  '· Si no se valida por el número, pregunta en este orden, una cosa a la vez: nombre, apellido, fecha de entrada ("¿Qué día llegas?", nunca en pasado si aún no llega). Luego llama a lookup_reservation con guest_first_name, guest_last_name, check_in (YYYY-MM-DD) y siempre caller_id. El código de reserva es el último recurso, nunca lo primero.',
  '· Si devuelve ambiguous = true, obedece ask_next: last_name → pide el apellido; check_in → pide la fecha; zone → ofrece máximo dos zonas de zone_options ("¿Es la de Zona 1 o la de Zona 10?"). Al volver a buscar, manda el dato nuevo más todo lo que ya tenías (property_name con la zona si desempataste por zona).',
  '· Sin coincidencia: pide el nombre completo con los dos apellidos, luego si puede estar a nombre de otra persona, y por último el código. Máximo tres búsquedas. Si no aparece: "Estoy teniendo problemas para ubicar tu reserva desde aquí. Lo reviso con el equipo y te escribimos por WhatsApp a este mismo número. No necesitas esperar en línea."',
  '· Con la reserva validada, compara today con check_in y check_out antes de resolver cualquier reporte del interior: muchos se explican con la fecha.',
  '· Sin reserva validada solo das edificio, zona y políticas generales: nunca apartamento, WiFi, códigos ni dirección exacta.',
  '',
  'DATOS DE LA PROPIEDAD',
  '· property_info { code, lang } solo con el code de una reserva validada. No leas la ficha completa: da los dos o tres puntos que necesita ahora y recuerda que el detalle está en el portal.',
  '· Lo que devuelve la herramienta se puede compartir con una reserva validada (portería, WiFi, apartamento, llegada). Lo que no devuelve, no existe: "Ese dato no lo tengo a la mano. Lo confirmo con el equipo y te escribimos por WhatsApp."',
  '· Los códigos de cerradura inteligente nunca se dicen por llamada: llegan por la plataforma el día antes de la llegada.',
  '· El portal se dice "hola punto spacio A eme punto com", y la marca "Spacio A eme". El AM siempre se deletrea: A, eme. Recuérdalo como algo que ya le enviamos por la plataforma. No dictes el código de reserva salvo que lo pida.',
  '',
  'DICTAR DATOS EXACTOS (WiFi, códigos de portería, direcciones)',
  '· Primero lo dices completo y con calma, marcando el formato ("todo junto, en minúsculas"). Luego preguntas "¿Te lo deletreo?" y esperas.',
  '· Si dice que sí, letra por letra y dígito por dígito, en grupos de tres o cuatro con pausas: "H, M, ocho, dos... Q, A, A, N". Nunca como cifra entera ("cero, tres, uno, cero", no "trescientos diez"). Al terminar: "Esa es."',
  '· Si te pide repetirlo, lo repites con paciencia las veces que haga falta.',
  '',
  'ESPERAS',
  '· Antes de usar una herramienta di una transición corta y variada ("Dame un segundo", "Déjame ver", "Un momentito"). Nunca silencio sin aviso y nunca describas lo que haces por dentro.',
  '',
  'TRANSFERIR A UNA PERSONA',
  '· Solo si no lo puedes resolver Y es urgente: huésped afuera sin acceso, servicios esenciales caídos, seguridad comprometida o una decisión humana inmediata. Nunca por solicitudes comunes, disponibilidad o solo porque la persona suena frustrada.',
  '· Reconoce con calma, confirma la urgencia con una pregunta si hace falta, di "Te paso con alguien del equipo para resolverlo de una vez" y usa transfer_to_number.',
  '· Si no es urgente: lo dejas anotado y el equipo le escribe por WhatsApp a este mismo número.'
].join('\n');

/* Fila VOZ_HUMANA (grupo Llamadas): cómo suena Alma para que se escuche como una persona. Se siembra una vez y
   después se edita en el Hub. Va al final del prompt de voz, así que prevalece en ritmo y forma de hablar. */
var SEMILLA_VOZ_HUMANA_ = [
  'CÓMO SUENAS (para que se escuche como una persona, no como un sistema)',
  '',
  'RITMO',
  '· Frases cortas, una idea por frase. Dos o tres frases por turno; más solo si estás dictando un dato.',
  '· Varía cómo empiezas. Nunca abras dos turnos seguidos con la misma palabra ni repitas la misma reacción.',
  '· Usa puntos suspensivos para pausas naturales ("Listo… ya la tengo") y signos de pregunta reales para que suba la entonación.',
  '',
  'CUANDO BUSCAS ALGO (herramientas)',
  '· Di UNA sola frase corta de espera ("Déjame revisar…", "Un momentito, lo busco…") y nada más. No la anuncies dos veces, no la reformules ni agregues otra frase de espera antes o después.',
  '· Mientras buscas, te quedas en silencio: la pausa es natural, como alguien que revisa sus archivos.',
  '· Al volver, entra directo con el resultado ("Listo, ya la tengo…"). Nunca vuelvas a decir que vas a buscar.',
  '',
  'TONO PAREJO',
  '· Mantén la misma voz, volumen y energía de principio a fin: cálida y tranquila. La emoción se nota en las palabras, no en cambios bruscos de tono.',
  '· Aunque la persona esté muy contenta, molesta o preocupada, tú no subes ni bajas la intensidad: acompañas con calma.',
  '· Nada de exclamaciones seguidas ni entusiasmo exagerado.',
  '',
  'REACCIONA ANTES DE RESOLVER',
  '· Primero una reacción breve y humana, luego la respuesta: "Qué bueno", "Entiendo", "Claro que sí", "Ah, mira". Sin exagerar.',
  '· Si algo salió mal, empatía primero y en una sola frase: "Qué pena que te pasó eso… Vamos a resolverlo."',
  '· Adapta el ritmo, no la intensidad: si la persona va apurada, directa y al grano; si va relajada, con más pausa.',
  '',
  'MULETILLAS',
  '· Leves y escasas, como una persona real: "mmm", "a ver", "fíjate que", "mira", "bueno". Máximo una cada varios turnos.',
  '· Nunca muletillas mientras dictas códigos, WiFi, direcciones, fechas o montos.',
  '',
  'EXPRESIÓN (etiquetas de voz)',
  '· Solo [warm] al saludar o despedir y [softly] al disculparte o en un tema delicado. Máximo una por turno y muchas veces ninguna. No uses otras etiquetas.',
  '',
  'NÚMEROS Y FECHAS COMO PERSONA',
  '· Fechas: "el viernes veinticuatro", "mañana a las tres de la tarde". Nunca "24/10" ni "15:00".',
  '· Montos: "ciento cincuenta quetzales", "veinte dólares".',
  '· Después de un dato importante, confirma de forma natural: "¿Te quedó?" o "¿Lo apuntaste?".',
  '',
  'CÓMO TE PRESENTAS Y CÓMO HABLAS',
  '· Te presentas una sola vez: "te saluda Alma, de Spacio A eme". Después no repites tu nombre ni la marca.',
  '· Español neutro latinoamericano, cálido, con las palabras de la marca ("con gusto", "qué bueno", "te confirmo"). Siempre de tú. Respeta la VOZ DE MARCA: nada de "va", "dale", "ahorita" ni voseo.',
  '· Usa su nombre de vez en cuando (no en cada turno) cuando ya lo sabes.',
  '· Nunca dices "como asistente virtual", "procesando", "según mi sistema" ni lees listas. Si no sabes algo: "Déjame confirmarlo con el equipo y te escribimos por WhatsApp."',
  '· Si te interrumpen, te detienes, escuchas y retomas desde lo que la persona necesita, sin repetir todo lo anterior.',
  '',
  'CIERRE',
  '· Resume en una frase lo acordado y despídete con calidez: "Listo, entonces mañana a las tres te esperamos. Que descanses, cualquier cosa aquí estoy."'
].join('\n');

/* Reemplaza una sola vez la primera versión de la fila VOZ (citaba secciones de otro prompt). */
var VOZ_SEMILLA_VIEJA_ = /sigue el orden de la sección 9 \(nombre/;

function vozQuienBloque_() {
  var ficha = PropertiesService.getScriptProperties().getProperty('VOZ_INICIO_OK') ? ['FICHA DE QUIEN LLAMA (el Hub la identificó por su número antes de contestar; confía en ella y no vuelvas a preguntar lo que ya dice):', '{{quien_llama}}', ''] : [];
  return ficha.concat(['QUIÉN LLAMA (lo indica lookup_reservation en caller_type). Tu PRIMERA acción en cada llamada, apenas la persona diga algo, es llamar lookup_reservation solo con caller_id, antes de responder o preguntar nada. Si alguien pregunta si reconoces su número, consúltalo con la herramienta antes de contestar.',
    '· Si la respuesta de lookup_reservation trae el campo IMPORTANTE, obedécelo por encima de todo lo demás, incluida la sección de PRIVACIDAD: la validación de reserva es para huéspedes, no para el equipo ni los socios, que ya quedaron identificados por su número. Si alguien pregunta si reconoces su número, responde según IMPORTANTE.',
    '· caller_type = juan o equipo (team_member = true): es Juan o alguien del equipo operativo de Spacio AM. No es un huésped: no pidas reserva, nombre ni fecha para validarle. Salúdalo por su nombre si viene en caller_name y ayúdale con lo operativo que necesite. Si pregunta por una reserva o un huésped, busca con el nombre, apellido o código que te dé y comparte lo que devuelvan las herramientas (property_info con el code incluido). Si pide algo que no puedes resolver por llamada, se lo dejas anotado al equipo.',
    '· Si quien llama es administrador (caller_type juan, o equipo con rol admin) y pide hacer o consultar algo operativo (escribirle a alguien, rutas, tareas, reservas, datos de propiedades, búsquedas), usa la herramienta secretaria con su pedido completo. Nunca digas que hiciste algo si secretaria no lo confirma.',
    '· SECRETARIA TRABAJA EN PARALELO: al llamarla, di UNA frase corta y natural según el pedido («Lo reviso.», «Ya lo pedí, te cuento en cuanto lo tenga.») y sigue la conversación con normalidad: atiende lo que diga, contesta otras cosas o pregunta si necesita algo más. No te quedes en silencio esperando ni rellenes con «sigo buscando». Nunca adelantes el resultado ni digas «listo» antes de que llegue.',
    '· CUANDO LLEGA LA RESPUESTA de secretaria: si estás a mitad de una frase o de otro tema, termina tu idea y luego introdúcela con naturalidad («Por cierto, ya tengo lo de César: …», «Ah, y lo de las cancelaciones: …»). No interrumpas a la persona ni cortes lo que estabas diciendo. Si llegan varias, dalas en orden, una a la vez. Si la persona ya cambió de tema, dásela breve y vuelve a donde iban.',
    '· Si la persona pregunta por algo que pediste y aún no llega, di que sigue en proceso («todavía no me responde, te aviso en cuanto llegue»). No lo vuelvas a pedir: un pedido va una sola vez.',
    '· SEGUNDO PLANO (secretaria con modo = segundo_plano): úsalo cuando el pedido es una acción que no necesita respuesta en la llamada (crear tareas o recordatorios, programar mensajes, marcar algo, cerrar pendientes, el paso final de algo ya resuelto), cuando son varias acciones juntas, cuando la persona dice que se tiene que ir, o si un intento anterior falló o tardó. Di algo como «No te preocupes, yo me encargo y te confirmo por WhatsApp cuando esté listo», usa secretaria con modo = segundo_plano UNA sola vez y, si la persona ya no necesita nada más, despídete. Nunca prometas confirmar por WhatsApp sin haber usado el modo segundo_plano: es lo que hace que la confirmación llegue.',
    '· Si secretaria falla, no lo reintentes en la llamada: pásalo a segundo plano.',
    '· caller_type = propietario: es un socio o propietario. Atiéndelo con calidez; para reportes, pagos o decisiones de su propiedad, dile que el equipo le escribe por WhatsApp a este mismo número.',
    '· caller_type = registro: número de un edificio o contacto que solo comparte información de registros. Explícale con amabilidad que por esta línea no puedes gestionar solicitudes para su número y que para soporte escriba al grupo de Spacio AM en WhatsApp. Si solo saluda o agradece, responde breve y amable.',
    '· caller_type = externo: huésped o persona sin relación conocida. Aplica la validación de reserva normal.',
    '· Nunca cuelgues tú primero ni uses end_call justo después de responder: termina la llamada solo cuando la persona se despida o confirme que no necesita nada más.',
    '· NO REPITAS: nunca repitas ni parafrasees en voz alta lo que la persona acaba de decir («Te entiendo, me tengo que ir…»). Responde directo a lo que necesita.',
    '· DESPEDIDA: despídete UNA sola vez. Si ya te despediste y la persona responde con otra cortesía («gracias», «igualmente», «tú también», «adiós»), no vuelvas a despedirte ni a desear buen día: usa end_call de inmediato, sin decir nada más.',
    '',
    'CON EL EQUIPO Y LOS SOCIOS (caller_type juan, equipo o propietario) NO APLICAN LOS PATRONES DE HUÉSPED',
    '· Es un equipo interno: trato cordial pero directo, dinámico y sin rodeos, como una compañera de trabajo eficiente. Nada de «el equipo te escribirá», «no te puedo dar esa información» ni validaciones.',
    '· Si preguntan por alguien del equipo (ej. «¿y Gabriel?»), responde con lo que sabes de su trabajo (rutas, tareas) usando secretaria; no digas que «no está disponible» ni inventes su estado.',
    '· Si la respuesta de lookup_reservation trae ENCARGO, ese es el motivo de la llamada para ti: cúmplelo con naturalidad (preséntate, explica, pregunta lo que pide) y al terminar despídete; el resumen le llega solo a quien te lo encargó.',
    '',
    'CON UN ADMINISTRADOR (reglas fijas, por encima de todo)',
    '· Si la FICHA DE QUIEN LLAMA dice «LLAMADA DESDE LA APP DEL HUB», ya está identificado: no llames lookup_reservation para identificarle. Para pedidos del administrador nunca uses lookup_reservation ni hospitable_router: todo va por secretaria.',
    '· Las personas del equipo (Jorge, Gabriel, Santiago, técnicos, recepciones de edificios) no son huéspedes: nunca busques «la reserva de» alguien del equipo.',
    '· En pedido pasa sus palabras tal cual, completas (nombres, números, apartamento, texto del mensaje). No las resumas ni cambies a quién va dirigido.',
    '· EN PANTALLA: si dice «el huésped», «la reserva», «escríbele» sin decir cuál, es la de EN PANTALLA. Si no hay EN PANTALLA o no está claro, pregunta cuál en una frase; nunca lo deduzcas del historial ni de llamadas anteriores.',
    '· NUNCA CONFIRMES DE MEMORIA: solo di «listo», «ya se envió» o «quedó» si secretaria lo confirmó en ESTA respuesta. Si secretaria devuelve ok:false, un error o no menciona la acción, NO se hizo: dilo así («no pude, el sistema me respondió…») y ofrece intentarlo de nuevo o en segundo plano. Si pregunta si algo se envió o en qué quedó, consúltalo con secretaria antes de responder.',
    '· Si secretaria dice que a la persona solo le llegó el mensaje de primer contacto (no había escrito en 24 h) o que el mensaje sale cuando responda, dilo así: «le llegó el aviso; el mensaje completo sale en cuanto conteste». No digas que ya lo recibió.',
    '· Un pedido va UNA sola vez a secretaria: nunca lo mandes en primer plano y además en segundo plano, ni lo repitas si ya respondió. Si dudas si salió, pregúntale a secretaria si se envió.',
    '· Si te pide un momento («dame un segundo», «déjame ver»), espera en silencio. Como mucho un recordatorio corto; nunca repitas la misma pregunta.',
    '· Con el equipo nada de frases de centro de llamadas («gracias por comunicarte», «gracias por confirmarlo», «con gusto le apoyo»). Directa y cálida, de tú.',
    '· Al terminar con end_call no agregues otra despedida si ya te despediste, y nunca pongas etiquetas, notas de tono ([warm]) ni marcadores en lo que vas a decir.']).join('\n');
}

function vozInternos_() {
  var lista = String(PropertiesService.getScriptProperties().getProperty('VOZ_INTERNOS') || '').split(/[\s,;]+/).map(function (n) { return n.replace(/\D/g, ''); }).filter(Boolean);
  if (!lista.length) return '';
  return ['NÚMEROS INTERNOS (prioridad máxima, por encima de todo lo anterior)',
    'Si {{system__caller_id}} es exactamente uno de estos números: ' + lista.join(', ') + ', no atiendes solicitudes.',
    '· Si solo saluda, agradece o confirma algo, responde amable en una frase y no agregues nada.',
    '· Para cualquier otra cosa di exactamente: "Hola. Este número es solo para compartir información de registros y no está autorizado para resolver solicitudes. Para soporte, por favor comunícate con el grupo de Spacio AM en WhatsApp. ¡Gracias!"',
    'Si el número no está en la lista, ignora esta regla.'].join('\n');
}

/* Con Juan y el equipo, la voz es la MISMA Alma del WhatsApp: el prompt vivo SECRETARIA (con sus mejoras) entra al
   agente de ElevenLabs en cada sincronización (cada 30 min si cambió algo). Solo se adapta la forma: es una llamada. */
function vozEquipoBloque_() {
  var sec = ''; try { sec = secretariaPrompt_(); } catch (e) { sec = String(prompt_('SECRETARIA') || '').trim(); }
  if (!sec) return '';
  var mej = '';
  return ['CON JUAN Y EL EQUIPO (caller_type juan o equipo, o la ficha dice que es un administrador identificado) — PREVALECE SOBRE TODO LO DE HUÉSPEDES',
    'Con ellos eres exactamente la misma Alma que les responde por WhatsApp y en el Hub: misma personalidad, misma energía, misma confianza. Abajo está su guía tal como la usa el WhatsApp.',
    'En la llamada cambia solo la forma: frases cortas, nada de listas ni markdown ni enlaces. Las herramientas que esa guía menciona (buscar_reservas, escribir_a_equipo, codigo_acceso, ruta_del_dia, crear_tarea…) las usas pidiéndoselo a la herramienta secretaria con el pedido completo; nunca digas que hiciste algo si secretaria no lo confirmó.',
    '', '--- GUÍA DE ALMA CON EL EQUIPO (WhatsApp) ---', sec + mej, '--- FIN DE LA GUÍA DEL EQUIPO ---'].join('\n');
}
function vozPromptCompleto_() {
  var voz = String(prompt_('VOZ') || '').trim();
  if (!voz || VOZ_SEMILLA_VIEJA_.test(voz)) { hubSetPrompt_('VOZ', SEMILLA_VOZ_, 'anotaciones de llamadas v2 (independientes de ElevenLabs)'); voz = SEMILLA_VOZ_; }
  var base = prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + mejorasBloque_('REDACTOR');
  if (!String(base).trim()) return { error: 'El prompt REDACTOR está vacío en ALMA_INSTRUCCIONES.' };
  var extra = sinCab_(prompt_('REGLAS_EXTRA'));
  var humana = String(prompt_('VOZ_HUMANA') || '').trim();
  var weebo = ''; try { weebo = weeboVozBloque_(false); } catch (e) {}
  return { clave: 'REDACTOR', texto: [vozQuienBloque_(), vozEquipoBloque_(), 'CON HUÉSPEDES (caller_type externo) — todo lo que sigue es para huéspedes:', base.trim(), extra ? 'AVISOS TEMPORALES:\n' + extra : '', voz, weebo, humana].filter(Boolean).join('\n\n') };
}
function vozSyncSiToca_() {
  var c = CacheService.getScriptCache(); if (c.get('voz_sync_ok')) return;
  c.put('voz_sync_ok', '1', 1800);
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ELEVENLABS_KEY') || !p.getProperty('ELEVENLABS_AGENT_ID')) return;
  vozSyncPrompt_(false);
  try { familiaSyncPrompt_(false); } catch (e) { console.error('familiaSyncPrompt_: ' + e); }   // Alma · Familia (familia.js)
}
function vozSyncPrompt_(forzar) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  var guardar = function (o) { o.t = new Date().toISOString(); p.setProperty('VOZ_SYNC', JSON.stringify(o)); return o; };
  if (!key || !agente) return guardar({ ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' });
  var pc = vozPromptCompleto_(); if (pc.error) return guardar({ ok: false, error: pc.error });
  var huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pc.texto, Utilities.Charset.UTF_8));
  if (!forzar && huella === p.getProperty('VOZ_PROMPT_HUELLA')) return { ok: true, sin_cambios: true };
  var url = 'https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(agente), h = { 'xi-api-key': key };
  var g = UrlFetchApp.fetch(url, { headers: h, muteHttpExceptions: true });
  if (g.getResponseCode() !== 200) return guardar({ ok: false, error: 'GET agente HTTP ' + g.getResponseCode(), detalle: g.getContentText().slice(0, 200) });
  var ag = JSON.parse(g.getContentText()), prompt = (((ag.conversation_config || {}).agent || {}).prompt) || {};
  prompt.prompt = pc.texto;   // solo cambia el texto; herramientas, LLM y demás quedan como están
  if (prompt.tool_ids && prompt.tool_ids.length) delete prompt.tools;   // la API no acepta los dos a la vez
  var r = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true,
    payload: JSON.stringify({ conversation_config: { agent: { prompt: prompt } } }) });
  if (r.getResponseCode() < 200 || r.getResponseCode() >= 300) return guardar({ ok: false, error: 'PATCH agente HTTP ' + r.getResponseCode(), detalle: r.getContentText().slice(0, 200) });
  p.setProperty('VOZ_PROMPT_HUELLA', huella);
  return guardar({ ok: true, clave_base: pc.clave, caracteres: pc.texto.length });
}

/* Puente Cloudflare (Worker alma-puente): ElevenLabs no sigue la redirección 302 de Apps Script; el Worker la sigue y devuelve la respuesta limpia. */
var VOZ_PUENTE_ = 'https://alma-puente.jforce15.workers.dev/';

/* ═══ Herramientas del agente (las crea/actualiza el Hub por API; no hace falta configurarlas a mano) ═══
   Robot: { dsBot, token, action:'voz_tools', k:'<llave de voz>' }. La llave viaja en la URL de la herramienta
   (ElevenLabs la guarda); aquí solo se verifica contra VOZ_HASH_. Idempotente: si ya existen, las actualiza. */
function vozDefHerramientas_(base) {
  var s = function (d) { return { type: 'string', description: d }; };
  var caller = { type: 'string', dynamic_variable: 'system__caller_id' };
  var conv = { type: 'string', dynamic_variable: 'system__conversation_id' };
  return [
    { name: 'lookup_reservation', response_timeout_secs: 20,
      description: 'Ubica y valida la reserva de quien llama. Llámala SIEMPRE primero, solo con caller_id (valida por el número que llama). Si no queda validada, vuelve a llamarla con nombre, apellido y fecha de entrada (y lo que ya tengas). Devuelve caller_type (juan, equipo, propietario o externo), team_member, caller_name, found, verified, ambiguous, ask_next, zone_options, today, code, guest_name, check_in, check_out, property, form_status. Si team_member = true no hace falta validar reserva.',
      api_schema: { url: base + '&h=lookup_reservation', method: 'POST', request_body_schema: { type: 'object', required: ['caller_id'], properties: {
        caller_id: caller,
        guest_first_name: s('Nombre del titular de la reserva, si ya lo dio.'),
        guest_last_name: s('Apellido del titular, si ya lo dio.'),
        check_in: s('Fecha de entrada en formato YYYY-MM-DD, si ya la dio.'),
        check_out: s('Fecha de salida YYYY-MM-DD, solo como filtro secundario.'),
        property_name: s('Prefijo de zona para desempatar (Z1, Z10, Antigua), solo si ask_next fue zone.'),
        code: s('Código de reserva, solo si la persona lo dio.'), conv_id: conv } } } },
    { name: 'property_info', response_timeout_secs: 20,
      description: 'Datos de la propiedad de una reserva YA validada (verified = true): dirección, cómo llegar, portería, WiFi, parqueo y base de conocimiento del edificio. Usa el code que devolvió lookup_reservation.',
      api_schema: { url: base + '&h=property_info', method: 'POST', request_body_schema: { type: 'object', required: ['code'], properties: {
        code: s('Código de la reserva validada (campo code de lookup_reservation).'),
        lang: s('Idioma de la llamada: es o en.'),
        caller_id: caller, conv_id: conv } } } },
    { name: 'secretaria', response_timeout_secs: 60,
      description: 'SOLO para administradores de Spacio AM (caller_type juan o equipo con rol admin). Ejecuta lo que pide el administrador con las herramientas de la secretaria: escribir a un huésped o a alguien del equipo, revisar rutas de Epi, tareas, reservas, conversaciones, corregir datos de propiedades, promesas, búsquedas. Pásale el pedido completo en palabras del administrador. Devuelve el resultado real: solo confirma lo que esta herramienta diga que se hizo.',
      api_schema: { url: base + '&h=secretaria', method: 'POST', request_body_schema: { type: 'object', required: ['caller_id', 'pedido'], properties: {
        caller_id: caller, conv_id: conv,
        pedido: s('Lo que pide el administrador, completo y con todos los datos que dio (nombres, códigos, fechas, texto del mensaje).'),
        modo: s('esperar (por defecto): lo haces ahora y respondes en la llamada. segundo_plano: el Hub lo hace después de la llamada y le confirma por WhatsApp al administrador; úsalo para acciones que no necesitan respuesta en la llamada, varias acciones juntas, si la persona se tiene que ir o si un intento falló o tardó.') } } } }
  ].map(function (t) {
    var sec = t.name === 'secretaria';
    t.type = 'webhook'; t.pre_tool_speech = 'off'; t.tool_error_handling_mode = 'auto';
    /* secretaria tarda 8 a 25 s: corre en paralelo (async) y la conversación sigue mientras trabaja; cuando llega la
       respuesta, ALMA la introduce con naturalidad. Sin sonido de tecleo para que no suene encima de la charla. Si el
       administrador habla mientras trabaja, el pedido no se pierde: sigue corriendo y su respuesta llega igual. */
    t.execution_mode = sec ? 'async' : 'post_tool_speech';
    t.tool_call_sound = sec ? null : 'typing'; t.tool_call_sound_behavior = sec ? 'auto' : 'always';
    t.interruption_mode = 'allow';
    return t;
  });
}

function vozHerramientas_(k) {
  if (!k || Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(k), Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('') !== VOZ_HASH_) return { ok: false, error: 'llave de voz' };
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var api = 'https://api.elevenlabs.io/v1/convai', h = { 'xi-api-key': key };
  var pedir = function (metodo, ruta, cuerpo) {
    var o = { method: metodo, headers: h, muteHttpExceptions: true };
    if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
    var r = UrlFetchApp.fetch(api + ruta, o), c = r.getResponseCode(), t = r.getContentText();
    if (c < 200 || c >= 300) throw new Error(metodo + ' ' + ruta + ' → HTTP ' + c + ': ' + t.slice(0, 300));
    return t ? JSON.parse(t) : {};
  };
  var base = VOZ_PUENTE_ + '?voz=1&k=' + encodeURIComponent(k);
  var existentes = (pedir('get', '/tools').tools || []), hechas = [];
  vozDefHerramientas_(base).forEach(function (def) {
    var ya = existentes.filter(function (t) { return t.tool_config && t.tool_config.name === def.name; })[0];
    var r = ya ? pedir('patch', '/tools/' + ya.id, { tool_config: def }) : pedir('post', '/tools', { tool_config: def });
    hechas.push({ name: def.name, id: (r && r.id) || ya.id, accion: ya ? 'actualizada' : 'creada' });
  });
  var ag = pedir('get', '/agents/' + encodeURIComponent(agente)), pr = ag.conversation_config.agent.prompt;
  var ids = (pr.tool_ids || []).slice();
  hechas.forEach(function (t) { if (ids.indexOf(t.id) < 0) ids.push(t.id); });
  pr.tool_ids = ids; delete pr.tools;
  pedir('patch', '/agents/' + encodeURIComponent(agente), { conversation_config: { agent: { prompt: pr } } });
  return vozEstado_({ herramientas: hechas });
}

/* Estado del agente tal como lo ve ElevenLabs (para comprobar que el prompt y las herramientas quedaron). */
function vozEstado_(extra) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(agente), { headers: { 'xi-api-key': key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'GET agente HTTP ' + r.getResponseCode() };
  var ag = JSON.parse(r.getContentText()), pr = ((ag.conversation_config || {}).agent || {}).prompt || {};
  var o = { ok: true, agente: ag.name, prompt_caracteres: String(pr.prompt || '').length, prompt_inicio: String(pr.prompt || '').slice(0, 80),
    tool_ids: pr.tool_ids || [], sistema: Object.keys(pr.built_in_tools || {}).filter(function (k) { return pr.built_in_tools[k]; }),
    llm: pr.llm, rama: ag.branch_id || ag.main_branch_id || '' };
  for (var x in (extra || {})) o[x] = extra[x];
  return o;
}


/* ═══ Respaldo del webhook: cada pocos minutos el Hub trae de ElevenLabs las llamadas terminadas que no le llegaron ═══ */
function vozMarcar_(id) {
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) {}
  try {
    var p = PropertiesService.getScriptProperties(), l = []; try { l = JSON.parse(p.getProperty('VOZ_HECHAS') || '[]'); } catch (e) {}
    if (l.indexOf(id) >= 0) return false;
    l.push(id); p.setProperty('VOZ_HECHAS', JSON.stringify(l.slice(-300))); return true;
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function vozRecoger_(forzar) {
  var c = CacheService.getScriptCache(); if (!forzar && c.get('voz_recoger')) return { ok: true, omitido: true }; c.put('voz_recoger', '1', 240);
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var h = { 'xi-api-key': key }, api = 'https://api.elevenlabs.io/v1/convai/conversations';
  var r = UrlFetchApp.fetch(api + '?page_size=20&agent_id=' + encodeURIComponent(agente), { headers: h, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'lista HTTP ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200) };
  var hechas = []; try { hechas = JSON.parse(p.getProperty('VOZ_HECHAS') || '[]'); } catch (e) {}
  var desde = Date.now() / 1000 - 3 * 86400, nuevas = [], vistas = 0;
  (JSON.parse(r.getContentText()).conversations || []).forEach(function (cv) {
    vistas++;
    if (hechas.indexOf(cv.conversation_id) >= 0 || !/done|failed/i.test(String(cv.status)) || Number(cv.start_time_unix_secs || 0) < desde) return;
    var d = UrlFetchApp.fetch(api + '/' + encodeURIComponent(cv.conversation_id), { headers: h, muteHttpExceptions: true });
    if (d.getResponseCode() !== 200) return;
    var out = vozPostCall_({ type: 'post_call_transcription', data: JSON.parse(d.getContentText()) });
    if (!out.duplicado) nuevas.push(cv.conversation_id);
  });
  if (nuevas.length) vozTraza_('recoger', {}, { ok: true, found: nuevas.length });
  return { ok: true, vistas: vistas, nuevas: nuevas.length };
}

/* Turnos de conversación (que Alma no interrumpa). Robot: { action:'voz_turnos', eagerness:'patient'|'normal'|'eager' }. */
function vozTurnos_(eag) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var url = 'https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(agente), h = { 'xi-api-key': key };
  var ag = JSON.parse(UrlFetchApp.fetch(url, { headers: h }).getContentText()), cc = ag.conversation_config || {};
  var antes = { turn: cc.turn || {}, interrupcion: ((cc.conversation || {}).client_events || []).indexOf('interruption') >= 0 };
  if (!eag) return { ok: true, antes: antes };
  var turn = Object.assign({}, cc.turn || {}, { turn_eagerness: String(eag) });
  var r = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true, payload: JSON.stringify({ conversation_config: { turn: turn } }) });
  if (r.getResponseCode() >= 300) return { ok: false, error: 'PATCH HTTP ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300), antes: antes };
  var ag2 = JSON.parse(UrlFetchApp.fetch(url, { headers: h }).getContentText());
  return { ok: true, antes: antes, despues: (ag2.conversation_config || {}).turn || {} };
}

/* ═══ Al empezar la llamada (webhook de inicio de ElevenLabs): el Hub identifica el número ANTES de que Alma hable ═══
   Devuelve la variable {{quien_llama}} y, si sabe quién es, un saludo con su nombre. */
var VOZ_DESCONOCIDO_ = 'Número no identificado: puede ser un huésped. Valida la reserva como indican las anotaciones.';
function vozInicio_(b) {
  var tel = b.caller_id || b.from || b.from_number || '';
  var r = {}; try { r = vozLookup_({ caller_id: tel }); } catch (e) { r = {}; }
  var tipo = r.caller_type || 'externo', ficha = VOZ_DESCONOCIDO_, saludo = '';
  var nom = function (n) { return String(n || '').trim().split(/\s+/)[0]; };
  if (tipo === 'juan' || tipo === 'equipo') {
    ficha = 'Es ' + (r.caller_name || 'alguien') + ', del equipo de Spacio AM. No es huésped: no le pidas reserva ni datos para validarle. Ayúdale directo con lo operativo.';
    saludo = '¡Hola' + (r.caller_name ? ' ' + r.caller_name : '') + '! Te saluda Alma… ¿En qué te ayudo?';
  } else if (tipo === 'registro') {
    ficha = 'Es un número de registros (edificio o contacto que solo comparte información de registros). Trátalo como indica QUIÉN LLAMA para caller_type = registro.';
  } else if (tipo === 'propietario') {
    ficha = 'Es un socio o propietario de Spacio AM. Trátalo como indica QUIÉN LLAMA para caller_type = propietario.';
  } else if (r.verified && r.code) {
    ficha = 'Huésped con reserva YA VALIDADA por su número (no le pidas nombre, apellido ni fecha): ' + r.guest_name + '. Propiedad: ' + r.property + '. Entrada ' + r.check_in + ', salida ' + r.check_out + '. Hoy ' + r.today + ' (' + r.stay + '). Registro de llegada: ' + r.form_status + '. code = ' + r.code + ' (úsalo en property_info).';
    saludo = '¡Hola' + (nom(r.guest_name) ? ' ' + nom(r.guest_name) : '') + '! Te saluda Alma, de Spacio A eme… Cuéntame, ¿en qué te ayudo?';
  }
  /* Contexto reciente: si el administrador habló con Alma en la última hora (cualquier canal, o una llamada que se cortó),
     Alma no se vuelve a presentar: ofrece retomar y ya sabe de qué venían hablando. b.saliente: la llamada la hace Alma. */
  if ((tipo === 'juan' || tipo === 'equipo') && !b.saliente) {
    try {
      var admI = adminPorTel_(tel) || (tipo === 'juan' ? adminsOp_().filter(function (a) { return a.principal; })[0] : null);
      var cr = admI ? contextoReciente_(admI) : null;
      if (cr) { ficha += '\n\n' + cr.bloque; saludo = cr.saludo(nom(r.caller_name || admI.nombre)); }
    } catch (e) { console.error('contextoReciente_: ' + e); }
  }
  try { var encI = encargoAbierto_(tel); if (encI) { ficha += '\n\nENCARGO PENDIENTE PARA ESTA LLAMADA: ' + encargoInstruccion_(encI); saludo = '¡Hola' + (r.caller_name ? ' ' + r.caller_name : '') + '! Te saluda Alma, de Spacio A eme… Gracias por llamar.'; } } catch (e) {}
  var out = { type: 'conversation_initiation_client_data', dynamic_variables: { quien_llama: ficha }, _tipo: tipo };
  if (saludo) out.conversation_config_override = { agent: { first_message: saludo } };
  return out;
}

/* Robot voz_inicio: conecta el webhook de inicio al agente, permite cambiar el saludo y crea la variable quien_llama. */
function vozConfigInicio_(k) {
  if (!k || Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(k), Utilities.Charset.UTF_8)
        .map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('') !== VOZ_HASH_) return { ok: false, error: 'llave de voz' };
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  var url = 'https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(agente), h = { 'xi-api-key': key };
  var ag = JSON.parse(UrlFetchApp.fetch(url, { headers: h }).getContentText());
  var cc = ag.conversation_config || {}, a = cc.agent || {}, dv = a.dynamic_variables || {}, ph = Object.assign({}, dv.dynamic_variable_placeholders || {}, { quien_llama: VOZ_DESCONOCIDO_ });
  var ps = ag.platform_settings || {}, ov = JSON.parse(JSON.stringify(ps.overrides || {})), wo = JSON.parse(JSON.stringify(ps.workspace_overrides || {}));
  ov.enable_conversation_initiation_client_data_from_webhook = true;
  ov.conversation_config_override = ov.conversation_config_override || {}; ov.conversation_config_override.agent = ov.conversation_config_override.agent || {};
  ov.conversation_config_override.agent.first_message = true;
  wo.conversation_initiation_client_data_webhook = { url: VOZ_PUENTE_ + '?voz=1&k=' + encodeURIComponent(k) + '&h=inicio', request_headers: {} };
  var r = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true, payload: JSON.stringify({
    conversation_config: { agent: { dynamic_variables: { dynamic_variable_placeholders: ph } } },
    platform_settings: { overrides: ov, workspace_overrides: wo } }) });
  if (r.getResponseCode() >= 300) return { ok: false, error: 'PATCH HTTP ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 400) };
  var ag2 = JSON.parse(UrlFetchApp.fetch(url, { headers: h }).getContentText()), ps2 = ag2.platform_settings || {};
  var listo = !!((ps2.workspace_overrides || {}).conversation_initiation_client_data_webhook || {}).url &&
    !!(((ag2.conversation_config || {}).agent || {}).dynamic_variables || {}).dynamic_variable_placeholders.quien_llama;
  if (listo) { p.setProperty('VOZ_INICIO_OK', '1'); try { CacheService.getScriptCache().remove('voz_sync_ok'); } catch (e) {} var sy = vozSyncPrompt_(true); }
  return { ok: listo, webhook: !!((ps2.workspace_overrides || {}).conversation_initiation_client_data_webhook || {}).url,
    fetch: (ps2.overrides || {}).enable_conversation_initiation_client_data_from_webhook,
    saludo: (((ps2.overrides || {}).conversation_config_override || {}).agent || {}).first_message, sync: sy || null };
}

/* Robot voz_inicio_off: desconecta el webhook de inicio (las llamadas vuelven a contestar sin consultar al Hub). */
function vozInicioOff_() {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  var url = 'https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(agente), h = { 'xi-api-key': key };
  var ag = JSON.parse(UrlFetchApp.fetch(url, { headers: h }).getContentText()), ov = JSON.parse(JSON.stringify((ag.platform_settings || {}).overrides || {}));
  ov.enable_conversation_initiation_client_data_from_webhook = false;
  p.deleteProperty('VOZ_INICIO_OK');
  var r = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true, payload: JSON.stringify({ platform_settings: { overrides: ov } }) });
  var sy = r.getResponseCode() < 300 ? vozSyncPrompt_(true) : null;
  return { ok: r.getResponseCode() < 300, http: r.getResponseCode(), sync: sy };
}
/* Robot voz_conv: últimas conversaciones del agente con su estado y motivo de cierre (diagnóstico, sin transcripciones). */
function vozConv_(n) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID'), h = { 'xi-api-key': key };
  var api = 'https://api.elevenlabs.io/v1/convai/conversations';
  var l = JSON.parse(UrlFetchApp.fetch(api + '?page_size=' + (n || 5) + '&agent_id=' + encodeURIComponent(agente), { headers: h }).getContentText()).conversations || [];
  return { ok: true, conv: l.map(function (c) {
    var d = {}; try { d = JSON.parse(UrlFetchApp.fetch(api + '/' + c.conversation_id, { headers: h, muteHttpExceptions: true }).getContentText()); } catch (e) {}
    var md = d.metadata || {};
    return { id: c.conversation_id, status: c.status, inicio: new Date(Number(c.start_time_unix_secs || 0) * 1000).toISOString(), dur: md.call_duration_secs,
      fin: md.termination_reason, error: md.error, turnos: (d.transcript || []).length, init: JSON.stringify(md.conversation_initiation_source || md.initiation_webhook || '').slice(0, 200),
      extra: JSON.stringify(Object.keys(md)) };
  }) };
}

/* Código de reserva cuyo registro de llegada (hola, pestaña Formularios / LT_Huespedes) tiene este teléfono. El más reciente gana. */
function vozCodigoPorTelHola_(tel) {
  var k = fin8_(tel); if (!k) return '';
  var c = CacheService.getScriptCache(), ck = 'vozhola_' + k, c0 = c.get(ck); if (c0 != null) return c0;
  var cod = '', ss = ssWebapp_();
  [['Formularios', /phone|emergency|telefono/i, 'code'], ['LT_Huespedes', /telefono|phone/i, 'codigo_lt']].forEach(function (d) {
    if (cod) return;
    var sh = ss.getSheetByName(d[0]); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getDataRange().getDisplayValues(), cab = v[0].map(function (x) { return String(x).trim(); });
    var cc = cab.indexOf(d[2]), ct = cab.map(function (x, i) { return d[1].test(x) ? i : -1; }).filter(function (i) { return i >= 0; });
    if (cc < 0 || !ct.length) return;
    for (var i = v.length - 1; i >= 1 && !cod; i--) if (ct.some(function (j) { return telsDe_(v[i][j]).some(function (t) { return fin8_(t) === k; }); })) cod = String(v[i][cc]).trim().toUpperCase();
  });
  c.put(ck, cod, 900);
  return cod;
}

/* Robot voz_transcript: transcripción de una conversación (o la última), con llamadas y resultados de herramientas. */
function vozTranscript_(id) {
  var p = PropertiesService.getScriptProperties(), h = { 'xi-api-key': p.getProperty('ELEVENLABS_KEY') }, api = 'https://api.elevenlabs.io/v1/convai/conversations';
  if (!id) id = (JSON.parse(UrlFetchApp.fetch(api + '?page_size=1&agent_id=' + encodeURIComponent(p.getProperty('ELEVENLABS_AGENT_ID')), { headers: h }).getContentText()).conversations || [{}])[0].conversation_id;
  var d = JSON.parse(UrlFetchApp.fetch(api + '/' + encodeURIComponent(id), { headers: h }).getContentText());
  return { ok: true, id: id, turnos: (d.transcript || []).map(function (t) {
    return { r: t.role, s: t.time_in_call_secs, m: t.message || '',
      tools: (t.tool_calls || []).map(function (c) { return c.tool_name + ' ' + String(c.params_as_json || '').slice(0, 200); }),
      res: (t.tool_results || []).map(function (c) { return c.tool_name + ' → ' + String(c.result_value || '').slice(0, 300); }) };
  }) };
}

/* La secretaria por voz: el administrador pide algo en la llamada y ALMA lo ejecuta con las mismas herramientas del chat operativo.
   Queda registrado en su chat operativo (canal llamada). */
function vozSecretaria_(b) {
  var tel = normTel_(b.caller_id || b.system__caller_id || ''), adm = tel ? adminPorTel_(tel) : null;
  if (!adm) return { ok: false, error: b.conv_id && !tel ? 'NO SE HIZO NADA: no pude confirmar la identidad del administrador en esta llamada. Díselo tal cual y pídele que cuelgue y vuelva a abrir la llamada (o que lo pida por WhatsApp).' : 'NO SE HIZO NADA: esta función es solo para administradores de Spacio AM. Ofrece dejarlo anotado para el equipo.' };
  var pedido = String(b.pedido || '').trim(); if (!pedido) return { ok: false, error: 'Falta el pedido.' };
  if (String(b.modo || '').toLowerCase() === 'segundo_plano') return vozSecEncolar_(tel, pedido);
  var t0 = Date.now(), previos = opFilas_(adm.email, 20);
  opGuardar_(adm, 'yo', 'llamada', pedido);
  var r = opAgente_(adm, pedido, 'llamada', [], previos);
  opGuardar_(adm, 'alma', 'llamada', r.respuesta, r.hechas);
  /* Si tardó tanto que la llamada ya dejó de esperar (ElevenLabs corta a los 60 s), el resultado también va por WhatsApp. */
  if (Date.now() - t0 > 50000) { try { vozSecAvisar_(tel, adm, r); } catch (e) { console.error('vozSecAvisar_: ' + e); } }
  return { ok: true, resultado: r.respuesta, acciones: r.hechas.map(function (h) { return (h.resumen || h.tipo) + (h.error ? ' (falló: ' + h.error + ')' : ' (hecho)'); }) };
}

/* Segundo plano: la llamada no espera. El pedido queda en cola, se ejecuta en unos segundos con la misma secretaria
   y el resultado le llega al administrador por WhatsApp. Cola en VOZ_SEC_COLA; se saca antes de ejecutar (nunca se repite). */
function vozSecEncolar_(tel, pedido) {
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var p = PropertiesService.getScriptProperties(), cola = []; try { cola = JSON.parse(p.getProperty('VOZ_SEC_COLA') || '[]'); } catch (e) {}
    cola.push({ tel: tel, pedido: String(pedido).slice(0, 3000), t: Date.now() });
    p.setProperty('VOZ_SEC_COLA', JSON.stringify(cola.slice(-20)));
  } finally { lock.releaseLock(); }
  /* Espera breve: si en la misma llamada piden algo más (p. ej. «revisa también la imagen»), todo se hace junto en un solo WhatsApp. */
  try {
    ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'vozSecretariaPronto'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('vozSecretariaPronto').timeBased().after(45000).create();
  } catch (e) { console.error('trigger vozSecretariaPronto: ' + e); }
  return { ok: true, en_proceso: true, resultado: 'Recibido. Lo hago en segundo plano y le confirmo por WhatsApp a este mismo número en cuanto esté listo. Ya puedes despedirte si no necesita nada más.' };
}
function vozSecretariaPronto() {
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'vozSecretariaPronto'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  vozSecProcesar_();
}
function vozSecProcesar_() {
  var p = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock();
  for (var n = 0; n < 3; n++) {
    var grupo = [];
    if (!lock.tryLock(5000)) return;
    try {
      var cola = []; try { cola = JSON.parse(p.getProperty('VOZ_SEC_COLA') || '[]'); } catch (e) {}
      if (!cola.length) return;
      var tel = cola[0].tel, suyos = cola.filter(function (x) { return x.tel === tel; });
      /* Si el último pedido de esa persona es muy reciente, puede seguir en la llamada: se espera a la próxima pasada. */
      if (Date.now() - Math.max.apply(null, suyos.map(function (x) { return x.t; })) < 40000) return;
      grupo = suyos;
      p.setProperty('VOZ_SEC_COLA', JSON.stringify(cola.filter(function (x) { return x.tel !== tel; })));
    } finally { lock.releaseLock(); }
    var adm = adminPorTel_(grupo[0].tel); if (!adm) continue;
    var pedido = grupo.length === 1 ? grupo[0].pedido : 'Me pediste varias cosas en la misma llamada; resuélvelas juntas y respóndeme en un solo mensaje:\n' + grupo.map(function (x, i) { return (i + 1) + ') ' + x.pedido; }).join('\n');
    var r;
    try {
      var previos = opFilas_(adm.email, 20);
      opGuardar_(adm, 'yo', 'llamada', pedido + ' (en segundo plano)');
      r = opAgente_(adm, pedido, 'segundo_plano', [], previos);
      opGuardar_(adm, 'alma', 'llamada', r.respuesta, r.hechas);
    } catch (e) { r = { respuesta: 'No pude terminar lo que me pediste en la llamada: ' + String(e).slice(0, 150) + '. ¿Lo intentamos por aquí?', hechas: [] }; }
    try { vozSecAvisar_(grupo[0].tel, adm, r); } catch (e) { console.error('vozSecAvisar_: ' + e); }
  }
}
function vozSecAvisar_(tel, adm, r) {
  var malas = (r.hechas || []).filter(function (h) { return h.error; });
  var txt = String(r.respuesta || 'Listo.').trim() + (malas.length ? '\n\nOjo, esto no salió: ' + malas.map(function (h) { return (h.resumen || h.tipo) + ' (' + h.error + ')'; }).join('; ') : '');
  var w = waEnviarAlguien_(tel, 'Sobre lo que me pediste en la llamada:\n\n' + txt, { nombre: adm.nombre });
  if (!w.ok) console.error('vozSecAvisar_ WhatsApp: ' + w.error);
}

/* ═══ LLAMADAS SALIENTES POR WHATSAPP ═══════════════════════════════════════════════════════════
   WhatsApp exige que la persona acepte recibir llamadas de la empresa (call_permission_request). Flujo:
   vozLlamar_(tel, motivo): si hay permiso → ElevenLabs llama por el SIP trunk de WhatsApp con la ficha y el encargo
   cargados; si no → se envía la solicitud de permiso y la llamada queda pendiente (VOZ_PEND_<tel>) hasta que acepte
   (el webhook de WhatsApp avisa con call_permission_reply y se llama sola).
   Propiedad: ELEVENLABS_PHONE_ID (id del número «WhatsApp ALMA» en ElevenLabs; si falta se busca solo). */
function vozGraph_(metodo, ruta, cuerpo) {
  var W = waCfg_(), o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } };
  if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + ruta, o), j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  return { code: r.getResponseCode(), j: j, txt: r.getContentText().slice(0, 500) };
}
function vozPermiso_(tel) {
  var W = waCfg_(), r = vozGraph_('get', W.phoneId + '/call_permissions?user_wa_id=' + normTel_(tel));
  var p = (r.j && r.j.permission) || {}, acc = (r.j && r.j.actions) || [];
  var puede = acc.some(function (a) { return a.action_name === 'start_call' && a.can_perform_action; });
  return { ok: r.code < 300, estado: p.status || '', puede_llamar: puede, detalle: r.code < 300 ? '' : r.txt };
}
function vozPedirPermiso_(tel, texto) {
  var W = waCfg_();
  var r = vozGraph_('post', W.phoneId + '/messages', { messaging_product: 'whatsapp', recipient_type: 'individual', to: normTel_(tel), type: 'interactive',
    interactive: { type: 'call_permission_request', action: { name: 'call_permission_request' }, body: { text: String(texto || 'Hola, soy Alma, la asistente virtual de Spacio AM. ¿Me permites llamarte por WhatsApp?').slice(0, 1024) } } });
  return { ok: r.code < 300, detalle: r.code < 300 ? '' : r.txt };
}
function vozPhoneId_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('ELEVENLABS_PHONE_ID'); if (id) return id;
  var r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', { headers: { 'xi-api-key': p.getProperty('ELEVENLABS_KEY') }, muteHttpExceptions: true });
  var l = []; try { l = JSON.parse(r.getContentText()); } catch (e) {}
  l = Array.isArray(l) ? l : (l.phone_numbers || []);
  var hit = l.filter(function (x) { return /50231280966|whatsapp/i.test(String(x.phone_number || '') + ' ' + String(x.label || '')); })[0];
  if (hit) { id = hit.phone_number_id || hit.id; p.setProperty('ELEVENLABS_PHONE_ID', id); }
  return id || '';
}
function vozLlamar_(tel, motivo) {
  tel = normTel_(tel); if (!tel) return { ok: false, error: 'número inválido' };
  var perm = vozPermiso_(tel);
  if (!perm.puede_llamar) {
    PropertiesService.getScriptProperties().setProperty('VOZ_PEND_' + fin8_(tel), JSON.stringify({ tel: tel, motivo: motivo || '', t: Date.now() }));
    var pp = vozPedirPermiso_(tel);
    return { ok: false, pendiente: true, permiso: perm.estado || 'sin permiso', solicitud_enviada: pp.ok, detalle: pp.detalle || perm.detalle };
  }
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID'), phone = vozPhoneId_();
  if (!phone) return { ok: false, error: 'No encontré el número de WhatsApp en ElevenLabs (ELEVENLABS_PHONE_ID).' };
  var ini = {}; try { ini = vozInicio_({ caller_id: tel, saliente: true }); delete ini._tipo; } catch (e) {}
  if (motivo) { ini.dynamic_variables = ini.dynamic_variables || {}; ini.dynamic_variables.quien_llama = (ini.dynamic_variables.quien_llama || '') + '\n\nESTA LLAMADA LA HACES TÚ (saliente). Motivo: ' + motivo; }
  var r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key },
    payload: JSON.stringify({ agent_id: agente, agent_phone_number_id: phone, to_number: '+' + tel, conversation_initiation_client_data: ini }) });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  p.deleteProperty('VOZ_PEND_' + fin8_(tel));
  vozTraza_('saliente', { caller_id: tel }, { ok: r.getResponseCode() < 300 && j.success !== false, error: r.getResponseCode() < 300 ? '' : r.getContentText().slice(0, 120) });
  return r.getResponseCode() < 300 && j.success !== false ? { ok: true, conversation_id: j.conversation_id || '', sip_call_id: j.sip_call_id || '' } : { ok: false, error: 'ElevenLabs HTTP ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300) };
}
/* Webhook de WhatsApp: la persona respondió a la solicitud de permiso. Si aceptó y había llamada pendiente, se llama. */
function vozPermisoRespuesta_(m) {
  var i = m.interactive || {}, rep = i.call_permission_reply || {}, tel = normTel_(m.from);
  vozTraza_('permiso', { caller_id: tel }, { ok: rep.response === 'accept', error: rep.response || '' });
  if (rep.response !== 'accept') return;
  var p = PropertiesService.getScriptProperties(), pend = p.getProperty('VOZ_PEND_' + fin8_(tel)); if (!pend) return;
  var o = {}; try { o = JSON.parse(pend); } catch (e) {}
  if (Date.now() - Number(o.t || 0) > 24 * 3600000) { p.deleteProperty('VOZ_PEND_' + fin8_(tel)); return; }
  Utilities.sleep(4000);
  vozLlamar_(tel, o.motivo || '');
}

/* Una vez: las llamadas de prueba que quedaron como conversaciones sueltas (llamada:<id>) pasan a la conversación de WhatsApp
   del administrador principal, y se quitan de la bandeja las filas sueltas. */
function vozUnirPruebas_() {
  var ppal = adminsOp_().filter(function (a) { return a.principal; })[0];
  var tel = ppal && ppal.tels && ppal.tels[0] ? normTel_(ppal.tels[0]) : ''; if (!tel) return { ok: false, error: 'sin número del administrador principal' };
  var sh = hojaWA_(), n = sh.getLastRow(), movidas = 0;
  if (n >= 2) {
    var v = sh.getRange(2, 1, n - 1, 7).getValues();
    v.forEach(function (r, i) { if (/^llamada:/.test(String(r[6]))) { r[1] = tel; r[6] = 'wa:' + tel; movidas++; } });
    if (movidas) sh.getRange(2, 1, n - 1, 7).setValues(v);
  }
  var shI = hojaInbox_(), nI = shI.getLastRow(), borradas = 0;
  if (nI >= 2) {
    var ids = shI.getRange(2, 1, nI - 1, 1).getValues();
    for (var k = ids.length - 1; k >= 0; k--) if (/^llamada:/.test(String(ids[k][0]))) { shI.deleteRow(k + 2); borradas++; }
  }
  try { CacheService.getScriptCache().removeAll(['inbox', 'hub_inbox']); } catch (e) {}
  return { ok: true, mensajes_movidos: movidas, conversaciones_quitadas: borradas };
}


/* ═══ Alma por voz dentro de las apps (botón del menú compartido) ═══════════════════════════════
   El Hub pide una URL firmada de ElevenLabs para el administrador con sesión iniciada. La llamada web no
   trae número: queda ligada a ese administrador por su conversation_id (lo envía el Hub al conectar) y,
   mientras eso llega, por un aviso de 90 s. Así las herramientas lo reconocen igual que por teléfono. */
function vozWebAdmin_(ses) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (!ses) { var ppal = adminsOp_().filter(function (a) { return a.principal; })[0]; if (ppal) adm = ppal; }   // llave antigua del Hub: solo administradores
  return adm && adm.tels && adm.tels.length ? adm : null;
}
/* Quita las notas de actuación del modelo de voz ([warm], [softly]…) de lo que se guarda o se muestra. */
function vozSinNotas_(t) { return String(t || '').replace(/\[[^\]\n]{1,40}\]/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?…])/g, '$1').trim(); }
/* Ficha para la llamada desde la app: quién es, cómo tratarlo y lo último que habló con Alma por WhatsApp o el Hub,
   para que la voz sea la misma Alma que ya lo conoce y no la del protocolo de huéspedes. */
function vozWebFicha_(adm, nom) {
  var t = 'LLAMADA DESDE LA APP DEL HUB DE SPACIO AM. Quien habla es ' + (adm.nombre || nom) + (adm.principal ? ', el administrador principal (caller_type juan)' : ', administrador del equipo') +
    '. Ya está identificado por su sesión: NO es huésped, aunque lookup_reservation no reconozca un número. Nunca le pidas reserva, nombre ni fecha y nunca uses con él los patrones de huésped («el equipo te escribirá», «te confirmamos por aquí mismo»).' +
    ' Háblale como su compañera de trabajo de confianza: por su nombre, con energía, directa, cálida y resolutiva, en frases cortas. Para todo lo operativo (reservas, huéspedes, equipo, rutas, códigos, tareas, propiedades) usa la herramienta secretaria con su pedido completo.';
  if (contextoReciente_(adm)) return t;   // vozInicio_ ya agrega el contexto reciente (última hora, todos los canales)
  try {
    var corte = Date.now() - 24 * 3600000;
    var ult = opFilas_(adm.email, 12).filter(function (m) { return new Date(m.ts).getTime() >= corte && String(m.texto || '').trim(); }).slice(-6);
    if (ult.length) t += '\nLO ÚLTIMO QUE HABLARON (WhatsApp / Hub):\n' + ult.map(function (m) { return (m.de === 'yo' ? nom : 'Alma') + ': ' + String(m.texto).replace(/\s+/g, ' ').slice(0, 220); }).join('\n');
  } catch (e) {}
  return t;
}
function vozWebInicio_(ses, ligero) {
  var adm = vozWebAdmin_(ses);
  if (!adm) return { ok: false, error: 'Tu usuario no tiene un teléfono registrado como administrador.' };
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var tel = normTel_(adm.tels[0]), ini = {};
  try { ini = vozInicio_({ caller_id: tel }); } catch (e) {}
  var nom = String(adm.nombre || '').trim().split(/\s+/)[0];
  var dv = Object.assign({}, ini.dynamic_variables || {});
  dv.quien_llama = vozWebFicha_(adm, nom) + '\n\n' + (dv.quien_llama || '');
  dv.sa_web = vozWebToken_(tel);   /* firma del Hub: identifica la llamada aunque la vinculación llegue tarde */
  var retoma = contextoReciente_(adm);
  var out = { ok: true, agent_id: agente, dynamic_variables: dv, nombre: nom, first_message: retoma ? retoma.saludo(nom) : '¡Hola, ' + nom + '! Aquí estoy. ¿Qué hacemos?' };
  /* Mientras el navegador conecta, la primera herramienta de la llamada (lookup_reservation) ya sabe que es él:
     sin esto podía llegar antes que vozWebVincular y Alma lo trataba como huésped. */
  CacheService.getScriptCache().put('vozweb_pend', tel, 120);
  /* ligero: el navegador se conecta directo con agent_id (el agente es público) y guarda esta ficha; sin URL firmada. */
  if (ligero) return out;
  var r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=' + encodeURIComponent(agente), { headers: { 'xi-api-key': key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'ElevenLabs ' + r.getResponseCode() };
  var j = JSON.parse(r.getContentText() || '{}'); if (!j.signed_url) return { ok: false, error: 'sin URL firmada' };
  CacheService.getScriptCache().put('vozweb_pend', tel, 90);
  out.signed_url = j.signed_url;
  return out;
}
function vozWebVincular_(ses, convId) {
  var adm = vozWebAdmin_(ses); convId = String(convId || '').trim();
  if (!adm || !convId) return { ok: false };
  CacheService.getScriptCache().put('vozweb_' + convId, normTel_(adm.tels[0]), 21600);
  return { ok: true };
}
function vozWebTel_(convId) { convId = String(convId || '').trim(); return convId ? (CacheService.getScriptCache().get('vozweb_' + convId) || '') : ''; }
function vozWebIdentificar_(b) {
  if (normTel_(b.caller_id || b.system__caller_id || '')) return;
  var conv = String(b.conv_id || '').trim(); if (!conv) return;
  var c = CacheService.getScriptCache(), tel = c.get('vozweb_' + conv);
  /* Sin vínculo todavía: la propia llamada trae la ficha firmada por el Hub (variable sa_web al conectar). Se lee de
     ElevenLabs y se verifica la firma: no depende de que vozWebVincular llegue a tiempo ni de una marca global. */
  var otro = false;
  if (!tel) { try { var inf = vozWebConvInfo_(conv); tel = inf.tel; otro = inf.otro; } catch (e) { console.error('vozWebConvInfo_: ' + e); } if (tel) c.put('vozweb_' + conv, tel, 21600); }
  /* El aviso «pendiente» es solo para el botón de voz del Hub: una llamada de otro agente (Alma · Familia) se identifica
     únicamente por su firma, así nadie más de la familia puede quedar como administrador. */
  if (!tel && !otro) { tel = c.get('vozweb_pend'); if (tel) { c.put('vozweb_' + conv, tel, 21600); c.remove('vozweb_pend'); } }
  if (tel) b.caller_id = tel;
}
function vozWebSecreto_() {
  var p = PropertiesService.getScriptProperties(), k = p.getProperty('VOZ_WEB_SECRETO');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('VOZ_WEB_SECRETO', k); }
  return k;
}
function vozWebFirma_(txt) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(txt), vozWebSecreto_())).replace(/=+$/, '');
}
function vozWebToken_(tel) { var exp = Date.now() + 36 * 3600000, base = normTel_(tel) + '.' + exp; return base + '.' + vozWebFirma_(base); }
function vozWebTokenTel_(tok) {
  var p = String(tok || '').split('.'); if (p.length !== 3) return '';
  var base = p[0] + '.' + p[1]; if (+p[1] < Date.now() || vozWebFirma_(base) !== p[2]) return '';
  return p[0];
}
function vozWebTelDeConv_(conv) { return vozWebConvInfo_(conv).tel; }
function vozWebConvInfo_(conv) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'); if (!key || !/^conv_/.test(conv)) return { tel: '', otro: false };
  var r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/convai/conversations/' + encodeURIComponent(conv), { headers: { 'xi-api-key': key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { tel: '', otro: false };
  var j = JSON.parse(r.getContentText() || '{}'), dv = ((j.conversation_initiation_client_data || {}).dynamic_variables) || {};
  var mio = p.getProperty('ELEVENLABS_AGENT_ID');
  return { tel: vozWebTokenTel_(dv.sa_web), otro: !!(j.agent_id && mio && j.agent_id !== mio) };
}

/* ═══ CONTEXTO RECIENTE ════════════════════════════════════════════════════════════════════════════════════
   Todo lo que un administrador habla con Alma (Hub, WhatsApp y llamadas) vive en un solo chat: ALMA_OPERATIVO.
   La última hora de ese chat es el «contexto reciente»: si la llamada se corta y vuelve a llamar, Alma saluda por su
   nombre y ofrece retomar («¿Retomamos lo de …?») en lugar de presentarse otra vez. CTX_RECIENTE_MIN (propiedad) cambia
   la ventana; por defecto 60 minutos. */
function ctxRecienteMin_() { var n = Number(PropertiesService.getScriptProperties().getProperty('CTX_RECIENTE_MIN')); return n >= 5 && n <= 720 ? n : 60; }
function contextoReciente_(adm) {
  if (!adm || !adm.email) return null;
  var corte = Date.now() - ctxRecienteMin_() * 60000, nom = String(adm.nombre || '').trim().split(/\s+/)[0] || 'Él';
  var filas = opFilas_(adm.email, 120).filter(function (m) { return new Date(m.ts).getTime() >= corte && String(m.texto || '').trim(); }).slice(-40);
  if (!filas.length) return null;
  var CAN = { whatsapp: 'WhatsApp', hub: 'Hub', llamada: 'llamada' };
  var lineas = filas.map(function (m) { return '[' + (CAN[m.canal] || m.canal) + ' · ' + Utilities.formatDate(new Date(m.ts), CFG.TZ, 'HH:mm') + '] ' + (m.de === 'yo' ? nom : 'Alma') + ': ' + String(m.texto).replace(/\s+/g, ' ').slice(0, 320); });
  var tema = ctxTema_(adm, filas, lineas);
  var ult = filas[filas.length - 1], hace = Math.max(1, Math.round((Date.now() - new Date(ult.ts).getTime()) / 60000));
  return {
    tema: tema, minutos: hace,
    bloque: 'CONTEXTO RECIENTE (su última hora con Alma, por cualquier canal; lo último fue hace ' + hace + ' min' + (ult.canal === 'llamada' ? ', en una llamada que terminó o se cortó' : '') + '):\n' + lineas.join('\n') +
      '\nESTÁ VOLVIENDO A HABLAR CONTIGO: no te presentes otra vez («te saluda Alma»). Ya le ofreciste retomar en el saludo. Si quiere retomar, sigue exactamente donde quedaron, sin repetir lo que ya se dijo ni volver a preguntar lo que ya respondió. Si quiere otra cosa, cámbiate de tema sin más.',
    saludo: function (n) { n = n || nom; return '¡Hola, ' + n + '! ' + (tema ? '¿Retomamos lo ' + (/^el\s/i.test(tema) ? 'del ' + tema.slice(3) : 'de ' + tema) + ', o hablamos de otra cosa?' : '¿Retomamos donde nos quedamos, o hablamos de otra cosa?'); }
  };
}
/* De qué venían hablando, en pocas palabras. Lo da el título de la llamada (ElevenLabs) o, si no, un resumen corto con
   el modelo rápido; se guarda en caché por último mensaje para que el saludo no espere. */
function ctxTema_(adm, filas, lineas) {
  var cache = CacheService.getScriptCache(), ult = filas[filas.length - 1], k = 'ctxtema_' + Utilities.base64EncodeWebSafe(adm.email + '|' + ult.id).slice(0, 200);
  var c0 = cache.get(k); if (c0 != null) return c0;
  var t = '', titulo = '';
  try {
    var llam = filas.slice().reverse().filter(function (m) { return m.canal === 'llamada' && m.acciones && m.acciones[0] && m.acciones[0].tema; })[0];
    if (llam) titulo = String(llam.acciones[0].tema);
  } catch (e) {}
  try {
    t = String(claude_(CFG.MODELO_CLASIFICADOR, 30, 'Lees una conversación entre un administrador y su asistente Alma. Di de qué estaban hablando en 2 a 6 palabras, empezando con artículo, para completar la frase «¿Retomamos lo de …?». Sin punto final, sin comillas, en minúsculas salvo nombres propios. Ej.: la reserva de Marta en 1104 · el pago de la luz de Rue · la ruta de mañana de Kevin.',
      (titulo ? 'Título de la última llamada: ' + titulo + '\n\n' : '') + lineas.slice(-14).join('\n'), 0) || '').replace(/["«»“”.]/g, '').replace(/^lo de\s+/i, '').trim();
    if (t.length > 60 || /\n/.test(t)) t = '';
  } catch (e) { t = ''; }
  if (!t && titulo) t = titulo;
  try { cache.put(k, t, 3600); } catch (e) {}
  return t;
}
/* La llamada de un administrador queda en su chat: una línea de resumen y cada turno con su hora real. */
function opLlamadaGuardar_(adm, d, t0, dur, canal, motivo, resumen) {
  var sh = hojaOp_(), filas = [], mmss = Math.floor(dur / 60) + ':' + ('0' + (dur % 60)).slice(-2);
  var titulo = s_((d.analysis || {}).call_summary_title) || motivo || '';
  var id = function (i) { return 'opl' + s_(d.conversation_id).slice(-10) + '_' + i; };
  var tx = function (x) { x = String(x || '').slice(0, 4000); return /^[=+\-@]/.test(x) || /^\d[\d\s.]*$/.test(x) ? "'" + x : x; };
  (d.transcript || []).forEach(function (m, i) {
    var t = s_(m.message).trim(); if (m.role === 'agent') t = vozSinNotas_(t); if (!t) return;
    filas.push([new Date(t0 + Number(m.time_in_call_secs || 0) * 1000).toISOString(), adm.email, adm.nombre, m.role === 'agent' ? 'alma' : 'yo', 'llamada', tx(t), '', id(i + 1)]);
  });
  filas.push([new Date(t0 + dur * 1000).toISOString(), adm.email, adm.nombre, 'alma', 'llamada', tx('📞 Llamada por ' + canal + ' · ' + mmss + (titulo ? ' · ' + titulo : '') + (resumen ? '\n' + resumen : '')),
    JSON.stringify([{ tipo: 'llamada', resumen: titulo || 'Llamada', tema: titulo ? titulo.charAt(0).toLowerCase() + titulo.slice(1) : '' }]), id(0)]);
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
  try { SpreadsheetApp.flush(); contextoReciente_(adm); } catch (e) {}   // deja listo el tema: si vuelve a llamar enseguida, el saludo no espera
}
