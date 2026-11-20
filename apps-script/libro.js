/* ═══ LIBRO DE TRANSACCIONES (Alma orquestadora, T1 de #935; Juan, 20-nov-2026: «Arranca el libro») ═══════════════
   Sin dinero real: anota y mide. Cada compra o contratación que ya pasa hoy queda en la hoja ALMA_TRANSACCIONES con la
   Comisión de Alma: la real (lo que ya se cobra hoy, como el fee de Spacio) y la que habría tenido si el pago hubiera
   pasado por la Caja de Alma (spec: docs/specs/alma-orquestadora.md).
   · Anotar (herramienta libro, accion anotar; solo el principal): «anota que pagamos 300 quetzales al plomero por
     Mónaco B2» → una fila manual. Sin comisión dicha, se supone el margen LIBRO_MARGEN_PCT (Propiedad del script; 10 por
     defecto) y la fila queda real = no.
   · Importar de Mi (libroImportarMi_): del reporte del mes (rmesFilas_, reportemes.js: la misma lectura y su caché) toma
     por propiedad y mes el fee de Spacio (gestión, real = sí) y los insumos y las reparaciones (costo con comisión
     supuesta = costo × margen, real = no). La clave «mi:<propiedad>:<mes>:<parte>» va en la columna id: nunca duplica.
     Corre sola una vez al mes (aprender, desde el día 11, cuando Mi ya cerró el mes) y con el robot (libro_importar).
   · Resumen (accion resumen; robot libro_resumen): por mes, lo real y lo que habría ganado, por tipo y por propiedad,
     con el supuesto dicho («con 10 % de margen supuesto»). Solo lee el libro: nunca abre Mi.
   Nunca teléfonos ni correos: el texto se limpia antes de la celda. */
var LIBRO_HOJA_ = 'ALMA_TRANSACCIONES';
var LIBRO_CAB_ = ['id', 'fecha', 'origen', 'tipo_cliente', 'cliente', 'proveedor', 'concepto', 'propiedad', 'costo', 'moneda',
  'precio_cliente', 'tipo_comision', 'comision', 'real', 'comprobante', 'anotado_por', 'nota'];
var LIBRO_TIPOS_CLIENTE_ = ['huesped', 'socio', 'empresa', 'otro'], LIBRO_TIPOS_COMISION_ = ['margen', 'referido', 'gestion'];
var LIBRO_MARGEN_DEF_ = 10, LIBRO_MI_MESES_ = 12, LIBRO_MI_CIERRE_ = 11;   // Mi cierra el mes el día 10

function libroHoja_() { return hojaCrear_(LIBRO_HOJA_, LIBRO_CAB_); }
function libroMargenPct_() {
  var v = PropertiesService.getScriptProperties().getProperty('LIBRO_MARGEN_PCT'), n = Number(v);
  return v != null && String(v).trim() !== '' && n >= 0 && n <= 100 ? n : LIBRO_MARGEN_DEF_;
}
function libroRedondo_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
/* Sin teléfonos ni correos: el libro guarda a la persona como Alma la conoce. */
function libroLimpio_(t, max) {
  return String(t == null ? '' : t).replace(/\S+@\S+/g, '').replace(/\+?\d[\d\s().-]{6,}\d/g, '').replace(/^[=+\-@]+/, '').replace(/\s+/g, ' ').trim().slice(0, max || 120);
}
function libroMoneda_(m) {
  var t = String(m || '').toLowerCase();
  if (/usd|d[oó]lar|\$/.test(t)) return 'USD';
  if (/eur|€/.test(t)) return 'EUR';
  return 'GTQ';   // en Guatemala, sin moneda dicha: quetzales
}
function libroDinero_(n, moneda) {
  var r = libroRedondo_(Math.abs(n)), t = r.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 && r ? '-' : '') + moneda + ' ' + t;
}
/* { GTQ: 30, USD: 12 } → «USD 12.00 + GTQ 30.00» (USD primero). */
function libroMontos_(o) {
  var ks = Object.keys(o || {}).filter(function (k) { return libroRedondo_(o[k]); }).sort(function (a, b) { return a === 'USD' ? -1 : b === 'USD' ? 1 : a < b ? -1 : 1; });
  return ks.length ? ks.map(function (k) { return libroDinero_(o[k], k); }).join(' + ') : '0';
}
function libroMesDe_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM');
  var m = String(v || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : '';
}

