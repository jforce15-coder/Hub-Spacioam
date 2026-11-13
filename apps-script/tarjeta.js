/* ═══ TARJETA DE LA LLAMADA (#446 T2) ═══════════════════════════════════════════════════════════════════════════════
   En una llamada de la app de Alma, cuando la secretaria ya trajo los datos de UNA cosa concreta (una reserva, una
   conversación o un apartamento), el Hub arma una tarjeta con esos mismos datos y la app la pinta sobre la llamada.
   · Sin IA y sin herramienta nueva: agEjecutar_ (agente.js) deja una «candidata» con tvCandidata_ cuando buscar_reservas
     trae un solo resultado, o con ver_conversacion o ver_propiedad. Una lista borra la candidata (las listas no son tarjetas).
   · vozSecretaria_ (voz.js) cierra el turno con tvCerrar_: si la llamada es de la app (vozapp_) y Juan ve la pantalla, la
     guarda en voztarjeta_<conv_id> por 10 minutos y le dice a la voz «EN PANTALLA» (no lee lo que ya se ve). Con la
     pantalla bloqueada (Modo calle, anillo, conferencia) no se muestra: queda solo en el Chat con Alma, junto a la llamada
     (columna tarjeta de ALMA_OPERATIVO), sin notificación.
   · La app la pide con la acción vozTarjeta cuando le llega agent_tool_response de la secretaria. Mostrarla no llama a
     Hospitable: todo sale de lo que la herramienta ya leyó, de la hoja Reservas o de la caché del calendario de propiedades.
   · Nunca la misma cosa dos veces en una llamada (voztv_vistas_<conv_id>). Solo administradores: la familia nunca la ve.
   · El apartamento nunca lleva códigos, claves ni el wifi.
   · Dónde sí (Juan, 6-nov-2026; tvPermitida_): SOLO en una llamada de la app de Alma o del Hub con la voz de Alma
     EXPANDIDA (vozexp_), y solo con un administrador (el teléfono de la llamada es de un administrador). NUNCA por
     WhatsApp, el chat escrito o en segundo plano (la candidata solo nace en el canal «llamada») y NUNCA con huéspedes.
   · Consulta (inquiry): huésped, fechas, propiedad, su mensaje y el precio si lo hay; con un borrador, el texto que
     saldría. Mismas reglas que las demás.
   · Tablero bento (#508 T1): la reserva trae además cabeza y cuadros (tvCuadrosReserva_); la app nueva los acomoda con Alma
     minimizada abajo a la derecha, y la app vieja sigue pintando la tarjeta con los campos de siempre. */

var TV_CANDIDATA_ = null;
var TV_SEG_ = 600, TV_LLAMADA_SEG_ = 21600;
var TV_DIAS_ = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], TV_LETRA_ = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
var TV_MESES_ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var TV_CANAL_ = { airbnb: 'Airbnb', booking: 'Booking', vrbo: 'Vrbo', expedia: 'Expedia', directa: 'Directa' };
/* Lo que parece un código, una clave o el wifi no entra a la tarjeta (ni su campo ni su texto). */
var TV_SECRETO_CAMPO_ = /(code|codigo|código|clave|pass|pin\b|lock|cerradura|wifi|wi-fi|door|puerta_cod|token)/i;
var TV_SECRETO_TEXTO_ = /(c[oó]digo|clave|contrase|password|passcode|\bpin\b|wi-?fi|cerradura)/i;

/* agEjecutar_ deja la candidata del turno. tipo null = una lista: borra la de antes. hacer() arma la tarjeta solo si de
   verdad se va a mostrar (el apartamento lee la semana del calendario). */
function tvCandidata_(tipo, hacer) {
  if (typeof AGENTE_PERMITIDAS_ !== 'undefined' && AGENTE_PERMITIDAS_) return;   // la familia (vozFamilia_) nunca tiene tarjetas
  if (tipo && (typeof AGENTE_CANAL_ === 'undefined' || AGENTE_CANAL_ !== 'llamada')) { TV_CANDIDATA_ = null; return; }   // WhatsApp, chat o segundo plano: nunca
  TV_CANDIDATA_ = tipo && typeof hacer === 'function' ? { tipo: tipo, hacer: hacer } : null;
}

