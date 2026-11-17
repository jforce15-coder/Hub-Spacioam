/* ═══ FICHA DEL SOCIO Y DETALLES QUE IMPORTAN (#522 · T1 y T2) ══════════════════════════════════════════════════════
   Juan (14-nov-2026): «Cada socio debe tener su ficha que vamos a ir armando conforme transcurran las conversaciones…
   recordar cosas que para ellos son importantes… y cada que sea conveniente iniciar la conversación como: ¿cómo estás?
   Espero que todo haya salido bien con la boda de tu hija.»
   · Dónde vive: en Mi (op «fichaSocio» de su Apps Script, con la llave del robot; un libro privado de Mi, porque la hoja de
     Mi se lee pública). Aquí no se guarda nada: solo una copia de 5 min en caché. Juan la ve, corrige y borra en Mi
     (pestaña Socios) o pidiéndoselo a Alma (herramienta ficha_socio).
   · Nota: algo del socio que sirve para tratarlo (cómo prefiere que le escriban, que habla inglés). Detalle que importa:
     algo personal que él contó (un evento, un viaje, la boda de su hija), con su fecha si la dijo.
   · Solo con socios (fichaSocioDe_: socios.js; nunca un huésped, alguien del equipo o un externo) y solo lo que el socio
     contó: lo nuevo tiene que compartir palabras con lo que él escribió o dijo. Nunca salud, religión, política ni datos
     bancarios (FICHA_PROHIBIDO_, la misma lista que Mi; Mi también la revisa).
   · Cómo se arma, sin otra llamada a la IA: en el mismo turno que le contesta al socio. Por WhatsApp, el redactor agrega
     [[FICHA:{…}]] y [[RETOMADO:id]] (se quitan antes de enviar); en un encargo, los campos «ficha» y «retomado» de su JSON.
     En una llamada no hay turno escrito: al terminar, una lectura corta de lo que dijo el socio (modelo del clasificador,
     solo si el cupo de fondo lo permite).
   · Retomar: un detalle con fecha ya pasada (hasta 45 días), no retomado. Va en la ficha que Alma lee al contestarle, al
     llamarle o al escribirle (herramienta ficha_socio), una sola vez: se marca retomado en Mi cuando Alma lo usa (su marca
     o, en la voz y en escribir_a_equipo, porque el texto lo nombra) y ya no vuelve a salir. */

var FICHA_RETOMAR_DIAS_ = 45, FICHA_CACHE_S_ = 300;
/* Lo que nunca se guarda de un socio. Misma lista que Mi (apps-script/fichasocio.js de mi-spacioam): si cambia aquí,
   cambia allá. Cada palabra va entera (ni «Pinula» es «pin» ni «judo» es religión). */
function fichaRx_(alt) { return new RegExp('(?<![a-z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa\\u00f1\\u00fc])(' + alt + ')(?![a-z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa\\u00f1\\u00fc])', 'i'); }
var FICHA_PROHIBIDO_ = [
  ['salud', fichaRx_('salud|enferm\\S*|hospital\\S*|cl[ií]nicas?|m[eé]dic[oa]s?|doctor(a|es)?|diagn[oó]stic\\S*|c[aá]ncer|tumor(es)?|cirug[ií]as?|(lo|la|le|me) (operan|operaron|operar[aá]n)|quimio\\S*|terapias?|psic[oó]log\\S*|psiquiatr\\S*|depresi[oó]n|ansiedad|diabet\\S*|covid|embaraz\\S*|medicamentos?|alergi\\S*|discapacidad|internad[oa]|convalec\\S*')],
  ['religión', fichaRx_('religi[oó]n|religios[oa]s?|iglesias?|misas?|sacerdotes?|templo|mezquita|sinagoga|cat[oó]lic[oa]s?|evang[eé]lic[oa]s?|cristian[oa]s?|jud[ií](o|a|os|as)|musulm[aá]n(a|es|as)?|bautiz\\S*|primera comuni[oó]n|retiro espiritual|rezar|oraci[oó]n')],
  ['política', fichaRx_('pol[ií]tic\\S*|partido pol[ií]tico|elecci[oó]n(es)?|electoral(es)?|vot(o|os|ar|[oó]|aron)|candidat\\S*|diputad[oa]s?|campa[ñn]a electoral')],
  ['datos bancarios', fichaRx_('banc(o|os|aria|arias|ario|arios)|cuenta (de ahorro|monetaria|corriente|bancaria)|n[uú]mero de cuenta|iban|swift|tarjeta de (cr[eé]dito|d[eé]bito)|transferencias?|contrase[ñn]as?|claves?|pin')],
  ['datos bancarios', /\d[\d\s-]{6,}\d/]   // un número largo (cuenta, tarjeta, teléfono) nunca va en la ficha
];
function fichaProhibido_(texto) {
  var t = String(texto == null ? '' : texto);
  for (var i = 0; i < FICHA_PROHIBIDO_.length; i++) if (FICHA_PROHIBIDO_[i][1].test(t)) return FICHA_PROHIBIDO_[i][0];
  return '';
}

