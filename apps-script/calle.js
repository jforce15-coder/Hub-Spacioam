/* ═══ MODO CALLE (alma-app #50) ═══════════════════════════════════════════════════════════════════════════
   Juan va caminando: teléfono bloqueado y audífonos. Dice «Alma», la app capta UNA frase en el teléfono y llama a la
   acción «calle» con su sesión. Lo que pide pasa por el mismo Chat con Alma (opProcesar_, canal «calle»: queda guardado
   con su esfera) y vuelve una frase corta para decirla al oído:
     · lo que no necesita respuesta (anotar, recordar, mandar un mensaje, contactar a alguien) se hace y se confirma
       con «Listo, …» (1 o 2 segundos);
     · una pregunta, una respuesta corta;
     · si hace falta elegir o conversar, conversar = true y la app abre la llamada de ElevenLabs.
   La frase corta sale de la misma respuesta de Alma (CALLE_REGLA_ en el prompt, sin otra llamada a la IA) y
   calleHablar_ le quita lo que no se puede decir (markdown, listas, enlaces, etiquetas [[…]]).
   Plazo duro (CALLE_PLAZO_, 15 s): si no alcanza, el agente lo sigue en segundo plano (retomar.js) y Alma dice
   «Sigo en eso; te aviso al terminar» (nunca «Listo»: todavía no está hecho).
   NUNCA EN SILENCIO (Juan, 4-nov-2026): la app espera la respuesta 25 s; si no llega, Alma dice «No me llegó la respuesta,
   ¿me lo repites?» y el porqué queda en el diagnóstico. Por eso el audio se deja de pedir a los 20 s (CALLE_AUDIO_PLAZO_).
   audio: la frase con la voz de Alma (ElevenLabs, eleven_flash_v2_5). Si ElevenLabs tarda, el audio igual se manda (ya se
   esperó: tirarlo solo hacía que hablara la voz del iPhone, una voz de hombre en el teléfono de Juan, 3-nov-2026). Las
   frases repetidas («Listo.», «Sigo en eso…») quedan 6 h en caché. Cuenta en el cupo como «Voz» (nunca se pausa).
   calleVoz { texto }: solo la voz de Alma para una frase que la app dice sin audio (sus propios avisos de error, la
   respuesta del chat); la voz del iPhone (femenina, elegida por la app) queda solo para cuando no hay internet.
   POR QUÉ NO HUBO VOZ (Juan, 3-nov-2026, TestFlight 142: «el Hub no mandó la voz» y nadie sabía por qué): calleAudio_
   deja el motivo en CALLE_VOZ_MOTIVO_ (sin llave, apagada, sin permiso «Text to Speech» en la llave, sin créditos, la voz
   no existe, ElevenLabs falló…) y calleVoz lo devuelve en `motivo`: la app lo pone en el diagnóstico («el Hub no mandó la
   voz: <motivo>»). Si ElevenLabs dice que la llave no tiene permiso o no hay créditos, no se le vuelve a preguntar en 5 min
   (calle_voz_no, en caché): contesta al instante con el mismo motivo. Si rechaza el modelo rápido para esta voz (400/422),
   se intenta una vez con VOZ_TTS_MODELO (o eleven_multilingual_v2). Nunca se escribe la llave: solo si falta.

   NOTIFICACIÓN HABLADA: la app dice al oído los avisos importantes (los que piden algo de Juan) y escucha 8 s.
   vozAvisos (voz.js) trae en cada aviso su frase corta (hablar) e importante; avisoHablar { aviso_id } da además el
   audio. Si contesta, la app llama a «calle» con { texto, aviso_id }: la respuesta va a esa tarjeta de Pendientes
   (pendResponder_: entra al Chat con Alma y la tarjeta se cierra).

   SUEÑO (Juan, 3-nov-2026): la llamada que abre el Modo calle (por «Alma» o por un aviso) la cuelga la app sola, rápido,
   para no gastar créditos de ElevenLabs: tras calle_silencio_s de silencio de Juan después de que Alma habló, si dice
   «espera», «luego» o «es todo», a los calle_tope_s sin que Alma hable, o si otra llamada, Siri o los audífonos cortan el
   audio. Luego vuelve a esperar «Alma» solo con el detector del teléfono. Los segundos van en la ficha (calleSueno_).

   calleUso: una fila por salida en ALMA_CALLE_USO (cuánto duró, batería, cuántas veces despertó y cuántas fueron falsas,
   y los segundos de llamada con ElevenLabs y cuántas colgó el sueño); calleUsoLeer las muestra en Ajustes → Uso de la app. */

