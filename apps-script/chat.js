/* ═══ CHAT ÚNICO CON ALMA (issue #334) ════════════════════════════════════════════════════════════════════
   Un solo chat por persona con Alma (hoja ALMA_OPERATIVO, conversación «op:<correo>»): Hub, app, WhatsApp y llamadas.
   Ya no hay un chat «Operativo» y otro «Desarrollo».
   · Cada turno lleva su esfera (las 6 del inicio) y una subcategoría, en las columnas esfera y subcategoria. Las pone
     la misma respuesta de Alma: al final escribe [[esfera: Propósito · Operación]] y el código la quita antes de guardar
     (sin otra llamada a la IA). Las filas viejas quedan en blanco: sin filtro se ven, y al contar valen como Propósito.
   · Lo que es Propósito · Desarrollo (pedir un cambio a las apps o a Alma) va DIRECTO a Claude como Pedido para Claude,
     sin preguntar, si quien escribe es el administrador principal. Si es otra persona, Alma se lo pasa a Juan en
     Pendientes. Las respuestas de Claude llegan al mismo chat, con canal «claude» y Propósito · Desarrollo.
   · Quién habla sale SIEMPRE de la sesión del login, nunca de un correo que mande la app. Solo el administrador
     principal puede leer el chat de otra persona («de»). */

var CHAT_SUBCATS_ = {
  'Propósito': ['Operación', 'Huéspedes', 'Equipo', 'Desarrollo', 'Mejora continua', 'Proyectos'],
  'Relaciones': ['Familia', 'Pareja', 'Amigos'],
  'Finanzas': ['Pagos', 'Facturas', 'Impuestos', 'Inversiones'],
  'Health': ['Salud', 'Ejercicio', 'Sueño', 'Comida'],
  'Comunidad': ['Ayudar', 'Grupos'],
  'Esencia': ['Hablar con Alma', 'Calma', 'Fe', 'Ideas']
};
var CHAT_DESARROLLO_ = { esfera: 'Propósito', subcategoria: 'Desarrollo' };
var CHAT_MIGRADO_PROP_ = 'CHAT_UNICO_MIGRADO';