/* La puerta de Mi con la llave del robot (como enlacePuerta_). { ok, … } o { ok:false, error }. */
function fichaMi_(op, datos) {
  var url = ACCESOS_APPS_.mi(), llave = llaveRobot_();
  if (!llave) return { ok: false, error: 'falta ROBOT_TOKEN en el Hub' };
  var r = uf_(url, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify(Object.assign({ action: 'fichaSocio', op: op, robot: llave }, datos || {})) }, 'Otras apps');
  try { return JSON.parse(r.getContentText() || '{}'); } catch (e) { return { ok: false, error: 'Mi respondió ' + r.getResponseCode() }; }
}

/* El socio de un número: { correo, tel, nombre, propiedad } o null. Solo socios (socioDe_ ya deja fuera a los
   administradores); el correo es el que Mi tiene para ese número (Control de usuarios). */
function fichaSocioDe_(wa) {
  if (!normTel_(wa)) return null;
  var s = socioSeguro_(wa); if (!s) return null;
  var correo = '', nombre = s.nombre || '';
  try {
    var usr = socioMiUsuarios_(), k = fin8_(wa);
    correo = Object.keys(usr).filter(function (e) { return fin8_(usr[e].tel) === k; })[0] || '';
    if (correo && !nombre) nombre = usr[correo].nombre || '';
  } catch (e) {}
  return { correo: correo, tel: normTel_(wa), nombre: nombre, propiedad: s.propiedad || '' };
}
/* Para la herramienta: el socio que nombra Juan (número, «socio de Narama 633» o su nombre). */
function fichaSocioBuscar_(texto) {
  var t = String(texto || '').trim(); if (!t) return { error: 'Dime de qué socio: su apartamento («socio de Narama 633»), su nombre o su número.' };
  if (String(t).replace(/\D/g, '').length >= 8) return fichaSocioDe_(t) || { error: 'Ese número no es de un socio.' };
  var r = null; try { r = socioDelApartamento_(t); } catch (e) {}
  if (r && r.opciones) return { error: 'Ese texto nombra varios apartamentos: ' + r.opciones.join(' · ') + '. ¿De cuál es el socio?' };
  if (r && r.socios && r.socios.length) {
    var x = r.socios.filter(function (y) { return y.tel; })[0] || r.socios[0];
    var f = x.tel ? fichaSocioDe_(x.tel) : null;
    return f || { correo: String(x.email || '').toLowerCase(), tel: normTel_(x.tel || ''), nombre: x.nombre || '', propiedad: r.propiedad };
  }
  var n = socioNorm_(t.replace(SOCIO_MI_PALABRAS_, ''));
  if (n.length >= 3) {
    var c = []; try { c = contactosTodos_().filter(function (o) { return String(o.tipo) === 'socio' && socioNorm_(o.nombre).indexOf(n) >= 0; }); } catch (e) {}
    if (c.length === 1) return fichaSocioDe_(c[0].tel) || { error: 'No encontré a ese socio en Mi.' };
    if (c.length > 1) return { error: 'Hay varios socios con ese nombre: ' + c.slice(0, 5).map(function (o) { return o.nombre + ' (' + (o.propiedades || '?') + ')'; }).join(' · ') + '. ¿Cuál?' };
  }
  return { error: 'No encontré a ese socio: dime su apartamento («socio de Narama 633») o su número.' };
}

