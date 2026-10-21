/* ═══ ALMA · SECRETARIA DEL EQUIPO ADMINISTRATIVO (agente con herramientas) ═══════════════════════
   El chat operativo (Hub y WhatsApp de cada administrador) ya no devuelve un JSON de acciones fijas: ALMA trabaja con
   herramientas reales (Claude tool use) y cada una revisa el rol de quien pide antes de actuar.
   Prompt editable en ALMA_INSTRUCCIONES → SECRETARIA. Para volver al flujo anterior: propiedad OP_AGENTE = 0.
   Áreas en esta versión: reservas y conversaciones, mensajes a huéspedes y al equipo, Epi (rutas, tareas, agenda),
   propiedades (leer y corregir), promesas, notas y búsqueda web. Próximas: Grow, agenda (Calendar), llamadas salientes. */
var SEMILLA_SECRETARIA_ = [
  'Eres ALMA, la secretaria virtual del equipo administrativo de Spacio AM (alojamientos boutique de estancia corta en Ciudad de Guatemala).',
  'Hablas con un administrador (te dicen quién y su rol). Tu trabajo: resolver lo que pide usando tus herramientas, no solo responder.',
  '',
  'CÓMO TRABAJAS',
  '· Si te pide hacer algo (escribir a alguien, cambiar un dato, crear una tarea, revisar una ruta), hazlo con la herramienta y luego confirma en una o dos frases qué hiciste. No pidas permiso para lo que ya te pidió explícitamente.',
  '· Antes de escribirle a un huésped o a alguien del equipo, si el pedido es ambiguo (a quién, qué decir, por qué canal), pregunta una sola cosa. Si es claro, redacta con la voz de Spacio AM (cálida, de tú, sin voseo) y envía.',
  '· Para encontrar una reserva usa buscar_reservas (por nombre, código, propiedad o fecha). Nunca inventes códigos, números, direcciones ni datos: si una herramienta no lo devuelve, no lo tienes.',
  '· Para cambiar un dato de una propiedad, primero léela con ver_propiedad para usar el campo exacto; después confirma el antes y el después.',
  '· Si algo falla o no tienes herramienta para hacerlo todavía (agenda, Grow, llamadas salientes), dilo claro y ofrece lo más cercano que sí puedes hacer (por ejemplo, crear una tarea o una nota).',
  '· Para buscar proveedores, precios o información externa usa la búsqueda web y entrega una lista corta y útil: nombre, qué ofrecen, zona, contacto y enlace.',
  '· Usa guardar_nota para lo que el administrador quiera que recuerdes (decisiones, preferencias, pendientes de largo plazo).',
  '',
  'FORMATO',
  '· Por WhatsApp: breve, sin markdown, una idea por párrafo. En el Hub puedes usar listas cortas con «· ».',
  '· No narres tus herramientas ni tu proceso. Di el resultado.'
].join('\n');

function opAgenteActivo_() { return String(PropertiesService.getScriptProperties().getProperty('OP_AGENTE') || '1') !== '0'; }