function chatNorm_(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

/* La regla que se suma al prompt de la secretaria (agente.js): pide la etiqueta al final de cada respuesta. */
function chatClasificarRegla_() {
  return '\n\nCLASIFICACIÓN (regla fija, código): termina SIEMPRE tu respuesta con una última línea aparte, exactamente así: [[esfera: <esfera> · <subcategoría>]]. Nadie la ve: el sistema la quita.' +
    '\nEsferas: Propósito (su trabajo: Spacio AM, apartamentos, huéspedes, equipo, proveedores, las apps), Relaciones (familia, pareja, amigos), Finanzas (dinero, pagos, facturas, impuestos), ' +
    'Health (salud, ejercicio, sueño, comida), Comunidad (ayudar a otros, grupos), Esencia (vida interior, calma, fe, charla con Alma).' +
    '\nSubcategorías sugeridas: ' + Object.keys(CHAT_SUBCATS_).map(function (e) { return e + ': ' + CHAT_SUBCATS_[e].join(', '); }).join(' · ') + '.' +
    '\nUsa «Propósito · Desarrollo» SOLO cuando el mensaje pide cambiar, arreglar o agregar algo en las apps o en ti misma (el sistema). Preguntar cómo se usa algo no es Desarrollo. ' +
    'Con Desarrollo no uses mejora_para_claude ni pidas confirmación: el pedido le llega solo a Claude (o a Juan, si no hablas con el administrador principal). Responde en una o dos frases lo que entendiste.';
}

/* Esfera válida (una de las 6) o ''. Acepta sin acentos y los nombres viejos de Pendientes (salud, espiritualidad). */
function chatEsfera_(x) {
  var n = chatNorm_(x); if (!n) return '';
  var alias = { salud: 'Health', espiritualidad: 'Esencia', proposito: 'Propósito' };
  if (alias[n]) return alias[n];
  return USOM_ESFERAS_.filter(function (e) { return chatNorm_(e) === n; })[0] || '';
}
/* Subcategoría: la sugerida con su forma exacta si coincide; si no, la que escribió, corta. */
function chatSubcat_(esfera, x) {
  var n = chatNorm_(x); if (!n) return '';
  var todas = [].concat.apply([], Object.keys(CHAT_SUBCATS_).map(function (e) { return CHAT_SUBCATS_[e]; }));
  var hit = (CHAT_SUBCATS_[esfera] || []).concat(todas).filter(function (s) { return chatNorm_(s) === n; })[0];
  if (hit) return hit;
  var t = String(x).replace(/[\[\]"«»]/g, '').trim().slice(0, 40);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/* Quita la etiqueta [[esfera: … · …]] del texto y devuelve { texto, esfera, subcategoria }. Sin etiqueta: esfera ''. */
function chatSacarEtiqueta_(texto) {
  var esf = '', sub = '';
  var limpio = String(texto || '').replace(/\[\[\s*esfera\s*:?\s*([^\]]*?)\s*\]\]/gi, function (_, adentro) {
    var p = String(adentro).split(/\s*[·|\/]\s*|\s+-\s+/);
    var e = chatEsfera_(p[0]);
    if (e) { esf = e; sub = chatSubcat_(e, p.slice(1).join(' ')); }
    return '';
  }).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, esfera: esf, subcategoria: sub };
}
function chatEsDesarrollo_(c) { return !!c && c.esfera === 'Propósito' && chatNorm_(c.subcategoria) === 'desarrollo'; }

/* Pone esfera y subcategoría a filas ya guardadas (busca su id entre las últimas 400). */
function opMarcar_(ids, c) {
  ids = (ids || []).filter(Boolean); if (!ids.length || !c || !c.esfera) return 0;
  var sh = hojaOp_(), n = sh.getLastRow(); if (n < 2) return 0;
  var desde = Math.max(2, n - 399), col = OP_CAB_.indexOf('id') + 1, cE = OP_CAB_.indexOf('esfera') + 1, hechas = 0;
  sh.getRange(desde, col, n - desde + 1, 1).getValues().forEach(function (r, i) {
    if (ids.indexOf(String(r[0])) >= 0) { sh.getRange(desde + i, cE, 1, 2).setValues([[c.esfera, c.subcategoria || '']]); hechas++; }
  });
  return hechas;
}

/* ── Quién habla: la sesión del login (correo y correos alternos), nunca el body ── */
function chatSesAdm_(ses) {
  if (!ses || !ses.email) return null;
  var cs = [ses.email].concat(String(ses.email_alterno || '').split(/[\s,;]+/)).map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean);
  var a = adminsOp_().filter(function (x) { return cs.some(function (c) { return c === x.email || (x.alternos || []).indexOf(c) >= 0; }); })[0];
  return a || adminPorEmail_(cs[0]);
}
function chatPrincipal_() { return adminsOp_().filter(function (a) { return a.principal; })[0] || null; }

/* ── Cerrar un turno: guarda la clasificación y, si es Desarrollo, lo pasa a Claude (o a Juan) ──
   adm: quien habla · yoIds: sus filas ya guardadas · texto: lo que pidió · ag: lo que devolvió opAgente_.
   Devuelve { texto, clas, claude?, paraJuan? }: texto es la respuesta final de Alma para guardar. */
function chatTurnoCerrar_(adm, yoIds, texto, ag, o) {
  o = o || {};
  var clas = { esfera: (ag && ag.esfera) || '', subcategoria: (ag && ag.subcategoria) || '' };
  var out = { texto: String((ag && ag.respuesta) || ''), clas: clas };
  try { opMarcar_(yoIds, clas); } catch (e) { console.error('opMarcar_: ' + e); }
  if (!o.sinDesarrollo && chatEsDesarrollo_(clas)) {
    try { var d = chatDesarrollo_(adm, texto, out.texto, (ag && ag.hechas) || []); out.texto = d.texto; if (d.claude) out.claude = d.claude; if (d.paraJuan) out.paraJuan = true; }
    catch (e) { console.error('chatDesarrollo_: ' + (e.stack || e)); }
  }
  return out;
}
/* Propósito · Desarrollo: el principal → Pedido para Claude directo (sin confirmar); otra persona → Pendiente para Juan. */
function chatDesarrollo_(adm, texto, resp, hechas) {
  var out = { texto: String(resp || '') };
  texto = String(texto || '').trim(); if (!texto) return out;
  if ((hechas || []).some(function (h) { return h && h.tipo === 'mejora' && !h.error; })) return out;   // la herramienta ya se lo pasó
  if (esAdminPrincipal_(adm)) {
    var ult = chatUltimaDeClaude_(adm.email);
    var r = paraClaudeCrear_(adm, { titulo: texto.replace(/\s+/g, ' ').split(/[.!?]\s/)[0].slice(0, 80), app: 'Otro', tipo: 'mejora', prioridad: 'normal', sinChat: true,
      que_quiere: texto + (ult ? '\n\nPuede ser un seguimiento de tu última respuesta en su chat con Alma:\n' + ult : '') });
    out.claude = { ok: !!r.ok, id: r.id || '', directo: !!r.claude, issue: r.issue || '' };
    if (!r.ok) out.texto = (out.texto ? out.texto + '\n\n' : '') + 'No se lo pude pasar a Claude: ' + (r.error || 'error') + '.';
    else if (!r.claude) out.texto = (out.texto ? out.texto + '\n\n' : '') + r.nota;
    else if (!/claude/i.test(out.texto)) out.texto = (out.texto ? out.texto + '\n\n' : '') + 'Listo, ya se lo pasé a Claude. Te aviso aquí cuando responda.';
    return out;
  }
  var jefe = chatPrincipal_(), nombre = String(adm.nombre || adm.email || 'Alguien del equipo');
  if (jefe) {
    pendAvisar_(jefe, nombre + ' pide un cambio en el sistema:\n' + texto, { origen: 'chat', push: true,
      clasif: { tipo: 'atencion', area: 'proposito', proyecto: 'Desarrollo', titulo: tituloCorto_('Pedido de ' + nombre.split(' ')[0] + ': ' + texto, 100),
        resumen: texto.replace(/\s+/g, ' ').slice(0, 200), aviso: nombre.split(' ')[0] + ' pide un cambio en el sistema. ¿Se lo paso a Claude?', importancia: 2, acciones: [] } });
  }
  out.paraJuan = true;
  if (!/juan/i.test(out.texto)) out.texto = (out.texto ? out.texto + '\n\n' : '') + 'Se lo paso a Juan: él decide los cambios del sistema.';
  return out;
}
/* La última respuesta de Claude en el chat de esa persona, si es de las últimas 24 h (para un seguimiento). */
function chatUltimaDeClaude_(email) {
  try {
    var f = opFilas_(email, 300).filter(function (m) { return m.canal === 'claude' && m.de === 'alma'; }).pop();
    if (f && Date.now() - new Date(f.ts).getTime() < 86400000) return String(f.texto || '').slice(0, 3000);
  } catch (e) {}
  return '';
}

/* ── Acciones del Hub y de la app (hubApi_) ── */
/* opHilo { de?, antes?, n?, esfera?, subcategoria? }: el chat de quien tiene la sesión (o de «de», solo el principal). */
function chatHilo_(ses, b) {
  b = b || {};
  var yo = chatSesAdm_(ses); if (!yo) return { ok: false, error: 'session' };
  var de = String(b.de || '').trim().toLowerCase();
  var obj = de && de !== yo.email && (yo.alternos || []).indexOf(de) < 0 ? (esAdminPrincipal_(yo) ? adminPorEmail_(de) : null) : yo;
  if (!obj) return { ok: false, error: 'Solo el administrador principal ve el chat de otra persona.' };
  if (esAdminPrincipal_(yo)) { try { chatMigrarDesarrollo_(); } catch (e) { console.error('chatMigrarDesarrollo_: ' + e); } }
  var p = chatPagina_(opFilas_(obj.email, 3000), b);
  return { ok: true, usuario: obj.email, nombre: obj.nombre, tieneWA: (obj.tels || []).length > 0, mensajes: p.mensajes, conteo: p.conteo, hayMas: p.hayMas, antes: p.antes };
}
/* Una página del chat: los n mensajes (40 por defecto, máx. 200) antes de «antes» (id de un mensaje o fecha ISO),
   con el filtro de esfera/subcategoría si viene, y el conteo por esfera de todo el chat. Sin esfera = Propósito. */
function chatPagina_(filas, b) {
  var n = Math.max(1, Math.min(200, Number(b.n) || 40)), conteo = {};
  USOM_ESFERAS_.forEach(function (e) { conteo[e] = 0; });
  filas.forEach(function (m) { var e = m.esfera || 'Propósito'; conteo[e] = (conteo[e] || 0) + 1; });
  var fe = chatEsfera_(b.esfera), fs = chatNorm_(b.subcategoria);
  var L = filas.filter(function (m) { return (!fe || (m.esfera || 'Propósito') === fe) && (!fs || chatNorm_(m.subcategoria) === fs); });
  if (b.antes) {
    var k = -1; for (var i = L.length - 1; i >= 0; i--) if (L[i].id === String(b.antes)) { k = i; break; }
    if (k < 0) { var t = new Date(b.antes).getTime(); if (!isNaN(t)) L = L.filter(function (m) { return new Date(m.ts).getTime() < t; }); else L = []; }
    else L = L.slice(0, k);
  }
  var pag = L.slice(-n);
  return { mensajes: pag, conteo: conteo, hayMas: L.length > pag.length, antes: pag.length ? pag[0].id : '' };
}
/* opEnviar { texto, canal? }: escribe en SU chat. canal 'app' (la app de Alma) o 'hub' (por defecto). */
function chatEnviar_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var canal = String(b.canal || '') === 'app' ? 'app' : 'hub';
  return opProcesar_(adm, b.texto, canal, []);
}
/* opLista: un chat por persona con su último mensaje (solo el principal). Ya no hay fila «desarrollo». */
function chatLista_(ses) {
  var yo = chatSesAdm_(ses); if (!yo) return { ok: false, error: 'session' };
  if (!esAdminPrincipal_(yo)) return { ok: false, error: 'solo admin principal' };
  try { chatMigrarDesarrollo_(); } catch (e) { console.error('chatMigrarDesarrollo_: ' + e); }
  var filas = opFilas_('', 3000).filter(function (m) { return m.usuario && m.usuario !== DESARROLLO_.email; }), ult = {}, n = {};
  filas.forEach(function (m) { ult[m.usuario] = m; n[m.usuario] = (n[m.usuario] || 0) + 1; });
  var lista = adminsOp_().map(function (a) { return { email: a.email, nombre: a.nombre, principal: a.principal, tieneWA: a.tels.length > 0, ultimo: ult[a.email] || null, total: n[a.email] || 0 }; });
  Object.keys(ult).forEach(function (e) { if (!lista.some(function (x) { return x.email === e; })) lista.push({ email: e, nombre: ult[e].nombre, principal: false, tieneWA: false, ultimo: ult[e], total: n[e] }); });
  lista.sort(function (a, b) { return String(b.ultimo ? b.ultimo.ts : '').localeCompare(String(a.ultimo ? a.ultimo.ts : '')); });
  return { ok: true, lista: lista };
}
/* «hilo» con resId op:<correo> (lista de conversaciones del Hub): solo el suyo, o cualquiera si es el principal.
   op:desarrollo (apps viejas) = el chat del principal, solo lo de Propósito · Desarrollo. */
