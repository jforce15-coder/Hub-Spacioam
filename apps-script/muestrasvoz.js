/* ═══ 15e · MUESTRAS DE VOZ (Juan, 18-nov-2026, #781) ═══════════════════════════════════════════════════════════════
   «Que Claudio pueda reproducir audios de las voces que Juan pida durante la llamada, y que también quede la opción de
   reproducirlos aquí, no solo de escucharlos con Claudio.»

   MUESTRA DE VOZ (glosario): una frase corta dicha con una voz de ElevenLabs, para oír cómo suena antes de escogerla.
   1. Juan le pide a Claudio una voz («ponme la voz de Alma», «una voz de hombre tranquila», «la de Rachel»). Claudio usa
      claudio_voces: el Hub la busca en las voces de la cuenta de ElevenLabs (las de Alma y Claudio por su nombre, luego
      /v2/voices) y, si no hay, en la biblioteca pública (/v1/shared-voices). Devuelve hasta MV_MAX_ voces con su voice_id.
   2. En la llamada: Claudio usa reproducir_voz (herramienta de CLIENTE: la app de iPhone pide la muestra con vozMuestra en
      el formato de la llamada y la pone por la misma salida que la voz del agente, así la cancelación de eco la resta del
      micrófono). Contesta cuando terminó de sonar; Claudio pregunta qué le pareció.
   3. Aquí (el hilo de Claudio, alma/claudio.html): cada búsqueda deja una tarjeta «Muestras de voz» con un botón ▶ por
      voz, para volver a oírlas cuando quiera, sin llamada. Va en el chat de Propósito · Desarrollo (columna tarjeta).
   Costo: la frase es corta (MV_FRASE_MAX_) y cada muestra queda MV_CACHE_S_ en caché (no se vuelve a pagar al repetir).
   Una voz de la biblioteca que la cuenta no deja usar por API suena con su muestra pública de ElevenLabs (solo en el hilo,
   en mp3); en la llamada Claudio lo dice. Solo el administrador principal (sesión verificada o la firma de Claudio).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var MV_MAX_ = 3;
var MV_FRASE_ = 'Hola, Juan. Así sueno yo. ¿Te gusta cómo se oye esta voz?';
var MV_FRASE_MAX_ = 180;
var MV_CACHE_S_ = 21600;                     // 6 h
var MV_HZ_ = [8000, 16000, 22050, 24000, 44100, 48000];   // los formatos PCM de ElevenLabs (el de la llamada)
/* Las etiquetas de ElevenLabs vienen en inglés: las más comunes, en español. */
var MV_ES_ = { female: 'mujer', male: 'hombre', neutral: 'neutra', young: 'joven', 'middle aged': 'adulta', middle: 'adulta', old: 'mayor',
  american: 'estadounidense', british: 'británica', australian: 'australiana', mexican: 'mexicana', spanish: 'española', 'latin american': 'latinoamericana',
  calm: 'tranquila', warm: 'cálida', narration: 'narración', conversational: 'conversación', 'social media': 'redes sociales', characters: 'personajes', news: 'noticias' };
var MV_ID_RE_ = /^[A-Za-z0-9]{12,40}$/;
var MV_PREVIEW_RE_ = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|elevenlabs\.io)\//;

