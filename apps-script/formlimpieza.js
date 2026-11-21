/* ═══ FORMULARIO DE LIMPIEZA (ruta_del_dia con propiedad) ═══════════════════════════════════════════════
   Juan, 21-nov-2026 (#969): «Revisar el formulario de limpieza de Helen Pineda de ayer en Rue 301 y obtener los
   detalles y foto de los insumos». Alma solo veía la programación de Epi (ruta_del_dia), no lo que la persona de
   limpieza llenó. Esto lee el formulario tal como lo guardó Epi (hoja «Reportes», acciones getAll y getReport):
   quién, cuándo, comentarios, inventario, daños, revisión de calidad y qué fotos subió por sección. Con «fotos»
   («insumos», «baño», «todas»…) las fotos de esas secciones viajan como imágenes (_imgs, igual que ver_imagenes)
   para que Alma las mire, y sus enlaces van en la respuesta para mandárselos a Juan. Va dentro de ruta_del_dia (no es
   otra herramienta) para que el prompt del chat no crezca (.github/presupuesto-prompts.json).
   EN PANTALLA (Juan, 21-nov-2026, pedido pc1795284963805: «no me estás poniendo eso en pantalla, solo me estás poniendo las
   reservas… ¿quién hizo la última limpieza antes que ella?… la foto de los insumos»): lo que Alma mira también lo ve Juan.
   · Las fotos pedidas quedan en ctx.fotosPantalla y, al cerrar el turno (flPantalla_, agCerrarTurno_), el Hub las agrega
     al final de la respuesta del chat (canal hub o app) en un bloque [[fotos]] «etiqueta | id de Drive» [[/fotos]] que el
     chat pinta como galería (js/sa-chat.js, SAChat.fotos; en el Hub, como las fotos de la conversación). Alma no pega
     enlaces. En WhatsApp no va; en una llamada va al chat en un mensaje aparte (la voz no puede mostrarlas).
   · Con propiedad sale también «recientes»: las últimas limpiezas con formulario (fecha · quién), para «¿quién limpió
     antes que Caren?». */

var FL_DIAS_MAX_ = 120;   // hasta cuántos días atrás se busca un formulario
var FL_MAX_FOTOS_ = 4;    // fotos que viajan como imagen en una vuelta
var FL_CANALES_CHAT_ = ['hub', 'app'];   // donde las fotos salen en pantalla, debajo de la respuesta

/* Nombre de cada sección de fotos del formulario (las de Epi: app.jsx, TRAD_SINGLE_PHOTOS y CLEANING_PHOTO_KEYS). */
var FL_SECCIONES_ = {
  fotoUniforme: 'uniforme', fotoPisoGeneral: 'piso general', fotosPrimeraImpresion: 'primera impresión', fotosHabitaciones: 'habitaciones',
  fotosBanos: 'baños', fotosDrenajes: 'drenajes', fotosVentanas: 'ventanas', fotosGavetas: 'gavetas', fotosDetalle: 'detalles',
  fotosCocinaGeneral: 'cocina general', fotosMicroondas: 'microondas', fotosMicroondas2: 'microondas por dentro', fotosCafetera: 'cafetera',
  fotosEcofiltro: 'ecofiltro', fotosLavatrastos: 'lavaplatos', fotosRefrigerador: 'refrigerador', fotosEstufa: 'estufa', fotosPlatos: 'platos',
  fotosFregadero: 'fregadero', fotosDetrasElect: 'detrás de electrodomésticos', fotosTv: 'televisor', fotosSillon: 'sillón',
  fotosSalaGeneral: 'sala', fotosComedorGeneral: 'comedor', fotosInsumos: 'insumos de cortesía', fotosInsumosLimpieza: 'insumos de limpieza',
  fotosDebajoCama: 'debajo de la cama', fotosCloset: 'clóset y blancos', fotosRegadera: 'regadera', fotosDucha: 'ducha',
  fotosPisoComun: 'piso de área común', fotosTrapeadores: 'trapeadores y trapos', fotosTarjetas: 'tarjetas de acceso',
  fotoAntes: 'antes', fotoDespues: 'después'
};

function flNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }

/* ¿Qué secciones pidió? «insumos» → las dos de insumos; «todas» → todas; si no, por palabra en el nombre de la sección. */
function flSeccionesPedidas_(fotos) {
  var f = flNorm_(fotos); if (!f) return [];
  var llaves = Object.keys(FL_SECCIONES_);
  if (/^(todas?|todo|all)$/.test(f)) return llaves;
  var palabras = f.split(/[\s,;]+/).filter(function (w) { return w.length >= 3 && ['las', 'los', 'del', 'fotos', 'foto', 'de'].indexOf(w) === -1; });
  return llaves.filter(function (k) {
    var n = flNorm_(FL_SECCIONES_[k] + ' ' + k);
    return palabras.some(function (w) { return n.indexOf(w.replace(/s$/, '')) !== -1; });
  });
}

/* ¿El formulario es de esta persona? Todas las palabras que dieron (nombre, apellido) en quien lo llenó; con solo el
   nombre basta. */
