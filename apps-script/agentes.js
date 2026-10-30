/* ═══ EQUIPO DE AGENTES DETRÁS DE ALMA (versión ligera de Paperclip) ════════════════════════════════════════════
   Alma es la única que habla con las personas (Juan, el equipo, socios, huéspedes). Detrás de ella trabajan agentes,
   cada uno con su rol, su misión, sus horarios y su presupuesto:
     · Operaciones · Huéspedes y reseñas · Finanzas · Crecimiento · Marketing · Mantenimiento · Desarrollo (con Claude) · Archivo
   Cada uno:
     · Despierta en sus horas (el latido va en el disparador de cada hora, aprender() → agentesLatido_) o cuando Juan
       le pide algo por medio de Alma (pedir_a_agente).
     · Revisa con las herramientas de LECTURA de Alma (reservas, conversaciones, rutas, tareas, promesas…).
     · Lo que cambiaría algo afuera (un mensaje, una tarea, un dato) NO lo hace: queda como PROPUESTA. Alma se la pasa a
       Juan y solo se hace cuando él dice que sí (en la app, en agentes.html o diciéndoselo a Alma).
     · Al terminar deja un informe corto; si propone algo, Alma se lo cuenta a Juan en su conversación.
   Hojas: ALMA_AGENTES (quiénes son; misión, horas, días, presupuesto y estado se editan ahí), ALMA_AG_TAREAS (cada
   corrida) y ALMA_AG_PROPUESTAS (lo que esperan aprobación). */

/* PLAYBOOK de cada agente (lección «AI delegation»: un agente bueno no es otro agente cableado a los demás, es un
   playbook claro): misión (la meta), pasos (en orden), reglas (incluye las que Juan va agregando) y «listo significa»
   (la lista que el agente revisa antes de entregar: su prueba). Cuando algo sale mal no se corrige en el chat: Alma lo
   agrega a su playbook (ajustar_playbook) y queda para siempre. */
var AG_CAB_ = ['id', 'nombre', 'rol', 'mision', 'horas', 'dias', 'presupuesto_usd', 'estado', 'ultima', 'mes', 'gasto_mes', 'herramientas', 'tipo', 'app', 'pasos', 'reglas', 'listo', 'caja'];
var AGT_CAB_ = ['id', 'agente', 'creado', 'origen', 'pedido', 'estado', 'informe', 'propuestas', 'costo_usd', 'terminado'];
var AGP_CAB_ = ['id', 'tarea', 'agente', 'creado', 'titulo', 'porque', 'herramienta', 'entrada', 'estado', 'resultado', 'decidio', 'decidido'];

/* Lo que pueden mirar (lectura) y lo que solo pueden proponer (escritura). */
var AG_LECTURA_ = ['buscar_reservas', 'cancelaciones', 'programados_reserva', 'ver_conversacion', 'ruta_del_dia', 'tareas_abiertas',
  'promesas_abiertas', 'mensajes_programados', 'ver_propiedad', 'memoria_propiedad', 'buscar_contacto', 'grow_proyectos', 'ver_proyecto', 'calcular_distancia'];
var AG_PROPONE_ = ['enviar_a_huesped', 'escribir_a_equipo', 'crear_tarea', 'cerrar_tarea', 'agendar_en_epi', 'programar_mensaje', 'cancelar_programado',
  'marcar_resuelta', 'cambiar_dato_propiedad', 'recordar_en_propiedad', 'guardar_nota', 'grow_mover_etapa', 'grow_agendar_visita'];

