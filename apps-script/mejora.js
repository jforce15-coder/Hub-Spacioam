/* ═══ EQUIPO DE MEJORA CONTINUA ═════════════════════════════════════════════════════════════════════════════
   Busca, una vez por semana, cómo gastar menos sin quitar funciones ni bajar la calidad: minutos y créditos de la voz
   (ElevenLabs), tamaño de lo que Alma relee en cada respuesta, y el gasto de IA del Hub (hoja IA_USO). Junta los números
   aquí (mejoraDatos_) y le pasa la ronda a Claude con ellos: Claude propone y abre un PR con lo que se puede recortar sin
   que nada cambie para Juan; lo que cambiaría algo que se ve o se oye, solo lo propone. Playbook: playbooks/mejora.md. */
function mejoraDatos_() {
  var out = { dias: 7 }, p = PropertiesService.getScriptProperties();
  /* 1 · La voz (ElevenLabs): llamadas, minutos, por origen, las más largas y el costo de una muestra */
  var key = p.getProperty('ELEVENLABS_KEY'), ag = p.getProperty('ELEVENLABS_AGENT_ID');
  if (key) {
    try {
      var desde = Math.floor(Date.now() / 1000) - 7 * 86400, h = { 'xi-api-key': key }, lista = [], cursor = '';
      for (var i = 0; i < 3; i++) {
        var u = 'https://api.elevenlabs.io/v1/convai/conversations?page_size=100&call_start_after_unix=' + desde + (ag ? '&agent_id=' + ag : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        var j = JSON.parse(uf_(u, { headers: h, muteHttpExceptions: true }).getContentText() || '{}');
        lista = lista.concat(j.conversations || []); if (!j.has_more || !j.next_cursor) break; cursor = j.next_cursor;
      }
      var porOrigen = {};
      lista.forEach(function (c) { var k = c.conversation_initiation_source || '?'; porOrigen[k] = porOrigen[k] || { llamadas: 0, minutos: 0 }; porOrigen[k].llamadas++; porOrigen[k].minutos += (c.call_duration_secs || 0) / 60; });
      Object.keys(porOrigen).forEach(function (k) { porOrigen[k].minutos = Math.round(porOrigen[k].minutos * 10) / 10; });
      var largas = lista.slice().sort(function (a, b) { return (b.call_duration_secs || 0) - (a.call_duration_secs || 0); }).slice(0, 5);
      var muestra = largas.slice(0, 3).map(function (c) {
        try {
          var d = JSON.parse(uf_('https://api.elevenlabs.io/v1/convai/conversations/' + c.conversation_id, { headers: h, muteHttpExceptions: true }).getContentText() || '{}');
          var ch = (d.metadata || {}).charging || {}, turnos = (d.transcript || []).filter(function (t) { return t.llm_usage; }).length;
          return { id: c.conversation_id, segundos: c.call_duration_secs, creditos: (d.metadata || {}).cost, de_minutos: ch.call_charge, del_modelo: ch.llm_charge, turnos: turnos };
        } catch (e) { return { id: c.conversation_id, error: String(e).slice(0, 80) }; }
      });
      out.voz = { llamadas: lista.length, minutos: Math.round(lista.reduce(function (s, c) { return s + (c.call_duration_secs || 0); }, 0) / 6) / 10,
        fallidas: lista.filter(function (c) { return c.status === 'failed'; }).length, por_origen: porOrigen,
        mas_largas: largas.map(function (c) { return { id: c.conversation_id, segundos: c.call_duration_secs, titulo: c.call_summary_title || '' }; }), costo_muestra: muestra };
    } catch (e) { out.voz = { error: String(e).slice(0, 120) }; }
  }
  /* 2 · Lo que Alma relee en cada respuesta de voz */
  try { var pv = vozPromptCompleto_(); out.prompt_voz = { caracteres: pv.length, tokens_aprox: Math.round(pv.length / 3.6) }; } catch (e) {}
  /* 3 · El gasto de IA del Hub por función (IA_USO), los 8 más caros */
  try {
    var sh = ssAlma_().getSheetByName('IA_USO'), n = sh ? sh.getLastRow() : 0;
    if (n > 1) {
      var ini = Math.max(2, n - 4999), v = sh.getRange(ini, 1, n - ini + 1, USO_CAB_.length).getValues(), corte = Date.now() - 7 * 86400000, g = {};
      v.forEach(function (r) { if (new Date(r[0]).getTime() < corte) return; var k = r[1] + ' · ' + r[2]; g[k] = g[k] || { usd: 0, veces: 0 }; g[k].usd += Number(r[10]) || 0; g[k].veces++; });
      out.ia_hub = Object.keys(g).map(function (k) { return { que: k, usd: Math.round(g[k].usd * 100) / 100, veces: g[k].veces }; }).sort(function (a, b) { return b.usd - a.usd; }).slice(0, 8);
    }
  } catch (e) { out.ia_hub_error = String(e).slice(0, 120); }
  return out;
}

function agMejoraRonda_(a, adm, origen, pedido) {
  var datos = mejoraDatos_();
  var que = [
    'Eres el EQUIPO DE MEJORA CONTINUA de Spacio AM, uno de los agentes que trabajan detrás de Alma. Tu meta: que todo cueste menos sin quitar funciones ni bajar la calidad (Juan no debe notar nada, salvo el ahorro).',
    pedido ? 'QUÉ PIDIÓ JUAN: ' + pedido : '', a.mision ? 'TU META: ' + a.mision : '',
    'TU PLAYBOOK: lee playbooks/mejora.md en jforce15-coder/Hub-Spacioam y síguelo en orden.',
    a.reglas ? 'REGLAS QUE TE DIO JUAN (cúmplelas y pásalas a tu playbook en el mismo PR): ' + a.reglas : '',
    a.caja ? 'LO QUE JUAN YA APROBÓ (reúsalo): ' + a.caja : '',
    '', 'LOS NÚMEROS DE ESTA SEMANA (los juntó el Hub):', JSON.stringify(datos, null, 1).slice(0, 6000),
    '', 'CÓMO (además de CLAUDE.md)',
    '1. Encuentra dónde se va el gasto (minutos de voz, modelo, tamaño de lo que Alma relee, llamadas a la IA del Hub) y por qué.',
    '2. Arregla en UN PR solo lo que no cambia nada de lo que Juan ve u oye: instrucciones repetidas o que nadie usa, contexto que se manda de más, cachés, llamadas duplicadas. Mide antes y después.',
    '3. Lo que sí cambiaría algo (otro modelo, otra voz, menos contexto que Alma sí usa) NO lo hagas: déjalo como propuesta con su ahorro estimado.',
    '4. En tu respuesta a Alma: el ahorro estimado por semana, el enlace al PR, las propuestas que necesitan el sí de Juan y la línea «Listo: ✓ …» o «Falta: ✗ …».'
  ].filter(String).join('\n');
  var r = paraClaudeCrear_(adm, { titulo: 'Mejora continua · ronda', app: 'Otro', tipo: 'mejora', prioridad: 'normal', que_quiere: que });
  a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
  agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: a.ultima, origen: origen, pedido: pedido || '', estado: r.ok ? 'con Claude' : 'error',
    informe: r.ok ? 'Ronda enviada a Claude con los números de la semana. Su PR aparece en Pendientes.' : 'No se pudo enviar: ' + (r.error || ''), costo_usd: 0, terminado: '' });
  return { ok: !!r.ok, agente: a.nombre, informe: r.ok ? 'Le pasé la ronda de mejora continua a Claude con los números de la semana. Te cuento cuando termine.' : r.error, propuestas: [], costo_usd: 0 };
}
