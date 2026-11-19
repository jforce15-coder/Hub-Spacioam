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
   · Terminar desde el compañero (Juan, 19-nov-2026: «en el desktop no me está dejando terminar la llamada; si por error se
     activa, no puedo terminarla»): el botón «Terminar» del compañero pide vivoColgar. La llamada se da por terminada ya
     (el compañero se cierra) y el Hub le dice a la app de la llamada «colgar» en su próximo vivoPublicar (la app manda uno
     cada pocos segundos mientras alguien mira); la app cuelga y responde «fin». VIVO_COLGAR_SEG_: lo que vale el pedido.
   · Una sola voz (Juan, 19-nov-2026: «solo debería haber un agente por voz activo; si está activado el teléfono,
     por default el agente del teléfono»): si dos dispositivos del mismo administrador publican dos llamadas distintas a la
     vez, se queda la del iPhone. La otra recibe «ceder» al publicar y la app la cuelga (VozNativa.cederAlTelefono); lo que
     publique después esa llamada ya no pisa la del teléfono (vivo_cede_). Entre dos del mismo tipo, como antes: la última.
   Check con dobles: .github/modo-companero.js. */

var VIVO_SUBS_MAX_ = 8, VIVO_SUB_LARGO_ = 280, VIVO_SEG_ = 1800, VIVO_MIRA_SEG_ = 40, VIVO_VENCE_S_ = 600, VIVO_APP_S_ = 120, VIVO_COLGAR_SEG_ = 120;
/* Juan, 19-nov-2026 («en el iPad parece como atascado, siempre está encendido»): una llamada que ya colgó no puede quedarse
   «en vivo» 10 min en el compañero. · Si ElevenLabs avisó que colgó pero la app había publicado hace poco (puede ser el paso
   a Claudio, vivoFin_), se espera VIVO_FIN_ESPERA_S_: si en ese rato la app no dice nada más, terminó (se perdió su «fin»).
   · Una llamada que se quedó en «conectando» VIVO_CONECTA_S_ sin noticias nunca conectó. */
var VIVO_FIN_ESPERA_S_ = 60, VIVO_CONECTA_S_ = 90;
/* ¿Sigue viva? (la llamada guardada en vivo_est_) */
function vivoViva_(e, ahora) {
  if (!e || e.estado === 'fin') return false;
  var quieta = ahora - Number(e.ts || 0);
  if (quieta >= VIVO_VENCE_S_ * 1000) return false;
  if (e.colgo && quieta >= VIVO_FIN_ESPERA_S_ * 1000) return false;
  if (e.estado === 'conectando' && quieta >= VIVO_CONECTA_S_ * 1000) return false;
  return true;
}
var VIVO_ESTADOS_ = ['conectando', 'hablando', 'escuchando', 'pausa', 'fin'];
/* Una voz a la vez (Juan, 19-nov-2026: «solo debería haber un agente por voz activo; si está activado el teléfono, usar por
   default el agente del teléfono»). El iPhone manda: con la app abierta (o escuchando en el Modo calle o la conferencia)
   avisa cada ~60 s con vivoTelefono; vale VIVO_TEL_S_. Los demás (el iPad, la computadora) lo leen en vivoLeer
   (`telefono`): mientras el iPhone está activo no abren una llamada por voz, mientras está en una llamada tampoco a mano,
   y si el iPhone empieza una mientras la computadora tiene otra, la computadora cuelga la suya (alma/inicio.html,
   js/alma-voz.js; el iPad cede solo con «ceder», abajo). */
var VIVO_TEL_S_ = 150, VIVO_TEL_VIVA_S_ = 45;
var VIVO_TEL_ = 'iPhone', VIVO_TURNO_S_ = 30;   // la app publica al menos cada 6 s (latido): 30 s sin noticias = ya no está

/* ¿Hay otra llamada viva, de una app que publica (con dispositivo), distinta de conv? */
function vivoOtraViva_(e, conv, ahora) { return !!(e && e.conv !== conv && e.estado !== 'fin' && e.dev && ahora - Number(e.ts || 0) < VIVO_TURNO_S_ * 1000); }
function vivoCedida_(h, conv) { return !!conv && CacheService.getScriptCache().get('vivo_cede_' + h) === String(conv); }

function vivoClave_(email) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(email || '').toLowerCase())).slice(0, 16); }
function vivoLeerCache_(k) { try { return JSON.parse(CacheService.getScriptCache().get(k) || 'null'); } catch (e) { return null; } }

