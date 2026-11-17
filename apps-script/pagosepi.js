/* ═══ PAGOS DE EPI (herramienta pagos_epi) ═══════════════════════════════════════════════════════════════════════
   Pasó el 17-nov-2026: Juan le preguntó a Alma por llamada cuánto hay que depositarle a Gabriel Asturias según el
   historial de pagos de Epi, y ella no tenía cómo verlo. Ahora lo lee de la misma hoja que usa Epi (pestaña Config:
   «pagos», «pagos_2», … y «pagos_anulados») y repite sus comprobantes tal cual.
   · Nunca se calcula ni se estima un monto: cada cifra es el neto de un comprobante de Epi.
   · «Por depositar» = comprobante sin soporte de transferencia (el administrador sube el soporte en Epi al depositar).
   · Si a alguien de planilla le falta el comprobante de una quincena ya vencida (Epi lo genera al abrir la app el
     administrador), se dice que falta, sin inventar el monto.
   · Los comprobantes anulados («pagos_anulados») no cuentan.
   · Quién la ve: solo el administrador principal (es dinero del equipo). Dinero en quetzales. */
var PGE_TAB_ = 'Config', PGE_MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function pgeNorm_(x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function pgeNum_(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function pgeQ_(n) {
  var v = Math.round(pgeNum_(n) * 100) / 100, s = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + 'Q' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
}
function pgeFecha_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(m[3]) + ' de ' + PGE_MESES_[Number(m[2]) - 1] + ' de ' + m[1] : String(iso || '');
}
/* Lee la pestaña Config de Epi: { pagos, anulados, vendors, incompleto }. Las listas grandes vienen repartidas en
   varios campos («pagos», «pagos_2», …), igual que en la app (pg_merge / v_shard). */
function pgeLeer_() {
  var filas = SpreadsheetApp.openById(CFG.SHEET_EPI_ID).getSheetByName(PGE_TAB_).getDataRange().getValues();
  var out = { pagos: [], anulados: {}, vendors: [], incompleto: false };
  filas.forEach(function (r) {
    var k = String(r[0] || '').trim(), v = r[1];
    var esPago = /^pagos(_\d+)?$/.test(k), esVend = /^vendors(_\d+)?$/.test(k), esAnul = k === 'pagos_anulados';
    if (!esPago && !esVend && !esAnul) return;
    if (v === '' || v == null) return;
    var lista = v;
    if (typeof v === 'string') { try { lista = JSON.parse(v); } catch (e) { if (esPago) out.incompleto = true; return; } }
    if (!Array.isArray(lista)) return;
    if (esPago) out.pagos = out.pagos.concat(lista);
    else if (esVend) out.vendors = out.vendors.concat(lista);
    else lista.forEach(function (p) { if (p && p.id != null) out.anulados[String(p.id)] = 1; });
  });
  var vistos = {};
  out.pagos = out.pagos.filter(function (p) {
    if (!p || (p.id != null && out.anulados[String(p.id)])) return false;
    var c = String(p.folio || p.id || ''); if (!c) return true;
    if (vistos[c]) return false; vistos[c] = 1; return true;
  });
  return out;
}
function pgeNombreVend_(v) {
  if (!v) return '';
  if (v.primerNombre) return [v.primerNombre, v.primerApellido].filter(Boolean).join(' ');
  return String(v.name || v.nombre || v.email || '');
}
/* La persona por nombre: todas las palabras pedidas están en su nombre. { email, nombre, vendor } o { error, opciones }. */
function pgePersona_(texto, d) {
  var t = pgeNorm_(texto).split(' ').filter(Boolean);
  if (!t.length) return { error: 'Dime de quién (por ejemplo «Gabriel Asturias»).' };
  var cand = {};
  function prueba(email, nombre, extra, vendor) {
    var em = String(email || '').toLowerCase().trim(), h = pgeNorm_(nombre + ' ' + (extra || ''));
    if (!nombre || !t.every(function (w) { return h.indexOf(w) >= 0; })) return;
    var c = em || 'nombre:' + pgeNorm_(nombre);
    if (!cand[c]) cand[c] = { email: em, nombre: nombre, vendor: vendor || null };
    else if (vendor && !cand[c].vendor) { cand[c].vendor = vendor; cand[c].nombre = nombre; }
  }
  d.vendors.forEach(function (v) { if (v) prueba(v.email, pgeNombreVend_(v), v.name || v.nombre || '', v); });
  d.pagos.forEach(function (p) { (p.tecnicos || []).forEach(function (tc) { prueba(tc.vendorEmail, tc.vendorName || '', ''); }); });
  var l = Object.keys(cand).map(function (k) { return cand[k]; });
  if (l.length === 1) return l[0];
  if (!l.length) return { error: 'No encontré a «' + texto + '» en el equipo ni en los pagos de Epi.' };
  return { error: 'Hay más de una persona que se parece a «' + texto + '» en Epi: pregunta cuál.', opciones: l.map(function (x) { return x.nombre; }) };
}
/* Lo de esa persona en un comprobante (los de lote traen a varios técnicos): { bruto, adelanto, neto } o null. */
function pgeSuyo_(p, per) {
  var nm = pgeNorm_(per.nombre);
  var es = function (em, n) { em = String(em || '').toLowerCase().trim(); return per.email ? em === per.email : pgeNorm_(n) === nm; };
  var tcs = (p.tecnicos || []).filter(function (tc) { return es(tc.vendorEmail, tc.vendorName); });
  if (tcs.length) return tcs.reduce(function (s, tc) {
    var b = pgeNum_(tc.subtotal), a = pgeNum_(tc.adelanto);
    return { bruto: s.bruto + b, adelanto: s.adelanto + a, neto: s.neto + (tc.neto != null ? pgeNum_(tc.neto) : b - a) };
  }, { bruto: 0, adelanto: 0, neto: 0 });
  if (p.nomina && per.email && String(p.nomina.email || '').toLowerCase() === per.email)
    return { bruto: pgeNum_(p.totalBruto), adelanto: pgeNum_(p.totalDescuento), neto: pgeNum_(p.totalNeto) };
  return null;
}
function pgeTipo_(t) { return t === 'nomina' ? 'Planilla' : t === 'bono14' ? 'Bono 14' : t === 'aguinaldo' ? 'Aguinaldo' : t === 'individual' ? 'Individual' : 'Lote'; }
function pgeDepositado_(p) { var s = p && p.soporte; return !!(s && (s.url || s.name || s.data)); }
function pgeIso_(y, m, d) { return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }
/* Quincenas de planilla ya vencidas (día de pago entre desde y hoy) sin comprobante en Epi. Mismas fechas que Epi
   (nomPeriodos): la 1.ª se paga el 15 y la 2.ª el 30 (o el último día del mes). */
function pgeFaltantes_(per, pagos, hoy) {
  var v = per.vendor;
  if (!v || v.tipo !== 'interno' || !v.planilla || v.active === false || !(pgeNum_(v.salarioBase) > 0) || !per.email) return [];
  var desde = String(v.planillaDesde || v.inicioLaboral || '').slice(0, 10), min = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde < min) desde = min;   // solo este mes y el anterior: lo viejo ya se revisó en Epi
  var hay = {}; pagos.forEach(function (p) { if (p && p.nomKey) hay[p.nomKey] = 1; });
  var out = [], y = Number(desde.slice(0, 4)), m = Number(desde.slice(5, 7)) - 1;
  for (var g = 0; g < 12; g++) {
    var ld = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), mm = ('0' + (m + 1)).slice(-2);
    [{ k: y + '-' + mm + '-Q1', pago: pgeIso_(y, m, 15), label: '1–15 de ' + PGE_MESES_[m] + ' de ' + y },
     { k: y + '-' + mm + '-Q2', pago: pgeIso_(y, m, Math.min(30, ld)), label: '16–' + ld + ' de ' + PGE_MESES_[m] + ' de ' + y }].forEach(function (q) {
      if (q.pago >= desde && q.pago <= hoy && !hay[per.email + '|' + q.k]) out.push('Quincena ' + q.label + ' (se paga el ' + pgeFecha_(q.pago) + ')');
    });
    if (y + '-' + mm >= hoy.slice(0, 7)) break;
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}