var AGENTES_SEMILLA_ = [
  { id: 'operaciones', nombre: 'Operaciones', rol: 'Jefe de operaciones', horas: '7,13,18', dias: '1,2,3,4,5,6,7', presupuesto_usd: 15,
    herramientas: 'buscar_reservas,ruta_del_dia,tareas_abiertas,ver_propiedad,memoria_propiedad,ver_conversacion,crear_tarea,cerrar_tarea,agendar_en_epi,escribir_a_equipo,recordar_en_propiedad',
    mision: 'Que cada apartamento esté listo a tiempo. Revisa llegadas y salidas de hoy y mañana contra la ruta de Epi y las tareas abiertas: limpiezas que faltan o chocan, check-ins sin limpieza asignada, tareas viejas sin cerrar (las reparaciones las ve Mantenimiento). Propón crear o agendar lo que falte y avisar a quien corresponda.' },
  { id: 'huespedes', nombre: 'Huéspedes y reseñas', rol: 'Jefa de experiencia del huésped', horas: '8,16,21', dias: '1,2,3,4,5,6,7', presupuesto_usd: 15,
    herramientas: 'buscar_reservas,ver_conversacion,promesas_abiertas,programados_reserva,mensajes_programados,ver_propiedad,enviar_a_huesped,programar_mensaje,marcar_resuelta,escribir_a_equipo',
    mision: 'Que ningún huésped se quede sin respuesta ni con una promesa olvidada. Revisa las promesas abiertas, las conversaciones con pendientes, las llegadas de mañana (que tengan sus mensajes de llegada programados) y las salidas recientes (pedir reseña). Propón el mensaje exacto o el aviso al equipo.' },
  { id: 'finanzas', nombre: 'Finanzas', rol: 'Jefe de finanzas', horas: '9', dias: '1,2,3,4,5', presupuesto_usd: 10,
    herramientas: 'buscar_reservas,cancelaciones,ver_propiedad,buscar_contacto,crear_tarea,escribir_a_equipo,guardar_nota',
    mision: 'Que el dinero cuadre. Revisa las cancelaciones recientes (reembolsos pendientes o cargos por cancelación), reservas de la semana y pendientes con socios y proveedores (pagos o cobros mencionados en sus conversaciones). Propón tareas o avisos concretos; nunca muevas dinero.' },
  { id: 'crecimiento', nombre: 'Crecimiento', rol: 'Jefe de crecimiento y anuncios', horas: '10', dias: '1,4', presupuesto_usd: 10,
    herramientas: 'buscar_reservas,ver_propiedad,memoria_propiedad,grow_proyectos,ver_proyecto,cancelaciones,crear_tarea,guardar_nota,grow_mover_etapa,grow_agendar_visita',
    mision: 'Más ocupación y mejores anuncios. Busca propiedades con huecos en las próximas dos semanas, datos que faltan en las fichas (lo que el huésped pregunta seguido), y proyectos de Grow detenidos. Propón mejoras concretas (texto, dato, tarea, seguimiento a un proyecto).' },
  { id: 'marketing', nombre: 'Marketing', rol: 'Jefa de marketing y marca', horas: '11', dias: '2,5', presupuesto_usd: 10,
    herramientas: 'buscar_reservas,cancelaciones,ver_propiedad,memoria_propiedad,ver_conversacion,grow_proyectos,crear_tarea,guardar_nota,escribir_a_equipo',
    mision: 'Que más gente conozca y reserve Spacio AM directo. Busca fechas con poca ocupación en las próximas semanas para promover, lo que más elogian los huéspedes en sus conversaciones (para contenido y testimonios), y propiedades o temporadas que conviene destacar. Propón ideas concretas y listas para usar: un post para Instagram con su texto, una promoción con fechas y propiedades, una historia de un huésped (sin datos personales). Todo en el tono de Spacio AM: cálido, editorial, calma. Nunca publiques ni escribas a huéspedes por tu cuenta: propón tareas o notas.' },
  { id: 'mantenimiento', nombre: 'Mantenimiento', rol: 'Jefe de mantenimiento', horas: '8,15', dias: '1,2,3,4,5,6', presupuesto_usd: 10,
    herramientas: 'tareas_abiertas,ruta_del_dia,buscar_reservas,ver_conversacion,ver_propiedad,memoria_propiedad,buscar_contacto,crear_tarea,agendar_en_epi,escribir_a_equipo,recordar_en_propiedad',
    mision: 'Que nada esté roto cuando llegue un huésped. Busca reparaciones que reportaron los huéspedes o el equipo (aire acondicionado, agua caliente, cerraduras, WiFi, electrodomésticos), fallas que se repiten en una misma propiedad y mantenimiento preventivo vencido. Encuentra el mejor momento para el técnico (entre una salida y la siguiente llegada) y propón la tarea, la cita en Epi o el aviso al técnico o proveedor, con la propiedad y la falla exactas.' },
  /* El equipo técnico: no corre aquí sino con Claude (el desarrollador), por el mismo canal de los pedidos de mejora. En cada
     ronda revisa dos de las apps (rotan) y abre PRs con lo que corrige; Juan los une (ese es su «sí»). */
  { id: 'desarrollo', nombre: 'Desarrollo', rol: 'Jefe de Desarrollo: coordina los subdepartamentos y hace la retro', horas: '16', dias: '5', presupuesto_usd: 0, tipo: 'claude', herramientas: '',
    mision: 'Que todas las apps se vean y se sientan impecables en cualquier pantalla. Ronda de revisión de UI y UX: visibilidad en teléfonos chicos y grandes, iPad y computadora, textos cortados, contraste, botones que no se ven o son difíciles de tocar, animaciones que no se sienten bien, fallas de funciones y mejoras claras.' },
  /* Subdepartamentos de Desarrollo: uno por app, cada uno dueño de su app y de su playbook (playbooks/<app>.md en el
     Hub). No se hablan entre ellos: cada uno trabaja con Claude sobre su app y entrega PRs; Desarrollo coordina y hace la retro. */
  { id: 'dev_hub', nombre: 'Desarrollo · Hub', rol: 'Subdepartamento del Hub (hub.spacioam.com)', app: 'Hub', horas: '10', dias: '1', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que el Hub (bandeja, conversación, roca y su menú) funcione y se vea impecable en cualquier pantalla.' },
  { id: 'dev_api', nombre: 'Desarrollo · API', rol: 'Subdepartamento del Apps Script (la API de Alma y del Hub)', app: 'API', horas: '10', dias: '2', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que la API (Apps Script) responda rápido, sin errores y sin duplicar ni perder datos.' },
  { id: 'dev_app', nombre: 'Desarrollo · App de Alma', rol: 'Subdepartamento de la app de iPhone y sus páginas', app: 'Alma app', horas: '10', dias: '3', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que la app de Alma (inicio, roca, voz, anillo, correos, áreas) se sienta nativa, fluida y no se corte.' },
  { id: 'dev_hola', nombre: 'Desarrollo · Hola', rol: 'Subdepartamento de Hola (registro de huéspedes)', app: 'Hola', horas: '10', dias: '4', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que cada huésped complete su registro sin ayuda, en español o inglés, y llegue a recepción.' },
  { id: 'dev_epi', nombre: 'Desarrollo · Epi', rol: 'Subdepartamento de Epi (operación del equipo)', app: 'Epi', horas: '10', dias: '5', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que el equipo programe, vea su ruta y reporte con fotos sin fricción desde el teléfono.' },
  { id: 'dev_grow', nombre: 'Desarrollo · Grow', rol: 'Subdepartamento de Grow (proyectos y crecimiento)', app: 'Grow', horas: '10', dias: '6', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que cada proyecto avance por sus etapas y nada se quede detenido sin que se note.' },
  { id: 'dev_mi', nombre: 'Desarrollo · Mi', rol: 'Subdepartamento de Mi (finanzas y conta)', app: 'Mi', horas: '15', dias: '1', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que facturas, conta y reportes cuadren y se lean fácil.' },
  /* Equipo de mejora continua (mejora.js): cada miércoles busca cómo gastar menos sin quitar funciones ni bajar la calidad. */
  { id: 'mejora', nombre: 'Mejora continua', rol: 'Equipo de mejora continua: ahorra sin quitar funciones ni bajar la calidad', horas: '9', dias: '3', presupuesto_usd: 0, tipo: 'claude', herramientas: '',
    mision: 'Que Alma y el Hub cuesten menos cada semana (créditos de voz de ElevenLabs, modelo, lo que Alma relee en cada respuesta, la IA del Hub) sin que Juan note ningún cambio en cómo funcionan o suenan.' },
  { id: 'dev_docs', nombre: 'Desarrollo · Docs', rol: 'Subdepartamento de Docs (contratos y DPI)', app: 'Docs', horas: '15', dias: '4', presupuesto_usd: 0, tipo: 'claude', herramientas: '', mision: 'Que cada contrato salga completo y correcto, y la lectura del DPI no falle.' },
  /* El departamento de Archivo (archivista.js): solo ordena. No propone nada afuera; su trabajo se ve en las áreas y cajones. */
  { id: 'archivo', nombre: 'Archivo', rol: 'Departamento de archivo y orden', horas: '6,21', dias: '1,2,3,4,5,6,7', presupuesto_usd: 0, tipo: 'archivo', herramientas: '',
    mision: 'Que todo esté organizado: cada conversación, archivo y documento en su lugar. Clasifica lo nuevo, revisa con contexto lo que quedó sin clasificar, separa lo de procesos (se resuelve y termina) de lo permanente, y guarda aparte las ideas (proyectos en potencia), lo de interés y el ocio.' }
];

/* Pasos y «listo significa» de los que ya existían (se llenan solos donde la hoja está vacía). */
var AG_PLAYBOOK_ = {
  operaciones: { pasos: '1. Llegadas y salidas de hoy y mañana · 2. Contra la ruta de Epi y las tareas abiertas · 3. Lo que falta o choca · 4. Propuestas', listo: 'Cada llegada de hoy y mañana tiene limpieza asignada · ninguna tarea vieja sin dueño · cada propuesta dice propiedad, fecha y persona' },
  huespedes: { pasos: '1. Promesas abiertas · 2. Conversaciones con pendientes · 3. Llegadas de mañana con sus mensajes · 4. Salidas recientes para reseña', listo: 'Ninguna promesa vencida sin propuesta · cada mensaje propuesto tiene el texto final listo para enviar · sin datos personales en el informe' },
  finanzas: { pasos: '1. Cancelaciones recientes · 2. Reservas de la semana · 3. Pagos o cobros mencionados con socios y proveedores', listo: 'Cada monto con su moneda y su fuente · nada mueve dinero · cada propuesta dice a quién y por qué' },
  crecimiento: { pasos: '1. Huecos en las próximas dos semanas · 2. Datos que faltan en las fichas · 3. Proyectos de Grow detenidos', listo: 'Cada mejora dice la propiedad y el texto o dato exacto · nada inventado sobre la propiedad' },
  marketing: { pasos: '1. Fechas con poca ocupación · 2. Lo que más elogian los huéspedes · 3. Qué destacar · 4. Ideas listas para usar', listo: 'Cada idea trae su texto final en el tono de Spacio AM · sin datos personales de huéspedes · nada publicado por su cuenta' },
  mantenimiento: { pasos: '1. Fallas reportadas · 2. Fallas que se repiten por propiedad · 3. Preventivo vencido · 4. Ventana entre salida y llegada', listo: 'Cada propuesta dice propiedad, falla exacta, técnico o proveedor y el momento entre huéspedes' },
  archivo: { pasos: '1. Clasificar lo nuevo · 2. Revisar lo sin clasificar con contexto · 3. Tipo y guardado · 4. Archivos de Drive · 5. Avisar ideas', listo: 'Nada queda sin lugar · lo manual no se toca · cada idea nueva avisada una vez' },
  desarrollo: { pasos: '1. Coordina a los subdepartamentos (uno por app) · 2. Cada dos semanas, la retro: lo que se repitió se vuelve regla o check', listo: 'Cada regla nueva tiene su línea en ESTANDARES.md o su check · un solo PR por retro' }
};

/* La hoja de agentes: los que faltan de la semilla se agregan solos (lo que editaste en la hoja no se toca). */
function hojaAg_() {
  var sh = hojaCrear_('ALMA_AGENTES', AG_CAB_), n = sh.getLastRow();
  if (sh.getLastColumn() < AG_CAB_.length) sh.getRange(1, 1, 1, AG_CAB_.length).setValues([AG_CAB_]);   // columnas nuevas (tipo)
  var ya = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (v) { return String(v[0]); }) : [];
  AGENTES_SEMILLA_.forEach(function (a) { if (ya.indexOf(a.id) < 0) sh.appendRow(AG_CAB_.map(function (k) { var pb = AG_PLAYBOOK_[a.id] || {}; return a[k] != null ? a[k] : pb[k] != null ? pb[k] : k === 'estado' ? 'activo' : ''; })); });
  /* columnas nuevas del playbook: se llenan donde están vacías (lo que escribiste no se toca) */
  if (n >= 2) {
    var cols = ['app', 'pasos', 'listo'].map(function (k) { return AG_CAB_.indexOf(k); }), v = sh.getRange(2, 1, n - 1, AG_CAB_.length).getValues(), cambio = false;
    v.forEach(function (row) {
      var sem = AGENTES_SEMILLA_.filter(function (x) { return x.id === String(row[0]); })[0] || {}, pb = AG_PLAYBOOK_[String(row[0])] || {};
      cols.forEach(function (c) { var k = AG_CAB_[c], val = sem[k] != null ? sem[k] : pb[k]; if (!String(row[c]) && val) { row[c] = val; cambio = true; } });
      /* Desarrollo pasa a ser el jefe (los subdepartamentos revisan cada app): deja su horario viejo de rondas */
      if (row[0] === 'desarrollo' && String(row[4]) === '10' && String(row[5]) === '2,5') { row[2] = sem.rol; row[4] = sem.horas; row[5] = sem.dias; cambio = true; }
    });
    if (cambio) sh.getRange(2, 1, n - 1, AG_CAB_.length).setValues(v);
  }
  return sh;
}
function hojaAgT_() { return hojaCrear_('ALMA_AG_TAREAS', AGT_CAB_); }
function hojaAgP_() { return hojaCrear_('ALMA_AG_PROPUESTAS', AGP_CAB_); }
function agFilas_(sh, cab) {
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cab.length).getValues().map(function (v, i) { var o = { fila: i + 2 }; cab.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : String(v[j]); }); return o; });
}
function agGuardar_(sh, cab, o) {
  var fila = cab.map(function (k) { return o[k] != null ? (typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k]) : ''; });
  if (o.fila) sh.getRange(o.fila, 1, 1, cab.length).setValues([fila]); else { sh.appendRow(fila); o.fila = sh.getLastRow(); }
  return o;
}
function agentes_() { return agFilas_(hojaAg_(), AG_CAB_); }
function agente_(id) { id = String(id || '').toLowerCase(); return agentes_().filter(function (a) { return a.id === id || agNorm_(a.nombre) === agNorm_(id); })[0] || null; }
function agNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function agPrincipal_() { return adminsOp_().filter(function (a) { return a.principal; })[0] || adminsOp_()[0] || null; }

/* ── El latido: cada hora, despierta a quien le toca (su hora y su día, activo y con presupuesto) ── */
function agentesLatido_() {
  var ahora = ahora_(), h = Number(Utilities.formatDate(ahora, CFG.TZ, 'H')), dia = Number(Utilities.formatDate(ahora, CFG.TZ, 'u')), hoy = Utilities.formatDate(ahora, CFG.TZ, 'yyyy-MM-dd');
  if (PropertiesService.getScriptProperties().getProperty('AGENTES_ON') === '0') return;
  var corridos = 0;
  agentes_().forEach(function (a) {
    if (corridos >= 2 || a.estado !== 'activo') return;   // máximo 2 por latido (el disparador tiene 6 min)
    var horas = String(a.horas).split(/[,\s]+/).map(Number), dias = String(a.dias || '1,2,3,4,5,6,7').split(/[,\s]+/).map(Number);
    if (horas.indexOf(h) < 0 || dias.indexOf(dia) < 0) return;
    if (String(a.ultima).slice(0, 13) === Utilities.formatDate(ahora, CFG.TZ, "yyyy-MM-dd'T'HH")) return;   // ya corrió esta hora
    try { agenteCorrer_(a, 'rutina', ''); corridos++; } catch (e) { console.error('agente ' + a.id + ': ' + e); }
  });
}

/* ── Una corrida: revisa, propone y deja su informe ── */
function agenteCorrer_(a, origen, pedido) {
  var adm = agPrincipal_(); if (!adm) return { ok: false, error: 'sin administrador principal' };
  if (a.tipo === 'claude') return a.id === 'mejora' ? agMejoraRonda_(a, adm, origen, pedido) : agDesarrolloRonda_(a, adm, origen, pedido);   // mejora.js
  if (a.tipo === 'archivo') return archivoRonda_(a, adm, origen, pedido);
  var mes = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM');
  if (a.mes !== mes) { a.mes = mes; a.gasto_mes = 0; }
  if (Number(a.gasto_mes || 0) >= Number(a.presupuesto_usd || 0)) return { ok: false, error: a.nombre + ' ya usó su presupuesto del mes (US$' + a.presupuesto_usd + ').' };
  var permitidas = String(a.herramientas || '').split(/[,\s]+/).filter(String);
  var tools = agHerramientas_().filter(function (t) { return permitidas.indexOf(t.name) >= 0 && (AG_LECTURA_.indexOf(t.name) >= 0 || AG_PROPONE_.indexOf(t.name) >= 0); });
  var proponer = tools.filter(function (t) { return AG_PROPONE_.indexOf(t.name) >= 0; }).map(function (t) { return t.name; });
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, "yyyy-MM-dd (EEEE) HH:mm");
  var system = 'Eres el agente de ' + a.nombre + ' de Spacio AM (' + a.rol + '), alojamientos de estadía corta en Guatemala. Trabajas DETRÁS de Alma: ' +
    'no hablas con nadie; Alma es la única que habla con las personas y ella le pasa a Juan (el dueño) lo que tú encuentres.\n' +
    'TU MISIÓN: ' + a.mision + '\n\nCÓMO TRABAJAS\n' +
    '· Revisa con tus herramientas de lectura. Lo que devuelven es real; no inventes datos.\n' +
    '· Estas herramientas NO se ejecutan al usarlas: quedan como PROPUESTA para que Juan la apruebe: ' + proponer.join(', ') + '. Antes de cada una, escribe en una frase por qué (eso es lo que Juan lee). Usa los datos exactos (código de reserva, propiedad, texto final del mensaje).\n' +
    '· Propón solo lo que de verdad vale la pena: máximo 4 propuestas, sin repetir lo que ya está pendiente.\n' +
    '· Al final escribe tu INFORME para Alma: 2 a 5 líneas, claras y concretas (qué revisaste, qué encontraste, qué propones). Si todo está en orden, dilo en una línea.\n\n' +
    agPlaybookTexto_(a) +
    'HOY: ' + hoy + ' (hora de Guatemala).' + agPendientesTexto_(a.id);
  var msgs = [{ role: 'user', content: pedido ? 'PEDIDO DE JUAN (por medio de Alma): ' + pedido : 'Es tu hora de revisión (' + origen + '). Haz tu revisión.' }];
  var tarea = agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: new Date().toISOString(), origen: origen, pedido: pedido || '', estado: 'en_curso' });
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } };
  var costo = 0, final = '', props = [], porque = '';
  for (var v = 0; v < 8; v++) {
    var j = claudeTools_(CFG.MODELO_REDACTOR, system, msgs, tools, 1500);
    if (!j) { final = 'No pude terminar la revisión (sin respuesta del modelo).'; break; }
    try { costo += costoIA_(CFG.MODELO_REDACTOR, j.usage || {}); } catch (e) {}
    var bloques = j.content || []; msgs.push({ role: 'assistant', content: bloques });
    var usos = bloques.filter(function (b) { return b.type === 'tool_use'; });
    var textos = bloques.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim();
    if (!usos.length) { final = textos; break; }
    porque = textos || porque;
    var res = usos.map(function (u) {
      var out;
      if (proponer.indexOf(u.name) >= 0) {
        if (props.length >= 4) out = { ok: false, error: 'Ya tienes 4 propuestas en esta revisión.' };
        else {
          var p = agGuardar_(hojaAgP_(), AGP_CAB_, { id: 'agp' + Date.now() + props.length, tarea: tarea.id, agente: a.id, creado: new Date().toISOString(),
            titulo: agTitulo_(u.name, u.input), porque: String(porque || '').slice(0, 600), herramienta: u.name, entrada: u.input || {}, estado: 'pendiente' });
          props.push(p); out = { ok: true, propuesta: p.id, nota: 'Quedó como propuesta: Juan la aprueba o no. No la repitas.' };
        }
      } else {
        try { out = agEjecutar_(adm, u.name, u.input || {}, ctx); } catch (e) { out = { ok: false, error: String(e) }; }
      }
      var t = JSON.stringify(out == null ? {} : out); if (t.length > 6000) t = t.slice(0, 6000) + '…';
      return { type: 'tool_result', tool_use_id: u.id, content: t };
    });
    msgs.push({ role: 'user', content: res });
  }
  a.ultima = new Date().toISOString(); a.gasto_mes = Math.round((Number(a.gasto_mes || 0) + costo) * 10000) / 10000; agGuardar_(hojaAg_(), AG_CAB_, a);
  tarea.estado = 'hecha'; tarea.informe = String(final || '').slice(0, 3000); tarea.propuestas = props.map(function (p) { return p.id; }).join(','); tarea.costo_usd = Math.round(costo * 10000) / 10000; tarea.terminado = new Date().toISOString();
  agGuardar_(hojaAgT_(), AGT_CAB_, tarea);
  /* Alma es la que habla: si hay algo que aprobar (o si Juan lo pidió), se lo cuenta en su conversación */
  if (props.length || pedido) {
    var txt = 'Tu agente de ' + a.nombre + (pedido ? ' terminó lo que le pediste.' : ' hizo su revisión.') + '\n\n' + String(final || '').trim() +
      (props.length ? '\n\nPropone (espera tu sí):\n' + props.map(function (p, i) { return (i + 1) + '. ' + p.titulo; }).join('\n') + '\n\nDime «apruébalas», «solo la 1» o «no», o revísalas en Agentes.' : '');
    try { opGuardar_(adm, 'alma', 'hub', txt, [{ tipo: 'agente', resumen: a.nombre + (props.length ? ' · ' + props.length + ' propuesta(s)' : ' · informe') }]); } catch (e) {}
    try { pushA_([adm.email], 'Alma · ' + a.nombre, props.length ? props.length + ' propuesta(s) para tu aprobación' : 'Terminó lo que pediste'); } catch (e) {}
  }
  return { ok: true, agente: a.nombre, informe: final, propuestas: props.map(function (p) { return { id: p.id, titulo: p.titulo }; }), costo_usd: tarea.costo_usd };
}

