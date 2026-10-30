/* ═══ DEPARTAMENTO DE ARCHIVO ══════════════════════════════════════════════════════════════════════════════
   Uno de los agentes detrás de Alma (agentes.js, tipo «archivo»; no confundir con archivo.js, que guarda lo viejo en la memoria larga). Su único propósito: que todo esté ordenado.
   En cada ronda (mañana y noche):
     1 · Clasifica lo nuevo: conversaciones con Alma, encargos personales y proyectos (lo mismo que hace la app al abrir
         las áreas, pero sin esperar a que la abras).
     2 · Revisa lo que quedó «sin clasificar», ahora con más contexto (la conversación completa y lo que se habló antes y
         después) y le da un lugar: un área o un cajón (Ideas, Interés, Ocio). Si de verdad no se entiende, va a Ocio:
         nada se queda sin lugar.
     3 · Marca el tipo de lo que no lo tiene: proceso (se resuelve y termina) o permanente (está para quedarse).
     4 · Aplica las REGLAS DE GUARDADO (abajo): cómo se ordena cada grupo y qué se guarda, qué es temporal y qué no se
         guarda; ordena los archivos de Drive en carpetas y manda a la papelera lo temporal que venció.
     5 · Deja su informe. Si encontró ideas nuevas (proyectos en potencia), Alma se las cuenta a Juan.
   Lo que tú moviste a mano («manual») no lo toca. */

