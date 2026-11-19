/* ═══ 15c · CLAUDIO LOCAL (Juan, 16-nov-2026, #629) ═══════════════════════════════════════════════════════════════
   «Configurar la voz de Claudio para que sea local, imitando la voz, patrones y system prompt de ElevenLabs, para no
   consumir créditos en sesiones extensas de trabajo.» Las sesiones con Claudio son largas (pedidos, estado, cómo funciona
   algo) y cada minuto en el agente de ElevenLabs gasta créditos de voz. Con Claudio local, nada de esa conversación pasa
   por ElevenLabs:
     · oído: el dictado del iPhone, en el teléfono (la app, ClaudioLocal.swift);
     · cabeza: esta acción, claudioLocal, con el MISMO prompt de Claudio (claudioPromptObj_: cómo habla, por voz,
       confirmaciones, «nunca» y Weebo salen de la misma fuente que Alma), la MISMA ficha (claudioFicha_) y las MISMAS
       herramientas (claudio_pedido, claudio_responder, claudio_estado, claudio_unir, claudio_codigo y volver_con_alma),
       con el modelo rápido de la voz (rapidoModelo_, como el camino rápido): cuesta centavos de texto, no minutos de voz;
     · voz: una voz de hombre del iPhone (la mejor que tenga en español), afinada para parecerse a la de Claudio en
       ElevenLabs (calmada, cálida, ritmo de conversación): CLAUDIO_VOZ_LOCAL_, y se cambia sin PR con la propiedad
       CLAUDIO_VOZ_LOCAL (JSON). Juan, 17-nov-2026 (#649): «volver a la voz local que funcionaba bien antes del último
       ajuste» (el de #636, que mandaba cada frase con la voz de Claudio en ElevenLabs). Ese camino queda apagado de
       fábrica; CLAUDIO_VOZ_LOCAL {"motor":"elevenlabs"} lo vuelve a encender sin PR (claudioLocalAudio_).
       Juan, 19-nov-2026: «Claudio y Maricarmen solo deben trabajar con voz local». Ese {"motor":"elevenlabs"} ya no basta
       (alguien pudo dejarlo puesto): además hace falta CLAUDIO_VOZ_ELEVENLABS = 1, a propósito. Sin eso, nunca ElevenLabs.
   Las reglas de cómo suena (skill alma-humana, «Diseñar para el oído»): la respuesta primero, frases cortas, una sola
   pregunta al final, nada de listas ni etiquetas de emoción (la voz del iPhone las leería en voz alta): CLAUDIO_LOCAL_VOZ_.
   Encendido de fábrica. CLAUDIO_LOCAL = 0 (Propiedades del script) vuelve al agente de ElevenLabs sin un PR. La app
   que todavía no sabe hacerlo ignora «local» y sigue con la URL firmada de siempre.
   Seguridad: igual que Claudio, solo el administrador principal, verificado por su sesión en CADA turno (no por lo que
   diga la conversación). La conversación local tiene su id (conv_local_…, para el Panel de Claudio y la vuelta con Alma)
   ligado a su teléfono; otro administrador no puede usarla.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var CLAUDIO_LOCAL_PALABRAS_ = 45;   // ~15 s hablados: dos o tres frases cortas (alma-humana: ~30; aquí explica código)
var CLAUDIO_LOCAL_VUELTAS_ = 4, CLAUDIO_LOCAL_MS_ = 22000, CLAUDIO_LOCAL_HIST_ = 14;
var CLAUDIO_LOCAL_REPITE_ = 'Perdón, no me llegó bien. ¿Me lo repites?';
/* La voz del iPhone que imita a Claudio: de hombre, en español de México (luego Estados Unidos y España), la de mejor
   calidad instalada, con su tono natural. Juan, 17-nov-2026 (#687): «que la voz suene natural otra vez». El tono 0.92
   (un poco más grave, para parecerse a ElevenLabs) la hacía sonar procesada; ahora 1, el de la voz tal cual. */
var CLAUDIO_VOZ_LOCAL_ = { motor: 'iphone', idiomas: ['es-MX', 'es-US', 'es-419', 'es-ES'], genero: 'hombre', velocidad: 0.5, tono: 1, volumen: 1 };
/* La voz de ElevenLabs en Claudio local: los modelos que también sirven fuera del agente; si el agente usa otro (o todavía
   no se leyó), el rápido, que es el de las llamadas. Los ajustes (estabilidad, parecido, velocidad) son los de su agente. */
