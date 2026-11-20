/* ═══ PÁGINA EXPLICATIVA (Juan, 20-nov-2026: truco 2 del video de Andrej Karpathy, «Explícamelo en una página»; «decide
   tú» → opción A) ════════════════════════════════════════════════════════════════════════════════════════════════
   Cuando un administrador pide entender algo («explícamelo en una página», «hazme una calculadora de cuánto deja Mónaco B2
   si subo la tarifa 10 %»), Alma usa la herramienta explicar_en_pagina (chat y WhatsApp) con el tema y los datos que ya
   tiene. El Hub arma UNA página HTML autocontenida con el modelo medio (un diagrama SVG o una calculadora con controles,
   en español simple y con los colores de Alma) y Alma manda el enlace de inmediato: la página se arma en segundo plano
   (~1 min; pagProcesar) y, mientras, el enlace muestra «preparándose».
   · Dónde vive: la hoja ALMA_PAGINAS del libro privado de Alma (el HTML en dos celdas de hasta 45 000, como el Modo
     Creator). Nunca va al repo. Se borra sola a los 7 días (pagLimpiar_, cada hora en aprender()).
   · Cómo se abre: hub.spacioam.com/alma/pagina.html?id=…&t=… . Con la sesión de un administrador abre siempre (acción
     paginaVer); sin sesión, el token largo del enlace la abre UNA vez (doGet ?pagina=…&t=…; se guarda solo su huella
     SHA-256). La página corre en un marco aislado (sandbox sin acceso al Hub) y sin red (CSP): no llama a nada.
   · Tope: PAGINAS_TOPE por día (10 si no está); el modelo: PAGINA_MODELO (si no, el medio del Modo Creator). Cada página
     va a IA_USO como «Página explicativa» (el Gasto de Alma la cuenta). Robot pagina_explicativa (crear con datos de
     prueba, ver estado, traer el HTML o borrar).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var PAG_CAB_ = ['id', 'creado', 'vence', 'email', 'canal', 'tema', 'datos', 'estado', 'token', 'usado', 'error', 'modelo', 'ms', 'html1', 'html2'];
var PAG_HOJA_ = 'ALMA_PAGINAS';
var PAG_DIAS_ = 7, PAG_TOPE_ = 10, PAG_TROZO_ = 45000;
var PAG_RUTA_ = '/alma/pagina.html';
/* Lo único externo que puede cargar la página: la hoja de letras de Google Fonts (ningún script de fuera). */
var PAG_CSP_ = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:";
var PAG_PROMPT_ = {
  rol: 'Diseñador de páginas explicativas de Alma (Spacio AM, apartamentos de estadía corta en Guatemala).',
  tarea: 'Arma UNA página HTML autocontenida que explique el tema con un diagrama SVG o con una calculadora con controles.',
  contexto: ['La lee un administrador en el iPhone (375 px de ancho).',
    'Colores de Alma: fondo #FAFAFA, tarjetas #FFFFFF y #F5F3F0, texto #3E3F3F, texto secundario #6F6867, acento gráfico durazno #E9826A (nunca como color de texto), divisores #D8D4CE. Letras: Montserrat (Google Fonts) y títulos en Georgia.'],
  pasos: ['Elige: diagrama (un flujo, un proceso, quién hace qué) o calculadora (una cuenta con números que se mueven: deslizadores o campos que recalculan al instante).',
    'Arriba: un título corto y una frase que diga para qué sirve; debajo, la pieza principal; al final, 2 o 3 frases de lectura.',
    'Usa solo los datos que vienen. Si a la calculadora le falta un número, ponlo como control editable con un valor de ejemplo y dilo junto al control.',
    'Escribe en español simple: frases cortas, una idea por frase, voz activa.'],
  restricciones: ['Todo en un archivo: CSS y JavaScript en línea.', 'Ningún <script src>, iframe, fetch ni llamada a internet; solo se permite la hoja de Google Fonts.',
    'No inventes datos ni nombres; nunca teléfonos ni correos.', 'Nada se sale a 375 px; botones de al menos 44 px; respeta prefers-reduced-motion.', 'Máximo 14 000 caracteres.'],
  formato_de_respuesta: 'Solo el HTML, desde <!doctype html> hasta </html>.'
};

function pagHoja_() { return hojaCrear_(PAG_HOJA_, PAG_CAB_); }
function pagProp_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }
function pagTope_() { var n = Number(pagProp_('PAGINAS_TOPE')); return pagProp_('PAGINAS_TOPE') !== '' && isFinite(n) ? n : PAG_TOPE_; }
function pagModelo_() { return pagProp_('PAGINA_MODELO') || creatorEscalonModelo_(1); }
function pagDia_(d) { return Utilities.formatDate(new Date(d), CFG.TZ, 'yyyy-MM-dd'); }
function pagIso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }   // la hoja convierte las fechas ISO en fechas
function pagHuella_(token) {   // 'h' delante: la hoja nunca la toma por número
  return 'h' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token || '')).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function pagFilas_() {
  var sh = pagHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PAG_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: i + 2 }; PAG_CAB_.forEach(function (k, j) { o[k] = v[j]; }); return o;
  });
}
function pagFila_(id) { id = String(id || ''); return id ? pagFilas_().filter(function (f) { return String(f.id) === id; })[0] || null : null; }
function pagPoner_(f, campos) { var sh = pagHoja_(); Object.keys(campos).forEach(function (k) { sh.getRange(f.fila, PAG_CAB_.indexOf(k) + 1).setValue(campos[k]); f[k] = campos[k]; }); }
function pagVencida_(f, ahora) { return !f || new Date(f.vence).getTime() <= (ahora || Date.now()); }
function pagUsadasHoy_() { var hoy = pagDia_(Date.now()); return pagFilas_().filter(function (f) { return f.creado && pagDia_(f.creado) === hoy; }).length; }

