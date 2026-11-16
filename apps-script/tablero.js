/* ═══ TABLERO DE DATOS (#607 T-B; Juan, 16-nov-2026: «que me lo dé con datos, con gráficos… mientras Alma me vaya
   contando, debería irme enseñando») ══════════════════════════════════════════════════════════════════════════════
   Hasta hoy el tablero bento (#508) salía solo con UNA reserva, conversación, apartamento, edificio o socio: «las listas no
   son tarjetas», y las preguntas de leer de siempre (ruta, llegadas, tareas) las contestan las respuestas instantáneas sin
   pasar por la herramienta, así que casi nunca se veía nada. Aquí, una tarjeta nueva, tipo «datos», para lo que Alma
   responde con números y listas, con el mismo diseño bento de la fase 1 y cuatro piezas nuevas que pinta alma/inicio.html:
     · numero  { k, v, d, tono }       un número grande (tam s)
     · barras  { k, items:[{t, n, v}] } barras horizontales, la más larga al 100 % (n es el número; v lo que se lee)
     · linea   { k, items:[{h, t, d, tono, foto, iniciales}] }  línea de tiempo (hora → qué → quién)
     · lista   (la de #508 T2)
   Los tableros (cada uno arma solo con lo que la herramienta ya leyó; sin IA, sin Hospitable, sin hoja nueva):
     reservas (buscar_reservas con varias, llegadas y salidas del día) · mes (reporte_mes) · ruta (ruta_del_dia y la
     respuesta instantánea de ruta) · tareas (tareas_abiertas y la instantánea) · pendientes (la instantánea «¿qué tengo
     pendiente?», solo el principal) · promesas (promesas_abiertas) · cancelaciones · pedido (pedidos_en_orbita) ·
     agenda (ver_agenda, solo el principal: la primera pieza de la fase 3 personal de #508).
   Las mismas reglas de la tarjeta (tarjeta.js): solo en una llamada (tvCandidata_ con canal «llamada»), solo con un
   administrador, y en pantalla solo si la app dijo al vincular que pinta «datos» (TV_TIPOS_AVISO_): la app de antes lo
   recibe solo en el chat. Nada lleva códigos, claves, wifi, teléfonos ni correos (tvTapar_, tvSinTel_). La voz recibe
   «EN PANTALLA: …» y dice lo importante en una frase mientras el tablero lo muestra. Check: .github/tablero-datos.js. */

var TD_LISTA_MAX_ = 6, TD_LINEA_MAX_ = 8, TD_BARRAS_MAX_ = 7;

