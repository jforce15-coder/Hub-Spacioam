/* ═══ PRECIO POR NOCHE (herramienta precio_por_noche) ══════════════════════════════════════════════════════════════
   Pedido de Juan (17-nov-2026, por llamada): «Mónaco: busca una reserva de Airbnb del último mes, dame el desglose
   (tarifa, limpieza y comisión de la plataforma) dividido entre las noches, y lo que tenemos en Hola de largo plazo».
   Alma no tenía de dónde leer el desglose de una reserva ni los contratos de largo plazo de Hola.
   · Corta: la reserva de Airbnb más reciente (llegada en los últimos «dias», 31 por defecto) de las propiedades cuyo
     nombre en Hospitable coincide (p. ej. «Mónaco» o «Z7»), ya terminada si hay una; si no, la última que empezó.
     El desglose sale de Hospitable (financials del lado del anfitrión, en centavos) y cada parte se divide entre las
     noches. Nunca se estima: sin desglose en Hospitable, lo dice.
   · Largo plazo: los contratos de Hola (pestaña Long Term, acción ltList con la llave de robot) de esas propiedades:
     monto, moneda, frecuencia y su equivalente por noche (mensual = 30 noches, quincenal = 15, semanal = 7,
     personalizado = cada cuántos días). Sin nombres, teléfonos ni documentos de los inquilinos.
   · Quién la ve: solo el administrador principal (es dinero). */
var PNOCHE_DIAS_FREC_ = { mensual: 30, quincenal: 15, semanal: 7 };

function pnocheNorm_(x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-–—_]/g, ''); }
function pnocheCoincide_(nombre, q) { var n = pnocheNorm_(nombre), k = pnocheNorm_(q); return !!k && n.indexOf(k) >= 0; }
function pnocheRedondo_(n) { return Math.round(n * 100) / 100; }

/* Propiedades de Hospitable cuyo nombre contiene lo que dijo Juan: [{ id, nombre }]. */
function pnochePropiedades_(q) {
  var out = [];
  for (var p = 1; p <= 5; p++) {
    var r = hosp_('get', '/properties?per_page=100&page=' + p); if (r.code !== 200) break;
    var d = (r.json && r.json.data) || [];
    d.forEach(function (x) { var n = s_(x.name || x.public_name); if (x.id && (pnocheCoincide_(n, q) || pnocheCoincide_(x.public_name, q))) out.push({ id: s_(x.id), nombre: n }); });
    if (d.length < 100) break;
  }
  return out;
}

/* El desglose del lado del anfitrión (Hospitable v2: accommodation, guest_fees, host_fees, discounts, taxes, revenue,
   montos en centavos) en partes con su monto por noche. */
function pnocheDesglose_(fin, noches) {
  var host = (fin && fin.host) || {}, moneda = s_((fin && fin.currency) || 'USD');
  var lista = function (v) { return (Array.isArray(v) ? v : v ? [v] : []).filter(function (o) { return o && typeof o === 'object' && !isNaN(Number(o.amount)); }); };
  var suma = function (arr) { return arr.reduce(function (a, o) { return a + Number(o.amount) / 100; }, 0); };
  var fees = lista(host.guest_fees), limpieza = fees.filter(function (o) { return /clean|limpi/i.test(s_(o.label || o.name)); }), otras = fees.filter(function (o) { return limpieza.indexOf(o) < 0; });
  var partes = [
    { parte: 'Tarifa de alojamiento', monto: suma(lista(host.accommodation)) },
    { parte: 'Tarifa de limpieza', monto: suma(limpieza) },
    { parte: 'Otras tarifas cobradas al huésped', monto: suma(otras) },
    { parte: 'Descuentos', monto: suma(lista(host.discounts)) },
    { parte: 'Comisión de la plataforma (Airbnb)', monto: suma(lista(host.host_fees)) },
    { parte: 'Impuestos', monto: suma(lista(host.taxes)) }
  ].filter(function (x, i) { return i < 2 || i === 4 || x.monto; });
  var pago = lista(host.revenue)[0], total = pago ? Number(pago.amount) / 100 : partes.reduce(function (a, x) { return a + x.monto; }, 0);
  partes.push({ parte: 'Pago al anfitrión (lo que queda)', monto: total });
  return { moneda: moneda, partes: partes.map(function (x) { return { parte: x.parte, total: pnocheRedondo_(x.monto), por_noche: pnocheRedondo_(x.monto / noches) }; }) };
}