/* La herramienta explicar_en_pagina (agente.js): crea la página y devuelve el enlace en el acto; se arma en segundo plano. */
function pagExplicar_(adm, inp, canal) {
  inp = inp || {};
  if (!esAdminOp_(adm)) return { ok: false, error: 'Las páginas explicativas son solo para administradores.' };
  var tema = String(inp.tema || '').trim().slice(0, 400), datos = String(inp.datos || '').trim().slice(0, 6000);
  if (!tema) return { ok: false, error: 'Falta el tema: qué quiere entender.' };
  if (pagUsadasHoy_() >= pagTope_()) return { ok: false, error: 'Ya van ' + pagTope_() + ' páginas hoy (el tope del día). Mañana hay más.' };
  var id = 'pg' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), ahora = Date.now();
  pagHoja_().appendRow([id, new Date(ahora).toISOString(), new Date(ahora + PAG_DIAS_ * 86400000).toISOString(), String(adm.email || ''), String(canal || ''),
    celdaTexto_(tema), celdaTexto_(datos), 'pendiente', pagHuella_(token), '', '', '', '', '', '']);
  try { PropertiesService.getScriptProperties().setProperty('PAG_PEND', '1'); } catch (e) {}
  if (!inp.ahora) pagProgramar_();
  var enlace = CFG.HUB_URL + PAG_RUTA_ + '?id=' + id + '&t=' + token;
  return { ok: true, id: id, enlace: enlace, vence_en_dias: PAG_DIAS_,
    decir: 'Manda el enlace tal cual: ' + enlace + ' . Se arma en un minuto (si lo abre antes, espera ahí). Vence en ' + PAG_DIAS_ + ' días.' };
}
function pagProgramar_() {
  try {
    if (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'pagProcesar'; })) return;
    ScriptApp.newTrigger('pagProcesar').timeBased().after(1000).create();
  } catch (e) { console.error('pagProgramar_: ' + e); }
}
/* Disparador de un solo uso (y respaldo en procesarCola, que solo mira la propiedad PAG_PEND). */
function pagProcesar() {
  try { ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'pagProcesar'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); }); } catch (e) {}
  pagProcesar_();
}
function pagProcesar_() {
  if (pagProp_('PAG_PEND') !== '1') return;
  var cache = CacheService.getScriptCache(), yo = Utilities.getUuid();
  if (cache.get('pag_lock')) return;
  cache.put('pag_lock', yo, 300);
  try {
    var pend = pagFilas_().filter(function (f) { return f.estado === 'pendiente'; });
    if (!pend.length) { PropertiesService.getScriptProperties().deleteProperty('PAG_PEND'); return; }
    pend.slice(0, 2).forEach(pagArmar_);
    if (pend.length > 2) pagProgramar_();
  } finally { if (cache.get('pag_lock') === yo) cache.remove('pag_lock'); }
}
function pagArmar_(f) {
  pagPoner_(f, { estado: 'armando' });
  var t0 = Date.now(), modelo = pagModelo_(), html = '', err = '';
  try { html = pagGenerar_(String(f.tema), String(f.datos), modelo); } catch (e) { err = String(e.message || e); }
  var seg = html ? pagHtmlSeguro_(html) : null;
  if (!err && !seg) err = 'el modelo no devolvió una página';
  if (!err && seg.html.length > PAG_TROZO_ * 2) err = 'la página salió demasiado grande';
  if (err) { pagPoner_(f, { estado: 'error', error: err.slice(0, 300), modelo: modelo, ms: Date.now() - t0 }); return f; }
  pagPoner_(f, { estado: 'lista', modelo: modelo, ms: Date.now() - t0, html1: seg.html.slice(0, PAG_TROZO_), html2: seg.html.slice(PAG_TROZO_), error: seg.quitados ? 'quitado: ' + seg.quitados : '' });
  return f;
}
function pagGenerar_(tema, datos, modelo) {
  var user = 'Tema: ' + tema + (datos ? '\n\nDatos que ya tengo:\n' + datos : '\n\n(Sin datos: explica el concepto y deja editables los números.)');
  var txt = String(claude_(modelo || pagModelo_(), 12000, JSON.stringify(PAG_PROMPT_), user, null) || '');
  var m = /<!doctype html[\s\S]*<\/html>/i.exec(txt) || /<html[\s\S]*<\/html>/i.exec(txt);
  return m ? m[0] : '';
}
/* Lo que la página no puede traer: scripts de fuera, marcos, objetos, formularios que mandan datos, base ni refresco.
   Solo queda la hoja de Google Fonts. Y la política de contenido (CSP) cierra la red aunque algo se cuele. */