/* Las filas del libro como objetos (columnas de LIBRO_CAB_). */
function libroFilas_() {
  var sh = libroHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, LIBRO_CAB_.length).getValues().map(function (r) {
    var o = {}; LIBRO_CAB_.forEach(function (c, j) { o[c] = r[j]; }); return o;
  });
}
function libroAgregar_(filas) {
  if (!filas.length) return;
  var lk = LockService.getScriptLock(); try { lk.waitLock(10000); } catch (x) {}
  try { var sh = libroHoja_(); sh.getRange(sh.getLastRow() + 1, 1, filas.length, LIBRO_CAB_.length).setValues(filas); }
  finally { try { lk.releaseLock(); } catch (x) {} }
}

/* Una fila manual. inp: { concepto, costo, moneda, proveedor, propiedad, cliente, tipo_cliente, tipo_comision, comision, precio_cliente, fecha, comprobante, nota }. */
function libroAnotar_(adm, inp) {
  inp = inp || {};
  var costo = libroRedondo_(inp.costo), concepto = libroLimpio_(inp.concepto), proveedor = libroLimpio_(inp.proveedor);
  if (!(costo > 0)) return { ok: false, error: 'Falta cuánto se pagó (costo). Pregúntalo.' };
  if (!concepto && !proveedor) return { ok: false, error: 'Falta qué fue o a quién se le pagó. Pregúntalo.' };
  var moneda = libroMoneda_(inp.moneda), propiedad = libroLimpio_(inp.propiedad, 80), pct = libroMargenPct_();
  var tipoC = LIBRO_TIPOS_COMISION_.indexOf(inp.tipo_comision) >= 0 ? inp.tipo_comision : 'margen';
  var tipoCli = LIBRO_TIPOS_CLIENTE_.indexOf(inp.tipo_cliente) >= 0 ? inp.tipo_cliente : (propiedad ? 'socio' : 'otro');
  var dicha = inp.comision !== undefined && inp.comision !== null && String(inp.comision).trim() !== '' && Number(inp.comision) >= 0;
  var comision = dicha ? libroRedondo_(inp.comision) : libroRedondo_(costo * pct / 100);
  var precio = Number(inp.precio_cliente) > 0 ? libroRedondo_(inp.precio_cliente) : tipoC === 'margen' ? libroRedondo_(costo + comision) : costo;
  var fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(inp.fecha || '')) ? String(inp.fecha) : Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd');
  var comp = /^https:\/\/\S+$/.test(String(inp.comprobante || '').trim()) ? String(inp.comprobante).trim() : '';
  var nota = [dicha ? '' : 'comisión supuesta: ' + pct + ' % de margen', libroLimpio_(inp.nota, 200)].filter(String).join(' · ');
  var id = 'tx' + Date.now();
  var fila = [id, fecha, 'manual', tipoCli, libroLimpio_(inp.cliente, 80) || (propiedad ? 'socio de ' + propiedad : ''), proveedor, concepto || proveedor, propiedad,
    costo, moneda, precio, tipoC, comision, 'no', comp, libroLimpio_(adm && adm.nombre, 60) || 'Alma', nota];
  libroAgregar_([fila]);
  var que = libroDinero_(costo, moneda) + (proveedor ? ' a ' + proveedor : '') + (concepto && concepto !== proveedor ? ' (' + concepto + ')' : '') + (propiedad ? ' por ' + propiedad : '');
  return { ok: true, id: id, anotado: que, comision: libroDinero_(comision, moneda), supuesta: !dicha, margen_pct: dicha ? undefined : pct,
    decir: 'Anotado en el libro: ' + que + '. ' + (dicha ? 'Comisión de Alma: ' + libroDinero_(comision, moneda) + '.' : 'Con ' + pct + ' % de margen supuesto, Alma habría ganado ' + libroDinero_(comision, moneda) + '.') + ' Sin dinero real: solo se anota.' };
}

