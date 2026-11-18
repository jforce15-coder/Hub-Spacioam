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
/* Los dispositivos que Spotify deja controlar (los «restringidos» no aceptan órdenes). Una bocina o un teléfono que
   recién despierta tarda un poco en aparecer: si la lista viene vacía, se espera un momento y se vuelve a mirar. */
var MUSICA_REVISADA_ = false;   // la revisión rápida (musicaPrevia_) ya miró en esta llamada: no se vuelve a esperar
function musicaLista_() {
  for (var i = 0; i < (MUSICA_REVISADA_ ? 1 : 2); i++) {
    var d = spotifyApi_('get', '/me/player/devices'), l = ((d.j && d.j.devices) || []).filter(function (x) { return x && x.id && !x.is_restricted; });
    if (l.length || d.code === 401) return l;
    var pl = musicaEnReproductor_(); if (pl) return [pl];
    if (i === 0) Utilities.sleep(2000);
  }
  return [];
}
/* El dispositivo que Spotify tiene en la reproducción (/me/player), aunque la lista de dispositivos venga vacía: pasa con el
   iPhone en pausa (Hub #822, 18-nov-2026: «cuando le pido a Alma poner música sigue sin detectar el dispositivo»). */
function musicaEnReproductor_() {
  var e = spotifyApi_('get', '/me/player'), dv = e.code < 300 && e.j && e.j.device;
  return dv && dv.id && !dv.is_restricted ? dv : null;
}
/* El dispositivo: el que se nombró (sala, cocina, carro…); si no, el que está sonando; si no, el último donde Alma puso
   música; si no, el teléfono o la compu (los que más rápido despiertan); si no, el primero. */
