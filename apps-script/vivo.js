/* ═══ MODO COMPAÑERO (#607 T-C1; Juan, 16-nov-2026: «estemos hablando desde el iPhone y ahí hacemos la interacción,
   pero en el iPad se muestran las cosas… el micro y el audio solo en un dispositivo, pero lo que pasa se muestra en el
   otro. Si Alma muestra información o una reserva, debería verse en el iPad también») ═══════════════════════════════
   La arquitectura más simple con lo que ya hay, sin servidores nuevos:
   · El dispositivo que está en la llamada es el único con micrófono y audio (ElevenLabs habla con él). Publica lo que pasa
     con la acción vivoPublicar: el estado de la llamada y los subtítulos (lo que dice Alma y lo que dice él).
   · El tablero no lo publica nadie: el Hub ya lo arma al cerrar el turno (tvCerrar_) y lo deja aquí (vivoTarjeta_).
   · El otro dispositivo, con «Modo compañero» encendido (alma/inicio.html, por dispositivo), pide vivoLeer: cada ~1,5 s
     durante una llamada y cada ~8 s si no hay, y solo con la pantalla a la vista. Al pedir, avisa que está mirando
     (vivo_mira_, 40 s): mientras mira, el tablero sale aunque el teléfono de la llamada esté bloqueado o en el Modo calle
     (tvCerrar_), y la voz dice «EN PANTALLA» igual.
   · Todo vive en la caché del script por usuario (la clave sale de su correo): solo la misma sesión verificada de ese
     administrador lo lee. Nada va a una hoja. Una llamada sin noticias en VIVO_VENCE_S_ se da por terminada.
   Check con dobles: .github/modo-companero.js. */

var VIVO_SUBS_MAX_ = 8, VIVO_SUB_LARGO_ = 280, VIVO_SEG_ = 1800, VIVO_MIRA_SEG_ = 40, VIVO_VENCE_S_ = 600, VIVO_APP_S_ = 120;
var VIVO_ESTADOS_ = ['conectando', 'hablando', 'escuchando', 'pausa', 'fin'];

function vivoClave_(email) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(email || '').toLowerCase())).slice(0, 16); }
function vivoLeerCache_(k) { try { return JSON.parse(CacheService.getScriptCache().get(k) || 'null'); } catch (e) { return null; } }

/* vivoPublicar { conv_id, estado, subs: [{ de: 'alma'|'yo', t }], dispositivo }: solo el administrador de esa llamada. */
function vivoPublicarApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses), conv = String(b.conv_id || '').trim();
  if (!adm || !conv) return { ok: false, error: 'session' };
  if (!tvDeLaLlamada_(adm, conv)) return { ok: false, error: 'Esa llamada no es tuya.' };
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), ahora = Date.now();
  var est = String(b.estado || '');
  var antes = vivoLeerCache_('vivo_est_' + h) || {};
  var e = { conv: conv, estado: VIVO_ESTADOS_.indexOf(est) >= 0 ? est : (antes.conv === conv ? antes.estado : 'hablando'), dev: String(b.dispositivo || antes.dev || '').replace(/[^\w ]/g, '').slice(0, 20), ts: ahora,
    ini: antes.conv === conv && antes.ini ? antes.ini : ahora };   // cuándo empezó (el iPad muestra cuánto lleva)
  c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_);
  var nuevos = (Array.isArray(b.subs) ? b.subs : []).map(function (x) {
    var t = tvTapar_(String((x && x.t) || '').replace(/\s+/g, ' ').trim()).slice(0, VIVO_SUB_LARGO_);
    return t ? { de: x.de === 'yo' ? 'yo' : 'alma', t: t } : null;
  }).filter(Boolean);
  if (nuevos.length || antes.conv !== conv) {
    var subs = vivoLeerCache_('vivo_sub_' + h) || { conv: conv, n: 0, l: [] };
    if (subs.conv !== conv) subs = { conv: conv, n: 0, l: [] };
    nuevos.forEach(function (x) { subs.n++; x.n = subs.n; x.ts = ahora; subs.l.push(x); });
    subs.l = subs.l.slice(-VIVO_SUBS_MAX_);
    c.put('vivo_sub_' + h, JSON.stringify(subs), VIVO_SEG_);
  }
  if (e.estado === 'fin') c.remove('vivo_tv_' + h);
  return { ok: true, mirando: !!vivoMira_(adm.email) };
}

/* El tablero de la llamada (lo deja tvCerrar_ al cerrar el turno de la secretaria). */
function vivoTarjeta_(convId, t) {
  var tel = vozWebTel_(convId), adm = tel && adminPorTel_(tel); if (!adm || !adm.email || !t) return false;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h);
  if (!e || e.conv !== String(convId)) c.put('vivo_est_' + h, JSON.stringify({ conv: String(convId), estado: 'hablando', dev: '', ts: Date.now(), ini: Date.now() }), VIVO_SEG_);
  else if (e.estado !== 'fin') { e.ts = Date.now(); c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); }
  c.put('vivo_tv_' + h, JSON.stringify({ conv: String(convId), ts: Date.now(), t: t }), VIVO_SEG_);
  return true;
}

