/* ═══ 15 · ALMA VOZ (ElevenLabs) ════════════════════════════════════════════════════════════════
   Herramientas que usa el agente de voz de ElevenLabs durante las llamadas (WhatsApp y teléfono).
   Mismo cerebro que ALMA por mensajes: mismas reservas, misma ficha de propiedad y mismas reglas.

   URL de cada herramienta (Server tool, método POST, cuerpo JSON):
       https://script.google.com/macros/s/<despliegue del Hub>/exec?voz=1&k=<LLAVE_VOZ>
   La llave solo vive en ElevenLabs; aquí se guarda su huella (SHA-256), porque este código es público.

   Cuerpo: { "herramienta": "reglas" | "validar" | "info_propiedad" | "registrar", ...parámetros }
   Regla de oro: nada sensible (dirección exacta, WiFi, acceso, parqueo) sin validar antes la reserva.
   Los códigos de puerta NUNCA salen por aquí (infoPropiedad_ ya los excluye).
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var VOZ_HASH_ = '4dedaf0c70ab1f199064dc935b16a00f3419183628540516a52d48b16e53d44a';

function vozApi_(e, body) {
  var k = String((e && e.parameter && e.parameter.k) || body.k || '');
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, k, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (h !== VOZ_HASH_) return json_({ ok: false, error: 'llave' });
  var herr = String(body.herramienta || (e.parameter && e.parameter.h) || '').toLowerCase();
  try {
    var out;
    if (herr === 'reglas') out = vozReglas_();
    else if (herr === 'validar') out = vozValidar_(body);
    else if (herr === 'info_propiedad') out = vozInfo_(body);
    else if (herr === 'registrar') out = vozRegistrar_(body);
    else out = { ok: false, error: 'herramienta desconocida: ' + herr };
    vozTraza_(herr, body, out);
    return json_(out);
  } catch (err) {
    console.error('vozApi_: ' + err);
    return json_({ ok: false, error: 'interno', detalle: String(err).slice(0, 200) });
  }
}

/* Reglas de ALMA (las mismas de los mensajes) + las propias de una llamada. */
function vozReglas_() {
  var base = [prompt_('REDACTOR'), prompt_('REGLAS_EXTRA'), sinCab_(prompt_('ESTILO'))].filter(Boolean).join('\n\n');
  var voz = [
    'REGLAS DE LLAMADA (prevalecen):',
    '1. Antes de dar cualquier dato de la estadía (dirección exacta, cómo llegar, WiFi, parqueo, acceso), valida la reserva con la herramienta validar.',
    '2. Primero intenta validar solo con el número desde el que llama ({{system__caller_id}}). Si no coincide, pide el código de la reserva y el apellido del titular, de forma amable y breve.',
    '3. Si no se puede validar, ofrece ayuda general (disponibilidad, cómo reservar, políticas) y dile que el equipo le escribirá. Nunca adivines datos.',
    '4. Nunca des códigos de puerta ni de cerradura por teléfono: llegan por la plataforma de reserva antes del check-in.',
    '5. Si hay una urgencia (no puede entrar, fuga, seguridad, salud), registra la llamada con urgente=true para avisar al equipo de inmediato, y dile al huésped que una persona le contactará en minutos.',
    '6. Al terminar cada llamada, usa registrar con un resumen corto (qué pidió, qué le dijiste, si queda algo pendiente).',
    '7. Habla con frases cortas y naturales. Confirma números y fechas despacio.'
  ].join('\n');
  return { ok: true, reglas: (base + '\n\n' + voz).slice(0, 12000) };
}

/* ── Validación ───────────────────────────────────────────────────────────────────────────── */
function vozDigitos_(t) { return String(t || '').replace(/\D/g, ''); }
function vozMismoTel_(a, b) { a = vozDigitos_(a); b = vozDigitos_(b); return a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8); }
function vozNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

/* Reservas vigentes: desde 3 días antes del check-in hasta 1 día después del checkout, sin canceladas. */
function vozVigentes_() {
  var hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  return leerTabla_(CFG.TAB_RESERVAS).filter(function (r) {
    if (/cancel/i.test(s_(r.status))) return false;
    var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date);
    if (!ci || !co) return false;
    return sumarDias_(ci, -3) <= hoy && hoy <= sumarDias_(co, 1);
  });
}

/* Teléfonos conocidos por código de reserva: formulario de llegada (Hola) + WhatsApp vinculado en la bandeja. */
function vozTelefonos_(codigos) {
  var tels = {}, add = function (c, t) { t = vozDigitos_(t); if (c && t.length >= 8) (tels[c] = tels[c] || []).push(t); };
  try {
    var sh = ssWebapp_().getSheetByName('Formularios');
    if (sh) leerTablaHoja_(sh).forEach(function (f) { var c = s_(f.code); if (codigos[c]) { add(c, f.contact_phone); add(c, f.booker_phone); } });
  } catch (x) { console.error('vozTelefonos_ formularios: ' + x); }
  try {
    leerTablaHoja_(hojaInbox_()).forEach(function (r) {
      var c = s_(r.codigo); if (!codigos[c]) return;
      if (String(r.conv_id).indexOf('wa:') === 0) add(c, String(r.conv_id).slice(3));
      if (r.wa) add(c, r.wa);
    });
  } catch (x) { console.error('vozTelefonos_ inbox: ' + x); }
  return tels;
}

