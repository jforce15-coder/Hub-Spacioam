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
  '· Los mensajes que escribes al equipo deben ser concretos y accionables: quién eres (si no te conocen: «Soy Alma, la asistente virtual de Spacio AM»), de parte de quién, para qué, y qué necesitas que haga y cuándo. Nada de mensajes vagos o de cortesía vacía.',
  '· Si el administrador quiere que hables con alguien (presentarte, explicar algo, hacerle preguntas, validar información) y no puedes llamar, usa encargar_conversacion: le escribes por WhatsApp pidiéndole que llame a la línea de ALMA (+502 3128 0966) y, cuando llame, cumplirás el objetivo y le enviarás el resumen al administrador. Incluye en el objetivo todo lo que te pidió (temas, preguntas).',
  '· Con el equipo eres directa y dinámica: es tu equipo, no un huésped.',
  '· En este chat, cuando te nombran a alguien («Gabriel», «Joselyn», «Selvin») se trata de alguien del EQUIPO (administración, técnicos, limpieza, mantenimiento, proveedores): búscalo con las herramientas del equipo, no entre huéspedes, y no pidas su número (las herramientas lo tienen). Solo si no aparece en el equipo o el contexto lo indica, pregunta si es un huésped.',
  '· Cuando le pidas algo a alguien del equipo y haya que hacer algo con su respuesta (ej. «cuando te mande el código, envíaselo al huésped»), usa escribir_a_equipo con al_responder describiendo exactamente qué hacer, con todos los datos (reserva, huésped, formato del mensaje). Así queda como encargo y lo cumples cuando responda, aunque sea otro día.',
  '· Si en ENCARGOS PENDIENTES CONTIGO hay algo y este mensaje es la respuesta (ej. te mandan un código), cúmplelo de inmediato con tus herramientas, ciérralo con cerrar_encargo y agradécele en una línea. No le preguntes de qué se trata: ya lo sabes.',
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
  if (r.getResponseCode() !== 200) {
    var err = r.getResponseCode() + ': ' + r.getContentText().slice(0, 400); console.error('claudeTools_ ' + err);
    try { CacheService.getScriptCache().put('ag_error', err, 3600); } catch (e) {}
    /* Si la búsqueda web no está habilitada en la cuenta de Anthropic, sigue sin ella. */
    if (/web_search/i.test(r.getContentText()) && tools.some(function (t) { return t.type && /web_search/.test(t.type); })) return claudeTools_(modelo, system, messages, tools.filter(function (t) { return !(t.type && /web_search/.test(t.type)); }), maxTokens);
    return null;
  }
  return j;
}

