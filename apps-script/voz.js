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
    if (herr === 'lookup_reservation') out = vozLookup_(body);
    else if (herr === 'property_info') out = vozPropertyInfo_(body);
    else if (herr === 'postcall') out = vozPostCall_(body);
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
    form_status: /complet/i.test(s_(r.status_form)) ? 'completo' : 'pendiente',
    stay: hoy < ci ? 'antes_del_checkin' : hoy > co ? 'despues_del_checkout' : 'estadia_activa' };
}

/* ── lookup_reservation ─────────────────────────────────────────────────────────────────── */
function vozLookup_(b) {
  var hoy = vozHoy_(), cache = CacheService.getScriptCache();
  var tel = normTel_(b.caller_id || b.system__caller_id || b.telefono || '');
  var kf = 'vozf_' + (fin8_(tel) || 'x');
  var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return !/cancel/i.test(s_(r.status)) && s_(r.code); });
  var porCodigo = {}; filas.forEach(function (r) { porCodigo[s_(r.code).toUpperCase()] = r; });

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
  var cand = filas.filter(function (r) {
    var full = vozNorm_(s_(r.guest_first_name) + ' ' + s_(r.guest_last_name));
    if (apellido && !tok(apellido).some(function (w) { return full.indexOf(w) >= 0; })) return false;
    if (nombre && !tok(nombre).some(function (w) { return full.indexOf(w) >= 0; })) return false;
    var rci = fecha_(r.checkin_date), rco = fecha_(r.checkout_date);
    if (ci && !(rci === ci || rci === sumarDias_(ci, -1) || rci === sumarDias_(ci, 1))) return false;
    if (!ci && co && rco !== co) return false;
    if (!ci && !co && !vozVigente_(rci, rco, hoy)) return false;   // sin fecha: solo reservas vigentes
    if (zona && vozPrefijo_(r.property_name).indexOf(vozPrefijo_(zona)) !== 0 && vozNorm_(r.property_name).indexOf(zona) < 0) return false;
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
  var tel = normTel_(pc.external_number || dv.system__caller_id || '');
  if (!convEL) return { ok: false, error: 'sin conversation_id' };
  var cache = CacheService.getScriptCache(); if (cache.get('vozpc_' + convEL)) return { ok: true, duplicado: true }; cache.put('vozpc_' + convEL, '1', 21600);
  var t0 = Number(md.start_time_unix_secs || 0) * 1000 || Date.now(), dur = Number(md.call_duration_secs || 0);
  var rel = null; try { rel = tel ? waReserva_(tel) : null; } catch (x) {}
  var convId = rel && rel.resId ? rel.resId : (tel ? 'wa:' + tel : 'llamada:' + convEL);
  var pre = {}; try { pre = rel && rel.resId ? (preContexto_(rel.resId) || {}) : {}; } catch (x) {}
  var resumen = s_((d.analysis || {}).transcript_summary) || s_((d.analysis || {}).call_summary_title);
  var mmss = Math.floor(dur / 60) + ':' + ('0' + (dur % 60)).slice(-2);
  var canal = /sip/i.test(s_(pc.type)) || s_(pc.agent_number).replace(/\D/g, '').slice(-8) === '31280966' ? 'WhatsApp' : 'teléfono';
  var sh = hojaWA_(), filas = [];
  filas.push([new Date(t0).toISOString(), tel, pre.huesped || '', 'in', '📞 Llamada por ' + canal + ' · ' + mmss + (resumen ? '\n' + resumen : ''), convEL + '#0', convId, 'llamada', 'sistema', '']);
  (d.transcript || []).forEach(function (m, i) {
    var txt = s_(m.message).trim(); if (!txt) return;
    var ts = new Date(t0 + Number(m.time_in_call_secs || 0) * 1000).toISOString();
    filas.push(m.role === 'agent' ? [ts, tel, 'ALMA voz', 'out', txt, convEL + '#' + (i + 1), convId, 'llamada', 'alma', '']
                                  : [ts, tel, pre.huesped || '', 'in', txt, convEL + '#' + (i + 1), convId, 'llamada', '', '']);
  });
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
  var fin = new Date(t0 + dur * 1000).toISOString();
  inboxUpsert_(convId, Object.assign({ huesped: pre.huesped || (tel ? '+' + tel : 'Llamada'), propiedad: pre.propiedad || 'Llamada · ' + canal, canal: pre.canal || 'whatsapp',
    ultimo_canal: 'whatsapp', ultimo_texto: '📞 Llamada · ' + (resumen || mmss).slice(0, 280), ultimo_de: 'host', ultimo_ts: fin, ultimo_host_ts: fin },
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
    l.unshift({ t: new Date().toISOString(), h: herr, tel: fin8_(b.caller_id || b.telefono || '').slice(-4), ok: !!(out && out.ok), found: out && out.found, verified: out && out.verified, ask: out && out.ask_next, metodo: out && out.metodo, err: out && (out.error || out.motivo) || '' });
    c.put('voz_traza', JSON.stringify(l.slice(0, 30)), 21600);
  } catch (x) {}
}

/* ═══ Un solo prompt vivo ═══════════════════════════════════════════════════════════════════
   El agente de voz usa EL MISMO system prompt de ALMA que se mejora desde el Hub (ALMA_INSTRUCCIONES),
   más la fila «VOZ» con las anotaciones propias de las llamadas (también editable en el Hub, grupo Llamadas).
   Cada 30 min, si cambió algo, el Hub lo copia al agente de ElevenLabs por API (no se edita allá).
   Propiedades del script: ELEVENLABS_KEY (API key con permiso de Agents) y ELEVENLABS_AGENT_ID.
   La fila base se detecta sola (la que contiene «IDENTIDAD CENTRAL»); VOZ_CLAVE_BASE la fija a mano. */
var SEMILLA_VOZ_ = [
  'ANOTACIONES PARA LLAMADAS (prevalecen sobre lo anterior cuando hablas por teléfono o por llamada de WhatsApp):',
  '· Estás en una llamada de voz. Todo se dice hablando: sin listas, sin viñetas, sin enlaces escritos ni negritas.',
  '· Antes de preguntar nombres, llama a lookup_reservation con caller_id = {{system__caller_id}}. Si devuelve verified = true, la reserva ya quedó validada por el número desde el que llama: no pidas nombre, apellido ni fecha; sigue con lo que necesitaba.',
  '· Si no se valida por el número, sigue el orden de la sección 9 (nombre → apellido → fecha de entrada → código), pasando siempre también caller_id.',
  '· property_info solo con el code de una reserva validada.',
  '· Los datos exactos (WiFi, direcciones, códigos de portería) se dictan con la sección 9.4. Los códigos de cerradura inteligente nunca se dicen: llegan por la plataforma.',
  '· Si no puedes resolver y es urgente, usa transfer_to_number según la sección 21. Si no es urgente, di que el equipo le escribe por WhatsApp a este mismo número.',
  '· La regla de números internos (sección 0) aplica igual en llamadas: con esos números no atiendes solicitudes.'
].join('\n');

function vozPromptCompleto_() {
  var filas = leerTabla_(CFG.TAB_INSTRUCCIONES), claveBase = PropertiesService.getScriptProperties().getProperty('VOZ_CLAVE_BASE');
  var fila = claveBase ? filas.filter(function (r) { return String(r.clave || '').trim().toUpperCase() === claveBase.toUpperCase(); })[0]
                       : filas.filter(function (r) { return /IDENTIDAD CENTRAL/.test(String(r.prompt || '')); })[0];
  var base = fila ? String(fila.prompt || '').trim() : '';
  if (!base) return { error: 'No encontré en ALMA_INSTRUCCIONES el prompt base (el que contiene «IDENTIDAD CENTRAL»). Pon su clave en la propiedad VOZ_CLAVE_BASE.' };
  var extra = sinCab_(prompt_('REGLAS_EXTRA')), voz = String(prompt_('VOZ') || '').trim();
  return { clave: String(fila.clave), texto: [base, extra ? 'AVISOS TEMPORALES:\n' + extra : '', voz].filter(Boolean).join('\n\n') };
}
function vozSyncSiToca_() {
  var c = CacheService.getScriptCache(); if (c.get('voz_sync_ok')) return;
  c.put('voz_sync_ok', '1', 1800);
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ELEVENLABS_KEY') || !p.getProperty('ELEVENLABS_AGENT_ID')) return;
  vozSyncPrompt_(false);
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
  var r = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true,
    payload: JSON.stringify({ conversation_config: { agent: { prompt: prompt } } }) });
  if (r.getResponseCode() < 200 || r.getResponseCode() >= 300) return guardar({ ok: false, error: 'PATCH agente HTTP ' + r.getResponseCode(), detalle: r.getContentText().slice(0, 200) });
  p.setProperty('VOZ_PROMPT_HUELLA', huella);
  return guardar({ ok: true, clave_base: pc.clave, caracteres: pc.texto.length });
}
