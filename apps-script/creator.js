/* ═══ 15e · MODO CREATOR (Juan, 18-nov-2026, #770) ═══════════════════════════════════════════════════════════════════
   «La vista creator la vamos a ver cuando se esté hablando con Claudio. Si se está desarrollando una app específica, por
   ejemplo Mi o Epi, nos debería abrir esa app… y deberíamos poder navegar en ella e irle haciendo solicitudes ahí mismo.
   Es muy importante ver muy bien cuándo publicar y cuándo todavía está en draft… Ahí podemos ir haciendo cambios que
   todavía no están en la versión en vivo, para que funcione exactamente como queremos antes de lanzarlo.»
   (Antes: «como Claude Design, pero con prompts hablados… como Build with Omar, que mientras pide cambios se renderizan».)

   Cómo funciona:
   1. BORRADOR (glosario): los cambios de una app que todavía NO están en vivo. Viven en el Hub como VERSIONES (hoja
      ALMA_CREATOR_VERSIONES): cada versión cambia UN archivo de la app y sale de otra (padre). La versión 0 es lo que está
      EN VIVO (main en GitHub). Un archivo en el borrador = su última versión en la cadena actual; si no tiene, el en vivo.
   2. Cada frase de Juan («el título más grande», «ponle vidrio esmerilado») es un CAMBIO CHICO sobre la pantalla que está
      viendo: el modelo rápido (CREATOR_MODELO_, esfuerzo bajo, salida JSON) devuelve reemplazos «buscar → reemplazar»; el
      Hub los aplica todo o nada (creatorAplicar_) y guarda la versión. Lo piden Claudio (claudio_creator, voz y hilo) o el
      cuadro de la pantalla. Se ve en segundos porque nada se publica: la pantalla pide la versión nueva al Hub.
   3. NAVEGAR: alma/creator.html pinta la pantalla del borrador en un marco aislado (sandbox sin el mismo origen: sin la
      sesión de Juan, sin datos reales, sin formularios). Un toque en un enlace de la misma app no sale: el marco le avisa a
      la pantalla (creatorIr) y el Hub devuelve esa otra pantalla, del borrador si cambió o la en vivo si no.
   4. EN VIVO vs BORRADOR: la pantalla dice siempre cuál ve («BORRADOR · no publicado» o «EN VIVO»), cuántos cambios faltan
      por publicar y en qué pantallas, y deja comparar (en vivo, borrador o lado a lado).
   5. DESHACER: vuelve a la versión madre (o a la que diga). Nada se borra.
   6. PUBLICAR, en dos pasos y solo con Juan:
        borrador → «Preparar para publicar»: el pedido normal a Claude (claudeMandarYa_ → microproyecto → PR en el repo de
                   esa app, con capturas antes y después; el HTML de cada archivo lo lee con el robot creator_leer);
        preparando → listo: cuando su microproyecto queda «listo para unir» (con el PR en verde);
        listo → «Publicar»: une ese PR (unirCambio_, las mismas revisiones de siempre). Es su «une»: por voz solo si dijo
                   «publica» o «une». Al unirse se publica sola (Pages en ~1 min; el Hub con el Traslado).
      Mientras no llegue a «publicado», nada de esto está en vivo.

   Por qué así (y no una rama con su propia página de vista previa): GitHub Pages publica solo una rama por repo; una vista
   previa por rama necesita otro servicio (Netlify, Vercel, Cloudflare; cuentas y, con uso, pago) y cada cambio tardaría
   30–90 s en publicarse. Guardar el borrador en el Hub y pintarlo aquí tarda ~1 s del Hub + 3–8 s del modelo, no cuesta
   nada aparte y no puede tocar producción. Límite: el modelo cambia el HTML de la pantalla (y sus estilos dentro);
   lo que vive en otros archivos (.jsx, .js) o en Apps Script va por el pedido normal.

   Seguridad: solo el administrador principal (su sesión, o la firma de la conversación de Claudio). Solo apps de la lista
   y archivos .html de su repo (sin «..»). El borrador nunca se pinta con la sesión ni manda formularios.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var CREATOR_CAB_ = ['id', 'email', 'creado', 'app', 'pagina', 'actual', 'estado', 'micro', 'tocado', 'pr'];
var CREATOR_VER_CAB_ = ['creator', 'v', 'padre', 'ts', 'origen', 'archivo', 'pedido', 'resumen', 'ms', 'modelo', 'html1', 'html2', 'html3', 'html4'];
var CREATOR_TROZO_ = 45000;                 // una celda de Sheets aguanta 50 000 caracteres: el HTML va en hasta 4 trozos
var CREATOR_MAX_ = CREATOR_TROZO_ * 4;      // 180 000 caracteres: una pantalla más grande no se abre en el Modo Creator
var CREATOR_MODELO_ = 'claude-sonnet-5-5';
var CREATOR_MAX_CAMBIOS_ = 12;              // un cambio chico: más reemplazos que esto es otro pedido
var CREATOR_FRESCO_MS_ = 30 * 60000;        // «súbelo» es del Modo Creator si se tocó en la última media hora
var CREATOR_PRUEBA_ = 'alma/creator-prueba.html';
var CREATOR_DUENO_ = 'jforce15-coder';
/* Las apps que se abren en el Modo Creator: su repositorio, su dominio y la pantalla con la que empieza. */
var CREATOR_APPS_ = {
  hub: { t: 'Hub', repo: 'Hub-Spacioam', dominio: 'hub.spacioam.com', inicio: CREATOR_PRUEBA_ },
  hola: { t: 'Hola', repo: 'Hola-spacioam', dominio: 'hola.spacioam.com', inicio: 'index.html' },
  epi: { t: 'Epi', repo: 'Epi-spacioam', dominio: 'epi.spacioam.com', inicio: 'index.html' },
  grow: { t: 'Grow', repo: 'Grow-spacioam', dominio: 'grow.spacioam.com', inicio: 'index.html' },
  docs: { t: 'Docs', repo: 'Docs-spacioam', dominio: 'docs.spacioam.com', inicio: 'index.html' },
  mi: { t: 'Mi', repo: 'mi-spacioam', dominio: 'mi.spacioam.com', inicio: 'index.html' }
};
/* Pantallas del Hub que Juan nombra («abre inicio»). Cualquier otro .html, por su ruta. */
var CREATOR_PANTALLAS_HUB_ = { prueba: CREATOR_PRUEBA_, inicio: 'alma/inicio.html', claudio: 'alma/claudio.html', avisos: 'alma/avisos.html',
  agentes: 'alma/agentes.html', conexiones: 'alma/conexiones.html', biblioteca: 'alma/biblioteca.html', uso: 'alma/uso.html', google: 'alma/google.html', hub: 'index.html' };
