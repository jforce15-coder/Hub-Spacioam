/* ═══ Candado único del Hub (21-nov-2026) ═══
   En Apps Script el candado (LockService) no cuenta cuántas veces se tomó: si una función que se llama a media pasada
   lo toma y lo suelta, suelta también el de quien la llamó y deja entrar a otra pasada. Así salió dos veces el mismo
   mensaje a un huésped (Hub #959). Desde ahora nadie toca el candado a mano: todo pasa por aquí y solo se suelta
   el candado que esta misma llamada tomó. Si esta ejecución ya lo tiene, no se toma ni se suelta (sigue siendo de
   quien lo tomó primero). Hay un check: .github/candado-unico.js.

   candadoTomar_(espera, op) → una función para soltarlo (en el finally), o null si estaba ocupado.
     op.usuario: el candado del usuario (vozColaLock_, retomar.js) en vez del del script.
     op.lanzar:  si está ocupado, falla con error (como waitLock) en vez de devolver null.
   conCandado_(fn, op) → corre fn con el candado y devuelve lo que fn devuelve.
     op.espera (ms, 10 000 si no se dice) · op.usuario · op.ocupado: lo que devuelve si no lo consigue (si es una
     función, la llama); sin op.ocupado, falla con error. */
var CANDADO_MIO_ = { script: 0, usuario: 0 };   // cuántas veces lo tomó esta ejecución (por si hasLock no lo dice)

function candadoTomar_(espera, op) {
  op = op || {};
  var tipo = op.usuario ? 'usuario' : 'script';
  var lock = !op.usuario ? LockService.getScriptLock() : typeof vozColaLock_ === 'function' ? vozColaLock_() : LockService.getUserLock();
  var ya = CANDADO_MIO_[tipo] > 0;
  if (!ya) { try { ya = typeof lock.hasLock === 'function' && !!lock.hasLock(); } catch (e) {} }
  if (ya) return function () {};   // es de quien llamó: él lo suelta
  var ms = espera == null ? 10000 : espera, ok = false;
  if (typeof lock.tryLock === 'function') { try { ok = !!lock.tryLock(ms); } catch (e) { ok = false; } }
  else { try { lock.waitLock(ms); ok = true; } catch (e) { ok = false; } }
  if (!ok) {
    if (op.lanzar) throw new Error('Candado ocupado: otra ejecución lo tuvo más de ' + Math.round(ms / 1000) + ' s.');
    return null;
  }
  CANDADO_MIO_[tipo]++;
  var suelto = false;
  return function () {
    if (suelto) return;
    suelto = true; CANDADO_MIO_[tipo] = Math.max(0, CANDADO_MIO_[tipo] - 1);
    try { lock.releaseLock(); } catch (e) {}
  };
}

function conCandado_(fn, op) {
  op = op || {};
  var soltar = candadoTomar_(op.espera, { usuario: op.usuario, lanzar: !('ocupado' in op) });
  if (!soltar) return typeof op.ocupado === 'function' ? op.ocupado() : op.ocupado;
  try { return fn(); } finally { soltar(); }
}
