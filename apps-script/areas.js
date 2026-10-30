/* ═══ ÁREAS DE VIDA (solo la app de Alma) ══════════════════════════════════════════════════════════════════
   Cada usuario ordena su vida en 6 áreas: Propósito · Relaciones · Finanzas · Health · Comunidad · Esencia (vida interior: fe, calma y presencia).
   Cada proyecto (con sus web apps) y cada conversación lleva una. Por ahora solo el administrador principal.
     · Fijo por de dónde viene: Spacio AM y todo lo que llega de Hospitable, Airbnb, Booking y el WhatsApp de Spacio AM
       → Propósito; The Gentle Stoic Parent → Relaciones; Mi (Conta) → Finanzas (y también dentro de Spacio AM);
       Health de la app → Health.
     · Lo personal (los encargos de «escríbele a…» y los proyectos personales como «Boda»), lo clasifica Alma una vez.
     · Cada conversación del usuario con Alma (chat, voz, WhatsApp) también: Alma le pone área y título.
     · Cualquier conversación se puede mover a otra área con un toque (queda como la dejaste: «manual»).
   Hoja ALMA_AREAS: lo que Alma clasificó o tú moviste, y la memoria de las conversaciones personales
   (el relay de WhatsApp las olvida a los 7 días; aquí se quedan).
   ARCHIVO (además de las áreas): tres cajones para lo que no es un área de vida, y el tipo de cada cosa.
     · Ideas: ideas de negocio o de proyectos, aunque todavía no tengan proyecto (proyectos en potencia).
     · Interés: preguntas y temas que le dieron curiosidad.
     · Ocio: bromas, charla casual, lo que no quedó claro o divagó.
     · tipo: «proceso» (algo que se está resolviendo y termina) o «permanente» (está para quedarse: una decisión, un dato,
       una idea, una referencia).
     · Lo que Alma no logra clasificar queda «sin clasificar» y el departamento de Archivo (archivo.js) lo revisa con más
       contexto. Nada se queda sin lugar. */

var AREAS_ = [
  { k: 'proposito', n: 'Propósito', d: 'Tu trabajo y lo que construyes' },
  { k: 'relaciones', n: 'Relaciones', d: 'Tu familia, pareja y amigos' },
  { k: 'finanzas', n: 'Finanzas', d: 'Tu dinero, cuentas y facturas' },
  { k: 'health', n: 'Health', d: 'Tu cuerpo, descanso y energía' },
  { k: 'comunidad', n: 'Comunidad', d: 'Lo que das y compartes con otros' },
  { k: 'espiritualidad', n: 'Esencia', d: 'Fe, calma y presencia' }   // la clave se queda (lo ya clasificado sigue aquí)
];
var CAJONES_ = [
  { k: 'ideas', n: 'Ideas', d: 'Proyectos en potencia: ideas de negocio y de proyectos' },
  { k: 'interes', n: 'Interés', d: 'Preguntas y temas que te dieron curiosidad' },
  { k: 'ocio', n: 'Ocio', d: 'Bromas, charla casual y lo que no quedó claro' }
];
var AREAS_CAB_ = ['clave', 'area', 'como', 'titulo', 'fuente', 'texto', 'ts', 'actualizado', 'tipo', 'cajon', 'guardado', 'creado'];
function hojaAreas_() {
  var sh = hojaCrear_('ALMA_AREAS', AREAS_CAB_);
  if (sh.getLastColumn() < AREAS_CAB_.length) sh.getRange(1, 1, 1, AREAS_CAB_.length).setValues([AREAS_CAB_]);   // columnas nuevas (tipo, cajón)
  return sh;
}
function areaOk_(a) { return AREAS_.some(function (x) { return x.k === a; }); }
function cajonOk_(c) { return CAJONES_.some(function (x) { return x.k === c; }); }
function tipoOk_(t) { return t === 'proceso' || t === 'permanente'; }
/* Dónde va: un cajón (si tiene) o su área. «-» en cajón = sin cajón a propósito (lo movieron a un área). */
function areasLugar_(f) { return f && cajonOk_(f.cajon) ? f.cajon : f && areaOk_(f.area) ? f.area : ''; }

/* Solo el administrador principal (también con su correo alterno), como Conexiones. */
function areasAdmin_(ses) {
  var adm = ses && ses.email ? adminPorEmail_(ses.email) : null;
  if (adm && !adm.principal) { try { adm = vozWebAdmin_(ses) || adm; } catch (e) {} }
  return adm && esAdminPrincipal_(adm) ? adm : null;
}