function archivoRonda_(a, adm, origen, pedido) {
  var t0 = Date.now(), r = { nuevas: 0, revisadas: 0, a_ocio: 0, tipos: 0, ideas: [], archivos: 0, archivos_papelera: 0, reglas: [] };
  /* un pedido que cambia las reglas («que Ocio se guarde 60 días»): primero eso */
  if (pedido) { try { r.reglas = archivistaCambiarReglas_(pedido); } catch (e) { console.error('archivo reglas: ' + e); } }
  var reglas = archivistaReglas_();
  var antes = areasFilas_();
  /* 1 · lo nuevo (areas_ clasifica lo pendiente de una vez) */
  try { areas_({ email: adm.email }); } catch (e) { console.error('archivo areas_: ' + e); }
  var filas = areasFilas_();
  r.nuevas = Object.keys(filas).filter(function (k) { return !antes[k]; }).length;
  /* 2 · lo que quedó sin clasificar, con más contexto */
  var sesiones = []; try { sesiones = areasSesiones_(adm); } catch (e) {}
  var porClave = {}; sesiones.forEach(function (c, i) { c.i = i; porClave[c.clave] = c; });
  var sinLugar = Object.keys(filas).filter(function (k) { var f = filas[k]; return f.como !== 'manual' && !areasLugar_(f); }).slice(0, 10);
  if (sinLugar.length) {
    var vecino = function (i) { var c = sesiones[i], f = c && filas[c.clave]; return c ? (f && f.titulo ? f.titulo : '(sin título)') + ' — ' + c.texto.slice(0, 120) : ''; };
    var lista = sinLugar.map(function (k, i) {
      var f = filas[k], c = porClave[k];
      return '### ' + (i + 1) + ' · ' + (f.fuente || '') + ' · ' + String(f.ts || '').slice(0, 10) + '\n' +
        (c ? c.muestra : (f.titulo || '') + ' — ' + (f.texto || '')) +
        (c ? '\n(Lo que se habló justo antes: ' + (vecino(c.i + 1) || 'nada') + ' · justo después: ' + (vecino(c.i - 1) || 'nada') + ')' : '');
    }).join('\n\n');
    var sys = 'Eres el departamento de Archivo de Juan (fundador de Spacio AM, apartamentos de estadía corta en Guatemala). Estas conversaciones quedaron SIN CLASIFICAR. ' +
      'Míralas con calma y con el contexto de lo que se habló antes y después, y dale a cada una su lugar: un área de vida (proposito, relaciones, finanzas, health, comunidad, espiritualidad) ' +
      'o un cajón (ideas, interes, ocio). ' + AREAS_ARCHIVO_REGLAS_.replace(/Si de verdad no se entiende[^.]*\.\s*/, '') +
      'Aquí no se vale dejarla vacía: si de verdad no se entiende, va a c = "ocio". Dale también un título de 2 a 5 palabras. ' +
      'Responde SOLO un JSON: {"1":{"a":"","c":"ideas","tipo":"permanente","g":"","t":"App de reservas para vecinos"},…}.';
    var txt = ''; try { txt = claude_(CFG.MODELO_REDACTOR, 900, sys, lista, 0, []); } catch (e) { console.error('archivo revisar: ' + e); }
    var j = {}; try { j = JSON.parse(String(txt || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
    sinLugar.forEach(function (k, i) {
      var o = j[String(i + 1)]; if (!o) return;
      var ar = String(o.a || '').toLowerCase(), cj = String(o.c || '').toLowerCase(), tp = String(o.tipo || '').toLowerCase();
      if (!areaOk_(ar) && !cajonOk_(cj)) cj = 'ocio';
      var gd = String(o.g || '').toLowerCase();
      areasGuardar_(filas, { clave: k, area: areaOk_(ar) ? ar : '', cajon: cajonOk_(cj) ? cj : '', tipo: tipoOk_(tp) ? tp : '', como: 'archivo', guardado: ['guardar', 'temporal', 'no_guardar'].indexOf(gd) >= 0 ? gd : '',
        titulo: String(o.t || '').replace(/["«»]/g, '').slice(0, 80) });
      r.revisadas++; if (cj === 'ocio') r.a_ocio++;
    });
  }
  /* 3 · el tipo de lo que no lo tiene (lo clasificado antes de que existiera) */
  var sinTipo = Object.keys(filas).filter(function (k) { return !tipoOk_(filas[k].tipo) && areasLugar_(filas[k]); }).slice(0, 25);
  if (sinTipo.length) {
    var sysT = 'Para cada tema de Juan, di si es "proceso" (algo que se está resolviendo y termina: una gestión, una coordinación, un pendiente) ' +
      'o "permanente" (está para quedarse: una decisión, un dato, una idea, una referencia, algo que vale guardar). Responde SOLO un JSON: {"1":"proceso","2":"permanente",…}.';
    var lt = sinTipo.map(function (k, i) { var f = filas[k]; return (i + 1) + '. ' + (f.titulo || '') + ' — ' + String(f.texto || '').slice(0, 160); }).join('\n');
    var tt = ''; try { tt = claude_(CFG.MODELO_CLASIFICADOR, 400, sysT, lt, 0, []); } catch (e) { console.error('archivo tipos: ' + e); }
    var jt = {}; try { jt = JSON.parse(String(tt || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
    sinTipo.forEach(function (k, i) { var tp = String(jt[String(i + 1)] || '').toLowerCase(); if (tipoOk_(tp)) { areasGuardar_(filas, { clave: k, tipo: tp }); r.tipos++; } });
  }
  /* 4 · los archivos de Drive, con sus reglas */
  try { archivistaArchivos_(reglas, r); } catch (e) { console.error('archivo drive: ' + e); }
  /* 5 · ideas que Juan todavía no conoce (proyectos en potencia): se avisan una sola vez */
  var P = PropertiesService.getScriptProperties(), avisadas = []; try { avisadas = JSON.parse(P.getProperty('ARCHIVO_IDEAS_AVISADAS') || '[]'); } catch (e) {}
  var nuevasIdeas = Object.keys(filas).filter(function (k) { return filas[k].cajon === 'ideas' && avisadas.indexOf(k) < 0; });
  r.ideas = nuevasIdeas.map(function (k) { return filas[k].titulo || 'Idea'; });
  if (nuevasIdeas.length) P.setProperty('ARCHIVO_IDEAS_AVISADAS', JSON.stringify(avisadas.concat(nuevasIdeas).slice(-300)));
  var informe = r.nuevas + ' cosa(s) nueva(s) clasificada(s) · ' + r.revisadas + ' sin clasificar revisada(s)' + (r.a_ocio ? ' (' + r.a_ocio + ' a Ocio)' : '') +
    ' · ' + r.tipos + ' con tipo · ' + r.archivos + ' archivo(s) a su carpeta' + (r.archivos_papelera ? ', ' + r.archivos_papelera + ' temporal(es) vencido(s) a la papelera' : '') + '.' +
    (r.reglas.length ? '\nReglas cambiadas: ' + r.reglas.join(' · ') + '.' : '') + (r.ideas.length ? '\nIdeas nuevas (proyectos en potencia): ' + r.ideas.join(' · ') + '.' : '') +
    (pedido ? '\nPedido: ' + pedido : '');
  a.ultima = new Date().toISOString(); agGuardar_(hojaAg_(), AG_CAB_, a);
  agGuardar_(hojaAgT_(), AGT_CAB_, { id: 'agt' + Date.now(), agente: a.id, creado: new Date(t0).toISOString(), origen: origen, pedido: pedido || '', estado: 'hecha',
    informe: informe, propuestas: 0, costo_usd: 0, terminado: a.ultima });
  if (r.ideas.length) {
    try { opGuardar_(adm, 'alma', 'hub', 'Archivo encontró ' + (r.ideas.length === 1 ? 'una idea nueva y la guardó' : r.ideas.length + ' ideas nuevas y las guardó') + ' en el cajón Ideas (proyectos en potencia): ' + r.ideas.join(' · ') + '. Cuando quieras convertir una en proyecto, dime.',
      [{ tipo: 'agente', resumen: 'Archivo · ideas' }]); } catch (e) {}
  }
  return { ok: true, agente: a.nombre, informe: informe, propuestas: [], costo_usd: 0 };
}

/* ═══ REGLAS DE GUARDADO ════════════════════════════════════════════════════════════════════════════════════
   Cada grupo (las áreas, los proyectos, cada cajón y cada tipo de archivo) tiene su regla: cómo se ordena y qué tanto
   se guarda. Viven en la hoja ALMA_ARCHIVO_REGLAS (se editan ahí, o pidiéndoselo a Archivo por medio de Alma).
     · orden: alfabetico (por título) · creacion (lo más nuevo primero) · modificacion (lo último que se movió primero).
     · guardado: guardar (se queda) · temporal (se queda «dias» días desde su última modificación y luego se archiva)
       · no_guardar (ruido: no se muestra) · segun_tipo (lo permanente se guarda; lo de proceso es temporal).
   Además, cada cosa puede traer su propio guardado (lo decide Alma o Archivo al clasificarla: una prueba o un «hola»
   suelto es no_guardar; un dato que vale guardar es guardar aunque esté en Ocio).
   Una conversación vencida o no guardada solo deja de verse en las áreas: el chat completo sigue en su lugar.
   Un archivo vencido va a la papelera de Drive (ahí se puede recuperar 30 días). */
var ARCHIVISTA_REGLAS_CAB_ = ['grupo', 'que_es', 'orden', 'guardado', 'dias'];
var ARCHIVISTA_REGLAS_SEMILLA_ = [
  ['areas', 'Conversaciones de tus seis áreas', 'modificacion', 'segun_tipo', 90],
  ['proyectos', 'Proyectos', 'alfabetico', 'guardar', ''],
  ['ideas', 'Ideas: proyectos en potencia', 'creacion', 'guardar', ''],
  ['interes', 'Interés: preguntas y temas de curiosidad', 'alfabetico', 'guardar', ''],
  ['ocio', 'Ocio: bromas, charla casual, lo que no quedó claro', 'modificacion', 'temporal', 30],
  ['archivo:documento', 'Archivos: PDF, contratos, facturas, documentos', 'alfabetico', 'guardar', ''],
  ['archivo:foto', 'Archivos: fotos (daños, reportes, capturas)', 'creacion', 'temporal', 180],
  ['archivo:audio', 'Archivos: notas de voz (ya quedan escritas en el chat)', 'creacion', 'temporal', 30],
  ['archivo:otro', 'Archivos: lo demás', 'creacion', 'temporal', 90],
  ['correo:codigo', 'Correos: códigos de verificación', 'creacion', 'temporal', 1],
  ['correo:verificacion', 'Correos: enlaces para verificar', 'creacion', 'temporal', 3],
  ['correo:autorizacion', 'Correos que piden tu autorización', 'creacion', 'temporal', 30],
  ['correo:promocion', 'Correos: promociones y descuentos', 'creacion', 'temporal', 14],
  ['correo:spam', 'Correos: posible spam', 'creacion', 'temporal', 7],
  ['correo:normal', 'Correos de tus proyectos y de tu vida', 'modificacion', 'temporal', 90]
];
var ARCHIVISTA_ORDENES_ = ['alfabetico', 'creacion', 'modificacion'], ARCHIVISTA_GUARDADOS_ = ['guardar', 'temporal', 'no_guardar', 'segun_tipo'];
function archivistaHoja_() {
  var sh = hojaCrear_('ALMA_ARCHIVO_REGLAS', ARCHIVISTA_REGLAS_CAB_), n = sh.getLastRow();
  var ya = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (v) { return String(v[0]); }) : [];
  ARCHIVISTA_REGLAS_SEMILLA_.forEach(function (r) { if (ya.indexOf(r[0]) < 0) sh.appendRow(r); });
  return sh;
}
function archivistaReglas_() {
  var sh = archivistaHoja_(), n = sh.getLastRow(), out = {};
  if (n >= 2) sh.getRange(2, 1, n - 1, ARCHIVISTA_REGLAS_CAB_.length).getValues().forEach(function (v, i) {
    var o = { fila: i + 2, grupo: String(v[0]), que_es: String(v[1]), orden: String(v[2]).toLowerCase(), guardado: String(v[3]).toLowerCase(), dias: Number(v[4]) || 0 };
    if (ARCHIVISTA_ORDENES_.indexOf(o.orden) < 0) o.orden = 'modificacion';
    if (ARCHIVISTA_GUARDADOS_.indexOf(o.guardado) < 0) o.guardado = 'guardar';
    if (o.guardado === 'temporal' || o.guardado === 'segun_tipo') o.dias = o.dias || 90;
    out[o.grupo] = o;
  });
  return out;
}
/* El grupo de una cosa del archivo: su cajón, «proyectos» o «areas». */
function archivistaGrupo_(clave, lugar) { return cajonOk_(lugar) ? lugar : String(clave).indexOf('proy:') === 0 ? 'proyectos' : 'areas'; }
/* Qué pasa con una cosa: su guardado (el propio o el de la regla), hasta cuándo y si todavía se muestra. */
function archivistaEstado_(reglas, grupo, tipo, propio, ts) {
  var r = reglas[grupo] || { guardado: 'guardar', dias: 0 }, g = ARCHIVISTA_GUARDADOS_.indexOf(propio) >= 0 && propio !== 'segun_tipo' ? propio : r.guardado;
  if (g === 'segun_tipo') g = tipo === 'proceso' ? 'temporal' : 'guardar';
  var ms = new Date(ts).getTime(), vence = g === 'temporal' && ms ? ms + (r.dias || 90) * 86400000 : 0;
  return { guardado: g, vence: vence ? new Date(vence).toISOString() : '', visible: g !== 'no_guardar' && !(vence && vence < Date.now()) };
}
/* Ordena una lista de conversaciones según la regla de su grupo. */
function archivistaOrdenar_(lista, regla) {
  var o = (regla && regla.orden) || 'modificacion', ms = function (t) { var d = new Date(t).getTime(); return isNaN(d) ? 0 : d; };
  if (o === 'alfabetico') return lista.sort(function (a, b) { return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es', { sensitivity: 'base' }); });
  if (o === 'creacion') return lista.sort(function (a, b) { return ms(b.creado || b.ts) - ms(a.creado || a.ts); });
  return lista.sort(function (a, b) { return ms(b.ts) - ms(a.ts); });
}

/* Un pedido a Archivo (por medio de Alma) que cambia una regla: «que Ocio se guarde 60 días», «las ideas en orden alfabético». */
function archivistaCambiarReglas_(pedido) {
  var reglas = archivistaReglas_(), lista = Object.keys(reglas).map(function (g) { var r = reglas[g]; return g + ' (' + r.que_es + '): orden ' + r.orden + ', guardado ' + r.guardado + (r.dias ? ', ' + r.dias + ' días' : ''); }).join('\n');
  var sys = 'Eres el departamento de Archivo. Estas son las reglas de guardado:\n' + lista + '\n\nSi el pedido cambia alguna, responde SOLO un JSON con los cambios: ' +
    '{"cambios":[{"grupo":"ocio","orden":"alfabetico|creacion|modificacion","guardado":"guardar|temporal|no_guardar|segun_tipo","dias":60}]} (pon solo los campos que cambian; grupo exacto de la lista). Si no cambia ninguna regla: {"cambios":[]}.';
  var t = ''; try { t = claude_(CFG.MODELO_CLASIFICADOR, 300, sys, String(pedido), 0, []); } catch (e) { return []; }
  var j = {}; try { j = JSON.parse(String(t || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) { return []; }
  var sh = archivistaHoja_(), hechos = [];
  (j.cambios || []).forEach(function (c) {
    var r = reglas[String(c.grupo || '')]; if (!r) return;
    if (ARCHIVISTA_ORDENES_.indexOf(c.orden) >= 0) r.orden = c.orden;
    if (ARCHIVISTA_GUARDADOS_.indexOf(c.guardado) >= 0) r.guardado = c.guardado;
    if (Number(c.dias) > 0) r.dias = Math.round(Number(c.dias));
    sh.getRange(r.fila, 3, 1, 3).setValues([[r.orden, r.guardado, r.guardado === 'temporal' || r.guardado === 'segun_tipo' ? r.dias : '']]);
    hechos.push(r.que_es.split(':')[0] + ': orden ' + r.orden + ', ' + r.guardado + (r.guardado === 'temporal' || r.guardado === 'segun_tipo' ? ' ' + r.dias + ' días' : ''));
  });
  return hechos;
}

/* Los archivos (fotos, PDF, notas de voz que llegan por WhatsApp a la carpeta «ALMA · WhatsApp» de Drive): cada uno a su
   carpeta (Documentos, Fotos, Audios, Otros) con su regla escrita en la descripción; lo temporal que venció, a la papelera. */
var ARCHIVISTA_CARPETAS_ = { documento: 'Documentos', foto: 'Fotos', audio: 'Audios', otro: 'Otros' };
function archivistaTipoArchivo_(mime, nombre) {
  mime = String(mime || ''); nombre = String(nombre || '').toLowerCase();
  if (/^image\//.test(mime)) return 'foto';
  if (/^audio\//.test(mime) || /\.(ogg|mp3|m4a|aac|amr)$/.test(nombre)) return 'audio';
  if (/pdf|word|document|sheet|excel|presentation|text\//.test(mime) || /\.(pdf|docx?|xlsx?|csv|txt)$/.test(nombre)) return 'documento';
  return 'otro';
}
function archivistaArchivos_(reglas, r) {
  var cid = PropertiesService.getScriptProperties().getProperty('WA_CARPETA'); if (!cid) return;
  var raiz; try { raiz = DriveApp.getFolderById(cid); } catch (e) { return; }
  var subs = {}, sub = function (n) {
    if (subs[n]) return subs[n];
    var it = raiz.getFoldersByName(n); return (subs[n] = it.hasNext() ? it.next() : raiz.createFolder(n));
  };
  var hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'), limite = Date.now() + 4 * 60000;
  /* 1 · lo nuevo: los archivos sueltos en la carpeta principal */
  var it = raiz.getFiles();
  while (it.hasNext() && Date.now() < limite) {
    var f = it.next(), tipo = archivistaTipoArchivo_(f.getMimeType(), f.getName()), regla = reglas['archivo:' + tipo] || { guardado: 'guardar', orden: 'creacion' };
    var g = regla.guardado === 'segun_tipo' ? 'temporal' : regla.guardado;
    var hasta = g === 'temporal' ? Utilities.formatDate(new Date(f.getDateCreated().getTime() + (regla.dias || 90) * 86400000), CFG.TZ, 'yyyy-MM-dd') : '';
    if (g === 'no_guardar') { f.setTrashed(true); r.archivos_papelera++; continue; }
    f.setDescription('Archivo · ' + (g === 'temporal' ? 'temporal hasta ' + hasta : 'guardar'));
    /* orden alfabético: el nombre empieza por lo que es («Factura de luz · 20261030-…»); por fecha: por la fecha (como llega) */
    var m = f.getName().match(/^(\d{8}-\d{6}) · (.*?)(\.\w+)?$/);
    if (m && regla.orden === 'alfabetico' && m[2]) f.setName(m[2] + ' · ' + m[1] + (m[3] || ''));
    f.moveTo(sub(ARCHIVISTA_CARPETAS_[tipo]));
    r.archivos++;
  }
  /* 2 · lo temporal que ya venció → papelera (se puede recuperar 30 días) */
  Object.keys(ARCHIVISTA_CARPETAS_).forEach(function (t) {
    var its = raiz.getFoldersByName(ARCHIVISTA_CARPETAS_[t]); if (!its.hasNext()) return;
    var fs = its.next().getFiles();
    while (fs.hasNext() && Date.now() < limite) {
      var f = fs.next(); if (f.isTrashed()) continue;
      var d = String(f.getDescription() || ''), mm = d.match(/temporal hasta (\d{4}-\d{2}-\d{2})/);
      if (mm && mm[1] < hoy) { f.setTrashed(true); r.archivos_papelera++; }
    }
  });
}