function fichaClave_(s) { return 'ficha1_' + (fin8_(s.tel) || String(s.correo || '').toLowerCase()).slice(0, 120); }
/* Lo que Mi tiene del socio (sin lo borrado). null si Mi no respondió (no es lo mismo que una ficha vacía). */
function fichaVer_(s, fresca) {
  if (!s || (!s.correo && !s.tel)) return null;
  var c = CacheService.getScriptCache(), k = fichaClave_(s), hit = fresca ? null : c.get(k);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var r = fichaMi_('ver', { correo: s.correo, tel: s.tel });
  if (!r || !r.ok) { console.warn('fichaVer_: ' + JSON.stringify(r || {}).slice(0, 200)); return null; }
  var items = (r.items || []).slice(-40);
  try { c.put(k, JSON.stringify(items), FICHA_CACHE_S_); } catch (e) {}
  return items;
}
function fichaOlvidarCache_(s) { try { CacheService.getScriptCache().remove(fichaClave_(s)); } catch (e) {} }

function fichaHoy_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
/* El detalle por retomar: con fecha ya pasada (hasta 45 días), no retomado; el más reciente. */
function fichaParaRetomar_(items, hoy) {
  hoy = hoy || fichaHoy_();
  var desde = new Date(Date.parse(hoy) - FICHA_RETOMAR_DIAS_ * 86400000).toISOString().slice(0, 10);
  return (items || []).filter(function (x) { return x.tipo === 'detalle' && !x.retomado && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha_evento || '') && x.fecha_evento < hoy && x.fecha_evento >= desde; })
    .sort(function (a, b) { return a.fecha_evento < b.fecha_evento ? 1 : -1; })[0] || null;
}

/* Palabras con significado, recortadas a 4 letras («viaje» y «viajó», «hija» e «hijas» coinciden). */
var FICHA_VACIAS_ = ' de del la las el los un una unos unas y o en con por para su sus que se al a es le lo les mi mis tu tus te me muy mas ya socio socia nota detalle evento esta este estos estas pero como todo toda bien tiene tengo hace hizo fue ser estar dijo cuenta prefiere ' +
  'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre lunes martes miercoles jueves viernes sabado domingo semana hoy manana ayer ';
function fichaPalabras_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length >= 4 && FICHA_VACIAS_.indexOf(' ' + w + ' ') < 0; }).map(function (w) { return w.slice(0, 4); });
}
/* ¿El texto de la ficha sale de lo que dijo el socio (o lo nombra lo que dijo Alma)? Al menos una palabra con significado. */
function fichaComparte_(texto, dicho) {
  var a = fichaPalabras_(texto), b = fichaPalabras_(dicho);
  return a.some(function (w) { return b.indexOf(w) >= 0; });
}

/* Anota una nota o un detalle. dicho: lo que escribió o dijo el socio (null = lo pidió Juan, no se compara). */
function fichaAnotar_(s, d, fuente, dicho) {
  d = d || {};
  var texto = String(d.texto || '').replace(/\s+/g, ' ').trim().slice(0, 300), f = String(d.fecha || d.fecha_evento || '').trim();
  var fecha = /^\d{4}-\d{2}-\d{2}$/.test(f) && Math.abs(Date.parse(f) - Date.now()) < 730 * 86400000 ? f : '';
  if (texto.length < 3) return { ok: false, error: 'Falta qué anotar.' };
  var mot = fichaProhibido_(texto); if (mot) return { ok: false, prohibido: mot, error: 'No se anota: es de ' + mot + '.' };
  if (dicho != null && !fichaComparte_(texto, dicho)) return { ok: false, error: 'No sale de lo que dijo el socio.' };
  var tipo = d.tipo === 'detalle' || (!d.tipo && fecha) ? 'detalle' : 'nota';
  var r = fichaMi_('anotar', { correo: s.correo, tel: s.tel, nombre: s.nombre, propiedad: s.propiedad, tipo: tipo, texto: texto, fecha_evento: fecha, fuente: fuente });
  if (r && r.ok) fichaOlvidarCache_(s);
  return r && r.ok ? { ok: true, id: r.id, duplicado: !!r.duplicado } : { ok: false, error: (r && r.error) || 'Mi no respondió.' };
}
function fichaRetomado_(s, id) {
  var r = fichaMi_('retomado', { id: id }); if (r && r.ok) fichaOlvidarCache_(s);
  return !!(r && r.ok);
}
/* Lo que dejó un turno: lo nuevo que contó el socio y si Alma retomó el detalle. */
function fichaGuardarTurno_(s, items, nuevos, retomadoId, fuente, dicho) {
  var out = { anotados: [], rechazados: [], retomado: '' };
  if (!s) return out;
  (Array.isArray(nuevos) ? nuevos : []).slice(0, 3).forEach(function (d) {
    var r = fichaAnotar_(s, d, fuente, dicho);
    if (r.ok) out.anotados.push(r.id); else out.rechazados.push(r.error);
  });
  var rid = String(retomadoId || '').trim();
  if (rid && (items || []).some(function (x) { return x.id === rid && !x.retomado; }) && fichaRetomado_(s, rid)) out.retomado = rid;
  return out;
}