function mvLlave_() { return PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY') || ''; }
function mvFrase_(f) { f = String(f || '').replace(/\s+/g, ' ').trim(); return (f || MV_FRASE_).slice(0, MV_FRASE_MAX_); }
function mvCorto_(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
function mvHuella_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(t), Utilities.Charset.UTF_8).slice(0, 8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
/* Lo que se sabe de cada voz encontrada (nombre y muestra pública): 6 h, para el hilo y para la llamada. */
function mvMetaGuardar_(v) { try { CacheService.getScriptCache().put('mvmeta_' + v.id, JSON.stringify(v), MV_CACHE_S_); } catch (e) {} }
function mvMeta_(id) { try { return JSON.parse(CacheService.getScriptCache().get('mvmeta_' + id) || 'null'); } catch (e) { return null; } }

/* Una voz de ElevenLabs en corto: { id, nombre, desc, preview, lib }. */
function mvVoz_(v, lib) {
  var l = v.labels || {}, partes = [v.gender || l.gender, v.age || l.age, v.accent || l.accent, v.use_case || l.use_case || l.description]
    .map(function (x) { x = String(x || '').replace(/_/g, ' ').trim().toLowerCase(); return MV_ES_[x] || x; }).filter(Boolean);
  var desc = mvCorto_(v.description || '', 90);
  return { id: String(v.voice_id || ''), nombre: mvCorto_(String(v.name || 'Sin nombre').split(' - ')[0], 40),
    desc: mvCorto_([partes.join(', '), desc].filter(Boolean).join(' · '), 120), preview: MV_PREVIEW_RE_.test(String(v.preview_url || '')) ? String(v.preview_url) : '', lib: !!lib };
}
function mvGet_(ruta) {
  var key = mvLlave_(); if (!key) return null;
  var r = uf_('https://api.elevenlabs.io' + ruta, { headers: { 'xi-api-key': key }, muteHttpExceptions: true }, 'Voz');
  if (r.getResponseCode() !== 200) { console.error('mvGet_ ' + ruta.split('?')[0] + ' ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 160)); return null; }
  try { return JSON.parse(r.getContentText() || '{}'); } catch (e) { return null; }
}
/* «una voz de mujer tranquila» → { q: 'tranquila', genero: 'female' }. */
function mvConsulta_(buscar, genero) {
  var t = String(buscar || '').toLowerCase().replace(/[«»"'¿?¡!.,]/g, ' ');
  var g = genero === 'mujer' ? 'female' : genero === 'hombre' ? 'male' : /\b(mujer|femenina|chica|señora)\b/.test(t) ? 'female' : /\b(hombre|masculina|chico|señor)\b/.test(t) ? 'male' : '';
  var q = t.replace(/\b(pon(me)?|la|las|el|los|una?|unas|unos|de|del|con|voz|voces|que|sea|suene|mujer|femenina|chica|señora|hombre|masculina|chico|señor|muestra|muestras|oír|escuchar|reproduce|reprodúceme)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return { q: q.slice(0, 60), genero: g };
}
/* Busca hasta MV_MAX_ voces: Alma y Claudio por su nombre, las de la cuenta y, si faltan, la biblioteca pública. */
function mvBuscar_(buscar, genero) {
  var t = String(buscar || '').toLowerCase(), out = [], ya = {};
  var meter = function (v) { if (v && v.id && MV_ID_RE_.test(v.id) && !ya[v.id] && out.length < MV_MAX_) { ya[v.id] = 1; out.push(v); } };
  if (/\balma\b/.test(t)) { var va = ''; try { va = vozVozId_(); } catch (e) {} if (va) meter({ id: va, nombre: 'Alma', desc: 'La voz de Alma en las llamadas', preview: '', lib: false }); }
  if (/\bclaudio\b/.test(t)) meter({ id: CLAUDIO_VOZ_ID_, nombre: 'Claudio', desc: 'La voz de Claudio en las llamadas', preview: '', lib: false });
  if (out.length && !t.replace(/\b(alma|claudio|la|de|y|voz|voces|pon(me)?|una?)\b/g, '').trim()) { out.forEach(mvMetaGuardar_); return out; }
  var c = mvConsulta_(buscar, genero);
  var cuenta = mvGet_('/v2/voices?page_size=30' + (c.q ? '&search=' + encodeURIComponent(c.q) : ''));
  ((cuenta && cuenta.voices) || []).forEach(function (v) {
    var x = mvVoz_(v, false), g = String(v.gender || (v.labels || {}).gender || '').toLowerCase();
    if (!c.genero || !g || g === c.genero) meter(x);
  });
  if (out.length < MV_MAX_) {
    var lib = mvGet_('/v1/shared-voices?page_size=10&language=es' + (c.q ? '&search=' + encodeURIComponent(c.q) : '') + (c.genero ? '&gender=' + c.genero : ''));
    ((lib && lib.voices) || []).forEach(function (v) { meter(mvVoz_(v, true)); });
  }
  out.forEach(mvMetaGuardar_);
  return out;
}

/* La muestra en base64: mp3 (el hilo) o PCM 16 bits al hz de la llamada (la app). Caché en partes de 90 000 (la caché guarda 100 KB por valor). */
function mvMuestra_(id, frase, hz) {
  var c = CacheService.getScriptCache(), fmt = hz ? 'pcm_' + hz : 'mp3_44100_64', k = 'mv_' + mvHuella_([id, frase, fmt].join('|'));
  var n = Number(c.get(k) || 0);
  if (n) {
    var ks = []; for (var i = 0; i < n; i++) ks.push(k + '_' + i);
    var v = c.getAll(ks); if (ks.every(function (x) { return v[x]; })) return { ok: true, audio: ks.map(function (x) { return v[x]; }).join('') };
  }
  var key = mvLlave_(); if (!key) return { ok: false, error: 'Falta la llave de ElevenLabs en el Hub.' };
  var r = uf_('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(id) + '?output_format=' + fmt, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key },
    payload: JSON.stringify({ text: frase, model_id: PropertiesService.getScriptProperties().getProperty('VOZ_TTS_MODELO') || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: 1.0 } }) }, 'Voz');
  var b64 = '';
  if (r.getResponseCode() === 200) b64 = Utilities.base64Encode(r.getBlob().getBytes());
  else {
    console.error('mvMuestra_ ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 200));
    /* Una voz de la biblioteca que la cuenta no deja usar por API: su muestra pública (mp3), solo para el hilo. */
    var m = mvMeta_(id);
    if (hz || !m || !m.preview) return { ok: false, error: m && m.lib ? 'Esa voz es de la biblioteca de ElevenLabs y no la puedo poner en la llamada; su muestra está en el hilo de Claudio.' : 'ElevenLabs no hizo la muestra (' + r.getResponseCode() + ').' };
    var p = uf_(m.preview, { muteHttpExceptions: true }, 'Voz');
    if (p.getResponseCode() !== 200) return { ok: false, error: 'No pude bajar la muestra de esa voz.' };
    b64 = Utilities.base64Encode(p.getBlob().getBytes());
  }
  var partes = {}, j = 0;
  for (var x = 0; x < b64.length; x += 90000) partes[k + '_' + (j++)] = b64.slice(x, x + 90000);
  partes[k] = String(j);
  try { c.putAll(partes, MV_CACHE_S_); } catch (e) {}
  return { ok: true, audio: b64 };
}

/* ── La herramienta de Claudio (voz y chat de texto): busca, deja la tarjeta en el hilo y dice cómo ponerlas ── */
function claudioVocesHerr_(adm, b) {
  if (!mvLlave_()) return { ok: false, error: 'NO SE HIZO NADA: falta la llave de ElevenLabs en el Hub. Díselo a Juan en una frase.' };
  var buscar = mvCorto_(b.buscar, 120), frase = mvFrase_(b.frase), voces = mvBuscar_(buscar, String(b.genero || ''));
  if (!voces.length) return { ok: true, resultado: 'No encontré voces para «' + buscar + '». Pídele a Juan otro nombre o cómo quiere que suene (hombre o mujer, tranquila, alegre, con acento…).' };
  var tarjeta = { tipo: 'voces', buscar: buscar, frase: frase, voces: voces.map(function (v) { var o = { id: v.id, nombre: v.nombre, desc: v.desc, lib: v.lib }; if (v.lib && v.preview) o.preview = v.preview; return o; }) };
  try { opGuardar_(adm, 'alma', 'claudio', 'Muestras de voz' + (buscar ? ' para «' + buscar + '»' : '') + ': ' + voces.map(function (v) { return v.nombre; }).join(', ') + '. Tócalas aquí para oírlas.', [], CHAT_DESARROLLO_, JSON.stringify(tarjeta)); }
  catch (e) { console.error('claudioVocesHerr_ hilo: ' + e); }
  return { ok: true, voces: voces.map(function (v) { return { voice_id: v.id, nombre: v.nombre, como_es: v.desc, biblioteca: v.lib }; }), frase: frase,
    resultado: 'Encontré ' + voces.length + (voces.length === 1 ? ' voz' : ' voces') + ' y dejé su tarjeta con botón para oírlas en el hilo de Claudio. EN LA LLAMADA (si tienes reproducir_voz): di el nombre de la primera en pocas palabras y usa reproducir_voz con su voice_id y la frase (una voz por vez); cuando suene, pregúntale qué le pareció y si quiere oír la siguiente. SIN reproducir_voz (el chat de texto o la voz local): di sus nombres y que las toque en la tarjeta. Nunca leas el voice_id en voz alta.' };
}

/* ── Acción vozMuestra { voice_id, frase, hz? } (la app en la llamada y el hilo de Claudio): solo el principal ── */
function vozMuestraApi_(ses, b) {
  b = b || {};
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Las muestras de voz son solo para el administrador principal.' };
  var id = String(b.voice_id || '').trim(); if (!MV_ID_RE_.test(id)) return { ok: false, error: 'Esa voz no existe.' };
  var hz = b.hz == null || b.hz === '' ? 0 : Number(b.hz);
  if (hz && MV_HZ_.indexOf(hz) < 0) return { ok: false, error: 'Formato de audio no válido.' };
  var m = mvMeta_(id), r = mvMuestra_(id, mvFrase_(b.frase), hz);
  if (!r.ok) return r;
  return { ok: true, voice_id: id, nombre: (m && m.nombre) || String(b.nombre || '').slice(0, 40), formato: hz ? 'pcm' : 'mp3', hz: hz || 44100, audio: r.audio };
}