/* Título corto y entendible de una propuesta (lo que Juan lee). */
function agTitulo_(h, inp) {
  inp = inp || {};
  var q = function (x) { return String(x || '').replace(/\s+/g, ' ').slice(0, 90); };
  var M = { enviar_a_huesped: 'Escribirle al huésped (' + q(inp.codigo) + '): «' + q(inp.texto) + '»',
    escribir_a_equipo: 'Escribirle a ' + q(inp.persona || inp.numero) + ': «' + q(inp.texto) + '»',
    crear_tarea: 'Crear tarea' + (inp.propiedad ? ' en ' + q(inp.propiedad) : '') + ': ' + q(inp.texto) + (inp.quien ? ' (para ' + q(inp.quien) + ')' : ''), cerrar_tarea: 'Cerrar la tarea ' + q(inp.id) + (inp.comentario ? ': ' + q(inp.comentario) : ''),
    agendar_en_epi: 'Agendar en Epi: ' + q(inp.trabajo) + ' · ' + q(inp.propiedad) + ' · ' + q(inp.fecha) + (inp.hora ? ' ' + q(inp.hora) : ''), programar_mensaje: 'Programar mensaje a ' + q(inp.persona || inp.numero) + ' (' + q(inp.cuando) + '): «' + q(inp.texto) + '»',
    cancelar_programado: 'Cancelar mensaje programado ' + q(inp.id), marcar_resuelta: 'Marcar como resuelta la conversación ' + q(inp.codigo),
    cambiar_dato_propiedad: 'Cambiar ' + q(inp.campo) + ' de ' + q(inp.propiedad) + ' a «' + q(inp.valor) + '»', recordar_en_propiedad: 'Recordar en ' + q(inp.propiedad) + ': ' + q(inp.dato),
    guardar_nota: 'Guardar nota: ' + q(inp.texto || inp.nota), grow_mover_etapa: 'Grow: mover el proyecto ' + q(inp.proyecto_id) + ' a ' + q(inp.etapa), grow_agendar_visita: 'Grow: agendar visita al proyecto ' + q(inp.proyecto_id) + ' · ' + q(inp.fecha) };
  return (M[h] || h + ' ' + q(JSON.stringify(inp))).replace(/\s+/g, ' ').trim();
}