/* ── Definición de herramientas ── */
function agHerramientas_() {
  var s = function (d) { return { type: 'string', description: d }; };
  var T = function (name, description, props, req) { return { name: name, description: description, input_schema: { type: 'object', properties: props || {}, required: req || [] } }; };
  return [
    T('buscar_reservas', 'Busca reservas por nombre del huésped, código, propiedad o fecha. Tolera errores de escritura y de transcripción de voz (Brunello/Brunelo, Erika/Ericka, un dígito distinto): manda lo que te dieron tal cual, nombre y propiedad juntos en una sola búsqueda; no hace falta probar variantes. Cada resultado trae coincidencia exacta o aproximada; si es aproximada y hay más de una, confirma cuál. Devuelve código, huésped, propiedad, fechas, estado del registro y conv_id.',
      { texto: s('Nombre, apellido, código o parte del nombre de la propiedad'), fecha: s('YYYY-MM-DD: reservas activas ese día (entre entrada y salida)'), solo_llegadas: { type: 'boolean', description: 'Solo las que llegan en esa fecha' } }),
    T('ver_conversacion', 'Últimos mensajes de una reserva (plataforma, WhatsApp y llamadas) y promesas abiertas.', { codigo: s('Código de reserva o conv_id') }, ['codigo']),
    T('enviar_a_huesped', 'Envía un mensaje al huésped de una reserva por la plataforma (Airbnb/Booking/Hospitable) o por WhatsApp.',
      { codigo: s('Código de reserva o conv_id'), texto: s('Mensaje final, listo para enviar'), canal: { type: 'string', enum: ['plataforma', 'whatsapp'] }, numero: s('Opcional: número de WhatsApp si no es el registrado') }, ['codigo', 'texto', 'canal']),
    T('escribir_a_equipo', 'Envía un WhatsApp a una persona del equipo (administradores, técnicos, limpieza) por su nombre.',
      { persona: s('Nombre de la persona del equipo'), texto: s('Mensaje concreto y completo'), al_responder: s('Opcional: qué debes hacer cuando responda (con todos los datos). Queda como encargo pendiente.') }, ['persona', 'texto']),
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
    T('encargar_conversacion', 'Cuando el administrador quiere que ALMA hable con alguien (del equipo u otra persona) para presentarse, explicar algo, hacer preguntas o validar información. Le escribe por WhatsApp pidiéndole que llame a la línea de ALMA; cuando llame, ALMA cumple el objetivo en la llamada y le envía el resumen al administrador por WhatsApp.',
      { persona: s('Nombre de la persona del equipo, o un número de WhatsApp con código de país'), objetivo: s('Todo lo que hay que lograr en la conversación: qué explicar, qué preguntar, qué validar'), mensaje: s('WhatsApp inicial concreto: quién eres, de parte de quién, para qué y que llame a la línea de ALMA (+502 3128 0966)') }, ['persona', 'objetivo', 'mensaje']),
    T('cerrar_encargo', 'Marca como cumplido un encargo de ENCARGOS PENDIENTES CONTIGO y le avisa a quien lo pidió.', { id: s('id del encargo'), resultado: s('Qué se hizo, en una o dos frases') }, ['id', 'resultado']),
    T('promesas_abiertas', 'Lo que ALMA le prometió a huéspedes o contactos y sigue pendiente.', {}),
    T('grow_proyectos', 'Grow (captación y montaje de apartamentos nuevos): busca proyectos por edificio, apartamento, zona o dueño, o lista los de una etapa. Sin filtros da el conteo por etapa. Devuelve id, etapa, dueño y visita.',
      { buscar: s('Opcional: edificio, apartamento, zona o nombre del dueño'), etapa: { type: 'string', enum: GROW_ETAPAS_, description: 'Opcional: solo los de esta etapa' } }),
    T('grow_crear_proyecto', 'Grow: da de alta un apartamento nuevo (prospecto) con su dueño. Si el dueño trae correo, queda con acceso inmediato a Grow. Si ya existe ese edificio + apartamento, devuelve el existente.',
      { edificio: s('Nombre del edificio'), apto: s('Número o nombre del apartamento'), zona: s('Opcional: zona (ej. Zona 14)'), hab: { type: 'number', description: 'Opcional: habitaciones' }, banos: { type: 'number', description: 'Opcional: baños' },
        dueno_nombre: s('Opcional: nombre del dueño'), dueno_email: s('Opcional: correo del dueño'), dueno_tel: s('Opcional: teléfono del dueño'), etapa: { type: 'string', enum: GROW_ETAPAS_, description: 'Opcional; por defecto desconocido' }, nota: s('Opcional: contexto') }, ['edificio']),
    T('grow_mover_etapa', 'Grow: mueve un proyecto a otra etapa del embudo (usa el id de grow_proyectos). Para descartar usa etapa descartado con motivo.',
      { proyecto_id: s('id del proyecto (p…)'), etapa: { type: 'string', enum: GROW_ETAPAS_ }, motivo: s('Obligatorio si es descartado') }, ['proyecto_id', 'etapa']),
    T('grow_agendar_visita', 'Grow: agenda (o reprograma) la visita de levantamiento de un proyecto y se la asigna a alguien del equipo de Grow; le llega un correo. Si el proyecto estaba en captación pasa a visita.',
      { proyecto_id: s('id del proyecto (p…)'), fecha: s('YYYY-MM-DD HH:mm (hora Guatemala)'), asignado: s('Nombre de la persona del equipo de Grow'), nota: s('Opcional: indicaciones para quien visita') }, ['proyecto_id', 'fecha', 'asignado']),
    T('memoria_propiedad', 'Lo que ALMA aprendió del equipo sobre una propiedad o su edificio (elevadores, tarjetas, accesos, dónde se pierden los huéspedes). Cada dato trae su id.', { propiedad: s('Nombre o parte del nombre de la propiedad') }, ['propiedad']),
    T('recordar_en_propiedad', 'Guarda un dato nuevo en la memoria de una propiedad (o de todo su edificio) para que ALMA lo use con futuros huéspedes. Úsalo cuando el administrador te enseñe algo de una propiedad.',
      { propiedad: s('Nombre o parte del nombre'), dato: s('El dato, como hecho claro (máx. 30 palabras)'), alcance: { type: 'string', enum: ['apartamento', 'edificio'] }, dias: { type: 'number', description: 'Opcional: si es temporal, cuántos días vale' } }, ['propiedad', 'dato']),
    T('olvidar_memoria', 'Borra un dato de la memoria de una propiedad (por su id de memoria_propiedad).', { id: s('id del dato (mp…)') }, ['id']),
    T('guardar_nota', 'Guarda algo para recordarlo en conversaciones futuras con este administrador.', { texto: s('Lo que hay que recordar') }, ['texto']),
    { type: 'web_search_20250305', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', city: 'Guatemala City', timezone: 'America/Guatemala' } }
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
      var q = n(inp.texto), f = String(inp.fecha || '').slice(0, 10), inbox = hubInbox_(); var fOk = []; try { fOk = formsOk_(); } catch (e) {}
      var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return !/cancel/i.test(s_(r.status)) && s_(r.code); });
      var enFecha = filas.filter(function (r) {
        var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date);
        return !f || (inp.solo_llegadas ? ci === f : (ci <= f && f <= co));
      });
      /* Búsqueda flexible: tolera nombres y propiedades mal escritos o mal transcritos (Brunello/Brunelo, Erika/Ericka). */
      var parecido = {}, hits = !q ? (f ? enFecha.slice(0, 12) : []) : bqBuscar_(inp.texto, enFecha, function (r) { return [r.code, r.guest_first_name, r.guest_last_name, r.property_name, r.apartment].join(' '); }, 12)
        .map(function (x) { parecido[s_(x.item.code).toUpperCase()] = x.coincidencia; return x.item; });
      return { nota: hits.some(function (r) { return parecido[s_(r.code).toUpperCase()] === 'aproximada'; }) ? 'Resultados por parecido (la búsqueda tolera errores de escritura). Confirma con el administrador si hay más de uno o si el nombre no es igual.' : undefined,
        reservas: hits.map(function (r) {
        var cod = s_(r.code).toUpperCase(), ib = inbox.filter(function (x) { return String(x.codigo || '').toUpperCase() === cod; })[0] || {};
        return { codigo: cod, huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim(), propiedad: s_(r.property_name), entrada: fecha_(r.checkin_date), salida: fecha_(r.checkout_date),
          coincidencia: parecido[cod] || 'exacta', huespedes: s_(r.guest_count), registro: (/complet/i.test(s_(r.status_form)) || fOk.indexOf(cod) >= 0) ? 'completo' : 'pendiente', conv_id: ib.conv_id || '' };
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
      try { ctx.cfg().vendors.forEach(function (v) { personas.push({ nombre: vendNombre_(v), tel: String(v.phone || v.telefono || '') }); }); } catch (e) {}
      try { escalamiento_().forEach(function (p) { personas.push({ nombre: p.nombre, tel: p.telefono }); }); } catch (e) {}
      var p = agPersona_(inp.persona, ctx);
      if (!p) return { error: 'No encontré a «' + inp.persona + '» con un número de WhatsApp.' };
      var cE = CacheService.getScriptCache(), kE = 'agwa_' + fin8_(p.tel);
      if (cE.get(kE)) return { ok: true, enviado_a: p.nombre, nota: 'Ya le había escrito hace menos de 3 minutos; no lo repetí.' };
      cE.put(kE, '1', 180);
      var ok = true; try { waEnviar_(normTel_(p.tel), String(inp.texto)); } catch (e) { ok = false; }
      ctx.hechas.push({ tipo: 'mensaje', resumen: 'WhatsApp a ' + p.nombre + ' · ' + String(inp.texto).slice(0, 80), error: ok ? '' : 'no salió' });
      if (ok && inp.al_responder) { encargoCrear_(adm, p.nombre, normTel_(p.tel), 'ESPERA SU RESPUESTA. Le escribiste: «' + String(inp.texto).slice(0, 600) + '». Cuando responda: ' + String(inp.al_responder)); ctx.hechas.push({ tipo: 'encargo', resumen: 'Encargo · esperar respuesta de ' + p.nombre }); }
      return ok ? { ok: true, enviado_a: p.nombre, nota: 'Si no le había escrito en 24 h, WhatsApp puede no entregarlo; avísale por otro medio si es urgente.' } : { error: 'No se pudo enviar.' };
    }
    case 'ruta_del_dia': {
      var cfg = ctx.cfg(), fd = String(inp.fecha || hoy).slice(0, 10), quienR = inp.persona ? opMatch_(inp.persona, cfg.vendors.map(vendNombre_)) : '';
      var vend = quienR ? cfg.vendors.filter(function (v) { return vendNombre_(v) === quienR; })[0] : null;
      var del = cfg.schedules.filter(function (x) { return x && String(x.fecha || '').slice(0, 10) === fd && String(x.estado || '') !== 'cancelada' && String(x.estado || '') !== 'cancelado'; });
      if (vend) del = del.filter(function (x) { return String(x.vendorEmail || '').toLowerCase() === String(vend.email || '').toLowerCase() || String(x.vendorId || '') === String(vend.id || '') || n(x.vendorRaw) === n(vendNombre_(vend)); });
      if (inp.persona && !vend) return { error: cfg.vendors.length ? 'No encontré a «' + inp.persona + '» en el equipo de Epi. Personas: ' + cfg.vendors.map(vendNombre_).join(', ') : 'No pude leer Epi en este momento; intenta de nuevo en un minuto.' };
      del.sort(function (a, b) { return String(a.vendorRaw || '').localeCompare(String(b.vendorRaw || '')) || (a.orden || 0) - (b.orden || 0) || String(a.hora || '').localeCompare(String(b.hora || '')); });
      var nomDe = function (x) { var v = cfg.vendors.filter(function (y) { return (x.vendorEmail && String(y.email || '').toLowerCase() === String(x.vendorEmail).toLowerCase()) || (x.vendorId && String(y.id || '') === String(x.vendorId)); })[0]; return v ? vendNombre_(v) : (x.vendorRaw || x.vendorEmail || 'sin asignar'); };
      return { fecha: fd, persona: vend ? vendNombre_(vend) : 'todos', trabajos: del.map(function (x) { return [x.hora || '', x.tipo || '', x.propiedad || '', nomDe(x), x.estado === 'tentativa' ? 'tentativa' : '', x.entradaHoy ? 'tiene entrada hoy' : ''].filter(Boolean).join(' · '); }) };
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
      if (!hitP) {
        var par = bqBuscar_(inp.propiedad, fil, function (r) { return r.property_name; }, 6);
        if (par.length === 1 || (par.length > 1 && par[0].puntaje - par[1].puntaje >= 0.15)) hitP = par[0].item;
        else return { error: 'No encontré esa propiedad exacta.', opciones: par.map(function (x) { return x.item.property_name; }) };
      }
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
    case 'encargar_conversacion': {
      var pe = agPersona_(inp.persona, ctx) || (normTel_(inp.persona) ? { nombre: '+' + normTel_(inp.persona), tel: normTel_(inp.persona) } : null);
      if (!pe) return { error: 'No encontré a «' + inp.persona + '» con un número de WhatsApp.' };
      var okE = true; try { waEnviar_(normTel_(pe.tel), String(inp.mensaje)); } catch (e) { okE = false; }
      var idE = encargoCrear_(adm, pe.nombre, normTel_(pe.tel), String(inp.objetivo));
      ctx.hechas.push({ tipo: 'encargo', resumen: 'Encargo · ' + pe.nombre + ' · ' + String(inp.objetivo).slice(0, 80), error: okE ? '' : 'el WhatsApp no salió' });
      return { ok: okE, encargo: idE, persona: pe.nombre, nota: okE ? 'Mensaje enviado. Cuando llame, cumplo el objetivo y te mando el resumen por WhatsApp.' : 'Guardé el encargo pero el WhatsApp no salió; puede que no haya escrito en 24 h.' };
    }
    case 'cerrar_encargo': {
      var rE = encargoCerrar_(String(inp.id), String(inp.resultado || ''), adm);
      ctx.hechas.push({ tipo: 'encargo', resumen: 'Encargo cumplido · ' + String(inp.resultado || '').slice(0, 80), error: rE.ok ? '' : rE.error });
      return rE;
    }
    case 'promesas_abiertas': return { promesas: hubPromesas_(false).promesas.map(function (p) { return (p.estado === 'vencida' ? 'VENCIDA · ' : '') + (p.huesped || '') + ' · ' + p.que + ' · vence ' + p.vence; }) };
    case 'grow_proyectos': return growApi_('resumen', { q: inp.buscar || '', etapa: inp.etapa || '' });
    case 'grow_crear_proyecto': case 'grow_mover_etapa': case 'grow_agendar_visita': {
      if (nombre === 'grow_mover_etapa' && inp.etapa === 'descartado' && !String(inp.motivo || '').trim()) return { error: 'Para descartar necesito el motivo.' };
      var op = { grow_crear_proyecto: 'crear', grow_mover_etapa: 'etapa', grow_agendar_visita: 'visita' }[nombre];
      var r = growApi_(op, Object.assign({}, inp, { por: (adm && adm.nombre) || '' }));
      if (r && r.ok) ctx.hechas.push({ tipo: 'grow', resumen: 'Grow · ' + (op === 'crear' ? (r.ya_existia ? 'ya existía ' : 'nuevo proyecto ') + ((r.proyecto || {}).nombre || '')
        : op === 'etapa' ? r.proyecto + ': ' + r.de + ' → ' + r.a : 'visita ' + r.proyecto + ' · ' + r.fecha + ' · ' + r.asignado) });
      return r;
    }
    case 'memoria_propiedad': case 'recordar_en_propiedad': {
      var fl = leerTabla_(CFG.TAB_PROPIEDADES).map(function (r) { return r.property_name; }).filter(Boolean);
      var pn = fl.filter(function (x) { return n(x) === n(inp.propiedad); })[0] || bqMejor_(inp.propiedad, fl) || fl.filter(function (x) { return n(x).indexOf(n(inp.propiedad)) >= 0; })[0];
      if (!pn) return { error: 'No encontré esa propiedad.', opciones: bqBuscar_(inp.propiedad, fl, function (x) { return x; }, 6).map(function (x) { return x.item; }) };
      if (nombre === 'memoria_propiedad') return memoriaVer_(pn);
      var g = memoriaGuardar_(pn, [{ tema: 'Otro', dato: inp.dato, alcance: inp.alcance || 'apartamento', temporal: !!inp.dias, dias: inp.dias }], 'chat · ' + ((adm && adm.nombre) || ''), '', '', (adm && adm.nombre) || '');
      ctx.hechas.push({ tipo: 'memoria', resumen: 'Memoria · ' + pn + ' · ' + String(inp.dato).slice(0, 60) });
      return { ok: true, guardado: g };
    }
    case 'olvidar_memoria': { var r0 = memoriaOlvidar_(inp.id, (adm && adm.nombre) || ''); if (r0.ok) ctx.hechas.push({ tipo: 'memoria', resumen: 'Olvidado · ' + String(r0.olvidado).slice(0, 60) }); return r0; }
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
    encargosTexto_(adm) + '\nCANAL: ' + (canal === 'whatsapp' ? 'WhatsApp' : canal === 'llamada' ? 'llamada de voz: tu respuesta se leerá en voz alta, así que responde en 1 a 3 frases cortas, sin listas, sin markdown, sin enlaces' : 'Hub') + '\n\nNOTAS QUE TE PIDIÓ RECORDAR:\n' + (notas.join('\n') || '(ninguna)');
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
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } };
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

/* Foto liviana de Epi para el agente (Epi tarda 20-35 s en devolver su configuración completa de 1 MB).
   Se refresca sola cada 10 min desde procesarCola y se guarda en caché: técnicos, propiedades, tareas abiertas
   y la programación de ayer a +7 días. Si no hay foto, se lee en vivo una vez. */
function epiSnap_(forzar) {
  var c = CacheService.getScriptCache();
  if (!forzar) { try { var t = c.get('episnap'); if (t) return JSON.parse(t); } catch (e) {} }
  var cfg = epiCfg_();
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), ayer = sumarDias_(hoy, -21), fin = sumarDias_(hoy, 30);
  var snap = {
    ts: new Date().toISOString(),
    vendors: cfg.vendors.filter(function (v) { return v && v.active !== false; }).map(function (v) { return { id: v.id, email: v.email, name: vendNombre_(v), phone: v.phone || v.telefono || '' }; }),
    props: cfg.props.map(function (p) { return { nombre: propNombre_(p) }; }).filter(function (p) { return p.nombre; }),
    tareas: cfg.tareas.filter(function (t) { return t && t.id && !t.hecha; }).slice(0, 80),
    schedules: cfg.schedules.filter(function (x) { var f = String(x && x.fecha || '').slice(0, 10); return f >= ayer && f <= fin; })
      .map(function (x) { return { id: x.id, fecha: x.fecha, hora: x.hora, tipo: x.tipo, propiedad: x.propiedad, vendorEmail: x.vendorEmail, vendorId: x.vendorId, vendorRaw: x.vendorRaw, estado: x.estado, orden: x.orden, entradaHoy: x.entradaHoy }; })
  };
  try { c.put('episnap', JSON.stringify(snap), 1500); } catch (e) { console.error('episnap: ' + e); }
  return snap;
}
function epiSnapSiToca_() { var c = CacheService.getScriptCache(); if (c.get('episnap_t')) return; c.put('episnap_t', '1', 600); try { epiSnap_(true); } catch (e) { console.error('epiSnapSiToca_: ' + e); } }

