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

/* ═══ GIFS DEL TEMA (Bento vivo, #810; Juan, 19-nov-2026) ═════════════════════════════════════════════════════════
   «Algunos fijos en temas específicos (cuando se habla de un huésped, etc.), pero unos 7 distintos por cada tema para ir
   rotando y que no sea siempre el mismo. Y si Alma hace una broma, poner un GIF mientras está la broma y luego quitarlo.»
   · Un catálogo de temas con 7 GIFs cada uno. Se eligen UNA vez en GIPHY (rating g, como la broma) y quedan guardados en la
     propiedad del script GIF_TEMAS; nunca se buscan en cada cambio de tema (no gastan cupo ni llamadas). Sin llave de
     GIPHY, o si GIPHY no trae 7 aptos, el tema usa sus 7 emojis animados de Noto.
   · Editable sin PR: la propiedad GIF_TEMAS (JSON { tema: [ { url, alt } ×7 ] }) en el Apps Script, o el robot
     gif_temas { tema, urls: [...] } (pone esos) · { tema, rehacer: true } (lo vuelve a elegir en GIPHY) · {} (lo muestra).
   · La página (js/alma-bento.js) lo pide con la acción gifTemas UNA vez y lo guarda 12 h en el dispositivo; rota sin repetir
     hasta agotar los 7. El GIF de la broma (mostrar_gif) tapa al del tema unos segundos y después vuelve el del tema.
   · Solo administradores con sesión (los mismos que ven el Bento vivo). */
