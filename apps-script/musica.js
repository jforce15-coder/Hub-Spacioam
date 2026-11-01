/* ═══ MÚSICA · SPOTIFY ═══════════════════════════════════════════════════════════════════════════════════════
   Alma pone música en Spotify (Premium): una canción, un artista, un álbum o un mood, en el dispositivo que digas
   (bocinas Nest y Google Home, el teléfono, la compu, el carro: todo lo que aparezca en «Conectar a un dispositivo»).
   Solo desde la app de Alma (las web apps no lo muestran). Se configura en hub.spacioam.com/alma/conexiones.html (solo el admin principal):
     1. App en developer.spotify.com/dashboard con Redirect URI = hub.spacioam.com/alma/conexiones.html (esa página le pasa
        el código al script; volver directo al /exec fallaba en el iPhone con «No se puede abrir el archivo» de Google Drive).
     2. Pegar Client ID y Client Secret → Guardar → «Conectar Spotify» (autorizas una vez).
   Propiedades: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH. */
var SPOTIFY_SCOPES_ = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
var SPOTIFY_REDIRECT_ = 'https://hub.spacioam.com/alma/conexiones.html';
function spotifyRedirect_() { return SPOTIFY_REDIRECT_; }

/* El enlace para autorizar (lo abre conexiones.html). El «state» es de un solo uso y vence en 10 min. */
function spotifyAutorizar_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('SPOTIFY_CLIENT_ID');
  if (!id || !p.getProperty('SPOTIFY_CLIENT_SECRET')) return { ok: false, error: 'Primero guarda el Client ID y el Client Secret.' };
  var st = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('sp_state_' + st, '1', 600);
  return { ok: true, url: 'https://accounts.spotify.com/authorize?response_type=code&client_id=' + encodeURIComponent(id) +
    '&scope=' + encodeURIComponent(SPOTIFY_SCOPES_) + '&redirect_uri=' + encodeURIComponent(spotifyRedirect_()) + '&state=' + st };
}
/* Spotify vuelve a conexiones.html con code y state; la página los manda aquí (conexiones_ → spotifyCodigo). */
function spotifyCanjear_(q) {
  var c = CacheService.getScriptCache(), ok = q.state && c.get('sp_state_' + q.state);
  if (!ok) return { ok: false, error: 'El enlace venció. Toca otra vez «Conectar Spotify».' };
  c.remove('sp_state_' + q.state);
  if (q.error) return { ok: false, error: 'Spotify dijo: ' + String(q.error).slice(0, 80) };
  var r = spotifyPedirToken_({ grant_type: 'authorization_code', code: String(q.code || ''), redirect_uri: spotifyRedirect_() });
  if (!r.refresh_token) return { ok: false, error: 'Spotify no entregó el permiso (' + (r.error_description || r.error || 'sin respuesta') + ').' };
  PropertiesService.getScriptProperties().setProperty('SPOTIFY_REFRESH', r.refresh_token);
  if (r.access_token) c.put('sp_access', r.access_token, Math.max(60, (r.expires_in || 3600) - 300));
  return { ok: true };
}
/* Por si una autorización vieja todavía vuelve al /exec (doGet con code y state). */
function spotifyVuelta_(q) {
  var r = spotifyCanjear_(q);
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font:16px/1.5 -apple-system,Montserrat,sans-serif;max-width:420px;margin:18vh auto;padding:0 22px;color:#3E3F3F;text-align:center"><div style="font:400 34px Georgia,serif;margin-bottom:12px">' + (r.ok ? 'Listo.' : 'No se pudo.') + '</div>' + (r.ok ? 'Alma ya puede poner tu música en Spotify.' : r.error) + '</div>').setTitle('Spotify · Alma');
}
function spotifyPedirToken_(datos) {
  var p = PropertiesService.getScriptProperties();
  var auth = Utilities.base64Encode(p.getProperty('SPOTIFY_CLIENT_ID') + ':' + p.getProperty('SPOTIFY_CLIENT_SECRET'));
  try {
    var r = uf_('https://accounts.spotify.com/api/token', { method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Basic ' + auth }, payload: datos });
    return JSON.parse(r.getContentText() || '{}');
  } catch (e) { return { error: String(e) }; }
}
function spotifyAcceso_() {
  var c = CacheService.getScriptCache(), t = c.get('sp_access'); if (t) return t;
  var p = PropertiesService.getScriptProperties(), rf = p.getProperty('SPOTIFY_REFRESH'); if (!rf) return '';
  var r = spotifyPedirToken_({ grant_type: 'refresh_token', refresh_token: rf });
  if (r.refresh_token) p.setProperty('SPOTIFY_REFRESH', r.refresh_token);
  if (!r.access_token) { console.error('Spotify token: ' + JSON.stringify(r).slice(0, 200)); return ''; }
  c.put('sp_access', r.access_token, Math.max(60, (r.expires_in || 3600) - 300));
  return r.access_token;
}
function spotifyApi_(metodo, ruta, cuerpo) {
  var t = spotifyAcceso_(); if (!t) return { code: 401, j: { error: 'sin conexión' } };
  var o = { method: metodo, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } };
  if (cuerpo) { o.contentType = 'application/json'; o.payload = JSON.stringify(cuerpo); }
  var r = uf_('https://api.spotify.com/v1' + ruta, o), j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
  return { code: r.getResponseCode(), j: j };
}
function spotifyEstado_() {
  var p = PropertiesService.getScriptProperties();
  return { credenciales: !!(p.getProperty('SPOTIFY_CLIENT_ID') && p.getProperty('SPOTIFY_CLIENT_SECRET')), conectado: !!p.getProperty('SPOTIFY_REFRESH'), redirect: spotifyRedirect_() };
}
function musicaNorm_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').trim(); }
/* El dispositivo: el que se nombró (sala, cocina, carro…), si no el que está sonando, si no el primero. */
function musicaDispositivo_(nombre) {
  var d = spotifyApi_('get', '/me/player/devices'), l = (d.j && d.j.devices) || [];
  if (!l.length) return { lista: [] };
  var n = musicaNorm_(nombre), el = null;
  if (n) el = l.find(function (x) { return musicaNorm_(x.name).indexOf(n) >= 0 || n.indexOf(musicaNorm_(x.name)) >= 0; });
  return { el: el || l.find(function (x) { return x.is_active; }) || l[0], lista: l, pedido: n, hallado: !!el };
}
/* Herramienta de Alma (secretaria). Solo el admin principal: la cuenta de Spotify es la suya. */
function musica_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { error: 'La música está conectada a la cuenta de Spotify de Juan; solo él la usa.' };
  if (typeof AGENTE_APP_ !== 'undefined' && !AGENTE_APP_) return { error: 'La música solo está en la app de Alma.' };
  if (!spotifyEstado_().conectado) return { error: 'Spotify aún no está conectado. Juan lo conecta en hub.spacioam.com/alma/conexiones.html.' };
  var acc = String(inp.accion || 'poner');
  if (acc === 'dispositivos') { var dv = musicaDispositivo_(''); return { dispositivos: (dv.lista || []).map(function (x) { return x.name + ' (' + x.type + (x.is_active ? ', sonando' : '') + ')'; }) }; }
  if (acc === 'que_suena') {
    var a = spotifyApi_('get', '/me/player/currently-playing'); if (a.code === 204 || !a.j.item) return { sonando: 'Nada' };
    return { sonando: a.j.item.name + ' · ' + (a.j.item.artists || []).map(function (x) { return x.name; }).join(', '), en_pausa: !a.j.is_playing };
  }
  var dsp = musicaDispositivo_(inp.dispositivo);
  if (!dsp.el) return { error: 'No veo ningún dispositivo de Spotify encendido. Abre Spotify en el teléfono o di «Ok Google, pon Spotify» en la bocina una vez, y vuelve a pedírmelo.' };
  var q = '?device_id=' + encodeURIComponent(dsp.el.id), r;
  if (acc === 'pausar') r = spotifyApi_('put', '/me/player/pause' + q);
  else if (acc === 'seguir') r = spotifyApi_('put', '/me/player/play' + q);
  else if (acc === 'siguiente') r = spotifyApi_('post', '/me/player/next' + q);
  else if (acc === 'anterior') r = spotifyApi_('post', '/me/player/previous' + q);
  else if (acc === 'volumen') r = spotifyApi_('put', '/me/player/volume' + q + '&volume_percent=' + Math.max(0, Math.min(100, Math.round(+inp.nivel || 50))));
  else {
    var consulta = String(inp.consulta || '').trim(); if (!consulta) return { error: 'Falta qué poner.' };
    var tipo = String(inp.tipo || 'cancion'), tt = { cancion: 'track', artista: 'artist', album: 'album', playlist: 'playlist', mood: 'playlist' }[tipo] || 'track';
    var b = spotifyApi_('get', '/search?type=' + tt + '&limit=5&market=from_token&q=' + encodeURIComponent(consulta));
    var items = (((b.j || {})[tt + 's'] || {}).items || []).filter(Boolean);
    if (!items.length) return { error: 'No encontré «' + consulta + '» en Spotify.' };
    var it = items[0], cuerpo = tt === 'track' ? { uris: [it.uri] } : { context_uri: it.uri };
    r = spotifyApi_('put', '/me/player/play' + q, cuerpo);
    if (r.code < 300) return { ok: true, sonando: it.name + (it.artists ? ' · ' + it.artists.map(function (x) { return x.name; }).join(', ') : it.owner ? ' (playlist de ' + it.owner.display_name + ')' : ''), en: dsp.el.name,
      nota: dsp.pedido && !dsp.hallado ? 'No encontré «' + inp.dispositivo + '»; lo puse en ' + dsp.el.name + '.' : undefined };
  }
  if (r.code < 300) return { ok: true, en: dsp.el.name };
  var m = (r.j && r.j.error && (r.j.error.message || r.j.error)) || ('HTTP ' + r.code);
  return { error: /premium/i.test(m) ? 'Spotify pide Premium para controlar la música.' : 'Spotify no lo hizo: ' + m };
}
