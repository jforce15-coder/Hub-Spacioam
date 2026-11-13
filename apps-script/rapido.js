/* ═══ CAMINO RÁPIDO DE LA VOZ: el modelo rápido contesta los pedidos de leer (#498 T4) ═══════════════════════════════
   Decisión de Juan (12-nov-2026): «usemos el modelo más rápido para temas específicos y reducir nuestro tiempo actual
   mientras pedimos acceso». Medido en T1: la secretaria tarda de 8 a 26 s, casi todo en 2 o 3 vueltas del modelo de
   siempre (3 a 8 s cada una). En una llamada (herramienta secretaria, vozSecretaria_) un pedido de LEER (reservas, fechas,
   mensajes, pendientes) lo contesta primero el modelo rápido (VOZ_RAPIDO_MODELO_) con SOLO herramientas de lectura
   (VOZ_RAPIDO_HERR_). Todo lo demás sigue con el modelo de siempre (CFG.MODELO_REDACTOR), igual que hoy.
   · Quién va por el rápido: rapidoDecide_, el ÚNICO lugar donde se decide (desde T5 lo decide Jev, abajo; estas reglas
     quedan de red de seguridad y de respaldo). Por reglas va si: el interruptor está encendido, es una llamada de la
     secretaria (no la familia, sin fotos, sin una receta a medias), el pedido es corto, pregunta algo (qué, quién, cuándo, verifica, revisa, busca, «?») y NO pide hacer nada (VOZ_RAPIDO_HACER_: enviar,
     escribir, programar, crear, cancelar, cambiar, guardar, unir, llamar…). En la duda, el de siempre.
   · Si el rápido no puede, el turno vuelve a empezar con el modelo de siempre, desde el mismo pedido y sin lo que el rápido
     leyó (leer otra vez no cambia nada): pidió pasar_al_completo, pidió una herramienta que no tiene, dijo que no sabe o no
     puede (escalarNoPudo_), dijo que algo quedó hecho (no tiene cómo hacerlo), falló la API, se negó, se le acabaron los
     tokens, pasó de VOZ_RAPIDO_VUELTAS_ vueltas o de VOZ_RAPIDO_MS_. Juan no lo nota: solo tarda lo de antes.
   · Mismo system: lo que Alma sabe y cómo habla no cambia. Al final de este_turno, una línea le dice qué herramientas tiene.
   · El modelo rápido no acepta temperatura (400): va sin ella y con esfuerzo bajo (output_config.effort = low).
   · Para medir después de unir: el cronómetro (VOZ_MS_ en voz_traza) guarda via (rapido · completo · rapido>completo),
     motivo, modelo (el que contestó) y rapido (ms en el camino rápido); IA_USO guarda el modelo de cada llamada, con la
     función «Voz · camino rápido» o «Voz · completo tras el rápido» (claudeTools_).
   · Propiedades del script: VOZ_RAPIDO = 0 lo apaga sin un PR; VOZ_RAPIDO_MODELO cambia el modelo rápido. */

/* ═══ EL PORTERO JEV: decide en ~0,2 s si el pedido es de leer o de hacer (#498 T5) ═══════════════════════════════════
   Jev (TypeSafe AI) es un modelo de decisiones: recibe el pedido y una pregunta de opciones, y contesta solo la opción.
   · Con la llave JEV_KEY (Ajustes → Llaves, llaves.js) y VOZ_JEV distinto de '0', rapidoDecide_ le pregunta «camino»:
     leer · hacer · otro. Va al rápido solo si dice leer con confianza ≥ JEV_UMBRAL_ Y el pedido no trae un verbo de hacer
     (VOZ_RAPIDO_HACER_): las reglas siguen como red de seguridad y, si dicen hacer, gana hacer sin preguntarle a Jev.
   · A Jev va solo el pedido (máx. JEV_MAX_LARGO_ letras), sin teléfonos ni correos (jevLimpiar_).
   · Si Jev falla (sin llave, error HTTP, respuesta rara o tarda más de JEV_MS_MAX_), deciden las reglas de siempre.
     UrlFetch no deja poner tiempo máximo: si tarda de más o falla JEV_FALLOS_MAX_ veces seguidas, se apaga solo
     JEV_PAUSA_S_ segundos (CacheService) para no sumar espera a las llamadas.
   · El cronómetro de la voz guarda portero (jev · reglas), jev_conf, jev_ms y jev_error; IA_USO una fila «Voz · portero
     Jev» con sus tokens (precio estimado en precioIA_).
   · El formato de la API viene de ejemplos públicos (jev-samples); el primer uso real lo confirma.
   · Propiedades del script: VOZ_JEV = 0 lo apaga sin un PR; JEV_MODELO cambia el modelo (por defecto JEV_MODELO_). */
