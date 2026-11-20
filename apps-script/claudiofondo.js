/* ═══ PEDIDOS PARA CLAUDIO DESDE UNA LLAMADA, EN SEGUNDO PLANO (guardia 20-nov-2026, pc1795168039754) ═════════════
   La guardia midió en la llamada del 20-nov (modo conferencia) 4 pedidos para Claudio con la herramienta secretaria: el
   Hub tardó 15,8 s en el primero y 6,7 a 10,4 s en los otros; Juan oyó «Dame un segundo» y casi 20 s de tecleo. Todo se
   hacía mientras la llamada esperaba: leer la transcripción (ElevenLabs), elegir el microproyecto, buscar uno parecido
   (unificar.js, a veces con Jev), crear el issue (GitHub), lanzar a Claudio (la rutina) y escribir la hoja. Y la traza
   no decía dónde se iba el tiempo: d venía todo en 0 (VOZ_MS_ no se llenaba en este camino).
   Ahora:
   · vozParaClaude_ (voz.js) guarda el pedido aquí (una propiedad del script por pedido, PCVOZ_<t>) y contesta enseguida.
     El pedido ya existe cuando Alma dice «quedó pedido»: si no se pudo guardar, se hace como antes, todo en la llamada.
   · Un disparador de unos segundos (paraClaudeVozPronto; respaldo: procesarCola cada minuto) los manda en orden con el
     camino de siempre (claudeMandarYa_: microproyecto, unificar, issue, lanzar). Cada pedido se saca antes de mandarlo
     (nunca se repite). Si algo falla: se reintenta 2 veces y luego le llega a Juan un aviso en Pendientes.
   · Una orden de unir («une todo») sigue en la llamada: su resultado real se dice ahí (unirorden.js).
   · Cronómetro (PC_MS_): en voz_traza, d.pc del turno de la llamada (borr, unir, cola, chat) y una entrada
     «claudio_fondo» por pedido mandado (unir, borrador, json, unificar, issue, lanzar, hoja, total). No toca turnos,
     modelo ni end_call. */
var PC_MS_ = null;   // { parte: ms } mientras se mide un pedido para Claudio
function pcMs_(k, t0) { if (PC_MS_) PC_MS_[k] = (PC_MS_[k] || 0) + (Date.now() - t0); }
var PC_VOZ_PREF_ = 'PCVOZ_', PC_VOZ_INTENTOS_ = 3, PC_VOZ_CORRE_ = 'pcvoz_corre';

