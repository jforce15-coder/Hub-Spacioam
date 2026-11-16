/* ═══ DESTINATARIO: de un nombre, un apartamento o un número a la persona, con su FUENTE (#583 T3) ═══════════════════
   13-nov: Juan mandó el nombre y el número del socio de Narama 633; antes Alma había dicho «El único Mayorga que tengo es
   Jorge González» (inventado). Cada herramienta de envío buscaba a su manera (agPersona_, opMatch_, personalPorNombre_) y
   tomaba la PRIMERA coincidencia por un pedazo del nombre, sin revisar que fuera de ese apartamento. Ahora hay un solo
   camino, el de aquí, para escribir_a_equipo, encargar_conversacion, programar_mensaje, mensaje_personal y los avisos de
   aterrizaje (avisovuelo.js). Decisión de Juan: Alma nunca dice un dato sin verificar; si hay varias personas posibles,
   las nombra y pregunta solo eso.
   destinoResolver_({ texto | persona, propiedad, numero, tipo }) → { unico, todos, candidatos: [{ nombre, rol, propiedad,
   tel_ultimos4, tiene_numero, fuente, tel }], apartamento, apartamentos }. El orden:
     1. el número que dio Juan (gana siempre);
     2. la reserva activa o próxima del apartamento (solo si piden al huésped: tipo «huesped» o la palabra huésped);
     3. los socios de Mi de ese apartamento (sociosmi.js: SETUP + Control de usuarios + fichas + su chat);
     4. la recepción del edificio (los números de Hola);
     5. el equipo (administradores, técnicos de Epi, escalamiento);
     6. las fichas de contacto (proveedores, socios, familia…);
     7. a quien Alma le escribió en 30 días (relevo.js), solo si nada de lo anterior lo encontró.
   Varias personas posibles → antes de preguntar, lo reciente (memoriafresca.js, Juan 16-nov-2026): quien salió en las
   últimas llamadas o en el tema activo y, si no, una conversación reciente de la bandeja. Si eso elige a una sola, es esa,
   y su fuente lo dice («lo hablaron hace 10 min»); si no, se pregunta como siempre.
   Reglas: si se nombró un apartamento, la persona debe ser de ese apartamento (quien no tiene apartamento, como el equipo,
   pasa); un nombre coincide solo con palabras completas (o el inicio de una palabra de 4 letras o más), nunca un pedazo
   suelto; varias coincidencias → todas, sin elegir; el parecido por errores de escritura nunca es único; «los socios» →
   todos. tel solo viaja dentro del Hub: a Alma le llega destinoPublico_ (los últimos 4). */

var DESTINO_RECEP_RE_ = /\b(recepci[oó]n|recepcionista|lobby|porter[ií]a|garita|conserjer[ií]a)\b/i;
var DESTINO_HUESPED_RE_ = /\b(hu[eé]sped(es)?|guest)\b/i;
var DESTINO_PLURAL_RE_ = /\b(socios|socias|due[ñn]os|due[ñn]as|propietari[oa]s|owners)\b/i;
var DESTINO_VACIAS_ = ['de', 'del', 'la', 'el', 'los', 'las', 'a', 'al', 'y', 'e', 'en', 'para', 'con', 'mi', 'su', 'sus', 'se', 'le', 'les', 'lo', 'que',
  'senor', 'senora', 'sr', 'sra', 'don', 'dona', 'apto', 'apartamento', 'depto', 'unidad', 'edificio', 'torre', 'ambos', 'ambas', 'todos', 'todas', 'dos', 'nuevo', 'nueva'];