var CLAUDIO_TTS_MODELOS_ = ['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_v3'];
var CLAUDIO_TTS_FABRICA_ = { model_id: 'eleven_flash_v2_5', stability: 0.5, similarity_boost: 0.8, speed: 1 };
var CLAUDIO_TTS_HZ_ = 16000, CLAUDIO_TTS_LETRAS_ = 600;
var CLAUDIO_LOCAL_VOZ_ = [
  'Te oye el dictado del iPhone y te lee en voz alta una voz del iPhone: escribe SOLO lo que dirías, en texto plano.',
  'Nada de etiquetas de emoción ([warm], [laughs]…), markdown, viñetas, emojis, enlaces ni nombres de archivos: la voz los leería tal cual.',
  'La respuesta primero; dos o tres frases cortas, unas 30 palabras. Una sola pregunta, al final.',
  'Números como persona («el cambio seiscientos veintinueve» solo si Juan lo pide; si no, por su nombre).',
  'El dictado a veces entiende mal: si algo no tiene sentido, confirma lo que sí entendiste y pide solo lo que falta.',
  'Si Juan solo dijo «ajá», «sí» o «ok» sin pedir nada, contesta muy corto o sigue con lo que ibas.',
  'Volver con Alma: di solo «Listo, te paso con Alma.» y usa volver_con_alma en ese mismo turno.'
];

function claudioLocalOn_() { return String(PropertiesService.getScriptProperties().getProperty('CLAUDIO_LOCAL') || '1') !== '0'; }
function claudioVozLocal_() {
  var o = Object.assign({}, CLAUDIO_VOZ_LOCAL_), p = PropertiesService.getScriptProperties().getProperty('CLAUDIO_VOZ_LOCAL');
  if (p) { try { var j = JSON.parse(p); if (j && typeof j === 'object') Object.keys(o).forEach(function (k) { if (j[k] != null) o[k] = j[k]; }); } catch (e) { console.error('CLAUDIO_VOZ_LOCAL: ' + e); } }
  var n = function (x, a, b, d) { x = Number(x); return isNaN(x) ? d : Math.min(b, Math.max(a, x)); };
  o.velocidad = n(o.velocidad, 0.3, 0.65, 0.5); o.tono = n(o.tono, 0.6, 1.4, 1); o.volumen = n(o.volumen, 0.2, 1, 1);
  o.idiomas = (Array.isArray(o.idiomas) ? o.idiomas : [String(o.idiomas || '')]).map(String).filter(function (x) { return /^es(-[A-Za-z0-9]+)?$/.test(x); }).slice(0, 5);
  if (!o.idiomas.length) o.idiomas = CLAUDIO_VOZ_LOCAL_.idiomas.slice();
  o.genero = o.genero === 'mujer' ? 'mujer' : 'hombre';
  /* de fábrica, la local (#649); ElevenLabs solo con CLAUDIO_VOZ_ELEVENLABS = 1 a propósito (Juan, 19-nov-2026) */
  o.motor = o.motor === 'elevenlabs' && claudioVozElevenLabs_() ? 'elevenlabs' : 'iphone';
  return o;
}

function claudioVozElevenLabs_() { return String(PropertiesService.getScriptProperties().getProperty('CLAUDIO_VOZ_ELEVENLABS') || '').trim() === '1'; }

/* Lo que usa el agente de Claudio para hablar (lo guarda claudioConfigSiCambio_ una vez al día al leer su agente). */
function claudioTtsGuardar_(tts) {
  tts = tts || {}; var o = {};
  if (tts.model_id) o.model_id = String(tts.model_id);
  ['stability', 'similarity_boost', 'speed'].forEach(function (k) { if (tts[k] != null && !isNaN(Number(tts[k]))) o[k] = Number(tts[k]); });
  PropertiesService.getScriptProperties().setProperty('CLAUDIO_TTS_AGENTE', JSON.stringify(o));
  return o;
}
function claudioTts_() {
  var p = PropertiesService.getScriptProperties(), o = Object.assign({}, CLAUDIO_TTS_FABRICA_), g = {};
  try { g = JSON.parse(p.getProperty('CLAUDIO_TTS_AGENTE') || '{}') || {}; } catch (e) {}
  Object.keys(o).forEach(function (k) { if (g[k] != null) o[k] = g[k]; });
  var m = String(p.getProperty('CLAUDIO_LOCAL_TTS_MODELO') || o.model_id);   // se cambia sin PR
  o.model_id = CLAUDIO_TTS_MODELOS_.indexOf(m) >= 0 ? m : CLAUDIO_TTS_FABRICA_.model_id;
  var n = function (x, a, b, d) { x = Number(x); return isNaN(x) ? d : Math.min(b, Math.max(a, x)); };
  o.stability = n(o.stability, 0, 1, 0.5); o.similarity_boost = n(o.similarity_boost, 0, 1, 0.8); o.speed = n(o.speed, 0.7, 1.2, 1);
  return o;
}
/* Una frase con la voz de Claudio en ElevenLabs: PCM 16 bits a 16 kHz en base64 (lo mismo que manda su agente), o '' si no
   se pudo (la app la dice con la voz del iPhone). Si el modelo del agente falla, una vez más con el rápido. */
