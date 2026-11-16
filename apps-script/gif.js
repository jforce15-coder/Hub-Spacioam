/* ═══ GIF DE LA BROMA (Juan, 16-nov-2026) ═══════════════════════════════════════════════════════════════════
   «Cuando Alma bromee, su interfaz puede desplegar GIFs graciosos o un GIF que represente lo que quiere expresar… la broma
   pasa y el GIF se quita.» Primera rebanada: en la llamada de la app, Alma llama en silencio a mostrar_gif con una idea
   corta (voz.js · vozMostrarGif_); la app la pasa a la página del inicio (js/alma-gif.js), que pide aquí el GIF y lo pone
   unos segundos en UN cuadro del tablero (o en el chat, si no hay tablero).
   · De dónde sale: GIPHY, con la llave GIPHY_KEY (Ajustes → Llaves, llaves.js) y SIEMPRE rating g (apto para todo
     público; se vuelve a revisar en cada resultado). Sin llave, o si GIPHY falla, un emoji animado de Noto Emoji (Google,
     licencia CC BY 4.0), elegido por palabras de la idea: nada se descarga al repo.
   · Solo el administrador principal, con su sesión. UrlFetchApp solo por uf_.
   · gif → { idea } → { ok, url, alt, fuente: 'giphy' | 'emoji', credito, segundos } */

var GIF_SEGUNDOS_ = 6;
var GIF_NOTO_ = 'https://fonts.gstatic.com/s/e/notoemoji/latest/';
/* [palabras (inglés o español), código del emoji animado]. El primero que coincide gana; sin coincidencia, el guiño. */
var GIF_EMOJIS_ = [
  [/clap|aplau|bravo|ovaci/, '1f44f'],
  [/mind ?blown|explot|alucin|flip/, '1f92f'],
  [/mic ?drop|boom|explosi/, '1f4a5'],
  [/laugh|lol|risa|funny|gracios|chiste/, '1f602'],
  [/party|celebr|fiesta|yay|win|ganamos|logrado/, '1f389'],
  [/think|hmm|pens|piensa|duda/, '1f914'],
  [/rocket|launch|despeg|lanz/, '1f680'],
  [/fire|fuego|on fire|hot/, '1f525'],
  [/strong|muscle|fuerza|vamos|let'?s go/, '1f4aa'],
  [/eyes|look|ojo|mira|watch/, '1f440'],
  [/awkward|oops|ups|sweat|nervio/, '1f605'],
  [/cool|sunglass|smooth|terminator|be back|volver|boss|jefe/, '1f60e'],
  [/bye|adi[oó]s|wave|hasta la vista|hola|hello/, '1f44b'],
  [/thumbs|okay|\bok\b|approved|aprobad|perfect/, '1f44d'],
  [/robot|\bai\b|machine/, '1f916'],
  [/amazing|incre[ií]ble|star|wow/, '1f929'],
  [/finally|por fin|hallelujah|aleluya|thank|gracias/, '1f64c'],
  [/coffee|caf[eé]|monday|lunes|sleep|sue[nñ]o/, '2615'],
  [/surpris|sorpres|shock|what/, '1f62e'],
  [/brain|genius|genio|smart|listo/, '1f9e0']
];

/* La idea, limpia: letras, números, espacios y apóstrofos; de 2 a 40 letras. */
function gifIdea_(idea) {
  var t = String(idea || '').replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ' ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return t.length >= 2 ? t : '';
}
function gifEmoji_(idea) {
  var t = String(idea || '').toLowerCase(), cod = '1f609';
  for (var i = 0; i < GIF_EMOJIS_.length; i++) if (GIF_EMOJIS_[i][0].test(t)) { cod = GIF_EMOJIS_[i][1]; break; }
  return { ok: true, url: GIF_NOTO_ + cod + '/512.webp', alt: idea, fuente: 'emoji', credito: 'Noto Emoji · CC BY 4.0', segundos: GIF_SEGUNDOS_ };
}
/* GIPHY, solo rating g. Devuelve null si no hay llave, falla o no hay un resultado apto (entonces va el emoji). */
function gifGiphy_(idea) {
  var key = PropertiesService.getScriptProperties().getProperty('GIPHY_KEY'); if (!key) return null;
  var url = 'https://api.giphy.com/v1/gifs/search?api_key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(idea) +
    '&limit=10&rating=g&lang=en&bundle=messaging_non_clips';
  var r = uf_(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) { console.warn('gifGiphy_: HTTP ' + r.getResponseCode()); return null; }
  var aptos = ((JSON.parse(r.getContentText()) || {}).data || []).filter(function (g) {
    var im = g && g.images && (g.images.downsized_medium || g.images.fixed_height);
    return g && String(g.rating || '').toLowerCase() === 'g' && im && /^https:\/\//.test(String(im.url || ''));
  });
  if (!aptos.length) return null;
  var g = aptos[Math.floor(Math.random() * Math.min(5, aptos.length))], im = g.images.downsized_medium || g.images.fixed_height;
  return { ok: true, url: String(im.url), alt: String(g.title || idea).slice(0, 80), fuente: 'giphy', credito: 'GIPHY', segundos: GIF_SEGUNDOS_ };
}
function gifBuscar_(idea) {
  idea = gifIdea_(idea); if (!idea) return { ok: false, error: 'idea' };
  var c = null, k = 'gif_' + idea.toLowerCase().replace(/\s+/g, '_');
  try { c = JSON.parse(CacheService.getScriptCache().get(k) || 'null'); } catch (e) {}
  if (c && c.ok) return c;
  var g = null; try { g = gifGiphy_(idea); } catch (e) { console.warn('gifGiphy_: ' + e); }
  var r = g || gifEmoji_(idea);
  if (g) { try { CacheService.getScriptCache().put(k, JSON.stringify(r), 21600); } catch (e) {} }
  return r;
}
function gifApi_(ses, idea) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo con el administrador principal.' };
  return gifBuscar_(idea);
}
