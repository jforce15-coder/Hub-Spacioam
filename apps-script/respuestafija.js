/* ═══ REGLAS FIJAS DE LA RESPUESTA AL HUÉSPED (21-nov-2026) ══════════════════════════════════════════════════════════════
   Juan reprocesó 4 consultas atrasadas (4-5 días) y se vieron tres fallas que el prompt no frena. Aquí van en código, no
   en el prompt (el redactor está cerca de su tope, .github/presupuesto-prompts.json):
   1. Disculpa por la demora. Si el primer mensaje sin responder del huésped tiene más de DISCULPA_HORAS (3 h por omisión),
      el redactor lo sabe (instrucción del turno) y la respuesta debe traer una disculpa breve al inicio. Si no la trae,
      se agrega una frase fija corta en el idioma del huésped, después del saludo.
   2. Datos públicos. El piso (sale del número del apartamento: 404 → piso 4, 623 → piso 6, 1004 → piso 10, o de la
      dirección pública del anuncio) y la referencia pública del anuncio («cerca de…», «a minutos de…») NO son datos
      sensibles; el número de apartamento, los códigos y la dirección exacta sí. La ficha que recibe el redactor los trae.
      Si el huésped pregunta el piso y la ficha lo tiene, la respuesta lo debe decir: el control rechaza y re-redacta una
      vez; si aún falta, se agrega una frase fija.
   3. Precio. Si una consulta pregunta el precio, Alma da la tarifa por noche del calendario de la plataforma (Hospitable)
      para sus fechas, en vez de prometer «lo confirmo con el equipo». El total final (limpieza, comisión, su moneda) lo ve
      en la plataforma al reservar.
   Prueba: .github/consultas-atrasadas.js. */

var DISCULPA_HORAS_DEF_ = 3;
function disculpaHoras_() {
  var h = 0; try { h = Number(PropertiesService.getScriptProperties().getProperty('DISCULPA_HORAS')); } catch (e) {}
  return h > 0 ? h : DISCULPA_HORAS_DEF_;
}
/* Horas desde el primer mensaje sin responder del huésped (el turno pendiente del hilo). 0 si no hay dato. */
function demoraTurnoHoras_(hilo, ahoraMs) {
  var turno = [];
  try { turno = turnoPendiente_(hilo || []).turno || []; } catch (e) { turno = []; }
  var g = turno.filter(function (m) { return m && m.tipo === 'guest'; })[0];
  var t = g ? Date.parse(String(g.created || '')) : NaN;
  return isNaN(t) ? 0 : Math.max(0, ((ahoraMs || Date.now()) - t) / 3600000);
}
function demoraTexto_(horas) {
  return horas >= 48 ? Math.round(horas / 24) + ' días' : horas >= 1 ? Math.round(horas) + ' horas' : Math.round(horas * 60) + ' minutos';
}
function demoraInstruccion_(horas) {
  return '\n· DEMORA (regla fija): el huésped escribió hace ' + demoraTexto_(horas) + ' y apenas le respondemos. Después del saludo, ' +
    'empieza con una disculpa breve por la demora (una sola frase, sin excusas ni explicaciones) y luego responde todo lo que preguntó.';
}
var DISCULPA_RX_ = /disculp|perd[oó]n|lament|sentimos la (demora|tardanza)|sorry|apolog|desculp|excus|d[ée]sol[ée]/i;
var DISCULPA_FRASES_ = {
  es: 'Disculpa la demora en responderte.',
  en: 'Sorry for the delay in getting back to you.',
  pt: 'Desculpe a demora em responder.',
  fr: 'Désolée pour le retard de notre réponse.'
};
function disculpaFrase_(idioma) {
  var l = String(idioma || 'es').slice(0, 2).toLowerCase();
  return DISCULPA_FRASES_[l] || DISCULPA_FRASES_[l === '' ? 'es' : 'en'];
}
function tieneDisculpa_(texto) { return DISCULPA_RX_.test(String(texto || '').slice(0, 260)); }
/* Saludo al inicio («Hola, Daniel 🙏», «Hi Anna,»): la disculpa va después de él. Una primera línea corta que empieza con
   saludo es el saludo entero; si no, el saludo y el nombre hasta la coma. */