/* Las marcas del redactor: [[FICHA:{"tipo","texto","fecha"}]] y [[RETOMADO:id]]. Devuelve el texto sin ellas. */
function fichaMarcas_(texto) {
  var dets = [], ret = '';
  var t = String(texto || '').replace(/\[\[\s*FICHA\s*:\s*(\{[\s\S]*?\})\s*\]\]/gi, function (m, j) { try { dets.push(JSON.parse(j)); } catch (e) {} return ''; })
    .replace(/\[\[\s*RETOMADO\s*:\s*([A-Za-z0-9_-]+)\s*\]\]/gi, function (m, id) { ret = ret || id; return ''; });
  return { texto: t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), detalles: dets, retomado: ret };
}

/* Conectar con el socio (Juan, 17-nov-2026: «que use la información personal de los socios para conectar mejor»): más allá
   del detalle por retomar, lo que contó le sirve a Alma para hablarle como alguien que lo conoce. Va en el turno escrito y
   en la llamada, y el Modo Weebo (weebo.js) lo toma como su mejor gancho. */
var FICHA_CONECTAR_ = 'CONECTA: cuando venga al caso, nombra algo suyo de la ficha como lo haría alguien que lo conoce (su idioma, un gusto, su viaje, su familia): una vez por conversación, en una frase y de vuelta al tema. Nunca en una queja, una urgencia ni para rellenar.';

/* Lo que Alma lee del socio en un turno escrito. modo «marca» (el redactor de WhatsApp) o «json» (un encargo). */
function fichaBloque_(s, items, modo, hoy) {
  hoy = hoy || fichaHoy_();
  var ret = fichaParaRetomar_(items, hoy), json = modo === 'json';
  var lineas = (items || []).slice(-15).map(function (x) { return '· [' + x.id + '] ' + (x.tipo === 'detalle' ? 'Detalle' : 'Nota') + ': ' + x.texto + (x.fecha_evento ? ' (' + x.fecha_evento + ')' : '') + (x.retomado ? ' · ya retomado' : ''); });
  return 'FICHA DEL SOCIO' + (s.nombre ? ' ' + s.nombre : '') + ' (lo que él te ha contado; úsala con naturalidad y nunca digas que tienes una ficha):\n' + (lineas.join('\n') || '(vacía)') +
    (lineas.length ? '\n' + FICHA_CONECTAR_ : '') +
    (ret ? '\nRETOMAR una sola vez, solo si el tono lo permite (no en una queja ni en una urgencia): al saludar pregúntale con calidez por «' + ret.texto + '» (fue el ' + ret.fecha_evento + '), p. ej. «¿Cómo estás? Espero que todo haya salido muy bien con…». Si lo usas, ' +
      (json ? 'pon "retomado":"' + ret.id + '" en el JSON.' : 'agrega al final [[RETOMADO:' + ret.id + ']].') : '') +
    '\nDETALLE QUE IMPORTA: si en ' + (json ? 'su ÚLTIMO MENSAJE' : 'los MENSAJES A RESPONDER') + ' el socio cuenta algo personal suyo (un evento, un viaje, su familia) o una preferencia, ' +
    (json ? 'agrégalo al JSON en "ficha":[{"tipo":"detalle|nota","texto":"en tercera persona, máx. 15 palabras","fecha":"AAAA-MM-DD del evento o vacío"}]' : 'agrega al final, una por cosa, [[FICHA:{"tipo":"detalle|nota","texto":"en tercera persona, máx. 15 palabras","fecha":"AAAA-MM-DD del evento o vacío"}]]') +
    '. Solo lo que él dijo; nunca salud, religión, política ni datos bancarios. Hoy es ' + hoy + '.';
}