/* Al cerrar el turno de la secretaria. app: la llamada es de la app de Alma (vozapp_) · conf: modo conferencia.
   Devuelve null o { celda (columna tarjeta), voz (para el resultado), tarjeta, visible }. */
function tvCerrar_(convId, app, conf) {
  var cand = TV_CANDIDATA_; TV_CANDIDATA_ = null;
  convId = String(convId || '').trim();
  var c = CacheService.getScriptCache();
  if (!convId || !tvPermitida_(convId, app)) return null;   // voztarjeta_ solo en la app o el Hub expandido, con un administrador
  if (!cand) { c.remove('voztarjeta_' + convId); return null; }
  var t = null; try { t = cand.hacer(); } catch (e) { console.error('tarjeta ' + cand.tipo + ': ' + (e.stack || e)); }
  if (!t || !t.clave) { c.remove('voztarjeta_' + convId); return null; }
  var vistas = []; try { vistas = JSON.parse(c.get('voztv_vistas_' + convId) || '[]'); } catch (e) {}
  if (vistas.indexOf(t.clave) >= 0) { c.remove('voztarjeta_' + convId); return null; }   // nunca lo mismo dos veces
  var visible = !conf && c.get('vozpant_' + convId) !== '0';
  t.id = 'tv' + Date.now();
  var out = { tarjeta: t, visible: visible, celda: JSON.stringify({ tipo: t.tipo, id: t.ref, titulo: t.titulo }), voz: '' };
  if (visible) {
    vistas.push(t.clave);
    c.put('voztv_vistas_' + convId, JSON.stringify(vistas.slice(-40)), TV_LLAMADA_SEG_);
    c.put('voztarjeta_' + convId, JSON.stringify(t), TV_SEG_);
    out.voz = 'EN PANTALLA: ' + t.resumen + '. Juan ya lo ve en la tarjeta de la llamada.';
  } else c.remove('voztarjeta_' + convId);
  return out;
}

/* Acción vozTarjeta { conv_id }: la tarjeta de esta llamada (la pide la app). Solo el administrador de esa llamada. */
function vozTarjetaApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses), conv = String(b.conv_id || '').trim();
  if (!adm || !conv) return { ok: false, error: 'session' };
  if (!tvDeLaLlamada_(adm, conv)) return { ok: false, error: 'Esa llamada no es tuya.' };
  var t = null; try { t = JSON.parse(CacheService.getScriptCache().get('voztarjeta_' + conv) || 'null'); } catch (e) {}
  return { ok: true, tarjeta: t };
}
/* Acción vozPantalla { conv_id, visible }: la app avisa si Juan ve la pantalla (bloqueó el teléfono o volvió). */
function vozPantallaApi_(ses, b) {
  b = b || {};
  var adm = vozWebAdmin_(ses), conv = String(b.conv_id || '').trim();
  if (!adm || !conv) return { ok: false, error: 'session' };
  if (!tvDeLaLlamada_(adm, conv)) return { ok: false, error: 'Esa llamada no es tuya.' };
  CacheService.getScriptCache().put('vozpant_' + conv, b.visible === false || b.visible === 0 || b.visible === '0' ? '0' : '1', TV_LLAMADA_SEG_);
  return { ok: true };
}
/* ¿Esta llamada puede tener tarjeta? La app de Alma (vozapp_) o el Hub con la voz expandida (vozexp_), y quien habla es un
   administrador (vozweb_ lo dejó vozWebVincular_ con el teléfono de su sesión). Un huésped por teléfono no tiene ninguno. */
function tvPermitida_(convId, app) {
  var c = CacheService.getScriptCache();
  if (!app && c.get('vozexp_' + convId) !== '1') return false;
  var tel = vozWebTel_(convId);
  return !!(tel && adminPorTel_(tel));
}
function tvDeLaLlamada_(adm, conv) {
  var tel = vozWebTel_(conv); if (!tel) return false;
  return (adm.tels || []).some(function (x) { return fin8_(x) === fin8_(tel); });
}