var CALLE_PLAZO_ = 15000;          // el plazo duro de una frase (ms)
var CALLE_AUDIO_PLAZO_ = 20000;    // con más de esto desde que llegó el pedido ya no se pide el audio (la app espera 25 s y dice «No me llegó la respuesta…»)
var CALLE_VOZ_MAX_ = 400;          // calleVoz: lo más largo que se convierte en voz (caracteres)
var CALLE_PALABRAS_ = 20;          // lo más largo que se dice al oído
var CALLE_SIGUE_ = 'Sigo en eso; te aviso al terminar.';   // todavía no está hecho: nada de «Listo» (Juan, 3-nov-2026)
var CALLE_VOZ_RESPALDO_ = 'qpGRZJK2msOprnlnBj0M';   // la voz del agente, por si VOZ_VOICE_ID todavía no está guardada
var CALLE_TTS_MODELO_ = 'eleven_flash_v2_5';   // el modelo rápido (la Propiedad CALLE_TTS_MODELO lo cambia)
var CALLE_VOZ_NO_MIN_ = 5;         // sin permiso o sin créditos: minutos sin volver a preguntarle a ElevenLabs
var CALLE_VOZ_MOTIVO_ = '';        // por qué la última frase salió sin audio ('' si salió bien)
var CALLE_SILENCIO_S_ = 6;         // sueño: segundos de silencio de Juan, después de que Alma habló, para colgar
var CALLE_TOPE_S_ = 45;            // sueño: segundos sin que Alma hable para colgar aunque haya ruido o gente cerca
/* La regla del canal (agente.js, opAgente_): la respuesta ya sale corta y para decirla. */
var CALLE_REGLA_ = 'MODO CALLE: va caminando con el teléfono bloqueado y audífonos; tu respuesta se dirá al oído. ' +
  'Si pide algo que no necesita respuesta (anotar, recordar, mandar un mensaje, contactar a alguien), hazlo con tus herramientas y confirma en UNA frase muy corta que empiece con «Listo, …» (p. ej. «Listo, anotado», «Listo, le escribí a Flor»). ' +
  'Si pregunta algo, responde en una o dos frases cortas, de 20 palabras como mucho. Sin listas, sin markdown, sin enlaces, sin emojis. ' +
  'Si de verdad tiene que elegir entre opciones o hace falta conversar, escribe una sola frase corta que lo introduzca y termina con una línea aparte: [[conversar]].';

/* calle { texto, aviso_id? } → { ok, hablar, conversar, audio?, seguira? } */
function calle_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var texto = String(b.texto || '').trim().slice(0, 2000);
  if (!texto) return { ok: false, error: 'falta el texto', hablar: 'No te escuché bien. ¿Me lo repites?', conversar: false };
  var t0 = Date.now(), r;
  AGENTE_PLAZO_ = t0 + CALLE_PLAZO_; AGENTE_PEDIDO_ = texto; AGENTE_APP_ = true;   // viene de la app de Alma
  try { r = b.aviso_id ? calleAviso_(ses, adm, texto, String(b.aviso_id)) : opProcesar_(adm, texto, 'calle', []); }
  catch (e) { console.error('calle_: ' + (e.stack || e)); r = { ok: false, error: String(e) }; }
  finally { AGENTE_PLAZO_ = 0; AGENTE_PEDIDO_ = ''; AGENTE_APP_ = false; }
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'error', hablar: 'Tuve un problema. ¿Lo intentas otra vez?', conversar: false };
  var out = calleRespuesta_(adm, r);
  var audio = calleAudio_(out.hablar, t0); if (audio) out.audio = audio; else out.vozMotivo = CALLE_VOZ_MOTIVO_;
  return out;
}

/* Lo que devuelve opProcesar_ (o pendResponder_) → la frase para el oído. */
function calleRespuesta_(adm, r) {
  if (r.seguira) return { ok: true, hablar: CALLE_SIGUE_, conversar: false, seguira: true };
  var texto = String((r.alma && r.alma.texto) || ''), acc = (r.alma && r.alma.acciones) || [];
  var falla = acc.filter(function (a) { return a && a.error; })[0];
  if (falla) return { ok: true, hablar: calleCorto_('No se pudo: ' + calleLimpiar_(falla.resumen || falla.tipo || 'lo que pediste'), CALLE_PALABRAS_), conversar: false };
  /* Un borrador viejo (del 1 al 3-nov) que sigue esperando: solo la pregunta, sin leerlo. Los pedidos nuevos salen solos. */
  if (r.borrador && (typeof r.borrador === 'object' || r.borrador === 'agregar')) {
    var bc = null; try { bc = claudeBorradorLeer_(adm.email); } catch (e) {}
    if (bc) {
      var nm = '«' + (bc.microNombre || '') + '»';   // microproyecto (#374): a cuál va, o la duda
      var h = bc.microDuda ? '«' + claudeBorradorCorto_(bc, 90) + '». ¿Es parte de ' + nm + ' o es nuevo?'
        : bc.micro ? '¿Lo sumo a ' + nm + ' y lo pido?' : '¿Lo pido?';   // sin leer el pedido de vuelta (Juan, 3-nov-2026)
      return { ok: true, hablar: h, conversar: false };
    }
  }
  if (r.conversar || calleTieneOpciones_(texto)) return { ok: true, hablar: calleEntrada_(texto), conversar: true };
  return { ok: true, hablar: calleHablar_(texto) || 'Listo.', conversar: false };
}

