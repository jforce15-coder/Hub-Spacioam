/* ═══ RESPUESTA CON FUENTES (#446 T11) ═══════════════════════════════════════════════════════════════════════
   Antes de llamar al equipo por una pregunta sobre la propiedad (TV, camas, cocina, baño, lavandería, clima, escritorio,
   vista, distribución), Alma revisa sus fuentes en este orden y se detiene en la primera que responde claro:
     1. Lo escrito: la ficha (PropiedadesInfo), la base de conocimiento y la memoria, los detalles de Hospitable
        (descripción, cuartos y camas, amenidades) y su knowledge hub. Un modelo rápido, solo texto.
     2. Las fotos del anuncio (Hospitable · /properties/{id}/images, las miniaturas en el orden del anuncio). Quedan
        guardadas 6 h para el tablero de la llamada (tvGuardarFotos_, tarjeta.js). El pedido (fuentesPedirFotos_) es el
        mismo que usa el tablero cuando un apartamento no tiene ninguna foto.
     3. Las fotos de los reportes de limpieza de Epi: hoja «Reportes» de Epi (columna fotosLimpieza, con llaves como
        fotosTv, fotosHabitaciones, fotosSalaGeneral) y los archivos en la carpeta de Drive de Epi. Las más recientes primero.
   En 2 y 3 el modelo con visión del Hub recibe a lo mucho 8 fotos y una pregunta concreta («¿cuántas TV se ven y en qué
   cuarto?»). Solo responde sola si lo que ve es claro y no se contradice; lo que no se ve no prueba que no exista.
   Nunca para dinero, descuentos, reglas, accesos, códigos, daños, quejas ni nada que comprometa al equipo: eso escala
   como siempre (opciones para quien está de turno, decisiones.js).
   Caché y registro: hoja ALMA_FUENTES, una fila por consulta (propiedad, clave como «tv_por_cuarto», respuesta, fuente,
   fotos leídas). Una respuesta clara vale 30 días; una duda, 3 (así no se vuelven a leer las fotos en cada mensaje).
   La fuente queda en la razón del registro (ALMA_LOG) y, si escala, en el motivo del caso. */

var FUENTES_CAB_ = ['ts', 'propiedad', 'clave', 'pregunta', 'estado', 'respuesta', 'fuente', 'detalle', 'fotos', 'vence'];
var FUENTES_MAX_FOTOS_ = 8;
var FUENTES_DIAS_OK_ = 30, FUENTES_DIAS_DUDA_ = 3;
var FUENTES_REPORTES_ = 3;      // reportes de limpieza más recientes que se miran
var FUENTES_EPI_DIAS_ = 120;    // hasta cuántos días atrás se busca un reporte de limpieza

/* Lo que nunca se responde solo, aunque la foto lo muestre: dinero, reglas, accesos, códigos, daños, quejas, compromisos. */
var FUENTES_NUNCA_RE_ = /precio|cu[aá]nto (cuesta|cobra|sale|vale)|cobr[aoe]|\bpag(o|ar|u[eé]|ue)\b|tarifa|costo|descuento|rebaja|reembols|devoluci|dinero|\$|\bq ?\d|dep[oó]sito|regla|\bnormas?\b|permit|se puede|\bpuedo\b|mascota|perr[oa]|fumar|fiesta|evento|visita|acceso|entrar|c[oó]digo|\bclave|contrase|\bpin\b|llave|tarjeta|cerradura|wi-?fi|da[ñn](o|os|ad[oa]s?)\b|rot[oa]s?\b|rompi|quebr|no (funciona|sirve|enciende|prende|calienta|enfr[ií]a)|descompuest|queja|reclam|sucio|mal olor|molest|garant|promet|compens|\bearly\b|\blate\b|check.?(in|out)|cancel|extender|noche (extra|adicional)|price|\bcost|discount|refund|money|\bpay|\brules?\b|allowed|\bpets?\b|smok|party|access|\bcodes?\b|password|\bkeys?\b|broken|damage|not working|complain|dirty|guarantee|extend|\bextras?\b|adicional|tra(er|igan|iga)\b|ll[eé]v(en|ar|e)\b|\bbring|\bmore\b|\banother\b/i;