function claudioLocalAudio_(texto) {
  texto = String(texto || '').trim().slice(0, CLAUDIO_TTS_LETRAS_);
  if (!texto || claudioVozLocal_().motor !== 'elevenlabs') return '';
  var key = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY'); if (!key) return '';
  var t = claudioTts_(), modelos = [t.model_id];
  if (t.model_id !== CLAUDIO_TTS_FABRICA_.model_id) modelos.push(CLAUDIO_TTS_FABRICA_.model_id);
  for (var i = 0; i < modelos.length; i++) {
    var r = uf_('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(CLAUDIO_VOZ_ID_) + '?output_format=pcm_' + CLAUDIO_TTS_HZ_, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key },
      payload: JSON.stringify({ text: texto, model_id: modelos[i], language_code: 'es',
        voice_settings: { stability: t.stability, similarity_boost: t.similarity_boost, speed: t.speed } }) }, 'Voz');
    if (r.getResponseCode() === 200) { var b = r.getBlob().getBytes(); return b && b.length ? Utilities.base64Encode(b) : ''; }
    console.error('claudioLocalAudio_ ' + modelos[i] + ' ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 200));
  }
  return '';
}
/* Le pone el audio a lo que se va a decir (sin audio, la app usa la voz del iPhone). */
function claudioLocalConAudio_(out, texto) {
  var a = ''; try { a = claudioLocalAudio_(texto); } catch (e) { console.error('claudioLocalAudio_: ' + e); }
  if (a) { out.audio = a; out.hz = CLAUDIO_TTS_HZ_; }
  return out;
}

/* vozClaudio (claudioWebInicio_) suma lo de Claudio local: la conversación local y su voz. La ficha queda guardada para
   esa conversación (los turnos no la vuelven a armar) y el id queda ligado al teléfono del principal. */
function claudioLocalSumar_(out, adm, ficha) {
  if (!claudioLocalOn_()) return out;
  var conv = 'conv_local_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20), c = CacheService.getScriptCache();
  c.put('claudio_' + conv, normTel_(adm.tels[0]), 21600);
  try { c.put('claudiolocal_' + conv, String(ficha || '').slice(0, 90000), 21600); } catch (e) { console.error('claudiolocal ficha: ' + e); }
  out.local = true; out.conv_id = conv; out.voz_local = claudioVozLocal_();
  claudioLocalConAudio_(out.voz_local, out.first_message);   // el saludo, también con su voz (voz_local.audio)
  return out;
}

/* El system de Claudio local: el mismo prompt que su agente de ElevenLabs, con la ficha en su lugar y las reglas de voz local. */
function claudioLocalSystem_(ficha) {
  var o = claudioPromptObj_();
  o.claudio.voz_local = CLAUDIO_LOCAL_VOZ_.slice();
  o.ficha_de_quien_llama = [String(ficha || CLAUDIO_SIN_FICHA_)];
  return JSON.stringify(o);
}
/* Sus herramientas, en el formato de Claude: las mismas de su agente (sin conv_id ni sa_web, que pone el Hub). */
function claudioLocalHerramientas_() {
  /* reproducir_voz la atiende solo la app en una llamada de ElevenLabs (muestrasvoz.js): aquí no existe. */
  return claudioDefHerramientas_('L').filter(function (d) { return d.name !== 'reproducir_voz'; }).map(function (d) {
    var sch = d.type === 'webhook' ? d.api_schema.request_body_schema : d.parameters, props = {};
    Object.keys(sch.properties || {}).forEach(function (k) { if (k !== 'conv_id' && k !== 'sa_web') props[k] = sch.properties[k]; });
    var req = (sch.required || []).filter(function (k) { return k !== 'conv_id' && k !== 'sa_web'; });
    return { name: d.name, description: d.description, input_schema: { type: 'object', properties: props, required: req } };
  });
}
/* Lo que la app manda de la conversación (lo que dijo cada uno) → mensajes alternados para Claude. */
function claudioLocalMensajes_(historial, texto) {
  var m = [];
  var poner = function (rol, t) {
    t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 800); if (!t) return;
    var ul = m[m.length - 1];
    if (ul && ul.role === rol) ul.content += '\n' + t; else m.push({ role: rol, content: t });
  };
  (Array.isArray(historial) ? historial : []).slice(-CLAUDIO_LOCAL_HIST_).forEach(function (h) {
    if (h && typeof h === 'object') poner(h.de === 'claudio' ? 'assistant' : 'user', h.texto);
  });
  poner('user', texto);
  if (m.length && m[0].role === 'assistant') m.unshift({ role: 'user', content: '(Alma te pasó la llamada.)' });
  if (!m.length || m[m.length - 1].role !== 'user') m.push({ role: 'user', content: '(Juan se quedó callado.)' });
  return m;
}
/* Lo que se dice en voz alta: sin lo que la voz del iPhone leería raro, y corto. */
function claudioLocalHablar_(t) { return calleCorto_(calleLimpiar_(t), CLAUDIO_LOCAL_PALABRAS_); }

