/* ═══ MEMORIA DE CADA PROPIEDAD ════════════════════════════════════════════════════════════════════
   Cuando ALMA pidió ayuda (necesita equipo, urgente) y alguien del equipo le respondió al huésped, casi siempre
   el equipo dio algo que ALMA no sabía: «las tarjetas son para el elevador», «el elevador correcto es el del
   fondo», «suban por las escaleras», «el código cambió». Cada hora ALMA revisa esos casos, extrae solo lo que
   sirve para FUTUROS huéspedes de esa propiedad (o de todo el edificio) y lo guarda aquí. Desde ese momento
   lo usa al responder (va dentro de conocimiento_). Lo temporal vence solo. El equipo también se equivoca
   (un dígito, un nombre): lo que contradice la ficha queda «por confirmar» y solo se activa si se repite. Se ve y se borra desde el chat
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
  /* El nombre puede venir escrito distinto (Brunello/Brunelo, «Apto 905»): coincidencia exacta por palabras o por parecido. */
  var nums = function (t) { return (String(t || '').match(/\d+/g) || []).filter(function (x) { return !/^z?\d$/.test(x); }); }, numsP = nums(propiedad);
  /* Por parecido, pero los números (apartamento, zona) tienen que ser exactos: «705» nunca es «905». */
  var aplica = function (m) { return aplicaA_(m.aplica_a, propiedad) || (bqPuntaje_(m.aplica_a, propiedad).todas && nums(m.aplica_a).every(function (x) { return numsP.indexOf(x) >= 0; })); };
  return memFilas_().filter(function (m) { return (m.estado === 'activa' || m.estado === 'por_confirmar') && (!m.vence || Date.parse(m.vence) > ahora) && aplica(m); });
}
/* Texto para el redactor y el clasificador (se suma a la base de conocimiento). */
function memoriaTexto_(propiedad) {
  if (!propiedad || propiedad === '*') return '';
  var m = memoriaDe_(propiedad); if (!m.length) return '';
  return '## Lo que el equipo enseñó sobre esta propiedad (memoria · lo más reciente manda si contradice la ficha)\n' + m.slice(-25).map(function (x) {
    var cod = /c[oó]digo|clave|contrase|pin\b/i.test(x.tema + ' ' + x.dato) && /\d{3,}/.test(x.dato) && !/locker|caja|buz[oó]n/i.test(x.tema + ' ' + x.dato);
    if (x.estado === 'por_confirmar') return '- [SIN CONFIRMAR: el equipo lo dijo una vez pero no coincide con la ficha; no lo afirmes, usa la ficha y si es clave pide confirmación al equipo] ' + x.dato;
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
  'CÓDIGOS: el código de la PUERTA DEL APARTAMENTO (cerradura digital) cambia con cada reserva: NUNCA lo guardes; sí guarda CÓMO se usa la cerradura (p. ej. «palma sobre el teclado, código y luego el candado»). ' +
  'Los PIN de LOCKERS, cajas de llaves, portones o áreas del edificio suelen ser fijos: guárdalos con su tema («Locker», «Acceso edificio»).\n' +
  'ERROR HUMANO: el equipo escribe rápido y se equivoca en códigos, números, pisos, nombres y contraseñas. Para cada dato exacto (un código, un número, un nombre propio) compáralo con la FICHA y la MEMORIA: ' +
  'si coincide, «confianza»:"alta"; si no aparece en ninguna, «confianza»:"media"; si CONTRADICE la ficha o la memoria, o parece un error de dedo (un dígito cambiado, letras invertidas), «confianza»:"baja" y en «nota» explica qué dice cada fuente. ' +
  'Escribe los nombres tal como deberían ser (corrige errores obvios de ortografía, p. ej. «Brunello» → «Brunelo» si la ficha dice Brunelo).\n' +
  'Devuelve SOLO JSON: {"datos":[{"tema":"Acceso|Elevador|Parqueo|Llegada|Edificio|Wifi|Apartamento|Otro","dato":"frase clara en español, máximo 30 palabras, escrita como hecho","alcance":"apartamento|edificio","temporal":false,"dias":0,"confianza":"alta|media|baja","nota":""}]} o {"datos":[]}';

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
    /* ¿Ya lo sabíamos (aunque escrito distinto)? Si estaba por confirmar, esta segunda vez lo confirma; si ya estaba activo, no se duplica. */
    var igual = memFilas_().filter(function (m) { return (m.estado === 'activa' || m.estado === 'por_confirmar') && aplicaA_(m.aplica_a, propiedad) && bqPuntaje_(d.dato, m.dato).puntaje >= 0.85; })[0];
    if (igual) {
      if (igual.estado === 'por_confirmar' && String(d.confianza) !== 'baja') { sh.getRange(igual.fila, MEM_CAB_.indexOf('estado') + 1).setValue('activa'); out.push({ id: igual.id, dato: igual.dato, confirmado: true }); }
      return;
    }
    var dt = String(d.dato || '');
    var esPuerta = /puerta|cerradura|door|lock/i.test(dt + ' ' + d.tema) && !/locker|caja|buz[oó]n|port[oó]n|garita|edificio|lobby|parqueo|gimnasio|piscina/i.test(dt + ' ' + d.tema);
    if (esPuerta && /\d{4,}/.test(dt.replace(/[\s-]/g, ''))) return;   // código de la puerta del apartamento: cambia con cada reserva, no se guarda
    var estado = String(d.confianza) === 'baja' ? 'por_confirmar' : 'activa';   // lockers y accesos del edificio: fijos, se guardan
    var id = 'mp' + hoy.getTime() + Math.floor(Math.random() * 1000);
    sh.appendRow([id, hoy.toISOString(), propiedad, aplica, String(d.tema || 'Otro'), String(d.dato).trim().slice(0, 300), temporal ? 'sí' : 'no',
      temporal ? new Date(hoy.getTime() + dias * 86400000).toISOString() : '', estado, String(fuente || por || '') + (d.nota ? ' · ' + String(d.nota).slice(0, 200) : ''), String(pregunta || '').slice(0, 800), String(respuesta || '').slice(0, 800)]);
    MEM_CACHE_ = null;
    out.push({ id: id, dato: d.dato, aplica_a: aplica, temporal: temporal, estado: estado });
  });
  MEM_CACHE_ = null;
  return out;
}

