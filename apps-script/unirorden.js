/* ═══ «UNE» SE HACE, NO SE PIDE (Juan, 16-nov-2026) ═══════════════════════════════════════════════════════════════
   «En lugar de resolver, Alma dice que resolvió y no está resolviendo nada.» El 16-nov Juan dijo «une todo», «unir»,
   «unámoslo ahora» o «une el cambio de …» más de diez veces y casi siempre recibió «Listo, quedó pedido» o «Listo, quedó
   sumado a «Unir»»: la orden se volvía un pedido NUEVO a Desarrollo (issues «[Otro] Unir», «[Otro] Unir todo»), allá
   contestaban «desde aquí no puedo unirlos, pídeselo a Alma» y nada se unía. En la llamada la voz hasta dijo «ya uní ambos
   cambios» sin haber unido ninguno. Y al revés: una nota de voz sobre un huésped que terminaba en «Unir en los demás» unió
   dos cambios, uno con «(unir solo con Juan presente)» en el título.
   Aquí, en un solo lugar:
     1. unirOrden_: ¿lo que dijo el administrador principal es una orden de unir cambios (o la pregunta «¿hay algo para
        unir?»)? «Une las dos pantallas en una» NO lo es: eso sigue siendo un pedido a Desarrollo.
     2. unirOrdenHacer_: la orden se cumple ahí mismo con unirCambio_ (unir.js) y la respuesta es el resultado real:
        qué se unió y, si algo no se pudo, por qué. La llama claudeMandarYa_ (chat.js) antes de armar un pedido, así
        vale igual en el chat, en la app, por WhatsApp y en la llamada.
     3. unirGuardia_: la herramienta unir_cambio no une si en ese mensaje Juan no pidió unir con claridad. */

var UNIR_VERBO_ = '(?:une(?:lo|los|la|las|me)?|unir(?:lo|los|la|las)?|un[ae]mos(?:lo|los|la|las)?|unan(?:lo|los)?|haz(?:le)? (?:el |un )?merge|hacer (?:el )?merge|dar(?:le)? merge|dale merge|mergea(?:r|lo|los)?|merge)';
var UNIR_INICIO_RE_ = new RegExp('^(?:(?:eh|este|bueno|ok|okay|entonces|pues|alma|si|claro|perfecto|por favor|ya) )*' + UNIR_VERBO_ + '\\b');
var UNIR_VERBO_RE_ = new RegExp('\\b' + UNIR_VERBO_ + '\\b');
/* De qué se habla cuando se habla de unir cambios. */
var UNIR_COSA_RE_ = /\b(cambios?|prs?|pull requests?|merge|pendientes? (?:de|para|por) unir|listos? para unir|para que se publiquen?)\b|#\s?\d+/;
/* Lo que puede acompañar a un «une» corto sin volverlo otra cosa («unir todo ahora», «unámoslo de una vez»). */
var UNIR_RELLENO_RE_ = /\b(todo|todos|todas|ambos|ambas|los dos|las dos|lo|los|eso|esos|ese|ahora|ya|de una vez|por favor|alma|si|listo|listos|pendiente|pendientes|que haya|que tengamos|que este|que esten|el|de|y)\b/g;
var UNIR_PREGUNTA_RE_ = /\b(pendientes?|algo|cambios?|prs?|cosas?)\b[^.?!]{0,40}\b(para|por|de) (unir|dar merge|merge)\b|\bque (cambios?|prs?) (estan|hay|quedan|tenemos)\b[^.?!]{0,30}\b(unir|merge|pendientes?|listos?)\b/;
var UNIR_APP_RE_ = /^(?:el|la|lo|los|las) (?:de|del)(?: la| el)? (hub|app|hola|epi|grow|docs|iphone)(?: de alma)?$/;   // «une el de la app», «une el del Hub»
var UNIR_APARTE_RE_ = /\b(no unir|unir solo|une solo|solo con juan|toca datos)\b/i;   // el título pide unirlo aparte: «todos» no lo toca
var UNIR_SI_RE_ = /^(si|sip|dale|ok|okay|claro|hazlo|adelante|perfecto|de acuerdo|correcto|todos|todas|ambos|ambas|los dos|las dos|el primero|el segundo|el tercero|ese|esos|listo)\b/;

function unirNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[nota de voz\]/g, ' ').replace(/[¿?¡!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim(); }
function unirAparte_(titulo) { return UNIR_APARTE_RE_.test(String(titulo || '')); }

/* ¿Es una orden de unir? → null · { lista: true } (pregunta qué hay para unir) · { cuales: ['todos' | '#12' | '«nombre»' | 'app:hub'] } */
function unirOrden_(texto) {
  var crudo = String(texto || ''), n = unirNorm_(crudo.replace(/«[^»]*»/g, ' « ')); if (!n || n.length > 260) return null;
  var nombres = (crudo.match(/«[^»]{2,80}»/g) || []).map(function (x) { return x.slice(1, -1).trim(); });
  var nums = (crudo.match(/#\s?\d{1,5}\b/g) || []).map(function (x) { return '#' + x.replace(/\D/g, ''); });
  if (!UNIR_INICIO_RE_.test(n)) {
    /* «¿Hay algo pendiente para unir?», «Revisar si hay pendientes para unir o dar merge»: se contesta con la lista. */
    return UNIR_PREGUNTA_RE_.test(n) && n.split(' ').length <= 16 ? { lista: true } : null;
  }
  var resto = n.replace(UNIR_INICIO_RE_, ' ').replace(/«/g, ' ').replace(/#\s?\d+/g, ' ').replace(/\s+/g, ' ').trim();
  var corto = !resto.replace(UNIR_RELLENO_RE_, ' ').replace(/\s+/g, ' ').trim();   // «unir», «une todo», «unámoslo ahora»
  var deApp = !nums.length && !nombres.length ? UNIR_APP_RE_.exec(resto) : null;
  if (deApp) return { cuales: ['app:' + deApp[1]] };
  if (!corto && !UNIR_COSA_RE_.test(n) && !nombres.length) return null;             // «une las dos pantallas en una»: es un pedido
  if (nums.length) return { cuales: nums };
  if (nombres.length && !/\b(todo|todos|todas)\b/.test(resto)) return { cuales: nombres.map(function (x) { return '«' + x + '»'; }) };
  return { cuales: ['todos'] };
}

/* El cambio (PR) que corresponde a un nombre dicho entre «»: el de su microproyecto, o por palabras del título. */
function unirPorNombre_(adm, nombre, lista) {
  var q = unirNorm_(nombre), urls = [];
  try {
    microAbiertos_(adm.email).forEach(function (m) {
      var mn = unirNorm_(m.nombre); if (!mn || !q) return;
      if (mn === q || mn.indexOf(q) === 0 || q.indexOf(mn) === 0) (String(m.pr || '').match(/https:\/\/github\.com\/[^\s,]+\/pull\/\d+/g) || []).forEach(function (u) { if (urls.indexOf(u) < 0) urls.push(u); });
    });
  } catch (e) { console.error('unirPorNombre_: ' + e); }
  var porUrl = lista.filter(function (x) { return urls.indexOf(x.url) >= 0; });
  return porUrl.length ? porUrl : prsElegir_(nombre, lista);
}
function unirEstadoDicho_(x) {
  return x.estado === 'choque' ? 'choca con lo último de main' : x.estado === 'fallo' ? 'sus revisiones fallaron' : x.estado === 'revisando' ? 'sus revisiones siguen corriendo'
    : x.estado === 'borrador' ? 'todavía es un borrador' : 'listo para unir';
}
function unirListaDicha_(lista) { return lista.map(function (x) { return '· ' + x.app + ' #' + x.numero + ' · ' + String(x.titulo || '').slice(0, 70) + ' (' + unirEstadoDicho_(x) + ')'; }).join('\n'); }

/* Cumple la orden. Devuelve null (no era una orden o no es el principal) o { accion: 'unir', texto, voz, unir }.
   Sin «claude»: quien la llama (chat, app, WhatsApp, llamada) solo dice el texto; no hay pedido a Desarrollo. */
function unirOrdenHacer_(adm, texto) {
  if (!adm || !esAdminPrincipal_(adm)) return null;
  var o = unirOrden_(texto); if (!o) return null;
  var salida = function (t, r) { return { accion: 'unir', texto: t, voz: 'RESULTADO REAL. Dile solo esto, sin agregar nada (nada más se unió ni se pidió): «' + t.replace(/\n+/g, ' ') + '»', unir: r || { unidos: [], no_unidos: [] } }; };
  var lista = prsAbiertos_(true);
  if (!lista) return salida('No pude ver los cambios: falta la llave de GitHub en Conexiones o GitHub no respondió. No uní nada.');
  if (!lista.length) return salida('No hay cambios pendientes de unir: todo lo que estaba listo ya está unido.');
  if (o.lista) {
    var listos = lista.filter(function (x) { return x.estado === 'listo'; }).length;
    return salida((lista.length === 1 ? 'Hay un cambio abierto' : 'Hay ' + lista.length + ' cambios abiertos') + (listos ? ' (' + listos + (listos === 1 ? ' listo' : ' listos') + ' para unir)' : ', ninguno listo todavía') + ':\n' + unirListaDicha_(lista) + (listos ? '\n\nDi «une todo» o cuál.' : ''));
  }
  var elegidos = [], sin = [], aparte = [];
  o.cuales.forEach(function (c) {
    var es = [];
    if (c === 'todos') { es = lista.filter(function (x) { return x.estado === 'listo' && !unirAparte_(x.titulo); }); aparte = lista.filter(function (x) { return x.estado === 'listo' && unirAparte_(x.titulo); }); }
    else if (c.charAt(0) === '«') es = unirPorNombre_(adm, c.slice(1, -1), lista);
    else if (c.indexOf('app:') === 0) es = lista.filter(function (x) { var ap = c.slice(4), rp = String(x.repo || '').toLowerCase(); return ap === 'app' || ap === 'iphone' ? /\/alma-app$/.test(rp) : rp.indexOf('/' + ap + '-') >= 0; });
    else es = prsElegir_(c, lista);
    if (!es.length && c !== 'todos') sin.push(c);
    es.forEach(function (x) { if (elegidos.indexOf(x) < 0) elegidos.push(x); });
  });
  var unidos = [], no = [];
  elegidos.forEach(function (x) {
    var r = unirCambio_(x.url);
    (r.unidos || []).forEach(function (u) { unidos.push(u); });
    (r.no_unidos || []).forEach(function (u) { no.push(u); });
    if (!r.ok && !(r.no_unidos || []).length) no.push({ pr: x.app + ' #' + x.numero, error: r.error || 'no se pudo' });
  });
  var partes = [];
  if (unidos.length) partes.push('Listo, uní ' + (unidos.length === 1 ? 'un cambio' : unidos.length + ' cambios') + ': ' + unidos.map(function (u) { return u.pr + (u.titulo ? ' · ' + String(u.titulo).slice(0, 60) : ''); }).join('; ') + '. Se publica solo en unos minutos.');
  else partes.push('No uní nada.');
  no.forEach(function (u) { partes.push('No pude unir ' + u.pr + ': ' + String(u.error || 'no se pudo').replace(/\.$/, '') + '.'); });
  sin.forEach(function (c) { partes.push('No encontré ' + (c.indexOf('app:') === 0 ? 'un cambio de ' + c.slice(4) : c) + ' entre los cambios abiertos.'); });
  aparte.forEach(function (x) { partes.push(x.app + ' #' + x.numero + ' quedó sin unir porque su título pide unirlo aparte: dime su número para unirlo.'); });
  if (!unidos.length && !no.length && !sin.length && !aparte.length) {
    var esperan = lista.filter(function (x) { return x.estado !== 'listo'; });
    partes.push(esperan.length ? 'Ninguno está listo:\n' + unirListaDicha_(esperan) : 'No hay cambios listos para unir.');
  } else if (sin.length) partes.push('Los abiertos:\n' + unirListaDicha_(lista));
  return salida(partes.join(' ').replace(/ (Ninguno está listo|Los abiertos):/, '\n\n$1:'), { unidos: unidos, no_unidos: no });
}

/* La herramienta unir_cambio (agente.js): si en este mensaje Juan no pidió unir con claridad, no se une nada.
   turno: lo que escribió o dijo en este turno (AGENTE_TEXTO_). Devuelve null (se puede unir) o el error para Alma. */
function unirGuardia_(cual, turno) {
  if (!String(cual || '').trim()) return null;                    // sin «cual» solo devuelve la lista
  var n = unirNorm_(turno); if (!n) return null;                   // sin texto del turno (el botón, una entrega de fondo) no hay qué revisar
  var palabras = n.split(' ').length;
  if (UNIR_SI_RE_.test(n) && palabras <= 8) return null;           // el «sí» a «¿los uno?»
  if (UNIR_VERBO_RE_.test(n) || /\bpublica(r|lo|los)?\b/.test(n)) {
    if (palabras <= 8 || UNIR_COSA_RE_.test(n) || /«/.test(String(turno || ''))) return null;
  }
  return { ok: false, unidos: [], error: 'NO UNÍ NADA: en este mensaje no se pidió unir cambios con claridad (habla de otra cosa). Sigue con lo que pidió; si además quiere unir, que diga «une todo» o cuál.' };
}
