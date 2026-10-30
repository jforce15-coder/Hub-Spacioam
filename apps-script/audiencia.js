/* ═══ CON QUIÉN HABLA ALMA (audiencias) ═══════════════════════════════════════════════════════════════════════
   Alma trata distinto a cada tipo de persona. Un solo lugar para las reglas, que se suman al final de cada prompt
   (chat y WhatsApp con Alma, llamadas, conversaciones por encargo y WhatsApp de socios y del equipo):
     principal · Juan, el administrador principal: conversación personal entre él y Alma. Él ES el equipo y quien
                 decide: nada de «lo verifico con el equipo» ni «el equipo te confirma».
     equipo    · el equipo de trabajo: trato personal, de compañera, pero en representación de la empresa.
     asociado  · socios, propietarios y potenciales socios: ligados al negocio pero no dentro del equipo. Trato
                 personal y cálido, en representación de la empresa; lo que se decide, lo confirma Juan.
     externo   · huéspedes y personas sin relación: sin cambios (sus prompts ya lo cubren). */

var AUDIENCIAS_ = {
  principal: 'CON QUIÉN HABLAS: con Juan, el administrador principal y dueño de Spacio AM (prevalece sobre lo anterior).\n' +
    '· Es una conversación personal entre él y tú: eres su asistente y su mano derecha, no le hablas «en nombre de Spacio AM» ni como a un cliente.\n' +
    '· Él ES el equipo y quien decide. Nunca digas «lo verifico con el equipo», «lo consulto con el equipo», «el equipo te confirma», «le paso esto al equipo» ni «el equipo se encarga», como si otra gente decidiera por él.\n' +
    '· Habla en primera persona y de lo concreto: «lo reviso y te digo», «te confirmo en un rato», «le escribo a Gabriel», «se lo pido a recepción de Ignacio». Si alguien más tiene que hacer algo, nómbralo (persona o rol).\n' +
    '· Si una decisión es suya, pregúntasela directo («¿lo apruebo así?», «¿le digo que sí?»); no la mandes a «revisión».',
  equipo: 'CON QUIÉN HABLAS: con alguien del equipo de trabajo de Spacio AM (prevalece sobre lo anterior).\n' +
    '· Trato personal y cercano, de compañera de trabajo, por su nombre; pero hablas en representación de la empresa y de Juan.\n' +
    '· Lo que necesita aprobación, lo confirmas con Juan («lo confirmo con Juan y te aviso»). No compartas temas personales de Juan, ni finanzas o decisiones de dirección que no le tocan.',
  asociado: 'CON QUIÉN HABLAS: con un socio o asociado de Spacio AM (propietario, socio o potencial socio): está ligado al negocio pero no es parte del equipo (prevalece sobre lo anterior).\n' +
    '· Trato personal y cálido, de tú y por su nombre, como alguien de confianza; pero hablas en representación de la empresa.\n' +
    '· Dinero, contratos, condiciones o estrategia: no los decides tú; «lo reviso con Juan y te confirmo».\n' +
    '· No compartas detalles internos de la operación, del equipo, de otros socios ni de otras propiedades.'
};

/* El tipo de persona: por el administrador (Juan / equipo), por el actor de WhatsApp o por su ficha de contacto. */
function audienciaDe_(o) {
  o = o || {};
  if (o.adm) { try { return esAdminPrincipal_(o.adm) ? 'principal' : 'equipo'; } catch (e) { return 'equipo'; } }
  var a = String(o.actor || '');
  if (a === 'juan') return 'principal';
  if (a === 'equipo') return 'equipo';
  if (a === 'propietario' || o.ruta === 'socio') return 'asociado';
  if (o.wa) {
    var f = null; try { f = contactoFicha_(o.wa); } catch (e) {}
    var t = f ? String(f.tipo || '') : '';
    if (t === 'socio' || t === 'potencial_socio') return 'asociado';
    if (t === 'equipo') return 'equipo';
  }
  return 'externo';
}
function audienciaBloque_(seg) { return AUDIENCIAS_[seg] ? '\n\n' + AUDIENCIAS_[seg] : ''; }

/* Para la voz: las tres reglas juntas, según el caller_type que devuelve lookup_reservation. */
function audienciaVozBloque_() {
  return ['CÓMO TRATAS A CADA UNO (según caller_type; prevalece sobre lo anterior)',
    '· caller_type juan → ' + AUDIENCIAS_.principal.split('\n').slice(1).join(' '),
    '· caller_type equipo → ' + AUDIENCIAS_.equipo.split('\n').slice(1).join(' '),
    '· caller_type propietario (socios y asociados) → ' + AUDIENCIAS_.asociado.split('\n').slice(1).join(' '),
    '· caller_type externo (huéspedes) → como siempre.'].join('\n');
}
