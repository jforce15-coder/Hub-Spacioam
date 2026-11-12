/* ═══ EL PROMPT LLEGA EN JSON (#498 T2; decisión de Juan, 12-nov-2026) ═══════════════════════════════════════════
   Mismo contenido y misma esencia que el texto de siempre, solo otro formato: JSON compacto, ordenado por secciones.
   Cada canal sigue armando su texto como antes (fuente única, playbooks, hojas, datos del turno) y al final pasa por
   aquí. No se recorta ni se reescribe nada: cada línea va tal cual; solo cambian los títulos, que pasan a ser claves.
     · «═══ TÍTULO ═══»                         → clave de primer nivel (alma, el_negocio, este_turno…)
     · «TÍTULO EN MAYÚSCULAS», «4. TÍTULO», «## Título» → clave dentro de su sección (quien_eres, nunca, voz_de_marca…)
       Lo que el título trae además («(según el NIVEL…)», «: mide la confianza…») va como primera línea de la sección.
     · «· regla» / «- regla»                      → un texto de la lista (sin la viñeta)
     · una línea seguida de sus viñetas, cuando hay varias así en la sección → { texto, puntos } (p. ej. cada caller_type)
     · lo que va antes del primer título                 → clave «texto».
   Una sección de una sola línea queda como texto; de varias, como lista. Lo usan: la voz (vozPromptCompleto_, que el Hub
   sube a ElevenLabs; {{quien_llama}} sigue igual, dentro de su texto), el chat con herramientas (claudeSystem_: Hub,
   WhatsApp, calle, llamada y segundo plano) y el redactor de huéspedes (redactorPrompt_). Revisa .github/prompts-json.js. */
var PJ_CLAVES_ = { si_dos_reglas_chocan_gana_la_de_arriba: 'prioridad', el_negocio: 'negocio', tus_herramientas_en_la_llamada: 'herramientas' };
var PJ_GUARDA_TITULO_ = { si_dos_reglas_chocan_gana_la_de_arriba: 1 };   // el título es una regla: va también como primera línea
function pjSlug_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
/* ¿Es un título? Devuelve { clave, lineas } (lo que el título trae además del nombre) o null. */
function pjTitulo_(l, banner) {
  var m, etiqueta, resto;
  if (banner) { m = l.match(/^(.+?)(?=$| \(|:| —)(.*)$/); etiqueta = m[1]; resto = m[2]; }
  else if ((m = l.match(/^#{1,6} (.+?)(?=$| \()(.*)$/))) { etiqueta = m[1]; resto = m[2]; }
  else {
    m = l.match(/^\d+\. ([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 ·,\/&'-]*[A-ZÀ-ÖØ-Þ0-9])(?=$| |:|\.)(.*)$/) ||
      l.match(/^([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 ·,\/&'-]*[A-ZÀ-ÖØ-Þ0-9])(?=$| \(|:| —|\.(?: |$))(.*)$/);
    if (!m || m[1].replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length < 3) return null;
    etiqueta = m[1]; resto = m[2];
  }
  var s = pjSlug_(etiqueta), clave = PJ_CLAVES_[s] || s, lineas = [];
  if (!clave) return null;
  if (PJ_GUARDA_TITULO_[s] || clave.length > 32) {   // un título largo es una frase: la frase se queda, la clave se acorta
    if (clave.length > 32) clave = clave.split('_').slice(0, 4).join('_');
    var frase = (etiqueta + ' ' + String(resto || '').trim()).trim();
    lineas.push(/[a-zà-ÿ]/.test(frase) ? frase : frase.charAt(0) + frase.slice(1).toLowerCase());
    resto = '';
  }
  resto = String(resto || '').replace(/^\s*:?\s*/, '');
  if (resto) lineas.push(resto);
  return { clave: clave, lineas: lineas };
}
/* Las líneas de una sección: sin viñetas; las que encabezan sus propias viñetas (si hay más de una) quedan agrupadas. */
function pjHoja_(lineas) {
  var it = lineas.map(function (l) { var v = /^[·-] /.test(l); return { v: v, t: v ? l.slice(2).trim() : l.trim() }; });
  var lider = function (i) { return !it[i].v && it[i + 1] && it[i + 1].v; };
  var n = 0; it.forEach(function (x, i) { if (lider(i)) n++; });
  var out = [];
  for (var i = 0; i < it.length; i++) {
    if (n >= 2 && lider(i)) {
      var g = { texto: it[i].t, puntos: [] };
      while (it[i + 1] && it[i + 1].v) g.puntos.push(it[++i].t);
      out.push(g);
    } else out.push(it[i].t);
  }
  return out.length === 1 && typeof out[0] === 'string' ? out[0] : out;
}
function pjPoner_(o, k, v) {
  if (v === '' || (Array.isArray(v) && !v.length)) return;
  var c = k, i = 2; while (Object.prototype.hasOwnProperty.call(o, c)) c = k + '_' + i++;
  o[c] = v;
}
/* El texto armado de un prompt → objeto por secciones (o una lista / un texto si no tiene títulos). */
function promptObj_(texto) {
  var grupos = [{ clave: null, secciones: [{ clave: null, lineas: [] }] }];
  String(texto || '').replace(/\r/g, '').split('\n').forEach(function (l) {
    l = l.trim(); if (!l) return;
    var g = grupos[grupos.length - 1], b = l.match(/^═══ (.+?) ═══$/), t;
    if (b && (t = pjTitulo_(b[1], true))) { grupos.push({ clave: t.clave, secciones: [{ clave: null, lineas: t.lineas }] }); return; }
    if ((t = pjTitulo_(l, false))) { g.secciones.push({ clave: t.clave, lineas: t.lineas }); return; }
    g.secciones[g.secciones.length - 1].lineas.push(l);
  });
  var armar = function (g, o) {
    if (g.secciones.length === 1) return pjHoja_(g.secciones[0].lineas);
    o = o || {}; g.secciones.forEach(function (s) { pjPoner_(o, s.clave || 'texto', pjHoja_(s.lineas)); });
    return o;
  };
  if (grupos.length === 1) return armar(grupos[0]);
  var out = {}, g0 = grupos[0];
  if (g0.secciones.length === 1) pjPoner_(out, 'texto', pjHoja_(g0.secciones[0].lineas)); else armar(g0, out);
  grupos.slice(1).forEach(function (g) { pjPoner_(out, g.clave, armar(g)); });
  return out;
}
function promptJson_(texto) { return JSON.stringify(promptObj_(texto)); }
