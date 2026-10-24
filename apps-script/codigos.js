/* ═══ CÓDIGOS DE ACCESO (equipo y huésped) ════════════════════════════════════════════════════════════
   Fuente única: los mismos códigos que muestra Epi en cada trabajo.
   · Equipo (limpieza, mantenimiento): hoja de Epi → pestaña Config → fila «codigos» (JSON).
       __cfg[prop] = { mode: 'permanent', permCode }  → código permanente
       __cfg[prop] = { mode: 'none' }                 → la propiedad no usa código
       codigos['AAAA-MM-DD'][prop]                    → código de la quincena que empieza ese lunes (rota cada 14 días)
       (claves de semana antiguas: compatibilidad)    → código de esa semana
       Si la propiedad tuvo códigos antes pero no tiene el de la quincena actual, NO se devuelve uno viejo (Epi tampoco).
       Último recurso: el codigoAcceso del trabajo programado en Epi para ese día.
   · Huésped (temporal): lo que el equipo o la plataforma ya le envió en su conversación (codigosEnHilo_).
   Es un puerto exacto de codigoVigente / quincenaInfo de Epi (app.jsx). */

function cdNorm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@.+\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function cdLunes_(f) {
  var p = String(f || '').slice(0, 10).split('-'), t = Date.UTC(+p[0], (+p[1]) - 1, +p[2]);
  if (isNaN(t)) return String(f || '').slice(0, 10);
  var dow = new Date(t).getUTCDay(), atras = (dow + 6) % 7;
  return new Date(t - atras * 86400000).toISOString().slice(0, 10);
}
function cdQuincena_(f) {
  var lun = cdLunes_(f), p = lun.split('-'), d1 = Date.UTC(2024, 0, 1), d2 = Date.UTC(+p[0], (+p[1]) - 1, +p[2]);
  if (isNaN(d2)) d2 = d1;
  var semanas = Math.floor(Math.round((d2 - d1) / 86400000) / 7), bloque = Math.floor(semanas / 2), ini = d1 + bloque * 14 * 86400000;
  return { key: new Date(ini).toISOString().slice(0, 10), hasta: new Date(ini + 13 * 86400000).toISOString().slice(0, 10) };
}
/* JSON de códigos de Epi (cacheado 5 min). */
function cdTabla_() {
  var c = CacheService.getScriptCache(), k = 'epi_codigos_v1', v = c.get(k);
  if (v) { try { return JSON.parse(v); } catch (e) {} }
  var sh = SpreadsheetApp.openById(CFG.SHEET_EPI_ID).getSheetByName('Config');
  var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues(), fila = vals.filter(function (r) { return String(r[0]).trim() === 'codigos'; })[0];
  var j = {}; try { j = JSON.parse(String((fila && fila[1]) || '{}')); } catch (e) { j = {}; }
  try { var txt = JSON.stringify(j); if (txt.length < 90000) c.put(k, txt, 300); } catch (e) {}
  return j;
}
/* Código del equipo para una propiedad y fecha, igual que Epi. Devuelve null si no hay. */
function codigoEquipo_(propiedad, fecha, schedules) {
  var j = cdTabla_(), k = cdNorm_(propiedad), f = String(fecha || Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd')).slice(0, 10);
  if (!k) return null;
  var cfg = (j.__cfg || {})[k];
  if (cfg && cfg.mode === 'none') return { codigo: '', tipo: 'sin código', nota: 'En Epi esta propiedad está marcada como «no usa código».' };
  if (cfg && cfg.mode === 'permanent' && String(cfg.permCode || '').trim()) return { codigo: String(cfg.permCode).trim(), tipo: 'permanente' };
  var q = cdQuincena_(f), win = j[q.key], c = win ? String(win[k] || '').trim() : '';
  if (c) return { codigo: c, tipo: 'quincena', vigente: q.key + ' al ' + q.hasta };
  var sem = j[cdLunes_(f)], cs = sem ? String(sem[k] || '').trim() : '';
  if (cs) return { codigo: cs, tipo: 'semana', vigente: 'semana del ' + cdLunes_(f) };
  var tuvo = Object.keys(j).some(function (key) { return key !== '__cfg' && j[key] && typeof j[key] === 'object' && String(j[key][k] || '').trim(); });
  if (tuvo) return { codigo: '', tipo: 'pendiente', nota: 'Todavía no se cargó en Epi el código de la quincena ' + q.key + ' al ' + q.hasta + ' (los anteriores ya no valen).' };
  var tr = (schedules || []).filter(function (x) { return x && cdNorm_(x.propiedad) === k && String(x.fecha || '').slice(0, 10) === f && String(x.codigoAcceso || '').trim(); })[0];
  if (tr) return { codigo: String(tr.codigoAcceso).trim(), tipo: 'del trabajo programado' };
  return null;
}
/* Propiedades que coinciden con lo que pidió el administrador («Bonadiez 1001», «Brunelo»). */
function cdPropiedades_(texto, nombres) {
  var t = cdNorm_(texto); if (!t) return [];
  var exacta = nombres.filter(function (n) { return cdNorm_(n) === t; });
  if (exacta.length) return exacta;
  var palabras = t.split(' ').filter(Boolean);
  var todas = nombres.filter(function (n) { var nn = ' ' + cdNorm_(n) + ' '; return palabras.every(function (p) { return nn.indexOf(p) >= 0; }); });
  if (todas.length) return todas.slice(0, 12);
  return bqBuscar_(texto, nombres, function (x) { return x; }, 6).map(function (r) { return r.item; });
}
/* Herramienta de la secretaria: códigos de equipo (y del huésped si se da su reserva). */
function codigosAcceso_(inp, cfg) {
  inp = inp || {};
  var hoy = Utilities.formatDate(ahora_(), CFG.TZ, 'yyyy-MM-dd'), fecha = String(inp.fecha || hoy).slice(0, 10);
  var out = { fecha: fecha };
  if (inp.propiedad) {
    var nombres = [];
    (cfg.props || []).forEach(function (p) { var n = propNombre_(p); if (n && nombres.indexOf(n) < 0) nombres.push(n); });
    (cfg.schedules || []).forEach(function (s) { var n = String((s && s.propiedad) || '').trim(); if (n && nombres.indexOf(n) < 0) nombres.push(n); });
    var hits = cdPropiedades_(inp.propiedad, nombres);
    if (!hits.length) return { error: 'No encontré esa propiedad en Epi.', fecha: fecha };
    out.equipo = hits.map(function (n) {
      var r = codigoEquipo_(n, fecha, cfg.schedules) || { codigo: '', tipo: 'sin dato', nota: 'Epi no tiene código cargado para esta propiedad.' };
      return { propiedad: n, codigo: r.codigo, tipo: r.tipo, vigente: r.vigente || '', nota: r.nota || '' };
    });
  }
  if (inp.codigo_reserva) {
    try {
      var conv = agResId_(inp.codigo_reserva);
      if (!conv) out.huesped = { error: 'No encontré esa reserva.' };
      else { var c = codigosEnHilo_(hiloConv_(conv).hilo || []); out.huesped = { ya_enviados: textoCodigos_(c) }; }
    } catch (e) { out.huesped = { error: 'No pude leer la conversación: ' + e }; }
  }
  if (!out.equipo && !out.huesped) return { error: 'Dime la propiedad (o el código de reserva del huésped).' };
  out.uso = 'Códigos del equipo: solo para el equipo y administradores, nunca se le dan a un huésped. Código del huésped: el que ya se le envió por su conversación.';
  return out;
}
