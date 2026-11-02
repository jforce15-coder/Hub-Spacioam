/* ═══ RECETAS: lo que Alma aprendió y repite sin IA (issue #396, T1) ══════════════════════════════════════════════
   Idea de Atticus (github.com/SaarthurR/atticus-mac, MIT: learn / unlearn / like / save_skills), adaptada al agente de Alma.
   · Cuando un turno del administrador principal termina bien y TODO lo que hizo son acciones que se pueden repetir igual
     (RECETAS_REPETIBLES_), Alma guarda la receta en ALMA_RECETAS: las palabras del pedido, los pasos (herramienta + datos)
     y lo que respondió. Los nombres, fechas y números del pedido que aparecen en los pasos quedan como variables.
   · Antes de llamar a la IA en un turno nuevo, se busca una receta con las mismas palabras (en cualquier orden) o las
     mismas con otro nombre, fecha o número en el lugar de la variable. Si hay, los pasos corren directo por agEjecutar_
     (el mismo ejecutor de siempre), la respuesta guardada se adapta y termina con «(lo hice de memoria)»: sin IA.
   · Nunca aprende si: no pudo confirmar el resultado (un paso con error, una respuesta que dice que no pudo o que pregunta),
     el pedido depende del momento («esto», «eso», «aquí», «ahí»), hubo que leer o buscar algo (los datos de la acción
     pueden salir de esa lectura), es un mensaje a un huésped, o es borrar o pagar.
   · Si un paso repetido falla, la receta se olvida y el mismo turno sigue con la IA (sabiendo lo que ya quedó hecho).
   · Las que no se usan en 30 días se borran; las que Juan nombra («cuando diga X, haz Y») se quedan (mia).
   · RECETAS_ON = 0 apaga todo (por defecto encendido). Ajustes → Lo que Alma aprendió (alma/aprendio.html) las lista y
     las borra (acciones «recetas» y «recetaBorrar»). RECETAS_USO cuenta las usadas hoy y en total (lo que se ahorró). */

var RECETAS_HOJA_ = 'ALMA_RECETAS';
var RECETAS_CAB_ = ['clave', 'palabras', 'molde', 'vars', 'pasos', 'respuesta', 'esfera', 'subcategoria', 'creada', 'usada', 'usos', 'mia', 'pedido'];
var RECETAS_DIAS_ = 30, RECETAS_MAX_PALABRAS_ = 14, RECETAS_MAX_VARS_ = 3;
/* Lo que se puede repetir tal cual: herramienta → true o una función que mira los datos. Lo que no está aquí (leer,
   buscar, mensajes a huéspedes o personales, borrar, cancelar, pagar, unir, pedidos a Claude) nunca se aprende. */
var RECETAS_REPETIBLES_ = {
  musica: function (i) { return ['poner', 'pausar', 'seguir', 'siguiente', 'anterior', 'volumen'].indexOf(String(i.accion || '')) >= 0; },
  crear_tarea: true,
  agendar_en_epi: true,
  escribir_a_equipo: function (i) { return !i.al_responder && !i.numero; },   // con al_responder deja un encargo que depende del momento
  programar_mensaje: true,
  enviar_archivo: true
};
var RECETAS_HERR_TXT_ = { musica: 'Música', crear_tarea: 'Tarea', agendar_en_epi: 'Epi', escribir_a_equipo: 'WhatsApp al equipo', programar_mensaje: 'Mensaje programado', enviar_archivo: 'Archivo por WhatsApp' };
/* Campos donde un nombre del pedido es un dato (no texto libre): si la palabra está aquí, es variable. */
var RECETAS_CAMPOS_NOMBRE_ = ['persona', 'propiedad', 'tecnico', 'quien', 'consulta', 'dispositivo', 'trabajo'];
/* Palabras vacías: no cambian el pedido. «no» sí cambia, por eso no está. */
var RECETAS_VACIAS_ = ('a al alma de del el la las los lo un una unos unas en y e o u que por para con mi mis me te se le les su sus tu tus ' +
  'porfa porfavor favor please oye hola ya pues bueno eh ok okay va dale gracias').split(' ');