/* Cada tema: su clave de caché, la pregunta concreta para las fotos y las fotos de limpieza que lo muestran. */
var FUENTES_TEMAS_ = [
  { clave: 'tv_por_cuarto', re: /\b(tv|tvs|tele|teles|televisi[oó]n|televisor(es)?|televisions?|smart ?tv|pantallas?)\b/i,
    pregunta: '¿Cuántos televisores hay y en qué cuarto está cada uno?',
    llaves: ['fotosTv', 'fotosSalaGeneral', 'fotosHabitaciones', 'fotoPisoGeneral', 'fotosPrimeraImpresion', 'fotosSillon'] },
  { clave: 'bano_equipo', re: /(\btina\b|ba[ñn]era|bathtub|jacuzzi|hot ?tub|\bducha|regadera|shower|secador(a)? de pelo|hair ?dryer|toallas?\b|towels?)/i,
    pregunta: '¿Qué hay en el baño o los baños (tina, jacuzzi, ducha, secador de pelo, toallas) y en cuál?',
    llaves: ['fotosBanos', 'fotosDucha', 'fotosRegadera', 'fotosDetalle'] },
  { clave: 'camas_por_cuarto', re: /\b(camas?|beds?|sof[aá][ -]?cama|sofa ?bed|king|queen|matrimonial|literas?|colch[oó]n)\b/i,
    pregunta: '¿Cuántas camas hay, de qué tamaño y en qué cuarto? ¿Hay sofá cama?',
    llaves: ['fotosHabitaciones', 'fotosSillon', 'fotosSalaGeneral', 'fotosDebajoCama'] },
  { clave: 'cocina_equipo', re: /(microondas|microwave|cafetera|coffee ?maker|\brefri|refrigerador|fridge|\bhorno|\boven|estufa|stove|licuadora|blender|tostador|toaster|\bollas|sartenes|\bpots\b|\bpans\b|utensilios|vajilla|lavaplatos|dishwasher|ecofiltro|kettle|hervidor)/i,
    pregunta: '¿Qué electrodomésticos y utensilios de cocina se ven (microondas, cafetera, refrigerador, estufa, horno, licuadora, ollas, platos)?',
    llaves: ['fotosCocinaGeneral', 'fotosMicroondas', 'fotosCafetera', 'fotosRefrigerador', 'fotosEstufa', 'fotosPlatos', 'fotosLavatrastos', 'fotosEcofiltro', 'fotosMicroondas2', 'fotosFregadero'] },
  { clave: 'lavanderia', re: /(lavadora|washer|washing machine|secadora|\bdryer|plancha|\biron(ing)?\b|tendedero)/i,
    pregunta: '¿Hay lavadora, secadora o plancha, y dónde están?',
    llaves: ['fotoPisoGeneral', 'fotosDetalle', 'fotosCloset', 'fotosInsumosLimpieza'] },
  { clave: 'clima_por_cuarto', re: /(aire acondicionado|\ba\/?c\b|air ?condition|ventilador|\bfans?\b|calefac|heater|heating)/i,
    pregunta: '¿Hay aire acondicionado, ventiladores o calefacción, y en qué cuarto?',
    llaves: ['fotosHabitaciones', 'fotosSalaGeneral', 'fotoPisoGeneral'] },
  { clave: 'escritorio', re: /(escritorio|\bdesk|silla de oficina|workspace|espacio (para|de) trabajo|\bmonitor)/i,
    pregunta: '¿Hay escritorio o espacio para trabajar, y dónde?',
    llaves: ['fotosHabitaciones', 'fotosSalaGeneral', 'fotosComedorGeneral'] },
  { clave: 'vista_balcon', re: /(\bvista|\bviews?\b|balc[oó]n|balcony|terraza|terrace|\bpatio|ventanal|jard[ií]n|garden)/i,
    pregunta: '¿Hay balcón, terraza o patio, y qué se ve por las ventanas?',
    llaves: ['fotosVentanas', 'fotosSalaGeneral', 'fotosPrimeraImpresion'] },
  { clave: 'distribucion', re: /(cu[aá]ntos (cuartos|ba[ñn]os|habitaciones|dormitorios)|how many (bedrooms|bathrooms|rooms)|distribuci[oó]n|\blayout|cl[oó]set|armario|gavetas)/i,
    pregunta: '¿Cuántas habitaciones y baños hay, y qué tiene cada habitación (clóset, gavetas)?',
    llaves: ['fotosHabitaciones', 'fotosBanos', 'fotosSalaGeneral', 'fotosCloset', 'fotosGavetas'] }
];
/* Cómo se llama cada foto del formulario de limpieza de Epi (así el modelo sabe en qué cuarto se tomó). */
var FUENTES_ETIQUETAS_ = { fotosTv: 'sala, TV encendida', fotosSalaGeneral: 'sala, general', fotosHabitaciones: 'habitación, foto general', fotoPisoGeneral: 'piso general',
  fotosPrimeraImpresion: 'primera impresión al entrar', fotosSillon: 'sala, sillón', fotosBanos: 'baño', fotosDucha: 'baño, ducha', fotosRegadera: 'baño, regadera',
  fotosDetalle: 'detalle', fotosDebajoCama: 'habitación, debajo de la cama', fotosCocinaGeneral: 'cocina, general', fotosMicroondas: 'cocina, microondas',
  fotosCafetera: 'cocina, cafetera', fotosRefrigerador: 'cocina, refrigerador', fotosEstufa: 'cocina, estufa', fotosPlatos: 'cocina, platos', fotosLavatrastos: 'cocina, lavaplatos',
  fotosEcofiltro: 'cocina, ecofiltro', fotosMicroondas2: 'cocina, microondas por dentro', fotosFregadero: 'cocina, fregadero', fotosCloset: 'clóset', fotosInsumosLimpieza: 'insumos de limpieza',
  fotosVentanas: 'ventanas', fotosComedorGeneral: 'comedor', fotosGavetas: 'gavetas' };