var CREATOR_ESTADOS_ = { borrador: 'borrador', preparando: 'preparando', listo: 'listo', publicado: 'publicado', cerrado: 'cerrado' };

/* El prompt del cambio rápido, en JSON como todo prompt entre agentes (rol, tarea, contexto, pasos, restricciones, formato). */
var CREATOR_PROMPT_ = {
  rol: 'Diseñador y programador de interfaces de Spacio AM. Haces cambios chicos y precisos en una pantalla HTML mientras Juan los pide hablando.',
  tarea: 'Aplica a la pantalla el pedido de Juan con el cambio más chico que lo cumpla bien, para que se vea en segundos.',
  contexto: [
    'Juan habla, no escribe: el pedido puede venir corto o con muletillas («todavía no», «más», «eso no»). Los pedidos anteriores ya están hechos: interpreta el nuevo respecto a ellos.',
    'Es un borrador: nada de esto está en vivo hasta que Juan lo publique.',
    'Sistema de diseño de Spacio AM: alabastro #FAF8F6, arena, durazno #E9826A, letras Valky (títulos) y Montserrat (texto). Respétalo salvo que Juan pida otra cosa.'
  ],
  pasos: [
    'Lee la pantalla y el pedido.',
    'Decide el cambio más chico que lo cumple. Para un cambio de estilo amplio (jerarquía, espacios, vidrio esmerilado, animación al pasar el dedo), prefiere agregar o cambiar reglas en un bloque <style> antes que reescribir el HTML.',
    'Devuelve cada cambio como un par buscar/reemplazar.'
  ],
  restricciones: [
    'Cada «buscar» se copia EXACTO de la pantalla (espacios y saltos incluidos) y aparece UNA sola vez; si un texto se repite, toma más contexto alrededor hasta que sea único.',
    'Cada «buscar» es lo más corto posible: nunca la pantalla entera ni secciones largas sin cambiar.',
    'Como mucho ' + CREATOR_MAX_CAMBIOS_ + ' cambios.',
    'Sin scripts ni estilos de otros sitios, sin llamadas a internet nuevas, sin datos personales reales (teléfonos, correos, códigos).',
    'Todo movimiento respeta prefers-reduced-motion; nada se sale de la pantalla en 375 px; los botones miden al menos 44 px.',
    'Si el pedido no es de esta pantalla o necesita lógica del servidor, no cambies nada (cambios vacío) y dilo en resumen en una frase.'
  ],
  formato_de_respuesta: 'JSON: resumen (una frase corta en español, en pasado y de tú, lo que cambiaste: «Puse el título más grande y en durazno.») y cambios (lista de {buscar, reemplazar}).'
};
var CREATOR_ESQUEMA_ = { type: 'object', additionalProperties: false, required: ['resumen', 'cambios'], properties: {
  resumen: { type: 'string' },
  cambios: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['buscar', 'reemplazar'], properties: { buscar: { type: 'string' }, reemplazar: { type: 'string' } } } } } };

function creatorHoja_() { return hojaCrear_('ALMA_CREATOR', CREATOR_CAB_); }
function creatorHojaVer_() { return hojaCrear_('ALMA_CREATOR_VERSIONES', CREATOR_VER_CAB_); }
function creatorModelo_() { return String(PropertiesService.getScriptProperties().getProperty('CREATOR_MODELO') || '').trim() || CREATOR_MODELO_; }

