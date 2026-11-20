/* ═══ MODO CLÁSICO (Juan, 20-nov-2026, #923) ═══════════════════════════════════════════════════════════════
   «Un modo como combate militar, donde Alma simplemente responde de forma pasiva, algo como “copiado”». Con Juan (el
   administrador principal), en el chat, WhatsApp y la llamada: Alma no conversa, no propone ni bromea; hace lo que le
   piden y confirma con comandos cortos («Copiado.», «Listo.»), como ya lo hace en el Modo calle (calle.js).
   · Se prende y se apaga en Ajustes → Personalidad (personalidadFijar, medidores.js) o diciéndoselo a Alma
     («activa el modo clásico», «sal del modo clásico»: herramienta modo_clasico, agente.js).
   · Queda como Juan lo dejó, sin vencer (Propiedad del script ALMA_CLASICO = '1').
   · Prendido, el Modo Weebo queda en 0 con Juan (weeboBloque_, weebo.js) y la llamada saluda corto (personalidadFicha_).
   · Con el equipo, socios, familia y huéspedes no cambia nada. Los mensajes por encargo siguen completos y exactos. */
/* Guardia 20-nov-2026: Juan dijo dos veces «ya tenemos activado el modo táctico» y Alma solo se rió. El nombre oficial
   sigue siendo Modo clásico (en la app y en lo que Alma dice; «modo táctico» y «modo militar» están en la columna «Evitar»
   del glosario), pero Alma los reconoce cuando Juan los dice: en la regla (prendido), en la ficha de la llamada (apagado,
   CLASICO_APAGADO_) y en la herramienta modo_clasico del chat (agente.js). */
var CLASICO_OTROS_NOMBRES_ = '· Si Juan dice «modo táctico» o «modo militar», es este mismo Modo clásico.';
var CLASICO_APAGADO_ = 'MODO CLÁSICO (apagado): si Juan pide el modo clásico, «modo táctico» o «modo militar» (o dice que ya lo tienen activado), es el mismo modo: pídelo a secretaria como «activa el modo clásico» y confirma solo «Copiado.». Para salir: «sal del modo clásico».';
var CLASICO_REGLA_ = [
  'MODO CLÁSICO (lo prendió Juan; sigue hasta que él lo apague): hablas como en un radio de combate, pasiva y táctica.',
  '· Haz lo que pide y confirma UNA sola vez en 1 a 4 palabras: «Copiado.», «Confirmado.», «Listo, enviado.».',
  '· Una pregunta suya: solo el dato, 12 palabras como mucho.',
  '· Sin saludos, sin repetir el pedido, sin ofrecer más, sin sugerencias, sin bromas ni preguntas de cierre («¿algo más?»).',
  '· Solo preguntas si sin ese dato no puedes hacerlo, en una línea. Un error o un riesgo sí lo dices, claro y corto.',
  '· Lo que escribes por encargo (un mensaje, una tarea, un correo) sigue completo y exacto: lo corto es cómo le hablas a Juan.',
  CLASICO_OTROS_NOMBRES_ + ' Si dice que ya está activado, confirma «Confirmado.»; si pide salir, apágalo como siempre.'
].join('\n');
var CLASICO_SALUDOS_ = ['Adelante.', 'Te copio.', 'Aquí Alma, adelante.', 'Lista, te copio.'];

function clasicoActivo_() {
  try { return PropertiesService.getScriptProperties().getProperty('ALMA_CLASICO') === '1'; } catch (e) { return false; }
}
function clasicoFijar_(adm, encender) {
  if (!adm || !adm.principal) return { ok: false, error: 'Solo el administrador principal prende o apaga el Modo clásico.' };
  var p = PropertiesService.getScriptProperties();
  if (encender) p.setProperty('ALMA_CLASICO', '1'); else p.deleteProperty('ALMA_CLASICO');
  return { ok: true, clasico: clasicoActivo_() };
}
/* Lo que lee y escribe con Juan desde la herramienta del chat (y de la llamada, por secretaria). */
function clasicoHerramienta_(adm, inp) {
  var r = clasicoFijar_(adm, !!(inp && inp.encender === true));
  if (!r.ok) return r;
  return Object.assign(r, { nota: r.clasico ? 'Prendido. Desde ya confírmale solo «Copiado.» y sigue así hasta que lo apague.'
    : 'Apagado. Vuelves a tu forma normal; confírmalo corto («Listo, modo normal.»).' });
}