function pnocheCorta_(props, dias, hoy) {
  var ini = sumarDias_(hoy, -dias), cand = [];
  for (var i = 0; i < props.length; i += 40) {
    var qs = props.slice(i, i + 40).map(function (x) { return 'properties[]=' + encodeURIComponent(x.id); }).join('&');
    for (var pg = 1; pg <= 3; pg++) {
      var r = hosp_('get', '/reservations?' + qs + '&date_query=checkin&start_date=' + ini + '&end_date=' + hoy + '&include=properties,financials&per_page=100&page=' + pg);
      if (r.code !== 200) { if (!cand.length) return { error: hospErrorTexto_(r.code) }; break; }
      ((r.json && r.json.data) || []).forEach(function (x) {
        var cur = (x.reservation_status && x.reservation_status.current) || {};
        if (/cancel|declin|expire|not_accepted|inquiry|request/i.test(s_(cur.category || x.status))) return;
        if (!/airbnb/i.test(s_(x.platform))) return;
        var ci = s_(x.arrival_date || x.check_in).slice(0, 10), co = s_(x.departure_date || x.check_out).slice(0, 10);
        if (!ci || !co || ci > hoy) return;
        cand.push({ x: x, ci: ci, co: co });
      });
      var meta = r.json && r.json.meta; if (!meta || !meta.last_page || pg >= meta.last_page) break;
    }
  }
  if (!cand.length) return { error: 'No hay reservas de Airbnb con llegada entre el ' + ini + ' y hoy en esas propiedades.' };
  var terminadas = cand.filter(function (c) { return c.co <= hoy; }), base = terminadas.length ? terminadas : cand;
  base.sort(function (a, b) { return a.co < b.co ? 1 : a.co > b.co ? -1 : 0; });
  var e = base[0], x = e.x, noches = Number(x.nights) || Math.round((new Date(e.co + 'T12:00:00') - new Date(e.ci + 'T12:00:00')) / 86400000);
  var fin = x.financials;
  if (!fin || !fin.host) { var r1 = hosp_('get', '/reservations/' + encodeURIComponent(s_(x.id)) + '?include=financials'); fin = r1.code === 200 && r1.json && r1.json.data && r1.json.data.financials; }
  var pr = (x.properties && x.properties[0]) || {};
  var out = { codigo: s_(x.code), propiedad: s_(pr.name || pr.public_name), entrada: e.ci, salida: e.co, noches: noches, terminada: e.co <= hoy, reservas_de_airbnb_en_el_periodo: cand.length };
  if (!noches || noches < 1) return Object.assign(out, { error: 'La reserva no tiene noches.' });
  if (!fin || !fin.host) return Object.assign(out, { error: 'Hospitable no trae el desglose de esta reserva.' });
  return Object.assign(out, pnocheDesglose_(fin, noches));
}

function pnocheLargo_(q) {
  var r = holaPost_({ action: 'ltList' }, 60);
  if (!r || !r.ok) return { error: 'No pude leer el largo plazo de Hola' + (r && r.error ? ' (' + r.error + ')' : '') + '.' };
  var lista = (r.list || []).filter(function (l) { return pnocheCoincide_(l.propertyName, q) || pnocheCoincide_(l.propertyCode, q); }).map(function (l) {
    var frec = s_(l.frecuencia || 'mensual'), d = frec === 'personalizado' ? (Number(l.cadaDias) || 30) : (PNOCHE_DIAS_FREC_[frec] || 30), monto = Number(l.monto) || 0;
    return { propiedad: s_(l.propertyName), estado: s_(l.estado), entrada: s_(l.entrada), salida: l.tipoFin === 'indefinido' ? 'indefinida' : s_(l.salida),
      monto: monto, moneda: s_(l.moneda || 'GTQ'), frecuencia: frec + (frec === 'personalizado' ? ' (cada ' + d + ' días)' : ''), por_noche: pnocheRedondo_(monto / d), noches_del_periodo: d, cobra_luz: !!l.cobraLuz };
  });
  lista.sort(function (a, b) { return (a.estado === 'terminada') - (b.estado === 'terminada') || (a.entrada < b.entrada ? 1 : -1); });
  return { contratos: lista, nota: lista.length ? 'Por noche = monto del periodo ÷ sus noches (mensual 30, quincenal 15, semanal 7).' : 'Hola no tiene contratos de largo plazo de esas propiedades.' };
}

function precioPorNoche_(adm, inp) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'El desglose de precios solo lo ve el administrador principal.' };
  var q = s_(inp && inp.propiedad).trim(); if (!q) return { ok: false, error: 'Dime la propiedad o el edificio (p. ej. Mónaco).' };
  var dias = Math.max(7, Math.min(120, Number(inp.dias) || 31)), hoy = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  var props = pnochePropiedades_(q), corta = props.length ? pnocheCorta_(props, dias, hoy) : { error: 'No encontré propiedades en Hospitable con «' + q + '».' };
  var largo = pnocheLargo_(q);
  return { ok: true, propiedad: q, propiedades: props.map(function (p) { return p.nombre; }), corta_airbnb: corta, largo_plazo_hola: largo,
    como_decirlo: 'Repite las cifras tal cual, con su moneda. No compares monedas distintas sin decir el tipo de cambio.' };
}