/* Persona del equipo por nombre (administradores, técnicos de Epi, escalamiento). */
function agPersona_(nombre, ctx) {
  var personas = [];
  adminsOp_().forEach(function (a) { personas.push({ nombre: a.nombre, tel: a.tels[0] || '' }); });
  try { ctx.cfg().vendors.forEach(function (v) { personas.push({ nombre: vendNombre_(v), tel: String(v.phone || v.telefono || '') }); }); } catch (e) {}
  try { escalamiento_().forEach(function (p) { personas.push({ nombre: p.nombre, tel: p.telefono }); }); } catch (e) {}
  var m = opMatch_(nombre, personas.map(function (p) { return p.nombre; }));
  return personas.filter(function (x) { return x.nombre === m && normTel_(x.tel); })[0] || null;
}

/* ═══ ENCARGOS: conversaciones que un administrador le delega a ALMA («habla con Gabriel y explícale…»).
   ALMA le escribe a la persona pidiéndole que llame; cuando llama, el encargo entra en la ficha de la llamada y,
   al colgar, ALMA resume la conversación y se la envía a quien la pidió. ═══ */
var ENC_CAB_ = ['id', 'creado', 'solicitante', 'solicitante_tel', 'persona', 'tel', 'objetivo', 'estado', 'resumen', 'cerrado'];
function hojaEnc_() { return hojaCrear_('ALMA_ENCARGOS', ENC_CAB_); }
function encargoCrear_(adm, persona, tel, objetivo) {
  var id = 'en' + Date.now();
  hojaEnc_().appendRow([id, new Date().toISOString(), adm.email, adm.tels[0] || '', persona, tel, objetivo.slice(0, 2000), 'abierto', '', '']);
  return id;
}
function encargoAbierto_(tel) {
  var k = fin8_(tel); if (!k) return null;
  var sh = hojaEnc_(), n = sh.getLastRow(); if (n < 2) return null;
  var v = sh.getRange(2, 1, n - 1, ENC_CAB_.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (fin8_(v[i][5]) === k && v[i][7] === 'abierto' && Date.now() - new Date(v[i][1]).getTime() < 7 * 86400000)
    return { fila: i + 2, id: v[i][0], solicitante: v[i][2], solicitante_tel: String(v[i][3]), persona: v[i][4], objetivo: String(v[i][6]) };
  return null;
}
function encargoInstruccion_(e) {
  var adm = adminPorEmail_(e.solicitante) || {};
  return (adm.nombre || 'Un administrador') + ' te encargó hablar con ' + e.persona + '. Objetivo: ' + e.objetivo + ' Cúmplelo en esta llamada con naturalidad; al colgar, el resumen se le envía solo.';
}
function encargoCerrarConLlamada_(tel, d, resumen) {
  var e = encargoAbierto_(tel); if (!e) return;
  var lineas = (d.transcript || []).map(function (m) { return (m.role === 'agent' ? 'ALMA' : e.persona) + ': ' + s_(m.message); }).filter(function (x) { return x.length > 6; }).join('\n').slice(-12000);
  if (!lineas) return;
  var res = String(claude_(CFG.MODELO_REDACTOR, 700, 'Resumes para un administrador de Spacio AM una llamada que ALMA tuvo por encargo suyo. Español, directo, para leer en WhatsApp: 1) si se cumplió el objetivo, 2) lo importante que dijo la persona (respuestas, datos, compromisos), 3) pendientes o siguientes pasos. Sin markdown, máximo 12 líneas.',
    'OBJETIVO DEL ENCARGO: ' + e.objetivo + '\n\nTRANSCRIPCIÓN:\n' + lineas, 0.2) || resumen || '').trim();
  if (!res) return;
  var sh = hojaEnc_();
  sh.getRange(e.fila, 8, 1, 3).setValues([['cumplido', res.slice(0, 4000), new Date().toISOString()]]);
  var adm = adminPorEmail_(e.solicitante);
  var texto = 'Resumen de mi llamada con ' + e.persona + ':\n\n' + res;
  if (adm) { try { opGuardar_(adm, 'alma', 'llamada', texto, [{ tipo: 'encargo', resumen: 'Encargo cumplido · ' + e.persona }]); } catch (x) {} }
  var dest = normTel_(e.solicitante_tel) || (adm && adm.tels[0]);
  if (dest) { try { waEnviar_(dest, texto); } catch (x) { console.error('encargo aviso: ' + x); } }
}

/* Encargos abiertos donde esta persona es a quien se le pidió algo (por sus teléfonos). */
function encargosDe_(tels) {
  var ks = (tels || []).map(fin8_).filter(Boolean); if (!ks.length) return [];
  var sh = hojaEnc_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ENC_CAB_.length).getValues().map(function (r, i) { return { fila: i + 2, id: String(r[0]), creado: r[1], solicitante: String(r[2]), solicitante_tel: String(r[3]), persona: String(r[4]), tel: String(r[5]), objetivo: String(r[6]), estado: String(r[7]) }; })
    .filter(function (e) { return e.estado === 'abierto' && ks.indexOf(fin8_(e.tel)) >= 0 && Date.now() - new Date(e.creado).getTime() < 7 * 86400000; });
}
function encargosTexto_(adm) {
  var l = []; try { l = encargosDe_(adm.tels || []); } catch (e) {}
  if (!l.length) return '';
  return '\n\nENCARGOS PENDIENTES CONTIGO (' + adm.nombre + '):\n' + l.map(function (e) { var a = adminPorEmail_(e.solicitante) || {}; return '· [' + e.id + '] De parte de ' + (a.nombre || e.solicitante) + ' (' + String(e.creado instanceof Date ? e.creado.toISOString() : e.creado).slice(0, 16).replace('T', ' ') + '): ' + e.objetivo; }).join('\n') + '\n';
}
function encargoCerrar_(id, resultado, quien) {
  var sh = hojaEnc_(), n = sh.getLastRow(); if (n < 2) return { error: 'no hay encargos' };
  var v = sh.getRange(2, 1, n - 1, ENC_CAB_.length).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === id) {
    sh.getRange(i + 2, 8, 1, 3).setValues([['cumplido', String(resultado).slice(0, 2000), new Date().toISOString()]]);
    var adm = adminPorEmail_(String(v[i][2])), txt = 'Encargo cumplido (' + v[i][4] + '): ' + resultado;
    if (adm && (!quien || adm.email !== quien.email)) { try { opGuardar_(adm, 'alma', 'whatsapp', txt, [{ tipo: 'encargo', resumen: 'Encargo cumplido · ' + v[i][4] }]); } catch (e) {} var dest = normTel_(v[i][3]) || adm.tels[0]; if (dest) { try { waEnviar_(dest, txt); } catch (e) {} } }
    return { ok: true };
  }
  return { error: 'No encontré ese encargo.' };
}