var JEV_URL_ = 'https://api.typesafe.ai/v1/systemone', JEV_MODELO_ = 'jev-1.13.0';
var JEV_UMBRAL_ = 0.8, JEV_MS_MAX_ = 1500, JEV_FALLOS_MAX_ = 3, JEV_PAUSA_S_ = 600, JEV_MAX_LARGO_ = 600;
var JEV_PREGUNTA_ = { camino: { type: 'choice',
  instructions: 'Qué pide la persona a su asistente en este pedido por voz',
  criteria: {
    leer: 'Solo consultar datos, sin cambiar nada: reservas, fechas, quién llega o sale, mensajes, pendientes, tareas, propiedades, códigos, agenda',
    hacer: 'Pide una acción: enviar, escribir, programar, cambiar, crear, cancelar, avisar, guardar, llamar, unir o cualquier otra cosa que cambie algo',
    otro: 'No es claro qué pide, es un saludo o es charla'
  } } };

var VOZ_RAPIDO_MODELO_ = 'claude-haiku-5-5';
/* Solo herramientas de leer (ninguna envía, programa, une ni escribe en hojas por pedido del modelo). Cada una pasa por
   agEjecutar_, que revisa el rol igual que siempre (códigos y agenda solo del principal). */
var VOZ_RAPIDO_HERR_ = ['buscar_reservas', 'cancelaciones', 'programados_reserva', 'ver_conversacion', 'ver_agenda', 'ruta_del_dia',
  'tareas_abiertas', 'promesas_abiertas', 'mensajes_programados', 'propuestas_agentes', 'vigilancias', 'ver_propiedad', 'codigo_acceso',
  'memoria_propiedad'];
var VOZ_RAPIDO_MS_ = 9000, VOZ_RAPIDO_VUELTAS_ = 3, VOZ_RAPIDO_MAX_LARGO_ = 300;
/* Pedir hacer algo: la raíz de un verbo de hacer con su terminación (envía, mándale, programar, cancélalo, avisé…).
   «agenda», «pregunta» y «reserva» no están: también son sustantivos de leer («¿qué tengo en la agenda?»). Un nombre que
   se parece («Marcela») manda el pedido al de siempre: en la duda, el de siempre. */
var VOZ_RAPIDO_HACER_ = '(?:envi|mand|escrib|contest|respond|reenvi|avis|program|cancel|borr|elimin|quit|olvid|cambi|actualiz|' +
  'corrig|correg|guard|anot|apunt|recuerd|record|aprueb|aprob|marc|asign|encarg|llam|apag|enciend|prend|paus|vigil|cobr|compart|prepar|ajust|' +
  'mejor|agreg|anad|bloque|desbloque)';
var VOZ_RAPIDO_HACER_RE_ = new RegExp('\\b' + VOZ_RAPIDO_HACER_ + '(?:a|e|o|as|es|ar|er|ir|ale|ales|ele|eles|alo|ala|ame|elo|ela|eme|' +
  'arle|erle|irle|arlo|erlo|irlo|aselo|eselo|ate|ete|ite|amos|emos|aron|ieron)\\b');