/* La línea del Chat con Alma junto a la llamada: el código de la reserva se vuelve su fila «›» (js/sa-chat.js). */
function tvLineaChat_(celda) {
  var o = null; try { o = JSON.parse(String(celda || '')); } catch (e) {}
  if (!o || !o.tipo) return '';
  var cod = /^HM[A-Z0-9]{8}$/.test(String(o.id || '')) ? ' (' + o.id + ')' : '';
  if (o.tipo === 'reserva') return 'Tarjeta de la llamada · reserva de ' + (o.titulo || 'un huésped') + cod;
  if (o.tipo === 'conversacion') return 'Tarjeta de la llamada · conversación con ' + (o.titulo || 'un huésped') + cod;
  if (o.tipo === 'apartamento') return 'Tarjeta de la llamada · apartamento ' + (o.titulo || '');
  if (o.tipo === 'consulta') return 'Tarjeta de la llamada · consulta de ' + (o.titulo || 'un interesado');
  return '';
}
function tvConLinea_(m) {
  var l = m && m.tarjeta ? tvLineaChat_(m.tarjeta) : ''; if (!l) return m;
  var o = {}; Object.keys(m).forEach(function (k) { o[k] = m[k]; });
  o.texto = String(m.texto || '') + '\n\n' + l;
  return o;
}

