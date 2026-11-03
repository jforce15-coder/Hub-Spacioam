/* ═══ MEDIDOR DE PERSONALIDAD (issue #410) ═══════════════════════════════════════════════════════════════
   Dos medidores de Alma que Juan ve y ajusta: la Adaptación (adaptacion.js: cuánto se parece a la manera de cada persona,
   con su tope) y el Modo Weebo (weebo.js: humor y chispa, automático o fijo). Se ven en Ajustes de la app
   (alma/inicio.html, «Personalidad de Alma») y en vivo durante la llamada (chips de la app de iPhone).
   · personalidad      → { adapt: { nivel_juan, tope, tope_huesped, mensajes }, weebo: { modo, nivel_fijo, nivel_actual, max_huesped } }
   · personalidadFijar → { adapt_tope?, adapt_tope_huesped?, weebo_modo?, weebo_nivel? } y devuelve lo mismo que personalidad
   Solo el administrador principal, con su sesión. Los huéspedes siguen con sus límites: Weebo máximo 1 (fijo en el código)
   y su propio tope de adaptación (20 % por defecto, se puede cambiar aquí).
   También: los saludos variados de la llamada (Saludo variado) y lo que la ficha de voz lleva de estos medidores. */

function personalidadApi_(ses) {
  var adm = paraClaudePrincipalSes_(ses);
  if (!adm) return { ok: false, error: 'Solo el administrador principal ve la personalidad de Alma.' };
  return personalidadEstado_(adm);
}
function personalidadEstado_(adm) {
  var a = { nivel: 0, tope: adaptTope_('admin'), mensajes: 0 };
  try { a = adaptLeer_(adm.email, 'admin'); } catch (e) { console.error('adaptLeer_: ' + e); }
  var w = weeboModo_();
  return { ok: true,
    adapt: { nivel_juan: a.nivel, tope: a.tope, tope_huesped: adaptTope_('huesped'), mensajes: a.mensajes, paso: ADAPT_PASO_, cada: ADAPT_CADA_ },
    weebo: { modo: w.modo, nivel_fijo: w.nivel_fijo, nivel_actual: w.modo === 'fijo' ? w.nivel_fijo : weeboUltimo_(adm.email), max_huesped: WEEBO_CTX_.huesped.max } };
}
function personalidadFijarApi_(ses, b) {
  var adm = paraClaudePrincipalSes_(ses);
  if (!adm) return { ok: false, error: 'Solo el administrador principal cambia la personalidad de Alma.' };
  adm = Object.assign({}, adm, { principal: true });   // ya verificado arriba (también cuando la hoja aún no marca a nadie como principal)
  b = b || {};
  var hay = function (k) { return b[k] != null && b[k] !== ''; }, r;
  if (hay('adapt_tope')) { r = adaptFijarTope_(adm, 'admin', b.adapt_tope); if (!r.ok) return r; }
  if (hay('adapt_tope_huesped')) { r = adaptFijarTope_(adm, 'huesped', b.adapt_tope_huesped); if (!r.ok) return r; }
  if (hay('weebo_modo') || hay('weebo_nivel')) { r = weeboFijar_(adm, hay('weebo_modo') ? String(b.weebo_modo) : null, hay('weebo_nivel') ? b.weebo_nivel : null); if (!r.ok) return r; }
  return personalidadEstado_(adm);
}

/* Saludo variado (#410): frases naturales y completas para abrir la llamada, en lugar de «Dime, Juan». La app elige una
   distinta cada vez (nunca la misma dos veces seguidas) y no saluda si Juan ya está hablando. Sin «va» (ESTANDARES.md). */
var SALUDOS_VOZ_ = ['Hola, {n}, cuéntame.', 'Aquí estoy, ¿qué necesitas?', 'Dime, ¿en qué te ayudo?', 'Hola, {n}, ¿cómo vamos?',
  '¡Hola, {n}! ¿Qué hacemos hoy?', 'Te escucho, {n}.', 'Hola, aquí contigo. ¿Qué se te ofrece?', '¿Qué tal, {n}? Cuéntame.',
  'Hola, {n}. ¿En qué andamos?', 'Aquí estoy, {n}. ¿Por dónde empezamos?'];
function saludosVoz_(nom) {
  nom = String(nom || '').trim();
  return SALUDOS_VOZ_.map(function (s) { return nom ? s.replace(/\{n\}/g, nom) : s.replace(/,? ?\{n\}/g, ''); });
}

/* Lo que la ficha de voz de la app lleva de los medidores: los números para los chips y, si hace falta, una línea para Alma
   (el Modo Weebo fijo y cuánto se adapta a Juan). Solo con el principal; para el equipo no cambia nada. */
function personalidadFicha_(adm) {
  if (!adm || !adm.principal) return null;
  var e = personalidadEstado_(adm), w = e.weebo, a = e.adapt, lineas = [];
  if (w.modo === 'fijo') lineas.push('MODO WEEBO FIJO: nivel ' + w.nivel_fijo + ' (lo fijó Juan).');
  if (a.nivel_juan >= 5) lineas.push('ADAPTACIÓN A JUAN: ' + a.nivel_juan + ' % (de ' + a.tope + ' % posible): mézclate con su manera en esa proporción, sin cambiar datos ni reglas.');
  return { adapt_nivel: a.nivel_juan, adapt_tope: a.tope, weebo_modo: w.modo, weebo_nivel: w.nivel_actual == null ? 1 : w.nivel_actual,
    bloque: lineas.length ? '\n' + lineas.join('\n') : '' };
}
