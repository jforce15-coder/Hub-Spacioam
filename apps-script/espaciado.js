/* ═══ ESPACIADO GRADUAL (contactos externos por WhatsApp) ═══════════════════════════════════════════════════
   Si una persona externa sigue sin aclarar lo que pide (varios temas mezclados, notas de voz poco claras, preguntas
   sin respuesta concreta), Alma no corta de golpe: pregunta una vez más y después responde cada vez más tarde,
   hasta que la conversación se apaga sola. En cuanto la persona aclara algo, el contador vuelve a cero.
   Solo aplica a actor «externo» sin reserva; Juan, el equipo y los socios nunca se espacian.
   Estado por número en las propiedades vinculadas: espaciado_<8 dígitos> = { n, hasta, pend }. */

var ESPACIADO_MINUTOS_ = [15, 60, 240, 720];   // espera antes de la respuesta 3.ª, 4.ª, 5.ª y 6.ª seguidas sin aclarar; la siguiente ya no sale

function espaciadoAplica_(ctx) {
  return !!(ctx && ctx.esWA && ctx.sinReserva && (ctx.actor || 'externo') === 'externo');
}
function espaciadoLeer_(wa) {
  var st = {}; try { st = JSON.parse(vGet_('espaciado_' + fin8_(wa)) || '{}'); } catch (e) {}
  return { n: Number(st.n) || 0, hasta: Number(st.hasta) || 0, pend: !!st.pend };
}
function espaciadoGuardar_(wa, st) { vSet_('espaciado_' + fin8_(wa), st.n ? JSON.stringify(st) : ''); }

/* ¿El turno sigue sin aclarar lo que la persona pide? Una llamada barata; ante la duda, NO (Alma responde normal). */
function espaciadoConfuso_(ctx) {
  var txt = claude_(CFG.MODELO_CLASIFICADOR, 120,
    'Decides si una conversación de WhatsApp con una persona externa a Spacio AM sigue CONFUSA. Es confusa cuando, después de que Alma ya le preguntó, ' +
    'la persona sigue mezclando temas, deja preguntas sin responder o manda notas de voz poco claras, y todavía no se entiende qué pide. ' +
    'NO es confusa si pide algo concreto, aclaró lo anterior, es una emergencia o un problema urgente, o es el primer mensaje. ' +
    'Devuelve SOLO JSON: {"confuso":true|false}',
    'HILO RECIENTE:\n' + String(ctx.hiloTexto || '').slice(-2500) + '\n\nMENSAJES DE ESTE TURNO:\n' + ctx.texto, 0);
  try { return JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]).confuso === true; } catch (e) { return false; }
}

/* Devuelve { accion: 'responder' } | { accion: 'esperar', hasta: ms } | { accion: 'apagar', n } */
function espaciadoDecidir_(ctx) {
  var wa = String(ctx.resId).slice(3), st = espaciadoLeer_(wa), ahora = Date.now();
  if (st.pend) {   // ya se decidió esperar: al vencer la espera, Alma responde sin volver a contar
    if (st.hasta > ahora) return { accion: 'esperar', hasta: st.hasta };
    st.pend = false; espaciadoGuardar_(wa, st); return { accion: 'responder' };
  }
  if (!espaciadoConfuso_(ctx)) { if (st.n) espaciadoGuardar_(wa, { n: 0 }); return { accion: 'responder' }; }
  st.n++;
  if (st.n <= 2) { espaciadoGuardar_(wa, st); return { accion: 'responder' }; }   // las dos primeras veces Alma sigue preguntando
  var min = ESPACIADO_MINUTOS_[st.n - 3];
  if (!min) { espaciadoGuardar_(wa, st); return { accion: 'apagar', n: st.n }; }
  st.hasta = ahora + min * 60000; st.pend = true; espaciadoGuardar_(wa, st);
  return { accion: 'esperar', hasta: st.hasta };
}
