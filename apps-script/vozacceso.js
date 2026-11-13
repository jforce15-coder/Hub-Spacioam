/* ═══ Acceso cerrado a la voz de Alma (Juan, 12-nov-2026: «Sí, cierra») ═══
   Hasta hoy el agente de voz de ElevenLabs aceptaba conversaciones con solo su id (platform_settings.auth.enable_auth =
   false), y el id está en el repo público: cualquiera podía abrir una llamada y mandar una ficha {{quien_llama}} falsa.

   Cómo queda (lo aplica el Hub solo, cada 30 min junto con el prompt; nada se cambia a mano en ElevenLabs):
   · El agente pide autenticación: solo se conecta quien trae una URL firmada que el Hub pide con la llave de ElevenLabs.
   · El Hub da esa URL únicamente a un administrador con su sesión verificada (vozWebInicio_ y vozWebUrlApi_, voz.js).
     La app de Alma, el Hub y la app de iPhone ya la usan; la app web la pide por adelantado (js/alma-voz.js) para no
     sumar espera al «Iniciar llamada».
   · Las llamadas por teléfono (número de Twilio o SIP) y las salientes del Hub no dependen de esto: siguen igual.
   · Una vez al día lo vuelve a leer: si alguien lo apagó a mano, lo deja como dice el código.
   Solo toca platform_settings.auth.enable_auth; la lista de orígenes y lo demás de auth quedan como estaban. */
function vozAccesoCerrado_(auth) { return !!(auth && auth.enable_auth === true); }
/* El auth que se sube: el actual con enable_auth en true (sin perder allowlist ni los demás campos). */
function vozAccesoAplicar_(auth) { return Object.assign({}, auth || {}, { enable_auth: true }); }
function vozAccesoSiCambio_(forzar) {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  var guardar = function (o) { o.t = new Date().toISOString(); p.setProperty('VOZ_ACCESO', JSON.stringify(o)); return o; };
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var huella = 'enable_auth:true:' + agente, t = Number(p.getProperty('VOZ_ACCESO_T') || 0);
  if (!forzar && huella === p.getProperty('VOZ_ACCESO_HUELLA') && Date.now() - t < 24 * 3600000) return { ok: true, sin_cambios: true };
  var url = 'https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(agente), h = { 'xi-api-key': key };
  var g = uf_(url, { headers: h, muteHttpExceptions: true });
  if (g.getResponseCode() !== 200) return guardar({ ok: false, error: 'GET agente HTTP ' + g.getResponseCode() });
  var auth = ((JSON.parse(g.getContentText()) || {}).platform_settings || {}).auth || {};
  var listo = function (o) { p.setProperty('VOZ_ACCESO_HUELLA', huella); p.setProperty('VOZ_ACCESO_T', String(Date.now())); return guardar(o); };
  if (vozAccesoCerrado_(auth)) return listo({ ok: true, al_dia: true });
  var r = uf_(url, { method: 'patch', contentType: 'application/json', headers: h, muteHttpExceptions: true,
    payload: JSON.stringify({ platform_settings: { auth: vozAccesoAplicar_(auth) } }) });
  if (r.getResponseCode() < 200 || r.getResponseCode() >= 300) return guardar({ ok: false, error: 'PATCH agente HTTP ' + r.getResponseCode(), detalle: r.getContentText().slice(0, 200) });
  return listo({ ok: true, enable_auth: true });
}
/* La URL firmada de ElevenLabs para abrir una conversación con el agente (vale 15 min para conectarse). */
function vozUrlFirmada_() {
  var p = PropertiesService.getScriptProperties(), key = p.getProperty('ELEVENLABS_KEY'), agente = p.getProperty('ELEVENLABS_AGENT_ID');
  if (!key || !agente) return { ok: false, error: 'faltan ELEVENLABS_KEY / ELEVENLABS_AGENT_ID' };
  var r = uf_('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=' + encodeURIComponent(agente), { headers: { 'xi-api-key': key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'ElevenLabs ' + r.getResponseCode() };
  var j = {}; try { j = JSON.parse(r.getContentText() || '{}'); } catch (e) {}
  return j.signed_url ? { ok: true, url: j.signed_url } : { ok: false, error: 'sin URL firmada' };
}
