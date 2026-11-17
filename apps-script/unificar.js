/* ═══ UN PEDIDO, UN MICROPROYECTO, VENGA DE DONDE VENGA (Juan, 17-nov-2026, #715) ═══════════════════════════════
   Juan: «estamos desarrollando un concepto por diferentes medios o inclusive diferentes llamadas… a veces volvemos a
   hacer la solicitud pensando que no se ejecutó… se están creando diferentes instancias de una misma solicitud».
   Antes, solo el borrador del chat buscaba el microproyecto (microElegir_, por palabras). Lo que salía por otro camino
   (lo que Alma escala desde una llamada, WhatsApp o Maricarmen, el pedido a Desarrollo, Hablar con Claudio) abría
   siempre uno nuevo, y un reintento con otras palabras era otra sesión de Claude para lo mismo.
   Ahora todo pedido de Juan que no trae microproyecto pasa por microUnificar_ antes de abrir uno, con la misma dinámica
   de los temas de la conversación (temas.js): cada mensaje va a un tema, venga del canal que venga. En orden:
     1. Reintento: casi las mismas palabras que el pedido original de un microproyecto abierto.
     2. El tema del turno: si Alma ya eligió con certeza el tema de la conversación (anillo, tarjeta, cita, nombre o
        Jev) y ese tema tiene un microproyecto abierto, va ahí.
     3. Palabras en común con un microproyecto abierto (microElegir_, la regla de siempre; solo si es seguro).
     4. Jev (rapido.js), el mismo clasificador de los temas, con los microproyectos abiertos; solo con confianza alta.
   Si nada coincide, es uno nuevo. Nunca une lo que Juan dijo que es nuevo («Es nuevo», «es otro»).
   Un reintento mientras Claude todavía trabaja el original (sin respuesta suya y hace menos de 3 h) no dispara otra
   sesión: queda en el historial y en el issue, y Alma dice que ya estaba pedido. UNIF_JEV = 0 apaga el paso 4. */

var UNIF_REINTENTO_H_ = 3;      // lo mismo dicho otra vez mientras Claude trabaja (sin respuesta suya) en 3 h: no sale otra sesión
var UNIF_PARECIDO_ = 0.6;       // parte de las palabras del pedido más corto que también están en el otro
var UNIF_COMUNES_MIN_ = 4;      // y al menos 4 palabras que cuentan en común (microPalabras_)
var UNIF_JEV_MAX_ = 5;          // a Jev van los 5 microproyectos abiertos más recientes
var UNIF_TEMA_POR_ = ['orbita', 'tarjeta', 'cita', 'nombre', 'jev', 'aclaracion'];   // el tema del turno se eligió con certeza
var UNIF_POR_ = { reintento: 'es el mismo pedido otra vez', tema: 'es el mismo tema de la conversación', palabras: 'habla de lo mismo', jev: 'habla de lo mismo' };
var UNIF_CANAL_ = { whatsapp: 'WhatsApp', llamada: 'una llamada', app: 'la app de Alma', hub: 'el chat', calle: 'el Modo calle', segundo_plano: 'segundo plano', claudio: 'Hablar con Claudio' };

/* Cuánto se parecen dos textos: palabras que cuentan en común y qué parte del más corto son. */
function unifParecido_(a, b) {
  var pa = microPalabras_(a), pb = microPalabras_(b), ka = Object.keys(pa), kb = Object.keys(pb);
  var comunes = ka.filter(function (w) { return pb[w]; }).length, menor = Math.min(ka.length, kb.length);
  return { comunes: comunes, indice: menor ? comunes / menor : 0 };
}
/* Lo que pidió Juan al abrir el microproyecto (su primer mensaje, sin el título de adelante). */
function unifOriginal_(m) {
  var a = (m.ajustes || []).filter(function (x) { return x.de !== 'claude'; })[0];
  return String(a ? a.texto : m.nombre || '');
}
function unifEsReintento_(texto, m) {
  var p = unifParecido_(texto, unifOriginal_(m));
  return p.comunes >= UNIF_COMUNES_MIN_ && p.indice >= UNIF_PARECIDO_;
}
/* Los microproyectos de Juan a los que se puede sumar (abiertos y sin cerrar; un unido de menos de 7 días es su segunda parte). */
function unifCandidatos_(adm) {
  return microAbiertos_(adm && adm.email).filter(function (m) { return m.estado !== MICRO_ESTADOS_.cerrado; });
}
/* El tema del turno (temas.js), si se eligió con certeza y tiene un microproyecto abierto. */
function unifPorTema_(adm, lista) {
  var s = typeof TEMA_ACT_ !== 'undefined' ? TEMA_ACT_ : null;
  if (!s || !s.id || s.pregunta || UNIF_TEMA_POR_.indexOf(String(s.por || '')) < 0) return null;
  if (adm && adm.email && s.email && String(s.email).toLowerCase() !== String(adm.email).toLowerCase()) return null;
  var ms = lista.filter(function (m) { return m.tema_id && m.tema_id === s.id; });
  return ms[0] || null;   // ya vienen del más reciente al más viejo
}
/* Jev elige entre los microproyectos abiertos (mismo clasificador que los temas). null si no está seguro. */
function unifJev_(texto, lista) {
  if (String(PropertiesService.getScriptProperties().getProperty('UNIF_JEV') || '1') === '0') return null;
  var l = lista.slice(0, UNIF_JEV_MAX_); if (!l.length) return null;
  var pedido = jevLimpiar_(texto); if (!pedido) return null;
  var crit = {}; l.forEach(function (m, i) { crit['m' + (i + 1)] = jevLimpiar_(m.nombre + ' · ' + unifOriginal_(m)).slice(0, 220); });
  crit.nuevo = 'Otro cambio distinto de todos los anteriores';
  var q = { micro: { type: 'choice', instructions: 'A cuál de los pedidos de cambio que ya están en trabajo corresponde este pedido nuevo del administrador (el mismo, una continuación o un reintento); «nuevo» si es otra cosa', criteria: crit } };
  var j = jevPreguntar_({ pedido: pedido }, q, 'Microproyectos · Jev', function (r) {
    var a = r && r.answers && r.answers.micro, ch = a && String(a.choice || '');
    var conf = Number(a && a.confidence != null ? a.confidence : a && a.probabilities && a.probabilities[ch]);
    if (!a || !crit.hasOwnProperty(ch) || !(conf >= 0 && conf <= 1)) return null;
    return { choice: ch, confianza: conf };
  });
  if (!j || !j.ok || j.choice === 'nuevo' || !(j.confianza >= JEV_UMBRAL_)) return null;
  return l[Number(String(j.choice).slice(1)) - 1] || null;
}

