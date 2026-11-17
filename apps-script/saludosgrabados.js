/* Saludos grabados (Juan, 17-nov-2026, #724): para que la llamada de la app de Alma no empiece en silencio mientras
   ElevenLabs conecta, Alma saluda con una frase ya grabada con su voz, guardada en el teléfono. Son 50 saludos en tonos
   distintos (cálido, alegre, tranquilo, ejecutivo, juguetón) y un Aviso de volver a llamar: si la llamada no conecta o
   no se oye nada, Alma lo dice con su voz y pide colgar y volver a llamarla.
   - Se graban aquí con la voz del agente (vozVozId_) en mp3, una vez por nombre (el saludo lleva el nombre de quien
     llama) y por versión de la lista: cambiar un texto o la voz cambia la versión y se vuelven a grabar.
   - Quedan en un archivo de Drive (carpeta «Alma · Saludos grabados», propiedad SG_CARPETA_ID). Cada pedido graba como
     mucho SG_POR_VUELTA_ que falten (el aviso primero), así ninguno tarda: la app pide otra vuelta hasta tenerlos todos.
   - La app (alma-app, SaludosGrabados.swift) los baja una vez con la acción vozSaludosGrabados, manda los que ya tiene
     (tiene) y recibe solo los que le faltan. La ficha de voz trae saludos_grabados (la versión) para saber si cambió. */
var SG_SALUDOS_ = [
  // cálido
  ['calido', 'Hola, {n}, aquí estoy. Cuéntame.'], ['calido', 'Hola, {n}. Qué gusto oírte, dime.'], ['calido', 'Aquí contigo, {n}. ¿Qué necesitas?'],
  ['calido', 'Hola, {n}. Te escucho con calma.'], ['calido', 'Hola, aquí estoy para ti. ¿En qué te ayudo?'], ['calido', 'Hola, {n}. ¿Cómo va todo?'],
  ['calido', 'Qué bueno que me llamas, {n}. Cuéntame.'], ['calido', 'Hola, {n}. Dime qué se te ofrece.'], ['calido', 'Aquí estoy, {n}. Con todo gusto.'],
  ['calido', 'Hola, hola. Aquí contigo, ¿qué hacemos?'],
  // alegre
  ['alegre', '¡Hola, {n}! ¿Qué hacemos hoy?'], ['alegre', '¡Hola! Aquí estoy, lista para lo que sea.'], ['alegre', '¡{n}! Qué gusto. Cuéntame.'],
  ['alegre', '¡Hola, {n}! ¿En qué andamos?'], ['alegre', '¡Aquí estoy! ¿Por dónde empezamos?'], ['alegre', '¡Hola, {n}! Dime, dime.'],
  ['alegre', '¡Hola! Qué bueno oírte. ¿Qué necesitas?'], ['alegre', '¡Lista, {n}! ¿Qué sigue?'], ['alegre', '¡Hola, {n}! ¿Qué tal el día?'],
  ['alegre', '¡Aquí estoy, {n}! Cuéntame todo.'],
  // tranquilo
  ['tranquilo', 'Hola, {n}. Te escucho.'], ['tranquilo', 'Aquí estoy. Tómate tu tiempo.'], ['tranquilo', 'Hola. Dime, sin prisa.'],
  ['tranquilo', 'Hola, {n}. Cuando quieras, te escucho.'], ['tranquilo', 'Aquí contigo. ¿Qué necesitas?'], ['tranquilo', 'Hola, {n}. ¿En qué te ayudo?'],
  ['tranquilo', 'Te escucho, {n}.'], ['tranquilo', 'Aquí estoy, {n}. Cuéntame.'], ['tranquilo', 'Hola. ¿Qué hacemos?'],
  ['tranquilo', 'Dime, {n}. Aquí estoy.'],
  // ejecutivo
  ['ejecutivo', 'Hola, {n}. ¿Qué necesitas?'], ['ejecutivo', 'Lista. ¿Qué hacemos?'], ['ejecutivo', 'Dime, {n}.'],
  ['ejecutivo', 'Aquí estoy. ¿Por dónde empezamos?'], ['ejecutivo', 'Hola, {n}. Te escucho.'], ['ejecutivo', '¿Qué resolvemos, {n}?'],
  ['ejecutivo', 'Hola. ¿Qué sigue?'], ['ejecutivo', 'Aquí estoy, {n}. Dime.'], ['ejecutivo', 'Lista, {n}. Cuéntame.'],
  ['ejecutivo', 'Hola. ¿En qué te ayudo?'],
  // juguetón
  ['jugueton', '¿Qué travesura hacemos hoy, {n}?'], ['jugueton', 'Hola, {n}. Ya sabía que me ibas a llamar.'], ['jugueton', '¡Presente! ¿Qué se te ofrece?'],
  ['jugueton', 'Hola, jefe. ¿Qué inventamos?'], ['jugueton', 'Aquí tu Alma, {n}. Cuéntame.'], ['jugueton', '¡Hola! Justo pensaba en ti, {n}.'],
  ['jugueton', '¿Me extrañaste, {n}? Dime.'], ['jugueton', 'A la orden, {n}. ¿Qué hacemos?'], ['jugueton', '¡Llegué! ¿Qué necesitas, {n}?'],
  ['jugueton', 'Hola, {n}. Lista para la aventura.']
];
var SG_AVISO_ = 'Perdón, {n}, la llamada no se conectó bien y no te escucho. Cuelga y vuelve a llamarme, por favor.';
/* Cómo suena cada tono (voice_settings de ElevenLabs). */
var SG_TONOS_ = {
  calido: { stability: 0.5, similarity_boost: 0.8, style: 0.3, speed: 1.0 },
  alegre: { stability: 0.35, similarity_boost: 0.8, style: 0.55, speed: 1.06 },
  tranquilo: { stability: 0.7, similarity_boost: 0.8, style: 0.1, speed: 0.95 },
  ejecutivo: { stability: 0.75, similarity_boost: 0.8, style: 0, speed: 1.08 },
  jugueton: { stability: 0.3, similarity_boost: 0.8, style: 0.7, speed: 1.04 },
  aviso: { stability: 0.7, similarity_boost: 0.8, style: 0.15, speed: 1.0 }
};
var SG_POR_VUELTA_ = 12, SG_TIEMPO_MS_ = 60000;