/* Llamada a Claude con herramientas y conversación (messages ya armados). Devuelve el JSON completo. */
function claudeTools_(modelo, system, messages, tools, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY'), t0 = Date.now();
  var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: modelo, max_tokens: maxTokens || 1500, temperature: 0.2, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: messages, tools: tools }) });
  var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
  try { registrarUso_({ app: 'ALMA', funcion: 'Chat operativo', modelo: modelo, usage: j.usage || {}, ms: Date.now() - t0, ok: r.getResponseCode() === 200, fotos: 0 }); } catch (e) {}
  if (r.getResponseCode() !== 200) { console.error('claudeTools_ ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 400)); return null; }
  return j;
}

/* ── Definición de herramientas ── */
function agHerramientas_() {
  var s = function (d) { return { type: 'string', description: d }; };
  var T = function (name, description, props, req) { return { name: name, description: description, input_schema: { type: 'object', properties: props || {}, required: req || [] } }; };
  return [
    T('buscar_reservas', 'Busca reservas por nombre del huésped, código, propiedad o fecha. Devuelve código, huésped, propiedad, fechas, estado del registro y conv_id.',
      { texto: s('Nombre, apellido, código o parte del nombre de la propiedad'), fecha: s('YYYY-MM-DD: reservas activas ese día (entre entrada y salida)'), solo_llegadas: { type: 'boolean', description: 'Solo las que llegan en esa fecha' } }),
    T('ver_conversacion', 'Últimos mensajes de una reserva (plataforma, WhatsApp y llamadas) y promesas abiertas.', { codigo: s('Código de reserva o conv_id') }, ['codigo']),
    T('enviar_a_huesped', 'Envía un mensaje al huésped de una reserva por la plataforma (Airbnb/Booking/Hospitable) o por WhatsApp.',
      { codigo: s('Código de reserva o conv_id'), texto: s('Mensaje final, listo para enviar'), canal: { type: 'string', enum: ['plataforma', 'whatsapp'] }, numero: s('Opcional: número de WhatsApp si no es el registrado') }, ['codigo', 'texto', 'canal']),
    T('escribir_a_equipo', 'Envía un WhatsApp a una persona del equipo (administradores, técnicos, limpieza) por su nombre.',
      { persona: s('Nombre de la persona'), texto: s('Mensaje') }, ['persona', 'texto']),
    T('ruta_del_dia', 'Ruta / programación de Epi de un día: qué propiedades tiene asignadas cada técnico (o uno en particular), con hora, tipo y orden.',
      { fecha: s('YYYY-MM-DD; por defecto hoy'), persona: s('Opcional: nombre del técnico') }),
    T('tareas_abiertas', 'Lista las tareas abiertas del equipo (Hub/Epi).', {}),
    T('crear_tarea', 'Crea una tarea para el equipo.', { texto: s('Qué hay que hacer'), propiedad: s('Opcional'), quien: s('Opcional: responsable'), vence: s('YYYY-MM-DD; por defecto hoy') }, ['texto']),
    T('cerrar_tarea', 'Marca una tarea como hecha o le agrega un comentario.', { id: s('id de la tarea'), comentario: s('Opcional: en vez de cerrarla, deja este comentario') }, ['id']),
    T('agendar_en_epi', 'Agenda un trabajo en Epi (limpieza, limpieza profunda, mantenimiento o supervisión).',
      { propiedad: s('Propiedad'), fecha: s('YYYY-MM-DD'), hora: s('HH:MM'), trabajo: s('Limpieza, Limpieza Profunda, Mantenimiento o Supervisión'), tecnico: s('Opcional: nombre'), notas: s('Opcional') }, ['propiedad', 'fecha']),
    T('ver_propiedad', 'Ficha de una propiedad tal como la usa ALMA (dirección, WiFi, parqueo, llegada…) con el nombre exacto de cada campo editable.', { propiedad: s('Nombre o parte del nombre') }, ['propiedad']),
    T('cambiar_dato_propiedad', 'Corrige un dato de la ficha de una propiedad. Usa el nombre de campo exacto que devolvió ver_propiedad.',
      { propiedad: s('Nombre exacto'), campo: s('Campo exacto (ej. address, wifiPass, std.es.parking)'), valor: s('Valor nuevo') }, ['propiedad', 'campo', 'valor']),
    T('promesas_abiertas', 'Lo que ALMA le prometió a huéspedes o contactos y sigue pendiente.', {}),
    T('guardar_nota', 'Guarda algo para recordarlo en conversaciones futuras con este administrador.', { texto: s('Lo que hay que recordar') }, ['texto']),
    { type: 'web_search_20250305', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', city: 'Guatemala City', country: 'GT', timezone: 'America/Guatemala' } }
  ];
}

/* ── Ejecución ── */
function agResId_(codigo) {
  var c = String(codigo || '').trim(); if (!c) return '';
  if (/^[0-9a-f-]{20,}$/i.test(c) || /^(wa|inq):/.test(c)) return c;
  var C = c.toUpperCase().replace(/\s+/g, '');
  var hit = hubInbox_().filter(function (x) { return String(x.codigo || '').toUpperCase() === C && x.conv_id && !/^(wa|op|inq):/.test(x.conv_id); })[0];
  return hit ? hit.conv_id : '';
}
function agEjecutar_(adm, nombre, inp, ctx) {
  inp = inp || {}; var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), n = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  switch (nombre) {
    case 'buscar_reservas': {
      var q = n(inp.texto), f = String(inp.fecha || '').slice(0, 10), inbox = hubInbox_();
      var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return !/cancel/i.test(s_(r.status)) && s_(r.code); });
      var hits = filas.filter(function (r) {
        var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date);
        if (f && (inp.solo_llegadas ? ci !== f : !(ci <= f && f <= co))) return false;
        if (!q) return !!f;
        return n([r.code, r.guest_first_name, r.guest_last_name, r.property_name, r.apartment].join(' ')).indexOf(q) >= 0;
      }).slice(0, 12);
      return { reservas: hits.map(function (r) {
        var cod = s_(r.code).toUpperCase(), ib = inbox.filter(function (x) { return String(x.codigo || '').toUpperCase() === cod; })[0] || {};
        return { codigo: cod, huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim(), propiedad: s_(r.property_name), entrada: fecha_(r.checkin_date), salida: fecha_(r.checkout_date),
          huespedes: s_(r.guest_count), registro: /complet/i.test(s_(r.status_form)) ? 'completo' : 'pendiente', conv_id: ib.conv_id || '' };
      }), total: hits.length };
    }
    case 'ver_conversacion': {
      var rid = agResId_(inp.codigo); if (!rid) return { error: 'No encontré esa reserva en las conversaciones.' };
      var h = hiloConv_(rid); if (h.code !== 200) return { error: 'No pude leer la conversación (HTTP ' + h.code + ').' };
      var pr = hubPromesas_(false).promesas.filter(function (p) { return p.conv_id === rid; });
      return { conv_id: rid, mensajes: (h.hilo || []).slice(-15).map(function (m) { return (m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'AUTOMÁTICO' : 'SPACIO AM') + (m.llamada ? ' (llamada)' : m.canal === 'whatsapp' ? ' (WhatsApp)' : '') + ' · ' + String(m.created || '').slice(0, 16).replace('T', ' ') + ': ' + String(m.texto || '').slice(0, 500); }),
        promesas_abiertas: pr.map(function (p) { return p.que + ' (vence ' + p.vence + ')'; }) };
    }
    case 'enviar_a_huesped': {
      var rid2 = agResId_(inp.codigo); if (!rid2) return { error: 'No encontré esa reserva.' };
      var quien = 'ALMA · pedido de ' + adm.nombre;
      var r2 = inp.canal === 'whatsapp' ? hubResponderWa_(rid2, inp.texto, quien, inp.numero || '') : hubResponder_(rid2, inp.texto, quien, 'plataforma');
      ctx.hechas.push({ tipo: 'mensaje', resumen: 'Mensaje al huésped (' + (inp.canal === 'whatsapp' ? 'WhatsApp' : 'plataforma') + ') · ' + String(inp.texto).slice(0, 80), error: r2.ok ? '' : r2.error });
      return r2.ok ? { ok: true, plantilla: !!r2.plantilla } : { error: r2.error === 'sin_numero' ? 'No hay número de WhatsApp para esa reserva; pide el número.' : r2.error };
    }
    case 'escribir_a_equipo': {
      var personas = [];
      adminsOp_().forEach(function (a) { personas.push({ nombre: a.nombre, tel: a.tels[0] || '' }); });
      try { epiCfg_().vendors.forEach(function (v) { personas.push({ nombre: vendNombre_(v), tel: String(v.phone || v.telefono || '') }); }); } catch (e) {}
      try { escalamiento_().forEach(function (p) { personas.push({ nombre: p.nombre, tel: p.telefono }); }); } catch (e) {}
      var m = opMatch_(inp.persona, personas.map(function (p) { return p.nombre; }));
      var p = personas.filter(function (x) { return x.nombre === m && normTel_(x.tel); })[0];
      if (!p) return { error: 'No encontré a «' + inp.persona + '» con un número de WhatsApp.' };
      var ok = true; try { waEnviar_(normTel_(p.tel), String(inp.texto)); } catch (e) { ok = false; }
      ctx.hechas.push({ tipo: 'mensaje', resumen: 'WhatsApp a ' + p.nombre + ' · ' + String(inp.texto).slice(0, 80), error: ok ? '' : 'no salió' });
      return ok ? { ok: true, enviado_a: p.nombre, nota: 'Si no le había escrito en 24 h, WhatsApp puede no entregarlo; avísale por otro medio si es urgente.' } : { error: 'No se pudo enviar.' };
    }
    case 'ruta_del_dia': {
      var cfg = ctx.cfg(), fd = String(inp.fecha || hoy).slice(0, 10), quienR = inp.persona ? opMatch_(inp.persona, cfg.vendors.map(vendNombre_)) : '';
      var vend = quienR ? cfg.vendors.filter(function (v) { return vendNombre_(v) === quienR; })[0] : null;
      var del = cfg.schedules.filter(function (x) { return x && String(x.fecha || '').slice(0, 10) === fd && String(x.estado || '') !== 'cancelada' && String(x.estado || '') !== 'cancelado'; });
      if (vend) del = del.filter(function (x) { return String(x.vendorEmail || '').toLowerCase() === String(vend.email || '').toLowerCase() || String(x.vendorId || '') === String(vend.id || '') || n(x.vendorRaw) === n(vendNombre_(vend)); });
      if (inp.persona && !vend) return { error: 'No encontré a «' + inp.persona + '» en el equipo de Epi.' };
      del.sort(function (a, b) { return String(a.vendorRaw || '').localeCompare(String(b.vendorRaw || '')) || (a.orden || 0) - (b.orden || 0) || String(a.hora || '').localeCompare(String(b.hora || '')); });
      return { fecha: fd, persona: vend ? vendNombre_(vend) : 'todos', trabajos: del.map(function (x) { return [x.hora || '', x.tipo || '', x.propiedad || '', x.vendorRaw || x.vendorEmail || 'sin asignar', x.entradaHoy ? 'tiene entrada hoy' : ''].filter(Boolean).join(' · '); }) };
    }
    case 'tareas_abiertas': return { tareas: ctx.cfg().tareas.filter(function (t) { return t && t.id && !t.hecha; }).slice(0, 40).map(function (t) { return [t.id, t.texto, t.prop || '-', t.quien || '-', 'vence ' + (t.vence || '-')].join(' · '); }) };
    case 'crear_tarea': case 'cerrar_tarea': case 'agendar_en_epi': {
      var c2 = ctx.cfg(), props = c2.props.map(propNombre_).filter(Boolean);
      var acc = nombre === 'crear_tarea' ? { tipo: 'tarea', texto: inp.texto, prop: inp.propiedad, quien: inp.quien, vence: inp.vence }
        : nombre === 'cerrar_tarea' ? (inp.comentario ? { tipo: 'comentario', id: inp.id, texto: inp.comentario } : { tipo: 'hecha', id: inp.id })
        : { tipo: 'epi', propiedad: inp.propiedad, fecha: inp.fecha, hora: inp.hora, trabajo: inp.trabajo, tecnico: inp.tecnico, notas: inp.notas };
      var out = opEjecutar_(adm, [acc], c2, props); ctx._cfg = null;
      out.forEach(function (o) { ctx.hechas.push(o); });
      return out[0] && !out[0].error ? { ok: true, hecho: out[0].resumen } : { error: (out[0] && out[0].error) || 'no se pudo' };
    }
    case 'ver_propiedad': {
      var fil = leerTabla_(CFG.TAB_PROPIEDADES), np = n(inp.propiedad).replace(/[\s\-–_]/g, '');
      var hitP = fil.filter(function (r) { return n(r.property_name).replace(/[\s\-–_]/g, '') === np; })[0] || fil.filter(function (r) { return n(r.property_name).replace(/[\s\-–_]/g, '').indexOf(np) >= 0; })[0];
      if (!hitP) return { error: 'No encontré esa propiedad.', opciones: fil.map(function (r) { return r.property_name; }).filter(function (x) { return n(x).indexOf(n(inp.propiedad).split(' ')[0]) >= 0; }).slice(0, 8) };
      var j = {}; try { j = JSON.parse(String(hitP.info_json || '{}')); } catch (e) {}
      var plano = {}; (function rec(o, pre) { Object.keys(o || {}).forEach(function (k) { var v = o[k], key = pre ? pre + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v)) rec(v, key); else plano[key] = String(Array.isArray(v) ? JSON.stringify(v) : v).slice(0, 300); }); })(j, '');
      return { propiedad: hitP.property_name, campos: plano };
    }
    case 'cambiar_dato_propiedad': {
      if (/pass|code|codigo|pin|lock/i.test(String(inp.campo)) && !adm.principal) return { error: 'Solo el administrador principal puede cambiar claves y códigos.' };
      var rC = agSetCampo_(inp.propiedad, String(inp.campo), inp.valor, adm);
      ctx.hechas.push({ tipo: 'dato', resumen: 'Dato · ' + inp.propiedad + ' · ' + inp.campo, error: rC.ok ? '' : rC.error });
      return rC;
    }
    case 'promesas_abiertas': return { promesas: hubPromesas_(false).promesas.map(function (p) { return (p.estado === 'vencida' ? 'VENCIDA · ' : '') + (p.huesped || '') + ' · ' + p.que + ' · vence ' + p.vence; }) };
    case 'guardar_nota': ctx.hechas.push({ tipo: 'nota', texto: String(inp.texto).slice(0, 500), resumen: 'Nota · ' + String(inp.texto).slice(0, 80) }); return { ok: true };
  }
  return { error: 'Herramienta desconocida: ' + nombre };
}

