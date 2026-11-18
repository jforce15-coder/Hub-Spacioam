/* ═══ TRASLADO · el corte del Hub a alma@ (docs/specs/traslado-workspace.md, «Plan de corte del Hub») ═══
   Acciones del robot (dsBot) para cortar sin que Juan entre al editor. Las mismas en el Hub viejo y en el nuevo:
   · traslado_activadores  Solo lee: qué proyecto es (scriptId), si está apagado y sus activadores (función y cuántos).
   · traslado_apagar       Borra TODOS los activadores de este proyecto y marca TRASLADO_APAGADO: desde ahí procesarCola y
                           aprender salen sin hacer nada aunque algo los llame. Se corre en el VIEJO al cortar (así los dos
                           no atienden la misma cola: nadie recibe un mensaje dos veces).
   · traslado_encender     Quita la marca y crea los activadores fijos (procesarCola cada minuto, aprender cada hora; el
                           cerebro se instala solo desde aprender). Con cupo_dia (p. ej. 100000 en Workspace) guarda CUPO_DIA.
                           Se corre en el NUEVO al cortar, o en el VIEJO para volver atrás.
   Los activadores «…Pronto» (de una sola vez) los crea el Hub al vuelo; no hace falta tocarlos. */
var TRASLADO_FIJOS_ = [['procesarCola', 'min', 1], ['aprender', 'h', 1]];

function trasladoApagado_() { return !!PropertiesService.getScriptProperties().getProperty('TRASLADO_APAGADO'); }

function trasladoActivadores_() {
  var cuenta = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { var f = t.getHandlerFunction(); cuenta[f] = (cuenta[f] || 0) + 1; });
  return cuenta;
}

function trasladoCorte_(accion, body) {
  var sp = PropertiesService.getScriptProperties();
  if (accion === 'traslado_apagar') {
    var borrados = 0;
    ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); borrados++; });
    sp.setProperty('TRASLADO_APAGADO', new Date().toISOString());
    console.log('Traslado: Hub apagado, ' + borrados + ' activadores borrados');
  } else if (accion === 'traslado_encender') {
    sp.deleteProperty('TRASLADO_APAGADO');
    var nombres = TRASLADO_FIJOS_.map(function (x) { return x[0]; });
    ScriptApp.getProjectTriggers().filter(function (t) { return nombres.indexOf(t.getHandlerFunction()) >= 0; })
      .forEach(function (t) { ScriptApp.deleteTrigger(t); });
    TRASLADO_FIJOS_.forEach(function (x) {
      var b = ScriptApp.newTrigger(x[0]).timeBased();
      (x[1] === 'min' ? b.everyMinutes(x[2]) : b.everyHours(x[2])).create();
    });
    var cupo = Number(body && body.cupo_dia) || 0;
    if (cupo >= 20000) { sp.setProperty('CUPO_DIA', String(cupo)); sp.deleteProperty('CUPO_DIA_VISTO'); }   // cuenta nueva, límite nuevo: lo aprendido en la otra no vale (#836)
    console.log('Traslado: Hub encendido');
  } else if (accion !== 'traslado_activadores') return { ok: false, error: 'accion' };
  return { ok: true, proyecto: ScriptApp.getScriptId(), apagado: sp.getProperty('TRASLADO_APAGADO') || '',
    cupo_dia: sp.getProperty('CUPO_DIA') || '', cupo_dia_visto: sp.getProperty('CUPO_DIA_VISTO') || '',
    limite: (function () { try { return cupoLimite_(); } catch (e) { return 0; } })(), activadores: trasladoActivadores_() };
}
