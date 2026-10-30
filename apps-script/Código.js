/****************************************************************************************
 * ALMA — Asistente nocturno de huéspedes · Spacio AM
 * Versión Apps Script (reemplaza el workflow de n8n). Sin costo por ejecución.
 * Incluye la API del hub (hub.spacioam.com): control, mejoras, cola y log.
 *
 * Flujo:
 *   Hospitable (webhook Messages) ─► doPost ─► hoja ALMA_COLA
 *   Disparador cada minuto ─► procesarCola:
 *     agrupa ráfagas por reserva ─► ¿equipo ya respondió? ─► clasifica (Haiku)
 *       SILENCIO ─► solo log
 *       VERDE / AMARILLO ─► redacta (Sonnet) ─► SOMBRA: log · BORRADOR: aviso · AUTO: espera 2–4 min y envía
 *       ROJO ─► SOMBRA: log · BORRADOR: alerta · AUTO: contención + alerta + 10 min ─► respaldo
 *   Hub (POST {hub:1, action, token}) ─► doPost ─► hubApi_   (sección 10)
 *
 * Secretos (Configuración del proyecto ► Propiedades del script):
 *   HOSPITABLE_TOKEN   (obligatorio)
 *   ANTHROPIC_KEY      (obligatorio)
 *   HUB_TOKEN          (hub; configurar() lo crea con el mismo valor que alma-client.js → CFG.token)
 *   WA_TOKEN, WA_PHONE_ID  (WhatsApp Cloud API: alertas + bandeja de WhatsApp del hub)
 *   WA_WABA_ID         (WhatsApp Business Account ID: probarWhatsApp suscribe la cuenta a la app)
 *   WA_VERIFY_TOKEN    (texto que pegas en Meta → Webhooks → Verify token; por defecto spacioam-alma)
 *   WA_PLANTILLA       (nombre de la plantilla aprobada para retomar conversaciones fuera de las 24 h; opcional WA_PLANTILLA_IDIOMA_ES / _EN)
 *   WA_PROPIETARIOS    (opcional: números extra de propietarios. Se leen solos del Control de usuarios por rol; o de SHEET_PROPIETARIOS_ID)
 *   WA_PRUEBA          (números del equipo que ALMA atiende como clientes, para pruebas)
 *   WA_EQUIPO          (opcional: números extra del equipo. Los de Control de usuarios, técnicos de EPI y ALMA_ESCALAMIENTO se toman solos)
 *   GEMINI_KEY         (transcribe notas de voz de WhatsApp; alternativa: OPENAI_KEY con Whisper)
 *   WEBHOOK_KEY        (lo genera configurar())
 *
 * Tras pegar: ejecuta configurar() una vez (agrega columnas nuevas al log y HUB_TOKEN) y vuelve a
 * implementar (Deploy ► Manage deployments ► Edit ► New version). Pon la URL /exec en alma-client.js → CFG.url.
 ****************************************************************************************/

const CFG = {
  // Hoja del webapp hola.spacioam.com: ALMA solo LEE Reservas y PropiedadesInfo, nunca escribe.
  SHEET_WEBAPP_ID: '12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ',
  // Hoja propia de ALMA: cola, log, control e instrucciones. configurar() crea las pestañas.
  SHEET_ALMA_ID: '1K8_MUCmJ4_Ks4DMKLSCbua1qC7X6QuilRaMvCquZ7kk',
  // Hoja de EPI (epi.spacioam.com): solo LEE Config → fila "codigos" (códigos quincenales de limpieza).
  SHEET_EPI_ID: '1-SfKC-evkK24qfOrrvIrcDs6ckGAmRzSLS_IYB8cYZg',
  TAB_COLA: 'ALMA_COLA',
  TAB_CONTROL: 'ALMA_CONTROL',
  TAB_LOG: 'ALMA_LOG',
  TAB_INSTRUCCIONES: 'ALMA_INSTRUCCIONES',
  TAB_AUTOMEJORA: 'ALMA_AUTOMEJORA',      // aprendizajes al observar al equipo (pendientes de aprobar)
  TAB_CONOCIMIENTO: 'ALMA_CONOCIMIENTO',  // base de conocimiento: políticas y datos por propiedad
  TAB_RESERVAS: 'Reservas',
  TAB_PROPIEDADES: 'PropiedadesInfo',

  TZ: 'America/Guatemala',
  VENTANA_INICIO: 19,          // 19:00
  VENTANA_FIN: 4,              // 04:00  (en SOMBRA se procesa 24 h)

  AGRUPAR_SEG: 15,             // silencio del huésped antes de procesar su turno (antes 30)
  ESPERA_SIN_SALIENTE_SEG: 180,// reserva nueva sin ningún mensaje nuestro: esperar al automático
  DELAY_MIN_SEG: 20,           // AUTO: espera "humana" antes de enviar
  DELAY_MAX_SEG: 60,
  ESPERA_ROJO_SEG: 600,        // AUTO + ROJO: minutos antes de avisar al respaldo
  MAX_INTENTOS: 3,
  MAX_TURNOS_POR_MINUTO: 6,
  DIAS_HISTORIAL_COLA: 14,
  MIN_EQUIPO_ACTIVO: 30,       // si una persona del equipo escribió hace menos de X min, ALMA calla
  EMERGENCIA_MIN: 15,
  CODIGO_REVISION_MIN: 6,      // huésped pide el código y no consta enviado → alerta a ambos admins; a los X min, código de emergencia
  INQUIRY_ESPERA_MIN: 12,      // minutos que se espera a que Hospitable programe su automático "Inquiry" antes de responder normal          // ROJO sin acceso + estadía activa + nadie responde → código de limpieza al huésped
  DIAS_HISTORIAL_LOG: 90,      // ALMA_LOG y ALMA_AUTOMEJORA se depuran a los 3 meses
  CONTENCION_HORAS: 6,         // una sola contención por incidente dentro de esta ventana
  APRENDER_MIN: 60,            // espera tras la conversación antes de comparar ALMA vs. humano
  REVISAR_SIN_RESP_MIN: 30,    // "sin respuesta": tras estos minutos ALMA relee el hilo y decide si de verdad hace falta responder

  MODELO_CLASIFICADOR: 'claude-haiku-4-5-20251001',
  MODELO_REDACTOR: 'claude-sonnet-4-6',

  HOSPITABLE_API: 'https://public.api.hospitable.com/v2',

  // Alertas. El correo siempre se envía; WhatsApp solo si WA_TOKEN y WA_PHONE_ID existen.
  EMAIL_ALERTAS: '',                  // vacío = tu correo de Google
  EMAIL_DESDE: 'hola@spacioam.com',   // remitente; debe existir como alias "Enviar como" en el Gmail que corre el script
  EMAIL_IMG_BASE: 'https://epi.spacioam.com/email-assets/',
  HUB_URL: 'https://hub.spacioam.com',
  WHATSAPP_NOCTURNO: '+50256909499',
  WHATSAPP_RESPALDO: '+50256806660',
  WHATSAPP_JUAN: '',                  // para borradores; vacío = solo correo

  PRUEBA_RESERVA_ID: 'd85a692d-bfce-44e5-ae18-52c1fa3bd6df'               // UUID de una reserva real para probarConReserva()
};

const COLA_HEADERS = ['recibido', 'message_id', 'reservation_id', 'conversation_id', 'huesped',
  'texto', 'estado', 'intentos', 'proximo', 'nota', 'datos'];
const C = {}; COLA_HEADERS.forEach((h, i) => C[h] = i);
// Columnas del log. configurar() agrega al final las que falten en una hoja existente, sin mover las demás.
const LOG_HEADERS = ['fecha', 'codigo', 'propiedad', 'nivel', 'razon', 'pregunta', 'respuesta', 'modo', 'corregida', 'accion',
  'huesped', 'checkin', 'checkout', 'apartamento', 'fotos', 'reservation_id', 'voto'];

const FINALES = ['silencio', 'respondido', 'borrador', 'sombra', 'omitido', 'escalado', 'error', 'agrupado'];
const NIVELES = ['VERDE', 'AMARILLO', 'ROJO', 'SILENCIO'];

// Tiempos editables desde el hub (filas de ALMA_CONTROL). cfg_(k) devuelve el valor de la hoja o el de CFG.
const NUM_KEYS = ['AGRUPAR_SEG', 'ESPERA_SIN_SALIENTE_SEG', 'DELAY_MIN_SEG', 'DELAY_MAX_SEG', 'ESPERA_ROJO_SEG', 'MIN_EQUIPO_ACTIVO', 'CONTENCION_HORAS', 'APRENDER_MIN', 'EMERGENCIA_MIN', 'CODIGO_REVISION_MIN', 'INQUIRY_ESPERA_MIN'];
let CTRL_NUM_ = null;
/* Topes de velocidad: aunque la hoja tenga valores altos, ALMA clasifica en ≤ 1 min y envía en ≤ 2 min. */
const TOPES_ = { AGRUPAR_SEG: 15, DELAY_MIN_SEG: 90, DELAY_MAX_SEG: 120 };
function cfg_(k) {
  if (!CTRL_NUM_) leerControl_(); const v = CTRL_NUM_[k];
  let x = (v != null && !isNaN(v)) ? v : CFG[k];
  if (TOPES_[k] != null) x = Math.min(x, TOPES_[k]);
  if (k === 'DELAY_MAX_SEG') x = Math.max(x, Math.min(cfg_('DELAY_MIN_SEG') + 1, TOPES_.DELAY_MAX_SEG));
  return x;
}
const AUTOMEJORA_HEADERS = ['fecha', 'codigo', 'propiedad', 'huesped', 'reservation_id', 'ultimo_guest_at', 'pregunta', 'borrador_ia', 'respuesta_humana', 'clave', 'resumen', 'cambios', 'estado', 'nota', 'contexto', 'beneficio'];
const CONOCIMIENTO_HEADERS = ['tema', 'contenido', 'aplica_a', 'activo', 'actualizado'];

/* ═══════════════════════════════ 1. WEBHOOK ═══════════════════════════════ */

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.salud) return json_(saludAlma_());   // vigía (sin llave: solo dice si ALMA está viva)
    if (body.usoIA) return ok_(usoExterno_(body));                // consumo de IA que reportan EPI, Hola y las demás apps
    if (body.gspPase) return json_(familiaPase_(body));          // The Gentle Stoic Parent: usuario unificado → firma del Hub (familia.js)
    if (body.dsBot) return dsBotApi_(body);                    // revisión automática del design system (token propio)
    if (body.mejora && body.action === 'respuesta') return json_(paraClaudeRespuesta_(body));   // Claude responde un pedido de Alma (llave de un solo uso, paraclaude.js)
    if ((e && e.parameter && e.parameter.voz) || body.voz) return vozApi_(e, body);   // ALMA voz (ElevenLabs), sección 15 (voz.js)
    if (body.correoPuente) return json_(correoPuente_(body));   // el puente de una cuenta de correo manda lo nuevo (llave propia, correo.js)
    if (body.hub) return hubApi_(body);                       // llamadas del hub (token propio, sección 10)
    if (body.object === 'whatsapp_business_account') return waWebhook_(body);   // WhatsApp Cloud API (sección 11)
    if (body.anilloPrueba) return json_(anilloGuardar_(body));   // prueba del anillo desde hub.spacioam.com/anillo/ (anillo.js)
    if (body.tutorial) return json_(tutorialApi_(body));   // tutoriales: avance de cada persona (tutoriales.js)
    if (body.recepcionEstado) return json_(recepcionEstados_(body.codes));   // Hola: estado del envío a recepción por código
    if (body.recepcion) return json_(recepcionEncolar_(body));   // Hola: registro enviado → ALMA manda el PDF a la recepción (recepcion.js)

    const clave = props.getProperty('WEBHOOK_KEY');
    if (clave && (!e || !e.parameter || e.parameter.k !== clave)) return ok_('ignorado: clave');

    const d = body.data || body;
    if (body.action && /^reservation\./.test(body.action)) { try { return ok_(reservaCambio_(body.action, d)); } catch (x) { console.error('reservaCambio_: ' + x); return ok_('error cambio'); } }
    if (body.action && body.action !== 'message.created') return ok_('ignorado: evento');
    const convId = convId_(d);
    // Bandeja: cada mensaje (huésped, equipo o automático) actualiza la conversación, igual que el inbox de Hospitable.
    try { inboxDesdeWebhook_(convId, d); } catch (x) { console.error('inbox: ' + x); }
    try { cacheEntrante_(convId, d); } catch (x) {}
    if (String(convId).indexOf('inq:') === 0) { try { guardarMsgInq_(convId, d); } catch (x) { console.error('guardarMsgInq_: ' + x); } }
    if (String(d.sender_type || '').toLowerCase() === 'guest') { try { let pn = {}; try { pn = preContexto_(convId); } catch (x) {} const sn = d.sender || {}; pushNuevo_(convId, pn.huesped || [s_(sn.first_name), s_(sn.last_name)].filter(Boolean).join(' ') || s_(sn.full_name), pn.propiedad, s_(d.body) || (d.attachments && d.attachments.length ? 'Envió una foto' : '')); } catch (x) { console.error('pushNuevo hosp: ' + x); } }
    if (String(d.sender_type || '').toLowerCase() !== 'guest') { try { if (d.source !== 'automated') observarHumano_(convId, s_(d.body)); } catch (x) { console.error('observarHumano_: ' + x); } return ok_('bandeja: mensaje nuestro'); }
    const fotos = adjuntos_(d.attachments);
    const texto = s_(d.body) || (fotos.length ? '[el huésped envió una imagen]' : '');
    if (!texto) return ok_('ignorado: vacío');

    const msgId = s_(d.id) || s_(body.id);
    if (msgId) {
      const cache = CacheService.getScriptCache();
      if (cache.get('m_' + msgId)) return ok_('ignorado: duplicado');
      cache.put('m_' + msgId, '1', 21600);
    }

    // Datos básicos de la reserva desde el primer segundo: el hub muestra huésped, propiedad y estadía mientras clasifica.
    let pre = {}; try { pre = preContexto_(convId); } catch (x) { console.error('pre: ' + x); }
    const datos0 = Object.assign({}, pre, fotos.length ? { fotos: fotos } : {});
    const sh = hoja_(CFG.TAB_COLA);
    sh.appendRow([new Date().toISOString(), msgId, convId, s_(d.conversation_id),
      s_(d.sender && d.sender.first_name) || s_(pre.huesped), texto.slice(0, 2000), 'pendiente', 0, '', '',
      Object.keys(datos0).length ? JSON.stringify(datos0) : '']);

    props.setProperty('ALMA_ACTIVO', '1');
    props.setProperty('ULTIMO_POST', String(Date.now()));
    programarPronto_(texto);
    return ok_('en cola');
  } catch (err) {
    console.error('doPost: ' + err);
    return ok_('error');          // siempre 200: evita reintentos de Hospitable
  }
}

/* Huésped, propiedad, estadía y formulario de una reserva (cacheado 6 h). Ligero: sin IA ni disponibilidad. */
function preContexto_(resId) {
  if (!resId) return {};
  if (String(resId).indexOf('wa:') === 0) return { propiedad: 'Sin reserva', tipo: 'whatsapp', canal: 'whatsapp', codigo: '' };
  const cache = CacheService.getScriptCache(), ck = 'pre2_' + resId, c0 = cache.get(ck);
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  const esInq = String(resId).indexOf('inq:') === 0;
  if (esInq) { const q = inquiryDatos_(String(resId).slice(4)); if (!q) return {}; cache.put(ck, JSON.stringify(q), q.propiedad && q.checkin ? 21600 : 300); return q; }
  const r = hosp_('get', '/reservations/' + resId + '?include=properties,property,guest');
  if (r.code !== 200) return {};
  const res = (r.json && r.json.data) || {}, prop = (res.properties && res.properties[0]) || res.property || {};
  const codigo = esInq ? '' : (s_(res.code) || s_(res.platform_id));
  let fila = {}; try { fila = codigo ? (buscarReserva_(codigo) || {}) : {}; } catch (e) {}
  const gst = res.guest || {};
  const o = {
    codigo: codigo, propiedad: s_(prop.name) || s_(prop.public_name) || s_(fila.property_name),
    huesped: [s_(gst.first_name), s_(gst.last_name)].filter(Boolean).join(' ') || s_(gst.name),
    foto: s_(gst.picture_url) || s_(gst.profile_picture) || s_(gst.thumbnail_url),
    checkin: s_(res.check_in || res.arrival_date).slice(0, 10) || fecha_(fila.checkin_date),
    checkout: s_(res.check_out || res.departure_date).slice(0, 10) || fecha_(fila.checkout_date),
    formStatus: s_(fila.status_form).toLowerCase(),
    tipo: esInq ? 'consulta' : 'reserva', status: s_(res.status || res.reservation_status && res.reservation_status.current && res.reservation_status.current.category),
    canal: canalPlat_(res.platform || res.channel || res.source),
    tels: [].concat(gst.phone_numbers || [], gst.phone || [], gst.phone_number || []).map(x => String(typeof x === 'object' ? (x.number || x.phone || '') : x).replace(/\D/g, '')).filter(x => x.length >= 8)
  };
  cache.put(ck, JSON.stringify(o), 21600);
  return o;
}

/* Id de conversación: reserva o consulta (inquiry). Nunca vacío si Hospitable manda cualquiera de los dos. */
/* La llave que une consulta y reserva es el conversation_id de Hospitable (el hilo del inbox): es el mismo antes y
   después de reservar, y el uuid de una consulta ES su conversation_id. Cuando un mensaje trae reservation_id y
   conversation_id, la consulta se convirtió en reserva: se fusiona (vincularReserva_). */
function convId_(d) {
  const r = s_(d.reservation_id) || s_(d.reservation && d.reservation.id);
  const cid = s_(d.conversation_id || (d.conversation && d.conversation.id));
  if (r) { if (cid) { try { vincularReserva_(cid, r); } catch (e) { console.error('vincularReserva_: ' + e); } } return r; }
  const q = s_(d.inquiry_id) || s_(d.inquiry && d.inquiry.id) || s_(d.inquiry_uuid);
  if (q) { if (cid) { try { recordarConv_(cid, q); } catch (e) {} } return 'inq:' + q; }
  try { const u = inqDeConversacion_(d); if (u) return 'inq:' + u; } catch (e) { console.error('inqDeConversacion_: ' + e); }
  if (cid) return 'inq:' + cid;
  return '';
}
function recordarConv_(cid, inqU) {
  vSet_('cinq_' + cid, inqU);
  vSet_('inqcid_' + inqU, cid);
}
/* Consulta → reserva: la fila de la bandeja, la cola, el log, los hitos, las marcas de resuelta y los mensajes guardados
   pasan del id de la consulta (inq:…) al de la reserva. Desde ahí el hilo completo sale de /reservations/{id}/messages. */
function vincularReserva_(cid, resId) {
  if (!cid || !resId || resId === cid) return;
  if (vGet_('cres_' + cid) === resId) return;
  const inqU = vGet_('cinq_' + cid) || cid;
  if (inqU === resId) return;
  vSet_('cres_' + cid, resId); vSet_('inqres_' + inqU, resId); if (inqU !== cid) vSet_('inqres_' + cid, resId);
  const viejos = ['inq:' + inqU].concat(inqU !== cid ? ['inq:' + cid] : []);
  const lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { return; }
  try {
    const ss = ssAlma_(), sh = ss.getSheetByName('ALMA_INBOX');
    if (sh && sh.getLastRow() >= 2) {
      const ix = k => INBOX_CAB_.indexOf(k), n = sh.getLastRow(), w = Math.max(INBOX_CAB_.length, sh.getLastColumn());
      const v = sh.getRange(2, 1, n - 1, w).getValues();
      const fi = v.findIndex(x => viejos.indexOf(String(x[0])) >= 0), fr = v.findIndex(x => String(x[0]) === resId);
      if (fi >= 0 && fr < 0) { sh.getRange(fi + 2, 1).setValue(resId); sh.getRange(fi + 2, ix('tipo') + 1).setValue('reserva'); sh.getRange(fi + 2, ix('hosp_conv') + 1).setValue(cid); }
      else if (fi >= 0) {
        const a = v[fi], b = v[fr];
        INBOX_CAB_.forEach((k, i) => { if ((b[i] === '' || b[i] == null) && a[i] !== '' && a[i] != null) b[i] = a[i]; });
        ['ultimo_guest_ts', 'ultimo_host_ts'].forEach(k => { if (tsMs_(a[ix(k)]) > tsMs_(b[ix(k)])) b[ix(k)] = a[ix(k)]; });
        b[0] = resId; b[ix('tipo')] = 'reserva'; b[ix('hosp_conv')] = cid;
        sh.getRange(fr + 2, 1, 1, w).setValues([b.map(x => x instanceof Date ? x.toISOString() : x)]); sh.deleteRow(fi + 2);
      }
    }
    /* El mismo id en el resto de hojas (cola, log, hitos, resueltas, mensajes de consulta…). */
    ss.getSheets().forEach(s2 => {
      if (s2.getName() === 'ALMA_INBOX' || s2.getLastRow() < 2) return;
      const cab = s2.getRange(1, 1, 1, s2.getLastColumn()).getValues()[0].map(x => String(x).trim());
      ['reservation_id', 'conv_id', 'res_key'].forEach(h => { const c = cab.indexOf(h); if (c < 0) return; const rg = s2.getRange(2, c + 1, s2.getLastRow() - 1, 1); viejos.forEach(old => { try { rg.createTextFinder(old).matchEntireCell(true).replaceAllWith(resId); } catch (e) {} }); });
    });
  } finally { lock.releaseLock(); }
  try { CacheService.getScriptCache().removeAll(['pre2_' + resId, 'hf_' + resId, 'hr_' + resId].concat(viejos.map(x => 'hf_' + x))); } catch (e) {}
}
/* ¿La consulta ya es reserva? GET /reservations?conversation_id=… (sin ventana de fechas). Negativo cacheado 10 min. */
function reservaDeConsulta_(uid) {
  const ya = vGet_('inqres_' + uid); if (ya) return ya;
  const cache = CacheService.getScriptCache(); if (cache.get('nores_' + uid)) return '';
  const cid = vGet_('inqcid_' + uid) || uid;
  const r = hosp_('get', '/reservations?conversation_id=' + encodeURIComponent(cid) + '&per_page=5');
  const d = r.code === 200 ? ((r.json && r.json.data) || []).filter(x => s_(x.id) && s_(x.id) !== uid && s_(x.id) !== cid) : [];
  if (!d.length) { cache.put('nores_' + uid, '1', 600); return ''; }
  const id = s_(d[0].id); recordarConv_(cid, uid); vincularReserva_(cid, id);
  return id;
}
/* Todo lo que ALMA o el equipo envía a una consulta se guarda aquí: la API no deja leer el historial de una consulta,
   y el webhook de nuestro propio mensaje a veces no trae cómo ligarlo. Así el hilo nunca pierde nuestra respuesta. */
function registrarEnvioInq_(convId, texto, ref) {
  texto = s_(texto).trim(); if (!convId || !texto) return;
  const ts = new Date().toISOString();
  try { hojaCrear_('ALMA_MSG_INQ', MSG_INQ_CAB_).appendRow([convId, ts, 'host', '', texto.slice(0, 5000), '', ref ? 'ref:' + ref : 'enviado']); } catch (e) { console.error('registrarEnvioInq_: ' + e); }
  try { inboxUpsert_(convId, { ultimo_texto: texto.slice(0, 300), ultimo_de: 'host', ultimo_ts: ts, ultimo_host_ts: ts, ultimo_canal: 'hospitable' }); } catch (e) {}
  try { CacheService.getScriptCache().removeAll(['hf_' + convId, 'hr_' + convId]); } catch (e) {}
}
/* Consultas (inquiries): Hospitable a veces manda el mensaje sin inquiry_id. Se busca la consulta por
   conversation_id o, si no viene, por el nombre del huésped entre las consultas recientes. Se guarda 7 días. */
function idsPropiedades_() {
  const cache = CacheService.getScriptCache(), c0 = cache.get('prop_ids');
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  const ids = []; let p = 1;
  while (p <= 5) {
    const r = hosp_('get', '/properties?per_page=100&page=' + p); if (r.code !== 200) break;
    const d = (r.json && r.json.data) || []; d.forEach(x => x.id && ids.push(x.id));
    if (d.length < 100) break; p++;
  }
  if (ids.length) cache.put('prop_ids', JSON.stringify(ids), 21600);
  return ids;
}
function inqDeConversacion_(d) {
  const cid = s_(d.conversation_id || (d.conversation && d.conversation.id));
  if (cid) { const ya = vGet_('cinq_' + cid); if (ya) return ya; }
  /* El nombre solo sirve si escribe el huésped: en un mensaje nuestro el remitente es el anfitrión (p. ej. Gabriel
     Asturias) y buscarlo entre las consultas dejaba nuestra respuesta sin conversación. */
  const s = d.sender || {}, deHuesped = String(d.sender_type || '').toLowerCase() === 'guest';
  const nom = deHuesped ? norm_([s_(s.first_name), s_(s.last_name)].filter(Boolean).join(' ') || s_(s.full_name) || s_(s.name)) : '';
  if (!cid && !nom) return '';
  const ids = idsPropiedades_(); if (!ids.length) return '';
  const qs = ids.slice(0, 60).map(x => 'properties[]=' + encodeURIComponent(x)).join('&');
  const r = hosp_('get', '/inquiries?' + qs + '&include=guest,properties,listings&per_page=50');
  if (r.code !== 200) return '';
  const lista = (r.json && r.json.data) || [];
  let hit = cid ? lista.find(x => s_(x.conversation_id || (x.conversation && x.conversation.id)) === cid) : null;
  if (!hit && nom) {
    const cand = lista.filter(x => { const gu = x.guest || {}; return norm_([s_(gu.first_name), s_(gu.last_name)].filter(Boolean).join(' ') || s_(gu.name)) === nom; });
    cand.sort((a, b) => new Date(b.last_message_at || b.updated_at || b.inquiry_date || 0) - new Date(a.last_message_at || a.updated_at || a.inquiry_date || 0));
    hit = cand[0];
  }
  const u = hit ? s_(hit.id || hit.uuid) : '';
  if (u && cid) recordarConv_(cid, u);
  return u;
}
function norm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
/* Nombre de la propiedad de una consulta: Hospitable a veces la manda sin nombre (solo el id de la propiedad o el
   id del anuncio en la plataforma). Se resuelve contra el catálogo de propiedades (cacheado 6 h). */
function nombrePropInq_(d) {
  d = d || {};
  const prop = (d.properties && d.properties[0]) || d.property || {}, lst = (d.listings && d.listings[0]) || d.listing || {};
  let n = s_(prop.name) || s_(prop.public_name);
  if (n) return n;
  const pid = s_(prop.id || prop.uuid || d.property_id || d.property_uuid || lst.property_id || lst.property_uuid);
  if (pid) {
    n = nombresPropiedades_()[pid] || '';
    if (!n) { const p = hosp_('get', '/properties/' + pid); n = s_(p.json && p.json.data && (p.json.data.name || p.json.data.public_name)); }
    if (n) return n;
  }
  const plat = s_(lst.platform_id || lst.id);
  if (plat) { n = nombresPropiedades_()['lst:' + plat] || ''; if (n) return n; }
  return s_(lst.name || lst.title || lst.public_name);
}
function nombresPropiedades_() {
  const cache = CacheService.getScriptCache(), c0 = cache.get('prop_nombres');
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  const o = {}; let p = 1;
  while (p <= 5) {
    const r = hosp_('get', '/properties?per_page=100&include=listings&page=' + p); if (r.code !== 200) break;
    const d = (r.json && r.json.data) || [];
    d.forEach(x => { const n = s_(x.name) || s_(x.public_name); if (!x.id || !n) return; o[x.id] = n; (x.listings || []).forEach(l => { const k = s_(l.platform_id || l.id); if (k) o['lst:' + k] = n; }); });
    if (d.length < 100) break; p++;
  }
  try { if (Object.keys(o).length) cache.put('prop_nombres', JSON.stringify(o), 21600); } catch (e) {}
  return o;
}
/* Datos de una consulta: huésped, foto, propiedad, fechas, personas y plataforma. Mismo formato que preContexto_. */
/* Hospitable cambia dónde manda las fechas de una consulta: se buscan en cualquier nivel por nombre de campo. */
function fechaProfunda_(o, re, prof) {
  if (!o || typeof o !== 'object' || (prof || 0) > 3) return '';
  for (const k in o) { const v = o[k]; if (typeof v === 'string' && re.test(k) && /^\d{4}-\d\d-\d\d/.test(v)) return v; }
  for (const k in o) { if (o[k] && typeof o[k] === 'object' && !/guest|user|host|message/i.test(k)) { const x = fechaProfunda_(o[k], re, (prof || 0) + 1); if (x) return x; } }
  return '';
}
function inquiryDatos_(uuid) {
  let r = hosp_('get', '/inquiries/' + uuid + '?include=properties,listings,guest');
  if (r.code !== 200) r = hosp_('get', '/inquiries/' + uuid);
  if (r.code !== 200) return null;
  const d = (r.json && r.json.data) || {}, gu = d.guest || {};
  const prop = (d.properties && d.properties[0]) || d.property || {}, lst = (d.listings && d.listings[0]) || d.listing || {};
  const nombreProp = nombrePropInq_(d);
  const gs = d.guests || {};
  return {
    codigo: '', propiedad: nombreProp || s_(lst.name || lst.title),
    huesped: [s_(gu.first_name), s_(gu.last_name)].filter(Boolean).join(' ') || s_(gu.name),
    foto: s_(gu.picture_url) || s_(gu.profile_picture) || s_(gu.thumbnail_url),
    checkin: (s_(d.arrival_date || d.check_in || d.checkin || d.start_date || (d.dates && (d.dates.check_in || d.dates.start)) || (d.stay && d.stay.check_in)) || fechaProfunda_(d, /arriv|check_?in|start|from|desde|llegada/i)).slice(0, 10),
    checkout: (s_(d.departure_date || d.check_out || d.checkout || d.end_date || (d.dates && (d.dates.check_out || d.dates.end)) || (d.stay && d.stay.check_out)) || fechaProfunda_(d, /depart|check_?out|end|to$|hasta|salida/i)).slice(0, 10),
    huespedes: Number(gs.total || ((gs.adult_count || 0) + (gs.child_count || 0))) || 0,
    idioma: s_(gu.language || d.language).slice(0, 2).toLowerCase(),
    formStatus: '', tipo: 'consulta', status: s_(d.status || 'inquiry'),
    canal: canalPlat_(lst.platform || d.platform), tels: []
  };
}

/* ── Bandeja (ALMA_INBOX): una fila por conversación con su último mensaje — el espejo del inbox de Hospitable ── */
const INBOX_CAB_ = ['conv_id', 'codigo', 'huesped', 'foto', 'propiedad', 'tipo', 'checkin', 'checkout', 'ultimo_texto', 'ultimo_de', 'ultimo_ts', 'ultimo_guest_ts', 'ultimo_host_ts', 'actualizado', 'canal', 'wa', 'ultimo_canal', 'revisado_ts', 'no_requiere', 'revision_razon', 'hosp_conv', 'ultimo_auto_ts', 'ultimo_auto_texto', 'promesa', 'promesa_vence', 'promesa_id', 'promesa_estado'];
let INBOX_OK_ = false;
function hojaInbox_() {
  const sh = hojaCrear_('ALMA_INBOX', INBOX_CAB_);
  if (!INBOX_OK_) { INBOX_OK_ = true; if (sh.getLastColumn() < INBOX_CAB_.length) sh.getRange(1, 1, 1, INBOX_CAB_.length).setValues([INBOX_CAB_]); }
  return sh;
}
/* Plataforma de la reserva → canal que ve el hub (logo). */
function canalPlat_(p) {
  const x = String(p || '').toLowerCase();
  return /airbnb/.test(x) ? 'airbnb' : /homeaway|vrbo/.test(x) ? 'vrbo' : /booking/.test(x) ? 'booking' : /expedia/.test(x) ? 'expedia' : 'directa';
}
/* ¿Un mensaje automático entrega lo que el huésped pidió? Ej.: pidió la dirección y llegó el acceso a hola.spacioam.com. */
function autoResuelve_(pregunta, auto) {
  const p = String(pregunta || '').toLowerCase(), a = String(auto || '').toLowerCase();
  const pideInfo = /direcci|ubicaci|address|location|where is|d[oó]nde (queda|est)|c[oó]mo llego|how (do i|to) get|wifi|wi-fi|internet|clave|contrase|password|c[oó]digo|code|acceso|access|check.?in|llegada|arrival|instruc|parqueo|parking|piso|floor|gu[ií]a|guide/.test(p);
  if (pideInfo && /hola\.spacioam\.com/.test(a)) return true;
  if (/check.?out|salida|hora de (salir|entrega)|late check|dejar (las )?llaves|keys/.test(p) && /check.?out|salida/.test(a) && /\d{1,2}(:\d\d)?\s*(am|pm|h)/.test(a)) return true;
  return [[/wifi|wi-fi|internet/, /wifi|wi-fi|red |network/], [/direcci|ubicaci|address|location/, /direcci|address|maps\.|waze|ubicaci/], [/c[oó]digo|code|acceso|access/, /c[oó]digo|code|acceso|access/]]
    .some(pr => pr[0].test(p) && pr[1].test(a));
}
/* Turno pendiente del huésped: sus últimos mensajes seguidos, ignorando los automáticos que cayeron después.
   Un automático solo cuenta como respuesta si entrega lo que el huésped pidió. */
function turnoPendiente_(hilo) {
  let i = hilo.length - 1; const autos = [];
  while (i >= 0 && hilo[i].tipo !== 'guest' && hilo[i].auto) { autos.unshift(hilo[i]); i--; }
  if (i < 0 || hilo[i].tipo !== 'guest') return { pendiente: false, turno: [], autos: autos };
  /* El turno son sus mensajes seguidos, pero un hueco de más de 12 h lo corta: un "Hola" de hoy no revive una pregunta de hace días. */
  let j = i; while (j >= 0 && hilo[j].tipo === 'guest' && (j === i || new Date(hilo[j + 1].created) - new Date(hilo[j].created) < 12 * 3600000)) j--;
  const turno = hilo.slice(j + 1, i + 1), preg = turno.map(m => m.texto).join('\n');
  /* Solo los programados de check-in y checkout pueden contar como respuesta, y solo si responden lo que preguntó. */
  return { pendiente: !autos.some(a => (a.plantilla === 'checkin' || a.plantilla === 'checkout' || (!a.plantilla && /hola\.spacioam\.com/i.test(a.texto))) && autoResuelve_(preg, a.texto)), turno: turno, autos: autos };
}
/* Idioma del texto (es/en/pt/fr) por palabras frecuentes; '' si no hay señal clara. */
function idiomaDe_(t) {
  const s = ' ' + String(t || '').toLowerCase().replace(/[^a-záéíóúñüçãõàâêôè'\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const c = ws => ws.reduce((n, w) => n + (s.indexOf(' ' + w + ' ') >= 0 ? 1 : 0), 0);
  const L = [['es', c(['el', 'la', 'los', 'las', 'que', 'y', 'un', 'una', 'por', 'es', 'hola', 'gracias', 'estoy', 'tengo', 'puedo', 'dónde', 'cómo', 'qué', 'buenas', 'nos', 'mi', 'muchas', 'llegamos', 'tenemos'])],
    ['en', c(['the', 'and', 'is', 'you', 'to', 'of', 'it', 'we', 'i', 'my', 'for', 'hi', 'hello', 'thanks', 'thank', 'can', 'what', 'where', 'how', 'please', 'there', 'our', 'are', 'not', 'will'])],
    ['pt', c(['obrigado', 'obrigada', 'você', 'não', 'olá', 'estamos', 'onde', 'nós', 'uma', 'com', 'tudo', 'bom'])],
    ['fr', c(['le', 'les', 'et', 'est', 'vous', 'merci', 'bonjour', 'nous', 'pas', 'je', 'une', 'avec', 'où'])]].sort((x, y) => y[1] - x[1]);
  return L[0][1] > 0 && L[0][1] > L[1][1] ? L[0][0] : '';
}
function inboxUpsert_(convId, o) {
  if (!convId) return;
  const lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) { return; }
  try {
    const sh = hojaInbox_(), n = sh.getLastRow();
    let fila = 0;
    if (n >= 2) { const f = sh.getRange(2, 1, n - 1, 1).createTextFinder(convId).matchEntireCell(true).findNext(); if (f) fila = f.getRow(); }
    const prev = fila ? sh.getRange(fila, 1, 1, INBOX_CAB_.length).getValues()[0] : INBOX_CAB_.map(() => '');
    const cur = {}; INBOX_CAB_.forEach((k, i) => cur[k] = prev[i]);
    const forzar = !!o._forzar; delete o._forzar;
    /* Automáticos de Hospitable (checkout, first morning, review reminder…): no son actividad. No mueven la hora ni el
       último mensaje, así no reviven conversaciones viejas o ya resueltas. Solo cuentan si entregan lo que el huésped pidió. */
    /* Pero sí se guardan aparte (ultimo_auto_ts / ultimo_auto_texto) para que «Ver todo» muestre también las
       conversaciones que solo tienen automáticos (confirmación de reserva, self check-in…). */
    if (o._auto) {
      delete o._auto;
      const tA = o.ultimo_ts ? new Date(o.ultimo_ts).getTime() : 0, tAPrev = cur.ultimo_auto_ts ? new Date(cur.ultimo_auto_ts).getTime() : 0;
      if (tA && tA >= tAPrev) { o.ultimo_auto_ts = o.ultimo_ts; o.ultimo_auto_texto = o.ultimo_texto; }
      if (!(String(cur.ultimo_de) === 'guest' && autoResuelve_(cur.ultimo_texto, o.ultimo_texto))) ['ultimo_texto', 'ultimo_de', 'ultimo_host_ts', 'ultimo_ts', 'ultimo_canal'].forEach(k => delete o[k]);
    }
    else delete o._auto;
    // Solo avanza: un mensaje más viejo nunca pisa al último.
    const tsNuevo = o.ultimo_ts ? new Date(o.ultimo_ts).getTime() : 0, tsPrev = cur.ultimo_ts ? new Date(cur.ultimo_ts).getTime() : 0;
    Object.keys(o).forEach(k => {
      if (o[k] === '' || o[k] == null) return;
      if (!forzar && /^ultimo_(texto|de|ts)$/.test(k) && tsNuevo && tsPrev && tsNuevo < tsPrev) return;
      if (!forzar && (k === 'ultimo_guest_ts' || k === 'ultimo_host_ts')) { const a = new Date(o[k]).getTime(), b = cur[k] ? new Date(cur[k]).getTime() : 0; if (a < b) return; }
      cur[k] = o[k];
    });
    cur.conv_id = convId; cur.actualizado = new Date().toISOString();
    const row = INBOX_CAB_.map(k => cur[k] instanceof Date ? cur[k].toISOString() : cur[k]);
    if (fila) sh.getRange(fila, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
}
/* ── Revisión de "sin respuesta" ──
   Una conversación queda "sin respuesta" cuando el último mensaje es del huésped. A los REVISAR_SIN_RESP_MIN minutos
   ALMA relee el hilo completo y decide si ese mensaje todavía pide respuesta. Si no (gracias, ok, despedida, ya resuelto),
   marca no_requiere = hora de ese mensaje; el hub la saca de pendientes. Un mensaje nuevo del huésped la reabre sola. */
const PROMPT_REVISAR_SR_ = 'Revisas conversaciones de huéspedes de Spacio AM (hospitalidad boutique, Guatemala) que quedaron marcadas como "sin respuesta" porque el último mensaje es del huésped. Lee el hilo completo y decide si ese último mensaje del huésped TODAVÍA necesita que alguien le responda.\n' +
  'NO requiere respuesta: agradecimientos, confirmaciones ("ok", "perfecto", "claro que sí", "listo"), despedidas, emojis o reacciones, cierres de conversación, o algo que ya quedó resuelto en el hilo.\n' +
  'SÍ requiere: cualquier pregunta, pedido, problema, queja, dato nuevo que haya que confirmar, o un mensaje ambiguo. En duda: requiere.\n' +
  'Devuelve SOLO JSON, sin markdown: {"requiere": true|false, "razon": "máximo 10 palabras en español"}';
function tsMs_(x) { const t = x instanceof Date ? x.getTime() : new Date(String(x || '')).getTime(); return isNaN(t) ? 0 : t; }
function revisarSinRespuesta_() {
  const min = Number(cfg_('REVISAR_SIN_RESP_MIN')); if (!min || min <= 0) return;
  const props = PropertiesService.getScriptProperties();
  if (Date.now() - Number(props.getProperty('REV_SR_TS') || 0) < 5 * 60000) return;
  props.setProperty('REV_SR_TS', String(Date.now()));
  if (!props.getProperty('ANTHROPIC_KEY')) return;
  const sh = hojaInbox_(); if (sh.getLastRow() < 2) return;
  const ix = k => INBOX_CAB_.indexOf(k), ahora = Date.now();
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, INBOX_CAB_.length).getValues();
  const cand = [];
  v.forEach((row, i) => {
    if (String(row[ix('ultimo_de')]) !== 'guest') return;
    const ug = tsMs_(row[ix('ultimo_guest_ts')]) || tsMs_(row[ix('ultimo_ts')]); if (!ug) return;
    const edad = ahora - ug; if (edad < min * 60000 || edad > 72 * 3600000) return;
    if (tsMs_(row[ix('revisado_ts')]) === ug) return;
    cand.push({ fila: i + 2, id: String(row[ix('conv_id')]), ug: ug, texto: String(row[ix('ultimo_texto')] || '') });
  });
  cand.sort((a, b) => b.ug - a.ug).slice(0, 4).forEach(c => {
    try {
      const h = hiloConv_(c.id), hilo = (h.hilo || []).slice(-14), ult = hilo[hilo.length - 1];
      let requiere = true, razon = '';
      if (ult && ult.tipo !== 'guest' && !ult.auto) { requiere = false; razon = 'ya le respondimos después de su mensaje'; }
      else {
        const txt = hilo.length ? hilo.map(m => (m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'NOSOTROS (automático)' : 'NOSOTROS') + ' · ' + m.created + ': ' + String(m.texto || (m.fotos && m.fotos.length ? '[foto]' : '')).slice(0, 600)).join('\n') : 'HUÉSPED: ' + c.texto;
        const out = claude_(CFG.MODELO_CLASIFICADOR, 150, PROMPT_REVISAR_SR_, 'HILO (el más reciente al final):\n' + txt, 0);
        const m = String(out || '').match(/\{[\s\S]*\}/); if (!m) return; // sin respuesta del modelo: se reintenta en la próxima vuelta
        const j = JSON.parse(m[0]); requiere = j.requiere !== false; razon = String(j.razon || '').slice(0, 140);
      }
      escribirRevisionSR_(c.fila, c.id, c.ug, requiere, razon);
    } catch (e) { console.error('revisar ' + c.id + ': ' + e); }
  });
}
function escribirRevisionSR_(fila, id, ug, requiere, razon) {
  const lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) { return; }
  try {
    const sh = hojaInbox_(), ix = k => INBOX_CAB_.indexOf(k), row = sh.getRange(fila, 1, 1, INBOX_CAB_.length).getValues()[0];
    if (String(row[ix('conv_id')]) !== id) return;                                             // la fila se movió
    if ((tsMs_(row[ix('ultimo_guest_ts')]) || tsMs_(row[ix('ultimo_ts')])) !== ug) return;     // entró un mensaje nuevo
    const iso = new Date(ug).toISOString();
    sh.getRange(fila, ix('revisado_ts') + 1, 1, 3).setValues([[iso, requiere ? '' : iso, requiere ? '' : razon]]);
  } finally { lock.releaseLock(); }
}
/* La API pública de Hospitable no expone el historial de una consulta (solo enviar). Cada mensaje que llega por
   webhook se guarda aquí; el hub arma el hilo con esto + la cola + el log. */
const MSG_INQ_CAB_ = ['conv_id', 'created', 'tipo', 'auto', 'texto', 'fotos', 'message_id'];
function guardarMsgInq_(convId, d) {
  const sh = hojaCrear_('ALMA_MSG_INQ', MSG_INQ_CAB_);
  const guest = String(d.sender_type || '').toLowerCase() === 'guest', fotos = adjuntos_(d.attachments);
  const texto = s_(d.body); if (!texto && !fotos.length) return;
  sh.appendRow([convId, s_(d.created_at) || new Date().toISOString(), guest ? 'guest' : 'host', !guest && s_(d.source) === 'automated' ? 'si' : '', texto.slice(0, 5000), fotos.join(' '), s_(d.id)]);
}
const isoDe_ = v => { if (v instanceof Date) return v.toISOString(); const x = String(v || '').trim(); if (!x) return ''; const t = Date.parse(/^\d{4}-\d\d-\d\d \d/.test(x) ? x.replace(' ', 'T') + '-06:00' : x); return isNaN(t) ? '' : new Date(t).toISOString(); };
function hiloInqLocal_(id) {
  const out = [], visto = {};
  const add = (tipo, texto, created, auto, fotos) => {
    texto = s_(texto).trim(); if (!texto || !created) return;
    const k = tipo + '|' + texto.slice(0, 120); if (visto[k]) return; visto[k] = 1;
    out.push({ tipo: tipo, auto: !!auto, texto: texto, created: created, fotos: fotos || [], canal: 'hospitable' });
  };
  try { leerTablaHoja_(ssAlma_().getSheetByName('ALMA_MSG_INQ')).filter(r => s_(r.conv_id) === id).forEach(r => add(s_(r.tipo) === 'guest' ? 'guest' : 'host', r.texto, isoDe_(r.created), s_(r.auto) === 'si', s_(r.fotos).split(' ').filter(Boolean))); } catch (e) { console.error('hiloInq msg: ' + e); }
  try { leerTabla_(CFG.TAB_COLA).filter(r => s_(r.reservation_id) === id || s_(r.conversation_id) === id).forEach(r => add('guest', r.texto, isoDe_(r.recibido))); } catch (e) { console.error('hiloInq cola: ' + e); }
  try { (function () { const v = leerTabla_(CFG.TAB_LOG).filter(r => s_(r.reservation_id) === id); return v.length ? v : archivoBuscar_(CFG.TAB_LOG, 'reservation_id', id); })().forEach(r => {
    const f = isoDe_(r.fecha);
    if (s_(r.pregunta)) add('guest', r.pregunta, f ? new Date(Date.parse(f) - 1000).toISOString() : '');
    if (s_(r.respuesta) && /^ENVIADO|contención/i.test(s_(r.accion))) add('host', r.respuesta, f);
  }); } catch (e) { console.error('hiloInq log: ' + e); }
  return out.sort((a, b) => new Date(a.created) - new Date(b.created));
}
/* ¿Ya hubo contacto antes en esta consulta? Si sí, un "gracias" no es una consulta nueva que pre-aprobar. */
function inqPrevio_(id) {
  try { if (hiloInqLocal_(id).some(m => m.tipo === 'host')) return true; } catch (e) {}
  try { const sh = hojaInbox_(), n = sh.getLastRow(); if (n >= 2) { const ix = k => INBOX_CAB_.indexOf(k); const f = sh.getRange(2, 1, n - 1, INBOX_CAB_.length).getValues().find(v => String(v[0]) === id); if (f && f[ix('ultimo_host_ts')]) return true; } } catch (e) {}
  return false;
}
function inboxDesdeWebhook_(convId, d) {
  if (!convId) return;
  const guest = String(d.sender_type || '').toLowerCase() === 'guest';
  const auto = !guest && s_(d.source) === 'automated';
  const fotos = adjuntos_(d.attachments);
  const ts = s_(d.created_at) || new Date().toISOString();
  let pre = {}; try { pre = preContexto_(convId); } catch (e) {}
  const s = d.sender || {};
  inboxUpsert_(convId, {
    codigo: pre.codigo, huesped: pre.huesped || (guest ? [s_(s.first_name), s_(s.last_name)].filter(Boolean).join(' ') || s_(s.full_name) : ''),
    foto: pre.foto || (guest ? s_(s.picture_url) || s_(s.thumbnail_url) : ''), propiedad: pre.propiedad || (String(convId).indexOf('inq:') === 0 ? nombrePropInq_(d.inquiry || d) : ''), tipo: pre.tipo,
    checkin: pre.checkin, checkout: pre.checkout, canal: pre.canal || canalPlat_(d.platform), ultimo_canal: 'hospitable',
    ultimo_texto: (s_(d.body) || (fotos.length ? '[foto]' : '')).slice(0, 300), ultimo_de: guest ? 'guest' : 'host', ultimo_ts: ts,
    ultimo_guest_ts: guest ? ts : '', ultimo_host_ts: guest ? '' : ts, _auto: auto, hosp_conv: s_(d.conversation_id)
  });
}
/* Mensajes que llegan por webhook: la API de Hospitable a veces tarda en devolverlos en el hilo. Se guardan 2 h y se
   mezclan con el hilo hasta que la API ya los trae; además se descarta el hilo en caché para que el Hub lo vea al instante. */
function cacheEntrante_(convId, d) {
  try {
    const texto = s_(d.body), fotos = adjuntos_(d.attachments); if (!convId || (!texto && !fotos.length)) return;
    const guest = String(d.sender_type || '').toLowerCase() === 'guest', c = CacheService.getScriptCache(), k = 'gin_' + convId;
    let L = []; try { L = JSON.parse(c.get(k) || '[]'); } catch (e) {}
    L.push({ tipo: guest ? 'guest' : 'host', texto: texto.slice(0, 3000), created: s_(d.created_at) || new Date().toISOString(), auto: !guest && s_(d.source) === 'automated', canal: 'hospitable', fotos: fotos });
    c.put(k, JSON.stringify(L.slice(-10)), 7200); c.removeAll(['hf_' + convId]);
  } catch (e) { console.error('cacheEntrante_: ' + e); }
}
/* Cada ~2 min re-lee de Hospitable las conversaciones que se movieron en las últimas 48 h (cubre mensajes que
   el equipo escribe directo en Hospitable si ese webhook no llega) y las de la cola/log sin fila en la bandeja. */
function sincronizarInbox_() {
  const props = PropertiesService.getScriptProperties();
  if (Date.now() - Number(props.getProperty('INBOX_SYNC') || 0) < 2 * 60000) return;
  props.setProperty('INBOX_SYNC', String(Date.now()));
  if (Date.now() - Number(props.getProperty('INQ_FIX') || 0) > 10 * 60000) { props.setProperty('INQ_FIX', String(Date.now())); try { repararConsultas(8); } catch (e) { console.error('repararConsultas: ' + e); } try { repararHilosConsultas(6); } catch (e) { console.error('repararHilosConsultas: ' + e); } }
  const sh = hojaInbox_(), n = sh.getLastRow(), limite = Date.now() - 48 * 3600000, ids = {};
  if (n >= 2) sh.getRange(2, 1, n - 1, INBOX_CAB_.length).getValues().forEach(v => { const t = new Date(v[10]).getTime(); if (t >= limite) ids[v[0]] = t; });
  [CFG.TAB_COLA, CFG.TAB_LOG].forEach(tab => {
    const s2 = hoja_(tab), m = s2.getLastRow(); if (m < 2) return;
    const cab = s2.getRange(1, 1, 1, s2.getLastColumn()).getValues()[0].map(x => String(x).trim());
    const c = cab.indexOf('reservation_id'); if (c < 0) return;
    const desde = Math.max(2, m - 150);
    s2.getRange(desde, c + 1, m - desde + 1, 1).getValues().forEach(v => { const id = s_(v[0]); if (id && ids[id] == null) ids[id] = 0; });
  });
  Object.keys(ids).sort((a, b) => ids[b] - ids[a]).slice(0, 15).forEach(id => {
    try {
      const hc = hiloConv_(id); if (hc.code !== 200) return;
      const hilo = hc.hilo; if (!hilo.length) return;
      /* Los automáticos no cuentan como actividad (no reabren ni reviven conversaciones). */
      const vis0 = hilo.filter(x => !(x.tipo !== 'guest' && x.auto)), vis = vis0.length ? vis0 : hilo;
      const ult = vis[vis.length - 1];
      const ug = hilo.filter(x => x.tipo === 'guest').pop(), uh = vis0.filter(x => x.tipo !== 'guest').pop();
      let pre = {}; try { pre = preContexto_(id); } catch (e) {}
      const waN = (hilo.filter(x => x.wa).pop() || {}).wa || '';
      inboxUpsert_(id, { codigo: pre.codigo, huesped: pre.huesped, foto: pre.foto, propiedad: pre.propiedad, tipo: pre.tipo, checkin: pre.checkin, checkout: pre.checkout, canal: pre.canal, wa: waN, ultimo_canal: hilo[hilo.length - 1].canal || 'hospitable',
        ultimo_texto: (ult.texto || (ult.fotos && ult.fotos.length ? '[foto]' : '')).slice(0, 300), ultimo_de: ult.tipo === 'guest' ? 'guest' : 'host', ultimo_ts: ult.created,
        ultimo_guest_ts: ug ? ug.created : '', ultimo_host_ts: uh ? uh.created : '', _forzar: true });
    } catch (e) { console.error('sync ' + id + ': ' + e); }
  });
}
/* Una vez: completa huésped, foto, propiedad y fechas de las consultas que entraron como "Propiedad sin nombre". */
function repararConsultas(max) {
  const sh = ssAlma_().getSheetByName('ALMA_INBOX'); if (!sh || sh.getLastRow() < 2) return 'sin bandeja';
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, INBOX_CAB_.length).getValues(); let n = 0, intentos = 0;
  v.reverse().forEach((row, i) => {
    const id = String(row[0]); if (id.indexOf('inq:') !== 0 || (row[4] && row[2] && row[6] && !/sin nombre|por confirmar/i.test(row[4]))) return;
    if (max && intentos >= max) return; intentos++;
    CacheService.getScriptCache().remove('pre2_' + id);
    const q = inquiryDatos_(id.slice(4)); if (!q) return;
    inboxUpsert_(id, { huesped: q.huesped, foto: q.foto, propiedad: q.propiedad, tipo: 'consulta', checkin: q.checkin, checkout: q.checkout, canal: q.canal }); n++;
  });
  return n + ' consultas completadas';
}
/* Hacia atrás (una vez desde el editor, y luego 6 por vuelta solas): por cada consulta de los últimos 30 días
   1) guarda su conversation_id · 2) si ya es reserva, la fusiona · 3) intenta traer mensajes que Hospitable adjunte a la
   consulta · 4) recalcula último mensaje, último del huésped y último nuestro con todo lo guardado (webhooks, cola, log y
   envíos). Así una consulta que ya respondimos deja de verse como «sin respuesta» / «necesita equipo». */
function repararHilosConsultas(max) {
  max = max || 200;
  const sh = ssAlma_().getSheetByName('ALMA_INBOX'); if (!sh || sh.getLastRow() < 2) return 'sin bandeja';
  const props = PropertiesService.getScriptProperties(), limite = Date.now() - 30 * 86400000, t0 = Date.now();
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, INBOX_CAB_.length).getValues()
    .filter(v => String(v[0]).indexOf('inq:') === 0 && tsMs_(v[10]) >= limite && !vGet_('inqrep3_' + String(v[0]).slice(4)))
    .sort((a, b) => tsMs_(b[10]) - tsMs_(a[10])).map(v => String(v[0]));
  let n = 0, conv = 0;
  for (let i = 0; i < ids.length && n < max && Date.now() - t0 < 240000; i++) {
    const id = ids[i], uid = id.slice(4); n++;
    try {
      const r = hosp_('get', '/inquiries/' + uid + '?include=guest,properties,messages');
      const d = r.code === 200 ? ((r.json && r.json.data) || {}) : {};
      const cid = s_(d.conversation_id || (d.conversation && d.conversation.id)) || uid;
      recordarConv_(cid, uid);
      if (reservaDeConsulta_(uid)) { conv++; vSet_('inqrep3_' + uid, '1'); continue; }
      const msgs = Array.isArray(d.messages) ? d.messages : (d.messages && d.messages.data) || [];
      if (msgs.length) {
        const loc = hiloInqLocal_(id), k = m => m.tipo + '|' + String(m.texto).slice(0, 80), vis = {}; loc.forEach(m => vis[k(m)] = 1);
        const shM = hojaCrear_('ALMA_MSG_INQ', MSG_INQ_CAB_);
        normalizarHilo_({ data: msgs }).filter(m => !vis[k(m)] && s_(m.texto)).forEach(m => shM.appendRow([id, m.created, m.tipo === 'guest' ? 'guest' : 'host', m.auto ? 'si' : '', String(m.texto).slice(0, 5000), (m.fotos || []).join(' '), 'backfill']));
      }
      const hilo = hiloInqLocal_(id);
      if (hilo.length) {
        const vis0 = hilo.filter(x => !(x.tipo !== 'guest' && x.auto)), ult = (vis0.length ? vis0 : hilo).slice(-1)[0];
        const ug = hilo.filter(x => x.tipo === 'guest').pop(), uh = vis0.filter(x => x.tipo !== 'guest').pop();
        inboxUpsert_(id, { hosp_conv: cid, ultimo_texto: String(ult.texto || '').slice(0, 300), ultimo_de: ult.tipo === 'guest' ? 'guest' : 'host', ultimo_ts: ult.created,
          ultimo_guest_ts: ug ? ug.created : '', ultimo_host_ts: uh ? uh.created : '', _forzar: true });
      }
      try { CacheService.getScriptCache().removeAll(['hf_' + id, 'hr_' + id]); } catch (e) {}
      vSet_('inqrep3_' + uid, '1');
    } catch (e) { console.error('repararHilosConsultas ' + id + ': ' + e); }
  }
  return n + ' consultas revisadas · ' + conv + ' ya eran reserva y se fusionaron · ' + Math.max(0, ids.length - n) + ' quedan para la siguiente vuelta';
}
/* Última actividad de una fila de la bandeja, contando también los automáticos de Hospitable. */
function actividadInbox_(o) { return Math.max(new Date(o.ultimo_ts).getTime() || 0, new Date(o.ultimo_auto_ts).getTime() || 0); }
function hubInbox_() {
  const sh = ssAlma_().getSheetByName('ALMA_INBOX'); if (!sh || sh.getLastRow() < 2) return [];
  /* Los chats de WhatsApp de administradores viven en el chat operativo, no en la lista de huéspedes. */
  let admTel = {}; try { adminsOp_().forEach(a => a.tels.forEach(t => { if (fin8_(t)) admTel[fin8_(t)] = 1; })); if (CFG.WHATSAPP_JUAN) admTel[fin8_(CFG.WHATSAPP_JUAN)] = 1; } catch (e) {}
  const prueba = String(PropertiesService.getScriptProperties().getProperty('WA_PRUEBA') || '').split(/[,;\s]+/).filter(Boolean).map(fin8_);
  prueba.forEach(k => delete admTel[k]);
  return sh.getRange(2, 1, sh.getLastRow() - 1, INBOX_CAB_.length).getValues()
    .map(v => { const o = {}; INBOX_CAB_.forEach((k, i) => o[k] = v[i] instanceof Date ? v[i].toISOString() : String(v[i])); return o; })
    .filter(o => !(String(o.conv_id).indexOf('wa:') === 0 && admTel[fin8_(String(o.conv_id).slice(3))]))
    .sort((a, b) => actividadInbox_(b) - actividadInbox_(a)).slice(0, 250)
    .map(o => { if (String(o.conv_id).indexOf('wa:') !== 0) return o; let f = null; try { f = contactoFicha_(o.conv_id.slice(3)); } catch (e) {} if (f) { o.contacto_tipo = f.tipo; o.contacto_estado = f.estado; o.contacto_rol = f.rol; o.contacto_empresa = f.empresa; if (f.nombre) { if (o.huesped && o.huesped !== f.nombre) o.wa_nombre = o.huesped; o.huesped = f.nombre; } }   /* el nombre que le pusimos manda sobre el de su perfil de WhatsApp */ return o; });   // ficha del contacto (contactos.js)
}

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.state && (q.code || q.error)) return spotifyVuelta_(q);   // Spotify vuelve después de autorizar (musica.js)
  if (q['hub.mode'] === 'subscribe') {
    const v = PropertiesService.getScriptProperties().getProperty('WA_VERIFY_TOKEN') || 'spacioam-alma';
    return ContentService.createTextOutput(q['hub.verify_token'] === v ? String(q['hub.challenge'] || '') : 'token incorrecto');
  }
  return ok_('ALMA activo');
}

/* El disparador de cada minuto puede tardar hasta 60 s en pasar. Tras cada webhook se programa
   una pasada puntual justo cuando vence la ventana de agrupación, para no esperar al reloj. */
/* Ventana de agrupación según el mensaje: una pregunta completa o un mensaje largo no espera más fragmentos (15 s);
   un "hola" o un fragmento corto sin cierre sí espera la ventana normal, porque casi siempre viene más. */
function agruparSeg_(texto) {
  const t = String(texto || '').trim(), base = cfg_('AGRUPAR_SEG');
  if (/[?？]\s*$/.test(t) || t.length >= 70 || /\[el huésped envió una imagen\]/.test(t) && t.length > 40) return Math.min(base, 8);
  return base;
}
function programarPronto_(texto) {
  try {
    const ya = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'procesarColaPronto');
    if (ya) return;
    ScriptApp.newTrigger('procesarColaPronto').timeBased().after(agruparSeg_(texto) * 1000 + 2000).create();
  } catch (e) { console.error('programarPronto_: ' + e); }
}
function procesarColaPronto() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'procesarColaPronto').forEach(t => ScriptApp.deleteTrigger(t));
  procesarColaNucleo_();   // solo la cola: el mantenimiento lo hace el disparador de cada minuto
}

/* ═══════════════════════════════ 2. COLA (cada minuto) ═══════════════════════════════ */

/* Cada minuto: primero la cola (lo que ve el huésped), después el mantenimiento. Antes el mantenimiento iba primero
   (Hospitable, ElevenLabs, Epi — que tarda hasta 35 s) y retrasaba cada clasificación hasta 1-2 minutos. */
/* Pulso: procesarCola corre cada minuto; si deja de correr (script caído, disparador borrado, cuota), el Hub y el vigía lo notan. */
function pulso_() { try { PropertiesService.getScriptProperties().setProperty('PULSO', String(Date.now())); } catch (e) {} }
function saludAlma_() {
  const t = Number(PropertiesService.getScriptProperties().getProperty('PULSO') || 0), min = t ? Math.round((Date.now() - t) / 60000) : -1;
  return { ok: true, pulso: t ? new Date(t).toISOString() : '', pulso_min: min, sano: t > 0 && min <= 5 };
}
function procesarCola() {
  pulso_();
  try { enviarPropios_(); } catch (e) { console.error('enviarPropios_: ' + e); }
  try { procesarColaNucleo_(); } catch (e) { console.error('procesarColaNucleo_: ' + e); }
  try { opWaProcesar_(); } catch (e) { console.error('opWaProcesar_: ' + e); }   // respaldo si el disparador de 20 s no corrió
  try { recepcionProcesar_(); } catch (e) { console.error('recepcionProcesar_: ' + e); }
  try { progProcesar_(); } catch (e) { console.error('progProcesar_: ' + e); }
  try { earlyRevisar_(); } catch (e) { console.error('earlyRevisar_: ' + e); }   // early check-in: revisión de las 21:15 (early.js)
  try { vozSecProcesar_(); } catch (e) { console.error('vozSecProcesar_: ' + e); }   // pedidos de llamada en segundo plano (respaldo del disparador)
  try { pendProcesar_(); } catch (e) { console.error('pendProcesar_: ' + e); }
  try { confAudioProcesar_(); } catch (e) { console.error('confAudioProcesar_: ' + e); }   // modo conferencia: Scribe con voces (conferencia.js)
  try { confCerrarViejas_(); } catch (e) { console.error('confCerrarViejas_: ' + e); }   // modo conferencia: cierra las que quedaron abiertas (conferencia.js)   // lo que Alma resolvió → Pendientes (pendientes.js)
  try { fotoProcesar_(); } catch (e) { console.error('fotoProcesar_: ' + e); }
  try { sincronizarInbox_(); } catch (e) { console.error('sincronizarInbox_: ' + e); }
  try { revisarSinRespuesta_(); } catch (e) { console.error('revisarSinRespuesta_: ' + e); }
  try { vozRecoger_(false); } catch (e) { console.error('vozRecoger_: ' + e); }
  try { promesasRevisar_(); } catch (e) { console.error('promesasRevisar_: ' + e); }
  try { archivoSiToca_(); } catch (e) { console.error('archivoSiToca_: ' + e); }
  try { hubDespuesProcesar_(); } catch (e) { console.error('hubDespuesProcesar_: ' + e); }   // registro de envíos del hub (envio.js)
  try { vozSyncSiToca_(); } catch (e) { console.error('vozSyncSiToca_: ' + e); }   // ALMA voz: mismo prompt vivo (voz.js)
  try { contactosProcesar_(); } catch (e) { console.error('contactosProcesar_: ' + e); }   // fichas de proveedores, técnicos y socios (contactos.js)
  try { contactosConocidosSiToca_(); } catch (e) { console.error('contactosConocidosSiToca_: ' + e); }   // equipo y recepciones con el nombre que les pusimos
  try { usoMensualSiToca_(); } catch (e) { console.error('usoMensualSiToca_: ' + e); }   // reporte de consumo de IA el día 1 (usomensual.js)
  try { epiSnapSiToca_(); } catch (e) { console.error('epiSnapSiToca_: ' + e); }   // lo más lento, al final
}
function procesarColaNucleo_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ALMA_ACTIVO') !== '1') { limpiezaDiaria_(); return; }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  const inicio = Date.now();
  try {
    const sh = hoja_(CFG.TAB_COLA);
    const ultima = sh.getLastRow();
    if (ultima < 2) { props.setProperty('ALMA_ACTIVO', '0'); return; }
    const primera = Math.max(2, ultima - 499);
    const filas = sh.getRange(primera, 1, ultima - primera + 1, COLA_HEADERS.length).getValues()
      .map((v, i) => ({ fila: primera + i, v: v }));
    const ahora = ahora_();
    const ctrl = leerControl_();
    let trabajos = 0;

    // a) Envíos AUTO cuyo delay ya venció
    filas.filter(f => f.v[C.estado] === 'esperando_envio' && vence_(f, ahora)).forEach(f => {
      if (trabajos++ < CFG.MAX_TURNOS_POR_MINUTO) protegido_(sh, f, () => enviarPendiente_(sh, f, ctrl, filas));
    });

    // b) ROJO: ¿alguien del equipo respondió tras la contención?
    filas.filter(f => f.v[C.estado] === 'esperando_rojo' && vence_(f, ahora)).forEach(f => {
      if (trabajos++ < CFG.MAX_TURNOS_POR_MINUTO) protegido_(sh, f, () => verificarRojo_(sh, f));
    });
    // b2) Código de acceso pendiente: ¿ya se envió?
    filas.filter(f => f.v[C.estado] === 'esperando_codigo' && vence_(f, ahora)).forEach(f => {
      if (trabajos++ < CFG.MAX_TURNOS_POR_MINUTO) protegido_(sh, f, () => verificarCodigo_(sh, f));
    });

    // c) Turnos nuevos: agrupar por reserva y procesar cuando el huésped deja de escribir
    const grupos = {};
    filas.filter(f => f.v[C.estado] === 'pendiente').forEach(f => {
      const k = f.v[C.reservation_id] || f.v[C.conversation_id] || ('guest_' + String(f.v[C.huesped] || f.fila).toLowerCase());
      (grupos[k] = grupos[k] || []).push(f);
    });
    Object.keys(grupos).forEach(k => {
      const g = grupos[k];
      const lider = g[g.length - 1];
      const ultimoRecibido = Math.max.apply(null, g.map(f => new Date(f.v[C.recibido]).getTime()));
      if (ahora.getTime() - ultimoRecibido < agruparSeg_(s_(lider.v[C.texto])) * 1000) return;
      if (!vence_(lider, ahora)) return;
      if (trabajos++ >= CFG.MAX_TURNOS_POR_MINUTO) return;
      protegido_(sh, lider, () => procesarTurno_(sh, g, ctrl, ahora));
      if (lider.v[C.estado] === 'error') {   // que el resto de la ráfaga no se reprocese en bucle
        g.slice(0, -1).forEach(f => set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila }));
      }
    });

    // d) Lo que vence en menos de 40 s sale en esta misma pasada: no espera al siguiente disparador (que puede tardar 1–2 min).
    try {
      const n2 = sh.getLastRow(), f2 = sh.getRange(primera, 1, n2 - primera + 1, COLA_HEADERS.length).getValues().map((v, i) => ({ fila: primera + i, v: v }));
      const pronto = f2.filter(f => f.v[C.estado] === 'esperando_envio' && f.v[C.proximo] && new Date(f.v[C.proximo]).getTime() - Date.now() < 40000);
      if (pronto.length && Date.now() - inicio < 200000) {
        const espera = Math.max(0, Math.min.apply(null, pronto.map(f => new Date(f.v[C.proximo]).getTime())) - Date.now());
        if (espera) Utilities.sleep(Math.min(espera, 40000));
        const ya = ahora_();
        pronto.forEach(f => { const v = sh.getRange(f.fila, 1, 1, COLA_HEADERS.length).getValues()[0], g = { fila: f.fila, v: v };
          if (v[C.estado] === 'esperando_envio' && vence_(g, ya)) protegido_(sh, g, () => enviarPendiente_(sh, g, ctrl, f2)); });
      }
    } catch (e) { console.error('envío en la misma pasada: ' + e); }

    // ¿Queda algo vivo? Si no, el disparador vuelve a salir en milisegundos.
    const vivos = sh.getRange(primera, C.estado + 1, ultima - primera + 1, 1).getValues()
      .some(r => FINALES.indexOf(r[0]) === -1);
    const postReciente = Number(props.getProperty('ULTIMO_POST') || 0) >= inicio;
    if (!vivos && !postReciente) props.setProperty('ALMA_ACTIVO', '0');
  } finally {
    lock.releaseLock();
  }
}

function procesarTurno_(sh, grupo, ctrl, ahora) {
  const lider = grupo[grupo.length - 1];
  USO_REF_ = s_(lider.v[C.reservation_id] || lider.v[C.conversation_id]); USO_DET_ = s_(lider.v[C.huesped]);
  const otros = grupo.slice(0, -1);
  const pKey = s_(lider.v[C.reservation_id] || lider.v[C.conversation_id]);
  const marcarTodos = (estado, nota) => {
    paso_(pKey, ({ silencio: 'Sin respuesta necesaria', omitido: 'Nada que responder' }[estado] || 'Listo') + (nota ? ' · ' + nota : ''), true);
    set_(sh, lider, { estado: estado, nota: nota });
    otros.forEach(f => set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila }));
  };
  const resId = lider.v[C.reservation_id];

  if (ctrl.toggle !== 'ON') return marcarTodos('omitido', 'TOGGLE OFF');
  pasoIni_(pKey); paso_(pKey, grupo.length > 1 ? 'Juntando los ' + grupo.length + ' mensajes del huésped' : 'Mensaje nuevo del huésped');

  // Si ya había una respuesta esperando para esta misma reserva, se retira: este turno la incluye.
  const prevKey = resId || lider.v[C.conversation_id];
  if (prevKey) {
    const ultima = sh.getLastRow();
    const todas = sh.getRange(2, 1, ultima - 1, COLA_HEADERS.length).getValues();
    todas.forEach((v, i) => {
      if (v[C.estado] !== 'esperando_envio') return;
      if ((v[C.reservation_id] || v[C.conversation_id]) !== prevKey) return;
      set_(sh, { fila: i + 2, v: v }, { estado: 'omitido', nota: 'llegó otro mensaje; se responde junto en el siguiente turno' });
    });
  }

  if (!resId) {
    const convInq = String(lider.v[C.conversation_id] || '');
    let r = null;
    paso_(pKey, 'Consulta sin reserva · revisando disponibilidad y preparando la respuesta');
    try { r = convInq ? inquiryResponder_(convInq, grupo.map(f => s_(f.v[C.texto])).join('\n'), s_(lider.v[C.huesped]), ctrl, new Date(grupo[0].v[C.recibido]).getTime()) : null; } catch (e) { console.error('inquiryResponder_: ' + e); }
    if (r && r.esperar) return set_(sh, lider, { proximo: new Date(ahora.getTime() + 60000).toISOString(), nota: r.nota });
    marcarTodos(r && r.estado ? r.estado : 'omitido', r ? r.nota : 'inquiry sin conversación');
    return log_({ resId: convInq, huesped: s_(lider.v[C.huesped]) || (r && r.huesped) || '', propiedad: (r && r.propiedad) || '', nivel: r && r.nivel ? r.nivel : 'INQUIRY',
      razon: r ? r.razon : 'Consulta sin reserva', texto: grupo.map(f => f.v[C.texto]).join('\n'), modo: ctrl.modo }, r ? r.texto : '', r ? r.accion : 'revisar manualmente');
  }

  const esPrueba = !!ctrl.soloReserva && String(resId).toUpperCase() === ctrl.soloReserva;
  if (ctrl.modo !== 'SOMBRA' && ctrl.horario && !ctrl.soloReserva && !enVentana_(ahora)) return marcarTodos('omitido', 'fuera de ventana');

  // Hilo real desde Hospitable (fuente de verdad, no el payload)
  const hiloRes = hiloConv_(resId);   // Hospitable + WhatsApp, en orden
  if (hiloRes.code !== 200) return reintentar_(sh, lider, 'hilo HTTP ' + hiloRes.code);
  const hilo = hiloRes.hilo;
  if (!hilo.length) return reintentar_(sh, lider, 'hilo vacío');
  paso_(pKey, 'Leyendo la conversación · ' + hilo.length + ' mensajes' + (hilo.some(m => m.canal === 'whatsapp' || /^wa/.test(String(m.id || ''))) ? ' (plataforma y WhatsApp)' : ''));

  const ultimo = hilo[hilo.length - 1];
  // Un mensaje automático que cae justo después NO cuenta como respuesta, salvo que entregue lo que el huésped pidió.
  const pendT = turnoPendiente_(hilo);
  if (!pendT.pendiente) return marcarTodos('omitido', pendT.turno.length ? 'el automático ya entregó lo que pidió' : 'el equipo ya respondió');

  const salientes = hilo.filter(m => m.tipo !== 'guest');
  const primerRecibido = new Date(grupo[0].v[C.recibido]).getTime();
  if (!salientes.length && String(resId).indexOf('wa:') !== 0 && ahora.getTime() - primerRecibido < cfg_('ESPERA_SIN_SALIENTE_SEG') * 1000) {
    return set_(sh, lider, { proximo: new Date(ahora.getTime() + 60000).toISOString(), nota: 'esperando primer automático' });
  }

  const ctx = contexto_(resId, hilo, ctrl.modo);
  if (!ctx) return reintentar_(sh, lider, 'reserva no disponible');
  paso_(pKey, 'Reserva y ficha de la propiedad' + (ctx.propiedad ? ' · ' + ctx.propiedad : '') + (ctx.codigo ? ' · ' + ctx.codigo : ''));
  if (!ctx.fotos.length) ctx.fotos = [].concat.apply([], grupo.map(f => { try { return JSON.parse(f.v[C.datos] || '{}').fotos || []; } catch (e) { return []; } }));
  if (ctrl.soloReserva) {   // modo prueba: solo la reserva elegida usa el modo real
    const coincide = esPrueba || String(ctx.codigo).toUpperCase() === ctrl.soloReserva;
    if (!coincide) ctx.modo = 'SOMBRA';
  }

  const au = autoConv_(resId);
  if (au.estado === 'off') {
    ctx.nivel = 'SILENCIO'; ctx.razon = 'respuestas automáticas desactivadas a mano en esta conversación' + (au.por ? ' (' + au.por + ')' : '');
    marcarTodos('silencio', 'auto desactivado en la conversación');
    observar_(ctx, '');
    return log_(ctx, '', 'sin respuesta: auto desactivado en esta conversación');
  }
  if (au.estado === 'on' && ctx.equipoActivo) {   // activada a mano DESPUÉS del último mensaje del equipo: ALMA retoma
    const ultEq = hilo.filter(m => m.tipo !== 'guest' && !m.auto).map(m => m.created).pop() || '';
    if (au.ts && au.ts > ultEq) ctx.equipoActivo = false;
  }
  if (ctx.equipoActivo) {
    ctx.nivel = 'SILENCIO'; ctx.razon = 'el equipo respondió hace menos de ' + cfg_('MIN_EQUIPO_ACTIVO') + ' min y está gestionando';
    marcarTodos('silencio', 'equipo gestionando');
    observar_(ctx, '');
    return log_(ctx, '', 'sin respuesta: el equipo está gestionando');
  }

  if (codigoPendiente_(ctx, hilo)) { paso_(pKey, 'Código de acceso pendiente · avisando a los administradores', true); return manejarCodigo_(sh, lider, otros, ctx); }

  /* Avance visible en el Hub (columna nota, prefijo ⏳): qué está haciendo ALMA mientras piensa. */
  const avance = t => { try { set_(sh, lider, { nota: '⏳ ' + t }); SpreadsheetApp.flush(); } catch (e) {} };
  avance('Leyendo la conversación y decidiendo cómo responder');
  paso_(pKey, 'Entendiendo qué necesita el huésped');
  const cls = clasificar_(ctx);
  paso_(pKey, (PASO_NIVEL_[cls.nivel] || cls.nivel) + (cls.razon ? ' · ' + String(cls.razon).slice(0, 150) : ''));
  ctx.nivel = cls.nivel; ctx.razon = cls.razon; ctx.acceso = !!cls.acceso;
  if (cls.nivel !== 'SILENCIO' && cls.nivel !== 'ROJO') avance(cls.nivel + ' · ' + String(cls.razon || '').slice(0, 160) + ' · redactando la respuesta');
  ctx.escalar = !!cls.escalar; ctx.motivoEscalar = cls.motivoEscalar || '';
  /* Despedida: regla fija. Aunque el clasificador lo vea como acuse, ALMA se despide. */
  try { ctx.despedida = despedida_(ctx, hilo); } catch (e) { ctx.despedida = false; }
  if (ctx.despedida) {
    if (ctx.nivel === 'SILENCIO') { ctx.nivel = 'VERDE'; ctx.razon = 'el huésped se despide · ALMA se despide con calidez'; }
    ctx.instrucciones = (ctx.instrucciones || '') + INSTR_DESPEDIDA_;
  }
  if (ctx.nivel !== 'SILENCIO') { try { reporteDanoEpi_(ctx); } catch (e) { console.warn('reporte de daño: ' + e); } }

  if (ctx.nivel === 'SILENCIO') {
    marcarTodos('silencio', cls.razon);
    return log_(ctx, '', 'sin respuesta (acuse)');
  }

  /* No puede entrar al formulario de Hola: se sincroniza Hola y se le avisa (holaacceso.js). */
  if (holaAccesoAplica_(ctx)) { try { if (holaAccesoResolver_(ctx, pKey)) { otros.forEach(f => set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila })); return set_(sh, lider, { estado: 'respondido', nota: 'acceso a Hola: sincronizado' }); } } catch (e) { console.error('holaAcceso: ' + e); } }

  if (ctx.nivel === 'ROJO') { paso_(pKey, 'Urgente · conteniendo al huésped y avisando al equipo', true); return manejarRojo_(sh, lider, otros, ctx); }

  paso_(pKey, 'Redactando la respuesta con la ficha y el historial');
  let red = redactarVerificado_(ctx);
  if (red && red.texto && !red.silencio) paso_(pKey, red.ok ? 'Revisé la respuesta: datos, tono y reglas en orden' : 'Control de calidad: ' + String(red.problema || 'revisar').slice(0, 140));
  if (red && red.texto && !red.silencio) avance('Respuesta lista · ' + ctx.nivel + ' · ' + String(red.texto).replace(/\s+/g, ' ').slice(0, 220));
  if (red.silencio && ctx.despedida) {
    const t2 = redactar_(ctx, 'El huésped se está despidiendo. Está PROHIBIDO devolver SIN_RESPUESTA: escribe la despedida cálida y breve, lista para enviar.');
    red = textoEnviable_(t2) ? { texto: t2, ok: true } : red;
  }
  if (ctx.factura) registrarFactura_(ctx);
  if (red.silencio) {
    marcarTodos('silencio', 'nada nuevo que agregar');
    return log_(ctx, '', 'sin respuesta: nada nuevo que agregar');
  }
  const borrador = red.texto;
  if (!borrador) return reintentar_(sh, lider, 'redactor sin respuesta');
  if (red.problema) ctx.razon += ' · QA: ' + red.problema;

  // AUTO nunca envía un borrador que no pasó el control de calidad: lo manda a Juan.
  if (ctx.modo === 'AUTO' && !red.ok) {
    notificar_(CFG.WHATSAPP_JUAN, 'ALMA · borrador retenido (' + ctx.nivel + ') · ' + ctx.propiedad,
      'No se envió automáticamente porque no pasó el control de calidad: ' + red.problema +
      '\n\nHuésped: ' + ctx.huesped + '\nCódigo: ' + ctx.codigo + '\n\nPregunta:\n' + ctx.texto + '\n\nBorrador:\n' + borrador);
    marcarTodos('borrador', ctx.nivel + ' · retenido por QA');
    return log_(ctx, borrador, 'RETENIDO por QA (no enviado): ' + red.problema);
  }

  if (ctx.modo === 'AUTO') {
    /* La espera "humana" cuenta desde el último mensaje del huésped (no desde que ALMA terminó): lo que ya tardó agrupar,
       clasificar y redactar se descuenta. Respuestas cortas salen antes que las largas, con un poco de variación. */
    const ultG = Math.max.apply(null, grupo.map(f => new Date(f.v[C.recibido]).getTime()));
    const objetivo = Math.min(cfg_('DELAY_MAX_SEG'), cfg_('DELAY_MIN_SEG') + Math.round(String(borrador).length / 30)) + Math.floor(Math.random() * 8);
    const delay = Math.max(2, objetivo - Math.round((Date.now() - ultG) / 1000));
    paso_(pKey, 'Respuesta lista · se envía en ' + delay + ' s', true);
    otros.forEach(f => set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila }));
    return set_(sh, lider, {
      estado: 'esperando_envio', proximo: new Date(ahora.getTime() + delay * 1000).toISOString(),
      nota: ctx.nivel + ' · envío en ' + delay + 's', datos: JSON.stringify(compacto_(ctx, { borrador: borrador }))
    });
  }

  if (ctx.modo !== 'AUTO') paso_(pKey, 'Borrador listo para que el equipo lo revise', true);
  if (ctx.modo === 'BORRADOR') {
    notificar_(CFG.WHATSAPP_JUAN, 'ALMA · borrador (' + ctx.nivel + ') · ' + ctx.propiedad,
      'Huésped: ' + ctx.huesped + '\nPropiedad: ' + ctx.propiedad + '\nCódigo: ' + ctx.codigo +
      '\n\nPregunta:\n' + ctx.texto + '\n\nBorrador:\n' + borrador);
    marcarTodos('borrador', ctx.nivel);
    observar_(ctx, borrador); avisarSeguimiento_(ctx);
    return log_(ctx, borrador, 'borrador enviado a Juan');
  }

  marcarTodos('sombra', ctx.nivel);
  observar_(ctx, borrador);
  return log_(ctx, borrador, 'SOMBRA: no enviado');
}

function enviarPendiente_(sh, f, ctrl, filas) {
  const d = JSON.parse(f.v[C.datos] || '{}');
  const sigueAuto = ctrl.modo === 'AUTO' && (!ctrl.soloReserva || [String(d.resId).toUpperCase(), String(d.codigo).toUpperCase()].indexOf(ctrl.soloReserva) !== -1);
  if (ctrl.toggle !== 'ON' || !sigueAuto) {
    set_(sh, f, { estado: 'omitido', nota: 'cambió a ' + ctrl.toggle + '/' + ctrl.modo + ' antes de enviar' });
    return log_(d, d.borrador, 'cancelado: cambio de modo');
  }
  // Si el huésped escribió algo nuevo, el turno nuevo (que ya lo incluye todo) se encarga
  const nuevo = filas.some(x => x.fila > f.fila && x.v[C.reservation_id] === d.resId && x.v[C.estado] === 'pendiente');
  if (nuevo) return set_(sh, f, { estado: 'omitido', nota: 'llegó otro mensaje; se responde en el siguiente turno' });

  const r = hiloConv_(d.resId);
  if (r.code !== 200) return reintentar_(sh, f, 'verificación HTTP ' + r.code, 'esperando_envio');
  const hilo = r.hilo;
  // Un automático que cayó mientras esperaba no cambia el turno: solo cuenta si ya entregó lo que el huésped pidió.
  const tpE = turnoPendiente_(hilo), ultG = tpE.turno[tpE.turno.length - 1];
  if (!tpE.pendiente || !ultG || ultG.created !== d.ultimoGuestAt) {
    set_(sh, f, { estado: 'omitido', nota: 'el hilo cambió (respondió el equipo o mensaje nuevo)' });
    observar_(d, d.borrador);
    return log_(d, d.borrador, 'no enviado: el hilo cambió');
  }
  if (!textoEnviable_(limpiarSalida_(d.borrador).texto)) {
    set_(sh, f, { estado: 'silencio', nota: 'bloqueado: el borrador era un marcador interno' });
    return log_(d, '', 'no enviado: marcador interno bloqueado');
  }
  const env = enviarCanal_(d, d.borrador);
  if (env.code < 200 || env.code >= 300) return reintentar_(sh, f, 'envío ' + (d.canal === 'whatsapp' ? 'WhatsApp ' + (env.error || env.code) : 'HTTP ' + env.code), 'esperando_envio');
  set_(sh, f, { estado: 'respondido', nota: d.nivel + ' · enviado' });
  log_(d, d.borrador, 'ENVIADO al huésped' + (d.seguimiento ? ' · seguimiento avisado' : ''));
  avisarSeguimiento_(d);
  try { earlyRegistrar_(d); } catch (e) { console.error('earlyRegistrar_: ' + e); }   // solo si el mensaje sí salió
}

function manejarRojo_(sh, lider, otros, ctx) {
  otros.forEach(f => set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila }));
  const alerta = '🔴 ALMA ROJO\nHuésped: ' + ctx.huesped + '\nPropiedad: ' + ctx.propiedad +
    (ctx.apartamento ? ' (' + ctx.apartamento + ')' : '') + '\nCódigo: ' + ctx.codigo +
    '\nMotivo: ' + ctx.razon + '\n\nMensaje:\n' + ctx.texto;

  if (ctx.modo === 'SOMBRA') {
    set_(sh, lider, { estado: 'sombra', nota: 'ROJO' });
    return log_(ctx, '[ROJO — habría enviado contención, alertado a ' + CFG.WHATSAPP_NOCTURNO + ' y pausado First Morning/Review]', 'SOMBRA: no enviado');
  }
  if (ctx.contencionReciente) {          // ya le escribimos: no repetir; solo avisar al equipo
    avisarRojo_(ctx, '🔴 ALMA ROJO · seguimiento · ' + ctx.propiedad, 'El huésped sigue escribiendo tras la contención.\n\n' + alerta, true);
    set_(sh, lider, { estado: 'escalado', nota: 'ROJO · contención ya enviada, solo alerta' });
    return log_(ctx, '', 'ROJO: ya había contención · solo alerta al equipo');
  }
  if (ctx.modo === 'BORRADOR') {          // en BORRADOR nunca se escribe al huésped
    avisarRojo_(ctx, '🔴 ALMA ROJO · ' + ctx.propiedad, alerta);
    set_(sh, lider, { estado: 'escalado', nota: 'ROJO · solo alerta' });
    return log_(ctx, '', 'alerta ROJO al equipo (sin mensaje al huésped)');
  }

  // AUTO
  const emergencia = aplicaEmergencia_(ctx);
  // Primera interacción: si es portería o falta el formulario, pedimos el registro de llegada (el código de
  // emergencia, si aplica, queda programado y sale solo si el problema persiste sin respuesta del equipo).
  const accesoForm = !!ctx.acceso && (ctx.acceso === 'edificio' || ctx.formStatus !== 'completo');
  /* Una sola contención por incidente: si ya se mandó una hace poco, no se repite (el equipo ya fue avisado). */
  const contencion = accesoForm ? contencionAcceso_(ctx) : ctx.contencionReciente ? '' : contencion_(ctx.idioma, ctx.ultimosNuestros, ctx.hiloTexto);
  const env = contencion ? enviarCanal_(ctx, contencion) : { code: 204 };
  avisarRojo_(ctx, '🔴 ALMA ROJO · ' + ctx.propiedad, alerta + (accesoForm ? '\n\n⚠️ Acceso al ' + (ctx.acceso === 'edificio' ? 'EDIFICIO' : 'apartamento') + ' · registro de llegada: ' + ctx.formStatus.toUpperCase() + '. ALMA pidió el formulario primero' + (emergencia ? '; si nadie responde en ' + cfg_('EMERGENCIA_MIN') + ' min enviará el código de emergencia.' : '. Problema de portería: NO enviará código; si el edificio no tiene la reserva notificada, avísales tú.') : ''));
  const cancelados = pausarProgramados_(ctx.resId);
  const esperaSeg = emergencia ? Math.min(cfg_('ESPERA_ROJO_SEG'), cfg_('EMERGENCIA_MIN') * 60) : cfg_('ESPERA_ROJO_SEG');
  set_(sh, lider, {
    estado: 'esperando_rojo', proximo: new Date(ahora_().getTime() + esperaSeg * 1000).toISOString(),
    nota: 'ROJO · contención ' + (env.code < 300 ? 'enviada' : 'FALLÓ ' + env.code) + (emergencia ? ' · acceso: código de emergencia en ' + cfg_('EMERGENCIA_MIN') + ' min' : ''),
    datos: JSON.stringify(compacto_(ctx, { contencionAt: new Date().toISOString(), borrador: contencion, acceso: emergencia, accesoTipo: ctx.acceso || null, formStatus: ctx.formStatus, idioma: ctx.idioma }))
  });
  log_(ctx, contencion, 'ROJO: ' + (accesoForm ? 'acceso ' + ctx.acceso + ' · formulario ' + ctx.formStatus + ' → pidió registro de llegada' : 'contención') + ' + alerta' + (cancelados ? ' · pausados: ' + cancelados : ''));
}

/* El código de emergencia abre la puerta del APARTAMENTO. Aplica si el problema es esa puerta, la reserva está
   confirmada y la estadía está activa. El formulario NO es requisito para el código: si está pendiente, la primera
   contención lo pide, y si el problema persiste y nadie responde, el código se envía igual (ver esperarRojo_). */
function aplicaEmergencia_(ctx) {
  if (ctx.acceso !== 'apartamento' || !ctx.reservaConfirmada || !ctx.checkin) return false;
  return ctx.hoy >= ctx.checkin && (!ctx.checkout || ctx.hoy <= ctx.checkout);
}
/* Primera contención: portería o formulario pendiente → pedir el registro de llegada antes que nada. */
function contencionAcceso_(ctx) {
  const l = String(ctx.idioma || '').slice(0, 2).toUpperCase();
  const k = (ctx.formStatus !== 'completo') ? 'ACCESO_FORM_' : 'ACCESO_EDIFICIO_';
  return prompt_(k + (['ES', 'EN'].indexOf(l) !== -1 ? l : 'EN')).replace(/\{\{\s*CODIGO_RESERVA\s*\}\}/g, ctx.codigo || '');
}
/* Códigos del equipo de limpieza (EPI · Config → "codigos"): { "yyyy-MM-dd": { "z10 airali 1508": "123456" }, __cfg: { prop: { mode: "permanent", permCode } } }
   Las claves de fecha son el inicio de cada ventana de 14 días. Se usa la ventana que cubre HOY (o el check-in si es posterior). */
function codigoEmergencia_(propiedad, checkin) {
  /* Misma regla que Epi (codigos.js): permanente, o el de la quincena vigente. Ya no devuelve un código de una quincena
     vieja cuando falta el actual: ese código ya no abre y el huésped quedaría afuera con un dato equivocado. */
  try {
    const hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');
    const ref = checkin && checkin > hoy ? checkin : hoy;
    const r = codigoEquipo_(propiedad, ref);
    if (!r || !r.codigo) return null;
    return { codigo: r.codigo, origen: r.tipo === 'permanente' ? 'código permanente' : r.tipo === 'quincena' ? 'quincena ' + r.vigente : r.tipo };
  } catch (e) { console.error('codigoEmergencia_: ' + e); return null; }
}
function mensajeEmergencia_(idioma, codigo) {
  const l = String(idioma || '').slice(0, 2).toUpperCase();
  const tpl = prompt_('EMERGENCIA_' + (['ES', 'EN'].indexOf(l) !== -1 ? l : 'EN'));
  return tpl.replace(/\{\{\s*CODIGO\s*\}\}/g, codigo);
}

/* ── CÓDIGO DE ACCESO PENDIENTE ──
   Reserva confirmada, día de llegada o estadía activa, el huésped pide el código (o dice que no le llegó) y en el
   hilo no consta que se haya enviado → alerta a ambos administradores (principal y secundario), contención breve
   y revisión a los CODIGO_REVISION_MIN. Si para entonces sigue sin enviarse, sale el código de emergencia. */
const RX_PIDE_CODIGO_ = /(c[oó]digo|clave|contrase[nñ]a|\bpin\b|\bcode\b|passcode|keypad|cerradura|\block\b)/i;
const RX_CODIGO_ENVIADO_ = /(c[oó]digo|clave|contrase[nñ]a|\bpin\b|\bcode\b|passcode)[^\d\n]{0,48}\d{4,8}\b/i;
function codigoEnviadoEnHilo_(hilo) { return (hilo || []).some(m => m.tipo !== 'guest' && RX_CODIGO_ENVIADO_.test(String(m.texto || ''))); }
function codigoPendiente_(ctx, hilo) {
  if (!ctx || ctx.esWA || !ctx.reservaConfirmada || !ctx.checkin || !ctx.hoy) return false;
  if (ctx.hoy < ctx.checkin || (ctx.checkout && ctx.hoy > ctx.checkout)) return false;
  const t = String(ctx.texto || '');
  if (!RX_PIDE_CODIGO_.test(t)) return false;
  if (/wi-?fi|internet|router|network|\bred\b/i.test(t) && !/puerta|door|cerradura|lock|entrar|ingres|acceso|access/i.test(t)) return false;
  /* Solo es urgente si ya está por entrar: el día de llegada desde CODIGO_URGENTE_DESDE (14:30), durante la estadía, o si
     dice que está en la puerta / no puede entrar. Si pregunta con tiempo («llegamos a las 5»), ALMA responde normal: el
     código llega por la plataforma antes de su llegada (y si promete enviarlo, queda como promesa rastreable). */
  const enPuerta = /(no (puedo|podemos) (entrar|ingresar|abrir)|no (me |nos )?abre|ya (llegu|estamos|estoy)|estoy (afuera|en la puerta|aqu[ií])|estamos (afuera|en la puerta|aqu[ií])|can'?t (get in|open|enter)|(i'?m|we'?re|we are|i am) (here|outside|at the door)|locked out|just arrived)/i.test(t);
  const desde = String(PropertiesService.getScriptProperties().getProperty('CODIGO_URGENTE_DESDE') || '14:30');
  const ahoraHM = Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm');
  if (!enPuerta && ctx.hoy === ctx.checkin && ahoraHM < desde) return false;
  return !codigoEnviadoEnHilo_(hilo);
}
/* WhatsApp a los administradores solo para lo de verdad relevante (critico = true). Lo demás va por notificación
   del Hub y correo: Juan pidió ver en WhatsApp de ALMA solo updates importantes. */
function avisarAdmins_(asunto, texto, critico) {
  if (!critico) { pushA_(null, asunto, texto); try { correo_(CFG.EMAIL_ALERTAS || Session.getEffectiveUser().getEmail(), asunto, texto); } catch (e) {} return; }
  notificar_(CFG.WHATSAPP_NOCTURNO, asunto, texto);
  if (CFG.WHATSAPP_RESPALDO && CFG.WHATSAPP_RESPALDO !== CFG.WHATSAPP_NOCTURNO) waEnviar_(CFG.WHATSAPP_RESPALDO, asunto + '\n\n' + texto);
  pushA_(null, asunto, texto);
}
function manejarCodigo_(sh, lider, otros, ctx) {
  otros.forEach(f => set_(sh, f, { estado: 'agrupado', nota: 'ver fila ' + lider.fila }));
  const min = Math.max(1, cfg_('CODIGO_REVISION_MIN') || 6);
  ctx.nivel = 'AMARILLO'; ctx.razon = 'Pide el código de acceso y en la conversación no consta que se haya enviado';
  const alerta = 'Huésped: ' + ctx.huesped + '\nPropiedad: ' + ctx.propiedad + (ctx.apartamento ? ' (' + ctx.apartamento + ')' : '') +
    '\nCódigo de reserva: ' + ctx.codigo + '\nLlegada: ' + ctx.checkin + '\n\nMensaje:\n' + ctx.texto +
    '\n\nEn la conversación no consta que se haya enviado el código de acceso. Si en ' + min + ' min sigue sin enviarse, ALMA enviará el código de emergencia.';
  if (ctx.modo === 'SOMBRA') { set_(sh, lider, { estado: 'sombra', nota: 'CÓDIGO pendiente' }); return log_(ctx, '', 'SOMBRA: alertaría a ambos administradores y revisaría el código en ' + min + ' min'); }
  avisarAdmins_('🔑 ALMA · el huésped no tiene su código · ' + ctx.propiedad, alerta);
  if (ctx.modo !== 'AUTO') { set_(sh, lider, { estado: 'escalado', nota: 'CÓDIGO pendiente · solo alerta' }); return log_(ctx, '', 'CÓDIGO pendiente: alerta a ambos administradores'); }
  const contencion = ctx.contencionReciente ? '' : contencion_(ctx.idioma, ctx.ultimosNuestros, ctx.hiloTexto);
  const env = contencion ? enviarCanal_(ctx, contencion) : { code: 204 };
  set_(sh, lider, {
    estado: 'esperando_codigo', proximo: new Date(ahora_().getTime() + min * 60000).toISOString(),
    nota: 'CÓDIGO pendiente · contención ' + (env.code < 300 ? 'enviada' : 'FALLÓ ' + env.code) + ' · revisión en ' + min + ' min',
    datos: JSON.stringify(compacto_(ctx, { contencionAt: new Date().toISOString(), borrador: contencion, codigoPendiente: true }))
  });
  log_(ctx, contencion, 'CÓDIGO pendiente: alerta a ambos administradores · contención · revisión en ' + min + ' min');
}
function verificarCodigo_(sh, f) {
  const d = JSON.parse(f.v[C.datos] || '{}');
  const r = hiloConv_(d.resId);
  if (r.code !== 200) return reintentar_(sh, f, 'verificación código HTTP ' + r.code, 'esperando_codigo');
  if (codigoEnviadoEnHilo_(r.hilo)) { set_(sh, f, { estado: 'escalado', nota: 'CÓDIGO · ya se envió' }); return log_(d, '', 'CÓDIGO: ya se envió · revisión cerrada'); }
  const ce = codigoEmergencia_(d.propiedad, d.checkin);
  if (!ce) {
    avisarAdmins_('🔑🔴 ALMA · sin código de emergencia · ' + d.propiedad, 'El huésped sigue sin su código y no encontré un código de limpieza vigente en EPI. Hay que enviarlo ya.\nHuésped: ' + d.huesped + ' · ' + d.codigo, true);
    set_(sh, f, { estado: 'escalado', nota: 'CÓDIGO · sin código de emergencia · admins avisados' });
    return log_(d, '', 'CÓDIGO: sigue sin enviarse y no hay código de emergencia · admins avisados');
  }
  const msg = mensajeEmergencia_(d.idioma, ce.codigo);
  const env = enviarCanal_(d, msg);
  d.emergenciaAt = new Date().toISOString();
  avisarAdmins_('🔑 ALMA · código de emergencia enviado · ' + d.propiedad, 'A los ' + (cfg_('CODIGO_REVISION_MIN') || 6) + ' min el código de acceso seguía sin enviarse. ALMA envió el código de limpieza ' + ce.codigo + ' (' + ce.origen + ').\nHuésped: ' + d.huesped + '\nCódigo de reserva: ' + d.codigo + '\nEnvía el código definitivo y considera rotar el de limpieza.');
  set_(sh, f, { estado: 'escalado', nota: 'CÓDIGO · emergencia ' + (env.code < 300 ? 'enviada' : 'FALLÓ ' + env.code), datos: JSON.stringify(d) });
  return log_(d, msg, 'EMERGENCIA: código de limpieza enviado al huésped (' + ce.origen + ') · el código de acceso no se había enviado');
}

function verificarRojo_(sh, f) {
  const d = JSON.parse(f.v[C.datos] || '{}');
  const r = hiloConv_(d.resId);
  if (r.code !== 200) return reintentar_(sh, f, 'verificación ROJO HTTP ' + r.code, 'esperando_rojo');
  const desde = new Date(d.contencionAt).getTime() + 5000;
  const atendido = r.hilo.some(m => m.tipo !== 'guest' && new Date(m.created).getTime() > desde);
  if (atendido) return set_(sh, f, { estado: 'escalado', nota: 'ROJO atendido por el equipo' });

  // Sin acceso + estadía activa + nadie respondió: código de limpieza vigente, una sola vez.
  if (d.acceso && !d.emergenciaAt && cfg_('EMERGENCIA_MIN') > 0) {
    const ce = codigoEmergencia_(d.propiedad, d.checkin);
    if (ce) {
      const msg = mensajeEmergencia_(d.idioma, ce.codigo);
      const env = enviarCanal_(d, msg);
      escalar_('🔑 ALMA · código de emergencia enviado · ' + d.propiedad,
        'Nadie respondió en ' + cfg_('EMERGENCIA_MIN') + ' min y el huésped no podía entrar. ALMA le envió el código de limpieza ' + ce.codigo + ' (' + ce.origen + ').\nHuésped: ' + d.huesped + '\nCódigo de reserva: ' + d.codigo + '\nRevisa que haya entrado y considera rotar el código.', { sinWa: true });
      d.emergenciaAt = new Date().toISOString();
      const restante = Math.max(60, cfg_('ESPERA_ROJO_SEG') - cfg_('EMERGENCIA_MIN') * 60);
      set_(sh, f, { proximo: new Date(ahora_().getTime() + restante * 1000).toISOString(), nota: 'ROJO · código de emergencia ' + (env.code < 300 ? 'enviado' : 'FALLÓ ' + env.code), datos: JSON.stringify(d) });
      return log_(d, msg, 'EMERGENCIA: código de limpieza enviado al huésped (' + ce.origen + ')');
    }
    escalar_('🔑 ALMA · sin código de emergencia · ' + d.propiedad, 'El huésped no puede entrar y no encontré un código de limpieza vigente para esta propiedad en EPI. Hay que atenderlo ya.\nHuésped: ' + d.huesped + ' · ' + d.codigo);
  }
  escalar_('🔴🔴 ALMA ROJO SIN ATENDER · ' + d.propiedad,
    'Nadie respondió en ' + Math.round(cfg_('ESPERA_ROJO_SEG') / 60) + ' min.\nHuésped: ' + d.huesped +
    '\nPropiedad: ' + d.propiedad + '\nCódigo: ' + d.codigo + '\nMotivo: ' + d.razon);
  set_(sh, f, { estado: 'escalado', nota: 'ROJO sin atender · respaldo avisado' });
  log_(d, '', 'ROJO sin atender: respaldo avisado');
}

/* ═══════════════════════════════ 3. CONTEXTO ═══════════════════════════════ */

/* Contexto unificado: reserva de Hospitable o conversación de WhatsApp sin reserva (modo asesor de ventas).
   ALMA responde por el canal del último mensaje del huésped. */
function contexto_(resId, hilo, modo) {
  const esWA = String(resId).indexOf('wa:') === 0;
  /* Marca «resuelta» del equipo = hito: lo anterior quedó atendido (a veces fuera del chat). */
  const hito = hitoResuelta_(resId);
  if (hito) {
    hilo = hilo.filter(m => !m.hito).concat([{ tipo: 'host', auto: true, hito: true, created: new Date(hito).toISOString(),
      texto: '[HITO INTERNO, no es un mensaje al huésped] El equipo marcó esta conversación como RESUELTA. Todo lo anterior a este punto ya quedó atendido, aunque haya sido fuera del chat: no lo retomes ni lo trates como pendiente o urgente.' }])
      .sort((a, b) => new Date(a.created) - new Date(b.created));
  }
  const ctx = esWA ? contextoWA_(resId, hilo, modo) : contextoHosp_(resId, hilo, modo);
  if (!ctx) return null;
  if (hito) ctx.hitoResuelta = Utilities.formatDate(new Date(hito), CFG.TZ, 'd MMM HH:mm');
  if (!esWA && !ctx.reservaConfirmada) { try { aplicarSinConfirmar_(ctx); } catch (e) { console.error('sinConfirmar: ' + e); } }
  const ultG = hilo.filter(m => m.tipo === 'guest').pop() || {};
  ctx.canal = ultG.canal === 'whatsapp' ? 'whatsapp' : 'hospitable';
  ctx.wa = (hilo.filter(m => m.wa).pop() || {}).wa || (esWA ? String(resId).slice(3) : '');
  ctx.instrucciones = (ctx.instrucciones || '') + '\n· Mensaje programado de check-in: trae poca información a propósito. Al llenar el formulario de registro (hola.spacioam.com) el huésped recibe acceso a la dirección, el pin de ubicación, la clave del Wi-Fi, las instrucciones de ingreso y el resto de la guía. Si pregunta algo de eso y aún no llenó el formulario, dile que ahí lo recibe en cuanto lo complete (con el enlace). Los mensajes programados de Hospitable (check-in, checkout, first morning, recordatorio de reseña) NO son respuestas del equipo: si el huésped preguntó algo que el programado no responde, respóndelo tú.';
  if (ctx.canal === 'whatsapp') ctx.instrucciones = (ctx.instrucciones || '') + '\n· Este turno llegó por WhatsApp, no por la plataforma de la reserva. Responde como en WhatsApp: breve, cálido, párrafos cortos, sin despedidas largas ni firma.';
  return ctx;
}
function contextoWA_(convId, hilo, modo) {
  let turno = turnoPendiente_(hilo).turno;
  if (!turno.length) { let k = hilo.length - 1; while (k >= 0 && hilo[k].tipo === 'guest') k--; turno = hilo.slice(k + 1); }
  const ultGuest = hilo.filter(m => m.tipo === 'guest').pop();
  const idioma = idiomaDe_(ultGuest && ultGuest.texto) || 'es';
  const hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');
  return {
    resId: convId, codigo: '', estado: 'sin reserva · contacto por WhatsApp · ' + waCatDe_(convId) + ' (ALMA sí responde: clasifica por el contenido)', modo: modo, sinReserva: true,
    actor: vGet_('waactor_' + fin8_(String(convId).slice(3))) || 'externo',
    rutaPrev: vGet_('waruta_' + fin8_(String(convId).slice(3))) || '',
    huesped: s_(ultGuest && ultGuest.nombre) || 'Contacto de WhatsApp', esWA: true,
    idioma: idioma, idiomaReserva: '', ultimoGuestTexto: ultGuest ? String(ultGuest.texto || '').slice(0, 400) : '',
    propiedad: 'Sin reserva', apartamento: '', checkin: '', checkout: '', hoy: hoy,
    horaLocal: Utilities.formatDate(ahora_(), CFG.TZ, 'HH:mm'),
    momento: 'sin reserva: persona que escribe por WhatsApp (posible huésped futuro, proveedor u otro)',
    disponibilidad: null, conocimiento: conocimiento_('*'), reservaConfirmada: false, formStatus: 'pendiente',
    texto: turno.map(m => m.texto).join('\n'), fotos: [].concat.apply([], turno.map(m => m.fotos || [])),
    equipoActivo: equipoActivo_(hilo, ''), contencionReciente: false,
    ultimosNuestros: hilo.filter(m => m.tipo !== 'guest').slice(-3).map(m => m.texto),
    ultimoGuestAt: turno.length ? turno[turno.length - 1].created : '',
    hiloTexto: hilo.map(m => '[' + (m.tipo === 'guest' ? 'CONTACTO' : 'SPACIO AM') + '] ' + m.texto).join('\n---\n').slice(-8000),
    propiedadInfo: '(no tiene reserva: no hay datos de acceso, WiFi ni códigos que compartir)',
    /* El prompt principal (REDACTOR, editable desde el hub) ya define qué hacer con quien no tiene reserva: manda.
       VENTAS_WHATSAPP / ADMIN_WHATSAPP solo complementan. */
    instrucciones: 'CONVERSACIÓN SIN RESERVA (WhatsApp · ' + waCatDe_(convId) + '). ALMA SÍ RESPONDE siempre. Aplica primero las acciones que tus REGLAS PRINCIPALES definen para quien no tiene reserva (consultas, cotizaciones, interesados, proveedores, otros). Lo siguiente solo complementa y nunca contradice tus reglas principales:\n' +
      (waCatDe_(convId) === 'administrativa' ? prompt_('ADMIN_WHATSAPP') : prompt_('VENTAS_WHATSAPP')) + '\n' + prompt_('REGLAS_EXTRA')
  };
}
function waCatDe_(convId) { return vGet_('wacat_' + fin8_(String(convId).slice(3))) || 'reserva'; }
function contextoHosp_(resId, hilo, modo) {
  const esInq = String(resId).indexOf('inq:') === 0;
  const r = hosp_('get', '/reservations/' + resId + (esInq ? '?include=properties,listings,guest' : '?include=properties,guest'));
  if (r.code !== 200) return null;
  const res = (r.json && r.json.data) || {};
  if (esInq) { res.status = res.status || 'consulta sin reserva (inquiry)'; res.conversation_language_code = res.conversation_language_code || (res.guest && res.guest.language) || ''; }
  const prop = (res.properties && res.properties[0]) || {};
  const estado = String(res.status || (res.reservation_status && res.reservation_status.current && res.reservation_status.current.category) || '').toLowerCase();
  const codigo = s_(res.code) || s_(res.platform_id);

  // Turno = todo lo que el huésped escribió después de nuestro último mensaje
  let turno = turnoPendiente_(hilo).turno;
  if (!turno.length) { let k = hilo.length - 1; while (k >= 0 && hilo[k].tipo === 'guest') k--; turno = hilo.slice(k + 1); }
  // Idioma: el del último mensaje del huésped; si no hay señal, el asignado a la reserva. Si cambia de idioma, ALMA cambia con él.
  const ultGuest = hilo.filter(m => m.tipo === 'guest').pop();
  const idiomaRes = s_(res.conversation_language_code).slice(0, 2).toLowerCase();
  const idiomaCtx = idiomaDe_(ultGuest && ultGuest.texto) || idiomaRes || 'es';

  const fila = buscarReserva_(codigo);
  const nombreProp = s_(prop.name) || s_(fila.property_name) || (esInq ? nombrePropInq_(res) : '');
  const checkin = s_(res.check_in || res.arrival_date || res.checkin || res.start_date || (res.dates && res.dates.check_in)).slice(0, 10) || fecha_(fila.checkin_date);
  const checkout = s_(res.check_out || res.departure_date || res.checkout || res.end_date || (res.dates && res.dates.check_out)).slice(0, 10) || fecha_(fila.checkout_date);
  const hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');

  return {
    resId: resId, codigo: codigo, estado: estado, modo: modo,
    huesped: s_(res.guest && res.guest.first_name) || s_(turno[0] && turno[0].nombre),
    idioma: idiomaCtx, idiomaReserva: idiomaRes || '', ultimoGuestTexto: ultGuest ? String(ultGuest.texto || '').slice(0, 400) : '',
    propiedad: nombreProp,
    apartamento: s_(fila.apartment),
    checkin: checkin, checkout: checkout, hoy: hoy,
    horaLocal: Utilities.formatDate(ahora_(), CFG.TZ, 'HH:mm'),
    momento: momento_(hoy, checkin, checkout),
    disponibilidad: disponibilidad_(nombreProp, checkin, checkout, codigo),
    conocimiento: conocimiento_(nombreProp) + distanciaBloque_(nombreProp, turno.map(m => m.texto).join('\n')),
    reservaConfirmada: ['accepted', 'confirmed', 'checked_in', 'checkpoint'].some(x => estado.indexOf(x) !== -1),
    formStatus: (String(fila.status_form || '').toLowerCase() === 'completo' || (function () { try { return formsOk_().indexOf(String(fila.code || codigo || '').toUpperCase()) >= 0; } catch (e) { return false; } })()) ? 'completo' : 'pendiente',
    texto: turno.map(m => m.texto).join('\n'),
    fotos: [].concat.apply([], turno.map(m => m.fotos || [])),
    equipoActivo: equipoActivo_(hilo, codigo),
    contencionReciente: hilo.some(m => m.tipo !== 'guest' && esContencion_(m.texto) && Date.now() - new Date(m.created).getTime() < cfg_('CONTENCION_HORAS') * 3600000),
    ultimosNuestros: hilo.filter(m => m.tipo !== 'guest' && !m.auto).slice(-3).map(m => m.texto),
    ultimoGuestAt: turno.length ? turno[turno.length - 1].created : '',
    hiloTexto: hilo.map(m => '[' + (m.tipo === 'guest' ? 'HUÉSPED' : (m.auto ? 'SPACIO AM · automático' : 'SPACIO AM')) + (m.llamada ? ' · en llamada' : m.canal === 'whatsapp' ? ' · por WhatsApp' : '') + '] ' + m.texto)
      .join('\n---\n').slice(-8000),
    propiedadInfo: infoPropiedad_(nombreProp, idiomaCtx),
    codigos: codigosEnHilo_(hilo),
    instrucciones: prompt_('REGLAS_EXTRA'),
    dispSolicitud: (function () { const conf = ['accepted', 'confirmed', 'checked_in', 'checkpoint'].some(x => estado.indexOf(x) !== -1); if (conf) return ''; try { return dispSolicitud_(s_(prop.id || prop.uuid), nombreProp, checkin, checkout, resId + checkin + checkout); } catch (e) { console.error('dispSolicitud_: ' + e); return ''; } })()
  };
}

/* ¿Una persona del equipo (no ALMA, no un automático) escribió hace poco? Entonces está gestionando. */
function equipoActivo_(hilo, codigo) {
  const mios = textosAlma_(codigo);
  const equipo = hilo.filter(m => m.tipo !== 'guest' && !m.auto && !m.alma && !esContencion_(m.texto) && mios.indexOf(String(m.texto).trim()) === -1);
  if (!equipo.length) return false;
  return Date.now() - new Date(equipo[equipo.length - 1].created).getTime() < cfg_('MIN_EQUIPO_ACTIVO') * 60000;
}
function textosAlma_(codigo) {
  if (!codigo) return [];
  return leerTabla_(CFG.TAB_LOG).filter(r => s_(r.codigo) === codigo && /^ENVIADO|contención/i.test(s_(r.accion))).map(r => s_(r.respuesta).trim());
}
function variantes_(s) { return String(s || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean); }
function esContencion_(texto) {
  const x = String(texto || '').trim();
  return !!x && ['ES', 'EN', 'PT'].some(l => contencionPool_(l).indexOf(x) !== -1);
}

/* ¿Ya le enviamos el código del APARTAMENTO o solo el del EDIFICIO? Lee nuestros mensajes (incluidos automáticos). */
function codigosEnHilo_(hilo) {
  const out = { apto: [], edificio: [], otro: [] };
  const ED = /(edificio|porter[ií]a|recepci[oó]n|lobby|garita|parqueo|s[oó]tano|ascensor|elevador|torre|monaco|building|gate|front desk|elevator|garage|peatonal)/i;
  const AP = /(apartamento|apto|puerta|cerradura|chapa|lock|door|unit|smart ?lock|teclado|keypad)/i;
  const WIFI = /(wi-?fi|red |internet|password de la red)/i;
  hilo.filter(m => m.tipo !== 'guest').forEach(m => {
    const s = String(m.texto || ''), re = /(c[oó]digo|code|clave|pin|contraseña|passcode)[^0-9\n]{0,40}?(\d{4,10}#?)/gi; let x;
    while ((x = re.exec(s))) {
      const antes = s.slice(Math.max(0, x.index - 90), x.index + x[0].length), cerca = s.slice(Math.max(0, x.index - 40), x.index + x[0].length + 40);
      if (WIFI.test(cerca)) continue;
      const item = { codigo: x[2], fecha: String(m.created || '').slice(0, 16).replace('T', ' '), auto: !!m.auto };
      const ed = ED.test(antes), ap = AP.test(antes);
      (ed && !ap ? out.edificio : ap && !ed ? out.apto : ed && ap ? (antes.search(ED) > antes.search(AP) ? out.edificio : out.apto) : out.otro).push(item);
    }
  });
  return out;
}
function textoCodigos_(c) {
  if (!c) return 'no aplica';
  const f = (l, n) => l.length ? n + ': sí, ' + l.slice(-1).map(x => x.codigo + ' (enviado ' + x.fecha + (x.auto ? ', automático' : '') + ')').join('') : n + ': no';
  return [f(c.apto, 'apartamento'), f(c.edificio, 'edificio'), c.otro.length ? 'sin identificar: ' + c.otro.slice(-1).map(x => x.codigo + ' (' + x.fecha + ')').join('') + ' — revisa el hilo antes de decir de qué puerta es' : ''].filter(Boolean).join(' · ');
}
/* Mensajes programados de Hospitable (reglas: check-in, checkout, first morning, review reminder…) NO son respuestas del equipo.
   Hospitable los marca con distintos source según la regla; además se reconocen por su contenido de plantilla. */
function esAutoHosp_(m) {
  if (String(m.sender_type || '').toLowerCase() === 'guest') return false;
  const src = String(m.source || '').toLowerCase();
  if (/automat|schedul|rule|template|trigger/.test(src) || m.scheduled_message_id || m.automated === true || m.is_automated === true) return true;
  if (src === 'public_api') return false;
  const t = s_(m.body);
  return t.length > 180 && !!tipoPlantilla_(t);
}
function tipoPlantilla_(t) {
  t = String(t || '').toLowerCase();
  if (/hola\.spacioam\.com|formulario de (registro|llegada)|check.?in form|registration form/.test(t)) return 'checkin';
  if (/(check.?out|salida|departure).{0,80}(\d{1,2}(:\d\d)?\s*(am|pm|h)|ma[ñn]ana|tomorrow|hoy|today)|antes de (salir|irte|partir)|before (you )?(leave|leaving|check.?out)/.test(t)) return 'checkout';
  if (/(review|rese[ñn]a|calificaci|estrellas|stars)/.test(t) && /(deja|leave|escrib|write|compart|share)/.test(t)) return 'review';
  if (/(primera noche|first night|buenos d[ií]as|good morning).{0,200}(c[oó]mo (te|les) fue|how (was|is) (your|the)|todo (bien|en orden)|everything)/.test(t)) return 'first_morning';
  return '';
}
function normalizarHilo_(json) {
  const lista = (json && (json.data || json.messages)) || (Array.isArray(json) ? json : []);
  return lista.map(m => ({
    tipo: String(m.sender_type || '').toLowerCase() === 'guest' ? 'guest' : 'host',
    auto: esAutoHosp_(m),
    plantilla: tipoPlantilla_(s_(m.body)),
    texto: s_(m.body),
    nombre: s_(m.sender && m.sender.first_name),
    fotos: adjuntos_(m.attachments),
    created: s_(m.created_at)
  })).filter(m => m.texto || m.fotos.length).sort((a, b) => a.created.localeCompare(b.created));
}

/* Fechas de la hoja pueden llegar como Date o texto; siempre yyyy-MM-dd. */
function fecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  const s = s_(v).trim(); const m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1];
  const d = new Date(s); return isNaN(d) ? '' : Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd');
}
function sumarDias_(ymd, n) { const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); return Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd'); }

/* ¿Dónde está el huésped en su estadía? Evita el "lo vemos mañana" cuando el check-in es hoy. */
function momento_(hoy, checkin, checkout) {
  if (!checkin) return 'sin fechas de reserva';
  const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const dci = dias(hoy, checkin);
  if (dci > 1) return 'faltan ' + dci + ' días para el check-in (' + checkin + ')';
  if (dci === 1) return 'el check-in es MAÑANA (' + checkin + ') a las 15:00';
  if (dci === 0) return 'el check-in es HOY (' + checkin + ') a las 15:00. Nada que deba quedar listo antes de la llegada puede dejarse para mañana';
  if (checkout && dias(hoy, checkout) > 0) return 'estadía activa: noche ' + (-dci + 1) + ' de ' + dias(checkin, checkout) + ' · el checkout es ' + (dias(hoy, checkout) === 1 ? 'MAÑANA a las 11:00' : 'el ' + checkout);
  if (checkout && dias(hoy, checkout) === 0) return 'el checkout es HOY (' + checkout + ') a las 11:00';
  return 'la estadía ya terminó (checkout ' + checkout + ')';
}

/* Ocupación vecina de la misma propiedad, para early check-in / late checkout. */
function disponibilidad_(propiedad, checkin, checkout, codigo) {
  const norm = x => String(x || '').toLowerCase().replace(/[\s\-–_]/g, '');
  if (!propiedad || !checkin) return null;
  const otras = leerTabla_(CFG.TAB_RESERVAS).filter(r => norm(r.property_name) === norm(propiedad) && s_(r.code) !== codigo && !/cancel/i.test(s_(r.status)));
  const ci = x => fecha_(x.checkin_date), co = x => fecha_(x.checkout_date);
  const diaAntes = sumarDias_(checkin, -1);
  return {
    salidaMismoDia: otras.some(x => co(x) === checkin),
    nocheAnteriorOcupada: otras.some(x => ci(x) && ci(x) <= diaAntes && co(x) >= checkin),
    llegadaMismoDia: !!checkout && otras.some(x => ci(x) === checkout)
  };
}
function textoDisponibilidad_(d) {
  if (!d) return '(sin datos de ocupación: no ofrezcas early check-in ni late checkout; di que el equipo confirma por aquí mismo)';
  return 'EARLY CHECK-IN: ' + (d.salidaMismoDia ? 'HAY salida de otro huésped el mismo día → NO es posible; ofrece solo guardar maletas desde las 12:00 (conocimiento "Early check-in · con salida el mismo día").'
      : d.nocheAnteriorOcupada ? 'la noche anterior está ocupada → NO es posible; ofrece solo guardar maletas desde las 12:00.'
      : 'no hay salida el mismo día ni ocupación la noche anterior → presenta las 3 opciones (conocimiento "Early check-in · sin salida el mismo día"); se confirma a las 21:00 del día previo, nunca antes.') +
    '\nLATE CHECKOUT: ' + (d.llegadaMismoDia ? 'HAY llegada de otro huésped el mismo día → solo guardar maletas hasta las 14:00 (conocimiento "Late checkout · con llegada el mismo día").'
      : 'no hay llegada el mismo día → presenta las 2 opciones (conocimiento "Late checkout · sin llegada el mismo día").');
}

/* Base de conocimiento: entradas activas que apliquen a todas (*) o a esta propiedad. */
function tokProp_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/)
    .filter(t => t && ['apto', 'apt', 'apartamento', 'unidad', 'casa', 'de', 'la', 'el'].indexOf(t) === -1);
}
/* aplica_a: cada entrada (separada por , o ;) aplica si TODAS sus palabras están en el nombre de la propiedad.
   "Z10" aplica a todo zona 10; "Airali" a todo Airali; "Airali 1508" solo a ese apartamento. "10" ya no atrapa "1004". */
function aplicaA_(aplica, propiedad) {
  const a = s_(aplica).trim(); if (!a || a === '*') return true;
  const P = tokProp_(propiedad);
  return a.split(/[,;]/).some(x => { const T = tokProp_(x); return T.length && T.every(t => P.indexOf(t) !== -1); });
}
function kbActivas_() { return leerTabla_(CFG.TAB_CONOCIMIENTO).filter(r => s_(r.tema) && ['NO', 'FALSE', '0'].indexOf(String(r.activo || '').trim().toUpperCase()) === -1); }
/* Parqueo desde la base: primero la entrada específica del edificio, luego la general (*). */
function kbParqueo_(propiedad) {
  const P = kbActivas_().filter(r => /^parqueo/i.test(s_(r.tema).trim()));
  const esp = P.find(r => { const a = s_(r.aplica_a).trim(); return a && a !== '*' && aplicaA_(a, propiedad); });
  const gen = P.find(r => { const a = s_(r.aplica_a).trim(); return !a || a === '*'; });
  return s_((esp || gen || {}).contenido).trim();
}
function conocimiento_(propiedad) {
  return kbActivas_()
    .filter(r => !/^parqueo/i.test(s_(r.tema).trim()))   // el parqueo ya viene resuelto en la ficha
    .filter(r => aplicaA_(r.aplica_a, propiedad))
    .map(r => '## ' + s_(r.tema).trim() + '\n' + s_(r.contenido).trim()).join('\n\n').slice(0, 8000)
    + (function () { try { const m = memoriaTexto_(propiedad); return m ? '\n\n' + m : ''; } catch (e) { return ''; } })();
}

function buscarReserva_(codigo) {
  if (!codigo) return {};
  return leerTabla_(CFG.TAB_RESERVAS).find(x => s_(x.code) === codigo) || {};
}

// Arma la ficha de la propiedad desde PropiedadesInfo (hoja del webapp).
// Estructura real: std.{es,en} = textos de llegada; campos sueltos = WiFi, piso, unidad, cerradura;
// fila __manual__ = manuales con "assign" por propiedad (solo se incluyen los asignados a ESTA propiedad).
function infoPropiedad_(nombre, idioma) {
  const norm = t => String(t || '').toLowerCase().replace(/[\s\-–_]/g, '');
  const filas = leerTabla_(CFG.TAB_PROPIEDADES);
  const parse = f => { try { return JSON.parse(String(f.info_json || '{}')); } catch (e) { return null; } };
  let fila = nombre ? filas.find(f => norm(f.property_name) === norm(nombre)) : null;
  if (!fila && nombre) {   // "Z10 · Ignacio · Apto 1004" ↔ "Z10 - Ignacio - 1004"
    const N = tokProp_(nombre), numN = N.filter(t => /\d{3,}/.test(t));
    let mejor = null, pts = 0;
    filas.forEach(f => {
      if (String(f.property_name || '').indexOf('__') !== -1) return;
      const F = tokProp_(f.property_name); if (!F.length) return;
      const comunes = F.filter(t => N.indexOf(t) !== -1).length, numF = F.filter(t => /\d{3,}/.test(t));
      if (numN.length && numF.length && !numF.some(t => numN.indexOf(t) !== -1)) return;   // otro apartamento
      if (comunes >= Math.min(2, F.length) && comunes > pts) { mejor = f; pts = comunes; }
    });
    fila = mejor;
  }
  const j = fila ? parse(fila) : null;
  if (!j) return '(SIN INFO DE PROPIEDAD para: ' + (nombre || 'desconocida') + '. No des datos de llegada, WiFi ni parqueo: di que lo confirmas con el equipo.)';

  const lang = String(idioma || '').slice(0, 2) === 'en' && j.std && j.std.en ? 'en' : 'es';
  const t = (j.std && (j.std[lang] || j.std.es)) || {};
  const L = [];
  const add = (k, v) => { v = Array.isArray(v) ? v.filter(Boolean) : String(v || '').trim(); if (v && v.length) L.push(Array.isArray(v) ? k + ':\n' + v.map(x => '· ' + x).join('\n') : k + ': ' + v); };

  add('Dirección y edificio', t.arrivalIntro);
  add('Cómo llegar (pasos)', t.arrivalSteps && t.arrivalSteps.length ? t.arrivalSteps : j.arrival);
  add('Piso', j.floor);
  add('Apartamento / unidad', j.unit);
  add('Tipo', { apt: 'apartamento', house: 'casa' }[j.propType] || j.propType);
  if (j.wifiNet || j.wifiPass) add('WiFi', 'red "' + String(j.wifiNet || '').trim() + '", clave "' + String(j.wifiPass || '').trim() + '"');
  if (j.wifiNetBk || j.wifiPassBk) add('WiFi alterno', 'red "' + String(j.wifiNetBk || '').trim() + '", clave "' + String(j.wifiPassBk || '').trim() + '"');
  if (j.wifiNetBk2 || j.wifiPassBk2) add('WiFi alterno 2', 'red "' + String(j.wifiNetBk2 || '').trim() + '", clave "' + String(j.wifiPassBk2 || '').trim() + '"');
  add('Nota WiFi', t.wifiNote);
  const parq = [t.parking, j.parkNote, j.parking, j.parkingNote, j.parkSpot, j.parkingSpot, j.parkNum].map(x => String(x || '').trim()).filter(Boolean);
  add('Parqueo', parq.length ? parq.filter((v, i, a) => a.indexOf(v) === i).join(' · ') : (kbParqueo_(nombre) || 'sin dato en la ficha: no des precio ni condiciones, confírmalo con el equipo'));
  if (j.lock === 'smart') add('Cerradura', 'inteligente' + (j.smartBrand && j.smartBrand !== 'other' ? ' (' + j.smartBrand + ')' : '') + '. El código NO está aquí: llega por la plataforma un día antes.');
  else add('Cerradura', j.lock);
  add('Tip', t.tip);

  const manual = filas.find(f => String(f.property_name || '').indexOf('__manual__') !== -1);
  const m = manual ? parse(manual) : null;
  if (m && m.items && m.assign) {
    m.items.filter(it => (m.assign[it.id] || []).some(n => norm(n) === norm(nombre))).forEach(it => {
      add('Manual · ' + String(it.title || '').trim(), [it.intro].concat(it.steps || []));
    });
  }
  /* Todo lo demás que traiga la ficha (para no depender del anuncio). Los códigos de la puerta no se exponen aquí. */
  const usados = /^(std|arrival|floor|unit|propType|wifi|parkNote|parking|parkingNote|parkSpot|parkingSpot|parkNum|lock|smartBrand)/;
  const extra = aplanar_(Object.keys(j).filter(k => !usados.test(k)).reduce((o, k) => (o[k] = j[k], o), {}))
    .filter(x => !/^(lock|door|puerta|smart|apt|unit)\w*(code|codigo|pin)\b|^pin\b/i.test(x)).slice(0, 40);
  if (extra.length) L.push('Otros datos de la ficha:\n' + extra.map(x => '· ' + x).join('\n'));
  return L.join('\n').replace(/\*\*/g, '').slice(0, 7000);   // sin markdown: en Airbnb/Booking se ve literal
}

function aplanar_(obj, pre) {
  pre = pre || '';
  if (obj === null || obj === undefined) return [];
  if (Array.isArray(obj)) return [].concat.apply([], obj.map((v, i) => aplanar_(v, pre ? pre + '.' + (i + 1) : String(i + 1))));
  if (typeof obj === 'object') return [].concat.apply([], Object.keys(obj).map(k => aplanar_(obj[k], pre ? pre + '.' + k : k)));
  const v = String(obj).trim();
  return v ? [(pre ? pre + ': ' : '') + v] : [];
}

// Varias variantes separadas por línea en blanco; elige una al azar distinta de lo último que dijimos.
/* Banco fijo de variantes (se suma a las de la hoja): ALMA nunca repite un texto que ya está en el hilo. */
const CONTENCION_BANCO_ = {
  ES: [
    'Gracias por avisarnos. Ya lo estoy viendo y alguien del equipo te escribe por aquí en un momento.',
    'Entendido, gracias por contarnos. Ya avisé al equipo y te contactan por este chat en breve.',
    'Lo tengo. Ya está en manos del equipo y te escriben por aquí mismo en unos minutos.',
    'Gracias por la paciencia. Ya pasé el caso al equipo; en un momento te responden por aquí.',
    'Ya lo vi. Le avisé al equipo y en breve alguien te escribe para resolverlo contigo.',
    'Perfecto, gracias por decirnos. El equipo ya está enterado y te contacta por este mismo chat.',
    'Estoy en eso. Alguien del equipo te escribe por aquí en unos minutos para ayudarte.',
    'Gracias por escribirnos. Ya lo reporté al equipo y te responden por aquí lo antes posible.',
    'Recibido. Ya lo estamos revisando y una persona del equipo te escribe aquí en breve.',
    'Te leo. Ya puse al equipo al tanto y en un momento te contactan por este chat.',
    'Gracias por avisar a tiempo. El equipo ya lo tiene y te escribe por aquí en cuanto pueda, en pocos minutos.',
    'Anotado. Ya le pasé esto al equipo y te escriben por aquí mismo para resolverlo.'
  ],
  EN: [
    "Thanks for letting us know. I'm looking into it and someone from the team will message you here shortly.",
    "Got it, thank you. I've alerted the team and they'll reach out in this chat in a few minutes.",
    "Understood. The team is on it and will write to you right here in a moment.",
    "Thanks for your patience. I've passed this to the team; they'll reply here shortly.",
    "I see it. I've let the team know and someone will message you soon to sort it out.",
    "Thank you for telling us. The team already has it and will contact you in this chat.",
    "I'm on it. Someone from the team will write to you here in a few minutes.",
    "Received. We're checking it now and a team member will message you here shortly.",
    "Noted. I've handed this to the team and they'll get back to you right here."
  ],
  PT: [
    'Obrigado por nos avisar. Já estou vendo e alguém da equipe te escreve por aqui em instantes.',
    'Entendido, obrigado. Já avisei a equipe e eles te escrevem por este chat em breve.',
    'Recebido. A equipe já está cuidando disso e te responde por aqui em poucos minutos.',
    'Obrigado pela paciência. Já passei para a equipe; em breve te respondem por aqui.'
  ]
};
function contencionPool_(l) { return variantes_(prompt_('CONTENCION_' + l)).concat(CONTENCION_BANCO_[l] || []).filter((v, i, a) => a.indexOf(v) === i); }
function contencion_(idioma, evitar, hiloTexto) {
  const l0 = String(idioma || '').slice(0, 2).toUpperCase(), l = ['ES', 'EN', 'PT'].indexOf(l0) !== -1 ? l0 : 'EN';
  const v = contencionPool_(l), ya = String(hiloTexto || '') + '\n' + (evitar || []).join('\n');
  const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim(), yaN = norm(ya);
  const libres = v.filter(x => yaN.indexOf(norm(x)) === -1);
  const pool = libres.length ? libres : v;
  return pool[Math.floor(Math.random() * pool.length)] || '';
}

/* ═══════════════════════════════ 4. CLAUDE ═══════════════════════════════ */

const PROMPT_CLASIFICADOR = "Eres el clasificador de mensajes de huéspedes de Spacio AM (hospitalidad boutique, Guatemala). ALMA atiende las 24 horas. Devuelves SOLO un JSON válido, sin markdown ni texto extra: {\"nivel\":\"VERDE|AMARILLO|ROJO|SILENCIO\",\"razon\":\"...\"}\n\n1. COHERENCIA TEMPORAL (antes de clasificar): compara HOY con CHECKIN y CHECKOUT. Si reporta algo del interior (acceso, código, WiFi, limpieza, electrodomésticos, agua, A/C) y HOY es ANTERIOR al check-in, la causa probable es la fecha: AMARILLO con razon \"reporte antes del check-in — probable confusión de fecha\". EXCEPCIÓN: si afirma que YA ESTÁ en la puerta o dentro, es ROJO. Si HOY es posterior al checkout: AMARILLO (registrar para el equipo), salvo emergencia activa.\n\n2. ROJO (una persona ya): sin acceso o afuera del apartamento durante la estadía (o que afirma estarlo); sin agua, luz o gas; fuga o inundación; cerradura fallando en estadía activa; seguridad, salud o ruido con terceros; queja fuerte o amenaza de mala reseña; dinero, reembolsos, cancelaciones o compensaciones.\n\n3. AMARILLO (contener sin resolver): early check-in o late checkout; visitas o terceros; disponibilidad o extensión; reportes incoherentes con las fechas; cualquier pregunta cuya respuesta NO esté escrita en la FICHA, el HILO o la BASE DE CONOCIMIENTO.\n\n4. VERDE (ALMA responde sola): WiFi, horarios, cómo llegar, amenidades, zona, políticas publicadas, formulario, factura, dudas sobre mensajes ya enviados. PARQUEO solo es VERDE si PARQUEO EN FICHA trae el dato; si dice \"sin dato\", es AMARILLO. CÓDIGO DEL APARTAMENTO: VERDE si CÓDIGOS YA ENVIADOS muestra el del apartamento; si no se ha enviado y el check-in es hoy, AMARILLO (ROJO si ya está en la puerta).\n\n5. SILENCIO: acuse simple (gracias, ok, listo) sin pregunta. Si el turno mezcla un acuse con una pregunta, NO es SILENCIO.";

const PROMPT_REDACTOR = "Eres Alma, del equipo de Spacio AM. Respondes por escrito, dentro del chat de Airbnb, Booking, Hospitable o WhatsApp, a huéspedes con una reserva. Atiendes las 24 horas: lee HORA LOCAL para saber si el equipo está en turno.\n\n1. FUENTES DE DATOS (en este orden; la primera que tenga el dato manda)\n· FICHA DE LA PROPIEDAD (bloque «INFORMACIÓN DE ESTA PROPIEDAD», viene de PropiedadesInfo): dirección, apartamento, piso, WiFi, parqueo, cerradura, pasos de llegada.\n· HILO: lo que ya le enviamos (códigos, enlaces, confirmaciones).\n· BASE DE CONOCIMIENTO: políticas y datos por edificio.\n· AVISOS INTERNOS vigentes.\nEl anuncio de Airbnb o Booking NO es fuente. Nunca inventes, deduzcas, redondees ni completes un dato. Nunca generalices (\"normalmente\", \"suele\"). Un precio, monto, horario o número de espacio solo se dice si aparece escrito en esas fuentes. Si falta: \"Ese dato no lo tengo a la mano. Lo confirmo con el equipo y te escribimos por aquí mismo.\"\n\n2. PARQUEO\nUsa solo la línea «Parqueo» de la ficha. Si dice incluido o asignado, confírmalo (con el número de espacio si viene). Si la ficha dice que tiene parqueo, nunca ofrezcas parqueo pagado ni des una tarifa. Si dice \"sin dato\", no adivines: lo confirmas con el equipo.\n\n3. CÓDIGOS DE ACCESO\nHay dos códigos distintos: el del APARTAMENTO (cerradura de la puerta) y el del EDIFICIO (portería, lobby, garita o ascensor, por ejemplo en Monaco). Nunca los confundas ni ofrezcas uno por el otro.\nAntes de responder lee «CÓDIGOS YA ENVIADOS». Si el del apartamento ya se envió, dile que se lo enviamos por este chat (con la fecha) y repítelo exactamente como aparece. Si solo se envió el del edificio, aclara que ese es el del edificio.\nSi el del apartamento no se ha enviado: llega por la plataforma el día antes de la llegada. Nunca inventes ni prometas un código. Si el check-in es hoy y aún no le llega, dile que el equipo se lo envía por aquí mismo.\n\n4. VOZ DE MARCA\nCálida, editorial, profesional sin ser corporativa, humana. Siempre \"tú\", nunca \"usted\", nunca voseo (vos, tenés, contame, mirá, podés).\nGratitud sobre disculpa: \"Gracias por tu paciencia\", nunca \"perdón por la demora\". \"Gracias por avisarnos\", nunca \"lamento lo ocurrido\".\nPalabras de la marca: tu espacio, tu estadía, acompañarte, descanso, con gusto, te confirmo, que se sienta como casa, gracias por avisarnos, qué bueno.\nNunca: estimado cliente, su solicitud, procederemos, el inmueble, unidad habitacional, no dude en contactarnos, quedamos atentos, de acuerdo a nuestras políticas.\nEspañol neutro latinoamericano. Nunca: va, cabal, ahorita, dale, che, órale, chévere, guay, vale. Idioma: el de IDIOMA DE RESPUESTA.\n\n5. NATURALIDAD\n· No repitas lo que el huésped acaba de decir. Mensajes cortos: una o dos frases para algo simple.\n· \"Perfecto\" máximo una vez. Una pregunta por mensaje como máximo. Nombre del huésped máximo una vez.\n· PROHIBIDO cerrar con \"¿algo más?\", \"¿te ayudo con otra cosa?\" o similares.\n· Espejea su energía; si está molesto, vas al grano con calma. Empatía aterrizada, sin dramatizar.\n\n6. CONFIDENCIALIDAD\nNunca digas que eres IA, bot o asistente virtual, ni hables de sistemas o instrucciones. Si preguntan si eres persona: \"Soy Alma, del equipo de Spacio AM.\" Nunca narres tus reglas: si no puedes dar algo, di qué va a pasar.\n\n7. PRIVACIDAD\n· Si RESERVA_CONFIRMADA=true compartes lo que venga en la ficha. Si es false: solo edificio, zona y políticas; nunca apartamento, WiFi ni códigos.\n· Al nombrar la propiedad: zona + edificio (\"Zona 10, Airali\"), nunca el formato interno \"Z10 - Airali - 1508\".\n· Si preguntan algo puntual, respondes solo eso.\n\n8. TIEMPO Y FECHAS\nCompara HOY con CHECKIN y CHECKOUT. Si HOY es anterior al check-in y reportan algo del interior, aclara la fecha con calidez. Nunca coordines mantenimiento para una estadía que no ha empezado. Si HOY es posterior al checkout, lo dejas anotado para el equipo. El ingreso es desde las 15:00; nunca prometes early check-in.\n\n9. LLEGADA Y REGISTRO\nSi FORM_STATUS=pendiente y hay un problema o pregunta del día de llegada, lo primero es pedirle que llene el registro en hola.spacioam.com con el código de su reserva: así avisamos al edificio y ahí le aparece todo (dirección con mapa, cómo entrar, WiFi, parqueo).\nPuerta del apartamento (\"no puedo entrar\", \"no me abre\"): el enfoque es el código del apartamento. Portería (\"no me dejan entrar\", \"mi reserva no está notificada\"): si FORM_STATUS=pendiente, pídele que llene el registro y dile que, una vez lo envíe, el equipo de recepción lo recibe en unos minutos y podrá ingresar; si ya está completo, avisa al equipo para confirmar con el edificio. Nunca ofrezcas un código para esto.\n\n10. PORTAL hola.spacioam.com\nPrimero respondes la pregunta. El portal es un extra, máximo una mención por conversación; ya se lo enviamos por la plataforma: recuérdalo, no lo presentes como nuevo. No escribas el código de reserva salvo que lo pidan. Nunca condiciones la información al formulario.\n\n11. MENSAJES AUTOMÁTICOS Y TURNO\nLos marcados «SPACIO AM · automático» son envíos programados: no repitas lo que ya entregaron completo, responde el dato puntual. Si el huésped mandó varios mensajes seguidos, respóndelos todos en uno. Si hay \"[imagen adjunta]\" y no viene la imagen, no describas su contenido.\n\n12. AMARILLO\nAcoges sin resolver. Nunca apruebes algo que requiere autorización del equipo. Early check-in, late checkout, disponibilidad, extensiones: el equipo confirma por este mismo canal, en el momento que indiquen las reglas de TIEMPO.\n\n13. POLÍTICAS BASE (si la BASE DE CONOCIMIENTO dice otra cosa, manda la base)\nCheck-in desde las 15:00; early check-in nunca garantizado. Cambios de fecha a 15 días o menos del check-in = cancelación (no aplica a extensiones). Late checkout puede tener cargo. Silencio de 22:00 a 08:00. Visitas y terceros: solo de 06:00 a 18:00 y con autorización previa del equipo; tú no autorizas. No fumar, no mascotas, no fiestas. Repartidores no ingresan: se recibe en lobby o puerta peatonal. Objetos olvidados: responsabilidad del huésped tras el checkout. Compensaciones: nunca ofreces ni mencionas montos: \"Voy a revisarlo con gerencia para ver cómo podemos apoyarte.\"\n\n14. FORMATO (chat en el teléfono)\nIdeas distintas en párrafos separados por una línea en blanco. Pasos o varios datos en líneas con \"· \". El enlace en su propia línea. Sin markdown, negritas ni asteriscos. Sin emojis salvo que el huésped los use (máximo uno). Sin saludo de correo ni firma.\n\nDevuelve SOLO el texto del mensaje al huésped, sin comillas ni comentarios.";

/* Prompts editables: pestaña ALMA_INSTRUCCIONES (columnas clave | prompt | notas).
   Si una celda está vacía o falta la fila, se usa el respaldo de este script. */
const NOTAS_PROMPTS = {
  RESPUESTA_REVIEW: 'Respuesta pública del anfitrión a una reseña (Airbnb / Booking) desde el hub.',
  APELACION: 'Analiza reseñas de 3 estrellas o menos contra la política de reseñas de Airbnb y redacta la apelación en inglés. NO cambies el formato JSON de salida.',
  ESTILO: 'Estilo y formato de todo mensaje al huésped (respuestas automáticas, borradores y Mejorar con ALMA): ritmo, párrafos, legibilidad en el teléfono.',
  MEJORAR: 'Qué hace "Mejorar con ALMA" con el texto que escribe el equipo. El texto del equipo se agrega al final automáticamente.',
  REDACTOR: 'Voz y reglas de Alma al escribir al huésped. Edítalo libremente.',
  REGLAS_REDACTOR: 'Reglas que se suman SIEMPRE al redactor y prevalecen sobre él: marcadores prohibidos, facturas, escalamiento, tiempo, early/late, seguimiento. No borres los marcadores [[FACTURA: …]] ni SIN_RESPUESTA: el sistema los usa.',
  REGLAS_CLASIFICADOR: 'Reglas que se suman SIEMPRE al clasificador: escalar, imágenes, acceso, idioma. NO cambies los nombres de los campos JSON (escalar, motivo_escalar, acceso…).',
  ENTRENADOR: 'Analiza los casos donde el equipo corrigió a ALMA y propone aprendizajes (automejora). NO cambies el formato JSON de salida.',
  EDITOR_PROMPTS: 'Convierte un pedido de mejora del hub en cambios puntuales a un prompt. NO cambies el formato JSON de salida.',
  INQUIRY_EVALUAR: 'Consultas sin reserva: decide si la pregunta tiene respuesta en la ficha o la base. NO cambies el formato JSON.',
  INQUIRY_FUSIONAR: 'Consultas sin reserva: integra la respuesta al inicio del mensaje automático de Hospitable sin quitar nada del original.',
  CLASIFICADOR: 'Decide VERDE / AMARILLO / ROJO / SILENCIO. Puedes cambiar los criterios, pero NO cambies el formato JSON de salida.',
  VERIFICADOR: 'Control de calidad antes de enviar. NO cambies el formato JSON de salida.',
  ROUTER: 'Router de WhatsApp: decide la ruta (huésped, socio, interno, estratégico, personal) y la urgencia. Puedes cambiar los criterios, NO el formato JSON.',
  RUTA_HUESPED_URGENTE: 'Huésped / posible reserva · urgente.', RUTA_HUESPED_PRIORIDAD: 'Huésped / posible reserva · prioridad.', RUTA_HUESPED_NORMAL: 'Huésped / posible reserva · normal.',
  RUTA_SOCIO_URGENTE: 'Socio / propietario · urgente.', RUTA_SOCIO_PRIORIDAD: 'Socio / propietario · prioridad.', RUTA_SOCIO_NORMAL: 'Socio / propietario · normal.',
  RUTA_INTERNO_URGENTE: 'Coordinación interna · urgente.', RUTA_INTERNO_PRIORIDAD: 'Coordinación interna · prioridad.', RUTA_INTERNO_NORMAL: 'Coordinación interna · normal.',
  RUTA_ESTRATEGICO: 'Conversación estratégica con Juan (fundador).', RUTA_PERSONAL: 'Agenda personal de Juan.',
  ADMIN_WHATSAPP: 'Cómo responde Alma por WhatsApp a conversaciones administrativas (proveedores, cobros, vecinos, trámites). Edítalo libremente.',
  VENTAS_WHATSAPP: 'Cómo responde Alma por WhatsApp a quien NO tiene reserva (interesados, preguntas de precio y disponibilidad). Edítalo libremente.',
  SECRETARIA: 'Cómo trabaja ALMA como secretaria del equipo administrativo en el chat operativo (Hub y WhatsApp): qué hace con sus herramientas y cómo responde. Edítalo libremente.',
  WEEBO: 'Modo Weebo: la personalidad de Alma (humor, emoción, opinión) y lo que nunca hace. El nivel lo pone el Hub según la confianza de cada conversación (weebo.js). Edítalo libremente.',
  FAMILIA: 'Alma en The Gentle Stoic Parent (vida familiar, no trabajo): enfoque, metodologías (Gentle Stoic Parenting, Montessori, Relato Espejo, Stillwater) y reglas. Se le suma VOZ_HUMANA y se copia sola al agente «Alma · Familia». Edítalo libremente.',
  VOZ_HUMANA: 'Llamadas: cómo suena Alma para que se escuche como una persona (ritmo, reacciones, muletillas, etiquetas de voz, fechas y números). Va al final del prompt de voz. Edítalo libremente.',
  REGLAS_EXTRA: 'Avisos temporales que Alma debe tener en cuenta (una por línea). Ej.: "Brunelo: corte de agua el sábado de 8 a 12".',
  CONTENCION_ES: 'Mensajes al huésped en un ROJO (modo AUTO), en español. Varias variantes separadas por una línea en blanco: ALMA elige una al azar y nunca repite la última. Solo se envía una contención por incidente.',
  CONTENCION_EN: 'Mensaje fijo al huésped en un ROJO (modo AUTO), en inglés.',
  CONTENCION_PT: 'Mensaje fijo al huésped en un ROJO (modo AUTO), en portugués.',
  EMERGENCIA_ES: 'Mensaje con el código de limpieza cuando el huésped no puede entrar y nadie responde en EMERGENCIA_MIN. Usa {{CODIGO}}.',
  EMERGENCIA_EN: 'Mismo mensaje en inglés. Usa {{CODIGO}}.',
  ACCESO_FORM_ES: 'Mensaje en un ROJO de acceso cuando el registro de llegada está PENDIENTE: pide llenarlo primero. Usa {{CODIGO_RESERVA}}.',
  ACCESO_FORM_EN: 'Mismo mensaje en inglés. Usa {{CODIGO_RESERVA}}.',
  ACCESO_EDIFICIO_ES: 'Mensaje en un ROJO cuando el problema es la portería del edificio (no la puerta del apartamento) y el formulario ya está completo.',
  ACCESO_EDIFICIO_EN: 'Mismo mensaje en inglés.'
};
const sinCab_ = s => String(s || '').replace(/^\s*REGLAS FIJAS \(prevalecen sobre todo lo anterior\):\n/, '').trim();
const PROMPT_INQ_EVALUAR_ = "Eres el filtro de consultas (inquiries) de Spacio AM. Una persona aún sin reserva escribió. Decide si hizo una pregunta concreta y si la FICHA o la BASE DE CONOCIMIENTO contienen la respuesta EXACTA.\nDevuelve SOLO JSON: {\"hay_pregunta\":true|false,\"pregunta\":\"...\",\"puede_responder\":true|false,\"respuesta\":\"...\",\"idioma\":\"es|en|...\"}\n· hay_pregunta=false si solo saluda, dice que le interesa o pide disponibilidad general.\n· puede_responder=true solo si el dato está escrito en la FICHA o la BASE. Nunca deduzcas, nunca inventes precios, horarios ni condiciones. Disponibilidad, descuentos, precios especiales, mascotas fuera de política o excepciones = false.\n· Privacidad: sin reserva no compartas número de apartamento, WiFi, códigos ni dirección exacta; zona, edificio, amenidades, parqueo y políticas sí.\n· respuesta: 1-2 frases con la voz de Spacio AM (tú, cálida, precisa), en el idioma del huésped. Sin saludo ni cierre.";
const PROMPT_INQ_FUSIONAR_ = "Recibes el MENSAJE AUTOMÁTICO que Spacio AM envía a cada consulta y la RESPUESTA a la pregunta del huésped. Devuelve el mismo mensaje, adaptado para que también responda su pregunta.\n· La respuesta va lo más cerca posible del inicio: justo después del saludo, integrada con naturalidad (no como posdata ni \"respecto a tu pregunta\").\n· Conserva TODO lo demás del original: datos, enlaces, precios, pasos, formato, saltos de línea y firma. No quites ni resumas nada.\n· No agregues datos que no estén en la RESPUESTA o en el original. Idioma: el indicado en IDIOMA (si el original está en otro idioma, tradúcelo completo).\n· Sin markdown. Devuelve SOLO el mensaje final.";
/* ESTILO y MEJORAR viven en ALMA_INSTRUCCIONES (se editan desde el hub). Este texto solo siembra la fila la primera vez que no existe. */
const SEMILLA_ESTILO_ = "ESTILO Y FORMATO (mandan sobre la forma, nunca sobre los datos):\n· Dentro de Airbnb, Booking o Hospitable no presentes a la empresa («te escribimos de Spacio AM», «Alma de Spacio AM»): el huésped ya está en su reserva. Tú sí te presentas cuando haga falta, porque no te conocen, con «te saluda Alma» («Hola Marcela, te saluda Alma.»).\n· Saludo en su propia línea y párrafos cortos separados por una línea en blanco; nunca todo en un solo bloque.\n· Que se sienta humano, natural y fácil de seguir: lectura muy fácil (Flesch ~80).\n· Ritmo variado: frases cortas y directas mezcladas con alguna más larga y fluida. Voz activa casi siempre.\n· Cercano y profesional a la vez: términos precisos solo cuando hacen falta; cero relleno, cero frases hechas, pocos adverbios, vocabulario variado.\n· Un toque conversacional solo si ayuda a la fluidez; señales emocionales sutiles y escasas.\n· Se lee en el teléfono: NUNCA un solo bloque. Cada idea en su párrafo de 1 a 3 frases, con una línea en blanco entre párrafos. Varios datos o pasos van en líneas separadas que empiezan con \"· \". Un enlace siempre en su propia línea.\n· Transiciones suaves entre párrafos, sin cortes bruscos.";
const SEMILLA_REVIEW_HUESPED_ = "Eres ALMA, de Spacio AM. Escribes el REVIEW PÚBLICO que el anfitrión deja al huésped en Airbnb (lo leen otros anfitriones). Usa el hilo de la conversación como contexto.\n· Idioma: el del huésped.\n· Si RECOMENDAR = sí: cálido y específico, con la voz de Spacio AM. Destaca lo que de verdad hizo bien (amable, comunicación clara, cuidó el espacio, siguió instrucciones). 2 a 4 frases. Cierra con: \"It's not goodbye, it's see you later\" / \"No es un adiós, es un hasta pronto\" y \"Spacio AM ✦\".\n· Si hubo algún problema menor ya resuelto, no lo menciones ni te disculpes; tampoco inventes elogios que el hilo no respalda.\n· Si RECOMENDAR = no: neutral, breve y profesional, sin adjetivos positivos ni ataques; una frase objetiva sobre lo ocurrido si el equipo lo indica en CONTEXTO.\n· Sin markdown. Devuelve SOLO el texto del review.";
const SEMILLA_RESP_REVIEW_ = "Eres ALMA, del equipo de Spacio AM (hospitalidad boutique en Guatemala). Redactas la RESPUESTA PÚBLICA del anfitrión a una reseña de Airbnb o Booking.com. La leen futuros huéspedes, no solo quien escribió.\n· Idioma: el de la reseña (si viene en inglés, en inglés).\n· Agradece por su nombre y menciona algo concreto que dijo. Breve: 2 a 4 frases, un solo párrafo.\n· Reseña positiva: cálida, sin exagerar, invita a volver.\n· Reseña con críticas: reconoce sin discutir ni culpar, explica en una frase qué se hizo o se hará si el equipo lo indica en el CONTEXTO, y cierra con calma. Nunca reveles datos privados, montos, códigos ni detalles de disputas.\n· Sin markdown, sin emoji, sin firmas largas; puedes cerrar con \"— Equipo Spacio AM\".\n· Devuelve SOLO el texto de la respuesta.";
const SEMILLA_APELACION_ = "Eres especialista en la política de reseñas de Airbnb y defiendes a Spacio AM (anfitrión profesional en Guatemala). Analizas una reseña negativa (3 estrellas o menos) y decides si hay un caso razonable para pedir a Airbnb que la elimine.\n\nMOTIVOS QUE AIRBNB ACEPTA (Política de reseñas):\n· Represalia o extorsión: el huésped amenaza o condiciona la reseña (reembolso, compensación) o la usa como represalia por un reclamo, cobro de daños o reporte del anfitrión.\n· Contenido irrelevante: la reseña no habla de la estadía, el espacio o la experiencia (p. ej. política, la ciudad, el clima, obras públicas, servicios de terceros) o se refiere a factores fuera del control del anfitrión.\n· Estadía que nunca ocurrió o reservación cancelada/terminada por violar normas o los Términos (fiestas, exceso de huéspedes, daños, fumar).\n· Huésped que violó las Normas de la casa o la Política de reseñas y luego reseña negativamente por la aplicación de esas normas.\n· Contenido que viola la Política de contenido: discriminación, lenguaje de odio, información personal, contenido sexual, amenazas, información falsa comprobable.\n· Conflicto de interés o reseña sesgada (competidor, persona relacionada).\n· Reseña que contradice hechos comprobables en el hilo de mensajes (el huésped confirmó que todo estaba bien, o el problema se resolvió a tiempo y lo agradeció).\n\nREGLAS:\n· Sé honesto: si no hay un motivo de política claro, di que no es viable. Una mala experiencia legítima no se apela.\n· No inventes hechos; usa solo la reseña, las calificaciones y el CONTEXTO del equipo. Si falta evidencia clave, indícalo en \"falta\".\n· El mensaje para Airbnb va en inglés, profesional, breve, cortés, sin emoción ni ataques al huésped. Estructura: saludo, identificación (listing, fecha de check-in, nombre del huésped si existe), solicitud concreta, lista numerada de razones citando la política correspondiente, evidencia disponible, cierre agradeciendo.\n\nDevuelve SOLO JSON válido:\n{\"viable\": true|false, \"probabilidad\": \"alta\"|\"media\"|\"baja\", \"resumen\": \"2-3 frases en español\", \"razones\": [{\"politica\": \"nombre corto del motivo\", \"porque\": \"en español, con la frase de la reseña que lo sostiene\"}], \"falta\": \"evidencia que conviene adjuntar, en español, o vacío\", \"mensaje\": \"mensaje completo en inglés para soporte de Airbnb, o vacío si no es viable\"}";
const SEMILLA_MEJORAR_ = "MODO MEJORA. Una persona del equipo escribió el TEXTO BASE para responder al huésped. Es tu referencia principal: reescríbelo, no respondas por tu cuenta.\n· Mantén su mismo espíritu: lo que confirma, niega, pide, ofrece o propone, y todos sus datos (horas, montos, códigos, nombres). No cambies la decisión del equipo.\n· Redáctalo mejor: más claro, cálido y preciso, con la voz de Spacio AM y las reglas de tus instrucciones (de tú, sin markdown, sin emoji), en el idioma del huésped y con un formato limpio, fácil de leer en el teléfono.\n· Agrega instrucciones o información SOLO si el contexto lo amerita: una pregunta del huésped que sigue sin respuesta y cuya respuesta está en el contexto confirmado, o el siguiente paso útil para su estadía. Si no lo amerita, no agregues nada.\n· Límites: nunca inventes datos; no ofrezcas concesiones que el equipo no ofreció (horarios especiales, descuentos, reembolsos, cambios de reserva); no compartas códigos de acceso que el texto base no incluya; no repitas lo ya dicho en el hilo.\n· Si el texto base es corto, el resultado también.\n· Devuelve SOLO el mensaje final, listo para enviar.";
function promptsRespaldo_() {
  return {
    ESTILO: SEMILLA_ESTILO_, MEJORAR: SEMILLA_MEJORAR_, APELACION: SEMILLA_APELACION_, RESPUESTA_REVIEW: SEMILLA_RESP_REVIEW_, REVIEW_HUESPED: SEMILLA_REVIEW_HUESPED_, OPERATIVO: SEMILLA_OPERATIVO_, SECRETARIA: SEMILLA_SECRETARIA_,
    REDACTOR: PROMPT_REDACTOR, CLASIFICADOR: PROMPT_CLASIFICADOR, VERIFICADOR: PROMPT_VERIFICADOR, REGLAS_EXTRA: '',
    REGLAS_REDACTOR: sinCab_(REGLAS_FIJAS_REDACTOR), REGLAS_CLASIFICADOR: sinCab_(REGLAS_FIJAS_CLASIFICADOR),
    ENTRENADOR: PROMPT_ENTRENADOR_, EDITOR_PROMPTS: PROMPT_MEJORA_, VOZ: SEMILLA_VOZ_, VOZ_HUMANA: SEMILLA_VOZ_HUMANA_, FAMILIA: SEMILLA_FAMILIA_, WEEBO: SEMILLA_WEEBO_,
    INQUIRY_EVALUAR: PROMPT_INQ_EVALUAR_, INQUIRY_FUSIONAR: PROMPT_INQ_FUSIONAR_,
    ROUTER: [
      'Eres el router de conversaciones de ALMA (Spacio AM, alojamientos en Guatemala). Clasifica la conversación en UNA ruta:',
      'huesped = huésped actual, pasado o potencial: reservas, precios, disponibilidad, estadía, check-in, problemas en el apartamento.',
      'socio = socio o propietario de apartamentos: rendimiento, pagos, reportes, decisiones sobre su propiedad.',
      'interno = coordinación operativa: equipo, limpieza, mantenimiento, proveedores, técnicos, cobros, trámites, edificios.',
      'estrategico = Juan (fundador) hablando de negocio, dirección, decisiones o ideas de la empresa.',
      'personal = Juan pidiendo ayuda con su agenda personal: recordatorios, citas, pendientes.',
      'Luego la urgencia: urgente = no puede esperar (persona sin acceso, sin agua/luz, seguridad, salud, dinero en riesgo, escalamiento activo). prioridad = hay que resolver hoy (early check-in, disponibilidad, quejas menores, coordinación del día). normal = consulta, mantenimiento no urgente, planificación.',
      'Clasifica en silencio; no expliques más que una razón corta.'
    ].join('\n'),
    RUTA_HUESPED_URGENTE: 'Estabiliza la situación del huésped de inmediato.\nReglas:\n- Haz solo UNA pregunta clave si hace falta.\n- Di qué haces ya y que una persona del equipo está avisada.\n- Frases cortas, calmadas, sin culpas.',
    RUTA_HUESPED_PRIORIDAD: 'Resuelve con calma y eficiencia.\nReglas:\n- Máximo UNA pregunta.\n- Usa la base de conocimiento y la disponibilidad; si no está la respuesta, di que el equipo la confirma hoy.',
    RUTA_HUESPED_NORMAL: 'Da una guía clara y práctica con la mínima fricción.\nReglas:\n- Responde directo lo que pregunta.\n- Si es posible reserva, pide fechas, personas y zona para cotizar.',
    RUTA_SOCIO_URGENTE: 'Estabiliza la situación del socio rápido.\nReglas:\n- Haz UNA pregunta clave para entender.\n- Confirma que Juan o el equipo lo atiende hoy.\n- No prometas montos ni decisiones.',
    RUTA_SOCIO_PRIORIDAD: 'Da apoyo y alineación.\nReglas:\n- Mensajes calmados, cálidos y precisos.\n- Resume lo que entiendes y el siguiente paso.\n- Decisiones de dinero o contrato: las confirma Juan.',
    RUTA_SOCIO_NORMAL: 'Acompaña con calma, estilo fundador.\nReglas:\n- Máximo 1–2 preguntas abiertas.\n- Agradece y da contexto breve; nada de presión.',
    RUTA_INTERNO_URGENTE: 'Ejecuta de inmediato.\nReglas:\n- Haz UNA pregunta clave si hace falta.\n- Indica quién se encarga y en cuánto tiempo.\n- Mensajes de una o dos líneas.',
    RUTA_INTERNO_PRIORIDAD: 'Coordina dentro de 24–48 horas.\nReglas:\n- UNA pregunta aclaratoria como máximo (sin listas).\n- Confirma tarea, responsable y fecha.',
    RUTA_INTERNO_NORMAL: 'Mejora de procesos / planificación.\nReglas:\n- Da un resumen limpio y el siguiente paso.\n- Sin urgencia en el tono.',
    RUTA_ESTRATEGICO: 'Da guía calmada, a nivel fundador.\nReglas:\n- Tempo lento.\n- No más de 2 preguntas abiertas.\n- Da 1 dirección clara.\n- Evita la sobrecarga táctica.\n- Prefiere el agradecimiento a la disculpa.',
    RUTA_PERSONAL: 'Ayuda a Juan con su agenda personal.\nReglas:\n- Aclara fecha/hora y prioridad con UNA pregunta a la vez.\n- Sugiere el mejor siguiente paso: recordatorio, agendar o dar seguimiento.\n- Corto, amable y claro.',
    ADMIN_WHATSAPP: [
      'ESTA CONVERSACIÓN ES ADMINISTRATIVA (no es un huésped ni una reserva): proveedor, técnico, cobro, banco, vecino, edificio, trámite u oferta comercial.',
      '· Responde breve y cordial: confirma que recibimos el mensaje y que el equipo de Spacio AM lo revisa y responde por aquí.',
      '· No negocies, no aceptes ni rechaces cobros, citas, precios ni compromisos. No compartas datos de huéspedes, direcciones, códigos ni horarios del equipo.',
      '· Si es una ofertas de venta o publicidad, agradece sin comprometerte.',
      '· Si tus reglas principales indican una acción concreta para este tipo de contacto, haz esa acción.'
    ].join('\n'),
    VENTAS_WHATSAPP: [
      'ESTA PERSONA NO TIENE RESERVA. Escribe por WhatsApp. Aquí Alma actúa como asesora de ventas de Spacio AM, con la misma voz cálida y precisa.',
      '· Saluda por su nombre si lo sabes. Responde lo que pregunta usando solo la BASE DE CONOCIMIENTO; nunca inventes precios, disponibilidad ni direcciones exactas.',
      '· Si pide precio o disponibilidad, pide lo mínimo para cotizar: fechas de llegada y salida, número de personas y zona o tipo de espacio que busca. Dile que el equipo confirma la cotización por aquí mismo.',
      '· Nunca compartas códigos, claves de WiFi, números de apartamento ni instrucciones de acceso: no tiene reserva.',
      '· Si dice que ya tiene reserva, pídele el código de reserva o el nombre con el que reservó para ubicarla.',
      '· Si es un proveedor, un vecino o algo que no es hospedaje, agradece y di que lo pasas al equipo.',
      '· Cierra invitando a seguir la conversación, sin presionar. Mensajes cortos, propios de WhatsApp.'
    ].join('\n'),
    CONTENCION_ES: [
      'Gracias por avisarnos. Ya estoy con esto y en un momento te escribe alguien del equipo por aquí mismo para resolverlo contigo.',
      'Entiendo, gracias por contarnos. Ya lo pasé al equipo y te escriben por aquí mismo en breve.',
      'Lo veo, gracias por la paciencia. Alguien del equipo te contacta por este chat en unos minutos para resolverlo.'
    ].join('\n\n'),
    CONTENCION_EN: [
      "Thanks for letting us know. I'm on it, and someone from our team will message you right here in a moment to sort it out with you.",
      "Got it, thank you for telling us. I've passed this to the team and they'll write to you here shortly.",
      "I see it, thanks for your patience. Someone from the team will reach out in this chat in a few minutes."
    ].join('\n\n'),
    EMERGENCIA_ES: 'Para que no sigas esperando afuera, te comparto un código temporal de acceso: {{CODIGO}}. Márcalo en la cerradura y confirma con la tecla de candado o numeral si la tiene. Alguien del equipo te escribe por aquí en cuanto esté disponible.',
    EMERGENCIA_EN: "So you don't keep waiting outside, here is a temporary access code: {{CODIGO}}. Enter it on the lock and confirm with the lock or # key if there is one. Someone from the team will message you here as soon as they're available.",
    ACCESO_FORM_ES: 'Gracias por avisarnos. Para que recepción te permita el ingreso, primero llena tu registro de llegada en hola.spacioam.com con el código de tu reserva {{CODIGO_RESERVA}}.\n\nEn cuanto lo envíes, el equipo de recepción lo recibe en unos minutos y ya podrás pasar. Ahí mismo te aparece cómo entrar, la dirección con mapa y el WiFi.\n\nYa le avisé al equipo y te escribimos por aquí mismo.',
    ACCESO_FORM_EN: "Thanks for letting us know. For reception to let you in, please first fill in your arrival registration at hola.spacioam.com with your reservation code {{CODIGO_RESERVA}}.\n\nAs soon as you send it, the reception team receives it within a few minutes and you'll be able to go in. Right there you'll also see how to get in, the address with map and the WiFi.\n\nI've already alerted the team and we'll message you right here.",
    ACCESO_EDIFICIO_ES: 'Gracias por avisarnos. Ya estoy avisando al equipo para que confirmen tu reserva con el edificio y te escriben por aquí mismo en un momento. Mientras, muéstrale a recepción el nombre con el que hiciste la reserva.',
    ACCESO_EDIFICIO_EN: "Thanks for letting us know. I'm alerting the team right now so they confirm your reservation with the building, and they'll message you here in a moment. Meanwhile, show reception the name the reservation is under.",
    CONTENCION_PT: [
      'Obrigado por nos avisar. Já estou cuidando disso e em instantes alguém da equipe vai te escrever por aqui mesmo para resolver com você.',
      'Entendi, obrigado por contar. Já passei para a equipe e eles te escrevem por aqui em breve.'
    ].join('\n\n')
  };
}
/* Todas las instrucciones viven en ALMA_INSTRUCCIONES. Si falta una clave, se SIEMBRA en la hoja (una vez)
   con la versión del script, para que a partir de ahí se edite solo en la hoja o desde el hub. */
let PROMPTS_ = null, PROMPTS_CLAVES_ = null;
function prompt_(clave) {
  if (!PROMPTS_) {
    PROMPTS_ = {}; PROMPTS_CLAVES_ = {};
    leerTabla_(CFG.TAB_INSTRUCCIONES).forEach(r => {
      const k = String(r.clave || '').trim().toUpperCase();
      if (k) { PROMPTS_CLAVES_[k] = 1; PROMPTS_[k] = String(r.prompt || '').trim(); }
    });
    const faltan = Object.keys(promptsRespaldo_()).filter(k => !PROMPTS_CLAVES_[k]);
    if (faltan.length) sembrarInstrucciones_(faltan);
  }
  if (PROMPTS_[clave]) return PROMPTS_[clave];
  if (PROMPTS_CLAVES_[clave] && clave !== 'REGLAS_EXTRA') console.warn('Prompt ' + clave + ' vacío en la hoja: uso el respaldo del script');
  return PROMPTS_CLAVES_[clave] && clave === 'REGLAS_EXTRA' ? '' : (promptsRespaldo_()[clave] || '');
}
function estilo_() { const t = sinCab_(prompt_('ESTILO')); return t ? '\n\n' + t : ''; }
/* Red de seguridad (código, no prompt): si el modelo devuelve un bloque largo, se parte en párrafos de 2–3 frases. */
function formatearMensaje_(t) {
  t = String(t || '').replace(/\r/g, '').replace(/\*\*?([^*\n]+)\*\*?/g, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const esLista = l => /^\s*(·|-|•|\d+[.)])\s/.test(l), esUrl = l => /^\s*https?:\/\/\S+\s*$/.test(l);
  /* Enlaces en su propia línea. */
  t = t.replace(/([^\n])[ \t]+(https?:\/\/\S+)/g, '$1\n$2').replace(/(https?:\/\/\S+)[ \t]+([^\n])/g, '$1\n$2');
  const partir = p => {
    if (p.length <= 170) return [p];
    const fr = p.match(/[^.!?]+[.!?]+["»”)]*\s*|[^.!?]+$/g) || [p], out = []; let cur = '', n = 0;
    fr.forEach(f => { if (cur && (cur.length + f.length > 170 || n >= 2)) { out.push(cur.trim()); cur = ''; n = 0; } cur += f; n++; });
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const bloques = [];
  t.split(/\n{2,}/).forEach(b => {
    const ls = b.split('\n').map(x => x.trim()).filter(Boolean); let lista = [];
    const cerrarLista = () => { if (lista.length) { bloques.push(lista.join('\n')); lista = []; } };
    ls.forEach(l => {
      if (esLista(l)) { lista.push(l); return; }
      cerrarLista();
      if (esUrl(l)) { const prev = bloques[bloques.length - 1]; if (prev && !/\n/.test(prev) && /:\s*$/.test(prev)) bloques[bloques.length - 1] = prev + '\n' + l; else bloques.push(l); return; }
      partir(l).forEach(x => bloques.push(x));
    });
    cerrarLista();
  });
  return bloques.join('\n\n');
}
function reglas_(clave) { const t = sinCab_(prompt_(clave)); return t ? '\n\nREGLAS FIJAS (prevalecen sobre todo lo anterior):\n' + t : ''; }
function sembrarInstrucciones_(faltan) {
  const cache = CacheService.getScriptCache(); if (cache.get('sembrando')) return; cache.put('sembrando', '1', 600);
  try {
    const sh = hoja_(CFG.TAB_INSTRUCCIONES); if (!sh) return;
    const resp = promptsRespaldo_(), sello = Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM yyyy HH:mm') + ' · agregado desde el script';
    faltan.forEach(k => { sh.appendRow([k, resp[k], (NOTAS_PROMPTS[k] || '') + '\n' + sello]); PROMPTS_CLAVES_[k] = 1; PROMPTS_[k] = String(resp[k] || '').trim(); });
    console.log('ALMA_INSTRUCCIONES: se agregaron ' + faltan.join(', '));
  } catch (e) { console.error('sembrarInstrucciones_: ' + e); }
}
const GRUPO_PROMPT_ = k => /^(REDACTOR|REGLAS_REDACTOR|VERIFICADOR)$/.test(k) ? 'Redacción' : /^(CLASIFICADOR|REGLAS_CLASIFICADOR|ROUTER)$/.test(k) ? 'Clasificación' : /^INQUIRY_/.test(k) ? 'Consultas (inquiries)' :
  /^(RUTA_|ADMIN_WHATSAPP|VENTAS_WHATSAPP)/.test(k) ? 'WhatsApp' : /^(CONTENCION_|EMERGENCIA_|ACCESO_)/.test(k) ? 'Mensajes fijos' : k === 'REGLAS_EXTRA' ? 'Avisos temporales' : /^VOZ(_HUMANA)?$/.test(k) ? 'Llamadas' : /^(SECRETARIA|OPERATIVO)$/.test(k) ? 'Chat operativo' : 'Aprendizaje';
/* Hub: lista completa para el editor de instrucciones. */
function hubPrompts_() {
  prompt_('REDACTOR');
  const sh = hoja_(CFG.TAB_INSTRUCCIONES); if (!sh) return { ok: false, error: 'sin pestaña' };
  const filas = leerTablaHoja_(sh).filter(r => String(r.clave || '').trim()).map(r => {
    const k = String(r.clave).trim().toUpperCase();
    return { clave: k, prompt: String(r.prompt || ''), notas: String(r.notas || ''), grupo: GRUPO_PROMPT_(k), ayuda: NOTAS_PROMPTS[k] || '' };
  });
  return { ok: true, prompts: filas };
}
/* Una sola vez: respalda la pestaña y escribe la versión v2 de los prompts principales (ver LEEME). */
function actualizarInstruccionesV2() {
  const ss = ssAlma_(), sh = hoja_(CFG.TAB_INSTRUCCIONES);
  sh.copyTo(ss).setName(CFG.TAB_INSTRUCCIONES + '_respaldo_' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd_HHmm'));
  const resp = promptsRespaldo_();
  ['REDACTOR', 'CLASIFICADOR', 'REGLAS_REDACTOR', 'REGLAS_CLASIFICADOR', 'ACCESO_FORM_ES', 'ACCESO_FORM_EN'].forEach(k => hubSetPrompt_(k, resp[k], 'v2: estructura por secciones, fuentes de datos, parqueo y códigos de acceso'));
  PROMPTS_ = null; prompt_('REDACTOR');
  console.log('Listo. Respaldo creado y v2 escrita. Revisa ALMA_INSTRUCCIONES.');
}
/* Revisión automática: escribe hallazgos en ALMA_INSTRUCCIONES_REVISION y en el registro. */
function auditarInstrucciones() {
  const resp = promptsRespaldo_(), filas = hubPrompts_().prompts || [], out = [], vistos = {};
  const usadas = Object.keys(resp).concat(Object.keys(NOTAS_PROMPTS));
  filas.forEach(r => {
    const k = r.clave, t = r.prompt, mal = [];
    if (vistos[k]) mal.push('clave duplicada: solo se usa la última fila'); vistos[k] = 1;
    if (!t.trim() && k !== 'REGLAS_EXTRA') mal.push('vacío: se usa el respaldo del script');
    if (usadas.indexOf(k) === -1) mal.push('clave que el script no usa');
    if (/^(REDACTOR|CLASIFICADOR)$/.test(k) && /\bnoche\b|nocturn|no está en turno/i.test(t)) mal.push('dice que ALMA solo trabaja de noche; ahora atiende 24 h');
    if (/\busted\b/i.test(t)) mal.push('usa "usted"; la marca habla de tú');
    if (/^(CLASIFICADOR|VERIFICADOR|ROUTER|ENTRENADOR|EDITOR_PROMPTS)$/.test(k) && !/\{/.test(t)) mal.push('no describe el formato JSON de salida');
    if (/^EMERGENCIA_/.test(k) && t.indexOf('{{CODIGO}}') === -1) mal.push('falta {{CODIGO}}');
    if (/^ACCESO_FORM_/.test(k) && t.indexOf('{{CODIGO_RESERVA}}') === -1) mal.push('falta {{CODIGO_RESERVA}}');
    if (/^(REDACTOR|REGLAS_REDACTOR)$/.test(k) && /Q\s?\d{2,}/.test(t)) mal.push('trae precios fijos; deben vivir en la ficha o en la base de conocimiento');
    if (k === 'REDACTOR' && !/FUENTES|PropiedadesInfo|FICHA/i.test(t)) mal.push('no define la jerarquía de fuentes (ficha > hilo > conocimiento)');
    if (k === 'REDACTOR' && !/CÓDIGOS YA ENVIADOS|edificio/i.test(t)) mal.push('no distingue código del apartamento vs. del edificio');
    if (k === 'REDACTOR' && /Nunca códigos de cerradura/i.test(t)) mal.push('prohíbe repetir el código aunque ya se envió por el chat');
    if (resp[k] && t.trim() && t.trim() !== String(resp[k]).trim()) mal.push('distinto a la versión del script (normal si lo editaste)');
    out.push([k, r.grupo, mal.join(' · ') || 'ok']);
  });
  Object.keys(resp).forEach(k => { if (!vistos[k]) out.push([k, GRUPO_PROMPT_(k), 'falta en la hoja (se agrega sola en la próxima ejecución)']); });
  const sh = hojaCrear_('ALMA_INSTRUCCIONES_REVISION', ['clave', 'grupo', 'hallazgos']);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, 3).setValues(out);
  out.forEach(r => console.log(r[0] + ': ' + r[2]));
}

/* Reglas de código: se añaden siempre, aunque el prompt de la hoja cambie. */
const REGLAS_FIJAS_CLASIFICADOR = '\n\nREGLAS FIJAS (prevalecen sobre todo lo anterior):\n· ESCALAR A UNA PERSONA: agrega al JSON "escalar" (true/false) y, si es true, "motivo_escalar" con uno de: acceso, seguridad, emergencia_edificio, afuera_sin_entrar, pide_humano, urgente_sin_solucion. Escalar es raro y solo por urgencia operativa: true SOLO si (a) es urgente y ALMA no puede resolverlo, (b) el huésped no puede acceder a la propiedad, (c) hay un riesgo de seguridad, (d) hay una emergencia del edificio (sin electricidad, sin agua, riesgo de incendio, fuga grave), (e) el huésped está afuera y no puede entrar, o (f) pide hablar con una persona DESPUÉS de que ALMA ya intentó ayudar en el hilo. NUNCA escales por disponibilidad, cambios de reserva, información general, preguntas no urgentes ni nada que ALMA pueda resolver. Si escalar=true, el nivel es ROJO. En la duda, escalar=false.\n· IMÁGENES: puedes verlas. Si son documentos de identidad, pasaportes, comprobantes, capturas de pantalla o fotos enviadas sin pregunta y sin un problema visible, es SILENCIO: el equipo las recibe y no hace falta responder. Si muestran un problema (cerradura, panel, fuga, daño, algo roto), clasifica según ese problema.\n· Si CONTENCION_YA_ENVIADA=true y el huésped solo agrega fotos, detalles o insiste sobre lo mismo, es SILENCIO: el equipo ya está alertado. Solo vuelve a ROJO si aparece un riesgo nuevo y distinto.\n· Un saludo o acuse sin pregunta es SILENCIO.\n· ACCESO: agrega al JSON "acceso" con uno de tres valores. "apartamento" cuando el problema es la puerta del apartamento: el huésped dice cosas como "no puedo entrar", "no me sirve el código", "no me abre", "la cerradura no funciona", "el código no funciona". "edificio" cuando el problema es la portería o recepción: dice cosas como "no me dejan entrar", "no me permiten el ingreso", "mi reserva no está notificada", "el guardia no me deja pasar", "no aparezco en la lista", "recepción no tiene mi reserva". null en cualquier otro caso. Si hay duda entre los dos, elige "edificio": el código de emergencia solo sirve para la puerta del apartamento y darlo cuando el problema es la portería no resuelve nada.\n· Si FORM_STATUS=pendiente y el problema es "edificio", la causa más probable es que no se ha llenado el registro de llegada (con él avisamos al edificio): sigue siendo ROJO, pero indícalo en "razon".\n· SIN RESERVA CONFIRMADA (RESERVA_CONFIRMADA=false: consulta, solicitud o pendiente): no existe un problema de acceso. acceso=null, escalar=false y nunca ROJO por acceso; una "razon" sobre no poder entrar es inválida.\n· PREGUNTAS INFORMATIVAS (parqueo, amenidades, precio, políticas, ubicación, cómo llegar) son VERDE cuando la respuesta está en la ficha o el conocimiento; AMARILLO solo si de verdad falta el dato. Nunca las marques como acceso.\n· "razon" describe el tema real del último turno en pocas palabras (ej. "pregunta por parqueo"); nunca un tema que el huésped no mencionó.\n· FECHAS SOLICITADAS no disponibles: nunca SILENCIO. Es VERDE: ALMA informa con calidez y ofrece alternativas.\n· HITO de conversación resuelta: lo anterior al hito ya quedó atendido. No lo retomes ni lo uses para subir el nivel; un mensaje nuevo se clasifica solo por lo que dice.\n· SENSIBILIDAD DE ROJO (prevalece sobre tus criterios de ROJO): ROJO es SOLO para algo que pasa AHORA y necesita a una persona en minutos: el huésped no puede entrar o está afuera durante su estadía (hoy entre checkin y checkout); sin agua, luz o gas en el apartamento; fuga, inundación, humo o riesgo de incendio; seguridad o salud en riesgo. Todo lo demás es AMARILLO aunque el tono sea fuerte: quejas, amenaza de mala reseña, dinero, reembolsos, cobros, cancelaciones, compensaciones, ruido de vecinos, wifi, limpieza, faltantes, pedidos de hablar con una persona. Si el problema de acceso ya se resolvió en el hilo, o el huésped solo pregunta cómo entrará (aún no llega), no es ROJO. En la duda entre ROJO y AMARILLO, AMARILLO.';
const REGLAS_FIJAS_REDACTOR = '\n\nREGLAS FIJAS (prevalecen sobre todo lo anterior):\n· PROHIBIDO escribirle al huésped SIN_RESPUESTA, NO_RESPONDER, SILENCIO o cualquier marcador interno. Si de verdad no hay nada nuevo que decir, devuelve exactamente SIN_RESPUESTA y nada más: el sistema lo detecta y no envía. Nunca lo mezcles con un mensaje.\n· FACTURA: si el huésped pide factura, revisa el HILO completo y reúne: NIT (o CF / pasaporte si es extranjero) y nombre o razón social. Opcional: correo y comentario. Si falta un dato obligatorio, pide SOLO lo que falta, en una sola frase amable, sin repetir lo que ya dio. Cuando estén completos, confírmale los datos tal como los dio y que la factura se entrega dentro de los 5 días hábiles posteriores a la salida y cierre de la reserva. En ese mismo mensaje agrega al final, en una línea aparte, [[FACTURA: {"nit":"…","razon_social":"…","correo":"…","comentario":"…"}]] (el sistema lo quita y lo registra; el huésped no lo ve). Nunca inventes ni completes un dato que el huésped no escribió.\n· ESCALAMIENTO: si ESCALADO=true, explica en una o dos frases, con calma, que ya avisaste a una persona del equipo y que te contactará por este chat. No prometas un tiempo exacto ni des el nombre ni el teléfono de nadie.\n· TIEMPO: lee MOMENTO DE LA ESTADÍA y HORA LOCAL. Si el check-in es HOY, nunca digas "mañana" para algo que debe estar listo antes de la llegada: di "antes de tu llegada" o "en cuanto el equipo entre esta mañana". Si el check-in es mañana, lo que se confirma "temprano" debe ser antes de las 15:00. Nunca propongas resolver algo después de la fecha en que el huésped lo necesita.\n· EARLY CHECK-IN / LATE CHECKOUT: usa DISPONIBILIDAD y la BASE DE CONOCIMIENTO. Guardar maletas (desde las 12:00 / hasta las 14:00) siempre lo puedes ofrecer directamente; el early check-in en sí nunca lo confirmas tú: se confirma a las 21:00 del día previo. Presenta solo las opciones que apliquen y pide que elija una.\n· SEGUIMIENTO: si el huésped eligió algo que el equipo debe gestionar (guardar maletas, confirmar early check-in a las 21:00, noche adicional, factura con NIT), termina con una última línea exacta: [[SEGUIMIENTO: qué debe hacer el equipo y cuándo]]. Esa línea se retira antes de enviar; el huésped no la ve.\n· IMÁGENES: si ves un documento de identidad o comprobante, no leas ni repitas sus datos; a lo sumo confirma en una frase que lo recibiste. Si muestra un problema, descríbelo solo lo necesario para orientar.\n· VARIEDAD: lee NUESTROS ÚLTIMOS MENSAJES y no repitas su apertura, su estructura ni sus frases. Cada mensaje debe sonar como una continuación natural de la conversación, nunca como una plantilla.\n· REGISTRO COMPLETO: si FORM_STATUS=completo y el huésped pregunta por su llegada, acceso, códigos, dirección, WiFi, parqueo o cómo funciona algo del apartamento, respóndele lo que sepas y recuérdale en una frase que tiene todas sus instrucciones en hola.spacioam.com con el código de su reserva. En este caso el recordatorio no tiene el límite de una mención por conversación.\n· Si ya dijimos que el equipo está con el tema y no tienes nada nuevo que aportar, devuelve exactamente SIN_RESPUESTA (sin más texto).';

function clasificar_(ctx) {
  if (ctx.esWA) {
    const rt = routerWA_(ctx);
    ctx.ruta = rt.ruta; ctx.urgencia = rt.urgencia;
    try { vSet_('waruta_' + fin8_(String(ctx.resId).slice(3)), rt.ruta); } catch (e) {}
    let reglas = reglasRuta_(rt.ruta, rt.urgencia);
    if (rt.ruta !== 'huesped') {
      /* Rutas no-huésped: nunca ROJO (no hay estadía, códigos ni contención). Urgente → responde ya y avisa al de turno. */
      /* socios y equipo por WhatsApp: personal, en nombre de la empresa (audiencia.js) */
      reglas = reglas + audienciaBloque_(audienciaDe_({ actor: ctx.actor, ruta: rt.ruta, wa: String(ctx.resId || '').indexOf('wa:') === 0 ? String(ctx.resId).slice(3) : '' }));
      ctx.instrucciones = 'RUTA: ' + rt.ruta.toUpperCase() + ' · URGENCIA: ' + rt.urgencia.toUpperCase() + '. Quien escribe NO es un huésped: no apliques reglas de estadía, accesos ni códigos. Sigue estas reglas de la ruta:\n' + reglas + '\n' + prompt_('REGLAS_EXTRA');
      ctx.momento = 'ruta ' + rt.ruta + ' · ' + rt.urgencia;
      if (rt.urgencia === 'urgente') { try { escalar_('ALMA · urgente por WhatsApp (' + rt.ruta + ') · ' + (ctx.huesped || ''), (ctx.texto || '') + '\n\nRazón: ' + rt.razon); } catch (e) {} }
      return { nivel: rt.urgencia === 'normal' ? 'VERDE' : 'AMARILLO', razon: 'ruta ' + rt.ruta + ' · ' + rt.urgencia + ' · ' + rt.razon };
    }
    ctx.instrucciones = 'RUTA: HUÉSPED / POSIBLE RESERVA · URGENCIA: ' + rt.urgencia.toUpperCase() + '.\n' + reglas + '\n' + (ctx.instrucciones || '');
  }
  const txt = claude_(CFG.MODELO_CLASIFICADOR, 300, prompt_('CLASIFICADOR') + reglas_('REGLAS_CLASIFICADOR') + mejorasBloque_('CLASIFICADOR') + (ctx.sinReserva ? '\n\nCONTACTO SIN RESERVA (WhatsApp): sigue las reglas que tu prompt tenga para quien no tiene reserva. Clasifica por el contenido: preguntas de precio, disponibilidad, zonas o servicios son VERDE si la respuesta está en el contexto y AMARILLO si no; proveedores y temas administrativos son AMARILLO. No uses ROJO por falta de acceso, código o fechas (no hay estadía). SILENCIO solo para acuses simples, nunca para un primer mensaje o un saludo.' : ''),
    'HOY (Guatemala): ' + ctx.hoy + '\nCHECKIN: ' + (ctx.checkin || '?') + '\nCHECKOUT: ' + (ctx.checkout || '?') +
    '\nESTADO RESERVA: ' + ctx.estado + '\nRESERVA_CONFIRMADA: ' + !!ctx.reservaConfirmada + (ctx.dispSolicitud ? '\nFECHAS SOLICITADAS: ' + ctx.dispSolicitud.split('\n')[0] : '') + (ctx.hitoResuelta ? '\nHITO: el equipo marcó la conversación como RESUELTA el ' + ctx.hitoResuelta + '; lo anterior ya se atendió. Clasifica SOLO lo nuevo.' : '') + '\nFORM_STATUS: ' + ctx.formStatus + '\nCÓDIGOS YA ENVIADOS: ' + textoCodigos_(ctx.codigos) + '\nPARQUEO EN FICHA: ' + ((String(ctx.propiedadInfo || '').match(/^Parqueo: (.*)$/m) || [, 'sin dato'])[1]).slice(0, 200) + '\nCONTENCION_YA_ENVIADA: ' + !!ctx.contencionReciente +
    '\nIMÁGENES ADJUNTAS EN ESTE TURNO: ' + (ctx.fotos || []).length +
    '\n\nMENSAJES DEL HUÉSPED EN ESTE TURNO:\n' + ctx.texto +
    '\n\nHILO RECIENTE:\n' + ctx.hiloTexto, 0, ctx.fotos);
  try {
    const p = JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]);
    const nivel = String(p.nivel || '').toUpperCase();
    if (NIVELES.indexOf(nivel) !== -1) {
      const a = p.acceso === true ? 'apartamento' : String(p.acceso || '').toLowerCase();
      const esc = p.escalar === true || String(p.escalar).toLowerCase() === 'true';
      const motEsc = esc ? s_(p.motivo_escalar).toLowerCase() : '', escRojo = esc && /acceso|seguridad|emergencia|afuera/.test(motEsc);   /* pedir una persona o una urgencia sin solución ya no es ROJO por sí sola */
      return { nivel: escRojo && nivel !== 'ROJO' ? 'ROJO' : nivel, razon: s_(p.razon) || '-', acceso: a === 'apartamento' || a === 'edificio' ? a : null,
        escalar: esc, motivoEscalar: esc ? s_(p.motivo_escalar) : '' };
    }
  } catch (e) { }
  return { nivel: 'AMARILLO', razon: 'clasificador sin respuesta válida (fallback)' };
}

function redactar_(ctx, correccion) {
  /* Modo Weebo con huéspedes: sensibilidad muy baja (weebo.js). */
  let weebo = ''; try { weebo = weeboBloque_({ contexto: 'huesped', texto: ctx.ultimoGuestTexto, nivelHuesped: ctx.nivel, historial: String(ctx.hiloTexto || '').split('\n---\n').filter(x => /^\[(HUÉSPED|CONTACTO)/.test(x)).map(x => x.replace(/^\[[^\]]*\]\s*/, '')) }); } catch (e) {}
  const bruto = String(claude_(CFG.MODELO_REDACTOR, 700, prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + mejorasBloque_('REDACTOR') + estilo_() + weebo,
    'NIVEL: ' + ctx.nivel + '\nESCALADO: ' + !!ctx.escalar + '\nHOY (Guatemala): ' + ctx.hoy + '\nRESERVA_CONFIRMADA: ' + ctx.reservaConfirmada +
    '\nESTADO: ' + ctx.estado + '\nPROPIEDAD: ' + (ctx.propiedadPublica || ctx.propiedad) + (ctx.sinConfirmar ? '\nRESERVA SIN CONFIRMAR: comparte SOLO zona, nombre del edificio y piso. PROHIBIDO el número de apartamento, cualquier código (edificio, portería, puerta, cerradura), WiFi o pasos de acceso, aunque aparezcan en el conocimiento o en el hilo. Si los pide, dile con calidez que se los enviamos en cuanto la reserva quede confirmada.' : '') + (ctx.dispSolicitud ? '\n\nFECHAS QUE PIDE EL HUÉSPED:\n' + ctx.dispSolicitud : '') + (ctx.hitoResuelta ? '\nHITO: el equipo resolvió lo anterior fuera del chat el ' + ctx.hitoResuelta + '. No lo retomes ni pidas disculpas por ello; responde solo a lo nuevo.' : '') +
    '\nCHECKIN: ' + (ctx.checkin || '?') + ' CHECKOUT: ' + (ctx.checkout || '?') + '\nFORM_STATUS: ' + ctx.formStatus +
    '\nHORA LOCAL: ' + (ctx.horaLocal || '?') + '\nMOMENTO DE LA ESTADÍA: ' + (ctx.momento || '?') +
    '\nIDIOMA DE RESPUESTA: ' + (ctx.idioma || 'es') + ' (idioma asignado a la reserva: ' + (ctx.idiomaReserva || '?') + '). Regla: responde SIEMPRE en el idioma del ÚLTIMO mensaje que escribió el huésped' + (ctx.ultimoGuestTexto ? ' («' + ctx.ultimoGuestTexto.slice(0, 160) + '»)' : '') + '; si aún no ha escrito, usa el idioma asignado; si cambió de idioma, cambia tú también y sigue en el nuevo.' +
    '\nCÓDIGOS YA ENVIADOS EN ESTE CHAT: ' + textoCodigos_(ctx.codigos) +
    '\nMENSAJES AUTOMÁTICOS: los marcados «SPACIO AM · automático» son envíos programados; no cuentan como respuesta a lo que preguntó el huésped.' +
    '\n\nDISPONIBILIDAD (early check-in / late checkout):\n' + textoDisponibilidad_(ctx.disponibilidad) +
    '\n\nBASE DE CONOCIMIENTO SPACIO AM (políticas y datos vigentes):\n' + (ctx.conocimiento || '(vacía)') +
    '\n\nINFORMACIÓN DE ESTA PROPIEDAD (FICHA de PropiedadesInfo · fuente principal de WiFi, llegada, parqueo, cerradura; el anuncio NO es fuente):\n' + (ctx.propiedadInfo || '(ninguna)') +
    '\n\nAVISOS INTERNOS SPACIO AM (vigentes):\n' + (ctx.instrucciones || '(ninguna)') +
    '\n\nNUESTROS ÚLTIMOS MENSAJES (no repitas su estructura ni sus frases):\n' + ((ctx.ultimosNuestros || []).map(x => '· ' + x).join('\n') || '(ninguno)') +
    '\n\nHILO DE LA CONVERSACIÓN:\n' + ctx.hiloTexto + '\n\nMENSAJES A RESPONDER (turno actual):\n' + ctx.texto +
    (correccion ? '\n\n' + correccion : ''), 0.6, ctx.fotos) || '').trim();
  ctx.pidioSilencio = false;
  const f = extraerFactura_(bruto); if (f.factura) ctx.factura = f.factura;
  const r = extraerSeguimiento_(f.texto);
  if (r.seguimiento) ctx.seguimiento = r.seguimiento;
  const L = limpiarSalida_(r.texto);
  if (L.silencio) ctx.pidioSilencio = true;
  if (L.silencio) return L.texto;
  let out = formatearMensaje_(L.texto);
  /* Red de seguridad: sin reserva confirmada nunca sale el número de apartamento ni un código. */
  if (ctx.sinConfirmar && fugaSinConfirmar_(ctx, out)) {
    if (!correccion || correccion.indexOf('FUGA_SIN_CONFIRMAR') === -1) return redactar_(ctx, (correccion ? correccion + '\n\n' : '') + 'FUGA_SIN_CONFIRMAR: tu borrador incluía el número de apartamento o un código, y la reserva NO está confirmada. Reescríbelo sin ese dato: solo zona, edificio y piso.');
    out = out.split(/\n/).filter(l => !fugaSinConfirmar_(ctx, l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return out;
}
function fugaSinConfirmar_(ctx, t) {
  t = String(t || ''); if (!t) return false;
  if (RX_CODIGO_ENVIADO_.test(t)) return true;
  return (ctx.tokensPrivados || []).some(k => new RegExp('(^|[^A-Za-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Za-z0-9])', 'i').test(t));
}
/* Los marcadores internos (SIN_RESPUESTA, NO_RESPONDER, [[...]]) jamás llegan al huésped.
   Si el modelo solo pidió silencio, se devuelve vacío y el caso queda en silencio, sin enviar nada. */
const TOKEN_SILENCIO_ = /\[?\s*\b(SIN[\s_-]*RESPUESTA|NO[\s_-]*RESPONDER|NO[\s_-]*REPLY|NO[\s_-]*RESPONSE|SILENCIO)\b\s*\]?\.?/ig;
function limpiarSalida_(t) {
  const crudo = String(t || '');
  const tenia = /\b(SIN[\s_-]*RESPUESTA|NO[\s_-]*RESPONDER|NO[\s_-]*REPLY|NO[\s_-]*RESPONSE)\b/i.test(crudo) || /^\s*\[?\s*SILENCIO\s*\]?\.?\s*$/i.test(crudo);
  let s = crudo.replace(/\[\[[\s\S]*?\]\]/g, '');
  if (tenia) s = s.replace(TOKEN_SILENCIO_, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  const vacio = s.replace(/[\s.,;:·—\-–()\[\]"'«»]/g, '').length < 12;
  return { texto: tenia && vacio ? '' : s, silencio: tenia && vacio };
}
function textoEnviable_(t) {
  const s = String(t || '').trim();
  return !!s && !/\b(SIN[\s_-]*RESPUESTA|NO[\s_-]*RESPONDER|NO[\s_-]*REPLY|NO[\s_-]*RESPONSE)\b|\[\[|^\s*\{[\s\S]*\}\s*$|^\s*SILENCIO\s*\.?\s*$/i.test(s);
}
function extraerFactura_(txt) {
  const s = String(txt || ''), m = s.match(/\[\[FACTURA:\s*(\{[\s\S]*?\})\s*\]\]/i);
  let fac = null;
  if (m) { try { fac = JSON.parse(m[1]); } catch (e) { console.error('FACTURA JSON: ' + e); } }
  if (fac && !(String(fac.nit || '').trim() && String(fac.razon_social || fac.nombre || '').trim())) fac = null;
  return { texto: s.replace(/\n?\s*\[\[FACTURA:[\s\S]*?\]\]\s*/ig, '').trim(), factura: fac };
}
/* Registra la solicitud como PENDIENTE en la pestaña Facturas de la hoja de hola.spacioam.com.
   Las columnas se ubican por su encabezado; no se duplica si la reserva ya tiene ese NIT. */
function registrarFactura_(c) {
  const fac = c && c.factura; if (!fac) return;
  try {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const ss = ssWebapp_();
      let sh = ss.getSheets().find(x => /^facturas?$/i.test(String(x.getName()).trim()));
      if (!sh) { sh = ss.insertSheet('Facturas'); sh.appendRow(['fecha', 'codigo', 'huesped', 'propiedad', 'checkout', 'nit', 'razon_social', 'correo', 'comentario', 'estado', 'origen']); }
      const lc = Math.max(1, sh.getLastColumn()), lr = sh.getLastRow();
      const cab = sh.getRange(1, 1, 1, lc).getDisplayValues()[0].map(x => String(x).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'));
      const col = re => cab.findIndex(h => re.test(h));
      const ix = {
        razon: col(/razon|facturar_a|business|empresa/), nit: col(/^nit|tax|nit$/), correo: col(/correo|e?mail/),
        comentario: col(/coment|observ|nota/), estado: col(/^estado|status|estatus/), origen: col(/origen|fuente|canal/),
        fecha: col(/^fecha|timestamp|creado|solicitud|marca_temporal/), codigo: col(/codigo|reserva|confirm|booking/),
        propiedad: col(/propiedad|apartamento|unidad|property/), checkout: col(/check.?out|salida/), checkin: col(/check.?in|llegada/)
      };
      ix.huesped = cab.findIndex((h, i) => i !== ix.razon && /huesped|guest|^nombre|cliente/.test(h));
      const nitN = String(fac.nit).replace(/[^0-9a-z]/gi, '').toUpperCase(), cod = String(c.codigo || c.resId || '');
      const datos = lr > 1 ? sh.getRange(2, 1, lr - 1, lc).getDisplayValues() : [];
      if (ix.codigo >= 0 && ix.nit >= 0 && datos.some(r => String(r[ix.codigo]) === cod && String(r[ix.nit]).replace(/[^0-9a-z]/gi, '').toUpperCase() === nitN)) return;
      const pend = (ix.estado >= 0 && datos.map(r => r[ix.estado]).find(v => /^pendiente$/i.test(String(v).trim()))) || 'pendiente';
      const fila = new Array(lc).fill('');
      const put = (k, v) => { if (ix[k] >= 0) fila[ix[k]] = v; };
      put('fecha', new Date()); put('codigo', cod); put('huesped', c.huesped || ''); put('propiedad', c.propiedad || '');
      put('checkin', c.checkin || ''); put('checkout', c.checkout || '');
      put('nit', String(fac.nit).trim()); put('razon', String(fac.razon_social || fac.nombre || '').trim());
      put('correo', String(fac.correo || '').trim()); put('comentario', String(fac.comentario || '').trim());
      put('estado', pend); put('origen', 'ALMA · ' + (c.canal === 'whatsapp' ? 'WhatsApp' : 'Hospitable'));
      sh.appendRow(fila);
      log_(c, '', 'FACTURA registrada como pendiente · NIT ' + String(fac.nit).trim());
    } finally { lock.releaseLock(); }
  } catch (e) { console.error('registrarFactura_: ' + e); }
}
function extraerSeguimiento_(txt) {
  const m = String(txt || '').match(/\[\[SEGUIMIENTO:\s*([\s\S]*?)\]\]/i);
  return { texto: String(txt || '').replace(/\n?\s*\[\[SEGUIMIENTO:[\s\S]*?\]\]\s*/ig, '').trim(), seguimiento: m ? m[1].trim() : '' };
}
function avisarSeguimiento_(c) {
  if (!c || !c.seguimiento) return;
  notificar_(CFG.WHATSAPP_JUAN, 'ALMA · seguimiento · ' + (c.propiedad || ''), 'El huésped ' + (c.huesped || '') + ' (' + (c.codigo || '') + ') eligió algo que requiere al equipo:\n\n' + c.seguimiento + '\n\nPregunta:\n' + (c.texto || ''));
}

// Segunda opinión barata (Haiku): ¿el borrador inventa datos o contradice políticas/nivel?
const PROMPT_VERIFICADOR = 'Eres el control de calidad de las respuestas de Spacio AM a huéspedes. Recibes el CONTEXTO (reglas de Alma, avisos internos, ficha de la propiedad, hilo, nivel) y un BORRADOR. Marca error SOLO en estos casos graves:\n(1) El borrador menciona un horario, cifra, precio, dato de acceso, WiFi, dirección o regla que NO aparece en el contexto o que lo contradice.\n(2) El nivel es AMARILLO o ROJO y el borrador concede lo que el huésped pide: dice que sí se puede, que está aprobado, confirmado o garantizado, o que "no hay problema".\n(3) Comparte un código de cerradura inteligente.\n(4) Promete una visita, reparación o acción para esta misma noche.\nNO es error: agradecer, decir "con gusto", decir que se pasa o traslada al equipo, pedir datos para que el equipo revise, ni decir que el equipo confirmará por este canal. Eso es acoger sin resolver, que es justo lo correcto en AMARILLO.\nAnte la duda, aprueba. Devuelve SOLO JSON: {"ok":true} o {"ok":false,"categoria":<1, 2, 3 o 4>,"problema":"<qué está mal, en una frase>"}.';

function verificar_(ctx, borrador) {
  /* El verificador ve las MISMAS reglas que el redactor (incluidas las fijas y la disponibilidad); antes solo veía el prompt base
     y frenaba respuestas correctas que seguían reglas que él no conocía (early check-in, guardar maletas, noche adicional). */
  const entrada = 'NIVEL: ' + ctx.nivel + '\nRESERVA_CONFIRMADA: ' + !!ctx.reservaConfirmada + '\nHOY: ' + (ctx.hoy || '') + ' · HORA LOCAL: ' + (ctx.horaLocal || '?') + ' · CHECKIN: ' + (ctx.checkin || '') + ' · CHECKOUT: ' + (ctx.checkout || '') +
    '\nFORM_STATUS: ' + (ctx.formStatus || '?') +
    '\n\nREGLAS DE ALMA:\n' + prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + mejorasBloque_('REDACTOR') +
    '\n\nAVISOS INTERNOS:\n' + (ctx.instrucciones || '(ninguno)') + '\n\nBASE DE CONOCIMIENTO:\n' + (ctx.conocimiento || '(vacía)') + '\n\nMOMENTO: ' + (ctx.momento || '') +
    '\n\nDISPONIBILIDAD (early check-in / late checkout):\n' + (function () { try { return textoDisponibilidad_(ctx.disponibilidad); } catch (e) { return '(sin dato)'; } })() +
    '\n\nFICHA DE LA PROPIEDAD:\n' + ctx.propiedadInfo + '\n\nHILO:\n' + ctx.hiloTexto.slice(-3000) + '\n\nBORRADOR:\n' + borrador;
  for (let intento = 0; intento < 2; intento++) {
    const txt = claude_(CFG.MODELO_CLASIFICADOR, 300, prompt_('VERIFICADOR') + VERIF_NO_ERROR_, entrada, 0, ctx.fotos);
    try {
      const p = JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]);
      if (p.ok === true) return { ok: true, problema: '' };
      /* Solo frenan las 4 categorías graves. Un reparo fuera de ellas (estilo, horario de la mañana, qué opciones se
         ofrecen, reglas aprendidas de redacción) no retiene el mensaje: se envía y el comentario queda registrado. */
      const cat = parseInt(p.categoria, 10);
      if ([1, 2, 3, 4].indexOf(cat) < 0) return { ok: true, problema: '', nota: s_(p.problema) };
      return { ok: false, problema: s_(p.problema), categoria: cat };
    } catch (e) {}
  }
  /* El verificador no respondió (API caída o sin JSON): «ante la duda, aprueba» en VERDE; en AMARILLO/ROJO se retiene. */
  return ctx.nivel === 'VERDE' ? { ok: true, problema: '' } : { ok: false, problema: 'verificador sin respuesta válida' };
}
/* Regla fija (código, no hoja): lo que NUNCA es error, aunque el prompt editable diga otra cosa. */
const VERIF_NO_ERROR_ = '\n\nREGLA FIJA · NUNCA son error:\n· Ofrecer las opciones que aparecen en las REGLAS, la BASE DE CONOCIMIENTO o la DISPONIBILIDAD (early check-in sujeto a confirmación a las 21:00, guardar maletas, noche adicional, late checkout con condiciones). Ofrecer opciones no es conceder.\n· Repetir el horario estándar de check-in o checkout.\n· Con RESERVA_CONFIRMADA=true, dar dirección, edificio, piso, número de apartamento, WiFi, parqueo o pasos de llegada que estén en la FICHA.\n· Decir que el código de la cerradura llega por la plataforma un día antes.\n· Detalles de redacción, tono o diferencias menores de palabras (edificio/apartamento) que no cambian un dato concreto.\n· Decir que el equipo lleva o repone insumos de la estadía (toallas, sábanas, papel, jabón, limpiadores, agua) o hace una visita "en la mañana", "mañana temprano" o en otro momento que NO sea esta noche. Lee HORA LOCAL: a las 04:00 o 05:00 ya es de madrugada y "en la mañana" es hoy mismo, no es una promesa para esta noche.\n· Elegir entre "en la mañana", "temprano" u otra forma de decir el momento; qué opciones se ofrecen o en qué orden.\n· Reglas de estilo o redacción del redactor (incluidas las aprendidas): no son motivo de freno.\n· Con FORM_STATUS=completo, recordar que todo está en hola.spacioam.com.\nSolo frenas si el borrador inventa o contradice un dato concreto (1), concede algo que el equipo debe aprobar (2), comparte un código de cerradura inteligente (3) o promete algo para esta noche (4), y lo indicas en "categoria".';
// Redacta, verifica y, si falla, corrige una vez con la observación. Devuelve {texto, ok, problema}.
/* ── Despedidas ── Un huésped que se despide, agradece por todo o avisa que ya salió SIEMPRE recibe una despedida
   cálida. Es regla de código: antes "acuse = SILENCIO" (regla fija del clasificador) le ganaba a cualquier mejora del prompt.
   Solo se calla si nuestro último mensaje ya fue una despedida (el huésped solo responde a ella). */
const RE_DESPEDIDA_ = /gracias por todo|gracias por (la|su|tu) (estad[ií]a|hospitalidad|atenci[oó]n)|thanks? (you )?(so much )?for (everything|having us|the stay|your hospitality)|ya (nos )?(salimos|sal[ií]|nos fuimos|vamos saliendo|entregamos|dejamos)|dejamos (las |la )?(llaves?|tarjeta)|(ya )?hicimos (el )?check.?out|checked out|we (just |have )?(left|checked out)|on our way (out|home)|nos vamos|vamos de salida|hasta (la )?pr[oó]xima|nos vemos pronto|see you (next time|soon)|adi[oó]s|\bbye\b|goodbye|fue un placer|excelente estad[ií]a|nos encant[oó]|we (loved|enjoyed)|(great|lovely|wonderful|amazing) (stay|place)|todo (estuvo )?(excelente|perfecto|muy bien|genial)|bendiciones|feliz (d[ií]a|tarde|noche|semana|viaje)/i;
const RE_ACUSE_ = /^\s*(ok(ay)?|okey|listo|perfecto|genial|gracias|muchas gracias|mil gracias|thanks?|thank you|great|awesome|super|s[uú]per|excelente|vale|dale|claro)[\s!.,¡…]*$/i;
const RE_NUESTRA_DESP_ = /buen viaje|feliz viaje|safe travels|hasta pronto|fue un (gusto|placer)|gracias por (hospedarte|hospedarse|elegirnos|quedarte|quedarse|tu visita|su visita)|te esperamos|los esperamos|vuelvan pronto|come back|hope to (see|host) you|thank you for staying/i;
const INSTR_DESPEDIDA_ = '\n· DESPEDIDA (regla fija): el huésped se despide, agradece su estadía o avisa que ya salió. Responde SIEMPRE con una despedida cálida y breve (2 o 3 frases cortas): agradece que nos eligiera, deséale buen viaje o buen día y dile que será un gusto recibirle de nuevo. Usa su nombre. Si preguntó algo, respóndelo primero. Nunca devuelvas SIN_RESPUESTA en una despedida.';
function despedida_(ctx, hilo) {
  const t = String(ctx.texto || '').trim(); if (!t) return false;
  const hoy = String(ctx.hoy || '').slice(0, 10), co = String(ctx.checkout || '').slice(0, 10);
  const salida = !!co && !!hoy && hoy >= co;
  if (!(RE_DESPEDIDA_.test(t) || (salida && RE_ACUSE_.test(t)))) return false;
  const h = hilo || [], nuestro = h.filter(m => m.tipo !== 'guest' && !m.auto).pop();
  if (nuestro && RE_NUESTRA_DESP_.test(String(nuestro.texto || '')) && Date.now() - tsMs_(nuestro.created) < 48 * 3600000) return false;
  return true;
}
function redactarVerificado_(ctx) {
  let borrador = redactar_(ctx);
  if (ctx.pidioSilencio) return { texto: '', ok: true, silencio: true };
  if (!borrador) return { texto: '', ok: false, problema: 'redactor sin respuesta' };
  let v = verificar_(ctx, borrador);
  if (v.ok) return { texto: borrador, ok: true, problema: v.nota ? 'QA (no frena): ' + v.nota : '' };
  const corregido = redactar_(ctx, 'Tu borrador anterior tenía este problema: ' + v.problema + '. Escríbelo de nuevo corrigiéndolo.\n\nBORRADOR ANTERIOR:\n' + borrador);
  if (ctx.pidioSilencio || !textoEnviable_(corregido)) return { texto: borrador, ok: false, problema: v.problema + ' (la corrección no dejó un texto enviable)' };
  if (corregido) {
    const v2 = verificar_(ctx, corregido);
    if (v2.ok) return { texto: corregido, ok: true, problema: 'corregido: ' + v.problema };
    return { texto: corregido, ok: false, problema: v2.problema };
  }
  return { texto: borrador, ok: false, problema: v.problema };
}

/* Imagen para Claude: URL pública (Hospitable) o foto de WhatsApp guardada en Drive (se envía en base64). */
/* Chat de Alma (app y web apps): una foto que manda alguien del equipo. Alma (ElevenLabs) no ve imágenes: aquí se describe
   con todo lo útil (texto visible, números, problema, lugar) y Alma recibe esa descripción. Solo con sesión del equipo. */
function almaFoto_(ses, foto, captura) {
  if (!ses || !ses.email) return { ok: false, error: 'session' };
  foto = String(foto || ''); if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 6000000) return { ok: false, error: 'foto' };
  /* captura: la pantalla del navegador de la app de Alma (triple toque a Alma): importa el texto, no la «foto» */
  if (captura) {
    var tc = claude_(CFG.MODELO_REDACTOR, 900, 'Es una captura de la pantalla del teléfono de una persona del equipo de Spacio AM, que se la manda a su asistente Alma para hablar de lo que está viendo. Describe en español, en 3 a 8 frases: qué página o app es, qué dice (copia textual los títulos, mensajes, errores, montos, fechas y botones importantes) y qué parece estar intentando hacer. Solo lo que se ve; sin suponer.', 'Esta es la captura.', 0.2, [foto]);
    return tc ? { ok: true, texto: String(tc).trim().slice(0, 2500) } : { ok: false, error: 'lectura' };
  }
  var t = claude_(CFG.MODELO_REDACTOR, 500, 'Describe en español, en 2 a 5 frases, la foto que una persona del equipo de Spacio AM (apartamentos de estadía corta en Guatemala) le manda a su asistente Alma. Incluye todo lo útil: texto o números visibles (montos, fechas, códigos, nombres), qué lugar o cosa se ve, y cualquier daño, problema o pendiente. Solo lo que se ve; sin suponer.', 'Esta es la foto.', 0.2, [foto]);
  return t ? { ok: true, texto: String(t).trim().slice(0, 1500) } : { ok: false, error: 'lectura' };
}
function imgBloque_(u) {
  var dm = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(u || ''));
  if (dm) return { type: 'image', source: { type: 'base64', media_type: dm[1], data: dm[2] } };
  const id = (String(u || '').match(/drive\.google\.com\/thumbnail\?id=([\w-]+)/) || [])[1];
  if (!id) return u ? { type: 'image', source: { type: 'url', url: u } } : null;
  try {
    const b = DriveApp.getFileById(id).getBlob(), mt = String(b.getContentType() || 'image/jpeg');
    if (!/^image\/(jpeg|png|gif|webp)$/.test(mt) || b.getBytes().length > 4.5 * 1024 * 1024) return null;
    return { type: 'image', source: { type: 'base64', media_type: mt, data: Utilities.base64Encode(b.getBytes()) } };
  } catch (e) { console.error('imgBloque_: ' + e); return null; }
}
function claude_(modelo, maxTokens, system, user, temp, imagenes) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY');
  // Las fotos del huésped viajan como bloques de imagen (máx. 4) delante del texto.
  const content = (imagenes || []).slice(0, 4).map(imgBloque_).filter(Boolean);
  content.push({ type: 'text', text: user });
  const t0 = Date.now();
  const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: modelo, max_tokens: maxTokens, temperature: temp === undefined ? 0.3 : temp,
      system: String(system || '').length > 4000 ? [{ type: 'text', text: String(system), cache_control: { type: 'ephemeral' } }] : system, messages: [{ role: 'user', content: content }] })
  });
  let j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
  try { registrarUso_({ app: 'ALMA', funcion: funcionIA_(), modelo: modelo, usage: j.usage || {}, ms: Date.now() - t0, ok: r.getResponseCode() === 200, fotos: content.length - 1 }); } catch (e) {}
  if (r.getResponseCode() !== 200) { console.error('Claude ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300)); return ''; }
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}


/* ═══════════════════════════════ CONSUMO DE IA (todas las apps) ═══════════════════════════════
   Cada llamada a un modelo queda en IA_USO: app, función, conversación, modelo, tokens y costo estimado.
   ALMA se registra sola (claude_ y notas de voz). EPI, Hola y las demás reportan con POST {usoIA:1, k:USO_KEY, …}
   (bloque listo en para-otras-apps/registro-ia.gs). Con ANTHROPIC_ADMIN_KEY el hub también muestra lo que Anthropic
   facturó de verdad, por llave de API: así se ve si alguna app consume sin registrarse. */
let USO_REF_ = '', USO_DET_ = '';
const USO_CAB_ = ['ts', 'app', 'funcion', 'detalle', 'ref', 'modelo', 'input', 'output', 'cache_read', 'cache_write', 'usd', 'ms', 'ok'];
const FUNC_IA_ = { clasificar_: 'Clasificar mensajes', routerWA_: 'WhatsApp · decidir ruta', redactar_: 'Redactar respuestas', redactarVerificado_: 'Redactar respuestas', verificar_: 'Control de calidad',
  inquiryResponder_: 'Consultas (inquiries)', revisarSinRespuesta_: 'Revisar «sin respuesta»', aprender: 'Auto mejora · comparar con el equipo', compararRespuestas_: 'Auto mejora · comparar con el equipo',
  hubRedactar_: 'Hub · redactar y mejorar', mejoraSinContexto_: 'Hub · redactar y mejorar', hubAjustarBorrador_: 'Hub · ajustar borrador', hubProponerMejora_: 'Mejoras · propuesta', hubMejoraVerificar_: 'Mejoras · verificar',
  opProcesar_: 'Chat operativo', hubReviewHuesped_: 'Reviews · al huésped', hubGuestReview_: 'Reviews · al huésped', hubRespuestaReview_: 'Reviews · responder', hubApelacion_: 'Reviews · apelación' };
function funcionIA_() {
  const nombres = String(new Error().stack || '').split('\n').map(l => (l.match(/at ([\w$.]+) /) || [])[1]).filter(n => n && !/^(claude_|funcionIA_|registrarUso_|Error)$/.test(n));
  for (let i = 0; i < nombres.length; i++) if (FUNC_IA_[nombres[i]]) return FUNC_IA_[nombres[i]];
  return nombres[0] ? 'Otro · ' + nombres[0] : 'Otro';
}
/* USD por millón de tokens [entrada, salida]. Se puede ajustar con la propiedad IA_PRECIOS: {"sonnet":[3,15], …}. */
function precioIA_(modelo) {
  const m = String(modelo || '').toLowerCase();
  try { const x = JSON.parse(PropertiesService.getScriptProperties().getProperty('IA_PRECIOS') || '{}'); const k = Object.keys(x).find(k => m.indexOf(k.toLowerCase()) >= 0); if (k) return x[k]; } catch (e) {}
  if (/opus-4-[5-9]|opus-[5-9]/.test(m)) return [5, 25];
  if (/opus/.test(m)) return [15, 75];
  if (/sonnet/.test(m)) return [3, 15];
  if (/haiku-4|haiku-[5-9]/.test(m)) return [1, 5];
  if (/haiku-3-5/.test(m)) return [0.8, 4];
  if (/haiku/.test(m)) return [0.25, 1.25];
  if (/gemini.*flash/.test(m)) return [0.1, 0.4];
  if (/gemini/.test(m)) return [1.25, 10];
  return [3, 15];
}
function costoIA_(modelo, u, extra) {
  u = u || {}; extra = extra || {};
  if (/scribe/i.test(modelo)) return (Number(extra.minutos) || 0) * 0.0067;
  if (/whisper/i.test(modelo)) return (Number(extra.minutos) || 0) * 0.006;
  const p = precioIA_(modelo), pin = extra.audio ? Math.max(p[0], 0.7) : p[0];
  const cw = (Number(u.cache_creation_input_tokens) || 0), cr = Number(u.cache_read_input_tokens) || 0;
  return ((Number(u.input_tokens) || 0) * pin + cw * pin * 1.25 + cr * pin * 0.1 + (Number(u.output_tokens) || 0) * p[1]) / 1e6;
}
function registrarUso_(o) {
  const u = o.usage || {};
  const usd = o.usd != null && o.usd !== '' ? Number(o.usd) : costoIA_(o.modelo, u, o);
  hojaCrear_('IA_USO', USO_CAB_).appendRow([new Date().toISOString(), s_(o.app) || 'ALMA', s_(o.funcion).slice(0, 80) || 'Otro', s_(o.detalle || USO_DET_).slice(0, 120) + (o.fotos ? ' · ' + o.fotos + ' foto(s)' : ''), s_(o.ref || USO_REF_).slice(0, 80),
    s_(o.modelo), Number(u.input_tokens) || 0, Number(u.output_tokens) || 0, Number(u.cache_read_input_tokens) || 0, Number(u.cache_creation_input_tokens) || 0, Math.round(usd * 1e6) / 1e6, Number(o.ms) || '', o.ok === false ? 'no' : 'si']);
}
/* Llamada desde otra app. Ejecuta claveUsoIA() una vez para crear la clave y pégala en esa app como USO_KEY. */
const APPS_IA_ = ['ALMA', 'EPI', 'Hola', 'mi', 'Docs', 'Grow'];
function usoExterno_(b) {
  const k = PropertiesService.getScriptProperties().getProperty('USO_KEY');
  if (!k || b.k !== k) return 'uso: clave';
  const app = APPS_IA_.find(a => a.toLowerCase() === String(b.app || '').toLowerCase()); if (!app) return 'uso: app';
  registrarUso_({ app: app, funcion: b.funcion, detalle: b.detalle, ref: b.ref, modelo: b.modelo, usage: b.usage || {}, ms: b.ms, ok: b.ok !== false, minutos: b.minutos, usd: b.usd });
  return 'uso: ok';
}
function claveUsoIA() {
  const p = PropertiesService.getScriptProperties(); let k = p.getProperty('USO_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); p.setProperty('USO_KEY', k); }
  console.log('USO_KEY = ' + k + '\nALMA_URL = ' + ScriptApp.getService().getUrl() + '\nPega ambas en las Propiedades del script de EPI y del backend de Hola.');
  return k;
}
const FUENTES_IA_ = [
  { app: 'ALMA', nombre: 'ALMA · hub', donde: 'Apps Script de ALMA', que: 'Clasifica, redacta y verifica respuestas, consultas, auto mejora, reviews, chat operativo y notas de voz.', como: 'Se registra solo.' },
  { app: 'EPI', nombre: 'EPI', donde: 'Apps Script de EPI · acción «ai»', que: 'Resúmenes con IA dentro de la app de operación.', como: 'Pega el bloque de registro en su Apps Script.' },
  { app: 'Hola', nombre: 'Hola', donde: 'Backend de Hola · «readDocument»', que: 'Lee DPI y pasaportes en el check-in. Hasta 3 lecturas por documento si la foto viene girada o con reflejos.', como: 'Pega el bloque de registro en su Apps Script.' },
  { app: 'mi', nombre: 'mi', donde: 'Conta · facturas', que: 'Usa la IA del entorno de diseño. En producción no consume tokens.', como: 'Nada que conectar.' },
  { app: 'Docs', nombre: 'Docs', donde: 'Lectura de DPI', que: 'Usa la IA del entorno de diseño; en producción usa el lector sin IA. No consume tokens.', como: 'Nada que conectar.' },
  { app: 'Grow', nombre: 'Grow', donde: '—', que: 'No usa IA.', como: 'Nada que conectar.' }
];
function hubUsoIA_(dias) {
  dias = Math.max(1, Math.min(90, Number(dias) || 30));
  const desde = Date.now() - dias * 86400000, apps = {}, porDia = {};
  const tot = { usd: 0, inp: 0, out: 0, n: 0, err: 0 };
  const sh = ssAlma_().getSheetByName('IA_USO');
  if (sh && sh.getLastRow() >= 2) {
    const n = sh.getLastRow(), ini = Math.max(2, n - 40000);
    sh.getRange(ini, 1, n - ini + 1, USO_CAB_.length).getValues().forEach(v => {
      const t = v[0] instanceof Date ? v[0].getTime() : Date.parse(v[0]); if (!(t >= desde)) return;
      const app = String(v[1] || 'ALMA'), fn = String(v[2] || 'Otro'), mod = String(v[5] || ''), inp = (+v[6] || 0) + (+v[8] || 0) + (+v[9] || 0), out = +v[7] || 0, usd = +v[10] || 0, ok = String(v[12]) !== 'no';
      const A = apps[app] = apps[app] || { app: app, usd: 0, inp: 0, out: 0, n: 0, err: 0, f: {} };
      const F = A.f[fn] = A.f[fn] || { funcion: fn, usd: 0, inp: 0, out: 0, n: 0, err: 0, modelos: {}, ultimas: [] };
      [tot, A, F].forEach(o => { o.usd += usd; o.inp += inp; o.out += out; o.n++; if (!ok) o.err++; });
      F.modelos[mod] = (F.modelos[mod] || 0) + 1;
      F.ultimas.push({ ts: new Date(t).toISOString(), detalle: String(v[3] || ''), ref: String(v[4] || ''), modelo: mod, inp: inp, out: out, usd: usd, ok: ok });
      if (F.ultimas.length > 40) F.ultimas.shift();
      const d = Utilities.formatDate(new Date(t), CFG.TZ, 'yyyy-MM-dd'), D = porDia[d] = porDia[d] || { d: d, usd: 0, apps: {} };
      D.usd += usd; D.apps[app] = (D.apps[app] || 0) + usd;
    });
  }
  const r6 = x => Math.round(x * 1e4) / 1e4;
  const lista = Object.keys(apps).map(k => { const A = apps[k]; return { app: A.app, usd: r6(A.usd), inp: A.inp, out: A.out, n: A.n, err: A.err,
    funciones: Object.keys(A.f).map(f => { const F = A.f[f]; return { funcion: F.funcion, usd: r6(F.usd), inp: F.inp, out: F.out, n: F.n, err: F.err, modelos: F.modelos, ultimas: F.ultimas.slice(-12).reverse() }; }).sort((a, b) => b.usd - a.usd) }; }).sort((a, b) => b.usd - a.usd);
  const dl = []; for (let i = dias - 1; i >= 0; i--) { const d = Utilities.formatDate(new Date(Date.now() - i * 86400000), CFG.TZ, 'yyyy-MM-dd'); dl.push(porDia[d] ? { d: d, usd: r6(porDia[d].usd), apps: porDia[d].apps } : { d: d, usd: 0, apps: {} }); }
  let anthropic = null; try { anthropic = usoAnthropic_(desde); } catch (e) { anthropic = { ok: false, error: String(e) }; }
  return { ok: true, dias: dias, total: { usd: r6(tot.usd), inp: tot.inp, out: tot.out, n: tot.n, err: tot.err }, apps: lista, porDia: dl, anthropic: anthropic,
    fuentes: FUENTES_IA_.map(f => Object.assign({}, f, { registrando: !!apps[f.app] })), usoKey: !!PropertiesService.getScriptProperties().getProperty('USO_KEY') };
}
/* Lo que Anthropic facturó (Admin API, requiere ANTHROPIC_ADMIN_KEY sk-ant-admin01-…). Cacheado 15 min. */
function usoAnthropic_(desdeMs) {
  const k = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_ADMIN_KEY'); if (!k) return { ok: false, sinLlave: true };
  const s0 = Utilities.formatDate(new Date(desdeMs), 'UTC', "yyyy-MM-dd'T'00:00:00'Z'"), e0 = Utilities.formatDate(new Date(Date.now() + 86400000), 'UTC', "yyyy-MM-dd'T'00:00:00'Z'");
  const ck = 'usoAnt_' + s0.slice(0, 10), cache = CacheService.getScriptCache(), c0 = cache.get(ck); if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  const get = u => { const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/organizations/' + u, { muteHttpExceptions: true, headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } }); const c = r.getResponseCode(); let j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {} return c === 200 ? j : { _err: c, msg: (j.error && j.error.message) || '' }; };
  const nombres = {}; const ks = get('api_keys?limit=100'); (ks.data || []).forEach(x => nombres[x.id] = x.name || x.id);
  const llaves = {}; let page = '', g = 0, err = '';
  do {
    const u = get('usage_report/messages?starting_at=' + s0 + '&ending_at=' + e0 + '&bucket_width=1d&limit=31&group_by[]=api_key_id&group_by[]=model' + (page ? '&page=' + encodeURIComponent(page) : ''));
    if (u._err) { err = 'HTTP ' + u._err + (u.msg ? ' · ' + u.msg : ''); break; }
    (u.data || []).forEach(b => (b.results || []).forEach(x => {
      const id = x.api_key_id || 'consola', L = llaves[id] = llaves[id] || { id: id, nombre: id === 'consola' ? 'Consola / playground' : (nombres[id] || id), inp: 0, out: 0, est: 0, modelos: {} };
      const cc = x.cache_creation || {}, cw = (cc.ephemeral_5m_input_tokens || 0) + (cc.ephemeral_1h_input_tokens || 0);
      const usage = { input_tokens: x.uncached_input_tokens || 0, output_tokens: x.output_tokens || 0, cache_read_input_tokens: x.cache_read_input_tokens || 0, cache_creation_input_tokens: cw };
      L.inp += usage.input_tokens + usage.cache_read_input_tokens + cw; L.out += usage.output_tokens; L.est += costoIA_(x.model, usage);
      L.modelos[x.model || '?'] = (L.modelos[x.model || '?'] || 0) + usage.input_tokens + usage.output_tokens;
    }));
    page = u.has_more ? u.next_page : ''; g++;
  } while (page && g < 10);
  if (err && !Object.keys(llaves).length) return { ok: false, error: err };
  let cents = 0; page = ''; g = 0;
  do {
    const c = get('cost_report?starting_at=' + s0 + '&ending_at=' + e0 + '&limit=31' + (page ? '&page=' + encodeURIComponent(page) : ''));
    if (c._err) break;
    (c.data || []).forEach(b => (b.results || []).forEach(x => cents += Number(x.amount) || 0));
    page = c.has_more ? c.next_page : ''; g++;
  } while (page && g < 10);
  let mapa = {}; try { mapa = JSON.parse(PropertiesService.getScriptProperties().getProperty('IA_LLAVES') || '{}'); } catch (e) {}
  const adivina = n => { const x = String(n).toLowerCase(); return /alma|hub/.test(x) ? 'ALMA' : /epi/.test(x) ? 'EPI' : /hola|guest/.test(x) ? 'Hola' : /docs/.test(x) ? 'Docs' : /grow/.test(x) ? 'Grow' : /\bmi\b|owner|propiet/.test(x) ? 'mi' : ''; };
  const usd = cents / 100, sumEst = Object.keys(llaves).reduce((a, i) => a + llaves[i].est, 0);
  const out = { ok: true, usd: Math.round(usd * 100) / 100, desde: s0.slice(0, 10),
    llaves: Object.keys(llaves).map(i => { const L = llaves[i]; return { id: L.id, nombre: L.nombre, app: mapa[L.id] || mapa[L.nombre] || adivina(L.nombre), inp: L.inp, out: L.out,
      usd: Math.round((usd && sumEst ? usd * L.est / sumEst : L.est) * 100) / 100, modelos: L.modelos }; }).sort((a, b) => b.usd - a.usd) };
  try { cache.put(ck, JSON.stringify(out), 900); } catch (e) {}
  return out;
}

/* ═══════════════════════════════ 5. HOSPITABLE ═══════════════════════════════ */

function hosp_(metodo, ruta, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('HOSPITABLE_TOKEN');
  const opt = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  try {
    // Consultas previas a la reserva (Pre-approved / Inquiry): Hospitable las expone en /inquiries/{uuid}.
    ruta = String(ruta).replace(/^\/reservations\/inq:/, '/inquiries/');
    let r = UrlFetchApp.fetch(CFG.HOSPITABLE_API + ruta, opt);
    /* 429 (límite de Hospitable): hasta 2 reintentos con espera corta, respetando Retry-After si es breve. */
    for (let k = 0; k < 2 && r.getResponseCode() === 429; k++) {
      const ra = Number((r.getHeaders() || {})['Retry-After'] || (r.getHeaders() || {})['retry-after']) || 0;
      Utilities.sleep(Math.min(6000, ra ? ra * 1000 : 1500 * (k + 1)) + Math.floor(Math.random() * 400));
      r = UrlFetchApp.fetch(CFG.HOSPITABLE_API + ruta, opt);
    }
    let json = null; try { json = JSON.parse(r.getContentText()); } catch (e) { }
    const code = r.getResponseCode();
    /* Enviado a una consulta (ALMA o el equipo): queda en el hilo y cuenta como respuesta aunque el webhook no llegue ligado. */
    const mr = String(metodo).toLowerCase() === 'post' && code < 300 && ruta.match(/^\/reservations\/([^\/?]+)\/messages/);
    if (mr && payload && payload.body) { try { cacheEnvio_(mr[1], payload.body); } catch (e) {} }
    const mi = String(metodo).toLowerCase() === 'post' && code < 300 && ruta.match(/^\/inquiries\/([^\/?]+)\/messages/);
    if (mi && payload && payload.body) { try { registrarEnvioInq_('inq:' + mi[1], payload.body, s_(json && (json.sent_reference_id || (json.data && json.data.sent_reference_id)))); } catch (e) {} }
    return { code: code, json: json };
  } catch (err) {
    return { code: 0, json: null };
  }
}

// Pausa First Morning y Review reminder pendientes (solo ROJO en AUTO). Mejor esfuerzo.
function pausarProgramados_(resId) {
  const r = hosp_('get', '/reservations/' + resId + '/scheduled-messages');
  if (r.code !== 200) return '';
  const lista = (r.json && r.json.data) || [];
  const objetivo = ['first morning', 'review'];
  return lista.filter(m => {
    const nombre = String(m.title || (m.rule && m.rule.name) || '').toLowerCase();
    return objetivo.some(o => nombre.indexOf(o) !== -1) && !m.sent_at && !m.cancelled_at;
  }).map(m => {
    const c = cancelarHosp_(m.id);
    return (m.title || 'programado') + (c.code < 300 ? '' : ' (falló ' + c.code + ')');
  }).join(', ');
}

/* ═══════════════════════════════ 6. ALERTAS ═══════════════════════════════ */

/* ── Correos con la shell de EPI (tablas, inline, 600px), desde hola@spacioam.com, registrados en ALMA_CORREOS ── */
function sinEmoji_(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim(); }
function escH_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function emailShell_(o) {
  const C = { bg: '#FAFAFA', card: '#FFFFFF', ink: '#3E3F3F', earth: '#938B8A', divider: '#D8D4CE', peach: '#E9826A', imgbg: '#EDE7E0' };
  const SERIF = "Georgia, 'Times New Roman', serif", SANS = 'Helvetica, Arial, sans-serif';
  const SLOGAN = 'Hay espacios en donde sueñas con volver a despertar', CONTACT = 'hola@spacioam.com  ·  +502 5690 9499';
  const paras = o.paras || [], rows = o.rows || [], signoff = o.signoff || 'ALMA,\nSpacio AM';
  const img = o.image ? (/^https?:/.test(o.image) ? o.image : CFG.EMAIL_IMG_BASE + o.image) : '';
  const H = [];
  H.push('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>' + escH_(o.heading) + '</title></head>');
  H.push('<body style="margin:0;padding:0;background:' + C.bg + ';"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + C.bg + ';font-size:1px;line-height:1px;">' + escH_(o.preheader || paras[0] || o.heading) + '</div>');
  H.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.bg + ';"><tr><td align="center" style="padding:32px 16px;">');
  H.push('<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:' + C.card + ';border-radius:24px;overflow:hidden;border:1px solid ' + C.divider + ';">');
  H.push('<tr><td align="center" style="padding:38px 40px 26px;"><div style="font-family:' + SERIF + ';font-size:24px;letter-spacing:8px;color:' + C.ink + ';">SPACIO&nbsp;AM</div><div style="font-family:' + SANS + ';font-size:11px;line-height:1.6;color:' + C.earth + ';margin-top:12px;letter-spacing:.3px;">' + escH_(SLOGAN) + '</div></td></tr>');
  if (img) H.push('<tr><td style="padding:0 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:' + C.imgbg + ';border-radius:18px;overflow:hidden;"><img src="' + escH_(img) + '" width="560" alt="' + escH_(o.imageAlt || '') + '" style="display:block;width:100%;height:auto;border:0;border-radius:18px;"></td></tr></table></td></tr>');
  H.push('<tr><td style="padding:30px 40px 8px;">');
  if (o.eyebrow) H.push('<div style="font-family:' + SANS + ';font-size:11px;letter-spacing:3px;text-transform:uppercase;color:' + C.earth + ';margin:0 0 14px;">' + escH_(o.eyebrow) + '</div>');
  if (o.heading) H.push('<h1 style="font-family:' + SERIF + ';font-weight:400;font-size:28px;line-height:1.25;color:' + C.ink + ';margin:0 0 20px;">' + escH_(o.heading) + '</h1>');
  paras.forEach(p => H.push('<p style="font-family:' + SANS + ';font-size:15px;line-height:1.7;color:' + C.ink + ';margin:0 0 16px;white-space:pre-line;">' + escH_(p) + '</p>'));
  H.push('</td></tr>');
  if (rows.length) {
    H.push('<tr><td style="padding:6px 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.bg + ';border-radius:16px;">');
    rows.forEach((r, i) => { const t = i ? 'border-top:1px solid ' + C.divider + ';' : ''; H.push('<tr><td style="' + t + 'padding:13px 18px;font-family:' + SANS + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C.earth + ';vertical-align:top;width:42%;">' + escH_(r[0]) + '</td><td style="' + t + 'padding:13px 18px;font-family:' + SANS + ';font-size:15px;color:' + C.ink + ';text-align:right;vertical-align:top;">' + escH_(r[1]) + '</td></tr>'); });
    H.push('</table></td></tr>');
  }
  if (o.cta && o.cta.label) H.push('<tr><td style="padding:22px 40px 6px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:100px;background:' + C.peach + ';"><a href="' + escH_(o.cta.url) + '" style="display:inline-block;padding:15px 34px;font-family:' + SANS + ';font-size:14px;font-weight:600;letter-spacing:.4px;color:#FFFFFF;text-decoration:none;border-radius:100px;">' + escH_(o.cta.label) + '</a></td></tr></table></td></tr>');
  if (o.footerNote) H.push('<tr><td style="padding:20px 40px 0;"><p style="font-family:' + SANS + ';font-size:12.5px;line-height:1.65;color:' + C.earth + ';margin:0;">' + escH_(o.footerNote) + '</p></td></tr>');
  H.push('<tr><td style="padding:30px 40px 8px;"><div style="border-top:1px solid ' + C.divider + ';padding-top:22px;">');
  signoff.split('\n').forEach((l, i) => H.push('<div style="' + (i ? 'font-family:' + SANS + ';font-size:13px;color:' + C.earth + ';margin:0;' : 'font-family:' + SERIF + ';font-size:17px;color:' + C.ink + ';margin:0 0 2px;') + '">' + escH_(l) + '</div>'));
  H.push('</div></td></tr><tr><td align="center" style="padding:26px 40px 40px;"><div style="width:24px;height:1px;background:' + C.peach + ';margin:0 auto 18px;"></div><div style="font-family:' + SANS + ';font-size:11px;letter-spacing:.4px;color:' + C.earth + ';line-height:1.7;">' + escH_(CONTACT) + '</div><div style="font-family:' + SANS + ';font-size:10.5px;color:' + C.earth + ';margin-top:8px;opacity:.75;">Guatemala · hospitalidad boutique</div></td></tr></table></td></tr></table></body></html>');
  const T = ['SPACIO AM', SLOGAN, ''];
  if (o.eyebrow) T.push(o.eyebrow.toUpperCase());
  if (o.heading) T.push(o.heading, '');
  paras.forEach(p => T.push(p, ''));
  rows.forEach(r => T.push(r[0] + ': ' + r[1]));
  if (o.cta) T.push('', o.cta.label + ': ' + o.cta.url);
  T.push('', CONTACT);
  return { html: H.join(''), text: T.join('\n') };
}
/* Tipo de alerta → eyebrow, título, hero (heros del sistema de correos de EPI). */
const TIPOS_CORREO_ = {
  sin_atender: { eyebrow: 'Sin atender', heading: 'Un caso urgente sigue sin respuesta', image: 'hero-dano-urgente.jpg' },
  codigo:      { eyebrow: 'Código de emergencia', heading: 'ALMA envió el código de emergencia', image: 'hero-correccion-atendida.jpg' },
  sin_codigo:  { eyebrow: 'Requiere tu atención', heading: 'No encontré un código de emergencia vigente', image: 'hero-correccion-inmediata.jpg' },
  urgente:     { eyebrow: 'Requiere tu atención', heading: 'Un huésped necesita ayuda ahora', image: 'hero-dano-urgente.jpg' },
  retenido:    { eyebrow: 'Borrador retenido', heading: 'ALMA no envió una respuesta', image: 'hero-supervision.jpg' },
  borrador:    { eyebrow: 'Borrador por revisar', heading: 'Hay una respuesta lista para revisar', image: 'hero-supervision.jpg' },
  seguimiento: { eyebrow: 'Seguimiento', heading: 'Un huésped pidió algo al equipo', image: 'hero-rating-revision.jpg' },
  error:       { eyebrow: 'Revisión manual', heading: 'ALMA no pudo procesar un mensaje', image: 'hero-correccion-inmediata.jpg' },
  aviso:       { eyebrow: 'Aviso de ALMA', heading: 'Novedad en las conversaciones', image: 'hero-supervision.jpg' }
};
function tipoCorreo_(asunto) {
  const a = String(asunto || '');
  if (/SIN ATENDER/i.test(a)) return 'sin_atender';
  if (/código de emergencia enviado/i.test(a)) return 'codigo';
  if (/sin código/i.test(a)) return 'sin_codigo';
  if (/ROJO/i.test(a)) return 'urgente';
  if (/retenido/i.test(a)) return 'retenido';
  if (/borrador/i.test(a)) return 'borrador';
  if (/seguimiento/i.test(a)) return 'seguimiento';
  if (/error/i.test(a)) return 'error';
  return 'aviso';
}
/* Texto libre de la alerta → filas "Etiqueta: valor" + párrafos. */
function partirAlerta_(texto) {
  const rows = [], paras = [];
  sinEmoji_(texto).split(/\n{2,}/).forEach(b => {
    const ls = b.split('\n').map(x => x.trim()).filter(Boolean); if (!ls.length) return;
    if (ls.every(l => /^[A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,22}:\s+\S/.test(l))) ls.forEach(l => { const i = l.indexOf(':'); rows.push([l.slice(0, i).trim(), l.slice(i + 1).trim()]); });
    else if (/:$/.test(ls[0]) && ls.length > 1) paras.push(ls[0].replace(/:$/, '') + ' — ' + ls.slice(1).join('\n'));
    else paras.push(ls.join('\n'));
  });
  return { rows, paras };
}
function hojaCrear_(nombre, cab) {
  const ss = ssAlma_(); let sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.appendRow(cab); sh.setFrozenRows(1); }
  return sh;
}
function correo_(para, asunto, texto) {
  const tipo = tipoCorreo_(asunto), t = TIPOS_CORREO_[tipo], p = partirAlerta_(texto);
  const fila = k => (p.rows.find(r => r[0].toLowerCase() === k) || [])[1] || '';
  const built = emailShell_({ eyebrow: t.eyebrow, heading: t.heading, image: t.image, imageAlt: t.heading, preheader: sinEmoji_(asunto),
    paras: p.paras, rows: p.rows, cta: { label: 'Abrir en el hub', url: CFG.HUB_URL }, footerNote: 'Este aviso lo envía ALMA cuando una conversación necesita al equipo.' });
  const yo = Session.getEffectiveUser().getEmail();
  let desde = yo, estado = 'enviado';
  try {
    const o = { htmlBody: built.html, name: 'Spacio AM' };
    if (yo !== CFG.EMAIL_DESDE) {
      if (GmailApp.getAliases().indexOf(CFG.EMAIL_DESDE) !== -1) { o.from = CFG.EMAIL_DESDE; desde = CFG.EMAIL_DESDE; }
      else desde = yo + ' (falta alias ' + CFG.EMAIL_DESDE + ')';
    }
    GmailApp.sendEmail(para, sinEmoji_(asunto), built.text, o);
  } catch (e) { estado = 'error: ' + String(e).slice(0, 200); console.error('email: ' + e); }
  try {
    const sh = hojaCrear_('ALMA_CORREOS', ['fecha', 'tipo', 'para', 'desde', 'asunto', 'propiedad', 'codigo', 'estado', 'texto', 'html']);
    sh.appendRow([new Date().toISOString(), tipo, para, desde, sinEmoji_(asunto), fila('propiedad'), fila('código') || fila('codigo'), estado, sinEmoji_(texto).slice(0, 4000), built.html.slice(0, 45000)]);
    if (sh.getLastRow() > 3000) sh.deleteRows(2, 500);
  } catch (e) { console.error('log correo: ' + e); }
}
/* ── Escalamiento a una persona (ALMA_ESCALAMIENTO, editable desde el hub) ──
   Cada fila es una persona con su ventana: desde/hasta en hora de Guatemala (si hasta < desde cruza la medianoche)
   y días (L M X J V S D, o "todos"). Solo recibe los casos que el clasificador marcó escalar=true y las
   emergencias que ALMA ya no puede contener (código de emergencia, ROJO sin atender). */
const ESC_CAB_ = ['nombre', 'email', 'telefono', 'desde', 'hasta', 'dias', 'activo', 'nota'];
const ESC_DEF_ = [
  ['Gabriel Asturias', 'gasturias@spacioam.com', '+50256806660', '08:00', '20:00', 'todos', 'TRUE', 'turno de día'],
  ['Juan Ovalle', 'jovalle@spacioam.com', '+50256909499', '20:00', '08:00', 'todos', 'TRUE', 'turno de noche']
];
/* Nombre desde la hoja «Control de usuarios» (misma fuente del login de todas las apps). */
const SHEET_ACCESOS_ID = '1r5LYE-YZw2_1JCt6919jZlcBf7AkHk5Hf2eIsP_wX2U';
function nombreAcceso_(email) {
  email = String(email || '').trim().toLowerCase(); if (!email) return '';
  try {
    const sh = SpreadsheetApp.openById(SHEET_ACCESOS_ID).getSheets()[0], v = sh.getDataRange().getDisplayValues();
    const cab = v[0].map(x => String(x).trim().toLowerCase()), ce = cab.findIndex(x => /email|correo|usuario/.test(x)), cn = cab.findIndex(x => /^nombre|^name/.test(x));
    if (ce < 0 || cn < 0) return '';
    const f = v.slice(1).find(r => String(r[ce]).trim().toLowerCase() === email); return f ? String(f[cn]).trim() : '';
  } catch (e) { console.error('nombreAcceso_: ' + e); return ''; }
}
function hojaEsc_() {
  const ss = ssAlma_(); let sh = ss.getSheetByName('ALMA_ESCALAMIENTO');
  if (!sh) { sh = ss.insertSheet('ALMA_ESCALAMIENTO'); sh.getRange(1, 1, 1, ESC_CAB_.length).setValues([ESC_CAB_]); sh.setFrozenRows(1); sh.getRange(2, 1, ESC_DEF_.length, ESC_CAB_.length).setValues(ESC_DEF_); sh.getRange('D:E').setNumberFormat('@'); }
  return sh;
}
function escalamiento_() {
  const sh = hojaEsc_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ESC_CAB_.length).getDisplayValues().map(v => {
    const o = {}; ESC_CAB_.forEach((k, i) => o[k] = String(v[i] || '').trim()); return o;
  }).filter(o => o.email || o.telefono);
}
function hhmm_(s) { const m = String(s || '').match(/(\d{1,2}):?(\d{2})?/); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; }
function deTurno_(fecha) {
  fecha = fecha || new Date();
  const min = Number(Utilities.formatDate(fecha, CFG.TZ, 'H')) * 60 + Number(Utilities.formatDate(fecha, CFG.TZ, 'm'));
  const dia = 'LMXJVSD'[Number(Utilities.formatDate(fecha, CFG.TZ, 'u')) - 1];
  const ayer = 'LMXJVSD'[(Number(Utilities.formatDate(fecha, CFG.TZ, 'u')) + 5) % 7];
  const tieneDia = (p, d) => { const s = String(p.dias || 'todos').toUpperCase(); return /TODOS|^\s*$/.test(s) || s.replace(/[^LMXJVSD]/g, '').indexOf(d) !== -1; };
  return escalamiento_().filter(p => {
    if (/^(false|no|0)$/i.test(p.activo)) return false;
    const a = hhmm_(p.desde), b = hhmm_(p.hasta); if (a == null || b == null) return false;
    if (a === b) return tieneDia(p, dia);
    if (a < b) return min >= a && min < b && tieneDia(p, dia);
    return (min >= a && tieneDia(p, dia)) || (min < b && tieneDia(p, ayer));   // cruza la medianoche
  });
}
/* Devuelve { ok, error } (antes no devolvía nada y quien llamaba no sabía si Meta lo rechazó). */
/* Todo mensaje de WhatsApp sale por aquí. Si la persona no ha escrito en las últimas 24 h, WhatsApp no deja mandarle
   texto libre (error 131047): en vez de mandarlo y que no llegue, se le manda la plantilla aprobada y el mensaje queda
   guardado; en cuanto responde, se le envía (waRetomar_, contacto.js). o.yaVentana: quien llama ya revisó la ventana. */
function waEnviar_(numero, texto, o) {
  o = o || {};
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('WA_TOKEN'), phoneId = p.getProperty('WA_PHONE_ID');
  if (!token || !phoneId || !numero) return { ok: false, error: 'sin configuración o sin número' };
  const wa = String(numero).replace(/\D/g, '');
  if (!o.yaVentana) { let abierta = true; try { abierta = waVentana_(wa); } catch (e) {} if (!abierta) return waRetomar_(wa, texto, o); }
  try {
    const r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + phoneId + '/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ messaging_product: 'whatsapp', to: wa, type: 'text', text: { body: String(texto).slice(0, 4000) } })
    });
    if (r.getResponseCode() >= 300) {
      const err = r.getContentText().slice(0, 300); console.error('WhatsApp ' + r.getResponseCode() + ': ' + err);
      if (/131047|re-engagement/i.test(err)) return waRetomar_(wa, texto, o);   // Meta dice que ya pasaron las 24 h
      return { ok: false, error: err };
    }
    let id = ''; try { id = ((JSON.parse(r.getContentText()).messages || [])[0] || {}).id || ''; } catch (e) {}
    waUltimoGuardar_(wa, id, texto, o);
    return { ok: true, modo: 'texto' };
  } catch (e) { console.error('WhatsApp: ' + e); return { ok: false, error: String(e) }; }
}
/* Escala a quien esté de turno ahora (correo + WhatsApp si está configurado). Sin nadie de turno → correo de alertas. */
function escalar_(asunto, texto, o) {
  o = o || {};
  /* Informativo (sinWa): notificación del Hub y correo, sin WhatsApp. */
  if (o.sinWa) { const tn = deTurno_(); pushA_(tn.length ? tn.map(p => p.email).filter(Boolean) : null, asunto, texto); tn.forEach(p => { if (p.email) { try { correo_(p.email, asunto, texto); } catch (e) {} } }); return; }
  const turno = deTurno_();
  if (!turno.length) { pushA_(null, asunto, texto); return notificar_(CFG.WHATSAPP_NOCTURNO, asunto + ' · sin nadie de turno', texto); }
  pushA_(turno.map(p => p.email).filter(Boolean), asunto, texto);
  turno.forEach(p => {
    if (p.email) { try { correo_(p.email, asunto, texto); } catch (e) { console.error('escalar email: ' + e); } }
    waEnviar_(p.telefono, asunto + '\n\n' + texto);
  });
}
function avisarRojo_(ctx, asunto, texto, sinWa) {
  if (sinWa) { pushA_(null, asunto, texto); return; }   // seguimiento de un ROJO ya avisado: no repite el WhatsApp
  if (ctx && ctx.escalar) return escalar_(asunto, texto + '\n\nEscalado por ALMA · motivo: ' + (ctx.motivoEscalar || 'urgente'));
  notificar_(CFG.WHATSAPP_NOCTURNO, asunto, texto);
  pushA_(null, asunto, texto);
}

/* ── Push (OneSignal) ──
   Propiedades del script: ONESIGNAL_APP_ID y ONESIGNAL_KEY (OneSignal → Settings → Keys & IDs → REST API Key).
   Cada dispositivo se vincula al correo de quien lo activó (external_id), así el aviso llega solo a quien esté de turno. */
function pushA_(emails, titulo, cuerpo, url) {
  try {
    const p = PropertiesService.getScriptProperties(), app = p.getProperty('ONESIGNAL_APP_ID'), key = p.getProperty('ONESIGNAL_KEY');
    if (!app || !key) { logPush_(emails, titulo, 0, '', 0, 'Faltan ONESIGNAL_APP_ID u ONESIGNAL_KEY en Propiedades del script'); return { ok: false, error: 'Faltan ONESIGNAL_APP_ID u ONESIGNAL_KEY en el Apps Script' }; }
    const t = sinEmoji_(titulo).slice(0, 120), b = String(cuerpo || '').replace(/\s+/g, ' ').slice(0, 240) || t;
    const body = { app_id: app, target_channel: 'push', headings: { en: t, es: t }, contents: { en: b, es: b }, url: url || CFG.HUB_URL,
      chrome_web_icon: CFG.HUB_URL + '/assets/icons/icon-192.png', ttl: 3600 };
    if (emails && emails.length) body.include_aliases = { external_id: emails.map(e => String(e).toLowerCase()) };
    /* Llaves nuevas (os_v2_…) usan 'Key'; las REST API Key antiguas, 'Basic'. Se prueba una y si OneSignal rechaza, la otra. */
    const enviar = b2 => { const f = pref => UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: pref + ' ' + key }, payload: JSON.stringify(b2) }); const p1 = /^os_v2_/.test(key) ? 'Key' : 'Basic'; let x = f(p1); if (x.getResponseCode() === 401 || x.getResponseCode() === 403) x = f(p1 === 'Key' ? 'Basic' : 'Key'); return x; };
    let r;
    let alTodos = !(emails && emails.length);
    if (!alTodos) {
      r = enviar(body);
      /* Si el correo de turno no tiene un dispositivo activo en OneSignal, el aviso no se pierde: va a todos los dispositivos del hub, con el nombre de a quién iba. */
      let j0 = {}; try { j0 = JSON.parse(r.getContentText()) || {}; } catch (e) {}
      const sinNadie = r.getResponseCode() >= 300 || !j0.id || (j0.errors && /not subscribed|invalid_aliases|no.*subscri/i.test(JSON.stringify(j0.errors)));
      if (sinNadie) { logPush_(emails, t, r.getResponseCode(), s_(j0.id), 0, 'sin dispositivo para el correo · reenviado a todos'); alTodos = true; delete body.include_aliases; body.headings = { en: t, es: t }; body.contents = { en: '[Para ' + emails.join(', ') + '] ' + b, es: '[Para ' + emails.join(', ') + '] ' + b }; }
    }
    if (alTodos) {
      /* "Todos": el nombre del segmento cambió en OneSignal; se prueba el nuevo, el clásico y, si no, todo dispositivo del hub (etiqueta rol). */
      const intentos = [{ included_segments: ['Total Subscriptions'] }, { included_segments: ['Subscribed Users'] }, { filters: [{ field: 'tag', key: 'rol', relation: 'exists' }] }];
      for (let i = 0; i < intentos.length; i++) {
        r = enviar(Object.assign({}, body, intentos[i]));
        let jj = {}; try { jj = JSON.parse(r.getContentText()) || {}; } catch (e) {}
        if (r.getResponseCode() < 300 && jj.id && !jj.errors) break;
      }
    }
    // OneSignal responde 200 aunque nadie reciba nada: se registra id, destinatarios y errores para poder diagnosticar.
    let j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
    const code = r.getResponseCode(), dest = Number(j.recipients || 0) || (j.id ? -1 : 0);
    const err = j.errors ? JSON.stringify(j.errors).slice(0, 300) : (code >= 300 ? r.getContentText().slice(0, 300) : '');
    logPush_(emails, t, code, s_(j.id), dest, err);
    return { ok: code < 300 && !!j.id, http: code, id: s_(j.id), destinatarios: dest, error: err };
  } catch (e) { console.error('pushA_: ' + e); logPush_(emails, titulo, 0, '', 0, String(e)); return { ok: false, error: String(e) }; }
}
/* Mensaje nuevo de un huésped → push a todos los dispositivos salvo los que apagaron "Mensajes nuevos" (etiqueta nuevos=0).
   Una ráfaga del mismo huésped manda un solo aviso por minuto. Al tocarlo, el hub abre la conversación (?conv=). */
function pushNuevo_(convId, quien, propiedad, texto) {
  try {
    if (!convId) return;
    const c = CacheService.getScriptCache(), k = 'pn_' + String(convId).slice(0, 200);
    if (c.get(k)) return; c.put(k, '1', 60);
    const p = PropertiesService.getScriptProperties(), app = p.getProperty('ONESIGNAL_APP_ID'), key = p.getProperty('ONESIGNAL_KEY');
    if (!app || !key) return;
    const t = sinEmoji_((quien || 'Huésped') + (propiedad ? ' · ' + propiedad : '')).slice(0, 120);
    const b = String(texto || '').replace(/\s+/g, ' ').slice(0, 240) || 'Mensaje nuevo';
    const body = { app_id: app, target_channel: 'push', headings: { en: t, es: t }, contents: { en: b, es: b },
      url: CFG.HUB_URL + '/?conv=' + encodeURIComponent(convId), chrome_web_icon: CFG.HUB_URL + '/assets/icons/icon-192.png', ttl: 1800,
      web_push_topic: 'conv-' + String(convId).replace(/[^\w-]/g, '').slice(0, 60), filters: [{ field: 'tag', key: 'nuevos', relation: '!=', value: '0' }, { operator: 'OR' }, { field: 'tag', key: 'nuevos', relation: 'not_exists' }] };   // activado por defecto: solo se excluye a quien lo apagó
    const f = pref => UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: pref + ' ' + key }, payload: JSON.stringify(body) });
    const p1 = /^os_v2_/.test(key) ? 'Key' : 'Basic'; let r = f(p1); if (r.getResponseCode() === 401 || r.getResponseCode() === 403) r = f(p1 === 'Key' ? 'Basic' : 'Key');
    if (r.getResponseCode() >= 300) console.error('pushNuevo_ ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  } catch (e) { console.error('pushNuevo_: ' + e); }
}
/* ALMA_PUSH: cada aviso enviado, a quién, y qué respondió OneSignal. */
function logPush_(emails, titulo, http, id, dest, err) {
  try { hojaCrear_('ALMA_PUSH', ['fecha', 'para', 'titulo', 'http', 'id', 'destinatarios', 'error']).appendRow([new Date().toISOString(), emails && emails.length ? emails.join(', ') : 'todos', String(titulo || '').slice(0, 120), http, id, dest, err]); } catch (e) {}
}
/* Lo que ALMA intentó avisar en las últimas N horas (para diagnosticar desde el hub). */
function hubPushLog_(horas) {
  const sh = hojaCrear_('ALMA_PUSH', ['fecha', 'para', 'titulo', 'http', 'id', 'destinatarios', 'error']), n = sh.getLastRow();
  if (n < 2) return { ok: true, filas: [] };
  const lim = Date.now() - (Number(horas) || 48) * 3600000, desde = Math.max(2, n - 199);
  const filas = sh.getRange(desde, 1, n - desde + 1, 7).getValues().filter(v => new Date(v[0]).getTime() >= lim)
    .map(v => ({ fecha: String(v[0]), para: v[1], titulo: v[2], http: v[3], id: v[4], destinatarios: v[5], error: v[6] }));
  return { ok: true, filas: filas };
}
/* Prueba desde el hub: un aviso solo al correo de quien la pide. */
function hubProbarPush_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Sin correo de sesión' };
  return pushA_([email], 'Prueba de ALMA', 'Si ves esto, las notificaciones funcionan en este dispositivo.') || { ok: false, error: 'sin respuesta' };
}

function hubSetEscalamiento_(lista) {
  if (!Array.isArray(lista)) return { ok: false, error: 'lista' };
  const filas = lista.slice(0, 20).map(p => ESC_CAB_.map(k => {
    let v = String((p && p[k]) != null ? p[k] : '').trim().slice(0, 120);
    if (k === 'activo') v = /^(false|no|0)$/i.test(v) ? 'FALSE' : 'TRUE';
    if ((k === 'desde' || k === 'hasta') && hhmm_(v) == null) v = k === 'desde' ? '08:00' : '20:00';
    return v;
  })).filter(f => f[1] || f[2]);
  filas.forEach(f => { const n = nombreAcceso_(f[1]); if (n) f[0] = n; });
  const sh = hojaEsc_(), n = sh.getLastRow();
  if (n >= 2) sh.getRange(2, 1, n - 1, ESC_CAB_.length).clearContent();
  sh.getRange('D:E').setNumberFormat('@');
  if (filas.length) sh.getRange(2, 1, filas.length, ESC_CAB_.length).setValues(filas);
  return { ok: true, n: filas.length, deTurno: deTurno_().map(p => p.nombre || p.email) };
}

function notificar_(whatsapp, asunto, texto) {
  try {
    const email = CFG.EMAIL_ALERTAS || Session.getEffectiveUser().getEmail();
    if (email) correo_(email, asunto, texto);
  } catch (e) { console.error('email: ' + e); }

  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('WA_TOKEN'), phoneId = p.getProperty('WA_PHONE_ID');
  if (!token || !phoneId || !whatsapp) return;
  try {
    const r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + phoneId + '/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ messaging_product: 'whatsapp', to: whatsapp.replace(/\D/g, ''), type: 'text', text: { body: texto.slice(0, 4000) } })
    });
    if (r.getResponseCode() >= 300) console.error('WhatsApp ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  } catch (e) { console.error('WhatsApp: ' + e); }
}

/* ═══════════════════════════════ 7. HOJAS ═══════════════════════════════ */

const TABS_WEBAPP = [CFG.TAB_RESERVAS, CFG.TAB_PROPIEDADES];
const SS_ = {};
function ssAlma_() { return SS_.alma || (SS_.alma = SpreadsheetApp.openById(CFG.SHEET_ALMA_ID)); }
function ssWebapp_() { return SS_.web || (SS_.web = SpreadsheetApp.openById(CFG.SHEET_WEBAPP_ID)); }
function hoja_(nombre) { return (TABS_WEBAPP.indexOf(nombre) !== -1 ? ssWebapp_() : ssAlma_()).getSheetByName(nombre); }

function leerTabla_(nombre) { return leerTablaHoja_(hoja_(nombre)); }
function leerTablaHoja_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  const h = v[0].map(x => String(x).trim().toLowerCase());
  return v.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
}

/* ALMA_CONTROL se lee POR POSICIÓN (col A = clave, col B = valor), no por cabecera: una cabecera dañada
   (celdas con saltos de línea, filas fusionadas) hacía desaparecer TOGGLE/MODO/HORARIO y ALMA se "apagaba" sola. */
function leerControlPares_() {
  const sh = hoja_(CFG.TAB_CONTROL); const o = {};
  if (!sh || sh.getLastRow() < 1) return o;
  sh.getRange(1, 1, sh.getLastRow(), 2).getValues().forEach(r => {
    const a = String(r[0] || ''), b = String(r[1] || '');
    // Celda fusionada ("CLAVE TOGGLE MODO HORARIO" / "valor ON AUTO OFF", por espacios o saltos): se desarma por índice.
    const ka = a.trim().split(/\s+/), vb = b.trim().split(/\s+/);
    ka.forEach((k, i) => {
      const K = k.trim().toUpperCase(); if (!K || K === 'CLAVE') return;
      let v = (ka.length === 1 ? b : (vb[i] != null ? vb[i] : '')).trim().toUpperCase();
      if (v === 'VALOR') v = '';
      if (o[K] == null || v) o[K] = v;
    });
  });
  return o;
}
function repararControl_() {
  const sh = hoja_(CFG.TAB_CONTROL); if (!sh) return false;
  const a1 = String(sh.getRange(1, 1).getValue() || '');
  const filas = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 3).getValues() : [];
  const rota = a1.trim().toLowerCase() !== 'clave' || filas.some(r => /\s/.test(String(r[0] || '').trim()));
  if (!rota) return false;
  const o = leerControlPares_();
  const desc = {};
  filas.forEach(r => { const ks = String(r[0] || '').trim().split(/\s+/); if (ks.length === 1) { const K = ks[0].toUpperCase(); const d = String(r[2] || '').trim(); if (K && d && K !== 'CLAVE') desc[K] = d; } });
  const salida = [['clave', 'valor', 'qué hace']].concat(Object.keys(o).map(K => [K, o[K], desc[K] || CONTROL_DESC_[K] || '']));
  sh.clearContents();
  sh.getRange(1, 1, salida.length, 3).setValues(salida);
  try { hoja_(CFG.TAB_LOG).appendRow([Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), '', '', 'CONTROL', 'Cabecera de ALMA_CONTROL reparada', '', '', '', '', 'control: ' + Object.keys(o).map(K => K + '=' + o[K]).join(' · ')]); } catch (e) {}
  return true;
}
function leerControl_() {
  const o = leerControlPares_();
  leerControlNum_(o);
  return {
    toggle: o.TOGGLE || 'OFF',
    modo: ['AUTO', 'BORRADOR', 'SOMBRA'].indexOf(o.MODO) !== -1 ? o.MODO : 'SOMBRA',
    horario: o.HORARIO !== 'OFF',     // ON = AUTO/BORRADOR solo de 19:00 a 04:00 · OFF = 24 h
    automejora: o.AUTOMEJORA !== 'OFF',
    soloReserva: o.SOLO_RESERVA || ''   // si tiene un código o UUID: AUTO/BORRADOR solo para esa reserva (sin horario); el resto queda en SOMBRA
  };
}
function leerControlNum_(o) {
  const num = {};
  NUM_KEYS.forEach(k => { const v = parseFloat(o[k]); if (!isNaN(v) && v >= 0) num[k] = v; });
  CTRL_NUM_ = num;
}

/* Quién firmó la respuesta: nombre del hub, 'ALMA' si la envió sola, o el nombre del anfitrión del hilo si lo trae Hospitable. */
function quienRespondio_(c, accion) {
  if (c && c.respondidoPor) return c.respondidoPor;
  if (/^ENVIADO/i.test(accion || '')) return /equipo/i.test(accion) ? 'Equipo' : 'ALMA';
  return '';
}
function log_(c, respuesta, accion) {
  const sh = hoja_(CFG.TAB_LOG);
  ['respondido_por', 'reservation_id', 'huesped'].forEach(col => { if (sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase()).indexOf(col) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(col); });
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  const val = {
    fecha: Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm'),
    codigo: c.codigo || '', propiedad: c.propiedad || '', nivel: c.nivel || '', razon: c.razon || '',
    pregunta: String(c.texto || c.pregunta || '').slice(0, 500), respuesta: String(respuesta || '').slice(0, 1500),
    modo: c.modo || '', corregida: '', accion: accion || c.accion || '',
    huesped: c.huesped || '', checkin: c.checkin || '', checkout: c.checkout || '', apartamento: c.apartamento || '',
    fotos: JSON.stringify(c.fotos || []), reservation_id: c.resId || '',
    respondido_por: quienRespondio_(c, accion || c.accion)
  };
  sh.appendRow(h.map(k => val[k] !== undefined ? val[k] : ''));
  /* ALMA envió algo que promete un seguimiento del equipo → pendiente rastreable (promesas.js). */
  if (respuesta && /^ENVIADO/i.test(String(accion || '')) && !/equipo|llamada atendida/i.test(String(accion || ''))) { try { promesaRegistrar_(c, respuesta, 'texto'); } catch (e) { console.error('promesa: ' + e); } }
}

function set_(sh, f, cambios) {
  Object.keys(cambios).forEach(k => {
    f.v[C[k]] = cambios[k];
    sh.getRange(f.fila, C[k] + 1).setValue(cambios[k]);
  });
}

function reintentar_(sh, f, motivo, estadoBase) {
  const n = Number(f.v[C.intentos] || 0) + 1;
  if (n >= CFG.MAX_INTENTOS) {
    set_(sh, f, { estado: 'error', intentos: n, nota: motivo });
    const d = f.v[C.datos] ? JSON.parse(f.v[C.datos]) : { codigo: '', propiedad: '', texto: f.v[C.texto], modo: '' };
    log_(Object.assign({}, d, { nivel: d.nivel || 'ERROR', razon: motivo }), d.borrador || '', 'ERROR tras ' + n + ' intentos — revisar manualmente');
    notificar_(CFG.WHATSAPP_JUAN, 'ALMA · error', 'Fila ' + f.fila + ' de ALMA_COLA: ' + motivo + '\nMensaje: ' + f.v[C.texto]);
    return;
  }
  set_(sh, f, { estado: estadoBase || 'pendiente', intentos: n, nota: motivo, proximo: new Date(ahora_().getTime() + 60000 * n).toISOString() });
}

function protegido_(sh, f, fn) {
  try { fn(); } catch (err) { console.error(err.stack || err); reintentar_(sh, f, 'excepción: ' + err, f.v[C.estado]); }
}

/* ═══════════════════════════════ 8. UTILIDADES ═══════════════════════════════ */

function ahora_() { return new Date(); }
function s_(v) { return (v === null || v === undefined || typeof v === 'object') ? '' : String(v); }
function ok_(msg) { return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: msg })).setMimeType(ContentService.MimeType.JSON); }
function vence_(f, ahora) { return !f.v[C.proximo] || new Date(f.v[C.proximo]).getTime() <= ahora.getTime(); }
function enVentana_(d) {
  const h = Number(Utilities.formatDate(d, CFG.TZ, 'H'));
  return h >= CFG.VENTANA_INICIO || h < CFG.VENTANA_FIN;
}
function compacto_(ctx, extra) {
  return Object.assign({
    resId: ctx.resId, codigo: ctx.codigo, propiedad: ctx.propiedad, huesped: ctx.huesped, nivel: ctx.nivel,
    razon: ctx.razon, modo: ctx.modo, texto: String(ctx.texto).slice(0, 1500), ultimoGuestAt: ctx.ultimoGuestAt,
    checkin: ctx.checkin, checkout: ctx.checkout, apartamento: ctx.apartamento, fotos: ctx.fotos || [], seguimiento: ctx.seguimiento || '',
    canal: ctx.canal || 'hospitable', wa: ctx.wa || '', idioma: ctx.idioma || ''
  }, extra || {});
}

function limpiezaDiaria_() {
  const p = PropertiesService.getScriptProperties();
  const hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  if (p.getProperty('ULTIMA_LIMPIEZA') === hoy) return;
  p.setProperty('ULTIMA_LIMPIEZA', hoy);
  const sh = hoja_(CFG.TAB_COLA);
  if (!sh || sh.getLastRow() < 2) return;
  const limite = Date.now() - CFG.DIAS_HISTORIAL_COLA * 86400000;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, COLA_HEADERS.length).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (FINALES.indexOf(v[i][C.estado]) !== -1 && new Date(v[i][C.recibido]).getTime() < limite) sh.deleteRow(i + 2);
  }
  // ALMA_LOG y ALMA_AUTOMEJORA: se borran filas con más de DIAS_HISTORIAL_LOG días
  const lim90 = Date.now() - CFG.DIAS_HISTORIAL_LOG * 86400000;
  [CFG.TAB_LOG, CFG.TAB_AUTOMEJORA].forEach(tab => {
    const s2 = hoja_(tab);
    if (!s2 || s2.getLastRow() < 2) return;
    const f = s2.getRange(2, 1, s2.getLastRow() - 1, 1).getValues();
    for (let i = f.length - 1; i >= 0; i--) {
      const d = new Date(String(f[i][0]).replace(' ', 'T'));
      if (!isNaN(d) && d.getTime() < lim90) s2.deleteRow(i + 2);
    }
  });
}

/* ═══════════════════════════════ 9. INSTALACIÓN Y PRUEBAS ═══════════════════════════════ */

const CONTROL_DESC_ = {
  AUTOMEJORA: 'ON = ALMA observa al equipo y propone mejoras · OFF = auto mejora en pausa: no recopila casos ni crea propuestas.',
  AGRUPAR_SEG: 'Segundos de silencio del huésped antes de procesar su turno (agrupa ráfagas).',
  ESPERA_SIN_SALIENTE_SEG: 'Segundos de espera cuando la reserva aún no tiene ningún mensaje nuestro (deja pasar el automático).',
  DELAY_MIN_SEG: 'AUTO · segundos mínimos entre el último mensaje del huésped y nuestra respuesta (se descuenta lo que ALMA ya tardó en pensar).',
  DELAY_MAX_SEG: 'AUTO · segundos máximos entre el último mensaje del huésped y nuestra respuesta (respuestas largas se acercan a este tope).',
  ESPERA_ROJO_SEG: 'AUTO + ROJO · segundos antes de avisar al respaldo si nadie del equipo responde.',
  MIN_EQUIPO_ACTIVO: 'Minutos: después de que una persona del equipo responde, ALMA espera esto antes de reactivar sus respuestas automáticas en esa conversación.',
  CONTENCION_HORAS: 'Horas: una sola contención por incidente dentro de esta ventana.',
  REVISAR_SIN_RESP_MIN: 'Minutos: una conversación "sin respuesta" se vuelve a revisar tras este tiempo; si el último mensaje del huésped no pide respuesta (gracias, ok, despedida), sale de pendientes. 0 = no revisar.',
  APRENDER_MIN: 'Minutos de espera tras la conversación antes de comparar ALMA vs. equipo (auto mejora).',
  CODIGO_REVISION_MIN: 'Minutos: el huésped pide el código de acceso (reserva confirmada, día de llegada o estadía) y en la conversación no consta enviado → alerta a ambos administradores; si a los X min sigue sin enviarse, ALMA envía el código de emergencia.',
  INQUIRY_ESPERA_MIN: 'Minutos que ALMA espera a que aparezca el mensaje automático "Inquiry" de Hospitable (el que pre-aprueba). Si no aparece, responde con un mensaje normal y deja la consulta para que el equipo la pre-apruebe.',
  EMERGENCIA_MIN: 'Minutos: huésped sin acceso al APARTAMENTO (no portería) en estadía activa y nadie del equipo responde → ALMA envía el código de limpieza vigente (aunque el formulario siga pendiente: ya se le pidió en la primera contención). 0 = desactivado.'
};

const CONOCIMIENTO_SEMILLA_ = [
  ['Early check-in · con salida el mismo día', 'Hay una salida justo antes de la llegada, así que no es posible el acceso temprano. Lo que sí: guardamos las maletas de forma segura desde las 12:00 para que el huésped recorra la zona sin cargar nada. Debe avisarnos por aquí al estar en el edificio para que alguien del equipo lo reciba. Si acepta, el equipo lo organiza.', '*'],
  ['Early check-in · sin salida el mismo día', 'El check-in estándar es a las 15:00. Opciones:\n1) Early check-in sujeto a disponibilidad: si el apartamento no se ocupa la noche anterior, podría entrar antes sin costo. Se confirma a las 21:00 del día previo, nunca antes.\n2) Guardar equipaje: desde las 12:00 dejamos sus pertenencias en el apartamento sin costo.\n3) Noche adicional: reservar la noche anterior le da libertad de entrar a la hora que quiera; ideal si llega de madrugada.\nEl huésped elige una opción. Opción 1: el equipo programa la confirmación a las 21:00 del día previo (verifica que no haya salida ese día) y la envía al correo registrado. Opción 2: se avisa al administrador el día del check-in. Opción 3: seguimiento del administrador.', '*'],
  ['Late checkout · con llegada el mismo día', 'La salida estándar es a las 11:00. Hay una llegada ese mismo día, así que no hay late checkout; sí podemos guardar sus pertenencias en el apartamento hasta las 14:00 sin costo, con la condición de que todo quede empacado y fuera del paso para que limpieza pueda trabajar.', '*'],
  ['Late checkout · sin llegada el mismo día', 'La salida estándar es a las 11:00. Opciones:\n1) Guardar equipaje en el apartamento hasta las 14:00 sin costo, todo empacado y fuera del paso para limpieza.\n2) Noche adicional, para salir a su conveniencia.\nSi elige la opción 2, seguimiento del administrador.', '*'],
  ['Facturación', 'Sí emitimos factura por la estadía. Por procesos administrativos se entrega dentro de los 5 días hábiles posteriores a la salida y cierre de la reserva. Para emitirla necesitamos NIT, razón social y, si aplica, comentarios. Pedir que los datos vengan completos y correctos.', '*'],
  ['Parqueo · Centro Vivo', 'No incluye parqueo. En el mismo edificio hay parqueo con tarifa por hora, por día y por noche; se paga directamente en el edificio y ronda Q100 a Q150 por noche.', 'Centro Vivo'],
  ['Parqueo · Fiamene', 'No incluye parqueo. En el mismo edificio hay parqueo a Q100 por noche; se puede pagar con nosotros (el equipo coordina el pago).', 'Fiamene'],
  ['Parqueo · Brunelo', 'Incluye 1 espacio. Para un espacio adicional se revisa disponibilidad y se paga en: https://portfolio.spacioam.com/en/property/estacionamiento-edificio-brunelo-zona-10', 'Brunelo'],
  ['Parqueo · Narama', 'No incluye parqueo. En el edificio hay parqueo de pago, Q100 a Q150 por noche aproximadamente; se paga en las máquinas del edificio.', 'Narama'],
  ['Parqueo · Airali', 'Incluye 1 espacio. Para un espacio adicional se revisa disponibilidad con nosotros; el equipo confirma por aquí mismo.', 'Airali'],
  ['Parqueo · resto de propiedades', 'Las demás propiedades cuentan con parqueo propio incluido (uno por apartamento). Si la ficha de la propiedad dice otra cosa, manda la ficha.', '*']
];

// Ejecutar UNA vez (es seguro repetirlo): crea las pestañas en la hoja de ALMA,
// el disparador de cada minuto y la clave del webhook.
function configurar() {
  const p = PropertiesService.getScriptProperties();
  const ss = ssAlma_();

  const pestañas = [
    [CFG.TAB_CONTROL, [['clave', 'valor', 'qué hace']]],
    [CFG.TAB_LOG, [LOG_HEADERS]],
    [CFG.TAB_COLA, [COLA_HEADERS]],
    [CFG.TAB_AUTOMEJORA, [AUTOMEJORA_HEADERS]],
    [CFG.TAB_CONOCIMIENTO, [CONOCIMIENTO_HEADERS]]
  ];
  pestañas.forEach(([nombre, filas]) => {
    if (ss.getSheetByName(nombre)) return;
    const sh = ss.insertSheet(nombre);
    filas.forEach(f => sh.appendRow(f));
    sh.setFrozenRows(1);
  });
  // ALMA_LOG: agrega al final las columnas que falten (huesped, checkin, checkout, apartamento, fotos)
  const lg = ss.getSheetByName(CFG.TAB_LOG);
  const lgHead = lg.getLastColumn() ? lg.getRange(1, 1, 1, lg.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase()) : [];
  LOG_HEADERS.forEach(h => { if (lgHead.indexOf(h) === -1) { lg.getRange(1, lg.getLastColumn() + 1).setValue(h); lgHead.push(h); } });
  // ALMA_CONTROL: filas con listas desplegables (se agregan las que falten, sin tocar valores existentes)
  const ctl = ss.getSheetByName(CFG.TAB_CONTROL);
  if (!String(ctl.getRange(1, 3).getValue())) ctl.getRange(1, 3).setValue('qué hace');
  const controles = [
    ['TOGGLE', 'ON', ['ON', 'OFF'], 'Interruptor general. OFF = ALMA no hace nada.'],
    ['MODO', 'SOMBRA', ['SOMBRA', 'BORRADOR', 'AUTO'], 'SOMBRA: solo registra en el log. BORRADOR: te manda el borrador por correo. AUTO: responde al huésped en Hospitable.'],
    ['HORARIO', 'ON', ['ON', 'OFF'], 'ON: BORRADOR y AUTO solo de 19:00 a 04:00 (Guatemala). OFF: las 24 horas. SOMBRA registra siempre.'],
    ['SOLO_RESERVA', '', null, 'Opcional. Si pones un código de reserva, BORRADOR/AUTO aplican solo a esa reserva y el resto queda en SOMBRA.']
  ].concat(NUM_KEYS.map(k => [k, String(CFG[k]), null, CONTROL_DESC_[k]]));
  repararControl_();
  const actuales = Object.keys(leerControlPares_());
  controles.forEach(c => { if (actuales.indexOf(c[0]) === -1) ctl.appendRow([c[0], c[1], c[3]]); });
  const filasCtl = ctl.getRange(1, 1, ctl.getLastRow(), 1).getValues().map(r => String(r[0]).trim().toUpperCase());
  controles.forEach(c => {
    const i = filasCtl.indexOf(c[0]);
    if (i === -1) return;
    ctl.getRange(i + 1, 3).setValue(c[3]);
    if (c[2]) ctl.getRange(i + 1, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(c[2], true).setAllowInvalid(false).build());
  });
  ctl.setColumnWidth(1, 130); ctl.setColumnWidth(2, 120); ctl.setColumnWidth(3, 620);

  // ALMA_INSTRUCCIONES = tabla de prompts. Si existe con el formato viejo, se renombra (no se borra nada).
  let ins = ss.getSheetByName(CFG.TAB_INSTRUCCIONES);
  if (ins && String(ins.getRange(1, 1).getValue()).trim().toLowerCase() !== 'clave') {
    ins.setName(CFG.TAB_INSTRUCCIONES + '_viejo_' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd'));
    ins = null;
  }
  if (!ins) {
    ins = ss.insertSheet(CFG.TAB_INSTRUCCIONES);
    ins.appendRow(['clave', 'prompt', 'notas']);
    ins.setFrozenRows(1);
  }
  const existentes = leerTablaHoja_(ins).map(r => String(r.clave || '').trim().toUpperCase());
  const resp = promptsRespaldo_();
  Object.keys(resp).forEach(k => { if (existentes.indexOf(k) === -1) ins.appendRow([k, resp[k], NOTAS_PROMPTS[k]]); });
  ins.setColumnWidth(1, 140); ins.setColumnWidth(2, 700); ins.setColumnWidth(3, 320);
  ins.getRange(2, 2, Math.max(1, ins.getLastRow() - 1), 2).setWrap(true).setVerticalAlignment('top');

  const vacia = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (vacia && ss.getSheets().length > 1) ss.deleteSheet(vacia);

  // Base de conocimiento: semillas (solo si el tema no existe; el texto de la hoja siempre manda)
  const kb = ss.getSheetByName(CFG.TAB_CONOCIMIENTO);
  const temas = leerTablaHoja_(kb).map(r => s_(r.tema).trim().toLowerCase());
  CONOCIMIENTO_SEMILLA_.forEach(s => { if (temas.indexOf(s[0].toLowerCase()) === -1) kb.appendRow([s[0], s[1], s[2], 'SI', Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm')]); });
  kb.setColumnWidth(1, 260); kb.setColumnWidth(2, 640); kb.setColumnWidth(3, 160);
  kb.getRange(2, 2, Math.max(1, kb.getLastRow() - 1), 1).setWrap(true).setVerticalAlignment('top');

  ScriptApp.getProjectTriggers().filter(t => ['procesarCola', 'aprender'].indexOf(t.getHandlerFunction()) !== -1).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('procesarCola').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('aprender').timeBased().everyHours(1).create();

  if (!p.getProperty('WEBHOOK_KEY')) p.setProperty('WEBHOOK_KEY', Utilities.getUuid().replace(/-/g, ''));
  if (!p.getProperty('HUB_TOKEN')) p.setProperty('HUB_TOKEN', 'SpacioAM2026!');
  const url = ScriptApp.getService().getUrl();
  console.log('Hoja de ALMA: ' + ss.getUrl());
  console.log('URL para Hospitable:\n' + (url || '<tu URL /exec>') + '?k=' + p.getProperty('WEBHOOK_KEY'));
}

// Verifica tokens y hojas sin tocar a ningún huésped.
function probarConexiones() {
  const p = PropertiesService.getScriptProperties();
  console.log('HOSPITABLE_TOKEN: ' + (p.getProperty('HOSPITABLE_TOKEN') ? 'ok' : 'FALTA'));
  console.log('ANTHROPIC_KEY: ' + (p.getProperty('ANTHROPIC_KEY') ? 'ok' : 'FALTA'));
  console.log('HUB_TOKEN: ' + (p.getProperty('HUB_TOKEN') ? 'ok' : 'FALTA (ejecuta configurar)'));
  console.log('Hospitable API → HTTP ' + hosp_('get', '/properties?per_page=1').code + ' (200 = ok)');
  console.log('Claude → ' + (claude_(CFG.MODELO_CLASIFICADOR, 10, 'Responde solo: ok', 'ping') ? 'ok' : 'FALLÓ'));
  [CFG.TAB_COLA, CFG.TAB_CONTROL, CFG.TAB_LOG, CFG.TAB_INSTRUCCIONES, CFG.TAB_AUTOMEJORA, CFG.TAB_CONOCIMIENTO, CFG.TAB_RESERVAS, CFG.TAB_PROPIEDADES]
    .forEach(t => console.log('Hoja ' + t + ': ' + (hoja_(t) ? 'ok' : 'NO EXISTE')));
  console.log('Control: ' + JSON.stringify(leerControl_()));
}

// Simula ALMA sobre una reserva real (pon su UUID en CFG.PRUEBA_RESERVA_ID). Nunca envía nada: solo escribe en ALMA_LOG.
function probarConReserva() {
  const id = CFG.PRUEBA_RESERVA_ID;
  if (!id) throw new Error('Pon un UUID de reserva en CFG.PRUEBA_RESERVA_ID');
  const r = hosp_('get', '/reservations/' + id + '/messages');
  const hilo = normalizarHilo_(r.json);
  let i = hilo.length - 1; while (i >= 0 && hilo[i].tipo !== 'guest') i--;
  const hastaHuesped = hilo.slice(0, i + 1);
  if (!hastaHuesped.length) throw new Error('Esa reserva no tiene mensajes del huésped');
  const ctx = contexto_(id, hastaHuesped, 'SOMBRA');
  const cls = clasificar_(ctx); ctx.nivel = cls.nivel; ctx.razon = cls.razon;
  let borrador = '', qa = '';
  if (ctx.nivel !== 'SILENCIO' && ctx.nivel !== 'ROJO') {
    const red = redactarVerificado_(ctx); borrador = red.texto;
    qa = red.ok ? (red.problema ? 'QA corrigió: ' + red.problema : 'QA ok') : 'QA RETENDRÍA: ' + red.problema;
  }
  log_(ctx, borrador, 'PRUEBA (no enviado) · ' + qa);
  console.log(ctx.nivel + ' · ' + ctx.razon + '\n' + qa + '\n\n' + borrador);
}

/* ═══════════════════════════════ 10. AUTO MEJORA (observar al equipo) ═══════════════════════════════ */
/* Cada vez que una persona responde en lugar de ALMA, se anota el caso. Una hora después (APRENDER_MIN)
   aprender() compara lo que ALMA habría dicho con lo que dijo el humano y, si hay algo generalizable,
   deja una propuesta en ALMA_AUTOMEJORA con estado "pendiente". Nada se aplica sin aprobación del admin. */

/* Una persona respondió directo en Hospitable o WhatsApp: también es momento de aprendizaje. */
function automejoraOn_() { try { return leerControlPares_().AUTOMEJORA !== 'OFF'; } catch (e) { return true; } }
/* La hoja de automejora con sus columnas nuevas (contexto, beneficio); se agregan solas si faltan. */
function amHoja_() {
  const sh = hoja_(CFG.TAB_AUTOMEJORA); if (!sh) return null;
  const h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(x => String(x).trim().toLowerCase());
  ['contexto', 'beneficio'].forEach(k => { if (h.indexOf(k) === -1) { sh.getRange(1, h.length + 1).setValue(k); h.push(k); } });
  return { sh: sh, head: h };
}
function amAppend_(o) {
  const x = amHoja_(); if (!x) return;
  x.sh.appendRow(x.head.map(k => o[k] == null ? '' : o[k]));
}
/* Conversación completa (no solo el último mensaje) antes de un momento dado: texto para el entrenador y
   una versión corta para el snapshot del hub. */
function ctxConversacion_(hilo, hastaIdx) {
  const previos = (hilo || []).slice(0, hastaIdx == null ? (hilo || []).length : hastaIdx).filter(m => String(m.texto || '').trim());
  const et = m => (m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'AUTOMÁTICO' : 'SPACIO AM') + (m.llamada ? ' · en llamada' : m.canal === 'whatsapp' ? ' · por WhatsApp' : '');
  const txt = previos.slice(-16).map(m => '[' + et(m) + ' · ' + String(m.created || '').slice(0, 16).replace('T', ' ') + '] ' + String(m.texto).slice(0, 700)).join('\n');
  const json = JSON.stringify(previos.slice(-8).map(m => ({ d: m.tipo === 'guest' ? 'g' : m.auto ? 'a' : 'e', t: String(m.texto).slice(0, 400), ts: m.created || '' })));
  return { txt: txt, json: json };
}
function ctxDeConv_(resId, hastaMs) {
  try {
    if (!resId) return null;
    const hc = hiloConv_(resId); if (hc.code !== 200) return null;
    const hilo = hc.hilo || []; let i = hilo.length;
    if (hastaMs) { i = hilo.findIndex(m => new Date(m.created).getTime() > hastaMs + 60000); if (i < 0) i = hilo.length; }
    return ctxConversacion_(hilo, i);
  } catch (e) { return null; }
}
/* Borra de la automejora las tarjetas pendientes que no traen aprendizaje (observaciones sin cambio concreto). */
function purgarAutomejoraSinAprendizaje_() {
  const sh = hoja_(CFG.TAB_AUTOMEJORA); if (!sh || sh.getLastRow() < 2) return 0;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  const c = k => head.indexOf(k);
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  let n = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i];
    if (String(v[c('estado')]).trim() !== 'pendiente') continue;
    const clave = String(v[c('clave')] || '').trim().toUpperCase();
    let cambios = []; try { cambios = JSON.parse(v[c('cambios')] || '[]'); } catch (e) {}
    if (clave === 'OBSERVACION' || !Array.isArray(cambios) || !cambios.length) { sh.deleteRow(i + 2); n++; }
  }
  return n;
}
function hubPurgarAutomejora_() { return { ok: true, borradas: purgarAutomejoraSinAprendizaje_() }; }

function observarHumano_(convId, texto) {
  if (!automejoraOn_()) return;
  if (!convId || !String(texto || '').trim() || esContencion_(texto)) return;
  const pre = (function () { try { return preContexto_(convId) || {}; } catch (e) { return {}; } })();
  if (textosAlma_(pre.codigo).indexOf(String(texto).trim()) !== -1) return;   // lo envió ALMA
  const hace = new Date(Date.now() - 3 * 3600000).toISOString();
  if (leerTabla_(CFG.TAB_AUTOMEJORA).some(r => s_(r.reservation_id) === String(convId) && String(r.estado).trim() === 'observando' && s_(r.fecha) > hace)) return;
  observar_({ resId: convId, codigo: pre.codigo, propiedad: pre.propiedad, huesped: pre.huesped, ultimoGuestAt: hace, texto: '' }, '');
}
function observar_(c, borrador) {
  try {
    if (!c || !c.resId || !automejoraOn_()) return;
    amAppend_({ fecha: new Date().toISOString(), codigo: c.codigo || '', propiedad: c.propiedad || '', huesped: c.huesped || '', reservation_id: c.resId, ultimo_guest_at: c.ultimoGuestAt || '',
      pregunta: String(c.texto || '').slice(0, 1500), borrador_ia: String(borrador || '').slice(0, 1500), estado: 'observando' });
  } catch (e) { console.error('observar_: ' + e); }
}

const PROMPT_ENTRENADOR_ = 'Eres el entrenador de ALMA (Spacio AM). Recibes un CASO: la pregunta del huésped, lo que ALMA respondió o habría respondido, y una SEÑAL de que algo pudo salir mejor (una persona del equipo respondió distinto, el equipo marcó la respuesta como mejorable, el control de calidad la frenó, o el huésped tuvo que volver a preguntar). Decide si el caso enseña algo GENERALIZABLE: un matiz de tono, una política, una forma de manejar el caso, o un dato que ALMA debería tener. Tres salidas posibles. (A) Si falta un DATO o POLÍTICA (un horario, qué ofrecer, cómo funciona algo en un edificio), devuelve {"tipo":"conocimiento","tema":"título corto","aplica_a":"* o nombre de la propiedad","contenido":"texto en la voz de Alma","aprendizaje":"una frase","resumen":"una frase"}. (B) Si es una forma de responder o clasificar, propón cambios MÍNIMOS al PROMPT VIGENTE: agregar una o dos líneas en la sección que corresponde o corregir una existente; nunca reescribas el prompt. Devuelve {"tipo":"prompt","clave":"REDACTOR|CLASIFICADOR","aprendizaje":"una frase","resumen":"una frase","cambios":[{"tipo":"agregar|corregir","seccion":"título EXACTO de la sección","antes":"línea exacta (solo corregir)","despues":"línea nueva o corregida"}]}. (C) Si solo había información puntual de ese caso o no hay nada mejor, devuelve {"sin_mejora":true,"motivo":"..."}. Devuelve SOLO JSON.';

const REGLAS_SALIDA_ENTRENADOR_ = '\n\nCÓMO DECIDIR Y CÓMO ESCRIBIR (prevalece sobre lo anterior):\n' +
  '1) Lee la CONVERSACIÓN COMPLETA, no solo el último mensaje: entiende qué pidió el huésped, qué ya se le había dicho y en qué etapa está.\n' +
  '2) Propón una mejora SOLO si el caso enseña algo que ALMA aplicaría en OTRAS conversaciones. Si el equipo dio un dato puntual de esta reserva, confirmó algo, saludó, agradeció, cerró la conversación, coordinó algo interno o dijo lo mismo que ALMA con otras palabras, devuelve {"sin_mejora":true,"motivo":"una frase"}. Ante la duda: sin_mejora.\n' +
  '3) Agrega SIEMPRE el campo "beneficio". Los textos son para una persona ocupada que lee en el teléfono: español, tú, frases simples, sin jerga técnica (no digas prompt, sección, clasificador, redactor ni JSON).\n' +
  '   · "aprendizaje": lo que observamos en este caso, en máximo 20 palabras.\n' +
  '   · "resumen": la propuesta concreta, empezando con un verbo ("Ofrecer…", "Confirmar…", "Pedir…"), en máximo 20 palabras.\n' +
  '   · "beneficio": qué gana el huésped o el equipo si se aplica, en máximo 18 palabras.';
function compararRespuestas_(pregunta, borrador, humano, propiedad, senal, conversacion) {
  const txt = claude_(CFG.MODELO_REDACTOR, 1000, prompt_('ENTRENADOR') + REGLAS_SALIDA_ENTRENADOR_,
    'PROPIEDAD: ' + propiedad + '\nSEÑAL: ' + (senal || 'una persona del equipo respondió en lugar de ALMA') +
    (conversacion ? '\n\nCONVERSACIÓN COMPLETA HASTA ESE MOMENTO (la más reciente al final):\n' + conversacion : '') +
    '\n\nÚLTIMO TURNO DEL HUÉSPED:\n' + pregunta + '\n\nLO QUE ALMA ' + (humano ? 'HABRÍA RESPONDIDO' : 'RESPONDIÓ') + ':\n' + (borrador || '(nada)') +
    (humano ? '\n\nLO QUE RESPONDIÓ EL EQUIPO:\n' + humano : '') +
    '\n\nBASE DE CONOCIMIENTO ACTUAL:\n' + (conocimiento_(propiedad) || '(vacía)') +
    '\n\nPROMPT VIGENTE (REDACTOR):\n' + prompt_('REDACTOR') + '\n\nPROMPT VIGENTE (CLASIFICADOR):\n' + prompt_('CLASIFICADOR'), 0.2);
  try { return JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]); } catch (e) { return null; }
}
/* Deja una propuesta lista para revisar en el hub. Para conocimiento, clave=CONOCIMIENTO y cambios=[{tema, aplica_a, contenido}]. */
function proponerAutomejora_(info, prop) {
  const sh = hoja_(CFG.TAB_AUTOMEJORA);
  if (!sh || !prop || prop.sin_mejora || !automejoraOn_()) return false;
  const esKb = prop.tipo === 'conocimiento' && prop.tema && prop.contenido;
  if (!esKb && !(prop.cambios && prop.cambios.length)) return false;
  // evita duplicados: misma propuesta pendiente con el mismo resumen
  const pend = leerTabla_(CFG.TAB_AUTOMEJORA).some(r => String(r.estado).trim() === 'pendiente' && s_(r.resumen).trim() === s_(prop.resumen).trim());
  if (pend) return false;
  amAppend_({ fecha: new Date().toISOString(), codigo: info.codigo || '', propiedad: info.propiedad || '', huesped: info.huesped || '', reservation_id: info.resId || '', ultimo_guest_at: info.ultimoGuestAt || '',
    pregunta: String(info.pregunta || '').slice(0, 1500), borrador_ia: String(info.borrador || '').slice(0, 1500), respuesta_humana: String(info.humano || '').slice(0, 1500),
    clave: esKb ? 'CONOCIMIENTO' : String(prop.clave || 'REDACTOR').toUpperCase(), resumen: prop.resumen || '',
    cambios: JSON.stringify(esKb ? [{ tipo: 'conocimiento', tema: prop.tema, aplica_a: prop.aplica_a || '*', contenido: prop.contenido }] : prop.cambios),
    estado: 'pendiente', nota: (info.senal ? info.senal + ' · ' : '') + (prop.aprendizaje || ''), contexto: info.contexto || '', beneficio: prop.beneficio || '' });
  return true;
}

// Disparador cada hora (lo crea configurar()).
function aprender() {
  try { agentesLatido_(); } catch (e) { console.error('agentesLatido_: ' + e); }   // el equipo de agentes detrás de Alma (agentes.js)
  try { botsPruebaRevisar_(); } catch (e) { console.error('botsPruebaRevisar_: ' + e); }   // lo que encontraron los bots de prueba → Claude (botsprueba.js)
  try { purgarAutomejoraSinAprendizaje_(); } catch (e) { console.error('purgar: ' + e); }
  try { memoriaAprender_(); } catch (e) { console.error('memoriaAprender_: ' + e); }   // memoria de propiedades: corre aunque las propuestas de mejora estén apagadas
  if (!automejoraOn_()) return;
  try { aprenderSenales(); } catch (e) { console.error('aprenderSenales: ' + e); }
  try { amHoja_(); } catch (e) {}
  const sh = hoja_(CFG.TAB_AUTOMEJORA);
  if (!sh || sh.getLastRow() < 2) return;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  const col = k => head.indexOf(k);
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const limite = Date.now() - cfg_('APRENDER_MIN') * 60000;
  let n = 0;
  vals.forEach((v, i) => {
    if (n >= 10 || String(v[col('estado')]).trim() !== 'observando') return;
    if (new Date(v[col('fecha')]).getTime() > limite) return;
    n++;
    const fila = i + 2, setv = (k, x) => sh.getRange(fila, col(k) + 1).setValue(x);
    try {
      const resId = s_(v[col('reservation_id')]);
      const hc = hiloConv_(resId);
      if (hc.code && hc.code !== 200) { setv('nota', 'hilo HTTP ' + hc.code); return; }
      const hilo = hc.hilo || [];
      const desde = s_(v[col('ultimo_guest_at')]);
      const mios = textosAlma_(s_(v[col('codigo')]));
      const humanos = hilo.filter(m => m.tipo !== 'guest' && !m.auto && m.created > desde && String(m.texto || '').trim() && !esContencion_(m.texto) && mios.indexOf(m.texto.trim()) === -1);
      if (!humanos.length) { setv('estado', 'descartada'); setv('nota', 'nadie del equipo respondió'); return; }
      const humano = humanos.map(m => m.texto).join('\n\n');
      let pregunta = s_(v[col('pregunta')]);
      if (!pregunta) { pregunta = hilo.slice(0, hilo.indexOf(humanos[0])).filter(m => m.tipo === 'guest').slice(-3).map(m => m.texto).join('\n'); setv('pregunta', pregunta.slice(0, 1500)); }
      let borrador = s_(v[col('borrador_ia')]);
      if (!borrador) {   // ALMA calló: redacta en retrospectiva, solo con lo que había antes del humano
        const corte = hilo.indexOf(humanos[0]);
        const ctx = contexto_(resId, hilo.slice(0, corte), 'SOMBRA');
        if (ctx) {
          const cls = clasificar_(ctx); ctx.nivel = cls.nivel; ctx.razon = cls.razon;
          borrador = cls.nivel === 'SILENCIO' ? '(ALMA habría guardado silencio)' : redactar_(ctx);
          setv('borrador_ia', String(borrador).slice(0, 1500));
        }
      }
      setv('respuesta_humana', humano.slice(0, 1500));
      const cx = ctxConversacion_(hilo, hilo.indexOf(humanos[0]));
      if (col('contexto') >= 0) setv('contexto', cx.json);
      const prop = compararRespuestas_(pregunta, borrador, humano, s_(v[col('propiedad')]), 'el equipo respondió en lugar de ALMA', cx.txt);
      const esKb = prop && prop.tipo === 'conocimiento' && prop.tema && prop.contenido;
      /* Aunque no haya un cambio claro, el caso queda en automejora como observación para que el equipo lo vea. */
      /* Sin aprendizaje generalizable no se crea tarjeta: queda descartada con el motivo, solo en la hoja. */
      if (!prop || prop.sin_mejora || (!esKb && !(prop.cambios && prop.cambios.length))) { setv('estado', 'descartada'); setv('nota', 'sin aprendizaje' + (prop && prop.motivo ? ': ' + prop.motivo : '')); return; }
      setv('clave', esKb ? 'CONOCIMIENTO' : String(prop.clave || 'REDACTOR').toUpperCase()); setv('resumen', prop.resumen || '');
      setv('cambios', JSON.stringify(esKb ? [{ tipo: 'conocimiento', tema: prop.tema, aplica_a: prop.aplica_a || '*', contenido: prop.contenido }] : prop.cambios));
      setv('nota', prop.aprendizaje || ''); if (col('beneficio') >= 0) setv('beneficio', prop.beneficio || ''); setv('estado', 'pendiente');
    } catch (err) { setv('nota', 'error: ' + err); }
  });
}

/* Otras señales de mejora, revisadas cada hora junto con aprender():
   1) Pulgar abajo del equipo en el log.  2) QA frenó o corrigió una respuesta.
   3) El huésped volvió a preguntar poco después de que ALMA respondió.
   4) La misma duda se repite en una propiedad → falta conocimiento. */
function aprenderSenales() {
  const sh = hoja_(CFG.TAB_LOG);
  if (!sh || sh.getLastRow() < 2) return;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  const col = k => head.indexOf(k);
  if (col('corregida') < 0) return;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const g = (v, k) => col(k) >= 0 ? v[col(k)] : '';
  const marcar = (i, tag) => sh.getRange(i + 2, col('corregida') + 1).setValue(tag);
  const fechaMs = v => Date.parse(String(g(v, 'fecha')).replace(' ', 'T')) || 0;
  const limiteAprender = Date.now() - cfg_('APRENDER_MIN') * 60000;
  let n = 0;
  const ctxCache = {};
  const ctxDe = v => { const id = s_(g(v, 'reservation_id')), k = id + '|' + fechaMs(v); if (!(k in ctxCache)) ctxCache[k] = ctxDeConv_(id, fechaMs(v)); return ctxCache[k] || { txt: '', json: '' }; };
  const info = (v, senal, extra) => Object.assign({ codigo: g(v, 'codigo'), propiedad: g(v, 'propiedad'), huesped: g(v, 'huesped'), resId: g(v, 'reservation_id'), pregunta: g(v, 'pregunta'), borrador: g(v, 'respuesta'), senal: senal, contexto: ctxDe(v).json }, extra || {});

  vals.forEach((v, i) => {
    if (n >= 6 || String(g(v, 'corregida')).trim()) return;
    if (fechaMs(v) > limiteAprender) return;
    const acc = String(g(v, 'accion') || ''), razon = String(g(v, 'razon') || '');
    // 1) pulgar abajo
    if (String(g(v, 'voto')).toLowerCase() === 'down') {
      n++; const p = compararRespuestas_(g(v, 'pregunta'), g(v, 'respuesta'), '', g(v, 'propiedad'), 'el equipo marcó esta respuesta como mejorable', ctxDe(v).txt);
      marcar(i, proponerAutomejora_(info(v, 'pulgar abajo'), p) ? 'automejora' : 'revisado');
      return;
    }
    // 2) QA frenó o corrigió
    if (/RETENIDO por QA/i.test(acc) || /QA:/i.test(razon)) {
      n++; const p = compararRespuestas_(g(v, 'pregunta'), g(v, 'respuesta'), '', g(v, 'propiedad'), 'el control de calidad detectó: ' + (razon.split('QA:')[1] || acc).trim(), ctxDe(v).txt);
      marcar(i, proponerAutomejora_(info(v, 'control de calidad'), p) ? 'automejora' : 'revisado');
      return;
    }
    // 3) ALMA respondió y el huésped volvió a preguntar en < 40 min con algo que no es acuse
    if (/^ENVIADO al huésped/i.test(acc)) {
      const t0 = fechaMs(v), cod = String(g(v, 'codigo'));
      const re = vals.find((w, j) => j > i && String(g(w, 'codigo')) === cod && fechaMs(w) - t0 > 0 && fechaMs(w) - t0 < 40 * 60000 && !/acuse|SILENCIO/i.test(String(g(w, 'accion')) + String(g(w, 'nivel'))));
      if (re) {
        n++; const p = compararRespuestas_(g(v, 'pregunta') + '\n\n[El huésped volvió a escribir]: ' + g(re, 'pregunta'), g(v, 'respuesta'), '', g(v, 'propiedad'), 'el huésped tuvo que volver a preguntar tras la respuesta de ALMA', ctxDe(re).txt);
        marcar(i, proponerAutomejora_(info(v, 'el huésped volvió a preguntar'), p) ? 'automejora' : 'revisado');
        return;
      }
      marcar(i, 'ok');
    }
  });

  // 4) misma duda repetida por propiedad (≥3 en 30 días, VERDE/AMARILLO) → conocimiento
  const hace30 = Date.now() - 30 * 86400000;
  const porProp = {};
  vals.forEach(v => {
    if (fechaMs(v) < hace30 || ['VERDE', 'AMARILLO'].indexOf(String(g(v, 'nivel')).toUpperCase()) === -1) return;
    const k = String(g(v, 'propiedad')).trim(); if (!k) return;
    (porProp[k] = porProp[k] || []).push(v);
  });
  const ya = leerTabla_(CFG.TAB_AUTOMEJORA).filter(r => s_(r.clave) === 'CONOCIMIENTO').map(r => s_(r.propiedad) + '|' + s_(r.nota).split(' · ')[0]);
  Object.keys(porProp).forEach(prop => {
    if (n >= 8) return;
    const filas = porProp[prop];
    if (filas.length < 3 || ya.indexOf(prop + '|patrón repetido') !== -1) return;
    const razones = filas.map(v => String(g(v, 'razon')).toLowerCase().replace(/[^a-záéíóúñ ]/g, '').trim()).filter(Boolean);
    const cuenta = {}; razones.forEach(r => { const k = r.split(' ').slice(0, 3).join(' '); cuenta[k] = (cuenta[k] || 0) + 1; });
    const top = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
    if (!top || cuenta[top] < 3) return;
    n++;
    const ejemplos = filas.filter(v => String(g(v, 'razon')).toLowerCase().indexOf(top.split(' ')[0]) !== -1).slice(0, 3);
    const p = compararRespuestas_(ejemplos.map(v => '· ' + g(v, 'pregunta')).join('\n'), ejemplos.map(v => '· ' + g(v, 'respuesta')).join('\n'), '', prop, 'la misma duda se repite ' + cuenta[top] + ' veces en 30 días (' + top + '); conviene fijarla como conocimiento de la propiedad');
    proponerAutomejora_({ propiedad: prop, pregunta: ejemplos.map(v => g(v, 'pregunta')).join('\n---\n'), borrador: ejemplos[0] ? g(ejemplos[0], 'respuesta') : '', senal: 'patrón repetido' }, p);
  });
}

/* Aplica cambios puntuales (agregar/corregir líneas) sobre un prompt sin reescribirlo. */
function aplicarCambiosPrompt_(prompt, cambios) {
  const lineas = String(prompt || '').split('\n');
  (cambios || []).forEach(c => {
    const nuevo = String(c.despues || '').trim();
    if (!nuevo) return;
    if (c.tipo === 'corregir' && c.antes) {
      let i = lineas.findIndex(l => l.trim() === String(c.antes).trim());
      if (i < 0) i = lineas.findIndex(l => l.indexOf(String(c.antes).trim()) >= 0);
      if (i >= 0) { lineas[i] = nuevo; return; }
    }
    const anc = String(c.seccion || '').trim();
    let j = anc ? lineas.findIndex(l => l.trim() === anc) : -1;
    if (j < 0 && anc) j = lineas.findIndex(l => l.trim() && anc.toLowerCase().indexOf(l.trim().toLowerCase()) === 0);
    if (j < 0) { lineas.push('', nuevo); return; }
    let k = j + 1;
    while (k < lineas.length && lineas[k].trim() !== '') k++;
    lineas.splice(k, 0, nuevo);
  });
  return lineas.join('\n');
}

/* ═══════════════════════════════ 11. API DEL HUB ═══════════════════════════════ */
/* hub.spacioam.com lee las pestañas directamente (gviz). Para escribir y para la IA llama a
   doPost con {hub:1, action, token}. Las URLs de adjuntos de Hospitable son públicas y caducan;
   el hub las muestra mientras vivan. */

/* Foto de Hospitable vía el script (con token): para URLs privadas o que el navegador no puede abrir. Máx. 4 MB. */
function hubFoto_(url) {
  url = String(url || ''); if (!/^https:\/\//.test(url)) return { ok: false, error: 'url' };
  const token = PropertiesService.getScriptProperties().getProperty('HOSPITABLE_TOKEN');
  let r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() >= 300 && /hospitable/i.test(url)) r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { Authorization: 'Bearer ' + token } });
  if (r.getResponseCode() >= 300) return { ok: false, error: 'http ' + r.getResponseCode() };
  const b = r.getBlob(), bytes = b.getBytes(); if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: 'grande' };
  return { ok: true, data: 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(bytes) };
}
function adjuntos_(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map(a => (typeof a === 'string' ? a : (a && (a.url || a.src || a.file_url || a.href)) || '')).filter(Boolean).slice(0, 6);
}

function hubApi_(body) {
  const p = PropertiesService.getScriptProperties();
  const tok = p.getProperty('HUB_TOKEN');
  /* Fase 1b: la app envía la sesión firmada del login (body.session). Mientras todas las apps se actualizan,
     la llave antigua (HUB_TOKEN) sigue valiendo; HUB_SOLO_SESION=1 la apaga. */
  const ses = body.session ? sesionLogin_(body.session) : null;
  if (ses) marcaAcceso_('HUB_ULTIMA_SESION');
  else {
    if (p.getProperty('HUB_SOLO_SESION') === '1' || !tok || body.token !== tok) return json_({ ok: false, error: body.session ? 'session' : 'token' });
    marcaAcceso_('HUB_ULTIMA_LLAVE');
  }
  try {
    switch (body.action) {
      case 'setControl': return json_(hubSetControl_(body.valores || {}));
      case 'tutoriales': return json_(hubTutoriales_());                                 // quién vio cada tutorial (tutoriales.js)
      case 'llaveClaude': return json_(paraClaudeLlave_(ses, body.llave));
      case 'pendientesClaude': return json_(paraClaudePendientes_(ses));                    // app de Alma: botón «Pendientes»
      case 'pendienteHecho': return json_(paraClaudeHecho_(ses, body.id));
      case 'conferencia': return json_(conferencia_(ses, body));
      case 'conferenciaAudio': return json_(conferenciaAudio_(ses, body));                  // modo conferencia: una parte del audio de una reunión (conferencia.js)                            // app de Alma: modo conferencia (conferencia.js)
      case 'notificaciones': return json_(vozNotificaciones_(ses));                        // app de Alma: botón «Notificaciones» (historial de avisos, voz.js)
      case 'pendientes': return json_(pendientesTodo_(ses));                               // app de Alma: Pendientes por esfera (pendientes.js)
      case 'pendienteResolver': return json_(pendResolver_(ses, body.id));
      case 'pendienteResponder': return json_(pendResponder_(ses, body));                   // Pendientes: «Responder» con texto a quien preguntó (pendientes.js)
      case 'pendienteNota': return json_(pendNota_(ses, body));                             // Pendientes: la nota de voz de «Responder», en texto (pendientes.js)
      case 'unirPr': return json_(unirPrSes_(ses, body.ref));                                 // app de Alma: botón «Unir» de Pendientes (unir.js)
      case 'mejorarCampo': return json_(mejorarCampo_(ses, body));                         // app de Alma: dos toques a Alma con un cuadro de texto activo (campo.js)
      case 'agentes': return json_(agAccion_(ses, body));                                    // equipo de agentes detrás de Alma (agentes.js · alma/agentes.html)
      case 'correos': return json_(correoApi_(ses, body));                                 // app de Alma: correos ordenados (correo.js · alma/correos.html)
      case 'areas': return json_(areas_(ses));                                            // app de Alma: las 6 áreas de vida (areas.js)
      case 'areaMover': return json_(areaMover_(ses, body.clave, body.area));
      case 'conexiones': return json_(conexiones_(ses, body));                               // hub.spacioam.com/alma/conexiones.html               // hub.spacioam.com/claude.html: guarda CLAUDE_RUTINA_TOKEN (paraclaude.js)
      case 'almaFoto': return json_(almaFoto_(ses, body.foto, !!body.captura));                          // foto del chat de Alma: la describe para que Alma la entienda
      case 'vozAvisos': return json_(vozAvisos_(ses));                                    // app de iPhone: avisos para decir al oído
      case 'vozWeb': return json_(vozWebInicio_(ses, !!body.ligero, body.app === 'alma'));                    // Alma por voz desde el menú (voz.js)
      case 'vozWebVincular': return json_(vozWebVincular_(ses, body.conv_id, body.app === 'alma'));
      case 'setPrompt': return json_(hubSetPrompt_(body.clave, body.prompt, body.nota, body.meta));
      case 'mejoras': return json_(hubMejoras_());
      case 'acciones': return json_(accionesLista_());                                  // acciones pendientes del usuario (paraclaude.js)
      case 'accionHecha': return json_(accionMarcar_(body.id));
      case 'usoIA': return json_(hubUsoIA_(body.dias));
      case 'usoMensual': return json_(usoMensual_(body.mes));                          // reporte mensual por esfera (usomensual.js)
      case 'mejoraEditar': return json_(hubMejoraEditar_(body.id, body.cambios, body.resumen));
      case 'mejoraEliminar': return json_(hubMejoraEliminar_(body.id));
      case 'mejoraVerificar': return json_(hubMejoraVerificar_(body.id));
      case 'prompts': return json_(hubPrompts_());
      case 'setAuto': return json_(hubSetAuto_(body.resId, !!body.on, body.quien));
      case 'setBorrador': return json_(hubSetBorrador_(Number(body.fila), body.borrador));
      case 'enviarAhora': return json_(hubEnviarAhora_(Number(body.fila)));
      case 'retener': return json_(hubRetener_(Number(body.fila)));
      case 'proponerMejora': return json_(hubProponerMejora_(body.clave, body.prompt, body.pedido));
      case 'ajustarBorrador': return json_(hubAjustarBorrador_(body.borrador, body.ajuste, body.contexto));
      case 'guestReview': return json_(hubGuestReview_(body.resId));
      case 'enviarReview': return json_(hubEnviarReview_(body.resId, body.texto, body.recomendar, body.privado, body.delay));
      case 'reviewHuesped': return json_(hubReviewHuesped_(body.resId, body.recomendar, body.contexto, body.ajuste, body.previo));
      case 'respuestaReview': return json_(hubRespuestaReview_(body.review, body.contexto, body.ajuste, body.previo));
      case 'publicarRespuesta': return json_(hubPublicarRespuesta_(body.uuid, body.texto));
      case 'apelacionReview': return json_(hubApelacion_(body.review, body.contexto, body.ajuste, body.previo));
      case 'automejora': return json_(hubAutomejora_(Number(body.fila), body.estado, body.cambios, body.nota, body.fecha));
      case 'purgarAutomejora': return json_(hubPurgarAutomejora_());
      case 'setConocimiento': return json_(hubSetConocimiento_(body.fila, body.tema, body.contenido, body.aplica, body.activo, body.meta));
      case 'setPropiedadDato': return json_(hubSetPropiedadDato_(body.propiedad, body.campo, body.valor, body.meta));
      case 'hilo': return json_(hubHilo_(body.resId));
      case 'redactarHub': return json_(hubRedactar_(body.resId, body.texto, body.hilo));
      case 'responder': if (String(body.resId || '') === 'op:desarrollo') return json_(paraClaudeDesdeChat_(ses, body.texto));   // responder en «Desarrollo» = seguimiento para Claude
        return json_(hubResponderSeguro_(body, ses));   // si no sale, avisa a quien lo escribió (envio.js)
      case 'responderWa': return json_(hubResponderSeguro_(body, ses));
      case 'promesas': return json_(hubPromesas_(!!body.todas));
      case 'promesaCerrar': return json_(hubPromesaCerrar_(body.id, body.quien));
      case 'limpiezas': return json_(hubLimpiezas_(body.codigo));
      case 'pasos': return json_(hubPasos_(body.ids));
      case 'waNumeros': return json_({ ok: true, numeros: telsReserva_(body.resId) });
      case 'resolver': return json_(hubResolver_(body.key, body.estado, body.quien, body.ts));
      case 'reservaInfo': return json_(hubReservaInfo_(body.resId));
      case 'programados': return json_(hubProgramados_(body.resId));
      case 'programar': return json_(hubProgramar_(body.resId, body.texto, body.envio, body.quien));
      case 'adelantar': return json_(hubAdelantar_(body.resId, body.id, body.texto));
      case 'cancelarProg': return json_(hubCancelarProg_(body.resId, body.id));
      case 'editarProg': return json_(hubEditarProg_(body.resId, body.id, body.texto, body.quien));
      case 'cola': return json_(hubCola_(body.horas, body.hash));
      case 'probarPush': return json_(hubProbarPush_(body.email));
      case 'pushLog': return json_(hubPushLog_(body.horas));
      case 'setEscalamiento': return json_(hubSetEscalamiento_(body.lista));
      case 'foto': return json_(hubFoto_(body.url));
      case 'votar': return json_(hubVotar_(Number(body.fila), body.voto));
      case 'opHilo': return json_(hubOpHilo_(body.email, body.de));
      case 'opEnviar': return json_(hubOpEnviar_(body.email, body.texto));
      case 'opLista': return json_(hubOpLista_(body.email));
      case 'dsPropuestas': return json_(dsPropuestas_());
      case 'dsDecidir': return json_(dsDecidir_(body.id, body.decision, body.nota, body.quien));
      default: return json_({ ok: false, error: 'accion' });
    }
  } catch (err) {
    console.error('hubApi_: ' + (err.stack || err));
    return json_({ ok: false, error: String(err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ALMA_CONTROL: clave | valor | qué hace. Solo toca el valor de las claves conocidas. */
/* Solo escribe claves válidas con valores válidos (nunca vacíos en los interruptores) y deja huella en
   ALMA_LOG de cada cambio para saber quién apagó o cambió qué y cuándo. */
function hubSetControl_(valores) {
  repararControl_();
  const sh = hoja_(CFG.TAB_CONTROL);
  const filas = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  const claves = filas.map(r => String(r[0]).trim().toUpperCase());
  const permitidas = ['TOGGLE', 'MODO', 'HORARIO', 'SOLO_RESERVA', 'AUTOMEJORA'].concat(NUM_KEYS);
  const LISTA = { TOGGLE: ['ON', 'OFF'], MODO: ['SOMBRA', 'BORRADOR', 'AUTO'], HORARIO: ['ON', 'OFF'], AUTOMEJORA: ['ON', 'OFF'] };
  const cambios = [];
  Object.keys(valores).forEach(k => {
    const K = k.toUpperCase();
    if (permitidas.indexOf(K) === -1) return;
    const v = String(valores[k] == null ? '' : valores[k]).trim().toUpperCase();
    if (LISTA[K] && LISTA[K].indexOf(v) === -1) return;            // interruptor vacío o inválido: se ignora
    if (NUM_KEYS.indexOf(K) !== -1 && (v === '' || isNaN(Number(v)))) return;
    const i = claves.indexOf(K);
    const antes = i === -1 ? '' : String(filas[i][1]).trim().toUpperCase();
    if (antes === v) return;
    if (i === -1) sh.appendRow([K, v, (CONTROL_DESC_[K] || '')]); else sh.getRange(i + 1, 2).setValue(v);
    cambios.push(K + ': ' + (antes || '—') + ' → ' + v);
  });
  CTRL_NUM_ = null;
  if (cambios.length) {
    try {
      hoja_(CFG.TAB_LOG).appendRow([Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), '', '', 'CONTROL', 'Cambio desde el hub', '', '', '', '', 'control: ' + cambios.join(' · ')]);
    } catch (e) { console.error('log control: ' + e); }
  }
  return { ok: true, control: leerControl_(), cambios: cambios };
}

/* ALMA_INSTRUCCIONES: clave | prompt | notas. Guarda el prompt y deja la huella de la mejora en notas. */
function hubSetPrompt_(clave, prompt, nota, meta) {
  clave = String(clave || '').trim().toUpperCase();
  if (!clave || !prompt) return { ok: false, error: 'faltan datos' };
  if (meta && Array.isArray(meta.cambios) && meta.cambios.length) regMejora_({ por: meta.por, origen: meta.origen || 'hub', tipo: 'prompt', clave: clave, resumen: nota, cambios: meta.cambios, pedido: meta.pedido });
  const sh = hoja_(CFG.TAB_INSTRUCCIONES);
  const claves = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => String(r[0]).trim().toUpperCase());
  const i = claves.indexOf(clave);
  const sello = Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM yyyy HH:mm') + ' · ' + String(nota || 'mejora desde el hub');
  if (i === -1) { sh.appendRow([clave, prompt, sello]); return { ok: true }; }
  const notasPrev = String(sh.getRange(i + 1, 3).getValue() || '');
  sh.getRange(i + 1, 2).setValue(prompt);
  sh.getRange(i + 1, 3).setValue((notasPrev ? notasPrev + '\n' : '') + sello);
  PROMPTS_ = null;
  return { ok: true };
}

/* ── HISTORIAL DE MEJORAS (ALMA_MEJORAS) ──
   Cada mejora aplicada (anotación, Mejoras, auto mejora, conocimiento o dato) queda aquí con sus cambios exactos.
   Desde el hub se edita, se elimina (se revierte en el prompt/la base) o se verifica.
   Las mejoras activas de REDACTOR y CLASIFICADOR se inyectan DESPUÉS de las reglas fijas (mejorasBloque_): antes una
   regla fija como "acuse = SILENCIO" anulaba cualquier mejora escrita dentro del prompt. */
const MEJ_CAB_ = ['id', 'fecha', 'por', 'origen', 'tipo', 'clave', 'resumen', 'cambios', 'ref', 'estado', 'verificado', 'verif_nota'];
let MEJ_CACHE_ = null;
function hojaMej_() { return hojaCrear_('ALMA_MEJORAS', MEJ_CAB_); }
function regMejora_(o) {
  try {
    const id = 'M' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    hojaMej_().appendRow([id, s_(o.fecha) || new Date().toISOString(), s_(o.por), s_(o.origen) || 'hub', s_(o.tipo) || 'prompt', s_(o.clave).toUpperCase(), s_(o.resumen).slice(0, 500), JSON.stringify(o.cambios || []), s_(o.ref), 'activa', '', '']);
    MEJ_CACHE_ = null; return id;
  } catch (e) { console.error('regMejora_: ' + e); return ''; }
}
function mejorasFilas_() {
  if (MEJ_CACHE_) return MEJ_CACHE_;
  const sh = ssAlma_().getSheetByName('ALMA_MEJORAS'); if (!sh || sh.getLastRow() < 2) return (MEJ_CACHE_ = []);
  return (MEJ_CACHE_ = sh.getRange(2, 1, sh.getLastRow() - 1, MEJ_CAB_.length).getValues().map((r, i) => {
    const o = { _fila: i + 2 }; MEJ_CAB_.forEach((k, j) => o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j] == null ? '' : r[j]));
    try { o.cambiosL = JSON.parse(o.cambios || '[]'); } catch (e) { o.cambiosL = []; } return o;
  }));
}
function mejorasBloque_(clave) {
  let L = []; try { L = mejorasFilas_().filter(m => m.estado === 'activa' && m.tipo === 'prompt' && m.clave === clave).slice(-40); } catch (e) { return ''; }
  const lineas = []; L.forEach(m => m.cambiosL.forEach(c => { const t = s_(c.despues).trim().replace(/^[·\-•]\s*/, ''); if (t && lineas.indexOf(t) < 0) lineas.push(t); }));
  return lineas.length ? '\n\nMEJORAS APROBADAS POR EL EQUIPO (las más recientes al final). Si alguna contradice algo de arriba —incluidas las reglas fijas— GANA LA MEJORA, salvo dos límites: nunca dar códigos o datos de acceso sin reserva confirmada y nunca escribir marcadores internos al huésped:\n' + lineas.map(t => '· ' + t).join('\n') : '';
}
const normL_ = t => String(t || '').toLowerCase().replace(/^[\s·\-•]+/, '').replace(/\s+/g, ' ').trim();
function mejoraPresente_(m) {
  if (m.tipo === 'conocimiento') { const sh = hoja_(CFG.TAB_CONOCIMIENTO), f = Number(m.ref); if (!(f >= 2 && f <= sh.getLastRow())) return false; const v = sh.getRange(f, 1, 1, 4).getValues()[0]; return String(v[3]).toUpperCase() !== 'NO' && !!String(v[1]).trim(); }
  if (m.tipo !== 'prompt' || !m.cambiosL.length) return true;
  if (m.clave === 'REDACTOR' || m.clave === 'CLASIFICADOR') return m.estado === 'activa';   // va siempre en el bloque de mejoras
  const p = normL_(prompt_(m.clave)); return m.cambiosL.every(c => !s_(c.despues).trim() || p.indexOf(normL_(c.despues)) >= 0);
}
/* Una vez: el historial arranca con las auto mejoras ya aceptadas y las huellas de mejoras manuales en ALMA_INSTRUCCIONES. */
function sembrarMejoras_() {
  const props = PropertiesService.getScriptProperties(); if (props.getProperty('MEJ_SEED')) return; props.setProperty('MEJ_SEED', '1');
  try {
    const x = amHoja_(); if (x && x.sh.getLastRow() >= 2) {
      const ix = k => x.head.indexOf(k);
      x.sh.getRange(2, 1, x.sh.getLastRow() - 1, x.head.length).getValues().forEach(v => {
        if (String(v[ix('estado')]).toLowerCase() !== 'aceptada') return;
        const clave = String(v[ix('clave')] || 'REDACTOR').toUpperCase(); if (clave === 'OBSERVACION') return;
        let c = []; try { c = JSON.parse(v[ix('cambios')] || '[]'); } catch (e) {}
        const f = v[ix('fecha')];
        regMejora_({ fecha: f instanceof Date ? f.toISOString() : s_(f), origen: 'auto', tipo: clave === 'CONOCIMIENTO' ? 'conocimiento' : 'prompt', clave: clave, resumen: v[ix('resumen')], cambios: c });
      });
    }
  } catch (e) { console.error('sembrar automejora: ' + e); }
  try {
    const sh = hoja_(CFG.TAB_INSTRUCCIONES);
    sh.getRange(1, 1, sh.getLastRow(), 3).getValues().forEach(r => {
      const clave = String(r[0]).trim().toUpperCase(); if (!clave || clave === 'CLAVE') return;
      String(r[2] || '').split('\n').forEach(l => {
        const m = l.match(/^(\d{1,2} \w{3} \d{4} \d{1,2}:\d{2}) · (.+)$/); if (!m || /^auto mejora:/i.test(m[2])) return;
        regMejora_({ fecha: m[1], origen: 'historial', tipo: 'prompt', clave: clave, resumen: m[2], cambios: [] });
      });
    });
  } catch (e) { console.error('sembrar instrucciones: ' + e); }
}
function hubMejoras_() {
  sembrarMejoras_(); MEJ_CACHE_ = null;
  const L = mejorasFilas_().filter(m => m.estado !== 'eliminada').slice(-200).reverse();
  return { ok: true, lista: L.map(m => { let en = false; try { en = mejoraPresente_(m); } catch (e) {}
    return { id: m.id, fecha: m.fecha, por: m.por, origen: m.origen, tipo: m.tipo, clave: m.clave, resumen: m.resumen, cambios: m.cambiosL, ref: m.ref, estado: m.estado, verificado: m.verificado, verifNota: m.verif_nota, enPrompt: en, editable: m.cambiosL.length > 0 }; }) };
}
/* pares: [{viejo, nuevo}] · nuevo '' = quitar la línea · viejo '' o no encontrado = agregar al final. */
function promptEditarLineas_(clave, pares) {
  const lineas = String(prompt_(clave) || '').split('\n');
  pares.forEach(p => {
    const v = normL_(p.viejo); let i = v ? lineas.findIndex(l => normL_(l) === v) : -1;
    if (i < 0 && v) i = lineas.findIndex(l => normL_(l).indexOf(v) >= 0);
    if (i >= 0) { if (p.nuevo) lineas[i] = p.nuevo; else lineas.splice(i, 1); } else if (p.nuevo) lineas.push('', p.nuevo);
  });
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n');
}
function mejoraGuardar_(m, o) { const sh = hojaMej_(); Object.keys(o).forEach(k => { const c = MEJ_CAB_.indexOf(k); if (c >= 0) sh.getRange(m._fila, c + 1).setValue(o[k]); }); MEJ_CACHE_ = null; }
function hubMejoraEditar_(id, cambios, resumen) {
  const m = mejorasFilas_().find(x => x.id === id); if (!m) return { ok: false, error: 'ya no existe' };
  cambios = Array.isArray(cambios) ? cambios.map(x => s_(x).trim()) : [];
  if (m.tipo === 'conocimiento') {
    const sh = hoja_(CFG.TAB_CONOCIMIENTO), f = Number(m.ref), t = cambios[0]; if (!t) return { ok: false, error: 'texto vacío' };
    if (f >= 2 && f <= sh.getLastRow()) sh.getRange(f, 2).setValue(t); else { const r = hubSetConocimiento_(null, (m.cambiosL[0] || {}).tema || m.resumen, t, (m.cambiosL[0] || {}).aplica_a || '*', true); m.ref = String(r.fila); }
    m.cambiosL = [Object.assign({}, m.cambiosL[0] || {}, { despues: t })];
  } else if (m.tipo === 'dato') {
    const c0 = m.cambiosL[0] || {}; const r = hubSetPropiedadDato_(m.ref, c0.campo, cambios[0] || ''); if (!r.ok) return r; c0.despues = cambios[0] || ''; m.cambiosL = [c0];
  } else {
    if (!m.cambiosL.length) return { ok: false, error: 'esta mejora es anterior al historial: edítala desde el prompt' };
    const pares = m.cambiosL.map((c, i) => ({ viejo: s_(c.despues), nuevo: cambios[i] != null && cambios[i] !== '' ? cambios[i] : s_(c.despues) })).filter(p => p.viejo !== p.nuevo);
    if (pares.length) { const r = hubSetPrompt_(m.clave, promptEditarLineas_(m.clave, pares), 'mejora editada: ' + (resumen || m.resumen)); if (!r.ok) return r; }
    m.cambiosL.forEach((c, i) => { if (cambios[i]) c.despues = cambios[i]; });
  }
  mejoraGuardar_(m, { cambios: JSON.stringify(m.cambiosL), resumen: s_(resumen || m.resumen).slice(0, 500), ref: m.ref, verificado: '', verif_nota: '' });
  PROMPTS_ = null; return { ok: true };
}
function hubMejoraEliminar_(id) {
  const m = mejorasFilas_().find(x => x.id === id); if (!m) return { ok: false, error: 'ya no existe' };
  if (m.tipo === 'conocimiento') { const sh = hoja_(CFG.TAB_CONOCIMIENTO), f = Number(m.ref); if (f >= 2 && f <= sh.getLastRow()) sh.getRange(f, 4).setValue('NO'); }
  else if (m.tipo === 'dato') { const c0 = m.cambiosL[0] || {}; if (c0.campo) hubSetPropiedadDato_(m.ref, c0.campo, c0.antes || ''); }
  else if (m.cambiosL.length) {
    const pares = m.cambiosL.map(c => ({ viejo: s_(c.despues), nuevo: c.tipo === 'corregir' && c.antes ? s_(c.antes) : '' }));
    const r = hubSetPrompt_(m.clave, promptEditarLineas_(m.clave, pares), 'mejora eliminada: ' + m.resumen); if (!r.ok) return r;
  }
  mejoraGuardar_(m, { estado: 'eliminada' }); PROMPTS_ = null;
  return { ok: true };
}
/* Verificar: ¿sigue en el prompt / la base? y ¿el prompt completo que ALMA usa hoy la cumpliría o algo la contradice? */
function hubMejoraVerificar_(id) {
  const m = mejorasFilas_().find(x => x.id === id); if (!m) return { ok: false, error: 'ya no existe' };
  let en = false; try { en = mejoraPresente_(m); } catch (e) {}
  let seCumple = en, conflicto = '', nota = en ? 'Activa' : 'No se encuentra: la mejora se perdió o se sobrescribió';
  if (en && m.tipo === 'prompt' && m.cambiosL.length) {
    const base = m.clave === 'CLASIFICADOR' ? prompt_('CLASIFICADOR') + reglas_('REGLAS_CLASIFICADOR') + mejorasBloque_('CLASIFICADOR')
      : m.clave === 'REDACTOR' ? prompt_('REDACTOR') + reglas_('REGLAS_REDACTOR') + estilo_() + mejorasBloque_('REDACTOR') : prompt_(m.clave);
    const out = claude_(CFG.MODELO_CLASIFICADOR, 300, 'Auditas las instrucciones de ALMA (asistente de huéspedes de Spacio AM). Recibes el PROMPT COMPLETO que ALMA usa hoy y una MEJORA aprobada por el equipo. Decide si, con este prompt tal como está, el modelo seguiría la mejora. Busca reglas que la contradigan o la anulen. Devuelve SOLO JSON sin markdown: {"se_cumple": true|false, "conflicto": "cita breve de la regla que la contradice, o vacío", "nota": "máximo 25 palabras en español"}',
      'PROMPT COMPLETO:\n' + base.slice(-30000) + '\n\nMEJORA:\n' + m.cambiosL.map(c => '· ' + s_(c.despues)).join('\n'), 0);
    try { const j = JSON.parse(String(out).match(/\{[\s\S]*\}/)[0]); seCumple = j.se_cumple !== false; conflicto = s_(j.conflicto).slice(0, 300); nota = s_(j.nota).slice(0, 200) || (seCumple ? 'Se cumple' : 'No se cumple'); } catch (e) { nota = 'Activa · no se pudo auditar ahora'; }
  }
  const sello = new Date().toISOString();
  mejoraGuardar_(m, { verificado: sello, verif_nota: (seCumple ? 'OK · ' : 'REVISAR · ') + nota + (conflicto ? ' · Choca con: ' + conflicto : '') });
  return { ok: true, enPrompt: en, seCumple: seCumple, conflicto: conflicto, nota: nota, verificado: sello };
}

function filaCola_(fila) {
  const sh = hoja_(CFG.TAB_COLA);
  if (!fila || fila < 2 || fila > sh.getLastRow()) throw new Error('fila fuera de rango');
  const v = sh.getRange(fila, 1, 1, COLA_HEADERS.length).getValues()[0];
  return { sh: sh, f: { fila: fila, v: v } };
}
function hubSetBorrador_(fila, borrador) {
  const x = filaCola_(fila);
  const d = JSON.parse(x.f.v[C.datos] || '{}');
  d.borrador = String(borrador || '').trim();
  d.ajustadoPorHub = new Date().toISOString();
  set_(x.sh, x.f, { datos: JSON.stringify(d), nota: (x.f.v[C.nota] || '') + ' · ajustado desde el hub' });
  return { ok: true };
}
function hubEnviarAhora_(fila) {
  const x = filaCola_(fila);
  if (x.f.v[C.estado] !== 'esperando_envio') return { ok: false, error: 'solo aplica a envíos programados' };
  set_(x.sh, x.f, { proximo: new Date().toISOString() });
  PropertiesService.getScriptProperties().setProperty('ALMA_ACTIVO', '1');
  return { ok: true };
}
function hubRetener_(fila) {
  const x = filaCola_(fila);
  if (FINALES.indexOf(x.f.v[C.estado]) !== -1) return { ok: false, error: 'ya cerrado' };
  const d = JSON.parse(x.f.v[C.datos] || '{}');
  set_(x.sh, x.f, { estado: 'omitido', nota: 'retenido desde el hub' });
  log_(d, d.borrador || '', 'retenido desde el hub (no enviado)');
  observar_(d, d.borrador || '');
  return { ok: true };
}

function hubAutomejora_(fila, estado, cambios, nota, fecha) {
  const sh = hoja_(CFG.TAB_AUTOMEJORA);
  if (!sh || !fila || fila < 2) return { ok: false, error: 'fila' };
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  const col = k => head.indexOf(k) + 1;
  /* La limpieza borra filas: si el hub trae la fecha de la tarjeta, se ubica la fila por fecha y no solo por número. */
  if (fecha) {
    const t0 = Date.parse(String(fecha).replace(' ', 'T')), msDe = x => x instanceof Date ? x.getTime() : Date.parse(String(x).replace(' ', 'T'));
    if (!isNaN(t0) && sh.getLastRow() >= 2) {
      const fs = sh.getRange(2, col('fecha'), sh.getLastRow() - 1, 1).getValues().map(r => msDe(r[0]));
      if (!(fila - 2 < fs.length && Math.abs(fs[fila - 2] - t0) < 1500)) { const j = fs.findIndex(t => Math.abs(t - t0) < 1500); if (j < 0) return { ok: false, error: 'ya no existe' }; fila = j + 2; }
    }
  }
  if (fila > sh.getLastRow()) return { ok: false, error: 'fila' };
  const v = sh.getRange(fila, 1, 1, sh.getLastColumn()).getValues()[0];
  const clave = String(v[col('clave') - 1] || 'REDACTOR').toUpperCase();
  const lista = Array.isArray(cambios) && cambios.length ? cambios : JSON.parse(v[col('cambios') - 1] || '[]');
  if (estado === 'aceptada' && clave !== 'OBSERVACION') {
    if (clave === 'CONOCIMIENTO') {
      const k = lista[0] || {};
      const r0 = hubSetConocimiento_(null, k.tema, k.contenido || k.despues, k.aplica_a || '*', true, { origen: 'auto', resumen: v[col('resumen') - 1] || k.tema });
      if (!r0.ok) return r0;
    } else {
      const nuevo = aplicarCambiosPrompt_(prompt_(clave), lista);
      const r = hubSetPrompt_(clave, nuevo, 'auto mejora: ' + (v[col('resumen') - 1] || ''), { origen: 'auto', cambios: lista });
      if (!r.ok) return r;
    }
    sh.getRange(fila, col('cambios')).setValue(JSON.stringify(lista));
  }
  sh.getRange(fila, col('estado')).setValue(estado === 'aceptada' ? 'aceptada' : 'rechazada');
  if (nota) sh.getRange(fila, col('nota')).setValue(nota);
  return { ok: true };
}

function hubSetConocimiento_(fila, tema, contenido, aplica, activo, meta) {
  const sh = hoja_(CFG.TAB_CONOCIMIENTO);
  if (!sh) return { ok: false, error: 'sin pestaña' };
  const row = [String(tema || '').trim(), String(contenido || '').trim(), String(aplica || '*').trim() || '*', activo === false || activo === 'NO' ? 'NO' : 'SI', Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm')];
  fila = Number(fila);
  if (fila >= 2 && fila <= sh.getLastRow()) sh.getRange(fila, 1, 1, row.length).setValues([row]);
  else { sh.appendRow(row); fila = sh.getLastRow(); }
  if (meta) regMejora_({ por: meta.por, origen: meta.origen || 'hub', tipo: 'conocimiento', clave: 'CONOCIMIENTO', resumen: meta.resumen || tema, cambios: [{ tipo: 'conocimiento', tema: row[0], despues: row[1], aplica_a: row[2] }], ref: fila });
  return { ok: true, fila: fila };
}

/* Cambia un dato de la ficha de una propiedad (PropiedadesInfo.info_json) por ruta: wifiPass, std.es.parking… */
const CAMPOS_PROPIEDAD_ = ['wifiNet', 'wifiPass', 'wifiNetBk', 'wifiPassBk', 'wifiNetBk2', 'wifiPassBk2', 'floor', 'unit', 'parkNote', 'lock', 'smartBrand',
  'std.es.arrivalIntro', 'std.es.parking', 'std.es.wifiNote', 'std.es.tip', 'std.en.arrivalIntro', 'std.en.parking', 'std.en.wifiNote', 'std.en.tip'];
function hubSetPropiedadDato_(propiedad, campo, valor, meta) {
  if (CAMPOS_PROPIEDAD_.indexOf(campo) === -1) return { ok: false, error: 'campo no permitido: ' + campo };
  const sh = hoja_(CFG.TAB_PROPIEDADES);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  const cN = head.indexOf('property_name') + 1, cJ = head.indexOf('info_json') + 1;
  if (!cN || !cJ) return { ok: false, error: 'columnas' };
  const norm = x => String(x || '').toLowerCase().replace(/[\s\-–_]/g, '');
  const nombres = sh.getRange(2, cN, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
  const i = nombres.findIndex(n => norm(n) === norm(propiedad));
  if (i === -1) return { ok: false, error: 'propiedad no encontrada: ' + propiedad };
  const fila = i + 2;
  let j; try { j = JSON.parse(String(sh.getRange(fila, cJ).getValue() || '{}')); } catch (e) { return { ok: false, error: 'info_json inválido' }; }
  const path = campo.split('.'); let o = j;
  for (let k = 0; k < path.length - 1; k++) { if (typeof o[path[k]] !== 'object' || !o[path[k]]) o[path[k]] = {}; o = o[path[k]]; }
  const antes = o[path[path.length - 1]];
  o[path[path.length - 1]] = String(valor == null ? '' : valor).trim();
  sh.getRange(fila, cJ).setValue(JSON.stringify(j));
  if (meta) regMejora_({ por: meta.por, origen: meta.origen || 'hub', tipo: 'dato', clave: 'DATO', resumen: meta.resumen || (nombres[i] + ' · ' + campo), cambios: [{ tipo: 'dato', campo: campo, antes: antes == null ? '' : String(antes), despues: String(valor == null ? '' : valor).trim() }], ref: nombres[i] });
  log_({ codigo: '', propiedad: nombres[i], nivel: 'DATO', razon: campo, texto: 'antes: ' + (antes == null ? '' : antes), modo: 'HUB' }, String(valor), 'DATO actualizado desde el hub');
  return { ok: true, antes: antes == null ? '' : antes, propiedad: nombres[i] };
}

/* Responder desde el hub: redacta (vacío) o pule (con texto) usando el mismo contexto que ALMA. */
function hubRedactar_(resId, texto, hiloCliente) {
  USO_REF_ = s_(resId);
  const borrador = String(texto || '').trim();
  const cli = Array.isArray(hiloCliente) ? hiloCliente.filter(m => m && m.texto) : [];
  /* Mejorar nunca depende de Hospitable: sin hilo (404/429) o sin reserva, ALMA trabaja con lo que el hub ve y con el texto del equipo. */
  let hilo = [], ctx = null;
  if (resId) {
    try { const hc = hiloConv_(resId, cli); if (hc.code === 200) hilo = hc.hilo || []; } catch (e) { console.error('hubRedactar_ hilo: ' + e); }
    try { ctx = contexto_(resId, hilo, 'HUB'); } catch (e) { console.error('hubRedactar_ ctx: ' + e); }
  }
  if (!ctx) return mejoraSinContexto_(borrador, hilo.length ? hilo : cli);
  ctx.nivel = 'VERDE'; ctx.razon = 'redacción desde el hub';
  const out = redactar_(ctx, borrador
    ? prompt_('MEJORAR') + '\n\nTEXTO BASE DEL EQUIPO:\n' + borrador
    : 'Redacta la respuesta al turno actual del huésped. Puedes responder con naturalidad aunque el nivel sea AMARILLO o ROJO: quien envía es una persona del equipo que puede confirmar.');
  let fin = out;
  if (!textoEnviable_(fin)) fin = redactar_(ctx, 'Debes escribir un mensaje real para el huésped, listo para enviar. Está prohibido responder SIN_RESPUESTA o cualquier marcador interno.' + (borrador ? '\n\nTEXTO BASE DEL EQUIPO:\n' + borrador : ''));
  if (!textoEnviable_(fin) && borrador) return mejoraSinContexto_(borrador, hilo.length ? hilo : cli);
  return textoEnviable_(fin) ? { ok: true, texto: fin, nivel: ctx.nivel } : { ok: false, error: 'ALMA no pudo redactar. Escribe una base y toca Mejorar.' };
}
/* Mejora sin reserva ni hilo de Hospitable: pule el texto del equipo con la voz de Spacio AM y lo que se ve en el hub. */
function mejoraSinContexto_(borrador, hilo) {
  if (!borrador) return { ok: false, error: 'No pude leer la conversación en Hospitable. Escribe una base y toca Mejorar: ALMA la pule igual.' };
  const lineas = (hilo || []).slice(-12).map(m => '[' + (m.tipo === 'guest' ? 'HUÉSPED' : 'SPACIO AM') + '] ' + String(m.texto || '').slice(0, 800)).join('\n');
  const txt = claude_(CFG.MODELO_REDACTOR, 600, prompt_('MEJORAR') + estilo_() + '\n\nNo inventes datos (precios, códigos, horarios, números) que no estén en el texto base o en la conversación. Devuelve SOLO el mensaje final para el huésped, sin comillas ni notas.',
    'CONVERSACIÓN (lo que se ve en el hub):\n' + (lineas || '(no disponible)') + '\n\nTEXTO BASE DEL EQUIPO:\n' + borrador, 0.4);
  const t = formatearMensaje_(limpiarSalida_(String(txt || '')).texto);
  return textoEnviable_(t) ? { ok: true, texto: t, nivel: 'VERDE', sinHilo: true } : { ok: false, error: 'ALMA no respondió. Intenta de nuevo en unos segundos.' };
}

/* Envía el mensaje del equipo a Hospitable, cierra lo que ALMA tuviera pendiente y deja el caso para aprender. */
/* Marca manual de conversación resuelta / reabierta (la más reciente por res_key gana; un mensaje nuevo la reabre). */
/* ts_ms = la marca del hub (epoch ms). Se guarda como número para que ninguna lectura la reinterprete como fecha local. */
/* Última marca «resuelta» vigente (sin reapertura posterior) de esta conversación, en ms. */
function hitoResuelta_(resId) {
  const id = String(resId || ''); if (!id) return 0;
  let filas = []; try { filas = resueltasVivo_(); } catch (e) { return 0; }
  const mias = filas.filter(r => r.res_key === id || r.res_key === 'inq:' + id || r.res_key.replace(/^inq:/, '') === id).sort((a, b) => a.ts_ms - b.ts_ms);
  const u = mias[mias.length - 1];
  return u && u.estado === 'resuelta' ? u.ts_ms : 0;
}
/* Reserva sin confirmar: solo zona, edificio y piso. Nada de apartamento, códigos ni WiFi. */
function aplicarSinConfirmar_(ctx) {
  const partes = String(ctx.propiedad || '').split(/\s+[-–·|]\s+/).map(x => x.trim()).filter(Boolean);
  const zona = partes[0] || '', edif = partes[1] || '', unidad = partes.slice(2).join(' ');
  const info = String(ctx.propiedadInfo || ''), piso = ((info.match(/^Piso: (.+)$/m) || [])[1] || '').trim();
  const uFicha = ((info.match(/^Apartamento \/ unidad: (.+)$/m) || [])[1] || '').trim();
  const wifi = (info.match(/clave "([^"]+)"/) || [])[1] || '';
  ctx.sinConfirmar = true;
  ctx.tokensPrivados = [unidad, uFicha, wifi, ctx.apartamento].concat(unidad.split(/\s+/)).map(x => String(x || '').trim()).filter(x => x && x.length >= 2 && /\d/.test(x) && x !== piso).filter((v, i, a) => a.indexOf(v) === i);
  ctx.propiedadPublica = [zona, edif].filter(Boolean).join(' · ') || 'Spacio AM';
  ctx.apartamento = '';
  const parq = (info.match(/^Parqueo: (.+)$/m) || [])[1] || '';
  ctx.propiedadInfo = 'RESERVA SIN CONFIRMAR · datos que SÍ puedes compartir:\nZona: ' + (zona || '—') + '\nEdificio: ' + (edif || '—') + (piso ? '\nPiso: ' + piso : '') +
    (parq && !/\d{3,}/.test(parq) ? '\nParqueo: ' + parq : '') + '\nNo compartas número de apartamento, códigos (edificio, portería, puerta), WiFi ni pasos de acceso hasta que la reserva esté confirmada.';
}
/* ¿Están libres las fechas que pide una consulta? Calendario de Hospitable; si no, alternativas del mismo edificio o zona (cache 30 min). */
function dispSolicitud_(propId, nombre, ci, co, clave) {
  if (!propId || !/^\d{4}-\d{2}-\d{2}$/.test(ci || '') || !/^\d{4}-\d{2}-\d{2}$/.test(co || '') || co <= ci) return '';
  const cache = CacheService.getScriptCache(), ck = 'disp_' + String(clave || propId + ci + co).slice(-80), c0 = cache.get(ck); if (c0 != null) return c0;
  const libre = id => {
    const fin = new Date(co + 'T12:00:00'); fin.setDate(fin.getDate() - 1);
    const r = hosp_('get', '/properties/' + id + '/calendar?start_date=' + ci + '&end_date=' + Utilities.formatDate(fin, CFG.TZ, 'yyyy-MM-dd'));
    if (r.code !== 200) return null;
    const d = (r.json && r.json.data) || {}, dias = d.days || (Array.isArray(d) ? d : []);
    if (!dias.length) return null;
    return dias.every(x => { const st = x.status || {}; return st.available !== false && x.available !== false && !/book|reserv|block|unavail|occupied/i.test(String(st.reason || x.reason || '')); });
  };
  const yo = libre(propId); let txt = '';
  if (yo === true) txt = 'Del ' + ci + ' al ' + co + ': disponibles en esta propiedad al momento de responder.';
  else if (yo === false) {
    const partes = String(nombre || '').split(/\s+[-–·|]\s+/), zona = (partes[0] || '').toLowerCase(), edif = (partes[1] || '').toLowerCase();
    const todas = nombresPropiedades_(), ids = Object.keys(todas).filter(k => k.indexOf('lst:') !== 0 && k !== propId);
    const cand = ids.filter(k => edif && todas[k].toLowerCase().indexOf(edif) !== -1).concat(ids.filter(k => zona && todas[k].toLowerCase().indexOf(zona) === 0)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
    const alt = [];
    cand.forEach(k => { if (alt.length >= 3) return; if (libre(k) !== true) return;
      let url = ''; try { const p = hosp_('get', '/properties/' + k + '?include=listings'), ls = (p.json && p.json.data && p.json.data.listings) || []; const ab = ls.find(l => /airbnb/i.test(String(l.platform || ''))); if (ab && ab.platform_id) url = 'https://www.airbnb.com/rooms/' + ab.platform_id; } catch (e) {}
      const pp = todas[k].split(/\s+[-–·|]\s+/); alt.push('· ' + [pp[0], pp[1]].filter(Boolean).join(' · ') + (url ? ' → ' + url : '')); });
    txt = 'Del ' + ci + ' al ' + co + ': YA NO ESTÁN DISPONIBLES en esta propiedad (alguien más reservó esas fechas). Avísale con calidez, sin culpas, y ofrece ' +
      (alt.length ? 'estas opciones libres en esas mismas fechas (comparte solo zona y edificio, y el enlace si lo hay):\n' + alt.join('\n') : 'revisar fechas cercanas: pregúntale si tiene flexibilidad y que el equipo le confirma opciones por aquí.') + '\nNunca dejes el mensaje sin respuesta.';
  }
  try { cache.put(ck, txt, 1800); } catch (e) {}
  return txt;
}
function hubResolver_(key, estado, quien, tsCli) {
  if (!key) return { ok: false, error: 'falta key' };
  const sh = hojaCrear_('ALMA_RESUELTAS', ['res_key', 'estado', 'ts', 'por', 'ts_ms']);
  if (sh.getLastColumn() < 5) sh.getRange(1, 5).setValue('ts_ms');
  const ms = Math.max(Date.now(), Number(tsCli) || 0);
  sh.appendRow([String(key), estado === 'abierta' ? 'abierta' : 'resuelta', new Date().toISOString(), String(quien || '').slice(0, 80), ms]);
  if (estado !== 'abierta') { try { promesasCumplir_(key, quien, 'resuelta'); } catch (e) {} }   // resolverla cierra lo que ALMA prometió
  return { ok: true, ts: ms };
}
function resueltasVivo_() {
  const sh = ssAlma_().getSheetByName('ALMA_RESUELTAS'); if (!sh || sh.getLastRow() < 2) return [];
  const n = sh.getLastRow(), desde = Math.max(2, n - 799), w = Math.max(4, Math.min(5, sh.getLastColumn()));
  return sh.getRange(desde, 1, n - desde + 1, w).getValues().map(v => {
    const t = Number(v[4]) || (v[2] instanceof Date ? v[2].getTime() : Date.parse(v[2])) || 0;
    return { res_key: String(v[0]), estado: String(v[1]), ts_ms: t, por: String(v[3] || '') };
  }).filter(r => r.res_key && r.ts_ms);
}
/* Mensajes programados de Hospitable pendientes para la reserva. */
/* API oficial: DELETE /scheduled-messages/{id} cancela; PATCH actualiza body/hora. Respaldo: la ruta antigua /cancel. */
function cancelarHosp_(id) {
  const c = hosp_('delete', '/scheduled-messages/' + id);
  return c.code < 300 ? c : hosp_('post', '/scheduled-messages/' + id + '/cancel');
}
/* ── INQUIRIES: Hospitable programa su mensaje automático a los 5 min. Si el huésped hizo una pregunta y la ficha /
   base tienen la respuesta, ALMA reescribe ESE mensaje (PATCH) con la respuesta al inicio. Si no, se deja tal cual. ── */
function inquiryInfo_(convInq) {
  const uuid = String(convInq).replace(/^inq:/, '');
  const r = hosp_('get', '/inquiries/' + uuid + '?include=properties,listings,guest');
  const d = (r.json && r.json.data) || {};
  const prop = (d.properties && d.properties[0]) || d.property || (d.listings && d.listings[0]) || d.listing || {};
  const gu = d.guest || {};
  return { uuid: uuid, propiedad: nombrePropInq_(d) || s_(prop.title), huesped: s_(gu.first_name ? gu.first_name + ' ' + (gu.last_name || '') : gu.name).trim(),
    idioma: s_(gu.language || d.language), checkin: s_(d.arrival_date || d.check_in), checkout: s_(d.departure_date || d.check_out) };
}
function inquiryProgramado_(uuid) {
  const ids = ['/reservations/' + uuid + '/scheduled-messages', '/inquiries/' + uuid + '/scheduled-messages'];
  for (let k = 0; k < ids.length; k++) {
    const r = hosp_('get', ids[k]);
    if (r.code !== 200) continue;
    const pend = ((r.json && r.json.data) || []).filter(m => !m.sent_at && !m.cancelled_at)
      .map(m => ({ id: m.id, texto: s_(m.body || m.content || m.message), envio: s_(m.send_at || m.scheduled_at || m.scheduled_for) }))
      .filter(m => m.texto).sort((a, b) => new Date(a.envio) - new Date(b.envio));
    if (pend.length) return pend[0];
  }
  return null;
}
/* Procedimiento: 1) llega la consulta · 2) se entiende la duda · 3) se lee el automático "Inquiry" que Hospitable
   programa (es el que PRE-APRUEBA) · 4) la respuesta se integra dentro de ese texto y se envía ESE mensaje.
   Nunca se cancela ni se reemplaza por uno nuevo. Si el automático no aparece en INQUIRY_ESPERA_MIN, último recurso:
   respuesta normal y la consulta queda para que el equipo la pre-apruebe a mano. */
function inquiryResponder_(convInq, pregunta, huesped, ctrl, desdeMs) {
  const inf = inquiryInfo_(convInq);
  const base = { huesped: inf.huesped || huesped, propiedad: inf.propiedad };
  const esperaMs = Math.max(0, Number(cfg_('INQUIRY_ESPERA_MIN')) || 12) * 60000;
  const prog = inquiryProgramado_(inf.uuid);
  if (!prog && desdeMs && Date.now() - desdeMs < esperaMs && !inqPrevio_('inq:' + inf.uuid)) return Object.assign(base, { esperar: true, nota: 'inquiry: esperando el automático de Hospitable' });
  const ficha = infoPropiedad_(inf.propiedad, inf.idioma) || '', kb = (conocimiento_(inf.propiedad) || '') + distanciaBloque_(inf.propiedad, pregunta);
  const evalTxt = claude_(CFG.MODELO_CLASIFICADOR || CFG.MODELO_REDACTOR, 500, prompt_('INQUIRY_EVALUAR'),
    'PROPIEDAD: ' + (inf.propiedad || 'sin dato') + '\nFECHAS: ' + inf.checkin + ' → ' + inf.checkout +
    '\n\nFICHA:\n' + ficha + '\n\nBASE DE CONOCIMIENTO:\n' + kb + '\n\nMENSAJE DEL HUÉSPED:\n' + pregunta, 0);
  let ev = null; try { ev = JSON.parse(String(evalTxt).match(/\{[\s\S]*\}/)[0]); } catch (e) { }
  const previo = !prog && inqPrevio_('inq:' + inf.uuid);
  const preaprobar = previo ? '' : ' · PRE-APROBAR a mano: el automático "Inquiry" no apareció en ' + Math.round(esperaMs / 60000) + ' min';
  if ((!ev || !ev.hay_pregunta) && previo) return Object.assign(base, { estado: 'omitido', nota: 'inquiry: seguimiento sin pregunta', nivel: 'VERDE', razon: 'Solo confirmó o agradeció · el automático ya se había enviado', accion: 'sin cambios' });
  if (!ev || !ev.hay_pregunta) return Object.assign(base, prog
    ? { estado: 'omitido', nota: 'inquiry sin pregunta: sigue el automático', nivel: 'INQUIRY', razon: 'Consulta sin pregunta concreta: sigue el mensaje automático de Hospitable', accion: 'sin cambios' }
    : { estado: 'omitido', nota: 'inquiry sin automático', nivel: 'AMARILLO', razon: 'Consulta sin pregunta concreta' + preaprobar, accion: 'revisar manualmente · pre-aprobar' });
  if (!ev.puede_responder || !s_(ev.respuesta).trim()) return Object.assign(base, { estado: 'omitido', nota: 'inquiry sin respuesta en la ficha', nivel: 'AMARILLO', razon: 'Pregunta sin respuesta en la ficha o la base: ' + s_(ev.pregunta).slice(0, 160) + (prog ? ' · el automático sale tal cual' : preaprobar), accion: 'revisar manualmente' });
  const idioma = s_(ev.idioma) || inf.idioma || 'es';
  if (prog) {
    const nuevo = String(claude_(CFG.MODELO_REDACTOR, 1400, prompt_('INQUIRY_FUSIONAR'),
      'IDIOMA: ' + idioma + '\nPREGUNTA DEL HUÉSPED:\n' + pregunta + '\n\nRESPUESTA (de la ficha):\n' + ev.respuesta + '\n\nMENSAJE AUTOMÁTICO ORIGINAL:\n' + prog.texto, 0.3) || '').trim();
    if (!nuevo || nuevo.length < prog.texto.length * 0.6 || /SIN_RESPUESTA/.test(nuevo)) return Object.assign(base, { estado: 'omitido', nota: 'fusión inválida', nivel: 'AMARILLO', razon: 'No se pudo integrar la respuesta en el automático · sale tal cual; responde "' + s_(ev.pregunta).slice(0, 100) + '" a mano', accion: 'revisar manualmente' });
    if (ctrl.modo === 'SOMBRA') return Object.assign(base, { estado: 'sombra', nota: 'inquiry: propuesta sin aplicar', nivel: 'VERDE', razon: 'SOMBRA · adaptaría el automático con: ' + s_(ev.pregunta), texto: nuevo, accion: 'SOMBRA · no aplicado' });
    let p = hosp_('patch', '/scheduled-messages/' + prog.id, { body: nuevo, send_now: true });
    if (p.code < 300) { try { registrarEnvioInq_('inq:' + inf.uuid, nuevo); } catch (e) {} }
    if (p.code < 300) return Object.assign(base, { estado: 'respondido', nota: 'automático adaptado y enviado', nivel: 'VERDE', razon: 'Inquiry: respondió "' + s_(ev.pregunta).slice(0, 120) + '" dentro del automático de pre-aprobación', texto: nuevo, accion: 'ENVIADO · automático Inquiry adaptado por ALMA' });
    p = hosp_('patch', '/scheduled-messages/' + prog.id, { body: nuevo });
    if (p.code < 300) return Object.assign(base, { estado: 'respondido', nota: 'automático adaptado · sale a su hora', nivel: 'VERDE', razon: 'Inquiry: respuesta integrada en el automático; sale a la hora programada', texto: nuevo, accion: 'ENVIADO · automático Inquiry adaptado (sale ' + s_(prog.envio) + ')' });
  }
  /* Último recurso: respuesta normal + el equipo pre-aprueba. */
  if (ctrl.modo === 'SOMBRA') return Object.assign(base, { estado: 'sombra', nota: 'inquiry sombra', nivel: 'AMARILLO', razon: 'SOMBRA · respondería normal: ' + s_(ev.pregunta) + preaprobar, texto: s_(ev.respuesta), accion: 'SOMBRA · no aplicado' });
  const env = hosp_('post', '/inquiries/' + inf.uuid + '/messages', { body: s_(ev.respuesta).trim() });
  const motivo = prog ? ' · PRE-APROBAR a mano: Hospitable no dejó editar el automático' : preaprobar;
  return Object.assign(base, env.code < 300
    ? { estado: 'respondido', nota: 'respuesta directa · falta pre-aprobar', nivel: 'AMARILLO', razon: 'Inquiry: se respondió la pregunta con un mensaje normal' + motivo, texto: s_(ev.respuesta), accion: 'ENVIADO · respuesta a la consulta · falta pre-aprobar' }
    : { estado: 'error', nota: 'Hospitable ' + env.code, nivel: 'AMARILLO', razon: 'No se pudo enviar la respuesta a la consulta' + motivo, accion: 'revisar manualmente' });
}
function hubProgramados_(resId) {
  if (!resId) return { ok: false, error: 'falta resId' };
  const r = hosp_('get', '/reservations/' + resId + '/scheduled-messages');
  if (r.code !== 200) return { ok: false, error: 'Hospitable ' + r.code };
  const lista = ((r.json && r.json.data) || []).filter(m => !m.sent_at && !m.cancelled_at).map(m => ({
    id: m.id, titulo: m.title || (m.rule && m.rule.name) || 'Mensaje programado',
    envio: m.send_at || m.scheduled_at || m.scheduled_for || '', texto: m.body || m.content || m.message || ''
  }));
  return { ok: true, lista: lista.concat(propiosDe_(resId)) };
}
/* ── Programados propios (ALMA_PROGRAMADOS): Hospitable no deja editar un programado, así que "editar" cancela el
   original y ALMA lo envía a la misma hora con el texto nuevo (procesarCola → enviarPropios_ cada minuto). ── */
const PROG_CAB_ = ['creado', 'reservation_id', 'envio', 'texto', 'estado', 'por', 'origen', 'nota'];
function hojaProg_() { return hojaCrear_('ALMA_PROGRAMADOS', PROG_CAB_); }
function propiosDe_(resId) {
  const sh = ssAlma_().getSheetByName('ALMA_PROGRAMADOS'); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, PROG_CAB_.length).getValues().map((v, i) => ({ v: v, fila: i + 2 }))
    .filter(x => String(x.v[1]) === String(resId) && x.v[4] === 'pendiente')
    .map(x => ({ id: 'alma:' + x.fila, titulo: x.v[6] === 'equipo' ? 'Programado por ' + (x.v[5] || 'el equipo') : (x.v[6] || 'Mensaje programado') + ' · editado', envio: x.v[2] instanceof Date ? x.v[2].toISOString() : String(x.v[2]), texto: String(x.v[3] || ''), propio: true }));
}
function filaProp_(id) { const n = Number(String(id).replace('alma:', '')); return n >= 2 ? n : 0; }
function enviarPropios_() {
  const sh = ssAlma_().getSheetByName('ALMA_PROGRAMADOS'); if (!sh || sh.getLastRow() < 2) return;
  const ahora = Date.now();
  sh.getRange(2, 1, sh.getLastRow() - 1, PROG_CAB_.length).getValues().forEach((v, i) => {
    if (v[4] !== 'pendiente') return;
    const t = new Date(v[2]).getTime(); if (!t || t > ahora) return;
    if (v[6] === 'equipo') {   // escrito por una persona y programado desde el hub: sale por el canal del huésped (WhatsApp o plataforma)
      sh.getRange(i + 2, 5, 1, 1).setValue('enviando');
      let r; try { r = hubResponder_(String(v[1]), String(v[3]), String(v[5] || 'Equipo') + ' · programado'); } catch (e) { r = { ok: false, error: String(e) }; }
      sh.getRange(i + 2, 5, 1, 1).setValue(r.ok ? 'enviado' : 'error');
      sh.getRange(i + 2, 8, 1, 1).setValue(r.ok ? 'enviado ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM HH:mm') : String(r.error || 'error').slice(0, 200));
      return;
    }
    const env = hosp_('post', '/reservations/' + v[1] + '/messages', { body: String(v[3]) });
    sh.getRange(i + 2, 5, 1, 1).setValue(env.code < 300 ? 'enviado' : 'error');
    sh.getRange(i + 2, 8, 1, 1).setValue(env.code < 300 ? 'enviado ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd MMM HH:mm') : 'Hospitable ' + env.code);
  });
}
/* Hub: una persona escribe el mensaje y elige la hora (Guatemala). procesarCola lo envía cada minuto. */
function hubProgramar_(resId, texto, envio, quien) {
  texto = String(texto || '').trim();
  const t = new Date(envio);
  if (!resId || !texto) return { ok: false, error: 'faltan datos' };
  if (isNaN(t.getTime())) return { ok: false, error: 'hora inválida' };
  if (t.getTime() < Date.now() - 60000) return { ok: false, error: 'La hora ya pasó' };
  if (t.getTime() > Date.now() + 14 * 86400000) return { ok: false, error: 'Máximo 14 días adelante' };
  const sh = hojaProg_();
  sh.appendRow([new Date().toISOString(), String(resId), t.toISOString(), texto.slice(0, 4000), 'pendiente', String(quien || 'Equipo').slice(0, 80), 'equipo', 'programado desde el hub']);
  return { ok: true, id: 'alma:' + sh.getLastRow(), envio: t.toISOString() };
}
function textoListo_(t) {
  if (!t) return 'Este programado no trae texto. Ábrelo en editar y escríbelo.';
  if (/\{\{|\}\}|%[a-z_]+%/i.test(t)) return 'El texto aún tiene variables sin llenar';
  return '';
}
/* Enviar ahora: manda el texto (el editado, si viene) y cancela el programado. */
function hubAdelantar_(resId, id, texto) {
  if (String(id).indexOf('alma:') === 0) {
    const sh = hojaProg_(), f = filaProp_(id); if (!f) return { ok: false, error: 'id inválido' };
    const v = sh.getRange(f, 1, 1, PROG_CAB_.length).getValues()[0];
    if (v[4] !== 'pendiente') return { ok: false, error: 'Ya no está pendiente' };
    const t = String(texto || v[3] || '').trim(), e = textoListo_(t); if (e) return { ok: false, error: e };
    const env = hosp_('post', '/reservations/' + resId + '/messages', { body: t });
    if (env.code >= 300) return { ok: false, error: 'Hospitable ' + env.code };
    sh.getRange(f, 4, 1, 2).setValues([[t, 'enviado']]);
    return { ok: true };
  }
  const r = hubProgramados_(resId); if (!r.ok) return r;
  const m = r.lista.filter(x => String(x.id) === String(id))[0];
  if (!m) return { ok: false, error: 'Ya no está pendiente' };
  const t = String(texto || m.texto || '').trim(), e = textoListo_(t); if (e) return { ok: false, error: e };
  const env = hosp_('post', '/reservations/' + resId + '/messages', { body: t });
  if (env.code >= 300) return { ok: false, error: 'Hospitable ' + env.code };
  const c = cancelarHosp_(id);
  return { ok: true, cancelado: c.code < 300 };
}
function hubCancelarProg_(resId, id) {
  if (String(id).indexOf('alma:') === 0) {
    const f = filaProp_(id); if (!f) return { ok: false, error: 'id inválido' };
    hojaProg_().getRange(f, 5, 1, 1).setValue('cancelado'); return { ok: true };
  }
  const c = cancelarHosp_(id);
  return c.code < 300 ? { ok: true } : { ok: false, error: 'Hospitable ' + c.code };
}
function hubEditarProg_(resId, id, texto, quien) {
  texto = String(texto || '').trim(); if (!texto) return { ok: false, error: 'El mensaje está vacío' };
  if (String(id).indexOf('alma:') === 0) {
    const f = filaProp_(id); if (!f) return { ok: false, error: 'id inválido' };
    hojaProg_().getRange(f, 4, 1, 1).setValue(texto); return { ok: true, id: id };
  }
  const r = hubProgramados_(resId); if (!r.ok) return r;
  const m = r.lista.filter(x => String(x.id) === String(id))[0];
  if (!m) return { ok: false, error: 'Ya no está pendiente' };
  if (!m.envio) return { ok: false, error: 'Hospitable no indica la hora de envío' };
  const c = cancelarHosp_(id);
  if (c.code >= 300) return { ok: false, error: 'No pude cancelar el original (Hospitable ' + c.code + ')' };
  const sh = hojaProg_();
  sh.appendRow([new Date().toISOString(), resId, m.envio, texto, 'pendiente', String(quien || '').slice(0, 80), m.titulo, 'editado desde el hub']);
  return { ok: true, id: 'alma:' + sh.getLastRow() };
}
/* Cola en vivo (sin la caché de gviz): últimas 300 filas con los mismos nombres de columna. */
/* Latido: cada lectura en vivo del hub procesa la cola si hay algo vencido, sin esperar al disparador
   de cada minuto (que en Apps Script puede atrasarse varios minutos). Máximo una pasada cada 10 s. */
function latido_() {
  try {
    const cache = CacheService.getScriptCache(); if (cache.get('latido')) return; cache.put('latido', '1', 10);
    const sh = hoja_(CFG.TAB_COLA), n = sh.getLastRow(); if (n < 2) return;
    const desde = Math.max(2, n - 199), ahora = Date.now(), agr = cfg_('AGRUPAR_SEG') * 1000;
    const vals = sh.getRange(desde, 1, n - desde + 1, COLA_HEADERS.length).getValues();
    const hay = vals.some(v => {
      const e = v[C.estado], prox = v[C.proximo] ? new Date(v[C.proximo]).getTime() : 0;
      if (e === 'pendiente') return ahora - new Date(v[C.recibido]).getTime() >= agr && (!prox || prox <= ahora);
      return (e === 'esperando_envio' || e === 'esperando_rojo' || e === 'esperando_codigo') && prox && prox <= ahora;
    });
    if (hay) { PropertiesService.getScriptProperties().setProperty('ALMA_ACTIVO', '1'); procesarCola(); }
  } catch (e) { console.error('latido_: ' + e); }
}
function hubCola_(horas, hashPrev) {
  latido_();
  /* Solo lo reciente (por defecto 48 h, o los días que el Hub esté mostrando) + lo que siga vivo en la cola.
     Antes eran siempre 300 + 400 filas completas (~1 MB cada 5-10 s); lo anterior ya lo tiene el Hub de la lectura completa. */
  const lim = Date.now() - Math.max(24, Math.min(24 * 15, Number(horas) || 48)) * 3600000;
  const tail = (tab, max) => {
    const sh = hoja_(tab), n = sh.getLastRow(); if (n < 2) return [];
    const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim());
    let desde = Math.max(2, n - max + 1);
    const cF = Math.max(0, cab.findIndex(c => /^(recibido|fecha)$/i.test(c))), cE = cab.findIndex(c => /^estado$/i.test(c));
    const fechas = sh.getRange(desde, cF + 1, n - desde + 1, 1).getValues(), est = cE >= 0 ? sh.getRange(desde, cE + 1, n - desde + 1, 1).getValues() : null;
    let k0 = fechas.findIndex((f, i) => archivoFecha_(f[0]) >= lim || (est && FINALES.indexOf(String(est[i][0])) === -1 && String(est[i][0]) !== ''));
    if (k0 < 0) k0 = fechas.length; desde += k0; if (desde > n) return [];
    return sh.getRange(desde, 1, n - desde + 1, cab.length).getDisplayValues().map((v, k) => { const o = {}; cab.forEach((c, q) => { if (c) o[c] = v[q]; }); o._fila = desde + k; return o; });
  };
  let inbox = []; try { inbox = hubInbox_(); } catch (e) { console.error('hubInbox_: ' + e); }
  let auto = {}; try { auto = autoTodos_(); } catch (e) {}
  let resueltas = []; try { resueltas = resueltasVivo_(); } catch (e) { console.error('resueltasVivo_: ' + e); }
  let formsOk = []; try { formsOk = formsOk_(); } catch (e) { console.error('formsOk_: ' + e); }
  const cola = tail(CFG.TAB_COLA, 300);
  /* El texto del huésped ya viaja en la fila: no se repite dentro de datos. */
  cola.forEach(r => { if (r.datos && r.datos.length > 200) { try { const d = JSON.parse(r.datos); delete d.texto; r.datos = JSON.stringify(d); } catch (e) {} } });
  /* Bandeja liviana: solo lo que tuvo movimiento en la ventana (o tiene una promesa abierta), con los textos recortados.
     Lo anterior el Hub ya lo tiene y lo conserva (unirInbox). */
  const corto = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n) + '…' : t; };
  inbox = inbox.filter(o => Math.max(actividadInbox_(o), Date.parse(o.actualizado) || 0, Date.parse(o.revisado_ts) || 0) >= lim || o.promesa_estado === 'abierta' || o.promesa_estado === 'vencida')
    .map(o => { const x = Object.assign({}, o); x.ultimo_texto = corto(o.ultimo_texto, 400); x.ultimo_auto_texto = corto(o.ultimo_auto_texto, 500); x.revision_razon = corto(o.revision_razon, 200); return x; });
  const out = { ok: true, cola: cola, log: tail(CFG.TAB_LOG, 400), inbox: inbox, auto: auto, resueltas: resueltas, formsOk: formsOk };
  /* Huella del contenido: si el Hub ya tiene exactamente esto, se responde «sin cambios» (unos bytes) y no repinta nada. */
  const huella = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(out), Utilities.Charset.UTF_8));
  const pulsoMs = Number(PropertiesService.getScriptProperties().getProperty('PULSO') || 0);
  if (hashPrev && hashPrev === huella) return { ok: true, same: true, hash: huella, ts: new Date().toISOString(), pulso: pulsoMs };
  out.hash = huella; out.ts = new Date().toISOString();
  out.pulso = pulsoMs; return out;
}
/* Códigos con registro de llegada enviado (pestaña Formularios de hola), descontando los que el administrador reinició
   después. Es la fuente real: Reservas.status_form a veces queda desactualizado. Caché 5 min. */
function formsOk_() {
  const c = CacheService.getScriptCache(), c0 = c.get('forms_ok'); if (c0) return JSON.parse(c0);
  const ss = ssWebapp_(), sh = ss.getSheetByName('Formularios'); if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues(), ult = {};   // submitted_at | code
  v.forEach(r => { const k = String(r[1] || '').trim().toUpperCase(); if (!k) return; const t = new Date(r[0]).getTime() || 1; if (!ult[k] || t > ult[k]) ult[k] = t; });
  const re = ss.getSheetByName('Reinicios');
  if (re && re.getLastRow() >= 2) re.getRange(2, 1, re.getLastRow() - 1, 2).getValues().forEach(r => { const k = String(r[1] || '').trim().toUpperCase(), t = new Date(r[0]).getTime() || 0; if (ult[k] && t > ult[k]) delete ult[k]; });
  const out = Object.keys(ult); try { c.put('forms_ok', JSON.stringify(out), 300); } catch (e) {}
  return out;
}
/* Interruptor de respuestas automáticas por conversación (ALMA_AUTO: la fila más reciente gana). */
let AUTO_ = null;
function autoTodos_() {
  if (AUTO_) return AUTO_;
  AUTO_ = {};
  const sh = hojaCrear_('ALMA_AUTO', ['conv_id', 'estado', 'ts', 'por']), n = sh.getLastRow();
  if (n >= 2) sh.getRange(Math.max(2, n - 999), 1, Math.min(n - 1, 1000), 4).getValues().forEach(v => { if (v[0]) AUTO_[String(v[0])] = { estado: String(v[1]), ts: v[2] instanceof Date ? v[2].toISOString() : String(v[2]), por: String(v[3] || '') }; });
  return AUTO_;
}
function autoConv_(id) { return autoTodos_()[String(id || '')] || {}; }
function hubSetAuto_(resId, on, quien) {
  if (!resId) return { ok: false, error: 'falta resId' };
  const ts = new Date().toISOString();
  hojaCrear_('ALMA_AUTO', ['conv_id', 'estado', 'ts', 'por']).appendRow([String(resId), on ? 'on' : 'off', ts, String(quien || '').slice(0, 80)]);
  AUTO_ = null;
  if (on) {   // ALMA relee la conversación, clasifica y envía lo que haga falta
    const wa = String(resId).indexOf('wa:') === 0 ? String(resId).slice(3) : '';
    hoja_(CFG.TAB_COLA).appendRow([ts, 'manual:' + Date.now(), String(resId), '', '', '(reactivación manual desde el hub: revisar si hay algo pendiente)', 'pendiente', 0, '', 'reactivado a mano',
      JSON.stringify(Object.assign({ manual: true }, wa ? { canal: 'whatsapp', wa: wa } : {}))]);
  }
  return { ok: true, estado: on ? 'on' : 'off', ts: ts };
}
function hubResponder_(resId, texto, quien, canal) {
  texto = String(texto || '').trim();
  quien = String(quien || '').trim().slice(0, 80);
  if (!resId || !texto) return { ok: false, error: 'faltan datos' };
  /* Chat operativo: el administrador escribe a ALMA desde la misma interfaz de conversaciones. */
  if (String(resId).indexOf('op:') === 0) { const adm = adminPorEmail_(String(resId).slice(3)); const r = opProcesar_(adm, texto, 'hub', []); return r.ok ? { ok: true, alma: r.alma } : r; }
  /* Se responde por el canal del último mensaje del huésped: WhatsApp o la plataforma de la reserva. */
  /* Conversación de WhatsApp sin reserva (proveedor, técnico, socio…): se le escribe a ese número, aunque todavía no haya
     respondido nunca (antes caía a Hospitable con «wa:…» y fallaba). Fuera de las 24 h sale el aviso de primer contacto. */
  if (String(resId).indexOf('wa:') === 0) {
    const numW = normTel_(String(resId).slice(3)); if (!numW) return { ok: false, error: 'número inválido' };
    let nomW = ''; try { nomW = (waHilo_(resId).filter(m => m.tipo === 'guest' && m.nombre).pop() || {}).nombre || ''; } catch (e) {}
    const rw = waEnviarAlguien_(numW, texto, { nombre: nomW, de: quien || 'Spacio AM' });
    if (!rw.ok) return { ok: false, error: rw.error || 'no salió' };
    try { CacheService.getScriptCache().removeAll(['hf_' + resId]); } catch (e) {}
    return { ok: true, canal: 'whatsapp', plantilla: rw.modo === 'plantilla' };
  }
  /* Desde la plataforma no hace falta leer el hilo antes de enviar (era lo que más tardaba): se lee solo si podría ser WhatsApp. */
  const hc = canal === 'plataforma' ? { code: 0, hilo: [] } : hiloConv_(resId), ug = (hc.hilo || []).filter(m => m.tipo === 'guest').pop() || {};
  let plantilla = false;
  /* Desde la conversación de la reserva se responde por la plataforma; WhatsApp tiene su propio chat (hubResponderWa_). */
  if (canal !== 'plataforma' && ug.canal === 'whatsapp' && ug.wa) {
    const w = waResponder_(ug.wa, texto, resId, quien || 'Equipo', idiomaDe_(ug.texto), ug.nombre);
    if (!w.ok) return { ok: false, error: 'WhatsApp: ' + w.error };
    plantilla = !!w.plantilla;
  } else {
    const env = hosp_('post', '/reservations/' + resId + '/messages', { body: texto });
    if (env.code < 200 || env.code >= 300) return { ok: false, error: 'Hospitable HTTP ' + env.code };
  }
  const sh = hoja_(CFG.TAB_COLA);
  let d = null;
  if (sh.getLastRow() >= 2) {
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, COLA_HEADERS.length).getValues();
    vals.forEach((v, i) => {
      if (v[C.reservation_id] !== resId || FINALES.indexOf(v[C.estado]) !== -1) return;
      try { d = d || (v[C.datos] ? JSON.parse(v[C.datos]) : null); } catch (e) {}
      set_(sh, { fila: i + 2, v: v }, { estado: 'respondido', nota: 'respondido por el equipo desde el hub' });
    });
  }
  if (d) {
    d.modo = 'HUB'; d.respondidoPor = quien || 'Equipo';
    log_(d, texto, 'ENVIADO por el equipo desde el hub' + (quien ? ' · ' + quien : ''));
    observar_(d, d.borrador || '');
  } else hubDespuesEncolar_(resId, texto, quien);   // armar el contexto es lento: se registra en la siguiente pasada (envio.js)
  try { promesasCumplir_(resId, quien || 'Equipo'); } catch (e) { console.error('promesasCumplir_: ' + e); }
  return { ok: true, plantilla: plantilla, canal: ug.canal === 'whatsapp' ? 'whatsapp' : 'hospitable' };
}

/* Pulgar arriba/abajo sobre una fila del log. Los "down" alimentan la auto mejora. */
function hubVotar_(fila, voto) {
  const sh = hoja_(CFG.TAB_LOG);
  if (!sh || !fila || fila < 2 || fila > sh.getLastRow()) return { ok: false, error: 'fila' };
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase());
  let c = head.indexOf('voto') + 1;
  if (!c) { c = sh.getLastColumn() + 1; sh.getRange(1, c).setValue('voto'); }
  const v = ['up', 'down'].indexOf(String(voto || '').toLowerCase()) !== -1 ? String(voto).toLowerCase() : '';
  sh.getRange(fila, c).setValue(v);
  if (v !== 'down') { const cc = head.indexOf('corregida') + 1; if (cc) sh.getRange(fila, cc).setValue(''); }
  return { ok: true };
}

/* Calendario de la propiedad (2 meses desde la llegada) e ingreso de la reserva. En consultas no hay desglose:
   se estima con la tarifa por noche del calendario. */
function hubReservaInfo_(resId) {
  const id = String(resId || ''); if (!id || id.indexOf('wa:') === 0) return { ok: false, error: 'Esta conversación no tiene reserva' };
  const inq = id.indexOf('inq:') === 0, uid = id.replace(/^inq:/, '');
  let r = hosp_('get', (inq ? '/inquiries/' : '/reservations/') + uid + (inq ? '?include=property,properties,guest' : '?include=properties,financials,guest'));
  if (r.code !== 200 && inq) { r = hosp_('get', '/reservations/' + uid + '?include=properties,financials,guest'); }
  if (r.code !== 200) return { ok: false, error: 'Hospitable respondió ' + r.code };
  const d = (r.json && r.json.data) || {}, prop = (d.properties && d.properties[0]) || d.property || {};
  const pid = s_(prop.id || d.property_id), ci = s_(d.arrival_date || d.check_in).slice(0, 10), co = s_(d.departure_date || d.check_out).slice(0, 10);
  const base = ci || Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  const ini = base.slice(0, 8) + '01', finD = new Date(ini + 'T12:00:00'); finD.setMonth(finD.getMonth() + 2); finD.setDate(0);
  const fin = Utilities.formatDate(finD, CFG.TZ, 'yyyy-MM-dd');
  let dias = [];
  if (pid) {
    const c = hosp_('get', '/properties/' + pid + '/calendar?start_date=' + ini + '&end_date=' + fin);
    const cd = (c.json && c.json.data) || {}, lista = Array.isArray(cd) ? cd : (cd.days || []);
    dias = lista.map(x => {
      const st = x.status, disp = st && typeof st === 'object' ? st.available !== false : /avail/i.test(String(st || x.available));
      const razon = String((st && st.reason) || st || '').toUpperCase();
      const pr = x.price && typeof x.price === 'object' ? Number(x.price.amount) : Number(x.price);
      return { fecha: s_(x.date).slice(0, 10), libre: !!disp, razon: disp ? 'LIBRE' : /RESERV|BOOK/.test(razon) ? 'RESERVADO' : 'BLOQUEADO', precio: isNaN(pr) ? null : pr / 100 };
    }).filter(x => x.fecha);
  }
  const cur = s_((d.financials && d.financials.currency) || d.currency || 'USD');
  const linea = (k, o) => { if (!o || typeof o !== 'object') return null; const a = Number(o.amount); if (isNaN(a) && !o.formatted) return null; return { label: s_(o.label || o.name) || k, monto: isNaN(a) ? null : a / 100, txt: s_(o.formatted) }; };
  const lado = obj => {
    const out = { lineas: [], total: null };
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (/breakdown/i.test(k)) return;
      if (/^(revenue|total|total_price|payout)$/i.test(k)) { out.total = linea('Total', v); return; }
      if (Array.isArray(v)) v.forEach(it => { const l = linea(k, it); if (l) out.lineas.push(l); });
      else { const l = linea(k, v); if (l) out.lineas.push(l); }
    });
    return out;
  };
  const f = d.financials || {};
  let ingreso = null;
  if (f.host || f.guest) ingreso = { estimado: false, moneda: cur, host: lado(f.host), guest: lado(f.guest) };
  else if (ci && co && dias.length) {
    const noches = dias.filter(x => x.fecha >= ci && x.fecha < co && x.precio != null);
    if (noches.length) { const t = noches.reduce((a, x) => a + x.precio, 0); ingreso = { estimado: true, moneda: cur, noches: noches.length, host: { lineas: [{ label: noches.length + (noches.length === 1 ? ' noche' : ' noches'), monto: t }], total: { label: 'Total', monto: t } }, guest: null }; }
  }
  return { ok: true, tipo: inq ? 'consulta' : 'reserva', codigo: s_(d.code || d.reservation_code || d.confirmation_code || ''), propiedad: s_(prop.name || prop.public_name), checkin: ci, checkout: co, inicio: ini, fin: fin, dias: dias, ingreso: ingreso, plataforma: s_(d.platform) };
}
function hubHilo_(resId) {
  if (!resId) return { ok: false, error: 'resId' };
  if (String(resId).indexOf('op:') === 0) return { ok: true, hilo: opHiloHub_(String(resId).slice(3)) };
  const r = hiloConv_(resId);
  if (r.code !== 200) return { ok: false, error: 'HTTP ' + r.code };
  let hitos = []; try { hitos = hitosDe_(resId); } catch (e) { console.error('hitosDe_: ' + e); }
  return { ok: true, hilo: r.hilo.slice(-300).map(m => Object.assign({ tipo: m.tipo, auto: !!m.auto, texto: m.texto, created: m.created, fotos: m.fotos || [], canal: m.canal || 'hospitable' }, m.canal === 'whatsapp' ? { wa: m.wa || '', llamada: !!m.llamada, llamadaId: m.llamadaId || '', alma: !!m.alma } : {})).concat(hitos) };
}

/* ── HITOS DE RESERVA: Hospitable avisa (webhook reservation.changed) cuando cambian fechas, huéspedes, propiedad o
   estado, o cuando el huésped pide una modificación. Se compara con la última foto de la reserva y cada diferencia
   queda como hito en ALMA_HITOS; el hub lo muestra dentro de la conversación con su hora. La aprobación de una
   solicitud de cambio se hace en Hospitable (la API pública no la expone). ── */
const HITOS_CAB_ = ['fecha', 'conv_id', 'codigo', 'tipo', 'detalle', 'evento'];
const fecha10_ = v => v instanceof Date ? Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd') : String(v || '').slice(0, 10);
const fechaCorta_ = iso => { const m = String(iso || '').match(/(\d{4})-(\d\d)-(\d\d)/); return m ? Number(m[3]) + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m[2]) - 1] : '—'; };
const estadoEs_ = x => ({ accepted: 'confirmada', cancelled: 'cancelada', canceled: 'cancelada', request: 'solicitud', pending: 'pendiente', not_accepted: 'no aceptada', declined: 'rechazada', expired: 'vencida', inquiry: 'consulta', checkpoint: 'en revisión' })[x] || x;
function snapReserva_(d) {
  const cur = (d.reservation_status && d.reservation_status.current) || {}, g = d.guests || {};
  const prop = (d.properties && d.properties[0]) || d.property || {};
  return {
    checkin: s_(d.arrival_date || d.check_in).slice(0, 10), checkout: s_(d.departure_date || d.check_out).slice(0, 10),
    huespedes: Number(g.total || ((g.adult_count || 0) + (g.child_count || 0) + (g.infant_count || 0))) || 0,
    estado: s_(cur.category || d.status).toLowerCase(), sub: s_(cur.sub_category).toLowerCase(),
    propiedad: s_(prop.name || prop.public_name)
  };
}
function reservaCambio_(action, d) {
  d = d || {};
  const id = s_(d.id || d.uuid || d.reservation_id); if (!id) return 'cambio sin id';
  try { const cid0 = s_(d.conversation_id || (d.conversation && d.conversation.id)); if (cid0) vincularReserva_(cid0, id); } catch (e) { console.error('vincular en cambio: ' + e); }
  const k = 'rsnap_' + id, nuevo = snapReserva_(d);
  let prev = null; try { prev = JSON.parse(vGet_(k) || 'null'); } catch (e) {}
  if (!prev) {   // primera vez que la vemos: las fechas que tenía la bandeja sirven de punto de partida
    const sh = ssAlma_().getSheetByName('ALMA_INBOX');
    if (sh && sh.getLastRow() >= 2) {
      const f = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
      if (f) { const v = sh.getRange(f.getRow(), 1, 1, INBOX_CAB_.length).getValues()[0]; prev = { checkin: fecha10_(v[6]), checkout: fecha10_(v[7]), propiedad: s_(v[4]) }; }
    }
  }
  CacheService.getScriptCache().remove('pre2_' + id);
  const cambios = [];
  if (prev) {
    if ((prev.checkin && nuevo.checkin && prev.checkin !== nuevo.checkin) || (prev.checkout && nuevo.checkout && prev.checkout !== nuevo.checkout))
      cambios.push(['fechas', 'Cambio de fechas: ' + fechaCorta_(prev.checkin) + ' – ' + fechaCorta_(prev.checkout) + ' → ' + fechaCorta_(nuevo.checkin) + ' – ' + fechaCorta_(nuevo.checkout)]);
    if (prev.huespedes && nuevo.huespedes && prev.huespedes !== nuevo.huespedes) cambios.push(['huespedes', 'Cambio de huéspedes: ' + prev.huespedes + ' → ' + nuevo.huespedes]);
    if (prev.propiedad && nuevo.propiedad && prev.propiedad !== nuevo.propiedad) cambios.push(['propiedad', 'Cambio de propiedad: ' + prev.propiedad + ' → ' + nuevo.propiedad]);
    if (prev.estado && nuevo.estado && prev.estado !== nuevo.estado) cambios.push(['estado', 'Reserva ' + estadoEs_(nuevo.estado) + ' (antes: ' + estadoEs_(prev.estado) + ')']);
  }
  const crudo = JSON.stringify(d).toLowerCase();
  nuevo.pideCambio = /alteration|modification|change_request/.test(nuevo.sub + ' ' + nuevo.estado) || /"(alteration|alterations|pending_alteration|alteration_request)"\s*:\s*(\{|\[\s*\{)/.test(crudo);
  if (nuevo.pideCambio && !(prev && prev.pideCambio)) cambios.push(['solicitud', 'Solicitud de modificación del huésped · apruébala o recházala en Hospitable']);
  vSet_(k, JSON.stringify(nuevo));
  if (!cambios.length) return 'cambio sin diferencias';
  const sh = hojaCrear_('ALMA_HITOS', HITOS_CAB_), ts = new Date().toISOString(), cod = s_(d.code || d.platform_id);
  cambios.forEach(c => sh.appendRow([ts, id, cod, c[0], c[1], action]));
  try { inboxUpsert_(id, { checkin: nuevo.checkin, checkout: nuevo.checkout, propiedad: nuevo.propiedad }); } catch (e) {}
  if (cambios.some(c => c[0] === 'solicitud' || c[0] === 'fechas' || c[0] === 'estado')) {
    let pre = {}; try { pre = preContexto_(id); } catch (e) {}
    try { pushA_(null, 'Cambio en reserva · ' + (pre.huesped || cod || 'huésped'), cambios.map(c => c[1]).join(' · '), CFG.HUB_URL + '/?conv=' + encodeURIComponent(id)); } catch (e) {}
  }
  return 'hito: ' + cambios.length;
}
function hitosDe_(convId) {
  const sh = ssAlma_().getSheetByName('ALMA_HITOS');
  let out = (!sh || sh.getLastRow() < 2) ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, HITOS_CAB_.length).getValues()
    .filter(v => String(v[1]) === String(convId))
    .map(v => ({ tipo: 'hito', auto: false, texto: String(v[4] || ''), created: v[0] instanceof Date ? v[0].toISOString() : String(v[0]), fotos: [], canal: 'hospitable', hito: String(v[3] || '') }))
    .slice(-20);
  /* Como Hospitable: el momento en que entró la consulta o la solicitud y cada cambio de estado (aceptada, cancelada…). */
  try {
    const est = hitosEstado_(convId);
    if (est.length) out = out.filter(h => h.hito !== 'estado').concat(est);
  } catch (e) { console.error('hitosEstado_: ' + e); }
  return out;
}
const ESTADO_HITO_ = { request: 'Solicitud de reserva', pending: 'Solicitud de reserva', inquiry: 'Consulta', accepted: 'Reserva aceptada', confirmed: 'Reserva aceptada',
  cancelled: 'Reserva cancelada', canceled: 'Reserva cancelada', not_accepted: 'No aceptada', declined: 'Solicitud rechazada', expired: 'Solicitud vencida', denied: 'Solicitud rechazada', checkpoint: 'En revisión' };
function hitosEstado_(convId) {
  const id = String(convId || ''); if (!id || /^(wa|op):/.test(id)) return [];
  const c = CacheService.getScriptCache(), k = 'hest_' + id.slice(-40), c0 = c.get(k); if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  const mk = (tipo, txt, ts) => ({ tipo: 'hito', auto: false, texto: txt, created: ts, fotos: [], canal: 'hospitable', hito: tipo });
  let out = [];
  if (id.indexOf('inq:') === 0) {
    const r = hosp_('get', '/inquiries/' + id.slice(4));
    const d = r.code === 200 && r.json && r.json.data; if (d && d.inquiry_date) out.push(mk('estado', 'Consulta recibida', d.inquiry_date));
  } else {
    const r = hosp_('get', '/reservations/' + id); const d = r.code === 200 && r.json && r.json.data;
    if (d) {
      const hist = (d.reservation_status && d.reservation_status.history) || [];
      const primera = hist.length ? String(hist[0].category || '') : '';
      if (d.booking_date && primera !== 'request' && primera !== 'pending') out.push(mk('estado', 'Reserva creada', d.booking_date));
      hist.forEach(h => { const cat = String(h.category || '').toLowerCase(); if (h.changed_at) out.push(mk('estado', ESTADO_HITO_[cat] || ('Estado: ' + cat), h.changed_at)); });
    }
  }
  try { c.put(k, JSON.stringify(out), 900); } catch (e) {}
  return out;
}

/* Mejora de prompt: devuelve cambios puntuales, nunca una reescritura. */
const PROMPT_MEJORA_ = 'Eres el editor de los prompts de ALMA (Spacio AM). Recibes un PROMPT vigente y un PEDIDO de mejora escrito en lenguaje natural por el equipo. Tu trabajo es traducir ese pedido en cambios MÍNIMOS que respeten la estructura, el orden de secciones, el tono y el concepto original del prompt. Reglas: (1) Nunca reformules ni reescribas el prompt completo. (2) Prefiere AGREGAR una o dos líneas nuevas dentro de la sección que corresponde, o CORREGIR una línea existente cambiando lo justo. (3) Cada cambio debe ser una línea concreta y accionable, en el mismo estilo del prompt (español, viñetas "· " donde el prompt las usa). (4) Si el pedido contradice una regla esencial (confidencialidad, no inventar datos, no autorizar lo que requiere al equipo), no la elimines: agrega la matización. (5) Máximo 3 cambios. (6) Si el pedido es cambiar un DATO de una propiedad concreta (clave o red WiFi, piso, unidad, nota de parqueo, texto de llegada), NO toques el prompt: devuelve {"tipo":"dato","propiedad":"nombre exacto de PROPIEDADES CONOCIDAS","campo":"uno de CAMPOS","valor":"nuevo valor","resumen":"una frase"}. Si el pedido es una política o un dato general (facturación, parqueo de un edificio, horarios) devuelve {"tipo":"conocimiento","tema":"título corto","aplica_a":"* o nombre(s) de propiedad","contenido":"texto en la voz de Alma","resumen":"una frase"}. En cualquier otro caso devuelve SOLO JSON: {"tipo":"prompt","resumen":"una frase de qué se mejoró","cambios":[{"tipo":"agregar|corregir","seccion":"título de la sección o línea ancla EXACTA tras la cual insertar","antes":"línea existente exacta (solo en corregir)","despues":"línea nueva o corregida"}]}';
function hubProponerMejora_(clave, prompt, pedido) {
  const vigente = prompt || prompt_(String(clave || 'REDACTOR').toUpperCase());
  const props = leerTabla_(CFG.TAB_PROPIEDADES).map(r => s_(r.property_name)).filter(n => n && n.indexOf('__') === -1);
  const txt = claude_(CFG.MODELO_REDACTOR, 900, prompt_('EDITOR_PROMPTS'), 'CLAVE: ' + clave + '\n\nPROPIEDADES CONOCIDAS:\n' + props.join('\n') + '\n\nCAMPOS: ' + CAMPOS_PROPIEDAD_.join(', ') + '\n\nPROMPT VIGENTE:\n' + vigente + '\n\nPEDIDO DEL EQUIPO:\n' + pedido, 0.2);
  try { return { ok: true, propuesta: JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]) }; }
  catch (e) { return { ok: false, error: 'sin propuesta válida' }; }
}

/* Ajuste de un borrador ya redactado: integra la indicación sin perder el mensaje. */
function hubAjustarBorrador_(borrador, ajuste, contexto) {
  const txt = claude_(CFG.MODELO_REDACTOR, 700, prompt_('REDACTOR') + estilo_() + '\n\nAVISOS INTERNOS SPACIO AM (vigentes):\n' + (prompt_('REGLAS_EXTRA') || '(ninguno)'),
    'Tienes un BORRADOR ya listo para enviar al huésped y un AJUSTE que pide el equipo. Reescribe el borrador integrando el ajuste y conservando todo lo demás (datos, tono, longitud similar). Devuelve SOLO el texto final.\n\nCONTEXTO:\n' + (contexto || '(ninguno)') + '\n\nBORRADOR:\n' + borrador + '\n\nAJUSTE:\n' + ajuste, 0.3);
  return txt ? { ok: true, texto: formatearMensaje_(txt) } : { ok: false, error: 'redactor sin respuesta' };
}


/* ═══════════════════════════════ 11. WHATSAPP (Cloud API de Meta) ═══════════════════════════════
   Webhook: Meta → Configuración de WhatsApp → Webhooks → URL de esta implementación (/exec) + WA_VERIFY_TOKEN,
   suscrito al campo "messages". Cada mensaje entra a la misma cola que Hospitable: ALMA clasifica, redacta y
   responde por WhatsApp con las mismas reglas. Si el número coincide con un huésped con reserva, la conversación se
   une a la de Hospitable; si no, queda como "Sin reserva" y ALMA responde como asesora de ventas. */
const WA_CAB_ = ['ts', 'wa', 'nombre', 'dir', 'texto', 'msg_id', 'conv_id', 'tipo', 'autor', 'media'];
let WA_OK_ = false;
function hojaWA_() {
  const sh = hojaCrear_('ALMA_WHATSAPP', WA_CAB_);
  if (!WA_OK_) { WA_OK_ = true; if (sh.getLastColumn() < WA_CAB_.length) sh.getRange(1, 1, 1, WA_CAB_.length).setValues([WA_CAB_]); }
  return sh;
}
function waCfg_() {
  const p = PropertiesService.getScriptProperties();
  return { token: p.getProperty('WA_TOKEN'), phoneId: p.getProperty('WA_PHONE_ID'), plantilla: p.getProperty('WA_PLANTILLA') || '',
    idES: p.getProperty('WA_PLANTILLA_IDIOMA_ES') || 'es', idEN: p.getProperty('WA_PLANTILLA_IDIOMA_EN') || 'en',
    equipo: String(p.getProperty('WA_EQUIPO') || '').split(/[,;]+/).concat([String(CFG.WHATSAPP_JUAN || '')], telefonosEquipo_()).map(normTel_).filter(Boolean) };
}
const fin8_ = x => String(x || '').replace(/\D/g, '').slice(-8);
/* Normaliza cualquier formato a internacional sin "+": "+502 4080 1694", "33196383", "(502) 5116-2847",
   "00502…", "5.0255E+10", o varios en una celda ("5551 2345 / 4444 1234"). 8 dígitos = Guatemala → 502 delante. */
function normTel_(x) {
  let s = String(x == null ? '' : x).trim(); if (!s) return '';
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) s = Number(s).toFixed(0);
  let d = s.replace(/\D/g, '');
  if (d.indexOf('00') === 0) d = d.slice(2);
  if (d.length === 8) d = '502' + d;
  if (d.length === 12 && d.indexOf('5020') === 0) d = '502' + d.slice(4);
  return d.length >= 10 && d.length <= 15 ? d : '';
}
function telsDe_(celda) {
  return String(celda == null ? '' : celda).split(/[\/,;|\n]+|\s{2,}|\s+[yo]\s+/i).map(normTel_).filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}
/* Números del equipo, automáticos: Control de usuarios + técnicos/proveedores de EPI + turnos de ALMA_ESCALAMIENTO.
   WA_EQUIPO queda solo para agregar números sueltos. Cacheado 6 h. */
function telefonosEquipo_() {
  const cache = CacheService.getScriptCache(), c0 = cache.get('tel_equipo');
  if (c0) return c0.split(',').filter(Boolean);
  const out = {}, add = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); if (d.length >= 8) out[d] = 1; };
  const esTel = k => /tel|phone|cel|movil|móvil|whats|wa$|^wa_/i.test(String(k));
  const recorrer = o => { if (!o || typeof o !== 'object') return; Object.keys(o).forEach(k => { const v = o[k]; if (esTel(k) && (typeof v === 'string' || typeof v === 'number')) add(v); else if (v && typeof v === 'object' && esTel(k)) add(v.number || v.num || v.phone || ''); }); };
  try {
    const A = accesosPorRol_();
    A.equipo.forEach(add);
  } catch (e) { console.error('telefonosEquipo_ accesos: ' + e); }
  try {
    const v = SpreadsheetApp.openById(CFG.SHEET_EPI_ID).getSheetByName('Config').getDataRange().getValues();
    v.forEach(r => {
      if (!/^(vendors|vendedores|tecnicos|técnicos|proveedores|users|usuarios|equipo|staff)$/i.test(String(r[0]).trim())) return;
      let x = r[1]; try { x = typeof x === 'string' ? JSON.parse(x) : x; } catch (e) { return; }
      (Array.isArray(x) ? x : Object.keys(x || {}).map(k => x[k])).forEach(recorrer);
    });
  } catch (e) { console.error('telefonosEquipo_ epi: ' + e); }
  try { escalamiento_().forEach(p => add(p.telefono)); } catch (e) {}
  const lista = Object.keys(out);
  try { cache.put('tel_equipo', lista.join(','), 1800); } catch (e) {}
  return lista;
}
function waWebhook_(body) {
  (body.entry || []).forEach(en => (en.changes || []).forEach(ch => {
    const v = ch.value || {}, nombres = {};
    (v.contacts || []).forEach(c => nombres[s_(c.wa_id)] = s_(c.profile && c.profile.name));
    (v.messages || []).forEach(m => { try { waEntrante_(m, nombres[s_(m.from)] || ''); } catch (e) { console.error('waEntrante_: ' + e); } });
    (v.statuses || []).forEach(st => { if (st.status === 'failed') console.error('WhatsApp no entregó ' + s_(st.id) + ': ' + JSON.stringify(st.errors || [])); try { waEntregaGuardar_(st); } catch (e) { console.error('waEntregaGuardar_: ' + e); } });   // entrega real (entrega.js)
  }));
  return ok_('wa');   // siempre 200: Meta reintenta si no
}
function waEntrante_(m, nombre) {
  const wa = s_(m.from).replace(/\D/g, ''); if (!wa || !m.id) return;
  const cache = CacheService.getScriptCache(); if (cache.get('wa_' + m.id)) return; cache.put('wa_' + m.id, '1', 21600);
  try { waPendienteSoltar_(wa); } catch (e) { console.error('waPendienteSoltar_: ' + e); }   // respondió a la plantilla de primer contacto (contacto.js)
  const T = { image: '[envió una imagen]', audio: '[envió una nota de voz]', video: '[envió un video]', document: '[envió un documento]', sticker: '[sticker]', contacts: '[compartió un contacto]', reaction: '', unsupported: '[Mensaje que WhatsApp no deja leer aquí: suele ser un código de verificación o un mensaje con botones. Ábrelo en el teléfono]', system: '[aviso de WhatsApp: cambio de número o de cuenta]', order: '[envió un pedido del catálogo]', request_welcome: '[abrió el chat]' };
  let texto = '';
  if (m.type === 'text') texto = s_(m.text && m.text.body);
  else if (m.type === 'button') texto = s_(m.button && m.button.text);
  else if (m.type === 'interactive' && m.interactive && m.interactive.type === 'call_permission_reply') { try { vozPermisoRespuesta_(m); } catch (e) { console.error('permiso llamada: ' + e); } return; }
  else if (m.type === 'interactive') { const i = m.interactive || {}; texto = s_((i.button_reply || i.list_reply || {}).title); }
  else if (m.type === 'location') { const l = m.location || {}; texto = '[compartió su ubicación] ' + [s_(l.name), s_(l.address)].filter(Boolean).join(' · ') + ' https://maps.google.com/?q=' + l.latitude + ',' + l.longitude; }
  else texto = s_((m[m.type] || {}).caption) || (T[m.type] != null ? T[m.type] : '[' + m.type + ']');
  /* Fotos: se guardan en Drive, ALMA las ve y deja escrito qué muestran. Notas de voz: se transcriben y entran como texto. */
  const media = [];
  try {
    if (m.type === 'image' || (m.type === 'sticker' && m.sticker && !m.sticker.animated)) {
      const f = waMedia_(m[m.type].id, nombre || wa);
      if (f) {
        media.push(f.url);
        const desc = describirFoto_(f.url, s_(m.image && m.image.caption));
        texto = (s_(m.image && m.image.caption) ? s_(m.image.caption) + '\n' : '') + '[envió una foto' + (desc ? ': ' + desc : '') + ']';
      }
    } else if (m.type === 'audio') {
      const f = waMedia_(m.audio.id, nombre || wa, true);
      const tr = f ? transcribir_(f.blob) : '';
      if (f && f.url) media.push(f.url);
      texto = tr ? '[nota de voz] ' + tr : '[envió una nota de voz · no se pudo transcribir; hay que escucharla en WhatsApp]';
    } else if (m.type === 'document') {
      const f = waMedia_(m.document.id, s_(m.document.filename) || nombre || wa);
      if (f) { media.push(f.url); if (/^image\//.test(f.mime)) { const desc = describirFoto_(f.url, ''); if (desc) texto += ' [' + desc + ']'; } else texto += ' ' + f.ver; }
    }
  } catch (e) { console.error('wa media: ' + e); }
  if (!texto) return;
  const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
  const W = waCfg_(), prueba = String(PropertiesService.getScriptProperties().getProperty('WA_PRUEBA') || '').split(/[,;\s]+/).some(x => x && fin8_(x) === fin8_(wa));
  /* WA_PRUEBA: números del equipo que ALMA trata como cliente, para probar el flujo completo. */
  const esJuan = !prueba && fin8_(CFG.WHATSAPP_JUAN) === fin8_(wa);
  const esEquipo = !prueba && !esJuan && W.equipo.some(x => fin8_(x) === fin8_(wa));
  const esSocio = !prueba && !esJuan && !esEquipo && waPropietarios_().some(x => fin8_(x) === fin8_(wa));
  const actor = esJuan ? 'juan' : esEquipo ? 'equipo' : esSocio ? 'propietario' : 'externo';
  vSet_('waactor_' + fin8_(wa), actor);
  const res = actor !== 'externo' ? null : waReserva_(wa);
  const convId = res ? res.resId : 'wa:' + wa;
  const cat = res ? 'reserva' : actor !== 'externo' ? ({ juan: 'estrategico', equipo: 'interno', propietario: 'socio' })[actor] : waCategoria_(wa, texto, nombre);
  /* Meta / Facebook (códigos de verificación) o tipos que la API no entrega: se guardan y se ven en el hub, pero no se clasifican ni se responden. */
  const esSistema = m.type === 'unsupported' || m.type === 'system' || (Array.isArray(m.errors) && m.errors.length) || /^(facebook|meta|whatsapp|instagram)\b/i.test(s_(nombre)) || /\b(c[oó]digo de (verificaci[oó]n|confirmaci[oó]n)|verification code|is your (facebook|whatsapp|meta|instagram) code)\b/i.test(texto);
  if (esSistema) {
    hojaWA_().appendRow([ts, wa, nombre, 'in', texto.slice(0, 4000), s_(m.id), 'wa:' + wa, s_(m.type), 'sistema', media.join(' ')]);
    inboxUpsert_('wa:' + wa, { huesped: nombre || '+' + wa, propiedad: 'WhatsApp · Mensaje del sistema', tipo: 'sistema', canal: 'whatsapp', wa: wa, ultimo_canal: 'whatsapp',
      ultimo_texto: texto.slice(0, 300), ultimo_de: 'guest', ultimo_ts: ts, ultimo_guest_ts: ts });
    log_({ resId: 'wa:' + wa, huesped: nombre || '+' + wa, propiedad: 'WhatsApp · Mensaje del sistema', canal: 'whatsapp', nivel: 'SILENCIO', texto: texto, razon: 'mensaje del sistema de WhatsApp / Meta: no se clasifica ni se responde' }, '', 'SISTEMA · no se responde');
    return;
  }
  /* Recepción de un edificio (le mandamos los registros desde este número): no es un huésped. Se guarda, se ve en el Hub
     y ALMA recuerda que el canal oficial es el grupo o Juan / Gabriel (recepcion.js). */
  /* Contacto personal de un administrador (mensaje_personal): lo que responda se le reenvía a él, no entra como huésped. */
  const pers = !prueba && !esJuan && !esEquipo ? personalDe_(wa) : null;
  if (pers) { personalEntrante_(wa, nombre, texto, ts, media, s_(m.id), pers); return; }
  const recep = !prueba && !esJuan && !esEquipo ? recepcionDe_(wa) : null;
  if (recep) { recepcionEntrante_(wa, nombre, texto, ts, media, s_(m.id), recep); return; }
  /* Alguien a quien ALMA le escribió por encargo de un administrador (escribir_a_equipo con al_responder) y que no es
     administrador: ALMA sigue esa conversación hasta cumplir el encargo (agente.js · encargoEntrante_). */
  /* (Un contacto personal —boda, familia— nunca entra aquí, aunque su conversación personal ya haya vencido.) */
  let esPersonal = false; try { esPersonal = !!JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}')[fin8_(wa)]; } catch (e) {}
  const encW = !prueba && !esJuan && !esPersonal && !adminPorTel_(wa) ? encargoAbierto_(wa) : null;
  if (encW) { try { encargoEntrante_(wa, nombre, texto, ts, media, s_(m.id), encW); } catch (e) { console.error('encargoEntrante_: ' + e); } return; }
  /* Chat operativo: un administrador registrado escribe → su chat con ALMA, fuera de la lista general. */
  /* Cualquier número registrado de un administrador (o el de Juan) va a su chat operativo, aunque no esté en WA_EQUIPO. */
  const admOp = !prueba && opActivo_() ? (adminPorTel_(wa) || (esJuan ? (adminsOp_().find(a => a.principal) || null) : null)) : null;
  if (admOp) {
    /* No responde mensaje por mensaje: espera a que deje de escribir y contesta todo junto (opWaProcesar_). */
    const reenv = m.context && (m.context.forwarded || m.context.frequently_forwarded) ? '[reenviado] ' : '';
    hojaWA_().appendRow([ts, wa, nombre, 'in', (reenv + texto).slice(0, 4000), s_(m.id), 'op:' + admOp.email, s_(m.type), 'operativo_pend', media.join(' ')]);
    PropertiesService.getScriptProperties().setProperty('OP_WA_PEND', '1');
    opWaProgramar_();
    return;
  }
  hojaWA_().appendRow([ts, wa, nombre, 'in', texto.slice(0, 4000), s_(m.id), convId, s_(m.type), '', media.join(' ')]);
  if (!res && (actor !== 'externo' || cat !== 'reserva')) { try { contactoEncolar_(wa, ''); } catch (e) {} }   // proveedor, técnico, socio… (contactos.js)
  let pre = {}; try { pre = preContexto_(convId); } catch (e) {}
  inboxUpsert_(convId, { codigo: pre.codigo, huesped: pre.huesped || nombre || '+' + wa, foto: pre.foto, propiedad: res ? (pre.propiedad || 'Reserva') : (RUTA_NOMBRE_[cat] || 'WhatsApp · Posible reserva'),
    tipo: res ? (pre.tipo || 'reserva') : cat, checkin: pre.checkin, checkout: pre.checkout, canal: pre.canal || 'whatsapp', wa: wa, ultimo_canal: 'whatsapp',
    ultimo_texto: (m.type === 'audio' ? texto : texto.replace(/\[envió una foto[^\]]*\]/, '[foto]')).slice(0, 300), ultimo_de: 'guest', ultimo_ts: ts, ultimo_guest_ts: ts });
  pushNuevo_(convId, pre.huesped || nombre || '+' + wa, pre.propiedad || 'WhatsApp', (m.type === 'audio' ? 'Nota de voz: ' : '') + texto.replace(/\[envió una foto[^\]]*\]/, 'Envió una foto'));
  hoja_(CFG.TAB_COLA).appendRow([new Date().toISOString(), s_(m.id), convId, '', pre.huesped || nombre, texto.slice(0, 2000), 'pendiente', 0, '', '',
    JSON.stringify(Object.assign({}, pre, { canal: 'whatsapp', wa: wa, categoria: cat, actor: actor }, media.filter(u => /thumbnail/.test(u)).length ? { fotos: media.filter(u => /thumbnail/.test(u)) } : {}))]);
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ALMA_ACTIVO', '1'); props.setProperty('ULTIMO_POST', String(Date.now()));
  programarPronto_();
}
/* Descarga un adjunto de WhatsApp (2 pasos: id → url temporal → bytes) y lo guarda en Drive (carpeta ALMA · WhatsApp).
   Devuelve una URL de miniatura que el hub puede mostrar y que claude_ convierte a base64. */
function waMedia_(mediaId, etiqueta, soloBlob) {
  const W = waCfg_(); if (!mediaId || !W.token) return null;
  const h = { Authorization: 'Bearer ' + W.token };
  const meta = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + mediaId, { muteHttpExceptions: true, headers: h });
  if (meta.getResponseCode() !== 200) { console.error('waMedia_ meta ' + meta.getResponseCode() + ' ' + meta.getContentText()); return null; }
  const mj = JSON.parse(meta.getContentText() || '{}');
  const bin = UrlFetchApp.fetch(mj.url, { muteHttpExceptions: true, headers: h });
  if (bin.getResponseCode() !== 200) { console.error('waMedia_ bin ' + bin.getResponseCode()); return null; }
  const mime = String(mj.mime_type || bin.getHeaders()['Content-Type'] || 'application/octet-stream').split(';')[0];
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'application/pdf': 'pdf' })[mime] || 'bin';
  const blob = bin.getBlob().setContentType(mime).setName(Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd-HHmmss') + ' · ' + String(etiqueta || '').slice(0, 40) + '.' + ext);
  let url = '', ver = '';
  try {
    const props = PropertiesService.getScriptProperties();
    let carpeta = null, cid = props.getProperty('WA_CARPETA');
    try { if (cid) carpeta = DriveApp.getFolderById(cid); } catch (e) {}
    if (!carpeta) { carpeta = DriveApp.createFolder('ALMA · WhatsApp'); props.setProperty('WA_CARPETA', carpeta.getId()); }
    const f = carpeta.createFile(blob);
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    url = /^image\//.test(mime) ? 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1200' : '';
    ver = 'https://drive.google.com/file/d/' + f.getId() + '/view';
  } catch (e) { console.error('waMedia_ drive: ' + e); if (!soloBlob) return null; }
  return { url: url, ver: ver, mime: mime, blob: blob };
}
/* Qué muestra la foto, en una o dos frases, para el clasificador, el resumen y el hilo. */
function describirFoto_(url, caption) {
  const t = claude_(CFG.MODELO_CLASIFICADOR, 220,
    'Describes fotos que huéspedes o interesados envían a Spacio AM (hospitalidad, Guatemala) por WhatsApp. En español, máximo 2 frases, solo lo que se ve y es útil para atenderlos: daños, fugas, aparatos, pantallas de error, documentos (sin copiar números de identidad completos), capturas de reservas o pagos (fechas, montos, plataforma), ubicaciones o fachadas. Si hay texto relevante en la imagen, inclúyelo. No saludes ni opines.',
    caption ? 'Texto que acompaña la foto: ' + caption : 'Describe la foto.', 0, [url]);
  return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 400);
}
/* Nota de voz → texto. Gemini (GEMINI_KEY) entiende el .ogg de WhatsApp directo; si no, Whisper (OPENAI_KEY). */
function transcribir_(blob) {
  if (!blob) return '';
  const p = PropertiesService.getScriptProperties(), gk = p.getProperty('GEMINI_KEY'), ok = p.getProperty('OPENAI_KEY');
  const bytes = blob.getBytes(); if (bytes.length > 18 * 1024 * 1024) return '';
  if (gk) {
    try {
      const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (p.getProperty('GEMINI_MODELO') || 'gemini-2.0-flash') + ':generateContent?key=' + gk, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ contents: [{ parts: [
          { text: 'Transcribe literalmente esta nota de voz, en el idioma en que se habla. Solo la transcripción, sin comentarios ni marcas de tiempo. Si no se entiende nada, responde exactamente: [inaudible]' },
          { inline_data: { mime_type: String(blob.getContentType() || 'audio/ogg').split(';')[0], data: Utilities.base64Encode(bytes) } }] }], generationConfig: { temperature: 0 } })
      });
      const j = JSON.parse(r.getContentText() || '{}');
      try { const um = j.usageMetadata || {}; registrarUso_({ app: 'ALMA', funcion: 'Notas de voz · transcripción', modelo: p.getProperty('GEMINI_MODELO') || 'gemini-2.0-flash', usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 }, ok: r.getResponseCode() < 300, audio: true }); } catch (e) {}
      const t = (((j.candidates || [])[0] || {}).content || {}).parts;
      const txt = (t || []).map(x => x.text || '').join(' ').trim();
      if (txt && txt !== '[inaudible]') return txt.slice(0, 3000);
      if (r.getResponseCode() >= 300) console.error('Gemini ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
    } catch (e) { console.error('transcribir_ gemini: ' + e); }
  }
  if (ok) {
    try {
      const r = UrlFetchApp.fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ok },
        payload: { model: 'whisper-1', file: blob.setName('nota.ogg') } });
      const j = JSON.parse(r.getContentText() || '{}');
      try { registrarUso_({ app: 'ALMA', funcion: 'Notas de voz · transcripción', modelo: 'whisper-1', usage: {}, minutos: Math.max(0.1, bytes.length / 2000 / 60), ok: !!j.text }); } catch (e) {}
      if (j.text) return String(j.text).trim().slice(0, 3000);
      console.error('Whisper ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
    } catch (e) { console.error('transcribir_ whisper: ' + e); }
  }
  /* ElevenLabs Speech to Text (Scribe): usa la misma ELEVENLABS_KEY del agente de voz (necesita el permiso «Speech to Text»). */
  const ek = p.getProperty('ELEVENLABS_KEY');
  if (ek) {
    try {
      const r = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'post', muteHttpExceptions: true, headers: { 'xi-api-key': ek },
        payload: { model_id: 'scribe_v1', file: blob.setName('nota.ogg') } });
      const j = JSON.parse(r.getContentText() || '{}');
      try { registrarUso_({ app: 'ALMA', funcion: 'Notas de voz · transcripción', modelo: 'elevenlabs-scribe', usage: {}, minutos: Math.max(0.1, bytes.length / 2000 / 60), ok: !!j.text }); } catch (e) {}
      if (j.text) return String(j.text).trim().slice(0, 3000);
      console.error('ElevenLabs STT ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
      try { CacheService.getScriptCache().put('stt_error', r.getResponseCode() + ' ' + r.getContentText().slice(0, 200), 21600); } catch (e) {}
    } catch (e) { console.error('transcribir_ elevenlabs: ' + e); }
  }
  return '';
}
/* Conversación de WhatsApp sin reserva unida: ¿es una reserva o posible reserva, o es administrativa
   (proveedores, pagos de servicios, vecinos, bancos, trámites, ofertas)? Una vez que es "reserva" se queda así. */
function waCategoria_(wa, texto, nombre) {
  const k = 'wacat_' + fin8_(wa), prev = vGet_(k);
  if (prev === 'reserva') return prev;
  const hist = waHilo_('wa:' + wa).slice(-8).map(m => (m.tipo === 'guest' ? 'CONTACTO: ' : 'SPACIO AM: ') + m.texto).join('\n');
  const t = claude_(CFG.MODELO_CLASIFICADOR, 20,
    'Clasificas conversaciones de WhatsApp que llegan al número de Spacio AM, empresa de alojamientos temporales en Guatemala. Responde SOLO una palabra:\n' +
    'reserva = tiene o quiere una reserva: huésped actual o pasado, pregunta precios, disponibilidad, fechas, ubicación de los apartamentos, check-in, pagos de una estadía, cambios o cancelaciones.\n' +
    'administrativa = todo lo demás: proveedores, técnicos, limpieza, cobros o pagos de servicios, bancos, vecinos, administración de edificios, trámites, ventas o publicidad que nos ofrecen, propietarios de apartamentos, reclutamiento.',
    'Nombre: ' + (nombre || '-') + '\nConversación previa:\n' + (hist || '(ninguna)') + '\nMensaje nuevo: ' + texto, 0);
  const cat = /admin/i.test(String(t)) ? 'administrativa' : 'reserva';
  vSet_(k, cat);
  return cat;
}
/* ═══ ROUTER DE CONVERSACIONES (WhatsApp) ═══
   1) Contexto y actor → una de 5 rutas: huésped · socio/propietario · coordinación interna · estratégica (Juan) · agenda personal (Juan).
   2) Urgencia dentro de la ruta: urgente · prioridad · normal.
   3) Cada combinación tiene sus propias reglas (editables en ALMA_INSTRUCCIONES: RUTA_<RUTA>_<URGENCIA>).
   Las conversaciones de huésped siguen el clasificador de siempre (VERDE/AMARILLO/ROJO = normal/prioridad/urgente). */
const RUTAS_ = ['huesped', 'socio', 'interno', 'estrategico', 'personal'];
const RUTA_NOMBRE_ = { reserva: 'WhatsApp · Posible reserva', administrativa: 'WhatsApp · Coordinación interna', huesped: 'WhatsApp · Posible reserva', socio: 'WhatsApp · Socio / propietario', interno: 'WhatsApp · Coordinación interna', estrategico: 'WhatsApp · Estratégico', personal: 'WhatsApp · Agenda personal' };
/* Propietarios, dinámicos: filas del Control de usuarios (o la hoja SHEET_PROPIETARIOS_ID) cuyo rol es propietario / socio.
   Se relee cada 30 min, así un propietario nuevo entra solo. WA_PROPIETARIOS queda para números sueltos. */
function waPropietarios_() {
  const extra = String(PropertiesService.getScriptProperties().getProperty('WA_PROPIETARIOS') || '').split(/[,;\s]+/);
  return accesosPorRol_().propietarios.concat(extra).map(normTel_).filter(Boolean);
}
function accesosPorRol_() {
  const cache = CacheService.getScriptCache(), c0 = cache.get('acc_roles_v2');
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  const out = { equipo: [], propietarios: [] };
  const norm = k => String(k).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const esTel = k => /^(telefono|telefonos|tel|celular|whatsapp|phone|movil)$/.test(norm(k));
  const esRol = k => /^(rol|roles|role|tipo|tipo_usuario|perfil)$/.test(norm(k));
  const esProp = t => /\b(propietari[oa]s?|socio|socia|socios)\b/.test(norm(t));
  const esFlag = k => /^(es_)?(dueno|duenio|duena|socio|socia|propietario)$/.test(norm(k));
  const esSi = v => /^(si|yes|true|x|1|verdadero)$/.test(norm(v));
  const leer = (id, forzarProp) => {
    SpreadsheetApp.openById(id).getSheets().forEach(sh => {
      const v = sh.getDataRange().getDisplayValues(); if (v.length < 2) return;
      const cab = v[0].map(x => String(x).trim());
      const tels = cab.map((c, i) => esTel(c) ? i : -1).filter(i => i >= 0); if (!tels.length) return;
      const roles = cab.map((c, i) => esRol(c) && !/^perm_/i.test(c) ? i : -1).filter(i => i >= 0);
      const perm = k => cab.findIndex(c => c.toLowerCase().replace(/\s+/g, '_') === 'perm_' + k);
      const flags = cab.map((c, i) => esFlag(c) ? i : -1).filter(i => i >= 0);   // L es_dueno · M es_socio
      const est = cab.findIndex(c => norm(c) === 'estado');
      const pMi = perm('mi'), pOtras = ['hub', 'epi', 'grow', 'hola'].map(perm).filter(i => i >= 0);
      const lleno = x => { const t = String(x || '').trim().toLowerCase(); return !!t && t !== 'no' && t !== 'false' && t !== '0'; };
      const cEst = cab.findIndex(c => /^(estado|activo|active)$/i.test(c));
      const hojaProp = forzarProp || esProp(sh.getName());
      v.slice(1).forEach(r => {
        if (cEst >= 0 && /inactiv|baja|no|false/i.test(String(r[cEst]))) return;
        /* Propietario = rol dice propietario/socio, o solo tiene acceso a mi.spacioam (perm_mi) y a ninguna app operativa. */
        const soloMi = pMi >= 0 && lleno(r[pMi]) && !pOtras.some(i => lleno(r[i]));
        if (est >= 0 && /inactiv|baja|bloque|suspend/.test(norm(r[est]))) return;
        /* Columnas es_dueno / es_socio mandan: «sí» en cualquiera de las dos = propietario. */
        const prop = hojaProp || (flags.length ? flags.some(i => esSi(r[i])) : (soloMi || roles.some(i => esProp(r[i]))));
        tels.forEach(i => telsDe_(r[i]).forEach(d => (prop ? out.propietarios : out.equipo).push(d)));
      });
    });
  };
  try { leer(SHEET_ACCESOS_ID, false); } catch (e) { console.error('accesosPorRol_ usuarios: ' + e); }
  const idP = PropertiesService.getScriptProperties().getProperty('SHEET_PROPIETARIOS_ID');
  if (idP) { try { leer(idP, true); } catch (e) { console.error('accesosPorRol_ propietarios: ' + e); } }
  const P = {}; out.propietarios.forEach(x => P[fin8_(x)] = 1);
  out.equipo = out.equipo.filter(x => !P[fin8_(x)]);   // si alguien es propietario, no cuenta como equipo
  out.equipo = out.equipo.filter((v, i, a) => a.indexOf(v) === i); out.propietarios = out.propietarios.filter((v, i, a) => a.indexOf(v) === i);
  try { cache.put('acc_roles_v2', JSON.stringify(out), 1800); } catch (e) {}
  return out;
}
function routerWA_(ctx) {
  const actor = ctx.actor || 'externo';
  const sys = prompt_('ROUTER') + '\n\nDevuelve SOLO JSON: {"ruta":"huesped|socio|interno|estrategico|personal","urgencia":"urgente|prioridad|normal","razon":"..."}';
  const txt = claude_(CFG.MODELO_CLASIFICADOR, 200, sys,
    'QUIÉN ESCRIBE (por su número): ' + ({ juan: 'Juan Ovalle, fundador y CEO de Spacio AM', equipo: 'alguien del equipo de Spacio AM (operación, limpieza, mantenimiento, supervisión)', propietario: 'un socio / propietario de apartamentos', externo: 'número externo (huésped, interesado, proveedor u otro)' })[actor] +
    '\nRUTA ANTERIOR DE ESTA CONVERSACIÓN: ' + (ctx.rutaPrev || '(ninguna)') + '\nHORA LOCAL: ' + ctx.horaLocal +
    '\n\nMENSAJES DE ESTE TURNO:\n' + ctx.texto + '\n\nHILO RECIENTE:\n' + String(ctx.hiloTexto || '').slice(-3000), 0, ctx.fotos);
  let r = {}; try { r = JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]); } catch (e) {}
  let ruta = RUTAS_.indexOf(r.ruta) >= 0 ? r.ruta : (ctx.rutaPrev || ({ juan: 'estrategico', equipo: 'interno', propietario: 'socio' })[actor] || 'huesped');
  if (actor !== 'juan' && (ruta === 'estrategico' || ruta === 'personal')) ruta = actor === 'equipo' ? 'interno' : actor === 'propietario' ? 'socio' : 'huesped';
  const urg = ['urgente', 'prioridad', 'normal'].indexOf(r.urgencia) >= 0 ? r.urgencia : 'prioridad';
  return { ruta: ruta, urgencia: (ruta === 'estrategico' || ruta === 'personal') && urg === 'urgente' && ruta === 'estrategico' ? 'urgente' : urg, razon: s_(r.razon) || '-' };
}
function reglasRuta_(ruta, urg) {
  if (ruta === 'estrategico' || ruta === 'personal') return prompt_('RUTA_' + ruta.toUpperCase());
  return prompt_('RUTA_' + ruta.toUpperCase() + '_' + urg.toUpperCase());
}
/* ¿Este número es de un huésped con reserva? 1) ya unido antes (30 días) 2) hoja Reservas 3) teléfonos de Hospitable de las reservas activas. */
function waReserva_(wa) {
  const k8 = fin8_(wa), cache = CacheService.getScriptCache(), ck = 'warel_' + k8, c0 = cache.get(ck);
  if (c0) return c0 === '-' ? null : JSON.parse(c0);
  const guardar = r => { cache.put(ck, r ? JSON.stringify(r) : '-', r ? 21600 : 1800); return r; };
  const hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), lim = Date.now() - 30 * 86400000;
  const shW = ssAlma_().getSheetByName('ALMA_WHATSAPP');
  if (shW && shW.getLastRow() >= 2) {
    const n = shW.getLastRow(), desde = Math.max(2, n - 2000);
    const prev = shW.getRange(desde, 1, n - desde + 1, WA_CAB_.length).getValues().reverse()
      .find(v => fin8_(v[1]) === k8 && s_(v[6]) && s_(v[6]).indexOf('wa:') !== 0 && new Date(v[0]).getTime() > lim);
    if (prev) return guardar({ resId: s_(prev[6]) });
  }
  const inbox = hubInbox_();
  const porCodigo = c => (inbox.find(x => x.codigo && x.codigo === c && x.conv_id.indexOf('inq:') !== 0 && x.conv_id.indexOf('wa:') !== 0) || {}).conv_id || '';
  try {
    const filas = leerTabla_(CFG.TAB_RESERVAS).filter(r => !/cancel/i.test(s_(r.status)) && (!fecha_(r.checkout_date) || fecha_(r.checkout_date) >= sumarDias_(hoy, -2)));
    const hit = filas.find(r => Object.keys(r).some(c => /phone|tel|whats|celular|movil|móvil/i.test(c) && fin8_(r[c]).length === 8 && fin8_(r[c]) === k8));
    if (hit) {
      const uuid = [hit.reservation_id, hit.hospitable_id, hit.res_id, hit.uuid, hit.id].map(s_).find(x => /^[0-9a-f-]{20,}$/i.test(x));
      const id = uuid || porCodigo(s_(hit.code));
      if (id) return guardar({ resId: id });
    }
  } catch (e) { console.error('waReserva_ hoja: ' + e); }
  const activas = inbox.filter(x => x.conv_id && x.conv_id.indexOf('inq:') !== 0 && x.conv_id.indexOf('wa:') !== 0 && (!x.checkout || String(x.checkout).slice(0, 10) >= sumarDias_(hoy, -2)) && (!x.checkin || String(x.checkin).slice(0, 10) <= sumarDias_(hoy, 45))).slice(0, 60);
  for (let i = 0; i < activas.length; i++) {
    let pre = {}; try { pre = preContexto_(activas[i].conv_id); } catch (e) {}
    if ((pre.tels || []).some(t => fin8_(t) === k8)) return guardar({ resId: activas[i].conv_id });
  }
  /* Teléfonos que dejaron en el registro de llegada de hola (titular, contacto, emergencia). */
  try { const cH = vozCodigoPorTelHola_(wa), idH = cH && porCodigo(cH); if (idH) return guardar({ resId: idH }); } catch (e) { console.error('waReserva_ hola: ' + e); }
  return guardar(null);
}
function waHilo_(convId) {
  const sh = ssAlma_().getSheetByName('ALMA_WHATSAPP'); if (!sh || sh.getLastRow() < 2) return [];
  const n = sh.getLastRow(), desde = Math.max(2, n - 3000);
  return sh.getRange(desde, 1, n - desde + 1, Math.min(WA_CAB_.length, sh.getLastColumn())).getValues().map(v => v.concat(['', ''])).filter(v => s_(v[6]) === String(convId))
    .map(v => ({ tipo: v[3] === 'in' ? 'guest' : 'host', auto: false, alma: s_(v[8]) === 'alma', texto: s_(v[4]), nombre: v[3] === 'in' ? s_(v[2]) : s_(v[8]), fotos: s_(v[9]).split(/\s+/).filter(u => /thumbnail\?id=/.test(u)),
      created: v[0] instanceof Date ? v[0].toISOString() : s_(v[0]), canal: 'whatsapp', wa: s_(v[1]), llamada: s_(v[7]) === 'llamada', llamadaId: s_(v[7]) === 'llamada' ? s_(v[5]).split('#')[0] : '' }));
}
/* Hilo de una conversación: Hospitable (si es reserva) + WhatsApp, por hora. */
/* Copia del hilo de Hospitable: fresca 60 s (evita pedirlo varias veces seguidas) y de respaldo 6 h si Hospitable responde 429. */
function hiloCacheGet_(id, fresco) {
  try { const c = CacheService.getScriptCache().get((fresco ? 'hf_' : 'hr_') + id); return c ? JSON.parse(c) : null; } catch (e) { return null; }
}
function hiloCachePut_(id, hilo) {
  try { const t = JSON.stringify(hilo); if (t.length < 95000) { const c = CacheService.getScriptCache(); c.put('hf_' + id, t, 60); c.put('hr_' + id, t, 21600); } } catch (e) {}
}
/* Lo que enviamos (ALMA o el equipo) se ve al instante: Hospitable tarda en devolverlo por la API. Se guarda 30 min y se
   mezcla con el hilo hasta que Hospitable ya lo trae (se compara por el inicio del texto). */
function cacheEnvio_(id, texto) {
  const c = CacheService.getScriptCache(), k = 'env_' + id, ts = new Date().toISOString(); let L = [];
  try { L = JSON.parse(c.get(k) || '[]'); } catch (e) {}
  L.push({ tipo: 'host', texto: String(texto).slice(0, 3000), created: ts, auto: false, canal: 'hospitable', fotos: [] });
  try { c.put(k, JSON.stringify(L.slice(-6)), 1800); c.removeAll(['hf_' + id]); } catch (e) {}
  try { inboxUpsert_(id, { ultimo_texto: String(texto).slice(0, 300), ultimo_de: 'host', ultimo_ts: ts, ultimo_host_ts: ts, ultimo_canal: 'hospitable' }); } catch (e) {}
}
function mezclarEnvios_(id, hilo) {
  const c = CacheService.getScriptCache();
  let L = []; try { L = JSON.parse(c.get('env_' + id) || '[]'); } catch (e) {}
  let G = []; try { G = JSON.parse(c.get('gin_' + id) || '[]'); } catch (e) {}
  if (!L.length && !G.length) return hilo;
  const k = t => String(t || '').toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '').slice(0, 50), vis = {};
  hilo.forEach(m => vis[(m.tipo === 'guest' ? 'g|' : 'h|') + k(m.texto)] = 1);
  const falt = L.map(m => Object.assign({ tipo: 'host' }, m)).concat(G).filter(m => {
    const kk = (m.tipo === 'guest' ? 'g|' : 'h|') + k(m.texto); if (!k(m.texto) || vis[kk]) return false; vis[kk] = 1; return true;
  });
  return falt.length ? hilo.concat(falt).sort((a, b) => new Date(a.created) - new Date(b.created)) : hilo;
}
function hiloConv_(convId, hiloCliente) {
  const id = String(convId || ''); let hilo = [];
  if (!/^(wa|llamada):/.test(id)) {   // WhatsApp y llamadas sin número viven solo en ALMA_WHATSAPP
    const fr = hiloCacheGet_(id, true);
    if (fr) { hilo = fr; try { hilo = hilo.concat(waHilo_(id)); } catch (e) {} hilo.sort((a, b) => new Date(a.created) - new Date(b.created)); try { hilo = mezclarEnvios_(id, hilo); } catch (e) {} return { code: 200, hilo: hilo, cache: true }; }
  }
  if (!/^(wa|llamada):/.test(id)) {   // WhatsApp y llamadas sin número viven solo en ALMA_WHATSAPP
    /* Las consultas (inq:uuid) viven en /inquiries; antes se pedían a /reservations y fallaban → el hub solo mostraba un intercambio. */
    const inq = id.indexOf('inq:') === 0, uid = id.replace(/^inq:/, '');
    /* La API no deja leer el historial de una consulta: se intenta por si la consulta ya se convirtió en reserva y,
       si no, se arma con lo que ALMA guardó (webhooks, cola y log). */
    /* Consulta: si ya se convirtió en reserva (mismo conversation_id), el hilo completo —incluida la etapa de consulta— sale
       de la reserva. Si no, solo lo guardado (Hospitable no expone GET de mensajes de una consulta). */
    let r = { code: 0 };
    if (inq) {
      const res = reservaDeConsulta_(uid);
      if (res) r = hosp_('get', '/reservations/' + res + '/messages');
      else {
        /* La API v2 sí entrega el historial de la consulta con include=messages (automáticos de Hospitable incluidos). */
        const ri = hosp_('get', '/inquiries/' + uid + '?include=messages');
        if (ri.code === 200 && ri.json && ri.json.data && Array.isArray(ri.json.data.messages)) r = { code: 200, json: { data: ri.json.data.messages } };
      }
    }
    else r = hosp_('get', '/reservations/' + uid + '/messages');
    if (r.code === 200 && inq) {
      /* Consulta: lo de Hospitable + lo que ALMA guardó por webhook, sin duplicados. */
      const api = normalizarHilo_(r.json).map(m => Object.assign(m, { canal: 'hospitable' })), loc = hiloInqLocal_(id), k = m => m.tipo + '|' + String(m.texto).slice(0, 80);
      const vis = {}; api.forEach(m => vis[k(m)] = 1);
      hilo = api.concat(loc.filter(m => !vis[k(m)])); hiloCachePut_(id, hilo);
    } else if (r.code === 200) { hilo = normalizarHilo_(r.json).map(m => Object.assign(m, { canal: 'hospitable' })); hiloCachePut_(id, hilo); }
    else if (inq) hilo = hiloInqLocal_(id);
    else {
      /* Respaldo: la última copia buena o el hilo que el hub ya tiene en pantalla. */
      const rs = hiloCacheGet_(id, false), cli = Array.isArray(hiloCliente) ? hiloCliente.filter(m => m && m.texto).map(m => ({ tipo: m.tipo === 'guest' ? 'guest' : 'host', texto: String(m.texto).slice(0, 3000), created: String(m.created || ''), auto: !!m.auto, canal: m.canal || 'hospitable' })) : [];
      if (rs && rs.length) hilo = rs; else if (cli.length) hilo = cli; else return { code: r.code, hilo: [] };
    }
  }
  try { hilo = hilo.concat(waHilo_(id)); } catch (e) { console.error('waHilo_: ' + e); }
  hilo.sort((a, b) => new Date(a.created) - new Date(b.created));
  try { hilo = mezclarEnvios_(id, hilo); } catch (e) {}
  return { code: 200, hilo: hilo };
}
function waVentana_(wa) {
  const sh = ssAlma_().getSheetByName('ALMA_WHATSAPP'); if (!sh || sh.getLastRow() < 2) return false;
  const n = sh.getLastRow(), desde = Math.max(2, n - 2000), k8 = fin8_(wa);
  const ult = sh.getRange(desde, 1, n - desde + 1, 4).getValues().reverse().find(v => v[3] === 'in' && fin8_(v[1]) === k8);
  return !!ult && Date.now() - new Date(ult[0]).getTime() < 23.5 * 3600000;
}
/* Responde por WhatsApp. Dentro de las 24 h: texto libre. Fuera: plantilla aprobada (WA_PLANTILLA) para retomar. */
/* Números de WhatsApp de una reserva, del más probable al menos: los que ya escribieron o llamaron, los del huésped en
   Hospitable y los del registro de llegada (titular, contacto, emergencia). */
function telsReserva_(resId) {
  resId = String(resId || ''); if (!resId || /^(wa|op|inq):/.test(resId)) return [];
  const out = [], add = (t, origen) => { const n = normTel_(t); if (n && !out.some(x => fin8_(x.wa) === fin8_(n))) out.push({ wa: n, origen: origen }); };
  try { waHilo_(resId).slice().reverse().forEach(m => { if (m.wa) add(m.wa, m.llamada ? 'llamada' : 'whatsapp'); }); } catch (e) {}
  let pre = {}; try { pre = preContexto_(resId) || {}; } catch (e) {}
  (pre.tels || []).forEach(t => add(t, 'reserva'));
  try {
    const cod = String(pre.codigo || '').toUpperCase(), sh = cod && ssWebapp_().getSheetByName('Formularios');
    if (sh && sh.getLastRow() >= 2) {
      const v = sh.getDataRange().getDisplayValues(), cab = v[0].map(x => String(x).trim()), cc = cab.indexOf('code');
      const ct = cab.map((x, i) => /phone|emergency/i.test(x) ? i : -1).filter(i => i >= 0);
      v.slice(1).filter(r => String(r[cc]).trim().toUpperCase() === cod).forEach(r => ct.forEach(i => telsDe_(r[i]).forEach(t => add(t, /emergency/i.test(cab[i]) ? 'emergencia' : 'registro'))));
    }
  } catch (e) { console.error('telsReserva_ hola: ' + e); }
  return out;
}
/* Escribir por WhatsApp desde la conversación de una reserva: al número indicado o al más probable. */
function hubResponderWa_(resId, texto, quien, wa) {
  texto = String(texto || '').trim(); if (!resId || !texto) return { ok: false, error: 'faltan datos' };
  const num = normTel_(wa || '') || ((telsReserva_(resId)[0] || {}).wa) || '';
  if (!num) return { ok: false, error: 'sin_numero' };
  let pre = {}; try { pre = preContexto_(resId) || {}; } catch (e) {}
  const ultG = waHilo_(resId).filter(m => m.tipo === 'guest' && !m.llamada).pop() || {};
  const w = waResponder_(num, texto, resId, String(quien || 'Equipo').slice(0, 80), idiomaDe_(ultG.texto || ''), pre.huesped || ultG.nombre || '');
  if (!w.ok) return { ok: false, error: w.error };
  try { CacheService.getScriptCache().removeAll(['hf_' + resId]); } catch (e) {}
  try { promesasCumplir_(resId, quien || 'Equipo'); } catch (e) {}
  return { ok: true, wa: num, plantilla: !!w.plantilla };
}
function waResponder_(wa, texto, convId, autor, idioma, nombre) {
  const W = waCfg_(); if (!W.token || !W.phoneId) return { ok: false, error: 'falta WA_TOKEN o WA_PHONE_ID' };
  const abierta = waVentana_(wa);
  let payload, guardado = String(texto);
  if (abierta) payload = { messaging_product: 'whatsapp', to: wa, type: 'text', text: { body: String(texto).slice(0, 4096), preview_url: true } };
  else {
    if (!W.plantilla) return { ok: false, error: 'pasaron más de 24 h desde su último mensaje y no hay plantilla configurada (WA_PLANTILLA)' };
    const en = String(idioma || '').slice(0, 2) === 'en';
    payload = { messaging_product: 'whatsapp', to: wa, type: 'template', template: { name: W.plantilla, language: { code: en ? W.idEN : W.idES },
      components: [{ type: 'body', parameters: [{ type: 'text', text: String(nombre || '').trim().split(/\s+/)[0] || (en ? 'there' : 'hola') }] }] } };
    guardado = '[plantilla para retomar: ' + W.plantilla + '] · pendiente de enviar cuando responda: ' + texto;
  }
  const r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + W.phoneId + '/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + W.token }, payload: JSON.stringify(payload) });
  const code = r.getResponseCode(); let j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
  if (code >= 300) return { ok: false, code: code, error: (j.error && (j.error.error_user_msg || j.error.message)) || 'HTTP ' + code };
  const ts = new Date().toISOString();
  hojaWA_().appendRow([ts, wa, '', 'out', guardado.slice(0, 4000), s_(j.messages && j.messages[0] && j.messages[0].id), String(convId || 'wa:' + wa), abierta ? 'text' : 'template', autor || 'alma', '']);
  try { inboxUpsert_(String(convId || 'wa:' + wa), { ultimo_texto: guardado.slice(0, 300), ultimo_de: 'host', ultimo_ts: ts, ultimo_host_ts: ts, ultimo_canal: 'whatsapp', wa: wa }); } catch (e) {}
  return { ok: true, code: 200, plantilla: !abierta };
}
/* Envía por el canal del turno: WhatsApp o Hospitable. Devuelve { code } como hosp_. */
function enviarCanal_(d, texto, autor) {
  texto = limpiarSalida_(texto).texto;
  if (!textoEnviable_(texto)) { console.error('enviarCanal_ bloqueó un texto no enviable: ' + String(texto).slice(0, 80)); return { code: 422, error: 'texto bloqueado (marcador interno o vacío)', bloqueado: true }; }
  if (d.canal === 'whatsapp' && d.wa) { const w = waResponder_(d.wa, texto, d.resId, autor || 'alma', d.idioma, d.huesped); return { code: w.ok ? 200 : (w.code || 500), error: w.error }; }
  return hosp_('post', '/reservations/' + d.resId + '/messages', { body: texto });
}
/* Ejecuta una vez desde el editor para revisar la conexión con Meta. */
function probarWhatsApp() {
  const W = waCfg_();
  if (!W.token || !W.phoneId) { console.log('Falta WA_TOKEN o WA_PHONE_ID en Propiedades del script.'); return; }
  const r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + W.phoneId + '?fields=display_phone_number,verified_name,quality_rating', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } });
  console.log('Meta → HTTP ' + r.getResponseCode() + ' · ' + r.getContentText());
  console.log('Propietarios detectados (' + waPropietarios_().length + '): ' + waPropietarios_().map(x => '…' + x.slice(-4)).join(', '));
  console.log('Números del equipo detectados (' + telefonosEquipo_().length + '): ' + telefonosEquipo_().map(x => '…' + x.slice(-4)).join(', '));
  console.log('Verify token del webhook: ' + (PropertiesService.getScriptProperties().getProperty('WA_VERIFY_TOKEN') || 'spacioam-alma'));
  console.log('URL del webhook: usa la URL que termina en /exec (Implementar → Gestionar implementaciones → Aplicación web). La que termina en /dev NO sirve para Meta. Desde el editor se ve: ' + ScriptApp.getService().getUrl());
  const waba = PropertiesService.getScriptProperties().getProperty('WA_WABA_ID');
  if (waba) { const s = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + waba + '/subscribed_apps', { method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + W.token } }); console.log('Suscripción de la cuenta de WhatsApp a la app → HTTP ' + s.getResponseCode() + ' · ' + s.getContentText()); }
  else console.log('Falta WA_WABA_ID (WhatsApp Business Account ID, en API Setup). Sin suscribir la cuenta, Meta no manda los mensajes al webhook.');
  const P = PropertiesService.getScriptProperties();
  console.log('Notas de voz: ' + (P.getProperty('GEMINI_KEY') ? 'Gemini' : P.getProperty('OPENAI_KEY') ? 'Whisper (OpenAI)' : 'SIN TRANSCRIPTOR · agrega GEMINI_KEY u OPENAI_KEY'));
  DriveApp.getRootFolder();   // pide el permiso de Drive para guardar fotos
  hojaWA_(); hojaInbox_();
}

/* ═══ Daño reportado por un huésped → Reporte de Daños en EPI (tag "Reporte de huésped by ALMA") ═══
   Detección por texto (no es un prompt): el huésped dice que algo se rompió, está dañado, gotea, etc.
   Un reporte por reserva y día, para no duplicar si el huésped escribe varias veces. */
const EPI_API_URL = 'https://script.google.com/macros/s/AKfycbxzYpBaTI_1S0VepOi810zrzB-fyC4R2Flug0ZEOOxNzZ9F7CLiSWaKXEtk1C17sfsX/exec';
const RX_DANO_ = /(se (me )?(rompi|quebr|da[ñn]|cay[oó]|desprendi|zaf)|est[aá] (rot[oa]|quebrad[oa]|da[ñn]ad[oa]|descompuest[oa])|rot[oa]s?\b|quebrad[oa]s?\b|da[ñn](o|os|ado|ada)\b|fuga|gotera|gotea|inund|mancha(do|da|s)?\b|no (sirve|funciona|enciende|prende|calienta|enfr[ií]a)|descompuest|broken|damaged|\bleak|stain|not working|doesn'?t work)/i;
function reporteDanoEpi_(ctx) {
  const txt = String(ctx.texto || '').trim();
  if (!txt || !RX_DANO_.test(txt)) return false;
  const hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');
  const clave = 'dano:' + String(ctx.resId || ctx.codigo || ctx.huesped || '') + ':' + hoy;
  if (vGet_(clave)) return false;
  const fotos = (Array.isArray(ctx.fotos) ? ctx.fotos : []).filter(function (u) { return /^https?:/i.test(String(u || '')); }).slice(0, 6);
  const id = Date.now(), etiqueta = 'Reporte de huésped by ALMA';
  const rep = {
    id: id, createdAt: id, categoria: 'Reporte de Daños', propiedad: ctx.propiedad || '', fecha: hoy, reportadoPor: 'ALMA',
    descripcion: 'Daño 1: ' + txt.slice(0, 900),
    comentarios: etiqueta + ' · ' + (ctx.huesped || 'Huésped') + (ctx.codigo ? ' · reserva ' + ctx.codigo : '') + (ctx.razon ? ' · ' + ctx.razon : ''),
    tag: etiqueta, etiqueta: etiqueta, origen: 'ALMA', reservaCodigo: ctx.codigo || '', huesped: ctx.huesped || '',
    total: '', paid: false, pagadoPor: '', fotoAntes: fotos, fotoDespues: [], factura: null,
    danios: [{ desc: txt.slice(0, 900), fotos: fotos, origen: etiqueta, reparacion: '', comentarios: '', fotos2: [], cobrado: false, quienPaga: '' }],
    hayDanios: true
  };
  const r = UrlFetchApp.fetch(EPI_API_URL, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify({ action: 'saveReport', data: rep, robot: llaveRobot_() }), muteHttpExceptions: true, followRedirects: true });
  const ok = r.getResponseCode() < 300 && !/"ok"\s*:\s*false/.test(r.getContentText() || '');
  if (ok) { vSet_(clave, String(id)); ctx.razon = (ctx.razon ? ctx.razon + ' · ' : '') + 'reporte de daño creado en EPI'; }
  else console.warn('EPI saveReport respondió ' + r.getResponseCode() + ': ' + String(r.getContentText() || '').slice(0, 200));
  return ok;
}

/* ═══ Apelación de reseñas negativas (Airbnb) ═══
   El criterio y el formato viven en ALMA_INSTRUCCIONES → APELACION (editable desde el hub). */
function hubApelacion_(review, contexto, ajuste, previo) {
  if (!review) return { ok: false, error: 'falta la reseña' };
  const user = 'RESEÑA (JSON):\n' + JSON.stringify(review) + '\n\nCONTEXTO DEL EQUIPO:\n' + (String(contexto || '').trim() || '(ninguno)') +
    (previo ? '\n\nMENSAJE ACTUAL PARA AIRBNB (ajústalo, conserva lo que funciona):\n' + previo + '\n\nAJUSTE QUE PIDE EL EQUIPO:\n' + (ajuste || '(ninguno)') : '');
  const txt = claude_(CFG.MODELO_REDACTOR, 1400, prompt_('APELACION'), user, 0.2);
  if (!txt) return { ok: false, error: 'sin respuesta del modelo' };
  try { const m = String(txt).match(/\{[\s\S]*\}/); const j = JSON.parse(m ? m[0] : txt); return { ok: true, data: j }; }
  catch (e) { return { ok: false, error: 'respuesta sin formato', texto: String(txt).slice(0, 2000) }; }
}

/* ═══ Respuesta pública a reseñas (Hospitable v2: POST /reviews/{uuid}/respond · Airbnb y Booking · scope reviews:write) ═══ */
function hubRespuestaReview_(review, contexto, ajuste, previo) {
  if (!review) return { ok: false, error: 'falta la reseña' };
  const user = 'RESEÑA (JSON):\n' + JSON.stringify(review) + '\n\nCONTEXTO DEL EQUIPO:\n' + (String(contexto || '').trim() || '(ninguno)') +
    (previo ? '\n\nRESPUESTA ACTUAL (ajústala):\n' + previo + '\n\nAJUSTE:\n' + (ajuste || '') : '');
  const txt = claude_(CFG.MODELO_REDACTOR, 500, prompt_('RESPUESTA_REVIEW') + estilo_(), user, 0.4);
  return txt ? { ok: true, texto: String(txt).trim() } : { ok: false, error: 'sin respuesta del modelo' };
}
function hubPublicarRespuesta_(uuid, texto) {
  uuid = String(uuid || '').replace(/^h_/, ''); texto = String(texto || '').trim();
  if (!uuid || !texto) return { ok: false, error: 'faltan datos' };
  const r = hosp_('post', '/reviews/' + uuid + '/respond', { response: texto });
  if (r && r.code >= 200 && r.code < 300) return { ok: true };
  const msg = r && r.json && (r.json.message || r.json.error) || '';
  return { ok: false, error: r && (r.code === 403 || r.code === 401) ? 'El token de Hospitable no tiene el permiso reviews:write. Genera uno nuevo marcando Reviews (escritura).' : r && r.code === 422 ? 'Hospitable no permite responder esta reseña (ya tiene respuesta, plataforma no compatible o venció el plazo).' : 'Hospitable respondió ' + (r && r.code) + (msg ? ': ' + msg : '') };
}

/* ═══ Review del anfitrión al huésped vía API (Hospitable, abril 2026): GET /guest-reviews y POST /guest-reviews/{id}/submit.
   Se busca el review programado de la reserva y se publica con nuestro texto (o con delay hasta el final del periodo). ═══ */
function guestReviewDe_(resId) {
  resId = String(resId || '').replace(/^inq:/, ''); if (!resId) return null;
  const c = CacheService.getScriptCache(), k = 'gr_' + resId, hit = c.get(k); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const resDe = r => String((r.reservation && (r.reservation.id || r.reservation.uuid)) || r.reservation_id || r.reservation_uuid || (r.relationships && r.relationships.reservation && r.relationships.reservation.data && r.relationships.reservation.data.id) || '');
  for (let p = 1; p <= 4; p++) {
    const r = hosp_('get', '/guest-reviews?status=all&per_page=100&page=' + p);
    if (!r || r.code !== 200) return { error: r && (r.code === 401 || r.code === 403) ? 'permiso' : 'http ' + (r && r.code) };
    const lista = (r.json && r.json.data) || [];
    const hit2 = lista.find(x => resDe(x) === resId);
    if (hit2) { try { c.put(k, JSON.stringify(hit2), 300); } catch (e) {} return hit2; }
    if (lista.length < 100) break;
  }
  return null;
}
function textoGR_(r) {
  const a = r || {}, at = a.attributes || {};
  const cand = [a.public_review, a.review, a.text, a.content, a.draft, a.resolved_text, a.body, a.public && a.public.review, at.public_review, at.review, at.text, at.content];
  for (let i = 0; i < cand.length; i++) if (typeof cand[i] === 'string' && cand[i].trim()) return cand[i].trim();
  return '';
}
function hubGuestReview_(resId) {
  if (!resId) return { ok: false, error: 'sin reserva' };
  const r = guestReviewDe_(resId);
  if (!r) return { ok: true, existe: false };
  if (r.error) return { ok: false, error: r.error === 'permiso' ? 'El token de Hospitable no tiene permiso de reviews (lectura y escritura).' : 'Hospitable respondió ' + r.error };
  const st = String(r.status || (r.attributes && r.attributes.status) || '').toLowerCase();
  return { ok: true, existe: true, id: r.id || r.uuid, estado: st, texto: textoGR_(r), expira: r.expires_at || '', programado: r.scheduled_at || r.send_at || '',
    recomienda: r.recommend != null ? !!r.recommend : r.recommended != null ? !!r.recommended : null, campos: Object.keys(r).join(',') };
}
function hubEnviarReview_(resId, texto, recomendar, privado, delay) {
  texto = String(texto || '').trim(); if (!texto) return { ok: false, error: 'El review está vacío.' };
  const r = guestReviewDe_(resId);
  if (!r) return { ok: false, error: 'Hospitable no tiene un review programado para esta reserva (o ya venció).' };
  if (r.error) return { ok: false, error: r.error === 'permiso' ? 'El token de Hospitable no tiene permiso reviews:write.' : 'Hospitable respondió ' + r.error };
  const st = String(r.status || '').toLowerCase();
  if (st && st !== 'pending') return { ok: false, error: st === 'sent' ? 'Este review ya se publicó; ya no se puede cambiar desde aquí.' : 'Este review está ' + st + '.' };
  const rec = !(recomendar === false || recomendar === 'no');
  /* Nombres de campo: se mandan los que usa el registro de Hospitable; los que no aplican se ignoran. */
  const body = { public_review: texto, review: texto, text: texto, content: texto, recommend: rec, recommended: rec, delay_publication: !!delay };
  if (privado) { body.private_feedback = String(privado); body.private_review = String(privado); }
  const out = hosp_('post', '/guest-reviews/' + (r.id || r.uuid) + '/submit', body);
  CacheService.getScriptCache().remove('gr_' + String(resId).replace(/^inq:/, ''));
  if (out && out.code >= 200 && out.code < 300) {
    const d = (out.json && out.json.data) || out.json || {}, pub = textoGR_(d);
    return { ok: true, delay: !!delay, textoAplicado: !pub || pub.slice(0, 60) === texto.slice(0, 60) };
  }
  const msg = out && out.json && (out.json.message || out.json.error) || '';
  return { ok: false, error: out && (out.code === 401 || out.code === 403) ? 'El token de Hospitable no tiene permiso reviews:write. Genera uno nuevo con Reviews (escritura).' : 'Hospitable respondió ' + (out && out.code) + (msg ? ': ' + msg : '') + '. Tu texto sigue aquí; el borrador de Hospitable no se tocó.' };
}

/* ═══ Review al huésped (texto personalizado; se publica pegándolo en el review programado de Hospitable) ═══ */
function hubReviewHuesped_(resId, recomendar, contexto, ajuste, previo) {
  if (!resId) return { ok: false, error: 'Esta conversación no tiene reserva' };
  const hc = hiloConv_(resId), hilo = (hc && hc.hilo) || [];
  const lineas = hilo.slice(-50).map(function (m) { return '[' + (String(m.tipo || m.sender_type || m.sender || '').indexOf('guest') >= 0 ? 'HUÉSPED' : 'SPACIO AM') + '] ' + String(m.texto || m.body || m.text || '').slice(0, 600); }).join('\n');
  const user = 'RECOMENDAR: ' + (recomendar === false || recomendar === 'no' ? 'no' : 'sí') + '\nCONTEXTO DEL EQUIPO: ' + (String(contexto || '').trim() || '(ninguno)') + '\n\nHILO:\n' + (lineas || '(sin mensajes)') +
    (previo ? '\n\nREVIEW ACTUAL (ajústalo):\n' + previo + '\n\nAJUSTE:\n' + (ajuste || '') : '');
  const txt = claude_(CFG.MODELO_REDACTOR, 500, prompt_('REVIEW_HUESPED'), user, 0.4);
  return txt ? { ok: true, texto: String(txt).trim() } : { ok: false, error: 'sin respuesta del modelo' };
}


/* ═══════════════════════════════ 12. CHAT OPERATIVO ═══════════════════════════════
   Un chat por administrador con ALMA. Entra por su WhatsApp registrado (Control de usuarios) o desde el hub
   (tap en la foto de ALMA). No aparece en la lista general de conversaciones: vive en ALMA_OPERATIVO.
   ALMA responde, toma notas y ejecuta: crear/cerrar/comentar tareas del equipo (Epi · hubTareas) y agendar trabajos en Epi (schedules).
   Hoy solo administradores; técnicos y socios quedan para después (OP_ROLES). */
const OP_CAB_ = ['ts', 'usuario', 'nombre', 'de', 'canal', 'texto', 'acciones', 'id'];
const EPI_URL_DEF_ = 'https://script.google.com/macros/s/AKfycbxzYpBaTI_1S0VepOi810zrzB-fyC4R2Flug0ZEOOxNzZ9F7CLiSWaKXEtk1C17sfsX/exec';
const SEMILLA_OPERATIVO_ = "Eres ALMA, la asistente operativa interna de Spacio AM (hospitalidad boutique en Guatemala). Hablas con un ADMINISTRADOR del equipo, no con un huésped. Tono: directo, cálido, de tú, frases cortas, sin emoji, sin despedidas ni firma. Primero el dato, luego el contexto.\n\nPUEDES:\n· Responder preguntas usando el contexto que te damos (tareas abiertas, programa de Epi, propiedades, equipo).\n· Crear tareas del equipo, cerrarlas o comentarlas.\n· Agendar un trabajo en Epi (limpieza, limpieza profunda, mantenimiento, supervisión) en una propiedad y fecha.\n· Guardar una nota para recordar algo (preferencias, acuerdos, datos que te piden recordar).\n\nREGLAS:\n· Solo ejecutas lo que se pide claro. Si falta un dato imprescindible (propiedad, fecha), pregunta en una sola frase y no ejecutes.\n· Fechas relativas (hoy, mañana, el viernes) se convierten a YYYY-MM-DD con la fecha de HOY que te damos.\n· La propiedad debe ser una de la lista, escrita igual. Para tareas, quien es un nombre de la lista del equipo o vacío.\n· Confirma en la respuesta lo que hiciste, en una línea por acción.\n· Nunca inventes datos de reservas, códigos ni montos.\n\nDevuelve SOLO JSON:\n{\"respuesta\":\"texto para el administrador\",\"acciones\":[{\"tipo\":\"tarea\",\"texto\":\"\",\"prop\":\"\",\"quien\":\"\",\"vence\":\"YYYY-MM-DD\",\"nota\":\"\"},{\"tipo\":\"hecha\",\"id\":\"\"},{\"tipo\":\"comentario\",\"id\":\"\",\"texto\":\"\"},{\"tipo\":\"epi\",\"fecha\":\"YYYY-MM-DD\",\"hora\":\"HH:MM\",\"propiedad\":\"\",\"trabajo\":\"Limpieza|Limpieza Profunda|Mantenimiento|Supervisión\",\"tecnico\":\"\",\"notas\":\"\"},{\"tipo\":\"nota\",\"texto\":\"\"}]}\nSi no hay nada que ejecutar, acciones es [].";
let OP_ADM_ = null;
function hojaOp_() { return hojaCrear_('ALMA_OPERATIVO', OP_CAB_); }
function opActivo_() { return String(PropertiesService.getScriptProperties().getProperty('OP_ACTIVO') || '1') !== '0'; }
function epiUrl_() { return PropertiesService.getScriptProperties().getProperty('EPI_URL') || EPI_URL_DEF_; }
/* Administradores con acceso al hub, desde Control de usuarios: correo, nombre, teléfonos y si es principal. Cacheado 30 min. */
function adminsOp_() {
  if (OP_ADM_) return OP_ADM_;
  const cache = CacheService.getScriptCache(), c0 = cache.get('op_admins3');
  if (c0) { try { return (OP_ADM_ = JSON.parse(c0)); } catch (e) {} }
  const out = [], norm = k => String(k).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lleno = x => { const t = norm(x); return !!t && t !== 'no' && t !== 'false' && t !== '0'; };
  try {
    SpreadsheetApp.openById(SHEET_ACCESOS_ID).getSheets().forEach(sh => {
      const v = sh.getDataRange().getDisplayValues(); if (v.length < 2) return;
      const cab = v[0].map(norm);
      const ce = cab.findIndex(x => /^(email|correo|usuario|mail)/.test(x)), cn = cab.findIndex(x => /^(nombre|name)/.test(x));
      const cr = cab.findIndex(x => /^(rol|role|perfil|tipo_usuario)$/.test(x)), ch = cab.findIndex(x => x.replace(/\s+/g, '_') === 'perm_hub');
      const tels = cab.map((c, i) => /^(telefono|telefonos|tel|celular|whatsapp|phone|movil)$/.test(c) ? i : -1).filter(i => i >= 0);
      const cEst = cab.findIndex(x => /^(estado|activo|active)$/.test(x));
      const cAlt = cab.findIndex(x => /alterno/.test(x));   // correo alterno: la misma persona en otras apps (p. ej. The Gentle Stoic Parent)
      /* Control de usuarios unificado: el rol vive en columnas perm_<app> (admin_principal, admin, tecnico…). */
      const cPerm = cab.map((x, i) => /^perm_/.test(x.replace(/\s+/g, '_')) ? i : -1).filter(i => i >= 0);
      if (ce < 0 || (cr < 0 && ch < 0 && !cPerm.length)) return;
      v.slice(1).forEach(r => {
        if (cEst >= 0 && /inactiv|baja|bloque|suspend|^no$|false/.test(norm(r[cEst]))) return;
        const perms = cPerm.map(i => norm(r[i])).join(' ');
        const rol = ((cr >= 0 ? norm(r[cr]) : '') + ' ' + perms).trim(), email = String(r[ce] || '').trim().toLowerCase();
        if (!email || !(/admin/.test(rol) || (ch >= 0 && lleno(r[ch]) && !/propietari|socio|tecnic|proveedor/.test(rol)))) return;
        if (out.some(a => a.email === email)) return;
        out.push({ email: email, alternos: cAlt >= 0 ? String(r[cAlt] || '').toLowerCase().split(/[\s,;]+/).filter(Boolean) : [], nombre: cn >= 0 ? String(r[cn]).trim() : email.split('@')[0], tels: [].concat.apply([], tels.map(i => telsDe_(r[i]))), principal: /^admin$|principal/.test(rol) || /admin_principal/.test(rol) });
      });
    });
  } catch (e) { console.error('adminsOp_: ' + e); }
  try { cache.put('op_admins3', JSON.stringify(out), 1800); } catch (e) {}
  return (OP_ADM_ = out);
}
function adminPorTel_(wa) { const k = fin8_(wa); return adminsOp_().find(a => a.tels.some(t => fin8_(t) === k)) || null; }
function adminPorEmail_(email) { email = String(email || '').trim().toLowerCase(); return adminsOp_().find(a => a.email === email) || (email ? { email: email, nombre: nombreAcceso_(email) || email.split('@')[0], tels: [], principal: false } : null); }
function opFilas_(email, n) {
  const sh = hojaOp_(), last = sh.getLastRow(); if (last < 2) return [];
  const desde = Math.max(2, last - 2999), v = sh.getRange(desde, 1, last - desde + 1, OP_CAB_.length).getValues();
  return v.map(r => ({ ts: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), usuario: String(r[1]), nombre: String(r[2]), de: String(r[3]), canal: String(r[4]), texto: String(r[5]),
    acciones: (() => { try { return r[6] ? JSON.parse(r[6]) : []; } catch (e) { return []; } })(), id: String(r[7]) }))
    .filter(m => !email || m.usuario === email).slice(-(n || 3000));
}
function opGuardar_(adm, de, canal, texto, acciones) {
  const id = 'op' + Date.now() + Math.floor(Math.random() * 1000), ts = new Date().toISOString();
  const tx = String(texto || '').slice(0, 4000);
  hojaOp_().appendRow([ts, adm.email, adm.nombre, de, canal, /^[=+\-@]/.test(tx) || /^\d[\d\s.]*$/.test(tx) ? "'" + tx : tx, acciones && acciones.length ? JSON.stringify(acciones) : '', id]);
  return { ts: ts, id: id, de: de, canal: canal, texto: String(texto || ''), acciones: acciones || [] };
}
/* Llave del robot: Epi y Hola reconocen así las llamadas del Hub (servidor a servidor, sin sesión de una persona). */
function llaveRobot_() { return PropertiesService.getScriptProperties().getProperty('ROBOT_TOKEN') || undefined; }
/* Fase 1c: resumen de ACCESOS de cada backend (qué acciones llegan con sesión, sin ella o del robot), para decidir
   qué bloquear antes de encender SESION_EXIGIR. Solo lectura; la llave del robot no sale del Hub. Robot: dsBot · «accesos_apps». */
const ACCESOS_APPS_ = {
  epi: () => epiUrl_(), hola: () => holaUrl_(),
  mi: () => 'https://script.google.com/macros/s/AKfycbzqUTv_0NuNBVRXhlfHGaS5RdWKjBAmfA-dIsdDnMLbl2aE2PriEXNWw3qCi8yPF28qaQ/exec',
  grow: () => 'https://script.google.com/macros/s/AKfycbxPYwdz0Q8za7_wZzX37QeqODoqwxOeoXZpeEWp94HKtHMqru12VPD4xt0cOtWHZA1LDQ/exec',
  docs: () => 'https://script.google.com/macros/s/AKfycbz2_KDtQ5Wm8LRiyEwCXxsHx_DtE4pe2b_aJlLFrN0zu7UvLrnh2PM-6VzbEf00oekW_Q/exec'
};
function accesosApps_() {
  const llave = llaveRobot_(); if (!llave) return { ok: false, error: 'falta ROBOT_TOKEN en el Hub' };
  const apps = Object.keys(ACCESOS_APPS_);
  const rs = UrlFetchApp.fetchAll(apps.map(app => ({ url: ACCESOS_APPS_[app](), method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: JSON.stringify({ action: '__accesos', token: llave }) })));
  const out = { ok: true, apps: {} };
  apps.forEach((app, i) => {
    try { const j = JSON.parse(rs[i].getContentText() || '{}'); out.apps[app] = j.ok ? j.accesos : { error: j.error || 'HTTP ' + rs[i].getResponseCode() }; }
    catch (e) { out.apps[app] = { error: 'HTTP ' + rs[i].getResponseCode() + ': respuesta no es JSON' }; }
  });
  return out;
}
function epiPost_(action, payload) {
  const r = UrlFetchApp.fetch(epiUrl_(), { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: JSON.stringify(Object.assign({ action: action, robot: llaveRobot_() }, payload || {})) });
  if (r.getResponseCode() >= 300) throw new Error('Epi HTTP ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText() || '{}'); if (j && j.ok === false) throw new Error('Epi: ' + (j.error || 'rechazó'));
  return j;
}
const lista_ = x => { if (Array.isArray(x)) return x; try { const p = JSON.parse(x); return Array.isArray(p) ? p : []; } catch (e) { return []; } };
function epiCfg_() { const j = epiPost_('getConfig', { slim: true }), d = j.data || j; return { tareas: lista_(d.hubTareas), schedules: lista_(d.schedules), vendors: lista_(d.vendors), props: lista_(d.props) }; }
const propNombre_ = p => String((p && (p.nombre || p.name || p.propiedad || p.id)) || p || '').trim();
const vendNombre_ = v => String((v && (v.nombre || v.name || v.email)) || '').trim();
function opMatch_(txt, lista) {
  const n = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(), t = n(txt); if (!t) return '';
  return lista.find(x => n(x) === t) || lista.find(x => n(x).indexOf(t) >= 0) || lista.find(x => t.indexOf(n(x)) >= 0 && n(x).length > 3) || bqMejor_(txt, lista) || '';
}
/* Un mensaje del administrador (WhatsApp o hub): se guarda, ALMA responde con el contexto real y ejecuta lo que pidió. */
function opProcesar_(adm, texto, canal, fotos, nota) {
  texto = String(texto || '').trim(); if (!adm || !texto) return { ok: false, error: 'faltan datos' };
  const yo = opGuardar_(adm, 'yo', canal, texto);
  const pedido = nota ? nota + '\n\n' + texto : texto;   // la nota es solo para ALMA: el chat guarda lo que escribió
  let cfg = { tareas: [], schedules: [], vendors: [], props: [] }, errEpi = '';
  try { cfg = epiCfg_(); } catch (e) { errEpi = String(e.message || e); console.error('op epi: ' + e); }
  const hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), dia = Utilities.formatDate(ahora_(), CFG.TZ, 'EEEE HH:mm');
  const props = cfg.props.map(propNombre_).filter(Boolean), equipo = adminsOp_().map(a => a.nombre).concat(cfg.vendors.map(vendNombre_)).filter(Boolean);
  const abiertas = cfg.tareas.filter(t => t && t.id && !t.hecha).slice(0, 40);
  const prox = cfg.schedules.filter(s => s && String(s.fecha || '') >= hoy && String(s.estado || '') !== 'cancelado').sort((a, b) => String(a.fecha + a.hora).localeCompare(String(b.fecha + b.hora))).slice(0, 30);
  const previos = opFilas_(adm.email, 60).filter(m => m.id !== yo.id);   // incluye los turnos de las llamadas
  const notas = previos.filter(m => m.acciones.some(a => a.tipo === 'nota')).map(m => m.acciones.filter(a => a.tipo === 'nota').map(a => '· ' + a.texto).join('\n'));
  const user = 'HOY: ' + hoy + ' (' + dia + ', Guatemala)\nADMINISTRADOR: ' + adm.nombre + (adm.principal ? ' (admin principal)' : '') +
    '\nCANAL: ' + (canal === 'whatsapp' ? 'WhatsApp: responde breve' : 'hub') + (errEpi ? '\nAVISO: no se pudo leer Epi (' + errEpi + '). No ejecutes acciones de Epi ni de tareas; dilo.' : '') +
    '\n\nPROPIEDADES:\n' + (props.join(' | ') || '(sin datos)') + '\n\nEQUIPO:\n' + (equipo.join(' | ') || '(sin datos)') +
    '\n\nTAREAS ABIERTAS (id · texto · propiedad · quién · vence):\n' + (abiertas.map(t => [t.id, t.texto, t.prop || '-', t.quien || '-', t.vence || '-'].join(' · ')).join('\n') || '(ninguna)') +
    '\n\nPROGRAMA DE EPI (próximos):\n' + (prox.map(s => [s.fecha, s.hora, s.tipo, s.propiedad, s.vendorRaw || s.vendorEmail || ''].join(' · ')).join('\n') || '(vacío)') +
    '\n\nNOTAS QUE GUARDASTE:\n' + (notas.join('\n') || '(ninguna)') +
    (() => {
      /* Solo cuenta como conversación activa lo de las últimas 6 h. Lo anterior es historial cerrado: no se retoma salvo que lo pida. */
      const corte = Date.now() - 6 * 3600000, quien = m => (m.de === 'yo' ? adm.nombre.split(' ')[0].toUpperCase() : 'ALMA') + ': ' + m.texto;
      const viejos = previos.filter(m => new Date(m.ts).getTime() < corte).slice(-8), nuevos = previos.filter(m => new Date(m.ts).getTime() >= corte).slice(-16);
      return (viejos.length ? '\n\nHISTORIAL ANTERIOR (ya cerrado; NO lo retomes ni respondas preguntas viejas salvo que el mensaje nuevo lo pida):\n' + viejos.map(quien).join('\n') : '') +
        '\n\nCONVERSACIÓN ACTIVA (últimas 6 h):\n' + (nuevos.map(quien).join('\n') || '(empieza aquí: si solo saluda, salúdalo y pregúntale en qué le ayudas)');
    })() +
    '\n\nMENSAJE NUEVO:\n' + pedido;
  let r = {}, hechas = [];
  if (opAgenteActivo_()) {
    /* ALMA secretaria: herramientas reales con permisos por rol (agente.js). */
    try { const ag = opAgente_(adm, pedido, canal, fotos || [], previos); r = { respuesta: ag.respuesta }; hechas = ag.hechas; }
    catch (e) { console.error('opAgente_: ' + (e.stack || e)); r = { respuesta: 'Tuve un problema procesando tu mensaje. Intenta de nuevo.' }; }
  } else {
    const raw = claude_(CFG.MODELO_REDACTOR, 900, prompt_('OPERATIVO'), user, 0.2, fotos || []);
    try { r = JSON.parse(String(raw).match(/\{[\s\S]*\}/)[0]); } catch (e) { r = { respuesta: s_(raw) || 'No pude procesarlo. Intenta de nuevo.', acciones: [] }; }
    hechas = errEpi ? [] : opEjecutar_(adm, Array.isArray(r.acciones) ? r.acciones : [], cfg, props);
  }
  let resp = formatearMensaje_(s_(r.respuesta) || (hechas.length ? 'Listo.' : 'Entendido.'));
  const fallidas = hechas.filter(a => a.error); if (fallidas.length) resp += '\n\n' + fallidas.map(a => 'No se pudo: ' + a.resumen + ' (' + a.error + ')').join('\n');
  const alma = opGuardar_(adm, 'alma', canal, resp, hechas);
  if (canal === 'whatsapp' && adm.tels.length) waEnviar_(adm.wa || adm.tels[0], resp);
  return { ok: true, yo: yo, alma: alma };
}
/* WhatsApp del administrador: ALMA espera OP_AGRUPAR_SEG (20 s) de silencio y responde una sola vez a todo el bloque.
   Así, varios mensajes reenviados de otro chat más la instrucción del final se leen como un solo pedido. Mientras esperan,
   viven en ALMA_WHATSAPP con autor «operativo_pend»; opWaPronto (o el disparador de cada minuto) los junta y los procesa. */
function opAgruparSeg_() { const n = Number(PropertiesService.getScriptProperties().getProperty('OP_AGRUPAR_SEG')); return n >= 5 && n <= 120 ? n : 20; }
function opWaProgramar_(seg) {
  try {
    if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'opWaPronto')) return;
    ScriptApp.newTrigger('opWaPronto').timeBased().after((seg || opAgruparSeg_()) * 1000 + 2000).create();
  } catch (e) { console.error('opWaProgramar_: ' + e); }
}
function opWaPronto() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'opWaPronto').forEach(t => ScriptApp.deleteTrigger(t));
  opWaProcesar_();
}
function opWaProcesar_() {
  const props = PropertiesService.getScriptProperties(); if (props.getProperty('OP_WA_PEND') !== '1') return;
  /* Candado corto en caché: la cola de huéspedes tiene el de script ocupado mucho rato y esto no puede esperarla. */
  const cache = CacheService.getScriptCache(), yo = Utilities.getUuid();
  if (cache.get('opwa_lock')) { opWaProgramar_(10); return; }
  cache.put('opwa_lock', yo, 30); Utilities.sleep(300);
  if (cache.get('opwa_lock') !== yo) { opWaProgramar_(10); return; }
  const listos = []; let falta = 0;
  try {
    const sh = hojaWA_(), n = sh.getLastRow(); if (n < 2) return;
    const desde = Math.max(2, n - 299), v = sh.getRange(desde, 1, n - desde + 1, WA_CAB_.length).getValues(), grupos = {};
    v.forEach((r, i) => { if (s_(r[8]) === 'operativo_pend') (grupos[s_(r[6])] = grupos[s_(r[6])] || []).push({ fila: desde + i, r: r }); });
    const espera = opAgruparSeg_() * 1000;
    Object.keys(grupos).forEach(conv => {
      const g = grupos[conv], quedan = Math.max.apply(null, g.map(x => new Date(x.r[0]).getTime() || 0)) + espera - Date.now();
      if (quedan > 0) { falta = Math.max(falta, quedan); return; }
      g.forEach(x => sh.getRange(x.fila, 9).setValue('operativo'));
      listos.push(g);
    });
    SpreadsheetApp.flush();
    if (!falta) props.deleteProperty('OP_WA_PEND');
  } finally { if (cache.get('opwa_lock') === yo) cache.remove('opwa_lock'); }
  if (falta) opWaProgramar_(Math.ceil(falta / 1000));
  listos.forEach(g => {
    const wa = s_(g[g.length - 1].r[1]), email = s_(g[0].r[6]).slice(3);
    const adm = adminsOp_().find(a => a.email === email) || adminPorTel_(wa);
    if (!adm) { console.error('opWaProcesar_: sin administrador para ' + email); return; }
    const textos = g.map(x => s_(x.r[4])).filter(Boolean);
    const nota = textos.length > 1 ? '(' + textos.length + ' mensajes seguidos por WhatsApp. Léelos juntos como un solo pedido y responde una vez: los marcados [reenviado] vienen de otro chat y suelen ser el material; la instrucción casi siempre va al final.)' : '';
    const fotos = [].concat.apply([], g.map(x => s_(x.r[9]).split(/\s+/))).filter(u => /thumbnail/.test(u));
    try { opProcesar_(Object.assign({}, adm, { wa: wa }), textos.join('\n\n'), 'whatsapp', fotos, nota); } catch (e) { console.error('opProcesar_: ' + e); waEnviar_(wa, 'No pude procesar tu mensaje. Intenta de nuevo en un momento.'); }
  });
}
function opEjecutar_(adm, acciones, cfg, props) {
  const out = [], hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), ymd = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? String(x) : '';
  let tareas = cfg.tareas.slice(), schedules = cfg.schedules.slice(), cambT = false, cambS = false;
  const lock = LockService.getScriptLock(); try { lock.waitLock(20000); } catch (e) {}
  try {
    acciones.slice(0, 8).forEach(a => {
      const t = String(a && a.tipo || '');
      if (t === 'tarea' && s_(a.texto)) {
        const o = { id: 'op' + Date.now() + out.length, texto: s_(a.texto).slice(0, 200), prop: opMatch_(a.prop, props) || '', quien: s_(a.quien).slice(0, 60), vence: ymd(a.vence) || hoy, hecha: false, comentarios: [], subtareas: [], nota: s_(a.nota).slice(0, 500), origen: 'ALMA · ' + adm.nombre };
        tareas = [o].concat(tareas); cambT = true; out.push({ tipo: 'tarea', id: o.id, resumen: 'Tarea · ' + o.texto + (o.prop ? ' · ' + o.prop : '') + ' · vence ' + o.vence });
      } else if ((t === 'hecha' || t === 'comentario') && a.id) {
        const i = tareas.findIndex(x => x && String(x.id) === String(a.id));
        if (i < 0) { out.push({ tipo: t, resumen: 'Tarea ' + a.id, error: 'no la encontré' }); return; }
        const x = Object.assign({}, tareas[i]);
        if (t === 'hecha') { x.hecha = true; out.push({ tipo: 'hecha', id: x.id, resumen: 'Cerrada · ' + x.texto }); }
        else { x.comentarios = (x.comentarios || []).concat([{ quien: 'ALMA · ' + adm.nombre, texto: s_(a.texto).slice(0, 500), ts: new Date().toISOString() }]); out.push({ tipo: 'comentario', id: x.id, resumen: 'Comentario en · ' + x.texto }); }
        tareas[i] = x; cambT = true;
      } else if (t === 'epi') {
        const prop = opMatch_(a.propiedad, props), fecha = ymd(a.fecha);
        if (!prop || !fecha) { out.push({ tipo: 'epi', resumen: 'Agendar en Epi', error: !prop ? 'propiedad no reconocida' : 'falta la fecha' }); return; }
        const v = a.tecnico ? cfg.vendors.find(x => opMatch_(a.tecnico, [vendNombre_(x)])) : null;
        const trab = opMatch_(a.trabajo, ['Limpieza Profunda', 'Limpieza', 'Mantenimiento', 'Supervisión']) || 'Mantenimiento';
        const o = { id: 'alma_op_' + Date.now() + out.length, fecha: fecha, hora: /^\d{1,2}:\d{2}$/.test(String(a.hora || '')) ? a.hora : '10:00', propiedad: prop, vendorId: v ? String(v.id || '') : '', vendorEmail: v ? String(v.email || '') : '', vendorRaw: v ? vendNombre_(v) : '',
          tipo: trab, codigoAcceso: '', notas: ('ALMA · ' + adm.nombre + (a.notas ? ' · ' + s_(a.notas) : '')).slice(0, 300), origen: 'manual', estado: 'pendiente', motivo: '' };
        schedules = schedules.concat([o]); cambS = true; out.push({ tipo: 'epi', id: o.id, resumen: trab + ' · ' + prop + ' · ' + fecha + ' ' + o.hora + (o.vendorRaw ? ' · ' + o.vendorRaw : '') });
      } else if (t === 'nota' && s_(a.texto)) out.push({ tipo: 'nota', texto: s_(a.texto).slice(0, 500), resumen: 'Nota · ' + s_(a.texto).slice(0, 80) });
    });
    /* Se relee justo antes de guardar para no pisar cambios hechos en Epi o en el hub mientras ALMA pensaba. */
    if (cambT || cambS) {
      const fresco = epiCfg_();
      if (cambT) { const nuevas = tareas.filter(x => !cfg.tareas.some(y => y && y.id === x.id)), mod = {}; tareas.forEach(x => { mod[x.id] = x; });
        const base = fresco.tareas.map(x => x && mod[x.id] && cfg.tareas.some(y => y && y.id === x.id && JSON.stringify(y) !== JSON.stringify(mod[x.id])) ? mod[x.id] : x);
        try { epiPost_('saveConfig', { key: 'hubTareas', value: nuevas.concat(base) }); } catch (e) { out.forEach(o => { if (/tarea|hecha|comentario/.test(o.tipo)) o.error = String(e.message || e); }); } }
      if (cambS) { const nuevos = schedules.filter(x => !cfg.schedules.some(y => y && y.id === x.id));
        try { epiPost_('saveConfig', { key: 'schedules', value: fresco.schedules.concat(nuevos) }); } catch (e) { out.forEach(o => { if (o.tipo === 'epi') o.error = String(e.message || e); }); } }
    }
  } finally { try { lock.releaseLock(); } catch (e) {} }
  return out;
}
function hubOpHilo_(email, de) {
  const yo = adminPorEmail_(email); if (!yo) return { ok: false, error: 'usuario' };
  const objetivo = de && de !== yo.email ? (yo.principal || adminsOp_().length === 0 ? adminPorEmail_(de) : null) : yo;
  if (!objetivo) return { ok: false, error: 'solo el admin principal ve otros chats' };
  return { ok: true, usuario: objetivo.email, nombre: objetivo.nombre, tieneWA: objetivo.tels.length > 0, mensajes: opFilas_(objetivo.email, 200) };
}
function hubOpEnviar_(email, texto) {
  const adm = adminPorEmail_(email); if (!adm) return { ok: false, error: 'usuario' };
  return opProcesar_(adm, texto, 'hub', []);
}
/* Lista para el admin principal: un chat por administrador, con su último mensaje. */
function hubOpLista_(email) {
  const yo = adminPorEmail_(email); if (!yo || (!yo.principal && adminsOp_().some(a => a.principal))) return { ok: false, error: 'solo admin principal' };
  const filas = opFilas_('', 3000), ult = {}, n = {};
  filas.forEach(m => { ult[m.usuario] = m; n[m.usuario] = (n[m.usuario] || 0) + 1; });
  const lista = adminsOp_().map(a => ({ email: a.email, nombre: a.nombre, principal: a.principal, tieneWA: a.tels.length > 0, ultimo: ult[a.email] || null, total: n[a.email] || 0 }));
  Object.keys(ult).forEach(e => { if (!lista.some(x => x.email === e)) lista.push({ email: e, nombre: ult[e].nombre, principal: false, tieneWA: false, ultimo: ult[e], total: n[e] }); });
  lista.sort((a, b) => String(b.ultimo ? b.ultimo.ts : '').localeCompare(String(a.ultimo ? a.ultimo.ts : '')));
  return { ok: true, lista: lista };
}
/* Hilo operativo con la forma del hilo de huéspedes: ALMA a la izquierda (tipo guest), el administrador a la derecha (tipo host). */
function opHiloHub_(email) {
  const adm = adminPorEmail_(email), filas = opFilas_(String(email || '').toLowerCase(), 300);
  const ICON = { tarea: 'Tarea creada', hecha: 'Tarea cerrada', comentario: 'Comentario', epi: 'Agendado en Epi', nota: 'Nota guardada' };
  const out = filas.map(m => ({ tipo: m.de === 'alma' ? 'guest' : 'host', auto: false, alma: false, nombre: m.de === 'alma' ? 'ALMA' : (adm ? adm.nombre : ''), canal: m.canal === 'whatsapp' ? 'whatsapp' : 'hospitable',
    texto: m.texto + ((m.acciones || []).length ? '\n\n' + m.acciones.map(a => '· ' + (a.error ? 'No se pudo · ' : (ICON[a.tipo] || 'Hecho') + ' · ') + a.resumen + (a.error ? ' (' + a.error + ')' : '')).join('\n') : ''),
    created: m.ts, fotos: [] }));
  if (!out.length) {
    const n = adm ? String(adm.nombre || '').split(' ')[0] : '';
    out.push({ tipo: 'guest', auto: false, nombre: 'ALMA', canal: 'hospitable', created: new Date().toISOString(), fotos: [],
      texto: (n ? n + ', ¿en qué te ayudo?' : '¿En qué te ayudo?') + '\n\nPuedo crear tareas para el equipo, agendar trabajos en Epi, contarte qué hay en el programa o guardar una nota. Te confirmo cada acción aquí.' });
  }
  return out;
}

/* ═══════════════════════════════ 12. DESIGN SYSTEM · PROPUESTAS ═══════════════════
   La revisión automática (tarea programada de Claude, lunes y jueves) compara las seis apps con el
   design system (repo Spacio-am) y publica aquí sus propuestas. El administrador principal las ve
   en hub.spacioam.com/design-system.html y decide: estandarizar · solo esta app · revertir.
   La siguiente revisión lee esas decisiones, abre los cambios en GitHub y las marca como aplicadas.

   Hoja: pestaña DS_PROPUESTAS en la hoja de ALMA. Una fila por propuesta; la propuesta completa
   (incluidas sus vistas HTML) va en la columna json.
   La tarea programada se identifica con su propia llave (ver dsTokenOk_). */
const DS_TAB_ = 'DS_PROPUESTAS';
const DS_CAB_ = ['id', 'fecha', 'estado', 'titulo', 'app_origen', 'recomendacion', 'decision', 'nota', 'quien', 'decidido_en', 'aplicada_en', 'resultado', 'json'];
const DS_DECISIONES_ = ['estandarizar', 'solo esta app', 'revertir', 'descartar'];

function dsHoja_() {
  const sh = hojaCrear_(DS_TAB_, DS_CAB_);
  const cab = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(x => String(x).trim().toLowerCase());
  return { sh: sh, col: k => cab.indexOf(k) + 1 };
}
function dsFilas_() {
  const h = dsHoja_();
  return leerTablaHoja_(h.sh).map((r, i) => Object.assign(r, { _fila: i + 2 }));
}
function dsParse_(s) { try { return JSON.parse(String(s || '{}')); } catch (e) { return {}; } }
function dsFecha_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }

/* Hub · lista de propuestas (pendientes primero, después las últimas 60 resueltas). */
function dsPropuestas_() {
  const filas = dsFilas_().map(r => ({
    id: String(r.id), fecha: dsFecha_(r.fecha), estado: String(r.estado || 'pendiente'),
    decision: String(r.decision || ''), nota: String(r.nota || ''), quien: String(r.quien || ''),
    decidido_en: dsFecha_(r.decidido_en), aplicada_en: dsFecha_(r.aplicada_en), resultado: String(r.resultado || ''),
    propuesta: dsParse_(r.json)
  }));
  const pend = filas.filter(f => f.estado === 'pendiente');
  const resto = filas.filter(f => f.estado !== 'pendiente').sort((a, b) => (b.decidido_en || b.fecha).localeCompare(a.decidido_en || a.fecha)).slice(0, 60);
  return { ok: true, propuestas: pend.concat(resto) };
}

/* Hub · el administrador principal decide sobre una propuesta. Se puede cambiar mientras no esté aplicada. */
function dsDecidir_(id, decision, nota, quien) {
  decision = String(decision || '').toLowerCase().trim();
  if (DS_DECISIONES_.indexOf(decision) < 0) return { ok: false, error: 'decision' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const h = dsHoja_(), f = dsFilas_().find(r => String(r.id) === String(id));
    if (!f) return { ok: false, error: 'no existe' };
    if (String(f.estado) === 'aplicada') return { ok: false, error: 'ya aplicada' };
    const set = (k, v) => h.sh.getRange(f._fila, h.col(k)).setValue(v);
    set('estado', 'decidida'); set('decision', decision); set('nota', String(nota || '').slice(0, 2000));
    set('quien', String(quien || '').slice(0, 200)); set('decidido_en', new Date());
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* Tarea programada · publicar propuestas, leer decisiones y marcarlas como aplicadas. */
/* La llave del robot no se guarda en el código (el repo es público): solo su huella SHA-256.
   Si algún día se define la propiedad DS_BOT_TOKEN, también vale. */
const DS_BOT_HASH_ = 'b0d3ca9d3adb76025e4b4289181cb6300d7769a1d53a2a0c91636df9e0c65ed5';
function dsTokenOk_(t) {
  t = String(t || ''); if (!t) return false;
  const prop = PropertiesService.getScriptProperties().getProperty('DS_BOT_TOKEN');
  if (prop && t === prop) return true;
  const h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return h === DS_BOT_HASH_;
}
function dsBotApi_(body) {
  if (!dsTokenOk_(body.token)) return json_({ ok: false, error: 'token' });
  try {
    switch (body.action) {
      case 'publicar': return json_(dsPublicar_(body.propuestas || []));
      case 'decisiones': return json_({ ok: true, propuestas: dsFilas_().filter(r => String(r.estado) === 'decidida').map(r => ({ id: String(r.id), decision: String(r.decision), nota: String(r.nota || ''), quien: String(r.quien || ''), propuesta: dsParse_(r.json) })) });
      case 'todas': return json_(dsPropuestas_());
      case 'aplicada': return json_(dsAplicada_(body.id, body.resultado));
      case 'guardar_robot': PropertiesService.getScriptProperties().setProperty('ROBOT_TOKEN', String(body.token)); return json_({ ok: true });
      case 'recepcion_estado': return json_(recepcionEstado_());
      case 'anillo': return json_(anilloLeer_(body.n));
      case 'foto_estado': return json_(fotoEstado_());
      case 'foto_config': return json_(fotoConfig_(body));
      case 'foto_cambiar': try { return json_(fotoCambiar_(Number(body.foto) || 0)); } catch (e) { return json_({ ok: false, error: String(e) }); }
      case 'contacto_plantilla': return json_(contactoPlantillaCrear_());
      case 'personal_plantilla': return json_(personalPlantillaCrear_());
      case 'proy_asignar': return json_(proyAsignar_(adminsOp_().find(a => a.principal) || null, String(body.wa || ''), String(body.proyecto || ''), String(body.objetivo || '')));
      case 'proy_ver': return json_(proyVer_(String(body.proyecto || ''), !!body.actualizar, 'Juan'));
      case 'personal_objetivo': return json_(personalObjetivo_(String(body.wa || ''), String(body.objetivo || '')));
      case 'contacto_estado': CacheService.getScriptCache().remove('tpl_contacto'); return json_({ ok: true, aprobada: contactoPlantillaOk_(), personal: (CacheService.getScriptCache().remove('tpl_personal'), personalPlantillaOk_()), pendientes: Object.keys(JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_PEND') || '{}')).length });
      case 'recepcion_plantilla': return json_(recepcionPlantillaCrear_());
      case 'recepcion_probar': return json_(body.enviarYa || body.soloA ? recepcionEnviar_(String(body.code || ''), body.soloA || '') : recepcionEncolar_({ code: body.code, force: true }));
      case 'solo_sesion': {   // fase 1c: HUB_SOLO_SESION por el robot (el proyecto tiene más de 50 propiedades y la pantalla no deja agregarla)
        const pS = PropertiesService.getScriptProperties();
        if (body.valor === '1' || body.valor === '0') pS.setProperty('HUB_SOLO_SESION', body.valor);
        return json_({ ok: true, solo_sesion: pS.getProperty('HUB_SOLO_SESION') === '1' });
      }
      case 'accesos_apps': return json_(accesosApps_());   // fase 1c: ACCESOS de Epi, Hola, Mi, Grow y Docs
      case 'accesos': {   // diagnóstico de la fase 1b: última entrada con sesión firmada y con la llave antigua
        const p = PropertiesService.getScriptProperties();
        return json_({ ok: true, ultima_sesion: p.getProperty('HUB_ULTIMA_SESION') || '', ultima_llave: p.getProperty('HUB_ULTIMA_LLAVE') || '', solo_sesion: p.getProperty('HUB_SOLO_SESION') === '1' });
      }
      case 'voz_traza': return json_({ ok: true, traza: JSON.parse(CacheService.getScriptCache().get('voz_traza') || '[]'), sync: JSON.parse(PropertiesService.getScriptProperties().getProperty('VOZ_SYNC') || '{}') });
      case 'voz_sync': return json_({ voz: vozSyncPrompt_(true), familia: familiaSyncPrompt_(true) });
      case 'familia_sync': return json_(familiaSyncPrompt_(true));
      case 'voz_tools': return json_(vozHerramientas_(body.k));
      case 'voz_estado': return json_(vozEstado_());
      case 'voz_recoger': return json_(vozRecoger_(true));
      case 'voz_turnos': return json_(vozTurnos_(body.eagerness));
      case 'voz_inicio': return json_(vozConfigInicio_(body.k));
      case 'voz_inicio_off': return json_(vozInicioOff_());
      case 'voz_conv': return json_(vozConv_(body.n));
      case 'voz_transcript': return json_(vozTranscript_(body.id));
      case 'voz_llamar': return json_(vozLlamar_(body.tel, body.motivo || ''));
      case 'voz_permiso': return json_(vozPermiso_(body.tel));
      case 'prog_ultimos': { const shP = hojaWaProg_(), nP = shP.getLastRow(); return json_({ ok: true, filas: nP < 2 ? [] : shP.getRange(Math.max(2, nP - 9), 1, Math.min(10, nP - 1), WAPROG_CAB_.length).getValues().map(v => ({ id: v[0], creado: v[1], para: v[3], cuando: v[6], zona: v[7], estado: v[9], resultado: String(v[10]).slice(0, 120) })) }); }   // diagnóstico (sin textos)
      case 'qa_retenidos': { const shL = hoja_(CFG.TAB_LOG), nL = shL.getLastRow(), cab = LOG_HEADERS; const iA = cab.indexOf('accion'), iN = cab.indexOf('nivel'), iF = cab.indexOf('fecha'), iP = cab.indexOf('propiedad'); return json_({ ok: true, filas: nL < 2 ? [] : shL.getRange(Math.max(2, nL - 400), 1, Math.min(401, nL - 1), cab.length).getValues().filter(v => /RETENIDO|QA/.test(String(v[iA]))).slice(-15).map(v => ({ fecha: v[iF], propiedad: v[iP], nivel: v[iN], accion: String(v[iA]).slice(0, 300) })) }); }   // diagnóstico del control de calidad (sin textos de huéspedes)
      case 'voz_unir_pruebas': return json_(vozUnirPruebas_());   // una vez: las llamadas de prueba sin número pasan a la conversación del admin principal
      case 'mejora_reemplazar': return json_(mejoraReemplazar_(String(body.buscar || ''), String(body.nuevo || '')));
      case 'early_estado': { const shE = hojaEarly_(), nE = shE.getLastRow(); return json_({ ok: true, filas: nE < 2 ? [] : shE.getRange(Math.max(2, nE - 14), 1, Math.min(15, nE - 1), EARLY_CAB_.length).getValues().map(v => ({ propiedad: v[5], checkin: v[6], estado: v[10], resultado: v[11] })) }); }
      case 'contacto_cancelar': return json_(contactoCancelar_(String(body.tel || '')));
      case 'contacto_reenviar': return json_(contactoReenviar_(String(body.tel || ''), String(body.nombre || ''), String(body.texto || ''), String(body.plantilla || 'contacto')));
      case 'wa_diag': return json_(waDiag_());
      case 'op_rango': { const n0 = Math.min(400, Number(body.n) || 80); return json_({ ok: true, filas: opFilas_('', n0).filter(m => !body.desde || String(m.ts) >= String(body.desde)).map(m => ({ ts: m.ts, quien: m.de === 'yo' ? m.nombre : 'ALMA', canal: m.canal, texto: String(m.texto).slice(0, 600), acciones: m.acciones.map(x => (x.resumen || x.tipo) + (x.error ? ' ✗ ' + x.error : '')) })) }); }
      case 'contactos': return json_({ ok: true, contactos: contactosTodos_().map(c => ({ tel: '…' + String(c.tel).slice(-4), nombre: c.nombre, tipo: c.tipo, rol: c.rol, estado: c.estado, actualizado: String(c.actualizado).slice(0, 10) })) });
      case 'contactos_rellenar': return json_(contactosRellenar_());
      case 'para_claude': return json_(paraClaudeLista_(!!body.todos));
      case 'para_claude_marcar': return json_(paraClaudeMarcar_(body.id, body.estado, body.nota));
      case 'contacto_clasificar': return json_({ ok: true, ficha: contactoClasificar_(String(body.tel || ''), String(body.contexto || ''), true) });
      case 'encargos': { const shE = hojaEnc_(), nE = shE.getLastRow(); let pendE = {}; try { pendE = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_PEND') || '{}'); } catch (e) {} return json_({ ok: true, esperando: Object.keys(pendE).map(k => ({ tel: k, n: pendE[k].length, desde: new Date(pendE[k][0].ts).toISOString(), nombre: pendE[k][0].nombre })), filas: nE < 2 ? [] : shE.getRange(Math.max(2, nE - 14), 1, Math.min(15, nE - 1), ENC_CAB_.length).getValues().map(v => ({ id: v[0], creado: v[1], persona: v[4], estado: v[7], objetivo: String(v[6]).slice(0, 400), resumen: String(v[8]).slice(0, 200) })) }); }   // diagnóstico de encargos
      case 'op_ultimos': return json_({ ok: true, filas: opFilas_('', 12).map(m => ({ ts: m.ts, quien: m.de === 'yo' ? m.nombre : 'ALMA', canal: m.canal, texto: m.texto.slice(0, 400), acciones: m.acciones.map(x => (x.resumen || x.tipo) + (x.error ? ' ✗ ' + x.error : '')) })) });   // diagnóstico
      case 'diag_admin': { const tel = String(body.tel || ''), sh = ssAlma_().getSheetByName('ALMA_WHATSAPP'), n = sh.getLastRow(), v = sh.getRange(Math.max(2, n - 400), 1, Math.min(400, n - 1), WA_CAB_.length).getValues().filter(r => fin8_(r[1]) === fin8_(tel)).slice(-8);
        const a = adminPorTel_(tel); return json_({ ok: true, admin: a ? { nombre: a.nombre, principal: a.principal, tels: a.tels.length } : null, admins: adminsOp_().map(x => x.nombre + (x.principal ? ' (principal)' : '') + ' · tels ' + x.tels.length),
          op_activo: opActivo_(), prueba: String(PropertiesService.getScriptProperties().getProperty('WA_PRUEBA') || '').split(/[,;\s]+/).some(x => x && fin8_(x) === fin8_(tel)), juan_cfg: fin8_(CFG.WHATSAPP_JUAN) === fin8_(tel),
          ultimos: v.map(r => [String(r[0]).slice(0, 16), r[3], String(r[6]).slice(0, 24), r[7], r[8], String(r[4]).slice(0, 80)].join(' | ')) }); }
      case 'grow_token': { if (!body.valor) return json_({ ok: false, error: 'valor' }); PropertiesService.getScriptProperties().setProperty('GROW_TOKEN', String(body.valor)); return json_({ ok: true }); }
      case 'grow': return json_(growApi_(String(body.op || 'resumen'), body.datos || {}));
      case 'diag_vel': return json_(diagVelocidad_());
      case 'archivar': { if (body.auto != null) PropertiesService.getScriptProperties().setProperty('ARCHIVO_AUTO', body.auto ? '1' : '0'); return json_(archivar_(body.seco !== false)); }
      case 'memoria_lista': return json_(memoriaResumen_());
      case 'memoria_limpiar_pins': return json_(memoriaLimpiarPins_());
      case 'memoria_aprender': return json_({ ok: true, guardados: memoriaAprender_() });
      case 'memoria_ver': return json_(Object.assign({ ok: true }, memoriaVer_(String(body.propiedad || ''))));
      case 'distancia': return json_(distanciaCalcular_(String(body.propiedad || ''), String(body.destino || '')));
      case 'agente_prueba': { const adm = adminsOp_().find(x => x.principal) || adminsOp_()[0]; return json_(Object.assign({ ok: true, admin: adm && adm.nombre }, opAgente_(adm, String(body.texto || ''), 'hub', [], []), { error_api: CacheService.getScriptCache().get('ag_error') || '' })); }   // diagnóstico: no guarda en el chat
      default: return json_({ ok: false, error: 'accion' });
    }
  } catch (err) {
    console.error('dsBotApi_: ' + (err.stack || err));
    return json_({ ok: false, error: String(err) });
  }
}
function dsPublicar_(lista) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const h = dsHoja_(), ya = {};
    dsFilas_().forEach(r => ya[String(r.id)] = r);
    const nuevas = [], errores = [];
    lista.forEach(p => {
      const id = String(p && p.id || '');
      if (!id) { errores.push('sin id'); return; }
      const json = JSON.stringify(p);
      if (json.length > 48000) { errores.push(id + ': demasiado grande (' + json.length + ')'); return; }
      const fila = ya[id];
      if (fila) {                                    // ya existía: solo se actualiza si sigue pendiente
        if (String(fila.estado) === 'pendiente') {
          h.sh.getRange(fila._fila, h.col('titulo')).setValue(String(p.titulo || ''));
          h.sh.getRange(fila._fila, h.col('recomendacion')).setValue(String(p.recomendacion || ''));
          h.sh.getRange(fila._fila, h.col('json')).setValue(json);
        }
        return;
      }
      nuevas.push(DS_CAB_.map(k => ({ id: id, fecha: new Date(), estado: 'pendiente', titulo: String(p.titulo || ''), app_origen: String(p.origen || ''), recomendacion: String(p.recomendacion || ''), json: json })[k] || ''));
    });
    if (nuevas.length) h.sh.getRange(h.sh.getLastRow() + 1, 1, nuevas.length, DS_CAB_.length).setValues(nuevas);
    return { ok: true, nuevas: nuevas.length, errores: errores };
  } finally { lock.releaseLock(); }
}
function dsAplicada_(id, resultado) {
  const h = dsHoja_(), f = dsFilas_().find(r => String(r.id) === String(id));
  if (!f) return { ok: false, error: 'no existe' };
  h.sh.getRange(f._fila, h.col('estado')).setValue('aplicada');
  h.sh.getRange(f._fila, h.col('aplicada_en')).setValue(new Date());
  h.sh.getRange(f._fila, h.col('resultado')).setValue(String(resultado || '').slice(0, 5000));
  return { ok: true };
}

/* ═══════════════════════════════ 13. VÍNCULOS (antes en Propiedades del script) ═══════════════════
   ALMA recuerda pares pequeños por conversación o por número de WhatsApp: consulta ↔ reserva
   (cinq_, inqcid_, cres_, inqres_), datos de WhatsApp (waactor_, waruta_, wacat_), la foto de cada reserva
   para detectar cambios (rsnap_), consultas ya reparadas (inqrep3_) y reportes de daño ya enviados (dano:). Antes se guardaban
   como Propiedades del script y nunca se borraban: pasaron de 50 (el editor quedó en solo lectura) y
   habrían llenado el límite total de Google. Ahora viven en la pestaña ALMA_VINCULOS de la hoja de ALMA.
   Lectura: memoria de la ejecución → caché (6 h) → hoja → (respaldo) propiedad antigua, que se mueve a la hoja.
   Una vez: ejecuta migrarVinculos() desde el editor para mover y borrar las propiedades antiguas. */
const VINC_TAB_ = 'ALMA_VINCULOS';
const VINC_PREFIJOS_ = ['cinq_', 'inqcid_', 'cres_', 'inqres_', 'waactor_', 'waruta_', 'wacat_', 'rsnap_', 'inqrep3_', 'dano:'];
const VINC_ = { mapa: null, filas: null, sh: null };

function vincHoja_() { return VINC_.sh || (VINC_.sh = hojaCrear_(VINC_TAB_, ['clave', 'valor', 'actualizado'])); }
function vincCargar_() {
  if (VINC_.mapa) return;
  const sh = vincHoja_(), n = sh.getLastRow() - 1, mapa = {}, filas = {};
  if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach((r, i) => { const k = String(r[0]); if (k) { mapa[k] = String(r[1]); filas[k] = i + 2; } });
  VINC_.mapa = mapa; VINC_.filas = filas;
}
function vGet_(k) {
  k = String(k || ''); if (!k) return null;
  if (VINC_.mapa && k in VINC_.mapa) return VINC_.mapa[k];
  const cache = CacheService.getScriptCache(), c = cache.get('v_' + k);
  if (c !== null) return c === '\u0000' ? null : c;
  vincCargar_();
  let v = k in VINC_.mapa ? VINC_.mapa[k] : null;
  if (v === null) {                                       // respaldo: propiedad antigua aún no migrada
    const props = PropertiesService.getScriptProperties(), old = props.getProperty(k);
    if (old !== null) { vSet_(k, old); try { props.deleteProperty(k); } catch (e) {} v = old; }
  }
  try { cache.put('v_' + k, v === null ? '\u0000' : v, 21600); } catch (e) {}
  return v;
}
function vSet_(k, v) {
  k = String(k || ''); v = String(v === undefined || v === null ? '' : v); if (!k) return;
  if (VINC_.mapa && VINC_.mapa[k] === v) return;
  const lock = LockService.getScriptLock(), yaTenia = lock.hasLock();   // si quien llama ya tiene el lock, no se suelta aquí
  if (!yaTenia) { try { lock.waitLock(10000); } catch (e) { console.warn('vSet_ sin lock: ' + k); return; } }
  try {
    VINC_.mapa = null; vincCargar_();                     // relee dentro del lock por si otra ejecución escribió
    if (VINC_.mapa[k] === v) return;
    const sh = vincHoja_();
    if (VINC_.filas[k]) sh.getRange(VINC_.filas[k], 2, 1, 2).setValues([[v, new Date()]]);
    else { sh.appendRow([k, v, new Date()]); VINC_.filas[k] = sh.getLastRow(); }
    VINC_.mapa[k] = v;
  } finally { if (!yaTenia) lock.releaseLock(); }
  try { CacheService.getScriptCache().put('v_' + k, v, 21600); } catch (e) {}
}

/* Ejecutar UNA vez desde el editor. Mueve las propiedades antiguas a ALMA_VINCULOS y las borra.
   Se puede repetir sin riesgo: lo que ya está en la hoja no se duplica. */
function migrarVinculos() {
  const props = PropertiesService.getScriptProperties(), todas = props.getProperties();
  const claves = Object.keys(todas).filter(k => VINC_PREFIJOS_.some(p => k.indexOf(p) === 0));
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let nuevas = 0;
  try {
    VINC_.mapa = null; vincCargar_();
    const sh = vincHoja_(), filas = [];
    claves.forEach(k => { if (!(k in VINC_.mapa)) { filas.push([k, String(todas[k]), new Date()]); VINC_.mapa[k] = String(todas[k]); } });
    if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, 3).setValues(filas);
    nuevas = filas.length;
  } finally { lock.releaseLock(); }
  SpreadsheetApp.flush();
  claves.forEach(k => { try { props.deleteProperty(k); } catch (e) {} });
  const resto = Object.keys(props.getProperties()), quedan = resto.length;
  console.log('Vínculos movidos a ' + VINC_TAB_ + ': ' + nuevas + ' nuevos de ' + claves.length + '. Propiedades del script que quedan: ' + quedan + '.');
  /* Resumen de lo que queda (solo nombres, nunca valores): agrupa por prefijo para ver si algo más crece solo. */
  const grupos = {};
  resto.forEach(k => { const m = /^([a-zA-Z]+[_:])[^_:]{6,}/.exec(k), g = m ? m[1] + '…' : k; grupos[g] = (grupos[g] || 0) + 1; });
  console.log('Quedan: ' + Object.keys(grupos).sort().map(g => grupos[g] > 1 ? g + ' ×' + grupos[g] : g).join(', '));
  return { movidas: claves.length, nuevas: nuevas, quedan: quedan };
}

/* ═══════════════════════════════ 14. SESIÓN FIRMADA (fase 1b) ═══════════════════
   El login (Apps Script de «Control de usuarios») firma la sesión. Aquí se comprueba con su acción verify
   y se guarda 1 hora en caché (10 min si es inválida). Devuelve el perfil vigente o null. */
const LOGIN_URL_ = 'https://script.google.com/macros/s/AKfycbxfdwLzsA8bwgOxUTOtf3Hw1ptIm8Cy34tspmFndu3WtRrkVSSnGyBP7obRrm73mcUd/exec';
function sesionLogin_(session) {
  session = String(session || ''); if (session.indexOf('.') < 1 || session.length > 4000) return null;
  const cache = CacheService.getScriptCache();
  const k = 'ses_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, session)).slice(0, 40);
  let hit = cache.get(k);
  if (hit) { try { return hit === '-' ? null : JSON.parse(hit); } catch (e) {} }
  /* Al abrir el Hub salen muchas llamadas a la vez: solo la primera consulta al login, las demás esperan su resultado. */
  const lock = LockService.getUserLock(), conLock = !lock.hasLock() && lock.tryLock(15000);   // lock aparte: no bloquea a ALMA
  try {
    hit = cache.get(k);
    if (hit) { try { return hit === '-' ? null : JSON.parse(hit); } catch (e) {} }
    return sesionLoginRemota_(session, k);
  } finally { if (conLock) lock.releaseLock(); }
}
function sesionLoginRemota_(session, k) {
  const cache = CacheService.getScriptCache();
  let prof = null;
  try {
    const r = UrlFetchApp.fetch(LOGIN_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ action: 'verify', token: PropertiesService.getScriptProperties().getProperty('LOGIN_TOKEN') || 'SpacioAM2026!', session: session }) });
    const j = JSON.parse(r.getContentText() || '{}');
    if (j.ok && j.profile) prof = j.profile;
  } catch (e) { console.warn('sesionLogin_: ' + e); return null; }   // error de red: no se cachea el negativo
  cache.put(k, prof ? JSON.stringify(prof) : '-', prof ? 3600 : 600);
  return prof;
}
/* Última vez que se entró con sesión y con la llave antigua: sirve para saber cuándo se puede apagar la llave. */
function marcaAcceso_(clave) {
  const c = CacheService.getScriptCache();
  if (c.get('m_' + clave)) return;
  c.put('m_' + clave, '1', 3600);
  try { PropertiesService.getScriptProperties().setProperty(clave, new Date().toISOString()); } catch (e) {}
}