function sgNombre_(t, nom) { return nom ? t.replace(/\{n\}/g, nom) : t.replace(/,? ?\{n\}/g, '').replace(/^¡?\s*!/, '¡Hola!').replace(/\s+([,.?!])/g, '$1'); }
/* La lista para un nombre: [{ id, tono, texto }], el aviso primero. */
function sgLista_(nom) {
  var l = [{ id: 'aviso', tono: 'aviso', texto: sgNombre_(SG_AVISO_, nom) }];
  SG_SALUDOS_.forEach(function (s, i) { l.push({ id: 's' + (i < 9 ? '0' : '') + (i + 1), tono: s[0], texto: sgNombre_(s[1], nom) }); });
  return l;
}
function sgModelo_() { return PropertiesService.getScriptProperties().getProperty('VOZ_TTS_MODELO') || 'eleven_multilingual_v2'; }
/* La versión: cambia si cambia un texto, un tono, la voz o el modelo. Corta y sin internet (la voz queda en VOZ_VOICE_ID). */
function sgVersion_(nom) {
  var base = JSON.stringify([sgLista_(nom), SG_TONOS_, vozVozId_(), sgModelo_()]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, base, Utilities.Charset.UTF_8).slice(0, 6)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function sgCarpeta_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('SG_CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('Alma · Saludos grabados'); p.setProperty('SG_CARPETA_ID', f.getId());
  return f;
}
function sgArchivo_(nom) {
  var n = 'saludos-' + (String(nom || 'sin-nombre').toLowerCase().replace(/[^a-z0-9áéíóúñü]+/g, '-') || 'sin-nombre') + '.json';
  var c = sgCarpeta_(), it = c.getFilesByName(n);
  return it.hasNext() ? it.next() : c.createFile(n, '{}', 'application/json');
}
function sgGrabar_(texto, tono) {
  var key = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY'), voz = vozVozId_();
  if (!key || !voz) return '';
  var r = uf_('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voz) + '?output_format=mp3_44100_64', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key },
    payload: JSON.stringify({ text: texto, model_id: sgModelo_(), voice_settings: SG_TONOS_[tono] || SG_TONOS_.calido }) }, 'Voz');
  if (r.getResponseCode() !== 200) { console.error('sgGrabar_ ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 200)); return ''; }
  return Utilities.base64Encode(r.getBlob().getBytes());
}

/* Acción vozSaludosGrabados { tiene: [ids], version }: graba los que falten (como mucho SG_POR_VUELTA_) y devuelve los
   que la app no tiene. completo = ya están todos grabados. */
function saludosGrabadosApi_(ses, body) {
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  if (!PropertiesService.getScriptProperties().getProperty('ELEVENLABS_KEY')) return { ok: false, error: 'falta ELEVENLABS_KEY' };
  var nom = String(adm.nombre || '').trim().split(/\s+/)[0], version = sgVersion_(nom), lista = sgLista_(nom);
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'ocupado' };
  var datos = {}, arch;
  try {
    arch = sgArchivo_(nom);
    try { datos = JSON.parse(arch.getBlob().getDataAsString() || '{}'); } catch (e) { datos = {}; }
    if (datos.version !== version) datos = { version: version, clips: {} };
    var t0 = Date.now(), hechos = 0;
    for (var i = 0; i < lista.length && hechos < SG_POR_VUELTA_ && Date.now() - t0 < SG_TIEMPO_MS_; i++) {
      if (datos.clips[lista[i].id]) continue;
      var mp3 = sgGrabar_(lista[i].texto, lista[i].tono); if (!mp3) break;   // sin voz o sin créditos: lo que haya
      datos.clips[lista[i].id] = mp3; hechos++;
    }
    if (hechos) arch.setContent(JSON.stringify(datos));
  } finally { lock.releaseLock(); }
  var tiene = body && body.version === version && Array.isArray(body.tiene) ? body.tiene.map(String) : [];
  var clips = lista.filter(function (s) { return datos.clips[s.id] && tiene.indexOf(s.id) < 0; })
    .map(function (s) { return { id: s.id, tono: s.tono, texto: s.texto, mp3: datos.clips[s.id] }; });
  return { ok: true, version: version, total: lista.length, completo: lista.every(function (s) { return !!datos.clips[s.id]; }), clips: clips };
}
