/* ═══ CON QUIÉN HABLA ALMA (audiencias) ═══════════════════════════════════════════════════════════════════════
   Alma trata distinto a cada tipo de persona. Un solo lugar para las reglas, que se suman al final de cada prompt
   (chat y WhatsApp con Alma, llamadas, conversaciones por encargo y WhatsApp de socios y del equipo):
     principal · Juan, el administrador principal: conversación personal entre él y Alma. Él ES el equipo y quien
                 decide: nada de «lo verifico con el equipo» ni «el equipo te confirma».
     equipo    · el equipo de trabajo: trato personal, de compañera, pero en representación de la empresa.
     asociado  · socios, propietarios y potenciales socios: ligados al negocio pero no dentro del equipo. Trato
                 personal y cálido, en representación de la empresa; lo que se decide, lo confirma Juan.
     externo   · huéspedes y personas sin relación: sin cambios (sus prompts ya lo cubren). */

/* Las reglas de cada audiencia viven en la fuente única (playbooks/alma.json → ALMA_FUENTE_.audiencias): aquí solo se
   decide QUIÉN es la persona (audienciaDe_) y se arma su bloque corto (audienciaBloque_). */

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
function audienciaBloque_(seg) {
  var a = (ALMA_FUENTE_.audiencias || {})[seg]; if (!a) return '';
  var r = function (t) { return almaRellenar_(t, {}); };
  return '\n\nCON QUIÉN HABLAS: ' + r(a.quien) + '\n' + a.reglas.map(function (x) { return '· ' + r(x.texto); }).join('\n');
}
