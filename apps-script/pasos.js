/* ═══ PASOS EN VIVO DE LA CLASIFICACIÓN ═══════════════════════════════════════════════════════════
   Mientras ALMA trabaja un turno, cada paso (leer, buscar la reserva, decidir, redactar, revisar) queda en
   caché por conversación. El Hub los consulta cada pocos segundos (acción 'pasos') y los muestra como una
   lista que se va completando, al estilo de Claude. Solo caché: no toca hojas y responde al instante. */
var PASOS_TTL_ = 1200;
function pasoIni_(key) {
  if (!key) return;
  try { CacheService.getScriptCache().put('pasos_' + key, JSON.stringify({ ini: Date.now(), pasos: [] }), PASOS_TTL_); } catch (e) {}
}
function paso_(key, txt, fin) {
  if (!key) return;
  try {
    var c = CacheService.getScriptCache(), k = 'pasos_' + key, o = null;
    try { o = JSON.parse(c.get(k) || 'null'); } catch (e) {}
    if (!o || o.fin) o = { ini: Date.now(), pasos: [] };
    o.pasos.push({ t: Date.now(), x: String(txt || '').replace(/\s+/g, ' ').slice(0, 220) });
    o.pasos = o.pasos.slice(-14);
    if (fin) o.fin = Date.now();
    c.put(k, JSON.stringify(o), PASOS_TTL_);
  } catch (e) {}
}
function hubPasos_(ids) {
  ids = (ids || []).map(String).filter(Boolean).slice(0, 40);
  var out = {}; if (!ids.length) return { ok: true, pasos: out };
  var all = CacheService.getScriptCache().getAll(ids.map(function (k) { return 'pasos_' + k; }));
  ids.forEach(function (k) { var v = all['pasos_' + k]; if (v) { try { out[k] = JSON.parse(v); } catch (e) {} } });
  return { ok: true, pasos: out, ahora: Date.now() };
}
var PASO_NIVEL_ = { VERDE: 'ALMA lo puede resolver', AMARILLO: 'Necesita al equipo', ROJO: 'Urgente', SILENCIO: 'No requiere respuesta', INQUIRY: 'Consulta' };
