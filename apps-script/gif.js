/* ═══ GIF DE LA BROMA (Juan, 16-nov-2026) ═══════════════════════════════════════════════════════════════════
   «Cuando Alma bromee, su interfaz puede desplegar GIFs graciosos o un GIF que represente lo que quiere expresar… la broma
   pasa y el GIF se quita.» Primera rebanada: en la llamada de la app, Alma llama en silencio a mostrar_gif con una idea
   corta (voz.js · vozMostrarGif_); la app la pasa a la página del inicio (js/alma-gif.js), que pide aquí el GIF y lo pone
   unos segundos en UN cuadro del tablero (o en el chat, si no hay tablero);
   desde el 19-nov-2026, en la ventana del GIF arriba de la roca (js/alma-bento.js).
   · De dónde sale: GIPHY, con la llave GIPHY_KEY (Ajustes → Llaves, llaves.js) y SIEMPRE rating g (apto para todo
     público; se vuelve a revisar en cada resultado). Sin llave, o si GIPHY falla, un GIF del catálogo de temas.
   · Solo el administrador principal, con su sesión. UrlFetchApp solo por uf_.
   · gif → { idea } → { ok, url, alt, fuente: 'giphy', credito, segundos } */

var GIF_SEGUNDOS_ = 6;
/* Juan, 19-nov-2026: «no sé por qué estamos usando solo emojis… deberíamos poner GIFs de memes, de esos que son mini
   fragmentos de video». Ya no hay respaldo de emojis: siempre un GIF de GIPHY (endpoint de GIFs, nunca stickers; rating g).
   Si GIPHY no trae nada apto, la broma usa un GIF ya elegido del catálogo de temas; si tampoco hay, no se muestra nada. */