/* ¿Aplica? → { clave, pregunta, llaves } · { prohibido: true } · null (no es una pregunta sobre la propiedad). */
function fuentesTema_(texto) {
  var t = String(texto || '');
  if (!t.trim()) return null;
  if (FUENTES_NUNCA_RE_.test(t)) return { prohibido: true };
  for (var i = 0; i < FUENTES_TEMAS_.length; i++) if (FUENTES_TEMAS_[i].re.test(t)) return FUENTES_TEMAS_[i];
  return null;
}

function fuentesHoja_() { return hojaCrear_('ALMA_FUENTES', FUENTES_CAB_); }
/* La consulta vigente de esta propiedad y tema (la más nueva que no venció), o null. */
function fuentesCache_(propiedad, clave) {
  var sh = fuentesHoja_(), n = sh.getLastRow(); if (n < 2) return null;
  var ini = Math.max(2, n - 499), v = sh.getRange(ini, 1, n - ini + 1, FUENTES_CAB_.length).getValues(), ahora = Date.now();
  for (var i = v.length - 1; i >= 0; i--) {
    var o = {}; FUENTES_CAB_.forEach(function (k, j) { o[k] = v[i][j] instanceof Date ? v[i][j].toISOString() : String(v[i][j] == null ? '' : v[i][j]); });
    if (o.propiedad === propiedad && o.clave === clave && Date.parse(o.vence) > ahora) return o;
  }
  return null;
}
function fuentesGuardar_(propiedad, tema, r) {
  var dias = r.estado === 'respondida' ? FUENTES_DIAS_OK_ : FUENTES_DIAS_DUDA_;
  try {
    fuentesHoja_().appendRow([new Date().toISOString(), propiedad, tema.clave, celdaTexto_(tema.pregunta), r.estado, celdaTexto_(String(r.respuesta || '').slice(0, 500)),
      r.fuente || '', celdaTexto_(String(r.detalle || '').slice(0, 500)), Number(r.fotos || 0), new Date(Date.now() + dias * 86400000).toISOString()]);
  } catch (e) { console.error('fuentesGuardar_: ' + e); }
}
function fuentesJson_(txt) { try { var m = String(txt || '').match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } }

/* ── 1 · Lo escrito: ficha, conocimiento, Hospitable (detalles y knowledge hub). ── */
function fuentesTextoHosp_(propId) {
  if (!propId) return '';
  var out = [];
  var plano = function (o) { var p = listingsPlano_(o || {}); return Object.keys(p).filter(function (k) { var v = p[k]; return v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !/(picture|image|url|coordinates|latitude|longitude|timezone|currency|wifi|password|code)/i.test(k); }).map(function (k) { return k + ': ' + (typeof p[k] === 'object' ? JSON.stringify(p[k]).slice(0, 800) : p[k]); }).join('\n'); };
  try { var d = hosp_('get', '/properties/' + propId + '?include=details'); if (d.code === 200 && d.json) out.push('HOSPITABLE · DETALLES:\n' + plano(d.json.data).slice(0, 5000)); } catch (e) { console.error('fuentes detalles: ' + e); }
  try { var k = hosp_('get', '/properties/' + propId + '/knowledge-hub'); if (k.code === 200 && k.json) out.push('HOSPITABLE · KNOWLEDGE HUB:\n' + plano(k.json.data).slice(0, 3000)); } catch (e) { console.error('fuentes knowledge hub: ' + e); }
  return out.join('\n\n');
}
function fuentesLeerTexto_(tema, ctx, pregunta) {
  var hosp = fuentesTextoHosp_(ctx.propId);
  var txt = claude_(CFG.MODELO_CLASIFICADOR, 300,
    'Revisas la información escrita de un apartamento de Spacio AM para responder UNA pregunta de un huésped sobre lo que hay en el apartamento. ' +
    'Responde solo con lo que está escrito, sin suponer. «claro» es true solo si el texto lo dice de forma directa y sin contradicciones; si no lo menciona, false (que no se mencione no prueba que no exista). ' +
    'Devuelve SOLO JSON: {"claro":true|false,"respuesta":"frase corta en español","fuente":"ficha|base de conocimiento|detalles de Hospitable|knowledge hub","duda":""}',
    'PREGUNTA: ' + tema.pregunta + '\nLO QUE ESCRIBIÓ EL HUÉSPED: ' + String(pregunta || '').slice(0, 400) +
    '\n\nFICHA DE LA PROPIEDAD:\n' + String(ctx.propiedadInfo || '(sin ficha)').slice(0, 5000) +
    '\n\nBASE DE CONOCIMIENTO Y MEMORIA:\n' + String(ctx.conocimiento || '(vacía)').slice(0, 5000) + (hosp ? '\n\n' + hosp : ''), 0);
  return fuentesJson_(txt);
}

/* ── 2 · Fotos del anuncio (Hospitable). ── */
/* El pedido de las fotos del anuncio, en su orden, y guardadas 6 h para el tablero de la llamada (tvGuardarFotos_). Lo usan
   las dos: Alma al responder sobre la propiedad (fuentesFotosAnuncio_) y el tablero cuando un apartamento no tiene
   ninguna foto (tvPedirFotos_, tarjeta.js). Mismo pedido y mismo cupo (hosp_ → uf_). Devuelve la lista (puede venir
   vacía) o null si Hospitable no respondió bien. o: lo que se le pasa a hosp_ (sinReintentos). */
