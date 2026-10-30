/* ═══ ALMA · SECRETARIA DEL EQUIPO ADMINISTRATIVO (agente con herramientas) ═══════════════════════
   El chat operativo (Hub y WhatsApp de cada administrador) ya no devuelve un JSON de acciones fijas: ALMA trabaja con
   herramientas reales (Claude tool use) y cada una revisa el rol de quien pide antes de actuar.
   Prompt editable en ALMA_INSTRUCCIONES → SECRETARIA. Para volver al flujo anterior: propiedad OP_AGENTE = 0.
   Áreas en esta versión: reservas y conversaciones, mensajes a huéspedes y al equipo, Epi (rutas, tareas, agenda),
   propiedades (leer y corregir), promesas, notas y búsqueda web. Próximas: Grow, agenda (Calendar), llamadas salientes. */
/* Regla fija (código, no hoja): vale aunque el prompt editable SECRETARIA no la tenga. */
var REGLA_CODIGOS_SECRETARIA_ = '\n\nREGLA FIJA · CÓDIGOS DE ACCESO: cuando te pregunten un código (de limpieza, del equipo, de emergencia, de la puerta o la cerradura de una propiedad, o el que se le envió a un huésped) usa SIEMPRE la herramienta codigo_acceso. Son los mismos códigos que el equipo ve en Epi: permanentes o de la quincena vigente. Nunca respondas que no hay código sin haber llamado a codigo_acceso; si devuelve una nota (sin código cargado, quincena pendiente), dila tal cual. ver_propiedad y la memoria de la propiedad NO tienen códigos. Los códigos del equipo son solo para administradores y el equipo: nunca se los envíes a un huésped.';
/* Prompt completo de la secretaria. El de código (SEMILLA) siempre va: antes, la fila SECRETARIA de la hoja (una versión
   vieja de 11 líneas) lo reemplazaba y ALMA perdía reglas y herramientas nuevas. Lo de la hoja se suma como indicaciones
   del equipo, más las mejoras aprobadas y las reglas fijas. La voz (voz.js) usa esta misma función. */
