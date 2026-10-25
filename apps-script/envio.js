/* ═══ 20 · ENVIAR DESDE EL HUB SIN ESPERAR ═════════════════════════════════════════════════════════════════
   En el Hub, el mensaje se marca «Enviado» apenas sale del teléfono: la persona puede cerrar la pestaña y seguir.
   Aquí, en el servidor, se termina el trabajo (Hospitable o WhatsApp) aunque ya nadie esté mirando, y si al final
   NO salió, se le avisa a quien lo escribió: notificación en el teléfono y mensaje en su chat con ALMA, con el texto
   completo para reenviarlo. Lo que no hace falta para enviar (el registro del caso para el aprendizaje de ALMA) se
   deja para la siguiente pasada del robot, para que el envío responda antes. */

function hubResponderSeguro_(body, ses) {
  const esWa = body.action === 'responderWa';
  let r;
  try { r = esWa ? hubResponderWa_(body.resId, body.texto, body.quien, body.wa) : hubResponder_(body.resId, body.texto, body.quien, body.canal); }
  catch (e) { r = { ok: false, error: String((e && e.message) || e).slice(0, 200) }; }
  if (!(r && r.ok) && String(body.resId || '').indexOf('op:') !== 0) {
    try { hubAvisoNoEnviado_(ses, body, r && r.error); } catch (e) { console.error('hubAvisoNoEnviado_: ' + e); }
  }
  return r;
}

/* ¿Quién lo escribió? La sesión del login manda; si no hay, el nombre que mandó el Hub; si no, el administrador principal. */
function hubAutor_(ses, quien) {
  const norm = x => String(x || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const em = String((ses && (ses.email || ses.correo)) || '').trim().toLowerCase(), L = adminsOp_();
  let a = em ? (L.find(x => x.email === em || (x.alternos || []).indexOf(em) >= 0) || null) : null;
  const q = norm(quien).split(/\s+/)[0];
  if (!a && q) a = L.find(x => norm(x.nombre).split(/\s+/)[0] === q) || null;
  return a || L.find(x => x.principal) || null;
}
function hubDestinoNombre_(resId) {
  const id = String(resId || '');
  try { if (id.indexOf('wa:') === 0) { const f = contactoFicha_(id.slice(3)); return (f && f.nombre) || ('+' + normTel_(id.slice(3))); } } catch (e) {}
  try { const p = preContexto_(id) || {}; return p.huesped ? p.huesped + (p.propiedad ? ' (' + p.propiedad + ')' : '') : ''; } catch (e) { return ''; }
}
function hubAvisoNoEnviado_(ses, body, error) {
  const adm = hubAutor_(ses, body.quien); if (!adm) return;
  const rid = String(body.resId || ''), c = CacheService.getScriptCache();
  const kc = 'noenv_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, rid + '|' + body.texto)).slice(0, 22);
  if (c.get(kc)) return; c.put(kc, '1', 600);   // el mismo mensaje no avisa dos veces si se reintenta
  const a = hubDestinoNombre_(rid), texto = String(body.texto || '');
  const motivo = String(error || 'no hubo respuesta del servicio de mensajes').replace(/\s+/g, ' ').slice(0, 200);
  const txt = 'No se envió tu mensaje' + (a ? ' a ' + a : '') + '.\nMotivo: ' + motivo + '.\n\nEsto era lo que escribiste, para que lo reenvíes desde su conversación:\n' + texto.slice(0, 1500);
  try { opGuardar_(adm, 'alma', 'hub', txt, [{ tipo: 'mensaje', resumen: 'No enviado' + (a ? ' · ' + a : ''), error: motivo }]); } catch (e) {}
  try { pushA_([adm.email], 'No se envió tu mensaje' + (a ? ' a ' + a.split(' (')[0] : ''), motivo + ' · Toca para abrir la conversación.', CFG.HUB_URL + '/?conv=' + encodeURIComponent(rid)); } catch (e) {}
}

/* Registro del caso (log + aprendizaje) cuando el envío no traía los datos a mano: se hace en la siguiente pasada. */
function hubDespuesEncolar_(resId, texto, quien) {
  const p = PropertiesService.getScriptProperties(); let q = [];
  try { q = JSON.parse(p.getProperty('HUB_DESPUES') || '[]'); } catch (e) {}
  q.push({ resId: String(resId), texto: String(texto).slice(0, 3000), quien: String(quien || '').slice(0, 80), t: Date.now() });
  p.setProperty('HUB_DESPUES', JSON.stringify(q.slice(-20)));
}
function hubDespuesProcesar_() {
  const p = PropertiesService.getScriptProperties(); let q = [];
  try { q = JSON.parse(p.getProperty('HUB_DESPUES') || '[]'); } catch (e) {}
  if (!q.length) return;
  p.setProperty('HUB_DESPUES', '[]');
  q.forEach(it => {
    try {
      const hc = hiloConv_(it.resId), ctx = hc.code === 200 ? contexto_(it.resId, hc.hilo, 'HUB') : null;
      const d = ctx ? compacto_(ctx) : { resId: it.resId, modo: 'HUB' };
      d.modo = 'HUB'; d.respondidoPor = it.quien || 'Equipo';
      log_(d, it.texto, 'ENVIADO por el equipo desde el hub' + (it.quien ? ' · ' + it.quien : ''));
      observar_(d, d.borrador || '');
    } catch (e) { console.error('hubDespuesProcesar_: ' + e); }
  });
}