/* Depende del momento («cierra esto»): ni se aprende ni se repite. Como DEICTIC de Atticus. */
var RECETAS_DEICTICO_ = /(^|\s)(esto|eso|esta|este|esa|ese|estos|esos|estas|esas|aqui|ahi|alli|alla|aca|aquel\w*|lo mismo|otra vez|de nuevo|igual que)(\s|$)/;
/* La respuesta admite que no se hizo o pregunta algo: no hay resultado confirmado. Como FAILED de Atticus. */
var RECETAS_FALLO_ = /no (pude|se pudo|logre|encontre|tengo|puedo|esta disponible|salio)|fall(o|aron)|error|intenta de nuevo|\?/;
var RECETAS_MESES_ = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
var RECETAS_DIAS_SEM_ = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
var RECETAS_NOMBRADA_ = /^\s*(?:alma[\s,]+)?cuando (?:te )?digas?\s+[«"“']?(.+?)[»"”']?\s*[,:]\s*(?:tu\s+)?(.+)$/i;

function recetasOn_() { return String(PropertiesService.getScriptProperties().getProperty('RECETAS_ON') || '1') !== '0'; }
function recNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function recHoy_() { return Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'); }

/* ── Las palabras de un pedido: cada una con lo que se escribió (s), normalizada (n) y su tipo (palabra · fecha · num).
   Las fechas se resuelven al día de hoy: «mañana», «pasado mañana», «el viernes», «5 de noviembre», 2026-11-05, 5/11. */
function recPalabras_(texto) {
  var t = String(texto || '').replace(/^\s*m[uú]sica\s*:\s*/i, '');   // la voz antepone «Música:» (voz.js)
  var crudas = t.match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9:\/-]*/g) || [], w = crudas.map(function (s) { return { s: s, n: recNorm_(s).replace(/[^a-z0-9:\/-]/g, '') }; });
  var hoy = recHoy_(), out = [];
  for (var i = 0; i < w.length; i++) {
    var a = w[i], b = w[i + 1], c = w[i + 2], prev = out.length ? out[out.length - 1].n : '', f = '';
    if (a.n === 'pasado' && b && b.n === 'manana') { out.push({ s: a.s + ' ' + b.s, n: 'pasado manana', tipo: 'fecha', valor: sumarDias_(hoy, 2) }); i++; continue; }
    if (a.n === 'manana' && ['la', 'esta', 'en', 'por', 'cada'].indexOf(prev) < 0 && !(w[i - 1] && /^(la|por|en)$/.test(w[i - 1].n))) f = sumarDias_(hoy, 1);
    else if (a.n === 'hoy') f = hoy;
    else if (RECETAS_DIAS_SEM_[a.n] != null) { var dw = new Date(hoy + 'T12:00:00').getDay(); f = sumarDias_(hoy, (RECETAS_DIAS_SEM_[a.n] - dw + 7) % 7); }
    else if (/^\d{4}-\d\d-\d\d$/.test(a.n)) f = a.n;
    else if (/^\d{1,2}\/\d{1,2}$/.test(a.n)) f = recFechaDe_(+a.n.split('/')[0], +a.n.split('/')[1], hoy);
    else if (/^\d{1,2}$/.test(a.n) && b && b.n === 'de' && c && RECETAS_MESES_[c.n]) { out.push({ s: a.s + ' ' + b.s + ' ' + c.s, n: a.n + ' de ' + c.n, tipo: 'fecha', valor: recFechaDe_(+a.n, RECETAS_MESES_[c.n], hoy) }); i += 2; continue; }
    if (f) { out.push({ s: a.s, n: a.n, tipo: 'fecha', valor: f }); continue; }
    if (/^\d+(:\d\d)?$/.test(a.n)) { out.push({ s: a.s, n: a.n, tipo: 'num' }); continue; }
    if (a.n) out.push({ s: a.s, n: a.n, tipo: 'palabra' });
  }
  return out;
}
function recFechaDe_(d, m, hoy) {
  var y = +hoy.slice(0, 4), iso = function (yy) { return yy + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); };
  return iso(y) < sumarDias_(hoy, -1) ? iso(y + 1) : iso(y);
}
/* Lo que importa del pedido: sin palabras vacías. */
function recGist_(texto) { return recPalabras_(texto).filter(function (p) { return p.tipo !== 'palabra' || RECETAS_VACIAS_.indexOf(p.n) < 0; }); }
function recClave_(gist) { return gist.map(function (p) { return p.n; }).sort().join(' '); }
function recDeictico_(texto) { return RECETAS_DEICTICO_.test(' ' + recNorm_(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' '); }

/* ── La hoja ── */
function recHoja_() { return hojaCrear_(RECETAS_HOJA_, RECETAS_CAB_); }
function recFilas_() {
  var sh = recHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, RECETAS_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: i + 2 }; RECETAS_CAB_.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : v[j]; });
    try { o.vars = JSON.parse(o.vars || '[]'); o.pasos = JSON.parse(o.pasos || '[]'); } catch (e) { o.vars = []; o.pasos = []; }
    o.usos = Number(o.usos) || 0; o.mia = String(o.mia) === 'si' || o.mia === true; o.clave = String(o.clave || ''); return o;
  }).filter(function (o) { return o.clave; });
}
function recVieja_(r, ahora) {
  if (r.mia) return false;
  var t = Math.max(new Date(r.usada).getTime() || 0, new Date(r.creada).getTime() || 0);
  return ahora - t > RECETAS_DIAS_ * 86400000;
}
function recBorrarFila_(sh, fila) { if (sh.deleteRow) sh.deleteRow(fila); else sh.getRange(fila, 1, 1, RECETAS_CAB_.length).setValues([RECETAS_CAB_.map(function () { return ''; })]); }
/* Las que no se usan en 30 días se van (las de Juan se quedan). De abajo hacia arriba para no mover las filas. */
function recPurgar_() {
  var sh = recHoja_(), ahora = Date.now(), viejas = recFilas_().filter(function (r) { return recVieja_(r, ahora); });
  viejas.reverse().forEach(function (r) { recBorrarFila_(sh, r.fila); });
  return viejas.length;
}
function recetaOlvidar_(clave) {
  var sh = recHoja_(), r = recFilas_().filter(function (x) { return x.clave === clave; }).reverse();
  r.forEach(function (x) { recBorrarFila_(sh, x.fila); });
  return r.length;
}
function recGuardar_(o) {
  var sh = recHoja_(), ya = recFilas_().filter(function (x) { return x.clave === o.clave; })[0];
  var fila = RECETAS_CAB_.map(function (k) { var v = o[k]; return k === 'vars' || k === 'pasos' ? JSON.stringify(v || []) : k === 'mia' ? (v ? 'si' : '') : v == null ? '' : v; });
  if (ya) sh.getRange(ya.fila, 1, 1, RECETAS_CAB_.length).setValues([fila]); else sh.appendRow(fila);
}