/* WhatsApp de un socio (clasificar_, Código.js): la ficha va en las instrucciones del redactor. '' si no es socio o Mi no
   respondió (el turno sigue igual, sin ficha). */
function fichaTurnoSocio_(ctx) {
  var id = String((ctx && ctx.resId) || ''); if (id.indexOf('wa:') !== 0) return '';
  var s = fichaSocioDe_(id.slice(3)); if (!s) return '';
  var items = fichaVer_(s); if (!items) return '';
  ctx.fichaSocio = { s: s, items: items, vistos: {} };
  return fichaBloque_(s, items, 'marca', String(ctx.hoy || '').slice(0, 10) || null);
}
/* Lo que devolvió el redactor para un socio: guarda lo nuevo (una vez por turno, aunque se redacte dos veces) y devuelve el
   texto sin las marcas. */
function fichaTrasRedactar_(ctx, bruto) {
  var m = fichaMarcas_(bruto), f = ctx && ctx.fichaSocio; if (!f) return m.texto;
  try {
    var nuevos = m.detalles.filter(function (d) { var k = JSON.stringify(d); if (f.vistos[k]) return false; f.vistos[k] = 1; return true; });
    var ret = m.retomado && !f.vistos['ret:' + m.retomado] ? m.retomado : '';
    if (ret) f.vistos['ret:' + ret] = 1;
    if (nuevos.length || ret) fichaGuardarTurno_(f.s, f.items, nuevos, ret, 'whatsapp', ctx.texto || '');
  } catch (e) { console.error('fichaTrasRedactar_: ' + e); }
  return m.texto;
}

/* Alma le escribió a un socio (escribir_a_equipo): si el mensaje nombra el detalle por retomar, queda retomado. */
function fichaTrasEscribir_(tel, texto) {
  var s = fichaSocioDe_(tel); if (!s) return '';
  var ret = fichaParaRetomar_(fichaVer_(s));
  return ret && fichaComparte_(ret.texto, texto) && fichaRetomado_(s, ret.id) ? ret.id : '';
}

/* Llamada con un socio (vozInicio_, voz.js): lo que Alma lee antes de hablar. Sin ids ni marcas (la voz los diría). */
function fichaVozBloque_(tel) {
  var s = fichaSocioDe_(tel); if (!s) return '';
  var items = fichaVer_(s); if (!items || !items.length) return '';
  var ret = fichaParaRetomar_(items);
  return 'FICHA DEL SOCIO (lo que te ha contado; úsala con naturalidad, no la cites): ' + items.slice(-10).map(function (x) { return x.texto + (x.fecha_evento ? ' (' + x.fecha_evento + ')' : ''); }).join(' · ') + '. ' + FICHA_CONECTAR_ +
    (ret ? ' RETOMAR una sola vez, al saludar y solo si el tono lo permite: pregúntale con calidez cómo le fue con «' + ret.texto + '».' : '');
}
/* Después de una llamada con un socio (vozPostCall_): si Alma nombró el detalle por retomar, queda retomado; y lo personal
   que contó el socio se anota. La llamada no tiene un turno escrito donde aprovechar: una lectura corta, solo de lo que
   dijo él y solo si el cupo de fondo lo permite. */