/* ── Las piezas ── */
function tvTxt_(v, n) { v = (v === null || v === undefined || typeof v === 'object') ? '' : String(v); v = v.replace(/\s+/g, ' ').trim(); return n && v.length > n ? v.slice(0, n - 1).trim() + '…' : v; }
function tvIniciales_(n) { return tvTxt_(n).split(' ').filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join(''); }
function tvDia_(f) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(f || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null; }
function tvFecha_(f) { var d = tvDia_(f); return d ? TV_DIAS_[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + TV_MESES_[d.getUTCMonth()] : ''; }
function tvMasDias_(f, n) { var d = tvDia_(f); if (!d) return ''; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function tvNoches_(a, b) { var x = tvDia_(a), y = tvDia_(b); return x && y ? Math.max(0, Math.round((y - x) / 864e5)) : 0; }
function tvCanal_(p) { var x = String(p || '').toLowerCase(); var k = /airbnb/.test(x) ? 'airbnb' : /homeaway|vrbo/.test(x) ? 'vrbo' : /booking/.test(x) ? 'booking' : /expedia/.test(x) ? 'expedia' : x ? 'directa' : ''; return TV_CANAL_[k] || ''; }
function tvSecreto_(campo, texto) { return TV_SECRETO_CAMPO_.test(String(campo || '')) || TV_SECRETO_TEXTO_.test(String(texto || '')); }
/* «Z10 - Brunelo - 1203» → «Z10 · Brunelo 1203». */
function tvLugar_(nombre) { var p = calpPartes_(nombre); return p.zona && p.zona !== 'Otras' && p.corto !== p.zona ? p.zona + ' · ' + p.corto : (p.corto || tvTxt_(nombre)); }
function tvHoy_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function tvHora_(iso) {
  var d = new Date(iso); if (isNaN(d.getTime())) return '';
  var dia = Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd'), h = Utilities.formatDate(d, CFG.TZ, 'H:mm');
  return dia === tvHoy_() ? 'hoy ' + h : dia === tvMasDias_(tvHoy_(), -1) ? 'ayer ' + h : tvFecha_(dia).replace(/^\S+ /, '') + ' ' + h;
}
/* Un campo de la fila por su nombre (las hojas cambian de columnas): el primero que exista y tenga algo. */
function tvCampo_(r, re) { var k = Object.keys(r || {}).filter(function (x) { return re.test(x) && tvTxt_(r[x]); })[0]; return k ? r[k] : ''; }
function tvTel_(v) { var d = String(v || '').replace(/[^\d+]/g, ''); return d.replace(/\D/g, '').length >= 8 ? (d.charAt(0) === '+' ? d : '+' + d) : ''; }

/* Reserva y huésped: la fila de la hoja Reservas (r), lo que devolvió buscar_reservas (x) y su conversación de la bandeja. */
function tvReserva_(r, x, inbox) {
  x = x || {}; var cod = String(x.codigo || s_(r.code)).toUpperCase();
  var ib = (inbox || []).filter(function (y) { return String(y.codigo || '').toUpperCase() === cod; })[0] || {};
  var est = String(x.estado || ''), cancel = /cancel/i.test(est), solic = /solicit|request|pend|consulta/i.test(est);
  var canal = tvCanal_(s_(r.platform) || s_(r.source) || s_(r.channel) || ib.canal);
  var noches = tvNoches_(x.entrada, x.salida), hues = Number(x.huespedes) || 0;
  var datos = [x.registro === 'completo' ? 'Registro completo' : 'Registro pendiente'];
  var pago = tvCampo_(r, /^(payout|total|total_price|monto|pago|amount)/i);
  if (pago && !isNaN(Number(pago)) && Number(pago) > 0) datos.push('Total US$ ' + Math.round(Number(pago)));
  if (cancel && x.cancelada_el) datos.push('Cancelada el ' + tvFecha_(String(x.cancelada_el).slice(0, 10)));
  var hLlega = tvTxt_(tvCampo_(r, /^(checkin_time|check_in_time|hora_llegada)$/i), 5), hSale = tvTxt_(tvCampo_(r, /^(checkout_time|check_out_time|hora_salida)$/i), 5);
  var tel = tvTel_(tvCampo_(r, /^(guest_phone|phone|telefono|guest_telefono)$/i) || (String(ib.conv_id || '').indexOf('wa:') === 0 ? String(ib.conv_id).slice(3) : '') || ib.wa);
  return {
    tipo: 'reserva', clave: 'reserva:' + cod, ref: cod, etiqueta: 'Reserva · ' + cod,
    titulo: tvTxt_(x.huesped, 40) || 'Huésped', sub: [tvLugar_(x.propiedad), canal].filter(Boolean).join(' · '),
    chip: cancel ? 'Cancelada' : solic ? 'Por aprobar' : est ? est.charAt(0).toUpperCase() + est.slice(1) : 'Confirmada', tono: cancel ? 'alerta' : solic ? 'aviso' : 'info',
    foto: /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '', iniciales: tvIniciales_(x.huesped),
    fechas: [{ t: 'Llega', v: tvFecha_(x.entrada), d: hLlega }, { t: 'Sale', v: tvFecha_(x.salida), d: hSale }, { t: 'Noches', v: String(noches), d: hues ? hues + ' huésp.' : '' }],
    datos: datos, mensajes: [], promesas: [], semana: [],
    detalle: [tvTxt_(x.propiedad), canal ? 'Canal: ' + canal : '', hues ? hues + (hues === 1 ? ' huésped' : ' huéspedes') : '', ib.ultimo_texto ? 'Último mensaje: «' + tvTxt_(ib.ultimo_texto, 140) + '»' : ''].filter(Boolean),
    conv: cod || String(x.conv_id || ''), tel: tel, wa: tel ? tel.replace(/\D/g, '') : '',
    resumen: 'la reserva de ' + (tvTxt_(x.huesped) || 'el huésped') + ' (fechas, noches, registro' + (datos.length > 1 ? ' y pago' : '') + ')',
    /* Tablero bento (#508 T1): la app nueva pinta estos cuadros; la vieja sigue con los campos de arriba. */
    cabeza: 'Reserva de ' + (tvTxt_(x.huesped, 40) || 'un huésped'),
    cuadros: tvCuadrosReserva_(x, ib, {
      chip: cancel ? 'Cancelada' : solic ? 'Por aprobar' : est ? est.charAt(0).toUpperCase() + est.slice(1) : 'Confirmada', tono: cancel ? 'alerta' : solic ? 'aviso' : 'info',
      cancel: cancel, noches: noches, hues: hues, hLlega: hLlega, pago: pago && !isNaN(Number(pago)) && Number(pago) > 0 ? Math.round(Number(pago)) : 0
    })
  };
}

/* ── Tablero bento de la reserva (#508 T1) ─────────────────────────────────────────────────────────────────────────────
   Una lista de cuadros { id, tipo (foto|dato|mensaje|mapa|resumen), tam (s|m|alto|ancho), prioridad, ... }; la app los
   acomoda (alma/inicio.html, AlmaTarjeta): lo que falta no se manda y los demás crecen para llenar.
   · foto: la del apartamento (catálogo de propiedades guardado) con la foto del huésped (bandeja, viene de Hospitable) o sus
     iniciales encima; sin la del apartamento, la del huésped; sin ninguna, un degradado de la marca con las iniciales
     (tam m: un cuadro más angosto y los datos crecen). Nunca un cuadro vacío.
   · Fechas, huéspedes · noches y total (solo si la hoja lo trae).
   · Necesita respuesta: el último mensaje es del huésped, Alma no marcó que no lo necesita y la estadía no terminó.
   · Mapa: las coordenadas que ya guardó el Hub (catálogo o distancias); sin ellas, no hay mapa.
   · Resumen breve: cuándo llega, registro, promesa abierta y la última respuesta nuestra. Sin IA nueva.
   Nada de esto lleva códigos, claves ni wifi (tvTapar_). */
function tvCuadrosReserva_(x, ib, o) {
  ib = ib || {}; o = o || {};
  var out = [], apto = tvFotoProp_(x.propiedad), hues = /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '';
  var fondo = apto || hues;
  out.push({ id: 'foto', tipo: 'foto', tam: fondo ? 'alto' : 'm', prioridad: 1, fondo: fondo, de: apto ? 'apartamento' : fondo ? 'huesped' : '',
    avatar: apto ? hues : '', iniciales: tvIniciales_(x.huesped), alt: apto ? 'Foto de ' + tvLugar_(x.propiedad) : fondo ? 'Foto de ' + (tvTxt_(x.huesped) || 'el huésped') : '',
    chip: o.chip || '', tono: o.tono || 'info' });
  var rango = tvRango_(x.entrada, x.salida);
  if (rango) out.push({ id: 'fechas', tipo: 'dato', tam: 's', prioridad: 2, k: 'Fechas', v: rango,
    d: [tvFecha_(x.entrada).split(' ')[0], tvFecha_(x.salida).split(' ')[0]].filter(Boolean).join(' → ') + (o.hLlega ? ' · llega ' + o.hLlega : '') });
  if (o.noches || o.hues) out.push({ id: 'huespedes', tipo: 'dato', tam: 's', prioridad: 3, k: o.hues ? 'Huéspedes · noches' : 'Noches', v: o.hues ? o.hues + ' · ' + o.noches : String(o.noches) });
  if (o.pago) out.push({ id: 'pago', tipo: 'dato', tam: 's', prioridad: 4, k: 'Total', v: 'US$ ' + o.pago });
  var pend = tvPorResponder_(ib, x.salida, o.cancel);
  if (pend) out.push({ id: 'responder', tipo: 'mensaje', tam: 'ancho', prioridad: 2, k: 'Necesita respuesta', chip: pend.hora || 'Por responder', texto: pend.texto });
  var co = tvCoords_(x.propiedad);
  if (co) out.push({ id: 'mapa', tipo: 'mapa', tam: 'm', prioridad: 5, lat: co.lat, lng: co.lng, lugar: tvLugar_(x.propiedad) });
  var res = tvResumenReserva_(x, ib, o, !!pend);
  if (res) out.push({ id: 'resumen', tipo: 'resumen', tam: 'm', prioridad: 6, k: 'Resumen', texto: res });
  return out;
}
/* «6 → 9 nov» · «30 nov → 2 dic». */
function tvRango_(a, b) {
  var x = tvDia_(a), y = tvDia_(b); if (!x) return '';
  if (!y) return x.getUTCDate() + ' ' + TV_MESES_[x.getUTCMonth()];
  return x.getUTCMonth() === y.getUTCMonth() ? x.getUTCDate() + ' → ' + y.getUTCDate() + ' ' + TV_MESES_[y.getUTCMonth()]
    : x.getUTCDate() + ' ' + TV_MESES_[x.getUTCMonth()] + ' → ' + y.getUTCDate() + ' ' + TV_MESES_[y.getUTCMonth()];
}
/* Lo que parece un código dentro de un texto del huésped se tapa (los números largos), y el texto queda. */
function tvTapar_(t) { t = tvTxt_(t); return tvSecreto_('', t) ? t.replace(/\d{3,}/g, '••••') : t; }
/* El último mensaje de la bandeja, si es del huésped y espera respuesta (como «Por responder» del Hub: index.html noRequiere). */
function tvPorResponder_(ib, salida, cancel) {
  if (!ib || cancel || String(ib.ultimo_de) !== 'guest' || !tvTxt_(ib.ultimo_texto)) return null;
  var ug = Date.parse(ib.ultimo_guest_ts || ib.ultimo_ts), nr = Date.parse(ib.no_requiere);
  if (nr && ug && nr === ug) return null;                                      // Alma revisó: no necesita respuesta
  if (salida && tvMasDias_(String(salida).slice(0, 10), 1) < tvHoy_()) return null;   // la estadía ya terminó
  return { texto: '«' + tvTapar_(tvTxt_(ib.ultimo_texto, 180)) + '»', hora: tvHora_(ib.ultimo_guest_ts || ib.ultimo_ts) };
}
/* Coordenadas que el Hub ya guardó: el catálogo de propiedades (calprops.js) o las de distancias (distancia.js). Sin llamar. */
function tvCoords_(nombre) {
  var k = calpClave_(nombre), c = CacheService.getScriptCache(), hit = null;
  try { hit = JSON.parse(c.get('calp_catalogo') || '[]').filter(function (y) { return calpClave_(y.nombre) === k && y.lat; })[0]; } catch (e) {}
  if (!hit) try { hit = JSON.parse(c.get('dist_props') || '[]').filter(function (y) { return calpClave_(y.n) === k && y.lat; })[0]; } catch (e) {}
  var lat = hit ? Number(hit.lat) : NaN, lng = hit ? Number(hit.lng) : NaN;
  return isFinite(lat) && isFinite(lng) && (lat || lng) ? { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 } : null;
}
/* Resumen breve, con lo que ya se sabe: cuándo llega, el registro, la promesa abierta y nuestra última respuesta. */
function tvResumenReserva_(x, ib, o, pend) {
  var hoy = tvHoy_(), ent = String(x.entrada || '').slice(0, 10), sal = String(x.salida || '').slice(0, 10), fr = [];
  if (o.cancel) fr.push(x.cancelada_el ? 'Cancelada el ' + tvFecha_(String(x.cancelada_el).slice(0, 10)) : 'Reserva cancelada');
  else if (ent > hoy) { var n = tvNoches_(hoy, ent); fr.push(n === 1 ? 'Llega mañana' : 'Llega en ' + n + ' días'); }
  else if (ent === hoy) fr.push('Llega hoy');
  else if (sal > hoy) fr.push('En estadía · sale ' + (sal === tvMasDias_(hoy, 1) ? 'mañana' : tvFecha_(sal)));
  else if (sal === hoy) fr.push('Sale hoy');
  else if (sal) fr.push('Ya salió');
  if (!o.cancel) fr.push(x.registro === 'completo' ? 'Registro completo' : 'Registro pendiente');
  var pe = String(ib.promesa_estado || '');
  if ((pe === 'abierta' || pe === 'vencida') && tvTxt_(ib.promesa) && !tvSecreto_('', ib.promesa))
    fr.push('Promesa ' + pe + ': ' + tvTxt_(ib.promesa, 80) + (tvTxt_(ib.promesa_vence) ? ' (vence ' + tvTxt_(ib.promesa_vence, 16) + ')' : ''));
  if (!pend && String(ib.ultimo_de) === 'host' && tvHora_(ib.ultimo_host_ts || ib.ultimo_ts)) fr.push('Le respondimos ' + tvHora_(ib.ultimo_host_ts || ib.ultimo_ts));
  return fr.length ? fr.join('. ') + '.' : '';
}

/* Fragmento de conversación: los últimos 2 o 3 mensajes y las promesas abiertas (lo mismo que leyó ver_conversacion). */
function tvConversacion_(rid, hilo, promesas, inbox) {
  var ib = (inbox || []).filter(function (y) { return String(y.conv_id) === String(rid); })[0] || {};
  var nombre = tvTxt_(ib.huesped, 40), primer = nombre.split(' ')[0];
  var msgs = (hilo || []).filter(function (m) { return tvTxt_(m.texto) || (m.fotos || []).length; }).slice(-3).map(function (m) {
    var de = m.tipo === 'guest' ? 'huesped' : m.auto ? 'auto' : 'equipo';
    return { de: de, quien: de === 'huesped' ? (primer || 'Huésped') : de === 'auto' ? 'Automático' : 'Spacio AM', texto: tvTxt_(m.texto, 220) || '[foto]', hora: tvHora_(m.created) };
  });
  if (!msgs.length) return null;
  var cod = String(ib.codigo || '').toUpperCase();
  var pr = (promesas || []).map(function (p) { return tvTxt_(p.que, 90) + (p.vence ? ' · vence ' + tvTxt_(p.vence, 16) : ''); }).slice(0, 3);
  var tel = String(rid).indexOf('wa:') === 0 ? tvTel_(String(rid).slice(3)) : '';
  return {
    tipo: 'conversacion', clave: 'conversacion:' + rid, ref: cod || String(rid), etiqueta: 'Conversación' + (cod ? ' · ' + cod : ''),
    titulo: nombre || 'Conversación', sub: [ib.propiedad ? tvLugar_(ib.propiedad) : '', tvCanal_(ib.canal) || (tel ? 'WhatsApp' : '')].filter(Boolean).join(' · '),
    chip: pr.length ? 'Promesa abierta' : '', tono: 'aviso', foto: /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '', iniciales: tvIniciales_(nombre),
    fechas: [], datos: [], mensajes: msgs, promesas: pr, semana: [], detalle: [],
    conv: cod || String(rid), tel: tel, wa: tel ? tel.replace(/\D/g, '') : '',
    resumen: 'los últimos mensajes de la conversación' + (nombre ? ' con ' + nombre : '') + (pr.length ? ' y sus promesas abiertas' : '')
  };
}

/* Consulta (inquiry): quien escribió sin reservar. Sale de la fila de la bandeja (ib) y, si ya se leyó, de su hilo; con
   un borrador, el texto que saldría (todavía no salió: lo dice el chip). Precio solo si algo ya lo trae. */
function tvConsulta_(ib, hilo, borrador) {
  ib = ib || {}; var rid = String(ib.conv_id || ''); if (rid.indexOf('inq:') !== 0) return null;
  var nombre = tvTxt_(ib.huesped, 40), primer = nombre.split(' ')[0], canal = tvCanal_(ib.canal) || 'Airbnb';
  var ent = String(ib.checkin || '').slice(0, 10), sal = String(ib.checkout || '').slice(0, 10), noches = tvNoches_(ent, sal), hues = Number(ib.huespedes) || 0;
  var msgs = (hilo || []).filter(function (m) { return tvTxt_(m.texto); }).slice(-2).map(function (m) {
    var de = m.tipo === 'guest' ? 'huesped' : m.auto ? 'auto' : 'equipo';
    return { de: de, quien: de === 'huesped' ? (primer || 'Huésped') : de === 'auto' ? 'Automático' : 'Spacio AM', texto: tvTxt_(m.texto, 220), hora: tvHora_(m.created) };
  });
  if (!msgs.length && tvTxt_(ib.ultimo_texto)) msgs = [{ de: ib.ultimo_de === 'guest' ? 'huesped' : 'equipo', quien: ib.ultimo_de === 'guest' ? (primer || 'Huésped') : 'Spacio AM', texto: tvTxt_(ib.ultimo_texto, 220), hora: tvHora_(ib.ultimo_ts) }];
  if (tvTxt_(borrador)) msgs.push({ de: 'equipo', quien: 'Borrador · sale con tu sí', texto: tvTxt_(borrador, 400), hora: '' });
  var precio = tvCampo_(ib, /^(precio|price|total|monto|tarifa|quote)/i), datos = [];
  if (precio && !isNaN(Number(precio)) && Number(precio) > 0) datos.push('Precio US$ ' + Math.round(Number(precio)));
  datos.push('Sin reserva todavía');
  return {
    tipo: 'consulta', clave: 'consulta:' + rid + (tvTxt_(borrador) ? ':b' + tvTxt_(borrador).length : ''), ref: rid, etiqueta: 'Consulta · ' + canal,
    titulo: nombre || 'Interesado', sub: [ib.propiedad ? tvLugar_(ib.propiedad) : '', canal].filter(Boolean).join(' · '),
    chip: tvTxt_(borrador) ? 'Borrador' : 'Consulta', tono: 'aviso', foto: /^https:\/\//.test(String(ib.foto || '')) ? String(ib.foto) : '', iniciales: tvIniciales_(nombre),
    fechas: ent ? [{ t: 'Llega', v: tvFecha_(ent), d: '' }, { t: 'Sale', v: tvFecha_(sal), d: '' }, { t: 'Noches', v: String(noches), d: hues ? hues + ' huésp.' : '' }] : [],
    datos: datos, mensajes: msgs, promesas: [], semana: [], detalle: [tvTxt_(ib.propiedad)].filter(Boolean),
    conv: rid, tel: '', wa: '',
    resumen: (tvTxt_(borrador) ? 'el borrador para ' : 'la consulta de ') + (nombre || 'la persona') + ' (fechas, propiedad y su mensaje)'
  };
}

/* Apartamento: foto del anuncio, zona y edificio, cuartos, parqueo y portería, y la semana del calendario con los colores
   del glosario («Colores del calendario»). Nunca códigos, claves ni wifi. */
function tvApartamento_(nombre, j, plano) {
  nombre = tvTxt_(nombre); if (!nombre) return null;
  j = j || {}; plano = plano || {};
  var p = calpPartes_(nombre), std = (j.std && j.std.es) || {};
  var limpio = function (campo, v, n) { v = tvTxt_(v, n || 90); return v && !tvSecreto_(campo, v) ? v : ''; };
  var deCampo = function (re, n) { var k = Object.keys(plano).filter(function (x) { return re.test(x) && !tvSecreto_(x, plano[x]) && tvTxt_(plano[x]); })[0]; return k ? limpio(k, plano[k], n) : ''; };
  var cuartos = deCampo(/(bedroom|habitaci|dormitor|cuartos|recamar)/i, 30);
  var parqueo = limpio('parking', std.parking, 110) || deCampo(/(parqueo|parking|estacionamiento)/i, 110);
  var porteria = deCampo(/(porter|lobby|recepci|garita|conserje|concierge|seguridad)/i, 90);
  var datos = [cuartos ? (/^\d+$/.test(cuartos) ? cuartos + (cuartos === '1' ? ' habitación' : ' habitaciones') : cuartos) : '', parqueo ? 'Parqueo: ' + parqueo : '', porteria ? 'Portería: ' + porteria : ''].filter(Boolean);
  var foto = tvFotoProp_(nombre) || deCampo(/(picture|photo|foto|imagen|image)/i, 400);
  return {
    tipo: 'apartamento', clave: 'apartamento:' + calpClave_(nombre), ref: nombre, etiqueta: 'Apartamento' + (p.zona && p.zona !== 'Otras' ? ' · ' + p.zona : ''),
    titulo: p.corto || nombre, sub: [p.zona !== 'Otras' ? p.zona : '', p.edificio].filter(Boolean).join(' · '), chip: '', tono: '',
    foto: /^https:\/\//.test(foto) ? foto : '', iniciales: tvIniciales_(p.edificio || nombre),
    fechas: [], datos: datos, mensajes: [], promesas: [], semana: tvSemana_(nombre),
    detalle: [limpio('arrivalIntro', std.arrivalIntro, 220)].filter(Boolean), conv: '', tel: '', wa: '',
    resumen: 'la ficha de ' + (p.corto || nombre) + ' y su semana del calendario'
  };
}
/* La foto del anuncio sale del catálogo de Hospitable que ya guardó el calendario de propiedades (sin llamarlo). */
function tvFotoProp_(nombre) {
  try {
    var cat = JSON.parse(CacheService.getScriptCache().get('calp_catalogo') || '[]'), k = calpClave_(nombre);
    var x = cat.filter(function (y) { return calpClave_(y.nombre) === k; })[0];
    return x && x.foto ? String(x.foto) : '';
  } catch (e) { return ''; }
}
/* Siete noches desde hoy: res (reservado, azul) · con (consulta o solicitud, amarillo) · bloq (bloqueado, rojo) · libre (verde). */
function tvSemana_(nombre) {
  var hoy = tvHoy_(), fin = tvMasDias_(hoy, 7), k = calpClave_(nombre), est = null;
  try { var base = JSON.parse(CacheService.getScriptCache().get('calp_base_' + hoy) || 'null'); if (base && base.estadias) est = base.estadias; } catch (e) {}
  if (!est) est = calpEstadias_(hoy, fin);
  est = est.filter(function (e) { return calpClave_(e.propiedad) === k; });
  var bl = (calpBloqueos_([nombre])[k] || {}).d || [];
  var out = [];
  for (var i = 0; i < 7; i++) {
    var f = tvMasDias_(hoy, i), d = tvDia_(f), e = 'libre';
    var e1 = est.filter(function (x) { return x.checkin <= f && f < x.checkout; })[0];
    if (e1) e = e1.tipo === 'reserva' ? 'res' : 'con';
    else if (bl.some(function (b) { return b[0] === f && b[2] === 'B'; })) e = 'bloq';
    out.push({ f: f, letra: TV_LETRA_[d.getUTCDay()], n: d.getUTCDate(), e: e, hoy: i === 0 });
  }
  return out;
}