/* ── Aprender: después de un turno que terminó bien ──
   texto: lo que pidió · ctx: el del turno (llamadas = cada herramienta con su resultado) · res: lo que devolvió el bucle. */
function recetaAprender_(adm, texto, ctx, res) {
  if (!recetasOn_() || !adm || !esAdminPrincipal_(adm) || AGENTE_PERMITIDAS_ || !res || res.seguira) return null;
  texto = String(texto || '').trim(); if (!texto || texto.length > 220 || /\n/.test(texto)) return null;
  var nom = RECETAS_NOMBRADA_.exec(texto), dice = nom ? nom[1] : texto, haz = nom ? nom[2] : texto;
  if (recDeictico_(haz) || recDeictico_(dice)) return null;
  var resp = String(res.respuesta || '').replace(/\s*\(lo hice de memoria\)\s*$/i, '').trim();
  if (!resp || RECETAS_FALLO_.test(recNorm_(resp))) return null;
  if (res.micro || (res.esfera === 'Propósito' && recNorm_(res.subcategoria) === 'desarrollo')) return null;
  var llamadas = ctx.llamadas || [], nuevas = (ctx.hechas || []).slice(ctx.hechasAntes || 0);
  if (!llamadas.length || ctx.webBusco || nuevas.some(function (h) { return h && h.error; })) return null;
  var todas = llamadas.every(function (l) {
    var regla = RECETAS_REPETIBLES_[l.tool];
    return l.ok && regla && (regla === true || regla(l.input || {}));
  });
  if (!todas) return null;
  var gist = recGist_(dice); if (!gist.length || gist.length > RECETAS_MAX_PALABRAS_) return null;
  var pasos = llamadas.map(function (l) { return { tool: l.tool, input: JSON.parse(JSON.stringify(l.input || {})) }; });
  /* Variables: las palabras del pedido que aparecen en los datos de los pasos (nombres en sus campos, fechas, números). */
  var datos = JSON.stringify(pasos.map(function (p) { return p.input; })), datosN = recNorm_(datos);
  var enCampos = recNorm_(pasos.map(function (p) { return RECETAS_CAMPOS_NOMBRE_.map(function (k) { return p.input[k] == null ? '' : String(p.input[k]); }).join(' '); }).join(' ')).split(/[^a-z0-9]+/);
  var vars = [], explicadas = {};
  gist.forEach(function (p, i) {
    var es = p.tipo === 'fecha' ? datos.indexOf(p.valor) >= 0
      : p.tipo === 'num' ? new RegExp('(^|[^0-9])' + p.n.replace(':', '\\:') + '([^0-9]|$)').test(datos)
      : p.n.length >= 3 && enCampos.indexOf(p.n) >= 0 && datosN.indexOf(p.n) >= 0;
    if (es) { vars.push({ i: i, tipo: p.tipo === 'palabra' ? 'nombre' : p.tipo, s: p.s, n: p.n, valor: p.valor || '' }); if (p.valor) explicadas[p.valor] = 1; }
  });
  if (vars.length > RECETAS_MAX_VARS_) return null;
  /* Una fecha de los pasos que el pedido no dijo (p. ej. la tarea vence hoy): se guarda como «hoy + K» para que al repetirla
     mañana no quede con la fecha vieja. */
  var hoy = recHoy_();
  pasos.forEach(function (p) { recRecorrer_(p.input, function (s) {
    return s.replace(/\b(\d{4}-\d\d-\d\d)\b/g, function (m) {
      if (explicadas[m]) return m;
      var k = Math.round((new Date(m + 'T12:00:00') - new Date(hoy + 'T12:00:00')) / 86400000);
      return Math.abs(k) <= 7 ? '{{dia' + (k >= 0 ? '+' : '') + k + '}}' : m;
    });
  }); });
  var molde = gist.map(function (p, i) { var v = vars.filter(function (x) { return x.i === i; })[0]; return v ? '{' + v.tipo + '}' : p.n; });
  var clave = recClave_(gist), ahora = new Date().toISOString(), ya = recFilas_().filter(function (x) { return x.clave === clave; })[0];
  /* Nombrada por Juan: lo que respondió hoy habla del atajo («cuando digas…»); al repetirla basta con «Listo». */
  if (nom) resp = 'Listo';
  var o = { clave: clave, palabras: gist.map(function (p) { return p.n; }).join(' '), molde: molde.join(' '), vars: vars, pasos: pasos, respuesta: resp.slice(0, 1500),
    esfera: res.esfera || '', subcategoria: res.subcategoria || '', creada: ahora, usada: ya ? ya.usada : '', usos: ya ? ya.usos : 0, mia: !!nom || !!(ya && ya.mia), pedido: dice.slice(0, 200) };
  recGuardar_(o);   // la misma clave se reemplaza: una receta por pedido
  try { recPurgar_(); } catch (e) {}
  return o;
}
/* Aplica f a cada texto dentro de un objeto de datos (los pasos), en su lugar. */
function recRecorrer_(o, f) {
  Object.keys(o || {}).forEach(function (k) {
    if (typeof o[k] === 'string') o[k] = f(o[k]);
    else if (o[k] && typeof o[k] === 'object') recRecorrer_(o[k], f);
  });
  return o;
}