/* El Panel de Claudio (claudiopanel.js; Juan, 17-nov-2026: «en el teléfono me pones los trabajos, pero en el iPad no veo
   nada»): no pasa por tvCerrar_, lo pide la app con vozClaudioPanel. Lo deja aquí para el compañero, en la llamada que el
   compañero ya sigue (la de Alma: la app sigue publicando con su conversación aunque ahora hable Claudio). Al volver con
   Alma, vozWebVincular_ abre otra conversación (vivoInicio_) y el panel se quita solo. */
function vivoPanel_(adm, convClaudio, p) {
  if (!adm || !adm.email || !p || p.tipo !== 'claudio') return false;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h), ahora = Date.now();
  var conv = e && e.estado !== 'fin' && ahora - Number(e.ts || 0) < VIVO_VENCE_S_ * 1000 ? String(e.conv) : String(convClaudio || '');
  if (!conv) return false;
  if (!e || e.conv !== conv) c.put('vivo_est_' + h, JSON.stringify({ conv: conv, estado: 'hablando', dev: '', ts: ahora, ini: ahora }), VIVO_SEG_);
  else { e.ts = ahora; c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); }
  c.put('vivo_tv_' + h, JSON.stringify({ conv: conv, ts: ahora, t: p }), VIVO_SEG_);
  return true;
}
/* ¿Hay un compañero mirando? → { ts, tipos } o null. */
function vivoMira_(email) { return email ? vivoLeerCache_('vivo_mira_' + vivoClave_(email)) : null; }
/* Para tvCerrar_: ¿el compañero de quien está en esta llamada pinta este tipo? (los tipos nuevos, solo si los nombra) */
function vivoMiraLlamada_(convId, tipo) {
  var tel = vozWebTel_(convId), adm = tel && adminPorTel_(tel), m = adm ? vivoMira_(adm.email) : null;
  if (!m) return false;
  return TV_TIPOS_AVISO_.indexOf(tipo) < 0 || (Array.isArray(m.tipos) && m.tipos.indexOf(tipo) >= 0);
}

/* vivoLeer { desde (último n de subtítulo que ya tiene), tipos }: lo que pasa ahora en la llamada de este administrador. */
function vivoLeerApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'session' };
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), ahora = Date.now();
  var tipos = (Array.isArray(b.tipos) ? b.tipos : []).map(String).filter(function (x) { return /^[a-z]{2,20}$/.test(x); }).slice(0, 20);
  c.put('vivo_mira_' + h, JSON.stringify({ ts: ahora, tipos: tipos }), VIVO_MIRA_SEG_);
  var v = c.getAll(['vivo_est_' + h, 'vivo_sub_' + h, 'vivo_tv_' + h]), js = function (k) { try { return JSON.parse(v[k] || 'null'); } catch (e) { return null; } };
  var e = js('vivo_est_' + h), s = js('vivo_sub_' + h), tv = js('vivo_tv_' + h);
  var vivo = !!(e && e.estado !== 'fin' && ahora - Number(e.ts || 0) < VIVO_VENCE_S_ * 1000);
  if (!vivo) return { ok: true, en_llamada: false, estado: e && e.estado === 'fin' && ahora - Number(e.ts || 0) < 15000 ? 'fin' : '' };
  var desde = Number(b.desde) || 0;
  return { ok: true, en_llamada: true, conv: e.conv, estado: e.estado, dispositivo: e.dev || '', ts: e.ts, ini: Number(e.ini || e.ts) || 0,
    subs: s && s.conv === e.conv ? s.l.filter(function (x) { return x.n > desde; }) : [],
    tarjeta: tv && tv.conv === e.conv ? tv.t : null };
}

/* La llamada empezó (vozWebVincular_) o terminó (el aviso de ElevenLabs al colgar): así el compañero la ve aunque la app
   de la llamada sea de antes y no publique nada (entonces solo el tablero, sin subtítulos). */
function vivoInicio_(adm, convId) {
  if (!adm || !adm.email || !convId) return;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h);
  if (e && e.conv === String(convId) && e.estado !== 'fin') return;
  c.put('vivo_est_' + h, JSON.stringify({ conv: String(convId), estado: 'conectando', dev: '', ts: Date.now(), ini: Date.now() }), VIVO_SEG_);
  c.remove('vivo_tv_' + h);
}
function vivoFin_(adm, convId) {
  if (!adm || !adm.email || !convId) return;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h);
  if (!e || e.conv !== String(convId) || e.estado === 'fin') return;
  /* La app que publica dice «fin» ella misma al colgar. Si publicó hace poco, este aviso es de la conversación de Alma que
     se cerró al pasar a Claudio: la llamada sigue (si no, el compañero se apagaba y el panel cambiaba de conversación). */
  if (e.dev && Date.now() - Number(e.ts || 0) < VIVO_APP_S_ * 1000) return;
  e.estado = 'fin'; e.ts = Date.now(); c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); c.remove('vivo_tv_' + h);
}