function flEsDe_(reportadoPor, persona) {
  var P = flNorm_(persona).split(/\s+/).filter(Boolean), R = flNorm_(reportadoPor);
  return !P.length || P.every(function (w) { return R.indexOf(w) !== -1; });
}

function flHora_(createdAt) {
  var n = Number(createdAt), d = n > 1e11 ? new Date(n) : createdAt ? new Date(createdAt) : null;
  return d && !isNaN(d.getTime()) ? Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd HH:mm') : '';
}

/* Las secciones con foto y sus direcciones (fuentesUrls_ de fuentes.js: texto, lista u objeto). */
function flFotos_(rep) {
  var out = {};
  Object.keys(FL_SECCIONES_).forEach(function (k) {
    var v = rep[k] !== undefined && rep[k] !== null ? rep[k] : (rep.fotosLimpieza || {})[k];
    var urls = fuentesUrls_(v); if (urls.length) out[k] = urls;
  });
  return out;
}

function formularioLimpieza_(inp, ctx) {
  inp = inp || {};
  var hoyG = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  var fecha = String(inp.fecha || '').slice(0, 10), prop = s_(inp.propiedad).trim(), persona = s_(inp.persona).trim();
  if (!prop && !persona) return { error: 'Dime la propiedad o la persona que limpió.' };
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'La fecha va como YYYY-MM-DD.' };
  var dias = fecha ? Math.min(FL_DIAS_MAX_, Math.max(3, Math.ceil((new Date(hoyG) - new Date(fecha)) / 864e5) + 2)) : 30;
  var reps;
  try { var j = epiPost_('getAll', { light: true, days: dias }); reps = (j.data || j).reports || []; }
  catch (e) { return { error: 'Epi no respondió: ' + String(e.message || e).slice(0, 150) }; }
  var limp = reps.filter(function (r) { return r && /limpieza/i.test(s_(r.categoria)) && (!prop || aplicaA_(prop, s_(r.propiedad))); });
  var delDia = limp.filter(function (r) { return !fecha || s_(r.fecha).slice(0, 10) === fecha; });
  var recientes = prop ? limp.slice().sort(function (a, b) { return s_(b.fecha).localeCompare(s_(a.fecha)) || Number(b.createdAt || 0) - Number(a.createdAt || 0); })
    .slice(0, 8).map(function (r) { return s_(r.fecha).slice(0, 10) + ' · ' + s_(r.reportadoPor); }) : undefined;   // «¿quién limpió antes que…?»
  var suyos = delDia.filter(function (r) { return flEsDe_(r.reportadoPor, persona); });
  var nota = '';
  if (!suyos.length && delDia.length && persona) { suyos = delDia; nota = 'Ese día no hay formulario de ' + persona + ' ahí; te doy el que sí hay.'; }
  if (!suyos.length) {
    var deP = limp.filter(function (r) { return flEsDe_(r.reportadoPor, persona); }), otros = deP.length ? deP : limp;
    var cerca = otros.sort(function (a, b) { return s_(b.fecha).localeCompare(s_(a.fecha)); }).slice(0, 5)
      .map(function (r) { return s_(r.fecha).slice(0, 10) + ' · ' + s_(r.propiedad) + ' · ' + s_(r.reportadoPor); });
    return { ok: true, encontrado: false, nota: 'No hay formulario de limpieza en Epi' + (prop ? ' de ' + prop : '') + (persona ? ' llenado por ' + persona : '') + (fecha ? ' el ' + fecha : '') + '.', mas_recientes: cerca, recientes: recientes };
  }
  suyos.sort(function (a, b) { return s_(b.fecha).localeCompare(s_(a.fecha)) || Number(b.createdAt || 0) - Number(a.createdAt || 0); });
  var elegido = suyos[0], rep = null;
  try { var g = epiPost_('getReport', { id: elegido.id }); rep = (g.data || g).report || null; }
  catch (e) { return { error: 'Epi no me dio el formulario: ' + String(e.message || e).slice(0, 150) }; }
  if (!rep) return { error: 'Epi no encontró ese formulario.' };

  var fotos = flFotos_(rep), pedidas = flSeccionesPedidas_(inp.fotos);
  var inv = (Array.isArray(rep.inventario) ? rep.inventario : []).map(function (i) {
    if (!i || !i.name) return '';
    return i.name + ': ' + (i.cantidad === '' || i.cantidad === undefined || i.cantidad === null ? 'sin contar' : i.cantidad) +
      (i.malEstado ? ' (' + i.malEstado + ' en mal estado)' : '') + (i.estado && i.estado !== 'ok' ? ' · ' + i.estado : '') + (i.foto ? ' · con foto' : '');
  }).filter(Boolean);
  var danios = (Array.isArray(rep.danios) ? rep.danios : []).map(function (d) { return typeof d === 'string' ? d : s_(d && (d.descripcion || d.texto || d.nombre)); }).filter(Boolean);
  var out = {
    ok: true, encontrado: true, propiedad: s_(rep.propiedad), fecha: s_(rep.fecha).slice(0, 10), llenado_el: flHora_(rep.createdAt),
    quien: s_(rep.reportadoPor), tipo: s_(rep.categoria), descripcion: s_(rep.descripcion) || undefined, comentarios: s_(rep.comentarios) || undefined,
    inventario: inv.length ? inv : undefined, danios: danios.length ? danios : (rep.hayDanios ? ['marcó que hay daños'] : undefined),
    calidad: rep.qaStatus ? [s_(rep.qaStatus), s_(rep.qaComentario)].filter(Boolean).join(' · ') : undefined,
    secciones_con_foto: Object.keys(fotos).map(function (k) { return FL_SECCIONES_[k] + ' (' + fotos[k].length + ')'; }),
    nota: nota || undefined,
    recientes: recientes,
    otros_ese_dia: suyos.length > 1 ? suyos.slice(1, 4).map(function (r) { return s_(r.propiedad) + ' · ' + s_(r.reportadoPor); }) : undefined
  };
  if (rep._photoError) out.aviso_fotos = 'Epi marcó que algunas fotos de este formulario no se terminaron de subir.';
  if (pedidas.length) {
    var lista = [];
    pedidas.forEach(function (k) { (fotos[k] || []).forEach(function (u) { lista.push({ url: u, etiqueta: FL_SECCIONES_[k] }); }); });
    var faltan = pedidas.filter(function (k) { return !fotos[k]; }).map(function (k) { return FL_SECCIONES_[k]; });
    if (!lista.length) out.fotos_pedidas = 'El formulario no trae fotos de ' + faltan.join(', ') + '.';
    else {
      var van = lista.slice(0, FL_MAX_FOTOS_), imgs = fuentesImagenes_(van);
      out.fotos_pedidas = van.map(function (f, i) { return 'Foto ' + (i + 1) + ': ' + f.etiqueta + (imgs[i] ? '' : ' (no se pudo abrir)'); });
      out.enlaces_fotos = lista.map(function (f) { return f.etiqueta + ': ' + f.url; });
      if (lista.length > van.length) out.mas_fotos = 'Hay ' + lista.length + ' fotos en total; te muestro ' + van.length + '.';
      var vistas = imgs.filter(Boolean);
      if (vistas.length) out._imgs = vistas;
      /* En pantalla: el bloque [[fotos]] lo agrega flPantalla_ al cerrar el turno (en el chat no hace falta pegar enlaces). */
      var cab = out.fecha + ' · ' + out.quien, conId = van.map(function (f) { return { t: f.etiqueta + ' · ' + cab, id: flDriveId_(f.url) }; }).filter(function (f) { return f.id; });
      if (ctx && conId.length) {
        ctx.fotosPantalla = (ctx.fotosPantalla || []).concat(conId);
        var canal = String(typeof AGENTE_CANAL_ === 'undefined' ? '' : AGENTE_CANAL_ || '');
        out.en_pantalla = FL_CANALES_CHAT_.indexOf(canal) >= 0 ? 'Las fotos ya salen en pantalla debajo de tu respuesta: no pegues enlaces; di lo que se ve.'
          : canal === 'llamada' ? 'Las fotos quedan en su chat con Alma: díselo y cuenta lo que se ve.' : undefined;
        if (out.en_pantalla && FL_CANALES_CHAT_.indexOf(canal) >= 0) delete out.enlaces_fotos;
      }
    }
  }
  return out;
}