/* Hub: quién limpió antes de la llegada y quién tiene asignada la limpieza de salida de una reserva (Epi). */
function hubLimpiezas_(codigo) {
  codigo = String(codigo || '').trim().toUpperCase(); if (!codigo) return { ok: false, error: 'falta código' };
  var r = leerTabla_(CFG.TAB_RESERVAS).filter(function (x) { return s_(x.code).toUpperCase() === codigo; }).pop();
  if (!r) return { ok: false, error: 'No encontré la reserva.' };
  var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date), prop = s_(r.property_name);
  var cfg = epiSnap_(false), nrm = function (x) { return String(x || '').toLowerCase().replace(/[\s\-–_]/g, ''); };
  var nombreDe = function (x) { var v = cfg.vendors.filter(function (y) { return (x.vendorEmail && String(y.email || '').toLowerCase() === String(x.vendorEmail).toLowerCase()) || (x.vendorId && String(y.id || '') === String(x.vendorId)); })[0]; return v ? v.name : (x.vendorRaw || x.vendorEmail || 'sin asignar'); };
  var tel = function (x) { var v = cfg.vendors.filter(function (y) { return x.vendorEmail && String(y.email || '').toLowerCase() === String(x.vendorEmail).toLowerCase(); })[0]; return v ? String(v.phone || '') : ''; };
  var deProp = cfg.schedules.filter(function (x) { return nrm(x.propiedad) === nrm(prop) && !/cancel/.test(String(x.estado || '')) && /limpieza/i.test(String(x.tipo || '')); });
  var antes = deProp.filter(function (x) { return String(x.fecha).slice(0, 10) <= ci; }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); })[0];
  var salida = deProp.filter(function (x) { return String(x.fecha).slice(0, 10) >= co; }).sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); })[0];
  var f = function (x) { return x ? { fecha: String(x.fecha).slice(0, 10), hora: x.hora || '', tipo: x.tipo || '', quien: nombreDe(x), tel: tel(x), estado: x.estado || '' } : null; };
  return { ok: true, propiedad: prop, checkin: ci, checkout: co, antes: f(antes), salida: f(salida), rango: 'Epi: últimas 3 semanas y próximo mes' };
}