/* Lo que ya espera aprobación (para no proponerlo dos veces). */
function agPendientesTexto_(id) {
  var L = agFilas_(hojaAgP_(), AGP_CAB_).filter(function (p) { return p.agente === id && p.estado === 'pendiente'; }).slice(-8);
  return L.length ? '\n\nYA PROPUSISTE Y ESPERA A JUAN (no lo repitas):\n' + L.map(function (p) { return '· ' + p.titulo; }).join('\n') : '';
}

/* ── Aprobar o no: se hace con el administrador principal (lo que el agente propuso, tal cual) ── */
function agDecidir_(adm, ids, aprobar) {
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal aprueba lo que proponen los agentes.' };
  var sh = hojaAgP_(), L = agFilas_(sh, AGP_CAB_), out = [];
  var lista = ids === 'todas' ? L.filter(function (p) { return p.estado === 'pendiente'; }) : L.filter(function (p) { return [].concat(ids).indexOf(p.id) >= 0 && p.estado === 'pendiente'; });
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } };
  lista.forEach(function (p) {
    p.decidio = adm.email; p.decidido = new Date().toISOString();
    if (!aprobar) { p.estado = 'rechazada'; agGuardar_(sh, AGP_CAB_, p); out.push({ id: p.id, titulo: p.titulo, estado: 'rechazada' }); return; }
    var inp = {}; try { inp = JSON.parse(p.entrada || '{}'); } catch (e) {}
    var r; try { r = agEjecutar_(adm, p.herramienta, inp, ctx); } catch (e) { r = { ok: false, error: String(e) }; }
    var ok = r && r.ok !== false && !r.error;
    p.estado = ok ? 'hecha' : 'error'; p.resultado = JSON.stringify(r || {}).slice(0, 800); agGuardar_(sh, AGP_CAB_, p);
    if (ok) { try { agCajaGuardar_(p, inp); } catch (e) {} }   // lo aprobado queda en su caja: la próxima vez lo reúsa
    out.push({ id: p.id, titulo: p.titulo, estado: p.estado, error: ok ? '' : (r && r.error) || 'no salió' });
  });
  return { ok: true, decididas: out };
}