function destinoNorm_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
/* «Z13 - Narama - 633» → «Narama 633»: así se dice y así se escribe. */
function destinoPropTexto_(p) { return String(p || '').split(/[,;\n]/)[0].replace(/^\s*z\s*\d+\s*-?\s*/i, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
/* Las palabras del nombre que se busca: sin las de rol, las vacías, las del apartamento nombrado ni números. */
function destinoPalabras_(texto, quitar) {
  var fuera = {}; (quitar || []).forEach(function (w) { fuera[w] = 1; });
  var g = function (re) { return new RegExp(re.source, 'gi'); };
  return destinoNorm_(String(texto || '').replace(g(SOCIO_MI_PALABRAS_), ' ').replace(g(DESTINO_RECEP_RE_), ' ').replace(g(DESTINO_HUESPED_RE_), ' ')).split(' ')
    .filter(function (w) { return w && !fuera[w] && DESTINO_VACIAS_.indexOf(w) < 0 && !/^\d+$/.test(w) && w.length > 1; });
}
/* ¿El nombre tiene todas las palabras buscadas? Palabra completa, o el inicio de una palabra si lo buscado tiene 4 letras o
   más («Gaby» no es «Gabriela», «Mayor» no es «Mayorga» si no lo es entera… pero «Gabri» sí es «Gabriela»). */
function destinoCoincide_(palabras, nombre) {
  if (!palabras.length) return false;
  var ws = destinoNorm_(nombre).split(' ');
  return palabras.every(function (p) { return ws.some(function (w) { return w === p || (p.length >= 4 && w.indexOf(p) === 0); }); });
}
/* ¿Es de ese apartamento? Sin apartamento conocido (el equipo, un proveedor) pasa: el filtro es para no cruzar vecinos. */
function destinoDelApto_(c, apto) {
  if (!apto || (!apto.claves.length && !apto.nums.length)) return true;
  var props = String(c.propiedad || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (!props.length) return !c.conApto;
  return props.some(function (p) {
    var k = socioClaveProp_(p).join(' ');
    if (apto.claves.length) return apto.claves.some(function (ka) { return (' ' + k + ' ').indexOf(' ' + ka + ' ') >= 0 || k === ka; });
    var nk = k.split(' '); return apto.nums.some(function (n) { return nk.indexOf(n) >= 0; });
  });
}
function destinoPublico_(c) {
  return { nombre: c.nombre, rol: c.rol || undefined, propiedad: c.propiedad ? destinoPropTexto_(c.propiedad) : undefined, tel_ultimos4: c.tel ? String(c.tel).slice(-4) : undefined,
    tiene_numero: !!c.tel, fuente: c.fuente, parecido: c.parecido || undefined };
}
/* Lo que Alma dice (chat y voz), tal cual: «Ana Pérez (socia de Narama 633, número de Control de usuarios)». */
function destinoDecir_(c) {
  var rol = String(c.rol || '').trim(), pr = c.propiedad ? destinoPropTexto_(c.propiedad) : '';
  var quien = rol && pr ? (destinoNorm_(rol).indexOf(destinoNorm_(pr)) >= 0 ? rol : rol + ' de ' + pr) : rol || pr;
  var de = c.fuente ? (c.tel ? 'número de ' : 'según ') + c.fuente : '';
  return (c.nombre || 'Sin nombre') + (quien || de ? ' (' + [quien, de].filter(Boolean).join(', ') + ')' : '');
}

function destinoResolver_(o) {
  o = o || {};
  var persona = String(o.persona || o.texto || '').trim(), propiedad = String(o.propiedad || '').trim(), tipo = String(o.tipo || '').toLowerCase();
  var todoTxt = [persona, propiedad].filter(Boolean).join(' '), out = { unico: false, todos: false, candidatos: [] };
  var lista = [], vistos = {}, sinNombre = [];
  var add = function (c) {
    c.tel = normTel_(c.tel || ''); c.nombre = String(c.nombre || '').trim();
    var k = c.tel ? 't' + fin8_(c.tel) : 'n' + destinoNorm_(c.nombre) + '|' + destinoNorm_(c.propiedad);
    if (vistos[k]) { var v = vistos[k]; if (!v.nombre && c.nombre) v.nombre = c.nombre; if (!v.propiedad && c.propiedad) v.propiedad = c.propiedad; return; }
    /* La misma persona por dos lados (Mi sin teléfono y su ficha con teléfono): una sola, con el número. */
    var mismo = lista.filter(function (x) { return destinoNorm_(x.nombre) === destinoNorm_(c.nombre) && (!x.tel || !c.tel) && destinoPropTexto_(x.propiedad).toLowerCase() === destinoPropTexto_(c.propiedad).toLowerCase(); })[0];
    if (mismo) { if (!mismo.tel && c.tel) { mismo.tel = c.tel; mismo.fuente = c.fuente; } return; }
    vistos[k] = c; lista.push(c);
  };
  var cierre = function () {
    if (!lista.length) sinNombre.forEach(add);   // nadie con ese nombre: el socio sin nombre en Mi, para preguntar
    /* Con un apartamento nombrado, si alguien es de ese apartamento, quien no tiene apartamento (el equipo) sale. */
    if (apto && apto.claves.length && lista.some(function (c) { return c.propiedad; })) lista = lista.filter(function (c) { return c.propiedad; });
    /* Varios números de la misma recepción: es un solo destinatario, sale a todos (como el registro a recepción). */
    var edificio = function (c) { return socioClaveProp_(c.propiedad).filter(function (w) { return !/^\d+$/.test(w); }).join(' '); };
    if (lista.length > 1 && lista.every(function (c) { return c.rol === 'recepción' && edificio(c) === edificio(lista[0]); })) out.todos = true;
    /* Lo reciente desempata (memoriafresca.js): «Amílcar» sin más es el que hablaron hace 10 min. */
    if (lista.length > 1 && !out.todos) {
      try {
        var dr = mfDesempate_(o.adm || (o.ctx && o.ctx.adm) || null, lista);
        if (dr && !lista[dr.i].parecido) { var el = lista[dr.i]; el.fuente = (el.fuente ? el.fuente + ' · ' : '') + dr.fuente; lista = [el]; out.reciente = dr.fuente; }
      } catch (e) { if (typeof mfDesempate_ === 'function') console.error('destino reciente: ' + e); }
    }
    out.candidatos = lista; out.unico = lista.length === 1 && !lista[0].parecido;
    return out;
  };
  /* 1 · El número que dio Juan. Si ya tiene ficha, su nombre y su rol; la fuente es Juan. */
  var num = normTel_(o.numero || '');
  if (!num && /^\+?[\d\s()-]{8,}$/.test(persona)) num = normTel_(persona);
  if (num) {
    var f0 = null; try { f0 = contactoFicha_(num); } catch (e) {}
    var nom0 = /^\+?[\d\s()-]+$/.test(persona) ? '' : persona.replace(SOCIO_MI_PALABRAS_, '').replace(/\b(de|del)\b.*$/i, '').replace(/[,;·\s-]+$/, '').trim();
    add({ nombre: nom0 || (f0 && f0.nombre) || '+' + num, rol: (f0 && f0.rol) || (SOCIO_MI_PALABRAS_.test(persona) ? 'socio' : ''), propiedad: propiedad || (f0 && f0.propiedades) || '', tel: num, fuente: 'el número que diste' });
    return cierre();
  }
  /* El apartamento nombrado (Mi): Narama 633 nunca es Narama 623. Sin Mi, los números de 3 o 4 cifras. */
  var apto = null, nombresMi = []; try { nombresMi = socioMiSetup_().map(function (s) { return s.propiedad; }); } catch (e) { console.error('destino Mi: ' + e); }
  var props = nombresMi.length ? socioPropsEnTexto_(todoTxt, nombresMi) : [];
  /* «El socio de Torre Sol» sin número: si el edificio tiene un solo apartamento en Mi, ese; si tiene varios, se pregunta. */
  if (!props.length && SOCIO_MI_PALABRAS_.test(todoTxt) && nombresMi.length) {
    var pw = destinoPalabras_(todoTxt, []);
    if (pw.length) props = nombresMi.filter(function (p) { var k = socioClaveProp_(p); return pw.every(function (w) { return k.indexOf(w) >= 0; }); });
  }
  if (props.length > 1) { out.apartamentos = props.slice(0, 5).map(destinoPropTexto_); return cierre(); }
  apto = { claves: props.map(function (p) { return socioClaveProp_(p).join(' '); }), nums: (destinoNorm_(todoTxt).match(/\b\d{3,4}\b/g) || []) };
  if (props.length) out.apartamento = destinoPropTexto_(props[0]);
  var quitar = [].concat.apply([], props.map(socioClaveProp_));
  var palabras = destinoPalabras_(persona, quitar);
  var rolSocio = SOCIO_MI_PALABRAS_.test(todoTxt) || tipo === 'socio', rolRecep = DESTINO_RECEP_RE_.test(persona) || tipo === 'recepcion';
  var rolHuesped = tipo === 'huesped' || DESTINO_HUESPED_RE_.test(persona);
  out.todos = rolSocio && DESTINO_PLURAL_RE_.test(persona);

  /* 2 · El huésped de la reserva activa o próxima (agElegirReserva_: si hay varias, no elige). */
  if (rolHuesped) {
    var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), q = [palabras.join(' '), out.apartamento || propiedad].filter(Boolean).join(' ');
    var el = null; try { el = agElegirReserva_(q, hoy, o.adm || (o.ctx && o.ctx.adm) || null); } catch (e) { console.error('destino reserva: ' + e); }
    if (el && !el.error) add({ nombre: el.huesped, rol: 'huésped', propiedad: el.propiedad, tel: '', fuente: 'reserva ' + (el.codigo || ''), conv_id: el.conv_id, codigo: el.codigo, huesped: true });
    else if (el && el.opciones) el.opciones.forEach(function (x) { add({ nombre: x.huesped, rol: 'huésped', propiedad: x.propiedad, tel: '', fuente: 'reserva ' + x.codigo, codigo: x.codigo, huesped: true }); });
    return cierre();
  }
  /* 3 · Los socios de ese apartamento según Mi. Sin nombre (o «el socio»), todos los de ese apartamento; con nombre, solo
     los que coinciden. Un socio sin nombre en Mi puede ser el que nombraron: entra marcado «parecido» (Alma pregunta). */
  if (props.length && !rolRecep) {
    var sa = null; try { sa = socioDelApartamento_(props[0]); } catch (e) { console.error('destino socio: ' + e); }
    ((sa && sa.socios) || []).forEach(function (s) {
      var c = { nombre: s.nombre || ('Socio de ' + destinoPropTexto_(props[0])), rol: 'socio', propiedad: props[0], tel: s.tel, fuente: s.tel ? s.fuente : 'Mi (sin teléfono)', conApto: true };
      if (!palabras.length) return add(c);
      if (s.nombre && destinoCoincide_(palabras, s.nombre)) return add(c);
      if (!s.nombre) { c.parecido = true; c.nombre = 'Socio de ' + destinoPropTexto_(props[0]) + ' (sin nombre en Mi)'; sinNombre.push(c); }
    });
    if (lista.length && (rolSocio || !palabras.length)) return cierre();
    if (!palabras.length) return cierre();
  }
  /* 4 · La recepción del edificio: «Recepción Ignacio», «la recepción de Narama 633». */
  if (rolRecep) {
    var edif = props.length ? [socioClaveProp_(props[0]).filter(function (w) { return !/^\d+$/.test(w); })] : [palabras];
    var rn = {}; try { rn = recepcionNumeros_(); } catch (e) { console.error('destino recepción: ' + e); }
    Object.keys(rn).forEach(function (k) {
      var r = rn[k]; if (!r || !r.prop || !r.n) return;
      var kp = destinoNorm_(r.prop).split(' ');
      if (edif.some(function (ws) { return ws.length && ws.every(function (w) { return kp.indexOf(w) >= 0; }); })) add({ nombre: 'Recepción ' + destinoPropTexto_(r.prop), rol: 'recepción', propiedad: r.prop, tel: r.n, fuente: 'recepciones de Hola' });
    });
    return cierre();
  }
  if (!palabras.length) return cierre();
  /* 5 · El equipo. 6 · Las fichas de contacto. Todas las que coinciden, de cada lado. */
  var todosNombres = [];
  var cand = function (c) { todosNombres.push(c); if (destinoCoincide_(palabras, c.nombre) && destinoDelApto_(c, apto)) add(c); };
  try { adminsOp_().forEach(function (a) { cand({ nombre: a.nombre, rol: 'administrador', tel: (a.tels || [])[0] || '', fuente: 'equipo (administradores)' }); }); } catch (e) {}
  try { var cfg = o.ctx && o.ctx.cfg ? o.ctx.cfg() : epiSnap_(false); (cfg.vendors || []).forEach(function (v) { cand({ nombre: vendNombre_(v), rol: v.cat ? contactoRolEpi_(v.cat) : 'equipo de Epi', tel: String(v.phone || v.telefono || ''), fuente: 'equipo de Epi' }); }); } catch (e) {}
  try { escalamiento_().forEach(function (p) { cand({ nombre: p.nombre, rol: 'equipo Spacio AM', tel: p.telefono, fuente: 'escalamiento' }); }); } catch (e) {}
  /* Los socios de Mi por su nombre (SETUP + Control de usuarios), con su apartamento. */
  try { var usrM = socioMiUsuarios_(); socioMiSetup_().forEach(function (st) { st.emails.forEach(function (em) { var u = usrM[em]; if (u && u.nombre) cand({ nombre: u.nombre, rol: 'socio', propiedad: st.propiedad, tel: u.tel, fuente: u.tel ? 'Control de usuarios' : 'Mi (sin teléfono)', conApto: true }); }); }); } catch (e) {}
  try { (accesosPorRol_().socios || []).forEach(function (so) { if (so.nombre) cand({ nombre: so.nombre, rol: 'socio', propiedad: so.propiedad || '', tel: so.tel, fuente: 'Control de usuarios', conApto: true }); }); } catch (e) {}
  try { contactosTodos_().forEach(function (f) { if (!f.nombre) return; cand({ nombre: f.nombre, rol: f.rol || (CONTACTO_TIPOS_[f.tipo] || f.tipo || ''), propiedad: f.propiedades || '', tel: f.tel, fuente: 'ficha de contacto', conApto: String(f.tipo) === 'socio' }); }); } catch (e) {}
  /* 7 · A quien Alma le escribió (o le contestó) en 30 días. Solo si nada de lo anterior lo tiene: lee la hoja de WhatsApp. */
  if (!lista.length) {
    var rec = []; try { rec = contactoRecientes_(persona, 30); } catch (e) { console.error('destino recientes: ' + e); }
    rec.forEach(function (r) { add({ nombre: r.nombre, rol: '', tel: r.numero, fuente: 'le escribí en los últimos 30 días' }); });   // relevoCoincide_ ya pidió todas las palabras
  }
  /* Nadie con las palabras completas: el parecido (errores de escritura o de voz), nunca como único. */
  if (!lista.length && todosNombres.length) {
    var b = ''; try { b = bqMejor_(palabras.join(' '), todosNombres.map(function (c) { return c.nombre; })); } catch (e) {}
    todosNombres.filter(function (c) { return b && c.nombre === b && destinoDelApto_(c, apto); }).forEach(function (c) { add(Object.assign({}, c, { parecido: true })); });
  }
  return cierre();
}

/* Para las herramientas de envío: { destinos: [c] } (uno, o todos con número si piden «los socios») o { error, candidatos }
   para que Alma pregunte solo eso. Lo que se eligió queda en ctx.destinos: la respuesta a la voz lo trae en «decir».
   o.uno: la herramienta escribe a una sola persona (un encargo, un programado): «los socios» con dos números se pregunta. */
function destinoElegir_(inp, ctx, tipo, o) {
  var r = destinoResolver_({ persona: inp.persona || '', propiedad: inp.propiedad || '', numero: inp.numero || '', tipo: tipo || '', ctx: ctx });
  var pub = r.candidatos.map(destinoPublico_), quien = String(inp.persona || inp.numero || 'esa persona');
  if (r.apartamentos) return { error: 'NO SE ENVIÓ: eso nombra varios apartamentos (' + r.apartamentos.join(' · ') + '). Pregúntale a Juan solo de cuál.' };
  var con = r.candidatos.filter(function (c) { return c.tel; });
  if (r.todos && con.length && !(o && o.uno && con.length > 1)) { destinoAnotar_(ctx, con); return { destinos: con, resolucion: r }; }
  if (!r.candidatos.length) return { error: 'NO SE ENVIÓ: no encontré a «' + quien + '»' + (r.apartamento ? ' en ' + r.apartamento : '') + ' (busqué en Mi, el Control de usuarios, el equipo, las fichas de contacto y a quien le escribí en 30 días). No digas otro nombre: pídele a Juan el número una sola vez y vuelve a llamar con numero.' };
  if (r.candidatos.length > 1 || !r.unico) return { error: 'NO SE ENVIÓ: ' + (r.candidatos.length > 1 ? 'hay ' + r.candidatos.length + ' personas posibles' : 'no es seguro que sea esa persona') + ': ' + r.candidatos.map(destinoDecir_).join(' · ') + '. Nómbralas tal cual y pregúntale a Juan solo cuál es.', candidatos: pub };
  var c = r.candidatos[0];
  if (!c.tel) return { error: 'NO SE ENVIÓ: ' + destinoDecir_(c) + ' no tiene número de WhatsApp en Mi, el Control de usuarios, las fichas de contacto ni tu chat. Pídeselo a Juan UNA vez; cuando lo dé, vuelve a llamar con numero' + (c.propiedad ? ' y propiedad' : '') + ' y queda guardado.', candidatos: pub, sin_numero: true, propiedad: c.propiedad ? destinoPropTexto_(c.propiedad) : undefined };
  destinoAnotar_(ctx, [c]);
  return { destinos: [c], resolucion: r };
}
function destinoAnotar_(ctx, cs) {
  if (!ctx) return; ctx.destinos = (ctx.destinos || []).concat(cs.map(function (c) { return destinoDecir_(c); })).slice(-6);
  try { mfAnotar_(ctx.adm, cs); } catch (e) {}   // memoria fresca: a quién se eligió, verificado (memoriafresca.js)
}
