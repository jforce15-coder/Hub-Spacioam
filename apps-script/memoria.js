/* ═══ MEMORIA DE CADA PROPIEDAD ════════════════════════════════════════════════════════════════════
   Cuando ALMA pidió ayuda (necesita equipo, urgente) y alguien del equipo le respondió al huésped, casi siempre
   el equipo dio algo que ALMA no sabía: «las tarjetas son para el elevador», «el elevador correcto es el del
   fondo», «suban por las escaleras», «el código cambió». Cada hora ALMA revisa esos casos, extrae solo lo que
   sirve para FUTUROS huéspedes de esa propiedad (o de todo el edificio) y lo guarda aquí. Desde ese momento
   lo usa al responder (va dentro de conocimiento_). Lo temporal vence solo. Se ve y se borra desde el chat
   operativo («¿qué sabes de Brunelo 905?», «olvida lo del elevador»). */
var MEM_CAB_ = ['id', 'fecha', 'propiedad', 'aplica_a', 'tema', 'dato', 'temporal', 'vence', 'estado', 'fuente', 'pregunta', 'respuesta_equipo'];
function hojaMem_() { return hojaCrear_('ALMA_MEMORIA_PROP', MEM_CAB_); }
var MEM_CACHE_ = null;
function memFilas_() {
  if (MEM_CACHE_) return MEM_CACHE_;
  var sh = hojaMem_(), n = sh.getLastRow(); if (n < 2) return (MEM_CACHE_ = []);
  return (MEM_CACHE_ = sh.getRange(2, 1, n - 1, MEM_CAB_.length).getValues().map(function (r, i) { var o = { fila: i + 2 }; MEM_CAB_.forEach(function (k, j) { o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j] == null ? '' : r[j]); }); return o; }));
}
/* «Z10 - Brunelo - 905» → edificio «Z10 - Brunelo». */
function memEdificio_(propiedad) { var p = String(propiedad || '').split(/\s+-\s+/); return p.length >= 3 ? p.slice(0, 2).join(' - ') : String(propiedad || ''); }
function memoriaDe_(propiedad) {
  var ahora = Date.now();
  return memFilas_().filter(function (m) { return m.estado === 'activa' && (!m.vence || Date.parse(m.vence) > ahora) && aplicaA_(m.aplica_a, propiedad); });
}
/* Texto para el redactor y el clasificador (se suma a la base de conocimiento). */
function memoriaTexto_(propiedad) {
  if (!propiedad || propiedad === '*') return '';
  var m = memoriaDe_(propiedad); if (!m.length) return '';
  return '## Lo que el equipo enseñó sobre esta propiedad (memoria · lo más reciente manda si contradice la ficha)\n' + m.slice(-25).map(function (x) {
    var cod = /c[oó]digo|clave|contrase/i.test(x.tema + ' ' + x.dato) && /\d{3,}/.test(x.dato);
    return '- ' + (cod ? '[ACCESO: compártelo solo cuando las reglas de códigos lo permitan] ' : '') + x.dato + (x.temporal === 'sí' ? ' (temporal, hasta ' + String(x.vence).slice(0, 10) + ')' : '') + ' · ' + String(x.fecha).slice(0, 10);
  }).join('\n');
}

var MEM_PROMPT_ = 'Eres la memoria de ALMA, la asistente de Spacio AM (alojamientos en Guatemala). Recibes un caso en el que ALMA pidió ayuda y una persona del equipo le respondió al huésped. ' +
  'Tu trabajo: extraer SOLO lo que el equipo enseñó sobre la PROPIEDAD o el EDIFICIO y que servirá para atender a FUTUROS huéspedes, y que ALMA no tenía (no está en la ficha ni en la memoria actual).\n' +
  'Ejemplos de lo que SÍ se guarda: «las tarjetas que están en el apartamento son para el elevador»; «el elevador correcto es el de la torre B»; «los huéspedes suelen bajar en el sótano equivocado: el parqueo es en el S2»; ' +
  '«para llegar hay que subir por las escaleras del fondo»; «el código correcto de la puerta es 2328»; «el agua caliente tarda 2 minutos en salir»; «el elevador está en mantenimiento esta semana» (temporal).\n' +
  'NO se guarda: nada propio de esta reserva o de este huésped (hora de llegada, permisos puntuales, early/late check-out concedido, cobros, descuentos, nombres, quejas personales), cortesías, saludos, disculpas, ' +
  'promesas de seguimiento, ni lo que ya dice la ficha o la memoria. Si dudas, no lo guardes.\n' +
  'alcance: «edificio» si aplica a todos los apartamentos del edificio (lobby, elevadores, parqueo, garita, normas del edificio); «apartamento» si es de esta unidad.\n' +
  'temporal: true si es algo pasajero (obra, corte, mantenimiento, cambio por unos días), con «dias» estimados de vigencia.\n' +
  'Devuelve SOLO JSON: {"datos":[{"tema":"Acceso|Elevador|Parqueo|Llegada|Edificio|Wifi|Apartamento|Otro","dato":"frase clara en español, máximo 30 palabras, escrita como hecho","alcance":"apartamento|edificio","temporal":false,"dias":0}]} o {"datos":[]}';