/* Quita [[conversar]] del texto (opProcesar_ lo llama antes de guardar). */
function calleSacarConversar_(t) {
  var s = String(t || ''), si = /\[\[\s*conversar\s*\]\]/i.test(s);
  return { texto: s.replace(/\[\[\s*conversar\s*\]\]/gi, '').replace(/[ \t]+$/gm, '').trim(), conversar: si };
}
/* ¿Trae opciones para elegir? La tarjeta de acción del chat ([[opciones]] o una pregunta con 2 a 5 viñetas). */
function calleTieneOpciones_(t) {
  if (/\[\[\s*opciones\s*\]\]/i.test(String(t || ''))) return true;
  try { return !!chatOpciones_(t); } catch (e) { return false; }
}
/* Texto → algo que se puede decir: sin etiquetas [[…]], markdown, viñetas, enlaces ni emojis; las líneas, frases. */
function calleLimpiar_(t) {
  var s = String(t == null ? '' : t).replace(/\r\n?/g, '\n')
    .replace(/\[\[[\s\S]*?\]\]/g, ' ')                                    // [[esfera: …]], [[opciones]], [[conversar]]
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')                           // [texto](enlace) → texto
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/^\s*(?:[-•·*]|\d+[.)])\s+/gm, '')                            // viñetas y listas numeradas
    .replace(/^\s*#+\s*/gm, '').replace(/^\s*>\s?/gm, '')
    .replace(/\*\*|__|[*`~|]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '');
  s = s.split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
    .map(function (l) { return /[.!?…:;,»"”)]$/.test(l) ? l : l + '.'; }).join(' ');
  try { s = vozSinNotas_(s); } catch (e) {}
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?…])/g, '$1').replace(/([.!?])\.+/g, '$1').trim();
}
/* Las primeras frases enteras que caben en n palabras; si la primera ya es más larga, se corta con «…». */
function calleCorto_(s, n) {
  s = String(s || '').trim(); if (!s) return '';
  var frases = s.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) || [s], out = '', cuenta = 0;
  for (var i = 0; i < frases.length; i++) {
    var f = frases[i].trim(), w = f.split(/\s+/).filter(Boolean).length;
    if (cuenta + w > n) break;
    out += (out ? ' ' : '') + f; cuenta += w;
  }
  if (!out) out = s.split(/\s+/).slice(0, n).join(' ').replace(/[,;:.\-–—]+$/, '') + '…';
  return out;
}
function calleHablar_(t) { return calleCorto_(calleLimpiar_(t), CALLE_PALABRAS_); }
/* Con opciones: una sola frase que lo introduce (la pregunta de la tarjeta o la primera frase); la llamada sigue. */
function calleEntrada_(t) {
  var op = null; try { op = chatOpciones_(t); } catch (e) {}
  var antes = String(t || '').split(/\[\[\s*opciones\s*\]\]/i)[0];
  var base = calleLimpiar_(op && op.pregunta ? op.pregunta : antes);
  var una = (base.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/) || [''])[0].trim();
  return calleCorto_(una || base, CALLE_PALABRAS_) || 'Mejor lo hablamos.';
}

/* La frase con la voz de Alma (base64 mp3) o '' si no hay llave, si ya pasó CALLE_AUDIO_PLAZO_ o si ElevenLabs falló; el
   porqué queda en CALLE_VOZ_MOTIVO_. Las frases cortas quedan 6 h en la caché (una sola parte de 90 KB como mucho: más
   larga, no se guarda). */
function calleAudio_(hablar, t0) {
  CALLE_VOZ_MOTIVO_ = '';
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY');
  var texto = ''; try { texto = vozSinNotas_(hablar); } catch (e) { texto = String(hablar || ''); }
  texto = String(texto || '').trim();
  if (!texto) { CALLE_VOZ_MOTIVO_ = 'la frase venía vacía'; return ''; }
  if (!key) { CALLE_VOZ_MOTIVO_ = 'falta ELEVENLABS_KEY en las Propiedades del script'; return ''; }
  if (p.getProperty('CALLE_AUDIO') === '0') { CALLE_VOZ_MOTIVO_ = 'la voz está apagada (Propiedad CALLE_AUDIO = 0)'; return ''; }
  if (t0 && Date.now() - t0 > CALLE_AUDIO_PLAZO_) { CALLE_VOZ_MOTIVO_ = 'la respuesta tardó más de ' + (CALLE_AUDIO_PLAZO_ / 1000) + ' s'; return ''; }   // la app está por dejar de esperar
  var voz = '', c = CacheService.getScriptCache(), k = '';
  try {
    var no = c.get('calle_voz_no'); if (no) { CALLE_VOZ_MOTIVO_ = no; return ''; }   // sin permiso o sin créditos: no se insiste
    voz = vozVozId_() || CALLE_VOZ_RESPALDO_;
    k = 'callevoz_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, voz + '|' + texto, Utilities.Charset.UTF_8));
    var ya = c.get(k); if (ya) return ya;
  } catch (e) { console.error('calleAudio_ caché: ' + e); }
  voz = voz || CALLE_VOZ_RESPALDO_;
  var rapido = p.getProperty('CALLE_TTS_MODELO') || CALLE_TTS_MODELO_, otro = p.getProperty('VOZ_TTS_MODELO') || 'eleven_multilingual_v2';
  var modelos = otro !== rapido ? [rapido, otro] : [rapido];
  for (var i = 0; i < modelos.length; i++) {
    var ini = Date.now(), r;
    try {
      r = uf_('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voz) + '?output_format=mp3_44100_64', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key },
        payload: JSON.stringify({ text: texto, model_id: modelos[i], voice_settings: { stability: 0.6, similarity_boost: 0.8, speed: 1.05 } }) }, 'Voz');
    } catch (e) { CALLE_VOZ_MOTIVO_ = 'no pude llamar a ElevenLabs (' + String(e).slice(0, 90) + ')'; console.error('calleAudio_: ' + e); return ''; }
    var ms = Date.now() - ini, code = r.getResponseCode();
    if (code === 200) {
      if (ms > 3000) console.warn('calleAudio_: ElevenLabs tardó ' + ms + ' ms (el audio igual se manda)');
      if (i > 0) console.warn('calleAudio_: ' + modelos[0] + ' no sirvió con la voz ' + voz + '; salió con ' + modelos[i]);
      var b64 = Utilities.base64Encode(r.getBlob().getBytes());
      if (k && b64.length <= 90000) { try { c.put(k, b64, 21600); } catch (e) {} }
      return b64;
    }
    var cuerpo = String(r.getContentText() || '').slice(0, 400), m = calleVozMotivo_(code, cuerpo, voz, modelos[i]);
    console.error('calleAudio_ ' + code + ' (' + modelos[i] + '): ' + cuerpo.slice(0, 200));
    CALLE_VOZ_MOTIVO_ = m.motivo;
    if (m.pausar) { try { c.put('calle_voz_no', m.motivo, CALLE_VOZ_NO_MIN_ * 60); } catch (e) {} }
    if (!m.otroModelo) return '';
  }
  return '';
}
/* Lo que contestó ElevenLabs → { motivo, pausar, otroModelo }: el motivo en palabras simples para el diagnóstico,
   si conviene dejar de preguntar unos minutos (permiso o créditos) y si vale la pena intentar con otro modelo. */
function calleVozMotivo_(code, cuerpo, voz, modelo) {
  var d = {}; try { d = (JSON.parse(cuerpo || '{}') || {}).detail || {}; } catch (e) {}
  if (typeof d === 'string') d = { message: d };
  var st = String(d.status || d.code || '').toLowerCase(), msg = String(d.message || d.msg || (Array.isArray(d) && d[0] && d[0].msg) || '').slice(0, 120);
  var todo = (st + ' ' + msg + ' ' + String(cuerpo || '')).toLowerCase();
  if (/missing_permissions|permission/.test(todo)) return { motivo: 'la llave de ElevenLabs no tiene el permiso «Text to Speech» (actívalo en ElevenLabs → API keys)', pausar: true, otroModelo: false };
  if (/quota_exceeded|credits|insufficient/.test(todo) || code === 402) return { motivo: 'se acabaron los créditos de ElevenLabs', pausar: true, otroModelo: false };
  if (/invalid_api_key|api key/.test(todo) || code === 401) return { motivo: 'ElevenLabs no acepta la llave ELEVENLABS_KEY (401' + (st ? ' ' + st : '') + ')', pausar: true, otroModelo: false };
  if (code === 429) return { motivo: 'ElevenLabs está ocupada (429: demasiadas a la vez)', pausar: false, otroModelo: false };
  if (/voice_not_found/.test(todo) || code === 404) return { motivo: 'ElevenLabs no encuentra la voz ' + voz, pausar: false, otroModelo: false };
  if (code === 400 || code === 422) return { motivo: 'ElevenLabs rechazó ' + modelo + ' con la voz ' + voz + ' (' + code + (msg ? ': ' + msg : st ? ': ' + st : '') + ')', pausar: false, otroModelo: true };
  return { motivo: 'ElevenLabs respondió ' + code + (msg ? ': ' + msg : st ? ': ' + st : ''), pausar: false, otroModelo: false };
}

/* calleVoz { texto } → { ok, audio } — la voz de Alma para una frase que la app iba a decir sin audio. Sin audio
   (sin llave o ElevenLabs falló): { ok: false, motivo } y la app usa la voz del iPhone y anota el motivo. */
function calleVoz_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var texto = String(b.texto || '').trim().slice(0, CALLE_VOZ_MAX_);
  if (!texto) return { ok: false, error: 'falta el texto' };
  var audio = calleAudio_(texto, 0);
  return audio ? { ok: true, audio: audio } : { ok: false, error: 'sin audio', motivo: CALLE_VOZ_MOTIVO_ || 'ElevenLabs no mandó audio' };
}

/* Los segundos del sueño para la ficha de la llamada (vozWebInicio_). Se ajustan sin otra versión con las Propiedades del
   script CALLE_SILENCIO_S (3 a 30) y CALLE_TOPE_S (15 a 180). */
function calleSueno_() {
  var p = PropertiesService.getScriptProperties();
  var num = function (k, d, min, max) { var n = Number(p.getProperty(k)); return n > 0 ? Math.max(min, Math.min(max, n)) : d; };
  return { silencio: num('CALLE_SILENCIO_S', CALLE_SILENCIO_S_, 3, 30), tope: num('CALLE_TOPE_S', CALLE_TOPE_S_, 15, 180) };
}

/* ── Notificación hablada ── */
/* La tarjeta de Pendientes de un aviso: el aviso lleva el id del tema por retomar (ret_id) o el de la tarjeta. */
function callePendDeAviso_(pends, avisoId) {
  avisoId = String(avisoId || ''); if (!avisoId) return null;
  return (pends || []).filter(function (x) { return String(x.ret_id) === avisoId || String(x.id) === avisoId; }).pop() || null;
}
/* NIVEL DE NOTIFICACIONES: 1 urgente (un huésped espera al equipo: rojo o escalado, promesas vencidas) · 2 acción (pide
   algo de Juan: tarjeta «Necesita tu sí» abierta o tema por retomar) · 3 aviso (no pide nada). El que trae el aviso manda;
   si no trae, sale de su tarjeta de Pendientes o de los temas por retomar. Sin IA. */
var CALLE_ORIGEN_URGENTE_ = ['rojo', 'escalado', 'promesa'];
function avisoNivel_(a, rets, pends) {
  var n = Number(a && a.nivel); if (n >= 1 && n <= 3) return n;
  var pd = callePendDeAviso_(pends, a && a.id);
  if (pd) return pd.tipo === 'atencion' && pendVivo_(pd, Date.now()) ? (CALLE_ORIGEN_URGENTE_.indexOf(String(pd.origen)) >= 0 ? 1 : 2) : 3;
  return (rets || []).some(function (x) { return x && String(x.id) === String(a && a.id); }) ? 2 : 3;
}
/* La frase de un aviso: corta, sin enlaces; si es de nivel 1 o 2 (pide algo de él) es importante y termina con
   «¿Lo vemos?». Sin IA: sale del texto del aviso (o del resumen de la tarjeta). */
function avisoHablarDe_(a, rets, pends) {
  a = a || {};
  var pd = callePendDeAviso_(pends, a.id), nivel = avisoNivel_(a, rets, pends), importante = nivel <= 2;
  var base = calleLimpiar_(a.texto || (pd && (pd.resumen || pd.titulo)) || '');
  /* Terminó algo de segundo plano (aviso con resultado): en modo conferencia la app lo dice sin que Juan la llame. Lo que
     pidió en una llamada del modo conferencia (a.conferencia) llega como nivel 1, pero se dice como resultado. */
  if (a.resultado && (!importante || a.conferencia)) {   // si pide algo de él, gana «¿Lo vemos?» (una sola pregunta, nunca «¿Le pago. ¿Quieres verlo…?»)
    base = (base.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) || []).filter(function (f) { return !/\?\s*["»”)]*\s*$/.test(f); }).join(' ').trim() || base;
    base = calleCorto_(base, a.conferencia ? CALLE_PALABRAS_ : CALLE_PALABRAS_ - 8).replace(/[\s.!?…,;:]+$/, '');   // en conferencia lo que pidió: la respuesta, no solo el aviso
    var yaDice = /\b(list[oa]s?|termin\w*|qued[oó]|hecho|ya tengo|ya est[aá])\b/i.test(base);   // «La limpieza quedó lista», «Ya tengo…»: sin repetir «Ya quedó listo»
    return { hablar: (base ? (yaDice ? base : 'Ya quedó listo: ' + base) : 'Ya quedó listo') + '. ¿Quieres verlo ahora?', importante: importante, nivel: nivel };
  }
  if (importante) {
    var sinPreg = (base.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) || []).filter(function (f) { return !/\?\s*["»”)]*\s*$/.test(f); }).join(' ').trim();
    base = calleCorto_(sinPreg || base, CALLE_PALABRAS_ - 3).replace(/[\s.!?…,;:]+$/, '');
    return { hablar: (base ? base + '. ' : '') + '¿Lo vemos?', importante: true, nivel: nivel };
  }
  return { hablar: calleCorto_(base, CALLE_PALABRAS_), importante: false, nivel: nivel };
}
/* La respuesta en la notificación (Juan, 3-nov: «muy escueta»): hasta n líneas cortas del resultado, sin markdown, enlaces,
   etiquetas [[…]], la lista de lo hecho ni textos internos. Sin IA. */
var AVISO_LINEA_MAX_ = 110;
function avisoLineas_(texto, n) {
  var s = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n').replace(/\n\s*Hecho:[\s\S]*$/, '')
    .replace(/\[\[[\s\S]*?\]\]/g, ' ').replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1').replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/\*\*|__|[*`~]/g, '');
  var ls = s.split('\n').map(function (l) {
    return l.replace(/^\s*(?:[-•·]|\d+[.)])\s+/, '').replace(/^\s*#+\s*/, '').replace(/^\s*>\s?/, '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  }).filter(function (l) {
    return l.length > 2 && !/^[-:\s]+$/.test(l) && !/^[{\[]/.test(l) && !/\b(secretaria|end_call|segundo_plano|skip_turn|mostrar_en_chat|TARDA MÁS)\b/i.test(l);
  });
  if (ls.length === 1) ls = (ls[0].match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) || ls).map(function (f) { return f.trim(); }).filter(Boolean);   // un solo párrafo: sus frases
  return ls.slice(0, n || 3).map(function (l) { return l.length <= AVISO_LINEA_MAX_ ? l : l.slice(0, AVISO_LINEA_MAX_ - 1).replace(/\s+\S*$/, '') + '…'; });
}
/* avisoHablar { aviso_id, resultado? } → { ok, id, nivel, hablar, importante, audio? }. Busca en el historial de avisos
   (3 días). resultado: la app sabe que terminó algo de segundo plano (lo de nivel 3 no entra al historial). Solo arma la
   frase: no responde el aviso (eso es «calle» con { texto, aviso_id }). */
function avisoHablar_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var id = String(b.aviso_id || b.id || ''); if (!id) return { ok: false, error: 'falta aviso_id' };
  var a = calleAvisoHist_(adm, id), pends = pendFilas_();
  if (!a) { var pd = callePendDeAviso_(pends, id); if (pd) a = { id: id, texto: pd.resumen || pd.titulo }; }
  if (!a) return { ok: false, error: 'Ya no encuentro ese aviso.' };
  if (b.resultado) a = Object.assign({}, a, { resultado: true });
  var h = avisoHablarDe_(a, retLeer_(adm), pends), t0 = Date.now();
  var out = { ok: true, id: id, nivel: h.nivel, hablar: h.hablar, importante: h.importante };
  var audio = calleAudio_(h.hablar, t0); if (audio) out.audio = audio; else out.vozMotivo = CALLE_VOZ_MOTIVO_;
  return out;
}
/* LA VOZ CON EL AVISO (Juan, 6-nov-2026: «con la voz de Alma, no la del iPhone, sobre todo con la app abierta»): vozAvisos
   trae, junto con el texto, el audio de ElevenLabs de lo que la app va a decir, así suena sin otra vuelta al Hub (antes la
   app pedía avisoHablar al momento y, si tardaba más de 12 s, terminaba la voz del iPhone). La app dice si ahora puede
   hablar (b.ahora: Modo calle, conferencia o la app abierta), hasta qué nivel se dicen («Habladas», b.hablado 1–3) y si
   está en conferencia (b.conf: ahí lo que terminó en segundo plano se dice sea cual sea su nivel). Solo los que se van a
   decir, AVISO_AUDIO_MAX_ como mucho por vuelta (el resto lo pide la app con avisoHablar); sin audio va vozMotivo, que la
   app pone en el diagnóstico. Una app vieja no manda b.ahora: no se gasta ElevenLabs. */
