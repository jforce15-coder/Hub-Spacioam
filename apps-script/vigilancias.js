/* ═══ VIGILANCIAS: Alma vigila por ti, sin IA mientras espera (issue #396, T2) ══════════════════════════════════════
   Idea del «Watch for me» de Atticus (github.com/SaarthurR/atticus-mac, MIT): la IA arma la vigilancia una vez y actúa al
   final; mientras espera, solo revisa el código.
   · «Avísame cuando…» → herramienta vigilar del agente: qué (vuelo · huesped_responde · pr_unido · reserva_cambia ·
     pagina_dice), objetivo, cada cuánto (cada_min, mínimo 5; la página, 15), cuándo vence (48 h por defecto, máximo 14 días;
     un vuelo, hasta que sale) y qué hacer al pasar (avisar con un texto y, si hace falta, seguir con un pedido).
   · Hoja ALMA_VIGILANCIAS. La revisa vigProcesar_ en procesarCola (cada minuto), cada una a su ritmo:
       vuelo            puerta, terminal y hora de salida de ALMA_VIAJES contra la foto de cuando se creó; el correo de la
                        aerolínea se vuelve a leer como mucho cada 30 min (la misma marca que el botón del avión).
       huesped_responde el último mensaje del huésped en la bandeja (ALMA_INBOX, que ya llenan el webhook y la
                        sincronización): sin internet.
       pr_unido         el estado del PR en GitHub (paraClaudePrInfo_, con su caché).
       reserva_cambia   las fechas, el estado y los huéspedes de la reserva en Hospitable (una huella).
       pagina_dice      la página (uf_) y si dice el texto; dos veces seguidas, para que una lectura mala no dispare.
   · Cupo de Google: lo que va a internet pregunta cupoPermite_('fondo') (canal «Vigilancias»), salvo si vence en menos
     de 2 h. Tres lecturas fallidas seguidas: deja de vigilar y lo dice.
   · Al pasar: aviso de nivel 1 (vozAvisoPoner_), queda cumplida y, si tiene pedido, ese pedido va al agente en segundo plano:
     es la única IA. Vence sin pasar: aviso de nivel 3.
   · Se ven en Pendientes («Vigilando: …», con «Dejar de vigilar») y en Ajustes → Lo que Alma aprendió. */

var VIG_HOJA_ = 'ALMA_VIGILANCIAS';
var VIG_CAB_ = ['id', 'email', 'que', 'objetivo', 'texto', 'resumen', 'cada_min', 'vence', 'al_pasar', 'estado', 'creada', 'revisada', 'foto', 'fallos', 'aciertos', 'cumplida', 'nota'];
var VIG_TIPOS_ = ['vuelo', 'huesped_responde', 'pr_unido', 'reserva_cambia', 'pagina_dice'];
var VIG_CADA_ = { vuelo: 10, huesped_responde: 5, pr_unido: 10, reserva_cambia: 30, pagina_dice: 60 };   // minutos por defecto
var VIG_RED_ = { vuelo: true, pr_unido: true, reserva_cambia: true, pagina_dice: true };   // van a internet: cuidan el cupo
var VIG_H_ = 3600000, VIG_MAX_H_ = 14 * 24, VIG_POR_VUELTA_ = 8, VIG_MAX_FALLOS_ = 3;
var VIG_QUE_TXT_ = { vuelo: 'tu vuelo', huesped_responde: 'la respuesta del huésped', pr_unido: 'el cambio por unir', reserva_cambia: 'la reserva', pagina_dice: 'la página' };

