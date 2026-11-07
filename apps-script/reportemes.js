/* ═══ REPORTE DEL MES (herramienta reporte_mes) ═══════════════════════════════════════════════════════════════════
   Pasó el 7-nov-2026: Juan le preguntó a Alma por WhatsApp la ocupación de octubre de «Z4 - Rue - 301» y ella contestó
   26 %. La real es 83.9 % (26 noches de 31): tomó las noches como porcentaje, porque no tenía de dónde leer el reporte
   del mes y lo armó a mano. Ahora lo lee de la misma hoja que usa Mi (pestaña Resumenconsolidado) y repite sus cifras.
   · Nunca se calcula ni se estima: un mes que no está en la hoja devuelve «todavía no está en el reporte».
   · Cada estadía cuenta en el mes en que EMPIEZA (así cierra Mi): por eso el calendario noche por noche puede dar otras
     noches (en octubre hubo 28 ocupadas, porque la estadía del 29-sep al 3-oct cuenta en septiembre).
   · Ocupación = la ajustada (si falta, la total). Llega como fracción (0.8387) o como texto con % («83.87%»): sin % y
     hasta 1.5 es fracción; si no, es un porcentaje.
   · Monto a depositar = Ingreso Neto 2 si es mayor que 0; si no, Ingreso Neto (igual que Mi, sheets.js).
   · Si una propiedad tiene dos filas en el mismo mes (dos anuncios), se suman como en Mi.
   · Quién la ve: solo el administrador principal. El Hub no tiene un permiso de finanzas para el resto del equipo, y los
     socios no llegan a las herramientas de Alma (el Hub no sabe su Usuario ID de Mi).
   · La hoja se lee una vez y queda en caché 5 minutos (solo las columnas que se usan), para que una pregunta con
     comparaciones no la lea varias veces. Dinero en USD. */
var RMES_HOJA_ = '1l9wLH8880NlN9ac2jvne2U6cqej6gycqAD77Z25cLF4', RMES_TAB_ = 'Resumenconsolidado', RMES_CACHE_S_ = 300;
var RMES_MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var RMES_NO_ESTA_ = 'Ese mes todavía no está en el reporte (se cierra el día 10)';
var RMES_REGLA_ = 'Cada estadía cuenta completa en el mes en que empieza, como cierra Mi. Por eso el calendario noche por noche puede dar otras noches: una estadía del 29 de septiembre al 3 de octubre cuenta en septiembre.';
/* Columnas que se leen (encabezado sin tildes ni mayúsculas → campo). */
var RMES_COLS_ = { 'usuario id': 'usuario', 'property_name': 'prop', 'mes': 'mes', 'noches': 'noches', 'estadias': 'estadias', 'ingreso bruto': 'bruto',
  'fee spacio': 'fee', 'insumos & gastos': 'insumos', 'reparaciones': 'reparaciones', 'ingreso neto': 'neto', 'ingreso neto 2': 'neto2',
  'precio prom': 'adr', 'ocupacion ajustada': 'ocupAj', 'ocupacion': 'ocup' };