function chatHiloOp_(ses, resId) {
  var yo = chatSesAdm_(ses); if (!yo) return { ok: false, error: 'session' };
  var de = String(resId || '').slice(3).toLowerCase(), ppal = esAdminPrincipal_(yo);
  if (de === DESARROLLO_.email) { if (!ppal) return { ok: false, error: 'Solo el administrador principal.' }; return { ok: true, hilo: opHiloHub_(yo.email, CHAT_DESARROLLO_) }; }
  if (de !== yo.email && (yo.alternos || []).indexOf(de) < 0 && !ppal) return { ok: false, error: 'Solo el administrador principal ve el chat de otra persona.' };
  return { ok: true, hilo: opHiloHub_(de === yo.email || (yo.alternos || []).indexOf(de) >= 0 ? yo.email : de) };
}
/* «responder» con resId op:… : solo en SU chat. op:desarrollo (apps viejas) = Pedido para Claude desde el chat del principal. */
function chatResponderOp_(ses, b) {
  var de = String(b.resId || '').slice(3).toLowerCase();
  if (de === DESARROLLO_.email) return paraClaudeDesdeChat_(ses, b.texto);
  var yo = chatSesAdm_(ses); if (!yo) return { ok: false, error: 'session' };
  if (de !== yo.email && (yo.alternos || []).indexOf(de) < 0) return { ok: false, error: 'Solo puedes escribir en tu propio chat con Alma.' };
  if (Array.isArray(b.adj) && b.adj.length) return { ok: false, error: 'Aquí no se mandan archivos: usa la foto del chat de la roca.' };
  var r = opProcesar_(yo, b.texto, 'hub', []);
  return r.ok ? { ok: true, alma: r.alma } : r;
}