/* Guarda el pedido para mandarlo en segundo plano. Devuelve true si quedó guardado (entonces ya existe). */
function paraClaudeVozEncolar_(adm, texto, nivel) {
  try {
    var L = typeof LITERAL_LLAMADA_ !== 'undefined' && LITERAL_LLAMADA_ ? LITERAL_LLAMADA_ : null;
    var x = { email: adm.email, texto: String(texto).slice(0, 4000), nivel: nivel || '', t: Date.now(), n: 0 };
    if (L) x.lit = { conv: L.conv || '', copia: String(L.copia || '').slice(0, 3000), hasta: L.hasta || Date.now() };
    var k = PC_VOZ_PREF_ + x.t + '_' + Math.floor(Math.random() * 1e6);
    PropertiesService.getScriptProperties().setProperty(k, JSON.stringify(x));
    paraClaudeVozDisparador_(2000);
    return true;
  } catch (e) { console.error('paraClaudeVozEncolar_: ' + e); return false; }
}
function paraClaudeVozDisparador_(ms) {
  try {
    if (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'paraClaudeVozPronto'; })) return;
    ScriptApp.newTrigger('paraClaudeVozPronto').timeBased().after(ms).create();
  } catch (e) { console.error('paraClaudeVozDisparador_: ' + e); }   // el respaldo es procesarCola (cada minuto)
}
function paraClaudeVozPronto() {
  cupoCanal_('Voz');
  try { ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'paraClaudeVozPronto'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); }); } catch (e) {}
  paraClaudeVozProcesar_();
}
function paraClaudeVozClaves_(p) { return p.getKeys().filter(function (k) { return k.indexOf(PC_VOZ_PREF_) === 0; }).sort(); }
/* Manda los pedidos guardados, del más viejo al más nuevo (uno a la vez: el borrador de Juan es uno solo). */
function paraClaudeVozProcesar_() {
  var p = PropertiesService.getScriptProperties();
  if (!paraClaudeVozClaves_(p).length) return { ok: true, mandados: 0 };
  var c = CacheService.getScriptCache(); if (c.get(PC_VOZ_CORRE_)) return { ok: true, ocupado: true };
  c.put(PC_VOZ_CORRE_, '1', 300);
  var ini = Date.now(), hechos = 0;
  try {
    while (Date.now() - ini < 240000) {
      var ks = paraClaudeVozClaves_(p); if (!ks.length) break;
      var raw = p.getProperty(ks[0]); p.deleteProperty(ks[0]);   // se saca antes de mandarlo: nunca se repite
      var x = null; try { x = JSON.parse(raw || 'null'); } catch (e) {}
      if (!x || !x.texto) continue;
      paraClaudeVozMandar_(p, x); hechos++;
    }
  } finally { c.remove(PC_VOZ_CORRE_); }
  if (paraClaudeVozClaves_(p).length) paraClaudeVozDisparador_(1000);
  return { ok: true, mandados: hechos };
}
function paraClaudeVozMandar_(p, x) {
  var adm = adminPorEmail_(x.email); if (!adm) return;
  VOZ_T0_ = Date.now(); PC_MS_ = {}; VOZ_MS_ = PC_MS_;
  var out = { ok: false };
  try {
    if (x.lit) literalLlamadaPoner_(x.lit.conv, x.lit.copia, x.lit.hasta); else LITERAL_LLAMADA_ = null;
    var r = claudeMandarYa_(adm, x.texto, { nivel: x.nivel });
    try { opGuardar_(adm, 'alma', 'llamada', r.texto, [], CHAT_DESARROLLO_); } catch (e) { console.error('paraClaudeVozMandar_ chat: ' + e); }
    out.ok = !(r.claude && !r.claude.ok);
    /* No salió a Claudio (sin cupo, la rutina falló) o no se pudo crear: Juan lo sabe por Pendientes. Si quedó en la
       lista, paraClaudeReintentar_ lo vuelve a mandar solo. */
    if (!out.ok || (r.claude && r.claude.ok && !r.claude.directo)) {
      out.error = String(r.texto || '').slice(0, 120);
      pendAvisar_(adm, 'El pedido para Claudio de la llamada no arrancó: ' + r.texto + '\n\nLo que pediste: ' + String(x.texto).slice(0, 300),
        { origen: 'segundo_plano', pedido: x.texto, tipo: 'atencion', fallo: String(r.texto || '').slice(0, 200) });
    }
  } catch (e) {
    console.error('paraClaudeVozMandar_: ' + (e.stack || e));
    out.error = String(e).slice(0, 120);
    x.n = (Number(x.n) || 0) + 1;
    if (x.n < PC_VOZ_INTENTOS_) { try { p.setProperty(PC_VOZ_PREF_ + x.t + '_r' + x.n, JSON.stringify(x)); } catch (e2) {} }   // otra vez, en su mismo lugar de la fila
    else pendAvisar_(adm, 'No pude mandarle a Claudio lo que pediste en la llamada: ' + String(x.texto).slice(0, 300) + '\n\n(' + String(e).slice(0, 150) + ') Dímelo otra vez y lo pido.',
      { origen: 'segundo_plano', pedido: x.texto, tipo: 'atencion', fallo: String(e).slice(0, 200) });
  } finally {
    PC_MS_.total = Date.now() - VOZ_T0_; PC_MS_.espera = VOZ_T0_ - Number(x.t || VOZ_T0_);
    vozTraza_('claudio_fondo', {}, out);
    PC_MS_ = null; VOZ_MS_ = null; VOZ_T0_ = 0; LITERAL_LLAMADA_ = null;
  }
}