/* Los imperativos cortos, los que cambian la raíz y los que también son sustantivos («agenda», «pregunta»), tal cual. */
var VOZ_RAPIDO_HACER_EXTRA_RE_ = /\b(?:dile|diles|decirle|decirles|haz|hazme|hazlo|pon|ponle|ponme|poner|une|unelo|unir|abre|abrele|abrir|cierra|cierrala|cerrar|mueve|muevela|mover|crea|crear|creale|pide|pidele|pedir|pedirle|sube|subir|paga|pagar|deja|dejale|dejar|recuerdame|ten en cuenta|agendar|agendale|agendalo|agendala|agendame|preguntale|preguntales|preguntarle|preguntarles)\b/;
/* Pregunta o pide leer. */
var VOZ_RAPIDO_LEER_RE_ = /\?|\b(?:que|quien|quienes|cuando|cuanto|cuantos|cuantas|cual|cuales|donde|como|hay|tiene|tienen|tengo|llega|llegan|llego|sale|salen|salio|verifica|verificar|revisa|revisar|busca|buscar|consulta|consultar|dime|dame|ver|checa|checar|confirma|confirmar|sabes|muestrame|lee|leeme|leer|esta|estan)\b/;
/* Dice que hizo algo: el rápido no tiene cómo, así que no se le cree. */
var VOZ_RAPIDO_HECHO_RE_ = /\b(?:listo|ya esta hecho|ya (?:lo |la |le |les )?(?:envie|mande|escribi|programe|agende|cree|cancele|cambie|guarde|anote|avise|uni|marque)|(?:quedo|queda|quedaron) (?:enviad|programad|agendad|cread|cancelad|guardad|anotad|cambiad|marcad|unid|listo))/;
/* Dice que no sabe o no está segura (además de escalarNoPudo_: no tiene cómo, lo pedirá, ofrece pedirlo). */
var VOZ_RAPIDO_NO_SABE_RE_ = /\bno (?:lo |la )?se\b|\bno estoy segura\b|\bno tengo (?:esa|ese) (?:informacion|dato)\b|\bno (?:tengo|cuento con) (?:acceso|herramienta)/;
/* El turno en curso es una llamada de la secretaria (vozSecretaria_ lo enciende y lo apaga en su finally). */
var AGENTE_RAPIDO_ = false;
/* La función con que claudeTools_ registra en IA_USO, si no la manda quien llama (el de siempre tras el rápido). */
var AG_USO_FUNCION_ = '';
var RAPIDO_PASAR_ = { name: 'pasar_al_completo', description: 'Pasa este pedido al modelo completo, que tiene todas las herramientas. Úsala en vez de responder si el pedido pide hacer algo (enviar, escribir, programar, crear, cambiar, cancelar, guardar, unir), si necesitas una herramienta que no tienes o si no puedes contestarlo con seguridad con lo que leíste.',
  input_schema: { type: 'object', properties: { motivo: { type: 'string', description: 'Por qué, en pocas palabras' } }, required: [] } };

function rapidoOn_() { return String(PropertiesService.getScriptProperties().getProperty('VOZ_RAPIDO') || '1') !== '0'; }
function rapidoModelo_() { return String(PropertiesService.getScriptProperties().getProperty('VOZ_RAPIDO_MODELO') || '').trim() || VOZ_RAPIDO_MODELO_; }
function rapidoNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9?\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