/* La idea, limpia: letras, números, espacios y apóstrofos; de 2 a 40 letras. */
function gifIdea_(idea) {
  var t = String(idea || '').replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ' ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return t.length >= 2 ? t : '';
}
/* Respaldo de la broma: un GIF del catálogo de temas (ya revisado), de la buena noticia o del reposo. */
function gifDelCatalogo_(idea) {
  var g = gifTemasLeer_(), l = gifTemaLimpio_(g.buena_noticia).concat(gifTemaLimpio_(g.reposo));
  if (!l.length) return null;
  var x = l[Math.floor(Math.random() * l.length)];
  return { ok: true, url: x.url, alt: x.alt || idea, fuente: 'giphy', credito: 'GIPHY', segundos: GIF_SEGUNDOS_ };
}
/* Un GIF de verdad: del endpoint de GIFs (no stickers), rating g, con imagen https de GIPHY. */
function gifApto_(g) {
  var im = g && g.images && (g.images.downsized || g.images.downsized_medium || g.images.fixed_height);
  return !!(g && String(g.rating || '').toLowerCase() === 'g' && !Number(g.is_sticker) && String(g.type || 'gif') === 'gif' && im && /^https:\/\//.test(String(im.url || '')));
}
function gifImagen_(g) { var im = g.images.downsized || g.images.downsized_medium || g.images.fixed_height; return String(im.url); }
/* GIPHY, solo rating g. Devuelve null si no hay llave, falla o no hay un resultado apto (entonces va el del catálogo). */
function gifGiphy_(idea) {
  var key = PropertiesService.getScriptProperties().getProperty('GIPHY_KEY'); if (!key) return null;
  var url = 'https://api.giphy.com/v1/gifs/search?api_key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(idea) +
    '&limit=10&rating=g&lang=en&bundle=messaging_non_clips';
  var r = uf_(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) { console.warn('gifGiphy_: HTTP ' + r.getResponseCode()); return null; }
  var aptos = ((JSON.parse(r.getContentText()) || {}).data || []).filter(gifApto_);
  if (!aptos.length) return null;
  var g = aptos[Math.floor(Math.random() * Math.min(5, aptos.length))];
  return { ok: true, url: gifImagen_(g), alt: String(g.title || idea).slice(0, 80), fuente: 'giphy', credito: 'GIPHY', segundos: GIF_SEGUNDOS_ };
}
function gifBuscar_(idea) {
  idea = gifIdea_(idea); if (!idea) return { ok: false, error: 'idea' };
  var c = null, k = 'gif_' + idea.toLowerCase().replace(/\s+/g, '_');
  try { c = JSON.parse(CacheService.getScriptCache().get(k) || 'null'); } catch (e) {}
  if (c && c.ok) return c;
  var g = null; try { g = gifGiphy_(idea); } catch (e) { console.warn('gifGiphy_: ' + e); }
  var r = g || gifDelCatalogo_(idea) || { ok: false, error: 'sin_gif' };
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
   Y el mismo día: «deberíamos poner GIFs de memes, de esos que son mini fragmentos de video, no emojis».
   · Un catálogo de temas con 7 GIFs de reacción (memes) cada uno. Se eligen UNA vez en GIPHY (endpoint de GIFs, nunca
     stickers; rating g; búsqueda tipo «… reaction» o «… meme») y quedan guardados en la propiedad del script GIF_TEMAS;
     nunca se buscan en cada cambio de tema. Ya no hay emojis: un tema sin GIFs va vacío y la página usa los del reposo.
   · Editable sin PR: la propiedad GIF_TEMAS (JSON { tema: [ { url, alt } ×7 ] }) en el Apps Script, o el robot gif_temas:
     { tema, urls: [...] } (pone esos) · { tema, rehacer: true, q? } (lo vuelve a elegir en GIPHY, con otra búsqueda si
     se da q) · { tema, candidatos: true, q? } (muestra hasta 25 opciones sin guardar, para elegir a ojo) · {} (lo muestra).
     Con fotos: true, cada GIF trae su cuadro quieto (200 px, JPG o GIF en base64) para revisarlo a ojo sin abrir GIPHY.
   · La página (js/alma-bento.js) lo pide con la acción gifTemas y lo guarda 12 h en el dispositivo; en la ventana del GIF,
     arriba de la roca, pasa uno y después otro sin repetir hasta agotar los 7. La broma (mostrar_gif) lo tapa unos segundos.
   · Solo administradores con sesión. */
var GIF_TEMAS_PROP_ = 'GIF_TEMAS', GIF_POR_TEMA_ = 7;
var GIF_TEMAS_ = {
  huesped:       { q: 'welcome reaction' },
  salida:        { q: 'bye bye reaction' },
  limpieza:      { q: 'cleaning meme' },
  mantenimiento: { q: 'fixing it meme' },
  cobro:         { q: 'money reaction' },
  socio:         { q: 'high five reaction' },
  buena_noticia: { q: 'good news celebration reaction' },
  reserva_nueva: { q: 'excited reaction' },
  apartamento:   { q: 'home sweet home reaction' },
  datos:         { q: 'thinking math meme' },
  claudio:       { q: 'robot dance meme' },
  reposo:        { q: 'chill vibes reaction' }
};
function gifTemasLeer_() { try { var o = JSON.parse(PropertiesService.getScriptProperties().getProperty(GIF_TEMAS_PROP_) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function gifTemasGuardar_(o) { PropertiesService.getScriptProperties().setProperty(GIF_TEMAS_PROP_, JSON.stringify(o)); }
/* Solo URLs de GIPHY (https): lo que llega a mano por el robot o la propiedad también pasa por aquí. */
function gifTemaUrlOk_(u) { return /^https:\/\/(media\d?\.giphy\.com|i\.giphy\.com)\/[^\s"'<>]+$/.test(String(u || '')); }
function gifTemaLimpio_(l) {
  return (Array.isArray(l) ? l : []).map(function (x) { return typeof x === 'string' ? { url: x } : x; })
    .filter(function (x) { return x && gifTemaUrlOk_(x.url); })
    .map(function (x) { return { url: String(x.url), alt: String(x.alt || '').slice(0, 80) }; }).slice(0, GIF_POR_TEMA_);
}
/* GIPHY: hasta 25 GIFs aptos y distintos (rating g, no stickers) para la búsqueda del tema (o la que se dé). */
function gifTemaBuscar_(tema, q) {
  var key = PropertiesService.getScriptProperties().getProperty('GIPHY_KEY'), def = GIF_TEMAS_[tema]; if (!key || !def) return null;
  q = gifIdea_(q) || def.q;
  var r = uf_('https://api.giphy.com/v1/gifs/search?api_key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(q) +
    '&limit=40&rating=g&lang=en&bundle=messaging_non_clips', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) { console.warn('gifTemaBuscar_: HTTP ' + r.getResponseCode()); return null; }
  var vistos = {};
  return ((JSON.parse(r.getContentText()) || {}).data || []).filter(function (g) {
    if (!gifApto_(g) || vistos[g.id]) return false;
    vistos[g.id] = 1; return gifTemaUrlOk_(gifImagen_(g));
  }).slice(0, 25).map(function (g) { return { url: gifImagen_(g), alt: String(g.title || q).slice(0, 80) }; });
}
/* GIPHY una sola vez por tema: 7 distintos. null si no hay llave o no alcanzan. */
function gifTemaGiphy_(tema, q) {
  var l = gifTemaBuscar_(tema, q);
  return l && l.length >= GIF_POR_TEMA_ ? l.slice(0, GIF_POR_TEMA_) : null;
}
/* El catálogo completo. Rellena con GIPHY los temas que faltan (como mucho 4 por vez, para no tardar) y los guarda. */
function gifTemas_() {
  var guardado = gifTemasLeer_(), cambio = false, pedidos = 0, out = {};
  Object.keys(GIF_TEMAS_).forEach(function (tema) {
    var l = gifTemaLimpio_(guardado[tema]);
    if (l.length < GIF_POR_TEMA_ && pedidos < 4) {
      pedidos++; var g = null; try { g = gifTemaGiphy_(tema); } catch (e) { console.warn('gifTemaGiphy_: ' + e); }
      if (g) { l = g; guardado[tema] = g; cambio = true; }
    }
    out[tema] = { fuente: 'giphy', credito: 'GIPHY', gifs: l };
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
/* El cuadro quieto de un GIF de GIPHY (el mismo id, «200_s.gif»), en base64; '' si no se puede. */
function gifCuadroQuieto_(u) {
  var q = String(u || '').replace(/\/[^\/?]+\.gif(\?.*)?$/, '/200_s.gif');
  if (!gifTemaUrlOk_(q)) return '';
  try { var r = uf_(q, { muteHttpExceptions: true }); return r.getResponseCode() === 200 ? Utilities.base64Encode(r.getBlob().getBytes()) : ''; } catch (e) { return ''; }
}
function gifConFotos_(l, fotos) { return !fotos ? l : (l || []).map(function (x) { return { url: x.url, alt: x.alt, foto: gifCuadroQuieto_(x.url) }; }); }
/* Robot gif_temas: ver, poner a mano (urls), ver opciones (candidatos) o volver a elegir en GIPHY (rehacer) un tema. */
function gifTemasRobot_(b) {
  b = b || {}; var tema = String(b.tema || ''), g = gifTemasLeer_();
  if (tema && !GIF_TEMAS_[tema]) return { ok: false, error: 'tema', temas: Object.keys(GIF_TEMAS_) };
  if (tema && b.candidatos) return { ok: true, tema: tema, q: gifIdea_(b.q) || GIF_TEMAS_[tema].q, candidatos: gifConFotos_(gifTemaBuscar_(tema, b.q) || [], b.fotos) };
  if (tema && Array.isArray(b.urls)) {
    var l = gifTemaLimpio_(b.urls); if (l.length !== GIF_POR_TEMA_) return { ok: false, error: 'Hacen falta ' + GIF_POR_TEMA_ + ' URLs de GIPHY (https).' };
    g[tema] = l; gifTemasGuardar_(g);
  } else if (tema && b.rehacer) {
    delete g[tema];
    var n = b.q ? gifTemaGiphy_(tema, b.q) : null; if (n) g[tema] = n;
    gifTemasGuardar_(g);
  }
  var c = gifTemas_();
  return { ok: true, por_tema: c.por_tema, temas: Object.keys(c.temas).map(function (k) { return { tema: k, fuente: c.temas[k].fuente, n: c.temas[k].gifs.length }; }), detalle: tema ? { fuente: c.temas[tema].fuente, credito: c.temas[tema].credito, gifs: gifConFotos_(c.temas[tema].gifs, b.fotos) } : undefined };
}
