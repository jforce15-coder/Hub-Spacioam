/* ═══ CHAT ÚNICO CON ALMA (issue #334) ════════════════════════════════════════════════════════════════════
   Un solo chat por persona con Alma (hoja ALMA_OPERATIVO, conversación «op:<correo>»): Hub, app, WhatsApp y llamadas.
   Ya no hay un chat «Operativo» y otro «Desarrollo».
   · Cada turno lleva su esfera (las 6 del inicio) y una subcategoría, en las columnas esfera y subcategoria. Las pone
     la misma respuesta de Alma: al final escribe [[esfera: Propósito · Operación]] y el código la quita antes de guardar
     (sin otra llamada a la IA). Las filas viejas quedan en blanco: sin filtro se ven, y al contar valen como Propósito.
   · Lo que es Propósito · Desarrollo (pedir un cambio a las apps o a Alma) queda como BORRADOR del Pedido para Claude
     y Alma pregunta siempre «¿Se lo mando a Claude?» (Mándalo · Agregar algo · No lo envíes). Nada le llega a Claude
     hasta que Juan dice «mándalo» (decisión de Juan, 1-nov-2026; antes iba directo, #337). Si es otra persona, Alma se
     lo pasa a Juan en Pendientes. Las respuestas de Claude llegan al mismo chat, con canal «claude» y Propósito · Desarrollo.
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
    'Con Desarrollo no uses mejora_para_claude ni escribas tú la pregunta: el sistema arma el borrador del pedido y le pregunta a Juan «¿Se lo mando a Claude?» con sus botones (si no hablas con el administrador principal, se lo pasa a Juan). ' +
    'Nunca digas que ya se lo pasaste a Claude: no le llega nada hasta que Juan diga «mándalo». Responde en una o dos frases lo que entendiste.';
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

/* ── Cerrar un turno: guarda la clasificación y, si es Desarrollo, arma el borrador para Claude (o se lo pasa a Juan) ──
   adm: quien habla · yoIds: sus filas ya guardadas · texto: lo que pidió · ag: lo que devolvió opAgente_.
   o: { sinDesarrollo, canal ('llamada' = la pregunta se dice en voz, sin botones), diferir (la llamada ya no espera:
   la esfera se marca en la próxima pasada de procesarCola) }.
   Devuelve { texto, clas, borrador?, paraJuan? }: texto es la respuesta final de Alma para guardar. */
function chatTurnoCerrar_(adm, yoIds, texto, ag, o) {
  o = o || {};
  var clas = { esfera: (ag && ag.esfera) || '', subcategoria: (ag && ag.subcategoria) || '' };
  var out = { texto: String((ag && ag.respuesta) || ''), clas: clas };
  if (o.diferir) chatMarcarLuego_(yoIds, clas);
  else { try { opMarcar_(yoIds, clas); } catch (e) { console.error('opMarcar_: ' + e); } }
  var hechas = (ag && ag.hechas) || [], hizoBorrador = hechas.some(function (h) { return h && h.tipo === 'borrador_claude'; });
  if (!o.sinDesarrollo && (chatEsDesarrollo_(clas) || hizoBorrador)) {
    try { var d = chatDesarrollo_(adm, texto, out.texto, hechas, o); out.texto = d.texto; if (d.borrador) out.borrador = d.borrador; if (d.paraJuan) out.paraJuan = true; }
    catch (e) { console.error('chatDesarrollo_: ' + (e.stack || e)); }
  }
  return out;
}
/* Propósito · Desarrollo: el principal → borrador del Pedido para Claude + la pregunta «¿Se lo mando a Claude?» (nada
   se envía todavía); otra persona → Pendiente para Juan. Si la herramienta mejora_para_claude ya armó el borrador en
   este turno, no se vuelve a sumar el texto: solo se agrega la pregunta. */
