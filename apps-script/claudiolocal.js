/* ═══ 15c · CLAUDIO LOCAL (Juan, 16-nov-2026, #629) ═══════════════════════════════════════════════════════════════
   «Configurar la voz de Claudio para que sea local, imitando la voz, patrones y system prompt de ElevenLabs, para no
   consumir créditos en sesiones extensas de trabajo.» Las sesiones con Claudio son largas (pedidos, estado, cómo funciona
   algo) y cada minuto en el agente de ElevenLabs gasta créditos de voz. Con Claudio local, nada de esa conversación pasa
   por ElevenLabs:
     · oído: el dictado del iPhone, en el teléfono (la app, ClaudioLocal.swift);
     · cabeza: esta acción, claudioLocal, con el MISMO prompt de Claudio (claudioPromptObj_: cómo habla, por voz,
       confirmaciones, «nunca» y Weebo salen de la misma fuente que Alma), la MISMA ficha (claudioFicha_) y las MISMAS
       herramientas (claudio_pedido, claudio_responder, claudio_estado, claudio_unir, claudio_codigo y volver_con_alma),
       con el modelo rápido de la voz (rapidoModelo_, como el camino rápido): cuesta centavos de texto, no minutos de voz;
     · voz: una voz de hombre del iPhone (la mejor que tenga en español), afinada para parecerse a la de Claudio en
       ElevenLabs (calmada, cálida, ritmo de conversación): CLAUDIO_VOZ_LOCAL_, y se cambia sin PR con la propiedad
       CLAUDIO_VOZ_LOCAL (JSON).
   Las reglas de cómo suena (skill alma-humana, «Diseñar para el oído»): la respuesta primero, frases cortas, una sola
   pregunta al final, nada de listas ni etiquetas de emoción (la voz del iPhone las leería en voz alta): CLAUDIO_LOCAL_VOZ_.
   Encendido de fábrica. CLAUDIO_LOCAL = 0 (Propiedades del script) vuelve al agente de ElevenLabs sin un PR. La app
   que todavía no sabe hacerlo ignora «local» y sigue con la URL firmada de siempre.
   Seguridad: igual que Claudio, solo el administrador principal, verificado por su sesión en CADA turno (no por lo que
   diga la conversación). La conversación local tiene su id (conv_local_…, para el Panel de Claudio y la vuelta con Alma)
   ligado a su teléfono; otro administrador no puede usarla.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var CLAUDIO_LOCAL_PALABRAS_ = 45;   // ~15 s hablados: dos o tres frases cortas (alma-humana: ~30; aquí explica código)
var CLAUDIO_LOCAL_VUELTAS_ = 4, CLAUDIO_LOCAL_MS_ = 22000, CLAUDIO_LOCAL_HIST_ = 14;
var CLAUDIO_LOCAL_REPITE_ = 'Perdón, no me llegó bien. ¿Me lo repites?';
/* La voz del iPhone que imita a Claudio: de hombre, en español de México (luego Estados Unidos y España), la de mejor
   calidad instalada; un poco más grave y apenas más pausada que la de fábrica, como su voz de ElevenLabs. */
var CLAUDIO_VOZ_LOCAL_ = { idiomas: ['es-MX', 'es-US', 'es-419', 'es-ES'], genero: 'hombre', velocidad: 0.5, tono: 0.92, volumen: 1 };
var CLAUDIO_LOCAL_VOZ_ = [
  'Te oye el dictado del iPhone y te lee en voz alta una voz del iPhone: escribe SOLO lo que dirías, en texto plano.',
  'Nada de etiquetas de emoción ([warm], [laughs]…), markdown, viñetas, emojis, enlaces ni nombres de archivos: la voz los leería tal cual.',
  'La respuesta primero; dos o tres frases cortas, unas 30 palabras. Una sola pregunta, al final.',
  'Números como persona («el cambio seiscientos veintinueve» solo si Juan lo pide; si no, por su nombre).',
  'El dictado a veces entiende mal: si algo no tiene sentido, confirma lo que sí entendiste y pide solo lo que falta.',
  'Si Juan solo dijo «ajá», «sí» o «ok» sin pedir nada, contesta muy corto o sigue con lo que ibas.',
  'Volver con Alma: di solo «Listo, te paso con Alma.» y usa volver_con_alma en ese mismo turno.'
];

