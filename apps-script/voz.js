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

/* Reemplaza una sola vez la primera versión de la fila VOZ (citaba secciones de otro prompt). */
var VOZ_SEMILLA_VIEJA_ = /sigue el orden de la sección 9 \(nombre/;

function vozInternos_() {
  var lista = String(PropertiesService.getScriptProperties().getProperty('VOZ_INTERNOS') || '').split(/[\s,;]+/).map(function (n) { return n.replace(/\D/g, ''); }).filter(Boolean);
  if (!lista.length) return '';
  return ['NÚMEROS INTERNOS (prioridad máxima, por encima de todo lo anterior)',
    'Si {{system__caller_id}} es exactamente uno de estos números: ' + lista.join(', ') + ', no atiendes solicitudes.',
    '· Si solo saluda, agradece o confirma algo, responde amable en una frase y no agregues nada.',
    '· Para cualquier otra cosa di exactamente: "Hola. Este número es solo para compartir información de registros y no está autorizado para resolver solicitudes. Para soporte, por favor comunícate con el grupo de Spacio AM en WhatsApp. ¡Gracias!"',
    'Si el número no está en la lista, ignora esta regla.'].join('\n');
}

function vozPromptCompleto_() {
  var voz = String(prompt_('VOZ') || '').trim();
  if (!voz || VOZ_SEMILLA_VIEJA_.test(voz)) { hubSetPrompt_('VOZ', SEMILLA_VOZ_, 'anotaciones de llamadas v2 (independientes de ElevenLabs)'); voz = SEMILLA_VOZ_; }
  var base = prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + mejorasBloque_('REDACTOR');
  if (!String(base).trim()) return { error: 'El prompt REDACTOR está vacío en ALMA_INSTRUCCIONES.' };
  var extra = sinCab_(prompt_('REGLAS_EXTRA'));
  return { clave: 'REDACTOR', texto: [vozInternos_(), base.trim(), extra ? 'AVISOS TEMPORALES:\n' + extra : '', voz].filter(Boolean).join('\n\n') };
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
  if (prompt.tool_ids && prompt.tool_ids.length) delete prompt.tools;   // la API no acepta los dos a la vez
  var r = UrlFetchApp.fetch(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true,
    payload: JSON.stringify({ conversation_config: { agent: { prompt: prompt } } }) });
  if (r.getResponseCode() < 200 || r.getResponseCode() >= 300) return guardar({ ok: false, error: 'PATCH agente HTTP ' + r.getResponseCode(), detalle: r.getContentText().slice(0, 200) });
  p.setProperty('VOZ_PROMPT_HUELLA', huella);
  return guardar({ ok: true, clave_base: pc.clave, caracteres: pc.texto.length });
}

/* ═══ Herramientas del agente (las crea/actualiza el Hub por API; no hace falta configurarlas a mano) ═══
   Robot: { dsBot, token, action:'voz_tools', k:'<llave de voz>' }. La llave viaja en la URL de la herramienta
   (ElevenLabs la guarda); aquí solo se verifica contra VOZ_HASH_. Idempotente: si ya existen, las actualiza. */
function vozDefHerramientas_(base) {
  var s = function (d) { return { type: 'string', description: d }; };
  var caller = { type: 'string', dynamic_variable: 'system__caller_id' };
  return [
    { name: 'lookup_reservation', response_timeout_secs: 20,
      description: 'Ubica y valida la reserva de quien llama. Llámala SIEMPRE primero, solo con caller_id (valida por el número que llama). Si no queda validada, vuelve a llamarla con nombre, apellido y fecha de entrada (y lo que ya tengas). Devuelve found, verified, ambiguous, ask_next, zone_options, today, code, guest_name, check_in, check_out, property, form_status.',
      api_schema: { url: base + '&h=lookup_reservation', method: 'POST', request_body_schema: { type: 'object', required: ['caller_id'], properties: {
        caller_id: caller,
        guest_first_name: s('Nombre del titular de la reserva, si ya lo dio.'),
        guest_last_name: s('Apellido del titular, si ya lo dio.'),
        check_in: s('Fecha de entrada en formato YYYY-MM-DD, si ya la dio.'),
        check_out: s('Fecha de salida YYYY-MM-DD, solo como filtro secundario.'),
        property_name: s('Prefijo de zona para desempatar (Z1, Z10, Antigua), solo si ask_next fue zone.'),
        code: s('Código de reserva, solo si la persona lo dio.') } } } },
    { name: 'property_info', response_timeout_secs: 20,
      description: 'Datos de la propiedad de una reserva YA validada (verified = true): dirección, cómo llegar, portería, WiFi, parqueo y base de conocimiento del edificio. Usa el code que devolvió lookup_reservation.',
      api_schema: { url: base + '&h=property_info', method: 'POST', request_body_schema: { type: 'object', required: ['code'], properties: {
        code: s('Código de la reserva validada (campo code de lookup_reservation).'),
        lang: s('Idioma de la llamada: es o en.'),
        caller_id: caller } } } }
  ].map(function (t) { t.type = 'webhook'; return t; });
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
  var base = 'https://script.google.com/macros/s/AKfycbzTdkEpRPgnwaUIHWbQmrysPEqGYqTqDKYwMaQlnun-OT7B2hIa6KdSNS-aedWN-I0cZQ/exec?voz=1&k=' + encodeURIComponent(k);
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