/* Cambia un campo existente de info_json (o uno de CAMPOS_PROPIEDAD_), dejando registro como las mejoras del Hub. */
function agSetCampo_(propiedad, campo, valor, adm) {
  var sh = hoja_(CFG.TAB_PROPIEDADES), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toLowerCase(); });
  var cN = head.indexOf('property_name') + 1, cJ = head.indexOf('info_json') + 1; if (!cN || !cJ) return { error: 'columnas' };
  var norm = function (x) { return String(x || '').toLowerCase().replace(/[\s\-–_]/g, ''); };
  var nombres = sh.getRange(2, cN, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); });
  var i = nombres.findIndex(function (x) { return norm(x) === norm(propiedad); }); if (i < 0) return { error: 'Propiedad no encontrada: ' + propiedad + '. Usa el nombre exacto de ver_propiedad.' };
  var j; try { j = JSON.parse(String(sh.getRange(i + 2, cJ).getValue() || '{}')); } catch (e) { return { error: 'ficha inválida' }; }
  var path = campo.split('.'), o = j;
  for (var k = 0; k < path.length - 1; k++) { if (!o[path[k]] || typeof o[path[k]] !== 'object') { if (CAMPOS_PROPIEDAD_.indexOf(campo) < 0) return { error: 'El campo ' + campo + ' no existe en la ficha.' }; o[path[k]] = {}; } o = o[path[k]]; }
  var ult = path[path.length - 1];
  if (!(ult in o) && CAMPOS_PROPIEDAD_.indexOf(campo) < 0) return { error: 'El campo ' + campo + ' no existe en la ficha. Revisa los nombres con ver_propiedad.' };
  var antes = o[ult]; o[ult] = String(valor == null ? '' : valor).trim();
  sh.getRange(i + 2, cJ).setValue(JSON.stringify(j));
  try { regMejora_({ por: adm.nombre, origen: 'chat operativo', tipo: 'dato', clave: 'DATO', resumen: nombres[i] + ' · ' + campo, cambios: [{ tipo: 'dato', campo: campo, antes: antes == null ? '' : String(antes), despues: o[ult] }] }); } catch (e) {}
  try { log_({ codigo: '', propiedad: nombres[i], nivel: 'DATO', razon: campo, texto: 'antes: ' + (antes == null ? '' : antes), modo: 'HUB' }, o[ult], 'DATO actualizado por ALMA (pedido de ' + adm.nombre + ')'); } catch (e) {}
  return { ok: true, propiedad: nombres[i], campo: campo, antes: antes == null ? '' : String(antes), despues: o[ult] };
}