/* ── Para Alma (herramientas de la secretaria) y para la página de agentes ── */
function agPropuestas_() {
  var A = {}; agentes_().forEach(function (a) { A[a.id] = a.nombre; });
  return agFilas_(hojaAgP_(), AGP_CAB_).filter(function (p) { return p.estado === 'pendiente'; })
    .map(function (p, i) { return { n: i + 1, id: p.id, agente: A[p.agente] || p.agente, titulo: p.titulo, porque: p.porque, creado: p.creado }; });
}
/* El playbook en el prompt: pasos en orden, reglas (las de Juan incluidas) y la prueba antes de entregar. */
function agPlaybookTexto_(a) {
  /* el playbook del departamento (playbooks/<id>.md) manda; la hoja guarda lo que el dueño agrega y lo que ya aprobó */
  var md = ''; try { md = playbookLeer_(a.app ? AG_DEV_PLAYBOOK_[a.app] : a.id); } catch (e) {}
  var caja = a.caja ? 'TU CAJA DE HERRAMIENTAS (lo que Juan ya aprobó: úsalo como plantilla y no lo rehagas): ' + a.caja + '\n' : '';
  if (md) return 'TU PLAYBOOK:\n' + md.replace(/^> .*\n/m, '').trim() + '\n' + (a.reglas ? 'REGLAS QUE TE DIO JUAN (cúmplelas siempre): ' + a.reglas + '\n' : '') + caja +
    'Antes de tu informe revisa tu «listo significa» punto por punto y termina con «Listo: ✓ …» o «Falta: ✗ …».\n\n';
  return caja + (a.pasos ? 'TUS PASOS (en orden): ' + a.pasos + '\n' : '') +
    (a.reglas ? 'REGLAS QUE TE DIO JUAN (cúmplelas siempre): ' + a.reglas + '\n' : '') +
    (a.listo ? 'LISTO SIGNIFICA (tu prueba): antes de tu informe revisa cada punto y termina el informe con una línea «Listo: ✓ …» o «Falta: ✗ …»: ' + a.listo + '\n' : '') + '\n';
}
/* «No parches el chat, arregla el playbook»: Alma agrega lo que Juan corrigió a las reglas (o pasos, o «listo significa»)
   del agente; queda para todas sus rondas siguientes. En los subdepartamentos, Claude lo pasa a playbooks/<app>.md. */