function claudioLocalOn_() { return String(PropertiesService.getScriptProperties().getProperty('CLAUDIO_LOCAL') || '1') !== '0'; }
function claudioVozLocal_() {
  var o = Object.assign({}, CLAUDIO_VOZ_LOCAL_), p = PropertiesService.getScriptProperties().getProperty('CLAUDIO_VOZ_LOCAL');
  if (p) { try { var j = JSON.parse(p); if (j && typeof j === 'object') Object.keys(o).forEach(function (k) { if (j[k] != null) o[k] = j[k]; }); } catch (e) { console.error('CLAUDIO_VOZ_LOCAL: ' + e); } }
  var n = function (x, a, b, d) { x = Number(x); return isNaN(x) ? d : Math.min(b, Math.max(a, x)); };
  o.velocidad = n(o.velocidad, 0.3, 0.65, 0.5); o.tono = n(o.tono, 0.6, 1.4, 0.92); o.volumen = n(o.volumen, 0.2, 1, 1);
  o.idiomas = (Array.isArray(o.idiomas) ? o.idiomas : [String(o.idiomas || '')]).map(String).filter(function (x) { return /^es(-[A-Za-z0-9]+)?$/.test(x); }).slice(0, 5);
  if (!o.idiomas.length) o.idiomas = CLAUDIO_VOZ_LOCAL_.idiomas.slice();
  o.genero = o.genero === 'mujer' ? 'mujer' : 'hombre';
  return o;
}

/* vozClaudio (claudioWebInicio_) suma lo de Claudio local: la conversación local y su voz. La ficha queda guardada para
   esa conversación (los turnos no la vuelven a armar) y el id queda ligado al teléfono del principal. */
function claudioLocalSumar_(out, adm, ficha) {
  if (!claudioLocalOn_()) return out;
  var conv = 'conv_local_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20), c = CacheService.getScriptCache();
  c.put('claudio_' + conv, normTel_(adm.tels[0]), 21600);
  try { c.put('claudiolocal_' + conv, String(ficha || '').slice(0, 90000), 21600); } catch (e) { console.error('claudiolocal ficha: ' + e); }
  out.local = true; out.conv_id = conv; out.voz_local = claudioVozLocal_();
  return out;
}

/* El system de Claudio local: el mismo prompt que su agente de ElevenLabs, con la ficha en su lugar y las reglas de voz local. */
function claudioLocalSystem_(ficha) {
  var o = claudioPromptObj_();
  o.claudio.voz_local = CLAUDIO_LOCAL_VOZ_.slice();
  o.ficha_de_quien_llama = [String(ficha || CLAUDIO_SIN_FICHA_)];
  return JSON.stringify(o);
}
/* Sus herramientas, en el formato de Claude: las mismas de su agente (sin conv_id ni sa_web, que pone el Hub). */
function claudioLocalHerramientas_() {
  return claudioDefHerramientas_('L').map(function (d) {
    var sch = d.type === 'webhook' ? d.api_schema.request_body_schema : d.parameters, props = {};
    Object.keys(sch.properties || {}).forEach(function (k) { if (k !== 'conv_id' && k !== 'sa_web') props[k] = sch.properties[k]; });
    var req = (sch.required || []).filter(function (k) { return k !== 'conv_id' && k !== 'sa_web'; });
    return { name: d.name, description: d.description, input_schema: { type: 'object', properties: props, required: req } };
  });
}
/* Lo que la app manda de la conversación (lo que dijo cada uno) → mensajes alternados para Claude. */
function claudioLocalMensajes_(historial, texto) {
  var m = [];
  var poner = function (rol, t) {
    t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 800); if (!t) return;
    var ul = m[m.length - 1];
    if (ul && ul.role === rol) ul.content += '\n' + t; else m.push({ role: rol, content: t });
  };
  (Array.isArray(historial) ? historial : []).slice(-CLAUDIO_LOCAL_HIST_).forEach(function (h) {
    if (h && typeof h === 'object') poner(h.de === 'claudio' ? 'assistant' : 'user', h.texto);
  });
  poner('user', texto);
  if (m.length && m[0].role === 'assistant') m.unshift({ role: 'user', content: '(Alma te pasó la llamada.)' });
  if (!m.length || m[m.length - 1].role !== 'user') m.push({ role: 'user', content: '(Juan se quedó callado.)' });
  return m;
}
/* Lo que se dice en voz alta: sin lo que la voz del iPhone leería raro, y corto. */
function claudioLocalHablar_(t) { return calleCorto_(calleLimpiar_(t), CLAUDIO_LOCAL_PALABRAS_); }

