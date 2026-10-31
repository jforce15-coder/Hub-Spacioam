/* ═══ ADAPTACIÓN DE ALMA A CADA PERSONA ══════════════════════════════════════════════════════════════
   Alma parte neutra (0 %, como hoy) y se ajusta poco a poco a cada persona: +5 % cada 10 mensajes, hasta un TOPE.
   Se adapta la FORMA (largo, formalidad, idioma, ritmo) y también los TEMAS y los HORARIOS. Nunca datos, permisos
   ni reglas del negocio. No es el Modo Weebo (weebo.js): aquel es humor según la confianza; esto es qué tanto
   se parece Alma a la manera de cada persona.
   El tope por defecto es 60 % (huéspedes 20 %); solo el administrador principal lo cambia (propiedad del script
   ALMA_ADAPTACION_TOPE / ALMA_ADAPTACION_TOPE_HUESPED). Lo que Alma aprendió se guarda en la hoja ALMA_ADAPTACION. */
var ADAPT_CAB_ = ['clave', 'rol', 'mensajes', 'nivel', 'horas', 'temas', 'largo_prom', 'actualizado'];
var ADAPT_PASO_ = 5, ADAPT_CADA_ = 10;
var ADAPT_TEMAS_ = { limpieza: /limpie|aseo|sucio/i, mantenimiento: /mantenim|repar|fuga|aire acond|plomer|el[ée]ctric/i, reservas: /reserva|check-?in|check-?out|hu[ée]sped|llegada/i,
  cobros: /cobro|pago|factura|reembolso|dep[óo]sito|precio|tarifa/i, tareas: /tarea|pendiente|asign|recordatorio/i, familia: /ni[ñn]os|familia|escuela|viaje|vuelo/i, ideas: /idea|estrategia|proyecto|crecer|marca/i };
function adaptTope_(rol) {
  var p = PropertiesService.getScriptProperties();
  var v = Number(p.getProperty(rol === 'huesped' ? 'ALMA_ADAPTACION_TOPE_HUESPED' : 'ALMA_ADAPTACION_TOPE'));
  if (!isFinite(v) || v <= 0) v = rol === 'huesped' ? 20 : 60;
  return Math.max(0, Math.min(100, Math.round(v)));
}
/* Solo el administrador principal fija el tope (lo llamará el Hub en el siguiente ticket). */
function adaptFijarTope_(adm, rol, valor) {
  if (!adm || !adm.principal) return { ok: false, error: 'Solo el administrador principal fija el tope.' };
  var v = Math.max(0, Math.min(100, Math.round(Number(valor)))); if (!isFinite(v)) return { ok: false, error: 'valor' };
  PropertiesService.getScriptProperties().setProperty(rol === 'huesped' ? 'ALMA_ADAPTACION_TOPE_HUESPED' : 'ALMA_ADAPTACION_TOPE', String(v));
  return { ok: true, tope: v };
}
function adaptJ_(s, def) { try { return JSON.parse(s) || def; } catch (e) { return def; } }
/* Cuenta un mensaje de la persona. Devuelve el estado { nivel, tope, mensajes }. */
function adaptRegistrar_(clave, rol, texto) {
  clave = String(clave || '').toLowerCase().trim(); if (!clave) return null;
  var sh = hojaCrear_('ALMA_ADAPTACION', ADAPT_CAB_), n = sh.getLastRow(), fila = 0, r = null;
  if (n >= 2) { var v = sh.getRange(2, 1, n - 1, ADAPT_CAB_.length).getValues(); for (var i = 0; i < v.length; i++) if (String(v[i][0]) === clave) { fila = i + 2; r = v[i]; break; } }
  var msgs = (r ? Number(r[2]) || 0 : 0) + 1, t = String(texto || '');
  var horas = adaptJ_(r && r[4], {}), temas = adaptJ_(r && r[5], {}), h = Utilities.formatDate(ahora_(), CFG.TZ, 'H');
  horas[h] = (horas[h] || 0) + 1;
  Object.keys(ADAPT_TEMAS_).forEach(function (k) { if (ADAPT_TEMAS_[k].test(t)) temas[k] = (temas[k] || 0) + 1; });
  var largo = Math.round((((r ? Number(r[6]) || 0 : 0) * (msgs - 1)) + t.length) / msgs);
  var tope = adaptTope_(rol), nivel = Math.min(tope, Math.floor(msgs / ADAPT_CADA_) * ADAPT_PASO_);
  var out = [clave, rol, msgs, nivel, JSON.stringify(horas), JSON.stringify(temas), largo, new Date().toISOString()];
  if (fila) sh.getRange(fila, 1, 1, out.length).setValues([out]); else sh.appendRow(out);
  return { nivel: nivel, tope: tope, mensajes: msgs, horas: horas, temas: temas, largo: largo };
}
/* Bloque para el prompt. Con nivel 0 no dice nada (Alma neutra, como hoy). */
function adaptBloque_(clave, rol, texto) {
  var e; try { e = adaptRegistrar_(clave, rol, texto); } catch (x) { return ''; }
  if (!e || e.nivel < 5) return '';
  var top = function (o, k) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, k); };
  var temas = top(e.temas, 3), hs = top(e.horas, 2).map(function (h) { return h + ':00'; });
  return '\n\nADAPTACIÓN A ESTA PERSONA (' + e.nivel + ' % de ' + e.tope + ' % posible; 0 % es tu centro neutro). Mézclate con su manera en esa proporción, sin exagerar: ' +
    'forma (su largo habitual ronda los ' + e.largo + ' caracteres por mensaje; imita su formalidad, idioma y ritmo)' +
    (temas.length ? '; temas que más usa: ' + temas.join(', ') + ' (puedes anticiparte con ellos)' : '') +
    (hs.length ? '; suele escribir hacia las ' + hs.join(' y ') + ' (cuida sus horarios al proponer cosas)' : '') +
    '. Adaptarte NUNCA cambia datos, permisos, precios ni reglas del negocio, y la seriedad ante un problema sigue igual.';
}
