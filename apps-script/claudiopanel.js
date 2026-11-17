/* ═══ 15c · PANEL DE CLAUDIO (#550; Juan, 16-nov-2026) ════════════════════════════════════════════════════════════
   Mientras Juan habla con Claudio (claudio.js), la pantalla muestra lo que está haciendo desarrollo, como el tablero bento
   de Alma (tarjeta.js): Claudio minimizado abajo a la derecha con su halo naranja, «Terminar» y «Chat» abajo a la
   izquierda, cuadros blancos sobre el atardecer. Dos vistas, según el momento (decisión de Juan, 16-nov, prototipos A y B):
     A · lista   → al entrar con Claudio y cuando Juan pregunta qué están haciendo (claudio_estado sin trabajo) o después
                   de unir: un renglón por trabajo (nombre, paso actual, barra por pasos); el que pregunta va resaltado
                   con sus opciones tocables y lo listo dice «Di "une" para publicarlo».
     B · trabajo → cuando se habla de uno (claudio_estado con trabajo, o el pedido que se acaba de crear): arriba sus pasos
                   (hecho / en curso / pendiente), al lado cuántos están listos para unir y cuántos fallaron, abajo la
                   pregunta pendiente con sus opciones.
   POR ESTADO, como el tablero: se queda mientras dura la llamada con Claudio y lo reemplaza el siguiente (otra vista u
   otro trabajo); al volver con Alma o al colgar se quita.

   De dónde salen los pasos (Juan: «si no hay pasos reales, la etapa; nunca un porcentaje inventado»):
   · El Hub NO ve los pasos internos de una sesión de Claude Code (la tarea se dispara con una llave que solo sirve para
     dispararla, paraclaude.js) y el trabajo no publica una lista de tareas. Por eso los pasos son las ETAPAS que el Hub sí
     sabe por hechos: el microproyecto (en trabajo · Claude pregunta · listo para unir), su PR y sus revisiones en GitHub
     (prsAbiertos_: borrador, revisando, fallo, choque, listo) y, si Alma lo escaló, las de escalar.js (En desarrollo,
     Uniendo, Publicando, Entregando). La barra marca la etapa (en qué paso va de una lista fija), nunca un porcentaje.
     Lo único con números es lo que GitHub cuenta de verdad: «7 de 12 revisiones en verde».
   · Tocar una opción de una pregunta la responde por el MISMO camino que la tarjeta de Pendientes: la página manda
     pendienteResponder con el id «mp:<microproyecto>» (pendResponder_ → microResponder_). Aquí no se responde nada.

   Quién lo ve: SOLO el administrador principal y SOLO en el modo Claudio.
   · La candidata la dejan únicamente las herramientas de Claudio (claudioHerramienta_, que ya verificó la firma de la
     conversación de Claudio), igual que tvCandidata_ para Alma; se guarda por conversación (claudiopanel_<conv_id>).
   · La app la pide con la acción vozClaudioPanel { conv_id } y la sesión verificada del principal; sin candidata (recién
     entró con Claudio) arma la lista. Alma, el chat, WhatsApp y la familia nunca la tienen.
   · Nada sensible: solo nombres cortos ya limpios (sin enlaces, correos, teléfonos ni códigos) y lo que Claude preguntó.
   Armarla no llama a la IA: lee la hoja de microproyectos y la lista de cambios abiertos (en caché 45 s, unir.js). */

var CLAUDIO_PANEL_ = null;                 // la candidata del turno de una herramienta de Claudio: { vista, foco }
var CLAUDIO_PANEL_SEG_ = 21600;            // lo que dura la candidata de una llamada (como la tarjeta)
var CLAUDIO_PANEL_FILAS_ = 6;              // renglones de la lista; el resto se cuenta («y 2 más»)
/* Los pasos de cada trabajo: los de siempre (Juan une con «une») y los de lo que Alma escaló y une sola (escalar.js). */
var CLAUDIO_PASOS_ = ['Pedido recibido', 'Escribiendo el cambio', 'Revisiones', 'Listo para unir'];
var CLAUDIO_PASOS_SOLA_ = ['Pedido recibido', 'En desarrollo', 'Uniendo', 'Publicando', 'Entregando'];
var CLAUDIO_ESC_PASO_ = { por_unir: 2, publicando: 3, publicado: 4, entregando: 4 };
/* Las etapas que se muestran (y su orden en la lista: lo que necesita a Juan primero). */
var CLAUDIO_ETAPAS_ = { pregunta: 'Te pregunta', fallo: 'Falló', listo: 'Listo para unir', revisando: 'Revisando', escribiendo: 'Escribiendo' };
var CLAUDIO_ETAPA_ORDEN_ = ['pregunta', 'fallo', 'listo', 'revisando', 'escribiendo'];