/* ── Migración (una vez): el chat «Desarrollo» pasa al chat del principal como Propósito · Desarrollo ──
   Cambia en su lugar las filas con usuario «desarrollo» (así quedan en orden de fecha) y marca CHAT_UNICO_MIGRADO.
   Repetirla no hace nada. También se puede correr a mano desde el editor: migrarChatUnico(). */
function chatMigrarDesarrollo_() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(CHAT_MIGRADO_PROP_)) return { ok: true, ya: true, movidas: 0 };
  var jefe = chatPrincipal_(); if (!jefe) return { ok: false, error: 'sin administrador principal' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'ocupado' };
  try {
    if (P.getProperty(CHAT_MIGRADO_PROP_)) return { ok: true, ya: true, movidas: 0 };
    var sh = hojaOp_(), n = sh.getLastRow(), movidas = 0;
    if (n >= 2) {
      var v = sh.getRange(2, 1, n - 1, OP_CAB_.length).getValues();
      var cU = OP_CAB_.indexOf('usuario'), cN = OP_CAB_.indexOf('nombre'), cC = OP_CAB_.indexOf('canal'), cE = OP_CAB_.indexOf('esfera'), cS = OP_CAB_.indexOf('subcategoria');
      v.forEach(function (r, i) {
        if (String(r[cU]).trim().toLowerCase() !== DESARROLLO_.email) return;
        r[cU] = jefe.email; r[cN] = jefe.nombre; r[cC] = 'claude'; r[cE] = CHAT_DESARROLLO_.esfera; r[cS] = CHAT_DESARROLLO_.subcategoria;
        sh.getRange(i + 2, 1, 1, OP_CAB_.length).setValues([r]); movidas++;
      });
    }
    P.setProperty(CHAT_MIGRADO_PROP_, new Date().toISOString() + ' · ' + movidas);
    return { ok: true, movidas: movidas };
  } finally { lock.releaseLock(); }
}
function migrarChatUnico() { return chatMigrarDesarrollo_(); }