/* ── Reconocer: la receta de un pedido nuevo, o null. Como like() de Atticus: las mismas palabras en cualquier orden, o
   las mismas con otro nombre, fecha o número en el lugar de cada variable (en el orden en que se dijeron). */
function recetaBuscar_(texto, filas) {
  if (recDeictico_(texto)) return null;
  var g = recGist_(texto); if (!g.length || g.length > RECETAS_MAX_PALABRAS_) return null;
  var ahora = Date.now(), mejor = null;
  (filas || recFilas_()).forEach(function (r) {
    if (recVieja_(r, ahora)) return;
    var molde = String(r.molde || '').split(' ').filter(Boolean); if (molde.length !== g.length) return;
    var fijas = molde.filter(function (w) { return !/^\{(nombre|fecha|num)\}$/.test(w); }), resto = g.slice(), ok = true;
    fijas.forEach(function (w) { var k = -1; for (var i = 0; i < resto.length; i++) if (resto[i].n === w) { k = i; break; } if (k < 0) ok = false; else resto.splice(k, 1); });
    if (!ok || resto.length !== r.vars.length) return;
    var nuevos = [];
    for (var j = 0; j < r.vars.length; j++) {
      var v = r.vars[j], p = resto[j], tipo = p.tipo === 'palabra' ? 'nombre' : p.tipo;
      if (tipo !== v.tipo) return;
      nuevos.push({ viejo: v, nuevo: p });
    }
    var puntos = (r.mia ? 10 : 0) - r.vars.length;
    if (!mejor || puntos > mejor.puntos) mejor = { receta: r, cambios: nuevos, puntos: puntos };
  });
  return mejor;
}
/* Una palabra sin importar acentos ni mayúsculas, como palabra entera. */
function recRegex_(w) {
  var m = { a: '[aáàä]', e: '[eéèë]', i: '[iíìï]', o: '[oóòö]', u: '[uúùü]', n: '[nñ]' };
  var cuerpo = recNorm_(w).split('').map(function (c) { return m[c] || c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }).join('');
  return new RegExp('(^|[^A-Za-zÀ-ÿ0-9])(' + cuerpo + ')(?=[^A-Za-zÀ-ÿ0-9]|$)', 'gi');
}
/* Cambia el valor viejo de una variable por el nuevo en un texto (datos de un paso o la respuesta guardada). */
function recCambiar_(s, c, enRespuesta) {
  var v = c.viejo, p = c.nuevo; s = String(s);
  if (v.tipo === 'fecha') { s = s.split(v.valor).join(p.valor); return enRespuesta ? s.replace(recRegex_(v.s), function (_, a) { return a + p.s; }) : s; }
  if (v.tipo === 'num') return s.replace(new RegExp('(^|[^0-9])' + v.n.replace(':', '\\:') + '(?=[^0-9]|$)', 'g'), function (_, a) { return a + p.n; });
  return s.replace(recRegex_(v.n), function (_, a, w) { var nv = p.s; if (/^[A-ZÁÉÍÓÚÑ]/.test(w)) nv = nv.charAt(0).toUpperCase() + nv.slice(1); else nv = nv.toLowerCase(); return a + nv; });
}
function recPasosListos_(r, cambios) {
  var hoy = recHoy_();
  return r.pasos.map(function (p) {
    var inp = recRecorrer_(JSON.parse(JSON.stringify(p.input || {})), function (s) {
      cambios.forEach(function (c) { s = recCambiar_(s, c, false); });
      return s.replace(/\{\{dia([+-]\d+)\}\}/g, function (_, k) { return sumarDias_(hoy, Number(k)); });
    });
    return { tool: p.tool, input: inp };
  });
}