function agAjustarPlaybook_(id, cambio, campo) {
  var a = agente_(id); if (!a) return { ok: false, error: 'No tengo ese agente. Tengo: ' + agentes_().map(function (x) { return x.id; }).join(', ') };
  campo = ['reglas', 'pasos', 'listo'].indexOf(campo) >= 0 ? campo : 'reglas';
  cambio = String(cambio || '').replace(/\s+/g, ' ').trim().slice(0, 400); if (!cambio) return { ok: false, error: 'Falta qué cambiar.' };
  var f = Utilities.formatDate(ahora_(), CFG.TZ, 'd MMM');
  a[campo] = (a[campo] ? a[campo] + ' · ' : '') + cambio + ' (' + f + ')';
  agGuardar_(hojaAg_(), AG_CAB_, a);
  return { ok: true, agente: a.nombre, campo: campo, playbook: { pasos: a.pasos, reglas: a.reglas, listo: a.listo } };
}
/* La caja de herramientas: lo que Juan aprobó de un agente (las últimas 8), para reusarlo como plantilla. */
function agCajaGuardar_(p, inp) {
  var a = agente_(p.agente); if (!a) return;
  var muestra = String(inp.texto || inp.mensaje || inp.descripcion || inp.titulo || '').replace(/\s+/g, ' ').slice(0, 160);
  var item = Utilities.formatDate(ahora_(), CFG.TZ, 'd MMM') + ': ' + p.titulo + ' (' + p.herramienta + ')' + (muestra ? ' — «' + muestra + '»' : '');
  var L = String(a.caja || '').split(' ¦ ').filter(String); L.push(item);
  a.caja = L.slice(-8).join(' ¦ '); agGuardar_(hojaAg_(), AG_CAB_, a);
}
function agTablero_(ses) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Por ahora el equipo de agentes es solo del administrador principal.' };
  var T = agFilas_(hojaAgT_(), AGT_CAB_);
  return { ok: true, alma: 'Alma · habla con todos', agentes: agentes_().map(function (a) {
    var ult = T.filter(function (t) { return t.agente === a.id; }).slice(-1)[0] || null;
    return { id: a.id, tipo: a.tipo || '', app: a.app || '', pasos: a.pasos || '', reglas: a.reglas || '', listo: a.listo || '', caja: a.caja || '', nombre: a.nombre, rol: a.rol, mision: a.mision, horas: a.horas, dias: a.dias, estado: a.estado, presupuesto_usd: Number(a.presupuesto_usd || 0),
      gasto_mes: a.mes === Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM') ? Number(a.gasto_mes || 0) : 0, ultima: a.ultima, informe: ult ? ult.informe : '' };
  }), propuestas: agPropuestas_() };
}
function agAccion_(ses, b) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'solo admin principal' };
  if (b.decidir) return agDecidir_(adm, b.decidir.ids, !!b.decidir.aprobar);
  if (b.correr) { var a = agente_(b.correr); return a ? agenteCorrer_(a, 'a mano', String(b.pedido || '')) : { ok: false, error: 'no existe ese agente' }; }
  if (b.estado && b.agente) { var g = agente_(b.agente); if (!g) return { ok: false, error: 'no existe' }; g.estado = b.estado === 'pausado' ? 'pausado' : 'activo'; agGuardar_(hojaAg_(), AG_CAB_, g); return { ok: true }; }
  return agTablero_(ses);
}