function tdTxt_(v, n) { return tvSinTel_(tvTapar_(tvTxt_(v, n))).replace(TV_CORREO_, '').trim(); }
function tdN_(n) { n = Math.round(Number(n) || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function tdHash_(o) { var s = JSON.stringify(o), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
/* «y 3 más» como último renglón, como tvRecortar_. */
function tdRecortar_(items, n) { return items.length <= n ? items : items.slice(0, n - 1).concat([{ t: '', v: 'y ' + (items.length - n + 1) + ' más', d: '' }]); }

/* La tarjeta: lo de siempre (para LlamadaVista y la app de antes: título, datos y detalle en texto) y los cuadros. */
function tdTablero_(clase, o) {
  var cuadros = (o.cuadros || []).filter(Boolean);
  if (!cuadros.length) return null;
  var datos = (o.datos || []).filter(Boolean).slice(0, 4), detalle = (o.detalle || []).filter(Boolean).slice(0, 8);
  return {
    tipo: 'datos', clase: clase, clave: 'datos:' + clase + ':' + tdHash_({ c: cuadros, t: o.titulo }), ref: clase, eti: 'Alma te muestra',
    etiqueta: o.etiqueta || 'Datos', titulo: o.titulo || '', sub: o.sub || '', chip: o.chip || '', tono: o.tono || '', foto: '', iniciales: '',
    fechas: [], datos: datos, mensajes: [], promesas: [], semana: [], detalle: detalle, conv: '', tel: '', wa: '',
    resumen: o.resumen || o.titulo || 'los datos', cabeza: o.titulo || '', cuadros: cuadros
  };
}
function tdNumero_(id, k, v, d, tono, prioridad) { return { id: id, tipo: 'numero', tam: 's', prioridad: prioridad || 2, k: k, v: String(v), d: d || '', tono: tono || '' }; }
/* Barras: de mayor a menor si orden, la más larga es el 100 %. Sin números que comparar (todo 0 o uno solo), no va. */
function tdBarras_(id, k, items, orden, prioridad) {
  var l = (items || []).filter(function (x) { return x && x.t && Number(x.n) >= 0; });
  if (orden) l = l.slice().sort(function (a, b) { return b.n - a.n; });
  l = l.slice(0, TD_BARRAS_MAX_);
  if (l.length < 2 || !l.some(function (x) { return Number(x.n) > 0; })) return null;
  return { id: id, tipo: 'barras', tam: 'ancho', prioridad: prioridad || 4, k: k, items: l.map(function (x) { return { t: tdTxt_(x.t, 28), n: Number(x.n), v: String(x.v === undefined ? x.n : x.v) }; }) };
}
function tdLinea_(id, k, items, prioridad) {
  var l = (items || []).filter(function (x) { return x && x.t; }).slice(0, TD_LINEA_MAX_);
  if (!l.length) return null;
  return { id: id, tipo: 'linea', tam: 'ancho', prioridad: prioridad || 3, k: k, items: l };
}
function tdLista_(id, k, items, chip, prioridad) {
  var l = (items || []).filter(function (x) { return x && (x.v || x.t); });
  if (!l.length) return null;
  return { id: id, tipo: 'lista', tam: 'ancho', prioridad: prioridad || 5, k: k, chip: chip || '', tono: chip ? 'aviso' : '', items: tdRecortar_(l, TD_LISTA_MAX_) };
}
function tdHoraOrden_(h) { var m = /^(\d{1,2}):(\d\d)/.exec(String(h || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; }
function tdPersona_(n) { return tdTxt_(String(n || '').split(' ')[0], 20); }

/* ── Reservas: varias de buscar_reservas, o las llegadas y salidas de un día (respuesta instantánea) ──
   lista: [{ huesped, propiedad, entrada, salida, estado }], o: { titulo, foto(huesped) } */
function tdReservas_(lista, o) {
  o = o || {}; lista = (lista || []).filter(function (x) { return x && (x.huesped || x.propiedad); });
  if (lista.length < 2 && !o.dia) return null;
  var vivas = lista.filter(function (x) { return !/cancel/i.test(String(x.estado || '')); }), canc = lista.length - vivas.length;
  var porDia = {}, orden = [];
  vivas.forEach(function (x) { var f = String(x.entrada || '').slice(0, 10); if (!f) return; if (!(f in porDia)) { porDia[f] = 0; orden.push(f); } porDia[f]++; });
  orden.sort();
  var cuadros = [tdNumero_('total', o.dia ? (o.que || 'Llegan') : 'Reservas', vivas.length, canc ? canc + (canc === 1 ? ' cancelada' : ' canceladas') : '', '', 1)];
  if (o.salidas !== undefined) cuadros.push(tdNumero_('salen', 'Salen', o.salidas.length, '', '', 1));
  if (!o.dia && orden.length >= 2) cuadros.push(tdBarras_('por_dia', 'Llegadas por día', orden.slice(0, TD_BARRAS_MAX_).map(function (f) { return { t: tvFecha_(f), n: porDia[f] }; }), false, 3));
  var fila = function (x, que) {
    var cod = String(x.codigo || '').toUpperCase(), ib = (o.inbox || []).filter(function (y) { return cod && String(y.codigo || '').toUpperCase() === cod; })[0] || {};
    var foto = /^https:\/\//.test(String(x.foto || ib.foto || '')) ? String(x.foto || ib.foto) : '';
    return { t: '', v: tdTxt_(x.huesped, 32) || 'Huésped', d: [tvLugar_(x.propiedad), que || tvRango_(x.entrada, x.salida), /cancel/i.test(String(x.estado || '')) ? 'cancelada' : ''].filter(Boolean).join(' · '),
      foto: foto, iniciales: tvIniciales_(x.huesped), tono: /cancel/i.test(String(x.estado || '')) ? 'alerta' : '' };
  };
  cuadros.push(tdLista_('lista', o.dia ? (o.que || 'Llegan') : 'Las reservas', lista.map(function (x) { return fila(x, ''); }), '', 4));
  if (o.salidas && o.salidas.length) cuadros.push(tdLista_('salidas', 'Salen', o.salidas.map(function (x) { return fila(x, ''); }), '', 5));
  var titulo = o.titulo || (vivas.length + (vivas.length === 1 ? ' reserva' : ' reservas'));
  return tdTablero_('reservas', { titulo: titulo, sub: o.sub || '', etiqueta: 'Reservas', cuadros: cuadros,
    datos: [vivas.length + (vivas.length === 1 ? ' reserva' : ' reservas') + (canc ? ' · ' + canc + ' canceladas' : '')],
    detalle: lista.slice(0, 8).map(function (x) { return tdTxt_(x.huesped, 32) + ' · ' + tvLugar_(x.propiedad) + ' · ' + tvRango_(x.entrada, x.salida); }),
    resumen: o.resumen || ('la lista de ' + vivas.length + ' reservas') });
}

/* ── El mes de un apartamento (reporte_mes): ocupación, ingreso neto, a depositar y noches; barras por mes o contra el anterior ── */
function tdMes_(r) {
  if (!r || !r.ok || !(r.meses || []).length || r.meses[0].en_reporte === false) return null;
  var m = r.meses[0], vs = m.vs_mes_anterior && typeof m.vs_mes_anterior === 'object' ? m.vs_mes_anterior : null;
  var num = function (s) { var x = /-?[\d,]+(\.\d+)?/.exec(String(s || '')); return x ? Number(x[0].replace(/,/g, '')) : NaN; };
  var cuadros = [
    tdNumero_('ocup', 'Ocupación', m.ocupacion || '–', vs ? String(vs.ocupacion || '').replace(/^.*\(([^)]+)\).*$/, '$1') : '', '', 1),
    tdNumero_('neto', 'Ingreso neto', m.ingreso_neto || '–', vs && /\(/.test(String(vs.ingreso_neto)) ? String(vs.ingreso_neto).replace(/^.*\(([^)]+)\).*$/, '$1') : '', '', 1),
    tdNumero_('dep', 'A depositar', m.monto_a_depositar || '–', '', '', 2),
    tdNumero_('noches', 'Noches · estadías', (m.noches || 0) + ' · ' + (m.estadias || 0), m.adr ? 'tarifa ' + m.adr : '', '', 2)
  ];
  var conDatos = r.meses.filter(function (x) { return x && x.en_reporte !== false; });
  if (conDatos.length >= 2) cuadros.push(tdBarras_('meses', 'Ingreso neto por mes', conDatos.slice().reverse().map(function (x) { return { t: String(x.mes || '').split(' ')[0], n: Math.max(0, num(x.ingreso_neto)), v: x.ingreso_neto }; }), false, 3));
  else if (vs) cuadros.push(tdBarras_('vs', 'Contra ' + vs.mes, [
    { t: String(vs.mes || '').split(' ')[0], n: Math.max(0, num(String(vs.ingreso_neto || '').split('→')[0])), v: String(vs.ingreso_neto || '').split('→')[0].trim() },
    { t: String(m.mes || '').split(' ')[0], n: Math.max(0, num(m.ingreso_neto)), v: m.ingreso_neto }], false, 3));
  return tdTablero_('mes', { titulo: tvLugar_(r.propiedad) + ' · ' + m.mes, sub: 'Reporte del mes de Mi', etiqueta: 'Mes', cuadros: cuadros,
    datos: ['Ocupación ' + m.ocupacion, 'Ingreso neto ' + m.ingreso_neto, 'A depositar ' + m.monto_a_depositar],
    resumen: 'el mes de ' + tvLugar_(r.propiedad) + ' (ocupación, ingreso y depósito)' });
}

/* ── La ruta del día: línea de tiempo (hora · trabajo · apartamento · quién), cuántos y por persona. Nunca el código. ──
   rt: { persona, trabajos: [{ x: {hora, tipo, propiedad, estado, entradaHoy}, quien }] } (agRutaTrabajos_) */
function tdRuta_(rt, fecha) {
  if (!rt || rt.error) return null;
  var tr = (rt.trabajos || []).slice().sort(function (a, b) { return tdHoraOrden_(a.x.hora) - tdHoraOrden_(b.x.hora); }), dia = tvCuando_(fecha);
  var todos = !rt.persona || rt.persona === 'todos', por = {};
  tr.forEach(function (t) { var q = tdPersona_(t.quien) || 'Sin asignar'; por[q] = (por[q] || 0) + 1; });
  var tent = tr.filter(function (t) { return t.x.estado === 'tentativa'; }).length;
  var cuadros = [tdNumero_('n', 'Trabajos', tr.length, tent ? tent + (tent === 1 ? ' tentativa' : ' tentativas') : '', tent ? 'aviso' : '', 1)];
  if (todos) cuadros.push(tdNumero_('personas', 'Personas', Object.keys(por).length, '', '', 1));
  if (todos) cuadros.push(tdBarras_('por_persona', 'Por persona', Object.keys(por).map(function (q) { return { t: q, n: por[q] }; }), true, 3));
  cuadros.push(tdLinea_('ruta', todos ? 'La ruta' : 'Su ruta', tr.map(function (t) {
    var x = t.x; return { h: tdTxt_(x.hora, 5), t: [tdTxt_(x.tipo, 24) || 'Trabajo', tvLugar_(x.propiedad)].filter(Boolean).join(' · '), d: [todos ? tdPersona_(t.quien) : '', x.entradaHoy ? 'tiene entrada hoy' : ''].filter(Boolean).join(' · '),
      tono: x.estado === 'tentativa' ? 'aviso' : '' };
  }), 2));
  var quien = todos ? '' : tdPersona_(rt.persona);
  return tdTablero_('ruta', { titulo: (quien ? 'Ruta de ' + quien : 'Rutas') + ' · ' + dia, etiqueta: 'Ruta del día', cuadros: cuadros,
    datos: [tr.length + (tr.length === 1 ? ' trabajo' : ' trabajos') + (todos ? ' · ' + Object.keys(por).length + ' personas' : '')],
    detalle: tr.slice(0, 8).map(function (t) { return [t.x.hora, t.x.tipo, tvLugar_(t.x.propiedad), tdPersona_(t.quien)].filter(Boolean).join(' · '); }),
    resumen: (quien ? 'la ruta de ' + quien : 'las rutas') + ' de ' + dia.toLowerCase() });
}

/* ── Tareas abiertas de Epi: cuántas, vencidas, la lista por vencimiento ── t: [{ texto, prop, quien, vence }] */
function tdTareas_(tareas, hoy) {
  var l = (tareas || []).filter(function (t) { return t && !t.hecha; }).slice().sort(function (a, b) { return String(a.vence || '9999').localeCompare(String(b.vence || '9999')); });
  hoy = hoy || tvHoy_();
  var venc = l.filter(function (t) { return t.vence && String(t.vence).slice(0, 10) < hoy; }).length, deHoy = l.filter(function (t) { return String(t.vence || '').slice(0, 10) === hoy; }).length;
  var cuadros = [tdNumero_('n', 'Tareas abiertas', l.length, '', '', 1), tdNumero_('venc', 'Vencidas', venc, deHoy ? deHoy + ' vencen hoy' : '', venc ? 'alerta' : '', 1)];
  var por = {}; l.forEach(function (t) { var q = tdPersona_(t.quien && t.quien !== '-' ? t.quien : '') || 'Sin asignar'; por[q] = (por[q] || 0) + 1; });
  cuadros.push(tdBarras_('por_persona', 'Por persona', Object.keys(por).map(function (q) { return { t: q, n: por[q] }; }), true, 3));
  cuadros.push(tdLista_('lista', 'Lo primero', l.map(function (t) {
    var v = String(t.vence || '').slice(0, 10);
    return { t: '', v: tdTxt_(t.texto, 70), d: [t.prop && t.prop !== '-' ? tvLugar_(t.prop) : '', v ? (v < hoy ? 'vencida' : v === hoy ? 'vence hoy' : 'vence ' + tvFecha_(v)) : ''].filter(Boolean).join(' · '), tono: v && v < hoy ? 'alerta' : '' };
  }), '', 4));
  return tdTablero_('tareas', { titulo: l.length ? l.length + (l.length === 1 ? ' tarea abierta' : ' tareas abiertas') : 'Sin tareas abiertas', etiqueta: 'Tareas', cuadros: cuadros,
    datos: [l.length + ' abiertas', venc + ' vencidas'], detalle: l.slice(0, 8).map(function (t) { return tdTxt_(t.texto, 70); }), resumen: 'las tareas abiertas' });
}

/* ── Lo que espera su sí en Pendientes (solo el principal): cuántos, por esfera y los primeros ── p: pendientesTodo_ */
function tdPendientes_(p) {
  if (!p || !p.ok) return null;
  var l = p.atencion || [], por = {};
  l.forEach(function (x) { var a = String(x.area || 'Alma'); por[a] = (por[a] || 0) + 1; });
  var cuadros = [tdNumero_('n', 'Esperan tu sí', l.length, '', l.length ? 'aviso' : '', 1)];
  cuadros.push(tdBarras_('por_esfera', 'Por esfera', Object.keys(por).map(function (a) { return { t: a, n: por[a] }; }), true, 3));
  cuadros.push(tdLista_('lista', 'Lo primero', l.map(function (x) { return { t: '', v: tdTxt_(x.titulo || x.resumen, 70), d: tdTxt_(x.area, 20) }; }), '', 2));
  return tdTablero_('pendientes', { titulo: l.length ? l.length + (l.length === 1 ? ' pendiente' : ' pendientes') : 'Nada esperando tu sí', etiqueta: 'Pendientes', cuadros: cuadros,
    datos: [l.length + ' esperan tu sí'], detalle: l.slice(0, 8).map(function (x) { return tdTxt_(x.titulo || x.resumen, 70); }), resumen: 'lo que espera tu sí en Pendientes' });
}

/* ── Promesas abiertas a huéspedes (hubPromesas_): cuántas, vencidas y la lista ── */
function tdPromesas_(lista) {
  var l = (lista || []).filter(Boolean), venc = l.filter(function (p) { return p.estado === 'vencida'; }).length;
  var cuadros = [tdNumero_('n', 'Promesas abiertas', l.length, '', '', 1), tdNumero_('venc', 'Vencidas', venc, '', venc ? 'alerta' : '', 1)];
  cuadros.push(tdLista_('lista', 'A quién', l.slice().sort(function (a, b) { return (b.estado === 'vencida') - (a.estado === 'vencida'); }).map(function (p) {
    return { t: '', v: tdTxt_(p.huesped, 32) || 'Huésped', d: [tdTxt_(p.que, 70), p.vence ? 'vence ' + tdTxt_(p.vence, 16) : ''].filter(Boolean).join(' · '), tono: p.estado === 'vencida' ? 'alerta' : '', iniciales: tvIniciales_(p.huesped) };
  }), '', 2));
  return tdTablero_('promesas', { titulo: l.length + (l.length === 1 ? ' promesa abierta' : ' promesas abiertas'), etiqueta: 'Promesas', cuadros: cuadros,
    datos: [l.length + ' abiertas', venc + ' vencidas'], resumen: 'las promesas abiertas a huéspedes' });
}

/* ── Cancelaciones de un rango (agCancelaciones_) ── r: { cancelaciones: [{huesped, propiedad, entrada, salida, cancelada_el}] } */
function tdCancelaciones_(r) {
  var l = (r && (r.cancelaciones || r.reservas)) || []; if (!Array.isArray(l)) return null;
  return tdTablero_('cancelaciones', { titulo: l.length + (l.length === 1 ? ' cancelación' : ' cancelaciones'), etiqueta: 'Cancelaciones',
    cuadros: [tdNumero_('n', 'Cancelaciones', l.length, '', l.length ? 'alerta' : '', 1),
      tdLista_('lista', 'Cuáles', l.map(function (x) { return { t: '', v: tdTxt_(x.huesped, 32) || 'Huésped', d: [tvLugar_(x.propiedad), tvRango_(x.entrada, x.salida)].filter(Boolean).join(' · '), tono: 'alerta', iniciales: tvIniciales_(x.huesped) }; }), '', 2)],
    datos: [l.length + ' cancelaciones'], resumen: 'las cancelaciones' });
}

/* ── Cómo va un pedido (pedidos_en_orbita): uno → su línea de pasos; varios → la lista con su estado ── */
function tdPedido_(r) {
  var l = (r && r.pedidos) || []; if (!l.length) return null;
  if (l.length === 1) {
    var x = l[0], pasos = (x.pasos_que_dio || []).map(function (p) { return { h: '', t: tdTxt_(typeof p === 'string' ? p : (p.paso || p.texto || ''), 80), d: '', tono: '' }; });
    pasos.unshift({ h: tdTxt_(x.empezo, 12), t: 'Empezó', d: tdTxt_(x.que_pidio, 80) });
    if (x.termino) pasos.push({ h: tdTxt_(x.termino, 12), t: tdTxt_(x.estado, 40), d: tdTxt_(x.lo_que_respondio || x.por_que_fallo, 100), tono: /fall/i.test(x.estado) ? 'alerta' : '' });
    else if (x.paso) pasos.push({ h: 'ahora', t: tdTxt_(x.paso, 80), d: '', tono: 'aviso' });
    return tdTablero_('pedido', { titulo: tdTxt_(x.nombre, 50) || 'Tu pedido', sub: tdTxt_(x.tipo, 60), etiqueta: 'Pedido', chip: tdTxt_(x.estado, 30),
      cuadros: [tdNumero_('estado', 'Estado', tdTxt_(x.estado, 30), tdTxt_(x.etapa, 40), /fall/i.test(x.estado) ? 'alerta' : '', 1), tdNumero_('falta', 'Falta', tdTxt_(x.que_falta || 'Nada', 60), '', '', 1),
        tdLinea_('pasos', 'Lo que va', pasos, 2)],
      datos: [tdTxt_(x.estado, 30)], resumen: 'cómo va «' + tdTxt_(x.nombre, 50) + '»' });
  }
  return tdTablero_('pedido', { titulo: l.length + ' pedidos', etiqueta: 'Pedidos', cuadros: [tdNumero_('n', 'Pedidos', l.length, '', '', 1),
    tdLista_('lista', 'Cómo van', l.map(function (x) { return { t: '', v: tdTxt_(x.nombre, 50), d: [tdTxt_(x.estado, 30), tdTxt_(x.paso, 50)].filter(Boolean).join(' · '), tono: /fall/i.test(x.estado) ? 'alerta' : '' }; }), '', 2)],
    datos: [l.length + ' pedidos'], resumen: 'cómo van tus pedidos' });
}

/* ── La agenda de Juan (ver_agenda; solo el principal, #508 fase 3 personal) ── */
function tdAgenda_(r) {
  if (!r || !r.ok) return null;
  var ev = (r.ocupado || []).slice().sort(function (a, b) { return String(a.dia).localeCompare(String(b.dia)) || tdHoraOrden_(a.de) - tdHoraOrden_(b.de); });
  var varios = r.desde !== r.hasta, libres = (r.libre || []).length;
  return tdTablero_('agenda', { titulo: 'Agenda · ' + (varios ? tvRango_(r.desde, r.hasta) : tvCuando_(r.desde)), etiqueta: 'Agenda',
    cuadros: [tdNumero_('n', 'Eventos', ev.length, '', '', 1), tdNumero_('libre', 'Huecos libres', libres, libres ? String(r.libre[0]).replace(/^\d{4}-\d\d-\d\d /, '') : '', '', 1),
      tdLinea_('dia', 'Tu día', ev.map(function (e) { return { h: tdTxt_(e.de, 12), t: tdTxt_(e.titulo, 60) || 'Evento', d: [varios ? tvFecha_(e.dia) : '', e.a ? 'hasta ' + tdTxt_(e.a, 6) : ''].filter(Boolean).join(' · ') }; }), 2)],
    datos: [ev.length + ' eventos'], resumen: 'tu agenda' });
}