/* ¿Este pedido va por el modelo rápido? → { usar, motivo }. o: { fotos, hechas, nombrada } del turno. El único lugar. */
function rapidoDecide_(texto, o) {
  o = o || {};
  if (!AGENTE_RAPIDO_) return { usar: false, motivo: 'no es la secretaria por voz' };
  if (!rapidoOn_()) return { usar: false, motivo: 'apagado (VOZ_RAPIDO = 0)' };
  if (AGENTE_PERMITIDAS_) return { usar: false, motivo: 'herramientas limitadas' };
  if (o.fotos) return { usar: false, motivo: 'trae fotos' };
  if (o.hechas) return { usar: false, motivo: 'una receta quedó a medias' };
  if (o.nombrada) return { usar: false, motivo: 'enseña un atajo' };
  var t = rapidoNorm_(texto);
  if (!t) return { usar: false, motivo: 'sin pedido' };
  if (t.length > VOZ_RAPIDO_MAX_LARGO_) return { usar: false, motivo: 'pedido largo' };
  var hacer = t.match(VOZ_RAPIDO_HACER_RE_) || t.match(VOZ_RAPIDO_HACER_EXTRA_RE_);
  if (hacer) return { usar: false, motivo: 'pide hacer algo («' + hacer[0] + '»)', portero: 'reglas' };   // la red de seguridad: gana hacer
  var j = jevPortero_(texto);
  if (j.ok) {
    var d = { portero: 'jev', jev_conf: j.confianza, jev_ms: j.ms };
    d.usar = j.choice === 'leer' && j.confianza >= JEV_UMBRAL_;
    d.motivo = 'Jev: ' + j.choice + ' ' + Math.round(j.confianza * 100) + ' %' + (j.choice === 'leer' && !d.usar ? ' (menos de ' + Math.round(JEV_UMBRAL_ * 100) + ' %)' : '');
    return d;
  }
  var r = VOZ_RAPIDO_LEER_RE_.test(t) ? { usar: true, motivo: 'leer' } : { usar: false, motivo: 'no es una pregunta de leer' };
  r.portero = 'reglas'; if (j.error) r.jev_error = j.error; if (j.ms != null) r.jev_ms = j.ms;
  return r;
}

/* ¿Le preguntamos a Jev? Llave guardada, interruptor encendido y no está en pausa por fallar o tardar. */
function jevKey_() { return String(PropertiesService.getScriptProperties().getProperty('JEV_KEY') || '').trim(); }
function jevModelo_() { return String(PropertiesService.getScriptProperties().getProperty('JEV_MODELO') || '').trim() || JEV_MODELO_; }
function jevOn_() { return String(PropertiesService.getScriptProperties().getProperty('VOZ_JEV') || '1') !== '0'; }
/* Solo el pedido, sin teléfonos ni correos, y corto. */
function jevLimpiar_(texto) {
  return String(texto || '').replace(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi, '[correo]')
    .replace(/\+?\d[\d\s().-]{5,}\d/g, function (x) { return x.replace(/\D/g, '').length >= 7 ? '[teléfono]' : x; })
    .replace(/\s+/g, ' ').trim().slice(0, JEV_MAX_LARGO_);
}
/* Un fallo: suma a los seguidos; al tercero (o si tardó de más) lo apaga JEV_PAUSA_S_ segundos. Nunca rompe el turno. */
function jevFallo_(lento) {
  try {
    var c = CacheService.getScriptCache(), n = (Number(c.get('jev_fallos')) || 0) + 1;
    if (lento || n >= JEV_FALLOS_MAX_) { c.put('jev_pausa', '1', JEV_PAUSA_S_); c.remove('jev_fallos'); }
    else c.put('jev_fallos', String(n), JEV_PAUSA_S_);
  } catch (e) {}
}
/* Le pregunta a Jev el camino del pedido → { ok, choice, confianza, ms } o { ok: false, error, ms? }. La llave nunca sale. */
function jevPortero_(texto) {
  if (!jevOn_()) return { ok: false, error: 'apagado (VOZ_JEV = 0)' };
  var key = jevKey_(); if (!key) return { ok: false, error: 'sin JEV_KEY' };
  try { if (CacheService.getScriptCache().get('jev_pausa')) return { ok: false, error: 'en pausa' }; } catch (e) {}
  var pedido = jevLimpiar_(texto); if (!pedido) return { ok: false, error: 'sin pedido' };
  var modelo = jevModelo_(), t0 = Date.now(), r = null, code = 0, j = null, error = '';
  try {
    r = uf_(JEV_URL_, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ model: modelo, state: { pedido: pedido }, questions: JEV_PREGUNTA_ }) });
    code = r.getResponseCode();
    if (code !== 200) error = 'HTTP ' + code;
    else { try { j = JSON.parse(r.getContentText()); } catch (e) { error = 'respuesta rara'; } }
  } catch (e) { error = 'no respondió: ' + String(e && e.message || e).split(key).join('***').slice(0, 60); }
  var ms = Date.now() - t0, a = j && j.answers && j.answers.camino, choice = a && String(a.choice || ''), conf = NaN;
  if (!error) {
    conf = Number(a && a.confidence != null ? a.confidence : a && a.probabilities && a.probabilities[choice]);
    if (!a || !JEV_PREGUNTA_.camino.criteria.hasOwnProperty(choice) || !(conf >= 0 && conf <= 1)) error = 'respuesta rara';
  }
  if (!error && ms > JEV_MS_MAX_) error = 'tardó ' + ms + ' ms';
  try { registrarUso_({ app: 'ALMA', funcion: 'Voz · portero Jev', detalle: 'precio estimado', modelo: String(j && j.model || modelo), usage: j && j.usage || {}, ms: ms, ok: !error }); } catch (e) {}
  if (error) {
    jevFallo_(ms > JEV_MS_MAX_);
    console.warn('Jev → reglas: ' + error);
    return { ok: false, error: error, ms: ms };
  }
  try { CacheService.getScriptCache().remove('jev_fallos'); } catch (e) {}
  return { ok: true, choice: choice, confianza: conf, ms: ms };
}

