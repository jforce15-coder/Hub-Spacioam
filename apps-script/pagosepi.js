/* ═══ PAGOS DE EPI (solo lectura) ═══════════════════════════════════════════════════════════════════════════
   Pedido de Juan (17-nov-2026, pc1794937112685): «Buscar en Epi en el historial de pagos de Gabriel Asturias el monto
   exacto pendiente de depositarle». Alma no tenía cómo leer el historial de pagos de Epi; con `pagos_epi` lo lee.

   De dónde sale (Epi-spacioam, app.jsx):
   · Historial de pagos: los comprobantes viven en la config de Epi repartidos en «pagos», «pagos_2»… (pg_merge); los
     anulados («pagos_anulados») no cuentan.
   · Un comprobante está **depositado** cuando tiene su soporte (la imagen o el PDF de la transferencia que sube el
     administrador después de pagar). Sin soporte = **pendiente de depositar**. Es el único dato que Epi guarda del depósito.
   · El monto de cada persona es su neto en el comprobante (bruto menos el descuento de adelanto).
   · Adelantos de planilla: saldo = monto − lo debitado en comprobantes (nomina.advDebitos) + ajustes (advPlanillaDe).
   Solo lee: nunca escribe en Epi. Solo el administrador principal (es dinero del equipo).
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var PAGOS_EPI_MAX_ = 12;   // cuántos comprobantes recientes se listan (los pendientes van todos)

function pagosEpiNorm_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function pagosEpiNum_(x) { var n = parseFloat(x); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
function pagosEpiQ_(n) { return 'Q' + pagosEpiNum_(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function pagosEpiLista_(x) { if (Array.isArray(x)) return x; try { var p = JSON.parse(x); return Array.isArray(p) ? p : []; } catch (e) { return []; } }

/* Une el historial como lo hace la app (pg_merge): pagos + pagos_2…, sin repetidos ni anulados, lo más nuevo primero. */
function pagosEpiHistorial_(cfg) {
  var anul = {}; pagosEpiLista_(cfg.pagos_anulados).forEach(function (p) { if (p && p.id != null) anul[String(p.id)] = 1; });
  var todos = pagosEpiLista_(cfg.pagos), n = parseInt(cfg.pagos_n, 10) || 1;
  for (var i = 2; i <= Math.max(n, 12); i++) todos = todos.concat(pagosEpiLista_(cfg['pagos_' + i]));
  var vistos = {}, out = [];
  todos.forEach(function (p) {
    if (!p || (p.id != null && anul[String(p.id)])) return;
    var k = String(p.folio || p.id || ('x' + out.length)); if (vistos[k]) return; vistos[k] = 1; out.push(p);
  });
  out.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  return out;
}

/* El nombre como lo muestra Epi (vendorDisplay). */
function pagosEpiNombre_(v) {
  if (v.tipo === 'externo' && v.empresa && String(v.empresa).trim()) return String(v.empresa).trim();
  if (v.primerNombre) return [v.primerNombre, v.primerApellido].filter(Boolean).join(' ');
  return String(v.name || v.nombre || v.email || '').trim();
}
/* La persona del equipo de Epi que coincide con el nombre (o correo) que dijo Juan. */
function pagosEpiPersona_(vendors, quien) {
  var q = pagosEpiNorm_(quien); if (!q) return [];
  var nom = function (v) { return pagosEpiNorm_(pagosEpiNombre_(v) + ' ' + (v.name || v.nombre || '') + ' ' + (v.empresa || '')); };
  var exactos = vendors.filter(function (v) { return pagosEpiNorm_(v.email) === q || pagosEpiNorm_(v.name || v.nombre) === q || pagosEpiNorm_(pagosEpiNombre_(v)) === q; });
  if (exactos.length) return exactos;
  var palabras = q.split(' ');
  return vendors.filter(function (v) { var t = nom(v); return palabras.every(function (w) { return t.indexOf(w) >= 0; }); });
}