var GIF_TEMAS_PROP_ = 'GIF_TEMAS', GIF_POR_TEMA_ = 7;
var GIF_TEMAS_ = {
  huesped:       { q: 'welcome home hello', e: ['1f6ec', '2708_fe0f', '1f44b', '1f917', '1f60a', '1f970', '1f31f'] },
  salida:        { q: 'goodbye wave see you', e: ['1f44b', '1f697', '1f6eb', '1f64c', '2728', '1f60c', '1f4ab'] },
  limpieza:      { q: 'cleaning sparkle', e: ['1f9f9', '2728', '1f4aa', '1f31f', '1f44d', '1f64c', '1f4af'] },
  mantenimiento: { q: 'fixing repair tools', e: ['1f6e0_fe0f', '1f4a7', '1f914', '1f440', '1f4aa', '1f6a8', '1f4a1'] },
  cobro:         { q: 'payday money happy', e: ['1f4b8', '1f911', '1f4c8', '1f44d', '1f389', '1f929', '1f4af'] },
  socio:         { q: 'teamwork handshake', e: ['1f91d', '1f4c8', '1f44d', '1f60e', '1f4aa', '2728', '1f64c'] },
  buena_noticia: { q: 'celebration yay', e: ['1f389', '1f973', '1f929', '1f64c', '1f44f', '1f3c6', '1f308'] },
  reserva_nueva: { q: 'excited new booking', e: ['1f389', '1f680', '1f929', '1f4c8', '1f44f', '2728', '1f973'] },
  apartamento:   { q: 'cozy home', e: ['1f3e0', '2728', '1f60a', '1f31f', '1f4f8', '1f440', '1f44d'] },
  datos:         { q: 'charts analytics', e: ['1f4c8', '1f9e0', '1f914', '1f440', '1f4aa', '1f680', '1f4a1'] },
  claudio:       { q: 'friendly robot', e: ['1f916', '1f9e0', '1f680', '1f4bb', '1f914', '2728', '1f44d'] },
  reposo:        { q: 'calm coffee morning', e: ['2615', '2728', '1f31b', '1f60a', '1f44b', '1f31f', '1f4ab'] }
};
function gifTemasLeer_() { try { var o = JSON.parse(PropertiesService.getScriptProperties().getProperty(GIF_TEMAS_PROP_) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function gifTemasGuardar_(o) { PropertiesService.getScriptProperties().setProperty(GIF_TEMAS_PROP_, JSON.stringify(o)); }
/* Solo URLs de GIPHY o de Noto (https): lo que llega a mano por el robot o la propiedad también pasa por aquí. */
function gifTemaUrlOk_(u) { return /^https:\/\/(media\d?\.giphy\.com|i\.giphy\.com|fonts\.gstatic\.com)\/[^\s"'<>]+$/.test(String(u || '')); }
function gifTemaLimpio_(l) {
  return (Array.isArray(l) ? l : []).map(function (x) { return typeof x === 'string' ? { url: x } : x; })
    .filter(function (x) { return x && gifTemaUrlOk_(x.url); })
    .map(function (x) { return { url: String(x.url), alt: String(x.alt || '').slice(0, 80) }; }).slice(0, GIF_POR_TEMA_);
}
/* GIPHY una sola vez por tema: 7 distintos, todos rating g. null si no hay llave o no alcanzan. */
function gifTemaGiphy_(tema) {
  var key = PropertiesService.getScriptProperties().getProperty('GIPHY_KEY'), def = GIF_TEMAS_[tema]; if (!key || !def) return null;
  var r = uf_('https://api.giphy.com/v1/gifs/search?api_key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(def.q) +
    '&limit=25&rating=g&lang=en&bundle=messaging_non_clips', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) { console.warn('gifTemaGiphy_: HTTP ' + r.getResponseCode()); return null; }
  var vistos = {}, l = ((JSON.parse(r.getContentText()) || {}).data || []).filter(function (g) {
    var im = g && g.images && (g.images.downsized_medium || g.images.fixed_height);
    if (!g || String(g.rating || '').toLowerCase() !== 'g' || !im || vistos[g.id]) return false;
    vistos[g.id] = 1; return gifTemaUrlOk_(im.url);
  }).slice(0, GIF_POR_TEMA_).map(function (g) { var im = g.images.downsized_medium || g.images.fixed_height; return { url: String(im.url), alt: String(g.title || def.q).slice(0, 80) }; });
  return l.length === GIF_POR_TEMA_ ? l : null;
}
function gifTemaEmojis_(tema) { return (GIF_TEMAS_[tema] || GIF_TEMAS_.reposo).e.map(function (c) { return { url: GIF_NOTO_ + c + '/512.webp', alt: tema }; }); }
/* El catálogo completo. Rellena con GIPHY los temas que faltan (como mucho 4 por vez, para no tardar) y los guarda. */
function gifTemas_() {
  var guardado = gifTemasLeer_(), cambio = false, pedidos = 0, out = {};
  Object.keys(GIF_TEMAS_).forEach(function (tema) {
    var l = gifTemaLimpio_(guardado[tema]);
    if (l.length < GIF_POR_TEMA_ && !guardado['_sin_' + tema] && pedidos < 4) {
      pedidos++; var g = null; try { g = gifTemaGiphy_(tema); } catch (e) { console.warn('gifTemaGiphy_: ' + e); }
      if (g) { l = g; guardado[tema] = g; cambio = true; }
    }
    out[tema] = l.length === GIF_POR_TEMA_ ? { fuente: 'giphy', credito: 'GIPHY', gifs: l } : { fuente: 'emoji', credito: 'Noto Emoji · CC BY 4.0', gifs: gifTemaEmojis_(tema) };
  });
  if (cambio) { try { gifTemasGuardar_(guardado); } catch (e) { console.warn('gifTemasGuardar_: ' + e); } }
  var rev = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(out), Utilities.Charset.UTF_8)).slice(0, 10);
  return { ok: true, por_tema: GIF_POR_TEMA_, rev: rev, temas: out };
}
/* gifTemas: la página del inicio (solo administradores) */
function gifTemasApi_(ses) {
  if (!vozWebAdmin_(ses)) return { ok: false, error: 'session' };
  return gifTemas_();
}
/* Robot gif_temas: ver, poner a mano (urls) o volver a elegir en GIPHY (rehacer) un tema. */
function gifTemasRobot_(b) {
  b = b || {}; var tema = String(b.tema || ''), g = gifTemasLeer_();
  if (tema && !GIF_TEMAS_[tema]) return { ok: false, error: 'tema', temas: Object.keys(GIF_TEMAS_) };
  if (tema && Array.isArray(b.urls)) {
    var l = gifTemaLimpio_(b.urls); if (l.length !== GIF_POR_TEMA_) return { ok: false, error: 'Hacen falta ' + GIF_POR_TEMA_ + ' URLs de GIPHY o Noto (https).' };
    g[tema] = l; delete g['_sin_' + tema]; gifTemasGuardar_(g);
  } else if (tema && b.rehacer) { delete g[tema]; delete g['_sin_' + tema]; gifTemasGuardar_(g); }
  else if (tema && b.emojis) { delete g[tema]; g['_sin_' + tema] = 1; gifTemasGuardar_(g); }   // ese tema solo con emojis
  var c = gifTemas_();
  return { ok: true, por_tema: c.por_tema, temas: Object.keys(c.temas).map(function (k) { return { tema: k, fuente: c.temas[k].fuente, n: c.temas[k].gifs.length }; }), detalle: tema ? c.temas[tema] : undefined };
}
