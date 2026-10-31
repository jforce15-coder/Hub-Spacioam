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
  var estilo = ''; try { estilo = estiloBloque_(clave, rol, texto); } catch (x2) {}   // el estilo se aprende y se usa desde el primer mensaje, aparte del porcentaje
  if (!e || e.nivel < 5) return estilo;
  var top = function (o, k) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, k); };
  var temas = top(e.temas, 3), hs = top(e.horas, 2).map(function (h) { return h + ':00'; });
  return '\n\nADAPTACIÓN A ESTA PERSONA (' + e.nivel + ' % de ' + e.tope + ' % posible; 0 % es tu centro neutro). Mézclate con su manera en esa proporción, sin exagerar: ' +
    'forma (su largo habitual ronda los ' + e.largo + ' caracteres por mensaje; imita su formalidad, idioma y ritmo)' +
    (temas.length ? '; temas que más usa: ' + temas.join(', ') + ' (puedes anticiparte con ellos)' : '') +
    (hs.length ? '; suele escribir hacia las ' + hs.join(' y ') + ' (cuida sus horarios al proponer cosas)' : '') +
    '. Adaptarte NUNCA cambia datos, permisos, precios ni reglas del negocio, y la seriedad ante un problema sigue igual.' + estilo;
}

/* ═══ PERFILES DE ESTILO (pedido #308) ═══════════════════════════════════════════════════════════════
   Además de la forma, Alma aprende SOLA señales suaves de cada persona: acento/modismos y jerga de su profesión.
   Se guardan en la hoja «Perfiles de estilo» (una fila por persona) que Juan puede ver y corregir:
     · acento / modismos / jerga = lo que Alma aprendió (Juan puede reescribirlo);
     · fijado = «SI» congela la fila (Alma deja de aprender en ella); «NO USAR» en jerga o acento la apaga para esa persona.
   Nunca cambia la personalidad base de Alma ni sus reglas, datos o permisos. Vale para todos los canales que pasan
   por el agente (Hub, WhatsApp y llamada), porque entra por el mismo bloque de adaptación (adaptBloque_). */