function musicaDispositivo_(nombre) {
  var l = musicaLista_(), pp = PropertiesService.getScriptProperties(), ult = pp.getProperty('SPOTIFY_ULTIMO') || '';
  // Lista vacía (17-nov, «reproducir en el predeterminado sin error»): se prueba el último donde sonó por su id;
  // a veces Spotify lo acepta aunque no lo muestre. Si no, el mensaje claro (musica_).
  if (!l.length) return { el: ult ? { id: ult, name: pp.getProperty('SPOTIFY_ULTIMO_NOMBRE') || 'el último dispositivo donde sonó', is_active: false, recordado: true } : null, lista: [] };
  var n = musicaNorm_(nombre), el = null;
  if (n) el = l.find(function (x) { return musicaNorm_(x.name).indexOf(n) >= 0 || n.indexOf(musicaNorm_(x.name)) >= 0; });
  var otro = l.find(function (x) { return x.is_active; }) || l.find(function (x) { return x.id === ult; }) ||
    l.find(function (x) { return /smartphone|computer/i.test(x.type); }) || l[0];
  return { el: el || otro, lista: l, pedido: n, hallado: !!el };
}
/* Despierta el dispositivo: si no es el que está sonando, Spotify primero le pasa la reproducción y luego sí acepta órdenes. */
function musicaActivar_(el, sonar) {
  if (el.is_active) return;
  spotifyApi_('put', '/me/player', { device_ids: [el.id], play: !!sonar });
  Utilities.sleep(1000);
}
/* Una orden al dispositivo; si Spotify dice que no hay uno activo (404/502), lo activa y lo intenta una vez más. */
function musicaOrden_(el, metodo, ruta, cuerpo) {
  var r = spotifyApi_(metodo, ruta, cuerpo);
  var m = String((r.j && r.j.error && (r.j.error.message || r.j.error)) || '');
  if (r.code === 404 || r.code === 502 || /no active device|device not found/i.test(m)) {
    spotifyApi_('put', '/me/player', { device_ids: [el.id], play: false });
    Utilities.sleep(1500);
    r = spotifyApi_(metodo, ruta, cuerpo);
  }
  if (r.code < 300) PropertiesService.getScriptProperties().setProperties({ SPOTIFY_ULTIMO: el.id, SPOTIFY_ULTIMO_NOMBRE: String(el.name || '').slice(0, 60) });
  return r;
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
  var dsp = musicaDispositivo_(inp.dispositivo), sinDsp = MUSICA_SIN_DISPOSITIVO_;
  if (!dsp.el) return { error: sinDsp };
  var el = dsp.el, q = '?device_id=' + encodeURIComponent(el.id), r;
  // El último donde sonó, sin aparecer en la lista: un solo intento de pasarle la música; si Spotify no lo acepta, se
  // dice al instante (antes esperaba y reintentaba ~5 s más y la IA volvía a probar: Hub #793).
  if (el.recordado && acc !== 'pausar') { var tr = spotifyApi_('put', '/me/player', { device_ids: [el.id], play: false }); if (tr.code >= 300) return { error: sinDsp }; el.is_active = true; Utilities.sleep(800); }
  if (acc !== 'pausar') musicaActivar_(el, false);
  if (acc === 'pausar') r = musicaOrden_(el, 'put', '/me/player/pause' + q);
  else if (acc === 'seguir') r = musicaOrden_(el, 'put', '/me/player/play' + q);
  else if (acc === 'siguiente') r = musicaOrden_(el, 'post', '/me/player/next' + q);
  else if (acc === 'anterior') r = musicaOrden_(el, 'post', '/me/player/previous' + q);
  else if (acc === 'volumen') r = musicaOrden_(el, 'put', '/me/player/volume' + q + '&volume_percent=' + Math.max(0, Math.min(100, Math.round(+inp.nivel || 50))));
  else {
    var consulta = String(inp.consulta || '').trim(); if (!consulta) return { error: 'Falta qué poner.' };
    var tipo = String(inp.tipo || 'cancion'), tt = { cancion: 'track', artista: 'artist', album: 'album', playlist: 'playlist', mood: 'playlist' }[tipo] || 'track';
    var b = spotifyApi_('get', '/search?type=' + tt + '&limit=5&market=from_token&q=' + encodeURIComponent(consulta));
    var items = (((b.j || {})[tt + 's'] || {}).items || []).filter(Boolean);
    if (!items.length) return { error: 'No encontré «' + consulta + '» en Spotify.' };
    var it = items[0], cuerpo = tt === 'track' ? { uris: [it.uri] } : { context_uri: it.uri };
    r = musicaOrden_(el, 'put', '/me/player/play' + q, cuerpo);
    if (r.code < 300) PropertiesService.getScriptProperties().setProperty('SPOTIFY_PAUSA_ALMA', '0');
    if (r.code < 300) return { ok: true, sonando: it.name + (it.artists ? ' · ' + it.artists.map(function (x) { return x.name; }).join(', ') : it.owner ? ' (playlist de ' + it.owner.display_name + ')' : ''), en: el.name,
      nota: dsp.pedido && !dsp.hallado ? 'No encontré «' + inp.dispositivo + '»; lo puse en ' + el.name + '.' : undefined };
  }
  if (r.code >= 300 && el.recordado) return { error: sinDsp };
  // La música vuelve: lo que Alma pausó a pedido de Juan no se retoma solo; lo que siguió o puso, sí.
  if (r.code < 300) PropertiesService.getScriptProperties().setProperty('SPOTIFY_PAUSA_ALMA', acc === 'pausar' ? String(Date.now()) : '0');
  if (r.code < 300) return { ok: true, en: el.name };
  var m = (r.j && r.j.error && (r.j.error.message || r.j.error)) || ('HTTP ' + r.code);
  return { error: /premium/i.test(m) ? 'Spotify pide Premium para controlar la música.' : 'Spotify no lo hizo: ' + m };
}

var MUSICA_SIN_DISPOSITIVO_ = 'No veo ningún dispositivo de Spotify despierto (Spotify solo muestra los que están abiertos). Abre Spotify en el teléfono y dale play un momento, o di «Ok Google, pon Spotify» en la bocina, y vuelve a pedírmelo: ahí ya lo pongo yo.';
var MUSICA_PEDIDO_RE_ = /^\s*m[uú]sica\s*[:,.-]/i;