var AVISO_AUDIO_MAX_ = 3;
function avisosConVoz_(lista, b) {
  b = b || {};
  var hablado = Number(b.hablado);
  if (b.ahora !== true || !(hablado >= 1) || !(lista || []).length) return lista;
  var t0 = Date.now(), n = 0;
  (lista || []).forEach(function (a) {
    var dice = a && a.hablar && (Number(a.nivel) <= hablado || (b.conf === true && a.resultado));
    if (!dice || n >= AVISO_AUDIO_MAX_) return;
    n++;
    var audio = calleAudio_(a.hablar, t0);   // la caché de 6 h sirve también para avisoHablar y calleVoz
    if (audio) a.audio = audio; else a.vozMotivo = CALLE_VOZ_MOTIVO_ || 'ElevenLabs no mandó audio';
  });
  return lista;
}
function calleAvisoHist_(adm, id) {
  var h = []; try { h = JSON.parse(PropertiesService.getScriptProperties().getProperty('VOZ_AVISOS_H_' + retClave_(adm).slice(8)) || '[]'); } catch (e) {}
  return h.filter(function (a) { return a && String(a.id) === String(id); }).pop() || null;
}
/* La respuesta hablada a un aviso: si tiene su tarjeta abierta en Pendientes, la responde (entra al Chat con Alma y
   la tarjeta se cierra); si no, va al chat con el aviso como contexto y el tema por retomar se da por atendido. */
