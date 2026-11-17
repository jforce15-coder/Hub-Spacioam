/* La copia guardada de Epi (la foto liviana que arma epiSnap_ en agente.js), en trozos (Juan, 17-nov-2026).
   Por qué: la caché de Google guarda hasta 100 KB por llave. Desde #621 la foto lleva 3 semanas atrás y un mes adelante
   de programación, ya no cabía en una sola llave y no se guardaba: cada consulta de limpiezas (ruta_del_dia, quién
   limpió, códigos, tareas) iba a Epi en vivo (20 a 35 s) y, si Epi tardaba o fallaba, salía «urlfetch» o «error interno».
   Ahora se guarda partida en trozos de EPISNAP_TROZO_ caracteres (holgura para tildes, que pesan 2 bytes) y vive
   EPISNAP_GUARDA_S_ segundos: así siempre hay una copia para responder al instante aunque Epi no conteste. */
var EPISNAP_TROZO_ = 30000, EPISNAP_GUARDA_S_ = 21600;

/* La copia guardada, o null. Solo caché: nunca va a internet (la usan también la tarjeta y los temas). */
function epiSnapCache_() {
  var c = CacheService.getScriptCache();
  try {
    var n = Number(c.get('episnap_n') || 0);
    if (n > 0) {
      var ks = []; for (var i = 0; i < n; i++) ks.push('episnap_p' + i);
      var m = c.getAll ? c.getAll(ks) : {}, s = '';
      for (var j = 0; j < n; j++) { var p = m[ks[j]] != null ? m[ks[j]] : c.get(ks[j]); if (p == null) { s = ''; break; } s += p; }
      if (s) { var sv = JSON.parse(s); if (sv && typeof sv === 'object') return sv; }
    }
  } catch (e) { console.error('epiSnapCache_: ' + e); }
  /* La llave de una sola pieza (la de antes): por si quedó una copia chica. */
  try { var t = c.get('episnap'); if (t) { var v = JSON.parse(t); if (v && typeof v === 'object') return v; } } catch (e) {}
  return null;
}

/* Guarda la foto en trozos. Devuelve true si quedó guardada. */
function epiSnapGuardar_(snap) {
  var c = CacheService.getScriptCache();
  try {
    var s = JSON.stringify(snap), np = Math.max(1, Math.ceil(s.length / EPISNAP_TROZO_)), o = {};
    for (var i = 0; i < np; i++) o['episnap_p' + i] = s.slice(i * EPISNAP_TROZO_, (i + 1) * EPISNAP_TROZO_);
    o.episnap_n = String(np);
    c.putAll(o, EPISNAP_GUARDA_S_);
    try { c.remove('episnap'); } catch (e) {}   // la de una sola pieza ya no se usa
    return true;
  } catch (e) { console.error('epiSnapGuardar_: ' + e); return false; }
}