function rmesNorm_(x) { return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function rmesClaveProp_(x) { return rmesNorm_(x).replace(/[\s\-–—_]/g, ''); }
function rmesNum_(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
/* Ocupación → fracción (0 a 1). «83.87%» → 0.8387; 0.8387 → 0.8387; 83.87 (sin %) → 0.8387. Vacía → null. */
function rmesFraccion_(v) {
  if (v === '' || v == null) return null;
  var conPct = typeof v === 'string' && v.indexOf('%') >= 0, n = rmesNum_(v);
  if (typeof v === 'string' && !/\d/.test(v)) return null;
  return conPct || n > 1.5 ? n / 100 : n;
}
/* «octubre de 2026», «Octubre 2026», «2026-10» o una fecha de la hoja → «2026-10». */
function rmesClaveMes_(v) {
  if (v instanceof Date) return Utilities.formatDate(new Date(v.getTime() + 43200000), CFG.TZ, 'yyyy-MM');   // +12 h: el día 1 a medianoche no cae en el mes anterior por la zona
  var t = rmesNorm_(v), m = t.match(/^(\d{4})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
  m = t.match(/([a-z]+)\s+(?:de\s+|del\s+)?(\d{4})/);
  var i = m ? rmesMesIndice_(m[1]) : -1;
  return i >= 0 ? m[2] + '-' + ('0' + (i + 1)).slice(-2) : '';
}
function rmesMesIndice_(w) {
  w = rmesNorm_(w); if (w === 'setiembre') w = 'septiembre';
  if (w.length < 3) return -1;
  for (var i = 0; i < 12; i++) if (RMES_MESES_[i] === w || RMES_MESES_[i].indexOf(w) === 0) return i;
  return -1;
}
function rmesMasMeses_(clave, n) {
  var y = Number(clave.slice(0, 4)), m = Number(clave.slice(5, 7)) - 1 + n;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + '-' + ('0' + (m + 1)).slice(-2);
}
function rmesNombreMes_(clave) { return RMES_MESES_[Number(clave.slice(5, 7)) - 1] + ' de ' + clave.slice(0, 4); }
function rmesDias_(clave) { return new Date(Date.UTC(Number(clave.slice(0, 4)), Number(clave.slice(5, 7)), 0)).getUTCDate(); }

/* Lo que pide la persona → «AAAA-MM», '' (sin mes: el último cerrado) o null (no se entiende). hoy = «AAAA-MM». */
function rmesMesPedido_(texto, hoy) {
  var t = rmesNorm_(texto);
  if (!t) return '';
  if (/^\d{4}-\d{1,2}$/.test(t)) return t.slice(0, 5) + ('0' + t.slice(5)).slice(-2);
  var palabras = t.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/), i = -1, y = '';
  palabras.forEach(function (w) { if (/^\d{4}$/.test(w)) y = w; else if (i < 0 && w !== 'de' && w !== 'del') i = rmesMesIndice_(w); });
  if (i < 0) {   // sin nombre de mes: «el mes pasado», «el antepasado», «este mes», «el último cerrado»
    if (/antepasado/.test(t)) return rmesMasMeses_(hoy, -2);
    if (/pasado|anterior/.test(t)) return rmesMasMeses_(hoy, -1);
    if (/este mes|mes actual/.test(t)) return hoy;
    if (/ultimo|cerrado/.test(t)) return '';
    return null;
  }
  if (!y) { var yh = Number(hoy.slice(0, 4)); y = String(i + 1 > Number(hoy.slice(5, 7)) ? yh - 1 : yh); }   // «octubre» = el último octubre que ya pasó o corre
  return y + '-' + ('0' + (i + 1)).slice(-2);
}

/* La hoja de Mi, solo las columnas que se usan: [{ usuario, prop, mes: 'AAAA-MM', noches, …, ocupAj (fracción o null) }]. */
function rmesFilas_() {
  var c = CacheService.getScriptCache(), k = 'rmes_v1';
  try {
    var n = Number(c.get(k + '_n') || 0);
    if (n > 0) {
      var ks = []; for (var i = 0; i < n; i++) ks.push(k + '_' + i);
      var got = c.getAll(ks);
      if (ks.every(function (x) { return got[x] != null; })) return JSON.parse(ks.map(function (x) { return got[x]; }).join(''));
    }
  } catch (e) {}
  var sh = SpreadsheetApp.openById(RMES_HOJA_).getSheetByName(RMES_TAB_);
  if (!sh) throw new Error('no encontré la pestaña ' + RMES_TAB_ + ' en la hoja de Mi');
  var v = sh.getDataRange().getValues(); if (v.length < 2) return [];
  var idx = {}; v[0].forEach(function (h, j) { var f = RMES_COLS_[rmesNorm_(h)]; if (f && idx[f] == null) idx[f] = j; });
  if (idx.prop == null || idx.mes == null) throw new Error('la pestaña ' + RMES_TAB_ + ' no tiene Property_name o Mes');
  var filas = [];
  v.slice(1).forEach(function (r) {
    var prop = String(r[idx.prop] || '').trim(), mes = rmesClaveMes_(r[idx.mes]);
    if (!prop || !mes) return;
    var o = { usuario: idx.usuario != null ? String(r[idx.usuario] || '').trim() : '', prop: prop, mes: mes };
    ['noches', 'estadias', 'bruto', 'fee', 'insumos', 'reparaciones', 'neto', 'neto2', 'adr'].forEach(function (f) { o[f] = idx[f] != null ? rmesNum_(r[idx[f]]) : 0; });
    o.ocupAj = idx.ocupAj != null ? rmesFraccion_(r[idx.ocupAj]) : null;
    if (o.ocupAj == null && idx.ocup != null) o.ocupAj = rmesFraccion_(r[idx.ocup]);
    filas.push(o);
  });
  try {
    var s = JSON.stringify(filas), partes = {}, np = Math.ceil(s.length / 90000);
    for (var p = 0; p < np; p++) partes[k + '_' + p] = s.slice(p * 90000, (p + 1) * 90000);
    partes[k + '_n'] = String(np);
    c.putAll(partes, RMES_CACHE_S_);
  } catch (e) { console.error('rmes caché: ' + e); }
  return filas;
}

/* Las filas de una propiedad en un mes, sumadas como en Mi. null si no hay ninguna. */
function rmesMes_(filas, clave) {
  var del = filas.filter(function (f) { return f.mes === clave; });
  if (!del.length) return null;
  var a = { noches: 0, estadias: 0, bruto: 0, fee: 0, insumos: 0, reparaciones: 0, neto: 0, neto2: 0, adrN: 0, disp: 0, sinOcup: false };
  del.forEach(function (f) {
    ['noches', 'estadias', 'bruto', 'fee', 'insumos', 'reparaciones', 'neto', 'neto2'].forEach(function (k) { a[k] += f[k]; });
    a.adrN += f.adr * f.noches;
    if (f.ocupAj > 0) a.disp += f.noches / f.ocupAj;
    else if (f.ocupAj === 0 && !f.noches) a.disp += rmesDias_(clave);
    else a.sinOcup = true;   // sin ocupación en la hoja: no se inventa
  });
  var ocup = a.sinOcup ? null : del.length === 1 ? (del[0].ocupAj || 0) : (a.disp ? a.noches / a.disp : 0);
  return { clave: clave, noches: a.noches, estadias: a.estadias, ocup: ocup, adr: del.length === 1 ? del[0].adr : (a.noches ? a.adrN / a.noches : 0),
    bruto: a.bruto, fee: a.fee, gastos: a.insumos + a.reparaciones, neto: a.neto, deposito: a.neto2 > 0 ? a.neto2 : a.neto };
}

function rmesUsd_(n) {
  var r = Math.round(Math.abs(n) * 100) / 100, t = r.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 && r ? '-' : '') + 'USD ' + t;
}
function rmesPct_(f) { return f == null ? 'sin dato en el reporte' : (Math.round(f * 1000) / 10).toFixed(1) + '%'; }
function rmesSigno_(n, dec) { var r = Number(n.toFixed(dec)); return (r > 0 ? '+' : '') + r.toFixed(dec); }

/* Un mes listo para repetir, con su comparación contra el mes anterior. */
function rmesFicha_(m, ant) {
  var o = { mes: rmesNombreMes_(m.clave), noches: m.noches, estadias: m.estadias, ocupacion: rmesPct_(m.ocup), adr: rmesUsd_(m.adr),
    ingreso_bruto: rmesUsd_(m.bruto), fee_spacio: rmesUsd_(m.fee), gastos: rmesUsd_(m.gastos), ingreso_neto: rmesUsd_(m.neto), monto_a_depositar: rmesUsd_(m.deposito) };
  if (!ant) { o.vs_mes_anterior = rmesNombreMes_(rmesMasMeses_(m.clave, -1)) + ' no está en el reporte'; return o; }
  var pctNeto = ant.neto ? ' (' + rmesSigno_((m.neto - ant.neto) / Math.abs(ant.neto) * 100, 1) + '%)' : '';
  o.vs_mes_anterior = { mes: rmesNombreMes_(ant.clave),
    ocupacion: rmesPct_(ant.ocup) + ' → ' + rmesPct_(m.ocup) + (m.ocup != null && ant.ocup != null ? ' (' + rmesSigno_((m.ocup - ant.ocup) * 100, 1) + ' puntos)' : ''),
    noches: ant.noches + ' → ' + m.noches + ' (' + rmesSigno_(m.noches - ant.noches, 0) + ')',
    ingreso_neto: rmesUsd_(ant.neto) + ' → ' + rmesUsd_(m.neto) + pctNeto,
    monto_a_depositar: rmesUsd_(ant.deposito) + ' → ' + rmesUsd_(m.deposito) };
  return o;
}

/* La propiedad de la hoja que pidió la persona: igual sin espacios ni guiones, o la búsqueda flexible (buscar.js). */
function rmesPropiedad_(texto, nombres) {
  var k = rmesClaveProp_(texto); if (!k) return { error: 'Falta la propiedad.' };
  var igual = nombres.filter(function (x) { return rmesClaveProp_(x) === k; });
  if (igual.length) return { nombre: igual[0] };
  var r = bqBuscar_(texto, nombres, function (x) { return x; }, 6), ex = r.filter(function (x) { return x.coincidencia === 'exacta'; });
  if (ex.length === 1) return { nombre: ex[0].item };
  if (!ex.length && r.length && r[0].puntaje >= 0.9 && (!r[1] || r[1].puntaje < r[0].puntaje)) return { nombre: r[0].item, parecida: true };
  if (!r.length) return { error: 'No encontré «' + texto + '» en el reporte del mes.' };
  return { error: 'Hay más de una propiedad que se parece a «' + texto + '»: pregunta cuál.', opciones: r.map(function (x) { return x.item; }) };
}

/* Herramienta reporte_mes. inp: { propiedad, mes, meses }. */
function reporteMes_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'El reporte del mes (ingresos, ocupación y depósitos) solo lo ve el administrador principal.' };
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM'), pedido = rmesMesPedido_(inp.mes, hoy);
  if (pedido === null) return { ok: false, error: 'No entendí el mes «' + inp.mes + '». Pregunta cuál (por ejemplo «octubre de 2026»).' };
  var filas; try { filas = rmesFilas_(); } catch (e) { return { ok: false, error: 'No pude abrir el reporte del mes de Mi: ' + e.message + '. No lo calcules por tu cuenta.' }; }
  var nombres = []; filas.forEach(function (f) { if (nombres.indexOf(f.prop) < 0) nombres.push(f.prop); });
  var p = rmesPropiedad_(inp.propiedad, nombres);
  if (p.error) return { ok: false, error: p.error, opciones: p.opciones };
  var suyas = filas.filter(function (f) { return rmesClaveProp_(f.prop) === rmesClaveProp_(p.nombre); });
  var mes = pedido;
  if (!mes) {   // sin mes: el último que ya está en el reporte, sin contar el mes en curso
    suyas.forEach(function (f) { if (f.mes < hoy && f.mes > mes) mes = f.mes; });
    if (!mes) return { ok: false, error: RMES_NO_ESTA_ + ': ' + p.nombre + ' todavía no tiene meses cerrados.' };
  }
  var principal = rmesMes_(suyas, mes);
  if (!principal) {
    var hayMes = filas.some(function (f) { return f.mes === mes; });
    return { ok: false, mes: rmesNombreMes_(mes), propiedad: p.nombre,
      error: hayMes ? p.nombre + ' no tiene fila en el reporte de ' + rmesNombreMes_(mes) + '. No lo calcules ni lo estimes.' : RMES_NO_ESTA_ + '. No lo calcules ni lo estimes.' };
  }
  var n = Math.max(1, Math.min(12, Math.round(Number(inp.meses) || 1))), lista = [];
  for (var i = 0; i < n; i++) {
    var clave = rmesMasMeses_(mes, -i), m = i ? rmesMes_(suyas, clave) : principal;
    lista.push(m ? rmesFicha_(m, rmesMes_(suyas, rmesMasMeses_(clave, -1))) : { mes: rmesNombreMes_(clave), en_reporte: false });
  }
  var f0 = lista[0];
  return { ok: true, propiedad: p.nombre, nota: p.parecida ? 'Pidieron «' + inp.propiedad + '» y la más parecida en el reporte es ' + p.nombre + ': dilo.' : undefined,
    fuente: 'Reporte del mes de Mi (Resumenconsolidado), en USD', regla: RMES_REGLA_, meses: lista,
    decir: p.nombre + ' en ' + f0.mes + ': ' + f0.ocupacion + ' de ocupación (' + f0.noches + ' noches, ' + f0.estadias + ' estadías), ingreso neto ' + f0.ingreso_neto + ', a depositar ' + f0.monto_a_depositar + '.' };
}