function vozValidar_(b) {
  var tel = vozDigitos_(b.telefono || b.caller_id), codigo = String(b.codigo || '').trim().toUpperCase(), apellido = vozNorm_(b.apellido || b.nombre);
  var cache = CacheService.getScriptCache(), kf = 'vozf_' + (tel || 'x').slice(-10);
  if (Number(cache.get(kf) || 0) >= 6) return { ok: true, validado: false, motivo: 'demasiados_intentos', indicacion: 'No sigas intentando validar. Ofrece que el equipo le escriba por WhatsApp.' };
  var vig = vozVigentes_(), porCod = {};
  vig.forEach(function (r) { porCod[s_(r.code).toUpperCase()] = r; });
  var r = null, metodo = '';
  if (tel) {
    var tels = vozTelefonos_(vig.reduce(function (o, x) { o[s_(x.code)] = 1; return o; }, {}));
    var hits = Object.keys(tels).filter(function (c) { return tels[c].some(function (t) { return vozMismoTel_(t, tel); }); });
    if (hits.length === 1) { r = porCod[hits[0].toUpperCase()]; metodo = 'telefono'; }
  }
  if (!r && codigo && porCod[codigo]) {
    var cand = porCod[codigo], nombres = vozNorm_(s_(cand.guest_first_name) + ' ' + s_(cand.guest_last_name)).split(' ').filter(function (w) { return w.length >= 3; });
    var pal = apellido.split(' ').filter(function (w) { return w.length >= 3; });
    if (pal.some(function (w) { return nombres.indexOf(w) >= 0; })) { r = cand; metodo = 'codigo_y_apellido'; }
  }
  if (!r) {
    if (codigo || apellido) cache.put(kf, String(Number(cache.get(kf) || 0) + 1), 1800);
    return { ok: true, validado: false, motivo: tel && !codigo ? 'telefono_no_coincide' : 'datos_no_coinciden',
      indicacion: tel && !codigo ? 'Pide amablemente el código de la reserva (lo ve en Airbnb/Booking o en su confirmación) y el apellido del titular.' : 'Los datos no coinciden con una reserva vigente. Ofrece ayuda general y que el equipo le escriba.' };
  }
  cache.remove(kf);
  return { ok: true, validado: true, metodo: metodo, codigo: s_(r.code), huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].filter(Boolean).join(' '),
    propiedad: s_(r.property_name), checkin: fecha_(r.checkin_date), checkout: fecha_(r.checkout_date), personas: s_(r.guest_count) };
}

function vozInfo_(b) {
  var v = vozValidar_(b);
  if (!v.validado) return v;
  return { ok: true, validado: true, propiedad: v.propiedad, checkin: v.checkin, checkout: v.checkout,
    ficha: infoPropiedad_(v.propiedad, b.idioma || 'es'), conocimiento: conocimiento_(v.propiedad).slice(0, 4000) };
}

/* ── Registro y avisos ───────────────────────────────────────────────────────────────────── */
function vozRegistrar_(b) {
  var sh = hojaCrear_('ALMA_LLAMADAS', ['fecha', 'telefono', 'codigo', 'huesped', 'resumen', 'urgente', 'canal', 'conversation_id']);
  var urgente = b.urgente === true || String(b.urgente).toLowerCase() === 'true';
  var tel = vozDigitos_(b.telefono || b.caller_id);
  sh.appendRow([new Date().toISOString(), tel, s_(b.codigo), s_(b.huesped || b.nombre), s_(b.resumen).slice(0, 2000), urgente ? 'sí' : '', s_(b.canal) || 'llamada', s_(b.conversation_id)]);
  if (urgente) {
    try { escalar_('Llamada urgente · ' + (s_(b.huesped) || tel || 'huésped'), (s_(b.resumen) || '(sin resumen)') + '\n\nTeléfono: +' + tel + (b.codigo ? '\nReserva: ' + s_(b.codigo) : '') + '\n\nRecibida por ALMA voz.'); }
    catch (x) { console.error('vozRegistrar_ escalar: ' + x); }
  }
  return { ok: true, registrado: true, aviso_equipo: urgente };
}

/* Diagnóstico: últimas 30 llamadas a herramientas (sin datos de la ficha), en caché 6 h. */
function vozTraza_(herr, b, out) {
  try {
    var c = CacheService.getScriptCache(), l = []; try { l = JSON.parse(c.get('voz_traza') || '[]'); } catch (x) {}
    l.unshift({ t: new Date().toISOString(), h: herr, tel: vozDigitos_(b.telefono || b.caller_id).slice(-4), ok: !!(out && out.ok), validado: out && out.validado, motivo: out && (out.motivo || out.error) || '' });
    c.put('voz_traza', JSON.stringify(l.slice(0, 30)), 21600);
  } catch (x) {}
}