function calleAviso_(ses, adm, texto, avisoId) {
  var pd = esAdminPrincipal_(adm) ? callePendDeAviso_(pendFilas_(), avisoId) : null;
  if (pd && pendVivo_(pd, Date.now())) {
    var r = pendResponder_(ses, { id: pd.id, texto: texto, canal: 'calle' });
    if (!r.ok) return r;
    return { ok: true, alma: { texto: r.respuesta || '', acciones: [] }, conversar: !!r.conversar, seguira: !!r.seguira, borrador: r.borrador, pendiente: pd.id };
  }
  var av = calleAvisoHist_(adm, avisoId);
  var nota = av ? 'Juan responde por voz, de camino, a este aviso que le diste: «' + String(av.texto).slice(0, 600) + '». Atiende su respuesta como siguiente paso de ese tema.' : '';
  var ro = opProcesar_(adm, texto, 'calle', [], nota);
  if (ro.ok && av) { try { retResolver_(adm, [String(avisoId)]); } catch (e) {} }
  return ro;
}

/* ── calleUso: una fila por salida en ALMA_CALLE_USO ──
   La app manda { usos: [{ inicio, fin, minutos, gatillos, despertares, descartes, falsos, pedidos, llamadas, avisos,
   errores, despertaresHora, falsosHora, gatillosHora, bateriaInicio?, bateriaFin?, bateriaGastada?, bateriaHora?,
   detector, llamadaSeg?, llamadasSleep?, llamadasCorte?, diag? }] } con las que todavía no llegaron (la batería en %). Se acepta también la forma vieja, plana:
   { inicio, fin, bateria_ini, bateria_fin, despertares, falsos } (batería de 0 a 1 → se guarda en %).
   `diag` (3-nov-2026): el diagnóstico de la salida en una línea (micrófono, cuántas veces el detector oyó «Alma», el
   último veredicto del dictado y el último error), para saber por qué no respondió sin tener el teléfono en la mano.
   La app reintenta lo que no recibió «ok»: una salida que ya está (mismo usuario e inicio) no se repite. */
