/* ═══ «NO PUEDO ENTRAR AL FORMULARIO» ══════════════════════════════════════════════════════════════
   Casi siempre es que Hola (hola.spacioam.com) aún no sincronizó la reserva. Cuando el huésped lo dice, ALMA:
   1) le pide un momento, 2) fuerza la sincronización de Hola y comprueba que el código ya aparece,
   3) le avisa que ya puede entrar (o, si sigue sin aparecer, lo pasa al equipo). Solo en modo AUTO. */
var HOLA_URL_DEF_ = 'https://script.google.com/macros/s/AKfycbwnaUyShyZHDD--rLd7XouPY4mBpgEYPYVxG2bL86nswVg89XZ9jLMFkh2ktL2IG1VRUg/exec';
var HOLA_ACC_RX_ = /((no|not|can'?t|cannot|unable)[^.?!\n]{0,40}(entrar|ingresar|acceder|abrir|cargar|carga|abre|funciona|deja|access|open|load|log ?in|sign ?in|enter|work)[^.?!\n]{0,60}(formulario|registro|p[aá]gina|link|enlace|web|app|sistema|portal|form|page|website|site|check.?in)|(formulario|registro|p[aá]gina|link|enlace|form|page|website)[^.?!\n]{0,50}(no (me )?(deja|funciona|carga|abre|reconoce|encuentra)|error|not (working|loading|found)|doesn'?t (work|load|open)|won'?t (work|load|open))|(c[oó]digo|code)[^.?!\n]{0,40}(no (es )?v[aá]lido|inv[aá]lido|no (lo )?(reconoce|encuentra|aparece)|not (valid|found|recognized)|invalid)|reserva no encontrada|reservation not found)/i;

function holaUrl_() { return PropertiesService.getScriptProperties().getProperty('HOLA_URL') || HOLA_URL_DEF_; }
function holaPost_(body, seg) {
  try {
    var r = UrlFetchApp.fetch(holaUrl_(), { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true, payload: JSON.stringify(Object.assign({ robot: llaveRobot_() }, body)) });
    return JSON.parse(r.getContentText() || '{}');
  } catch (e) { return { ok: false, error: String(e) }; }
}
function holaAccesoAplica_(ctx) {
  if (!ctx || ctx.modo !== 'AUTO' || !ctx.codigo || ctx.nivel === 'ROJO') return false;
  if (!HOLA_ACC_RX_.test(String(ctx.texto || ''))) return false;
  var c = CacheService.getScriptCache(), k = 'holafix_' + ctx.resId;
  if (c.get(k)) return false;   // ya se intentó en la última media hora: que lo vea el equipo
  c.put(k, '1', 1800);
  return true;
}
/* Devuelve true si atendió el turno. */
function holaAccesoResolver_(ctx, pKey) {
  var en = /^en/i.test(String(ctx.idioma || ''));
  var espera = en ? 'Give me a moment, I\'ll refresh the system so you can get in.' : 'Permíteme un momento, voy a actualizar el sistema para que puedas ingresar.';
  var env = enviarCanal_(ctx, espera);
  if (env.code < 200 || env.code >= 300) return false;   // si no se pudo ni avisar, sigue el flujo normal
  log_(ctx, espera, 'ENVIADO al huésped · espera mientras se actualiza Hola');
  paso_(pKey, 'No puede entrar a Hola · le pedí un momento y estoy sincronizando las reservas');
  holaPost_({ action: 'listReservations', days: 90, fast: true });
  var f = holaPost_({ action: 'findReservation', code: ctx.codigo });
  if (f && f.ok) {
    var listo = en
      ? 'All set, you can get in now. Please reload the page and try again; it should work normally. If it still fails for any reason, press the "Try again" button until it goes through. If it doesn\'t work, write to us here and we\'ll gladly look at an alternative.'
      : 'Listo, ya puedes ingresar. Por favor recarga la página y vuelve a intentarlo; debería funcionarte con normalidad. Si por alguna razón te sigue fallando, vuelve a presionar el botón de «Intentar de nuevo» hasta que tengas éxito. Si no te funciona, escríbenos por acá y con mucho gusto vamos a evaluar una alternativa.';
    Utilities.sleep(1500);
    var env2 = enviarCanal_(ctx, listo);
    log_(ctx, listo, env2.code >= 200 && env2.code < 300 ? 'ENVIADO al huésped · Hola actualizado' : 'NO ENVIADO · Hola actualizado pero falló el envío');
    paso_(pKey, 'Hola actualizado · la reserva ya aparece · le avisé que puede entrar', true);
    return true;
  }
  ctx.nivel = 'AMARILLO'; ctx.razon = 'El huésped no puede entrar a Hola y su reserva sigue sin aparecer después de sincronizar';
  try { escalar_('Hola · el huésped no puede entrar · ' + (ctx.huesped || '') + ' · ' + (ctx.propiedad || ''), 'ALMA sincronizó Hola pero el código ' + ctx.codigo + ' sigue sin aparecer. El huésped ya recibió un mensaje de espera.\n\nhttps://hub.spacioam.com/'); } catch (e) {}
  log_(ctx, '', 'Hola sincronizado pero la reserva no aparece · pasa al equipo');
  paso_(pKey, 'Sincronicé Hola pero la reserva sigue sin aparecer · avisé al equipo', true);
  return true;
}