/* Revisión rápida de un pedido de música en la llamada (Hub #793, 18-nov-2026: «pedir música tarda 26 s y Spotify no se
   detecta»). Antes de la IA: si Spotify no tiene ningún dispositivo despierto y el último donde sonó no acepta la música,
   se contesta en 1 a 2 s con qué hacer, sin vueltas de IA ni reintentos. Si hay dispositivo (o el último sí lo aceptó),
   devuelve null y sigue la secretaria como siempre. Solo el admin principal, desde la app de Alma, con «Música: …». */
function musicaPrevia_(adm, pedido) {
  if (!MUSICA_PEDIDO_RE_.test(String(pedido || '')) || !esAdminPrincipal_(adm)) return null;
  if (typeof AGENTE_APP_ !== 'undefined' && !AGENTE_APP_) return null;   // fuera de la app lo contesta la secretaria (solo en la app)
  if (!spotifyEstado_().conectado) return null;
  MUSICA_REVISADA_ = true;
  var d = spotifyApi_('get', '/me/player/devices');
  if (d.code === 401 || d.code >= 500) return null;   // Spotify no contestó bien: que lo vea la secretaria
  var l = ((d.j && d.j.devices) || []).filter(function (x) { return x && x.id && !x.is_restricted; });
  if (l.length || musicaEnReproductor_()) return null;
  var pp = PropertiesService.getScriptProperties(), ult = pp.getProperty('SPOTIFY_ULTIMO') || '';
  if (ult) { var tr = spotifyApi_('put', '/me/player', { device_ids: [ult], play: false }); if (tr.code < 300) return null; }
  return { error: MUSICA_SIN_DISPOSITIVO_ };
}

/* La música vuelve (Hub #822, 18-nov-2026: «después de una interacción con Alma nunca se reanuda la música»). La app de Alma
   (MusicaVuelve.swift) nota que Spotify se pausó por Alma (al encender el Modo calle, al abrir la llamada…) y, cuando Alma
   termina, pide aquí que siga donde iba. Solo si: lo que quedó en pausa es el teléfono, no está sonando ya y Alma no lo pausó
   porque Juan se lo pidió (en los últimos 30 min). Así Spotify no se queda dormido y sigue apareciendo para «pon música». */
var MUSICA_PAUSA_RESPETA_MS_ = 30 * 60 * 1000;
function musicaVuelve_(adm) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'usuario' };
  if (!spotifyEstado_().conectado) return { ok: true, hecho: false, motivo: 'sin_spotify' };
  var c = CacheService.getScriptCache(); if (c.get('musica_vuelve')) return { ok: true, hecho: false, motivo: 'reciente' };
  c.put('musica_vuelve', '1', 10);
  var pausa = Number(PropertiesService.getScriptProperties().getProperty('SPOTIFY_PAUSA_ALMA') || 0);
  if (pausa && Date.now() - pausa < MUSICA_PAUSA_RESPETA_MS_) return { ok: true, hecho: false, motivo: 'la_pauso_alma' };
  var e = spotifyApi_('get', '/me/player'), dv = e.code < 300 && e.j && e.j.device;
  if (!dv || !dv.id) return { ok: true, hecho: false, motivo: 'sin_dispositivo' };
  if (e.j.is_playing) return { ok: true, hecho: false, motivo: 'ya_suena' };
  if (!/smartphone/i.test(String(dv.type || '')) || dv.is_restricted) return { ok: true, hecho: false, motivo: 'otro_dispositivo' };
  var r = spotifyApi_('put', '/me/player/play?device_id=' + encodeURIComponent(dv.id));
  if (r.code < 300) return { ok: true, hecho: true };
  var m = String((r.j && r.j.error && (r.j.error.message || r.j.error)) || ('HTTP ' + r.code));
  return { ok: true, hecho: false, motivo: /no active device|device not found/i.test(m) ? 'sin_dispositivo' : 'error', error: m.slice(0, 120) };
}
/* Acción musicaVuelve de la app de Alma (con la sesión). */
function musicaVuelveApi_(ses) {
  var adm = ses && vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'usuario' };
  return musicaVuelve_(adm);
}