var CALLE_USO_CAB_ = ['ts', 'usuario', 'inicio', 'fin', 'minutos', 'bateria_ini', 'bateria_fin', 'bateria_gastada', 'despertares', 'falsos',
  'bateria_hora', 'despertares_hora', 'falsos_hora', 'gatillos', 'gatillos_hora', 'descartes', 'pedidos', 'llamadas', 'avisos', 'errores', 'detector',
  'llamada_seg', 'llamadas_sleep', 'llamadas_corte',   // lo que se gasta en ElevenLabs (al final: lo de antes no se mueve)
  'diagnostico'];
function calleUsoHoja_() {
  var sh = hojaCrear_('ALMA_CALLE_USO', CALLE_USO_CAB_), n = CALLE_USO_CAB_.length;
  /* Una hoja hecha con una cabecera vieja (10 o 21 columnas): las nuevas van al final, lo de antes no se mueve. */
  if (sh.getLastColumn() < n) {
    if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
    sh.getRange(1, 1, 1, n).setValues([CALLE_USO_CAB_]);
  }
  return sh;
}
function calleUsoFecha_(x) {
  if (x === '' || x == null) return null;
  var d = new Date(typeof x === 'number' || /^\d+$/.test(String(x)) ? Number(x) : String(x));
  return isNaN(d.getTime()) ? null : d;
}
function calleUsoNum_(x) { return x === '' || x == null || isNaN(Number(x)) ? '' : Number(x); }
/* Una salida (forma nueva o vieja) → la fila, o null si no trae inicio. */
function calleUsoFila_(email, u) {
  u = u || {};
  var num = calleUsoNum_, ini = calleUsoFecha_(u.inicio), fin = calleUsoFecha_(u.fin);
  if (!ini) return null;
  var plana = u.bateriaInicio == null && u.bateriaFin == null && (u.bateria_ini != null || u.bateria_fin != null);
  var pct = function (x) { x = num(x); return x === '' ? '' : (plana && x <= 1 ? Math.round(x * 1000) / 10 : x); };
  var bi = pct(plana ? u.bateria_ini : u.bateriaInicio), bf = pct(plana ? u.bateria_fin : u.bateriaFin);
  var min = num(u.minutos); if (min === '' && fin) min = Math.round((fin.getTime() - ini.getTime()) / 6000) / 10;
  var horas = min !== '' && min > 0 ? Math.max(min / 60, 1 / 60) : 0;
  var porHora = function (n, dado) { dado = num(dado); if (dado !== '') return dado; n = num(n); return n === '' || !horas ? '' : Math.round(n / horas * 10) / 10; };
  var gastada = num(u.bateriaGastada); if (gastada === '' && bi !== '' && bf !== '') gastada = Math.round((bi - bf) * 10) / 10;
  return [new Date().toISOString(), email, ini.toISOString(), fin ? fin.toISOString() : '', min, bi, bf, gastada,
    num(u.despertares), num(u.falsos), porHora(gastada, u.bateriaHora), porHora(u.despertares, u.despertaresHora), porHora(u.falsos, u.falsosHora),
    num(u.gatillos), porHora(u.gatillos, u.gatillosHora), num(u.descartes), num(u.pedidos), num(u.llamadas), num(u.avisos), num(u.errores),
    String(u.detector || '').slice(0, 60), num(u.llamadaSeg), num(u.llamadasSleep), num(u.llamadasCorte),
    celdaTexto_(String(u.diag || '').slice(0, 1800))];
}
function calleUso_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var lista = Array.isArray(b.usos) ? b.usos.slice(0, 60) : [b];
  var filas = lista.map(function (u) { return calleUsoFila_(adm.email, u); }).filter(Boolean);
  if (!filas.length) return { ok: false, error: 'falta inicio' };
  var sh = calleUsoHoja_(), ya = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { ya[r[0] + '|' + (r[1] instanceof Date ? r[1].toISOString() : String(r[1]))] = true; });
  var nuevas = filas.filter(function (f) { var k = f[1] + '|' + f[2]; if (ya[k]) return false; ya[k] = true; return true; });
  if (nuevas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, CALLE_USO_CAB_.length).setValues(nuevas);
  return { ok: true, guardadas: nuevas.length };
}
/* calleUsoLeer { n? } → { ok, usos: [{ inicio, minutos, bateriaGastada, bateriaHora, despertares, falsos, despertaresHora,
   falsosHora, pedidos, llamadas, llamadaSeg, llamadasSleep, llamadasCorte }] }: las últimas salidas del principal, la más nueva primero (Ajustes → Uso de la app). Solo lee la hoja. */