/* ── Bucle del agente ── */
function opAgente_(adm, texto, canal, fotos, previos) {
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), dia = Utilities.formatDate(ahora_(), CFG.TZ, 'EEEE d MMM HH:mm');
  var notas = previos.filter(function (m) { return m.acciones.some(function (a) { return a.tipo === 'nota'; }); }).map(function (m) { return m.acciones.filter(function (a) { return a.tipo === 'nota'; }).map(function (a) { return '· ' + a.texto; }).join('\n'); });
  var system = (prompt_('SECRETARIA') || SEMILLA_SECRETARIA_) + '\n\nHOY: ' + hoy + ' (' + dia + ', hora de Guatemala).\nADMINISTRADOR: ' + adm.nombre + (adm.principal ? ' · administrador principal (acceso total)' : ' · administrador') +
    '\nCANAL: ' + (canal === 'whatsapp' ? 'WhatsApp' : 'Hub') + '\n\nNOTAS QUE TE PIDIÓ RECORDAR:\n' + (notas.join('\n') || '(ninguna)');
  /* Conversación: lo de las últimas 6 h es la conversación activa; lo anterior solo como contexto breve. */
  var corte = Date.now() - 6 * 3600000, msgs = [];
  previos.filter(function (m) { return new Date(m.ts).getTime() >= corte; }).slice(-14).forEach(function (m) {
    var rol = m.de === 'yo' ? 'user' : 'assistant', t = String(m.texto || '').slice(0, 2000) || '…';
    if (msgs.length && msgs[msgs.length - 1].role === rol) msgs[msgs.length - 1].content += '\n\n' + t; else msgs.push({ role: rol, content: t });
  });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  var contenido = (fotos || []).slice(0, 4).map(imgBloque_).filter(Boolean); contenido.push({ type: 'text', text: texto });
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.push({ role: 'assistant', content: '(continúo)' });
  msgs.push({ role: 'user', content: contenido });
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiCfg_(); return this._cfg; } };
  var tools = agHerramientas_(), final = '';
  for (var vuelta = 0; vuelta < 8; vuelta++) {
    var j = claudeTools_(CFG.MODELO_REDACTOR, system, msgs, tools, 1600);
    if (!j) { final = 'No pude procesarlo ahora. Intenta de nuevo en un momento.'; break; }
    var bloques = j.content || [];
    msgs.push({ role: 'assistant', content: bloques });
    var usos = bloques.filter(function (b) { return b.type === 'tool_use'; });
    if (j.stop_reason === 'pause_turn') continue;   // búsqueda web larga: el servidor pide continuar
    if (!usos.length || j.stop_reason !== 'tool_use') { final = bloques.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').trim(); break; }
    msgs.push({ role: 'user', content: usos.map(function (u) {
      var res; try { res = agEjecutar_(adm, u.name, u.input, ctx); } catch (e) { console.error('agEjecutar_ ' + u.name + ': ' + (e.stack || e)); res = { error: String(e.message || e).slice(0, 200) }; }
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(res).slice(0, 12000), is_error: !!(res && res.error) };
    }) });
  }
  return { respuesta: final || (ctx.hechas.length ? 'Listo.' : 'Entendido.'), hechas: ctx.hechas };
}