/* ── Desarrollo: la ronda de revisión la hace Claude (Claude Code, con los repos, Playwright y los skills de diseño) ── */
var AG_DEV_OBJETIVOS_ = [
  { app: 'Hub', que: 'hub.spacioam.com (repo Hub-Spacioam): index.html, la bandeja, la conversación completa y su botón encajado, js/sa-nav.js (el botón roca, su menú y sus hints)' },
  { app: 'API', que: 'el Apps Script (apps-script/ en Hub-Spacioam): la API del Hub y de Alma, sus disparadores, hojas y tiempos de respuesta' },
  { app: 'Alma app', que: 'la app de Alma: alma/inicio.html (esferas de áreas, piedra, chat, pendientes), alma/agentes.html, alma/roca.html y, en el repo alma-app, las pantallas SwiftUI (navegador, barra abajo, Health, llamada)' },
  { app: 'Hola', que: 'hola.spacioam.com (repo hola-spacioam): el formulario de registro del huésped paso a paso y su resumen, en español e inglés' },
  { app: 'Epi', que: 'epi.spacioam.com (repo Epi-spacioam): programación, rutas del día, reportes con fotos y tareas' },
  { app: 'Grow', que: 'grow.spacioam.com (repo Grow-spacioam): proyectos, etapas y visitas' },
  { app: 'Mi', que: 'mi.spacioam.com (repo mi-spacioam): facturas, conta y reportes' },
  { app: 'Docs', que: 'docs.spacioam.com (repo Docs-spacioam): contratos y lectura de DPI' }
];
function agDesarrolloRetro_(a, adm, origen) {
  var que = [
    'Eres el equipo de Desarrollo de Spacio AM. Esta ronda es una RETRO (' + origen + '): no revises apps; mira hacia atrás y convierte lo que se repite en reglas.',
    '', 'QUÉ MIRAS (últimas 3 semanas, en jforce15-coder/Hub-Spacioam y jforce15-coder/alma-app):',
    '· Los PRs unidos y cerrados: qué se arregló dos veces, qué se rompió después de unir, qué pidió Juan corregir.',
    '· Los avisos con etiqueta bots-prueba y alma-mejora, y los comentarios de las revisiones.',
    '', 'QUÉ HACES (un solo PR, siguiendo CLAUDE.md):',
    '1. Por cada error que se repite: una línea en ESTANDARES.md. Si una máquina lo puede detectar, un check nuevo en .github/workflows/estandares.yml (prúebalo: que falle con el error y pase sin él).',
    '2. Palabras que se usaron con dos significados: corrígelas en docs/GLOSARIO.md.',
    '3. Si algo del método en CLAUDE.md no sirvió o faltó, ajústalo.',
    '4. Descarta lo que sería un falso positivo; no agregues reglas por si acaso.',
    '5. En tu respuesta a Alma: 3 a 5 líneas con lo que aprendimos y el enlace al PR.'
  ].join('\n');
  var r = paraClaudeCrear_(adm, { titulo: 'Retro de Desarrollo: lo que se repite se vuelve regla', app: 'Hub', tipo: 'mejora', prioridad: 'normal', que_quiere: que });
  a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
  agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: a.ultima, origen: origen, pedido: 'retro', estado: r.ok ? 'con Claude' : 'error',
    informe: r.ok ? 'Retro enviada a Claude: convierte lo que se repitió en estándares, glosario y checks.' : 'No se pudo enviar: ' + (r.error || ''), costo_usd: 0, terminado: a.ultima });
  return { ok: !!r.ok, agente: a.nombre, informe: r.ok ? 'Le pasé la retro a Claude. Te cuento qué reglas nuevas salen.' : r.error, propuestas: [], costo_usd: 0 };
}
/* Una ronda de Desarrollo. Cada subdepartamento revisa SU app con SU playbook (playbooks/<app>.md + las reglas que Juan
   agregó en la hoja); el jefe de Desarrollo, en su horario, hace la retro cada dos semanas, y por pedido de Juan hace lo
   que él diga. */
