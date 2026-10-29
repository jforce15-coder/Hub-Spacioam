/* ═══ ÁREAS DE VIDA (solo la app de Alma) ══════════════════════════════════════════════════════════════════
   Cada usuario ordena su vida en 6 áreas: Propósito · Relaciones · Finanzas · Health · Comunidad · Espiritualidad.
   Cada proyecto (con sus web apps) y cada conversación lleva una. Por ahora solo el administrador principal.
     · Fijo por de dónde viene: Spacio AM y todo lo que llega de Hospitable, Airbnb, Booking y el WhatsApp de Spacio AM
       → Propósito; The Gentle Stoic Parent → Relaciones; Mi (Conta) → Finanzas (y también dentro de Spacio AM);
       Health de la app → Health.
     · Lo personal (los encargos de «escríbele a…» y los proyectos personales como «Boda»), lo clasifica Alma una vez.
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

  /* 4 · Lo personal (ya clasificado) */
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
  if (!/^(conv|pers|proy):/.test(clave) || !areaOk_(area)) return { ok: false, error: 'datos' };
  areasGuardar_(areasFilas_(), { clave: clave, area: area, como: 'manual' });
  return { ok: true };
}