/* ── Piezas puras (las prueba .github/creator.js) ── */
function creatorNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
/* La app que Juan nombra («Mi», «la app de Epi», «el Hub»). '' si no es una de la lista. */
function creatorApp_(x) {
  var k = creatorNorm_(x).replace(/^(la |el )?(app |aplicacion )?(de )?/, '').trim();
  if (!k) return 'hub';
  return CREATOR_APPS_[k] ? k : '';
}
/* Una pantalla válida de la app: un nombre del Hub, una dirección de su dominio o la ruta de un .html. '' si no sirve. */
function creatorPagina_(app, x) {
  var A = CREATOR_APPS_[app]; if (!A) return '';
  var t = String(x || '').trim(), k = creatorNorm_(t).replace(/^(la |el )?(pantalla |pagina )?(de )?/, '').trim();
  if (!t) return A.inicio;
  if (app === 'hub' && CREATOR_PANTALLAS_HUB_[k]) return CREATOR_PANTALLAS_HUB_[k];
  t = t.replace(new RegExp('^https://' + A.dominio.replace(/\./g, '\\.') + '/'), '').replace(/^\/+/, '').split(/[?#]/)[0];
  if (/^https?:/.test(t)) return '';
  if (t === '' || /\/$/.test(t)) t += 'index.html';
  return /^[\w-]+(\/[\w-]+)*\.html$/.test(t) && t.indexOf('..') < 0 ? t : '';
}
function creatorTrozos_(html) { var h = String(html || ''), out = []; for (var i = 0; i < 4; i++) out.push(h.slice(i * CREATOR_TROZO_, (i + 1) * CREATOR_TROZO_)); return out; }
function creatorUnir_(fila, desde) { var s = ''; for (var i = 0; i < 4; i++) s += String(fila[desde + i] == null ? '' : fila[desde + i]); return s; }
/* Aplica los reemplazos. Todo o nada: si un «buscar» no está o está más de una vez, no cambia nada y dice cuál. Si no está
   tal cual, prueba sin fijarse en los espacios (el modelo a veces cambia una sangría). */
function creatorAplicar_(html, cambios) {
  var h = String(html || ''), fallos = [], hechos = 0;
  (Array.isArray(cambios) ? cambios : []).slice(0, CREATOR_MAX_CAMBIOS_).forEach(function (c, i) {
    var b = String((c && c.buscar) || ''), r = String((c && c.reemplazar) == null ? '' : c.reemplazar);
    if (!b) { fallos.push({ i: i, por: 'vacío' }); return; }
    var p = h.indexOf(b);
    if (p >= 0 && h.indexOf(b, p + 1) < 0) { h = h.slice(0, p) + r + h.slice(p + b.length); hechos++; return; }
    if (p >= 0) { fallos.push({ i: i, por: 'repetido', buscar: b.slice(0, 80) }); return; }
    var re = new RegExp(b.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')), m = re.exec(h);
    if (m && !re.exec(h.slice(m.index + m[0].length))) { h = h.slice(0, m.index) + r + h.slice(m.index + m[0].length); hechos++; return; }
    fallos.push({ i: i, por: m ? 'repetido' : 'no está', buscar: b.slice(0, 80) });
  });
  return fallos.length ? { ok: false, fallos: fallos, html: String(html || '') } : { ok: true, html: h, hechos: hechos };
}
/* Lo que Juan escribe en el cuadro: ¿deshacer, publicar o un cambio? (por voz lo decide Claudio con su herramienta) */
function creatorIntencion_(texto) {
  var t = chatNorm_(texto).replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { que: '' };
  var v = /\b(?:version|la)\s*(\d{1,3})\b/.exec(t);
  if (/^(deshaz|deshacer|regresa|regresalo|vuelve|volver|atras|undo|quitalo|quita eso|eso no|mejor no)\b/.test(t) && !/\b(mas|menos|grande|chico|color)\b/.test(t)) return { que: 'deshacer', v: v ? Number(v[1]) : 0 };
  if (/\b(subelo|publicalo|publica|publicar|lanzalo|sube(lo)? a produccion)\b/.test(t) && t.split(' ').length <= 6) return { que: 'publicar' };
  return { que: 'cambiar' };
}
/* La cadena de versiones que lleva a «actual» (de la más vieja a la más nueva), sin la 0 (en vivo). */
function creatorCadena_(vers, actual) {
  var por = {}, out = []; vers.forEach(function (x) { por[x.v] = x; });
  for (var k = actual, g = 0; k > 0 && por[k] && g < 500; k = por[k].padre, g++) out.unshift(por[k]);
  return out;
}
/* Qué versión tiene un archivo en el borrador (0 = igual que en vivo) y qué archivos cambiaron. */
function creatorVersionDe_(cadena, archivo) { for (var i = cadena.length - 1; i >= 0; i--) if (cadena[i].archivo === archivo) return cadena[i].v; return 0; }
function creatorCambiados_(cadena) { var vistos = {}, out = []; cadena.forEach(function (x) { if (!vistos[x.archivo]) { vistos[x.archivo] = 1; out.push(x.archivo); } }); return out; }
/* Lo que se pinta: con la base de su dominio (los archivos relativos cargan de la app en vivo), sin sa-sesion.js (nunca la
   sesión de Juan) y con un guardia que no deja salir: un enlace de la misma app se pide a la pantalla (el Hub da la del
   borrador o la en vivo); uno de otro sitio no se abre. La versión guardada queda igual al archivo. */
function creatorParaPintar_(html, app, archivo) {
  var A = CREATOR_APPS_[app] || CREATOR_APPS_.hub, dir = String(archivo || '').replace(/[^\/]*$/, '');
  var base = '<base href="https://' + A.dominio + '/' + dir + '">';
  var guardia = '<script>(function(){var D=' + JSON.stringify(A.dominio) + ';document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;' +
    'var h=a.getAttribute("href")||"";if(/^#/.test(h)||/^javascript:/i.test(h))return;var u;try{u=new URL(h,document.baseURI);}catch(x){return;}e.preventDefault();' +
    'if(u.host===D)parent.postMessage({creator:"ir",ruta:u.pathname},"*");else parent.postMessage({creator:"fuera",host:u.host},"*");},true);})();<\/script>';
  var h = String(html || '').replace(/<script[^>]*sa-sesion\.js[^>]*><\/script>\s*/gi, '');
  return /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, function (m) { return m + base + guardia; }) : base + guardia + h;
}

/* ── El Modo Creator de cada quien ── */
function creatorDe_(r, fila) {
  var o = { fila: fila }; CREATOR_CAB_.forEach(function (k, j) { o[k] = r[j]; });
  ['id', 'app', 'pagina', 'estado', 'micro', 'pr'].forEach(function (k) { o[k] = String(o[k] == null ? '' : o[k]); });
  o.email = String(o.email).toLowerCase(); o.actual = Number(o.actual) || 0; o.tocado = Number(o.tocado) || 0; o.creado = Number(o.creado) || 0;
  return o;
}
function creatorActivo_(email) {
  email = String(email || '').toLowerCase(); var sh = creatorHoja_(), n = sh.getLastRow(); if (n < 2) return null;
  var ini = Math.max(2, n - 199), v = sh.getRange(ini, 1, n - ini + 1, CREATOR_CAB_.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) { var c = creatorDe_(v[i], ini + i); if (c.email === email && c.estado !== CREATOR_ESTADOS_.cerrado) return c; }
  return null;
}
function creatorGuardar_(c) { creatorHoja_().getRange(c.fila, 1, 1, CREATOR_CAB_.length).setValues([CREATOR_CAB_.map(function (k) { return c[k] == null ? '' : c[k]; })]); creatorEstadoPoner_(c); }
function creatorVersiones_(id) {
  var sh = creatorHojaVer_(), n = sh.getLastRow(); if (n < 2) return [];
  var ini = Math.max(2, n - 499), v = sh.getRange(ini, 1, n - ini + 1, 10).getValues();
  return v.filter(function (r) { return String(r[0]) === id; }).map(function (r) { return { v: Number(r[1]) || 0, padre: Number(r[2]) || 0, ts: Number(r[3]) || 0, origen: String(r[4] || ''), archivo: String(r[5] || ''), pedido: String(r[6] || ''), resumen: String(r[7] || ''), ms: Number(r[8]) || 0, modelo: String(r[9] || '') }; });
}
function creatorHtmlVersion_(id, v) {
  var sh = creatorHojaVer_(), n = sh.getLastRow(); if (n < 2) return '';
  var ini = Math.max(2, n - 499), col = sh.getRange(ini, 1, n - ini + 1, 2).getValues();
  for (var i = col.length - 1; i >= 0; i--) if (String(col[i][0]) === id && Number(col[i][1]) === Number(v)) return creatorUnir_(sh.getRange(ini + i, 11, 1, 4).getValues()[0], 0);
  return '';
}
/* Lo que está EN VIVO (main en GitHub): 10 min en caché si cabe. */
function creatorVivo_(app, archivo) {
  var A = CREATOR_APPS_[app]; if (!A) return { ok: false, error: 'Esa app no la conozco.' };
  var k = 'creator_vivo_' + app + ':' + archivo, c = CacheService.getScriptCache(), ya = null;
  try { ya = c.get(k); } catch (e) {}
  if (ya) return { ok: true, html: ya };
  var r = uf_('https://raw.githubusercontent.com/' + CREATOR_DUENO_ + '/' + A.repo + '/main/' + archivo, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'No encuentro «' + archivo + '» en ' + A.t + ' (' + r.getResponseCode() + ').' };
  var html = r.getContentText();
  if (html.length > CREATOR_MAX_) return { ok: false, error: 'Esa pantalla de ' + A.t + ' es demasiado grande para el Modo Creator (más de ' + Math.round(CREATOR_MAX_ / 1000) + ' mil letras). Pídela como cambio normal.' };
  try { if (html.length < 90000) c.put(k, html, 600); } catch (e) {}
  return { ok: true, html: html };
}
/* El archivo en el borrador: su última versión en la cadena o, si no cambió, el en vivo. */
function creatorHtml_(c, archivo, vers) {
  var cadena = creatorCadena_(vers || creatorVersiones_(c.id), c.actual), v = creatorVersionDe_(cadena, archivo);
  if (v) { var h = creatorHtmlVersion_(c.id, v); if (h) return { ok: true, html: h, v: v, borrador: true }; }
  var vivo = creatorVivo_(c.app, archivo); vivo.v = 0; vivo.borrador = false; return vivo;
}
/* El estado chico que pregunta la pantalla cada 1,5 s (en caché: sin hojas mientras nada cambie). */
function creatorEstadoClave_(email) { return 'creator_est_' + String(email || '').toLowerCase(); }
function creatorEstadoPoner_(c, extra) {
  var e = Object.assign({ id: c.id, actual: c.actual, pagina: c.pagina, estado: c.estado, sello: c.id + ':' + c.actual + ':' + Date.now(), cambiando: '' }, extra || {});
  try { CacheService.getScriptCache().put(creatorEstadoClave_(c.email), JSON.stringify(e), 21600); } catch (x) {}
  return e;
}
function creatorEstadoLeer_(email) { try { return JSON.parse(CacheService.getScriptCache().get(creatorEstadoClave_(email)) || 'null'); } catch (e) { return null; } }

/* Abre una app en el Modo Creator. Si ya hay un borrador de ESA app sin publicar, sigue ahí (va a la pantalla que pida);
   otra app empieza su propio borrador (el anterior queda guardado, cerrado). */
function creatorAbrir_(adm, appNombre, pagina) {
  var app = creatorApp_(appNombre);
  if (!app) return { ok: false, error: 'Esa app no la tengo en el Modo Creator. Están: ' + Object.keys(CREATOR_APPS_).map(function (k) { return CREATOR_APPS_[k].t; }).join(', ') + '.' };
  var archivo = creatorPagina_(app, pagina);
  if (!archivo) return { ok: false, error: 'Esa pantalla no la encuentro en ' + CREATOR_APPS_[app].t + '.' };
  var ya = creatorActivo_(adm.email);
  if (ya && ya.app === app && ya.estado !== CREATOR_ESTADOS_.publicado) return creatorIr_(adm, archivo, ya);
  var vivo = creatorVivo_(app, archivo); if (!vivo.ok) return vivo;
  if (ya) { ya.estado = CREATOR_ESTADOS_.cerrado; creatorGuardar_(ya); }
  var c = { id: 'cr' + Date.now().toString(36), email: String(adm.email).toLowerCase(), creado: Date.now(), app: app, pagina: archivo, actual: 0, estado: CREATOR_ESTADOS_.borrador, micro: '', tocado: Date.now(), pr: '' };
  creatorHoja_().appendRow(CREATOR_CAB_.map(function (k) { return c[k]; }));
  c.fila = creatorHoja_().getLastRow();
  creatorEstadoPoner_(c);
  return { ok: true, app: app, pagina: archivo, resultado: 'Abrí ' + CREATOR_APPS_[app].t + ' en el Modo Creator, en borrador. Pide el primer cambio.' };
}
function creatorAsegurar_(adm) { var c = creatorActivo_(adm.email); if (c) return { ok: true, c: c }; var a = creatorAbrir_(adm, 'hub', ''); return a.ok ? { ok: true, c: creatorActivo_(adm.email) } : a; }
/* Ir a otra pantalla de la misma app (un toque en un enlace dentro del borrador, o Juan lo pide). */
function creatorIr_(adm, ruta, c) {
  c = c || creatorActivo_(adm.email); if (!c) return { ok: false, error: 'No hay una app abierta en el Modo Creator.' };
  var archivo = creatorPagina_(c.app, ruta);
  if (!archivo) return { ok: false, error: 'Esa pantalla no es de ' + CREATOR_APPS_[c.app].t + '.' };
  var h = creatorHtml_(c, archivo); if (!h.ok) return h;
  c.pagina = archivo; c.tocado = Date.now(); creatorGuardar_(c);
  return { ok: true, pagina: archivo, resultado: 'Abrí «' + archivo + '».' };
}
/* Si el borrador se cambia después de pedir publicarlo, vuelve a ser borrador (lo pedido ya no es lo último). */
function creatorVolverABorrador_(c) { if (c.estado === CREATOR_ESTADOS_.preparando || c.estado === CREATOR_ESTADOS_.listo || c.estado === CREATOR_ESTADOS_.publicado) { c.estado = CREATOR_ESTADOS_.borrador; c.micro = ''; c.pr = ''; } }

/* ── El cambio rápido ── */
function creatorPedirAlModelo_(html, pedido, antes) {
  var modelo = creatorModelo_(), key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY'), t0 = Date.now();
  var hist = antes.length ? 'Pedidos anteriores (ya están en la pantalla): ' + antes.map(function (p) { return '«' + p + '»'; }).join(' · ') + '\n' : '';
  var cuerpo = { model: modelo, max_tokens: 6000,
    system: [{ type: 'text', text: JSON.stringify(CREATOR_PROMPT_), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: '<pantalla>\n' + html + '\n</pantalla>' }, { type: 'text', text: hist + 'Pedido de Juan ahora: «' + pedido + '»' }] }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CREATOR_ESQUEMA_ } } };
  /* Si un clasificador declina, el mismo pedido sigue con otro modelo dentro de la misma llamada (fallbacks). */
  var conRespaldo = /sonnet-5-5|opus-5-5/.test(modelo);
  if (conRespaldo) cuerpo.fallbacks = 'default';
  var mandar = function (c, beta) { var h = { 'x-api-key': key, 'anthropic-version': '2023-06-01' }; if (beta) h['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    return uf_('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: h, payload: JSON.stringify(c) }); };
  var r = mandar(cuerpo, conRespaldo);
  if (r.getResponseCode() === 400 && conRespaldo && /fallback/i.test(r.getContentText())) { delete cuerpo.fallbacks; r = mandar(cuerpo, false); }
  var j = {}; try { j = JSON.parse(r.getContentText()) || {}; } catch (e) {}
  var ms = Date.now() - t0;
  try { registrarUso_({ app: 'ALMA', funcion: 'Modo Creator', modelo: j.model || modelo, usage: j.usage || {}, ms: ms, ok: r.getResponseCode() === 200 }); } catch (e) {}
  if (r.getResponseCode() !== 200) { console.error('creator modelo ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300)); return { ok: false, ms: ms, error: 'El modelo no respondió (' + r.getResponseCode() + ').' }; }
  if (j.stop_reason === 'refusal') return { ok: false, ms: ms, error: 'El modelo no quiso hacer ese cambio.' };
  var txt = (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  var o = null; try { o = JSON.parse(txt); } catch (e) { var m = /\{[\s\S]*\}/.exec(txt); try { o = m ? JSON.parse(m[0]) : null; } catch (e2) {} }
  if (!o || !Array.isArray(o.cambios)) return { ok: false, ms: ms, error: 'La respuesta del modelo no se entendió.' };
  return { ok: true, ms: ms, modelo: j.model || modelo, resumen: String(o.resumen || '').slice(0, 300), cambios: o.cambios };
}
/* Un cambio en la pantalla que Juan está viendo. origen: voz · texto · robot. */
function creatorCambiar_(adm, pedido, origen) {
  pedido = String(pedido || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!pedido) return { ok: false, error: 'Dime qué cambio quieres ver.' };
  if (claudioAccTieneLlave_(pedido)) return { ok: false, error: CLAUDIO_ACC_LLAVE_AVISO_ };
  var a = creatorAsegurar_(adm); if (!a.ok) return a;
  var c = a.c, t0 = Date.now(), vers = creatorVersiones_(c.id);
  var base = creatorHtml_(c, c.pagina, vers); if (!base.ok) return base;
  var cadena = creatorCadena_(vers, c.actual), antes = cadena.filter(function (x) { return x.archivo === c.pagina; }).slice(-6).map(function (x) { return x.pedido; });
  creatorEstadoPoner_(c, { cambiando: pedido });
  var m = creatorPedirAlModelo_(base.html, pedido, antes);
  var ap = m.ok ? creatorAplicar_(base.html, m.cambios) : null;
  if (m.ok && !ap.ok) {
    /* Una segunda vuelta: se le dice qué no estaba tal cual (pasa cuando copia mal una línea). */
    var m2 = creatorPedirAlModelo_(base.html, pedido + ' (Ojo: en tu intento anterior estos «buscar» no estaban una sola vez tal cual en la pantalla: ' + ap.fallos.map(function (f) { return '«' + f.buscar + '» (' + f.por + ')'; }).join(', ') + '. Cópialos exactos.)', antes);
    if (m2.ok) { m2.ms += m.ms; m = m2; ap = creatorAplicar_(base.html, m.cambios); }
  }
  if (!m.ok || !ap.ok || !ap.hechos) {
    creatorEstadoPoner_(c, { error: !m.ok ? m.error : !ap.ok ? 'No pude aplicar ese cambio.' : (m.resumen || 'No cambié nada.') });
    if (m.ok && ap.ok && !ap.hechos) return { ok: true, sin_cambio: true, version: c.actual, resultado: m.resumen || 'No cambié nada: ese pedido no es de esta pantalla o necesita un cambio normal.' };
    return { ok: false, error: 'NO CAMBIÓ NADA: ' + (!m.ok ? m.error : 'el cambio no se pudo aplicar a la pantalla. Pídelo de otra forma, más concreto.') };
  }
  if (ap.html.length > CREATOR_MAX_) { creatorEstadoPoner_(c); return { ok: false, error: 'NO CAMBIÓ NADA: la pantalla quedaría demasiado grande.' }; }
  var v = vers.reduce(function (mx, x) { return Math.max(mx, x.v); }, 0) + 1, ms = Date.now() - t0;
  creatorHojaVer_().appendRow([c.id, v, c.actual, Date.now(), origen || 'voz', c.pagina, pedido, String(m.resumen || '').slice(0, 300), ms, m.modelo].concat(creatorTrozos_(ap.html)));
  c.actual = v; c.tocado = Date.now(); creatorVolverABorrador_(c);
  creatorGuardar_(c);
  return { ok: true, version: v, segundos: Math.round(ms / 100) / 10, resumen: m.resumen, resultado: 'HECHO, ya se ve en el borrador (versión ' + v + '; aún no está en vivo). Di solo «Listo, mira.» y, si ayuda, en pocas palabras: ' + m.resumen };
}
/* Volver a la versión madre de la actual o a una en particular (0 = como está en vivo). */
function creatorDeshacer_(adm, v) {
  var c = creatorActivo_(adm.email); if (!c) return { ok: false, error: 'No hay una app abierta en el Modo Creator.' };
  var vers = creatorVersiones_(c.id), por = { 0: { v: 0, archivo: '', pedido: '' } }; vers.forEach(function (x) { por[x.v] = x; });
  var pidio = v != null && v !== '' && !isNaN(Number(v));
  var a = pidio ? Number(v) : (c.actual > 0 && por[c.actual] ? por[c.actual].padre : -1);
  if (pidio && !por[a]) return { ok: false, error: 'No hay una versión ' + v + ' en este borrador.' };
  if (!(a >= 0)) return { ok: false, error: 'Ya está igual que en vivo: no hay una anterior.' };
  /* Se queda a la vista la pantalla que cambia al deshacer (la del cambio que se quita), para que Juan lo vea. */
  var quitado = por[c.actual] && por[c.actual].archivo;
  c.actual = a; c.tocado = Date.now(); if (quitado) c.pagina = quitado; else if (a && por[a].archivo) c.pagina = por[a].archivo;
  creatorVolverABorrador_(c);
  creatorGuardar_(c);
  return { ok: true, version: a, resultado: 'HECHO: el borrador volvió a la versión ' + a + (a ? ' («' + String(por[a].pedido).slice(0, 60) + '»)' : ' (igual que en vivo)') + '. Di solo «Listo, regresé a la anterior.»' };
}
/* PUBLICAR, paso 1 («Preparar para publicar» o «súbelo»): el pedido normal a Claude. Nada llega a producción aquí. */
function creatorPreparar_(adm, c) {
  var vers = creatorVersiones_(c.id), cadena = creatorCadena_(vers, c.actual), archivos = creatorCambiados_(cadena), A = CREATOR_APPS_[c.app];
  if (!cadena.length) return { ok: false, error: 'NO SE PIDIÓ NADA: el borrador está igual que en vivo. Pide un cambio primero.' };
  var leer = archivos.map(function (f) { return '«' + f + '» con {"action": "creator_leer", "creator": "' + c.id + '", "v": ' + creatorVersionDe_(cadena, f) + '}'; }).join('; ');
  var texto = 'Publica el borrador que Juan hizo en el Modo Creator para ' + A.t + ' (repositorio ' + CREATOR_DUENO_ + '/' + A.repo + '). ' +
    'Archivos que cambian: ' + archivos.join(', ') + '. El HTML final de cada uno está en el Hub (robot dsBot): ' + leer + '. ' +
    'Ponlos tal cual en esas rutas (revisa que solo cambie lo pedido y que cumpla los estándares del repo) y abre el PR con capturas antes y después. ' +
    'Lo que pidió, en orden: ' + cadena.map(function (x, i) { return (i + 1) + ') [' + x.archivo + '] ' + x.pedido; }).join(' ');
  var r = claudeMandarYa_(adm, texto, { micro: 'nuevo', nuevoJuan: true, nivel: 'complejo', literal: 'publícalo' });
  if (r.claude && !r.claude.ok) return { ok: false, error: 'El pedido no salió: ' + String(r.texto || '').slice(0, 200) };
  c.estado = CREATOR_ESTADOS_.preparando; c.micro = String((r.claude && r.claude.micro) || ''); c.pr = ''; c.tocado = Date.now(); creatorGuardar_(c);
  return { ok: true, estado: c.estado, micro: c.micro, resultado: 'HECHO: se está preparando para publicar (el cambio con capturas antes y después). Sigue en BORRADOR: te aviso cuando esté listo y ahí dices «publícalo». Dilo en una frase.' };
}
/* ¿Ya está listo? Su microproyecto «listo para unir» con su PR. Se mira como mucho cada 30 s (lo pide la pantalla). */
function creatorRevisarListo_(c) {
  if (c.estado !== CREATOR_ESTADOS_.preparando || !c.micro) return false;
  var k = 'creator_mira_' + c.id, cache = CacheService.getScriptCache();
  try { if (cache.get(k)) return false; cache.put(k, '1', 30); } catch (e) {}
  var m = null; try { m = microLeer_(c.micro); } catch (e) { return false; }
  if (!m) return false;
  if (m.estado === MICRO_ESTADOS_.listo && /\/pull\/\d+/.test(m.pr || '')) { c.estado = CREATOR_ESTADOS_.listo; c.pr = String(m.pr); creatorGuardar_(c); return true; }
  if (m.estado === MICRO_ESTADOS_.unido) { c.estado = CREATOR_ESTADOS_.publicado; c.pr = String(m.pr || c.pr); creatorGuardar_(c); return true; }
  return false;
}
/* PUBLICAR, paso 2: une el PR listo (es el «une» de Juan). dijo: sus palabras, si fue por voz. */
function creatorPublicar_(adm, dijo, porVoz) {
  var c = creatorActivo_(adm.email); if (!c) return { ok: false, error: 'No hay una app abierta en el Modo Creator.' };
  if (c.estado === CREATOR_ESTADOS_.borrador) return creatorPreparar_(adm, c);
  if (c.estado === CREATOR_ESTADOS_.publicado) return { ok: true, ya: true, resultado: 'Eso ya está publicado.' };
  if (c.estado === CREATOR_ESTADOS_.preparando) { creatorRevisarListo_(c); if (c.estado === CREATOR_ESTADOS_.preparando) return { ok: true, estado: c.estado, resultado: 'Todavía se está preparando: sigue en BORRADOR. Te aviso cuando esté listo para publicar.' }; }
  if (c.estado !== CREATOR_ESTADOS_.listo || !c.pr) return { ok: false, error: 'No está listo para publicar.' };
  if (porVoz && !/\b(publica|publicalo|une|unelo|lanzalo|lanza)\b/.test(chatNorm_(dijo))) return { ok: false, error: 'NO SE PUBLICÓ: está listo, pero solo se publica cuando Juan dice «publícalo». Pregúntale si lo publicas.' };
  var u = unirCambio_(c.pr);
  if (!u || !u.ok || !(u.unidos || []).length) return { ok: false, error: 'No se pudo publicar: ' + ((u && (u.error || (u.no_unidos && u.no_unidos[0] && u.no_unidos[0].error) || u.nota)) || 'GitHub no lo dejó.') };
  c.estado = CREATOR_ESTADOS_.publicado; c.tocado = Date.now(); creatorGuardar_(c);
  return { ok: true, estado: c.estado, resultado: 'HECHO: quedó publicado; en vivo en un minuto más o menos. Dilo en una frase.' };
}
/* ¿El «súbelo» de Juan es del Modo Creator? Sí, si lo tocó hace poco y tiene cambios sin pedir (claudio_responder lo usa). */
function creatorSubeloEsMio_(adm) { try { var c = creatorActivo_(adm.email); return !!c && c.actual > 0 && c.estado === CREATOR_ESTADOS_.borrador && Date.now() - c.tocado < CREATOR_FRESCO_MS_; } catch (e) { return false; } }

/* ── La herramienta claudio_creator (voz, Claudio local y el hilo de texto) ── */
function claudioCreatorHerr_(adm, b) {
  var acc = String(b.accion || 'cambiar').toLowerCase(), out;
  if (acc === 'abrir') out = creatorAbrir_(adm, b.app, b.pagina);
  else if (acc === 'deshacer') out = creatorDeshacer_(adm, String(b.version || '').trim() === '' ? null : Number(b.version));
  else if (acc === 'publicar') out = creatorPublicar_(adm, b.dijo || '', true);
  else out = creatorCambiar_(adm, b.pedido, b.sin_chat ? 'texto' : 'voz');
  if (out && out.ok) out.creator = true;   // la app abre el Modo Creator a pantalla completa (VozNativa: claudio_creator)
  return out;
}

/* ── Acciones de la pantalla (solo el principal, con su sesión) ── */
function creatorAdm_(ses) {
  if (!ses) return { error: VOZ_SIN_SESION_ };
  var adm = vozWebAdmin_(ses);
  return adm && esAdminPrincipal_(adm) ? { adm: adm } : { error: 'El Modo Creator es solo para el administrador principal.' };
}
/* creatorVer { desde, vivo }: el estado; si cambió (o sin desde), la pantalla del borrador lista para pintar, la lista de
   versiones, las pantallas cambiadas y, con vivo, la misma pantalla como está en vivo (para comparar). */
function creatorVerApi_(ses, b) {
  var q = creatorAdm_(ses); if (q.error) return { ok: false, error: q.error };
  b = b || {};
  var e = creatorEstadoLeer_(q.adm.email);
  if (e && b.desde && b.desde === e.sello && e.estado !== CREATOR_ESTADOS_.preparando) return { ok: true, igual: true, cambiando: e.cambiando || '', sello: e.sello };
  var c = creatorActivo_(q.adm.email);
  if (!c) { var a = creatorAbrir_(q.adm, 'hub', ''); if (!a.ok) return a; c = creatorActivo_(q.adm.email); }
  var cambio = creatorRevisarListo_(c);
  if (e && b.desde && b.desde === e.sello && !cambio && e.id === c.id) return { ok: true, igual: true, cambiando: e.cambiando || '', sello: e.sello };
  if (!e || cambio || e.id !== c.id || e.actual !== c.actual || e.pagina !== c.pagina || e.estado !== c.estado) e = creatorEstadoPoner_(c);
  var vers = creatorVersiones_(c.id), cadena = creatorCadena_(vers, c.actual), en = {}; cadena.forEach(function (x) { en[x.v] = 1; });
  var h = creatorHtml_(c, c.pagina, vers); if (!h.ok) return h;
  var A = CREATOR_APPS_[c.app], out = { ok: true, sello: e.sello, cambiando: e.cambiando || '', error_ultimo: e.error || '',
    creator: { id: c.id, app: c.app, app_t: A.t, dominio: A.dominio, pagina: c.pagina, actual: c.actual, estado: c.estado, pr: c.estado === CREATOR_ESTADOS_.listo || c.estado === CREATOR_ESTADOS_.publicado ? c.pr : '' },
    pagina_cambiada: !!h.borrador, cambiados: creatorCambiados_(cadena), sin_publicar: c.estado === CREATOR_ESTADOS_.publicado ? 0 : cadena.length,
    versiones: vers.map(function (x) { return { v: x.v, padre: x.padre, ts: x.ts, origen: x.origen, archivo: x.archivo, pedido: x.pedido, resumen: x.resumen, segundos: x.ms ? Math.round(x.ms / 100) / 10 : 0, en_borrador: !!en[x.v] }; }),
    apps: Object.keys(CREATOR_APPS_).map(function (k) { return { k: k, t: CREATOR_APPS_[k].t }; }),
    html: creatorParaPintar_(h.html, c.app, c.pagina) };
  if (b.vivo) { var vv = creatorVivo_(c.app, c.pagina); out.html_vivo = vv.ok ? creatorParaPintar_(vv.html, c.app, c.pagina) : ''; }
  return out;
}
/* creatorCambiar { texto } · creatorDeshacer { v? } · creatorPublicar · creatorAbrir { app, pagina } · creatorIr { ruta } */
function creatorAccionApi_(ses, accion, b) {
  var q = creatorAdm_(ses); if (q.error) return { ok: false, error: q.error };
  b = b || {};
  if (accion === 'creatorAbrir') return creatorAbrir_(q.adm, b.app, b.pagina);
  if (accion === 'creatorIr') return creatorIr_(q.adm, b.ruta);
  if (accion === 'creatorDeshacer') return creatorDeshacer_(q.adm, b.v == null || b.v === '' ? null : Number(b.v));
  if (accion === 'creatorPublicar') return creatorPublicar_(q.adm, '', false);   // el botón es su toque: su «une»
  var i = creatorIntencion_(b.texto);
  if (i.que === 'deshacer') return creatorDeshacer_(q.adm, i.v || null);
  if (i.que === 'publicar') { var c = creatorActivo_(q.adm.email); return c && c.estado === CREATOR_ESTADOS_.borrador ? creatorPublicar_(q.adm, '', false) : creatorPublicar_(q.adm, b.texto, true); }
  return creatorCambiar_(q.adm, b.texto, 'texto');
}

/* ── Robot (dsBot): leer una versión (la sesión de Claude que lo publica) y probar con el Modo Creator del principal ── */
function creatorRobot_(body) {
  if (body.action === 'creator_leer') {
    var id = String(body.creator || ''), v = Number(body.v) || 0;
    if (!/^cr[\w]+$/.test(id)) return { ok: false, error: 'creator' };
    var h = creatorHtmlVersion_(id, v); return h ? { ok: true, creator: id, v: v, html: h } : { ok: false, error: 'No está esa versión.' };
  }
  var adm = (adminsOp_().filter(function (a) { return a.principal; })[0]) || null;
  if (!adm) return { ok: false, error: 'Sin administrador principal.' };
  if (body.action === 'creator_abrir') return creatorAbrir_(adm, body.app, body.pagina);
  if (body.action === 'creator_deshacer') return creatorDeshacer_(adm, body.v == null ? null : Number(body.v));
  var r = creatorCambiar_(adm, String(body.texto || ''), 'robot');   // creator_prueba: mide los segundos de un cambio real
  if (r.ok && body.html) { var c = creatorActivo_(adm.email); r.html = creatorHtmlVersion_(c.id, c.actual); }
  return r;
}