/* ── Repetir: antes de llamar a la IA ──
   Devuelve null (no hay receta: sigue la IA), { ok: true, salida } (se hizo de memoria, sin IA) o
   { fallo: true, hechas, nota } (un paso falló: la receta se olvidó y la IA sigue con la nota de lo que ya quedó). */
function recetaIntentar_(adm, texto, canal) {
  if (!recetasOn_() || !adm || !esAdminPrincipal_(adm) || AGENTE_PERMITIDAS_) return null;
  texto = String(texto || '').trim(); if (!texto || texto.length > 220 || /\n/.test(texto) || RECETAS_NOMBRADA_.test(texto)) return null;
  var m = recetaBuscar_(texto); if (!m) return null;
  var r = m.receta, pasos = recPasosListos_(r, m.cambios);
  /* Una herramienta que hoy no está (música fuera de la app de Alma): no es un fallo, es que aquí no aplica. */
  if (pasos.some(function (p) { return !RECETAS_REPETIBLES_[p.tool] || (!AGENTE_APP_ && AG_SOLO_APP_.indexOf(p.tool) >= 0); })) return null;
  var ctx = { hechas: [], _cfg: null, cfg: function () { if (!this._cfg) this._cfg = epiSnap_(false); return this._cfg; } }, hechos = [];
  for (var i = 0; i < pasos.length; i++) {
    var p = pasos[i], antes = ctx.hechas.length, res;
    try { res = agEjecutar_(adm, p.tool, p.input, ctx); } catch (e) { res = { error: String(e.message || e).slice(0, 200) }; }
    var malo = !res || res.error || res.ok === false || ctx.hechas.slice(antes).some(function (h) { return h && h.error; });
    if (malo) {
      recetaOlvidar_(r.clave);
      var err = String((res && (res.error || res.nota)) || 'sin respuesta').slice(0, 200);
      return { fallo: true, hechas: ctx.hechas, nota: 'Intenté hacerlo de memoria y falló en el paso ' + (i + 1) + ' (' + (RECETAS_HERR_TXT_[p.tool] || p.tool) + ': ' + err + '). ' +
        (hechos.length ? 'Ya quedó hecho: ' + hechos.join('; ') + '. No lo repitas; ' : '') + 'Resuélvelo tú con tus herramientas.' };
    }
    hechos.push((ctx.hechas.slice(antes).map(function (h) { return h.resumen || h.tipo; }).join('; ')) || RECETAS_HERR_TXT_[p.tool] || p.tool);
  }
  var resp = String(r.respuesta || 'Listo.'); m.cambios.forEach(function (c) { resp = recCambiar_(resp, c, true); });
  resp = resp.replace(/[\s.]*$/, '') + '. (lo hice de memoria)';
  recUsada_(r);
  var salida = { respuesta: resp, hechas: ctx.hechas, esfera: r.esfera || '', subcategoria: r.subcategoria || '', micro: '', nivel: '', receta: r.clave };
  if (canal === 'segundo_plano') { try { pendEncolar_(adm, texto, resp + (ctx.hechas.length ? '\n\nHecho: ' + ctx.hechas.map(function (h) { return h.resumen || h.tipo; }).join('; ') : ''), canal); } catch (e) {} }
  return { ok: true, salida: salida };
}
function recUsada_(r) {
  try {
    r.usada = new Date().toISOString(); r.usos = (Number(r.usos) || 0) + 1; recGuardar_(r);
    var p = PropertiesService.getScriptProperties(), u = {}; try { u = JSON.parse(p.getProperty('RECETAS_USO') || '{}') || {}; } catch (e) {}
    var dia = recHoy_(); if (u.dia !== dia) { u.dia = dia; u.hoy = 0; }
    u.hoy = (u.hoy || 0) + 1; u.total = (u.total || 0) + 1; p.setProperty('RECETAS_USO', JSON.stringify(u));
  } catch (e) { console.error('recUsada_: ' + e); }
}