/* ── Acción claudioLocal { conv_id, texto, historial: [{ de: 'juan'|'claudio', texto }] } (solo el principal) ──
   Devuelve { ok, hablar, volver, herramientas }. volver: Claudio usó volver_con_alma (la app vuelve a Alma después de
   decir hablar). herramientas: las de claudio_* que corrieron (la app pide el Panel de Claudio). */
function claudioLocalApi_(ses, b) {
  b = b || {};
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };   // no 'session': ese error cierra la sesión del navegador
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Claudio es solo para el administrador principal.', codigo: 'no_principal' };
  var conv = String(b.conv_id || '').trim(), c = CacheService.getScriptCache();
  if (!/^conv_local_[a-f0-9]{8,40}$/.test(conv)) return { ok: false, error: 'Falta la conversación de Claudio local.' };
  var tel = c.get('claudio_' + conv);
  if (tel && !(adm.tels || []).some(function (x) { return fin8_(x) === fin8_(tel); })) return { ok: false, error: 'Esa conversación no es tuya.' };
  if (!tel) c.put('claudio_' + conv, normTel_(adm.tels[0]), 21600);
  var texto = String(b.texto || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  var ficha = c.get('claudiolocal_' + conv);
  if (!ficha) {   // la caché venció (más de 6 h) o se borró: se arma otra vez
    ficha = claudioFicha_(adm, String(adm.nombre || '').trim().split(/\s+/)[0] || 'Juan', '');
    try { c.put('claudiolocal_' + conv, ficha.slice(0, 90000), 21600); } catch (e) {}
  }
  return claudioLocalTurno_(adm, conv, claudioLocalSystem_(ficha), claudioLocalMensajes_(b.historial, texto));
}
function claudioLocalTurno_(adm, conv, system, msgs) {
  var t0 = Date.now(), tools = claudioLocalHerramientas_(), corridas = [], volver = false, dicho = '';
  for (var v = 0; v < CLAUDIO_LOCAL_VUELTAS_; v++) {
    if (v && Date.now() - t0 > CLAUDIO_LOCAL_MS_) break;
    var j = claudeTools_(rapidoModelo_(), system, msgs, tools, 900, { sinTemperatura: true, esfuerzo: 'low', funcion: 'Claudio · voz local' });
    if (!j) return { ok: false, hablar: CLAUDIO_LOCAL_REPITE_, volver: false, herramientas: corridas, error: 'la IA no respondió' };
    var bloques = j.content || [], usos = bloques.filter(function (x) { return x.type === 'tool_use'; });
    var txt = bloques.filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join(' ').trim();
    if (txt) dicho = txt;
    if (!usos.length) break;
    msgs.push({ role: 'assistant', content: bloques });
    var res = usos.map(function (u) {
      var out;
      if (u.name === 'volver_con_alma') { volver = true; out = { ok: true }; }
      else if (CLAUDIO_HERR_.indexOf(u.name) >= 0) {
        out = claudioEjecutar_(adm, u.name, Object.assign({}, u.input || {}, { conv_id: conv }));
        corridas.push(u.name);
      } else out = { ok: false, error: 'herramienta desconocida' };
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out).slice(0, 6000) };
    });
    msgs.push({ role: 'user', content: res });
    if (volver) break;   // ya dijo «Listo, te paso con Alma.»: no hace falta otra vuelta
  }
  var hablar = claudioLocalHablar_(dicho);
  if (volver && !hablar) hablar = 'Listo, te paso con Alma.';
  return { ok: true, hablar: hablar || CLAUDIO_LOCAL_REPITE_, volver: volver, herramientas: corridas, ms: Date.now() - t0 };
}
