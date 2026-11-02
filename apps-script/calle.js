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
   «Va, te aviso cuando termine».
   audio (opcional): la frase con la voz de Alma (ElevenLabs, eleven_flash_v2_5), solo si llegó en 3 s o menos; si no,
   la app la dice con la voz del iPhone. Cuenta en el cupo como «Voz» (nunca se pausa).

   NOTIFICACIÓN HABLADA: la app dice al oído los avisos importantes (los que piden algo de Juan) y escucha 8 s.
   vozAvisos (voz.js) trae en cada aviso su frase corta (hablar) e importante; avisoHablar { aviso_id } da además el
   audio. Si contesta, la app llama a «calle» con { texto, aviso_id }: la respuesta va a esa tarjeta de Pendientes
   (pendResponder_: entra al Chat con Alma y la tarjeta se cierra).

   calleUso: una fila por salida en ALMA_CALLE_USO (cuánto duró, batería, cuántas veces despertó y cuántas fueron falsas). */

var CALLE_PLAZO_ = 15000;          // el plazo duro de una frase (ms)
var CALLE_AUDIO_MS_ = 3000;        // el audio solo vale si ElevenLabs contestó en este tiempo
var CALLE_PALABRAS_ = 20;          // lo más largo que se dice al oído
var CALLE_SIGUE_ = 'Va, te aviso cuando termine.';
var CALLE_VOZ_RESPALDO_ = 'qpGRZJK2msOprnlnBj0M';   // la voz del agente, por si VOZ_VOICE_ID todavía no está guardada
var CALLE_USO_CAB_ = ['ts', 'usuario', 'inicio', 'fin', 'minutos', 'bateria_ini', 'bateria_fin', 'bateria_gastada', 'despertares', 'falsos'];
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
  var audio = calleAudio_(out.hablar, t0); if (audio) out.audio = audio;
  return out;
}

/* Lo que devuelve opProcesar_ (o pendResponder_) → la frase para el oído. */
function calleRespuesta_(adm, r) {
  if (r.seguira) return { ok: true, hablar: CALLE_SIGUE_, conversar: false, seguira: true };
  var texto = String((r.alma && r.alma.texto) || ''), acc = (r.alma && r.alma.acciones) || [];
  var falla = acc.filter(function (a) { return a && a.error; })[0];
  if (falla) return { ok: true, hablar: calleCorto_('No se pudo: ' + calleLimpiar_(falla.resumen || falla.tipo || 'lo que pediste'), CALLE_PALABRAS_), conversar: false };
  /* Un pedido para Claude queda de borrador: se dice en corto y se contesta con la próxima frase («Alma, mándalo»). */
  if (r.borrador && (typeof r.borrador === 'object' || r.borrador === 'agregar')) {
    var bc = null; try { bc = claudeBorradorLeer_(adm.email); } catch (e) {}
    if (bc) return { ok: true, hablar: 'Le pediría a Claude: «' + claudeBorradorCorto_(bc, 90) + '». ¿Se lo mando?', conversar: false };
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

/* La frase con la voz de Alma (base64 mp3) o '' si no hay llave, si ya tardó mucho o si ElevenLabs pasó de 3 s.
   UrlFetch no se puede cortar a medio camino: si tarda, la respuesta igual espera y el audio se descarta. */
function calleAudio_(hablar, t0) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY');
  var texto = ''; try { texto = vozSinNotas_(hablar); } catch (e) { texto = String(hablar || ''); }
  if (!key || !texto || p.getProperty('CALLE_AUDIO') === '0') return '';
  if (t0 && Date.now() - t0 > CALLE_PLAZO_) return '';   // ya esperó bastante: que hable el iPhone
  var ini = Date.now();
  try {
    var voz = vozVozId_() || CALLE_VOZ_RESPALDO_;
    var r = uf_('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voz) + '?output_format=mp3_44100_64', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key },
      payload: JSON.stringify({ text: texto, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.6, similarity_boost: 0.8, speed: 1.05 } }) }, 'Voz');
    var ms = Date.now() - ini;
    if (r.getResponseCode() !== 200) { console.error('calleAudio_ ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 200)); return ''; }
    if (ms > CALLE_AUDIO_MS_) { console.warn('calleAudio_: tardó ' + ms + ' ms, sin audio'); return ''; }
    return Utilities.base64Encode(r.getBlob().getBytes());
  } catch (e) { console.error('calleAudio_: ' + e); return ''; }
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
  if (importante) {
    var sinPreg = (base.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) || []).filter(function (f) { return !/\?\s*["»”)]*\s*$/.test(f); }).join(' ').trim();
    base = calleCorto_(sinPreg || base, CALLE_PALABRAS_ - 3).replace(/[\s.!?…,;:]+$/, '');
    return { hablar: (base ? base + '. ' : '') + '¿Lo vemos?', importante: true, nivel: nivel };
  }
  return { hablar: calleCorto_(base, CALLE_PALABRAS_), importante: false, nivel: nivel };
}
/* avisoHablar { aviso_id } → { ok, id, nivel, hablar, importante, audio? }. Busca en el historial de avisos (3 días). */
function avisoHablar_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var id = String(b.aviso_id || b.id || ''); if (!id) return { ok: false, error: 'falta aviso_id' };
  var a = calleAvisoHist_(adm, id), pends = pendFilas_();
  if (!a) { var pd = callePendDeAviso_(pends, id); if (pd) a = { id: id, texto: pd.resumen || pd.titulo }; }
  if (!a) return { ok: false, error: 'Ya no encuentro ese aviso.' };
  var h = avisoHablarDe_(a, retLeer_(adm), pends), t0 = Date.now();
  var out = { ok: true, id: id, nivel: h.nivel, hablar: h.hablar, importante: h.importante };
  var audio = calleAudio_(h.hablar, t0); if (audio) out.audio = audio;
  return out;
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

/* ── calleUso { inicio, fin, bateria_ini, bateria_fin, despertares, falsos } → una fila en ALMA_CALLE_USO ── */
function calleUso_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var fecha = function (x) {
    if (x === '' || x == null) return null;
    var d = new Date(typeof x === 'number' || /^\d+$/.test(String(x)) ? Number(x) : String(x));
    return isNaN(d.getTime()) ? null : d;
  };
  var num = function (x) { return x === '' || x == null || isNaN(Number(x)) ? '' : Number(x); };
  var ini = fecha(b.inicio), fin = fecha(b.fin);
  if (!ini) return { ok: false, error: 'falta inicio' };
  var bi = num(b.bateria_ini), bf = num(b.bateria_fin);
  var fila = [new Date().toISOString(), adm.email, ini.toISOString(), fin ? fin.toISOString() : '',
    fin ? Math.round((fin.getTime() - ini.getTime()) / 6000) / 10 : '', bi, bf, bi !== '' && bf !== '' ? Math.round((bi - bf) * 1000) / 1000 : '',
    num(b.despertares), num(b.falsos)];
  hojaCrear_('ALMA_CALLE_USO', CALLE_USO_CAB_).appendRow(fila);
  return { ok: true };
}