function vigHoja_() { return hojaCrear_(VIG_HOJA_, VIG_CAB_); }
function vigFilas_() {
  var sh = vigHoja_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, VIG_CAB_.length).getValues().map(function (v, i) {
    var o = { fila: i + 2 }; VIG_CAB_.forEach(function (k, j) { o[k] = v[j] instanceof Date ? v[j].toISOString() : v[j]; });
    try { o.al_pasar = JSON.parse(o.al_pasar || '{}') || {}; } catch (e) { o.al_pasar = {}; }
    try { o.foto = JSON.parse(o.foto || 'null'); } catch (e) { o.foto = null; }
    o.cada_min = Number(o.cada_min) || 10; o.fallos = Number(o.fallos) || 0; o.aciertos = Number(o.aciertos) || 0; o.id = String(o.id || '');
    return o;
  }).filter(function (o) { return o.id; });
}
function vigGuardar_(v) {
  var sh = vigHoja_(), fila = v.fila || 0;
  var row = VIG_CAB_.map(function (k) { var x = v[k]; return k === 'al_pasar' || k === 'foto' ? JSON.stringify(x == null ? null : x) : x == null ? '' : x; });
  if (fila) sh.getRange(fila, 1, 1, VIG_CAB_.length).setValues([row]); else { sh.appendRow(row); v.fila = sh.getLastRow(); }
  vigContarActivas_();
}
/* Cuántas hay activas: si no hay ninguna, la pasada de cada minuto ni abre la hoja. */
function vigContarActivas_() {
  var n = vigFilas_().filter(function (v) { return v.estado === 'activa'; }).length;
  PropertiesService.getScriptProperties().setProperty('VIG_ACTIVAS', String(n));
  return n;
}
function vigActivas_(email) {
  var e = String(email || '').toLowerCase();
  return vigFilas_().filter(function (v) { return v.estado === 'activa' && (!e || String(v.email).toLowerCase() === e); });
}