/* El id de Drive de una foto de Epi («uc?id=…», «/d/…», «thumbnail?id=…»), o ''. */
function flDriveId_(u) { return (String(u || '').match(/drive\.google\.com\/.*(?:[?&]id=|\/d\/)([\w-]{10,})/) || [])[1] || ''; }
/* El bloque que el chat pinta como galería (js/sa-chat.js, SAChat.fotos): una línea por foto, «etiqueta | id de Drive». */
function flBloque_(fotos) {
  var vistos = {}, l = (fotos || []).filter(function (f) { if (!f || !/^[\w-]{10,}$/.test(String(f.id)) || vistos[f.id]) return false; vistos[f.id] = 1; return true; })
    .map(function (f) { return String(f.t || 'Foto').replace(/[|\[\]\n]/g, ' ').trim() + ' | ' + f.id; });
  return l.length ? '[[fotos]]\n' + l.join('\n') + '\n[[/fotos]]' : '';
}
/* Al cerrar el turno (agCerrarTurno_): en el chat, las fotos van al final de la respuesta; en una llamada, a un mensaje
   aparte del chat; en WhatsApp, nada. Devuelve el texto de la respuesta. */
function flPantalla_(adm, texto, ctx) {
  var b = ctx && ctx.fotosPantalla && ctx.fotosPantalla.length ? flBloque_(ctx.fotosPantalla) : '';
  if (!b) return texto;
  var canal = String(typeof AGENTE_CANAL_ === 'undefined' ? '' : AGENTE_CANAL_ || '');
  if (FL_CANALES_CHAT_.indexOf(canal) >= 0) return String(texto || '').trim() + '\n\n' + b;
  if (canal === 'llamada' && adm && adm.email) { try { opGuardar_(adm, 'alma', 'hub', 'Las fotos que me pediste en la llamada:\n\n' + b, []); } catch (e) { console.error('flPantalla_: ' + e); } }
  return texto;
}