/* Herramienta pagos_epi. inp: { persona, cuantos }. */
function pagosEpi_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Los pagos del equipo en Epi solo los ve el administrador principal.' };
  var d; try { d = pgeLeer_(); } catch (e) { return { ok: false, error: 'No pude abrir el historial de pagos de Epi: ' + e.message + '. No lo calcules por tu cuenta.' }; }
  var per = pgePersona_(inp.persona, d);
  if (per.error) return { ok: false, error: per.error, opciones: per.opciones };
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');
  var suyos = [];
  d.pagos.forEach(function (p) { var s = pgeSuyo_(p, per); if (s) suyos.push({ p: p, s: s }); });
  suyos.sort(function (a, b) { return String(b.p.fechaPago || '').localeCompare(String(a.p.fechaPago || '')) || (pgeNum_(b.p.createdAt) - pgeNum_(a.p.createdAt)); });
  var ficha = function (x) {
    var p = x.p;
    return { folio: p.folio || '', tipo: pgeTipo_(p.tipo), periodo: (p.nomina && p.nomina.label) || (p.rangoDesde ? pgeFecha_(p.rangoDesde) + ' al ' + pgeFecha_(p.rangoHasta) : ''),
      fecha_de_pago: pgeFecha_(p.fechaPago), bruto: pgeQ_(x.s.bruto), descuento_adelanto: pgeQ_(x.s.adelanto), neto: pgeQ_(x.s.neto),
      depositado: pgeDepositado_(p) ? 'sí (tiene soporte de transferencia)' : 'no (sin soporte de transferencia)' };
  };
  var pend = suyos.filter(function (x) { return !pgeDepositado_(x.p); });
  var total = Math.round(pend.reduce(function (a, x) { return a + x.s.neto; }, 0) * 100) / 100;
  var faltan = pgeFaltantes_(per, d.pagos, hoy);
  var n = Math.max(1, Math.min(24, Math.round(Number(inp.cuantos) || 6)));
  var decir;
  if (pend.length) decir = 'A ' + per.nombre + ' hay que depositarle ' + pgeQ_(total) + ': ' + pend.map(function (x) { return (x.p.nomina && x.p.nomina.label ? 'la quincena ' + x.p.nomina.label : 'el comprobante ' + (x.p.folio || '')) + ' (' + pgeQ_(x.s.neto) + ')'; }).join(', ') + ', sin soporte de transferencia en Epi.';
  else if (suyos.length) decir = per.nombre + ' no tiene comprobantes pendientes de depositar en Epi; el último (' + (suyos[0].p.folio || pgeFecha_(suyos[0].p.fechaPago)) + ', ' + pgeQ_(suyos[0].s.neto) + ') ya tiene soporte.';
  else decir = per.nombre + ' no tiene comprobantes de pago en Epi.';
  if (faltan.length) decir += ' Ojo: a Epi le falta el comprobante de ' + faltan.join(' y ') + '; se genera al abrir Epi como administrador. No lo calcules.';
  return { ok: true, persona: per.nombre, fuente: 'Historial de pagos de Epi (hoja de Epi, Config «pagos»), en quetzales',
    regla: 'Por depositar = comprobante sin soporte de transferencia. Cada cifra es el neto del comprobante de Epi (ya trae el descuento de adelanto); no se estima nada.',
    por_depositar: { total: pgeQ_(total), comprobantes: pend.map(ficha) }, faltan_comprobantes: faltan.length ? faltan : undefined,
    historial: suyos.slice(0, n).map(ficha), total_comprobantes: suyos.length,
    aviso: d.incompleto ? 'Una parte del historial de pagos de Epi no se pudo leer: dilo y pide revisar en Epi.' : undefined,
    decir: decir };
}