/* ── Importar de Mi (una vez al mes, idempotente) ── */
function libroImportarMi_() {
  var hoyD = ahora_(), hoy = Utilities.formatDate(hoyD, CFG.TZ, 'yyyy-MM'), dia = Number(Utilities.formatDate(hoyD, CFG.TZ, 'd'));
  var hasta = dia >= LIBRO_MI_CIERRE_ ? hoy : rmesMasMeses_(hoy, -1), desde = rmesMasMeses_(hoy, -LIBRO_MI_MESES_);   // solo meses que Mi ya cerró
  var filasMi; try { filasMi = rmesFilas_(); } catch (e) { return { ok: false, error: 'No pude abrir el reporte del mes de Mi: ' + e.message }; }
  var sh = libroHoja_(), n = sh.getLastRow(), ya = {};
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r) { ya[String(r[0])] = 1; });
  var grupos = {}, orden = [];
  filasMi.forEach(function (f) {
    if (!(f.mes >= desde && f.mes < hasta)) return;
    var k = rmesClaveProp_(f.prop) + ':' + f.mes;
    if (!grupos[k]) { grupos[k] = { prop: f.prop, mes: f.mes, bruto: 0, fee: 0, insumos: 0, reparaciones: 0 }; orden.push(k); }
    ['bruto', 'fee', 'insumos', 'reparaciones'].forEach(function (c) { grupos[k][c] += Number(f[c]) || 0; });   // dos anuncios en el mismo mes se suman, como en Mi
  });
  var pct = libroMargenPct_(), nuevas = [], yaEstaban = 0, quien = 'Mi (reporte del mes)';
  orden.forEach(function (k) {
    var g = grupos[k], fecha = g.mes + '-01', cli = 'socio de ' + g.prop;
    var partes = [
      ['fee', g.fee, function (m) { return ['mi:' + k + ':fee', fecha, 'mi', 'socio', cli, 'Spacio AM', 'Fee de Spacio (gestión)', g.prop, '', 'USD', libroRedondo_(g.bruto), 'gestion', libroRedondo_(m), 'sí', '', quien, 'ingreso bruto del mes; el fee ya se cobra hoy']; }],
      ['insumos', g.insumos, function (m) { var c = libroRedondo_(m * pct / 100); return ['mi:' + k + ':insumos', fecha, 'mi', 'socio', cli, 'Proveedores de insumos', 'Insumos y gastos', g.prop, libroRedondo_(m), 'USD', libroRedondo_(m + c), 'margen', c, 'no', '', quien, 'comisión supuesta: ' + pct + ' % de margen']; }],
      ['reparaciones', g.reparaciones, function (m) { var c = libroRedondo_(m * pct / 100); return ['mi:' + k + ':reparaciones', fecha, 'mi', 'socio', cli, 'Técnicos y proveedores', 'Reparaciones', g.prop, libroRedondo_(m), 'USD', libroRedondo_(m + c), 'margen', c, 'no', '', quien, 'comisión supuesta: ' + pct + ' % de margen']; }]
    ];
    partes.forEach(function (p) {
      if (!(libroRedondo_(p[1]) > 0)) return;
      if (ya['mi:' + k + ':' + p[0]]) { yaEstaban++; return; }
      ya['mi:' + k + ':' + p[0]] = 1; nuevas.push(p[2](p[1]));
    });
  });
  libroAgregar_(nuevas);
  PropertiesService.getScriptProperties().setProperty('LIBRO_MI_MES', hoy);
  var meses = {}; nuevas.forEach(function (r) { meses[r[1].slice(0, 7)] = 1; });
  return { ok: true, nuevas: nuevas.length, ya_estaban: yaEstaban, meses: Object.keys(meses).sort(), desde: desde, hasta_antes_de: hasta, margen_pct: pct };
}
/* Desde aprender (cada hora): una sola vez por mes, cuando Mi ya cerró el mes anterior. */
function libroImportarSiToca_() {
  var d = ahora_(), hoy = Utilities.formatDate(d, CFG.TZ, 'yyyy-MM');
  if (Number(Utilities.formatDate(d, CFG.TZ, 'd')) < LIBRO_MI_CIERRE_) return null;
  if (PropertiesService.getScriptProperties().getProperty('LIBRO_MI_MES') === hoy) return null;
  return libroImportarMi_();
}