function calleUsoLeer_(ses, b) {
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal.' };
  var n = Math.max(1, Math.min(30, Number(b && b.n) || 8));
  var sh = ssAlma_().getSheetByName('ALMA_CALLE_USO');
  if (!sh || sh.getLastRow() < 2) return { ok: true, usos: [] };
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), col = {};
  cab.forEach(function (c, i) { col[c] = i; });
  var mios = [adm.email].concat(adm.alternos || []);
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues().filter(function (r) { return mios.indexOf(String(r[col.usuario])) >= 0; });
  var de = function (r, k) { return col[k] == null || r[col[k]] === '' ? null : r[col[k]]; };
  var usos = v.slice(-n).reverse().map(function (r) {
    var ini = de(r, 'inicio');
    return { inicio: ini instanceof Date ? ini.toISOString() : String(ini || ''), minutos: de(r, 'minutos'), bateriaGastada: de(r, 'bateria_gastada'),
      bateriaHora: de(r, 'bateria_hora'), despertares: de(r, 'despertares'), falsos: de(r, 'falsos'),
      despertaresHora: de(r, 'despertares_hora'), falsosHora: de(r, 'falsos_hora'), pedidos: de(r, 'pedidos'),
      llamadas: de(r, 'llamadas'), llamadaSeg: de(r, 'llamada_seg'), llamadasSleep: de(r, 'llamadas_sleep'), llamadasCorte: de(r, 'llamadas_corte') };
  });
  return { ok: true, usos: usos };
}
