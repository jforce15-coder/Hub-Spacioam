/* ═══ CONSULTAS POR TEMA (herramienta consultas_tema) ═════════════════════════════════════════════════════════════
   «¿Qué porcentaje de las consultas de Mónaco necesita parqueo, en el último mes o los últimos 2 meses?» (Juan,
   19-nov-2026, #913). Alma no tenía el conteo: solo recordaba una conversación. Ahora lo cuenta el código, no la IA:
   · Fuente: ALMA_MSG_INQ (cada mensaje de una consulta que llega por el webhook de Hospitable). Cuando la consulta
     reserva, sus filas pasan al id de la reserva (vincularReserva_), así que también cuentan las que ya reservaron.
   · La propiedad de cada conversación sale de su fila en ALMA_INBOX.
   · Una consulta entra al período por el día de su primer mensaje. Solo cuentan los mensajes del huésped (los nuestros
     y los automáticos hablan de parqueo aunque nadie lo pida).
   · El tema se busca por palabras (parqueo: parqueo, parquear, estacionamiento, parking, garaje, cochera…). Devuelve los
     números, el porcentaje y un pedacito de cada mensaje que lo pidió, para que se pueda revisar.
   Lo que escribe por WhatsApp sin reserva no entra (no dice de qué propiedad es). Solo el administrador principal. */