/* Cada hora (desde aprender): toda conversación de las últimas 72 h en la que alguien del equipo escribió algo
   nuevo, haya pedido ayuda ALMA o no. Se procesa cada mensaje del equipo una sola vez (marca por conversación). */
function memoriaAprender_() {
  var P = PropertiesService.getScriptProperties(), hechos = {}; try { hechos = JSON.parse(P.getProperty('MEM_HECHOS2') || '{}'); } catch (e) {}
  var limite = Date.now() - 72 * 3600000, guardados = 0, revisados = 0;
  var cand = hubInbox_().filter(function (r) {
    var id = String(r.conv_id || ''), th = Date.parse(r.ultimo_host_ts || '') || 0;
    return id && !/^(op|wa):/.test(id) && r.propiedad && th > limite && th > (hechos[id] || 0);
  }).sort(function (x, y) { return (Date.parse(y.ultimo_host_ts) || 0) - (Date.parse(x.ultimo_host_ts) || 0); });
  for (var i = 0; i < cand.length && revisados < 6; i++) {
    var r = cand[i], id = String(r.conv_id), desde = Math.max(limite, hechos[id] || 0);
    var hc = hiloConv_(id); if (hc.code && hc.code !== 200) continue;
    revisados++;
    var hilo = hc.hilo || [], mios = textosAlma_(String(r.codigo || ''));
    var hum = hilo.filter(function (m) { return m.tipo !== 'guest' && !m.auto && !m.alma && Date.parse(m.created) > desde && String(m.texto || '').trim().length > 20 && !esContencion_(m.texto) && mios.indexOf(String(m.texto).trim()) === -1; });
    hechos[id] = Date.now();
    if (!hum.length) continue;
    var idx = hilo.indexOf(hum[0]), cx = ''; try { cx = ctxConversacion_(hilo, idx).txt; } catch (e) {}
    var preg = hilo.slice(0, idx).filter(function (m) { return m.tipo === 'guest'; }).slice(-3).map(function (m) { return m.texto; }).join('\n');
    var resp = hum.slice(0, 5).map(function (m) { return m.texto; }).join('\n\n');
    guardados += memoriaGuardar_(String(r.propiedad), memoriaExtraer_(String(r.propiedad), preg, resp, cx), String(r.codigo || id), preg, resp).length;
  }
  var o = {}; Object.keys(hechos).sort(function (a, b) { return hechos[b] - hechos[a]; }).slice(0, 800).forEach(function (k) { o[k] = hechos[k]; });
  P.setProperty('MEM_HECHOS2', JSON.stringify(o));
  return guardados;
}

/* Chat operativo: ver, agregar y olvidar. */
function memoriaVer_(propiedad) {
  var m = memoriaDe_(propiedad);
  return { propiedad: propiedad, memoria: m.map(function (x) { return { id: x.id, dato: x.dato, tema: x.tema, aplica_a: x.aplica_a, estado: x.estado === 'por_confirmar' ? 'por confirmar (contradice la ficha)' : 'activo', temporal: x.temporal === 'sí' ? 'hasta ' + String(x.vence).slice(0, 10) : 'permanente', desde: String(x.fecha).slice(0, 10) }; }) };
}
function memoriaOlvidar_(id, por) {
  var f = memFilas_().filter(function (x) { return x.id === String(id); })[0]; if (!f) return { error: 'No existe ese recuerdo: ' + id };
  hojaMem_().getRange(f.fila, MEM_CAB_.indexOf('estado') + 1).setValue('olvidada · ' + String(por || '').slice(0, 40));
  MEM_CACHE_ = null; return { ok: true, olvidado: f.dato };
}

/* Robot: lista resumida y limpieza de PIN guardados antes de la regla. */
function memoriaResumen_() {
  return { ok: true, total: memFilas_().length, items: memFilas_().map(function (m) { return { id: m.id, aplica_a: m.aplica_a, tema: m.tema, estado: m.estado, dato: m.dato }; }) };
}
function memoriaLimpiarPins_() {
  var sh = hojaMem_(), n = 0;
  memFilas_().forEach(function (m) {
    if (m.estado.indexOf('activa') !== 0 && m.estado !== 'por_confirmar') return;
    var t = m.dato + ' ' + m.tema, puerta = /puerta|cerradura|door|lock/i.test(t) && !/locker|caja|buz[oó]n|port[oó]n|garita|edificio|lobby|parqueo/i.test(t);
    if (puerta && /\d{4,}/.test(m.dato.replace(/[\s-]/g, ''))) { sh.getRange(m.fila, MEM_CAB_.indexOf('estado') + 1).setValue('descartada · código de puerta de una reserva'); n++; }
  });
  MEM_CACHE_ = null; return { ok: true, descartados: n };
}
