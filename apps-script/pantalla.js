/* ═══ LA PANTALLA QUE JUAN TIENE ENFRENTE LLEGA A CLAUDIO (Juan, 18-nov-2026) ═══════════════════════════════════════
   Pasó el 18-nov: Juan tocó tres veces a Alma sobre una pantalla de la app y dijo «Mira esta pantalla, hay un ícono mal
   posicionado, necesito que lo corrijas». Alma sí vio la captura (almaFoto_ la describe), pero el pedido a Claudio salió
   solo con sus palabras: Claudio no supo de qué pantalla ni de qué ícono hablaba.
   Lo que hace este archivo:
   · almaFoto_ (captura del chat o de la llamada) guarda la descripción de la última captura de esa persona, 30 minutos.
   · paraClaudeCrear_ la pone en la instrucción privada del pedido (no en el issue: el repo es público y la pantalla puede
     traer nombres o datos de huéspedes), con la hora en que se tomó. */
var PANTALLA_CACHE_ = 'ALMA_PANTALLA_', PANTALLA_VIGENCIA_S_ = 1800;
function pantallaGuardar_(email, texto) {
  email = String(email || '').toLowerCase(); texto = String(texto || '').trim(); if (!email || !texto) return;
  try { CacheService.getScriptCache().put(PANTALLA_CACHE_ + email, JSON.stringify({ t: Date.now(), texto: texto.slice(0, 2500) }), PANTALLA_VIGENCIA_S_); }
  catch (e) { console.error('pantallaGuardar_: ' + e); }
}
function pantallaUltima_(email) {
  email = String(email || '').toLowerCase(); if (!email) return null;
  var c = CacheService.getScriptCache().get(PANTALLA_CACHE_ + email); if (!c) return null;
  try { var j = JSON.parse(c); return j && j.texto && Date.now() - Number(j.t) < PANTALLA_VIGENCIA_S_ * 1000 ? j : null; } catch (e) { return null; }
}
/* El bloque para la instrucción de Claudio ('' si no mandó captura en los últimos 30 min). */
function pantallaParaClaude_(email) {
  var p = pantallaUltima_(email); if (!p) return '';
  var min = Math.max(0, Math.round((Date.now() - Number(p.t)) / 60000));
  return '### Lo que tenía en pantalla (captura que le mandó a Alma hace ' + (min ? min + ' min' : 'menos de 1 min') + '; privada, no va al issue)\n' +
    'Si dice «esta pantalla» o «aquí», habla de esto. Es la descripción que hizo Alma de la captura:\n> ' + String(p.texto).replace(/\n/g, '\n> ');
}