var CTEMA_PALABRAS_ = {
  parqueo: ['parqueo', 'parqueos', 'parquear', 'parqueadero', 'estacionamiento', 'estacionar', 'aparcamiento', 'aparcar', 'parking', 'garage', 'garaje', 'cochera', 'parqueen', 'parqueamos']
};
var CTEMA_SINONIMO_ = { parking: 'parqueo', estacionamiento: 'parqueo', parqueos: 'parqueo', garaje: 'parqueo', garage: 'parqueo', carro: 'parqueo', carros: 'parqueo' };
function ctemaNorm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
/* La expresión del tema: sus palabras (parqueo) o la palabra que dieron, como palabra completa y sin tildes. */
function ctemaRegex_(tema) {
  var t = ctemaNorm_(tema) || 'parqueo'; t = CTEMA_SINONIMO_[t] || t;
  var ps = (CTEMA_PALABRAS_[t] || [t]).map(function (p) { return ctemaNorm_(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  return { tema: t, re: new RegExp('(^|[^a-z0-9])(' + ps.join('|') + ')(?=$|[^a-z0-9])') };
}
/* Un pedacito del mensaje alrededor de la palabra (máx. 140), sin teléfonos ni correos. */
function ctemaPedazo_(texto, re) {
  var t = String(texto || '').replace(/\s+/g, ' ').trim(), n = ctemaNorm_(t), m = n.match(re), i = m ? m.index : 0;
  var a = Math.max(0, i - 60), p = t.slice(a, a + 140);
  return (a ? '…' : '') + p.replace(/[^\s@]+@[^\s@]+/g, '[correo]').replace(/\+?\d[\d\s-]{6,}\d/g, '[número]') + (a + 140 < t.length ? '…' : '');
}
/* Cuenta. filasMsg: [{conv_id, created, tipo, texto}] · inbox: [{conv_id, propiedad, huesped}] · hoyMs: ahora en ms.
   Devuelve { ok, propiedad, tema, periodos: [{ dias, desde, consultas, con_tema, porcentaje, reservaron, mensajes }] }. */
function ctemaContar_(filasMsg, inbox, propiedad, tema, diasLista, hoyMs) {
  var q = ctemaNorm_(propiedad), rt = ctemaRegex_(tema);
  if (!q) return { ok: false, error: 'Falta la propiedad o el edificio (por ejemplo «Mónaco»).' };
  var prop = {}, nombres = {};
  (inbox || []).forEach(function (x) { var id = String(x.conv_id || ''); if (id) { prop[id] = { p: String(x.propiedad || ''), h: String(x.huesped || '').trim().split(/\s+/)[0] }; } });
  var convs = {};
  (filasMsg || []).forEach(function (r) {
    var id = String(r.conv_id || ''), f = Date.parse(isoDe_(r.created)); if (!id || isNaN(f)) return;
    var c = convs[id] || (convs[id] = { id: id, inicio: f, tema: null });
    if (f < c.inicio) c.inicio = f;
    if (String(r.tipo || '') !== 'guest' || c.tema) return;
    var tx = String(r.texto || ''); if (rt.re.test(ctemaNorm_(tx))) c.tema = { texto: ctemaPedazo_(tx, rt.re), ts: f };
  });
  var suyas = Object.keys(convs).map(function (k) { return convs[k]; }).filter(function (c) {
    var pp = prop[c.id]; if (!pp || !pp.p) return false;
    var pn = ctemaNorm_(pp.p); if (pn.indexOf(q) < 0 && pn.replace(/\s+/g, '').indexOf(q.replace(/\s+/g, '')) < 0) return false;
    nombres[pp.p] = 1; return true;
  });
  if (!suyas.length) {
    var hay = {}; Object.keys(prop).forEach(function (k) { if (convs[k] && prop[k].p) hay[prop[k].p] = 1; });
    return { ok: false, error: 'No encontré consultas guardadas de «' + propiedad + '». Propiedades con consultas: ' + Object.keys(hay).sort().slice(0, 30).join(', ') + '. No lo estimes.' };
  }
  var periodos = (diasLista && diasLista.length ? diasLista : [30, 60]).map(function (d) {
    d = Math.max(1, Math.min(365, Math.round(Number(d) || 30)));
    var corte = hoyMs - d * 864e5, en = suyas.filter(function (c) { return c.inicio >= corte; }), con = en.filter(function (c) { return c.tema; });
    return { dias: d, desde: Utilities.formatDate(new Date(corte), CFG.TZ, 'yyyy-MM-dd'), consultas: en.length, con_tema: con.length,
      porcentaje: en.length ? Math.round(con.length * 1000 / en.length) / 10 + ' %' : 'sin consultas',
      reservaron: con.filter(function (c) { return c.id.indexOf('inq:') !== 0; }).length + ' de ' + con.length + ' que lo pidieron ya reservaron',
      mensajes: con.sort(function (a, b) { return b.tema.ts - a.tema.ts; }).slice(0, 12).map(function (c) {
        return { dia: Utilities.formatDate(new Date(c.tema.ts), CFG.TZ, 'yyyy-MM-dd'), quien: prop[c.id].h, propiedad: prop[c.id].p, dijo: c.tema.texto };
      }) };
  });
  return { ok: true, propiedad: q, apartamentos: Object.keys(nombres).sort(), tema: rt.tema, periodos: periodos };
}
/* Herramienta consultas_tema. inp: { propiedad, tema, dias }. */
function consultasTema_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'El conteo de consultas solo lo ve el administrador principal.' };
  var dias = String(inp.dias || '').split(/[^\d]+/).filter(Boolean).map(Number).slice(0, 3);
  var filas, inbox;
  try {
    filas = leerTablaHoja_(ssAlma_().getSheetByName('ALMA_MSG_INQ'));
    var sh = ssAlma_().getSheetByName('ALMA_INBOX'), n = sh ? sh.getLastRow() : 0;
    inbox = n < 2 ? [] : sh.getRange(2, 1, n - 1, INBOX_CAB_.length).getValues().map(function (v) { var o = {}; INBOX_CAB_.forEach(function (k, i) { o[k] = v[i]; }); return o; });
  } catch (e) { return { ok: false, error: 'No pude leer las consultas guardadas: ' + e.message + '. No lo estimes.' }; }
  var r = ctemaContar_(filas, inbox, inp.propiedad, inp.tema, dias, Date.now());
  if (!r.ok) return r;
  r.fuente = 'Mensajes de las consultas de Airbnb y Booking (Hospitable) guardados en el Hub; cuenta las que ya reservaron. No incluye WhatsApp.';
  r.regla = 'Repite los números tal cual. Una consulta cuenta si en algún mensaje suyo pidió o preguntó por el tema.';
  r.decir = r.periodos.map(function (p) { return 'Últimos ' + p.dias + ' días: ' + p.con_tema + ' de ' + p.consultas + ' consultas (' + p.porcentaje + ')'; }).join('; ') + '.';
  return r;
}