/* ── Resumen: por mes, lo real y lo que habría ganado, por tipo y por propiedad ── inp: { mes, meses } */
function libroResumen_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'El Libro de transacciones solo lo ve el administrador principal.' };
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM'), pedido = rmesMesPedido_(inp.mes, hoy);
  if (pedido === null) return { ok: false, error: 'No entendí el mes «' + inp.mes + '». Pregunta cuál (por ejemplo «octubre de 2026»).' };
  var filas = libroFilas_(), porMes = {}, pcts = {};
  filas.forEach(function (f) {
    var mes = libroMesDe_(f.fecha), com = Number(f.comision) || 0; if (!mes || !com) return;
    var real = /^s[ií]$/i.test(String(f.real).trim()), lado = real ? 'real' : 'supuesta', mon = String(f.moneda || 'USD'), tipo = String(f.tipo_comision || 'margen'), prop = String(f.propiedad || '') || 'sin propiedad';
    var m = porMes[mes] = porMes[mes] || { real: {}, supuesta: {}, tipos: {}, props: {}, filas: 0 };
    var suma = function (o) { o[lado][mon] = (o[lado][mon] || 0) + com; };
    m.filas++; suma(m);
    suma(m.tipos[tipo] = m.tipos[tipo] || { real: {}, supuesta: {} });
    suma(m.props[prop] = m.props[prop] || { real: {}, supuesta: {}, total: 0 }); m.props[prop].total += com;
    var p = String(f.nota || '').match(/supuesta: (\d+(?:\.\d+)?) % de margen/); if (p) pcts[p[1]] = 1;
  });
  var claves = Object.keys(porMes).sort().reverse();
  if (pedido) claves = claves.filter(function (k) { return k === pedido; });
  else claves = claves.slice(0, Math.max(1, Math.min(12, Math.round(Number(inp.meses) || 3))));
  var supuesto = Object.keys(pcts).length ? Object.keys(pcts).sort(function (a, b) { return a - b; }).join(' y ') : String(libroMargenPct_());
  var supTexto = 'con ' + supuesto + ' % de margen supuesto';
  if (!claves.length) return { ok: true, meses: [], supuesto: supTexto, decir: pedido ? 'El libro todavía no tiene nada de ' + rmesNombreMes_(pedido) + '.' : 'El libro todavía está vacío.' };
  var lista = claves.map(function (k) {
    var m = porMes[k], tipos = {};
    Object.keys(m.tipos).forEach(function (t) { tipos[t] = { real: libroMontos_(m.tipos[t].real), habria_ganado: libroMontos_(m.tipos[t].supuesta) }; });
    var props = Object.keys(m.props).sort(function (a, b) { return m.props[b].total - m.props[a].total; });
    return { mes: rmesNombreMes_(k), clave: k, real: libroMontos_(m.real), habria_ganado: libroMontos_(m.supuesta), filas: m.filas, por_tipo: tipos,
      por_propiedad: props.slice(0, 10).map(function (p) { return { propiedad: p, real: libroMontos_(m.props[p].real), habria_ganado: libroMontos_(m.props[p].supuesta) }; }),
      mas_propiedades: props.length > 10 ? props.length - 10 : undefined };
  });
  var f0 = lista[0];
  return { ok: true, fuente: 'Libro de transacciones (hoja ' + LIBRO_HOJA_ + '); sin dinero real', supuesto: supTexto, meses: lista,
    nota: '«Real» es lo que ya se cobra hoy (el fee de Spacio). «Habría ganado» es la Comisión de Alma si ese pago hubiera pasado por la Caja de Alma, ' + supTexto + ': dilo así, nunca como dinero que ya entró.',
    decir: 'En ' + f0.mes + ': comisión real ' + f0.real + '; Alma habría ganado ' + f0.habria_ganado + ' más ' + supTexto + '.' };
}

/* Herramienta libro (agente.js), chat y WhatsApp, solo el principal. */
function libroParaAlma_(adm, inp) {
  inp = inp || {};
  if (!esAdminPrincipal_(adm)) return { ok: false, error: 'El Libro de transacciones solo lo usa el administrador principal.' };
  return inp.accion === 'anotar' ? libroAnotar_(adm, inp) : libroResumen_(adm, inp);
}