/* vivoPublicar { conv_id, estado, subs: [{ de: 'alma'|'yo', t }], dispositivo }: solo el administrador de esa llamada. */
function vivoPublicarApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses), conv = String(b.conv_id || '').trim();
  if (!adm || !conv) return { ok: false, error: 'session' };
  if (!tvDeLaLlamada_(adm, conv)) return { ok: false, error: 'Esa llamada no es tuya.' };
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), ahora = Date.now();
  var est = String(b.estado || ''), dev = String(b.dispositivo || '').replace(/[^\w ]/g, '').slice(0, 20);
  var antes = vivoLeerCache_('vivo_est_' + h) || {};
  /* Una sola voz: manda el teléfono. Una llamada que cedió ya no publica; el iPad cede si el iPhone está en otra. */
  if (vivoCedida_(h, conv)) return { ok: true, ceder: true, otra: antes.dev || VIVO_TEL_, mirando: !!vivoMira_(adm.email) };
  if (vivoOtraViva_(antes, conv, ahora) && dev && antes.dev !== dev) {
    if (antes.dev === VIVO_TEL_) {
      if (est !== 'fin') c.put('vivo_cede_' + h, conv, VIVO_SEG_);
      return { ok: true, ceder: est !== 'fin', otra: VIVO_TEL_, mirando: !!vivoMira_(adm.email) };
    }
    if (dev === VIVO_TEL_) c.put('vivo_cede_' + h, String(antes.conv), VIVO_SEG_);   // el teléfono llegó después: la otra cede
  }
  var e = { conv: conv, estado: VIVO_ESTADOS_.indexOf(est) >= 0 ? est : (antes.conv === conv ? antes.estado : 'hablando'), dev: dev || (antes.conv === conv ? antes.dev || '' : ''), ts: ahora };
  /* Juan la terminó desde el compañero: sigue terminada aquí aunque la app todavía hable, y la app cuelga al leer «colgar» */
  var col = vivoLeerCache_('vivo_colgar_' + h), colgar = !!(col && col.conv === conv);
  if (colgar) { e.estado = 'fin'; if (est === 'fin') c.remove('vivo_colgar_' + h); }
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
  if (e.dev === 'iPhone') c.put('vivo_tel_' + h, JSON.stringify({ ts: ahora }), VIVO_TEL_S_);   // en una llamada, el iPhone está activo
  var r = { ok: true, mirando: !!vivoMira_(adm.email) };
  if (colgar && est !== 'fin') r.colgar = true;
  return r;
}

/* vivoColgar { conv }: el botón «Terminar» del compañero. Solo la llamada de este administrador, y solo la que se ve
   (si ya empezó otra, no se toca). → { ok, terminada }. */
function vivoColgarApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses); if (!adm || !adm.email) return { ok: false, error: 'session' };
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h), ahora = Date.now();
  var conv = String(b.conv || '').trim();
  if (!e || e.estado === 'fin' || (conv && e.conv !== conv)) return { ok: true, terminada: false };
  c.put('vivo_colgar_' + h, JSON.stringify({ conv: e.conv, ts: ahora }), VIVO_COLGAR_SEG_);
  e.estado = 'fin'; e.ts = ahora; c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); c.remove('vivo_tv_' + h);
  return { ok: true, terminada: true };
}

/* El tablero de la llamada (lo deja tvCerrar_ al cerrar el turno de la secretaria). */
function vivoTarjeta_(convId, t) {
  var tel = vozWebTel_(convId), adm = tel && adminPorTel_(tel); if (!adm || !adm.email || !t) return false;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h);
  if (vivoCedida_(h, convId) || vivoOtraViva_(e, String(convId), Date.now())) return false;   // una sola voz: no pisa la del teléfono
  if (!e || e.conv !== String(convId)) c.put('vivo_est_' + h, JSON.stringify({ conv: String(convId), estado: 'hablando', dev: '', ts: Date.now() }), VIVO_SEG_);
  else if (e.estado !== 'fin') { e.ts = Date.now(); if (e.estado === 'conectando') e.estado = 'hablando'; c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); }   // con tablero, ya conectó
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
  var conv = vivoViva_(e, ahora) ? String(e.conv) : String(convClaudio || '');
  if (!conv) return false;
  if (!e || e.conv !== conv) c.put('vivo_est_' + h, JSON.stringify({ conv: conv, estado: 'hablando', dev: '', ts: ahora }), VIVO_SEG_);
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