/* ═══ GROW (captación y montaje) ═══════════════════════════════════════════════════════════════
   La secretaria consulta y mueve proyectos de Grow por su puerta de servidor (__secretaria), que escribe en las
   hojas y en el estado compartido de la app. Token en la propiedad GROW_TOKEN (se carga por el robot: grow_token). */
var GROW_URL_DEF_ = 'https://script.google.com/macros/s/AKfycbxPYwdz0Q8za7_wZzX37QeqODoqwxOeoXZpeEWp94HKtHMqru12VPD4xt0cOtWHZA1LDQ/exec';
var GROW_ETAPAS_ = ['desconocido', 'reunion', 'archivos', 'visita', 'decision', 'anteproyecto', 'presupuesto', 'contrato', 'ejecucion', 'fotos', 'lanzamiento', 'revision', 'descartado'];
function growApi_(op, datos) {
  var P = PropertiesService.getScriptProperties(), tok = P.getProperty('GROW_TOKEN');
  if (!tok) return { ok: false, error: 'Grow no está conectado todavía (falta GROW_TOKEN).' };
  try {
    var r = UrlFetchApp.fetch(P.getProperty('GROW_URL') || GROW_URL_DEF_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify(Object.assign({}, datos || {}, { action: '__secretaria', token: tok, op: op })) });
    var t = r.getContentText();
    try { return JSON.parse(t); } catch (e) { return { ok: false, error: 'Grow respondió ' + r.getResponseCode() + ': ' + t.slice(0, 200) }; }
  } catch (e) { return { ok: false, error: 'Grow no respondió: ' + e }; }
}