function secretariaPrompt_() {
  var hoja = String(prompt_('SECRETARIA') || '').trim(), base = SEMILLA_SECRETARIA_;
  var extra = hoja && base.indexOf(hoja.slice(0, 120)) < 0 ? '\n\nINDICACIONES DEL EQUIPO (hoja ALMA_INSTRUCCIONES):\n' + hoja : '';
  var mej = ''; try { mej = mejorasBloque_('SECRETARIA'); } catch (e) {}
  /* La personalidad (playbook alma) y el negocio (playbook negocio-…) van primero y aparte: el resto es el trabajo de secretaria. */
  var persona = ''; try { persona = almaPersona_('texto') + '\n\n' + negocioBloque_() + '\n\n═══ TU TRABAJO COMO SECRETARIA ═══\n'; } catch (e) { console.error('persona: ' + e); }
  return persona + base + extra + mej + REGLA_CODIGOS_SECRETARIA_ + REGLAS_FIJAS_SECRETARIA_;
}
var REGLAS_FIJAS_SECRETARIA_ = '\n\nREGLAS FIJAS (código):' +
  '\n· Si un nombre de propiedad, huésped o persona no coincide exacto, ofrece las 1 a 3 opciones más parecidas que devuelvan tus herramientas en vez de preguntar en blanco. Si solo hay una coincidencia clara, úsala.' +
  '\n· «Marcar como resuelta» = marcar_resuelta. No lo confundas con promesas abiertas.' +
  '\n· Para un mensaje inmediato a alguien del equipo o a un contacto de trabajo (recepción de un edificio, proveedor) usa escribir_a_equipo (acepta numero si no está en el equipo). programar_mensaje es solo para enviar más tarde.' +
  '\n· Para reunir información de alguien por WhatsApp usa escribir_a_equipo con al_responder; encargar_conversacion es solo cuando el administrador quiere que esa persona te LLAME.' +
  '\n· Socios, propietarios, proveedores y contactos de trabajo son temas de Spacio AM: no preguntes si escribir como Spacio AM o como asistente de Juan.' +
  '\n· Lo que una herramienta te devolvió en esta conversación es real: no digas después que lo inventaste. Si dudas, vuelve a consultar.' +
  '\n· Si ver_imagenes existe en tus herramientas, sí puedes ver las fotos de una conversación: úsala.' +
  '\n· No envíes dos veces el mismo mensaje al mismo destinatario; si ya salió, dilo.' +
  '\n· Nunca digas «lo hago ahora», «le escribo» o «le doy seguimiento» sin hacerlo en esta misma respuesta con la herramienta. Si no lo hiciste, di que no lo hiciste y por qué.' +
  '\n· Antes de decir que no hay registro de alguien, revisa LO QUE PEDISTE Y SIGUE ABIERTO, usa buscar_contacto (proveedores, técnicos, socios) y, si te dan un número, ver_conversacion con ese número.' +
  '\n· Cuando le escribas a alguien que no es huésped, en el texto del pedido incluye quién es para la empresa (socio de qué, proveedor de qué): así queda bien clasificado.' +
  '\n· ACTÚA, NO PREGUNTES: si el pedido se puede cumplir con lo que tienes, cúmplelo. Solo pregunta cuando de verdad falta un dato que ninguna herramienta te da, y entonces una sola pregunta concreta.' +
  '\n· No preguntes el canal para un huésped: por defecto se le escribe en la conversación de su reserva (Airbnb, Booking o la plataforma que sea) con enviar_a_huesped. WhatsApp solo si el administrador lo pide o si el huésped te está escribiendo por WhatsApp.' +
  '\n· No preguntes entre dos nombres parecidos (Gabriel / Gabriela) si tus herramientas devuelven una sola persona que coincide; usa esa.' +
  '\n· Para la recepción de un edificio, escribir_a_equipo con persona «Recepción <edificio o propiedad>»: ya tienes esos números. No los pidas.' +
  '\n· Nunca le pidas al administrador su propio número ni su correo: ya los tienes (es quien te habla). En un pedido en segundo plano, la respuesta va directo a él.' +
  '\n· Nunca digas que no puedes hacer algo si una de tus herramientas lo hace: programar mensajes (programar_mensaje), ver fotos (ver_imagenes), códigos (codigo_acceso), contactos (buscar_contacto), proyectos de Grow (grow_*).' +
  '\n· Nunca inventes un código, una dirección, un monto ni un número: si una herramienta no te lo dio en esta conversación, no lo tienes.' +
  '\n· El estado de una reserva es el campo estado que devuelve buscar_reservas. Si dice cancelada, está cancelada (di cuándo, con cancelada_el): nunca digas que está activa ni hables de su acceso como si siguiera en pie.' +
  '\n· «¿Hubo cancelaciones…?» (hoy, ayer, esta semana, los últimos N días) se responde con cancelaciones, nunca con buscar_reservas. Calcula el rango desde la fecha de hoy.' +
  '\n· CIERRE CON PENDIENTES (solo con administradores, en voz y en chat): cuando la conversación llega a su cierre natural (ya resolviste lo pedido y no queda nada abierto en ella), en aproximadamente 1 de cada 3 o 4 cierres —no siempre, y nunca dos veces seguidas— ofrece repasar los pendientes en lugar del «¿algo más?» habitual: «¿Quieres que revisemos juntos los pendientes? Tenemos tres cosas importantes.». Antes de ofrecerlo, consulta con tareas_abiertas, promesas_abiertas, mensajes_programados y ENCARGOS PENDIENTES CONTIGO y nombra en una frase corta las 3 más relevantes (encargos abiertos, promesas a huéspedes, mensajes del equipo sin respuesta, tareas vencidas). Si no hay pendientes reales, no lo ofrezcas ni inventes ninguno. Si responde que no o lo pospone («después», «no ahorita», «luego»), acéptalo sin insistir y cierra normal. Si dice que sí, repásalos uno por uno, breve.' +
  '\n· Reviews, recordatorios y mensajes automáticos de UNA reserva: programados_reserva para verlos y cancelar_programados_reserva para quitarlos (filtro review para los de reseña). No digas que no puedes.';
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
  '· Para enviar algo más tarde («mañana a las 7», «el lunes temprano») usa programar_mensaje. Si no dice zona, es hora de Guatemala; si habla de su hora (está en España) usa Europe/Madrid. Confirma la hora en ambas zonas cuando no sea obvio.',
  '· Proyectos personales: cuando el administrador agrupa conversaciones en un tema («proyecto Boda»), usa mensaje_personal con proyecto. Todo lo que digan las personas de ese proyecto se consolida en un solo resumen (ver_proyecto). Si una conversación ya empezó sin proyecto, pásala con asignar_a_proyecto. Un mismo número puede estar luego en otro proyecto.',
  '· Temas personales del administrador (escribirle a un familiar, amigo o cualquier persona fuera del negocio): usa mensaje_personal. Ahí eres «Alma, la asistente de Juan», nunca Spacio AM. Para llamadas salientes todavía no tienes herramienta: dilo y ofrece el mensaje.',
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
/* Herramientas solo de la app de Alma (música, casa): el Hub, WhatsApp y las web apps no las ven. */
var AGENTE_APP_ = false, AG_SOLO_APP_ = ['musica'];
/* Si no es null, solo esas herramientas (p. ej. la familia de Juan: vozFamilia_ en voz.js). */
var AGENTE_PERMITIDAS_ = null;
/* Tolerancia de una llamada (retomar.js): hasta cuándo puede esperar la voz y qué pidió, por si sigue en segundo plano. */
var AGENTE_PLAZO_ = 0, AGENTE_PEDIDO_ = '';
function agHerramientas_() {
  var s = function (d) { return { type: 'string', description: d }; };
  var T = function (name, description, props, req) { return { name: name, description: description, input_schema: { type: 'object', properties: props || {}, required: req || [] } }; };
  return [
    T('buscar_reservas', 'Busca reservas por nombre del huésped, código, propiedad o fecha. Cada resultado trae estado (confirmada, cancelada…) consultado en Hospitable: incluye las canceladas. Tolera errores de escritura y de transcripción de voz (Brunello/Brunelo, Erika/Ericka, un dígito distinto): manda lo que te dieron tal cual, nombre y propiedad juntos en una sola búsqueda; no hace falta probar variantes. Cada resultado trae coincidencia exacta o aproximada; si es aproximada y hay más de una, confirma cuál. Devuelve código, huésped, propiedad, fechas, estado del registro y conv_id.',
      { texto: s('Nombre, apellido, código o parte del nombre de la propiedad'), fecha: s('YYYY-MM-DD: reservas activas ese día (entre entrada y salida)'), solo_llegadas: { type: 'boolean', description: 'Solo las que llegan en esa fecha' } }),
    T('cancelaciones', 'Reservas CANCELADAS en un rango de fechas (según la fecha en que se canceló, en Hospitable en vivo). Úsala para «¿hubo cancelaciones ayer / esta semana / en los últimos 3 días?».',
      { desde: s('YYYY-MM-DD, inicio del rango (fecha de cancelación)'), hasta: s('YYYY-MM-DD, fin del rango (incluido). Si es un solo día, igual a desde') }, ['desde']),
    T('programados_reserva', 'Mensajes automáticos programados de UNA reserva en Hospitable (recordatorio de reseña/review, check-in, first morning, salida…) que aún no salen, y el estado de la reseña al huésped.',
      { codigo: s('Código de reserva o conv_id') }, ['codigo']),
    T('cancelar_programados_reserva', 'Cancela mensajes programados de una reserva en Hospitable: los de reseña/review (filtro = review), todos (filtro = todos), los que contengan una palabra, o por ids de programados_reserva. Hospitable no permite posponerlos: si piden «posponer», cancélalos y ofrece programar uno nuevo con la fecha que digan.',
      { codigo: s('Código de reserva o conv_id'), filtro: s('review, todos o una palabra del título'), ids: s('Opcional: ids separados por coma') }, ['codigo']),
    T('ver_conversacion', 'Últimos mensajes de una reserva (plataforma, WhatsApp y llamadas) y promesas abiertas. También la conversación de WhatsApp de ALMA con cualquier número (socio, contacto de trabajo, alguien del equipo): pasa el número con código de país.', { codigo: s('Código de reserva, conv_id o número de WhatsApp (ej. +1 908 447 1404)') }, ['codigo']),
    T('buscar_reuniones', 'Busca en las reuniones, conferencias, llamadas y memos que Alma escuchó en modo conferencia (la app del iPhone): su resumen, acuerdos y lo que le tocó a Juan. Úsala cuando pregunte «¿qué quedamos en la reunión con…?», «¿qué se dijo de…?». Sin búsqueda, las últimas. Lo que no tenía sentido (grabaciones por error, ruido) queda en Temporal unos días y se borra solo si nadie lo consulta: con temporales=true las ves; si Juan busca algo y aparece una temporal, se rescata.',
      { buscar: s('Palabras: persona, proyecto o tema. Vacío para las últimas'), temporales: { type: 'boolean', description: 'true para ver solo las que están en Temporal' } }, []),
    T('buscar_contacto', 'Ficha y TODO el historial de alguien que no es huésped: proveedores, técnicos, socios, potenciales socios, recepciones. Úsala cuando pidan retomar, dar seguimiento o saber qué se habló con alguien («lo de Liliana», «el del transporte», «el técnico del aire»). Busca por nombre, empresa, servicio, apartamento o número.', { texto: s('Nombre, empresa, servicio, apartamento o número') }, ['texto']),
    T('ver_imagenes', 'Mira las imágenes y fotos que mandó el huésped en la conversación de una reserva (capturas, comprobantes, datos de facturación, fotos de un problema). Devuelve las más recientes para que las leas tú mismo. Úsala cuando el administrador mencione una imagen o cuando ver_conversacion marque [imagen].',
      { codigo: s('Código de reserva o conv_id'), cuantas: { type: 'integer', description: 'Cuántas imágenes recientes (1 a 4, por defecto 4)' } }, ['codigo']),
    T('marcar_resuelta', 'Marca la conversación de una reserva como RESUELTA en la bandeja del Hub (igual que el botón «Resuelta»): sale de pendientes, lo anterior queda como atendido y se cierran las promesas abiertas de ALMA en esa conversación. Un mensaje nuevo del huésped la reabre sola. Con reabrir = true la vuelve a abrir.',
      { codigo: s('Código de reserva o conv_id (si solo tienes el nombre, búscalo antes con buscar_reservas)'), reabrir: { type: 'boolean', description: 'true para reabrirla en vez de resolverla' } }, ['codigo']),
    T('enviar_a_huesped', 'Envía un mensaje al huésped de una reserva por la plataforma (Airbnb/Booking/Hospitable) o por WhatsApp. Por la plataforma no presentes a la empresa («te escribimos de Spacio AM», «Alma de Spacio AM»): el huésped ya sabe con quién reservó. Tú sí te presentas cuando haga falta (no te conocen), con «te saluda Alma»: «Hola Marcela, te saluda Alma.» Formato fácil de leer en el teléfono: saludo en su propia línea y párrafos cortos (una idea por párrafo) separados por una línea en blanco.',
      { codigo: s('Código de reserva o conv_id'), texto: s('Mensaje final, listo para enviar'), canal: { type: 'string', enum: ['plataforma', 'whatsapp'] }, numero: s('Opcional: número de WhatsApp si no es el registrado') }, ['codigo', 'texto', 'canal']),
    T('escribir_a_equipo', 'Envía un WhatsApp a una persona del equipo (administradores, técnicos, limpieza) por su nombre.',
      { persona: s('Nombre de la persona del equipo o del contacto (ej. «Recepción Ignacio»)'), numero: s('Opcional: número de WhatsApp con código de país, para contactos que no están en el equipo'), texto: s('Mensaje concreto y completo'), al_responder: s('Opcional: qué debes hacer cuando responda (con todos los datos). Queda como encargo pendiente.') }, ['persona', 'texto']),
    T('ruta_del_dia', 'Ruta / programación de Epi de un día: qué propiedades tiene asignadas cada técnico (o uno en particular), con hora, tipo y orden.',
      { fecha: s('YYYY-MM-DD; por defecto hoy'), persona: s('Opcional: nombre del técnico') }),
    T('tareas_abiertas', 'Lista las tareas abiertas del equipo (Hub/Epi).', {}),
    T('crear_tarea', 'Crea una tarea para el equipo.', { texto: s('Qué hay que hacer'), propiedad: s('Opcional'), quien: s('Opcional: responsable'), vence: s('YYYY-MM-DD; por defecto hoy') }, ['texto']),
    T('cerrar_tarea', 'Marca una tarea como hecha o le agrega un comentario.', { id: s('id de la tarea'), comentario: s('Opcional: en vez de cerrarla, deja este comentario') }, ['id']),
    T('agendar_en_epi', 'Agenda un trabajo en Epi (limpieza, limpieza profunda, mantenimiento o supervisión).',
      { propiedad: s('Propiedad'), fecha: s('YYYY-MM-DD'), hora: s('HH:MM'), trabajo: s('Limpieza, Limpieza Profunda, Mantenimiento o Supervisión'), tecnico: s('Opcional: nombre'), notas: s('Opcional') }, ['propiedad', 'fecha']),
    T('ver_propiedad', 'Ficha de una propiedad tal como la usa ALMA (dirección, WiFi, parqueo, llegada…) con el nombre exacto de cada campo editable.', { propiedad: s('Nombre o parte del nombre') }, ['propiedad']),
    T('codigo_acceso', 'Códigos de acceso de una propiedad tal como los ve el equipo en Epi (permanente o de la quincena vigente, con su vigencia) y, si das el código de reserva, los códigos que ya se le enviaron a ese huésped. Úsala para cualquier pregunta de códigos.',
      { propiedad: s('Nombre o parte del nombre de la propiedad (ej. «Bonadiez 1001»; «Brunelo» devuelve todas las de Brunelo)'), fecha: s('YYYY-MM-DD; por defecto hoy'), codigo_reserva: s('Opcional: código de reserva para ver el código que ya se le envió al huésped') }),
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
    T('olvidar_memoria', 'Borra un dato de la memoria de una propiedad (por su id de memoria_propiedad). Si el administrador confirma uno «por confirmar», guárdalo con recordar_en_propiedad y borra el viejo.', { id: s('id del dato (mp…)') }, ['id']),
    T('calcular_distancia', 'Tiempo en carro y caminando desde una propiedad hasta un lugar (USAC, aeropuerto, un centro comercial, el parque central…). Responde en minutos; caminando solo cuenta si son 15 min o menos.', { propiedad: s('Nombre o parte del nombre de la propiedad'), destino: s('Lugar, con ciudad si ayuda') }, ['propiedad', 'destino']),
    T('mensaje_personal', 'Temas PERSONALES del administrador (no de Spacio AM): escribirle a alguien de su parte por WhatsApp. Te presentas como Alma, la asistente de Juan; nunca menciones Spacio AM. Si la persona no ha escrito en 24 h, primero le llega «Hola, soy Alma, la asistente de Juan. ¿Tienes un minuto?» y, cuando responda, este mensaje. Lo que la persona conteste le llega al administrador.',
      { persona: s('Nombre de la persona (si lo sabes)'), numero: s('Número de WhatsApp con código de país; si ya le escribiste antes por este medio, basta el nombre'), texto: s('Mensaje completo, natural, en primera persona como su asistente (ej. «Juan me pidió avisarte que…»), sin mencionar Spacio AM'), objetivo: s('Si el administrador quiere que reúnas información o resuelvas algo (ej. «recopila su itinerario: fechas, vuelos, hospedaje»): qué hay que conseguir. Con objetivo, ALMA conversa con la persona hasta tenerlo y le manda un resumen al administrador; sin objetivo, solo le reenvía lo que conteste.'), proyecto: s('Proyecto personal al que pertenece (ej. «Boda Pamela»). Todas las conversaciones del mismo proyecto se consolidan: ALMA usa lo que dijeron los demás y mantiene un resumen único. Si el administrador nombra un proyecto, úsalo siempre.'), contexto_de: { type: 'array', items: { type: 'string' }, description: 'Solo si no hay proyecto: nombres de personas con las que ya hablaste del mismo tema' } }, ['texto']),
    T('proyectos_personales', 'Lista los proyectos personales abiertos y quién participa en cada uno.', {}),
    T('ver_proyecto', 'Resumen consolidado de un proyecto personal (todo lo reunido con todas las personas, contradicciones y lo que falta).', { proyecto: s('Nombre del proyecto'), actualizar: { type: 'boolean', description: 'Rehacer el resumen con los últimos mensajes' } }, ['proyecto']),
    T('asignar_a_proyecto', 'Pasa una conversación personal ya iniciada (por nombre de la persona) a un proyecto, con todo lo que ya se habló.', { persona: s('Nombre'), proyecto: s('Proyecto'), objetivo: s('Opcional: qué se quiere lograr en el proyecto') }, ['persona', 'proyecto']),
    T('cerrar_proyecto', 'Cierra un proyecto personal terminado.', { proyecto: s('Nombre del proyecto') }, ['proyecto']),
    T('ver_conversacion_personal', 'Lo que ALMA habló con alguien en un tema personal (por nombre), para usarlo o resumirlo.', { persona: s('Nombre') }, ['persona']),
    T('programar_mensaje', 'Programa un WhatsApp para enviarse más tarde (a alguien del equipo operativo/administrativo, proveedor o un tema personal). Confirma siempre al administrador la fecha y hora con su zona.',
      { persona: s('Nombre de la persona (del equipo se busca su número solo)'), numero: s('Número con código de país si no es del equipo o no lo tengo'), texto: s('Mensaje final, tal cual se enviará'),
        cuando: s('AAAA-MM-DD HH:MM'), zona: s('Zona de esa hora: America/Guatemala (por defecto) o Europe/Madrid si el administrador habla de su hora en España'),
        tipo: { type: 'string', enum: ['equipo', 'personal'], description: 'personal = de parte de Juan como su asistente, sin mencionar Spacio AM' } }, ['texto', 'cuando', 'tipo']),
    T('mensajes_programados', 'Lista los mensajes programados que aún no se envían.', {}),
    T('cancelar_programado', 'Cancela un mensaje programado.', { id: s('id del mensaje programado') }, ['id']),
    T('musica', 'Pone o controla música en el Spotify de Juan (solo el administrador principal): una canción, un artista, un álbum o un mood («algo tranquilo», «jazz para cenar», «música para concentrarme»), en el dispositivo que diga (la bocina de la sala, la cocina, el teléfono, el carro…). También pausar, seguir, siguiente, anterior, volumen, qué está sonando y la lista de dispositivos. Para un mood usa tipo mood con una búsqueda corta y buena (ej. «chill acoustic», «lofi focus», «cena jazz»). Confirma en una frase qué puso y dónde.',
      { accion: { type: 'string', enum: ['poner', 'pausar', 'seguir', 'siguiente', 'anterior', 'volumen', 'que_suena', 'dispositivos'] }, consulta: s('Qué poner: canción y artista, artista, álbum o mood'),
        tipo: { type: 'string', enum: ['cancion', 'artista', 'album', 'playlist', 'mood'] }, dispositivo: s('Dónde (como lo dijo: sala, cocina, cuarto, teléfono…). Vacío = donde ya suena'), nivel: { type: 'number', description: 'Volumen 0-100' } }, ['accion']),
    /* El equipo de agentes detrás de Alma (agentes.js): ella le pide trabajo a cada uno y le pasa a Juan lo que proponen. */
    T('pedir_a_agente', 'Le pide trabajo a uno de TUS AGENTES (trabajan detrás de ti; solo tú hablas con las personas): operaciones (limpiezas, rutas, tareas del día), huespedes (conversaciones, promesas, reseñas), finanzas (cancelaciones, pagos, cobros), crecimiento (ocupación, anuncios, Grow), marketing (contenido, promociones, marca), mantenimiento (reparaciones, fallas que se repiten, preventivo, técnicos) o desarrollo (el jefe del equipo técnico con Claude: pedidos generales y la retro; responde después en la conversación Desarrollo) o uno de sus subdepartamentos, cada uno dueño de una app: dev_hub (Hub), dev_api (Apps Script), dev_app (app de Alma), dev_hola, dev_epi, dev_grow, dev_mi, dev_docs, mejora (el equipo de mejora continua: busca cómo gastar menos —voz, modelo, IA— sin quitar funciones ni bajar la calidad) o archivo (el departamento que ordena conversaciones y archivos en áreas y cajones: Ideas, Interés, Ocio; revisa lo que quedó sin clasificar y cambia las reglas de guardado: orden alfabético, por creación o por modificación, y qué se guarda, qué es temporal y por cuántos días, y qué no se guarda). Revisa y devuelve su informe y lo que propone. Solo para el administrador principal.',
      { agente: s('operaciones | huespedes | finanzas | crecimiento | marketing | mantenimiento | desarrollo | dev_hub | dev_api | dev_app | dev_hola | dev_epi | dev_grow | dev_mi | dev_docs | archivo'), pedido: s('Lo que Juan quiere que revise o haga, con sus palabras') }, ['agente']),
    T('leer_playbook', 'Abre el playbook de un trabajo (pasos, reglas, caja de herramientas y «listo significa») para hacerlo como se debe. Úsalo antes de trabajar en un tema de un departamento o de una app, o cuando no estés segura de cómo se hace. Los nombres están en el índice del playbook del negocio (operaciones, huespedes, finanzas, crecimiento, marketing, mantenimiento, archivo, correos, desarrollo, hub, api, app-alma, hola, epi, grow, mi, docs).',
      { nombre: s('Nombre del playbook') }, ['nombre']),
    T('enviar_archivo', 'Manda un archivo PDF al WhatsApp de Juan. Úsala cuando pida que le envíes el reporte de actividad o la transcripción de una llamada («mándame el reporte», «mándame la transcripción de la llamada»). tipo: «actividad» (lo que hiciste en el chat operativo; dias = cuántos días atrás, 3 por defecto) o «llamada» (transcripción de una llamada de voz; id opcional, sin id es la última). Si responde error de 24 h, dile en una frase que escriba a Alma por WhatsApp y vuelva a pedirlo. Solo administrador principal.', { tipo: s('actividad o llamada'), dias: { type: 'number', description: 'Solo actividad: días hacia atrás (1 a 30)' }, id: s('Solo llamada: id de la conversación; vacío = la última') }, ['tipo']),
    T('unir_cambio', 'Une (publica) un cambio que Claude dejó listo, sin que Juan entre a GitHub. Úsala cuando Juan diga «une», «une el cambio», «une el de la app», «une el 240», «une todo», «publícalo». cual: el número, la app y el número («Hub #240»), palabras del título, el enlace, o «todos» (une todos los que están listos). Sin cual, devuelve la lista de cambios abiertos para que le digas en simple cuáles hay y le preguntes. Si uno no se pudo unir, dile por qué en una frase. Solo administrador principal.',
      { cual: s('Cuál cambio: número, «App #número», palabras del título, enlace o «todos». Vacío para ver la lista') }, []),
    T('ajustar_playbook', 'Cuando Juan corrige CÓMO trabaja uno de tus agentes o departamentos («que Operaciones siempre revise también las salidas de pasado mañana», «en Hola el botón va abajo»), no lo arregles solo en esta conversación: guárdalo en el playbook de ese agente para que lo cumpla siempre. campo: reglas (lo normal), pasos (el orden de trabajo) o listo (lo que tiene que cumplir antes de entregar). Antes, si no está claro, hazle a Juan una o dos preguntas (meta, cómo se ve terminado). Solo administrador principal.',
      { agente: s('id del agente: operaciones, huespedes, finanzas, crecimiento, marketing, mantenimiento, archivo, desarrollo o dev_hub, dev_api, dev_app, dev_hola, dev_epi, dev_grow, dev_mi, dev_docs o mejora'), cambio: s('La regla, paso o condición de «listo», en una frase clara'), campo: s('reglas | pasos | listo') }, ['agente', 'cambio']),
    T('propuestas_agentes', 'Lo que tus agentes proponen y espera el sí de Juan (numeradas). Úsala cuando pregunte qué hay pendiente de los agentes o antes de aprobar.', {}),
    T('decidir_propuestas', 'Aprueba (se hace en ese momento) o rechaza propuestas de los agentes. Solo cuando Juan lo dice claro («apruébalas», «solo la 2», «la 3 no»).',
      { numeros: s('Números de la lista de propuestas_agentes separados por coma, o «todas»'), aprobar: { type: 'boolean', description: 'true aprueba (y se hace), false rechaza' } }, ['numeros', 'aprobar']),
    T('mejora_para_claude', 'Le pasa DIRECTO a Claude (el desarrollador que programa el Hub, Hola, Epi, Mi, Grow, Docs, la app de iPhone y a ti misma) un pedido para MEJORAR EL SISTEMA: una regla o un algoritmo que debe funcionar distinto, una función nueva, algo que falla. Úsala cuando el administrador principal diga «dile a Claude», «esto hay que mejorarlo», «cambia la regla de…», «esto está fallando» o describa cómo debería funcionar algo. NO es para pedir información, cambiar un dato (eso lo haces tú) ni tu tono (eso es guardar_nota). Solo el administrador principal puede usarla; a otros diles que se lo pidan a Juan. Antes de llamarla, tradúcelo a una instrucción clara y completa para un programador: qué pasa hoy, cómo debe funcionar exactamente (reglas, casos, límites), un ejemplo concreto y cómo se sabrá que quedó bien. Al confirmar, dilo en una frase corta («Listo, ya se lo pasé a Claude»), sin leer el pedido.',
      { titulo: s('Título corto y claro (máx. 80 caracteres)'), app: { type: 'string', enum: ['Hub', 'Alma WhatsApp', 'Alma voz', 'Hola', 'Epi', 'Mi', 'Grow', 'Docs', 'Gentle Stoic Parent', 'Otro'], description: 'Dónde aplica' },
        tipo: { type: 'string', enum: ['mejora', 'error', 'funcion_nueva'] }, que_pasa: s('Qué pasa hoy (el problema o la situación), con sus palabras'), que_quiere: s('Cómo debería funcionar, con todo el detalle que dio'),
        ejemplo: s('Un caso concreto si lo dio (nombres, apartamento, mensaje, hora)'), prioridad: { type: 'string', enum: ['alta', 'normal', 'baja'] } }, ['titulo', 'app', 'tipo', 'que_quiere']),
    T('enviar_correo', 'Manda un correo a la dirección que Juan te diga (p. ej. «mándale los vuelos a hola@spacioam.com»). Solo cuando Juan lo pide. Escribe el correo completo y claro, con los datos tal cual (vuelos, horarios, enlaces).',
      { para: s('Correo de destino'), asunto: s('Asunto corto'), texto: s('Cuerpo del correo, completo') }, ['para', 'asunto', 'texto']),
    T('guardar_familia', 'Guarda a alguien de la familia de Juan (su esposa, sus hijos, sus padres…) para que Alma lo reconozca cuando llama o escribe, lo trate por su nombre y le ayude con lo personal de Juan. Úsala cuando Juan diga quién es («Christine es mi esposa»). Si ya le escribiste antes, basta el nombre.',
      { nombre: s('Nombre de la persona'), relacion: s('Qué es de Juan: «esposa de Juan», «mamá de Juan»…'), numero: s('WhatsApp con código de país (opcional si ya hay conversación)') }, ['nombre', 'relacion']),
    T('guardar_nota', 'Guarda algo para recordarlo en conversaciones futuras con este administrador.', { texto: s('Lo que hay que recordar') }, ['texto']),
    { type: 'web_search_20250305', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', city: 'Guatemala City', timezone: 'America/Guatemala' } }
  ];
}

/* ── Ejecución ── */
function agResId_(codigo) {
  var c = String(codigo || '').trim(); if (!c) return '';
  if (/^[0-9a-f-]{20,}$/i.test(c) || /^(wa|inq):/.test(c)) return c;
  /* Un número de teléfono (contacto de trabajo, socio, alguien del equipo): su conversación de WhatsApp con ALMA. */
  if (/^\+?[\d\s().-]{8,}$/.test(c) && normTel_(c)) return 'wa:' + normTel_(c);
  var C = c.toUpperCase().replace(/\s+/g, '');
  var hit = hubInbox_().filter(function (x) { return String(x.codigo || '').toUpperCase() === C && x.conv_id && !/^(wa|op|inq):/.test(x.conv_id); })[0];
  return hit ? hit.conv_id : '';
}
/* Estado real de una reserva: Hospitable en vivo (10 min en caché) para los primeros resultados; si no, lo que diga
   la hoja. La hoja puede tardar en enterarse de una cancelación, por eso se pregunta a Hospitable. */
function agEstadoReserva_(uuid, fila, vivo) {
  var hoja = /cancel/i.test(s_(fila && fila.status)) ? 'cancelada' : (s_(fila && fila.status) ? (estadoEs_(s_(fila.status).toLowerCase()) || s_(fila.status)) : 'confirmada');
  if (!vivo || !uuid || /^(wa|op|inq):/.test(uuid)) return { estado: hoja };
  var c = CacheService.getScriptCache(), k = 'agest_' + String(uuid).slice(-40), c0 = c.get(k);
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  var out = { estado: hoja };
  try {
    var r = hosp_('get', '/reservations/' + uuid), d = r.code === 200 && r.json && r.json.data;
    if (d) {
      var cur = (d.reservation_status && d.reservation_status.current) || {}, cat = s_(cur.category || d.status).toLowerCase();
      out.estado = estadoEs_(cat) || cat || hoja;
      if (/cancel/.test(cat)) {
        var hc = ((d.reservation_status && d.reservation_status.history) || []).filter(function (h) { return /cancel/i.test(s_(h.category)); }).pop();
        if (hc && hc.changed_at) out.cancelada_el = Utilities.formatDate(new Date(hc.changed_at), CFG.TZ, 'yyyy-MM-dd HH:mm');
      }
    }
  } catch (e) { console.error('agEstadoReserva_: ' + e); }
  try { c.put(k, JSON.stringify(out), 600); } catch (e) {}
  return out;
}
/* Cancelaciones por la fecha en que se cancelaron (Hospitable en vivo). Se piden las reservas canceladas con entrada
   desde 60 días antes del rango hasta un año después, y se filtran por la fecha del cambio a «cancelled». */
function agCancelaciones_(desde, hasta) {
  desde = String(desde).slice(0, 10); hasta = String(hasta || desde).slice(0, 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(desde) || !/^\d{4}-\d\d-\d\d$/.test(hasta)) return { error: 'Fechas en formato YYYY-MM-DD.' };
  var ck = 'agcanc_' + desde + '_' + hasta, cache = CacheService.getScriptCache(), c0 = cache.get(ck);
  if (c0) { try { return JSON.parse(c0); } catch (e) {} }
  var ids = idsPropiedades_(); if (!ids.length) return { error: 'No pude leer las propiedades de Hospitable.' };
  var ini = sumarDias_(desde, -60), fin = sumarDias_(hasta, 365), lista = [], vistos = {};
  for (var i = 0; i < ids.length; i += 40) {
    var qs = ids.slice(i, i + 40).map(function (x) { return 'properties[]=' + encodeURIComponent(x); }).join('&');
    for (var pg = 1; pg <= 4; pg++) {
      var r = hosp_('get', '/reservations?' + qs + '&status[]=cancelled&date_query=checkin&start_date=' + ini + '&end_date=' + fin + '&include=guest,properties&per_page=100&page=' + pg);
      if (r.code !== 200) break;
      var d = (r.json && r.json.data) || [];
      d.forEach(function (x) {
        var cur = (x.reservation_status && x.reservation_status.current) || {};
        if (!/cancel/i.test(s_(cur.category || x.status)) || vistos[x.id]) return; vistos[x.id] = 1;
        var hc = ((x.reservation_status && x.reservation_status.history) || []).filter(function (h) { return /cancel/i.test(s_(h.category)); }).pop();
        if (!hc || !hc.changed_at) return;
        var dia = Utilities.formatDate(new Date(hc.changed_at), CFG.TZ, 'yyyy-MM-dd');
        if (dia < desde || dia > hasta) return;
        var g = x.guest || {}, pr = (x.properties && x.properties[0]) || {};
        lista.push({ codigo: s_(x.code), huesped: s_(g.first_name ? g.first_name + ' ' + (g.last_name || '') : g.name).trim(), propiedad: s_(pr.name || pr.public_name),
          entrada: s_(x.arrival_date).slice(0, 10), salida: s_(x.departure_date).slice(0, 10), cancelada_el: Utilities.formatDate(new Date(hc.changed_at), CFG.TZ, 'yyyy-MM-dd HH:mm'), plataforma: s_(x.platform), conv_id: s_(x.id) });
      });
      var meta = r.json && r.json.meta; if (!meta || !meta.last_page || pg >= meta.last_page) break;
    }
  }
  lista.sort(function (a, b) { return a.cancelada_el < b.cancelada_el ? 1 : -1; });
  var out = { desde: desde, hasta: hasta, cancelaciones: lista, total: lista.length, nota: lista.length ? undefined : 'Hospitable no tiene reservas canceladas en esas fechas.' };
  try { cache.put(ck, JSON.stringify(out), 300); } catch (e) {}
  return out;
}
function agEjecutar_(adm, nombre, inp, ctx) {
  inp = inp || {}; if (AGENTE_PERMITIDAS_ && AGENTE_PERMITIDAS_.indexOf(nombre) < 0) return { error: 'Esa herramienta no está disponible para esta persona.' };
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), n = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  switch (nombre) {
    case 'buscar_reservas': {
      var q = n(inp.texto), f = String(inp.fecha || '').slice(0, 10), inbox = hubInbox_(); var fOk = []; try { fOk = formsOk_(); } catch (e) {}
      /* Las canceladas también se buscan (marcadas): si no, ALMA decía que una reserva cancelada seguía activa. */
      var filas = leerTabla_(CFG.TAB_RESERVAS).filter(function (r) { return s_(r.code); });
      var enFecha = filas.filter(function (r) {
        var ci = fecha_(r.checkin_date), co = fecha_(r.checkout_date);
        return !f || (inp.solo_llegadas ? ci === f : (ci <= f && f <= co));
      });
      /* Búsqueda flexible: tolera nombres y propiedades mal escritos o mal transcritos (Brunello/Brunelo, Erika/Ericka). */
      var parecido = {}, hits = !q ? (f ? enFecha.slice(0, 12) : []) : bqBuscar_(inp.texto, enFecha, function (r) { var pn = s_(r.property_name); return [r.code, r.guest_first_name, r.guest_last_name, pn, pn.replace(/\s+/g, ''), r.apartment].join(' '); }, 12)
        .map(function (x) { parecido[s_(x.item.code).toUpperCase()] = x.coincidencia; return x.item; });
      return { nota: hits.some(function (r) { return parecido[s_(r.code).toUpperCase()] === 'aproximada'; }) ? 'Resultados por parecido (la búsqueda tolera errores de escritura). Confirma con el administrador si hay más de uno o si el nombre no es igual.' : undefined,
        reservas: (function () { var vivos = 0; return hits.map(function (r) {
        var cod = s_(r.code).toUpperCase(), ib = inbox.filter(function (x) { return String(x.codigo || '').toUpperCase() === cod; })[0] || {};
        var est = agEstadoReserva_(ib.conv_id, r, vivos++ < 5);
        return { codigo: cod, estado: est.estado, cancelada_el: est.cancelada_el, huesped: [s_(r.guest_first_name), s_(r.guest_last_name)].join(' ').trim(), propiedad: s_(r.property_name), entrada: fecha_(r.checkin_date), salida: fecha_(r.checkout_date),
          coincidencia: parecido[cod] || 'exacta', huespedes: s_(r.guest_count), registro: (/complet/i.test(s_(r.status_form)) || fOk.indexOf(cod) >= 0) ? 'completo' : 'pendiente', conv_id: ib.conv_id || '' };
      }).sort(function (a, b) { return (a.estado === 'cancelada') - (b.estado === 'cancelada'); }); })(), total: hits.length,
        aviso_estado: 'El campo estado viene de Hospitable en vivo para los primeros resultados. Si dice cancelada, la reserva está CANCELADA: dilo así y no la trates como activa.' };
    }
    case 'cancelaciones': return agCancelaciones_(inp.desde || inp.fecha || hoy, inp.hasta || inp.desde || inp.fecha || hoy);
    case 'programados_reserva': {
      var ridP = agResId_(inp.codigo); if (!ridP || /^(wa|op):/.test(ridP)) return { error: 'No encontré esa reserva. Búscala antes con buscar_reservas y usa su código.' };
      var pg = hubProgramados_(ridP); if (!pg.ok) return { error: 'No pude leer los programados (' + pg.error + ').' };
      var gr = null; try { gr = hubGuestReview_(ridP); } catch (e) {}
      return { conv_id: ridP, programados: pg.lista.map(function (m) { return { id: m.id, titulo: m.titulo, envio: String(m.envio).slice(0, 16).replace('T', ' '), texto: String(m.texto).slice(0, 160) }; }),
        resena_al_huesped: gr && gr.ok && gr.existe ? { estado: gr.estado, programada: gr.programado || undefined } : undefined,
        nota: pg.lista.length ? undefined : 'No hay mensajes programados pendientes para esta reserva.' };
    }
    case 'cancelar_programados_reserva': {
      var ridC = agResId_(inp.codigo); if (!ridC || /^(wa|op):/.test(ridC)) return { error: 'No encontré esa reserva. Búscala antes con buscar_reservas y usa su código.' };
      var pgC = hubProgramados_(ridC); if (!pgC.ok) return { error: 'No pude leer los programados (' + pgC.error + ').' };
      var ids = String(inp.ids || '').split(/[\s,]+/).filter(Boolean), filtro = n(inp.filtro || '');
      var obj = pgC.lista.filter(function (m) {
        if (ids.length) return ids.indexOf(String(m.id)) >= 0;
        if (!filtro || filtro === 'todos') return true;
        var t = n(m.titulo + ' ' + m.texto); return filtro === 'review' || filtro === 'resena' ? /review|resena|reseña|opini/.test(t) : t.indexOf(filtro) >= 0;
      });
      if (!obj.length) return { ok: false, error: 'No hay programados pendientes que coincidan.', programados: pgC.lista.map(function (m) { return m.titulo; }) };
      var hechos = obj.map(function (m) { var rr = hubCancelarProg_(ridC, m.id); return { titulo: m.titulo, ok: !!rr.ok, error: rr.error }; });
      var okN = hechos.filter(function (x) { return x.ok; }).length;
      if (okN) ctx.hechas.push({ tipo: 'programado', resumen: 'Cancelados ' + okN + ' programado(s) · ' + (inp.codigo || '') });
      return { ok: okN === hechos.length, cancelados: hechos };
    }
    case 'ver_conversacion': {
      var rid = agResId_(inp.codigo); if (!rid) return { error: 'No encontré esa reserva en las conversaciones.' };
      var h = hiloConv_(rid); if (h.code !== 200) return { error: 'No pude leer la conversación (HTTP ' + h.code + ').' };
      var pr = hubPromesas_(false).promesas.filter(function (p) { return p.conv_id === rid; });
      var entregaWa = /^wa:/.test(rid) ? waEntregaTexto_(rid.slice(3)) : '';
      return { conv_id: rid, entrega_ultimo_mensaje: entregaWa || undefined, mensajes: (h.hilo || []).slice(-15).map(function (m) { return (m.tipo === 'guest' ? 'HUÉSPED' : m.auto ? 'AUTOMÁTICO' : 'SPACIO AM') + (m.llamada ? ' (llamada)' : m.canal === 'whatsapp' ? ' (WhatsApp)' : '') + ' · ' + String(m.created || '').slice(0, 16).replace('T', ' ') + ': ' + String(m.texto || '').slice(0, 500) + ((m.fotos || []).length ? ' [imagen' + (m.fotos.length > 1 ? 'es: ' + m.fotos.length : '') + ' — usa ver_imagenes]' : ''); }),
        promesas_abiertas: pr.map(function (p) { return p.que + ' (vence ' + p.vence + ')'; }) };
    }
    case 'buscar_reuniones': return { ok: true, reuniones: confBuscar_(inp.buscar, 5, !!inp.temporales) };   // conferencia.js
    case 'buscar_contacto': {
      var fichas = contactoBuscar_(inp.texto);
      if (!fichas.length && normTel_(inp.texto) && String(inp.texto).replace(/\D/g, '').length >= 8) { try { var nueva = contactoClasificar_(normTel_(inp.texto), '', true); if (nueva) fichas = [nueva]; } catch (e) {} }
      if (!fichas.length) return { error: 'No tengo ficha de «' + inp.texto + '». Si tienes su número, búscalo con el número.' };
      return { contactos: fichas.slice(0, 3).map(function (o, i) {
        var r = { nombre: o.nombre, numero: '+' + o.tel, tipo: CONTACTO_TIPOS_[o.tipo] || o.tipo, rol: o.rol, empresa: o.empresa, propiedades: o.propiedades, estado: o.estado, resumen: o.resumen, actualizado: String(o.actualizado).slice(0, 10), entrega_ultimo_mensaje: waEntregaTexto_(o.tel) };
        if (i === 0) r.historial = contactoHistorial_(o.tel, 40).map(function (m) { return m.ts.slice(0, 16).replace('T', ' ') + ' · ' + m.de + ': ' + m.texto.replace(/\s+/g, ' ').slice(0, 300); });
        return r;
      }) };
    }
    case 'ver_imagenes': {
      var ridI = agResId_(inp.codigo); if (!ridI) return { error: 'No encontré esa conversación.' };
      var hI = hiloConv_(ridI); if (hI.code !== 200) return { error: 'No pude leer la conversación (HTTP ' + hI.code + ').' };
      var lista = [];
      (hI.hilo || []).forEach(function (m) { (m.fotos || []).forEach(function (u) { if (u) lista.push({ u: u, de: m.tipo === 'guest' ? 'huésped' : 'Spacio AM', f: String(m.created || '').slice(0, 16).replace('T', ' ') }); }); });
      var n = Math.max(1, Math.min(4, Number(inp.cuantas) || 4)), ult = lista.slice(-n);
      if (!ult.length) return { ok: true, imagenes: 0, nota: 'Esa conversación no tiene imágenes.' };
      return { ok: true, imagenes: ult.length, total_en_conversacion: lista.length, detalle: ult.map(function (x, i) { return 'Imagen ' + (i + 1) + ': de ' + x.de + ', ' + x.f; }), _imgs: ult.map(function (x) { return x.u; }) };
    }
    case 'marcar_resuelta': {
      var ridR = agResId_(inp.codigo); if (!ridR) return { error: 'No encontré esa conversación en la bandeja.' };
      var rr = hubResolver_(ridR, inp.reabrir ? 'abierta' : 'resuelta', 'ALMA · pedido de ' + adm.nombre, Date.now());
      ctx.hechas.push({ tipo: 'resuelta', resumen: (inp.reabrir ? 'Conversación reabierta' : 'Conversación marcada como resuelta') + ' · ' + ridR, error: rr.ok ? '' : (rr.error || 'no se guardó') });
      return rr.ok ? { ok: true, estado: inp.reabrir ? 'abierta' : 'resuelta', conv_id: ridR } : { error: rr.error || 'No se pudo marcar.' };
    }
    case 'enviar_a_huesped': {
      var rid2 = agResId_(inp.codigo); if (!rid2) return { error: 'No encontré esa reserva.' };
      var cH = CacheService.getScriptCache(), kH = 'aghu_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, rid2 + '|' + String(inp.texto || '').trim().toLowerCase().slice(0, 300)));
      if (cH.get(kH)) return { ok: true, nota: 'Ese mismo mensaje ya se le envió a esta reserva hace menos de 3 minutos; no lo repetí.' };
      var quien = 'ALMA · pedido de ' + adm.nombre;
      inp.texto = pulirMsgHuesped_(inp.texto, inp.canal === 'whatsapp' ? 'whatsapp' : 'plataforma');
      var r2 = inp.canal === 'whatsapp' ? hubResponderWa_(rid2, inp.texto, quien, inp.numero || '') : hubResponder_(rid2, inp.texto, quien, 'plataforma');
      if (r2.ok) cH.put(kH, '1', 180);
      ctx.hechas.push({ tipo: 'mensaje', resumen: 'Mensaje al huésped (' + (inp.canal === 'whatsapp' ? 'WhatsApp' : 'plataforma') + ') · ' + String(inp.texto).slice(0, 80), error: r2.ok ? '' : r2.error });
      return r2.ok ? { ok: true, plantilla: !!r2.plantilla } : { error: r2.error === 'sin_numero' ? 'No hay número de WhatsApp para esa reserva; pide el número.' : r2.error };
    }
    case 'escribir_a_equipo': {
      var personas = [];
      adminsOp_().forEach(function (a) { personas.push({ nombre: a.nombre, tel: a.tels[0] || '' }); });
      try { ctx.cfg().vendors.forEach(function (v) { personas.push({ nombre: vendNombre_(v), tel: String(v.phone || v.telefono || '') }); }); } catch (e) {}
      try { escalamiento_().forEach(function (p) { personas.push({ nombre: p.nombre, tel: p.telefono }); }); } catch (e) {}
      var p = agPersona_(inp.persona, ctx);
      if (normTel_(inp.numero || '')) p = { nombre: (p && p.nombre) || String(inp.persona || 'Contacto'), tel: normTel_(inp.numero) };
      if (!p) return { error: 'No encontré a «' + inp.persona + '» con un número de WhatsApp. Si es un contacto de trabajo (recepción, proveedor), pídele el número al administrador y vuelve a llamar con numero.' };
      var cE = CacheService.getScriptCache(), kE = 'agwa_' + fin8_(p.tel);
      if (cE.get(kE)) return { ok: true, enviado_a: p.nombre, nota: 'Ya le había escrito hace menos de 3 minutos; no lo repetí.' };
      cE.put(kE, '1', 180);
      var rw = waEnviarAlguien_(p.tel, String(inp.texto), { nombre: p.nombre, de: (adm && adm.nombre) || 'Spacio AM' }), ok = !!rw.ok;
      if (!ok) cE.remove(kE);
      ctx.hechas.push({ tipo: 'mensaje', resumen: 'WhatsApp a ' + p.nombre + ' · ' + String(inp.texto).slice(0, 80), error: ok ? '' : (rw.error || 'no salió') });
      if (ok) { try { contactoAsegurar_(p.tel); } catch (e) {} }
      if (ok) { try { contactoEncolar_(p.tel, 'Pedido de ' + ((adm && adm.nombre) || 'un administrador') + ' sobre ' + p.nombre + ': ' + String(inp.texto).slice(0, 600) + (inp.al_responder ? ' · Cuando responda: ' + String(inp.al_responder).slice(0, 400) : '')); } catch (e) {} }
      if (ok && inp.al_responder) { encargoCrear_(adm, p.nombre, normTel_(p.tel), 'ESPERA SU RESPUESTA. Le escribiste: «' + String(inp.texto).slice(0, 600) + '». Cuando responda: ' + String(inp.al_responder)); ctx.hechas.push({ tipo: 'encargo', resumen: 'Encargo · esperar respuesta de ' + p.nombre }); }
      return ok ? { ok: true, enviado_a: p.nombre, nota: rw.modo === 'plantilla' ? 'No había escrito en 24 h: se envió el aviso de primer contacto pidiéndole que responda; el mensaje completo sale en cuanto responda. Meta confirma la entrega después: no digas que le llegó hasta verlo como ENTREGADO.' : 'Enviado a WhatsApp (Meta confirma la entrega después).' } : { error: 'No se pudo enviar: ' + (rw.error || '') };
    }
    case 'ruta_del_dia': {
      var cfg = ctx.cfg(), fd = String(inp.fecha || hoy).slice(0, 10), quienR = inp.persona ? opMatch_(inp.persona, cfg.vendors.map(vendNombre_)) : '';
      var vend = quienR ? cfg.vendors.filter(function (v) { return vendNombre_(v) === quienR; })[0] : null;
      var del = cfg.schedules.filter(function (x) { return x && String(x.fecha || '').slice(0, 10) === fd && String(x.estado || '') !== 'cancelada' && String(x.estado || '') !== 'cancelado'; });
      if (vend) del = del.filter(function (x) { return String(x.vendorEmail || '').toLowerCase() === String(vend.email || '').toLowerCase() || String(x.vendorId || '') === String(vend.id || '') || n(x.vendorRaw) === n(vendNombre_(vend)); });
      if (inp.persona && !vend) return { error: cfg.vendors.length ? 'No encontré a «' + inp.persona + '» en el equipo de Epi. Personas: ' + cfg.vendors.map(vendNombre_).join(', ') : 'No pude leer Epi en este momento; intenta de nuevo en un minuto.' };
      del.sort(function (a, b) { return String(a.vendorRaw || '').localeCompare(String(b.vendorRaw || '')) || (a.orden || 0) - (b.orden || 0) || String(a.hora || '').localeCompare(String(b.hora || '')); });
      var nomDe = function (x) { var v = cfg.vendors.filter(function (y) { return (x.vendorEmail && String(y.email || '').toLowerCase() === String(x.vendorEmail).toLowerCase()) || (x.vendorId && String(y.id || '') === String(x.vendorId)); })[0]; return v ? vendNombre_(v) : (x.vendorRaw || x.vendorEmail || 'sin asignar'); };
      var codDe = function (x) { try { var c = codigoEquipo_(x.propiedad, fd, cfg.schedules); return c && c.codigo ? 'código ' + c.codigo + ' (' + c.tipo + ')' : ''; } catch (e) { return ''; } };
      return { fecha: fd, persona: vend ? vendNombre_(vend) : 'todos', trabajos: del.map(function (x) { return [x.hora || '', x.tipo || '', x.propiedad || '', nomDe(x), x.estado === 'tentativa' ? 'tentativa' : '', x.entradaHoy ? 'tiene entrada hoy' : '', codDe(x)].filter(Boolean).join(' · '); }) };
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
    case 'codigo_acceso': { var rC = codigosAcceso_(inp, ctx.cfg()); (rC.equipo || []).forEach(function (e) { ctx.hechas.push({ tipo: 'consulta', resumen: 'Código · ' + e.propiedad + ': ' + (e.codigo || 'sin código') + (e.tipo ? ' (' + e.tipo + ')' : '') }); }); return rC; }
    case 'cambiar_dato_propiedad': {
      if (/pass|code|codigo|pin|lock/i.test(String(inp.campo)) && !adm.principal) return { error: 'Solo el administrador principal puede cambiar claves y códigos.' };
      var rC = agSetCampo_(inp.propiedad, String(inp.campo), inp.valor, adm);
      ctx.hechas.push({ tipo: 'dato', resumen: 'Dato · ' + inp.propiedad + ' · ' + inp.campo, error: rC.ok ? '' : rC.error });
      return rC;
    }
    case 'encargar_conversacion': {
      var pe = agPersona_(inp.persona, ctx) || (normTel_(inp.persona) ? { nombre: '+' + normTel_(inp.persona), tel: normTel_(inp.persona) } : null);
      if (!pe) return { error: 'No encontré a «' + inp.persona + '» con un número de WhatsApp.' };
      var rwE = waEnviarAlguien_(pe.tel, String(inp.mensaje), { nombre: pe.nombre, de: (adm && adm.nombre) || 'Spacio AM' }), okE = !!rwE.ok;
      var idE = encargoCrear_(adm, pe.nombre, normTel_(pe.tel), String(inp.objetivo));
      try { contactoEncolar_(pe.tel, 'Encargo de ' + ((adm && adm.nombre) || 'un administrador') + ' con ' + pe.nombre + ': ' + String(inp.objetivo).slice(0, 800)); } catch (e) {}
      ctx.hechas.push({ tipo: 'encargo', resumen: 'Encargo · ' + pe.nombre + ' · ' + String(inp.objetivo).slice(0, 80), error: okE ? '' : (rwE.error || 'el WhatsApp no salió') });
      return { ok: okE, encargo: idE, persona: pe.nombre, nota: !okE ? 'Guardé el encargo pero el WhatsApp no salió: ' + (rwE.error || '') : rwE.modo === 'plantilla' ? 'No había escrito al número de ALMA en 24 h: se le envió el aviso de primer contacto (Meta confirma la entrega después); en cuanto responda le envío tu mensaje y sigo con el encargo.' : 'Mensaje enviado. Cuando llame, cumplo el objetivo y te mando el resumen por WhatsApp.' };
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
    case 'calcular_distancia': {
      var flD = leerTabla_(CFG.TAB_PROPIEDADES).map(function (r) { return r.property_name; }).filter(Boolean);
      var pD = flD.filter(function (x) { return n(x) === n(inp.propiedad); })[0] || bqMejor_(inp.propiedad, flD) || inp.propiedad;
      var rD = distanciaCalcular_(pD, inp.destino); return rD.error ? rD : Object.assign({ propiedad: pD, frase: distanciaFrase_(rD) }, rD);
    }
    case 'mensaje_personal': {
      var relP = !inp.numero && inp.persona ? personalPorNombre_(inp.persona) : null;
      var numP = normTel_(inp.numero || (relP && relP.wa) || '');
      if (!numP) return { error: 'Necesito el número de WhatsApp de ' + (inp.persona || 'esa persona') + ' (con código de país).' };
      var ctxP = inp.contexto_de && inp.contexto_de.length ? personalContextoDe_(inp.contexto_de) : '';
      var rp = personalEnviar_(adm, inp.persona || (relP && relP.nombre) || '', numP, String(inp.texto), inp.objetivo || '', ctxP, inp.proyecto || '');
      ctx.hechas.push({ tipo: 'mensaje', resumen: 'Personal · ' + (inp.persona || '+' + numP) + ' · ' + String(inp.texto).slice(0, 80), error: rp.ok ? '' : rp.error });
      return rp.ok ? { ok: true, nota: rp.modo === 'plantilla' ? 'No había escrito en 24 h: le llegó «Hola, soy Alma, la asistente de Juan. ¿Tienes un minuto?». En cuanto responda le envío el mensaje' + (inp.objetivo ? ', converso con ella hasta tener todo y te mando el resumen.' : ', y lo que conteste te llega.') : 'Mensaje entregado a WhatsApp. ' + (inp.objetivo ? 'Converso con ella hasta tener todo y te mando el resumen.' : 'Lo que conteste te llega.') } : { error: rp.error };
    }
    case 'programar_mensaje': {
      var pp = inp.numero ? null : (agPersona_(inp.persona || '', ctx) || (inp.persona ? personalPorNombre_(inp.persona) : null));
      var telP = normTel_(inp.numero || (pp && (pp.tel || pp.wa)) || '');
      if (!telP) return { error: 'No encontré el número de ' + (inp.persona || 'esa persona') + '. Pídeselo al administrador (con código de país).' };
      var rpg = progCrear_(adm, { persona: inp.persona || (pp && pp.nombre) || '', tel: telP, texto: inp.texto, cuando: inp.cuando, zona: inp.zona, tipo: inp.tipo });
      if (rpg.ok) ctx.hechas.push({ tipo: 'programado', resumen: 'Programado · ' + rpg.para + ' · ' + rpg.cuando });
      return rpg;
    }
    case 'mensajes_programados': return { programados: progLista_(adm, false) };
    case 'cancelar_programado': { var rc = progCancelar_(inp.id); if (rc.ok) ctx.hechas.push({ tipo: 'programado', resumen: 'Cancelado · ' + rc.cancelado }); return rc; }
    case 'proyectos_personales': return { proyectos: proyLista_() };
    case 'ver_proyecto': return proyVer_(inp.proyecto, !!inp.actualizar, adm && adm.nombre);
    case 'asignar_a_proyecto': { var rpA = personalPorNombre_(inp.persona || ''); if (!rpA) return { error: 'No encontré una conversación personal reciente con ' + inp.persona + '.' }; var ra = proyAsignar_(adm, rpA.wa, inp.proyecto, inp.objetivo || ''); if (ra.ok) ctx.hechas.push({ tipo: 'proyecto', resumen: 'Proyecto ' + ra.proyecto + ' · ' + ra.persona }); return ra; }
    case 'cerrar_proyecto': return proyCerrar_(inp.proyecto);
    case 'ver_conversacion_personal': { var cv = personalContextoDe_([inp.persona]); return cv ? { conversacion: cv } : { error: 'No encontré una conversación personal reciente con ' + inp.persona + '.' }; }
    case 'musica': { var mu = musica_(adm, inp); if (mu.ok && inp.accion === 'poner') ctx.hechas.push({ tipo: 'musica', resumen: 'Música · ' + (mu.sonando || '') + ' en ' + mu.en }); return mu; }
    case 'pedir_a_agente': { if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal trabaja con los agentes.' }; var ag = agente_(inp.agente); if (!ag) return { ok: false, error: 'No tengo ese agente. Tengo: ' + agentes_().map(function (a) { return a.id; }).join(', ') }; return agenteCorrer_(ag, 'pedido', String(inp.pedido || '')); }
    case 'leer_playbook': return leerPlaybookTool_(inp.nombre);
    case 'enviar_archivo': { if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal recibe archivos.' }; var rf = archivoEnviar_(adm, inp); if (rf.ok) ctx.hechas.push({ tipo: 'archivo', resumen: 'Archivo enviado por WhatsApp · ' + rf.enviado }); return rf; }
    case 'unir_cambio': { if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal une cambios.' }; var ru = unirCambio_(inp.cual); (ru.unidos || []).forEach(function (x) { ctx.hechas.push({ tipo: 'cambio', resumen: 'Unido ' + x.pr + ' · ' + String(x.titulo || '').slice(0, 60) }); }); return ru; }
    case 'ajustar_playbook': { if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal ajusta a los agentes.' }; var rp = agAjustarPlaybook_(inp.agente, inp.cambio, inp.campo); if (rp.ok) ctx.hechas.push({ tipo: 'agente', resumen: 'Playbook de ' + rp.agente + ' · ' + String(inp.cambio).slice(0, 60) }); return rp; }
    case 'propuestas_agentes': return { ok: true, propuestas: agPropuestas_() };
    case 'decidir_propuestas': {
      var P = agPropuestas_(), nums = String(inp.numeros || '').toLowerCase();
      var ids = /tod/.test(nums) ? 'todas' : nums.split(/[^0-9]+/).filter(String).map(function (k) { var p = P[Number(k) - 1]; return p ? p.id : ''; }).filter(String);
      var rd = agDecidir_(adm, ids, inp.aprobar !== false); if (rd.ok) ctx.hechas.push({ tipo: 'agente', resumen: (inp.aprobar !== false ? 'Aprobado' : 'Rechazado') + ' · ' + (rd.decididas || []).length + ' propuesta(s)' }); return rd;
    }
    case 'enviar_correo': {
      if (!esAdminPrincipal_(adm)) return { error: 'Solo Juan puede pedir que mande correos.' };
      var paraC = String(inp.para || '').trim();
      if (!/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(paraC)) return { error: 'Necesito un correo válido (p. ej. hola@spacioam.com).' };
      var rc = correoSimple_(paraC, inp.asunto, inp.texto);
      if (rc.ok) ctx.hechas.push({ tipo: 'correo', resumen: 'Correo a ' + paraC + ' · ' + String(inp.asunto || '').slice(0, 60) });
      return rc;
    }
    case 'guardar_familia': {
      if (!esAdminPrincipal_(adm)) return { error: 'Solo Juan puede decir quién es de su familia.' };
      var nomF = String(inp.nombre || '').trim(), numF = normTel_(inp.numero || '') || familiaNumero_(nomF);
      if (!nomF) return { error: 'Falta el nombre.' };
      if (!numF) return { error: 'No encuentro el WhatsApp de ' + nomF + '. Pídele a Juan el número con código de país.' };
      contactoGuardar_(numF, { nombre: nomF, tipo: 'familia', rol: inp.relacion || 'familia de Juan', origen: 'Juan' });
      ctx.hechas.push({ tipo: 'familia', resumen: nomF + ' guardada como familia (' + (inp.relacion || '') + ')' });
      return { ok: true, nombre: nomF, numero: numF, nota: 'Desde ahora Alma la reconoce cuando llama, la trata por su nombre y le ayuda con lo personal de Juan.' };
    }
    case 'mejora_para_claude': { var rm = paraClaudeCrear_(adm, inp); if (rm.ok) ctx.hechas.push({ tipo: 'mejora', resumen: 'Para Claude · ' + String(inp.titulo).slice(0, 80) }); return rm; }
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
  /* Modo Weebo con el administrador: sensibilidad según el tema (serio, normal o estratégico). */
  var weebo = ''; try { var corteW = Date.now() - 6 * 3600000; weebo = weeboBloque_({ contexto: 'admin', texto: texto, historial: previos.filter(function (m) { return m.de === 'yo' && new Date(m.ts).getTime() >= corteW; }).map(function (m) { return m.texto; }) }); } catch (e) {}
  var system = secretariaPrompt_() + weebo + '\n\nHOY: ' + hoy + ' (' + dia + ', hora de Guatemala).\nADMINISTRADOR: ' + adm.nombre + (adm.principal ? ' · administrador principal (acceso total)' : ' · administrador') +
    encargosTexto_(adm) + encargosPedidosTexto_(adm) + '\nCANAL: ' + (canal === 'whatsapp' ? 'WhatsApp' : canal === 'llamada' ? 'llamada de voz: tu respuesta se leerá en voz alta, así que responde en 1 a 3 frases cortas, sin listas, sin markdown, sin enlaces' : canal === 'segundo_plano' ? 'pedido que el administrador te hizo en una LLAMADA que ya terminó. Tu respuesta final le llega tal cual a él por WhatsApp. Si te pide que le mandes o envíes información a él, tu respuesta ES ese envío: escríbela completa y ordenada (líneas con ·), sin pedirle su número ni usar herramientas para escribirle. Si menciona imágenes o archivos que mandó un huésped, míralas con ver_imagenes antes de responder. Si algo no se pudo, dilo claro.' : 'Hub') + '\n\nNOTAS QUE TE PIDIÓ RECORDAR:\n' + (notas.join('\n') || '(ninguna)');
  /* Conversación: lo de las últimas 6 h es la conversación activa; lo anterior solo como contexto breve. */
  var corte = Date.now() - 6 * 3600000, msgs = [];
  /* Un solo chat por administrador: Hub, WhatsApp y llamadas (cada turno de voz es corto, por eso caben más). */
  previos.filter(function (m) { return new Date(m.ts).getTime() >= corte; }).slice(-24).forEach(function (m) {
    var rol = m.de === 'yo' ? 'user' : 'assistant', t = (m.canal === 'llamada' ? '[por llamada] ' : '') + (String(m.texto || '').slice(0, 2000) || '…');
    if (msgs.length && msgs[msgs.length - 1].role === rol) msgs[msgs.length - 1].content += '\n\n' + t; else msgs.push({ role: rol, content: t });
  });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  var contenido = (fotos || []).slice(0, 4).map(imgBloque_).filter(Boolean); contenido.push({ type: 'text', text: texto });
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.push({ role: 'assistant', content: '(continúo)' });
  msgs.push({ role: 'user', content: contenido });
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } };
  var tools = agHerramientas_().filter(function (t) { return (AGENTE_APP_ || AG_SOLO_APP_.indexOf(t.name) < 0) && (!AGENTE_PERMITIDAS_ || AGENTE_PERMITIDAS_.indexOf(t.name) >= 0); }), final = '';
  system += '\n\nTUS HERRAMIENTAS HOY: ' + tools.map(function (t) { return t.name; }).filter(Boolean).join(', ') + '.';
  system += audienciaBloque_(audienciaDe_({ adm: adm }));   // Juan: conversación personal · equipo: en nombre de la empresa (audiencia.js)
  return opAgenteBucle_(adm, system, msgs, tools, ctx, 0);
}
/* El bucle: Claude piensa, usa herramientas y vuelve a pensar (máx. 8 vueltas). Con AGENTE_PLAZO_ (la tolerancia de una
   llamada, retomar.js) se detiene entre pasos cuando se acaba el tiempo: guarda dónde iba y lo termina en segundo plano
   (devuelve { seguira: true }). seguir = true: retoma una conversación guardada (puede terminar en herramientas sin ejecutar). */
function opAgenteBucle_(adm, system, msgs, tools, ctx, desde, seguir) {
  var final = '', usosDe = function (m) { return m && m.role === 'assistant' && Array.isArray(m.content) ? m.content.filter(function (b) { return b.type === 'tool_use'; }) : []; };
  var vencido = function () { return AGENTE_PLAZO_ && Date.now() > AGENTE_PLAZO_; };
  var cortar = function () {
    var id = vozSeguirGuardar_({ email: adm.email, system: system, msgs: msgs, hechas: ctx.hechas, app: AGENTE_APP_, pedido: AGENTE_PEDIDO_ });
    return { respuesta: '', hechas: ctx.hechas, seguira: true, id: id };
  };
  if (seguir) {   // la llamada ya terminó: que lo sepa al pensar lo que falta
    var ul = msgs[msgs.length - 1];
    if (ul && ul.role === 'user' && Array.isArray(ul.content)) ul.content.push({ type: 'text', text: '(La llamada ya terminó: sigue y termina el pedido; tu respuesta final le llega por escrito.)' });
  }
  for (var vuelta = desde || 0; vuelta < 8; vuelta++) {
    var usos = usosDe(msgs[msgs.length - 1]);
    if (!usos.length) {
      if (vuelta > (desde || 0) && vencido()) return cortar();
      var j = claudeTools_(CFG.MODELO_REDACTOR, system, msgs, tools, 1600);
      if (!j) { final = 'No pude procesarlo ahora. Intenta de nuevo en un momento.'; break; }
      var bloques = j.content || [];
      msgs.push({ role: 'assistant', content: bloques });
      usos = bloques.filter(function (b) { return b.type === 'tool_use'; });
      if (j.stop_reason === 'pause_turn') continue;   // búsqueda web larga: el servidor pide continuar
      if (!usos.length || j.stop_reason !== 'tool_use') { final = bloques.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').trim(); break; }
      if (vencido()) return cortar();   // las herramientas se ejecutan en segundo plano
    }
    msgs.push({ role: 'user', content: usos.map(function (u) {
      var res; try { res = agEjecutar_(adm, u.name, u.input, ctx); } catch (e) { console.error('agEjecutar_ ' + u.name + ': ' + (e.stack || e)); res = { error: String(e.message || e).slice(0, 200) }; }
      if (res && res._imgs && res._imgs.length) {   // ver_imagenes: las fotos viajan como bloques de imagen
        var bl = res._imgs.map(imgBloque_).filter(Boolean); delete res._imgs;
        return { type: 'tool_result', tool_use_id: u.id, content: bl.concat([{ type: 'text', text: JSON.stringify(res).slice(0, 4000) }]) };
      }
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(res).slice(0, 12000), is_error: !!(res && res.error) };
    }) });
  }
  var respFinal = final || (ctx.hechas.length ? 'Listo.' : 'Entendido.');
  try { pendEncolar_(adm, texto, respFinal + (ctx.hechas.length ? '\n\nHecho: ' + ctx.hechas.map(function (h) { return (h.resumen || h.tipo) + (h.error ? ' (falló: ' + h.error + ')' : ''); }).join('; ') : ''), canal); } catch (e) {}   // a Pendientes (pendientes.js)
  return { respuesta: respFinal, hechas: ctx.hechas };
}

/* Foto liviana de Epi para el agente (Epi tarda 20-35 s en devolver su configuración completa de 1 MB).
   Se refresca sola cada 10 min desde procesarCola y se guarda en caché: técnicos, propiedades, tareas abiertas
   y la programación de ayer a +7 días. Si no hay foto, se lee en vivo una vez. */
function epiSnap_(forzar) {
  var c = CacheService.getScriptCache();
  if (!forzar) { try { var t = c.get('episnap'); if (t) { var sv = JSON.parse(t); if (sv && sv.props && sv.props.length && sv.vendors && sv.vendors.length) return sv; } } catch (e) {} }
  var cfg = epiCfg_();
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), ayer = sumarDias_(hoy, -21), fin = sumarDias_(hoy, 30);
  var snap = {
    ts: new Date().toISOString(),
    vendors: cfg.vendors.filter(function (v) { return v && v.active !== false; }).map(function (v) { return { id: v.id, email: v.email, name: vendNombre_(v), phone: v.phone || v.telefono || '', cat: String(v.categoria || v.category || '') }; }),
    props: cfg.props.map(function (p) { return { nombre: propNombre_(p) }; }).filter(function (p) { return p.nombre; }),
    tareas: cfg.tareas.filter(function (t) { return t && t.id && !t.hecha; }).slice(0, 80),
    schedules: cfg.schedules.filter(function (x) { var f = String(x && x.fecha || '').slice(0, 10); return f >= ayer && f <= fin; })
      .map(function (x) { return { id: x.id, fecha: x.fecha, hora: x.hora, tipo: x.tipo, propiedad: x.propiedad, vendorEmail: x.vendorEmail, vendorId: x.vendorId, vendorRaw: x.vendorRaw, estado: x.estado, orden: x.orden, entradaHoy: x.entradaHoy }; })
  };
  /* Un snapshot vacío (Epi tardó o falló) no se guarda: antes quedaba 25 min y ALMA decía que no existían propiedades, códigos ni técnicos. */
  if (snap.props.length && snap.vendors.length) { try { c.put('episnap', JSON.stringify(snap), 1500); } catch (e) { console.error('episnap: ' + e); } }
  return snap;
}
function epiSnapSiToca_() { var c = CacheService.getScriptCache(); if (c.get('episnap_t')) return; c.put('episnap_t', '1', 600); try { epiSnap_(true); } catch (e) { console.error('epiSnapSiToca_: ' + e); } }

/* Persona del equipo por nombre (administradores, técnicos de Epi, escalamiento). */
function agPersona_(nombre, ctx) {
  var personas = [];
  adminsOp_().forEach(function (a) { personas.push({ nombre: a.nombre, tel: a.tels[0] || '' }); });
  try { ctx.cfg().vendors.forEach(function (v) { personas.push({ nombre: vendNombre_(v), tel: String(v.phone || v.telefono || '') }); }); } catch (e) {}
  try { escalamiento_().forEach(function (p) { personas.push({ nombre: p.nombre, tel: p.telefono }); }); } catch (e) {}
  /* También las recepciones de los edificios (números que Hola tiene por propiedad) y los contactos con ficha
     (proveedores, técnicos, socios): así «escríbele a la recepción de Ignacio» o «a Liliana» no termina en pedir el número. */
  try { var rn = recepcionNumeros_(); Object.keys(rn).forEach(function (k) { if (rn[k] && rn[k].prop) personas.push({ nombre: 'Recepción ' + rn[k].prop, tel: rn[k].n }); }); } catch (e) {}
  try { contactosTodos_().forEach(function (o) { if (o.nombre && normTel_(o.tel)) personas.push({ nombre: o.nombre + (o.rol ? ' (' + o.rol + ')' : ''), tel: o.tel }); }); } catch (e) {}
  var m = opMatch_(nombre, personas.map(function (p) { return p.nombre; }));
  if (!m) { var b = bqMejor_(nombre, personas.map(function (p) { return p.nombre; })); if (b) m = b; }
  return personas.filter(function (x) { return x.nombre === m && normTel_(x.tel); })[0] || null;
}

/* ═══ ENCARGOS: conversaciones que un administrador le delega a ALMA («habla con Gabriel y explícale…»).
   ALMA le escribe a la persona pidiéndole que llame; cuando llama, el encargo entra en la ficha de la llamada y,
   al colgar, ALMA resume la conversación y se la envía a quien la pidió. ═══ */
var ENC_CAB_ = ['id', 'creado', 'solicitante', 'solicitante_tel', 'persona', 'tel', 'objetivo', 'estado', 'resumen', 'cerrado'];
function hojaEnc_() { return hojaCrear_('ALMA_ENCARGOS', ENC_CAB_); }
function encargoCrear_(adm, persona, tel, objetivo) {
  /* Si ya hay uno abierto del mismo administrador con la misma persona, se actualiza (seguimiento), no se duplica. */
  var ya = encargoAbierto_(tel);
  if (ya && String(ya.solicitante) === String(adm.email)) { hojaEnc_().getRange(ya.fila, 7).setValue((ya.objetivo + ' || SEGUIMIENTO ' + new Date().toISOString().slice(0, 16) + ': ' + objetivo).slice(-2000)); return ya.id; }
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
  /* Lo que el encargo dejaba para después de hablar (crear un reporte, una tarea, asignar a alguien) también se hace. */
  if (adm && adm.tels && adm.tels[0] && /(crea|crear|asign|reporte|tarea|program|agend)/i.test(e.objetivo)) { try { vozSecEncolar_(adm.tels[0], 'Terminé la llamada con ' + e.persona + '. Resumen:\n' + res + '\n\nAhora haz lo que falte del encargo (tareas, reportes, asignaciones). No vuelvas a contactar a ' + e.persona + '. Encargo: ' + e.objetivo); } catch (x) { console.error('encargo después: ' + x); } }
}

/* La persona a la que ALMA le escribió por encargo (escribir_a_equipo con al_responder) responde por WhatsApp.
   Antes su respuesta entraba a la bandeja general y el encargo se quedaba esperando para siempre. Ahora ALMA conversa
   con ella hasta cumplir el objetivo (como en los encargos personales) y, al terminar: cierra el encargo, le manda el
   resumen a quien lo pidió y hace en su nombre lo que dejó pedido para después (tarea, reporte, asignación…). */
function encargoEntrante_(wa, nombre, texto, ts, media, msgId, e) {
  try { hojaWA_().appendRow([ts, wa, nombre, 'in', String(texto).slice(0, 4000), msgId, 'wa:' + wa, 'text', 'encargo', (media || []).join(' ')]); } catch (x) {}
  var adm = adminPorEmail_(e.solicitante) || {}, quien = e.persona || nombre || ('+' + wa), de = adm.nombre || 'el equipo';
  try { inboxUpsert_('wa:' + wa, { huesped: quien, propiedad: 'WhatsApp · Encargo de ' + de, tipo: 'interno', canal: 'whatsapp', wa: wa, ultimo_canal: 'whatsapp', ultimo_texto: String(texto).slice(0, 300), ultimo_de: 'guest', ultimo_ts: ts, ultimo_guest_ts: ts }); } catch (x) {}
  /* «Cuando responda: …» (escribir_a_equipo) o, en un encargo de conversación (encargar_conversacion), lo que quede del objetivo después de hablar. */
  try { contactoEncolar_(wa, ''); } catch (x) {}
  if (esRespuestaAutomatica_(texto)) return;   // respuesta automática de su WhatsApp Business: se espera la de verdad
  var obj = String(e.objetivo || ''), despues = /Cuando responda:/.test(obj) ? (obj.split('Cuando responda:')[1] || '').trim() : obj.trim();
  var hist = []; try { hist = waHilo_('wa:' + wa).slice(-18).map(function (m) { return (m.tipo === 'guest' ? quien : 'ALMA') + ': ' + String(m.texto || '').replace(/^\[plantilla[^\]]*\]\s*·\s*pendiente:\s*/, '[aviso de primer contacto] ').slice(0, 700); }); } catch (x) {}
  var sys = 'Eres Alma, del equipo de Spacio AM (alojamientos boutique en Guatemala). Conversas por WhatsApp con ' + quien + ' por encargo de ' + de + '. ' +
    'Tono cálido, directo y breve, de tú, sin voseo ni «va», «dale» o «ahorita». Una o dos preguntas por mensaje, nunca un formulario. ' +
    'Si el mensaje completo acaba de salir y su respuesta es solo un saludo o un «sí, dime», no respondas (respuesta vacía): espera a que responda lo que se le pidió. ' +
    'No inventes datos ni tomes decisiones por ' + de + ': si pregunta algo que no sabes o que debe decidir él, dile que lo consultas y ponlo en para_admin. ' +
    'Cuando tengas lo que pide el objetivo (o la persona no puede o no quiere dar más), agradece, despídete en una línea y marca completo. ' +
    'Responde SOLO JSON: {"respuesta":"mensaje para ' + quien + ' (vacío si no hace falta responder)","para_admin":"pregunta o dato urgente para ' + de + ' (vacío si nada)","completo":true|false,"resumen":"si completo: todo lo que reuniste, ordenado en líneas con ·, listo para usar"}';
  sys += audienciaBloque_(audienciaDe_({ wa: wa }));   // socio o alguien del equipo: personal, en nombre de la empresa
  var usr = 'OBJETIVO DEL ENCARGO: ' + obj + '\n\nCONVERSACIÓN HASTA AHORA:\n' + hist.join('\n') + '\n\nÚLTIMO MENSAJE DE ' + quien + ': ' + texto;
  var out = {};
  try { var raw = String(claude_(CFG.MODELO_REDACTOR, 1200, sys, usr, 0.3) || ''); out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (x) { out = {}; }
  var avisar = function (t, res) { if (adm.email) { try { opGuardar_(adm, 'alma', 'whatsapp', t, [{ tipo: 'encargo', resumen: res }]); } catch (x) {} } if (pendAvisar_(adm, t, { origen: 'encargo', pedido: 'Encargo: ' + obj })) return; var d = normTel_(e.solicitante_tel) || (adm.tels || [])[0]; if (d) { try { waEnviar_(d, t); } catch (x) {} } };   // al principal le llega a Pendientes, no por WhatsApp
  if (!out || (out.respuesta == null && !out.completo)) { avisar(quien + ' respondió a tu encargo:\n\n' + texto + '\n\n(No pude seguir la conversación sola; dime qué le contesto.)', 'Respuesta de ' + quien); return; }
  if (String(out.respuesta || '').trim()) { var w = waEnviar_(wa, String(out.respuesta).trim()); if (w && w.ok) contactoRegistrar_(wa, quien, String(out.respuesta).trim()); }
  /* Si con este mensaje el encargo ya terminó, la pregunta va dentro del resumen final: un solo WhatsApp, no dos. */
  if (String(out.para_admin || '').trim() && !out.completo) avisar(quien + ' pregunta algo que debes decidir tú:\n\n' + String(out.para_admin).trim() + '\n\n(Dime qué le respondo.)', 'Consulta de ' + quien);
  if (!out.completo) return;
  var res = String(out.resumen || '').trim() || '(sin resumen)';
  /* Se cierran todos los encargos abiertos con esta persona del mismo administrador (los seguimientos repetidos). */
  try { var shE = hojaEnc_(), vE = shE.getRange(2, 1, shE.getLastRow() - 1, ENC_CAB_.length).getValues(), hoyE = new Date().toISOString();
    vE.forEach(function (r, i) { if (fin8_(r[5]) === fin8_(wa) && r[7] === 'abierto' && String(r[2]) === String(e.solicitante)) shE.getRange(i + 2, 8, 1, 3).setValues([['cumplido', res.slice(0, 4000), hoyE]]); }); } catch (x) {}
  avisar('Listo, hablé con ' + quien + '. Esto es lo que reuní:\n\n' + res + (String(out.para_admin || '').trim() ? '\n\nNecesito que decidas: ' + String(out.para_admin).trim() : '') + (despues ? '\n\nAhora hago lo que me pediste para después y te confirmo.' : ''), 'Encargo cumplido · ' + quien);
  /* Lo que pidió para cuando respondiera: lo hace la secretaria en su nombre (en segundo plano) y le confirma por WhatsApp. */
  if (despues && adm.tels && adm.tels[0]) { try { vozSecEncolar_(adm.tels[0], 'Terminé la conversación con ' + quien + ' (+' + normTel_(wa) + '). Esto es lo que reunió:\n' + res + '\n\nAhora haz lo que falte del encargo (lo que me pediste para después: tareas, reportes, asignaciones). No vuelvas a escribirle a ' + quien + '. Encargo: ' + despues); } catch (x) { console.error('encargo después: ' + x); } }
}

/* Encargos abiertos donde esta persona es a quien se le pidió algo (por sus teléfonos). */
function encargosDe_(tels) {
  var ks = (tels || []).map(fin8_).filter(Boolean); if (!ks.length) return [];
  var sh = hojaEnc_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ENC_CAB_.length).getValues().map(function (r, i) { return { fila: i + 2, id: String(r[0]), creado: r[1], solicitante: String(r[2]), solicitante_tel: String(r[3]), persona: String(r[4]), tel: String(r[5]), objetivo: String(r[6]), estado: String(r[7]) }; })
    .filter(function (e) { return e.estado === 'abierto' && ks.indexOf(fin8_(e.tel)) >= 0 && Date.now() - new Date(e.creado).getTime() < 7 * 86400000; });
}
/* Lo que este administrador le pidió a ALMA con otras personas y sigue abierto: para que un «¿en qué quedó…?» tenga respuesta. */
function encargosPedidos_(adm) {
  var sh = hojaEnc_(), n = sh.getLastRow(); if (n < 2 || !adm || !adm.email) return [];
  var pend = {}; try { pend = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_PEND') || '{}'); } catch (e) {}
  return sh.getRange(2, 1, n - 1, ENC_CAB_.length).getValues()
    .filter(function (r) { return String(r[2]) === adm.email && String(r[7]) === 'abierto' && Date.now() - new Date(r[1]).getTime() < 14 * 86400000; })
    .map(function (r) { var p = pend[fin8_(r[5])]; return { id: String(r[0]), creado: r[1], persona: String(r[4]), tel: String(r[5]), objetivo: String(r[6]), esperando: !!(p && p.length), desde: p && p.length ? p[0].ts : 0 }; });
}
function encargosPedidosTexto_(adm) {
  var l = []; try { l = encargosPedidos_(adm); } catch (e) {}
  var pend = {}; try { pend = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_PEND') || '{}'); } catch (e) {}
  var conEnc = l.map(function (e) { return fin8_(e.tel); });
  var sueltos = Object.keys(pend).filter(function (k) { return conEnc.indexOf(k) < 0 && pend[k] && pend[k].length; });
  if (!l.length && !sueltos.length) return '';
  var f = function (t) { try { return Utilities.formatDate(new Date(t), CFG.TZ, "d MMM HH:mm"); } catch (e) { return ''; } };
  var out = '\n\nLO QUE PEDISTE Y SIGUE ABIERTO (si pregunta «¿en qué quedó…?», «¿ya respondió…?» o pide seguimiento, la respuesta empieza aquí; para leer la conversación usa ver_conversacion con el número):';
  l.forEach(function (e) {
    out += '\n· [' + e.id + '] ' + e.persona + ' (+' + normTel_(e.tel) + '), pedido el ' + f(e.creado) + ': ' + e.objetivo.replace(/\s+/g, ' ').slice(0, 300) +
      (e.esperando ? '\n  ESTADO: se le envió el aviso de primer contacto el ' + f(e.desde) + ' y AÚN NO RESPONDE; el mensaje completo sale en cuanto responda. Nada de lo que depende de su respuesta se ha hecho todavía.' : '\n  ESTADO: ya tiene el mensaje completo; revisa con ver_conversacion si respondió.') +
      '\n  ENTREGA (Meta): ' + waEntregaTexto_(e.tel) + '. Nunca digas que «le llegó» o «ya lo tiene» si la entrega no dice ENTREGADO o LEÍDO.';
  });
  sueltos.forEach(function (k) { var m = pend[k][0]; out += '\n· ' + (m.nombre || 'Contacto') + ': primer contacto el ' + f(m.ts) + ', AÚN NO RESPONDE. Entrega (Meta): ' + waEntregaTexto_(k) + '. Mensaje guardado: «' + String(m.texto).slice(0, 200) + '»'; });
  return out + '\n· Para dar seguimiento a alguien que no responde, vuelve a usar escribir_a_equipo con su número y el mismo pedido (le llega de nuevo el aviso; el encargo no se duplica).';
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
    if (adm && (!quien || adm.email !== quien.email)) { try { opGuardar_(adm, 'alma', 'whatsapp', txt, [{ tipo: 'encargo', resumen: 'Encargo cumplido · ' + v[i][4] }]); } catch (e) {} if (pendAvisar_(adm, txt, { origen: 'encargo', pedido: 'Encargo: ' + v[i][4] })) return { ok: true }; var dest = normTel_(v[i][3]) || adm.tels[0]; if (dest) { try { waEnviar_(dest, txt); } catch (e) {} } }
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


/* Pulido de los mensajes que ALMA manda a un huésped por encargo del equipo.
   1) Por la plataforma (Airbnb, Booking, Hospitable) no se presenta la empresa (el huésped ya está en su reserva),
      pero Alma sí: «te escribimos de Spacio AM» o «soy Alma (de Spacio AM)» → «te saluda Alma».
   2) Si llega como un solo bloque, se parte en párrafos cortos: saludo en su línea, una idea por párrafo,
      preguntas y despedida aparte. Si el texto ya trae párrafos, se respeta. */
function pulirMsgHuesped_(texto, canal) {
  var t = String(texto || '').replace(/\r/g, '').trim();
  if (!t) return t;
  if (canal !== 'whatsapp') {
    /* Alma sí se presenta (los huéspedes no la conocen); lo que sobra es la empresa. */
    t = t.replace(/(?:te|les|le)\s+(?:escribimos|saludamos|contactamos)\s+(?:de(?:sde)?|del equipo de)\s+(?:el equipo de\s+)?Spacio\s*AM\b/gi, 'te saluda Alma')
         .replace(/\b(?:soy|habla|te escribe)\s+Alma\s*,?\s+(?:de|del equipo de)\s+Spacio\s*AM\b/gi, 'te saluda Alma')
         .replace(/\b(?:soy|te habla|habla|te escribe)\s+Alma\b/gi, 'te saluda Alma')
         .replace(/[,;]?\s*(?:somos|de parte de)\s+(?:el equipo de\s+)?Spacio\s*AM\b[^.!?\n]*/gi, '')
         .replace(/(te saluda Alma)(?:[.,]?\s*te saluda Alma\b)+/gi, '$1')
         .replace(/\s+([.,!?])/g, '$1').replace(/([.!?])\1+/g, '$1').replace(/^\s*[,.]\s*/, '');
  }
  if (/\n\s*\n/.test(t)) return t;
  t = t.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ');
  var frases = t.match(/[^.!?…]+(?:[.!?…]+|$)(?:\s*[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+)?/gu) || [t];
  frases = frases.map(function (f) { return f.trim(); }).filter(Boolean);
  if (frases.length < 3 && t.length < 180) return t;
  var parrafos = [];
  var saludo = /^(hola|buen[oa]s?\s+\w+|hi|hello|dear|estimad[oa])\b/i;
  if (saludo.test(frases[0]) && frases[0].length <= 60) {
    var sal = frases.shift();
    parrafos.push(sal.indexOf(',') < 0 ? sal.replace(/[.!]$/, ',') : sal);
  }
  var cierre = /^(cualquier (duda|cosa|consulta)|quedo|quedamos|gracias|saludos|un abrazo|feliz|que disfrut|any question|thank|best|kind regards|enjoy)/i;
  var actual = [];
  frases.forEach(function (f) {
    var esPregunta = /^[¿]/.test(f) || /\?$/.test(f);
    var esCierre = cierre.test(f);
    if (esPregunta || esCierre) {
      if (actual.length) { parrafos.push(actual.join(' ')); actual = []; }
      if (esCierre && parrafos.length && cierre.test(parrafos[parrafos.length - 1])) parrafos[parrafos.length - 1] += ' ' + f;
      else parrafos.push(f);
      return;
    }
    if (actual.length === 1 && (actual[0] + ' ' + f).length <= 170) { actual.push(f); parrafos.push(actual.join(' ')); actual = []; return; }
    if (actual.length) parrafos.push(actual.join(' '));
    actual = [f];
  });
  if (actual.length) parrafos.push(actual.join(' '));
  return parrafos.join('\n\n');
}

/* Un correo que Juan pidió mandar (enviar_correo): texto simple, desde hola@spacioam.com si el alias existe. Queda en ALMA_CORREOS. */
function correoSimple_(para, asunto, texto) {
  asunto = String(asunto || '').trim().slice(0, 150) || 'Mensaje de Alma'; texto = String(texto || '').trim();
  if (!texto) return { error: 'Falta el texto del correo.' };
  var o = { name: 'Alma' }, yo = Session.getEffectiveUser().getEmail(), desde = yo, estado = 'enviado';
  try { if (yo !== CFG.EMAIL_DESDE && GmailApp.getAliases().indexOf(CFG.EMAIL_DESDE) !== -1) { o.from = CFG.EMAIL_DESDE; desde = CFG.EMAIL_DESDE; } } catch (e) {}
  try { GmailApp.sendEmail(para, asunto, texto, o); } catch (e) { estado = 'error: ' + String(e).slice(0, 200); console.error('correoSimple_: ' + e); }
  try { hojaCrear_('ALMA_CORREOS', ['fecha', 'tipo', 'para', 'desde', 'asunto', 'propiedad', 'codigo', 'estado', 'texto', 'html']).appendRow([new Date().toISOString(), 'pedido de Juan', para, desde, asunto, '', '', estado, texto.slice(0, 4000), '']); } catch (e) {}
  return estado === 'enviado' ? { ok: true, enviado_a: para, desde: desde } : { error: 'No salió el correo: ' + estado };
}