function fuentesPedirFotos_(propId, o) {
  if (!propId) return null;
  var r = hosp_('get', '/properties/' + propId + '/images', null, o); if (!r || r.code !== 200) return null;
  var orden = ((r.json && r.json.data) || []).slice().sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
  try { if (typeof tvGuardarFotos_ === 'function') tvGuardarFotos_(propId, orden); } catch (e) {}   // las usa el tablero de la llamada 6 h (tarjeta.js, #508 T3)
  return orden;
}
function fuentesFotosAnuncio_(propId) {
  if (!propId) return [];
  try {
    var orden = fuentesPedirFotos_(propId); if (!orden) return [];
    return orden
      .map(function (x, i) { return { url: s_(x.thumbnail_url || x.url), etiqueta: 'foto ' + (i + 1) + ' del anuncio' + (x.caption ? ' (' + s_(x.caption) + ')' : '') }; })
      .filter(function (x) { return /^https?:/.test(x.url); }).slice(0, FUENTES_MAX_FOTOS_);
  } catch (e) { console.error('fuentesFotosAnuncio_: ' + e); return []; }
}

/* ── 3 · Fotos de los reportes de limpieza de Epi, la más reciente primero. ── */
function fuentesMismaProp_(a, b) {
  var A = tokProp_(a), B = tokProp_(b); if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return true;
  var nA = A.filter(function (t) { return /\d{3,}/.test(t); }), nB = B.filter(function (t) { return /\d{3,}/.test(t); });
  if (!nA.length || !nB.length || nA.join() !== nB.join()) return false;   // «301» nunca es «1301»
  return A.filter(function (t) { return B.indexOf(t) !== -1; }).length >= 2;
}
/* Todas las direcciones de foto dentro de un valor (texto, lista u objeto como {ducha, inodoro}). */
function fuentesUrls_(v, out) {
  out = out || [];
  if (typeof v === 'string') { if (/^https?:\/\//.test(v.trim())) out.push(v.trim()); }
  else if (Array.isArray(v)) v.forEach(function (x) { fuentesUrls_(x, out); });
  else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { fuentesUrls_(v[k], out); });
  return out;
}
function fuentesFotosLimpieza_(propiedad, llaves) {
  var reps = [];
  try { var j = epiPost_('getAll', { light: true, days: FUENTES_EPI_DIAS_ }); reps = ((j.data || j).reports || []); } catch (e) { console.error('fuentes Epi getAll: ' + e); return []; }
  reps = reps.filter(function (r) { return r && /limpieza/i.test(s_(r.categoria)) && fuentesMismaProp_(r.propiedad, propiedad); })
    .sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')) || Number(b.createdAt || 0) - Number(a.createdAt || 0); })
    .slice(0, FUENTES_REPORTES_);
  var fotos = [], vistas = {};
  for (var i = 0; i < reps.length && fotos.length < FUENTES_MAX_FOTOS_; i++) {
    var rep = null;
    try { var g = epiPost_('getReport', { id: reps[i].id }); rep = (g.data || g).report || null; } catch (e) { console.error('fuentes Epi getReport: ' + e); }
    if (!rep) continue;
    llaves.forEach(function (k) {
      fuentesUrls_(rep[k] !== undefined ? rep[k] : (rep.fotosLimpieza || {})[k]).forEach(function (u) {
        if (fotos.length >= FUENTES_MAX_FOTOS_ || vistas[u]) return;
        vistas[u] = 1; fotos.push({ url: u, etiqueta: 'limpieza del ' + s_(rep.fecha || reps[i].fecha).slice(0, 10) + ', ' + (FUENTES_ETIQUETAS_[k] || k), fecha: s_(rep.fecha || reps[i].fecha).slice(0, 10) });
      });
    });
  }
  return fotos;
}
/* Las fotos de Epi están en Drive («uc?id=…»): se bajan como miniatura de 800 px (menos tokens) y viajan en base64.
   Las del anuncio son públicas y viajan como dirección. */
function fuentesImagenes_(fotos) {
  var drive = fotos.map(function (f) { return (String(f.url).match(/drive\.google\.com\/.*(?:[?&]id=|\/d\/)([\w-]{10,})/) || [])[1] || ''; });
  var pedidos = [], idx = [];
  drive.forEach(function (id, i) { if (id) { idx.push(i); pedidos.push({ url: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800', muteHttpExceptions: true, followRedirects: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }); } });
  var bajadas = {};
  if (pedidos.length) {
    try {
      ufAll_(pedidos, 'huespedes').forEach(function (r, k) {
        var mt = String((r.getBlob && r.getBlob().getContentType()) || '').split(';')[0];
        if (r.getResponseCode() === 200 && /^image\/(jpeg|png|webp|gif)$/.test(mt)) bajadas[idx[k]] = 'data:' + mt + ';base64,' + Utilities.base64Encode(r.getBlob().getBytes());
      });
    } catch (e) { console.error('fuentesImagenes_: ' + e); }
  }
  return fotos.map(function (f, i) { return drive[i] ? (bajadas[i] || '') : f.url; });
}
function fuentesVer_(tema, pregunta, fotos, deDonde) {
  var imgs = fuentesImagenes_(fotos), usadas = [];
  imgs.forEach(function (u, i) { if (u) usadas.push({ img: u, etiqueta: fotos[i].etiqueta }); });
  if (!usadas.length) return null;
  var txt = claude_(CFG.MODELO_REDACTOR, 350,
    'Miras fotos de un apartamento de Spacio AM (' + deDonde + ') para responder UNA pregunta de un huésped. Responde solo con lo que se ve, sin suponer.\n' +
    '· «claro» es true solo si las fotos muestran la respuesta y no se contradicen entre sí (por ejemplo: una TV en la sala y otra en la habitación principal).\n' +
    '· Si las fotos no muestran todos los cuartos que pide la pregunta, si se contradicen, o si no se ve lo que pregunta, «claro» es false: que algo no salga en una foto no prueba que no exista.\n' +
    '· Usa la etiqueta de cada foto para saber en qué cuarto se tomó.\n' +
    'Devuelve SOLO JSON: {"claro":true|false,"respuesta":"frase corta en español, como hecho visto en las fotos","fotos_usadas":[1,2],"duda":""}',
    'PREGUNTA: ' + tema.pregunta + '\nLO QUE ESCRIBIÓ EL HUÉSPED: ' + String(pregunta || '').slice(0, 400) + '\n\nFOTOS (en este orden):\n' +
    usadas.map(function (u, i) { return (i + 1) + '. ' + u.etiqueta; }).join('\n'), 0, usadas.map(function (u) { return u.img; }), FUENTES_MAX_FOTOS_);
  var j = fuentesJson_(txt);
  if (j) j.fotos = usadas.length;
  return j;
}

/* ── El paso completo. Devuelve { estado, respuesta, fuente, detalle } y deja en ctx lo que el redactor y el registro
   necesitan: estado = respondida | dudosa | sin_dato | prohibido | no_aplica. ── */
function respuestaConFuentes_(ctx, avance) {
  ctx = ctx || {};
  var aviso = function (t) { try { if (avance) avance(t); } catch (e) {} };
  if (ctx.esWA || ctx.sinReserva || !ctx.propiedad || ctx.escalar || ctx.nivel === 'ROJO') return { estado: 'no_aplica' };
  var tema = fuentesTema_(ctx.texto);
  if (!tema) return { estado: 'no_aplica' };
  if (tema.prohibido) { ctx.razon = (ctx.razon || '') + ' · respuesta con fuentes: no aplica (tema que decide el equipo)'; return { estado: 'prohibido' }; }

  var r = null, previa = fuentesCache_(ctx.propiedad, tema.clave);
  if (previa) r = { estado: previa.estado, respuesta: previa.respuesta, fuente: previa.fuente, detalle: previa.detalle, fotos: 0, cache: true };
  else {
    var revisado = [];
    aviso('Buscando la respuesta en la ficha y las fotos del apartamento');
    var t = fuentesLeerTexto_(tema, ctx, ctx.texto);
    revisado.push('ficha y Hospitable');
    if (t && t.claro === true && s_(t.respuesta)) r = { estado: 'respondida', respuesta: s_(t.respuesta), fuente: s_(t.fuente) || 'ficha', detalle: '', fotos: 0 };
    if (!r) {
      var fa = fuentesFotosAnuncio_(ctx.propId), va = fa.length ? fuentesVer_(tema, ctx.texto, fa, 'fotos del anuncio') : null;
      revisado.push('fotos del anuncio (' + (va ? va.fotos : 0) + ')');
      if (va && va.claro === true && s_(va.respuesta)) r = { estado: 'respondida', respuesta: s_(va.respuesta), fuente: 'fotos del anuncio', detalle: 'fotos ' + (va.fotos_usadas || []).join(', '), fotos: va.fotos, foto: true };
    }
    if (!r) {
      var fl = fuentesFotosLimpieza_(ctx.propiedad, tema.llaves), vl = fl.length ? fuentesVer_(tema, ctx.texto, fl, 'fotos de los reportes de limpieza, la más reciente primero') : null;
      revisado.push('fotos de limpieza (' + (vl ? vl.fotos : 0) + (fl.length ? ', ' + fl[0].fecha : '') + ')');
      if (vl && vl.claro === true && s_(vl.respuesta)) r = { estado: 'respondida', respuesta: s_(vl.respuesta), fuente: 'fotos de limpieza' + (fl[0].fecha ? ' del ' + fl[0].fecha : ''), detalle: 'fotos ' + (vl.fotos_usadas || []).join(', '), fotos: vl.fotos, foto: true };
      else if (!r) r = { estado: (va || vl) ? 'dudosa' : 'sin_dato', respuesta: '', fuente: revisado.join(' · '), detalle: s_((vl && vl.duda) || (va && va.duda) || (t && t.duda)), fotos: ((va && va.fotos) || 0) + ((vl && vl.fotos) || 0) };
    }
    fuentesGuardar_(ctx.propiedad, tema, r);
  }

  if (r.estado === 'respondida') {
    var deFoto = /^fotos/.test(r.fuente);
    ctx.nivel = 'VERDE';
    ctx.fuente = r.fuente;
    ctx.razon = (ctx.razon || '') + ' · respuesta con fuentes: ' + r.fuente + (r.cache ? ' (guardada)' : '');
    ctx.instrucciones = (ctx.instrucciones || '') + '\n· RESPUESTA CON FUENTES (Alma ya lo revisó; no hace falta el equipo para esto). Pregunta: «' + tema.pregunta + '». ' +
      'Lo que se encontró en ' + r.fuente + ': ' + r.respuesta + '. Respóndele al huésped con esto' +
      (deFoto ? ', con cautela: «En las fotos del apartamento se ve…»' : '') + '. No digas que lo confirmas con el equipo ni agregues [[SEGUIMIENTO]] por esta pregunta, y no agregues nada que no esté aquí.';
    aviso('Respuesta encontrada · ' + r.fuente);
    return r;
  }
  /* Duda o nada: escala como siempre, pero el caso dice qué se revisó. */
  ctx.fuentesNota = 'Alma revisó ' + r.fuente + ': ' + (r.estado === 'dudosa' ? 'no se ve claro' : 'no lo encontró') + (r.detalle ? ' (' + r.detalle + ')' : '');
  ctx.razon = (ctx.razon || '') + ' · respuesta con fuentes: ' + (r.estado === 'dudosa' ? 'duda' : 'sin dato') + ', va al equipo';
  return r;
}