/* Una llamada de un administrador: la esfera que más se repite en sus turnos de esa llamada (los que pasaron por la
   secretaria ya traen la suya). Si no hay ninguno, una sola clasificación barata del resumen de la llamada. */
function chatClasLlamada_(adm, t0, dur, titulo, resumen) {
  var cuenta = {}, mejor = null;
  try {
    var fin = t0 + (Number(dur) || 0) * 1000 + 120000;
    opFilas_(adm.email, 200).forEach(function (m) {
      var t = new Date(m.ts).getTime(); if (!m.esfera || m.canal !== 'llamada' || t < t0 - 60000 || t > fin) return;   // solo sus turnos de voz
      var k = m.esfera + '|' + (m.subcategoria || ''); cuenta[k] = (cuenta[k] || 0) + 1;
      if (!mejor || cuenta[k] > cuenta[mejor]) mejor = k;
    });
  } catch (e) {}
  if (mejor) return { esfera: mejor.split('|')[0], subcategoria: mejor.split('|')[1] };
  var de = String((titulo || '') + '\n' + (resumen || '')).trim(); if (!de) return { esfera: '', subcategoria: '' };
  var t = '';
  try { t = String(claude_(CFG.MODELO_CLASIFICADOR, 30, 'Clasificas una llamada de una persona con su asistente Alma. Responde SOLO una línea: [[esfera: <esfera> · <subcategoría>]].' + chatClasificarRegla_().split('\n').slice(2, 4).join('\n'), de.slice(0, 2000), 0) || ''); } catch (e) {}
  var c = chatSacarEtiqueta_(t);
  return { esfera: c.esfera, subcategoria: c.subcategoria };
}