var SALUDO_PAL_ = '(?:hola|buen[oa]s?(?: d[ií]as| tardes| noches)?|hi|hello|hey|good (?:morning|afternoon|evening)|ol[aá]|bonjour|salut)';
var SALUDO_RX_ = new RegExp('^' + SALUDO_PAL_ + '(?![\\p{L}])', 'iu');
var SALUDO_NOMBRE_RX_ = /^(?:,?\s+\p{Lu}\p{L}*(?:\s\p{Lu}\p{L}*)?)?\s*[,!.]?/u;   // el nombre (con mayúscula) que sigue al saludo
function conDisculpa_(texto, idioma) {
  var t = String(texto || '').trim(); if (!t || tieneDisculpa_(t)) return t;
  var frase = disculpaFrase_(idioma);
  if (!SALUDO_RX_.test(t)) return frase + '\n\n' + t;
  var linea = t.split('\n')[0], saludo, resto;
  if (linea.trim().length <= 45 && t.indexOf('\n') > 0) { saludo = linea.trim(); resto = t.slice(linea.length).trim(); }
  else { var g = t.match(SALUDO_RX_)[0]; saludo = (g + (t.slice(g.length).match(SALUDO_NOMBRE_RX_) || [''])[0]).trim(); resto = t.slice(saludo.length).replace(/^[\s,]+/, ''); resto = resto.charAt(0).toUpperCase() + resto.slice(1); }
  if (/[\p{L}]$/u.test(saludo)) saludo += ',';
  return saludo + '\n\n' + frase + (resto ? '\n\n' + resto : '');
}

/* ── Piso y referencia pública ── */
/* El número del apartamento sale del nombre interno («Z10 - Fiamene - 404»): 3 cifras → la primera, 4 cifras → las dos
   primeras; «8F» → 8. Sin número claro, nada (mejor no decir que inventar). */