function areasFilas_() {
  var sh = hojaAreas_(), n = sh.getLastRow(), out = {}; if (n < 2) return out;
  sh.getRange(2, 1, n - 1, AREAS_CAB_.length).getValues().forEach(function (v, i) {
    var o = { fila: i + 2 }; AREAS_CAB_.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : String(v[j]); }); if (o.clave) out[o.clave] = o;
  });
  return out;
}
function areasGuardar_(filas, o) {
  var sh = hojaAreas_(), prev = filas[o.clave], cur = prev || {};
  var fila = AREAS_CAB_.map(function (k) { return k === 'actualizado' ? new Date().toISOString() : o[k] != null && String(o[k]) !== '' ? String(o[k]).slice(0, k === 'texto' ? 600 : 200) : (cur[k] || ''); });
  if (prev) sh.getRange(prev.fila, 1, 1, AREAS_CAB_.length).setValues([fila]); else { sh.appendRow(fila); }
  var nuevo = {}; AREAS_CAB_.forEach(function (k, j) { nuevo[k] = fila[j]; }); nuevo.fila = prev ? prev.fila : sh.getLastRow(); filas[o.clave] = nuevo;
}

/* Lo personal que todavía no tiene área: Alma lo clasifica de una vez (y queda guardado). */
function areasClasificar_(filas, pendientes) {
  if (!pendientes.length) return;
  var lista = pendientes.slice(0, 25).map(function (p, i) { return (i + 1) + '. ' + p.titulo + (p.texto ? ' — ' + String(p.texto).slice(0, 220) : ''); }).join('\n');
  var sys = 'Clasificas temas personales de Juan (fundador de Spacio AM) en una de 6 áreas de vida: proposito (trabajo, negocio, proyectos profesionales), ' +
    'relaciones (familia, pareja, hijos, amigos, celebraciones), finanzas (dinero, pagos, deudas, inversiones, impuestos), health (salud, ejercicio, médicos, descanso), ' +
    'comunidad (voluntariado, vecinos, grupos, ayudar a otros), espiritualidad (vida interior: fe y religión de cualquier tipo, oración, meditación, mindfulness, respiración, gratitud, sentido). Responde SOLO un JSON: {"1":"relaciones","2":"…"}. Si dudas, relaciones.';
  var r = '';
  try { r = claude_(CFG.MODELO_REDACTOR, 300, sys, lista, 0, []); } catch (e) { console.error('areas: ' + e); }
  var j = {}; try { j = JSON.parse(String(r || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
  pendientes.slice(0, 25).forEach(function (p, i) {
    var a = String(j[String(i + 1)] || '').toLowerCase();
    areasGuardar_(filas, { clave: p.clave, area: areaOk_(a) ? a : 'relaciones', como: areaOk_(a) ? 'alma' : 'auto', titulo: p.titulo, fuente: p.fuente, texto: p.texto, ts: p.ts });
  });
}

/* Las conversaciones con Alma (chat del Hub y de la app, llamadas y WhatsApp con ella), de la hoja ALMA_OPERATIVO.
   Una conversación = mensajes seguidos; una pausa de más de 45 min empieza otra. Las de los últimos 60 días. */
function areasSesiones_(adm) {
  var desde = Date.now() - 60 * 86400000, L = [], cur = null;
  var filas = []; try { filas = opFilas_(String(adm.email || '').toLowerCase(), 2000); } catch (e) { console.error('areas op: ' + e); }
  filas.forEach(function (m) {
    var ms = areasMs_(m.ts); if (ms < desde || !String(m.texto || '').trim()) return;
    if (!cur || ms - cur.fin > 45 * 60000) { cur = { id: m.id || String(ms), ini: ms, fin: ms, canales: {}, msgs: [] }; L.push(cur); }
    cur.fin = ms; cur.canales[m.canal] = 1; cur.msgs.push({ de: m.de, t: String(m.texto) });
  });
  return L.filter(function (c) { return c.msgs.some(function (x) { return x.de === 'yo'; }); }).map(function (c) {
    var k = Object.keys(c.canales), ult = c.msgs[c.msgs.length - 1];
    return { clave: 'alma:' + c.id, ts: new Date(c.fin).toISOString(), creado: new Date(c.ini).toISOString(), n: c.msgs.length,
      fuente: 'Alma · ' + (c.canales.llamada ? 'Voz' : c.canales.app && k.length === 1 ? 'Navegador' : c.canales.whatsapp && k.length === 1 ? 'WhatsApp' : 'Chat'),
      texto: String(ult.t).replace(/\s+/g, ' ').slice(0, 220),
      muestra: c.msgs.slice(0, 14).map(function (x) { return (x.de === 'yo' ? 'Juan: ' : 'Alma: ') + x.t.replace(/\s+/g, ' ').slice(0, 260); }).join('\n').slice(0, 1800) };
  }).reverse();
}
/* Alma le pone área y un título corto a cada conversación con ella (una vez; lo nuevo primero, 12 por vuelta). */
function areasClasificarAlma_(filas, sesiones) {
  var pend = sesiones.filter(function (c) { return !filas[c.clave]; }).slice(0, 12); if (!pend.length) return;
  var sys = 'Ordenas las conversaciones de Juan con su asistente Alma en una de 6 áreas de vida: proposito (su trabajo: Spacio AM, apartamentos, huéspedes, equipo, proveedores, proyectos y desarrollo de las apps), ' +
    'relaciones (familia, pareja, hijos, amigos), finanzas (dinero personal o del negocio, pagos, facturas, impuestos, inversiones), health (salud, ejercicio, sueño, comida, médicos), ' +
    'comunidad (ayudar a otros, voluntariado, vecinos, grupos, iglesia como comunidad), espiritualidad (vida interior: fe y religión de cualquier tipo, oración, meditación, mindfulness, respiración, gratitud, sentido). ' +
    'Elige el área del tema PRINCIPAL. Dale a cada una un título de 2 a 5 palabras en español, claro y sin comillas. ' +
    AREAS_ARCHIVO_REGLAS_ +
    'Y g (guardado): "no_guardar" si es ruido (una prueba, un «hola» suelto, algo vacío), "guardar" si vale guardarse para siempre aunque sea casual, o "" para seguir la regla de su grupo. ' +
    'Responde SOLO un JSON: {"1":{"a":"finanzas","c":"","tipo":"proceso","g":"","t":"Pago del IVA de octubre"},"2":{"a":"","c":"ocio","tipo":"permanente","g":"","t":"Bromas sobre el clima"},…}.';
  var lista = pend.map(function (c, i) { return '### ' + (i + 1) + '\n' + c.muestra; }).join('\n\n');
  var r = ''; try { r = claude_(CFG.MODELO_REDACTOR, 700, sys, lista, 0, []); } catch (e) { console.error('areas alma: ' + e); }
  var j = {}; try { j = JSON.parse(String(r || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
  pend.forEach(function (c, i) {
    var o = j[String(i + 1)]; if (!o) return;   // sin respuesta: se intenta la próxima vez
    var a = String(o.a || '').toLowerCase(), cj = String(o.c || '').toLowerCase(), tp = String(o.tipo || '').toLowerCase(), gd = String(o.g || '').toLowerCase();
    var ok = areaOk_(a) || cajonOk_(cj);
    /* Si no se pudo: queda «sin clasificar» (como = sin) y el departamento de Archivo la revisa con más contexto. */
    areasGuardar_(filas, { clave: c.clave, area: areaOk_(a) ? a : '', cajon: cajonOk_(cj) ? cj : '', tipo: tipoOk_(tp) ? tp : '', como: ok ? 'alma' : 'sin', creado: c.creado,
      guardado: ['guardar', 'temporal', 'no_guardar'].indexOf(gd) >= 0 ? gd : '',
      titulo: String(o.t || '').replace(/["«»]/g, '').slice(0, 80) || 'Conversación con Alma', fuente: c.fuente, texto: c.texto, ts: c.ts });
  });
}

/* Lo que va en los cajones y el tipo (lo usan Alma al clasificar y el departamento de Archivo). */
var AREAS_ARCHIVO_REGLAS_ = 'Además, si NO es un tema de un área sino algo de estos cajones, pon a = "" y c = el cajón: ' +
  'ideas (una idea de negocio o de proyecto, aunque no tenga proyecto todavía: un proyecto en potencia), ' +
  'interes (una pregunta o tema de curiosidad: cómo funciona algo, datos, cultura, noticias), ' +
  'ocio (bromas, charla casual, saludos, algo que no quedó claro o en que divagó). Si es de un área, c = "". ' +
  'Y tipo: "proceso" si es algo que se está resolviendo y termina (una gestión, una coordinación, un pendiente) o "permanente" si está para quedarse (una decisión, un dato, una idea, una referencia, una conversación que vale guardar). ' +
  'Si de verdad no se entiende de qué se trata, deja a = "" y c = "" (lo revisa el departamento de Archivo). ';

function areasMs_(t) { var d = new Date(t); return isNaN(d) ? 0 : d.getTime(); }

/* Todo junto: las 6 áreas con sus proyectos y conversaciones. */
function areas_(ses) {
  var adm = areasAdmin_(ses); if (!adm) return { ok: false, error: 'Por ahora las áreas son solo del administrador principal.' };
  var filas = areasFilas_(), convs = [], pend = [], personal = {};

  /* 1 · Lo personal: los encargos de «escríbele a…» que siguen vivos se anotan (se quedan aunque el relay se olvide). */
  var relay = {}; try { relay = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_RELAY') || '{}'); } catch (e) {}
  Object.keys(relay).forEach(function (k) {
    var r = relay[k] || {}, h = r.h || [], ult = h.length ? h[h.length - 1] : null, clave = 'pers:' + k;
    var o = { clave: clave, titulo: r.nombre || ('+' + (r.wa || k)), fuente: 'WhatsApp · Alma asistente', texto: (ult && (ult.texto || ult.t)) || r.objetivo || '', ts: ult && ult.ts ? new Date(ult.ts).toISOString() : '' };
    if (!filas[clave]) pend.push(o); else areasGuardar_(filas, { clave: clave, titulo: o.titulo, texto: o.texto, ts: o.ts });
  });
  /* 2 · Los proyectos personales («Boda», «Mudanza»…) */
  var proys = []; try { proys = proyFilas_().filter(function (p) { return p.estado !== 'cerrado'; }); } catch (e) {}
  proys.forEach(function (p) { var clave = 'proy:' + p.proyecto; if (!filas[clave]) pend.push({ clave: clave, titulo: p.proyecto, fuente: 'Proyecto personal', texto: p.resumen || p.objetivo, ts: p.actualizado instanceof Date ? p.actualizado.toISOString() : String(p.actualizado || '') }); });
  areasClasificar_(filas, pend);
  var sesiones = areasSesiones_(adm); areasClasificarAlma_(filas, sesiones);
  Object.keys(filas).forEach(function (c) { if (c.indexOf('pers:') === 0) personal[c.slice(5)] = 1; });

  /* 3 · Las conversaciones de Spacio AM (bandeja del Hub: Hospitable, Airbnb, Booking y el WhatsApp de Spacio AM), del último mes */
  var desde = Date.now() - 30 * 86400000;
  try {
    var sh = ssAlma_().getSheetByName('ALMA_INBOX'), n = sh ? sh.getLastRow() : 0;
    if (n > 1) {
      var ix = function (k) { return INBOX_CAB_.indexOf(k); };
      sh.getRange(2, 1, n - 1, INBOX_CAB_.length).getValues().forEach(function (v) {
        var id = String(v[ix('conv_id')] || ''), ts = v[ix('ultimo_ts')], ms = ts instanceof Date ? ts.getTime() : areasMs_(ts);
        if (!id || ms < desde) return;
        if (id.indexOf('wa:') === 0 && personal[fin8_(id.slice(3))]) return;   // lo personal no va con el trabajo
        var canal = String(v[ix('ultimo_canal')] || v[ix('canal')] || ''), clave = 'conv:' + id, f = filas[clave];
        convs.push({ clave: clave, area: areasLugar_(f) || 'proposito', como: f ? f.como : 'auto', tipo: f ? f.tipo || '' : 'proceso', proyecto: 'spacio',
          titulo: String(v[ix('huesped')] || 'Conversación') + (v[ix('propiedad')] ? ' · ' + v[ix('propiedad')] : ''),
          fuente: canal === 'whatsapp' ? 'WhatsApp' : canal === 'airbnb' ? 'Airbnb' : canal === 'booking' ? 'Booking' : 'Hospitable',
          texto: String(v[ix('ultimo_texto')] || '').slice(0, 220), ts: new Date(ms).toISOString(),
          url: 'https://hub.spacioam.com/?conv=' + encodeURIComponent(id) });
      });
    }
  } catch (e) { console.error('areas bandeja: ' + e); }

  /* 4 · Las conversaciones con Alma (ya clasificadas; lo que dice se toma vivo de la conversación) */
  var sin = 0;
  sesiones.forEach(function (c) {
    var f = filas[c.clave], l = areasLugar_(f); if (f && !l) sin++;
    if (l) convs.push({ clave: c.clave, area: l, como: f.como, tipo: f.tipo || '', guardado: f.guardado || '', creado: c.creado, titulo: f.titulo || 'Conversación con Alma', fuente: c.fuente, texto: c.texto, ts: c.ts });
  });

  /* 5 · Lo personal (ya clasificado) */
  var proyPers = [];
  Object.keys(filas).forEach(function (c) {
    var f = filas[c];
    if (c.indexOf('pers:') === 0) convs.push({ clave: c, area: areasLugar_(f) || 'relaciones', como: f.como, tipo: f.tipo || '', guardado: f.guardado || '', creado: f.creado || '', titulo: f.titulo, fuente: f.fuente || 'WhatsApp', texto: f.texto, ts: f.ts });
    if (c.indexOf('proy:') === 0 && proys.some(function (p) { return 'proy:' + p.proyecto === c; }))
      proyPers.push({ k: c, area: areaOk_(f.area) ? f.area : 'relaciones', n: f.titulo, d: String(f.texto || '').slice(0, 160), mover: true });
  });
  convs.sort(function (a, b) { return areasMs_(b.ts) - areasMs_(a.ts); });

  /* Los proyectos fijos del administrador principal, con sus web apps */
  var spacio = { k: 'spacio', area: 'proposito', n: 'Spacio AM', d: 'Apartamentos de estadía corta en Guatemala', apps: [
    { n: 'Hub', d: 'Centro', url: 'https://hub.spacioam.com' }, { n: 'Hola', d: 'Huéspedes', url: 'https://hola.spacioam.com' },
    { n: 'Epi', d: 'Operación', url: 'https://epi.spacioam.com' }, { n: 'Grow', d: 'Proyectos', url: 'https://grow.spacioam.com' },
    { n: 'Mi', d: 'Finanzas', url: 'https://mi.spacioam.com' }, { n: 'Docs', d: 'Contratos', url: 'https://docs.spacioam.com' }] };
  var proyectos = [spacio,
    { k: 'gsp', area: 'relaciones', n: 'The Gentle Stoic Parent', d: 'El ritmo de la familia, con Alma en modo familiar', apps: [{ n: 'The Gentle Stoic Parent', d: 'Familia', url: 'https://thegentlestoicparent.com' }] },
    { k: 'mi', area: 'finanzas', n: 'Mi · Conta', d: 'Facturas y contabilidad (también vive dentro de Spacio AM)', apps: [{ n: 'Mi', d: 'Finanzas', url: 'https://mi.spacioam.com' }] },
    { k: 'health', area: 'health', n: 'Health', d: 'Apple Salud en la app de Alma', apps: [{ n: 'Health', d: 'Apple Salud', nativa: 'health', url: 'https://hub.spacioam.com/health/' }] }
  ].concat(proyPers);

  /* Reglas de guardado (archivista.js): lo vencido o que no se guarda deja de verse aquí (el chat sigue completo) y
     cada grupo se ordena a su manera (alfabético, por creación o por modificación). */
  var reglas = {}; try { reglas = archivistaReglas_(); } catch (e) { console.error('areas reglas: ' + e); }
  var ocultas = 0;
  convs = convs.filter(function (x) {
    var e = archivistaEstado_(reglas, archivistaGrupo_(x.clave, x.area), x.tipo, x.guardado, x.ts);
    x.guardado = e.guardado; x.vence = e.vence; if (!e.visible) ocultas++;
    return e.visible;
  });
  var grupo = function (a) {
    var c = archivistaOrdenar_(convs.filter(function (x) { return x.area === a.k; }), reglas[archivistaGrupo_('', a.k)]);
    return { k: a.k, n: a.n, d: a.d, proyectos: proyectos.filter(function (p) { return p.area === a.k; }), conversaciones: c.slice(0, 60), total: c.length };
  };
  if (reglas.proyectos) proyectos = proyectos.slice(0, 4).concat(archivistaOrdenar_(proyectos.slice(4).map(function (p) { p.titulo = p.n; return p; }), reglas.proyectos));
  return { ok: true, areas: AREAS_.map(grupo), cajones: CAJONES_.map(grupo), sin_clasificar: sin, archivadas: ocultas };
}

/* Mover una conversación (o un proyecto personal) a otra área o a un cajón del archivo. */
function areaMover_(ses, clave, area) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'solo admin principal' };
  clave = String(clave || ''); area = String(area || '');
  if (!/^(conv|pers|proy|alma):/.test(clave) || !(areaOk_(area) || cajonOk_(area))) return { ok: false, error: 'datos' };
  areasGuardar_(areasFilas_(), cajonOk_(area) ? { clave: clave, cajon: area, como: 'manual' } : { clave: clave, area: area, cajon: '-', como: 'manual' });
  return { ok: true };
}