/* ── Crear (herramienta vigilar) ── inp: { que, objetivo, texto?, cada_min?, vence?, al_pasar: { avisar, pedido? } } */
function vigCrear_(adm, inp) {
  inp = inp || {};
  if (!adm || !esAdminPrincipal_(adm)) return { ok: false, error: 'Solo el administrador principal puede pedir que vigile algo.' };
  var que = String(inp.que || '').trim(); if (VIG_TIPOS_.indexOf(que) < 0) return { ok: false, error: 'Qué vigilar: ' + VIG_TIPOS_.join(', ') + '.' };
  var obj = String(inp.objetivo || '').trim(), ahora = Date.now(), al = inp.al_pasar || {};
  var v = { id: 'vg' + ahora.toString(36) + Math.floor(Math.random() * 1e4), email: adm.email, que: que, objetivo: obj, texto: String(inp.texto || '').trim().slice(0, 200),
    estado: 'activa', creada: new Date(ahora).toISOString(), revisada: '', fallos: 0, aciertos: 0, cumplida: '', nota: '',
    al_pasar: { avisar: String(al.avisar || '').trim().slice(0, 300), pedido: String(al.pedido || '').trim().slice(0, 1500) } };
  var min = que === 'pagina_dice' ? 15 : 5;
  v.cada_min = Math.max(min, Math.min(24 * 60, Math.round(Number(inp.cada_min) || VIG_CADA_[que])));
  var horas = vigHoras_(inp.vence, ahora);
  /* La foto de cómo está hoy: contra eso se compara. Si no se puede leer el objetivo, no se crea. */
  var f = vigFotoInicial_(adm, v); if (f.error) return { ok: false, error: f.error };
  v.foto = f.foto; v.resumen = f.resumen; v.objetivo = f.objetivo || v.objetivo;
  if (f.hasta && !inp.vence) horas = Math.min(VIG_MAX_H_, Math.max(1, (f.hasta - ahora) / VIG_H_));   // un vuelo: hasta que sale
  v.vence = new Date(ahora + horas * VIG_H_).toISOString();
  /* La misma vigilancia otra vez: se renueva, no se duplica. */
  var ya = vigActivas_(adm.email).filter(function (x) { return x.que === v.que && String(x.objetivo) === String(v.objetivo) && x.texto === v.texto; })[0];
  if (ya) { v.id = ya.id; v.fila = ya.fila; v.creada = ya.creada; }
  vigGuardar_(v);
  return { ok: true, id: v.id, vigilando: v.resumen, cada_min: v.cada_min, vence: Utilities.formatDate(new Date(v.vence), CFG.TZ, 'yyyy-MM-dd HH:mm'), renovada: !!ya,
    nota: 'Quedó vigilando sin gastar IA. Dile en una frase qué vigilas y hasta cuándo; te aviso cuando pase.' };
}
/* vence: horas (número) o una fecha «AAAA-MM-DD HH:MM». Por defecto 48 h; máximo 14 días. */
function vigHoras_(vence, ahora) {
  var x = String(vence == null ? '' : vence).trim(), h = 48;
  if (/^\d+(\.\d+)?$/.test(x)) h = Number(x);
  else if (x) { var t = Date.parse(x.replace(' ', 'T')); if (t > ahora) h = (t - ahora) / VIG_H_; }
  return Math.max(0.25, Math.min(VIG_MAX_H_, h));
}
function vigNormVuelo_(x) { return String(x || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
function vigFotoInicial_(adm, v) {
  var o = v.objetivo;
  if (v.que === 'vuelo') {
    var cuenta = viajesCuenta_(); if (!viajesPuede_(adm, cuenta)) return { error: 'Tu correo todavía no está conectado para leer tus vuelos.' };
    var vj = vigViaje_(cuenta, o); if (!vj) return { error: 'No encontré ese vuelo en tu correo. Pídele a Juan la confirmación o el número de vuelo (como en ver_vuelos).' };
    var tr = vigTramos_(vj); if (!tr.length) return { error: 'Ese vuelo ya salió.' };
    return { objetivo: vj.confirmacion || o, foto: tr, resumen: 'vuelo ' + tr.map(function (t) { return t.vuelo; }).join(' + ') + (vj.confirmacion ? ' (' + vj.confirmacion + ')' : ''), hasta: Date.parse(tr[tr.length - 1].sale) + VIG_H_ };
  }
  if (v.que === 'huesped_responde' || v.que === 'reserva_cambia') {
    var rid = agResId_(o); if (!rid) return { error: 'No encontré esa reserva o conversación. Búscala antes con buscar_reservas y usa su código.' };
    var fila = vigInbox_(rid) || {}, quien = fila.huesped || o;
    if (v.que === 'huesped_responde') return { objetivo: rid, foto: { guest_ts: fila.ultimo_guest_ts || '' }, resumen: 'que responda ' + quien };
    if (/^(wa|op|inq):/.test(rid)) return { error: 'Solo puedo vigilar cambios de una reserva confirmada.' };
    var h = vigReservaHuella_(rid); if (!h) return { error: 'No pude leer esa reserva en Hospitable ahora.' };
    return { objetivo: rid, foto: h, resumen: 'la reserva de ' + quien + (fila.codigo ? ' (' + fila.codigo + ')' : '') };
  }
  if (v.que === 'pr_unido') {
    if (!/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/.test(o)) return { error: 'Dame el enlace del PR (github.com/…/pull/número).' };
    var i = paraClaudePrInfo_(o); if (!i) return { error: 'No pude leer ese PR en GitHub.' };
    if (i.estado !== 'abierto') return { error: 'Ese PR ya está ' + i.estado + '.' };
    return { foto: { estado: i.estado }, resumen: 'que se una el PR #' + o.split('/pull/')[1].replace(/\D.*$/, '') };
  }
  if (v.que === 'pagina_dice') {
    if (!/^https:\/\//.test(o)) return { error: 'La página tiene que empezar con https://.' };
    if (!v.texto) return { error: 'Falta el texto que debe aparecer en la página.' };
    return { foto: null, resumen: 'que ' + o.replace(/^https:\/\/(www\.)?/, '').split('/')[0] + ' diga «' + v.texto + '»' };
  }
  return { error: 'No sé vigilar eso.' };
}
function vigViaje_(cuenta, objetivo) {
  var k = vigNormVuelo_(objetivo);
  return viajesLeer_(cuenta).filter(function (vj) { return (vj.confirmacion && vigNormVuelo_(vj.confirmacion) === k) || (vj.tramos || []).some(function (t) { return vigNormVuelo_(t.vuelo) === k; }); })[0] || null;
}
/* Lo que se compara de cada tramo que todavía no sale. */
function vigTramos_(vj) {
  var ahora = Date.now();
  return (vj.tramos || []).filter(function (t) { return Date.parse(t.sale) > ahora - VIG_H_; })
    .map(function (t) { return { vuelo: t.vuelo, puerta: t.puerta || '', terminal: (t.origen && t.origen.terminal) || '', sale: t.sale }; });
}
function vigInbox_(convId) {
  var sh = ssAlma_().getSheetByName('ALMA_INBOX'); if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, INBOX_CAB_.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === String(convId)) { var o = {}; INBOX_CAB_.forEach(function (k, j) { o[k] = v[i][j] instanceof Date ? v[i][j].toISOString() : String(v[i][j]); }); return o; }
  return null;
}
function vigReservaHuella_(uuid) {
  var r = hosp_('get', '/reservations/' + uuid), d = r && r.code === 200 && r.json && r.json.data; if (!d) return null;
  var cur = (d.reservation_status && d.reservation_status.current) || {};
  return { estado: String(cur.category || d.status || ''), entrada: String(d.arrival_date || '').slice(0, 16), salida: String(d.departure_date || '').slice(0, 16),
    noches: String(d.nights == null ? '' : d.nights), huespedes: String((d.guests && (d.guests.total != null ? d.guests.total : JSON.stringify(d.guests))) || '') };
}

/* ── Dejar de vigilar ── */
function vigDejar_(adm, cual) {
  var c = String(cual || '').trim().replace(/^vg:/, ''), lista = vigActivas_(adm && adm.email);
  var v = lista.filter(function (x) { return x.id === c; })[0];
  /* Por palabras («el vuelo», «lo de Marcela»): todas las que importan tienen que estar en lo que vigila. */
  if (!v && c) {
    var pal = recNorm_(c).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3 && RECETAS_VACIAS_.indexOf(w) < 0 && ['vigilar', 'vigila', 'vigilando', 'deja', 'dejar'].indexOf(w) < 0; });
    var hits = lista.filter(function (x) { var hay = recNorm_(x.resumen + ' ' + x.objetivo + ' ' + x.que.replace('_', ' ')); return pal.length && pal.every(function (w) { return hay.indexOf(w) >= 0; }); });
    v = hits.length === 1 ? hits[0] : null;
  }
  if (!v && lista.length === 1 && !c) v = lista[0];
  if (!v) return { ok: false, error: lista.length ? 'No supe cuál. Estoy vigilando: ' + lista.map(function (x) { return x.resumen; }).join('; ') + '.' : 'No estoy vigilando nada.' };
  v.estado = 'cancelada'; v.nota = 'la dejó ' + ((adm && adm.nombre) || 'Juan'); vigGuardar_(v);
  return { ok: true, dejaste: v.resumen };
}
function vigListaTexto_(adm) {
  return vigActivas_(adm && adm.email).map(function (v) { return { id: v.id, vigilando: v.resumen, cada_min: v.cada_min, vence: Utilities.formatDate(new Date(v.vence), CFG.TZ, 'yyyy-MM-dd HH:mm'), al_pasar: v.al_pasar.pedido ? 'avisar y ' + v.al_pasar.pedido : 'avisar' }; });
}