function pagosEpi_(adm, inp) {
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal ve los pagos del equipo.' };
  inp = inp || {};
  var quien = String(inp.persona || '').trim();
  if (!quien) return { ok: false, error: 'Dime de quién son los pagos.' };
  var j, cfg;
  try { j = epiPost_('getConfig', { slim: true }); cfg = j.data || j; } catch (e) { return { ok: false, error: 'No pude leer Epi: ' + e.message }; }
  var vendors = pagosEpiLista_(cfg.vendors);
  for (var i = 2; i <= (parseInt(cfg.vendors_n, 10) || 1); i++) vendors = vendors.concat(pagosEpiLista_(cfg['vendors_' + i]));
  vendors = vendors.filter(function (v) { return v && typeof v === 'object'; });
  var cand = pagosEpiPersona_(vendors, quien);
  if (!cand.length) return { ok: false, error: 'No encontré a «' + quien + '» en el equipo de Epi.' };
  if (cand.length > 1) return { ok: false, error: 'Hay varias personas con ese nombre en Epi: ' + cand.slice(0, 4).map(pagosEpiNombre_).join(', ') + '. ¿Cuál?' };
  var v = cand[0], email = pagosEpiNorm_(v.email), nombre = pagosEpiNombre_(v), nNom = pagosEpiNorm_(v.name || v.nombre);
  var nDisp = pagosEpiNorm_(nombre);
  var esSuyo = function (t) { var tn = pagosEpiNorm_(t && t.vendorName); return t && ((email && pagosEpiNorm_(t.vendorEmail) === email) || (tn && (tn === nNom || tn === nDisp))); };

  var hist = pagosEpiHistorial_(cfg), suyos = [];
  hist.forEach(function (p) {
    var ts = (p.tecnicos || []).filter(esSuyo); if (!ts.length) return;
    var neto = ts.reduce(function (s, t) { return s + pagosEpiNum_(t.neto); }, 0), bruto = ts.reduce(function (s, t) { return s + pagosEpiNum_(t.subtotal); }, 0);
    var desc = ts.reduce(function (s, t) { return s + pagosEpiNum_(t.adelanto); }, 0);
    var tipo = p.tipo === 'nomina' ? 'Planilla' : p.tipo === 'bono14' ? 'Bono 14' : p.tipo === 'aguinaldo' ? 'Aguinaldo' : p.tipo === 'individual' ? 'Individual' : 'Lote';
    suyos.push({ folio: p.folio || '', tipo: tipo, fecha_pago: String(p.fechaPago || '').slice(0, 10), periodo: (p.nomina && p.nomina.label) || ((p.rangoDesde || '') + (p.rangoHasta && p.rangoHasta !== p.rangoDesde ? ' a ' + p.rangoHasta : '')),
      bruto: pagosEpiNum_(bruto), descuento_adelanto: pagosEpiNum_(desc), neto: pagosEpiNum_(neto), depositado: !!(p.soporte && (p.soporte.url || p.soporte.data || p.soporte.name)) });
  });
  var pend = suyos.filter(function (c) { return !c.depositado; });
  var totalPend = pagosEpiNum_(pend.reduce(function (s, c) { return s + c.neto; }, 0));

  /* Adelantos de planilla vivos (como advPlanillaDe en Epi). */
  var debitado = function (advId) { return hist.reduce(function (s, p) { return s + ((p.nomina && p.nomina.advDebitos) || []).reduce(function (t, d) { return t + (d.advId === advId ? pagosEpiNum_(d.monto) : 0); }, 0); }, 0); };
  var adelantos = pagosEpiLista_(cfg.adelantos).filter(function (a) { return a && a.status === 'activo' && email && pagosEpiNorm_(a.vendorEmail) === email; }).map(function (a) {
    var rev = (a.ajustes || []).reduce(function (s, x) { return s + pagosEpiNum_(x.monto); }, 0);
    var planilla = a.modo === 'quincenal';
    return { monto: pagosEpiNum_(a.monto), saldo: planilla ? pagosEpiNum_(Math.max(0, pagosEpiNum_(a.monto) - debitado(a.id) + rev)) : null, cuota: pagosEpiNum_(planilla ? a.cobroQuincenal : a.cobroSemanal), modo: planilla ? 'quincenal' : 'semanal' };
  });

  return {
    ok: true, persona: nombre, planilla: !!(v.tipo === 'interno' && v.planilla),
    pendiente_de_depositar: totalPend, pendiente_texto: pagosEpiQ_(totalPend),
    comprobantes_pendientes: pend,
    ultimos_comprobantes: suyos.slice(0, PAGOS_EPI_MAX_), total_comprobantes: suyos.length,
    adelantos: adelantos,
    como_se_cuenta: 'Pendiente de depositar = suma del neto de sus comprobantes de Epi que todavía no tienen soporte de la transferencia. Si ya se le depositó y falta subir el soporte, aparece como pendiente.',
    nota: suyos.length ? '' : 'No tiene comprobantes en el historial de pagos de Epi. Los de planilla se generan cuando un administrador abre Epi después del día de pago.'
  };
}