function pagHtmlSeguro_(html) {
  var h = String(html || ''), n = 0;
  var quitar = function (re) { h = h.replace(re, function () { n++; return ''; }); };
  quitar(/<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script\s*>/gi);
  quitar(/<script\b[^>]*\bsrc\s*=[^>]*\/?>/gi);
  quitar(/<(iframe|object|embed|frame|frameset|applet|portal)\b[\s\S]*?(<\/\1\s*>|\/?>)/gi);
  quitar(/<(base|form)\b[^>]*>/gi);
  quitar(/<meta\b[^>]*http-equiv[^>]*>/gi);
  h = h.replace(/<link\b[^>]*>/gi, function (l) { if (/href\s*=\s*["']https:\/\/fonts\.googleapis\.com\//i.test(l)) return l; n++; return ''; });
  var csp = '<meta http-equiv="Content-Security-Policy" content="' + PAG_CSP_ + '">';
  h = /<head\b[^>]*>/i.test(h) ? h.replace(/<head\b[^>]*>/i, function (x) { return x + csp; }) : csp + h;
  return { html: h, quitados: n };
}
function pagHtml_(f) { return String(f.html1 || '') + String(f.html2 || ''); }
function pagRespuesta_(f) {
  if (f.estado === 'lista') return { ok: true, estado: 'lista', tema: String(f.tema), vence: pagIso_(f.vence), html: pagHtml_(f) };
  if (f.estado === 'error') return { ok: false, estado: 'error', error: 'No pude armar la página (' + String(f.error || 'error') + '). Pídesela a Alma otra vez.' };
  return { ok: true, estado: 'preparando', tema: String(f.tema), vence: pagIso_(f.vence) };
}

/* Hub con sesión (acción paginaVer): cualquier administrador, todas las veces que quiera hasta que venza. */
function pagVerApi_(ses, body) {
  var adm = chatSesAdm_(ses);
  if (!esAdminOp_(adm)) return { ok: false, error: 'Solo un administrador abre las páginas explicativas.' };
  var f = pagFila_(body && body.id);
  if (!f || pagVencida_(f)) return { ok: false, estado: 'vencida', error: 'Esta página ya no existe: vencen a los ' + PAG_DIAS_ + ' días. Pídele a Alma otra.' };
  return pagRespuesta_(f);
}
/* Sin sesión (doGet ?pagina=…&t=…): el token largo del enlace, una sola vez y solo antes de vencer. */
function pagVerToken_(id, token) {
  var f = pagFila_(id);
  if (!f || !token || pagHuella_(token) !== String(f.token)) return { ok: false, estado: 'sin_permiso', error: 'Este enlace no abre la página. Entra al Hub con tu usuario.' };
  if (pagVencida_(f)) return { ok: false, estado: 'vencida', error: 'Esta página ya no existe: vencen a los ' + PAG_DIAS_ + ' días. Pídele a Alma otra.' };
  if (f.usado) return { ok: false, estado: 'usado', error: 'Este enlace ya se abrió una vez. Para verla otra vez, entra al Hub con tu usuario.' };
  var r = pagRespuesta_(f);
  if (r.estado === 'lista') pagPoner_(f, { usado: new Date().toISOString() });   // «preparando» no gasta el enlace
  return r;
}
/* Borra las vencidas (de abajo hacia arriba, para no correr las filas). */
function pagLimpiar_() {
  var sh = pagHoja_(), ahora = Date.now(), n = 0;
  pagFilas_().reverse().forEach(function (f) { if (pagVencida_(f, ahora)) { sh.deleteRow(f.fila); n++; } });
  return n;
}

/* Robot pagina_explicativa: { tema, datos } crea y arma en el acto (datos de prueba, sin mandar nada); { id } el estado;
   { id, html: true } también el HTML; { borrar: id } la borra. */
function pagRobot_(body) {
  body = body || {};
  if (body.borrar) { var fb = pagFila_(body.borrar); if (fb) pagHoja_().deleteRow(fb.fila); return { ok: true, borrada: !!fb }; }
  if (body.id) {
    var f = pagFila_(body.id); if (!f) return { ok: false, error: 'no existe' };
    var o = { ok: true, id: f.id, estado: f.estado, vence: pagIso_(f.vence), usado: pagIso_(f.usado), error: String(f.error || ''), modelo: String(f.modelo || ''), ms: f.ms, largo: pagHtml_(f).length };
    if (body.html) o.html = pagHtml_(f);
    return o;
  }
  var adm = agPrincipal_(), r = pagExplicar_(adm, { tema: body.tema, datos: body.datos, ahora: true }, 'robot');
  if (!r.ok) return r;
  var fr = pagArmar_(pagFila_(r.id));
  return { ok: fr.estado === 'lista', id: r.id, enlace: r.enlace, estado: fr.estado, error: String(fr.error || ''), ms: fr.ms, largo: pagHtml_(fr).length };
}