var AG_DEV_PLAYBOOK_ = { 'Hub': 'hub', 'API': 'api', 'Alma app': 'app-alma', 'Hola': 'hola', 'Epi': 'epi', 'Grow': 'grow', 'Mi': 'mi', 'Docs': 'docs' };
function agDesarrolloRonda_(a, adm, origen, pedido) {
  var p = PropertiesService.getScriptProperties();
  if (!a.app && !pedido) {   // el jefe: retro una semana sí y otra no
    var nR = Number(p.getProperty('AG_DEV_RETRO') || 0) + 1; p.setProperty('AG_DEV_RETRO', String(nR));
    if (nR % 2 === 0) return agDesarrolloRetro_(a, adm, origen);
    a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
    return { ok: true, agente: a.nombre, informe: 'Esta semana no toca retro; los subdepartamentos revisan cada uno su app.', propuestas: [], costo_usd: 0 };
  }
  var obj = a.app ? AG_DEV_OBJETIVOS_.filter(function (o) { return o.app === a.app; })[0] || { app: a.app, que: a.mision } : null;
  var pb = obj ? AG_DEV_PLAYBOOK_[obj.app] : '';
  var donde = obj ? obj.app : 'lo que pidió Juan';
  var que = [
    'Eres ' + (obj ? 'el subdepartamento ' + a.nombre + ' de Spacio AM: dueño de ' + obj.app + ' y de nada más' : 'el equipo de Desarrollo de Spacio AM') + ', uno de los agentes que trabajan detrás de Alma. ' + (pedido ? 'Pedido de Juan.' : 'Tu ronda de revisión (' + origen + ').'),
    '', pedido ? 'QUÉ PIDIÓ JUAN: ' + pedido : 'TU APP: ' + obj.app + ': ' + obj.que + (a.mision ? '\nTU META: ' + a.mision : ''),
    pb ? '\nTU PLAYBOOK: lee playbooks/' + pb + '.md en jforce15-coder/Hub-Spacioam (meta, pasos, reglas, caja de herramientas y «listo significa») y síguelo en orden.' : '',
    a.reglas ? 'REGLAS NUEVAS QUE JUAN DIO (cúmplelas y, en el mismo PR, pásalas a tu playbook): ' + a.reglas : '',
    '', 'CÓMO (además de CLAUDE.md)',
    '1. Ábrelo de verdad: sírvelo localmente y míralo con Playwright en iPhone SE (375×667), iPhone 15 (390×844), iPhone Pro Max (430×932), iPad (820×1180) y computadora (1280×800). Donde haga falta sesión, usa datos de prueba, nunca datos reales de huéspedes.',
    '2. Revisa con los skills de diseño: web-design-guidelines, apple-design, emil-design-eng, improve-animations y find-animation-opportunities, design-taste-frontend; para la app, ios-liquid-glass y write-swift. Respeta el sistema de diseño (ds/).',
    '3. Busca: textos cortados o que se salen, contraste bajo, botones que no se ven o miden menos de 44 px, cosas tapadas por la barra o el teclado, áreas seguras, cargas sin transición, animaciones bruscas, funciones que fallan y textos confusos.',
    '3b. No corras los bots de prueba antes del PR: corren solos después de que Juan une. Mira su último aviso (etiqueta bots-prueba) por si dejaron algo de tu app.',
    '4. Arregla lo claro y pequeño en UN PR de tu app, con evidencia antes y después. No toques otras apps: si encuentras algo de otra, anótalo para su subdepartamento.',
    '5. Antes de responder, revisa el «listo significa» de tu playbook punto por punto. En tu respuesta a Alma: resumen corto con el enlace al PR, la línea «Listo: ✓ …» o «Falta: ✗ …», y lo que encontraste y no tocaste, de mayor a menor importancia.'
  ].filter(String).join('\n');
  var r = paraClaudeCrear_(adm, { titulo: (obj ? a.nombre + ' · ronda' : 'Desarrollo · ' + String(pedido).slice(0, 60)), app: obj ? obj.app : 'Otro', tipo: 'mejora', prioridad: 'normal', que_quiere: que });
  a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
  agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: a.ultima, origen: origen, pedido: pedido || '', estado: r.ok ? 'con Claude' : 'error',
    informe: r.ok ? 'Ronda enviada a Claude: ' + donde + '. Cuando termine, Alma te cuenta en la conversación Desarrollo y su PR aparece en Pendientes.' : 'No se pudo enviar: ' + (r.error || ''), costo_usd: 0, terminado: a.ultima });
  return { ok: !!r.ok, agente: a.nombre, informe: r.ok ? 'Le pasé la ronda a Claude (' + donde + '). Te cuento cuando termine.' : r.error, propuestas: [], costo_usd: 0 };
}