function memoriaExtraer_(propiedad, pregunta, respuesta, conversacion) {
  var actual = memoriaTexto_(propiedad), ficha = '';
  try { ficha = String(infoPropiedad_(propiedad, 'es') || '').slice(0, 6000); } catch (e) {}
  var txt = claude_(CFG.MODELO_REDACTOR, 700, MEM_PROMPT_,
    'PROPIEDAD: ' + propiedad + '\n\nFICHA ACTUAL:\n' + (ficha || '(sin ficha)') + '\n\nMEMORIA ACTUAL:\n' + (actual || '(vacía)') +
    (conversacion ? '\n\nCONVERSACIÓN (lo más reciente al final):\n' + String(conversacion).slice(-4000) : '') +
    '\n\nLO QUE PREGUNTÓ EL HUÉSPED:\n' + String(pregunta || '').slice(0, 1500) + '\n\nLO QUE RESPONDIÓ EL EQUIPO:\n' + String(respuesta || '').slice(0, 2000), 0);
  try { var j = JSON.parse(String(txt).match(/\{[\s\S]*\}/)[0]); return (j.datos || []).filter(function (d) { return d && d.dato && String(d.dato).trim().length > 8; }).slice(0, 4); } catch (e) { return []; }
}
function memoriaGuardar_(propiedad, datos, fuente, pregunta, respuesta, por) {
  if (!datos || !datos.length) return [];
  var sh = hojaMem_(), hoy = new Date(), out = [];
  datos.forEach(function (d) {
    var temporal = !!d.temporal, dias = Math.max(1, Math.min(90, Number(d.dias) || 7));
    var aplica = String(d.alcance) === 'edificio' ? memEdificio_(propiedad) : propiedad;
    var id = 'mp' + hoy.getTime() + Math.floor(Math.random() * 1000);
    sh.appendRow([id, hoy.toISOString(), propiedad, aplica, String(d.tema || 'Otro'), String(d.dato).trim().slice(0, 300), temporal ? 'sí' : 'no',
      temporal ? new Date(hoy.getTime() + dias * 86400000).toISOString() : '', 'activa', String(fuente || por || ''), String(pregunta || '').slice(0, 800), String(respuesta || '').slice(0, 800)]);
    out.push({ id: id, dato: d.dato, aplica_a: aplica, temporal: temporal });
  });
  MEM_CACHE_ = null;
  return out;
}

/* Cada hora (desde aprender): casos de las últimas 72 h donde ALMA pidió ayuda y el equipo respondió. */
function memoriaAprender_() {
  var P = PropertiesService.getScriptProperties(), hechos = {}; try { hechos = JSON.parse(P.getProperty('MEM_HECHOS') || '{}'); } catch (e) {}
  var sh = hoja_(CFG.TAB_LOG); if (!sh || sh.getLastRow() < 2) return 0;
  var n = sh.getLastRow(), desde = Math.max(2, n - 400), cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toLowerCase(); });
  var v = sh.getRange(desde, 1, n - desde + 1, cab.length).getValues(), c = function (k) { return cab.indexOf(k); };
  var limite = Date.now() - 72 * 3600000, hechosN = 0, revisados = 0;
  for (var i = v.length - 1; i >= 0 && revisados < 8; i--) {
    var r = v[i], resId = String(r[c('reservation_id')] || ''), niv = String(r[c('nivel')] || ''), acc = String(r[c('accion')] || '');
    var t = archivoFecha_(r[c('fecha')]); if (!resId || !t || t < limite) continue;
    if (!/AMARILLO|ROJO/.test(niv) && !/escal|necesita|contenci/i.test(acc)) continue;
    var key = resId + '|' + t; if (hechos[key]) continue;
    revisados++;
    var hc = hiloConv_(resId); if (hc.code && hc.code !== 200) continue;
    var hilo = hc.hilo || [], codigo = String(r[c('codigo')] || ''), mios = textosAlma_(codigo);
    var hum = hilo.filter(function (m) { return m.tipo !== 'guest' && !m.auto && !m.alma && Date.parse(m.created) > t && String(m.texto || '').trim() && !esContencion_(m.texto) && mios.indexOf(String(m.texto).trim()) === -1; });
    if (!hum.length) { if (Date.now() - t > 24 * 3600000) hechos[key] = Date.now(); continue; }   // aún nadie respondió: se revisa luego
    hechos[key] = Date.now();
    var prop = String(r[c('propiedad')] || ''); if (!prop) continue;
    var idx = hilo.indexOf(hum[0]), cx = ''; try { cx = ctxConversacion_(hilo, idx).txt; } catch (e) {}
    var preg = String(r[c('pregunta')] || '') || hilo.slice(0, idx).filter(function (m) { return m.tipo === 'guest'; }).slice(-3).map(function (m) { return m.texto; }).join('\n');
    var resp = hum.slice(0, 4).map(function (m) { return m.texto; }).join('\n\n');
    var datos = memoriaExtraer_(prop, preg, resp, cx);
    hechosN += memoriaGuardar_(prop, datos, codigo || resId, preg, resp).length;
  }
  var ks = Object.keys(hechos).sort(function (a, b) { return hechos[b] - hechos[a]; }).slice(0, 600), o = {}; ks.forEach(function (k) { o[k] = hechos[k]; });
  P.setProperty('MEM_HECHOS', JSON.stringify(o));
  return hechosN;
}

/* Chat operativo: ver, agregar y olvidar. */
function memoriaVer_(propiedad) {
  var m = memoriaDe_(propiedad);
  return { propiedad: propiedad, memoria: m.map(function (x) { return { id: x.id, dato: x.dato, tema: x.tema, aplica_a: x.aplica_a, temporal: x.temporal === 'sí' ? 'hasta ' + String(x.vence).slice(0, 10) : 'permanente', desde: String(x.fecha).slice(0, 10) }; }) };
}
function memoriaOlvidar_(id, por) {
  var f = memFilas_().filter(function (x) { return x.id === String(id); })[0]; if (!f) return { error: 'No existe ese recuerdo: ' + id };
  hojaMem_().getRange(f.fila, MEM_CAB_.indexOf('estado') + 1).setValue('olvidada · ' + String(por || '').slice(0, 40));
  MEM_CACHE_ = null; return { ok: true, olvidado: f.dato };
}