/* ── Acción claudioLocal { conv_id, texto, historial: [{ de: 'juan'|'claudio', texto }] } (solo el principal) ──
   Devuelve { ok, hablar, volver, herramientas, poner?, audio?, hz?, ms, ms_ia, ms_voz } (poner: lo que pidió poner_voz, #779, suena en la app después de hablar) (ms_*: lo que tardó la IA y la voz) (audio: hablar con su voz de ElevenLabs, PCM en base64). volver: Claudio usó volver_con_alma (la app vuelve a Alma después de
   decir hablar). herramientas: las de claudio_* que corrieron (la app pide el Panel de Claudio). */
function claudioLocalApi_(ses, b) {
  b = b || {};
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };   // no 'session': ese error cierra la sesión del navegador
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Claudio es solo para el administrador principal.', codigo: 'no_principal' };
  var conv = String(b.conv_id || '').trim(), c = CacheService.getScriptCache();
  if (!/^conv_local_[a-f0-9]{8,40}$/.test(conv)) return { ok: false, error: 'Falta la conversación de Claudio local.' };
  var tel = c.get('claudio_' + conv);
  if (tel && !(adm.tels || []).some(function (x) { return fin8_(x) === fin8_(tel); })) return { ok: false, error: 'Esa conversación no es tuya.' };
  if (!tel) c.put('claudio_' + conv, normTel_(adm.tels[0]), 21600);
  var texto = String(b.texto || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  literalLlamadaPoner_(conv, '', Date.now(), texto);   // un pedido de este turno lleva su dictado tal cual (literal.js)
  var ficha = c.get('claudiolocal_' + conv);
  if (!ficha) {   // la caché venció (más de 6 h) o se borró: se arma otra vez
    ficha = claudioFicha_(adm, String(adm.nombre || '').trim().split(/\s+/)[0] || 'Juan', '');
    try { c.put('claudiolocal_' + conv, ficha.slice(0, 90000), 21600); } catch (e) {}
  }
  var out = claudioLocalTurno_(adm, conv, claudioLocalSystem_(ficha), claudioLocalMensajes_(b.historial, texto));
  var tv = Date.now(); claudioLocalConAudio_(out, out.hablar);   // con la voz de Claudio en ElevenLabs si está encendida (audio + hz); de fábrica, la del iPhone
  out.ms_voz = Date.now() - tv;   // cuánto tardó la voz (la app lo anota junto a ms_ia: así se ve dónde se va el tiempo)
  return out;
}
/* Pedido hecho, sin otra vuelta de la IA (#651; Juan, 17-nov-2026: «Claudio responde más lento que Alma»). Después de
   claudio_pedido la IA solo repetía la frase fija de su prompt («Quedó pedido; lo hago en segundo plano…»): esa vuelta
   costaba otra llamada completa a Claude (1 a 3 s) en el turno más común. Si en la vuelta solo hubo pedidos y todos
   salieron con «Listo, quedó …», la frase se arma aquí. Si algo falló o el resultado es otro (una orden de unir), la IA
   lo dice como siempre. «Quedó pedido» y lo del segundo plano, una sola vez por llamada (Juan, 17-nov-2026: «lo repite
   hasta ocho veces; con una sola vez basta»): claudio_pedido ya devuelve la confirmación corta («También quedó.») cuando
   no es el primero de la conversación, y en un mismo turno con varios pedidos se dice completo solo el primero. */