function pisoDeUnidad_(propiedad) {
  var partes = String(propiedad || '').split(/\s+[-–·|]\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  var u = String(partes.length >= 3 ? partes[partes.length - 1] : '').replace(/^(apto|apt|apartamento|unidad|unit)\.?\s*/i, '').trim();
  var m = u.match(/^(\d{3,4})[a-z]?$/i);
  if (m) { var n = m[1], p = n.length === 3 ? n.slice(0, 1) : n.slice(0, 2); p = String(Number(p)); return p === '0' ? '' : p; }
  m = u.match(/^(\d{1,2})[a-z]$/i);
  return m && Number(m[1]) > 0 ? String(Number(m[1])) : '';
}
/* «Apartamento 1004, piso 10, …» o «3er piso» en la dirección pública del anuncio. */
function pisoDeDireccion_(dir) {
  var s = String(dir || ''), m = s.match(/\b(?:piso|nivel|floor|level)\s*(?:n[uú]mero\s*|#\s*)?(\d{1,2})\b/i) || s.match(/\b(\d{1,2})\s*(?:º|°|o|er|do|ro|to|vo|no|mo|th|st|nd|rd)?\.?\s*(?:piso|nivel|floor)\b/i);
  return m && Number(m[1]) > 0 ? String(Number(m[1])) : '';
}
function pisoPublico_(propiedad, prop) {
  var a = (prop && prop.address) || {};
  return pisoDeDireccion_([a.display, a.number, a.street].filter(Boolean).join(' ')) || pisoDeUnidad_(propiedad);
}
/* Referencia pública: lo que el anuncio ya dice de la ubicación («a minutos de…», «cerca de…»), sin calles ni números
   de unidad. Nombre público del anuncio + hasta 2 frases. */
var REF_RX_ = /\b(cerca|a pasos|a (?:solo |unos? )?(?:\d{1,2} )?minutos|junto a|frente a|a una cuadra|rodead[oa]|near|close to|walking distance|steps (?:from|away)|minutes (?:from|away))\b/i;
function referenciaPublica_(prop, propiedad) {
  if (!prop) return '';
  var unidad = (String(propiedad || '').match(/(\d{3,4})\s*$/) || [])[1] || '';
  var limpia = function (s) { return !/\d{3,}|\b\d+[a-z]?\s*(calle|avenida|av\.|ave)\b|\b(calle|avenida)\s*\d/i.test(s) && (!unidad || s.indexOf(unidad) < 0); };
  var out = [], nom = String(prop.public_name || '').trim();
  if (nom && limpia(nom)) out.push('Nombre del anuncio: ' + nom);
  var frases = String([prop.summary, prop.description].filter(Boolean).join(' ')).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  frases.filter(function (f) { return REF_RX_.test(f) && f.length <= 220 && limpia(f); }).slice(0, 2).forEach(function (f) { out.push(f.replace(/^[^\p{L}]+/u, '').trim()); });
  return out.join(' · ');
}
/* Líneas que se suman a la ficha del redactor (antes de aplicarSinConfirmar_, que conserva «Piso:» y «Referencia pública:»). */
function fichaPublicaLineas_(info, propiedad, prop) {
  info = String(info || ''); var L = [];
  var piso = pisoPublico_(propiedad, prop);
  if (piso && !/^Piso: /m.test(info)) L.push('Piso: ' + piso);
  var ref = referenciaPublica_(prop, propiedad);
  if (ref) L.push('Referencia pública: ' + ref);
  return L.length ? '\n' + L.join('\n') : '';
}

/* ── Precio desde el calendario de la plataforma ── */
var PRECIO_PREGUNTA_RX_ = /precio|costo|cu[aá]nto (cuesta|sale|cobran|es|ser[ií]a|me sale)|tarifa|quetzal|d[oó]lar|\bq\s?\d|\$\s?\d|\bprice|\bcost\b|how much|\brate\b|pre[çc]o|quanto custa|\bprix\b/i;
function preguntaPrecio_(t) { return PRECIO_PREGUNTA_RX_.test(String(t || '')); }
/* Tarifa por noche del calendario de Hospitable para esas noches: { total, texto } o null. Cache 30 min. */
function tarifaFechas_(propId, ci, co) {
  if (!propId || !/^\d{4}-\d{2}-\d{2}$/.test(ci || '') || !/^\d{4}-\d{2}-\d{2}$/.test(co || '') || co <= ci) return null;
  var cache = null, k = 'tarifa_' + propId + ci + co;
  try { cache = CacheService.getScriptCache(); var c0 = cache.get(k); if (c0) return JSON.parse(c0); } catch (e) {}
  var fin = new Date(co + 'T12:00:00Z'); fin.setUTCDate(fin.getUTCDate() - 1);
  var r = hosp_('get', '/properties/' + propId + '/calendar?start_date=' + ci + '&end_date=' + fin.toISOString().slice(0, 10));
  if (!r || r.code !== 200) return null;
  var d = (r.json && r.json.data) || {}, dias = d.days || (Array.isArray(d) ? d : []);
  var precios = dias.map(function (x) { return x && x.price; }).filter(function (p) { return p && Number(p.amount) > 0; });
  if (!precios.length || precios.length !== dias.length) return null;
  var mon = precios[0].currency || '', suma = precios.reduce(function (n, p) { return n + Number(p.amount); }, 0) / 100;
  var fmt = function (n) { return (mon === 'USD' ? '$' : mon + ' ') + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, ''); };
  var am = precios.map(function (p) { return Number(p.amount); }), min = Math.min.apply(null, am), max = Math.max.apply(null, am);
  var noches = precios.length, porNoche = min === max ? fmt(min / 100) : fmt(min / 100) + '–' + fmt(max / 100);
  var out = { total: fmt(suma), noches: noches, moneda: mon, porNoche: porNoche, montos: [fmt(suma), fmt(min / 100), fmt(max / 100)],
    texto: porNoche + ' por noche (' + fmt(suma) + ' por ' + noches + (noches === 1 ? ' noche' : ' noches') + ', tarifa del calendario de la plataforma, sin limpieza ni comisión de la plataforma)' };
  try { if (cache) cache.put(k, JSON.stringify(out), 1800); } catch (e) {}
  return out;
}
function precioInstruccion_(tarifa) {
  return '\n· PRECIO (regla fija): pregunta el precio. Tarifa para sus fechas: ' + tarifa.texto + '. Díselo con esa cifra y aclara que el total final ' +
    '(limpieza, comisión de la plataforma y su moneda) lo ve en la plataforma al reservar. PROHIBIDO decir que lo confirmas con el equipo o que le escribimos después.';
}

/* ── Control fijo (código) de la respuesta ya redactada ── */
var PISO_PREGUNTA_RX_ = /\b(piso|nivel|planta|floor|level|stor(e)?y|andar)\b/i;
var ORDINALES_ = { 1: 'primer|first', 2: 'segundo|second', 3: 'tercer|third', 4: 'cuarto|fourth', 5: 'quinto|fifth', 6: 'sexto|sixth', 7: 's[eé]ptimo|seventh', 8: 'octavo|eighth', 9: 'noveno|ninth', 10: 'd[eé]cimo|tenth' };
function textoDicePiso_(texto, piso) {
  var t = String(texto || ''), n = String(piso || ''); if (!n) return true;
  var rx = new RegExp('\\b(piso|nivel|planta|floor|level|andar)\\s*(n[uú]mero\\s*|#\\s*)?' + n + '\\b|\\b' + n + '\\s*(º|°|o|er|do|ro|to|vo|no|mo|th|st|nd|rd)?\\.?\\s*(piso|nivel|planta|floor|level|andar)\\b' +
    (ORDINALES_[n] ? '|\\b(' + ORDINALES_[n] + ')o?\\s+(piso|nivel|planta|floor|level|andar)\\b' : ''), 'i');
  return rx.test(t);
}
var PROMESA_PRECIO_RX_ = /(precio|tarifa|costo|price|rate)[^.\n]{0,80}(lo |la )?(confirmo|confirmamos|reviso|consulto|te (escribimos|confirmamos|aviso|avisamos)|we('ll| will)|get back)|(confirmo|confirmamos|consulto)[^.\n]{0,40}(precio|tarifa|costo|price)/i;
/* ctx: { texto (lo que preguntó), pisoPublico, tarifa, demoraHoras }. Devuelve la lista de faltas (vacía = bien). */
function controlRespuesta_(ctx, texto) {
  ctx = ctx || {}; var f = [], preg = String(ctx.texto || '');
  if (ctx.demoraHoras >= disculpaHoras_() && !tieneDisculpa_(texto)) f.push({ k: 'disculpa', m: 'respondemos ' + demoraTexto_(ctx.demoraHoras) + ' tarde y la respuesta no empieza con una disculpa breve por la demora' });
  if (ctx.pisoPublico && PISO_PREGUNTA_RX_.test(preg) && !textoDicePiso_(texto, ctx.pisoPublico)) f.push({ k: 'piso', m: 'preguntó el piso y la ficha lo tiene (piso ' + ctx.pisoPublico + '): dilo. El piso sí se puede compartir' });
  if (ctx.tarifa && preguntaPrecio_(preg) && (!tarifaDicha_(texto, ctx.tarifa) || PROMESA_PRECIO_RX_.test(texto)))
    f.push({ k: 'precio', m: 'preguntó el precio: da la tarifa de la plataforma (' + ctx.tarifa.texto + ') en vez de prometer confirmarlo' });
  return f;
}
function tarifaDicha_(texto, tarifa) {
  var t = String(texto || '');
  return (tarifa.montos || [tarifa.total]).some(function (m) { var n = String(m).replace(/[^\d.]/g, ''); return n && new RegExp('(^|[^\\d.])' + n.replace('.', '\\.') + '(?![\\d])').test(t); });
}
function controlCorreccion_(faltas) { return 'Control fijo: ' + faltas.map(function (x) { return x.m; }).join('; ') + '.'; }
var PISO_FRASES_ = { es: 'El apartamento está en el piso {n}.', en: 'The apartment is on floor {n}.', pt: 'O apartamento fica no {n}º andar.', fr: "L'appartement est au {n}e étage." };
var PRECIO_FRASES_ = { es: 'La tarifa en la plataforma para tus fechas es de {p} por noche ({t} por {n} noche{s}). El total final, con limpieza y comisión, lo ves en la plataforma al reservar.',
  en: 'The platform rate for your dates is {p} per night ({t} for {n} night{s}). You will see the final total, with cleaning and platform fees, on the platform when you book.' };
var PROMESA_PRECIO_FRASE_RX_ = /[^.!?\n]*\b(precio|tarifa|costo|price|rate)\b[^.!?\n]*\b(confirmo|confirmamos|consulto|reviso|te escribimos|te aviso|we('ll| will)|get back)\b[^.!?\n]*[.!?]?/gi;
/* Lo que sigue faltando después de re-redactar se arregla con una frase fija (idempotente). */
function respuestaFija_(ctx, texto) {
  var t = String(texto || '').trim(); if (!t) return t;
  var l = String((ctx && ctx.idioma) || 'es').slice(0, 2).toLowerCase(), faltas = controlRespuesta_(ctx, t);
  faltas.forEach(function (x) {
    if (x.k === 'piso') t = t + '\n\n' + (PISO_FRASES_[l] || PISO_FRASES_.en).replace('{n}', ctx.pisoPublico);
    if (x.k === 'precio') t = t.replace(PROMESA_PRECIO_FRASE_RX_, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n\n' +
      (PRECIO_FRASES_[l] || PRECIO_FRASES_.en).replace('{p}', ctx.tarifa.porNoche).replace('{t}', ctx.tarifa.total).replace('{n}', ctx.tarifa.noches).replace('{s}', ctx.tarifa.noches === 1 ? '' : 's');
  });
  if (faltas.some(function (x) { return x.k === 'disculpa'; })) t = conDisculpa_(t, l);
  return t;
}
/* Datos para el control y la instrucción del turno, sobre el ctx del redactor (contexto_). */
function respuestaFijaPreparar_(ctx, hilo) {
  if (!ctx) return ctx;
  try { ctx.demoraHoras = demoraTurnoHoras_(hilo); } catch (e) { ctx.demoraHoras = 0; }
  if (ctx.demoraHoras >= disculpaHoras_()) ctx.instrucciones = (ctx.instrucciones || '') + demoraInstruccion_(ctx.demoraHoras);
  var m = String(ctx.propiedadInfo || '').match(/^Piso: \D{0,20}?(\d{1,2})\b/m);
  ctx.pisoPublico = m ? String(Number(m[1])) : (/^Piso: /m.test(String(ctx.propiedadInfo || '')) ? '' : pisoDeUnidad_(ctx.propiedad));
  if (!ctx.reservaConfirmada && preguntaPrecio_(ctx.texto) && ctx.propId) {
    try { ctx.tarifa = tarifaFechas_(ctx.propId, ctx.checkin, ctx.checkout); } catch (e) { ctx.tarifa = null; }
    if (ctx.tarifa) ctx.instrucciones = (ctx.instrucciones || '') + precioInstruccion_(ctx.tarifa);
  }
  return ctx;
}