/* ── ¿A qué microproyecto abierto va este pedido? → { id, nombre, por } o null (uno nuevo) ──
   o.sinJev: no preguntarle a Jev (pruebas). */
function microUnificar_(adm, texto, o) {
  o = o || {}; texto = String(texto || '').trim();
  if (!adm || !esAdminPrincipal_(adm) || !texto) return null;
  var lista = unifCandidatos_(adm); if (!lista.length) return null;
  var r = function (m, por) { return { id: m.id, nombre: m.nombre, por: por }; };
  var mejor = null, mejorI = 0;
  lista.forEach(function (m) { var p = unifParecido_(texto, unifOriginal_(m)); if (p.comunes >= UNIF_COMUNES_MIN_ && p.indice >= UNIF_PARECIDO_ && p.indice > mejorI) { mejor = m; mejorI = p.indice; } });
  if (mejor) return r(mejor, 'reintento');
  var t = unifPorTema_(adm, lista); if (t) return r(t, 'tema');
  var el = null; try { el = microElegir_(adm, texto, ''); } catch (e) { console.error('microUnificar_ palabras: ' + e); }
  if (el && el.id && el.seguro) { var mp = lista.filter(function (m) { return m.id === el.id; })[0]; if (mp) return r(mp, 'palabras'); }
  if (!o.sinJev) { var mj = null; try { mj = unifJev_(texto, lista); } catch (e) { console.error('microUnificar_ Jev: ' + e); } if (mj) return r(mj, 'jev'); }
  return null;
}

/* ¿Claude todavía trabaja lo que se pidió por última vez, sin haber respondido? (un reintento no dispara otra sesión) */
function unifEnCurso_(m, ahora) {
  if (!m || m.estado !== MICRO_ESTADOS_.trabajo || microPrTermino_(m)) return false;
  var u = (m.ajustes || [])[m.ajustes.length - 1];
  return !!u && u.de !== 'claude' && (ahora || Date.now()) - Number(u.ts) < UNIF_REINTENTO_H_ * 3600000;
}
function unifCanal_(canal) { return UNIF_CANAL_[String(canal || '')] || ''; }
/* La nota que acompaña lo que se unió solo: para el historial de Claude y el issue. */
function unifNota_(uni, canal) {
  var c = unifCanal_(canal);
  return '(Llegó' + (c ? ' por ' + c : '') + ' sin decir a qué trabajo iba; el sistema lo sumó a este porque ' + (UNIF_POR_[uni.por] || 'habla de lo mismo') + '.)';
}
/* Un reintento mientras Claude trabaja: se anota en el microproyecto y en su issue, sin otra sesión. Devuelve lo que
   devuelve paraClaudeCrear_ (repetido: true). */
function unifAnotarReintento_(adm, m, texto, canal) {
  var quien = (adm && adm.nombre) || 'Juan', fecha = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm'), c = unifCanal_(canal);
  m.ajustes.push({ ts: Date.now(), de: 'juan', texto: '(Lo volvió a pedir' + (c ? ' por ' + c : '') + '; es el mismo pedido.) ' + String(texto).slice(0, 1200) });
  try { microGuardar_(m); } catch (e) { console.error('unifAnotarReintento_: ' + e); }
  if (m.issue) {
    try {
      microComentar_(m.issue, '**' + quien + ' lo volvió a pedir' + (c ? ' por ' + c : '') + '** · ' + fecha + ' (hora de Guatemala)\n\n' + literalBloque_(String(texto).slice(0, 1500)) +
        '_Es el mismo pedido: el sistema lo unió a este microproyecto y no abrió otra sesión ni otro issue. Claude: si ya respondiste, tómalo en cuenta en el siguiente ajuste._');
    } catch (e) { console.error('unifAnotarReintento_ issue: ' + e); }
  }
  return { ok: true, id: '', repetido: true, issue: m.issue || undefined, claude: true, nivel: m.nivel, nivelNota: '',
    micro: { id: m.id, nombre: m.nombre, ajuste: true, segunda: false, parte: m.parte, nivel: m.nivel, repetido: true },
    nota: 'Eso ya estaba pedido: sigue en «' + m.nombre + '».' };
}