var CLAUDIO_LOCAL_PEDIDO_ = 'Lo hago en segundo plano y te aviso cuando esté; lo vas a ver en la órbita.';
function claudioLocalPedidoListo_(usos, salidas) {
  if (!usos.length || usos.some(function (u) { return u.name !== 'claudio_pedido'; })) return '';
  var dichos = salidas.map(function (o) { return o && o.ok && (o.corta || /^Listo, quedó (pedido|sumado)/.test(String(o.hecho || ''))) ? String(o.hecho) : ''; });
  if (dichos.some(function (d) { return !d; })) return '';
  var completo = !salidas[0].corta;   // el primero de la llamada: con lo del segundo plano
  dichos = dichos.filter(function (d, i) { return dichos.indexOf(d) === i; });
  return dichos.join(' ') + (completo ? ' ' + CLAUDIO_LOCAL_PEDIDO_ : '');
}
/* o.texto: el hilo de Claudio por escrito (claudioacciones.js): sin volver_con_alma, sin cortar la respuesta a lo que cabe
   en voz y sin repetir en el chat lo que el hilo ya guarda (sin_chat). */
function claudioLocalTurno_(adm, conv, system, msgs, o) {
  o = o || {};
  var t0 = Date.now(), tools = claudioLocalHerramientas_().filter(function (h) { return !o.texto || (h.name !== 'volver_con_alma' && h.name !== CLAUDIO_PONER_VOZ_); }), corridas = [], volver = false, dicho = '', msIa = 0, poner = null;
  for (var v = 0; v < CLAUDIO_LOCAL_VUELTAS_; v++) {
    if (v && Date.now() - t0 > CLAUDIO_LOCAL_MS_) break;
    var ti = Date.now(), j = claudeTools_(rapidoModelo_(), system, msgs, tools, 900, { sinTemperatura: true, esfuerzo: 'low', funcion: 'Claudio · voz local' });
    msIa += Date.now() - ti;
    if (!j) return { ok: false, hablar: CLAUDIO_LOCAL_REPITE_, volver: false, herramientas: corridas, error: 'la IA no respondió' };
    var bloques = j.content || [], usos = bloques.filter(function (x) { return x.type === 'tool_use'; });
    var txt = bloques.filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join(' ').trim();
    if (txt) dicho = txt;
    if (!usos.length) break;
    msgs.push({ role: 'assistant', content: bloques });
    var salidas = [];
    var res = usos.map(function (u) {
      var out;
      if (u.name === 'volver_con_alma') { volver = true; out = { ok: true }; }
      else if (u.name === CLAUDIO_PONER_VOZ_) { poner = claudioLocalPoner_(u.input); out = { ok: true, hecho: 'La app la pone en cuanto termines tu frase. Di solo «Te la pongo.» y nada más.' }; }
      else if (CLAUDIO_HERR_.indexOf(u.name) >= 0) {
        out = claudioEjecutar_(adm, u.name, Object.assign({}, u.input || {}, { conv_id: conv }, o.texto ? { sin_chat: true } : {}));
        corridas.push(u.name);
      } else out = { ok: false, error: 'herramienta desconocida' };
      salidas.push(out);
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out).slice(0, 6000) };
    });
    msgs.push({ role: 'user', content: res });
    if (volver || poner) break;   // ya dijo «Listo, te paso con Alma.» o «Te la pongo.»: no hace falta otra vuelta
    var listo = claudioLocalPedidoListo_(usos, salidas);
    if (listo) { dicho = listo; break; }   // el pedido salió: la frase ya se sabe, sin otra vuelta de la IA
  }
  var hablar = o.texto ? String(dicho || '').replace(/\[\[[^\]]*\]\]/g, '').trim().slice(0, 2400) : claudioLocalHablar_(dicho);
  if (volver && !hablar) hablar = 'Listo, te paso con Alma.';
  if (poner && !hablar) hablar = 'Te la pongo.';
  var r = { ok: true, hablar: hablar || CLAUDIO_LOCAL_REPITE_, volver: volver, herramientas: corridas, ms: Date.now() - t0, ms_ia: msIa };
  if (poner && !volver) r.poner = poner;   // la app la suena después de su frase (PonerVoz.swift)
  return r;
}
/* poner_voz con Claudio local (#779): solo lo que la app entiende, en texto y corto. */
function claudioLocalPoner_(x) {
  x = x || {}; var p = {};
  ['voz', 'enlace', 'frase'].forEach(function (k) { var v = String(x[k] == null ? '' : x[k]).replace(/\s+/g, ' ').trim().slice(0, 400); if (v) p[k] = v; });
  return p;
}