var FICHA_LLAMADA_PROMPT_ = 'Lees lo que dijo un socio de Spacio AM (dueño de un apartamento) en una llamada con Alma. Saca SOLO lo personal que él contó de sí mismo ' +
  '(un evento, un viaje, su familia) o una preferencia para tratarlo (cómo y cuándo prefiere que le escriban, su idioma). Nada de su propiedad, pagos ni pedidos. ' +
  'Nunca salud, religión, política ni datos bancarios. Si dudas, nada. Devuelve SOLO JSON: {"ficha":[{"tipo":"detalle|nota","texto":"en tercera persona, máx. 15 palabras","fecha":"AAAA-MM-DD del evento o vacío"}]}';
function fichaDeLlamada_(tel, transcript) {
  var s = fichaSocioDe_(tel); if (!s) return null;
  var items = fichaVer_(s); if (!items) return null;
  var dichoAlma = (transcript || []).filter(function (m) { return m.role === 'agent'; }).map(function (m) { return String(m.message || ''); }).join('\n');
  var dicho = (transcript || []).filter(function (m) { return m.role === 'user'; }).map(function (m) { return String(m.message || ''); }).join('\n').trim();
  var ret = fichaParaRetomar_(items), out = { anotados: [], rechazados: [], retomado: '' };
  if (ret && fichaComparte_(ret.texto, dichoAlma) && fichaRetomado_(s, ret.id)) out.retomado = ret.id;
  if (dicho.length < 40 || !cupoPermite_('fondo')) return out;
  var j = {};
  try { var raw = String(claude_(CFG.MODELO_CLASIFICADOR, 300, FICHA_LLAMADA_PROMPT_, 'HOY: ' + fichaHoy_() + '\n\nLO QUE DIJO EL SOCIO:\n' + dicho.slice(-3000), 0) || ''); j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { j = {}; }
  var g = fichaGuardarTurno_(s, items, j.ficha, '', 'llamada', dicho);
  out.anotados = g.anotados; out.rechazados = g.rechazados;
  return out;
}

/* Herramienta ficha_socio (agente.js): ver, anotar, corregir o borrar. Solo el administrador principal. fuera (opcional):
   al ver, recibe el socio y su ficha para el tablero de la llamada (tarjeta.js), sin volver a buscarlos. */
function fichaHerramienta_(adm, inp, fuera) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { error: 'Solo el administrador principal ve y cambia la ficha de un socio.' };
  var s = fichaSocioBuscar_(inp.socio); if (s.error) return s;
  var acc = String(inp.accion || 'ver'), quien = s.nombre || s.correo || ('+' + s.tel);
  if (acc === 'anotar') {
    var r = fichaAnotar_(s, { texto: inp.texto, fecha: inp.fecha }, 'chat', null);
    return r.ok ? { ok: true, socio: quien, id: r.id, nota: r.duplicado ? 'Ya estaba en su ficha.' : 'Anotado en su ficha (Mi).' } : { error: r.error };
  }
  if (acc === 'corregir' || acc === 'borrar') {
    if (!inp.id) return { error: 'Falta el id (sale con accion ver).' };
    var d = { id: String(inp.id) };
    if (acc === 'corregir') { if (inp.texto) d.texto = String(inp.texto); if (inp.fecha != null) d.fecha_evento = String(inp.fecha); }
    var r2 = fichaMi_(acc, d); fichaOlvidarCache_(s);
    return r2 && r2.ok ? { ok: true, socio: quien } : { error: (r2 && r2.error) || 'Mi no respondió.' };
  }
  var items = fichaVer_(s, true); if (!items) return { error: 'No pude leer su ficha en Mi ahora.' };
  if (fuera) { fuera.s = s; fuera.items = items; }
  var ret = fichaParaRetomar_(items);
  return { socio: quien, propiedad: s.propiedad, ficha: items.map(function (x) { return { id: x.id, tipo: x.tipo, texto: x.texto, fecha: x.fecha_evento || undefined, retomado: x.retomado ? String(x.retomado).slice(0, 10) : undefined }; }),
    retomar: ret ? 'Al escribirle o llamarle, salúdalo preguntando con calidez por «' + ret.texto + '» (fue el ' + ret.fecha_evento + '). Una sola vez.' : undefined,
    nota: items.length ? undefined : 'Todavía no hay nada en su ficha.' };
}