/* ── Ajustes → Lo que Alma aprendió (solo el administrador principal) ── */
function recetasApi_(ses) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  try { recPurgar_(); } catch (e) {}
  var u = {}; try { u = JSON.parse(PropertiesService.getScriptProperties().getProperty('RECETAS_USO') || '{}') || {}; } catch (e) {}
  var ahora = Date.now();
  var lista = recFilas_().map(function (r) {
    var t = Math.max(new Date(r.usada).getTime() || 0, new Date(r.creada).getTime() || 0);
    return { clave: r.clave, pedido: r.pedido || r.palabras, hace: r.pasos.map(function (p) { return RECETAS_HERR_TXT_[p.tool] || p.tool; }), cambia: r.vars.map(function (v) { return v.tipo; }),
      usos: r.usos, usada: r.usada || '', creada: r.creada || '', mia: r.mia, vence: r.mia ? '' : new Date(t + RECETAS_DIAS_ * 86400000).toISOString(), respuesta: r.respuesta };
  }).sort(function (a, b) { return (b.mia - a.mia) || String(b.usada || b.creada).localeCompare(String(a.usada || a.creada)); });
  return { ok: true, on: recetasOn_(), recetas: lista, hoy: u.dia === recHoy_() ? (u.hoy || 0) : 0, total: u.total || 0, actualizado: new Date(ahora).toISOString() };
}
function recetaBorrarApi_(ses, clave) {
  if (!paraClaudePrincipalSes_(ses)) return { ok: false, error: 'Solo el administrador principal.' };
  var n = recetaOlvidar_(String(clave || '')); return n ? { ok: true } : { ok: false, error: 'Ya no está.' };
}