/* Las herramientas de Claudio dejan la candidata (vista 'lista' o 'trabajo' con su foco: «mp:<id>» o palabras). */
function claudioPanelCandidata_(vista, foco) {
  CLAUDIO_PANEL_ = { vista: vista === 'trabajo' ? 'trabajo' : 'lista', foco: String(foco || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
}
/* Al cerrar la herramienta (claudioHerramienta_): la candidata queda para esta conversación de Claudio. */
function claudioPanelGuardar_(conv) {
  var cand = CLAUDIO_PANEL_; CLAUDIO_PANEL_ = null;
  conv = String(conv || '').trim();
  if (!cand || !/^conv_[\w-]{4,80}$/.test(conv)) return false;
  CacheService.getScriptCache().put('claudiopanel_' + conv, JSON.stringify({ vista: cand.vista, foco: cand.foco, t: Date.now() }), CLAUDIO_PANEL_SEG_);
  return true;
}

/* ── Acción vozClaudioPanel { conv_id }: el panel de esta llamada con Claudio (solo el principal, con su sesión) ── */
function claudioPanelApi_(ses, b) {
  b = b || {};
  if (!ses) return { ok: false, error: VOZ_SIN_SESION_ };   // no 'session': ese error cierra la sesión del navegador
  var adm = vozWebAdmin_(ses);
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'El panel de Claudio es solo para el administrador principal.' };
  var conv = String(b.conv_id || '').trim(), c = CacheService.getScriptCache(), spec = null;
  if (!/^conv_[\w-]{4,80}$/.test(conv)) conv = '';
  if (conv) {
    /* La conversación de Claudio de otra persona no se mira (claudioQuien_ la deja con su teléfono al primer uso). */
    var tel = c.get('claudio_' + conv);
    if (tel && !(adm.tels || []).some(function (x) { return fin8_(x) === fin8_(tel); })) return { ok: false, error: 'Esa llamada no es tuya.' };
    try { spec = JSON.parse(c.get('claudiopanel_' + conv) || 'null'); } catch (e) { spec = null; }
  }
  var panel = claudioPanelArmar_(adm, spec || { vista: 'lista', foco: '' });
  try { if (typeof vivoPanel_ === 'function') vivoPanel_(adm, conv, panel); } catch (e) { console.error('vivoPanel_: ' + e); }   // y al compañero (vivo.js)
  return { ok: true, panel: panel };
}

/* ── Armar el panel ── */
function claudioPanelArmar_(adm, spec) {
  spec = spec || {};
  var prs = null; try { prs = prsAbiertos_(false); } catch (e) { console.error('claudioPanel prs: ' + e); }
  var l = claudioTrabajos_(adm, prs);
  var t = spec.vista === 'trabajo' ? claudioTrabajoBuscar_(l, spec.foco) : null;
  var p = t ? claudioPanelTrabajo_(t, l) : claudioPanelLista_(l);
  p.tipo = 'claudio'; p.iniciales = 'C';
  if (!prs) p.aviso = 'GitHub no respondió: las revisiones pueden estar atrasadas.';
  p.clave = 'claudio:' + p.vista + (t ? ':' + t.id : '');
  /* El mismo contenido, el mismo id (la app no lo vuelve a armar); si algo cambió, otro id y se reemplaza con un fundido. */
  p.id = 'cp' + claudioPanelHuella_(JSON.stringify(p));
  return p;
}
function claudioPanelHuella_(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
/* Lo que se ve: corto y limpio (sin enlaces, correos, teléfonos, números largos ni códigos de reserva). */
function claudioPanelTexto_(t, max) {
  var x = orbitaLimpio_(String(t || '').replace(/\bHM[A-Z0-9]{8}\b/g, ' ').replace(/[«»"“”*_`#>]/g, '')).replace(/\s+/g, ' ').trim();
  max = max || 60;
  return x.length > max ? x.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : x;
}

/* Los trabajos de desarrollo del principal: sus microproyectos abiertos (con su PR y sus revisiones), lo que Alma escaló
   y une sola, y los cambios abiertos que no son de ningún microproyecto. Cada uno con su etapa y sus pasos. */
function claudioTrabajos_(adm, prs) {
  var ahora = Date.now(), email = String((adm && adm.email) || '').toLowerCase(), out = [], usados = {}, porUrl = {};
  var url = function (u) { return String(u || '').replace(/\/+$/, ''); };
  (prs || []).forEach(function (x) { porUrl[url(x.url)] = x; });
  var esc = {}; try { escalarEntregas_().forEach(function (e) { if (e && e.micro && String(e.email || '').toLowerCase() === email) esc[e.micro] = e; }); } catch (e) { console.error('claudioTrabajos_ escalar: ' + e); }
  var micros = []; try { micros = microAbiertos_(email, ahora); } catch (e) { console.error('claudioTrabajos_ micro: ' + e); }
  micros.forEach(function (m) {
    var e = esc[m.id] || null, pr = m.pr ? porUrl[url(m.pr)] || null : null;
    if (pr) usados[url(pr.url)] = 1;
    var sola = !!e, escDespues = e && CLAUDIO_ESC_PASO_[e.estado], escFallo = e && /^(fallo|no_unida|fallo_pub)$/.test(e.estado);
    var termino = m.estado === MICRO_ESTADOS_.cerrado || m.estado === MICRO_ESTADOS_.unido;
    if (termino && !escDespues && !(escFallo && ahora - Number(e.fin || e.t || 0) < 86400000)) return;
    /* Listo para unir, pero GitHub (que sí respondió) ya no lo tiene abierto: se unió o se cerró; microRevisar_ lo pondrá al día. */
    if (!termino && !sola && m.estado === MICRO_ESTADOS_.listo && m.pr && prs && !pr) return;
    var t = { id: 'mp:' + m.id, nombre: claudioPanelTexto_(m.nombre, 40) || 'Pedido para Claudio', ts: Number(m.actualizado) || 0, sola: sola, cual: pr ? pr.app + ' #' + pr.numero : '' };
    var et;
    if (escFallo) et = { etapa: 'fallo', i: e.estado === 'fallo' ? 1 : e.estado === 'no_unida' ? 2 : 3, por_que: e.estado === 'fallo' ? 'Claudio no pudo' : e.estado === 'no_unida' ? 'No se pudo unir' : 'Falló al publicar' };
    else if (escDespues) et = { etapa: 'listo', i: escDespues };
    else et = claudioEtapaMicro_(m, pr);
    if (sola && !escDespues && !escFallo) et.i = Math.min(et.i, 1);   // escalado y todavía en desarrollo: el paso «En desarrollo»
    out.push(claudioConPasos_(t, et, pr, sola ? CLAUDIO_PASOS_SOLA_ : CLAUDIO_PASOS_));
    if (et.etapa === 'pregunta' && (m.opciones || []).length) {
      t.pregunta = { id: 'mp:' + m.id, de: t.nombre, texto: claudioPanelTexto_(m.ultima_pregunta, 240), opciones: m.opciones.map(function (o) { return claudioPanelTexto_(o, 48); }).filter(Boolean).slice(0, 4) };
    } else if (et.etapa === 'pregunta') t.pregunta = { id: 'mp:' + m.id, de: t.nombre, texto: claudioPanelTexto_(m.ultima_pregunta, 240), opciones: [] };
  });
  /* Cambios abiertos sin microproyecto (p. ej. los que Juan pidió directo en una sesión de Claude). */
  (prs || []).forEach(function (x) {
    if (usados[url(x.url)]) return;
    var et = x.estado === 'borrador' ? { etapa: 'escribiendo', i: 1 } : x.estado === 'revisando' ? { etapa: 'revisando', i: 2 }
      : x.estado === 'fallo' ? { etapa: 'fallo', i: 2, por_que: 'Sus revisiones fallaron' } : x.estado === 'choque' ? { etapa: 'fallo', i: 2, por_que: 'Choca con lo último publicado' } : { etapa: 'listo', i: 3 };
    var t = { id: 'pr:' + x.app + '#' + x.numero, nombre: claudioPanelTexto_(x.titulo, 40) || x.app + ' #' + x.numero, ts: new Date(x.fecha || 0).getTime() || 0, sola: false, cual: x.app + ' #' + x.numero };
    out.push(claudioConPasos_(t, et, x, CLAUDIO_PASOS_));
  });
  return out.sort(function (a, b) {
    var d = CLAUDIO_ETAPA_ORDEN_.indexOf(a.etapa) - CLAUDIO_ETAPA_ORDEN_.indexOf(b.etapa);
    return d || b.ts - a.ts;
  });
}
/* La etapa de un microproyecto por hechos: lo que dijo Claude (pregunta, «no pudo», listo) y el estado de su PR. i: el paso. */
function claudioEtapaMicro_(m, pr) {
  if (m.estado === MICRO_ESTADOS_.pregunta) {
    var q = String(m.ultima_pregunta || '');
    if (/^claudio no pudo/i.test(q)) return { etapa: 'fallo', i: 1, por_que: claudioPanelTexto_(q.replace(/^claudio no pudo:?\s*/i, ''), 70) || 'Claudio no pudo' };
    return { etapa: 'pregunta', i: 1 };
  }
  if (m.estado === MICRO_ESTADOS_.trabajo) return { etapa: 'escribiendo', i: 1 };   // un ajuste en curso, aunque su PR ya exista
  if (pr && (pr.estado === 'fallo' || pr.estado === 'choque')) return { etapa: 'fallo', i: 2, por_que: pr.estado === 'choque' ? 'Choca con lo último publicado' : 'Sus revisiones fallaron' };
  if (pr && pr.estado === 'borrador') return { etapa: 'escribiendo', i: 1 };
  if (pr && pr.estado === 'revisando') return { etapa: 'revisando', i: 2 };
  return { etapa: 'listo', i: 3 };
}
/* Los pasos (hecho · en_curso · espera · fallo · pendiente) y la frase del paso actual. Nunca un porcentaje. */
function claudioConPasos_(t, et, pr, nombres) {
  var ck = pr && pr.checks && pr.checks.total ? pr.checks : null;
  var revis = ck ? (ck.fallas ? ck.fallas + ' de ' + ck.total + ' revisiones fallaron' : ck.ok + ' de ' + ck.total + ' revisiones en verde') : '';
  var i = Math.max(0, Math.min(nombres.length - 1, et.i));
  t.etapa = et.etapa; t.por_que = et.por_que || ''; t.indice = i; t.total = nombres.length;
  t.pasos = nombres.map(function (n, k) {
    var e = k < i ? 'hecho' : k > i ? 'pendiente' : et.etapa === 'fallo' ? 'fallo' : et.etapa === 'pregunta' ? 'espera' : et.etapa === 'listo' && !t.sola ? 'hecho' : 'en_curso';
    var p = { t: n, e: e };
    if (n === 'Revisiones' && revis && (e === 'en_curso' || e === 'fallo' || e === 'hecho')) p.d = revis;
    if (e === 'espera') p.d = 'Espera tu respuesta';
    if (e === 'fallo' && t.por_que) p.d = t.por_que;
    return p;
  });
  t.paso = et.etapa === 'pregunta' ? 'Te pregunta algo' : et.etapa === 'fallo' ? 'Falló · ' + (t.por_que || nombres[i])
    : et.etapa === 'listo' && !t.sola ? 'Listo para unir' + (ck && !ck.fallas ? ' · revisiones en verde' : '')
    : et.etapa === 'revisando' && revis ? 'Revisando · ' + revis : nombres[i];
  t.une = et.etapa === 'listo' && !t.sola;   // «Di "une" para publicarlo»; lo escalado lo une Alma sola
  return t;
}
/* El trabajo del que se habla: «mp:<id>» exacto, o el que más palabras comparte con lo que dijo Juan (o su número). */
function claudioTrabajoBuscar_(l, foco) {
  foco = String(foco || '').trim(); if (!foco || !l.length) return null;
  var exacto = l.filter(function (x) { return x.id === foco; })[0]; if (exacto) return exacto;
  var num = /#?\s*(\d{1,6})\b/.exec(foco);
  if (num) { var porNum = l.filter(function (x) { return x.cual && new RegExp('#' + num[1] + '$').test(x.cual); })[0]; if (porNum) return porNum; }
  var nf = chatNorm_(foco), pal = Object.keys(microPalabras_(foco)), mejor = null, pm = 0;
  l.forEach(function (x) {
    var nn = chatNorm_(x.nombre), p = nn && nf && (nn.indexOf(nf) >= 0 || nf.indexOf(nn) >= 0) ? 10 : 0, mp = microPalabras_(x.nombre);
    pal.forEach(function (w) { if (mp[w]) p += 3; });
    if (p > pm) { pm = p; mejor = x; }
  });
  return pm >= 3 ? mejor : null;
}
function claudioPanelFila_(t) {
  var o = { id: t.id, nombre: t.nombre, etapa: t.etapa, paso: t.paso, indice: t.indice, total: t.total, pasos: t.pasos.map(function (p) { return p.e; }) };
  if (t.une) o.une = true;
  if (t.sola) o.sola = true;
  if (t.pregunta) o.pregunta = t.pregunta;
  return o;
}
function claudioPanelCuenta_(l) {
  var n = function (e) { return l.filter(function (x) { return e === 'listo' ? x.une : x.etapa === e; }).length; };
  return { listos: n('listo'), preguntas: n('pregunta'), fallos: n('fallo') };
}
/* A · la lista de trabajos */
function claudioPanelLista_(l) {
  var filas = l.slice(0, CLAUDIO_PANEL_FILAS_), c = claudioPanelCuenta_(l);
  var sub = [c.preguntas ? (c.preguntas === 1 ? '1 te pregunta' : c.preguntas + ' te preguntan') : '', c.listos ? (c.listos === 1 ? '1 listo para unir' : c.listos + ' listos para unir') : '',
    c.fallos ? (c.fallos === 1 ? '1 falló' : c.fallos + ' fallaron') : ''].filter(Boolean).join(' · ');
  return { vista: 'lista', etiqueta: 'Claudio · Desarrollo', titulo: l.length ? 'Trabajando en ' + l.length : 'Sin trabajos abiertos',
    sub: sub || (l.length ? 'Todo sigue en curso' : 'Cuéntale a Claudio qué hacemos'),
    trabajos: filas.map(claudioPanelFila_), mas: l.length - filas.length,
    datos: filas.map(function (t) { return t.nombre + ' · ' + t.paso; }) };   // para la app que pinta la tarjeta de siempre
}
/* B · el trabajo del que se habla */
function claudioPanelTrabajo_(t, l) {
  var c = claudioPanelCuenta_(l), listos = l.filter(function (x) { return x.une; }), fallaron = l.filter(function (x) { return x.etapa === 'fallo'; });
  var preg = t.pregunta || (l.filter(function (x) { return x !== t && x.pregunta; })[0] || {}).pregunta || null;
  var marca = { hecho: '✓ ', en_curso: '• ', espera: '? ', fallo: '! ', pendiente: '○ ' };
  return { vista: 'trabajo', etiqueta: 'Claudio encontró', titulo: t.nombre, sub: CLAUDIO_ETAPAS_[t.etapa] + (t.cual ? ' · ' + t.cual : ''),
    trabajo: { id: t.id, nombre: t.nombre, etapa: t.etapa, paso: t.paso, indice: t.indice, total: t.total, pasos: t.pasos, une: !!t.une, sola: !!t.sola },
    listos: { n: c.listos, nombres: listos.slice(0, 2).map(function (x) { return x.nombre; }) },
    fallaron: { n: c.fallos, nombres: fallaron.slice(0, 2).map(function (x) { return x.nombre; }), por_que: fallaron.length ? fallaron[0].por_que : '' },
    pregunta: preg,
    datos: t.pasos.map(function (p) { return (marca[p.e] || '') + p.t + (p.d ? ' · ' + p.d : ''); }) };
}
