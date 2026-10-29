/* ═══ ÁREAS DE VIDA (solo la app de Alma) ══════════════════════════════════════════════════════════════════
   Cada usuario ordena su vida en 6 áreas: Propósito · Relaciones · Finanzas · Health · Comunidad · Espiritualidad.
   Cada proyecto (con sus web apps) y cada conversación lleva una. Por ahora solo el administrador principal.
     · Fijo por de dónde viene: Spacio AM y todo lo que llega de Hospitable, Airbnb, Booking y el WhatsApp de Spacio AM
       → Propósito; The Gentle Stoic Parent → Relaciones; Mi (Conta) → Finanzas (y también dentro de Spacio AM);
       Health de la app → Health.
     · Lo personal (los encargos de «escríbele a…» y los proyectos personales como «Boda»), lo clasifica Alma una vez.
     · Cada conversación del usuario con Alma (chat, voz, WhatsApp) también: Alma le pone área y título.
     · Cualquier conversación se puede mover a otra área con un toque (queda como la dejaste: «manual»).
   Hoja ALMA_AREAS: lo que Alma clasificó o tú moviste, y la memoria de las conversaciones personales
   (el relay de WhatsApp las olvida a los 7 días; aquí se quedan). */

var AREAS_ = [
  { k: 'proposito', n: 'Propósito', d: 'Tu trabajo y lo que construyes' },
  { k: 'relaciones', n: 'Relaciones', d: 'Tu familia, pareja y amigos' },
  { k: 'finanzas', n: 'Finanzas', d: 'Tu dinero, cuentas y facturas' },
  { k: 'health', n: 'Health', d: 'Tu cuerpo, descanso y energía' },
  { k: 'comunidad', n: 'Comunidad', d: 'Lo que das y compartes con otros' },
  { k: 'espiritualidad', n: 'Espiritualidad', d: 'Tu calma, fe y sentido' }
];
var AREAS_CAB_ = ['clave', 'area', 'como', 'titulo', 'fuente', 'texto', 'ts', 'actualizado'];
function hojaAreas_() { return hojaCrear_('ALMA_AREAS', AREAS_CAB_); }
function areaOk_(a) { return AREAS_.some(function (x) { return x.k === a; }); }

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
    'comunidad (voluntariado, vecinos, grupos, ayudar a otros), espiritualidad (fe, iglesia, meditación, sentido). Responde SOLO un JSON: {"1":"relaciones","2":"…"}. Si dudas, relaciones.';
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
    return { clave: 'alma:' + c.id, ts: new Date(c.fin).toISOString(), n: c.msgs.length,
      fuente: 'Alma · ' + (c.canales.llamada ? 'Voz' : c.canales.whatsapp && k.length === 1 ? 'WhatsApp' : 'Chat'),
      texto: String(ult.t).replace(/\s+/g, ' ').slice(0, 220),
      muestra: c.msgs.slice(0, 14).map(function (x) { return (x.de === 'yo' ? 'Juan: ' : 'Alma: ') + x.t.replace(/\s+/g, ' ').slice(0, 260); }).join('\n').slice(0, 1800) };
  }).reverse();
}
/* Alma le pone área y un título corto a cada conversación con ella (una vez; lo nuevo primero, 12 por vuelta). */
function areasClasificarAlma_(filas, sesiones) {
  var pend = sesiones.filter(function (c) { return !filas[c.clave]; }).slice(0, 12); if (!pend.length) return;
  var sys = 'Ordenas las conversaciones de Juan con su asistente Alma en una de 6 áreas de vida: proposito (su trabajo: Spacio AM, apartamentos, huéspedes, equipo, proveedores, proyectos y desarrollo de las apps), ' +
    'relaciones (familia, pareja, hijos, amigos), finanzas (dinero personal o del negocio, pagos, facturas, impuestos, inversiones), health (salud, ejercicio, sueño, comida, médicos), ' +
    'comunidad (ayudar a otros, voluntariado, vecinos, grupos, iglesia como comunidad), espiritualidad (fe, oración, meditación, sentido, gratitud). ' +
    'Elige el área del tema PRINCIPAL. Dale a cada una un título de 2 a 5 palabras en español, claro y sin comillas. ' +
    'Responde SOLO un JSON: {"1":{"a":"finanzas","t":"Pago del IVA de octubre"},"2":{…}}.';
  var lista = pend.map(function (c, i) { return '### ' + (i + 1) + '\n' + c.muestra; }).join('\n\n');
  var r = ''; try { r = claude_(CFG.MODELO_REDACTOR, 700, sys, lista, 0, []); } catch (e) { console.error('areas alma: ' + e); }
  var j = {}; try { j = JSON.parse(String(r || '').replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
  pend.forEach(function (c, i) {
    var o = j[String(i + 1)] || {}, a = String(o.a || '').toLowerCase(); if (!areaOk_(a)) return;   // sin respuesta: se intenta la próxima vez
    areasGuardar_(filas, { clave: c.clave, area: a, como: 'alma', titulo: String(o.t || '').replace(/["«»]/g, '').slice(0, 80) || 'Conversación con Alma', fuente: c.fuente, texto: c.texto, ts: c.ts });
  });
}

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
        convs.push({ clave: clave, area: f && areaOk_(f.area) ? f.area : 'proposito', como: f ? f.como : 'auto', proyecto: 'spacio',
          titulo: String(v[ix('huesped')] || 'Conversación') + (v[ix('propiedad')] ? ' · ' + v[ix('propiedad')] : ''),
          fuente: canal === 'whatsapp' ? 'WhatsApp' : canal === 'airbnb' ? 'Airbnb' : canal === 'booking' ? 'Booking' : 'Hospitable',
          texto: String(v[ix('ultimo_texto')] || '').slice(0, 220), ts: new Date(ms).toISOString(),
          url: 'https://hub.spacioam.com/?conv=' + encodeURIComponent(id) });
      });
    }
  } catch (e) { console.error('areas bandeja: ' + e); }

  /* 4 · Las conversaciones con Alma (ya clasificadas; lo que dice se toma vivo de la conversación) */
  sesiones.forEach(function (c) { var f = filas[c.clave]; if (f && areaOk_(f.area)) convs.push({ clave: c.clave, area: f.area, como: f.como, titulo: f.titulo || 'Conversación con Alma', fuente: c.fuente, texto: c.texto, ts: c.ts }); });

  /* 5 · Lo personal (ya clasificado) */
  var proyPers = [];
  Object.keys(filas).forEach(function (c) {
    var f = filas[c];
    if (c.indexOf('pers:') === 0) convs.push({ clave: c, area: areaOk_(f.area) ? f.area : 'relaciones', como: f.como, titulo: f.titulo, fuente: f.fuente || 'WhatsApp', texto: f.texto, ts: f.ts });
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

  return { ok: true, areas: AREAS_.map(function (a) {
    var c = convs.filter(function (x) { return x.area === a.k; });
    return { k: a.k, n: a.n, d: a.d, proyectos: proyectos.filter(function (p) { return p.area === a.k; }), conversaciones: c.slice(0, 60), total: c.length };
  }) };
}

/* Mover una conversación (o un proyecto personal) a otra área. */
function areaMover_(ses, clave, area) {
  if (!areasAdmin_(ses)) return { ok: false, error: 'solo admin principal' };
  clave = String(clave || ''); area = String(area || '');
  if (!/^(conv|pers|proy|alma):/.test(clave) || !areaOk_(area)) return { ok: false, error: 'datos' };
  areasGuardar_(areasFilas_(), { clave: clave, area: area, como: 'manual' });
  return { ok: true };
}