/* ── La revisión de cada minuto (procesarCola): solo código ── */
function vigProcesar_() {
  var p = PropertiesService.getScriptProperties(); if (p.getProperty('VIG_ACTIVAS') === '0') return { revisadas: 0 };
  var c = CacheService.getScriptCache(); if (c.get('vig_t')) return { revisadas: 0 }; c.put('vig_t', '1', 50);
  var ahora = Date.now(), t0 = ahora, out = { revisadas: 0, pausadas: 0, cumplidas: 0, vencidas: 0 }, enCupo = null, canal0 = CUPO_CTX_;
  try { return vigVuelta_(p, ahora, t0, out, enCupo); } finally { CUPO_CTX_ = canal0; }   // el resto de procesarCola sigue con su canal
}
function vigVuelta_(p, ahora, t0, out, enCupo) {
  var activas = vigFilas_().filter(function (v) { return v.estado === 'activa'; });
  if (!activas.length) { p.setProperty('VIG_ACTIVAS', '0'); return out; }
  activas.sort(function (a, b) { return String(a.revisada).localeCompare(String(b.revisada)); });
  for (var i = 0; i < activas.length && out.revisadas < VIG_POR_VUELTA_ && Date.now() - t0 < 25000; i++) {
    var v = activas[i], adm = adminPorEmail_(v.email);
    if (!adm) continue;
    if (ahora >= new Date(v.vence).getTime()) { vigVencer_(v, adm); out.vencidas++; continue; }
    if (v.revisada && ahora - new Date(v.revisada).getTime() < v.cada_min * 60000 - 20000) continue;
    var urgente = new Date(v.vence).getTime() - ahora < 2 * VIG_H_;
    if (VIG_RED_[v.que] && !urgente) { if (enCupo === null) enCupo = cupoPermite_('fondo'); if (!enCupo) { out.pausadas++; continue; } }
    cupoCanal_('Vigilancias');
    var r; try { r = vigRevisar_(v, adm, urgente); } catch (e) { r = { error: String(e.message || e).slice(0, 200) }; }
    out.revisadas++;
    v.revisada = new Date().toISOString();
    if (r.error) {
      v.fallos++; v.nota = r.error;
      if (v.fallos >= VIG_MAX_FALLOS_) { v.estado = 'detenida'; avisoPoner_(adm, 'vigilancia_error', { resumen: v.resumen, error: r.error }, 'vg:' + v.id, { nivel: 3 }); }
      vigGuardar_(v); continue;
    }
    v.fallos = 0;
    if (r.foto !== undefined) v.foto = r.foto;
    if (r.paso && r.confirmar && v.aciertos < 1) { v.aciertos = 1; v.revisada = new Date(ahora - (v.cada_min - 5) * 60000).toISOString(); vigGuardar_(v); continue; }   // la página: otra vez en 5 min
    if (!r.paso) { v.aciertos = 0; vigGuardar_(v); continue; }
    vigDisparar_(v, adm, r.detalle); out.cumplidas++;
  }
  return out;
}
/* ¿Ya pasó? → { paso, detalle, foto?, confirmar?, error? } */
function vigRevisar_(v, adm, urgente) {
  if (v.que === 'vuelo') {
    var cuenta = viajesCuenta_(), c = CacheService.getScriptCache(), k = 'viajes_rev_' + cuenta;
    /* El correo de la aerolínea, como mucho cada 30 min (la misma marca que el botón del avión). */
    if (Date.now() - Number(c.get(k) || 0) >= VIAJES_REVISAR_MIN_ * 60000) {
      var faltan = 0; try { faltan = viajesRevisar_(cuenta); } catch (e) { console.error('vig viajesRevisar_: ' + e); }
      if (!faltan) c.put(k, String(Date.now()), 21600);
    }
    var vj = vigViaje_(cuenta, v.objetivo); if (!vj) return { error: 'ya no encuentro el vuelo' };
    var ahora = vigTramos_(vj), cambios = [];
    (v.foto || []).forEach(function (a) {
      var b = ahora.filter(function (x) { return x.vuelo === a.vuelo; })[0]; if (!b) return;
      if (b.puerta && b.puerta !== a.puerta) cambios.push(a.vuelo + ': puerta ' + b.puerta + (a.puerta ? ' (antes ' + a.puerta + ')' : ''));
      if (b.terminal && b.terminal !== a.terminal) cambios.push(a.vuelo + ': terminal ' + b.terminal + (a.terminal ? ' (antes ' + a.terminal + ')' : ''));
      if (b.sale && String(b.sale).slice(0, 16) !== String(a.sale).slice(0, 16)) cambios.push(a.vuelo + ': sale ' + String(b.sale).slice(11, 16) + ' (antes ' + String(a.sale).slice(11, 16) + ')');   // la hora escrita (local del aeropuerto): arreglar el desfase no es un cambio
    });
    return { paso: cambios.length > 0, detalle: cambios.join('; ') };
  }
  if (v.que === 'huesped_responde') {
    var f = vigInbox_(v.objetivo); if (!f) return { error: 'ya no encuentro la conversación' };
    var t = new Date(f.ultimo_guest_ts).getTime(), desde = Math.max(new Date(v.creada).getTime(), new Date((v.foto || {}).guest_ts).getTime() || 0);
    if (!(t > desde)) return { paso: false };
    var txt = f.ultimo_de === 'guest' ? String(f.ultimo_texto || '').replace(/\s+/g, ' ').slice(0, 140) : '';
    return { paso: true, detalle: (f.huesped || 'El huésped') + ' respondió' + (txt ? ': «' + txt + '»' : '.') };
  }
  if (v.que === 'pr_unido') {
    var i = paraClaudePrInfo_(v.objetivo); if (!i) return { error: 'no pude leer el PR' };
    if (i.estado === 'unido') return { paso: true, detalle: 'Se unió ' + v.resumen.replace(/^que se una /, '') + '.' };
    if (i.estado === 'cerrado') return { paso: true, detalle: 'Se cerró sin unir ' + v.resumen.replace(/^que se una /, '') + '.' };
    return { paso: false };
  }
  if (v.que === 'reserva_cambia') {
    var h = vigReservaHuella_(v.objetivo); if (!h) return { error: 'no pude leer la reserva' };
    var nombres = { estado: 'estado', entrada: 'entrada', salida: 'salida', noches: 'noches', huespedes: 'huéspedes' }, dif = [];
    Object.keys(nombres).forEach(function (k2) { if (String(h[k2]) !== String((v.foto || {})[k2])) dif.push(nombres[k2] + ' ' + (h[k2] || '—') + ' (antes ' + ((v.foto || {})[k2] || '—') + ')'); });
    return { paso: dif.length > 0, detalle: 'Cambió ' + v.resumen + ': ' + dif.join(', ') + '.' };
  }
  if (v.que === 'pagina_dice') {
    var r = uf_(v.objetivo, { muteHttpExceptions: true, followRedirects: true }, 'Vigilancias');
    if (r.getResponseCode() >= 400) return { error: 'la página respondió ' + r.getResponseCode() };
    var cuerpo = recNorm_(String(r.getContentText() || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    var dice = cuerpo.indexOf(recNorm_(v.texto).replace(/\s+/g, ' ')) >= 0;
    return { paso: dice, confirmar: true, detalle: 'La página ya dice «' + v.texto + '».' };
  }
  return { error: 'tipo desconocido' };
}
function vigDisparar_(v, adm, detalle) {
  v.estado = 'cumplida'; v.cumplida = new Date().toISOString(); v.nota = String(detalle || '').slice(0, 300); vigGuardar_(v);
  try { avisoPoner_(adm, 'vigilancia_paso', { resumen: v.resumen, avisar: v.al_pasar.avisar, detalle: detalle }, 'vg:' + v.id, { nivel: 1 }); } catch (e) { console.error('vigDisparar_ aviso: ' + e); }   // texto humano: avisotexto.js
  if (v.al_pasar.pedido) { try { vigPedido_(adm, v, detalle); } catch (e) { console.error('vigDisparar_ pedido: ' + e); } }
}
/* Lo que hay que hacer al pasar: al agente, en segundo plano (la única IA de una vigilancia). */
function vigPedido_(adm, v, detalle) {
  var pedido = 'Pasó lo que me pediste vigilar (' + v.resumen + '): ' + (detalle || '') + '\nAhora: ' + v.al_pasar.pedido;
  if (adm.tels && adm.tels.length) return vozSecEncolar_(adm.tels[0], pedido);
  return opAgente_(adm, pedido, 'segundo_plano', [], opFilas_(adm.email, 20));
}
function vigVencer_(v, adm) {
  v.estado = 'vencida'; v.nota = 'venció sin pasar'; vigGuardar_(v);
  try { avisoPoner_(adm, 'vigilancia_vencio', { resumen: v.resumen }, 'vg:' + v.id, { nivel: 3 }); } catch (e) {}
}

/* ── Pendientes: «Vigilando: …» con «Dejar de vigilar» ── */
function vigTarjetas_(adm) {
  return vigActivas_(adm && adm.email).map(function (v) {
    var vence = Utilities.formatDate(new Date(v.vence), CFG.TZ, 'd/M HH:mm');
    return { id: 'vg:' + v.id, fuente: 'vigilancia', seccion: 'atencion', area: 'proposito', proyecto: '', titulo: 'Vigilando: ' + v.resumen,
      resumen: 'Te aviso cuando pase' + (v.al_pasar.pedido ? ' y sigo con: ' + v.al_pasar.pedido : '') + '. Reviso cada ' + v.cada_min + ' min, sin gastar IA, hasta el ' + vence + '.',
      ts: new Date(v.creada).getTime() || 0, importancia: 1, resolver: true, resolver_texto: 'Dejar de vigilar', estado: 'vigilando' };
  });
}
/* Ajustes → Lo que Alma aprendió: lo que vigila (acciones «vigilancias» y «vigilanciaDejar»). */
function vigApi_(ses) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  return { ok: true, vigilancias: vigActivas_(adm.email).map(function (v) { return { id: v.id, que: v.que, resumen: v.resumen, cada_min: v.cada_min, vence: v.vence, revisada: v.revisada || '', pedido: v.al_pasar.pedido || '' }; }) };
}
function vigDejarApi_(ses, id) {
  var adm = paraClaudePrincipalSes_(ses); if (!adm) return { ok: false, error: 'Solo el administrador principal.' };
  if (!String(id || '').trim()) return { ok: false, error: 'falta cuál' };
  return vigDejar_(adm, id);
}