/* El camino rápido de un turno de voz (lo llama opAgente_ antes del bucle de siempre).
   null: no era para el rápido · false: lo intentó y no pudo (sigue el de siempre, que ya esperó) · objeto: el turno listo. */
function rapidoIntentar_(adm, texto, system, msgs, tools, ctx, o) {
  var ms = AG_MS_ || {}, t0 = Date.now();
  AG_USO_FUNCION_ = '';
  var d = rapidoDecide_(texto, o);
  if (AGENTE_RAPIDO_ && d.portero) { ms.portero = d.portero; if (d.jev_conf != null) ms.jev_conf = Math.round(d.jev_conf * 100) / 100; if (d.jev_ms != null) ms.jev_ms = d.jev_ms; if (d.jev_error) ms.jev_error = d.jev_error; }
  if (!d.usar) { if (AGENTE_RAPIDO_) { ms.via = 'completo'; ms.motivo = d.motivo; ms.modelo = CFG.MODELO_REDACTOR; } return null; }
  var modelo = rapidoModelo_(), hechas0 = ctx.hechas.length, llamadas0 = (ctx.llamadas || []).length, motivo = '', fin = null;
  var herr = tools.filter(function (t) { return t.name && VOZ_RAPIDO_HERR_.indexOf(t.name) >= 0; });
  var nombres = herr.map(function (t) { return t.name; });
  herr = herr.concat([RAPIDO_PASAR_]);
  var sys = system + '\n\nCAMINO RÁPIDO: en este turno solo tienes herramientas de leer (' + nombres.join(', ') + ') y pasar_al_completo. ' +
    'Si el pedido pide hacer algo, necesita otra herramienta o no lo puedes contestar con seguridad con lo que leas, llama pasar_al_completo y no respondas. Nunca digas que algo quedó hecho.';
  var limite = t0 + VOZ_RAPIDO_MS_; if (AGENTE_PLAZO_) limite = Math.min(limite, AGENTE_PLAZO_ - AGENTE_MARGEN_VUELTA_);
  var m = msgs.slice();
  try {
    for (var vuelta = 0; vuelta < VOZ_RAPIDO_VUELTAS_ && !motivo && fin === null; vuelta++) {
      if (vuelta && Date.now() > limite) { motivo = 'tiempo'; break; }
      var j = claudeTools_(modelo, sys, m, herr, 2000, { sinTemperatura: true, esfuerzo: 'low', funcion: 'Voz · camino rápido' });
      if (!j) { motivo = 'falló la API'; break; }
      if (j.stop_reason === 'refusal') { motivo = 'se negó'; break; }
      if (j.stop_reason === 'max_tokens') { motivo = 'sin tokens'; break; }
      var bloques = j.content || [], usos = bloques.filter(function (b) { return b.type === 'tool_use'; });
      m.push({ role: 'assistant', content: bloques });
      if (!usos.length) {
        var txt = bloques.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').trim(), tn = rapidoNorm_(txt);
        if (!txt) motivo = 'respuesta vacía';
        else if (VOZ_RAPIDO_HECHO_RE_.test(tn)) motivo = 'dijo que lo hizo';
        else if (VOZ_RAPIDO_NO_SABE_RE_.test(tn)) motivo = 'no sabe';
        else { var np = escalarNoPudo_(txt, null); if (np) motivo = 'no pudo (' + np + ')'; else fin = txt; }
        break;
      }
      /* Primero se mira TODO lo que pidió: si una sola no es de leer, nada corre. */
      var pasa = usos.filter(function (u) { return u.name === RAPIDO_PASAR_.name; })[0], ajena = usos.filter(function (u) { return nombres.indexOf(u.name) < 0 && u.name !== RAPIDO_PASAR_.name; })[0];
      if (pasa) { motivo = 'pidió el completo' + (pasa.input && pasa.input.motivo ? ': ' + String(pasa.input.motivo).slice(0, 60) : ''); break; }
      if (ajena) { motivo = 'pidió ' + ajena.name; break; }
      if (Date.now() > limite) { motivo = 'tiempo'; break; }
      var resultados = usos.map(function (u) {
        var res, th = Date.now(); try { res = agEjecutar_(adm, u.name, u.input, ctx); } catch (e) { console.error('rapido ' + u.name + ': ' + (e.stack || e)); res = { error: String(e.message || e).slice(0, 200) }; }
        if (AG_MS_) { AG_MS_.herr += Date.now() - th; AG_MS_.nh++; }
        if (ctx.llamadas) ctx.llamadas.push({ tool: u.name, input: u.input || {}, ok: !!res && !res.error && res.ok !== false });
        return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(res).slice(0, 12000), is_error: !!(res && res.error) };
      });
      m.push({ role: 'user', content: resultados });
    }
    if (!motivo && fin === null) motivo = 'muchas vueltas';
  } catch (e) { console.error('rapidoIntentar_: ' + (e.stack || e)); motivo = 'error: ' + String(e.message || e).slice(0, 60); fin = null; }
  ms.rapido = Date.now() - t0;
  if (fin !== null && !motivo) { ms.via = 'rapido'; ms.motivo = d.motivo; ms.modelo = modelo; return agCerrarTurno_(adm, fin, ctx); }
  /* No pudo: lo que el rápido leyó no queda; el de siempre empieza limpio desde el mismo pedido. */
  ctx.hechas.length = hechas0; if (ctx.llamadas) ctx.llamadas.length = llamadas0; ctx.parcial = null;
  if (typeof TV_CANDIDATA_ !== 'undefined') TV_CANDIDATA_ = null;   // la tarjeta de la llamada (tarjeta.js) la elige lo que lea el de siempre
  ms.via = 'rapido>completo'; ms.motivo = motivo; ms.modelo = CFG.MODELO_REDACTOR;
  AG_USO_FUNCION_ = 'Voz · completo tras el rápido';
  console.log('Camino rápido → completo: ' + motivo);
  return false;
}