/* vivoTelefono { activo }: el iPhone avisa que está activo (la app abierta o escuchando) o que dejó de estarlo. */
function vivoTelefonoApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'session' };
  if (String(b.dispositivo || '') !== 'iPhone') return { ok: true, telefono: false };   // solo el teléfono manda
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email);
  if (b.activo === false) c.remove('vivo_tel_' + h); else c.put('vivo_tel_' + h, JSON.stringify({ ts: Date.now() }), VIVO_TEL_S_);
  return { ok: true, telefono: b.activo !== false };
}

/* vivoLeer { desde (último n de subtítulo que ya tiene), tipos, solo_estado }: lo que pasa ahora en la llamada de este
   administrador y si su iPhone está activo (`telefono`). Con solo_estado (Una voz a la vez, sin Modo compañero) no cuenta
   como compañero mirando y no trae subtítulos ni tablero: solo si hay llamada, desde dónde y si está viva (`fresca`). */
function vivoLeerApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses); if (!adm) return { ok: false, error: 'session' };
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), ahora = Date.now(), solo = !!b.solo_estado;
  var tipos = (Array.isArray(b.tipos) ? b.tipos : []).map(String).filter(function (x) { return /^[a-z]{2,20}$/.test(x); }).slice(0, 20);
  if (!solo) c.put('vivo_mira_' + h, JSON.stringify({ ts: ahora, tipos: tipos }), VIVO_MIRA_SEG_);
  var v = c.getAll(['vivo_est_' + h, 'vivo_sub_' + h, 'vivo_tv_' + h, 'vivo_tel_' + h]), js = function (k) { try { return JSON.parse(v[k] || 'null'); } catch (e) { return null; } };
  var e = js('vivo_est_' + h), s = js('vivo_sub_' + h), tv = js('vivo_tv_' + h), tel = js('vivo_tel_' + h);
  var telefono = !!(tel && ahora - Number(tel.ts || 0) < VIVO_TEL_S_ * 1000);
  if (!vivoViva_(e, ahora)) return { ok: true, en_llamada: false, telefono: telefono, estado: e && (e.estado === 'fin' || e.colgo) && ahora - Number(e.ts || 0) < (e.colgo ? VIVO_FIN_ESPERA_S_ * 1000 + 15000 : 15000) ? 'fin' : '' };
  var fresca = ahora - Number(e.ts || 0) < VIVO_TEL_VIVA_S_ * 1000;
  if (solo) return { ok: true, en_llamada: true, telefono: telefono, conv: e.conv, estado: e.estado, dispositivo: e.dev || '', fresca: fresca };
  var desde = Number(b.desde) || 0;
  return { ok: true, en_llamada: true, telefono: telefono, fresca: fresca, conv: e.conv, estado: e.estado, dispositivo: e.dev || '', ts: e.ts,
    subs: s && s.conv === e.conv ? s.l.filter(function (x) { return x.n > desde; }) : [],
    tarjeta: tv && tv.conv === e.conv ? tv.t : null };
}

/* La llamada empezó (vozWebVincular_) o terminó (el aviso de ElevenLabs al colgar): así el compañero la ve aunque la app
   de la llamada sea de antes y no publique nada (entonces solo el tablero, sin subtítulos). */
function vivoInicio_(adm, convId) {
  if (!adm || !adm.email || !convId) return;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h);
  if (e && e.conv === String(convId) && e.estado !== 'fin') return;
  /* Otra llamada viva de una app que publica: no se pisa aquí; la nueva se presenta al publicar y ahí se decide cuál queda. */
  if (vivoOtraViva_(e, String(convId), Date.now())) return;
  c.put('vivo_est_' + h, JSON.stringify({ conv: String(convId), estado: 'conectando', dev: '', ts: Date.now() }), VIVO_SEG_);
  c.remove('vivo_tv_' + h);
}
function vivoFin_(adm, convId) {
  if (!adm || !adm.email || !convId) return;
  var c = CacheService.getScriptCache(), h = vivoClave_(adm.email), e = vivoLeerCache_('vivo_est_' + h);
  if (!e || e.conv !== String(convId) || e.estado === 'fin') return;
  /* La app que publica dice «fin» ella misma al colgar. Si publicó hace poco, este aviso es de la conversación de Alma que
     se cerró al pasar a Claudio: la llamada sigue (si no, el compañero se apagaba y el panel cambiaba de conversación). */
  if (e.dev && Date.now() - Number(e.ts || 0) < VIVO_APP_S_ * 1000) {
    if (!e.colgo) { e.colgo = Date.now(); c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); }   // y si la app ya no dice nada, terminó (vivoViva_)
    return;
  }
  e.estado = 'fin'; e.ts = Date.now(); c.put('vivo_est_' + h, JSON.stringify(e), VIVO_SEG_); c.remove('vivo_tv_' + h);
}