var ESTILO_CAB_ = ['clave', 'rol', 'acento', 'modismos', 'jerga', 'fijado', 'cuentas', 'actualizado'];
var ESTILO_MIN_ = 2;   // veces que se ve una señal antes de que Alma la use (una vez puede ser casualidad)
var ESTILO_ACENTOS_ = { guatemalteco: /(?:^|[^a-záéíóúñ])(chilero|chapín|chapin|va pues|patojo|cabal|qué onda vos|vos|al chilazo|chucho|shute)(?![a-záéíóúñ])/i,
  mexicano: /(?:^|[^a-záéíóúñ])(órale|orale|neta|güey|wey|ahorita|chido|padrísimo|no manches)(?![a-záéíóúñ])/i, rioplatense: /(?:^|[^a-záéíóúñ])(che|boludo|dale|laburo|re bueno|piola)(?![a-záéíóúñ])/i,
  colombiano: /(?:^|[^a-záéíóúñ])(parce|parcero|bacano|chévere|chevere|vaina)(?![a-záéíóúñ])/i, español_españa: /(?:^|[^a-záéíóúñ])(vale|tío|tio|mola|guay|flipar|currar)(?![a-záéíóúñ])/i,
  inglés: /(?:^|[^a-záéíóúñ])(the|please|thanks|could you|let's|asap|deadline)(?![a-záéíóúñ])/i };
var ESTILO_JERGA_ = { marketing: /(?:^|[^a-záéíóúñ])(campaña|engagement|funnel|conversión|branding|copy|seo|cpc|ctr|leads?|audiencia|alcance)(?![a-záéíóúñ])/i,
  programación: /(?:^|[^a-záéíóúñ])(deploy|commit|pull request|bug|api|backend|frontend|endpoint|refactor|script|repo|merge)(?![a-záéíóúñ])/i,
  finanzas: /(?:^|[^a-záéíóúñ])(flujo de caja|margen|ebitda|roi|utilidad|presupuesto|conciliar|conciliación|balance)(?![a-záéíóúñ])/i,
  operaciones: /(?:^|[^a-záéíóúñ])(check-?in|check-?out|turnover|rotación|ocupación|adr|revpar|housekeeping|inventario)(?![a-záéíóúñ])/i };
function estiloFila_(sh, clave) {
  var n = sh.getLastRow(); if (n < 2) return 0;
  var c = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < c.length; i++) if (String(c[i][0]).toLowerCase() === clave) return i + 2;
  return 0;
}
/* Aprende de un mensaje de la persona (suave: solo cuenta señales) y devuelve el perfil vigente. Lo que no se pueda guardar no tumba la respuesta. */
function estiloAprender_(clave, rol, texto) {
  clave = String(clave || '').toLowerCase().trim(); if (!clave) return null;
  var sh = hojaCrear_('Perfiles de estilo', ESTILO_CAB_), fila = estiloFila_(sh, clave);
  var r = fila ? sh.getRange(fila, 1, 1, ESTILO_CAB_.length).getValues()[0] : null, t = String(texto || '');
  var cuentas = adaptJ_(r && r[6], { acento: {}, modismos: {}, jerga: {} }), fijado = r && /^s[ií]$/i.test(String(r[5]));
  if (!fijado) {
    Object.keys(ESTILO_ACENTOS_).forEach(function (k) { var m = t.match(new RegExp(ESTILO_ACENTOS_[k].source, 'gi')); if (m) { cuentas.acento[k] = (cuentas.acento[k] || 0) + 1; m.slice(0, 3).forEach(function (w) { w = w.toLowerCase().replace(/^[^a-záéíóúñ]+/, ''); cuentas.modismos[w] = (cuentas.modismos[w] || 0) + 1; }); } });
    Object.keys(ESTILO_JERGA_).forEach(function (k) { if (ESTILO_JERGA_[k].test(t)) cuentas.jerga[k] = (cuentas.jerga[k] || 0) + 1; });
  }
  var vistas = function (o) { return Object.keys(o).filter(function (k) { return o[k] >= ESTILO_MIN_; }).sort(function (a, b) { return o[b] - o[a]; }); };
  var acento = vistas(cuentas.acento)[0] || '', modismos = vistas(cuentas.modismos).slice(0, 6).join(', '), jerga = vistas(cuentas.jerga).slice(0, 2).join(', ');
  if (r && fijado) { acento = String(r[2] || ''); modismos = String(r[3] || ''); jerga = String(r[4] || ''); }
  else if (r) {   // lo que Juan reescribió a mano se respeta; solo se completa lo que estaba vacío
    acento = String(r[2] || '') || acento; modismos = String(r[3] || '') || modismos; jerga = String(r[4] || '') || jerga;
  }
  var out = [clave, rol, acento, modismos, jerga, r ? r[5] : '', JSON.stringify(cuentas), new Date().toISOString()];
  if (fila) sh.getRange(fila, 1, 1, out.length).setValues([out]); else sh.appendRow(out);
  return { acento: acento, modismos: modismos, jerga: jerga };
}
/* Bloque del prompt: solo si hay señales claras y Juan no las apagó con «NO USAR». */
function estiloBloque_(clave, rol, texto) {
  var e; try { e = estiloAprender_(clave, rol, texto); } catch (x) { return ''; }
  if (!e) return '';
  var apagado = function (v) { return /^no usar$/i.test(String(v).trim()); };
  var partes = [];
  if (e.acento && !apagado(e.acento)) partes.push('su acento/idioma es ' + e.acento + ' (entiéndelo y, con tacto, acércate a él)');
  if (e.modismos && !apagado(e.modismos)) partes.push('modismos que usa: ' + e.modismos + ' (puedes usarlos de vez en cuando, sin burlarte ni exagerar)');
  if (e.jerga && !apagado(e.jerga)) partes.push('habla con la jerga de ' + e.jerga + ' (usa sus términos con precisión)');
  if (!partes.length) return '';
  return '\n\nESTILO DE ESTA PERSONA (aprendido de sus mensajes): ' + partes.join('; ') + '. Tu personalidad base, tus reglas, datos y permisos siguen intactos: esto solo ajusta cómo suenas.';
}