function chatDesarrollo_(adm, texto, resp, hechas, o) {
  o = o || {};
  var out = { texto: String(resp || '') };
  texto = String(texto || '').trim(); if (!texto) return out;
  if (esAdminPrincipal_(adm)) {
    var ya = (hechas || []).some(function (h) { return h && h.tipo === 'borrador_claude'; });
    var b = ya ? (claudeBorradorLeer_(adm.email) || claudeBorradorPoner_(adm, texto)) : claudeBorradorPoner_(adm, texto);
    out.borrador = { partes: b.partes.length };
    out.texto = claudeBorradorConPregunta_(out.texto, b, o.canal);
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

/* ── Pedido para Claude: SIEMPRE se pregunta antes de mandarlo (decisión de Juan, 1-nov-2026) ─────────────────────
   Lo que Juan pide cambiar en el sistema queda como BORRADOR (uno por persona, propiedad CLAUDE_BORRADOR_<correo>).
   Alma le muestra en corto lo que le mandaría a Claude y pregunta «¿Se lo mando a Claude?» con 3 opciones
   (tarjeta de acción en el chat: Mándalo · Agregar algo · No lo envíes; en una llamada, la misma pregunta en voz).
   La respuesta puede llegar en el siguiente turno o por otro canal (voz, Hub, app, WhatsApp, Pendientes):
   «mándalo» / «sí» → se crea el Pedido para Claude (paraClaudeCrear_) · «agrégale X» → se suma al borrador y vuelve a
   preguntar · «no lo envíes» → se borra. Si en 24 h no responde, queda un Pendiente «Necesita tu sí» con las mismas
   opciones; el borrador se guarda 7 días más para que esa tarjeta funcione y luego se borra solo. */
var CLAUDE_BORR_PROP_ = 'CLAUDE_BORRADOR_', CLAUDE_BORR_VIGENCIA_ = 24 * 3600000, CLAUDE_BORR_GUARDA_ = 8 * 86400000;
var CLAUDE_BORR_PREGUNTA_ = '¿Se lo mando a Claude?', CLAUDE_BORR_AGREGO_ = '¿Qué le agrego al pedido para Claude?', CLAUDE_BORR_OPCIONES_ = ['Mándalo', 'Agregar algo', 'No lo envíes'];

function claudeBorradorLeer_(email) {
  if (!email) return null;
  var b = null; try { b = JSON.parse(PropertiesService.getScriptProperties().getProperty(CLAUDE_BORR_PROP_ + email) || 'null'); } catch (e) { b = null; }
  if (!b || !Array.isArray(b.partes) || !b.partes.length) return null;
  if (Date.now() - Number(b.t || 0) > CLAUDE_BORR_GUARDA_) { claudeBorradorGuardar_(email, null); return null; }
  return b;
}
function claudeBorradorGuardar_(email, b) {
  var P = PropertiesService.getScriptProperties();
  if (!b) { P.deleteProperty(CLAUDE_BORR_PROP_ + email); return; }
  /* Una propiedad guarda ~9 KB: el borrador se corta a 4000 caracteres en total (lo más nuevo se queda). */
  var ultima = String(b.partes[b.partes.length - 1] || ''), total = 0;
  b.partes = b.partes.slice().reverse().filter(function (x) { total += x.length; return total <= 4000; }).reverse();
  if (!b.partes.length) b.partes = [ultima.slice(0, 4000)];
  P.setProperty(CLAUDE_BORR_PROP_ + email, JSON.stringify(b));
}
/* Arma (o amplía) el borrador. Un borrador ya vencido (24 h sin respuesta) no se amplía: el pedido nuevo empieza otro. */
function claudeBorradorPoner_(adm, texto) {
  texto = String(texto || '').trim();
  var b = claudeBorradorLeer_(adm.email);
  if (b && b.vencido) { if (b.pend) { try { pendCerrar_(b.pend); } catch (e) {} } b = null; }
  if (!b) b = { t: Date.now(), partes: [], ult: chatUltimaDeClaude_(adm.email).slice(0, 1500) };
  if (texto && b.partes.indexOf(texto) < 0) b.partes.push(texto);
  b.u = Date.now(); b.espera = false;
  claudeBorradorGuardar_(adm.email, b);
  return b;
}
function claudeBorradorTitulo_(b) { return String(b.partes[0] || '').replace(/\s+/g, ' ').split(/[.!?]\s/)[0].slice(0, 80); }
function claudeBorradorCorto_(b, n) {
  var t = b.partes.join(' · Y además: ').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
}
/* La respuesta de Alma + lo que le mandaría a Claude + la pregunta. En el chat, las opciones van como viñetas «• »
   (SAChat.opciones las pinta como tarjeta de acción); en una llamada o en el modo calle (calle.js), solo la frase. */
function claudeBorradorConPregunta_(resp, b, canal) {
  resp = String(resp || '').trim();
  if (canal === 'llamada' || canal === 'calle') return (resp ? resp + ' ' : '') + 'Le pediría a Claude: «' + claudeBorradorCorto_(b, 240) + '». ' + CLAUDE_BORR_PREGUNTA_;
  return (resp ? resp + '\n\n' : '') + 'Esto es lo que le mandaría a Claude:\n«' + claudeBorradorCorto_(b, 400) + '»\n\n' + CLAUDE_BORR_PREGUNTA_ + '\n' +
    CLAUDE_BORR_OPCIONES_.map(function (x) { return '• ' + x; }).join('\n');
}
/* Qué quiere hacer con el borrador: mandar, agregar, cancelar o '' (no habla del borrador).
   tras = lo último que Alma le dijo en el chat fue la pregunta (o responde desde la tarjeta, o en la llamada con
   «Mejora para Claude: …»). Sin eso solo cuenta si nombra a Claude o el pedido, o si es el texto de un botón: así
   «agrega una tarea para Jorge» o «sí, mándalo» (un mensaje a un huésped) no tocan el borrador. */
function claudeBorradorIntencion_(texto, tras) {
  var n = chatNorm_(texto).replace(/[¡!¿?.,;:«»"()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  var boton = { 'mandalo': 'mandar', 'agregar algo': 'agregar', 'no lo envies': 'cancelar' }[n];
  if (boton) return boton;
  if (!tras && !/\b(claude|borrador|pedido)\b/.test(n)) return '';
  if (/\bno (lo |se lo )?(envies|mandes|envias|mandas)\b|^(cancela|cancelalo|olvidalo|descartalo|borralo|mejor no|no gracias|ya no)\b|^no$/.test(n)) return 'cancelar';
  /* «agrégale…» sí; «agrega una tarea…» no (es otro pedido): solo con «-le», «al pedido» o «también / además» tras la pregunta. */
  if (/^(agregale|anadele|sumale|ponle tambien|agrega(r)? (al|a el) (pedido|borrador)|anade al (pedido|borrador))\b/.test(n) || (tras && /^(tambien|ademas)\b/.test(n))) return 'agregar';
  if (/\b(mandalo|mandaselo|envialo|enviaselo|mandarselo|enviarselo|mandaselos)\b/.test(n) && !/\bno\b/.test(n)) return 'mandar';
  if (tras && /^(si|sii|si claro|claro|claro que si|dale|va|ok|okay|listo|de una|hazlo|adelante|perfecto|sale|si porfa|si por favor|si gracias|si dale)$/.test(n)) return 'mandar';
  return '';
}
/* Lo que agrega, sin el verbo: «agrégale que también avise a Ana» → «que también avise a Ana». */
function claudeBorradorAgregado_(texto) {
  return String(texto || '').trim()
    .replace(/^(agr[eé]gale|agregar( algo)?|agrega( algo)?|añ[aá]dele|añ[aá]de|añadir( algo)?|s[uú]male|suma|ponle tambi[eé]n|tambi[eé]n|adem[aá]s)\s*[:,.-]?\s*/i, '')
    .replace(/^(al (pedido|borrador)( (de|para) claude)?|a claude)\s*[:,.-]?\s*/i, '').trim();
}
/* El turno de alguien con un borrador abierto. Devuelve null si no habla del borrador; si sí:
   { accion: 'mandar'|'agregar'|'esperar'|'cancelar', texto (para el chat), voz (para la llamada), claude? }.
   o: { canal, desdeTarjeta (responde desde el Pendiente «Necesita tu sí») }. */
function claudeBorradorResponder_(adm, texto, o) {
  o = o || {};
  if (!adm || !esAdminPrincipal_(adm)) return null;
  var b = claudeBorradorLeer_(adm.email); if (!b) return null;
  var tras = !!(o.desdeTarjeta || o.explicito), ultAlma = '';
  if (!tras && !b.vencido) {
    try { var al = opFilas_(adm.email, 8).filter(function (m) { return m.de === 'alma'; }).pop(); ultAlma = al ? al.texto : ''; } catch (e) {}
    tras = ultAlma.indexOf(CLAUDE_BORR_PREGUNTA_) >= 0 || ultAlma.indexOf(CLAUDE_BORR_AGREGO_) >= 0;
  }
  var que = claudeBorradorIntencion_(texto, tras), voz = o.canal === 'llamada' || o.canal === 'calle';   // modo calle: también se dice en voz
  /* Tocó «Agregar algo» y Alma preguntó qué: lo que escribe ahora es lo que agrega. */
  if (!que && b.espera && !b.vencido && (o.explicito || ultAlma.indexOf(CLAUDE_BORR_AGREGO_) >= 0) && String(texto || '').trim()) que = 'agregar';
  if (!que) return null;
  var cerrarTarjeta = function () { if (b.pend) { try { pendCerrar_(b.pend); } catch (e) {} } };
  if (que === 'cancelar') {
    claudeBorradorGuardar_(adm.email, null); cerrarTarjeta();
    return { accion: 'cancelar', texto: 'Va, no se lo mando. Borré el borrador.', voz: 'BORRADOR DESCARTADO: no se le mandó nada a Claude. Dile en una frase corta que no se lo mandas.' };
  }
  if (que === 'agregar') {
    var extra = b.espera && !claudeBorradorIntencion_(texto, true) ? String(texto).trim() : claudeBorradorAgregado_(texto);
    if (/^agregar algo$/i.test(extra) || /^(al pedido|a claude|al borrador)$/i.test(extra)) extra = '';
    cerrarTarjeta(); b.pend = ''; b.vencido = false; b.u = Date.now();
    if (!extra) {
      b.espera = true; claudeBorradorGuardar_(adm.email, b);
      return { accion: 'esperar', texto: CLAUDE_BORR_AGREGO_ + ' Dímelo y lo sumo al pedido.', voz: 'Pregúntale en una frase qué le agregas al pedido para Claude. Todavía no se envía.' };
    }
    b.partes.push(extra); b.espera = false; claudeBorradorGuardar_(adm.email, b);
    return { accion: 'agregar', texto: claudeBorradorConPregunta_('Agregado.', b, voz ? 'llamada' : ''),
      voz: 'AGREGADO AL BORRADOR (todavía NO se envía). Dile en una frase cómo quedó («Ahora le pediría a Claude: …») y pregúntale otra vez «¿Se lo mando a Claude?». Borrador: «' + claudeBorradorCorto_(b, 300) + '».' };
  }
  /* mandar */
  var r = paraClaudeCrear_(adm, { titulo: claudeBorradorTitulo_(b), app: 'Otro', tipo: 'mejora', prioridad: 'normal', sinChat: true,
    que_quiere: b.partes.join('\n\nY además: ') + (b.ult ? '\n\nPuede ser un seguimiento de tu última respuesta en su chat con Alma:\n' + b.ult : '') });
  if (!r.ok) {
    return { accion: 'mandar', claude: { ok: false }, texto: 'No se lo pude mandar a Claude: ' + (r.error || 'error') + '. El borrador sigue guardado; dime «mándalo» para intentarlo otra vez.',
      voz: 'NO LE LLEGÓ A CLAUDE: ' + (r.error || 'error') + '. Díselo tal cual; el borrador sigue guardado.' };
  }
  claudeBorradorGuardar_(adm.email, null); cerrarTarjeta();
  var listo = r.claude ? 'Listo, ya se lo mandé a Claude. Te aviso aquí cuando responda.' : r.nota;
  return { accion: 'mandar', claude: { ok: true, id: r.id || '', directo: !!r.claude, issue: r.issue || '' }, texto: listo,
    voz: r.claude ? 'ENVIADO: Claude ya lo recibió. Dile en una frase: «Listo, ya se lo mandé a Claude; te aviso cuando responda».' : r.nota };
}
/* El turno de chat (Hub, app, WhatsApp o la tarjeta de Pendientes) que responde a un borrador: guarda la respuesta de Alma
   en el mismo chat como Propósito · Desarrollo y no llama a la IA. yo: su fila ya guardada (o null para guardarla aquí). */
function chatBorradorTurno_(adm, yo, texto, canal, o) {
  var rb = claudeBorradorResponder_(adm, texto, Object.assign({ canal: canal }, o || {})); if (!rb) return null;
  if (!yo) yo = opGuardar_(adm, 'yo', canal, texto, [], CHAT_DESARROLLO_);
  else { try { opMarcar_([yo.id], CHAT_DESARROLLO_); } catch (e) {} yo.esfera = CHAT_DESARROLLO_.esfera; yo.subcategoria = CHAT_DESARROLLO_.subcategoria; }
  var alma = opGuardar_(adm, 'alma', canal, rb.texto, [], CHAT_DESARROLLO_);
  if (canal === 'whatsapp' && adm.tels && adm.tels.length) { try { waEnviar_(adm.wa || adm.tels[0], rb.texto); } catch (e) { console.error('borrador WhatsApp: ' + e); } }
  var out = { ok: true, yo: yo, alma: alma, borrador: rb.accion };
  if (rb.claude) out.claude = rb.claude;
  return out;
}
/* Cada minuto (procesarCola): un borrador sin respuesta en 24 h deja un Pendiente «Necesita tu sí»; a los 8 días se borra.
   Barato: solo propiedades del script, sin IA ni internet. */
function claudeBorradoresRevisar_(ahora) {
  ahora = ahora || Date.now();
  var P = PropertiesService.getScriptProperties(), out = { pendientes: 0, borrados: 0 };
  (P.getKeys() || []).filter(function (k) { return k.indexOf(CLAUDE_BORR_PROP_) === 0; }).forEach(function (k) {
    var email = k.slice(CLAUDE_BORR_PROP_.length), b = null;
    try { b = JSON.parse(P.getProperty(k) || 'null'); } catch (e) {}
    if (!b || !Array.isArray(b.partes) || ahora - Number(b.t || 0) > CLAUDE_BORR_GUARDA_) {
      if (b && b.pend) { try { pendCerrar_(b.pend); } catch (e) {} }
      P.deleteProperty(k); out.borrados++; return;
    }
    if (b.vencido || ahora - Number(b.u || b.t || 0) < CLAUDE_BORR_VIGENCIA_) return;
    var adm = adminPorEmail_(email); if (!adm) return;
    var tit = claudeBorradorTitulo_(b) || 'Pedido para Claude', f = null;
    try {
      f = pendCrear_(adm, { tipo: 'atencion', area: 'proposito', proyecto: 'Desarrollo', titulo: 'Pedido para Claude sin enviar', importancia: 2,
        resumen: '«' + claudeBorradorCorto_(b, 160) + '» espera tu sí para mandárselo a Claude.',
        aviso: 'Tienes un pedido para Claude sin enviar: ' + tituloCorto_(tit, 100) + '. ¿Se lo mando?',
        tarjeta: { tipo: 'pregunta', esfera: CHAT_DESARROLLO_.esfera, subcategoria: CHAT_DESARROLLO_.subcategoria, opciones: CLAUDE_BORR_OPCIONES_ },
        acciones: [{ texto: 'Abrir el chat', url: chatEnlace_(CHAT_DESARROLLO_.esfera), chat: { esfera: CHAT_DESARROLLO_.esfera, conv: 'op:' + adm.email } }] },
        { origen: 'claude_borrador', detalle: b.partes.join('\n\nY además: '), push: true });
    } catch (e) { console.error('claudeBorradoresRevisar_: ' + e); return; }
    b.vencido = true; b.pend = f ? f.id : ''; P.setProperty(k, JSON.stringify(b)); out.pendientes++;
  });
  return out;
}
/* La llamada ya no espera (vozSecretaria_ pasó su plazo): la esfera de sus filas se marca en la próxima pasada. */
function chatMarcarLuego_(ids, clas) {
  ids = (ids || []).filter(Boolean); if (!ids.length || !clas || !clas.esfera) return;
  try {
    var P = PropertiesService.getScriptProperties(), cola = []; try { cola = JSON.parse(P.getProperty('CHAT_MARCAR_COLA') || '[]'); } catch (e) {}
    cola.push({ ids: ids, c: clas }); P.setProperty('CHAT_MARCAR_COLA', JSON.stringify(cola.slice(-30)));
  } catch (e) { console.error('chatMarcarLuego_: ' + e); }
}
function chatMarcarCola_() {
  var P = PropertiesService.getScriptProperties(), cola = []; try { cola = JSON.parse(P.getProperty('CHAT_MARCAR_COLA') || '[]'); } catch (e) {}
  if (!cola.length) return 0;
  P.deleteProperty('CHAT_MARCAR_COLA');
  var n = 0; cola.forEach(function (x) { try { n += opMarcar_(x.ids, x.c); } catch (e) { console.error('chatMarcarCola_: ' + e); } });
  return n;
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
/* opEnviar { texto, canal? }: escribe en SU chat. canal 'app' (la app de Alma), 'calle' (la app en Modo calle: la
   respuesta sale corta, para el oído, y sin [[conversar]]) o 'hub' (por defecto). La persona sale de la sesión. */
function chatEnviar_(ses, b) {
  b = b || {};
  var adm = chatSesAdm_(ses); if (!adm) return { ok: false, error: 'session' };
  var c = String(b.canal || ''), canal = c === 'app' || c === 'calle' ? c : 'hub';
  if (canal !== 'calle') return opProcesar_(adm, b.texto, canal, []);
  AGENTE_APP_ = true;   // Modo calle: viene de la app de Alma (como calle_)
  try { return opProcesar_(adm, b.texto, canal, []); } finally { AGENTE_APP_ = false; }
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

/* ── Pregunta sin responder (#334, T4) ─────────────────────────────────────────────────────────────────────
   Si Alma deja en el Chat con Alma del administrador principal una pregunta CON OPCIONES (las mismas que pinta la
   tarjeta de acción: SAChat.opciones en js/sa-chat.js) y pasan 10 minutos sin que él escriba nada en ese chat, queda
   un Pendiente «Necesita tu sí» con aviso al teléfono (pendCrear_ con push). Lleva la esfera y la subcategoría del
   mensaje de Alma y el botón «Abrir el chat» (el chat filtrado en esa esfera). Se cierra solo cuando él escribe en el
   chat después de la pregunta (cualquier mensaje suyo, también por voz), y «Responder» en la tarjeta escribe en el
   mismo chat (pendResponder_). Una por pregunta: las ya vistas quedan en la propiedad CHAT_PREGUNTAS.
   Barato: solo lee las últimas filas de ALMA_OPERATIVO (sin IA ni internet), así que corre cada minuto aunque el cupo
   de Google esté en riesgo. Fuera: lo de las llamadas (se responde hablando), lo de Claude (sus preguntas ya llegan a
   Pendientes) y las decisiones del equipo (tienen su propia tarjeta y las resuelve cualquiera del equipo). */
var CHAT_PREG_ESPERA_ = 10 * 60000, CHAT_PREG_VENTANA_ = 2 * 3600000, CHAT_PREG_PROP_ = 'CHAT_PREGUNTAS';
var CHAT_PREG_VINETA_ = /^\s*(?:[•\-*–]|\d{1,2}[.)])\s+(.+?)\s*$/;

/* La pregunta y sus opciones (2 a 5), como SAChat.opciones: un bloque [[opciones]] a | b [[/opciones]], o una línea
   con «?» seguida de 2 a 5 viñetas cortas («• », «- », «1.»). Sin opciones: null. */
function chatOpciones_(texto) {
  texto = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n'); if (!texto.trim()) return null;
  var titulo = function (t) {
    t = String(t || '').replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim(); if (!t) return '';
    var m = t.match(/^(.+?)\s+[—–-]\s+(.+)$/); return (m ? m[1] : t).replace(/[.;,]$/, '').trim();
  };
  var b = texto.match(/\[\[opciones\]\]([\s\S]*?)\[\[\/opciones\]\]/i);
  if (b) {
    var ops = b[1].split(/\||\n/).map(titulo).filter(Boolean);
    if (ops.length >= 2 && ops.length <= 5) {
      var antes = texto.slice(0, b.index).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var q = antes.filter(function (x) { return /\?/.test(x); }).pop() || antes.pop() || '';
      return { pregunta: q, opciones: ops };
    }
  }
  var L = texto.split('\n');
  for (var i = 0; i < L.length; i++) {
    if (!/\?\s*:?\s*$/.test(L[i])) continue;
    var j = i + 1; while (j < L.length && !L[j].trim()) j++;
    var lista = [], k = j;
    for (; k < L.length; k++) { var mv = L[k].match(CHAT_PREG_VINETA_); if (!mv) break; lista.push(mv[1]); }
    if (lista.length < 2 || lista.length > 5 || lista.some(function (x) { return x.length > 90; })) continue;
    var k2 = k; while (k2 < L.length && !L[k2].trim()) k2++;
    if (k2 < L.length && CHAT_PREG_VINETA_.test(L[k2])) continue;   // la lista sigue: es una lista larga, no opciones
    var tit = lista.map(titulo).filter(Boolean);
    if (tit.length >= 2) return { pregunta: L[i].trim(), opciones: tit };
  }
  return null;
}
/* La clave de Pendientes (areas.js) de una esfera del chat: «Esencia» → espiritualidad. Sin esfera: Propósito. */
function chatAreaDe_(esfera) { var a = AREAS_.filter(function (x) { return x.n === esfera; })[0]; return a ? a.k : 'proposito'; }
/* El enlace que abre el chat filtrado en esa esfera: «Alma aquí» (alma/index.html?esfera=…). La app y el Hub lo
   abren en su lugar con a.chat (js/sa-nav.js · SANav.chat); el Hub, en su Chat con Alma (?conv=op:<correo>&esfera=…). */
function chatEnlace_(esfera) {
  return 'https://hub.spacioam.com/alma/index.html' + (esfera ? '?esfera=' + encodeURIComponent(esfera) : '');
}

/* Cada minuto (procesarCola): crea los Pendientes de las preguntas que esperan y cierra los ya respondidos. */
function chatPreguntasRevisar_(ahora) {
  ahora = ahora || Date.now();
  var jefe = chatPrincipal_(); if (!jefe) return { creadas: 0, cerradas: 0 };
  var cache = CacheService.getScriptCache(); if (cache.get('chat_preg_corre')) return { creadas: 0, cerradas: 0 };
  cache.put('chat_preg_corre', '1', 50);   // candado corto: dos corridas a la vez no crean la misma tarjeta
  try {
    var P = PropertiesService.getScriptProperties(), vistas = {};
    try { vistas = JSON.parse(P.getProperty(CHAT_PREG_PROP_) || '{}') || {}; } catch (e) { vistas = {}; }
    var sh = hojaOp_(), n = sh.getLastRow(), filas = [];
    if (n >= 2) {
      var desde = Math.max(2, n - 399);
      filas = sh.getRange(desde, 1, n - desde + 1, OP_CAB_.length).getValues().map(function (r) {
        var t = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
        return { t: isNaN(t) ? 0 : t, usuario: String(r[1]).trim().toLowerCase(), de: String(r[3]), canal: String(r[4]), texto: String(r[5]), id: String(r[7]), esfera: String(r[8] || ''), subcategoria: String(r[9] || '') };
      }).filter(function (m) { return m.usuario === jefe.email && m.t; });
    }
    var yoTs = filas.filter(function (m) { return m.de === 'yo'; }).map(function (m) { return m.t; });
    var respondida = function (t) { return yoTs.some(function (y) { return y > t; }); };
    var out = { creadas: 0, cerradas: 0 }, cambio = false;
    /* 1 · Cerrar: él escribió en el chat después de la pregunta, o la tarjeta ya se resolvió a mano. */
    Object.keys(vistas).forEach(function (id) {
      var v = vistas[id]; if (!v || v.c) return;
      if (respondida(v.t)) { if (v.p) pendCerrar_(v.p); v.c = 1; cambio = true; out.cerradas++; }
      else if (v.p && !pendAbierto_(v.p)) { v.c = 1; cambio = true; }
    });
    /* 2 · Crear: una tarjeta por pregunta con opciones de más de 10 min (y menos de 2 h) que nadie respondió. */
    filas.forEach(function (m) {
      if (m.de !== 'alma' || vistas[m.id] || m.canal === 'llamada' || m.canal === 'claude') return;
      if (ahora - m.t < CHAT_PREG_ESPERA_ || ahora - m.t > CHAT_PREG_VENTANA_) return;
      if (/\[\[opciones\]\]/i.test(m.texto) && /\?conv=/.test(m.texto)) return;   // decisión del equipo (decisiones.js)
      if (m.texto.indexOf(CLAUDE_BORR_PREGUNTA_) >= 0) return;   // borrador para Claude: tiene su propio Pendiente a las 24 h (claudeBorradoresRevisar_)
      var op = chatOpciones_(m.texto); if (!op) return;
      if (respondida(m.t)) { vistas[m.id] = { t: m.t, c: 1 }; cambio = true; return; }
      var esf = chatEsfera_(m.esfera) || 'Propósito', sub = m.esfera ? m.subcategoria : '';
      var pq = op.pregunta.replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim() || 'Alma te hizo una pregunta';
      var f = null;
      try {
        f = pendCrear_(jefe, { tipo: 'atencion', area: chatAreaDe_(esf), proyecto: sub, titulo: pq, importancia: 2,
          resumen: 'Alma te preguntó en el chat y espera tu respuesta: ' + op.opciones.join(' · '),
          aviso: 'Te dejé una pregunta en el chat: ' + tituloCorto_(pq, 120),
          tarjeta: { tipo: 'pregunta', mensaje: m.id, esfera: esf, subcategoria: sub, opciones: op.opciones },
          acciones: [{ texto: 'Abrir el chat', url: chatEnlace_(esf), chat: { esfera: esf, conv: 'op:' + jefe.email } }] },
          { origen: 'pregunta', detalle: m.texto, push: true });
      } catch (e) { console.error('chatPreguntasRevisar_: ' + e); return; }
      vistas[m.id] = { t: m.t, p: f ? f.id : '' }; cambio = true; out.creadas++;
    });
    /* Lo cerrado se olvida pasadas 3 h (ya salió de la ventana); lo abierto, a los 30 días (cuando la tarjeta vence). */
    Object.keys(vistas).forEach(function (id) { var v = vistas[id]; if (ahora - v.t > (v.c ? 3 * 3600000 : 30 * 86400000)) { delete vistas[id]; cambio = true; } });
    if (cambio) P.setProperty(CHAT_PREG_PROP_, JSON.stringify(vistas));
    return out;
  } finally { cache.remove('chat_preg_corre'); }
}
